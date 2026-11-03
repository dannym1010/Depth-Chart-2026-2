// Compare plays with the film: CompareView, each side's video found the way the film window finds it (the
// game's folder or Google Drive link, lined up with its plays as in the Film Room).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { FilmPlayer } from './FilmPlayer';
import { CompareView, type CompareFilmProps, type TimingStore } from './CompareView';
import { loadTiming, saveTiming, timingKey, type Moments } from './compareTiming';
import { compareGames, withFilmOnly, type CompareWeek } from './compareData';
import { playsFromClips } from './clipPlays';
import type { Play } from '../hudlScout/types/football';
import { matchClipsToPlays } from './clipMatching';
import { countViewIndex, liveViewClips, picksForView } from './dualView';
import { playTitle } from './playText';
import type { FilmClip, FilmGameShared, FilmMark } from './types';
import { useClipUrl, useGameFilm } from './useGameFilm';
import { useSharedGame } from './useSharedGame';

interface Props {
  teamId: string;
  teamName: string;
  ownTeamScout?: unknown;
  filmWeeks: CompareWeek[];
  currentWeek: string;
  /** This week's scouting as on screen (newer than filmWeeks' copy while saving). */
  opponentScout?: unknown;
  start?: { gameKey: string; playId?: string };
  /** Game folders with film and no breakdown: their clips are picked instead of plays. */
  filmOnlyGames?: { key: string; source: 'own' | 'opponent'; gameId: string; name: string; week?: string }[];
  viewOnly?: boolean;
  onClose: () => void;
}

export const ComparePlays: React.FC<Props> = ({ teamId, teamName, ownTeamScout, filmWeeks, currentWeek, opponentScout, start, filmOnlyGames = [], viewOnly, onClose }) => {
  // A film-only game's plays are its clips (in the count view's order), known once a side opens its film.
  const [clipPlays, setClipPlays] = useState<Record<string, Play[]>>({});
  const onClips = useCallback((gameKey: string, gameId: string, clips: FilmClip[]) => {
    setClipPlays((all) => {
      const next = playsFromClips(clips, gameId);
      const cur = all[gameKey];
      if (cur && cur.length === next.length && cur.every((p, i) => p.id === next[i].id)) return all;
      return { ...all, [gameKey]: next };
    });
  }, []);
  const games = useMemo(
    () => withFilmOnly(compareGames(ownTeamScout, teamName, filmWeeks, currentWeek, opponentScout), filmOnlyGames, filmWeeks, teamName, clipPlays),
    [ownTeamScout, teamName, filmWeeks, currentWeek, opponentScout, filmOnlyGames, clipPlays]
  );

  // Timing marks live in each game's shared Film Room data, so every coach sees them on every device.
  const [shown, setShown] = useState<[string, string]>(['', '']);
  const onShown = useCallback((keys: [string, string]) => setShown((k) => (k[0] === keys[0] && k[1] === keys[1] ? k : keys)), []);
  const left = useSharedGame(teamId, shown[0] || undefined);
  const right = useSharedGame(teamId, shown[1] || undefined);
  const docOf = (gameKey: string) => (gameKey && gameKey === shown[0] ? left : gameKey && gameKey === shown[1] ? right : undefined);
  const timing: TimingStore | undefined = viewOnly
    ? undefined
    : {
        shared: true,
        get: (gameKey, playId) => (docOf(gameKey)?.shared.timing?.[playId]?.moments || {}) as Moments,
        set: (gameKey, playId, moments) =>
          docOf(gameKey)?.update((s) => ({ ...s, timing: { ...(s.timing || {}), [playId]: { moments, editedAt: Date.now() } } })),
      };
  // Marks made on this device before they were shared: sent up once (a play with marks already shared keeps those).
  const leftUpdate = left.update;
  const rightUpdate = right.update;
  useEffect(() => {
    if (viewOnly) return;
    const local = loadTiming();
    let changed = false;
    ([
      [shown[0], leftUpdate],
      [shown[1], rightUpdate],
    ] as const).forEach(([gameKey, update], i) => {
      if (!gameKey || (i === 1 && gameKey === shown[0])) return;
      const prefix = timingKey(gameKey, '');
      const mine = Object.entries(local).filter(([k, m]) => k.startsWith(prefix) && m && Object.keys(m).length);
      if (!mine.length) return;
      const editedAt = Date.now();
      update((s) => {
        const timing = { ...(s.timing || {}) };
        for (const [k, moments] of mine) {
          const playId = k.slice(prefix.length);
          if (!timing[playId]) timing[playId] = { moments, editedAt };
        }
        return { ...s, timing };
      });
      mine.forEach(([k]) => delete local[k]);
      changed = true;
    });
    if (changed) saveTiming(local);
  }, [shown, leftUpdate, rightUpdate, viewOnly]);

  return (
    <CompareView
      games={games}
      start={start}
      onClose={onClose}
      timing={timing}
      onShown={onShown}
      // A side's film reloads when its game changes (each game has its own folder and line-up).
      renderFilm={(p) => <CompareFilm key={`${p.side}:${p.game.key}`} {...p} teamId={teamId} teamName={teamName} viewOnly={viewOnly} onClips={onClips} />}
    />
  );
};

const CompareFilm: React.FC<CompareFilmProps & { teamId: string; teamName: string; viewOnly?: boolean; onClips: (gameKey: string, gameId: string, clips: FilmClip[]) => void }> = ({
  game, play, apiRef, maxVideoHeight, hasPrev, hasNext, onPrev, onNext, teamId, teamName, viewOnly, onClips,
}) => {
  const { shared, update } = useSharedGame(teamId, game.key);
  const setDrive = useCallback((drive: FilmGameShared['drive']) => update((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })), [update]);
  const root = useSharedGame('program', 'root');
  const updateRoot = root.update;
  const setRootDrive = useCallback((drive: FilmGameShared['drive']) => updateRoot((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })), [updateRoot]);
  const setPick = useCallback((name: string) => update((s) => ({ ...s, folderPick: { name, editedAt: Date.now() } })), [update]);
  const { film, reconnect, signInToDrive, localFiles, sources, playFromComputer, playFromDrive, choose } = useGameFilm({
    game,
    teamId,
    teamName,
    opponentName: game.source === 'opponent' ? game.team : undefined,
    drive: shared.drive,
    setDrive,
    rootDrive: root.shared.drive,
    setRootDrive,
    pick: shared.folderPick?.name,
    setPick,
  });

  // The view on screen, lined up with the plays as in the Film Room.
  const view = film.status === 'ready' ? film.views[film.view] || '' : '';
  const multi = film.status === 'ready' && film.views.length > 1;
  const clips = useMemo(() => (film.status === 'ready' ? liveViewClips(film.clips, shared.removedClips, view, multi) : []), [film, shared.removedClips, view, multi]);
  const clipFor = useMemo(() => matchClipsToPlays(clips, game.plays, picksForView(shared.clipPicks, view, multi)), [clips, game.plays, shared.clipPicks, view, multi]);
  const clip = play && clipFor.has(play.id) ? clips[clipFor.get(play.id)!] : undefined;
  // Film only: its clips are the plays (the main camera's, as the Film Room counts them).
  const countIdx = film.status === 'ready' ? countViewIndex(film.views) : 0;
  const countClips = useMemo(
    () => (film.status === 'ready' && game.filmOnly ? liveViewClips(film.lists[countIdx] || [], shared.removedClips, film.views[countIdx] || '', multi) : []),
    [film, game.filmOnly, shared.removedClips, countIdx, multi]
  );
  useEffect(() => {
    if (game.filmOnly && film.status === 'ready') onClips(game.key, game.gameId, countClips);
  }, [game.filmOnly, game.key, game.gameId, film.status, countClips, onClips]);
  const clipUrl = useClipUrl(clip, localFiles);

  // Drawings are the Film Room's own; a drawing made here is saved on that play for the staff.
  const [localMarks, setLocalMarks] = useState<FilmMark[]>([]);
  const marks: FilmMark[] = viewOnly ? localMarks : (play && shared.drawings[play.id]?.marks) || [];
  const saveMarks = (m: FilmMark[]) => {
    if (viewOnly) return setLocalMarks(m);
    if (!play) return;
    update((s) => ({ ...s, drawings: { ...s.drawings, [play.id]: { marks: m, editedAt: Date.now() } } }));
  };

  const btn = 'px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold';
  const placeholder = (() => {
    if (film.status === 'loading') return <span className="text-xs">Opening {film.label}…</span>;
    if (film.status === 'error') return <span className="text-xs text-rose-300 px-3 text-center">{film.message}</span>;
    if (film.status === 'reconnect')
      return (
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <button type="button" onClick={reconnect} className={`${btn} inline-flex items-center gap-2`}>
            <RefreshCw size={14} /> Open the film folder “{film.label}”
          </button>
          {sources.drive && (
            <button type="button" onClick={() => void playFromDrive()} className="text-[11px] font-bold underline">
              Use Google Drive instead
            </button>
          )}
        </div>
      );
    if (film.status === 'signin')
      return (
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <span className="text-xs">This film is in the team&apos;s Google Drive.</span>
          <button type="button" onClick={signInToDrive} className={btn}>
            Sign in with Google to watch
          </button>
          {sources.local && (
            <button type="button" onClick={() => void playFromComputer()} className="text-[11px] font-bold underline">
              Use this computer&apos;s copy instead
            </button>
          )}
        </div>
      );
    if (film.status === 'choose')
      return (
        <div className="flex flex-col items-center gap-2 px-3 text-center">
          <span className="text-xs">Which folder is <b>{game.name}</b>?</span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {film.choices.map((c) => (
              <button key={c} type="button" onClick={() => choose(c)} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">
                {c}
              </button>
            ))}
          </div>
        </div>
      );
    if (film.status === 'none') return <span className="text-xs px-3 text-center">No film linked to {game.name}. Link it in the Film Room first.</span>;
    if (!play) return <span className="text-xs px-3 text-center">{game.filmOnly && !clips.length ? `No video files found in ${film.label}.` : 'Pick a play.'}</span>;
    if (clipUrl.loading) return <span className="text-xs">Loading clip…</span>;
    if (clipUrl.error) return <span className="text-xs text-rose-300 px-3 text-center">{clipUrl.error}</span>;
    if (!clip) return <span className="text-xs px-3 text-center">No clip for play #{play.playNumber}.</span>;
    return null;
  })();

  return (
    <FilmPlayer
      src={placeholder ? undefined : clipUrl.url}
      placeholder={placeholder}
      title={play ? `${game.source === 'own' ? 'Us' : game.team} · ${playTitle(play)}` : ''}
      marks={marks}
      onMarksChange={saveMarks}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onPrev={onPrev}
      onNext={onNext}
      onStopwatch={() => undefined}
      apiRef={apiRef}
      maxVideoHeight={maxVideoHeight}
      shortcuts={false}
      autoNextDefault={false}
      viewOnly={viewOnly}
    />
  );
};
