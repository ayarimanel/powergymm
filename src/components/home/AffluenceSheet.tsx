import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, SheetScrollView } from './BottomSheet';
import { Title } from '../ui/Title';

/**
 * "Voir l'affluence": the full crowd view (days, hourly chart, muscle by muscle) that
 * used to sit on Accueil, unchanged, in a sheet. The caller passes the same card it
 * used to render inline.
 */
export const AffluenceSheet: React.FC<{ visible: boolean; onClose: () => void; children: React.ReactNode }> = ({ visible, onClose, children }) => (
  <BottomSheet
    visible={visible}
    onClose={onClose}
    snaps={[0.92]}
    header={<Title variant="section">Affluence</Title>}
  >
    {(_expanded, extraBottom) => (
      <SheetScrollView contentContainerStyle={[s.content, { paddingBottom: 32 + extraBottom }]}>
        <View>{children}</View>
      </SheetScrollView>
    )}
  </BottomSheet>
);

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4 },
});
