import AsyncStorage from '@react-native-async-storage/async-storage';
import { MuscleGroup } from '../types/database';
import { localDateStr } from '../floor/crowd';
import { CalmAlert, PlannedVisit } from '../types/floor';

const ALERTS_KEY = '@gym_app_calm_alerts_v1';
const VISITS_KEY = '@gym_app_planned_visits_v1';

const readAlerts = async (): Promise<CalmAlert[]> => {
  try {
    const raw = await AsyncStorage.getItem(ALERTS_KEY);
    return raw ? (JSON.parse(raw) as CalmAlert[]) : [];
  } catch {
    return [];
  }
};
const writeAlerts = async (list: CalmAlert[]) => {
  try {
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('calmAlertService write error', e);
  }
};

const readVisits = async (): Promise<PlannedVisit[]> => {
  try {
    const raw = await AsyncStorage.getItem(VISITS_KEY);
    return raw ? (JSON.parse(raw) as PlannedVisit[]) : [];
  } catch {
    return [];
  }
};
const writeVisits = async (list: PlannedVisit[]) => {
  try {
    await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('calmAlertService write visits error', e);
  }
};

/**
 * "🔔 Me prévenir" from the heat strip. `muscle: null` means the whole gym. Firing itself is done
 * by the caller (an in-app toast today; NotificationService.schedule once Web Push is wired) —
 * this service only persists the alert / planned visit and lets it be listed and cleared.
 */
export const CalmAlertService = {
  create: async (input: { userId: string; gymId: string; muscle: MuscleGroup | null; targetHour: number | null }): Promise<CalmAlert> => {
    const alert: CalmAlert = { ...input, id: 'alert-' + Date.now(), active: true, createdAt: new Date().toISOString() };
    await writeAlerts([alert, ...(await readAlerts())]);
    return alert;
  },

  getActive: async (gymId?: string): Promise<CalmAlert[]> => {
    const all = (await readAlerts()).filter(a => a.active);
    return gymId ? all.filter(a => a.gymId === gymId) : all;
  },

  markFired: async (id: string): Promise<void> => {
    const all = await readAlerts();
    await writeAlerts(all.map(a => (a.id === id ? { ...a, active: false, firedAt: new Date().toISOString() } : a)));
  },

  cancel: async (id: string): Promise<void> => {
    await writeAlerts((await readAlerts()).filter(a => a.id !== id));
  },

  planVisit: async (input: { userId: string; gymId: string; plannedHour: number; plannedDate?: string }): Promise<PlannedVisit> => {
    const visit: PlannedVisit = {
      id: 'visit-' + Date.now(),
      userId: input.userId,
      gymId: input.gymId,
      plannedHour: input.plannedHour,
      plannedDate: input.plannedDate ?? localDateStr(new Date()),
      createdAt: new Date().toISOString(),
    };
    await writeVisits([visit, ...(await readVisits())]);
    return visit;
  },

  /** Planned visits for a given date (defaults to today), for the admin "demand" view. */
  visitsFor: async (gymId: string, date = localDateStr(new Date())): Promise<PlannedVisit[]> =>
    (await readVisits()).filter(v => v.gymId === gymId && v.plannedDate === date),
};
