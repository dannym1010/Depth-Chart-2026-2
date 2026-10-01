import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DATASETS, SampleDataset } from '../../hudlScout/data/sampleDatasets';
import { ColumnMapping, autoDetectColumnMapping, normalizeHudlRow, parseCsvRows } from '../../hudlScout/utils/csvParser';
import { calculateTendencies } from '../../hudlScout/utils/tendencyEngine';
import { defenseSystem, setDefenseSystem, type DefenseSystem } from '../../hudlScout/utils/ourDefense';
import { Play } from '../../hudlScout/types/football';
import { Header, ScoutGame, ScoutTarget, ScoutUnit } from '../../hudlScout/components/Header';
import { PlaysTable } from '../../hudlScout/components/PlaysTable';
import { FilmLibrary, type LibraryGame, type LibraryWeek } from '../../filmroom/FilmLibrary';
import { filmGameKey } from '../../filmroom/sharedMerge';
import { Library as LibraryIcon } from 'lucide-react';
import { UnitStatsView } from '../../hudlScout/components/UnitStatsView';
import { tagPlayUnits } from '../../hudlScout/utils/unitStats';
import type { TeamUnit, DownDistGroup } from '../../hudlScout/types/football';
import { UploadModal } from '../../hudlScout/components/UploadModal';
import { CallSheetModal } from '../../hudlScout/components/CallSheetModal';
import { buildLocalGameplan } from '../../hudlScout/utils/buildLocalGameplan';
import { SummaryTab } from '../../hudlScout/components/report/SummaryTab';
import { SituationsTab } from '../../hudlScout/components/report/SituationsTab';
import { RunGameTab } from '../../hudlScout/components/report/RunGameTab';
import { PlayersTab, SpecialTeamsCard } from '../../hudlScout/components/report/PlayersTab';
import { GamePlanTab } from '../../hudlScout/components/report/GamePlanTab';
import { ActiveFiltersBanner, FilterPanel, activeFilterLabels } from '../../hudlScout/components/report/FilterPanel';
import { makeVoice } from '../../hudlScout/components/report/reportText';
import { Card, SectionHeader } from '../../hudlScout/components/report/ui';
import { ScoutingData, UserRole, StaffCoach, ScheduleEvent } from '../../types';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { ScoutOppPlayLibrary } from './ScoutOppPlayLibrary';
import { buildScoutScript, cardsFromTags, isScoutPlayEntry, reportPlays, type ScoutOppPlay } from '../../utils/scoutOppPlays';
import { autoTagFromHudl, setPlaysFormation, tagPlays } from '../../hudlScout/utils/playTags';
import { newPlayEntry } from '../../utils/playbookImport';
import { hudlExportCsv } from '../../hudlScout/utils/hudlExport';
import { CallResultsCard } from '../playbook/CallResultsCard';
import { OwnTeamReport } from '../playbook/OwnTeamReport';
import type { FilmPlayerRef, RosterPlayer } from '../../types';
import { BallRole, WeekBoards, filmLineup, setPlayBallPlayer, setPlayDefPlay, setPlaySub } from '../../utils/filmLineup';
import { pickScoutBundle, scoutFingerprint } from '../../utils/remoteStateMerge';
import {
  ScoutBundle,
  DEFAULT_SCOUT_FILTERS as DEFAULT_FILTERS,
  bundleFromSaved,
  removeScoutGame,
  clearScoutUploads,
  guessGameWeek,
  assignDrives,
  findSameGame,
  mergeGamePlays,
} from '../../hudlScout/scoutBundle';

export interface HudlScoutViewProps {
  scouting: ScoutingData;
  userRole?: UserRole;
  currentUser?: any;
  staffList?: StaffCoach[];
  savedCoaches?: string[];
  scheduleEvents?: ScheduleEvent[];
  currentWeek?: string;
  activeTeamName?: string;
  ownTeamScout?: any;
  onUpdateOwnTeamScout?: (bundle: ScoutBundle) => void;
  onUpdateScouting: (field: keyof ScoutingData | Record<string, unknown>, val?: any) => void;
  onNavigateToSchedule?: () => void;
  onNavigateToTendencies?: () => void;
  onNavigateToHtmlTendencies?: () => void;
  /** Play Bank, for tagging each film play with the play that was run. */
  playDatabase?: PlayDatabaseEntry[];
  onUpdatePlayDatabase?: (next: PlayDatabaseEntry[]) => void;
  /** Season weeks, so each of our games can be linked to the week it was played (PFF). */
  weekOptions?: { key: string; label: string }[];
  /** Week our most recent game was played (default for a new upload of our film). */
  defaultGameWeek?: string;
  /** Our film: roster and each week's depth chart, for who was on the field. */
  roster?: RosterPlayer[];
  weekBoards?: (week: string) => WeekBoards;
  /** Hudl Scout sections outside this view pick opponent / our team and the tab (e.g. Our play log). */
  target?: ScoutTarget;
  tab?: string;
  onViewChange?: (view: { target: ScoutTarget; tab: string }) => void;
  /** Open this Hudl game (from the Film Room). */
  focusGameId?: string;
  /** Every week's scouting games and our games (the reports library), and opening one. */
  reportsLibrary?: { weeks: LibraryWeek[]; others: LibraryGame[] };
  onOpenReport?: (g: LibraryGame) => void;
  /** Formations with no strong side (like 32), and who may change them. */
  balancedFormations?: string[];
  onChangeBalancedFormations?: (list: string[]) => void;
  /** Our defense (fronts, contain, blitzes) the calls are made from, and who may change it. */
  defenseSystem?: Partial<DefenseSystem>;
  onChangeDefenseSystem?: (next: DefenseSystem) => void;
  /** Open the play builder to draw this opponent play. */
  onDrawPlay?: (play: ScoutOppPlay) => void;
  /** Cards made from plays tagged on the film: make each its own opponent play (a copy of our play, or a new one). */
  onAddTaggedPlays?: (cards: ScoutOppPlay[]) => void;
  /** Opponent plays removed from Their plays: delete the diagrams drawn for them. */
  onRemoveDrawnPlays?: (playEntryIds: string[]) => void;
}

export const HudlScoutView: React.FC<HudlScoutViewProps> = ({
  scouting,
  currentUser,
  scheduleEvents = [],
  currentWeek = '1',
  activeTeamName = 'Mahopac',
  ownTeamScout,
  onUpdateOwnTeamScout,
  onUpdateScouting,
  playDatabase,
  onUpdatePlayDatabase,
  weekOptions,
  defaultGameWeek,
  roster,
  weekBoards,
  target,
  tab,
  onViewChange,
  focusGameId,
  balancedFormations,
  onChangeBalancedFormations,
  reportsLibrary,
  onOpenReport,
  defenseSystem: teamDefense,
  onChangeDefenseSystem,
  onDrawPlay,
  onRemoveDrawnPlays,
  onAddTaggedPlays,
}) => {
  // The calls read our defense from the scouting helpers; rebuild them when it changes.
  setDefenseSystem(teamDefense);
  const defense = defenseSystem();
  const defenseKey = JSON.stringify(defense);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const saved = scouting.hudlScout;
  const weekLabel = (() => {
    const raw = String(currentWeek || '').trim();
    if (/^week\s/i.test(raw)) return raw;
    if (/^\d+$/.test(raw)) return `Week ${raw}`;
    const scoutWeek = String(scouting.week || '').trim();
    if (scoutWeek && !scoutWeek.includes('__week_')) {
      return /^week\s/i.test(scoutWeek) ? scoutWeek : `Week ${scoutWeek}`;
    }
    const fromScoped = raw.includes('__week_') ? raw.split('__week_').pop() : raw;
    return fromScoped ? `Week ${fromScoped}` : 'This week';
  })();
  const opponentFallback = scouting.opponent || 'This week opponent';
  // The team we play this week, from the schedule (the Hudl file name is often "X vs Y").
  const scheduledOpponent = (() => {
    const raw = String(currentWeek || '');
    const wk = raw.includes('__week_') ? raw.split('__week_').pop() : raw;
    const game = scheduleEvents.find(
      (e) => ['game', 'tournament', 'scrimmage'].includes(e.type) && String(e.week) === String(wk) && e.opponent
    );
    return game?.opponent?.trim() || '';
  })();
  const ownFallback = activeTeamName || 'Mahopac';

  const [scoutTarget, setScoutTarget] = useState<ScoutTarget>(target || 'opponent');
  const [pickedGameId, setSelectedGameId] = useState<string>(focusGameId || 'all');
  const [oppBundle, setOppBundle] = useState<ScoutBundle>(() => bundleFromSaved(saved, opponentFallback));
  const [ownBundle, setOwnBundle] = useState<ScoutBundle>(() =>
    bundleFromSaved(ownTeamScout || saved?.ownTeam, ownFallback)
  );
  const [currentDataset, setCurrentDataset] = useState<SampleDataset | null>(null);
  const [activeTab, setActiveTabState] = useState<string>(tab || 'summary');
  const setActiveTab = (next: string) => {
    setActiveTabState(next);
    onViewChange?.({ target: scoutTarget, tab: next });
  };
  const switchTarget = (next: ScoutTarget, nextTab?: string) => {
    setScoutTarget(next);
    setSelectedGameId('all');
    setSelectedSituation(null);
    let t = nextTab || activeTab;
    if (next !== 'own' && t === 'units') t = 'summary';
    if (next === 'own' && t === 'theirplays') t = 'summary';
    setActiveTabState(t);
    onViewChange?.({ target: next, tab: t });
  };
  // The Hudl Scout section buttons steer this view.
  useEffect(() => {
    if (target && (target !== scoutTarget || (tab && tab !== activeTab))) switchTarget(target, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, tab]);
  useEffect(() => {
    if (focusGameId) setSelectedGameId(focusGameId);
  }, [focusGameId, scoutTarget]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedSituation, setSelectedSituation] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);
  const skipSave = useRef(true);
  const skipOwnSave = useRef(true);

  // Our-team play log: tag which unit (Black / Blue / Gold) was on the field.
  // Bumping updatedAt makes the newest-bundle sync keep the tag.
  const handleSetUnit = (playId: string, unit: TeamUnit | undefined, scope: 'play' | 'rest_of_series' | 'fill_series') => {
    setOwnBundle((prev) => ({ ...prev, plays: tagPlayUnits(prev.plays, playId, unit, scope), updatedAt: Date.now() }));
  };

  // Tag film plays with the play that was run (Play Bank). Bumping updatedAt keeps the tag through sync.
  const handleTagPlays = (ids: string[], entry: PlayDatabaseEntry | null) => {
    setBundle((prev) => ({ ...prev, plays: tagPlays(prev.plays, ids, entry), updatedAt: Date.now() }));
  };
  const handleCreateCall = (name: string, unit: 'offense' | 'defense') => {
    const base = newPlayEntry(name, unit);
    // Calls typed while tagging an opponent are filed apart from our own plays.
    const entry = scoutTarget === 'opponent' ? { ...base, category: 'Opponent plays', tags: ['Opponent'] } : base;
    onUpdatePlayDatabase?.([...(playDatabase || []), entry]);
    return entry;
  };
  const handleSetFormation = (ids: string[], formation: string) => {
    setBundle((prev) => ({ ...prev, plays: setPlaysFormation(prev.plays, ids, formation), updatedAt: Date.now() }));
  };
  // Who was on the field for one of our plays: that game's week, depth chart and any subs.
  const lineupFor = (play: Play) => {
    const game = ownBundle.games.find((g) => g.id === play.gameId) || (!play.gameId ? ownBundle.games[0] : undefined);
    const week = game?.week || '';
    const weekLabel = weekOptions?.find((w) => w.key === week)?.label;
    if (!week || !weekBoards) return { lineup: filmLineup(play, undefined, roster || []), weekLabel: game?.name };
    return { lineup: filmLineup(play, weekBoards(week), roster || []), weekLabel };
  };
  const lineupOnly = React.useCallback((play: Play) => lineupFor(play).lineup, [ownBundle.games, weekBoards, roster, weekOptions]);
  const handleSetSub = (playId: string, slotId: string, ref: FilmPlayerRef | null | undefined) => {
    setOwnBundle((prev) => ({ ...prev, plays: setPlaySub(prev.plays, playId, slotId, ref), updatedAt: Date.now() }));
  };
  const handleSetBall = (playId: string, role: BallRole, label: string) => {
    setOwnBundle((prev) => ({ ...prev, plays: setPlayBallPlayer(prev.plays, playId, role, label), updatedAt: Date.now() }));
  };
  const handleSetDefPlay = (playId: string, patch: Partial<NonNullable<Play['defPlay']>>) => {
    setOwnBundle((prev) => ({ ...prev, plays: setPlayDefPlay(prev.plays, playId, patch), updatedAt: Date.now() }));
  };
  const handleSetGameWeek = (gameId: string, week: string) => {
    setOwnBundle((prev) => ({
      ...prev,
      games: prev.games.map((g) => (g.id === gameId ? { ...g, week, editedAt: Date.now() } : g)),
      updatedAt: Date.now(),
    }));
  };

  const bundle = scoutTarget === 'own' ? ownBundle : oppBundle;
  const setBundle = scoutTarget === 'own' ? setOwnBundle : setOppBundle;

  // Our games uploaded before weeks were tracked: fill in the week from the schedule when it is clear.
  useEffect(() => {
    if (!scheduleEvents.length) return;
    const missing = ownBundle.games.filter((g) => g.week === undefined && guessGameWeek(g.name, scheduleEvents));
    if (!missing.length) return;
    setOwnBundle((prev) => ({
      ...prev,
      games: prev.games.map((g) => (g.week !== undefined ? g : { ...g, week: guessGameWeek(g.name, scheduleEvents), editedAt: Date.now() })),
      updatedAt: Date.now(),
    }));
  }, [ownBundle.games, scheduleEvents]);
  const allPlays = bundle.plays;
  // Their plays shows every play the coaches tagged on the film: a card for each tagged play that
  // isn't there yet (a copy of our play, or a write-in to finish in the play builder).
  const theirPlaysOpen = scoutTarget === 'opponent' && activeTab === 'theirplays';
  useEffect(() => {
    if (!theirPlaysOpen) return;
    const libs = oppBundle.playLibraries || {};
    const nameOf = (id: string) => (playDatabase || []).find((e) => e.id === id && !isScoutPlayEntry(e))?.name;
    const firstGame = oppBundle.games[0]?.id;
    const added: ScoutOppPlay[] = [];
    for (const g of oppBundle.games) {
      const film = oppBundle.plays.filter((pl) => (pl.gameId ? pl.gameId === g.id : g.id === firstGame));
      const cards = cardsFromTags(g.id, film, libs[g.id] || [], oppBundle.deletedOppPlayIds || [], nameOf);
      added.push(...cards);
    }
    if (!added.length) return;
    setOppBundle((prev) => {
      const playLibraries = { ...(prev.playLibraries || {}) };
      for (const c of added) {
        const list = playLibraries[c.gameId] || [];
        if (!list.some((x) => x.id === c.id)) playLibraries[c.gameId] = [...list, c];
      }
      return { ...prev, playLibraries, practiceScript: buildScoutScript(reportPlays(playLibraries), reportName), updatedAt: Date.now() };
    });
    onAddTaggedPlays?.(added);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theirPlaysOpen, oppBundle.plays, oppBundle.games]);
  // A game picked in another report (or removed since) isn't in this one: show all games.
  const selectedGameId = pickedGameId === 'all' || bundle.games.some((g) => g.id === pickedGameId) ? pickedGameId : 'all';
  const plays = useMemo(() => {
    if (selectedGameId === 'all') return allPlays;
    return allPlays.filter((p) => {
      if (p.gameId) return p.gameId === selectedGameId;
      return bundle.games[0]?.id === selectedGameId;
    });
  }, [allPlays, selectedGameId, bundle.games]);
  const datasetName =
    selectedGameId !== 'all'
      ? bundle.games.find((g) => g.id === selectedGameId)?.name || bundle.datasetName
      : bundle.datasetName;
  const filters = bundle.filters;
  const coachNotes = bundle.coachNotes;

  const reportName = scoutTarget === 'own' ? ownFallback : scheduledOpponent || datasetName;

  // Formations to filter by: only the ones on the side being viewed (our offense's aren't on our defense's plays).
  const availableFormations = useMemo(() => {
    const set = new Set<string>();
    plays.forEach((p) => {
      if (bundle.filters.odk !== 'ALL' && p.odk !== bundle.filters.odk) return;
      const f = p.formation && p.formation !== '-' ? p.formation.trim() : '';
      if (f && f.toLowerCase() !== 'unspecified') set.add(f);
    });
    return Array.from(set).sort();
  }, [plays, bundle.filters.odk]);
  // A formation filter left over from the other side (or a removed game) would hide every play: drop it.
  useEffect(() => {
    if (!plays.length || filters.formation === 'ALL' || availableFormations.includes(filters.formation)) return;
    setBundle((prev) => ({ ...prev, filters: { ...prev.filters, formation: 'ALL' } }));
  }, [availableFormations, filters.formation, plays.length]);

  const odkCounts = useMemo(() => {
    let o = 0;
    let d = 0;
    let k = 0;
    plays.forEach((p) => {
      if (p.odk === 'O') o++;
      else if (p.odk === 'D') d++;
      else if (p.odk === 'K') k++;
    });
    return { O: o, D: d, K: k, total: plays.length };
  }, [plays]);

  const filteredPlays = useMemo(() => {
    return plays.filter((p) => {
      if (filters.odk !== 'ALL' && p.odk !== filters.odk) return false;
      if (filters.quarter !== 'ALL' && p.quarter !== filters.quarter) return false;
      if (filters.down !== 'ALL' && p.down !== filters.down) return false;
      if (filters.fieldZone !== 'ALL' && p.fieldZone !== filters.fieldZone) return false;
      if (filters.hash !== 'ALL' && p.hash !== filters.hash) return false;
      if (filters.playType !== 'ALL' && p.playType !== filters.playType) return false;
      if (filters.formation !== 'ALL' && p.formation !== filters.formation) return false;
      return true;
    });
  }, [plays, filters]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const analysis = useMemo(() => calculateTendencies(filteredPlays), [filteredPlays, defenseKey]);
  // The game plan and call sheet are always built against the offense on film,
  // whatever unit or filters the coach is looking at.
  const planPlays = useMemo(() => {
    const offense = plays.filter((p) => p.odk === 'O');
    return offense.length ? offense : plays;
  }, [plays]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const planAnalysis = useMemo(() => calculateTendencies(planPlays), [planPlays, defenseKey]);
  const localReport = useMemo(
    () => (planPlays.length ? buildLocalGameplan(planAnalysis, planPlays, reportName) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planAnalysis, planPlays, reportName, defenseKey]
  );
  const voice = makeVoice(scoutTarget, filters.odk);
  const filterLabels = activeFilterLabels(filters);
  const unitPlayCount = filters.odk === 'ALL' ? plays.length : plays.filter((p) => p.odk === filters.odk).length;
  const pickSituation = (g: DownDistGroup) => {
    setSelectedSituation(g.label);
    setActiveTab('situations');
  };

  useEffect(() => {
    skipSave.current = true;
    setOppBundle(bundleFromSaved(saved, opponentFallback));
    setSelectedGameId(focusGameId || 'all');
  }, [currentWeek]);

  useEffect(() => {
    const remote = saved;
    if (!remote) return;
    const picked = pickScoutBundle(oppBundle, remote);
    if (scoutFingerprint(picked) === scoutFingerprint(oppBundle)) return;
    skipSave.current = true;
    setOppBundle(bundleFromSaved(picked, opponentFallback));
  }, [saved]);

  useEffect(() => {
    const remote = ownTeamScout || saved?.ownTeam;
    if (!remote) return;
    const picked = pickScoutBundle(ownBundle, remote);
    if (scoutFingerprint(picked) === scoutFingerprint(ownBundle)) return;
    skipOwnSave.current = true;
    setOwnBundle(bundleFromSaved(picked, ownFallback));
  }, [ownTeamScout, saved?.ownTeam]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      const hasLibrary = Object.keys(oppBundle.playLibraries || {}).length > 0;
      if (!oppBundle.plays.length && !oppBundle.sourceCleared && !hasLibrary && !oppBundle.games.length) return;
    }
    onUpdateScouting('hudlScout', {
      plays: oppBundle.plays,
      datasetName: oppBundle.datasetName,
      offensiveScheme: oppBundle.offensiveScheme,
      coachNotes: oppBundle.coachNotes,
      filters: oppBundle.filters,
      games: oppBundle.games,
      sourceCleared: oppBundle.sourceCleared,
      callSheet: oppBundle.callSheet,
      deletedGameIds: oppBundle.deletedGameIds,
      playLibraries: oppBundle.playLibraries,
      deletedOppPlayIds: oppBundle.deletedOppPlayIds,
      practiceScript: oppBundle.practiceScript,
      updatedAt: oppBundle.updatedAt,
    });
    if (oppBundle.datasetName && oppBundle.datasetName !== opponentFallback) {
      onUpdateScouting('opponent', oppBundle.datasetName);
    }
  }, [oppBundle]);

  useEffect(() => {
    if (skipOwnSave.current) {
      skipOwnSave.current = false;
      if (!ownBundle.plays.length && !ownBundle.sourceCleared) return;
    }
    if (onUpdateOwnTeamScout) {
      onUpdateOwnTeamScout(ownBundle);
    } else {
      onUpdateScouting('hudlScout', {
        ...(saved || {}),
        ownTeam: ownBundle,
        updatedAt: Math.max(Number(saved?.updatedAt) || 0, ownBundle.updatedAt),
      });
    }
  }, [ownBundle]);

  const handleResetFilters = (resetOdk = false) => {
    setBundle((prev) => ({
      ...prev,
      filters: {
        odk: resetOdk ? 'O' : prev.filters.odk,
        quarter: 'ALL',
        down: 'ALL',
        fieldZone: 'ALL',
        hash: 'ALL',
        playType: 'ALL',
        formation: 'ALL',
      },
    }));
  };

  // The Play Bank for tagging film: our plays (opponent plays drawn from Their plays aren't ours).
  const playBank = useMemo(() => (playDatabase || []).filter((p) => !isScoutPlayEntry(p)), [playDatabase]);
  // Called plays Hudl listed that aren't in the Play Bank yet (offer to add them).
  const [newCalls, setNewCalls] = useState<{ names: string[]; gameId: string } | null>(null);
  const [uploadNote, setUploadNote] = useState('');
  // Tag a game's plays from the play Hudl says was called; plays a coach already tagged are left alone.
  const tagFromHudl = (b: ScoutBundle, gameId: string): ScoutBundle => {
    if (!playBank.length) return b;
    const ids = new Set(b.plays.filter((p) => p.gameId === gameId).map((p) => p.id));
    const res = autoTagFromHudl(b.plays, playBank, ids);
    if (scoutTarget === 'own' && res.unmatched.length) setNewCalls({ names: res.unmatched, gameId });
    else setNewCalls(null);
    if (res.tagged) setUploadNote(`Tagged ${res.tagged} plays from the play Hudl says was called.`);
    return res.tagged ? { ...b, plays: res.plays } : b;
  };
  const addNewCallsAndTag = () => {
    if (!newCalls || !onUpdatePlayDatabase) return;
    const created = newCalls.names.map((n) => newPlayEntry(n, 'offense'));
    const db = [...(playDatabase || []), ...created];
    onUpdatePlayDatabase(db);
    const gameId = newCalls.gameId;
    setBundle((prev) => {
      const ids = new Set(prev.plays.filter((p) => p.gameId === gameId).map((p) => p.id));
      const res = autoTagFromHudl(prev.plays, db, ids);
      setUploadNote(`Added ${created.length} plays to the Play Bank and tagged ${res.tagged} more plays.`);
      return { ...prev, plays: res.plays, updatedAt: Date.now() };
    });
    setNewCalls(null);
  };

  const applyPlays = (newPlays: Play[], name: string, append: boolean, scheme = '', week?: string) => {
    // The same game uploaded again: update it in place, keeping tags, formations, units, subs and credits.
    const same = findSameGame(bundle, newPlays, { name, week: scoutTarget === 'own' ? week : undefined });
    if (same) {
      setBundle((prev) => {
        const merged = mergeGamePlays(prev, same.id, newPlays);
        const withWeek = { ...merged, games: merged.games.map((g) => (g.id === same.id && week && !g.week ? { ...g, week } : g)) };
        return tagFromHudl(withWeek, same.id);
      });
      setUploadNote(`Updated "${same.name}" from the new file. Your tags, formations, units and subs were kept.`);
      setSelectedGameId(same.id);
      return;
    }
    const game: ScoutGame = {
      id: `game-${Date.now()}`,
      name,
      playCount: newPlays.length,
      addedAt: Date.now(),
      ...(scoutTarget === 'own' && week ? { week } : {}),
    };
    const tagged = assignDrives(newPlays.map((p, i) => ({ ...p, id: `${p.id}-${game.id}-${i}`, gameId: game.id })));
    setUploadNote('');
    setBundle((prev) => {
      if (append && prev.plays.length) {
        return tagFromHudl({
          ...prev,
          plays: [...prev.plays, ...tagged],
          datasetName: prev.datasetName && prev.datasetName !== opponentFallback ? prev.datasetName : name,
          games: [...prev.games, game],
          filters: DEFAULT_FILTERS,
          sourceCleared: false,
          updatedAt: Date.now(),
        }, game.id);
      }
      return tagFromHudl({
        ...prev,
        plays: tagged,
        // The games this upload replaces stay gone on every coach's device.
        deletedGameIds: [...new Set([...(prev.deletedGameIds || []), ...prev.games.map((g) => g.id)])],
        datasetName: name,
        offensiveScheme: scheme,
        games: [game],
        filters: DEFAULT_FILTERS,
        sourceCleared: false,
        updatedAt: Date.now(),
      }, game.id);
    });
  };

  // For the upload window: which game already in the report this file is (so re-uploading keeps tags).
  const matchUpload = (csvContent: string, name: string, week?: string): string | null => {
    try {
      const { headers, rows } = parseCsvRows(csvContent);
      const mapping = autoDetectColumnMapping(headers);
      const fresh = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
      return findSameGame(bundle, fresh, { name, week: scoutTarget === 'own' ? week : undefined })?.name || null;
    } catch {
      return null;
    }
  };

  const handleSelectSample = (sample: SampleDataset) => {
    const { headers, rows } = parseCsvRows(sample.csvContent);
    const mapping = autoDetectColumnMapping(headers);
    const newPlays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    setCurrentDataset(sample);
    applyPlays(newPlays, sample.name, false, sample.offensiveScheme || '');
  };

  const handleLoadCsv = (csvContent: string, opponent: string, customMapping?: ColumnMapping, append?: boolean, week?: string) => {
    const { headers, rows } = parseCsvRows(csvContent);
    const mapping = customMapping || autoDetectColumnMapping(headers);
    const newPlays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    const name =
      opponent ||
      (scoutTarget === 'own' ? ownFallback : scouting.opponent || `Week ${currentWeek} opponent`);
    setCurrentDataset(null);
    applyPlays(newPlays, name, Boolean(append), '', week);
    if (scoutTarget === 'opponent') onUpdateScouting('opponent', name);
  };

  const handleRemoveGame = (gameId: string) => {
    const game = bundle.games.find((g) => g.id === gameId);
    const label = game?.name || 'this file';
    if (!window.confirm(`Remove "${label}" from this Hudl Scout report?`)) return;
    setBundle((prev) => removeScoutGame(prev, gameId, scoutTarget === 'own' ? ownFallback : opponentFallback));
    if (selectedGameId === gameId) setSelectedGameId('all');
  };

  // Play log -> CSV to upload back into Hudl: one file per game (Hudl takes one game per upload), rows in play order.
  const handleExportForHudl = async () => {
    const games = selectedGameId === 'all' ? bundle.games : bundle.games.filter((g) => g.id === selectedGameId);
    for (const game of games) {
      const gamePlays = bundle.plays.filter((p) => (p.gameId ? p.gameId === game.id : bundle.games[0]?.id === game.id));
      if (!gamePlays.length) continue;
      const url = URL.createObjectURL(new Blob([hudlExportCsv(gamePlays)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(game.name || 'Game').replace(/[\\/:*?"<>|]/g, ' ').trim()} - Hudl breakdown.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      // Browsers drop downloads started too close together.
      if (games.length > 1) await new Promise((r) => setTimeout(r, 400));
    }
  };

  const handleClearUploads = () => {
    const who = scoutTarget === 'own' ? 'our team (all games this season)' : `this week's opponent (${weekLabel})`;
    if (!window.confirm(`Remove all CSV/Excel uploads from ${who}?`)) return;
    setCurrentDataset(null);
    setSelectedGameId('all');
    setBundle((prev) => clearScoutUploads(prev, scoutTarget === 'own' ? ownFallback : opponentFallback));
  };

  const emptyLabel = scoutTarget === 'own' ? 'our team' : weekLabel;
  const specialTeamsOnly = filters.odk === 'K' && ['summary', 'situations', 'run'].includes(activeTab);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col font-sans">
      <Header
        title={scoutTarget === 'own' ? (selectedGameId === 'all' ? `${ownFallback}: all games` : datasetName) : reportName}
        kicker={scoutTarget === 'own' ? 'Self-scout · our film this season' : `Scouting report · ${weekLabel}`}
        totalPlays={plays.length}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenCallSheet={() => setIsCallSheetOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        scoutTarget={scoutTarget}
        onScoutTargetChange={(next) => switchTarget(next)}
        hideTargetToggle={!!onViewChange}
        games={bundle.games}
        selectedGameId={selectedGameId}
        onSelectGame={setSelectedGameId}
        onRemoveGame={handleRemoveGame}
        onClearUploads={handleClearUploads}
        onExportForHudl={() => void handleExportForHudl()}
        unit={filters.odk as ScoutUnit}
        onUnitChange={(odk) =>
          // A formation belongs to one side, so switching sides drops that filter.
          setBundle((prev) => ({ ...prev, filters: { ...prev.filters, odk, formation: prev.filters.odk === odk ? prev.filters.formation : 'ALL' } }))
        }
        unitCounts={odkCounts}
        filterCount={filterLabels.length}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        weekOptions={weekOptions}
        onSetGameWeek={handleSetGameWeek}
      />

      {/* The reports library: every week's scouting report and our games */}
      {reportsLibrary && onOpenReport && (() => {
        const weekKey = String(currentWeek || '').split('__week_').pop() || '';
        const thisWeek = reportsLibrary.weeks.find((w) => w.key === weekKey);
        const misfiled = scoutTarget === 'opponent' ? (thisWeek?.games || []).filter((g) => g.source === 'opponent' && g.note) : [];
        return (
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <LibraryIcon className="w-4 h-4" /> All reports
            </button>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Every week's scouting report and our games, by week.</span>
            {misfiled.length > 0 && (
              <span className="basis-full sm:basis-auto text-[11px] font-bold text-amber-700 dark:text-amber-400">
                ⚠ {misfiled.map((g) => `${g.name} (${g.note?.toLowerCase()})`).join('; ')}: if it isn't this week's, remove it here with ✕ on its game.
              </span>
            )}
          </div>
        );
      })()}
      {libraryOpen && reportsLibrary && onOpenReport && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setLibraryOpen(false)}>
          <div className="absolute inset-y-0 left-0 w-[88%] max-w-sm bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <FilmLibrary
              title="Scouting reports"
              weeks={reportsLibrary.weeks}
              otherGames={reportsLibrary.others}
              currentWeek={String(currentWeek || '').split('__week_').pop() || ''}
              selectedKey={
                selectedGameId === 'all'
                  ? undefined
                  : scoutTarget === 'own'
                    ? filmGameKey('own', selectedGameId)
                    : filmGameKey('opponent', selectedGameId, String(currentWeek || '').split('__week_').pop() || '')
              }
              onOpen={(g) => {
                setLibraryOpen(false);
                onOpenReport(g);
              }}
              onClose={() => setLibraryOpen(false)}
            />
          </div>
        </div>
      )}

      {filtersOpen && (
        <FilterPanel
          filters={filters}
          onChange={(next) => setBundle((prev) => ({ ...prev, filters: next }))}
          onReset={() => handleResetFilters()}
          formations={availableFormations}
          shown={filteredPlays.length}
          total={unitPlayCount}
        />
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 md:py-6 space-y-4 md:space-y-5">
        {uploadNote && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
            <span>{uploadNote}</span>
            <button type="button" onClick={() => setUploadNote('')} className="font-bold opacity-70 hover:opacity-100 cursor-pointer">Dismiss</button>
          </div>
        )}
        {newCalls && newCalls.names.length > 0 && onUpdatePlayDatabase && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100 space-y-2">
            <div>
              Hudl lists {newCalls.names.length} called play{newCalls.names.length === 1 ? '' : 's'} that {newCalls.names.length === 1 ? "isn't" : "aren't"} in the Play Bank:{' '}
              <strong>{newCalls.names.slice(0, 8).join(', ')}{newCalls.names.length > 8 ? ` and ${newCalls.names.length - 8} more` : ''}</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addNewCallsAndTag} className="h-8 px-3 rounded-lg bg-amber-500 text-slate-950 font-black cursor-pointer">
                Add them to the Play Bank and tag
              </button>
              <button type="button" onClick={() => setNewCalls(null)} className="h-8 px-3 rounded-lg border border-amber-400 font-bold cursor-pointer">
                Not now
              </button>
            </div>
          </div>
        )}
        {scoutTarget === 'opponent' && activeTab === 'theirplays' ? (
          <ScoutOppPlayLibrary
            games={bundle.games}
            libraries={bundle.playLibraries || {}}
            deletedIds={bundle.deletedOppPlayIds || []}
            filmPlays={bundle.plays}
            opponent={reportName}
            selectedGameId={selectedGameId}
            onSelectGame={setSelectedGameId}
            playDatabase={playDatabase}
            onAddFilm={(name) => {
              const id = `film-${Date.now()}`;
              setBundle((prev) => ({
                ...prev,
                games: [...prev.games, { id, name, playCount: 0, addedAt: Date.now(), editedAt: Date.now() }],
                updatedAt: Date.now(),
              }));
              setSelectedGameId(id);
            }}
            onSave={(playLibraries, deletedOppPlayIds, practiceScript) => {
              const before = new Set(bundle.deletedOppPlayIds || []);
              const gone = deletedOppPlayIds.filter((id) => !before.has(id));
              if (gone.length) onRemoveDrawnPlays?.(gone.map((id) => `scout_${id}`));
              setBundle((prev) => ({ ...prev, playLibraries, deletedOppPlayIds, practiceScript, updatedAt: Date.now() }));
            }}
            onDraw={onDrawPlay}
          />
        ) : plays.length === 0 ? (
          <Card>
            <SectionHeader
              title={scoutTarget === 'own' ? 'Self-scout our team' : `New scouting report for ${emptyLabel}`}
              subtitle={
                scoutTarget === 'own'
                  ? 'Upload Hudl CSV or Excel files of our games. Each file is one game.'
                  : `Upload a Hudl CSV or Excel export of this week's opponent (${weekLabel}). Change the week at the top of the app to scout a different team.`
              }
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:text-white text-xs font-bold cursor-pointer"
              >
                Upload CSV or Excel
              </button>
              {scoutTarget === 'opponent' && SAMPLE_DATASETS[0] && (
                <button
                  type="button"
                  onClick={() => handleSelectSample(SAMPLE_DATASETS[0])}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                >
                  Load a sample (Carmel)
                </button>
              )}
            </div>
          </Card>
        ) : (
          <>
            {activeTab !== 'gameplan' && activeTab !== 'units' && (
              <ActiveFiltersBanner labels={filterLabels} shown={filteredPlays.length} total={unitPlayCount} onClear={() => handleResetFilters()} />
            )}

            {filteredPlays.length === 0 && unitPlayCount > 0 && activeTab !== 'units' ? (
              <Card>
                <SectionHeader
                  title="No plays match these filters"
                  subtitle={`There are ${unitPlayCount} plays here, but the filters (${filterLabels.join(', ') || 'none'}) hide all of them.`}
                />
                <button
                  type="button"
                  onClick={() => handleResetFilters()}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                >
                  Clear filters
                </button>
              </Card>
            ) : specialTeamsOnly ? (
              <div className="space-y-4">
                <Card>
                  <SectionHeader
                    title="Special teams"
                    subtitle="Run and pass charts don't apply to kicking plays. Pick an offense or defense above for the full report, or open the Play log to see each kick."
                  />
                </Card>
                <SpecialTeamsCard plays={plays} />
              </div>
            ) : (
              <>
                {activeTab === 'summary' && (
                  <SummaryTab
                    analysis={analysis}
                    plays={filteredPlays}
                    voice={voice}
                    report={localReport}
                    onPickSituation={pickSituation}
                    onOpenGamePlan={() => setActiveTab('gameplan')}
                    onOpenTab={setActiveTab}
                  />
                )}
                {activeTab === 'situations' && (
                  <SituationsTab
                    analysis={analysis}
                    plays={filteredPlays}
                    voice={voice}
                    report={localReport}
                    selectedLabel={selectedSituation}
                    onSelect={(g) => setSelectedSituation(g.label)}
                  />
                )}
                {activeTab === 'run' && (
                  <RunGameTab
                    analysis={analysis}
                    plays={filteredPlays}
                    voice={voice}
                    balancedFormations={balancedFormations}
                    onChangeBalancedFormations={onChangeBalancedFormations}
                  />
                )}
              </>
            )}
            {activeTab === 'players' && scoutTarget === 'own' && weekBoards && (
              <OwnTeamReport plays={plays} lineupFor={lineupOnly} roster={roster || []} />
            )}
            {activeTab === 'players' && <PlayersTab analysis={analysis} plays={filteredPlays} allPlays={plays} voice={voice} />}
            {activeTab === 'gameplan' && (
              <GamePlanTab
                report={localReport}
                analysis={planAnalysis}
                plays={planPlays}
                opponentName={reportName}
                mode={scoutTarget}
                coachNotes={coachNotes}
                onCoachNotesChange={(notes) => setBundle((prev) => ({ ...prev, coachNotes: notes, updatedAt: Date.now() }))}
                onPrintCallSheet={() => setIsCallSheetOpen(true)}
                defense={defense}
                onChangeDefense={onChangeDefenseSystem}
              />
            )}
            {activeTab === 'plays' && (
              <>
                <CallResultsCard plays={filteredPlays} own={scoutTarget === 'own'} />
                <PlaysTable
                  plays={filteredPlays}
                  writeInPlays={allPlays}
                  onSetUnit={scoutTarget === 'own' ? handleSetUnit : undefined}
                  playDatabase={playBank}
                  onTagPlays={onUpdatePlayDatabase ? handleTagPlays : undefined}
                  onCreateCall={onUpdatePlayDatabase ? handleCreateCall : undefined}
                  onSetFormation={handleSetFormation}
                  lineupFor={scoutTarget === 'own' && weekBoards ? lineupFor : undefined}
                  roster={roster}
                  onSetSub={scoutTarget === 'own' ? handleSetSub : undefined}
                  onSetBall={scoutTarget === 'own' ? handleSetBall : undefined}
                  onSetDefPlay={scoutTarget === 'own' ? handleSetDefPlay : undefined}
                  onRefreshFromHudl={scoutTarget === 'own' ? () => setIsUploadOpen(true) : undefined}
                />
              </>
            )}
            {activeTab === 'units' && scoutTarget === 'own' && (
              <UnitStatsView
                plays={plays}
                games={selectedGameId === 'all' ? bundle.games : bundle.games.filter((g) => g.id === selectedGameId)}
                onOpenPlayLog={() => setActiveTab('plays')}
              />
            )}
          </>
        )}
      </main>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onLoadCsv={handleLoadCsv}
        onSelectSample={handleSelectSample}
        hasExistingPlays={plays.length > 0}
        weekOptions={scoutTarget === 'own' ? weekOptions : undefined}
        guessWeek={(name) => guessGameWeek(name, scheduleEvents)}
        defaultWeek={defaultGameWeek}
        showSample={scoutTarget === 'opponent' && plays.length === 0}
        matchUpload={matchUpload}
      />
      <CallSheetModal
        isOpen={isCallSheetOpen}
        onClose={() => setIsCallSheetOpen(false)}
        report={localReport}
        analysis={planAnalysis}
        opponentName={reportName}
        edits={bundle.callSheet}
        onSaveEdits={(callSheet) => setBundle((prev) => ({ ...prev, callSheet, updatedAt: Date.now() }))}
        editorName={currentUser?.displayName || (currentUser?.email ? String(currentUser.email).split('@')[0] : '')}
      />
    </div>
  );
};
