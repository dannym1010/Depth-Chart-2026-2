import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Film,
  Link2,
  MessageSquare,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Trash2,
  Unlink,
} from 'lucide-react';
import { matchClipsToPlays } from '../../filmroom/clipMatching';
import { liveViewClips, picksForView } from '../../filmroom/dualView';
import { canOpenFolders } from '../../filmroom/filmSources';
import { FilmPlayer, type PlayerApi } from '../../filmroom/FilmPlayer';
import { LinkFilmDialog } from '../../filmroom/LinkFilmDialog';
import { PlayNotes } from '../../filmroom/PlayNotes';
import { filmGameKey } from '../../filmroom/sharedMerge';
import type { FilmClip, FilmGame, FilmMark, FilmNote } from '../../filmroom/types';
import { useClipUrl, useGameFilm } from '../../filmroom/useGameFilm';
import { useSharedGame } from '../../filmroom/useSharedGame';
import { HighlightButton } from '../../highlights/HighlightButton';
import { seasonOf } from '../../highlights/highlightData';
import { useDeviceHighlights, useHighlights } from '../../highlights/useHighlights';
import type { Play } from '../../hudlScout/types/football';
import {
  DEFENSE_LABELS,
  PHASE_LABELS,
  SHOT_ZONE_LABELS,
} from '../basketballAnalytics';
import { DEFAULT_BASKETBALL_SETS, possessionsToFootballPlays } from '../storage';
import type {
  BasketballGame,
  BasketballPlayer,
  BasketballPossession,
  BasketballTeam,
  DefenseType,
  PossessionPhase,
  PossessionResult,
  ShotZone,
} from '../types';
import { HalfCourtSvg } from './HalfCourtSvg';

interface BasketballFilmRoomViewProps {
  team: BasketballTeam;
  games: BasketballGame[];
  activeGameId: string;
  roster: BasketballPlayer[];
  customSets: string[];
  userEmail: string;
  authorName: string;
  readOnly?: boolean;
  focusPlayNumber?: number;
  onSelectGame: (gameId: string) => void;
  onUpdatePossessions: (gameId: string, possessions: BasketballPossession[]) => void;
  onAddCustomSet: (setName: string) => void;
}

const OUTCOME_BUTTONS: {
  result: PossessionResult;
  label: string;
  defaultPoints: 0 | 1 | 2 | 3 | 4;
  tone: 'make' | 'miss' | 'def' | 'neutral';
}[] = [
  { result: '2pt_make', label: '2PT Make', defaultPoints: 2, tone: 'make' },
  { result: '2pt_miss', label: '2PT Miss', defaultPoints: 0, tone: 'miss' },
  { result: '3pt_make', label: '3PT Make', defaultPoints: 3, tone: 'make' },
  { result: '3pt_miss', label: '3PT Miss', defaultPoints: 0, tone: 'miss' },
  { result: 'and_1', label: 'And-1 (+3)', defaultPoints: 3, tone: 'make' },
  { result: 'ft_trip', label: 'FT (+2)', defaultPoints: 2, tone: 'neutral' },
  { result: 'turnover', label: 'Turnover', defaultPoints: 0, tone: 'miss' },
  { result: 'foul_drawn', label: 'Foul Drawn', defaultPoints: 0, tone: 'neutral' },
  { result: 'def_stop', label: 'Def Stop', defaultPoints: 0, tone: 'def' },
  { result: 'def_steal', label: 'Steal', defaultPoints: 0, tone: 'def' },
  { result: 'def_block', label: 'Block', defaultPoints: 0, tone: 'def' },
  { result: 'def_reb', label: 'Def Reb', defaultPoints: 0, tone: 'def' },
];

const formatPlayerOption = (p: BasketballPlayer) => `#${p.num} ${p.firstName} ${p.lastName}`.trim();

export const BasketballFilmRoomView: React.FC<BasketballFilmRoomViewProps> = ({
  team,
  games,
  activeGameId,
  roster,
  customSets,
  userEmail,
  authorName,
  readOnly = false,
  focusPlayNumber,
  onSelectGame,
  onUpdatePossessions,
  onAddCustomSet,
}) => {
  const bballTeamId = `bball_${team.id}`;
  const selectedGame = useMemo(
    () => games.find((g) => g.id === activeGameId) || games[0],
    [games, activeGameId]
  );

  const filmGame: FilmGame | undefined = useMemo(() => {
    if (!selectedGame) return undefined;
    return {
      key: filmGameKey('own', selectedGame.id, selectedGame.weekLabel),
      source: 'own',
      gameId: selectedGame.id,
      name: `${selectedGame.weekLabel}: vs ${selectedGame.opponent}`,
      week: selectedGame.weekLabel,
    };
  }, [selectedGame]);

  const { shared, update } = useSharedGame(bballTeamId, filmGame?.key);
  const root = useSharedGame('bball_program', 'root');
  const setDrive = useCallback(
    (drive: typeof shared.drive) => update((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })),
    [update]
  );
  const updateRoot = root.update;
  const setRootDrive = useCallback(
    (drive: typeof shared.drive) => updateRoot((s) => ({ ...s, drive: drive || { folderId: '', editedAt: Date.now() } })),
    [updateRoot]
  );
  const setPick = useCallback(
    (name: string) => update((s) => ({ ...s, folderPick: { name, editedAt: Date.now() } })),
    [update]
  );

  const {
    film,
    chooseFolder,
    reconnect,
    pickFiles,
    pickFolderFiles,
    pickedViews,
    linkDrive,
    signInToDrive,
    unlink,
    localFiles,
    sources,
    playFromComputer,
    playFromDrive,
    reloadFilm,
    setView,
    choose,
  } = useGameFilm({
    game: filmGame,
    teamId: bballTeamId,
    teamName: team.name,
    opponentName: selectedGame?.opponent,
    drive: shared.drive,
    setDrive,
    rootDrive: root.shared.drive,
    setRootDrive,
    pick: shared.folderPick?.name,
    setPick,
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [rightTab, setRightTab] = useState<'tag' | 'notes'>('tag');
  const [sideFilter, setSideFilter] = useState<'all' | 'us' | 'opponent'>('all');
  const [periodFilter, setPeriodFilter] = useState<number>(0);
  const [customSetDraft, setCustomSetDraft] = useState('');
  const apiRef = useRef<PlayerApi | null>(null);

  const possessions = selectedGame?.possessions || [];
  const plays = useMemo<Play[]>(() => {
    if (!selectedGame) return [];
    if (possessions.length > 0) return possessionsToFootballPlays(selectedGame);
    if (film.status === 'ready' && film.clips.length > 0) {
      // Virtual placeholder plays allow immediate clip browsing before blank possessions are committed.
      return film.clips.map((c, idx) => ({
        id: `vclip-${selectedGame.id}-${idx + 1}`,
        playNumber: idx + 1,
        odk: 'O',
        quarter: 1,
        down: 1,
        distance: 0,
        yardLine: 50,
        rawYardLine: 'Q1',
        yardLineSide: 'MID',
        fieldZone: 'own_territory',
        hash: 'M',
        playType: 'RUN',
        formation: 'half_court',
        backfield: 'man',
        motion: '',
        playName: c.name.replace(/\.[^.]+$/, ''),
        direction: '',
        gainLoss: 0,
        result: '',
        personnel: 'man',
        carrierOrTarget: '',
        keyPlayer: '',
        isExplosive: false,
        isEfficient: false,
        runSide: 'M',
        gameId: selectedGame.id,
      }));
    }
    return [];
  }, [selectedGame, possessions, film]);

  const multiView = film.status === 'ready' && film.views.length > 1;
  const mainView = film.status === 'ready' ? film.views[film.view] || '' : '';
  const clips = useMemo<FilmClip[]>(
    () => (film.status === 'ready' ? liveViewClips(film.clips, shared.removedClips, mainView, multiView) : []),
    [film, shared.removedClips, mainView, multiView]
  );
  const mainPicks = useMemo(
    () => picksForView(shared.clipPicks, mainView, multiView),
    [shared.clipPicks, mainView, multiView]
  );
  const clipFor = useMemo(() => matchClipsToPlays(clips, plays, mainPicks), [clips, plays, mainPicks]);

  const [activePlayId, setActivePlayId] = useState<string>('');

  // Sync activePlayId when game or focusPlayNumber changes.
  useEffect(() => {
    if (!plays.length) {
      setActivePlayId('');
      return;
    }
    if (focusPlayNumber !== undefined) {
      const target = plays.find((p) => p.playNumber === focusPlayNumber);
      if (target) {
        setActivePlayId(target.id);
        return;
      }
    }
    if (!plays.some((p) => p.id === activePlayId)) {
      setActivePlayId(plays[0].id);
    }
  }, [selectedGame?.id, plays, focusPlayNumber, activePlayId]);

  const activePlayIndex = plays.findIndex((p) => p.id === activePlayId);
  const activePlay = activePlayIndex >= 0 ? plays[activePlayIndex] : plays[0];
  const prevPlay = activePlayIndex > 0 ? plays[activePlayIndex - 1] : undefined;
  const nextPlay = activePlayIndex >= 0 && activePlayIndex < plays.length - 1 ? plays[activePlayIndex + 1] : undefined;

  const activePossession = useMemo(
    () => possessions.find((p) => p.id === activePlay?.id),
    [possessions, activePlay?.id]
  );

  const clipIdx = activePlay ? clipFor.get(activePlay.id) : undefined;
  const clip = clipIdx !== undefined ? clips[clipIdx] : undefined;
  const nextClipIdx = nextPlay ? clipFor.get(nextPlay.id) : undefined;
  const nextClip = nextClipIdx !== undefined ? clips[nextClipIdx] : undefined;

  const clipUrl = useClipUrl(clip, localFiles, nextClip);

  // Highlights store for HighlightButton
  const season = seasonOf();
  const teamHighlights = useHighlights(bballTeamId, season, { live: !readOnly });
  const deviceHighlights = useDeviceHighlights(bballTeamId, season, readOnly ? userEmail : '');
  const highlightsStore = readOnly && userEmail ? deviceHighlights : teamHighlights;

  const allSets = useMemo(() => {
    const merged = [...DEFAULT_BASKETBALL_SETS, ...customSets];
    return Array.from(new Set(merged));
  }, [customSets]);

  const playerOptions = useMemo(() => roster.map(formatPlayerOption), [roster]);

  const updateSelectedPossession = useCallback(
    (patch: Partial<BasketballPossession>) => {
      if (!selectedGame || readOnly) return;
      if (!activePossession && activePlay) {
        // Materialize virtual clip into a real possession when edited.
        const fresh: BasketballPossession = {
          id: `pos-${Date.now()}-${activePlay.playNumber}`,
          playNumber: activePlay.playNumber,
          period: 1,
          teamSide: 'us',
          phase: 'half_court',
          setCall: allSets[0] || '5-Out Motion',
          defenseFaced: 'man',
          result: '2pt_make',
          points: 2,
          editedAt: Date.now(),
          ...patch,
        };
        onUpdatePossessions(selectedGame.id, [...possessions, fresh]);
        setActivePlayId(fresh.id);
        return;
      }
      if (!activePossession) return;
      const next = possessions.map((p) =>
        p.id === activePossession.id ? { ...p, ...patch, editedAt: Date.now() } : p
      );
      onUpdatePossessions(selectedGame.id, next);
    },
    [selectedGame, readOnly, activePossession, activePlay, possessions, onUpdatePossessions, allSets]
  );

  const handleAddPossession = () => {
    if (!selectedGame || readOnly) return;
    const nextNum = possessions.reduce((max, p) => Math.max(max, p.playNumber), 0) + 1;
    const created: BasketballPossession = {
      id: `pos-${Date.now()}-${nextNum}`,
      playNumber: nextNum,
      period: activePossession?.period || 1,
      teamSide: 'us',
      phase: 'half_court',
      setCall: allSets[0] || '5-Out Motion',
      defenseFaced: activePossession?.defenseFaced || 'man',
      result: '2pt_make',
      points: 2,
      editedAt: Date.now(),
    };
    onUpdatePossessions(selectedGame.id, [...possessions, created]);
    setActivePlayId(created.id);
  };

  const handleSeedFromClips = () => {
    if (!selectedGame || readOnly || !clips.length) return;
    const created: BasketballPossession[] = clips.map((_, i) => ({
      id: `pos-${Date.now()}-${i + 1}`,
      playNumber: i + 1,
      period: 1,
      teamSide: 'us',
      phase: 'half_court',
      setCall: allSets[0] || '5-Out Motion',
      defenseFaced: 'man',
      result: '2pt_make',
      points: 2,
      editedAt: Date.now(),
    }));
    onUpdatePossessions(selectedGame.id, created);
    if (created[0]) setActivePlayId(created[0].id);
  };

  const handleDeletePossession = (id: string) => {
    if (!selectedGame || readOnly) return;
    const next = possessions.filter((p) => p.id !== id);
    onUpdatePossessions(selectedGame.id, next);
    if (activePlayId === id && next[0]) setActivePlayId(next[0].id);
  };

  // Shared film notes & drawings
  const playNotes = useMemo(
    () => (shared.notes || []).filter((n) => n.playId === activePlay?.id && !shared.deletedNotes?.[n.id]),
    [shared.notes, shared.deletedNotes, activePlay?.id]
  );
  const marks: FilmMark[] = activePlay ? shared.drawings?.[activePlay.id]?.marks || [] : [];

  const saveMarks = useCallback(
    (nextMarks: FilmMark[]) => {
      if (!activePlay || readOnly) return;
      update((s) => ({
        ...s,
        drawings: {
          ...(s.drawings || {}),
          [activePlay.id]: { marks: nextMarks, editedAt: Date.now() },
        },
      }));
    },
    [activePlay, readOnly, update]
  );

  const addNote = useCallback(
    (text: string, grade: FilmNote['grade'], t: number, extra?: { audioUrl?: string; durationSec?: number }) => {
      if (!activePlay || readOnly) return;
      const now = Date.now();
      const note: FilmNote = {
        id: `bn-${now}-${Math.random().toString(36).slice(2, 6)}`,
        playId: activePlay.id,
        t,
        text,
        ...(grade ? { grade } : {}),
        ...(extra?.audioUrl ? { audioUrl: extra.audioUrl } : {}),
        ...(extra?.durationSec ? { durationSec: extra.durationSec } : {}),
        author: authorName || 'Coach',
        createdAt: now,
        editedAt: now,
      };
      update((s) => ({ ...s, notes: [...(s.notes || []), note] }));
    },
    [activePlay, readOnly, authorName, update]
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      if (readOnly) return;
      update((s) => ({
        ...s,
        notes: (s.notes || []).filter((n) => n.id !== noteId),
        deletedNotes: { ...(s.deletedNotes || {}), [noteId]: Date.now() },
      }));
    },
    [readOnly, update]
  );

  // Placeholder states matching FilmRoomView semantics
  const placeholder = (() => {
    if (!selectedGame) return null;
    if (film.status === 'loading') return <span>Opening {film.label}…</span>;
    if (film.status === 'error') {
      return (
        <div className="flex flex-col items-center gap-2 max-w-md text-center px-4">
          <span className="text-rose-300 text-xs">{readOnly ? 'Film is not ready yet.' : film.message}</span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer"
            >
              Link Game Film
            </button>
          )}
        </div>
      );
    }
    if (film.status === 'reconnect') {
      return (
        <div className="flex flex-col items-center gap-2 px-4">
          <button
            type="button"
            onClick={reconnect}
            className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Open folder "{film.label}"
          </button>
          {sources.drive && (
            <button
              type="button"
              onClick={() => void playFromDrive()}
              className="text-xs font-semibold underline text-zinc-300 cursor-pointer"
            >
              Use Google Drive instead
            </button>
          )}
        </div>
      );
    }
    if (film.status === 'choose') {
      return (
        <div className="flex flex-col items-center gap-2 max-w-md text-center px-4">
          <span className="text-xs text-zinc-300">
            Multiple folders found in {film.label}. Select the folder for <b>{selectedGame.opponent}</b>:
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {!readOnly &&
              film.choices.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => choose(c)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer"
                >
                  {c}
                </button>
              ))}
          </div>
        </div>
      );
    }
    if (film.status === 'signin') {
      return (
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <span className="text-xs text-zinc-300">Film lives in Google Drive folder "{film.label}".</span>
          <button
            type="button"
            onClick={signInToDrive}
            className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer"
          >
            Sign in with Google
          </button>
          {sources.local && canOpenFolders() && (
            <button
              type="button"
              onClick={() => void playFromComputer()}
              className="text-xs underline text-zinc-300 cursor-pointer"
            >
              Use local computer folder
            </button>
          )}
        </div>
      );
    }
    if (film.status === 'none') {
      return (
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <Film className="w-7 h-7 text-zinc-500" />
          <span className="text-xs text-zinc-300">
            {readOnly ? 'No film linked for this game yet.' : 'No film linked yet — connect local video clips or Google Drive.'}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="mt-1 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer hover:bg-amber-400 transition-colors"
            >
              Link Game Film
            </button>
          )}
        </div>
      );
    }
    if (clipUrl.loading) return <span className="text-xs text-zinc-300">Loading clip…</span>;
    if (clipUrl.error) return <span className="text-xs text-rose-300">{clipUrl.error}</span>;
    if (!clips.length) return <span className="text-xs text-zinc-300">No video clips found in {film.label}.</span>;
    if (activePlay && !clip) return <span className="text-xs text-zinc-300">No clip matched to Play #{activePlay.playNumber}.</span>;
    return null;
  })();

  const filteredPossessions = useMemo(() => {
    return possessions.filter((p) => {
      if (sideFilter !== 'all' && p.teamSide !== sideFilter) return false;
      if (periodFilter > 0 && p.period !== periodFilter) return false;
      return true;
    });
  }, [possessions, sideFilter, periodFilter]);

  if (!selectedGame) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
        <Film className="w-8 h-8 mx-auto text-zinc-400" />
        <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-100">No Games Scheduled</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Add a game in Schedule first, then open it here to link film and tag possessions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Film Room Toolbar */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedGame.id}
            onChange={(e) => onSelectGame(e.target.value)}
            aria-label="Select game for Film Room"
            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.weekLabel} · {g.opponent} ({g.possessions.length})
              </option>
            ))}
          </select>

          <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
            {possessions.length} possessions · {clips.length} clips
          </span>

          {(root.shared.drive?.folderName || (film.status === 'ready' && film.viaRoot)) && (
            <span
              title="Isolated Basketball Shared Film Folder"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            >
              <Film className="w-3 h-3" />
              <span>
                Basketball Film: {root.shared.drive?.folderName || (film.status === 'ready' ? film.label.split(' › ')[0] : 'Linked')}
              </span>
            </span>
          )}

          {multiView && film.status === 'ready' && (
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {film.views.map((viewName, idx) => (
                <button
                  key={viewName}
                  type="button"
                  onClick={() => setView(idx)}
                  className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    film.view === idx
                      ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950'
                      : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {viewName}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activePlay && clip && filmGame && (userEmail || !readOnly) && (
            <HighlightButton
              store={highlightsStore}
              game={{
                key: filmGame.key,
                gameId: filmGame.gameId,
                name: filmGame.name,
                week: filmGame.week,
              }}
              play={activePlay}
              view={multiView ? mainView : ''}
              clip={clip}
              clipUrl={clipUrl.url}
              getVideo={() => apiRef.current?.video?.()}
              me={userEmail || authorName || 'coach'}
              personal={readOnly}
            />
          )}

          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  film.status === 'ready'
                    ? 'border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:border-amber-500'
                    : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{film.status === 'ready' ? 'Change Film' : 'Link Film'}</span>
              </button>

              {film.status === 'ready' && (
                <>
                  <button
                    type="button"
                    onClick={reloadFilm}
                    title="Reload clips"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void unlink()}
                    title="Unlink game film"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-rose-500 cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Split: Video Player + 1-Click Basketball Tagger */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem] gap-4 items-start">
        {/* Video Stage */}
        <div className="space-y-2.5 min-w-0">
          <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950">
            <FilmPlayer
              src={placeholder ? undefined : clipUrl.url}
              placeholder={placeholder}
              title={
                activePossession
                  ? `#${activePossession.playNumber} · ${
                      activePossession.period === 5 ? 'OT' : `Q${activePossession.period}`
                    } ${activePossession.clock || ''} · ${activePossession.setCall} (${activePossession.result.replace(/_/g, ' ').toUpperCase()})`
                  : activePlay
                  ? `Clip #${activePlay.playNumber}: ${activePlay.playName}`
                  : 'Court Studio Film Room'
              }
              marks={marks}
              onMarksChange={readOnly ? () => undefined : saveMarks}
              viewOnly={readOnly}
              hasPrev={Boolean(prevPlay)}
              hasNext={Boolean(nextPlay)}
              onPrev={() => prevPlay && setActivePlayId(prevPlay.id)}
              onNext={() => nextPlay && setActivePlayId(nextPlay.id)}
              onStopwatch={(s, at) => addNote(`Shot clock / action ${s.toFixed(2)}s`, undefined, at)}
              onVoiceNote={
                readOnly
                  ? undefined
                  : ({ text, audioUrl, durationSec, at }) => {
                      addNote(text, undefined, at, { audioUrl, durationSec });
                    }
              }
              apiRef={apiRef}
              maxVideoHeight="calc(100dvh - 18rem)"
            />
          </div>

          {film.status === 'ready' && clips.length > 0 && possessions.length === 0 && !readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs">
              <span className="text-amber-900 dark:text-amber-200 font-medium">
                {clips.length} video clips detected. Initialize editable possessions synced 1-to-1 with clips?
              </span>
              <button
                type="button"
                onClick={handleSeedFromClips}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold cursor-pointer hover:bg-amber-400"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Seed {clips.length} Possessions
              </button>
            </div>
          )}
        </div>

        {/* Right Breakdown & Notes Panel */}
        <aside className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 overflow-hidden">
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setRightTab('tag')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                rightTab === 'tag'
                  ? 'border-amber-500 text-zinc-900 dark:text-white'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Possession Tagger
            </button>
            <button
              type="button"
              onClick={() => setRightTab('notes')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold cursor-pointer border-b-2 transition-colors ${
                rightTab === 'notes'
                  ? 'border-amber-500 text-zinc-900 dark:text-white'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Notes ({playNotes.length})
            </button>
          </div>

          {rightTab === 'notes' ? (
            <div className="p-2 max-h-[680px] overflow-y-auto">
              <PlayNotes
                play={activePlay}
                notes={playNotes}
                currentTime={() => apiRef.current?.time?.() || 0}
                onSeek={(t) => apiRef.current?.seek?.(t)}
                onAdd={addNote}
                onDelete={deleteNote}
                readOnly={readOnly}
              />
            </div>
          ) : (
            <div className="p-3.5 space-y-3.5 max-h-[680px] overflow-y-auto">
              {/* Top Actions Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono tabular-nums text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {activePossession ? `Play #${activePossession.playNumber}` : activePlay ? `Clip #${activePlay.playNumber}` : 'New'}
                  </span>
                  {activePossession && !readOnly && (
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedPossession({ isHighlight: !activePossession.isHighlight })
                      }
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                        activePossession.isHighlight
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      <Star
                        className={`w-3 h-3 ${
                          activePossession.isHighlight ? 'fill-amber-500 text-amber-500' : ''
                        }`}
                      />
                      Highlight
                    </button>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1.5">
                    {activePossession && (
                      <button
                        type="button"
                        onClick={() => handleDeletePossession(activePossession.id)}
                        title="Delete possession"
                        className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddPossession}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 text-xs font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New
                    </button>
                  </div>
                )}
              </div>

              {!activePossession && !activePlay ? (
                <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  Click <b>+ New</b> to start tagging possessions for this game.
                </div>
              ) : (
                <>
                  {/* Team Side & Period/Clock */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      {(['us', 'opponent'] as const).map((side) => {
                        const active = (activePossession?.teamSide || 'us') === side;
                        return (
                          <button
                            key={side}
                            type="button"
                            disabled={readOnly}
                            onClick={() => updateSelectedPossession({ teamSide: side })}
                            className={`flex-1 py-1.5 text-[11px] font-bold cursor-pointer ${
                              active
                                ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950'
                                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {side === 'us' ? 'Us (Off)' : 'Opponent'}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1">
                      <select
                        disabled={readOnly}
                        value={activePossession?.period || 1}
                        onChange={(e) =>
                          updateSelectedPossession({ period: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 })
                        }
                        className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono text-zinc-800 dark:text-zinc-200"
                      >
                        <option value={1}>Q1</option>
                        <option value={2}>Q2</option>
                        <option value={3}>Q3</option>
                        <option value={4}>Q4</option>
                        <option value={5}>OT</option>
                      </select>
                      <input
                        type="text"
                        disabled={readOnly}
                        placeholder="Clock"
                        value={activePossession?.clock || ''}
                        onChange={(e) => updateSelectedPossession({ clock: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono text-zinc-800 dark:text-zinc-200"
                      />
                    </div>
                  </div>

                  {/* Phase & Defense */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                        Phase
                      </label>
                      <select
                        disabled={readOnly}
                        value={activePossession?.phase || 'half_court'}
                        onChange={(e) =>
                          updateSelectedPossession({ phase: e.target.value as PossessionPhase })
                        }
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                      >
                        {Object.entries(PHASE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                        Defense Faced
                      </label>
                      <select
                        disabled={readOnly}
                        value={activePossession?.defenseFaced || 'man'}
                        onChange={(e) =>
                          updateSelectedPossession({ defenseFaced: e.target.value as DefenseType })
                        }
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                      >
                        {Object.entries(DEFENSE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Set / Play Call */}
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      Set / Play Call
                    </label>
                    <select
                      disabled={readOnly}
                      value={
                        allSets.includes(activePossession?.setCall || '')
                          ? activePossession?.setCall
                          : '__custom__'
                      }
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') {
                          updateSelectedPossession({ setCall: e.target.value });
                        }
                      }}
                      className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {allSets.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="__custom__">+ Custom Call…</option>
                    </select>
                    {!readOnly && (
                      <div className="mt-1.5 flex gap-1.5">
                        <input
                          type="text"
                          value={customSetDraft}
                          onChange={(e) => setCustomSetDraft(e.target.value)}
                          placeholder="Add custom set name..."
                          className="flex-1 h-7 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = customSetDraft.trim();
                            if (!trimmed) return;
                            onAddCustomSet(trimmed);
                            updateSelectedPossession({ setCall: trimmed });
                            setCustomSetDraft('');
                          }}
                          className="px-2.5 h-7 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 hover:border-amber-500 cursor-pointer"
                        >
                          Save Set
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Outcome Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Outcome & Points
                      </label>
                      <span className="text-[11px] font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                        +{activePossession?.points ?? 0} PTS
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {OUTCOME_BUTTONS.map((btn) => {
                        const selected = activePossession?.result === btn.result;
                        const activeCls =
                          btn.tone === 'make'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : btn.tone === 'miss'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : btn.tone === 'def'
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-amber-500 text-zinc-950 border-amber-500';
                        return (
                          <button
                            key={btn.result}
                            type="button"
                            disabled={readOnly}
                            onClick={() =>
                              updateSelectedPossession({
                                result: btn.result,
                                points: btn.defaultPoints,
                              })
                            }
                            className={`py-1.5 px-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                              selected
                                ? activeCls
                                : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-500/60'
                            }`}
                          >
                            {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive HalfCourt Shot Zone Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Shot Zone
                      </label>
                      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                        {activePossession?.shotZone
                          ? SHOT_ZONE_LABELS[activePossession.shotZone]
                          : 'Click floor zone'}
                      </span>
                    </div>
                    <HalfCourtSvg
                      mode="picker"
                      compact
                      selectedZone={activePossession?.shotZone}
                      onSelectZone={(z: ShotZone) =>
                        !readOnly && updateSelectedPossession({ shotZone: z })
                      }
                    />
                  </div>

                  {/* Player Credits */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                        Shooter / Scorer
                      </label>
                      <select
                        disabled={readOnly}
                        value={activePossession?.shooter || ''}
                        onChange={(e) => updateSelectedPossession({ shooter: e.target.value || undefined })}
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">— None —</option>
                        {playerOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                        Assister
                      </label>
                      <select
                        disabled={readOnly}
                        value={activePossession?.assister || ''}
                        onChange={(e) => updateSelectedPossession({ assister: e.target.value || undefined })}
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">— None —</option>
                        {playerOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                        Rebounder
                      </label>
                      <select
                        disabled={readOnly}
                        value={activePossession?.rebounder || ''}
                        onChange={(e) => updateSelectedPossession({ rebounder: e.target.value || undefined })}
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">— None —</option>
                        {playerOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                        Defender / Blk / Stl
                      </label>
                      <select
                        disabled={readOnly}
                        value={activePossession?.defender || ''}
                        onChange={(e) => updateSelectedPossession({ defender: e.target.value || undefined })}
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">— None —</option>
                        {playerOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Possession Coaching Note */}
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      Possession Tag Note
                    </label>
                    <input
                      type="text"
                      disabled={readOnly}
                      placeholder="e.g. Backdoor cut off wing deny"
                      value={activePossession?.notes || ''}
                      onChange={(e) => updateSelectedPossession({ notes: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Clickable Possession Log */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Possession Log
            </h3>
            <span className="text-xs font-mono tabular-nums text-zinc-400">
              {filteredPossessions.length} of {possessions.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'us', 'opponent'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSideFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  sideFilter === s
                    ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {s === 'all' ? 'All' : s === 'us' ? 'Us' : 'Opponent'}
              </button>
            ))}

            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(Number(e.target.value))}
              aria-label="Filter possession log by quarter"
              className="h-7 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-700 dark:text-zinc-300"
            >
              <option value={0}>All Quarters</option>
              <option value={1}>Q1</option>
              <option value={2}>Q2</option>
              <option value={3}>Q3</option>
              <option value={4}>Q4</option>
              <option value={5}>OT</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Qtr / Clock</th>
                <th className="py-2 px-3">Side</th>
                <th className="py-2 px-3">Phase · Set Call</th>
                <th className="py-2 px-3">Defense</th>
                <th className="py-2 px-3">Result</th>
                <th className="py-2 px-3">Zone</th>
                <th className="py-2 px-3">Players</th>
                <th className="py-2 px-3">Clip</th>
                <th className="py-2 px-3 text-right">★</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
              {filteredPossessions.map((p) => {
                const selected = activePlay?.id === p.id;
                const matchedClipIdx = clipFor.get(p.id);
                const matchedClip = matchedClipIdx !== undefined ? clips[matchedClipIdx] : undefined;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setActivePlayId(p.id)}
                    className={`cursor-pointer transition-colors ${
                      selected
                        ? 'bg-amber-500/10 dark:bg-amber-500/15'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <td className="py-2 px-3 font-mono tabular-nums font-bold text-zinc-700 dark:text-zinc-300">
                      {p.playNumber}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                      {p.period === 5 ? 'OT' : `Q${p.period}`} {p.clock || ''}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.teamSide === 'us'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                        }`}
                      >
                        {p.teamSide === 'us' ? 'Us' : 'Opp'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{p.setCall}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {PHASE_LABELS[p.phase]}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-zinc-600 dark:text-zinc-300">
                      {DEFENSE_LABELS[p.defenseFaced]}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {p.result.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {p.points > 0 && (
                        <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-bold">
                          +{p.points}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400">
                      {p.shotZone ? SHOT_ZONE_LABELS[p.shotZone] : '—'}
                    </td>
                    <td className="py-2 px-3 text-zinc-600 dark:text-zinc-300 max-w-[180px] truncate">
                      {[
                        p.shooter,
                        p.assister ? `AST ${p.assister}` : '',
                        p.defender ? `DEF ${p.defender}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="py-2 px-3 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 max-w-[140px] truncate">
                      {matchedClip ? matchedClip.name : '—'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {p.isHighlight ? <Star className="w-3.5 h-3.5 inline text-amber-500 fill-amber-500" /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {linkOpen && selectedGame && !readOnly && (
        <LinkFilmDialog
          gameName={`${selectedGame.weekLabel}: ${selectedGame.opponent}`}
          driveLink={shared.drive?.link || root.shared.drive?.link}
          onClose={() => setLinkOpen(false)}
          onFolder={chooseFolder}
          onFiles={(files) => pickFiles(files)}
          onPickedFolder={pickFolderFiles}
          onServerChanged={reloadFilm}
          onDrive={linkDrive}
          onViewFiles={(files, view) => pickFiles(files, view)}
          pickedViews={pickedViews}
        />
      )}
    </div>
  );
};
