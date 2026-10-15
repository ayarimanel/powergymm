import type { Db } from '../../shared/db/client.js';
import type { EventBus } from '../../shared/events/bus.js';
import { requireOwner, type Actor } from '../../shared/auth/actor.js';
import { notFound } from '../../shared/errors.js';
import { addDays, daysBetween, localDay } from '../../shared/time.js';
import type { ClubsService } from '../clubs/index.js';
import type { IdentityService } from '../identity/index.js';
import { membershipsRepository, type MembershipRow } from './repository.js';

/** Reminders go out this many days before a membership ends. */
export const REMINDER_DAYS = [3, 1];

export interface MembershipStatus {
  planName: string;
  startsOn: string;
  endsOn: string;
  daysLeft: number;
  active: boolean;
}

export function statusOf(m: MembershipRow | undefined, today: string): MembershipStatus | null {
  if (!m) return null;
  const daysLeft = daysBetween(today, m.endsOn);
  return { planName: m.planName, startsOn: m.startsOn, endsOn: m.endsOn, daysLeft, active: m.startsOn <= today && daysLeft >= 0 };
}

/** A renewal starts today, or the day after the current period ends if it is still running. */
export function renewalStart(current: MembershipRow | undefined, today: string): string {
  return current && current.endsOn >= today ? addDays(current.endsOn, 1) : today;
}

/** Last visit per member, supplied by attendance (injected lazily to avoid a cycle). */
export type LastVisits = (gymId: string) => Promise<Map<string, Date>>;

export function createMembershipsService(db: Db, bus: EventBus, deps: { clubs: ClubsService; identity: IdentityService; lastVisits: LastVisits }) {
  const repo = membershipsRepository(db);
  const todayIn = async (gymId: string) => localDay(new Date(), (await deps.clubs.getGym(gymId)).timezone);

  return {
    async myStatus(actor: Actor) {
      const today = await todayIn(actor.gymId);
      return statusOf((await repo.latestFor([actor.id])).get(actor.id), today);
    },

    /** Public API for attendance and classes. */
    async isActive(gymId: string, userId: string): Promise<boolean> {
      const today = await todayIn(gymId);
      return statusOf((await repo.latestFor([userId])).get(userId), today)?.active ?? false;
    },

    /** The admin's member list: membership state and how long since each person last came in. */
    async roster(actor: Actor) {
      requireOwner(actor);
      const today = await todayIn(actor.gymId);
      const [members, latest, visits] = await Promise.all([
        deps.identity.membersOf(actor.gymId),
        repo.latestInGym(actor.gymId),
        deps.lastVisits(actor.gymId),
      ]);
      const byUser = new Map(latest.map(m => [m.userId, m]));
      const now = Date.now();
      return members.map(p => {
        const last = visits.get(p.id);
        return {
          userId: p.id,
          fullName: p.fullName,
          avatarUrl: p.avatarUrl,
          role: p.role,
          whatsapp: p.whatsapp,
          membership: statusOf(byUser.get(p.id), today),
          lastVisitAt: last ?? null,
          daysAbsent: last ? Math.floor((now - last.getTime()) / 86_400_000) : null,
        };
      });
    },

    async history(actor: Actor, userId: string) {
      requireOwner(actor);
      return repo.historyOf(actor.gymId, userId);
    },

    async renew(actor: Actor, userId: string, input: { days: number; planName: string; priceMillimes: number }) {
      requireOwner(actor);
      const member = await deps.identity.profile(userId);
      if (!member || member.gymId !== actor.gymId) throw notFound('Member');
      const today = await todayIn(actor.gymId);
      const current = (await repo.latestFor([userId])).get(userId);
      const startsOn = renewalStart(current, today);
      const row = await repo.insert({
        gymId: actor.gymId, userId, planName: input.planName, priceMillimes: input.priceMillimes,
        startsOn, endsOn: addDays(startsOn, input.days - 1), createdBy: actor.id,
      });
      return statusOf(row, today);
    },

    /** Daily job: warn members whose membership is about to end. */
    async remindExpiring(now = new Date()): Promise<number> {
      let sent = 0;
      for (const gym of await deps.clubs.allGyms()) {
        const today = localDay(now, gym.timezone);
        for (const m of await repo.latestInGym(gym.id)) {
          const daysLeft = daysBetween(today, m.endsOn);
          if (REMINDER_DAYS.includes(daysLeft)) {
            bus.emit('membership.expiring', { gymId: gym.id, userId: m.userId, endsOn: m.endsOn, daysLeft });
            sent++;
          }
        }
      }
      return sent;
    },

    /** Owner analytics: money taken in a window, and who is still covered today. */
    revenueBetween: (gymId: string, from: Date, to: Date) => repo.revenueBetween(gymId, from, to),

    async activeCount(gymId: string, today: string): Promise<number> {
      const rows = await repo.latestInGym(gymId);
      return rows.filter(m => m.startsOn <= today && m.endsOn >= today).length;
    },
  };
}

export type MembershipsService = ReturnType<typeof createMembershipsService>;
