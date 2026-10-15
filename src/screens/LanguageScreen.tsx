/**
 * The very first thing a new member sees: French or English.
 *
 * Shown before anything else, because every screen after it is in one language
 * or the other. Both options are written in their own language, so you can read
 * yours without understanding the other.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Lang, LANGUAGES } from '../i18n';
import { colors, cardShadow } from '../theme';
import { haptics } from '../utils/haptics';

interface Props {
  onPick: (lang: Lang) => void;
  /** Current choice, when reopened from Settings. */
  current?: Lang;
  onClose?: () => void;
}

export const LanguageScreen: React.FC<Props> = ({ onPick, current, onClose }) => (
  <SafeAreaView style={styles.screen}>
    <View style={styles.body}>
      <View style={styles.badge}>
        <Ionicons name="language-outline" size={30} color={colors.brand} />
      </View>

      {/* Both languages, so nobody has to read the other one to choose. */}
      <Text style={styles.title}>Choisis ta langue</Text>
      <Text style={styles.titleEn}>Choose your language</Text>

      <View style={styles.options}>
        {LANGUAGES.map(l => {
          const on = current === l.id;
          return (
            <Pressable
              key={l.id}
              onPress={() => {
                haptics.select();
                onPick(l.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={l.native}
              style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && { opacity: 0.9 }]}
            >
              <Text style={[styles.optionText, on && { color: colors.brand }]}>{l.native}</Text>
              {on ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        Tu pourras la changer à tout moment dans Paramètres.{'\n'}
        You can change it any time in Settings.
      </Text>

      {onClose ? (
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.close}>
          <Text style={styles.closeText}>OK</Text>
        </Pressable>
      ) : null}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  titleEn: { fontSize: 18, fontWeight: '700', color: colors.textMuted, textAlign: 'center', marginBottom: 10 },

  options: { gap: 12, marginTop: 14 },
  option: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...cardShadow,
  },
  optionOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  optionText: { fontSize: 18, fontWeight: '800', color: colors.text },

  note: { marginTop: 22, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  close: { marginTop: 20, minHeight: 50, borderRadius: 25, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
