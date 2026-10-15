import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { Icon } from '../components/ui/Icon';
import { GenderType, MuscleGroup, TrainingTimeSlot, UserProfile, UserRole } from '../types/database';
import { ADMIN_USERNAME, AuthService, normUsername, suggestUsername, usernameError } from '../services/authService';
import { pinError } from '../services/credentials';
import { useT } from '../i18n';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { DEFAULT_GYM_CONFIG, GymConfigService } from '../config/gymConfig';
import { MUSCLES } from '../journal/journalLogic';
import { GENDERS, GOALS, TIMES } from '../data/profileOptions';
import { buttonShadow, clubTheme, colors, radius } from '../theme';
import { WelcomeCover } from '../components/onboarding/WelcomeCover';
import { Title } from '../components/ui/Title';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { SegmentedProgress } from '../components/ui/SegmentedProgress';
import { AgeRuler } from '../components/ui/AgeRuler';
import { PinBoxes } from '../components/ui/PinBoxes';
import { IconName } from '../components/ui/Icon';

interface Props {
  onCompleteOnboarding: (profile: UserProfile) => void;
}

type Mode = 'welcome' | 'login' | 'signup' | 'setPin';

/** Members and coaches create their own account. The club manager signs in as "admin". */
const ROLES: { id: UserRole; title: string; sub: string; icon: IconName }[] = [
  { id: 'member', title: 'Membre', sub: 'Je m’entraîne au club', icon: 'barbell-outline' },
  { id: 'coach', title: 'Coach', sub: 'J’accompagne les membres (validé par le club)', icon: 'ribbon-outline' },
];

const digits = (s: string) => s.replace(/[^0-9]/g, '');

/** Icons for the goal cards and training-time cards (look only). */
const GOAL_ICON: Record<string, IconName> = {
  'Prendre du muscle': 'barbell-outline',
  'Perdre du poids': 'flame-outline',
  'Rester en forme': 'heart-outline',
  'Gagner en force': 'flash-outline',
  'Préparer une compétition': 'trophy-outline',
};
const TIME_ICON: Record<TrainingTimeSlot, IconName> = { morning: 'sunny-outline', afternoon: 'time-outline', evening: 'moon-outline' };

/** Big italic title, its second half in the club color (design-ref Connexion). */
const TwoToneTitle: React.FC<{ text: string }> = ({ text }) => {
  const words = text.split(' ');
  const cut = Math.ceil(words.length / 2);
  return (
    <View style={{ marginBottom: 8 }} accessible accessibilityRole="header" accessibilityLabel={text}>
      <Title variant="display" accessibilityRole="none">{words.slice(0, cut).join(' ')}</Title>
      {words.length > 1 ? <Title variant="display" color={colors.brand} accessibilityRole="none">{words.slice(cut).join(' ')}</Title> : null}
    </View>
  );
};

export const OnboardingScreen: React.FC<Props> = ({ onCompleteOnboarding }) => {
  const { t } = useT();
  const keyboard = useKeyboardHeight();
  const [mode, setMode] = useState<Mode>('welcome');
  const [clubName, setClubName] = useState(DEFAULT_GYM_CONFIG.name);

  // Login
  const [loginUser, setLoginUser] = useState('');
  const [secret, setSecret] = useState('');

  // Sign-up
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole>('member');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const usernameEdited = useRef(false);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  /** Older account that just signed in with its phone and must now pick a code. */
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<GenderType>('male');
  const [trainingTime, setTrainingTime] = useState<TrainingTimeSlot>('evening');
  const [goal, setGoal] = useState<string | undefined>();
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [taken, setTaken] = useState<Set<string>>(new Set());

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    GymConfigService.getConfig().then(c => {
      setClubName(c.name);
    });
    AuthService.usernames().then(setTaken);
    // Just signed out: straight to the login with the username filled in.
    AuthService.lastUsername().then(u => {
      if (u) {
        setLoginUser(u);
        setMode('login');
      }
    });
  }, []);

  // Suggest a username from the name until the member types his own.
  useEffect(() => {
    if (!usernameEdited.current && fullName.trim().length >= 2) setUsername(suggestUsername(fullName, taken));
  }, [fullName, taken]);

  const isAdminLogin = normUsername(loginUser) === ADMIN_USERNAME;

  /* ---------- login ---------- */
  const login = async () => {
    setBusy(true);
    const res = await AuthService.login(loginUser, secret);
    setBusy(false);
    if (!res.ok) return setErrors({ [res.field]: res.error });
    // Account from before PINs existed: it opened with the phone this once, and
    // now has to get a real code before going any further.
    if (res.mustSetPin) {
      setPendingProfile(res.profile);
      setMode('setPin');
      return;
    }
    onCompleteOnboarding(res.profile);
  };

  /** Finishes the migration for an older account. */
  const savePin = async () => {
    if (!pendingProfile) return;
    if (pin.trim() !== pin2.trim()) return setErrors({ pin2: 'Les deux codes ne sont pas identiques.' });
    setBusy(true);
    const res = await AuthService.setPin(pendingProfile.username ?? loginUser, pin);
    setBusy(false);
    if (!res.ok) return setErrors({ pin: res.error });
    onCompleteOnboarding(pendingProfile);
  };

  /* ---------- sign-up ---------- */
  /** One question per screen: 1 role · 2 identity · 3 gender & age · 4 goal · 5 habits · 6 secret code. */
  const totalSteps = 6;
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 2) {
      if (fullName.trim().length < 2) e.name = 'Écris ton prénom et ton nom.';
      const uErr = usernameError(username) ?? (taken.has(normUsername(username)) ? 'Cet identifiant est déjà pris.' : null);
      if (uErr) e.username = uErr;
      if (digits(phone).length < 8) e.phone = role === 'coach' ? 'Obligatoire : les membres te contactent dessus.' : 'Obligatoire : le club te contacte dessus.';
    }
    if (step === 6) {
      const pErr = pinError(pin);
      if (pErr) e.pin = pErr;
      else if (pin.trim() !== pin2.trim()) e.pin2 = 'Les deux codes ne sont pas identiques.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = async () => {
    if (!validate()) return;
    if (step < totalSteps) return setStep(step + 1);
    setBusy(true);
    const isCoach = role === 'coach';
    const parsedAge = parseInt(age, 10);
    const res = await AuthService.register({
      id: 'usr-' + Date.now(),
      username: normUsername(username),
      gymId: DEFAULT_GYM_CONFIG.id,
      role,
      fullName: fullName.trim(),
      gender,
      age: parsedAge > 0 ? parsedAge : 25,
      usualTrainingTime: trainingTime,
      usualMuscleGroups: muscles,
      goal,
      visitStreak: 0,
      bestStreak: 0,
      isApprovedCoach: !isCoach,
      coachStatus: isCoach ? 'pending_approval' : 'approved', // coaches are validated by the club
      whatsappNumber: phone.trim(),
      createdAt: new Date().toISOString(),
    }, pin);
    setBusy(false);
    if (!res.ok) {
      setStep(2);
      return setErrors({ username: res.error });
    }
    onCompleteOnboarding(res.profile);
  };

  const back = () => {
    setErrors({});
    if (mode === 'signup' && step > 1) return setStep(s => s - 1);
    setMode('welcome');
  };
  const go = (m: Mode) => {
    setErrors({});
    setStep(1);
    setMode(m);
  };
  const toggleMuscle = (id: MuscleGroup) => setMuscles(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));

  const Logo = (
    <Image source={clubTheme.logoOnDark} style={styles.logo} resizeMode="contain" accessibilityLabel={clubName} />
  );

  // The cover: dark, full-bleed, its own layout.
  if (mode === 'welcome') return <WelcomeCover onLogin={() => go('login')} onSignup={() => go('signup')} />;

  return (
    <View style={styles.screen}>
      {/* 'padding' on iOS, 'height' on Android; on web the hook below does it. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.top}>
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Retour" style={styles.backBtn}>
            <Icon name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          {mode === 'signup' ? (
            <>
              <SegmentedProgress current={step} total={totalSteps} />
              <Text style={styles.stepCount}>{step}/{totalSteps}</Text>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }} />
              <View style={styles.topSpacer} />
            </>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 32 + keyboard }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* ---------- login ---------- */}
          {mode === 'login' && (
            <>
              <TwoToneTitle text={t('Content de te revoir')} />
              <Text style={styles.loginSub}>{t('Connecte-toi avec ton identifiant et ton code secret.')}</Text>

              <TextField
                label={t('Identifiant')}
                icon="person-outline"
                error={errors.username}
                value={loginUser}
                onChangeText={t => { setLoginUser(t); setErrors({}); }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ex : lahbib"
                accessibilityLabel="Identifiant"
                returnKeyType="next"
                containerStyle={styles.loginField}
              />

              <TextField
                label={isAdminLogin ? 'Mot de passe' : 'Code secret'}
                icon="lock-closed-outline"
                error={errors.secret}
                value={secret}
                onChangeText={t => { setSecret(t); setErrors({}); }}
                secureTextEntry={isAdminLogin}
                keyboardType={isAdminLogin ? 'default' : 'number-pad'}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={isAdminLogin ? '••••' : '+216 20 123 456'}
                accessibilityLabel={isAdminLogin ? 'Mot de passe' : 'Code secret'}
                onSubmitEditing={login}
                returnKeyType="go"
                containerStyle={styles.loginField}
              />

              <View style={styles.loginHint}>
                <Icon name="shield-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.loginHintText}>{t('Gérant du club ? Identifiant « admin » et ton mot de passe.')}</Text>
              </View>
            </>
          )}

          {/* ---------- older account: pick a code ---------- */}
          {mode === 'setPin' && (
            <>
              <TwoToneTitle text={t('Choisis ton code')} />
              <Text style={styles.loginSub}>
                Ton compte s’ouvrait avec ton numéro de téléphone. Comme ce numéro est visible dans l’application, il te
                faut un code secret pour protéger ton compte.
              </Text>

              <TextField
                label={t('Nouveau code')}
                icon="lock-closed-outline"
                error={errors.pin}
                value={pin}
                onChangeText={t => { setPin(digits(t).slice(0, 8)); setErrors({}); }}
                keyboardType="number-pad"
                secureTextEntry
                placeholder="4 à 8 chiffres"
                accessibilityLabel="Nouveau code secret"
                containerStyle={styles.loginField}
              />

              <TextField
                label={t('Confirme')}
                icon="lock-closed-outline"
                error={errors.pin2}
                value={pin2}
                onChangeText={t => { setPin2(digits(t).slice(0, 8)); setErrors({}); }}
                keyboardType="number-pad"
                secureTextEntry
                placeholder="••••"
                accessibilityLabel="Confirme le code"
                containerStyle={styles.loginField}
              />

              <Button label={busy ? 'Un instant…' : 'Enregistrer mon code'} onPress={savePin} disabled={busy} style={{ marginTop: 28 }} />
            </>
          )}

          {/* ---------- 1/6 role ---------- */}
          {mode === 'signup' && step === 1 && (
            <>
              <Text style={styles.overline}>{t('Créer mon compte')}</Text>
              <Title variant="display" style={styles.qTitle}>{t('Qui es-tu ?')}</Title>
              <View style={styles.options}>
                {ROLES.map(r => {
                  const on = role === r.id;
                  return (
                    <Pressable key={r.id} onPress={() => { setRole(r.id); setErrors({}); }} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.roleCard, on && styles.optionOn]}>
                      <View style={[styles.roleIcon, on && { backgroundColor: colors.brand }]}>
                        <Icon name={r.icon} size={24} color={on ? colors.white : colors.textSecondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.roleTitle}>{r.title}</Text>
                        <Text style={styles.roleSub}>{r.sub}</Text>
                      </View>
                      <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.loginHint}>
                <Icon name="shield-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.loginHintText}>{t('Gérant du club ? Pas besoin de compte : connecte-toi avec l’identifiant « admin ».')}</Text>
              </View>
            </>
          )}

          {/* ---------- 2/6 identity ---------- */}
          {mode === 'signup' && step === 2 && (
            <>
              <TwoToneTitle text={t('Fais connaissance')} />
              <Text style={styles.loginSub}>{role === 'coach' ? 'Les membres te contacteront sur WhatsApp. Le club validera ton profil coach.' : 'Ton identifiant et ton numéro te serviront à te connecter.'}</Text>

              <TextField
                label={t('Prénom et nom')}
                error={errors.name}
                value={fullName}
                onChangeText={t => { setFullName(t); setErrors({}); }}
                placeholder="Ex : Lahbib Ben Ali"
                autoCapitalize="words"
                accessibilityLabel="Prénom et nom"
                containerStyle={styles.loginField}
              />

              <TextField
                label={t('Identifiant')}
                icon="at"
                error={errors.username}
                value={username}
                onChangeText={t => { usernameEdited.current = true; setUsername(t.toLowerCase().replace(/\s/g, '')); setErrors({}); }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                placeholder="lahbib"
                accessibilityLabel="Identifiant"
                containerStyle={styles.loginField}
              />
              {!errors.username && !!username && !usernameError(username) && !taken.has(normUsername(username)) ? (
                <Text style={styles.available}>{t('Disponible')}</Text>
              ) : null}

              <TextField
                label={t('Numéro WhatsApp')}
                icon="logo-whatsapp"
                error={errors.phone}
                value={phone}
                onChangeText={t => { setPhone(t); setErrors({}); }}
                keyboardType="phone-pad"
                placeholder="+216 20 123 456"
                accessibilityLabel="Numéro WhatsApp"
                containerStyle={styles.loginField}
              />
              {!errors.phone ? <Text style={styles.note}>Il n’est pas montré aux autres membres{role === 'coach' ? ', sauf pour te réserver' : ''}.</Text> : null}
            </>
          )}

          {/* ---------- 3/6 gender & age ---------- */}
          {mode === 'signup' && step === 3 && (
            <>
              <Title variant="display" style={styles.qTitle}>{t('Tu es ?')}</Title>
              <View style={styles.genders}>
                {GENDERS.map(g => {
                  const on = gender === g.id;
                  return (
                    <Pressable key={g.id} onPress={() => setGender(g.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={g.label} style={styles.gender}>
                      <View style={[styles.genderCircle, on && styles.genderCircleOn]}>
                        <Icon name={g.id === 'female' ? 'female' : 'male'} size={44} color={on ? colors.white : colors.textSecondary} />
                      </View>
                      <Text style={[styles.genderText, on && { color: colors.text }]}>{g.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.overline, styles.ageLabel]}>{t('Âge (facultatif)')}</Text>
              <AgeRuler value={age ? parseInt(age, 10) : null} onChange={a => setAge(String(a))} />
            </>
          )}

          {/* ---------- 4/6 goal ---------- */}
          {mode === 'signup' && step === 4 && (
            <>
              <Title variant="display" style={styles.qTitle}>{t('Ton objectif')}</Title>
              <Text style={styles.loginSub}>{t('Facultatif : on t’aide à organiser tes séances.')}</Text>
              <View style={styles.options}>
                {GOALS.map(g => {
                  const on = goal === g;
                  return (
                    <Pressable key={g} onPress={() => setGoal(on ? undefined : g)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.goalCard, on && styles.optionOn]}>
                      <View style={[styles.goalIcon, on && { backgroundColor: colors.brand }]}>
                        <Icon name={GOAL_ICON[g] ?? 'flag-outline'} size={22} color={on ? colors.white : colors.textSecondary} />
                      </View>
                      <Text style={styles.goalText}>{g}</Text>
                      <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* ---------- 5/6 habits ---------- */}
          {mode === 'signup' && step === 5 && (
            <>
              <Title variant="display" style={styles.qTitle}>{t('Tes habitudes')}</Title>

              <Text style={[styles.overline, { marginTop: 18 }]}>{t('Moment d’entraînement habituel')}</Text>
              <View style={styles.times}>
                {TIMES.map(slot => {
                  const on = trainingTime === slot.id;
                  return (
                    <Pressable key={slot.id} onPress={() => setTrainingTime(slot.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.timeCard, on && styles.optionOn]}>
                      <Icon name={TIME_ICON[slot.id]} size={22} color={on ? colors.brandText : colors.textSecondary} />
                      <Text style={[styles.timeText, on && { color: colors.brandText }]}>{slot.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.overline, { marginTop: 28 }]}>{t('Muscles que tu travailles le plus')}</Text>
              <View style={styles.chips}>
                {MUSCLES.map(m => {
                  const on = muscles.includes(m.id);
                  return <Chip key={m.id} label={m.name} selected={on} icon={on ? 'checkmark' : undefined} onPress={() => toggleMuscle(m.id)} style={styles.muscleChip} />;
                })}
              </View>
            </>
          )}

          {/* ---------- 6/6 secret code ---------- */}
          {mode === 'signup' && step === 6 && (
            <>
              <TwoToneTitle text={t('Ton code secret')} />
              <Text style={styles.loginSub}>{t('C’est lui qui ouvre ton compte. Ne le partage avec personne.')}</Text>

              <View style={styles.loginField}>
                <PinBoxes
                  label={`${t('Code secret')} · 4 à 8 chiffres`}
                  value={pin}
                  onChangeText={t => { setPin(digits(t).slice(0, 8)); setErrors({}); }}
                  error={errors.pin}
                  accessibilityLabel="Code secret"
                />
              </View>
              <View style={styles.loginField}>
                <PinBoxes
                  label={t('Confirme ton code')}
                  value={pin2}
                  onChangeText={t => { setPin2(digits(t).slice(0, 8)); setErrors({}); }}
                  slots={pin.length >= 4 ? pin.length : 6}
                  error={errors.pin2}
                  accessibilityLabel="Confirme ton code secret"
                />
              </View>
              {pin.length >= 4 && !pinError(pin) && !errors.pin ? (
                <View style={styles.solid}>
                  <Icon name="shield-checkmark-outline" size={20} color={colors.green.text} />
                  <Text style={styles.solidText}>{t('Code solide : pas de suite ni de répétition')}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {mode === 'login' && (
            <>
              <Button label={busy ? 'Connexion…' : 'Se connecter'} onPress={login} disabled={busy} />
              <Pressable onPress={() => go('signup')} accessibilityRole="button" style={styles.skip}>
                <Text style={styles.skipText}>{t('Pas encore de compte ?')} <Text style={{ color: colors.brand }}>{t('Créer un compte')}</Text></Text>
              </Pressable>
            </>
          )}
          {mode === 'signup' && (
            <>
              <Button label={step === totalSteps ? t('Créer mon compte') : 'Continuer'} onPress={next} disabled={busy} loading={busy && step === totalSteps} />
              {step === 4 || step === 5 ? (
                <Pressable onPress={() => { if (step === 4) setGoal(undefined); else setMuscles([]); next(); }} accessibilityRole="button" style={styles.skip}>
                  <Text style={styles.skipText}>{t('Passer')}</Text>
                </Pressable>
              ) : step === 1 ? (
                <Pressable onPress={() => go('login')} accessibilityRole="button" style={styles.skip}>
                  <Text style={styles.skipText}>{t('Déjà un compte ?')} <Text style={{ color: colors.brand }}>{t('Se connecter')}</Text></Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page, paddingTop: Platform.OS === 'android' ? 28 : 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, height: 64 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topSpacer: { width: 44 },
  stepCount: { width: 34, textAlign: 'right', fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  bars: { flex: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.track },
  barOn: { backgroundColor: colors.brand },

  content: { padding: 24, paddingTop: 12, paddingBottom: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  logo: { width: 150, height: Math.round(150 / clubTheme.logoAspect), marginBottom: 18, marginLeft: -6 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  sub: { fontSize: 16, color: colors.textSecondary, marginTop: 6, marginBottom: 22, lineHeight: 23 },


  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  roleCardOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  roleIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  roleSub: { fontSize: 14, color: colors.textSecondary, marginTop: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.disabled, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.brand },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand },

  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
  input: { minHeight: 54, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 16, fontSize: 17, color: colors.text },
  prefixed: { flexDirection: 'row', alignItems: 'center' },
  prefix: { fontSize: 17, fontWeight: '800', color: colors.textMuted, marginRight: 2 },
  prefixedInput: { flex: 1, minHeight: 50, fontSize: 17, color: colors.text },
  inputError: { borderColor: colors.red.bar },
  error: { color: colors.red.text, fontSize: 14, fontWeight: '600', marginTop: 8 },
  note: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, padding: 12, borderRadius: 14, backgroundColor: colors.bg },
  hintText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  chip: { minHeight: 46, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand, transform: [{ scale: 1.04 }] },
  chipText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },

  footer: { padding: 20, paddingHorizontal: 24, paddingBottom: 24, gap: 6, maxWidth: 520, width: '100%', alignSelf: 'center' },

  // Login + set-code (design-ref Connexion)
  loginSub: { fontSize: 15, fontWeight: '500', lineHeight: 22, color: colors.textSecondary, marginTop: 6, marginBottom: 6 },
  loginField: { marginTop: 22 },
  loginHint: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.card },
  loginHintText: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20, color: colors.textSecondary },

  // Sign-up questionnaire (design-ref Q1Role → Q6Code)
  overline: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.textSecondary, textTransform: 'uppercase' },
  qTitle: { marginTop: 6, marginBottom: 8 },
  options: { gap: 12, marginTop: 18 },
  optionOn: { backgroundColor: colors.brandTint, borderColor: colors.brand, borderWidth: 1.5 },
  available: { marginTop: 8, fontSize: 13, fontWeight: '700', color: colors.green.text },
  genders: { flexDirection: 'row', justifyContent: 'center', gap: 36, marginTop: 24 },
  gender: { alignItems: 'center', gap: 10 },
  genderCircle: { width: 116, height: 116, borderRadius: 58, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  genderCircleOn: { backgroundColor: colors.brand, borderColor: colors.brand, ...buttonShadow },
  genderText: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
  ageLabel: { textAlign: 'center', marginTop: 36, marginBottom: 6 },
  goalCard: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 72, paddingLeft: 14, paddingRight: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  goalIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  goalText: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  times: { flexDirection: 'row', gap: 10, marginTop: 12 },
  timeCard: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 4, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  timeText: { fontSize: 14, fontWeight: '800', color: colors.text },
  muscleChip: { height: 42, paddingHorizontal: 16 },
  solid: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.green.soft },
  solidText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.green.text },
  // The club's red = the one primary action
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...buttonShadow },
  ctaText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  ghost: { height: 52, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  skip: { height: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
});
