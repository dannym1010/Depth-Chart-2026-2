import React, { useState, useMemo } from 'react';
import {
  Swords,
  FileSpreadsheet,
  Watch,
  BarChart3,
  Printer,
  Calendar,
  Sparkles,
  Shield,
  Layers,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Eye,
  Clock,
  ExternalLink,
  Target,
  ClipboardList,
  Plus,
  ArrowRight,
  Edit2,
  MapPin,
  Shirt,
  AlertCircle,
  Play,
  Check,
  FileCode,
  TrendingUp,
} from 'lucide-react';
import { CallSheetMainView } from './CallSheetMainView';
import { WristbandView } from './WristbandView';
import { ScoutingView } from './ScoutingView';
import { TendenciesView } from './scouting/TendenciesView';
import { GameDayPackagePrintModal } from './gameDay/GameDayPackagePrintModal';
import {
  CallSheetData,
  PlayDatabaseEntry,
} from '../types/callSheet';
import {
  WristbandData,
  ScoutingData,
  UserRole,
  StaffCoach,
  RosterPlayer,
  ScheduleEvent,
  PracticePlan,
} from '../types';
import { DEFAULT_PRACTICE_TEMPLATES } from '../data/initialData';
import { triggerPrint } from '../utils/printUtils';

interface GameDayHubViewProps {
  userRole: UserRole;
  activeTeamName: string;
  opponent: string;
  onUpdateOpponent?: (opponent: string) => void;
  currentWeek: string;
  gameDate?: string;
  playDatabase: PlayDatabaseEntry[];
  onUpdatePlayDatabase: (plays: PlayDatabaseEntry[]) => void;
  callSheetData: CallSheetData;
  onUpdateCallSheetData: (data: CallSheetData) => void;
  deletedPlayIds: string[];
  onUpdateDeletedPlayIds: (ids: string[]) => void;
  wristbandData?: WristbandData;
  onUpdateWristbandData?: (data: WristbandData) => void;
  scouting?: ScoutingData;
  onUpdateScouting: (field: keyof ScoutingData, val: any) => void;
  staffList?: StaffCoach[];
  savedCoaches?: string[];
  scheduleEvents?: ScheduleEvent[];
  activeTeamRoster?: RosterPlayer[];
  currentUser?: any;
  onNavigateToSchedule?: () => void;
  practicePlans?: PracticePlan[];
  onSyncPracticeToPlan?: (event: ScheduleEvent, templateName?: string) => string;
  onNavigateToPractice?: (practiceId?: string) => void;
  onUpdateScheduleEvent?: (eventId: string, updates: Partial<ScheduleEvent>) => void;
}

export type GameDayTab = 'command' | 'pregame' | 'call_sheet' | 'wristband' | 'scouting' | 'tendencies' | 'html_tendencies';

export const GameDayHubView: React.FC<GameDayHubViewProps> = ({
  userRole,
  activeTeamName,
  opponent,
  onUpdateOpponent,
  currentWeek,
  gameDate,
  playDatabase,
  onUpdatePlayDatabase,
  callSheetData,
  onUpdateCallSheetData,
  deletedPlayIds,
  onUpdateDeletedPlayIds,
  wristbandData,
  onUpdateWristbandData,
  scouting = {},
  onUpdateScouting,
  staffList = [],
  savedCoaches = [],
  scheduleEvents = [],
  currentUser,
  onNavigateToSchedule,
  practicePlans = [],
  onSyncPracticeToPlan,
  onNavigateToPractice,
  onUpdateScheduleEvent,
}) => {
  const [activeTab, setActiveTab] = useState<GameDayTab>('command');
  const [isQuickOpponentEditing, setIsQuickOpponentEditing] = useState(false);
  const [tempOpponent, setTempOpponent] = useState(opponent || '');
  const [selectedTemplate, setSelectedTemplate] = useState('Pre-Game Warmup & Routine');
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);

  // Match scheduled game for current week
  const matchedScheduledGame = useMemo(() => {
    return (
      scheduleEvents.find(
        (ev) =>
          (ev.type === 'game' || ev.type === 'tournament' || ev.type === 'scrimmage') &&
          (String(ev.week) === String(currentWeek) || ev.week === currentWeek)
      ) ||
      scheduleEvents.find((ev) => ev.type === 'game' || ev.type === 'tournament')
    );
  }, [scheduleEvents, currentWeek]);

  // Find linked pre-game plan
  const linkedPreGamePlan = useMemo(() => {
    if (!matchedScheduledGame) return null;
    return (
      practicePlans.find(
        (p) =>
          p.id === matchedScheduledGame.linkedPracticePlanId ||
          p.id === matchedScheduledGame.preGamePlanId
      ) ||
      practicePlans.find(
        (p) =>
          (p.weekFolder === `Week ${matchedScheduledGame.week}` ||
            p.weekFolder === matchedScheduledGame.week) &&
          (p.title?.toLowerCase().includes('pre-game') ||
            p.title?.toLowerCase().includes('warmup') ||
            p.title?.toLowerCase().includes('walkthrough'))
      ) ||
      null
    );
  }, [matchedScheduledGame, practicePlans]);

  // Derived counts
  const totalWristbands = wristbandData?.wristbands?.length || 2;
  const totalCallSheetPlays =
    (callSheetData?.offenseSections?.reduce((acc, s) => acc + (s.plays?.filter(Boolean).length || 0), 0) || 0) +
    (callSheetData?.defenseSections?.reduce((acc, s) => acc + (s.plays?.filter(Boolean).length || 0), 0) || 0);
  const tendenciesCount = useMemo(() => {
    let count = 0;
    if (scouting?.tendenciesTree) {
      Object.values(scouting.tendenciesTree).forEach((subs) => {
        Object.values(subs || {}).forEach((val) => {
          if (val && val.trim()) count++;
        });
      });
    }
    if (count === 0 && scouting?.attachments) {
      count = scouting.attachments.length;
    }
    return count;
  }, [scouting?.tendenciesTree, scouting?.attachments]);

  const [isPackagePrintModalOpen, setIsPackagePrintModalOpen] = useState(false);

  const handlePrintAll = () => {
    setIsPackagePrintModalOpen(true);
  };

  const handlePrintPreGamePlan = () => {
    triggerPrint({
      targetElementSelector: '#pre-game-plan-printable',
      documentTitle: `PreGame_Plan_Week_${currentWeek}_${matchedScheduledGame?.opponent || 'Opponent'}`,
    });
  };

  const handleCreatePreGamePlan = () => {
    if (!matchedScheduledGame) {
      if (onSyncPracticeToPlan) {
        const dummyEvt: ScheduleEvent = {
          id: `evt_game_${currentWeek}_${Date.now()}`,
          type: 'game',
          title: opponent ? `Game vs ${opponent}` : `Week ${currentWeek} Game`,
          week: currentWeek,
          date: gameDate || new Date().toISOString().slice(0, 10),
          startTime: '10:00',
          endTime: '12:00',
          opponent: opponent || 'TBD',
          location: 'Home Field',
          locationType: 'home',
          createdAt: Date.now(),
          lastEdited: Date.now(),
        };
        const newPlanId = onSyncPracticeToPlan(dummyEvt, selectedTemplate);
        setCreateFeedback(`Pre-Game Practice Plan created with ${selectedTemplate}!`);
        setTimeout(() => setCreateFeedback(null), 4000);
        if (onNavigateToPractice) {
          onNavigateToPractice(newPlanId);
        }
      }
      return;
    }

    if (onSyncPracticeToPlan) {
      const newPlanId = onSyncPracticeToPlan(matchedScheduledGame, selectedTemplate);
      if (onUpdateScheduleEvent) {
        onUpdateScheduleEvent(matchedScheduledGame.id, {
          linkedPracticePlanId: newPlanId,
          preGamePlanId: newPlanId,
        });
      }
      setCreateFeedback(`Pre-Game Practice Plan created & attached for ${matchedScheduledGame.title || 'Game'}!`);
      setTimeout(() => setCreateFeedback(null), 4000);
    }
  };

  const handleLinkExistingPlan = (planId: string) => {
    if (matchedScheduledGame && onUpdateScheduleEvent) {
      onUpdateScheduleEvent(matchedScheduledGame.id, {
        linkedPracticePlanId: planId,
        preGamePlanId: planId,
      });
      setIsLinkingModalOpen(false);
      setCreateFeedback('Practice plan successfully linked to this game!');
      setTimeout(() => setCreateFeedback(null), 3000);
    }
  };

  return (
    <div id="game-day-hub-content" className="space-y-6">
      {/* Top Game Day Matchup Banner */}
      <div className="gameday-matchup-banner bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-xl relative overflow-hidden print:bg-white print:bg-none print:border-b print:border-slate-300 print:border-t-0 print:border-l-0 print:border-r-0 print:rounded-none print:p-1.5 print:pb-2 print:my-0 print:mb-2 print:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:gap-1">
          <div className="space-y-1 print:space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 print:gap-1.5">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 print:hidden">
                <Swords className="w-4 h-4" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 print:bg-slate-100 print:text-slate-800 print:border-slate-300 print:text-[10px] print:px-1.5 print:py-0 print:rounded">
                Game Day Command Center &bull; Week {currentWeek}
              </span>
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 print:bg-slate-100 print:text-slate-800 print:border-slate-300 print:text-[10px] print:px-1.5 print:py-0 print:rounded">
                {activeTeamName}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-0.5 print:pt-0">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 print:text-base print:font-black print:text-slate-900 print:gap-1.5">
                <span className="text-amber-400 print:text-slate-700">VS.</span>
                {isQuickOpponentEditing ? (
                  <div className="flex items-center gap-2 print:hidden">
                    <input
                      type="text"
                      value={tempOpponent}
                      onChange={(e) => setTempOpponent(e.target.value)}
                      placeholder="Opponent Team Name..."
                      className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-white text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (onUpdateOpponent) onUpdateOpponent(tempOpponent);
                        setIsQuickOpponentEditing(false);
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => {
                      if (userRole === 'admin') {
                        setTempOpponent(opponent || '');
                        setIsQuickOpponentEditing(true);
                      }
                    }}
                    className={`cursor-pointer hover:text-amber-300 transition-colors border-b border-dashed border-slate-500 print:border-none print:text-slate-950 ${
                      opponent ? 'text-white print:text-slate-950' : 'text-slate-500 italic'
                    }`}
                    title={userRole === 'admin' ? 'Click to edit opponent' : undefined}
                  >
                    {opponent || 'Set Opponent Name'}
                  </span>
                )}
              </h1>
            </div>

            <p className="text-xs text-slate-400 print:hidden">
              Unified Sideline HUD &bull; Pre-Game Practice Plan ({linkedPreGamePlan ? `${linkedPreGamePlan.plan?.length || 0} Periods` : 'Not Created'}) &bull; Call Sheet ({totalCallSheetPlays} plays) &bull; Wristbands ({totalWristbands} active inserts) &bull; Scouting Report &bull; Play Bank ({playDatabase.length} plays)
            </p>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrintAll}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Game Day Package</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('command')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'command'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-300" />
            <span>⚡ Sideline HUD</span>
          </button>

          {/* Pre-Game Practice Plan Sub-Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('pregame')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'pregame'
                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-purple-300" />
            <span>📋 Pre-Game Practice Plan</span>
            {linkedPreGamePlan ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                Ready ({linkedPreGamePlan.plan?.length || 0}P)
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                + Create
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('call_sheet')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'call_sheet'
                ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-red-300" />
            <span>🏈 Call Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wristband')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'wristband'
                ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-600/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <Watch className="w-4 h-4 text-amber-300" />
            <span>⌚ Wristbands ({totalWristbands})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scouting')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'scouting'
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-300" />
            <span>📊 Scouting Report</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tendencies')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
              activeTab === 'tendencies' || activeTab === 'html_tendencies'
                ? 'bg-amber-400 text-slate-950 font-black border-amber-400 shadow-lg shadow-amber-500/30'
                : 'bg-slate-800/80 text-amber-300/90 border-slate-700 hover:bg-slate-750 hover:text-amber-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-400 group-hover:text-amber-300" />
            <span>📈 Tendencies</span>
            {tendenciesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                {tendenciesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'command' && (
        <div className="space-y-6">
          {/* Quick Summary Bento Grid (4 Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Dedicated Pre-Game Routine Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                  <ClipboardList className="w-4 h-4 text-purple-400" />
                  Pre-Game Practice Plan
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('pregame')}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1"
                >
                  {linkedPreGamePlan ? 'View' : 'Create'} <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {linkedPreGamePlan ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30">
                    <span className="text-xs font-black text-purple-200 block truncate">
                      {linkedPreGamePlan.title || 'Pre-Game Warmup & Routine'}
                    </span>
                    <span className="text-[11px] text-slate-300 block mt-1">
                      {linkedPreGamePlan.plan?.length || 0} Periods &bull;{' '}
                      {linkedPreGamePlan.plan?.reduce((sum, p) => sum + (p.time || 0), 0) || 60} mins total
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('pregame')}
                      className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors text-center"
                    >
                      Open Routine
                    </button>
                    {onNavigateToPractice && (
                      <button
                        type="button"
                        onClick={() => onNavigateToPractice(linkedPreGamePlan.id)}
                        className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-lg text-xs font-bold border border-purple-500/30 transition-colors"
                        title="Open in Practice Generator"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-800/60 border border-dashed border-slate-700 text-center space-y-2">
                  <p className="text-[11px] text-slate-400">
                    No pre-game warmup routine attached for this game yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pregame')}
                    className="w-full py-1.5 px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Pre-Game Plan</span>
                  </button>
                </div>
              )}
            </div>

            {/* Card 2: Call Sheet Quick Situations */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                  <FileSpreadsheet className="w-4 h-4 text-red-400" />
                  Primary Situations (Call Sheet)
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('call_sheet')}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1"
                >
                  Open <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(callSheetData?.offenseSections || []).slice(0, 3).map((sec) => (
                  <div key={sec.id} className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                    <div className="text-[11px] font-bold text-amber-300 uppercase mb-1">
                      {sec.title} ({sec.plays?.filter(Boolean).length || 0} plays)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(sec.plays || []).filter(Boolean).slice(0, 4).map((p: any) => (
                        <span
                          key={p.id}
                          className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-750"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Active Wristbands Quick Reference */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                  <Watch className="w-4 h-4 text-amber-400" />
                  Wristband Inserts ({wristbandData?.wristbands?.length || 2})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('wristband')}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1"
                >
                  Open <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2">
                {(wristbandData?.wristbands || []).slice(0, 2).map((wb, idx) => (
                  <div key={wb.id} className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-white uppercase block">
                        {wb.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {wb.columns?.[0]?.plays?.length || 13} rows &bull; Same labeling (1-26)
                      </span>
                    </div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                      Insert #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 4: Opponent Scouting Keys */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Scouting & Tendencies
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('scouting')}
                  className="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold flex items-center gap-1"
                >
                  Open <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Base Defensive Front:</span>
                  <span className="text-white font-bold">{scouting.defensiveFronts || scouting.defenseFront || '4-3 Over / Cover 3'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Primary Coverage:</span>
                  <span className="text-white font-bold">{scouting.defenseCoverage || 'Cover 2 / Man Under'}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Keys to Victory:</span>
                  <span className="text-slate-300 text-[11px]">
                    {Array.isArray(scouting.keysToVictory)
                      ? scouting.keysToVictory.join(', ')
                      : scouting.keysToVictory || 'Control line of scrimmage, establish 21/32 series dive and zone runs.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Embedded Full Wristband Quick Access */}
          <div className="space-y-2">
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Watch className="w-4 h-4 text-amber-400" />
              Active Game Day Wristbands (4.5&quot; &times; 2.25&quot;)
            </h2>
            <WristbandView
              wristbandData={wristbandData}
              userRole={userRole}
              activeTeamName={activeTeamName}
              playDatabase={playDatabase}
              callSheetData={callSheetData}
              onUpdateCallSheetData={onUpdateCallSheetData}
              onUpdatePlayDatabase={onUpdatePlayDatabase}
              onUpdateWristbandData={onUpdateWristbandData}
            />
          </div>
        </div>
      )}

      {/* DEDICATED PRE-GAME PRACTICE PLAN TAB */}
      {activeTab === 'pregame' && (
        <div className="space-y-6">
          {createFeedback && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{createFeedback}</span>
            </div>
          )}

          {/* Matchup & Schedule Overview Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-black uppercase">
                  Week {currentWeek} Game
                </span>
                {matchedScheduledGame && (
                  <span className="text-xs text-slate-400 font-medium">
                    {matchedScheduledGame.locationType === 'home' ? '🏠 Home Game' : '✈️ Away Game'}
                  </span>
                )}
              </div>
              <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                <span>{matchedScheduledGame?.title || `Game vs ${opponent || 'Opponent'}`}</span>
                {matchedScheduledGame?.opponent && (
                  <span className="text-amber-400 text-sm font-bold">(@ {matchedScheduledGame.opponent})</span>
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 pt-1">
                {matchedScheduledGame?.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>{matchedScheduledGame.date}</span>
                  </span>
                )}
                {matchedScheduledGame?.startTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Kickoff: {matchedScheduledGame.startTime}</span>
                    {matchedScheduledGame.arrivalMinutesBefore && (
                      <span className="text-amber-300 font-semibold">
                        (Warmup Arrival: {matchedScheduledGame.arrivalMinutesBefore}m before)
                      </span>
                    )}
                  </span>
                )}
                {matchedScheduledGame?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-xs">{matchedScheduledGame.location}</span>
                  </span>
                )}
                {matchedScheduledGame?.uniform && (
                  <span className="flex items-center gap-1 text-amber-300">
                    <Shirt className="w-3.5 h-3.5" />
                    <span>Uniform: {matchedScheduledGame.uniform}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {linkedPreGamePlan ? (
                <>
                  {onNavigateToPractice && (
                    <button
                      type="button"
                      onClick={() => onNavigateToPractice(linkedPreGamePlan.id)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Open in Practice Generator</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePrintPreGamePlan}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-purple-400" />
                    <span>Print Routine</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLinkingModalOpen(true)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
                  >
                    Change Link...
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLinkingModalOpen(true)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
                >
                  Link Existing Plan...
                </button>
              )}
            </div>
          </div>

          {/* Pre-Game Practice Plan Content */}
          {linkedPreGamePlan ? (
            <div id="pre-game-plan-printable" className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>{linkedPreGamePlan.title || 'Pre-Game Warmup & Routine'}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Structured game day timeline with {linkedPreGamePlan.plan?.length || 0} periods &bull;{' '}
                      {linkedPreGamePlan.plan?.reduce((acc, p) => acc + (p.time || 0), 0) || 60} Total Minutes
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-black flex items-center gap-1.5 self-start sm:self-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Plan Active on Sideline HUD</span>
                  </span>
                </div>

                {/* Periods & Stations Timeline Breakdown */}
                <div className="space-y-3">
                  {(linkedPreGamePlan.plan || []).map((period, pIdx) => {
                    const durationMins = period.time || 15;
                    return (
                      <div
                        key={pIdx}
                        className="bg-slate-850/80 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-purple-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-black flex items-center justify-center">
                              {pIdx + 1}
                            </span>
                            <span className="text-xs font-extrabold text-white">
                              {period.category || `Period ${pIdx + 1}`}
                            </span>
                            {period.format && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                                {period.format}
                              </span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-xs font-bold">
                            {durationMins} min
                          </span>
                        </div>

                        {/* Stations / Drills */}
                        {period.stations && period.stations.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/80">
                            {period.stations.map((station, sIdx) => (
                              <div
                                key={sIdx}
                                className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-black text-amber-300">
                                    {station.name || `Station ${sIdx + 1}`}
                                  </span>
                                  {station.coach && (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      Coach: <strong className="text-slate-200">{station.coach}</strong>
                                    </span>
                                  )}
                                </div>
                                {station.desc && (
                                  <p className="text-[11px] text-slate-300 leading-snug">
                                    {station.desc}
                                  </p>
                                )}
                                {station.focus && (
                                  <p className="text-[10.5px] text-indigo-300/90 font-medium italic">
                                    Focus: {station.focus}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* CREATE PRE-GAME PRACTICE PLAN BUILDER CARD */
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 text-center max-w-3xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/10">
                <ClipboardList className="w-7 h-7" />
              </div>

              <div className="space-y-1.5 max-w-lg mx-auto">
                <h3 className="text-xl font-black text-white tracking-tight">
                  Create Pre-Game Practice Plan for Week {currentWeek}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generate a structured game day warmup routine with dynamic activation, position stations, and kickoff walkthroughs — just like practice plans on the schedule!
                </p>
              </div>

              <div className="bg-slate-850/90 border border-slate-700/80 rounded-2xl p-4 md:p-5 text-left max-w-md mx-auto space-y-3.5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                    Pre-Game Routine Template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="Pre-Game Warmup & Routine">
                      ⚡ Pre-Game Warmup &amp; Routine (Dynamic, Indy &amp; Special Teams)
                    </option>
                    <option value="Standard Practice">
                      🏈 Standard Full Practice
                    </option>
                    <option value="Walkthrough / Light">
                      🚶 Walkthrough &amp; Light Install
                    </option>
                  </select>
                </div>

                <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl text-xs text-purple-200/90 space-y-1">
                  <span className="font-bold block text-purple-300">
                    Includes 5 Pre-Game Stations (60 min total):
                  </span>
                  <ul className="text-[11px] list-disc list-inside text-slate-300 space-y-0.5">
                    <li>Dynamic Warmup &amp; Activation (15 min)</li>
                    <li>QB/WR Passing Tree &amp; OL/RB Mesh (15 min)</li>
                    <li>Defensive Pursuit &amp; Tackle Fit Circuit (15 min)</li>
                    <li>Special Teams Kickoff/Punt Walkthrough (10 min)</li>
                    <li>Captains Coin Toss &amp; Sideline Huddle (5 min)</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleCreatePreGamePlan}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Create Pre-Game Practice Plan</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkingModalOpen(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline transition-colors"
                >
                  Or link an existing practice plan from your generator library
                </button>
              </div>
            </div>
          )}

          {/* Linking Modal */}
          {isLinkingModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="font-black text-white text-sm flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-purple-400" />
                    <span>Link Practice Plan to Week {currentWeek} Game</span>
                  </h4>
                  <button
                    onClick={() => setIsLinkingModalOpen(false)}
                    className="text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  Select any existing practice plan from your team&apos;s library to attach as the official pre-game warmup routine.
                </p>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {practicePlans.length === 0 ? (
                    <div className="text-center p-4 text-xs text-slate-500">
                      No practice plans found. Use &quot;Create Pre-Game Practice Plan&quot; to generate one!
                    </div>
                  ) : (
                    practicePlans.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => handleLinkExistingPlan(plan.id)}
                        className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-purple-900/40 border border-slate-700/80 hover:border-purple-500/50 flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-white block truncate">
                            {plan.title || 'Untitled Practice Plan'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {plan.weekFolder || 'Week'} &bull; {plan.plan?.length || 0} Periods &bull; {plan.date || 'No date'}
                          </span>
                        </div>
                        <span className="text-xs font-black text-purple-400 hover:text-purple-300">
                          Select &rarr;
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsLinkingModalOpen(false)}
                    className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Embedded Call Sheet Tab */}
      {activeTab === 'call_sheet' && (
        <CallSheetMainView
          activeTeamName={activeTeamName}
          playDatabase={playDatabase}
          onUpdatePlayDatabase={onUpdatePlayDatabase}
          callSheetData={callSheetData}
          onUpdateCallSheetData={onUpdateCallSheetData}
          deletedPlayIds={deletedPlayIds}
          onUpdateDeletedPlayIds={onUpdateDeletedPlayIds}
          wristbandData={wristbandData}
        />
      )}

      {/* Embedded Wristbands Tab */}
      {activeTab === 'wristband' && (
        <WristbandView
          wristbandData={wristbandData}
          userRole={userRole}
          activeTeamName={activeTeamName}
          playDatabase={playDatabase}
          callSheetData={callSheetData}
          onUpdateCallSheetData={onUpdateCallSheetData}
          onUpdatePlayDatabase={onUpdatePlayDatabase}
          onUpdateWristbandData={onUpdateWristbandData}
        />
      )}

      {/* Embedded Scouting Tab */}
      {activeTab === 'scouting' && (
        <ScoutingView
          scouting={scouting}
          userRole={userRole}
          currentUser={currentUser}
          staffList={staffList}
          savedCoaches={savedCoaches}
          scheduleEvents={scheduleEvents}
          currentWeek={currentWeek}
          onUpdateScouting={onUpdateScouting}
          onNavigateToSchedule={onNavigateToSchedule}
          onNavigateToHtmlTendencies={() => setActiveTab('tendencies')}
          onNavigateToTendencies={() => setActiveTab('tendencies')}
        />
      )}

      {/* Embedded Tendencies Tab */}
      {(activeTab === 'tendencies' || activeTab === 'html_tendencies') && (
        <TendenciesView
          scouting={scouting}
          onUpdateScouting={onUpdateScouting}
          opponentName={opponent || scouting.opponent || 'Opponent'}
          weekName={currentWeek.startsWith('Week') ? currentWeek : `Week ${currentWeek}`}
          userRole={userRole}
          onNavigateToScouting={() => setActiveTab('scouting')}
        />
      )}

      {/* Game Day Package Print Modal */}
      <GameDayPackagePrintModal
        isOpen={isPackagePrintModalOpen}
        onClose={() => setIsPackagePrintModalOpen(false)}
        data={{
          activeTeamName,
          opponent: opponent || scouting.opponent || matchedScheduledGame?.opponent || 'Opponent',
          currentWeek,
          gameDate: gameDate || matchedScheduledGame?.date,
          callSheetData,
          wristbandData,
          scouting,
          linkedPreGamePlan,
          matchedScheduledGame,
          staffList,
        }}
      />
    </div>
  );
};
