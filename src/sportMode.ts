export type ActiveSport = 'football' | 'basketball';

const STORAGE_KEY = 'mahopac_active_sport';
const EVENT_NAME = 'mahopac:sport-change';
const BASKETBALL_HOST_PATTERN = /court|hoops|bball|basketball/i;
const FOOTBALL_HOST_PATTERN = /field-general|football/i;

export function isDedicatedBasketballHost(hostname?: string): boolean {
  const host = hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  return BASKETBALL_HOST_PATTERN.test(host);
}

/** Detect the active sport from URL query/path/hostname, falling back to saved sport. */
export function detectSportFromUrl(urlStr: string, savedSport?: string | null): ActiveSport {
  let url: URL;
  try {
    url = new URL(urlStr, 'https://localhost');
  } catch {
    return savedSport === 'basketball' ? 'basketball' : 'football';
  }

  const queryApp = url.searchParams.get('app')?.toLowerCase();
  if (queryApp === 'basketball' || queryApp === 'hoops' || queryApp === 'court') return 'basketball';
  if (queryApp === 'football') return 'football';

  const path = url.pathname.toLowerCase();
  if (
    path === '/basketball' ||
    path.startsWith('/basketball/') ||
    path === '/hoops' ||
    path.startsWith('/hoops/') ||
    path === '/court' ||
    path.startsWith('/court/') ||
    path === '/court-studio'
  ) {
    return 'basketball';
  }
  if (path === '/football' || path.startsWith('/football/') || path === '/field-general') {
    return 'football';
  }

  const host = url.hostname.toLowerCase();
  if (BASKETBALL_HOST_PATTERN.test(host)) return 'basketball';
  if (FOOTBALL_HOST_PATTERN.test(host)) return 'football';

  return savedSport === 'basketball' ? 'basketball' : 'football';
}

export function syncDocumentTitle(sport: ActiveSport): void {
  if (typeof document === 'undefined') return;
  document.title =
    sport === 'basketball'
      ? 'Court Studio — Basketball Operations & Film'
      : 'Field General — Football Operations Manager';
}

/** Read the active sport from URL query/path/hostname or localStorage. */
export function getActiveSport(): ActiveSport {
  if (typeof window === 'undefined') return 'football';
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore storage error */
  }
  return detectSportFromUrl(window.location.href, saved);
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
    if (sport === 'basketball') {
      if (isDedicatedBasketballHost(url.hostname)) {
        if (url.pathname.startsWith('/basketball')) url.pathname = '/';
      } else if (url.pathname === '/') {
        url.pathname = '/basketball';
      }
    } else if (
      sport === 'football' &&
      (url.pathname.startsWith('/basketball') ||
        url.pathname.startsWith('/hoops') ||
        url.pathname.startsWith('/court'))
    ) {
      url.pathname = '/';
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* ignore URL update issues */
  }
  syncDocumentTitle(sport);
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
