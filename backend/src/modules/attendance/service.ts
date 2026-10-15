import type { Db } from '../../shared/db/client.js';
import type { EventBus } from '../../shared/events/bus.js';
import type { Actor } from '../../shared/auth/actor.js';
import { AppError, badRequest, isUniqueViolation, notFound } from '../../shared/errors.js';
import { addDays, localDay, localHour } from '../../shared/time.js';
import type { ClubsService } from '../clubs/index.js';
import type { IdentityService } from '../identity/index.js';
import { attendanceRepository, type CheckInRow } from './repository.js';

/** A check-in nobody closed is considered over after this long. */
export const CHECK_IN_TTL_MIN = 180;
const HISTORY_DAYS = 28;
const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'] as const;

/**
 * Current streak = consecutive visit days ending today (or yesterday: the
 * streak is not lost until the day is over). `days` is distinct YYYY-MM-DD.
 */
export function computeStreak(days: string[], today: string): { current: number; best: number; visitedToday: boolean } {
  const sorted = [...new Set(days)].sort().reverse();
  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const d of sorted) {
    run = prev && addDays(d, 1) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let current = 0;
  const first = sorted[0];
  if (first === today || first === addDays(today, -1)) {
    current = 1;
    for (let i = 1; i < sorted.length && addDays(sorted[i]!, 1) === sorted[i - 1]; i++) current++;
  }
  return { current, best, visitedToday: first === today };
}

export type FloorLevel = 'quiet' | 'moderate' | 'busy' | 'packed';
export function floorLevel(active: number, capacity: number): FloorLevel {
  const ratio = active / Math.max(1, capacity);
  return ratio >= 0.85 ? 'packed' : ratio >= 0.6 ? 'busy' : ratio >= 0.3 ? 'moderate' : 'quiet';
}

/** Membership rule check, supplied by memberships (injected to keep the dependency one-way). */
export type MembershipGate = (gymId: string, userId: string) => Promise<boolean>;

export function createAttendanceService(db: Db, bus: EventBus, deps: { clubs: ClubsService; identity: IdentityService; hasActiveMembership: MembershipGate }) {
  const repo = attendanceRepository(db);

  const streakFor = async (userId: string, timezone: string) =>
    computeStreak(await repo.visitDays(userId), localDay(new Date(), timezone));

  return {
    async checkIn(actor: Actor, input: { code: string; muscles: string[] }) {
      const gym = await deps.clubs.getGym(actor.gymId);
      if (!(await deps.clubs.verifyCheckInCode(gym.id, input.code))) {
        throw badRequest('wrong_code', 'This QR code does not belong to your club. Scan the one at the entrance.');
      }
      if (gym.enforceMemberships && !(await deps.hasActiveMembership(gym.id, actor.id))) {
        throw new AppError(402, 'membership_expired', 'Your membership has ended. Renew it at the front desk.');
      }

      // Scanning again while already checked in just updates today's focus.
      const existing = await repo.activeFor(actor.id);
      if (existing) {
        const updated = await repo.update(existing.id, { muscles: input.muscles });
        return { checkIn: updated, streak: await streakFor(actor.id, gym.timezone), alreadyCheckedIn: true };
      }

      let row: CheckInRow;
      try {
        row = await repo.insert({ gymId: gym.id, userId: actor.id, muscles: input.muscles, localDay: localDay(new Date(), gym.timezone) });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        row = (await repo.activeFor(actor.id))!; // a double-tap raced us; same result
      }
      const streak = await streakFor(actor.id, gym.timezone);
      bus.emit('attendance.checked_in', { gymId: gym.id, userId: actor.id, checkInId: row.id, streak: streak.current });
      return { checkIn: row, streak, alreadyCheckedIn: false };
    },

    async endCurrent(actor: Actor) {
      const current = await repo.activeFor(actor.id);
      if (!current) throw notFound('Active check-in');
      return repo.update(current.id, { status: 'completed', endedAt: new Date() });
    },

    async current(actor: Actor) {
      return (await repo.activeFor(actor.id)) ?? null;
    },

    async streak(actor: Actor) {
      const gym = await deps.clubs.getGym(actor.gymId);
      return streakFor(actor.id, gym.timezone);
    },

    /** Everything the Floor screen shows: who is here, which muscles are taken, and usual busy hours. */
    async floor(actor: Actor) {
      const gym = await deps.clubs.getGym(actor.gymId);
      const now = new Date();
      const [active, byHour] = await Promise.all([
        repo.activeInGym(gym.id),
        repo.countsByHour(gym.id, gym.timezone, new Date(now.getTime() - HISTORY_DAYS * 86_400_000)),
      ]);
      const people = await deps.identity.summaries(active.map(c => c.userId));
      const hour = localHour(now, gym.timezone);
      const muscles = MUSCLES.map(m => ({ muscle: m, count: active.filter(c => c.muscles.includes(m)).length }));

      const hours = [];
      for (let h = gym.openingHour; h < gym.closingHour; h++) {
        hours.push({ hour: h, typical: Math.round(((byHour.get(h) ?? 0) / HISTORY_DAYS) * 10) / 10, isNow: h === hour });
      }

      return {
        isOpen: hour >= gym.openingHour && hour < gym.closingHour,
        activeCount: active.length,
        capacity: gym.maxCapacity,
        occupancyPct: Math.min(100, Math.round((active.length / gym.maxCapacity) * 100)),
        level: floorLevel(active.length, gym.maxCapacity),
        muscles,
        people: active.map(c => ({
          userId: c.userId,
          fullName: people.get(c.userId)?.fullName ?? 'Membre',
          avatarUrl: people.get(c.userId)?.avatarUrl ?? null,
          muscles: c.muscles,
          sinceMin: Math.max(0, Math.round((now.getTime() - c.startedAt.getTime()) / 60_000)),
        })),
        hours,
      };
    },

    // ── public API ──
    lastVisits: (gymId: string) => repo.lastVisits(gymId),

    /** Job: close check-ins nobody ended. */
    expireStale: (now = new Date()) => repo.expireStartedBefore(new Date(now.getTime() - CHECK_IN_TTL_MIN * 60_000)),
  };
}

export type AttendanceService = ReturnType<typeof createAttendanceService>;
