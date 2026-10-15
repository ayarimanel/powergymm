/**
 * The owner's numbers: how the club is growing, who stopped coming, what it took in.
 *
 * This module owns no table. It composes the counts each owning module exposes,
 * so the figures can never drift from the data they come from. Everything it
 * returns is an aggregate — no member ids, no names, no individual habits.
 */
import type { Actor } from '../../shared/auth/actor.js';
import { requireOwner } from '../../shared/auth/actor.js';
import { localDay } from '../../shared/time.js';

interface Deps {
  identity: {
    signupsBetween(gymId: string, from: Date, to: Date): Promise<number>;
    totalMembers(gymId: string): Promise<number>;
  };
  memberships: {
    revenueBetween(gymId: string, from: Date, to: Date): Promise<number>;
    activeCount(gymId: string, today: string): Promise<number>;
  };
  attendance: {
    lastVisits(gymId: string): Promise<Map<string, Date>>;
  };
  clubs: { byId(gymId: string): Promise<{ timezone: string; currency: string } | undefined> };
}

const daysAgo = (n: number, from = new Date()) => new Date(from.getTime() - n * 86400000);

/** Growth as a percentage, with the "from nothing" case spelled out rather than Infinity. */
const change = (now: number, before: number): number | null =>
  before === 0 ? (now === 0 ? 0 : null) : Math.round(((now - before) / before) * 1000) / 10;

export function createAnalyticsService(deps: Deps) {
  return {
    /**
     * New members, members who stopped coming, and revenue, each against the
     * previous comparable window so the owner sees a direction and not just a number.
     */
    async overview(actor: Actor, now = new Date()) {
      requireOwner(actor);
      const gymId = actor.gymId;
      const gym = await deps.clubs.byId(gymId);
      const today = localDay(now, gym?.timezone ?? 'Africa/Tunis');

      const [week, prevWeek, month, prevMonth] = await Promise.all([
        deps.identity.signupsBetween(gymId, daysAgo(7, now), now),
        deps.identity.signupsBetween(gymId, daysAgo(14, now), daysAgo(7, now)),
        deps.identity.signupsBetween(gymId, daysAgo(30, now), now),
        deps.identity.signupsBetween(gymId, daysAgo(60, now), daysAgo(30, now)),
      ]);

      const [revWeek, revPrevWeek, revMonth, revPrevMonth] = await Promise.all([
        deps.memberships.revenueBetween(gymId, daysAgo(7, now), now),
        deps.memberships.revenueBetween(gymId, daysAgo(14, now), daysAgo(7, now)),
        deps.memberships.revenueBetween(gymId, daysAgo(30, now), now),
        deps.memberships.revenueBetween(gymId, daysAgo(60, now), daysAgo(30, now)),
      ]);

      // "Partis" is deliberately soft: nobody is deleted, they simply stopped
      // showing up. 21 days without a scan is the club's own warning line.
      const visits = await deps.attendance.lastVisits(gymId);
      const cutoff = daysAgo(21, now);
      let lapsed = 0;
      for (const last of visits.values()) if (last < cutoff) lapsed++;

      const [total, active] = await Promise.all([
        deps.identity.totalMembers(gymId),
        deps.memberships.activeCount(gymId, today),
      ]);

      return {
        currency: gym?.currency ?? 'TND',
        members: { total, active, lapsed, neverCame: Math.max(0, total - visits.size) },
        signups: {
          week,
          prevWeek,
          weekChange: change(week, prevWeek),
          month,
          prevMonth,
          monthChange: change(month, prevMonth),
        },
        revenueMillimes: {
          week: revWeek,
          prevWeek: revPrevWeek,
          weekChange: change(revWeek, revPrevWeek),
          month: revMonth,
          prevMonth: revPrevMonth,
          monthChange: change(revMonth, revPrevMonth),
        },
      };
    },

    /** Daily new members for the last N days, for the growth chart. */
    async signupSeries(actor: Actor, days = 30, now = new Date()) {
      requireOwner(actor);
      const points: { day: string; n: number }[] = [];
      const gym = await deps.clubs.byId(actor.gymId);
      const tz = gym?.timezone ?? 'Africa/Tunis';
      for (let i = days - 1; i >= 0; i--) {
        const from = daysAgo(i + 1, now);
        const to = daysAgo(i, now);
        points.push({ day: localDay(to, tz), n: await deps.identity.signupsBetween(actor.gymId, from, to) });
      }
      return points;
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
