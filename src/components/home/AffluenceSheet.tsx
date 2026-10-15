import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Title } from '../ui/Title';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme';
import { useBackHandler } from '../../navigation/backStack';
import { useReduceMotion } from '../../hooks/useDeviceState';

/**
 * "Voir l'affluence": the full crowd view (days, hourly chart, muscle by muscle) as a
 * page (design-ref Affluence): back on the left, the alert bell on the right.
 * The caller passes the same crowd card it used to render on Accueil.
 */
interface Props {
  visible: boolean;
  onClose: () => void;
  /** The "M'alerter si calme" switch, in the header (same toggle as on Accueil). */
  alertOn: boolean;
  onToggleAlert: () => void;
  /** Hidden while the club is closed, as on Accueil. */
  showAlert: boolean;
  children: React.ReactNode;
}

export const AffluenceSheet: React.FC<Props> = ({ visible, onClose, alertOn, onToggleAlert, showAlert, children }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  useBackHandler(visible, onClose);

  return (
    <Modal visible={visible} animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.page, { paddingTop: insets.top + 8 }]}>
        <View style={s.top}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Retour" style={s.round}>
            <Icon name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Title variant="section" style={s.title}>Affluence</Title>
          {showAlert ? (
            <Pressable
              onPress={onToggleAlert}
              accessibilityRole="switch"
              accessibilityState={{ checked: alertOn }}
              accessibilityLabel="M'alerter si calme"
              style={[s.round, alertOn && s.roundOn]}
            >
              <Icon name={alertOn ? 'notifications' : 'notifications-outline'} size={22} color={alertOn ? colors.green.text : colors.text} />
            </Pressable>
          ) : (
            <View style={s.spacer} />
          )}
        </View>

        <ScrollView contentContainerStyle={[s.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  roundOn: { backgroundColor: colors.green.soft },
  spacer: { width: 44 },
  title: { flex: 1, textAlign: 'center', fontSize: 22 },
  content: { paddingHorizontal: 20, paddingTop: 12 },
});
