/**
 * The very first thing a new member sees: French or English.
 *
 * Shown before anything else, because every screen after it is in one language
 * or the other. Both options are written in their own language, so you can read
 * yours without understanding the other.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/ui/Icon';
import { Title } from '../components/ui/Title';
import { Wordmark } from '../components/ui/Wordmark';
import { Button } from '../components/ui/Button';
import { Lang, LANGUAGES } from '../i18n';
import { colors } from '../theme';
import { haptics } from '../utils/haptics';

interface Props {
  onPick: (lang: Lang) => void;
  /** Current choice, when reopened from Settings. */
  current?: Lang;
  onClose?: () => void;
}

export const LanguageScreen: React.FC<Props> = ({ onPick, current, onClose }) => (
  <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.body} bounces={false}>
      <Wordmark />

      {/* Both languages, so nobody has to read the other one to choose. */}
      <View style={styles.head}>
        <Title variant="display" size={52}>Choisis</Title>
        <Title variant="display" size={52} color={colors.brand} accessibilityRole="none">ta langue</Title>
        <Text style={styles.titleEn}>Choose your language</Text>
      </View>

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
              <View style={[styles.code, on && styles.codeOn]}>
                <Text style={[styles.codeText, on && { color: colors.white }]}>{l.id.toUpperCase()}</Text>
              </View>
              <Text style={[styles.optionText, on && { color: colors.onInverse }]}>{l.native}</Text>
              {on ? <Icon name="checkmark" size={24} color={colors.brand} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        Tu pourras la changer à tout moment dans Paramètres.{'\n'}
        You can change it any time in Settings.
      </Text>

      {onClose ? <Button label="OK" onPress={onClose} style={styles.close} /> : null}
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 32 },
  head: { marginTop: 96 },
  titleEn: { marginTop: 14, fontSize: 15, fontWeight: '500', lineHeight: 22, color: colors.textSecondary },

  options: { gap: 14, marginTop: 40 },
  option: {
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionOn: { borderColor: colors.text, backgroundColor: colors.text },
  code: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  codeOn: { backgroundColor: colors.onInverse },
  codeText: { fontSize: 13, fontWeight: '800', color: colors.text },
  optionText: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },

  note: { marginTop: 24, fontSize: 13, fontWeight: '500', color: colors.textMuted, lineHeight: 20 },

  close: { marginTop: 'auto' },
});
