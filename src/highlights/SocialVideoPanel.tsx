// "Video for Instagram": pick the shape (Reel / Story, feed post, square), how much the wide film is zoomed in and
// where (a highlight with a kid's path drawn follows him), titles and sound; see a frame of it; make the MP4 on this
// device, as one video or one per highlight (for a post you swipe through); then save them (all in one .zip on a
// computer), or share them straight to Instagram / Photos from an iPad or phone.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, Share2, X } from 'lucide-react';
import { clock, timelineSeconds, type Segment } from './highlightData';
import type { FilmAccess } from './filmAccess';
import { SocialPreview } from './SocialPreview';
import type { Highlight, HighlightSettings } from './types';
import {
  canMakeVideo,
  focusAt,
  followPath,
  hasFollow,
  IG_REEL_MAX,
  IG_STORY_MAX,
  renderSocialVideo,
  SOCIAL_SHAPES,
  socialFileName,
  zoomFor,
  type SocialResult,
  type SocialShape,
} from './socialVideo';
import { zipFiles } from './zip';
import { hasClipZoom } from './clipZoom';

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
type Prefs = { shape: SocialShape; zoom: number; followZoom: number; titles: boolean; game: boolean; music: boolean; each: boolean };
const loadPrefs = (gameDefault: boolean): Prefs => {
  const d: Prefs = { shape: 'reel', zoom: 0, followZoom: 1, titles: true, game: gameDefault, music: true, each: false };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return d;
  }
};

const FOLLOW_ZOOMS = [
  { v: 1, label: 'Fills the screen' },
  { v: 1.5, label: 'Closer' },
  { v: 2, label: 'Closest' },
];

type Made = SocialResult & { file: File; url: string; title: string };

const canShareFiles = (files: File[]) => {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files }));
  } catch {
    return false;
  }
};

/** A moment worth showing in the preview: along his path, at a mark, at the freeze, else early in the play. */
const previewMoment = (h: Highlight) => {
  const p = followPath(h);
  if (p.length > 1) return p[Math.floor(p.length / 2)].t;
  if (h.freeze) return h.freeze.at;
  if (h.marks?.length) return (h.marks[0].from + h.marks[0].to) / 2;
  return h.start + (h.end - h.start) * 0.4;
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
  const [results, setResults] = useState<Made[]>([]);
  const [zipping, setZipping] = useState(false);
  const stopRef = useRef<AbortController | null>(null);
  const seconds = useMemo(() => timelineSeconds(segments), [segments]);
  const shape = SOCIAL_SHAPES[prefs.shape];

  // The highlights in it, in order (each one's focus can be set; each can be its own video).
  const highlights = useMemo(() => {
    const seen = new Set<string>();
    const out: Highlight[] = [];
    for (const s of segments) if (s.type !== 'card' && !seen.has(s.h.id)) (seen.add(s.h.id), out.push(s.h));
    return out;
  }, [segments]);
  const anyFollow = highlights.some(hasFollow);
  const anyKept = highlights.some(hasClipZoom);
  const each = prefs.each && highlights.length > 1;
  const [shown, setShown] = useState<string>('');
  const showH = highlights.find((h) => h.id === shown) || highlights[0];

  // Settings changed after videos were made: they're out of date.
  const clearResults = () =>
    setResults((r) => {
      r.forEach((x) => URL.revokeObjectURL(x.url));
      return [];
    });
  useEffect(clearResults, [prefs, focus, segments]);
  useEffect(() => () => stopRef.current?.abort(), []);

  // ---- The live preview: "Where to look" jumps it to a highlight, paused where he shows ----
  const [jump, setJump] = useState<{ id: string; at: number; n: number } | undefined>();
  const look = (h: Highlight) => {
    setShown(h.id);
    setJump((j) => ({ id: h.id, at: previewMoment(h), n: (j?.n || 0) + 1 }));
  };
  const previewSegs = useMemo(() => (each ? segments.filter((s) => s.type !== 'card') : segments), [each, segments]);

  // ---- Making them ----
  const make = async () => {
    setRunning(true);
    setError('');
    clearResults();
    setProgress({ f: 0, label: 'Starting…' });
    const stop = new AbortController();
    stopRef.current = stop;
    try {
      const song = music && prefs.music ? await music.get() : null;
      // One video, or one per highlight (just its play, slow motion, freeze and replay; no cards).
      const jobs = each
        ? highlights.map((h, i) => ({
            title: h.title || 'Highlight',
            name: `${String(i + 1).padStart(2, '0')} ${h.title || 'Highlight'}`,
            segs: segments.filter((s) => s.type !== 'card' && s.h.id === h.id),
          }))
        : [{ title, name: title, segs: segments }];
      const made: Made[] = [];
      for (let j = 0; j < jobs.length; j++) {
        const job = jobs[j];
        const r = await renderSocialVideo({
          segments: job.segs,
          access,
          settings,
          logo,
          shape: prefs.shape,
          zoom: prefs.zoom,
          followZoom: prefs.followZoom,
          focus,
          titles: prefs.titles,
          sound: { game: prefs.game, music: song },
          transition,
          signal: stop.signal,
          onProgress: (f, label) => setProgress({ f: (j + f) / jobs.length, label: jobs.length > 1 ? `${j + 1} of ${jobs.length}: ${label}` : label }),
        });
        const file = new File([r.blob], socialFileName(job.name, prefs.shape), { type: 'video/mp4' });
        made.push({ ...r, file, url: URL.createObjectURL(file), title: job.title });
        setResults([...made]);
      }
    } catch (err: any) {
      setError(err?.name === 'AbortError' ? 'Stopped.' : err?.message || String(err));
    } finally {
      setRunning(false);
      stopRef.current = null;
    }
  };

  const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const saveAll = async () => {
    if (results.length === 1) return saveBlob(results[0].file, results[0].file.name);
    setZipping(true);
    try {
      const zip = await zipFiles(results.map((r) => ({ name: r.file.name, data: r.file })));
      saveBlob(zip, `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Highlights'} - Instagram videos.zip`);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setZipping(false);
    }
  };
  const share = async (files: File[]) => {
    try {
      await navigator.share({ files, title });
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err?.message || String(err));
    }
  };
  const allFiles = results.map((r) => r.file);
  const shareable = results.length > 0 && !running && canShareFiles(allFiles);
  // An iPad / phone: Share is the way to Instagram and Photos. A computer: Download first.
  const touch = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const sharePrimary = shareable && touch;
  const longest = each ? Math.max(0, ...highlights.map((h) => timelineSeconds(segments.filter((s) => s.type !== 'card' && s.h.id === h.id)))) : seconds;
  const tooLong = prefs.shape === 'reel' && longest > IG_REEL_MAX;
  const storyNote = prefs.shape === 'reel' && !each && seconds > IG_STORY_MAX && !tooLong;
  const showLook = prefs.zoom > 0 || anyFollow || anyKept;
  const chip = (on: boolean) =>
    `flex flex-col items-center gap-1 rounded-xl border p-2 cursor-pointer min-w-0 ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`;
  const pill = (on: boolean) =>
    `h-7 px-2.5 rounded-lg text-xs font-bold border ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`;
  const totalSize = results.reduce((n, r) => n + r.blob.size, 0);

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
            {highlights.length > 1 && (
              <fieldset className="flex flex-col gap-1" disabled={running}>
                <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">Videos</legend>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={pill(!prefs.each)} aria-pressed={!prefs.each} onClick={() => set({ each: false })}>
                    One video ({clock(seconds)})
                  </button>
                  <button type="button" className={pill(prefs.each)} aria-pressed={prefs.each} onClick={() => set({ each: true })}>
                    One per highlight ({highlights.length})
                  </button>
                </div>
                {prefs.each && (
                  <p className="text-[11px] text-slate-500">
                    Each highlight its own video (no title cards), all saved at once. A post can hold up to 20 you swipe through.
                  </p>
                )}
              </fieldset>
            )}

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
                  : 'Zoomed in: each highlight follows its kid (his path, or his circles / arrows); set the others below.'}
                {anyKept ? ' Clips with a zoom kept in the clip editor are never wider than you framed them.' : ''}
              </p>
              {anyFollow && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs mt-1">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Followed kids:</span>
                  {FOLLOW_ZOOMS.map((z) => (
                    <button key={z.v} type="button" className={pill(prefs.followZoom === z.v)} aria-pressed={prefs.followZoom === z.v} onClick={() => set({ followZoom: z.v })}>
                      {z.label}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>

            {showLook && highlights.length > 0 && (
              <fieldset className="flex flex-col gap-1" disabled={running}>
                <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">Where to look</legend>
                <div className="flex flex-col gap-1 max-h-48 overflow-auto pr-1">
                  {highlights.map((h) => {
                    const auto = focus[h.id] === undefined;
                    const followed = hasFollow(h);
                    const zoomed = zoomFor(h, prefs.zoom, prefs.followZoom) > 0 || hasClipZoom(h);
                    return (
                      <div key={h.id} className={`flex items-center gap-2 text-xs rounded-lg px-1.5 py-1 ${showH?.id === h.id ? 'bg-slate-100 dark:bg-slate-800' : ''}`} onClick={() => showH?.id !== h.id && look(h)}>
                        <span className="truncate w-28 sm:w-36 shrink-0 font-bold text-slate-700 dark:text-slate-200" title={h.title}>{h.title || 'Highlight'}</span>
                        {zoomed ? (
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={2}
                            value={Math.round((auto ? focusAt(h, previewMoment(h), 'main').x : focus[h.id]) * 100)}
                            onChange={(e) => {
                              if (showH?.id !== h.id) look(h);
                              setFocus((f) => ({ ...f, [h.id]: Number(e.target.value) / 100 }));
                            }}
                            className="flex-1 min-w-0"
                            aria-label={`Where to look: ${h.title}`}
                          />
                        ) : (
                          <span className="flex-1 text-slate-500">whole field</span>
                        )}
                        {!zoomed ? (
                          <span className="w-20 shrink-0" />
                        ) : auto ? (
                          <span className={`text-[11px] w-20 shrink-0 ${followed ? 'font-bold text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}>
                            {hasClipZoom(h) && !(h.zoom?.follow && followed) ? `kept ${h.zoom!.level}×` : followed ? 'follows him' : h.marks?.length || h.freeze?.spot ? 'his marks' : 'middle'}
                          </span>
                        ) : (
                          <button type="button" className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 w-20 shrink-0 text-left" onClick={() => setFocus((f) => { const n = { ...f }; delete n[h.id]; return n; })}>
                            Auto
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!anyFollow && <p className="text-[11px] text-slate-500">To follow a kid the whole play, open the highlight and use “Follow a kid”.</p>}
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
            {tooLong && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Instagram Reels go up to {clock(IG_REEL_MAX)}; this runs {clock(longest)}. Take some clips out, or make one per highlight.</p>}
            {storyNote && <p className="text-[11px] text-slate-500">Fine for a Reel. A Story shows it 60 seconds at a time.</p>}
          </div>

          <div className="flex flex-col items-center gap-1 min-w-0">
            <SocialPreview
              segments={previewSegs}
              access={access}
              settings={settings}
              logo={logo}
              shape={prefs.shape}
              zoom={prefs.zoom}
              followZoom={prefs.followZoom}
              focus={focus}
              titles={prefs.titles}
              transition={transition}
              sound={prefs.game}
              jump={jump}
              width={prefs.shape === 'reel' ? 190 : 224}
            />
            <span className="text-[11px] text-slate-500 text-center">Preview: plays like the video{music && prefs.music ? ' (no song here)' : ''}</span>
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

        {results.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 p-3">
            {results.length === 1 && !each ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <video src={results[0].url} controls playsInline className="rounded-lg bg-black self-center" style={{ maxHeight: 260, maxWidth: '100%' }} />
                <span className="font-bold text-emerald-800 dark:text-emerald-200 inline-flex items-start gap-1">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> Ready: {clock(results[0].seconds)} · {results[0].width}×{results[0].height} · {(results[0].blob.size / 1e6).toFixed(1)} MB
                </span>
              </div>
            ) : (
              <>
                <span className="font-bold text-emerald-800 dark:text-emerald-200 inline-flex items-start gap-1">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  {running ? `${results.length} of ${highlights.length} ready` : `${results.length} videos ready`} · {(totalSize / 1e6).toFixed(1)} MB
                </span>
                <ul className="flex flex-col gap-1 max-h-56 overflow-auto">
                  {results.map((r) => (
                    <li key={r.url} className="flex items-center gap-2 text-xs min-w-0">
                      <video src={r.url} muted playsInline preload="metadata" className="h-12 rounded bg-black shrink-0" style={{ aspectRatio: `${r.width} / ${r.height}` }} />
                      <span className="truncate font-bold text-slate-800 dark:text-slate-100 min-w-0 flex-1">{r.title}</span>
                      <span className="text-slate-500 tabular-nums shrink-0">{clock(r.seconds)}</span>
                      <button type="button" onClick={() => saveBlob(r.file, r.file.name)} className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600" aria-label={`Download ${r.title}`}>
                        <Download size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!running && results.some((r) => !r.sound) && (prefs.game || prefs.music) && (
              <span className="text-xs text-amber-700 dark:text-amber-300">This device couldn't add the sound, so the video is silent.</span>
            )}
            {!running && (
              <>
                <div className="flex flex-wrap gap-2">
                  {sharePrimary && (
                    <button type="button" onClick={() => void share(allFiles)} className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-1.5">
                      <Share2 size={15} /> {results.length > 1 ? `Share all ${results.length} / Save to Photos` : 'Share / Save to Photos'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void saveAll()}
                    disabled={zipping}
                    className={`h-9 px-4 rounded-lg font-bold inline-flex items-center gap-1.5 disabled:opacity-50 ${sharePrimary ? 'border border-slate-300 dark:border-slate-600' : 'bg-indigo-600 text-white'}`}
                  >
                    {zipping ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {results.length > 1 ? `Download all (${results.length} in one .zip)` : 'Download'}
                  </button>
                  {shareable && !sharePrimary && (
                    <button type="button" onClick={() => void share(allFiles)} className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1.5">
                      <Share2 size={15} /> Share…
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  {sharePrimary
                    ? results.length > 1
                      ? 'Share › Save Videos puts them all in Photos; then in Instagram pick them together (Select multiple) for one post.'
                      : 'Share › Instagram posts it now; Save Video puts it in Photos.'
                    : results.length > 1
                      ? 'The .zip opens on any computer. To post, get the videos to your phone (AirDrop, Google Drive), or make them right on the iPad / phone and tap Share.'
                      : 'Then get it to your phone (AirDrop, Google Drive, a text or email) and post it from Instagram. Or make it right on the iPad / phone and tap Share.'}
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {running ? (
            <button type="button" onClick={() => stopRef.current?.abort()} className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Stop
            </button>
          ) : (
            <button type="button" onClick={() => void make()} disabled={!canMakeVideo() || !segments.length} className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-2 disabled:opacity-40">
              {results.length ? 'Make again' : each ? `Make ${highlights.length} videos` : 'Make the video'}
            </button>
          )}
          <span className="text-[11px] text-slate-500">About as long as the video itself, or a bit longer; the film downloads first when it's on Drive.</span>
        </div>
      </div>
    </div>
  );
};
