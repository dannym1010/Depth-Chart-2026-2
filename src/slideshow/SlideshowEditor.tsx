// One slideshow, made the way you want it: the slides in a row you drag into any order (or move with the buttons on
// an iPad / phone), each one's time, fade, move and words; the fades and photo moves for all of them; and the songs
// under it. Plays right here, or is made into one MP4.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, AudioLines, Clapperboard, ListOrdered, Scissors, Bookmark, Check, CheckSquare, ChevronsDown, ChevronsUp, Copy, Crosshair, Film, Image as ImageIcon, ImagePlus, Move, Music, Play, Plus, Redo2, Sparkles, SquareDashed, Trash2, Type, Undo2, Upload, Video, X,
} from 'lucide-react';
import type { FilmAccess } from '../highlights/filmAccess';
import { clock, orderedHighlights, weekText, type Kid } from '../highlights/highlightData';
import type { Highlight, HighlightGame, HighlightSettings, Reel } from '../highlights/types';
import type { MediaData } from '../media/types';
import { ClipPicker } from './ClipPicker';
import { ReelPicker } from './ReelPicker';
import { PhotoPicker } from './PhotoPicker';
import { photoTimes } from './photoLoad';
import { PhotoThumb } from './PhotoThumb';
import { AiDesignPanel } from './AiDesignPanel';
import type { AppliedPlan } from './aiDesign';
import { lineUpWithBeats, showBeats } from './beats';
import { PreviewDeck } from './PreviewDeck';
import { SlidePreview } from './SlidePreview';
import { SlideshowPlayer } from './SlideshowPlayer';
import { SlideshowVideoPanel } from './SlideshowVideoPanel';
import { useSongAnalysis } from './songAnalysis';
import {
  ARRANGE, arrange, buildSlides, duckLevelOf, gameVolumeOf, inGameOrder, reelSlides, clipItem, copyItem, editItem, editItems, fillSpot, FITS, fitToMusic, insertItems, LOOKS, mmss, MOTIONS, moveItem, moveItems, parseMmss, photoItem, removeItems, SHAPES, showMusicPieces, slidesSeconds, songsSeconds, spotItem, titleItem, TRANSITIONS, type ArrangeHow, type Slide,
} from './slideshowData';
import type { useSongs } from './songs';
import type { PhotoFit, PhotoLook, PhotoMotion, SlideItem, Slideshow, SlideshowOptions, SlideshowShape, SlideTransition } from './types';

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
  /** The program owner: the AI designer tab. */
  aiDesigner?: boolean;
  teamName?: string;
  /** The clip editor (the one in Clips and Reels) on a clip, over the slideshow. */
  renderClipEditor?: (highlightId: string, close: () => void) => React.ReactNode;
}

type Side = 'slide' | 'look' | 'music' | 'ai';

const TRANSITION_SHORT: Record<SlideTransition, string> = { crossfade: 'Crossfade', black: 'Black', white: 'White', cut: 'Cut', wipe: 'Wipe', push: 'Push', zoom: 'Zoom' };

const TILE_SIZES = { s: 92, m: 118, l: 170 } as const;
type TileSize = keyof typeof TILE_SIZES;

export const SlideshowEditor: React.FC<Props> = ({
  show, edit: editRaw, readOnly: ro, highlights, reels, games, roster, media, me, ownerLabel, access, settings, logo, songs, onDuplicate, onDelete, onClose, aiDesigner = false, teamName, renderClipEditor,
}) => {
  const o = show.options;
  const slides = useMemo(() => buildSlides(show, highlights, settings, { roster }), [show, highlights, settings, roster]);
  // The video and the export leave the empty photo spots out.
  const videoSlides = useMemo(() => buildSlides(show, highlights, settings, { spots: false, roster }), [show, highlights, settings, roster]);
  const total = slidesSeconds(slides);
  const slideOf = useMemo(() => new Map(slides.map((s) => [s.item.id, s])), [slides]);
  const hById = useMemo(() => new Map(highlights.map((h) => [h.id, h])), [highlights]);

  // ---- Undo / Redo: every change remembered. Changes from the same box or slider in a row (typing a title,
  // dragging a slider) count as one; every button press is its own. ----
  const showRef = useRef(show);
  showRef.current = show;
  const undoStack = useRef<Slideshow[]>([]);
  const redoStack = useRef<Slideshow[]>([]);
  const lastEditAt = useRef(0);
  const lastEditFrom = useRef<Element | null>(null);
  const [, bumpHistory] = useState(0);
  // The box or slider just typed in / slid (an iPad's Safari leaves a box focused when a button is tapped, so the
  // focus alone can't tell).
  const lastInput = useRef<{ el: EventTarget | null; at: number }>({ el: null, at: 0 });
  useEffect(() => {
    const on = (e: Event) => (lastInput.current = { el: e.target, at: Date.now() });
    document.addEventListener('input', on, true);
    return () => document.removeEventListener('input', on, true);
  }, []);
  const edit = (change: (s: Slideshow) => Slideshow) => {
    const now = Date.now();
    const li = lastInput.current;
    const from = li.el instanceof HTMLInputElement && li.el.type !== 'checkbox' && now - li.at < 200 ? li.el : null;
    const typing = Boolean(from);
    if (!(typing && from === lastEditFrom.current && now - lastEditAt.current < 1500)) {
      undoStack.current.push(showRef.current);
      if (undoStack.current.length > 100) undoStack.current.shift();
    }
    lastEditFrom.current = typing ? from : null;
    lastEditAt.current = now;
    redoStack.current = [];
    editRaw(change);
    bumpHistory((n) => n + 1);
  };
  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev || ro) return;
    redoStack.current.push(showRef.current);
    lastEditAt.current = 0;
    editRaw(() => prev);
    bumpHistory((n) => n + 1);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next || ro) return;
    undoStack.current.push(showRef.current);
    lastEditAt.current = 0;
    editRaw(() => next);
    bumpHistory((n) => n + 1);
  };

  // ---- The picked slides: one (its settings) or several (changed together) ----
  const [picked, setPicked] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const pickedNow = picked.filter((id) => show.items.some((i) => i.id === id));
  const pickedSet = new Set(pickedNow);
  const selected = pickedNow.length === 1 ? pickedNow[0] : null;
  const setSelected = (id: string | null) => setPicked(id ? [id] : []);
  const sel = show.items.find((i) => i.id === selected) || null;
  const selIndex = sel ? show.items.indexOf(sel) : -1;
  // New slides go after the last picked one.
  const insertAfter = pickedNow.length ? show.items.filter((i) => pickedSet.has(i.id)).pop()?.id ?? null : null;
  const insertIndex = insertAfter ? show.items.findIndex((i) => i.id === insertAfter) : -1;
  const [tileSize, setTileSizeState] = useState<TileSize>(() => {
    try {
      const v = localStorage.getItem('slideshowTileSize');
      return v === 's' || v === 'l' ? v : 'm';
    } catch {
      return 'm';
    }
  });
  const setTileSize = (v: TileSize) => {
    setTileSizeState(v);
    try {
      localStorage.setItem('slideshowTileSize', v);
    } catch {
      /* private window */
    }
  };
  const [side, setSide] = useState<Side>('look');
  const [picking, setPicking] = useState<'' | 'photos' | 'clips' | 'reels'>('');
  // Photos picked for a saved spot fill it; the + on a slide puts new ones right after it.
  const [fillingSpot, setFillingSpot] = useState<string | null>(null);
  const [insertHere, setInsertHere] = useState<string | null | undefined>(undefined);
  const [plusMenu, setPlusMenu] = useState<string | null>(null);
  // The preview's playhead: a slide tapped jumps there.
  const [seekReq, setSeekReq] = useState({ t: 0, n: 0 });
  const playhead = useRef(0);
  const seekTo = (t: number) => setSeekReq((s) => ({ t, n: s.n + 1 }));
  // Where a slide is fully in view (past its fade in, and past the fade up from black for the first one).
  const shownAt = (sl: Slide) => sl.start + Math.min(sl.seconds * 0.5, Math.max(sl.fade, sl.start === 0 && o.fadeEnds ? Math.min(1, total / 4) : 0) + 0.05);
  const [playing, setPlaying] = useState<number | null>(null);
  const [making, setMaking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [lengthNote, setLengthNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const setOpt = (p: Partial<SlideshowOptions>) => edit((s) => ({ ...s, options: { ...s.options, ...p } }));
  const setItem = (id: string, p: Partial<SlideItem>) => edit((s) => editItem(s, id, p));
  // The clip open in the clip editor.
  const [editingClip, setEditingClip] = useState<string | null>(null);
  // A phone / narrow iPad shows the slide's settings under all the slides: go there on a tap, and back after.
  const sideRef = useRef<HTMLDivElement>(null);
  const narrow = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 1023px)').matches);
  const touch = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const pick = (id: string | null) => {
    const was = selected;
    setSelected(id);
    anchor.current = id;
    if (id) setSide('slide');
    const at = id ? slideOf.get(id) : null;
    if (at) seekTo(shownAt(at));
    if (!narrow()) return;
    window.setTimeout(() => {
      if (id) sideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (was) document.querySelector(`[data-slide="${was}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
  };
  // A tap: that slide. Ctrl / ⌘ (or "Select several"): add or take it off. Shift: everything from the last one tapped.
  const onTile = (e: React.MouseEvent, id: string, i: number) => {
    if (selectMode || e.ctrlKey || e.metaKey) {
      setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
      anchor.current = id;
      setSide('slide');
      return;
    }
    if (e.shiftKey && anchor.current) {
      const a = show.items.findIndex((x) => x.id === anchor.current);
      if (a >= 0) {
        const [lo, hi] = a < i ? [a, i] : [i, a];
        setPicked(show.items.slice(lo, hi + 1).map((x) => x.id));
        setSide('slide');
        return;
      }
    }
    pick(selected === id ? null : id);
  };
  const selectAll = () => {
    setPicked(show.items.map((i) => i.id));
    setSide('slide');
  };
  const removePicked = () => {
    if (!pickedNow.length || ro) return;
    const last = Math.max(...pickedNow.map((id) => show.items.findIndex((i) => i.id === id)));
    const next = show.items.slice(last + 1).find((i) => !pickedSet.has(i.id)) || show.items.slice(0, last).reverse().find((i) => !pickedSet.has(i.id));
    edit((s) => removeItems(s, pickedNow));
    setPicked(next && pickedNow.length === 1 ? [next.id] : []);
  };
  const copyPicked = () => {
    if (!pickedNow.length || ro) return;
    const copies = show.items.filter((i) => pickedSet.has(i.id)).map(copyItem);
    edit((s) => insertItems(s, copies, insertAfter));
    setPicked(copies.map((c) => c.id));
  };

  // ---- Putting slides in an order ----
  const [arranging, setArranging] = useState('');
  const doArrange = async (how: ArrangeHow) => {
    if (ro) return;
    const scope = pickedNow.length > 1 ? new Set(pickedNow) : null;
    if (how === 'game' && inGameOrder(show.items, { games: gameIndex, highlights: hById, folderGame }, scope) === show.items)
      return flashNote('Nothing to put in game order: no clips, and no photos from a Media folder linked to a game.');
    let times: Record<string, number> = {};
    if (how === 'time' || how === 'game') {
      const need = show.items.flatMap((i) => (i.kind === 'photo' && !i.takenAt && (!scope || scope.has(i.id)) ? [i] : []));
      if (need.length) {
        setArranging('Reading when the photos were taken…');
        times = await photoTimes(media.folders, need).catch(() => ({}));
        setArranging('');
      }
    }
    edit((s) => {
      // Keep the times found, so it's quick next time.
      const known = s.items.map((i) => (i.kind === 'photo' && !i.takenAt && times[i.photoId] ? { ...i, takenAt: times[i.photoId] } : i));
      if (how === 'game') return { ...s, items: inGameOrder(known, { games: gameIndex, highlights: hById, folderGame, times }, scope) };
      return { ...s, items: arrange(known, how, scope, times) };
    });
  };
  // Each game's place in the season (the games come in season order), and which game a Media folder is from.
  const gameIndex = useMemo(() => new Map(games.map((g, i) => [g.key, i])), [games]);
  const folderGame = useMemo(() => new Map(media.folders.flatMap((f) => (f.gameKey ? [[f.id, f.gameKey] as const] : []))), [media.folders]);
  const [note, setNote] = useState('');
  const noteTimer = useRef(0);
  const flashNote = (text: string) => {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(''), 6000);
  };
  // Reels: their clips added (in game order, a card before each game, if asked).
  const addReels = (ids: string[], how: { gameOrder: boolean; gameCards: boolean; skipIn: boolean }) => {
    const chosen = reels.filter((r) => ids.includes(r.id));
    const already = new Set(show.items.flatMap((i) => (i.kind === 'clip' ? [i.highlightId] : [])));
    const items = reelSlides(
      chosen.map((r) => ({ items: r.items, ordered: orderedHighlights(r, highlights, gameIndex).map((h) => h.id) })),
      hById,
      {
        games: gameIndex,
        gameOrder: how.gameOrder,
        gameCards: how.gameCards,
        skip: how.skipIn ? already : undefined,
        weekOf: (key) => {
          const g = games.find((x) => x.key === key);
          return g && !/week|playoff|champ/i.test(g.name) ? weekText(g.week) : '';
        },
      }
    );
    setPicking('');
    setInsertHere(undefined);
    if (!items.length) return flashNote('Those clips are all in the slideshow already.');
    edit((s) => insertItems(s, items, target));
    flashNote(`Added ${items.filter((i) => i.kind === 'clip').length} clips${how.gameCards ? ' with a card before each game' : ''}.`);
  };
  // A volume slider: 0..100%, the word for 0 (Off / Silent), and what the % is of.
  const level = (name: string, v: number, set: (v: number) => void, aria: string, zero?: string, of?: string) => (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="w-24 shrink-0 font-bold text-slate-600 dark:text-slate-300">{name}</span>
      <input type="range" min={0} max={1} step={0.05} value={v} onChange={(e) => set(Number(e.target.value))} className="flex-1 min-w-0" aria-label={aria} disabled={ro} />
      <span className="w-14 tabular-nums text-slate-500 text-right" title={of ? `${Math.round(v * 100)}% ${of}` : undefined}>
        {v <= 0 && zero ? zero : `${Math.round(v * 100)}%`}
      </span>
    </div>
  );
  const setGameVolume = (v: number) => setOpt({ gameVolume: v, clipSound: v <= 0 ? 'off' : v >= 0.95 ? 'full' : 'low' });

  // ---- Keys (a computer): Ctrl+Z / Ctrl+Y, Delete, Ctrl+A, Ctrl+D, Escape ----
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keysRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (picking || playing !== null || making || editingClip) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) undo();
    else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) redo();
    else if (mod && k === 'a') selectAll();
    else if (mod && k === 'd') copyPicked();
    else if ((k === 'delete' || k === 'backspace') && pickedNow.length) removePicked();
    else if (k === 'escape' && pickedNow.length) setPicked([]);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keysRef.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  // ---- Dragging tiles into order (a mouse); the buttons do it on a touch screen ----
  const dragFrom = useRef<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const onDrop = (to: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    setDropAt(null);
    if (from === null || ro) return;
    const dragged = show.items[from];
    if (dragged && pickedSet.has(dragged.id) && pickedNow.length > 1) {
      // Several: their place among the slides left, where the drop line was.
      const before = show.items.slice(0, to).filter((i) => pickedSet.has(i.id)).length;
      edit((s) => moveItems(s, pickedNow, to - before));
      return;
    }
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
  const delay = o.musicDelay || 0;
  const fit = musicSeconds > 0 ? fitToMusic(slides, delay + musicSeconds) : null;

  // ---- The songs read on this device: waveform, tempo and beats (lined up in the slideshow's time) ----
  const playableKey = pickedSongs.map((p) => `${p.name}|${p.seconds}|${p.start || 0}|${p.have}`).join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const playable = useMemo(() => pickedSongs.filter((p) => p.have && p.seconds > 0), [playableKey]);
  const analyses = useSongAnalysis(songs.songs, playable.map((p) => p.name));
  const lens = useMemo(() => playable.map((p) => ({ seconds: p.seconds, start: p.start || 0 })), [playable]);
  const pieces = useMemo(() => showMusicPieces(lens, o.loopMusic, delay, 0, total), [lens, o.loopMusic, delay, total]);
  const analysisOf = (k: number) => {
    const a = analyses[playable[k]?.name];
    return a && a !== 'failed' ? a : undefined;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const beats = useMemo(() => showBeats(pieces, (k) => analysisOf(k)?.beats), [pieces, analyses, playable]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const timelineSongs = useMemo(() => pieces.map((p) => ({ ...p, name: playable[p.song]?.name || '', analysis: analysisOf(p.song) })), [pieces, analyses, playable]);
  const firstStart = o.songs[0]?.start || 0;
  const musicShift = delay - firstStart;
  // Where the songs sit, from the timeline: later = the music starts later; before the start = the first song starts further in.
  const setMusicShift = (shift: number) => {
    const firstLen = playable[0]?.seconds || 0;
    const into = shift < 0 ? Math.min(-shift, Math.max(0, firstLen - 1)) : 0;
    setOpt({ musicDelay: Math.max(0, Math.round(shift * 100) / 100), songs: o.songs.map((x, j) => (j === 0 ? { ...x, start: into > 0 ? Math.round(into * 100) / 100 : undefined } : x)) });
  };
  const [beatNote, setBeatNote] = useState('');
  const lineUp = (every: number, withMarks: boolean, from: Slideshow = show) => {
    const built = from === show ? slides : buildSlides(from, highlights, settings, { roster });
    return lineUpWithBeats(from, built, beats, every, withMarks ? o.marks : []);
  };
  const doLineUp = (every: number, withMarks: boolean) => {
    if (ro) return;
    const r = lineUp(every, withMarks);
    if (!r.changed) {
      setBeatNote(beats.length || o.marks.length ? 'Already lined up.' : 'No beat found yet: add a song (its beat is read in a few seconds), or mark moments while it plays.');
      return;
    }
    edit(() => ({ ...r.show, options: { ...r.show.options, beatEvery: every as 1 | 2 | 4 | 8 } }));
    setBeatNote(`Timed ${r.changed} slide${r.changed === 1 ? '' : 's'} to the ${withMarks ? 'beat and your marks' : 'beat'}.`);
  };
  // The AI's plan, applied as one change (then lined up with the beat, when it asks).
  const applyAi = (r: AppliedPlan) => {
    let next = r.show;
    if (r.beatEvery && beats.length) next = { ...lineUp(r.beatEvery, false, next).show, options: { ...next.options, beatEvery: r.beatEvery } };
    edit(() => next);
    setPicked([]);
  };
  // Timeline: a slide moved (with the others picked along with it) or made longer / shorter.
  const moveBefore = (id: string, beforeId: string | null) => {
    if (ro) return;
    const group = pickedSet.has(id) && pickedNow.length > 1 ? pickedNow : [id];
    edit((s) => {
      const rest = s.items.filter((i) => !group.includes(i.id));
      const at = beforeId ? rest.findIndex((i) => i.id === beforeId) : rest.length;
      return moveItems(s, group, at < 0 ? rest.length : at);
    });
  };
  const fromTimeline = (id: string, how: { add: boolean; range: boolean }) => {
    if (how.add) {
      setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
      anchor.current = id;
    } else if (how.range && anchor.current) {
      const a = show.items.findIndex((x) => x.id === anchor.current);
      const b = show.items.findIndex((x) => x.id === id);
      if (a >= 0 && b >= 0) setPicked(show.items.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id));
    } else {
      setPicked([id]);
      anchor.current = id;
    }
    setSide('slide');
  };
  // Where new slides go: right after a slide's + button, else after the picked ones.
  const target = insertHere !== undefined ? insertHere : insertAfter;
  const addSpot = (afterId: string | null, label?: string) => {
    if (ro) return;
    const it = spotItem(label);
    edit((s) => insertItems(s, [it], afterId));
    setInsertHere(undefined);
    pick(it.id);
  };
  // The + menu closes on a tap anywhere else.
  useEffect(() => {
    if (!plusMenu) return;
    const on = (e: Event) => {
      const t = e.target as Element | null;
      if (!t?.closest?.('[role=menu]') && !t?.closest?.('[aria-label^="Add after"]')) setPlusMenu(null);
    };
    document.addEventListener('pointerdown', on);
    return () => document.removeEventListener('pointerdown', on);
  }, [plusMenu]);

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
    const on = pickedSet.has(item.id);
    const many = pickedNow.length > 1 || selectMode;
    const h = item.kind === 'clip' ? hById.get(item.highlightId) : undefined;
    const trans = s && i > 0 ? s.transition : null;
    return (
      <div
        key={item.id}
        data-slide={item.id}
        className="relative group"
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
            // Dragging one of several picked slides moves them all.
            if (!on || pickedNow.length < 2) setPicked([item.id]);
            dragFrom.current = i;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.id);
          }}
          onDragEnd={() => {
            dragFrom.current = null;
            setDropAt(null);
          }}
          onClick={(e) => onTile(e, item.id, i)}
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
          ) : item.kind === 'spot' ? (
            <div className="absolute inset-0 m-0.5 rounded-md border-2 border-dashed border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-0.5 p-1.5 text-center text-slate-500 dark:text-slate-400">
              <ImagePlus size={18} />
              <span className="text-[10px] font-bold leading-tight line-clamp-2">{item.label || 'Photo goes here'}</span>
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
          {many && (
            <span
              className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full inline-flex items-center justify-center"
              style={on ? { background: '#4f46e5', color: '#fff' } : { background: 'rgba(15,23,42,.45)', border: '2px solid rgba(248,250,252,.85)' }}
              aria-hidden
            >
              {on && <Check size={12} />}
            </span>
          )}
          {item.kind === 'photo' && (item.focus || item.frame) && !many && (
            <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded inline-flex items-center justify-center" style={{ background: 'rgba(15,23,42,.75)', color: '#f8fafc' }} title={item.frame ? 'Placed by hand' : 'Zooms toward a spot you picked'}>
              {item.frame ? <Move size={9} /> : <Crosshair size={9} />}
            </span>
          )}
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
        {!ro && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPlusMenu(plusMenu === item.id ? null : item.id);
            }}
            className={`absolute -right-2.5 top-1/2 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-indigo-600 text-white shadow-md ring-2 ring-white dark:ring-slate-900 inline-flex items-center justify-center transition-opacity ${on || plusMenu === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
            aria-label={`Add after slide ${i + 1}`}
            title="Add after this slide"
          >
            <Plus size={13} />
          </button>
        )}
        {plusMenu === item.id && (
          <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 flex flex-col text-xs" role="menu">
            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">After slide {i + 1}</span>
            {(
              [
                ['Photos', <ImageIcon key="p" size={13} />, () => (setInsertHere(item.id), setPicking('photos'))],
                ['Clips', <Film key="c" size={13} />, () => (setInsertHere(item.id), setPicking('clips'))],
                ...(reels.length ? [['Reels', <Clapperboard key="r" size={13} />, () => (setInsertHere(item.id), setPicking('reels'))] as const] : []),
                [
                  'Title card',
                  <Type key="t" size={13} />,
                  () => {
                    const it = titleItem(show.name || 'Title');
                    edit((s) => insertItems(s, [it], item.id));
                    pick(it.id);
                  },
                ],
                ['Empty photo spot', <SquareDashed key="s" size={13} />, () => addSpot(item.id)],
              ] as const
            ).map(([text, icon, run]) => (
              <button
                key={text}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPlusMenu(null);
                  run();
                }}
                className="h-8 px-2 rounded-lg inline-flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
              >
                {icon} {text}
              </button>
            ))}
          </div>
        )}
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
    if (pickedNow.length > 1) return manyPanel();
    if (!sel)
      return (
        <p className="text-xs text-slate-500">
          Tap a slide to change it: its time, how it fades in, how a photo moves, words on it. To change several at once, {touch ? 'tap Select several, then the slides' : 'Ctrl-click or Shift-click them (or Select several)'}.
        </p>
      );
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
        {s && s.kind !== 'clip' && (
          <SlidePreview
            slide={s}
            options={o}
            look={settings}
            logo={logo}
            readOnly={ro}
            onFocus={(f) => setItem(sel.id, { focus: f })}
            onFrame={(frame, frameEnd) => setItem(sel.id, { frame, frameEnd })}
          />
        )}
        {sel.kind === 'spot' && (
          <>
            {!ro && (
              <button
                type="button"
                onClick={() => {
                  setFillingSpot(sel.id);
                  setPicking('photos');
                }}
                className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-xs font-black inline-flex items-center justify-center gap-1.5"
              >
                <ImagePlus size={15} /> Pick the photo for this spot
              </button>
            )}
            <div className={row}>
              <span className={label}>What goes here</span>
              <input value={sel.label || ''} onChange={(e) => setItem(sel.id, { label: e.target.value || undefined })} className={`${input} flex-1`} disabled={ro} placeholder="e.g. Team photo, #13 with the trophy" aria-label="What photo goes here" />
            </div>
            <div className={row}>
              <span className={label}>Time up</span>
              {secondsInput(sel.seconds, o.photoSeconds, (v) => setItem(sel.id, { seconds: v }))}
            </div>
            <p className="text-[11px] text-slate-500">A spot shows while you edit and play here; the video leaves it out until a photo fills it.</p>
          </>
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
            <div className={row}>
              <span className={label}>Look</span>
              <select value={sel.look || ''} onChange={(e) => setItem(sel.id, { look: (e.target.value || undefined) as PhotoLook | undefined })} className={input} disabled={ro} aria-label="Color look of this photo">
                <option value="">Same as the rest ({LOOKS.find((l) => l.id === o.look)?.label})</option>
                {LOOKS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        {sel.kind === 'clip' && (
          <>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <b>{hById.get(sel.highlightId)?.title || 'This clip was deleted'}</b>
              {s ? ` · ${clock(s.seconds)}` : ''}
            </p>
            {renderClipEditor && hById.has(sel.highlightId) && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditingClip(sel.highlightId)}
                  className="self-start h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1.5"
                >
                  <Scissors size={14} /> Edit the clip
                </button>
                <span className="text-[11px] text-slate-500">
                  Trim, slow motion, freeze, replay, circles and zoom, in the clip editor. It's the same clip as in your reels, so they change too.
                </span>
              </div>
            )}
            {s?.kind === 'clip' && (
              <>
                {level('Game sound', s.sound ? s.gain : 0, (v) => setItem(sel.id, { volume: v, sound: undefined }), 'Game sound on this clip', 'Off')}
                {level('Music under it', s.musicUnder, (v) => setItem(sel.id, { musicUnder: v }), 'Music volume under this clip', 'Silent', 'of the music')}
                {(sel.volume !== undefined || sel.sound !== undefined || sel.musicUnder !== undefined) && !ro && (
                  <button
                    type="button"
                    onClick={() => setItem(sel.id, { volume: undefined, sound: undefined, musicUnder: undefined })}
                    className="self-start h-7 px-2 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-300"
                  >
                    Back to the slideshow's levels
                  </button>
                )}
              </>
            )}
          </>
        )}
        <div className={row}>
          <span className={label}>Fades in by</span>
          {selIndex === 0 ? <span className="text-slate-500">{o.fadeEnds ? 'Up from black (the start)' : 'Starts right away'}</span> : transitionSelect(sel.transition, (v) => setItem(sel.id, { transition: v }), true)}
        </div>
        {!ro && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button type="button" onClick={copyPicked} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1">
              <Copy size={12} /> Copy it
            </button>
            <button
              type="button"
              onClick={removePicked}
              className="h-8 px-2.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> Take it out
            </button>
          </div>
        )}
      </div>
    );
  };

  // ---- Several picked slides, changed together ----
  const manyPanel = () => {
    const list = show.items.filter((i) => pickedSet.has(i.id));
    const photos = list.filter((i) => i.kind === 'photo');
    const timed = list.filter((i) => i.kind !== 'clip');
    const first = show.items.findIndex((i) => pickedSet.has(i.id));
    const all = (patch: (i: SlideItem) => Partial<SlideItem> | null) => edit((x) => editItems(x, pickedNow, patch));
    // The same value on all of them shows; different ones show as "(mixed)".
    const same = <T,>(get: (i: SlideItem) => T): T | '~' => {
      const vals = new Set(list.map((i) => JSON.stringify(get(i) ?? null)));
      return vals.size === 1 ? (get(list[0]) as T) : '~';
    };
    const secs = same((i) => (i.kind === 'clip' ? undefined : i.seconds));
    const trans = same((i) => i.transition);
    const motion = same((i) => (i.kind === 'photo' ? i.motion : undefined));
    const fitV = same((i) => (i.kind === 'photo' ? i.fit : undefined));
    const lookV = same((i) => (i.kind === 'photo' ? i.look : undefined));
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black text-slate-800 dark:text-slate-100">{list.length} slides picked</span>
          <span className="text-[11px] text-slate-500">
            {photos.length} photo{photos.length === 1 ? '' : 's'}
            {list.length - timed.length ? ` · ${list.length - timed.length} clip${list.length - timed.length === 1 ? '' : 's'}` : ''}
          </span>
          <button type="button" onClick={() => setPicked([])} className="ml-auto h-7 px-2 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            Clear
          </button>
        </div>
        {!ro && (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" className={iconBtn} disabled={first <= 0} onClick={() => edit((x) => moveItems(x, pickedNow, 0))} aria-label="Move them to the start" title="Move them to the start"><ChevronsUp size={14} /></button>
              <button type="button" className={iconBtn} disabled={first <= 0} onClick={() => edit((x) => moveItems(x, pickedNow, first - 1))} aria-label="Move them earlier" title="Move them earlier"><ArrowUp size={14} /></button>
              <button type="button" className={iconBtn} onClick={() => edit((x) => moveItems(x, pickedNow, first + 1))} aria-label="Move them later" title="Move them later"><ArrowDown size={14} /></button>
              <button type="button" className={iconBtn} onClick={() => edit((x) => moveItems(x, pickedNow, x.items.length))} aria-label="Move them to the end" title="Move them to the end"><ChevronsDown size={14} /></button>
              <span className="text-[11px] text-slate-500 ml-1">together, in their order</span>
            </div>
            {timed.length > 0 && (
              <div className={row}>
                <span className={label}>Time up</span>
                {secondsInput(secs === '~' ? undefined : (secs as number | undefined), o.photoSeconds, (v) => all((i) => (i.kind === 'clip' ? null : { seconds: v })))}
                {secs === '~' && <span className="text-[11px] text-slate-500">(mixed)</span>}
              </div>
            )}
            {photos.length > 0 && (
              <>
                <div className={row}>
                  <span className={label}>Move</span>
                  <select value={motion === '~' ? '~' : (motion as string) || ''} onChange={(e) => e.target.value !== '~' && all((i) => (i.kind === 'photo' ? { motion: (e.target.value || undefined) as PhotoMotion | undefined } : null))} className={input} aria-label="How these photos move">
                    {motion === '~' && <option value="~">(mixed)</option>}
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
                  <select value={fitV === '~' ? '~' : (fitV as string) || ''} onChange={(e) => e.target.value !== '~' && all((i) => (i.kind === 'photo' ? { fit: (e.target.value || undefined) as PhotoFit | undefined } : null))} className={input} aria-label="Fill or whole, these photos">
                    {fitV === '~' && <option value="~">(mixed)</option>}
                    <option value="">Same as the rest</option>
                    {FITS.filter((f) => f.id !== 'auto').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={row}>
                  <span className={label}>Look</span>
                  <select value={lookV === '~' ? '~' : (lookV as string) || ''} onChange={(e) => e.target.value !== '~' && all((i) => (i.kind === 'photo' ? { look: (e.target.value || undefined) as PhotoLook | undefined } : null))} className={input} aria-label="Color look of these photos">
                    {lookV === '~' && <option value="~">(mixed)</option>}
                    <option value="">Same as the rest</option>
                    {LOOKS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className={row}>
              <span className={label}>Fade in by</span>
              <select value={trans === '~' ? '~' : (trans as string) || ''} onChange={(e) => e.target.value !== '~' && all(() => ({ transition: (e.target.value || undefined) as SlideTransition | undefined }))} className={input} aria-label="How these fade in">
                {trans === '~' && <option value="~">(mixed)</option>}
                <option value="">Same as the rest ({TRANSITIONS.find((t) => t.id === o.transition)?.label})</option>
                {TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button type="button" onClick={copyPicked} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1">
                <Copy size={12} /> Copy them
              </button>
              <button type="button" onClick={removePicked} className="h-8 px-2.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold inline-flex items-center gap-1">
                <Trash2 size={12} /> Take {list.length} out
              </button>
            </div>
          </>
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
        {o.motion !== 'none' && (
          <div className={row}>
            <span className={label}>How much</span>
            {(['subtle', 'normal', 'strong'] as const).map((v) => (
              <button key={v} type="button" className={pill(o.motionStrength === v)} aria-pressed={o.motionStrength === v} onClick={() => setOpt({ motionStrength: v })}>
                {v === 'subtle' ? 'Subtle' : v === 'normal' ? 'Normal' : 'Strong'}
              </button>
            ))}
          </div>
        )}
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
        <p className="text-[11px] text-slate-500">Best for each: a photo about the screen's shape fills it; a tall photo on a wide screen shows whole.</p>
        {o.photoFit !== 'fill' && (
          <div className={row}>
            <span className={label}>Behind it</span>
            {(['blur', 'black', 'team'] as const).map((v) => (
              <button key={v} type="button" className={pill(o.backdrop === v)} aria-pressed={o.backdrop === v} onClick={() => setOpt({ backdrop: v })}>
                {v === 'blur' ? 'Soft copy' : v === 'black' ? 'Black' : 'Team color'}
              </button>
            ))}
          </div>
        )}
        <div className={row}>
          <span className={label}>Title cards</span>
          <input type="range" min={1.5} max={10} step={0.5} value={o.titleSeconds} onChange={(e) => setOpt({ titleSeconds: Number(e.target.value) })} className="flex-1 min-w-0" aria-label="Seconds each title card is up" />
          <span className="w-12 tabular-nums text-slate-500">{o.titleSeconds} s</span>
        </div>
        <div className={row}>
          <span className={label}>Run about</span>
          <input
            key={`len-${Math.round(total)}`}
            defaultValue={mmss(total)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onBlur={(e) => {
              const want = parseMmss(e.target.value);
              if (!Number.isFinite(want) || Math.abs(want - total) < 1) return;
              const each = fitToMusic(slides, want);
              if (each === null) {
                setLengthNote(`The clips and title cards alone run ${mmss(total - counts.p * o.photoSeconds)}.`);
                e.target.value = mmss(total);
              } else {
                setLengthNote('');
                setOpt({ photoSeconds: each });
              }
            }}
            className={`${input} w-16`}
            aria-label="How long the slideshow runs"
          />
          <span className="text-slate-500">minutes:seconds (sets each photo's time)</span>
          {lengthNote && <span className="text-[11px] text-amber-600 dark:text-amber-400 w-full">{lengthNote}</span>}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5" disabled={ro}>
        <legend className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1">Look</legend>
        <div className="grid grid-cols-5 gap-1">
          {LOOKS.map((l) => {
            const on = o.look === l.id;
            const swatch: Record<string, string> = {
              natural: 'linear-gradient(135deg,#16a34a,#2563eb)',
              warm: 'linear-gradient(135deg,#f59e0b,#b45309)',
              cool: 'linear-gradient(135deg,#38bdf8,#1e40af)',
              bw: 'linear-gradient(135deg,#e5e7eb,#111827)',
              vintage: 'linear-gradient(135deg,#d6b98c,#7c5a3a)',
            };
            return (
              <button key={l.id} type="button" onClick={() => setOpt({ look: l.id })} aria-pressed={on} className={`flex flex-col items-center gap-1 rounded-lg border p-1 ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="w-full h-6 rounded" style={{ background: swatch[l.id] }} aria-hidden />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-tight text-center">{l.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.vignette} onChange={(e) => setOpt({ vignette: e.target.checked })} /> Darker corners
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.logoBug} onChange={(e) => setOpt({ logoBug: e.target.checked })} disabled={!logo} /> Team logo in the corner{!logo ? ' (add a logo in Highlights settings)' : ''}
          </label>
        </div>
        <div className={row}>
          <span className={label}>Photo words</span>
          {(['bottom', 'top'] as const).map((v) => (
            <button key={v} type="button" className={pill(o.captionAt === v)} aria-pressed={o.captionAt === v} onClick={() => setOpt({ captionAt: v })}>
              {v === 'bottom' ? 'At the bottom' : 'At the top'}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5" disabled={ro}>
        <legend className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1">Clips</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.clipTitles} onChange={(e) => setOpt({ clipTitles: e.target.checked })} /> Clip titles
          </label>
          <label className="inline-flex items-center gap-1.5" title="Under the title: each kid in the clip (#52 Sam), named the way Highlights settings say">
            <input type="checkbox" checked={o.clipKids !== false} disabled={!o.clipTitles} onChange={(e) => setOpt({ clipKids: e.target.checked })} /> Kids' numbers and names
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={o.clipReplays} onChange={(e) => setOpt({ clipReplays: e.target.checked })} /> Replays
          </label>
        </div>
        {level('Game sound', gameVolumeOf(o), setGameVolume, 'Game sound volume', 'Off')}
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
        {level('Music', o.musicVolume, (v) => setOpt({ musicVolume: v }), 'Song volume')}
        {level('Game sound', gameVolumeOf(o), setGameVolume, 'Game sound volume', 'Off')}
        {o.duck && level('Music dips to', duckLevelOf(o), (v) => setOpt({ duckLevel: v }), 'Music volume while game sound plays', 'Silent', 'of the music')}
        <p className="text-[11px] text-slate-500">A clip can have its own levels too: tap it.</p>
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
      <fieldset className="flex flex-col gap-2" disabled={ro}>
        <legend className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1 inline-flex items-center gap-1">
          <AudioLines size={13} /> Line up with the music
        </legend>
        {playable.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-[11px] text-slate-600 dark:text-slate-300">
            {playable.map((p) => {
              const a = analyses[p.name];
              return (
                <li key={p.name} className="truncate">
                  <b>{p.name}</b>: {a === 'failed' ? "couldn't read its beat" : a ? (a.bpm ? `${Math.round(a.bpm)} beats a minute · ${a.beats.length} beats` : 'no steady beat found') : 'reading the beat…'}
                </li>
              );
            })}
          </ul>
        ) : (
          <span className="text-[11px] text-slate-500">Add a song above; its beat is read on this device.</span>
        )}
        <div className={row}>
          <span className={label}>Music starts</span>
          <input
            key={`delay-${delay}`}
            defaultValue={mmss(delay)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onBlur={(e) => {
              const v = parseMmss(e.target.value);
              if (Number.isFinite(v) && Math.abs(v - delay) > 0.01) setOpt({ musicDelay: Math.max(0, v) });
              else e.target.value = mmss(delay);
            }}
            className={`${input} w-16`}
            aria-label="Seconds into the slideshow the music starts"
          />
          <span className="text-slate-500">into the slideshow</span>
          {sel && slideOf.get(sel.id) && (
            <button type="button" onClick={() => setOpt({ musicDelay: Math.round((slideOf.get(sel.id)?.start || 0) * 100) / 100 })} className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold">
              With slide {selIndex + 1}
            </button>
          )}
          <button type="button" onClick={() => setOpt({ musicDelay: Math.round(playhead.current * 100) / 100 })} className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold">
            At the playhead
          </button>
        </div>
        <div className={row}>
          <span className={label}>New photo every</span>
          {([1, 2, 4, 8] as const).map((n) => (
            <button key={n} type="button" className={pill(o.beatEvery === n)} aria-pressed={o.beatEvery === n} onClick={() => setOpt({ beatEvery: n })}>
              {n} beat{n === 1 ? '' : 's'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => doLineUp(o.beatEvery, false)} disabled={!beats.length} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-40">
            <AudioLines size={14} /> Change slides on the beat
          </button>
          {o.marks.length > 0 && (
            <button type="button" onClick={() => doLineUp(o.beatEvery, true)} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1.5">
              <Bookmark size={13} /> …and on my {o.marks.length} mark{o.marks.length === 1 ? '' : 's'}
            </button>
          )}
        </div>
        {beatNote && <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{beatNote}</span>}
        <p className="text-[11px] text-slate-500">
          Each photo, title card and spot is timed so the next one starts on a beat (clips keep their length). Tap <b>Mark</b> under the preview (or press M) while it plays to mark big moments in the song (the chorus, a drop); they show on the timeline and slides line up to them too.
        </p>
        {o.marks.length > 0 && !ro && (
          <button type="button" onClick={() => setOpt({ marks: [] })} className="self-start text-[11px] font-bold text-slate-600 dark:text-slate-300 underline">
            Clear my {o.marks.length} mark{o.marks.length === 1 ? '' : 's'}
          </button>
        )}
      </fieldset>
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
            <Video size={14} /> Video & export
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
        <div className="flex flex-col gap-3 min-w-0">
        {slides.length > 0 && (
          <div className={`${box} p-2 sm:p-3 min-w-0`}>
            <PreviewDeck
              keysOff={Boolean(picking || playing !== null || making || editingClip)}
              title={show.name}
              slides={slides}
              total={total}
              options={o}
              access={access}
              look={settings}
              logo={logo}
              songs={songs.songs}
              songLens={songLens}
              seek={seekReq}
              readOnly={ro}
              picked={pickedSet}
              onPick={fromTimeline}
              onResize={(id, seconds) => setItem(id, { seconds })}
              onMove={moveBefore}
              timelineSongs={timelineSongs}
              beats={beats}
              onMarks={(marks) => setOpt({ marks })}
              musicShift={musicShift}
              onMusicShift={setMusicShift}
              onBig={(t) => setPlaying(t)}
              timeRef={playhead}
            />
          </div>
        )}
        <div className={`${box} p-3 flex flex-col gap-2 min-w-0`}>
          {!ro && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setPicking('photos')} className="h-9 px-3 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5">
                <ImageIcon size={14} /> Add photos
              </button>
              <button type="button" onClick={() => setPicking('clips')} className="h-9 px-3 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5">
                <Film size={14} /> Add clips
              </button>
              {reels.length > 0 && (
                <button type="button" onClick={() => setPicking('reels')} className="h-9 px-3 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5">
                  <Clapperboard size={14} /> Add reels
                </button>
              )}
              <span className="inline-flex items-center gap-1">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !newTitle.trim()) return;
                    const it = titleItem(newTitle.trim());
                    edit((s) => insertItems(s, [it], insertAfter));
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
                    edit((s) => insertItems(s, [it], insertAfter));
                    setNewTitle('');
                    pick(it.id);
                  }}
                  className="h-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1"
                >
                  <Plus size={12} /> Title card
                </button>
                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const [where, title, sub] = v.split('|');
                    const it = titleItem(title, sub || undefined);
                    edit((s) => (where === 'start' ? { ...s, items: [it, ...s.items] } : where === 'end' ? { ...s, items: [...s.items, it] } : insertItems(s, [it], target)));
                    pick(it.id);
                  }}
                  className={`${input} h-9 w-24`}
                  aria-label="Ready-made title cards"
                >
                  <option value="">Ready-made…</option>
                  {teamName && <option value={`start|${teamName}|Season highlights`}>Opening: {teamName}</option>}
                  <option value="start|Our Season|Every snap, every smile">Opening: Our Season</option>
                  <option value="here|The Playoffs">The Playoffs</option>
                  <option value="here|Behind the Scenes|Practice · Sidelines · Fun">Behind the Scenes</option>
                  <option value="end|Thank you, Coaches">Thank you, Coaches</option>
                  <option value="end|Thank you, Families|We couldn't do it without you">Thank you, Families</option>
                  <option value="end|See you next season">Ending: See you next season</option>
                </select>
              </span>
              <button
                type="button"
                onClick={() => addSpot(target)}
                className="h-9 px-2.5 rounded-lg border border-dashed border-slate-400 dark:border-slate-500 text-xs font-bold inline-flex items-center gap-1 text-slate-700 dark:text-slate-200"
                title="Save a place for a photo you'll add later"
              >
                <SquareDashed size={13} /> Photo spot
              </button>
              <span className="text-[11px] text-slate-500 w-full sm:w-auto sm:ml-auto">
                {insertAfter ? `New ones go after slide ${insertIndex + 1}.` : 'New ones go at the end.'} {touch ? 'Tap a slide, then its + to add after it.' : 'Drag slides to put them in order; the + on a slide adds after it.'}
              </span>
            </div>
          )}
          {show.items.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
              {!ro && (
                <>
                  <button type="button" className={iconBtn} disabled={!undoStack.current.length} onClick={undo} aria-label="Undo" title="Undo (Ctrl+Z)">
                    <Undo2 size={14} />
                  </button>
                  <button type="button" className={iconBtn} disabled={!redoStack.current.length} onClick={redo} aria-label="Redo" title="Redo (Ctrl+Y)">
                    <Redo2 size={14} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectMode((m) => !m);
                  if (selectMode) setPicked([]);
                }}
                aria-pressed={selectMode}
                className={pill(selectMode)}
              >
                <span className="inline-flex items-center gap-1">
                  <CheckSquare size={13} /> {selectMode ? 'Done selecting' : 'Select several'}
                </span>
              </button>
              {(selectMode || pickedNow.length > 1) && (
                <>
                  <button type="button" onClick={selectAll} className="h-8 px-2 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-300">
                    All
                  </button>
                  {pickedNow.length > 0 && (
                    <button type="button" onClick={() => setPicked([])} className="h-8 px-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                      None
                    </button>
                  )}
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{pickedNow.length} picked</span>
                </>
              )}
              {!ro && (
                <select
                  value=""
                  disabled={Boolean(arranging)}
                  onChange={(e) => e.target.value && void doArrange(e.target.value as ArrangeHow)}
                  className={input}
                  aria-label="Put in an order"
                >
                  <option value="">{arranging || (pickedNow.length > 1 ? `Arrange the ${pickedNow.length} picked…` : 'Arrange…')}</option>
                  {ARRANGE.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              )}
              {!ro && (
                <button
                  type="button"
                  disabled={Boolean(arranging)}
                  onClick={() => void doArrange('game')}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40"
                  title="Games first to last: each game's photos by when they were taken, its plays in order spread through them"
                >
                  <ListOrdered size={13} /> {pickedNow.length > 1 ? 'Picked in game order' : 'Game order'}
                </button>
              )}
              {note && (
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300" role="status">
                  {note}
                </span>
              )}
              <span className="ml-auto inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden" role="group" aria-label="Tile size">
                {(['s', 'm', 'l'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTileSize(v)}
                    aria-pressed={tileSize === v}
                    aria-label={v === 's' ? 'Small slides' : v === 'm' ? 'Medium slides' : 'Large slides'}
                    className={`h-8 w-8 inline-flex items-center justify-center ${tileSize === v ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500'}`}
                  >
                    <ImageIcon size={v === 's' ? 10 : v === 'm' ? 13 : 16} />
                  </button>
                ))}
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
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_SIZES[tileSize]}px, 1fr))` }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null);
              }}
            >
              {show.items.map(tile)}
            </div>
          )}
        </div>
        </div>

        <div ref={sideRef} className={`${box} p-3 flex flex-col gap-3 min-w-0 lg:max-h-[80vh] lg:overflow-auto lg:sticky lg:top-2 self-start w-full scroll-mt-2`}>
          <div className={`grid ${aiDesigner ? 'grid-cols-4' : 'grid-cols-3'} gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800`} role="tablist">
            {(
              [
                ['slide', 'This slide'],
                ['look', 'Look'],
                ['music', 'Music'],
                ...(aiDesigner ? ([['ai', 'AI']] as const) : []),
              ] as [Side, string][]
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={side === id}
                onClick={() => setSide(id)}
                className={`h-8 rounded-lg text-[11px] font-black inline-flex items-center justify-center gap-1 ${side === id ? 'bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
              >
                {id === 'ai' && <Sparkles size={12} />}
                {text}
                {id === 'music' && o.songs.length ? ` (${o.songs.length})` : ''}
              </button>
            ))}
          </div>
          {side === 'slide' ? (
            slidePanel()
          ) : side === 'look' ? (
            lookPanel()
          ) : side === 'music' || !aiDesigner ? (
            musicPanel()
          ) : (
            <AiDesignPanel
              show={show}
              slides={slides}
              media={media}
              highlights={highlights}
              roster={roster.map((k) => ({ num: k.num, name: [k.firstName, k.lastName].filter(Boolean).join(' ') }))}
              teamName={teamName}
              songs={playable.map((p) => ({ name: p.name, seconds: p.seconds, bpm: analysisOf(playable.indexOf(p))?.bpm || 0, start: p.start || 0 }))}
              beats={beats}
              readOnly={ro}
              onApply={applyAi}
            />
          )}
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
            const spot = fillingSpot;
            edit((s) => (spot && s.items.some((i) => i.id === spot) ? fillSpot(s, spot, items) : insertItems(s, items, target)));
            if (spot && items[0]) pick(items[0].id);
            setPicking('');
            setFillingSpot(null);
            setInsertHere(undefined);
          }}
          onClose={() => (setPicking(''), setFillingSpot(null), setInsertHere(undefined))}
        />
      )}
      {picking === 'reels' && (
        <ReelPicker
          reels={reels}
          highlights={highlights}
          games={games}
          already={new Set(show.items.flatMap((i) => (i.kind === 'clip' ? [i.highlightId] : [])))}
          onAdd={addReels}
          onClose={() => (setPicking(''), setInsertHere(undefined))}
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
            edit((s) => insertItems(s, items, target));
            setPicking('');
            setInsertHere(undefined);
          }}
          onClose={() => (setPicking(''), setInsertHere(undefined))}
        />
      )}
      {playing !== null && (
        <SlideshowPlayer title={show.name} slides={slides} options={o} access={access} look={settings} logo={logo} songs={songs.songs} songLens={songLens} startAt={playing} onClose={() => setPlaying(null)} />
      )}
      {editingClip && renderClipEditor && hById.has(editingClip) && (
        <div className="fixed inset-0 z-[85] bg-black/60 overflow-auto p-2 sm:p-4" onClick={() => setEditingClip(null)}>
          <div role="dialog" aria-label="Edit the clip" onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2 sm:p-3">
            {renderClipEditor(editingClip, () => setEditingClip(null))}
          </div>
        </div>
      )}
      {making && <SlideshowVideoPanel title={show.name} slides={videoSlides} options={o} access={access} look={settings} logo={logo} songs={songs.songs} songLens={songLens} onClose={() => setMaking(false)} />}
    </div>
  );
};

function moveArr<T>(list: T[], from: number, to: number): T[] {
  const out = list.slice();
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, x);
  return out;
}
