import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/ui/Text';
import { Icon, IconName } from '../components/ui/Icon';
import { Title } from '../components/ui/Title';
import { SectionHeader } from '../components/ui/SectionHeader';
import { LiveRingCard } from '../components/home/LiveRingCard';
import { AffluenceSheet } from '../components/home/AffluenceSheet';
import { CheckInRecord, CoachProfile, CommunityPost, MemberProfile, MuscleGroup, StaffPermissions, UserProfile } from '../types/database';
import { CheckInService } from '../services/checkInService';
import { LiveFloorEngine, LiveFloorSummary } from '../services/liveFloorEngine';
import { computeAnalytics, ClubAnalytics } from '../services/analyticsService';
import { classesToday, quoteBrief, todayBrief } from '../services/dailyBriefService';
import { DEFAULT_GYM_CONFIG, GymConfigService, GymProfileConfig } from '../config/gymConfig';
import { firstName, todayStr } from '../services/floorViewModel';
import { ClubStatus, ClubStatusService } from '../services/clubStatusService';
import { ActivityEvent, ActivityService, CommunityService } from '../services/communityService';
import { FloorService } from '../services/floorService';
import { CoachService, DAYS, isOnFloorNow, isOwnProfile } from '../services/coachService';
import { CoachCard } from '../components/coaches/CoachCard';
import { claimSwipe } from '../navigation/swipeGuard';
import { ClubMember, ClubService, Renewal } from '../services/clubService';
import { ShopService } from '../services/shopService';
import { PERMISSION_LABELS, PermissionsService, hasPermission, withFreshPermissions } from '../services/permissionsService';
import { AuditService } from '../services/auditService';
import { ClassesManageSheet } from '../components/home/ClassesSection';
import { ClassesCarousel } from '../components/home/ClassesCarousel';
import { ClassService, ClubClass, nextSession } from '../services/classService';
import { NotificationService } from '../services/notificationService';
import { daysLeft, ensureMember, touchVisit } from '../services/clubService';
import { ClubConsoleSheet } from '../components/home/ClubConsoleSheet';
import { PermissionsManageSheet } from '../components/home/PermissionsManageSheet';
import { MembersAdminSheet } from '../components/home/MembersAdminSheet';
import { ClubBan, MemberAdminService } from '../services/memberAdminService';
import { ClubGrowthCard } from '../components/home/ClubGrowthCard';
import { useT } from '../i18n';
import { useOnline } from '../hooks/useDeviceState';
import { colors, light, radius, statusBarStyle } from '../theme';
import { HomeHeader } from '../components/home/HomeHeader';
import { StreakSheet } from '../components/home/StreakSheet';
import { ScanSuccessScreen } from '../components/home/ScanSuccessScreen';
import { ActivitySheet } from '../components/home/ActivitySheet';
import { ClubStatusManageSheet } from '../components/home/ClubStatusSection';
import { ClubNewsBar, NEWS_BAR_HEIGHT } from '../components/floor/ClubNewsBar';
import { ClubNewsService, NewsItem, toNews } from '../services/clubNewsService';
import { JournalStore } from '../journal/journalSync';
import { ProblemReport, ProblemReportService } from '../services/problemReportService';
import { ReviewPromptService } from '../services/reviewPromptService';
import { ReportProblemSheet } from '../components/floor/ReportProblemSheet';
import { ReportsAdminSheet } from '../components/floor/ReportsAdminSheet';
import { ReviewPrompt } from '../components/floor/ReviewPrompt';
import { journalSummary, muscleRecovery, suggestMuscle } from '../journal/journalLogic';
import { useScanRequests } from '../navigation/scanEvents';
import { useCollapseOnScroll } from '../components/CollapsibleFab';
import { Toast } from '../components/home/Toast';
import { ScanFab } from '../components/home/ScanFab';
import { WeeklyGoalCard, visitedDaysThisWeek } from '../components/home/WeeklyGoalCard';
import { HabitsService } from '../services/habitsService';
import { QrScannerModal } from '../components/QrScannerModal';
import { PostScanMuscleSelectModal } from '../components/PostScanMuscleSelectModal';
import { useScrollToTopOnReselect } from '../navigation/tabEvents';
import { haptics } from '../utils/haptics';
import { AdminConfigModal, AdminConfigValues } from '../components/AdminConfigModal';
import { useFloorSnapshot } from '../floor/useFloorSnapshot';
import { useWeekForecast } from '../floor/useWeekForecast';
import { useWeeklyStreak } from '../floor/useWeeklyStreak';
import { DemoSeedService } from '../services/demoSeedService';
import { CalmAlertService } from '../services/calmAlertService';
import { FloorLive, FloorLocked } from '../components/floor/FloorLive';
import { PROTOTYPE_SKIP_SCAN_GATE } from '../floor/prototype';
import { ZoneBoard } from '../components/floor/ZoneBoard';
import { CrowdFlipCard } from '../components/floor/CrowdFlipCard';
import { FloorSkeleton } from '../components/floor/FloorSkeleton';
import { FloorAdminScreen } from '../components/floor/admin/FloorAdminScreen';

interface HomeScreenProps {
  user: UserProfile;
  onUpdateUser: (updatedUser: UserProfile) => void;
  /** Open a Wall post (from an activity row). */
  onOpenWallPost: (postId: string) => void;
  /** Jump to another tab (owner console shortcuts). */
  onNavigate: (tab: 'shop' | 'coaches' | 'machines') => void;
  /** Opens the app-level Paramètres sheet (lives above the tabs so every screen can reach it). */
  onOpenAccount: () => void;
  onLogout: () => void;
  onWipe: () => void;
  /** Open the Journal and start a session (offered right after a check-in). */
  onStartSession: () => void;
  /** Open the Journal on "Mon bilan". */
  onOpenBilan?: () => void;
}

const REFRESH_MS = 30_000;

/** One round quick action under the live card (design-ref Main). */
const QuickAction: React.FC<{ icon: IconName; label: string; onPress: () => void; badge?: number }> = ({ icon, label, onPress, badge }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} à traiter` : label} style={({ pressed }) => [styles.qa, pressed && { opacity: 0.8 }]}>
    <View style={styles.qaCircle}>
      <Icon name={icon} size={24} color={colors.text} />
      {!!badge && (
        <View style={styles.qaBadge}>
          <Text style={styles.qaBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
    <Text style={styles.qaLabel} numberOfLines={1}>{label}</Text>
  </Pressable>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ user, onUpdateUser, onOpenWallPost, onNavigate, onOpenAccount, onLogout, onWipe, onStartSession, onOpenBilan }) => {
  const [floor, setFloor] = useState<LiveFloorSummary | null>(null);
  const [gymConfig, setGymConfig] = useState<GymProfileConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnline();

  // New Floor (occupancy redesign)
  const { snapshot, reload: reloadFloor } = useFloorSnapshot(user, gymConfig?.maxGymCapacity ?? 50);
  const week = useWeekForecast(gymConfig?.maxGymCapacity ?? 50);
  const [alertOn, setAlertOn] = useState(false);
  // "Objectif de la semaine": days with a visit this week vs the usual training days given at sign-up (3 if none).
  const [weekVisited, setWeekVisited] = useState<number[]>([]);
  const [weekGoal, setWeekGoal] = useState(3);
  useEffect(() => {
    CheckInService.getAllCheckIns().then(all => setWeekVisited(visitedDaysThisWeek(all.filter(c => c.userId === user.id).map(c => c.checkInTime))));
    HabitsService.get(user.id).then(h => setWeekGoal(h.usualDays?.length || 3));
  }, [user.id, user.lastCheckInDate]);
  // Validated coaches for the photo row on Accueil (same cards as the Coachs page).
  const [homeCoaches, setHomeCoaches] = useState<CoachProfile[]>([]);
  useEffect(() => {
    CoachService.getCoaches().then(list =>
      setHomeCoaches(
        list
          .filter(c => c.status !== 'pending')
          .sort((a, b) => Number(isOnFloorNow(b)) - Number(isOnFloorNow(a)) || Number(b.isAcceptingClients) - Number(a.isAcceptingClients))
      )
    );
  }, []);
  const [showFloorAdmin, setShowFloorAdmin] = useState(false);
  const { streak: weeklyStreak, reload: reloadStreak, setGoal: setStreakGoal } = useWeeklyStreak();

  // Sheets & modals
  const [showStreak, setShowStreak] = useState(false);
  /** "Voir l'affluence": the full crowd view, now in a sheet. */
  const [showAffluence, setShowAffluence] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showMusclePick, setShowMusclePick] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [success, setSuccess] = useState<{ old: number; next: number; isNewRun: boolean } | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  // Club status (admin messages) + Instagram-style activity
  const [statuses, setStatuses] = useState<ClubStatus[]>([]);
  const [showStatusManage, setShowStatusManage] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [seenAt, setSeenAt] = useState(0);
  const [sheetSeenAt, setSheetSeenAt] = useState(0);
  const [showActivity, setShowActivity] = useState(false);
  const [wallPosts, setWallPosts] = useState<CommunityPost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});

  // Owner console
  const [onFloorCount, setOnFloorCount] = useState(0);
  const [applications, setApplications] = useState(0);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [showMembersAdmin, setShowMembersAdmin] = useState(false);
  const [clubBans, setClubBans] = useState<ClubBan[]>([]);
  const [ordersPending, setOrdersPending] = useState(0);
  const [reportsCount, setReportsCount] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [classes, setClasses] = useState<ClubClass[]>([]);
  const [showClassesManage, setShowClassesManage] = useState(false);
  const [membership, setMembership] = useState<ClubMember | null>(null);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, StaffPermissions>>({});
  const [showPermissions, setShowPermissions] = useState(false);

  const { t } = useT();
  const isAdmin = user.role === 'owner';
  /** Owner only: growth, churn and revenue, recomputed when the roster changes. */
  const analytics: ClubAnalytics | null = useMemo(
    () => (isAdmin ? computeAnalytics(clubMembers, renewals) : null),
    [isAdmin, clubMembers, renewals]
  );
  const canManageClasses = hasPermission(user, 'manageClasses');
  const canManageNotifications = hasPermission(user, 'manageNotifications');
  const canManageStaff = hasPermission(user, 'manageStaff') || hasPermission(user, 'manageMembers');
  const canViewAnalytics = hasPermission(user, 'viewAnalytics');
  const streak = user.visitStreak || 0;
  const checkedInToday = user.lastCheckInDate === todayStr();

  const load = useCallback(async () => {
    const config = await GymConfigService.getConfig();
    const list: CheckInRecord[] = await CheckInService.getActiveCheckIns();
    setGymConfig(config);
    setFloor(LiveFloorEngine.calculateLiveFloor(list, user, config));
    // Picks up permissions the owner granted since the last check, without needing an app restart.
    const fresh = await withFreshPermissions(user);
    if (JSON.stringify(fresh.permissions ?? {}) !== JSON.stringify(user.permissions ?? {})) onUpdateUser(fresh);
  }, [user, onUpdateUser]);

  // Initial load + auto refresh
  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    ClubStatusService.getAll().then(setStatuses);
  }, []);

  // ---- Problems reported by members (private to the club team, not Google) ----
  const [reports, setReports] = useState<ProblemReport[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [showReportsAdmin, setShowReportsAdmin] = useState(false);
  const openReports = reports.filter(r => r.status === 'open');
  const myReports = reports.filter(r => r.userId === user.id);

  useEffect(() => {
    ProblemReportService.getAll().then(setReports);
    // "Réglé ✓": tell the member once when the club fixed what he reported.
    ProblemReportService.newlyFixedFor(user.id).then(fixed => {
      if (!fixed.length) return;
      setToast(fixed.length === 1 ? `Réglé : « ${fixed[0].message.slice(0, 40)} »` : `${fixed.length} de tes signalements sont réglés`);
      ProblemReportService.markFixedSeen(user.id, fixed.map(r => r.id));
    });
  }, [user.id]);

  const sendReport = async (r: { category: ProblemReport['category']; place?: string; message: string; photoUri?: string }) => {
    setReports(await ProblemReportService.create({ ...r, userId: user.id, userName: user.fullName }));
    setShowReport(false);
    haptics.success();
    setToast('Merci ! L’équipe du club est prévenue.');
  };

  const memberPhone = (userId: string) => {
    const d = clubMembers.find(m => m.id === userId)?.phone?.replace(/[^0-9]/g, '');
    return d ? (d.length === 8 ? `216${d}` : d) : undefined;
  };

  // ---- Google review: after a week with the app, never while the member has a problem in progress ----
  const [review, setReview] = useState<{ open: boolean; preview: boolean }>({ open: false, preview: false });
  useEffect(() => {
    if (user.role !== 'member' || !gymConfig?.googleReviewUrl) return;
    if (reports.some(r => r.userId === user.id && r.status === 'open')) return;
    let alive = true;
    const t = setTimeout(async () => {
      if (alive && (await ReviewPromptService.check(user.id))) setReview({ open: true, preview: false });
    }, 1500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [user.id, user.role, gymConfig?.googleReviewUrl, reports]);

  const answerReview = (status: 'later' | 'done') => {
    if (status === 'done') {
      if (gymConfig?.googleReviewUrl) Linking.openURL(gymConfig.googleReviewUrl).catch(() => setToast('Lien impossible à ouvrir'));
      else setToast('Ajoute le lien d’avis Google dans Paramètres du club');
    }
    if (!review.preview) ReviewPromptService.answer(user.id, status);
    setReview({ open: false, preview: false });
  };

  // Club news bar: announcements + this member's read state (kept per user, survives reloads)
  const [newsRead, setNewsRead] = useState<Set<string>>(new Set());
  useEffect(() => {
    ClubNewsService.getRead(user.id).then(setNewsRead);
  }, [user.id]);
  const news = useMemo(() => toNews(statuses, newsRead), [statuses, newsRead]);

  const markNewsRead = (ids: string[]) => {
    setNewsRead(prev => new Set([...prev, ...ids]));
    ClubNewsService.markRead(user.id, ids);
  };

  // Journal → "Ta séance du jour" pre-selects the muscle that is rested and waited the longest.
  const [suggestedMuscle, setSuggestedMuscle] = useState<MuscleGroup | null>(null);
  /** The muscle left alone the longest, for the daily brief and the muscle reminder. */
  const [staleMuscle, setStaleMuscle] = useState<{ label: string; days: number } | null>(null);
  useEffect(() => {
    JournalStore.readHistory(user.id).then(h => {
      setSuggestedMuscle(journalSummary(h).suggestedMuscle);
      const m = suggestMuscle(h);
      const last = m ? muscleRecovery(h, m.id).last : null;
      // Only worth a nudge after a week; a muscle never trained is not "late".
      const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : 0;
      setStaleMuscle(m && last && days >= 7 ? { label: m.name, days } : null);
    });
  }, [user.id]);

  /** The hour he said he would come today, if he planned one. */
  const [plannedVisitHour, setPlannedVisitHour] = useState<number | null>(null);
  useEffect(() => {
    CalmAlertService.visitsFor(gymConfig?.id ?? DEFAULT_GYM_CONFIG.id)
      .then(vs => setPlannedVisitHour(vs.find(v => v.userId === user.id)?.plannedHour ?? null))
      .catch(() => setPlannedVisitHour(null));
  }, [user.id, gymConfig?.id]);

  // After a check-in: "Tu es au club. Commencer ta séance ?" (unless a session is already running).
  const [askSession, setAskSession] = useState(false);
  // A session already running (journal draft): the success screen then offers only "Retour".
  const [sessionRunning, setSessionRunning] = useState(false);
  useEffect(() => {
    if (success) JournalStore.hasDraft(user.id).then(setSessionRunning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const classesY = useRef(0);
  const handleNewsAction = (item: NewsItem) => {
    const [kind, ...rest] = (item.ctaAction ?? '').split(':');
    const arg = rest.join(':');
    switch (kind) {
      case 'shop':
        return onNavigate('shop');
      case 'coach':
        return onNavigate('coaches');
      case 'class':
      case 'event':
        // Let the panel close first, then bring the class cards into view.
        return setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, classesY.current - 12), animated: true }), 320);
      case 'url':
        if (/^https?:\/\//i.test(arg)) Linking.openURL(arg).catch(() => setToast('Lien impossible à ouvrir'));
        return;
    }
  };

  // Public member profiles (for the class-attendee avatars).
  useEffect(() => {
    CommunityService.getProfiles().then(setProfiles);
  }, []);

  // End my session now instead of waiting out the presence window
  const handleScanOut = async () => {
    await CheckInService.endCheckIn(user.id);
    reloadFloor();
    setToast('Séance terminée');
  };

  // "M'alerter si calme": persist a whole-gym calm alert (or turn it off)
  const toggleAlert = async () => {
    if (alertOn) {
      setAlertOn(false);
      setToast('Alerte désactivée');
      return;
    }
    setAlertOn(true);
    await CalmAlertService.create({ userId: user.id, gymId: user.gymId, muscle: null, targetHour: null });
    setToast('On te prévient dès que le plateau est calme');
  };

  // Activity on MY posts by other members (likes, comments, record validations)
  useEffect(() => {
    const refresh = async () => {
      const [all, seen] = await Promise.all([ActivityService.getAll(), ActivityService.getSeenAt()]);
      setEvents(all.filter(e => e.ownerId === user.id && e.actorId !== user.id));
      setSeenAt(seen);
    };
    refresh();
    return ActivityService.subscribe(refresh);
  }, [user.id]);

  const unread = events.filter(e => new Date(e.createdAt).getTime() > seenAt).length;

  const openActivity = async () => {
    setSheetSeenAt(seenAt); // keep the "Nouveau" grouping for this opening
    const [posts, prof] = await Promise.all([CommunityService.getPosts(), CommunityService.getProfiles()]);
    setWallPosts(posts);
    setProfiles(prof);
    setShowActivity(true);
    ActivityService.markSeen();
  };

  useEffect(() => {
    DemoSeedService.ensureClassBookings().then(() => ClassService.getAll().then(setClasses));
  }, []);

  const saveClasses = (next: ClubClass[]) => {
    setClasses(next);
    ClassService.save(next);
  };

  // Book / cancel / waitlist the next session of a class.
  // Returns a Promise so the carousel can rollback on error.
  const bookClass = async (c: ClubClass) => {
    const { date } = nextSession(c);
    const bookings = { ...c.bookings, [user.id]: date };
    const waitlist = { ...(c.waitlist ?? {}) };
    delete waitlist[user.id];
    saveClasses(classes.map(x => (x.id === c.id ? { ...x, bookings, waitlist } : x)));
    setToast(`Réservé : ${c.title} ${c.time}`);
  };
  const cancelClass = async (c: ClubClass) => {
    const bookings = { ...c.bookings };
    delete bookings[user.id];
    saveClasses(classes.map(x => (x.id === c.id ? { ...x, bookings } : x)));
    setToast('Réservation annulée');
  };
  const waitlistClass = async (c: ClubClass) => {
    const { date } = nextSession(c);
    const waitlist = { ...(c.waitlist ?? {}) };
    const wasOn = waitlist[user.id] === date;
    if (wasOn) delete waitlist[user.id];
    else waitlist[user.id] = date;
    saveClasses(classes.map(x => (x.id === c.id ? { ...x, waitlist } : x)));
    setToast(wasOn ? "Retiré de la liste d'attente" : "Ajouté à la liste d'attente");
  };

  // My membership (members only) + local reminders
  useEffect(() => {
    ensureMember(user).then(setMembership);
  }, [user.id, user.role]);

  useEffect(() => {
    const today = todayStr();
    const checkedIn = user.lastCheckInDate === today;
    const left = membership ? daysLeft(membership) : null;

    NotificationService.planStreak(user.visitStreak || 0, checkedIn);
    NotificationService.planMembership(left);

    // The quote goes to everyone; it needs nothing but the date.
    NotificationService.planQuote(quoteBrief(today));

    // "Ce que tu as aujourd'hui": null when the day is empty, so no hollow reminder.
    const dayLabel = DAYS[(new Date().getDay() + 6) % 7]!;
    NotificationService.planToday(
      todayBrief({
        classes: classesToday(classes, user.id, today, dayLabel),
        plannedHour: plannedVisitHour,
        staleMuscle,
        membershipDaysLeft: left,
        streak: user.visitStreak || 0,
        checkedInToday: checkedIn,
      })
    );

    // Was written long ago and never called: a muscle left alone for 7+ days.
    NotificationService.planMuscle(staleMuscle?.label ?? null, staleMuscle?.days ?? 0);
  }, [user.visitStreak, user.lastCheckInDate, user.id, membership, classes, plannedVisitHour, staleMuscle]);

  const membershipLeft = membership ? daysLeft(membership) : null;

  // Owner console numbers (refreshed every 20 s)
  useEffect(() => {
    if (!isAdmin) return;
    const loadOwner = async () => {
      const [fm, cs, members, orders, reps, perms, rens] = await Promise.all([FloorService.getMembers(), CoachService.getCoaches(), ClubService.getMembers(), ShopService.getReservations(), CommunityService.getReports(), PermissionsService.getAll(), ClubService.getRenewals()]);
      setRenewals(rens);
      MemberAdminService.bans().then(setClubBans);
      setReportsCount(reps.length);
      setOnFloorCount(fm.length);
      setApplications(cs.filter(c => c.status === 'pending').length);
      setClubMembers(members);
      setOrdersPending(orders.filter(r => r.status === 'pending').length);
      setPermissionsMap(perms);
    };
    loadOwner();
    const id = setInterval(loadOwner, 20_000);
    return () => clearInterval(id);
  }, [isAdmin]);

  const consoleTodo = ordersPending + applications + reportsCount;
  // two bottom sheets can't be open at once on iOS: close the console, then open the next thing
  const fromConsole = (fn: () => void) => {
    setShowConsole(false);
    setTimeout(fn, 260);
  };

  const changeStatuses = async (next: ClubStatus[]) => {
    setStatuses(next);
    await ClubStatusService.save(next);
  };

  const notifyClassCancelled = (className: string, when: string, reason: string) => {
    changeStatuses([
      { id: 'st-' + Date.now(), kind: 'closure', title: `${className} annulé`, message: reason, when, createdAt: new Date().toISOString() },
      ...statuses,
    ]);
    setToast(`${className} annulé : les membres sont prévenus`);
  };

  // Refetch as soon as the connection is back
  useEffect(() => {
    if (online) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const { collapsed: fabCollapsed, scrollProps: fabScroll } = useCollapseOnScroll();
  const scrollRef = useScrollToTopOnReselect('floor');

  // ---- Scan flow ----
  const openScanner = () => {
    if (checkedInToday) {
      setToast('Déjà validé aujourd’hui');
      return;
    }
    setShowScanner(true);
  };

  // The navbar's Scan button (App) runs this same openScanner.
  useScanRequests(openScanner);

  const onScanSuccess = () => {
    setShowScanner(false);
    setShowMusclePick(true);
  };

  const onConfirmMuscles = async (selected: MuscleGroup[]) => {
    setShowMusclePick(false);
    const oldStreak = streak;
    const { updatedProfile } = await CheckInService.performCheckIn(user, selected[0] || 'chest');
    const next = updatedProfile.visitStreak || 1;
    onUpdateUser(updatedProfile);
    touchVisit(user.id);
    reloadFloor();
    reloadStreak();
    haptics.success();
    setSuccess({ old: oldStreak, next, isNewRun: next === 1 });
  };

  // Owner settings for the crowd: members who never scanned at the entrance don't see it; numbers can be hidden.
  // Staff always see everything.
  const crowdLocked = !PROTOTYPE_SKIP_SCAN_GATE && gymConfig?.crowdMembersOnly !== false && user.role === 'member' && !user.lastCheckInDate;
  const showCounts = gymConfig?.crowdShowCounts !== false || user.role !== 'member';

  // ---- Admin ----
  const saveAdmin = async (values: AdminConfigValues) => {
    const updated = await GymConfigService.saveConfig(values);
    setGymConfig(updated);
    setShowAdmin(false);
    await load();
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={colors.header} />

      <HomeHeader
        gymName={gymConfig?.name ?? ''}
        logoUrl={gymConfig?.logoUrl}
        streak={streak}
        unreadNotices={unread}
        onOpenStreak={() => setShowStreak(true)}
        onOpenNotices={openActivity}
        avatarName={user.fullName}
        avatarUrl={user.avatarUrl}
        onOpenProfile={onOpenAccount}
      />

      {!online && (
        <View style={styles.offline} accessibilityLiveRegion="polite">
          <Icon name="cloud-offline-outline" size={16} color={colors.amber.text} />
          <Text style={styles.offlineText}>Hors ligne · dernières données affichées</Text>
        </View>
      )}

      <View style={styles.body}>
      <ScrollView
        ref={scrollRef}
        {...fabScroll}
        contentContainerStyle={[styles.content, news.length > 0 && { paddingTop: NEWS_BAR_HEIGHT + 14 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} progressViewOffset={news.length ? NEWS_BAR_HEIGHT : 0} />}
      >
        <Title variant="section" size={32} style={styles.greeting}>Salut {firstName(user.fullName)} !</Title>

        {isAdmin && gymConfig && (gymConfig.adminPassword || '0000') === '0000' && (
          <Pressable onPress={() => setShowAdmin(true)} accessibilityRole="button" style={styles.membershipBanner}>
            <Icon name="lock-open-outline" size={20} color={colors.amber.text} />
            <Text style={styles.membershipText}>Mot de passe admin par défaut (0000) : change-le pour protéger ton club</Text>
            <Icon name="chevron-forward" size={18} color={colors.amber.text} />
          </Pressable>
        )}

        {gymConfig?.membershipsInApp && membershipLeft !== null && membershipLeft <= 7 && (
          <Pressable onPress={onOpenAccount} accessibilityRole="button" style={styles.membershipBanner}>
            <Icon name="card-outline" size={20} color={colors.amber.text} />
            <Text style={styles.membershipText}>
              {membershipLeft < 0 ? 'Ton abonnement a expiré' : membershipLeft === 0 ? 'Ton abonnement expire aujourd’hui' : `Ton abonnement expire dans ${membershipLeft} jour${membershipLeft > 1 ? 's' : ''}`}
            </Text>
            <Icon name="chevron-forward" size={18} color={colors.amber.text} />
          </Pressable>
        )}

        {/* Members: this week's sessions against their usual rhythm. */}
        {!isAdmin && <WeeklyGoalCard visited={weekVisited} goal={weekGoal} />}

        {/* Live crowd: the ring card here, the full view (days, hours, muscles) behind "Voir l'affluence". */}
        {crowdLocked ? (
          <FloorLocked gymName={gymConfig?.name ?? ''} onScan={() => setShowScanner(true)} />
        ) : snapshot ? (
          <>
            <LiveRingCard snapshot={snapshot} showCounts={showCounts} checkedIn={!!snapshot.myCheckIn} onScanOut={handleScanOut} />
            <View style={styles.crowdBtns}>
              {snapshot.isOpen && (
                <Pressable
                  onPress={toggleAlert}
                  accessibilityRole="button"
                  accessibilityState={{ selected: alertOn }}
                  style={({ pressed }) => [styles.crowdBtn, alertOn && styles.crowdBtnOn, pressed && { opacity: 0.85 }]}
                >
                  <Icon name={alertOn ? 'notifications' : 'notifications-outline'} size={18} color={alertOn ? colors.green.text : colors.text} />
                  <Text style={[styles.crowdBtnText, alertOn && { color: colors.green.text }]} numberOfLines={1}>{alertOn ? 'Alerte activée' : "M'alerter si calme"}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setShowAffluence(true)} accessibilityRole="button" style={({ pressed }) => [styles.crowdBtn, styles.crowdBtnDark, pressed && { opacity: 0.85 }]}>
                <Text style={[styles.crowdBtnText, { color: colors.inverseText }]} numberOfLines={1}>Voir l'affluence</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <FloorSkeleton />
        )}

        {/* Quick actions: the training side for members and coaches, the club side for the owner. */}
        <View style={styles.quick}>
          {isAdmin ? (
            <>
              {canManageNotifications && <QuickAction icon="megaphone-outline" label="Publier" onPress={() => setShowStatusManage(true)} />}
              <QuickAction icon="stats-chart" label="Console" badge={consoleTodo} onPress={() => setShowConsole(true)} />
              <QuickAction icon="pulse-outline" label="Live" onPress={() => setShowFloorAdmin(true)} />
              {canManageStaff && <QuickAction icon="people-outline" label="Membres" onPress={() => setShowMembersAdmin(true)} />}
            </>
          ) : (
            <>
              <QuickAction icon="barbell-outline" label="Séance" onPress={onStartSession} />
              <QuickAction icon="ribbon-outline" label="Coachs" onPress={() => onNavigate('coaches')} />
              <QuickAction icon="bag-handle-outline" label="Boutique" onPress={() => onNavigate('shop')} />
              <QuickAction icon="pulse-outline" label="Mon bilan" onPress={() => (onOpenBilan ? onOpenBilan() : onNavigate('machines'))} />
            </>
          )}
        </View>

        {/* Staff who are not the manager keep their tools as slim rows. */}
        {!isAdmin && canManageNotifications && (
          <Pressable onPress={() => setShowStatusManage(true)} accessibilityRole="button" style={({ pressed }) => [styles.liveBtn, pressed && { opacity: 0.85 }]}>
            <Icon name="megaphone-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.liveBtnText}>{t('Publier une info du club')}</Text>
            <View style={{ flex: 1 }} />
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        {!isAdmin && canManageStaff && (
          <Pressable onPress={() => setShowMembersAdmin(true)} accessibilityRole="button" style={({ pressed }) => [styles.liveBtn, pressed && { opacity: 0.85 }]}>
            <Icon name="people-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.liveBtnText}>
              {t('Membres & permissions')} · {clubMembers.length}
            </Text>
            <View style={{ flex: 1 }} />
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {gymConfig?.classesEnabled !== false && (
          <View style={styles.section} onLayout={e => (classesY.current = e.nativeEvent.layout.y)}>
            <ClassesCarousel
              classes={classes}
              userId={user.id}
              profiles={profiles}
              onBook={bookClass}
              onCancel={cancelClass}
              onWaitlist={waitlistClass}
              onSeeAll={canManageClasses ? () => setShowClassesManage(true) : undefined}
            />
          </View>
        )}

        {/* The numbers: is the app actually helping? */}
        {canViewAnalytics && analytics && (
          <View style={styles.section}>
            <ClubGrowthCard analytics={analytics} />
          </View>
        )}

        {/* Coachs left the navbar: they open from here. */}
        <View style={styles.section}>
          <SectionHeader title="Les coachs du club" actionLabel="Voir" onAction={() => onNavigate('coaches')} />
          {homeCoaches.length > 0 ? (
            <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} snapToInterval={COACH_CARD_W + 10} decelerationRate="fast" contentContainerStyle={styles.coachTrack}>
              {homeCoaches.map(c => (
                <View key={c.id} style={{ width: COACH_CARD_W }}>
                  <CoachCard coach={c} isMine={isOwnProfile(c, user)} onPress={() => onNavigate('coaches')} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <Pressable onPress={() => onNavigate('coaches')} accessibilityRole="button" accessibilityLabel="Les coachs du club" style={({ pressed }) => [styles.coachCard, pressed && { opacity: 0.88 }]}>
              <View style={styles.coachIcon}>
                <Icon name="ribbon-outline" size={22} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coachTitle}>Trouve ton coach</Text>
                <Text style={styles.coachSub}>Coaching perso, programmes et séances</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </ScrollView>

      <ClubNewsBar items={news} onAction={handleNewsAction} onRead={markNewsRead} />
      </View>

      <Toast message={toast} onHide={() => setToast(null)} />
      {/* Signaler + Scan float on the right, just above the navbar (as before the redesign). */}
      <ScanFab
        checkedInToday={checkedInToday}
        onPress={openScanner}
        collapsed={fabCollapsed}
        onReport={() => {
          if (isAdmin) {
            ProblemReportService.getAll().then(setReports);
            ClubService.getMembers().then(setClubMembers);
            setShowReportsAdmin(true);
          } else setShowReport(true);
        }}
        reportBadge={isAdmin ? openReports.length : undefined}
        reportLabel={isAdmin ? 'Problèmes signalés' : 'Signaler un problème'}
      />

      <AffluenceSheet visible={showAffluence} onClose={() => setShowAffluence(false)} alertOn={alertOn} onToggleAlert={toggleAlert} showAlert={!!snapshot?.isOpen}>
        {snapshot ? (
          <>
            {isAdmin || !snapshot.isOpen ? (
              <FloorLive
                snapshot={snapshot}
                week={week}
                alertOn={alertOn}
                onToggleAlert={toggleAlert}
                checkedIn={!!snapshot.myCheckIn}
                onScanOut={handleScanOut}
                showCounts={showCounts}
                usualSlot={user.usualTrainingTime}
              />
            ) : (
              <CrowdFlipCard
                renderGym={(header, footer) => (
                  <FloorLive
                    snapshot={snapshot}
                    week={week}
                    alertOn={alertOn}
                    onToggleAlert={toggleAlert}
                    checkedIn={!!snapshot.myCheckIn}
                    onScanOut={handleScanOut}
                    showCounts={showCounts}
                    usualSlot={user.usualTrainingTime}
                    header={header}
                    footer={footer}
                  />
                )}
                renderMuscles={(header, footer) => (
                  <ZoneBoard
                    muscles={snapshot.muscles}
                    myMuscle={snapshot.myMuscle}
                    bestLabel={snapshot.bestHour != null ? `${snapshot.bestHour}h – ${snapshot.bestHour + 1}h` : null}
                    suggested={suggestedMuscle}
                    showCounts={showCounts}
                    header={header}
                    footer={footer}
                  />
                )}
              />
            )}
          </>
        ) : null}
      </AffluenceSheet>
      {/* Scan now lives in the floating navbar (App): it calls openScanner through useScanRequests. */}

      <ReportProblemSheet visible={showReport} mine={myReports} onClose={() => setShowReport(false)} onSend={sendReport} />
      {isAdmin && (
        <ReportsAdminSheet
          visible={showReportsAdmin}
          reports={reports}
          phoneOf={memberPhone}
          onClose={() => setShowReportsAdmin(false)}
          onSetStatus={async (id, status) => {
            setReports(await ProblemReportService.setStatus(id, status));
            if (status === 'fixed') setToast('Marqué comme réglé : le membre sera prévenu');
          }}
          onDelete={async id => setReports(await ProblemReportService.remove(id))}
        />
      )}
      <ReviewPrompt
        visible={review.open}
        gymName={gymConfig?.name ?? ''}
        logoUrl={gymConfig?.logoUrl}
        onReview={() => answerReview('done')}
        onLater={() => answerReview('later')}
        onReport={() => {
          if (!review.preview) ReviewPromptService.answer(user.id, 'later');
          setReview({ open: false, preview: false });
          setTimeout(() => setShowReport(true), 260);
        }}
      />

      {isAdmin && (
        <FloorAdminScreen
          visible={showFloorAdmin}
          onClose={() => setShowFloorAdmin(false)}
          gymId={user.gymId}
          capacity={gymConfig?.maxGymCapacity ?? 50}
          onChanged={reloadFloor}
        />
      )}
      {weeklyStreak && (
        <StreakSheet
          visible={showStreak}
          onClose={() => setShowStreak(false)}
          streak={weeklyStreak}
          onChangeGoal={setStreakGoal}
        />
      )}

      <QrScannerModal visible={showScanner} onClose={() => setShowScanner(false)} onScanSuccess={onScanSuccess} expectedCode={gymConfig?.checkInCode ?? DEFAULT_GYM_CONFIG.checkInCode} />
      <PostScanMuscleSelectModal
        visible={showMusclePick}
        onClose={() => setShowMusclePick(false)}
        onConfirmMuscles={onConfirmMuscles}
      />
      {/* After a check-in: one screen with the streak, the crowd and "Commencer ma séance" (design-ref ScanOK).
          Its two buttons are the old "Commencer ta séance ?" banner's two answers. */}
      <ScanSuccessScreen
        visible={!!success}
        firstName={firstName(user.fullName)}
        oldStreak={success?.old ?? 0}
        newStreak={success?.next ?? 0}
        isNewRun={success?.isNewRun ?? false}
        crowd={snapshot ? { level: snapshot.level, count: showCounts ? snapshot.presentCount : null } : null}
        canStart={!sessionRunning}
        onStart={() => {
          setSuccess(null);
          onStartSession();
        }}
        onHome={() => setSuccess(null)}
      />
      {askSession && (
        <View style={styles.askWrap} pointerEvents="box-none">
          <View style={styles.ask} accessibilityRole="alert">
            <Icon name="barbell-outline" size={22} color={colors.brand} />
            <Text style={styles.askText}>Tu es au club. Commencer ta séance ?</Text>
            <Pressable onPress={() => setAskSession(false)} accessibilityRole="button" hitSlop={8} style={styles.askLater}>
              <Text style={styles.askLaterText}>Plus tard</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAskSession(false);
                onStartSession();
              }}
              accessibilityRole="button"
              style={styles.askGo}
            >
              <Text style={styles.askGoText}>Commencer</Text>
            </Pressable>
          </View>
        </View>
      )}
      <ActivitySheet
        visible={showActivity}
        onClose={() => setShowActivity(false)}
        events={events}
        seenAt={sheetSeenAt}
        posts={wallPosts}
        profiles={profiles}
        onOpenPost={id => {
          setShowActivity(false);
          setTimeout(() => onOpenWallPost(id), 260);
        }}
      />
      <ClassesManageSheet visible={showClassesManage} classes={classes} onClose={() => setShowClassesManage(false)} onChange={saveClasses} onCancelNotice={notifyClassCancelled} />
      <ClubConsoleSheet
        visible={showConsole}
        onClose={() => setShowConsole(false)}
        analytics={analytics}
        monthlyPriceMillimes={gymConfig?.monthlyPriceMillimes ?? DEFAULT_GYM_CONFIG.monthlyPriceMillimes}
        onRenewed={() => ClubService.getRenewals().then(setRenewals)}
        floor={floor}
        members={clubMembers}
        onMembersChange={list => {
          setClubMembers(list);
          ClubService.saveMembers(list);
        }}
        counts={{ onFloor: onFloorCount, orders: ordersPending, applications, reports: reportsCount }}
        onNavigate={tab => fromConsole(() => onNavigate(tab))}
        onOpenSettings={() => fromConsole(() => setShowAdmin(true))}
        onOpenInfos={() => fromConsole(() => setShowStatusManage(true))}
        onOpenEntryQr={() => fromConsole(onOpenAccount)}
        onOpenPermissions={() => fromConsole(() => setShowPermissions(true))}
      />
      <ClubStatusManageSheet visible={showStatusManage} items={statuses} onClose={() => setShowStatusManage(false)} onChange={changeStatuses} />
      <AdminConfigModal
        visible={showAdmin}
        config={gymConfig}
        onClose={() => setShowAdmin(false)}
        onSave={saveAdmin}
        onPreviewReview={() => {
          setShowAdmin(false);
          setTimeout(() => setReview({ open: true, preview: true }), 260);
        }}
      />
      <MembersAdminSheet
        visible={showMembersAdmin}
        onClose={() => setShowMembersAdmin(false)}
        members={clubMembers}
        permissions={permissionsMap}
        bans={clubBans}
        me={user}
        onChange={async (userId, patch) => {
          setPermissionsMap(await PermissionsService.set(userId, patch));
          for (const [key, on] of Object.entries(patch)) {
            AuditService.log({
              action: on ? 'permission.granted' : 'permission.revoked',
              actorId: user.id,
              actorName: user.fullName,
              targetId: userId,
              targetName: clubMembers.find(m => m.id === userId)?.name,
              permission: PERMISSION_LABELS.find(l => l.key === key)?.label ?? key,
            });
          }
        }}
        onBan={async (m, reason) => {
          setClubBans(await MemberAdminService.ban(m.id, m.name, reason, user.id));
          setToast(`${m.name} ne peut plus se connecter`);
        }}
        onUnban={async m => {
          setClubBans(await MemberAdminService.unban(m.id));
          setToast(`${m.name} peut se reconnecter`);
        }}
        onRemove={async m => {
          await MemberAdminService.remove(m.id);
          setClubMembers(await ClubService.getMembers());
          setClubBans(await MemberAdminService.bans());
          setToast(`${m.name} a été supprimé du club`);
        }}
      />
      <PermissionsManageSheet
        visible={showPermissions}
        onClose={() => setShowPermissions(false)}
        members={clubMembers}
        permissions={permissionsMap}
        grantedBy={user}
        onChange={async (userId, patch) => {
          setPermissionsMap(await PermissionsService.set(userId, patch));
          // Every grant and every revoke is written down, with who did it.
          for (const [key, on] of Object.entries(patch)) {
            AuditService.log({
              action: on ? 'permission.granted' : 'permission.revoked',
              actorId: user.id,
              actorName: user.fullName,
              targetId: userId,
              targetName: clubMembers.find(m => m.id === userId)?.name,
              permission: PERMISSION_LABELS.find(l => l.key === key)?.label ?? key,
            });
          }
        }}
      />
    </View>
  );
};

const COACH_CARD_W = 300;

const styles = StyleSheet.create({
  announce: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brand, borderRadius: 18, padding: 16, marginBottom: 14 },
  announceTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  announceSub: { color: light(0.8), fontSize: 12, marginTop: 2 },
  screen: { flex: 1, backgroundColor: colors.page },
  body: { flex: 1 },
  askWrap: { position: 'absolute', left: 12, right: 12, bottom: 16, zIndex: 50 },
  ask: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  askText: { flex: 1, minWidth: 160, fontSize: 14, fontWeight: '800', color: colors.text },
  askLater: { paddingVertical: 8, paddingHorizontal: 6 },
  askLaterText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  askGo: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  askGoText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  membershipBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.amber.soft },
  membershipText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.amber.text },
  greeting: { marginTop: 4 },
  crowdBtns: { flexDirection: 'row', gap: 10 },
  crowdBtn: { flex: 1, height: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  crowdBtnDark: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  crowdBtnOn: { borderColor: colors.green.bar, backgroundColor: colors.green.soft },
  crowdBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  quick: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  qa: { width: 76, alignItems: 'center', gap: 8 },
  qaCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qaBadge: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.red.bar, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.page },
  qaBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  qaLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  section: { marginTop: 14, gap: 14 },
  coachTrack: { paddingRight: 16, gap: 10 },
  coachCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  coachIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  coachTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  coachSub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 2 },
  liveBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 52, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  liveBtnText: { fontSize: 15, fontWeight: '800', color: colors.text },
  secHead: { paddingHorizontal: 4, marginTop: 2 },
  secTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.amber.soft,
  },
  offlineText: { fontSize: 13, fontWeight: '600', color: colors.amber.text },
});
