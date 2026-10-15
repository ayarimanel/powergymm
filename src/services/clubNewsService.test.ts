import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));

import { timeAgo, toNews } from './clubNewsService';
import { ClubStatus } from './clubStatusService';

const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const H = 3_600_000;

const status = (p: Partial<ClubStatus> & { id: string }): ClubStatus => ({ kind: 'info', title: p.id, message: '', createdAt: iso(H), ...p });

describe('toNews', () => {
  it('drops expired items, puts pinned first then newest, and flags read ones', () => {
    const news = toNews(
      [
        status({ id: 'old', createdAt: iso(10 * H) }),
        status({ id: 'expired', expiresAt: iso(1) }),
        status({ id: 'pinned', pinned: true, createdAt: iso(48 * H) }),
        status({ id: 'new', createdAt: iso(5 * 60_000), kind: 'promo' }),
      ],
      new Set(['old']),
      NOW
    );
    expect(news.map(n => n.id)).toEqual(['pinned', 'new', 'old']);
    expect(news.find(n => n.id === 'old')!.read).toBe(true);
    expect(news.find(n => n.id === 'new')!.type).toBe('promo');
  });

  it('maps legacy kinds to "info" and defaults the author to the gérant', () => {
    const [n] = toNews([status({ id: 'a', kind: 'closure' })], new Set(), NOW);
    expect(n.type).toBe('info');
    expect(n.author).toBe('Gérant');
  });

  it('caps the list at 20 items', () => {
    const many = Array.from({ length: 25 }, (_, i) => status({ id: `s${i}` }));
    expect(toNews(many, new Set(), NOW)).toHaveLength(20);
  });
});

describe('timeAgo', () => {
  it('formats in French', () => {
    expect(timeAgo(iso(20_000), NOW)).toBe('à l’instant');
    expect(timeAgo(iso(5 * 60_000), NOW)).toBe('il y a 5 min');
    expect(timeAgo(iso(2 * H), NOW)).toBe('il y a 2 h');
    expect(timeAgo(iso(30 * H), NOW)).toBe('hier');
    expect(timeAgo(iso(3 * 24 * H), NOW)).toBe('il y a 3 j');
  });
});
