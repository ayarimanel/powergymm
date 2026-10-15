import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachPricingPlan, CoachProfile, UserProfile } from '../types/database';
import { waDigits, withPlans } from '../coaching/offers';

const COACHES_KEY = '@gym_app_coaches_v3';

export const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const SEED_COACHES: CoachProfile[] = [
  {
    id: 'coach-1',
    userId: 'coach-1',
    status: 'approved',
    fullName: 'Coach Anis',
    headline: 'Force, hypertrophie & posture',
    yearsExperience: 8,
    bio: 'Ancien athlète de compétition et préparateur physique certifié IFBB. Sur le plateau, je corrige tes mouvements, je t’aide à choisir tes charges et je réponds à tes questions.',
    specialties: ['Prise de masse', 'Force', 'Posture'],
    onFloor: true,
    availabilityDays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    availabilityHours: '17:00 – 21:00',
    hourlyRateTnd: 50,
    contactPhone: '+216 20 123 456',
    whatsappNumber: '21620123456',
    isAcceptingClients: true,
    avatarUrl: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=600&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&auto=format&fit=crop',
  },
  {
    id: 'coach-2',
    userId: 'coach-2',
    status: 'approved',
    fullName: 'Coach Sonia',
    headline: 'HIIT, perte de poids & mobilité',
    yearsExperience: 6,
    bio: 'Je suis présente sur le plateau le matin pour guider les membres : échauffement, cardio, mobilité. N’hésite pas à venir me voir.',
    specialties: ['HIIT & cardio', 'Perte de poids', 'Mobilité'],
    onFloor: true,
    availabilityDays: ['Lun', 'Mer', 'Jeu', 'Sam', 'Dim'],
    availabilityHours: '07:00 – 12:00',
    hourlyRateTnd: 0,
    contactPhone: '+216 55 987 654',
    whatsappNumber: '21655987654',
    isAcceptingClients: true,
    avatarUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=900&auto=format&fit=crop',
  },
  {
    id: 'coach-3',
    userId: 'coach-3',
    status: 'approved',
    fullName: 'Coach Walid',
    headline: 'Powerlifting & coaching personnel',
    yearsExperience: 4,
    bio: 'Spécialiste de la force athlétique : squat, développé couché, soulevé de terre. Technique d’abord, charges ensuite. Séances privées sur rendez-vous.',
    specialties: ['Powerlifting', 'Technique'],
    onFloor: false,
    availabilityDays: ['Mar', 'Jeu', 'Sam'],
    availabilityHours: '18:00 – 21:00',
    hourlyRateTnd: 40,
    contactPhone: '+216 98 765 432',
    whatsappNumber: '21698765432',
    isAcceptingClients: false,
    avatarUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=900&auto=format&fit=crop',
  },
];

const read = async (): Promise<CoachProfile[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(COACHES_KEY);
    return raw ? (JSON.parse(raw) as CoachProfile[]) : null;
  } catch {
    return null;
  }
};

/** Demo plans for the seeded coaches. Only replaces earlier demo plans, never a coach's own. */
const OFFERS_SEED_KEY = '@gym_app_coach_offers_seeded_v2';
const SEED_OFFERS: Record<string, CoachPricingPlan[]> = {
  'coach-1': [
    { id: 'offer-anis-1', title: 'Séance découverte', priceTnd: 50, description: 'Une heure ensemble pour faire le point sur tes objectifs, corriger ta technique et repartir avec un plan clair.' },
    { id: 'offer-anis-m', title: 'Suivi 1 mois', priceTnd: 400, isPopular: true, description: '3 séances par semaine avec moi pendant 1 mois. Programme adapté à ton objectif, plan nutrition et suivi sur WhatsApp entre les séances.' },
  ],
  'coach-3': [
    { id: 'offer-walid-8', title: 'Prépa powerlifting', priceTnd: 280, isPopular: true, description: '8 séances de 1 h 30 sur squat, développé couché et soulevé de terre. Technique d’abord, puis on monte les charges.' },
  ],
};
const isSeedPlan = (id: string) => id.startsWith('offer-anis-') || id.startsWith('offer-walid-');
const withSeedOffers = (list: CoachProfile[]) =>
  list.map(c => {
    if (!SEED_OFFERS[c.id]) return c;
    const own = (c.pricingPlans ?? []).filter(p => !isSeedPlan(p.id));
    return own.length ? c : withPlans({ ...c, personalCoaching: true }, SEED_OFFERS[c.id]);
  });

export const CoachService = {
  getCoaches: async (): Promise<CoachProfile[]> => {
    const stored = await read();
    if (stored) {
      if (await AsyncStorage.getItem(OFFERS_SEED_KEY)) return stored;
      const next = withSeedOffers(stored);
      await AsyncStorage.multiSet([[COACHES_KEY, JSON.stringify(next)], [OFFERS_SEED_KEY, '1']]).catch(() => {});
      return next;
    }
    const seeded = withSeedOffers(SEED_COACHES);
    await AsyncStorage.multiSet([[COACHES_KEY, JSON.stringify(seeded)], [OFFERS_SEED_KEY, '1']]).catch(() => {});
    return seeded;
  },
  saveCoaches: (list: CoachProfile[]) => AsyncStorage.setItem(COACHES_KEY, JSON.stringify(list)).catch(() => {}),
};

// ---- Live "on the floor" status ----

const HHMM = /(\d{1,2})[:h](\d{2})/g;

const parseHourRange = (hours?: string): { startMin: number; endMin: number } | null => {
  if (!hours) return null;
  const matches = [...hours.matchAll(HHMM)];
  if (matches.length < 2) return null;
  const toMin = (h: string, m: string) => parseInt(h, 10) * 60 + parseInt(m, 10);
  return { startMin: toMin(matches[0][1], matches[0][2]), endMin: toMin(matches[1][1], matches[1][2]) };
};

/** A manual "I'm here / I stepped out" toggle only holds for this long before falling back to the schedule. */
const LIVE_STATUS_TTL_MIN = 4 * 60;

/** Whether a floor coach is actually around right now: a fresh manual toggle wins, otherwise their usual schedule decides. */
export const isOnFloorNow = (c: CoachProfile, now: Date = new Date()): boolean => {
  if (!c.onFloor || c.status === 'pending') return false;

  if (c.liveStatus) {
    const ageMin = (now.getTime() - new Date(c.liveStatus.setAt).getTime()) / 60000;
    if (ageMin >= 0 && ageMin < LIVE_STATUS_TTL_MIN) return c.liveStatus.state === 'here';
  }

  if (!c.availabilityDays?.length) return false;
  const today = DAYS[(now.getDay() + 6) % 7]; // Date#getDay(): 0=Sun..6=Sat → DAYS: Lun..Dim
  if (!c.availabilityDays.includes(today)) return false;

  const range = parseHourRange(c.availabilityHours);
  if (!range) return true; // day matches, hours weren't free-text-parseable → assume around all day
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return range.startMin <= range.endMin
    ? nowMin >= range.startMin && nowMin <= range.endMin
    : nowMin >= range.startMin || nowMin <= range.endMin; // overnight range
};

/** Is this floor coach on the plan for that weekday (0 = Monday) and hour? Ignores the temporary "here / away" toggle. */
export const isScheduledAt = (c: CoachProfile, weekday: number, hour: number): boolean => {
  if (!c.onFloor || c.status === 'pending' || !c.availabilityDays?.includes(DAYS[weekday])) return false;
  const range = parseHourRange(c.availabilityHours);
  if (!range) return true;
  const m = hour * 60 + 30; // middle of the hour
  return range.startMin <= range.endMin ? m >= range.startMin && m <= range.endMin : m >= range.startMin || m <= range.endMin;
};

export const setLiveStatus = async (coachId: string, state: 'here' | 'away'): Promise<CoachProfile[]> => {
  const list = await CoachService.getCoaches();
  const next = list.map(c => (c.id === coachId ? { ...c, liveStatus: { state, setAt: new Date().toISOString() } } : c));
  await CoachService.saveCoaches(next);
  return next;
};

// ---- Helpers ----

export const whatsappUrl = (c: CoachProfile, message: string) => `https://wa.me/${waDigits(c)}?text=${encodeURIComponent(message)}`;
export const telUrl = (c: CoachProfile) => `tel:${c.contactPhone.replace(/\s+/g, '')}`;

/** True when this coach profile belongs to the signed-in account. */
export const isOwnProfile = (c: CoachProfile, u: UserProfile) => c.userId === u.id || c.id === u.id;

/** "Lun – Sam" style summary of the days a coach is around. */
export const daysSummary = (days?: string[]) => {
  if (!days?.length) return '';
  const idx = days.map(d => DAYS.indexOf(d)).filter(i => i >= 0).sort((a, b) => a - b);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return contiguous && idx.length > 2 ? `${DAYS[idx[0]]} – ${DAYS[idx[idx.length - 1]]}` : idx.map(i => DAYS[i]).join(', ');
};
