import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { Community } from '../../services/communitiesService';
import { colors } from '../../theme';
import { haptics } from '../../utils/haptics';

interface Props {
  communities: Community[]; // joined ones shown in the bar
  activeId: string | null; // null = "Pour toi" (FYP)
  onSelect: (id: string | null) => void;
  onDiscover: () => void;
}

export const CommunitiesBar: React.FC<Props> = ({ communities, activeId, onSelect, onDiscover }) => {
  const pick = (id: string | null) => {
    haptics.select();
    onSelect(id);
  };
  const fypOn = activeId === null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable
        onPress={() => pick(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: fypOn }}
        style={[styles.chip, fypOn && styles.fypOn]}
      >
        <Icon name="sparkles" size={14} color={fypOn ? colors.white : colors.brand} />
        <Text style={[styles.chipText, fypOn && styles.chipTextOnDark]}>Pour toi</Text>
      </Pressable>

      {communities.map(c => {
        const on = activeId === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => pick(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.chip, on && { backgroundColor: c.color, borderColor: c.color }]}
          >
            <Text style={styles.emoji}>{c.emoji}</Text>
            <Text style={[styles.chipText, on && styles.chipTextOnDark]} numberOfLines={1}>{c.name}</Text>
            {c.official && <Icon name="checkmark-circle" size={13} color={on ? colors.white : colors.brand} />}
          </Pressable>
        );
      })}

      <Pressable onPress={onDiscover} accessibilityRole="button" accessibilityLabel="Découvrir les communautés" style={[styles.chip, styles.discover]}>
        <Icon name="add" size={16} color={colors.textSecondary} />
        <Text style={styles.chipText}>Découvrir</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  fypOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  discover: { backgroundColor: colors.bg, borderStyle: 'dashed' },
  emoji: { fontSize: 15 },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, maxWidth: 140 },
  chipTextOnDark: { color: colors.white },
});
