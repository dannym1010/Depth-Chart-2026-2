// A game's shared Film Room data (notes, drawings, Drive folder) for everyone on the team: kept on this
// device, live from the cloud, and saved merged with what other coaches already saved.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanFirestoreData, getFirebaseServices, isFirestoreQuotaPaused, isReadOnlySession, safeJSONParse, safeJSONSet } from '../services/storageService';
import { mergeShared, sharedDocId } from './sharedMerge';
import { emptyShared, type FilmGameShared } from './types';

const cacheKey = (docId: string) => `footballFilmroom_${docId}`;

export function useSharedGame(teamId: string, gameKey: string | undefined) {
  const docId = gameKey ? sharedDocId(teamId, gameKey) : '';
  const [shared, setShared] = useState<FilmGameShared>(() => (docId ? safeJSONParse(cacheKey(docId), emptyShared()) : emptyShared()));
  const sharedRef = useRef(shared);
  sharedRef.current = shared;

  const adopt = useCallback(
    (incoming: Partial<FilmGameShared> | undefined) => {
      if (!docId || !incoming) return;
      const merged = mergeShared(sharedRef.current, incoming);
      if (JSON.stringify(merged) === JSON.stringify(sharedRef.current)) return;
      sharedRef.current = merged;
      setShared(merged);
      safeJSONSet(cacheKey(docId), merged);
    },
    [docId]
  );

  // Switch game: this device's copy first, then live updates from the other coaches.
  useEffect(() => {
    if (!docId) return;
    const local = safeJSONParse(cacheKey(docId), emptyShared());
    sharedRef.current = local;
    setShared(local);
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return;
    const unsub = db
      .collection('teamData')
      .doc(docId)
      .onSnapshot(
        (snap: any) => {
          if (snap?.exists && !snap.metadata?.hasPendingWrites) adopt(snap.data());
        },
        (err: any) => console.warn('Film Room live updates error:', err)
      );
    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  }, [docId, adopt]);

  const saveTimer = useRef<any>(null);
  /** Change this game's shared data; saved to the cloud merged with other coaches' changes. */
  const update = useCallback(
    (change: (s: FilmGameShared) => FilmGameShared) => {
      if (!docId || isReadOnlySession()) return;
      const next = change(sharedRef.current);
      sharedRef.current = next;
      setShared(next);
      safeJSONSet(cacheKey(docId), next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const { db } = getFirebaseServices();
        if (!db || isFirestoreQuotaPaused()) return;
        const ref = db.collection('teamData').doc(docId);
        try {
          const saved: FilmGameShared = await db.runTransaction(async (tx: any) => {
            const snap = await tx.get(ref);
            const merged = mergeShared(snap?.exists ? snap.data() : undefined, sharedRef.current);
            tx.set(ref, cleanFirestoreData({ ...merged, teamId, gameKey, updatedAt: Date.now() }));
            return merged;
          });
          adopt(saved);
        } catch (err) {
          console.warn('Could not save Film Room notes:', err);
        }
      }, 500);
    },
    [docId, teamId, gameKey, adopt]
  );

  return { shared, update };
}

/**
 * The same game kept twice: one copy's notes and drawings onto the other copy's plays (old play id -> new
 * play id). Read from this device and the cloud, written merged into the other game's shared data.
 * Returns how many notes and drawings moved.
 */
export async function moveSharedNotes(teamId: string, fromKey: string, toKey: string, playIds: Map<string, string>): Promise<number> {
  const fromId = sharedDocId(teamId, fromKey);
  const toId = sharedDocId(teamId, toKey);
  let from: FilmGameShared = safeJSONParse(cacheKey(fromId), emptyShared());
  const { db } = getFirebaseServices();
  const online = Boolean(db) && !isFirestoreQuotaPaused();
  if (online) {
    try {
      const snap = await db.collection('teamData').doc(fromId).get();
      if (snap?.exists) from = mergeShared(from, snap.data());
    } catch (err) {
      console.warn('Reading Film Room notes to move:', err);
    }
  }
  const now = Date.now();
  const notes = from.notes
    .filter((n) => !from.deletedNotes?.[n.id] && playIds.has(n.playId))
    .map((n) => ({ ...n, playId: playIds.get(n.playId)!, editedAt: now }));
  const drawings = Object.fromEntries(
    Object.entries(from.drawings || {})
      .filter(([id]) => playIds.has(id))
      .map(([id, d]) => [playIds.get(id)!, { ...d, editedAt: now }])
  );
  const moved = notes.length + Object.keys(drawings).length;
  if (!moved) return 0;
  const local = mergeShared(safeJSONParse(cacheKey(toId), emptyShared()), { ...emptyShared(), notes, drawings });
  safeJSONSet(cacheKey(toId), local);
  if (online && !isReadOnlySession()) {
    const ref = db.collection('teamData').doc(toId);
    try {
      await db.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        const merged = mergeShared(snap?.exists ? snap.data() : undefined, local);
        tx.set(ref, cleanFirestoreData({ ...merged, teamId, gameKey: toKey, updatedAt: Date.now() }));
      });
    } catch (err) {
      console.warn('Could not move Film Room notes:', err);
    }
  }
  return moved;
}

/**
 * A game moved to another week (an opponent's film is kept by week): everything coaches added to it (notes,
 * drawings, clip picks, its folder) copied onto its key in that week, merged with anything already there.
 * Returns whether there was anything to copy.
 */
export async function copySharedGame(teamId: string, fromKey: string, toKey: string): Promise<boolean> {
  const fromId = sharedDocId(teamId, fromKey);
  const toId = sharedDocId(teamId, toKey);
  let from: FilmGameShared = safeJSONParse(cacheKey(fromId), emptyShared());
  const { db } = getFirebaseServices();
  const online = Boolean(db) && !isFirestoreQuotaPaused();
  if (online) {
    try {
      const snap = await db.collection('teamData').doc(fromId).get();
      if (snap?.exists) from = mergeShared(from, snap.data());
    } catch (err) {
      console.warn('Reading Film Room notes to move:', err);
    }
  }
  const empty = !from.notes.length && !Object.keys(from.drawings || {}).length && !from.drive && !from.folderPick && !from.clipPicks && !from.removedClips;
  if (empty) return false;
  const local = mergeShared(safeJSONParse(cacheKey(toId), emptyShared()), from);
  safeJSONSet(cacheKey(toId), local);
  if (online && !isReadOnlySession()) {
    const ref = db.collection('teamData').doc(toId);
    try {
      await db.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        const merged = mergeShared(snap?.exists ? snap.data() : undefined, local);
        tx.set(ref, cleanFirestoreData({ ...merged, teamId, gameKey: toKey, updatedAt: Date.now() }));
      });
    } catch (err) {
      console.warn('Could not move Film Room notes:', err);
    }
  }
  return true;
}
