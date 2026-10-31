import { useEffect } from 'react';

type Lock = { release: () => Promise<void> };

/** The screen stays awake while `on` (asked again when the page comes back from the background). */
export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Lock> } }).wakeLock;
    if (!wakeLock) return;
    let lock: Lock | null = null;
    let done = false;
    const ask = () => {
      if (document.visibilityState !== 'visible') return;
      wakeLock
        .request('screen')
        .then((l) => {
          if (done) void l.release().catch(() => undefined);
          else lock = l;
        })
        .catch(() => undefined);
    };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', ask);
      void lock?.release().catch(() => undefined);
    };
  }, [on]);
}
