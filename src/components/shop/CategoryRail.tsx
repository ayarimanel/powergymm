import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Icon, IconName } from '../ui/Icon';
import { CATEGORY_META, ProductCategory } from '../../shop/categoryMeta';
import { colors } from '../../theme';
import { haptics } from '../../utils/haptics';
import { claimSwipe } from '../../navigation/swipeGuard';

type Filter = 'all' | 'promo' | ProductCategory;

interface Props {
  active: Filter;
  counts: Record<Filter, number>;
  onSelect: (f: Filter) => void;
}

/** Category chips (design-ref Boutique): "Tout", "Promos", then each category; the selected one is red. */
const Chip: React.FC<{ label: string; icon?: IconName; count: number; on: boolean; onPress: () => void }> = ({ label, icon, count, on, onPress }) => (
  <Pressable
    onPress={() => {
      haptics.select();
      onPress();
    }}
    accessibilityRole="button"
    accessibilityState={{ selected: on }}
    accessibilityLabel={`${label}, ${count} produit${count > 1 ? 's' : ''}`}
    style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.85 }]}
  >
    {icon ? <Icon name={icon} size={16} color={on ? colors.white : colors.textSecondary} /> : null}
    <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{label}</Text>
  </Pressable>
);

export const CategoryRail: React.FC<Props> = ({ active, counts, onSelect }) => {
  const cats = Object.keys(CATEGORY_META) as ProductCategory[];
  return (
    <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="Tout" count={counts.all} on={active === 'all'} onPress={() => onSelect('all')} />
      {counts.promo > 0 && <Chip label="Promos" icon="pricetag-outline" count={counts.promo} on={active === 'promo'} onPress={() => onSelect('promo')} />}
      {cats.map(c => (
        <Chip key={c} label={CATEGORY_META[c].short} icon={CATEGORY_META[c].icon as IconName} count={counts[c] ?? 0} on={active === c} onPress={() => onSelect(c)} />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  labelOn: { color: colors.white },
});
