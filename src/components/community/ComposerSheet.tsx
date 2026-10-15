import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { PostCategory } from '../../types/database';
import { Community } from '../../services/communitiesService';
import { colors, ink } from '../../theme';
import { pickImages } from '../../services/imagePicker';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { ProductImage } from '../shop/ProductImage';

export interface PostDraft {
  category: PostCategory;
  caption: string;
  images: string[];
  communityId: string;
  pr?: { exercise: string; weightKg: number; reps: number };
}

interface Props {
  visible: boolean;
  initialCategory?: PostCategory;
  communities: Community[]; // circles the member can post to
  initialCommunityId: string;
  onClose: () => void;
  onPublish: (draft: PostDraft) => void;
}

const MAX_PHOTOS = 4;

const TYPES: { id: PostCategory; label: string; icon: string; hint: string }[] = [
  { id: 'workout', label: 'Séance', icon: 'barbell-outline', hint: 'Partage ta séance en photos' },
  { id: 'meal', label: 'Repas', icon: 'nutrition-outline', hint: 'Montre ton repas de récupération' },
  { id: 'question', label: 'Question', icon: 'help-circle-outline', hint: 'Demande de l’aide ou un partenaire' },
  { id: 'pr', label: 'Record', icon: 'trophy-outline', hint: 'Un coach validera ton record' },
  { id: 'chat', label: 'Message', icon: 'chatbubble-ellipses-outline', hint: 'Dis quelque chose aux membres' },
];

const PLACEHOLDER: Record<PostCategory, string> = {
  workout: 'Raconte ta séance…',
  meal: 'Quel est ton repas ? (ajoute les protéines si tu veux)',
  question: 'Pose ta question aux membres et aux coachs…',
  pr: 'Un mot sur ce record (facultatif)…',
  chat: 'Partage quelque chose avec les membres…',
};

const QUESTION_STARTERS = [
  'Je cherche un partenaire pour ',
  'Un conseil pour améliorer ',
  'Quelqu’un connaît un bon programme pour ',
  'Comment corriger ma technique sur ',
];

const showsPhotos = (c: PostCategory) => c !== 'chat';

export const ComposerSheet: React.FC<Props> = ({ visible, initialCategory = 'workout', communities, initialCommunityId, onClose, onPublish }) => {
  const [category, setCategory] = useState<PostCategory>(initialCategory);
  const [communityId, setCommunityId] = useState(initialCommunityId);
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCategory(initialCategory);
      setCommunityId(initialCommunityId);
      setCaption('');
      setImages([]);
      setExercise('');
      setWeight('');
      setReps('');
      setError('');
    }
  }, [visible, initialCategory, initialCommunityId]);

  const addPhotos = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await pickImages({ multiple: true, max: MAX_PHOTOS - images.length });
      if (res.error === 'denied') setError('Accès aux photos refusé. Autorise-le dans les réglages de ton téléphone.');
      else if (res.uris.length) setImages(prev => [...prev, ...res.uris].slice(0, MAX_PHOTOS));
    } catch {
      setError('Impossible d’ouvrir la galerie. Réessaie.');
    }
    setBusy(false);
  };

  const publish = () => {
    if (category === 'pr') {
      const w = parseFloat(weight.replace(',', '.'));
      const r = parseInt(reps, 10);
      if (!exercise.trim() || !(w > 0) || !(r > 0)) {
        setError('Renseigne l’exercice, la charge et le nombre de répétitions.');
        return;
      }
      onPublish({ category, caption: caption.trim(), images, communityId, pr: { exercise: exercise.trim(), weightKg: w, reps: r } });
      return;
    }
    if ((category === 'workout' || category === 'meal') && images.length === 0 && !caption.trim()) {
      setError('Ajoute au moins une photo ou un texte.');
      return;
    }
    if (!caption.trim() && images.length === 0) {
      setError('Écris quelque chose avant de publier.');
      return;
    }
    onPublish({ category, caption: caption.trim(), images, communityId });
  };

  const current = TYPES.find(t => t.id === category)!;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.94]}
      header={
        <Text style={styles.title} accessibilityRole="header">
          Nouvelle publication
        </Text>
      }
    >
      {() => (
        <View style={{ flex: 1 }}>
          <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            {/* Community (where does this post go?) */}
            {communities.length > 0 && (
              <>
                <Text style={styles.pickLabel}>Publier dans</Text>
                <SheetScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circles} style={{ marginHorizontal: -20 }}>
                  {communities.map(c => {
                    const on = communityId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setCommunityId(c.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={[styles.circle, on && { backgroundColor: c.color, borderColor: c.color }]}
                      >
                        <Text style={styles.circleEmoji}>{c.emoji}</Text>
                        <Text style={[styles.circleText, on && { color: colors.white }]}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </SheetScrollView>
              </>
            )}

            {/* Type */}
            <SheetScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.types} style={{ marginHorizontal: -20 }}>
              {TYPES.map(t => {
                const on = category === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      setCategory(t.id);
                      setError('');
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.type, on && (t.id === 'pr' ? styles.typeOnGold : styles.typeOn)]}
                  >
                    <Icon name={t.icon as any} size={18} color={on ? (t.id === 'pr' ? colors.gold.ink : colors.onInverse) : colors.textSecondary} />
                    <Text style={[styles.typeText, on && { color: t.id === 'pr' ? colors.gold.ink : colors.onInverse }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </SheetScrollView>
            <Text style={styles.hint}>{current.hint}</Text>

            {/* PR fields */}
            {category === 'pr' && (
              <View style={styles.prBox}>
                <Text style={styles.label}>Exercice</Text>
                <TextInput style={styles.input} value={exercise} onChangeText={setExercise} placeholder="Ex : Développé couché" placeholderTextColor={colors.textMuted} />
                <View style={styles.twoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Charge (kg)</Text>
                    <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="100" placeholderTextColor={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Répétitions</Text>
                    <TextInput style={styles.input} value={reps} onChangeText={setReps} keyboardType="number-pad" placeholder="5" placeholderTextColor={colors.textMuted} />
                  </View>
                </View>
                <View style={styles.note}>
                  <Icon name="shield-checkmark-outline" size={18} color={colors.gold.text} />
                  <Text style={styles.noteText}>
                    Un coach validera ton record et il recevra le badge doré. Ajoute une photo comme preuve pour être validé plus vite.
                  </Text>
                </View>
              </View>
            )}

            {/* Question starters */}
            {category === 'question' && (
              <SheetScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 10 }}>
                {QUESTION_STARTERS.map(s => (
                  <Pressable key={s} onPress={() => setCaption(prev => (prev ? prev : s))} accessibilityRole="button" style={styles.starter}>
                    <Text style={styles.starterText}>{s.trim()}…</Text>
                  </Pressable>
                ))}
              </SheetScrollView>
            )}

            {/* Caption */}
            <TextInput
              style={[styles.input, styles.caption]}
              value={caption}
              onChangeText={t => {
                setCaption(t);
                setError('');
              }}
              placeholder={PLACEHOLDER[category]}
              placeholderTextColor={colors.textMuted}
              multiline
              accessibilityLabel="Texte de la publication"
            />

            {/* Photos */}
            {showsPhotos(category) && (
              <>
                <Text style={styles.label}>
                  {category === 'pr' ? 'Preuve du record (facultatif)' : 'Photos'} · {images.length}/{MAX_PHOTOS}
                </Text>
                <SheetScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {images.map((u, i) => (
                    <View key={i} style={styles.thumbWrap}>
                      <ProductImage uri={u} style={styles.thumb} iconSize={20} />
                      <Pressable
                        onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Retirer cette photo"
                        style={styles.thumbX}
                      >
                        <Icon name="close" size={14} color={colors.white} />
                      </Pressable>
                    </View>
                  ))}
                  {images.length < MAX_PHOTOS && (
                    <Pressable onPress={addPhotos} disabled={busy} accessibilityRole="button" accessibilityLabel="Ajouter des photos" style={styles.addPhoto}>
                      <Icon name="camera-outline" size={26} color={colors.textSecondary} />
                      <Text style={styles.addPhotoText}>{busy ? '…' : 'Ajouter'}</Text>
                    </Pressable>
                  )}
                </SheetScrollView>
              </>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}
          </SheetScrollView>

          <View style={styles.footer}>
            <Pressable onPress={publish} accessibilityRole="button" style={styles.publishBtn}>
              <Icon name={category === 'pr' ? 'trophy' : 'send'} size={18} color={colors.white} />
              <Text style={styles.publishText}>{category === 'pr' ? 'Envoyer pour validation' : 'Publier'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  form: { padding: 20, paddingTop: 8, paddingBottom: 24 },
  pickLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  circles: { paddingHorizontal: 20, gap: 8 },
  circle: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  circleEmoji: { fontSize: 15 },
  circleText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  types: { paddingHorizontal: 20, gap: 8 },
  type: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.track },
  typeOn: { backgroundColor: colors.text },
  typeOnGold: { backgroundColor: colors.gold.bar },
  typeText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  hint: { fontSize: 14, color: colors.textMuted, marginTop: 10, marginBottom: 12 },

  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginTop: 14, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  caption: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  twoCols: { flexDirection: 'row', gap: 12 },
  prBox: { backgroundColor: colors.gold.bg, borderWidth: 1, borderColor: colors.gold.border, padding: 14, borderRadius: 16, marginBottom: 12 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12 },
  noteText: { flex: 1, fontSize: 13, color: colors.gold.text, lineHeight: 18, fontWeight: '600' },
  starter: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.brandSoft, justifyContent: 'center' },
  starterText: { fontSize: 13, fontWeight: '700', color: colors.brandText },

  thumbWrap: { width: 96, height: 96 },
  thumb: { width: 96, height: 96, borderRadius: 14 },
  thumbX: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: ink(0.75), alignItems: 'center', justifyContent: 'center' },
  addPhoto: { width: 96, height: 96, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.disabled, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addPhotoText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  error: { color: colors.red.text, fontSize: 14, fontWeight: '600', marginTop: 14 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  // Brand blue = the one primary action
  publishBtn: { height: 52, borderRadius: 26, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  publishText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
