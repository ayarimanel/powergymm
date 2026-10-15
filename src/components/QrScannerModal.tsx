import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { Text, TextInput } from './ui/Text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useBackHandler } from '../navigation/backStack';
import { useSwipeToDismiss } from './useSwipeToDismiss';
import { useReduceMotion } from '../hooks/useDeviceState';
import { colors } from '../theme';

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
  const swipe = useSwipeToDismiss(onClose);

  const frameColor = morph.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.9)', colors.green.bar] });
  const frameBg = morph.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0)', 'rgba(34,197,94,0.18)'] });
  const translateY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [14, FRAME - 18] });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View {...swipe.panHandlers} style={[styles.container, swipe.style]}>
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
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: cameraReady && state === 'scanning' ? 'rgba(11,18,32,0.35)' : 'transparent' }]} />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer le scanner" style={styles.roundBtn}>
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
          <Text style={styles.topTitle}>Valider ma présence</Text>
          {cameraReady ? (
            <Pressable onPress={() => setTorch(t => !t)} accessibilityRole="switch" accessibilityState={{ checked: torch }} accessibilityLabel="Lampe torche" style={[styles.roundBtn, torch && styles.roundBtnOn]}>
              <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={22} color={torch ? colors.text : colors.white} />
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
              {state === 'success' && <Text style={[styles.errorInline, { color: colors.nightSuccess }]}>Présence validée ✓</Text>}
              <Pressable onPress={() => handleCode(typed)} accessibilityRole="button" style={styles.validate}>
                <Text style={styles.validateText}>Valider</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Animated.View style={[styles.frame, { borderColor: frameColor, backgroundColor: frameBg }]}>
                {state === 'scanning' && !reduceMotion && cameraReady && <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />}
                {state === 'scanning' && !cameraReady && <Ionicons name={cameraDenied ? 'videocam-off-outline' : 'qr-code-outline'} size={64} color="rgba(255,255,255,0.4)" />}
                {state === 'success' && (
                  <Animated.View style={{ transform: [{ scale: check }], opacity: check }}>
                    <Ionicons name="checkmark-circle" size={96} color={colors.green.bar} />
                  </Animated.View>
                )}
                {state === 'invalid' && <Ionicons name="alert-circle-outline" size={64} color={colors.nightDanger} />}
              </Animated.View>

              {state === 'scanning' && !cameraDenied && <Text style={styles.hint}>{cameraReady ? 'Place le QR code de l’accueil dans le cadre' : 'Autorise la caméra pour scanner'}</Text>}
              {state === 'scanning' && cameraDenied && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Caméra non autorisée</Text>
                  <Text style={styles.errorBody}>Autorise l’accès à la caméra dans les réglages de ton téléphone, ou saisis le code à la main.</Text>
                </View>
              )}
              {state === 'success' && <Text style={[styles.hint, { color: colors.nightSuccess, fontWeight: '700' }]}>Présence validée</Text>}
              {state === 'invalid' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>QR invalide</Text>
                  <Text style={styles.errorBody}>Ce code n’est pas celui de l’accueil du club. Réessaie devant le QR de la réception.</Text>
                  <Pressable onPress={retry} accessibilityRole="button" style={styles.retryBtn}>
                    <Ionicons name="refresh" size={18} color={colors.text} />
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
            <Ionicons name={manual ? 'qr-code-outline' : 'keypad-outline'} size={18} color={colors.disabled} />
            <Text style={styles.switchModeText}>{manual ? 'Scanner le QR code' : 'Saisir le code à la place'}</Text>
          </Pressable>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 44, paddingBottom: 8 },
  topTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  roundSpacer: { width: 44, height: 44 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  roundBtnOn: { backgroundColor: '#FDE68A' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  frame: { width: FRAME, height: FRAME, borderRadius: 32, borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scanLine: { position: 'absolute', top: 0, left: 18, right: 18, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  hint: { color: colors.border, fontSize: 15, marginTop: 24, textAlign: 'center' },

  errorBox: { alignItems: 'center', marginTop: 24, maxWidth: 320 },
  errorTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  errorBody: { color: colors.disabled, fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: colors.white, marginTop: 18 },
  retryText: { color: colors.text, fontSize: 15, fontWeight: '800' },

  manualBox: { width: '100%', maxWidth: 360, alignItems: 'center' },
  manualTitle: { color: colors.white, fontSize: 20, fontWeight: '800' },
  manualSub: { color: colors.textMuted, fontSize: 14, marginTop: 4, marginBottom: 18, textAlign: 'center' },
  manualInput: { width: '100%', height: 60, borderRadius: 18, borderWidth: 1.5, borderColor: colors.nightLine, backgroundColor: colors.nightSurface, color: colors.white, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 2 },
  errorInline: { color: colors.nightDanger, fontSize: 14, fontWeight: '600', marginTop: 10 },
  validate: { height: 52, alignSelf: 'stretch', borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  validateText: { color: colors.white, fontSize: 16, fontWeight: '800' },

  switchMode: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, marginBottom: 28, alignSelf: 'center', paddingHorizontal: 20 },
  switchModeText: { color: colors.disabled, fontSize: 15, fontWeight: '700' },
});
