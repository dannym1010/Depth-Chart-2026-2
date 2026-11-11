// "Make the video": the slideshow made into one MP4 on this device, then downloaded (a computer) or shared to Photos /
// Instagram (an iPad or phone).
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, Share2, X } from 'lucide-react';
import type { FilmAccess } from '../highlights/filmAccess';
import { clock } from '../highlights/highlightData';
import type { HighlightSettings } from '../highlights/types';
import { canMakeVideo } from '../highlights/socialVideo';
import { QualityPicker } from '../highlights/QualityPicker';
import { qualitySizes, savedQuality, saveQuality, type VideoQuality } from '../highlights/videoQuality';
import { renderSlideshowVideo, type SlideshowResult } from './renderSlideshow';
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
  onClose: () => void;
}

const fileName = (title: string) => `${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Slideshow'}.mp4`;

export const SlideshowVideoPanel: React.FC<Props> = ({ title, slides, options, access, look, logo, songs, onClose }) => {
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
        <QualityPicker value={quality} onChange={setQuality} disabled={running} sizes={qualitySizes(shape.w, shape.h, quality, shape.w > shape.h)[0]} />
        <p className="text-xs text-slate-500">
          At Standard it takes about as long as the slideshow runs, or a bit longer: every photo and clip is read from Google Drive first. Keep this screen open.
        </p>
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
      </div>
    </div>
  );
};
