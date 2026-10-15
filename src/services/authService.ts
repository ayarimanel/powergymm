import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types/database';
import { DEFAULT_GYM_CONFIG, GymConfigService } from '../config/gymConfig';
import { hashSecret, makeSalt, pinError, secretMatches } from './credentials';
import { MemberAdminService } from './memberAdminService';

/** The account signed in on this phone. */
const PROFILE_STORAGE_KEY = '@gym_app_user_profile_v1';
/** Every account created on this phone, by username: signing out keeps them, signing in finds them. */
const ACCOUNTS_KEY = '@gym_app_accounts_v1';
/** Prefills the login after a sign-out. */
const LAST_USERNAME_KEY = '@gym_app_last_username_v1';

/** The club manager signs in with this username and the admin password (Paramètres du club, "0000" until changed). */
export const ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = '0000';

export const normUsername = (s: string) => s.trim().toLowerCase().replace(/^@/, '');
const digits = (s?: string) => (s ?? '').replace(/[^0-9]/g, '');
/** "+216 20 123 456", "20123456" and "21620123456" are the same Tunisian number. */
export const samePhone = (a?: string, b?: string) => {
  const x = digits(a);
  const y = digits(b);
  return x.length >= 8 && y.length >= 8 && x.slice(-8) === y.slice(-8);
};

/** null when the username can be used. */
export function usernameError(raw: string): string | null {
  const u = normUsername(raw);
  if (u.length < 3) return 'Au moins 3 caractères.';
  if (u.length > 20) return '20 caractères maximum.';
  if (!/^[a-z0-9._]+$/.test(u)) return 'Lettres sans accent, chiffres, point ou tiret bas uniquement.';
  if (u === ADMIN_USERNAME) return 'Cet identifiant est réservé au club.';
  return null;
}

/** "Lahbib Ben Ali" → "lahbib", "lahbib.ba", "lahbib23"… the first one still free. */
export function suggestUsername(fullName: string, taken: Set<string>): string {
  const parts = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const first = (parts[0] ?? 'membre').slice(0, 14);
  const candidates = [first, parts[1] ? `${first}.${parts[1].slice(0, 4)}` : null, ...Array.from({ length: 40 }, (_, i) => `${first}${i + 2}`)].filter(
    (c): c is string => !!c && c.length >= 3
  );
  return candidates.find(c => !taken.has(c) && c !== ADMIN_USERNAME) ?? `${first}${Date.now() % 1000}`;
}

const readAccounts = async (): Promise<Record<string, UserProfile>> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserProfile>) : {};
  } catch {
    return {};
  }
};
const writeAccounts = (list: Record<string, UserProfile>) => AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)).catch(() => {});

const adminProfile = (): UserProfile => ({
  id: 'admin',
  username: ADMIN_USERNAME,
  gymId: DEFAULT_GYM_CONFIG.id,
  role: 'owner',
  fullName: 'Gérant',
  gender: 'male',
  age: 35,
  usualTrainingTime: 'evening',
  usualMuscleGroups: [],
  visitStreak: 0,
  bestStreak: 0,
  isApprovedCoach: true,
  coachStatus: 'approved',
  createdAt: new Date().toISOString(),
});

/* ---------- credentials ---------- */

/**
 * PIN hashes live apart from the profiles, so a profile object can be passed
 * around the app (and one day sent to a server) without carrying a secret.
 */
const CREDENTIALS_KEY = '@gym_app_credentials_v1';

interface Credential {
  salt: string;
  hash: string;
  /** Consecutive failures; reset on success. */
  failures: number;
  /** Epoch ms until which this account refuses attempts. */
  lockedUntil: number;
}

const readCredentials = async (): Promise<Record<string, Credential>> => {
  try {
    const raw = await AsyncStorage.getItem(CREDENTIALS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Credential>) : {};
  } catch {
    return {};
  }
};

const writeCredentials = (all: Record<string, Credential>) =>
  AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(all)).catch(() => {});

/** Five tries, then a pause that grows: 1 min, 5 min, then 15. */
export const lockoutMs = (failures: number): number =>
  failures < 5 ? 0 : failures < 7 ? 60_000 : failures < 9 ? 300_000 : 900_000;

const minutesLeft = (until: number) => Math.max(1, Math.ceil((until - Date.now()) / 60_000));

export type LoginResult =
  | { ok: true; profile: UserProfile; mustSetPin?: boolean }
  | { ok: false; field: 'username' | 'secret'; error: string };

export const AuthService = {
  /** The account signed in on this phone, or null (→ login screen). */
  getUserProfile: async (): Promise<UserProfile | null> => {
    try {
      const data = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error fetching user profile:', e);
      return null;
    }
  },

  /** Delete every piece of app data stored on this device. */
  clearEverything: async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.error('Error clearing data:', e);
    }
  },

  /** Persist the signed-in profile, and its account so the next sign-in finds the same person. */
  saveProfile: async (profile: UserProfile): Promise<UserProfile> => {
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      if (profile.username) {
        const accounts = await readAccounts();
        await writeAccounts({ ...accounts, [profile.username]: profile });
      }
    } catch (e) {
      console.error('Error saving profile:', e);
    }
    return profile;
  },

  usernames: async (): Promise<Set<string>> => new Set(Object.keys(await readAccounts())),

  lastUsername: async (): Promise<string> => (await AsyncStorage.getItem(LAST_USERNAME_KEY)) ?? '',

  /** New member or coach. The username must be free; the phone number is how they sign in again. */
  register: async (
    profile: UserProfile & { username: string },
    pin: string
  ): Promise<{ ok: true; profile: UserProfile } | { ok: false; error: string }> => {
    const username = normUsername(profile.username);
    const invalid = usernameError(username);
    if (invalid) return { ok: false, error: invalid };
    const accounts = await readAccounts();
    if (accounts[username]) return { ok: false, error: 'Cet identifiant est déjà pris.' };
    if (digits(profile.whatsappNumber).length < 8) return { ok: false, error: 'Ton numéro est obligatoire pour que le club te contacte.' };
    // The PIN is the credential; the phone is only a contact detail now.
    const pinInvalid = pinError(pin);
    if (pinInvalid) return { ok: false, error: pinInvalid };

    const saved = await AuthService.saveProfile({ ...profile, username });
    await AuthService.setPin(username, pin);
    return { ok: true, profile: saved };
  },

  /** Username + phone number (members, coaches) · "admin" + admin password (club manager). */
  login: async (rawUsername: string, secret: string): Promise<LoginResult> => {
    const username = normUsername(rawUsername);
    if (!username) return { ok: false, field: 'username', error: 'Écris ton identifiant.' };
    const accounts = await readAccounts();

    if (username === ADMIN_USERNAME) {
      // The owner account is the most valuable one, so it gets the same lockout.
      const all = await readCredentials();
      const guard = all[ADMIN_USERNAME];
      if (guard && guard.lockedUntil > Date.now()) {
        return { ok: false, field: 'secret', error: `Trop d’essais. Réessaie dans ${minutesLeft(guard.lockedUntil)} min.` };
      }

      const config = await GymConfigService.getConfig();
      if (secret.trim() !== (config.adminPassword || DEFAULT_ADMIN_PASSWORD)) {
        const failures = (guard?.failures ?? 0) + 1;
        const wait = lockoutMs(failures);
        all[ADMIN_USERNAME] = { salt: '', hash: '', failures, lockedUntil: wait ? Date.now() + wait : 0 };
        writeCredentials(all);
        return { ok: false, field: 'secret', error: wait ? `Trop d’essais. Réessaie dans ${Math.ceil(wait / 60_000)} min.` : 'Mot de passe incorrect.' };
      }

      if (guard) {
        all[ADMIN_USERNAME] = { ...guard, failures: 0, lockedUntil: 0 };
        writeCredentials(all);
      }
      const profile = accounts[ADMIN_USERNAME] ?? adminProfile();
      return { ok: true, profile: await AuthService.saveProfile(profile) };
    }

    const account = accounts[username];
    if (!account) return { ok: false, field: 'username', error: 'Aucun compte avec cet identifiant sur ce téléphone.' };

    // Checked before the code, so a banned member is not told whether he typed it right.
    const ban = await MemberAdminService.isBanned(account.id);
    if (ban) return { ok: false, field: 'username', error: `Ton accès au club a été suspendu. ${ban.reason}`.trim() };

    const all = await readCredentials();
    const cred = all[username];

    if (cred && cred.lockedUntil > Date.now()) {
      return { ok: false, field: 'secret', error: `Trop d’essais. Réessaie dans ${minutesLeft(cred.lockedUntil)} min.` };
    }

    const fail = async (error: string): Promise<LoginResult> => {
      const failures = (cred?.failures ?? 0) + 1;
      const wait = lockoutMs(failures);
      if (cred) {
        all[username] = { ...cred, failures, lockedUntil: wait ? Date.now() + wait : 0 };
        writeCredentials(all);
      }
      return { ok: false, field: 'secret', error: wait ? `Trop d’essais. Réessaie dans ${Math.ceil(wait / 60_000)} min.` : error };
    };

    // Accounts created before PINs existed: the phone still opens them, once,
    // and the member is sent straight to "choose a code".
    if (!cred) {
      if (!samePhone(account.whatsappNumber, secret)) {
        return { ok: false, field: 'secret', error: 'Code incorrect.' };
      }
      return { ok: true, profile: await AuthService.saveProfile(account), mustSetPin: true };
    }

    if (!secretMatches(secret.trim(), cred.salt, cred.hash)) return fail('Code incorrect.');

    all[username] = { ...cred, failures: 0, lockedUntil: 0 };
    writeCredentials(all);
    return { ok: true, profile: await AuthService.saveProfile(account) };
  },

  /** Does this account still sign in with its phone number? */
  needsPin: async (username: string): Promise<boolean> => {
    const u = normUsername(username);
    if (u === ADMIN_USERNAME) return false;
    return !(await readCredentials())[u];
  },

  /** Set or change the PIN. Changing it clears any lockout. */
  setPin: async (username: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const invalid = pinError(pin);
    if (invalid) return { ok: false, error: invalid };
    const u = normUsername(username);
    const salt = makeSalt();
    const all = await readCredentials();
    all[u] = { salt, hash: hashSecret(pin.trim(), salt), failures: 0, lockedUntil: 0 };
    writeCredentials(all);
    return { ok: true };
  },

  /** Changing a PIN requires the current one, so a borrowed phone is not enough. */
  changePin: async (username: string, current: string, next: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const u = normUsername(username);
    const cred = (await readCredentials())[u];
    if (cred && !secretMatches(current.trim(), cred.salt, cred.hash)) return { ok: false, error: 'Code actuel incorrect.' };
    return AuthService.setPin(u, next);
  },

  /**
   * Accounts created before usernames existed get one at sign-out, so they can come back.
   * Returns the username to sign in with (null if the profile has no phone and can't sign in again).
   */
  ensureUsername: async (profile: UserProfile): Promise<{ username: string | null; profile: UserProfile }> => {
    if (profile.username) return { username: profile.username, profile };
    if (profile.role === 'owner') {
      // The manager's existing profile becomes the "admin" account: same profile after the next sign-in.
      const saved = await AuthService.saveProfile({ ...profile, username: ADMIN_USERNAME });
      return { username: ADMIN_USERNAME, profile: saved };
    }
    if (digits(profile.whatsappNumber).length < 8) return { username: null, profile };
    const username = suggestUsername(profile.fullName, await AuthService.usernames());
    const saved = await AuthService.saveProfile({ ...profile, username });
    return { username, profile: saved };
  },

  updateVisitStreak: async (profile: UserProfile): Promise<UserProfile> => {
    const todayStr = new Date().toISOString().split('T')[0];
    let newStreak = profile.visitStreak || 0;

    if (profile.lastCheckInDate) {
      const lastDate = new Date(profile.lastCheckInDate);
      const todayDate = new Date(todayStr);
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day check-in!
        newStreak += 1;
      } else if (diffDays > 1) {
        // Streak reset to 1
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    return AuthService.saveProfile({
      ...profile,
      visitStreak: newStreak,
      bestStreak: Math.max(profile.bestStreak || 0, newStreak),
      lastCheckInDate: todayStr,
    });
  },

  /** Sign out: the account stays on the phone, ready for the next sign-in. */
  logout: async (): Promise<void> => {
    try {
      const current = await AuthService.getUserProfile();
      if (current?.username) await AsyncStorage.setItem(LAST_USERNAME_KEY, current.username);
      await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch (e) {
      console.error('Error logging out:', e);
    }
  },
};
