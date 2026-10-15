// Shared design tokens. Every value here comes from src/config/clubTheme.ts:
// change the club there, never here, and never hardcode a color in a screen.
// The club's primary color is reserved for the main action of a screen and for
// the active tab; everything else is neutral.
import clubTheme from './config/clubTheme';

const c = clubTheme.colors;

export const colors = {
  brand: c.primary,
  brandDark: c.primaryDark,
  brandSoft: c.primaryLight,
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
  disabled: '#C4C4C4',
  white: '#FFFFFF',
  black: '#000000',
  tabActive: c.tabActive,
  tabInactive: c.tabInactive,
  notification: c.notification,

  // Level colors: `bar` for fills (>=3:1), `text` for copy (>=4.5:1 on white), `soft` for pill backgrounds
  green: { bar: c.success, text: c.successText, soft: c.successLight },
  amber: { bar: c.warning, text: c.warningText, soft: c.warningLight },
  red: { bar: c.danger, text: c.dangerText, soft: c.dangerLight },

  // Golden records (coach-validated)
  gold: { bg: '#FFF8E1', soft: '#FDECB0', border: '#F2C94C', bar: '#E9B824', deep: '#B7791F', text: '#6B4300', ink: '#3A2A00' },

  flame: '#EA580C',
  flameSoft: '#FFEDD5',
  flameText: '#9A3412',

  // Community accents (Mur bubbles, muscle tiles)
  pink: { bar: '#D6336C', text: '#B02356', soft: '#FCE4EE' },
  violet: { bar: '#7048E8', text: '#5A34C7', soft: '#ECE6FD' },
  teal: { bar: '#0C8599', text: '#0A6E80', soft: '#DFF4F7' },

  // Dark surfaces (QR scanner, login)
  night: c.loginBackground,
  nightSurface: '#1C1C1E',
  nightLine: '#3A3A3C',
  nightSuccess: '#86EFAC',
  nightDanger: '#FCA5A5',

  // Third-party brand colors: these stay what WhatsApp makes them
  whatsapp: '#25D366',
  whatsappDark: '#128C7E',
};

/** The club's ink at a given opacity: overlays, scrims, photo labels. */
export const ink = (alpha: number) => `rgba(17,17,17,${alpha})`;
/** The club's primary color at a given opacity: glows, button shadows. */
export const brandAlpha = (alpha: number) => `rgba(${c.primaryRgb},${alpha})`;

export const fonts = clubTheme.fonts;
export const radius = clubTheme.radius;
export { clubTheme };

export type Level = 'green' | 'amber' | 'red';

/** Named community accents used by the Mur bubbles (bar = solid, soft = tinted bg, text = readable). */
export type CommunityColor = 'accent' | 'teal' | 'calm' | 'pink' | 'gold' | 'mid' | 'violet' | 'busy';
export const communityTint = (c: CommunityColor): { bar: string; soft: string; text: string } => {
  switch (c) {
    case 'accent': return { bar: colors.brand, soft: colors.brandSoft, text: colors.brand };
    case 'teal': return colors.teal;
    case 'calm': return { bar: colors.green.bar, soft: colors.green.soft, text: colors.green.text };
    case 'pink': return colors.pink;
    case 'gold': return { bar: colors.gold.bar, soft: colors.gold.soft, text: colors.gold.deep };
    case 'mid': return { bar: colors.amber.bar, soft: colors.amber.soft, text: colors.amber.text };
    case 'violet': return colors.violet;
    case 'busy': return { bar: colors.red.bar, soft: colors.red.soft, text: colors.red.text };
  }
};

export const cardShadow = {
  shadowColor: colors.black,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

/** The red glow under the club's primary buttons. */
export const buttonShadow = {
  shadowColor: colors.brand,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 10,
  elevation: 4,
} as const;

export const card = {
  backgroundColor: colors.card,
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.divider,
  ...cardShadow,
} as const;
