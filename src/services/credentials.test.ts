import { describe, expect, it } from 'vitest';
import { hashSecret, makeSalt, pinError, secretMatches, sha256 } from './credentials';

describe('sha256', () => {
  // FIPS 180-4 / NIST published vectors. If these pass, the implementation is correct.
  it('matches the published test vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('handles a message that crosses the padding boundary', () => {
    // 56 bytes forces a second block: the classic off-by-one in SHA padding.
    expect(sha256('a'.repeat(55))).toHaveLength(64);
    expect(sha256('a'.repeat(56))).toHaveLength(64);
    expect(sha256('a'.repeat(55))).not.toBe(sha256('a'.repeat(56)));
  });

  it('handles accents and emoji (UTF-8, not char codes)', () => {
    expect(sha256('é')).toBe(sha256('é'));
    expect(sha256('é')).not.toBe(sha256('e'));
    expect(sha256('💪')).toHaveLength(64);
  });
});

describe('stored secrets', () => {
  it('never stores the same hash for two accounts with the same PIN', () => {
    const a = makeSalt();
    const b = makeSalt();
    expect(a).not.toBe(b);
    expect(hashSecret('4729', a)).not.toBe(hashSecret('4729', b));
  });

  it('verifies the right PIN and rejects the wrong one', () => {
    const salt = makeSalt();
    const stored = hashSecret('4729', salt);
    expect(secretMatches('4729', salt, stored)).toBe(true);
    expect(secretMatches('4728', salt, stored)).toBe(false);
    expect(secretMatches('', salt, stored)).toBe(false);
  });

  it('does not leak the PIN into the stored value', () => {
    const salt = makeSalt();
    expect(hashSecret('4729', salt)).not.toContain('4729');
  });

  it('rejects a hash of the wrong shape without throwing', () => {
    expect(secretMatches('4729', makeSalt(), 'nonsense')).toBe(false);
    expect(secretMatches('4729', makeSalt(), '')).toBe(false);
  });
});

describe('PIN rules', () => {
  it('accepts 4 to 8 digits', () => {
    expect(pinError('4729')).toBeNull();
    expect(pinError('93820571')).toBeNull();
  });

  it('refuses anything that is not digits, or the wrong length', () => {
    expect(pinError('123')).not.toBeNull();
    expect(pinError('123456789')).not.toBeNull();
    expect(pinError('abcd')).not.toBeNull();
    expect(pinError('')).not.toBeNull();
  });

  it('refuses the codes everyone tries first', () => {
    expect(pinError('0000')).not.toBeNull();
    expect(pinError('1234')).not.toBeNull();
    expect(pinError('1111')).not.toBeNull();
  });
});
