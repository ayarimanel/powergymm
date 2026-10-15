import { describe, expect, it } from 'vitest';
import {
  addMonths,
  assumeActive,
  confirmRenewal,
  emptyHabits,
  endOfMonthSubscription,
  estimateSubscription,
  lastDayOfMonth,
  reminderDates,
  stillActiveAskDue,
  weekdayIndex,
} from './habitsModel';

describe('day arithmetic', () => {
  it('adds calendar months and clamps a short month', () => {
    expect(addMonths('2026-09-08', 3)).toBe('2026-12-08');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('knows the last day of the month and Monday-first weekdays', () => {
    expect(lastDayOfMonth('2026-10-02')).toBe('2026-10-31');
    expect(lastDayOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(weekdayIndex('2026-10-02')).toBe(4); // a Friday
  });
});

describe('subscription estimated from two taps', () => {
  // The scenario from the spec, checked end to end.
  it('"il y a 3-4 semaines" + "3 mois" on 2 Oct 2026', () => {
    const est = estimateSubscription('w3_4', '3m', '2026-10-02');
    expect(est.paidAt).toBe('2026-09-08');
    expect(est.margin).toBe(5);
    expect(est.endsAt).toBe('2026-12-08');
    expect(reminderDates(est.endsAt!, est.margin)).toEqual(['2026-12-03', '2026-12-09', '2026-12-12']);
  });

  it('maps every answer to its offset', () => {
    expect(estimateSubscription('this_week', '1m', '2026-10-02').paidAt).toBe('2026-09-29');
    expect(estimateSubscription('w1_2', '1m', '2026-10-02').paidAt).toBe('2026-09-22');
    expect(estimateSubscription('over_month', '6m', '2026-10-02').paidAt).toBe('2026-08-18');
  });

  it('treats a vague date as unknown when it contradicts the duration', () => {
    // "plus d'un mois" on a 1-month pass would already be over.
    expect(estimateSubscription('over_month', '1m', '2026-10-02').paidAt).toBeNull();
    expect(estimateSubscription('unknown', '3m', '2026-10-02').paidAt).toBeNull();
  });

  it('gives a punch card no end date', () => {
    expect(estimateSubscription('this_week', 'pass', '2026-10-02').endsAt).toBeNull();
  });

  it('reminds earlier when the date is vague', () => {
    const est = estimateSubscription('over_month', '6m', '2026-10-02');
    expect(est.margin).toBe(15);
    // 15 days of doubt: warn 15 days ahead, not 5.
    expect(est.endsAt).toBe('2027-02-18');
    expect(reminderDates(est.endsAt!, est.margin)[0]).toBe('2027-02-03');
  });
});

describe('club rule "tout finit le dernier jour du mois"', () => {
  it('ends on the last day, skipping the two payment cards', () => {
    expect(endOfMonthSubscription('2026-10-02', null).endsAt).toBe('2026-10-31');
    expect(endOfMonthSubscription('2026-10-02', 3).endsAt).toBe('2027-01-31');
  });
});

describe('renewal', () => {
  it('a confirmed renewal makes the date exact', () => {
    const p = { ...emptyHabits(), subscriptionPaidAtSource: 'estimate' as const, subscriptionPaidAtMarginDays: 5 };
    const next = confirmRenewal(p, '3m', '2026-12-09');
    expect(next.subscriptionPaidAtSource).toBe('confirmed');
    expect(next.subscriptionPaidAtMarginDays).toBe(0);
    expect(next.subscriptionEndsAt).toBe('2027-03-09');
  });

  it('asks about an unknown date only after 30 days, then assumes mid-month', () => {
    const p = emptyHabits();
    expect(stillActiveAskDue(p, '2026-10-02', '2026-10-20')).toBe(false);
    expect(stillActiveAskDue(p, '2026-10-02', '2026-11-02')).toBe(true);

    const next = assumeActive(p, '1m', '2026-11-02');
    expect(next.subscriptionPaidAt).toBe('2026-10-18');
    expect(next.subscriptionPaidAtSource).toBe('estimate');
    expect(next.subscriptionEndsAt).toBe('2026-11-18');
  });
});
