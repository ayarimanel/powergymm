/**
 * Member habits and the subscription date the member declared himself.
 *
 * Two rules this module exists to hold:
 *  - a member's habits and payment dates are his own; no endpoint here returns
 *    another member's row, and the owner only ever gets counts;
 *  - a declared date is not proof of payment. Everything leaving this service is
 *    marked `declared: true` so no staff screen can mistake it for billing.
 */
import type { Db } from '../../shared/db/client.js';
import type { Actor } from '../../shared/auth/actor.js';
import { requireOwner } from '../../shared/auth/actor.js';
import type { EventBus } from '../../shared/events/bus.js';
import { localDay } from '../../shared/time.js';
import { habitsRepository, type MemberProfileRow } from './repository.js';

export type SubDuration = '1m' | '3m' | '6m' | '1y' | 'pass';

const DURATION_MONTHS: Record<SubDuration, number | null> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, pass: null };

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parts = (iso: string) => {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return { y, m, d };
};

/** Calendar months, clamped so 31 Jan + 1 month is 28 Feb. */
export const addMonths = (iso: string, n: number): string => {
  const { y, m, d: dd } = parts(iso);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dd, last));
  return toISO(d);
};

export const addDays = (iso: string, n: number): string => {
  const { y, m, d } = parts(iso);
  return toISO(new Date(y, m - 1, d + n));
};

/** The three reminders, mirroring the client: earlier when the date is vague. */
export const reminderDates = (endsAt: string, margin: number): string[] => [
  addDays(endsAt, -Math.max(5, margin)),
  addDays(endsAt, 1),
  addDays(endsAt, 4),
];

/** What a member is allowed to send about himself. */
export interface ProfilePatch {
  usualDays?: number[] | null;
  usualDaysVaries?: boolean;
  usualSlot?: MemberProfileRow['usualSlot'];
  trainingStyle?: MemberProfileRow['trainingStyle'];
  focusMuscles?: string[];
  subscriptionPaidAt?: string | null;
  subscriptionPaidAtSource?: 'estimate' | 'confirmed' | null;
  subscriptionPaidAtMarginDays?: number;
  subscriptionDuration?: SubDuration | null;
  subscriptionEndsAt?: string | null;
  onboardingStatus?: MemberProfileRow['onboardingStatus'];
  onboardingSnoozeCount?: number;
  onboardingNextAt?: string | null;
}

interface Deps {
  clubs: { allGyms(): Promise<{ id: string; timezone: string }[]> };
}

export function createHabitsService(db: Db, bus: EventBus, deps: Deps) {
  const repo = habitsRepository(db);

  const shape = (row: MemberProfileRow | undefined) =>
    row
      ? {
          ...row,
          usualDays: row.usualDaysVaries ? null : row.usualDays,
          /** Never a proof of payment: the owner view must print "déclaré". */
          declared: true,
        }
      : null;

  return {
    /** A member's own row, always. The actor id is the only key used. */
    async mine(actor: Actor) {
      return shape(await repo.find(actor.gymId, actor.id));
    },

    /** Card-by-card save. Values are validated by the route schema first. */
    async patchMine(actor: Actor, patch: ProfilePatch) {
      const { usualDays, ...rest } = patch;
      await repo.upsert(actor.gymId, actor.id, {
        ...rest,
        ...(usualDays !== undefined ? { usualDays: usualDays ?? [] } : {}),
      });
      return shape(await repo.find(actor.gymId, actor.id));
    },

    /** "Oui, c'est fait": the date stops being a guess and the reminders reset. */
    async confirmRenewal(actor: Actor, duration: SubDuration, today = toISO(new Date())) {
      const months = DURATION_MONTHS[duration];
      await repo.upsert(actor.gymId, actor.id, {
        subscriptionPaidAt: today,
        subscriptionPaidAtSource: 'confirmed',
        subscriptionPaidAtMarginDays: 0,
        subscriptionDuration: duration,
        subscriptionEndsAt: months ? addMonths(today, months) : null,
        renewalRemindersSent: 0,
      });
      return shape(await repo.find(actor.gymId, actor.id));
    },

    /** "Plus tard": back in 3 days, twice at most. */
    async snooze(actor: Actor, today = toISO(new Date())) {
      const row = await repo.find(actor.gymId, actor.id);
      const count = (row?.onboardingSnoozeCount ?? 0) + 1;
      await repo.upsert(actor.gymId, actor.id, {
        onboardingStatus: count >= 2 ? 'done' : 'snoozed',
        onboardingSnoozeCount: count,
        onboardingNextAt: count >= 2 ? null : addDays(today, 3),
      });
      return shape(await repo.find(actor.gymId, actor.id));
    },

    /** Owner: counts only, and every number is flagged as declared. */
    async ownerSummary(actor: Actor, today = toISO(new Date())) {
      requireOwner(actor);
      const { endingThisWeek, renewedThisWeek } = await repo.subscriptionSummary(
        actor.gymId,
        today,
        addDays(today, 7)
      );
      return {
        endingThisWeek,
        renewedThisWeek,
        notYet: Math.max(0, endingThisWeek - renewedThisWeek),
        declared: true,
        note: 'Dates déclarées par les membres, pas une preuve de paiement.',
      };
    },

    /** How many members usually come in each slot, for the Floor forecast. */
    expectedBySlot(gymId: string) {
      return repo.expectedBySlot(gymId);
    },

    dueForReminder(gymId: string, today = toISO(new Date())) {
      return repo.dueForReminder(gymId, today);
    },

    /**
     * Daily: the three renewal nudges, then silence. A member who never answers is
     * left alone — an expired declared date never blocks him and never shows as a debt.
     */
    async remindRenewals(now = new Date()): Promise<number> {
      let sent = 0;
      for (const gym of await deps.clubs.allGyms()) {
        const today = localDay(now, gym.timezone);
        for (const row of await repo.dueForReminder(gym.id, today)) {
          if (!row.subscriptionEndsAt) continue;
          const due = reminderDates(row.subscriptionEndsAt, row.subscriptionPaidAtMarginDays);
          const attempt = row.renewalRemindersSent;
          if (attempt >= 3 || due[attempt] !== today) continue;

          bus.emit('subscription.renewal_due', {
            gymId: gym.id,
            userId: row.userId,
            endsAt: row.subscriptionEndsAt,
            attempt: attempt + 1,
          });
          await repo.upsert(gym.id, row.userId, { renewalRemindersSent: attempt + 1 });
          sent++;
        }
      }
      return sent;
    },
  };
}

export type HabitsService = ReturnType<typeof createHabitsService>;
