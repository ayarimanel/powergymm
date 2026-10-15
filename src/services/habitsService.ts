/**
 * Storage for the "Bienvenue" questionnaire.
 *
 * Offline-first like the rest of the app: AsyncStorage is the source of truth and
 * the screen never waits on a network call. When EXPO_PUBLIC_API_URL is set the
 * profile is pushed to the backend in the background, the same pattern journalSync
 * already uses for workouts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HabitsProfile, emptyHabits, addDays, toISO } from '../onboarding/habitsModel';

const key = (uid: string) => `@gym_app_habits_v1_${uid}`;

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/** Fire-and-forget: a failed push must never block the questionnaire. */
const push = (uid: string, profile: HabitsProfile) => {
  if (!API_URL) return;
  fetch(`${API_URL}/v1/me/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-member-id': uid },
    body: JSON.stringify(profile),
  }).catch(() => {});
};

export const today = () => toISO(new Date());

export const HabitsService = {
  get: async (uid: string): Promise<HabitsProfile> => {
    try {
      const raw = await AsyncStorage.getItem(key(uid));
      return raw ? { ...emptyHabits(), ...(JSON.parse(raw) as HabitsProfile) } : emptyHabits();
    } catch {
      return emptyHabits();
    }
  },

  /** Called after every card, so closing the app keeps what was already answered. */
  save: async (uid: string, patch: Partial<HabitsProfile>): Promise<HabitsProfile> => {
    const current = await HabitsService.get(uid);
    const next = { ...current, ...patch };
    try {
      await AsyncStorage.setItem(key(uid), JSON.stringify(next));
    } catch {
      // storage full or blocked: the answers stay in memory for this session
    }
    push(uid, next);
    return next;
  },

  /** "Plus tard": back in 3 days, twice at most, then only from Profil › Mes habitudes. */
  snooze: async (uid: string): Promise<HabitsProfile> => {
    const current = await HabitsService.get(uid);
    const count = current.onboardingSnoozeCount + 1;
    return HabitsService.save(uid, {
      onboardingStatus: count >= 2 ? 'done' : 'snoozed',
      onboardingSnoozeCount: count,
      onboardingNextAt: count >= 2 ? null : addDays(today(), 3),
    });
  },

  /** Should the questionnaire open by itself right now? */
  shouldShow: (p: HabitsProfile, now = today()): boolean => {
    if (p.onboardingStatus === 'done') return false;
    if (p.onboardingStatus === 'snoozed') return !!p.onboardingNextAt && p.onboardingNextAt <= now;
    return true; // new, or partial and never finished
  },
};
