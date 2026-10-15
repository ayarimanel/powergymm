/**
 * The record of sensitive acts: who was given a right, who was removed from a
 * community, and every time the club owner opened a community he is not in.
 *
 * Append-only. Revoking a right writes a second entry instead of deleting the
 * first — a log you can edit is not a log. Kept deliberately small and boring so
 * it can be shown to the people it is about.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@gym_app_audit_v1';
const LIMIT = 500;

export type AuditAction =
  | 'permission.granted'
  | 'permission.revoked'
  | 'community.created'
  | 'community.accepted'
  | 'community.refused'
  | 'community.banned'
  | 'community.unbanned'
  | 'community.promoted'
  | 'community.demoted'
  | 'community.transferred'
  | 'community.owner_override';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  /** Who did it. */
  actorId: string;
  actorName: string;
  /** Who it was done to, when that applies. */
  targetId?: string;
  targetName?: string;
  /** Community id, for the community actions. */
  communityId?: string;
  /** Permission key, for the permission actions. */
  permission?: string;
  reason?: string;
  at: string;
}

const read = async (): Promise<AuditEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
};

export const AuditService = {
  all: read,

  /** Newest first. */
  log: async (entry: Omit<AuditEntry, 'id' | 'at'>): Promise<AuditEntry> => {
    const full: AuditEntry = { ...entry, id: `au-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() };
    const list = await read();
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify([full, ...list].slice(0, LIMIT)));
    } catch {
      // storage full: the action still happened, we just could not record it
    }
    return full;
  },

  /** What a community's own members are entitled to see about it. */
  forCommunity: async (communityId: string): Promise<AuditEntry[]> =>
    (await read()).filter(e => e.communityId === communityId),

  /** The grant history for one person, for the staff screen. */
  forUser: async (userId: string): Promise<AuditEntry[]> =>
    (await read()).filter(e => e.targetId === userId || e.actorId === userId),
};

/** One readable French line per entry, used by the audit list and the community sheet. */
export const describeAudit = (e: AuditEntry): string => {
  const who = e.actorName || 'Quelqu’un';
  const target = e.targetName || 'un membre';
  switch (e.action) {
    case 'permission.granted':
      return `${who} a donné « ${e.permission} » à ${target}`;
    case 'permission.revoked':
      return `${who} a retiré « ${e.permission} » à ${target}`;
    case 'community.created':
      return `${who} a créé la communauté`;
    case 'community.accepted':
      return `${who} a accepté ${target}`;
    case 'community.refused':
      return `${who} a refusé ${target}`;
    case 'community.banned':
      return `${who} a retiré ${target}${e.reason ? ` (${e.reason})` : ''}`;
    case 'community.unbanned':
      return `${who} a réintégré ${target}`;
    case 'community.promoted':
      return `${who} a nommé ${target} modérateur`;
    case 'community.demoted':
      return `${who} a retiré son rôle à ${target}`;
    case 'community.transferred':
      return `${who} a transmis la communauté à ${target}`;
    case 'community.owner_override':
      return `Le gérant du club a consulté cette communauté`;
  }
};
