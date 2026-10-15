import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { clubTheme, colors, radius } from '../../theme';
import { Avatar } from '../community/Avatar';
import { Wordmark } from '../ui/Wordmark';

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
  /** "Signaler un problème" (member) or the reports page with its count (admin). */
  onReport?: () => void;
  reportBadge?: number;
  reportLabel?: string;
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
    <Icon name={icon as any} size={24} color={colors.text} />
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
  onReport,
  reportBadge,
  reportLabel = 'Signaler un problème',
}) => (
  <View style={styles.header}>
    <View style={styles.center}>
      {/* The club's text logo (clubTheme.wordmark). */}
      <Wordmark size={24} />
    </View>

    <View style={styles.right}>
      <Pressable
        onPress={onOpenStreak}
        hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
        accessibilityRole="button"
        accessibilityLabel={`Série de ${streak} jours`}
        style={({ pressed }) => [styles.streakPill, pressed && styles.pressed]}
      >
        <Icon name="flame" size={16} color={colors.flame} />
        <Text style={styles.streakText}>{streak}</Text>
      </Pressable>
      {onReport && (
        <IconButton
          icon="megaphone-outline"
          label={reportBadge ? `${reportLabel}, ${reportBadge} en attente` : reportLabel}
          onPress={onReport}
          badge={reportBadge}
        />
      )}
      <IconButton
        icon="notifications-outline"
        label={unreadNotices ? `Activité, ${unreadNotices} nouveaux` : 'Activité'}
        onPress={onOpenNotices}
        badge={unreadNotices}
      />
      <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="Paramètres" style={styles.avatarBtn}>
        <View style={styles.avatarRing}>
          <Avatar name={avatarName} url={avatarUrl} size={36} />
        </View>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.header,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.bg },
  avatarBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakPill: {
    height: 44,
    minWidth: 60,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  streakText: { fontSize: 15, fontWeight: '800', color: colors.text },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.notification,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
});
