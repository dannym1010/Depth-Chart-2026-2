import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  CheckSquare,
  Clock,
  Film,
  Keyboard,
  Link2,
  MapPin,
  Maximize2,
  MessageSquare,
  Minimize2,
  PanelBottom,
  PanelRight,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  Unlink,
} from 'lucide-react';
import { naturalCompare } from '../../filmroom/clipMatching';
import { liveViewClips } from '../../filmroom/dualView';
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
  computePlayerBoxStats,
  DEFENSE_LABELS,
  PHASE_LABELS,
  SHOT_ZONE_LABELS,
} from '../basketballAnalytics';
import {
  createTimestampedPossession,
  DEFAULT_BASKETBALL_SETS,
  formatVideoTimestamp,
  nextPossessionSideAfterEvent,
  possessionsToFootballPlays,
  resolvePossessionVideoTarget,
} from '../storage';
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

const LIVE_STAT_ACTIONS: {
  key: string;
  label: string;
  hotkey: string;
  result: PossessionResult;
  points: 0 | 1 | 2 | 3 | 4;
  reboundType?: 'off' | 'def';
  tone: 'make' | 'miss' | 'def' | 'neutral';
}[] = [
  { key: '2pt_make', label: '+2 Make', hotkey: '2', result: '2pt_make', points: 2, tone: 'make' },
  { key: '3pt_make', label: '+3 Make', hotkey: '3', result: '3pt_make', points: 3, tone: 'make' },
  { key: 'and_1', label: 'And-1 (+3)', hotkey: '4', result: 'and_1', points: 3, tone: 'make' },
  { key: 'ft_1', label: 'FT +1', hotkey: '1', result: 'ft_trip', points: 1, tone: 'neutral' },
  { key: 'ft_2', label: 'FT +2', hotkey: '5', result: 'ft_trip', points: 2, tone: 'neutral' },
  { key: '2pt_miss', label: '2PT Miss', hotkey: 'X', result: '2pt_miss', points: 0, tone: 'miss' },
  { key: '3pt_miss', label: '3PT Miss', hotkey: 'Z', result: '3pt_miss', points: 0, tone: 'miss' },
  { key: 'off_reb', label: 'Off Reb', hotkey: 'O', result: 'def_reb', points: 0, reboundType: 'off', tone: 'neutral' },
  { key: 'def_reb', label: 'Def Reb', hotkey: 'B', result: 'def_reb', points: 0, reboundType: 'def', tone: 'def' },
  { key: 'def_steal', label: 'Steal', hotkey: 'G', result: 'def_steal', points: 0, tone: 'def' },
  { key: 'def_block', label: 'Block', hotkey: 'K', result: 'def_block', points: 0, tone: 'def' },
  { key: 'turnover', label: 'Turnover', hotkey: 'T', result: 'turnover', points: 0, tone: 'miss' },
  { key: 'def_stop', label: 'Def Stop', hotkey: 'V', result: 'def_stop', points: 0, tone: 'def' },
  { key: 'foul_drawn', label: 'Foul', hotkey: 'U', result: 'foul_drawn', points: 0, tone: 'neutral' },
];

const QUICK_SHOT_ZONES: { zone: ShotZone; short: string }[] = [
  { zone: 'rim', short: 'Rim' },
  { zone: 'paint', short: 'Paint' },
  { zone: 'mid_center', short: 'Mid' },
  { zone: 'corner_3_left', short: 'L Corner 3' },
  { zone: 'wing_3_left', short: 'L Wing 3' },
  { zone: 'top_3', short: 'Top 3' },
  { zone: 'wing_3_right', short: 'R Wing 3' },
  { zone: 'corner_3_right', short: 'R Corner 3' },
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
  const [logViewTab, setLogViewTab] = useState<'log' | 'box'>('log');
  const [sideFilter, setSideFilter] = useState<'all' | 'us' | 'opponent'>('all');
  const [periodFilter, setPeriodFilter] = useState<number>(0);
  const [customSetDraft, setCustomSetDraft] = useState('');

  // Continuous multi-file playback & live timestamped stat-tagging state
  const [activeClipIndex, setActiveClipIndex] = useState<number>(0);
  const [seekTarget, setSeekTarget] = useState<{ clipIndex: number; timeSec: number; nonce: number } | null>(null);
  const [segmentDurations, setSegmentDurations] = useState<Record<string, number>>({});
  const [leadInSec, setLeadInSec] = useState<0 | 3 | 5>(3);
  const [liveTimeSec, setLiveTimeSec] = useState<number>(0);
  const [liveSide, setLiveSide] = useState<'us' | 'opponent'>('us');
  const [livePeriod, setLivePeriod] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [livePlayerTag, setLivePlayerTag] = useState<string>('');
  const [liveSetCall, setLiveSetCall] = useState<string>('');
  const [livePhase, setLivePhase] = useState<PossessionPhase>('half_court');
  const [liveDefense, setLiveDefense] = useState<DefenseType>('man');
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const [fsHudExpanded, setFsHudExpanded] = useState(true);
  const [fsHudDock, setFsHudDock] = useState<'bottom' | 'right'>('bottom');
  const [hotkeysEnabled, setHotkeysEnabled] = useState(true);
  const [autoFlipSide, setAutoFlipSide] = useState(false);
  const [quickSetDraft, setQuickSetDraft] = useState('');

  const apiRef = useRef<PlayerApi | null>(null);

  const possessions = selectedGame?.possessions || [];
  const plays = useMemo<Play[]>(() => {
    if (!selectedGame) return [];
    if (possessions.length > 0) return possessionsToFootballPlays(selectedGame);
    if (film.status === 'ready' && film.clips.length > 0) {
      // Virtual placeholder plays allow immediate browsing before possessions are committed.
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
  const clips = useMemo<FilmClip[]>(() => {
    const raw = film.status === 'ready' ? liveViewClips(film.clips, shared.removedClips, mainView, multiView) : [];
    return [...raw].sort((a, b) => naturalCompare(a.name, b.name));
  }, [film, shared.removedClips, mainView, multiView]);

  const [activePlayId, setActivePlayId] = useState<string>('');

  // Keep segment index within bounds and reset when switching games.
  useEffect(() => {
    setActiveClipIndex(0);
    setSeekTarget(null);
    setLiveTimeSec(0);
  }, [selectedGame?.id]);

  useEffect(() => {
    if (clips.length > 0 && activeClipIndex >= clips.length) {
      setActiveClipIndex(0);
    }
  }, [clips.length, activeClipIndex]);

  const safeClipIndex = clips.length > 0 ? Math.min(Math.max(0, activeClipIndex), clips.length - 1) : 0;
  const currentClip = clips[safeClipIndex];
  const nextSegmentClip = clips[safeClipIndex + 1];
  const clipUrl = useClipUrl(currentClip, localFiles, nextSegmentClip);

  const selectSegment = useCallback(
    (index: number, timeSec: number = 0) => {
      if (!clips.length) return;
      const clamped = Math.min(Math.max(0, index), clips.length - 1);
      const safeTime = Math.max(0, timeSec);
      setActiveClipIndex(clamped);
      setSeekTarget({ clipIndex: clamped, timeSec: safeTime, nonce: Date.now() });
      if (clamped === safeClipIndex && apiRef.current?.seek) {
        apiRef.current.seek(safeTime);
        setLiveTimeSec(safeTime);
      }
    },
    [clips.length, safeClipIndex]
  );

  // Sync activePlayId when game or focusPlayNumber changes (and seek to that play's video timestamp).
  const focusedRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!plays.length) {
      setActivePlayId('');
      return;
    }
    if (focusPlayNumber !== undefined) {
      const target = plays.find((p) => p.playNumber === focusPlayNumber);
      if (target) {
        setActivePlayId(target.id);
        if (focusedRef.current !== focusPlayNumber) {
          focusedRef.current = focusPlayNumber;
          const matchedPos = possessions.find((p) => p.id === target.id);
          if (matchedPos && clips.length > 0) {
            const loc = resolvePossessionVideoTarget(matchedPos, clips, leadInSec);
            if (loc) selectSegment(loc.clipIndex, loc.seekSec);
          }
        }
        return;
      }
    } else {
      focusedRef.current = undefined;
    }
    if (!plays.some((p) => p.id === activePlayId)) {
      setActivePlayId(plays[0].id);
    }
  }, [selectedGame?.id, plays, possessions, clips, focusPlayNumber, activePlayId, leadInSec, selectSegment]);

  // Lightly poll the current segment time so the live stamp badge stays current while watching.
  useEffect(() => {
    if (!currentClip) {
      setLiveTimeSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      const t = apiRef.current?.time?.();
      if (typeof t === 'number' && Number.isFinite(t)) {
        setLiveTimeSec(t);
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, [currentClip?.id]);

  const activePlayIndex = plays.findIndex((p) => p.id === activePlayId);
  const activePlay = activePlayIndex >= 0 ? plays[activePlayIndex] : plays[0];

  const activePossession = useMemo(
    () => possessions.find((p) => p.id === activePlay?.id),
    [possessions, activePlay?.id]
  );

  const handleJumpToPossession = useCallback(
    (p: BasketballPossession) => {
      setActivePlayId(p.id);
      if (clips.length === 0) return;
      const loc = resolvePossessionVideoTarget(p, clips, leadInSec);
      if (loc) selectSegment(loc.clipIndex, loc.seekSec);
    },
    [clips, leadInSec, selectSegment]
  );

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

  const scoreSummary = useMemo(() => {
    let us = 0;
    let opp = 0;
    for (const p of possessions) {
      if (p.teamSide === 'us') us += p.points || 0;
      else opp += p.points || 0;
    }
    return { us, opp };
  }, [possessions]);

  const liveBoxRows = useMemo(
    () =>
      computePlayerBoxStats(possessions, roster, 'us').filter(
        (r) => r.pts + r.fga + r.reb + r.ast + r.stl + r.blk + r.to > 0
      ),
    [possessions, roster]
  );

  const segmentEventCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (!clips.length) return counts;
    for (const p of possessions) {
      const target = resolvePossessionVideoTarget(p, clips, 0);
      if (target) {
        counts.set(target.clipIndex, (counts.get(target.clipIndex) || 0) + 1);
      }
    }
    return counts;
  }, [possessions, clips]);

  const currentSegmentPinnedEvents = useMemo(() => {
    if (!clips.length) return [];
    const list: { possession: BasketballPossession; timeSec: number }[] = [];
    for (const p of possessions) {
      if (typeof p.videoTimeSec !== 'number') continue;
      const target = resolvePossessionVideoTarget(p, clips, 0);
      if (target && target.clipIndex === safeClipIndex) {
        list.push({ possession: p, timeSec: p.videoTimeSec });
      }
    }
    return list.sort((a, b) => a.timeSec - b.timeSec);
  }, [possessions, clips, safeClipIndex]);

  const totalKnownDurationSec = useMemo(
    () =>
      clips.reduce(
        (sum, c) => sum + (segmentDurations[c.id] || c.durationSec || 0),
        0
      ),
    [clips, segmentDurations]
  );

  const updateSelectedPossession = useCallback(
    (patch: Partial<BasketballPossession>) => {
      if (!selectedGame || readOnly) return;
      if (!activePossession && activePlay) {
        // Materialize virtual clip into a real possession when edited.
        const nowTime = currentClip ? apiRef.current?.time?.() ?? 0 : undefined;
        const fresh: BasketballPossession = {
          id: `pos-${Date.now()}-${activePlay.playNumber}`,
          playNumber: activePlay.playNumber,
          period: livePeriod,
          teamSide: liveSide,
          phase: livePhase,
          setCall: liveSetCall || allSets[0] || '5-Out Motion',
          defenseFaced: liveDefense,
          result: '2pt_make',
          points: 2,
          ...(currentClip
            ? {
                videoClipName: currentClip.name,
                videoClipIndex: safeClipIndex,
                videoTimeSec: Math.round((nowTime || 0) * 10) / 10,
              }
            : {}),
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
    [
      selectedGame,
      readOnly,
      activePossession,
      activePlay,
      possessions,
      onUpdatePossessions,
      allSets,
      currentClip,
      safeClipIndex,
      livePeriod,
      liveSide,
      livePhase,
      liveSetCall,
      liveDefense,
    ]
  );

  const handleLiveStatTag = (action: (typeof LIVE_STAT_ACTIONS)[number]) => {
    if (!selectedGame || readOnly) return;
    const nowTime = currentClip ? apiRef.current?.time?.() ?? liveTimeSec : undefined;
    const created = createTimestampedPossession({
      existingPossessions: possessions,
      period: livePeriod,
      teamSide: liveSide,
      result: action.result,
      points: action.points,
      phase: livePhase,
      setCall: liveSetCall || undefined,
      defenseFaced: liveDefense,
      playerTag: livePlayerTag || undefined,
      reboundType: action.reboundType,
      videoClipName: currentClip?.name,
      videoClipIndex: clips.length > 0 ? safeClipIndex : undefined,
      videoTimeSec: nowTime,
    });
    onUpdatePossessions(selectedGame.id, [...possessions, created]);
    setActivePlayId(created.id);
    const nextSide = nextPossessionSideAfterEvent(liveSide, action.result, action.reboundType, autoFlipSide);
    if (nextSide !== liveSide) {
      setLiveSide(nextSide);
    }
  };

  const handleUndoLastPossession = () => {
    if (!selectedGame || readOnly || possessions.length === 0) return;
    const next = possessions.slice(0, -1);
    onUpdatePossessions(selectedGame.id, next);
    if (next.length > 0) {
      setActivePlayId(next[next.length - 1].id);
    } else {
      setActivePlayId('');
    }
  };

  const recentPossessions = useMemo(() => [...possessions].slice(-4).reverse(), [possessions]);

  const hotkeyHandlersRef = useRef<{
    onStat: (action: (typeof LIVE_STAT_ACTIONS)[number]) => void;
    onFlipSide: () => void;
    onToggleHud: () => void;
    onUndo: () => void;
    canUndo: boolean;
    isFullscreen: boolean;
  }>({
    onStat: () => undefined,
    onFlipSide: () => undefined,
    onToggleHud: () => undefined,
    onUndo: () => undefined,
    canUndo: false,
    isFullscreen: false,
  });
  hotkeyHandlersRef.current = {
    onStat: handleLiveStatTag,
    onFlipSide: () => setLiveSide((s) => (s === 'us' ? 'opponent' : 'us')),
    onToggleHud: () => setFsHudExpanded((v) => !v),
    onUndo: handleUndoLastPossession,
    canUndo: possessions.length > 0,
    isFullscreen: isPlayerFullscreen,
  };

  useEffect(() => {
    if (readOnly || !hotkeysEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'q') {
        e.preventDefault();
        hotkeyHandlersRef.current.onFlipSide();
        return;
      }
      if (key === 'h' && hotkeyHandlersRef.current.isFullscreen) {
        e.preventDefault();
        hotkeyHandlersRef.current.onToggleHud();
        return;
      }
      if (key === 'backspace' && hotkeyHandlersRef.current.canUndo) {
        e.preventDefault();
        hotkeyHandlersRef.current.onUndo();
        return;
      }
      const matched = LIVE_STAT_ACTIONS.find((a) => a.hotkey.toLowerCase() === key);
      if (matched) {
        e.preventDefault();
        hotkeyHandlersRef.current.onStat(matched);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, hotkeysEnabled]);

  const handleStampActivePlayTime = () => {
    if (!currentClip || !activePossession || readOnly) return;
    const nowTime = Math.round(((apiRef.current?.time?.() ?? liveTimeSec) || 0) * 10) / 10;
    updateSelectedPossession({
      videoClipName: currentClip.name,
      videoClipIndex: safeClipIndex,
      videoTimeSec: nowTime,
      clock: activePossession.clock || formatVideoTimestamp(nowTime),
    });
  };

  const handleAddPossession = () => {
    if (!selectedGame || readOnly) return;
    const nowTime = currentClip ? apiRef.current?.time?.() ?? liveTimeSec : undefined;
    const created = createTimestampedPossession({
      existingPossessions: possessions,
      period: activePossession?.period || livePeriod,
      teamSide: liveSide,
      result: '2pt_make',
      points: 2,
      phase: livePhase,
      setCall: liveSetCall || allSets[0] || '5-Out Motion',
      defenseFaced: activePossession?.defenseFaced || liveDefense,
      playerTag: livePlayerTag || undefined,
      videoClipName: currentClip?.name,
      videoClipIndex: clips.length > 0 ? safeClipIndex : undefined,
      videoTimeSec: nowTime,
    });
    onUpdatePossessions(selectedGame.id, [...possessions, created]);
    setActivePlayId(created.id);
  };

  const handleSeedFromClips = () => {
    if (!selectedGame || readOnly || !clips.length) return;
    const created: BasketballPossession[] = clips.map((c, i) => ({
      id: `pos-${Date.now()}-${i + 1}`,
      playNumber: i + 1,
      period: 1,
      teamSide: 'us',
      phase: 'half_court',
      setCall: allSets[0] || '5-Out Motion',
      defenseFaced: 'man',
      result: '2pt_make',
      points: 2,
      videoClipName: c.name,
      videoClipIndex: i,
      videoTimeSec: 0,
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
    if (clipUrl.loading) return <span className="text-xs text-zinc-300">Loading video segment…</span>;
    if (clipUrl.error) return <span className="text-xs text-rose-300">{clipUrl.error}</span>;
    if (!clips.length) return <span className="text-xs text-zinc-300">No video clips found in {film.label}.</span>;
    if (!currentClip) return <span className="text-xs text-zinc-300">No video segment selected.</span>;
    return null;
  })();

  const filteredPossessions = useMemo(() => {
    return possessions.filter((p) => {
      if (sideFilter !== 'all' && p.teamSide !== sideFilter) return false;
      if (periodFilter > 0 && p.period !== periodFilter) return false;
      return true;
    });
  }, [possessions, sideFilter, periodFilter]);

  const timelinePins = useMemo(() => {
    return currentSegmentPinnedEvents.map(({ possession, timeSec }) => {
      const toneColor =
        possession.result === '2pt_make' ||
        possession.result === '3pt_make' ||
        possession.result === 'and_1' ||
        possession.result === 'ft_trip'
          ? '#10b981'
          : possession.result === '2pt_miss' || possession.result === '3pt_miss' || possession.result === 'turnover'
          ? '#f43f5e'
          : possession.result === 'def_steal' ||
            possession.result === 'def_block' ||
            possession.result === 'def_stop' ||
            possession.result === 'def_reb'
          ? '#0ea5e9'
          : '#f59e0b';
      const label = `#${possession.playNumber} ${possession.setCall} · ${possession.result
        .replace(/_/g, ' ')
        .toUpperCase()}${possession.points > 0 ? ` (+${possession.points})` : ''}${
        possession.shooter ? ` · ${possession.shooter}` : ''
      }${possession.rebounder ? ` · REB ${possession.rebounder}` : ''}${
        possession.defender ? ` · DEF ${possession.defender}` : ''
      }`;
      return {
        id: possession.id,
        timeSec,
        label,
        color: toneColor,
        active: activePlay?.id === possession.id,
        onSelect: () => handleJumpToPossession(possession),
      };
    });
  }, [currentSegmentPinnedEvents, activePlay?.id, handleJumpToPossession]);

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

  const renderLiveTaggingControls = (inFullscreen: boolean) => {
    const subSurface = inFullscreen
      ? 'bg-zinc-900/90 border-white/15 text-zinc-100'
      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200';
    const chipIdle = inFullscreen
      ? 'bg-white/10 border-white/15 text-zinc-200 hover:border-amber-400/70'
      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-amber-500/60';
    const chipActive = inFullscreen
      ? 'bg-amber-500 text-zinc-950 border-amber-500 font-bold'
      : 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950 border-zinc-900 dark:border-amber-500 font-bold';
    const isMakeResult =
      activePossession?.result === '2pt_make' ||
      activePossession?.result === '3pt_make' ||
      activePossession?.result === 'and_1';
    const isMissResult = activePossession?.result === '2pt_miss' || activePossession?.result === '3pt_miss';
    const isShotResult = isMakeResult || isMissResult;

    return (
      <div className="space-y-2">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {inFullscreen ? 'Full-Screen Tagger' : 'Watch & Tag Live'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 dark:text-amber-300 text-[11px] font-mono tabular-nums font-semibold">
              <MapPin className="w-3 h-3" />
              {currentClip ? `Part ${safeClipIndex + 1} @ ${formatVideoTimestamp(liveTimeSec)}` : 'No video loaded'}
            </span>
            {inFullscreen && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-xs font-mono tabular-nums font-bold">
                <span className="text-emerald-400">Us {scoreSummary.us}</span>
                <span className="text-zinc-400">–</span>
                <span className="text-sky-400">Opp {scoreSummary.opp}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {/* Us / Opp Toggle */}
            <div
              className={`inline-flex rounded-md border overflow-hidden ${
                inFullscreen ? 'border-white/20' : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {(['us', 'opponent'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setLiveSide(side)}
                  title="Switch possession side (Q)"
                  className={`px-2 py-1 text-[11px] font-bold cursor-pointer ${
                    liveSide === side ? chipActive : chipIdle
                  }`}
                >
                  {side === 'us' ? 'Us' : 'Opp'}
                </button>
              ))}
            </div>

            {/* Auto-Flip Possession Side Toggle */}
            <button
              type="button"
              onClick={() => setAutoFlipSide((v) => !v)}
              title="Automatically flip Us/Opp after makes, turnovers, steals, stops, and defensive rebounds"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                autoFlipSide ? chipActive : chipIdle
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Auto-Flip</span>
            </button>

            {/* Quick Quarter Pills */}
            <div className="inline-flex items-center gap-0.5">
              {([1, 2, 3, 4, 5] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setLivePeriod(q)}
                  className={`px-1.5 py-1 rounded text-[11px] font-mono border cursor-pointer ${
                    livePeriod === q ? chipActive : chipIdle
                  }`}
                >
                  {q === 5 ? 'OT' : `Q${q}`}
                </button>
              ))}
            </div>

            {/* Phase & Defense Compact Selects */}
            <select
              value={livePhase}
              onChange={(e) => setLivePhase(e.target.value as PossessionPhase)}
              aria-label="Live phase selector"
              className={`h-7 px-1.5 rounded-md border text-[11px] ${subSurface}`}
            >
              {Object.entries(PHASE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={liveDefense}
              onChange={(e) => setLiveDefense(e.target.value as DefenseType)}
              aria-label="Live defense selector"
              className={`h-7 px-1.5 rounded-md border text-[11px] ${subSurface}`}
            >
              {Object.entries(DEFENSE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            {/* Hotkeys Toggle */}
            <button
              type="button"
              onClick={() => setHotkeysEnabled((v) => !v)}
              title="Toggle single-key tagging hotkeys (1-5, X, Z, O, B, G, K, T, V, U, Q, Backspace)"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                hotkeysEnabled ? chipActive : chipIdle
              }`}
            >
              <Keyboard className="w-3 h-3" />
              <span className="hidden sm:inline">Keys</span>
            </button>

            {/* Undo Last */}
            <button
              type="button"
              disabled={possessions.length === 0}
              onClick={handleUndoLastPossession}
              title="Undo last tagged possession (Backspace)"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${chipIdle}`}
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo</span>
            </button>

            {!inFullscreen ? (
              <button
                type="button"
                disabled={!clips.length}
                onClick={() => apiRef.current?.toggleFullscreen?.()}
                title="Open full-screen video player with floating possession & stat HUD (F)"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Full Screen Tagging</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFsHudDock((d) => (d === 'bottom' ? 'right' : 'bottom'))}
                  title="Switch HUD dock position (Bottom bar vs Right side)"
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${chipIdle}`}
                >
                  {fsHudDock === 'bottom' ? <PanelRight className="w-3 h-3" /> : <PanelBottom className="w-3 h-3" />}
                  <span>{fsHudDock === 'bottom' ? 'Right' : 'Bottom'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFsHudExpanded(false)}
                  title="Minimize HUD overlay while watching (H)"
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${chipIdle}`}
                >
                  <span>Hide [H]</span>
                </button>
                <button
                  type="button"
                  onClick={() => apiRef.current?.toggleFullscreen?.()}
                  title="Exit full screen (F or Esc)"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  <Minimize2 className="w-3 h-3" />
                  <span>Exit</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Fullscreen Segment Switcher when multi-file film is active */}
        {inFullscreen && clips.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mr-1">Segment:</span>
            {clips.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectSegment(idx, 0)}
                className={`px-2 py-0.5 rounded font-mono border cursor-pointer ${
                  idx === safeClipIndex ? chipActive : chipIdle
                }`}
              >
                Part {idx + 1}
              </button>
            ))}
          </div>
        )}

        {/* 1-Click Play / Set Call Pills + Quick Inline Add */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mr-0.5">Play:</span>
          <button
            type="button"
            onClick={() => setLiveSetCall('')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer ${
              liveSetCall === '' ? chipActive : chipIdle
            }`}
          >
            Default
          </button>
          {allSets.map((setName) => (
            <button
              key={setName}
              type="button"
              onClick={() => setLiveSetCall(liveSetCall === setName ? '' : setName)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer ${
                liveSetCall === setName ? chipActive : chipIdle
              }`}
            >
              {setName}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = quickSetDraft.trim();
              if (!trimmed) return;
              onAddCustomSet(trimmed);
              setLiveSetCall(trimmed);
              setQuickSetDraft('');
            }}
            className="inline-flex items-center gap-1 ml-1"
          >
            <input
              type="text"
              value={quickSetDraft}
              onChange={(e) => setQuickSetDraft(e.target.value)}
              placeholder="+ Custom play..."
              className={`h-6 w-28 px-2 rounded-md border text-[11px] ${subSurface}`}
            />
            {quickSetDraft.trim() && (
              <button
                type="submit"
                className="px-2 h-6 rounded-md bg-amber-500 text-zinc-950 text-[11px] font-bold cursor-pointer"
              >
                Add
              </button>
            )}
          </form>
        </div>

        {/* Player Jersey Chips */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mr-0.5">Player:</span>
          <button
            type="button"
            onClick={() => setLivePlayerTag('')}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
              livePlayerTag === '' ? chipActive : chipIdle
            }`}
          >
            Team / None
          </button>
          {roster.map((p) => {
            const fullTag = formatPlayerOption(p);
            const active = livePlayerTag === fullTag;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setLivePlayerTag(active ? '' : fullTag)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${
                  active ? chipActive : chipIdle
                }`}
              >
                #{p.num} {p.lastName || p.firstName}
              </button>
            );
          })}
        </div>

        {/* 1-Click Live Stat Action Grid */}
        <div
          className={`grid gap-1.5 ${
            inFullscreen && fsHudDock === 'right'
              ? 'grid-cols-2'
              : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-7'
          }`}
        >
          {LIVE_STAT_ACTIONS.map((action) => {
            const toneCls =
              action.tone === 'make'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white'
                : action.tone === 'miss'
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white'
                : action.tone === 'def'
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-600 hover:text-white'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-zinc-950';
            const fsToneCls = inFullscreen
              ? action.tone === 'make'
                ? '!text-emerald-300'
                : action.tone === 'miss'
                ? '!text-rose-300'
                : action.tone === 'def'
                ? '!text-sky-300'
                : '!text-amber-300'
              : '';
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => handleLiveStatTag(action)}
                className={`flex items-center justify-between gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${toneCls} ${fsToneCls}`}
              >
                <span className="truncate">{action.label}</span>
                {hotkeysEnabled && (
                  <kbd className="px-1 py-0 rounded bg-black/15 dark:bg-white/15 text-[9px] font-mono opacity-80 shrink-0">
                    {action.hotkey}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>

        {/* Smart Post-Tag Follow-Up Bar ("Combo Chain") on Active Play */}
        {activePossession && (
          <div
            className={`pt-2 border-t space-y-1.5 text-[11px] ${
              inFullscreen ? 'border-white/15' : 'border-zinc-200/80 dark:border-zinc-800/80'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                  <Sparkles className="w-3 h-3" />
                  Play #{activePossession.playNumber}
                </span>
                <span className="opacity-80">
                  {activePossession.result.replace(/_/g, ' ').toUpperCase()}
                  {activePossession.points > 0 ? ` (+${activePossession.points})` : ''}
                  {activePossession.shooter ? ` · ${activePossession.shooter}` : ''}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateSelectedPossession({ isHighlight: !activePossession.isHighlight })}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-semibold cursor-pointer ${
                    activePossession.isHighlight ? chipActive : chipIdle
                  }`}
                >
                  <Star
                    className={`w-3 h-3 ${
                      activePossession.isHighlight ? 'fill-current' : ''
                    }`}
                  />
                  Highlight
                </button>
                {currentClip && (
                  <button
                    type="button"
                    onClick={handleStampActivePlayTime}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-300 hover:bg-amber-500 hover:text-zinc-950 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    Stamp Current Time
                  </button>
                )}
              </div>
            </div>

            {/* Smart Follow-Up after Make: 1-tap Who Assisted? */}
            {isMakeResult && roster.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mr-0.5">
                  Who Assisted?
                </span>
                {activePossession.assister && (
                  <button
                    type="button"
                    onClick={() => updateSelectedPossession({ assister: undefined })}
                    className={`px-1.5 py-0.5 rounded border text-[10px] cursor-pointer ${chipIdle}`}
                  >
                    Clear AST
                  </button>
                )}
                {roster.map((p) => {
                  const fullTag = formatPlayerOption(p);
                  const active = activePossession.assister === fullTag;
                  return (
                    <button
                      key={`ast-${p.id}`}
                      type="button"
                      onClick={() =>
                        updateSelectedPossession({ assister: active ? undefined : fullTag })
                      }
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                        active ? chipActive : chipIdle
                      }`}
                    >
                      #{p.num} {p.lastName || p.firstName}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Smart Follow-Up after Miss: 1-tap Who Rebounded? */}
            {isMissResult && roster.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500 mr-0.5">
                  Who Rebounded?
                </span>
                {(['def', 'off'] as const).map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => updateSelectedPossession({ reboundType: rt })}
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase cursor-pointer ${
                      (activePossession.reboundType || 'def') === rt ? chipActive : chipIdle
                    }`}
                  >
                    {rt === 'off' ? 'OREB' : 'DREB'}
                  </button>
                ))}
                {roster.map((p) => {
                  const fullTag = formatPlayerOption(p);
                  const active = activePossession.rebounder === fullTag;
                  return (
                    <button
                      key={`reb-${p.id}`}
                      type="button"
                      onClick={() =>
                        updateSelectedPossession({
                          rebounder: active ? undefined : fullTag,
                          reboundType: activePossession.reboundType || 'def',
                        })
                      }
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                        active ? chipActive : chipIdle
                      }`}
                    >
                      #{p.num} {p.lastName || p.firstName}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 1-Click Shot Zone Pills on Shots */}
            {isShotResult && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mr-0.5">
                  Shot Zone:
                </span>
                {QUICK_SHOT_ZONES.map((z) => {
                  const active = activePossession.shotZone === z.zone;
                  return (
                    <button
                      key={z.zone}
                      type="button"
                      onClick={() =>
                        updateSelectedPossession({ shotZone: active ? undefined : z.zone })
                      }
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                        active ? chipActive : chipIdle
                      }`}
                    >
                      {z.short}
                    </button>
                  );
                })}
              </div>
            )}

            {/* General Quick Credit Row when a player chip is active */}
            {livePlayerTag && !isMakeResult && !isMissResult && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="opacity-75 mr-1">Credit {livePlayerTag}:</span>
                <button
                  type="button"
                  onClick={() => updateSelectedPossession({ assister: livePlayerTag })}
                  className={`px-2 py-0.5 rounded border font-semibold cursor-pointer ${chipIdle}`}
                >
                  + Assist
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedPossession({ rebounder: livePlayerTag, reboundType: 'off' })}
                  className={`px-2 py-0.5 rounded border font-semibold cursor-pointer ${chipIdle}`}
                >
                  + Off Reb
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedPossession({ rebounder: livePlayerTag, reboundType: 'def' })}
                  className={`px-2 py-0.5 rounded border font-semibold cursor-pointer ${chipIdle}`}
                >
                  + Def Reb
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedPossession({ defender: livePlayerTag })}
                  className={`px-2 py-0.5 rounded border font-semibold cursor-pointer ${chipIdle}`}
                >
                  + Defender
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recent Plays Ticker (Last 4) */}
        {recentPossessions.length > 0 && (
          <div
            className={`pt-2 border-t flex flex-wrap items-center gap-1.5 text-[11px] ${
              inFullscreen ? 'border-white/15' : 'border-zinc-200/80 dark:border-zinc-800/80'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Recent:</span>
            {recentPossessions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleJumpToPossession(p)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono tabular-nums cursor-pointer ${
                  activePlay?.id === p.id ? chipActive : chipIdle
                }`}
              >
                <span>#{p.playNumber}</span>
                <span className="font-sans font-semibold">
                  {p.points > 0 ? `+${p.points}` : p.result.replace('def_', '').replace(/_/g, ' ').toUpperCase()}
                </span>
                {p.shooter || p.rebounder || p.defender ? (
                  <span className="font-sans opacity-80 truncate max-w-[90px]">
                    {(p.shooter || p.rebounder || p.defender || '').replace(/^#\S+\s+/, '#')}
                  </span>
                ) : null}
                {typeof p.videoTimeSec === 'number' && (
                  <span className="opacity-75">@{formatVideoTimestamp(p.videoTimeSec)}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const fullscreenOverlay = readOnly ? (
    <div className="absolute top-12 right-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-white/15 text-xs text-zinc-100 shadow-xl">
      <span className="font-mono tabular-nums font-bold">
        <span className="text-emerald-400">Us {scoreSummary.us}</span> –{' '}
        <span className="text-sky-400">Opp {scoreSummary.opp}</span>
      </span>
      <button
        type="button"
        onClick={() => apiRef.current?.toggleFullscreen?.()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold cursor-pointer"
      >
        <Minimize2 className="w-3 h-3" /> Exit
      </button>
    </div>
  ) : !fsHudExpanded ? (
    <div className="absolute top-12 right-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-white/15 text-xs text-zinc-100 shadow-2xl">
      <span className="font-mono tabular-nums font-bold">
        <span className="text-emerald-400">Us {scoreSummary.us}</span> –{' '}
        <span className="text-sky-400">Opp {scoreSummary.opp}</span>
      </span>
      {recentPossessions[0] && (
        <span className="hidden sm:inline text-[11px] text-zinc-300">
          Last: #{recentPossessions[0].playNumber}{' '}
          {recentPossessions[0].result.replace(/_/g, ' ').toUpperCase()}
        </span>
      )}
      <button
        type="button"
        onClick={() => setFsHudExpanded(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[11px] cursor-pointer"
      >
        <Sparkles className="w-3 h-3" />
        Tag Plays &amp; Stats [H]
      </button>
      <button
        type="button"
        onClick={() => apiRef.current?.toggleFullscreen?.()}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 text-[11px] font-semibold cursor-pointer"
      >
        <Minimize2 className="w-3 h-3" />
      </button>
    </div>
  ) : (
    <div
      className={
        fsHudDock === 'bottom'
          ? 'absolute inset-x-2 sm:inset-x-3 bottom-28 sm:bottom-24 z-20 max-h-[46dvh] overflow-y-auto rounded-xl border border-white/15 bg-zinc-950/88 backdrop-blur-md p-2.5 sm:p-3 text-zinc-100 shadow-2xl'
          : 'absolute top-12 right-2 sm:right-3 bottom-28 sm:bottom-24 w-[min(92vw,26rem)] z-20 overflow-y-auto rounded-xl border border-white/15 bg-zinc-950/88 backdrop-blur-md p-2.5 sm:p-3 text-zinc-100 shadow-2xl'
      }
    >
      {renderLiveTaggingControls(true)}
    </div>
  );

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
            {possessions.length} possessions · {clips.length} video {clips.length === 1 ? 'file' : 'files'}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-mono tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
            <span className="text-emerald-600 dark:text-emerald-400">Us {scoreSummary.us}</span>
            <span className="text-zinc-400">–</span>
            <span className="text-sky-600 dark:text-sky-400">Opp {scoreSummary.opp}</span>
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
          {activePlay && currentClip && filmGame && (userEmail || !readOnly) && (
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
              clip={currentClip}
              clipUrl={clipUrl.url}
              getVideo={() => apiRef.current?.video?.()}
              me={userEmail || authorName || 'coach'}
              personal={readOnly}
            />
          )}

          {!readOnly && (
            <>
              {clips.length > 0 && (
                <button
                  type="button"
                  onClick={() => apiRef.current?.toggleFullscreen?.()}
                  title="Watch & tag possessions, play calls, and stats in Full Screen (F)"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Full Screen Tagging</span>
                </button>
              )}

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
        {/* Video Stage + Continuous Reel + Live Watch-and-Tag */}
        <div className="space-y-2.5 min-w-0">
          <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950">
            <FilmPlayer
              src={placeholder ? undefined : clipUrl.url}
              placeholder={placeholder}
              title={
                currentClip
                  ? `Part ${safeClipIndex + 1}/${clips.length}: ${currentClip.name}${
                      activePossession
                        ? ` · #${activePossession.playNumber} ${activePossession.setCall}`
                        : ''
                    }`
                  : 'Court Studio Film Room'
              }
              marks={marks}
              onMarksChange={readOnly ? () => undefined : saveMarks}
              viewOnly={readOnly}
              startAt={seekTarget?.clipIndex === safeClipIndex ? seekTarget.timeSec : 0}
              onDuration={(dur) => {
                if (!currentClip || !Number.isFinite(dur) || dur <= 0) return;
                setSegmentDurations((prev) => (prev[currentClip.id] === dur ? prev : { ...prev, [currentClip.id]: dur }));
              }}
              autoNextDefault={true}
              hasPrev={safeClipIndex > 0}
              hasNext={safeClipIndex < clips.length - 1}
              onPrev={() => selectSegment(safeClipIndex - 1, 0)}
              onNext={() => selectSegment(safeClipIndex + 1, 0)}
              onStopwatch={(s, at) => addNote(`Shot clock / action ${s.toFixed(2)}s`, undefined, at)}
              onVoiceNote={
                readOnly
                  ? undefined
                  : ({ text, audioUrl, durationSec, at }) => {
                      addNote(text, undefined, at, { audioUrl, durationSec });
                    }
              }
              apiRef={apiRef}
              timelinePins={timelinePins}
              fullscreenOverlay={fullscreenOverlay}
              onFullscreenChange={setIsPlayerFullscreen}
              maxVideoHeight="calc(100dvh - 18rem)"
            />
          </div>

          {/* Continuous Game Reel Bar across stop-and-start video files */}
          {clips.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Continuous Game Reel
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-zinc-500 dark:text-zinc-400">
                    {clips.length} {clips.length === 1 ? 'segment' : 'segments'}
                    {totalKnownDurationSec > 0 ? ` · ${formatVideoTimestamp(totalKnownDurationSec)} known` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-zinc-500 dark:text-zinc-400 mr-1">Jump Lead-In:</span>
                  {([0, 3, 5] as const).map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setLeadInSec(sec)}
                      className={`px-2 py-0.5 rounded font-mono font-semibold cursor-pointer ${
                        leadInSec === sec
                          ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {sec === 0 ? '0s' : `-${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {clips.map((c, idx) => {
                  const activeSeg = idx === safeClipIndex;
                  const dur = segmentDurations[c.id] || c.durationSec;
                  const eventCount = segmentEventCounts.get(idx) || 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectSegment(idx, 0)}
                      title={c.name}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                        activeSeg
                          ? 'bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300 font-bold'
                          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-500/60'
                      }`}
                    >
                      <span className="font-mono">Part {idx + 1}</span>
                      <span className="max-w-[110px] truncate text-[11px] opacity-80">{c.name}</span>
                      {dur ? (
                        <span className="text-[10px] font-mono tabular-nums opacity-75">
                          {formatVideoTimestamp(dur)}
                        </span>
                      ) : null}
                      {eventCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-zinc-900/10 dark:bg-white/10 text-[10px] font-mono tabular-nums">
                          {eventCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {currentSegmentPinnedEvents.length > 0 && (
                <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mr-1">
                    Part {safeClipIndex + 1} Pins:
                  </span>
                  {currentSegmentPinnedEvents.map(({ possession, timeSec }) => {
                    const isSelected = activePlay?.id === possession.id;
                    return (
                      <button
                        key={possession.id}
                        type="button"
                        onClick={() => handleJumpToPossession(possession)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums border cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 border-amber-500 font-bold'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-amber-500/60'
                        }`}
                      >
                        <span>@{formatVideoTimestamp(timeSec)}</span>
                        <span className="font-sans font-semibold">
                          #{possession.playNumber}{' '}
                          {possession.points > 0
                            ? `+${possession.points}`
                            : possession.rebounder && possession.result === 'def_reb'
                            ? possession.reboundType === 'off'
                              ? 'OREB'
                              : 'DREB'
                            : possession.result.replace('def_', '').replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Live Watch & Tag Bar (shared with Full-Screen Tagging HUD) */}
          {!readOnly && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-3">
              {renderLiveTaggingControls(false)}
            </div>
          )}

          {film.status === 'ready' && clips.length > 0 && possessions.length === 0 && !readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs">
              <span className="text-amber-900 dark:text-amber-200 font-medium">
                {clips.length} video {clips.length === 1 ? 'file' : 'files'} loaded. Tag stats above while watching, or seed 1 possession per file if pre-cut into single plays.
              </span>
              <button
                type="button"
                onClick={handleSeedFromClips}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold cursor-pointer hover:bg-amber-400"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Seed {clips.length} Clips
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
                  Use <b>Watch &amp; Tag Live</b> under the video or click <b>+ New</b> to start tagging possessions.
                </div>
              ) : (
                <>
                  {/* Video Timestamp Anchor */}
                  {activePossession && clips.length > 0 && (() => {
                    const anchor = resolvePossessionVideoTarget(activePossession, clips, 0);
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px]">
                        {anchor ? (
                          <button
                            type="button"
                            onClick={() => handleJumpToPossession(activePossession)}
                            className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            <MapPin className="w-3 h-3" />
                            ▶ Part {anchor.clipIndex + 1}
                            {typeof activePossession.videoTimeSec === 'number'
                              ? ` · ${formatVideoTimestamp(activePossession.videoTimeSec)}`
                              : ''}
                          </button>
                        ) : (
                          <span className="text-zinc-400">No video timestamp linked</span>
                        )}
                        {!readOnly && currentClip && (
                          <button
                            type="button"
                            onClick={handleStampActivePlayTime}
                            className="px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-amber-500 font-semibold cursor-pointer"
                          >
                            Stamp {`Part ${safeClipIndex + 1} @ ${formatVideoTimestamp(liveTimeSec)}`}
                          </button>
                        )}
                      </div>
                    );
                  })()}

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
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Outcome & Points
                      </label>
                      <div className="flex items-center gap-1">
                        {!readOnly &&
                          ([0, 1, 2, 3, 4] as const).map((pts) => (
                            <button
                              key={pts}
                              type="button"
                              onClick={() => updateSelectedPossession({ points: pts })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums font-bold cursor-pointer ${
                                (activePossession?.points ?? 0) === pts
                                  ? 'bg-amber-500 text-zinc-950'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                              }`}
                            >
                              {pts}
                            </button>
                          ))}
                        <span className="ml-1 text-[11px] font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                          +{activePossession?.points ?? 0}
                        </span>
                      </div>
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          Rebounder
                        </label>
                        {(activePossession?.rebounder || activePossession?.result === 'def_reb') && (
                          <div className="inline-flex rounded border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                            {(['def', 'off'] as const).map((rt) => {
                              const active = (activePossession?.reboundType || 'def') === rt;
                              return (
                                <button
                                  key={rt}
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() => updateSelectedPossession({ reboundType: rt })}
                                  className={`px-1.5 py-0 text-[9px] font-bold uppercase cursor-pointer ${
                                    active
                                      ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950'
                                      : 'text-zinc-500 dark:text-zinc-400'
                                  }`}
                                >
                                  {rt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <select
                        disabled={readOnly}
                        value={activePossession?.rebounder || ''}
                        onChange={(e) =>
                          updateSelectedPossession({
                            rebounder: e.target.value || undefined,
                            reboundType: e.target.value ? activePossession?.reboundType || 'def' : undefined,
                          })
                        }
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

      {/* Bottom Clickable Possession Log & Live Player Box Score */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setLogViewTab('log')}
                className={`px-3 py-1 text-xs font-bold cursor-pointer ${
                  logViewTab === 'log'
                    ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                Possession Log ({filteredPossessions.length})
              </button>
              <button
                type="button"
                onClick={() => setLogViewTab('box')}
                className={`px-3 py-1 text-xs font-bold cursor-pointer ${
                  logViewTab === 'box'
                    ? 'bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                Live Box Score ({liveBoxRows.length})
              </button>
            </div>
            <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
              Score: <b className="text-emerald-600 dark:text-emerald-400">Us {scoreSummary.us}</b> –{' '}
              <b className="text-sky-600 dark:text-sky-400">Opp {scoreSummary.opp}</b>
            </span>
          </div>

          {logViewTab === 'log' && (
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
          )}
        </div>

        {logViewTab === 'log' ? (
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
                  <th className="py-2 px-3">Players &amp; Stats</th>
                  <th className="py-2 px-3">Video Time</th>
                  <th className="py-2 px-3 text-right">★</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
                {filteredPossessions.map((p) => {
                  const selected = activePlay?.id === p.id;
                  const target = resolvePossessionVideoTarget(p, clips, 0);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleJumpToPossession(p)}
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
                          {p.rebounder && p.result === 'def_reb'
                            ? p.reboundType === 'off'
                              ? 'OFF REB'
                              : 'DEF REB'
                            : p.result.replace(/_/g, ' ').toUpperCase()}
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
                      <td className="py-2 px-3 text-zinc-600 dark:text-zinc-300 max-w-[220px] truncate">
                        {[
                          p.shooter,
                          p.assister ? `AST ${p.assister}` : '',
                          p.rebounder ? `${p.reboundType === 'off' ? 'OREB' : 'DREB'} ${p.rebounder}` : '',
                          p.defender ? `DEF ${p.defender}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="py-2 px-3 text-[11px] font-mono tabular-nums">
                        {target ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJumpToPossession(p);
                            }}
                            title={clips[target.clipIndex]?.name}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-zinc-950 font-semibold cursor-pointer"
                          >
                            ▶ Part {target.clipIndex + 1}
                            {typeof p.videoTimeSec === 'number'
                              ? ` · ${formatVideoTimestamp(p.videoTimeSec)}`
                              : ''}
                          </button>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
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
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            {liveBoxRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Tag scoring, rebounds, assists, steals, blocks, or turnovers with a player selected to populate the live box score.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2 px-3">Player</th>
                    <th className="py-2 px-3 text-right">PTS</th>
                    <th className="py-2 px-3 text-right">FG</th>
                    <th className="py-2 px-3 text-right">3PT</th>
                    <th className="py-2 px-3 text-right">REB</th>
                    <th className="py-2 px-3 text-right">AST</th>
                    <th className="py-2 px-3 text-right">STL</th>
                    <th className="py-2 px-3 text-right">BLK</th>
                    <th className="py-2 px-3 text-right">TO</th>
                    <th className="py-2 px-3 text-right">Video</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80 font-mono tabular-nums">
                  {liveBoxRows.map((r) => {
                    const firstPlayNum = r.clipPlayNumbers[0];
                    const firstPoss = firstPlayNum
                      ? possessions.find((p) => p.playNumber === firstPlayNum)
                      : undefined;
                    return (
                      <tr key={r.playerId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="py-2 px-3 font-sans font-semibold text-zinc-900 dark:text-zinc-100">
                          {r.num ? `#${r.num} ` : ''}
                          {r.name}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                          {r.pts}
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-700 dark:text-zinc-300">
                          {r.fgm}-{r.fga}
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-700 dark:text-zinc-300">
                          {r.tpm}-{r.tpa}
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-700 dark:text-zinc-300">{r.reb}</td>
                        <td className="py-2 px-3 text-right text-zinc-700 dark:text-zinc-300">{r.ast}</td>
                        <td className="py-2 px-3 text-right text-zinc-700 dark:text-zinc-300">{r.stl}</td>
                        <td className="py-2 px-3 text-right text-zinc-700 dark:text-zinc-300">{r.blk}</td>
                        <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400">{r.to}</td>
                        <td className="py-2 px-3 text-right">
                          {firstPoss ? (
                            <button
                              type="button"
                              onClick={() => handleJumpToPossession(firstPoss)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-zinc-950 text-[11px] font-semibold cursor-pointer"
                            >
                              ▶ {r.clipPlayNumbers.length}
                            </button>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
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
