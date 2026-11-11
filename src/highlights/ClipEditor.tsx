// One highlight, up close: its clip with start and end handles (drag them, or I / O at the playhead), the trimmed
// part on a loop, "Start at snap", slow motion over part of it, a freeze frame with a spotlight on a kid (tap him on
// the picture), a replay from another camera lined up with this one, and its title, kinds, kids, rating and note.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clapperboard, Columns2, Crosshair, Instagram, Pause, Play as PlayIcon, Redo2, Repeat, Scissors, SkipBack, Star, Trash2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ReelPlayer } from './ReelPlayer';
import type { Play } from '../hudlScout/types/football';
import { probeSnap, snapTimeCache } from '../filmroom/snapProbe';
import { savedOffset, snapOffset, syncTarget } from '../filmroom/dualView';
import type { FilmGameShared } from '../filmroom/types';
import { lineUp, type FilmAccess, type GameFilm } from './filmAccess';
import { drawLowerThird, drawSpot, loadImage } from './graphics';
import { autoTitle, editHighlight, highlightSegments, kidLabel, kidsText, removeHighlights, snapWindow, type Kid } from './highlightData';
import { SocialVideoPanel } from './SocialVideoPanel';
import { FOLLOW_STEP, followCam, packFollow, pathAt, recordInto, stretches, thin, unpackFollow, type FollowPoint } from './follow';
import type { Highlight, HighlightCategory, HighlightMark, HighlightSettings, SpotStyle } from './types';
import type { HighlightStore } from './useHighlights';
import { useClipSrc } from './useClipSrc';
import { useZoomPan } from './useZoomPan';
import { CLIP_ZOOM_LEVELS, clipCamera, fitCam, zoomRect } from './clipZoom';

export const CATEGORY_LABEL: Record<HighlightCategory, string> = {
  td: 'TD', big_run: 'Big run', catch: 'Catch', pass: 'Pass', sack: 'Sack', int: 'INT', fumble: 'Fumble', tfl: 'TFL', pbu: 'PBU', tackle: 'Tackle',
  block: 'Block', kick: 'Kick', celebration: 'Celebration', sideline: 'Sideline', huddle: 'Huddle', coin_toss: 'Coin toss', warmups: 'Warm-ups',
  crowd: 'Crowd', trophy: 'Trophy', other: 'Other',
};

/** −  2×  +  in the picture's corner (the level resets to 1× when tapped). */
const ZoomButtons: React.FC<{ zp: ReturnType<typeof useZoomPan> }> = ({ zp }) => {
  const b = 'h-7 w-7 inline-flex items-center justify-center rounded-md disabled:opacity-40';
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
    >
      <button type="button" className={b} onClick={() => zp.zoomBy(-0.5)} disabled={zp.zoom <= 1} aria-label="Zoom out">
        <ZoomOut size={14} />
      </button>
      <button type="button" className="h-7 px-1 text-[11px] font-bold tabular-nums" onClick={zp.userReset} title="Back to the whole picture">
        {zp.zoom.toFixed(1)}×
      </button>
      <button type="button" className={b} onClick={() => zp.zoomBy(0.5)} disabled={zp.zoom >= 6} aria-label="Zoom in">
        <ZoomIn size={14} />
      </button>
    </div>
  );
};

const fmt = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${(Math.max(0, t) % 60).toFixed(1).padStart(4, '0')}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pictures along a clip, drawn into the trim bar: a hidden copy of the video, stepped through once. Drawn straight
 * into the canvases (never read back), so film from another site works too. Nothing shows if the device won't load it.
 */
const Filmstrip: React.FC<{ url: string; len: number }> = ({ url, len }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    const w = boxRef.current?.clientWidth || 320;
    setN(Math.max(4, Math.min(14, Math.round(w / 60))));
  }, []);
  useEffect(() => {
    if (!n || !url || !len) return;
    let off = false;
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    v.src = url;
    const draw = async () => {
      await new Promise<void>((res, rej) => {
        const t = window.setTimeout(() => rej(new Error('slow')), 10000);
        v.onloadeddata = () => {
          window.clearTimeout(t);
          res();
        };
        v.onerror = () => {
          window.clearTimeout(t);
          rej(new Error('no film'));
        };
      });
      for (let i = 0; i < n && !off; i++) {
        await new Promise<void>((res) => {
          const done = () => res();
          v.addEventListener('seeked', done, { once: true });
          window.setTimeout(done, 3000);
          v.currentTime = Math.min(len - 0.05, ((i + 0.5) * len) / n);
        });
        const c = canvases.current[i];
        if (!c || off || !v.videoWidth) continue;
        c.width = Math.max(1, c.clientWidth);
        c.height = Math.max(1, c.clientHeight);
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        const s = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
        ctx.drawImage(v, (c.width - v.videoWidth * s) / 2, (c.height - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s);
      }
    };
    draw().catch(() => undefined);
    return () => {
      off = true;
      v.removeAttribute('src');
      v.load();
    };
  }, [url, len, n]);
  return (
    <div ref={boxRef} className="absolute inset-0 flex pointer-events-none" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <canvas key={i} ref={(el) => void (canvases.current[i] = el)} className="h-full flex-1 min-w-0" />
      ))}
    </div>
  );
};

type EditorTab = 'trim' | 'effects' | 'camera' | 'circles' | 'details';
/** The section last open (the next clip opens on it too). */
let lastTab: EditorTab = 'trim';

interface Props {
  h: Highlight;
  store: HighlightStore;
  access: FilmAccess;
  shared?: Partial<FilmGameShared>;
  /** The game's plays (to find the replay camera's clip of this play). */
  plays: Play[];
  roster: Kid[];
  onClose: () => void;
  /** "Add to reel" choices. */
  reels: { id: string; name: string; has?: boolean }[];
  /** A reel's id, or '__new' for a new reel. Without it (a parent's own highlights) there's no "Add to reel". */
  onAddToReel?: (reelId: string) => void;
}

export const ClipEditor: React.FC<Props> = ({ h, store, access, shared, plays, roster, onClose, reels, onAddToReel }) => {
  const settings = store.data.settings;
  const ro = store.readOnly;
  const src = useClipSrc(access, h.game, h.view, h.clip);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const [now, setNow] = useState(0);
  const [len, setLen] = useState(h.clipLen || 0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [placing, setPlacing] = useState(false);
  // Circles / arrows on a kid: the style and how long the next one stays up, and whether a tap places one.
  const [marking, setMarking] = useState(false);
  const [markStyle, setMarkStyle] = useState<SpotStyle>('ring');
  const [markSecs, setMarkSecs] = useState(2);
  const [busy, setBusy] = useState('');
  // Follow a kid by finger: the clip plays slowly while a finger (or the mouse button) stays on him; each stretch is
  // saved when the finger lifts. The Instagram video's camera rides the path.
  const [following, setFollowing] = useState(false);
  const [followSpeed, setFollowSpeed] = useState(0.25);
  const [watchFollow, setWatchFollow] = useState(false);
  // Show the zoom kept for Play and the Resolve export on the editor's picture.
  const [showZoom, setShowZoom] = useState(false);
  const [fingerDown, setFingerDown] = useState(false);
  const followRef = useRef<{ speed: number } | null>(null);
  const fingerRef = useRef<{ x: number; y: number } | null>(null);
  const stretchRef = useRef<FollowPoint[]>([]);
  const path = useMemo(() => unpackFollow(h.follow?.pts), [h.follow]);
  // Start / end while a handle is dragged (saved on letting go).
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const start = draft?.start ?? h.start;
  const end = draft?.end ?? h.end;

  // The sections under the picture (the last one used stays open from clip to clip).
  const [tab, setTabState] = useState<EditorTab>(lastTab);
  const setTab = (t: EditorTab) => {
    lastTab = t;
    setTabState(t);
  };
  // Review speed (slow motion inside the clip plays slower still).
  const [rate, setRate] = useState(1);
  // The finished clip, played the way a reel shows it.
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Undo / redo: every change made here, back to when the clip was opened.
  const hRef = useRef(h);
  hRef.current = h;
  const undoStack = useRef<Highlight[]>([]);
  const redoStack = useRef<Highlight[]>([]);
  const [, bumpHistory] = useState(0);
  const syncView = useRef(false);
  const rawEdit = useCallback((change: (x: Highlight) => Highlight) => !ro && store.update((d) => editHighlight(d, h.id, change)), [ro, store, h.id]);
  const edit = useCallback(
    (change: (x: Highlight) => Highlight) => {
      if (ro) return;
      undoStack.current = [...undoStack.current.slice(-49), hRef.current];
      redoStack.current = [];
      bumpHistory((n) => n + 1);
      store.update((d) => editHighlight(d, h.id, change));
    },
    [ro, store, h.id]
  );
  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(hRef.current);
    syncView.current = true;
    bumpHistory((n) => n + 1);
    rawEdit(() => ({ ...prev, id: h.id }));
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(hRef.current);
    syncView.current = true;
    bumpHistory((n) => n + 1);
    rawEdit(() => ({ ...next, id: h.id }));
  };
  const zp = useZoomPan();
  const zp2 = useZoomPan();
  // The other camera beside this one: its view, its clip of this play and how far its clock is from this clip's.
  const [side, setSide] = useState<{ view: string; clip: string; offset: number; guessed: boolean } | null>(null);
  const sideSrc = useClipSrc(access, side ? h.game : undefined, side?.view || '', side?.clip);
  const sideRef = useRef<HTMLVideoElement>(null);

  // The video: a loop of the trimmed part.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src.url) return;
    let raf = 0;
    const tick = () => {
      const t = v.currentTime;
      setNow(t);
      const fol = followRef.current;
      if (!v.paused && fol) {
        // Following a kid: slow, keeping the finger's spot, and stopping at the end (no loop).
        if (v.playbackRate !== fol.speed) v.playbackRate = fol.speed;
        const f = fingerRef.current;
        const lastPt = stretchRef.current[stretchRef.current.length - 1];
        if (f && (!lastPt || t - lastPt.t >= FOLLOW_STEP - 1e-3)) stretchRef.current.push({ t, x: f.x, y: f.y });
        if (t >= end - 0.02) v.pause();
      } else if (!v.paused) {
        const slow = (h.slow && t >= h.slow.from && t < h.slow.to ? h.slow.speed : 1) * rate;
        if (v.playbackRate !== slow) v.playbackRate = slow;
        if (t >= end - 0.02) {
          if (loop) v.currentTime = start;
          else v.pause();
        }
      }
      const o = sideRef.current;
      if (o && side && o.readyState >= 1) {
        const want = syncTarget(t, side.offset, o.duration);
        if (Math.abs(o.currentTime - want.t) > (v.paused ? 0.02 : 0.15)) o.currentTime = want.t;
        if (o.playbackRate !== v.playbackRate) o.playbackRate = v.playbackRate;
        const run = !v.paused && !want.before && !want.after;
        if (run && o.paused) void o.play().catch(() => undefined);
        else if (!run && !o.paused) o.pause();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [src.url, start, end, loop, h.slow, side, rate]);

  const onLoaded = () => {
    const v = videoRef.current!;
    if (Number.isFinite(v.duration)) {
      setLen(v.duration);
      // The clip's real length (not something to undo).
      if (!h.clipLen || Math.abs(h.clipLen - v.duration) > 0.2) rawEdit((x) => ({ ...x, clipLen: r2(v.duration), end: x.end > v.duration ? r2(v.duration) : x.end }));
    }
    v.currentTime = h.start;
  };
  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(len || t, t));
  };
  /** A frame (or more) back or ahead, paused. */
  const step = (d: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    seek(v.currentTime + d);
  };
  /** Watch the last couple of seconds: does it end where it should? */
  const checkEnd = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(start, end - 2);
    void v.play().catch(() => undefined);
  };
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end - 0.05) v.currentTime = start;
      void v.play();
    } else v.pause();
  };

  const setStart = (t: number) => edit((x) => ({ ...x, start: r2(Math.max(0, Math.min(t, x.end - 0.3))) }));
  const setEnd = (t: number) => edit((x) => ({ ...x, end: r2(Math.min(len || t, Math.max(t, x.start + 0.3))) }));

  // I / O at the playhead, space plays, arrows step a frame.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (preview || social) {
        if (e.key === 'Escape' && social) setSocial(false);
        return;
      }
      // Ctrl+Z undoes, Ctrl+Y / Ctrl+Shift+Z redoes.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        if (e.key.toLowerCase() === 'y' || e.shiftKey) redo();
        else undo();
        e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (social) {
        if (e.key === 'Escape') setSocial(false);
        return;
      }
      if (following && e.key === 'Escape') {
        stopFollow();
        e.preventDefault();
        return;
      }
      const v = videoRef.current;
      if (!v) return;
      const k = e.key.toLowerCase();
      if (k === 'i') setStart(v.currentTime);
      else if (k === 'o') setEnd(v.currentTime);
      else if (k === ' ') toggle();
      else if (k === 'arrowleft' || k === 'arrowright') {
        v.pause();
        v.currentTime = Math.max(0, v.currentTime + (k === 'arrowleft' ? -1 : 1) / 30);
      } else if (k === 'escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // The lower third and the spotlight drawn over the picture, as the reel will show them.
  const kids = kidsText(h.kids, roster, settings.names);

  // "Instagram video" of just this highlight: its title, slow motion, freeze and replay.
  const [social, setSocial] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (social || preview) void loadImage(settings.logo).then(setLogo);
  }, [social, preview, settings.logo]);
  const socialSegments = useMemo(
    () => (social || preview ? highlightSegments(h, { overlay: { title: h.title, sub: kids || undefined }, replays: h.replay ? 'each' : 'none', replaySpeed: settings.replaySpeed }) : []),
    [social, preview, h, kids, settings.replaySpeed]
  );
  useEffect(() => {
    const c = overRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    const w = (c.width = c.clientWidth * (window.devicePixelRatio || 1));
    const hh = (c.height = c.clientHeight * (window.devicePixelRatio || 1));
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, hh);
    const atFreeze = h.freeze && Math.abs(now - h.freeze.at) < 0.08;
    if (h.freeze?.spot && (atFreeze || placing)) drawSpot(ctx, w, hh, h.freeze.spot, settings);
    for (const m of h.marks || []) if (now >= m.from && now <= m.to) drawSpot(ctx, w, hh, m, settings);
    if (now >= start && now <= end) drawLowerThird(ctx, w, hh, { title: h.title, sub: kids || undefined }, settings);
    // The kid's path (while following, or paused), and where it has him now.
    if (path.length > 1 && (following || !playing)) {
      const u = Math.min(w, hh) / 400;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(249,115,22,0.75)';
      ctx.lineWidth = 3 * u;
      // Each stretch he was followed (none drawn across a gap where he wasn't).
      const parts = stretches(path);
      if (!watchFollow) {
        for (const s of parts) {
          ctx.beginPath();
          s.forEach((p, i) => (i ? ctx.lineTo(p.x * w, p.y * hh) : ctx.moveTo(p.x * w, p.y * hh)));
          ctx.stroke();
        }
      }
      const on = parts.find((s) => now >= s[0].t - 0.05 && now <= s[s.length - 1].t + 0.05);
      const at = on ? pathAt(on, now) : null;
      if (at) {
        ctx.fillStyle = '#f97316';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.arc(at.x * w, at.y * hh, 7 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [now, h.freeze, h.marks, h.title, kids, settings, start, end, placing, path, following, playing, watchFollow]);

  const findSnap = async () => {
    if (!src.url) return;
    setBusy('Finding the snap…');
    const snap = snapTimeCache.get(src.url) ?? (await probeSnap(src.url));
    setBusy(snap === null ? "Couldn't find the snap in this clip." : '');
    if (snap !== null) {
      const w = snapWindow(snap, len || undefined, settings);
      edit((x) => ({ ...x, ...w }));
      seek(w.start);
    }
  };

  // The trim bar: drag the handles; a tap moves the playhead.
  const barRef = useRef<HTMLDivElement>(null);
  const timeAt = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(len, ((clientX - r.left) / r.width) * len));
  };
  const drag = useRef<'start' | 'end' | null>(null);
  const onBarDown = (e: React.PointerEvent, which?: 'start' | 'end') => {
    if (!len) return;
    e.stopPropagation();
    // A finger is wider than a handle: a touch near one grabs it (a tap elsewhere moves the playhead).
    if (!which && !ro && barRef.current) {
      const r = barRef.current.getBoundingClientRect();
      const reach = e.pointerType === 'mouse' ? 6 : 22;
      const dist = (t: number) => Math.abs(e.clientX - (r.left + (t / len) * r.width));
      const near = ([['start', dist(start)], ['end', dist(end)]] as const).filter(([, d]) => d <= reach).sort((a, b) => a[1] - b[1])[0];
      if (near) which = near[0];
    }
    if (!which || ro) return seek(timeAt(e.clientX));
    drag.current = which;
    barRef.current?.setPointerCapture(e.pointerId);
    setDraft({ start: h.start, end: h.end });
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (!drag.current || !draft) return;
    const t = r2(timeAt(e.clientX));
    const next = drag.current === 'start' ? { ...draft, start: Math.min(t, draft.end - 0.3) } : { ...draft, end: Math.max(t, draft.start + 0.3) };
    setDraft(next);
    seek(drag.current === 'start' ? next.start : next.end);
  };
  const onBarUp = () => {
    if (drag.current && draft) edit((x) => ({ ...x, start: draft.start, end: draft.end }));
    drag.current = null;
    setDraft(null);
  };
  const pct = (t: number) => `${len ? (t / len) * 100 : 0}%`;

  // A tap on the picture places the spotlight.
  const onPicture = (e: React.MouseEvent) => {
    if (zp.wasDrag()) return;
    if (!marking && (!placing || !h.freeze)) return toggle();
    const v = videoRef.current!;
    // The video's box on screen, zoom included (the picture sits in it with black bars around).
    const r = v.getBoundingClientRect();
    // Where the picture really is inside the box (black bars around it).
    const s = Math.min(r.width / (v.videoWidth || 16), r.height / (v.videoHeight || 9));
    const pw = (v.videoWidth || 16) * s;
    const ph = (v.videoHeight || 9) * s;
    const x = (e.clientX - r.left - (r.width - pw) / 2) / pw;
    const y = (e.clientY - r.top - (r.height - ph) / 2) / ph;
    if (marking) {
      const at = videoRef.current?.currentTime ?? start;
      const mark: HighlightMark = {
        id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        x: r2(Math.min(1, Math.max(0, x))),
        y: r2(Math.min(1, Math.max(0, y))),
        style: markStyle,
        label: markStyle === 'tag' && h.kids[0] ? kidLabel(h.kids[0], roster, settings.names === 'none' ? 'number' : settings.names) : undefined,
        from: r2(at),
        to: r2(markSecs ? Math.min(end, at + markSecs) : end),
      };
      edit((x0) => ({ ...x0, marks: [...(x0.marks || []), mark] }));
      setMarking(false);
      return;
    }
    edit((x0) => ({ ...x0, freeze: { ...x0.freeze!, spot: { style: x0.freeze?.spot?.style || 'ring', label: x0.freeze?.spot?.label, x: r2(Math.min(1, Math.max(0, x))), y: r2(Math.min(1, Math.max(0, y))) } } }));
    setPlacing(false);
  };

  // ---- Follow a kid by finger ----
  /** A pointer's spot on the picture (0..1), zoom and black bars included. */
  const pictureSpot = (clientX: number, clientY: number) => {
    const vv = videoRef.current!;
    const r = vv.getBoundingClientRect();
    const s = Math.min(r.width / (vv.videoWidth || 16), r.height / (vv.videoHeight || 9));
    const pw = (vv.videoWidth || 16) * s;
    const ph = (vv.videoHeight || 9) * s;
    const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
    return { x: clamp01((clientX - r.left - (r.width - pw) / 2) / pw), y: clamp01((clientY - r.top - (r.height - ph) / 2) / ph) };
  };
  /** Save the stretch just followed into the path (it replaces what was there for those moments). */
  const commitStretch = () => {
    const s = thin(stretchRef.current);
    stretchRef.current = [];
    if (s.length < 2) return;
    edit((x) => ({ ...x, follow: { ...(x.follow || {}), pts: packFollow(recordInto(unpackFollow(x.follow?.pts), s)) } }));
  };
  const startFollow = () => {
    const vv = videoRef.current;
    if (!vv) return;
    vv.pause();
    setMarking(false);
    setPlacing(false);
    setWatchFollow(false);
    setShowZoom(false);
    zp.reset();
    if (vv.currentTime < start || vv.currentTime >= end - 0.1) vv.currentTime = start;
    followRef.current = { speed: followSpeed };
    setFollowing(true);
  };
  const stopFollow = () => {
    const vv = videoRef.current;
    vv?.pause();
    commitStretch();
    followRef.current = null;
    fingerRef.current = null;
    setFollowing(false);
    if (vv) vv.playbackRate = 1;
    restoreView();
  };
  useEffect(() => {
    if (followRef.current) followRef.current.speed = followSpeed;
  }, [followSpeed]);
  const followHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const vv = videoRef.current;
      if (!vv) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const spot = pictureSpot(e.clientX, e.clientY);
      fingerRef.current = spot;
      setFingerDown(true);
      if (vv.currentTime >= end - 0.05) vv.currentTime = start;
      stretchRef.current = [{ t: vv.currentTime, ...spot }];
      vv.playbackRate = followSpeed;
      void vv.play().catch(() => undefined);
    },
    onPointerMove: (e: React.PointerEvent) => {
      e.stopPropagation();
      if (fingerRef.current) fingerRef.current = pictureSpot(e.clientX, e.clientY);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.stopPropagation();
      setFingerDown(false);
      if (!fingerRef.current) return;
      fingerRef.current = null;
      videoRef.current?.pause();
    },
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };
  // Lifting the finger (or the clip reaching its end) pauses it: keep that stretch.
  const onVideoPause = () => {
    setPlaying(false);
    if (followRef.current) {
      fingerRef.current = null;
      commitStretch();
    }
  };
  // "Watch it zoom": the editor's picture zooms in and rides the path, the way the Instagram video will.
  useEffect(() => {
    if (!watchFollow || following || path.length < 2) return;
    // Like the video: zoomed in while he's followed, easing back to the whole picture where he isn't.
    const cam = followCam(path, now);
    if (cam) zp.lookAt(1 + 1.5 * cam.amount, (cam.x - 0.5) * cam.amount, (cam.y - 0.5) * cam.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchFollow, following, path, now]);
  useEffect(() => {
    if (!watchFollow) restoreView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchFollow]);

  // ---- The zoom kept for Play, the Instagram video and the Resolve export ----
  /** The film's place in the editor's picture box (it's fitted in, bars around it). */
  const fitInBox = () => {
    const box = zp.boxRef.current;
    const vv = videoRef.current;
    const W = box?.clientWidth || 16;
    const H = box?.clientHeight || 9;
    return { W, H, fit: zoomRect(vv?.videoWidth || 16, vv?.videoHeight || 9, W, H, null).fit };
  };
  /** What's on screen now, as a kept zoom (the middle of the view as a spot of the film). */
  const viewAsZoom = () => {
    const { W, H, fit } = fitInBox();
    const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
    const c = fitCam({ mag: zp.zoom, x: clamp01(((0.5 - zp.pan.x) * W - fit.x) / fit.w), y: clamp01(((0.5 - zp.pan.y) * H - fit.y) / fit.h) });
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    return { level: r2(c.mag), x: r3(c.x), y: r3(c.y) };
  };
  /** Put the editor's picture on a kept spot. */
  const showSpot = (level: number, x: number, y: number) => {
    const { W, H, fit } = fitInBox();
    zp.lookAt(level, (fit.x + x * fit.w) / W - 0.5, (fit.y + y * fit.h) / H - 0.5);
  };
  /** The picture as the clip's zoom has it (held on its spot), else the whole picture. */
  const restoreView = () => {
    const z = h.zoom;
    if (z && !z.follow && z.level > 1) showSpot(z.level, z.x, z.y);
    else zp.reset();
  };
  // Zooming the picture by hand is the clip's zoom: kept once it settles (back to 1× = the whole picture again).
  // Not while following him, watching the Instagram follow, showing his path's zoom, or when it rides his path.
  useEffect(() => {
    if (!zp.touched || ro || following || watchFollow || showZoom || h.zoom?.follow) return;
    const t = window.setTimeout(() => {
      const z = viewAsZoom();
      if (z.level <= 1.05) {
        if (h.zoom) edit((x) => ({ ...x, zoom: undefined }));
        return;
      }
      const was = h.zoom;
      if (was && Math.abs(was.level - z.level) < 0.01 && Math.abs(was.x - z.x) < 0.002 && Math.abs(was.y - z.y) < 0.002) return;
      edit((x) => ({ ...x, zoom: { ...z, follow: false } }));
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zp.touched]);
  // After an undo / redo, the picture shows the zoom it brought back.
  useEffect(() => {
    if (!syncView.current) return;
    syncView.current = false;
    if (!showZoom && !watchFollow && !following) restoreView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h]);
  // "Watch it": the editor's picture rides his path with the zoom, the way Play and the Instagram video will.
  useEffect(() => {
    if (!showZoom || following || watchFollow) return;
    const cam = clipCamera(h, now);
    if (!cam) return zp.lookAt(1, 0, 0);
    showSpot(cam.mag, cam.x, cam.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showZoom, following, watchFollow, h.zoom, h.follow, now]);
  // Opening a clip (and after watching): the picture as its zoom has it, so what you see is what's kept.
  useEffect(() => {
    if (!showZoom && !watchFollow) restoreView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showZoom]);
  const followsHim = Boolean(h.zoom?.follow) && path.length > 1;
  const zoomLine = !h.zoom
    ? 'Whole picture.'
    : followsHim
      ? `Follows him at ${h.zoom.level}× (the whole field where he isn't followed).`
      : h.zoom.follow
        ? `${h.zoom.level}× on the middle: follow a kid above and it rides his path.`
        : `${h.zoom.level}× on what the picture shows, kept.`;

  // Another camera's view of this play, lined up with this one.
  const [film, setFilm] = useState<GameFilm | null>(null);
  useEffect(() => {
    let off = false;
    access.openGame(h.game).then((f) => !off && setFilm(f)).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [access, h.game]);
  const otherViews = (film?.views || []).filter((v) => v && v !== h.view);
  const multiCam = h.kind === 'play' && Boolean(h.playId) && otherViews.length > 0;
  // A new highlight: start without the side camera.
  useEffect(() => setSide(null), [h.id]);
  const gamePlays = useMemo(() => plays.filter((p) => p.gameId === h.game.gameId), [plays, h.game.gameId]);
  /** This play's clip on another camera and how its clock sits against this clip's. */
  const lineUpView = async (view: string): Promise<{ clip: string; offset: number; guessed: boolean } | null> => {
    if (!film || !h.playId) return null;
    const c = lineUp(film, view, gamePlays, shared).clipOf.get(h.playId);
    if (!c) {
      setBusy(`No ${view} clip for this play.`);
      return null;
    }
    // A replay already set from that camera, else the way a coach nudged it in the Film Room, else the snap in both
    // clips, else the clip starts.
    if (h.replay && h.replay.view === view && h.replay.clip === c.name) return { clip: c.name, offset: r2(h.replay.start - h.start), guessed: false };
    let off = savedOffset(shared?.viewShift, h.playId, h.view, view);
    if (off === undefined && src.url) {
      setBusy('Lining up the cameras…');
      const other = await access.url(h.game, view, c.name);
      try {
        const a = snapTimeCache.get(src.url) ?? (await probeSnap(src.url));
        const b = snapTimeCache.get(other.url) ?? (await probeSnap(other.url));
        off = snapOffset(a, b);
      } finally {
        other.release();
      }
    }
    setBusy(off === undefined ? `${view} lined up from the clip starts (nudge it if it's off).` : '');
    return { clip: c.name, offset: off ?? 0, guessed: off === undefined };
  };
  const showSide = async (view: string) => {
    const l = await lineUpView(view);
    if (l) setSide({ view, ...l });
  };
  // The side camera becomes this highlight's camera (trim, slow motion and freeze move with it; the old one can be the replay).
  const useSideCamera = () => {
    if (!side) return;
    const o = side.offset;
    const old = { view: h.view, clip: h.clip };
    const shift = (t: number) => r2(Math.max(0, t + o));
    edit((x) => ({
      ...x,
      view: side.view,
      clip: side.clip,
      clipLen: undefined,
      start: shift(x.start),
      end: shift(x.end),
      slow: x.slow ? { ...x.slow, from: shift(x.slow.from), to: shift(x.slow.to) } : undefined,
      freeze: x.freeze ? { ...x.freeze, at: shift(x.freeze.at) } : undefined,
      marks: x.marks?.map((m) => ({ ...m, from: shift(m.from), to: shift(m.to) })),
      replay: x.replay && x.replay.view === side.view ? { ...x.replay, view: old.view, clip: old.clip, start: r2(Math.max(0, x.start)), end: r2(x.end) } : x.replay,
    }));
    setSide({ view: old.view, clip: old.clip, offset: r2(-o), guessed: side.guessed });
    if (h.marks?.length) setBusy(`Your circles / arrows were placed on ${old.view || 'the other camera'}: check where they sit on ${side.view}.`);
  };
  const replayFor = async (view: string) => {
    const l = await lineUpView(view);
    if (!l) return;
    const c = { name: l.clip };
    const o = l.offset;
    edit((x) => ({ ...x, replay: { view, clip: c.name, start: r2(Math.max(0, x.start + o)), end: r2(x.end + o), speed: settings.replaySpeed } }));
  };

  // Thumb-sized on a phone, compact on a computer.
  const chip = (on: boolean) =>
    `px-2 h-9 sm:h-7 rounded-lg text-[11px] font-bold border ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`;
  const small = 'h-9 sm:h-7 px-2 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40';
  // The play this highlight is (its breakdown makes a title).
  const thePlay = h.playId ? plays.find((p) => p.id === h.playId) : undefined;
  const v = videoRef.current;

  return (
    <div className="flex flex-col gap-2 min-w-0" role="region" aria-label={`Highlight: ${h.title}`}>
      <div className="flex items-start sm:items-center gap-2 min-w-0">
        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <h3 className="font-black text-slate-900 dark:text-slate-100 truncate">{h.title || 'Highlight'}</h3>
          <span className="text-xs text-slate-500 truncate">
            {h.game.name} · {h.kind === 'extra' ? h.where || 'extra' : `play #${h.playNumber}`} · {h.view || 'film'} · {h.clip}
          </span>
        </div>
        <button type="button" onClick={onClose} className="h-9 w-9 sm:h-8 sm:w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {multiCam && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Cameras">
          <span className="font-black text-slate-700 dark:text-slate-200">Cameras</span>
          <span className={chip(true)} title="This highlight's camera">{h.view || 'Film'}</span>
          {otherViews.map((view) => (
            <button
              key={view}
              type="button"
              className={chip(side?.view === view)}
              aria-pressed={side?.view === view}
              onClick={() => (side?.view === view ? setSide(null) : void showSide(view))}
              title={side?.view === view ? 'Hide this camera' : `Show ${view} next to ${h.view || 'this camera'}, in step with it`}
            >
              <Columns2 size={12} className="inline -mt-0.5" /> {view}
            </button>
          ))}
          {side && !ro && (
            <button type="button" className={small} onClick={useSideCamera} title={`Use ${side.view} for this highlight (the trim, slow motion and freeze move with it)`}>
              Use {side.view} for the highlight
            </button>
          )}
          {side && (
            <span className="flex items-center gap-1 text-slate-500">
              {side.guessed ? 'Lined up from the clip starts:' : 'In step'}
              {[-1 / 30, 1 / 30].map((d) => (
                <button key={d} type="button" className={small} onClick={() => setSide((s) => (s ? { ...s, offset: r2(s.offset + d), guessed: false } : s))} title={`Nudge ${side.view} a frame`}>
                  {d > 0 ? '+1f' : '−1f'}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      <div className={side ? 'grid sm:grid-cols-2 gap-2' : ''}>
        <div
          ref={zp.boxRef}
          {...zp.handlers}
          className={`relative bg-black rounded-xl overflow-hidden ${zp.zoom > 1 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'}`}
          style={{ aspectRatio: '16 / 9' }}
          onClick={onPicture}
          onDoubleClick={zp.userReset}
          title="Click: play / pause · Scroll or pinch: zoom · Drag: move around · Double-click: zoom out"
          data-film-area
        >
          <div className="absolute inset-0" style={zp.style}>
            {src.url ? (
              <video ref={videoRef} src={src.url} playsInline muted={settings.gameSound === 'off'} onLoadedMetadata={onLoaded} onPlay={() => setPlaying(true)} onPause={onVideoPause} className="absolute inset-0 w-full h-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm" style={{ color: '#cbd5e1' }}>
                {src.loading ? 'Loading the clip…' : src.error || 'No clip'}
              </div>
            )}
            <canvas ref={overRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>
          {following && (
            <>
              <div className="absolute inset-0 z-10 cursor-crosshair" style={{ touchAction: 'none' }} {...followHandlers} aria-label="Keep your finger on the kid" />
              <div className="absolute top-2 left-2 right-2 z-20 pointer-events-none flex">
                <span className="rounded-md px-2 py-1 text-xs font-bold" style={{ background: '#f97316', color: '#111827' }}>
                  {playing && fingerDown
                    ? 'Keep your finger on him… let go to pause'
                    : playing
                      ? 'Not following: press on him when he shows up'
                      : 'Press and hold on the kid; it plays while you follow him'}
                </span>
              </div>
            </>
          )}
          {(placing || marking) && (
            <div className="absolute top-2 left-2 rounded-md px-2 py-1 text-xs font-bold" style={{ background: '#f59e0b', color: '#111827' }}>
              {marking ? `Tap the kid to ${markStyle === 'arrow' ? 'point at' : 'circle'} (zoom in first if he's small)` : 'Tap the kid to spotlight'}
            </div>
          )}
          {side && (
            <div className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-black pointer-events-none" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>
              {h.view || 'Film'}
            </div>
          )}
          <ZoomButtons zp={zp} />
        </div>
        {side && (
          <div
            ref={zp2.boxRef}
            {...zp2.handlers}
            className={`relative bg-black rounded-xl overflow-hidden ${zp2.zoom > 1 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'}`}
            style={{ aspectRatio: '16 / 9' }}
            onClick={() => !zp2.wasDrag() && toggle()}
            onDoubleClick={zp2.reset}
            title="Click: play / pause · Scroll or pinch: zoom · Drag: move around · Double-click: zoom out"
          >
            <div className="absolute inset-0" style={zp2.style}>
              {sideSrc.url ? (
                <video ref={sideRef} src={sideSrc.url} playsInline muted className="absolute inset-0 w-full h-full object-contain" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm" style={{ color: '#cbd5e1' }}>
                  {sideSrc.loading ? 'Loading the clip…' : sideSrc.error || 'No clip'}
                </div>
              )}
            </div>
            <div className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-black pointer-events-none" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>
              {side.view}
            </div>
            <ZoomButtons zp={zp2} />
          </div>
        )}
      </div>

      {/* The trim bar */}
      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={toggle} className={small} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={13} /> : <PlayIcon size={13} />}
        </button>
        <button type="button" onClick={() => seek(start)} className={small} aria-label="Back to the start" title="Back to the start">
          <SkipBack size={13} />
        </button>
        <button type="button" onClick={() => setLoop((x) => !x)} className={chip(loop)} aria-pressed={loop} title="Loop the trimmed part">
          <Repeat size={12} />
        </button>
        <div
          ref={barRef}
          className="relative flex-1 h-10 sm:h-9 rounded-lg bg-slate-200 dark:bg-slate-800 cursor-pointer touch-none select-none overflow-hidden"
          onPointerDown={(e) => onBarDown(e)}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          aria-label="Trim"
        >
          {/* Pictures along the clip, so you can see where the play is. */}
          {src.url && len > 0 && <Filmstrip url={src.url} len={len} />}
          {/* Outside the trim: dimmed; the trim: a light tint with its edges (set colors: the light theme turns
              see-through utility colors solid, which would hide the pictures). */}
          <div className="absolute top-0 bottom-0 left-0" style={{ width: pct(start), background: 'rgba(15,23,42,0.62)' }} />
          <div className="absolute top-0 bottom-0 right-0" style={{ left: pct(end), background: 'rgba(15,23,42,0.62)' }} />
          <div className="absolute top-0 bottom-0" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})`, background: 'rgba(99,102,241,0.12)', borderTop: '2px solid #6366f1', borderBottom: '2px solid #6366f1' }} />
          {h.slow && <div className="absolute bottom-0 h-2 bg-sky-400" style={{ left: pct(h.slow.from), width: `calc(${pct(h.slow.to)} - ${pct(h.slow.from)})` }} title="Slow motion" />}
          {h.freeze && <div className="absolute top-0 bottom-0 w-1 bg-amber-400" style={{ left: pct(h.freeze.at) }} title="Freeze" />}
          <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-rose-500" style={{ left: pct(now) }} />
          {!ro &&
            (['start', 'end'] as const).map((which) => (
              <div
                key={which}
                role="slider"
                aria-label={which === 'start' ? 'Start' : 'End'}
                aria-valuenow={which === 'start' ? start : end}
                aria-valuemin={0}
                aria-valuemax={len}
                tabIndex={0}
                onPointerDown={(e) => onBarDown(e, which)}
                className="absolute top-0 bottom-0 w-3 -ml-1.5 rounded bg-indigo-600 cursor-ew-resize"
                style={{ left: pct(which === 'start' ? start : end) }}
              />
            ))}
        </div>
        <span className="tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap hidden sm:inline">
          {fmt(now)} <span className="text-slate-400">/ {fmt(len)}</span>
        </span>
      </div>

      {/* A frame at a time, how fast to watch it, undo, and the finished clip. */}
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap sm:hidden mr-1">
          {fmt(now)} <span className="text-slate-400">/ {fmt(len)}</span>
        </span>
        <button type="button" className={small} onClick={() => step(-1 / 30)} aria-label="Back a frame" title="Back a frame (←)">
          <ChevronLeft size={14} className="inline -mt-0.5" />1f
        </button>
        <button type="button" className={small} onClick={() => step(1 / 30)} aria-label="Ahead a frame" title="Ahead a frame (→)">
          1f<ChevronRight size={14} className="inline -mt-0.5" />
        </button>
        <span className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden" role="group" aria-label="Watch speed">
          {[1, 0.5, 0.25].map((r) => (
            <button key={r} type="button" onClick={() => setRate(r)} aria-pressed={rate === r} className={`h-9 sm:h-7 px-2 font-bold ${rate === r ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`} title="How fast to watch it here (the highlight itself isn't changed)">
              {r === 1 ? '1×' : r === 0.5 ? '½×' : '¼×'}
            </button>
          ))}
        </span>
        {!ro && (
          <>
            <button type="button" className={small} onClick={undo} disabled={!undoStack.current.length} aria-label="Undo" title="Undo (Ctrl+Z)">
              <Undo2 size={13} className="inline -mt-0.5" /> <span className="hidden sm:inline">Undo</span>
            </button>
            <button type="button" className={small} onClick={redo} disabled={!redoStack.current.length} aria-label="Redo" title="Redo (Ctrl+Y)">
              <Redo2 size={13} className="inline -mt-0.5" /> <span className="hidden sm:inline">Redo</span>
            </button>
          </>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => {
              videoRef.current?.pause();
              setPreview(true);
            }}
            disabled={!src.url}
            className="h-9 sm:h-8 px-3 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-1 disabled:opacity-40"
            title="Play it finished: the title, slow motion, freeze, replay and zoom, the way a reel shows it"
          >
            <Clapperboard size={13} /> Preview
          </button>
          <button
            type="button"
            onClick={() => {
              videoRef.current?.pause();
              setSocial(true);
            }}
            className="h-9 sm:h-8 px-2.5 rounded-lg border border-pink-400 font-bold text-pink-700 dark:text-pink-300 inline-flex items-center gap-1"
            title="Make an MP4 of this highlight for Instagram"
          >
            <Instagram size={13} /> <span className="hidden sm:inline">Instagram video</span>
          </button>
        </span>
      </div>

      {/* The sections: a dot on the ones with something set. */}
      {!ro && (
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 border-b border-slate-200 dark:border-slate-800" role="tablist" aria-label="Edit">
          {(
            [
              ['trim', 'Trim', false],
              ['effects', 'Slow-mo & replay', Boolean(h.slow || h.freeze || h.replay)],
              ['camera', 'Zoom & follow', Boolean(h.zoom || path.length > 1)],
              ['circles', 'Circles', Boolean(h.marks?.length)],
              ['details', 'Title & kids', false],
            ] as [EditorTab, string, boolean][]
          ).map(([id, label, on]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`shrink-0 h-10 sm:h-9 px-3 text-xs font-bold border-b-2 -mb-px inline-flex items-center gap-1.5 ${
                tab === id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {label}
              {on && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-label="(set)" />}
            </button>
          ))}
        </div>
      )}

      {!ro && tab === 'trim' && (
        <div className="flex flex-col gap-2 text-xs">
          {(['start', 'end'] as const).map((which) => {
            const t = which === 'start' ? start : end;
            const set = which === 'start' ? setStart : setEnd;
            return (
              <div key={which} className="flex flex-wrap items-center gap-1">
                <span className="w-12 font-black text-slate-700 dark:text-slate-200">{which === 'start' ? 'Start' : 'End'}</span>
                <button type="button" className="tabular-nums font-bold text-indigo-700 dark:text-indigo-300 underline decoration-dotted w-14 text-left" onClick={() => { videoRef.current?.pause(); seek(t); }} title="Go there">
                  {fmt(t)}
                </button>
                {[-0.5, -1 / 30, 1 / 30, 0.5].map((d) => (
                  <button key={d} type="button" className={small} onClick={() => set(t + d)} title={`${d > 0 ? 'Later' : 'Earlier'} by ${Math.abs(d) < 0.1 ? 'a frame' : 'half a second'}`}>
                    {Math.abs(d) < 0.1 ? `${d > 0 ? '+' : '−'}1f` : `${d > 0 ? '+' : '−'}½s`}
                  </button>
                ))}
                <button type="button" className={small} onClick={() => v && set(v.currentTime)} title={`${which === 'start' ? 'Start' : 'End'} at the playhead (${which === 'start' ? 'I' : 'O'})`}>
                  {which === 'start' ? 'Start here' : 'End here'} <kbd className="opacity-60 hidden sm:inline">{which === 'start' ? 'I' : 'O'}</kbd>
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={small} onClick={findSnap} disabled={!src.url} title={`${settings.preRoll} s before the snap to ${settings.postRoll} s after`}>
              <Scissors size={12} className="inline -mt-0.5" /> Start at snap
            </button>
            <button type="button" className={small} onClick={checkEnd} disabled={!src.url} title="Play the last 2 seconds">
              Check the end
            </button>
            <button type="button" className={small} onClick={() => edit((x) => ({ ...x, start: 0, end: r2(len || x.end) }))} disabled={!len}>
              Whole clip
            </button>
            <span className="tabular-nums text-slate-500">{(end - start).toFixed(1)} s long</span>
            {busy && <span className="text-amber-600 dark:text-amber-400 font-semibold">{busy}</span>}
          </div>
          <p className="text-[11px] text-slate-500">Drag the blue handles on the bar (a touch near one grabs it), or nudge them here. A tap on the bar moves the playhead.</p>
        </div>
      )}

      {!ro && tab === 'effects' && (
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          {/* Slow motion */}
          <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1.5 min-w-0">
            <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Slow motion</legend>
            {h.slow ? (
              <>
                <span className="flex flex-wrap gap-1">
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, slow: { ...x.slow!, from: r2(v.currentTime) } }))}>From here</button>
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, slow: { ...x.slow!, to: r2(v.currentTime) } }))}>To here</button>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {[0.5, 0.25].map((sp) => (
                    <button key={sp} type="button" className={chip(h.slow!.speed === sp)} onClick={() => edit((x) => ({ ...x, slow: { ...x.slow!, speed: sp } }))}>
                      {sp === 0.5 ? '½' : '¼'}
                    </button>
                  ))}
                  <span className="tabular-nums text-slate-500">{fmt(h.slow.from)}–{fmt(h.slow.to)}</span>
                  <button type="button" className="ml-auto text-rose-600 dark:text-rose-400 font-bold" onClick={() => edit((x) => ({ ...x, slow: undefined }))}>Off</button>
                </span>
              </>
            ) : (
              <button
                type="button"
                className={small}
                onClick={() => {
                  const at = v ? v.currentTime : start;
                  const from = Math.max(start, Math.min(at, end - 1));
                  edit((x) => ({ ...x, slow: { from: r2(from), to: r2(Math.min(end, from + 2)), speed: settings.slowSpeed } }));
                }}
              >
                Slow 2 s from the playhead
              </button>
            )}
          </fieldset>

          {/* Freeze + spotlight */}
          <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1.5 min-w-0">
            <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Freeze & spotlight</legend>
            {h.freeze ? (
              <>
                <span className="flex flex-wrap items-center gap-1">
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, freeze: { ...x.freeze!, at: r2(Math.min(end, Math.max(start, v.currentTime))) } }))}>
                    Freeze here
                  </button>
                  <select value={h.freeze.seconds} onChange={(e) => edit((x) => ({ ...x, freeze: { ...x.freeze!, seconds: Number(e.target.value) } }))} className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1" aria-label="Freeze length">
                    {[1, 1.5, 2, 3, 4].map((s) => (
                      <option key={s} value={s}>{s} s</option>
                    ))}
                  </select>
                  <button type="button" className="ml-auto text-rose-600 dark:text-rose-400 font-bold" onClick={() => edit((x) => ({ ...x, freeze: undefined }))}>Off</button>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <button type="button" className={chip(placing)} onClick={() => { seek(h.freeze!.at); videoRef.current?.pause(); setPlacing((p) => !p); }}>
                    <Crosshair size={12} className="inline -mt-0.5" /> {h.freeze.spot ? 'Move spotlight' : 'Spotlight a kid'}
                  </button>
                  {h.freeze.spot && (
                    <>
                      <select
                        value={h.freeze.spot.style}
                        onChange={(e) => edit((x) => ({ ...x, freeze: { ...x.freeze!, spot: { ...x.freeze!.spot!, style: e.target.value as SpotStyle } } }))}
                        className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                        aria-label="Spotlight style"
                      >
                        <option value="ring">Ring</option>
                        <option value="arrow">Arrow</option>
                        <option value="glow">Glow</option>
                        <option value="tag">Name tag</option>
                      </select>
                      <button type="button" className="text-rose-600 dark:text-rose-400 font-bold" onClick={() => edit((x) => ({ ...x, freeze: { ...x.freeze!, spot: undefined } }))}>No spotlight</button>
                    </>
                  )}
                </span>
                {h.freeze.spot?.style === 'tag' && (
                  <input
                    defaultValue={h.freeze.spot.label || (h.kids[0] ? kidLabel(h.kids[0], roster, settings.names === 'none' ? 'number' : settings.names) : '')}
                    onBlur={(e) => edit((x) => ({ ...x, freeze: { ...x.freeze!, spot: { ...x.freeze!.spot!, label: e.target.value } } }))}
                    placeholder="Name tag"
                    className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                    aria-label="Name tag"
                  />
                )}
              </>
            ) : (
              <button type="button" className={small} onClick={() => edit((x) => ({ ...x, freeze: { at: r2(Math.min(end, Math.max(start, v ? v.currentTime : start))), seconds: 2 } }))}>
                Freeze at the playhead
              </button>
            )}
          </fieldset>

          {/* Replay from another camera */}
          <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1.5 min-w-0">
            <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Replay</legend>
            {h.replay ? (
              <>
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  {h.replay.view || 'Same camera'} · {h.replay.clip} · {fmt(h.replay.start)}–{fmt(h.replay.end)}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {[-0.5, -1 / 30, 1 / 30, 0.5].map((d) => (
                    <button key={d} type="button" className={small} onClick={() => edit((x) => ({ ...x, replay: { ...x.replay!, start: r2(Math.max(0, x.replay!.start + d)), end: r2(x.replay!.end + d) } }))}>
                      {Math.abs(d) < 0.1 ? `${d > 0 ? '+' : '−'}1f` : `${d > 0 ? '+' : '−'}½s`}
                    </button>
                  ))}
                  {[1, 0.5, 0.25].map((sp) => (
                    <button key={sp} type="button" className={chip(h.replay!.speed === sp)} onClick={() => edit((x) => ({ ...x, replay: { ...x.replay!, speed: sp } }))}>
                      {sp === 1 ? '1×' : sp === 0.5 ? '½' : '¼'}
                    </button>
                  ))}
                  <button type="button" className="ml-auto text-rose-600 dark:text-rose-400 font-bold" onClick={() => edit((x) => ({ ...x, replay: undefined }))}>Off</button>
                </span>
              </>
            ) : (
              <span className="flex flex-wrap gap-1">
                {h.kind === 'play' &&
                  otherViews.map((view) => (
                    <button key={view} type="button" className={small} onClick={() => void replayFor(view)}>
                      {view} replay
                    </button>
                  ))}
                <button type="button" className={small} onClick={() => edit((x) => ({ ...x, replay: { view: x.view, clip: x.clip, start: x.start, end: x.end, speed: settings.replaySpeed } }))}>
                  Same camera, slowed
                </button>
              </span>
            )}
          </fieldset>
        </div>
      )}

      {/* Follow a kid by finger: the Instagram video's camera rides his path */}
      {!ro && tab === 'camera' && (
        <fieldset className="rounded-lg border border-orange-200 dark:border-orange-500/30 p-2 flex flex-col gap-1.5 min-w-0 text-xs">
          <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Follow a kid (the Instagram video zooms in and follows him)</legend>
          {following ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-600 dark:text-slate-300">
                Press and hold on him on the picture; it plays while your finger is down. Let go to pause, press again to carry on. Not in the picture yet (or gone)?
                Play ahead without following; the video shows the whole field there and zooms in when you pick him up.
              </span>
              <button
                type="button"
                className={small}
                onClick={() => {
                  const vv = videoRef.current;
                  if (!vv) return;
                  if (!vv.paused) return vv.pause();
                  if (vv.currentTime >= end - 0.05) vv.currentTime = start;
                  vv.playbackRate = followSpeed;
                  void vv.play().catch(() => undefined);
                }}
                title="Play (slowly) without following him, to where he shows up"
              >
                {playing ? <Pause size={12} className="inline -mt-0.5" /> : <PlayIcon size={12} className="inline -mt-0.5" />} {playing ? 'Pause' : 'Play, not following'}
              </button>
              <select value={followSpeed} onChange={(e) => setFollowSpeed(Number(e.target.value))} className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1" aria-label="Speed while following">
                <option value={0.25}>¼ speed</option>
                <option value={0.5}>½ speed</option>
                <option value={1}>Full speed</option>
              </select>
              <button type="button" className="h-7 px-3 rounded-lg bg-orange-600 text-white font-bold" onClick={stopFollow}>
                Done
              </button>
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={small} onClick={startFollow} disabled={!src.url} title="From the playhead (or the start): play slowly while you keep your finger on him">
                <Crosshair size={12} className="inline -mt-0.5" /> {path.length > 1 ? 'Follow again from the playhead' : 'Follow a kid'}
              </button>
              {path.length > 1 && (
                <>
                  <span className="text-slate-500">
                    Followed {stretches(path).filter((s) => s.length > 1).map((s) => `${fmt(s[0].t)}–${fmt(s[s.length - 1].t)}`).join(', ')}
                    {path[0].t > start + 0.3 || path[path.length - 1].t < end - 0.3 ? ' · the whole field shows where he isn\'t followed' : ''}
                  </span>
                  <button
                    type="button"
                    className={chip(watchFollow)}
                    aria-pressed={watchFollow}
                    onClick={() => {
                      setShowZoom(false);
                      setWatchFollow((x) => !x);
                    }}
                    title="Zoom the picture along his path, like the video will"
                  >
                    Watch it zoom
                  </button>
                  <button type="button" className="text-rose-600 dark:text-rose-400 font-bold px-1" onClick={() => { setWatchFollow(false); edit((x) => ({ ...x, follow: undefined })); }}>
                    Remove
                  </button>
                </>
              )}
            </span>
          )}
        </fieldset>
      )}

      {/* The clip's zoom, kept for Play, the Instagram video and the Resolve export */}
      {!ro && tab === 'camera' && (
        <fieldset className="rounded-lg border border-sky-200 dark:border-sky-500/30 p-2 flex flex-col gap-1.5 min-w-0 text-xs">
          <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Zoom (kept for Play, the Instagram video and the Resolve export)</legend>
          <span className="flex flex-wrap items-center gap-1.5">
            <ZoomIn size={13} className="text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="text-slate-600 dark:text-slate-300 font-semibold">{zoomLine}</span>
            {path.length > 1 && (
              <button
                type="button"
                className={chip(followsHim)}
                aria-pressed={followsHim}
                onClick={() => {
                  const z = h.zoom;
                  if (z?.follow) {
                    // Back to holding on a spot: the middle of what was last held, at the same closeness.
                    edit((x) => ({ ...x, zoom: { ...x.zoom!, follow: false } }));
                    setShowZoom(false);
                    showSpot(z.level, z.x, z.y);
                  } else {
                    edit((x) => ({ ...x, zoom: { level: x.zoom?.level && x.zoom.level > 1 ? x.zoom.level : 2, x: x.zoom?.x ?? 0.5, y: x.zoom?.y ?? 0.5, follow: true } }));
                    setWatchFollow(false);
                    setShowZoom(true);
                  }
                }}
                title="Zoom in on him and ride the path you followed (the whole field where he isn't followed)"
              >
                <Crosshair size={12} className="inline -mt-0.5" /> Follow his path
              </button>
            )}
            {h.zoom && (
              <>
                <span className="inline-flex items-center gap-0.5" role="group" aria-label="How close">
                  {CLIP_ZOOM_LEVELS.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      className={chip(Math.abs((h.zoom?.level || 0) - lv) < 0.01)}
                      onClick={() => {
                        const z = h.zoom!;
                        edit((x) => (x.zoom ? { ...x, zoom: { ...x.zoom, level: lv } } : x));
                        if (!z.follow) showSpot(lv, z.x, z.y);
                      }}
                    >
                      {lv}×
                    </button>
                  ))}
                </span>
                {h.zoom.follow && (
                  <button
                    type="button"
                    className={chip(showZoom)}
                    aria-pressed={showZoom}
                    onClick={() => {
                      setWatchFollow(false);
                      setShowZoom((x) => !x);
                    }}
                    title="Play it here riding his path, the way Play and the Instagram video will"
                  >
                    Watch it
                  </button>
                )}
                <button
                  type="button"
                  className="text-rose-600 dark:text-rose-400 font-bold px-1"
                  onClick={() => {
                    setShowZoom(false);
                    edit((x) => ({ ...x, zoom: undefined }));
                    zp.reset();
                  }}
                >
                  Whole picture
                </button>
              </>
            )}
          </span>
          <span className="text-slate-500">
            {!h.zoom
              ? 'Pinch (or scroll, or the + button) and drag the picture to what you want to see: that zoom is kept with the clip. Tap the 1.0× in its corner (or double-click it) for the whole field again.'
              : h.zoom.follow
                ? 'Pinching now only looks closer; pick Follow his path again to hold on one spot.'
                : 'Pinch or drag the picture to change it; it\'s kept when you stop.'}
            {!h.zoom && (path.length > 1 ? ' Or pick Follow his path to ride the kid you followed.' : ' Or follow a kid above, then pick Follow his path.')}
          </span>
        </fieldset>
      )}

      {/* Circles and arrows on a kid while the play runs */}
      {!ro && tab === 'circles' && (
        <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1.5 min-w-0 text-xs">
          <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Circle or point at a player</legend>
          <span className="flex flex-wrap items-center gap-1">
            {(['ring', 'arrow', 'glow', 'tag'] as SpotStyle[]).map((st) => (
              <button key={st} type="button" className={chip(markStyle === st)} aria-pressed={markStyle === st} onClick={() => setMarkStyle(st)}>
                {st === 'ring' ? 'Circle' : st === 'arrow' ? 'Arrow' : st === 'glow' ? 'Glow' : 'Name tag'}
              </button>
            ))}
            <select value={markSecs} onChange={(e) => setMarkSecs(Number(e.target.value))} className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1" aria-label="How long it stays up">
              {[1, 2, 3, 5].map((s) => (
                <option key={s} value={s}>for {s} s</option>
              ))}
              <option value={0}>to the end</option>
            </select>
            <button
              type="button"
              className={chip(marking)}
              aria-pressed={marking}
              onClick={() => {
                videoRef.current?.pause();
                setPlacing(false);
                setMarking((m) => !m);
              }}
              title="Pause where it should show up, then tap the kid on the picture"
            >
              <Crosshair size={12} className="inline -mt-0.5" /> {marking ? 'Tap the kid… (cancel)' : 'Mark at the playhead'}
            </button>
          </span>
          {(h.marks || []).length > 0 && (
            <ul className="flex flex-col gap-1">
              {(h.marks || []).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-1">
                  <button type="button" className={small} onClick={() => { videoRef.current?.pause(); seek(m.from); }} title="Go to it">
                    {fmt(m.from)}–{fmt(m.to)}
                  </button>
                  <select
                    value={m.style}
                    onChange={(e) => edit((x) => ({ ...x, marks: (x.marks || []).map((k) => (k.id === m.id ? { ...k, style: e.target.value as SpotStyle } : k)) }))}
                    className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                    aria-label="Mark style"
                  >
                    <option value="ring">Circle</option>
                    <option value="arrow">Arrow</option>
                    <option value="glow">Glow</option>
                    <option value="tag">Name tag</option>
                  </select>
                  {m.style === 'tag' && (
                    <input
                      defaultValue={m.label || ''}
                      placeholder="Name"
                      onBlur={(e) => edit((x) => ({ ...x, marks: (x.marks || []).map((k) => (k.id === m.id ? { ...k, label: e.target.value } : k)) }))}
                      className="h-7 w-24 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                      aria-label="Name tag"
                    />
                  )}
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, marks: (x.marks || []).map((k) => (k.id === m.id ? { ...k, from: r2(Math.min(v.currentTime, k.to - 0.2)) } : k)) }))} title="Show it from the playhead">
                    From here
                  </button>
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, marks: (x.marks || []).map((k) => (k.id === m.id ? { ...k, to: r2(Math.max(v.currentTime, k.from + 0.2)) } : k)) }))} title="Hide it at the playhead">
                    To here
                  </button>
                  <button type="button" className="text-rose-600 dark:text-rose-400 font-bold px-1" onClick={() => edit((x) => ({ ...x, marks: (x.marks || []).filter((k) => k.id !== m.id) }))} aria-label="Remove this mark">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      {/* Title, kids, kinds, rating, note */}
      {(ro || tab === 'details') && (
      <div className="flex flex-col gap-2">
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-2">
            <label htmlFor={`hl-title-${h.id}`} className="font-black text-slate-700 dark:text-slate-200">Title</label>
            {!ro && thePlay && (
              <button
                type="button"
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 underline"
                onClick={() => edit((x) => ({ ...x, title: autoTitle(thePlay) }))}
                title="The title made from the play's breakdown"
              >
                From the play
              </button>
            )}
          </span>
          <input
            id={`hl-title-${h.id}`}
            key={`t-${h.id}-${h.title}`}
            defaultValue={h.title}
            disabled={ro}
            onBlur={(e) => e.target.value !== h.title && edit((x) => ({ ...x, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-10 sm:h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-black text-slate-700 dark:text-slate-200">Kids in it</span>
          {roster.length > 0 ? (
            // Tap a kid to take him off; pick from the roster to add one.
            <span className="flex flex-wrap items-center gap-1" role="group" aria-label="Kids in it">
              {h.kids.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={ro}
                  onClick={() => edit((x) => ({ ...x, kids: x.kids.filter((y) => y !== k) }))}
                  className="h-9 sm:h-7 px-2 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-1"
                  title={ro ? undefined : 'Take him off this clip'}
                >
                  {kidLabel(k, roster, 'full')} {!ro && <X size={12} />}
                </button>
              ))}
              {!ro && (
                <select
                  value=""
                  onChange={(e) => e.target.value && edit((x) => ({ ...x, kids: [...new Set([...x.kids, e.target.value])] }))}
                  className="h-9 sm:h-7 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 font-bold"
                  aria-label="Add a kid"
                >
                  <option value="">+ Add a kid…</option>
                  {roster
                    .map((k) => String(Number(k.num)))
                    .filter((n) => n !== 'NaN' && !h.kids.includes(n))
                    .sort((a, b) => Number(a) - Number(b))
                    .map((n) => (
                      <option key={n} value={n}>{kidLabel(n, roster, 'full')}</option>
                    ))}
                </select>
              )}
              {!h.kids.length && ro && <span className="text-slate-500">None</span>}
            </span>
          ) : (
            <input
              key={`k-${h.id}-${h.kids.join(',')}`}
              defaultValue={h.kids.join(', ')}
              disabled={ro}
              onBlur={(e) => {
                const kids = [...new Set(e.target.value.split(/[\s,#]+/).map((x) => x.replace(/\D/g, '')).filter(Boolean).map((x) => String(Number(x))))];
                if (kids.join(',') !== h.kids.join(',')) edit((x) => ({ ...x, kids }));
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder="Jersey numbers: 21, 7"
              className="h-10 sm:h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm"
              aria-label="Kids (jersey numbers)"
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="Kinds">
        {(Object.keys(CATEGORY_LABEL) as HighlightCategory[]).map((c) => (
          <button
            key={c}
            type="button"
            disabled={ro}
            className={chip(h.categories.includes(c))}
            aria-pressed={h.categories.includes(c)}
            onClick={() => edit((x) => ({ ...x, categories: x.categories.includes(c) ? x.categories.filter((y) => y !== c) : [...x.categories.filter((y) => y !== 'other'), c] }))}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center" role="group" aria-label="Rating">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" disabled={ro} onClick={() => edit((x) => ({ ...x, rating: n as 1 | 2 | 3 }))} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="p-0.5">
              <Star size={18} className={n <= h.rating ? 'text-amber-400 fill-current' : 'text-slate-400'} />
            </button>
          ))}
        </span>
        <input
          key={`n-${h.id}-${h.note || ''}`}
          defaultValue={h.note || ''}
          disabled={ro}
          placeholder="Note (goes into the editor as a marker)"
          onBlur={(e) => e.target.value !== (h.note || '') && edit((x) => ({ ...x, note: e.target.value }))}
          className="flex-1 min-w-40 h-10 sm:h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2"
        />
        {!ro && onAddToReel && (
          <select
            value=""
            onChange={(e) => e.target.value && onAddToReel(e.target.value)}
            className="h-10 sm:h-8 rounded-lg border border-indigo-400 bg-white dark:bg-slate-950 px-1 font-bold text-indigo-700 dark:text-indigo-300"
            aria-label="Add to a reel"
          >
            <option value="">Add to reel…</option>
            <option value="__new">A new reel</option>
            {reels.map((r) => (
              <option key={r.id} value={r.id} disabled={r.has}>
                {r.name}{r.has ? ' (in it)' : ''}
              </option>
            ))}
          </select>
        )}
        {reels.some((r) => r.has) && (
          <span className="text-slate-500 truncate">In: {reels.filter((r) => r.has).map((r) => r.name).join(', ')}</span>
        )}
        {!ro &&
          (confirmDelete ? (
            <span className="inline-flex items-center gap-1.5 ml-auto">
              <span className="font-bold text-rose-700 dark:text-rose-300">Delete this highlight?</span>
              <button
                type="button"
                onClick={() => {
                  store.update((d) => removeHighlights(d, [h.id]));
                  onClose();
                }}
                className="h-9 sm:h-8 px-3 rounded-lg bg-rose-600 text-white font-bold"
              >
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="underline">
                Keep it
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto inline-flex items-center gap-1 h-9 sm:h-8 px-2 rounded-lg font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              title="Take it out of the highlights (and every reel); the film isn't touched"
            >
              <Trash2 size={13} /> Delete
            </button>
          ))}
      </div>
      </div>
      )}
      {social && (
        <SocialVideoPanel title={h.title || 'Highlight'} segments={socialSegments} access={access} settings={settings} logo={logo} onClose={() => setSocial(false)} />
      )}
      {preview && socialSegments.length > 0 && (
        <ReelPlayer title={`${h.title || 'Highlight'} (preview)`} segments={socialSegments} access={access} settings={settings} logo={logo} onClose={() => setPreview(false)} />
      )}
    </div>
  );
};
