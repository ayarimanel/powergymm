import { describe, expect, it } from 'vitest';
import { cleanHandle, hasAnySocial, keepUsable, usableSocials, validHandle } from './socials';

describe('what people actually paste', () => {
  it('keeps a plain handle', () => {
    expect(cleanHandle('sami_lifts')).toBe('sami_lifts');
  });

  it('drops a leading @', () => {
    expect(cleanHandle('@sami_lifts')).toBe('sami_lifts');
  });

  it('pulls the handle out of a pasted profile URL', () => {
    expect(cleanHandle('https://instagram.com/sami_lifts')).toBe('sami_lifts');
    expect(cleanHandle('https://www.tiktok.com/@sami_lifts')).toBe('sami_lifts');
    expect(cleanHandle('instagram.com/sami_lifts')).toBe('sami_lifts');
  });

  it('cuts query strings and trailing paths', () => {
    expect(cleanHandle('https://instagram.com/sami_lifts?hl=fr')).toBe('sami_lifts');
    expect(cleanHandle('https://instagram.com/sami_lifts/reels')).toBe('sami_lifts');
  });

  it('trims whitespace and caps the length', () => {
    expect(cleanHandle('  sami  ')).toBe('sami');
    expect(cleanHandle('a'.repeat(60))).toHaveLength(30);
  });
});

describe('what counts as a usable handle', () => {
  it('accepts the shapes these platforms allow', () => {
    expect(validHandle('sami_lifts')).toBe(true);
    expect(validHandle('sami.lifts')).toBe(true);
    expect(validHandle('sami23')).toBe(true);
  });

  it('refuses anything that would build a broken or surprising link', () => {
    expect(validHandle('')).toBe(false);
    expect(validHandle('a')).toBe(false);
    expect(validHandle('sami lifts')).toBe(false);
    expect(validHandle('sami/../other')).toBe(false);
    expect(validHandle('évidemment')).toBe(false);
  });
});

describe('showing the row at all', () => {
  it('stays hidden when nothing was filled in', () => {
    expect(hasAnySocial(undefined)).toBe(false);
    expect(hasAnySocial({})).toBe(false);
    expect(hasAnySocial({ instagram: '' })).toBe(false);
  });

  it('stays hidden for a half-typed handle rather than showing a dead link', () => {
    expect(hasAnySocial({ instagram: 'a' })).toBe(false);
  });

  it('shows as soon as one is usable', () => {
    expect(hasAnySocial({ instagram: 'sami_lifts' })).toBe(true);
    expect(hasAnySocial({ instagram: 'a', snapchat: 'sami_lifts' })).toBe(true);
  });
});

describe('building the links', () => {
  it('points each handle at its own platform', () => {
    const [{ network, handle }] = usableSocials({ instagram: 'sami_lifts' });
    expect(network.url(handle)).toBe('https://instagram.com/sami_lifts');
    expect(usableSocials({ tiktok: 'sami' })[0]!.network.url('sami')).toBe('https://tiktok.com/@sami');
    expect(usableSocials({ snapchat: 'sami' })[0]!.network.url('sami')).toBe('https://snapchat.com/add/sami');
  });
});

describe('saving', () => {
  it('keeps only what is usable', () => {
    expect(keepUsable({ instagram: 'sami_lifts', snapchat: 'a', tiktok: '' })).toEqual({ instagram: 'sami_lifts' });
  });

  it('saves nothing when nothing is valid', () => {
    expect(keepUsable({ instagram: '', snapchat: 'x' })).toEqual({});
  });
});
