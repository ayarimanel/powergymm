import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { MuscleGroup } from '../../../types/database';
import { FloorSettings } from '../../../types/floor';
import { LEVEL_LABEL, gymThresholds, levelFromCount, zoneThresholds } from '../../../floor/crowd';
import { levelTint } from '../../../floor/levelColors';
import { MUSCLE_LABEL } from '../../../floor/useFloorSnapshot';
import { ZoneLive } from '../../../floor/useFloorAdminData';
import { colors } from '../../../theme';
import { Stepper } from '../Stepper';

interface Props {
  settings: FloorSettings;
  capacity: number;
  live: ZoneLive[];
  presentCount: number;
  onSave: (patch: Partial<FloorSettings>) => Promise<void>;
}

const MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'cardio'];

const LevelPill: React.FC<{ count: number; t: { calmMax: number; busyMin: number } }> = ({ count, t }) => {
  const level = levelFromCount(count, t);
  const tint = levelTint(level);
  return (
    <View style={[styles.pill, { backgroundColor: tint.soft }]}>
      <Text style={[styles.pillText, { color: tint.text }]}>
        {count} → {LEVEL_LABEL[level]}
      </Text>
    </View>
  );
};

/** Equipment per zone → calme/moyen/plein cutoffs, previewed against who is on the floor right now. */
export const ZoneSettings: React.FC<Props> = ({ settings, capacity, live, presentCount, onSave }) => {
  const [zones, setZones] = useState(settings.zoneCapacity);
  const [calmPct, setCalmPct] = useState(settings.gymCalmPct);
  const [busyPct, setBusyPct] = useState(settings.gymBusyPct);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setZones(settings.zoneCapacity);
    setCalmPct(settings.gymCalmPct);
    setBusyPct(settings.gymBusyPct);
  }, [settings]);

  const gymT = gymThresholds(capacity, calmPct, busyPct);

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Toute la salle · capacité {capacity}</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Calme jusqu’à</Text>
          <Stepper label="Seuil calme" value={calmPct} min={5} max={busyPct - 5} suffix=" %" onChange={setCalmPct} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Plein dès</Text>
          <Stepper label="Seuil plein" value={busyPct} min={calmPct + 5} max={100} suffix=" %" onChange={setBusyPct} />
        </View>
        <Text style={styles.hint}>
          Calme ≤ {gymT.calmMax} · Moyen {gymT.calmMax + 1}–{gymT.busyMin - 1} · Plein ≥ {gymT.busyMin} personnes
        </Text>
        <LevelPill count={presentCount} t={gymT} />
      </View>

      {MUSCLES.map(m => {
        const cap = zones[m] ?? 2;
        const t = zoneThresholds(cap);
        const now = live.find(z => z.muscle === m)?.count ?? 0;
        return (
          <View key={m} style={styles.block}>
            <View style={styles.row}>
              <Text style={styles.blockTitle}>{MUSCLE_LABEL[m]}</Text>
              <Stepper label={`Postes ${MUSCLE_LABEL[m]}`} value={cap} min={1} max={30} suffix="" onChange={v => setZones(z => ({ ...z, [m]: v }))} />
            </View>
            <Text style={styles.hint}>
              {cap} poste{cap > 1 ? 's' : ''} · Calme ≤ {t.calmMax} · Moyen {t.calmMax + 1}–{t.busyMin - 1} · Plein ≥ {t.busyMin}
            </Text>
            <LevelPill count={now} t={t} />
          </View>
        );
      })}

      <Pressable
        onPress={async () => {
          await onSave({ zoneCapacity: zones, gymCalmPct: calmPct, gymBusyPct: busyPct });
          setSaved(true);
          setTimeout(() => setSaved(false), 1800);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={18} color={colors.white} />
        <Text style={styles.saveText}>{saved ? 'Enregistré' : 'Enregistrer les zones'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  blockTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 12, fontWeight: '800' },
  saveBtn: { height: 46, borderRadius: 23, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
