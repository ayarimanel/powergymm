import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { BottomSheet } from '../home/BottomSheet';
import { canPromptNatively, isInstagramBrowser, isIos, promptInstall } from '../../floor/pwa';
import { colors } from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <View style={styles.step}>
    <View style={styles.stepNum}>
      <Text style={styles.stepNumText}>{n}</Text>
    </View>
    <Text style={styles.stepText}>{children}</Text>
  </View>
);

/** Shown once, right after the member's first successful scan. */
export const AddToHomeSheet: React.FC<Props> = ({ visible, onClose }) => {
  const insta = isInstagramBrowser();
  const ios = isIos();
  const native = canPromptNatively();

  return (
    <BottomSheet visible={visible} onClose={onClose} snaps={[0.5]}>
      {() => (
        <View style={styles.content}>
          <Text style={styles.title} accessibilityRole="header">
            Ajoute l’app à ton écran d’accueil
          </Text>
          <Text style={styles.sub}>Pour scanner plus vite à l’entrée et voir l’affluence en un coup d’œil.</Text>

          {insta ? (
            <>
              <Step n={1}>Touche ••• en haut à droite</Step>
              <Step n={2}>Choisis « Ouvrir dans {ios ? 'Safari' : 'Chrome'} »</Step>
              <Step n={3}>Puis ajoute l’app depuis {ios ? 'Safari' : 'Chrome'}</Step>
            </>
          ) : ios ? (
            <>
              <Step n={1}>
                Touche <Icon name="share-outline" size={15} color={colors.text} /> Partager en bas de Safari
              </Step>
              <Step n={2}>Choisis « Sur l’écran d’accueil »</Step>
              <Step n={3}>Touche « Ajouter »</Step>
            </>
          ) : native ? (
            <Pressable
              onPress={async () => {
                await promptInstall();
                onClose();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
            >
              <Icon name="download-outline" size={18} color={colors.white} />
              <Text style={styles.primaryText}>Installer l’app</Text>
            </Pressable>
          ) : (
            <>
              <Step n={1}>Touche ⋮ en haut à droite de Chrome</Step>
              <Step n={2}>Choisis « Ajouter à l’écran d’accueil »</Step>
            </>
          )}

          <Pressable onPress={onClose} accessibilityRole="button" style={styles.later}>
            <Text style={styles.laterText}>Plus tard</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 14, fontWeight: '800', color: colors.text },
  stepText: { flex: 1, fontSize: 15, color: colors.text },
  primary: { height: 50, borderRadius: 25, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  later: { alignSelf: 'center', padding: 10 },
  laterText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
