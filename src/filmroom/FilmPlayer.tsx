// The video player: play / slow-mo / frame step, loop and auto-advance, zoom and pan, drawing over
// the video, and the pocket stopwatch (snap -> release). Keyboard: space play, ← → frame,
// ↑ ↓ previous / next play, L loop, D draw, S stopwatch, M mute, F full screen.
// Mouse / touch on the video: click or tap plays / pauses, scroll or pinch zooms, drag moves a zoomed-in
// picture, double-click (double-tap) is full screen.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Circle, Download, Eye, Maximize, Mic, MoveUpRight, Pause, Pencil, Pin, Play, Repeat, Route, SkipBack, SkipForward,
  Square, Target, Timer, Trash2, Undo2, Volume2, VolumeX, X, Zap, ZoomIn, ZoomOut,
} from 'lucide-react';
import { drawMarksOnCanvas, MARK_COLORS, Telestration } from './Telestration';
import { findSnapWithCamera, frameChange } from './snapFinder';
import type { FilmMark } from './types';

// Cache detected snap timestamps by clip URL so Fast Cutup mode is instant on revisit.
const snapTimeCache = new Map<string, number>();

const FRAME = 1 / 30;
const SPEEDS = [0.25, 0.5, 1, 2];

export interface PlayerApi {
  time: () => number;
  seek: (t: number) => void;
  video?: () => HTMLVideoElement | null;
}

export const fmtTime = (t: number) => {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

interface FilmPlayerProps {
  src?: string;
  /** Shown over the video area when there is no clip to play (loading, errors, "link film"). */
  placeholder?: React.ReactNode;
  title: string;
  marks: FilmMark[];
  onMarksChange: (marks: FilmMark[]) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onStopwatch: (seconds: number, at: number) => void;
  /** Optional callback to save a recorded voice-over coaching note to the play's notes. */
  onVoiceNote?: (note: { text: string; audioUrl: string; durationSec: number; at: number }) => void;
  apiRef: React.MutableRefObject<PlayerApi | null>;
  /** Tallest the video may be (CSS length). Default leaves room for the page and the controls. */
  maxVideoHeight?: string;
  /** Where a new clip starts (seconds): the same moment when switching camera view, else the top. */
  startAt?: number;
  /** Keyboard shortcuts (space, arrows, D, S...). Off while a coach is working elsewhere on the page. */
  shortcuts?: boolean;
  /** Start with "Auto" (next play when a clip ends) on or off; off while breaking a game down. */
  autoNextDefault?: boolean;
  /** Watching only (a player or family account): no drawing, no stopwatch. */
  viewOnly?: boolean;
  /** The selected play's lines on the video: the button that turns them on, and the layer drawn over the picture. */
  playLines?: { on: boolean; toggle: () => void; layer: (state: { playing: boolean }) => React.ReactNode };
}

// Bigger on a touch screen (a finger needs about 40px).
const btn = 'inline-flex items-center justify-center gap-1 h-9 min-w-9 pointer-coarse:h-10 pointer-coarse:min-w-10 px-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40';
// The player is always dark, so its colors are fixed here: the app's light and dark themes recolor
// the gray text shades (which made controls vanish on the black bar in dark mode).
const INK = '#e2e8f0';
const DIM = '#94a3b8';
const AMBER = { background: '#f59e0b', color: '#111827' };
const idle = `${btn} hover:bg-white/10`; // text color comes from the player (INK)
const on = `${btn} bg-indigo-600 text-white`;

export const FilmPlayer: React.FC<FilmPlayerProps> = ({
  src, placeholder, title, marks, onMarksChange, hasPrev, hasNext, onPrev, onNext, onStopwatch, onVoiceNote, apiRef,
  maxVideoHeight = 'calc(100dvh - 20rem)',
  viewOnly = false,
  startAt = 0,
  shortcuts = true,
  autoNextDefault = true,
  playLines,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [autoNext, setAutoNext] = useState(autoNextDefault);
  useEffect(() => setAutoNext(autoNextDefault), [autoNextDefault]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('footballFilmroomMuted') === '1';
    } catch {
      return false;
    }
  });
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      try {
        localStorage.setItem('footballFilmroomMuted', m ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !m;
    });
  }, []);
  // (React doesn't keep the video's muted flag in step on its own.)
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, src]);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  // The video keeps 16:9 and never grows taller than allowed. In full screen it fills the screen
  // (the controls sit on top of it).
  const videoHeight = isFullscreen ? '100dvh' : maxVideoHeight;
  const [tool, setTool] = useState<FilmMark['kind']>('arrow');
  const [color, setColor] = useState(MARK_COLORS[0]);
  // Timestamp-anchored freeze-frame telestration state
  const [pinToFrame, setPinToFrame] = useState(true);
  const [showAllMarks, setShowAllMarks] = useState(false);
  const [markLabel, setMarkLabel] = useState('');
  const [freezeActive, setFreezeActive] = useState<number | null>(null);
  const triggeredFreezesRef = useRef<Set<number>>(new Set());
  const freezeTimerRef = useRef<number | null>(null);

  // Fast Cutup ("No-Huddle") mode: trims pre-snap walking (Snap - 2s to Snap + 6.5s)
  const [fastCut, setFastCut] = useState(() => {
    try {
      return localStorage.getItem('footballFilmroomFastCut') === '1';
    } catch {
      return false;
    }
  });
  const [detectedSnap, setDetectedSnap] = useState<number | null>(null);
  const [detectingSnap, setDetectingSnap] = useState(false);
  const toggleFastCut = useCallback(() => {
    setFastCut((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('footballFilmroomFastCut', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Voice-Over + Telestration Coaching Clip Recorder ("Loom for Film Room")
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recordedClip, setRecordedClip] = useState<{
    videoUrl: string;
    mimeType: string;
    audioDataUrl?: string;
    durationSec: number;
    at: number;
  } | null>(null);
  const [voiceNoteCaption, setVoiceNoteCaption] = useState('');
  const [voiceNoteSaved, setVoiceNoteSaved] = useState(false);
  const recCleanupRef = useRef<(() => void) | null>(null);
  const marksRef = useRef<FilmMark[]>(marks);
  marksRef.current = marks;
  const titleRef = useRef(title);
  titleRef.current = title;

  const [snapAt, setSnapAt] = useState<number | null>(null);
  const [lastWatch, setLastWatch] = useState<{ seconds: number; at: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; px: number; py: number; moved: boolean; touch?: boolean } | null>(null);
  const view = useRef({ zoom: 1, pan: { x: 0, y: 0 } });

  apiRef.current = {
    time: () => videoRef.current?.currentTime || 0,
    seek: (t) => {
      const v = videoRef.current;
      if (v) {
        triggeredFreezesRef.current.clear();
        if (freezeTimerRef.current) {
          window.clearTimeout(freezeTimerRef.current);
          freezeTimerRef.current = null;
          setFreezeActive(null);
        }
        v.currentTime = Math.max(0, t);
      }
    },
    video: () => videoRef.current,
  };

  // Distinct freeze-frame timestamps on this play for timeline pins & auto-pause
  const pinnedTimestamps = useMemo(() => {
    const map = new Map<number, { t: number; color: string; label?: string; freeze?: boolean }>();
    for (const m of marks) {
      if (m.t === undefined || !Number.isFinite(m.t)) continue;
      const bucket = Math.round(m.t * 5) / 5; // 0.2s buckets
      if (!map.has(bucket)) {
        map.set(bucket, { t: m.t, color: m.color, label: m.label, freeze: m.freeze !== false });
      }
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [marks]);

  // Background snap detector for Fast Cutup mode
  useEffect(() => {
    if (!src) {
      setDetectedSnap(null);
      setDetectingSnap(false);
      return;
    }
    if (snapTimeCache.has(src)) {
      setDetectedSnap(snapTimeCache.get(src)!);
      setDetectingSnap(false);
      return;
    }
    if (!fastCut) {
      setDetectedSnap(null);
      return;
    }
    let cancelled = false;
    setDetectingSnap(true);
    const probe = document.createElement('video');
    probe.muted = true;
    probe.playsInline = true;
    probe.preload = 'auto';
    probe.crossOrigin = 'anonymous';
    const runProbe = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error('timeout')), 7000);
          probe.addEventListener('loadeddata', () => { window.clearTimeout(timer); resolve(); }, { once: true });
          probe.addEventListener('error', () => { window.clearTimeout(timer); reject(new Error('err')); }, { once: true });
          probe.src = src;
        });
        const dur = probe.duration;
        if (!Number.isFinite(dur) || dur < 6) {
          if (!cancelled) setDetectingSnap(false);
          return;
        }
        const FPS = 3, W = 96, H = 54;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const x = c.getContext('2d', { willReadFrequently: true });
        if (!x) return;
        const samples: { camera: number; players: number }[] = [];
        let last: Uint8Array | null = null;
        const end = Math.min(dur - 0.1, 24);
        for (let t = 0.1; t < end; t += 1 / FPS) {
          if (cancelled) return;
          await new Promise<void>((res) => {
            const tm = window.setTimeout(res, 600);
            probe.addEventListener('seeked', () => { window.clearTimeout(tm); res(); }, { once: true });
            probe.currentTime = t;
          });
          x.drawImage(probe, 0, 0, W, H);
          const d = x.getImageData(0, 0, W, H).data;
          const g = new Uint8Array(W * H);
          for (let i = 0; i < W * H; i++) g[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
          samples.push(last ? frameChange(last, g, W, H) : { camera: 0, players: 0 });
          last = g;
        }
        const guess = findSnapWithCamera(samples, FPS);
        if (!cancelled && guess && guess.snap > 1.2) {
          snapTimeCache.set(src, guess.snap);
          setDetectedSnap(guess.snap);
          const v = videoRef.current;
          const trimStart = Math.max(0, guess.snap - 2.0);
          if (v && v.currentTime < trimStart - 0.5) {
            v.currentTime = trimStart;
          }
        }
      } catch {
        /* ignore probe errors */
      } finally {
        probe.removeAttribute('src');
        probe.load();
        if (!cancelled) setDetectingSnap(false);
      }
    };
    void runProbe();
    return () => {
      cancelled = true;
      probe.removeAttribute('src');
    };
  }, [src, fastCut]);

  // New clip: start from the top (or Fast Cut pre-snap window) at the chosen speed; keep zoom off and stopwatch clear.
  useEffect(() => {
    setTime(0);
    setDuration(0);
    setSnapAt(null);
    setLastWatch(null);
    setFreezeActive(null);
    triggeredFreezesRef.current.clear();
    if (freezeTimerRef.current) {
      window.clearTimeout(freezeTimerRef.current);
      freezeTimerRef.current = null;
    }
    const v = videoRef.current;
    if (v && src) {
      v.playbackRate = speed;
      const cachedSnap = fastCut ? snapTimeCache.get(src) : undefined;
      const initialStart = startAt > 0 ? startAt : cachedSnap && cachedSnap > 2 ? Math.max(0, cachedSnap - 2.0) : 0;
      if (initialStart > 0) v.currentTime = initialStart;
      v.play().catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const resumeFromFreeze = useCallback(() => {
    if (freezeTimerRef.current) {
      window.clearTimeout(freezeTimerRef.current);
      freezeTimerRef.current = null;
    }
    setFreezeActive(null);
    videoRef.current?.play().catch(() => undefined);
  }, []);

  const togglePlay = useCallback(() => {
    if (freezeTimerRef.current) {
      resumeFromFreeze();
      return;
    }
    const v = videoRef.current;
    if (!v || !src) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, [src, resumeFromFreeze]);

  const step = useCallback((dir: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (freezeTimerRef.current) {
      window.clearTimeout(freezeTimerRef.current);
      freezeTimerRef.current = null;
      setFreezeActive(null);
    }
    v.pause();
    v.currentTime = Math.min(v.duration || Infinity, Math.max(0, v.currentTime + dir * FRAME));
  }, []);

  const stopwatch = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (snapAt === null) {
      setSnapAt(v.currentTime);
      setLastWatch(null);
      if (src) {
        snapTimeCache.set(src, v.currentTime);
        setDetectedSnap(v.currentTime);
      }
    } else {
      const seconds = Math.max(0, v.currentTime - snapAt);
      setLastWatch({ seconds, at: snapAt });
      setSnapAt(null);
    }
  }, [snapAt, src]);

  const toggleDraw = useCallback(() => {
    setDrawing((d) => {
      if (!d) videoRef.current?.pause();
      return !d;
    });
  }, []);

  // Stop any active coaching clip recording when unmounting or changing clip
  useEffect(() => {
    return () => {
      recCleanupRef.current?.();
    };
  }, [src]);

  const stopRecording = useCallback(() => {
    recCleanupRef.current?.();
  }, []);

  const startRecording = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !src || recording) return;
    setRecordedClip((prev) => {
      if (prev?.videoUrl) URL.revokeObjectURL(prev.videoUrl);
      return null;
    });
    setVoiceNoteSaved(false);
    setVoiceNoteCaption('');
    const startAtSec = v.currentTime || 0;
    // Pause and open drawing tools so the coach can immediately telestrate + narrate
    v.pause();
    setDrawing(true);

    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      micStream = null; // Still allow silent video + telestration recording if no mic
    }

    const cw = 1280;
    const ch = 720;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      micStream?.getTracks().forEach((t) => t.stop());
      return;
    }

    let active = true;
    const renderLoop = () => {
      if (!active) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const { zoom: z, pan: p } = view.current;
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.scale(z, z);
      ctx.translate(-cw / 2 + p.x * cw, -ch / 2 + p.y * ch);
      if (v.readyState >= 2) {
        const vw = v.videoWidth || cw;
        const vh = v.videoHeight || ch;
        const scale = Math.min(cw / vw, ch / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.drawImage(v, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      }
      drawMarksOnCanvas(ctx, marksRef.current, cw, ch, v.currentTime, false);
      ctx.restore();

      // Top-left watermark
      if (titleRef.current) {
        ctx.save();
        ctx.font = 'bold 20px Inter, system-ui, sans-serif';
        const tw = ctx.measureText(titleRef.current).width;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(16, 16, Math.min(cw - 32, tw + 24), 36);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(titleRef.current, 28, 41);
        ctx.restore();
      }
      requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);

    const canvasStream = canvas.captureStream(30);
    if (micStream) {
      micStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    }

    const mimeType =
      ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
      ) || '';
    const videoChunks: Blob[] = [];
    const videoRecorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined);
    videoRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) videoChunks.push(e.data);
    };

    // Parallel lightweight audio-only recorder so voice-over can be saved into shared PlayNotes
    let audioRecorder: MediaRecorder | null = null;
    const audioChunks: Blob[] = [];
    if (micStream) {
      const audioMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
        (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
      );
      try {
        audioRecorder = new MediaRecorder(micStream, audioMime ? { mimeType: audioMime } : undefined);
        audioRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunks.push(e.data);
        };
        audioRecorder.start(200);
      } catch {
        audioRecorder = null;
      }
    }

    const startedAt = Date.now();
    setRecording(true);
    setRecSeconds(0);
    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setRecSeconds(elapsed);
      if (elapsed >= 25) {
        recCleanupRef.current?.();
      }
    }, 250);

    videoRecorder.onstop = async () => {
      const durSec = Math.max(1, Math.round(((Date.now() - startedAt) / 1000) * 10) / 10);
      const blob = new Blob(videoChunks, { type: videoRecorder.mimeType || 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      let audioDataUrl: string | undefined;
      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: audioRecorder?.mimeType || 'audio/webm' });
        if (audioBlob.size < 450_000) {
          audioDataUrl = await new Promise<string | undefined>((res) => {
            const r = new FileReader();
            r.onloadend = () => res(typeof r.result === 'string' ? r.result : undefined);
            r.onerror = () => res(undefined);
            r.readAsDataURL(audioBlob);
          });
        }
      }
      setRecordedClip({
        videoUrl,
        mimeType: videoRecorder.mimeType || 'video/webm',
        audioDataUrl,
        durationSec: durSec,
        at: startAtSec,
      });
    };

    videoRecorder.start(200);

    recCleanupRef.current = () => {
      if (!active) return;
      active = false;
      window.clearInterval(tick);
      setRecording(false);
      try {
        if (audioRecorder && audioRecorder.state !== 'inactive') audioRecorder.stop();
      } catch {
        /* ignore */
      }
      try {
        if (videoRecorder.state !== 'inactive') videoRecorder.stop();
      } catch {
        /* ignore */
      }
      micStream?.getTracks().forEach((t) => t.stop());
      canvasStream.getTracks().forEach((t) => t.stop());
      recCleanupRef.current = null;
    };
  }, [src, recording]);

  const fullscreen = useCallback(() => {
    const el = rootRef.current as any;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else if (el.requestFullscreen || el.webkitRequestFullscreen) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    else (videoRef.current as any)?.webkitEnterFullscreen?.();
  }, []);

  view.current = { zoom, pan };
  // Zoom to a level, keeping the spot under the pointer (sx, sy: -0.5..0.5 of the frame from its
  // center) where it is. The picture can't be moved past its edges.
  const zoomTo = useCallback((next: number, sx = 0, sy = 0) => {
    const { zoom: z, pan: p } = view.current;
    const z2 = Math.min(4, Math.max(1, next < 1.03 ? 1 : next));
    const lim = (z2 - 1) / (2 * z2);
    const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));
    // A point at content u shows at s = zoom * (u + pan); keep s fixed for the point under the pointer.
    const pan2 = z2 === 1 ? { x: 0, y: 0 } : { x: clamp(sx / z2 - (sx / z - p.x)), y: clamp(sy / z2 - (sy / z - p.y)) };
    setZoom(Math.round(z2 * 100) / 100);
    setPan(pan2);
  }, []);
  const zoomBy = (d: number) => zoomTo(Math.round((view.current.zoom + d) * 2) / 2);

  // Scroll wheel on the video zooms toward the pointer (a real listener, so the page doesn't scroll too).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.0025);
      zoomTo(view.current.zoom * factor, (e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const act: Record<string, () => void> = {
        ' ': togglePlay,
        arrowleft: () => step(-1),
        arrowright: () => step(1),
        arrowup: () => hasPrev && onPrev(),
        arrowdown: () => hasNext && onNext(),
        l: () => setLoop((x) => !x),
        c: toggleFastCut,
        ...(viewOnly ? {} : { d: toggleDraw, s: stopwatch, r: () => (recording ? stopRecording() : void startRecording()) }),
        f: fullscreen,
        m: toggleMute,
      };
      if (act[k]) {
        e.preventDefault();
        act[k]();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts, togglePlay, step, hasPrev, hasNext, onPrev, onNext, toggleDraw, stopwatch, fullscreen, toggleMute, toggleFastCut, viewOnly, recording, stopRecording, startRecording]);

  const onEnded = () => {
    triggeredFreezesRef.current.clear();
    if (!loop && autoNext && hasNext) onNext();
  };

  // Handle time updates: Fast Cutup end-of-play trim + Freeze-Frame telestration auto-pause
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    const cur = v.currentTime;
    setTime(cur);
    if (cur < 0.3) triggeredFreezesRef.current.clear();

    // 1. Fast Cutup mode: auto-advance or loop when play window ends (Snap + 6.5s)
    if (fastCut && detectedSnap !== null && !drawing && !recording) {
      const cutStart = Math.max(0, detectedSnap - 2.0);
      const cutEnd = Math.min(v.duration || Infinity, detectedSnap + 6.5);
      if (cur >= cutEnd && cutEnd > cutStart + 2) {
        if (loop) {
          triggeredFreezesRef.current.clear();
          v.currentTime = cutStart;
          v.play().catch(() => undefined);
          return;
        }
        if (autoNext && hasNext) {
          v.pause();
          onNext();
          return;
        }
      }
    }

    // 2. Timestamp-Anchored Freeze-Frame Telestration: auto-pause at pinned mark `t` for 2.2s
    if (!v.paused && !drawing && !recording && !showAllMarks) {
      for (const pin of pinnedTimestamps) {
        if (!pin.freeze) continue;
        const bucket = Math.round(pin.t * 5) / 5;
        if (!triggeredFreezesRef.current.has(bucket) && cur >= pin.t - 0.05 && cur <= pin.t + 0.28) {
          triggeredFreezesRef.current.add(bucket);
          v.pause();
          setFreezeActive(pin.t);
          if (freezeTimerRef.current) window.clearTimeout(freezeTimerRef.current);
          freezeTimerRef.current = window.setTimeout(() => {
            freezeTimerRef.current = null;
            setFreezeActive(null);
            v.play().catch(() => undefined);
          }, 2200);
          break;
        }
      }
    }
  };

  // Mouse on the video: click plays / pauses, drag moves a zoomed-in picture, double-click is full screen.
  // (Drawing takes the mouse while it's on.)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const twoFingers = () => {
    const [a, b] = [...pointers.current.values()];
    return { a, b, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  };
  const onStageDown = (e: React.PointerEvent) => {
    if (drawing || e.button !== 0 || (e.target as HTMLElement).closest('button, input, a')) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      pinch.current = { dist: twoFingers().dist, zoom: view.current.zoom };
      press.current = null; // a pinch isn't a tap
      return;
    }
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false, touch: e.pointerType !== 'mouse' };
  };
  const releasePointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onStageMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const { a, b, dist } = twoFingers();
      const r = (e.currentTarget as Element).getBoundingClientRect();
      zoomTo(pinch.current.zoom * (dist / pinch.current.dist), ((a.x + b.x) / 2 - r.left) / r.width - 0.5, ((a.y + b.y) / 2 - r.top) / r.height - 0.5);
      return;
    }
    const s = press.current;
    if (!s) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) s.moved = true;
    if (zoom === 1 || !s.moved) return;
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const lim = (zoom - 1) / (2 * zoom);
    const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));
    setPan({ x: clamp(s.px + (e.clientX - s.x) / r.width / zoom), y: clamp(s.py + (e.clientY - s.y) / r.height / zoom) });
  };
  const onStageUp = (e: React.PointerEvent) => {
    releasePointer(e);
    const s = press.current;
    press.current = null;
    if (s && !s.moved) return togglePlay();
    // A finger swiped across the video (not zoomed in): the next play to the left, the one before to the right.
    if (s?.touch && zoom === 1) {
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && hasNext) onNext();
        else if (dx > 0 && hasPrev) onPrev();
      }
    }
  };
  // On a phone the controls go under the video; everywhere else (and in full screen) they sit on it, like Hudl.
  const overlay = isFullscreen ? 'absolute inset-x-0 bottom-0' : 'sm:absolute sm:inset-x-0 sm:bottom-0';

  const tools = (
    <>
      {(
        [
          ['arrow', MoveUpRight, 'Arrow'],
          ['pen', Pencil, 'Freehand pen'],
          ['circle', Circle, 'Circle'],
          ['spotlight', Target, 'Player spotlight ring'],
        ] as const
      ).map(([k, Icon, tip]) => (
        <button key={k} className={tool === k ? on : idle} onClick={() => setTool(k)} title={tip}>
          <Icon size={15} />
        </button>
      ))}
      <span className="w-px h-6 bg-white/15 mx-1" />
      {MARK_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => setColor(c)}
          className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
          style={{ background: c }}
          aria-label={`Color ${c}`}
        />
      ))}
      <span className="w-px h-6 bg-white/15 mx-1" />
      <input
        type="text"
        value={markLabel}
        onChange={(e) => setMarkLabel(e.target.value.slice(0, 22))}
        placeholder="Callout tag (opt)…"
        title="Optional short coaching label stamped onto the next arrow/spotlight (e.g. 'Contain!', 'Fill B-gap')"
        className="h-8 w-28 sm:w-32 rounded-lg bg-white/10 border border-white/20 px-2 text-xs font-bold text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
      />
      <button
        type="button"
        onClick={() => setPinToFrame((p) => !p)}
        className={pinToFrame ? `${btn} bg-amber-500 text-slate-950` : idle}
        title={
          pinToFrame
            ? `Freeze-Frame ON: drawing pins to ${fmtTime(time)}, auto-pauses playback for 2.2s, then fades out`
            : 'All Clip: drawing stays on screen for the whole clip'
        }
      >
        <Pin size={14} />
        <span>{pinToFrame ? `@${fmtTime(time)}` : 'All clip'}</span>
      </button>
      {pinnedTimestamps.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAllMarks((v) => !v)}
          className={showAllMarks ? on : idle}
          title="Toggle showing all timestamp-pinned drawings at once"
        >
          <Eye size={14} />
          <span className="hidden md:inline">All ({marks.length})</span>
        </button>
      )}
      <span className="w-px h-6 bg-white/15 mx-1" />
      <button className={idle} onClick={() => onMarksChange(marks.slice(0, -1))} disabled={!marks.length} title="Undo">
        <Undo2 size={15} />
      </button>
      <button className={idle} onClick={() => onMarksChange([])} disabled={!marks.length} title="Clear this play's drawing">
        <Trash2 size={15} />
      </button>
      <button className={on} onClick={() => setDrawing(false)}>
        Done
      </button>
    </>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col rounded-xl overflow-hidden select-none [&:fullscreen]:rounded-none [&:fullscreen]:justify-center"
      style={{ color: INK, background: '#000' }}
    >
      <div
        ref={stageRef}
        style={{ width: `min(100%, max(18rem, calc(${videoHeight} * 16 / 9)))` }}
        className={`relative mx-auto aspect-video overflow-hidden bg-black ${drawing || zoom > 1 ? 'touch-none' : 'touch-pan-y'} ${drawing ? '' : zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        title={drawing ? undefined : 'Click: play / pause · Scroll: zoom · Drag: move around · Double-click: full screen · On a touch screen: swipe for the next play'}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={(e) => {
          releasePointer(e);
          press.current = null;
        }}
        onDoubleClick={() => !drawing && fullscreen()}
      >
        <div className="absolute inset-0" style={{ transform: `scale(${zoom}) translate(${pan.x * 100}%, ${pan.y * 100}%)`, transformOrigin: 'center' }}>
          {src && (
            <video
              ref={videoRef}
              src={src}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
              crossOrigin="anonymous"
              muted={muted}
              loop={loop}
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onEnded={onEnded}
            />
          )}
          <Telestration
            marks={marks}
            active={drawing}
            tool={tool}
            color={color}
            currentTime={time}
            showAll={showAllMarks}
            nextLabel={markLabel}
            pinToFrame={pinToFrame}
            onAdd={(m) => {
              onMarksChange([...marks, m]);
              if (markLabel) setMarkLabel('');
            }}
          />
          {playLines?.on && src && !drawing && playLines.layer({ playing })}
        </div>
        {/* Above the controls that sit over the bottom of the video, so its buttons (Link film...) can be tapped. */}
        {!src && <div className={`absolute inset-0 flex items-center justify-center p-4 text-center text-sm z-20 pointer-events-none [&>*]:pointer-events-auto ${isFullscreen ? 'pb-28' : 'sm:pb-28'}`}>{placeholder}</div>}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="px-2 py-1 rounded-md text-xs font-bold truncate" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>{title}</span>
            {freezeActive !== null && (
              <button
                type="button"
                onClick={resumeFromFreeze}
                className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-amber-500 text-slate-950 shadow-lg animate-pulse cursor-pointer"
                title="Click or press Space to continue playback immediately"
              >
                <Pin size={12} /> Coaching Freeze-Frame @{fmtTime(freezeActive)} · Tap to resume
              </button>
            )}
            {recording && (
              <button
                type="button"
                onClick={stopRecording}
                className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-rose-600 text-white shadow-lg animate-pulse cursor-pointer"
                title="Stop recording coaching clip"
              >
                <span className="w-2 h-2 rounded-full bg-white" /> REC {recSeconds}s / 25s · Draw &amp; Talk (Tap to Stop)
              </button>
            )}
          </div>
          <span className="flex items-center gap-1.5 shrink-0">
            {fastCut && (
              <span className="px-2 py-1 rounded-md text-[11px] font-black tabular-nums bg-emerald-600/90 text-white">
                {detectingSnap ? '⚡ Finding snap…' : detectedSnap ? `⚡ Snap @${fmtTime(detectedSnap)}` : '⚡ Fast Cut'}
              </span>
            )}
            {zoom > 1 && (
              <span className="px-2 py-1 rounded-md text-xs font-black tabular-nums" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{zoom.toFixed(1)}×</span>
            )}
            {(snapAt !== null || lastWatch) && (
              <span className="px-2 py-1 rounded-md text-xs font-black tabular-nums" style={AMBER}>
                {snapAt !== null ? `⏱ ${(Math.max(0, time - snapAt)).toFixed(2)}s` : `Pocket ${lastWatch!.seconds.toFixed(2)}s`}
              </span>
            )}
          </span>
        </div>

        {/* Recorded Coaching Clip action bar ("Loom for Film Room") */}
        {recordedClip && !recording && (
          <div
            className="absolute top-11 left-2 right-2 z-20 flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-indigo-400/50 shadow-2xl"
            style={{ background: 'rgba(15, 23, 42, 0.94)' }}
          >
            <span className="text-xs font-black text-indigo-300">
              🎬 Coaching Reel ({recordedClip.durationSec}s @{fmtTime(recordedClip.at)})
            </span>
            <a
              href={recordedClip.videoUrl}
              download={`${(title || 'coaching-clip').replace(/[^a-zA-Z0-9_-]+/g, '_')}_${Math.round(recordedClip.at)}s.${
                recordedClip.mimeType.includes('mp4') ? 'mp4' : 'webm'
              }`}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black"
              title="Download video + telestration + voice-over clip to share with coaches/parents"
            >
              <Download size={14} /> Download Video Reel
            </a>
            {onVoiceNote && (
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={voiceNoteCaption}
                  onChange={(e) => setVoiceNoteCaption(e.target.value)}
                  placeholder="Add note summary (optional)…"
                  className="flex-1 h-8 rounded-lg bg-white/10 border border-white/20 px-2.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  disabled={voiceNoteSaved}
                  onClick={() => {
                    onVoiceNote({
                      text: voiceNoteCaption.trim() || `🎙️ Voice-over breakdown (${recordedClip.durationSec}s)`,
                      audioUrl: recordedClip.audioDataUrl || '',
                      durationSec: recordedClip.durationSec,
                      at: recordedClip.at,
                    });
                    setVoiceNoteSaved(true);
                  }}
                  className={`h-8 px-3 rounded-lg text-xs font-black ${
                    voiceNoteSaved ? 'bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {voiceNoteSaved ? '✓ Saved to Play Notes' : '💬 Save Voice Note to Play'}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(recordedClip.videoUrl);
                setRecordedClip(null);
              }}
              className="ml-auto p-1 text-slate-400 hover:text-white"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Drawing tools: over the top right of the video (under it on a phone) */}
      {drawing && (
        <div
          className={`${isFullscreen ? 'absolute top-11 right-2' : 'sm:absolute sm:top-11 sm:right-2'} z-10 flex flex-wrap items-center justify-end gap-1 p-1.5 sm:rounded-xl`}
          style={{ background: 'rgba(0,0,0,0.82)' }}
        >
          {tools}
        </div>
      )}

      {/* Scrubber and controls: over the bottom of the video, like Hudl (under it on a phone) */}
      <div
        className={`${overlay} z-10 flex flex-col pointer-events-none sm:pt-8`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.6) 65%, rgba(0,0,0,0))' }}
      >
        <div className="pointer-events-auto flex items-center gap-2 px-3 pt-2 text-[11px] tabular-nums" style={{ color: DIM }}>
          <span>{fmtTime(time)}</span>
          <div className="relative flex-1 flex items-center">
            {/* Fast Cutup active window highlight bar */}
            {fastCut && detectedSnap !== null && duration > 0 && (
              <div
                className="absolute h-1.5 rounded-full bg-emerald-500/45 pointer-events-none"
                style={{
                  left: `${(Math.max(0, detectedSnap - 2.0) / duration) * 100}%`,
                  width: `${((Math.min(duration, detectedSnap + 6.5) - Math.max(0, detectedSnap - 2.0)) / duration) * 100}%`,
                }}
                title={`Fast Cutup window: ${fmtTime(Math.max(0, detectedSnap - 2))} – ${fmtTime(Math.min(duration, detectedSnap + 6.5))}`}
              />
            )}
            {/* Timestamp-anchored telestration pins on the timeline */}
            {duration > 0 &&
              pinnedTimestamps.map((pin) => (
                <button
                  key={pin.t}
                  type="button"
                  onClick={() => apiRef.current?.seek(pin.t)}
                  style={{
                    left: `${Math.min(98, Math.max(2, (pin.t / duration) * 100))}%`,
                    background: pin.color,
                  }}
                  title={`Telestration @ ${fmtTime(pin.t)}${pin.label ? ` · "${pin.label}"` : ''} (click to jump)`}
                  className="absolute -top-2.5 -translate-x-1/2 w-2.5 h-2.5 rotate-45 border border-slate-950 shadow cursor-pointer hover:scale-125 transition-transform z-10"
                />
              ))}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={FRAME}
              value={Math.min(time, duration || 0)}
              onChange={(e) => apiRef.current?.seek(Number(e.target.value))}
              className="w-full accent-indigo-500 relative z-0"
              aria-label="Position in clip"
              disabled={!src}
            />
          </div>
          <span>{fmtTime(duration)}</span>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-1 px-2 py-1.5">
          <button className={idle} onClick={onPrev} disabled={!hasPrev} title="Previous play (↑)"><SkipBack size={16} /></button>
          <button className={idle} onClick={() => step(-1)} disabled={!src} title="Back one frame (←)"><ChevronLeft size={18} /></button>
          <button className={`${btn} w-11 hover:opacity-85`} style={{ background: '#fff', color: '#0f172a' }} onClick={togglePlay} disabled={!src} title="Play / pause (space, or click the video)">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className={idle} onClick={() => step(1)} disabled={!src} title="Forward one frame (→)"><ChevronRight size={18} /></button>
          <button className={idle} onClick={onNext} disabled={!hasNext} title="Next play (↓)"><SkipForward size={16} /></button>

          <span className="w-px h-6 bg-white/15 mx-1 max-sm:hidden" />
          {SPEEDS.map((sp) => (
            <button key={sp} className={`${speed === sp ? on : idle} max-sm:!hidden`} onClick={() => setSpeed(sp)} title={`${sp}× speed`}>
              {sp === 0.25 ? '¼' : sp === 0.5 ? '½' : sp}×
            </button>
          ))}
          <button
            className={`${speed === 1 ? idle : on} sm:!hidden`}
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            title="Speed (tap to change)"
          >
            {speed === 0.25 ? '¼' : speed === 0.5 ? '½' : speed}×
          </button>
          <button className={loop ? on : idle} onClick={() => setLoop((x) => !x)} title="Loop this play (L)"><Repeat size={15} /></button>
          <button className={`${autoNext ? on : idle} max-sm:!hidden`} onClick={() => setAutoNext((x) => !x)} title="Go to the next play when this one ends">Auto</button>
          <button
            className={fastCut ? `${btn} bg-emerald-600 text-white` : idle}
            onClick={toggleFastCut}
            title="Fast Cutup Mode (C): automatically trims pre-snap huddle walking and plays Snap -2s to +6.5s"
          >
            <Zap size={14} />
            <span className="hidden md:inline">Fast Cut</span>
          </button>

          <span className="w-px h-6 bg-white/15 mx-1 max-sm:hidden" />
          <button className={`${idle} max-sm:!hidden`} onClick={() => zoomBy(-0.5)} disabled={zoom === 1} title="Zoom out (or scroll on the video)"><ZoomOut size={16} /></button>
          {zoom > 1 && (
            <button className={idle} onClick={() => zoomTo(1)} title="Reset zoom">{zoom.toFixed(1)}×</button>
          )}
          <button className={`${idle} max-sm:!hidden`} onClick={() => zoomBy(0.5)} disabled={zoom === 4} title="Zoom in (or scroll on the video; drag to move around)"><ZoomIn size={16} /></button>

          <span className="w-px h-6 bg-white/15 mx-1 max-sm:hidden" />
          {!viewOnly && (
            <>
              <button className={drawing ? on : idle} onClick={toggleDraw} title="Draw freeze-frame telestration on the video (D)">
                <Pencil size={15} />
                <span className="hidden sm:inline">Draw</span>
              </button>
              {playLines && (
                <button
                  className={playLines.on ? on : idle}
                  onClick={() => {
                    // The lines are drawn for a still frame.
                    if (!playLines.on) videoRef.current?.pause();
                    playLines.toggle();
                  }}
                  disabled={!src}
                  title="Show the selected play's routes, runs and motion on the paused video"
                >
                  <Route size={15} />
                  <span className="hidden sm:inline">Play lines</span>
                </button>
              )}
              <button
                className={recording ? `${btn} bg-rose-600 text-white animate-pulse` : idle}
                onClick={() => (recording ? stopRecording() : void startRecording())}
                disabled={!src}
                title="Record a 15-25s Voice-Over + Telestration Coaching Reel (R)"
              >
                {recording ? <Square size={14} /> : <Mic size={15} />}
                <span className="hidden sm:inline">{recording ? `Stop (${recSeconds}s)` : 'Voice Clip'}</span>
              </button>
              <button className={snapAt !== null ? btn : idle} style={snapAt !== null ? AMBER : undefined} onClick={stopwatch} disabled={!src} title="Stopwatch: tap at the snap, tap again at the release (S)">
                <Timer size={15} />
                <span className="hidden sm:inline">{snapAt !== null ? 'Release' : 'Snap'}</span>
              </button>
            </>
          )}
          {lastWatch && (
            <button className={`${btn} hover:opacity-85`} style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d' }} onClick={() => { onStopwatch(lastWatch.seconds, lastWatch.at); setLastWatch(null); }}>
              Save {lastWatch.seconds.toFixed(2)}s as note
            </button>
          )}
          <button className={`${idle} ml-auto`} onClick={toggleMute} title={muted ? 'Sound on (M)' : 'Mute (M)'} aria-label={muted ? 'Sound on' : 'Mute'} aria-pressed={muted}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button className={idle} onClick={fullscreen} title="Full screen (F, or double-click the video)"><Maximize size={16} /></button>
        </div>
      </div>
    </div>
  );
};
