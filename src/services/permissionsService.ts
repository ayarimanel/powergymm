import AsyncStorage from '@react-native-async-storage/async-storage';
import { StaffPermissions, UserProfile } from '../types/database';

const KEY = '@gym_app_permissions_v1';

/**
 * Grants live independently of any one profile, keyed by member id (not by
 * "who's currently signed in"), so the owner can hand out rights and they
 * stick even if that member logs out and back in. On a single phone today
 * this is also how you can test the flow: grant a permission, then switch
 * to that member's profile on the same device.
 */
export const PermissionsService = {
  getAll: async (): Promise<Record<string, StaffPermissions>> => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },
  getFor: async (userId: string): Promise<StaffPermissions> => (await PermissionsService.getAll())[userId] ?? {},
  set: async (userId: string, patch: StaffPermissions): Promise<Record<string, StaffPermissions>> => {
    const all = await PermissionsService.getAll();
    const next = { ...all, [userId]: { ...all[userId], ...patch } };
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  },
};

/** Re-reads this member's granted permissions and returns a fresh profile object. */
export const withFreshPermissions = async (profile: UserProfile): Promise<UserProfile> => ({
  ...profile,
  permissions: await PermissionsService.getFor(profile.id),
});

/**
 * The three roles and what each may do. Kept identical to the backend's `can()`
 * in shared/auth/actor.ts — if the two disagree, a member sees a button the
 * server then refuses.
 *
 *  - owner (club admin): everything, no grant needed;
 *  - coach: validates records once the admin has APPROVED his application —
 *    applying is not enough — plus whatever the admin granted on top;
 *  - member: only what the admin granted, which is normally nothing.
 */
export const hasPermission = (
  u: Pick<UserProfile, 'role' | 'permissions' | 'coachStatus' | 'isApprovedCoach'> | null | undefined,
  key: keyof StaffPermissions
): boolean => {
  if (!u) return false;
  if (u.role === 'owner') return true;
  // Same rule as canValidateRecords in communityService: a pending coach has nothing yet.
  if (key === 'coachFeatures' && u.role === 'coach' && isApprovedCoach(u)) return true;
  return !!u.permissions?.[key];
};

/** An applicant is a coach only once the club has said yes. */
export const isApprovedCoach = (u: Pick<UserProfile, 'coachStatus' | 'isApprovedCoach'>): boolean =>
  u.coachStatus ? u.coachStatus === 'approved' : u.isApprovedCoach !== false;

/**
 * Frontend grant key → the backend permission it becomes. The names differ for
 * historical reasons; this map is the only place that knows it, and the test
 * file checks it stays complete and 1:1 with the backend's PERMISSIONS list.
 */
export const BACKEND_PERMISSION: Record<keyof StaffPermissions, string> = {
  manageClasses: 'manage_classes',
  manageProducts: 'manage_products',
  manageNotifications: 'manage_announcements',
  manageCoaches: 'manage_coaches',
  coachFeatures: 'validate_records',
  manageMembers: 'manage_members',
  moderateWall: 'moderate_wall',
  manageFloor: 'manage_floor',
  viewAnalytics: 'view_analytics',
  manageStaff: 'manage_staff',
};

/**
 * Who may hand a right to someone else.
 *
 * The owner always can. A delegate with manageStaff can pass on only what he
 * holds himself — otherwise granting would be a way to award yourself rights you
 * were never given — and manageStaff itself stays with the owner, so delegation
 * cannot quietly spread.
 */
export const canGrant = (
  granter: Pick<UserProfile, 'role' | 'permissions' | 'coachStatus' | 'isApprovedCoach'> | null | undefined,
  key: keyof StaffPermissions
): boolean => {
  if (!granter) return false;
  if (granter.role === 'owner') return true;
  if (key === 'manageStaff') return false;
  return !!granter.permissions?.manageStaff && hasPermission(granter, key);
};

/** Nobody edits their own rights, whoever they are. */
export const canGrantTo = (
  granter: Pick<UserProfile, 'id' | 'role' | 'permissions' | 'coachStatus' | 'isApprovedCoach'> | null | undefined,
  targetUserId: string,
  key: keyof StaffPermissions
): boolean => !!granter && granter.id !== targetUserId && canGrant(granter, key);

/** What to send to PUT /v1/staff/:id/permissions once the club is linked. */
export const toBackendPermissions = (p: StaffPermissions): string[] =>
  (Object.keys(BACKEND_PERMISSION) as (keyof StaffPermissions)[]).filter(k => p[k]).map(k => BACKEND_PERMISSION[k]);

/** The reverse, for reading a profile back from the API. */
export const fromBackendPermissions = (list: string[]): StaffPermissions => {
  const out: StaffPermissions = {};
  for (const [key, backend] of Object.entries(BACKEND_PERMISSION) as [keyof StaffPermissions, string][]) {
    if (list.includes(backend)) out[key] = true;
  }
  return out;
};

/** Human labels for each grantable right, shared by the owner's grant screen and a member's own settings. */
export const PERMISSION_LABELS: { key: keyof StaffPermissions; label: string }[] = [
  { key: 'manageClasses', label: 'Cours collectifs' },
  { key: 'manageProducts', label: 'Boutique' },
  { key: 'manageNotifications', label: 'Infos du club' },
  { key: 'manageCoaches', label: 'Validation des coachs' },
  { key: 'coachFeatures', label: 'Fonctionnalités coach' },
  { key: 'manageMembers', label: 'Gestion des membres' },
  { key: 'moderateWall', label: 'Modération du Mur' },
  { key: 'manageFloor', label: 'Réglages de la salle' },
  { key: 'viewAnalytics', label: 'Chiffres du club' },
  { key: 'manageStaff', label: 'Gestion des droits' },
];
