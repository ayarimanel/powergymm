import { describe, expect, it } from 'vitest';
import { computeStreak, floorLevel } from '../src/modules/attendance/index.js';
import { nextSessionDate } from '../src/modules/classes/index.js';
import { isOnFloorNow, parseHourRange } from '../src/modules/coaching/index.js';
import { isNewRecord, suggestMuscle, summary, type WorkoutFact } from '../src/modules/journal/rules.js';
import { discountPct } from '../src/modules/shop/index.js';
import { TRANSITIONS } from '../src/modules/shop/service.js';
import { renewalStart, statusOf } from '../src/modules/memberships/service.js';
import { can, type Actor } from '../src/shared/auth/actor.js';
import { addDays, daysBetween, localDay, localWeekday, weekdayOf } from '../src/shared/time.js';

const TZ = 'Africa/Tunis'; // UTC+1, no DST

describe('time', () => {
  it('uses the gym timezone for the calendar day', () => {
    // 23:30 UTC on the 1st is 00:30 on the 2nd in Tunis.
    expect(localDay(new Date('2026-03-01T23:30:00Z'), TZ)).toBe('2026-03-02');
    expect(localWeekday(new Date('2026-03-01T23:30:00Z'), TZ)).toBe(1); // Monday 2 March
  });
  it('does calendar arithmetic across months', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
    expect(weekdayOf('2026-09-27')).toBe(7);
  });
});

describe('visit streak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-09-24', '2026-09-23', '2026-09-22', '2026-09-20'], '2026-09-24'))
      .toEqual({ current: 3, best: 3, visitedToday: true });
  });
  it('keeps the streak alive until the day is over', () => {
    expect(computeStreak(['2026-09-23', '2026-09-22'], '2026-09-24').current).toBe(2);
  });
  it('resets after a missed day but remembers the best', () => {
    const s = computeStreak(['2026-09-21', '2026-09-10', '2026-09-09', '2026-09-08', '2026-09-07'], '2026-09-24');
    expect(s).toEqual({ current: 0, best: 4, visitedToday: false });
  });
  it('handles no visits', () => {
    expect(computeStreak([], '2026-09-24')).toEqual({ current: 0, best: 0, visitedToday: false });
  });
});

describe('floor level', () => {
  it('grades occupancy', () => {
    expect(floorLevel(5, 80)).toBe('quiet');
    expect(floorLevel(30, 80)).toBe('moderate');
    expect(floorLevel(50, 80)).toBe('busy');
    expect(floorLevel(70, 80)).toBe('packed');
  });
});

describe('class schedule', () => {
  // Thursday 24 Sept 2026, 17:00 in Tunis
  const now = new Date('2026-09-24T16:00:00Z');
  it('books today when the class has not started', () => {
    expect(nextSessionDate(4, '19:00:00', now, TZ)).toBe('2026-09-24');
  });
  it('rolls to next week once the class started', () => {
    expect(nextSessionDate(4, '09:00:00', now, TZ)).toBe('2026-10-01');
  });
  it('finds the next weekday', () => {
    expect(nextSessionDate(1, '19:00:00', now, TZ)).toBe('2026-09-28');
  });
});

describe('floor coach presence', () => {
  const base = {
    status: 'approved' as const, floorCoach: true, liveState: null, liveStateAt: null,
    availabilityDays: [4], availabilityHours: '17:00 – 21:00',
  };
  const thu18h = new Date('2026-09-24T17:00:00Z'); // 18:00 Tunis
  it('parses free-text hours', () => {
    expect(parseHourRange('17h00 - 21h30')).toEqual({ start: 1020, end: 1290 });
    expect(parseHourRange('le soir')).toBeNull();
  });
  it('follows the schedule', () => {
    expect(isOnFloorNow(base, thu18h, TZ)).toBe(true);
    expect(isOnFloorNow(base, new Date('2026-09-24T07:00:00Z'), TZ)).toBe(false);
  });
  it('lets a fresh manual toggle win', () => {
    const away = { ...base, liveState: 'away' as const, liveStateAt: new Date(thu18h.getTime() - 30 * 60_000) };
    expect(isOnFloorNow(away, thu18h, TZ)).toBe(false);
    const stale = { ...away, liveStateAt: new Date(thu18h.getTime() - 5 * 3600_000) };
    expect(isOnFloorNow(stale, thu18h, TZ)).toBe(true);
  });
  it('never shows pending coaches', () => {
    expect(isOnFloorNow({ ...base, status: 'pending' }, thu18h, TZ)).toBe(false);
  });
});

describe('journal rules (same as the app)', () => {
  const NOW = new Date('2026-10-01T18:00:00Z');
  const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
  const s = (kg: number, reps: number, legacy = false) => ({ kg, reps, minutes: 0, km: 0, legacy });
  const w = (id: string, hoursAgo: number, exerciseId: string, muscle: WorkoutFact['exercises'][0]['muscle'], sets: ReturnType<typeof s>[]): WorkoutFact => ({
    id, date: ago(hoursAgo), startedAt: ago(hoursAgo), endedAt: ago(hoursAgo - 1), live: true, exercises: [{ exerciseId, muscle, sets }],
  });

  it('a record is heavier, or same weight with more reps; never the first time, never a typed total', () => {
    const before = [w('a', 100, 'chest-bench', 'chest', [s(30, 10), s(30, 10)]), w('m', 300, 'chest-bench', 'chest', [s(1800, 1, true)])];
    expect(isNewRecord(before, 'chest-bench', s(32.5, 5))).toBe(true);
    expect(isNewRecord(before, 'chest-bench', s(30, 11))).toBe(true);
    expect(isNewRecord(before, 'chest-bench', s(30, 10))).toBe(false);
    expect(isNewRecord([], 'chest-bench', s(100, 1))).toBe(false);
    expect(isNewRecord(before, 'chest-bench', s(2000, 1, true))).toBe(false);
  });

  it('suggests the rested muscle trained the longest ago, never trained first', () => {
    const h = [w('l', 20, 'legs-squat', 'legs', [s(100, 5)]), w('c', 200, 'chest-bench', 'chest', [s(60, 5)])];
    expect(suggestMuscle(h, NOW)).toBe('back'); // never trained
    const all = (['back', 'shoulders', 'arms'] as const).map((m, i) => w(m, 100 + i, m, m, [s(20, 10)]));
    expect(suggestMuscle([...h, ...all], NOW)).toBe('chest'); // legs still recovering, chest rested longest
  });

  it('summarises the last session for the Mur', () => {
    const sum = summary([w('l', 2, 'legs-squat', 'legs', [s(100, 5), s(100, 5)])], NOW, () => false);
    expect(sum.lastSession).toMatchObject({ id: 'l', minutes: 60, sets: 2, exercises: 1, volume: 1000 });
    expect(sum.todayVolume).toBe(0);
  });
});

describe('memberships', () => {
  const m = (startsOn: string, endsOn: string) => ({ id: 'x', gymId: 'g', userId: 'u', planName: 'Mensuel', startsOn, endsOn, priceMillimes: 0, createdBy: null, createdAt: new Date() });
  it('reports days left and activity', () => {
    expect(statusOf(m('2026-09-01', '2026-09-30'), '2026-09-24')).toMatchObject({ daysLeft: 6, active: true });
    expect(statusOf(m('2026-08-01', '2026-08-31'), '2026-09-24')).toMatchObject({ active: false });
  });
  it('extends a running membership instead of overlapping it', () => {
    expect(renewalStart(m('2026-09-01', '2026-09-30'), '2026-09-24')).toBe('2026-10-01');
    expect(renewalStart(m('2026-08-01', '2026-08-31'), '2026-09-24')).toBe('2026-09-24');
  });
});

describe('shop', () => {
  it('computes promo discounts', () => {
    expect(discountPct({ priceMillimes: 90_000, originalPriceMillimes: 120_000 })).toBe(25);
    expect(discountPct({ priceMillimes: 90_000, originalPriceMillimes: null })).toBe(0);
  });
  it('only moves orders forward', () => {
    expect(TRANSITIONS.pending).toContain('ready');
    expect(TRANSITIONS.picked_up).toEqual([]);
  });
});

describe('permissions', () => {
  const actor = (role: Actor['role'], perms: Actor['permissions'] = new Set()): Actor => ({ id: 'a', gymId: 'g', role, fullName: 'A', permissions: perms });
  it('gives owners everything', () => expect(can(actor('owner'), 'manage_products')).toBe(true));
  it('lets approved coaches validate records only', () => {
    expect(can(actor('coach'), 'validate_records')).toBe(true);
    expect(can(actor('coach'), 'manage_classes')).toBe(false);
  });
  it('gives staff exactly their grants', () => {
    const staff = actor('member', new Set(['manage_classes'] as const));
    expect(can(staff, 'manage_classes')).toBe(true);
    expect(can(staff, 'manage_products')).toBe(false);
  });
});
