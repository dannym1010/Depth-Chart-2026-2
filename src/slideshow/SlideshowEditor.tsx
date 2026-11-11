// One slideshow, made the way you want it: the slides in a row you drag into any order (or move with the buttons on
// an iPad / phone), each one's time, fade, move and words; the fades and photo moves for all of them; and the songs
// under it. Plays right here, or is made into one MP4.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Film, Image as ImageIcon, Music, Play, Plus, Trash2, Type, Upload, Video, X,
} from 'lucide-react';
import type { FilmAccess } from '../highlights/filmAccess';
import { clock, type Kid } from '../highlights/highlightData';
import type { Highlight, HighlightGame, HighlightSettings, Reel } from '../highlights/types';
import type { MediaData } from '../media/types';
import { ClipPicker } from './ClipPicker';
import { PhotoPicker } from './PhotoPicker';
import { photoThumb } from './photoLoad';
import { SlideshowPlayer } from './SlideshowPlayer';
import { SlideshowVideoPanel } from './SlideshowVideoPanel';
import {
  buildSlides, clipItem, editItem, FITS, fitToMusic, insertItems, mmss, MOTIONS, moveItem, parseMmss, photoItem, removeItems, SHAPES, slidesSeconds, songsSeconds, titleItem, TRANSITIONS, type Slide,
} from './slideshowData';
import type { useSongs } from './songs';
import type { PhotoFit, PhotoMotion, SlideItem, Slideshow, SlideshowOptions, SlideshowShape, SlideTransition } from './types';

interface Props {
  show: Slideshow;
  edit: (change: (s: Slideshow) => Slideshow) => void;
  readOnly: boolean;
  highlights: Highlight[];
  reels: Reel[];
  games: HighlightGame[];
  roster: Kid[];
  media: MediaData;
  me: string;
  ownerLabel?: string;
  access: FilmAccess;
  settings: HighlightSettings;
  logo?: HTMLImageElement | null;
  songs: ReturnType<typeof useSongs>;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

type Side = 'slide' | 'look' | 'music';

/** A photo's small picture, fetched when its tile scrolls into view. */
const PhotoThumb: React.FC<{ id: string }> = ({ id }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let off = false;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void photoThumb(id)
          .then((u) => !off && setUrl(u))
          .catch(() => undefined);
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => {
      off = true;
      io.disconnect();
    };
  }, [id]);
  return (
    <div ref={ref} className="absolute inset-0 bg-slate-200 dark:bg-slate-800">
      {url && <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />}
    </div>
  );
};

const TRANSITION_SHORT: Record<SlideTransition, string> = { crossfade: 'Crossfade', black: 'Black', white: 'White', cut: 'Cut' };

export const SlideshowEditor: React.FC<Props> = ({
  show, edit, readOnly: ro, highlights, reels, games, roster, media, me, ownerLabel, access, settings, logo, songs, onDuplicate, onDelete, onClose,
}) => {
  const o = show.options;
  const slides = useMemo(() => buildSlides(show, highlights, settings), [show, highlights, settings]);
  const total = slidesSeconds(slides);
  const slideOf = useMemo(() => new Map(slides.map((s) => [s.item.id, s])), [slides]);
  const hById = useMemo(() => new Map(highlights.map((h) => [h.id, h])), [highlights]);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = show.items.find((i) => i.id === selected) || null;
  const selIndex = sel ? show.items.indexOf(sel) : -1;
  const [side, setSide] = useState<Side>('look');
  const [picking, setPicking] = useState<'' | 'photos' | 'clips'>('');
  const [playing, setPlaying] = useState<number | null>(null);
  const [making, setMaking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const setOpt = (p: Partial<SlideshowOptions>) => edit((s) => ({ ...s, options: { ...s.options, ...p } }));
  const setItem = (id: string, p: Partial<SlideItem>) => edit((s) => editItem(s, id, p));
  // A phone / narrow iPad shows the slide's settings under all the slides: go there on a tap, and back after.
  const sideRef = useRef<HTMLDivElement>(null);
  const narrow = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 1023px)').matches);
  const touch = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const pick = (id: string | null) => {
    const was = selected;
    setSelected(id);
    if (id) setSide('slide');
    if (!narrow()) return;
    window.setTimeout(() => {
      if (id) sideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (was) document.querySelector(`[data-slide="${was}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
  };

  // ---- Dragging tiles into order (a mouse); the buttons do it on a touch screen ----
  const dragFrom = useRef<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const onDrop = (to: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    setDropAt(null);
    if (from === null || ro) return;
    edit((s) => moveItem(s, from, from < to ? to - 1 : to));
  };

  const counts = useMemo(() => {
    let p = 0;
    let c = 0;
    let t = 0;
    for (const i of show.items) i.kind === 'photo' ? p++ : i.kind === 'clip' ? c++ : t++;
    return { p, c, t };
  }, [show.items]);
  const songLens = songs.lens;
  const pickedSongs = o.songs.map((p) => ({ ...p, seconds: songLens[p.name] || 0, have: songs.songs.some((s) => s.name === p.name) }));
  const musicSeconds = songsSeconds(pickedSongs.filter((p) => p.have).map((p) => ({ seconds: p.seconds, start: p.start || 0 })));
  const fit = fitToMusic(slides, musicSeconds);

  const addSongFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added = await songs.add(files);
    if (added.length && !ro) setOpt({ songs: [...o.songs, ...added.filter((n) => !o.songs.some((p) => p.name === n)).map((name) => ({ name }))] });
  };

  const box = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';
  const input = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs min-w-0';
  const pill = (on: boolean) => `h-8 px-2.5 rounded-lg text-xs font-bold border ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`;
  const iconBtn = 'h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-30';
  const row = 'flex flex-wrap items-center gap-2 text-xs';
  const label = 'w-24 shrink-0 font-bold text-slate-600 dark:text-slate-300';

  const tile = (item: SlideItem, i: number) => {
    const s = slideOf.get(item.id);
    const on = item.id === selected;
    const h = item.kind === 'clip' ? hById.get(item.highlightId) : undefined;
    const trans = s && i > 0 ? s.transition : null;
    return (
      <div
        key={item.id}
        data-slide={item.id}
        className="relative"
        onDragOver={(e) => {
          if (dragFrom.current === null) return;
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          setDropAt(e.clientX < r.left + r.width / 2 ? i : i + 1);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dropAt !== null) onDrop(dropAt);
        }}
      >
        {dropAt === i && <span className="absolute -left-1 top-0 bottom-0 w-1 rounded bg-indigo-500 z-10" />}
        {dropAt === i + 1 && <span className="absolute -right-1 top-0 bottom-0 w-1 rounded bg-indigo-500 z-10" />}
        <button
          type="button"
          draggable={!ro}
          onDragStart={(e) => {
            dragFrom.current = i;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.id);
          }}
          onDragEnd={() => {
            dragFrom.current = null;
            setDropAt(null);
          }}
          onClick={() => pick(on ? null : item.id)}
          aria-pressed={on}
          aria-label={`Slide ${i + 1}`}
          className={`relative block w-full aspect-video rounded-lg overflow-hidden text-left ${on ? 'ring-4 ring-indigo-500' : 'ring-1 ring-slate-300 dark:ring-slate-700'}`}
        >
          {item.kind === 'photo' ? (
            <PhotoThumb id={item.photoId} />
          ) : item.kind === 'clip' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1.5 text-center" style={{ background: '#0f172a', color: '#e2e8f0' }}>
              <Film size={18} style={{ color: settings.accent || '#f2b705' }} />
              <span className="text-[10px] font-bold leading-tight line-clamp-2">{h ? h.title || 'Highlight' : 'Clip deleted'}</span>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-1.5 text-center" style={{ background: settings.primary || '#1e3a8a', color: settings.text || '#fff' }}>
              <span className="text-[11px] font-black leading-tight line-clamp-2">{item.title || 'Title'}</span>
              {item.sub && <span className="text-[9px] opacity-80 line-clamp-1">{item.sub}</span>}
            </div>
          )}
          <span className="absolute top-0.5 left-0.5 h-4 min-w-4 px-1 rounded text-[9px] font-black inline-flex items-center justify-center" style={{ background: 'rgba(15,23,42,.75)', color: '#f8fafc' }}>
            {i + 1}
          </span>
          <span className="absolute bottom-0.5 right-0.5 h-4 px-1 rounded text-[9px] font-bold tabular-nums inline-flex items-center gap-0.5" style={{ background: 'rgba(15,23,42,.75)', color: '#f8fafc' }}>
            {item.kind === 'clip' ? <Video size={8} /> : item.kind === 'title' ? <Type size={8} /> : null}
            {s ? `${Math.round(s.seconds * 10) / 10}s` : '–'}
          </span>
          {trans && trans !== 'cut' && (
            <span className="absolute bottom-0.5 left-0.5 h-4 px-1 rounded text-[9px] font-bold inline-flex items-center" style={{ background: item.transition ? 'rgba(79,70,229,.9)' : 'rgba(15,23,42,.6)', color: '#f8fafc' }}>
              {TRANSITION_SHORT[trans]}
            </span>
          )}
        </button>
      </div>
    );
  };

  const transitionSelect = (value: SlideTransition | undefined, onChange: (v: SlideTransition | undefined) => void, withDefault: boolean) => (
    <select value={value || ''} onChange={(e) => onChange((e.target.value || undefined) as SlideTransition | undefined)} className={input} disabled={ro} aria-label="Fade">
      {withDefault && <option value="">Same as the rest ({TRANSITIONS.find((t) => t.id === o.transition)?.label})</option>}
      {TRANSITIONS.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
  const secondsInput = (value: number | undefined, fallback: number, onChange: (v: number | undefined) => void) => (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0.5}
        max={60}
        step={0.5}
        value={value ?? ''}
        placeholder={String(fallback)}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Math.max(0.5, Math.min(60, Number(e.target.value))))}
        className={`${input} w-20`}
        disabled={ro}
        aria-label="Seconds"
      />
      <span className="text-slate-500">seconds{value === undefined ? ' (same as the rest)' : ''}</span>
    </span>
  );

  // ---- The picked slide ----
  const slidePanel = () => {
    if (!sel) return <p className="text-xs text-slate-500">Tap a slide to change it: its time, how it fades in, how a photo moves, words on it.</p>;
    const s = slideOf.get(sel.id) as Slide | undefined;
    const move = (to: number) => edit((x) => moveItem(x, selIndex, to));
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
            Slide {selIndex + 1} of {show.items.length}
          </span>
          <span className="text-[11px] text-slate-500 truncate">
            {sel.kind === 'photo' ? sel.name : sel.kind === 'clip' ? hById.get(sel.highlightId)?.game.name || '' : 'Title card'}
          </span>
          <button type="button" onClick={() => pick(null)} className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Done with this slide">
            <X size={14} />
          </button>
        </div>
        {!ro && (
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" className={iconBtn} disabled={selIndex <= 0} onClick={() => move(0)} aria-label="Move to the start" title="Move to the start"><ChevronsUp size={14} /></button>
            <button type="button" className={iconBtn} disabled={selIndex <= 0} onClick={() => move(selIndex - 1)} aria-label="Move earlier" title="Move earlier"><ArrowUp size={14} /></button>
            <button type="button" className={iconBtn} disabled={selIndex >= show.items.length - 1} onClick={() => move(selIndex + 1)} aria-label="Move later" title="Move later"><ArrowDown size={14} /></button>
            <button type="button" className={iconBtn} disabled={selIndex >= show.items.length - 1} onClick={() => move(show.items.length - 1)} aria-label="Move to the end" title="Move to the end"><ChevronsDown size={14} /></button>
            <label className="inline-flex items-center gap-1 text-xs text-slate-500 ml-1">
              to #
              <input
                type="number"
                min={1}
                max={show.items.length}
                defaultValue={selIndex + 1}
                key={`${sel.id}-${selIndex}`}
                onKeyDown={(e) => e.key === 'Enter' && move(Number((e.target as HTMLInputElement).value) - 1)}
                onBlur={(e) => Number(e.target.value) - 1 !== selIndex && move(Number(e.target.value) - 1)}
                className={`${input} w-14`}
                aria-label="Move to slide number"
              />
            </label>
            <button type="button" onClick={() => setPlaying(s?.start ?? 0)} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1 ml-auto">
              <Play size={12} /> From here
            </button>
          </div>
        )}
        {sel.kind === 'title' && (
          <>
            <div className={row}>
              <span className={label}>Title</span>
              <input value={sel.title} onChange={(e) => setItem(sel.id, { title: e.target.value })} className={`${input} flex-1`} disabled={ro} aria-label="Title" />
            </div>
            <div className={row}>
              <span className={label}>Under it</span>
              <input value={sel.sub || ''} onChange={(e) => setItem(sel.id, { sub: e.target.value || undefined })} className={`${input} flex-1`} disabled={ro} placeholder="(optional)" aria-label="Line under the title" />
            </div>
            <div className={row}>
              <span className={label}>Time up</span>
              {secondsInput(sel.seconds, o.titleSeconds, (v) => setItem(sel.id, { seconds: v }))}
            </div>
          </>
        )}
        {sel.kind === 'photo' && (
          <>
            <div className={row}>
              <span className={label}>Time up</span>
              {secondsInput(sel.seconds, o.photoSeconds, (v) => setItem(sel.id, { seconds: v }))}
            </div>
            <div className={row}>
              <span className={label}>Move</span>
              <select value={sel.motion || ''} onChange={(e) => setItem(sel.id, { motion: (e.target.value || undefined) as PhotoMotion | undefined })} className={input} disabled={ro} aria-label="How the photo moves">
                <option value="">Same as the rest</option>
                {MOTIONS.filter((m) => m.id !== 'auto').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={row}>
              <span className={label}>Fit</span>
              <select value={sel.fit || ''} onChange={(e) => setItem(sel.id, { fit: (e.target.value || undefined) as PhotoFit | undefined })} className={input} disabled={ro} aria-label="Fill or whole photo">
                <option value="">Same as the rest</option>
                {FITS.filter((f) => f.id !== 'auto').map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={row}>
              <span className={label}>Words on it</span>
              <input value={sel.caption || ''} onChange={(e) => setItem(sel.id, { caption: e.target.value || undefined })} className={`${input} flex-1`} disabled={ro} placeholder="(optional)" aria-label="Words on the photo" />
            </div>
          </>
        )}
        {sel.kind === 'clip' && (
          <>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <b>{hById.get(sel.highlightId)?.title || 'This clip was deleted'}</b>
              {s ? ` · ${clock(s.seconds)} (its trim, slow motion and freeze from the clip editor)` : ''}
            </p>
            <div className={row}>
              <span className={label}>Game sound</span>
              <select
                value={sel.sound === undefined ? '' : sel.sound ? 'on' : 'off'}
                onChange={(e) => setItem(sel.id, { sound: e.target.value === '' ? undefined : e.target.value === 'on' })}
                className={input}
                disabled={ro}
                aria-label="Game sound on this clip"
              >
                <option value="">Same as the rest ({o.clipSound === 'off' ? 'off' : 'on'})</option>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>
          </>
        )}
        <div className={row}>
          <span className={label}>Fades in by</span>
          {selIndex === 0 ? <span className="text-slate-500">{o.fadeEnds ? 'Up from black (the start)' : 'Starts right away'}</span> : transitionSelect(sel.transition, (v) => setItem(sel.id, { transition: v }), true)}
        </div>
        {!ro && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button type="button" onClick={() => edit((x) => insertItems(x, [{ ...sel, id: `${sel.id}_c${Date.now().toString(36)}` }], sel.id))} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1">
              <Copy size={12} /> Copy it
            </button>
            <button
              type="button"
              onClick={() => {
                const next = show.items[selIndex + 1] || show.items[selIndex - 1];
                edit((x) => removeItems(x, [sel.id]));
                setSelected(next?.id || null);
              }}
              className="h-8 px-2.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> Take it out
            </button>
          </div>
        )}
      </div>
    );
  };

  // ---- Fades and photos for the whole slideshow ----
  const lookPanel = () => (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5" disabled={ro}>
        <legend className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1">Shape</legend>
        <div className="grid grid-cols-4 gap-1">
          {(Object.keys(SHAPES) as SlideshowShape[]).map((k) => {
            const sh = SHAPES[k];
            const on = o.shape === k;
            return (
              <button key={k} type="button" onClick={() => setOpt({ shape: k })} aria-pressed={on} className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="rounded-[3px] border-2 border-current text-slate-500" style={{ width: 22 * Math.min(1.78, sh.w / sh.h), height: 22 * Math.min(1, sh.h / sh.w) * Math.min(1.78, sh.w / sh.h) }} aria-hidden />
                <b className="text-[11px] text-slate-800 dark:text-slate-100">{sh.label}</b>
                <span className="text-[10px] text-slate-500 leading-tight text-center">{sh.note}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5" disabled={ro}>
        <legend className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1">Fades</legend>
        <div className="flex flex-wrap gap-1">
          {TRANSITIONS.map((t) => (
            <button key={t.id} type="button" className={pill(o.transition === t.id)} aria-pressed={o.transition === t.id} onClick={() => setOpt({ transition: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
        {o.transition !== 'cut' && (
          <div className={row}>
            <span className={label}>Fade length</span>
            <input type="range" min={0.3} max={2.5} step={0.1} value={o.fadeSeconds} onChange={(e) => setOpt({ fadeSeconds: Number(e.target.value) })} className="flex-1 min-w-0" aria-label="Fade length" />
            <span className="w-12 tabular-nums text-slate-500">{o.fadeSeconds.toFixed(1)} s</span>
          </div>
        )}
        <label className="inline-flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={o.fadeEnds} onChange={(e) => setOpt({ fadeEnds: e.target.checked })} /> Fade up from black at the start, out to black at the end
        </label>
        {show.items.some((i) => i.transition) && !ro && (
          <button type="button" onClick={() => edit((s) => ({ ...s, items: s.items.map(({ transition: _t, ...i }) => i as SlideItem) }))} className="self-start text-[11px] font-bold text-indigo-600 dark:text-indigo-300 underline">
            Use this fade on every slide ({show.items.filter((i) => i.transition).length} have their own)
          </button>
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-1.5" disabled={ro}>
        <legend className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1">Photos</legend>
        <div className={row}>
          <span className={label}>Each one up</span>
          <input type="range" min={1.5} max={12} step={0.5} value={o.photoSeconds} onChange={(e) => setOpt({ photoSeconds: Number(e.target.value) })} className="flex-1 min-w-0" aria-label="Seconds each photo is up" />
          <span className="w-12 tabular-nums text-slate-500">{o.photoSeconds} s</span>
        </div>
        <div className={row}>
          <span className={label}>Move</span>
          <select value={o.motion} onChange={(e) => setOpt({ motion: e.target.value as PhotoMotion })} className={input} aria-label="How photos move">
            {MOTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className={row}>
          <span className={label}>Fit</span>
          <select value={o.photoFit} onChange={(e) => setOpt({ photoFit: e.target.value as PhotoFit })} className={input} aria-label="Fill the screen or whole photos">
            {FITS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-slate-500">Best for each: a photo about the screen's shape fills it; a tall photo on a wide screen shows whole, a soft copy of it behind.</p>
        <div className={row}>
          <span className={label}>Title cards</span>
          <input type="range" min={1.5} max={10} step={0.5} value={o.titleSeconds} onChange={(e) => setOpt({ titleSeconds: Number(e.target.value) })} className="flex-1 min-w-0" aria-label="Seconds each title card is up" />
          <span className="w-12 tabular-nums text-slate-500">{o.titleSeconds} s</span>
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5" disabled={ro}>
        <legend className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1">Clips</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.clipTitles} onChange={(e) => setOpt({ clipTitles: e.target.checked })} /> Clip titles
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.clipReplays} onChange={(e) => setOpt({ clipReplays: e.target.checked })} /> Replays
          </label>
        </div>
        <div className={row}>
          <span className={label}>Game sound</span>
          {(['off', 'low', 'full'] as const).map((v) => (
            <button key={v} type="button" className={pill(o.clipSound === v)} aria-pressed={o.clipSound === v} onClick={() => setOpt({ clipSound: v })}>
              {v === 'off' ? 'Off' : v === 'low' ? 'Low' : 'Full'}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );

  // ---- Songs ----
  const available = songs.songs.filter((s) => !o.songs.some((p) => p.name === s.name));
  const musicPanel = () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-black text-slate-800 dark:text-slate-100">Songs (played in this order)</span>
        {!pickedSongs.length && <span className="text-[11px] text-slate-500">No songs yet.</span>}
        <ol className="flex flex-col gap-1">
          {pickedSongs.map((p, k) => (
            <li key={`${p.name}-${k}`} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-xs">
              <span className="flex items-center gap-1.5 w-full min-w-0">
                <span className="text-[10px] font-black text-slate-400 tabular-nums">{k + 1}</span>
                <Music size={12} className="text-indigo-500 shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-100 truncate min-w-0 flex-1" title={p.name}>{p.name}</span>
                {p.have ? <span className="text-slate-500 tabular-nums">{p.seconds ? mmss(p.seconds) : '…'}</span> : <span className="text-amber-600 dark:text-amber-400 font-bold">not on this device</span>}
              </span>
              {!ro && (
                <>
                  <label className="inline-flex items-center gap-1 text-slate-500">
                    from
                    <input
                      defaultValue={mmss(p.start || 0)}
                      key={`${p.name}-${p.start || 0}`}
                      onBlur={(e) => {
                        const v = parseMmss(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setOpt({ songs: o.songs.map((x, j) => (j === k ? { ...x, start: v > 0 ? v : undefined } : x)) });
                      }}
                      className={`${input} w-14`}
                      aria-label={`Start ${p.name} at`}
                    />
                  </label>
                  <span className="flex-1" />
                  <button type="button" className={iconBtn} disabled={k === 0} onClick={() => setOpt({ songs: moveArr(o.songs, k, k - 1) })} aria-label="Play earlier"><ArrowUp size={13} /></button>
                  <button type="button" className={iconBtn} disabled={k === o.songs.length - 1} onClick={() => setOpt({ songs: moveArr(o.songs, k, k + 1) })} aria-label="Play later"><ArrowDown size={13} /></button>
                  <button type="button" className={iconBtn} onClick={() => setOpt({ songs: o.songs.filter((_, j) => j !== k) })} aria-label={`Take ${p.name} out`}><X size={13} /></button>
                </>
              )}
            </li>
          ))}
        </ol>
        {!ro && (
          <div className="flex flex-wrap items-center gap-1.5">
            {available.length > 0 && (
              <select value="" onChange={(e) => e.target.value && setOpt({ songs: [...o.songs, { name: e.target.value }] })} className={input} aria-label="Add a song">
                <option value="">Add a song…</option>
                {available.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                    {songLens[s.name] ? ` (${mmss(songLens[s.name])})` : ''}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1">
              <Upload size={12} /> Add a song file
            </button>
            <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple className="hidden" onChange={(e) => (void addSongFiles(e.target.files), (e.target.value = ''))} />
          </div>
        )}
        {songs.error && <span className="text-[11px] font-bold text-rose-600">{songs.error}</span>}
        <p className="text-[11px] text-slate-500">Songs stay on this device (MP3, M4A, WAV). Another coach's device plays the slideshow's songs it has with the same name.</p>
      </div>
      <fieldset className="flex flex-col gap-1.5" disabled={ro}>
        <legend className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1">How it plays</legend>
        <div className={row}>
          <span className={label}>Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={o.musicVolume} onChange={(e) => setOpt({ musicVolume: Number(e.target.value) })} className="flex-1 min-w-0" aria-label="Song volume" />
          <span className="w-12 tabular-nums text-slate-500">{Math.round(o.musicVolume * 100)}%</span>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.musicFadeIn} onChange={(e) => setOpt({ musicFadeIn: e.target.checked })} /> Fade the music in at the start
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.musicFadeOut} onChange={(e) => setOpt({ musicFadeOut: e.target.checked })} /> Fade it out at the end
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.duck} onChange={(e) => setOpt({ duck: e.target.checked })} /> Quieter while a clip's game sound plays
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.loopMusic} onChange={(e) => setOpt({ loopMusic: e.target.checked })} /> Start the songs over if they run out
          </label>
        </div>
      </fieldset>
      {musicSeconds > 0 && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 flex flex-col gap-1.5 text-xs">
          <span>
            Songs <b>{mmss(musicSeconds)}</b> · slideshow <b>{mmss(total)}</b>
          </span>
          {!ro && fit !== null && Math.abs(fit - o.photoSeconds) >= 0.1 && (
            <button type="button" onClick={() => setOpt({ photoSeconds: fit })} className="self-start h-8 px-2.5 rounded-lg bg-indigo-600 text-white font-bold">
              Time the photos to the songs ({fit} s each)
            </button>
          )}
          {fit === null && counts.p > 0 && <span className="text-slate-500">The clips and title cards already run longer than the songs.</span>}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className={`${box} p-3 flex flex-wrap items-center gap-2`}>
        <button type="button" onClick={onClose} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold lg:hidden">
          ‹ Slideshows
        </button>
        <input value={show.name} onChange={(e) => edit((s) => ({ ...s, name: e.target.value }))} disabled={ro} className="h-9 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm font-black min-w-0 flex-1 sm:flex-none sm:w-64" aria-label="Slideshow name" />
        <span className="text-xs text-slate-500 w-full sm:w-auto">
          {counts.p} photo{counts.p === 1 ? '' : 's'} · {counts.c} clip{counts.c === 1 ? '' : 's'}
          {counts.t ? ` · ${counts.t} title${counts.t === 1 ? '' : 's'}` : ''} · <b>{clock(total)}</b>
          {ownerLabel ? ` · by ${ownerLabel}` : ''}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          <button type="button" onClick={() => setPlaying(0)} disabled={!slides.length} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-40">
            <Play size={14} /> Play
          </button>
          <button type="button" onClick={() => setMaking(true)} disabled={!slides.length} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
            <Video size={14} /> Make the video
          </button>
          {!ro && (
            <>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 px-1">
                <input type="checkbox" checked={show.sharedWith.includes('*')} onChange={(e) => edit((s) => ({ ...s, sharedWith: e.target.checked ? ['*'] : [] }))} /> Staff can see and edit
              </label>
              <button type="button" onClick={onDuplicate} className={iconBtn} aria-label="Make a copy" title="Make a copy"><Copy size={14} /></button>
              {confirmDelete ? (
                <span className="inline-flex items-center gap-1 text-xs">
                  <button type="button" onClick={onDelete} className="h-8 px-2.5 rounded-lg bg-rose-600 text-white font-bold">Delete it</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="h-8 px-2 font-bold text-slate-600 dark:text-slate-300">Keep</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className={iconBtn} aria-label="Delete the slideshow" title="Delete the slideshow"><Trash2 size={14} /></button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className={`${box} p-3 flex flex-col gap-2 min-w-0`}>
          {!ro && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setPicking('photos')} className="h-9 px-3 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5">
                <ImageIcon size={14} /> Add photos
              </button>
              <button type="button" onClick={() => setPicking('clips')} className="h-9 px-3 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5">
                <Film size={14} /> Add clips
              </button>
              <span className="inline-flex items-center gap-1">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !newTitle.trim()) return;
                    const it = titleItem(newTitle.trim());
                    edit((s) => insertItems(s, [it], selected));
                    setNewTitle('');
                    pick(it.id);
                  }}
                  placeholder="Title card words"
                  className={`${input} w-36 h-9`}
                  aria-label="Title card words"
                />
                <button
                  type="button"
                  onClick={() => {
                    const it = titleItem(newTitle.trim() || show.name || 'Title');
                    edit((s) => insertItems(s, [it], selected));
                    setNewTitle('');
                    pick(it.id);
                  }}
                  className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1"
                >
                  <Plus size={12} /> Title card
                </button>
              </span>
              <span className="text-[11px] text-slate-500 w-full sm:w-auto sm:ml-auto">
                {selected ? `New ones go after slide ${selIndex + 1}.` : 'New ones go at the end.'} {touch ? 'Tap a slide to move it.' : 'Drag slides to put them in order.'}
              </span>
            </div>
          )}
          {!show.items.length ? (
            <div className="py-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
              <ImageIcon size={28} className="text-slate-300 dark:text-slate-600" />
              Add photos from Media and clips from your highlights, in any order. Then pick the fades and the music.
            </div>
          ) : (
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null);
              }}
            >
              {show.items.map(tile)}
            </div>
          )}
        </div>

        <div ref={sideRef} className={`${box} p-3 flex flex-col gap-3 min-w-0 lg:max-h-[80vh] lg:overflow-auto lg:sticky lg:top-2 self-start w-full scroll-mt-2`}>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="tablist">
            {(
              [
                ['slide', 'This slide'],
                ['look', 'Fades & photos'],
                ['music', 'Music'],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={side === id}
                onClick={() => setSide(id)}
                className={`h-8 rounded-lg text-[11px] font-black ${side === id ? 'bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
              >
                {text}
                {id === 'music' && o.songs.length ? ` (${o.songs.length})` : ''}
              </button>
            ))}
          </div>
          {side === 'slide' ? slidePanel() : side === 'look' ? lookPanel() : musicPanel()}
        </div>
      </div>

      {picking === 'photos' && (
        <PhotoPicker
          media={media}
          me={me}
          roster={roster}
          already={new Set(show.items.flatMap((i) => (i.kind === 'photo' ? [i.photoId] : [])))}
          onSignIn={() => access.connect()}
          onAdd={(list) => {
            const items = list.map(photoItem);
            edit((s) => insertItems(s, items, selected));
            setPicking('');
          }}
          onClose={() => setPicking('')}
        />
      )}
      {picking === 'clips' && (
        <ClipPicker
          highlights={highlights}
          reels={reels}
          games={games}
          roster={roster}
          already={new Set(show.items.flatMap((i) => (i.kind === 'clip' ? [i.highlightId] : [])))}
          onAdd={(ids) => {
            const items = ids.map(clipItem);
            edit((s) => insertItems(s, items, selected));
            setPicking('');
          }}
          onClose={() => setPicking('')}
        />
      )}
      {playing !== null && (
        <SlideshowPlayer title={show.name} slides={slides} options={o} access={access} look={settings} logo={logo} songs={songs.songs} songLens={songLens} startAt={playing} onClose={() => setPlaying(null)} />
      )}
      {making && <SlideshowVideoPanel title={show.name} slides={slides} options={o} access={access} look={settings} logo={logo} songs={songs.songs} onClose={() => setMaking(false)} />}
    </div>
  );
};

function moveArr<T>(list: T[], from: number, to: number): T[] {
  const out = list.slice();
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, x);
  return out;
}
