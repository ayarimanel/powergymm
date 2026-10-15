import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../components/ui/Text';
import { MuscleGroup } from '../../types/database';
import { BottomSheet, SheetScrollView } from '../../components/home/BottomSheet';
import {
  EXERCISES, Exercise, ExerciseKind, MUSCLES, MuscleInfo, Recovery, Workout, agoLabel, dayLabel, fmtNum, lastPerformance, muscleById, muscleRecovery, normName,
  periodStats, personalRecord, summarizeSets,
} from '../journalLogic';
import { Btn, J, Link, Pill, k, tabular } from './kit';
import { colors, fonts, radius } from '../../theme';
import { Icon, IconName } from '../../components/ui/Icon';
import { Title } from '../../components/ui/Title';

/** Same icons as the muscle cards on Entraînement. */
const MUSCLE_ICON: Record<MuscleGroup, IconName> = {
  chest: 'barbell-outline',
  back: 'body-outline',
  legs: 'walk-outline',
  shoulders: 'shield-outline',
  arms: 'fitness-outline',
  cardio: 'flame-outline',
};
const STATUS: Record<Recovery['status'], { label: (r: Recovery) => string; fg: string; bg: string }> = {
  ready: { label: () => 'Prêt', fg: J.okText, bg: J.okSoft },
  recovering: { label: r => `Prêt dans ${r.readyInH} h`, fg: J.recText, bg: J.recSoft },
  tired: { label: r => `Fatigué · ${r.readyInH} h`, fg: J.tiredText, bg: J.tiredSoft },
  never: { label: () => 'À découvrir', fg: J.muted, bg: J.surface2 },
};
/** "Autres exercices" shows this many before "Voir les N autres" (a search shows them all). */
const OTHERS_SHOWN = 6;

export type SheetState = { picker: true } | { muscleId: MuscleGroup; fromPicker?: boolean };

interface Props {
  sheet: SheetState | null;
  history: Workout[];
  workout: Workout | null;
  onPickMuscle: (id: MuscleGroup) => void;
  onPick: (exerciseId: string) => void;
  onCreate: (data: { name: string; kind: ExerciseKind; muscle: MuscleGroup }) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
}

export const MuscleSheet: React.FC<Props> = ({ sheet, history, workout, onPickMuscle, onPick, onCreate, onClose, onBack }) => {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [allOthers, setAllOthers] = useState(false);
  const muscleId = sheet && 'muscleId' in sheet ? sheet.muscleId : null;
  useEffect(() => {
    setQ('');
    setCreating(false);
    setAllOthers(false);
  }, [muscleId, !!sheet]);

  let content: React.ReactNode = null;
  if (sheet && 'picker' in sheet) {
    content = (
      <>
        <Title variant="section">Ajouter un exercice</Title>
        <Text style={s.meta}>Choisis le muscle</Text>
        <View style={s.pickGrid}>
          {MUSCLES.map(m => {
            const r = muscleRecovery(history, m.id);
            return (
              <Pressable key={m.id} onPress={() => onPickMuscle(m.id)} accessibilityRole="button" style={({ pressed }) => [s.pick, pressed && { opacity: 0.85 }]}>
                <View style={s.exIc}>
                  <Icon name={MUSCLE_ICON[m.id]} size={22} color={J.accentText} />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Text style={s.pickName}>{m.name}</Text>
                  <Text style={[s.pickStatus, { color: STATUS[r.status].fg }]}>{STATUS[r.status].label(r)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  } else if (muscleId) {
    const m = muscleById(muscleId);
    const all = EXERCISES.filter(e => e.muscle === m.id);
    const list = all.filter(e => normName(e.name).includes(normName(q)));
    const rec = muscleRecovery(history, m.id);
    const st = STATUS[rec.status];
    // Header numbers, all from the existing journal logic.
    const best = all.reduce<number | null>((b, e) => {
      if (e.kind === 'cardio') return b;
      const pr = personalRecord(history, e.id);
      return pr && (b == null || pr.kg > b) ? pr.kg : b;
    }, null);
    const weekSets = periodStats(history, 7, new Date()).perMuscle[m.id]?.sets ?? 0;

    /** Essentials and my own exercises: a card with the record and a round "+". */
    const card = (e: Exercise, i: number) => {
      const last = lastPerformance(history.filter(x => x.id !== workout?.id), e.id);
      const pr = e.kind !== 'cardio' ? personalRecord(history, e.id) : null;
      const inSession = workout?.exercises.some(x => x.exerciseId === e.id);
      return (
        <Pressable key={e.id} onPress={() => onPick(e.id)} accessibilityRole="button" accessibilityLabel={e.name} style={({ pressed }) => [s.exCard, pressed && { opacity: 0.85 }]}>
          <View style={s.exIc}>
            <Icon name={MUSCLE_ICON[m.id]} size={22} color={J.accentText} />
          </View>
          <View style={s.exMain}>
            <Text style={s.exName} numberOfLines={2}>
              {e.name}
              {e.custom && <Text style={s.own}> Perso </Text>}
            </Text>
            <Text style={s.exSub} numberOfLines={1}>{last ? `${dayLabel(last.date)} · ${summarizeSets(last.sets, e.kind)}` : 'Jamais fait'}</Text>
          </View>
          {inSession ? (
            <Pill tone="ok" label="En cours" />
          ) : (
            <>
              {pr && (
                <View style={s.exPr}>
                  <Text style={[s.exPrVal, tabular]}>{fmtNum(pr.kg)} kg</Text>
                  <Text style={s.exPrLbl}>record</Text>
                </View>
              )}
              <View style={[s.plus, i === 0 || last ? s.plusOn : s.plusOff]}>
                <Icon name="add" size={22} color={i === 0 || last ? colors.white : J.fg} />
              </View>
            </>
          )}
        </Pressable>
      );
    };

    /** Other exercises: a light row. */
    const row = (e: Exercise) => {
      const last = lastPerformance(history.filter(x => x.id !== workout?.id), e.id);
      const pr = e.kind !== 'cardio' ? personalRecord(history, e.id) : null;
      const inSession = workout?.exercises.some(x => x.exerciseId === e.id);
      return (
        <Pressable key={e.id} onPress={() => onPick(e.id)} accessibilityRole="button" accessibilityLabel={e.name} style={({ pressed }) => [s.li, pressed && { opacity: 0.7 }]}>
          <Text style={s.liName} numberOfLines={1}>{e.name}</Text>
          {inSession ? (
            <Pill tone="ok" label="En cours" />
          ) : (
            <>
              <Text style={[s.liMeta, tabular]} numberOfLines={1}>{pr ? `${fmtNum(pr.kg)} kg` : last ? dayLabel(last.date) : 'Jamais fait'}</Text>
              <View style={[s.plusSm, s.plusOff]}>
                <Icon name="add" size={18} color={J.fg} />
              </View>
            </>
          )}
        </Pressable>
      );
    };

    const essentials = list.filter(e => e.base);
    const mine = list.filter(e => e.custom);
    const others = list.filter(e => !e.base && !e.custom);
    const shownOthers = q.trim() || allOthers ? others : others.slice(0, OTHERS_SHOWN);

    content = (
      <>
        <View style={s.top}>
          {sheet && 'fromPicker' in sheet && sheet.fromPicker && (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour" style={s.back}>
              <Icon name="chevron-back" size={22} color={J.fg} />
            </Pressable>
          )}
          <View style={[s.status, { backgroundColor: st.bg }]}>
            <View style={[s.statusDot, { backgroundColor: st.fg }]} />
            <Text style={[s.statusText, { color: st.fg }]}>{st.label(rec)}</Text>
          </View>
        </View>
        <Title variant="display" size={44}>{m.name}</Title>
        <Text style={s.meta}>
          {all.length} exercices{rec.last ? ` · dernière fois ${agoLabel(rec.last).toLowerCase()}` : ''}
        </Text>

        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={[s.statNum, tabular]}>{best != null ? `${fmtNum(best)} kg` : '—'}</Text>
            <Text style={s.statLbl}>record</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, tabular]}>{weekSets}</Text>
            <Text style={s.statLbl}>séries / 7 j</Text>
          </View>
        </View>

        <View style={s.searchBox}>
          <Icon name="search" size={20} color={J.muted} />
          <TextInput style={s.search} placeholder="Chercher un exercice" placeholderTextColor={J.muted} value={q} onChangeText={setQ} returnKeyType="search" accessibilityLabel="Chercher un exercice" />
        </View>

        {creating ? (
          <CreateExercise muscle={m} initialName={q} onCancel={() => setCreating(false)} onOpen={onPick} onCreate={data => onCreate({ ...data, muscle: m.id })} />
        ) : (
          <>
            <Pressable onPress={() => setCreating(true)} accessibilityRole="button" style={({ pressed }) => [s.createOpen, pressed && { opacity: 0.85 }]}>
              <Icon name="add" size={20} color={J.accentText} />
              <Text style={s.createOpenText}>
                {q.trim() && !list.length ? <>Créer « <Text style={{ fontWeight: '900' }}>{q.trim()}</Text> »</> : 'Ajouter mon exercice'}
              </Text>
            </Pressable>

            {mine.length > 0 && (
              <>
                <View style={s.groupRow}>
                  <Text style={s.group}>Mes exercices</Text>
                  <Text style={s.groupN}>{mine.length}</Text>
                </View>
                <View style={s.cards}>{mine.map(card)}</View>
              </>
            )}
            {essentials.length > 0 && (
              <>
                <View style={s.groupRow}>
                  <Text style={s.group}>Les essentiels</Text>
                  <Text style={s.groupN}>{essentials.length}</Text>
                </View>
                <View style={s.cards}>{essentials.map(card)}</View>
              </>
            )}
            {others.length > 0 && (
              <>
                <View style={s.groupRow}>
                  <Text style={s.group}>Autres exercices</Text>
                  <Text style={s.groupN}>{others.length}</Text>
                </View>
                <View>{shownOthers.map(row)}</View>
                {shownOthers.length < others.length && (
                  <Pressable onPress={() => setAllOthers(true)} accessibilityRole="button" style={s.more}>
                    <Text style={s.moreText}>Voir les {others.length - shownOthers.length} autres</Text>
                  </Pressable>
                )}
              </>
            )}
            {!list.length && <Text style={k.empty}>Aucun exercice trouvé. Crée-le en un geste.</Text>}
          </>
        )}
      </>
    );
  }

  return (
    <BottomSheet visible={!!sheet} onClose={onClose} snaps={[0.86]}>
      {() => (
        <SheetScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {content}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

/* ---------- create own exercise ---------- */
const KINDS: { id: ExerciseKind; label: string; hint: string }[] = [
  { id: 'weight', label: 'Avec poids', hint: 'kg × reps' },
  { id: 'body', label: 'Poids du corps', hint: 'reps (+ kg)' },
  { id: 'cardio', label: 'Cardio', hint: 'min · km' },
];

const CreateExercise: React.FC<{
  muscle: MuscleInfo;
  initialName: string;
  onCreate: (data: { name: string; kind: ExerciseKind }) => Promise<void>;
  onCancel: () => void;
  onOpen: (id: string) => void;
}> = ({ muscle, initialName, onCreate, onCancel, onOpen }) => {
  const [name, setName] = useState(initialName.trim());
  const [kind, setKind] = useState<ExerciseKind>(muscle.id === 'cardio' ? 'cardio' : 'weight');
  const [busy, setBusy] = useState(false);
  const clean = name.trim();
  const dup = clean ? EXERCISES.find(e => e.muscle === muscle.id && normName(e.name) === normName(clean)) : undefined;
  const error = !clean ? '' : clean.length < 2 ? 'Au moins 2 lettres' : clean.length > 40 ? '40 caractères maximum' : '';
  const ok = !!clean && !error && !dup && !busy;
  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    await onCreate({ name: clean, kind });
    setBusy(false);
  };
  return (
    <View style={s.create}>
      <View style={s.createHead}>
        <Text style={s.createTitle}>Nouvel exercice · {muscle.name}</Text>
        <Link muted label="Annuler" onPress={onCancel} />
      </View>
      <Text style={s.lbl}>Nom de l'exercice</Text>
      <TextInput
        style={s.createInput}
        autoFocus
        maxLength={40}
        placeholder="Ex. Pull-over haltère"
        placeholderTextColor={J.muted}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        accessibilityLabel="Nom de l'exercice"
      />
      {!!error && <Text style={s.err}>{error}</Text>}
      {dup && (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={s.err}>« {dup.name} » existe déjà. </Text>
          <Link label="L'ouvrir" onPress={() => onOpen(dup.id)} />
        </View>
      )}
      <Text style={s.lbl}>Comment tu le notes ?</Text>
      <View style={s.kinds} accessibilityRole="radiogroup">
        {KINDS.map(kd => {
          const on = kind === kd.id;
          return (
            <Pressable key={kd.id} onPress={() => setKind(kd.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[s.kind, on && s.kindOn]}>
              <Text style={[s.kindLabel, on && { color: J.accentText }]}>{kd.label}</Text>
              <Text style={s.kindHint}>{kd.hint}</Text>
            </Pressable>
          );
        })}
      </View>
      <Btn full label={busy ? 'Création…' : 'Créer et commencer'} onPress={submit} disabled={!ok} />
      <Text style={[k.note, { marginTop: 2 }]}>Il reste dans tes exercices, avec ton historique et ton record, comme les autres.</Text>
    </View>
  );
};

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  meta: { fontSize: 14, fontWeight: '500', color: J.muted },

  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  pick: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface, borderRadius: 20, padding: 12 },
  pickName: { fontSize: 15, fontWeight: '800', color: J.fg },
  pickStatus: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },

  stats: { flexDirection: 'row', gap: 10, marginTop: 8 },
  stat: { flex: 1, gap: 2, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  statNum: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 26, lineHeight: 28, color: J.fg },
  statLbl: { fontSize: 13, fontWeight: '500', color: J.muted },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 18, marginTop: 8, borderRadius: radius.input, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface },
  search: { flex: 1, height: '100%', color: J.fg, fontSize: 15, fontWeight: '600' },
  createOpen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, marginTop: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: J.accent, backgroundColor: colors.brandTint, borderRadius: radius.input },
  createOpenText: { color: J.accentText, fontWeight: '800', fontSize: 15 },

  groupRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 4 },
  group: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: J.muted },
  groupN: { fontSize: 13, fontWeight: '700', color: J.muted },
  cards: { gap: 10 },

  exCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface, minHeight: 76 },
  exIc: { width: 48, height: 48, borderRadius: 14, backgroundColor: J.accentSoft, alignItems: 'center', justifyContent: 'center' },
  exMain: { flex: 1, minWidth: 0, gap: 3 },
  exName: { fontSize: 15, fontWeight: '800', color: J.fg },
  exSub: { fontSize: 13, color: J.muted },
  own: { fontSize: 10, fontWeight: '800', backgroundColor: J.accentSoft, color: J.accentText, borderRadius: 6, overflow: 'hidden' },
  exPr: { alignItems: 'flex-end' },
  exPrVal: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 20, lineHeight: 22, color: J.recText },
  exPrLbl: { fontSize: 11, fontWeight: '600', color: J.muted },
  plus: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  plusOn: { backgroundColor: J.accent },
  plusOff: { borderWidth: 1.5, borderColor: colors.disabled },
  plusSm: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  li: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: J.line },
  liName: { flex: 1, fontSize: 15, fontWeight: '700', color: J.fg },
  liMeta: { fontSize: 13, color: J.muted, maxWidth: 120 },
  more: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  moreText: { fontSize: 14, fontWeight: '700', color: colors.brand },

  create: { gap: 8, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line, borderRadius: 20, padding: 16, marginTop: 6 },
  createHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  createTitle: { fontSize: 15, fontWeight: '800', color: J.fg, flex: 1 },
  createInput: { height: 52, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface2, color: J.fg, borderRadius: radius.input, paddingHorizontal: 16, fontSize: 15, fontWeight: '600' },
  lbl: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: J.muted, marginTop: 6 },
  err: { fontSize: 12, color: J.tiredText, fontWeight: '700' },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { flex: 1, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  kindOn: { borderColor: J.accent, borderWidth: 1.5, backgroundColor: colors.brandTint },
  kindLabel: { fontSize: 12, fontWeight: '800', color: J.fg, textAlign: 'center' },
  kindHint: { fontSize: 11, color: J.muted },
});
