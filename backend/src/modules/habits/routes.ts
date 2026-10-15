import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import type { App } from '../../shared/http.js';
import type { HabitsService } from './service.js';

const Slot = z.enum(['early', 'morning', 'noon', 'afternoon', 'evening', 'late', 'varies']);
const Style = z.enum(['split', 'upper_lower', 'full_body', 'cardio', 'classes', 'beginner']);
const Muscle = z.enum(['pecs', 'dos', 'jambes', 'epaules', 'bras', 'abdos', 'cardio']);
const Duration = z.enum(['1m', '3m', '6m', '1y', 'pass']);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

/** Exactly the fields a member may set about himself: no gymId, no userId, no role. */
const ProfilePatch = z
  .object({
    usualDays: z.array(z.number().int().min(0).max(6)).max(7).nullable(),
    usualDaysVaries: z.boolean(),
    usualSlot: Slot.nullable(),
    trainingStyle: Style.nullable(),
    focusMuscles: z.array(Muscle).max(7),
    subscriptionPaidAt: Day.nullable(),
    subscriptionPaidAtSource: z.enum(['estimate', 'confirmed']).nullable(),
    subscriptionPaidAtMarginDays: z.number().int().min(0).max(60),
    subscriptionDuration: Duration.nullable(),
    subscriptionEndsAt: Day.nullable(),
    onboardingStatus: z.enum(['new', 'partial', 'done', 'snoozed']),
    onboardingSnoozeCount: z.number().int().min(0).max(5),
    onboardingNextAt: Day.nullable(),
  })
  .partial();

export function habitsRoutes(app: App, habits: HabitsService) {
  const auth = { preHandler: app.requireActor };

  app.get('/v1/me/profile', { ...auth, schema: { tags: ['habits'] } }, req => habits.mine(actorOf(req)));

  app.patch('/v1/me/profile', { ...auth, schema: { tags: ['habits'], body: ProfilePatch } }, req =>
    habits.patchMine(actorOf(req), req.body));

  app.post(
    '/v1/me/subscription/renewed',
    { ...auth, schema: { tags: ['habits'], body: z.object({ duration: Duration }) } },
    req => habits.confirmRenewal(actorOf(req), req.body.duration)
  );

  app.post('/v1/me/onboarding/snooze', { ...auth, schema: { tags: ['habits'] } }, req => habits.snooze(actorOf(req)));

  // Owner only, and aggregates only: the service rejects anyone else.
  app.get('/v1/owner/subscriptions/summary', { ...auth, schema: { tags: ['habits'] } }, req =>
    habits.ownerSummary(actorOf(req)));
}
