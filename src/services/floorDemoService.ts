import AsyncStorage from '@react-native-async-storage/async-storage';
import { MuscleGroup } from '../types/database';
import { HistoryEvent } from './checkInHistoryService';
import { DEFAULT_HOURLY_CURVE, localDateStr } from '../floor/crowd';

const ENABLED_KEY = '@gym_app_floor_demo_enabled_v1';
const HISTORY_KEY = '@gym_app_floor_demo_history_v1';
const LIVE_KEY = '@gym_app_floor_demo_live_v1';
const MEMBERS_KEY = '@gym_app_floor_demo_members_v1';
const DEMAND_KEY = '@gym_app_floor_demo_demand_v1';

const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'];
const DEMO_NAMES = ['Sarra M.', 'Karim T.', 'Youssef B.', 'Amine R.', 'Meriem K.', 'Nour H.', 'Wassim G.', 'Ines D.', 'Rayen S.', 'Aziz F.'];

export interface DemoCheckIn {
  userId: string;
  userFullName: string;
  muscle: MuscleGroup;
  startedAt: string;
}

/** 8 weeks of synthetic history shaped like a normal gym week, plus a little noise, weekdays busier than weekends. */
function generateHistory(weeks = 8): HistoryEvent[] {
  const out: HistoryEvent[] = [];
  const today = new Date();
  for (let d = 0; d < weeks * 7; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const weekday = (day.getDay() + 6) % 7; // 0 Monday … 6 Sunday
    const dayFactor = weekday < 5 ? 1 : 0.55;
    // Today: only the hours that already happened.
    const lastHour = d === 0 ? today.getHours() : 22;
    for (let h = 6; h <= lastHour; h++) {
      const base = DEFAULT_HOURLY_CURVE[h] ?? 8;
      const noisy = base * dayFactor * (0.7 + Math.random() * 0.6);
      const count = Math.max(0, Math.round(noisy));
      for (let i = 0; i < count; i++) {
        out.push({ date: localDateStr(day), hour: h, muscle: MUSCLES[Math.floor(Math.random() * MUSCLES.length)] });
      }
    }
  }
  return out;
}

/** A pool of demo members; each has a stable "arrived N minutes ago" so the crowd never times out. */
interface DemoPoolEntry {
  userId: string;
  userFullName: string;
  muscle: MuscleGroup;
  agoMin: number;
}

function generateLivePool(count = 50): DemoPoolEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    userId: `demo-${i}`,
    userFullName: DEMO_NAMES[i % DEMO_NAMES.length],
    muscle: MUSCLES[Math.floor(Math.random() * MUSCLES.length)],
    agoMin: Math.round(Math.random() * 70),
  }));
}

/** The pool, sized to how busy this hour usually is, re-timed relative to now. */
function liveFromPool(pool: DemoPoolEntry[], now = new Date()): DemoCheckIn[] {
  const typical = DEFAULT_HOURLY_CURVE[now.getHours()] ?? 0;
  const size = Math.min(pool.length, Math.round(typical * 0.9));
  return pool.slice(0, size).map(p => ({
    userId: p.userId,
    userFullName: p.userFullName,
    muscle: p.muscle,
    startedAt: new Date(now.getTime() - p.agoMin * 60_000).toISOString(),
  }));
}

export interface DemoMemberStat {
  name: string;
  streak: number;
}

export interface DemoHourCount {
  hour: number;
  count: number;
}

/** Club-wide member streaks, for the admin's streak-distribution chart (a single device can't know this for real). */
function generateMemberStats(count = 40): DemoMemberStat[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `${DEMO_NAMES[i % DEMO_NAMES.length]} ${i}`,
    streak: Math.max(0, Math.round(Math.abs(gaussianLike()) * 5)),
  }));
}

/** Rough bell curve centered on 0, for a more natural streak spread than pure uniform noise. */
function gaussianLike(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function generateDemandDistribution(): { alertsByHour: DemoHourCount[]; plannedByHour: DemoHourCount[] } {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22
  const shape = (h: number) => Math.max(0, Math.round((DEFAULT_HOURLY_CURVE[h] ?? 8) / 6 + Math.random() * 3));
  return {
    alertsByHour: hours.map(hour => ({ hour, count: shape(hour) })),
    plannedByHour: hours.map(hour => ({ hour, count: shape(hour) })),
  };
}

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Owner-facing toggle so a demo to a prospective gym never shows an empty page. Generates its own
 * synthetic history + a synthetic live crowd once, on enable, and keeps them in dedicated storage
 * keys so turning it off cleanly removes every trace without touching real check-ins.
 */
export const FloorDemoService = {
  isEnabled: async (): Promise<boolean> => (await AsyncStorage.getItem(ENABLED_KEY)) === '1',

  enable: async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(ENABLED_KEY, '1');
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(generateHistory()));
      await AsyncStorage.setItem(LIVE_KEY, JSON.stringify(generateLivePool()));
      await AsyncStorage.setItem(MEMBERS_KEY, JSON.stringify(generateMemberStats()));
      await AsyncStorage.setItem(DEMAND_KEY, JSON.stringify(generateDemandDistribution()));
    } catch (e) {
      console.error('floorDemoService enable error', e);
    }
  },

  disable: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([ENABLED_KEY, HISTORY_KEY, LIVE_KEY, MEMBERS_KEY, DEMAND_KEY]);
    } catch (e) {
      console.error('floorDemoService disable error', e);
    }
  },

  getHistory: async (): Promise<HistoryEvent[]> => {
    if (!(await FloorDemoService.isEnabled())) return [];
    return readJson(HISTORY_KEY, []);
  },

  getLiveCheckIns: async (now: Date = new Date()): Promise<DemoCheckIn[]> => {
    if (!(await FloorDemoService.isEnabled())) return [];
    return liveFromPool(await readJson<DemoPoolEntry[]>(LIVE_KEY, []), now);
  },

  /** Club-wide data a single device can't otherwise know — only meaningful in demo mode. */
  getMemberStats: async (): Promise<DemoMemberStat[]> => {
    if (!(await FloorDemoService.isEnabled())) return [];
    return readJson(MEMBERS_KEY, []);
  },

  getDemandDistribution: async (): Promise<{ alertsByHour: DemoHourCount[]; plannedByHour: DemoHourCount[] }> => {
    if (!(await FloorDemoService.isEnabled())) return { alertsByHour: [], plannedByHour: [] };
    return readJson(DEMAND_KEY, { alertsByHour: [], plannedByHour: [] });
  },
};
