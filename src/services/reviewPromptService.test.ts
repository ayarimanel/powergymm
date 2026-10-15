import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

import { shouldAskForReview } from './reviewPromptService';

const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe('Google review prompt', () => {
  it('waits one week of use', () => {
    expect(shouldAskForReview({ firstOpenAt: daysAgo(6), status: 'never', asks: 0 }, NOW)).toBe(false);
    expect(shouldAskForReview({ firstOpenAt: daysAgo(7), status: 'never', asks: 0 }, NOW)).toBe(true);
  });
  it('"Plus tard" asks again two weeks later, at most twice', () => {
    expect(shouldAskForReview({ firstOpenAt: daysAgo(20), status: 'later', askedAt: daysAgo(10), asks: 1 }, NOW)).toBe(false);
    expect(shouldAskForReview({ firstOpenAt: daysAgo(30), status: 'later', askedAt: daysAgo(15), asks: 1 }, NOW)).toBe(true);
    expect(shouldAskForReview({ firstOpenAt: daysAgo(60), status: 'later', askedAt: daysAgo(30), asks: 2 }, NOW)).toBe(false);
  });
  it('never again once the member opened Google', () => {
    expect(shouldAskForReview({ firstOpenAt: daysAgo(90), status: 'done', askedAt: daysAgo(60), asks: 1 }, NOW)).toBe(false);
  });
});
