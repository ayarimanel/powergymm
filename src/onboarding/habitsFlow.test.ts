import { describe, expect, it } from 'vitest';
import { ClubRules, cardsFor, dotsFor, slotsFor, summaryLines, vagueDate } from './habitsFlow';
import { emptyHabits } from './habitsModel';

const rules: ClubRules = {
  openDays: [0, 1, 2, 3, 4, 5, 6],
  openingHour: 6,
  closingHour: 22,
  durationsSold: ['1m', '3m', '6m', '1y', 'pass'],
  endOfMonthBilling: false,
  membershipsInApp: true,
};

describe('card order', () => {
  it('asks about focus only when the member trains muscle by muscle', () => {
    expect(cardsFor(rules, 'split')).toContain('focus');
    expect(cardsFor(rules, 'upper_lower')).toContain('focus');
    expect(cardsFor(rules, 'full_body')).not.toContain('focus');
    expect(cardsFor(rules, 'cardio')).not.toContain('focus');
    expect(cardsFor(rules, 'beginner')).not.toContain('focus');
    expect(cardsFor(rules, null)).not.toContain('focus');
  });

  it('skips the two payment cards when the club bills to the end of the month', () => {
    const eom = cardsFor({ ...rules, endOfMonthBilling: true }, 'full_body');
    expect(eom).not.toContain('paid_when');
    expect(eom).not.toContain('paid_len');
  });

  it('leaves the end-of-month club with four questions', () => {
    const eom = cardsFor({ ...rules, endOfMonthBilling: true }, 'full_body');
    expect(eom).toEqual(['welcome', 'days', 'time', 'style', 'notifications', 'done']);
  });

  it('asks the full six for a split trainer at a normal club', () => {
    expect(cardsFor(rules, 'split')).toEqual([
      'welcome',
      'days',
      'time',
      'style',
      'focus',
      'paid_when',
      'paid_len',
      'notifications',
      'done',
    ]);
  });

  it('counts only the questions in the progress dots', () => {
    const cards = cardsFor(rules, 'split');
    const dots = dotsFor(cards);
    expect(dots).not.toContain('welcome');
    expect(dots).not.toContain('done');
    expect(dots).toHaveLength(cards.length - 2);
  });
});

describe('club hours', () => {
  it('offers only the slots inside the opening hours', () => {
    const ids = slotsFor({ ...rules, openingHour: 9, closingHour: 20 }).map(s => s.id);
    expect(ids).not.toContain('early'); // 6h-9h, club opens at 9
    expect(ids).not.toContain('late'); // 20h-22h, club shuts at 20
    expect(ids).toContain('morning');
    expect(ids).toContain('evening');
  });
});

describe('summary', () => {
  it('writes a line only for what was answered', () => {
    expect(summaryLines(emptyHabits())).toEqual([]);

    const lines = summaryLines({
      ...emptyHabits(),
      usualDays: [1, 3, 5],
      usualSlot: 'evening',
      trainingStyle: 'split',
      focusMuscles: ['pecs', 'dos'],
      subscriptionEndsAt: '2026-12-08',
    });
    expect(lines[0]).toBe('📅 mardi, jeudi et samedi · soir');
    expect(lines[1]).toContain('Un muscle par séance');
    expect(lines[1]).toContain('pectoraux et dos');
    expect(lines[2]).toBe("⏳ Abonnement jusqu'à début décembre");
  });

  it('says the end date vaguely, because it is an estimate', () => {
    expect(vagueDate('2026-12-03')).toBe('début décembre');
    expect(vagueDate('2026-12-15')).toBe('mi-décembre');
    expect(vagueDate('2026-12-28')).toBe('fin décembre');
  });
});
