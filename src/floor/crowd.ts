/**
 * Pure crowd-level engine for the Floor page. No I/O, no React, no dates that aren't passed in —
 * everything here is a plain function so it can be unit tested and reused by both the member
 * view (levels only) and the admin dashboard (exact counts).
 *
 * Rule enforced here: members only ever see `calme | moyen | plein`. Exact counts stay in the
 * return values used by the admin screens; the member UI must read `.level`, never `.count`.
 */
import { MuscleGroup } from '../types/database';

export type CrowdLevel = 'calme' | 'moyen' | 'plein';

/** "Chargé", not "plein": members read it as "come later", not "this gym is too small". */
export const LEVEL_LABEL: Record<CrowdLevel, string> = {
  calme: 'CALME',
  moyen: 'MOYEN',
  plein: 'CHARGÉ',
};

/** A check-in counts as "present" for this long unless scanned out first. */
export const PRESENCE_MINUTES = 75;

export interface PresenceRecord {
  startedAt: string; // ISO
  endedAt?: string | null; // ISO — set once the member scans out
}

/** Is this check-in still "present" at `atMs`? */
export function isPresentAt(rec: PresenceRecord, atMs: number): boolean {
  const start = new Date(rec.startedAt).getTime();
  if (Number.isNaN(start) || start > atMs) return false;
  if (rec.endedAt) return new Date(rec.endedAt).getTime() > atMs;
  return atMs - start < PRESENCE_MINUTES * 60_000;
}

export function presentCount(records: PresenceRecord[], atMs = Date.now()): number {
  return records.reduce((n, r) => (isPresentAt(r, atMs) ? n + 1 : n), 0);
}

export function presentCountByMuscle(
  records: (PresenceRecord & { muscle: MuscleGroup })[],
  atMs = Date.now()
): Record<MuscleGroup, number> {
  const out: Record<MuscleGroup, number> = { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, cardio: 0 };
  for (const r of records) if (isPresentAt(r, atMs)) out[r.muscle] += 1;
  return out;
}

// ---------- Levels ----------

export interface LevelThresholds {
  /** count <= calmMax → calme */
  calmMax: number;
  /** count >= busyMin → plein; in between → moyen */
  busyMin: number;
}

export function levelFromCount(count: number, t: LevelThresholds): CrowdLevel {
  if (count <= t.calmMax) return 'calme';
  if (count < t.busyMin) return 'moyen';
  return 'plein';
}

/** Whole-gym thresholds derived from its capacity and the owner's calm/busy % settings. */
export function gymThresholds(capacity: number, calmPct = 40, busyPct = 70): LevelThresholds {
  return {
    calmMax: Math.max(1, Math.round((capacity * calmPct) / 100)),
    busyMin: Math.max(2, Math.round((capacity * busyPct) / 100)),
  };
}

/** A zone's thresholds from its equipment capacity: up to 1x capacity is calm, up to 2x is moyen. */
export function zoneThresholds(capacity: number): LevelThresholds {
  const cap = Math.max(1, capacity);
  return { calmMax: cap, busyMin: cap * 2 };
}

// ---------- Opening hours (weekly + special days) ----------

export interface SpecialDay {
  /** YYYY-MM-DD */
  date: string;
  open: number;
  close: number;
  label: string;
  emoji?: string;
}

/** Keyed 0 (Monday) … 6 (Sunday). `null` = closed that day. */
export type WeeklyHours = Record<number, { open: number; close: number } | null>;

export interface DayHours {
  open: number;
  close: number;
  special?: SpecialDay;
}

/** YYYY-MM-DD in the device's local time (not UTC — the gym's day, hours and special days are all local). */
export const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

export function hoursForDate(weekly: WeeklyHours, specialDays: SpecialDay[], date: Date): DayHours | null {
  const special = specialDays.find(s => s.date === localDateStr(date));
  if (special) return { open: special.open, close: special.close, special };
  const w = weekly[mondayIndex(date)];
  return w ? { open: w.open, close: w.close } : null;
}

export function isOpenAt(hours: DayHours | null, hourDecimal: number): boolean {
  if (!hours) return false;
  return hourDecimal >= hours.open && hourDecimal < hours.close;
}

// ---------- Forecast ----------

/** One real observation: on some past day, this many people were present at this weekday+hour. */
export interface HistoryPoint {
  weekday: number; // 0 Monday … 6 Sunday
  hour: number;
  count: number;
}

/** Rough shape of a normal day when there isn't (yet) enough real history. Hour → typical count. */
export const DEFAULT_HOURLY_CURVE: Record<number, number> = {
  6: 4, 7: 10, 8: 16, 9: 12, 10: 9, 11: 7, 12: 13, 13: 10, 14: 8,
  15: 14, 16: 24, 17: 34, 18: 40, 19: 36, 20: 28, 21: 18, 22: 6,
};

export interface ForecastResult {
  count: number;
  /** True when there wasn't enough real history and the fallback curve was used. */
  estimated: boolean;
}

/** Average present count for this weekday+hour over its last `weeks` occurrences, oldest first in `history`. */
export function forecastCount(history: HistoryPoint[], weekday: number, hour: number, weeks: number, fallback: number): ForecastResult {
  const matches = history.filter(h => h.weekday === weekday && h.hour === hour).slice(-weeks);
  if (matches.length === 0) return { count: fallback, estimated: true };
  return { count: matches.reduce((s, m) => s + m.count, 0) / matches.length, estimated: false };
}

export interface HourForecast {
  hour: number;
  count: number;
  level: CrowdLevel;
  isNow: boolean;
  estimated: boolean;
}

/** Today's (or any day's) hourly forecast, clipped to that day's opening hours. */
export function hourlyForecast(opts: {
  hours: DayHours;
  history: HistoryPoint[];
  weekday: number;
  weeks: number;
  thresholds: LevelThresholds;
  nowHour: number;
  capacity: number;
}): HourForecast[] {
  const { hours, history, weekday, weeks, thresholds, nowHour, capacity } = opts;
  const out: HourForecast[] = [];
  for (let h = Math.floor(hours.open); h < Math.ceil(hours.close); h++) {
    const fallback = DEFAULT_HOURLY_CURVE[h] ?? Math.round(capacity * 0.15);
    const { count, estimated } = forecastCount(history, weekday, h, weeks, fallback);
    const rounded = Math.round(count);
    out.push({ hour: h, count: rounded, level: levelFromCount(rounded, thresholds), isNow: h === Math.floor(nowHour), estimated });
  }
  return out;
}

/** Raw {date, hour} check-in events → one HistoryPoint per (date, hour), weekday attached. */
export function groupIntoHistoryPoints(events: { date: string; hour: number }[]): HistoryPoint[] {
  const map = new Map<string, { date: string; hour: number; count: number }>();
  for (const e of events) {
    const key = `${e.date}|${e.hour}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { date: e.date, hour: e.hour, count: 1 });
  }
  return [...map.values()].map(p => ({ weekday: mondayIndex(new Date(p.date + 'T00:00:00')), hour: p.hour, count: p.count }));
}

/** Calmest remaining hour today (or the whole day if closed). Ties keep the soonest hour. */
export function bestHour(hourly: HourForecast[], nowHour: number, isOpenNow: boolean): number | null {
  const candidates = hourly.filter(h => !isOpenNow || h.hour >= Math.floor(nowHour));
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const c of candidates) if (c.count < best.count) best = c;
  return best.hour;
}
