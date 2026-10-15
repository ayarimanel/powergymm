import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { CollapsibleFab } from '../CollapsibleFab';

interface Props {
  checkedInToday: boolean;
  onPress: () => void;
  /** Folded to a round icon while the member scrolls down the Floor. */
  collapsed?: boolean;
  /** "Signaler un problème" (member) or the reports page with its badge (owner), just left of Scan. */
  onReport?: () => void;
  reportBadge?: number;
  reportLabel?: string;
}

const nativeDriver = Platform.OS !== 'web';

const ReportButton: React.FC<{ onPress: () => void; badge?: number; label: string }> = ({ onPress, badge, label }) => {
  const press = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(press, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={[styles.reportWrap, { transform: [{ scale: press }] }]}>
      <Pressable onPress={onPress} onPressIn={() => to(0.92)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} en attente` : label} style={styles.report}>
        <Ionicons name="megaphone-outline" size={22} color={colors.amber.text} />
      </Pressable>
      {!!badge && (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Animated.View>
  );
};

/** Floating scan button, always reachable. After check-in it becomes a green "Présent" pill. "Signaler" sits on its left. */
export const ScanFab: React.FC<Props> = ({ checkedInToday, onPress, collapsed, onReport, reportBadge, reportLabel = 'Signaler un problème' }) => {
  const scan = checkedInToday ? (
    <CollapsibleFab
      inline
      icon="checkmark"
      label="Présent"
      color={colors.green.text}
      collapsed={collapsed}
      onPress={onPress}
      accessibilityLabel="Présence validée aujourd’hui"
      trailing={<Ionicons name="flame" size={18} color={colors.flamePale} />}
    />
  ) : (
    <CollapsibleFab inline icon="qr-code" label="Scan" collapsed={collapsed} onPress={onPress} accessibilityLabel="Scanner le QR code" />
  );
  return (
    <View style={styles.row} pointerEvents="box-none">
      {onReport && <ReportButton onPress={onReport} badge={reportBadge} label={reportLabel} />}
      {scan}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportWrap: { borderRadius: 24, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 5 },
  report: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.red.bar, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
