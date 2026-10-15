import AsyncStorage from '@react-native-async-storage/async-storage';
import { MuscleGroup } from '../types/database';
import { FloorSettings } from '../types/floor';
import { WeeklyHours } from '../floor/crowd';
import { GymConfigService } from '../config/gymConfig';

const KEY = '@gym_app_floor_settings_v1';

/** A sensible starting point per zone until the owner tunes it in the admin dashboard. */
export const DEFAULT_ZONE_CAPACITY: Record<MuscleGroup, number> = {
  chest: 2,
  back: 2,
  shoulders: 2,
  arms: 2,
  legs: 3,
  cardio: 4,
};

const weeklyFrom = (openingHour: number, closingHour: number): WeeklyHours => ({
  0: { open: openingHour, close: closingHour },
  1: { open: openingHour, close: closingHour },
  2: { open: openingHour, close: closingHour },
  3: { open: openingHour, close: closingHour },
  4: { open: openingHour, close: closingHour },
  5: { open: openingHour, close: closingHour },
  6: { open: openingHour, close: closingHour },
});

const read = async (): Promise<FloorSettings | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FloorSettings) : null;
  } catch {
    return null;
  }
};

const write = async (settings: FloorSettings) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('floorSettingsService write error', e);
  }
};

export const FloorSettingsService = {
  /** Seeds the weekly hours from the gym's opening/closing hour on first read. */
  getSettings: async (): Promise<FloorSettings> => {
    const stored = await read();
    if (stored) return stored;
    const gym = await GymConfigService.getConfig();
    const fresh: FloorSettings = {
      weekly: weeklyFrom(gym.openingHour, gym.closingHour),
      specialDays: [],
      zoneCapacity: { ...DEFAULT_ZONE_CAPACITY },
      gymCalmPct: 40,
      gymBusyPct: 70,
    };
    await write(fresh);
    return fresh;
  },

  saveSettings: async (patch: Partial<FloorSettings>): Promise<FloorSettings> => {
    const current = await FloorSettingsService.getSettings();
    const next: FloorSettings = { ...current, ...patch };
    await write(next);
    return next;
  },
};
