import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClubStatus, ClubStatusKind } from './clubStatusService';

export type NewsType = 'info' | 'promo' | 'event' | 'coach' | 'cours';

export interface NewsItem {
  id: string;
  type: NewsType;
  title: string;
  text: string;
  /** When the thing happens ("Samedi 10 h"), as written by the author. */
  when?: string;
  /** When it was posted, already formatted: "il y a 2 h". */
  date: string;
  pinned: boolean;
  author: string;
  cta?: string;
  ctaAction?: string;
  read: boolean;
}

const READ_KEY = '@gym_app_news_read_v1';
const MAX_ITEMS = 20;
const MAX_READ_IDS = 200;

const TYPE_OF: Record<ClubStatusKind, NewsType> = {
  info: 'info',
  promo: 'promo',
  event: 'event',
  coach: 'coach',
  cours: 'cours',
  aid: 'info',
  iftar: 'info',
  closure: 'info',
  hours: 'info',
};

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const timeAgo = (iso: string, now = Date.now()): string => {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'hier';
  if (d < 7) return `il y a ${d} j`;
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

/** Active announcements for members: not expired, pinned first then newest, max 20. */
export const toNews = (statuses: ClubStatus[], readIds: Set<string>, now = Date.now()): NewsItem[] =>
  statuses
    .filter(s => !s.expiresAt || new Date(s.expiresAt).getTime() > now)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ITEMS)
    .map(s => ({
      id: s.id,
      type: TYPE_OF[s.kind] ?? 'info',
      title: s.title,
      text: s.message,
      when: s.when,
      date: timeAgo(s.createdAt, now),
      pinned: !!s.pinned,
      author: s.author || 'Gérant',
      cta: s.cta,
      ctaAction: s.ctaAction,
      read: readIds.has(s.id),
    }));

const readAll = async (): Promise<Record<string, string[]>> => {
  try {
    const raw = await AsyncStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
};

export const ClubNewsService = {
  getRead: async (userId: string): Promise<Set<string>> => new Set((await readAll())[userId] ?? []),

  markRead: async (userId: string, ids: string[]): Promise<Set<string>> => {
    const all = await readAll();
    const merged = [...new Set([...(all[userId] ?? []), ...ids])].slice(-MAX_READ_IDS);
    try {
      await AsyncStorage.setItem(READ_KEY, JSON.stringify({ ...all, [userId]: merged }));
    } catch (e) {
      console.error('clubNewsService markRead error', e);
    }
    return new Set(merged);
  },
};
