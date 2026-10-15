import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../components/ui/Text';
import { MuscleGroup } from '../../types/database';
import { BottomSheet, SheetScrollView } from '../../components/home/BottomSheet';
import {
  EXERCISES, Exercise, ExerciseKind, MUSCLES, MuscleInfo, Workout, dayLabel, fmtNum, lastPerformance, muscleById, muscleRecovery, normName,
  personalRecord, summarizeSets,
} from '../journalLogic';
import { Btn, J, Link, MuscleIcon, Pill, StatusPill, k } from './kit';
import { colors } from '../../theme';

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
  const muscleId = sheet && 'muscleId' in sheet ? sheet.muscleId : null;
  useEffect(() => {
    setQ('');
    setCreating(false);
  }, [muscleId, !!sheet]);

  let content: React.ReactNode = null;
  if (sheet && 'picker' in sheet) {
    content = (
      <>
        <Text style={s.title} accessibilityRole="header">Ajouter un exercice</Text>
        <Text style={k.sub}>Choisis le muscle</Text>
        <View style={s.pickGrid}>
          {MUSCLES.map(m => (
            <Pressable key={m.id} onPress={() => onPickMuscle(m.id)} accessibilityRole="button" style={({ pressed }) => [s.pick, pressed && { opacity: 0.85 }]}>
              <MuscleIcon id={m.id} color={m.color} small />
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <Text style={s.pickName}>{m.name}</Text>
                <View style={{ alignSelf: 'flex-start' }}>
                  <StatusPill r={muscleRecovery(history, m.id)} />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </>
    );
  } else if (muscleId) {
    const m = muscleById(muscleId);
    const all = EXERCISES.filter(e => e.muscle === m.id);
    const list = all.filter(e => normName(e.name).includes(normName(q)));
    const row = (e: Exercise) => {
      const last = lastPerformance(history.filter(x => x.id !== workout?.id), e.id);
      const pr = e.kind !== 'cardio' ? personalRecord(history, e.id) : null;
      const inSession = workout?.exercises.some(x => x.exerciseId === e.id);
      return (
        <Pressable key={e.id} onPress={() => onPick(e.id)} accessibilityRole="button" style={({ pressed }) => [s.ex, pressed && { opacity: 0.85 }]}>
          <View style={s.exMain}>
            <Text style={s.exName} numberOfLines={1}>
              {e.base && <Text style={s.star} accessibilityLabel="Exercice de base">★ </Text>}
              {e.name}
              {e.custom && <Text style={s.own}> Perso </Text>}
            </Text>
            <Text style={s.exSub} numberOfLines={1}>{last ? `${dayLabel(last.date)} : ${summarizeSets(last.sets, e.kind)}` : 'Jamais fait'}</Text>
          </View>
          {inSession ? (
            <Pill tone="ok" label="En cours" />
          ) : pr ? (
            <View style={s.exPr}>
              <Text style={s.exPrLbl}>Record</Text>
              <Text style={s.exPrVal}>{fmtNum(pr.kg)} kg</Text>
            </View>
          ) : (
            <View style={s.plus}><Text style={s.plusText}>+</Text></View>
          )}
        </Pressable>
      );
    };
    content = (
      <>
        <View style={s.top}>
          {sheet && 'fromPicker' in sheet && sheet.fromPicker && (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour" style={s.back}>
              <Text style={s.backText}>‹</Text>
            </Pressable>
          )}
          <MuscleIcon id={m.id} color={m.color} small />
          <View>
            <Text style={s.title} accessibilityRole="header">{m.name}</Text>
            <Text style={k.sub}>{all.length} exercices</Text>
          </View>
        </View>
        <TextInput style={s.search} placeholder="Chercher un exercice" placeholderTextColor={J.muted} value={q} onChangeText={setQ} returnKeyType="search" />
        {creating ? (
          <CreateExercise muscle={m} initialName={q} onCancel={() => setCreating(false)} onOpen={onPick} onCreate={data => onCreate({ ...data, muscle: m.id })} />
        ) : (
          <>
            <Pressable onPress={() => setCreating(true)} accessibilityRole="button" style={s.createOpen}>
              <View style={[s.plus, { backgroundColor: J.accent }]}><Text style={[s.plusText, { color: colors.white }]}>+</Text></View>
              <Text style={s.createOpenText}>
                {q.trim() && !list.length ? <>Créer « <Text style={{ fontWeight: '900' }}>{q.trim()}</Text> »</> : 'Ajouter mon exercice'}
              </Text>
            </Pressable>
            {list.some(e => e.custom) && (
              <>
                <Text style={s.group}>Mes exercices</Text>
                <View style={s.exList}>{list.filter(e => e.custom).map(row)}</View>
              </>
            )}
            {list.some(e => e.base) && <View style={s.exList}>{list.filter(e => e.base).map(row)}</View>}
            {list.some(e => !e.base && !e.custom) && (
              <>
                <Text style={s.group}>Autres exercices</Text>
                <View style={s.exList}>{list.filter(e => !e.base && !e.custom).map(row)}</View>
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
        style={[s.search, { backgroundColor: J.surface, marginBottom: 0 }]}
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
              <Text style={[s.kindLabel, on && { color: J.accent }]}>{kd.label}</Text>
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
  body: { paddingHorizontal: 16, paddingBottom: 32, gap: 6 },
  title: { fontSize: 18, fontWeight: '800', color: J.fg },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pick: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface, borderRadius: 16, padding: 10 },
  pickName: { fontSize: 13, fontWeight: '800', color: J.fg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: J.fg, marginTop: -2 },
  search: { borderWidth: 1, borderColor: J.line, backgroundColor: J.surface2, color: J.fg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 6 },
  createOpen: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: J.accent, backgroundColor: J.accentSoft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6 },
  createOpenText: { flex: 1, color: J.accent, fontWeight: '800', fontSize: 14 },
  group: { fontSize: 12, fontWeight: '800', color: J.muted, marginTop: 10, marginBottom: 2 },
  exList: { gap: 6 },
  ex: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minHeight: 56 },
  exMain: { flex: 1, minWidth: 0 },
  exName: { fontSize: 14, fontWeight: '800', color: J.fg },
  exSub: { fontSize: 12, color: J.muted },
  star: { color: J.goldBright },
  own: { fontSize: 10, fontWeight: '800', backgroundColor: J.accentSoft, color: J.accent, borderRadius: 6, overflow: 'hidden' },
  exPr: { alignItems: 'flex-end' },
  exPrLbl: { fontSize: 10, fontWeight: '800', color: J.gold },
  exPrVal: { fontSize: 17, fontWeight: '900', color: J.gold },
  plus: { width: 28, height: 28, borderRadius: 14, backgroundColor: J.accentSoft, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: J.accent, fontWeight: '900', fontSize: 16, marginTop: -1 },
  create: { gap: 8, backgroundColor: J.surface2, borderRadius: 18, padding: 14 },
  createHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  createTitle: { fontSize: 14, fontWeight: '800', color: J.fg, flex: 1 },
  lbl: { fontSize: 12, fontWeight: '800', color: J.muted, marginTop: 4 },
  err: { fontSize: 12, color: J.tiredText, fontWeight: '700' },
  kinds: { flexDirection: 'row', gap: 6 },
  kind: { flex: 1, borderWidth: 1.5, borderColor: J.line, backgroundColor: J.surface, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  kindOn: { borderColor: J.accent, backgroundColor: J.accentSoft },
  kindLabel: { fontSize: 12, fontWeight: '800', color: J.fg, textAlign: 'center' },
  kindHint: { fontSize: 11, color: J.muted },
});
