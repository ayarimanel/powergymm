import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { FloorSettings, SpecialDay, WeeklyHours } from '../../../types/floor';
import { colors } from '../../../theme';
import { localDateStr } from '../../../floor/crowd';
import { Stepper } from '../Stepper';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

interface Props {
  settings: FloorSettings;
  onSave: (patch: Partial<FloorSettings>) => Promise<void>;
}

const todayIso = () => localDateStr(new Date());

/** Weekly hours + special days (e.g. Aïd: ferme à 16h). Saving updates the member page right away. */
export const HoursEditor: React.FC<Props> = ({ settings, onSave }) => {
  const [weekly, setWeekly] = useState<WeeklyHours>(settings.weekly);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>(settings.specialDays);
  const [draft, setDraft] = useState<SpecialDay>({ date: todayIso(), open: 6, close: 16, label: 'Aïd', emoji: '🌙' });
  const [saved, setSaved] = useState(false);
  const [dateError, setDateError] = useState(false);

  useEffect(() => {
    setWeekly(settings.weekly);
    setSpecialDays(settings.specialDays);
  }, [settings]);

  const setDay = (d: number, v: { open: number; close: number } | null) => setWeekly(w => ({ ...w, [d]: v }));

  const save = async (nextSpecial = specialDays) => {
    await onSave({ weekly, specialDays: nextSpecial });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const addSpecial = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(new Date(draft.date).getTime())) {
      setDateError(true);
      return;
    }
    setDateError(false);
    const next = [...specialDays.filter(s => s.date !== draft.date), draft].sort((a, b) => a.date.localeCompare(b.date));
    setSpecialDays(next);
    save(next);
  };

  const upcoming = specialDays.filter(s => s.date >= todayIso());

  return (
    <View style={{ gap: 8 }}>
      {DAYS.map((label, d) => {
        const day = weekly[d];
        return (
          <View key={label} style={styles.dayRow}>
            <Text style={styles.dayLabel}>{label}</Text>
            <Switch
              value={!!day}
              onValueChange={on => setDay(d, on ? { open: 6, close: 22 } : null)}
              accessibilityLabel={`${label} ouvert`}
            />
            {day ? (
              <View style={styles.hours}>
                <Stepper label={`${label} ouverture`} value={day.open} min={0} max={day.close - 1} onChange={v => setDay(d, { ...day, open: v })} />
                <Text style={styles.dash}>–</Text>
                <Stepper label={`${label} fermeture`} value={day.close} min={day.open + 1} max={24} onChange={v => setDay(d, { ...day, close: v })} />
              </View>
            ) : (
              <Text style={styles.closed}>Fermé</Text>
            )}
          </View>
        );
      })}

      <Pressable onPress={() => save()} accessibilityRole="button" style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}>
        <Icon name={saved ? 'checkmark' : 'save-outline'} size={18} color={colors.white} />
        <Text style={styles.saveText}>{saved ? 'Enregistré' : 'Enregistrer les horaires'}</Text>
      </Pressable>

      <Text style={styles.subhead}>Jours spéciaux</Text>
      {upcoming.length === 0 && <Text style={styles.empty}>Aucun jour spécial à venir.</Text>}
      {upcoming.map(s => (
        <View key={s.date} style={styles.specialRow}>
          <Text style={styles.specialEmoji}>{s.emoji ?? '📅'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.specialTitle}>{s.label}</Text>
            <Text style={styles.specialSub}>
              {s.date} · {s.open}h – {s.close}h
            </Text>
          </View>
          <Pressable
            onPress={() => {
              const next = specialDays.filter(x => x.date !== s.date);
              setSpecialDays(next);
              save(next);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Supprimer ${s.label} du ${s.date}`}
            hitSlop={8}
          >
            <Icon name="trash-outline" size={20} color={colors.red.text} />
          </Pressable>
        </View>
      ))}

      <View style={styles.form}>
        <View style={styles.formRow}>
          <TextInput
            value={draft.emoji}
            onChangeText={t => setDraft({ ...draft, emoji: t.slice(0, 2) })}
            style={[styles.input, { width: 52, textAlign: 'center' }]}
            accessibilityLabel="Emoji"
          />
          <TextInput
            value={draft.label}
            onChangeText={t => setDraft({ ...draft, label: t })}
            placeholder="Nom (ex. Aïd)"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { flex: 1 }]}
            accessibilityLabel="Nom du jour spécial"
          />
        </View>
        <TextInput
          value={draft.date}
          onChangeText={t => setDraft({ ...draft, date: t.trim() })}
          placeholder="AAAA-MM-JJ"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, dateError && { borderColor: colors.red.bar }]}
          accessibilityLabel="Date au format AAAA-MM-JJ"
        />
        {dateError && <Text style={styles.error}>Date invalide. Format : 2026-03-20</Text>}
        <View style={styles.formRow}>
          <Stepper label="Ouverture spéciale" value={draft.open} min={0} max={draft.close - 1} onChange={v => setDraft({ ...draft, open: v })} />
          <Text style={styles.dash}>–</Text>
          <Stepper label="Fermeture spéciale" value={draft.close} min={draft.open + 1} max={24} onChange={v => setDraft({ ...draft, close: v })} />
        </View>
        <Pressable onPress={addSpecial} accessibilityRole="button" style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}>
          <Icon name="add" size={18} color={colors.text} />
          <Text style={styles.addText}>Ajouter le jour spécial</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, flexWrap: 'wrap' },
  dayLabel: { width: 84, fontSize: 14, fontWeight: '700', color: colors.text },
  hours: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  closed: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  dash: { fontSize: 14, color: colors.textMuted },

  saveBtn: { height: 46, borderRadius: 23, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  saveText: { color: colors.white, fontSize: 15, fontWeight: '800' },

  subhead: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 14 },
  empty: { fontSize: 13, color: colors.textMuted },
  specialRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  specialEmoji: { fontSize: 22 },
  specialTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  specialSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },

  form: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 15, color: colors.text, backgroundColor: colors.bg },
  error: { fontSize: 12, color: colors.red.text, fontWeight: '700' },
  addBtn: { height: 42, borderRadius: 21, backgroundColor: colors.track, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: { fontSize: 14, fontWeight: '800', color: colors.text },
});
