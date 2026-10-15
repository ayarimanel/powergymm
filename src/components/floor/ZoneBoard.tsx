import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { MuscleGroup } from '../../types/database';
import { MuscleLevel } from '../../floor/useFloorSnapshot';
import { levelTint } from '../../floor/levelColors';
import { LEVEL_LABEL } from '../../floor/crowd';
import { colors, radius } from '../../theme';
import { haptics } from '../../utils/haptics';
import { claimSwipe } from '../../navigation/swipeGuard';

interface Props {
  muscles: MuscleLevel[];
  myMuscle: MuscleGroup | null;
  /** e.g. "20h – 21h · calme" — used in the "come back later" hint when the zone is busy. */
  bestLabel: string | null;
  /** From the Journal: the rested muscle trained the longest ago. */
  suggested?: MuscleGroup | null;
  /** Owner setting: false = levels only, never a number of people. */
  showCounts?: boolean;
  /** Placed inside the card, above and below the content (the flip card's switch and button). */
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const ORDER: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'];

export const ZoneBoard: React.FC<Props> = ({ muscles, myMuscle, bestLabel, suggested, showCounts = true, header, footer }) => {
  const byOrder = useMemo(() => ORDER.map(id => muscles.find(m => m.muscle === id)).filter(Boolean) as MuscleLevel[], [muscles]);
  const [selected, setSelected] = useState<MuscleGroup>(myMuscle ?? suggested ?? 'legs');
  const touched = useRef(false);
  // The suggestion loads after the first render: follow it until the member picks a chip.
  useEffect(() => {
    if (!touched.current && !myMuscle && suggested) setSelected(suggested);
  }, [suggested, myMuscle]);

  const maxCount = Math.max(1, ...muscles.map(m => m.count));
  const rows = useMemo(() => [...muscles].sort((a, b) => b.count - a.count), [muscles]);
  const sel = muscles.find(m => m.muscle === selected) ?? byOrder[0];

  const verdict = useMemo(() => {
    if (!sel) return null;
    const t = levelTint(sel.level);
    const n = sel.count;
    const later = bestLabel ? ` ou viens vers ${bestLabel.split(' – ')[0]}` : '';
    if (sel.level === 'calme') {
      return { color: t.text, bg: t.soft, text: `${sel.label} : c'est libre.`, sub: showCounts ? `${n === 0 ? 'Personne' : 'Seulement ' + n} sur cette zone, fonce.` : 'Fonce, les postes sont disponibles.' };
    }
    if (sel.level === 'moyen') {
      return { color: t.text, bg: t.soft, text: `${sel.label} : un peu de monde.`, sub: showCounts ? `${n} membres, attente courte possible.` : 'Attente courte possible.' };
    }
    return { color: t.text, bg: t.soft, text: `${sel.label} : zone chargée.`, sub: `${showCounts ? `${n} membres. ` : ''}Commence ailleurs${later}.` };
  }, [sel, bestLabel, showCounts]);

  return (
    <View style={styles.card}>
      {header}
      <Text style={styles.label}>Tu travailles quoi aujourd’hui ? Touche ton muscle :</Text>
      <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {byOrder.map(m => {
          const on = selected === m.muscle;
          return (
            <Pressable
              key={m.muscle}
              onPress={() => { haptics.select(); touched.current = true; setSelected(m.muscle); }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {verdict && (
        <View style={[styles.verdict, { backgroundColor: verdict.bg }]}>
          <Text style={styles.verdictText}>
            <Text style={[styles.verdictBold, { color: verdict.color }]}>{verdict.text}</Text> {verdict.sub}
          </Text>
        </View>
      )}

      <View style={styles.rows}>
        {rows.map(m => {
          const t = levelTint(m.level);
          const me = m.muscle === selected;
          return (
            <View key={m.muscle} style={[styles.row, me && styles.rowMe]}>
              <Text style={[styles.rowName, me && { color: colors.brandText }]} numberOfLines={1}>{m.label}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(4, (m.count / maxCount) * 100)}%`, backgroundColor: t.bar }]} />
              </View>
              <Text style={styles.count}>
                {m.count === 0 ? (
                  <Text style={styles.free}>Libre</Text>
                ) : showCounts ? (
                  <><Text style={styles.countN}>{m.count}</Text> memb.</>
                ) : (
                  <Text style={[styles.countN, { color: t.text }]}>{LEVEL_LABEL[m.level].charAt(0) + LEVEL_LABEL[m.level].slice(1).toLowerCase()}</Text>
                )}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.rowsNote}>{showCounts ? 'Nombre de membres sur chaque zone en ce moment.' : 'Niveau de chaque zone en ce moment.'}</Text>
      {footer}
    </View>
  );
};

const styles = StyleSheet.create({
  // Stacked sections on the Affluence sheet, like the "Toute la salle" side.
  card: { gap: 16 },
  label: { fontSize: 14, color: colors.text, fontWeight: '700' },
  rowsNote: { fontSize: 12, color: colors.textMuted },

  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  chipOn: { borderColor: colors.text, backgroundColor: colors.text },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: colors.onInverse },

  verdict: { borderRadius: 16, padding: 14 },
  verdictText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  verdictBold: { fontWeight: '800' },

  rows: { gap: 12, padding: 18, borderRadius: radius.cardLg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowMe: { backgroundColor: colors.brandSoft, marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12 },
  rowName: { width: 80, fontSize: 14, fontWeight: '700', color: colors.text },
  track: { flex: 1, height: 10, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99 },
  count: { width: 64, textAlign: 'right', fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  countN: { color: colors.text, fontSize: 14, fontWeight: '800' },
  free: { color: colors.green.text, fontWeight: '800' },
});
