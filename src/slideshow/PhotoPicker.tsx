// Picking photos for a slideshow from the Media library's folders (Google Drive): one game's folder or all of them,
// narrowed to a kid, a tag (poster, year-end...), favorites or stars; tap to pick, or pick everything shown.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Heart, Loader2, Users, X } from 'lucide-react';
import { pickPhotosPerKid, type KidPicks } from './kidPicks';
import type { Kid } from '../highlights/highlightData';
import { kidLabel } from '../highlights/highlightData';
import { drivePhotoThumb } from '../media/mediaSources';
import { folderPhotos } from './photoLoad';
import { isFavorite, MEDIA_TAGS, starsOf, TAG_LABELS } from '../media/mediaData';
import type { DrivePhoto, MediaData, MediaTag } from '../media/types';

export type PickedPhoto = { id: string; folderId: string; name: string; takenAt?: number };

interface Props {
  media: MediaData;
  me: string;
  roster: Kid[];
  /** Photos already in the slideshow (marked). */
  already: Set<string>;
  onAdd: (photos: PickedPhoto[]) => void;
  onSignIn: () => Promise<unknown>;
  onClose: () => void;
}

const listFolder = folderPhotos;

/** A small picture, fetched when it scrolls into view. */
const Thumb: React.FC<{ photo: DrivePhoto }> = ({ photo }) => {
  const ref = useRef<HTMLImageElement>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let off = false;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void drivePhotoThumb(photo, 240)
          .then((u) => !off && setUrl(u))
          .catch(() => undefined);
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => {
      off = true;
      io.disconnect();
    };
  }, [photo]);
  return <img ref={ref} src={url || undefined} alt="" className="absolute inset-0 w-full h-full object-cover bg-slate-200 dark:bg-slate-800" />;
};

export const PhotoPicker: React.FC<Props> = ({ media, me, roster, already, onAdd, onSignIn, onClose }) => {
  const folders = media.folders;
  const [folderId, setFolderId] = useState(() => folders[folders.length - 1]?.id || '');
  const [kid, setKid] = useState('');
  const [tag, setTag] = useState<MediaTag | ''>('');
  const [fav, setFav] = useState(false);
  const [minStars, setMinStars] = useState(0);
  const [photos, setPhotos] = useState<(DrivePhoto & { folderId: string })[]>([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const records = useMemo(() => new Map(media.photos.map((p) => [p.id, p])), [media.photos]);

  useEffect(() => {
    let off = false;
    setError('');
    const list = folderId ? folders.filter((f) => f.id === folderId) : folders;
    void (async () => {
      const out: (DrivePhoto & { folderId: string })[] = [];
      for (let k = 0; k < list.length; k++) {
        const f = list[k];
        setLoading(list.length > 1 ? `Reading folder ${k + 1} of ${list.length}…` : 'Reading the folder…');
        try {
          for (const p of await listFolder(f.driveId)) out.push({ ...p, folderId: f.id });
        } catch (err: any) {
          if (!off) setError(err?.message || String(err));
          break;
        }
        if (off) return;
      }
      if (off) return;
      setPhotos(out.sort((a, b) => a.takenAt - b.takenAt));
      setLoading('');
    })();
    return () => {
      off = true;
    };
  }, [folderId, folders, retry]);

  // Photos of every kid: so many each (remembered on this device).
  const [each, setEachState] = useState(() => {
    try {
      return Math.min(10, Math.max(1, Number(localStorage.getItem('slideshowPerKid')) || 1));
    } catch {
      return 1;
    }
  });
  const setEach = (n: number) => {
    setEachState(n);
    try {
      localStorage.setItem('slideshowPerKid', String(n));
    } catch {
      /* private window */
    }
  };
  const [perKid, setPerKid] = useState<KidPicks | null>(null);
  const pickPerKid = () => {
    // From the photos shown (the folder, tag, stars, hearts picked), every kid's own, not just the one picked.
    const pool = photos.filter((p) => {
      const r = records.get(p.id);
      if (tag && !(r?.tags || []).includes(tag)) return false;
      if (fav && !isFavorite(r, me)) return false;
      if (minStars && starsOf(r) < minStars) return false;
      return true;
    });
    const kids = roster.length ? roster.map((k) => k.num) : kidsWithPhotos;
    const res = pickPhotosPerKid({ kids, each, pool: pool.map((p) => ({ id: p.id, record: records.get(p.id) })), inShow: already, records });
    setPerKid(res);
    setKid('');
    setPicked((l) => [...l, ...res.picks.filter((id) => !l.includes(id))]);
  };

  const shown = useMemo(
    () =>
      photos.filter((p) => {
        const r = records.get(p.id);
        if (kid && !(r?.kids || []).includes(kid)) return false;
        if (tag && !(r?.tags || []).includes(tag)) return false;
        if (fav && !isFavorite(r, me)) return false;
        if (minStars && starsOf(r) < minStars) return false;
        return true;
      }),
    [photos, records, kid, tag, fav, minStars, me]
  );
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const add = () => {
    // In the order they were taken (the way they read best), not the order tapped.
    const list = photos.filter((p) => pickedSet.has(p.id)).map((p) => ({ id: p.id, folderId: p.folderId, name: p.name, takenAt: p.takenAt || undefined }));
    if (list.length) onAdd(list);
  };
  const needsSignIn = /sign in|sign-in|expired/i.test(error);
  const sel = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs min-w-0';
  const kidsWithPhotos = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of media.photos) for (const k of r.kids || []) n.set(k, (n.get(k) || 0) + 1);
    return [...n.keys()].sort((a, b) => Number(a) - Number(b));
  }, [media.photos]);

  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Add photos"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[92dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col text-sm overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-black text-slate-900 dark:text-slate-100 mr-1">Add photos</h3>
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className={sel} aria-label="Folder">
            <option value="">All folders ({folders.length})</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.path || f.name}
              </option>
            ))}
          </select>
          <select value={kid} onChange={(e) => setKid(e.target.value)} className={sel} aria-label="Kid">
            <option value="">Every kid</option>
            {kidsWithPhotos.map((k) => (
              <option key={k} value={k}>
                {kidLabel(k, roster, 'full')}
              </option>
            ))}
          </select>
          <select value={tag} onChange={(e) => setTag(e.target.value as MediaTag | '')} className={sel} aria-label="Tag">
            <option value="">Any tag</option>
            {MEDIA_TAGS.map((t) => (
              <option key={t} value={t}>
                {TAG_LABELS[t].label}
              </option>
            ))}
          </select>
          <select value={minStars} onChange={(e) => setMinStars(Number(e.target.value))} className={sel} aria-label="Stars">
            <option value={0}>Any stars</option>
            <option value={4}>★★★★ only</option>
            <option value={3}>★★★ and up</option>
            <option value={2}>★★ and up</option>
          </select>
          <button
            type="button"
            onClick={() => setFav((v) => !v)}
            aria-pressed={fav}
            className={`h-8 px-2.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1 ${fav ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`}
          >
            <Heart size={12} className={fav ? 'fill-current' : ''} /> My favorites
          </button>
          <button type="button" onClick={onClose} className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Photos of every kid: each kid's best, so everyone is in it at least so many times. */}
        {folders.length > 0 && (
          <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-indigo-50/60 dark:bg-indigo-500/10 text-xs" role="group" aria-label="Photos of every kid">
            <div className="flex flex-wrap items-center gap-1.5">
              <Users size={14} className="text-indigo-600 dark:text-indigo-300 shrink-0" />
              <span className="font-black text-slate-800 dark:text-slate-100">Photos of every kid:</span>
              <span className="inline-flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600" role="group" aria-label="Photos each">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEach(n)}
                    aria-pressed={each === n}
                    className={`h-8 w-8 text-xs font-black ${each === n ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'}`}
                  >
                    {n}
                  </button>
                ))}
              </span>
              <span className="text-slate-600 dark:text-slate-300">each</span>
              <button
                type="button"
                onClick={pickPerKid}
                disabled={Boolean(loading) || Boolean(error) || !photos.length}
                className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-black disabled:opacity-40"
              >
                Pick their best
              </button>
              <span className="text-[11px] text-slate-500">
                From {folderId ? 'this folder (pick All folders above for the whole season)' : 'every folder'}{tag || fav || minStars ? ' with the filters above' : ''}. Highest rated first; photos already in the slideshow count.
              </span>
            </div>
            {perKid && (
              <div className="text-[11px] text-slate-700 dark:text-slate-200" role="status">
                <b>
                  {perKid.picks.length ? `Picked ${perKid.picks.length} photo${perKid.picks.length === 1 ? '' : 's'}.` : 'No more photos to pick.'}
                </b>{' '}
                {perKid.short.length === 0
                  ? `Every kid is in at least ${each}.`
                  : `${perKid.counts.length - perKid.short.length} of ${perKid.counts.length} kids are in at least ${each}. Not enough photos tagged of: ${perKid.short
                      .map((s) => `${kidLabel(s.kid, roster, 'first')} (${s.have})`)
                      .join(', ')}.${folderId ? ' Try every folder, or tag more in Media.' : ' Tag more of them in Media.'}`}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto p-3">
          {!folders.length ? (
            <p className="text-slate-500 text-center py-10">No photo folders yet. Add the game day photo folders in Media first.</p>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="font-bold text-rose-600 dark:text-rose-400">{error}</span>
              {needsSignIn && (
                <button
                  type="button"
                  onClick={() => void onSignIn().then(() => setRetry((n) => n + 1)).catch((err) => setError(err?.message || String(err)))}
                  className="h-9 px-4 rounded-lg bg-amber-500 text-slate-900 font-black"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          ) : loading ? (
            <p className="text-slate-500 text-center py-10 inline-flex items-center justify-center gap-2 w-full">
              <Loader2 size={15} className="animate-spin" /> {loading}
            </p>
          ) : !shown.length ? (
            <p className="text-slate-500 text-center py-10">No photos match.</p>
          ) : (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
              {shown.map((p) => {
                const on = pickedSet.has(p.id);
                const r = records.get(p.id);
                const stars = starsOf(r);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    title={p.name}
                    className={`relative aspect-square rounded-lg overflow-hidden ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ${on ? 'ring-4 ring-indigo-500' : ''}`}
                  >
                    <Thumb photo={p} />
                    {on && (
                      <span className="absolute top-1 right-1 h-6 w-6 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center">
                        <Check size={14} />
                      </span>
                    )}
                    {already.has(p.id) && (
                      <span className="absolute top-1 left-1 h-5 px-1.5 rounded-full text-[10px] font-black inline-flex items-center gap-0.5" style={{ background: 'rgba(15,23,42,.75)', color: '#f8fafc' }}>
                        <Check size={10} /> In it
                      </span>
                    )}
                    {(stars > 0 || (r?.kids || []).length > 0) && (
                      <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 text-[10px] font-bold text-left truncate" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.7))', color: '#f8fafc' }}>
                        {stars ? '★'.repeat(stars) : ''} {(r?.kids || []).map((k) => `#${k}`).join(' ')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500">
            {shown.length} shown · {picked.length} picked
          </span>
          <button type="button" onClick={() => setPicked((l) => [...l, ...shown.map((p) => p.id).filter((id) => !l.includes(id))])} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">
            Pick all shown
          </button>
          {picked.length > 0 && (
            <button type="button" onClick={() => setPicked([])} className="h-8 px-2.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
              Clear
            </button>
          )}
          <button type="button" onClick={add} disabled={!picked.length} className="ml-auto h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40">
            Add {picked.length || ''} photo{picked.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
};
