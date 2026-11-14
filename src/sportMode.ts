export type ActiveSport = 'football' | 'basketball';

const STORAGE_KEY = 'mahopac_active_sport';
const EVENT_NAME = 'mahopac:sport-change';

/** Read the active sport from URL path (/basketball), ?app= query param, or localStorage. */
export function getActiveSport(): ActiveSport {
  if (typeof window === 'undefined') return 'football';
  const params = new URLSearchParams(window.location.search);
  const queryApp = params.get('app')?.toLowerCase();
  if (queryApp === 'basketball') return 'basketball';
  if (queryApp === 'football') return 'football';

  const path = window.location.pathname.toLowerCase();
  if (path === '/basketball' || path.startsWith('/basketball/')) return 'basketball';

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'basketball') return 'basketball';
  } catch {
    /* ignore storage error */
  }
  return 'football';
}

/** Switch between Field General (football) and Court Studio (basketball) without reloading. */
export function setActiveSport(sport: ActiveSport): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, sport);
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('app', sport);
    if (sport === 'basketball' && url.pathname === '/') {
      url.pathname = '/basketball';
    } else if (sport === 'football' && url.pathname.startsWith('/basketball')) {
      url.pathname = '/';
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* ignore URL update issues */
  }
  window.dispatchEvent(new CustomEvent<ActiveSport>(EVENT_NAME, { detail: sport }));
}

export function subscribeActiveSport(listener: (sport: ActiveSport) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ActiveSport>).detail;
    listener(detail || getActiveSport());
  };
  const popHandler = () => listener(getActiveSport());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('popstate', popHandler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('popstate', popHandler);
  };
}
