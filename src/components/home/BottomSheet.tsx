import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  PanResponderCallbacks,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useBackHandler } from '../../navigation/backStack';
import { haptics } from '../../utils/haptics';
import { colors } from '../../theme';
import { Icon } from '../ui/Icon';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Visible height fractions of the window, ascending. e.g. [0.5, 0.92] = half / full. */
  snaps: number[];
  /** Index into `snaps` the sheet opens at. */
  initialSnap?: number;
  /**
   * Render prop gets `expanded` (at the highest snap) and `extraBottom`: the part of the sheet that is
   * off-screen at the current snap. Add it as bottom padding of a scroll list so the last row can always
   * be scrolled into view, even at the half snap.
   */
  children: (expanded: boolean, extraBottom: number) => React.ReactNode;
  /** Rendered inside the drag zone under the handle (title row). Dragging works from here too. */
  header?: React.ReactNode;
  /**
   * 'page' (default): a full screen that slides in from the right, with a back button.
   * 'sheet': the slide-up sheet with snap points; kept for the coaches and the notifications.
   */
  variant?: 'page' | 'sheet';
}

/** Lets a scroll list inside the sheet tell the sheet whether it is scrolled to the top. */
const SheetScrollContext = createContext<((y: number) => void) | null>(null);

/**
 * Use instead of ScrollView inside a BottomSheet. While the list is at the top, a
 * downward drag on it moves the sheet (and closes it) instead of doing nothing,
 * like Instagram's comments. Horizontal lists are left alone.
 */
export const SheetScrollView = React.forwardRef<ScrollView, ScrollViewProps>(({ onScroll, ...props }, ref) => {
  const report = useContext(SheetScrollContext);
  const handle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!props.horizontal) report?.(e.nativeEvent.contentOffset.y);
    onScroll?.(e);
  };
  return (
    <ScrollView
      ref={ref}
      {...props}
      onScroll={handle}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      // Tapping a button while a field is focused should press it, not just
      // dismiss the keyboard and make the person tap twice.
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
      // iOS scrolls the focused field above the keyboard by itself when asked.
      automaticallyAdjustKeyboardInsets={props.automaticallyAdjustKeyboardInsets ?? !props.horizontal}
    />
  );
});

/** A sheet's content as a full page or as a slide-up sheet (see `variant`). */
export const BottomSheet: React.FC<BottomSheetProps> = props =>
  props.variant === 'sheet' ? <SlideSheet {...props} /> : <PageSheet {...props} />;

/**
 * Full-screen page: slides in from the right, closes with the back button at the top,
 * the phone's back button/gesture, or Escape on web. Same render prop as the sheet, at
 * full height (expanded = true, extraBottom = the keyboard).
 */
const PageSheet: React.FC<BottomSheetProps> = ({ visible, onClose, children, header }) => {
  const { width: winW } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const [mounted, setMounted] = useState(visible);
  const translateX = useRef(new Animated.Value(winW)).current;

  const slide = useCallback(
    (toValue: number, done?: () => void) =>
      Animated.timing(translateX, {
        toValue,
        duration: reduceMotion ? 120 : toValue === 0 ? 300 : 220,
        easing: toValue === 0 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && done?.()),
    [translateX, reduceMotion]
  );

  const requestClose = useCallback(() => {
    haptics.light();
    slide(winW, () => {
      setMounted(false);
      onClose();
    });
  }, [slide, winW, onClose]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateX.setValue(reduceMotion ? 0 : winW);
      const t = setTimeout(() => slide(0), 16);
      return () => clearTimeout(t);
    } else if (mounted) {
      slide(winW, () => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useBackHandler(visible && mounted, requestClose);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, requestClose]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <Animated.View style={[styles.page, { paddingTop: insets.top, transform: [{ translateX }] }]}>
        <View style={styles.pageInner}>
          <View style={styles.pageTop}>
            <Pressable onPress={requestClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour" style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
              <Icon name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            {!!header && <View style={styles.pageHeader}>{header}</View>}
          </View>
          <View style={[styles.body, { paddingBottom: insets.bottom }]}>
            <SheetScrollContext.Provider value={null}>{children(true, keyboard)}</SheetScrollContext.Provider>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

/**
 * Bottom sheet with snap points. Close it by swiping down anywhere on it (the list must be
 * at its top), tapping the backdrop, or the phone's back button/gesture. Swiping up on a
 * half-open sheet expands it. Only core React Native APIs, so it runs on iOS, Android and web.
 */
const SlideSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  snaps,
  initialSnap = 0,
  children,
  header,
}) => {
  const { height: winH, width: winW } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();

  const sheetH = snaps[snaps.length - 1] * winH;
  const closedY = sheetH + 24;
  // translateY that shows snap i (0 = sheet fully up)
  const snapYs = useMemo(() => snaps.map(s => sheetH - s * winH), [snaps, sheetH, winH]);

  const keyboard = useKeyboardHeight();
  const [mounted, setMounted] = useState(visible);
  const [snapIndex, setSnapIndex] = useState(initialSnap);
  const translateY = useRef(new Animated.Value(closedY)).current;
  const currentY = useRef(closedY);
  const dragStartY = useRef(0);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => (currentY.current = value));
    return () => translateY.removeListener(id);
  }, [translateY]);

  const animateTo = useCallback(
    (toValue: number, done?: () => void) => {
      const anim = reduceMotion
        ? Animated.timing(translateY, { toValue, duration: 150, useNativeDriver: true })
        : toValue === closedY
        ? Animated.timing(translateY, {
            toValue,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(translateY, {
            toValue,
            damping: 22,
            stiffness: 220,
            mass: 0.9,
            useNativeDriver: true,
          });
      anim.start(({ finished }) => finished && done?.());
    },
    [translateY, closedY, reduceMotion]
  );

  const requestClose = useCallback(() => {
    haptics.light();
    animateTo(closedY, () => {
      setMounted(false);
      onClose();
    });
  }, [animateTo, closedY, onClose]);

  // Open / close driven by `visible`
  useEffect(() => {
    if (visible) {
      listAtTop.current = true;
      setMounted(true);
      setSnapIndex(initialSnap);
      translateY.setValue(closedY);
      // wait a frame so the Modal has mounted before animating in
      const t = setTimeout(() => animateTo(snapYs[initialSnap]), 16);
      return () => clearTimeout(t);
    } else if (mounted) {
      animateTo(closedY, () => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Whether the sheet's scroll list is at its top (no list = always true).
  const listAtTop = useRef(true);
  const reportScroll = useCallback((y: number) => {
    listAtTop.current = y <= 1;
  }, []);
  const snapIndexRef = useRef(snapIndex);
  snapIndexRef.current = snapIndex;

  /**
   * After a drag (vy in px/ms, positive = down): a flick moves one stop in its direction;
   * a slow drag snaps to the nearest stop, closing once pulled a quarter of the way down.
   */
  const settle = useCallback(
    (vy: number) => {
      const y = currentY.current;
      const open = [...snapYs].sort((p, q) => p - q); // top-most first
      const lowest = open[open.length - 1];
      let target: number;
      if (vy > 0.3) target = open.find(s => s > y + 10) ?? closedY;
      else if (vy < -0.3) target = [...open].reverse().find(s => s < y - 10) ?? open[0];
      else if (y > lowest + (closedY - lowest) / 4) target = closedY;
      else target = open.reduce((best, s) => (Math.abs(s - y) < Math.abs(best - y) ? s : best), open[0]);

      if (target === closedY) {
        requestClose();
      } else {
        setSnapIndex(snapYs.indexOf(target));
        animateTo(target);
      }
    },
    [snapYs, closedY, animateTo, requestClose]
  );

  const handlers = useMemo(
    (): PanResponderCallbacks => ({
      onPanResponderGrant: () => {
        translateY.stopAnimation(v => (dragStartY.current = v));
      },
      onPanResponderMove: (_, g) => {
        const top = Math.min(...snapYs); // highest snap = smallest translateY
        translateY.setValue(Math.min(closedY, Math.max(top, dragStartY.current + g.dy)));
      },
      onPanResponderRelease: (_, g) => settle(g.vy),
      onPanResponderTerminationRequest: () => false,
    }),
    [snapYs, closedY, translateY, settle]
  );

  // Handle + header: always draggable.
  const pan = useMemo(
    () => PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4, ...handlers }),
    [handlers]
  );

  // Body: take over a clearly vertical drag when the list can't scroll that way itself:
  // down while scrolled to the top (close/shrink), or up while the sheet is only half open (expand).
  const bodyPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => {
          if (Platform.OS === 'web') return false; // web uses the touch listeners below
          const vertical = Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5;
          if (!vertical || !listAtTop.current) return false;
          const expanded = snapIndexRef.current === snaps.length - 1;
          return g.dy > 0 || !expanded;
        },
        ...handlers,
      }),
    [handlers, snaps.length]
  );

  useBackHandler(visible && mounted, requestClose);

  // Web: inside a scrollable div the browser keeps the touch for its own scrolling and never
  // hands it to the responder system. So the body drag is driven from raw touch events: once a
  // drag should move the sheet (down with the list at its top, or up on a half-open sheet), we
  // stop the browser scrolling and move the sheet ourselves.
  const bodyRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !mounted) return;
    const el = bodyRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const top = Math.min(...snapYs);
    let x0 = 0, y0 = 0, originY = 0, originT = 0, lastY = 0, lastT = 0, vy = 0;
    let dragging = false;

    const onStart = (e: TouchEvent) => {
      x0 = e.touches[0]?.clientX ?? 0;
      y0 = e.touches[0]?.clientY ?? 0;
      dragging = false;
      vy = 0;
    };
    const onMove = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0;
      const y = e.touches[0]?.clientY ?? 0;
      if (!dragging) {
        const dx = x - x0;
        const dy = y - y0;
        const vertical = Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.5;
        const expanded = snapIndexRef.current === snaps.length - 1;
        if (!vertical || !listAtTop.current || (dy < 0 && expanded)) return;
        dragging = true;
        translateY.stopAnimation(v => (originT = v));
        originY = y;
        lastY = y;
        lastT = e.timeStamp;
      }
      e.preventDefault();
      translateY.setValue(Math.min(closedY, Math.max(top, originT + (y - originY))));
      const dt = e.timeStamp - lastT;
      if (dt > 0) vy = (y - lastY) / dt;
      lastY = y;
      lastT = e.timeStamp;
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      settle(vy);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [mounted, snaps.length, snapYs, closedY, translateY, settle]);

  const backdropOpacity = translateY.interpolate({
    inputRange: [snapYs[snapYs.length - 1], closedY],
    outputRange: [0.45, 0],
    extrapolate: 'clamp',
  });

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { height: sheetH, width: Math.min(winW, 560), transform: [{ translateY }] },
          ]}
        >
          <View {...pan.panHandlers} style={styles.dragZone}>
            <View style={styles.handle} />
            {header}
          </View>
          <View ref={bodyRef} {...bodyPan.panHandlers} style={[styles.body, { paddingBottom: insets.bottom }]}>
            <SheetScrollContext.Provider value={reportScroll}>
              {/* The keyboard height is folded into extraBottom, which every sheet
                  already turns into bottom padding — so a focused field scrolls
                  clear of the keyboard instead of sitting underneath it. */}
              {children(snapIndex === snaps.length - 1, sheetH - snaps[snapIndex] * winH + keyboard)}
            </SheetScrollContext.Provider>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { backgroundColor: colors.black },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dragZone: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 8 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.disabled,
    marginBottom: 12,
  },
  body: { flex: 1 },

  page: { flex: 1, backgroundColor: colors.page },
  pageInner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  pageTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, minHeight: 64 },
  pageHeader: { flex: 1, minWidth: 0 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
