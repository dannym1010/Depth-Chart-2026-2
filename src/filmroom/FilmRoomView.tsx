// Film Room: a Hudl Scout game's plays with the film. Pick a game, link where its clips are (a shared
// Google Drive folder or a folder on this computer), then watch play by play with notes and drawings the
// whole staff sees. The play log under the video is Hudl Scout's own: sorting it sets the play order, and
// tags changed here are the same tags Hudl Scout shows.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileUp, Film, GripHorizontal, Library as LibraryIcon, Link2, MessageSquare, RefreshCw, Unlink, ArrowLeft } from 'lucide-react';
import { PlaysTable } from '../hudlScout/components/PlaysTable';
import { assignDrives, bundleFromSaved, type ScoutBundle } from '../hudlScout/scoutBundle';
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
import { clipMatchMode, matchClipsToPlays } from './clipMatching';
import { playsFromClips } from './clipPlays';
import { applyBreakdown, blankPlays, breakdownPlayId, importIntoGame, isBrokenDown, type BreakdownRow } from './breakdownEntry';
import { BreakdownPanel } from './BreakdownPanel';
import type { FilmFolderGame, UnplacedFolder } from './folderRoutes';
import { clearFilmCutup, peekFilmCutup, type FilmCutup } from '../utils/filmCutup';
import { peekPlayBuilderSeed, savePlayBuilderSeed, type PlayBuilderSeed } from '../utils/playBuilderSeed';
import { PlayBuilderSection } from '../components/playbook/PlayBuilderSection';
import { FilmPlayer, type PlayerApi } from './FilmPlayer';
import { LinkFilmDialog } from './LinkFilmDialog';
import { FilmLibrary, buildLibrary, type LibraryGame } from './FilmLibrary';
import { PlayNotes } from './PlayNotes';
import { playTitle } from './playText';
import { filmGameKey } from './sharedMerge';
import type { FilmGame, FilmMark, FilmNote } from './types';
import { useClipUrl, useGameFilm } from './useGameFilm';
import { canOpenFolders } from './filmSources';
import { useSharedGame } from './useSharedGame';
import { readBreakdown, useFolderBreakdowns } from './folderImport';

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
  /** True if currently logged in user is the program owner / master super admin */
  isProgramAdmin?: boolean;
  /** A player or family account: watching only (no film linking, breakdown, tags, notes to add or drawing). */
  viewOnly?: boolean;
  /** A family account: our games only, just the video and a plain list of the plays. */
  family?: boolean;
}

type OdkFilter = 'all' | 'O' | 'D' | 'K';

const newId = () => `fn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const FilmRoomView: React.FC<FilmRoomViewProps> = ({
  teamId, teamName, currentWeek, weekLabel, opponentName, opponentScout, ownTeamScout, authorName, onOpenHudlGame,
  onUpdateOwnTeamScout, onUpdateScouting, playDatabase, onUpdatePlayDatabase, roster, weekBoards, weekOptions,
  filmWeeks, onSelectWeek, onSaveWeekScouting, onBackToPlay, builderCanEdit, onSaveBuilderPlay, onRenameScoutPlay, onSaveFilmBackfield, onDrawSnap,
  isProgramAdmin = false,
  viewOnly = false,
  family = false,
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
    (found: { games: FilmFolderGame[]; unplaced: UnplacedFolder[] }) => {
      setFilmFolders(found);
      safeJSONSet(foldersKey, found);
    },
    [foldersKey]
  );
  // Film with no breakdown yet: each clip is a play, in order (filled in once the film is open).
  const [clipPlays, setClipPlays] = useState<Play[]>([]);

  // The film library: every week of the season with our game and that week's scouting film.
  const library = useMemo(() => {
    const all = buildLibrary(filmWeeks || [], own.games, currentWeek, opponentScout, filmFolders.games);
    if (!family) return all;
    // A family account sees our games, not the scouting film.
    const ours = <T extends { source: string }>(list: T[]) => list.filter((g) => g.source === 'own');
    return { weeks: all.weeks.map((w) => ({ ...w, games: ours(w.games) })).filter((w) => w.games.length), others: ours(all.others) };
  }, [filmWeeks, own.games, opponentScout, currentWeek, filmFolders.games, family]);
  const filmOnlyGames = useMemo(() => [...library.weeks.flatMap((w) => w.games), ...library.others].filter((g) => g.filmOnly), [library]);

  const games = useMemo(() => {
    const list: FilmGame[] = [
      ...own.games.map((g) => ({ key: filmGameKey('own', g.id), source: 'own' as const, gameId: g.id, name: g.name, week: g.week, fromFilm: g.fromFilm })),
      ...opp.games.map((g) => ({ key: filmGameKey('opponent', g.id, currentWeek), source: 'opponent' as const, gameId: g.id, name: g.name, week: currentWeek, fromFilm: g.fromFilm })),
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
  const [sideTab, setSideTab] = useState<'builder' | 'breakdown' | 'notes'>(builderSeed ? 'builder' : 'breakdown');
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
  const { film, chooseFolder, reconnect, pickFiles, linkDrive, signInToDrive, unlink, localFiles, sources, sourcePref, playFromComputer, playFromDrive, playingFrom, setView, choose, getRootNode } = useGameFilm({
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
  // A film-only game's plays are its clips.
  useEffect(() => {
    if (!game?.filmOnly) return setClipPlays((c) => (c.length ? [] : c));
    const next = film.status === 'ready' ? playsFromClips(film.clips, game.gameId) : [];
    setClipPlays((c) => (c.length === 0 && next.length === 0 ? c : next));
  }, [game?.key, game?.filmOnly, game?.gameId, film]);

  // Film with no Hudl breakdown: once its clips are in, it becomes a Hudl Scout game with one blank play per
  // clip (same game id, so the film link and notes stay), and the coach fills the plays in while watching.
  const madeBreakdown = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!game?.filmOnly || film.status !== 'ready' || !film.clips.length || isReadOnlySession()) return;
    if (madeBreakdown.current.has(game.key)) return;
    const week = game.week || '';
    const w = filmWeeks?.find((x) => x.key === week);
    const target = game.source === 'own' ? own : bundleFromSaved(week === currentWeek ? opponentScout : w?.hudlScout, w?.opponent || 'Opponent');
    // Deleted in Hudl Scout: leave it as plain film.
    if (target.games.some((g) => g.id === game.gameId) || (target.deletedGameIds || []).includes(game.gameId)) return;
    madeBreakdown.current.add(game.key);
    const fresh = blankPlays(film.clips, game.gameId);
    const now = Date.now();
    const g: ScoutGame = { id: game.gameId, name: game.name, playCount: fresh.length, addedAt: now, fromFilm: true, ...(week ? { week } : {}) };
    // Notes and drawings already made on the clips move to their plays.
    const moved = new Map(playsFromClips(film.clips, game.gameId).map((p) => [p.id, breakdownPlayId(p.id, game.gameId)]));
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
    getRootNode,
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
  useEffect(() => setPlayId(cutup?.playIds[0]), [game?.key, setPlayId, cutup]);
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
  // Their film: the plays already in Their plays (each with its formation) can be picked when tagging.
  const theirCalls = useMemo(() => theirCallEntries(opp.playLibraries), [opp.playLibraries]);
  // Import breakdown: a Hudl file's plays go into the game that's open (not a new game), play N onto play N.
  const importInput = useRef<HTMLInputElement>(null);
  const [importNote, setImportNote] = useState('');
  const importBreakdown = async (file: File) => {
    if (!game || game.filmOnly) return;
    let fresh: Play[];
    try {
      fresh = await readBreakdown(file.name, file);
    } catch {
      return window.alert(`Couldn't read ${file.name}. Use the CSV or Excel export from Hudl.`);
    }
    if (!fresh.length) return window.alert(`No plays found in ${file.name}.`);
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
  const saveBreakdown = (changes: { play: Play; row: BreakdownRow }[]) =>
    editPlays((all) => all.map((p) => {
      const c = changes.find((x) => x.play.id === p.id);
      return c ? applyBreakdown(p, c.row) : p;
    }));
  const breakdownNext = (row: BreakdownRow) => {
    if (!play) return;
    const changes = [{ play, row }];
    if (next && !isBrokenDown(next)) {
      const carry: BreakdownRow = {};
      if (row.QTR) carry.QTR = row.QTR;
      if (row.ODK) carry.ODK = row.ODK;
      if (Object.keys(carry).length) changes.push({ play: next, row: carry });
    }
    saveBreakdown(changes);
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
  const [linkOpen, setLinkOpen] = useState(false);
  // Opened from the play builder, the library starts closed so the builder has room beside the video.
  const [libraryDesk, setLibraryDesk] = useState(() => !builderSeed && safeJSONParse<boolean>('footballFilmroomLibrary', true));
  const [libraryPhone, setLibraryPhone] = useState(false);
  const [mobileTab, setMobileTab] = useState<'plays' | 'notes' | 'builder' | 'breakdown'>('plays');

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
      toolbarStart={odkChips}
      onDrawCall={!isOwn && onDrawSnap && !isReadOnlySession() ? onDrawSnap : undefined}
      drawUntagged={!isOwn && Boolean(onDrawSnap) && !locked}
      theirCalls={isOwn ? undefined : theirCalls}
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
        {plays.length} clip{plays.length === 1 ? '' : 's'}, in the order of the file names. There&apos;s no Hudl breakdown for this game yet: put its CSV or Excel file in this game&apos;s folder
        and check the film folder, and the plays fill in.
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
    <FilmLibrary
      weeks={library.weeks}
      otherGames={library.others}
      currentWeek={currentWeek}
      selectedKey={game?.key}
      onOpen={openFromLibrary}
      onClose={onClose}
      added={breakdowns.added}
      checking={breakdowns.checking}
      onCheckFolder={!locked && (sources.local || sources.drive) ? breakdowns.checkNow : undefined}
      unplaced={filmFolders.unplaced}
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
  const sideTabList = [...(builderSeed ? (['builder'] as const) : []), ...(editable ? (['breakdown'] as const) : []), 'notes' as const];
  const activeSide = sideTabList.includes(sideTab as never) ? sideTab : sideTabList[0];
  const sideIsBuilder = activeSide === 'builder';
  const sideTabs = sideTabList.length > 1 ? (
    <div className="flex items-center gap-1 px-2 pt-2">
      {sideTabList.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setSideTab(t)}
          className={`h-7 px-2.5 rounded-lg text-xs font-black ${
            activeSide === t ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t === 'builder' ? 'Play builder' : t === 'breakdown' ? `Breakdown${play ? ` · #${play.playNumber}` : ''}` : `Notes${play && notesFor(play.id).length ? ` (${notesFor(play.id).length})` : ''}`}
        </button>
      ))}
      {builderSaved && <span className="ml-auto text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{builderSaved}</span>}
    </div>
  ) : null;
  const breakdownEl = (
    <BreakdownPanel
      play={play}
      suggestFrom={(isOwn ? own : opp).plays}
      onSave={(p, row) => saveBreakdown([{ play: p, row }])}
      next={next}
      onNext={breakdownNext}
      readOnly={isReadOnlySession()}
      onSetUnit={isOwn ? (p, unit) => editPlays((all) => tagPlayUnits(all, p.id, unit, 'play')) : undefined}
      videoElement={apiRef.current?.video?.() || null}
      roster={roster}
      teamName={teamName}
      isOwnGame={isOwn}
      gameId={game?.gameId || game?.key || ''}
      opponentName={opponentName}
      isProgramAdmin={isProgramAdmin}
      onAddNote={(id, text) => addNote(text, undefined, apiRef.current?.time() || 0)}
      onPatch={(p, patch) =>
        editPlays((all) =>
          all.map((x) => {
            if (x.id !== p.id) return x;
            const next = { ...x, ...patch, editedAt: Date.now() };
            if ('strength' in patch && !patch.strength) delete next.strength;
            // Who had the ball also reads in the play log's players column.
            if ('rusher' in patch || 'passer' in patch || 'receiver' in patch) {
              next.carrierOrTarget = (next.playType === 'RUN' ? next.rusher || next.receiver || next.passer : next.receiver || next.rusher || next.passer) || '';
            }
            return next;
          })
        )
      }
      onSaveBreakdownWithPatch={(p, row, patch, notes) => {
        editPlays((all) =>
          all.map((x) => {
            if (x.id !== p.id) return x;
            let next = applyBreakdown(x, row);
            if (patch && Object.keys(patch).length > 0) {
              next = { ...next, ...patch, editedAt: Date.now() };
              if ('strength' in patch && !patch.strength) delete next.strength;
              if ('rusher' in patch || 'passer' in patch || 'receiver' in patch) {
                next.carrierOrTarget = (next.playType === 'RUN' ? next.rusher || next.receiver || next.passer : next.receiver || next.rusher || next.passer) || '';
              }
            }
            return next;
          })
        );
        if (notes) addNote(notes, undefined, apiRef.current?.time() || 0);
      }}
    />
  );
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
      <div className={`${panel} px-2.5 py-1.5 flex flex-wrap items-center gap-2 shrink-0`}>
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

        <span className={`text-xs text-slate-500 dark:text-slate-400 truncate max-w-full ${family ? 'hidden' : ''}`}>
          {film.status === 'ready'
            ? game?.filmOnly
              ? `${film.kind === 'drive' ? 'Drive' : 'Folder'}: ${film.label} · ${clips.length} clip${clips.length === 1 ? '' : 's'} · setting up a breakdown to fill in…`
              : `${film.kind === 'drive' ? 'Drive' : film.kind === 'folder' ? 'Folder' : 'Clips'}: ${film.label} · ${clipFor.size}/${plays.length} plays have film${
                  fromFilm ? ` · ${plays.filter(isBrokenDown).length}/${plays.length} broken down` : ''
                }`
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
        {!locked && film.status === 'ready' && film.siblings && film.siblings.length > 1 && (
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
        {/* The team film folder on Google Drive: play from it or from this computer's copy (one tap). */}
        {sources.drive && canOpenFolders() && (
          <div role="group" aria-label="Play film from" className="inline-flex h-7 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-bold">
            {(
              [
                ['local', 'This computer', sources.local ? "Play from this computer's copy of the film folder (faster)" : 'Pick your copy of the film folder on this computer (faster)', playFromComputer],
                ['drive', 'Google Drive', "Play from the team's Google Drive folder", playFromDrive],
              ] as const
            ).map(([id, text, tip, go]) => {
              const on = (playingFrom || (sourcePref === 'auto' ? undefined : sourcePref)) === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  title={tip}
                  onClick={() => void go()}
                  className={`px-2.5 ${on ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {text}
                </button>
              );
            })}
          </div>
        )}
        {/* Clips go with plays in order: a different count means some clip is missing or extra. */}
        {!locked && film.status === 'ready' && clips.length > 0 && clipMatchMode(clips, plays) === 'order' && clips.length !== plays.length && (
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            title="Clips are matched to plays in order (first clip = first play). With a different number of clips, check that the plays line up, and that the folder has only this game's clips."
          >
            ⚠ {clips.length} clips for {plays.length} plays: check the plays line up
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {!family && (
          <button
            onClick={builderSeed ? () => setHideBuilder((v) => !v) : toggleNotes}
            className={`hidden lg:inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold ${
              sideShown ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
            }`}
            title={sideShown ? 'Hide the side panel to make the video bigger' : 'Show it beside the video'}
          >
            <MessageSquare size={14} />{' '}
            {builderSeed
              ? sideShown
                ? 'Hide play builder'
                : 'Show play builder'
              : editable
                ? showNotes
                  ? 'Hide breakdown & notes'
                  : 'Show breakdown & notes'
                : showNotes
                ? 'Hide notes'
                : `Show notes${play && notesFor(play.id).length ? ` (${notesFor(play.id).length})` : ''}`}
          </button>
          )}
          {!locked && (
          <button onClick={() => setLinkOpen(true)} className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold bg-indigo-600 text-white">
            <Link2 size={14} /> {film.status === 'ready' ? 'Change film' : 'Link film'}
          </button>
          )}
          {!locked && (film.status === 'ready' || film.status === 'reconnect') && (
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
          {importNote && <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{importNote}</span>}
          {game && !game.filmOnly && !locked && (
            <>
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
              <button
                onClick={() => importInput.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Load this game's Hudl breakdown (CSV or Excel) into the plays here, matched to the film in order"
              >
                <FileUp size={14} /> <span className="hidden sm:inline">Import breakdown</span>
              </button>
            </>
          )}
          {game && !locked && (
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
      <div className={`grid gap-3 shrink-0 max-lg:portrait:sticky max-lg:portrait:top-[62px] max-lg:portrait:z-20 max-lg:portrait:rounded-xl max-lg:portrait:bg-black ${
        sideShown ? (sideIsBuilder ? 'lg:grid-cols-[minmax(0,1fr)_minmax(24rem,42%)]' : 'lg:grid-cols-[minmax(0,1fr)_20rem]') : ''
      }`}>
        <FilmPlayer
          maxVideoHeight={isDesktop ? `${clampVideoH(videoH)}px` : 'calc(100dvh - 7rem)'}
          src={placeholder ? undefined : clipUrl.url}
          placeholder={placeholder}
          // A family sees when the play happened and how it went, not our call.
          title={play ? (family ? [`Play ${play.playNumber}`, familyLine(play)].filter(Boolean).join(' · ') : playTitle(play)) : ''}
          marks={family ? [] : marks}
          onMarksChange={locked ? () => undefined : saveMarks}
          viewOnly={locked}
          hasPrev={Boolean(prev)}
          hasNext={Boolean(next)}
          onPrev={() => prev && setPlayId(prev.id)}
          onNext={() => next && setPlayId(next.id)}
          onStopwatch={(s, at) => {
            addNote(`Pocket time ${s.toFixed(2)}s`, undefined, at);
          }}
          apiRef={apiRef}
          startAt={resumeAt.current}
          autoNextDefault={!game?.fromFilm}
        />

        {/* Notes: beside the video on a computer (as tall as the video, scrolling), a tab on phones and tablets */}
        {sideShown && (
          <div className="hidden lg:block relative">
            <div className={`${panel} absolute inset-0 overflow-y-auto`}>
              {sideTabs}
              {sideIsBuilder ? (
                builderEl
              ) : activeSide === 'breakdown' ? (
                breakdownEl
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
        {family ? familyLog : game?.filmOnly ? clipLog : playLog}
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

      {linkOpen && game && !locked && (
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
