import React, { useState } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../theme';

/** Product photo with a neutral placeholder when there is no URL or it fails to load. */
export const ProductImage: React.FC<{ uri?: string; style?: StyleProp<ViewStyle>; iconSize?: number }> = ({
  uri,
  style,
  iconSize = 32,
}) => {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.box, style]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <Icon name="image-outline" size={iconSize} color={colors.textMuted} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
