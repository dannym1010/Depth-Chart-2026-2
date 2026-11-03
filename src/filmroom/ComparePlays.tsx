// Compare plays with the film: CompareView, each side's video found the way the film window finds it (the
// game's folder or Google Drive link, lined up with its plays as in the Film Room).
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { FilmPlayer } from './FilmPlayer';
import { CompareView, type CompareFilmProps } from './CompareView';
import { compareGames, type CompareWeek } from './compareData';
import { matchClipsToPlays } from './clipMatching';
import { liveViewClips, picksForView } from './dualView';
import { playTitle } from './playText';
import type { FilmGameShared, FilmMark } from './types';
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
  viewOnly?: boolean;
  onClose: () => void;
}

export const ComparePlays: React.FC<Props> = ({ teamId, teamName, ownTeamScout, filmWeeks, currentWeek, opponentScout, start, viewOnly, onClose }) => {
  const games = useMemo(() => compareGames(ownTeamScout, teamName, filmWeeks, currentWeek, opponentScout), [ownTeamScout, teamName, filmWeeks, currentWeek, opponentScout]);
  return (
    <CompareView
      games={games}
      start={start}
      onClose={onClose}
      // A side's film reloads when its game changes (each game has its own folder and line-up).
      renderFilm={(p) => <CompareFilm key={`${p.side}:${p.game.key}`} {...p} teamId={teamId} teamName={teamName} viewOnly={viewOnly} />}
    />
  );
};

const CompareFilm: React.FC<CompareFilmProps & { teamId: string; teamName: string; viewOnly?: boolean }> = ({
  game, play, apiRef, maxVideoHeight, hasPrev, hasNext, onPrev, onNext, teamId, teamName, viewOnly,
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
    if (!play) return <span className="text-xs px-3 text-center">Pick a play.</span>;
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
