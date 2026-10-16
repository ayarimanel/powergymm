// The ONLY place club-specific branding lives. Every screen reads its colors,
// fonts and logos through src/theme.ts, which is built from this file.
// To white-label for another gym: copy this file, change the values, swap the
// images in assets/brand/. Nothing else in the app has to change.
// Images are getters: they load when a screen shows them, so the colors can be
// imported anywhere (tests included) without pulling in image files.

const clubTheme = {
  // ─── Identity ───
  clubName: 'Power Gym Tunis',
  clubSlogan: 'Plus qu’une salle,\nUne communauté',
  /** Full logo, black lettering: for light backgrounds only (the app is now dark: use logoOnDark). */
  get logo() { return require('../../assets/brand/logo-powergym.png'); },
  /** Same logo with white lettering: for dark backgrounds (login). */
  get logoOnDark() { return require('../../assets/brand/logo-powergym-white.png'); },
  /** The red W on white: avatar of the club's official posts, favicon. */
  get mark() { return require('../../assets/brand/favicon-powergym.png'); },
  /** Text logo (Wordmark component): main word, accent word in the primary color, small spaced line under it. */
  wordmark: { main: 'POWER', accent: 'GYM', sub: 'TUNIS' },
  /** Shown where a 2-letter avatar stands for the club. */
  clubInitials: 'PG',
  /** Width / height of the logo files, so they never get squashed. */
  logoAspect: 800 / 352,

  // ─── Colors ───
  colors: {
    // Primary = the gym's signature color (Power Gym = red)
    primary: '#E31E24',
    primaryDark: '#C8161C', // pressed states, links
    primaryLight: '#FDE8E8', // tints for backgrounds, badges, active tab pill
    primaryText: '#C8161C', // red text/icons on primaryLight (>=4.5:1)
    primaryTint: '#FFF1F1', // background of a selected option card (with a red border)
    primaryRgb: '227, 30, 36',

    // Surfaces
    /** Top bars of every screen: same near-black as the page. */
    header: '#FFFFFF',
    /** Behind the cards. */
    page: '#FFFFFF',
    background: '#F2F2F4', // cards
    surface: '#F2F2F4', // input backgrounds, secondary surfaces
    surfaceHover: '#E0E0E5', // tracks
    surfaceActive: '#C9C9CE',
    border: '#F2F2F4',
    divider: '#E0E0E5',

    // Text
    textPrimary: '#141416',
    textSecondary: '#55555C',
    textTertiary: '#6E6E75',
    textOnPrimary: '#FFFFFF',
    textInverse: '#FFFFFF',

    // Status
    success: '#22C55E',
    successText: '#15803D', // >=4.5:1 on the card color
    successLight: '#DCFCE7', // dark tinted backgrounds
    warning: '#F5A524',
    warningText: '#6E4100',
    warningLight: '#FFF3D6',
    danger: '#E31E24',
    dangerText: '#DC2626',
    dangerLight: '#FEE2E2',

    // Specific
    notification: '#E31E24',
    tabActive: '#FF3B40',
    tabInactive: '#8A8A91',
    barChartDefault: '#E0E0E5',
    barChartNow: '#E31E24',

    /** Switch track when off. */
    disabled: '#C9C9CE',

    // Login screen (always dark, whatever the device theme)
    loginBackground: '#0B0B0C',

    // Old dark palette (unused; kept for compatibility)
    dark: {
      background: '#141416',
      surface: '#1C1C1F',
      surfaceHover: '#26262A',
      surfaceActive: '#2E2E33',
      border: '#2A2A2E',
      divider: '#232327',
      textPrimary: '#F5F5F5',
      textSecondary: '#A1A1A6',
      textTertiary: '#6B6B70',
      primaryLight: '#3A1214',
    },
  },

  /**
   * "Mode sombre" (switch in Paramètres): these values replace the ones in `colors`
   * at launch (see src/config/colorMode.ts). Everything not listed stays the same.
   */
  darkMode: {
    header: '#16161A',
    page: '#16161A',
    background: '#202024',
    surface: '#2A2A2F',
    surfaceHover: '#34343A',
    surfaceActive: '#3C3C42',
    border: '#38383E',
    divider: '#2E2E33',
    textPrimary: '#F5F5F5',
    textSecondary: '#A1A1A6',
    textTertiary: '#7A7A80',
    primaryLight: '#3A1214',
    primaryText: '#FF5A5F',
    primaryTint: '#1A1012',
    successText: '#4ADE80',
    successLight: '#12291B',
    warningText: '#F5A524',
    warningLight: '#2E2210',
    dangerText: '#F87171',
    dangerLight: '#351416',
    barChartDefault: '#34343A',
    disabled: '#4A4A50',
  } as Record<string, string>,

  /** Set at launch by applyColorMode(); read by src/theme.ts. */
  mode: 'light' as 'light' | 'dark',

  // ─── Typography ───
  // Family names registered by useClubFonts() in App.tsx (one family per weight, as native requires).
  fonts: {
    heading: 'BarlowCondensed_800ExtraBold',
    headingItalic: 'BarlowCondensed_800ExtraBold_Italic',
    headingBlack: 'BarlowCondensed_900Black',
    /** Big screen titles: 900 italic. */
    display: 'BarlowCondensed_900Black_Italic',
    headingSemi: 'BarlowCondensed_600SemiBold',
    headingBold: 'BarlowCondensed_700Bold',
    body: 'Manrope_400Regular',
    bodyMedium: 'Manrope_500Medium',
    bodySemi: 'Manrope_600SemiBold',
    bodyBold: 'Manrope_700Bold',
    bodyHeavy: 'Manrope_800ExtraBold',
  },

  // ─── Radius ───
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
    card: 16,
    /** New design: big cards and sheets. */
    cardLg: 24,
    input: 16,
  },

  // ─── Login screen ───
  login: {
    get backgroundImage() { return require('../../assets/brand/login-bg-powergym.png'); },
    primaryButtonText: 'Se connecter',
    secondaryButtonText: 'Créer un compte',
  },
};

export default clubTheme;
