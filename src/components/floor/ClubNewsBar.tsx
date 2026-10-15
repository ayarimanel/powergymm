import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { NewsItem, NewsType } from '../../services/clubNewsService';
import { brandAlpha, colors, fonts, ink, radius } from '../../theme';
import { haptics } from '../../utils/haptics';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { useBackHandler } from '../../navigation/backStack';
import { claimSwipe } from '../../navigation/swipeGuard';
import { Tag, TagTone } from '../ui/Tag';
import { Title } from '../ui/Title';

const nativeDriver = Platform.OS !== 'web';
/** Space the pinned news card takes at the top of Accueil (card + its top margin). */
export const NEWS_BAR_HEIGHT = 82;

export const NEWS_TYPES: Record<NewsType, { label: string; icon: string; solid: string; soft: string; text: string }> = {
  info: { label: 'Info', icon: 'information-circle', solid: colors.brand, soft: colors.brandSoft, text: colors.brandText },
  promo: { label: 'Promo', icon: 'pricetag', solid: colors.pink.bar, soft: colors.pink.soft, text: colors.pink.text },
  event: { label: 'Événement', icon: 'calendar', solid: colors.amber.bar, soft: colors.amber.soft, text: colors.amber.text },
  coach: { label: 'Coach', icon: 'person', solid: colors.violet.bar, soft: colors.violet.soft, text: colors.violet.text },
  cours: { label: 'Cours', icon: 'time', solid: colors.teal.bar, soft: colors.teal.soft, text: colors.teal.text },
};

const TAG_TONE: Record<NewsType, TagTone> = { info: 'info', promo: 'brand', cours: 'success', coach: 'neutral', event: 'warning' };

interface Props {
  items: NewsItem[];
  onAction: (item: NewsItem) => void;
  onRead: (ids: string[]) => void;
}

/**
 * Red news card pinned under the Accueil header. Pull it down (or tap it) and "Infos du club"
 * slides down from the top with every announcement; push it up, tap it again, tap the dimmed
 * background, back or Escape closes it.
 * Must be rendered as an absolute overlay over the Floor content area (it fills its parent).
 */
export const ClubNewsBar: React.FC<Props> = ({ items, onAction, onRead }) => {
  const reduceMotion = useReduceMotion();
  const offset = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const [panelH, setPanelH] = useState(0);
  const [areaH, setAreaH] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const openRef = useRef(false);
  const panelHRef = useRef(0);
  const dragBase = useRef(0);

  const unread = items.filter(n => !n.read);
  const latest = unread[0] ?? items[0];

  const setPanel = (next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (!next) setExpanded(null);
    if (next !== open) haptics.select();
    Animated.timing(offset, {
      toValue: next ? panelHRef.current : 0,
      duration: reduceMotion ? 120 : 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    }).start();
  };
  const setPanelRef = useRef(setPanel);
  setPanelRef.current = setPanel;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        claimSwipe();
        offset.stopAnimation();
        dragBase.current = openRef.current ? panelHRef.current : 0;
      },
      // The list follows the finger, then settles open or closed.
      onPanResponderMove: (_, g) => {
        offset.setValue(Math.max(0, Math.min(panelHRef.current, dragBase.current + g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        const wasOpen = openRef.current;
        if (Math.abs(g.dy) <= 4) return setPanelRef.current(!wasOpen);
        if (g.vy > 0.5) return setPanelRef.current(true);
        if (g.vy < -0.5) return setPanelRef.current(false);
        setPanelRef.current(wasOpen ? g.dy > -50 : g.dy > 50);
      },
      onPanResponderTerminate: () => setPanelRef.current(openRef.current),
    })
  ).current;

  useBackHandler(open, () => setPanel(false));

  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanelRef.current(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // One gentle nudge on arrival when there is something new, so members learn the bar pulls down.
  const hasUnread = unread.length > 0;
  useEffect(() => {
    if (!hasUnread || reduceMotion || !panelH) return;
    const t = setTimeout(() => {
      if (openRef.current) return;
      Animated.sequence([
        Animated.timing(offset, { toValue: 10, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.spring(offset, { toValue: 0, useNativeDriver: nativeDriver, speed: 14, bounciness: 10 }),
      ]).start();
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread, reduceMotion, panelH > 0]);

  const onPanelLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    panelHRef.current = h;
    setPanelH(h);
    if (openRef.current) offset.setValue(h);
  };

  const markRead = (ids: string[]) => {
    if (ids.length) onRead(ids);
  };

  const toggleItem = (n: NewsItem) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(cur => (cur === n.id ? null : n.id));
    if (!n.read) markRead([n.id]);
  };

  const runAction = (n: NewsItem) => {
    setPanel(false);
    onAction(n);
  };

  if (!items.length) return null;

  const h = Math.max(1, panelH);
  const scrimOpacity = offset.interpolate({ inputRange: [0, 220], outputRange: [0, 1], extrapolate: 'clamp' });
  const panelY = offset.interpolate({ inputRange: [0, h], outputRange: [-h, 0], extrapolate: 'clamp' });
  const chevron = offset.interpolate({ inputRange: [0, h], outputRange: ['0deg', '180deg'], extrapolate: 'clamp' });

  const barSmall = open
    ? 'Infos du club'
    : unread.length
      ? `${unread.length} ${unread.length === 1 ? 'nouvelle info' : 'nouvelles infos'} du club`
      : 'Infos du club';
  const barTitle = open ? 'Glisse vers le haut pour fermer' : latest?.title;

  return (
    <View style={styles.area} pointerEvents="box-none" onLayout={e => setAreaH(e.nativeEvent.layout.height)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrimOpacity }]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPanel(false)} accessibilityLabel="Fermer les infos du club" />
      </Animated.View>

      {/* "Infos du club": slides down from the top, the red card follows under it as its handle. */}
      <Animated.View
        onLayout={onPanelLayout}
        pointerEvents={open ? 'auto' : 'none'}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!open}
        style={[styles.panel, { maxHeight: areaH ? areaH - NEWS_BAR_HEIGHT - 24 : 480, opacity: panelH ? 1 : 0, transform: [{ translateY: panelY }] }]}
      >
        <View style={styles.panelHead}>
          <Title variant="display" size={34} numberOfLines={1} style={{ flexShrink: 0 }}>{unread.length ? `${unread.length} ${unread.length === 1 ? 'nouvelle' : 'nouvelles'}` : 'À jour'}</Title>
          {unread.length > 0 && (
            <Pressable onPress={() => markRead(unread.map(n => n.id))} hitSlop={8} accessibilityRole="button" style={{ flexShrink: 1 }}>
              <Text style={styles.link}>Tout marquer comme lu</Text>
            </Pressable>
          )}
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {items.map(n => {
            const t = NEWS_TYPES[n.type];
            const isOpen = expanded === n.id;
            return (
              <View key={n.id} style={[styles.item, n.pinned && !n.read && styles.itemPinned]}>
                <Pressable
                  onPress={() => toggleItem(n)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${t.label}${n.read ? '' : ', non lue'} : ${n.title}`}
                  style={({ pressed }) => [styles.itemBtn, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.meta}>
                    <Tag label={t.label} tone={TAG_TONE[n.type]} />
                    {n.pinned && (
                      <View style={styles.pin}>
                        <Icon name="pin" size={14} color={colors.brandText} />
                        <Text style={styles.pinText}>Épinglé</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.title}>{n.title}</Text>
                  {!!n.text && (
                    <Text style={styles.text} numberOfLines={isOpen ? undefined : 2}>
                      {n.text}
                    </Text>
                  )}
                  {isOpen && !!n.when && (
                    <View style={styles.whenRow}>
                      <Icon name="time-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.whenText}>{n.when}</Text>
                    </View>
                  )}
                  <Text style={styles.metaText} numberOfLines={1}>
                    {n.author} · {n.date}
                  </Text>
                  {!n.read && <View style={styles.unreadDot} />}
                </Pressable>
                {isOpen && !!n.cta && (
                  <Pressable
                    onPress={() => runAction(n)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.ctaText}>{n.cta}</Text>
                    <Icon name="arrow-forward" size={16} color={colors.white} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Fermer les infos du club' : `${barSmall}, ouvrir`}
        onAccessibilityTap={() => setPanel(!open)}
        style={[styles.bar, open && styles.barOpen, { transform: [{ translateY: offset }] }]}
      >
        <View style={styles.barRow}>
          <View style={[styles.count, !unread.length && styles.countZero]}>
            <Icon name={unread.length ? 'megaphone-outline' : 'checkmark'} size={20} color={unread.length ? colors.white : colors.brandText} />
          </View>
          <View style={styles.barTxt}>
            <Text style={styles.barSmall} numberOfLines={1}>{barSmall}</Text>
            <Text style={styles.barTitle} numberOfLines={1}>{barTitle}</Text>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevron }] }}>
            <Icon name="chevron-down" size={22} color={colors.brandText} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  area: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 30 },
  scrim: { backgroundColor: ink(0.6) },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: colors.page,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
  },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  link: { fontSize: 13, fontWeight: '700', color: colors.brand, paddingBottom: 6, textAlign: 'right' },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { gap: 12, paddingHorizontal: 16 },

  item: { borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  itemPinned: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  itemBtn: { gap: 8, padding: 18 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingRight: 18 },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pinText: { fontSize: 14, fontWeight: '600', color: colors.brandText },
  metaText: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  title: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 21, lineHeight: 24, color: colors.text, textTransform: 'uppercase', paddingRight: 14 },
  text: { fontSize: 14, fontWeight: '500', lineHeight: 21, color: colors.textSecondary },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whenText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  unreadDot: { position: 'absolute', top: 22, right: 18, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: colors.brand,
  },
  ctaText: { color: colors.white, fontSize: 14, fontWeight: '800' },

  // Pinned red card under the header (design-ref Main "N nouvelles infos du club"). Pull or tap to open the list.
  bar: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    height: NEWS_BAR_HEIGHT - 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: brandAlpha(0.35),
    borderRadius: 24,
    ...(Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none', touchAction: 'none' } as object) : null),
  },
  barOpen: { backgroundColor: colors.card, borderColor: colors.border },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  count: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  countZero: { backgroundColor: colors.brandTint },
  countText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  barTxt: { flex: 1, minWidth: 0, gap: 2 },
  barSmall: { fontSize: 13, fontWeight: '600', color: colors.brandText },
  barTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
});
