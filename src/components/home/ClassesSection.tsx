import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { card, colors } from '../../theme';
import { DAYS } from '../../services/coachService';
import { ClubClass, cancelSession, cancelledNext, isBooked, nextSession, spotsLeft, validTime, whenLabel } from '../../services/classService';
import { BottomSheet, SheetScrollView } from './BottomSheet';

const SHOWN = 4;

// ---------- Section on the Floor screen ----------

interface SectionProps {
  classes: ClubClass[];
  userId: string;
  isOwner: boolean;
  onToggle: (c: ClubClass) => void;
  onManage: () => void;
}

export const ClassesSection: React.FC<SectionProps> = ({ classes, userId, isOwner, onToggle, onManage }) => {
  const [all, setAll] = useState(false);
  if (classes.length === 0 && !isOwner) return null;
  const sorted = [...classes].sort((a, b) => nextSession(a).start.getTime() - nextSession(b).start.getTime());
  const shown = all ? sorted : sorted.slice(0, SHOWN);

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.head}>
        <Text style={styles.title}>Cours collectifs</Text>
        {isOwner && (
          <Pressable onPress={onManage} accessibilityRole="button" accessibilityLabel="Gérer les cours" style={styles.manage}>
            <Icon name="create-outline" size={18} color={colors.text} />
            <Text style={styles.manageText}>Gérer</Text>
          </Pressable>
        )}
      </View>

      {classes.length === 0 ? (
        <Pressable onPress={onManage} accessibilityRole="button" style={styles.emptyOwner}>
          <Icon name="add-circle-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.emptyOwnerText}>Ajoute les cours du club : yoga, HIIT, zumba…</Text>
        </Pressable>
      ) : (
        shown.map(c => {
          const cancelled = cancelledNext(c);
          const booked = isBooked(c, userId);
          const left = spotsLeft(c);
          const full = left <= 0 && !booked;
          return (
            <View key={c.id} style={[styles.item, cancelled && styles.itemCancelled]}>
              <View style={[styles.time, cancelled && styles.timeCancelled]}>
                <Text style={styles.timeText}>{c.time}</Text>
                <Text style={styles.timeSub}>{c.durationMin} min</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.title}</Text>
                <Text style={styles.meta}>
                  {whenLabel(c).split(' · ')[0]} · {c.coachName}
                </Text>
                {cancelled ? (
                  <Text style={styles.cancelledText}>Annulé : {cancelled.reason}</Text>
                ) : (
                  <Text style={[styles.spots, left <= 3 && { color: colors.amber.text }]}>{full ? 'Complet' : `${left} place${left > 1 ? 's' : ''}`}</Text>
                )}
              </View>
              {!isOwner && !cancelled && (
                <Pressable
                  onPress={() => onToggle(c)}
                  disabled={full}
                  accessibilityRole="button"
                  accessibilityLabel={booked ? `Annuler ma réservation ${c.title}` : `Réserver ${c.title}`}
                  style={[styles.btn, booked && styles.btnOn, full && styles.btnOff]}
                >
                  <Icon name={booked ? 'checkmark' : 'add'} size={18} color={booked ? colors.green.text : full ? colors.textMuted : colors.brandText} />
                  <Text style={[styles.btnText, booked && { color: colors.green.text }, full && { color: colors.textMuted }]}>{booked ? 'Réservé' : 'Réserver'}</Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}

      {classes.length > SHOWN && (
        <Pressable onPress={() => setAll(v => !v)} accessibilityRole="button" style={styles.more}>
          <Text style={styles.moreText}>{all ? 'Réduire' : `Voir tous les cours (${classes.length})`}</Text>
        </Pressable>
      )}
    </View>
  );
};

// ---------- Owner sheet ----------

interface ManageProps {
  visible: boolean;
  classes: ClubClass[];
  onClose: () => void;
  onChange: (list: ClubClass[]) => void;
  /** Broadcasts the cancellation to the whole club (Infos du club, on the Floor screen). */
  onCancelNotice: (className: string, when: string, reason: string) => void;
}

const SUGGESTED_REASON = 'Le coach a une urgence, désolé pour la gêne occasionnée.';

export const ClassesManageSheet: React.FC<ManageProps> = ({ visible, classes, onClose, onChange, onCancelNotice }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [coach, setCoach] = useState('');
  const [day, setDay] = useState('Lun');
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('45');
  const [capacity, setCapacity] = useState('20');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState(SUGGESTED_REASON);

  const reset = () => {
    setEditing(null);
    setTitle('');
    setCoach('');
    setDay('Lun');
    setTime('18:00');
    setDuration('45');
    setCapacity('20');
    setError('');
  };
  useEffect(() => {
    if (visible) {
      reset();
      setDeleting(null);
      setCancelling(null);
      setReason(SUGGESTED_REASON);
    }
  }, [visible]);

  const confirmCancel = (c: ClubClass) => {
    const { date } = nextSession(c);
    onChange(classes.map(x => (x.id === c.id ? cancelSession(x, date, reason.trim() || SUGGESTED_REASON) : x)));
    onCancelNotice(c.title, whenLabel(c), reason.trim() || SUGGESTED_REASON);
    setCancelling(null);
    setReason(SUGGESTED_REASON);
  };

  const startEdit = (c: ClubClass) => {
    setEditing(c.id);
    setTitle(c.title);
    setCoach(c.coachName);
    setDay(c.day);
    setTime(c.time);
    setDuration(String(c.durationMin));
    setCapacity(String(c.capacity));
    setError('');
  };

  const submit = () => {
    const dur = parseInt(duration, 10);
    const cap = parseInt(capacity, 10);
    if (title.trim().length < 2) return setError('Donne un nom au cours.');
    if (!validTime(time)) return setError('Heure invalide (exemple : 18:30).');
    if (!(dur > 0) || !(cap > 0)) return setError('Durée et places doivent être supérieures à 0.');
    const base = { title: title.trim(), coachName: coach.trim() || 'Coach', day, time: time.trim().padStart(5, '0'), durationMin: dur, capacity: cap };
    onChange(editing ? classes.map(c => (c.id === editing ? { ...c, ...base } : c)) : [...classes, { id: 'cl-' + Date.now(), ...base, bookings: {} }]);
    reset();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.94]}
      header={
        <Text style={styles.sheetTitle} accessibilityRole="header">
          Cours collectifs
        </Text>
      }
    >
      {() => (
        <SheetScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{editing ? 'Modifier le cours' : 'Nouveau cours'}</Text>
          <TextInput style={styles.input} value={title} onChangeText={t => { setTitle(t); setError(''); }} placeholder="Nom (ex : Yoga)" placeholderTextColor={colors.textMuted} maxLength={30} />
          <TextInput style={[styles.input, { marginTop: 10 }]} value={coach} onChangeText={setCoach} placeholder="Coach (ex : Coach Sonia)" placeholderTextColor={colors.textMuted} maxLength={30} />

          <Text style={[styles.label, { marginTop: 16 }]}>Jour</Text>
          <View style={styles.days}>
            {DAYS.map(d => (
              <Pressable key={d} onPress={() => setDay(d)} accessibilityRole="button" accessibilityState={{ selected: day === d }} style={[styles.day, day === d && styles.dayOn]}>
                <Text style={[styles.dayText, day === d && { color: colors.onInverse }]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.three}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Heure</Text>
              <TextInput style={styles.input} value={time} onChangeText={t => { setTime(t); setError(''); }} placeholder="18:30" placeholderTextColor={colors.textMuted} maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Durée (min)</Text>
              <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" maxLength={3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Places</Text>
              <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" maxLength={3} />
            </View>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.formBtns}>
            {editing && (
              <Pressable onPress={reset} accessibilityRole="button" style={styles.ghost}>
                <Text style={styles.ghostText}>Annuler</Text>
              </Pressable>
            )}
            <Pressable onPress={submit} accessibilityRole="button" style={styles.publish}>
              <Text style={styles.publishText}>{editing ? 'Enregistrer' : 'Ajouter le cours'}</Text>
            </Pressable>
          </View>

          {classes.length > 0 && <Text style={[styles.label, { marginTop: 26 }]}>Programme ({classes.length})</Text>}
          {classes.map(c => {
            const cancelled = cancelledNext(c);
            return (
              <View key={c.id}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{c.title}</Text>
                    <Text style={styles.rowSub}>
                      {c.day} {c.time} · {c.durationMin} min · {c.capacity} places
                    </Text>
                    {!!cancelled && <Text style={styles.cancelledText}>Prochaine séance annulée : {cancelled.reason}</Text>}
                  </View>
                  {!cancelled && (
                    <Pressable onPress={() => { setCancelling(c.id); setReason(SUGGESTED_REASON); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Annuler la prochaine séance de ${c.title}`} style={styles.iconBtn}>
                      <Icon name="alert-circle-outline" size={20} color={colors.amber.text} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => startEdit(c)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Modifier" style={styles.iconBtn}>
                    <Icon name="create-outline" size={20} color={colors.text} />
                  </Pressable>
                  {deleting === c.id ? (
                    <Pressable onPress={() => { onChange(classes.filter(x => x.id !== c.id)); setDeleting(null); }} accessibilityRole="button" style={styles.confirmDel}>
                      <Text style={styles.confirmDelText}>Confirmer</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => setDeleting(c.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Supprimer" style={styles.iconBtn}>
                      <Icon name="trash-outline" size={20} color={colors.red.text} />
                    </Pressable>
                  )}
                </View>

                {cancelling === c.id && (
                  <View style={styles.cancelBox}>
                    <Text style={styles.cancelBoxLabel}>Message aux membres (visible sur "Infos du club")</Text>
                    <TextInput style={[styles.input, styles.multi]} value={reason} onChangeText={setReason} multiline maxLength={160} />
                    <View style={styles.formBtns}>
                      <Pressable onPress={() => setCancelling(null)} accessibilityRole="button" style={styles.ghost}>
                        <Text style={styles.ghostText}>Retour</Text>
                      </Pressable>
                      <Pressable onPress={() => confirmCancel(c)} accessibilityRole="button" style={[styles.publish, { backgroundColor: colors.red.bar }]}>
                        <Text style={styles.publishText}>Annuler la séance</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  manageText: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyOwner: { ...card, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderStyle: 'dashed' },
  emptyOwnerText: { flex: 1, fontSize: 14, color: colors.textSecondary },

  item: { ...card, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 },
  itemCancelled: { opacity: 0.85, borderColor: colors.red.bar },
  time: { width: 62, height: 62, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  timeCancelled: { backgroundColor: colors.red.soft },
  timeText: { fontSize: 17, fontWeight: '900', color: colors.text },
  timeSub: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  spots: { fontSize: 13, fontWeight: '700', color: colors.green.text, marginTop: 2 },
  cancelledText: { fontSize: 13, fontWeight: '700', color: colors.red.text, marginTop: 2 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.brandSoft },
  btnOn: { backgroundColor: colors.green.soft },
  btnOff: { backgroundColor: colors.track },
  btnText: { fontSize: 14, fontWeight: '800', color: colors.brandText },
  more: { height: 40, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  form: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  multi: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 42, borderRadius: 12, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.text },
  dayText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  three: { flexDirection: 'row', gap: 10, marginTop: 16 },
  error: { color: colors.red.text, fontSize: 14, fontWeight: '600', marginTop: 10 },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ghost: { height: 48, paddingHorizontal: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  // Brand blue = the one primary action
  publish: { flex: 1, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.track },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  confirmDel: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.red.bar, justifyContent: 'center' },
  confirmDelText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  cancelBox: { padding: 12, borderRadius: 14, backgroundColor: colors.red.soft, marginBottom: 10, gap: 8 },
  cancelBoxLabel: { fontSize: 13, fontWeight: '700', color: colors.red.text },
});
