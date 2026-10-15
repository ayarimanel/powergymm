import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommunityPost, MemberProfile } from '../../types/database';
import { timeAgoFr } from '../../services/communityService';
import { useBackHandler } from '../../navigation/backStack';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { Avatar } from './Avatar';
import { colors } from '../../theme';

interface Props {
  records: CommunityPost[];
  profiles: Record<string, MemberProfile>;
  startIndex: number | null;
  onClose: () => void;
  onOpenPost: (postId: string) => void;
}

const STORY_MS = 6000;

/** Full-screen, gold-themed viewer for records — tap right/left to move, swipe down to close. */
export const PrStoryViewer: React.FC<Props> = ({ records, profiles, startIndex, onClose, onOpenPost }) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [index, setIndex] = useState(startIndex ?? 0);
  const progress = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const visible = startIndex !== null;

  useEffect(() => {
    if (startIndex !== null) setIndex(startIndex);
  }, [startIndex]);

  const pr = records[index];

  useEffect(() => {
    if (!visible || !pr) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: STORY_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (!finished) return;
      if (index < records.length - 1) setIndex(i => i + 1);
      else onClose();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, index, pr?.id]);

  useBackHandler(visible, onClose);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 120 || g.vy > 0.8) {
            onClose();
            dragY.setValue(0);
          } else {
            Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [dragY, onClose]
  );

  if (!visible || !pr || !pr.prDetails) return null;
  const d = pr.prDetails;
  const approved = pr.prApproval?.status === 'approved';
  const delta = d.prevWeightKg != null ? d.weightKg - d.prevWeightKg : null;
  const p = profiles[pr.userId];

  const go = (dir: 1 | -1) => {
    const next = index + dir;
    if (next < 0) return;
    if (next >= records.length) onClose();
    else setIndex(next);
  };

  return (
    <Modal visible transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.root,
          { paddingTop: insets.top + 8, transform: [{ translateY: dragY }] },
          { opacity: dragY.interpolate({ inputRange: [0, height / 2], outputRange: [1, 0.5], extrapolate: 'clamp' }) },
        ]}
      >
        <View style={styles.bars}>
          {records.map((r, i) => (
            <View key={r.id} style={styles.barTrack}>
              <Animated.View
                style={[styles.barFill, { width: i < index ? '100%' : i > index ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <View style={styles.pill}>
            <Icon name="trophy" size={14} color={colors.gold.bright} />
            <Text style={styles.pillText}>Record</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
            <Icon name="close" size={28} color={colors.gold.bright} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.authorRow}>
            <Avatar name={pr.userName} url={p?.avatarUrl} size={44} />
            <View>
              <Text style={styles.author}>{pr.userName}</Text>
              <Text style={styles.time}>{timeAgoFr(pr.createdAt)}</Text>
            </View>
          </View>

          <Text style={styles.exercise}>{d.exercise}</Text>
          <View style={styles.bigRow}>
            <Text style={styles.big}>{d.weightKg}</Text>
            <Text style={styles.bigUnit}>kg</Text>
            <Text style={styles.reps}>× {d.reps}</Text>
          </View>

          {delta != null && delta > 0 && (
            <View style={styles.deltaChip}>
              <Icon name="trending-up" size={16} color={colors.green.text} />
              <Text style={styles.deltaText}>+{delta} kg vs. précédent ({d.prevWeightKg} kg)</Text>
            </View>
          )}

          {!!pr.caption && <Text style={styles.caption}>{pr.caption}</Text>}

          <View style={styles.statusRow}>
            <Icon name={approved ? 'shield-checkmark' : 'hourglass-outline'} size={18} color={colors.gold.bright} />
            <Text style={styles.statusText}>
              {approved ? `Validé par ${pr.prApproval?.approvedByName ?? 'un coach'}` : 'En attente de validation'}
            </Text>
          </View>

          <Pressable onPress={() => onOpenPost(pr.id)} accessibilityRole="button" style={styles.openBtn}>
            <Text style={styles.openBtnText}>Voir la publication</Text>
            <Icon name="arrow-forward" size={16} color={colors.gold.bright} />
          </Pressable>
        </View>

        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.tapRow} pointerEvents="box-none">
            <Pressable style={{ flex: 1 }} onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="Précédent" />
            <Pressable style={{ flex: 2 }} onPress={() => go(1)} accessibilityRole="button" accessibilityLabel="Suivant" />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const GOLD_BG = colors.gold.bg;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOLD_BG, paddingHorizontal: 16 },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.gold.soft, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.gold.bar },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, zIndex: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.gold.soft },
  pillText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  body: { flex: 1, justifyContent: 'center', gap: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  author: { fontSize: 17, fontWeight: '800', color: colors.text },
  time: { fontSize: 13, color: colors.gold.text, marginTop: 1 },
  exercise: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  big: { fontSize: 88, lineHeight: 90, fontWeight: '900', color: colors.gold.bright },
  bigUnit: { fontSize: 28, fontWeight: '900', color: colors.gold.text, marginBottom: 14 },
  reps: { fontSize: 28, fontWeight: '800', color: colors.gold.text, marginBottom: 14, marginLeft: 4 },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.green.soft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  deltaText: { fontSize: 14, fontWeight: '800', color: colors.green.text },
  caption: { fontSize: 16, color: colors.text, lineHeight: 23 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 14, fontWeight: '700', color: colors.text },
  openBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.gold.soft, paddingHorizontal: 16, height: 44, borderRadius: 22, marginTop: 4 },
  openBtnText: { fontSize: 14, fontWeight: '800', color: colors.text },
  tapRow: { flex: 1, flexDirection: 'row', marginTop: 120, marginBottom: 220 },
});
