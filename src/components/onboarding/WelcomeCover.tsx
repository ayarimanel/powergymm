import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { useT } from '../../i18n';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { brandAlpha, buttonShadow, clubTheme, colors, fonts, radius } from '../../theme';

interface Props {
  onLogin: () => void;
  onSignup: () => void;
}

const FEATURES: { icon: string; label: string }[] = [
  { icon: 'pulse-outline', label: 'Affluence\nen direct' },
  { icon: 'barbell-outline', label: 'Ton journal\nde séances' },
  { icon: 'ribbon-outline', label: 'Les coachs\ndu club' },
  { icon: 'people-outline', label: 'Une vraie\ncommunauté' },
];

const nativeDriver = Platform.OS !== 'web';

/**
 * The club's cover: gym photo fading into black, the logo, the slogan, and the two
 * ways in. Always dark, whatever the device theme: it's the club's front door.
 */
export const WelcomeCover: React.FC<Props> = ({ onLogin, onSignup }) => {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  // The photo takes the top of the screen; short phones keep more room for the buttons.
  const photoHeight = Math.round(height * (height < 700 ? 0.52 : 0.6));
  const logoWidth = Math.min(200, width * 0.5);
  // Narrow phones: keep each half of the slogan on one line.
  const headlineSize = width < 380 ? { fontSize: 38, lineHeight: 40 } : null;

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? 150 : 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    }).start();
  }, [enter, reduceMotion]);
  const rise = (from: number) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : from, 0] }) }],
  });

  const [l1, l2] = clubTheme.clubSlogan.split('\n');

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.night} />

      {/* Photo + the fade that melts it into the black below */}
      <View style={[styles.photo, { height: photoHeight }]} pointerEvents="none">
        <Image source={clubTheme.login.backgroundImage} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.night} stopOpacity="0.75" />
              <Stop offset="0.28" stopColor={colors.night} stopOpacity="0.15" />
              <Stop offset="0.6" stopColor={colors.night} stopOpacity="0.35" />
              <Stop offset="1" stopColor={colors.night} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </View>

      <View style={[styles.body, { paddingTop: insets.top + 12, paddingBottom: Math.max(20, insets.bottom + 12) }]}>
        <Animated.View style={rise(-12)}>
          <Image
            source={clubTheme.logoOnDark}
            style={{ width: logoWidth, height: logoWidth / clubTheme.logoAspect }}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={clubTheme.clubName}
          />
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View style={rise(24)}>
          <Text style={[styles.headline, headlineSize]} accessibilityRole="header">
            {l1}
            {'\n'}
            <Text style={[styles.headline, headlineSize, { color: colors.brand }]}>{l2}</Text>
          </Text>
          <Text style={styles.sub}>{t('L’app de ton club : quand venir, tes séances, les coachs et les infos du club.')}</Text>
        </Animated.View>

        <Animated.View style={[styles.features, rise(32)]}>
          {FEATURES.map(f => (
            <View key={f.icon} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={22} color={colors.brand} />
              </View>
              <Text style={styles.featureText} numberOfLines={2}>
                {t(f.label)}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.actions, rise(40)]}>
          <Pressable
            onPress={onLogin}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          >
            <Text style={styles.primaryText}>{t(clubTheme.login.primaryButtonText)}</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.onBrand} style={styles.primaryArrow} />
          </Pressable>
          <Pressable
            onPress={onSignup}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
          >
            <Text style={styles.secondaryText}>{t(clubTheme.login.secondaryButtonText)}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  body: { flex: 1, paddingHorizontal: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },

  headline: {
    fontFamily: fonts.heading,
    fontSize: 44,
    lineHeight: 46,
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sub: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.78)', marginTop: 12 },

  features: { flexDirection: 'row', marginTop: 26, marginHorizontal: -6 },
  feature: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: brandAlpha(0.55),
    backgroundColor: brandAlpha(0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 15, color: colors.white, textAlign: 'center' },

  actions: { gap: 12, marginTop: 30 },
  primary: {
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...buttonShadow,
  },
  primaryPressed: { backgroundColor: colors.brandDark, transform: [{ scale: 0.98 }] },
  primaryText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: colors.onBrand },
  primaryArrow: { position: 'absolute', right: 22 },
  secondary: {
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPressed: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.white },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
});
