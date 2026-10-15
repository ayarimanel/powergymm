import { useCallback, useEffect, useState } from 'react';
import { MuscleGroup } from '../types/database';
import { CheckInService } from '../services/checkInService';
import { CheckInHistoryService } from '../services/checkInHistoryService';
import { FloorSettingsService } from '../services/floorSettingsService';
import { FloorDemoService, DemoMemberStat } from '../services/floorDemoService';
import { CalmAlertService } from '../services/calmAlertService';
import { FloorSettings } from '../types/floor';
import {
  CrowdLevel,
  DEFAULT_HOURLY_CURVE,
  forecastCount,
  gymThresholds,
  levelFromCount,
  localDateStr,
  mondayIndex,
  presentCount,
  presentCountByMuscle,
  zoneThresholds,
  type HistoryPoint,
} from './crowd';
import { MUSCLE_LABEL } from './useFloorSnapshot';
import { CoachService } from '../services/coachService';
import { GymConfigService } from '../config/gymConfig';
import { CoachGap, InsightInputs, PeakShift, QuietWindow, WeeklySummary, ZoneSaturation, coachGaps, peakShift, quietWindow, weeklySummary, zoneSaturation } from './ownerInsights';

const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'];
const HOURS_RANGE = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22, the widest a gym is realistically open

export interface ZoneLive {
  muscle: MuscleGroup;
  label: string;
  count: number;
  capacity: number;
  level: CrowdLevel;
}

export interface HeatCell {
  weekday: number; // 0 Monday … 6 Sunday
  hour: number;
  count: number;
}

export interface AdminFloorData {
  gymId: string;
  demoMode: boolean;
  capacity: number;
  settings: FloorSettings;

  // Live now
  presentCount: number;
  level: CrowdLevel;
  zones: ZoneLive[];
  lastHourCheckIns: number;

  // Detailed graph
  todayByHour: { hour: number; count: number }[];
  weekdayAverageByHour: { hour: number; count: number }[];
  heatmap: HeatCell[]; // last 4–8 weeks, weekday × hour

  // Demand
  activeAlerts: number;
  alertsByHour: { hour: number; count: number }[];
  plannedByHour: { hour: number; count: number }[];
  peakHourThisWeek: number | null;
  peakHourLastWeek: number | null;

  // Engagement
  checkInsPerDay: { date: string; count: number }[];
  activeMembersThisWeek: number | null; // null = not knowable without demo mode / the backend
  streakBuckets: { bucket: string; count: number }[];

  // Decisions for the owner ("Résumé" tab)
  summary: WeeklySummary;
  saturation: ZoneSaturation[];
  shift: PeakShift | null;
  gaps: CoachGap[];
  quiet: QuietWindow | null;
}

const weekStart = (d: Date, offsetWeeks: number) => {
  const day = new Date(d);
  day.setDate(day.getDate() - mondayIndex(day) - offsetWeeks * 7);
  day.setHours(0, 0, 0, 0);
  return day;
};

export function useFloorAdminData(gymId: string, capacity: number, refreshMs = 20_000) {
  const [data, setData] = useState<AdminFloorData | null>(null);

  const load = useCallback(async () => {
    const [coaches, gym, active, settings, historyRaw, demoOn, demoHistory, demoLive, demoMembers, demoDemand, myAlerts, myVisits] = await Promise.all([
      CoachService.getCoaches(),
      GymConfigService.getConfig(),
      CheckInService.getActiveCheckIns(),
      FloorSettingsService.getSettings(),
      CheckInHistoryService.getAll(),
      FloorDemoService.isEnabled(),
      FloorDemoService.getHistory(),
      FloorDemoService.getLiveCheckIns(),
      FloorDemoService.getMemberStats(),
      FloorDemoService.getDemandDistribution(),
      CalmAlertService.getActive(gymId),
      CalmAlertService.visitsFor(gymId),
    ]);

    const now = new Date();
    const records = [
      ...active.map(c => ({ startedAt: c.checkInTime, endedAt: c.endedAt ?? null, muscle: c.muscleGroup })),
      ...demoLive.map(d => ({ startedAt: d.startedAt, endedAt: null, muscle: d.muscle })),
    ];
    const count = presentCount(records, now.getTime());
    const thresholds = gymThresholds(capacity, settings.gymCalmPct, settings.gymBusyPct);
    const byMuscle = presentCountByMuscle(records, now.getTime());
    const zones: ZoneLive[] = MUSCLES.map(m => {
      const cap = settings.zoneCapacity[m] ?? 2;
      const c = byMuscle[m] ?? 0;
      return { muscle: m, label: MUSCLE_LABEL[m], count: c, capacity: cap, level: levelFromCount(c, zoneThresholds(cap)) };
    }).sort((a, b) => b.count - a.count);

    const hourAgo = now.getTime() - 60 * 60_000;
    const lastHourCheckIns = records.filter(r => new Date(r.startedAt).getTime() >= hourAgo).length;

    const events = [...historyRaw, ...demoHistory];
    const todayStr = localDateStr(now);
    const todayByHour = HOURS_RANGE.map(hour => ({
      hour,
      count: events.filter(e => e.date === todayStr && e.hour === hour).length,
    }));

    const points: HistoryPoint[] = (() => {
      const map = new Map<string, { date: string; hour: number; count: number }>();
      for (const e of events) {
        const key = `${e.date}|${e.hour}`;
        const existing = map.get(key);
        if (existing) existing.count += 1;
        else map.set(key, { date: e.date, hour: e.hour, count: 1 });
      }
      return [...map.values()].map(p => ({ weekday: mondayIndex(new Date(p.date + 'T00:00:00')), hour: p.hour, count: p.count }));
    })();

    const weekday = mondayIndex(now);
    const weekdayAverageByHour = HOURS_RANGE.map(hour => ({
      hour,
      count: Math.round(forecastCount(points, weekday, hour, 8, DEFAULT_HOURLY_CURVE[hour] ?? 8).count),
    }));

    const heatmap: HeatCell[] = [];
    for (let w = 0; w < 7; w++) {
      for (const hour of HOURS_RANGE) {
        heatmap.push({ weekday: w, hour, count: Math.round(forecastCount(points, w, hour, 8, DEFAULT_HOURLY_CURVE[hour] ?? 8).count) });
      }
    }

    // Peak hour this week vs last week, from real+demo history events.
    const peakFor = (from: Date, to: Date) => {
      const totals = new Map<number, number>();
      for (const e of events) {
        const d = new Date(e.date + 'T00:00:00');
        if (d >= from && d < to) totals.set(e.hour, (totals.get(e.hour) ?? 0) + 1);
      }
      let bestHour: number | null = null;
      let bestCount = -1;
      for (const [hour, c] of totals) if (c > bestCount) { bestCount = c; bestHour = hour; }
      return bestHour;
    };
    const thisWeekStart = weekStart(now, 0);
    const lastWeekStart = weekStart(now, 1);
    const peakHourThisWeek = peakFor(thisWeekStart, new Date(thisWeekStart.getTime() + 7 * 86_400_000));
    const peakHourLastWeek = peakFor(lastWeekStart, thisWeekStart);

    const alertsByHour = demoOn
      ? demoDemand.alertsByHour
      : HOURS_RANGE.map(hour => ({ hour, count: myAlerts.filter(a => a.targetHour === hour).length }));
    const plannedByHour = demoOn
      ? demoDemand.plannedByHour
      : HOURS_RANGE.map(hour => ({ hour, count: myVisits.filter(v => v.plannedHour === hour).length }));

    // Check-ins per day, last 7 days.
    const checkInsPerDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = localDateStr(new Date(now.getTime() - i * 86_400_000));
      checkInsPerDay.push({ date: d, count: events.filter(e => e.date === d).length });
    }

    const streakBuckets = demoOn ? bucketStreaks(demoMembers) : [];

    const insightInputs: InsightInputs = { events, now, capacity, zoneCapacity: settings.zoneCapacity, weekly: settings.weekly, coaches };

    setData({
      gymId,
      demoMode: demoOn,
      capacity,
      settings,
      presentCount: count,
      level: levelFromCount(count, thresholds),
      zones,
      lastHourCheckIns,
      todayByHour,
      weekdayAverageByHour,
      heatmap,
      activeAlerts: myAlerts.length,
      alertsByHour,
      plannedByHour,
      peakHourThisWeek,
      peakHourLastWeek,
      checkInsPerDay,
      activeMembersThisWeek: demoOn ? demoMembers.length : null,
      streakBuckets,
      summary: weeklySummary(insightInputs, gym.name),
      saturation: zoneSaturation(insightInputs),
      shift: peakShift(insightInputs),
      gaps: coachGaps(insightInputs),
      quiet: quietWindow(insightInputs),
    });
  }, [gymId, capacity]);

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { data, reload: load };
}

function bucketStreaks(members: DemoMemberStat[]): { bucket: string; count: number }[] {
  const buckets = [
    { bucket: '0', test: (s: number) => s === 0 },
    { bucket: '1–2', test: (s: number) => s >= 1 && s <= 2 },
    { bucket: '3–6', test: (s: number) => s >= 3 && s <= 6 },
    { bucket: '7–13', test: (s: number) => s >= 7 && s <= 13 },
    { bucket: '14+', test: (s: number) => s >= 14 },
  ];
  return buckets.map(b => ({ bucket: b.bucket, count: members.filter(m => b.test(m.streak)).length }));
}
