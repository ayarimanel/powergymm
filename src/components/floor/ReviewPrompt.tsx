import React from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { useBackHandler } from '../../navigation/backStack';
import { colors, ink } from '../../theme';

interface Props {
  visible: boolean;
  gymName: string;
  logoUrl?: string;
  onReview: () => void;
  onLater: () => void;
  /** Unhappy? Send them to the private report instead of Google. */
  onReport: () => void;
}

/** After a week with the app: "Tu aimes le club ? Laisse un avis Google." */
export const ReviewPrompt: React.FC<Props> = ({ visible, gymName, logoUrl, onReview, onLater, onReport }) => {
  useBackHandler(visible, onLater);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.logo}>
            {logoUrl ? <Image source={{ uri: logoUrl }} style={StyleSheet.absoluteFill} /> : <Icon name="barbell" size={26} color={colors.brandText} />}
          </View>
          <View style={styles.stars} accessibilityLabel="5 étoiles">
            {[0, 1, 2, 3, 4].map(i => (
              <Icon key={i} name="star" size={26} color={colors.gold.bar} />
            ))}
          </View>
          <Text style={styles.title} accessibilityRole="header">Une semaine chez {gymName || 'nous'} 💪</Text>
          <Text style={styles.body}>Tu aimes le club ? Ton avis Google aide d’autres sportifs à nous trouver. Ça prend 20 secondes.</Text>

          <Pressable onPress={onReview} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}>
            <Icon name="logo-google" size={18} color={colors.white} />
            <Text style={styles.primaryText}>Laisser un avis Google</Text>
          </Pressable>
          <Pressable onPress={onLater} accessibilityRole="button" style={styles.later}>
            <Text style={styles.laterText}>Plus tard</Text>
          </Pressable>
          <Pressable onPress={onReport} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.report}>Un souci au club ? Dis-le-nous d’abord</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: ink(0.55), justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 22, maxWidth: 400, width: '100%', alignSelf: 'center', alignItems: 'center', gap: 10 },
  logo: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stars: { flexDirection: 'row', gap: 4, marginTop: 4 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', height: 50, borderRadius: 25, backgroundColor: colors.brand, marginTop: 8 },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  later: { alignSelf: 'stretch', height: 44, alignItems: 'center', justifyContent: 'center' },
  laterText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  report: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textDecorationLine: 'underline' },
});
