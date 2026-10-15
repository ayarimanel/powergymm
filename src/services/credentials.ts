/**
 * Local credential hashing.
 *
 * Why this exists: accounts used to be unlocked with the member's phone number,
 * which the app prints on screen (a coach's number is on his booking sheet). The
 * secret is now a PIN the member chooses, stored salted and stretched instead of
 * in the clear.
 *
 * What it is NOT: this is device-local, so anyone who can read the phone's
 * storage can read the stored profile anyway. It stops someone signing in with
 * information the app itself displays. Real credential security arrives with
 * Supabase Auth, where the check happens on a server.
 *
 * SHA-256 is implemented here because the project has no crypto dependency and
 * neither React Native nor react-native-web ships one everywhere. It is checked
 * against the FIPS 180-4 vectors in credentials.test.ts.
 */

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** UTF-8 bytes of a string. */
const utf8 = (s: string): number[] => {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
};

const toHex = (words: number[]) => words.map(w => (w >>> 0).toString(16).padStart(8, '0')).join('');

/** SHA-256 of a byte array, as eight 32-bit words. */
const sha256Bytes = (bytes: number[]): number[] => {
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const len = bytes.length;
  const withPad = bytes.slice();
  withPad.push(0x80);
  while (withPad.length % 64 !== 56) withPad.push(0);

  // 64-bit big-endian bit length; lengths here are far below 2^32 bytes.
  const bits = len * 8;
  withPad.push(0, 0, 0, 0);
  withPad.push((bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);

  const w = new Array<number>(64);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const j = i + t * 4;
      w[t] = ((withPad[j]! << 24) | (withPad[j + 1]! << 16) | (withPad[j + 2]! << 8) | withPad[j + 3]!) >>> 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15]!, 7) ^ rotr(w[t - 15]!, 18) ^ (w[t - 15]! >>> 3);
      const s1 = rotr(w[t - 2]!, 17) ^ rotr(w[t - 2]!, 19) ^ (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H as [number, number, number, number, number, number, number, number];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0]! + a) >>> 0;
    H[1] = (H[1]! + b) >>> 0;
    H[2] = (H[2]! + c) >>> 0;
    H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0;
    H[5] = (H[5]! + f) >>> 0;
    H[6] = (H[6]! + g) >>> 0;
    H[7] = (H[7]! + h) >>> 0;
  }
  return H;
};

export const sha256 = (s: string): string => toHex(sha256Bytes(utf8(s)));

/** Random enough for a per-account salt; this is not a key. */
export const makeSalt = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;

/**
 * Stretching rounds. Pure JS, so this is a compromise: high enough that guessing
 * a 4-digit PIN from the stored hash is not instant, low enough that an old phone
 * still signs in without a visible pause.
 */
export const ROUNDS = 600;

export const hashSecret = (secret: string, salt: string): string => {
  let h = sha256(`${salt}:${secret}`);
  for (let i = 1; i < ROUNDS; i++) h = sha256(`${h}:${salt}`);
  return h;
};

/** Constant-time-ish compare: equal length, no early exit on the first difference. */
export const secretMatches = (secret: string, salt: string, expected: string): boolean => {
  const got = hashSecret(secret, salt);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
};

/** A PIN is 4 to 8 digits. Obvious sequences are refused, not just weak ones. */
const BANNED_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '12345678', '123456']);

export const pinError = (pin: string): string | null => {
  const p = pin.trim();
  if (!/^\d{4,8}$/.test(p)) return 'Choisis un code de 4 à 8 chiffres.';
  if (BANNED_PINS.has(p)) return 'Ce code est trop facile à deviner.';
  return null;
};
