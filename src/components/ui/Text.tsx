import React, { forwardRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
  TextStyle,
} from 'react-native';
import { fonts } from '../../theme';

/**
 * The app's Text and TextInput: same API as React Native's, plus the club fonts.
 *
 * Custom fonts on native ship one family per weight, and Android drops back to the
 * system font when a custom family is combined with fontWeight. So the weight a
 * screen asks for is turned into the matching family here, once, instead of in
 * every stylesheet. Big bold titles use the club's heading font.
 */
const BODY: Record<string, string> = {
  normal: fonts.body,
  bold: fonts.bodyBold,
  '100': fonts.body,
  '200': fonts.body,
  '300': fonts.body,
  '400': fonts.body,
  '500': fonts.bodyMedium,
  '600': fonts.bodySemi,
  '700': fonts.bodyBold,
  '800': fonts.bodyHeavy,
  '900': fonts.bodyHeavy,
};

/** From this size up, a bold line is a title and gets the condensed heading font. */
const HEADING_MIN_SIZE = 22;
/** Condensed letters look smaller than Manrope at the same size: this keeps titles as big as designed. */
const HEADING_SCALE = 1.1;

export const clubFont = (style: TextProps['style']): TextStyle | null => {
  const s = (StyleSheet.flatten(style) || {}) as TextStyle;
  if (s.fontFamily) return null; // the screen chose a font on purpose
  const weight = String(s.fontWeight ?? '400');
  const size = s.fontSize ?? 14;
  const bold = weight === 'bold' || Number(weight) >= 700;
  if (bold && size >= HEADING_MIN_SIZE) {
    return {
      fontFamily: Number(weight) >= 800 || weight === 'bold' ? fonts.heading : fonts.headingSemi,
      fontWeight: 'normal',
      fontSize: Math.round(size * HEADING_SCALE),
      ...(s.lineHeight ? { lineHeight: Math.round(s.lineHeight * HEADING_SCALE) } : null),
      letterSpacing: s.letterSpacing ?? 0.2,
    };
  }
  return { fontFamily: BODY[weight] ?? fonts.body, fontWeight: 'normal' };
};

export const Text = forwardRef<RNText, TextProps>(({ style, ...rest }, ref) => (
  <RNText ref={ref} {...rest} style={[style, clubFont(style)]} />
));
Text.displayName = 'Text';

export const TextInput = forwardRef<RNTextInput, TextInputProps>(({ style, ...rest }, ref) => (
  <RNTextInput ref={ref} {...rest} style={[style, clubFont(style)]} />
));
TextInput.displayName = 'TextInput';

/** Animated.Text with the club fonts. */
export const AnimatedText = Animated.createAnimatedComponent(Text);
