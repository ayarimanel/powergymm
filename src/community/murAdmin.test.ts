import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

import { Community, CommunityAdmin, migrateCommunity, standingIn } from './murService';

const base: Community = {
  id: 'power',
  name: 'Powerlifting',
  ini: 'PL',
  color: 'gold',
  type: 'request',
  members: 10,
  today: 0,
  desc: '',
  rules: [],
  adminNames: ['Coach Anis'],
  modNames: [],
  adminIds: ['anis'],
  modIds: ['sami'],
  memberIds: ['anis', 'sami', 'lina'],
  createdBy: 'founder-id',
  createdAt: '2026-01-01T00:00:00.000Z',
  bans: [],
};

describe('standing in a community', () => {
  it('reads rank from the community, not from a display name', () => {
    // "Coach Anis" is only a label: someone renaming himself gains nothing.
    const impostor = standingIn({ ...base, adminIds: [] }, 'whoever', 'member');
    expect(impostor).toBe('member');
    expect(standingIn(base, 'anis')).toBe('admin');
    expect(standingIn(base, 'sami')).toBe('mod');
  });

  it('puts the founder above every admin', () => {
    expect(standingIn(base, 'founder-id')).toBe('founder');
    expect(standingIn({ ...base, adminIds: ['founder-id'] }, 'founder-id')).toBe('founder');
  });

  it('treats being on the roster as being in, whatever the local map says', () => {
    expect(standingIn(base, 'lina', 'member')).toBe('member');
    expect(standingIn(base, 'lina', 'none')).toBe('member'); // roster wins
  });

  it('falls back to the membership map for someone not on the roster', () => {
    // Someone waiting at the door is not a member yet, so not on the roster.
    expect(standingIn(base, 'outsider', 'pending')).toBe('pending');
    expect(standingIn(base, 'outsider')).toBe('none');
  });

  it('lets a ban beat any map entry, but never the founder', () => {
    const banned = { ...base, bans: [{ userId: 'lina', reason: 'pub', at: 'now', by: 'anis' }] };
    expect(standingIn(banned, 'lina', 'member')).toBe('banned');

    const sillyBan = { ...base, bans: [{ userId: 'founder-id', reason: 'x', at: 'now', by: 'anis' }] };
    expect(standingIn(sillyBan, 'founder-id')).toBe('founder');
  });
});

describe('management actions', () => {
  it('strips rank when banning, and counts the member out', () => {
    const after = CommunityAdmin.ban(base, 'anis', 'spam', 'founder-id');
    expect(after.adminIds).not.toContain('anis');
    expect(after.members).toBe(9);
    expect(after.bans[0]).toMatchObject({ userId: 'anis', reason: 'spam', by: 'founder-id' });
    expect(standingIn(after, 'anis')).toBe('banned');
  });

  it('does not double-ban', () => {
    const once = CommunityAdmin.ban(base, 'lina', 'pub', 'anis');
    expect(CommunityAdmin.ban(once, 'lina', 'encore', 'anis').bans).toHaveLength(1);
  });

  it('restores nothing on unban: the member comes back as a member', () => {
    const banned = CommunityAdmin.ban(base, 'anis', 'spam', 'founder-id');
    const back = CommunityAdmin.unban(banned, 'anis');
    expect(back.bans).toHaveLength(0);
    expect(standingIn(back, 'anis', 'member')).toBe('member'); // not admin again
  });

  it('moves someone between ranks without leaving them in two lists', () => {
    const promoted = CommunityAdmin.setStatus(base, 'sami', 'admin');
    expect(promoted.adminIds).toContain('sami');
    expect(promoted.modIds).not.toContain('sami');

    const down = CommunityAdmin.setStatus(promoted, 'sami', 'member');
    expect(down.adminIds).not.toContain('sami');
    expect(down.modIds).not.toContain('sami');
  });

  it('keeps the old founder on as admin after a handover', () => {
    const handed = CommunityAdmin.transferFounder(base, 'anis');
    expect(handed.createdBy).toBe('anis');
    expect(standingIn(handed, 'anis')).toBe('founder');
    expect(handed.adminIds).toContain('founder-id'); // not locked out
    expect(handed.adminIds).not.toContain('anis'); // founder, not listed twice
  });
});

describe('the roster', () => {
  it('adds a member once, however many times they tap join', () => {
    const once = CommunityAdmin.join(base, 'newbie');
    expect(once.memberIds).toContain('newbie');
    expect(once.members).toBe(11);
    expect(CommunityAdmin.join(once, 'newbie').members).toBe(11);
  });

  it('lets a ban survive nothing: joining again clears it', () => {
    const banned = CommunityAdmin.ban(base, 'lina', 'pub', 'anis');
    expect(standingIn(banned, 'lina', 'member')).toBe('banned');
    const rejoined = CommunityAdmin.join(banned, 'lina');
    expect(rejoined.bans).toHaveLength(0);
    expect(standingIn(rejoined, 'lina')).toBe('member');
  });

  it('keeps the count honest when someone leaves', () => {
    const left = CommunityAdmin.leave(base, 'sami');
    expect(left.memberIds).not.toContain('sami');
    expect(left.modIds).not.toContain('sami'); // rank goes with them
    expect(left.members).toBe(9);
    // Leaving twice must not drive the count negative.
    expect(CommunityAdmin.leave(left, 'sami').members).toBe(9);
  });

  it('removes a banned member from the roster', () => {
    const banned = CommunityAdmin.ban(base, 'lina', 'pub', 'anis');
    expect(banned.memberIds).not.toContain('lina');
    expect(banned.members).toBe(9);
  });

  it('re-adds someone promoted from outside the roster', () => {
    const stripped = { ...base, memberIds: ['anis'] };
    const promoted = CommunityAdmin.setStatus(stripped, 'ghost', 'mod');
    expect(promoted.memberIds).toContain('ghost');
    expect(promoted.members).toBe(11);
  });
});

describe('migrating a community saved by an older build', () => {
  it('demotes the old name lists to labels that grant nothing', () => {
    const legacy = {
      id: 'general',
      name: 'Général',
      ini: 'G',
      color: 'teal',
      type: 'open',
      members: 5,
      today: 0,
      desc: '',
      rules: [],
      admins: ['Gérant'],
      mods: ['Coach Anis'],
    } as unknown as Community;

    const c = migrateCommunity(legacy);
    expect(c.adminNames).toEqual(['Gérant']);
    expect(c.modNames).toEqual(['Coach Anis']);
    expect(c.adminIds).toEqual([]);
    expect(c.modIds).toEqual([]);
    expect(c.bans).toEqual([]);
    // Nobody inherits power from a name.
    expect(standingIn(c, 'Gérant', 'member')).toBe('member');
  });
});
