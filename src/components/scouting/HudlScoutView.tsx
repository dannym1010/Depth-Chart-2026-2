import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_DATASETS, SampleDataset } from '../../hudlScout/data/sampleDatasets';
import { ColumnMapping, autoDetectColumnMapping, normalizeHudlRow, parseCsvRows } from '../../hudlScout/utils/csvParser';
import { calculateTendencies } from '../../hudlScout/utils/tendencyEngine';
import { Play } from '../../hudlScout/types/football';
import { Header, ScoutGame, ScoutTarget, ScoutUnit } from '../../hudlScout/components/Header';
import { PlaysTable } from '../../hudlScout/components/PlaysTable';
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
  currentUser,
  scheduleEvents = [],
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

  const [scoutTarget, setScoutTarget] = useState<ScoutTarget>('opponent');
  const [selectedGameId, setSelectedGameId] = useState<string>('all');
  const [oppBundle, setOppBundle] = useState<ScoutBundle>(() => bundleFromSaved(saved, opponentFallback));
  const [ownBundle, setOwnBundle] = useState<ScoutBundle>(() =>
    bundleFromSaved(ownTeamScout || saved?.ownTeam, ownFallback)
  );
  const [currentDataset, setCurrentDataset] = useState<SampleDataset | null>(null);
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedSituation, setSelectedSituation] = useState<string | null>(null);
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

  const reportName = scoutTarget === 'own' ? ownFallback : scheduledOpponent || datasetName;

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
  // The game plan and call sheet are always built against the offense on film,
  // whatever unit or filters the coach is looking at.
  const planPlays = useMemo(() => {
    const offense = plays.filter((p) => p.odk === 'O');
    return offense.length ? offense : plays;
  }, [plays]);
  const planAnalysis = useMemo(() => calculateTendencies(planPlays), [planPlays]);
  const localReport = useMemo(
    () => (planPlays.length ? buildLocalGameplan(planAnalysis, planPlays, reportName) : null),
    [planAnalysis, planPlays, reportName]
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
      callSheet: oppBundle.callSheet,
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
        onScoutTargetChange={(target) => {
          setScoutTarget(target);
          setSelectedGameId('all');
          setSelectedSituation(null);
          if (target !== 'own' && activeTab === 'units') setActiveTab('summary');
        }}
        games={bundle.games}
        selectedGameId={selectedGameId}
        onSelectGame={setSelectedGameId}
        onRemoveGame={handleRemoveGame}
        onClearUploads={handleClearUploads}
        unit={filters.odk as ScoutUnit}
        onUnitChange={(odk) => setBundle((prev) => ({ ...prev, filters: { ...prev.filters, odk } }))}
        unitCounts={odkCounts}
        filterCount={filterLabels.length}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
      />

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
        {plays.length === 0 ? (
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

            {specialTeamsOnly ? (
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
                {activeTab === 'run' && <RunGameTab analysis={analysis} plays={filteredPlays} voice={voice} />}
              </>
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
              />
            )}
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
          </>
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
        analysis={planAnalysis}
        opponentName={reportName}
        edits={bundle.callSheet}
        onSaveEdits={(callSheet) => setBundle((prev) => ({ ...prev, callSheet, updatedAt: Date.now() }))}
        editorName={currentUser?.displayName || (currentUser?.email ? String(currentUser.email).split('@')[0] : '')}
      />
    </div>
  );
};
