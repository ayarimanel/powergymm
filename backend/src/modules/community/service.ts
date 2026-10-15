import type { Db } from '../../shared/db/client.js';
import type { PrDetails } from '../../shared/db/schema.js';
import type { EventBus } from '../../shared/events/bus.js';
import { can, isOwner, requireOwner, requirePermission, type Actor } from '../../shared/auth/actor.js';
import { badRequest, conflict, forbidden, notFound } from '../../shared/errors.js';
import type { IdentityService } from '../identity/index.js';
import { communityRepository, type PostRow } from './repository.js';

export interface NewPost {
  category: PostRow['category'];
  caption: string;
  imageUrls: string[];
  pr?: PrDetails;
  commentsDisabled?: boolean;
  likesHidden?: boolean;
}

export type PostPatch = Partial<Pick<PostRow, 'caption' | 'commentsDisabled' | 'likesHidden' | 'resolved'>>;

export function createCommunityService(db: Db, bus: EventBus, deps: { identity: IdentityService }) {
  const repo = communityRepository(db);

  const load = async (actor: Actor, id: string) => {
    const post = await repo.byId(actor.gymId, id);
    if (!post) throw notFound('Post');
    return post;
  };

  /** Shape posts for one viewer: author card, my like, hidden counts, what I may do. */
  const present = async (actor: Actor, rows: PostRow[]) => {
    const [people, liked] = await Promise.all([
      deps.identity.summaries(rows.flatMap(p => (p.prValidatedBy ? [p.authorId, p.prValidatedBy] : [p.authorId]))),
      repo.likedBy(actor.id, rows.map(p => p.id)),
    ]);
    return rows.map(p => {
      const mine = p.authorId === actor.id;
      return {
        ...p,
        likesCount: p.likesHidden && !mine ? null : p.likesCount,
        author: people.get(p.authorId) ?? null,
        prValidatedByName: p.prValidatedBy ? people.get(p.prValidatedBy)?.fullName ?? null : null,
        likedByMe: liked.has(p.id),
        canDelete: mine || isOwner(actor),
        canValidatePr: p.category === 'pr' && !p.prValidatedBy && !mine && can(actor, 'validate_records'),
      };
    });
  };

  return {
    async feed(actor: Actor, opts: { limit: number; before?: Date; category?: PostRow['category']; authorId?: string }) {
      return present(actor, await repo.feed(actor.gymId, opts));
    },

    async get(actor: Actor, id: string) {
      return (await present(actor, [await load(actor, id)]))[0];
    },

    async publish(actor: Actor, input: NewPost) {
      if (input.category === 'pr' && !input.pr) throw badRequest('pr_details_required', 'Add the exercise, weight and reps of your record.');
      if (!input.caption.trim() && !input.imageUrls.length && !input.pr) throw badRequest('empty_post', 'Write something or add a photo.');
      const row = await repo.insert({ ...input, pr: input.category === 'pr' ? input.pr : null, gymId: actor.gymId, authorId: actor.id });
      return (await present(actor, [row]))[0];
    },

    async update(actor: Actor, id: string, patch: PostPatch) {
      const post = await load(actor, id);
      if (post.authorId !== actor.id) throw forbidden('Only the author can edit this post.');
      return (await present(actor, [await repo.update(id, patch)]))[0];
    },

    async remove(actor: Actor, id: string) {
      const post = await load(actor, id);
      if (post.authorId !== actor.id && !isOwner(actor)) throw forbidden();
      await repo.update(id, { status: 'removed' });
      if (isOwner(actor)) await repo.closeReportsFor(id, 'actioned');
    },

    async like(actor: Actor, id: string) {
      const post = await load(actor, id);
      const added = await db.transaction(tx => communityRepository(tx).like(id, actor.id));
      if (added && post.authorId !== actor.id) {
        bus.emit('post.liked', { gymId: actor.gymId, postId: id, authorId: post.authorId, actorId: actor.id });
      }
    },

    async unlike(actor: Actor, id: string) {
      await load(actor, id);
      await db.transaction(tx => communityRepository(tx).unlike(id, actor.id));
    },

    async comments(actor: Actor, id: string) {
      await load(actor, id);
      const rows = await repo.comments(id);
      const people = await deps.identity.summaries(rows.map(c => c.authorId));
      return rows.map(c => ({ ...c, author: people.get(c.authorId) ?? null, canDelete: c.authorId === actor.id || isOwner(actor) }));
    },

    async comment(actor: Actor, id: string, text: string) {
      const post = await load(actor, id);
      if (post.commentsDisabled) throw forbidden('Comments are turned off on this post.');
      const row = await db.transaction(tx => communityRepository(tx).addComment({ postId: id, gymId: actor.gymId, authorId: actor.id, text }));
      if (post.authorId !== actor.id) {
        bus.emit('post.commented', { gymId: actor.gymId, postId: id, authorId: post.authorId, actorId: actor.id, text });
      }
      return row;
    },

    async deleteComment(actor: Actor, postId: string, commentId: string) {
      await load(actor, postId);
      const c = await repo.comment(commentId);
      if (!c || c.postId !== postId) throw notFound('Comment');
      if (c.authorId !== actor.id && !isOwner(actor)) throw forbidden();
      await db.transaction(tx => communityRepository(tx).deleteComment(c));
    },

    async report(actor: Actor, id: string, reason: string) {
      const post = await load(actor, id);
      if (post.authorId === actor.id) throw badRequest('own_post', 'You cannot report your own post.');
      await repo.report({ postId: id, gymId: actor.gymId, reporterId: actor.id, reason });
    },

    /** Admin moderation queue: one entry per reported post, with every reason given. */
    async reports(actor: Actor) {
      requireOwner(actor);
      const open = await repo.openReports(actor.gymId);
      const postIds = [...new Set(open.map(r => r.postId))];
      const rows = (await repo.postsByIds(postIds)).filter(p => p.status === 'published');
      const presented = await present(actor, rows);
      return presented.map(p => ({ post: p, reasons: open.filter(r => r.postId === p.id).map(r => r.reason) }));
    },

    async dismissReports(actor: Actor, id: string) {
      requireOwner(actor);
      await repo.closeReportsFor(id, 'dismissed');
    },

    async validatePr(actor: Actor, id: string) {
      requirePermission(actor, 'validate_records');
      const post = await load(actor, id);
      if (post.category !== 'pr' || !post.pr) throw badRequest('not_a_record', 'Only personal records can be validated.');
      if (post.authorId === actor.id) throw forbidden('Someone else has to validate your record.');
      if (post.prValidatedBy) throw conflict('already_validated', 'This record is already validated.');
      const row = await repo.update(id, { prValidatedBy: actor.id, prValidatedAt: new Date() });
      bus.emit('pr.validated', { gymId: actor.gymId, postId: id, authorId: post.authorId, actorId: actor.id, exercise: post.pr.exercise, weightKg: post.pr.weightKg });
      return (await present(actor, [row]))[0];
    },
  };
}

export type CommunityService = ReturnType<typeof createCommunityService>;
