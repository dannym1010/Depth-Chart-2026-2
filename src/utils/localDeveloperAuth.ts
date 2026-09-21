export const LOCAL_DEV_SESSION_KEY = 'football_local_dev_auth';
export const LOCAL_DEV_EMAIL = 'developer@localhost';
export const LOCAL_DEV_DISPLAY_NAME = 'Local Developer';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Loopback only. Hostnames that merely contain "local" are not allowed. */
export function isLocalDeveloperHost(hostname?: string): boolean {
  if (typeof window === 'undefined' && hostname == null) return false;
  const host = (hostname ?? window.location.hostname).toLowerCase().trim();
  return LOOPBACK_HOSTS.has(host);
}

export function canUseLocalDeveloperLogin(): boolean {
  return isLocalDeveloperHost();
}

export function clearLocalDeveloperSession(): void {
  try {
    sessionStorage.removeItem(LOCAL_DEV_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function hasLocalDeveloperSession(): boolean {
  if (!isLocalDeveloperHost()) {
    clearLocalDeveloperSession();
    return false;
  }
  try {
    return sessionStorage.getItem(LOCAL_DEV_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markLocalDeveloperSession(): boolean {
  if (!isLocalDeveloperHost()) return false;
  try {
    sessionStorage.setItem(LOCAL_DEV_SESSION_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

export function buildLocalDeveloperUser() {
  return {
    email: LOCAL_DEV_EMAIL,
    displayName: LOCAL_DEV_DISPLAY_NAME,
    isAdminPasscodeAuth: true,
    isLocalDeveloperAuth: true,
  };
}
