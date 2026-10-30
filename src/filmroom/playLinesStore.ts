// The play open in a Play Builder (the playbook, or a scout script play), for the film window beside it to draw on
// its video. The Film Room passes its own builder's lines straight to its player instead.
import { useSyncExternalStore } from 'react';
import type { VideoLines } from './PlayLinesOverlay';

let current: { owner: object; lines: VideoLines } | null = null;
const subs = new Set<() => void>();

/** The builder `owner` has these lines open (null: it closed; another builder's lines are left alone). */
export function publishPlayLines(owner: object, lines: VideoLines | null) {
  if (!lines) {
    if (current?.owner !== owner) return;
    current = null;
  } else current = { owner, lines };
  subs.forEach((f) => f());
}

export function usePublishedPlayLines(): VideoLines | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current?.lines || null
  );
}
