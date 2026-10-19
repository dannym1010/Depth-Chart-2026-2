// The team's Film Room favorites and playlists: kept on this device, live from the cloud, and saved merged with
// what other coaches already saved (the same way a game's notes are).
import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanFirestoreData, getFirebaseServices, isFirestoreQuotaPaused, isReadOnlySession, safeJSONParse, safeJSONSet } from '../services/storageService';
import { sharedDocId } from './sharedMerge';
import { emptyLists, mergeLists, type FilmLists } from './playlists';

export function useFilmLists(teamId: string) {
  const docId = sharedDocId(teamId, 'lists');
  const cacheKey = `footballFilmroom_${docId}`;
  const [lists, setLists] = useState<FilmLists>(() => mergeLists(safeJSONParse(cacheKey, emptyLists()), undefined));
  const listsRef = useRef(lists);
  listsRef.current = lists;

  const adopt = useCallback(
    (incoming: Partial<FilmLists> | undefined) => {
      if (!incoming) return;
      const merged = mergeLists(listsRef.current, incoming);
      if (JSON.stringify(merged) === JSON.stringify(listsRef.current)) return;
      listsRef.current = merged;
      setLists(merged);
      safeJSONSet(cacheKey, merged);
    },
    [cacheKey]
  );

  useEffect(() => {
    const local = mergeLists(safeJSONParse(cacheKey, emptyLists()), undefined);
    listsRef.current = local;
    setLists(local);
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return;
    const unsub = db
      .collection('teamData')
      .doc(docId)
      .onSnapshot(
        (snap: any) => {
          if (snap?.exists && !snap.metadata?.hasPendingWrites) adopt(snap.data());
        },
        (err: any) => console.warn('Film Room playlists live updates error:', err)
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
  /** Change the favorites / playlists; saved to the cloud merged with other coaches' changes. */
  const update = useCallback(
    (change: (l: FilmLists) => FilmLists) => {
      if (isReadOnlySession()) return;
      const next = change(listsRef.current);
      listsRef.current = next;
      setLists(next);
      safeJSONSet(cacheKey, next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const { db } = getFirebaseServices();
        if (!db || isFirestoreQuotaPaused()) return;
        const ref = db.collection('teamData').doc(docId);
        try {
          const saved: FilmLists = await db.runTransaction(async (tx: any) => {
            const snap = await tx.get(ref);
            const merged = mergeLists(snap?.exists ? snap.data() : undefined, listsRef.current);
            tx.set(ref, cleanFirestoreData({ ...merged, teamId, updatedAt: Date.now() }));
            return merged;
          });
          adopt(saved);
        } catch (err) {
          console.warn('Could not save Film Room playlists:', err);
        }
      }, 500);
    },
    [docId, cacheKey, teamId, adopt]
  );

  return { lists, update };
}
