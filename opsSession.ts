import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const OPS_SESSION_COOKIE = 'mah_ops_sid';
export const OPS_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const FIREBASE_WEB_API_KEY = 'AIzaSyByWAe6BpeDboNzqsC_NxWw0pfnca0sfqE';

export type OpsSession = {
  email: string;
  role: 'admin' | 'coach';
  createdAt: number;
  expiresAt: number;
};

const sessions = new Map<string, OpsSession>();
const loginAttempts = new Map<string, { count: number; windowStart: number }>();

export function isLoopbackRequest(req: Request): boolean {
  const raw = String(req.socket?.remoteAddress || '');
  const ip = raw.replace(/^::ffff:/i, '').toLowerCase();
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left.length ? left : Buffer.from('x'), left.length ? left : Buffer.from('x'));
    return false;
  }
  if (left.length === 0) return true;
  return crypto.timingSafeEqual(left, right);
}

export function allowLoginAttempt(req: Request): boolean {
  const ip = String(req.socket?.remoteAddress || 'unknown');
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.windowStart > 60_000) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  rec.count += 1;
  return rec.count <= 12;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function pruneSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

export function createOpsSession(email: string, role: OpsSession['role']): string {
  pruneSessions();
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    email: email.toLowerCase().trim(),
    role,
    createdAt: now,
    expiresAt: now + OPS_SESSION_TTL_MS,
  });
  return token;
}

export function destroyOpsSession(token: string | undefined) {
  if (token) sessions.delete(token);
}

export function readOpsSessionToken(req: Request): string | undefined {
  const cookies = parseCookies(req.headers.cookie);
  const fromCookie = cookies[OPS_SESSION_COOKIE];
  if (fromCookie) return fromCookie;
  const auth = String(req.headers.authorization || '');
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return undefined;
}

export function getOpsSession(req: Request): OpsSession | null {
  pruneSessions();
  const token = readOpsSessionToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + OPS_SESSION_TTL_MS;
  return session;
}

export function setOpsSessionCookie(res: Response, token: string) {
  const maxAge = Math.floor(OPS_SESSION_TTL_MS / 1000);
  const parts = [
    `${OPS_SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearOpsSessionCookie(res: Response) {
  res.setHeader(
    'Set-Cookie',
    `${OPS_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export function requireOpsSession(req: Request, res: Response, next: NextFunction) {
  const session = getOpsSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  (req as Request & { opsSession: OpsSession }).opsSession = session;
  next();
}

export async function verifyFirebaseIdToken(idToken: string): Promise<string | null> {
  const token = String(idToken || '').trim();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { users?: Array<{ email?: string }> };
    const email = data?.users?.[0]?.email;
    return email ? email.toLowerCase().trim() : null;
  } catch {
    return null;
  }
}
