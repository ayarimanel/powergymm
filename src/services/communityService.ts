import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommunityPost, MemberProfile, UserProfile } from '../types/database';

// v4: expanded demo feed with posts across every community
const POSTS_KEY = '@gym_app_wall_posts_v4';
const LIKES_KEY = '@gym_app_wall_likes_v1';
const PR_SEEN_KEY = '@gym_app_wall_pr_seen_v1';
const PROFILES_KEY = '@gym_app_wall_profiles_v1';
const ACTIVITY_KEY = '@gym_app_wall_activity_v1';
const HIDDEN_KEY = '@gym_app_wall_hidden_v1';
const REPORTS_KEY = '@gym_app_wall_reports_v1';
const ACTIVITY_SEEN_KEY = '@gym_app_wall_activity_seen_v1';
const COMMENT_LIKES_KEY = '@gym_app_wall_comment_likes_v1';
const WALL_SEEN_KEY = '@gym_app_wall_feed_seen_v1';

const WORKOUT_IMGS = [
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop',
];
const MEAL_IMG = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop';
const RUN_IMG = 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&auto=format&fit=crop';
const YOGA_IMG = 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop';
const SQUAT_IMG = 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&auto=format&fit=crop';

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

// ---- Mock members (until Supabase profiles) ----
const SEED_PROFILES: MemberProfile[] = [
  { userId: 'coach-1', name: 'Coach Anis', role: 'coach', bio: 'Coach force & musculation · 8 ans d’expérience. Pose-moi tes questions !' },
  { userId: 'coach-2', name: 'Coach Sonia', role: 'coach', bio: 'HIIT, cardio & mobilité. Présente le matin ☀️' },
  { userId: 'usr-101', name: 'Youssef B.', role: 'member', bio: 'Soulevé de terre addict 🏋️ · objectif 200 kg' },
  { userId: 'usr-202', name: 'Sarra M.', role: 'member', bio: 'Séances tôt le matin ☀️' },
  { userId: 'usr-303', name: 'Karim T.', role: 'member', bio: 'Meal prep & prise de masse 🥗' },
  { userId: 'usr-404', name: 'Meriem K.', role: 'member', bio: 'Squat, squat et encore squat.' },
  { userId: 'usr-505', name: 'Amine R.', role: 'member', bio: 'Cardio & endurance 🏃' },
  { userId: 'usr-606', name: 'Nour H.', role: 'member', bio: 'Fitness & nutrition · GymGirls 💗' },
  { userId: 'usr-707', name: 'Rayen S.', role: 'member', bio: 'Powerlifting · en prep compétition' },
  { userId: 'usr-808', name: 'Ines D.', role: 'member', bio: 'Yoga, mobilité & bien-être 🧘‍♀️' },
];

const DEFAULT_POSTS: CommunityPost[] = [
  {
    id: 'pr-post-1', gymId: 'gym-app-01', userId: 'usr-101', userName: 'Youssef B.', category: 'pr', isPR: true, communityId: 'com-powerlifters',
    prDetails: { exercise: 'Soulevé de terre', weightKg: 160, reps: 3, prevWeightKg: 150 },
    prApproval: { status: 'approved', approvedById: 'coach-1', approvedByName: 'Coach Anis', approvedAt: ago(40) },
    caption: '160 kg pour 3 reps propres ! La constance paie 🔥',
    likesCount: 38, canDelete: false, createdAt: ago(75),
    comments: [{ id: 'c1', userId: 'coach-1', userName: 'Coach Anis', text: 'Technique impeccable, bravo Youssef 👏', createdAt: ago(45), likesCount: 3 }],
  },
  {
    id: 'post-workout-1', gymId: 'gym-app-01', userId: 'usr-202', userName: 'Sarra M.', category: 'workout', communityId: 'com-gymgirls',
    caption: 'Pecs et épaules terminés avant 8 h ! 4 séries lourdes de développé incliné 🏋️‍♀️✨',
    imageUrls: WORKOUT_IMGS, likesCount: 24, createdAt: ago(180),
    comments: [
      { id: 'c2', userId: 'usr-303', userName: 'Karim T.', text: 'Solide ! 💪', createdAt: ago(150), likesCount: 1 },
      { id: 'c3', userId: 'usr-505', userName: 'Amine R.', text: 'Tu t’entraînes à quelle heure d’habitude ?', createdAt: ago(120), likesCount: 0 },
    ],
  },
  {
    id: 'post-question-1', gymId: 'gym-app-01', userId: 'usr-505', userName: 'Amine R.', category: 'question', communityId: 'com-beginners',
    caption: 'Quelqu’un pour un dos/biceps ce soir vers 18 h 30 ? Et des conseils pour éviter de tricher sur le rowing ?',
    likesCount: 12, createdAt: ago(240),
    comments: [
      { id: 'c4', userId: 'coach-1', userName: 'Coach Anis', text: 'Baisse la charge de 10 % et garde le buste fixe. Je passe te voir à 18 h 30 pour corriger.', createdAt: ago(200), likesCount: 2 },
    ],
  },
  {
    id: 'post-meal-1', gymId: 'gym-app-01', userId: 'usr-303', userName: 'Karim T.', category: 'meal',
    caption: 'Déjeuner post-séance : poulet grillé, avocat, quinoa et patates douces 🥗🥑 (55 g de protéines)',
    imageUrls: [MEAL_IMG], likesCount: 31, createdAt: ago(300),
  },
  {
    id: 'pr-post-2', gymId: 'gym-app-01', userId: 'usr-404', userName: 'Meriem K.', category: 'pr', isPR: true, communityId: 'com-gymgirls',
    prDetails: { exercise: 'Squat', weightKg: 105, reps: 5, prevWeightKg: 100 },
    prApproval: { status: 'pending' },
    caption: '105 kg pour 5 reps, merci pour le spot !',
    likesCount: 45, canDelete: false, createdAt: ago(480),
  },

  // ---- GymGirls 💃 ----
  {
    id: 'gg-1', gymId: 'gym-app-01', userId: 'usr-606', userName: 'Nour H.', category: 'workout', communityId: 'com-gymgirls',
    caption: 'Leg day entre filles 🍑 4 exos, 45 min, on s’est motivées à fond !',
    imageUrls: [SQUAT_IMG], likesCount: 52, createdAt: ago(95),
    comments: [
      { id: 'gg1c1', userId: 'usr-202', userName: 'Sarra M.', text: 'On remet ça jeudi ? 🔥', createdAt: ago(80), likesCount: 4 },
      { id: 'gg1c2', userId: 'usr-808', userName: 'Ines D.', text: 'Trop bien cette séance 💗', createdAt: ago(60), likesCount: 2 },
    ],
  },
  {
    id: 'gg-2', gymId: 'gym-app-01', userId: 'usr-808', userName: 'Ines D.', category: 'chat', communityId: 'com-gymgirls',
    caption: 'Un cours de yoga entre nous ce week-end, ça tente qui ? 🧘‍♀️',
    likesCount: 18, createdAt: ago(140),
    comments: [{ id: 'gg2c1', userId: 'usr-606', userName: 'Nour H.', text: 'Moi !! 🙋‍♀️', createdAt: ago(120), likesCount: 1 }],
  },
  {
    id: 'gg-3', gymId: 'gym-app-01', userId: 'usr-202', userName: 'Sarra M.', category: 'meal', communityId: 'com-gymgirls',
    caption: 'Petit-déj protéiné avant la séance : skyr, flocons, fruits rouges 🍓',
    imageUrls: [MEAL_IMG], likesCount: 27, createdAt: ago(220),
  },

  // ---- Powerlifters 🏋️ ----
  {
    id: 'pl-1', gymId: 'gym-app-01', userId: 'usr-707', userName: 'Rayen S.', category: 'pr', isPR: true, communityId: 'com-powerlifters',
    prDetails: { exercise: 'Développé couché', weightKg: 120, reps: 1, prevWeightKg: 115 },
    prApproval: { status: 'pending' },
    caption: 'Nouveau max au bench : 120 kg ! Prep compétition en cours 💪',
    imageUrls: WORKOUT_IMGS, likesCount: 61, canDelete: false, createdAt: ago(130),
    comments: [{ id: 'pl1c1', userId: 'usr-101', userName: 'Youssef B.', text: 'Machine 🔥 tu passes 130 bientôt', createdAt: ago(110), likesCount: 5 }],
  },
  {
    id: 'pl-2', gymId: 'gym-app-01', userId: 'usr-303', userName: 'Karim T.', category: 'question', communityId: 'com-powerlifters',
    caption: 'Sumo ou conventionnel pour progresser au deadlift quand on a les jambes longues ?',
    likesCount: 14, createdAt: ago(260),
    comments: [
      { id: 'pl2c1', userId: 'coach-1', userName: 'Coach Anis', text: 'Jambes longues → souvent sumo plus confortable. Teste les deux 3 semaines et compare.', createdAt: ago(230), likesCount: 6 },
    ],
  },
  {
    id: 'pl-3', gymId: 'gym-app-01', userId: 'usr-101', userName: 'Youssef B.', category: 'chat', communityId: 'com-powerlifters',
    caption: 'Qui est chaud pour une séance deadlift lourd samedi matin ? On se motive 🏋️',
    likesCount: 22, createdAt: ago(340),
  },

  // ---- Cardio Club 🏃 ----
  {
    id: 'cc-1', gymId: 'gym-app-01', userId: 'usr-505', userName: 'Amine R.', category: 'workout', communityId: 'com-cardio',
    caption: '10 km ce matin en 52 min, nouveau record perso sur la distance 🏃💨',
    imageUrls: [RUN_IMG], likesCount: 44, createdAt: ago(160),
    comments: [{ id: 'cc1c1', userId: 'coach-2', userName: 'Coach Sonia', text: 'Superbe allure ! On bosse le fractionné mardi 👌', createdAt: ago(140), likesCount: 3 }],
  },
  {
    id: 'cc-2', gymId: 'gym-app-01', userId: 'coach-2', userName: 'Coach Sonia', category: 'chat', communityId: 'com-cardio',
    caption: 'HIIT collectif demain 7 h 🔥 20 min qui réveillent. Ramenez de l’eau !',
    likesCount: 33, createdAt: ago(300),
  },
  {
    id: 'cc-3', gymId: 'gym-app-01', userId: 'usr-303', userName: 'Karim T.', category: 'question', communityId: 'com-cardio',
    caption: 'Vous visez quelle zone de FC pour brûler du gras sans perdre de muscle ?',
    likesCount: 9, createdAt: ago(520),
    comments: [{ id: 'cc3c1', userId: 'coach-2', userName: 'Coach Sonia', text: 'Zone 2 (60–70% FCmax) pour l’endurance, 2–3× / semaine. Le muscle se garde avec la muscu à côté.', createdAt: ago(500), likesCount: 4 }],
  },

  // ---- Débutants 🌱 ----
  {
    id: 'bg-1', gymId: 'gym-app-01', userId: 'usr-606', userName: 'Nour H.', category: 'question', communityId: 'com-beginners',
    caption: 'Je débute : combien de fois par semaine pour commencer sans me blesser ?',
    likesCount: 16, createdAt: ago(180),
    comments: [
      { id: 'bg1c1', userId: 'coach-1', userName: 'Coach Anis', text: '3 séances full-body par semaine, un jour de repos entre chaque. Progresse doucement 🙂', createdAt: ago(160), likesCount: 7 },
      { id: 'bg1c2', userId: 'usr-808', userName: 'Ines D.', text: 'Bienvenue ! On est passées par là 🌱', createdAt: ago(150), likesCount: 2 },
    ],
  },
  {
    id: 'bg-2', gymId: 'gym-app-01', userId: 'usr-505', userName: 'Amine R.', category: 'question', communityId: 'com-beginners',
    caption: 'La protéine en poudre c’est obligatoire pour débuter ?',
    likesCount: 11, createdAt: ago(420),
    comments: [{ id: 'bg2c1', userId: 'coach-1', userName: 'Coach Anis', text: 'Non ! D’abord bien manger. La poudre dépanne si tu n’atteins pas tes protéines dans la journée.', createdAt: ago(400), likesCount: 5 }],
  },

  // ---- General club feed (no community → "Pour toi") ----
  {
    id: 'gen-1', gymId: 'gym-app-01', userId: 'coach-1', userName: 'Coach Anis', category: 'chat',
    caption: 'Rappel : rangez les disques après vos séries 🙏 Ça aide tout le monde. Bon entraînement !',
    likesCount: 40, createdAt: ago(90),
    comments: [{ id: 'gen1c1', userId: 'usr-404', userName: 'Meriem K.', text: '👏👏', createdAt: ago(70), likesCount: 1 }],
  },
  {
    id: 'gen-2', gymId: 'gym-app-01', userId: 'usr-808', userName: 'Ines D.', category: 'workout',
    caption: 'Séance mobilité + gainage terminée 🧘‍♀️ Le dos dit merci.',
    imageUrls: [YOGA_IMG], likesCount: 19, createdAt: ago(360),
  },
  {
    id: 'gen-3', gymId: 'gym-app-01', userId: 'usr-707', userName: 'Rayen S.', category: 'meal',
    caption: 'Prep de la semaine faite : riz, poulet, légumes ×10 🍱 Zéro excuse cette semaine.',
    imageUrls: [MEAL_IMG], likesCount: 36, createdAt: ago(600),
  },
];

const read = async <T,>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('communityService write error', e);
  }
};

export const CommunityService = {
  getPosts: async (): Promise<CommunityPost[]> => {
    const stored = await read<CommunityPost[]>(POSTS_KEY);
    if (stored) return stored;
    await write(POSTS_KEY, DEFAULT_POSTS);
    return DEFAULT_POSTS;
  },
  savePosts: (posts: CommunityPost[]) => write(POSTS_KEY, posts),

  getLikes: async (): Promise<string[]> => (await read<string[]>(LIKES_KEY)) ?? [],
  saveLikes: (ids: string[]) => write(LIKES_KEY, ids),

  /** Comment ids the current member has liked. */
  getCommentLikes: async (): Promise<string[]> => (await read<string[]>(COMMENT_LIKES_KEY)) ?? [],
  saveCommentLikes: (ids: string[]) => write(COMMENT_LIKES_KEY, ids),

  /** Timestamp (ms) of the last time the member had the Wall feed open. */
  getWallSeenAt: async (): Promise<number> => (await read<number>(WALL_SEEN_KEY)) ?? Date.now(),
  markWallSeen: () => write(WALL_SEEN_KEY, Date.now()),

  /** Timestamp (ms) of the last time the user opened the Records filter. */
  getPrSeenAt: async (): Promise<number> => (await read<number>(PR_SEEN_KEY)) ?? 0,
  markPrSeen: () => write(PR_SEEN_KEY, Date.now()),

  /** Directory of public member cards keyed by userId. */
  getProfiles: async (): Promise<Record<string, MemberProfile>> => {
    const stored = (await read<Record<string, MemberProfile>>(PROFILES_KEY)) ?? {};
    const map: Record<string, MemberProfile> = {};
    SEED_PROFILES.forEach(p => (map[p.userId] = p));
    return { ...map, ...stored };
  },
  saveProfiles: (profiles: Record<string, MemberProfile>) => write(PROFILES_KEY, profiles),

  /** Posts this member chose to hide from his own feed. */
  getHidden: async (): Promise<string[]> => (await read<string[]>(HIDDEN_KEY)) ?? [],
  saveHidden: (ids: string[]) => write(HIDDEN_KEY, ids),

  /** Ids of posts reported to the club. */
  getReports: async (): Promise<string[]> => (await read<string[]>(REPORTS_KEY)) ?? [],
  addReport: async (postId: string) => {
    const all = await CommunityService.getReports();
    if (!all.includes(postId)) await write(REPORTS_KEY, [...all, postId]);
  },
  clearReport: async (postId: string) => write(REPORTS_KEY, (await CommunityService.getReports()).filter(id => id !== postId)),
};


// ---------- Activity (Instagram-style notifications) ----------

export interface ActivityEvent {
  id: string;
  type: 'like' | 'comment' | 'validated';
  postId: string;
  /** Who owns the post (= who gets notified). */
  ownerId: string;
  actorId: string;
  actorName: string;
  text?: string;
  createdAt: string;
}

type Listener = (source: 'local' | 'remote') => void;
const listeners = new Set<Listener>();
const notify = (source: 'local' | 'remote') => listeners.forEach(l => l(source));

/**
 * MOCK backend: until Supabase realtime is connected, other members react to the posts you publish
 * a few seconds later so likes/comments/notifications can be seen working. Set to false to disable.
 * Off by default now that real members will be using the app — flip to true only for local demos.
 */
const SIMULATE_REACTIONS = false;

const SIM_COMMENTS: Record<string, string> = {
  workout: 'Belle séance ! 💪',
  meal: 'Ça donne envie 😋',
  question: 'Bonne question ! Je te réponds en détail à la salle.',
  pr: 'Belle perf ! Je passe valider ton record 🏆',
  chat: 'Bien dit !',
};

export const ActivityService = {
  subscribe: (l: Listener) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  getAll: async (): Promise<ActivityEvent[]> => (await read<ActivityEvent[]>(ACTIVITY_KEY)) ?? [],

  add: async (ev: Omit<ActivityEvent, 'id' | 'createdAt'>, source: 'local' | 'remote' = 'local') => {
    const all = await ActivityService.getAll();
    // a member can only "like" a post once
    if (ev.type === 'like' && all.some(e => e.type === 'like' && e.postId === ev.postId && e.actorId === ev.actorId)) return;
    const next = [{ ...ev, id: 'ev-' + Date.now() + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString() }, ...all].slice(0, 200);
    await write(ACTIVITY_KEY, next);
    notify(source);
  },

  removeLike: async (actorId: string, postId: string) => {
    const all = await ActivityService.getAll();
    await write(ACTIVITY_KEY, all.filter(e => !(e.type === 'like' && e.actorId === actorId && e.postId === postId)));
    notify('local');
  },

  getSeenAt: async (): Promise<number> => (await read<number>(ACTIVITY_SEEN_KEY)) ?? 0,
  markSeen: async () => {
    await write(ACTIVITY_SEEN_KEY, Date.now());
    notify('local');
  },

  /** Mock reactions from other members to a post the current user just published. */
  simulateReactions: (post: CommunityPost) => {
    if (!SIMULATE_REACTIONS) return;
    const react = (delay: number, actor: MemberProfile, kind: 'like' | 'comment') =>
      setTimeout(async () => {
        const posts = await read<CommunityPost[]>(POSTS_KEY);
        if (!posts) return;
        const target = posts.find(p => p.id === post.id);
        if (!target) return; // deleted meanwhile
        const text = SIM_COMMENTS[target.category ?? 'chat'];
        const updated = posts.map(p =>
          p.id !== post.id
            ? p
            : kind === 'like'
            ? { ...p, likesCount: p.likesCount + 1 }
            : { ...p, comments: [...(p.comments ?? []), { id: 'c-' + Date.now(), userId: actor.userId, userName: actor.name, text, createdAt: new Date().toISOString(), likesCount: 0 }] }
        );
        await write(POSTS_KEY, updated);
        await ActivityService.add(
          { type: kind, postId: post.id, ownerId: post.userId, actorId: actor.userId, actorName: actor.name, text: kind === 'comment' ? text : undefined },
          'remote'
        );
      }, delay);

    const by = (id: string) => SEED_PROFILES.find(p => p.userId === id)!;
    react(5000, by('usr-202'), 'like');
    react(11000, by('usr-303'), 'like');
    react(16000, by('coach-1'), 'comment');
  },

  /** Lets the Wall reload posts when a remote (simulated) reaction landed. */
  notifyPostsChanged: () => notify('remote'),
};

// ---- Helpers ----

export const postImages = (p: CommunityPost): string[] => p.imageUrls ?? (p.imageUrl ? [p.imageUrl] : []);

export const isPR = (p: CommunityPost) => !!p.isPR || p.category === 'pr';

/** Coaches (approved), the owner, and any member granted "coachFeatures" can validate records. */
export const canValidateRecords = (u: UserProfile) =>
  u.role === 'owner' ||
  (u.role === 'coach' && (u.coachStatus ? u.coachStatus === 'approved' : u.isApprovedCoach !== false)) ||
  !!u.permissions?.coachFeatures;

export const toMemberProfile = (u: UserProfile): MemberProfile => ({
  userId: u.id,
  name: u.fullName,
  role: u.role,
  avatarUrl: u.avatarUrl,
  bio: u.bio,
  socials: u.socials,
});

export const timeAgoFr = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.floor(m / 60)} h`;
  return `il y a ${Math.floor(m / 1440)} j`;
};
