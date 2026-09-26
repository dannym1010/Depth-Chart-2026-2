import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DATASETS, SampleDataset } from '../../hudlScout/data/sampleDatasets';
import { ColumnMapping, autoDetectColumnMapping, normalizeHudlRow, parseCsvRows } from '../../hudlScout/utils/csvParser';
import { calculateTendencies } from '../../hudlScout/utils/tendencyEngine';
import { Play } from '../../hudlScout/types/football';
import { Header, ScoutGame, ScoutTarget } from '../../hudlScout/components/Header';
import { FilterBar } from '../../hudlScout/components/FilterBar';
import { OverviewCards } from '../../hudlScout/components/OverviewCards';
import { HashWideSideBoard } from '../../hudlScout/components/HashWideSideBoard';
import { OpponentTellsBanner } from '../../hudlScout/components/OpponentTellsBanner';
import { SituationalMatrix } from '../../hudlScout/components/SituationalMatrix';
import { FormationAnalytics } from '../../hudlScout/components/FormationAnalytics';
import { PersonnelSpecialTeams } from '../../hudlScout/components/PersonnelSpecialTeams';
import { FieldChalkboard } from '../../hudlScout/components/FieldChalkboard';
import { PlaysTable } from '../../hudlScout/components/PlaysTable';
import { UnitStatsView } from '../../hudlScout/components/UnitStatsView';
import { tagPlayUnits } from '../../hudlScout/utils/unitStats';
import type { TeamUnit } from '../../hudlScout/types/football';
import { AIGameplanView } from '../../hudlScout/components/AIGameplanView';
import { UploadModal } from '../../hudlScout/components/UploadModal';
import { CallSheetModal } from '../../hudlScout/components/CallSheetModal';
import { buildLocalGameplan } from '../../hudlScout/utils/buildLocalGameplan';
import { ScoutingData, UserRole, StaffCoach, ScheduleEvent } from '../../types';
import { pickScoutBundle, scoutFingerprint } from '../../utils/remoteStateMerge';
import {
  ScoutBundle,
  DEFAULT_SCOUT_FILTERS as DEFAULT_FILTERS,
  bundleFromSaved,
  removeScoutGame,
  clearScoutUploads,
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
}

export const HudlScoutView: React.FC<HudlScoutViewProps> = ({
  scouting,
  currentWeek = '1',
  activeTeamName = 'Mahopac',
  ownTeamScout,
  onUpdateOwnTeamScout,
  onUpdateScouting,
}) => {
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
  const ownFallback = activeTeamName || 'Mahopac';

  const [scoutTarget, setScoutTarget] = useState<ScoutTarget>('opponent');
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [oppBundle, setOppBundle] = useState<ScoutBundle>(() => bundleFromSaved(saved, opponentFallback));
  const [ownBundle, setOwnBundle] = useState<ScoutBundle>(() =>
    bundleFromSaved(ownTeamScout || saved?.ownTeam, ownFallback)
  );
  const [currentDataset, setCurrentDataset] = useState<SampleDataset | null>(null);
  const [activeTab, setActiveTab] = useState<string>('situational');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);
  const skipSave = useRef(true);
  const skipOwnSave = useRef(true);

  // Our-team play log: tag which unit (Black / Blue / Gold) was on the field.
  // Bumping updatedAt makes the newest-bundle sync keep the tag.
  const handleSetUnit = (playId: string, unit: TeamUnit | undefined, scope: 'play' | 'rest_of_series') => {
    setOwnBundle((prev) => ({ ...prev, plays: tagPlayUnits(prev.plays, playId, unit, scope), updatedAt: Date.now() }));
  };

  const bundle = scoutTarget === 'own' ? ownBundle : oppBundle;
  const setBundle = scoutTarget === 'own' ? setOwnBundle : setOppBundle;
  const allPlays = bundle.plays;
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

  const availableFormations = useMemo(() => {
    const set = new Set<string>();
    plays.forEach((p) => {
      const f = p.formation && p.formation !== '-' ? p.formation.trim() : '';
      if (f && f.toLowerCase() !== 'unspecified') set.add(f);
    });
    return Array.from(set).sort();
  }, [plays]);

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

  const analysis = useMemo(() => calculateTendencies(filteredPlays), [filteredPlays]);
  const fullAnalysis = useMemo(() => {
    const unitPlays = filters.odk === 'ALL' ? plays : plays.filter((p) => p.odk === filters.odk);
    return calculateTendencies(unitPlays.length > 0 ? unitPlays : plays);
  }, [plays, filters.odk]);
  const localReport = useMemo(
    () => (plays.length ? buildLocalGameplan(fullAnalysis, plays, datasetName) : null),
    [fullAnalysis, plays, datasetName]
  );

  useEffect(() => {
    skipSave.current = true;
    setOppBundle(bundleFromSaved(saved, opponentFallback));
    setSelectedGameId('all');
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
      if (!oppBundle.plays.length && !oppBundle.sourceCleared) return;
    }
    onUpdateScouting('hudlScout', {
      plays: oppBundle.plays,
      datasetName: oppBundle.datasetName,
      offensiveScheme: oppBundle.offensiveScheme,
      coachNotes: oppBundle.coachNotes,
      filters: oppBundle.filters,
      games: oppBundle.games,
      sourceCleared: oppBundle.sourceCleared,
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

  const applyPlays = (newPlays: Play[], name: string, append: boolean, scheme = '') => {
    const game: ScoutGame = {
      id: `game-${Date.now()}`,
      name,
      playCount: newPlays.length,
      addedAt: Date.now(),
    };
    const tagged = newPlays.map((p, i) => ({ ...p, id: `${p.id}-${game.id}-${i}`, gameId: game.id }));
    setBundle((prev) => {
      if (append && prev.plays.length) {
        return {
          ...prev,
          plays: [...prev.plays, ...tagged],
          datasetName: prev.datasetName && prev.datasetName !== opponentFallback ? prev.datasetName : name,
          games: [...prev.games, game],
          filters: DEFAULT_FILTERS,
          sourceCleared: false,
          updatedAt: Date.now(),
        };
      }
      return {
        ...prev,
        plays: tagged,
        datasetName: name,
        offensiveScheme: scheme,
        games: [game],
        filters: DEFAULT_FILTERS,
        sourceCleared: false,
        updatedAt: Date.now(),
      };
    });
  };

  const handleSelectSample = (sample: SampleDataset) => {
    const { headers, rows } = parseCsvRows(sample.csvContent);
    const mapping = autoDetectColumnMapping(headers);
    const newPlays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    setCurrentDataset(sample);
    applyPlays(newPlays, sample.name, false, sample.offensiveScheme || '');
  };

  const handleLoadCsv = (csvContent: string, opponent: string, customMapping?: ColumnMapping, append?: boolean) => {
    const { headers, rows } = parseCsvRows(csvContent);
    const mapping = customMapping || autoDetectColumnMapping(headers);
    const newPlays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    const name =
      opponent ||
      (scoutTarget === 'own' ? ownFallback : scouting.opponent || `Week ${currentWeek} opponent`);
    setCurrentDataset(null);
    applyPlays(newPlays, name, Boolean(append));
    if (scoutTarget === 'opponent') onUpdateScouting('opponent', name);
  };

  const handleRemoveGame = (gameId: string) => {
    const game = bundle.games.find((g) => g.id === gameId);
    const label = game?.name || 'this file';
    if (!window.confirm(`Remove "${label}" from this Hudl Scout report?`)) return;
    setBundle((prev) => removeScoutGame(prev, gameId, scoutTarget === 'own' ? ownFallback : opponentFallback));
    if (selectedGameId === gameId) setSelectedGameId('all');
  };

  const handleClearUploads = () => {
    const who = scoutTarget === 'own' ? 'our team (all games this season)' : `this week's opponent (${weekLabel})`;
    if (!window.confirm(`Remove all CSV/Excel uploads from ${who}?`)) return;
    setCurrentDataset(null);
    setSelectedGameId('all');
    setBundle((prev) => clearScoutUploads(prev, scoutTarget === 'own' ? ownFallback : opponentFallback));
  };

  const emptyLabel = scoutTarget === 'own' ? 'our team' : weekLabel;

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <Header
        currentDataset={currentDataset}
        datasetName={
          scoutTarget === 'own'
            ? selectedGameId === 'all'
              ? `${ownFallback} · all games`
              : datasetName
            : `${datasetName} · ${weekLabel}`
        }
        totalPlays={plays.length}
        onOpenUpload={() => setIsUploadOpen(true)}
        onSelectSample={handleSelectSample}
        onOpenCallSheet={() => setIsCallSheetOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        scoutTarget={scoutTarget}
        onScoutTargetChange={(target) => {
          setScoutTarget(target);
          setSelectedGameId('all');
          if (target !== 'own' && activeTab === 'units') setActiveTab('situational');
        }}
        games={bundle.games}
        selectedGameId={selectedGameId}
        onSelectGame={setSelectedGameId}
        onRemoveGame={handleRemoveGame}
        onClearUploads={handleClearUploads}
        weekLabel={weekLabel}
      />

      <FilterBar
        filters={filters}
        onFilterChange={(next) => setBundle((prev) => ({ ...prev, filters: next }))}
        onResetFilters={() => handleResetFilters()}
        availableFormations={availableFormations}
        totalFilteredPlays={filteredPlays.length}
        totalPlays={plays.length}
        odkCounts={odkCounts}
        teamName={datasetName}
      />

      <main className="flex-1 w-full mx-auto px-3 sm:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {plays.length === 0 && (
          <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-950/20 p-6 text-center">
            <p className="text-sm font-black text-emerald-200">
              {scoutTarget === 'own' ? 'Our-team scouting report' : `New scouting report for ${emptyLabel}`}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {scoutTarget === 'own'
                ? 'Upload Hudl CSVs of our team. Each file is a game. Tap a game chip or All games.'
                : `Upload Hudl CSV/Excel for this week's opponent (${weekLabel}). Change the week above to scout next week's team.`}
            </p>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="mt-3 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 dark:bg-emerald-500 dark:text-slate-950 text-xs font-black"
            >
              Upload CSV or Excel
            </button>
            {scoutTarget === 'opponent' && SAMPLE_DATASETS[0] && (
              <button
                type="button"
                onClick={() => handleSelectSample(SAMPLE_DATASETS[0])}
                className="mt-2 ml-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-200 text-xs font-bold"
              >
                Load sample (Carmel)
              </button>
            )}
          </div>
        )}

        <div className={`${activeTab === 'situational' ? 'space-y-4 md:space-y-6' : 'hidden md:block md:space-y-6'}`}>
          <OverviewCards analysis={analysis} />
          <HashWideSideBoard analysis={analysis} />
          <OpponentTellsBanner tells={analysis.tells} />
        </div>

        {activeTab === 'situational' && <SituationalMatrix groups={analysis.situationalGroups} />}
        {activeTab === 'formations' && (
          <div className="space-y-6">
            <FormationAnalytics formations={analysis.formations} totalPlays={filteredPlays.length} />
            <PersonnelSpecialTeams plays={filteredPlays} analysis={analysis} />
          </div>
        )}
        {activeTab === 'field' && <FieldChalkboard analysis={analysis} />}
        {activeTab === 'plays' && (
          <PlaysTable plays={filteredPlays} onSetUnit={scoutTarget === 'own' ? handleSetUnit : undefined} />
        )}
        {activeTab === 'units' && scoutTarget === 'own' && (
          <UnitStatsView
            plays={plays}
            games={selectedGameId === 'all' ? bundle.games : bundle.games.filter((g) => g.id === selectedGameId)}
            onOpenPlayLog={() => setActiveTab('plays')}
          />
        )}
        {activeTab === 'gameplan' && (
          <AIGameplanView
            report={localReport}
            analysis={fullAnalysis}
            plays={plays}
            opponentName={datasetName}
            coachNotes={coachNotes}
            onCoachNotesChange={(notes) => setBundle((prev) => ({ ...prev, coachNotes: notes }))}
          />
        )}
      </main>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onLoadCsv={handleLoadCsv}
        onSelectSample={handleSelectSample}
        hasExistingPlays={plays.length > 0}
      />
      <CallSheetModal
        isOpen={isCallSheetOpen}
        onClose={() => setIsCallSheetOpen(false)}
        report={localReport}
        analysis={fullAnalysis}
        opponentName={datasetName}
      />
    </div>
  );
};
