import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme';
import { KIND_META, KIND_ORDER, ClubStatus, ClubStatusKind } from '../../services/clubStatusService';
import { BottomSheet, SheetScrollView } from './BottomSheet';

// ---------- Owner sheet: publishes what members see in the Floor news bar ----------

interface ManageProps {
  visible: boolean;
  items: ClubStatus[];
  onClose: () => void;
  onChange: (items: ClubStatus[]) => void;
}

export const ClubStatusManageSheet: React.FC<ManageProps> = ({ visible, items, onClose, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<ClubStatusKind>('info');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const reset = () => {
    setEditingId(null);
    setKind('info');
    setTitle('');
    setMessage('');
    setWhen('');
    setPinned(false);
    setError('');
  };

  useEffect(() => {
    if (visible) {
      reset();
      setDeleting(null);
    }
  }, [visible]);

  const startEdit = (it: ClubStatus) => {
    setEditingId(it.id);
    setKind(it.kind);
    setTitle(it.title);
    setMessage(it.message);
    setWhen(it.when ?? '');
    setPinned(!!it.pinned);
    setError('');
  };

  const submit = () => {
    if (!title.trim()) {
      setError('Donne un titre à l’info.');
      return;
    }
    if (editingId) {
      onChange(items.map(i => (i.id === editingId ? { ...i, kind, title: title.trim(), message: message.trim(), when: when.trim() || undefined, pinned } : i)));
    } else {
      onChange([
        { id: 'st-' + Date.now(), kind, title: title.trim(), message: message.trim(), when: when.trim() || undefined, pinned, author: 'Gérant', createdAt: new Date().toISOString() },
        ...items,
      ]);
    }
    reset();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.94]}
      header={
        <Text style={styles.sheetTitle} accessibilityRole="header">
          Infos du club
        </Text>
      }
    >
      {() => (
        <View style={{ flex: 1 }}>
          <SheetScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{editingId ? 'Modifier l’info' : 'Nouvelle info'}</Text>

            <SheetScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }} contentInset={{ left: 20 }}>
              <View style={{ width: 12 }} />
              {KIND_ORDER.map(k => {
                const m = KIND_META[k];
                const on = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.kindChip, on && { backgroundColor: m.bg, borderColor: m.fg }]}
                  >
                    <Icon name={m.icon as any} size={16} color={on ? m.fg : colors.textSecondary} />
                    <Text style={[styles.kindChipText, on && { color: m.fg }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </SheetScrollView>

            <TextInput
              style={[styles.input, { marginTop: 14 }]}
              value={title}
              onChangeText={t => {
                setTitle(t);
                setError('');
              }}
              placeholder="Titre (ex : Iftar au club)"
              placeholderTextColor={colors.textMuted}
              maxLength={60}
            />
            <TextInput
              style={[styles.input, styles.multi]}
              value={message}
              onChangeText={setMessage}
              placeholder="Message pour les membres…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={220}
            />
            <TextInput
              style={styles.input}
              value={when}
              onChangeText={setWhen}
              placeholder="Date / heure (facultatif) : Aujourd’hui · 19:32"
              placeholderTextColor={colors.textMuted}
              maxLength={40}
            />
            <View style={styles.pinRow}>
              <Icon name="pin-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.pinLabel}>Épingler en haut</Text>
              <Switch value={pinned} onValueChange={setPinned} accessibilityLabel="Épingler en haut" />
            </View>
            {!!error &&<Text style={styles.error}>{error}</Text>}

            <View style={styles.formBtns}>
              {editingId && (
                <Pressable onPress={reset} accessibilityRole="button" style={styles.ghostBtn}>
                  <Text style={styles.ghostText}>Annuler</Text>
                </Pressable>
              )}
              <Pressable onPress={submit} accessibilityRole="button" style={styles.publishBtn}>
                <Text style={styles.publishText}>{editingId ? 'Enregistrer' : 'Publier'}</Text>
              </Pressable>
            </View>

            {items.length > 0 && <Text style={[styles.label, { marginTop: 24 }]}>Publiées ({items.length})</Text>}
            {items.map(it => {
              const m = KIND_META[it.kind];
              return (
                <View key={it.id} style={styles.manageRow}>
                  <View style={[styles.itemIcon, { backgroundColor: m.bg, width: 36, height: 36 }]}>
                    <Icon name={m.icon as any} size={18} color={m.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.manageTitle} numberOfLines={1}>
                      {it.title}
                    </Text>
                    <Text style={styles.manageSub} numberOfLines={1}>
                      {m.label}
                      {it.when ? ` · ${it.when}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => startEdit(it)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Modifier" style={styles.rowIcon}>
                    <Icon name="create-outline" size={20} color={colors.text} />
                  </Pressable>
                  {deleting === it.id ? (
                    <Pressable
                      onPress={() => {
                        onChange(items.filter(i => i.id !== it.id));
                        setDeleting(null);
                        if (editingId === it.id) reset();
                      }}
                      accessibilityRole="button"
                      style={styles.confirmDelete}
                    >
                      <Text style={styles.confirmDeleteText}>Confirmer</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => setDeleting(it.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Supprimer" style={styles.rowIcon}>
                      <Icon name="trash-outline" size={20} color={colors.red.text} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </SheetScrollView>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  itemIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginBottom: 6 },
  pinLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },

  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  form: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 10 },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  kindChipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 14, fontSize: 16, color: colors.text, marginBottom: 10 },
  multi: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  error: { color: colors.red.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ghostBtn: { height: 48, paddingHorizontal: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  // Brand blue = the one primary action
  publishBtn: { flex: 1, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: colors.white, fontSize: 16, fontWeight: '800' },

  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.track },
  manageTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  manageSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  rowIcon: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  confirmDelete: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.red.bar, justifyContent: 'center' },
  confirmDeleteText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
