import { useEffect, useState } from 'react';
import { CheckInHistoryService } from '../services/checkInHistoryService';
import { FloorSettingsService } from '../services/floorSettingsService';
import { FloorDemoService } from '../services/floorDemoService';
import {
  HourForecast,
  gymThresholds,
  groupIntoHistoryPoints,
  hourlyForecast,
  hoursForDate,
  mondayIndex,
} from './crowd';

export interface WeekForecast {
  /** weekday index (0 Monday … 6 Sunday) → that day's hourly usual curve (empty if closed). */
  byDay: Record<number, HourForecast[]>;
  todayIndex: number;
}

const WEEKS = 8;

/** The date of the given Monday-based weekday within the current week (for reading its opening hours). */
const dateForWeekday = (weekday: number, from = new Date()): Date => {
  const d = new Date(from);
  d.setDate(from.getDate() + (weekday - mondayIndex(from)));
  return d;
};

/**
 * One usual-crowd curve per weekday, for the Floor chart's day selector. Computed once from this
 * device's check-in history (+ demo history), reusing the same forecast engine as useFloorSnapshot.
 */
export function useWeekForecast(capacity: number) {
  const [week, setWeek] = useState<WeekForecast | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [settings, historyRaw, demoOn, demoHistory] = await Promise.all([
        FloorSettingsService.getSettings(),
        CheckInHistoryService.getAll(),
        FloorDemoService.isEnabled(),
        FloorDemoService.getHistory(),
      ]);
      const history = groupIntoHistoryPoints([...historyRaw, ...(demoOn ? demoHistory : [])]);
      const thresholds = gymThresholds(capacity, settings.gymCalmPct, settings.gymBusyPct);
      const now = new Date();

      const byDay: Record<number, HourForecast[]> = {};
      for (let wd = 0; wd < 7; wd++) {
        const date = dateForWeekday(wd, now);
        const hours = hoursForDate(settings.weekly, settings.specialDays, date);
        byDay[wd] = hours
          ? hourlyForecast({ hours, history, weekday: wd, weeks: WEEKS, thresholds, nowHour: now.getHours(), capacity })
          : [];
      }
      if (alive) setWeek({ byDay, todayIndex: mondayIndex(now) });
    })();
    return () => {
      alive = false;
    };
  }, [capacity]);

  return week;
}
