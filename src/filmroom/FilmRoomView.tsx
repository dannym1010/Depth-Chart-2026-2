// Film Room: a Hudl Scout game's plays with the film next to them. Pick a game, link where its clips
// are (a shared Google Drive folder or a folder on this computer), then watch play by play with notes
// and drawings the whole staff sees.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Film, Link2, RefreshCw, Unlink } from 'lucide-react';
import { bundleFromSaved } from '../hudlScout/scoutBundle';
import type { Play } from '../hudlScout/types/football';
import { safeJSONParse, safeJSONSet } from '../services/storageService';
import { matchClipsToPlays } from './clipMatching';
import { FilmPlayer, type PlayerApi } from './FilmPlayer';
import { LinkFilmDialog } from './LinkFilmDialog';
import { PlayList, playTitle } from './PlayList';
import { PlayNotes } from './PlayNotes';
import { filmGameKey } from './sharedMerge';
import type { FilmGame, FilmMark, FilmNote } from './types';
import { useClipUrl, useGameFilm } from './useGameFilm';
import { useSharedGame } from './useSharedGame';

interface FilmRoomViewProps {
  teamId: string;
  teamName: string;
  currentWeek: string;
  weekLabel: string;
  opponentName?: string;
  /** This week's opponent film breakdown (Hudl Scout). */
  opponentScout?: unknown;
  /** Our own games (Hudl Scout). */
  ownTeamScout?: unknown;
  authorName: string;
  onOpenHudlGame: (open: { target: 'own' | 'opponent'; gameId: string }) => void;
}

type OdkFilter = 'all' | 'O' | 'D' | 'K';

const newId = () => `fn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const FilmRoomView: React.FC<FilmRoomViewProps> = ({
  teamId, teamName, currentWeek, weekLabel, opponentName, opponentScout, ownTeamScout, authorName, onOpenHudlGame,
}) => {
  const own = useMemo(() => bundleFromSaved(ownTeamScout, teamName), [ownTeamScout, teamName]);
  const opp = useMemo(() => bundleFromSaved(opponentScout, opponentName || 'Opponent'), [opponentScout, opponentName]);

  const games = useMemo(() => {
    const list: FilmGame[] = [
      ...own.games.map((g) => ({ key: filmGameKey('own', g.id), source: 'own' as const, gameId: g.id, name: g.name, week: g.week })),
      ...opp.games.map((g) => ({ key: filmGameKey('opponent', g.id, currentWeek), source: 'opponent' as const, gameId: g.id, name: g.name, week: currentWeek })),
    ];
    return list;
  }, [own.games, opp.games, currentWeek]);

  const pickKey = `footballFilmroomGame_${teamId}`;
  const [gameKey, setGameKey] = useState<string | undefined>(() => safeJSONParse<string | null>(pickKey, null) || undefined);
  const game = games.find((g) => g.key === gameKey) || games[0];
  useEffect(() => {
    if (game) safeJSONSet(pickKey, game.key);
  }, [game, pickKey]);

  const plays = useMemo(() => {
    if (!game) return [];
    const b = game.source === 'own' ? own : opp;
    const onlyGame = b.games.length === 1;
    return b.plays
      .filter((p) => p.gameId === game.gameId || (onlyGame && !p.gameId))
      .sort((a, c) => (Number(a.playNumber) || 0) - (Number(c.playNumber) || 0));
  }, [game, own, opp]);

  const [odk, setOdk] = useState<OdkFilter>('all');
  const shownPlays = useMemo(() => (odk === 'all' ? plays : plays.filter((p) => p.odk === odk)), [plays, odk]);

  const { shared, update } = useSharedGame(teamId, game?.key);
  const setDrive = useCallback((drive: typeof shared.drive) => update((s) => ({ ...s, drive: drive || undefined })), [update]);
  const { film, chooseFolder, reconnect, pickFiles, linkDrive, signInToDrive, unlink, localFiles } = useGameFilm(game?.key, teamId, shared.drive, setDrive);

  const clips = film.status === 'ready' ? film.clips : [];
  const clipFor = useMemo(() => matchClipsToPlays(clips, plays), [clips, plays]);

  const [playId, setPlayId] = useState<string | undefined>();
  useEffect(() => setPlayId(undefined), [game?.key]);
  const play: Play | undefined = shownPlays.find((p) => p.id === playId) || shownPlays[0];
  const idx = play ? shownPlays.indexOf(play) : -1;
  const next = idx >= 0 ? shownPlays[idx + 1] : undefined;
  const prev = idx > 0 ? shownPlays[idx - 1] : undefined;

  const clipOf = (p?: Play) => (p && clipFor.has(p.id) ? clips[clipFor.get(p.id)!] : undefined);
  const clip = clipOf(play);
  const nextClip = clipOf(next);
  const clipUrl = useClipUrl(clip, localFiles, nextClip);

  const apiRef = useRef<PlayerApi | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'plays' | 'notes'>('plays');

  const notesFor = useCallback((id: string) => shared.notes.filter((n) => n.playId === id), [shared.notes]);
  const playNotes = play ? [...notesFor(play.id)].sort((a, b) => a.t - b.t) : [];
  const marks: FilmMark[] = (play && shared.drawings[play.id]?.marks) || [];

  const addNote = (text: string, grade: FilmNote['grade'], t: number) => {
    if (!play) return;
    const now = Date.now();
    const note: FilmNote = { id: newId(), playId: play.id, t: Math.round(t * 10) / 10, text, ...(grade ? { grade } : {}), author: authorName, createdAt: now, editedAt: now };
    update((s) => ({ ...s, notes: [...s.notes, note] }));
  };
  const deleteNote = (id: string) =>
    update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id), deletedNotes: { ...s.deletedNotes, [id]: Date.now() } }));
  const saveMarks = (m: FilmMark[]) => {
    if (!play) return;
    update((s) => ({ ...s, drawings: { ...s.drawings, [play.id]: { marks: m, editedAt: Date.now() } } }));
  };

  // What the video area says when there's nothing to play yet.
  const placeholder = (() => {
    if (!game) return null;
    if (film.status === 'loading') return <span>Opening {film.label}…</span>;
    if (film.status === 'error') return <span className="text-rose-300 dark:text-rose-300">{film.message}</span>;
    if (film.status === 'reconnect')
      return (
        <button onClick={reconnect} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-2">
          <RefreshCw size={16} /> Open the film folder “{film.label}”
        </button>
      );
    if (film.status === 'signin')
      return (
        <div className="flex flex-col items-center gap-2">
          <span>This game's film is in the team's Google Drive folder “{film.label}”.</span>
          <button onClick={signInToDrive} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold">Sign in with Google to watch</button>
        </div>
      );
    if (film.status === 'none')
      return (
        <div className="flex flex-col items-center gap-2">
          <Film size={28} className="text-slate-500 dark:text-slate-500" />
          <span>No film linked to this game yet.</span>
          <button onClick={() => setLinkOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold">Link film</button>
        </div>
      );
    if (clipUrl.loading) return <span>Loading clip…</span>;
    if (clipUrl.error) return <span className="text-rose-300 dark:text-rose-300">{clipUrl.error}</span>;
    if (!clips.length) return <span>No video files found in {film.label}.</span>;
    if (play && !clip) return <span>No clip for play #{play.playNumber}.</span>;
    return null;
  })();

  if (!games.length) {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
        <Film size={32} className="mx-auto text-slate-400" />
        <h2 className="mt-3 text-lg font-black text-slate-900 dark:text-white">No games to watch yet</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Upload a game's Hudl breakdown in Hudl Scout (our games, or this week's opponent). Its plays show up here, ready to match with the film.
        </p>
      </div>
    );
  }

  const panel = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden';
  const chip = (active: boolean) =>
    `px-2.5 h-7 rounded-lg text-xs font-bold ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`;
  const ownGames = games.filter((g) => g.source === 'own');
  const oppGames = games.filter((g) => g.source === 'opponent');

  const playListEl = (
    <PlayList plays={shownPlays} selectedId={play?.id} onSelect={setPlayId} hasClip={(id) => clipFor.has(id)} noteCount={(id) => notesFor(id).length} />
  );
  const notesEl = (
    <PlayNotes
      play={play}
      notes={playNotes}
      currentTime={() => apiRef.current?.time() || 0}
      onSeek={(t) => apiRef.current?.seek(t)}
      onAdd={addNote}
      onDelete={deleteNote}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Game and film */}
      <div className={`${panel} p-3 flex flex-wrap items-center gap-2`}>
        <Film size={18} className="text-indigo-500 shrink-0" />
        <select
          value={game?.key}
          onChange={(e) => setGameKey(e.target.value)}
          className="min-w-[12rem] flex-1 sm:flex-none sm:max-w-xs h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm font-bold text-slate-900 dark:text-white"
          aria-label="Game"
        >
          {ownGames.length > 0 && (
            <optgroup label={teamName}>
              {ownGames.map((g) => (
                <option key={g.key} value={g.key}>{g.name}</option>
              ))}
            </optgroup>
          )}
          {oppGames.length > 0 && (
            <optgroup label={`${weekLabel}${opponentName ? ` · ${opponentName}` : ''} (scouting)`}>
              {oppGames.map((g) => (
                <option key={g.key} value={g.key}>{g.name}</option>
              ))}
            </optgroup>
          )}
        </select>

        <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full">
          {film.status === 'ready'
            ? `${film.kind === 'drive' ? 'Drive' : film.kind === 'folder' ? 'Folder' : 'Clips'}: ${film.label} · ${clipFor.size}/${plays.length} plays have film`
            : film.status === 'none'
              ? 'No film linked'
              : 'label' in film && film.label
                ? film.label
                : ''}
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setLinkOpen(true)} className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-bold bg-indigo-600 text-white">
            <Link2 size={14} /> {film.status === 'ready' ? 'Change film' : 'Link film'}
          </button>
          {(film.status === 'ready' || film.status === 'reconnect') && (
            <button
              onClick={unlink}
              className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title={film.status === 'ready' && film.kind === 'drive' ? 'Unlink the Drive folder for the whole team' : 'Stop using this folder on this device'}
            >
              <Unlink size={14} /> Unlink
            </button>
          )}
          {game && (
            <button
              onClick={() => onOpenHudlGame({ target: game.source, gameId: game.gameId })}
              className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Open this game in Hudl Scout"
            >
              <ExternalLink size={14} /> <span className="hidden sm:inline">Hudl Scout</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)_19rem] items-start">
        {/* Plays (desktop) */}
        <div className={`${panel} hidden lg:flex flex-col max-h-[calc(100vh-11rem)]`}>
          <div className="flex items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-800">
            {(['all', 'O', 'D', 'K'] as OdkFilter[]).map((k) => (
              <button key={k} className={chip(odk === k)} onClick={() => setOdk(k)}>{k === 'all' ? 'All' : k}</button>
            ))}
            <span className="ml-auto text-[11px] text-slate-400">{shownPlays.length} plays</span>
          </div>
          <div className="overflow-y-auto">{playListEl}</div>
        </div>

        <FilmPlayer
          src={placeholder ? undefined : clipUrl.url}
          placeholder={placeholder}
          title={play ? playTitle(play) : ''}
          marks={marks}
          onMarksChange={saveMarks}
          hasPrev={Boolean(prev)}
          hasNext={Boolean(next)}
          onPrev={() => prev && setPlayId(prev.id)}
          onNext={() => next && setPlayId(next.id)}
          onStopwatch={(s, at) => {
            addNote(`Pocket time ${s.toFixed(2)}s`, undefined, at);
          }}
          apiRef={apiRef}
        />

        {/* Notes (desktop) */}
        <div className={`${panel} hidden lg:block max-h-[calc(100vh-11rem)] overflow-y-auto`}>
          <div className="px-3 pt-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Notes {play ? `· play #${play.playNumber}` : ''}
          </div>
          {notesEl}
        </div>

        {/* Phones and tablets: plays and notes under the video */}
        <div className={`${panel} lg:hidden`}>
          <div className="flex items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-800">
            <button className={chip(mobileTab === 'plays')} onClick={() => setMobileTab('plays')}>Plays</button>
            <button className={chip(mobileTab === 'notes')} onClick={() => setMobileTab('notes')}>
              Notes{play && notesFor(play.id).length ? ` (${notesFor(play.id).length})` : ''}
            </button>
            {mobileTab === 'plays' && (
              <span className="ml-auto flex gap-1">
                {(['all', 'O', 'D', 'K'] as OdkFilter[]).map((k) => (
                  <button key={k} className={chip(odk === k)} onClick={() => setOdk(k)}>{k === 'all' ? 'All' : k}</button>
                ))}
              </span>
            )}
          </div>
          {mobileTab === 'plays' ? <div className="max-h-[55vh] overflow-y-auto">{playListEl}</div> : notesEl}
        </div>
      </div>

      {linkOpen && game && (
        <LinkFilmDialog
          gameName={game.name}
          driveLink={shared.drive?.link}
          onClose={() => setLinkOpen(false)}
          onFolder={chooseFolder}
          onFiles={pickFiles}
          onDrive={linkDrive}
        />
      )}
    </div>
  );
};
