// How good a video made on this device is, against how fast it's made: Quick (720p, fewer bits), Standard (1080p),
// Best (more bits; a wide slideshow goes up to 4K for a big TV or projector). Shared by the Instagram video and
// slideshows.

export type VideoQuality = 'quick' | 'standard' | 'best';

export const VIDEO_QUALITIES: { id: VideoQuality; label: string; note: string }[] = [
  { id: 'quick', label: 'Quick', note: '720p · faster · small file' },
  { id: 'standard', label: 'Standard', note: '1080p · sharp on a phone or TV' },
  { id: 'best', label: 'Best', note: 'sharpest · slower · bigger file' },
];

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * The sizes to try, best first (a device that can't encode one tries the next). `w`, `h` = the 1080p size;
 * `allow4k`: a wide video may go to 4K at Best.
 */
export function qualitySizes(w: number, h: number, q: VideoQuality, allow4k = false): { w: number; h: number }[] {
  const at = (k: number) => ({ w: even(w * k), h: even(h * k) });
  if (q === 'quick') return [at(2 / 3), at(1 / 2)];
  if (q === 'best' && allow4k) return [at(2), at(4 / 3), at(1), at(2 / 3)];
  return [at(1), at(2 / 3)];
}

/** The encoder's quality for each level (Mediabunny's constants). */
export function encoderQuality<T>(mb: { QUALITY_MEDIUM: T; QUALITY_HIGH: T; QUALITY_VERY_HIGH: T }, q: VideoQuality): T {
  return q === 'quick' ? mb.QUALITY_MEDIUM : q === 'best' ? mb.QUALITY_VERY_HIGH : mb.QUALITY_HIGH;
}

const KEY = 'footballVideoQuality';
export function savedQuality(): VideoQuality {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'quick' || v === 'best' ? v : 'standard';
  } catch {
    return 'standard';
  }
}
export function saveQuality(q: VideoQuality) {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    /* private window */
  }
}
