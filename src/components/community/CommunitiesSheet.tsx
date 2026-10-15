import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { Community, CreatePermission, COMMUNITY_COLORS, COMMUNITY_EMOJIS } from '../../services/communitiesService';
import { colors } from '../../theme';
import { haptics } from '../../utils/haptics';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { EmojiIcon } from '../ui/EmojiIcon';

interface Props {
  visible: boolean;
  onClose: () => void;
  communities: Community[];
  userId: string;
  permission: CreatePermission;
  onToggleJoin: (c: Community) => void;
  onSelect: (id: string) => void;
  onCreate: (input: { name: string; description: string; emoji: string; color: string }) => void;
}

export const CommunitiesSheet: React.FC<Props> = ({ visible, onClose, communities, userId, permission, onToggleJoin, onSelect, onCreate }) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [emoji, setEmoji] = useState(COMMUNITY_EMOJIS[0]);
  const [color, setColor] = useState(COMMUNITY_COLORS[0]);

  const reset = () => { setCreating(false); setName(''); setDesc(''); setEmoji(COMMUNITY_EMOJIS[0]); setColor(COMMUNITY_COLORS[0]); };
  const close = () => { reset(); onClose(); };

  const submit = () => {
    if (name.trim().length < 2) return;
    haptics.success();
    onCreate({ name, description: desc, emoji, color });
    reset();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      snaps={[0.6, 0.94]}
      initialSnap={1}
      header={
        <View style={styles.head}>
          <Text style={styles.title}>{creating ? 'Nouvelle communauté' : 'Communautés'}</Text>
          {creating ? (
            <Pressable onPress={() => setCreating(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
              <Icon name="chevron-back" size={24} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
              <Icon name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      }
    >
      {(_expanded, extraBottom) => (
        <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: 32 + extraBottom }]} showsVerticalScrollIndicator={false}>
          {creating ? (
            <View style={{ gap: 16 }}>
              <View style={styles.previewRow}>
                <View style={[styles.previewIcon, { backgroundColor: color }]}><EmojiIcon emoji={emoji} size={26} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{name.trim() || 'Nom de la communauté'}</Text>
                  <Text style={styles.previewSub}>{permission.official ? 'Communauté vérifiée du club' : 'Communauté de membre'}</Text>
                </View>
              </View>

              <View>
                <Text style={styles.field}>Nom</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="ex. Yoga & Mobilité" placeholderTextColor={colors.textMuted} maxLength={24} />
              </View>
              <View>
                <Text style={styles.field}>Description</Text>
                <TextInput style={[styles.input, styles.textarea]} value={desc} onChangeText={setDesc} placeholder="De quoi parle ta communauté ?" placeholderTextColor={colors.textMuted} multiline maxLength={140} />
              </View>

              <View>
                <Text style={styles.field}>Emoji</Text>
                <View style={styles.picker}>
                  {COMMUNITY_EMOJIS.map(e => (
                    <Pressable key={e} onPress={() => setEmoji(e)} style={[styles.emojiCell, emoji === e && styles.emojiCellOn]}>
                      <EmojiIcon emoji={e} size={20} color={emoji === e ? colors.brandText : colors.text} />
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.field}>Couleur</Text>
                <View style={styles.picker}>
                  {COMMUNITY_COLORS.map(c => (
                    <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorCell, { backgroundColor: c }, color === c && styles.colorCellOn]}>
                      {color === c && <Icon name="checkmark" size={16} color={colors.white} />}
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable onPress={submit} disabled={name.trim().length < 2} accessibilityRole="button" style={[styles.createBtn, name.trim().length < 2 && { opacity: 0.5 }]}>
                <Text style={styles.createBtnText}>Créer la communauté</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {permission.allowed ? (
                <Pressable onPress={() => setCreating(true)} accessibilityRole="button" style={styles.newBtn}>
                  <Icon name="add-circle" size={22} color={colors.brand} />
                  <Text style={styles.newBtnText}>Créer une communauté</Text>
                </Pressable>
              ) : (
                <View style={styles.lockedBox}>
                  <Icon name="lock-closed-outline" size={18} color={colors.textMuted} />
                  <Text style={styles.lockedText}>{permission.reason}</Text>
                </View>
              )}

              {communities.map(c => {
                const joined = c.memberIds.includes(userId);
                return (
                  <View key={c.id} style={styles.card}>
                    <Pressable onPress={() => onSelect(c.id)} accessibilityRole="button" style={styles.cardMain}>
                      <View style={[styles.icon, { backgroundColor: c.color }]}><EmojiIcon emoji={c.emoji} size={20} color={colors.white} /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                          {c.official && <Icon name="checkmark-circle" size={15} color={colors.brand} />}
                        </View>
                        <Text style={styles.desc} numberOfLines={2}>{c.description}</Text>
                        <Text style={styles.count}>{c.memberIds.length} membre{c.memberIds.length > 1 ? 's' : ''} · @{c.handle}</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => onToggleJoin(c)}
                      accessibilityRole="button"
                      style={[styles.joinBtn, joined ? styles.joinedBtn : { backgroundColor: c.color }]}
                    >
                      <Text style={[styles.joinText, joined ? { color: colors.textSecondary } : { color: colors.white }]}>{joined ? 'Membre' : 'Rejoindre'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  body: { paddingHorizontal: 20 },

  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.brand, borderStyle: 'dashed' },
  newBtnText: { fontSize: 15, fontWeight: '800', color: colors.brand },
  lockedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.bg },
  lockedText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text, flexShrink: 1 },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 1, lineHeight: 18 },
  count: { fontSize: 12, color: colors.textMuted, marginTop: 3, fontWeight: '600' },
  joinBtn: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  joinedBtn: { backgroundColor: colors.track },
  joinText: { fontSize: 13, fontWeight: '800' },

  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 28 },
  previewName: { fontSize: 18, fontWeight: '800', color: colors.text },
  previewSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  field: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  input: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, fontSize: 15, color: colors.text },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiCell: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  emojiCellOn: { borderColor: colors.brand, backgroundColor: colors.brand + '18' },
  emojiTxt: { fontSize: 20 },
  colorCell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  colorCellOn: { borderColor: colors.text },
  createBtn: { height: 52, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },
});
