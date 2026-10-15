import { colors } from '../theme';
/**
 * Social handles: parsing, validation and the links built from them.
 *
 * Pure, with no React Native import, so it can be unit-tested — the component
 * that draws them (SocialRow.tsx) takes everything from here.
 *
 * Handles are stored, never URLs. The app builds the address itself, so a member
 * pasting a link cannot send other members somewhere unexpected.
 */

export interface SocialLinks {
  instagram?: string;
  snapchat?: string;
  tiktok?: string;
  facebook?: string;
}

export type SocialKey = keyof SocialLinks;

export interface Network {
  key: SocialKey;
  label: string;
  icon: string;
  color: string;
  url: (handle: string) => string;
}

export const SOCIAL_NETWORKS: Network[] = [
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#C13584', url: h => `https://instagram.com/${h}` },
  { key: 'snapchat', label: 'Snapchat', icon: 'logo-snapchat', color: '#B8A400', url: h => `https://snapchat.com/add/${h}` },
  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', color: colors.text, url: h => `https://tiktok.com/@${h}` },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2', url: h => `https://facebook.com/${h}` },
];

/**
 * Turns what people actually paste into a handle: a full profile URL, an
 * @mention, or the handle itself.
 */
export const cleanHandle = (raw: string): string =>
  raw
    .trim()
    // A pasted address: drop scheme, host and the first slash.
    .replace(/^(https?:\/\/)?(www\.)?[a-z0-9-]+\.[a-z.]{2,}\//i, '')
    .replace(/^@/, '')
    // Anything after a slash, question mark or hash is not part of the handle.
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '') // tiktok.com/@name leaves a second @
    .slice(0, 30);

/** Letters, digits, dot and underscore: the shape all four platforms share. */
export const validHandle = (h: string): boolean => /^[A-Za-z0-9._]{2,30}$/.test(h);

/** True when at least one network has a handle worth showing. */
export const hasAnySocial = (s?: SocialLinks): boolean =>
  !!s && SOCIAL_NETWORKS.some(n => { const h = s[n.key]; return !!h && validHandle(h); });

/** Only the networks with a usable handle, ready to render. */
export const usableSocials = (s?: SocialLinks): { network: Network; handle: string }[] =>
  !s ? [] : SOCIAL_NETWORKS.flatMap(n => {
    const h = s[n.key];
    return h && validHandle(h) ? [{ network: n, handle: h }] : [];
  });

/** Drops half-typed entries, so a dead link never reaches another member's screen. */
export const keepUsable = (s: SocialLinks): SocialLinks =>
  Object.fromEntries(usableSocials(s).map(({ network, handle }) => [network.key, handle]));
