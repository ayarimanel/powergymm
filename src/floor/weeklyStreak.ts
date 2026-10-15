/**
 * Weekly streak: the number of consecutive weeks (Monday → Sunday) in which the member reached
 * their session goal (default 3). One missed week per calendar month is covered by a "freeze".
 * The current week only adds to the streak once its goal is reached, but it never breaks it
 * before Sunday is over. Pure: pass the dates in, get the numbers out.
 */
import { localDateStr, mondayIndex } from './crowd';

export interface WeeklyStreak {
  /** Consecutive weeks meeting the goal, frozen weeks included. */
  current: number;
  /** Distinct session days so far this week. */
  thisWeek: number;
  goal: number;
  goalMetThisWeek: boolean;
  /** Mon…Sun of this week: was there a session that day? */
  weekDays: boolean[];
  /** Week-start dates (YYYY-MM-DD) that were saved by a freeze. */
  frozenWeeks: string[];
  freezesLeftThisMonth: number;
}

export const weekStartOf = (d: Date) => {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - mondayIndex(s));
  return s;
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** `sessionDates` are local YYYY-MM-DD strings, one per session (duplicates on a day count once). */
export function computeWeeklyStreak(sessionDates: string[], today: Date, goal = 3, freezesPerMonth = 1): WeeklyStreak {
  const days = new Set(sessionDates);
  const thisStart = weekStartOf(today);

  const sessionsInWeek = (start: Date) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (days.has(localDateStr(addDays(start, i)))) n++;
    return n;
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => days.has(localDateStr(addDays(thisStart, i))));
  const thisWeek = weekDays.filter(Boolean).length;
  const goalMetThisWeek = thisWeek >= goal;

  // Walk back from last week. Stop before the first week that had any session at all.
  const earliest = [...days].sort()[0];
  const earliestStart = earliest ? weekStartOf(new Date(earliest + 'T00:00:00')) : null;
  const freezesUsed = new Map<string, number>();
  const frozenWeeks: string[] = [];
  let current = 0;
  let week = addDays(thisStart, -7);
  while (earliestStart && week >= earliestStart) {
    if (sessionsInWeek(week) >= goal) {
      current++;
    } else {
      const key = monthKey(week);
      const used = freezesUsed.get(key) ?? 0;
      if (used >= freezesPerMonth) break;
      freezesUsed.set(key, used + 1);
      frozenWeeks.push(localDateStr(week));
      current++;
    }
    week = addDays(week, -7);
  }
  // A frozen week at the very start of the run is not a real streak week: drop trailing freezes.
  while (frozenWeeks.length && frozenWeeks[frozenWeeks.length - 1] === localDateStr(addDays(week, 7))) {
    frozenWeeks.pop();
    current--;
    week = addDays(week, 7);
  }
  if (goalMetThisWeek) current++;

  const usedThisMonth = frozenWeeks.filter(w => monthKey(new Date(w + 'T00:00:00')) === monthKey(today)).length;
  return {
    current,
    thisWeek,
    goal,
    goalMetThisWeek,
    weekDays,
    frozenWeeks,
    freezesLeftThisMonth: Math.max(0, freezesPerMonth - usedThisMonth),
  };
}
