import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { MuscleOccupancy } from '../../types/database';
import { colors } from '../../theme';
import { MUSCLE_ICON, ZONE_LEVEL_LABEL, zoneLevel } from '../../services/floorViewModel';
import { BottomSheet, SheetScrollView } from './BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  zones: MuscleOccupancy[];
}

const LEGEND = [
  { level: 'green' as const, label: '0–15 %' },
  { level: 'amber' as const, label: '16–30 %' },
  { level: 'red' as const, label: '31 %+' },
];

export const MuscleLiveSheet: React.FC<Props> = ({ visible, onClose, zones }) => {
  const sorted = [...zones].sort((a, b) => a.percentage - b.percentage);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.55, 0.92]}
      initialSnap={0}
      header={
        <View>
          <Text style={styles.title} accessibilityRole="header">
            Zones en direct
          </Text>
          <View style={styles.legend}>
            {LEGEND.map(l => (
              <View key={l.level} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors[l.level].bar }]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>
      }
    >
      {(_expanded, extraBottom) => (
        <SheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: 32 + extraBottom }]}
        >
          {sorted.map((z, i) => {
            const level = zoneLevel(z.percentage);
            const c = colors[level];
            return (
              <View
                key={z.muscleGroup}
                style={styles.row}
                accessible
                accessibilityLabel={`${z.label}, ${z.percentage} pour cent, ${ZONE_LEVEL_LABEL[level]}`}
              >
                <View style={[styles.iconWrap, { backgroundColor: c.soft }]}>
                  <Icon name={MUSCLE_ICON[z.muscleGroup] as any} size={20} color={c.text} />
                </View>

                <View style={styles.mid}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{z.label}</Text>
                    {i === 0 && (
                      <View style={styles.freeBadge}>
                        <Text style={styles.freeBadgeText}>Le plus libre</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.max(3, Math.min(100, z.percentage))}%`, backgroundColor: c.bar },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.right}>
                  <Text style={[styles.pct, { color: c.text }]}>{z.percentage}%</Text>
                  <Text style={styles.sub}>
                    {ZONE_LEVEL_LABEL[level]} · {z.activeCount}
                  </Text>
                </View>
              </View>
            );
          })}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  legend: { flexDirection: 'row', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  list: { paddingHorizontal: 20, paddingBottom: 32 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.track,
    paddingVertical: 8,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  freeBadge: {
    backgroundColor: colors.green.soft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  freeBadgeText: { fontSize: 11, fontWeight: '700', color: colors.green.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  right: { alignItems: 'flex-end', minWidth: 70 },
  pct: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
