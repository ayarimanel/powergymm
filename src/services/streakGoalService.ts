import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@gym_app_weekly_goal_v1';
export const DEFAULT_WEEKLY_GOAL = 3;
/** Freezes are applied automatically by floor/weeklyStreak.ts; this is just the monthly allowance. */
export const FREEZES_PER_MONTH = 1;

/** The member's own weekly session goal (1–7). */
export const StreakGoalService = {
  getWeeklyGoal: async (): Promise<number> => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      return n >= 1 && n <= 7 ? n : DEFAULT_WEEKLY_GOAL;
    } catch {
      return DEFAULT_WEEKLY_GOAL;
    }
  },

  setWeeklyGoal: async (goal: number): Promise<number> => {
    const clamped = Math.max(1, Math.min(7, Math.round(goal)));
    try {
      await AsyncStorage.setItem(KEY, String(clamped));
    } catch (e) {
      console.error('streakGoalService write error', e);
    }
    return clamped;
  },
};
