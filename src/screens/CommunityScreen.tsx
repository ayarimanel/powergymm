import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { Icon } from '../components/ui/Icon';
import { CommunityPost, MemberProfile, UserProfile } from '../types/database';
import { GymConfigService } from '../config/gymConfig';
import { CommunityService } from '../services/communityService';
import { clubTheme, colors, communityTint, fonts, radius } from '../theme';
import { Title } from '../components/ui/Title';
import { ClubChallengeCard } from '../components/community/mur/ClubChallengeCard';
import { CommentActor, Community, CommunityAdmin, JoinRequest, MurComments, MurPost, MurService, PostKind, Report, memStatus, standingIn } from '../community/murService';
import { CommentsSheet } from '../components/community/CommentsSheet';
import { ClubRole, MemStatus, CommunityType, REFUSED, canAcceptRequests, canBan, canLeave, canManage, canSetStatus, canTransferFounder, canPost, canRead, canSee, canCreateCommunity, canOverride, isIn, rankOf } from '../community/permissions';
import { MurPostCard } from '../components/community/mur/MurPostCard';
import { PrStoriesRow } from '../components/community/PrStoriesRow';
import { PrStoryViewer } from '../components/community/PrStoryViewer';
import { CommunitySheet } from '../components/community/mur/CommunitySheet';
import { CreateCommunitySheet } from '../components/community/mur/CreateCommunitySheet';
import { MembersSheet } from '../components/community/mur/MembersSheet';
import { InviteSheet } from '../components/community/mur/InviteSheet';
import { AuditService } from '../services/auditService';
import { MurComposerSheet } from '../components/community/mur/MurComposerSheet';
import { Toast } from '../components/home/Toast';
import { useScrollToTopOnReselect } from '../navigation/tabEvents';
import { haptics } from '../utils/haptics';
import { CollapsibleFab, useCollapseOnScroll } from '../components/CollapsibleFab';
import { claimSwipe } from '../navigation/swipeGuard';

interface Props {
  user: UserProfile;
  focusPostId?: string | null;
  onFocusHandled?: () => void;
  onOpenAccount: () => void;
}

type Tab = 'fyp' | 'comm' | 'manage';
type Filter = 'all' | 'record' | 'question' | 'official';

/** Your rank, shown on your own communities. Plain members get no tag. */
const RANK_TAG: Partial<Record<MemStatus, string>> = { founder: 'Fondateur', admin: 'Admin', mod: 'Modérateur' };
/** Communities shown on "Pour toi" before "Voir tout". */
const MINE_PREVIEW = 3;

const ROLE_LABEL: Record<ClubRole, string> = { owner: 'Gérant', coach: 'Coach', member: 'Membre', expired: 'Expiré' };
const TYPE_META: Record<CommunityType, { label: string; color: Parameters<typeof communityTint>[0] }> = {
  official: { label: 'Officielle', color: 'accent' },
  open: { label: 'Ouverte', color: 'calm' },
  request: { label: 'Sur demande', color: 'mid' },
  invite: { label: 'Sur invitation', color: 'violet' },
};
const after = (fn: () => void) => setTimeout(fn, 280);
const membersLabel = (n: number) => `${n} membre${n > 1 ? 's' : ''}`;

export const CommunityScreen: React.FC<Props> = ({ user, onOpenAccount }) => {
  const role: ClubRole = user.role === 'owner' ? 'owner' : user.role === 'coach' ? 'coach' : 'member';
  const meInit = (user.fullName || '?').trim().charAt(0).toUpperCase();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [membership, setMembership] = useState<Record<string, MemStatus>>({});
  const [posts, setPosts] = useState<MurPost[]>([]);
  const [requests, setRequests] = useState<Record<string, JoinRequest[]>>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [gymName, setGymName] = useState('');

  const [tab, setTab] = useState<Tab>('fyp');
  const [filter, setFilter] = useState<Filter>('all');
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [detailCid, setDetailCid] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ open: boolean; cid: string | null }>({ open: false, cid: null });
  const [toast, setToast] = useState<string | null>(null);
  const [prStoryIndex, setPrStoryIndex] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});

  const scrollRef = useScrollToTopOnReselect('community');
  const { collapsed: fabCollapsed, scrollProps } = useCollapseOnScroll();

  useEffect(() => {
    // The demo communities ship ownerless; the club owner adopts them on first
    // open so every community has someone answerable for it.
    (role === 'owner' ? MurService.adoptSeedCommunities(user.id) : MurService.getCommunities()).then(setCommunities);
    MurService.getMembership(user.id, role).then(setMembership);
    MurService.getPosts().then(setPosts);
    MurService.getRequests().then(setRequests);
    MurService.getReports().then(setReports);
    CommunityService.getProfiles().then(setProfiles);
    GymConfigService.getConfig().then(c => setGymName(c.name));
  }, [user.id, role]);

  const byId = (cid: string) => communities.find(c => c.id === cid);

  /**
   * Real standing: the community's own founder/admin/mod/ban lists win over the
   * membership map. Going through standingIn, rather than reading the map alone,
   * is what stops a display name granting anything.
   */
  const stat = (cid: string): MemStatus => {
    const c = byId(cid);
    let fromMap = memStatus(membership, cid);
    // "Pending" only while the request is still in the waiting list: once refused it is gone, so you may ask again.
    if (fromMap === 'pending' && !(requests[cid] ?? []).some(r => r.id === user.id)) fromMap = 'none';
    return c ? standingIn(c, user.id, fromMap) : fromMap;
  };

  const [showCreate, setShowCreate] = useState(false);

  /** The founder joins his own community as its founder, and the act is logged. */
  const createCommunity = (c: Community) => {
    persistCommunities([...communities, c]);
    persistMembership({ ...membership, [c.id]: 'member' }); // standingIn promotes him to founder
    AuditService.log({ action: 'community.created', actorId: user.id, actorName: user.fullName, communityId: c.id });
    setShowCreate(false);
    setToast(`« ${c.name} » créée`);
  };

  /** Someone else's standing in a community — needed to check you outrank them. */
  const standingOf = (cid: string, userId: string): MemStatus => {
    const c = byId(cid);
    return c ? standingIn(c, userId, 'member') : 'member';
  };

  /** Remove a member from one community. The reason is kept so an unban is a decision. */
  const banFromCommunity = (cid: string, targetId: string, targetName: string) => {
    const c = byId(cid);
    if (!c || !canBan(stat(cid), standingOf(cid, targetId))) return setToast(REFUSED.outranked);
    persistCommunities(communities.map(x => (x.id === cid ? CommunityAdmin.ban(x, targetId, 'Retiré par un modérateur', user.id) : x)));
    AuditService.log({
      action: 'community.banned',
      actorId: user.id,
      actorName: user.fullName,
      targetId,
      targetName,
      communityId: cid,
      reason: 'Retiré par un modérateur',
    });
    setToast(`${targetName} a été retiré de ${c.name}`);
  };

  /** The community whose member list is open. */
  const [membersCid, setMembersCid] = useState<string | null>(null);
  /** The invite-only community we are inviting into. */
  const [inviteCid, setInviteCid] = useState<string | null>(null);

  /** An invite puts the member straight in: the manager vouched for them. */
  const inviteTo = (cid: string, targetId: string, targetName: string) => {
    if (!canManage(stat(cid))) return setToast(REFUSED.manage);
    editCommunity(cid, c => CommunityAdmin.join(c, targetId));
    AuditService.log({ action: 'community.accepted', actorId: user.id, actorName: user.fullName, targetId, targetName, communityId: cid });
    setToast(`${targetName} a rejoint`);
  };

  const editCommunity = (cid: string, fn: (c: Community) => Community) =>
    persistCommunities(communities.map(x => (x.id === cid ? fn(x) : x)));

  const unbanFrom = (cid: string, targetId: string, targetName: string) => {
    editCommunity(cid, c => CommunityAdmin.unban(c, targetId));
    AuditService.log({ action: 'community.unbanned', actorId: user.id, actorName: user.fullName, targetId, targetName, communityId: cid });
    setToast(`${targetName} peut de nouveau rejoindre`);
  };

  const setStatusIn = (cid: string, targetId: string, targetName: string, next: 'member' | 'mod' | 'admin') => {
    if (!canSetStatus(stat(cid), standingOf(cid, targetId), next)) return setToast(REFUSED.outranked);
    editCommunity(cid, c => CommunityAdmin.setStatus(c, targetId, next));
    AuditService.log({
      action: next === 'member' ? 'community.demoted' : 'community.promoted',
      actorId: user.id,
      actorName: user.fullName,
      targetId,
      targetName,
      communityId: cid,
    });
    setToast(next === 'member' ? `${targetName} redevient membre` : `${targetName} est ${next === 'mod' ? 'modérateur' : 'admin'}`);
  };

  const transferFounderTo = (cid: string, targetId: string, targetName: string) => {
    if (!canTransferFounder(stat(cid))) return setToast(REFUSED.manage);
    editCommunity(cid, c => CommunityAdmin.transferFounder(c, targetId));
    AuditService.log({ action: 'community.transferred', actorId: user.id, actorName: user.fullName, targetId, targetName, communityId: cid });
    setToast(`${targetName} est maintenant fondateur`);
  };

  const persistMembership = (m: Record<string, MemStatus>) => { setMembership(m); MurService.saveMembership(user.id, m); };
  const persistCommunities = (list: Community[]) => { setCommunities(list); MurService.saveCommunities(list); };
  const persistPosts = (list: MurPost[]) => { setPosts(list); MurService.savePosts(list); };

  // ---- Comments ----
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const commentsPost = posts.find(p => p.id === commentsPostId) ?? null;
  const actorFor = (p: MurPost): CommentActor => ({ id: user.id, canModerate: canManage(stat(p.cid)) });
  const updatePost = (pid: string, fn: (p: MurPost) => MurPost) =>
    setPosts(prev => {
      const next = prev.map(p => (p.id === pid ? fn(p) : p));
      MurService.savePosts(next);
      return next;
    });
  const addComment = (pid: string, text: string) => {
    updatePost(pid, p => MurComments.add(p, { authorId: user.id, author: user.fullName, avatarUrl: user.avatarUrl, text }));
    haptics.light();
  };
  const deleteComment = (pid: string, commentId: string) => {
    updatePost(pid, p => MurComments.remove(p, commentId, actorFor(p)));
    setToast('Commentaire supprimé');
  };
  const deleteAllComments = (pid: string) => {
    updatePost(pid, p => MurComments.removeAll(p, actorFor(p)));
    setToast('Tous les commentaires ont été supprimés');
  };
  const toggleCommentLike = (pid: string, commentId: string) => {
    updatePost(pid, p => MurComments.toggleLike(p, commentId, user.id));
    haptics.light();
  };
  const persistRequests = (r: Record<string, JoinRequest[]>) => { setRequests(r); MurService.saveRequests(r); };
  const persistReports = (r: Report[]) => { setReports(r); MurService.saveReports(r); };

  const pendingCount = useMemo(
    () =>
      communities.filter(c => canManage(stat(c.id))).reduce((a, c) => a + (requests[c.id]?.length ?? 0), 0) +
      (role !== 'member' ? reports.filter(r => canManage(stat(r.cid))).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [communities, membership, requests, reports, role]
  );

  // "Gérer" is for staff, and for anyone who founded or helps run a community.
  const managesAny = communities.some(c => canManage(stat(c.id)));
  const tabs: [Tab, string][] =
    role === 'member' && !managesAny ? [['fyp', 'Pour toi'], ['comm', 'Communautés']] : [['fyp', 'Pour toi'], ['comm', 'Communautés'], ['manage', 'Gérer']];
  useEffect(() => { if (!tabs.some(t => t[0] === tab)) setTab('fyp'); /* eslint-disable-next-line */ }, [role, managesAny]);

  // ---- Actions ----
  const openComposer = (cid?: string) => {
    const target = cid && cid !== 'club' && canPost(byId(cid)!, stat(cid), role) ? cid : null;
    setComposer({ open: true, cid: target });
  };

  const join = (cid: string) => {
    if (stat(cid) === 'banned') return setToast(REFUSED.banned);
    persistMembership({ ...membership, [cid]: 'member' });
    editCommunity(cid, c => CommunityAdmin.join(c, user.id));
    setDetailCid(null);
    haptics.light();
    setToast(`Bienvenue dans ${byId(cid)?.name} !`);
  };
  /** Ask to join: the request lands in the founder's (and admins') "Gérer" list. */
  const request = (cid: string) => {
    const c = byId(cid);
    if (!c) return;
    const mine: JoinRequest = { id: user.id, cid, name: user.fullName || 'Membre', init: meInit, note: '', since: 'à l’instant' };
    const list = (requests[cid] ?? []).filter(r => r.id !== user.id);
    persistRequests({ ...requests, [cid]: [...list, mine] });
    persistMembership({ ...membership, [cid]: 'pending' });
    setDetailCid(null);
    setToast(c.adminNames[0] ? `Demande envoyée à ${c.adminNames[0]}` : 'Demande envoyée');
  };
  const leave = (cid: string) => {
    // A founder would orphan the community: he transfers it first.
    if (!canLeave(stat(cid))) return setToast(REFUSED.founderLeave);
    persistMembership({ ...membership, [cid]: 'none' });
    editCommunity(cid, c => CommunityAdmin.leave(c, user.id));
    setDetailCid(null);
    setToast('Tu as quitté la communauté');
  };
  const accept = (cid: string, rid: string) => {
    if (!canAcceptRequests(stat(cid))) return setToast(REFUSED.manage);
    const r = requests[cid]?.find(x => x.id === rid);
    persistRequests({ ...requests, [cid]: (requests[cid] ?? []).filter(x => x.id !== rid) });
    editCommunity(cid, c => CommunityAdmin.join(c, r?.id ?? rid));
    AuditService.log({ action: 'community.accepted', actorId: user.id, actorName: user.fullName, targetName: r?.name, communityId: cid });
    setToast(`${r?.name} a rejoint ${byId(cid)?.name}`);
  };
  const refuse = (cid: string, rid: string) => {
    if (!canAcceptRequests(stat(cid))) return setToast(REFUSED.manage);
    const r = requests[cid]?.find(x => x.id === rid);
    persistRequests({ ...requests, [cid]: (requests[cid] ?? []).filter(x => x.id !== rid) });
    AuditService.log({ action: 'community.refused', actorId: user.id, actorName: user.fullName, targetName: r?.name, communityId: cid });
    setToast(`Demande de ${r?.name} refusée`);
  };
  const resolveReport = (id: string, del: boolean) => {
    persistReports(reports.filter(r => r.id !== id));
    setToast(del ? 'Post supprimé' : 'Post conservé');
  };
  const hide = (pid: string) => {
    persistPosts(posts.filter(p => p.id !== pid));
    setToast("Post masqué. L'auteur est prévenu.");
  };
  const toggleLike = (pid: string) => {
    const next = new Set(liked);
    next.has(pid) ? next.delete(pid) : (next.add(pid), haptics.light());
    setLiked(next);
  };
  const sendPost = (cid: string, kind: PostKind, text: string, anon: boolean) => {
    setComposer({ open: false, cid: null });
    const c = byId(cid)!;
    if (anon || kind === 'record') {
      setToast(anon ? 'Question envoyée aux modérateurs. Publiée après validation.' : 'Record envoyé au coach pour validation');
      return;
    }
    const post: MurPost = {
      id: 'n' + Date.now(),
      authorId: user.id,
      comments: [],
      cid,
      kind,
      author: role === 'owner' && cid === 'club' ? clubTheme.clubName : user.fullName,
      init: meInit,
      ago: "à l'instant",
      text,
      media: kind === 'official' ? 'Annonce du club' : null,
      likes: 0,
    };
    persistPosts([post, ...posts]);
    setTab('fyp');
    setFilter('all');
    setToast(`Publié dans ${c.name}`);
  };

  // ---- Records rail (golden PR stories) — sourced from Mur record posts ----
  const parseAgoIso = (s: string): string => {
    const m = s.match(/il y a (\d+)\s*(min|h|j)/);
    if (!m) return new Date().toISOString();
    const n = parseInt(m[1], 10);
    const ms = m[2] === 'min' ? n * 60_000 : m[2] === 'h' ? n * 3_600_000 : n * 86_400_000;
    return new Date(Date.now() - ms).toISOString();
  };
  const murRecordToCommunityPost = (p: MurPost): CommunityPost => ({
    id: p.id,
    gymId: 'gym-app-01',
    userId: p.id, // no real userId on MurPost — avatar falls back to initials
    userName: p.author ?? 'Membre',
    category: 'pr',
    isPR: true,
    prDetails: p.kg != null && p.reps != null && p.lift ? { exercise: p.lift, weightKg: p.kg, reps: p.reps } : undefined,
    prApproval: p.validatedBy ? { status: 'approved', approvedByName: p.validatedBy, approvedAt: parseAgoIso(p.ago) } : { status: 'pending' },
    caption: p.text ?? '',
    comments: [],
    likesCount: p.likes,
    canDelete: false,
    createdAt: parseAgoIso(p.ago),
  });
  const prRecords = posts
    .filter(p => p.kind === 'record' && p.kg != null && p.reps != null && p.lift)
    .map(murRecordToCommunityPost);

  // ---- Derived ----
  const mine = communities
    .filter(c => isIn(stat(c.id)))
    .map((c, i) => ({ c, i, s: stat(c.id) }))
    .sort((a, b) =>
      (canManage(b.s) ? requests[b.c.id]?.length ?? 0 : 0) - (canManage(a.s) ? requests[a.c.id]?.length ?? 0 : 0) ||
      rankOf(b.s) - rankOf(a.s) ||
      a.i - b.i
    )
    .map(x => x.c);
  /**
   * Break-glass: the club owner may open a private community he is not in,
   * because he answers for what happens in his club — but only by asking for it,
   * and the community's members see that he did.
   */
  const [overrides, setOverrides] = useState<string[]>([]);
  const useOverride = (c: Community) => {
    setOverrides(o => (o.includes(c.id) ? o : [...o, c.id]));
    AuditService.log({ action: 'community.owner_override', actorId: user.id, actorName: user.fullName, communityId: c.id });
    setToast('Consultation enregistrée : les membres en sont informés.');
  };
  const seeOpts = (cid: string) => ({ override: canOverride(role) && overrides.includes(cid) });

  const visible = communities.filter(c => canSee(c, stat(c.id), seeOpts(c.id)));
  /** Private communities the owner could open, but has not. */
  const lockedForOwner = canOverride(role)
    ? communities.filter(c => !canSee(c, stat(c.id), seeOpts(c.id)))
    : [];
  const discover = visible.filter(c => !isIn(stat(c.id)));
  const feedFilters: [Filter, string][] = [['all', 'Tout'], ['record', 'Records'], ['question', 'Questions'], ['official', 'Le Club']];
  const feed = posts.filter(p => canRead(byId(p.cid) ?? { id: p.cid, type: 'open' } as any, stat(p.cid), seeOpts(p.cid)) && (filter === 'all' || (filter === 'official' ? p.kind === 'official' : p.kind === filter)));
  const postCircles = visible.filter(c => canPost(c, stat(c.id), role));

  const detail = detailCid ? byId(detailCid) ?? null : null;

  /**
   * One of your communities, as a row: what it is, how big, your rank, and what
   * is waiting for you. Bubbles are kept for the club records only.
   */
  const mineRow = (c: Community, i: number) => {
    const t = communityTint(c.color);
    const s = stat(c.id);
    const rank = RANK_TAG[s];
    const waiting = canManage(s) ? requests[c.id]?.length ?? 0 : 0;
    return (
      <Pressable
        key={c.id}
        onPress={() => setDetailCid(c.id)}
        accessibilityRole="button"
        accessibilityLabel={`${c.name}, ${c.members} membres${rank ? `, ${rank}` : ''}${waiting ? `, ${waiting} demandes` : ''}`}
        style={({ pressed }) => [styles.drow, i > 0 && styles.drowBorder, pressed && styles.drowPressed]}
      >
        <View style={[styles.drowIc, { backgroundColor: t.soft }]}><Text style={[styles.drowIcText, { color: t.bar }]}>{c.ini}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.mineTitle}>
            <Text style={styles.drowName} numberOfLines={1}>{c.name}</Text>
            {!!rank && <View style={styles.rankTag}><Text style={styles.rankTagText}>{rank}</Text></View>}
          </View>
          <Text style={styles.drowSub} numberOfLines={1}>
            {membersLabel(c.members)} · {TYPE_META[c.type].label}
            {c.today > 0 ? ` · ${c.today} nouveau${c.today > 1 ? 'x' : ''} aujourd’hui` : ''}
          </Text>
        </View>
        {waiting > 0 && (
          <View style={styles.waitPill}><Text style={styles.waitPillText}>{waiting}</Text></View>
        )}
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  };

  const createCard = canCreateCommunity(role) && (
    <Pressable onPress={() => setShowCreate(true)} accessibilityRole="button" style={({ pressed }) => [styles.createCard, pressed && { opacity: 0.85 }]}>
      <View style={styles.createIc}><Icon name="add" size={22} color={colors.onBrand} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.createTitle}>Créer une communauté</Text>
        <Text style={styles.createSub}>Tu en es le fondateur : tu acceptes ou refuses chaque demande.</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.brand} />
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* The page title left for the logo band on top (TopBanner) */}
          <View style={styles.subRow}>
            <Text style={styles.subtitle} numberOfLines={1}>{gymName || 'Membres du club uniquement'}</Text>
            <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{ROLE_LABEL[role]}</Text></View>
          </View>
        </View>
        <Pressable onPress={onOpenAccount} accessibilityRole="button" accessibilityLabel="Mon profil" style={styles.avatar}>
          <Text style={styles.avatarText}>{meInit}</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map(([k, l]) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => { setTab(k); }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && styles.tabOn]}>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{l}</Text>
              {k === 'manage' && pendingCount > 0 && <View style={styles.cnt}><Text style={styles.cntText}>{pendingCount}</Text></View>}
            </Pressable>
          );
        })}
      </View>

      <ScrollView ref={scrollRef} {...scrollProps} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'fyp' && (
          <>
            {/* Demo: the app has no challenges yet (see ClubChallengeCard). */}
            <ClubChallengeCard onJoin={() => setToast('Inscris-toi à l’accueil du club avant samedi')} />

            {prRecords.length > 0 && (
              <PrStoriesRow records={prRecords} profiles={profiles} onOpen={setPrStoryIndex} />
            )}

            <View style={styles.secH}>
              <Text style={styles.h2} accessibilityRole="header">Mes communautés</Text>
              <Pressable onPress={() => setTab('comm')} accessibilityRole="button">
                <Text style={styles.link}>{mine.length > MINE_PREVIEW ? `Voir tout (${mine.length})` : 'Explorer'}</Text>
              </Pressable>
            </View>
            {mine.length > 0 ? (
              <View style={[styles.card, { overflow: 'hidden' }]}>{mine.slice(0, MINE_PREVIEW).map(mineRow)}</View>
            ) : (
              <Pressable onPress={() => setTab('comm')} accessibilityRole="button" style={[styles.card, styles.emptyCard]}>
                <Text style={styles.empty}>Tu n’es dans aucune communauté. Touche ici pour en trouver une.</Text>
              </Pressable>
            )}

            <Pressable onPress={() => openComposer()} accessibilityRole="button" style={styles.composer}>
              <View style={styles.composerAv}><Text style={styles.composerAvText}>{meInit}</Text></View>
              <Text style={styles.composerText} numberOfLines={1}>Pose une question ou partage un record…</Text>
            </Pressable>

            <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {feedFilters.map(([k, l]) => (
                <Pressable key={k} onPress={() => setFilter(k)} accessibilityRole="button" accessibilityState={{ selected: filter === k }} style={[styles.chip, filter === k && styles.chipOn]}>
                  <Text style={[styles.chipText, filter === k && styles.chipTextOn]}>{l}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {feed.length > 0 ? (
              feed.map(p => (
                <MurPostCard
                  key={p.id}
                  post={p}
                  community={byId(p.cid)!}
                  liked={liked.has(p.id)}
                  canManage={canManage(stat(p.cid))}
                  canBan={!!p.authorId && p.authorId !== user.id && canBan(stat(p.cid), standingOf(p.cid, p.authorId))}
                  onBan={() => banFromCommunity(p.cid, p.authorId!, p.author ?? 'ce membre')}
                  onLike={() => toggleLike(p.id)}
                  onReply={() => setCommentsPostId(p.id)}
                  onHide={() => hide(p.id)}
                />
              ))
            ) : (
              <Text style={styles.empty}>Rien ici pour l'instant. Rejoins une communauté pour remplir ton fil.</Text>
            )}
          </>
        )}

        {tab === 'comm' && (
          <>
            {createCard}

            <View style={styles.secH}>
              <Text style={styles.h2} accessibilityRole="header">Mes communautés</Text>
              <Text style={styles.small}>{mine.length}</Text>
            </View>
            <View style={[styles.card, { overflow: 'hidden' }]}>
              {mine.length > 0 ? mine.map(mineRow) : <Text style={styles.empty}>Rejoins une communauté ci-dessous, ou crée la tienne.</Text>}
            </View>

            {/* Owner break-glass: visible, deliberate, and recorded. */}
            {lockedForOwner.length > 0 && (
              <>
                <View style={styles.secH}>
                  <Text style={styles.h2} accessibilityRole="header">Communautés privées</Text>
                </View>
                <View style={[styles.card, { padding: 14, gap: 10 }]}>
                  <Text style={styles.ovText}>
                    Tu n’es pas membre de {lockedForOwner.length} communauté{lockedForOwner.length > 1 ? 's' : ''} privée
                    {lockedForOwner.length > 1 ? 's' : ''}. En tant que gérant tu peux les consulter, mais leurs membres
                    verront que tu l’as fait.
                  </Text>
                  {lockedForOwner.map(c => (
                    <Pressable
                      key={c.id}
                      onPress={() => useOverride(c)}
                      accessibilityRole="button"
                      accessibilityLabel={`Consulter ${c.name} en tant que gérant`}
                      style={styles.ovRow}
                    >
                      <Icon name="lock-closed-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.ovName}>{c.name}</Text>
                      <Text style={styles.ovCta}>Consulter</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <View style={styles.secH}>
              <Text style={styles.h2} accessibilityRole="header">À découvrir</Text>
            </View>

            <View style={[styles.card, { overflow: 'hidden' }]}>
              {discover.length > 0 ? discover.map((c, i) => {
                const t = communityTint(c.color);
                const s = stat(c.id);
                const label = s === 'pending' ? 'En attente' : c.type === 'open' ? 'Rejoindre' : 'Demander';
                return (
                  <Pressable key={c.id} onPress={() => setDetailCid(c.id)} accessibilityRole="button" style={[styles.drow, i > 0 && styles.drowBorder]}>
                    <View style={[styles.drowIc, { backgroundColor: t.soft }]}><Text style={[styles.drowIcText, { color: t.bar }]}>{c.ini}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.drowName}>{c.name}</Text>
                      <View style={styles.drowMeta}>
                        <View style={[styles.typeTag, { backgroundColor: communityTint(TYPE_META[c.type].color).soft }]}>
                          <Text style={[styles.typeTagText, { color: communityTint(TYPE_META[c.type].color).text }]}>{TYPE_META[c.type].label}</Text>
                        </View>
                        <Text style={styles.drowSub}>{membersLabel(c.members)}{c.womenOnly ? ' · femmes' : ''}</Text>
                      </View>
                    </View>
                    <View style={[styles.drowBtn, s === 'pending' ? styles.drowBtnOff : styles.drowBtnSoft]}>
                      <Text style={[styles.drowBtnText, { color: s === 'pending' ? colors.textMuted : colors.brandText }]}>{label}</Text>
                    </View>
                  </Pressable>
                );
              }) : <Text style={styles.empty}>Tu fais déjà partie de toutes les communautés.</Text>}
            </View>

            <View style={styles.info}>
              <Text style={styles.infoText}>
                <Text style={styles.b}>Comment ça marche : </Text>
                <Text style={styles.b}>Ouverte</Text> = tu rejoins tout de suite. <Text style={styles.b}>Sur demande</Text> = le fondateur ou un admin accepte ou refuse. <Text style={styles.b}>Sur invitation</Text> = invisible, un admin t'ajoute. Tout reste entre membres du club.
              </Text>
            </View>
          </>
        )}

        {tab === 'manage' && <ManageTab communities={communities} stat={stat} requests={requests} reports={reports} onAccept={accept} onRefuse={refuse} onResolve={resolveReport} onOpen={setDetailCid} byId={byId} />}
      </ScrollView>

      <CollapsibleFab icon="add" label="Publier" collapsed={fabCollapsed} onPress={() => openComposer()} />

      <Toast message={toast} onHide={() => setToast(null)} />

      <InviteSheet
        visible={!!inviteCid}
        community={inviteCid ? byId(inviteCid) ?? null : null}
        profiles={profiles}
        onClose={() => setInviteCid(null)}
        onInvite={(id, name) => inviteCid && inviteTo(inviteCid, id, name)}
      />
      <MembersSheet
        visible={!!membersCid}
        community={membersCid ? byId(membersCid) ?? null : null}
        profiles={profiles}
        meId={user.id}
        myStatus={membersCid ? stat(membersCid) : 'none'}
        role={role}
        onClose={() => setMembersCid(null)}
        onBan={(id, name) => membersCid && banFromCommunity(membersCid, id, name)}
        onUnban={(id, name) => membersCid && unbanFrom(membersCid, id, name)}
        onSetStatus={(id, name, next) => membersCid && setStatusIn(membersCid, id, name, next)}
        onTransfer={(id, name) => membersCid && transferFounderTo(membersCid, id, name)}
      />
      <CreateCommunitySheet
        visible={showCreate}
        takenIds={communities.map(c => c.id)}
        founderId={user.id}
        founderName={user.fullName || 'Membre'}
        onClose={() => setShowCreate(false)}
        onCreate={createCommunity}
      />
      <CommunitySheet
        community={detail}
        status={detail ? stat(detail.id) : 'none'}
        role={role}
        requestsCount={detail ? requests[detail.id]?.length ?? 0 : 0}
        onClose={() => setDetailCid(null)}
        onJoin={() => detail && join(detail.id)}
        onRequest={() => detail && request(detail.id)}
        onLeave={() => detail && leave(detail.id)}
        onCompose={() => { const id = detail?.id; setDetailCid(null); after(() => openComposer(id)); }}
        onInvite={() => { const id = detail?.id; setDetailCid(null); after(() => setInviteCid(id ?? null)); }}
        onMembers={() => { const id = detail?.id; setDetailCid(null); after(() => setMembersCid(id ?? null)); }}
        onRequests={() => { setDetailCid(null); setTab('manage'); }}
      />

      <PrStoryViewer
        records={prRecords}
        profiles={profiles}
        startIndex={prStoryIndex}
        onClose={() => setPrStoryIndex(null)}
        onOpenPost={() => setPrStoryIndex(null)}
      />

      <CommentsSheet
        post={commentsPost}
        me={user}
        canModerate={!!commentsPost && canManage(stat(commentsPost.cid))}
        onClose={() => setCommentsPostId(null)}
        onAdd={addComment}
        onDelete={deleteComment}
        onDeleteAll={deleteAllComments}
        onToggleLike={toggleCommentLike}
      />

      <MurComposerSheet
        visible={composer.open}
        communities={postCircles}
        role={role}
        initialCid={composer.cid}
        onClose={() => setComposer({ open: false, cid: null })}
        onSend={sendPost}
      />
    </View>
  );
};

// ---- Manage tab ----
const ManageTab: React.FC<{
  communities: Community[];
  stat: (cid: string) => MemStatus;
  requests: Record<string, JoinRequest[]>;
  reports: Report[];
  onAccept: (cid: string, rid: string) => void;
  onRefuse: (cid: string, rid: string) => void;
  onResolve: (id: string, del: boolean) => void;
  onOpen: (cid: string) => void;
  byId: (cid: string) => Community | undefined;
}> = ({ communities, stat, requests, reports, onAccept, onRefuse, onResolve, onOpen, byId }) => {
  const own = communities.filter(c => canManage(stat(c.id)));
  const withReqs = own.filter(c => (requests[c.id]?.length ?? 0) > 0);
  const myReports = reports.filter(r => canManage(stat(r.cid)));
  const totalReqs = withReqs.reduce((a, c) => a + (requests[c.id]?.length ?? 0), 0);

  return (
    <>
      <View style={styles.secH}><Text style={styles.h2} accessibilityRole="header">Demandes d'adhésion</Text><Text style={styles.small}>{totalReqs} en attente</Text></View>
      {withReqs.length > 0 ? withReqs.map(c => {
        const t = communityTint(c.color);
        return (
          <View key={c.id} style={[styles.card, styles.mcard]}>
            <View style={styles.secH}><Text style={[styles.mcardTitle, { color: t.bar }]}>{c.name}</Text>
              <View style={[styles.typeTag, { backgroundColor: communityTint(TYPE_META[c.type].color).soft }]}><Text style={[styles.typeTagText, { color: communityTint(TYPE_META[c.type].color).text }]}>{TYPE_META[c.type].label}</Text></View>
            </View>
            {(requests[c.id] ?? []).map(r => (
              <View key={r.id} style={styles.req}>
                <View style={[styles.reqAv, { backgroundColor: t.soft }]}><Text style={[styles.reqAvText, { color: t.bar }]}>{r.init}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.reqName}>{r.name}</Text>
                  <Text style={styles.reqSmall}>Membre du club · {r.since}</Text>
                  {!!r.note && <Text style={styles.reqNote}>« {r.note} »</Text>}
                </View>
                <View style={styles.reqBtns}>
                  <Pressable onPress={() => onAccept(c.id, r.id)} accessibilityRole="button" style={[styles.mBtn, { backgroundColor: colors.green.soft }]}><Text style={[styles.mBtnText, { color: colors.green.text }]}>Accepter</Text></Pressable>
                  <Pressable onPress={() => onRefuse(c.id, r.id)} accessibilityRole="button" style={[styles.mBtn, { backgroundColor: colors.red.soft }]}><Text style={[styles.mBtnText, { color: colors.red.text }]}>Refuser</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        );
      }) : <View style={[styles.card, styles.emptyCard]}><Text style={styles.empty}>Aucune demande en attente.</Text></View>}

      <View style={styles.secH}><Text style={styles.h2} accessibilityRole="header">Signalements</Text><Text style={styles.small}>masqué auto à 3 signalements</Text></View>
      {myReports.length > 0 ? myReports.map(r => (
        <View key={r.id} style={[styles.card, styles.mcard]}>
          <View style={styles.req}>
            <View style={[styles.reqAv, { backgroundColor: colors.red.soft }]}><Text style={[styles.reqAvText, { color: colors.red.text }]}>!</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.reqName}>{r.author}</Text>
              <Text style={styles.reqSmall}>{byId(r.cid)?.name} · {r.reason} · {r.count} signalements</Text>
              <Text style={styles.reqNote}>« {r.text} »</Text>
            </View>
            <View style={styles.reqBtns}>
              <Pressable onPress={() => onResolve(r.id, true)} accessibilityRole="button" style={[styles.mBtn, { backgroundColor: colors.red.soft }]}><Text style={[styles.mBtnText, { color: colors.red.text }]}>Supprimer</Text></Pressable>
              <Pressable onPress={() => onResolve(r.id, false)} accessibilityRole="button" style={[styles.mBtn, { backgroundColor: colors.track }]}><Text style={[styles.mBtnText, { color: colors.textMuted }]}>Garder</Text></Pressable>
            </View>
          </View>
        </View>
      )) : <View style={[styles.card, styles.emptyCard]}><Text style={styles.empty}>Aucun signalement.</Text></View>}

      <View style={styles.secH}><Text style={styles.h2} accessibilityRole="header">Tes communautés</Text></View>
      <View style={[styles.card, { overflow: 'hidden' }]}>
        {own.map((c, i) => {
          const t = communityTint(c.color);
          return (
            <Pressable key={c.id} onPress={() => onOpen(c.id)} accessibilityRole="button" style={[styles.drow, i > 0 && styles.drowBorder]}>
              <View style={[styles.drowIc, { backgroundColor: t.soft }]}><Text style={[styles.drowIcText, { color: t.bar }]}>{c.ini}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.drowName}>{c.name}</Text>
                <Text style={styles.drowSub}>Ton rôle : {RANK_TAG[stat(c.id)] ?? 'Membre'} · {membersLabel(c.members)}</Text>
              </View>
              <View style={[styles.drowBtn, styles.drowBtnSoft]}><Text style={[styles.drowBtnText, { color: colors.brandText }]}>Ouvrir</Text></View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  ovText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  ovRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  ovName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  ovCta: { fontSize: 14, fontWeight: '800', color: colors.brand },
  screen: { flex: 1, backgroundColor: colors.page },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, backgroundColor: colors.header },
  brandIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: communityTint('accent').soft, alignItems: 'center', justifyContent: 'center' },
  brandIconText: { color: colors.brand, fontWeight: '800', fontSize: 13 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 20 },
  subtitle: { flexShrink: 1, fontSize: 13, color: colors.textMuted },
  roleBadge: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brandText, fontWeight: '800', fontSize: 17 },

  tabs: { flexDirection: 'row', gap: 4, marginHorizontal: 16, marginBottom: 8, padding: 4, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', gap: 6, borderRadius: 999, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.brand },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  tabTextOn: { color: colors.white, fontWeight: '800' },
  cnt: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.red.bar, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  cntText: { color: colors.white, fontSize: 11, fontWeight: '800' },

  scroll: { padding: 16, paddingBottom: 120, gap: 16 },
  secH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 },
  h2: { flexShrink: 1, fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 24, lineHeight: 27, textTransform: 'uppercase', color: colors.text },
  small: { fontSize: 13, color: colors.textMuted },
  link: { fontSize: 13, fontWeight: '700', color: colors.brand, padding: 4 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.cardLg },


  composer: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 8, paddingLeft: 8, paddingRight: 18, minHeight: 56 },
  composerAv: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  composerAvText: { color: colors.brandText, fontWeight: '800', fontSize: 14 },
  composerText: { flex: 1, color: colors.textMuted, fontSize: 15 },

  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.white, fontWeight: '800' },


  drow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  drowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  drowIc: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  drowPressed: { backgroundColor: colors.bg },
  mineTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  rankTag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.brandSoft },
  rankTagText: { fontSize: 11, fontWeight: '800', color: colors.brandText },
  waitPill: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.notification, alignItems: 'center', justifyContent: 'center' },
  waitPillText: { fontSize: 12, fontWeight: '800', color: colors.onBrand },
  createCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.cardLg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.brand, backgroundColor: colors.brandTint, marginTop: 4 },
  createIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  createTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  createSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  drowIcText: { fontSize: 17, fontWeight: '800' },
  drowName: { fontSize: 16, fontWeight: '800', color: colors.text },
  drowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  drowSub: { fontSize: 13, color: colors.textSecondary },
  typeTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeTagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  drowBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  drowBtnSoft: { backgroundColor: colors.brandSoft },
  drowBtnOff: { backgroundColor: colors.track },
  drowBtnText: { fontSize: 13, fontWeight: '800' },

  info: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16 },
  infoText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  b: { color: colors.text, fontWeight: '800' },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingVertical: 24, paddingHorizontal: 12 },
  emptyCard: { padding: 0 },

  mcard: { padding: 16, gap: 12 },
  mcardTitle: { fontSize: 14, fontWeight: '800' },
  req: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reqAv: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  reqAvText: { fontWeight: '800', fontSize: 14 },
  reqName: { fontSize: 14, fontWeight: '800', color: colors.text },
  reqSmall: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  reqNote: { fontSize: 13, color: colors.text, marginTop: 4, fontStyle: 'italic' },
  reqBtns: { gap: 6 },
  mBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  mBtnText: { fontSize: 13, fontWeight: '800' },
});
