import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { GenderType, MuscleGroup } from '../../types/database';
import {
  MUSCLES, Recovery, Workout, agoLabel, dayKey, dayLabel, exById, fmtInt, fmtKg, muscleById, muscleRecovery, periodStats,
  repeatableSessions, suggestMuscle, summarizeSets, weekDays, workoutSets, workoutVolume,
} from '../journalLogic';
import { Btn, Card, Dot, J, Link, MuscleGlyph, Seg, k, tabular } from './kit';
import { colors, fonts, radius } from '../../theme';
import { claimSwipe } from '../../navigation/swipeGuard';
import { Icon, IconName } from '../../components/ui/Icon';
import { Title } from '../../components/ui/Title';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Tag } from '../../components/ui/Tag';
import { BodyLegend, BodyPhotos, BodySex } from './BodyPhotos';

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
  /** The member's gender (sign-up): which body "Mon corps" shows first. */
  gender?: GenderType;
  /** "Mon journal" page: the calendar of sessions, or the bilan. */
  onOpenHistory?: () => void;
  onOpenBilan?: () => void;
}

/** One line per exercise: "Développé couché ........ 3 × 10 à 40 kg" */
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

/** Status words and colors, as the StatusPill shows them. */
/** Same icons as the muscle picker after a scan. */
const MUSCLE_ICON: Record<MuscleGroup, IconName> = {
  chest: 'barbell-outline',
  back: 'body-outline',
  legs: 'walk-outline',
  shoulders: 'shield-outline',
  arms: 'fitness-outline',
  cardio: 'flame-outline',
};

const statusText = (r: Recovery) =>
  r.status === 'never' ? 'À découvrir' : r.status === 'ready' ? 'Prêt' : r.status === 'recovering' ? `Prêt dans ${r.readyInH} h` : `Fatigué · ${r.readyInH} h`;
const statusColor = (r: Recovery) =>
  r.status === 'never' ? J.muted : r.status === 'ready' ? J.okText : r.status === 'recovering' ? J.recText : J.tiredText;

export const JournalHome: React.FC<Props> = ({ history, saved, active, now, selDay, setSelDay, onStart, onRepeat, onResume, onMuscle, onDelete, gender, onOpenHistory, onOpenBilan }) => {
  const period = 7; // "Cette semaine"; 30 days live in Mon bilan
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [sex, setSex] = useState<BodySex>(gender === 'female' ? 'femme' : 'homme');
  const week = weekDays(history, now);
  const dayWorkouts = saved.filter(x => dayKey(x.date) === dayKey(selDay));
  const isToday = dayKey(selDay) === dayKey(now);
  const sugg = suggestMuscle(history, now);
  const suggR = sugg && muscleRecovery(history, sugg.id, now);
  const stats = useMemo(() => periodStats(history, period, now), [history, period, now]);
  const status = Object.fromEntries(MUSCLES.map(m => [m.id, muscleRecovery(history, m.id, now).status])) as Record<MuscleGroup, Recovery['status']>;
  const cardio = muscleRecovery(history, 'cardio', now);

  return (
    <View style={s.stack}>
      {/* Title + the main action */}
      <View style={s.titleRow}>
        {/* The page title left for the logo band on top (TopBanner) */}
        <View accessible accessibilityRole="header" accessibilityLabel="Entraînement" />
        <Pressable onPress={active ? onResume : () => onStart(now)} accessibilityRole="button" hitSlop={8} style={s.startLink}>
          <Icon name="play" size={14} color={colors.brand} />
          <Text style={s.startLinkText}>{active ? 'Reprendre' : 'Commencer'}</Text>
        </Pressable>
      </View>

      {/* Week strip */}
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
              style={[s.wd, d.isToday && s.wdToday, sel && s.wdSel, d.future && { opacity: 0.45 }]}
            >
              <Text style={[s.wdL, sel && { color: colors.white }]}>{d.letter}</Text>
              <Text style={[s.wdNum, sel && { color: colors.white }, tabular]}>{d.date.getDate()}</Text>
              <View style={[s.wdDot, d.trained && { backgroundColor: sel ? colors.white : J.accent }]} />
            </Pressable>
          );
        })}
      </View>

      {/* The selected day */}
      <Card>
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

      {/* Tes muscles */}
      <SectionHeader title="Tes muscles" right={<Text style={s.caption}>État de récupération</Text>} style={s.sec} />
      <ScrollView horizontal onTouchStart={claimSwipe} showsHorizontalScrollIndicator={false} contentContainerStyle={s.muscles}>
        {MUSCLES.map(m => {
          const r = muscleRecovery(history, m.id, now);
          return (
            <Pressable key={m.id} onPress={() => onMuscle(m.id)} accessibilityRole="button" accessibilityLabel={`${m.name}, ${statusText(r)}`} style={({ pressed }) => [s.mCard, pressed && { opacity: 0.85 }]}>
              <Icon name={MUSCLE_ICON[m.id]} size={30} color={colors.text} />
              <Text style={s.mName}>{m.name}</Text>
              <Text style={[s.mStatus, { color: statusColor(r) }]} numberOfLines={1}>{statusText(r)}</Text>
              <Text style={s.mAgo} numberOfLines={1}>{agoLabel(r.last, now)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Suggestion */}
      {sugg && suggR && !active && (
        <Pressable onPress={() => onMuscle(sugg.id)} accessibilityRole="button" style={({ pressed }) => [s.sugg, pressed && { opacity: 0.85 }]}>
          <View style={s.suggIc}>
            <Icon name="trending-up" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.suggTitle}>{sugg.name}</Text>
            <Text style={s.suggText}>
              {suggR.status === 'never' ? 'Jamais travaillé ici : bon moment pour commencer.' : `Prêt, dernière fois ${agoLabel(suggR.last, now).toLowerCase()}.`}
            </Text>
          </View>
          <Icon name="chevron-forward" size={20} color={J.accentText} />
        </Pressable>
      )}

      {/* Mon corps */}
      <SectionHeader
        title="Mon corps"
        style={s.sec}
        right={
          <View style={s.sexSeg} accessibilityRole="tablist">
            {(['femme', 'homme'] as const).map(v => {
              const on = sex === v;
              return (
                <Pressable key={v} onPress={() => setSex(v)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[s.sexBtn, on && s.sexBtnOn]}>
                  <Text style={[s.sexText, on && s.sexTextOn]}>{v === 'femme' ? 'Femme' : 'Homme'}</Text>
                </Pressable>
              );
            })}
          </View>
        }
      />
      <View style={s.bodyCard}>
        <BodyPhotos sex={sex} status={status} onMuscle={onMuscle} />
        <BodyLegend />
        <Pressable onPress={() => onMuscle('cardio')} accessibilityRole="button" accessibilityLabel={`Cardio, ${statusText(cardio)}`} style={s.cardio}>
          <MuscleGlyph id="cardio" color={statusColor(cardio)} size={14} />
          <Text style={[s.cardioText, { color: statusColor(cardio) }]}>Cardio · {statusText(cardio)}</Text>
        </Pressable>
        <Text style={s.bodyHint}>Touche un muscle pour voir ses exercices</Text>
      </View>

      {/* Dernières séances */}
      {!active && <LastSessions history={saved} now={now} onRepeat={onRepeat} onOpenHistory={onOpenHistory} />}

      {/* Cette semaine / 30 jours */}
      <SectionHeader title="Cette semaine" style={s.sec} actionLabel={onOpenBilan ? 'Mon bilan →' : undefined} onAction={onOpenBilan} />
      <View style={s.tiles}>
        <View style={s.tile}>
          <Text style={[s.tileNum, tabular]}>{stats.activeDays}</Text>
          <Text style={s.tileLabel}>jours actifs</Text>
        </View>
        <View style={s.tile}>
          <Text style={[s.tileNum, tabular]}>{stats.sets}</Text>
          <Text style={s.tileLabel}>séries</Text>
        </View>
        <View style={[s.tile, s.tileRed]}>
          <Text style={[s.tileNum, { color: colors.white }, tabular]}>{fmtInt(stats.volume)}</Text>
          <Text style={[s.tileLabel, { color: colors.white }]}>kg soulevés</Text>
        </View>
        <View style={s.tile}>
          <Text style={[s.tileNum, tabular]}>{stats.prs}</Text>
          <Text style={s.tileLabel}>record{stats.prs > 1 ? 's' : ''}</Text>
        </View>
      </View>
    </View>
  );
};

/** Last sessions as log cards (design-ref Entrainement): exercises + "Refaire" with the same weights. */
const LastSessions: React.FC<{ history: Workout[]; now: Date; onRepeat: (w: Workout) => void; onOpenHistory?: () => void }> = ({ history, now, onRepeat, onOpenHistory }) => {
  const list = repeatableSessions(history, 3);
  if (!list.length) return null;
  return (
    <>
      <SectionHeader title="Dernières séances" style={s.sec} actionLabel={onOpenHistory ? 'Historique' : undefined} onAction={onOpenHistory} />
      {list.map(({ workout, muscles }, i) => {
        const d = new Date(workout.date);
        return (
          <View key={workout.id} style={s.log}>
            <View style={s.logHead}>
              <View style={s.dateBox}>
                <Text style={s.dateDay}>{d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase()}</Text>
                <Text style={[s.dateNum, tabular]}>{d.getDate()}</Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.logTitle} numberOfLines={1}>{muscles.map(m => m.name).join(' · ')}</Text>
                <View style={s.logTags}>
                  {muscles.map(m => <Tag key={m.id} label={m.name} tone={m.id === 'cardio' ? 'brand' : 'neutral'} />)}
                </View>
              </View>
            </View>
            <ExerciseLines workout={workout} />
            <View style={s.logFoot}>
              <Text style={[s.logMeta, tabular]}>
                {workoutSets(workout)} séries · {fmtKg(workoutVolume(workout))}
              </Text>
              <Pressable
                onPress={() => onRepeat(workout)}
                accessibilityRole="button"
                accessibilityLabel={`Refaire ${muscles.map(m => m.name).join(', ')}`}
                style={({ pressed }) => [s.redo, i === 0 ? s.redoMain : s.redoGhost, pressed && { opacity: 0.85 }]}
              >
                <Icon name="refresh" size={16} color={i === 0 ? colors.white : colors.text} />
                <Text style={[s.redoText, i > 0 && { color: colors.text }]}>Refaire</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
};

const s = StyleSheet.create({
  stack: { gap: 14 },
  sec: { marginTop: 14 },
  caption: { fontSize: 12, fontWeight: '600', color: J.muted },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  startLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  startLinkText: { fontSize: 14, fontWeight: '700', color: colors.brand },

  week: { flexDirection: 'row', gap: 6 },
  wd: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  wdToday: { borderColor: J.fg },
  wdSel: { backgroundColor: J.accent, borderColor: J.accent },
  wdL: { fontSize: 11, fontWeight: '700', color: J.muted },
  wdNum: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 20, lineHeight: 22, color: J.fg },
  wdDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },

  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  dayTitle: { fontSize: 15, fontWeight: '800', color: J.fg },
  dayMeta: { fontSize: 12, color: J.muted },
  dayW: { gap: 4, marginBottom: 10 },
  lines: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: J.line },
  lineName: { flex: 1, fontSize: 14, fontWeight: '700', color: J.fg, minWidth: 0 },
  lineSets: { fontSize: 13, color: J.muted, textAlign: 'right', maxWidth: '55%' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  confirmText: { fontSize: 12, color: J.muted },

  muscles: { gap: 10, paddingRight: 16 },
  mCard: { width: 128, alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: 10, borderRadius: radius.cardLg, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  mName: { fontSize: 15, fontWeight: '800', color: J.fg },
  mStatus: { fontSize: 13, fontWeight: '700' },
  mAgo: { fontSize: 12, color: J.muted },

  sugg: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: J.accent + '55', backgroundColor: J.accentSoft, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 14 },
  suggIc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: J.accent },
  suggTitle: { fontSize: 15, fontWeight: '800', color: J.fg },
  suggText: { fontSize: 13, color: J.muted, lineHeight: 18, marginTop: 2 },

  sexSeg: { flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: J.surface2 },
  sexBtn: { height: 30, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sexBtnOn: { backgroundColor: colors.text },
  sexText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  sexTextOn: { color: colors.onInverse, fontWeight: '800' },

  bodyCard: { gap: 14, padding: 14, paddingTop: 18, borderRadius: radius.cardLg, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  cardio: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: J.surface2 },
  cardioText: { fontSize: 12, fontWeight: '800' },
  bodyHint: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: J.muted },

  log: { gap: 8, padding: 18, borderRadius: radius.cardLg, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  logHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  dateBox: { width: 48, height: 52, borderRadius: 14, backgroundColor: J.surface2, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: J.muted },
  dateNum: { fontFamily: fonts.heading, fontWeight: 'normal', fontSize: 22, lineHeight: 24, color: J.fg },
  logTitle: { fontSize: 17, fontWeight: '800', color: J.fg },
  logTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  logFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  logMeta: { fontSize: 13, color: J.muted },
  redo: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 999 },
  redoMain: { backgroundColor: J.accent },
  redoGhost: { borderWidth: 1.5, borderColor: colors.disabled },
  redoText: { fontSize: 14, fontWeight: '800', color: colors.white },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 4, padding: 16, borderRadius: 20, backgroundColor: J.surface, borderWidth: 1, borderColor: J.line },
  tileRed: { backgroundColor: J.accent, borderColor: J.accent },
  tileNum: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 34, lineHeight: 38, color: J.fg },
  tileLabel: { fontSize: 13, fontWeight: '500', color: J.muted },

  barsTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: J.muted },
  bars: { gap: 10, marginTop: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barName: { width: 76, fontSize: 12, fontWeight: '700', color: J.fg },
  barTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: J.surface2, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 99, backgroundColor: colors.text },
  barVal: { width: 64, textAlign: 'right', fontSize: 12, color: J.muted },
});
