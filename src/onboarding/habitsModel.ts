/**
 * "Bienvenue" questionnaire: pure logic, no React and no storage, so the card
 * order and the subscription date math stay unit-testable.
 *
 * Dates are handled as plain YYYY-MM-DD local days (same as UserProfile.lastCheckInDate):
 * a membership ends on a day, never at an hour, and a timezone shift must not move it.
 */

export type UsualSlot = 'early' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'late' | 'varies';
export type TrainingStyle = 'split' | 'upper_lower' | 'full_body' | 'cardio' | 'classes' | 'beginner';
export type FocusMuscle = 'pecs' | 'dos' | 'jambes' | 'epaules' | 'bras' | 'abdos' | 'cardio';
export type PaidWhen = 'this_week' | 'w1_2' | 'w3_4' | 'over_month' | 'unknown';
export type SubDuration = '1m' | '3m' | '6m' | '1y' | 'pass';
export type PaidSource = 'estimate' | 'confirmed';
export type OnboardingStatus = 'new' | 'partial' | 'done' | 'snoozed';

/** What the questionnaire knows about a member. Mirrors member_profile in the DB. */
export interface HabitsProfile {
  usualDays: number[] | null; // 0 = Monday … 6 = Sunday
  usualDaysVaries: boolean;
  usualSlot: UsualSlot | null;
  trainingStyle: TrainingStyle | null;
  focusMuscles: FocusMuscle[];
  subscriptionPaidAt: string | null;
  subscriptionPaidAtSource: PaidSource | null;
  subscriptionPaidAtMarginDays: number;
  subscriptionDuration: SubDuration | null;
  subscriptionEndsAt: string | null;
  onboardingStatus: OnboardingStatus;
  onboardingSnoozeCount: number;
  onboardingNextAt: string | null;
  habitsCheckAskedAt: string | null;
  /** Client-side: the card to reopen on, so a half-finished questionnaire resumes where it stopped. */
  resumeAt: string | null;
}

export const emptyHabits = (): HabitsProfile => ({
  usualDays: null,
  usualDaysVaries: false,
  usualSlot: null,
  trainingStyle: null,
  focusMuscles: [],
  subscriptionPaidAt: null,
  subscriptionPaidAtSource: null,
  subscriptionPaidAtMarginDays: 0,
  subscriptionDuration: null,
  subscriptionEndsAt: null,
  onboardingStatus: 'new',
  onboardingSnoozeCount: 0,
  onboardingNextAt: null,
  habitsCheckAskedAt: null,
  resumeAt: null,
});

/* ---------- plain day arithmetic ---------- */

export const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Parsed as a local day: new Date('2026-10-02') would be UTC midnight and can land on 1 Oct. */
export const fromISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso: string, n: number): string => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Calendar months, clamped: 31 Jan + 1 month = 28 Feb, not 3 March. */
export const addMonths = (iso: string, n: number): string => {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
};

export const lastDayOfMonth = (iso: string): string => {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

/** 0 = Monday … 6 = Sunday (JS getDay() is Sunday-first). */
export const weekdayIndex = (iso: string): number => (fromISO(iso).getDay() + 6) % 7;

export const daysBetween = (from: string, to: string): number =>
  Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86400000);

/* ---------- card 5: "tu as payé quand ?" ---------- */

/** How far back each answer points, and how wrong it may be. */
export const PAID_WHEN: Record<PaidWhen, { backDays: number; margin: number } | null> = {
  this_week: { backDays: 3, margin: 3 },
  w1_2: { backDays: 10, margin: 4 },
  w3_4: { backDays: 24, margin: 5 },
  over_month: { backDays: 45, margin: 15 },
  unknown: null,
};

export const DURATION_MONTHS: Record<SubDuration, number | null> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
  pass: null, // a punch card has no end date
};

export interface PaidEstimate {
  paidAt: string | null;
  margin: number;
  endsAt: string | null;
}

/**
 * Turns the two taps into a date. "Plus d'un mois" with a 1-month subscription
 * is contradictory (it would already be over), so it counts as unknown.
 */
export const estimateSubscription = (
  when: PaidWhen,
  duration: SubDuration | null,
  today: string
): PaidEstimate => {
  const rule = PAID_WHEN[when];
  if (!rule) return { paidAt: null, margin: 0, endsAt: null };
  if (when === 'over_month' && duration === '1m') return { paidAt: null, margin: 0, endsAt: null };

  const paidAt = addDays(today, -rule.backDays);
  const months = duration ? DURATION_MONTHS[duration] : null;
  return { paidAt, margin: rule.margin, endsAt: months ? addMonths(paidAt, months) : null };
};

/** Club rule "tout finit le dernier jour du mois": cards 5-6 are skipped. */
export const endOfMonthSubscription = (today: string, monthsBought: number | null): PaidEstimate => ({
  paidAt: today,
  margin: 0,
  endsAt: lastDayOfMonth(monthsBought ? addMonths(today, monthsBought) : today),
});

/* ---------- renewal reminders ---------- */

/**
 * Three reminders, then silence: before the end (earlier when the date is vague),
 * the day after, and three days later.
 */
export const reminderDates = (endsAt: string, margin: number): string[] => [
  addDays(endsAt, -Math.max(5, margin)),
  addDays(endsAt, 1),
  addDays(endsAt, 4),
];

/** A renewal the member confirmed: the date stops being a guess. */
export const confirmRenewal = (
  profile: HabitsProfile,
  duration: SubDuration,
  today: string
): HabitsProfile => {
  const months = DURATION_MONTHS[duration];
  return {
    ...profile,
    subscriptionPaidAt: today,
    subscriptionPaidAtSource: 'confirmed',
    subscriptionPaidAtMarginDays: 0,
    subscriptionDuration: duration,
    subscriptionEndsAt: months ? addMonths(today, months) : null,
  };
};

/** No date at all: ask once after 30 days whether the membership is still running. */
export const stillActiveAskDue = (profile: HabitsProfile, since: string, today: string): boolean =>
  !profile.subscriptionPaidAt && daysBetween(since, today) >= 30;

/** "Oui" to that question: assume the middle of the current month. */
export const assumeActive = (profile: HabitsProfile, duration: SubDuration, today: string): HabitsProfile => {
  const paidAt = addDays(today, -15);
  const months = DURATION_MONTHS[duration];
  return {
    ...profile,
    subscriptionPaidAt: paidAt,
    subscriptionPaidAtSource: 'estimate',
    subscriptionPaidAtMarginDays: 15,
    subscriptionDuration: duration,
    subscriptionEndsAt: months ? addMonths(paidAt, months) : null,
  };
};
