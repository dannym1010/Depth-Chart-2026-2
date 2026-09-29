// Film Room: a Hudl Scout game's plays with the film. Pick a game, link where its clips are (a shared
// Google Drive folder or a folder on this computer), then watch play by play with notes and drawings the
// whole staff sees. The play log under the video is Hudl Scout's own: sorting it sets the play order, and
// tags changed here are the same tags Hudl Scout shows.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Film, GripHorizontal, Library as LibraryIcon, Link2, MessageSquare, RefreshCw, Unlink } from 'lucide-react';
import { PlaysTable } from '../hudlScout/components/PlaysTable';
import { bundleFromSaved, type ScoutBundle } from '../hudlScout/scoutBundle';
import type { Play, TeamUnit } from '../hudlScout/types/football';
import { setPlaysFormation, tagPlays } from '../hudlScout/utils/playTags';
import { tagPlayUnits } from '../hudlScout/utils/unitStats';
import { safeJSONParse, safeJSONSet } from '../services/storageService';
import type { FilmPlayerRef, RosterPlayer } from '../types';
import type { PlayDatabaseEntry } from '../types/callSheet';
import { filmLineup, setPlayBallPlayer, setPlayDefPlay, setPlaySub, type BallRole, type WeekBoards } from '../utils/filmLineup';
import { newPlayEntry } from '../utils/playbookImport';
import { clipMatchMode, matchClipsToPlays } from './clipMatching';
import { FilmPlayer, type PlayerApi } from './FilmPlayer';
import { LinkFilmDialog } from './LinkFilmDialog';
import { FilmLibrary, type LibraryGame, type LibraryWeek } from './FilmLibrary';
import { PlayNotes } from './PlayNotes';
import { playTitle } from './playText';
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
  /** Saving tag changes, the same way Hudl Scout does. */
  onUpdateOwnTeamScout: (bundle: ScoutBundle) => void;
  onUpdateScouting: (field: string, val: unknown) => void;
  /** Play Bank, for tagging each play with the play that was run. */
  playDatabase?: PlayDatabaseEntry[];
  onUpdatePlayDatabase?: (next: PlayDatabaseEntry[]) => void;
  /** Our film: roster, each week's depth chart and the season's weeks, for who was on the field. */
  roster?: RosterPlayer[];
  weekBoards?: (week: string) => WeekBoards;
  weekOptions?: { key: string; label: string }[];
  /** Every week of the season: its opponent and scouting film (for the film library). */
  filmWeeks?: { key: string; label: string; opponent: string; hudlScout?: any }[];
  /** Switch the app to a week (opening another week's scouting film). */
  onSelectWeek?: (week: string) => void;
}

type OdkFilter = 'all' | 'O' | 'D' | 'K';

const newId = () => `fn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const FilmRoomView: React.FC<FilmRoomViewProps> = ({
  teamId, teamName, currentWeek, weekLabel, opponentName, opponentScout, ownTeamScout, authorName, onOpenHudlGame,
  onUpdateOwnTeamScout, onUpdateScouting, playDatabase, onUpdatePlayDatabase, roster, weekBoards, weekOptions,
  filmWeeks, onSelectWeek,
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

  // The film library: every week of the season with our game and that week's scouting film.
  const library = useMemo(() => {
    const weeks = filmWeeks || [];
    const weekKeys = new Set(weeks.map((w) => w.key));
    const ownByWeek = new Map<string, LibraryGame[]>();
    const others: LibraryGame[] = [];
    for (const g of own.games) {
      const lg: LibraryGame = { key: filmGameKey('own', g.id), source: 'own', gameId: g.id, name: g.name, week: g.week, plays: g.playCount || 0 };
      if (g.week && weekKeys.has(g.week)) ownByWeek.set(g.week, [...(ownByWeek.get(g.week) || []), lg]);
      else others.push(lg);
    }
    // Scouting games of each week (as Hudl Scout lists them; one unnamed game when the file had no list).
    const scoutGamesOf = (saved: any, opponent: string) => {
      if (Array.isArray(saved?.games) && saved.games.length) return saved.games as { id: string; name: string; playCount?: number }[];
      const n = Array.isArray(saved?.plays) ? saved.plays.length : 0;
      return n ? [{ id: 'game-1', name: saved?.datasetName || opponent || 'Scouting film', playCount: n }] : [];
    };
    const libWeeks: LibraryWeek[] = weeks.map((w) => ({
      key: w.key,
      label: w.label,
      opponent: w.opponent,
      games: [
        ...(ownByWeek.get(w.key) || []),
        ...scoutGamesOf(w.key === currentWeek ? opponentScout : w.hudlScout, w.opponent).map((g) => ({
          key: filmGameKey('opponent', g.id, w.key),
          source: 'opponent' as const,
          gameId: g.id,
          name: g.name,
          week: w.key,
          plays: Number(g.playCount) || 0,
        })),
      ],
    }));
    return { weeks: libWeeks, others };
  }, [filmWeeks, own.games, opponentScout, currentWeek]);

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
  // Unlinking saves an empty link (newest wins when coaches' copies merge, so it doesn't come back).
  const setDrive = useCallback((drive: typeof shared.drive) => update((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })), [update]);
  // The shared film folder ("Mahopac Film": every team and game inside), one link for the whole program.
  const root = useSharedGame('program', 'root');
  const updateRoot = root.update;
  const setRootDrive = useCallback((drive: typeof shared.drive) => updateRoot((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })), [updateRoot]);
  // Which folder holds this game in a week with several (one pick, for the whole staff).
  const setPick = useCallback((name: string) => update((s) => ({ ...s, folderPick: { name, editedAt: Date.now() } })), [update]);
  const { film, chooseFolder, reconnect, pickFiles, linkDrive, signInToDrive, unlink, localFiles, sources, sourcePref, setSourcePref, setView, choose } = useGameFilm({
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
  const clipFor = useMemo(() => matchClipsToPlays(clips, plays), [clips, plays]);

  // Previous / next follow the play log below as it's sorted and searched.
  const [order, setOrder] = useState<string[]>([]);
  const onOrderChange = useCallback((ids: string[]) => setOrder((cur) => (cur.join('|') === ids.join('|') ? cur : ids)), []);
  const playOrder = useMemo(() => {
    const byId = new Map(shownPlays.map((p) => [p.id, p]));
    const listed = order.map((id) => byId.get(id)).filter(Boolean) as Play[];
    return listed.length ? listed : shownPlays;
  }, [order, shownPlays]);

  const [playId, setPlayIdState] = useState<string | undefined>();
  const resumeAt = useRef(0);
  const setPlayId = useCallback((id: string | undefined) => {
    resumeAt.current = 0;
    setPlayIdState(id);
  }, []);
  useEffect(() => setPlayId(undefined), [game?.key, setPlayId]);
  const switchView = (i: number) => {
    resumeAt.current = apiRef.current?.time() || 0;
    setView(i);
  };
  const play: Play | undefined = plays.find((p) => p.id === playId) || playOrder[0];
  const idx = play ? playOrder.indexOf(play) : -1;
  const next = idx >= 0 ? playOrder[idx + 1] : playOrder[0];
  const prev = idx > 0 ? playOrder[idx - 1] : undefined;

  // Tag changes are saved to the game's Hudl Scout breakdown (ours, or this week's opponent).
  const source = game?.source || 'own';
  const editPlays = (change: (all: Play[]) => Play[]) => {
    const now = Date.now();
    if (source === 'own') onUpdateOwnTeamScout({ ...own, plays: change(own.plays), updatedAt: now });
    else onUpdateScouting('hudlScout', { ...((opponentScout as object) || {}), plays: change(opp.plays), updatedAt: now });
  };
  const isOwn = source === 'own';
  const lineupFor = (p: Play) => {
    const g = own.games.find((x) => x.id === p.gameId) || (!p.gameId ? own.games[0] : undefined);
    const week = g?.week || '';
    if (!week || !weekBoards) return { lineup: filmLineup(p, undefined, roster || []), weekLabel: g?.name };
    return { lineup: filmLineup(p, weekBoards(week), roster || []), weekLabel: weekOptions?.find((w) => w.key === week)?.label };
  };
  const createCall = (name: string, unit: 'offense' | 'defense') => {
    const base = newPlayEntry(name, unit);
    // Calls typed while tagging an opponent are filed apart from our own plays.
    const entry = isOwn ? base : { ...base, category: 'Opponent plays', tags: ['Opponent'] };
    onUpdatePlayDatabase?.([...(playDatabase || []), entry]);
    return entry;
  };

  const clipOf = (p?: Play) => (p && clipFor.has(p.id) ? clips[clipFor.get(p.id)!] : undefined);
  const clip = clipOf(play);
  const nextClip = clipOf(next);
  const clipUrl = useClipUrl(clip, localFiles, nextClip);

  const apiRef = useRef<PlayerApi | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [libraryDesk, setLibraryDesk] = useState(() => safeJSONParse<boolean>('footballFilmroomLibrary', true));
  const [libraryPhone, setLibraryPhone] = useState(false);
  const [mobileTab, setMobileTab] = useState<'plays' | 'notes'>('plays');

  // Computer layout: the video, then a bar to drag, then the play log in its own scroll area.
  // The video's height and whether notes show are remembered on this device.
  const isDesktop = useIsDesktop();
  const [showNotes, setShowNotes] = useState(() => safeJSONParse<boolean>('footballFilmroomShowNotes', true));
  const toggleNotes = () =>
    setShowNotes((v) => {
      safeJSONSet('footballFilmroomShowNotes', !v);
      return !v;
    });
  // Like Hudl: the video gets most of the screen; about three rows of the play log show under it.
  const screenH = () => (typeof window === 'undefined' ? 900 : window.innerHeight);
  const defaultVideoH = () => screenH() - 420;
  const clampVideoH = (h: number) => Math.max(200, Math.min(h, screenH() - 250));
  const [videoH, setVideoH] = useState<number>(() => safeJSONParse<number | null>('footballFilmroomVideoH3', null) || defaultVideoH());
  const drag = useRef<{ y: number; h: number } | null>(null);
  const onDividerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, h: clampVideoH(videoH) };
  };
  const onDividerMove = (e: React.PointerEvent) => {
    if (drag.current) setVideoH(clampVideoH(drag.current.h + e.clientY - drag.current.y));
  };
  const onDividerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    safeJSONSet('footballFilmroomVideoH3', videoH);
  };

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
        <div className="flex flex-col items-center gap-2">
          <button onClick={reconnect} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-2">
            <RefreshCw size={16} /> Open the film folder “{film.label}” on this computer
          </button>
          {sources.drive && (
            <button onClick={() => setSourcePref('drive')} className="text-xs font-bold underline">
              Use Google Drive instead
            </button>
          )}
        </div>
      );
    if (film.status === 'choose')
      return (
        <div className="flex flex-col items-center gap-2 max-w-md">
          <span>
            {film.label} has more than one game folder. Which one is <b>{game.name}</b>? (Saved for everyone.)
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {film.choices.map((c) => (
              <button key={c} onClick={() => choose(c)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-bold">
                {c}
              </button>
            ))}
          </div>
        </div>
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

  const rowBadge = (p: Play) => {
    const n = notesFor(p.id).length;
    return (
      <span className="inline-flex items-center gap-1.5 align-middle">
        <Film size={12} className={clipFor.has(p.id) ? 'text-indigo-400' : 'text-slate-600'} aria-label={clipFor.has(p.id) ? 'Has film' : 'No film'} />
        {n > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
            <MessageSquare size={10} />
            {n}
          </span>
        )}
      </span>
    );
  };
  const odkChips = (
    <div className="flex items-center gap-1">
      {(['all', 'O', 'D', 'K'] as OdkFilter[]).map((k) => (
        <button key={k} className={chip(odk === k)} onClick={() => setOdk(k)}>{k === 'all' ? 'All' : k === 'O' ? 'Offense' : k === 'D' ? 'Defense' : 'Kicking'}</button>
      ))}
    </div>
  );
  const playLog = (
    <PlaysTable
      plays={shownPlays}
      selectedId={play?.id}
      onSelectPlay={setPlayId}
      onOrderChange={onOrderChange}
      rowBadge={rowBadge}
      playDatabase={playDatabase}
      onTagPlays={onUpdatePlayDatabase ? (ids, entry) => editPlays((all) => tagPlays(all, ids, entry)) : undefined}
      onCreateCall={onUpdatePlayDatabase ? createCall : undefined}
      onSetFormation={(ids, formation) => editPlays((all) => setPlaysFormation(all, ids, formation))}
      onSetUnit={isOwn ? (id: string, unit: TeamUnit | undefined, scope) => editPlays((all) => tagPlayUnits(all, id, unit, scope)) : undefined}
      lineupFor={isOwn && roster ? lineupFor : undefined}
      roster={roster}
      onSetSub={isOwn ? (id: string, slotId: string, ref: FilmPlayerRef | null | undefined) => editPlays((all) => setPlaySub(all, id, slotId, ref)) : undefined}
      onSetBall={isOwn ? (id: string, role: BallRole, label: string) => editPlays((all) => setPlayBallPlayer(all, id, role, label)) : undefined}
      onSetDefPlay={isOwn ? (id, patch) => editPlays((all) => setPlayDefPlay(all, id, patch)) : undefined}
      compact
      toolbarStart={odkChips}
    />
  );
  const openFromLibrary = (g: LibraryGame) => {
    if (g.source === 'opponent' && g.week && g.week !== currentWeek) onSelectWeek?.(g.week);
    setGameKey(g.key);
    setLibraryPhone(false);
  };
  const libraryEl = (onClose: () => void) => (
    <FilmLibrary weeks={library.weeks} otherGames={library.others} currentWeek={currentWeek} selectedKey={game?.key} onOpen={openFromLibrary} onClose={onClose} />
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
    <div className="flex flex-col gap-2 lg:h-[calc(100dvh-6.5rem)]">
      {/* Game and film */}
      <div className={`${panel} px-2.5 py-1.5 flex flex-wrap items-center gap-2 shrink-0`}>
        <button
          onClick={() => {
            if (isDesktop) {
              safeJSONSet('footballFilmroomLibrary', !libraryDesk);
              setLibraryDesk(!libraryDesk);
            } else setLibraryPhone(true);
          }}
          aria-expanded={isDesktop ? libraryDesk : libraryPhone}
          title="Film library: every game of the season, by week"
          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-bold shrink-0 ${
            isDesktop && libraryDesk ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <LibraryIcon size={15} /> Games
        </button>
        {game && (
          <div className="min-w-0 flex flex-col leading-tight mr-1">
            <span className="text-sm font-black text-slate-900 dark:text-white truncate">{game.name}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {game.source === 'own' ? 'Our game' : 'Scouting'}
              {game.week ? ` · ${weekOptions?.find((w) => w.key === game.week)?.label || game.week}` : ''}
            </span>
          </div>
        )}

        <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full">
          {film.status === 'ready'
            ? `${film.kind === 'drive' ? 'Drive' : film.kind === 'folder' ? 'Folder' : 'Clips'}: ${film.label} · ${clipFor.size}/${plays.length} plays have film`
            : film.status === 'none'
              ? 'No film linked'
              : 'label' in film && film.label
                ? film.label
                : ''}
        </span>
        {/* Camera views of this game (a folder each, e.g. Sideline / End Zone). */}
        {film.status === 'ready' && film.views.length > 1 && (
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden" role="group" aria-label="Camera view">
            {film.views.map((v, i) => (
              <button
                key={v}
                onClick={() => switchView(i)}
                aria-pressed={film.view === i}
                className={`px-2.5 h-7 text-[11px] font-bold ${film.view === i ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'}`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {/* Several game folders in this week: which one is this game (saved for everyone). */}
        {film.status === 'ready' && film.siblings && film.siblings.length > 1 && (
          <select
            value={film.folder}
            onChange={(e) => choose(e.target.value)}
            aria-label="Game folder"
            title="This week has several game folders: which one is this game (saved for everyone)"
            className="h-7 max-w-[12rem] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200"
          >
            {film.siblings.map((n) => (
              <option key={n} value={n}>Folder: {n}</option>
            ))}
          </select>
        )}
        {/* Both copies of the film folder linked: which one this device plays from. */}
        {sources.local && sources.drive && (
          <select
            value={sourcePref}
            onChange={(e) => setSourcePref(e.target.value as 'auto' | 'local' | 'drive')}
            aria-label="Play film from"
            title="Auto: this computer's copy when it has the game (faster), otherwise Google Drive"
            className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="auto">Play from: Auto</option>
            <option value="local">Play from: This computer</option>
            <option value="drive">Play from: Google Drive</option>
          </select>
        )}
        {/* Clips go with plays in order: a different count means some clip is missing or extra. */}
        {film.status === 'ready' && clips.length > 0 && clipMatchMode(clips, plays) === 'order' && clips.length !== plays.length && (
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            title="Clips are matched to plays in order (first clip = first play). With a different number of clips, check that the plays line up, and that the folder has only this game's clips."
          >
            ⚠ {clips.length} clips for {plays.length} plays: check the plays line up
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={toggleNotes}
            className={`hidden lg:inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold ${
              showNotes ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
            }`}
            title={showNotes ? 'Hide notes to make the video bigger' : 'Show notes beside the video'}
          >
            <MessageSquare size={14} /> {showNotes ? 'Hide notes' : `Show notes${play && notesFor(play.id).length ? ` (${notesFor(play.id).length})` : ''}`}
          </button>
          <button onClick={() => setLinkOpen(true)} className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold bg-indigo-600 text-white">
            <Link2 size={14} /> {film.status === 'ready' ? 'Change film' : 'Link film'}
          </button>
          {(film.status === 'ready' || film.status === 'reconnect') && (
            <button
              onClick={() => {
                if (film.status === 'ready' && film.viaRoot && !window.confirm(`Stop using "${film.label.split(' › ')[0]}" for every game${film.kind === 'drive' ? ' (for all coaches)' : ' on this device'}?`)) return;
                void unlink();
              }}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title={film.status === 'ready' && film.viaRoot ? 'Stop using the team film folder for every game' : film.status === 'ready' && film.kind === 'drive' ? 'Unlink the Drive folder for the whole team' : 'Stop using this folder on this device'}
            >
              <Unlink size={14} /> Unlink
            </button>
          )}
          {game && (
            <button
              onClick={() => onOpenHudlGame({ target: game.source, gameId: game.gameId })}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Open this game in Hudl Scout"
            >
              <ExternalLink size={14} /> <span className="hidden sm:inline">Hudl Scout</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-2 lg:flex-1 lg:min-h-0">
      {isDesktop && libraryDesk && <aside className={`${panel} w-64 xl:w-72 shrink-0 min-h-0`}>{libraryEl(() => {
        safeJSONSet('footballFilmroomLibrary', false);
        setLibraryDesk(false);
      })}</aside>}
      <div className="flex flex-col gap-2 flex-1 min-w-0 lg:min-h-0">
      {/* Phones held upright: the video stays pinned under the app header while the plays scroll under it. */}
      <div className={`grid gap-3 shrink-0 max-lg:portrait:sticky max-lg:portrait:top-[62px] max-lg:portrait:z-20 max-lg:portrait:rounded-xl max-lg:portrait:bg-black ${showNotes ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
        <FilmPlayer
          maxVideoHeight={isDesktop ? `${clampVideoH(videoH)}px` : 'calc(100dvh - 7rem)'}
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
          startAt={resumeAt.current}
        />

        {/* Notes: beside the video on a computer (as tall as the video, scrolling), a tab on phones and tablets */}
        {showNotes && (
          <div className="hidden lg:block relative">
            <div className={`${panel} absolute inset-0 overflow-y-auto`}>
              <div className="px-3 pt-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Notes {play ? `· play #${play.playNumber}` : ''}
              </div>
              {notesEl}
            </div>
          </div>
        )}
      </div>

      {/* Drag to make the video bigger or smaller (double-click: back to the standard size) */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Drag to resize the video"
        title="Drag to make the video bigger or smaller"
        onPointerDown={onDividerDown}
        onPointerMove={onDividerMove}
        onPointerUp={onDividerUp}
        onPointerCancel={onDividerUp}
        onDoubleClick={() => {
          setVideoH(defaultVideoH());
          safeJSONSet('footballFilmroomVideoH3', null);
        }}
        className="hidden lg:flex shrink-0 -my-1.5 h-4 items-center justify-center cursor-row-resize touch-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <GripHorizontal size={18} />
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <button className={chip(mobileTab === 'plays')} onClick={() => setMobileTab('plays')}>Plays &amp; tags</button>
        <button className={chip(mobileTab === 'notes')} onClick={() => setMobileTab('notes')}>
          Notes{play && notesFor(play.id).length ? ` (${notesFor(play.id).length})` : ''}
        </button>
      </div>
      {mobileTab === 'notes' && <div className={`${panel} lg:hidden`}>{notesEl}</div>}

      {/* The game's play log: click a play to watch it, sort by any column, change tags */}
      <div className={`flex-col gap-2 lg:flex-1 lg:min-h-0 ${mobileTab === 'plays' ? 'flex' : 'hidden lg:flex'}`}>
        {playLog}
      </div>

      </div>
      </div>

      {/* Phones and tablets: the library slides in from the side. */}
      {!isDesktop && libraryPhone && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setLibraryPhone(false)}>
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {libraryEl(() => setLibraryPhone(false))}
          </div>
        </div>
      )}

      {linkOpen && game && (
        <LinkFilmDialog
          gameName={game.name}
          driveLink={shared.drive?.link || root.shared.drive?.link}
          onClose={() => setLinkOpen(false)}
          onFolder={chooseFolder}
          onFiles={pickFiles}
          onDrive={linkDrive}
        />
      )}
    </div>
  );
};

/** A computer-sized screen (the side-by-side layout). */
function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return match;
}
