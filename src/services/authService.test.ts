import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn(async (k: string) => void store.delete(k)),
  },
}));

import { UserProfile } from '../types/database';
import { AuthService, samePhone, suggestUsername, usernameError } from './authService';

const member = (over: Partial<UserProfile> = {}): UserProfile & { username: string } => ({
  id: 'usr-1', username: 'sami', gymId: 'g', role: 'member', fullName: 'Sami Trabelsi', gender: 'male', age: 25,
  usualTrainingTime: 'evening', usualMuscleGroups: [], visitStreak: 3, whatsappNumber: '+216 20 123 456', createdAt: '2026-09-01', ...over,
});

describe('accounts', () => {
  beforeEach(() => store.clear());

  it('validates and suggests usernames', () => {
    expect(usernameError('sami')).toBeNull();
    expect(usernameError('sa')).toMatch(/3/);
    expect(usernameError('sâmi')).toMatch(/accent/);
    expect(usernameError('admin')).toMatch(/réservé/);
    expect(suggestUsername('Lahbib Ben Ali', new Set())).toBe('lahbib');
    expect(suggestUsername('Lahbib Ben Ali', new Set(['lahbib']))).toBe('lahbib.ben');
  });

  it('a phone number written differently is still the same number', () => {
    expect(samePhone('+216 20 123 456', '20123456')).toBe(true);
    expect(samePhone('21620123456', '20 123 456')).toBe(true);
    expect(samePhone('20123456', '20123457')).toBe(false);
  });

  it('sign out keeps the account; sign in with username + PIN gives back the same member', async () => {
    const reg = await AuthService.register(member(), '4729');
    expect(reg.ok).toBe(true);
    expect((await AuthService.register(member({ id: 'usr-2' }), '4729')).ok).toBe(false); // username taken

    await AuthService.logout();
    expect(await AuthService.getUserProfile()).toBeNull();
    expect(await AuthService.lastUsername()).toBe('sami');

    // The phone number no longer opens the account: that was the whole bug.
    expect(await AuthService.login('sami', '20 123 456')).toMatchObject({ ok: false, field: 'secret' });
    expect(await AuthService.login('nobody', '4729')).toMatchObject({ ok: false, field: 'username' });
    const back = await AuthService.login('@Sami', '4729');
    expect(back).toMatchObject({ ok: true, profile: { id: 'usr-1', visitStreak: 3 } });
  });

  it('refuses a PIN that is too easy, at registration', async () => {
    expect(await AuthService.register(member({ id: 'u9' }), '1234')).toMatchObject({ ok: false });
    expect(await AuthService.register(member({ id: 'u9' }), '12')).toMatchObject({ ok: false });
  });

  it('locks the account after repeated wrong codes', async () => {
    await AuthService.register(member({ id: 'u2' }), '4729');
    for (let i = 0; i < 5; i++) await AuthService.login('sami', '0001');
    // Even the right PIN is refused while the lockout holds.
    expect(await AuthService.login('sami', '4729')).toMatchObject({ ok: false, field: 'secret' });
  });

  it('lets an older account in once with its phone, then demands a PIN', async () => {
    // Simulates a member who registered before PINs existed.
    await AuthService.saveProfile(member({ id: 'u3' }));
    expect(await AuthService.needsPin('sami')).toBe(true);

    const res = await AuthService.login('sami', '20 123 456');
    expect(res).toMatchObject({ ok: true, mustSetPin: true });

    await AuthService.setPin('sami', '8391');
    expect(await AuthService.needsPin('sami')).toBe(false);
    // From now on the phone is just a phone number.
    expect(await AuthService.login('sami', '20 123 456')).toMatchObject({ ok: false });
    expect(await AuthService.login('sami', '8391')).toMatchObject({ ok: true });
  });

  it('requires the current code to change it', async () => {
    await AuthService.register(member({ id: 'u4' }), '4729');
    expect(await AuthService.changePin('sami', '0001', '5555')).toMatchObject({ ok: false });
    expect(await AuthService.changePin('sami', '4729', '5612')).toMatchObject({ ok: true });
    expect(await AuthService.login('sami', '5612')).toMatchObject({ ok: true });
  });

  it('the club manager signs in as admin / 0000 until he changes it', async () => {
    expect(await AuthService.login('admin', '1234')).toMatchObject({ ok: false, field: 'secret' });
    const res = await AuthService.login('ADMIN', '0000');
    expect(res).toMatchObject({ ok: true, profile: { role: 'owner', username: 'admin' } });
  });

  it('an older account gets a username at sign-out so it can come back', async () => {
    const legacy = { ...member(), username: undefined };
    await AuthService.saveProfile(legacy);
    const { username } = await AuthService.ensureUsername(legacy);
    expect(username).toBe('sami');
    await AuthService.logout();
    expect((await AuthService.login('sami', '20123456')).ok).toBe(true);
  });
});
