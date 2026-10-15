import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { IdParam, Muscle, type App } from '../../shared/http.js';
import type { JournalService } from './service.js';

/** The phone may send "32,5" if the member saved right after typing. */
const Num = z.preprocess(v => (typeof v === 'string' ? (v.trim() === '' ? 0 : Number(v.replace(',', '.'))) : v), z.number().min(0).finite());

const SetBody = z.object({
  kg: Num.optional(),
  reps: Num.optional(),
  min: Num.optional(),
  km: Num.optional(),
  done: z.boolean().optional(),
  legacy: z.boolean().optional(),
});

const WorkoutBody = z.object({
  date: z.coerce.date(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullish(),
  live: z.boolean().optional(),
  migrated: z.boolean().optional(),
  exercises: z
    .array(z.object({ exerciseId: z.string().min(1).max(64), muscle: Muscle.nullish(), sets: z.array(SetBody).max(50) }))
    .max(40),
});

const CustomBody = z.object({
  muscle: Muscle,
  name: z.string().trim().min(2).max(40),
  kind: z.enum(['weight', 'body', 'cardio']),
});

export function journalRoutes(app: App, journal: JournalService) {
  const auth = { preHandler: app.requireActor };
  const tags = ['journal'];

  app.get('/v1/journal/workouts', {
    ...auth,
    schema: { tags, querystring: z.object({ days: z.coerce.number().int().min(1).max(730).default(120) }) },
  }, req => journal.workouts(actorOf(req), req.query.days));

  app.put('/v1/journal/workouts/:id', {
    ...auth,
    schema: { tags, params: IdParam, body: WorkoutBody },
  }, req => journal.saveWorkout(actorOf(req), req.params.id, req.body));

  app.delete('/v1/journal/workouts/:id', { ...auth, schema: { tags, params: IdParam } }, async (req, reply) => {
    await journal.deleteWorkout(actorOf(req), req.params.id);
    return reply.code(204).send();
  });

  app.get('/v1/journal/exercises/mine', { ...auth, schema: { tags } }, req => journal.customExercises(actorOf(req)));

  app.put('/v1/journal/exercises/mine/:id', {
    ...auth,
    schema: { tags, params: IdParam, body: CustomBody },
  }, req => journal.saveCustomExercise(actorOf(req), req.params.id, req.body));

  app.delete('/v1/journal/exercises/mine/:id', { ...auth, schema: { tags, params: IdParam } }, async (req, reply) => {
    await journal.deleteCustomExercise(actorOf(req), req.params.id);
    return reply.code(204).send();
  });

  app.get('/v1/journal/summary', { ...auth, schema: { tags } }, req => journal.summary(actorOf(req)));
}
