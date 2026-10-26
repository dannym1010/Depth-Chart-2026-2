// Film Room: a Hudl Scout game's plays with the film. Pick a game, link where its clips are (a shared
// Google Drive folder or a folder on this computer), then watch play by play with notes and drawings the
// whole staff sees. The play log under the video is Hudl Scout's own: sorting it sets the play order, and
// tags changed here are the same tags Hudl Scout shows.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ExternalLink, FileUp, Film, GripHorizontal, Library as LibraryIcon, Link2, MessageSquare, RefreshCw, Unlink, ArrowLeft, Star, ListVideo, X, MoreHorizontal, Trash2, RotateCcw, Tv, Users, History } from 'lucide-react';
import { openScoutVersions } from '../components/ScoutSafetyNet';
import { markGamesDeleted } from '../utils/gameTombstones';
import { PlaysTable } from '../hudlScout/components/PlaysTable';
import { assignDrives, bundleFromSaved, copyScoutGame, folderCopies, mergeFolderCopies, removeScoutGame, type ScoutBundle } from '../hudlScout/scoutBundle';
import type { Play, TeamUnit } from '../hudlScout/types/football';
import type { ScoutGame } from '../hudlScout/components/Header';
import { autoTagFromHudl, setPlaysFormation, tagPlays } from '../hudlScout/utils/playTags';
import { tagPlayUnits } from '../hudlScout/utils/unitStats';
import { isReadOnlySession, safeJSONParse, safeJSONSet } from '../services/storageService';
import type { FilmPlayerRef, RosterPlayer } from '../types';
import type { PlayDatabaseEntry } from '../types/callSheet';
import { filmLineup, setPlayBallPlayer, setPlayDefPlay, setPlaySub, type BallRole, type WeekBoards } from '../utils/filmLineup';
import { newPlayEntry } from '../utils/playbookImport';
import { theirCallEntries } from '../utils/theirCalls';
import { clipMatchMode, matchClipsToPlays, naturalCompare } from './clipMatching';
import { playsFromClips } from './clipPlays';
import { applyBreakdown, blankPlays, breakdownPlayId, importIntoGame, isBrokenDown, type BreakdownRow } from './breakdownEntry';
import { endProof, filledFrom, followOn } from './nextPlay';
import { DriveChart } from './DriveChart';
import { DriveSidebar } from './DriveSidebar';
import { PlayerFinder } from './PlayerFinder';
import { BreakdownPanel } from './BreakdownPanel';
import type { FilmFolderGame, UnplacedFolder } from './folderRoutes';
import { clearFilmCutup, peekFilmCutup, type FilmCutup } from '../utils/filmCutup';
import { peekPlayBuilderSeed, savePlayBuilderSeed, type PlayBuilderSeed } from '../utils/playBuilderSeed';
import { PlayBuilderSection } from '../components/playbook/PlayBuilderSection';
import { FilmPlayer, type PlayerApi } from './FilmPlayer';
import { LinkFilmDialog } from './LinkFilmDialog';
import { FilmLibrary, buildLibrary, type LibraryGame, type ScheduledGame } from './FilmLibrary';
import { PlayNotes } from './PlayNotes';
import { playTitle } from './playText';
import { filmGameKey } from './sharedMerge';
import { sameFolderGame } from './folderRoutes';
import type { FilmGame, FilmMark, FilmNote } from './types';
import { useClipUrl, useGameFilm } from './useGameFilm';
import { canOpenFolders } from './filmSources';
import { openVideoScreen, screenSupported, screenUrl, useVideoScreenSender } from './screenLink';
import { namesFromCards } from '../utils/scoutOppPlays';
import { parseCall } from './callName';
import { moveSharedNotes, useSharedGame } from './useSharedGame';
import { readBreakdown, useFolderBreakdowns } from './folderImport';
import { AddToPlaylistMenu, PlayListActions, PlaylistsPanel, type Person } from './PlaylistsPanel';
import { useFilmLists } from './useFilmLists';
import { isFavorite, playInfo, toggleFavorite, type ClipRef, type PlayInfo } from './playlists';

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
  filmWeeks?: { key: string; label: string; opponent: string; hudlScout?: any; scheduled?: ScheduledGame }[];
  /** Switch the app to a week (opening another week's scouting film). */
  onSelectWeek?: (week: string) => void;
  /** Save a week's scouting film (a breakdown file found in that week's folder). */
  onSaveWeekScouting?: (week: string, hudlScout: any) => void;
  /** Leave a cutup of one play and return to the play builder. */
  onBackToPlay?: () => void;
  /** The play builder beside the video ("Watch film" from the builder): who may save, saving, renaming. */
  builderCanEdit?: boolean;
  onSaveBuilderPlay?: (entry: PlayDatabaseEntry, seed: PlayBuilderSeed | null) => PlayDatabaseEntry;
  onRenameScoutPlay?: (change: { from: string; to: string; scoutId?: string; gameId?: string; playEntryId?: string }) => void;
  onSaveFilmBackfield?: (change: { gameId: string; backfield: string; spots: Record<string, { x: number; y: number }>; baseKey: string }) => void;
  /** Their film: draw a clip's play in the play builder, lined up in its base formation, with the clip playing. */
  onDrawSnap?: (play: Play) => void;
  /** Their film: tag a clip with a formation and draw (or adjust) that formation with the clip playing. */
  onDrawFormation?: (req: { playId: string; gameId: string; clip: number; id?: string; name: string }) => void;
  /** True if currently logged in user is the program owner / master super admin */
  isProgramAdmin?: boolean;
  /** A player or family account: watching only (no film linking, breakdown, tags, notes to add or drawing). */
  viewOnly?: boolean;
  /** A family account: our games only, just the video and a plain list of the plays. */
  family?: boolean;
  /** Who's signed in (email): their favorites and playlists. */
  userEmail?: string;
  /** People a playlist can be shared with. */
  people?: Person[];
}

type OdkFilter = 'all' | 'O' | 'D' | 'K';

const newId = () => `fn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const FilmRoomView: React.FC<FilmRoomViewProps> = ({
  teamId, teamName, currentWeek, weekLabel, opponentName, opponentScout, ownTeamScout, authorName, onOpenHudlGame,
  onUpdateOwnTeamScout, onUpdateScouting, playDatabase, onUpdatePlayDatabase, roster, weekBoards, weekOptions,
  filmWeeks, onSelectWeek, onSaveWeekScouting, onBackToPlay, builderCanEdit, onSaveBuilderPlay, onRenameScoutPlay, onSaveFilmBackfield, onDrawSnap, onDrawFormation,
  isProgramAdmin = false,
  viewOnly = false,
  family = false,
  userEmail = '',
  people = [],
}) => {
  // Watching only: a player or family account (or any session that can't save).
  const locked = viewOnly || family || isReadOnlySession();
  const own = useMemo(() => bundleFromSaved(ownTeamScout, teamName), [ownTeamScout, teamName]);
  const opp = useMemo(() => bundleFromSaved(opponentScout, opponentName || 'Opponent'), [opponentScout, opponentName]);

  // Game folders with film in them, found in the film folder (kept on this device, so they are listed at once).
  const foldersKey = `footballFilmroomFolders_${teamId}`;
  const [filmFolders, setFilmFolders] = useState<{ games: FilmFolderGame[]; unplaced: UnplacedFolder[] }>(
    () => safeJSONParse<{ games: FilmFolderGame[]; unplaced: UnplacedFolder[] }>(foldersKey, { games: [], unplaced: [] }) || { games: [], unplaced: [] }
  );
  const onFilmFolders = useCallback(
    (found: { games: FilmFolderGame[]; unplaced: UnplacedFolder[] }, partial: boolean) => {
      setFilmFolders((prev) => {
        // A folder that couldn't be read this time (this computer's, before its click): keep what it had.
        const next = partial
          ? {
              games: [...found.games, ...prev.games.filter((g) => !found.games.some((x) => x.id === g.id))],
              unplaced: [...found.unplaced, ...prev.unplaced.filter((u) => !found.unplaced.some((x) => x.path.join('/') === u.path.join('/')))],
            }
          : found;
        safeJSONSet(foldersKey, next);
        return next;
      });
    },
    [foldersKey]
  );
  // Film with no breakdown yet: each clip is a play, in order (filled in once the film is open).
  const [clipPlays, setClipPlays] = useState<Play[]>([]);

  // The film library: every week of the season with our game and that week's scouting film.
  const library = useMemo(() => {
    const all = buildLibrary(filmWeeks || [], own.games, currentWeek, opponentScout, filmFolders.games, own.deletedGameIds || []);
    if (!family) return all;
    // A family account sees our games, not the scouting film.
    const ours = <T extends { source: string }>(list: T[]) => list.filter((g) => g.source === 'own');
    return { weeks: all.weeks.map((w) => ({ ...w, games: ours(w.games) })).filter((w) => w.games.length), others: ours(all.others) };
  }, [filmWeeks, own.games, own.deletedGameIds, opponentScout, currentWeek, filmFolders.games, family]);
  const filmOnlyGames = useMemo(() => [...library.weeks.flatMap((w) => w.games), ...library.others].filter((g) => g.filmOnly), [library]);

  const games = useMemo(() => {
    const list: FilmGame[] = [
      ...own.games.map((g) => ({ key: filmGameKey('own', g.id), source: 'own' as const, gameId: g.id, name: g.name, week: g.week, fromFilm: g.fromFilm })),
      ...opp.games.map((g) => ({ key: filmGameKey('opponent', g.id, currentWeek), source: 'opponent' as const, gameId: g.id, name: g.name, week: currentWeek, fromFilm: g.fromFilm, ...(g.filmFrom ? { filmFrom: g.filmFrom } : {}) })),
      ...filmOnlyGames.map((g) => ({ key: g.key, source: g.source, gameId: g.gameId, name: g.name, week: g.week, filmOnly: true })),
    ];
    return family ? list.filter((g) => g.source === 'own') : list;
  }, [own.games, opp.games, currentWeek, filmOnlyGames, family]);


  // One play's snaps from the play builder ("Watch film"). Showing the whole game, or picking another, ends it.
  const [cutup, setCutup] = useState<FilmCutup | null>(() => peekFilmCutup());
  const endCutup = () => {
    setCutup(null);
    clearFilmCutup();
  };
  // Opened from the play builder: that play, in the builder beside the video, to change while watching.
  const [builderSeed] = useState<PlayBuilderSeed | null>(() => (cutup && !locked ? peekPlayBuilderSeed() : null));
  const seedRef = useRef(builderSeed);
  const [sideTab, setSideTab] = useState<'builder' | 'breakdown' | 'notes' | 'lists' | 'drives'>(builderSeed ? 'builder' : 'breakdown');
  const [hideBuilder, setHideBuilder] = useState(false);
  const [builderSaved, setBuilderSaved] = useState('');
  const pickKey = `footballFilmroomGame_${teamId}`;
  const [gameKey, setGameKey] = useState<string | undefined>(() => safeJSONParse<string | null>(pickKey, null) || undefined);
  const game = games.find((g) => g.key === gameKey) || games[0];
  useEffect(() => {
    if (game) safeJSONSet(pickKey, game.key);
  }, [game, pickKey]);

  const plays = useMemo(() => {
    if (!game) return [];
    if (game.filmOnly) return clipPlays;
    const b = game.source === 'own' ? own : opp;
    const onlyGame = b.games.length === 1;
    return b.plays
      .filter((p) => p.gameId === game.gameId || (onlyGame && !p.gameId))
      .sort((a, c) => (Number(a.playNumber) || 0) - (Number(c.playNumber) || 0));
  }, [game, own, opp, clipPlays]);

  const [odk, setOdkState] = useState<OdkFilter>(() => {
    try {
      return (sessionStorage.getItem('filmroomOdk') as OdkFilter) || 'all';
    } catch {
      return 'all';
    }
  });
  const setOdk = (next: OdkFilter) => {
    setOdkState(next);
    try {
      sessionStorage.setItem('filmroomOdk', next);
    } catch {
      /* only a convenience */
    }
  };
  // Under the film: the play log, or the drive chart (remembered on this device).
  const [logView, setLogViewState] = useState<'log' | 'drives'>(() => {
    try {
      return localStorage.getItem('footballFilmroomLogView') === 'drives' ? 'drives' : 'log';
    } catch {
      return 'log';
    }
  });
  const setLogView = (next: 'log' | 'drives') => {
    setLogViewState(next);
    try {
      localStorage.setItem('footballFilmroomLogView', next);
    } catch {
      /* only a convenience */
    }
  };
  const shownPlays = useMemo(() => {
    const base = odk === 'all' ? plays : plays.filter((p) => p.odk === odk);
    if (!cutup) return base;
    const want = new Set(cutup.playIds);
    const byId = new Map(base.filter((p) => want.has(p.id)).map((p) => [p.id, p]));
    return cutup.playIds.map((id) => byId.get(id)).filter(Boolean) as Play[];
  }, [plays, odk, cutup]);

  const { shared, update } = useSharedGame(teamId, game?.key);
  // Unlinking saves an empty link (newest wins when coaches' copies merge, so it doesn't come back).
  const setDrive = useCallback((drive: typeof shared.drive) => update((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })), [update]);
  // The shared film folder ("Mahopac Film": every team and game inside), one link for the whole program.
  const root = useSharedGame('program', 'root');
  const updateRoot = root.update;
  const setRootDrive = useCallback((drive: typeof shared.drive) => updateRoot((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })), [updateRoot]);
  // Which folder holds this game in a week with several (one pick, for the whole staff).
  const setPick = useCallback((name: string) => update((s) => ({ ...s, folderPick: { name, editedAt: Date.now() } })), [update]);
  const { film, chooseFolder, reconnect, pickFiles, pickFolderFiles, linkDrive, signInToDrive, unlink, localFiles, sources, sourcePref, playFromComputer, playFromDrive, playingFrom, setView, choose, getRootNodes } = useGameFilm({
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
  // The game's clips without the ones a coach took out (the plays after one move up a clip).
  const removedSet = useMemo(() => new Set(Object.entries(shared.removedClips || {}).filter(([, r]) => r?.removed).map(([n]) => n)), [shared.removedClips]);
  const liveClips = useMemo(() => (film.status === 'ready' ? film.clips.filter((c) => !removedSet.has(c.name)) : []), [film, removedSet]);
  // A film-only game's plays are its clips.
  useEffect(() => {
    if (!game?.filmOnly) return setClipPlays((c) => (c.length ? [] : c));
    const next = film.status === 'ready' ? playsFromClips(liveClips, game.gameId) : [];
    setClipPlays((c) => (c.length === 0 && next.length === 0 ? c : next));
  }, [game?.key, game?.filmOnly, game?.gameId, film, liveClips]);

  // Film with no Hudl breakdown: once its clips are in, it becomes a Hudl Scout game with one blank play per
  // clip (same game id, so the film link and notes stay), and the coach fills the plays in while watching.
  const madeBreakdown = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!game?.filmOnly || film.status !== 'ready' || !liveClips.length || isReadOnlySession()) return;
    if (madeBreakdown.current.has(game.key)) return;
    const week = game.week || '';
    const w = filmWeeks?.find((x) => x.key === week);
    // A scouting week this screen hasn't loaded (not this week, not in the season list): its report is unknown
    // here, so nothing is written (an empty copy would replace its breakdown and play names; Oct 26).
    if (game.source !== 'own' && week !== currentWeek && !w) return;
    const target = game.source === 'own' ? own : bundleFromSaved(week === currentWeek ? opponentScout : w?.hudlScout, w?.opponent || 'Opponent');
    // Deleted in Hudl Scout: leave it as plain film.
    if (target.games.some((g) => g.id === game.gameId || sameFolderGame(g.id, game.gameId)) || (target.deletedGameIds || []).includes(game.gameId)) return;
    madeBreakdown.current.add(game.key);
    const fresh = blankPlays(liveClips, game.gameId);
    const now = Date.now();
    const g: ScoutGame = { id: game.gameId, name: game.name, playCount: fresh.length, addedAt: now, fromFilm: true, ...(week ? { week } : {}) };
    // Notes and drawings already made on the clips move to their plays.
    const moved = new Map(playsFromClips(liveClips, game.gameId).map((p) => [p.id, breakdownPlayId(p.id, game.gameId)]));
    if ([...moved.keys()].some((id) => shared.notes.some((n) => n.playId === id) || shared.drawings[id])) {
      update((st) => ({
        ...st,
        notes: st.notes.map((n) => (moved.has(n.playId) ? { ...n, playId: moved.get(n.playId)!, editedAt: now } : n)),
        drawings: Object.fromEntries(Object.entries(st.drawings).map(([id, d]) => [moved.get(id) || id, moved.has(id) ? { ...d, editedAt: now } : d])),
      }));
    }
    const next = { plays: [...target.plays, ...fresh], games: [...target.games, g], sourceCleared: false, updatedAt: now };
    if (game.source === 'own') onUpdateOwnTeamScout({ ...own, ...next });
    else {
      onSaveWeekScouting?.(week, { ...((week === currentWeek ? opponentScout : w?.hudlScout) || {}), ...next, datasetName: target.datasetName || w?.opponent || '', deletedGameIds: target.deletedGameIds });
      if (week && week !== currentWeek) onSelectWeek?.(week);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.key, game?.filmOnly, film]);

  // Breakdown files in the film folder become Hudl Scout games (checked when the film folder can be read).
  const breakdowns = useFolderBreakdowns({
    getRootNodes,
    rootKey: `${sources.local ? 'L' : ''}${sources.drive ? 'D' : ''}${film.status === 'ready' && film.viaRoot ? 'R' : ''}`,
    teamName,
    own,
    weeks: filmWeeks || [],
    currentWeek,
    opponentScout,
    playDatabase,
    onUpdateOwnTeamScout,
    onSaveWeekScouting,
    onFilmFolders,
  });

  const clips = liveClips;
  const clipFor = useMemo(() => matchClipsToPlays(clips, plays, shared.clipPicks), [clips, plays, shared.clipPicks]);
  // Empty plays added to a scouting game's breakdown for film that was really our game's (Oct 2026): taken
  // back out, as long as nobody has filled them in. Their ids end in "-x<play number>".
  const unpadded = useRef(false);
  useEffect(() => {
    if (unpadded.current || locked || !opp.plays.length) return;
    const isBlankExtra = (p: Play) =>
      /-x\d+$/.test(p.id) && p.odk === 'UNKNOWN' && !p.playName && !p.callName && !p.formation && !p.result && !p.playType && !Number(p.down) && !p.playCall;
    const extra = opp.plays.filter(isBlankExtra);
    unpadded.current = true;
    if (!extra.length) return;
    const gone = new Set(extra.map((p) => p.id));
    const plays = opp.plays.filter((p) => !gone.has(p.id));
    const now = Date.now();
    onUpdateScouting('hudlScout', {
      ...((opponentScout as object) || {}),
      plays,
      games: opp.games.map((g) => {
        const n = plays.filter((p) => p.gameId === g.id).length;
        return n && n !== g.playCount ? { ...g, playCount: n } : g;
      }),
      updatedAt: now,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp.plays.length]);
  // More clips than plays (film in order): the breakdown gets an empty play for each clip it's missing, so
  // every clip has a spot (98 clips -> 98 plays). Added once per game, numbered after its last play;
  // Line up film puts them where they belong.
  const paddedFor = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Our games only, with film the app found for this game in the film folder (a folder linked by hand can be
    // another game's; a scouting game once got empty plays for our game's film).
    if (!game || game.source !== 'own' || game.filmOnly || locked || film.status !== 'ready' || !film.viaRoot) return;
    if (!clips.length || clips.length <= plays.length || clipMatchMode(clips, plays) !== 'order') return;
    const key = `${game.key}|${clips.length}`;
    if (paddedFor.current.has(key)) return;
    paddedFor.current.add(key);
    const last = plays.reduce((m, p) => Math.max(m, Number(p.playNumber) || 0), 0);
    const extra = blankPlays(clips, game.gameId)
      .slice(plays.length)
      .map((p, k) => ({ ...p, id: `${p.id}-x${last + k + 1}`, playNumber: last + k + 1, gameId: game.gameId }));
    if (!extra.length) return;
    const now = Date.now();
    const b = game.source === 'own' ? own : opp;
    const next = {
      plays: [...b.plays, ...extra],
      games: b.games.map((g) => (g.id === game.gameId ? { ...g, playCount: plays.length + extra.length } : g)),
      updatedAt: now,
    };
    if (game.source === 'own') onUpdateOwnTeamScout({ ...own, ...next });
    else onUpdateScouting('hudlScout', { ...((opponentScout as object) || {}), ...next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.key, film.status, clips.length, plays.length]);
  // Clips in the order they're matched (by name): stepping a play's clip moves through this list.
  const clipsInOrder = useMemo(() => clips.map((c, i) => ({ c, i })).sort((a, b) => naturalCompare(a.c.name, b.c.name)), [clips]);
  /** Take this play's video out of the game: every play after it moves up one clip. The file stays (bring it back from More). */
  const removeClipOf = (p: Play) => {
    const i = clipFor.get(p.id);
    const c = i !== undefined ? clips[i] : undefined;
    if (!c) return;
    if (!window.confirm(`Remove "${c.name}" from this game? Play #${p.playNumber} and every play after it move up one video. The file isn't deleted, and you can bring it back from More.`)) return;
    update((st) => ({ ...st, removedClips: { ...(st.removedClips || {}), [c.name]: { removed: true, editedAt: Date.now() } } }));
  };
  const restoreClips = () =>
    update((st) => ({
      ...st,
      removedClips: Object.fromEntries(Object.entries(st.removedClips || {}).map(([n, r]) => [n, r?.removed ? { removed: false, editedAt: Date.now() } : r])),
    }));
  /** Line the play up with another clip (the plays after it follow); null takes the coach's pick back. */
  const pickClip = (playId: string, clipName: string | null) =>
    update((s) => ({ ...s, clipPicks: { ...(s.clipPicks || {}), [playId]: { clip: clipName || '', editedAt: Date.now() } } }));

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
  // Open the game those snaps are in, once (tagging a play later mustn't pull the coach back to it).
  const cutupGamePicked = useRef(false);
  useEffect(() => {
    if (!cutup || cutupGamePicked.current) return;
    const score = (g: (typeof games)[number]) => {
      const b = g.source === 'own' ? own : opp;
      const ids = new Set(cutup.playIds);
      return b.plays.filter((p) => ids.has(p.id) && (!p.gameId || p.gameId === g.gameId)).length;
    };
    const g = [...games].sort((a, b) => score(b) - score(a))[0];
    if (g && score(g) > 0) {
      cutupGamePicked.current = true;
      setGameKey(g.key);
    }
  }, [cutup, games, own, opp]);
  // A play picked from a playlist in another game: watched once that game is open.
  const pendingPlay = useRef<string | undefined>(undefined);
  const pendingGame = useRef<string | undefined>(undefined);
  useEffect(() => {
    const wanted = pendingPlay.current;
    pendingPlay.current = undefined;
    setPlayId(wanted || cutup?.playIds[0]);
  }, [game?.key, setPlayId, cutup]);
  // Another week's scouting film: open once the app has switched to that week.
  useEffect(() => {
    const key = pendingGame.current;
    if (key && games.some((g) => g.key === key)) {
      pendingGame.current = undefined;
      setGameKey(key);
    }
  }, [games]);
  const switchView = (i: number) => {
    resumeAt.current = apiRef.current?.time() || 0;
    setView(i);
  };
  const play: Play | undefined = plays.find((p) => p.id === playId) || playOrder[0];
  const idx = play ? playOrder.indexOf(play) : -1;
  const next = idx >= 0 ? playOrder[idx + 1] : playOrder[0];
  const prev = idx > 0 ? playOrder[idx - 1] : undefined;
  // The next snap in the game (not the next row in a filtered or sorted list, and past clips that aren't plays), as
  // the AI window's proof of where this play ended (endProof: not when it only repeats this play's own gain).
  const nextSnap = play ? endProof(plays, play) : undefined;
  const stepList = (d: number) => {
    if (!listPlay) return;
    const index = listPlay.index + d;
    const item = listPlay.items[index];
    if (!item) return;
    setListPlay({ ...listPlay, index });
    watchItem(item);
  };

  // Tag changes are saved to the game's Hudl Scout breakdown (ours, or this week's opponent).
  const source = game?.source || 'own';
  const editPlays = (change: (all: Play[]) => Play[]) => {
    const now = Date.now();
    if (source === 'own') onUpdateOwnTeamScout({ ...own, plays: change(own.plays), updatedAt: now });
    else onUpdateScouting('hudlScout', { ...((opponentScout as object) || {}), plays: change(opp.plays), updatedAt: now });
  };
  const isOwn = source === 'own';
  // Play names lost from their plays but still on Their plays' cards (each card keeps its name and clips).
  const lostNames = useMemo(
    () => (isOwn ? [] : namesFromCards(opp.plays, (opp as { playLibraries?: Record<string, any[]> }).playLibraries as any, parseCall)),
    [isOwn, opp]
  );
  const bringBackNames = () => {
    const by = new Map(lostNames.map((x) => [x.id, x]));
    const now = Date.now();
    editPlays((all) => all.map((p) => { const x = by.get(p.id); return x && !p.callName ? { ...p, callName: x.callName, callParts: x.callParts, callEditedAt: now, editedAt: now } : p; }));
  };
  // Their film: the formations drawn for this report (Their plays, step 1), to pick per clip or draw a new one.
  const drawnFormations = useMemo(
    () => ((opp as { oppFormations?: { id: string; name: string; deleted?: boolean; builder?: unknown }[] }).oppFormations || [])
      .filter((f) => f?.id && !f.deleted)
      .map((f) => ({ id: f.id, name: f.name, drawn: Boolean(f.builder) })),
    [opp]
  );
  // Their film: the plays already in Their plays (each with its formation) can be picked when tagging.
  const theirCalls = useMemo(() => theirCallEntries(opp.playLibraries), [opp.playLibraries]);
  // Import breakdown: a Hudl file's plays go into the game that's open (not a new game), play N onto play N.
  const importInput = useRef<HTMLInputElement>(null);
  const [importNote, setImportNote] = useState('');
  const importBreakdown = async (file: File) => {
    if (!game) return;
    let fresh: Play[];
    try {
      fresh = await readBreakdown(file.name, file);
    } catch {
      return window.alert(`Couldn't read ${file.name}. Use the CSV or Excel export from Hudl.`);
    }
    if (!fresh.length) return window.alert(`No plays found in ${file.name}.`);
    if (game.filmOnly) return importIntoFilmOnly(fresh, file.name);
    const entered = plays.filter((p) => !game.fromFilm || isBrokenDown(p)).length;
    if (entered && !window.confirm(`Replace the ${plays.length} plays of ${game.name} with the ${fresh.length} plays in ${file.name}? Notes, drawings and tags stay with the plays in order.`)) return;
    const b = isOwn ? own : opp;
    const ids = new Set(plays.map((p) => p.id));
    let merged = importIntoGame(plays, fresh, game.gameId);
    if (isOwn && playDatabase?.length) merged = autoTagFromHudl(merged, playDatabase, new Set(merged.filter((p) => !p.playCallId).map((p) => p.id))).plays;
    merged = assignDrives(merged);
    const now = Date.now();
    const next = {
      plays: [...b.plays.filter((p) => !ids.has(p.id)), ...merged],
      games: b.games.map((g) => (g.id === game.gameId ? { ...g, playCount: merged.length, fromFilm: false, editedAt: now } : g)),
      sourceCleared: false,
      updatedAt: now,
    };
    if (isOwn) onUpdateOwnTeamScout({ ...own, ...next });
    else onUpdateScouting('hudlScout', { ...((opponentScout as object) || {}), ...next });
    setImportNote(`Imported ${merged.length} plays from ${file.name}`);
    window.setTimeout(() => setImportNote(''), 4000);
  };
  // Film with no breakdown yet: the file makes the game (the film's id, so the film and notes stay with it),
  // play N on clip N.
  const importIntoFilmOnly = (fresh: Play[], fileName: string) => {
    if (!game) return;
    const week = game.week || '';
    const w = filmWeeks?.find((x) => x.key === week);
    const saved = week === currentWeek ? opponentScout : w?.hudlScout;
    const target = game.source === 'own' ? own : bundleFromSaved(saved, w?.opponent || 'Opponent');
    if (target.games.some((g) => g.id === game.gameId)) return window.alert('This game is being set up from its film. Try again in a moment.');
    madeBreakdown.current.add(game.key); // no blank plays for it as well
    const clipsNow = liveClips;
    let merged = importIntoGame(clipsNow.length ? blankPlays(clipsNow, game.gameId) : [], fresh, game.gameId);
    if (game.source === 'own' && playDatabase?.length) merged = autoTagFromHudl(merged, playDatabase, new Set(merged.map((p) => p.id))).plays;
    merged = assignDrives(merged);
    const now = Date.now();
    // Notes and drawings already made on the clips move to their plays.
    const moved = new Map(playsFromClips(clipsNow, game.gameId).slice(0, merged.length).map((p) => [p.id, breakdownPlayId(p.id, game.gameId)]));
    if ([...moved.keys()].some((id) => shared.notes.some((n) => n.playId === id) || shared.drawings[id])) {
      update((st) => ({
        ...st,
        notes: st.notes.map((n) => (moved.has(n.playId) ? { ...n, playId: moved.get(n.playId)!, editedAt: now } : n)),
        drawings: Object.fromEntries(Object.entries(st.drawings).map(([id, d]) => [moved.get(id) || id, moved.has(id) ? { ...d, editedAt: now } : d])),
      }));
    }
    const g: ScoutGame = { id: game.gameId, name: game.name, playCount: merged.length, addedAt: now, ...(week ? { week } : {}) };
    const next = { plays: [...target.plays, ...merged], games: [...target.games, g], sourceCleared: false, updatedAt: now };
    if (game.source === 'own') onUpdateOwnTeamScout({ ...own, ...next });
    else {
      onSaveWeekScouting?.(week, { ...((saved as object) || {}), ...next, datasetName: target.datasetName || w?.opponent || '', deletedGameIds: target.deletedGameIds });
      if (week && week !== currentWeek) onSelectWeek?.(week);
    }
    setImportNote(`Imported ${merged.length} plays from ${fileName}`);
    window.setTimeout(() => setImportNote(''), 4000);
  };

  // Remove a game from the library: a Hudl game goes from Hudl Scout too; film found in the folder is only
  // left out (both remembered as removed, so a rescan doesn't bring them back). Video files stay where they are.
  const removeGame = (g: LibraryGame) => {
    if (locked) return;
    const plays = g.filmOnly ? 0 : g.plays;
    const msg = g.filmOnly
      ? `Remove "${g.name}" from the film library? The video files stay in the folder; checking the film folder won't add it back.`
      : `Remove "${g.name}"${plays ? ` (${plays} plays)` : ''} for every coach? Its breakdown and tags go with it (the video files stay in the folder).`;
    if (!window.confirm(msg)) return;
    const tombstone = (b: ScoutBundle): ScoutBundle =>
      g.filmOnly ? { ...b, ...markGamesDeleted(b, [g.gameId]), updatedAt: Date.now() } : removeScoutGame(b, g.gameId, b.datasetName);
    if (g.source === 'own') onUpdateOwnTeamScout(tombstone(own));
    else {
      const week = g.week || currentWeek;
      const w = filmWeeks?.find((x) => x.key === week);
      const saved = week === currentWeek ? opponentScout : w?.hudlScout;
      const next = tombstone(bundleFromSaved(saved, w?.opponent || opponentName || 'Opponent'));
      const merged = { ...((saved as object) || {}), plays: next.plays, games: next.games, deletedGameIds: next.deletedGameIds, deletedGameAt: next.deletedGameAt, datasetName: next.datasetName, sourceCleared: next.sourceCleared, updatedAt: Date.now() };
      if (week === currentWeek) onUpdateScouting('hudlScout', merged);
      else onSaveWeekScouting?.(week, merged);
    }
    if (game?.key === g.key) setGameKey(undefined);
  };

  // Scouting film of another week used for this one: copied into that week's report, from either team's side.
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyWeek, setCopyWeek] = useState('');
  const [copySwitch, setCopySwitch] = useState<boolean | null>(null);
  const copyTargets = (filmWeeks || []).filter((w) => w.key !== game?.week);
  const openCopy = () => {
    if (!game) return;
    // The week whose opponent is named in the game ("Carmel_O vs Shrub Oak" -> the Shrub Oak week).
    const norm = (x: string) => ` ${String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
    const guess = copyTargets.find((w) => w.opponent && norm(game.name).includes(norm(w.opponent).replace(/^ (at|vs) /, ' ')));
    setCopyWeek(guess?.key || '');
    setCopySwitch(null);
    setCopyOpen(true);
  };
  const doCopy = () => {
    if (!game || game.source !== 'opponent' || !copyWeek || copySwitch == null) return;
    const w = filmWeeks?.find((x) => x.key === copyWeek);
    const target = bundleFromSaved(w?.hudlScout, w?.opponent || 'Opponent');
    const g = opp.games.find((x) => x.id === game.gameId);
    if (!g) return;
    const fromOpponent = filmWeeks?.find((x) => x.key === game.week)?.opponent || opponentName || '';
    const copy = copyScoutGame(opp.plays, g, { switchSides: copySwitch, fromWeek: g.filmFrom?.week || game.week, fromOpponent: g.filmFrom?.opponent || fromOpponent });
    onSaveWeekScouting?.(copyWeek, {
      ...((w?.hudlScout as object) || {}),
      plays: [...target.plays, ...copy.plays],
      games: [...target.games, copy.game],
      datasetName: target.datasetName || w?.opponent || '',
      deletedGameIds: target.deletedGameIds,
      sourceCleared: false,
      updatedAt: Date.now(),
    });
    setCopyOpen(false);
    const label = weekOptions?.find((x) => x.key === copyWeek)?.label || copyWeek;
    setImportNote(`Copied to ${label}${copySwitch ? ' (O and D switched)' : ''}`);
    window.setTimeout(() => setImportNote(''), 5000);
    if (onSelectWeek && window.confirm(`Copied "${g.name}" to ${label}. Go to ${label} now?`)) {
      onSelectWeek(copyWeek);
      setGameKey(filmGameKey('opponent', copy.game.id, copyWeek));
    }
  };

  // The same game twice (one copy made from the film, still blank, and one uploaded from Hudl): merge them.
  // The top bar's More menu (closes on a click outside it).
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => !moreRef.current?.contains(e.target as Node) && setMoreOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreOpen]);
  // One film folder's game made twice (from its film and from its breakdown file): merged into one by itself,
  // the notes and drawings of the removed copy moved onto the same plays.
  const mergedCopies = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (locked) return;
    for (const source of ['own', 'opponent'] as const) {
      const b = source === 'own' ? own : opp;
      const pairs = folderCopies(b).filter((p) => !mergedCopies.current.has(p.drop.id));
      if (!pairs.length) continue;
      let next = b;
      for (const { keep, drop } of pairs) {
        mergedCopies.current.add(drop.id);
        const r = mergeFolderCopies(next, keep.id, drop.id);
        next = r.bundle;
        const keyOf = (id: string) => filmGameKey(source, id, source === 'opponent' ? currentWeek : undefined);
        void moveSharedNotes(teamId, keyOf(drop.id), keyOf(keep.id), r.moved);
        if (gameKey === keyOf(drop.id)) setGameKey(keyOf(keep.id));
      }
      if (source === 'own') onUpdateOwnTeamScout(next);
      else onUpdateScouting('hudlScout', { ...((opponentScout as object) || {}), ...next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own.games.length, opp.games.length, locked]);
  // A patch from the play-name boxes, the players or the AI window, with its own stamps.
  const patched = (x: Play, patch: Partial<Play>): Play => {
    const out = { ...x, ...patch, editedAt: Date.now(), ...('callParts' in patch ? { callEditedAt: Date.now() } : {}) };
    if ('strength' in patch && !patch.strength) delete out.strength;
    // Who had the ball also reads in the play log's players column.
    if ('rusher' in patch || 'passer' in patch || 'receiver' in patch) {
      out.carrierOrTarget = (out.playType === 'RUN' ? out.rusher || out.receiver || out.passer : out.receiver || out.rusher || out.passer) || '';
    }
    return out;
  };
  // Saving a play's breakdown (with the AI window's extras) also starts the next snap where the rules say this
  // play left it (nextPlay.ts). One change for all of it: a second save in the same click would be made from the
  // plays as they were before the first and undo it.
  const saveBreakdown = (p: Play, row: BreakdownRow, patch?: Partial<Play>) =>
    editPlays((all) => {
      const base = all.find((x) => x.id === p.id);
      const follow = base ? followOn(all, base, row) : undefined;
      return all.map((x) => {
        if (x.id === p.id) {
          const done = applyBreakdown(x, row);
          return patch && Object.keys(patch).length ? patched(done, patch) : done;
        }
        // The rules' fill is stamped one tick after the copy it filled, not now: plays merge between coaches'
        // devices by newest edit, so a fill never wins over a coach's own breakdown of that play made elsewhere.
        return follow && x.id === follow.play.id ? { ...applyBreakdown(x, follow.row), editedAt: (Number(x.editedAt) || 0) + 1 } : x;
      });
    });
  // The AI window's note, once (applying the same play again doesn't add it twice).
  const addAiNote = (p: Play, notes?: string) => {
    const text = String(notes || '').trim();
    if (text && !notesFor(p.id).some((n) => n.text.trim() === text)) addNote(text, undefined, apiRef.current?.time() || 0);
  };
  const breakdownNext = (row: BreakdownRow, patch?: Partial<Play>, notes?: string) => {
    if (!play) return;
    saveBreakdown(play, row, patch);
    addAiNote(play, notes);
    if (next) setPlayId(next.id);
  };
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
  // The video on a second screen (a TV or monitor): that window plays the clip, this one keeps the play log.
  const [tvOn, setTvOn] = useState(false);
  useVideoScreenSender({
    on: tvOn,
    key: `${clip?.id || ''}|${clipUrl.url || ''}`,
    title: play ? playTitle(play) : '',
    getVideo: () => apiRef.current?.video?.() || null,
    getBlob: async () => (clipUrl.url ? (await fetch(clipUrl.url)).blob() : null),
  });
  // How to get the video window onto the TV (iPads won't always pull a tab out of the browser into its own window).
  const [tvHelp, setTvHelp] = useState(false);
  const [tvCopied, setTvCopied] = useState(false);
  const copyTvLink = () => {
    navigator.clipboard?.writeText(screenUrl()).then(() => setTvCopied(true), () => setTvCopied(false));
  };
  const startTv = () => {
    copyTvLink();
    openVideoScreen();
    setTvOn(true);
    setTvHelp(true);
  };
  const [linkOpen, setLinkOpen] = useState(false);
  // Player finder: every play one of our players was part of, all season.
  const [playersOpen, setPlayersOpen] = useState(false);
  // Opened from the play builder, the library starts closed so the builder has room beside the video.
  const [libraryDesk, setLibraryDesk] = useState(() => !builderSeed && safeJSONParse<boolean>('footballFilmroomLibrary', true));
  const [libraryPhone, setLibraryPhone] = useState(false);
  const [mobileTab, setMobileTab] = useState<'plays' | 'notes' | 'builder' | 'breakdown' | 'lists'>('plays');

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
  // The side panel's width: dragged by its left edge (wider for the drives or notes, narrower for more video),
  // remembered on this computer; a double-click puts it back.
  const SIDE_W = 320;
  const clampSideW = (w: number) => Math.round(Math.max(260, Math.min(w, typeof window !== 'undefined' ? window.innerWidth * 0.6 : 900)));
  const [sideW, setSideW] = useState<number>(() => safeJSONParse<number | null>('footballFilmroomSideW', null) || SIDE_W);
  const sideDrag = useRef<{ x: number; w: number } | null>(null);
  const onSideDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    sideDrag.current = { x: e.clientX, w: sideW };
  };
  const onSideMove = (e: React.PointerEvent) => {
    if (sideDrag.current) setSideW(clampSideW(sideDrag.current.w + sideDrag.current.x - e.clientX));
  };
  const onSideUp = () => {
    if (!sideDrag.current) return;
    sideDrag.current = null;
    safeJSONSet('footballFilmroomSideW', sideW);
  };

  const notesFor = useCallback((id: string) => shared.notes.filter((n) => n.playId === id), [shared.notes]);

  // Favorites and playlists (each coach's own favorites; playlists shared with chosen people).
  const filmLists = useFilmLists(teamId);
  const me = userEmail.toLowerCase().trim();
  const canList = Boolean(me) && !locked;
  const clipRefOf = (p: Play): ClipRef | undefined =>
    game
      ? {
          gameKey: game.key,
          source: game.source,
          gameId: game.gameId,
          ...(game.week ? { week: game.week } : {}),
          playId: p.id,
          label: `${game.name} · ${playTitle(p) || `#${p.playNumber}`}`,
          info: playInfo(p, game.name),
        }
      : undefined;
  /** One of our games' plays as a playlist clip (for the player finder's playlists). */
  const ownClipRef = (p: Play): ClipRef | undefined => {
    const g = own.games.find((x) => x.id === p.gameId);
    if (!g) return undefined;
    return {
      gameKey: filmGameKey('own', g.id),
      source: 'own',
      gameId: g.id,
      playId: p.id,
      label: `${g.name} · ${playTitle(p) || `#${p.playNumber}`}`,
      info: playInfo(p, g.name),
    };
  };
  /** A playlist clip's breakdown: from the game when it's loaded here (it may have been filled in since), else the copy saved with it. */
  const infoOf = (item: ClipRef): PlayInfo | undefined => {
    // Our games are all loaded; a scouting game only when it's this week's.
    const b = item.source === 'own' ? own : games.some((g) => g.key === item.gameKey) ? opp : undefined;
    const live = b?.plays.find((p) => p.id === item.playId);
    return live ? playInfo(live, item.info?.game || games.find((g) => g.key === item.gameKey)?.name) : item.info;
  };
  const [listPlay, setListPlay] = useState<{ id: string; name: string; items: ClipRef[]; index: number } | null>(null);
  const [libTab, setLibTab] = useState<'games' | 'lists'>(() => (safeJSONParse<string>('footballFilmroomLibTab', 'games') === 'lists' ? 'lists' : 'games'));
  const pickLibTab = (t: 'games' | 'lists') => {
    setLibTab(t);
    safeJSONSet('footballFilmroomLibTab', t);
  };
  const [listNote, setListNote] = useState('');
  /** Watch a play from a playlist (its game opened first, from another week too). */
  const watchItem = (item: ClipRef) => {
    setListNote('');
    if (game?.key === item.gameKey) return setPlayId(item.playId);
    if (games.some((g) => g.key === item.gameKey)) {
      pendingPlay.current = item.playId;
      return setGameKey(item.gameKey);
    }
    if (item.source === 'opponent' && item.week && item.week !== currentWeek && onSelectWeek) {
      pendingPlay.current = item.playId;
      pendingGame.current = item.gameKey;
      return onSelectWeek(item.week);
    }
    setListNote(`"${item.label}" isn't available here (its game was removed or isn't shared with you).`);
  };
  // A playlist play with no film (or film that can't be opened here): on to the next one by itself.
  useEffect(() => {
    if (!listPlay || listPlay.index >= listPlay.items.length - 1) return;
    const item = listPlay.items[listPlay.index];
    if (!item || game?.key !== item.gameKey) return;
    const noClip = film.status === 'ready' ? Boolean(play && play.id === item.playId && !clipFor.has(play.id)) : film.status === 'error' || film.status === 'none';
    if (!noClip) return;
    const t = window.setTimeout(() => stepList(1), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listPlay?.id, listPlay?.index, game?.key, film.status, play?.id]);
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
    // Not found (or couldn't open): say why, with the way to fix it right there.
    if (film.status === 'error')
      return (
        <div className="flex flex-col items-center gap-2 max-w-md text-center">
          <span className="text-rose-300 dark:text-rose-300">{locked ? "This game's film isn't ready to watch yet." : film.message}</span>
          {!locked && <button onClick={() => setLinkOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold">Link film</button>}
        </div>
      );
    if (film.status === 'reconnect')
      return (
        <div className="flex flex-col items-center gap-2">
          <button onClick={reconnect} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-2">
            <RefreshCw size={16} /> Open the film folder “{film.label}” on this computer
          </button>
          {sources.drive && (
            <button onClick={() => void playFromDrive()} className="text-xs font-bold underline">
              Use Google Drive instead
            </button>
          )}
        </div>
      );
    if (film.status === 'choose')
      return (
        <div className="flex flex-col items-center gap-2 max-w-md">
          {locked ? (
            <span>The film for <b>{game.name}</b> isn't set up yet. A coach needs to pick its folder.</span>
          ) : (
          <span>
            {film.label} has more than one game folder. Which one is <b>{game.name}</b>? (Saved for everyone.)
          </span>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {!locked && film.choices.map((c) => (
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
          {sources.local && canOpenFolders() && (
            <button onClick={() => void playFromComputer()} className="text-xs font-bold underline">
              Use this computer's copy instead
            </button>
          )}
        </div>
      );
    if (film.status === 'none')
      return (
        <div className="flex flex-col items-center gap-2">
          <Film size={28} className="text-slate-500 dark:text-slate-500" />
          <span>{locked ? 'No film for this game yet.' : 'No film linked to this game yet.'}</span>
          {!locked && <button onClick={() => setLinkOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold">Link film</button>}
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
    const ref = canList ? clipRefOf(p) : undefined;
    const starred = Boolean(ref && isFavorite(filmLists.lists, me, ref));
    return (
      <span className="inline-flex items-center gap-1.5 align-middle">
        {ref && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              filmLists.update((l) => toggleFavorite(l, me, ref));
            }}
            aria-pressed={starred}
            aria-label={starred ? `Take play ${p.playNumber} out of favorites` : `Add play ${p.playNumber} to favorites`}
            title={starred ? 'In your favorites (click to take it out)' : 'Add to your favorites'}
            className="p-0.5 -m-0.5 rounded cursor-pointer"
          >
            <Star size={12} className={starred ? 'text-amber-400 fill-current' : 'text-slate-500 hover:text-amber-400'} />
          </button>
        )}
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
  const playActions =
    canList && play && clipRefOf(play) ? (
      <PlayListActions current={clipRefOf(play)!} lists={filmLists.lists} update={filmLists.update} me={me} myName={authorName} />
    ) : null;
  const odkChips = (
    <div className="flex flex-wrap items-center gap-1">
      {playActions && <span className="inline-flex items-center gap-1 pr-1.5 mr-0.5 border-r border-slate-200 dark:border-slate-700">{playActions}</span>}
      {(['all', 'O', 'D', 'K'] as OdkFilter[]).map((k) => (
        <button key={k} className={chip(odk === k)} onClick={() => setOdk(k)}>{k === 'all' ? 'All' : k === 'O' ? 'Offense' : k === 'D' ? 'Defense' : 'Kicking'}</button>
      ))}
    </div>
  );
  // The play log or the drive chart: one click apart, the same play picked in both.
  const logSwitch = (
    <div className="flex items-center gap-1" role="group" aria-label="Show the plays as">
      <button className={chip(logView === 'log')} onClick={() => setLogView('log')}>Play log</button>
      <button className={chip(logView === 'drives')} onClick={() => setLogView('drives')}>Drive chart</button>
    </div>
  );
  const driveChart = (
    <div className={`${panel} flex flex-col min-h-0 lg:flex-1`}>
      <div className="flex flex-wrap items-center gap-2 px-2 pt-2">
        {logSwitch}
        {odkChips}
      </div>
      <DriveChart
        plays={plays}
        selectedId={play?.id}
        onSelectPlay={setPlayId}
        side={odk === 'O' || odk === 'D' ? odk : undefined}
        offenseLabel={isOwn ? teamName || 'Us' : opponentName || 'Them'}
        defenseLabel={isOwn ? opponentName || 'Them' : 'Their opponent'}
      />
    </div>
  );
  const playLog = (
    <PlaysTable
      viewKey={game ? `film-${game.key}` : undefined}
      plays={shownPlays}
      writeInPlays={(game?.source === 'opponent' ? opp : own).plays}
      selectedId={play?.id}
      onSelectPlay={setPlayId}
      onOrderChange={locked ? undefined : onOrderChange}
      rowBadge={rowBadge}
      playDatabase={playDatabase}
      onTagPlays={onUpdatePlayDatabase && !locked ? (ids, entry) => editPlays((all) => tagPlays(all, ids, entry)) : undefined}
      onCreateCall={onUpdatePlayDatabase && !locked ? createCall : undefined}
      onSetFormation={locked ? undefined : (ids, formation) => editPlays((all) => setPlaysFormation(all, ids, formation))}
      onSetUnit={isOwn && !locked ? (id: string, unit: TeamUnit | undefined, scope) => editPlays((all) => tagPlayUnits(all, id, unit, scope)) : undefined}
      lineupFor={isOwn && roster ? lineupFor : undefined}
      roster={roster}
      onSetSub={isOwn && !locked ? (id: string, slotId: string, ref: FilmPlayerRef | null | undefined) => editPlays((all) => setPlaySub(all, id, slotId, ref)) : undefined}
      onSetBall={isOwn && !locked ? (id: string, role: BallRole, label: string) => editPlays((all) => setPlayBallPlayer(all, id, role, label)) : undefined}
      onSetDefPlay={isOwn && !locked ? (id, patch) => editPlays((all) => setPlayDefPlay(all, id, patch)) : undefined}
      compact
      toolbarStart={
        <div className="flex flex-wrap items-center gap-2">
          {logSwitch}
          {odkChips}
        </div>
      }
      onDrawCall={!isOwn && onDrawSnap && !isReadOnlySession() ? onDrawSnap : undefined}
      drawUntagged={!isOwn && Boolean(onDrawSnap) && !locked}
      theirCalls={isOwn ? undefined : theirCalls}
      theirFormations={isOwn ? undefined : drawnFormations}
      onFormationAction={
        !isOwn && !locked && game && !game.filmOnly
          ? (p, pick) => {
              if (pick.kind === 'use') return editPlays((all) => setPlaysFormation(all, [p.id], pick.name));
              onDrawFormation?.({ playId: p.id, gameId: p.gameId || game.gameId, clip: Number(p.playNumber) || 0, ...(pick.id ? { id: pick.id } : {}), name: pick.name });
            }
          : undefined
      }
    />
  );
  // A family account: each play by its number, when it happened and how it went.
  const familyLine = (p: Play) => {
    const parts: string[] = [];
    if (p.quarter) parts.push(p.quarter >= 5 ? 'OT' : `Q${p.quarter}`);
    if (p.down) parts.push(`${p.down}${['', 'st', 'nd', 'rd', 'th'][p.down] || 'th'} & ${p.distance || '?'}`);
    if (p.odk === 'O' && Number.isFinite(p.gainLoss) && (p.gainLoss || p.result)) parts.push(`${p.gainLoss > 0 ? '+' : ''}${p.gainLoss} yds`);
    return parts.join(' · ');
  };
  const playlistQueue = listPlay ? (
    <div className={`${panel} flex flex-col min-h-0`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
        <ListVideo size={15} className="text-indigo-500" />
        <span className="text-sm font-black text-slate-900 dark:text-white truncate">{listPlay.name}</span>
        <span className="text-xs text-slate-500">
          {listPlay.index + 1} of {listPlay.items.length} · plays straight through
        </span>
        <button type="button" onClick={() => setListPlay(null)} className="ml-auto h-7 px-2.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
          Back to the game
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white dark:bg-slate-900">
            <tr className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              {['', 'Game', 'PL#', 'ODK', 'QTR', 'DN & DIST', 'YARD LN', 'HASH', 'Formation', 'Play', 'Type', 'Result', 'GN/LS'].map((h, k) => (
                <th key={k} className="text-left font-black px-2 py-1.5 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listPlay.items.map((it, i) => {
              const d = infoOf(it) || {};
              const on = i === listPlay.index;
              return (
                <tr
                  key={`${it.gameKey}|${it.playId}|${i}`}
                  onClick={() => {
                    setListPlay({ ...listPlay, index: i });
                    watchItem(it);
                  }}
                  aria-current={on || undefined}
                  className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/60 ${
                    on ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <td className={`px-2 py-1.5 text-right tabular-nums ${on ? 'text-white/80' : 'text-slate-400'}`}>{i + 1}.</td>
                  <td className="px-2 py-1.5 max-w-[10rem] truncate" title={d.game || it.label}>
                    {d.game || it.label.split(' · ')[0]}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{d.playNumber ?? ''}</td>
                  <td className="px-2 py-1.5">{d.odk || ''}</td>
                  <td className="px-2 py-1.5">{d.quarter ? `Q${d.quarter}` : ''}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{d.down ? `${d.down} & ${d.distance ?? ''}` : ''}</td>
                  <td className="px-2 py-1.5">{d.yardLine || ''}</td>
                  <td className="px-2 py-1.5">{d.hash || ''}</td>
                  <td className="px-2 py-1.5 max-w-[9rem] truncate" title={d.formation}>
                    {d.formation || ''}
                  </td>
                  <td className="px-2 py-1.5 max-w-[10rem] truncate font-semibold" title={d.play}>
                    {d.play || ''}
                  </td>
                  <td className="px-2 py-1.5">{d.playType || ''}</td>
                  <td className="px-2 py-1.5 max-w-[8rem] truncate" title={d.result}>
                    {d.result || ''}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{d.gain !== undefined ? (d.gain > 0 ? `+${d.gain}` : d.gain) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;
  const familyLog = (
    <div className={`${panel} flex-1 min-h-0 overflow-y-auto p-2`}>
      <ol className="space-y-0.5">
        {shownPlays.map((p) => {
          const on = p.id === play?.id;
          const has = clipFor.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPlayId(p.id)}
                aria-current={on || undefined}
                disabled={!has}
                className={`w-full text-left flex items-center gap-2 px-2.5 h-9 rounded-lg text-sm font-bold disabled:opacity-40 ${
                  on ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`w-14 shrink-0 tabular-nums text-xs ${on ? 'text-white/80' : 'text-slate-400'}`}>Play {p.playNumber}</span>
                <span className="flex-1 min-w-0 truncate font-semibold">{familyLine(p)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
  // Film with no breakdown that can't get one here (a player account, or the game was deleted in Hudl Scout): its clips.
  const clipLog = (
    <div className={`${panel} flex-1 min-h-0 overflow-y-auto p-2`}>
      <p className="px-2 pb-2 text-xs text-slate-500 dark:text-slate-400">
        {plays.length} clip{plays.length === 1 ? '' : 's'}, in the order of the file names. There&apos;s no Hudl breakdown for this game yet: use <span className="font-bold">Import breakdown</span> above
        (the CSV or Excel export from Hudl), or put the file in this game&apos;s folder and the plays fill in.
      </p>
      <ol className="space-y-0.5">
        {plays.map((p) => {
          const on = p.id === play?.id;
          const notes = notesFor(p.id).length;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPlayId(p.id)}
                aria-current={on || undefined}
                className={`w-full text-left flex items-center gap-2 px-2.5 h-9 rounded-lg text-sm font-bold ${
                  on ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`w-6 text-right tabular-nums text-xs ${on ? 'text-white/80' : 'text-slate-400'}`}>{p.playNumber}</span>
                <span className="flex-1 min-w-0 truncate">{p.playName}</span>
                {notes > 0 && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] ${on ? 'text-amber-200' : 'text-amber-500'}`}>
                    <MessageSquare size={11} />
                    {notes}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
  const openFromLibrary = (g: LibraryGame) => {
    if (g.source === 'opponent' && g.week && g.week !== currentWeek && !g.filmOnly) onSelectWeek?.(g.week);
    if (cutup) endCutup();
    setGameKey(g.key);
    setLibraryPhone(false);
  };
  const libraryEl = (onClose: () => void) => (
    <div className="flex flex-col h-full min-h-0">
      {listsEl && (
        <div className="flex items-center gap-1 px-2.5 pt-2.5 shrink-0" role="tablist" aria-label="Library">
          {(['games', 'lists'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={libTab === t}
              onClick={() => pickLibTab(t)}
              className={`h-7 px-2.5 rounded-lg text-xs font-black ${libTab === t ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {t === 'games' ? 'Games' : 'Playlists'}
            </button>
          ))}
          <button type="button" onClick={onClose} className="ml-auto p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close the library">
            <X size={16} />
          </button>
        </div>
      )}
      {listsEl && libTab === 'lists' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">{listsEl}</div>
      ) : (
        <div className="flex-1 min-h-0">{libraryList(listsEl ? undefined : onClose)}</div>
      )}
    </div>
  );
  const libraryList = (onClose?: () => void) => (
    <FilmLibrary
      title={listsEl ? '' : undefined}
      weeks={library.weeks}
      otherGames={library.others}
      currentWeek={currentWeek}
      selectedKey={game?.key}
      onOpen={openFromLibrary}
      onClose={onClose}
      added={breakdowns.added}
      checking={breakdowns.checking}
      onCheckFolder={!locked && (sources.local || sources.drive) ? breakdowns.checkNow : undefined}
      folderNeedsTap={breakdowns.localBlocked}
      lastCheck={breakdowns.lastCheck}
      unplaced={filmFolders.unplaced}
      onRemove={locked || family ? undefined : removeGame}
    />
  );
  const builderEl = builderSeed ? (
    <PlayBuilderSection
      key={builderSeed.playEntryId || builderSeed.name}
      compact
      canEdit={Boolean(builderCanEdit && onSaveBuilderPlay)}
      seed={builderSeed}
      onStateChange={(state) => {
        // The play as it is on screen, including a name they typed, goes back to the builder with Back.
        if (!seedRef.current) return;
        const name = state.name?.trim() || seedRef.current.name;
        seedRef.current = { ...seedRef.current, name, builder: { ...state, name } };
        savePlayBuilderSeed(seedRef.current);
        if (name) setCutup((c) => (c && c.label !== name ? { ...c, label: name } : c));
      }}
      onRename={
        builderSeed.scoutId && onRenameScoutPlay
          ? (from, to) =>
              onRenameScoutPlay({ from, to, scoutId: builderSeed.scoutId, gameId: builderSeed.gameId, playEntryId: builderSeed.playEntryId })
          : undefined
      }
      onSaveFilmBackfield={
        onSaveFilmBackfield
          ? (change) => {
              if (seedRef.current) {
                seedRef.current = {
                  ...seedRef.current,
                  filmBases: { ...(seedRef.current.filmBases || {}), [change.backfield]: change.spots },
                  filmBaseKeys: { ...(seedRef.current.filmBaseKeys || {}), [change.backfield]: change.baseKey },
                };
                savePlayBuilderSeed(seedRef.current);
              }
              onSaveFilmBackfield(change);
            }
          : undefined
      }
      onAdd={(entry) => {
        const saved = onSaveBuilderPlay?.(entry, seedRef.current);
        if (!saved || !seedRef.current) return;
        seedRef.current = { ...seedRef.current, name: saved.name, builder: saved.builder };
        savePlayBuilderSeed(seedRef.current);
        setBuilderSaved(`Saved ${saved.name}`);
        window.setTimeout(() => setBuilderSaved(''), 2500);
      }}
    />
  ) : null;
  // Beside the video: the play builder (when it sent us here) or the notes, with a switch between them.
  const sideShown = builderSeed ? !hideBuilder : showNotes && !family;
  const fromFilm = Boolean(game?.fromFilm);
  // Every game's breakdown can be changed beside the video (Hudl's or one broken down here).
  const editable = Boolean(game && !game.filmOnly) && !locked;
  // Drives: the drive chart as a column beside the video (any game with a breakdown).
  const sideTabList = [
    ...(builderSeed ? (['builder'] as const) : []),
    ...(editable ? (['breakdown'] as const) : []),
    'notes' as const,
    ...(game && !game.filmOnly ? (['drives'] as const) : []),
  ];
  const activeSide = sideTabList.includes(sideTab as never) ? sideTab : sideTabList[0];
  const sideIsBuilder = activeSide === 'builder';
  const sideTabs = sideTabList.length > 1 ? (
    <div className="flex flex-wrap items-center gap-1 px-2 pt-2">
      {sideTabList.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setSideTab(t)}
          className={`h-7 px-2.5 rounded-lg text-xs font-black ${
            activeSide === t ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t === 'drives' ? 'Drives' : t === 'builder' ? 'Play builder' : t === 'breakdown' ? `Breakdown${play ? ` · #${play.playNumber}` : ''}` : `Notes${play && notesFor(play.id).length ? ` (${notesFor(play.id).length})` : ''}`}
        </button>
      ))}
      {builderSaved && <span className="ml-auto text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{builderSaved}</span>}
    </div>
  ) : null;
  const breakdownEl = (
    <BreakdownPanel
      play={play}
      suggestFrom={(isOwn ? own : opp).plays}
      onSave={(p, row) => saveBreakdown(p, row)}
      next={next}
      nextSnap={nextSnap}
      onNext={breakdownNext}
      filledFrom={play ? filledFrom(plays, play) : undefined}
      readOnly={isReadOnlySession()}
      onSetUnit={isOwn ? (p, unit) => editPlays((all) => tagPlayUnits(all, p.id, unit, 'play')) : undefined}
      videoElement={apiRef.current?.video?.() || null}
      getVideo={() => apiRef.current?.video?.() || null}
      roster={roster}
      teamName={teamName}
      isOwnGame={isOwn}
      gameId={game?.gameId || game?.key || ''}
      opponentName={opponentName}
      isProgramAdmin={isProgramAdmin}
      onAddNote={(id, text) => addNote(text, undefined, apiRef.current?.time() || 0)}
      onPatch={(p, patch) => editPlays((all) => all.map((x) => (x.id === p.id ? patched(x, patch) : x)))}
      onSaveBreakdownWithPatch={(p, row, patch, notes) => {
        // A play name from the AI window merges like one typed in the Play name boxes (its own stamp).
        saveBreakdown(p, row, patch);
        addAiNote(p, notes);
      }}
    />
  );
  const listsEl = me ? (
    <PlaylistsPanel
      lists={filmLists.lists}
      update={filmLists.update}
      me={me}
      myName={authorName}
      people={people}
      readOnly={!canList}
      playing={listPlay ? { id: listPlay.id, index: listPlay.index } : null}
      onWatch={(item, list) => {
        setListPlay(list || null);
        if (!isDesktop) setLibraryPhone(false);
        watchItem(item);
      }}
    />
  ) : null;
  const notesEl = (
    <PlayNotes
      play={play}
      notes={playNotes}
      currentTime={() => apiRef.current?.time() || 0}
      onSeek={(t) => apiRef.current?.seek(t)}
      onAdd={addNote}
      onDelete={deleteNote}
      readOnly={locked}
    />
  );

  return (
    <div className="flex flex-col gap-2 lg:h-[calc(100dvh-6.5rem)]">
      {/* Game and film */}
      {/* Not clipped (unlike the other panels): the More menu opens below it. */}
      <div className={`${panel.replace(' overflow-hidden', '')} relative z-30 px-2.5 py-1.5 flex flex-wrap items-center gap-2 shrink-0`}>
        {cutup && onBackToPlay && (
          <button
            type="button"
            onClick={onBackToPlay}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-black text-slate-800 dark:text-slate-100 shrink-0"
          >
            <ArrowLeft size={15} /> Back
          </button>
        )}
        {cutup && (
          <span className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 text-xs font-black shrink-0">
            {cutup.label} · {shownPlays.length} snap{shownPlays.length === 1 ? '' : 's'}
            <button
              type="button"
              onClick={endCutup}
              className="h-6 px-2 rounded-md bg-white/70 dark:bg-slate-900/60 text-[11px] font-bold cursor-pointer"
              title="Show every play of this game"
            >
              Whole game
            </button>
          </span>
        )}
        <button
          onClick={() => {
            if (isDesktop) {
              safeJSONSet('footballFilmroomLibrary', !libraryDesk);
              setLibraryDesk(!libraryDesk);
            } else setLibraryPhone(true);
          }}
          aria-expanded={isDesktop ? libraryDesk : libraryPhone}
          title="Film library: every game of the season by week, and your favorites and playlists"
          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-bold shrink-0 ${
            isDesktop && libraryDesk ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <LibraryIcon size={15} /> {listsEl ? 'Library' : 'Games'}
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

        <span
          className={`text-xs text-slate-500 dark:text-slate-400 truncate max-w-full ${family ? 'hidden' : ''}`}
          title={film.status === 'ready' ? `${film.kind === 'drive' ? 'Google Drive' : film.kind === 'folder' ? 'Folder' : 'Clips'}: ${film.label}${film.viaRoot ? '' : ' (linked to this game by hand)'}` : undefined}
        >
          {film.status === 'ready'
            ? game?.filmOnly
              ? `${clips.length} clip${clips.length === 1 ? '' : 's'} · setting up a breakdown…`
              : `${clipFor.size}/${plays.length} plays have film${fromFilm ? ` · ${plays.filter(isBrokenDown).length} broken down` : ''}${film.viaRoot ? '' : ' · linked by hand'}`
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

        {/* Line up film: when this game's clips and plays don't match (or a play was lined up), the clip the play on
            screen shows and a step to the one before or after. The plays after it follow, so one fix past an extra
            (or missing) clip lines up the rest of the game. */}
        {!locked && film.status === 'ready' && clips.length > 0 && play && !game?.filmOnly && (clipMatchMode(clips, plays) === 'order' && clips.length !== plays.length || Object.values(shared.clipPicks || {}).some((p) => p?.clip)) && (() => {
          const at = clipFor.has(play.id) ? clipsInOrder.findIndex((o) => o.i === clipFor.get(play.id)) : -1;
          const step = (d: number) => {
            const to = clipsInOrder[Math.max(0, Math.min(clipsInOrder.length - 1, (at < 0 ? 0 : at) + d))];
            if (to) pickClip(play.id, to.c.name);
          };
          const mine = Boolean(shared.clipPicks?.[play.id]?.clip);
          return (
            <span
              role="group"
              aria-label="Line up film"
              className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 text-[11px] font-bold text-amber-900 dark:text-amber-200"
              title={`${clips.length} clips for ${plays.length} plays (clips go with plays in order). If this play shows the wrong video, step to the right clip; the plays after it follow. Saved for every coach.`}
            >
              {clips.length !== plays.length && <span className="hidden xl:inline">{clips.length} clips · {plays.length} plays ·</span>}
              Play #{play.playNumber}:
              <button type="button" onClick={() => step(-1)} disabled={at <= 0} className="h-5 px-1.5 rounded bg-white/70 dark:bg-slate-900/60 disabled:opacity-40" aria-label="Earlier clip">
                ◀
              </button>
              <span className="tabular-nums">{at >= 0 ? `clip ${at + 1}` : 'no clip'}</span>
              <button type="button" onClick={() => step(1)} disabled={at >= clipsInOrder.length - 1} className="h-5 px-1.5 rounded bg-white/70 dark:bg-slate-900/60 disabled:opacity-40" aria-label="Later clip">
                ▶
              </button>
              {mine && (
                <button type="button" onClick={() => pickClip(play.id, null)} className="h-5 px-1.5 rounded opacity-70 hover:opacity-100" title="Take back the clip picked for this play">
                  Undo
                </button>
              )}
              {at >= 0 && (
                <button type="button" onClick={() => removeClipOf(play)} className="h-5 px-1 rounded opacity-70 hover:opacity-100 hover:text-rose-600" title="Remove this video from the game: the plays after it move up one" aria-label="Remove this video">
                  <Trash2 size={12} />
                </button>
              )}
            </span>
          );
        })()}

        <div className="flex items-center gap-1.5 ml-auto">
          {own.plays.length > 0 && (
            <button
              type="button"
              onClick={() => setPlayersOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Pick a player: every play he was part of this season (runs, passes, catches, tackles), sortable"
            >
              <Users size={14} /> Players
            </button>
          )}
          {!family && (
          <button
            onClick={builderSeed ? () => setHideBuilder((v) => !v) : toggleNotes}
            className={`hidden lg:inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold ${
              sideShown ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
            }`}
            title={sideShown ? 'Hide the side panel to make the video bigger' : 'Show it beside the video'}
          >
            <MessageSquare size={14} />{' '}
            {sideShown ? 'Hide panel' : `Show panel${play && notesFor(play.id).length ? ` (${notesFor(play.id).length} notes)` : ''}`}
          </button>
          )}
          {importNote && <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{importNote}</span>}
          {game && !locked && (
            <input
              ref={importInput}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              aria-label="Hudl breakdown file to import"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void importBreakdown(file);
              }}
            />
          )}
          {tvOn && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setTvOn(false)}
                title="The video is playing on the other screen. Tap to stop sending it."
                className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold bg-emerald-600 text-white"
              >
                <Tv size={14} /> On TV · Stop
              </button>
              {tvHelp && (
                <div role="note" className="absolute right-0 top-full mt-1 z-40 w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100 shadow-lg">
                  <span>
                    <b>Video for the TV:</b> if it opened as a tab, tap Chrome&apos;s <b>⋯</b> menu → <b>New Window</b>, paste the TV link in the address bar, and drag that window onto the TV.
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={copyTvLink} className="h-7 px-2.5 rounded-md bg-emerald-600 text-white font-bold">
                      {tvCopied ? 'TV link copied' : 'Copy TV link'}
                    </button>
                    <button type="button" onClick={() => setTvHelp(false)} className="h-7 px-2 rounded-md font-bold">
                      Got it
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!locked && (
            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold ${film.status === 'ready' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'bg-indigo-600 text-white'}`}
              >
                {film.status === 'ready' ? <MoreHorizontal size={15} /> : <Link2 size={14} />} {film.status === 'ready' ? 'More' : 'Link film'}
              </button>
              {moreOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                  {(() => {
                    const item = (label: React.ReactNode, onClick: () => void, title?: string) => (
                      <button
                        type="button"
                        role="menuitem"
                        title={title}
                        onClick={() => {
                          setMoreOpen(false);
                          onClick();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {label}
                      </button>
                    );
                    return (
                      <>
                        {item(<><Link2 size={14} /> {film.status === 'ready' ? 'Change film' : 'Link film'}</>, () => setLinkOpen(true))}
                        {(film.status === 'ready' || film.status === 'reconnect') &&
                          item(
                            <><Unlink size={14} /> Unlink film</>,
                            () => {
                              if (film.status === 'ready' && film.viaRoot && !window.confirm(`Stop using "${film.label.split(' › ')[0]}" for every game${film.kind === 'drive' ? ' (for all coaches)' : ' on this device'}?`)) return;
                              void unlink();
                            },
                            film.status === 'ready' && film.viaRoot ? 'Stop using the team film folder for every game' : 'Stop using the film linked to this game'
                          )}
                        {film.status === 'ready' && play && clipFor.has(play.id) &&
                          item(<><Trash2 size={14} /> Remove this play&apos;s video</>, () => removeClipOf(play), "Leave this video out of the game: the plays after it move up one (the file isn't deleted)")}
                        {removedSet.size > 0 && item(<><RotateCcw size={14} /> Bring back removed videos ({removedSet.size})</>, restoreClips)}
                        {lostNames.length > 0 &&
                          item(
                            <><RotateCcw size={14} /> Bring back play names ({lostNames.length})</>,
                            bringBackNames,
                            'Play names missing from these plays, put back from the play cards in Their plays (the clips each card was made from)'
                          )}
                        {!locked &&
                          item(
                            <><History size={14} /> Saved versions of the reports</>,
                            openScoutVersions,
                            'Earlier versions of each Hudl Scout report kept on this device (and the one from just before any play names or plays disappeared), to put one back'
                          )}
                        {film.status === 'ready' && screenSupported() &&
                          item(
                            <><Tv size={14} /> {tvOn ? 'Open the TV screen again' : 'TV screen (video on a second screen)'}</>,
                            startTv,
                            'Open the video in its own window for a TV or monitor; this window keeps the play log'
                          )}
                        {sources.drive && canOpenFolders() && (
                          <div className="px-2.5 py-1.5">
                            <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Play film from</div>
                            <div role="group" aria-label="Play film from" className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                              {(
                                [
                                  ['local', 'This computer', playFromComputer],
                                  ['drive', 'Google Drive', playFromDrive],
                                ] as const
                              ).map(([id, text, go]) => {
                                const on = (playingFrom || (sourcePref === 'auto' ? undefined : sourcePref)) === id;
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => {
                                      setMoreOpen(false);
                                      void go();
                                    }}
                                    className={`flex-1 h-7 ${on ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                  >
                                    {text}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {game && <div className="my-1 border-t border-slate-200 dark:border-slate-700" />}
                        {game && item(<><FileUp size={14} /> Import breakdown</>, () => importInput.current?.click(), "Load this game's Hudl breakdown (CSV or Excel) into its plays, matched to the film in order")}
                        {game && game.source === 'opponent' && !game.filmOnly && onSaveWeekScouting && copyTargets.length > 0 &&
                          item(<><Copy size={14} /> Copy to another week</>, openCopy, 'Use this scouting film for another week')}
                        {game && item(<><ExternalLink size={14} /> Open in Hudl Scout</>, () => onOpenHudlGame({ target: game.source, gameId: game.gameId }))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {copyOpen && game && (
        <div role="dialog" aria-label="Copy to another week" className="mb-2 px-3 py-3 rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100 text-xs space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black">Copy &quot;{game.name}&quot; to</span>
            <select
              aria-label="Week to copy to"
              value={copyWeek}
              onChange={(e) => setCopyWeek(e.target.value)}
              className="h-8 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 px-2 font-bold"
            >
              <option value="">Pick a week…</option>
              {copyTargets.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.label}{w.opponent ? ` · ${w.opponent}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="font-black">Which team are you scouting in this film for that week?</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="copy-side" checked={copySwitch === false} onChange={() => setCopySwitch(false)} />
            <span>
              The same team as here{filmWeeks?.find((w) => w.key === game.week)?.opponent ? ` (${filmWeeks.find((w) => w.key === game.week)!.opponent})` : ''}: keep O and D as they are
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="copy-side" checked={copySwitch === true} onChange={() => setCopySwitch(true)} />
            <span>
              The other team{filmWeeks?.find((w) => w.key === copyWeek)?.opponent ? ` (${filmWeeks.find((w) => w.key === copyWeek)!.opponent})` : ''}: switch O and D (their offense is this film&apos;s D), yard lines from their side
            </span>
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={doCopy}
              disabled={!copyWeek || copySwitch == null}
              className="h-8 px-3 rounded-lg font-black bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
            >
              Copy
            </button>
            <button type="button" onClick={() => setCopyOpen(false)} className="h-8 px-3 rounded-lg font-bold text-indigo-800 dark:text-indigo-200">
              Cancel
            </button>
            <span className="text-[11px] opacity-80">The film stays where it is; tags from scouting this team aren&apos;t copied.</span>
          </div>
        </div>
      )}
      {(listPlay || listNote) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 text-xs shrink-0">
          {listPlay && (
            <>
              <ListVideo size={14} />
              <span className="font-black">{listPlay.name}</span>
              <span>
                play {listPlay.index + 1} of {listPlay.items.length}
              </span>
              <button type="button" onClick={() => setListPlay(null)} className="ml-auto h-6 px-2 rounded-md bg-white/70 dark:bg-slate-900/60 font-bold">
                Stop playlist
              </button>
            </>
          )}
          {listNote && <span className="font-bold text-amber-700 dark:text-amber-300">{listNote}</span>}
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-2 lg:flex-1 lg:min-h-0">
      {isDesktop && libraryDesk && <aside className={`${panel} w-64 xl:w-72 shrink-0 min-h-0`}>{libraryEl(() => {
        safeJSONSet('footballFilmroomLibrary', false);
        setLibraryDesk(false);
      })}</aside>}
      <div className="flex flex-col gap-2 flex-1 min-w-0 lg:min-h-0">
      {/* Phones held upright: the video stays pinned under the app header while the plays scroll under it. */}
      <div className={`grid gap-3 shrink-0 max-lg:portrait:sticky max-lg:portrait:top-[62px] max-lg:portrait:z-20 max-lg:portrait:rounded-xl max-lg:portrait:bg-black ${
        sideShown ? (sideIsBuilder ? 'lg:grid-cols-[minmax(0,1fr)_minmax(24rem,42%)]' : 'lg:grid-cols-[minmax(0,1fr)_20rem]') : ''
      }`}
      style={isDesktop && sideShown && !sideIsBuilder ? { gridTemplateColumns: `minmax(0,1fr) ${clampSideW(sideW)}px` } : undefined}
      >
        <FilmPlayer
          maxVideoHeight={isDesktop ? `${clampVideoH(videoH)}px` : 'calc(100dvh - 7rem)'}
          src={placeholder ? undefined : clipUrl.url}
          placeholder={placeholder}
          // A family sees when the play happened and how it went, not our call.
          title={play ? (family ? [`Play ${play.playNumber}`, familyLine(play)].filter(Boolean).join(' · ') : playTitle(play)) : ''}
          marks={family ? [] : marks}
          onMarksChange={locked ? () => undefined : saveMarks}
          viewOnly={locked}
          hasPrev={listPlay ? listPlay.index > 0 : Boolean(prev)}
          hasNext={listPlay ? listPlay.index < listPlay.items.length - 1 : Boolean(next)}
          onPrev={() => (listPlay ? stepList(-1) : prev && setPlayId(prev.id))}
          onNext={() => (listPlay ? stepList(1) : next && setPlayId(next.id))}
          onStopwatch={(s, at) => {
            addNote(`Pocket time ${s.toFixed(2)}s`, undefined, at);
          }}
          apiRef={apiRef}
          startAt={resumeAt.current}
          autoNextDefault={listPlay ? true : !game?.fromFilm}
        />

        {/* Notes: beside the video on a computer (as tall as the video, scrolling), a tab on phones and tablets */}
        {sideShown && (
          <div className="hidden lg:block relative">
            {!sideIsBuilder && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to make the side panel wider or narrower"
                title="Drag to make the side panel wider or narrower (double-click: back to the standard width)"
                onPointerDown={onSideDown}
                onPointerMove={onSideMove}
                onPointerUp={onSideUp}
                onPointerCancel={onSideUp}
                onDoubleClick={() => {
                  setSideW(SIDE_W);
                  safeJSONSet('footballFilmroomSideW', null);
                }}
                className="absolute -left-3 top-0 bottom-0 w-3 z-10 flex items-center justify-center cursor-col-resize touch-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="w-1 h-10 rounded-full bg-current opacity-60" />
              </div>
            )}
            <div className={`${panel} absolute inset-0 overflow-y-auto`}>
              {sideTabs}
              {sideIsBuilder ? (
                builderEl
              ) : activeSide === 'breakdown' ? (
                breakdownEl
              ) : activeSide === 'drives' ? (
                <DriveSidebar
                  plays={plays}
                  selectedId={play?.id}
                  onSelectPlay={setPlayId}
                  offenseLabel={isOwn ? teamName || 'Us' : opponentName || 'Them'}
                  defenseLabel={isOwn ? opponentName || 'Them' : 'Their opponent'}
                />
              ) : (
                <>
                  <div className="px-3 pt-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Notes {play ? `· play #${play.playNumber}` : ''}
                  </div>
                  {notesEl}
                </>
              )}
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
        <button className={chip(mobileTab === 'plays')} onClick={() => setMobileTab('plays')}>{locked ? 'Plays' : <>Plays &amp; tags</>}</button>
        {editable && (
          <button className={chip(mobileTab === 'breakdown')} onClick={() => setMobileTab('breakdown')}>
            Breakdown
          </button>
        )}
        {!family && (
        <button className={chip(mobileTab === 'notes')} onClick={() => setMobileTab('notes')}>
          Notes{play && notesFor(play.id).length ? ` (${notesFor(play.id).length})` : ''}
        </button>
        )}
        {builderSeed && (
          <button className={chip(mobileTab === 'builder')} onClick={() => setMobileTab('builder')}>
            Play builder
          </button>
        )}
      </div>
      {mobileTab === 'notes' && !family && <div className={`${panel} lg:hidden`}>{notesEl}</div>}
      {mobileTab === 'breakdown' && editable && <div className={`${panel} lg:hidden`}>{breakdownEl}</div>}
      {mobileTab === 'builder' && builderEl && <div className={`${panel} lg:hidden`}>{builderEl}</div>}

      {/* The game's play log: click a play to watch it, sort by any column, change tags */}
      <div className={`flex-col gap-2 lg:flex-1 lg:min-h-0 ${mobileTab === 'plays' ? 'flex' : 'hidden lg:flex'}`}>
        {listPlay ? (
          playlistQueue
        ) : logView === 'drives' && !game?.filmOnly ? (
          driveChart
        ) : family ? (
          <>
            {!game?.filmOnly && logSwitch}
            {familyLog}
          </>
        ) : game?.filmOnly ? (
          clipLog
        ) : (
          playLog
        )}
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

      <PlayerFinder
        open={playersOpen}
        onClose={() => setPlayersOpen(false)}
        games={own.games.map((g) => ({ id: g.id, name: g.name, week: g.week }))}
        plays={own.plays}
        roster={roster || []}
        weekLabel={(w) => weekOptions?.find((o) => o.key === w)?.label || w || ''}
        onWatch={(gameId, playId) => {
          setPlayersOpen(false);
          watchItem({ gameKey: filmGameKey('own', gameId), source: 'own', gameId, playId, label: '' });
        }}
        onPlayAll={(name, list) => {
          const items = list.map(ownClipRef).filter((r): r is ClipRef => Boolean(r));
          if (!items.length) return;
          setPlayersOpen(false);
          setListPlay({ id: `player_${Date.now().toString(36)}`, name, items, index: 0 });
          if (!isDesktop) setLibraryPhone(false);
          watchItem(items[0]);
        }}
        saveMenu={
          canList
            ? (list, name, done) => (
                <AddToPlaylistMenu
                  refs={list.map(ownClipRef).filter((r): r is ClipRef => Boolean(r))}
                  lists={filmLists.lists}
                  update={filmLists.update}
                  me={me}
                  myName={authorName}
                  defaultName={name}
                  onDone={(listName, n) => done(n ? `Added ${n} to ${listName}` : `Already in ${listName}`)}
                />
              )
            : undefined
        }
      />

      {linkOpen && game && !locked && (
        <LinkFilmDialog
          gameName={game.name}
          driveLink={shared.drive?.link || root.shared.drive?.link}
          onClose={() => setLinkOpen(false)}
          onFolder={chooseFolder}
          onFiles={pickFiles}
          onPickedFolder={pickFolderFiles}
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
