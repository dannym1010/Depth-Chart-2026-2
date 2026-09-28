// Who sees the Film Room while it is in testing: the program owner, the local developer login,
// emails listed in VITE_FILMROOM_BETA_EMAILS, or a device unlocked with the private link (#...?unlock=).
import { canUseLocalDeveloperLogin, hasLocalDeveloperSession } from '../utils/localDeveloperAuth';
import { isProgramAdminEmail } from '../utils/staffAccess';

const STORAGE_KEY = 'footballFilmroomBeta';
const UNLOCK_TOKEN = 'filmroom-beta-10u';

function allowedEmails(): string[] {
  const raw = String((import.meta as { env?: Record<string, string> }).env?.VITE_FILMROOM_BETA_EMAILS || '');
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isUnlockedHere(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'unlocked';
  } catch {
    return false;
  }
}

/** "#/filmroom?unlock=<token>" unlocks the Film Room on this device. */
export function tryUnlockFilmroomFromHash(hash: string): boolean {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  if (new URLSearchParams(q).get('unlock') !== UNLOCK_TOKEN) return false;
  try {
    localStorage.setItem(STORAGE_KEY, 'unlocked');
  } catch {
    /* ignore */
  }
  return true;
}

export function canAccessFilmroom(user?: { email?: string; isLocalDeveloperAuth?: boolean } | null): boolean {
  if (typeof window === 'undefined') return false;
  if (user?.isLocalDeveloperAuth) return true;
  if (canUseLocalDeveloperLogin() && hasLocalDeveloperSession()) return true;
  const email = String(user?.email || '').toLowerCase().trim();
  if (email === 'developer@localhost' || isProgramAdminEmail(email)) return true;
  if (email && allowedEmails().includes(email)) return true;
  return isUnlockedHere();
}
