import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

const KEY = '@gym_app_club_status_v1';
// Owner news used to live in a separate "stories" store; it's folded into the club infos once.
const LEGACY_STORIES_KEYS = ['@gym_app_stories_v1', '@gym_app_story_views_v1', '@gym_app_demo_stories_seed_version'];

export type ClubStatusKind = 'info' | 'promo' | 'event' | 'coach' | 'cours' | 'aid' | 'iftar' | 'closure' | 'hours';

/** Announcement published by the gérant (any kind) or a coach (coach / cours / event), shown in the Floor news bar. */
export interface ClubStatus {
  id: string;
  kind: ClubStatusKind;
  title: string;
  message: string;
  /** Free text: "Aujourd’hui · 19:32", "Samedi 14 h"… */
  when?: string;
  createdAt: string;
  pinned?: boolean;
  /** "Gérant" or the coach's name. */
  author?: string;
  /** Button label shown when the item is expanded, e.g. "Réserver". */
  cta?: string;
  /** "shop" | "class:<id>" | "event:<id>" | "coach:<id>" | "url:<link>" */
  ctaAction?: string;
  /** Hidden from members after this date. */
  expiresAt?: string;
}

export const KIND_META: Record<ClubStatusKind, { label: string; icon: string; bg: string; fg: string }> = {
  info: { label: 'Info', icon: 'information-circle', bg: colors.brandSoft, fg: colors.brandDark },
  promo: { label: 'Promo', icon: 'pricetag', bg: colors.pink.soft, fg: colors.pink.text },
  event: { label: 'Événement', icon: 'calendar', bg: colors.amber.soft, fg: colors.amber.text },
  coach: { label: 'Coach', icon: 'person', bg: colors.violet.soft, fg: colors.violet.text },
  cours: { label: 'Cours', icon: 'time', bg: colors.teal.soft, fg: colors.teal.text },
  aid: { label: 'Aïd', icon: 'moon', bg: colors.gold.soft, fg: colors.gold.text },
  iftar: { label: 'Iftar', icon: 'restaurant', bg: colors.flameSoft, fg: colors.flameText },
  closure: { label: 'Fermeture', icon: 'close-circle', bg: colors.red.soft, fg: colors.red.text },
  hours: { label: 'Horaires', icon: 'time', bg: colors.brandSoft, fg: colors.brandDark },
};

export const KIND_ORDER: ClubStatusKind[] = ['info', 'promo', 'event', 'coach', 'cours', 'hours', 'closure', 'aid', 'iftar'];

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const DEFAULT_STATUSES: ClubStatus[] = [
  {
    id: 'st-1',
    kind: 'aid',
    title: 'Horaires spéciaux de l’Aïd',
    message: 'Le club ferme à 16 h le premier jour de l’Aïd. Horaires normaux dès le lendemain. Aïd Moubarak !',
    when: '1er jour · fermeture 16 h',
    createdAt: ago(20),
    pinned: true,
    author: 'Gérant',
  },
  {
    id: 'st-3',
    kind: 'promo',
    title: '-20 % sur les packs de 10 séances',
    message: 'Offre valable jusqu’à dimanche. Passe à l’accueil ou réserve en boutique avant la fin de la semaine.',
    createdAt: ago(2),
    author: 'Gérant',
    cta: 'Voir la boutique',
    ctaAction: 'shop',
    expiresAt: inDays(5),
  },
  {
    id: 'st-4',
    kind: 'cours',
    title: 'Nouveau cours : Yoga Flow',
    message: 'Tous les mardis 18 h 30 avec Coach Sonia. 15 places, réserve vite.',
    createdAt: ago(5),
    author: 'Coach Sonia',
    cta: 'Réserver',
    ctaAction: 'class:any',
  },
  {
    id: 'st-5',
    kind: 'coach',
    title: 'Bilan force offert',
    message: 'Coach Anis te fait un test de force gratuit cette semaine. Réserve un créneau à l’accueil.',
    createdAt: ago(9),
    author: 'Coach Anis',
    cta: 'Voir les coachs',
    ctaAction: 'coach:any',
  },
  {
    id: 'st-2',
    kind: 'event',
    title: 'Nouveaux racks à squat',
    message: 'Deux racks Eleiko viennent d’arriver dans la zone poids libres. Viens les tester !',
    createdAt: ago(72),
    author: 'Gérant',
  },
];

const read = async (): Promise<ClubStatus[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ClubStatus[]) : null;
  } catch {
    return null;
  }
};

const write = async (list: ClubStatus[]) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.error('clubStatusService write error', e);
  }
};

type LegacyStory = { id: string; type: string; title: string; body: string; startsAt: string; expiresAt: string; createdBy?: string };
const LEGACY_KIND: Record<string, ClubStatusKind> = { horaires: 'hours', evenement: 'event', coach: 'coach', cours: 'cours', promo: 'promo' };

/** One-time: turn still-active stories into club infos, then drop the old story keys. */
const migrateLegacyStories = async (list: ClubStatus[]): Promise<ClubStatus[]> => {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_STORIES_KEYS[0]);
    if (raw === null) return list;
    const now = Date.now();
    const stories = (JSON.parse(raw) as LegacyStory[]).filter(s => !s.id.startsWith('seed-story-') && new Date(s.expiresAt).getTime() > now);
    const known = new Set(list.map(s => s.id));
    const migrated: ClubStatus[] = stories
      .filter(s => !known.has(s.id))
      .map(s => ({ id: s.id, kind: LEGACY_KIND[s.type] ?? 'info', title: s.title, message: s.body, createdAt: s.startsAt, expiresAt: s.expiresAt, author: 'Gérant' }));
    const next = [...migrated, ...list];
    await write(next);
    await AsyncStorage.multiRemove(LEGACY_STORIES_KEYS);
    return next;
  } catch {
    return list;
  }
};

export const ClubStatusService = {
  getAll: async (): Promise<ClubStatus[]> => {
    const stored = await read();
    if (stored) return migrateLegacyStories(stored);
    await write(DEFAULT_STATUSES);
    return migrateLegacyStories(DEFAULT_STATUSES);
  },

  save: async (list: ClubStatus[]) => {
    await write(list);
    return list;
  },

  /** Demo data: add the sample announcements this device doesn't have yet. Never overwrites existing ones. */
  addMissingDefaults: async (): Promise<void> => {
    const list = await ClubStatusService.getAll();
    const ids = new Set(list.map(s => s.id));
    const missing = DEFAULT_STATUSES.filter(d => !ids.has(d.id));
    if (missing.length) await write([...missing, ...list]);
  },
};
