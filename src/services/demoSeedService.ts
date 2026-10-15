import AsyncStorage from '@react-native-async-storage/async-storage';
import { FloorDemoService } from './floorDemoService';
import { ClubStatusService } from './clubStatusService';
import { ActivityService } from './communityService';
import { CommunitiesService } from './communitiesService';
import { ClassService, nextSession } from './classService';
import { ProblemReportService } from './problemReportService';
import { JournalStore, newId } from '../journal/journalSync';
import { Workout, WorkoutExercise } from '../journal/journalLogic';

const NEWS_SEED_KEY = '@gym_app_demo_club_news_seeded_v2';
const ACTIVITY_SEED_KEY = '@gym_app_demo_activity_seeded_v1';
const MEMBERSHIP_SEED_KEY = '@gym_app_demo_memberships_seeded_v1';
const CLASS_BOOKINGS_SEED_KEY = '@gym_app_demo_class_bookings_seeded_v1';
const REPORTS_SEED_KEY = '@gym_app_demo_problem_reports_seeded_v1';

/**
 * Fills the app with demo data so a fresh install / web visit never looks empty:
 * turns on the Floor demo crowd (counts, chart, busy zones) and tops up the club news samples once.
 * Coaches, classes, products and the Wall already self-seed on first read.
 * Idempotent — only seeds what is missing, so it never clobbers real activity.
 */
export const DemoSeedService = {
  ensureSeeded: async (): Promise<void> => {
    try {
      if (!(await FloorDemoService.isEnabled())) await FloorDemoService.enable();

      if ((await AsyncStorage.getItem(NEWS_SEED_KEY)) !== '1') {
        await ClubStatusService.addMissingDefaults();
        await AsyncStorage.setItem(NEWS_SEED_KEY, '1');
      }

      // A few member reports so the owner's "Problèmes signalés" page isn't empty in a demo.
      if ((await AsyncStorage.getItem(REPORTS_SEED_KEY)) !== '1' && !(await ProblemReportService.getAll()).length) {
        await ProblemReportService.create({ userId: 'usr-202', userName: 'Sarra M.', category: 'machine', place: 'Dos', message: 'Le câble de la poulie haute est effiloché, il risque de lâcher.' });
        await ProblemReportService.create({ userId: 'usr-303', userName: 'Karim T.', category: 'vestiaires', place: 'Vestiaires', message: 'Plus d’eau chaude dans les douches hommes depuis ce matin.' });
        const list = await ProblemReportService.create({ userId: 'usr-101', userName: 'Amine B.', category: 'clim', place: 'Cardio', message: 'La clim de la zone cardio ne marche pas, il fait très chaud le soir.' });
        await ProblemReportService.setStatus(list[0].id, 'fixed');
      }
      await AsyncStorage.setItem(REPORTS_SEED_KEY, '1');
    } catch (e) {
      console.error('demoSeedService error', e);
    }
  },

  /** Seed a few notifications (likes/comments/validation) on the current member's posts, once,
   *  so the Mur bell has something to show in the demo. */
  ensureActivity: async (userId: string): Promise<void> => {
    try {
      if ((await AsyncStorage.getItem(ACTIVITY_SEED_KEY)) === '1') return;
      await AsyncStorage.setItem(ACTIVITY_SEED_KEY, '1');
      await ActivityService.add({ type: 'validated', postId: 'pr-post-2', ownerId: userId, actorId: 'coach-1', actorName: 'Coach Anis' });
      await ActivityService.add({ type: 'comment', postId: 'post-workout-1', ownerId: userId, actorId: 'usr-303', actorName: 'Karim T.', text: 'Grosse séance, respect 💪' });
      await ActivityService.add({ type: 'like', postId: 'post-workout-1', ownerId: userId, actorId: 'usr-202', actorName: 'Sarra M.' });
    } catch (e) {
      console.error('demoSeedService activity error', e);
    }
  },

  /** Seed a few past sessions (only on an empty journal) so Refaire, the progression hint and the charts have something to show. */
  ensureJournal: async (userId: string): Promise<void> => {
    try {
      const sets = (n: number, kg: number, reps: number) => Array.from({ length: n }, () => ({ kg, reps, done: true }));
      const session = (daysAgo: number, minutes: number, exercises: WorkoutExercise[]): Workout => {
        const start = new Date(Date.now() - daysAgo * 86_400_000);
        start.setHours(18, 0, 0, 0);
        return { id: newId(), date: start.toISOString(), startedAt: start.toISOString(), endedAt: new Date(+start + minutes * 60_000).toISOString(), live: true, exercises };
      };
      await JournalStore.seedIfEmpty(userId, [
        session(12, 55, [
          { exerciseId: 'chest-bench', sets: sets(3, 27.5, 10) },
          { exerciseId: 'arms-curl-bar', sets: sets(3, 20, 10) },
        ]),
        session(8, 60, [
          { exerciseId: 'legs-squat', sets: sets(4, 60, 8) },
          { exerciseId: 'legs-press', sets: sets(3, 120, 10) },
        ]),
        session(5, 50, [
          { exerciseId: 'chest-bench', sets: sets(3, 30, 10) },
          { exerciseId: 'chest-incline-dumbbell', sets: sets(3, 14, 10) },
          { exerciseId: 'arms-pushdown', sets: sets(3, 25, 12) },
        ]),
        session(3, 45, [
          { exerciseId: 'back-pullups', sets: sets(3, 0, 8) },
          { exerciseId: 'back-row-bar', sets: sets(3, 40, 10) },
          { exerciseId: 'cardio-treadmill', sets: [{ min: 20, km: 3, done: true }] },
        ]),
      ]);
    } catch (e) {
      console.error('demoSeedService journal error', e);
    }
  },

  /** Seed a realistic mix of class bookings once, so the ClassesCarousel shows counts, avatars and mixed fullness levels. */
  ensureClassBookings: async (): Promise<void> => {
    try {
      if ((await AsyncStorage.getItem(CLASS_BOOKINGS_SEED_KEY)) === '1') return;
      await AsyncStorage.setItem(CLASS_BOOKINGS_SEED_KEY, '1');
      const cls = await ClassService.getAll();
      // Realistic targets: filling, hot (~70%), complet, quiet, wide-open.
      const targets = [14, 12, 18, 6, 5];
      // Seeded named members whose avatars can show up in the "+N" strip preview.
      const featured = ['usr-101', 'usr-202', 'usr-606', 'usr-303', 'usr-707'];
      const next = cls.map((c, i) => {
        const date = nextSession(c).date;
        const total = Math.min(c.capacity, targets[i] ?? 6);
        const bookings: Record<string, string> = { ...c.bookings };
        // Named members first — insertion order drives the avatar preview.
        featured.forEach(uid => { bookings[uid] = date; });
        const anon = Math.max(0, total - featured.length);
        for (let k = 0; k < anon; k++) bookings[`demo-booker-${i}-${k}`] = date;
        return { ...c, bookings };
      });
      ClassService.save(next);
    } catch (e) {
      console.error('demoSeedService class bookings error', e);
    }
  },

  /** Auto-join the member into a couple of communities once, so the Mur bar isn't empty on day one. */
  ensureMemberships: async (userId: string): Promise<void> => {
    try {
      if ((await AsyncStorage.getItem(MEMBERSHIP_SEED_KEY)) === '1') return;
      await AsyncStorage.setItem(MEMBERSHIP_SEED_KEY, '1');
      await CommunitiesService.join('com-powerlifters', userId);
      await CommunitiesService.join('com-cardio', userId);
    } catch (e) {
      console.error('demoSeedService memberships error', e);
    }
  },
};
