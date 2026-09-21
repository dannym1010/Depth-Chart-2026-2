import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const MAXMEM = 64 * 1024 * 1024;
const PREFIX = 'scrypt';

export function isPasscodeHash(value: string | null | undefined): boolean {
  return String(value || '').startsWith(`${PREFIX}$`);
}

export function hashPasscode(passcode: string): string {
  const trimmed = String(passcode || '').trim();
  if (!trimmed) {
    throw new Error('Passcode is required.');
  }
  const salt = randomBytes(16);
  const key = scryptSync(trimmed, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAXMEM,
  });
  return [PREFIX, String(SCRYPT_N), String(SCRYPT_R), String(SCRYPT_P), salt.toString('hex'), key.toString('hex')].join(
    '$'
  );
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  const trimmed = String(passcode || '').trim();
  const record = String(stored || '').trim();
  if (!trimmed || !record) return false;
  if (!isPasscodeHash(record)) {
    const a = Buffer.from(trimmed);
    const b = Buffer.from(record);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
  const parts = record.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (!salt.length || !expected.length || !N || !r || !p) return false;
  const actual = scryptSync(trimmed, salt, expected.length, { N, r, p, maxmem: MAXMEM });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function hasPasscodeConfigured(state: { adminPasscodeHash?: string; adminPasscode?: string } | null | undefined): boolean {
  if (!state) return false;
  if (isPasscodeHash(state.adminPasscodeHash) || String(state.adminPasscodeHash || '').length > 0) {
    return true;
  }
  return String(state.adminPasscode || '').trim().length > 0;
}

export function sanitizeStateSecrets(state: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!state || typeof state !== 'object') return state ?? null;
  const next: Record<string, any> = { ...state };
  delete next.adminPasscode;
  delete next.adminPasscodeHash;
  next.adminPasscodeSet = hasPasscodeConfigured(state);
  return next;
}
