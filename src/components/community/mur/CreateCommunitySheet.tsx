/**
 * Creating a community. Until now this was a toast describing a form that did
 * not exist.
 *
 * Whoever fills this in becomes the founder: the rank cannot be taken from him
 * by an admin, and he has to hand it over before he can leave.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Community } from '../../../community/murService';
import { CommunityType } from '../../../community/permissions';
import { CommunityColor, colors, communityTint } from '../../../theme';
import { BottomSheet, SheetScrollView } from '../../home/BottomSheet';
import { haptics } from '../../../utils/haptics';
import { useT } from '../../../i18n';

const TYPES: { id: CommunityType; label: string; sub: string }[] = [
  { id: 'open', label: 'Ouverte', sub: 'Tout le monde peut rejoindre sans demander' },
  { id: 'request', label: 'Sur demande', sub: 'Tu acceptes ou refuses chaque arrivée' },
  { id: 'invite', label: 'Sur invitation', sub: 'Invisible : seuls les invités la voient' },
];

const COLORS: CommunityColor[] = ['teal', 'calm', 'pink', 'gold', 'violet', 'mid', 'accent'];

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase() || '?';

const slugOf = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

interface Props {
  visible: boolean;
  /** Ids already taken, so two communities never collide. */
  takenIds: string[];
  founderId: string;
  /** Shown as the community's admin ("Demande envoyée à …"). Display only. */
  founderName: string;
  onClose: () => void;
  onCreate: (c: Community) => void;
}

export const CreateCommunitySheet: React.FC<Props> = ({ visible, takenIds, founderId, founderName, onClose, onCreate }) => {
  const { t } = useT();
  const [name, setName] = useState('');
  const [type, setType] = useState<CommunityType>('open');
  const [womenOnly, setWomenOnly] = useState(false);
  const [desc, setDesc] = useState('');
  const [rules, setRules] = useState('');
  const [color, setColor] = useState<CommunityColor>('teal');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setType('open');
    setWomenOnly(false);
    setDesc('');
    setRules('');
    setColor('teal');
    setError(null);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError('Donne-lui un nom (2 caractères minimum).');

    let id = slugOf(trimmed);
    if (!id) return setError('Ce nom ne donne pas d’identifiant valable.');
    if (takenIds.includes(id)) {
      // Rather than refusing a perfectly good name, make it unique.
      let n = 2;
      while (takenIds.includes(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }

    haptics.success();
    onCreate({
      id,
      name: trimmed,
      ini: initialsOf(trimmed),
      color,
      type,
      womenOnly: womenOnly || undefined,
      members: 1, // the founder
      today: 0,
      desc: desc.trim(),
      rules: rules
        .split('\n')
        .map(r => r.trim())
        .filter(Boolean)
        .slice(0, 8),
      adminNames: [founderName],
      modNames: [],
      adminIds: [],
      modIds: [],
      memberIds: [founderId],
      createdBy: founderId,
      createdAt: new Date().toISOString(),
      bans: [],
    });
    reset();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snaps={[0.75, 0.95]}
      initialSnap={0}
      header={<Text style={styles.title}>{t('Nouvelle communauté')}</Text>}
    >
      {(_e, extraBottom) => (
      <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: 32 + extraBottom }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>{t('Nom')}</Text>
        <TextInput
          value={name}
          onChangeText={t => {
            setName(t);
            setError(null);
          }}
          placeholder="Powerlifting, Matinaux 6h…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={40}
          accessibilityLabel="Nom de la communauté"
        />

        <Text style={styles.label}>{t('Qui peut entrer ?')}</Text>
        {TYPES.map(t => {
          const on = type === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                haptics.select();
                setType(t.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.option, on && styles.optionOn]}
            >
              <Ionicons
                name={on ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={on ? colors.brand : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, on && { color: colors.brand }]}>{t.label}</Text>
                <Text style={styles.optionSub}>{t.sub}</Text>
              </View>
            </Pressable>
          );
        })}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('Réservée aux femmes')}</Text>
            <Text style={styles.optionSub}>{t('Seules les membres femmes pourront demander à entrer.')}</Text>
          </View>
          <Switch
            value={womenOnly}
            onValueChange={setWomenOnly}
            trackColor={{ true: colors.green.bar, false: colors.disabled }}
            thumbColor={colors.white}
          />
        </View>

        <Text style={styles.label}>{t('Couleur')}</Text>
        <View style={styles.colors}>
          {COLORS.map(c => {
            const t = communityTint(c);
            const on = color === c;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  haptics.select();
                  setColor(c);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Couleur ${c}`}
                accessibilityState={{ selected: on }}
                style={[styles.swatch, { backgroundColor: t.bar }, on && styles.swatchOn]}
              >
                {on ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t('Description')}</Text>
        <TextInput
          value={desc}
          onChangeText={setDesc}
          placeholder="À quoi sert cette communauté ?"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.multiline]}
          multiline
          maxLength={200}
          accessibilityLabel="Description"
        />

        <Text style={styles.label}>{t('Règles · une par ligne')}</Text>
        <TextInput
          value={rules}
          onChangeText={setRules}
          placeholder={'Pas de pub ni de vente\nRespect de tous les niveaux'}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.multiline]}
          multiline
          maxLength={400}
          accessibilityLabel="Règles"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.note}>
          Tu en seras le fondateur : personne ne pourra te retirer, et tu devras la transmettre avant de la quitter.
        </Text>

        <Pressable onPress={submit} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
          <Text style={styles.primaryText}>{t('Créer la communauté')}</Text>
        </Pressable>
      </SheetScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: colors.text, paddingHorizontal: 16, paddingTop: 4 },
  body: { padding: 16, gap: 6 },
  label: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginTop: 14 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },

  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, marginTop: 8 },
  optionOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  optionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },

  colors: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: colors.text },

  error: { marginTop: 12, color: colors.red.text, fontSize: 14, fontWeight: '700' },
  note: { marginTop: 16, fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  primary: { marginTop: 16, minHeight: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
