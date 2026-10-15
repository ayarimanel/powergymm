import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckInRecord, MuscleGroup, UserProfile } from '../types/database';
import { PRESENCE_MINUTES } from '../floor/crowd';
import { AuthService } from './authService';
import { CheckInHistoryService } from './checkInHistoryService';

const CHECK_INS_KEY = '@gym_app_check_ins_v1';

export const CheckInService = {
  /** Check-ins still counted as present: not scanned out, and inside the presence window. */
  getActiveCheckIns: async (): Promise<CheckInRecord[]> => {
    try {
      const data = await AsyncStorage.getItem(CHECK_INS_KEY);
      if (!data) return [];
      const list: CheckInRecord[] = JSON.parse(data);
      const now = new Date().getTime();
      return list.filter(item => !item.endedAt && new Date(item.expiresAt).getTime() > now);
    } catch (e) {
      console.error('Error reading check-ins:', e);
      return [];
    }
  },

  /** All check-ins on this device, ended or not (used to find "mine" even after I scan out). */
  getAllCheckIns: async (): Promise<CheckInRecord[]> => {
    try {
      const data = await AsyncStorage.getItem(CHECK_INS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Perform manual check-in: "I'm here now training X"
  performCheckIn: async (
    user: UserProfile,
    muscleGroup: MuscleGroup
  ): Promise<{ checkIn: CheckInRecord; updatedProfile: UserProfile }> => {
    const now = new Date();
    const expires = new Date(now.getTime() + PRESENCE_MINUTES * 60 * 1000);

    const newRecord: CheckInRecord = {
      id: 'checkin-' + Date.now(),
      userId: user.id,
      userFullName: user.fullName,
      gymId: user.gymId,
      muscleGroup: muscleGroup,
      checkInTime: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    try {
      const activeList = await CheckInService.getActiveCheckIns();
      // Remove any existing active check-in for this user to avoid double counting
      const filtered = activeList.filter(c => c.userId !== user.id);
      const updatedList = [newRecord, ...filtered];
      await AsyncStorage.setItem(CHECK_INS_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.error('Error saving check-in:', e);
    }

    // Feed the Floor forecast: one more data point for this weekday+hour (and this zone).
    CheckInHistoryService.record(now, muscleGroup).catch(() => {});

    // Increment & update member visit streak counter
    const updatedProfile = await AuthService.updateVisitStreak(user);

    return { checkIn: newRecord, updatedProfile };
  },

  /** Scan out: presence ends now instead of waiting out the window. */
  endCheckIn: async (userId: string): Promise<void> => {
    try {
      const data = await AsyncStorage.getItem(CHECK_INS_KEY);
      const list: CheckInRecord[] = data ? JSON.parse(data) : [];
      const idx = list.findIndex(c => c.userId === userId && !c.endedAt);
      if (idx === -1) return;
      list[idx] = { ...list[idx], endedAt: new Date().toISOString() };
      await AsyncStorage.setItem(CHECK_INS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error ending check-in:', e);
    }
  },
};
