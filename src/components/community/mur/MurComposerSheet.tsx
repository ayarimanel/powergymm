import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../ui/Text';
import { Community, PostKind } from '../../../community/murService';
import { ClubRole, canPostAnonymous } from '../../../community/permissions';
import { colors } from '../../../theme';
import { BottomSheet, SheetScrollView } from '../../home/BottomSheet';

interface Props {
  visible: boolean;
  communities: Community[]; // where the user can post
  role: ClubRole;
  initialCid: string | null;
  onClose: () => void;
  onSend: (cid: string, kind: PostKind, text: string, anon: boolean) => void;
}

const Chip: React.FC<{ label: string; on: boolean; onPress: () => void }> = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
  </Pressable>
);

export const MurComposerSheet: React.FC<Props> = ({ visible, communities, role, initialCid, onClose, onSend }) => {
  const first = communities.find(c => c.id !== 'club') ?? communities[0];
  const [cid, setCid] = useState(initialCid ?? first?.id ?? 'general');
  const [kind, setKind] = useState<PostKind>('question');
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);

  useEffect(() => {
    if (visible) {
      const start = initialCid && communities.some(c => c.id === initialCid) ? initialCid : (first?.id ?? 'general');
      setCid(start);
      setText('');
      setAnon(false);
      setKind(start === 'club' ? 'official' : 'question');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialCid]);

  const c = communities.find(x => x.id === cid);
  const kinds: [PostKind, string][] = cid === 'club' ? [['official', 'Annonce']] : [['question', 'Question'], ['record', 'Record']];
  const effectiveKind = kinds.some(k => k[0] === kind) ? kind : kinds[0][0];
  const anonOk = canPostAnonymous(role, effectiveKind);
  const anonOn = anonOk && anon;

  const send = () => {
    if (effectiveKind === 'question' && !text.trim()) return;
    onSend(cid, effectiveKind, text.trim(), anonOn);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.7, 0.94]}
      initialSnap={1}
      header={<Text style={styles.title}>Nouvelle publication</Text>}
    >
      {(_e, extraBottom) => (
        <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingBottom: 24 + extraBottom }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.lbl}>Où ?</Text>
          <View style={styles.chips}>
            {communities.map(x => <Chip key={x.id} label={x.name} on={x.id === cid} onPress={() => { setCid(x.id); if (x.id === 'club') setKind('official'); else if (kind === 'official') setKind('question'); }} />)}
          </View>

          <Text style={styles.lbl}>Type</Text>
          <View style={styles.chips}>
            {kinds.map(([k, l]) => <Chip key={k} label={l} on={k === effectiveKind} onPress={() => setKind(k)} />)}
          </View>

          {effectiveKind === 'record' && (
            <Info>Un record doit être <Text style={styles.b}>validé par un coach</Text> avant d'être publié (vidéo ou coach présent).</Info>
          )}

          <TextInput
            style={styles.textarea}
            value={text}
            onChangeText={setText}
            placeholder={effectiveKind === 'question' ? 'Pose ta question…' : 'Écris quelque chose (optionnel)…'}
            placeholderTextColor={colors.textMuted}
            multiline
          />

          {anonOk && (
            <View style={styles.toggle}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Poser anonymement</Text>
                <Text style={styles.toggleSub}>Ton nom est caché aux membres. Seuls les modérateurs le voient, et ils valident la question avant publication.</Text>
              </View>
              <Pressable onPress={() => setAnon(a => !a)} accessibilityRole="switch" accessibilityState={{ checked: anonOn }} style={[styles.sw, anonOn && styles.swOn]}>
                <View style={[styles.knob, anonOn && styles.knobOn]} />
              </Pressable>
            </View>
          )}

          <Info>Visible par <Text style={styles.b}>{cid === 'club' ? 'tous les membres du club' : `les ${c?.members ?? ''} membres de ${c?.name ?? ''}`}</Text> uniquement. Jamais en dehors du club.</Info>

          <Pressable onPress={send} accessibilityRole="button" style={styles.send}>
            <Text style={styles.sendText}>{anonOn || effectiveKind === 'record' ? 'Envoyer pour validation' : 'Publier'}</Text>
          </Pressable>
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const Info: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.info}><Text style={styles.infoText}>{children}</Text></View>
);

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  body: { paddingHorizontal: 20, gap: 10 },
  lbl: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  chipTextOn: { color: colors.card },
  info: { backgroundColor: colors.track, borderRadius: 12, padding: 12 },
  infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  b: { color: colors.text, fontWeight: '800' },
  textarea: { minHeight: 90, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, backgroundColor: colors.track, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.track, borderRadius: 14, padding: 12 },
  toggleTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  toggleSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  sw: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.border, justifyContent: 'center', paddingHorizontal: 3 },
  swOn: { backgroundColor: colors.brand },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  knobOn: { transform: [{ translateX: 18 }] },
  send: { height: 50, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  sendText: { fontSize: 15, fontWeight: '800', color: colors.white },
});
