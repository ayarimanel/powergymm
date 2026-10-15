import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubDuration } from '../onboarding/habitsModel';
import clubTheme from './clubTheme';

export interface GymProfileConfig {
  id: string;
  code: string;
  name: string;
  location: string;
  country: string;
  currency: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  lightBackground: string;
  cardBackground: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  openingHour: number;
  closingHour: number;
  maxGymCapacity: number;
  /** Text encoded in the QR at the club entrance. Members scan it to check in. */
  checkInCode: string;
  /** Needed to sign up as the club owner. */
  ownerCode: string;
  /** Not every gym runs group classes — off by default lets a small gym hide the feature entirely. */
  classesEnabled: boolean;
  /** The club's own logo, shown in the app header and on the entrance QR. */
  logoUrl?: string;
  /** Live crowd only for members who scanned the entrance QR at least once (no outsiders, no competitors). */
  crowdMembersOnly: boolean;
  /** true = exact number of people; false = levels only (calme / moyen / chargé). */
  crowdShowCounts: boolean;
  /** The club tracks memberships in the app. Off for clubs with their own system: no expiry warnings to members. */
  membershipsInApp: boolean;
  /** The club's Google review link: members are invited to leave a review after a week with the app. */
  googleReviewUrl?: string;
  /** The manager signs in as "admin" with this password. "0000" until he changes it (the app reminds him). */
  adminPassword: string;
  /** Days the club opens, 0 = Monday … 6 = Sunday. The welcome questionnaire only offers these. */
  openDays: number[];
  /** Subscription lengths the club actually sells: the questionnaire offers no others. */
  durationsSold: SubDuration[];
  /** Every membership ends on the last day of the month, so asking when it was paid is pointless. */
  endOfMonthBilling: boolean;
  /** What one month costs, in millimes (1 DT = 1000). Used for the owner's revenue figure. */
  monthlyPriceMillimes: number;
}

export const DEFAULT_GYM_CONFIG: GymProfileConfig = {
  id: 'gym-app-01',
  code: 'GYM_APP',
  name: clubTheme.clubName,
  location: 'Tunis',
  country: 'Tunisia',
  currency: 'TND',
  primaryColor: clubTheme.colors.primary,
  secondaryColor: clubTheme.colors.primaryDark,
  accentColor: clubTheme.colors.primary,
  lightBackground: clubTheme.colors.primaryLight,
  cardBackground: clubTheme.colors.background,
  borderColor: clubTheme.colors.border,
  textPrimary: clubTheme.colors.textPrimary,
  textSecondary: clubTheme.colors.textSecondary,
  openingHour: 6,
  closingHour: 22,
  maxGymCapacity: 80,
  checkInCode: 'GYMAPP-ENTRY-7Q4K',
  // Placeholder only: getConfig() replaces this with a random per-install code
  // the very first time it runs, so a shared, guessable PIN never ships to real clubs.
  ownerCode: '0000',
  classesEnabled: true,
  crowdMembersOnly: true,
  crowdShowCounts: true,
  membershipsInApp: false,
  adminPassword: '0000',
  openDays: [0, 1, 2, 3, 4, 5, 6],
  durationsSold: ['1m', '3m', '6m', '1y', 'pass'],
  endOfMonthBilling: false,
  monthlyPriceMillimes: 60000,
};

const GYM_CONFIG_KEY = '@gym_app_config_v1';
const randomOwnerCode = () => String(Math.floor(1000 + Math.random() * 9000));

export const GymConfigService = {
  getConfig: async (): Promise<GymProfileConfig> => {
    try {
      const data = await AsyncStorage.getItem(GYM_CONFIG_KEY);
      if (data) return { ...DEFAULT_GYM_CONFIG, ...JSON.parse(data) };
      const fresh: GymProfileConfig = { ...DEFAULT_GYM_CONFIG, ownerCode: randomOwnerCode() };
      await AsyncStorage.setItem(GYM_CONFIG_KEY, JSON.stringify(fresh)).catch(() => {});
      return fresh;
    } catch {
      return DEFAULT_GYM_CONFIG;
    }
  },
  saveConfig: async (updated: Partial<GymProfileConfig>): Promise<GymProfileConfig> => {
    const current = await GymConfigService.getConfig();
    const newConf = { ...current, ...updated };
    try {
      await AsyncStorage.setItem(GYM_CONFIG_KEY, JSON.stringify(newConf));
    } catch (e) {
      console.error('Error saving config:', e);
    }
    return newConf;
  }
};
