import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../components/ui/Text';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  Exercise, ProgressPoint, Workout, WorkoutExercise, WorkoutSet, dayLabel, doneSets, exById, exVolume, exerciseProgress, fmtKg, fmtNum,
  lastPerformance, muscleById, nextSet, num, personalRecord, progressionHint, summarizeSets,
} from '../journalLogic';
import { Btn, Card, J, Link, MuscleIcon, SecHead, Seg, k, tabular } from './kit';
import { colors } from '../../theme';
import { Icon } from '../../components/ui/Icon';

interface Props {
  workout: Workout;
  ex: WorkoutExercise;
  history: Workout[];
  onBack: () => void;
  onToggle: (i: number) => void;
  updateSets: (fn: (sets: WorkoutSet[]) => WorkoutSet[]) => void;
  onRemove: () => void;
}

export const Logger: React.FC<Props> = ({ workout, ex, history, onBack, onToggle, updateSets, onRemove }) => {
  const meta = exById(ex.exerciseId)!;
  const m = muscleById(meta.muscle);
  const others = history.filter(x => x.id !== workout.id);
  const last = lastPerformance(others, ex.exerciseId, new Date(workout.date));
  const pr = meta.kind !== 'cardio' ? personalRecord(others, ex.exerciseId) : null;
  const vol = exVolume(ex);
  const nDone = doneSets(ex).length;
  const cardio = meta.kind === 'cardio';

  const set = (i: number, patch: Partial<WorkoutSet>) => updateSets(sets => sets.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const bump = (i: number, field: 'kg' | 'reps' | 'min' | 'km', d: number) =>
    updateSets(sets => sets.map((x, j) => (j === i ? { ...x, [field]: Math.max(0, Math.round((num(x[field]) + d) * 100) / 100) } : x)));
  const add = () => updateSets(sets => [...sets, nextSet(sets, last, meta.kind)]);
  const removeLast = () => updateSets(sets => (sets.length > 1 ? sets.slice(0, -1) : sets));
  const hint = progressionHint(last, meta);
  const [hintUsed, setHintUsed] = useState(false);
  const applyHint = () => {
    if (!hint) return;
    updateSets(sets => sets.map(x => (x.done ? x : { ...x, ...hint.apply })));
    setHintUsed(true);
  };
  const copyPrev = (i: number) => {
    const p = last?.sets[i];
    if (p) set(i, cardio ? { min: p.min, km: p.km } : { kg: p.kg, reps: p.reps });
  };

  return (
    <View style={s.stack}>
      <Link label="‹ Séance en cours" onPress={onBack} />
      <Card style={s.head}>
        <MuscleIcon id={m.id} color={m.color} small />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} accessibilityRole="header">{meta.name}</Text>
          <Text style={k.sub}>{m.name}{!workout.live ? ` · ${dayLabel(workout.date)}` : ''}</Text>
        </View>
      </Card>

      <View style={s.refs}>
        <View style={s.ref}>
          <Text style={s.refLbl}>Dernière fois</Text>
          <Text style={[s.refVal, tabular]}>{last ? summarizeSets(last.sets, meta.kind) : 'Première fois'}</Text>
          {last && <Text style={s.refDate}>{dayLabel(last.date)}</Text>}
        </View>
        {!cardio && (
          <View style={[s.ref, s.refGold]}>
            <Text style={[s.refLbl, { color: J.gold }]}>Mon record</Text>
            <Text style={[s.refVal, { color: J.gold }, tabular]}>{pr ? `${fmtNum(pr.kg)} kg × ${pr.reps}` : 'À établir'}</Text>
            {pr && <Text style={s.refDate}>{dayLabel(pr.date)}</Text>}
          </View>
        )}
      </View>

      {hint && !hintUsed && nDone === 0 && (
        <View style={[s.hint, hint.type === 'keep' && { backgroundColor: J.accentSoft }]}>
          <View style={[s.hintIc, hint.type === 'keep' && { backgroundColor: J.accent }]}>
            <Icon name={hint.type === 'up' ? 'arrow-up' : hint.type === 'keep' ? 'reorder-two' : 'add'} size={16} color={colors.white} />
          </View>
          <Text style={s.hintText}>{hint.text}</Text>
          <Btn small variant="dark" label="Appliquer" onPress={applyHint} />
        </View>
      )}

      <Card style={s.sets}>
        <View style={[s.row, s.rowHead]}>
          <Text style={[s.hCell, s.cN]}>#</Text>
          <Text style={[s.hCell, s.cPrev]}>Avant</Text>
          <Text style={[s.hCell, s.cNum]}>{cardio ? 'Min' : meta.kind === 'body' ? '+kg' : 'kg'}</Text>
          <Text style={[s.hCell, s.cNum]}>{cardio ? 'Km' : 'Reps'}</Text>
          <View style={s.cCheck} />
        </View>
        {ex.sets.map((x, i) => {
          const p = last?.sets[i];
          return (
            <View key={i} style={[s.row, x.done && s.rowDone, x.pr && s.rowPr]}>
              <View style={s.cN}>
                {x.pr ? <Text style={s.prTag}>PR</Text> : <Text style={[s.n, tabular]}>{i + 1}</Text>}
              </View>
              <Pressable onPress={() => copyPrev(i)} disabled={!p} accessibilityRole="button" accessibilityLabel="Copier la valeur précédente" style={s.cPrev}>
                <Text style={[s.prev, tabular]} numberOfLines={1}>
                  {p ? (cardio ? `${fmtNum(num(p.min))}′${num(p.km) ? ` ${fmtNum(num(p.km))}km` : ''}` : `${fmtNum(num(p.kg))}×${num(p.reps)}`) : '–'}
                </Text>
              </Pressable>
              {cardio ? (
                <>
                  <Num label="Minutes" value={x.min} done={x.done} onChange={v => set(i, { min: v })} onStep={d => bump(i, 'min', d * 5)} />
                  <Num label="Kilomètres" value={x.km} done={x.done} onChange={v => set(i, { km: v })} onStep={d => bump(i, 'km', d * 0.5)} />
                </>
              ) : (
                <>
                  <Num label="Kilos" value={x.kg} done={x.done} onChange={v => set(i, { kg: v })} onStep={d => bump(i, 'kg', d * (meta.step ?? 2.5))} />
                  <Num label="Répétitions" value={x.reps} done={x.done} onChange={v => set(i, { reps: v })} onStep={d => bump(i, 'reps', d)} />
                </>
              )}
              <Pressable
                onPress={() => onToggle(i)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: x.done }}
                accessibilityLabel={x.done ? 'Série validée' : 'Valider la série'}
                style={[s.check, x.done && s.checkOn, x.done && x.pr && s.checkPr]}
              >
                <Icon name="checkmark" size={16} color={x.done ? colors.white : 'transparent'} />
              </Pressable>
            </View>
          );
        })}
        <View style={s.setsActions}>
          <Btn small variant="soft" label="+ Ajouter une série" onPress={add} />
          {ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done && <Link muted label="Retirer la dernière" onPress={removeLast} />}
        </View>
      </Card>

      <Card style={s.total}>
        {cardio ? (
          <View>
            <Text style={s.totalLbl}>Total</Text>
            <Text style={[s.totalVal, tabular]}>{summarizeSets(ex.sets, 'cardio') || '0 min'}</Text>
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={s.totalLbl}>Séries validées</Text>
              <Text style={[s.totalVal, tabular]}>{nDone}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.totalLbl}>Volume (calculé)</Text>
              <Text style={[s.totalVal, tabular]}>{fmtKg(vol)}</Text>
            </View>
          </>
        )}
        <Text style={[k.note, { width: '100%', marginTop: 0 }]}>
          {cardio ? 'Note tes minutes, et les km si tu les connais.' : "Le volume = kg × reps de chaque série validée. Tu n'as rien à calculer."}
        </Text>
      </Card>

      <ProgressCard history={history} exerciseId={ex.exerciseId} meta={meta} />

      <View style={s.rowBtns}>
        <Btn variant="ghost" label="Retirer l'exercice" onPress={onRemove} style={{ flex: 1 }} />
        <Btn label="Exercice terminé" onPress={onBack} style={{ flex: 1.4 }} />
      </View>
    </View>
  );
};

/* ---------- − value + ---------- */
const Num: React.FC<{ label: string; value: WorkoutSet['kg']; done: boolean; onChange: (v: string | number) => void; onStep: (d: number) => void }> = ({ label, value, done, onChange, onStep }) => {
  const [text, setText] = useState<string | null>(null); // while typing, keep the raw text ("2," …)
  return (
    <View style={[s.num, done && { backgroundColor: J.surface }]}>
      <Pressable onPress={() => onStep(-1)} accessibilityRole="button" accessibilityLabel={`${label} moins`} hitSlop={4} style={s.numBtn}>
        <Text style={s.numBtnText}>−</Text>
      </Pressable>
      <TextInput
        style={[s.numInput, tabular]}
        keyboardType="decimal-pad"
        selectTextOnFocus
        accessibilityLabel={label}
        value={text ?? (value === undefined || value === '' ? '' : String(value).replace('.', ','))}
        onFocus={() => setText(value === undefined || value === '' ? '' : String(value).replace('.', ','))}
        onChangeText={t => {
          const clean = t.replace(/[^0-9.,]/g, '');
          setText(clean);
          onChange(clean);
        }}
        onBlur={() => {
          onChange(text === '' || text === null ? '' : num(text));
          setText(null);
        }}
      />
      <Pressable onPress={() => onStep(1)} accessibilityRole="button" accessibilityLabel={`${label} plus`} hitSlop={4} style={s.numBtn}>
        <Text style={s.numBtnText}>+</Text>
      </Pressable>
    </View>
  );
};

/* ---------- progress chart ---------- */
const ProgressCard: React.FC<{ history: Workout[]; exerciseId: string; meta: Exercise }> = ({ history, exerciseId, meta }) => {
  const [metric, setMetric] = useState<'value' | 'volume'>('value');
  const [days, setDays] = useState<30 | 90 | 365>(90);
  const cardio = meta.kind === 'cardio';
  const unit = metric === 'volume' ? (cardio ? 'km' : 'kg') : cardio ? 'min' : 'kg';
  const series = exerciseProgress(history, exerciseId, days).map(p => ({ ...p, y: metric === 'volume' ? p.volume : p.value }));
  const first = series[0]?.y ?? 0;
  const lastP = series[series.length - 1];
  const delta = series.length > 1 ? lastP.y - first : 0;
  return (
    <Card>
      <SecHead
        title="Ma progression"
        right={<Seg options={[['value', cardio ? 'Durée' : 'Charge max'], ['volume', cardio ? 'Distance' : 'Volume']]} value={metric} onChange={setMetric} />}
      />
      {series.length < 2 ? (
        <Text style={k.empty}>{series.length ? 'Encore une séance et ta courbe apparaît.' : 'Ta courbe apparaît après 2 séances.'}</Text>
      ) : (
        <>
          <View style={s.progHead}>
            <Text style={[s.progVal, tabular]}>{fmtNum(Math.round(lastP.y * 10) / 10)} {unit}</Text>
            <Text style={[s.progDelta, delta > 0 && { color: J.okText }, delta < 0 && { color: J.tiredText }]}>
              {delta > 0 ? '+' : ''}{fmtNum(Math.round(delta * 10) / 10)} {unit} en {days === 365 ? '1 an' : `${days} j`}
            </Text>
          </View>
          <LineChart points={series} unit={unit} />
        </>
      )}
      <View style={{ marginTop: 8 }}>
        <Seg small options={[[30, '30 j'], [90, '90 j'], [365, '1 an']]} value={days} onChange={setDays} />
      </View>
    </Card>
  );
};

function niceTicks(min: number, max: number, n = 3) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const raw = span / (n - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= raw) || raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const t: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) t.push(Math.round(v * 100) / 100);
  return t;
}

const LineChart: React.FC<{ points: (ProgressPoint & { y: number })[]; unit: string }> = ({ points, unit }) => {
  const W = 300, H = 130, L = 34, R = 10, T = 12, B = 22;
  const ys = points.map(p => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const t0 = +new Date(points[0].date);
  const t1 = +new Date(points[points.length - 1].date) || t0 + 1;
  const x = (d: string) => L + ((+new Date(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - yMin) / Math.max(1e-9, yMax - yMin)) * (H - T - B);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points[points.length - 1].date).toFixed(1)},${H - B} L${x(points[0].date).toFixed(1)},${H - B} Z`;
  const best = points.reduce((bst, p) => (p.y > bst.y ? p : bst), points[0]);
  const last = points[points.length - 1];
  const short = (d: string) => {
    const z = new Date(d);
    return `${z.getDate()}/${z.getMonth() + 1}`;
  };
  return (
    <View style={{ width: '100%', aspectRatio: W / H }} accessible accessibilityLabel={`Progression en ${unit}`}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {ticks.map(t => (
          <G key={t}>
            <Line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={J.line} strokeWidth={1} />
            <SvgText x={L - 6} y={y(t) + 3.5} textAnchor="end" fill={J.muted} fontSize={9.5}>{fmtNum(t)}</SvgText>
          </G>
        ))}
        <Path d={area} fill={J.accent} opacity={0.12} />
        <Path d={line} fill="none" stroke={J.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          p === last ? (
            <Circle key={i} cx={x(p.date)} cy={y(p.y)} r={4.5} fill={J.accent} stroke={J.surface} strokeWidth={2} />
          ) : p === best ? (
            <Circle key={i} cx={x(p.date)} cy={y(p.y)} r={2.5} fill={J.goldBright} stroke={J.goldBright} strokeWidth={2} />
          ) : (
            <Circle key={i} cx={x(p.date)} cy={y(p.y)} r={2.5} fill={J.surface} stroke={J.accent} strokeWidth={2} />
          )
        )}
        <SvgText x={L} y={H - 6} fill={J.muted} fontSize={9.5}>{short(points[0].date)}</SvgText>
        <SvgText x={W - R} y={H - 6} textAnchor="end" fill={J.muted} fontSize={9.5}>{short(last.date)}</SvgText>
      </Svg>
    </View>
  );
};

const s = StyleSheet.create({
  stack: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: J.fg },
  refs: { flexDirection: 'row', gap: 8 },
  ref: { flex: 1, minWidth: 0, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  refGold: { backgroundColor: J.goldSoft, borderColor: 'transparent' },
  refLbl: { fontSize: 11, fontWeight: '800', color: J.muted },
  refVal: { fontSize: 14, fontWeight: '800', color: J.fg },
  refDate: { fontSize: 11, color: J.muted },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: J.okSoft },
  hintIc: { width: 28, height: 28, borderRadius: 14, backgroundColor: J.ok, alignItems: 'center', justifyContent: 'center' },
  hintIcText: { color: colors.white, fontWeight: '900' },
  hintText: { flex: 1, fontSize: 13, fontWeight: '700', color: J.fg, minWidth: 0 },

  sets: { paddingVertical: 10, paddingHorizontal: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, padding: 4 },
  rowHead: { paddingVertical: 0 },
  hCell: { fontSize: 10.5, fontWeight: '800', color: J.muted, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' },
  rowDone: { backgroundColor: J.okSoft },
  rowPr: { backgroundColor: J.goldSoft },
  cN: { width: 26, alignItems: 'center' },
  cPrev: { width: 50, alignItems: 'center', paddingVertical: 6 },
  cNum: { flex: 1 },
  cCheck: { width: 40 },
  n: { fontWeight: '800', color: J.fg, textAlign: 'center' },
  prTag: { fontSize: 10, fontWeight: '900', color: J.gold },
  prev: { fontSize: 12, color: J.muted },
  num: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: J.surface2, borderRadius: 10, overflow: 'hidden' },
  numBtn: { width: 24, height: 40, alignItems: 'center', justifyContent: 'center' },
  numBtnText: { fontSize: 17, fontWeight: '800', color: J.muted },
  numInput: { flex: 1, minWidth: 0, textAlign: 'center', fontWeight: '800', fontSize: 15, color: J.fg, paddingVertical: 0, paddingHorizontal: 0, height: 40 },
  check: { width: 40, height: 40, borderRadius: 10, borderWidth: 2, borderColor: J.line, backgroundColor: J.surface, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: J.ok, borderColor: J.ok },
  checkPr: { backgroundColor: J.goldBright, borderColor: J.goldBright },
  checkText: { fontWeight: '900', color: 'transparent', fontSize: 16 },
  setsActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 6 },

  total: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  totalLbl: { fontSize: 11, fontWeight: '800', color: J.muted },
  totalVal: { fontSize: 28, fontWeight: '900', color: J.fg, lineHeight: 32 },

  progHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 4 },
  progVal: { fontSize: 28, fontWeight: '900', color: J.fg },
  progDelta: { fontSize: 12, fontWeight: '800', color: J.muted },

  rowBtns: { flexDirection: 'row', gap: 8 },
});
