import { createHash, timingSafeEqual } from 'node:crypto';
import type { Db } from '../../shared/db/client.js';
import { requireOwner, type Actor, type Permission, type Role } from '../../shared/auth/actor.js';
import { AppError, badRequest, conflict, forbidden, isUniqueViolation, notFound } from '../../shared/errors.js';
import type { ClubsService } from '../clubs/index.js';
import { identityRepository, type NewProfile, type ProfileRow } from './repository.js';

export interface ProfileInput {
  fullName: string;
  gender?: 'male' | 'female' | null;
  birthYear?: number | null;
  goal?: string | null;
  trainingSlot?: 'morning' | 'afternoon' | 'evening' | null;
  usualMuscles?: string[];
  whatsapp?: string | null;
}

export interface ProfileSummary {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
}

const summary = (p: ProfileRow): ProfileSummary => ({ id: p.id, fullName: p.fullName, avatarUrl: p.avatarUrl, role: p.role });

const sameSecret = (a: string, b: string) => {
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(a), h(b));
};

export function createIdentityService(db: Db, clubs: ClubsService, opts: { setupToken?: string }) {
  const repo = identityRepository(db);

  const ensureNoProfile = async (userId: string) => {
    if (await repo.byId(userId)) throw conflict('already_onboarded', 'Your profile already exists.');
  };

  const insertProfile = async (r: ReturnType<typeof identityRepository>, values: NewProfile) => {
    try {
      return await r.insert(values);
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict('already_onboarded', 'Your profile already exists.');
      throw e;
    }
  };

  return {
    async loadActor(userId: string): Promise<Actor | null> {
      const p = await repo.byId(userId);
      if (!p) return null;
      const perms = p.role === 'member' || p.role === 'coach' ? await repo.permissionsOf(userId) : [];
      return { id: p.id, gymId: p.gymId, role: p.role, fullName: p.fullName, permissions: new Set(perms) };
    },

    async me(actor: Actor) {
      const p = await repo.byId(actor.id);
      if (!p) throw notFound('Profile');
      return { ...p, permissions: [...actor.permissions] };
    },

    /** A signed-in user joins a gym as a member. Coaches apply afterwards through coaching. */
    async onboard(userId: string, gymSlug: string, input: ProfileInput): Promise<ProfileRow> {
      await ensureNoProfile(userId);
      const gym = await clubs.findBySlug(gymSlug);
      if (!gym) throw badRequest('unknown_gym', 'No club uses this link. Check it with your gym.');
      return insertProfile(repo, { ...input, id: userId, gymId: gym.id, role: 'member' });
    },

    /**
     * Creates a new club and its first admin in one step. Guarded by SETUP_TOKEN,
     * which replaces the old device-local owner PIN nobody could see.
     */
    async setupGym(userId: string, token: string, gym: { name: string; slug: string; city?: string }, owner: ProfileInput) {
      if (!opts.setupToken || !sameSecret(token, opts.setupToken)) throw forbidden('Invalid setup token.');
      await ensureNoProfile(userId);
      return db.transaction(async tx => {
        const created = await clubs.createGym(tx, gym);
        const profile = await insertProfile(identityRepository(tx), { ...owner, id: userId, gymId: created.id, role: 'owner' });
        return { gym: created, profile };
      });
    },

    async updateMe(actor: Actor, patch: Partial<ProfileInput> & { avatarUrl?: string | null; bio?: string | null }) {
      return repo.update(actor.id, patch);
    },

    async listStaff(actor: Actor) {
      requireOwner(actor);
      const rows = await repo.staff(actor.gymId);
      const byUser = new Map<string, Permission[]>();
      for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.permission]);
      return [...byUser].map(([userId, permissions]) => ({ userId, permissions }));
    },

    async setPermissions(actor: Actor, userId: string, permissions: Permission[]) {
      requireOwner(actor);
      const target = await repo.byId(userId);
      if (!target || target.gymId !== actor.gymId) throw notFound('Member');
      if (target.role === 'owner') throw badRequest('owner_has_all', 'Admins already have every permission.');
      await repo.replacePermissions(userId, actor.gymId, [...new Set(permissions)], actor.id);
      return { userId, permissions: await repo.permissionsOf(userId) };
    },

    /** Promote to co-admin or step back to member. Coach status goes through coaching review instead. */
    async setRoleByAdmin(actor: Actor, userId: string, role: 'member' | 'owner') {
      requireOwner(actor);
      const target = await repo.byId(userId);
      if (!target || target.gymId !== actor.gymId) throw notFound('Member');
      if (target.role === 'owner' && role !== 'owner' && (await repo.countOwners(actor.gymId)) <= 1) {
        throw new AppError(409, 'last_owner', 'A club needs at least one admin. Promote someone else first.');
      }
      return repo.update(userId, { role });
    },

    // ── public API for other modules ──

    /** Owner analytics: counts only, never a member list. */
    signupsBetween: (gymId: string, from: Date, to: Date) => repo.signupsBetween(gymId, from, to),
    totalMembers: (gymId: string) => repo.totalMembers(gymId),

    async summaries(ids: string[]): Promise<Map<string, ProfileSummary>> {
      const rows = await repo.byIds([...new Set(ids)]);
      return new Map(rows.map(r => [r.id, summary(r)]));
    },
    async profile(id: string) {
      return repo.byId(id);
    },
    async profilesByIds(ids: string[]): Promise<Map<string, ProfileRow>> {
      return new Map((await repo.byIds([...new Set(ids)])).map(r => [r.id, r]));
    },
    membersOf: (gymId: string) => repo.inGym(gymId),
    idsAllowedTo: (gymId: string, permission: Permission) => repo.idsAllowedTo(gymId, permission),
    /** Used by coaching once an application is approved or revoked. */
    async setCoachRole(userId: string, isCoach: boolean): Promise<void> {
      const p = await repo.byId(userId);
      if (!p || p.role === 'owner') return; // admins who coach keep their admin role
      await repo.update(userId, { role: isCoach ? 'coach' : 'member' });
    },
  };
}

export type IdentityService = ReturnType<typeof createIdentityService>;
