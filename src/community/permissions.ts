/**
 * Mur permissions — the single source of truth for who can see / read / post / manage.
 * Pure functions so they can be unit-tested and reused by the UI (hide buttons)
 * exactly as a server would enforce them.
 *
 * Standing inside one community is a rank, and almost every management action is
 * "you must outrank the person you are acting on". That one rule removes a whole
 * class of bugs: a mod cannot ban an admin, an admin cannot remove the founder,
 * and two people of equal rank can never fight over each other.
 */

export type ClubRole = 'owner' | 'coach' | 'member' | 'expired';
export type CommunityType = 'official' | 'open' | 'request' | 'invite';
/** The current user's standing in one community. */
export type MemStatus = 'none' | 'pending' | 'member' | 'mod' | 'admin' | 'founder' | 'banned';

export interface CommunityLike {
  id: string;
  type: CommunityType;
  womenOnly?: boolean;
}

/** Ranks. Banned sits below "never joined": it is a removal, not a neutral state. */
const RANK: Record<MemStatus, number> = {
  banned: -1,
  none: 0,
  pending: 1,
  member: 2,
  mod: 3,
  admin: 4,
  founder: 5,
};

export const rankOf = (s: MemStatus) => RANK[s];
/** Strictly above: equals never outrank each other. */
export const outranks = (actor: MemStatus, target: MemStatus) => RANK[actor] > RANK[target];

/** Active member of the community (can read/post). */
export const isIn = (status: MemStatus) =>
  status === 'member' || status === 'mod' || status === 'admin' || status === 'founder';

/**
 * Invite-only communities are invisible to non-members. The club owner is not an
 * exception by default — he sees one only by deliberately using the override,
 * and every use is recorded (see canOverride).
 */
export const canSee = (c: CommunityLike, status: MemStatus, opts: { override?: boolean } = {}) =>
  c.type !== 'invite' || isIn(status) || !!opts.override;

/** Official "Le Club" is readable by everyone; otherwise you must be an active member. */
export const canRead = (c: CommunityLike, status: MemStatus, opts: { override?: boolean } = {}) =>
  c.type === 'official' || isIn(status) || !!opts.override;

/** Post: official → owner only; others → active members. Expired memberships are read-only. */
export const canPost = (c: CommunityLike, status: MemStatus, role: ClubRole) => {
  if (role === 'expired') return false;
  if (status === 'banned') return false;
  if (c.type === 'official') return role === 'owner';
  return isIn(status);
};

/** Manage (accept/refuse, invite, hide, reports): mods and above of THAT community. */
export const canManage = (status: MemStatus) => status === 'mod' || status === 'admin' || status === 'founder';

/** Only admins and the founder can name a mod — plus the club owner anywhere. */
export const canNameMod = (status: MemStatus, role: ClubRole) =>
  status === 'admin' || status === 'founder' || role === 'owner';

/**
 * Create a community: anyone active in the club. The creator becomes its founder
 * (top rank: accepts or refuses requests, names admins and mods).
 * An expired membership is read-only, so it cannot found one.
 */
export const canCreateCommunity = (role: ClubRole) => canInteract(role);

/** Can this user act (join/request/like/comment) at all? Expired = read-only everywhere. */
export const canInteract = (role: ClubRole) => role !== 'expired';

/** A women-only "request" community only accepts requests from women. */
export const canRequest = (c: CommunityLike, status: MemStatus, role: ClubRole, gender?: string) => {
  if (!canInteract(role) || c.type !== 'request') return false;
  if (status === 'banned' || status === 'pending' || isIn(status)) return false;
  if (c.womenOnly && gender !== 'female') return false;
  return true;
};

/** Anonymous post: members only, questions only. */
export const canPostAnonymous = (role: ClubRole, kind: string) => role === 'member' && kind === 'question';

/* ---------- acting on another member ---------- */

/** Accept or refuse someone waiting at the door. */
export const canAcceptRequests = (status: MemStatus) => canManage(status);

/**
 * Remove or ban: you must manage the community AND outrank the target.
 * The founder can never be banned by anyone — he hands the community over first.
 */
export const canBan = (actor: MemStatus, target: MemStatus) =>
  canManage(actor) && target !== 'founder' && outranks(actor, target);

export const canUnban = (actor: MemStatus) => canManage(actor);

/** Promote or demote: admins and the founder only, and never to your own rank or above. */
export const canSetStatus = (actor: MemStatus, target: MemStatus, next: MemStatus) => {
  if (actor !== 'admin' && actor !== 'founder') return false;
  if (target === 'founder' || next === 'founder') return false; // handover only
  return outranks(actor, target) && RANK[next] < RANK[actor];
};

/** Only the founder hands the community to someone else. */
export const canTransferFounder = (actor: MemStatus) => actor === 'founder';

/** Delete a community: its founder, or the club owner. */
export const canDeleteCommunity = (actor: MemStatus, role: ClubRole) => actor === 'founder' || role === 'owner';

/** Edit the name, description and rules. */
export const canEditCommunity = (actor: MemStatus) => actor === 'admin' || actor === 'founder';

/**
 * Break-glass: the club owner may open a community he is not in, because he is
 * answerable for what happens in his club. It is never silent — every use is
 * written to the community's audit trail and shown to its members.
 */
export const canOverride = (role: ClubRole) => role === 'owner';

/** A founder may not simply leave: someone has to own the place. */
export const canLeave = (status: MemStatus) => isIn(status) && status !== 'founder';

export const REFUSED = {
  read: 'Cette communauté est réservée à ses membres.',
  post: 'Tu ne peux pas publier ici.',
  manage: 'Action réservée aux modérateurs de cette communauté.',
  expired: 'Ton abonnement a expiré : accès en lecture seule.',
  womenOnly: 'Cet espace est réservé aux femmes du club.',
  banned: 'Tu as été retiré de cette communauté.',
  outranked: 'Tu ne peux pas agir sur quelqu’un de ton rang ou au-dessus.',
  founderLeave: 'Transmets la communauté à quelqu’un avant de la quitter.',
} as const;
