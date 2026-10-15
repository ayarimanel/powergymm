/**
 * Removes emojis from a label before it is shown. For texts the app stores or builds
 * with emojis inside (onboarding option labels, recap lines): the data stays as it is,
 * only the screen drops the emoji. Never used on what members write.
 */
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u2195\u2194]/gu;

export const withoutEmoji = (text: string): string => text.replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
