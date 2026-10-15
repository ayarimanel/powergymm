import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Pressable, StatusBar, ActivityIndicator, Animated, Easing, Platform, PanResponder } from 'react-native';
import { Text } from './src/components/ui/Text';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from './src/types/database';
import { AuthService } from './src/services/authService';
import { withFreshPermissions } from './src/services/permissionsService';
import { NotificationService } from './src/services/notificationService';
import { DemoSeedService } from './src/services/demoSeedService';
import { GymConfigService, GymProfileConfig } from './src/config/gymConfig';
import { ClubMember, ensureMember } from './src/services/clubService';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LanguageProvider, useT } from './src/i18n';
import { LanguageScreen } from './src/screens/LanguageScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HabitsQuestionnaire } from './src/screens/HabitsQuestionnaire';
import { HabitsService } from './src/services/habitsService';
import { HabitsProfile } from './src/onboarding/habitsModel';
import { ClubRules } from './src/onboarding/habitsFlow';
import { MurService } from './src/community/murService';
import { HomeScreen } from './src/screens/HomeScreen';
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { CommunityScreen } from './src/screens/CommunityScreen';
import { CoachProfilesScreen } from './src/screens/CoachProfilesScreen';
import { JournalScreen } from './src/screens/JournalScreen';
import { AccountSheet } from './src/components/account/AccountSheet';
import { useReduceMotion } from './src/hooks/useDeviceState';
import { goBack, useBackHandler } from './src/navigation/backStack';
import { emitTabReselect } from './src/navigation/tabEvents';
import { claimSwipe, startSwipe, startsInHorizontalScroller, swipeClaimed } from './src/navigation/swipeGuard';
import { haptics } from './src/utils/haptics';
import { colors, radius, clubTheme } from './src/theme';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';

const nativeDriver = Platform.OS !== 'web';

// Activity (likes/comments) opens from the heart in the Floor header; admin messages live in "Infos du club".
type ActiveTab = 'floor' | 'shop' | 'community' | 'coaches' | 'machines';

const TABS: { id: ActiveTab; label: string; icon: string; iconActive: string }[] = [
  { id: 'floor', label: 'Accueil', icon: 'home-outline', iconActive: 'home' },
  { id: 'shop', label: 'Boutique', icon: 'bag-handle-outline', iconActive: 'bag-handle' },
  { id: 'machines', label: 'Entraînement', icon: 'barbell-outline', iconActive: 'barbell' },
  { id: 'coaches', label: 'Coachs', icon: 'person-outline', iconActive: 'person' },
  { id: 'community', label: 'Communauté', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Language wraps everything: the error screen itself needs to be readable. */}
      <LanguageProvider>
      {/* Outside AppInner: a crash in any screen must still land on something readable. */}
      <ErrorBoundary
        onReset={() => {
          AuthService.clearEverything().finally(() => {
            if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
          });
        }}
      >
        <AppInner />
      </ErrorBoundary>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

function AppInner() {
  const insets = useSafeAreaInsets();
  const { t, lang, chosen: langChosen, ready: langReady, setLang } = useT();
  // The club fonts: wait for them (or their failure, then the system font takes over)
  // so the text never jumps from one font to another on first paint.
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = clubTheme.clubName;
  }, []);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  /**
   * The club manager has no training journal of his own — he runs the room, he
   * doesn't log sets in it. Hiding the tab keeps his bar to what he actually uses.
   */
  const isOwner = userProfile?.role === 'owner';
  const tabs = useMemo(() => (isOwner ? TABS.filter(x => x.id !== 'machines') : TABS), [isOwner]);
  const [currentTab, setCurrentTab] = useState<ActiveTab>('floor');
  const [wallFocus, setWallFocus] = useState<string | null>(null); // Wall post to open (from a notification)
  const [journalStart, setJournalStart] = useState(0); // bumped to start a session (after a check-in)

  // Tab history, so back (button, gesture, edge swipe) returns to the previous tab.
  const [tabHistory, setTabHistory] = useState<ActiveTab[]>([]);
  const [backGen, setBackGen] = useState(0);
  const openTab = (tab: ActiveTab) => {
    // A tab this role does not have (the owner's journal) would render nothing.
    if (!tabs.some(x => x.id === tab)) return;
    if (tab === currentTab) {
      emitTabReselect(tab); // second tap: scroll back to the top
      return;
    }
    haptics.select();
    setTabHistory(h => [...h.filter(t => t !== currentTab), currentTab].slice(-8));
    setCurrentTab(tab);
  };
  useBackHandler(
    !!userProfile && tabHistory.length > 0,
    () => {
      setTabHistory(h => {
        const prev = h[h.length - 1];
        if (prev) setCurrentTab(prev);
        return h.slice(0, -1);
      });
      setBackGen(g => g + 1);
    },
    backGen
  );

  /**
   * Horizontal swipes.
   *
   *  - from the very left edge (native only): back, the gesture people expect.
   *  - anywhere else: move one tab along.
   *
   * A drag that starts on something that moves sideways by itself (a carousel, a
   * chip row, a chart you scrub) belongs to that thing, never to the tabs: see
   * swipeGuard. Only drags that start on plain content change section.
   *
   * Direction follows the finger, like turning pages: finger to the left brings in
   * the next section (from the right), finger to the right goes back to the one before.
   *
   * The latest tab/handler are read from refs, because PanResponder is built once
   * and would otherwise close over the values from the first render.
   */
  const swipeState = useRef({ tabs, currentTab, openTab });
  swipeState.current = { tabs, currentTab, openTab };

  const edgeSwipe = useRef(
    PanResponder.create({
      // Every touch: note when it started, and whether it landed on a sideways scroller (web).
      // Returns false: the tabs never take a touch at its start.
      onStartShouldSetPanResponderCapture: e => {
        startSwipe();
        if (startsInHorizontalScroller((e.nativeEvent as unknown as { target?: unknown }).target ?? (e as unknown as { target?: unknown }).target)) claimSwipe();
        return false;
      },
      // Edge-back keeps capture priority: it starts in the margin, where nothing else lives.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Platform.OS !== 'web' && g.x0 < 24 && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      // A decisive, clearly horizontal drag on plain content — never one a card already owns,
      // and never a vertical scroll that drifts a little sideways.
      onMoveShouldSetPanResponder: (_, g) => !swipeClaimed() && Math.abs(g.dx) > 28 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
      onPanResponderRelease: (_, g) => {
        if (Platform.OS !== 'web' && g.x0 < 24 && (g.dx > 70 || g.vx > 0.6)) return goBack();

        // Far enough, or a quick flick that still travelled a little.
        const far = Math.abs(g.dx) > 80 || (Math.abs(g.dx) > 40 && Math.abs(g.vx) > 0.5);
        if (!far) return;

        const { tabs: list, currentTab: tab, openTab: open } = swipeState.current;
        const i = list.findIndex(x => x.id === tab);
        if (i < 0) return;
        // Finger to the left → next section (Accueil → Boutique); to the right → the one before.
        const next = g.dx < 0 ? list[i + 1] : list[i - 1];
        if (next) open(next.id);
      },
    })
  ).current;

  // Tab change: the new screen slides in from the side of the tab you moved towards.
  const reduceMotion = useReduceMotion();
  const enter = useRef(new Animated.Value(1)).current;
  const direction = useRef(1);
  const prevTab = useRef<ActiveTab>(currentTab);
  // Hide the new screen before it paints, then start the slide on the next frame, so a
  // heavy first render can't eat the animation (or flash the screen in place first).
  useLayoutEffect(() => {
    if (prevTab.current === currentTab) return;
    const order = tabs.map(t => t.id);
    direction.current = order.indexOf(currentTab) >= order.indexOf(prevTab.current) ? 1 : -1;
    prevTab.current = currentTab;
    enter.setValue(0);
    const frame = requestAnimationFrame(() =>
      Animated.timing(enter, { toValue: 1, duration: reduceMotion ? 120 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start()
    );
    return () => cancelAnimationFrame(frame);
  }, [currentTab, enter, reduceMotion]);

  // "Bienvenue" questionnaire: it owns the screen until it is answered or put off.
  const [habits, setHabits] = useState<HabitsProfile | null>(null);
  const [showHabits, setShowHabits] = useState(false);

  // Account settings ("Paramètres") live here, not inside a tab, so they can be opened from any screen.
  const [showAccount, setShowAccount] = useState(false);
  const [accountConfig, setAccountConfig] = useState<GymProfileConfig | null>(null);
  const [accountMembership, setAccountMembership] = useState<ClubMember | null>(null);

  useEffect(() => {
    NotificationService.init();
    DemoSeedService.ensureSeeded();
    checkUserProfile();
    GymConfigService.getConfig().then(setAccountConfig);
  }, []);

  useEffect(() => {
    if (userProfile) {
      ensureMember(userProfile).then(setAccountMembership);
      DemoSeedService.ensureJournal(userProfile.id);
    }
  }, [userProfile?.id, userProfile?.role]);

  // Members answer the questionnaire; staff never see it.
  useEffect(() => {
    if (!userProfile || userProfile.role !== 'member') return;
    HabitsService.get(userProfile.id).then(h => {
      setHabits(h);
      setShowHabits(HabitsService.shouldShow(h));
    });
  }, [userProfile?.id, userProfile?.role]);

  const checkUserProfile = async () => {
    const profile = await AuthService.getUserProfile();
    setUserProfile(profile ? await withFreshPermissions(profile) : null);
    setLoading(false);
  };

  /** Sign out keeps the account: an older account without a username gets one first, so it can sign in again. */
  const signOut = async () => {
    if (userProfile) await AuthService.ensureUsername(userProfile);
    await AuthService.logout();
    setShowAccount(false);
    setTabHistory([]);
    setUserProfile(null);
    setCurrentTab('floor');
  };

  const handleCompleteOnboarding = (profile: UserProfile) => {
    setTabHistory([]);
    setUserProfile(profile);
    setCurrentTab('floor');
  };

  if (loading || !langReady || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  // Before anything else, and only once: every screen after this is in one
  // language or the other, so the choice has to come first.
  if (!langChosen) {
    return <LanguageScreen onPick={setLang} />;
  }

  // First-time download/launch -> Show minimal Onboarding
  if (!userProfile) {
    return <OnboardingScreen onCompleteOnboarding={handleCompleteOnboarding} />;
  }

  // Habits before the Floor: it needs no scan, so it works away from the club.
  if (showHabits && habits && accountConfig) {
    const rules: ClubRules = {
      openDays: accountConfig.openDays,
      openingHour: accountConfig.openingHour,
      closingHour: accountConfig.closingHour,
      durationsSold: accountConfig.durationsSold,
      endOfMonthBilling: accountConfig.endOfMonthBilling,
      membershipsInApp: accountConfig.membershipsInApp,
    };
    return (
      <HabitsQuestionnaire
        firstName={(userProfile.fullName || '').trim().split(/\s+/)[0] || 'toi'}
        userId={userProfile.id}
        rules={rules}
        initial={habits}
        onDone={h => {
          setHabits(h);
          setShowHabits(false);
        }}
        onSnooze={() => {
          HabitsService.snooze(userProfile.id).then(setHabits);
          setShowHabits(false);
        }}
        onJoinBeginners={async () => {
          // "Débutants" is an open community: joining is immediate, no request.
          const map = await MurService.getMembership(userProfile.id, 'member');
          await MurService.saveMembership(userProfile.id, { ...map, debutants: 'member' });
        }}
      />
    );
  }

  return (
    <View {...edgeSwipe.panHandlers} style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.header} />

      {/* Main Active Screen */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: enter,
            transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : direction.current * 28, 0] }) }],
          },
        ]}
      >
        <>
            {currentTab === 'floor' && (
              <HomeScreen
                user={userProfile}
                onUpdateUser={setUserProfile}
                onNavigate={tab => openTab(tab)}
                onOpenAccount={() => setShowAccount(true)}
                onLogout={signOut}
                onWipe={async () => {
                  await AuthService.clearEverything();
                  setUserProfile(null);
                  setCurrentTab('floor');
                }}
                onOpenWallPost={postId => {
                  setWallFocus(postId);
                  openTab('community');
                }}
                onStartSession={() => {
                  setJournalStart(t => t + 1);
                  openTab('machines');
                }}
              />
            )}
            {currentTab === 'shop' && <MarketplaceScreen user={userProfile} />}
            {currentTab === 'community' && (
              <CommunityScreen
                user={userProfile}
                focusPostId={wallFocus}
                onFocusHandled={() => setWallFocus(null)}
                onOpenAccount={() => setShowAccount(true)}
              />
            )}
            {currentTab === 'coaches' && <CoachProfilesScreen user={userProfile} onUpdateUser={setUserProfile} />}
            {currentTab === 'machines' && (
              <JournalScreen user={userProfile} startToken={journalStart} />
            )}
        </>
      </Animated.View>

      {/* Bottom navigation: 5 tabs, 48px touch targets, the club's red marks the active one */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(6, insets.bottom) }]}>
        {tabs.map(tab => (
          <TabButton key={tab.id} tab={tab} label={t(tab.label)} active={currentTab === tab.id} onPress={() => openTab(tab.id)} />
        ))}
      </View>

      <AccountSheet
        visible={showAccount}
        onClose={() => setShowAccount(false)}
        user={userProfile}
        config={accountConfig}
        membership={accountMembership}
        onSaveProfile={profile => {
          AuthService.saveProfile(profile).then(setUserProfile);
        }}
        onRegenerateCode={code => {
          GymConfigService.saveConfig({ checkInCode: code }).then(setAccountConfig);
        }}
        onLogout={signOut}
        onWipe={async () => {
          await AuthService.clearEverything();
          setShowAccount(false);
          setUserProfile(null);
          setCurrentTab('floor');
        }}
      />
    </View>
  );
}

/**
 * One tab. The active one gets the club's red and a short red bar on the top edge,
 * the vertical stroke of the Power Gym logo; the icon gives a small bounce when pressed.
 */
function TabButton({ tab, label, active, onPress }: { tab: (typeof TABS)[number]; label: string; active: boolean; onPress: () => void }) {
  const on = useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(on, { toValue: active ? 1 : 0, useNativeDriver: nativeDriver, speed: 18, bounciness: 8 }).start();
  }, [active, on]);

  const pressTo = (v: number) => Animated.spring(press, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: 10 }).start();

  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      onPressIn={() => pressTo(0.86)}
      onPressOut={() => pressTo(1)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabMark, { opacity: on, transform: [{ scaleX: on }] }]} />
      <Animated.View style={{ transform: [{ scale: press }, { translateY: on.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }] }}>
        <Ionicons name={(active ? tab.iconActive : tab.icon) as any} size={23} color={active ? colors.tabActive : colors.tabInactive} />
      </Animated.View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.header,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.page,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  backBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: { fontSize: 16, fontWeight: '700', color: colors.text },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 2,
    paddingHorizontal: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 6,
  },
  tabMark: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 3,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    backgroundColor: colors.tabActive,
  },
  tabLabel: { color: colors.tabInactive, fontSize: 10.5, fontWeight: '600', letterSpacing: -0.1 },
  tabLabelActive: { color: colors.tabActive, fontWeight: '800' },
});
