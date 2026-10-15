import { HourlyOccupancy, MuscleGroup, MuscleOccupancy } from '../types/database';
import { Level } from '../theme';

// ---------- Levels ----------

/** Whole-club occupancy (% of capacity): < 40 calm, < 70 moderate, else busy. */
export const clubLevel = (pct: number): Level => (pct < 40 ? 'green' : pct < 70 ? 'amber' : 'red');

export const CLUB_LEVEL_LABEL: Record<Level, string> = {
  green: 'Calme',
  amber: 'Modéré',
  red: 'Chargé',
};

/** Muscle zone (% share of people training): 0–15 green, 16–30 amber, 31+ red. */
export const zoneLevel = (pct: number): Level => (pct <= 15 ? 'green' : pct <= 30 ? 'amber' : 'red');

export const ZONE_LEVEL_LABEL: Record<Level, string> = {
  green: 'Libre',
  amber: 'Actif',
  red: 'Saturé',
};

export const MUSCLE_ICON: Record<MuscleGroup, string> = {
  chest: 'barbell-outline',
  back: 'body-outline',
  legs: 'walk-outline',
  shoulders: 'shield-outline',
  arms: 'fitness-outline',
  cardio: 'heart-outline',
};

// ---------- Hours / chart ----------

export const pad = (h: number) => `${h < 10 ? '0' : ''}${h}:00`;

/** Bars cover [open, close): the club closes AT closingHour, so that hour has no bar. */
export const openingHoursBars = (hourly: HourlyOccupancy[], closingHour: number) =>
  hourly.filter(h => h.hour < closingHour);

/**
 * Best 2-hour window still ahead of us today (or the whole day if the club is closed).
 * Returns e.g. { from: '15:00', to: '17:00', level: 'green' }.
 */
export const bestWindow = (bars: HourlyOccupancy[], currentHour: number, isOpen: boolean) => {
  const span = 2;
  const candidates = bars.filter(b => !isOpen || b.hour >= currentHour);
  let best: { start: number; avg: number } | null = null;
  for (let i = 0; i + span <= candidates.length; i++) {
    const slice = candidates.slice(i, i + span);
    const avg = slice.reduce((s, b) => s + b.percentage, 0) / span;
    if (!best || avg < best.avg) best = { start: slice[0].hour, avg };
  }
  if (!best) return null;
  return {
    from: pad(best.start),
    to: pad(best.start + span),
    level: clubLevel(best.avg),
  };
};

/** Three least busy zones, least busy first. */
export const quietestZones = (zones: MuscleOccupancy[], n = 3) =>
  [...zones].sort((a, b) => a.percentage - b.percentage).slice(0, n);

// ---------- Time ----------

export const relativeAge = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  return `il y a ${Math.floor(s / 60)} min`;
};

/** UTC day string — matches AuthService.updateVisitStreak so "checked in today" agrees with it. */
export const todayStr = () => new Date().toISOString().split('T')[0];

// ---------- Streak ----------

export const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Which days of the current week (Mon→Sun) belong to the streak.
 * A streak of n ending today (or yesterday if not yet checked in today) fills n days back.
 */
export const weekDots = (streak: number, checkedInToday: boolean) => {
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon = 0
  const lastIdx = checkedInToday ? todayIdx : todayIdx - 1;
  return WEEK_LABELS.map((_, i) => i <= lastIdx && lastIdx - i < streak);
};

export const MILESTONES = [7, 14, 30];
export const isMilestone = (n: number) => MILESTONES.includes(n);

export const firstName = (fullName: string) => {
  const first = (fullName || '').trim().split(/\s+/)[0] || '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
};
