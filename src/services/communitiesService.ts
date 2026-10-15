import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types/database';
import { canValidateRecords } from './communityService';
import { colors } from '../theme';

const KEY = '@gym_app_communities_v1';

/** A member-facing group inside the club Wall (GymGirls, Powerlifters…). */
export interface Community {
  id: string;
  name: string;
  handle: string; // lowercase, no spaces — shown as @handle
  description: string;
  emoji: string;
  color: string; // accent hex
  /** Verified by the club (created by the owner or a coach). Members' own communities are not. */
  official: boolean;
  createdBy: string; // userId
  memberIds: string[];
  createdAt: string;
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

// A few fake members so seeded communities show realistic counts.
const CROWD = ['usr-101', 'usr-202', 'usr-303', 'usr-404', 'usr-505', 'coach-1', 'demo-3', 'demo-7', 'demo-12', 'demo-21', 'demo-30'];

export const GENERAL_ID = 'com-general';

const SEED: Community[] = [
  { id: GENERAL_ID, name: 'Général', handle: 'general', description: 'Le fil de tout le club : annonces, entraide et discussions ouvertes à tous.', emoji: '💬', color: colors.brand, official: true, createdBy: 'owner', memberIds: [...CROWD], createdAt: daysAgo(60) },
  { id: 'com-gymgirls', name: 'GymGirls', handle: 'gymgirls', description: 'Un espace motivant pour les femmes du club : entraide, conseils et séances entre nous. 💪', emoji: '💃', color: '#DB2777', official: true, createdBy: 'owner', memberIds: CROWD.slice(0, 8), createdAt: daysAgo(40) },
  { id: 'com-powerlifters', name: 'Powerlifters', handle: 'powerlifters', description: 'Squat, développé couché, soulevé de terre. Force pure et technique. 🏋️', emoji: '🏋️', color: colors.brand, official: true, createdBy: 'owner', memberIds: CROWD.slice(0, 6), createdAt: daysAgo(38) },
  { id: 'com-cardio', name: 'Cardio Club', handle: 'cardioclub', description: 'Course, HIIT, endurance. On garde le rythme ensemble. 🏃', emoji: '🏃', color: colors.green.bar, official: true, createdBy: 'coach-1', memberIds: CROWD.slice(2, 7), createdAt: daysAgo(20) },
  { id: 'com-beginners', name: 'Débutants', handle: 'debutants', description: 'Tu commences ? Pose tes questions, zéro jugement. On est tous passés par là. 🌱', emoji: '🌱', color: colors.amber.bar, official: true, createdBy: 'coach-1', memberIds: CROWD.slice(1, 5), createdAt: daysAgo(15) },
];

const read = async (): Promise<Community[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Community[]) : null;
  } catch {
    return null;
  }
};
const write = (list: Community[]) => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});

export interface CreatorStats {
  approvedPRs: number;
  posts: number;
}

export interface CreatePermission {
  allowed: boolean;
  /** Communities from the owner/coaches are verified; members' ones are not. */
  official: boolean;
  reason?: string;
}

/**
 * Who can start a community:
 *  - Owner & coaches: always, and their community is verified (official).
 *  - Members: only once "established" — at least one coach-validated record, or 3+ posts —
 *    so the space stays useful and spam-free. Their community is member-led (not verified).
 */
export const canCreateCommunity = (u: UserProfile, stats: CreatorStats): CreatePermission => {
  if (u.role === 'owner' || canValidateRecords(u)) return { allowed: true, official: true };
  if (stats.approvedPRs >= 1 || stats.posts >= 3) return { allowed: true, official: false };
  return { allowed: false, official: false, reason: 'Publie 3 fois ou fais valider un record pour créer ta communauté.' };
};

const slugify = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20) || 'communaute';

export const CommunitiesService = {
  getAll: async (): Promise<Community[]> => {
    const stored = await read();
    if (!stored) {
      write(SEED);
      return SEED;
    }
    // Merge in any seeded communities added since (e.g. Général) without touching existing ones.
    const missing = SEED.filter(s => !stored.some(c => c.id === s.id));
    if (missing.length === 0) return stored;
    const merged = [...missing, ...stored];
    write(merged);
    return merged;
  },

  save: (list: Community[]) => write(list),

  join: async (communityId: string, userId: string): Promise<Community[]> => {
    const all = await CommunitiesService.getAll();
    const next = all.map(c => (c.id === communityId && !c.memberIds.includes(userId) ? { ...c, memberIds: [...c.memberIds, userId] } : c));
    write(next);
    return next;
  },

  leave: async (communityId: string, userId: string): Promise<Community[]> => {
    const all = await CommunitiesService.getAll();
    const next = all.map(c => (c.id === communityId ? { ...c, memberIds: c.memberIds.filter(id => id !== userId) } : c));
    write(next);
    return next;
  },

  create: async (
    input: { name: string; description: string; emoji: string; color: string },
    user: UserProfile,
    permission: CreatePermission
  ): Promise<{ list: Community[]; created: Community }> => {
    const all = await CommunitiesService.getAll();
    const created: Community = {
      id: 'com-' + Date.now(),
      name: input.name.trim(),
      handle: slugify(input.name),
      description: input.description.trim(),
      emoji: input.emoji || '⭐',
      color: input.color,
      official: permission.official,
      createdBy: user.id,
      memberIds: [user.id],
      createdAt: new Date().toISOString(),
    };
    const next = [created, ...all];
    write(next);
    return { list: next, created };
  },

  isMember: (c: Community, userId: string) => c.memberIds.includes(userId),
};

/** Palette offered when creating a community. */
export const COMMUNITY_COLORS = ['#DB2777', colors.brand, colors.green.bar, colors.amber.bar, '#7C3AED', colors.red.bar, '#0891B2', '#4B5563'];
export const COMMUNITY_EMOJIS = ['💪', '🏋️', '🏃', '🌱', '🔥', '🧘', '⚡', '🥊', '🚴', '🤸', '🏆', '❤️'];
