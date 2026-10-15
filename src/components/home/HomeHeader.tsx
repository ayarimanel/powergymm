import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { clubTheme, colors, radius } from '../../theme';
import { Avatar } from '../community/Avatar';

interface Props {
  gymName: string;
  /** Not shown any more: the header uses the club's bundled logo (src/config/clubTheme.ts). */
  logoUrl?: string;
  streak: number;
  unreadNotices: number;
  onOpenStreak: () => void;
  onOpenNotices: () => void;
  avatarName: string;
  avatarUrl?: string;
  onOpenProfile: () => void;
}

const IconButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  badge?: number;
}> = ({ icon, label, onPress, badge }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
  >
    <Ionicons name={icon as any} size={24} color={colors.text} />
    {!!badge && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
      </View>
    )}
  </Pressable>
);

/** Compact 56px sticky header. Lives outside the ScrollView so it never scrolls away. */
export const HomeHeader: React.FC<Props> = ({
  gymName,
  streak,
  unreadNotices,
  onOpenStreak,
  onOpenNotices,
  avatarName,
  avatarUrl,
  onOpenProfile,
}) => (
  <View style={styles.header}>
    <View style={styles.center}>
      {/* The club's full logo is its name: no text next to it. */}
      <Image
        source={clubTheme.logo}
        style={styles.logo}
        resizeMode="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={gymName}
        accessibilityIgnoresInvertColors
      />
    </View>

    <View style={styles.right}>
      <Pressable
        onPress={onOpenStreak}
        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
        accessibilityRole="button"
        accessibilityLabel={`Série de ${streak} jours`}
        style={({ pressed }) => [styles.streakPill, pressed && styles.pressed]}
      >
        <Ionicons name="flame" size={16} color={colors.flame} />
        <Text style={styles.streakText}>{streak}</Text>
      </Pressable>
      <IconButton
        icon="heart-outline"
        label={unreadNotices ? `Activité, ${unreadNotices} nouveaux` : 'Activité'}
        onPress={onOpenNotices}
        badge={unreadNotices}
      />
      <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="Paramètres" style={styles.avatarBtn}>
        <Avatar name={avatarName} url={avatarUrl} size={34} />
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.header,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  avatarBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.card },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, minWidth: 0, paddingLeft: 6 },
  logo: { height: 52, width: Math.round(52 * clubTheme.logoAspect) },
  right: { flexDirection: 'row', alignItems: 'center' },
  streakPill: {
    height: 32,
    minWidth: 48,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.flameSoft,
  },
  streakText: { fontSize: 14, fontWeight: '800', color: colors.flameText },
  badge: {
    position: 'absolute',
    top: 4,
    right: 3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.notification,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.header,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
});
