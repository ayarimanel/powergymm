import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommunityColor } from '../theme';
import clubTheme from '../config/clubTheme';
import { CommunityType, MemStatus, ClubRole } from './permissions';

/** No 'session' kind: finishing a workout stays private, it is never announced in a community. */
export type PostKind = 'official' | 'record' | 'question';
export type PostStatus = 'pending' | 'pending_validation' | 'published' | 'hidden' | 'deleted';

export interface Community {
  id: string;
  name: string;
  ini: string;
  color: CommunityColor;
  type: CommunityType;
  womenOnly?: boolean;
  members: number;
  today: number;
  desc: string;
  rules: string[];
  /**
   * Display labels only ("Coach Anis"), shown on the community sheet.
   * NEVER decide what someone may do from these: anyone can type any name into
   * his own profile. Authorisation reads adminIds/modIds and nothing else.
   */
  adminNames: string[];
  modNames: string[];
  /** Who may manage this community, by user id. The only thing auth looks at. */
  adminIds: string[];
  modIds: string[];
  /**
   * Everyone in the community, by user id — the roster.
   * Without this there is no way to show who is in, and therefore no way to
   * moderate anyone who has not just posted. Mirrors community_members server-side.
   */
  memberIds: string[];
  /** Who created it: holds the founder rank and cannot be removed by an admin. */
  createdBy: string;
  createdAt: string;
  /** Removed members, with why — so an unban is a decision and not a shrug. */
  bans: { userId: string; reason: string; at: string; by: string }[];
}

export interface MurComment {
  id: string;
  authorId: string;
  author: string;
  avatarUrl?: string;
  text: string;
  createdAt: string;
  /** Member ids who liked it. */
  likes: string[];
}

export interface MurPost {
  id: string;
  cid: string;
  kind: PostKind;
  /** Who posted it (missing on older/demo posts): he can delete any comment on it. */
  authorId?: string;
  comments?: MurComment[];
  author: string | null; // null when anonymous (never surfaced to non-mods)
  init: string;
  ago: string;
  text?: string;
  anonymous?: boolean;
  media?: string | null;
  lift?: string;
  kg?: number;
  reps?: number;
  delta?: string;
  validatedBy?: string;
  stats?: [string, string][];
  answer?: { by: string; text: string };
  likes: number;
  status?: PostStatus;
}

export interface JoinRequest {
  id: string;
  cid: string;
  name: string;
  init: string;
  note: string;
  since: string;
}

export interface Report {
  id: string;
  cid: string;
  text: string;
  reason: string;
  count: number;
  author: string;
}

const K = {
  communities: '@gym_app_mur_communities_v1',
  posts: '@gym_app_mur_posts_v1',
  requests: '@gym_app_mur_requests_v1',
  reports: '@gym_app_mur_reports_v1',
  membership: (uid: string) => `@gym_app_mur_membership_v1_${uid}`,
};

/**
 * The demo communities ship without a real founder: the first club owner to open
 * the app adopts them (see adoptSeedCommunities), so they are never left ownerless.
 */
const SEED_OWNER = '';
const SEED_AT = '2026-01-01T00:00:00.000Z';

const SEED_COMMUNITIES: Community[] = [
  { id: 'club', name: 'Le Club', ini: clubTheme.clubInitials, type: 'official', color: 'accent', members: 412, today: 2, desc: "Le compte officiel du club : nouveautés, événements, promos, photos. Seul le gérant publie ici.", rules: ['Lecture pour tous les membres', 'Commentaires respectueux'], adminNames: ['Gérant'], modNames: [], adminIds: [], modIds: [], memberIds: [], createdBy: SEED_OWNER, createdAt: SEED_AT, bans: [] },
  { id: 'general', name: 'Général', ini: 'G', type: 'open', color: 'teal', members: 312, today: 9, desc: 'Le coin de tout le club : séances, motivation, entraide.', rules: ['Pas de pub ni de vente', 'Respect de tous les niveaux', "Pas de photo d'un membre sans son accord"], adminNames: ['Gérant'], modNames: ['Coach Anis'], adminIds: [], modIds: [], memberIds: [], createdBy: SEED_OWNER, createdAt: SEED_AT, bans: [] },
  { id: 'debutants', name: 'Débutants', ini: 'D', type: 'open', color: 'calm', members: 88, today: 5, desc: 'Pose toutes tes questions, même les plus simples. Aucun jugement, les coachs répondent.', rules: ['Aucune moquerie', 'Questions anonymes autorisées', 'Réponses santé : seulement les coachs'], adminNames: ['Coach Sarra'], modNames: ['Coach Anis'], adminIds: [], modIds: [], memberIds: [], createdBy: SEED_OWNER, createdAt: SEED_AT, bans: [] },
  { id: 'gymgirls', name: 'GymGirls', ini: 'GG', type: 'request', color: 'pink', womenOnly: true, members: 64, today: 6, desc: 'Espace réservé aux femmes du club. Chaque demande est vérifiée par Coach Ines.', rules: ['Réservé aux membres femmes', 'Ce qui se dit ici reste ici', "Pas de capture d'écran"], adminNames: ['Coach Ines'], modNames: [], adminIds: [], modIds: [], memberIds: [], createdBy: SEED_OWNER, createdAt: SEED_AT, bans: [] },
  { id: 'power', name: 'Powerlifting', ini: 'PL', type: 'request', color: 'gold', members: 41, today: 3, desc: 'Squat, bench, deadlift. Records validés par un coach, préparation aux compétitions.', rules: ['Vidéo obligatoire pour un record', 'Critique technique bienveillante'], adminNames: ['Coach Anis'], modNames: [], adminIds: [], modIds: [], memberIds: [], createdBy: SEED_OWNER, createdAt: SEED_AT, bans: [] },
  { id: 'nutrition', name: 'Nutrition', ini: 'N', type: 'open', color: 'mid', members: 120, today: 1, desc: 'Repas, prise de masse, sèche. Partage tes assiettes et tes astuces.', rules: ['Pas de vente de compléments', 'Pas de régimes extrêmes'], adminNames: ['Coach Sarra'], modNames: [], adminIds: [], modIds: [], memberIds: [], createdBy: SEED_OWNER, createdAt: SEED_AT, bans: [] },
  { id: 'matinaux', name: 'Matinaux 6h', ini: '6h', type: 'open', color: 'violet', members: 35, today: 0, desc: "Ceux qui s'entraînent à l'ouverture. Motivation du matin et binômes.", rules: ['Bonne humeur obligatoire'], adminNames: ['Coach Anis'], modNames: [], adminIds: [], modIds: [], memberIds: [], createdBy: SEED_OWNER, createdAt: SEED_AT, bans: [] },
  { id: 'hyrox', name: 'Team Hyrox', ini: 'HX', type: 'invite', color: 'violet', members: 12, today: 4, desc: "Groupe compétition Hyrox. Sur invitation d'un coach uniquement.", rules: ['Présence aux entraînements du samedi'], adminNames: ['Coach Anis'], modNames: [], adminIds: [], modIds: [], memberIds: [], createdBy: SEED_OWNER, createdAt: SEED_AT, bans: [] },
];

const SEED_POSTS: MurPost[] = [
  { id: 'p1', cid: 'club', kind: 'official', author: 'Gym App', init: 'GA', ago: 'il y a 1 h', text: "Le nouveau rack de squat est arrivé dans la zone force. Venez le tester ce week-end !", media: 'Nouveau rack · zone force', likes: 52 },
  { id: 'p2', cid: 'power', kind: 'record', author: 'Youssef B.', init: 'Y', ago: 'il y a 2 h', text: '160 kg pour 3 reps propres. La constance paie.', lift: 'Soulevé de terre', kg: 160, reps: 3, delta: '+10 kg', validatedBy: 'Coach Anis', likes: 38 },
  { id: 'p3', cid: 'debutants', kind: 'question', author: null, init: '?', ago: 'il y a 3 h', anonymous: true, text: "C'est normal d'avoir un peu mal aux genoux au squat ? Je débute depuis 2 semaines.", answer: { by: 'Coach Sarra', text: 'Une gêne légère peut venir de la position des pieds. Passe me voir demain 18h, on regarde ta technique ensemble.' }, likes: 14 },
  { id: 'p6', cid: 'hyrox', kind: 'question', author: 'Coach Anis', init: 'A', ago: 'il y a 6 h', text: 'Entraînement simulation samedi 9h. Qui est dispo ?', likes: 9 },
];

const SEED_REQUESTS: Record<string, JoinRequest[]> = {
  power: [
    { id: 'q1', cid: 'power', name: 'Karim T.', init: 'K', note: 'Squat 140 kg, je prépare ma première compétition.', since: 'il y a 2 h' },
    { id: 'q2', cid: 'power', name: 'Rania B.', init: 'R', note: 'Je veux apprendre le deadlift proprement.', since: 'hier' },
  ],
  gymgirls: [{ id: 'q3', cid: 'gymgirls', name: 'Wiouw', init: 'W', note: "Membre depuis mars, je m'entraîne le soir.", since: 'il y a 1 h' }],
  hyrox: [],
};

const SEED_REPORTS: Report[] = [
  { id: 'rp1', cid: 'general', text: 'Vends whey pas chère, écris-moi en privé…', reason: 'Vente / pub', count: 3, author: 'Nabil K.' },
];

/** Per-role starting membership, mirroring the reference. */
const seedMembership = (role: ClubRole): Record<string, MemStatus> => {
  if (role === 'owner') return { club: 'admin', general: 'admin', debutants: 'member', gymgirls: 'none', power: 'member', nutrition: 'member', matinaux: 'none', hyrox: 'none' };
  if (role === 'coach') return { club: 'member', general: 'mod', debutants: 'mod', gymgirls: 'none', power: 'admin', nutrition: 'member', matinaux: 'admin', hyrox: 'admin' };
  // member (and expired) start with the member map
  return { club: 'member', general: 'member', debutants: 'member', gymgirls: 'pending', power: 'none', nutrition: 'none', matinaux: 'none', hyrox: 'none' };
};

const read = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

/**
 * Communities saved before management moved to user ids.
 * The old `admins`/`mods` held display names, which anyone could impersonate by
 * renaming themselves. They are kept as labels and grant nothing.
 */
type LegacyCommunity = Community & { admins?: string[]; mods?: string[] };

export const migrateCommunity = (c: LegacyCommunity): Community => {
  const { admins, mods, ...rest } = c;
  return {
    ...rest,
    adminNames: c.adminNames ?? admins ?? [],
    modNames: c.modNames ?? mods ?? [],
    adminIds: c.adminIds ?? [],
    memberIds: c.memberIds ?? [],
    modIds: c.modIds ?? [],
    createdBy: c.createdBy ?? '',
    createdAt: c.createdAt ?? SEED_AT,
    bans: c.bans ?? [],
  };
};

/* ---------- comments: who can do what ---------- */
export interface CommentActor {
  id: string;
  /** Moderator of the post's community. */
  canModerate: boolean;
}
const editComments = (p: MurPost, fn: (list: MurComment[]) => MurComment[]): MurPost => ({ ...p, comments: fn(p.comments ?? []) });
const isPostOwner = (p: MurPost, actor: CommentActor) => !!p.authorId && p.authorId === actor.id;

export const MurComments = {
  add: (p: MurPost, c: Omit<MurComment, 'id' | 'createdAt' | 'likes'>): MurPost =>
    editComments(p, list => [...list, { ...c, id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString(), likes: [] }]),

  /** Your own comment, any comment on your post, or any comment if you moderate the community. */
  canDelete: (p: MurPost, c: MurComment, actor: CommentActor) => c.authorId === actor.id || isPostOwner(p, actor) || actor.canModerate,
  remove: (p: MurPost, commentId: string, actor: CommentActor): MurPost =>
    editComments(p, list => list.filter(c => c.id !== commentId || !MurComments.canDelete(p, c, actor))),

  /** The post's author (or a moderator) can clear the whole thread. */
  canDeleteAll: (p: MurPost, actor: CommentActor) => isPostOwner(p, actor) || actor.canModerate,
  removeAll: (p: MurPost, actor: CommentActor): MurPost => (MurComments.canDeleteAll(p, actor) ? { ...p, comments: [] } : p),

  toggleLike: (p: MurPost, commentId: string, userId: string): MurPost =>
    editComments(p, list =>
      list.map(c => (c.id !== commentId ? c : { ...c, likes: c.likes.includes(userId) ? c.likes.filter(u => u !== userId) : [...c.likes, userId] }))
    ),
};

export const MurService = {
  getCommunities: async (): Promise<Community[]> => {
    const stored = await read<Community[] | null>(K.communities, null);
    if (stored) return stored.map(migrateCommunity);
    write(K.communities, SEED_COMMUNITIES);
    return SEED_COMMUNITIES;
  },

  /**
   * The seed communities start with no founder. The first club owner to open the
   * app takes them on, so "who runs this?" always has an answer and the demo
   * data stays usable.
   */
  adoptSeedCommunities: async (ownerId: string): Promise<Community[]> => {
    const list = await MurService.getCommunities();
    if (list.every(c => c.createdBy)) return list;
    const owned = list.map(c =>
      c.createdBy ? c : { ...c, createdBy: ownerId, adminIds: [...new Set([...c.adminIds, ownerId])] }
    );
    write(K.communities, owned);
    return owned;
  },
  saveCommunities: (list: Community[]) => write(K.communities, list),

  getMembership: async (uid: string, role: ClubRole): Promise<Record<string, MemStatus>> => {
    const stored = await read<Record<string, MemStatus> | null>(K.membership(uid), null);
    if (stored) return stored;
    const seeded = seedMembership(role);
    write(K.membership(uid), seeded);
    return seeded;
  },
  saveMembership: (uid: string, m: Record<string, MemStatus>) => write(K.membership(uid), m),

  getPosts: async (): Promise<MurPost[]> => {
    const stored = await read<MurPost[] | null>(K.posts, null);
    // Older installs saved "séance terminée" posts: they are no longer shown.
    if (stored) return stored.filter(p => (p.kind as string) !== 'session');
    write(K.posts, SEED_POSTS);
    return SEED_POSTS;
  },
  savePosts: (list: MurPost[]) => write(K.posts, list),

  getRequests: async (): Promise<Record<string, JoinRequest[]>> => read(K.requests, SEED_REQUESTS),
  saveRequests: (r: Record<string, JoinRequest[]>) => write(K.requests, r),

  getReports: async (): Promise<Report[]> => read(K.reports, SEED_REPORTS),
  saveReports: (r: Report[]) => write(K.reports, r),
};

export const memStatus = (map: Record<string, MemStatus>, cid: string): MemStatus => map[cid] || 'none';

/**
 * Someone's real standing in a community.
 *
 * The community's own lists win over the per-user membership map, because the
 * community is the thing being administered: founder, then admin, then mod, then
 * whatever the member map says. A ban beats everything except being the founder.
 */
export const standingIn = (c: Community, userId: string, fromMap: MemStatus = 'none'): MemStatus => {
  if (c.createdBy && c.createdBy === userId) return 'founder';
  if (c.bans.some(b => b.userId === userId)) return 'banned';
  if (c.adminIds.includes(userId)) return 'admin';
  if (c.modIds.includes(userId)) return 'mod';
  // On the roster means in, whatever this device's membership map happens to say.
  if (c.memberIds.includes(userId)) return 'member';
  return fromMap;
};

const touch = (c: Community, patch: Partial<Community>): Community => ({ ...c, ...patch });

/** Management actions on one community. Each returns a new Community; the caller saves. */
export const CommunityAdmin = {
  /** Someone joined (open community) or was accepted. Idempotent. */
  join: (c: Community, userId: string): Community =>
    c.memberIds.includes(userId)
      ? c
      : touch(c, { memberIds: [...c.memberIds, userId], members: c.members + 1, bans: c.bans.filter(b => b.userId !== userId) }),

  /** Left on their own. The founder cannot reach this (canLeave refuses). */
  leave: (c: Community, userId: string): Community =>
    touch(c, {
      memberIds: c.memberIds.filter(i => i !== userId),
      adminIds: c.adminIds.filter(i => i !== userId),
      modIds: c.modIds.filter(i => i !== userId),
      members: Math.max(0, c.members - (c.memberIds.includes(userId) ? 1 : 0)),
    }),

  ban: (c: Community, userId: string, reason: string, by: string): Community =>
    c.bans.some(b => b.userId === userId)
      ? c
      : touch(c, {
          bans: [...c.bans, { userId, reason, at: new Date().toISOString(), by }],
          // A banned member keeps no rank and leaves the roster.
          adminIds: c.adminIds.filter(i => i !== userId),
          modIds: c.modIds.filter(i => i !== userId),
          memberIds: c.memberIds.filter(i => i !== userId),
          members: Math.max(0, c.members - (c.memberIds.includes(userId) ? 1 : 0)),
        }),

  /** Lifting a ban does not let them back in: they have to join again. */
  unban: (c: Community, userId: string): Community =>
    touch(c, { bans: c.bans.filter(b => b.userId !== userId) }),

  setStatus: (c: Community, userId: string, next: 'member' | 'mod' | 'admin'): Community =>
    touch(c, {
      adminIds: next === 'admin' ? [...new Set([...c.adminIds, userId])] : c.adminIds.filter(i => i !== userId),
      modIds: next === 'mod' ? [...new Set([...c.modIds, userId])] : c.modIds.filter(i => i !== userId),
      // A rank implies membership: promoting someone who somehow left re-adds them.
      memberIds: [...new Set([...c.memberIds, userId])],
      members: c.memberIds.includes(userId) ? c.members : c.members + 1,
    }),

  /** Handing over: the old founder stays on as an admin rather than losing access. */
  transferFounder: (c: Community, toUserId: string): Community =>
    touch(c, {
      createdBy: toUserId,
      adminIds: [...new Set([...c.adminIds.filter(i => i !== toUserId), c.createdBy].filter(Boolean))],
    }),
};
