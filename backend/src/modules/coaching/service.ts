import type { Db } from '../../shared/db/client.js';
import type { EventBus } from '../../shared/events/bus.js';
import { isOwner, requirePermission, type Actor } from '../../shared/auth/actor.js';
import { badRequest, conflict, forbidden, notFound } from '../../shared/errors.js';
import { localTime, localWeekday } from '../../shared/time.js';
import type { ClubsService } from '../clubs/index.js';
import type { IdentityService } from '../identity/index.js';
import { coachingRepository, type CoachRow, type CoachStatus } from './repository.js';

/** A manual "I'm here / I stepped out" toggle holds this long before the usual schedule takes over again. */
export const LIVE_STATUS_TTL_MIN = 4 * 60;

export interface CoachProfileInput {
  headline?: string | null;
  bio?: string;
  specialties?: string[];
  yearsExperience?: number;
  certifications?: string[];
  availabilityDays?: number[];
  availabilityHours?: string | null;
  acceptingClients?: boolean;
  floorCoach?: boolean;
  bannerUrl?: string | null;
}

export interface PlanInput { title: string; priceMillimes: number; billingPeriod: string; features: string[]; popular: boolean }
export interface TransformationInput { clientName: string; beforeUrl: string; afterUrl: string; duration: string; result: string }

/** "17:00 – 21:00" → minutes since midnight. Null when the text has no two times. */
export function parseHourRange(text: string | null | undefined): { start: number; end: number } | null {
  const m = [...(text ?? '').matchAll(/(\d{1,2})[:h](\d{2})/g)];
  if (m.length < 2) return null;
  const toMin = (x: RegExpExecArray) => Number(x[1]) * 60 + Number(x[2]);
  return { start: toMin(m[0]!), end: toMin(m[1]!) };
}

/** Whether a floor coach is around right now: a fresh manual toggle wins, otherwise their schedule decides. */
export function isOnFloorNow(c: Pick<CoachRow, 'status' | 'floorCoach' | 'liveState' | 'liveStateAt' | 'availabilityDays' | 'availabilityHours'>, now: Date, timeZone: string): boolean {
  if (c.status !== 'approved' || !c.floorCoach) return false;
  if (c.liveState && c.liveStateAt) {
    const ageMin = (now.getTime() - c.liveStateAt.getTime()) / 60_000;
    if (ageMin >= 0 && ageMin < LIVE_STATUS_TTL_MIN) return c.liveState === 'here';
  }
  if (!c.availabilityDays.includes(localWeekday(now, timeZone))) return false;
  const range = parseHourRange(c.availabilityHours);
  if (!range) return true;
  const [h, m] = localTime(now, timeZone).split(':').map(Number);
  const nowMin = h! * 60 + m!;
  return range.start <= range.end ? nowMin >= range.start && nowMin <= range.end : nowMin >= range.start || nowMin <= range.end;
}

export function createCoachingService(db: Db, bus: EventBus, deps: { clubs: ClubsService; identity: IdentityService }) {
  const repo = coachingRepository(db);

  const hydrate = async (rows: CoachRow[], timezone: string) => {
    const ids = rows.map(r => r.userId);
    const [people, plans, transformations] = await Promise.all([
      deps.identity.profilesByIds(ids),
      repo.plansOf(ids),
      repo.transformationsOf(ids),
    ]);
    const now = new Date();
    return rows.map(r => ({
      ...r,
      fullName: people.get(r.userId)?.fullName ?? '',
      avatarUrl: people.get(r.userId)?.avatarUrl ?? null,
      whatsapp: people.get(r.userId)?.whatsapp ?? null,
      onFloorNow: isOnFloorNow(r, now, timezone),
      plans: plans.filter(p => p.coachId === r.userId),
      transformations: transformations.filter(t => t.coachId === r.userId),
    }));
  };

  const mine = async (actor: Actor) => {
    const row = await repo.byUser(actor.id);
    if (!row) throw notFound('Coach profile');
    return row;
  };

  return {
    /** Approved coaches for everyone; pending and rejected applications only for reviewers. */
    async list(actor: Actor, status: CoachStatus = 'approved') {
      if (status !== 'approved') requirePermission(actor, 'manage_coaches');
      const gym = await deps.clubs.getGym(actor.gymId);
      return hydrate(await repo.byStatus(actor.gymId, status), gym.timezone);
    },

    async getMine(actor: Actor) {
      const gym = await deps.clubs.getGym(actor.gymId);
      return (await hydrate([await mine(actor)], gym.timezone))[0];
    },

    async apply(actor: Actor, input: CoachProfileInput) {
      const existing = await repo.byUser(actor.id);
      if (existing && existing.status !== 'rejected') {
        throw conflict('already_applied', existing.status === 'approved' ? 'You are already a coach.' : 'Your application is waiting for the club admin.');
      }
      const profile = await deps.identity.profile(actor.id);
      if (!profile?.whatsapp) throw badRequest('whatsapp_required', 'Add your WhatsApp number to your profile so members can reach you.');

      // An admin who coaches is approved straight away.
      const approved = isOwner(actor);
      const row = await repo.upsert({
        ...input, userId: actor.id, gymId: actor.gymId,
        status: approved ? 'approved' : 'pending',
        reviewedBy: approved ? actor.id : null, reviewedAt: approved ? new Date() : null,
      });
      if (!approved) bus.emit('coach.applied', { gymId: actor.gymId, userId: actor.id, fullName: actor.fullName });
      return row;
    },

    async updateMine(actor: Actor, input: CoachProfileInput & { plans?: PlanInput[]; transformations?: TransformationInput[] }) {
      await mine(actor);
      const { plans, transformations, ...profile } = input;
      return db.transaction(async tx => {
        const r = coachingRepository(tx);
        const row = Object.keys(profile).length ? await r.update(actor.id, profile) : (await r.byUser(actor.id))!;
        if (plans) await r.replacePlans(actor.id, actor.gymId, plans);
        if (transformations) await r.replaceTransformations(actor.id, actor.gymId, transformations);
        return row;
      });
    },

    async setLiveStatus(actor: Actor, state: 'here' | 'away') {
      const row = await mine(actor);
      if (row.status !== 'approved') throw forbidden('Your coach profile is not approved yet.');
      return repo.update(actor.id, { liveState: state, liveStateAt: new Date() });
    },

    async review(actor: Actor, userId: string, approve: boolean) {
      requirePermission(actor, 'manage_coaches');
      const row = await repo.byUser(userId);
      if (!row || row.gymId !== actor.gymId) throw notFound('Coach application');

      const updated = await repo.update(userId, { status: approve ? 'approved' : 'rejected', reviewedBy: actor.id, reviewedAt: new Date() });
      await deps.identity.setCoachRole(userId, approve);
      bus.emit('coach.reviewed', { gymId: actor.gymId, userId, approved: approve, actorId: actor.id });
      return updated;
    },
  };
}

export type CoachingService = ReturnType<typeof createCoachingService>;
