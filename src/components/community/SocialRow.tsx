/**
 * The social accounts shown on a member's profile.
 * All the parsing and validation lives in community/socials.ts; this only draws it.
 */
import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { SocialLinks, usableSocials } from '../../community/socials';
import { colors } from '../../theme';

export const SocialRow: React.FC<{ socials?: SocialLinks }> = ({ socials }) => {
  const shown = usableSocials(socials);
  if (shown.length === 0) return null;

  return (
    <View style={styles.row}>
      {shown.map(({ network, handle }) => (
        <Pressable
          key={network.key}
          onPress={() => Linking.openURL(network.url(handle)).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={`${network.label} : ${handle}`}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name={network.icon as any} size={16} color={network.color} />
          <Text style={styles.handle} numberOfLines={1}>
            {handle}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    maxWidth: 180,
  },
  handle: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
});
