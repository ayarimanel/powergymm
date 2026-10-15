import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

import {
  BACKEND_PERMISSION,
  PERMISSION_LABELS,
  fromBackendPermissions,
  canGrant,
  canGrantTo,
  hasPermission,
  toBackendPermissions,
} from './permissionsService';
import type { StaffPermissions } from '../types/database';

const owner = { role: 'owner' as const, permissions: {} };
const coach = { role: 'coach' as const, permissions: {} };
const member = { role: 'member' as const, permissions: {} };

describe('who may do what', () => {
  it('gives the club admin everything without a grant', () => {
    for (const { key } of PERMISSION_LABELS) expect(hasPermission(owner, key)).toBe(true);
  });

  it('gives a member nothing until the admin grants it', () => {
    for (const { key } of PERMISSION_LABELS) expect(hasPermission(member, key)).toBe(false);
    expect(hasPermission({ role: 'member', permissions: { manageProducts: true } }, 'manageProducts')).toBe(true);
    // A grant is not contagious: one right never implies another.
    expect(hasPermission({ role: 'member', permissions: { manageProducts: true } }, 'manageCoaches')).toBe(false);
  });

  it('lets an approved coach validate records without a grant, but nothing else', () => {
    expect(hasPermission(coach, 'coachFeatures')).toBe(true);
    expect(hasPermission(coach, 'manageProducts')).toBe(false);
    expect(hasPermission(coach, 'manageCoaches')).toBe(false);
  });

  it('gives a coach nothing until the admin approves the application', () => {
    const applied = { role: 'coach' as const, permissions: {}, coachStatus: 'pending_approval' as const };
    expect(hasPermission(applied, 'coachFeatures')).toBe(false);
    expect(hasPermission({ ...applied, coachStatus: 'rejected' as const }, 'coachFeatures')).toBe(false);
    expect(hasPermission({ ...applied, coachStatus: 'approved' as const }, 'coachFeatures')).toBe(true);
  });

  it('can still hand coach features to a plain member as an explicit grant', () => {
    expect(hasPermission({ role: 'member', permissions: { coachFeatures: true } }, 'coachFeatures')).toBe(true);
  });

  it('refuses a signed-out visitor', () => {
    expect(hasPermission(null, 'manageProducts')).toBe(false);
    expect(hasPermission(undefined, 'coachFeatures')).toBe(false);
  });
});

describe('who may hand out rights', () => {
  const manager = {
    id: 'mgr',
    role: 'member' as const,
    permissions: { manageStaff: true, manageProducts: true },
  };

  it('lets the club owner grant anything', () => {
    for (const { key } of PERMISSION_LABELS) expect(canGrant(owner, key)).toBe(true);
  });

  it('lets a delegate pass on only what he holds himself', () => {
    // He has the shop, so he can give the shop.
    expect(canGrant(manager, 'manageProducts')).toBe(true);
    // He does not have the classes, so he cannot award them to anyone.
    expect(canGrant(manager, 'manageClasses')).toBe(false);
    expect(canGrant(manager, 'manageCoaches')).toBe(false);
  });

  it('never lets delegation spread itself', () => {
    expect(canGrant(manager, 'manageStaff')).toBe(false);
    expect(canGrant(owner, 'manageStaff')).toBe(true);
  });

  it('refuses a member with no manageStaff, however many other rights he has', () => {
    const rich = { id: 'r', role: 'member' as const, permissions: { manageProducts: true, manageClasses: true, manageCoaches: true } };
    expect(canGrant(rich, 'manageProducts')).toBe(false);
  });

  it('stops anyone editing their own rights', () => {
    expect(canGrantTo(manager, 'other', 'manageProducts')).toBe(true);
    expect(canGrantTo(manager, 'mgr', 'manageProducts')).toBe(false);
    // Not even the owner: he already has everything, so this is only a footgun.
    expect(canGrantTo({ ...owner, id: 'o' }, 'o', 'manageProducts')).toBe(false);
  });
});

describe('frontend ↔ backend permission map', () => {
  it('maps every grantable right shown in the UI', () => {
    for (const { key } of PERMISSION_LABELS) expect(BACKEND_PERMISSION[key]).toBeTruthy();
  });

  it('matches the backend PERMISSIONS list exactly, with no extras on either side', () => {
    // Read the backend's own list so the two can never drift apart unnoticed.
    const actor = readFileSync(join(__dirname, '..', '..', 'backend', 'src', 'shared', 'auth', 'actor.ts'), 'utf8');
    const block = actor.match(/export const PERMISSIONS = \[([^\]]+)\]/)![1]!;
    const backend = [...block.matchAll(/'([a-z_]+)'/g)].map(m => m[1]!).sort();

    expect(Object.values(BACKEND_PERMISSION).sort()).toEqual(backend);
  });

  it('converts grants to the backend shape and back without loss', () => {
    const grants: StaffPermissions = { manageProducts: true, coachFeatures: true };
    const wire = toBackendPermissions(grants);
    expect(wire.sort()).toEqual(['manage_products', 'validate_records']);
    expect(fromBackendPermissions(wire)).toEqual(grants);
  });

  it('ignores a permission the backend sends that the app does not know', () => {
    expect(fromBackendPermissions(['manage_products', 'something_new'])).toEqual({ manageProducts: true });
  });

  it('sends nothing for a member with no grants', () => {
    expect(toBackendPermissions({})).toEqual([]);
  });
});
