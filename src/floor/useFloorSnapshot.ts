import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckInRecord, MuscleGroup, UserProfile } from '../types/database';
import { CheckInService } from '../services/checkInService';
import { CheckInHistoryService } from '../services/checkInHistoryService';
import { FloorSettingsService } from '../services/floorSettingsService';
import { FloorDemoService } from '../services/floorDemoService';
import { PROTOTYPE_ALWAYS_OPEN } from './prototype';
import {
  CrowdLevel,
  DayHours,
  HistoryPoint,
  HourForecast,
  bestHour as pickBestHour,
  groupIntoHistoryPoints,
  gymThresholds,
  hourlyForecast,
  hoursForDate,
  isOpenAt,
  levelFromCount,
  mondayIndex,
  presentCount,
  presentCountByMuscle,
  zoneThresholds,
} from './crowd';

export interface MuscleLevel {
  muscle: MuscleGroup;
  label: string;
  level: CrowdLevel;
  /** Exact members present in this zone now. Members see this too (product decision). */
  count: number;
}

export interface FloorSnapshot {
  now: Date;
  isOpen: boolean;
  isSpecialDay: boolean;
  specialLabel?: string;
  specialEmoji?: string;
  openingHour: number;
  closingHour: number;
  presentCount: number;
  level: CrowdLevel;
  /** Gym capacity used for the gauge / thresholds. */
  capacity: number;
  /** Typical members present at the current hour (from the forecast), for the "vs usual" line. */
  usualNow: number;
  /** Sorted calmest first; the member's own muscle (if checked in) is flagged. */
  muscles: MuscleLevel[];
  hourly: HourForecast[];
  bestHour: number | null;
  myCheckIn: CheckInRecord | null;
  myMuscle: MuscleGroup | null;
  /** Closed today: when it opens tomorrow, and tomorrow's calmest hour. */
  tomorrow: { openingHour: number; bestHour: number | null } | null;
  demoMode: boolean;
}

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  arms: 'Bras',
  legs: 'Jambes',
  cardio: 'Cardio',
};
const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'];
const LEVEL_ORDER: Record<CrowdLevel, number> = { calme: 0, moyen: 1, plein: 2 };
const FORECAST_WEEKS = 8;

const dayForecast = (
  hours: DayHours,
  history: HistoryPoint[],
  date: Date,
  nowHour: number,
  isOpenNow: boolean,
  capacity: number,
  calmPct: number,
  busyPct: number
) => {
  const hourly = hourlyForecast({
    hours,
    history,
    weekday: mondayIndex(date),
    weeks: FORECAST_WEEKS,
    thresholds: gymThresholds(capacity, calmPct, busyPct),
    nowHour,
    capacity,
  });
  const best = pickBestHour(hourly, nowHour, isOpenNow);
  return { hourly, best };
};

export function useFloorSnapshot(user: UserProfile, capacity: number, refreshMs = 30_000) {
  const [snapshot, setSnapshot] = useState<FloorSnapshot | null>(null);
  const capacityRef = useRef(capacity);
  capacityRef.current = capacity;

  const load = useCallback(async () => {
    const [active, settings, historyRaw, demoOn, demoHistory] = await Promise.all([
      CheckInService.getActiveCheckIns(),
      FloorSettingsService.getSettings(),
      CheckInHistoryService.getAll(),
      FloorDemoService.isEnabled(),
      FloorDemoService.getHistory(),
    ]);

    // Demo mode never shows a closed gym: outside opening hours it plays a typical evening (18:30),
    // so a presentation at any time of day shows the real Floor. Real mode is untouched.
    const realNow = new Date();
    const realHours = hoursForDate(settings.weekly, settings.specialDays, realNow);
    const closedForDemo = (demoOn || PROTOTYPE_ALWAYS_OPEN) && !isOpenAt(realHours, realNow.getHours() + realNow.getMinutes() / 60);
    const now = closedForDemo ? new Date(new Date(realNow).setHours(18, 30, 0, 0)) : realNow;
    const nowHour = now.getHours() + now.getMinutes() / 60;
    const hours = closedForDemo ? (realHours && realHours.open < 18 && realHours.close > 19 ? realHours : { open: 6, close: 22 }) : realHours;
    const isOpen = isOpenAt(hours, nowHour);
    const demoLive = demoOn ? await FloorDemoService.getLiveCheckIns(now) : [];
    const capacityNow = capacityRef.current;
    const thresholds = gymThresholds(capacityNow, settings.gymCalmPct, settings.gymBusyPct);

    type Rec = { startedAt: string; endedAt?: string | null; muscle: MuscleGroup };
    const realRecords: Rec[] = active.map(c => ({ startedAt: c.checkInTime, endedAt: c.endedAt ?? null, muscle: c.muscleGroup }));
    const demoRecords: Rec[] = demoOn ? demoLive.map(d => ({ startedAt: d.startedAt, muscle: d.muscle })) : [];
    const records = [...realRecords, ...demoRecords];

    const count = presentCount(records, now.getTime());
    const level = levelFromCount(count, thresholds);
    const byMuscle = presentCountByMuscle(records, now.getTime());

    const mine = active.find(c => c.userId === user.id) ?? null;
    const muscles: MuscleLevel[] = MUSCLES.map(m => ({
      muscle: m,
      label: MUSCLE_LABEL[m],
      count: byMuscle[m] ?? 0,
      level: levelFromCount(byMuscle[m] ?? 0, zoneThresholds(settings.zoneCapacity[m] ?? 2)),
    })).sort((a, b) => {
      if (mine?.muscleGroup === a.muscle) return -1;
      if (mine?.muscleGroup === b.muscle) return 1;
      return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    });

    const historyPoints = groupIntoHistoryPoints([...historyRaw, ...demoHistory]);

    let hourly: HourForecast[] = [];
    let best: number | null = null;
    if (hours) {
      const r = dayForecast(hours, historyPoints, now, nowHour, isOpen, capacityNow, settings.gymCalmPct, settings.gymBusyPct);
      hourly = r.hourly;
      best = r.best;
    }

    let tomorrow: FloorSnapshot['tomorrow'] = null;
    if (!isOpen) {
      const tmrDate = new Date(now.getTime() + 86_400_000);
      const tmrHours = hoursForDate(settings.weekly, settings.specialDays, tmrDate);
      if (tmrHours) {
        const r = dayForecast(tmrHours, historyPoints, tmrDate, tmrHours.open, false, capacityNow, settings.gymCalmPct, settings.gymBusyPct);
        tomorrow = { openingHour: tmrHours.open, bestHour: r.best };
      }
    }

    setSnapshot({
      now,
      isOpen,
      isSpecialDay: !!hours?.special,
      specialLabel: hours?.special?.label,
      specialEmoji: hours?.special?.emoji,
      openingHour: hours?.open ?? 0,
      closingHour: hours?.close ?? 0,
      presentCount: count,
      level,
      capacity: capacityNow,
      usualNow: hourly.find(h => h.isNow)?.count ?? 0,
      muscles,
      hourly,
      bestHour: best,
      myCheckIn: mine,
      myMuscle: mine?.muscleGroup ?? null,
      tomorrow,
      demoMode: demoOn,
    });
  }, [user.id]);

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { snapshot, reload: load };
}
