import { randomBytes } from 'node:crypto';
import type { Db } from '../../shared/db/client.js';
import type { EventBus } from '../../shared/events/bus.js';
import { isOwner, requireOwner, requirePermission, type Actor } from '../../shared/auth/actor.js';
import { conflict, isUniqueViolation, notFound } from '../../shared/errors.js';
import { clubsRepository, type AnnouncementRow, type GymRow } from './repository.js';

export type GymSettings = Partial<Pick<GymRow,
  'name' | 'city' | 'logoUrl' | 'primaryColor' | 'openingHour' | 'closingHour' | 'maxCapacity' | 'classesEnabled' | 'enforceMemberships' | 'timezone'>>;

export interface NewAnnouncement {
  kind: AnnouncementRow['kind'];
  title: string;
  message: string;
  whenLabel?: string;
  urgent: boolean;
  startsAt?: Date;
  endsAt?: Date;
}

/** Door QR payload, e.g. GYM-7Q4K-M2XP. Unambiguous characters only (no 0/O, 1/I). */
export function newCheckInCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  const chars = [...bytes].map(b => alphabet[b % alphabet.length]).join('');
  return `GYM-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** What a gym looks like to its members; the door code is only shown to the admin. */
export function gymView(gym: GymRow, viewer: Actor) {
  const { checkInCode, ...rest } = gym;
  return isOwner(viewer) ? { ...rest, checkInCode } : rest;
}

export function createClubsService(db: Db, bus: EventBus) {
  const repo = clubsRepository(db);

  const getGym = async (gymId: string): Promise<GymRow> => {
    const gym = await repo.byId(gymId);
    if (!gym) throw notFound('Gym');
    return gym;
  };

  return {
    getGym,
    findBySlug: (slug: string) => repo.bySlug(slug),
    /** For scheduled jobs that walk every club. */
    allGyms: () => repo.all(),
    /** Timezone and currency for the owner's analytics. */
    byId: (gymId: string) => repo.byId(gymId),

    /** Used by identity's first-admin setup, inside its transaction. */
    async createGym(tx: Parameters<typeof clubsRepository>[0], input: { name: string; slug: string; city?: string }): Promise<GymRow> {
      try {
        return await clubsRepository(tx).insert({ ...input, checkInCode: newCheckInCode() });
      } catch (e) {
        if (isUniqueViolation(e)) throw conflict('slug_taken', 'That club link is already taken. Pick another one.');
        throw e;
      }
    },

    async updateSettings(actor: Actor, patch: GymSettings) {
      requireOwner(actor);
      return gymView(await repo.update(actor.gymId, patch), actor);
    },

    async rotateCheckInCode(actor: Actor): Promise<string> {
      requireOwner(actor);
      return (await repo.update(actor.gymId, { checkInCode: newCheckInCode() })).checkInCode;
    },

    /** Public API for attendance: is this the code printed at this gym's door right now? */
    async verifyCheckInCode(gymId: string, code: string): Promise<boolean> {
      const gym = await getGym(gymId);
      return gym.checkInCode === code.trim().toUpperCase();
    },

    listAnnouncements: (actor: Actor) => repo.listAnnouncements(actor.gymId, new Date()),

    async publishAnnouncement(actor: Actor, input: NewAnnouncement): Promise<AnnouncementRow> {
      requirePermission(actor, 'manage_announcements');
      const row = await repo.insertAnnouncement({ ...input, gymId: actor.gymId, createdBy: actor.id });
      bus.emit('announcement.published', { gymId: actor.gymId, announcementId: row.id, title: row.title, urgent: row.urgent, actorId: actor.id });
      return row;
    },

    async deleteAnnouncement(actor: Actor, id: string): Promise<void> {
      requirePermission(actor, 'manage_announcements');
      if (!(await repo.deleteAnnouncement(actor.gymId, id))) throw notFound('Announcement');
    },
  };
}

export type ClubsService = ReturnType<typeof createClubsService>;
