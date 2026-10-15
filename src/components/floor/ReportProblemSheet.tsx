import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { PROBLEM_CATEGORIES, PROBLEM_PLACES, ProblemCategory, ProblemReport, agoShort, categoryOf } from '../../services/problemReportService';
import { pickImages } from '../../services/imagePicker';
import { colors } from '../../theme';

interface Props {
  visible: boolean;
  /** This member's earlier reports, to follow them ("Réglé ✓"). */
  mine: ProblemReport[];
  onClose: () => void;
  onSend: (r: { category: ProblemCategory; place?: string; message: string; photoUri?: string }) => Promise<void>;
}

/** Member: report a broken machine, dirty area… straight to the club team (not to Google). */
export const ReportProblemSheet: React.FC<Props> = ({ visible, mine, onClose, onSend }) => {
  const [category, setCategory] = useState<ProblemCategory | null>(null);
  const [place, setPlace] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCategory(null);
      setPlace(undefined);
      setMessage('');
      setPhoto(undefined);
      setError('');
    }
  }, [visible]);

  const addPhoto = async () => {
    try {
      const res = await pickImages();
      if (res.error === 'denied') setError('Accès aux photos refusé. Autorise-le dans les réglages du téléphone.');
      else if (res.uris[0]) setPhoto(res.uris[0]);
    } catch {
      setError('Impossible d’ouvrir la galerie.');
    }
  };

  const send = async () => {
    if (!category) return setError('Choisis le type de problème.');
    if (message.trim().length < 5) return setError('Décris le problème en quelques mots.');
    setError('');
    setBusy(true);
    await onSend({ category, place, message: message.trim(), photoUri: photo });
    setBusy(false);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.9]}
      header={
        <View>
          <Text style={styles.title} accessibilityRole="header">Signaler un problème</Text>
          <Text style={styles.sub}>L’équipe du club le reçoit directement et te prévient quand c’est réglé.</Text>
        </View>
      }
    >
      {() => (
        <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Quel problème ?</Text>
          <View style={styles.chips}>
            {PROBLEM_CATEGORIES.map(c => {
              const on = category === c.id;
              return (
                <Pressable key={c.id} onPress={() => setCategory(c.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
                  <Ionicons name={c.icon as any} size={16} color={on ? colors.amber.text : colors.textSecondary} />
                  <Text style={[styles.chipText, on && { color: colors.amber.text }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Où ? (facultatif)</Text>
          <View style={styles.chips}>
            {PROBLEM_PLACES.map(p => {
              const on = place === p;
              return (
                <Pressable key={p} onPress={() => setPlace(on ? undefined : p)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, styles.chipSm, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && { color: colors.amber.text }]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Explique</Text>
          <TextInput
            style={[styles.input, styles.multi]}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={300}
            placeholder="Ex : le câble de la poulie haute est cassé"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.photoRow}>
            {photo ? (
              <>
                <Image source={{ uri: photo }} style={styles.photo} />
                <Pressable onPress={() => setPhoto(undefined)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.remove}>Retirer la photo</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={addPhoto} accessibilityRole="button" style={styles.photoBtn}>
                <Ionicons name="camera-outline" size={18} color={colors.text} />
                <Text style={styles.photoBtnText}>Ajouter une photo</Text>
              </Pressable>
            )}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={send} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.send, (pressed || busy) && { opacity: 0.85 }]}>
            <Ionicons name="send" size={16} color={colors.white} />
            <Text style={styles.sendText}>{busy ? 'Envoi…' : 'Envoyer au club'}</Text>
          </Pressable>

          {mine.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 24 }]}>Mes signalements</Text>
              {mine.slice(0, 5).map(r => (
                <View key={r.id} style={styles.mineRow}>
                  <Ionicons name={categoryOf(r.category).icon as any} size={18} color={colors.textSecondary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.mineText} numberOfLines={1}>{r.message}</Text>
                    <Text style={styles.mineSub}>{agoShort(r.createdAt)}{r.place ? ` · ${r.place}` : ''}</Text>
                  </View>
                  <View style={[styles.status, r.status === 'fixed' ? styles.statusFixed : styles.statusOpen]}>
                    <Text style={[styles.statusText, { color: r.status === 'fixed' ? colors.green.text : colors.amber.text }]}>{r.status === 'fixed' ? 'Réglé ✓' : 'En cours'}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  body: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginTop: 14, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  chipSm: { height: 34 },
  chipOn: { backgroundColor: colors.amber.soft, borderColor: colors.amber.bar },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  multi: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  photo: { width: 64, height: 64, borderRadius: 12 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  photoBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  remove: { fontSize: 14, fontWeight: '700', color: colors.red.text },
  error: { color: colors.red.text, fontSize: 14, fontWeight: '600', marginTop: 12 },
  send: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, backgroundColor: colors.brand, marginTop: 18 },
  sendText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.track },
  mineText: { fontSize: 14, fontWeight: '700', color: colors.text },
  mineSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusOpen: { backgroundColor: colors.amber.soft },
  statusFixed: { backgroundColor: colors.green.soft },
  statusText: { fontSize: 12, fontWeight: '800' },
});
