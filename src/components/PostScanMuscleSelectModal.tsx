import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from './ui/Text';
import { Icon, IconName } from './ui/Icon';
import { Title } from './ui/Title';
import { useBackHandler } from '../navigation/backStack';
import { MuscleGroup } from '../types/database';
import { buttonShadow, colors, ink } from '../theme';

interface PostScanMuscleSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmMuscles: (selectedMuscles: MuscleGroup[]) => void;
}

const ALL_MUSCLES: { id: MuscleGroup; label: string; icon: IconName }[] = [
  { id: 'chest', label: 'Pectoraux', icon: 'barbell-outline' },
  { id: 'arms', label: 'Bras (Biceps & Triceps)', icon: 'fitness-outline' },
  { id: 'back', label: 'Dos', icon: 'body-outline' },
  { id: 'shoulders', label: 'Épaules & Trapèzes', icon: 'shield-outline' },
  { id: 'legs', label: 'Jambes & Fessiers', icon: 'walk-outline' },
  { id: 'cardio', label: 'Cardio & HIIT', icon: 'flame-outline' },
];

export const PostScanMuscleSelectModal: React.FC<PostScanMuscleSelectModalProps> = ({
  visible,
  onClose,
  onConfirmMuscles,
}) => {
  const [selectedIds, setSelectedIds] = useState<MuscleGroup[]>(['chest', 'arms']);

  const toggleMuscle = (id: MuscleGroup) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(selectedIds.filter(item => item !== id));
      }
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  useBackHandler(visible, onClose);

  const handleConfirm = () => {
    onConfirmMuscles(selectedIds);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.successIconBadge}>
              <Icon name="checkmark-circle" size={28} color={colors.green.bar} />
            </View>
            <View style={{ flex: 1 }}>
              <Title variant="section">QR Code Validé !</Title>
              <Text style={styles.subtitle}>Cochez les groupes musculaires de votre séance :</Text>
            </View>
          </View>

          {/* Checkboxes List */}
          <ScrollView style={styles.scrollList} contentContainerStyle={{ gap: 10 }}>
            {ALL_MUSCLES.map(item => {
              const isChecked = selectedIds.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.checkboxCard, isChecked && styles.checkboxCardChecked]}
                  onPress={() => toggleMuscle(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkboxSquare, isChecked && styles.checkboxSquareChecked]}>
                    {isChecked && <Icon name="checkmark" size={16} color={colors.white} />}
                  </View>

                  <Icon name={item.icon} size={20} color={isChecked ? colors.brandText : colors.textMuted} />
                  <Text style={[styles.checkboxLabel, isChecked && styles.checkboxLabelChecked]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Submit Button */}
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Valider et obtenir mon streak</Text>
            <Icon name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Bottom sheet in the new design: card surface, big top radius, flat.
  modalOverlay: { flex: 1, backgroundColor: ink(0.7), justifyContent: 'flex-end' },
  cardContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  successIconBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.green.soft, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  scrollList: { flexGrow: 0 },
  checkboxCard: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  checkboxCardChecked: { backgroundColor: colors.brandTint, borderColor: colors.brand, borderWidth: 1.5 },
  checkboxSquare: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.disabled, justifyContent: 'center', alignItems: 'center' },
  checkboxSquareChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkboxLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  checkboxLabelChecked: { color: colors.text },
  confirmBtn: { marginTop: 20, height: 56, borderRadius: 999, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...buttonShadow },
  confirmBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
