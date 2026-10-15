/**
 * Catches a render crash so the app shows something human instead of a white
 * screen. Without this, one bad value anywhere ends the session for a member
 * standing at the gym door.
 *
 * "Réessayer" remounts the tree, which clears the kind of crash that comes from
 * one bad render. If it keeps failing, the member can clear the app's data —
 * that is destructive, so it asks twice and says exactly what it removes.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
// Class component: no hooks, so it reads the module-level language.
import { t } from '../i18n';

interface Props {
  children: React.ReactNode;
  /** Wipe everything and start again, offered only after a repeated crash. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
  /** Remounts the subtree. */
  attempt: number;
  crashes: number;
  confirmingReset: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0, crashes: 0, confirmingReset: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Kept in the console: there is no crash reporter wired up yet.
    console.error('Render crash', error, info.componentStack);
  }

  retry = () => {
    this.setState(s => ({ error: null, attempt: s.attempt + 1, crashes: s.crashes + 1, confirmingReset: false }));
  };

  render() {
    const { error, crashes, confirmingReset } = this.state;
    if (!error) return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.icon}>
            <Ionicons name="warning-outline" size={28} color={colors.amber.text} />
          </View>

          <Text style={styles.title}>{t('Quelque chose s’est mal passé')}</Text>
          <Text style={styles.sub}>
            L’application s’est arrêtée au mauvais moment. Tes données sont toujours là.
          </Text>

          <Pressable onPress={this.retry} accessibilityRole="button" style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
            <Text style={styles.ctaText}>{t('Réessayer')}</Text>
          </Pressable>

          {crashes >= 2 && this.props.onReset && (
            <View style={styles.resetBox}>
              <Text style={styles.resetText}>
                Ça recommence. En dernier recours tu peux repartir de zéro : cela efface ton compte, tes séances et tes
                réglages sur ce téléphone.
              </Text>
              {confirmingReset ? (
                <View style={styles.resetRow}>
                  <Pressable
                    onPress={() => this.setState({ confirmingReset: false })}
                    accessibilityRole="button"
                    style={styles.resetCancel}
                  >
                    <Text style={styles.resetCancelText}>{t('Annuler')}</Text>
                  </Pressable>
                  <Pressable onPress={this.props.onReset} accessibilityRole="button" style={styles.resetConfirm}>
                    <Text style={styles.resetConfirmText}>{t('Oui, tout effacer')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => this.setState({ confirmingReset: true })}
                  accessibilityRole="button"
                  style={styles.resetBtn}
                >
                  <Text style={styles.resetBtnText}>{t('Repartir de zéro…')}</Text>
                </Pressable>
              )}
            </View>
          )}

          {__DEV__ && <Text style={styles.detail}>{error.message}</Text>}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 10 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.amber.soft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 8 },
  sub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  cta: { marginTop: 18, minHeight: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.white, fontSize: 16, fontWeight: '800' },

  resetBox: { marginTop: 24, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 10 },
  resetText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  resetBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { color: colors.red.text, fontSize: 14, fontWeight: '700' },
  resetRow: { flexDirection: 'row', gap: 10 },
  resetCancel: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  resetCancelText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  resetConfirm: { flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: colors.red.bar, alignItems: 'center', justifyContent: 'center' },
  resetConfirmText: { color: colors.white, fontSize: 14, fontWeight: '800' },

  detail: { marginTop: 20, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
