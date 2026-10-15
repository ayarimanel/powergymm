import { ShopCategory } from '../types/database';
import { colors, communityTint } from '../theme';

/** Non-legacy shop categories (the union still carries 'Tous' from an earlier design). */
export type ProductCategory = Exclude<ShopCategory, 'Tous'>;

/** Icon + accent color per shop category, used by the category rail and the product cards. */
export const CATEGORY_META: Record<ProductCategory, { icon: string; tint: ReturnType<typeof communityTint>; short: string }> = {
  'Protéine': { icon: 'flash', tint: communityTint('accent'), short: 'Protéine' },
  'Gainer': { icon: 'trending-up', tint: communityTint('violet'), short: 'Gainer' },
  'Multivitamines': { icon: 'medical', tint: communityTint('calm'), short: 'Vitamines' },
  'Pre-Workout': { icon: 'flame', tint: communityTint('busy'), short: 'Pre' },
  'Accessoires': { icon: 'barbell', tint: communityTint('teal'), short: 'Accessoires' },
  'Snacks & Boissons': { icon: 'nutrition', tint: communityTint('mid'), short: 'Snacks' },
};

export const PROMO_TINT = { bar: colors.red.bar, soft: colors.red.soft, text: colors.red.text };
