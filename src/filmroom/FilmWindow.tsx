// The film window: a floating video player for the snaps of one play (or one play type), so a coach
// can watch them while working in Their plays or the play builder. Drag it by its title, make it
// bigger or smaller, tuck it away to just its title bar, or close it. It uses the same film the Film
// Room does (the folder or Google Drive link for that scouting film), the same player, and the same
// shared drawings and notes.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Film, Maximize2, Minimize2, Minus, Plus, RefreshCw, X } from 'lucide-react';
import { bundleFromSaved } from '../hudlScout/scoutBundle';
import type { Play } from '../hudlScout/types/football';
import { FilmPlayer, type PlayerApi } from './FilmPlayer';
import { LinkFilmDialog } from './LinkFilmDialog';
import { matchClipsToPlays } from './clipMatching';
import { playTitle } from './playText';
import { filmGameKey } from './sharedMerge';
import type { FilmGame, FilmGameShared, FilmMark, FilmNote } from './types';
import { useClipUrl, useGameFilm } from './useGameFilm';
import { useSharedGame } from './useSharedGame';
import {
  closeFilmWindow,
  filmWindowAutoOpen,
  setFilmWindowAutoOpen,
  useFilmWindowRequest,
  type FilmWindowRequest,
} from './filmWindowStore';

interface HostProps {
  teamId: string;
  teamName: string;
  currentWeek: string;
  opponentName?: string;
  /** This week's opponent film breakdown (Hudl Scout). */
  opponentScout?: unknown;
  authorName: string;
}

/** Draws the film window when something asked for it. One of these lives in App. */
export const FilmWindowHost: React.FC<HostProps> = (props) => {
  const request = useFilmWindowRequest();
  if (!request) return null;
  return <FilmWindow key={`${props.teamId}:${request.gameId}`} {...props} request={request} />;
};

const SIZES = { s: 470, l: 700 } as const;
const POS_KEY = 'footballFilmWindowPos';
const SIZE_KEY = 'footballFilmWindowSize';
const newId = () => `fn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* kept for this visit only */
  }
};

function useIsPhone() {
  const query = '(max-width: 639px)';
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return match;
}

const FilmWindow: React.FC<HostProps & { request: FilmWindowRequest }> = ({
  teamId, teamName, currentWeek, opponentName, opponentScout, authorName, request,
}) => {
  const bundle = useMemo(() => bundleFromSaved(opponentScout, opponentName || 'Opponent'), [opponentScout, opponentName]);
  const gameInfo = bundle.games.find((g) => g.id === request.gameId);
  const game: FilmGame = useMemo(
    () => ({
      key: filmGameKey('opponent', request.gameId, currentWeek),
      source: 'opponent',
      gameId: request.gameId,
      name: gameInfo?.name || 'Scouting film',
      week: currentWeek,
    }),
    [request.gameId, currentWeek, gameInfo?.name]
  );

  // Every play of this film (the clips go with them in order), and the ones being watched.
  const gamePlays = useMemo(() => {
    const onlyGame = bundle.games.length === 1;
    return bundle.plays
      .filter((p) => p.gameId === request.gameId || (onlyGame && !p.gameId))
      .sort((a, b) => (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0));
  }, [bundle, request.gameId]);
  const idsKey = request.playIds.join('|');
  const watch = useMemo(() => {
    const byId = new Map(gamePlays.map((p) => [p.id, p]));
    return request.playIds.map((id) => byId.get(id)).filter(Boolean) as Play[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePlays, idsKey]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    const at = request.startId ? watch.findIndex((p) => p.id === request.startId) : 0;
    setIndex(Math.max(0, at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, request.startId, watch.length]);
  const play: Play | undefined = watch[Math.min(index, Math.max(0, watch.length - 1))];
  const prev = index > 0 ? watch[index - 1] : undefined;
  const next = watch[index + 1];

  // Film: the same folder / Google Drive link the Film Room uses for this film.
  const { shared, update } = useSharedGame(teamId, game.key);
  const setDrive = useCallback(
    (drive: FilmGameShared['drive']) => update((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })),
    [update]
  );
  const root = useSharedGame('program', 'root');
  const updateRoot = root.update;
  const setRootDrive = useCallback(
    (drive: FilmGameShared['drive']) => updateRoot((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })),
    [updateRoot]
  );
  const setPick = useCallback((name: string) => update((s) => ({ ...s, folderPick: { name, editedAt: Date.now() } })), [update]);
  const { film, chooseFolder, reconnect, pickFiles, linkDrive, signInToDrive, localFiles, sources, setSourcePref, setView, choose } = useGameFilm({
    game,
    teamId,
    teamName,
    opponentName,
    drive: shared.drive,
    setDrive,
    rootDrive: root.shared.drive,
    setRootDrive,
    pick: shared.folderPick?.name,
    setPick,
  });

  const clips = film.status === 'ready' ? film.clips : [];
  const clipFor = useMemo(() => matchClipsToPlays(clips, gamePlays), [clips, gamePlays]);
  const clipOf = (p?: Play) => (p && clipFor.has(p.id) ? clips[clipFor.get(p.id)!] : undefined);
  const clip = clipOf(play);
  const clipUrl = useClipUrl(clip, localFiles, clipOf(next));

  const apiRef = useRef<PlayerApi | null>(null);
  const resumeAt = useRef(0);
  const [linkOpen, setLinkOpen] = useState(false);

  // Drawings and notes are the Film Room's own (shared with the staff).
  const marks: FilmMark[] = (play && shared.drawings[play.id]?.marks) || [];
  const saveMarks = (m: FilmMark[]) => {
    if (!play) return;
    update((s) => ({ ...s, drawings: { ...s.drawings, [play.id]: { marks: m, editedAt: Date.now() } } }));
  };
  const addNote = (text: string, t: number) => {
    if (!play) return;
    const now = Date.now();
    const note: FilmNote = { id: newId(), playId: play.id, t: Math.round(t * 10) / 10, text, author: authorName, createdAt: now, editedAt: now };
    update((s) => ({ ...s, notes: [...s.notes, note] }));
  };

  // The window: where it is, how big, tucked away or not.
  const isPhone = useIsPhone();
  const [size, setSize] = useState<'s' | 'l'>(() => (read<string>(SIZE_KEY, 's') === 'l' ? 'l' : 's'));
  const [mini, setMini] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => read<{ x: number; y: number } | null>(POS_KEY, null));
  const [auto, setAuto] = useState(filmWindowAutoOpen);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const width = isPhone ? 0 : Math.min(SIZES[size], (typeof window === 'undefined' ? 1200 : window.innerWidth) - 16);
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.max(8, Math.min(p.x, window.innerWidth - Math.min(width, 200) - 8)),
    y: Math.max(64, Math.min(p.y, window.innerHeight - 48)),
  });
  const onTitleDown = (e: React.PointerEvent) => {
    if (isPhone || (e.target as HTMLElement).closest('button')) return;
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragging.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top };
  };
  const onTitleMove = (e: React.PointerEvent) => {
    const d = dragging.current;
    if (d) setPos(clamp({ x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
  };
  const onTitleUp = () => {
    if (!dragging.current) return;
    dragging.current = null;
    if (pos) write(POS_KEY, pos);
  };
  // Keep it on screen when the window is resized.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);
  const changeSize = (s: 's' | 'l') => {
    setSize(s);
    write(SIZE_KEY, s);
  };

  // Keyboard shortcuts (space, arrows...) only while the coach is working in the window.
  const [focused, setFocused] = useState(true);
  useEffect(() => {
    const on = (e: PointerEvent) => setFocused(Boolean(boxRef.current?.contains(e.target as Node)));
    document.addEventListener('pointerdown', on, true);
    return () => document.removeEventListener('pointerdown', on, true);
  }, []);

  const videoMax = isPhone ? 'min(42dvh, 56vw)' : `${Math.round((width * 9) / 16)}px`;

  const placeholder = (() => {
    if (film.status === 'loading') return <span>Opening {film.label}…</span>;
    if (film.status === 'error') return <span className="text-rose-300">{film.message}</span>;
    if (film.status === 'reconnect')
      return (
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <button onClick={reconnect} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-2">
            <RefreshCw size={14} /> Open the film folder “{film.label}”
          </button>
          {sources.drive && (
            <button onClick={() => setSourcePref('drive')} className="text-[11px] font-bold underline">
              Use Google Drive instead
            </button>
          )}
        </div>
      );
    if (film.status === 'choose')
      return (
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <span className="text-xs">
            {film.label} has more than one game folder. Which one is <b>{game.name}</b>?
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {film.choices.map((c) => (
              <button key={c} onClick={() => choose(c)} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">
                {c}
              </button>
            ))}
          </div>
        </div>
      );
    if (film.status === 'signin')
      return (
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <span className="text-xs">This film is in the team's Google Drive.</span>
          <button onClick={signInToDrive} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">
            Sign in with Google to watch
          </button>
        </div>
      );
    if (film.status === 'none')
      return (
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <Film size={24} className="text-slate-400" />
          <span className="text-xs">No film linked to {game.name} yet.</span>
          <button onClick={() => setLinkOpen(true)} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">
            Link film
          </button>
        </div>
      );
    if (!watch.length) return <span className="text-xs px-3">These snaps aren't on this film's play list.</span>;
    if (clipUrl.loading) return <span className="text-xs">Loading clip…</span>;
    if (clipUrl.error) return <span className="text-xs text-rose-300">{clipUrl.error}</span>;
    if (!clips.length) return <span className="text-xs px-3">No video files found in {film.label}.</span>;
    if (play && !clip) return <span className="text-xs px-3">No clip for play #{play.playNumber}.</span>;
    return null;
  })();

  const style: React.CSSProperties = isPhone
    ? { left: 8, right: 8, bottom: 8 }
    : pos
      ? { left: pos.x, top: pos.y, width }
      : { right: 16, bottom: 16, width };

  const gain = (p: Play) => (Number.isFinite(Number(p.gainLoss)) && p.gainLoss !== undefined ? `${p.gainLoss > 0 ? '+' : ''}${p.gainLoss}` : '');
  const views = film.status === 'ready' ? film.views : [];

  return (
    <>
      <div
        ref={boxRef}
        role="dialog"
        aria-label="Film window"
        className="fixed z-[45] rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col"
        style={style}
      >
        <div
          onPointerDown={onTitleDown}
          onPointerMove={onTitleMove}
          onPointerUp={onTitleUp}
          className={`flex items-center gap-1.5 px-2.5 h-9 bg-slate-900 text-white shrink-0 select-none touch-none ${isPhone ? '' : 'cursor-move'}`}
        >
          <Film size={14} className="text-indigo-300 shrink-0" />
          <span className="text-xs font-black truncate min-w-0 flex-1" title={request.label}>
            {request.label}
          </span>
          {watch.length > 0 && (
            <span className="text-[11px] font-bold text-slate-300 shrink-0">
              {Math.min(index, watch.length - 1) + 1} / {watch.length}
            </span>
          )}
          {!isPhone && (
            <button
              type="button"
              aria-label={size === 's' ? 'Make the window bigger' : 'Make the window smaller'}
              title={size === 's' ? 'Bigger' : 'Smaller'}
              onClick={() => changeSize(size === 's' ? 'l' : 's')}
              className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-200 hover:bg-white/10 cursor-pointer"
            >
              {size === 's' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          )}
          <button
            type="button"
            aria-label={mini ? 'Show the video' : 'Tuck the window away'}
            title={mini ? 'Show' : 'Tuck away'}
            onClick={() => setMini((m) => !m)}
            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-200 hover:bg-white/10 cursor-pointer"
          >
            {mini ? <Plus size={14} /> : <Minus size={14} />}
          </button>
          <button
            type="button"
            aria-label="Close the film window"
            title="Close"
            onClick={closeFilmWindow}
            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-200 hover:bg-white/10 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {!mini && (
          <>
            <FilmPlayer
              maxVideoHeight={videoMax}
              src={placeholder ? undefined : clipUrl.url}
              placeholder={placeholder}
              title={play ? playTitle(play) : ''}
              marks={marks}
              onMarksChange={saveMarks}
              hasPrev={Boolean(prev)}
              hasNext={Boolean(next)}
              onPrev={() => prev && setIndex(index - 1)}
              onNext={() => next && setIndex(index + 1)}
              onStopwatch={(s, at) => addNote(`Pocket time ${s.toFixed(2)}s`, at)}
              apiRef={apiRef}
              startAt={resumeAt.current}
              shortcuts={focused}
            />
            {(watch.length > 1 || views.length > 1) && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
                {views.length > 1 && (
                  <select
                    aria-label="Camera view"
                    value={film.status === 'ready' ? film.view : 0}
                    onChange={(e) => {
                      resumeAt.current = apiRef.current?.time() || 0;
                      setView(Number(e.target.value));
                    }}
                    className="h-7 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100 shrink-0"
                  >
                    {views.map((v, i) => (
                      <option key={v} value={i}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
                {watch.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    title={playTitle(p)}
                    className={`h-7 px-2 rounded-md text-[11px] font-bold shrink-0 cursor-pointer border ${
                      p === play
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : clipFor.has(p.id)
                          ? 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    #{p.playNumber}
                    {gain(p) && <span className="ml-1 opacity-80">{gain(p)}</span>}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => {
                  setAuto(e.target.checked);
                  setFilmWindowAutoOpen(e.target.checked);
                }}
              />
              Open this window by itself when I open a play with film
            </label>
          </>
        )}
      </div>
      {linkOpen && (
        <LinkFilmDialog
          gameName={game.name}
          driveLink={shared.drive?.link || root.shared.drive?.link}
          onClose={() => setLinkOpen(false)}
          onFolder={chooseFolder}
          onFiles={pickFiles}
          onDrive={linkDrive}
        />
      )}
    </>
  );
};
