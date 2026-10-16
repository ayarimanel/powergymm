import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Icon, IconName } from '../ui/Icon';
import { Text } from '../ui/Text';
import { useT } from '../../i18n';
import { useReduceMotion } from '../../hooks/useDeviceState';
import { Button } from '../ui/Button';
import { Wordmark } from '../ui/Wordmark';
import { clubTheme, colors, fonts, light } from '../../theme';

interface Props {
  onLogin: () => void;
  onSignup: () => void;
}

const FEATURES: { icon: IconName; label: string }[] = [
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

  // Narrow or short phones: a smaller slogan keeps room for the buttons.
  const headlineSize = width < 380 || height < 700 ? { fontSize: 44, lineHeight: 42 } : null;

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

      {/* Full-screen photo + the fade that melts it into the black below (design-ref Bienvenue) */}
      <View style={styles.photo} pointerEvents="none">
        <Image source={clubTheme.login.backgroundImage} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.night} stopOpacity="0.55" />
              <Stop offset="0.18" stopColor={colors.night} stopOpacity="0" />
              <Stop offset="0.38" stopColor={colors.night} stopOpacity="0" />
              <Stop offset="0.58" stopColor={colors.night} stopOpacity="0.75" />
              <Stop offset="0.74" stopColor={colors.night} stopOpacity="0.96" />
              <Stop offset="1" stopColor={colors.night} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </View>

      <View style={[styles.body, { paddingTop: insets.top + 36, paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <Animated.View style={rise(-12)}>
          <Wordmark onDark />
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
                <Icon name={f.icon} size={18} color={colors.onBrand} />
              </View>
              <Text style={styles.featureText} numberOfLines={2}>
                {t(f.label)}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.actions, rise(40)]}>
          <Button label={t(clubTheme.login.primaryButtonText)} onPress={onLogin} icon="arrow-forward" />
          <Button label={t(clubTheme.login.secondaryButtonText)} onPress={onSignup} variant="secondary" />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  body: { flex: 1, paddingHorizontal: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },

  headline: {
    fontFamily: fonts.display,
    fontWeight: 'normal',
    fontSize: 54,
    lineHeight: 52,
    color: colors.text,
    textTransform: 'uppercase',
  },
  sub: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginTop: 16 },

  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  feature: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: light(0.07),
    borderWidth: 1,
    borderColor: light(0.1),
  },
  featureIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, color: colors.text },

  actions: { gap: 14, marginTop: 24 },
});
