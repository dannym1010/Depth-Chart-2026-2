import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DATASETS, SampleDataset } from '../../hudlScout/data/sampleDatasets';
import { ColumnMapping, autoDetectColumnMapping, normalizeHudlRow, parseCsvRows } from '../../hudlScout/utils/csvParser';
import { calculateTendencies } from '../../hudlScout/utils/tendencyEngine';
import { Play } from '../../hudlScout/types/football';
import { Header } from '../../hudlScout/components/Header';
import { FilterBar, FilterState } from '../../hudlScout/components/FilterBar';
import { OverviewCards } from '../../hudlScout/components/OverviewCards';
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

  const [plays, setPlays] = useState<Play[]>(() => saved?.plays || []);
  const [currentDataset, setCurrentDataset] = useState<SampleDataset | null>(null);
  const [datasetName, setDatasetName] = useState<string>(saved?.datasetName || opponentFallback);
  const [offensiveScheme, setOffensiveScheme] = useState(saved?.offensiveScheme || '');
  const [activeTab, setActiveTab] = useState<string>('situational');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(saved?.filters || DEFAULT_FILTERS);
  const [coachNotes, setCoachNotes] = useState(saved?.coachNotes || '');
  const skipSave = useRef(true);

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
      return;
    }
    onUpdateScouting('hudlScout', {
      plays,
      datasetName,
      offensiveScheme,
      coachNotes,
      filters,
      updatedAt: Date.now(),
    });
    if (datasetName && datasetName !== opponentFallback) {
      onUpdateScouting('opponent', datasetName);
    }
  }, [plays, datasetName, offensiveScheme, coachNotes, filters]);

  const handleResetFilters = (resetOdk = false) => {
    setFilters((prev) => ({
      odk: resetOdk ? 'O' : prev.odk,
      quarter: 'ALL',
      down: 'ALL',
      fieldZone: 'ALL',
      hash: 'ALL',
      playType: 'ALL',
      formation: 'ALL',
    }));
  };

  const handleSelectSample = (sample: SampleDataset) => {
    const { headers, rows } = parseCsvRows(sample.csvContent);
    const mapping = autoDetectColumnMapping(headers);
    const newPlays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    setPlays(newPlays);
    setCurrentDataset(sample);
    setDatasetName(sample.name);
    setOffensiveScheme(sample.offensiveScheme || '');
    setFilters(DEFAULT_FILTERS);
  };

  const handleLoadCsv = (csvContent: string, opponent: string, customMapping?: ColumnMapping) => {
    const { headers, rows } = parseCsvRows(csvContent);
    const mapping = customMapping || autoDetectColumnMapping(headers);
    const newPlays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    const name = opponent || scouting.opponent || `Week ${currentWeek} opponent`;
    setPlays(newPlays);
    setCurrentDataset(null);
    setDatasetName(name);
    setOffensiveScheme('');
    setFilters(DEFAULT_FILTERS);
    onUpdateScouting('opponent', name);
  };

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
      />

      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
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
            <p className="text-sm font-black text-emerald-200">New scouting report for {weekLabel}</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload a Hudl CSV for this week’s opponent. Each week starts a fresh report.
            </p>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="mt-3 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-black"
            >
              Upload Hudl CSV
            </button>
            {SAMPLE_DATASETS[0] && (
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
            onCoachNotesChange={setCoachNotes}
          />
        )}
      </main>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onLoadCsv={handleLoadCsv}
        onSelectSample={handleSelectSample}
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
