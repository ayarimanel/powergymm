/** Calendar helpers that respect the gym's timezone (a 23:30 visit in Tunis is not "tomorrow" in UTC). */

const partsIn = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return { y: get('year'), m: get('month'), d: get('day'), hour: Number(get('hour')), minute: Number(get('minute')), weekday: get('weekday') };
};

/** YYYY-MM-DD of `date` in the gym's timezone. */
export function localDay(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone);
  return `${p.y}-${p.m}-${p.d}`;
}

export function localHour(date: Date, timeZone: string): number {
  return partsIn(date, timeZone).hour;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** ISO weekday of `date` in the gym's timezone: 1 = Monday … 7 = Sunday. */
export function localWeekday(date: Date, timeZone: string): number {
  return WEEKDAYS.indexOf(partsIn(date, timeZone).weekday) + 1;
}

/** Local "HH:MM" in the gym's timezone. */
export function localTime(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday (1-7) of a YYYY-MM-DD calendar day. */
export function weekdayOf(day: string): number {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}
