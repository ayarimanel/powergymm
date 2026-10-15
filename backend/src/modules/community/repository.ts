import { and, asc, desc, eq, inArray, lt, sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../../shared/db/client.js';
import { postComments, postLikes, postReports, posts } from '../../shared/db/schema.js';

export type PostRow = typeof posts.$inferSelect;
export type CommentRow = typeof postComments.$inferSelect;
export type ReportRow = typeof postReports.$inferSelect;

export const communityRepository = (db: DbOrTx) => ({
  feed(gymId: string, opts: { limit: number; before?: Date; category?: PostRow['category']; authorId?: string }): Promise<PostRow[]> {
    const where: SQL[] = [eq(posts.gymId, gymId), eq(posts.status, 'published')];
    if (opts.before) where.push(lt(posts.createdAt, opts.before));
    if (opts.category) where.push(eq(posts.category, opts.category));
    if (opts.authorId) where.push(eq(posts.authorId, opts.authorId));
    return db.select().from(posts).where(and(...where)).orderBy(desc(posts.createdAt)).limit(opts.limit);
  },
  async byId(gymId: string, id: string): Promise<PostRow | undefined> {
    return (await db.select().from(posts).where(and(eq(posts.gymId, gymId), eq(posts.id, id), eq(posts.status, 'published'))))[0];
  },
  async insert(values: typeof posts.$inferInsert): Promise<PostRow> {
    return (await db.insert(posts).values(values).returning())[0]!;
  },
  async update(id: string, patch: Partial<typeof posts.$inferInsert>): Promise<PostRow> {
    return (await db.update(posts).set(patch).where(eq(posts.id, id)).returning())[0]!;
  },
  async likedBy(userId: string, postIds: string[]): Promise<Set<string>> {
    if (!postIds.length) return new Set();
    const rows = await db.select({ id: postLikes.postId }).from(postLikes)
      .where(and(eq(postLikes.userId, userId), inArray(postLikes.postId, postIds)));
    return new Set(rows.map(r => r.id));
  },
  /** Returns true when the like is new (so counts and notifications happen once). */
  async like(postId: string, userId: string): Promise<boolean> {
    const added = await db.insert(postLikes).values({ postId, userId }).onConflictDoNothing().returning({ id: postLikes.postId });
    if (added.length) await db.update(posts).set({ likesCount: sql`${posts.likesCount} + 1` }).where(eq(posts.id, postId));
    return added.length > 0;
  },
  async unlike(postId: string, userId: string): Promise<boolean> {
    const removed = await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId))).returning({ id: postLikes.postId });
    if (removed.length) await db.update(posts).set({ likesCount: sql`greatest(${posts.likesCount} - 1, 0)` }).where(eq(posts.id, postId));
    return removed.length > 0;
  },
  comments(postId: string): Promise<CommentRow[]> {
    return db.select().from(postComments).where(eq(postComments.postId, postId)).orderBy(asc(postComments.createdAt)).limit(500);
  },
  async addComment(values: typeof postComments.$inferInsert): Promise<CommentRow> {
    const row = (await db.insert(postComments).values(values).returning())[0]!;
    await db.update(posts).set({ commentsCount: sql`${posts.commentsCount} + 1` }).where(eq(posts.id, values.postId));
    return row;
  },
  async comment(id: string): Promise<CommentRow | undefined> {
    return (await db.select().from(postComments).where(eq(postComments.id, id)))[0];
  },
  async deleteComment(c: CommentRow): Promise<void> {
    await db.delete(postComments).where(eq(postComments.id, c.id));
    await db.update(posts).set({ commentsCount: sql`greatest(${posts.commentsCount} - 1, 0)` }).where(eq(posts.id, c.postId));
  },
  async report(values: typeof postReports.$inferInsert): Promise<void> {
    await db.insert(postReports).values(values).onConflictDoNothing();
  },
  openReports(gymId: string): Promise<ReportRow[]> {
    return db.select().from(postReports)
      .where(and(eq(postReports.gymId, gymId), eq(postReports.status, 'open')))
      .orderBy(desc(postReports.createdAt));
  },
  async closeReportsFor(postId: string, status: 'dismissed' | 'actioned'): Promise<void> {
    await db.update(postReports).set({ status }).where(and(eq(postReports.postId, postId), eq(postReports.status, 'open')));
  },
  postsByIds(ids: string[]): Promise<PostRow[]> {
    return ids.length ? db.select().from(posts).where(inArray(posts.id, ids)) : Promise.resolve([]);
  },
});
