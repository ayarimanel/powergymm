/**
 * In-process domain event bus: how modules react to each other without
 * importing each other's internals. Handlers run after the emitting request's
 * work is done and their failures are logged, never thrown back to the caller.
 *
 * To split a module into its own service later, replace this with a queue
 * (e.g. Postgres outbox + worker) and keep the same event names and payloads.
 */
import type { FastifyBaseLogger } from 'fastify';

export interface DomainEvents {
  'attendance.checked_in': { gymId: string; userId: string; checkInId: string; streak: number };
  'announcement.published': { gymId: string; announcementId: string; title: string; urgent: boolean; actorId: string };
  'coach.applied': { gymId: string; userId: string; fullName: string };
  'coach.reviewed': { gymId: string; userId: string; approved: boolean; actorId: string };
  'post.liked': { gymId: string; postId: string; authorId: string; actorId: string };
  'post.commented': { gymId: string; postId: string; authorId: string; actorId: string; text: string };
  'pr.validated': { gymId: string; postId: string; authorId: string; actorId: string; exercise: string; weightKg: number };
  'session.cancelled': { gymId: string; classId: string; title: string; date: string; reason: string; userIds: string[]; actorId: string };
  'reservation.ready': { gymId: string; reservationId: string; userId: string; productName: string; actorId: string };
  'membership.expiring': { gymId: string; userId: string; endsOn: string; daysLeft: number };
  /** Declared subscription about to run out: asks the member to confirm, never blocks him. */
  'subscription.renewal_due': { gymId: string; userId: string; endsAt: string; attempt: number };
}

export type EventName = keyof DomainEvents;
type Handler<K extends EventName> = (payload: DomainEvents[K]) => Promise<void> | void;

export class EventBus {
  private handlers = new Map<EventName, Handler<never>[]>();
  private pending = new Set<Promise<void>>();

  constructor(private log: Pick<FastifyBaseLogger, 'error'>) {}

  on<K extends EventName>(name: K, handler: Handler<K>): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(name, list);
  }

  emit<K extends EventName>(name: K, payload: DomainEvents[K]): void {
    for (const handler of this.handlers.get(name) ?? []) {
      const run = (async () => {
        try {
          await (handler as Handler<K>)(payload);
        } catch (err) {
          this.log.error({ err, event: name }, 'event handler failed');
        }
      })();
      this.pending.add(run);
      void run.finally(() => this.pending.delete(run));
    }
  }

  /** Wait for in-flight handlers (graceful shutdown, tests). */
  async drain(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }
}
