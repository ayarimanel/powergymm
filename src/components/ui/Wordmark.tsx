import React from 'react';
import { Image, StyleProp, ViewStyle } from 'react-native';
import { clubTheme, isDarkMode } from '../../theme';

/**
 * The club's logo image (assets/brand): black lettering on the light theme, white
 * lettering in dark mode or on a dark photo (`onDark`). `size` keeps the old text
 * logo's scale: the image is twice as high.
 */
export const Wordmark: React.FC<{ size?: number; style?: StyleProp<ViewStyle>; onDark?: boolean; /** One flat color for the whole logo (white on a colored band). */ tint?: string }> = ({ size = 28, style, onDark, tint }) => {
  const h = Math.round(size * 2);
  return (
    <Image
      source={onDark || isDarkMode ? clubTheme.logoOnDark : clubTheme.logo}
      style={[{ height: h, width: Math.round(h * clubTheme.logoAspect), alignSelf: 'flex-start' }, tint ? { tintColor: tint } : null, style as object]}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={clubTheme.clubName}
    />
  );
};
