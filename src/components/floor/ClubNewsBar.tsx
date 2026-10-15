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
import { Ionicons } from '@expo/vector-icons';
import { NewsItem, NewsType } from '../../services/clubNewsService';
import { colors, ink } from '../../theme';
import { haptics } from '../../utils/haptics';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { useBackHandler } from '../../navigation/backStack';
import { claimSwipe } from '../../navigation/swipeGuard';

const nativeDriver = Platform.OS !== 'web';
export const NEWS_BAR_HEIGHT = 56;

export const NEWS_TYPES: Record<NewsType, { label: string; icon: string; solid: string; soft: string; text: string }> = {
  info: { label: 'Info', icon: 'information-circle', solid: colors.brand, soft: colors.brandSoft, text: colors.brandText },
  promo: { label: 'Promo', icon: 'pricetag', solid: colors.pink.bar, soft: colors.pink.soft, text: colors.pink.text },
  event: { label: 'Événement', icon: 'calendar', solid: colors.amber.bar, soft: colors.amber.soft, text: colors.amber.text },
  coach: { label: 'Coach', icon: 'person', solid: colors.violet.bar, soft: colors.violet.soft, text: colors.violet.text },
  cours: { label: 'Cours', icon: 'time', solid: colors.teal.bar, soft: colors.teal.soft, text: colors.teal.text },
};

interface Props {
  items: NewsItem[];
  onAction: (item: NewsItem) => void;
  onRead: (ids: string[]) => void;
}

/**
 * Slim bar pinned under the Floor header. Pull it down (or tap it) to reveal every club announcement;
 * push it up, tap it again, or tap the dimmed background to close.
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
      duration: reduceMotion ? 120 : 320,
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
      ? `${unread.length === 1 ? 'Nouvelle info' : 'Nouvelles infos'} du club`
      : 'Infos du club';
  const barTitle = open ? 'Glisse vers le haut pour fermer' : latest?.title;

  return (
    <View style={styles.area} pointerEvents="box-none" onLayout={e => setAreaH(e.nativeEvent.layout.height)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrimOpacity }]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPanel(false)} accessibilityLabel="Fermer les infos du club" />
      </Animated.View>

      <Animated.View
        onLayout={onPanelLayout}
        pointerEvents={open ? 'auto' : 'none'}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!open}
        style={[
          styles.panel,
          { maxHeight: areaH ? areaH * 0.62 : 420, opacity: panelH ? 1 : 0, transform: [{ translateY: panelY }] },
        ]}
      >
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle} accessibilityRole="header">Infos du club</Text>
          {unread.length > 0 && (
            <Pressable onPress={() => markRead(unread.map(n => n.id))} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>Tout marquer comme lu</Text>
            </Pressable>
          )}
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {items.map(n => {
            const t = NEWS_TYPES[n.type];
            const isOpen = expanded === n.id;
            return (
              <View key={n.id} style={[styles.item, { backgroundColor: n.read ? colors.bg : t.soft }]}>
                <Pressable
                  onPress={() => toggleItem(n)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={`${t.label}${n.read ? '' : ', non lue'} : ${n.title}`}
                  style={({ pressed }) => [styles.itemBtn, pressed && { opacity: 0.85 }]}
                >
                  <View style={[styles.icon, { backgroundColor: t.solid }]}>
                    <Ionicons name={t.icon as any} size={18} color={colors.white} />
                  </View>
                  <View style={styles.body}>
                    <View style={styles.meta}>
                      <Text style={[styles.tag, { color: t.text }]}>{t.label}</Text>
                      {n.pinned && (
                        <View style={styles.pin}>
                          <Ionicons name="pin" size={10} color={colors.text} />
                          <Text style={styles.pinText}>Épinglé</Text>
                        </View>
                      )}
                      <Text style={styles.metaText} numberOfLines={1}>
                        {n.author} · {n.date}
                      </Text>
                    </View>
                    <Text style={styles.title}>{n.title}</Text>
                    {!!n.text && (
                      <Text style={styles.text} numberOfLines={isOpen ? undefined : 2}>
                        {n.text}
                      </Text>
                    )}
                    {isOpen && !!n.when && (
                      <View style={styles.whenRow}>
                        <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                        <Text style={styles.whenText}>{n.when}</Text>
                      </View>
                    )}
                  </View>
                  {!n.read && <View style={styles.unreadDot} />}
                </Pressable>
                {isOpen && !!n.cta && (
                  <Pressable
                    onPress={() => runAction(n)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.cta, { backgroundColor: t.solid }, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.ctaText}>{n.cta}</Text>
                    <Ionicons name="arrow-forward" size={15} color={colors.white} />
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
        accessibilityLabel={open ? 'Fermer les infos du club' : `${unread.length} nouvelles infos du club, ouvrir`}
        onAccessibilityTap={() => setPanel(!open)}
        style={[styles.bar, { transform: [{ translateY: offset }] }]}
      >
        <View style={styles.barRow}>
          <View style={[styles.count, !unread.length && styles.countZero]}>
            {unread.length ? (
              <Text style={styles.countText}>{unread.length}</Text>
            ) : (
              <Ionicons name="checkmark" size={14} color={colors.brand} />
            )}
          </View>
          <View style={styles.barTxt}>
            <Text style={styles.barSmall} numberOfLines={1}>{barSmall}</Text>
            <Text style={styles.barTitle} numberOfLines={1}>{barTitle}</Text>
          </View>
          <View style={styles.dots}>
            {unread.slice(0, 4).map(n => (
              <View key={n.id} style={[styles.dot, { backgroundColor: NEWS_TYPES[n.type].solid }]} />
            ))}
          </View>
          <Animated.View style={{ transform: [{ rotate: chevron }] }}>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Animated.View>
        </View>
        <View style={styles.grip} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  area: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 30 },
  scrim: { backgroundColor: ink(0.45) },

  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 10 },
  panelTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  link: { fontSize: 12, fontWeight: '800', color: colors.brand },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { gap: 8, paddingBottom: 4 },

  item: { borderRadius: 16 },
  itemBtn: { flexDirection: 'row', gap: 12, padding: 12 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 3, paddingRight: 10 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tag: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.card },
  pinText: { fontSize: 11, fontWeight: '800', color: colors.text },
  metaText: { fontSize: 11, color: colors.textMuted, flexShrink: 1 },
  title: { fontSize: 14, fontWeight: '800', color: colors.text, lineHeight: 18 },
  text: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  whenText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  unreadDot: { position: 'absolute', top: 14, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red.bar },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    marginLeft: 60,
    marginRight: 12,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  ctaText: { color: colors.white, fontSize: 13, fontWeight: '800' },

  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: NEWS_BAR_HEIGHT,
    justifyContent: 'center',
    gap: 5,
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none', touchAction: 'none' } as object) : null),
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.red.bar, alignItems: 'center', justifyContent: 'center' },
  countZero: { backgroundColor: colors.brandSoft },
  countText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  barTxt: { flex: 1, minWidth: 0 },
  barSmall: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  barTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
});
