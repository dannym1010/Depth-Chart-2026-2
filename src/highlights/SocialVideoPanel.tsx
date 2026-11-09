// "Video for Instagram": pick the shape (Reel / Story, feed post, square), how much the wide film is zoomed in and
// where (each highlight can follow its kid), titles and sound; see a frame of it; make the MP4 on this device; then
// save it, or share it straight to Instagram / Photos from an iPad or phone.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, Share2, X } from 'lucide-react';
import { drawCard } from './graphics';
import { clock, timelineSeconds, type Segment } from './highlightData';
import type { FilmAccess } from './filmAccess';
import type { Highlight, HighlightSettings } from './types';
import {
  canMakeVideo,
  drawFilmFrame,
  drawSocialTitle,
  drawSpotIn,
  focusAt,
  IG_REEL_MAX,
  IG_STORY_MAX,
  renderSocialVideo,
  SOCIAL_SHAPES,
  socialFileName,
  type SocialResult,
  type SocialShape,
} from './socialVideo';

interface Props {
  title: string;
  segments: Segment[];
  access: FilmAccess;
  settings: HighlightSettings;
  logo?: HTMLImageElement | null;
  transition?: 'cut' | 'dip' | 'fade';
  /** The reel's song, when it has one in the library's Music folder. */
  music?: { name: string; get: () => Promise<Blob> };
  onClose: () => void;
}

const PREFS_KEY = 'footballSocialVideo';
type Prefs = { shape: SocialShape; zoom: number; titles: boolean; game: boolean; music: boolean };
const loadPrefs = (gameDefault: boolean): Prefs => {
  const d: Prefs = { shape: 'reel', zoom: 0, titles: true, game: gameDefault, music: true };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return d;
  }
};

const canShareFiles = (f: File) => {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [f] }));
  } catch {
    return false;
  }
};

export const SocialVideoPanel: React.FC<Props> = ({ title, segments, access, settings, logo, transition = 'cut', music, onClose }) => {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs(settings.gameSound !== 'off'));
  const set = (p: Partial<Prefs>) =>
    setPrefs((x) => {
      const next = { ...x, ...p };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private window */
      }
      return next;
    });
  const [focus, setFocus] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ f: number; label: string }>({ f: 0, label: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState<(SocialResult & { file: File; url: string }) | null>(null);
  const stopRef = useRef<AbortController | null>(null);
  const seconds = useMemo(() => timelineSeconds(segments), [segments]);
  const shape = SOCIAL_SHAPES[prefs.shape];

  // The highlights in it, in order (each one's focus can be set).
  const highlights = useMemo(() => {
    const seen = new Set<string>();
    const out: Highlight[] = [];
    for (const s of segments) if (s.type !== 'card' && !seen.has(s.h.id)) (seen.add(s.h.id), out.push(s.h));
    return out;
  }, [segments]);
  const [shown, setShown] = useState<string>('');
  const showH = highlights.find((h) => h.id === shown) || highlights[0];

  // Settings changed after a video was made: that video is out of date.
  useEffect(() => {
    setResult((r) => {
      if (r) URL.revokeObjectURL(r.url);
      return null;
    });
  }, [prefs, focus, segments]);
  useEffect(() => () => stopRef.current?.abort(), []);

  // ---- The preview: one frame of the highlight picked, drawn the way the video will be ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewReady, setPreviewReady] = useState(0);
  useEffect(() => {
    if (!showH) return;
    let release: (() => void) | undefined;
    let off = false;
    setPreviewUrl('');
    access
      .url(showH.game, showH.view, showH.clip)
      .then((r) => {
        if (off) return r.release();
        release = r.release;
        setPreviewUrl(r.url);
      })
      .catch(() => undefined);
    return () => {
      off = true;
      release?.();
    };
  }, [access, showH]);
  const previewAt = showH ? (showH.freeze ? showH.freeze.at : showH.marks?.length ? (showH.marks[0].from + showH.marks[0].to) / 2 : showH.start + (showH.end - showH.start) * 0.4) : 0;
  useEffect(() => {
    const v = vidRef.current;
    if (!v || !previewUrl) return;
    const seek = () => {
      v.currentTime = Math.max(0, previewAt);
    };
    const ready = () => setPreviewReady((n) => n + 1);
    v.addEventListener('seeked', ready);
    if (v.readyState >= 1) seek();
    else v.addEventListener('loadedmetadata', seek, { once: true });
    return () => {
      v.removeEventListener('seeked', ready);
      v.removeEventListener('loadedmetadata', seek);
    };
  }, [previewUrl, previewAt]);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = shape.w;
    const H = shape.h;
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const v = vidRef.current;
    if (!showH) {
      const card = segments.find((s) => s.type === 'card');
      if (card && card.type === 'card') drawCard(ctx, W, H, card.card, settings, logo);
      return;
    }
    if (v && previewUrl && v.readyState >= 2 && v.videoWidth) {
      const tiny = document.createElement('canvas');
      tiny.width = Math.round(W / 30);
      tiny.height = Math.round(H / 30);
      const f = focusAt(showH, previewAt, 'main', focus[showH.id]);
      const r = drawFilmFrame(ctx, W, H, v, v.videoWidth, v.videoHeight, prefs.zoom, f, tiny);
      for (const m of showH.marks || []) if (previewAt >= m.from && previewAt <= m.to) drawSpotIn(ctx, W, H, r, m, settings);
      if (showH.freeze?.spot) drawSpotIn(ctx, W, H, r, showH.freeze.spot, settings);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading the film…', W / 2, H / 2);
    }
    const seg = segments.find((s) => s.type !== 'card' && s.h.id === showH.id);
    if (prefs.titles && seg && seg.type !== 'card' && seg.overlay) drawSocialTitle(ctx, W, H, seg.overlay, settings, logo);
  }, [shape, prefs.zoom, prefs.titles, focus, showH, previewReady, previewUrl, previewAt, segments, settings, logo]);

  const make = async () => {
    setRunning(true);
    setError('');
    setResult(null);
    setProgress({ f: 0, label: 'Starting…' });
    const stop = new AbortController();
    stopRef.current = stop;
    try {
      const song = music && prefs.music ? await music.get() : null;
      const r = await renderSocialVideo({
        segments,
        access,
        settings,
        logo,
        shape: prefs.shape,
        zoom: prefs.zoom,
        focus,
        titles: prefs.titles,
        sound: { game: prefs.game, music: song },
        transition,
        signal: stop.signal,
        onProgress: (f, label) => setProgress({ f, label }),
      });
      const file = new File([r.blob], socialFileName(title, prefs.shape), { type: 'video/mp4' });
      setResult({ ...r, file, url: URL.createObjectURL(file) });
    } catch (err: any) {
      setError(err?.name === 'AbortError' ? 'Stopped.' : err?.message || String(err));
    } finally {
      setRunning(false);
      stopRef.current = null;
    }
  };

  const save = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const share = async () => {
    if (!result) return;
    try {
      await navigator.share({ files: [result.file], title: title });
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err?.message || String(err));
    }
  };
  const shareable = result ? canShareFiles(result.file) : false;
  // An iPad / phone: Share is the way to Instagram and Photos. A computer: Download first.
  const touch = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const sharePrimary = shareable && touch;
  const tooLong = prefs.shape === 'reel' && seconds > IG_REEL_MAX;
  const storyNote = prefs.shape === 'reel' && seconds > IG_STORY_MAX && !tooLong;
  const chip = (on: boolean) =>
    `flex flex-col items-center gap-1 rounded-xl border p-2 cursor-pointer min-w-0 ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`;

  return (
    <div className="fixed inset-0 z-[75] bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={() => !running && onClose()}>
      <div
        role="dialog"
        aria-label={`Video for Instagram: ${title}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[94dvh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 flex flex-col gap-3 text-sm"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 dark:text-slate-100">Video for Instagram</h3>
            <p className="text-xs text-slate-500 truncate">
              {title} · {clock(seconds)} · MP4, made on this device
            </p>
          </div>
          <button type="button" onClick={() => (running ? stopRef.current?.abort() : onClose())} className="ml-auto h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {!canMakeVideo() && (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs p-2">
            This browser can't make videos. Use Chrome or Edge on a computer, or Safari on an up-to-date iPad / iPhone.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="flex flex-col gap-3 min-w-0">
            <fieldset className="flex flex-col gap-1.5" disabled={running}>
              <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">Shape</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(SOCIAL_SHAPES) as SocialShape[]).map((k) => {
                  const s = SOCIAL_SHAPES[k];
                  return (
                    <label key={k} className={chip(prefs.shape === k)}>
                      <input type="radio" name="ig-shape" className="sr-only" checked={prefs.shape === k} onChange={() => set({ shape: k })} />
                      <span className="rounded-[3px] border-2 border-current text-slate-500" style={{ width: 30 * (s.w / s.h), height: 30 }} aria-hidden />
                      <b className="text-xs text-slate-800 dark:text-slate-100 text-center">{s.label}</b>
                      <span className="text-[11px] text-slate-500">{s.note}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1" disabled={running}>
              <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">The film</legend>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 shrink-0">Whole field</span>
                <input type="range" min={0} max={100} step={5} value={Math.round(prefs.zoom * 100)} onChange={(e) => set({ zoom: Number(e.target.value) / 100 })} className="flex-1 min-w-0" aria-label="Zoom in on the film" />
                <span className="text-slate-500 shrink-0">Fills the screen</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {prefs.zoom === 0
                  ? 'The whole picture shows, with a soft copy of it filling the rest of the frame.'
                  : 'Zoomed in: each highlight follows its circles / arrows on a kid; set the others below.'}
              </p>
            </fieldset>

            {prefs.zoom > 0 && highlights.length > 0 && (
              <fieldset className="flex flex-col gap-1" disabled={running}>
                <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">Where to look</legend>
                <div className="flex flex-col gap-1 max-h-48 overflow-auto pr-1">
                  {highlights.map((h) => {
                    const auto = focus[h.id] === undefined;
                    const follows = Boolean(h.marks?.length || h.freeze?.spot);
                    return (
                      <div key={h.id} className={`flex items-center gap-2 text-xs rounded-lg px-1.5 py-1 ${showH?.id === h.id ? 'bg-slate-100 dark:bg-slate-800' : ''}`} onClick={() => setShown(h.id)}>
                        <span className="truncate w-28 sm:w-36 shrink-0 font-bold text-slate-700 dark:text-slate-200" title={h.title}>{h.title || 'Highlight'}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={2}
                          value={Math.round((auto ? focusAt(h, (h.start + h.end) / 2, 'main').x : focus[h.id]) * 100)}
                          onChange={(e) => {
                            setShown(h.id);
                            setFocus((f) => ({ ...f, [h.id]: Number(e.target.value) / 100 }));
                          }}
                          className="flex-1 min-w-0"
                          aria-label={`Where to look: ${h.title}`}
                        />
                        {auto ? (
                          <span className="text-[11px] text-slate-500 w-16 shrink-0">{follows ? 'follows kid' : 'middle'}</span>
                        ) : (
                          <button type="button" className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 w-16 shrink-0 text-left" onClick={() => setFocus((f) => { const n = { ...f }; delete n[h.id]; return n; })}>
                            Auto
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" disabled={running}>
              <legend className="font-black text-slate-800 dark:text-slate-100 mb-1 text-sm">On it</legend>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={prefs.titles} onChange={(e) => set({ titles: e.target.checked })} /> Titles
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={prefs.game} onChange={(e) => set({ game: e.target.checked })} /> Game sound
              </label>
              {music && (
                <label className="inline-flex items-center gap-1.5 min-w-0">
                  <input type="checkbox" checked={prefs.music} onChange={(e) => set({ music: e.target.checked })} /> <span className="truncate">Song: {music.name}</span>
                </label>
              )}
            </fieldset>
            {music && prefs.music && (
              <p className="text-[11px] text-slate-500 -mt-2">Instagram may mute a copyrighted song. Adding the song inside Instagram is safer.</p>
            )}
            {tooLong && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Instagram Reels go up to {clock(IG_REEL_MAX)}; this runs {clock(seconds)}. Take some clips out, or post it as a few videos.</p>}
            {storyNote && <p className="text-[11px] text-slate-500">Fine for a Reel. A Story shows it 60 seconds at a time.</p>}
          </div>

          <div className="flex flex-col items-center gap-1 min-w-0">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-black max-w-full"
              style={{ width: prefs.shape === 'reel' ? 160 : 210, aspectRatio: `${shape.w} / ${shape.h}` }}
              aria-label="Preview of a frame"
            />
            {previewUrl && <video ref={vidRef} src={previewUrl} muted playsInline preload="auto" className="hidden" />}
            <span className="text-[11px] text-slate-500 text-center">{showH ? `Preview: ${showH.title || 'highlight'}` : 'Preview'}</span>
          </div>
        </div>

        {(running || error) && (
          <div className="flex flex-col gap-1">
            {running && (
              <>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${Math.round(progress.f * 100)}%` }} />
                </div>
                <span className="text-xs text-slate-500 truncate">
                  {Math.round(progress.f * 100)}% · {progress.label} · keep this screen open
                </span>
              </>
            )}
            {error && <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</span>}
          </div>
        )}

        {result && (
          <div className="flex flex-col sm:flex-row gap-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 p-3">
            <video src={result.url} controls playsInline className="rounded-lg bg-black self-center" style={{ maxHeight: 260, maxWidth: '100%' }} />
            <div className="flex flex-col gap-2 min-w-0">
              <span className="font-bold text-emerald-800 dark:text-emerald-200 inline-flex items-start gap-1">
                <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> Ready: {clock(result.seconds)} · {result.width}×{result.height} · {(result.blob.size / 1e6).toFixed(1)} MB
              </span>
              {!result.sound && (prefs.game || prefs.music) && <span className="text-xs text-amber-700 dark:text-amber-300">This device couldn't add the sound, so the video is silent.</span>}
              <div className="flex flex-wrap gap-2">
                {sharePrimary && (
                  <button type="button" onClick={() => void share()} className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-1.5">
                    <Share2 size={15} /> Share / Save to Photos
                  </button>
                )}
                <button type="button" onClick={save} className={`h-9 px-4 rounded-lg font-bold inline-flex items-center gap-1.5 ${sharePrimary ? 'border border-slate-300 dark:border-slate-600' : 'bg-indigo-600 text-white'}`}>
                  <Download size={15} /> Download
                </button>
                {shareable && !sharePrimary && (
                  <button type="button" onClick={() => void share()} className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1.5">
                    <Share2 size={15} /> Share…
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                {sharePrimary
                  ? 'Share › Instagram posts it now; Save Video puts it in Photos.'
                  : 'Then get it to your phone (AirDrop, Google Drive, a text or email) and post it from Instagram. Or make it right on the iPad / phone and tap Share.'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {running ? (
            <button type="button" onClick={() => stopRef.current?.abort()} className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Stop
            </button>
          ) : (
            <button type="button" onClick={() => void make()} disabled={!canMakeVideo() || !segments.length} className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-2 disabled:opacity-40">
              {result ? 'Make it again' : 'Make the video'}
            </button>
          )}
          <span className="text-[11px] text-slate-500">About as long as the video itself, or a bit longer; the film downloads first when it's on Drive.</span>
        </div>
      </div>
    </div>
  );
};
