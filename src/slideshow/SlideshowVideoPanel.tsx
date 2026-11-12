// "Make the video": the slideshow made into one MP4 on this device, then downloaded (a computer) or shared to Photos /
// Instagram (an iPad or phone).
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clipboard, Download, ExternalLink, FolderArchive, Loader2, Share2, Video, X, Youtube } from 'lucide-react';
import type { FilmAccess } from '../highlights/filmAccess';
import { clock } from '../highlights/highlightData';
import type { HighlightSettings } from '../highlights/types';
import { canMakeVideo } from '../highlights/socialVideo';
import { QualityPicker } from '../highlights/QualityPicker';
import { qualitySizes, savedQuality, saveQuality, type VideoQuality } from '../highlights/videoQuality';
import { renderSlideshowVideo, type SlideshowResult } from './renderSlideshow';
import { buildEditorPackage, youtubeChapters } from './editorPackage';
import { SHAPES, slidesSeconds, type Slide } from './slideshowData';
import type { Song } from './songs';
import type { SlideshowOptions } from './types';

interface Props {
  title: string;
  slides: Slide[];
  options: SlideshowOptions;
  access: FilmAccess;
  look: HighlightSettings;
  logo?: HTMLImageElement | null;
  songs: Song[];
  /** How long each song runs (the editor package needs it). */
  songLens?: Record<string, number>;
  onClose: () => void;
}

type Tab = 'video' | 'editor' | 'youtube';
const BASE_KEY = 'slideshowPackageBase';

const fileName = (title: string) => `${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Slideshow'}.mp4`;

export const SlideshowVideoPanel: React.FC<Props> = ({ title, slides, options, access, look, logo, songs, songLens = {}, onClose }) => {
  const [tab, setTab] = useState<Tab>('video');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ f: 0, label: '' });
  const [error, setError] = useState('');
  const [made, setMade] = useState<(SlideshowResult & { file: File; url: string }) | null>(null);
  const stopRef = useRef<AbortController | null>(null);
  const [quality, setQualityState] = useState<VideoQuality>(savedQuality);
  const setQuality = (q: VideoQuality) => {
    setQualityState(q);
    saveQuality(q);
    setMade(null);
  };
  useEffect(() => () => stopRef.current?.abort(), []);
  useEffect(() => () => (made ? URL.revokeObjectURL(made.url) : undefined), [made]);
  const seconds = slidesSeconds(slides);
  const shape = SHAPES[options.shape] || SHAPES['16:9'];
  const missingSongs = options.songs.filter((p) => !songs.some((s) => s.name === p.name)).map((p) => p.name);

  const make = async () => {
    setRunning(true);
    setError('');
    setMade(null);
    setProgress({ f: 0, label: 'Starting…' });
    const stop = new AbortController();
    stopRef.current = stop;
    try {
      const blobs = await Promise.all(options.songs.map((p) => songs.find((s) => s.name === p.name)?.get().catch(() => null) ?? Promise.resolve(null)));
      const r = await renderSlideshowVideo({ slides, options, access, look, logo, songs: blobs, quality, signal: stop.signal, onProgress: (f, label) => setProgress({ f, label }) });
      const file = new File([r.blob], fileName(title), { type: 'video/mp4' });
      setMade({ ...r, file, url: URL.createObjectURL(file) });
    } catch (err: any) {
      setError(err?.name === 'AbortError' ? 'Stopped.' : err?.message || String(err));
    } finally {
      setRunning(false);
      stopRef.current = null;
    }
  };
  const download = () => {
    if (!made) return;
    const a = document.createElement('a');
    a.href = made.url;
    a.download = made.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const canShare = (() => {
    try {
      return Boolean(made) && typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [made!.file] }));
    } catch {
      return false;
    }
  })();
  const touch = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);

  // ---- For another editor: one ZIP with every photo, title, clip and song, and the timeline ----
  const [base, setBaseState] = useState(() => {
    try {
      return localStorage.getItem(BASE_KEY) || '';
    } catch {
      return '';
    }
  });
  const folderName = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Slideshow';
  const mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
  const basePath = (base.trim() || (mac ? '/Users/me/Movies' : 'C:\\Users\\me\\Videos')).replace(/[\\/]+$/, '') + (mac || base.includes('/') ? '/' : '\\') + folderName;
  const setBase = (v: string) => {
    setBaseState(v);
    try {
      localStorage.setItem(BASE_KEY, v);
    } catch {
      /* private window */
    }
  };
  const [withClips, setWithClips] = useState(true);
  const [pkg, setPkg] = useState<{ url: string; size: number; missing: string[] } | null>(null);
  useEffect(() => () => (pkg ? URL.revokeObjectURL(pkg.url) : undefined), [pkg]);
  const makePackage = async () => {
    setRunning(true);
    setError('');
    setPkg(null);
    setProgress({ f: 0, label: 'Starting…' });
    const stop = new AbortController();
    stopRef.current = stop;
    try {
      const list: { name: string; seconds: number; start?: number; end?: number; crossfade?: number; blob: Blob }[] = [];
      for (const p of options.songs) {
        const song = songs.find((s) => s.name === p.name);
        const seconds = songLens[p.name] || 0;
        if (!song || !seconds) continue;
        const blob = await song.get().catch(() => null);
        if (blob) list.push({ name: p.name, seconds, start: p.start, end: p.end, crossfade: p.crossfade, blob });
      }
      const r = await buildEditorPackage({ name: title, slides, options, access, look, logo, songs: list, base: basePath, clips: withClips, signal: stop.signal, onProgress: (f, label) => setProgress({ f, label }) });
      setPkg({ url: URL.createObjectURL(r.zip), size: r.zip.size, missing: r.missing });
    } catch (err: any) {
      setError(err?.name === 'AbortError' ? 'Stopped.' : err?.message || String(err));
    } finally {
      setRunning(false);
      stopRef.current = null;
    }
  };
  const save = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ---- YouTube: the title, a description with chapters, the file ----
  const chapters = youtubeChapters(slides);
  const [ytTitle, setYtTitle] = useState(title);
  const [ytDesc, setYtDesc] = useState(() => [`${title}`, '', chapters.text ? `Chapters:\n${chapters.text}` : '', '', 'Made with the Mahopac football app.'].filter((x, i, a) => x || a[i - 1]).join('\n').trim());
  const [copied, setCopied] = useState('');
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
    }
  };
  const tabBtn = (id: Tab, label: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      disabled={running}
      onClick={() => setTab(id)}
      className={`h-8 rounded-lg text-[11px] font-black inline-flex items-center justify-center gap-1 ${tab === id ? 'bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={() => !running && onClose()}>
      <div
        role="dialog"
        aria-label={`Make the video: ${title}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[94dvh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 flex flex-col gap-3 text-sm"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 dark:text-slate-100">Make the video</h3>
            <p className="text-xs text-slate-500 truncate">
              {title} · {clock(seconds)} · {shape.label} · MP4, made on this device
            </p>
          </div>
          <button type="button" onClick={() => (running ? stopRef.current?.abort() : onClose())} className="ml-auto h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="tablist">
          {tabBtn('video', <><Video size={12} /> Video (MP4)</>)}
          {tabBtn('editor', <><FolderArchive size={12} /> For an editor</>)}
          {tabBtn('youtube', <><Youtube size={12} /> YouTube</>)}
        </div>
        {!canMakeVideo() && (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs p-2">
            This browser can't make videos. Use Chrome or Edge on a computer, or Safari on an up-to-date iPad / iPhone.
          </p>
        )}
        {missingSongs.length > 0 && (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs p-2">
            Not on this device, so left out: {missingSongs.join(', ')}. Add the song file in Music to put it in.
          </p>
        )}
        {tab === 'video' && (
          <>
        <QualityPicker value={quality} onChange={setQuality} disabled={running} sizes={qualitySizes(shape.w, shape.h, quality, shape.w > shape.h)[0]} />
        <p className="text-xs text-slate-500">
          At Standard it takes about as long as the slideshow runs, or a bit longer: every photo and clip is read from Google Drive first. Keep this screen open.
        </p>
          </>
        )}
        {(running || error) && (
          <div className="flex flex-col gap-1">
            {running && (
              <>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${Math.round(progress.f * 100)}%` }} />
                </div>
                <span className="text-xs text-slate-500 truncate">
                  {Math.round(progress.f * 100)}% · {progress.label}
                </span>
              </>
            )}
            {error && <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{error}</span>}
          </div>
        )}
        {tab === 'video' && (
          <>
        {made && (
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 p-3">
            <video src={made.url} controls playsInline className="rounded-lg bg-black self-center" style={{ maxHeight: 260, maxWidth: '100%' }} />
            <span className="font-bold text-emerald-800 dark:text-emerald-200 inline-flex items-start gap-1">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> Ready: {clock(made.seconds)} · {made.width}×{made.height} · {(made.blob.size / 1e6).toFixed(1)} MB
            </span>
            {!made.sound && (options.songs.length > 0 || options.clipSound !== 'off') && <span className="text-xs text-amber-700 dark:text-amber-300">This device couldn't add the sound, so the video is silent.</span>}
            {made.missing.length > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                Couldn't read {made.missing.length} (shown black): {made.missing.slice(0, 5).join(', ')}
                {made.missing.length > 5 ? '…' : ''}
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              {canShare && touch && (
                <button type="button" onClick={() => void navigator.share({ files: [made.file], title }).catch(() => undefined)} className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-1.5">
                  <Share2 size={15} /> Share / Save to Photos
                </button>
              )}
              <button type="button" onClick={download} className={`h-9 px-4 rounded-lg font-bold inline-flex items-center gap-1.5 ${canShare && touch ? 'border border-slate-300 dark:border-slate-600' : 'bg-indigo-600 text-white'}`}>
                <Download size={15} /> Download
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          {running ? (
            <button type="button" onClick={() => stopRef.current?.abort()} className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Stop
            </button>
          ) : (
            <button type="button" onClick={() => void make()} disabled={!canMakeVideo() || !slides.length} className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40">
              {made ? 'Make again' : 'Make the video'}
            </button>
          )}
        </div>
          </>
        )}
        {tab === 'editor' && (
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              One ZIP for DaVinci Resolve, Final Cut or Premiere: every photo (full size), each title card as a picture, each clip as its own short video (slow motion, replay and title in it), the songs, and the timeline laid out just like here, with a marker at each title card. Fades, photo moves and looks are redone in the editor (the READ ME says how).
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-200">Where you'll unzip it on the editing computer</span>
              <input
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder={mac ? '/Users/me/Movies' : 'C:\\Users\\me\\Videos'}
                className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 font-mono min-w-0"
                aria-label="Folder you'll unzip it into"
                disabled={running}
              />
              <span className="text-[11px] text-slate-500">
                The timeline looks for the files in <b className="font-mono break-all">{basePath}</b>. Somewhere else works too: relink the media after importing.
              </span>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={withClips} onChange={(e) => setWithClips(e.target.checked)} disabled={running} /> Make the clips into their own videos (takes the longest; off = photos, titles and songs only)
            </label>
            {pkg && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 p-3">
                <span className="font-bold text-emerald-800 dark:text-emerald-200 inline-flex items-center gap-1">
                  <CheckCircle2 size={15} /> Ready: {(pkg.size / 1e6).toFixed(0)} MB
                </span>
                {pkg.missing.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-300">
                    Couldn't get {pkg.missing.length}: {pkg.missing.slice(0, 5).join(', ')}
                    {pkg.missing.length > 5 ? '…' : ''}
                  </span>
                )}
                <button type="button" onClick={() => save(pkg.url, `${folderName}.zip`)} className="self-start h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-1.5">
                  <Download size={15} /> Download the ZIP
                </button>
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  Unzip it as <b>{folderName}</b> in that folder, then in Resolve: File › Import › Timeline › “Timeline (Final Cut, Resolve).fcpxml”.
                </span>
              </div>
            )}
            {running ? (
              <button type="button" onClick={() => stopRef.current?.abort()} className="self-start h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Stop
              </button>
            ) : (
              <button type="button" onClick={() => void makePackage()} disabled={!slides.length || (withClips && !canMakeVideo() && slides.some((s) => s.kind === 'clip'))} className="self-start h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
                <FolderArchive size={15} /> {pkg ? 'Make it again' : 'Make the editor package'}
              </button>
            )}
          </div>
        )}
        {tab === 'youtube' && (
          <div className="flex flex-col gap-2 text-xs">
            <ol className="list-decimal pl-4 flex flex-col gap-0.5 text-slate-600 dark:text-slate-300">
              <li>{made ? 'The video is made.' : 'Make the video (the Video tab).'}</li>
              <li>Copy the title and description (chapters come from your title cards).</li>
              <li>Open YouTube’s upload page and pick the video file.</li>
            </ol>
            <label className="flex flex-col gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                Title
                <button type="button" onClick={() => void copy(ytTitle, 'title')} className="ml-auto h-7 px-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1">
                  <Clipboard size={12} /> {copied === 'title' ? 'Copied' : 'Copy'}
                </button>
              </span>
              <input value={ytTitle} onChange={(e) => setYtTitle(e.target.value.slice(0, 100))} className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 min-w-0" aria-label="YouTube title" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                Description
                <button type="button" onClick={() => void copy(ytDesc, 'desc')} className="ml-auto h-7 px-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1">
                  <Clipboard size={12} /> {copied === 'desc' ? 'Copied' : 'Copy'}
                </button>
              </span>
              <textarea value={ytDesc} onChange={(e) => setYtDesc(e.target.value.slice(0, 5000))} rows={7} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 p-2 font-mono text-[11px]" aria-label="YouTube description" />
              <span className="text-[11px] text-slate-500">
                {chapters.text
                  ? chapters.works
                    ? 'YouTube will show these as chapters.'
                    : 'YouTube shows chapters when there are 3 or more title cards, each section at least 10 seconds.'
                  : 'Add title cards (game names, “The Playoffs”…) and they become YouTube chapters.'}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {made ? (
                <button type="button" onClick={download} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1.5">
                  <Download size={14} /> Save the video file
                </button>
              ) : (
                <button type="button" onClick={() => setTab('video')} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1.5">
                  <Video size={14} /> Make the video first
                </button>
              )}
              <a href="https://www.youtube.com/upload" target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-rose-600 text-white font-bold inline-flex items-center gap-1.5">
                <Youtube size={15} /> Open YouTube upload <ExternalLink size={12} />
              </a>
            </div>
            <p className="text-[11px] text-slate-500">
              Kids are in it: on YouTube pick <b>Unlisted</b> (only people with the link) or <b>Private</b> unless the families agreed to public.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
