import React from 'react';
import { StyleProp, TextProps, TextStyle } from 'react-native';
import { Text } from './Text';
import { colors, fonts } from '../../theme';

/**
 * The club's uppercase Barlow Condensed titles (design-ref/ecrans-html):
 * - display: 900 italic, big screen titles ("CHOISIS TA LANGUE", "SALUT MANEL !")
 * - section: 800, section headers ("COURS À RÉSERVER")
 * - card:    800, card titles ("ZUMBA")
 * Sizes are the mockup's; pass `size` when a screen uses a different one.
 */
export type TitleVariant = 'display' | 'section' | 'card';

const VARIANTS: Record<TitleVariant, { fontFamily: string; fontSize: number; lineHeight: number }> = {
  display: { fontFamily: fonts.display, fontSize: 44, lineHeight: 0.95 },
  section: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 1.1 },
  card: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 1 },
};

interface Props extends TextProps {
  variant?: TitleVariant;
  /** Font size in px; line height follows the variant's ratio. */
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export const Title: React.FC<Props> = ({ variant = 'section', size, color = colors.text, style, accessibilityRole = 'header', ...rest }) => {
  const v = VARIANTS[variant];
  const fontSize = size ?? v.fontSize;
  return (
    <Text
      accessibilityRole={accessibilityRole}
      {...rest}
      style={[
        {
          fontFamily: v.fontFamily,
          fontWeight: 'normal',
          fontSize,
          // a little room for the accents of uppercase French titles (É, À)
          lineHeight: Math.ceil(fontSize * Math.max(v.lineHeight, 1)),
          letterSpacing: 0,
          textTransform: 'uppercase',
          color,
        },
        style,
      ]}
    />
  );
};
