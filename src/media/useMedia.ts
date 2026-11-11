// The team's Media library for a season: kept on this device, live from the cloud, and saved merged with what other
// coaches saved (the same way as Highlights). Only the metadata is kept; the photos stay in Google Drive.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFirebaseServices, isFirestoreQuotaPaused, isReadOnlySession, safeJSONParse, safeJSONSet, withoutUndefined } from '../services/storageService';
import { bigGet, bigSet } from '../utils/bigLocalStore';
import { sharedDocId } from '../filmroom/sharedMerge';
import { emptyMedia, mergeMedia, photosMissingFrom } from './mediaData';
import type { MediaData } from './types';

export interface MediaStore {
  data: MediaData;
  update: (change: (d: MediaData) => MediaData) => void;
  /** Why the last cloud save failed ('' when it worked): shown so a coach knows it is only on this device. */
  saveError: string;
  /** Read-only session (a player or family account, or the app can't save). */
  readOnly: boolean;
}

/**
 * `helper`: a family's Highlights helper: their account is read-only, but it may save the team's Media too (the
 * database lets the access list's highlighters write this one doc).
 */
export function useMedia(teamId: string, season: string, opts: { helper?: boolean } = {}): MediaStore {
  const helper = Boolean(opts.helper);
  const cantSave = () => isReadOnlySession() && !helper;
  const docId = sharedDocId(teamId, `media_${season}`);
  const cacheKey = `footballMedia_${docId}`;
  const [data, setData] = useState<MediaData>(() => mergeMedia(safeJSONParse(cacheKey, emptyMedia()), undefined));
  const ref = useRef(data);
  ref.current = data;
  const saveRef = useRef<((change: (d: MediaData) => MediaData) => void) | null>(null);

  const keep = useCallback(
    (next: MediaData) => {
      ref.current = next;
      setData(next);
      safeJSONSet(cacheKey, next);
      bigSet(cacheKey, next);
    },
    [cacheKey]
  );

  const adopt = useCallback(
    (incoming: Partial<MediaData> | undefined) => {
      if (!incoming) return;
      const merged = mergeMedia(ref.current, incoming);
      if (JSON.stringify(merged) !== JSON.stringify(ref.current)) keep(merged);
    },
    [keep]
  );

  useEffect(() => {
    const local = mergeMedia(safeJSONParse(cacheKey, emptyMedia()), undefined);
    ref.current = local;
    setData(local);
    // The bigger local copy (browser storage can drop the small one when it's full).
    void bigGet<MediaData>(cacheKey).then((saved) => saved && adopt(saved));
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return;
    const unsub = db
      .collection('teamData')
      .doc(docId)
      .onSnapshot(
        (snap: any) => {
          if (!snap?.exists || snap.metadata?.hasPendingWrites) return;
          const cloud = snap.data();
          adopt(cloud);
          // This device has photo tags / ratings the cloud lost (a folder removed under the old rule dropped them):
          // send them back.
          if (!cantSave() && photosMissingFrom(cloud, ref.current) > 0) saveRef.current?.((d) => d);
        },
        (err: any) => console.warn('Media live updates error:', err)
      );
    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  }, [docId, cacheKey, adopt]);

  const saveTimer = useRef<any>(null);
  const [saveError, setSaveError] = useState('');
  const update = useCallback(
    (change: (d: MediaData) => MediaData) => {
      if (cantSave()) return;
      keep(change(ref.current));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const { db } = getFirebaseServices();
        if (!db) return setSaveError('Not connected to the cloud: kept on this device only.');
        if (isFirestoreQuotaPaused()) return setSaveError('Cloud saves are paused (the daily limit): kept on this device until they resume.');
        const docRef = db.collection('teamData').doc(docId);
        try {
          const saved: MediaData = await db.runTransaction(async (tx: any) => {
            const snap = await tx.get(docRef);
            const merged = mergeMedia(snap?.exists ? snap.data() : undefined, ref.current);
            tx.set(docRef, withoutUndefined({ ...merged, teamId, season, updatedAt: Date.now() }));
            return merged;
          });
          adopt(saved);
          setSaveError('');
        } catch (err: any) {
          console.warn('Could not save media:', err);
          setSaveError(`Couldn't save to the cloud: ${err?.message || String(err)}`);
        }
      }, 600);
    },
    [docId, teamId, season, keep, adopt, helper] // eslint-disable-line react-hooks/exhaustive-deps
  );
  saveRef.current = update;

  return { data, update, saveError, readOnly: cantSave() };
}

