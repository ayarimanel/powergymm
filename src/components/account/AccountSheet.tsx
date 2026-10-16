import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import QRCode from 'react-native-qrcode-svg';
import { Icon, IconName } from '../ui/Icon';
import { Title } from '../ui/Title';
import { Button } from '../ui/Button';
import { GenderType, SocialLinks, TrainingTimeSlot, UserProfile } from '../../types/database';
import { GymProfileConfig } from '../../config/gymConfig';
import { ClubMember, daysLeft } from '../../services/clubService';
import { NotificationService, remindersSupported } from '../../services/notificationService';
import { LANGUAGES, useT } from '../../i18n';
import { SOCIAL_NETWORKS, cleanHandle, keepUsable } from '../../community/socials';
import { PERMISSION_LABELS } from '../../services/permissionsService';
import { pickImages } from '../../services/imagePicker';
import { GENDERS, GOALS, TIMES } from '../../data/profileOptions';
import { buttonShadow, colors, fonts, isDarkMode, radius } from '../../theme';
import { saveColorMode } from '../../config/colorMode';
import { BottomSheet, SheetScrollView } from '../home/BottomSheet';
import { Avatar } from '../community/Avatar';
import { PinBoxes } from '../ui/PinBoxes';
import { LanguageScreen } from '../../screens/LanguageScreen';
import { AuthService } from '../../services/authService';

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

const sinceLabel = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return iso.slice(0, 7);
  }
};

/** One settings row (design-ref Profil): round icon, title, value or control on the right. */
const Row: React.FC<{ icon: IconName; title: string; sub?: string; value?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean }> = ({ icon, title, sub, value, right, onPress, last }) => {
  const inner = (
    <>
      <View style={styles.rowIc}>
        <Icon name={icon} size={22} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      {right}
      {onPress ? <Icon name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && { opacity: 0.7 }]}>{inner}</Pressable>
  ) : (
    <View style={[styles.row, last && styles.rowLast]}>{inner}</View>
  );
};

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
  const [modeMsg, setModeMsg] = useState<string | null>(null);
  const [darkOn, setDarkOn] = useState(isDarkMode);
  const [confirm, setConfirm] = useState<'logout' | 'wipe' | 'code' | null>(null);
  const [photoError, setPhotoError] = useState('');
  /** The profile (main) or its edit form, inside the same sheet (design-ref Profil). */
  const [view, setView] = useState<'main' | 'edit' | 'code'>('main');
  const [langOpen, setLangOpen] = useState(false);
  // Change my secret code (AuthService.changePin checks the current one first).
  const [pinNow, setPinNow] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinNew2, setPinNew2] = useState('');
  const [pinErrors, setPinErrors] = useState<Record<string, string>>({});
  const [pinBusy, setPinBusy] = useState(false);
  const [pinDone, setPinDone] = useState(false);

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
    setView('main');
    setPinDone(false);
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

  const openCode = () => {
    setPinNow('');
    setPinNew('');
    setPinNew2('');
    setPinErrors({});
    setPinDone(false);
    setView('code');
  };

  const changeCode = async () => {
    if (!user.username) return;
    if (pinNew.trim() !== pinNew2.trim()) return setPinErrors({ pinNew2: 'Les deux codes ne sont pas identiques.' });
    setPinBusy(true);
    const res = await AuthService.changePin(user.username, pinNow, pinNew);
    setPinBusy(false);
    if (!res.ok) return setPinErrors(res.error === 'Code actuel incorrect.' ? { pinNow: res.error } : { pinNew: res.error });
    setPinDone(true);
    setView('main');
  };

  /** Whole months since sign-up, for the "Mois au club" tile. */
  const monthsAtClub = (() => {
    const d = new Date(user.createdAt);
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth());
  })();

  // The phone number is the member's way back in after signing out.
  const canSignInAgain = (user.whatsappNumber ?? '').replace(/[^0-9]/g, '').length >= 8;

  const left = membership ? daysLeft(membership) : null;
  const tone = left === null ? colors.textSecondary : left < 0 ? colors.red : left <= 7 ? colors.amber : colors.green;

  const socialsSet = SOCIAL_NETWORKS.filter(n => !!(user.socials ?? {})[n.key]);
  const langLabel = LANGUAGES.find(l => l.id === lang)?.native ?? '';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.94]}
      header={
        view !== 'main' ? (
          <View style={styles.headRow}>
            <Pressable onPress={() => setView('main')} accessibilityRole="button" accessibilityLabel="Retour au profil" style={styles.headBtn}>
              <Icon name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Title variant="section" style={styles.headTitle}>{view === 'code' ? 'Mon code secret' : 'Modifier mon profil'}</Title>
            <View style={styles.headSpacer} />
          </View>
        ) : (
          <Title variant="section" style={styles.title}>{t('Profil')}</Title>
        )
      }
    >
      {() => (
        <View style={{ flex: 1 }}>
          <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {view === 'code' ? (
              <>
                <Text style={styles.codeIntro}>C’est lui qui ouvre ton compte. Ne le partage avec personne.</Text>
                <View style={styles.pinBlock}>
                  <PinBoxes label="Code actuel" value={pinNow} onChangeText={v => { setPinNow(v.replace(/[^0-9]/g, '').slice(0, 8)); setPinErrors({}); }} error={pinErrors.pinNow} accessibilityLabel="Code actuel" />
                </View>
                <View style={styles.pinBlock}>
                  <PinBoxes label="Nouveau code · 4 à 8 chiffres" value={pinNew} onChangeText={v => { setPinNew(v.replace(/[^0-9]/g, '').slice(0, 8)); setPinErrors({}); }} error={pinErrors.pinNew} accessibilityLabel="Nouveau code secret" />
                </View>
                <View style={styles.pinBlock}>
                  <PinBoxes
                    label="Confirme le nouveau code"
                    value={pinNew2}
                    onChangeText={v => { setPinNew2(v.replace(/[^0-9]/g, '').slice(0, 8)); setPinErrors({}); }}
                    slots={pinNew.length >= 4 ? pinNew.length : 6}
                    error={pinErrors.pinNew2}
                    accessibilityLabel="Confirme le nouveau code"
                  />
                </View>
                <Button label="Changer mon code" onPress={changeCode} loading={pinBusy} disabled={pinBusy || pinNow.length < 4 || pinNew.length < 4} style={{ marginTop: 28 }} />
              </>
            ) : view === 'edit' ? (
              <>
                {/* Photo */}
                <View style={styles.photoRow}>
                  <Avatar name={name || user.fullName} url={avatar} size={88} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Pressable onPress={choosePhoto} accessibilityRole="button" style={styles.outlineBtn}>
                      <Icon name="camera-outline" size={18} color={colors.text} />
                      <Text style={styles.outlineText}>{avatar ? 'Changer la photo' : 'Ajouter une photo'}</Text>
                    </Pressable>
                    {!!avatar && (
                      <Pressable onPress={() => { setAvatar(undefined); setSaved(false); }} accessibilityRole="button" style={{ height: 32, justifyContent: 'center' }}>
                        <Text style={styles.removePhoto}>Retirer la photo</Text>
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
              </>
            ) : (
              <>
                {/* Identity (design-ref Profil) */}
                <View style={styles.identity}>
                  <View style={styles.avatarRing}>
                    <Avatar name={user.fullName} url={user.avatarUrl} size={112} />
                  </View>
                  <Title variant="display" size={36} style={{ textAlign: 'center' }}>{user.fullName}</Title>
                  <Text style={styles.since}>{ROLE_LABEL[user.role]} · depuis {sinceLabel(user.createdAt)}</Text>
                  <View style={styles.socials}>
                    {socialsSet.map(n => (
                      <View key={n.key} style={styles.socialIc} accessibilityLabel={n.label}>
                        <Icon name={n.icon as IconName} size={22} color={colors.text} />
                      </View>
                    ))}
                    <Pressable onPress={() => setView('edit')} accessibilityRole="button" accessibilityLabel={t('Mes réseaux')} style={styles.socialIc}>
                      <Icon name="add" size={22} color={colors.text} />
                    </Pressable>
                  </View>
                </View>

                {/* Streak tiles */}
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={styles.statNum}>{user.visitStreak || 0}</Text>
                    <Text style={styles.statLabel}>Série en cours</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statNum}>{user.bestStreak ?? user.visitStreak ?? 0}</Text>
                    <Text style={styles.statLabel}>Record de série</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statNum}>{monthsAtClub}</Text>
                    <Text style={styles.statLabel}>Mois au club</Text>
                  </View>
                </View>

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

                {/* Settings rows */}
                <View style={styles.rows}>
                  <Row
                    icon="notifications-outline"
                    title={t('Rappels')}
                    sub={
                      reminderMsg ||
                      (remindersSupported
                        ? 'Ta série du jour, ton abonnement, un muscle oublié.'
                        : 'Disponible dans l’application mobile (pas dans le navigateur).')
                    }
                    right={<Switch value={reminders} disabled={!remindersSupported} onValueChange={toggleReminders} trackColor={{ true: colors.green.bar, false: colors.disabled }} thumbColor={colors.white} />}
                  />
                  <Row icon="language-outline" title={t('Langue')} value={langLabel} onPress={() => setLangOpen(true)} />
                  <Row
                    icon="moon"
                    title={t('Mode sombre')}
                    sub={modeMsg ?? undefined}
                    right={<Switch value={darkOn} onValueChange={on => { setDarkOn(on); saveColorMode(on ? 'dark' : 'light').then(done => { if (!done) setModeMsg('Ferme et rouvre l’app pour changer les couleurs.'); }); }} trackColor={{ true: colors.brand, false: colors.disabled }} thumbColor={colors.white} />}
                  />
                  {!!user.username && user.role !== 'owner' && (
                    <Row icon="key-outline" title="Changer mon code secret" sub={pinDone ? 'Code changé.' : undefined} onPress={openCode} />
                  )}
                  <Row icon="person-outline" title="Modifier mon profil" value="Photo, objectif…" onPress={() => setView('edit')} last />
                </View>

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
                <View style={styles.idRow}>
                  <Icon name="person-circle-outline" size={22} color={colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.idTitle}>{user.role === 'owner' ? 'Identifiant : admin' : user.username ? `Identifiant : @${user.username}` : 'Identifiant créé à la déconnexion'}</Text>
                    <Text style={styles.note}>
                      {user.role === 'owner'
                        ? 'Pour revenir : « admin » + le mot de passe admin (Paramètres du club).'
                        : canSignInAgain
                          ? 'Pour revenir : ton identifiant + ton numéro de téléphone.'
                          : 'Ajoute ton numéro WhatsApp dans « Modifier mon profil » et enregistre : sans lui, tu ne pourras pas te reconnecter.'}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => (confirm === 'logout' ? onLogout() : setConfirm('logout'))} accessibilityRole="button" style={[styles.logout, confirm === 'logout' && { backgroundColor: colors.text }]}>
                  <Icon name="log-out-outline" size={20} color={confirm === 'logout' ? colors.onInverse : colors.text} />
                  <Text style={[styles.logoutText, confirm === 'logout' && { color: colors.onInverse }]}>
                    {confirm === 'logout' ? (canSignInAgain || user.role === 'owner' ? 'Confirmer la déconnexion' : 'Se déconnecter quand même (accès perdu)') : 'Se déconnecter'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => (confirm === 'wipe' ? onWipe() : setConfirm('wipe'))} accessibilityRole="button" style={[styles.wipe, confirm === 'wipe' && styles.wipeArmed]}>
                  {confirm === 'wipe' && <Icon name="trash-outline" size={18} color={colors.white} />}
                  <Text style={[styles.wipeText, confirm === 'wipe' && { color: colors.white }]}>{confirm === 'wipe' ? 'Confirmer : tout effacer sur ce téléphone' : 'Effacer toutes mes données'}</Text>
                </Pressable>
                <Text style={[styles.note, { textAlign: 'center' }]}>Les données sont enregistrées sur ce téléphone.</Text>
              </>
            )}
          </SheetScrollView>
          <Modal visible={langOpen} animationType="slide" onRequestClose={() => setLangOpen(false)} statusBarTranslucent>
            <LanguageScreen current={lang} onPick={setLang} onClose={() => setLangOpen(false)} />
          </Modal>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { textAlign: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  headBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  headTitle: { flex: 1, textAlign: 'center', fontSize: 22 },
  headSpacer: { width: 40 },
  body: { padding: 20, paddingTop: 8, paddingBottom: 48 },

  identity: { alignItems: 'center', gap: 8 },
  avatarRing: { padding: 5, borderRadius: 999, borderWidth: 3, borderColor: colors.brand, marginBottom: 8 },
  since: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  socials: { flexDirection: 'row', gap: 10, marginTop: 6 },
  socialIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  stats: { flexDirection: 'row', gap: 12, marginTop: 22 },
  stat: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 16, borderRadius: 20, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  statNum: { fontFamily: fonts.headingBlack, fontWeight: 'normal', fontSize: 32, lineHeight: 36, color: colors.brandText },
  statLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },

  rows: { marginTop: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  rowValue: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, maxWidth: 140 },
  codeIntro: { fontSize: 15, fontWeight: '500', lineHeight: 22, color: colors.textSecondary },
  pinBlock: { marginTop: 22 },

  langRow: { flexDirection: 'row', gap: 6 },
  langBtn: { minWidth: 46, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  langBtnOn: { borderColor: colors.text, backgroundColor: colors.text },
  langText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  langTextOn: { color: colors.onInverse },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.disabled, alignSelf: 'flex-start' },
  outlineText: { fontSize: 14, fontWeight: '800', color: colors.text },
  removePhoto: { color: colors.red.text, fontWeight: '700', fontSize: 14 },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },

  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 22, marginBottom: 8 },
  input: { minHeight: 52, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 16, fontSize: 15, fontWeight: '600', color: colors.text },
  inputError: { borderColor: colors.red.bar },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 42, paddingHorizontal: 16, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: colors.onInverse },
  permChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.green.soft },
  permChipText: { fontSize: 13, fontWeight: '700', color: colors.green.text },
  error: { color: colors.red.text, fontSize: 13, fontWeight: '600', marginTop: 6 },
  saveBtn: { height: 56, borderRadius: 999, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, ...buttonShadow },
  saveText: { color: colors.white, fontSize: 15, fontWeight: '800' },

  section: { marginTop: 26 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 12 },
  memberCard: { padding: 16, borderRadius: 20 },
  memberDays: { fontSize: 22, fontWeight: '800' },
  memberSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, marginTop: 14, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },

  note: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: 8 },

  idRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 28, marginBottom: 14 },
  idTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  // The QR has to stay on white to scan: its texts are dark.
  qrBox: { alignSelf: 'center', alignItems: 'center', gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.white, marginTop: 14 },
  qrBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 190 },
  qrLogo: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  qrName: { fontSize: 15, fontWeight: '800', color: colors.onInverse, flexShrink: 1 },
  qrHint: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  codeText: { alignSelf: 'center', fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 1.5, marginTop: 10 },
  ghost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: colors.disabled, marginTop: 12 },
  ghostText: { fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center' },

  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  logoutText: { fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center' },
  wipe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: 10, borderRadius: 999, paddingHorizontal: 16 },
  wipeArmed: { backgroundColor: colors.red.bar },
  wipeText: { fontSize: 15, fontWeight: '700', color: colors.red.text, textAlign: 'center' },
});
