import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from './ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { GymProfileConfig } from '../config/gymConfig';
import { pickImages } from '../services/imagePicker';
import { useBackHandler } from '../navigation/backStack';
import { colors, ink } from '../theme';

interface Props {
  visible: boolean;
  config: GymProfileConfig | null;
  onClose: () => void;
  onSave: (values: AdminConfigValues) => Promise<void>;
  /** Show the owner the review window members get after a week. */
  onPreviewReview: () => void;
}

export type AdminConfigValues = Pick<
  GymProfileConfig,
  'name' | 'openingHour' | 'closingHour' | 'maxGymCapacity' | 'adminPassword' | 'classesEnabled' | 'logoUrl' | 'crowdMembersOnly' | 'crowdShowCounts' | 'membershipsInApp' | 'googleReviewUrl'
>;

/** 6 characters, no look-alikes (0/O, 1/l). */
const randomPassword = () => Array.from({ length: 6 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

/** Owner-only: club identity, hours, capacity, admin password, crowd display, reviews. */
export const AdminConfigModal: React.FC<Props> = ({ visible, config, onClose, onSave, onPreviewReview }) => {
  useBackHandler(visible, onClose);
  const [clubName, setClubName] = useState('');
  const [openH, setOpenH] = useState('6');
  const [closeH, setCloseH] = useState('22');
  const [capacity, setCapacity] = useState('80');
  const [ownerCode, setOwnerCode] = useState('');
  const [revealCode, setRevealCode] = useState(false);
  const [classesEnabled, setClassesEnabled] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [membersOnly, setMembersOnly] = useState(true);
  const [showCounts, setShowCounts] = useState(true);
  const [membershipsInApp, setMembershipsInApp] = useState(false);
  const [reviewUrl, setReviewUrl] = useState('');
  const [error, setError] = useState('');

  const pickLogo = async () => {
    try {
      const res = await pickImages({ square: true });
      if (res.error === 'denied') setError('Accès aux photos refusé. Autorise-le dans les réglages du téléphone.');
      else if (res.uris[0]) setLogoUrl(res.uris[0]);
    } catch {
      setError('Impossible d’ouvrir la galerie. Réessaie.');
    }
  };

  useEffect(() => {
    if (visible && config) {
      setError('');
      setRevealCode(false);
      setClubName(config.name);
      setOpenH(String(config.openingHour));
      setCloseH(String(config.closingHour));
      setCapacity(String(config.maxGymCapacity));
      setOwnerCode(config.adminPassword || '0000');
      setClassesEnabled(config.classesEnabled !== false);
      setLogoUrl(config.logoUrl);
      setMembersOnly(config.crowdMembersOnly !== false);
      setShowCounts(config.crowdShowCounts !== false);
      setMembershipsInApp(!!config.membershipsInApp);
      setReviewUrl(config.googleReviewUrl ?? '');
    }
  }, [visible, config]);

  const save = async () => {
    const o = parseInt(openH, 10) || 6;
    const c = parseInt(closeH, 10) || 22;
    const cap = parseInt(capacity, 10) || 80;
    if (o >= c) {
      setError('L’heure d’ouverture doit être inférieure à l’heure de fermeture.');
      return;
    }
    if (clubName.trim().length < 2) {
      setError('Donne un nom au club.');
      return;
    }
    if (ownerCode.trim().length < 4 || /\s/.test(ownerCode.trim())) {
      setError('Le mot de passe admin doit faire au moins 4 caractères, sans espace.');
      return;
    }
    const url = reviewUrl.trim();
    if (url && !/^https:\/\/\S+\.\S+/.test(url)) {
      setError('Le lien d’avis Google doit commencer par https://');
      return;
    }
    setError('');
    await onSave({
      name: clubName.trim(),
      openingHour: o,
      closingHour: c,
      maxGymCapacity: cap,
      adminPassword: ownerCode.trim(),
      classesEnabled,
      logoUrl,
      crowdMembersOnly: membersOnly,
      crowdShowCounts: showCounts,
      membershipsInApp,
      googleReviewUrl: url || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
            <Text style={styles.title}>Paramètres du club</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Logo du club</Text>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImg} /> : <Ionicons name="barbell" size={22} color={colors.brandText} />}
              </View>
              <Pressable onPress={pickLogo} accessibilityRole="button" style={styles.logoBtn}>
                <Ionicons name="image-outline" size={18} color={colors.text} />
                <Text style={styles.logoBtnText}>{logoUrl ? 'Changer le logo' : 'Ajouter le logo'}</Text>
              </Pressable>
              {!!logoUrl && (
                <Pressable onPress={() => setLogoUrl(undefined)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.remove}>Retirer</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.note}>Affiché en haut de l’app et sur le QR d’entrée : c’est l’app de ton club.</Text>

            <Text style={styles.label}>Nom du club</Text>
            <TextInput style={styles.input} value={clubName} onChangeText={setClubName} placeholder="Ex : Halter Club" placeholderTextColor={colors.textMuted} maxLength={40} />
            <Text style={styles.label}>Heure d’ouverture (0–23 h)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={openH} onChangeText={setOpenH} />
            <Text style={styles.label}>Heure de fermeture (0–23 h)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={closeH} onChangeText={setCloseH} />
            <Text style={styles.label}>Capacité maximale (membres)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={capacity} onChangeText={setCapacity} />

            <Text style={styles.label}>Mot de passe admin</Text>
            <Text style={styles.note}>Pour te connecter en gérant : identifiant « admin » + ce mot de passe. Garde-le privé.</Text>
            {ownerCode === '0000' && (
              <Text style={styles.warn}>Tu utilises encore le mot de passe par défaut (0000) : change-le.</Text>
            )}
            <View style={styles.codeRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                secureTextEntry={!revealCode}
                value={ownerCode}
                onChangeText={t => setOwnerCode(t.replace(/\s/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={32}
                accessibilityLabel="Mot de passe admin"
              />
              <Pressable onPress={() => setRevealCode(v => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={revealCode ? 'Cacher le mot de passe' : 'Afficher le mot de passe'} style={styles.iconBtn}>
                <Ionicons name={revealCode ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => { setOwnerCode(randomPassword()); setRevealCode(true); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Générer un mot de passe" style={styles.iconBtn}>
                <Ionicons name="refresh" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Cours collectifs</Text>
                <Text style={styles.note}>Désactive si ton club ne propose pas de cours (yoga, HIIT…).</Text>
              </View>
              <Switch value={classesEnabled} onValueChange={setClassesEnabled} trackColor={{ true: colors.brand, false: colors.disabled }} thumbColor={colors.white} />
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>Affluence (page Floor)</Text>
            <View style={[styles.switchRow, { marginTop: 4 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Réservée aux membres</Text>
                <Text style={styles.note}>L’affluence en direct se débloque après un premier scan du QR à l’entrée. Personne d’extérieur ne voit ta salle.</Text>
              </View>
              <Switch value={membersOnly} onValueChange={setMembersOnly} trackColor={{ true: colors.brand, false: colors.disabled }} thumbColor={colors.white} accessibilityLabel="Affluence réservée aux membres" />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Afficher le nombre de personnes</Text>
                <Text style={styles.note}>Désactivé : les membres voient seulement le niveau (calme, moyen, chargé) et le meilleur créneau.</Text>
              </View>
              <Switch value={showCounts} onValueChange={setShowCounts} trackColor={{ true: colors.brand, false: colors.disabled }} thumbColor={colors.white} accessibilityLabel="Afficher le nombre de personnes" />
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>Avis Google</Text>
            <Text style={styles.note}>Après une semaine avec l’app, les membres sont invités à laisser un avis. Ceux qui ont un souci en cours ne sont pas sollicités.</Text>
            <TextInput
              style={styles.input}
              value={reviewUrl}
              onChangeText={setReviewUrl}
              placeholder="https://g.page/r/…/review"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              accessibilityLabel="Lien d’avis Google"
            />
            <Pressable onPress={onPreviewReview} accessibilityRole="button" hitSlop={6} style={styles.previewLink}>
              <Ionicons name="eye-outline" size={16} color={colors.brand} />
              <Text style={styles.previewText}>Voir la fenêtre des membres</Text>
            </Pressable>

            <View style={[styles.switchRow, { marginTop: 20 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Suivre les abonnements dans l’app</Text>
                <Text style={styles.note}>Laisse désactivé si ton club a déjà son logiciel : les membres ne reçoivent pas d’alerte d’expiration.</Text>
              </View>
              <Switch value={membershipsInApp} onValueChange={setMembershipsInApp} trackColor={{ true: colors.brand, false: colors.disabled }} thumbColor={colors.white} accessibilityLabel="Suivre les abonnements dans l’app" />
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>
          <Pressable onPress={save} accessibilityRole="button" style={styles.saveBtn}>
            <Text style={styles.saveText}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: ink(0.55), justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, maxWidth: 480, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  scroll: { maxHeight: 440 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 12, marginBottom: 6 },
  note: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: colors.bg },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  iconBtn: { width: 44, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.red.text, fontSize: 13, fontWeight: '600', marginTop: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  logoBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 52, height: 52 },
  logoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  logoBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  remove: { fontSize: 14, fontWeight: '700', color: colors.red.text },
  warn: { fontSize: 12, fontWeight: '700', color: colors.amber.text, backgroundColor: colors.amber.soft, borderRadius: 10, padding: 8, marginBottom: 8, overflow: 'hidden' },
  previewLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10 },
  previewText: { fontSize: 14, fontWeight: '800', color: colors.brand },
  saveBtn: { backgroundColor: colors.text, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  saveText: { color: colors.onInverse, fontSize: 15, fontWeight: '800' },
});
