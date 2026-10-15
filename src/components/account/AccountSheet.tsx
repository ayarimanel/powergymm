import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import QRCode from 'react-native-qrcode-svg';
import { Icon } from '../ui/Icon';
import { GenderType, SocialLinks, TrainingTimeSlot, UserProfile } from '../../types/database';
import { GymProfileConfig } from '../../config/gymConfig';
import { ClubMember, daysLeft } from '../../services/clubService';
import { NotificationService, remindersSupported } from '../../services/notificationService';
import { LANGUAGES, useT } from '../../i18n';
import { SOCIAL_NETWORKS, cleanHandle, keepUsable } from '../../community/socials';
import { PERMISSION_LABELS } from '../../services/permissionsService';
import { pickImages } from '../../services/imagePicker';
import { GENDERS, GOALS, TIMES } from '../../data/profileOptions';
import { colors, ink } from '../../theme';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { Avatar } from '../community/Avatar';

interface Props {
  visible: boolean;
  onClose: () => void;
  user: UserProfile;
  config: GymProfileConfig | null;
  membership: ClubMember | null;
  onSaveProfile: (updated: UserProfile) => void;
  onRegenerateCode: (code: string) => void;
  onLogout: () => void;
  onWipe: () => void;
}

const ROLE_LABEL = { member: 'Membre', coach: 'Coach', owner: 'Propriétaire' } as const;

const dateLabel = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  } catch {
    return iso.slice(0, 10);
  }
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

export const AccountSheet: React.FC<Props> = ({ visible, onClose, user, config, membership, onSaveProfile, onRegenerateCode, onLogout, onWipe }) => {
  const { t, lang, setLang } = useT();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<SocialLinks>({});
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<GenderType>('male');
  const [trainingTime, setTrainingTime] = useState<TrainingTimeSlot>('evening');
  const [goal, setGoal] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [reminderMsg, setReminderMsg] = useState('');
  const [confirm, setConfirm] = useState<'logout' | 'wipe' | 'code' | null>(null);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(user.fullName);
    setBio(user.bio ?? '');
    setSocials(user.socials ?? {});
    setPhone(user.whatsappNumber ?? '');
    setAvatar(user.avatarUrl);
    setAge(user.age ? String(user.age) : '');
    setGender(user.gender);
    setTrainingTime(user.usualTrainingTime);
    setGoal(user.goal);
    setErrors({});
    setSaved(false);
    setConfirm(null);
    setPhotoError('');
    setReminderMsg('');
    NotificationService.isEnabled().then(setReminders);
  }, [visible]);

  const choosePhoto = async () => {
    setPhotoError('');
    try {
      const res = await pickImages({ square: true });
      if (res.error === 'denied') setPhotoError('Accès aux photos refusé. Autorise-le dans les réglages du téléphone.');
      else if (res.uris[0]) {
        setAvatar(res.uris[0]);
        setSaved(false);
      }
    } catch {
      setPhotoError('Impossible d’ouvrir la galerie.');
    }
  };

  const save = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Écris ton prénom et ton nom.';
    const d = phone.replace(/[^0-9]/g, '');
    if (phone.trim() && d.length < 8) e.phone = 'Numéro trop court.';
    if (user.role === 'coach' && !phone.trim()) e.phone = 'Obligatoire pour les coachs.';
    else if (user.username && user.role !== 'owner' && d.length < 8) e.phone = 'Obligatoire : il sert à te connecter.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const parsedAge = parseInt(age, 10);
    onSaveProfile({
      ...user,
      fullName: name.trim(),
      bio: bio.trim() || undefined,
      // Only keep handles that are actually usable, so a half-typed one never
      // becomes a dead link on someone else's screen.
      socials: keepUsable(socials),
      whatsappNumber: phone.trim() || undefined,
      avatarUrl: avatar,
      age: parsedAge > 0 ? parsedAge : user.age,
      gender,
      usualTrainingTime: trainingTime,
      goal,
    });
    setSaved(true);
  };

  const toggleReminders = async (on: boolean) => {
    if (!on) {
      await NotificationService.disable();
      setReminders(false);
      setReminderMsg('');
      return;
    }
    const ok = await NotificationService.enable();
    setReminders(ok);
    setReminderMsg(ok ? 'Rappels activés.' : 'Autorise les notifications dans les réglages du téléphone.');
  };

  // The phone number is the member's way back in after signing out.
  const canSignInAgain = (user.whatsappNumber ?? '').replace(/[^0-9]/g, '').length >= 8;

  const left = membership ? daysLeft(membership) : null;
  const tone = left === null ? colors.textSecondary : left < 0 ? colors.red : left <= 7 ? colors.amber : colors.green;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.94]}
      header={
        <Text style={styles.title} accessibilityRole="header">
          Paramètres
        </Text>
      }
    >
      {() => (
        <View style={{ flex: 1 }}>
          <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Identity */}
            <View style={styles.identity}>
              <Avatar name={name || user.fullName} url={avatar} size={96} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{ROLE_LABEL[user.role]}</Text>
                </View>
                <Pressable onPress={choosePhoto} accessibilityRole="button" style={styles.outlineBtn}>
                  <Icon name="camera-outline" size={18} color={colors.text} />
                  <Text style={styles.outlineText}>{avatar ? 'Changer la photo' : 'Ajouter une photo'}</Text>
                </Pressable>
                {!!avatar && (
                  <Pressable onPress={() => { setAvatar(undefined); setSaved(false); }} accessibilityRole="button" style={{ height: 32, justifyContent: 'center' }}>
                    <Text style={{ color: colors.red.text, fontWeight: '700', fontSize: 14 }}>Retirer la photo</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {!!photoError && <Text style={styles.error}>{photoError}</Text>}

            <Text style={styles.label}>Prénom et nom</Text>
            <TextInput style={[styles.input, !!errors.name && styles.inputError]} value={name} onChangeText={t => { setName(t); setSaved(false); }} accessibilityLabel="Prénom et nom" />
            {!!errors.name && <Text style={styles.error}>{errors.name}</Text>}

            <Text style={styles.label}>Bio</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]} value={bio} onChangeText={t => { setBio(t.slice(0, 120)); setSaved(false); }} multiline placeholder="Ton objectif, ta devise…" placeholderTextColor={colors.textMuted} />

            {/* Optional, and shown to other members — so it says so. */}
            <Text style={styles.label}>{t('Mes réseaux')}</Text>
            <Text style={styles.note}>{t('Visibles par les autres membres quand ils ouvrent ton profil. Laisse vide pour n’en montrer aucun.')}</Text>
            {SOCIAL_NETWORKS.map(n => (
              <View key={n.key} style={styles.socialRow}>
                <Icon name={n.icon as any} size={20} color={n.color} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={socials[n.key] ?? ''}
                  onChangeText={v => {
                    // Accept a pasted profile URL or an @handle: keep the handle.
                    setSocials((s: SocialLinks) => ({ ...s, [n.key]: cleanHandle(v) }));
                    setSaved(false);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={`@${n.label.toLowerCase()}`}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={n.label}
                />
              </View>
            ))}

            <Text style={styles.label}>Numéro WhatsApp</Text>
            <TextInput style={[styles.input, !!errors.phone && styles.inputError]} value={phone} onChangeText={t => { setPhone(t); setSaved(false); }} keyboardType="phone-pad" placeholder="+216 20 123 456" placeholderTextColor={colors.textMuted} />
            {!!errors.phone && <Text style={styles.error}>{errors.phone}</Text>}

            <Text style={styles.label}>Âge</Text>
            <TextInput style={styles.input} value={age} onChangeText={t => { setAge(t.replace(/[^0-9]/g, '').slice(0, 2)); setSaved(false); }} keyboardType="number-pad" placeholder="25" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Genre</Text>
            <View style={styles.chips}>
              {GENDERS.map(g => {
                const on = gender === g.id;
                return (
                  <Pressable key={g.id} onPress={() => { setGender(g.id); setSaved(false); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{g.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Moment d’entraînement habituel</Text>
            <View style={styles.chips}>
              {TIMES.map(t => {
                const on = trainingTime === t.id;
                return (
                  <Pressable key={t.id} onPress={() => { setTrainingTime(t.id); setSaved(false); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Objectif</Text>
            <View style={styles.chips}>
              {GOALS.map(g => {
                const on = goal === g;
                return (
                  <Pressable key={g} onPress={() => { setGoal(on ? undefined : g); setSaved(false); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={save} accessibilityRole="button" style={[styles.saveBtn, saved && { backgroundColor: colors.green.bar }]}>
              <Icon name={saved ? 'checkmark-circle' : 'save-outline'} size={20} color={colors.white} />
              <Text style={styles.saveText}>{saved ? 'Enregistré' : 'Enregistrer'}</Text>
            </Pressable>

            {/* Membership */}
            {membership && left !== null && (
              <Section title="Mon abonnement">
                <View style={[styles.memberCard, { backgroundColor: tone === colors.textSecondary ? colors.bg : (tone as typeof colors.green).soft }]}>
                  <Text style={[styles.memberDays, { color: tone === colors.textSecondary ? colors.text : (tone as typeof colors.green).text }]}>
                    {left < 0 ? `Expiré depuis ${-left} j` : left === 0 ? 'Expire aujourd’hui' : `${left} jour${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}`}
                  </Text>
                  <Text style={styles.memberSub}>{left < 0 ? 'Passe à l’accueil pour le renouveler.' : `Valable jusqu’au ${dateLabel(membership.membershipEnds)}`}</Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.max(4, Math.min(100, (Math.max(0, left) / 30) * 100))}%`, backgroundColor: tone === colors.textSecondary ? colors.text : (tone as typeof colors.green).bar }]} />
                  </View>
                </View>
              </Section>
            )}

            {/* Language — changeable at any time, as the first screen promises. */}
            <Section title={t('Langue')}>
              <View style={styles.langRow}>
                {LANGUAGES.map(l => {
                  const on = lang === l.id;
                  return (
                    <Pressable
                      key={l.id}
                      onPress={() => setLang(l.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={l.native}
                      style={[styles.langBtn, on && styles.langBtnOn]}
                    >
                      <Text style={[styles.langText, on && styles.langTextOn]}>{l.native}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            {/* Reminders */}
            <Section title={t('Rappels')}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Rappels sur mon téléphone</Text>
                  <Text style={styles.switchSub}>Ta série du jour, ton abonnement, un muscle oublié.</Text>
                </View>
                <Switch value={reminders} disabled={!remindersSupported} onValueChange={toggleReminders} trackColor={{ true: colors.green.bar, false: colors.disabled }} thumbColor={colors.white} />
              </View>
              {!remindersSupported && <Text style={styles.note}>Disponible dans l’application mobile (pas dans le navigateur).</Text>}
              {!!reminderMsg && <Text style={styles.note}>{reminderMsg}</Text>}
            </Section>

            {/* Extra rights the owner granted me, if any */}
            {user.role !== 'owner' && PERMISSION_LABELS.some(p => user.permissions?.[p.key]) && (
              <Section title="Mes permissions">
                <Text style={styles.note}>Droits ponctuels donnés par le propriétaire du club, en plus de ton rôle.</Text>
                <View style={styles.chips}>
                  {PERMISSION_LABELS.filter(p => user.permissions?.[p.key]).map(p => (
                    <View key={p.key} style={styles.permChip}>
                      <Icon name="checkmark-circle" size={16} color={colors.green.text} />
                      <Text style={styles.permChipText}>{p.label}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* Owner: entrance QR */}
            {user.role === 'owner' && config && (
              <Section title="QR d’entrée du club">
                <Text style={styles.note}>Imprime ce QR code et affiche-le à l’accueil : les membres le scannent pour valider leur présence.</Text>
                <View style={styles.qrBox}>
                  <View style={styles.qrBrand}>
                    <View style={styles.qrLogo}>
                      {config.logoUrl ? <Image source={{ uri: config.logoUrl }} style={StyleSheet.absoluteFill} /> : <Icon name="barbell" size={16} color={colors.brandText} />}
                    </View>
                    <Text style={styles.qrName} numberOfLines={1}>{config.name}</Text>
                  </View>
                  <QRCode value={config.checkInCode} size={190} />
                  <Text style={styles.qrHint}>Scanne en entrant · vois quand c’est calme</Text>
                </View>
                <Text style={styles.codeText} selectable>
                  {config.checkInCode}
                </Text>
                <Pressable
                  onPress={() => {
                    if (confirm === 'code') {
                      onRegenerateCode('GYMAPP-ENTRY-' + Math.random().toString(36).slice(2, 6).toUpperCase());
                      setConfirm(null);
                    } else setConfirm('code');
                  }}
                  accessibilityRole="button"
                  style={[styles.ghost, confirm === 'code' && { backgroundColor: colors.text }]}
                >
                  <Icon name="refresh" size={18} color={confirm === 'code' ? colors.onInverse : colors.text} />
                  <Text style={[styles.ghostText, confirm === 'code' && { color: colors.onInverse }]}>{confirm === 'code' ? 'Confirmer : les anciens QR ne marcheront plus' : 'Générer un nouveau code'}</Text>
                </Pressable>
              </Section>
            )}

            {/* Account */}
            <Section title="Compte">
              <View style={styles.idRow}>
                <Icon name="person-circle-outline" size={22} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.idTitle}>{user.role === 'owner' ? 'Identifiant : admin' : user.username ? `Identifiant : @${user.username}` : 'Identifiant créé à la déconnexion'}</Text>
                  <Text style={styles.note}>
                    {user.role === 'owner'
                      ? 'Pour revenir : « admin » + le mot de passe admin (Paramètres du club).'
                      : canSignInAgain
                        ? 'Pour revenir : ton identifiant + ton numéro de téléphone.'
                        : 'Ajoute ton numéro WhatsApp ci-dessus et enregistre : sans lui, tu ne pourras pas te reconnecter.'}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => (confirm === 'logout' ? onLogout() : setConfirm('logout'))} accessibilityRole="button" style={[styles.ghost, confirm === 'logout' && { backgroundColor: colors.text }]}>
                <Icon name="log-out-outline" size={20} color={confirm === 'logout' ? colors.onInverse : colors.text} />
                <Text style={[styles.ghostText, confirm === 'logout' && { color: colors.onInverse }]}>
                  {confirm === 'logout' ? (canSignInAgain || user.role === 'owner' ? 'Confirmer la déconnexion' : 'Se déconnecter quand même (accès perdu)') : 'Se déconnecter'}
                </Text>
              </Pressable>
              <Pressable onPress={() => (confirm === 'wipe' ? onWipe() : setConfirm('wipe'))} accessibilityRole="button" style={[styles.ghost, { borderColor: colors.red.bar }, confirm === 'wipe' && { backgroundColor: colors.red.bar }]}>
                <Icon name="trash-outline" size={20} color={confirm === 'wipe' ? colors.white : colors.red.text} />
                <Text style={[styles.ghostText, { color: confirm === 'wipe' ? colors.white : colors.red.text }]}>{confirm === 'wipe' ? 'Confirmer : tout effacer sur ce téléphone' : 'Effacer toutes mes données'}</Text>
              </Pressable>
              <Text style={styles.note}>Les données sont enregistrées sur ce téléphone.</Text>
            </Section>
          </SheetScrollView>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  langRow: { flexDirection: 'row', gap: 10 },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  langBtn: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  langBtnOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  langText: { fontSize: 15, fontWeight: '700', color: colors.text },
  langTextOn: { color: colors.brandText },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  body: { padding: 20, paddingTop: 8, paddingBottom: 48 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: colors.gold.soft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  roleText: { fontSize: 13, fontWeight: '800', color: colors.gold.text },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: colors.text, alignSelf: 'flex-start' },
  outlineText: { fontSize: 14, fontWeight: '800', color: colors.text },

  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  inputError: { borderColor: colors.red.bar },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: colors.track, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.text },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: colors.onInverse },
  permChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.green.soft },
  permChipText: { fontSize: 13, fontWeight: '700', color: colors.green.text },
  error: { color: colors.red.text, fontSize: 13, fontWeight: '600', marginTop: 6 },
  // Brand blue = the one primary action
  saveBtn: { height: 52, borderRadius: 26, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '800' },

  section: { marginTop: 30 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  memberCard: { padding: 16, borderRadius: 18 },
  memberDays: { fontSize: 24, fontWeight: '900' },
  memberSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: ink(0.1), marginTop: 14, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.bg },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  switchSub: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  note: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: 8 },

  idRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  idTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  qrBox: { alignSelf: 'center', alignItems: 'center', gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginTop: 14 },
  qrBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 190 },
  qrLogo: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  qrName: { fontSize: 15, fontWeight: '800', color: colors.text, flexShrink: 1 },
  qrHint: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  codeText: { alignSelf: 'center', fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 1.5, marginTop: 10 },
  ghost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 16, borderRadius: 25, borderWidth: 1.5, borderColor: colors.border, marginTop: 12 },
  ghostText: { fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center' },
});
