import type { Db } from '../../shared/db/client.js';
import type { EventBus } from '../../shared/events/bus.js';
import type { Actor } from '../../shared/auth/actor.js';
import type { IdentityService } from '../identity/index.js';
import type { PushSender } from './push.js';
import { notificationsRepository } from './repository.js';

interface Notice {
  gymId: string;
  recipients: string[];
  actorId?: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

const frDate = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

export function createNotificationsService(db: Db, bus: EventBus, deps: { identity: IdentityService; push: PushSender }) {
  const repo = notificationsRepository(db);

  /** Stores an in-app notification for each recipient (never the actor) and pushes it to their devices. */
  async function notify(n: Notice): Promise<void> {
    const recipients = [...new Set(n.recipients)].filter(id => id !== n.actorId);
    if (!recipients.length) return;
    await repo.insertMany(recipients.map(recipientId => ({
      gymId: n.gymId, recipientId, actorId: n.actorId ?? null, type: n.type, title: n.title, body: n.body ?? '', data: n.data ?? {},
    })));
    const devices = await repo.tokensFor(recipients);
    if (!devices.length) return;
    const { invalidTokens } = await deps.push.send(devices.map(d => ({
      to: d.token, title: n.title, body: n.body ?? '', data: { type: n.type, ...n.data },
    })));
    await repo.deleteTokens(invalidTokens);
  }

  const nameOf = async (id: string) => (await deps.identity.profile(id))?.fullName ?? "Quelqu'un";

  // ── what each domain event means to people ──

  bus.on('post.liked', async e => notify({
    gymId: e.gymId, recipients: [e.authorId], actorId: e.actorId, type: 'post.liked',
    title: `${await nameOf(e.actorId)} a aimé ta publication`, data: { postId: e.postId },
  }));

  bus.on('post.commented', async e => notify({
    gymId: e.gymId, recipients: [e.authorId], actorId: e.actorId, type: 'post.commented',
    title: `${await nameOf(e.actorId)} a commenté ta publication`, body: e.text.slice(0, 140), data: { postId: e.postId },
  }));

  bus.on('pr.validated', async e => notify({
    gymId: e.gymId, recipients: [e.authorId], actorId: e.actorId, type: 'pr.validated',
    title: `🏆 ${await nameOf(e.actorId)} a validé ton record`, body: `${e.weightKg} kg · ${e.exercise}`, data: { postId: e.postId },
  }));

  bus.on('coach.applied', async e => notify({
    gymId: e.gymId, recipients: await deps.identity.idsAllowedTo(e.gymId, 'manage_coaches'), actorId: e.userId, type: 'coach.applied',
    title: 'Nouvelle candidature coach', body: `${e.fullName} veut rejoindre l’équipe des coachs.`, data: { userId: e.userId },
  }));

  bus.on('coach.reviewed', e => notify({
    gymId: e.gymId, recipients: [e.userId], actorId: e.actorId, type: 'coach.reviewed',
    title: e.approved ? 'Ton profil coach est en ligne 🎉' : 'Candidature coach refusée',
    body: e.approved ? 'Les membres peuvent maintenant te contacter.' : 'Parle avec l’administrateur du club pour en savoir plus.',
  }));

  bus.on('session.cancelled', e => notify({
    gymId: e.gymId, recipients: e.userIds, actorId: e.actorId, type: 'session.cancelled',
    title: `Séance annulée : ${e.title}, ${frDate(e.date)}`, body: e.reason, data: { classId: e.classId, date: e.date },
  }));

  bus.on('reservation.ready', e => notify({
    gymId: e.gymId, recipients: [e.userId], actorId: e.actorId, type: 'reservation.ready',
    title: 'Ta commande est prête', body: `${e.productName} t’attend à l’accueil.`, data: { reservationId: e.reservationId },
  }));

  bus.on('subscription.renewal_due', e => notify({
    gymId: e.gymId, recipients: [e.userId], type: 'subscription.renewal_due',
    title: 'Ton abonnement se termine ces jours-ci',
    body: 'Déjà renouvelé ?', data: { endsAt: e.endsAt, attempt: e.attempt },
  }));

  bus.on('membership.expiring', e => notify({
    gymId: e.gymId, recipients: [e.userId], type: 'membership.expiring',
    title: e.daysLeft === 1 ? 'Ton abonnement se termine demain' : `Ton abonnement se termine dans ${e.daysLeft} jours`,
    body: 'Renouvelle-le à l’accueil pour continuer à t’entraîner.', data: { endsOn: e.endsOn },
  }));

  bus.on('announcement.published', async e => {
    if (!e.urgent) return; // regular announcements just appear on the Floor screen
    const members = await deps.identity.membersOf(e.gymId);
    await notify({ gymId: e.gymId, recipients: members.map(m => m.id), actorId: e.actorId, type: 'announcement', title: e.title, data: { announcementId: e.announcementId } });
  });

  return {
    notify,

    async list(actor: Actor, opts: { limit: number; before?: Date }) {
      const [items, unread] = await Promise.all([repo.list(actor.id, opts), repo.unreadCount(actor.id)]);
      return { unread, items };
    },

    markRead: (actor: Actor, ids?: string[]) => repo.markRead(actor.id, ids),

    registerDevice: (actor: Actor, token: string, platform: 'ios' | 'android' | 'web') => repo.upsertDevice(actor.id, token, platform),

    unregisterDevice: (actor: Actor, token: string) => repo.deleteTokens([token], actor.id),
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
