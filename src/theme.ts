// Shared design tokens. Every value here comes from src/config/clubTheme.ts:
// change the club there, never here, and never hardcode a color in a screen.
// The club's primary color is reserved for the main action of a screen and for
// the active tab; everything else is neutral.
import clubTheme from './config/clubTheme';

const c = clubTheme.colors;
const isDark = clubTheme.mode === 'dark';
/** Light-mode value, dark-mode value. */
const pick = (l: string, d: string) => (isDark ? d : l);

export const colors = {
  brand: c.primary,
  brandDark: c.primaryDark,
  brandSoft: c.primaryLight,
  /** Red text and icons sitting on brandSoft (the brand red alone is too dark there). */
  brandText: c.primaryText,
  /** Selected option card background (with a brand border). */
  brandTint: c.primaryTint,
  onBrand: c.textOnPrimary,
  bg: c.surface,
  /** Screen background, behind the cards. */
  page: c.page,
  /** Screen top bars. */
  header: c.header,
  card: c.background,
  border: c.border,
  divider: c.divider,
  text: c.textPrimary,
  textSecondary: c.textSecondary,
  textMuted: c.textTertiary,
  track: c.surfaceHover,
  pastBar: c.barChartDefault,
  disabled: c.disabled,
  /** Text and icons on a light fill (selected chips, tags, toasts: background = colors.text). */
  onInverse: c.page,
  white: '#FFFFFF',
  black: '#000000',
  /** Dark pieces on the page: tab bar, news bar, the dark button. */
  inverse: c.inverse,
  /** Floating navbar background. */
  navBar: c.navBar,
  /** Logo band on top of every tab but Accueil. */
  topBar: c.topBar,
  inverseText: c.inverseText,
  inverseTextMuted: c.inverseTextMuted,
  inverseAccent: c.inverseAccent,
  onWarning: c.onWarning,
  tabActive: c.tabActive,
  tabInactive: c.tabInactive,
  notification: c.notification,

  // Level colors: `bar` for fills (>=3:1), `text` for copy (>=4.5:1 on the card color), `soft` for dark tinted pill backgrounds
  green: { bar: c.success, text: c.successText, soft: c.successLight },
  amber: { bar: c.warning, text: c.warningText, soft: c.warningLight },
  red: { bar: c.danger, text: c.dangerText, soft: c.dangerLight },

  // Golden records (coach-validated)
  gold: { bg: pick('#FFFBEB', '#1F1A0C'), soft: pick('#FEF3C7', '#3A2E0E'), border: pick('#E9B824', '#8A6A1A'), bar: '#E9B824', deep: pick('#B7791F', '#F2C94C'), text: pick('#8A6A1A', '#F5D67A'), ink: '#3A2A00', bright: '#F5D77A' },

  flame: '#EA580C',
  flameSoft: pick('#FFEDD5', '#33190C'),
  flameText: pick('#C2410C', '#FB923C'),
  flameLight: '#FDBA74',
  flamePale: '#FED7AA',

  // Community accents (Mur bubbles, muscle tiles)
  pink: { bar: '#D6336C', text: pick('#BE185D', '#F472A8'), soft: pick('#FCE7F0', '#33141F') },
  violet: { bar: '#7048E8', text: pick('#6D28D9', '#A78BFA'), soft: pick('#EDE7FF', '#211A3A') },
  teal: { bar: '#0C8599', text: pick('#0E7490', '#3BC9DB'), soft: pick('#DDF4F7', '#0E2A2E') },
  blue: { bar: '#3B82F6', text: pick('#1D4ED8', '#60A5FA'), soft: pick('#E0ECFF', '#111E33') },
  coral: { bar: '#FF6B6B', text: pick('#DC2626', '#FF8787'), soft: pick('#FFE4E4', '#33161A') },
  lime: { soft: pick('#ECFCCB', '#1A2A10') },
  yellow: { bar: '#FBBF24', soft: pick('#FEF9C3', '#2E2810'), pale: '#FDE68A' },
  cyan: '#06B6D4',

  // Dark surfaces (QR scanner, login)
  night: c.loginBackground,
  nightSurface: '#17171A',
  nightLine: '#3A3A3C',
  nightSuccess: '#86EFAC',
  nightDanger: '#FCA5A5',

  // Third-party brand colors: these stay what WhatsApp makes them
  whatsapp: '#25D366',
  whatsappDark: '#128C7E',
};

/** The club's ink at a given opacity: overlays, scrims, photo labels. */
export const ink = (alpha: number) => `rgba(0,0,0,${alpha})`;
/** White at a given opacity: text and lines over photos and dark overlays. */
export const light = (alpha: number) => `rgba(255,255,255,${alpha})`;
/** The club's primary color at a given opacity: glows, button shadows. */
export const brandAlpha = (alpha: number) => `rgba(${c.primaryRgb},${alpha})`;

/** Phone status bar (clock, battery) over the app's top bars. */
export const statusBarStyle = isDark ? 'light-content' : 'dark-content';
export const isDarkMode = isDark;

export const fonts = clubTheme.fonts;
export const radius = clubTheme.radius;
export { clubTheme };

export type Level = 'green' | 'amber' | 'red';

/** Named community accents used by the Mur bubbles (bar = solid, soft = tinted bg, text = readable). */
export type CommunityColor = 'accent' | 'teal' | 'calm' | 'pink' | 'gold' | 'mid' | 'violet' | 'busy';
export const communityTint = (c: CommunityColor): { bar: string; soft: string; text: string } => {
  switch (c) {
    case 'accent': return { bar: colors.brand, soft: colors.brandSoft, text: colors.brandText };
    case 'teal': return colors.teal;
    case 'calm': return { bar: colors.green.bar, soft: colors.green.soft, text: colors.green.text };
    case 'pink': return colors.pink;
    case 'gold': return { bar: colors.gold.bar, soft: colors.gold.soft, text: colors.gold.deep };
    case 'mid': return { bar: colors.amber.bar, soft: colors.amber.soft, text: colors.amber.text };
    case 'violet': return colors.violet;
    case 'busy': return { bar: colors.red.bar, soft: colors.red.soft, text: colors.red.text };
  }
};

/** Cards are flat (surface + 1px border): no shadow. Kept so existing spreads still work. */
export const cardShadow = {
  shadowColor: colors.black,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
} as const;

/** The red glow under the club's primary buttons. */
export const buttonShadow = {
  shadowColor: colors.brand,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.35,
  shadowRadius: 24,
  elevation: 8,
} as const;

export const card = {
  backgroundColor: colors.card,
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.border,
  ...cardShadow,
} as const;
