import AsyncStorage from '@react-native-async-storage/async-storage';

/** Per member: first time he opened the app, and what he did with the review prompt. */
interface ReviewState {
  firstOpenAt: string;
  /** 'done' = opened Google, never ask again. */
  status: 'never' | 'later' | 'done';
  askedAt?: string;
  asks: number;
}

const KEY = (userId: string) => `@gym_app_review_prompt_v1_${userId}`;
const DAY = 86_400_000;
export const REVIEW_AFTER_DAYS = 7;
const RETRY_AFTER_DAYS = 14;
const MAX_ASKS = 2;

const read = async (userId: string): Promise<ReviewState> => {
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    if (raw) return JSON.parse(raw) as ReviewState;
  } catch {
    /* fresh state below */
  }
  const fresh: ReviewState = { firstOpenAt: new Date().toISOString(), status: 'never', asks: 0 };
  await AsyncStorage.setItem(KEY(userId), JSON.stringify(fresh)).catch(() => {});
  return fresh;
};
const write = (userId: string, s: ReviewState) => AsyncStorage.setItem(KEY(userId), JSON.stringify(s)).catch(() => {});

/** Pure rule, easy to test: one week of use, not twice in two weeks, at most twice, never after a review. */
export function shouldAskForReview(s: ReviewState, now = Date.now()): boolean {
  if (s.status === 'done' || s.asks >= MAX_ASKS) return false;
  if (now - new Date(s.firstOpenAt).getTime() < REVIEW_AFTER_DAYS * DAY) return false;
  if (s.askedAt && now - new Date(s.askedAt).getTime() < RETRY_AFTER_DAYS * DAY) return false;
  return true;
}

export const ReviewPromptService = {
  /** Starts the clock on first open; true when it's time to show the prompt. */
  check: async (userId: string): Promise<boolean> => shouldAskForReview(await read(userId)),
  answer: async (userId: string, status: 'later' | 'done') => {
    const s = await read(userId);
    await write(userId, { ...s, status, askedAt: new Date().toISOString(), asks: s.asks + 1 });
  },
};
