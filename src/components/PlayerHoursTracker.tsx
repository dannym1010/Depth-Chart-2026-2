import React, { useState, useMemo } from 'react';
import {
  Shield,
  Zap,
  Swords,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserPlus,
  Edit3,
  Trash2,
  RotateCcw,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Plus,
  Minus,
  Sparkles,
  Info,
  Check,
  X,
  Users,
  Settings,
  ClipboardCheck,
  History,
  FileCheck,
} from 'lucide-react';
import {
  RosterPlayer,
  UserRole,
  ScheduleEvent,
  SeasonConfig,
  AttendanceRecord,
  formatWeekLabel,
  calculatePlayerCompliance,
  CONDITIONING_HOURS_REQUIRED,
  PADDED_HOURS_REQUIRED,
} from '../types';
import { getSeasonWeekList } from '../utils/seasonWeekUtils';
import { triggerPrint, printPracticeHourReport } from '../utils/printUtils';
import { calculatePlayerHours, syncEntireRosterWithLogs } from '../utils/hoursCalculation';
import { PlayerHoursBreakdownModal } from './PlayerHoursBreakdownModal';
import { DEFAULT_SEASON_CONFIG } from '../data/initialData';
import { SeasonConfigModal } from './SeasonConfigModal';
import { WeeklyAttendanceTracker } from './WeeklyAttendanceTracker';

interface PlayerHoursTrackerProps {
  roster: RosterPlayer[];
  userRole: UserRole;
  currentWeek: string;
  scheduleEvents?: ScheduleEvent[];
  seasonConfig?: SeasonConfig;
  attendanceLogs?: AttendanceRecord[];
  initialOpenTakeAttendance?: boolean;
  onClearInitialOpenTakeAttendance?: () => void;
  onUpdatePlayer: (updatedPlayer: RosterPlayer) => void;
  onUpdateRoster: (updatedRoster: RosterPlayer[]) => void;
  onOpenAddPlayerModal: () => void;
  onOpenEditPlayerModal: (player: RosterPlayer) => void;
  onOpenRosterManager: () => void;
  onUpdateSeasonConfig?: (config: SeasonConfig) => void;
  onUpdateAttendanceLogs?: (logs: AttendanceRecord[]) => void;
  onAddScheduleEvent?: (event: ScheduleEvent) => void;
  onUpdateScheduleEvent?: (event: ScheduleEvent) => void;
  onDeleteScheduleEvent?: (id: string) => void;
}

export const PlayerHoursTracker: React.FC<PlayerHoursTrackerProps> = ({
  roster,
  userRole,
  currentWeek,
  scheduleEvents = [],
  seasonConfig,
  attendanceLogs = [],
  initialOpenTakeAttendance = false,
  onClearInitialOpenTakeAttendance,
  onUpdatePlayer,
  onUpdateRoster,
  onOpenAddPlayerModal,
  onOpenEditPlayerModal,
  onOpenRosterManager,
  onUpdateSeasonConfig,
  onUpdateAttendanceLogs,
  onAddScheduleEvent,
  onUpdateScheduleEvent,
  onDeleteScheduleEvent,
}) => {
  const [activeTab, setActiveTab] = useState<'weekly_matrix' | 'roster_hours' | 'attendance_log'>('weekly_matrix');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_scrimmage' | 'needs_conditioning' | 'needs_pads' | 'fully_cleared'>('all');
  const initialLogWeek = (currentWeek && currentWeek !== '0') ? currentWeek : 'pre-1';
  const [selectedWeekForLog, setSelectedWeekForLog] = useState<string>(initialLogWeek);
  const [showLogAttendanceModal, setShowLogAttendanceModal] = useState(false);
  const [showSeasonConfigModal, setShowSeasonConfigModal] = useState(false);
  const [breakdownPlayer, setBreakdownPlayer] = useState<RosterPlayer | null>(null);
  const [breakdownScope, setBreakdownScope] = useState<'season' | 'preseason' | 'this_week'>('season');

  // Form state for Quick Attendance Logger
  const [logSessionType, setLogSessionType] = useState<'conditioning' | 'padded'>('conditioning');
  const [logSessionHours, setLogSessionHours] = useState<number>(1.5);
  const [logSessionDate, setLogSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [logSessionTitle, setLogSessionTitle] = useState<string>('Preseason Practice');
  const [logSessionLocation, setLogSessionLocation] = useState<string>('Crane Road');
  const [logSessionNotes, setLogSessionNotes] = useState<string>('');
  const [selectedScheduleEventId, setSelectedScheduleEventId] = useState<string>('');
  const [showPracticeDetails, setShowPracticeDetails] = useState(false);
  const [rollCallSearchTerm, setRollCallSearchTerm] = useState('');

  const [playerAttendanceStatus, setPlayerAttendanceStatus] = useState<
    Record<string, 'present' | 'absent' | 'excused'>
  >(() => {
    const init: Record<string, 'present' | 'absent' | 'excused'> = {};
    roster.forEach((p) => {
      init[p.num] = 'present';
    });
    return init;
  });

  // Preseason Configuration form state
  const [editPreseasonCount, setEditPreseasonCount] = useState<number>(
    seasonConfig?.preseasonWeeksCount ?? 4
  );

  // When opening attendance modal, reset attendance state
  const handleOpenAttendanceModal = () => {
    const init: Record<string, 'present' | 'absent' | 'excused'> = {};
    roster.forEach((p) => {
      init[p.num] = 'present';
    });
    setPlayerAttendanceStatus(init);
    setRollCallSearchTerm('');
    setShowPracticeDetails(false);
    setShowLogAttendanceModal(true);
  };

  // Sync scheduled practice selection into modal
  const handleSelectScheduleEvent = (eventId: string) => {
    setSelectedScheduleEventId(eventId);
    const evt = scheduleEvents.find((e) => e.id === eventId);
    if (evt) {
      setLogSessionTitle(evt.title);
      setLogSessionDate(evt.date);
      setLogSessionLocation(evt.location || 'Crane Road');
      setSelectedWeekForLog(evt.week || 'pre-1');
      // If event title has "Conditioning", set to conditioning, else if padded
      if (evt.title.toLowerCase().includes('cond') || evt.week === 'pre-1') {
        setLogSessionType('conditioning');
      } else {
        setLogSessionType('padded');
      }
    }
  };

  // Automatically open Take Practice Attendance modal if initiated from quick link
  React.useEffect(() => {
    if (initialOpenTakeAttendance) {
      handleOpenAttendanceModal();
      const todayStr = new Date().toISOString().split('T')[0];
      const matchingEvt = (scheduleEvents || []).find(
        (e) =>
          (e.date === todayStr || new Date(e.date).getTime() >= new Date().setHours(0, 0, 0, 0)) &&
          (e.type === 'practice' || e.type === 'walkthrough' || e.type === 'scrimmage') &&
          !e.isCancelled
      );
      if (matchingEvt) {
        handleSelectScheduleEvent(matchingEvt.id);
      }
      if (onClearInitialOpenTakeAttendance) {
        onClearInitialOpenTakeAttendance();
      }
    }
  }, [initialOpenTakeAttendance]);

  // Calculate high-level compliance metrics
  const complianceStats = useMemo(() => {
    let fullyClearedCount = 0;
    let padsClearedCount = 0;
    let conditioningOnlyCount = 0;
    let totalConditioningHoursLogged = 0;
    let totalPaddedHoursLogged = 0;

    roster.forEach((player) => {
      const status = calculatePlayerCompliance(player);
      totalConditioningHoursLogged += status.conditioningHours;
      totalPaddedHoursLogged += status.paddedHours;

      if (status.isScrimmageCleared) {
        fullyClearedCount++;
      } else if (status.isPadsCleared) {
        padsClearedCount++;
      } else {
        conditioningOnlyCount++;
      }
    });

    const totalPlayers = roster.length || 1;
    const fullyClearedPct = Math.round((fullyClearedCount / totalPlayers) * 100);
    const needsScrimmageCount = roster.length - fullyClearedCount;

    return {
      totalPlayers: roster.length,
      fullyClearedCount,
      needsScrimmageCount,
      padsClearedCount,
      conditioningOnlyCount,
      fullyClearedPct,
      totalConditioningHoursLogged: totalConditioningHoursLogged.toFixed(1),
      totalPaddedHoursLogged: totalPaddedHoursLogged.toFixed(1),
      totalHours: (totalConditioningHoursLogged + totalPaddedHoursLogged).toFixed(1),
      totalSessionsCount: attendanceLogs.length,
    };
  }, [roster, attendanceLogs]);

  // Filtered Players
  const filteredRoster = useMemo(() => {
    return roster.filter((player) => {
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesName = `${player.firstName} ${player.lastName}`.toLowerCase().includes(term);
        const matchesNum = player.num.includes(term);
        const matchesPos = (player.primaryPosition || '').toLowerCase().includes(term) || (player.secondaryPosition || '').toLowerCase().includes(term);
        if (!matchesName && !matchesNum && !matchesPos) return false;
      }

      const status = calculatePlayerCompliance(player);
      if (statusFilter === 'needs_scrimmage' && status.isScrimmageCleared) return false;
      if (statusFilter === 'needs_conditioning' && status.isConditioningCleared) return false;
      if (statusFilter === 'needs_pads' && (!status.isConditioningCleared || status.isScrimmageCleared)) return false;
      if (statusFilter === 'fully_cleared' && !status.isScrimmageCleared) return false;

      return true;
    });
  }, [roster, searchTerm, statusFilter]);

  // Filtered players for Roll Call modal
  const filteredRollCallRoster = useMemo(() => {
    if (!rollCallSearchTerm.trim()) return roster;
    const term = rollCallSearchTerm.toLowerCase().trim();
    return roster.filter((player) => {
      const matchesName = `${player.firstName} ${player.lastName}`.toLowerCase().includes(term);
      const matchesNum = player.num.toLowerCase().includes(term);
      const matchesPos = (player.primaryPosition || '').toLowerCase().includes(term);
      return matchesName || matchesNum || matchesPos;
    });
  }, [roster, rollCallSearchTerm]);

  // Quick incremental hours adjustment
  const handleQuickAdjustHours = (player: RosterPlayer, type: 'conditioning' | 'padded', delta: number) => {
    if (userRole !== 'admin') return;
    const currentCond = Number(player.conditioningHours || 0);
    const currentPadded = Number(player.paddedHours || 0);

    let updatedCond = currentCond;
    let updatedPadded = currentPadded;

    if (type === 'conditioning') {
      updatedCond = Math.min(10, Math.max(0, parseFloat((currentCond + delta).toFixed(1))));
    } else {
      updatedPadded = Math.min(10, Math.max(0, parseFloat((currentPadded + delta).toFixed(1))));
    }

    const currentWeekly = { ...(player.weeklyHours || {}) };
    const currentWeekLogged = Number(currentWeekly[selectedWeekForLog] || 0);
    currentWeekly[selectedWeekForLog] = Math.max(0, parseFloat((currentWeekLogged + delta).toFixed(1)));

    const updatedPlayer: RosterPlayer = {
      ...player,
      conditioningHours: updatedCond,
      paddedHours: updatedPadded,
      weeklyHours: currentWeekly,
    };

    onUpdatePlayer(updatedPlayer);
  };

  // Submit Roll Call & Credit Hours
  const handleSubmitAttendanceSession = () => {
    if (userRole !== 'admin') return;
    const hoursToAdd = Number(logSessionHours);
    if (hoursToAdd <= 0) return;

    const presentNums: string[] = [];
    const absentNums: string[] = [];
    const excusedNums: string[] = [];

    roster.forEach((p) => {
      const stat = playerAttendanceStatus[p.num] || 'present';
      if (stat === 'present') presentNums.push(p.num);
      else if (stat === 'absent') absentNums.push(p.num);
      else if (stat === 'excused') excusedNums.push(p.num);
    });

    // 1. Create and append Attendance Record
    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}`,
      date: logSessionDate,
      week: selectedWeekForLog,
      title: logSessionTitle || 'Practice Session',
      sessionType: logSessionType,
      hours: hoursToAdd,
      location: logSessionLocation,
      presentPlayerNums: presentNums,
      absentPlayerNums: absentNums,
      excusedPlayerNums: excusedNums,
      notes: logSessionNotes,
      timestamp: Date.now(),
    };

    const updatedLogs = [newRecord, ...attendanceLogs];
    const updatedRoster = syncEntireRosterWithLogs(roster, updatedLogs, selectedWeekForLog, seasonConfig);

    onUpdateRoster(updatedRoster);

    if (onUpdateAttendanceLogs) {
      onUpdateAttendanceLogs(updatedLogs);
    }

    setShowLogAttendanceModal(false);
  };

  // Delete an attendance log entry
  const handleDeleteAttendanceLog = (recordId: string) => {
    if (userRole !== 'admin') return;
    const logToDelete = attendanceLogs.find((r) => r.id === recordId);
    if (window.confirm(`Are you sure you want to remove attendance log "${logToDelete?.title || 'Practice'}"? Credited hours will be reversed.`)) {
      const updatedLogs = attendanceLogs.filter((r) => r.id !== recordId);
      const updatedRoster = syncEntireRosterWithLogs(roster, updatedLogs, currentWeek, seasonConfig);
      onUpdateRoster(updatedRoster);
      if (onUpdateAttendanceLogs) {
        onUpdateAttendanceLogs(updatedLogs);
      }
    }
  };

  // Save Preseason Configuration
  const handleSaveSeasonConfig = () => {
    if (userRole !== 'admin' || !onUpdateSeasonConfig) return;
    const newCount = Math.max(1, Math.min(10, editPreseasonCount));
    
    // Auto-generate week labels based on preseason count
    const customLabels: Record<string, string> = {};
    const preKeys: string[] = [];

    for (let i = 1; i <= newCount; i++) {
      const k = `pre-${i}`;
      preKeys.push(k);
      customLabels[k] = `Preseason Wk ${i} (${i <= 2 ? 'Conditioning' : 'Pads & Fundamentals'})`;
    }

    for (let i = 1; i <= 8; i++) {
      customLabels[String(i)] = `Regular Season • Week ${i}`;
    }

    customLabels['playoffs'] = 'Playoffs';
    customLabels['championship'] = 'Championship';

    const updatedConfig: SeasonConfig = {
      preseasonWeeksCount: newCount,
      regularSeasonWeeksCount: 8,
      preseasonWeekKeys: preKeys,
      customWeekLabels: customLabels,
    };

    onUpdateSeasonConfig(updatedConfig);
    setShowSeasonConfigModal(false);
  };

  // Print official practice hour report
  const handlePrintPracticeReport = (filter: 'all' | 'needs_scrimmage' = 'all') => {
    printPracticeHourReport({
      teamName: 'Mahopac 10U Youth Football',
      seasonName: '2026 Fall Youth Season',
      seasonConfig,
      roster,
      attendanceLogs,
      filterType: filter,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bento Title Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/80 border border-slate-700/80 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-full shadow-xs">
                MANDATED YOUTH COMPLIANCE
              </span>
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider rounded-full">
                MAHOPAC 10U
              </span>
              <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold rounded-full">
                {seasonConfig?.preseasonWeeksCount ?? 4} Weeks Preseason
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-2">
              <span>⚡ Practice Hours, Attendance & Acclimatization</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-3xl mt-1.5 leading-relaxed">
              Track roll call, attendance records, and NY youth acclimatization rules: <strong className="text-amber-300">10 Hours Conditioning</strong> required before wearing full pads, then <strong className="text-sky-300">10 Hours in Pads</strong> required before participating in scrimmages or live games.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {userRole === 'admin' && (
              <>
                <button
                  onClick={handleOpenAttendanceModal}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <ClipboardCheck className="w-4 h-4 text-slate-950" />
                  <span>Take Practice Attendance</span>
                </button>

                <button
                  onClick={() => {
                    setEditPreseasonCount(seasonConfig?.preseasonWeeksCount ?? 4);
                    setShowSeasonConfigModal(true);
                  }}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-amber-300 font-bold text-xs rounded-2xl flex items-center gap-2 border border-slate-700 active:scale-95 transition-all"
                  title="Configure Pre-Season & Acclimatization Weeks"
                >
                  <Settings className="w-4 h-4 text-amber-400" />
                  <span>Preseason Settings</span>
                </button>

                <button
                  onClick={onOpenRosterManager}
                  className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all border border-indigo-400/30"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Roster</span>
                </button>
              </>
            )}
            <button
              onClick={() => handlePrintPracticeReport('all')}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl flex items-center gap-2 border border-slate-700 active:scale-95 transition-all shadow-sm"
              title="Print Official Practice Hour Report (Full Roster)"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print Practice Report</span>
            </button>

            {complianceStats.needsScrimmageCount > 0 && (
              <button
                onClick={() => handlePrintPracticeReport('needs_scrimmage')}
                className="px-3.5 py-2.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 font-bold text-xs rounded-2xl flex items-center gap-2 border border-rose-800/80 active:scale-95 transition-all shadow-sm"
                title="Print Report of Athletes Needing Scrimmage Hours"
              >
                <FileCheck className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Print Scrimmage Deficiency</span>
                <span className="sm:hidden">Print Deficiency</span>
                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-black">
                  {complianceStats.needsScrimmageCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* 4-Column Metric Bento Grid - Clickable to View & Filter Athletes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab('roster_hours');
              setStatusFilter(statusFilter === 'fully_cleared' ? 'all' : 'fully_cleared');
            }}
            className={`text-left rounded-2xl p-3.5 transition-all cursor-pointer border ${
              statusFilter === 'fully_cleared'
                ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/40'
                : 'bg-slate-900/90 border-slate-700/80 hover:border-emerald-500/60 hover:bg-slate-850'
            } shadow-inner`}
            title="Click to view all athletes cleared for scrimmage"
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <span>Full Scrimmage Cleared</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">{complianceStats.fullyClearedCount}</span>
              <span className="text-xs text-slate-400 font-semibold">/ {complianceStats.totalPlayers} ({complianceStats.fullyClearedPct}%)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">10h Cond + 10h Pads Met &bull; Click to filter</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('roster_hours');
              setStatusFilter(statusFilter === 'needs_pads' ? 'all' : 'needs_pads');
            }}
            className={`text-left rounded-2xl p-3.5 transition-all cursor-pointer border ${
              statusFilter === 'needs_pads'
                ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/40'
                : 'bg-slate-900/90 border-slate-700/80 hover:border-rose-500/60 hover:bg-slate-850'
            } shadow-inner`}
            title="Click to view athletes wearing pads who need hours for scrimmage"
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <span>Needs Padded Hours</span>
              <Shield className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">{complianceStats.padsClearedCount}</span>
              <span className="text-xs text-slate-400 font-semibold">athletes</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Wearing pads; needs 10.0h padded &bull; Click to filter</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('roster_hours');
              setStatusFilter(statusFilter === 'needs_conditioning' ? 'all' : 'needs_conditioning');
            }}
            className={`text-left rounded-2xl p-3.5 transition-all cursor-pointer border ${
              statusFilter === 'needs_conditioning'
                ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/40'
                : 'bg-slate-900/90 border-slate-700/80 hover:border-rose-500/60 hover:bg-slate-850'
            } shadow-inner`}
            title="Click to view athletes needing conditioning hours"
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <span>Needs Conditioning</span>
              <Zap className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">{complianceStats.conditioningOnlyCount}</span>
              <span className="text-xs text-slate-400 font-semibold">athletes</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Tee &amp; shorts; needs 10.0h cond &bull; Click to filter</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance_log')}
            className="text-left bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 hover:border-indigo-500/60 rounded-2xl p-3.5 shadow-inner transition-all cursor-pointer"
            title="Click to view attendance log history"
          >
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              <span>Practice Logs</span>
              <History className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-300">{complianceStats.totalSessionsCount}</span>
              <span className="text-xs text-slate-400 font-semibold">sessions logged</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{complianceStats.totalConditioningHoursLogged}h cond + {complianceStats.totalPaddedHoursLogged}h pads</p>
          </button>
        </div>
      </div>

      {/* Interactive Clickable Banner: Who Needs Hours for Padded Scrimmage */}
      <button
        type="button"
        onClick={() => {
          setActiveTab('roster_hours');
          setStatusFilter(statusFilter === 'needs_scrimmage' ? 'all' : 'needs_scrimmage');
        }}
        className={`w-full text-left rounded-2xl p-3.5 sm:p-4 border transition-all flex items-center justify-between gap-3 shadow-md active:scale-[0.99] ${
          statusFilter === 'needs_scrimmage'
            ? 'bg-rose-950/80 border-rose-500 ring-2 ring-rose-500/50 shadow-rose-950/50'
            : complianceStats.needsScrimmageCount > 0
            ? 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border-rose-800/60 hover:border-rose-500/80 hover:bg-rose-950/50'
            : 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-800/60 hover:border-emerald-500/80'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              statusFilter === 'needs_scrimmage'
                ? 'bg-rose-500 text-white shadow-md'
                : complianceStats.needsScrimmageCount > 0
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {complianceStats.needsScrimmageCount > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-black uppercase tracking-wider ${
                  complianceStats.needsScrimmageCount > 0 ? 'text-rose-300' : 'text-emerald-300'
                }`}
              >
                Padded Scrimmage Clearance
              </span>
              {complianceStats.needsScrimmageCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs">
                  {complianceStats.needsScrimmageCount} Athletes Need Hours
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">
                  All Athletes Cleared ✓
                </span>
              )}
              {statusFilter === 'needs_scrimmage' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                  FILTER ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5 truncate">
              {statusFilter === 'needs_scrimmage'
                ? `Showing ${complianceStats.needsScrimmageCount} athletes needing conditioning or padded hours for scrimmage. Click to clear filter.`
                : complianceStats.needsScrimmageCount > 0
                ? `Click to view who needs hours for padded scrimmage (${complianceStats.needsScrimmageCount} athletes ineligible).`
                : 'Every athlete has logged 10.0h conditioning and 10.0h padded contact and is cleared for full contact scrimmages!'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`hidden sm:inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl border ${
              statusFilter === 'needs_scrimmage'
                ? 'bg-rose-500 text-white border-rose-400'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {statusFilter === 'needs_scrimmage' ? 'Clear Filter' : 'Click to View Ineligible'}
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${
                statusFilter === 'needs_scrimmage' ? 'rotate-90' : ''
              }`}
            />
          </span>
        </div>
      </button>

      {/* Main View Mode Selector (Weekly Matrix vs Roster Compliance vs Attendance Roll Call History) */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('weekly_matrix')}
            className={`px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 transition-all ${
              activeTab === 'weekly_matrix'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Weekly Attendance Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roster_hours')}
            className={`px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 transition-all ${
              activeTab === 'roster_hours'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Player Compliance Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attendance_log')}
            className={`px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 transition-all ${
              activeTab === 'attendance_log'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Attendance Log History ({attendanceLogs.length})</span>
          </button>
        </div>

        {/* Selected Week Filter */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold text-slate-300 text-[11px]">Season Week:</span>
          <select
            value={selectedWeekForLog}
            onChange={(e) => setSelectedWeekForLog(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-amber-400 focus:outline-none cursor-pointer"
          >
            <option value="0">Preseason Wk 1 (Conditioning)</option>
            <option value="pre-2">Preseason Wk 2 (Conditioning & Shells)</option>
            <option value="pre-3">Preseason Wk 3 (Pads & Fundamentals)</option>
            <option value="pre-4">Preseason Wk 4 (Pads & Scrimmage)</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
              <option key={w} value={String(w)}>
                Regular Season • Week {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* VIEW 0: Weekly Attendance Grid Matrix */}
      {activeTab === 'weekly_matrix' && (
        <WeeklyAttendanceTracker
          roster={roster}
          userRole={userRole}
          currentWeek={selectedWeekForLog || currentWeek}
          scheduleEvents={scheduleEvents}
          seasonConfig={seasonConfig}
          attendanceLogs={attendanceLogs}
          onUpdateRoster={onUpdateRoster}
          onUpdateAttendanceLogs={onUpdateAttendanceLogs}
          onAddScheduleEvent={onAddScheduleEvent}
          onUpdateScheduleEvent={onUpdateScheduleEvent}
          onDeleteScheduleEvent={onDeleteScheduleEvent}
        />
      )}

      {/* VIEW 1: Player Hours Compliance Grid */}
      {activeTab === 'roster_hours' && (
        <div className="space-y-5">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search player name, jersey #, position..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-700 rounded-2xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 shadow-inner"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'all'
                    ? 'bg-slate-700 text-white border border-slate-600 shadow-xs'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                All ({roster.length})
              </button>
              <button
                onClick={() => setStatusFilter('needs_scrimmage')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'needs_scrimmage'
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-500 shadow-xs'
                    : 'bg-slate-900/80 text-slate-400 hover:text-rose-400 border border-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Needs Scrimmage ({complianceStats.needsScrimmageCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('needs_conditioning')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  statusFilter === 'needs_conditioning'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                    : 'bg-slate-900/80 text-slate-400 hover:text-rose-400 border border-slate-800'
                }`}
              >
                <Zap className="w-3 h-3 text-rose-400" />
                <span>Needs Conditioning ({complianceStats.conditioningOnlyCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('needs_pads')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  statusFilter === 'needs_pads'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                    : 'bg-slate-900/80 text-slate-400 hover:text-rose-400 border border-slate-800'
                }`}
              >
                <Shield className="w-3 h-3 text-rose-400" />
                <span>Needs Padded Hours ({complianceStats.padsClearedCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('fully_cleared')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  statusFilter === 'fully_cleared'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'bg-slate-900/80 text-slate-400 hover:text-emerald-400 border border-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Fully Cleared ({complianceStats.fullyClearedCount})</span>
              </button>
            </div>
          </div>

          {/* Player Cards Compliance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRoster.map((player) => {
              const calc = calculatePlayerHours(player, attendanceLogs, selectedWeekForLog, seasonConfig);
              const comp = calculatePlayerCompliance(player);
              const condProgress = Math.min(100, (comp.conditioningHours / CONDITIONING_HOURS_REQUIRED) * 100);
              const padProgress = Math.min(100, (comp.paddedHours / PADDED_HOURS_REQUIRED) * 100);
              const thisWeekHours = calc.thisWeekHours;
              const attendedCount = calc.attendedCount;
              const totalLoggedPractices = calc.totalSessionsCount;
              const attRate = calc.attendanceRate;

              return (
                <div
                  key={player.num}
                  className={`bg-slate-900/90 border rounded-3xl p-4.5 shadow-lg flex flex-col justify-between gap-3 transition-all hover:border-slate-600 ${
                    comp.isScrimmageCleared
                      ? 'border-emerald-500/30 ring-1 ring-emerald-500/10'
                      : 'border-rose-500/30 ring-1 ring-rose-500/10'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-mono font-black text-indigo-300 text-sm shadow-inner shrink-0">
                          #{player.num}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-black text-sm text-slate-100 uppercase tracking-tight truncate">
                              {player.firstName} {player.lastName}
                            </h3>
                            {player.isCaptain && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black uppercase">
                                C
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {player.primaryPosition && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase">
                                OFF: {player.primaryPosition}
                              </span>
                            )}
                            {player.secondaryPosition && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                                DEF: {player.secondaryPosition}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {userRole === 'admin' && (
                        <button
                          onClick={() => onOpenEditPlayerModal(player)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                          title="Edit player information"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Status Badge & Attendance Rate */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${comp.badgeColor}`}>
                        {comp.isScrimmageCleared ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Fully Cleared (Good ✓)</span>
                          </>
                        ) : comp.isPadsCleared ? (
                          <>
                            <Shield className="w-3 h-3 text-rose-400" />
                            <span>Needs Padded Hours ({(10 - Math.min(10, comp.paddedHours)).toFixed(1)}h left)</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3 text-rose-400" />
                            <span>Needs Conditioning ({(10 - Math.min(10, comp.conditioningHours)).toFixed(1)}h left)</span>
                          </>
                        )}
                      </span>

                      <span className="text-[10px] font-mono font-bold text-slate-400 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                        Att: {attRate}% ({attendedCount}/{totalLoggedPractices || 0})
                      </span>
                    </div>

                    {/* Progress Bar 1: Conditioning Hours (Max 10.0h, Red if < 10, Green if >= 10) */}
                    {(() => {
                      const condHours = Math.min(10, comp.conditioningHours);
                      const isCondGood = comp.conditioningHours >= 10;
                      return (
                        <div
                          onClick={() => {
                            setBreakdownPlayer(player);
                            setBreakdownScope('preseason');
                          }}
                          className={`space-y-1 mb-2.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 p-2.5 rounded-2xl cursor-pointer transition-all group ${
                            isCondGood ? 'hover:border-emerald-500/50' : 'hover:border-rose-500/50'
                          }`}
                          title="Click to see conditioning practice days"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className={`flex items-center gap-1 ${
                              isCondGood ? 'text-emerald-400 group-hover:text-emerald-300' : 'text-rose-400 group-hover:text-rose-300'
                            }`}>
                              <Zap className={`w-3 h-3 ${isCondGood ? 'text-emerald-400' : 'text-rose-400'}`} />
                              <span>Conditioning (Max 10h)</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${
                                isCondGood ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {isCondGood ? 'Good ✓' : `Needs ${(10 - condHours).toFixed(1)}h`}
                              </span>
                              <span className={`font-mono underline decoration-dotted font-bold ${
                                isCondGood ? 'text-emerald-300' : 'text-rose-300'
                              }`}>
                                {condHours.toFixed(1)} / 10.0 hrs
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                isCondGood ? 'bg-emerald-400' : 'bg-rose-500'
                              }`}
                              style={{ width: `${condProgress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Progress Bar 2: Padded Hours (Max 10.0h, Red if < 10, Green if >= 10) */}
                    {(() => {
                      const padHours = Math.min(10, comp.paddedHours);
                      const isPadGood = comp.paddedHours >= 10;
                      return (
                        <div
                          onClick={() => {
                            setBreakdownPlayer(player);
                            setBreakdownScope('preseason');
                          }}
                          className={`space-y-1 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 p-2.5 rounded-2xl cursor-pointer transition-all group ${
                            isPadGood ? 'hover:border-emerald-500/50' : 'hover:border-rose-500/50'
                          }`}
                          title="Click to see padded practice days"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className={`flex items-center gap-1 ${
                              isPadGood ? 'text-emerald-400 group-hover:text-emerald-300' : 'text-rose-400 group-hover:text-rose-300'
                            }`}>
                              <Shield className={`w-3 h-3 ${isPadGood ? 'text-emerald-400' : 'text-rose-400'}`} />
                              <span>Padded Contact (Max 10h)</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${
                                isPadGood ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {isPadGood ? 'Good ✓' : `Needs ${(10 - padHours).toFixed(1)}h`}
                              </span>
                              <span className={`font-mono underline decoration-dotted font-bold ${
                                isPadGood ? 'text-emerald-300' : 'text-rose-300'
                              }`}>
                                {padHours.toFixed(1)} / 10.0 hrs
                              </span>
                            </div>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                isPadGood ? 'bg-emerald-400' : 'bg-rose-500'
                              }`}
                              style={{ width: `${padProgress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Interactive Days Breakdown Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setBreakdownPlayer(player);
                        setBreakdownScope('season');
                      }}
                      className="w-full mt-2.5 py-1.5 px-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all flex items-center justify-between text-[11px] font-bold cursor-pointer group"
                      title="Click to see what days added together for this total"
                    >
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300" />
                        <span>Days Breakdown:</span>
                        <span className="font-mono text-emerald-400 font-black">
                          {calc.totalSeasonHours.toFixed(1)} hrs total
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-200 underline decoration-dotted">
                        View days &rarr;
                      </span>
                    </button>
                  </div>

                  {/* Quick Admin Adjustments */}
                  {userRole === 'admin' && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">Adjust:</span>
                        <button
                          onClick={() => handleQuickAdjustHours(player, 'conditioning', 0.5)}
                          className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 font-mono font-bold"
                          title="Add 0.5h conditioning"
                        >
                          +0.5h Cond
                        </button>
                        <button
                          onClick={() => handleQuickAdjustHours(player, 'padded', 0.5)}
                          className="px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 border border-sky-500/30 font-mono font-bold"
                          title="Add 0.5h padded"
                        >
                          +0.5h Pads
                        </button>
                      </div>

                      <span className="text-[10px] font-mono text-slate-500">
                        Wk {selectedWeekForLog}: {thisWeekHours.toFixed(1)}h
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Attendance Roll Call History Log */}
      {activeTab === 'attendance_log' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-100">Practice Roll Call History</h2>
              <p className="text-xs text-slate-400">Chronological audit log of completed practices and roster attendance</p>
            </div>
            {userRole === 'admin' && (
              <button
                onClick={handleOpenAttendanceModal}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Log New Roll Call</span>
              </button>
            )}
          </div>

          {attendanceLogs.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <ClipboardCheck className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="font-bold text-slate-300 text-sm">No Attendance Records Yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click "Take Practice Attendance" to record roll call for today's practice and credit acclimatization hours to all present players.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendanceLogs.map((log) => {
                const presentArr = Array.isArray(log?.presentPlayerNums) ? log.presentPlayerNums : [];
                const absentArr = Array.isArray(log?.absentPlayerNums) ? log.absentPlayerNums : [];
                const presentCount = presentArr.length;
                const absentCount = absentArr.length;
                const total = presentCount + absentCount;
                const pct = total > 0 ? Math.round((presentCount / total) * 100) : 100;

                return (
                  <div
                    key={log.id}
                    className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 shadow-md transition-all hover:border-slate-600"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase">
                            {formatWeekLabel(log.week, seasonConfig)}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                              log.sessionType === 'conditioning'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {log.sessionType === 'conditioning' ? '⚡ Conditioning' : '🛡️ Full Pads'}
                          </span>
                          <span className="text-xs font-mono text-slate-400 font-bold">
                            {log.date} • {log.hours} Hours
                          </span>
                        </div>
                        <h3 className="font-black text-slate-100 text-sm">{log.title}</h3>
                        {log.location && (
                          <div className="text-xs text-slate-400 mt-0.5">📍 {log.location}</div>
                        )}
                        {log.notes && (
                          <p className="text-xs text-slate-300 mt-1 italic">"{log.notes}"</p>
                        )}
                      </div>

                      {/* Attendance Stats & Actions */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-mono font-black text-sm text-emerald-400">
                            {presentCount} Present / {absentCount} Absent ({pct}%)
                          </div>
                          {absentCount > 0 && (
                            <div className="text-[10px] text-rose-400 font-bold truncate max-w-xs">
                              Absent: {absentArr.map((n) => `#${n}`).join(', ')}
                            </div>
                          )}
                        </div>

                        {userRole === 'admin' && (
                          <button
                            onClick={() => handleDeleteAttendanceLog(log.id)}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
                            title="Delete this attendance record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Take Practice Attendance / Roll Call */}
      {showLogAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-100 text-base">Practice Roll Call &amp; Hours Credit</h3>
                  <p className="text-xs text-slate-400">Mark who attended and credit mandated compliance hours</p>
                </div>
              </div>
              <button
                onClick={() => setShowLogAttendanceModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 max-h-[70vh]">
              {/* Practice Session Quick Controls Strip */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Category Toggle */}
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setLogSessionType('conditioning')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        logSessionType === 'conditioning'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>⚡ Conditioning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogSessionType('padded')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        logSessionType === 'padded'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>🛡️ Full Pads</span>
                    </button>
                  </div>

                  {/* Duration Selector */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {[1.0, 1.5, 2.0].map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setLogSessionHours(hrs)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          logSessionHours === hrs
                            ? 'bg-slate-700 text-amber-300 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>

                  {/* Toggle Practice Details */}
                  <button
                    type="button"
                    onClick={() => setShowPracticeDetails(!showPracticeDetails)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                  >
                    <span>⚙️ {showPracticeDetails ? 'Hide Details' : 'Practice Details'}</span>
                    {showPracticeDetails ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </div>

                {/* Collapsible Practice Details Drawer */}
                {showPracticeDetails && (
                  <div className="pt-3 border-t border-slate-850 space-y-3 animate-in fade-in duration-150">
                    {scheduleEvents.filter((e) => e.type === 'practice' || e.type === 'scrimmage').length > 0 && (
                      <div>
                        <label className="block font-bold text-slate-400 mb-1 text-[11px]">
                          Auto-Fill From Scheduled Practice:
                        </label>
                        <select
                          value={selectedScheduleEventId}
                          onChange={(e) => handleSelectScheduleEvent(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                        >
                          <option value="">-- Choose Scheduled Practice --</option>
                          {scheduleEvents
                            .filter((e) => e.type === 'practice' || e.type === 'scrimmage')
                            .map((evt) => (
                              <option key={evt.id} value={evt.id}>
                                {evt.date} • {evt.title} ({evt.location || 'Crane Road'})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-400 mb-1 text-[11px]">
                          Practice Description / Title:
                        </label>
                        <input
                          type="text"
                          value={logSessionTitle}
                          onChange={(e) => setLogSessionTitle(e.target.value)}
                          placeholder="e.g. Preseason Practice"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-400 mb-1 text-[11px]">
                          Date:
                        </label>
                        <input
                          type="date"
                          value={logSessionDate}
                          onChange={(e) => setLogSessionDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DIRECT PLAYER ROLL CALL */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-100 text-sm">
                      Player Roll Call:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {Object.values(playerAttendanceStatus).filter((s) => s === 'present').length} / {roster.length} Present
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick filter search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search player..."
                        value={rollCallSearchTerm}
                        onChange={(e) => setRollCallSearchTerm(e.target.value)}
                        className="pl-8 pr-2.5 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const all: Record<string, 'present' | 'absent' | 'excused'> = {};
                          roster.forEach((p) => (all[p.num] = 'present'));
                          setPlayerAttendanceStatus(all);
                        }}
                        className="px-2 py-0.5 text-[11px] font-black text-emerald-400 hover:text-white rounded-lg hover:bg-emerald-950/60 transition-colors"
                      >
                        All Present
                      </button>
                      <span className="text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          const all: Record<string, 'present' | 'absent' | 'excused'> = {};
                          roster.forEach((p) => (all[p.num] = 'absent'));
                          setPlayerAttendanceStatus(all);
                        }}
                        className="px-2 py-0.5 text-[11px] font-black text-rose-400 hover:text-white rounded-lg hover:bg-rose-950/60 transition-colors"
                      >
                        All Absent
                      </button>
                    </div>
                  </div>
                </div>

                {/* Player Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto p-2 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  {filteredRollCallRoster.map((player) => {
                    const status = playerAttendanceStatus[player.num] || 'present';

                    return (
                      <div
                        key={player.num}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          status === 'present'
                            ? 'bg-slate-900/90 border-emerald-500/40 text-slate-100 shadow-xs'
                            : status === 'excused'
                            ? 'bg-amber-950/30 border-amber-600/40 text-amber-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-500 opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 font-mono font-black text-indigo-400 text-xs flex items-center justify-center shrink-0">
                            #{player.num}
                          </span>
                          <div className="truncate">
                            <div className="font-bold text-xs truncate text-white">
                              {player.firstName} {player.lastName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {player.primaryPosition || 'Athlete'}
                            </div>
                          </div>
                        </div>

                        {/* Status Toggle Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setPlayerAttendanceStatus((prev) => ({
                                ...prev,
                                [player.num]: 'present',
                              }))
                            }
                            className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              status === 'present'
                                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            ✓ Present
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPlayerAttendanceStatus((prev) => ({
                                ...prev,
                                [player.num]: 'absent',
                              }))
                            }
                            className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              status === 'absent'
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 ring-1 ring-rose-400'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            ✗ Absent
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredRollCallRoster.length === 0 && (
                    <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                      No players match "{rollCallSearchTerm}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogAttendanceModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAttendanceSession}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-md active:scale-95 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Save Roll Call &amp; Credit {logSessionHours} hrs to {Object.values(playerAttendanceStatus).filter((s) => s === 'present').length} Players</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Comprehensive Season Weeks & Dropdown Configuration */}
      <SeasonConfigModal
        isOpen={showSeasonConfigModal}
        onClose={() => setShowSeasonConfigModal(false)}
        seasonConfig={seasonConfig || DEFAULT_SEASON_CONFIG}
        onSaveSeasonConfig={(newCfg) => {
          if (onUpdateSeasonConfig) onUpdateSeasonConfig(newCfg);
        }}
        scheduleEvents={scheduleEvents}
      />

      {/* MODAL 3: Detailed Player Hours Breakdown */}
      <PlayerHoursBreakdownModal
        player={breakdownPlayer}
        isOpen={Boolean(breakdownPlayer)}
        onClose={() => setBreakdownPlayer(null)}
        attendanceLogs={attendanceLogs}
        seasonConfig={seasonConfig}
        initialScope={breakdownScope}
        selectedWeek={selectedWeekForLog}
      />
    </div>
  );
};
