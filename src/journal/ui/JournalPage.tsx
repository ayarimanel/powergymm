import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Icon, IconName } from '../../components/ui/Icon';
import { Title } from '../../components/ui/Title';
import { MuscleGroup } from '../../types/database';
import {
  MUSCLES, Workout, dayKey, exById, fmtInt, fmtNum, muscleById, periodStats, personalRecord, workoutSets, workoutVolume,
} from '../journalLogic';
import { J, Seg, tabular } from './kit';
import { colors, fonts, ink, light, radius } from '../../theme';

/**
 * "Mon journal" (design-ref Historique + Bilan): the session calendar and the bilan,
 * as two tabs of one page. Every number comes from the existing journal logic.
 */
export type JournalTab = 'seances' | 'bilan';

interface Props {
  history: Workout[];
  now: Date;
  tab: JournalTab;
  setTab: (t: JournalTab) => void;
  onBack: () => void;
  onRepeat: (w: Workout) => void;
  /** A day tapped in the calendar: back to Entraînement with that day selected. */
  onDay: (d: Date) => void;
}

const MUSCLE_ICON: Record<MuscleGroup, IconName> = {
  chest: 'barbell-outline',
  back: 'body-outline',
  legs: 'walk-outline',
  shoulders: 'shield-outline',
  arms: 'fitness-outline',
  cardio: 'flame-outline',
};
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const short = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }).replace('.', '');
const workoutMuscles = (w: Workout) => [...new Set(w.exercises.map(e => exById(e.exerciseId)?.muscle).filter(Boolean) as MuscleGroup[])].map(muscleById);

export const JournalPage: React.FC<Props> = ({ history, now, tab, setTab, onBack, onRepeat, onDay }) => (
  <View style={s.stack}>
    <View style={s.top}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour à l’entraînement" style={s.round}>
        <Icon name="chevron-back" size={22} color={J.fg} />
      </Pressable>
      <Title variant="section" style={s.topTitle}>Mon journal</Title>
      <View style={s.roundSpacer} />
    </View>

    <View style={s.tabs} accessibilityRole="tablist">
      {([['seances', 'Séances'], ['bilan', 'Bilan']] as [JournalTab, string][]).map(([id, label]) => {
        const on = tab === id;
        return (
          <Pressable key={id} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[s.tab, on && s.tabOn]}>
            <Text style={[s.tabText, on && s.tabTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>

    {tab === 'seances' ? <History history={history} now={now} onRepeat={onRepeat} onDay={onDay} /> : <Bilan history={history} now={now} />}
  </View>
);

/* ---------- Séances: calendar + activities ---------- */
const History: React.FC<{ history: Workout[]; now: Date; onRepeat: (w: Workout) => void; onDay: (d: Date) => void }> = ({ history, now, onRepeat, onDay }) => {
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const trained = useMemo(() => new Set(history.map(x => dayKey(x.date))), [history]);
  const inMonth = history
    .filter(x => {
      const d = new Date(x.date);
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
    })
    .sort((a, z) => +new Date(z.date) - +new Date(a.date));
  const first = (month.getDay() + 6) % 7; // Monday = 0
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const isFutureMonth = month > new Date(now.getFullYear(), now.getMonth(), 1);
  const go = (d: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + d, 1));

  return (
    <>
      <View style={s.card}>
        <View style={s.calHead}>
          <Pressable onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="Mois précédent" style={s.navBtn}>
            <Icon name="chevron-back" size={20} color={J.fg} />
          </Pressable>
          <Text style={s.month}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
          <Pressable onPress={() => go(1)} disabled={!isFutureMonth && month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear()} accessibilityRole="button" accessibilityLabel="Mois suivant" style={s.navBtn}>
            <Icon name="chevron-forward" size={20} color={J.fg} />
          </Pressable>
        </View>
        <View style={s.grid}>
          {LETTERS.map((l, i) => (
            <Text key={'l' + i} style={s.letter}>{l}</Text>
          ))}
          {cells.map((d, i) => {
            if (d == null) return <View key={i} style={s.cell} />;
            const date = new Date(month.getFullYear(), month.getMonth(), d);
            const done = trained.has(dayKey(date));
            const today = dayKey(date) === dayKey(now);
            const future = date > now && !today;
            return (
              <Pressable
                key={i}
                disabled={future}
                onPress={() => onDay(date)}
                accessibilityRole="button"
                accessibilityLabel={`${d} ${MONTHS[month.getMonth()]}${done ? ', séance faite' : ''}`}
                style={s.cell}
              >
                <View style={[s.dayBox, done && s.dayDone, today && s.dayToday]}>
                  <Text style={[s.dayNum, done && { color: J.accentText }, today && { color: colors.white }, future && { color: J.muted }, tabular]}>{d}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={s.legend}>
          <View style={s.legendItem}><View style={[s.legendSq, { borderWidth: 1.5, borderColor: J.accent }]} /><Text style={s.legendText}>Séance faite</Text></View>
          <View style={s.legendItem}><View style={[s.legendSq, { backgroundColor: J.accent }]} /><Text style={s.legendText}>Aujourd’hui</Text></View>
          <Text style={[s.legendText, { marginLeft: 'auto' }]}>{inMonth.length} séance{inMonth.length > 1 ? 's' : ''} ce mois</Text>
        </View>
      </View>

      <Title variant="section" style={s.sec}>Activités</Title>
      {inMonth.length === 0 ? (
        <Text style={s.empty}>Aucune séance ce mois-ci.</Text>
      ) : (
        inMonth.map(w => {
          const muscles = workoutMuscles(w);
          return (
            <View key={w.id} style={s.act}>
              <View style={s.actIc}>
                <Icon name={MUSCLE_ICON[muscles[0]?.id ?? 'chest']} size={22} color={J.accentText} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.actTitle} numberOfLines={1}>{muscles.map(m => m.name).join(' · ') || 'Séance'}</Text>
                <Text style={[s.actSub, tabular]} numberOfLines={1}>
                  {short(new Date(w.date))} · {w.exercises.length} exo{w.exercises.length > 1 ? 's' : ''} · {workoutSets(w)} séries
                </Text>
              </View>
              <Pressable onPress={() => onRepeat(w)} accessibilityRole="button" accessibilityLabel={`Refaire ${muscles.map(m => m.name).join(', ')}`} style={({ pressed }) => [s.redo, pressed && { opacity: 0.8 }]}>
                <Text style={s.redoText}>Refaire</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </>
  );
};

/* ---------- Bilan ---------- */
const Bilan: React.FC<{ history: Workout[]; now: Date }> = ({ history, now }) => {
  const [period, setPeriod] = useState<7 | 30>(7);
  const stats = useMemo(() => periodStats(history, period, now), [history, period, now]);
  // The period before: the double period minus this one.
  const before = useMemo(() => periodStats(history, period * 2, now).volume - stats.volume, [history, period, now, stats.volume]);
  const delta = before > 0 ? Math.round(((stats.volume - before) / before) * 100) : null;

  // Kg per day over the period (the existing workout volumes, summed by day).
  const bars = useMemo(() => {
    const out: { key: string; label: string; kg: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const kg = history.filter(x => dayKey(x.date) === k).reduce((a, x) => a + workoutVolume(x), 0);
      out.push({ key: k, label: period === 7 ? LETTERS[(d.getDay() + 6) % 7] : String(d.getDate()), kg });
    }
    return out;
  }, [history, period, now]);
  const maxKg = Math.max(1, ...bars.map(b => b.kg));

  const muscles = MUSCLES.map(m => ({ m, sets: stats.perMuscle[m.id]?.sets ?? 0 })).sort((a, z) => z.sets - a.sets);
  const maxSets = Math.max(1, ...muscles.map(x => x.sets));
  const worked = muscles.filter(x => x.sets > 0).length;

  // Records: each exercise's best lift (personalRecord), the most recent first.
  const records = useMemo(() => {
    const ids = [...new Set(history.flatMap(w => w.exercises.map(e => e.exerciseId)))];
    return ids
      .map(id => {
        const meta = exById(id);
        if (!meta || meta.kind === 'cardio') return null;
        const pr = personalRecord(history, id);
        return pr ? { id, name: meta.name, kg: pr.kg, reps: pr.reps, date: pr.date } : null;
      })
      .filter((x): x is { id: string; name: string; kg: number; reps: number; date: string } => !!x)
      .sort((a, z) => +new Date(z.date) - +new Date(a.date))
      .slice(0, 5);
  }, [history]);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (period - 1));

  return (
    <>
      <View style={s.bilanHead}>
        <View style={{ flex: 1 }}>
          <Title variant="display" size={40}>Mon bilan</Title>
          <Text style={s.sub}>{period === 7 ? '7 derniers jours' : '30 derniers jours'}</Text>
        </View>
        <Seg options={[[7, '7 jours'], [30, '30 jours']]} value={period} onChange={setPeriod} />
      </View>

      <View style={s.kgCard}>
        <View style={s.kgTop}>
          <Text style={s.kgLbl}>Kg soulevés</Text>
          {delta != null && (
            <View style={s.deltaPill}>
              <Text style={s.deltaText}>{delta > 0 ? '+' : ''}{delta} % vs période d’avant</Text>
            </View>
          )}
        </View>
        <Text style={[s.kgVal, tabular]}>{fmtInt(stats.volume)}</Text>
        <View style={s.kgBars}>
          {bars.map(b => (
            <View key={b.key} style={s.kgCol}>
              <View style={s.kgTrack}>
                <View style={[s.kgBar, { height: b.kg ? `${Math.max(8, (b.kg / maxKg) * 100)}%` : 4, opacity: b.kg ? 1 : 0.35 }]} />
              </View>
              {(period === 7 || Number(b.label) % 5 === 0) && <Text style={s.kgDay}>{b.label}</Text>}
            </View>
          ))}
        </View>
      </View>

      <View style={[s.card, s.triple]}>
        {([[stats.activeDays, 'jours actifs'], [stats.sets, 'séries'], [stats.prs, stats.prs > 1 ? 'records' : 'record']] as [number, string][]).map(([v, l], i) => (
          <View key={l} style={[s.tripleItem, i > 0 && s.tripleSep]}>
            <Text style={[s.tripleVal, i === 2 && v > 0 && { color: J.recText }, tabular]}>{v}</Text>
            <Text style={s.tripleLbl}>{l}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>Séries par muscle</Text>
          <View style={s.countPill}><Text style={s.countText}>{worked} / {MUSCLES.length} muscles</Text></View>
        </View>
        <View style={{ gap: 12, marginTop: 14 }}>
          {muscles.map(({ m, sets }, i) => (
            <View key={m.id} style={s.mRow}>
              <Text style={[s.mName, !sets && { color: J.muted }]} numberOfLines={1}>{m.name}</Text>
              <View style={s.mTrack}>
                <View style={[s.mFill, { width: `${(sets / maxSets) * 100}%`, backgroundColor: i === 0 && sets ? J.accent : colors.text }]} />
              </View>
              <Text style={[s.mVal, !sets && { color: J.muted }, tabular]}>{sets}</Text>
            </View>
          ))}
        </View>
        <Text style={s.note}>Compté en séries : c’est plus juste que les kg pour comparer les muscles.</Text>
      </View>

      <Title variant="section" style={s.sec}>Tes records</Title>
      {records.length === 0 ? (
        <Text style={s.empty}>Tes records apparaissent ici dès ta première séance.</Text>
      ) : (
        <View style={s.card}>
          {records.map((r, i) => {
            const recent = new Date(r.date) >= from;
            return (
              <View key={r.id} style={[s.recRow, i > 0 && s.recSep]}>
                <View style={[s.recIc, recent && { backgroundColor: J.recSoft }]}>
                  <Icon name="trophy-outline" size={20} color={recent ? J.recText : J.muted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.recName} numberOfLines={1}>{r.name}</Text>
                  <Text style={s.recDate}>{recent ? 'Récent · ' : ''}{new Date(r.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text>
                </View>
                <Text style={[s.recVal, recent && { color: J.accentText }, tabular]}>{r.kg ? `${fmtNum(r.kg)} kg × ${r.reps}` : `PDC × ${r.reps}`}</Text>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
};

const s = StyleSheet.create({
  stack: { gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  roundSpacer: { width: 44 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 22 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: J.surface },
  tab: { flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: J.accent },
  tabText: { fontSize: 15, fontWeight: '700', color: J.muted },
  tabTextOn: { color: colors.white, fontWeight: '800' },
  sec: { marginTop: 10 },
  sub: { fontSize: 14, fontWeight: '500', color: J.muted, marginTop: 2 },
  empty: { fontSize: 14, color: J.muted, paddingVertical: 8 },
  card: { padding: 18, borderRadius: radius.cardLg, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  note: { fontSize: 12, color: J.muted, marginTop: 14, lineHeight: 17 },

  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 18, fontWeight: '800', color: J.fg },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  letter: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', color: J.muted, paddingVertical: 8 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  dayBox: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayDone: { backgroundColor: J.accentSoft },
  dayToday: { backgroundColor: J.accent },
  dayNum: { fontSize: 15, fontWeight: '700', color: J.fg },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSq: { width: 11, height: 11, borderRadius: 3 },
  legendText: { fontSize: 12, fontWeight: '500', color: J.muted },

  act: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.cardLg, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  actIc: { width: 50, height: 50, borderRadius: 16, backgroundColor: J.accentSoft, alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontSize: 16, fontWeight: '800', color: J.fg },
  actSub: { fontSize: 13, color: J.muted, marginTop: 2 },
  redo: { height: 38, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: J.line, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  redoText: { fontSize: 14, fontWeight: '800', color: J.fg },

  bilanHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  kgCard: { padding: 20, borderRadius: radius.cardLg, backgroundColor: J.accent },
  kgTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kgLbl: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: light(0.85) },
  deltaPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: ink(0.25) },
  deltaText: { fontSize: 12, fontWeight: '800', color: colors.white },
  kgVal: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 52, lineHeight: 56, color: colors.white, marginTop: 6 },
  kgBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110, marginTop: 14 },
  kgCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  kgTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  kgBar: { width: '70%', maxWidth: 28, borderRadius: 6, backgroundColor: colors.white },
  kgDay: { fontSize: 11, fontWeight: '700', color: light(0.85) },

  triple: { flexDirection: 'row', paddingHorizontal: 0 },
  tripleItem: { flex: 1, paddingHorizontal: 18, gap: 2 },
  tripleSep: { borderLeftWidth: 1, borderLeftColor: J.line },
  tripleVal: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 32, lineHeight: 36, color: J.fg },
  tripleLbl: { fontSize: 13, fontWeight: '500', color: J.muted },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: J.fg },
  countPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: J.surface2 },
  countText: { fontSize: 12, fontWeight: '700', color: J.muted },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mName: { width: 86, fontSize: 14, fontWeight: '700', color: J.fg },
  mTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: J.surface2, overflow: 'hidden' },
  mFill: { height: 8, borderRadius: 4 },
  mVal: { width: 30, textAlign: 'right', fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 20, color: J.fg },

  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  recSep: { borderTopWidth: 1, borderTopColor: J.line },
  recIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  recName: { fontSize: 15, fontWeight: '800', color: J.fg },
  recDate: { fontSize: 13, color: J.muted, marginTop: 2 },
  recVal: { fontSize: 14, fontWeight: '800', color: J.fg },
});
