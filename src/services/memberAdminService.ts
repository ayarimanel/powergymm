/**
 * Removing someone from the club itself — not from one community, from the app.
 *
 * Two different things, kept apart on purpose:
 *  - banned: the account still exists and can be let back in. Used for someone
 *    who broke the rules; the reason is kept so lifting it is a decision.
 *  - deleted: the account and its roster entry are gone. Used when someone asks
 *    to leave, and it cannot be undone.
 *
 * Neither touches another member's posts: moderating content is a separate right.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClubService } from './clubService';

const BANS_KEY = '@gym_app_club_bans_v1';

export interface ClubBan {
  userId: string;
  name: string;
  reason: string;
  at: string;
  by: string;
}

const read = async (): Promise<ClubBan[]> => {
  try {
    const raw = await AsyncStorage.getItem(BANS_KEY);
    return raw ? (JSON.parse(raw) as ClubBan[]) : [];
  } catch {
    return [];
  }
};

const write = (list: ClubBan[]) => AsyncStorage.setItem(BANS_KEY, JSON.stringify(list)).catch(() => {});

export const MemberAdminService = {
  bans: read,

  isBanned: async (userId: string): Promise<ClubBan | null> => (await read()).find(b => b.userId === userId) ?? null,

  /** Blocks the account at sign-in. The member keeps his data in case he is let back. */
  ban: async (userId: string, name: string, reason: string, by: string): Promise<ClubBan[]> => {
    const list = await read();
    if (list.some(b => b.userId === userId)) return list;
    const next = [...list, { userId, name, reason, at: new Date().toISOString(), by }];
    await write(next);
    return next;
  },

  unban: async (userId: string): Promise<ClubBan[]> => {
    const next = (await read()).filter(b => b.userId !== userId);
    await write(next);
    return next;
  },

  /**
   * Permanent: the roster entry goes, and the ban with it (there is no longer an
   * account to block). The caller is expected to have confirmed with a human.
   */
  remove: async (userId: string): Promise<void> => {
    const members = await ClubService.getMembers();
    await ClubService.saveMembers(members.filter(m => m.id !== userId));
    await MemberAdminService.unban(userId);
  },
};
