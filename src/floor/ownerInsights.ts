/* Owner insights: turn check-ins into decisions (equipment, peak shift, coaches, off-peak). Pure, no React. */
import { CoachProfile, MuscleGroup } from '../types/database';
import { isScheduledAt } from '../services/coachService';
import { PRESENCE_MINUTES, WeeklyHours, mondayIndex } from './crowd';

export interface InsightEvent {
  date: string; // YYYY-MM-DD
  hour: number;
  muscle?: MuscleGroup;
}

export interface InsightInputs {
  events: InsightEvent[];
  now: Date;
  capacity: number;
  zoneCapacity: Partial<Record<MuscleGroup, number>>;
  /** 0 = Monday … 6 = Sunday; null = closed. */
  weekly: WeeklyHours;
  coaches: CoachProfile[];
}

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const ZONE_LABEL: Record<MuscleGroup, string> = { chest: 'pectoraux', back: 'dos', shoulders: 'épaules', arms: 'bras', legs: 'jambes', cardio: 'cardio' };
const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'];
/** An entry keeps someone on the floor ~75 min: entries per hour × 1.25 ≈ people present. */
const PRESENCE_FACTOR = PRESENCE_MINUTES / 60;
const WINDOW_WEEKS = 4;

const dayStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const daysAgo = (now: Date, date: string) => Math.round((+dayStart(now) - +new Date(`${date}T00:00:00`)) / 864e5);
const weekdayOf = (date: string) => mondayIndex(new Date(`${date}T00:00:00`));
const isOpen = (weekly: WeeklyHours, weekday: number, hour: number) => {
  const h = weekly[weekday];
  return !!h && hour >= h.open && hour < h.close;
};
/** Events of the last N full weeks before today (today excluded: it isn't over). */
const inWindow = (e: InsightEvent, now: Date, fromDays: number, toDays: number) => {
  const d = daysAgo(now, e.date);
  return d >= fromDays && d < toDays;
};

/** Longest run of consecutive hours, as "18h–21h". */
function hoursLabel(hours: number[]): { from: number; to: number } {
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  let best = { from: sorted[0], to: sorted[0] + 1 };
  let start = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] !== sorted[i - 1] + 1) {
      if (sorted[i - 1] + 1 - start > best.to - best.from) best = { from: start, to: sorted[i - 1] + 1 };
      if (i < sorted.length) start = sorted[i];
    }
  }
  return best;
}

/* ---------------- zones that run out of equipment ---------------- */
export interface ZoneSaturation {
  muscle: MuscleGroup;
  label: string;
  /** Posts / machines the owner declared for the zone. */
  capacity: number;
  /** Typical people at the worst hour. */
  worstLoad: number;
  from: number;
  to: number;
  /** Weekdays with at least one saturated hour. */
  days: number;
  /** Saturated (weekday, hour) slots per week. */
  hoursPerWeek: number;
  text: string;
}

export function zoneSaturation({ events, now, zoneCapacity, weekly }: InsightInputs): ZoneSaturation[] {
  const recent = events.filter(e => e.muscle && inWindow(e, now, 1, 1 + WINDOW_WEEKS * 7));
  const out: ZoneSaturation[] = [];
  for (const m of MUSCLES) {
    const cap = Math.max(1, zoneCapacity[m] ?? 2);
    const totals = new Map<string, number>();
    for (const e of recent) if (e.muscle === m) totals.set(`${weekdayOf(e.date)}|${e.hour}`, (totals.get(`${weekdayOf(e.date)}|${e.hour}`) ?? 0) + 1);
    const slots = [...totals.entries()]
      .map(([k, n]) => {
        const [w, h] = k.split('|').map(Number);
        return { w, h, load: (n / WINDOW_WEEKS) * PRESENCE_FACTOR };
      })
      .filter(x => isOpen(weekly, x.w, x.h) && x.load >= cap);
    if (!slots.length) continue;
    const { from, to } = hoursLabel(slots.map(x => x.h));
    const days = new Set(slots.map(x => x.w)).size;
    const worstLoad = Math.round(Math.max(...slots.map(x => x.load)));
    out.push({
      muscle: m,
      label: ZONE_LABEL[m],
      capacity: cap,
      worstLoad,
      from,
      to,
      days,
      hoursPerWeek: slots.length,
      text: `Zone ${ZONE_LABEL[m]} saturée ${from}h–${to}h, ${days} jour${days > 1 ? 's' : ''} sur 7 · ≈ ${worstLoad} membres pour ${cap} poste${cap > 1 ? 's' : ''}.`,
    });
  }
  return out.sort((a, b) => b.hoursPerWeek - a.hoursPerWeek || b.worstLoad / b.capacity - a.worstLoad / a.capacity);
}

/* ---------------- did members leave the peak? ---------------- */
export interface PeakShift {
  peakFrom: number;
  peakTo: number;
  /** Share of this week's visits that fell in the peak hours (0..1). */
  shareThisWeek: number;
  /** Same share over the 4 weeks before. */
  shareBefore: number;
  /** Visits that would have been in the peak at the old rate. Positive = members moved out. */
  movedVisits: number;
  /** Regular members (3 visits / week) that the freed room can welcome. */
  roomForMembers: number;
  text: string;
}

export function peakShift({ events, now }: InsightInputs): PeakShift | null {
  const before = events.filter(e => inWindow(e, now, 7, 7 + WINDOW_WEEKS * 7));
  const week = events.filter(e => inWindow(e, now, 0, 7));
  if (week.length < 10 || before.length < 20) return null;
  const perHour = new Map<number, number>();
  for (const e of before) perHour.set(e.hour, (perHour.get(e.hour) ?? 0) + 1);
  // The peak = the busiest hours (up to 3) that are close to the busiest one.
  const ranked = [...perHour.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.filter(([, n]) => n >= ranked[0][1] * 0.7).slice(0, 3).map(([h]) => h);
  const { from, to } = hoursLabel(top);
  const peak = new Set(top);
  const share = (list: InsightEvent[]) => list.filter(e => peak.has(e.hour)).length / list.length;
  const shareThisWeek = share(week);
  const shareBefore = share(before);
  const movedVisits = Math.round((shareBefore - shareThisWeek) * week.length);
  const roomForMembers = Math.max(0, Math.floor(movedVisits / 3));
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const text =
    movedVisits > 0
      ? `≈ ${movedVisits} visites ont quitté le pic (${from}h–${to}h) cette semaine : ${pct(shareThisWeek)} des visites contre ${pct(shareBefore)} avant. De la place pour ≈ ${roomForMembers} membre${roomForMembers > 1 ? 's' : ''} régulier${roomForMembers > 1 ? 's' : ''} de plus.`
      : movedVisits < 0
        ? `Le pic (${from}h–${to}h) se remplit plus : ${pct(shareThisWeek)} des visites cette semaine contre ${pct(shareBefore)} avant.`
        : `Le pic (${from}h–${to}h) reste stable : ${pct(shareThisWeek)} des visites.`;
  return { peakFrom: from, peakTo: to, shareThisWeek, shareBefore, movedVisits, roomForMembers, text };
}

/* ---------------- peaks with no floor coach ---------------- */
export interface CoachGap {
  weekday: number;
  hour: number;
  /** Typical people present. */
  load: number;
  text: string;
}

export function coachGaps({ events, now, weekly, coaches }: InsightInputs, max = 3): CoachGap[] {
  const recent = events.filter(e => inWindow(e, now, 1, 1 + WINDOW_WEEKS * 7));
  const totals = new Map<string, number>();
  for (const e of recent) totals.set(`${weekdayOf(e.date)}|${e.hour}`, (totals.get(`${weekdayOf(e.date)}|${e.hour}`) ?? 0) + 1);
  const peaks = [...totals.entries()]
    .map(([k, n]) => {
      const [w, h] = k.split('|').map(Number);
      return { weekday: w, hour: h, load: Math.round((n / WINDOW_WEEKS) * PRESENCE_FACTOR) };
    })
    .filter(x => isOpen(weekly, x.weekday, x.hour))
    .sort((a, b) => b.load - a.load)
    .slice(0, 8);
  return peaks
    .filter(p => !coaches.some(c => isScheduledAt(c, p.weekday, p.hour)))
    .slice(0, max)
    .map(p => ({ ...p, text: `${DAY_NAMES[p.weekday]} ${p.hour}h : ≈ ${p.load} membres et aucun coach plateau prévu.` }));
}

/* ---------------- best quiet window ---------------- */
export interface QuietWindow {
  from: number;
  to: number;
  /** Typical occupancy, % of the gym capacity. */
  pct: number;
  text: string;
}

export function quietWindow({ events, now, weekly, capacity }: InsightInputs): QuietWindow | null {
  const recent = events.filter(e => inWindow(e, now, 1, 1 + WINDOW_WEEKS * 7) && weekdayOf(e.date) < 5);
  if (recent.length < 20) return null;
  const perHour = new Map<number, number>();
  for (const e of recent) perHour.set(e.hour, (perHour.get(e.hour) ?? 0) + 1);
  // Hours open every weekday, minus the first one (people arriving, staff setting up).
  const open = Array.from({ length: 24 }, (_, h) => h).filter(h => [0, 1, 2, 3, 4].every(w => isOpen(weekly, w, h)));
  const candidates = open.slice(1).filter(h => open.includes(h + 1));
  if (!candidates.length) return null;
  const load = (h: number) => ((perHour.get(h) ?? 0) / (WINDOW_WEEKS * 5)) * PRESENCE_FACTOR;
  const best = candidates.reduce((a, h) => (load(h) + load(h + 1) < load(a) + load(a + 1) ? h : a), candidates[0]);
  const pct = Math.round((((load(best) + load(best + 1)) / 2) / Math.max(1, capacity)) * 100);
  return { from: best, to: best + 2, pct, text: `Creux en semaine ${best}h–${best + 2}h (≈ ${pct} % de la capacité) : idéal pour un cours, une offre heures creuses ou l’entretien du matériel.` };
}

/* ---------------- the week in one paragraph ---------------- */
export interface WeeklySummary {
  visits: number;
  /** % change vs the previous 7 days (null when there was nothing to compare). */
  change: number | null;
  busiest: { weekday: number; hour: number } | null;
  lines: string[];
  /** Ready to paste in WhatsApp. */
  text: string;
}

export function weeklySummary(input: InsightInputs, gymName: string): WeeklySummary {
  const { events, now } = input;
  const week = events.filter(e => inWindow(e, now, 0, 7));
  const prev = events.filter(e => inWindow(e, now, 7, 14));
  const change = prev.length ? Math.round(((week.length - prev.length) / prev.length) * 100) : null;
  const slot = new Map<string, number>();
  for (const e of week) slot.set(`${weekdayOf(e.date)}|${e.hour}`, (slot.get(`${weekdayOf(e.date)}|${e.hour}`) ?? 0) + 1);
  const top = [...slot.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiest = top ? { weekday: Number(top[0].split('|')[0]), hour: Number(top[0].split('|')[1]) } : null;

  const zones = zoneSaturation(input);
  const shift = peakShift(input);
  const gaps = coachGaps(input, 1);
  const quiet = quietWindow(input);

  const lines = [
    `${week.length} entrée${week.length > 1 ? 's' : ''} sur 7 jours${change === null ? '' : ` (${change >= 0 ? '+' : ''}${change} % vs la semaine d’avant)`}.`,
    busiest ? `Moment le plus chargé : ${DAY_NAMES[busiest.weekday].toLowerCase()} ${busiest.hour}h.` : null,
    zones[0] ? zones[0].text : 'Aucune zone saturée : le matériel suffit.',
    shift ? shift.text : null,
    gaps[0] ? gaps[0].text : null,
    quiet ? quiet.text : null,
  ].filter((l): l is string => !!l);

  return { visits: week.length, change, busiest, lines, text: [`📊 ${gymName} · résumé de la semaine`, ...lines.map(l => `• ${l}`)].join('\n') };
}
