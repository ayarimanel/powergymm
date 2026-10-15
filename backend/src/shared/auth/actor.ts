import { forbidden } from '../errors.js';

export const ROLES = ['member', 'coach', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'manage_classes',
  'manage_products',
  'manage_announcements',
  'manage_coaches',
  'validate_records',
  /** Hand out and take back the rights above. Owner-granted only; never self-propagating. */
  'manage_members',
  'moderate_wall',
  'manage_floor',
  'view_analytics',
  'manage_staff',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** The signed-in person making the request, with everything needed to authorize it. */
export interface Actor {
  id: string;
  gymId: string;
  role: Role;
  fullName: string;
  permissions: ReadonlySet<Permission>;
}

export const isOwner = (a: Actor) => a.role === 'owner';

/**
 * Owners can do everything. Staff get exactly what was granted.
 * Approved coaches (role = coach) can validate records without a grant.
 */
export function can(actor: Actor, permission: Permission): boolean {
  if (actor.role === 'owner') return true;
  if (permission === 'validate_records' && actor.role === 'coach') return true;
  return actor.permissions.has(permission);
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) throw forbidden();
}

export function requireOwner(actor: Actor): void {
  if (!isOwner(actor)) throw forbidden('Only the club admin can do this.');
}
