import { describe, expect, it } from 'vitest';
import {
  CommunityLike,
  canAcceptRequests,
  canBan,
  canCreateCommunity,
  canDeleteCommunity,
  canEditCommunity,
  canLeave,
  canOverride,
  canPost,
  canRead,
  canSee,
  canSetStatus,
  canTransferFounder,
  isIn,
  outranks,
} from './permissions';

const invite: CommunityLike = { id: 'hyrox', type: 'invite' };
const open: CommunityLike = { id: 'general', type: 'open' };
const official: CommunityLike = { id: 'club', type: 'official' };

describe('ranks', () => {
  it('counts the founder as a full member', () => {
    expect(isIn('founder')).toBe(true);
    expect(isIn('banned')).toBe(false);
    expect(isIn('pending')).toBe(false);
  });

  it('never lets equals outrank each other', () => {
    expect(outranks('admin', 'admin')).toBe(false);
    expect(outranks('mod', 'mod')).toBe(false);
    expect(outranks('founder', 'admin')).toBe(true);
    expect(outranks('mod', 'admin')).toBe(false);
  });

  it('puts a banned member below someone who never joined', () => {
    expect(outranks('none', 'banned')).toBe(true);
  });
});

describe('banning and removing', () => {
  it('lets a mod remove a plain member but not another mod', () => {
    expect(canBan('mod', 'member')).toBe(true);
    expect(canBan('mod', 'mod')).toBe(false);
    expect(canBan('mod', 'admin')).toBe(false);
  });

  it('never lets anyone ban the founder', () => {
    expect(canBan('admin', 'founder')).toBe(false);
    expect(canBan('founder', 'founder')).toBe(false);
    expect(canBan('mod', 'founder')).toBe(false);
  });

  it('refuses a plain member who tries to moderate', () => {
    expect(canBan('member', 'member')).toBe(false);
    expect(canBan('none', 'member')).toBe(false);
  });
});

describe('promoting and demoting', () => {
  it('lets an admin make a member a mod, but not another admin', () => {
    expect(canSetStatus('admin', 'member', 'mod')).toBe(true);
    expect(canSetStatus('admin', 'member', 'admin')).toBe(false); // never to your own rank
    expect(canSetStatus('admin', 'admin', 'mod')).toBe(false);
  });

  it('stops a mod handing out ranks at all', () => {
    expect(canSetStatus('mod', 'member', 'mod')).toBe(false);
  });

  it('makes the founder role transfer-only', () => {
    expect(canSetStatus('founder', 'member', 'founder')).toBe(false);
    expect(canTransferFounder('founder')).toBe(true);
    expect(canTransferFounder('admin')).toBe(false);
  });

  it('lets the founder demote an admin', () => {
    expect(canSetStatus('founder', 'admin', 'member')).toBe(true);
  });
});

describe('private communities and the club owner', () => {
  it('hides an invite-only community from everyone outside it', () => {
    expect(canSee(invite, 'none')).toBe(false);
    expect(canSee(invite, 'pending')).toBe(false);
    expect(canSee(invite, 'member')).toBe(true);
  });

  it('does not make the club owner an automatic exception', () => {
    // He must deliberately use the override, which gets recorded.
    expect(canSee(invite, 'none')).toBe(false);
    expect(canSee(invite, 'none', { override: true })).toBe(true);
    expect(canRead(invite, 'none', { override: true })).toBe(true);
  });

  it('allows the override only to the club owner', () => {
    expect(canOverride('owner')).toBe(true);
    expect(canOverride('coach')).toBe(false);
    expect(canOverride('member')).toBe(false);
  });
});

describe('posting', () => {
  it('keeps the official wall to the club owner', () => {
    expect(canPost(official, 'member', 'owner')).toBe(true);
    expect(canPost(official, 'member', 'coach')).toBe(false);
  });

  it('silences a banned member even where he was once in', () => {
    expect(canPost(open, 'banned', 'member')).toBe(false);
  });

  it('makes an expired membership read-only everywhere', () => {
    expect(canPost(open, 'admin', 'expired')).toBe(false);
  });
});

describe('leaving and deleting', () => {
  it('makes the founder hand over before leaving', () => {
    expect(canLeave('member')).toBe(true);
    expect(canLeave('admin')).toBe(true);
    expect(canLeave('founder')).toBe(false);
  });

  it('lets the founder or the club owner delete, nobody else', () => {
    expect(canDeleteCommunity('founder', 'member')).toBe(true);
    expect(canDeleteCommunity('none', 'owner')).toBe(true);
    expect(canDeleteCommunity('admin', 'member')).toBe(false);
  });

  it('keeps editing to admins and the founder', () => {
    expect(canEditCommunity('founder')).toBe(true);
    expect(canEditCommunity('admin')).toBe(true);
    expect(canEditCommunity('mod')).toBe(false);
  });
});

describe('creating a community', () => {
  it('is open to every active member, not only staff', () => {
    expect(canCreateCommunity('member')).toBe(true);
    expect(canCreateCommunity('coach')).toBe(true);
    expect(canCreateCommunity('owner')).toBe(true);
  });
  it('is closed to an expired membership (read-only)', () => {
    expect(canCreateCommunity('expired')).toBe(false);
  });
  it('makes the founder the one who accepts or refuses requests', () => {
    expect(canAcceptRequests('founder')).toBe(true);
    expect(canAcceptRequests('member')).toBe(false);
  });
});
