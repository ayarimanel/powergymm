import { useCallback, useEffect, useState } from 'react';
import { CheckInHistoryService } from '../services/checkInHistoryService';
import { FREEZES_PER_MONTH, StreakGoalService } from '../services/streakGoalService';
import { WeeklyStreak, computeWeeklyStreak } from './weeklyStreak';

/**
 * The member's weekly streak, from this device's own check-in log (demo data is kept out of it:
 * it lives in separate storage). Call `reload()` after a check-in.
 */
export function useWeeklyStreak() {
  const [streak, setStreak] = useState<WeeklyStreak | null>(null);

  const reload = useCallback(async (): Promise<WeeklyStreak> => {
    const [events, goal] = await Promise.all([CheckInHistoryService.getAll(), StreakGoalService.getWeeklyGoal()]);
    const next = computeWeeklyStreak(events.map(e => e.date), new Date(), goal, FREEZES_PER_MONTH);
    setStreak(next);
    return next;
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setGoal = useCallback(
    async (goal: number) => {
      await StreakGoalService.setWeeklyGoal(goal);
      await reload();
    },
    [reload]
  );

  return { streak, reload, setGoal };
}
