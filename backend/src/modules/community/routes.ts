import { z } from 'zod';
import { actorOf } from '../../shared/auth/plugin.js';
import { IdParam, Paging, type App } from '../../shared/http.js';
import type { CommunityService } from './service.js';

const Category = z.enum(['chat', 'workout', 'meal', 'pr', 'question']);

const NewPost = z.object({
  category: Category.default('chat'),
  caption: z.string().trim().max(2000).default(''),
  imageUrls: z.array(z.url()).max(6).default([]),
  pr: z.object({
    exercise: z.string().trim().min(2).max(60),
    weightKg: z.number().min(0).max(1000),
    reps: z.number().int().min(1).max(100),
    previousKg: z.number().min(0).max(1000).optional(),
  }).optional(),
  commentsDisabled: z.boolean().optional(),
  likesHidden: z.boolean().optional(),
});

const PostPatch = z.object({
  caption: z.string().trim().max(2000),
  commentsDisabled: z.boolean(),
  likesHidden: z.boolean(),
  resolved: z.boolean(),
}).partial();

export function communityRoutes(app: App, community: CommunityService) {
  const auth = { preHandler: app.requireActor };
  const tags = ['community'];

  app.get('/v1/posts', {
    ...auth,
    schema: { tags, querystring: Paging.extend({ category: Category.optional(), authorId: z.uuid().optional() }) },
  }, req => {
    const { before, ...rest } = req.query;
    return community.feed(actorOf(req), { ...rest, before: before ? new Date(before) : undefined });
  });

  app.post('/v1/posts', { ...auth, schema: { tags, body: NewPost } }, async (req, reply) =>
    reply.code(201).send(await community.publish(actorOf(req), req.body)));

  app.get('/v1/posts/:id', { ...auth, schema: { tags, params: IdParam } }, req => community.get(actorOf(req), req.params.id));

  app.patch('/v1/posts/:id', { ...auth, schema: { tags, params: IdParam, body: PostPatch } }, req =>
    community.update(actorOf(req), req.params.id, req.body));

  app.delete('/v1/posts/:id', { ...auth, schema: { tags, params: IdParam } }, async (req, reply) => {
    await community.remove(actorOf(req), req.params.id);
    return reply.code(204).send();
  });

  app.post('/v1/posts/:id/like', { ...auth, schema: { tags, params: IdParam } }, async (req, reply) => {
    await community.like(actorOf(req), req.params.id);
    return reply.code(204).send();
  });

  app.delete('/v1/posts/:id/like', { ...auth, schema: { tags, params: IdParam } }, async (req, reply) => {
    await community.unlike(actorOf(req), req.params.id);
    return reply.code(204).send();
  });

  app.get('/v1/posts/:id/comments', { ...auth, schema: { tags, params: IdParam } }, req =>
    community.comments(actorOf(req), req.params.id));

  app.post('/v1/posts/:id/comments', {
    ...auth,
    schema: { tags, params: IdParam, body: z.object({ text: z.string().trim().min(1).max(1000) }) },
  }, async (req, reply) => reply.code(201).send(await community.comment(actorOf(req), req.params.id, req.body.text)));

  app.delete('/v1/posts/:id/comments/:commentId', {
    ...auth,
    schema: { tags, params: IdParam.extend({ commentId: z.uuid() }) },
  }, async (req, reply) => {
    await community.deleteComment(actorOf(req), req.params.id, req.params.commentId);
    return reply.code(204).send();
  });

  app.post('/v1/posts/:id/report', {
    ...auth,
    schema: { tags, params: IdParam, body: z.object({ reason: z.string().trim().min(2).max(300) }) },
  }, async (req, reply) => {
    await community.report(actorOf(req), req.params.id, req.body.reason);
    return reply.code(204).send();
  });

  app.post('/v1/posts/:id/validate-pr', { ...auth, schema: { tags, params: IdParam } }, req =>
    community.validatePr(actorOf(req), req.params.id));

  app.get('/v1/moderation/reports', { ...auth, schema: { tags } }, req => community.reports(actorOf(req)));

  app.post('/v1/moderation/posts/:id/dismiss', { ...auth, schema: { tags, params: IdParam } }, async (req, reply) => {
    await community.dismissReports(actorOf(req), req.params.id);
    return reply.code(204).send();
  });
}
