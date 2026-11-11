// The clips families send for a reel, in the cloud: a family's own document (they write only theirs), and every
// family's for the coaches. See familySends.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFirebaseServices, isFirestoreQuotaPaused, safeJSONParse, safeJSONSet, withoutUndefined } from '../services/storageService';
import { emptySends, mergeSends, sendsDocId, type FamilySends } from './familySends';

export interface MySends {
  data: FamilySends;
  update: (change: (d: FamilySends) => FamilySends) => void;
  /** Why the last send didn't reach the coaches ('' when it did). */
  saveError: string;
  saving: boolean;
}

/** A family's sent clips (`email` '' = none: nothing to send). */
export function useMySends(teamId: string, season: string, email: string, who: { name?: string; kids?: string[] } = {}): MySends {
  const me = String(email || '').toLowerCase().trim();
  const docId = sendsDocId(teamId, season, me);
  const cacheKey = `footballHlSends_${docId}`;
  const [data, setData] = useState<FamilySends>(() => mergeSends(emptySends(teamId, season, me), safeJSONParse(cacheKey, null)));
  const ref = useRef(data);
  ref.current = data;
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const whoRef = useRef(who);
  whoRef.current = who;

  // What's in the cloud (another device of theirs may have sent some).
  useEffect(() => {
    if (!me) return;
    const local = mergeSends(emptySends(teamId, season, me), safeJSONParse(cacheKey, null));
    ref.current = local;
    setData(local);
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return;
    let off = false;
    db.collection('teamData')
      .doc(docId)
      .get()
      .then((snap: any) => {
        if (off || !snap?.exists) return;
        const merged = mergeSends(ref.current, snap.data());
        ref.current = merged;
        setData(merged);
        safeJSONSet(cacheKey, merged);
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [docId, cacheKey, me, teamId, season]);

  const timer = useRef<any>(null);
  const update = useCallback(
    (change: (d: FamilySends) => FamilySends) => {
      if (!me) return;
      const next = change(ref.current);
      ref.current = next;
      setData(next);
      safeJSONSet(cacheKey, next);
      if (timer.current) clearTimeout(timer.current);
      setSaving(true);
      timer.current = setTimeout(async () => {
        const { db } = getFirebaseServices();
        if (!db) {
          setSaving(false);
          return setSaveError("Not connected: it's on this device, and goes to the coaches when you're back online.");
        }
        if (isFirestoreQuotaPaused()) {
          setSaving(false);
          return setSaveError('The team app has paused cloud saves for today: it goes to the coaches when they resume.');
        }
        const docRef = db.collection('teamData').doc(docId);
        try {
          const saved: FamilySends = await db.runTransaction(async (tx: any) => {
            const snap = await tx.get(docRef);
            const merged = mergeSends(snap?.exists ? snap.data() : undefined, ref.current);
            const w = whoRef.current;
            tx.set(docRef, withoutUndefined({ ...merged, kind: 'hlsend', team: teamId, season, email: me, name: w.name || merged.name, kids: w.kids || merged.kids, updatedAt: Date.now() }));
            return merged;
          });
          ref.current = mergeSends(ref.current, saved);
          setData(ref.current);
          setSaveError('');
        } catch (err: any) {
          setSaveError(
            /permission/i.test(String(err?.code || err?.message || ''))
              ? "The coaches' database didn't let this account send yet: ask a coach (the database rules need publishing)."
              : `Couldn't send: ${err?.message || String(err)}`
          );
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [me, cacheKey, docId, teamId, season]
  );
  return { data, update, saveError, saving };
}

/** Every family's sent clips for this team's season, live (coaches). `on` false = not listening. */
export function useFamilyInbox(teamId: string, season: string, on: boolean): FamilySends[] {
  const [list, setList] = useState<FamilySends[]>([]);
  useEffect(() => {
    if (!on) return setList([]);
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = db
        .collection('teamData')
        .where('kind', '==', 'hlsend')
        .where('team', '==', teamId)
        .where('season', '==', season)
        .onSnapshot(
          (snap: any) => setList((snap?.docs || []).map((d: any) => mergeSends(emptySends(teamId, season, ''), d.data()))),
          (err: any) => console.warn('Clips from families:', err?.code || err)
        );
    } catch (err) {
      console.warn('Clips from families:', err);
    }
    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
    };
  }, [teamId, season, on]);
  return list;
}
