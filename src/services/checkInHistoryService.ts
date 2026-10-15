import AsyncStorage from '@react-native-async-storage/async-storage';
import { MuscleGroup } from '../types/database';
import { localDateStr } from '../floor/crowd';

const KEY = '@gym_app_checkin_history_v1';
/** ~9 weeks of safety margin over the 8-week forecast window. */
const MAX_DAYS = 63;

export interface HistoryEvent {
  /** YYYY-MM-DD */
  date: string;
  hour: number;
  /** Which zone this check-in was for — lets a muscle chip get its own forecast, not just the gym's. */
  muscle?: MuscleGroup;
}

export interface HourlyPoint {
  date: string;
  hour: number;
  count: number;
}

const read = async (): Promise<HistoryEvent[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEvent[]) : [];
  } catch {
    return [];
  }
};

const write = async (list: HistoryEvent[]) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.error('checkInHistoryService write error', e);
  }
};

/**
 * Rolling log of check-ins, one entry per check-in: the day and hour it started. This is the raw
 * material the Floor forecast is built from — see floor/crowd.ts#hourlyForecast. Since this device
 * only ever sees its own check-ins, the forecast it produces is a per-device estimate, not a true
 * club-wide one, until the app talks to the shared backend (see AGENTS notes on that migration).
 */
export const CheckInHistoryService = {
  record: async (at: Date, muscle?: MuscleGroup): Promise<void> => {
    const list = await read();
    list.push({ date: localDateStr(at), hour: at.getHours(), muscle });
    const cutoff = localDateStr(new Date(Date.now() - MAX_DAYS * 86_400_000));
    await write(list.filter(e => e.date >= cutoff));
  },

  getAll: read,

  /** One point per (date, hour) with how many check-ins started that hour, oldest first. */
  toHourlyPoints: (events: HistoryEvent[]): HourlyPoint[] => {
    const map = new Map<string, HourlyPoint>();
    for (const e of events) {
      const key = `${e.date}|${e.hour}`;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { date: e.date, hour: e.hour, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  },

  /** Demo mode / testing only: replace the whole log. */
  replaceAll: write,
};
