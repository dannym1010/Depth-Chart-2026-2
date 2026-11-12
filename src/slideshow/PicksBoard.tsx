// Picking the year-end photos together: a row for every kid with the photos picked of him (a goal of so many each)
// and his photos to pick from, best first; a section for team and group photos; and "Fill in with their best" for the
// kids still short. Coaches and Highlights helpers pick at the same time: a pick is the photo's Year-end tag in Media,
// so it's saved on the photo itself. From a slideshow, the picks go into it with one button.
import React, { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, FolderOpen, Sparkles, Trophy, Undo2, Users, X } from 'lucide-react';
import { kidLabel, type Kid } from '../highlights/highlightData';
import { editPhoto, starsOf } from '../media/mediaData';
import type { MediaData, MediaPhoto } from '../media/types';
import { groupPhotos, isGroupPhoto, isPicked, kidPhotos, PICK_TAG, pickCounts, pickPhotosPerKid } from './kidPicks';
import { folderPhotos } from './photoLoad';
import { PhotoPicker, type PickedPhoto } from './PhotoPicker';
import { PhotoThumb } from './PhotoThumb';

interface Props {
  media: MediaData;
  /** Saving a change to Media (null: this account can only look). */
  onMedia: ((change: (d: MediaData) => MediaData) => void) | null;
  roster: Kid[];
  me: string;
  /** Opened from a slideshow: the photos in it already, and putting the picks in. */
  inShow?: Set<string>;
  onAddToShow?: (photos: PickedPhoto[]) => void;
  /** Google sign-in, for reading a folder. */
  onSignIn: () => Promise<unknown>;
  onClose: () => void;
}

const GOAL_KEY = 'slideshowPickGoal';
const SHOW_FIRST = 18;
const num = (k: string) => String(Number(k));

export const PicksBoard: React.FC<Props> = ({ media, onMedia, roster, me, inShow, onAddToShow, onSignIn, onClose }) => {
  const ro = !onMedia;
  const records = media.photos;
  const byId = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const [goal, setGoalState] = useState(() => {
    try {
      return Math.min(5, Math.max(1, Number(localStorage.getItem(GOAL_KEY)) || 2));
    } catch {
      return 2;
    }
  });
  const setGoal = (n: number) => {
    setGoalState(n);
    try {
      localStorage.setItem(GOAL_KEY, String(n));
    } catch {
      /* private window */
    }
  };
  // Every kid on the roster (or, with no roster, every number tagged in a photo).
  const kids = useMemo(() => {
    if (roster.length) return roster.map((k) => num(k.num)).filter((k, i, a) => a.indexOf(k) === i);
    const s = new Set<string>();
    for (const r of records) for (const k of r.kids || []) s.add(num(k));
    return [...s].sort((a, b) => Number(a) - Number(b));
  }, [roster, records]);
  const counts = useMemo(() => pickCounts(kids, records), [kids, records]);
  const picked = useMemo(() => records.filter(isPicked), [records]);
  const short = kids.filter((k) => (counts.get(k) || 0) < goal);
  const groups = useMemo(() => groupPhotos(records), [records]);
  const pickedGroups = groups.filter(isPicked);
  const [onlyShort, setOnlyShort] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [more, setMore] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState<{ text: string; undo?: () => void } | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [adding, setAdding] = useState('');

  const toggle = (r: MediaPhoto) => {
    if (!onMedia) return;
    const on = !isPicked(r);
    onMedia((d) => {
      const now = d.photos.find((p) => p.id === r.id) || r;
      const tags = (now.tags || []).filter((t) => t !== PICK_TAG);
      return editPhoto(d, r.id, r.folderId, { tags: on ? [...tags, PICK_TAG] : tags });
    });
  };
  // Tag (or untag) many: each photo on its own, so nobody else's picks change.
  const setPicks = (list: { id: string; folderId: string }[], on: boolean, extra?: Partial<MediaPhoto>) =>
    onMedia?.((d) =>
      list.reduce((acc, p) => {
        const r = acc.photos.find((x) => x.id === p.id);
        const tags = (r?.tags || []).filter((t) => t !== PICK_TAG);
        return editPhoto(acc, p.id, r?.folderId || p.folderId, { tags: on ? [...tags, PICK_TAG] : tags, ...(on && extra && !(r?.group) ? extra : {}) });
      }, d)
    );
  const fillIn = () => {
    const res = pickPhotosPerKid({
      kids,
      each: goal,
      pool: records.filter((r) => !isPicked(r)).map((r) => ({ id: r.id, record: r })),
      inShow: new Set(picked.map((r) => r.id)),
      records: byId,
    });
    if (!res.picks.length) {
      setNote({ text: short.length ? 'No more photos of the kids still short: tag more of them in Media.' : `Every kid has ${goal} already.` });
      return;
    }
    const list = res.picks.map((id) => ({ id, folderId: byId.get(id)!.folderId }));
    setPicks(list, true);
    setNote({
      text: `Picked ${list.length} photo${list.length === 1 ? '' : 's'}.${res.short.length ? ` Still short (not enough tagged): ${res.short.map((s) => kidLabel(s.kid, roster, 'first')).join(', ')}.` : ''}`,
      undo: () => {
        setPicks(list, false);
        setNote(null);
      },
    });
  };
  // Photos from a folder (a team photo nobody tagged): picked, and marked a group photo.
  const fromFolder = (list: PickedPhoto[]) => {
    setBrowsing(false);
    setPicks(list, true, { group: 'group' });
    setNote({ text: `Picked ${list.length} team / group photo${list.length === 1 ? '' : 's'}.`, undo: () => (setPicks(list, false), setNote(null)) });
  };
  // Into the slideshow: every pick not in it yet, in the order they were taken.
  const toAdd = picked.filter((r) => !inShow?.has(r.id));
  const addToShow = async () => {
    if (!onAddToShow || !toAdd.length) return;
    setAdding('Reading the photos’ names…');
    const info = new Map<string, { name: string; takenAt?: number }>();
    for (const f of media.folders.filter((x) => toAdd.some((r) => r.folderId === x.id))) {
      try {
        for (const p of await folderPhotos(f.driveId)) info.set(p.id, { name: p.name, takenAt: p.takenAt || undefined });
      } catch {
        /* a folder that can't be read: those photos go in by id */
      }
    }
    setAdding('');
    const list = toAdd
      .map((r) => ({ id: r.id, folderId: r.folderId, name: info.get(r.id)?.name || 'Photo', takenAt: info.get(r.id)?.takenAt }))
      .sort((a, b) => (a.takenAt ?? Infinity) - (b.takenAt ?? Infinity));
    onAddToShow(list);
  };

  const tile = (r: MediaPhoto, size: 'sm' | 'md', forKid?: string) => {
    const on = isPicked(r);
    const others = (r.kids || []).filter((k) => num(k) !== forKid).length;
    const stars = starsOf(r);
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => toggle(r)}
        disabled={ro}
        aria-pressed={on}
        title={on ? 'Picked: tap to take it off' : 'Tap to pick'}
        className={`relative shrink-0 rounded-lg overflow-hidden ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ${size === 'sm' ? 'h-16 w-16' : 'aspect-square w-full'} ${on ? 'ring-4 ring-emerald-500' : ''}`}
      >
        <PhotoThumb id={r.id} />
        {on && (
          <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center">
            <Check size={12} />
          </span>
        )}
        {inShow?.has(r.id) && size === 'md' && (
          <span className="absolute top-1 left-1 h-4 px-1 rounded text-[9px] font-black" style={{ background: 'rgba(15,23,42,.75)', color: '#f8fafc' }}>
            In it
          </span>
        )}
        {size === 'md' && (stars > 0 || others > 0) && (
          <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 text-[10px] font-bold text-left truncate" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.75))', color: '#f8fafc' }}>
            {stars ? '★'.repeat(stars) : ''} {others ? `+${others} more` : ''}
          </span>
        )}
      </button>
    );
  };
  const candidates = (key: string, list: MediaPhoto[], forKid?: string) => {
    const all = more.has(key);
    const shown = all ? list : list.slice(0, SHOW_FIRST);
    return (
      <div className="flex flex-col gap-1.5">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}>
          {shown.map((r) => tile(r, 'md', forKid))}
        </div>
        {list.length > shown.length && (
          <button type="button" onClick={() => setMore((s) => new Set(s).add(key))} className="self-start h-7 px-2 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
            Show all {list.length}
          </button>
        )}
      </div>
    );
  };
  const flip = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const shownKids = onlyShort ? short : kids;
  const done = kids.length - short.length;
  const card = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-1 sm:p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Pick photos by kid"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[96dvh] rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col text-sm overflow-hidden"
      >
        <div className="flex flex-col gap-2 p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            <h3 className="font-black text-slate-900 dark:text-slate-100">Pick photos by kid</h3>
            <span className="text-xs text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">
              Goal
              <span className="inline-flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600" role="group" aria-label="Photos per kid">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setGoal(n)} aria-pressed={goal === n} className={`h-7 w-7 text-xs font-black ${goal === n ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'}`}>
                    {n}
                  </button>
                ))}
              </span>
              each
            </span>
            <button type="button" onClick={onClose} className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-[12rem] flex-1">
              <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" aria-hidden>
                <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${kids.length ? (done / kids.length) * 100 : 0}%` }} />
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap" role="status">
                {done} of {kids.length} kids have {goal}+ · {picked.length} picked · {pickedGroups.length} team / group
              </span>
            </div>
            <button type="button" onClick={() => setOnlyShort((v) => !v)} aria-pressed={onlyShort} className={`h-8 px-2.5 rounded-lg border text-xs font-bold ${onlyShort ? 'bg-amber-500 border-amber-500 text-slate-900' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`}>
              Only kids who need more ({short.length})
            </button>
            {!ro && (
              <button type="button" onClick={fillIn} disabled={!short.length} className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1 disabled:opacity-40" title={`Each kid short of ${goal}: his best photos picked for him`}>
                <Sparkles size={13} /> Fill in with their best
              </button>
            )}
          </div>
          {note && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300" role="status">
              {note.text}
              {note.undo && (
                <button type="button" onClick={note.undo} className="h-7 px-2.5 rounded-lg bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1">
                  <Undo2 size={12} /> Undo
                </button>
              )}
            </div>
          )}
          {ro && <p className="text-[11px] text-amber-700 dark:text-amber-300">You can look, but this account can't pick (ask a coach to make you a Highlights helper).</p>}
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-2 sm:p-3 flex flex-col gap-2">
          {/* Team and group photos */}
          <section className={`${card} p-2.5 flex flex-col gap-2`} aria-label="Team and group photos">
            <div className="flex flex-wrap items-center gap-2">
              <Users size={16} className="text-indigo-500" />
              <span className="font-black text-slate-800 dark:text-slate-100">Team & group photos</span>
              <span className="text-xs font-bold text-slate-500">{pickedGroups.length} picked</span>
              <span className="flex-1" />
              {!ro && (
                <button type="button" onClick={() => setBrowsing(true)} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1">
                  <FolderOpen size={13} /> From a folder
                </button>
              )}
              <button type="button" onClick={() => flip('__group')} aria-expanded={open.has('__group')} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1">
                {open.has('__group') ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {open.has('__group') ? 'Done' : `Pick (${groups.length})`}
              </button>
            </div>
            {pickedGroups.length > 0 && <div className="flex gap-1.5 overflow-x-auto p-1 -m-1">{pickedGroups.map((r) => tile(r, 'sm'))}</div>}
            {open.has('__group') &&
              (groups.length ? candidates('__group', groups) : <p className="text-xs text-slate-500">No group photos marked yet. Use "From a folder" for the team photo, or tag photos with three or more kids in Media.</p>)}
          </section>

          {/* Every kid */}
          {!shownKids.length && <p className="text-center text-slate-500 py-8">{kids.length ? `Every kid has ${goal} or more. 🎉` : 'No roster yet.'}</p>}
          {shownKids.map((k) => {
            const n = counts.get(k) || 0;
            const ok = n >= goal;
            const his = kidPhotos(k, records);
            const hisPicked = his.filter(isPicked);
            const isOpen = open.has(k);
            return (
              <section key={k} className={`${card} p-2.5 flex flex-col gap-2`} aria-label={kidLabel(k, roster, 'full')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-slate-800 dark:text-slate-100">{kidLabel(k, roster, 'full')}</span>
                  <span
                    className={`h-6 px-2 rounded-full text-[11px] font-black inline-flex items-center gap-1 ${ok ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200'}`}
                    aria-label={`${n} of ${goal} picked`}
                  >
                    {ok && <Check size={11} />} {n} / {goal}
                  </span>
                  <span className="text-[11px] text-slate-500">{his.length ? `${his.length} photo${his.length === 1 ? '' : 's'} of him` : 'No photos of him tagged yet: tag them in Media'}</span>
                  <span className="flex-1" />
                  {his.length > 0 && (
                    <button type="button" onClick={() => flip(k)} aria-expanded={isOpen} className={`h-8 px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${isOpen ? 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}>
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {isOpen ? 'Done' : ro ? 'See his photos' : 'Pick his photos'}
                    </button>
                  )}
                </div>
                {hisPicked.length > 0 && !isOpen && (
                  <div className="flex gap-1.5 overflow-x-auto p-1 -m-1">
                    {hisPicked.map((r) => (
                      <span key={r.id} className="relative">
                        {tile(r, 'sm', k)}
                        {isGroupPhoto(r) && (
                          <span className="absolute bottom-0.5 left-0.5 h-4 px-1 rounded text-[9px] font-black pointer-events-none" style={{ background: 'rgba(15,23,42,.75)', color: '#f8fafc' }}>
                            Group
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {isOpen && candidates(k, his, k)}
              </section>
            );
          })}
        </div>

        {onAddToShow && (
          <div className="flex flex-wrap items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {picked.length} picked · {picked.length - toAdd.length} in the slideshow already{adding ? ` · ${adding}` : ''}
            </span>
            <button type="button" onClick={() => void addToShow()} disabled={!toAdd.length || Boolean(adding)} className="ml-auto h-9 px-4 rounded-lg bg-emerald-600 text-white font-black disabled:opacity-40">
              Add {toAdd.length || ''} pick{toAdd.length === 1 ? '' : 's'} to the slideshow
            </button>
          </div>
        )}
      </div>
      {browsing && (
        <div onClick={(e) => e.stopPropagation()}>
          <PhotoPicker media={media} me={me} roster={roster} already={new Set(picked.map((r) => r.id))} onAdd={fromFolder} onSignIn={onSignIn} onClose={() => setBrowsing(false)} />
        </div>
      )}
    </div>
  );
};
