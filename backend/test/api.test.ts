import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, SETUP_TOKEN, type TestApp } from './support.js';

/**
 * One club, followed through a realistic day: the admin sets it up, members
 * join and check in, a coach applies and gets approved, the Wall, classes,
 * shop and journal are used, and notifications land where they should.
 */
let t: TestApp;
let owner: string, sami: string, lina: string, anis: string, staff: string, outsider: string;
let doorCode: string;

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.newUser();
  sami = await t.newUser();
  lina = await t.newUser();
  anis = await t.newUser();
  staff = await t.newUser();
  outsider = await t.newUser();
});
afterAll(async () => t?.close());

const settle = () => t.bus.drain();
const unread = async (user: string) => (await t.call(user, 'GET', '/v1/notifications')).body as { unread: number; items: { type: string; title: string; body: string }[] };

describe('identity & club setup', () => {
  it('rejects anonymous calls', async () => {
    expect((await t.call(null, 'GET', '/v1/me')).status).toBe(401);
  });

  it('refuses a wrong setup token', async () => {
    const res = await t.call(owner, 'POST', '/v1/setup', { setupToken: 'wrong-token-wrong-token', gym: { name: 'Olympe Fitness', slug: 'olympe' }, owner: { fullName: 'Karim Admin' } });
    expect(res.status).toBe(403);
  });

  it('creates the club and its first admin', async () => {
    const res = await t.call(owner, 'POST', '/v1/setup', {
      setupToken: SETUP_TOKEN,
      gym: { name: 'Olympe Fitness', slug: 'olympe', city: 'Sousse' },
      owner: { fullName: 'Karim Admin', whatsapp: '21620000001' },
    });
    expect(res.status).toBe(201);
    expect(res.body.profile.role).toBe('owner');
    expect(res.body.gym.checkInCode).toMatch(/^GYM-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('asks signed-in users without a profile to onboard', async () => {
    const res = await t.call(sami, 'GET', '/v1/me');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('onboarding_required');
  });

  it('rejects an unknown club link', async () => {
    expect((await t.call(sami, 'POST', '/v1/onboarding', { gymSlug: 'nope', fullName: 'Sami' })).status).toBe(400);
  });

  it('onboards members', async () => {
    for (const [id, name, whatsapp] of [[sami, 'Sami B.', '21620000002'], [lina, 'Lina K.', null], [anis, 'Anis Coach', '21620000004'], [staff, 'Rim Accueil', null]] as const) {
      const res = await t.call(id, 'POST', '/v1/onboarding', { gymSlug: 'olympe', fullName: name, whatsapp, usualMuscles: ['legs'], trainingSlot: 'evening' });
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('member');
    }
    expect((await t.call(sami, 'POST', '/v1/onboarding', { gymSlug: 'olympe', fullName: 'Twice' })).status).toBe(409);
  });

  it('validates input with clear errors', async () => {
    const res = await t.call(sami, 'PATCH', '/v1/me', { whatsapp: '+216 20' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
  });

  it('only shows the door code to the admin', async () => {
    const asAdmin = await t.call(owner, 'GET', '/v1/gym');
    doorCode = asAdmin.body.checkInCode;
    expect(doorCode).toBeTruthy();
    expect((await t.call(sami, 'GET', '/v1/gym')).body.checkInCode).toBeUndefined();
  });
});

describe('attendance', () => {
  it('rejects a wrong QR code', async () => {
    const res = await t.call(sami, 'POST', '/v1/check-ins', { code: 'GYM-FAKE-CODE', muscles: ['legs'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('wrong_code');
  });

  it('checks in once, and a second scan only updates the focus', async () => {
    const first = await t.call(sami, 'POST', '/v1/check-ins', { code: doorCode.toLowerCase(), muscles: ['legs'] });
    expect(first.status).toBe(201);
    expect(first.body.streak).toMatchObject({ current: 1, visitedToday: true });

    const again = await t.call(sami, 'POST', '/v1/check-ins', { code: doorCode, muscles: ['legs', 'back'] });
    expect(again.status).toBe(200);
    expect(again.body.alreadyCheckedIn).toBe(true);
    expect(again.body.checkIn.muscles).toEqual(['legs', 'back']);
  });

  it('shows the live floor', async () => {
    const floor = (await t.call(lina, 'GET', '/v1/floor')).body;
    expect(floor.activeCount).toBe(1);
    expect(floor.people[0].fullName).toBe('Sami B.');
    expect(floor.muscles.find((m: { muscle: string }) => m.muscle === 'legs').count).toBe(1);
  });

  it('ends a visit', async () => {
    expect((await t.call(sami, 'POST', '/v1/check-ins/current/end')).status).toBe(200);
    expect((await t.call(sami, 'GET', '/v1/floor')).body.activeCount).toBe(0);
  });

  it('rotating the door code invalidates the old one', async () => {
    const rotated = (await t.call(owner, 'POST', '/v1/gym/check-in-code/rotate')).body.checkInCode;
    expect(rotated).not.toBe(doorCode);
    expect((await t.call(lina, 'POST', '/v1/check-ins', { code: doorCode })).status).toBe(400);
    doorCode = rotated;
  });
});

describe('memberships', () => {
  it('blocks check-in when the club enforces memberships', async () => {
    expect((await t.call(sami, 'PATCH', '/v1/gym', { enforceMemberships: true })).status).toBe(403);
    await t.call(owner, 'PATCH', '/v1/gym', { enforceMemberships: true });
    const res = await t.call(lina, 'POST', '/v1/check-ins', { code: doorCode });
    expect(res.status).toBe(402);
  });

  it('lets the admin renew, then the member gets in', async () => {
    const renewed = await t.call(owner, 'POST', `/v1/members/${lina}/renew`, { days: 30, priceMillimes: 70_000 });
    expect(renewed.status).toBe(201);
    expect(renewed.body).toMatchObject({ daysLeft: 29, active: true });
    expect((await t.call(lina, 'POST', '/v1/check-ins', { code: doorCode })).status).toBe(201);

    // Renewing again stacks after the current period instead of overlapping it.
    const stacked = await t.call(owner, 'POST', `/v1/members/${lina}/renew`, { days: 30 });
    expect(stacked.body.daysLeft).toBe(59);
  });

  it('shows the roster with last visits, to the admin only', async () => {
    expect((await t.call(sami, 'GET', '/v1/members')).status).toBe(403);
    const roster = (await t.call(owner, 'GET', '/v1/members')).body as { userId: string; lastVisitAt: string | null; membership: unknown }[];
    expect(roster).toHaveLength(5);
    expect(roster.find(r => r.userId === sami)!.lastVisitAt).not.toBeNull();
    expect(roster.find(r => r.userId === anis)!.membership).toBeNull();
  });

  it('sends expiry reminders', async () => {
    const soon = new Date(Date.now() + 56 * 86_400_000); // Lina's membership ends in 59 days → 3 days left
    expect(await t.services.memberships.remindExpiring(soon)).toBe(1);
    await settle();
    expect((await unread(lina)).items[0]!.type).toBe('membership.expiring');
    await t.call(owner, 'PATCH', '/v1/gym', { enforceMemberships: false });
  });
});

describe('coaching', () => {
  it('requires a WhatsApp number to apply', async () => {
    const res = await t.call(lina, 'POST', '/v1/coaches/apply', { headline: 'Yoga' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('whatsapp_required');
  });

  it('files an application and alerts the admin', async () => {
    const res = await t.call(anis, 'POST', '/v1/coaches/apply', {
      headline: 'Force & hypertrophie', specialties: ['Force'], yearsExperience: 6,
      floorCoach: true, availabilityDays: [1, 2, 3, 4, 5, 6, 7], availabilityHours: '00:00 – 23:59',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect((await t.call(anis, 'POST', '/v1/coaches/apply', {})).status).toBe(409);
    await settle();
    expect((await unread(owner)).items.some(n => n.type === 'coach.applied')).toBe(true);
  });

  it('hides pending applications from members', async () => {
    expect((await t.call(sami, 'GET', '/v1/coaches?status=pending')).status).toBe(403);
    expect((await t.call(sami, 'GET', '/v1/coaches')).body).toHaveLength(0);
  });

  it('approval makes them a coach and puts them on the list', async () => {
    const res = await t.call(owner, 'POST', `/v1/coaches/${anis}/approve`);
    expect(res.body.status).toBe('approved');
    expect((await t.call(anis, 'GET', '/v1/me')).body.role).toBe('coach');

    const list = (await t.call(sami, 'GET', '/v1/coaches')).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ fullName: 'Anis Coach', whatsapp: '21620000004', onFloorNow: true });
  });

  it('lets the coach set plans and step away', async () => {
    await t.call(anis, 'PATCH', '/v1/coaches/me', { plans: [{ title: 'Suivi mensuel', priceMillimes: 150_000, billingPeriod: 'par mois' }] });
    await t.call(anis, 'PUT', '/v1/coaches/me/live-status', { state: 'away' });
    const me = (await t.call(anis, 'GET', '/v1/coaches/me')).body;
    expect(me.plans[0].title).toBe('Suivi mensuel');
    expect(me.onFloorNow).toBe(false);
  });
});

describe('community', () => {
  let prPost: string;

  it('publishes a record and lets a coach validate it', async () => {
    const res = await t.call(sami, 'POST', '/v1/posts', { category: 'pr', caption: 'Enfin !', pr: { exercise: 'Squat', weightKg: 140, reps: 3 } });
    expect(res.status).toBe(201);
    prPost = res.body.id;

    expect((await t.call(sami, 'POST', `/v1/posts/${prPost}/validate-pr`)).status).toBe(403); // not a coach
    expect((await t.call(lina, 'POST', `/v1/posts/${prPost}/validate-pr`)).status).toBe(403);
    const ok = await t.call(anis, 'POST', `/v1/posts/${prPost}/validate-pr`);
    expect(ok.body.prValidatedByName).toBe('Anis Coach');
    expect((await t.call(anis, 'POST', `/v1/posts/${prPost}/validate-pr`)).status).toBe(409);
    await settle();
    expect((await unread(sami)).items[0]).toMatchObject({ type: 'pr.validated', body: '140 kg · Squat' });
  });

  it('counts likes once and hides them when the author asks', async () => {
    await t.call(lina, 'POST', `/v1/posts/${prPost}/like`);
    await t.call(lina, 'POST', `/v1/posts/${prPost}/like`);
    expect((await t.call(lina, 'GET', `/v1/posts/${prPost}`)).body).toMatchObject({ likesCount: 1, likedByMe: true });

    await t.call(sami, 'PATCH', `/v1/posts/${prPost}`, { likesHidden: true });
    expect((await t.call(lina, 'GET', `/v1/posts/${prPost}`)).body.likesCount).toBeNull();
    expect((await t.call(sami, 'GET', `/v1/posts/${prPost}`)).body.likesCount).toBe(1);

    await t.call(lina, 'DELETE', `/v1/posts/${prPost}/like`);
    expect((await t.call(sami, 'GET', `/v1/posts/${prPost}`)).body.likesCount).toBe(0);
  });

  it('comments, and respects comments being turned off', async () => {
    expect((await t.call(lina, 'POST', `/v1/posts/${prPost}/comments`, { text: 'Bravo 💪' })).status).toBe(201);
    await t.call(sami, 'PATCH', `/v1/posts/${prPost}`, { commentsDisabled: true });
    expect((await t.call(lina, 'POST', `/v1/posts/${prPost}/comments`, { text: 'Encore' })).status).toBe(403);
    expect((await t.call(lina, 'GET', `/v1/posts/${prPost}`)).body.commentsCount).toBe(1);
  });

  it('routes reports to moderation and lets the admin remove the post', async () => {
    const post = (await t.call(lina, 'POST', '/v1/posts', { caption: 'Vends protéines pas chères, DM' })).body.id;
    expect((await t.call(lina, 'POST', `/v1/posts/${post}/report`, { reason: 'spam' })).status).toBe(400); // own post
    await t.call(sami, 'POST', `/v1/posts/${post}/report`, { reason: 'Spam' });
    const queue = (await t.call(owner, 'GET', '/v1/moderation/reports')).body;
    expect(queue).toHaveLength(1);
    expect(queue[0].reasons).toEqual(['Spam']);

    expect((await t.call(sami, 'DELETE', `/v1/posts/${post}`)).status).toBe(403);
    expect((await t.call(owner, 'DELETE', `/v1/posts/${post}`)).status).toBe(204);
    expect((await t.call(owner, 'GET', '/v1/moderation/reports')).body).toHaveLength(0);
    expect((await t.call(sami, 'GET', '/v1/posts')).body.map((p: { id: string }) => p.id)).not.toContain(post);
  });
});

describe('classes', () => {
  let classId: string;
  let date: string;

  it('lets only schedule managers create classes', async () => {
    const body = { title: 'HIIT', coachId: anis, weekday: 3, startTime: '19:00', durationMin: 45, capacity: 1 };
    expect((await t.call(sami, 'POST', '/v1/classes', body)).status).toBe(403);
    const res = await t.call(owner, 'POST', '/v1/classes', body);
    expect(res.status).toBe(201);
    classId = res.body.id;
  });

  it('books the next session up to capacity', async () => {
    const schedule = (await t.call(sami, 'GET', '/v1/classes')).body;
    date = schedule[0].next.date;
    expect(schedule[0].coach.fullName).toBe('Anis Coach');

    const booked = await t.call(sami, 'POST', `/v1/classes/${classId}/sessions/${date}/booking`);
    expect(booked.body).toMatchObject({ spotsLeft: 0, bookedByMe: true });
    const full = await t.call(lina, 'POST', `/v1/classes/${classId}/sessions/${date}/booking`);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('class_full');
  });

  it('rejects a day the class does not run', async () => {
    const wrongDay = new Date(`${date}T00:00:00Z`);
    wrongDay.setUTCDate(wrongDay.getUTCDate() + 1);
    const res = await t.call(lina, 'POST', `/v1/classes/${classId}/sessions/${wrongDay.toISOString().slice(0, 10)}/booking`);
    expect(res.body.error.code).toBe('wrong_day');
  });

  it('lets the class coach cancel and warns booked members', async () => {
    expect((await t.call(lina, 'POST', `/v1/classes/${classId}/sessions/${date}/cancel`, { reason: 'Coach malade' })).status).toBe(403);
    const res = await t.call(anis, 'POST', `/v1/classes/${classId}/sessions/${date}/cancel`, { reason: 'Coach malade' });
    expect(res.body.status).toBe('cancelled');
    await settle();
    const n = (await unread(sami)).items[0]!;
    expect(n.type).toBe('session.cancelled');
    expect(n.body).toBe('Coach malade');
    expect((await t.call(sami, 'GET', '/v1/classes')).body[0].next).toMatchObject({ status: 'cancelled', cancelReason: 'Coach malade' });
  });
});

describe('staff permissions & shop', () => {
  let productId: string;
  let reservationId: string;

  it('staff can manage the shop only after a grant', async () => {
    const product = { name: 'Whey Gold 2 kg', category: 'Protéine', priceMillimes: 189_000, originalPriceMillimes: 210_000 };
    expect((await t.call(staff, 'POST', '/v1/products', product)).status).toBe(403);
    await t.call(owner, 'PUT', `/v1/staff/${staff}/permissions`, { permissions: ['manage_products'] });
    const res = await t.call(staff, 'POST', '/v1/products', product);
    expect(res.status).toBe(201);
    expect(res.body.discountPct).toBe(10);
    productId = res.body.id;
  });

  it('snapshots the price when a member reserves', async () => {
    const res = await t.call(sami, 'POST', '/v1/reservations', { productId, quantity: 2 });
    expect(res.body).toMatchObject({ status: 'pending', unitPriceMillimes: 189_000, totalMillimes: 378_000 });
    reservationId = res.body.id;
    await t.call(staff, 'PATCH', `/v1/products/${productId}`, { priceMillimes: 200_000 });
    expect((await t.call(sami, 'GET', '/v1/reservations')).body[0].unitPriceMillimes).toBe(189_000);
  });

  it('moves orders through valid steps only', async () => {
    expect((await t.call(sami, 'PATCH', `/v1/reservations/${reservationId}`, { status: 'ready' })).status).toBe(403);
    expect((await t.call(staff, 'PATCH', `/v1/reservations/${reservationId}`, { status: 'picked_up' })).body.error.code).toBe('invalid_transition');
    expect((await t.call(staff, 'PATCH', `/v1/reservations/${reservationId}`, { status: 'ready' })).body.status).toBe('ready');
    await settle();
    expect((await unread(sami)).items[0]).toMatchObject({ type: 'reservation.ready', body: 'Whey Gold 2 kg t’attend à l’accueil.' });
    expect((await t.call(staff, 'GET', '/v1/reservations?scope=all')).body).toHaveLength(1);
    expect((await t.call(sami, 'GET', '/v1/reservations?scope=all')).status).toBe(403);
  });

  it('refuses out-of-stock reservations', async () => {
    await t.call(staff, 'PATCH', `/v1/products/${productId}`, { inStock: false });
    expect((await t.call(lina, 'POST', '/v1/reservations', { productId })).body.error.code).toBe('out_of_stock');
  });

  it('keeps at least one admin', async () => {
    const res = await t.call(owner, 'PUT', `/v1/staff/${owner}/role`, { role: 'member' });
    expect(res.body.error.code).toBe('last_owner');
  });
});

describe('journal', () => {
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  const bench = (kg: number, reps: number, n = 3) => Array.from({ length: n }, () => ({ kg, reps, done: true, pr: true }));
  const workout = (d: number, exercises: object[]) => ({ date: day(d), startedAt: day(d), endedAt: day(d), live: true, exercises });
  const w1 = randomUUID(), w2 = randomUUID();

  it('stores a workout sent by the phone, and sending it twice changes nothing', async () => {
    const body = workout(5, [{ exerciseId: 'chest-bench', muscle: 'chest', sets: [...bench(30, 10), { kg: 40, reps: 8, done: false }] }]);
    const first = await t.call(sami, 'PUT', `/v1/journal/workouts/${w1}`, body);
    expect(first.status).toBe(200);
    expect(first.body.exercises[0].sets).toHaveLength(3); // the set not validated is not stored
    expect(first.body.exercises[0].sets.every((s: { pr: boolean }) => !s.pr)).toBe(true); // first time ever: no record, whatever the phone says

    await t.call(sami, 'PUT', `/v1/journal/workouts/${w1}`, body);
    const list = (await t.call(sami, 'GET', '/v1/journal/workouts?days=30')).body as { id: string }[];
    expect(list.filter(w => w.id === w1)).toHaveLength(1);
    expect((await t.pg.query('select count(*)::int as n from workout_sets where workout_id = $1', [w1])).rows[0]).toEqual({ n: 3 });
  });

  it('recomputes records on the server from earlier workouts only', async () => {
    const res = await t.call(sami, 'PUT', `/v1/journal/workouts/${w2}`, workout(1, [
      { exerciseId: 'chest-bench', muscle: 'chest', sets: [{ kg: 32.5, reps: 8, done: true }, { kg: 30, reps: 10, done: true }, { kg: '30', reps: 11, done: true }] },
      { exerciseId: 'cardio-bike', muscle: 'cardio', sets: [{ min: 20, km: 6.5, done: true }] },
    ]));
    expect(res.body.exercises[0].sets.map((s: { pr: boolean }) => s.pr)).toEqual([true, false, true]);
    expect(res.body.exercises[1].sets[0]).toEqual({ min: 20, km: 6.5, done: true });

    const summary = (await t.call(sami, 'GET', '/v1/journal/summary')).body;
    expect(summary.lastSession).toMatchObject({ id: w2, sets: 4, exercises: 2 });
    expect(summary.suggestedMuscle).not.toBe('chest');
  });

  it('refuses impossible values and other members’ workouts', async () => {
    const heavy = await t.call(sami, 'PUT', `/v1/journal/workouts/${randomUUID()}`, workout(0, [{ exerciseId: 'legs-squat', sets: [{ kg: 900, reps: 1, done: true }] }]));
    expect(heavy.status).toBe(422);
    expect((await t.call(sami, 'PUT', `/v1/journal/workouts/${randomUUID()}`, workout(0, [{ exerciseId: 'legs-squat', sets: [{ kg: 100, reps: 101, done: true }] }]))).status).toBe(422);
    expect((await t.call(sami, 'PUT', `/v1/journal/workouts/${randomUUID()}`, workout(0, [{ exerciseId: 'cardio-run', muscle: 'cardio', sets: [{ min: 301, done: true }] }]))).status).toBe(422);
    // a total typed in the old journal is allowed above 500 kg
    const legacy = await t.call(sami, 'PUT', `/v1/journal/workouts/${randomUUID()}`, { ...workout(40, [{ exerciseId: 'chest-bench', sets: [{ kg: 1800, reps: 1, done: true, legacy: true }] }]), migrated: true });
    expect(legacy.status).toBe(200);

    expect((await t.call(lina, 'PUT', `/v1/journal/workouts/${w1}`, workout(5, []))).status).toBe(403);
    expect((await t.call(lina, 'DELETE', `/v1/journal/workouts/${w1}`)).status).toBe(403);
  });

  it('soft deletes, and deleting again is still a success', async () => {
    expect((await t.call(sami, 'DELETE', `/v1/journal/workouts/${w2}`)).status).toBe(204);
    expect((await t.call(sami, 'DELETE', `/v1/journal/workouts/${w2}`)).status).toBe(204);
    const list = (await t.call(sami, 'GET', '/v1/journal/workouts')).body as { id: string }[];
    expect(list.some(w => w.id === w2)).toBe(false);
    // a late replay of the save does not bring it back
    await t.call(sami, 'PUT', `/v1/journal/workouts/${w2}`, workout(1, []));
    expect(((await t.call(sami, 'GET', '/v1/journal/workouts')).body as { id: string }[]).some(w => w.id === w2)).toBe(false);
  });

  it('keeps own exercises per member, refuses duplicates, and keeps used ones', async () => {
    const id = randomUUID();
    expect((await t.call(lina, 'PUT', `/v1/journal/exercises/mine/${id}`, { muscle: 'legs', name: '  Hip thrust ', kind: 'weight' })).body).toMatchObject({ id, name: 'Hip thrust' });
    expect((await t.call(lina, 'PUT', `/v1/journal/exercises/mine/${id}`, { muscle: 'legs', name: 'Hip thrust', kind: 'weight' })).status).toBe(200); // replay
    expect((await t.call(lina, 'PUT', `/v1/journal/exercises/mine/${randomUUID()}`, { muscle: 'legs', name: 'hip THRUST', kind: 'weight' })).status).toBe(409);
    expect((await t.call(lina, 'PUT', `/v1/journal/exercises/mine/${randomUUID()}`, { muscle: 'legs', name: 'H', kind: 'weight' })).status).toBe(400);
    expect((await t.call(sami, 'GET', '/v1/journal/exercises/mine')).body).toEqual([]);
    expect((await t.call(sami, 'PUT', `/v1/journal/exercises/mine/${id}`, { muscle: 'legs', name: 'Mine now', kind: 'weight' })).status).toBe(403);

    await t.call(lina, 'PUT', `/v1/journal/workouts/${randomUUID()}`, workout(0, [{ exerciseId: id, muscle: 'legs', sets: [{ kg: 60, reps: 10, done: true }] }]));
    expect((await t.call(lina, 'DELETE', `/v1/journal/exercises/mine/${id}`)).status).toBe(409);
  });
});

describe('notifications & uploads', () => {
  it('pushes to registered devices and marks items read', async () => {
    await t.call(sami, 'POST', '/v1/push-devices', { token: 'ExponentPushToken[sami-phone]', platform: 'android' });
    const post = (await t.call(sami, 'POST', '/v1/posts', { caption: 'Séance jambes ✅' })).body.id;
    await t.call(lina, 'POST', `/v1/posts/${post}/like`);
    await settle();
    expect(t.pushed.at(-1)).toMatchObject({ to: 'ExponentPushToken[sami-phone]', title: 'Lina K. a aimé ta publication' });

    expect((await unread(sami)).unread).toBeGreaterThan(0);
    await t.call(sami, 'POST', '/v1/notifications/read', {});
    expect((await unread(sami)).unread).toBe(0);
  });

  it('signs image uploads into the right bucket', async () => {
    const res = await t.call(sami, 'POST', '/v1/uploads/sign', { kind: 'avatar', contentType: 'image/jpeg', bytes: 200_000 });
    expect(res.status).toBe(201);
    expect(res.body.bucket).toBe('avatars');
    expect(res.body.path).toMatch(new RegExp(`/${sami}/[0-9a-f-]+\\.jpg$`));
    expect((await t.call(sami, 'POST', '/v1/uploads/sign', { kind: 'product', contentType: 'image/png', bytes: 1000 })).status).toBe(403);
  });
});

describe('platform', () => {
  it('serves health and OpenAPI docs', async () => {
    expect((await t.call(null, 'GET', '/health')).body).toEqual({ ok: true });
    const docs = await t.call(null, 'GET', '/docs/json');
    expect(docs.status).toBe(200);
    expect(Object.keys(docs.body.paths)).toContain('/v1/check-ins');
  });
});

describe('tenant isolation', () => {
  it('keeps another club’s data out of reach', async () => {
    await t.call(outsider, 'POST', '/v1/setup', { setupToken: SETUP_TOKEN, gym: { name: 'Autre Club', slug: 'autre' }, owner: { fullName: 'Other Admin' } });
    expect((await t.call(outsider, 'GET', '/v1/posts')).body).toHaveLength(0);
    expect((await t.call(outsider, 'GET', '/v1/coaches')).body).toHaveLength(0);
    expect((await t.call(outsider, 'POST', `/v1/members/${sami}/renew`, { days: 30 })).status).toBe(404);
    expect((await t.call(outsider, 'PUT', `/v1/staff/${sami}/permissions`, { permissions: ['manage_products'] })).status).toBe(404);
  });
});

describe('member habits (Bienvenue questionnaire)', () => {
  it('saves the questionnaire card by card', async () => {
    expect((await t.call(sami, 'PATCH', '/v1/me/profile', { usualDays: [1, 3, 5], usualDaysVaries: false })).status).toBe(200);
    await t.call(sami, 'PATCH', '/v1/me/profile', { usualSlot: 'evening' });
    await t.call(sami, 'PATCH', '/v1/me/profile', { trainingStyle: 'split', onboardingStatus: 'partial' });

    const { body } = await t.call(sami, 'GET', '/v1/me/profile');
    expect(body.usualDays).toEqual([1, 3, 5]);
    expect(body.usualSlot).toBe('evening');
    expect(body.trainingStyle).toBe('split');
    expect(body.onboardingStatus).toBe('partial');
  });

  it('stores the declared subscription and marks it as declared', async () => {
    // "Il y a 3-4 semaines" + "3 mois" answered on 2 Oct 2026.
    await t.call(sami, 'PATCH', '/v1/me/profile', {
      subscriptionPaidAt: '2026-09-08',
      subscriptionPaidAtSource: 'estimate',
      subscriptionPaidAtMarginDays: 5,
      subscriptionDuration: '3m',
      subscriptionEndsAt: '2026-12-08',
    });

    const { body } = await t.call(sami, 'GET', '/v1/me/profile');
    expect(body.subscriptionPaidAt).toBe('2026-09-08');
    expect(body.subscriptionEndsAt).toBe('2026-12-08');
    expect(body.subscriptionPaidAtSource).toBe('estimate');
    expect(body.declared).toBe(true);
  });

  it('refuses values outside the questionnaire', async () => {
    expect((await t.call(sami, 'PATCH', '/v1/me/profile', { usualSlot: 'midnight' })).status).toBe(400);
    expect((await t.call(sami, 'PATCH', '/v1/me/profile', { subscriptionDuration: '2m' })).status).toBe(400);
    expect((await t.call(sami, 'PATCH', '/v1/me/profile', { usualDays: [9] })).status).toBe(400);
  });

  it('makes the date exact once the member confirms a renewal', async () => {
    const { body } = await t.call(sami, 'POST', '/v1/me/subscription/renewed', { duration: '3m' });
    expect(body.subscriptionPaidAtSource).toBe('confirmed');
    expect(body.subscriptionPaidAtMarginDays).toBe(0);
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
    expect(body.subscriptionEndsAt).toBe(
      `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    );
  });

  it('stops asking after two "plus tard"', async () => {
    expect((await t.call(lina, 'POST', '/v1/me/onboarding/snooze')).body.onboardingStatus).toBe('snoozed');
    expect((await t.call(lina, 'POST', '/v1/me/onboarding/snooze')).body.onboardingStatus).toBe('done');
  });

  it('never exposes another member habits or payment date', async () => {
    // There is no route that takes a member id: everyone only ever reads his own row.
    const mine = (await t.call(lina, 'GET', '/v1/me/profile')).body;
    expect(mine?.subscriptionPaidAt ?? null).toBeNull();
    expect(JSON.stringify(mine ?? {})).not.toContain('2026-09-08');
  });

  it('gives the owner counts only, labelled as declared', async () => {
    const { status, body } = await t.call(owner, 'GET', '/v1/owner/subscriptions/summary');
    expect(status).toBe(200);
    expect(body).toHaveProperty('endingThisWeek');
    expect(body).toHaveProperty('renewedThisWeek');
    expect(body.declared).toBe(true);
    expect(JSON.stringify(body)).not.toContain(sami); // no member ids in an aggregate
  });

  it('refuses the owner summary to a member', async () => {
    expect((await t.call(sami, 'GET', '/v1/owner/subscriptions/summary')).status).toBe(403);
  });
});

describe('owner analytics (RBAC + growth)', () => {
  it('refuses every non-owner, including staff with other grants', async () => {
    expect((await t.call(sami, 'GET', '/v1/owner/analytics')).status).toBe(403);
    expect((await t.call(anis, 'GET', '/v1/owner/analytics')).status).toBe(403);
    expect((await t.call(staff, 'GET', '/v1/owner/analytics')).status).toBe(403);
    expect((await t.call(null, 'GET', '/v1/owner/analytics')).status).toBe(401);
  });

  it('gives the owner growth, churn and revenue against the previous window', async () => {
    const { status, body } = await t.call(owner, 'GET', '/v1/owner/analytics');
    expect(status).toBe(200);

    // Everyone signed up during this test run, so the week is non-zero and
    // the previous week has nothing to compare against.
    expect(body.signups.week).toBeGreaterThan(0);
    expect(body.signups.prevWeek).toBe(0);
    expect(body.signups.weekChange).toBeNull(); // growth from zero is not a percentage

    expect(body.members.total).toBeGreaterThan(0);
    expect(body.members).toHaveProperty('lapsed');
    expect(body.members).toHaveProperty('neverCame');
    expect(body.revenueMillimes).toHaveProperty('month');
    expect(body.currency).toBe('TND');
  });

  it('never leaks a member id in the aggregates', async () => {
    const { body } = await t.call(owner, 'GET', '/v1/owner/analytics');
    expect(JSON.stringify(body)).not.toContain(sami);
    expect(JSON.stringify(body)).not.toContain(lina);
  });

  it('returns a daily signup series for the chart', async () => {
    const { body } = await t.call(owner, 'GET', '/v1/owner/analytics/signups?days=14');
    expect(body).toHaveLength(14);
    expect(body[13]).toHaveProperty('day');
    expect(body.reduce((s: number, p: { n: number }) => s + p.n, 0)).toBeGreaterThan(0);
  });

  it('rejects an out-of-range window', async () => {
    expect((await t.call(owner, 'GET', '/v1/owner/analytics/signups?days=500')).status).toBe(400);
  });
});
