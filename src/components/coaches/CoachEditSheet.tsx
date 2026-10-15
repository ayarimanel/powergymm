import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { CoachProfile, TransformationItem, UserProfile } from '../../types/database';
import { fromPrice, offersPersonal } from '../../coaching/offers';
import { colors, ink } from '../../theme';
import { DAYS } from '../../services/coachService';
import { pickImages } from '../../services/imagePicker';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { Avatar } from '../community/Avatar';
import { ProductImage } from '../shop/ProductImage';

interface Props {
  visible: boolean;
  /** 'edit' = existing profile, 'new' = create (owner adds a coach, or a coach creates their own). */
  mode: 'edit' | 'new';
  coach: CoachProfile | null;
  me: UserProfile;
  isOwner: boolean;
  onClose: () => void;
  onSave: (profile: CoachProfile) => void;
  onRemove?: (coach: CoachProfile) => void;
}

const digits = (s: string) => s.replace(/[^0-9]/g, '');

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <View style={{ marginTop: 16 }}>
    <Text style={styles.label}>{label}</Text>
    {children}
    {!!error && <Text style={styles.error}>{error}</Text>}
  </View>
);

const SwitchRow: React.FC<{ title: string; sub: string; value: boolean; onChange: (v: boolean) => void; color: string }> = ({ title, sub, value, onChange, color }) => (
  <View style={styles.switchRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.switchTitle}>{title}</Text>
      <Text style={styles.switchSub}>{sub}</Text>
    </View>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: color, false: colors.disabled }} thumbColor={colors.white} />
  </View>
);

export const CoachEditSheet: React.FC<Props> = ({ visible, mode, coach, me, isOwner, onClose, onSave, onRemove }) => {
  const [avatar, setAvatar] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specInput, setSpecInput] = useState('');
  const [onFloor, setOnFloor] = useState(true);
  const [personal, setPersonal] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [hours, setHours] = useState('');
  const [phone, setPhone] = useState('');
  const [accepting, setAccepting] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Before / after client transformations
  const [transformations, setTransformations] = useState<TransformationItem[]>([]);
  const [transName, setTransName] = useState('');
  const [transBefore, setTransBefore] = useState<string | undefined>();
  const [transAfter, setTransAfter] = useState<string | undefined>();
  const [transDuration, setTransDuration] = useState('');
  const [transResult, setTransResult] = useState('');
  const [transError, setTransError] = useState('');

  const ownerAdding = mode === 'new' && isOwner; // owner adds someone else

  useEffect(() => {
    if (!visible) return;
    setAvatar(coach?.avatarUrl ?? (ownerAdding ? undefined : me.avatarUrl));
    setBanner(coach?.bannerUrl);
    setName(coach?.fullName ?? (ownerAdding ? 'Coach ' : me.fullName.toLowerCase().startsWith('coach') ? me.fullName : `Coach ${me.fullName}`));
    setHeadline(coach?.headline ?? '');
    setBio(coach?.bio ?? '');
    setYears(coach ? String(coach.yearsExperience) : '');
    setSpecialties(coach?.specialties ?? []);
    setSpecInput('');
    setOnFloor(coach?.onFloor ?? true);
    setPersonal(coach ? offersPersonal(coach) : !ownerAdding);
    setDays(coach?.availabilityDays ?? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']);
    setHours(coach?.availabilityHours ?? '');
    setPhone(coach?.contactPhone ?? (ownerAdding ? '' : me.whatsappNumber ?? ''));
    setAccepting(coach?.isAcceptingClients ?? true);
    setErrors({});
    setPhotoError('');
    setConfirmRemove(false);
    setTransformations(coach?.beforeAfterTransformations ?? []);
    setTransName('');
    setTransBefore(undefined);
    setTransAfter(undefined);
    setTransDuration('');
    setTransResult('');
    setTransError('');
  }, [visible, coach?.id]);

  const pick = async (set: (u: string) => void, square = false) => {
    setPhotoError('');
    try {
      const res = await pickImages({ square });
      if (res.error === 'denied') setPhotoError('Accès aux photos refusé. Autorise-le dans les réglages du téléphone.');
      else if (res.uris[0]) set(res.uris[0]);
    } catch {
      setPhotoError('Impossible d’ouvrir la galerie. Réessaie.');
    }
  };

  const addSpec = () => {
    const t = specInput.trim();
    if (t && !specialties.includes(t) && specialties.length < 6) setSpecialties([...specialties, t]);
    setSpecInput('');
  };

  const addTransformation = () => {
    if (transName.trim().length < 2) return setTransError('Indique le prénom du client.');
    if (!transBefore || !transAfter) return setTransError('Ajoute une photo avant et une photo après.');
    if (!transDuration.trim() || !transResult.trim()) return setTransError('Indique la durée et le résultat.');
    setTransError('');
    setTransformations([...transformations, { clientName: transName.trim(), beforeUrl: transBefore, afterUrl: transAfter, duration: transDuration.trim(), result: transResult.trim() }]);
    setTransName('');
    setTransBefore(undefined);
    setTransAfter(undefined);
    setTransDuration('');
    setTransResult('');
  };
  const removeTransformation = (i: number) => setTransformations(transformations.filter((_, idx) => idx !== i));

  const save = () => {
    const e: Record<string, string> = {};
    const y = parseInt(years, 10);
    if (name.trim().length < 3) e.name = 'Donne le nom du coach.';
    if (bio.trim().length < 20) e.bio = 'Quelques phrases de présentation (20 caractères minimum).';
    if (!(y >= 0)) e.years = 'Indique les années d’expérience.';
    if (digits(phone).length < 8) e.phone = 'Numéro invalide : il sert au contact WhatsApp et téléphone.';
    if (!onFloor && !personal) e.kind = 'Choisis au moins un rôle : coach plateau ou coaching personnel.';
    setErrors(e);
    if (Object.keys(e).length) return;

    const cleanPhone = digits(phone);
    onSave({
      id: coach?.id ?? (ownerAdding ? 'coach-' + Date.now() : 'coach-' + me.id),
      userId: coach?.userId ?? (ownerAdding ? undefined : me.id),
      status: coach?.status ?? (isOwner ? 'approved' : 'pending'),
      fullName: name.trim(),
      headline: headline.trim() || undefined,
      bio: bio.trim(),
      yearsExperience: y,
      specialties,
      onFloor,
      availabilityDays: days,
      availabilityHours: hours.trim() || undefined,
      // Plans are managed in « Mes plans »; turning personal coaching off hides them without deleting them.
      personalCoaching: personal,
      hourlyRateTnd: personal && coach ? fromPrice(coach) ?? 0 : 0,
      contactPhone: phone.trim(),
      whatsappNumber: cleanPhone,
      isAcceptingClients: accepting,
      avatarUrl: avatar,
      bannerUrl: banner,
      pricingPlans: coach?.pricingPlans,
      beforeAfterTransformations: transformations.length ? transformations : undefined,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.96]}
      header={
        <Text style={styles.title} accessibilityRole="header">
          {mode === 'new' ? (ownerAdding ? 'Ajouter un coach' : 'Créer mon profil coach') : 'Modifier le profil'}
        </Text>
      }
    >
      {() => (
        <View style={{ flex: 1 }}>
          <SheetScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {mode === 'new' && !isOwner && (
              <View style={styles.banner}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.gold.text} />
                <Text style={styles.bannerText}>Ton profil sera validé par le propriétaire du club avant d’apparaître pour les membres.</Text>
              </View>
            )}

            {/* Photos */}
            <Pressable onPress={() => pick(setBanner)} accessibilityRole="button" accessibilityLabel="Changer la couverture" style={styles.coverPick}>
              <ProductImage uri={banner} style={StyleSheet.absoluteFill as any} iconSize={32} />
              <View style={styles.coverBadge}>
                <Ionicons name="camera-outline" size={16} color={colors.white} />
                <Text style={styles.coverBadgeText}>{banner ? 'Changer la couverture' : 'Ajouter une couverture'}</Text>
              </View>
            </Pressable>
            <View style={styles.avatarRow}>
              <Avatar name={name || 'Coach'} url={avatar} size={72} />
              <Pressable onPress={() => pick(setAvatar, true)} accessibilityRole="button" style={styles.outlineBtn}>
                <Ionicons name="camera-outline" size={18} color={colors.text} />
                <Text style={styles.outlineText}>{avatar ? 'Changer la photo' : 'Ajouter la photo'}</Text>
              </Pressable>
              {!!avatar && (
                <Pressable onPress={() => setAvatar(undefined)} accessibilityRole="button" style={{ height: 44, justifyContent: 'center' }}>
                  <Text style={{ color: colors.red.text, fontWeight: '700', fontSize: 14 }}>Retirer</Text>
                </Pressable>
              )}
            </View>
            {!!photoError && <Text style={styles.error}>{photoError}</Text>}

            <Field label="Nom" error={errors.name}>
              <TextInput style={[styles.input, !!errors.name && styles.inputError]} value={name} onChangeText={setName} placeholder="Coach Anis" placeholderTextColor={colors.textMuted} />
            </Field>
            <Field label="Accroche (une ligne)">
              <TextInput style={styles.input} value={headline} onChangeText={setHeadline} placeholder="Ex : Force, hypertrophie & posture" placeholderTextColor={colors.textMuted} maxLength={60} />
            </Field>
            <Field label="À propos" error={errors.bio}>
              <TextInput style={[styles.input, styles.multi, !!errors.bio && styles.inputError]} value={bio} onChangeText={setBio} multiline placeholder="Ton parcours et comment tu aides les membres…" placeholderTextColor={colors.textMuted} maxLength={400} />
            </Field>
            <Field label="Années d’expérience" error={errors.years}>
              <TextInput style={[styles.input, !!errors.years && styles.inputError]} value={years} onChangeText={setYears} keyboardType="number-pad" placeholder="5" placeholderTextColor={colors.textMuted} />
            </Field>

            <Field label="Spécialités">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={specInput} onChangeText={setSpecInput} placeholder="Ex : Prise de masse" placeholderTextColor={colors.textMuted} onSubmitEditing={addSpec} returnKeyType="done" />
                <Pressable onPress={addSpec} accessibilityRole="button" accessibilityLabel="Ajouter" style={styles.addBtn}>
                  <Ionicons name="add" size={22} color={colors.onInverse} />
                </Pressable>
              </View>
              {specialties.length > 0 && (
                <View style={styles.tags}>
                  {specialties.map(v => (
                    <Pressable key={v} onPress={() => setSpecialties(specialties.filter(x => x !== v))} accessibilityRole="button" accessibilityLabel={`Retirer ${v}`} style={styles.tag}>
                      <Text style={styles.tagText}>{v}</Text>
                      <Ionicons name="close" size={14} color={colors.textSecondary} />
                    </Pressable>
                  ))}
                </View>
              )}
            </Field>

            {/* Role */}
            <Text style={styles.section}>Ce que tu fais au club</Text>
            <SwitchRow
              title="Coach plateau"
              sub="Tu es présent dans la salle pour surveiller les membres et les guider."
              value={onFloor}
              onChange={setOnFloor}
              color={colors.green.bar}
            />
            <SwitchRow title="Coaching personnel" sub="Tu proposes des séances privées payantes." value={personal} onChange={setPersonal} color={colors.brand} />
            {!!errors.kind && <Text style={styles.error}>{errors.kind}</Text>}
            {personal && (
              <View style={styles.offersNote}>
                <Ionicons name="pricetags-outline" size={18} color={colors.brandText} />
                <Text style={styles.offersNoteText}>
                  {coach?.pricingPlans?.length
                    ? 'Ton plan et ton prix se modifient dans « Mes plans ».'
                    : 'Après l’enregistrement, présente ton plan et fixe ton prix dans « Mes plans ».'}
                </Text>
              </View>
            )}

            {/* Presence */}
            <Text style={styles.section}>{onFloor ? 'Présence sur le plateau' : 'Disponibilités'}</Text>
            <View style={styles.daysRow}>
              {DAYS.map(d => {
                const on = days.includes(d);
                return (
                  <Pressable key={d} onPress={() => setDays(prev => (on ? prev.filter(x => x !== d) : [...prev, d]))} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.day, on && styles.dayOn]}>
                    <Text style={[styles.dayText, on && { color: colors.onInverse }]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Horaires">
              <TextInput style={styles.input} value={hours} onChangeText={setHours} placeholder="Ex : 17:00 – 21:00" placeholderTextColor={colors.textMuted} maxLength={30} />
            </Field>

            {/* Contact */}
            <Text style={styles.section}>Contact</Text>
            <Field label="Téléphone / WhatsApp" error={errors.phone}>
              <TextInput style={[styles.input, !!errors.phone && styles.inputError]} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+216 20 123 456" placeholderTextColor={colors.textMuted} />
            </Field>
            <SwitchRow title="Disponible" sub="Désactive quand ton planning est complet : la carte affichera « Complet »." value={accepting} onChange={setAccepting} color={colors.green.bar} />

            {/* Client transformations */}
            <Text style={styles.section}>Avant / après tes clients (facultatif)</Text>
            <Text style={styles.sectionSub}>Montre des résultats concrets pour convaincre un nouveau membre.</Text>

            {transformations.map((t, i) => (
              <View key={i} style={styles.transRow}>
                <View style={styles.transThumbs}>
                  <ProductImage uri={t.beforeUrl} style={styles.transThumb} iconSize={16} />
                  <ProductImage uri={t.afterUrl} style={styles.transThumb} iconSize={16} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planRowTitle}>{t.clientName}</Text>
                  <Text style={styles.planRowSub} numberOfLines={1}>
                    {t.duration} · {t.result}
                  </Text>
                </View>
                <Pressable onPress={() => removeTransformation(i)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Retirer la transformation de ${t.clientName}`} style={styles.rowIconBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.red.text} />
                </Pressable>
              </View>
            ))}

            <View style={styles.subForm}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => pick(setTransBefore, true)} accessibilityRole="button" style={styles.transPick}>
                  <ProductImage uri={transBefore} style={StyleSheet.absoluteFill as any} iconSize={20} />
                  <View style={styles.transPickLabel}>
                    <Text style={styles.transPickLabelText}>Avant</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => pick(setTransAfter, true)} accessibilityRole="button" style={styles.transPick}>
                  <ProductImage uri={transAfter} style={StyleSheet.absoluteFill as any} iconSize={20} />
                  <View style={styles.transPickLabel}>
                    <Text style={styles.transPickLabelText}>Après</Text>
                  </View>
                </Pressable>
              </View>
              <TextInput style={[styles.input, { marginTop: 10 }]} value={transName} onChangeText={setTransName} placeholder="Prénom du client" placeholderTextColor={colors.textMuted} maxLength={30} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={transDuration} onChangeText={setTransDuration} placeholder="Durée (ex : 3 mois)" placeholderTextColor={colors.textMuted} maxLength={30} />
                <TextInput style={[styles.input, { flex: 1 }]} value={transResult} onChangeText={setTransResult} placeholder="Résultat (ex : -8 kg)" placeholderTextColor={colors.textMuted} maxLength={30} />
              </View>
              {!!transError && <Text style={styles.error}>{transError}</Text>}
              <Pressable onPress={addTransformation} accessibilityRole="button" style={styles.subAddBtn}>
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={styles.subAddText}>Ajouter cette transformation</Text>
              </Pressable>
            </View>

            {isOwner && coach && onRemove && (
              <Pressable onPress={() => (confirmRemove ? onRemove(coach) : setConfirmRemove(true))} accessibilityRole="button" style={[styles.removeBtn, confirmRemove && { backgroundColor: colors.red.bar }]}>
                <Ionicons name="trash-outline" size={18} color={confirmRemove ? colors.white : colors.red.text} />
                <Text style={[styles.removeText, confirmRemove && { color: colors.white }]}>{confirmRemove ? 'Confirmer le retrait du club' : 'Retirer ce coach du club'}</Text>
              </Pressable>
            )}
          </SheetScrollView>

          <View style={styles.footer}>
            <Pressable onPress={save} accessibilityRole="button" style={styles.saveBtn}>
              <Text style={styles.saveText}>{mode === 'new' && !isOwner ? 'Envoyer pour validation' : 'Enregistrer'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  offersNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.brandSoft, borderRadius: 14, padding: 12, marginTop: 10 },
  offersNoteText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.text },
  form: { padding: 20, paddingTop: 6, paddingBottom: 32 },
  banner: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.gold.soft, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.gold.text, fontWeight: '600' },
  section: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 26, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 10 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.track },
  planRowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  planRowSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  rowIconBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  subForm: { padding: 14, borderRadius: 16, backgroundColor: colors.bg, marginTop: 10 },
  subAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.text, marginTop: 12 },
  subAddText: { fontSize: 14, fontWeight: '800', color: colors.text },
  transRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.track },
  transThumbs: { flexDirection: 'row', gap: 2, width: 64, height: 40, borderRadius: 8, overflow: 'hidden' },
  transThumb: { flex: 1, height: '100%' },
  transPick: { flex: 1, height: 100, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.track, alignItems: 'center', justifyContent: 'flex-end' },
  transPickLabel: { backgroundColor: ink(0.75), borderRadius: 10, paddingHorizontal: 10, height: 26, justifyContent: 'center', marginBottom: 8 },
  transPickLabelText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  error: { color: colors.red.text, fontSize: 13, fontWeight: '600', marginTop: 6 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  inputError: { borderColor: colors.red.bar },
  multi: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },

  coverPick: { height: 130, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.track, alignItems: 'center', justifyContent: 'flex-end' },
  coverBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ink(0.75), borderRadius: 16, paddingHorizontal: 12, height: 32, marginBottom: 10 },
  coverBadgeText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.text },
  outlineText: { fontSize: 14, fontWeight: '800', color: colors.text },

  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.track },
  tagText: { fontSize: 14, fontWeight: '600', color: colors.text },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: colors.bg },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  switchSub: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },

  daysRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  day: { flex: 1, height: 42, borderRadius: 12, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.text },
  dayText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.red.bar, marginTop: 30 },
  removeText: { fontSize: 15, fontWeight: '700', color: colors.red.text },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  // Brand blue = the one primary action
  saveBtn: { height: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
