import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { MuscleGroup } from '../../types/database';
import {
  MUSCLES, Workout, agoLabel, dayKey, dayLabel, exById, fmtInt, fmtKg, muscleById, muscleRecovery, periodStats,
  repeatableSessions, suggestMuscle, summarizeSets, weekDays, workoutSets, workoutVolume,
} from '../journalLogic';
import { Btn, Card, Dot, J, Kpis, Link, MuscleGlyph, MuscleIcon, SecHead, Seg, StatusPill, k, tabular } from './kit';
import { colors } from '../../theme';
import { claimSwipe } from '../../navigation/swipeGuard';
import { Icon } from '../../components/ui/Icon';

interface Props {
  history: Workout[];
  saved: Workout[];
  active: Workout | null;
  now: Date;
  selDay: Date;
  setSelDay: (d: Date) => void;
  onStart: (d: Date) => void;
  onRepeat: (w: Workout) => void;
  onResume: () => void;
  onMuscle: (id: MuscleGroup) => void;
  onDelete: (id: string) => void;
}

/** One line per exercise: "● Développé couché ........ 3 × 10 à 40 kg" */
export const ExerciseLines: React.FC<{ workout: Workout }> = ({ workout }) => (
  <View style={s.lines}>
    {workout.exercises.map(e => {
      const m = exById(e.exerciseId);
      if (!m) return null;
      return (
        <View key={e.exerciseId} style={s.line}>
          <Dot color={muscleById(m.muscle).color} />
          <Text style={s.lineName} numberOfLines={1}>
            {m.name}
            {e.sets.some(x => x.pr) && <Text style={k.prMini}> PR </Text>}
          </Text>
          <Text style={[s.lineSets, tabular]} numberOfLines={2}>{summarizeSets(e.sets, m.kind)}</Text>
        </View>
      );
    })}
  </View>
);

export const JournalHome: React.FC<Props> = ({ history, saved, active, now, selDay, setSelDay, onStart, onRepeat, onResume, onMuscle, onDelete }) => {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const week = weekDays(history, now);
  const dayWorkouts = saved.filter(x => dayKey(x.date) === dayKey(selDay));
  const isToday = dayKey(selDay) === dayKey(now);
  const sugg = suggestMuscle(history, now);
  const suggR = sugg && muscleRecovery(history, sugg.id, now);
  const stats = useMemo(() => periodStats(history, period, now), [history, period, now]);
  const maxSets = Math.max(1, ...Object.values(stats.perMuscle).map(x => x?.sets ?? 0));

  return (
    <View style={s.stack}>
      {/* week + selected day */}
      <Card>
        <View style={s.week} accessibilityLabel="Semaine">
          {week.map(d => {
            const sel = dayKey(d.date) === dayKey(selDay);
            return (
              <Pressable
                key={d.letter + d.date.getDate()}
                disabled={d.future}
                onPress={() => setSelDay(d.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel, disabled: d.future }}
                accessibilityLabel={dayLabel(d.date, now)}
                style={[s.wd, d.future && { opacity: 0.45 }]}
              >
                <View style={[s.wdDot, d.trained && s.wdDone, d.isToday && s.wdToday, sel && s.wdSel]}>
                  {d.trained ? <Icon name="checkmark" size={15} color={colors.white} /> : <Text style={[s.wdNum, tabular]}>{d.date.getDate()}</Text>}
                </View>
                <Text style={[s.wdL, d.isToday && { color: J.fg }]}>{d.letter}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.dayHead}>
          <Text style={s.dayTitle}>{dayLabel(selDay, now)}</Text>
          {dayWorkouts.length > 0 && (
            <Text style={[s.dayMeta, tabular]}>
              {fmtKg(dayWorkouts.reduce((a, x) => a + workoutVolume(x), 0))} · {dayWorkouts.reduce((a, x) => a + workoutSets(x), 0)} séries
            </Text>
          )}
        </View>

        {dayWorkouts.length ? (
          dayWorkouts.map(x => (
            <View key={x.id} style={s.dayW}>
              <ExerciseLines workout={x} />
              {confirmDel === x.id ? (
                <View style={s.confirm}>
                  <Text style={s.confirmText}>Supprimer cette séance ?</Text>
                  <Btn small variant="danger" label="Supprimer" onPress={() => { onDelete(x.id); setConfirmDel(null); }} />
                  <Btn small variant="ghost" label="Non" onPress={() => setConfirmDel(null)} />
                </View>
              ) : (
                <Link muted label="Supprimer" onPress={() => setConfirmDel(x.id)} />
              )}
            </View>
          ))
        ) : (
          <Text style={k.empty}>{isToday ? "Rien de noté pour l'instant." : 'Pas de séance ce jour-là.'}</Text>
        )}

        {active ? (
          <Btn full label="Reprendre la séance en cours" onPress={onResume} />
        ) : (
          <Btn full label={isToday ? 'Commencer une séance' : `Noter une séance · ${dayLabel(selDay, now)}`} onPress={() => onStart(selDay)} />
        )}
      </Card>

      {!active && <RepeatCard history={saved} now={now} onRepeat={onRepeat} />}

      {sugg && suggR && !active && (
        <Pressable onPress={() => onMuscle(sugg.id)} accessibilityRole="button" style={({ pressed }) => [s.sugg, pressed && { opacity: 0.85 }]}>
          <View style={[s.suggIc, { backgroundColor: sugg.color }]}>
            <Text style={s.suggIcText}>{sugg.name[0]}</Text>
          </View>
          <Text style={s.suggText}>
            <Text style={{ fontWeight: '800' }}>{sugg.name}</Text>{' '}
            {suggR.status === 'never' ? 'jamais travaillé ici : bon moment pour commencer.' : `est prêt, dernière fois ${agoLabel(suggR.last, now).toLowerCase()}.`}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>
      )}

      <Card>
        <SecHead title="Mon corps" sub="Touche un muscle" />
        <BodyMap history={history} now={now} onMuscle={onMuscle} />
        <View style={s.legend}>
          {[
            [J.ok, 'Prêt'],
            [J.rec, 'Récupération'],
            [J.tired, 'Fatigué'],
          ].map(([c, l]) => (
            <View key={l} style={s.legendItem}>
              <Dot color={c} size={9} />
              <Text style={s.legendText}>{l}</Text>
            </View>
          ))}
          <View style={s.legendItem}>
            <View style={s.legendNever} />
            <Text style={s.legendText}>Pas encore</Text>
          </View>
        </View>
      </Card>

      <SecHead pad title="Quel muscle travailles-tu ?" />
      <View style={s.grid}>
        {MUSCLES.map(m => {
          const r = muscleRecovery(history, m.id, now);
          const p = r.status === 'never' ? 100 : r.pct;
          return (
            <Pressable key={m.id} onPress={() => onMuscle(m.id)} accessibilityRole="button" accessibilityLabel={m.name} style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}>
              <MuscleIcon id={m.id} color={m.color} />
              <Text style={s.tileName}>{m.name}</Text>
              <Text style={s.tileAgo}>{agoLabel(r.last, now)}</Text>
              <StatusPill r={r} />
              <View style={s.ring}>
                <View style={[s.ringFill, { width: `${p}%` }]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <SecHead title="Mon bilan" right={<Seg options={[[7, '7 jours'], [30, '30 jours']]} value={period} onChange={setPeriod} />} />
        <Kpis items={[[stats.activeDays, 'jours actifs'], [stats.sets, 'séries'], [fmtInt(stats.volume), 'kg soulevés'], [stats.prs, 'records']]} />
        <View style={s.bars}>
          {MUSCLES.map(m => {
            const x = stats.perMuscle[m.id] ?? { sets: 0, volume: 0 };
            return (
              <View key={m.id} style={s.bar}>
                <Text style={s.barName} numberOfLines={1}>{m.name}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${(x.sets / maxSets) * 100}%`, backgroundColor: m.color }]} />
                </View>
                <Text style={[s.barVal, tabular]}>
                  <Text style={{ color: J.fg, fontWeight: '800' }}>{x.sets}</Text> séries
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={k.note}>Compté en séries : c'est plus juste que les kg pour comparer les muscles (les jambes soulèvent toujours plus lourd).</Text>
      </Card>
    </View>
  );
};

const RepeatCard: React.FC<{ history: Workout[]; now: Date; onRepeat: (w: Workout) => void }> = ({ history, now, onRepeat }) => {
  const list = repeatableSessions(history, 3);
  if (!list.length) return null;
  return (
    <Card style={{ paddingBottom: 12 }}>
      <SecHead title="Refaire une séance" sub="avec tes derniers poids" />
      <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} snapToAlignment="start" decelerationRate="fast" contentContainerStyle={{ gap: 8 }}>
        {list.map(({ workout, muscles, exercises }) => (
          <Pressable
            key={workout.id}
            onPress={() => onRepeat(workout)}
            accessibilityRole="button"
            accessibilityLabel={`Refaire ${muscles.map(m => m.name).join(', ')}`}
            style={({ pressed }) => [s.rep, list.length === 1 && s.repOnly, pressed && { opacity: 0.85 }]}
          >
            <View style={s.repDots}>{muscles.map(m => <Dot key={m.id} color={m.color} size={10} />)}</View>
            <Text style={s.repTitle} numberOfLines={1}>{muscles.map(m => m.name).join(' · ')}</Text>
            <Text style={s.repMeta}>
              {dayLabel(workout.date, now)} · {exercises.length} exo{exercises.length > 1 ? 's' : ''} · {workoutSets(workout)} séries
            </Text>
            <Text style={s.repNames} numberOfLines={1}>
              {exercises.slice(0, 3).map(e => exById(e.exerciseId)!.name).join(', ')}
              {exercises.length > 3 ? '…' : ''}
            </Text>
            <View style={s.repGo}>
              <Text style={s.repGoText}>Refaire ›</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
};

/* ---------- body map ---------- */
type Zone = { m: MuscleGroup; el: (fill: string, stroke: string, dashed: boolean) => React.ReactNode };
const zp = (fill: string, stroke: string, dashed: boolean) => ({ fill, stroke, strokeWidth: dashed ? 1.2 : 0, strokeDasharray: dashed ? '3 2' : undefined });
const SHOULDERS: Zone = { m: 'shoulders', el: (f, st, d) => <><Circle cx={37} cy={50} r={9} {...zp(f, st, d)} /><Circle cx={83} cy={50} r={9} {...zp(f, st, d)} /></> };
const ARMS: Zone = { m: 'arms', el: (f, st, d) => <><Rect x={23} y={60} width={11} height={50} rx={5.5} {...zp(f, st, d)} /><Rect x={86} y={60} width={11} height={50} rx={5.5} {...zp(f, st, d)} /></> };
const LEGS: Zone = { m: 'legs', el: (f, st, d) => <><Rect x={44} y={108} width={14} height={76} rx={7} {...zp(f, st, d)} /><Rect x={62} y={108} width={14} height={76} rx={7} {...zp(f, st, d)} /></> };
const ZONES: Record<'front' | 'back', Zone[]> = {
  front: [SHOULDERS, { m: 'chest', el: (f, st, d) => <><Rect x={43} y={46} width={16} height={22} rx={6} {...zp(f, st, d)} /><Rect x={61} y={46} width={16} height={22} rx={6} {...zp(f, st, d)} /></> }, ARMS, LEGS],
  back: [SHOULDERS, { m: 'back', el: (f, st, d) => <Path d="M44 44 H76 Q80 44 79 50 L74 100 Q73 104 69 104 H51 Q47 104 46 100 L41 50 Q40 44 44 44Z" {...zp(f, st, d)} /> }, ARMS, LEGS],
};
const STATUS_FILL = { ready: J.ok, recovering: J.rec, tired: J.tired, never: J.surface };

const BodyMap: React.FC<{ history: Workout[]; now: Date; onMuscle: (id: MuscleGroup) => void }> = ({ history, now, onMuscle }) => {
  const status = Object.fromEntries(MUSCLES.map(m => [m.id, muscleRecovery(history, m.id, now).status])) as Record<MuscleGroup, keyof typeof STATUS_FILL>;
  const fig = (side: 'front' | 'back') => (
    <View style={s.fig} accessibilityLabel={side === 'front' ? 'Face' : 'Dos'}>
      <View style={s.figBox}>
      <Svg viewBox="0 0 120 190" width="100%" height="100%">
        <Circle cx={60} cy={22} r={13} fill={J.surface2} stroke={J.line} />
        <Rect x={40} y={40} width={40} height={68} rx={12} fill={J.surface2} stroke={J.line} />
        {side === 'front' && <Rect x={47} y={72} width={26} height={32} rx={6} fill={J.line} />}
        {ZONES[side].map(z => (
          <G key={z.m} onPress={() => onMuscle(z.m)}>
            {z.el(STATUS_FILL[status[z.m]], J.muted, status[z.m] === 'never')}
          </G>
        ))}
      </Svg>
      </View>
      <Text style={s.figCap}>{side === 'front' ? 'Face' : 'Dos'}</Text>
    </View>
  );
  const cardio = muscleRecovery(history, 'cardio', now);
  const cc = cardio.status === 'ready' ? [J.okSoft, J.okText] : cardio.status === 'recovering' ? [J.recSoft, J.recText] : cardio.status === 'tired' ? [J.tiredSoft, J.tiredText] : [J.surface2, J.muted];
  return (
    <View>
      <View style={s.bodyMap}>
        {fig('front')}
        {fig('back')}
      </View>
      <Pressable onPress={() => onMuscle('cardio')} accessibilityRole="button" style={[s.cardio, { backgroundColor: cc[0] }]}>
        <MuscleGlyph id="cardio" color={cc[1]} size={14} />
        <Text style={[s.cardioText, { color: cc[1] }]}>Cardio</Text>
      </Pressable>
    </View>
  );
};

const s = StyleSheet.create({
  stack: { gap: 12 },
  week: { flexDirection: 'row', marginBottom: 12 },
  wd: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
  wdDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: J.surface2, borderWidth: 2, borderColor: 'transparent' },
  wdDone: { backgroundColor: J.ok },
  wdToday: { borderColor: J.fg },
  wdSel: { shadowColor: J.accent, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, borderColor: J.accent, borderWidth: 3 },
  wdNum: { fontWeight: '800', fontSize: 13, color: J.muted },
  wdL: { fontSize: 11, fontWeight: '800', color: J.muted },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  dayTitle: { fontSize: 15, fontWeight: '800', color: J.fg },
  dayMeta: { fontSize: 12, color: J.muted },
  dayW: { gap: 4, marginBottom: 10 },
  lines: { gap: 7 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineName: { flex: 1, fontSize: 13, fontWeight: '700', color: J.fg, minWidth: 0 },
  lineSets: { fontSize: 12, color: J.muted, textAlign: 'right', maxWidth: '55%' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  confirmText: { fontSize: 12, color: J.muted },

  sugg: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: J.line, backgroundColor: J.accentSoft, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  suggIc: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  suggIcText: { color: colors.white, fontWeight: '800' },
  suggText: { flex: 1, fontSize: 13, color: J.fg, lineHeight: 18 },
  chev: { fontSize: 22, color: J.accentText, fontWeight: '700' },

  bodyMap: { flexDirection: 'row', gap: 6 },
  fig: { flex: 1, alignItems: 'center', gap: 4 },
  figBox: { width: '100%', maxWidth: 140, aspectRatio: 120 / 190 },
  figCap: { fontSize: 11, fontWeight: '800', color: J.muted },
  cardio: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginTop: 6 },
  cardioText: { fontSize: 12, fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 11, color: J.muted },
  legendNever: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderStyle: 'dashed', borderColor: J.muted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '31%', flexGrow: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 6, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line, borderRadius: 18, overflow: 'hidden' },
  tileName: { fontSize: 13, fontWeight: '800', color: J.fg },
  tileAgo: { fontSize: 11, color: J.muted },
  ring: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: J.surface2 },
  ringFill: { height: 3, backgroundColor: J.ok },

  bars: { gap: 8, marginTop: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barName: { width: 76, fontSize: 12, fontWeight: '700', color: J.fg },
  barTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: J.surface2, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 99 },
  barVal: { width: 64, textAlign: 'right', fontSize: 12, color: J.muted },

  rep: { width: 250, gap: 3, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface2, borderRadius: 16, padding: 12 },
  repOnly: { width: 300 },
  repDots: { flexDirection: 'row', gap: 4 },
  repTitle: { fontSize: 15, fontWeight: '800', color: J.fg },
  repMeta: { fontSize: 12, color: J.muted },
  repNames: { fontSize: 12, color: J.fg },
  repGo: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: J.accent, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  repGoText: { color: colors.white, fontWeight: '800', fontSize: 12 },
});
