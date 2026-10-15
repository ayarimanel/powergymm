import { describe, expect, it } from 'vitest';
import { EN } from './en';
import { translate } from './index';

describe('translation lookup', () => {
  it('returns English when there is an entry', () => {
    expect(translate('en', 'Rejoindre')).toBe('Join');
  });

  it('falls back to the French rather than showing a key', () => {
    // The whole point: an unconverted screen still reads correctly.
    expect(translate('en', 'Une phrase pas encore traduite')).toBe('Une phrase pas encore traduite');
  });

  it('leaves French alone', () => {
    expect(translate('fr', 'Rejoindre')).toBe('Rejoindre');
  });

  it('fills in variables in both languages', () => {
    expect(translate('en', 'Aucun membre ne correspond à « {q} ».', { q: 'sami' })).toBe('No member matches “sami”.');
    expect(translate('fr', 'Aucun membre ne correspond à « {q} ».', { q: 'sami' })).toContain('sami');
  });

  it('leaves an unknown placeholder visible instead of printing undefined', () => {
    expect(translate('fr', 'Bonjour {nom}', {})).toBe('Bonjour {nom}');
  });
});

describe('the dictionary', () => {
  it('never maps a string to an empty translation', () => {
    for (const [fr, en] of Object.entries(EN)) {
      expect(en.trim(), `empty translation for "${fr}"`).not.toBe('');
    }
  });

  it('keeps the placeholders on both sides', () => {
    for (const [fr, en] of Object.entries(EN)) {
      const inFr = [...fr.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      const inEn = [...en.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      expect(inEn, `placeholders differ for "${fr}"`).toEqual(inFr);
    }
  });

  it('has no French left in an English value', () => {
    // A copy-paste slip: the English column still holding the French sentence.
    for (const [fr, en] of Object.entries(EN)) {
      if (fr.length > 12) expect(en, `untranslated: "${fr}"`).not.toBe(fr);
    }
  });
});
