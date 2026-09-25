const STORAGE_KEY = 'footballLastPrintPrefs';
export const SHARED_PRINT_KIND = 'shared';

export const SHARED_PRINT_DEFAULTS = {
  inkFriendly: true,
  orientation: 'landscape' as const,
};

type SharedPrintPrefs = typeof SHARED_PRINT_DEFAULTS;

function readAll(): Record<string, Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Record<string, unknown>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // private mode / quota
  }
}

function asOrientation(value: unknown): 'landscape' | 'portrait' | undefined {
  if (value === 'landscape' || value === 'portrait') return value;
  return undefined;
}

export function loadSharedPrintPrefs(): SharedPrintPrefs {
  const saved = readAll()[SHARED_PRINT_KIND];
  const orientation = asOrientation(saved?.orientation) || SHARED_PRINT_DEFAULTS.orientation;
  const inkFriendly =
    typeof saved?.inkFriendly === 'boolean' ? saved.inkFriendly : SHARED_PRINT_DEFAULTS.inkFriendly;
  return { inkFriendly, orientation };
}

export function loadPrintPrefs<T extends Record<string, unknown>>(kind: string, fallback: T): T {
  const all = readAll();
  const saved = all[kind];
  const shared = all[SHARED_PRINT_KIND] || {};
  const next = { ...fallback };
  if (saved && typeof saved === 'object') {
    (Object.keys(fallback) as Array<keyof T>).forEach((key) => {
      if (saved[key as string] !== undefined) {
        next[key] = saved[key as string] as T[keyof T];
      }
    });
  }
  if ('inkFriendly' in fallback && typeof shared.inkFriendly === 'boolean') {
    (next as Record<string, unknown>).inkFriendly = shared.inkFriendly;
  }
  if ('orientation' in fallback) {
    const orientation = asOrientation(shared.orientation);
    if (orientation) (next as Record<string, unknown>).orientation = orientation;
  }
  return next;
}

export function savePrintPrefs(kind: string, prefs: Record<string, unknown>) {
  const all = readAll();
  all[kind] = { ...prefs, savedAt: Date.now() };

  const shared = { ...(all[SHARED_PRINT_KIND] || {}), savedAt: Date.now() };
  if (typeof prefs.inkFriendly === 'boolean') shared.inkFriendly = prefs.inkFriendly;
  const orientation = asOrientation(prefs.orientation);
  if (orientation) shared.orientation = orientation;
  if (prefs.colorMode === 'ink_friendly') shared.inkFriendly = true;
  if (prefs.colorMode === 'color' || prefs.colorMode === 'sideline_contrast') shared.inkFriendly = false;
  all[SHARED_PRINT_KIND] = shared;

  writeAll(all);
}
