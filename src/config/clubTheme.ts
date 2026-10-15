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
  /** Full logo, black lettering: for light backgrounds (header, sheets). */
  get logo() { return require('../../assets/brand/logo-powergym.png'); },
  /** Same logo with white lettering: for dark backgrounds (login). */
  get logoOnDark() { return require('../../assets/brand/logo-powergym-white.png'); },
  /** The red W on white: avatar of the club's official posts, favicon. */
  get mark() { return require('../../assets/brand/favicon-powergym.png'); },
  /** Shown where a 2-letter avatar stands for the club. */
  clubInitials: 'PG',
  /** Width / height of the logo files, so they never get squashed. */
  logoAspect: 800 / 352,

  // ─── Colors ───
  colors: {
    // Primary = the gym's signature color (Power Gym = red)
    primary: '#E31E24',
    primaryDark: '#C41A20', // pressed states
    primaryLight: '#FDE8E8', // tints for backgrounds, badges, active tab pill
    primaryRgb: '227, 30, 36',

    // Surfaces
    /** Top bars of every screen: a light grey, lighter than the page. */
    header: '#EFEFF2',
    /** Behind the cards: a deeper grey than the header, so white cards stand out. */
    page: '#E3E3E8',
    background: '#FFFFFF',
    surface: '#F5F5F5', // page background behind cards, input backgrounds
    surfaceHover: '#EEEEEE',
    surfaceActive: '#E5E5E5',
    border: '#E0E0E0',
    divider: '#F0F0F0',

    // Text
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    textTertiary: '#8A8A8A', // #999 fails contrast on white; this is the readable twin
    textOnPrimary: '#FFFFFF',
    textInverse: '#FFFFFF',

    // Status
    success: '#22C55E',
    successText: '#15803D',
    successLight: '#DCFCE7',
    warning: '#F59E0B',
    warningText: '#B45309',
    warningLight: '#FEF3C7',
    danger: '#EF4444',
    dangerText: '#B91C1C',
    dangerLight: '#FEE2E2',

    // Specific
    notification: '#E31E24',
    tabActive: '#E31E24',
    tabInactive: '#8A8A8A',
    barChartDefault: '#E0E0E0',
    barChartNow: '#E31E24',

    // Login screen (always dark, whatever the device theme)
    loginBackground: '#0B0B0C',

    // Dark palette, ready for when the app gets a dark mode
    dark: {
      background: '#121212',
      surface: '#1E1E1E',
      surfaceHover: '#2A2A2A',
      surfaceActive: '#333333',
      border: '#333333',
      divider: '#262626',
      textPrimary: '#F5F5F5',
      textSecondary: '#AAAAAA',
      textTertiary: '#777777',
      primaryLight: '#3D1516',
    },
  },

  // ─── Typography ───
  // Family names registered by useClubFonts() in App.tsx (one family per weight, as native requires).
  fonts: {
    heading: 'BarlowCondensed_700Bold',
    headingSemi: 'BarlowCondensed_600SemiBold',
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
  },

  // ─── Login screen ───
  login: {
    get backgroundImage() { return require('../../assets/brand/login-bg-powergym.png'); },
    primaryButtonText: 'Se connecter',
    secondaryButtonText: 'Créer un compte',
  },
};

export default clubTheme;
