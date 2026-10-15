import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@gym_app_club_members_v1';

/** Club member as the owner sees them (until a real members table exists). */
export interface ClubMember {
  id: string;
  name: string;
  phone: string; // digits, for WhatsApp
  lastVisit: string; // ISO
  membershipEnds: string; // ISO
  /** When they first opened the app. Absent on members created before growth tracking. */
  joinedAt?: string; // ISO
}

/** One renewal, logged so the owner's revenue is counted and not guessed. */
export interface Renewal {
  memberId: string;
  at: string; // ISO
  days: number;
  priceMillimes: number;
}

const RENEWALS_KEY = '@gym_app_club_renewals_v1';

const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

export const ClubService = {
  // The real roster: it starts empty and grows as members actually onboard
  // (see ensureMember below) — no fake names shown to a real club owner.
  getMembers: async (): Promise<ClubMember[]> => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as ClubMember[];
    } catch {}
    return [];
  },
  saveMembers: (list: ClubMember[]) => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {}),

  getRenewals: async (): Promise<Renewal[]> => {
    try {
      const raw = await AsyncStorage.getItem(RENEWALS_KEY);
      if (raw) return JSON.parse(raw) as Renewal[];
    } catch {}
    return [];
  },
  logRenewal: async (r: Renewal) => {
    const list = await ClubService.getRenewals();
    await AsyncStorage.setItem(RENEWALS_KEY, JSON.stringify([r, ...list].slice(0, 2000))).catch(() => {});
  },
};

/** Makes sure the signed-in member exists in the registry (30-day starter membership until the owner sets it). */
export const ensureMember = async (u: { id: string; fullName: string; whatsappNumber?: string; role: string }): Promise<ClubMember | null> => {
  if (u.role !== 'member') return null;
  const list = await ClubService.getMembers();
  const found = list.find(m => m.id === u.id);
  if (found) return found;
  const now = new Date().toISOString();
  const created: ClubMember = { id: u.id, name: u.fullName, phone: (u.whatsappNumber ?? '').replace(/[^0-9]/g, ''), lastVisit: now, membershipEnds: daysFromNow(30), joinedAt: now };
  await ClubService.saveMembers([created, ...list]);
  return created;
};

export const touchVisit = async (userId: string) => {
  const list = await ClubService.getMembers();
  if (list.some(m => m.id === userId)) await ClubService.saveMembers(list.map(m => (m.id === userId ? { ...m, lastVisit: new Date().toISOString() } : m)));
};

const dayDiff = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 86400000);

/** Days since the member last came (0 = today). */
export const daysAbsent = (m: ClubMember) => Math.max(0, -dayDiff(m.lastVisit));
/** Days left on the membership (negative = expired). */
export const daysLeft = (m: ClubMember) => dayDiff(m.membershipEnds);

export const renew = (m: ClubMember, days = 30): ClubMember => {
  const base = Math.max(Date.now(), new Date(m.membershipEnds).getTime());
  return { ...m, membershipEnds: new Date(base + days * 86400000).toISOString() };
};

export const waLink = (phone: string, msg: string) => `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
