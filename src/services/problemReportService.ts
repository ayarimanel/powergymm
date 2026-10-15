import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@gym_app_problem_reports_v1';
const SEEN_KEY = (userId: string) => `@gym_app_problem_fixed_seen_v1_${userId}`;

export type ProblemCategory = 'machine' | 'proprete' | 'vestiaires' | 'clim' | 'autre';

export const PROBLEM_CATEGORIES: { id: ProblemCategory; label: string; icon: string }[] = [
  { id: 'machine', label: 'Machine en panne', icon: 'construct-outline' },
  { id: 'proprete', label: 'Propreté', icon: 'sparkles-outline' },
  { id: 'vestiaires', label: 'Vestiaires & douches', icon: 'water-outline' },
  { id: 'clim', label: 'Clim / aération', icon: 'thermometer-outline' },
  { id: 'autre', label: 'Autre', icon: 'chatbubble-ellipses-outline' },
];

/** Where in the club: the Floor zones + the rest of the building. */
export const PROBLEM_PLACES = ['Pectoraux', 'Dos', 'Jambes', 'Épaules', 'Bras', 'Cardio', 'Vestiaires', 'Accueil'];

export interface ProblemReport {
  id: string;
  userId: string;
  userName: string;
  category: ProblemCategory;
  place?: string;
  message: string;
  photoUri?: string;
  createdAt: string;
  status: 'open' | 'fixed';
  fixedAt?: string;
}

const read = async (): Promise<ProblemReport[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProblemReport[]) : [];
  } catch {
    return [];
  }
};
const write = (list: ProblemReport[]) => AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 300))).catch(() => {});

export const categoryOf = (id: ProblemCategory) => PROBLEM_CATEGORIES.find(c => c.id === id) ?? PROBLEM_CATEGORIES[PROBLEM_CATEGORIES.length - 1];

export const ProblemReportService = {
  /** Newest first. */
  getAll: async (): Promise<ProblemReport[]> => (await read()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  create: async (input: Omit<ProblemReport, 'id' | 'createdAt' | 'status'>): Promise<ProblemReport[]> => {
    const report: ProblemReport = { ...input, id: `pb-${Date.now()}`, createdAt: new Date().toISOString(), status: 'open' };
    const next = [report, ...(await read())];
    await write(next);
    return next;
  },

  setStatus: async (id: string, status: ProblemReport['status']): Promise<ProblemReport[]> => {
    const next = (await read()).map(r => (r.id === id ? { ...r, status, fixedAt: status === 'fixed' ? new Date().toISOString() : undefined } : r));
    await write(next);
    return next;
  },

  remove: async (id: string): Promise<ProblemReport[]> => {
    const next = (await read()).filter(r => r.id !== id);
    await write(next);
    return next;
  },

  /** The member's reports fixed since he last looked: "Réglé ✓" once. */
  newlyFixedFor: async (userId: string): Promise<ProblemReport[]> => {
    const seen = new Set<string>(JSON.parse((await AsyncStorage.getItem(SEEN_KEY(userId))) ?? '[]'));
    return (await read()).filter(r => r.userId === userId && r.status === 'fixed' && !seen.has(r.id));
  },
  markFixedSeen: async (userId: string, ids: string[]) => {
    const seen: string[] = JSON.parse((await AsyncStorage.getItem(SEEN_KEY(userId))) ?? '[]');
    await AsyncStorage.setItem(SEEN_KEY(userId), JSON.stringify([...new Set([...seen, ...ids])].slice(-200))).catch(() => {});
  },
};

export const agoShort = (iso: string, now = Date.now()) => {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
};
