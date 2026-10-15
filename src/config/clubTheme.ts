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
    primaryDark: '#C41A20', // pressed states
    primaryLight: '#3A1214', // tints for backgrounds, badges, active tab pill
    primaryText: '#FF5A5F', // red text/icons on primaryLight (>=4.5:1)
    primaryTint: '#1A1012', // background of a selected option card (with a red border)
    primaryRgb: '227, 30, 36',

    // Surfaces
    /** Top bars of every screen: same near-black as the page. */
    header: '#0B0B0C',
    /** Behind the cards. */
    page: '#0B0B0C',
    background: '#141416', // cards
    surface: '#1C1C1F', // input backgrounds, secondary surfaces
    surfaceHover: '#26262A', // tracks
    surfaceActive: '#2E2E33',
    border: '#2A2A2E',
    divider: '#232327',

    // Text
    textPrimary: '#F5F5F5',
    textSecondary: '#A1A1A6',
    textTertiary: '#6B6B70',
    textOnPrimary: '#FFFFFF',
    textInverse: '#FFFFFF',

    // Status
    success: '#22C55E',
    successText: '#4ADE80', // >=4.5:1 on the card color
    successLight: '#12291B', // dark tinted backgrounds
    warning: '#F5A524',
    warningText: '#F5A524',
    warningLight: '#2E2210',
    danger: '#EF4444',
    dangerText: '#F87171',
    dangerLight: '#351416',

    // Specific
    notification: '#E31E24',
    tabActive: '#E31E24',
    tabInactive: '#6B6B70',
    barChartDefault: '#26262A',
    barChartNow: '#E31E24',

    // Login screen (always dark, whatever the device theme)
    loginBackground: '#0B0B0C',

    // Dark palette (the app is now dark; kept for compatibility)
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
