/**
 * The owner's numbers, computed from what this device knows.
 *
 * Same shape as GET /v1/owner/analytics on the backend, so the card does not
 * change when the club is linked to Supabase: only where the numbers come from.
 */
import { ClubMember, Renewal } from './clubService';

export interface Delta {
  now: number;
  before: number;
  /** Percent change, or null when there is nothing to compare against. */
  change: number | null;
}

export interface ClubAnalytics {
  members: { total: number; active: number; lapsed: number; neverCame: number };
  signups: { week: Delta; month: Delta };
  revenueMillimes: { week: Delta; month: Delta };
  /** New members per day, oldest first, for the growth chart. */
  series: { day: string; n: number }[];
}

const DAY = 86400000;

/** Growth from zero is not a percentage: the card shows "nouveau" instead of a number. */
const delta = (now: number, before: number): Delta => ({
  now,
  before,
  change: before === 0 ? (now === 0 ? 0 : null) : Math.round(((now - before) / before) * 1000) / 10,
});

const inWindow = (iso: string | undefined, from: number, to: number) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from && t < to;
};

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

export const computeAnalytics = (
  members: ClubMember[],
  renewals: Renewal[],
  now = Date.now(),
  seriesDays = 30
): ClubAnalytics => {
  const sum = (rs: Renewal[]) => rs.reduce((s, r) => s + r.priceMillimes, 0);

  const signupsIn = (from: number, to: number) => members.filter(m => inWindow(m.joinedAt, from, to)).length;
  const revenueIn = (from: number, to: number) => sum(renewals.filter(r => inWindow(r.at, from, to)));

  // "Partis" is deliberately soft: nobody is removed, they simply stopped coming.
  const lapsed = members.filter(m => now - new Date(m.lastVisit).getTime() > 21 * DAY).length;
  const active = members.filter(m => new Date(m.membershipEnds).getTime() >= now).length;
  const neverCame = members.filter(m => m.joinedAt && m.lastVisit === m.joinedAt).length;

  const series: { day: string; n: number }[] = [];
  for (let i = seriesDays - 1; i >= 0; i--) {
    const to = now - i * DAY;
    series.push({ day: isoDay(to), n: signupsIn(to - DAY, to) });
  }

  return {
    members: { total: members.length, active, lapsed, neverCame },
    signups: {
      week: delta(signupsIn(now - 7 * DAY, now), signupsIn(now - 14 * DAY, now - 7 * DAY)),
      month: delta(signupsIn(now - 30 * DAY, now), signupsIn(now - 60 * DAY, now - 30 * DAY)),
    },
    revenueMillimes: {
      week: delta(revenueIn(now - 7 * DAY, now), revenueIn(now - 14 * DAY, now - 7 * DAY)),
      month: delta(revenueIn(now - 30 * DAY, now), revenueIn(now - 60 * DAY, now - 30 * DAY)),
    },
    series,
  };
};

/** 45000 millimes → "45,000 DT" (Tunisian dinar has three decimals). */
export const formatMillimes = (m: number, currency = 'DT'): string =>
  `${Math.floor(m / 1000)},${String(m % 1000).padStart(3, '0')} ${currency}`;
