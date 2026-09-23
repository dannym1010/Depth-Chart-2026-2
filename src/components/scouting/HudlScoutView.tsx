import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DATASETS, SampleDataset } from '../../hudlScout/data/sampleDatasets';
import { ColumnMapping, autoDetectColumnMapping, normalizeHudlRow, parseCsvRows } from '../../hudlScout/utils/csvParser';
import { calculateTendencies } from '../../hudlScout/utils/tendencyEngine';
import { Play } from '../../hudlScout/types/football';
import { Header, ScoutGame, ScoutTarget } from '../../hudlScout/components/Header';
import { FilterBar, FilterState } from '../../hudlScout/components/FilterBar';
import { OverviewCards } from '../../hudlScout/components/OverviewCards';
import { HashWideSideBoard } from '../../hudlScout/components/HashWideSideBoard';
import { OpponentTellsBanner } from '../../hudlScout/components/OpponentTellsBanner';
import { SituationalMatrix } from '../../hudlScout/components/SituationalMatrix';
import { FormationAnalytics } from '../../hudlScout/components/FormationAnalytics';
import { PersonnelSpecialTeams } from '../../hudlScout/components/PersonnelSpecialTeams';
import { FieldChalkboard } from '../../hudlScout/components/FieldChalkboard';
import { PlaysTable } from '../../hudlScout/components/PlaysTable';
import { AIGameplanView } from '../../hudlScout/components/AIGameplanView';
import { UploadModal } from '../../hudlScout/components/UploadModal';
import { CallSheetModal } from '../../hudlScout/components/CallSheetModal';
import { buildLocalGameplan } from '../../hudlScout/utils/buildLocalGameplan';
import { ScoutingData, UserRole, StaffCoach, ScheduleEvent } from '../../types';

const DEFAULT_FILTERS: FilterState = {
  odk: 'O',
  quarter: 'ALL',
  down: 'ALL',
  fieldZone: 'ALL',
  hash: 'ALL',
  playType: 'ALL',
  formation: 'ALL',
};

interface ScoutBundle {
  plays: Play[];
  datasetName: string;
  offensiveScheme: string;
  coachNotes: string;
  filters: FilterState;
  games: ScoutGame[];
}

function bundleFromSaved(saved: any, fallbackName: string): ScoutBundle {
  const plays: Play[] = Array.isArray(saved?.plays) ? saved.plays : [];
  return {
    plays,
    datasetName: saved?.datasetName || fallbackName,
    offensiveScheme: saved?.offensiveScheme || '',
    coachNotes: saved?.coachNotes || '',
    filters: saved?.filters || DEFAULT_FILTERS,
    games: Array.isArray(saved?.games) && saved.games.length
      ? saved.games
      : plays.length
        ? [{ id: 'game-1', name: saved?.datasetName || fallbackName, playCount: plays.length, addedAt: saved?.updatedAt || Date.now() }]
        : [],
  };
}

export interface HudlScoutViewProps {
  scouting: ScoutingData;
  userRole?: UserRole;
  currentUser?: any;
  staffList?: StaffCoach[];
  savedCoaches?: string[];
  scheduleEvents?: ScheduleEvent[];
  currentWeek?: string;
  onUpdateScouting: (field: keyof ScoutingData | Record<string, unknown>, val?: any) => void;
  onNavigateToSchedule?: () => void;
  onNavigateToTendencies?: () => void;
  onNavigateToHtmlTendencies?: () => void;
}

export const HudlScoutView: React.FC<HudlScoutViewProps> = ({
  scouting,
  currentWeek = '1',
  onUpdateScouting,
}) => {
  const saved = scouting.hudlScout;
  const weekLabel = scouting.week || (String(currentWeek).startsWith('Week') ? String(currentWeek) : `Week ${currentWeek}`);
  const opponentFallback = scouting.opponent || 'This week opponent';

  const [scoutTarget, setScoutTarget] = useState<ScoutTarget>('opponent');
  const [oppBundle, setOppBundle] = useState<ScoutBundle>(() => bundleFromSaved(saved, opponentFallback));
  const [ownBundle, setOwnBundle] = useState<ScoutBundle>(() => bundleFromSaved(saved?.ownTeam, 'Mahopac'));
  const [currentDataset, setCurrentDataset] = useState<SampleDataset | null>(null);
  const [activeTab, setActiveTab] = useState<string>('situational');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);
  const skipSave = useRef(true);

  const bundle = scoutTarget === 'own' ? ownBundle : oppBundle;
  const setBundle = scoutTarget === 'own' ? setOwnBundle : setOppBundle;
  const plays = bundle.plays;
  const datasetName = bundle.datasetName;
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
    if (skipSave.current) {
      skipSave.current = false;
      if (!oppBundle.plays.length && !ownBundle.plays.length) return;
    }
    onUpdateScouting('hudlScout', {
      plays: oppBundle.plays,
      datasetName: oppBundle.datasetName,
      offensiveScheme: oppBundle.offensiveScheme,
      coachNotes: oppBundle.coachNotes,
      filters: oppBundle.filters,
      games: oppBundle.games,
      ownTeam: {
        plays: ownBundle.plays,
        datasetName: ownBundle.datasetName,
        offensiveScheme: ownBundle.offensiveScheme,
        coachNotes: ownBundle.coachNotes,
        filters: ownBundle.filters,
        games: ownBundle.games,
      },
      updatedAt: Date.now(),
    });
    if (oppBundle.datasetName && oppBundle.datasetName !== opponentFallback) {
      onUpdateScouting('opponent', oppBundle.datasetName);
    }
  }, [oppBundle, ownBundle]);

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
        };
      }
      return {
        ...prev,
        plays: tagged,
        datasetName: name,
        offensiveScheme: scheme,
        games: [game],
        filters: DEFAULT_FILTERS,
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
      (scoutTarget === 'own' ? 'Mahopac' : scouting.opponent || `Week ${currentWeek} opponent`);
    setCurrentDataset(null);
    applyPlays(newPlays, name, Boolean(append));
    if (scoutTarget === 'opponent') onUpdateScouting('opponent', name);
  };

  const emptyLabel = scoutTarget === 'own' ? 'our team' : weekLabel;

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <Header
        currentDataset={currentDataset}
        datasetName={`${datasetName} · ${weekLabel}`}
        totalPlays={plays.length}
        onOpenUpload={() => setIsUploadOpen(true)}
        onSelectSample={handleSelectSample}
        onOpenCallSheet={() => setIsCallSheetOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        scoutTarget={scoutTarget}
        onScoutTargetChange={setScoutTarget}
        games={bundle.games}
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

      <main className="flex-1 w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {plays.length === 0 && (
          <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-950/20 p-6 text-center">
            <p className="text-sm font-black text-emerald-200">
              {scoutTarget === 'own' ? 'Our-team scouting report' : `New scouting report for ${emptyLabel}`}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {scoutTarget === 'own'
                ? 'Upload one or more Hudl CSVs of Mahopac so the staff can see our own hash and run tendencies.'
                : 'Upload a Hudl CSV for this week’s opponent. Add more games to the same report.'}
            </p>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="mt-3 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-black"
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

        <OverviewCards analysis={analysis} />
        <HashWideSideBoard analysis={analysis} />
        <OpponentTellsBanner tells={analysis.tells} />

        {activeTab === 'situational' && <SituationalMatrix groups={analysis.situationalGroups} />}
        {activeTab === 'formations' && (
          <div className="space-y-6">
            <FormationAnalytics formations={analysis.formations} totalPlays={filteredPlays.length} />
            <PersonnelSpecialTeams plays={filteredPlays} analysis={analysis} />
          </div>
        )}
        {activeTab === 'field' && <FieldChalkboard analysis={analysis} />}
        {activeTab === 'plays' && <PlaysTable plays={filteredPlays} />}
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
