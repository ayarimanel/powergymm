import { MuscleGroup } from '../types/database';
import { CheckInService } from './checkInService';

export interface FloorMember {
  userId: string;
  name: string;
  muscle: MuscleGroup;
  /** Minutes since check-in. */
  sinceMin: number;
  /** What they've logged so far, e.g. "6 séries". */
  detail?: string;
}

/**
 * MOCK backend: with no server there is only this device's check-ins, so a few other members are
 * shown "on the floor" to let the coach view be tried. Set to false to show real check-ins only.
 */
const SIMULATE_FLOOR = true;

const MOCK: { userId: string; name: string; muscle: MuscleGroup; since: number; detail?: string }[] = [
  { userId: 'usr-202', name: 'Sarra M.', muscle: 'chest', since: 14, detail: '6 séries' },
  { userId: 'usr-303', name: 'Karim T.', muscle: 'legs', since: 38, detail: '11 séries' },
  { userId: 'usr-101', name: 'Youssef B.', muscle: 'back', since: 52, detail: '9 séries' },
  { userId: 'usr-505', name: 'Amine R.', muscle: 'arms', since: 7 },
  { userId: 'usr-404', name: 'Meriem K.', muscle: 'legs', since: 25, detail: '5 séries' },
];

const startedAt = Date.now(); // keeps the mock durations moving while the app is open

export const FloorService = {
  /** Everyone currently checked in (real check-ins first). */
  getMembers: async (): Promise<FloorMember[]> => {
    const active = await CheckInService.getActiveCheckIns();
    const real: FloorMember[] = active.map(c => ({
      userId: c.userId,
      name: c.userFullName,
      muscle: c.muscleGroup,
      sinceMin: Math.max(0, Math.round((Date.now() - new Date(c.checkInTime).getTime()) / 60000)),
    }));
    if (!SIMULATE_FLOOR) return real;
    const drift = Math.round((Date.now() - startedAt) / 60000);
    const mock = MOCK
      .filter(m => !real.some(r => r.userId === m.userId))
      .map(m => ({ userId: m.userId, name: m.name, muscle: m.muscle, detail: m.detail, sinceMin: m.since + drift }))
      .filter(m => m.sinceMin < 90);
    return [...real, ...mock].sort((a, b) => a.sinceMin - b.sinceMin);
  },
};

