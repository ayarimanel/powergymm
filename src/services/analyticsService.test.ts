import { describe, expect, it } from 'vitest';
import { computeAnalytics, formatMillimes } from './analyticsService';
import type { ClubMember, Renewal } from './clubService';

const NOW = new Date('2026-10-02T12:00:00Z').getTime();
const DAY = 86400000;
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();

const member = (id: string, joinedDaysAgo: number, lastVisitDaysAgo = 0, endsInDays = 20): ClubMember => ({
  id,
  name: id,
  phone: '',
  joinedAt: ago(joinedDaysAgo),
  lastVisit: ago(lastVisitDaysAgo),
  membershipEnds: new Date(NOW + endsInDays * DAY).toISOString(),
});

const renewal = (daysAgo: number, priceMillimes: number): Renewal => ({
  memberId: 'm',
  at: ago(daysAgo),
  days: 30,
  priceMillimes,
});

describe('club analytics', () => {
  it('compares this week against the one before', () => {
    const members = [member('a', 2), member('b', 5), member('c', 10), member('d', 12)];
    const { signups } = computeAnalytics(members, [], NOW);
    expect(signups.week.now).toBe(2); // a, b
    expect(signups.week.before).toBe(2); // c, d
    expect(signups.week.change).toBe(0);
  });

  it('reports growth from nothing as null, not Infinity', () => {
    const { signups } = computeAnalytics([member('a', 1)], [], NOW);
    expect(signups.week.before).toBe(0);
    expect(signups.week.change).toBeNull();
  });

  it('counts a fall as a negative percentage', () => {
    const members = [member('a', 1), member('c', 9), member('d', 10), member('e', 11), member('f', 12)];
    const { signups } = computeAnalytics(members, [], NOW);
    expect(signups.week.now).toBe(1);
    expect(signups.week.before).toBe(4);
    expect(signups.week.change).toBe(-75);
  });

  it('counts members who stopped coming after three weeks', () => {
    const members = [member('fresh', 40, 1), member('gone', 40, 25), member('long-gone', 60, 90)];
    const { members: m } = computeAnalytics(members, [], NOW);
    expect(m.total).toBe(3);
    expect(m.lapsed).toBe(2);
  });

  it('counts an expired membership as inactive but never removes the member', () => {
    const { members: m } = computeAnalytics([member('a', 5, 1, -3), member('b', 5, 1, 10)], [], NOW);
    expect(m.total).toBe(2);
    expect(m.active).toBe(1);
  });

  it('adds up revenue per window', () => {
    const renewals = [renewal(2, 60000), renewal(5, 45000), renewal(10, 30000)];
    const { revenueMillimes } = computeAnalytics([], renewals, NOW);
    expect(revenueMillimes.week.now).toBe(105000); // 60 + 45 DT
    expect(revenueMillimes.week.before).toBe(30000);
    expect(revenueMillimes.month.now).toBe(135000);
  });

  it('builds a daily series ending today', () => {
    const { series } = computeAnalytics([member('a', 1)], [], NOW, 14);
    expect(series).toHaveLength(14);
    expect(series[13]!.day).toBe('2026-10-02');
    expect(series.reduce((s, p) => s + p.n, 0)).toBe(1);
  });

  it('formats millimes as Tunisian dinars', () => {
    expect(formatMillimes(45000)).toBe('45,000 DT');
    expect(formatMillimes(1500)).toBe('1,500 DT');
    expect(formatMillimes(0)).toBe('0,000 DT');
  });
});
