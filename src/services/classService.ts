import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAYS } from './coachService';

const KEY = '@gym_app_classes_v1';

/** A weekly group class. */
export interface ClubClass {
  id: string;
  title: string;
  coachName: string;
  day: string; // 'Lun' … 'Dim'
  time: string; // 'HH:MM'
  durationMin: number;
  capacity: number;
  /** userId → date (YYYY-MM-DD) of the session they booked. */
  bookings: Record<string, string>;
  /** userId → date of the session they're waiting a spot for (when the class is full). */
  waitlist?: Record<string, string>;
  /** date (YYYY-MM-DD) → why that one occurrence was cancelled (coach emergency, etc.). */
  cancelledSessions?: Record<string, { reason: string; cancelledAt: string }>;
}

const SEED: ClubClass[] = [
  { id: 'cl-1', title: 'HIIT', coachName: 'Coach Sonia', day: 'Lun', time: '19:00', durationMin: 45, capacity: 20, bookings: {} },
  { id: 'cl-2', title: 'Yoga', coachName: 'Coach Sonia', day: 'Mar', time: '18:30', durationMin: 60, capacity: 15, bookings: {} },
  { id: 'cl-3', title: 'Cross training', coachName: 'Coach Anis', day: 'Mer', time: '19:30', durationMin: 50, capacity: 18, bookings: {} },
  { id: 'cl-4', title: 'Zumba', coachName: 'Coach Sonia', day: 'Jeu', time: '18:00', durationMin: 55, capacity: 25, bookings: {} },
  { id: 'cl-5', title: 'Stretching', coachName: 'Coach Anis', day: 'Sam', time: '10:00', durationMin: 40, capacity: 20, bookings: {} },
];

export const ClassService = {
  getAll: async (): Promise<ClubClass[]> => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as ClubClass[];
    } catch {}
    await AsyncStorage.setItem(KEY, JSON.stringify(SEED)).catch(() => {});
    return SEED;
  },
  save: (list: ClubClass[]) => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {}),
};

const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Next session of a weekly class (today if it has not started yet). */
export const nextSession = (c: ClubClass, now: Date = new Date()) => {
  const todayIdx = (now.getDay() + 6) % 7;
  const target = Math.max(0, DAYS.indexOf(c.day));
  const [h, m] = c.time.split(':').map(n => parseInt(n, 10) || 0);
  let diff = (target - todayIdx + 7) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(h, m, 0, 0);
  if (start.getTime() < now.getTime()) {
    diff += 7;
    start.setDate(start.getDate() + 7);
  }
  return { date: ymd(start), start, inDays: diff };
};

export const spotsLeft = (c: ClubClass) => {
  const { date } = nextSession(c);
  return c.capacity - Object.values(c.bookings).filter(d => d === date).length;
};

/** How many members are booked for the next occurrence of this class. */
export const bookedCount = (c: ClubClass) => {
  const { date } = nextSession(c);
  return Object.values(c.bookings).filter(d => d === date).length;
};

/** UserIds booked for the next session, in insertion order (used for the avatar preview). */
export const nextAttendeeIds = (c: ClubClass) => {
  const { date } = nextSession(c);
  return Object.entries(c.bookings).filter(([, d]) => d === date).map(([uid]) => uid);
};

export const isBooked = (c: ClubClass, userId: string) => c.bookings[userId] === nextSession(c).date;
export const isWaitlisted = (c: ClubClass, userId: string) => (c.waitlist ?? {})[userId] === nextSession(c).date;

/** The next occurrence's cancellation, if the coach/owner called it off. */
export const cancelledNext = (c: ClubClass) => c.cancelledSessions?.[nextSession(c).date];

/** Cancels one occurrence and clears anyone's booking for that date (the session isn't happening). */
export const cancelSession = (c: ClubClass, date: string, reason: string): ClubClass => ({
  ...c,
  cancelledSessions: { ...c.cancelledSessions, [date]: { reason, cancelledAt: new Date().toISOString() } },
  bookings: Object.fromEntries(Object.entries(c.bookings).filter(([, d]) => d !== date)),
});

export const whenLabel = (c: ClubClass) => {
  const { inDays } = nextSession(c);
  return `${inDays === 0 ? 'Aujourd’hui' : inDays === 1 ? 'Demain' : c.day} · ${c.time}`;
};

export const validTime = (t: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t.trim());
