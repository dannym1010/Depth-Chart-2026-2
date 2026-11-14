// Export a reel for DaVinci Resolve (or Premiere, Final Cut, any editor) into the local library:
//   <Highlights folder>\<season>\<reel>\  the timeline file, Graphics\ (title cards, titles, spotlights, freeze
//   frames as PNG), Clips\ (only when copies are asked for), the cut list, YouTube chapters and a read-me.
// The film is linked where it is (best quality, no copies), copied whole, or cut to trimmed H.264 copies that every
// editor opens (free Resolve included).
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FolderOpen, Loader2, X } from 'lucide-react';
import { canCut, cutClip } from './cutter';
import type { FilmAccess } from './filmAccess';
import { canvasPng, drawCard, drawLowerThird, drawSpot, frameGrab } from './graphics';
import { hasClipZoom, zoomRect } from './clipZoom';
import { drawSpotIn } from './socialVideo';
import { ClipPicture } from './ClipPicture';
import { chapters, clock, playLabel, timelineSeconds, type Segment } from './highlightData';
import { angleWindow, buildPlan, frameSize, joinPath, readMe, toCsv, toEdl, toFcpxml, toOtio, toXmeml, withAngles, type ExportPlan } from './exporters';
import { clipLength, lineUp } from './filmAccess';
import { savedOffset } from '../filmroom/dualView';
import { filmServerRoot } from '../filmroom/filmSources';
import { blobReader, readSourceTimecode } from './sourceTimecode';
import type { FilmGameShared } from '../filmroom/types';
import { canWriteFolders, cleanName, DB_FILE, dbJson, libraryFolder, loadPaths, pickLibrary, savePaths, subfolder, writeFile } from './localLibrary';
import type { ExportFormat, Highlight, HighlightsData, HighlightSettings } from './types';

interface Props {
  reelName: string;
  /** The whole reel as a timeline. */
  segments: Segment[];
  /** The reel's clips, in the order it plays (each one can be left out of the export). */
  clips?: Highlight[];
  /** The reel as a timeline with only these clips (its cards made again for them: game chapters, the countdown). */
  segmentsFor?: (keep: Set<string>) => Segment[];
  /** The season's plays and each game's Film Room line-up: which clip on another camera is the same play. */
  plays?: { id: string; playNumber: number; gameId?: string }[];
  loadShared?: (gameKey: string) => Promise<Partial<FilmGameShared>>;
  access: FilmAccess;
  settings: HighlightSettings;
  logo?: HTMLImageElement | null;
  data: HighlightsData;
  teamName: string;
  season: string;
  onClose: () => void;
}

const FORMATS: { id: ExportFormat; label: string; ext: string; note: string }[] = [
  { id: 'fcpxml', label: 'FCPXML', ext: 'fcpxml', note: 'DaVinci Resolve, Final Cut Pro' },
  { id: 'xmeml', label: 'FCP7 XML', ext: 'xml', note: 'Premiere Pro, DaVinci Resolve' },
  { id: 'edl', label: 'EDL', ext: 'edl', note: 'any editor: cuts only, no pictures' },
  { id: 'otio', label: 'OTIO', ext: 'otio', note: 'Resolve 18 and newer' },
];

type FilmMode = 'link' | 'copy' | 'trim';

/** The film files a timeline uses, once each, with the stretch of each that's used (for trimmed copies). */
function filesOf(segments: Segment[]) {
  const m = new Map<string, { h: Highlight; view: string; clip: string; from: number; to: number }>();
  for (const s of segments) {
    if (s.type !== 'clip') continue;
    const k = `${s.h.game.key}|${s.view}|${s.clip}`;
    const x = m.get(k);
    if (x) {
      x.from = Math.min(x.from, s.from);
      x.to = Math.max(x.to, s.to);
    } else m.set(k, { h: s.h, view: s.view, clip: s.clip, from: s.from, to: s.to });
  }
  return m;
}

export const ExportPanel: React.FC<Props> = ({ reelName: fullName, segments: allSegments, clips = [], segmentsFor, plays = [], loadShared, access, settings, logo, data, teamName, season, onClose }) => {
  // A play filmed by more than one camera (Main and Field): both go in.
  const [bothCams, setBothCams] = useState(true);
  // The clips to export: every one to start; untick the ones to leave out.
  const [keep, setKeep] = useState<Set<string>>(() => new Set(clips.map((h) => h.id)));
  const some = segmentsFor && clips.length > 0 && keep.size < clips.length;
  const segments = useMemo(() => (some && segmentsFor ? segmentsFor(keep) : allSegments), [some, segmentsFor, keep, allSegments]);
  // Some of the clips go to a folder of their own (not over the whole reel's export).
  const reelName = some ? `${fullName} - ${keep.size} clip${keep.size === 1 ? '' : 's'}` : fullName;
  const toggle = (id: string) =>
    setKeep((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [paths, setPaths] = useState(loadPaths);
  const [format, setFormat] = useState<ExportFormat>(settings.exportFormat);
  const [mode, setMode] = useState<FilmMode>('link');
  const [handles, setHandles] = useState(1);
  const [copySize, setCopySize] = useState<0 | 2160 | 1080 | 720>(1080);
  const [libName, setLibName] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const say = (line: string) => setLog((l) => [...l.slice(-60), line]);

  useEffect(() => {
    void libraryFolder().then(({ handle }) => handle && setLibName(handle.name));
  }, []);
  // A path pasted from File Explorer's "Copy as path" comes in quotes: they'd be part of every file's address.
  const cleanPath = (v: string) => v.trim().replace(/^["']+|["']+$/g, '').trim();
  // As typed (tidied when the box is left, and at the export: tidying each keystroke would eat the space being typed).
  const setPath = (k: 'film' | 'library', v: string) => {
    setPaths((cur) => {
      const next = { ...cur, [k]: v };
      savePaths(next);
      return next;
    });
  };
  // The film folder the film here comes from (its name: the typed path should end with it), or the team film server's.
  const [filmRoot, setFilmRoot] = useState<{ name: string; server: boolean; local: boolean } | null>(null);
  const [rootFromServer, setRootFromServer] = useState(false);
  useEffect(() => {
    const first = clips[0]?.game;
    if (!first) return;
    let off = false;
    void (async () => {
      const film = await access.openGame(first).catch(() => null);
      if (off || !film) return;
      setFilmRoot({ name: film.root || '', server: Boolean(film.server), local: film.from === 'local' });
      // The film server knows the folder's real path on its computer: no typing (when it runs on this one).
      if (film.server && !loadPaths().film) {
        const root = await filmServerRoot();
        if (!off && root) {
          setPath('film', root);
          setRootFromServer(true);
        }
      }
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** The typed film folder ends with the folder the film here comes from (case and slashes aside). */
  const lastFolder = (p: string) => cleanPath(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop()?.toLowerCase() || '';
  const filmPathOk = !filmRoot?.name || filmRoot.server || !filmRoot.local || !paths.film.trim() || lastFolder(paths.film) === filmRoot.name.toLowerCase();
  // Both folders known (this computer remembers them): a line saying so, with Change.
  const [editPaths, setEditPaths] = useState(() => {
    const p = loadPaths();
    return !(p.film && p.library);
  });
  // A first guess for the highlights folder's place: next to the film folder.
  useEffect(() => {
    if (!paths.library && libName && paths.film) {
      const parent = cleanPath(paths.film).replace(/[\\/][^\\/]*[\\/]?$/, '');
      if (parent && parent !== cleanPath(paths.film)) setPath('library', joinPath(parent, libName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libName, paths.film]);

  const clipsUsed = useMemo(() => filesOf(segments), [segments]);

  /** Each play's clip on the other camera(s), lined up the way the Film Room lines them up. By highlight id. */
  const otherAngles = async (segs: Segment[]) => {
    const out = new Map<string, Segment[]>();
    const seen = new Set<string>();
    for (const s of segs) {
      if (s.type !== 'clip' || s.part !== 'main' || seen.has(s.h.id)) continue;
      const h = s.h;
      seen.add(h.id);
      if (h.kind !== 'play' || !h.playId) continue;
      const film = await access.openGame(h.game).catch(() => null);
      const views = (film?.views || []).filter((v) => v && v !== h.view);
      if (!film || !views.length) continue;
      const shared: Partial<FilmGameShared> = loadShared ? await loadShared(h.game.key).catch(() => ({})) : {};
      const gamePlays = plays.filter((p) => p.gameId === h.game.gameId);
      for (const view of views) {
        // Its replay already comes from that camera.
        if (h.replay && h.replay.view === view) continue;
        const c = lineUp(film, view, gamePlays, shared).clipOf.get(h.playId);
        if (!c) continue;
        const offset = savedOffset(shared.viewShift, h.playId, h.view, view);
        let len = c.durationSec;
        if (!len && offset === undefined) {
          const u = await access.url(h.game, view, c.name).catch(() => null);
          if (u) {
            len = await clipLength(u.url);
            u.release();
          }
        }
        const w = angleWindow(h, offset, len);
        if (!w) continue;
        out.set(h.id, [...(out.get(h.id) || []), { type: 'clip', h, view, clip: c.name, from: w.from, to: w.to, speed: 1, part: 'angle' }]);
      }
    }
    return out;
  };

  const ready = Boolean(paths.library.trim()) && (mode !== 'link' || Boolean(paths.film.trim())) && (!clips.length || keep.size > 0);
  const fmt = FORMATS.find((f) => f.id === format)!;
  const zoomed = useMemo(() => new Set(segments.filter((s) => s.type !== 'card' && hasClipZoom(s.h)).map((s) => (s.type === 'card' ? '' : s.h.id))).size, [segments]);

  const run = async () => {
    setRunning(true);
    setError('');
    setDone('');
    setLog([]);
    try {
      let { handle, ok } = await libraryFolder(true);
      if (!handle) {
        handle = await pickLibrary();
        ok = Boolean(handle);
        if (handle) setLibName(handle.name);
      }
      if (!handle || !ok) throw new Error('Pick the highlights folder first (Chrome or Edge on a computer).');
      const reelDir = await subfolder(handle, [season, reelName]);
      const gDir = await subfolder(reelDir, ['Graphics']);
      const reelPath = joinPath(cleanPath(paths.library), season, cleanName(reelName));
      const { width, height } = frameSize(settings);

      // Both cameras: each play's other camera goes right after it (after its replay).
      let all = segments;
      if (bothCams) {
        say('Looking for each play on the other camera…');
        const angles = await otherAngles(segments);
        all = withAngles(segments, angles);
        say(angles.size ? `${angles.size} play${angles.size === 1 ? '' : 's'} from both cameras.` : 'No play here has a second camera.');
      }
      const used = filesOf(all);

      // Where each clip is (or its copy), how the copy shifts its times, and where the file's own clock starts.
      const where = new Map<string, { path: string; base: number; durationSec?: number; tc?: number }>();
      const gameShort = (name: string) => cleanName(name.replace(/^\s*(pre-?season\s+)?week\s*(\d+)\s*[-–:]?\s*/i, 'Wk$2 ').slice(0, 24));
      // A camera file's own clock (its timecode: the time of day on phones, GoPros, DJIs). DaVinci Resolve finds a
      // clip's moments by it; a timeline that says the file starts at 0:00 finds nothing ("media offline").
      const clockOf = async (game: Highlight['game'], view: string, clip: string, file?: Blob) => {
        try {
          const r = file ? blobReader(file) : access.reader ? await access.reader(game, view, clip) : blobReader(await access.file(game, view, clip));
          return (await readSourceTimecode(r))?.seconds || 0;
        } catch {
          return 0;
        }
      };
      let clocks = 0;
      let k = 0;
      if (mode === 'link') say("Reading each clip's camera clock…");
      for (const [key, c] of used) {
        k += 1;
        // The highlight's own clip (its length is known); another camera's says which camera in its copy's name.
        const own = c.view === c.h.view && c.clip === c.h.clip;
        const cam = !own && c.view ? `${c.view} ` : '';
        if (mode === 'link') {
          const film = await access.openGame(c.h.game);
          // The camera's own folder ("Main", "Field") whenever the clips are in one (not the game folder itself:
          // '' or "Film"), one camera or several. It used to be left out when a game had only one camera folder.
          const viewFolder = c.view && c.view !== 'Film' ? c.view : '';
          const clipInfo = film.lists[Math.max(0, film.views.indexOf(c.view))]?.find((x) => x.name === c.clip);
          const tc = await clockOf(c.h.game, c.view, c.clip);
          if (tc) clocks++;
          where.set(key, { path: joinPath(cleanPath(paths.film), ...film.path, viewFolder, c.clip), base: 0, durationSec: clipInfo?.durationSec || (own ? c.h.clipLen : undefined), tc });
          continue;
        }
        const cDir = await subfolder(reelDir, ['Clips']);
        say(`${k}/${used.size} ${mode === 'trim' ? 'Cutting' : 'Copying'} ${cam}${c.clip} (${c.h.game.name})…`);
        const file = await access.file(c.h.game, c.view, c.clip);
        if (mode === 'copy') {
          const name = `${gameShort(c.h.game.name)} ${cam}${c.clip}`;
          await writeFile(cDir, name, file);
          // A copy keeps the camera's clock.
          const tc = await clockOf(c.h.game, c.view, c.clip, file);
          if (tc) clocks++;
          where.set(key, { path: joinPath(reelPath, 'Clips', cleanName(name)), base: 0, durationSec: own ? c.h.clipLen : undefined, tc });
        } else {
          const base = Math.max(0, c.from - handles);
          const name = `${gameShort(c.h.game.name)} ${cam}${c.clip.replace(/\.[^.]+$/, '')} ${base.toFixed(1)}s.mp4`;
          const out = await cutClip(file, { start: base, end: c.to + handles, height: copySize, onProgress: (p) => setLog((l) => [...l.slice(0, -1), `${l[l.length - 1]?.replace(/ \d+%$/, '')} ${Math.round(p * 100)}%`]) });
          await writeFile(cDir, name, out);
          where.set(key, { path: joinPath(reelPath, 'Clips', cleanName(name)), base, durationSec: c.to + handles - base });
        }
      }
      if (mode !== 'trim') say(clocks ? `${clocks} of ${used.size} clips have a camera clock (timecode): the timeline uses it.` : 'No camera clock (timecode) in these clips.');
      const shifted: Segment[] = all.map((s) => {
        if (s.type !== 'clip') return s;
        const w = where.get(`${s.h.game.key}|${s.view}|${s.clip}`);
        return w && w.base ? { ...s, from: s.from - w.base, to: s.to - w.base } : s;
      });
      const plan: ExportPlan = buildPlan({
        name: reelName,
        segments: shifted,
        settings,
        mediaOf: (h, view, clip) => {
          const w = where.get(`${h.game.key}|${view}|${clip}`);
          return { path: w?.path || clip, durationSec: w?.durationSec, base: w?.base || 0, tc: w?.tc || 0 };
        },
        graphicsDir: joinPath(reelPath, 'Graphics'),
      });

      // The pictures.
      let g = 0;
      for (const gr of plan.graphics) {
        g += 1;
        if (g === 1 || g % 5 === 0) say(`Pictures ${g}/${plan.graphics.length}…`);
        let png: Blob;
        const spec = gr.spec;
        if (spec.kind === 'card') png = await canvasPng(width, height, (ctx) => drawCard(ctx, width, height, spec.card, settings, logo));
        else if (spec.kind === 'lower') png = await canvasPng(width, height, (ctx) => drawLowerThird(ctx, width, height, spec.overlay, settings, logo));
        else if (spec.kind === 'spot')
          // On a zoomed clip the spotlight goes where the zoomed picture puts him (film taken as 16:9).
          png = await canvasPng(width, height, (ctx) => (spec.cam ? drawSpotIn(ctx, width, height, zoomRect(16, 9, width, height, spec.cam), spec.spot, settings) : drawSpot(ctx, width, height, spec.spot, settings)));
        else png = await frameGrab(await access.file(spec.h.game, spec.view, spec.clip), spec.at, width, height, spec.cam);
        await writeFile(gDir, gr.file, png);
      }

      const base = cleanName(reelName);
      const timeline = format === 'fcpxml' ? toFcpxml(plan) : format === 'xmeml' ? toXmeml(plan) : format === 'edl' ? toEdl(plan) : toOtio(plan);
      const timelineFile = `${base}.${fmt.ext}`;
      await writeFile(reelDir, timelineFile, timeline);
      await writeFile(reelDir, `${base} - cut list.csv`, toCsv(plan));
      await writeFile(reelDir, `${base} - YouTube chapters.txt`, chapters(shifted));
      await writeFile(reelDir, 'Read me - DaVinci Resolve.txt', readMe(plan, timelineFile));
      // A fresh copy of the highlight database in the library.
      await writeFile(handle, DB_FILE, dbJson(data, teamName, season));
      say('Done.');
      setDone(joinPath(reelPath, timelineFile));
    } catch (err: any) {
      if (err?.name === 'AbortError') setError('Stopped.');
      else setError(err?.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  const radio = (on: boolean) => `flex items-start gap-2 rounded-lg border p-2 cursor-pointer ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`;
  const input = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm min-w-0';

  return (
    <div className="fixed inset-0 z-[75] bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={() => !running && onClose()}>
      <div role="dialog" aria-label={`Export ${fullName}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[94dvh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 flex flex-col gap-3 text-sm">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 dark:text-slate-100">Export “{fullName}” for an editor</h3>
            <p className="text-xs text-slate-500">
              {clips.length ? `${keep.size} of ${clips.length} clip${clips.length === 1 ? '' : 's'} · ${clock(timelineSeconds(segments))}` : `${clipsUsed.size} clip${clipsUsed.size === 1 ? '' : 's'}`} · opens in DaVinci Resolve already cut, in order, with
              titles and markers.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={running} className="ml-auto h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {!canWriteFolders() && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-100 text-sm p-3 flex flex-col gap-2">
            <b>Exporting for DaVinci Resolve needs a computer.</b>
            <span className="text-xs">
              It writes the timeline and pictures into a folder next to the film, which only Chrome or Edge on a computer can do (not an iPad or a phone). Open
              this reel there and Export it.
            </span>
            <span className="text-xs">
              On this {/iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document ? 'iPad' : 'device'}: <b>Instagram video</b> makes the reel into one MP4 right here, to save or share
              anywhere.
            </span>
            <button type="button" onClick={onClose} className="self-start h-9 px-4 rounded-lg bg-amber-500 text-slate-900 font-bold">
              OK
            </button>
          </div>
        )}

        {canWriteFolders() && (
        <>
        {clips.length > 0 && (
          <fieldset className="flex flex-col gap-1.5" disabled={running}>
            <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">Clips to export</legend>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                <b className="tabular-nums">{keep.size}</b> of {clips.length} picked
              </span>
              <button type="button" onClick={() => setKeep(new Set(clips.map((h) => h.id)))} disabled={keep.size === clips.length} className="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-bold disabled:opacity-40">
                All
              </button>
              <button type="button" onClick={() => setKeep(new Set())} disabled={!keep.size} className="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-bold disabled:opacity-40">
                None
              </button>
              {some && <span className="text-[11px] text-slate-500 basis-full sm:basis-auto sm:ml-auto">Saved as “{reelName}” (the whole reel's export stays as it is).</span>}
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 max-h-60 overflow-auto" aria-label="Clips to export">
              {clips.map((h, i) => (
                <li key={h.id}>
                  <label className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${keep.has(h.id) ? '' : 'opacity-50'}`}>
                    <input type="checkbox" checked={keep.has(h.id)} onChange={() => toggle(h.id)} aria-label={`Export ${h.title}`} />
                    <span className="w-5 text-right text-[11px] tabular-nums text-slate-400">{i + 1}</span>
                    <ClipPicture h={h} access={access} className="h-8 w-14 rounded" iconSize={12} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{h.title}</span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {[h.game.name, playLabel(h)].filter(Boolean).join(' · ')} · {(h.end - h.start).toFixed(1)} s{h.rating ? ` · ${'★'.repeat(h.rating)}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">Where the folders are</legend>
          {!editPaths && filmPathOk && paths.film && paths.library ? (
            // Known on this computer: said, not asked again.
            <div className="flex items-start gap-2 text-xs">
              <span className="min-w-0 flex-1 text-slate-600 dark:text-slate-300">
                Film: <b className="break-all text-slate-800 dark:text-slate-100">{paths.film}</b>
                <br />
                Highlights: <b className="break-all text-slate-800 dark:text-slate-100">{paths.library}</b>
              </span>
              <button type="button" onClick={() => setEditPaths(true)} disabled={running} className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold shrink-0">
                Change
              </button>
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-600 dark:text-slate-300">The film folder on this computer, the way the editor sees it</span>
                <input
                  className={input}
                  value={paths.film}
                  onChange={(e) => setPath('film', e.target.value)}
                  onBlur={(e) => setPath('film', cleanPath(e.target.value))}
                  placeholder={`J:\\${filmRoot?.local && !filmRoot.server && filmRoot.name ? filmRoot.name : 'Mahopac Film'}`}
                  aria-label="The film folder"
                />
              </label>
              {rootFromServer ? (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 -mt-1">Filled in by the team film server (where its film folder is on that computer).</p>
              ) : filmRoot?.name && filmRoot.local && !filmRoot.server && paths.film.trim() ? (
                filmPathOk ? (
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 -mt-1">✓ Ends with “{filmRoot.name}”, the folder the film here comes from.</p>
                ) : (
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 -mt-1" role="alert">
                    The film here comes from a folder called “{filmRoot.name}”: this should be where that folder is, ending in \{filmRoot.name} (like J:\{filmRoot.name}).
                  </p>
                )
              ) : null}
              <div className="flex flex-wrap items-end gap-2 text-xs">
                <label className="flex flex-col gap-1 flex-1 min-w-48">
                  <span className="text-slate-600 dark:text-slate-300">The highlights folder (the local library){libName ? `: “${libName}” picked` : ''}</span>
                  <input
                    className={input}
                    value={paths.library}
                    onChange={(e) => setPath('library', e.target.value)}
                    onBlur={(e) => setPath('library', cleanPath(e.target.value))}
                    placeholder={`J:\\${libName || 'Mahopac Highlights'}`}
                    aria-label="The highlights folder"
                  />
                </label>
                <button
                  type="button"
                  disabled={!canWriteFolders() || running}
                  onClick={async () => {
                    const h = await pickLibrary();
                    if (h) setLibName(h.name);
                  }}
                  className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <FolderOpen size={13} /> {libName ? 'Pick another' : 'Pick the folder'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                A browser can't see where a folder is (its drive letter), so this computer asks once and remembers. Quickest: in File Explorer, click the folder, press
                Ctrl+Shift+C (Copy as path) and paste it here. The highlights folder is filled in when it sits next to the film folder.
              </p>
            </>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">Timeline file</legend>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {FORMATS.map((f) => (
              <label key={f.id} className={radio(format === f.id)}>
                <input type="radio" name="fmt" checked={format === f.id} onChange={() => setFormat(f.id)} className="mt-1" />
                <span>
                  <b>{f.label}</b>
                  <span className="block text-[11px] text-slate-500">{f.note}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">A cut list (CSV), YouTube chapters and a read-me are always written too.</p>
          {zoomed > 0 && (
            <p className={`text-[11px] ${format === 'fcpxml' ? 'text-slate-500' : 'font-bold text-amber-700 dark:text-amber-300'}`}>
              {format === 'fcpxml'
                ? `${zoomed} zoomed clip${zoomed === 1 ? '' : 's'}: the zoom comes into Resolve as each clip's Zoom and Position (keyframed where it follows a kid).`
                : `${zoomed} clip${zoomed === 1 ? ' is' : 's are'} zoomed: only FCPXML carries the zoom; this format shows ${zoomed === 1 ? 'it' : 'them'} whole.`}
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="font-black text-slate-800 dark:text-slate-100 mb-1">The film</legend>
          <label className={radio(mode === 'link')}>
            <input type="radio" name="mode" checked={mode === 'link'} onChange={() => setMode('link')} className="mt-1" />
            <span>
              <b>Link the original film</b> (best quality, no copies)
              <span className="block text-[11px] text-slate-500">Resolve cuts the film where it is. Works on this computer.</span>
            </span>
          </label>
          <label className={radio(mode === 'copy')}>
            <input type="radio" name="mode" checked={mode === 'copy'} onChange={() => setMode('copy')} className="mt-1" />
            <span>
              <b>Copy the original clips</b> into the reel's folder
              <span className="block text-[11px] text-slate-500">A folder you can hand to anyone who edits.</span>
            </span>
          </label>
          <label className={radio(mode === 'trim')}>
            <input type="radio" name="mode" checked={mode === 'trim'} onChange={() => setMode('trim')} className="mt-1" disabled={!canCut()} />
            <span>
              <b>Trimmed copies</b> (plain H.264, made on this computer)
              <span className="block text-[11px] text-slate-500">
                Only the parts used, plus extra on both ends. Opens in free DaVinci Resolve even when the camera's 10-bit files don't.
                {!canCut() && ' This browser can\'t make them (use Chrome or Edge).'}
              </span>
              {mode === 'trim' && (
                <span className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                  Extra
                  <select value={handles} onChange={(e) => setHandles(Number(e.target.value))} className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1">
                    {[0, 0.5, 1, 2, 3].map((x) => (
                      <option key={x} value={x}>{x} s</option>
                    ))}
                  </select>
                  Size
                  <select value={copySize} onChange={(e) => setCopySize(Number(e.target.value) as 0 | 2160 | 1080 | 720)} className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1">
                    <option value={0}>As filmed</option>
                    <option value={2160}>4K</option>
                    <option value={1080}>1080p</option>
                    <option value={720}>720p</option>
                  </select>
                </span>
              )}
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2 cursor-pointer">
            <input type="checkbox" checked={bothCams} onChange={(e) => setBothCams(e.target.checked)} className="mt-1" disabled={running} />
            <span>
              <b>Both cameras</b>
              <span className="block text-[11px] text-slate-500">
                A play filmed by Main and Field goes in from both: the other camera's clip comes right after it on the timeline
                {mode === 'link' ? '' : ' and goes into the Clips folder'}, lined up the way the Film Room lines them up.
              </span>
            </span>
          </label>
        </fieldset>

        {(log.length > 0 || error || done) && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 text-xs font-mono max-h-40 overflow-auto" role="log">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            {error && <div className="text-rose-600 dark:text-rose-400 font-sans font-bold">{error}</div>}
            {done && (
              <div className="font-sans text-emerald-700 dark:text-emerald-300 font-bold flex items-start gap-1 mt-1">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                <span>
                  Saved. In Resolve: File › Import › Timeline, then pick <span className="break-all">{done}</span>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={!ready || running || !canWriteFolders()}
            className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-2 disabled:opacity-40"
          >
            {running && <Loader2 size={14} className="animate-spin" />}
            {running ? 'Exporting…' : `Export ${fmt.label}`}
          </button>
          {!ready && (
            <span className="text-xs text-slate-500">
              {clips.length && !keep.size ? 'Pick at least one clip.' : `Type where the ${!paths.library.trim() ? 'highlights folder' : 'film folder'} is first.`}
            </span>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};
