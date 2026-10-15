import React from 'react';
import { Icon, IconName } from './Icon';

/**
 * Some values saved in the database are emojis (a community's emoji, a special day's
 * emoji). They are stored exactly as before; on screen they are drawn as a Lucide icon.
 * Unknown emoji → a neutral icon.
 */
const EMOJI_ICON: Record<string, IconName> = {
  '💪': 'barbell',
  '🏋': 'barbell',
  '🏃': 'walk',
  '🌱': 'leaf',
  '🔥': 'flame',
  '🧘': 'body',
  '🤸': 'body',
  '⚡': 'flash',
  '🥊': 'hand-left',
  '🚴': 'bicycle',
  '🏆': 'trophy',
  '❤': 'heart',
  '💬': 'chatbubble',
  '⭐': 'star',
  '🌙': 'moon',
  '📅': 'calendar',
};

/** Strips variation selectors / skin tones / zero-width joiners so '🏋️‍♀️' finds '🏋'. */
const base = (e: string) => [...e.replace(/[\uFE0F\u200D\u2640\u2642\u{1F3FB}-\u{1F3FF}]/gu, '')][0] ?? '';

export const emojiIconName = (emoji: string | null | undefined, fallback: IconName = 'ellipse'): IconName =>
  (emoji && EMOJI_ICON[base(emoji)]) || fallback;

export const EmojiIcon: React.FC<{ emoji: string | null | undefined; size?: number; color?: string; fallback?: IconName }> = ({ emoji, size = 16, color, fallback }) => (
  <Icon name={emojiIconName(emoji, fallback)} size={size} color={color} />
);
