import { describe, expect, it } from 'vitest';
import { computeWeeklyStreak } from './weeklyStreak';

// Wednesday 2026-09-30. Its week starts Monday 2026-09-28.
const TODAY = new Date('2026-09-30T12:00:00');

/** Three sessions in the week starting at `monday` (YYYY-MM-DD). */
const fullWeek = (monday: string) => {
  const d = new Date(monday + 'T00:00:00');
  return [0, 2, 4].map(i => {
    const x = new Date(d);
    x.setDate(x.getDate() + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  });
};

describe('weekly streak', () => {
  it('is 0 with no sessions', () => {
    const s = computeWeeklyStreak([], TODAY);
    expect(s.current).toBe(0);
    expect(s.thisWeek).toBe(0);
    expect(s.freezesLeftThisMonth).toBe(1);
  });

  it('counts consecutive past weeks that reached the goal', () => {
    const s = computeWeeklyStreak([...fullWeek('2026-09-14'), ...fullWeek('2026-09-21')], TODAY);
    expect(s.current).toBe(2);
    expect(s.goalMetThisWeek).toBe(false);
  });

  it('the current week adds one only once its goal is reached', () => {
    const past = fullWeek('2026-09-21');
    expect(computeWeeklyStreak([...past, '2026-09-28', '2026-09-29'], TODAY).current).toBe(1);
    expect(computeWeeklyStreak([...past, '2026-09-28', '2026-09-29', '2026-09-30'], TODAY).current).toBe(2);
  });

  it('several sessions on the same day count once', () => {
    const s = computeWeeklyStreak(['2026-09-28', '2026-09-28', '2026-09-28'], TODAY);
    expect(s.thisWeek).toBe(1);
    expect(s.goalMetThisWeek).toBe(false);
  });

  it('a freeze bridges one missed week in a month', () => {
    // 07 good, 14 missed, 21 good → 3 with one freeze
    const s = computeWeeklyStreak([...fullWeek('2026-09-07'), ...fullWeek('2026-09-21')], TODAY);
    expect(s.current).toBe(3);
    expect(s.frozenWeeks).toEqual(['2026-09-14']);
    expect(s.freezesLeftThisMonth).toBe(0);
  });

  it('two missed weeks in the same month break the streak', () => {
    // 31 Aug good, 07 + 14 missed (both September), 21 good
    const s = computeWeeklyStreak([...fullWeek('2026-08-31'), ...fullWeek('2026-09-21')], TODAY);
    expect(s.current).toBe(1);
  });

  it('a freeze is never spent before the first real week', () => {
    const s = computeWeeklyStreak(['2026-09-15'], TODAY); // one lone session two weeks ago
    expect(s.current).toBe(0);
    expect(s.frozenWeeks).toEqual([]);
    expect(s.freezesLeftThisMonth).toBe(1);
  });

  it('respects a custom goal', () => {
    const s = computeWeeklyStreak(['2026-09-28'], TODAY, 1);
    expect(s.goalMetThisWeek).toBe(true);
    expect(s.current).toBe(1);
  });

  it('exposes this week day by day, Monday first', () => {
    const s = computeWeeklyStreak(['2026-09-28', '2026-09-30'], TODAY);
    expect(s.weekDays).toEqual([true, false, true, false, false, false, false]);
  });
});
