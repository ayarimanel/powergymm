import { useEffect, useState } from 'react';
import { MuscleGroup } from '../types/database';
import { CheckInHistoryService } from '../services/checkInHistoryService';
import { FloorSettingsService } from '../services/floorSettingsService';
import { FloorDemoService } from '../services/floorDemoService';
import {
  HourForecast,
  bestHour as pickBestHour,
  groupIntoHistoryPoints,
  hourlyForecast,
  hoursForDate,
  isOpenAt,
  mondayIndex,
  zoneThresholds,
} from './crowd';

/**
 * On-demand forecast for one muscle (only computed while a chip is focused, not on every poll
 * tick — a zone's forecast is a much rarer read than the gym-wide one in useFloorSnapshot).
 */
export function useMuscleForecast(muscle: MuscleGroup | null) {
  const [hourly, setHourly] = useState<HourForecast[] | null>(null);
  const [bestHour, setBestHour] = useState<number | null>(null);

  useEffect(() => {
    if (!muscle) {
      setHourly(null);
      setBestHour(null);
      return;
    }
    let alive = true;
    (async () => {
      const [settings, historyRaw, demoOn, demoHistory] = await Promise.all([
        FloorSettingsService.getSettings(),
        CheckInHistoryService.getAll(),
        FloorDemoService.isEnabled(),
        FloorDemoService.getHistory(),
      ]);
      const now = new Date();
      const hours = hoursForDate(settings.weekly, settings.specialDays, now);
      if (!hours) {
        if (alive) {
          setHourly([]);
          setBestHour(null);
        }
        return;
      }
      const events = [...historyRaw, ...demoHistory].filter(e => e.muscle === muscle);
      const points = groupIntoHistoryPoints(events);
      const capacity = settings.zoneCapacity[muscle] ?? 2;
      const nowHour = now.getHours() + now.getMinutes() / 60;
      const isOpen = isOpenAt(hours, nowHour);
      const forecast = hourlyForecast({
        hours,
        history: points,
        weekday: mondayIndex(now),
        weeks: 8,
        thresholds: zoneThresholds(capacity),
        nowHour,
        capacity,
      });
      if (!alive) return;
      setHourly(forecast);
      setBestHour(pickBestHour(forecast, nowHour, isOpen));
    })();
    return () => {
      alive = false;
    };
  }, [muscle]);

  return { hourly, bestHour };
}
