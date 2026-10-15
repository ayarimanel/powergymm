import type { Db } from '../../shared/db/client.js';
import type { EventBus } from '../../shared/events/bus.js';
import { can, requirePermission, type Actor } from '../../shared/auth/actor.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../shared/errors.js';
import { addDays, daysBetween, localDay, localTime, localWeekday, weekdayOf } from '../../shared/time.js';
import type { ClubsService } from '../clubs/index.js';
import type { IdentityService } from '../identity/index.js';
import { classesRepository, type ClassRow } from './repository.js';

/** Members can book up to two weeks ahead. */
export const BOOKING_WINDOW_DAYS = 14;

export interface ClassInput {
  title: string;
  coachId?: string | null;
  weekday: number;
  startTime: string; // HH:MM
  durationMin: number;
  capacity: number;
}

const hhmm = (t: string) => t.slice(0, 5);

/** Date of the next occurrence of a weekly class that has not started yet. */
export function nextSessionDate(weekday: number, startTime: string, now: Date, timeZone: string): string {
  const today = localDay(now, timeZone);
  const todayWd = localWeekday(now, timeZone);
  let ahead = (weekday - todayWd + 7) % 7;
  if (ahead === 0 && localTime(now, timeZone) >= hhmm(startTime)) ahead = 7;
  return addDays(today, ahead);
}

export type MembershipGate = (gymId: string, userId: string) => Promise<boolean>;

export function createClassesService(db: Db, bus: EventBus, deps: { clubs: ClubsService; identity: IdentityService; hasActiveMembership: MembershipGate }) {
  const repo = classesRepository(db);

  const loadClass = async (actor: Actor, id: string): Promise<ClassRow> => {
    const c = await repo.byId(actor.gymId, id);
    if (!c || !c.active) throw notFound('Class');
    return c;
  };

  const assertCoachInGym = async (actor: Actor, coachId: string | null | undefined) => {
    if (!coachId) return;
    const coach = await deps.identity.profile(coachId);
    if (!coach || coach.gymId !== actor.gymId || coach.role === 'member') throw badRequest('invalid_coach', 'Pick a coach from your club.');
  };

  /** Checks that `date` is a real, future, bookable occurrence of the class. */
  const assertBookableDate = (c: ClassRow, date: string, now: Date, tz: string) => {
    const today = localDay(now, tz);
    if (weekdayOf(date) !== c.weekday) throw badRequest('wrong_day', 'This class does not run on that day.');
    const ahead = daysBetween(today, date);
    if (ahead < 0 || (ahead === 0 && localTime(now, tz) >= hhmm(c.startTime))) throw badRequest('session_past', 'This session has already started.');
    if (ahead >= BOOKING_WINDOW_DAYS) throw badRequest('too_early', `Bookings open ${BOOKING_WINDOW_DAYS} days before the class.`);
  };

  return {
    /** The weekly schedule, each class with its next session and whether I'm in it. */
    async schedule(actor: Actor) {
      const gym = await deps.clubs.getGym(actor.gymId);
      const now = new Date();
      const classes = await repo.activeInGym(gym.id);
      const sessions = await repo.upcomingSessions(classes.map(c => c.id), localDay(now, gym.timezone));
      const sessionIds = sessions.map(s => s.id);
      const [counts, mine, coaches] = await Promise.all([
        repo.bookingCounts(sessionIds),
        repo.bookedBy(actor.id, sessionIds),
        deps.identity.summaries(classes.map(c => c.coachId).filter((x): x is string => !!x)),
      ]);

      return classes.map(c => {
        const date = nextSessionDate(c.weekday, c.startTime, now, gym.timezone);
        const s = sessions.find(x => x.classId === c.id && x.sessionDate === date);
        const booked = s ? counts.get(s.id) ?? 0 : 0;
        return {
          ...c,
          startTime: hhmm(c.startTime),
          coach: c.coachId ? coaches.get(c.coachId) ?? null : null,
          next: {
            date,
            status: s?.status ?? 'scheduled',
            cancelReason: s?.cancelReason ?? null,
            booked,
            spotsLeft: Math.max(0, c.capacity - booked),
            bookedByMe: s ? mine.has(s.id) : false,
          },
        };
      });
    },

    async create(actor: Actor, input: ClassInput) {
      requirePermission(actor, 'manage_classes');
      await assertCoachInGym(actor, input.coachId);
      return repo.insert({ ...input, gymId: actor.gymId });
    },

    async update(actor: Actor, id: string, patch: Partial<ClassInput>) {
      requirePermission(actor, 'manage_classes');
      await loadClass(actor, id);
      await assertCoachInGym(actor, patch.coachId);
      return repo.update(id, patch);
    },

    async archive(actor: Actor, id: string) {
      requirePermission(actor, 'manage_classes');
      await loadClass(actor, id);
      await repo.update(id, { active: false });
    },

    async book(actor: Actor, classId: string, date: string) {
      const gym = await deps.clubs.getGym(actor.gymId);
      if (!gym.classesEnabled) throw forbidden('Group classes are turned off in this club.');
      const c = await loadClass(actor, classId);
      assertBookableDate(c, date, new Date(), gym.timezone);
      if (gym.enforceMemberships && !(await deps.hasActiveMembership(gym.id, actor.id))) {
        throw new AppError(402, 'membership_expired', 'Your membership has ended. Renew it at the front desk.');
      }

      return db.transaction(async tx => {
        const r = classesRepository(tx);
        const session = await r.lockSession(gym.id, c.id, date);
        if (session.status === 'cancelled') throw conflict('session_cancelled', `This session is cancelled: ${session.cancelReason ?? ''}`.trim());
        const taken = await r.countBookings(session.id);
        if (taken >= c.capacity) throw conflict('class_full', 'This class is full.');
        await r.book(session.id, actor.id, gym.id);
        const booked = await r.countBookings(session.id);
        return { date, booked, spotsLeft: Math.max(0, c.capacity - booked), bookedByMe: true };
      });
    },

    async unbook(actor: Actor, classId: string, date: string) {
      const c = await loadClass(actor, classId);
      const session = await repo.findSession(c.id, date);
      if (!session || !(await repo.unbook(session.id, actor.id))) throw notFound('Booking');
    },

    /** The class's own coach or schedule managers can cancel one occurrence, with a reason members see. */
    async cancelSession(actor: Actor, classId: string, date: string, reason: string) {
      const c = await loadClass(actor, classId);
      if (c.coachId !== actor.id && !can(actor, 'manage_classes')) throw forbidden();
      const gym = await deps.clubs.getGym(actor.gymId);
      if (weekdayOf(date) !== c.weekday || date < localDay(new Date(), gym.timezone)) throw badRequest('wrong_day', 'Pick an upcoming date of this class.');

      const { session, userIds } = await db.transaction(async tx => {
        const r = classesRepository(tx);
        const locked = await r.lockSession(gym.id, c.id, date);
        return { session: await r.cancel(locked.id, reason, actor.id), userIds: await r.bookedUserIds(locked.id) };
      });
      bus.emit('session.cancelled', { gymId: gym.id, classId: c.id, title: c.title, date, reason, userIds, actorId: actor.id });
      return session;
    },
  };
}

export type ClassesService = ReturnType<typeof createClassesService>;
