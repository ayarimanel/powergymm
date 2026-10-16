import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { Text, TextInput } from './ui/Text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Icon } from './ui/Icon';
import { useBackHandler } from '../navigation/backStack';
import { useReduceMotion } from '../hooks/useDeviceState';
import { buttonShadow, colors, ink, isDarkMode, light, radius } from '../theme';
import { Title } from './ui/Title';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: () => void;
  /** The text encoded in the club's entrance QR. */
  expectedCode: string;
}

type ScanState = 'scanning' | 'success' | 'invalid';

const FRAME = 264;
const MORPH_MS = 200;
const SUCCESS_HOLD_MS = 450;

/** Real check-in: scans the QR at the club entrance. If the camera is unavailable the member can type the code. */
export const QrScannerModal: React.FC<QrScannerModalProps> = ({ visible, onClose, onScanSuccess, expectedCode }) => {
  const reduceMotion = useReduceMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>('scanning');
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState('');
  const locked = useRef(false);

  const scanLine = useRef(new Animated.Value(0)).current;
  const morph = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;

  const cameraDenied = !!permission && !permission.granted && !permission.canAskAgain;
  const cameraReady = !!permission?.granted && !manual;

  const succeed = useCallback(() => {
    if (locked.current) return;
    locked.current = true;
    setState('success');
    Vibration.vibrate(40);
    Animated.parallel([
      Animated.timing(morph, { toValue: 1, duration: reduceMotion ? 0 : MORPH_MS, useNativeDriver: false }),
      Animated.spring(check, { toValue: 1, damping: 12, stiffness: 240, useNativeDriver: true }),
    ]).start();
    setTimeout(onScanSuccess, SUCCESS_HOLD_MS);
  }, [morph, check, onScanSuccess, reduceMotion]);

  const handleCode = useCallback(
    (raw: string) => {
      if (locked.current) return;
      if (raw.trim() === expectedCode) succeed();
      else {
        locked.current = true;
        setState('invalid');
        Vibration.vibrate([0, 30, 60, 30]);
      }
    },
    [expectedCode, succeed]
  );

  // Reset every time the scanner opens
  useEffect(() => {
    if (visible) {
      locked.current = false;
      setState('scanning');
      setTorch(false);
      setManual(false);
      setTyped('');
      morph.setValue(0);
      check.setValue(0);
      if (permission && !permission.granted && permission.canAskAgain) requestPermission();
    }
  }, [visible]);

  // Ask for the camera once the permission status has loaded (it is often still null when the scanner opens).
  const asked = useRef(false);
  useEffect(() => {
    if (!visible) { asked.current = false; return; }
    if (asked.current || !permission || permission.granted || !permission.canAskAgain) return;
    asked.current = true;
    requestPermission();
  }, [visible, permission, requestPermission]);

  // Scan line
  useEffect(() => {
    if (!visible || state !== 'scanning' || reduceMotion || !cameraReady) return;
    scanLine.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, state, cameraReady, scanLine, reduceMotion]);

  const retry = () => {
    locked.current = false;
    setTyped('');
    setState('scanning');
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  };

  useBackHandler(visible, onClose);

  const frameColor = morph.interpolate({ inputRange: [0, 1], outputRange: [colors.brand, colors.green.bar] });
  const frameBg = morph.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0)', 'rgba(34,197,94,0.18)'] });
  const translateY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [14, FRAME - 18] });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        {/* Live camera behind everything */}
        {cameraReady && state === 'scanning' && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handleCode(data)}
          />
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: cameraReady && state === 'scanning' ? (isDarkMode ? ink(0.35) : light(0.4)) : 'transparent' }]} />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer le scanner" style={styles.roundBtn}>
            <Icon name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.topTitle} accessibilityRole="header" accessibilityLabel="Valider ma présence">CHECK-IN</Text>
          {cameraReady ? (
            <Pressable onPress={() => setTorch(t => !t)} accessibilityRole="switch" accessibilityState={{ checked: torch }} accessibilityLabel="Lampe torche" style={[styles.roundBtn, torch && styles.roundBtnOn]}>
              <Icon name={torch ? 'flashlight' : 'flashlight-outline'} size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.roundSpacer} />
          )}
        </View>

        {/* Centre */}
        <View style={styles.center}>
          {manual ? (
            <View style={styles.manualBox}>
              <Text style={styles.manualTitle}>Saisir le code du club</Text>
              <Text style={styles.manualSub}>Tu le trouves sous le QR code à l’accueil.</Text>
              <TextInput
                style={styles.manualInput}
                value={typed}
                onChangeText={t => {
                  setTyped(t);
                  if (state === 'invalid') retry();
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="CODE"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Code du club"
              />
              {state === 'invalid' && <Text style={styles.errorInline}>Code invalide. Vérifie et réessaie.</Text>}
              {state === 'success' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <Icon name="checkmark" size={16} color={colors.green.text} />
                  <Text style={[styles.errorInline, { color: colors.green.text, marginTop: 0 }]}>Présence validée</Text>
                </View>
              )}
              <Pressable onPress={() => handleCode(typed)} accessibilityRole="button" style={styles.validate}>
                <Text style={styles.validateText}>Valider</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Title variant="display" size={40} style={styles.bigTitle}>Scanne le QR{'\n'}à l’entrée</Title>
              <Animated.View style={[styles.frame, { backgroundColor: frameBg }]}>
                {/* Four corner brackets (design-ref Scan): red while scanning, green once validated */}
                <Animated.View pointerEvents="none" style={[styles.corner, styles.cTL, { borderColor: frameColor }]} />
                <Animated.View pointerEvents="none" style={[styles.corner, styles.cTR, { borderColor: frameColor }]} />
                <Animated.View pointerEvents="none" style={[styles.corner, styles.cBL, { borderColor: frameColor }]} />
                <Animated.View pointerEvents="none" style={[styles.corner, styles.cBR, { borderColor: frameColor }]} />
                {state === 'scanning' && !reduceMotion && cameraReady && <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />}
                {state === 'scanning' && !cameraReady && <Icon name={cameraDenied ? 'videocam-off-outline' : 'qr-code-outline'} size={64} color={colors.textMuted} />}
                {state === 'success' && (
                  <Animated.View style={{ transform: [{ scale: check }], opacity: check }}>
                    <Icon name="checkmark-circle" size={96} color={colors.green.bar} />
                  </Animated.View>
                )}
                {state === 'invalid' && <Icon name="alert-circle-outline" size={64} color={colors.red.text} />}
              </Animated.View>

              {state === 'scanning' && !cameraDenied && <Text style={styles.hint}>{cameraReady ? 'Place le QR code de l’accueil dans le cadre' : 'Autorise la caméra pour scanner'}</Text>}
              {state === 'scanning' && !cameraReady && !cameraDenied && (
                <Pressable onPress={() => requestPermission()} accessibilityRole="button" style={styles.validate}>
                  <Text style={styles.validateText}>Autoriser la caméra</Text>
                </Pressable>
              )}
              {state === 'scanning' && cameraDenied && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Caméra non autorisée</Text>
                  <Text style={styles.errorBody}>Autorise l’accès à la caméra dans les réglages de ton téléphone, ou saisis le code à la main.</Text>
                </View>
              )}
              {state === 'success' && <Text style={[styles.hint, { color: colors.green.text, fontWeight: '700' }]}>Présence validée</Text>}
              {state === 'invalid' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>QR invalide</Text>
                  <Text style={styles.errorBody}>Ce code n’est pas celui de l’accueil du club. Réessaie devant le QR de la réception.</Text>
                  <Pressable onPress={retry} accessibilityRole="button" style={styles.retryBtn}>
                    <Icon name="refresh" size={18} color={colors.onInverse} />
                    <Text style={styles.retryText}>Réessayer</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        {/* Fallback */}
        {state !== 'success' && (
          <Pressable onPress={() => { setManual(m => !m); retry(); }} accessibilityRole="button" style={styles.switchMode}>
            <Icon name={manual ? 'qr-code-outline' : 'keypad-outline'} size={18} color={colors.disabled} />
            <Text style={styles.switchModeText}>{manual ? 'Scanner le QR code' : 'Saisir le code à la place'}</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
};

const CORNER = 56;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 8 },
  topTitle: { color: colors.brand, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  roundSpacer: { width: 44, height: 44 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  roundBtnOn: { backgroundColor: colors.yellow.bar },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  bigTitle: { textAlign: 'center', marginBottom: 32 },
  frame: { width: FRAME, height: FRAME, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.brand },
  cTL: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 28 },
  cTR: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 28 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 28 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 28 },
  scanLine: { position: 'absolute', top: 0, left: 18, right: 18, height: 3, borderRadius: 2, backgroundColor: colors.brand, shadowColor: colors.brand, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  hint: { color: colors.textSecondary, fontSize: 16, fontWeight: '500', lineHeight: 23, marginTop: 32, textAlign: 'center', maxWidth: 300 },

  errorBox: { alignItems: 'center', marginTop: 28, maxWidth: 320 },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  errorBody: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 24, borderRadius: 999, backgroundColor: colors.text, marginTop: 18 },
  retryText: { color: colors.onInverse, fontSize: 15, fontWeight: '800' },

  manualBox: { width: '100%', maxWidth: 360, alignItems: 'center' },
  manualTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  manualSub: { color: colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 18, textAlign: 'center' },
  manualInput: { width: '100%', height: 60, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 2 },
  errorInline: { color: colors.red.text, fontSize: 14, fontWeight: '600', marginTop: 10 },
  validate: { height: 56, alignSelf: 'stretch', borderRadius: 999, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 16, ...buttonShadow },
  validateText: { color: colors.white, fontSize: 15, fontWeight: '800' },

  switchMode: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, marginBottom: 32, alignSelf: 'center', paddingHorizontal: 20 },
  switchModeText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
});
