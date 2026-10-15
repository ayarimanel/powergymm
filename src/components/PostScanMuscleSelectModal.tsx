import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from './ui/Text';
import { Icon } from './ui/Icon';
import { useBackHandler } from '../navigation/backStack';
import { MuscleGroup } from '../types/database';
import { colors, ink } from '../theme';

interface PostScanMuscleSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmMuscles: (selectedMuscles: MuscleGroup[]) => void;
}

const ALL_MUSCLES: { id: MuscleGroup; label: string; icon: string }[] = [
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
              <Text style={styles.title}>QR Code Validé !</Text>
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

                  <Icon name={item.icon as any} size={20} color={isChecked ? colors.brandText : colors.textMuted} />
                  <Text style={[styles.checkboxLabel, isChecked && styles.checkboxLabelChecked]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Submit Button */}
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>VALIDER ET OBTENIR MON STREAK</Text>
            <Icon name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: ink(0.75),
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.track,
  },
  successIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.green.soft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  scrollList: {
    marginBottom: 16,
  },
  checkboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  checkboxCardChecked: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.disabled,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  checkboxSquareChecked: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  checkboxLabelChecked: {
    color: colors.brandText,
    fontWeight: 'bold',
  },
  confirmBtn: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
