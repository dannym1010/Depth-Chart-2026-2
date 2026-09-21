import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  Shield,
  Zap,
  Swords,
  Users,
  Trophy,
  Printer,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  AlertCircle,
  FileSpreadsheet,
  ClipboardList,
  Sparkles,
  Shirt,
  Info,
  CalendarDays,
  ListFilter,
  CheckCircle2,
  X,
  SlidersHorizontal,
  RefreshCw,
  Link2,
  Unlink,
} from 'lucide-react';
import {
  ScheduleEvent,
  ScheduleEventType,
  PracticePlan,
  WeekState,
  UserRole,
  PracticePeriod,
  Team,
  SeasonConfig,
  formatWeekLabel,
} from '../types';
import { getSeasonWeekList, getWeekDisplayLabelWithOpponent } from '../utils/seasonWeekUtils';
import { triggerPrint } from '../utils/printUtils';
import { PracticeWizardModal, PracticeWizardGeneratedResult } from './PracticeWizardModal';
import { TeamSnapSyncModal } from './TeamSnapSyncModal';
import { getPracticeSequenceMap, formatPracticeDayTitle } from '../utils/practiceUtils';

interface ScheduleViewProps {
  scheduleEvents: ScheduleEvent[];
  practicePlans: PracticePlan[];
  weeklyData: Record<string, WeekState>;
  currentWeek: string;
  userRole: UserRole;
  activeTeam?: Team;
  practiceTemplates?: Record<string, PracticePeriod[]>;
  seasonConfig?: SeasonConfig;
  onOpenSeasonConfigModal?: () => void;
  onAddEvent: (event: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>) => void;
  onUpdateEvent: (id: string, updates: Partial<ScheduleEvent>) => void;
  onDeleteEvent: (id: string) => void;
  onBulkAddEvents?: (events: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[]) => void;
  onPracticeWizardGenerate?: (result: PracticeWizardGeneratedResult) => void;
  onNavigateToWeek: (week: string, unit: 'scouting' | 'practice' | 'wristband' | 'groups' | 'game_day', practiceId?: string) => void;
  onSyncGameToWeeklyData?: (week: string, opponent: string, date: string, time: string, location: string) => void;
  onSyncPracticeToPlan?: (event: ScheduleEvent, templateName?: string) => string; // returns practicePlan id
  onImportTeamSnapEvents?: (newEvents: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[], replaceExisting?: boolean) => void;
  onUpdateTeam?: (teamId: string, updates: Partial<Team>) => void;
}

type ViewMode = 'timeline' | 'month' | 'grid';
type FilterType = 'all' | 'game' | 'pregame' | 'practice' | 'scrimmage' | 'meeting';

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  scheduleEvents = [],
  practicePlans = [],
  weeklyData = {},
  currentWeek,
  userRole,
  activeTeam,
  practiceTemplates = {},
  seasonConfig,
  onOpenSeasonConfigModal,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onBulkAddEvents,
  onPracticeWizardGenerate,
  onNavigateToWeek,
  onSyncGameToWeeklyData,
  onSyncPracticeToPlan,
  onImportTeamSnapEvents,
  onUpdateTeam,
}) => {
  const safeScheduleEvents = useMemo(() => scheduleEvents || [], [scheduleEvents]);

  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'pre' | 'regular' | 'playoffs'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Calendar month state (default to Sept 2026 or current active date)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date(2026, 8, 1)); // September 2026

  // Modals state
  const [isAddGameModalOpen, setIsAddGameModalOpen] = useState(false);
  const [isAddPracticeModalOpen, setIsAddPracticeModalOpen] = useState(false);
  const [isCadenceWizardOpen, setIsCadenceWizardOpen] = useState(false);
  const [isTeamSnapSyncOpen, setIsTeamSnapSyncOpen] = useState(false);
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false);
  const [isCreatePreGameModalOpen, setIsCreatePreGameModalOpen] = useState(false);
  const [preGameTargetGameId, setPreGameTargetGameId] = useState('');
  const [preGameCustomTemplate, setPreGameCustomTemplate] = useState('Pre-Game Warmup & Routine');
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [scoreModalEvent, setScoreModalEvent] = useState<ScheduleEvent | null>(null);
  const [linkingPreGameEvent, setLinkingPreGameEvent] = useState<ScheduleEvent | null>(null);

  // Form states for New Game Modal
  const [gameOpponent, setGameOpponent] = useState('');
  const [gameWeek, setGameWeek] = useState('1');
  const [gameDate, setGameDate] = useState('2026-09-05');
  const [gameStartTime, setGameStartTime] = useState('10:00');
  const [gameEndTime, setGameEndTime] = useState('12:00');
  const [gameLocation, setGameLocation] = useState('Mahopac High School');
  const [gameLocationType, setGameLocationType] = useState<'home' | 'away' | 'neutral'>('home');
  const [gameUniform, setGameUniform] = useState('Gold Home Jerseys & Gold Socks');
  const [gameArrivalMins, setGameArrivalMins] = useState(60);
  const [gameNotes, setGameNotes] = useState('');
  const [autoSyncScouting, setAutoSyncScouting] = useState(true);
  const [autoCreatePreGamePlan, setAutoCreatePreGamePlan] = useState(true);
  const [selectedPreGameTemplate, setSelectedPreGameTemplate] = useState('Pre-Game Warmup & Routine');

  // Form states for New Practice Modal
  const [practiceTitle, setPracticeTitle] = useState('');
  const [practiceWeek, setPracticeWeek] = useState('1');
  const [practiceDate, setPracticeDate] = useState('2026-09-01');
  const [practiceStartTime, setPracticeStartTime] = useState('17:30');
  const [practiceEndTime, setPracticeEndTime] = useState('19:00');
  const [practiceLocation, setPracticeLocation] = useState('Crane Road');
  const [practiceFocus, setPracticeFocus] = useState('');
  const [practiceIsNonPractice, setPracticeIsNonPractice] = useState(false);
  const [autoCreatePlan, setAutoCreatePlan] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('Offense & Defense Full Practice');

  // Form state for Result Logger Modal
  const [teamScore, setTeamScore] = useState<number>(0);
  const [oppScore, setOppScore] = useState<number>(0);
  const [recapNotes, setRecapNotes] = useState<string>('');

  // Cadence Wizard Form State
  const [cadenceWeeksCount, setCadenceWeeksCount] = useState<number>(8);
  const [cadenceDays, setCadenceDays] = useState<{ tuesday: boolean; thursday: boolean }>({
    tuesday: true,
    thursday: true,
  });
  const [cadenceStartTime, setCadenceStartTime] = useState('17:30');
  const [cadenceEndTime, setCadenceEndTime] = useState('19:00');
  const [cadenceLocation, setCadenceLocation] = useState('Crane Road');

  // Collapsed / Expanded state for timeline weeks: past and future weeks minimized, only current week expanded by default
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (currentWeek) {
      initial[String(currentWeek)] = true;
    }
    return initial;
  });

  const isWeekExpanded = (weekKey: string) => {
    if (weekKey in expandedWeeks) {
      return expandedWeeks[weekKey];
    }
    return String(weekKey) === String(currentWeek);
  };

  const toggleWeekExpanded = (weekKey: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekKey]: !isWeekExpanded(weekKey),
    }));
  };

  const expandAllWeeks = (allWeekKeys: string[]) => {
    const all: Record<string, boolean> = {};
    allWeekKeys.forEach((wk) => {
      all[wk] = true;
    });
    setExpandedWeeks(all);
  };

  const minimizeAllWeeks = (allWeekKeys: string[]) => {
    const none: Record<string, boolean> = {};
    allWeekKeys.forEach((wk) => {
      none[wk] = false;
    });
    setExpandedWeeks(none);
  };

  const collapseNonCurrentWeeks = (allWeekKeys: string[]) => {
    const initial: Record<string, boolean> = {};
    allWeekKeys.forEach((wk) => {
      initial[wk] = String(wk) === String(currentWeek);
    });
    setExpandedWeeks(initial);
  };

  // Sort events chronologically
  const sortedEvents = useMemo(() => {
    return [...safeScheduleEvents].sort((a, b) => {
      const dateDiff = (a.date || '').localeCompare(b.date || '');
      if (dateDiff !== 0) return dateDiff;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
  }, [safeScheduleEvents]);

  // Dynamic Practice Sequence Map starting 8/3 (excluding cancelled and non-practice events)
  const practiceSeqMap = useMemo(() => {
    return getPracticeSequenceMap(practicePlans, safeScheduleEvents);
  }, [practicePlans, safeScheduleEvents]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return sortedEvents.filter((event) => {
      // Type Filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'game' && event.type !== 'game' && event.type !== 'tournament') return false;
        if (typeFilter === 'pregame') {
          const isGameLike = event.type === 'game' || event.type === 'tournament' || event.type === 'scrimmage';
          const hasPreGame = Boolean(event.preGamePlanId);
          if (!isGameLike && !hasPreGame) return false;
        }
        if (typeFilter === 'practice' && event.type !== 'practice' && event.type !== 'walkthrough') return false;
        if (typeFilter === 'scrimmage' && event.type !== 'scrimmage') return false;
        if (typeFilter === 'meeting' && event.type !== 'meeting') return false;
      }

      // Phase Filter
      if (phaseFilter !== 'all') {
        const isPre = event.week.startsWith('pre') || event.week === '0';
        const isPlayoffs = event.week === 'playoffs' || event.week === 'championship' || event.week === 'post';
        const isRegular = !isPre && !isPlayoffs;
        if (phaseFilter === 'pre' && !isPre) return false;
        if (phaseFilter === 'regular' && !isRegular) return false;
        if (phaseFilter === 'playoffs' && !isPlayoffs) return false;
      }

      // Week Filter
      if (weekFilter !== 'all' && event.week !== weekFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = event.title.toLowerCase().includes(q);
        const matchOpp = event.opponent?.toLowerCase().includes(q);
        const matchLoc = event.location.toLowerCase().includes(q);
        const matchNotes = event.focusOrNotes?.toLowerCase().includes(q);
        const matchDate = event.date.includes(q);
        if (!matchTitle && !matchOpp && !matchLoc && !matchNotes && !matchDate) {
          return false;
        }
      }

      return true;
    });
  }, [sortedEvents, typeFilter, weekFilter, phaseFilter, searchQuery]);

  // Group events by Week for timeline view
  const eventsByWeek = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    filteredEvents.forEach((evt) => {
      const key = evt.week;
      if (!map[key]) map[key] = [];
      map[key].push(evt);
    });
    return map;
  }, [filteredEvents]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalGames = safeScheduleEvents.filter((e) => e.type === 'game' || e.type === 'tournament').length;
    const totalPractices = safeScheduleEvents.filter((e) => e.type === 'practice' || e.type === 'walkthrough').length;
    const totalScrimmages = safeScheduleEvents.filter((e) => e.type === 'scrimmage').length;

    let wins = 0;
    let losses = 0;
    let ties = 0;
    safeScheduleEvents.forEach((e) => {
      if (e.result?.outcome === 'W') wins++;
      if (e.result?.outcome === 'L') losses++;
      if (e.result?.outcome === 'T') ties++;
    });

    const hasResults = wins > 0 || losses > 0 || ties > 0;

    return {
      totalGames,
      totalPractices,
      totalScrimmages,
      record: hasResults ? `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}` : null,
      wins,
      losses,
    };
  }, [safeScheduleEvents]);

  // Next Upcoming Event
  const nextEvent = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Filter events starting today or in the future
    const upcoming = sortedEvents.filter((e) => e.date >= todayStr);
    if (upcoming.length > 0) {
      return upcoming[0];
    }
    // If no upcoming events remain, fallback to the last or first event
    return sortedEvents[sortedEvents.length - 1] || sortedEvents[0];
  }, [sortedEvents]);

  // Helper to format date string nicely (e.g., "Saturday, Sep 5, 2026")
  const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimeDisplay = (time24: string): string => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mStr} ${ampm}`;
  };

  const getWeekName = (weekVal: string): string => {
    return formatWeekLabel(weekVal, seasonConfig);
  };

  // Get matching practice plan for an event
  const getLinkedPracticePlan = (evt: ScheduleEvent): PracticePlan | undefined => {
    if (!evt || !practicePlans || !Array.isArray(practicePlans)) return undefined;
    const planId = evt.preGamePlanId || evt.linkedPracticePlanId;
    if (planId) {
      const found = practicePlans.find((p) => p && p.id === planId);
      if (found) return found;
    }
    const isGameEvent = evt.type === 'game' || evt.type === 'tournament' || evt.type === 'scrimmage';
    return practicePlans.find(
      (p) =>
        p &&
        (p.id === planId ||
          (p.date === evt.date &&
            (isGameEvent
              ? p.title?.toLowerCase().includes('pre-game') ||
                p.title?.toLowerCase().includes('warmup') ||
                p.title?.toLowerCase().includes('walkthrough')
              : true)) ||
          (p.weekFolder === `Week ${evt.week}` &&
            p.title &&
            evt.title &&
            (p.title.toLowerCase() === evt.title.toLowerCase() ||
              (isGameEvent &&
                (p.title.toLowerCase().includes('pre-game') ||
                  p.title.toLowerCase().includes('warmup'))))))
    );
  };

  // Open practice plan from schedule, auto-populating date, time, week folder, day, and title
  const handleOpenPracticeForEvent = (evt: ScheduleEvent, defaultTemplate?: string) => {
    const isGame = evt.type === 'game' || evt.type === 'tournament' || evt.type === 'scrimmage';
    const template = defaultTemplate || (isGame ? 'Pre-Game Warmup & Routine' : undefined);
    if (onSyncPracticeToPlan) {
      const planId = onSyncPracticeToPlan(evt, template);
      onNavigateToWeek(evt.week, 'practice', planId);
    } else {
      const linkedPlan = getLinkedPracticePlan(evt);
      onNavigateToWeek(evt.week, 'practice', linkedPlan?.id);
    }
  };

  // Quick create and link pre-game practice plan
  const handleQuickCreatePreGamePlan = (evt: ScheduleEvent, templateName: string = 'Pre-Game Warmup & Routine') => {
    if (onSyncPracticeToPlan) {
      const planId = onSyncPracticeToPlan(evt, templateName);
      onUpdateEvent(evt.id, { linkedPracticePlanId: planId, preGamePlanId: planId });
      onNavigateToWeek(evt.week, 'practice', planId);
    }
  };

  // Link an existing practice plan to a schedule event
  const handleLinkPlanToEvent = (evtId: string, planId: string) => {
    onUpdateEvent(evtId, { linkedPracticePlanId: planId, preGamePlanId: planId });
    setLinkingPreGameEvent(null);
  };

  // Unlink practice plan from a schedule event
  const handleUnlinkPlanFromEvent = (evtId: string) => {
    onUpdateEvent(evtId, { linkedPracticePlanId: undefined, preGamePlanId: undefined });
    setLinkingPreGameEvent(null);
  };

  // Handle Save Game
  const handleSaveGame = () => {
    if (!gameOpponent.trim()) {
      alert('Please provide an opponent name.');
      return;
    }
    const newGame: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'> = {
      type: 'game',
      title: `${gameLocationType === 'home' ? 'vs' : '@'} ${gameOpponent}`,
      week: gameWeek,
      date: gameDate,
      startTime: gameStartTime,
      endTime: gameEndTime,
      location: gameLocation,
      locationType: gameLocationType,
      opponent: gameOpponent.trim(),
      uniform: gameUniform,
      arrivalMinutesBefore: gameArrivalMins,
      focusOrNotes: gameNotes.trim(),
    };

    // Auto-create matching Pre-Game Practice Plan
    if (autoCreatePreGamePlan && onSyncPracticeToPlan) {
      const dummyEvt: ScheduleEvent = {
        ...newGame,
        id: 'evt_' + Date.now(),
        createdAt: Date.now(),
        lastEdited: Date.now(),
      };
      const planId = onSyncPracticeToPlan(dummyEvt, selectedPreGameTemplate);
      newGame.linkedPracticePlanId = planId;
      newGame.preGamePlanId = planId;
    }

    onAddEvent(newGame);

    // Auto-sync with weekly scouting and opponent header
    if (autoSyncScouting && onSyncGameToWeeklyData) {
      onSyncGameToWeeklyData(gameWeek, gameOpponent.trim(), gameDate, gameStartTime, gameLocation);
    }

    setIsAddGameModalOpen(false);
    setGameOpponent('');
    setGameNotes('');
  };

  // Handle Save Practice
  const handleSavePractice = () => {
    const title = practiceTitle.trim() || `Week ${practiceWeek} Practice`;
    const newPractice: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'> = {
      type: 'practice',
      title,
      week: practiceWeek,
      date: practiceDate,
      startTime: practiceStartTime,
      endTime: practiceEndTime,
      location: practiceLocation,
      locationType: 'home',
      arrivalMinutesBefore: 15,
      focusOrNotes: practiceFocus.trim(),
      isNonPractice: practiceIsNonPractice,
    };

    // Auto-create matching Practice Plan
    if (autoCreatePlan && onSyncPracticeToPlan) {
      const dummyEvt: ScheduleEvent = {
        ...newPractice,
        id: 'evt_' + Date.now(),
        createdAt: Date.now(),
        lastEdited: Date.now(),
      };
      const planId = onSyncPracticeToPlan(dummyEvt, selectedTemplate);
      newPractice.linkedPracticePlanId = planId;
    }

    onAddEvent(newPractice);
    setIsAddPracticeModalOpen(false);
    setPracticeTitle('');
    setPracticeFocus('');
    setPracticeIsNonPractice(false);
  };

  // Cadence Generator (Generates Tuesday & Thursday practices for weeks 1..N)
  const handleGenerateCadence = () => {
    if (!onBulkAddEvents) return;
    const newEvents: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[] = [];
    const baseDate = new Date(2026, 8, 1); // Tuesday Sep 1, 2026

    for (let w = 1; w <= cadenceWeeksCount; w++) {
      // Week offset
      const weekOffsetDays = (w - 1) * 7;

      if (cadenceDays.tuesday) {
        const tue = new Date(baseDate);
        tue.setDate(baseDate.getDate() + weekOffsetDays);
        const dateStr = tue.toISOString().split('T')[0];
        newEvents.push({
          type: 'practice',
          title: `Week ${w} - Tuesday Practice`,
          week: w.toString(),
          date: dateStr,
          startTime: cadenceStartTime,
          endTime: cadenceEndTime,
          location: cadenceLocation,
          locationType: 'home',
          arrivalMinutesBefore: 15,
          focusOrNotes: 'Full Pads. Inside run, 11-on-11 scrimmage, and position fundamentals.',
        });
      }

      if (cadenceDays.thursday) {
        const thu = new Date(baseDate);
        thu.setDate(baseDate.getDate() + weekOffsetDays + 2); // Thursday
        const dateStr = thu.toISOString().split('T')[0];
        newEvents.push({
          type: 'practice',
          title: `Week ${w} - Thursday Walkthrough & Specials`,
          week: w.toString(),
          date: dateStr,
          startTime: cadenceStartTime,
          endTime: cadenceEndTime,
          location: cadenceLocation,
          locationType: 'home',
          arrivalMinutesBefore: 15,
          focusOrNotes: 'Shells / Helmets. Redzone execution, special teams, and wristband signals.',
        });
      }
    }

    onBulkAddEvents(newEvents);
    setIsCadenceWizardOpen(false);
  };

  // Record Game Result
  const handleSaveResult = () => {
    if (!scoreModalEvent) return;
    const outcome = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'T';
    onUpdateEvent(scoreModalEvent.id, {
      result: {
        teamScore,
        opponentScore: oppScore,
        outcome,
        recapNotes: recapNotes.trim(),
      },
    });
    setScoreModalEvent(null);
  };

  // Copy plain text schedule to clipboard
  const handleCopySchedule = () => {
    const lines: string[] = ['=== MAHOPAC 10U SEASON SCHEDULE ==='];
    lines.push(`Record: ${stats.record || '0-0'} | Total Games: ${stats.totalGames} | Practices: ${stats.totalPractices}\n`);

    sortedEvents.forEach((evt) => {
      const typeIcon = evt.type === 'game' ? '🏈 GAME' : evt.type === 'practice' ? '📋 PRACTICE' : '⚔️ SCRIMMAGE';
      lines.push(`[${typeIcon} - ${getWeekName(evt.week)}] ${formatDateDisplay(evt.date)} @ ${formatTimeDisplay(evt.startTime)}`);
      lines.push(`  ${evt.title}`);
      lines.push(`  📍 Location: ${evt.location}`);
      if (evt.uniform) lines.push(`  🎽 Uniform: ${evt.uniform}`);
      if (evt.arrivalMinutesBefore) lines.push(`  ⏰ Arrival: ${evt.arrivalMinutesBefore} min prior`);
      if (evt.focusOrNotes) lines.push(`  📝 Notes: ${evt.focusOrNotes}`);
      if (evt.result) lines.push(`  🏆 Final: ${evt.result.outcome} (${evt.result.teamScore} - ${evt.result.opponentScore})`);
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Export iCal (.ics) file
  const handleExportICS = () => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mahopac 10U Football//Operations Schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Mahopac 10U Football Schedule',
      'X-WR-TIMEZONE:America/New_York',
    ];

    sortedEvents.forEach((evt) => {
      const [y, m, d] = evt.date.split('-');
      const [sh, sm] = evt.startTime.split(':');
      const eh = evt.endTime ? evt.endTime.split(':')[0] : (parseInt(sh, 10) + 2).toString().padStart(2, '0');
      const em = evt.endTime ? evt.endTime.split(':')[1] : sm;

      const dtStart = `${y}${m}${d}T${sh}${sm}00`;
      const dtEnd = `${y}${m}${d}T${eh}${em}00`;

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:evt_${evt.id}@mahopacfootball.org`);
      icsContent.push(`DTSTAMP:${y}${m}${d}T000000Z`);
      icsContent.push(`DTSTART:${dtStart}`);
      icsContent.push(`DTEND:${dtEnd}`);
      icsContent.push(`SUMMARY:Mahopac 10U - ${evt.title}`);
      icsContent.push(`LOCATION:${evt.location}`);
      icsContent.push(
        `DESCRIPTION:Week: ${getWeekName(evt.week)}\\nUniform: ${evt.uniform || 'TBD'}\\nNotes: ${evt.focusOrNotes || 'None'}`
      );
      icsContent.push('STATUS:CONFIRMED');
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Mahopac_10U_Season_Schedule_2026.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Month Calendar Days Generator
  const monthCalendarData = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: {
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      events: ScheduleEvent[];
    }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dayNum: dNum,
        dateStr,
        isCurrentMonth: false,
        events: sortedEvents.filter((e) => e.date === dateStr),
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        events: sortedEvents.filter((e) => e.date === dateStr),
      });
    }

    // Next month padding to fill 35 or 42 grid slots
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let n = 1; n <= remaining; n++) {
      const nextM = month === 11 ? 1 : month + 2;
      const nextY = month === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      days.push({
        dayNum: n,
        dateStr,
        isCurrentMonth: false,
        events: sortedEvents.filter((e) => e.date === dateStr),
      });
    }

    return days;
  }, [currentMonthDate, sortedEvents]);

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto">
      {/* Top Banner Toolbar */}
      <div className="bg-slate-850/95 backdrop-blur-md p-4 md:p-5 rounded-3xl border border-slate-750/90 shadow-xl print:hidden flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Season Overview */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-300 flex items-center justify-center font-black shadow-inner shrink-0">
              <CalendarIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-base md:text-lg text-slate-100 tracking-tight">
                  {activeTeam ? activeTeam.name : 'Mahopac Football'} Schedule
                </h2>
                {stats.record && (
                  <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black rounded-lg">
                    {stats.record}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold rounded-lg">
                  {stats.totalGames} Games &bull; {stats.totalPractices} Practices
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Manage games, practices, and automatic syncing across weekly playbooks
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap relative">
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => setIsAddGameModalOpen(true)}
                  className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl border border-amber-400/80 shadow-md shadow-amber-400/10 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                  <span>+ Game</span>
                </button>

                <button
                  onClick={() => setIsAddPracticeModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl border border-indigo-500/80 shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-white stroke-[3]" />
                  <span>+ Practice</span>
                </button>

                <button
                  onClick={() => {
                    const upcomingGame = safeScheduleEvents.find(
                      (e) => (e.type === 'game' || e.type === 'tournament' || e.type === 'scrimmage') && !e.isCancelled
                    );
                    if (upcomingGame) {
                      setPreGameTargetGameId(upcomingGame.id);
                    }
                    setIsCreatePreGameModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl border border-purple-500/80 shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Create Pre-Game Practice Plan for an upcoming game"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-purple-200 stroke-[2.5]" />
                  <span>+ Pre-Game Plan</span>
                </button>

                <button
                  onClick={() => setIsTeamSnapSyncOpen(true)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-orange-300 hover:text-orange-200 font-bold text-xs rounded-xl border border-orange-500/40 hover:border-orange-400 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Sync and import new practices & games from TeamSnap"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
                  <span>Sync TeamSnap</span>
                </button>

                {/* Consolidated Tools & Sync Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsToolsDropdownOpen(!isToolsDropdownOpen)}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      isToolsDropdownOpen
                        ? 'bg-slate-700 text-white border-slate-500 ring-2 ring-indigo-500/30'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
                    }`}
                    title="Schedule tools, sync and exports"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tools &amp; Sync</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isToolsDropdownOpen ? 'rotate-180 text-amber-300' : 'text-slate-400'}`} />
                  </button>

                  {isToolsDropdownOpen && (
                    <>
                      {/* Click outside backdrop */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsToolsDropdownOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-800 mb-1">
                          Schedule Tools &amp; Actions
                        </div>

                        <button
                          onClick={() => {
                            setIsToolsDropdownOpen(false);
                            setIsCadenceWizardOpen(true);
                          }}
                          className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-200 hover:text-amber-300 hover:bg-slate-800/80 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <div>
                            <div>Practice Wizard</div>
                            <div className="text-[10px] text-slate-400 font-normal">Generate recurring Tue/Thu schedule</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setIsToolsDropdownOpen(false);
                            setIsTeamSnapSyncOpen(true);
                          }}
                          className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-200 hover:text-orange-300 hover:bg-slate-800/80 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
                            <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
                          </div>
                          <div>
                            <div>Sync TeamSnap</div>
                            <div className="text-[10px] text-slate-400 font-normal">Import via iCal link, CSV, or text</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setIsToolsDropdownOpen(false);
                            handleExportICS();
                          }}
                          className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-200 hover:text-indigo-300 hover:bg-slate-800/80 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                          </div>
                          <div>
                            <div>Export iCal (.ics)</div>
                            <div className="text-[10px] text-slate-400 font-normal">Sync with Apple/Google Calendar</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setIsToolsDropdownOpen(false);
                            handleCopySchedule();
                          }}
                          className="w-full px-2.5 py-2 text-left text-xs font-bold text-slate-200 hover:text-emerald-300 hover:bg-slate-800/80 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer"
                        >
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <div>
                            <div>{copied ? 'Copied to Clipboard!' : 'Copy Schedule Text'}</div>
                            <div className="text-[10px] text-slate-400 font-normal">Formatted for email or team text</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {userRole !== 'admin' && (
              <>
                <button
                  onClick={handleExportICS}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Download iCal (.ics) file"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-300" />
                  <span>iCal</span>
                </button>

                <button
                  onClick={handleCopySchedule}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Copy schedule text"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-300" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </>
            )}

            <button
              onClick={() => triggerPrint()}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Print Schedule"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* View Switcher, Filter Pills & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-750/70 text-xs">
          {/* View Modes */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-750 shrink-0">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          {/* Event Type Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'game', label: '🏈 Games' },
                { id: 'pregame', label: '⚡ Pre-Game Plans' },
                { id: 'practice', label: '📋 Practices' },
                { id: 'scrimmage', label: '⚔️ Scrimmages' },
              ] as { id: FilterType; label: string }[]
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setTypeFilter(filter.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  typeFilter === filter.id
                    ? 'bg-amber-400 text-slate-950 border-amber-400 font-black shadow-xs'
                    : 'bg-slate-900/70 text-slate-300 border-slate-750 hover:border-slate-600 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Week Filter & Search Box */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={weekFilter}
                onChange={(e) => setWeekFilter(e.target.value)}
                className="bg-slate-900 text-slate-200 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-slate-750 focus:outline-none focus:border-amber-400 shrink-0 cursor-pointer"
              >
                <option value="all">All Weeks</option>
                {(() => {
                  const allWeeks = getSeasonWeekList(seasonConfig);
                  const preWeeks = allWeeks.filter((w) => w.phase === 'preseason');
                  const regWeeks = allWeeks.filter((w) => w.phase === 'regular');
                  const postWeeks = allWeeks.filter((w) => w.phase === 'postseason');
                  const customWeeks = allWeeks.filter((w) => w.phase === 'custom');

                  return (
                    <>
                      {preWeeks.length > 0 && (
                        <optgroup label="⚡ Pre-Season Weeks">
                          {preWeeks.map((w) => (
                            <option key={w.key} value={w.key}>
                              {w.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {regWeeks.length > 0 && (
                        <optgroup label="🏈 Regular Season Weeks">
                          {regWeeks.map((w) => (
                            <option key={w.key} value={w.key}>
                              {w.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {postWeeks.length > 0 && (
                        <optgroup label="🏆 Post-Season / Playoffs">
                          {postWeeks.map((w) => (
                            <option key={w.key} value={w.key}>
                              {w.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {customWeeks.length > 0 && (
                        <optgroup label="📌 Special Weeks">
                          {customWeeks.map((w) => (
                            <option key={w.key} value={w.key}>
                              {w.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  );
                })()}
              </select>

              {userRole === 'admin' && onOpenSeasonConfigModal && (
                <button
                  type="button"
                  onClick={onOpenSeasonConfigModal}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-750 rounded-xl transition-all cursor-pointer"
                  title="Customize Season Weeks"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative flex-1 min-w-[120px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search schedule..."
                className="w-full bg-slate-900 text-slate-100 font-medium text-xs pl-7 pr-3 py-1.5 rounded-xl border border-slate-750 focus:outline-none focus:border-amber-400"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-200 text-xs font-bold"
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Next Upcoming Event Spotlight Banner */}
      {nextEvent && (
        <div className="bg-gradient-to-r from-amber-500/15 via-slate-800/90 to-indigo-900/30 p-4 rounded-3xl border border-amber-500/30 shadow-lg print:hidden flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md text-lg">
              {nextEvent.type === 'game' || nextEvent.type === 'tournament' ? '🏈' : '📋'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded-md">
                  Next Up • {getWeekName(nextEvent.week)}
                </span>
                <span className="font-extrabold text-sm text-slate-100">{nextEvent.title}</span>
                {nextEvent.locationType && (
                  <span
                    className={`px-1.5 py-0.2 text-[9.5px] font-black uppercase rounded ${
                      nextEvent.locationType === 'home'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {nextEvent.locationType}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                <span className="flex items-center gap-1 font-bold text-amber-300">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {formatDateDisplay(nextEvent.date)} @ {formatTimeDisplay(nextEvent.startTime)}
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {nextEvent.location}
                </span>
                {nextEvent.uniform && (
                  <span className="flex items-center gap-1 text-slate-300 font-medium">
                    <Shirt className="w-3.5 h-3.5 text-indigo-400" />
                    {nextEvent.uniform}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Navigation for Next Event */}
          <div className="flex items-center gap-2">
            {nextEvent.type === 'game' || nextEvent.type === 'tournament' ? (
              <>
                <button
                  onClick={() => handleOpenPracticeForEvent(nextEvent)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                  title="Open Pre-Game Practice Plan"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Pre-Game Plan</span>
                </button>
                <button
                  onClick={() => onNavigateToWeek(nextEvent.week, 'scouting')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Scouting</span>
                </button>
                <button
                  onClick={() => onNavigateToWeek(nextEvent.week, 'wristband')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1 transition-all"
                >
                  <span>Wristband</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleOpenPracticeForEvent(nextEvent)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Open Practice Plan</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEW 1: WEEKLY AGENDA / TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className="space-y-4 print:hidden">
          {Object.keys(eventsByWeek).length === 0 ? (
            <div className="bg-slate-800/90 rounded-3xl border border-slate-700/80 p-12 text-center text-slate-400">
              <CalendarIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="font-bold text-base text-slate-200">No events found</h3>
              <p className="text-xs text-slate-400 mt-1">
                Try adjusting your filters or click "+ Add Game" / "+ Add Practice" above.
              </p>
            </div>
          ) : (
            <>
              {/* Timeline Week Visibility Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 px-4 rounded-2xl border border-slate-700/60 text-xs shadow-md">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-300">Default View:</span>
                  <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg font-black text-xs flex items-center gap-1.5">
                    <span>🎯 {getWeekName(currentWeek)} Active</span>
                  </span>
                  <span className="text-slate-400 hidden sm:inline text-[11px]">
                    (Past &amp; future weeks minimized)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => collapseNonCurrentWeeks(Object.keys(eventsByWeek))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 font-bold transition-all text-xs flex items-center gap-1 shadow-xs"
                    title="Minimize all past and future weeks, keep only current week open"
                  >
                    <span>🎯 Current Week Only</span>
                  </button>
                  <button
                    onClick={() => expandAllWeeks(Object.keys(eventsByWeek))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 font-bold transition-all text-xs"
                    title="Expand all weeks"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={() => minimizeAllWeeks(Object.keys(eventsByWeek))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 font-bold transition-all text-xs"
                    title="Minimize all weeks"
                  >
                    Minimize All
                  </button>
                </div>
              </div>

              {/* Weeks List */}
              <div className="space-y-4">
                {(Object.entries(eventsByWeek) as [string, ScheduleEvent[]][]).map(([weekKey, events]) => {
                  const isExpanded = isWeekExpanded(weekKey);
                  const isCurrent = String(weekKey) === String(currentWeek);
                  const currWkNum = parseInt(currentWeek, 10) || 1;
                  const wkNum = parseInt(weekKey, 10);
                  const isPast = !isNaN(wkNum) && wkNum < currWkNum;
                  const isFuture = !isNaN(wkNum) && wkNum > currWkNum;

                  const weekGames = events.filter((e) => e.type === 'game' || e.type === 'tournament');
                  const weekPractices = events.filter((e) => e.type === 'practice' || e.type === 'walkthrough');
                  const weekScrimmages = events.filter((e) => e.type === 'scrimmage');
                  const mainGame = weekGames[0];
                  const weekOpponent = mainGame?.opponent || weeklyData[weekKey]?.opponent || 'Opponent TBD';

                  return (
                    <div
                      key={weekKey}
                      className={`bg-slate-800/95 backdrop-blur-md rounded-3xl border shadow-xl overflow-hidden transition-all duration-200 ${
                        isCurrent
                          ? 'border-indigo-500/70 ring-1 ring-indigo-500/30'
                          : 'border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      {/* Week Header Banner (Clickable to toggle minimize / expand) */}
                      <div
                        onClick={() => toggleWeekExpanded(weekKey)}
                        className={`px-5 py-3.5 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                          isCurrent
                            ? 'bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 hover:from-indigo-950/80'
                            : 'bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center flex-wrap gap-2.5">
                          <span
                            className={`px-3 py-1 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-xs ${
                              isCurrent ? 'bg-indigo-600' : 'bg-slate-700'
                            }`}
                          >
                            {getWeekName(weekKey)}
                          </span>

                          {/* Status Badge */}
                          {isCurrent && (
                            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                              <span>🎯 Current Week</span>
                            </span>
                          )}
                          {isPast && (
                            <span className="px-2 py-0.5 bg-slate-700/50 text-slate-400 border border-slate-600/40 rounded-lg text-[10.5px] font-bold uppercase tracking-wider">
                              Past Week
                            </span>
                          )}
                          {isFuture && (
                            <span className="px-2 py-0.5 bg-indigo-950/50 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10.5px] font-bold uppercase tracking-wider">
                              Upcoming
                            </span>
                          )}

                          {/* Main Game or Event Summary Preview */}
                          {mainGame ? (
                            <div className="flex items-center flex-wrap gap-2 ml-1">
                              <span className="text-sm font-black text-slate-100">
                                vs {weekOpponent}
                              </span>
                              <span className="text-xs text-slate-400">
                                &bull; {formatDateDisplay(mainGame.date)} @ {formatTimeDisplay(mainGame.startTime)}
                              </span>
                              {mainGame.location && (
                                <span className="text-xs text-slate-400 hidden md:inline">
                                  &bull; 📍 {mainGame.location}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-slate-400 ml-1">
                              {events.length} Scheduled Event{events.length > 1 ? 's' : ''}
                            </span>
                          )}

                          {/* Event counts badge */}
                          <div className="flex items-center gap-1.5 ml-1 text-[11px] text-slate-400">
                            {weekGames.length > 0 && (
                              <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-300 rounded border border-amber-500/20 font-bold">
                                {weekGames.length} Game{weekGames.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {weekPractices.length > 0 && (
                              <span className="px-1.5 py-0.5 bg-indigo-500/15 text-indigo-300 rounded border border-indigo-500/20 font-bold">
                                {weekPractices.length} Practice{weekPractices.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {weekScrimmages.length > 0 && (
                              <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-300 rounded border border-purple-500/20 font-bold">
                                {weekScrimmages.length} Scrimmage{weekScrimmages.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Week-level Quick Translation Links & Collapse Toggle */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToWeek(weekKey, 'scouting');
                            }}
                            className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold rounded-lg border border-slate-700/80 flex items-center gap-1 transition-all cursor-pointer"
                            title="Open weekly scouting report"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-amber-400" />
                            <span>Scouting</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const firstPrac = weekPractices[0];
                              if (firstPrac) {
                                handleOpenPracticeForEvent(firstPrac);
                              } else {
                                onNavigateToWeek(weekKey, 'practice');
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 text-xs font-bold rounded-lg border border-slate-700/80 flex items-center gap-1 transition-all cursor-pointer"
                            title="Open practice plans"
                          >
                            <ClipboardList className="w-3 h-3 text-indigo-400" />
                            <span>Practice</span>
                          </button>

                          {/* Toggle Expand / Minimize Chevron */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWeekExpanded(weekKey);
                            }}
                            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                              isExpanded
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border-indigo-500/30'
                            }`}
                            title={isExpanded ? 'Minimize week' : 'Expand week'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-indigo-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Event Cards Grid for this week (Visible only when expanded) */}
                      {isExpanded && (
                        <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {events.map((evt) => {
                            const isGame = evt.type === 'game' || evt.type === 'tournament';
                            const isScrimmage = evt.type === 'scrimmage';
                            const isPractice = evt.type === 'practice' || evt.type === 'walkthrough';
                            const linkedPlan = getLinkedPracticePlan(evt);

                            return (
                              <div
                                key={evt.id}
                                className={`rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                                  isGame
                                    ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5 hover:border-amber-400'
                                    : isScrimmage
                                    ? 'bg-slate-900/80 border-purple-500/40 hover:border-purple-400'
                                    : 'bg-slate-900/70 border-slate-700/80 hover:border-slate-600'
                                }`}
                              >
                                <div>
                                  {/* Card Top Pill & Actions */}
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md tracking-wider ${
                                          isGame
                                            ? 'bg-amber-400 text-slate-950 font-black'
                                            : isScrimmage
                                            ? 'bg-purple-600 text-white font-bold'
                                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                        }`}
                                      >
                                        {isGame ? '🏈 GAME' : isScrimmage ? '⚔️ SCRIMMAGE' : '📋 PRACTICE'}
                                      </span>

                                      {isPractice && (
                                        (() => {
                                          const seq = practiceSeqMap[evt.id] || (evt.date ? practiceSeqMap[evt.date] : undefined);
                                          if (evt.isCancelled || seq?.isCancelled) {
                                            return (
                                              <span className="px-1.5 py-0.2 text-[9px] font-black uppercase rounded bg-rose-950 border border-rose-500/50 text-rose-300">
                                                🚫 CANCELLED
                                              </span>
                                            );
                                          }
                                          if (evt.isNonPractice || seq?.isNonPractice) {
                                            return (
                                              <span className="px-1.5 py-0.2 text-[9px] font-black uppercase rounded bg-amber-950 border border-amber-500/50 text-amber-300">
                                                NON-PRACTICE
                                              </span>
                                            );
                                          }
                                          if (seq?.practiceNumber) {
                                            return (
                                              <span className="px-1.5 py-0.2 text-[9px] font-black uppercase rounded bg-indigo-600 text-white shadow-xs">
                                                DAY {seq.practiceNumber}
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()
                                      )}

                                      {evt.locationType && (
                                        <span
                                          className={`px-1.5 py-0.2 text-[9px] font-black uppercase rounded ${
                                            evt.locationType === 'home'
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                          }`}
                                        >
                                          {evt.locationType}
                                        </span>
                                      )}

                                      {evt.result?.outcome && (
                                        <span
                                          className={`px-2 py-0.5 text-[10px] font-black rounded-md ${
                                            evt.result.outcome === 'W'
                                              ? 'bg-emerald-500 text-slate-950'
                                              : evt.result.outcome === 'L'
                                              ? 'bg-rose-500 text-white'
                                              : 'bg-amber-500 text-slate-950'
                                          }`}
                                        >
                                          FINAL: {evt.result.outcome} ({evt.result.teamScore} - {evt.result.opponentScore})
                                        </span>
                                      )}
                                    </div>

                                    {/* Admin Edit / Delete / Result Actions */}
                                    {userRole === 'admin' && (
                                      <div className="flex items-center gap-1 text-slate-400">
                                        {isGame && (
                                          <button
                                            onClick={() => {
                                              setScoreModalEvent(evt);
                                              setTeamScore(evt.result?.teamScore || 0);
                                              setOppScore(evt.result?.opponentScore || 0);
                                              setRecapNotes(evt.result?.recapNotes || '');
                                            }}
                                            className="px-2 py-0.5 hover:text-amber-300 text-[10px] font-bold flex items-center gap-1 bg-slate-800/90 hover:bg-slate-800 rounded-lg border border-slate-700 transition-all cursor-pointer"
                                            title="Record game score"
                                          >
                                            <Trophy className="w-3 h-3 text-amber-400" />
                                            <span>Score</span>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => {
                                            setEditingEvent(evt);
                                          }}
                                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                                          title="Edit event"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm(`Delete "${evt.title}" from schedule?`)) {
                                              onDeleteEvent(evt.id);
                                            }
                                          }}
                                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                                          title="Delete event"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Title & Timing */}
                                  <h4 className="font-extrabold text-sm md:text-base text-slate-100 mb-1">
                                    {(() => {
                                      if (isPractice) {
                                        const seq = practiceSeqMap[evt.id] || (evt.date ? practiceSeqMap[evt.date] : undefined);
                                        if (seq?.formattedTitle) return seq.formattedTitle;
                                      }
                                      return evt.title;
                                    })()}
                                  </h4>

                                  <div className="space-y-1 text-xs text-slate-300">
                                    <div className="flex items-center gap-2 font-bold text-amber-300">
                                      <CalendarIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      <span>
                                        {formatDateDisplay(evt.date)} &bull; {formatTimeDisplay(evt.startTime)}
                                        {evt.endTime ? ` - ${formatTimeDisplay(evt.endTime)}` : ''}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-slate-300">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate">{evt.location}</span>
                                    </div>

                                    {evt.arrivalMinutesBefore && (
                                      <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                                        <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        <span>
                                          Arrival:{' '}
                                          <strong className="text-slate-200">
                                            {evt.arrivalMinutesBefore} mins prior
                                          </strong>
                                        </span>
                                      </div>
                                    )}

                                    {evt.uniform && (
                                      <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                                        <Shirt className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>
                                          Uniform: <strong className="text-slate-200">{evt.uniform}</strong>
                                        </span>
                                      </div>
                                    )}

                                    {evt.focusOrNotes && (
                                      <p className="text-[11px] text-slate-400 mt-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800 leading-snug">
                                        {evt.focusOrNotes}
                                      </p>
                                    )}

                                    {/* DEDICATED PRE-GAME PRACTICE PLAN SPOT */}
                                    {isGame && (
                                      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                          <span className="text-[10.5px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                                            <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                                            Pre-Game Practice Plan
                                          </span>
                                          {linkedPlan ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                              Plan Linked
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold text-slate-400">
                                              No plan attached
                                            </span>
                                          )}
                                        </div>

                                        {linkedPlan ? (
                                          <div className="bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl p-2.5 transition-all">
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="min-w-0 flex-1">
                                                <h5 className="font-extrabold text-slate-100 text-xs truncate">
                                                  {linkedPlan.title || 'Pre-Game Warmup & Routine'}
                                                </h5>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10.5px] text-indigo-200/90 font-medium">
                                                  <span>
                                                    {linkedPlan.periods?.length || linkedPlan.plan?.length || 0} Periods
                                                  </span>
                                                  {linkedPlan.startTime && (
                                                    <>
                                                      <span>&bull;</span>
                                                      <span>Warmup: {formatTimeDisplay(linkedPlan.startTime)}{linkedPlan.endTime ? ` - ${formatTimeDisplay(linkedPlan.endTime)}` : ''}</span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                              {userRole === 'admin' && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setLinkingPreGameEvent(evt);
                                                  }}
                                                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-indigo-900/50 rounded-lg transition-colors cursor-pointer"
                                                  title="Edit pre-game plan link"
                                                >
                                                  <Edit2 className="w-3 h-3" />
                                                </button>
                                              )}
                                            </div>

                                            <button
                                              onClick={() => handleOpenPracticeForEvent(evt)}
                                              className="w-full mt-2 py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                            >
                                              <ClipboardList className="w-3.5 h-3.5" />
                                              <span>Open Pre-Game Plan</span>
                                              <ArrowRight className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="bg-slate-900/60 border border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-2.5 text-center transition-all">
                                            <p className="text-[11px] text-slate-400 mb-2">
                                              Create or attach a pre-game warmup routine for this game
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                onClick={() => handleQuickCreatePreGamePlan(evt, 'Pre-Game Warmup & Routine')}
                                                className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] rounded-lg shadow-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                                              >
                                                <Plus className="w-3 h-3" />
                                                <span>+ Add Pre-Game Plan</span>
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setLinkingPreGameEvent(evt);
                                                }}
                                                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] rounded-lg border border-slate-700 transition-colors cursor-pointer"
                                                title="Link existing practice plan"
                                              >
                                                Link...
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Direct Action Jumpers (Translate directly to Scouting / Practice Plan) */}
                                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                                  {isGame ? (
                                    <>
                                      <button
                                        onClick={() => handleOpenPracticeForEvent(evt, 'Pre-Game Warmup & Routine')}
                                        className="flex-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                        title="Open or Create Pre-Game Practice Plan"
                                      >
                                        <ClipboardList className="w-3.5 h-3.5 text-purple-200" />
                                        <span>
                                          {linkedPlan
                                            ? `Pre-Game Plan (${linkedPlan.periods?.length || linkedPlan.plan?.length || 0} Periods)`
                                            : '⚡ Create Pre-Game Plan'}
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => onNavigateToWeek(evt.week, 'game_day')}
                                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1 transition-all cursor-pointer"
                                        title="Open Game Day Hub"
                                      >
                                        <span>Game Day</span>
                                      </button>
                                      <button
                                        onClick={() => onNavigateToWeek(evt.week, 'scouting')}
                                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                      >
                                        <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                                        <span>Scouting</span>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleOpenPracticeForEvent(evt)}
                                        className="flex-1 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                                      >
                                        <ClipboardList className="w-3.5 h-3.5" />
                                        <span>
                                          {linkedPlan
                                            ? `Open Practice Plan (${linkedPlan.plan?.length || 0} Periods)`
                                            : 'Create & Open Practice Plan'}
                                        </span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 2: INTERACTIVE MONTH CALENDAR VIEW */}
      {viewMode === 'month' && (
        <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 p-4 md:p-6 shadow-xl print:hidden space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg md:text-xl text-slate-100">
                {currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold rounded-lg">
                Fall 2026 Season
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const prev = new Date(currentMonthDate);
                  prev.setMonth(prev.getMonth() - 1);
                  setCurrentMonthDate(prev);
                }}
                className="p-2 bg-slate-900 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentMonthDate(new Date(2026, 8, 1))}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-xs font-bold text-amber-300 rounded-xl border border-slate-700 transition-all"
              >
                Season Start (Sep 2026)
              </button>
              <button
                onClick={() => {
                  const next = new Date(currentMonthDate);
                  next.setMonth(next.getMonth() + 1);
                  setCurrentMonthDate(next);
                }}
                className="p-2 bg-slate-900 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Day Labels */}
          <div className="grid grid-cols-7 gap-1 text-center font-black text-xs uppercase tracking-wider text-slate-400 py-1">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span className="text-amber-400">Sat (Game Day)</span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {monthCalendarData.map((cell, idx) => {
              const cellEvents = Array.isArray(cell?.events) ? cell.events : [];
              const hasEvents = cellEvents.length > 0;
              const hasGame = cellEvents.some((e) => e.type === 'game' || e.type === 'tournament');

              return (
                <div
                  key={idx}
                  className={`min-h-[110px] md:min-h-[125px] p-1.5 md:p-2 rounded-2xl border flex flex-col justify-between transition-all ${
                    cell.isCurrentMonth
                      ? hasGame
                        ? 'bg-slate-900/90 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                        : hasEvents
                        ? 'bg-slate-900/80 border-slate-700 hover:border-slate-600'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60'
                      : 'bg-slate-950/30 border-slate-850 opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                        cell.isCurrentMonth
                          ? hasGame
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {hasEvents && (
                      <span className="text-[10px] text-slate-400 font-bold">
                        {cellEvents.length} {cellEvents.length === 1 ? 'evt' : 'evts'}
                      </span>
                    )}
                  </div>

                  {/* Day Events Badges */}
                  <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
                    {cellEvents.map((evt) => {
                      const isGame = evt.type === 'game' || evt.type === 'tournament';
                      const isScrimmage = evt.type === 'scrimmage';

                      return (
                        <div
                          key={evt.id}
                          onClick={() => {
                            if (isGame) {
                              onNavigateToWeek(evt.week, 'scouting');
                            } else {
                              handleOpenPracticeForEvent(evt);
                            }
                          }}
                          className={`px-1.5 py-1 rounded-lg text-[10px] font-bold truncate cursor-pointer transition-transform active:scale-95 flex items-center justify-between gap-1 ${
                            isGame
                              ? 'bg-amber-400 text-slate-950 font-black hover:bg-amber-300'
                              : isScrimmage
                              ? 'bg-purple-600 text-white hover:bg-purple-500'
                              : 'bg-indigo-900/70 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-800'
                          }`}
                          title={`${evt.title} (${formatTimeDisplay(evt.startTime)}) - Click to open details`}
                        >
                          <span className="truncate">
                            {formatTimeDisplay(evt.startTime)} &bull;{' '}
                            {(() => {
                              const isPractice = evt.type === 'practice' || evt.type === 'walkthrough';
                              if (isPractice) {
                                const seq = practiceSeqMap[evt.id] || (evt.date ? practiceSeqMap[evt.date] : undefined);
                                if (seq?.formattedTitle) return seq.formattedTitle;
                              }
                              return evt.title;
                            })()}
                          </span>
                          {isGame && <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-80" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: SEASON TABLE / GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl overflow-hidden print:hidden">
          <div className="p-4 border-b border-slate-700/80 flex items-center justify-between">
            <h3 className="font-black text-base text-slate-100">
              Season Master Schedule Table ({filteredEvents.length} Events)
            </h3>
            <span className="text-xs text-slate-400">Click any row to open details</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-700">
                <tr>
                  <th className="p-3">Week</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Date &amp; Time</th>
                  <th className="p-3">Title / Opponent</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Uniform</th>
                  <th className="p-3">Result / Plan</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200 font-medium">
                {filteredEvents.map((evt) => {
                  const isGame = evt.type === 'game' || evt.type === 'tournament';
                  const linkedPlan = getLinkedPracticePlan(evt);

                  return (
                    <tr
                      key={evt.id}
                      className="hover:bg-slate-750/50 transition-colors"
                    >
                      <td className="p-3 font-bold text-amber-300 whitespace-nowrap">
                        {getWeekName(evt.week)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                            isGame
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : evt.type === 'scrimmage'
                              ? 'bg-purple-600 text-white'
                              : evt.isCancelled
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                              : evt.isNonPractice
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {(() => {
                            if (evt.isCancelled) return '🚫 Cancelled';
                            if (evt.isNonPractice) return 'Non-Practice';
                            const isPractice = evt.type === 'practice' || evt.type === 'walkthrough';
                            if (isPractice) {
                              const seq = practiceSeqMap[evt.id] || (evt.date ? practiceSeqMap[evt.date] : undefined);
                              if (seq?.practiceNumber) return `Day ${seq.practiceNumber}`;
                            }
                            return evt.type;
                          })()}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-100">{formatDateDisplay(evt.date)}</div>
                        <div className="text-[11px] text-slate-400">{formatTimeDisplay(evt.startTime)}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-extrabold text-slate-100">
                          {(() => {
                            const isPractice = evt.type === 'practice' || evt.type === 'walkthrough';
                            if (isPractice) {
                              const seq = practiceSeqMap[evt.id] || (evt.date ? practiceSeqMap[evt.date] : undefined);
                              if (seq?.formattedTitle) return seq.formattedTitle;
                            }
                            return evt.title;
                          })()}
                        </div>
                        {evt.focusOrNotes && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{evt.focusOrNotes}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-300 truncate max-w-xs">
                        {evt.location}
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {evt.uniform || '—'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {isGame ? (
                          <div className="space-y-1">
                            {evt.result?.outcome ? (
                              <span
                                className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                  evt.result.outcome === 'W'
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-rose-500 text-white'
                                }`}
                              >
                                {evt.result.outcome} {evt.result.teamScore} - {evt.result.opponentScore}
                              </span>
                            ) : (
                              <div className="text-slate-400 text-[10.5px]">Upcoming Game</div>
                            )}
                            {linkedPlan ? (
                              <div className="text-indigo-300 text-[10.5px] font-bold flex items-center gap-1">
                                <ClipboardList className="w-3 h-3 text-indigo-400" />
                                <span>Pre-Game Plan ({linkedPlan.periods?.length || linkedPlan.plan?.length || 0} per)</span>
                              </div>
                            ) : (
                              <div className="text-slate-500 text-[10px] italic">No pre-game plan</div>
                            )}
                          </div>
                        ) : linkedPlan ? (
                          <span className="text-indigo-300 text-[11px] font-bold flex items-center gap-1">
                            <ClipboardList className="w-3 h-3 text-indigo-400" />
                            <span>Plan ({linkedPlan.periods?.length || linkedPlan.plan?.length || 0} periods)</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No plan yet</span>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isGame ? (
                            <>
                              <button
                                onClick={() => handleOpenPracticeForEvent(evt, 'Pre-Game Warmup & Routine')}
                                className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-lg flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                                title="Open or Create Pre-Game Practice Plan"
                              >
                                <ClipboardList className="w-3 h-3 text-purple-200" />
                                <span>{linkedPlan ? 'Pre-Game Plan' : '+ Pre-Game Plan'}</span>
                              </button>
                              <button
                                onClick={() => onNavigateToWeek(evt.week, 'game_day')}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg border border-slate-700 transition-all cursor-pointer"
                                title="Open Game Day Hub"
                              >
                                Game Day
                              </button>
                              <button
                                onClick={() => onNavigateToWeek(evt.week, 'scouting')}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg border border-slate-700 transition-all cursor-pointer"
                              >
                                Scouting
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenPracticeForEvent(evt)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-lg border border-slate-700 transition-all"
                            >
                              Practice Plan
                            </button>
                          )}

                          {userRole === 'admin' && (
                            <>
                              <button
                                onClick={() => setEditingEvent(evt)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                                title="Edit event"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${evt.title}" from schedule?`)) {
                                    onDeleteEvent(evt.id);
                                  }
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition-colors"
                                title="Delete event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINT ENGINE OUTPUT: Official Printable Mahopac 10U Season Schedule */}
      <div className="hidden print:block bg-white text-black p-4">
        <div className="border-b-2 border-black pb-3 mb-4 text-center">
          <h1 className="font-black text-xl uppercase tracking-tight">
            Mahopac 10U Youth Football &bull; 2026 Official Season Schedule
          </h1>
          <p className="text-xs text-slate-700 font-bold mt-1">
            Official Team Roster &bull; Practice &amp; Game Itinerary
          </p>
        </div>

        <table className="w-full text-left text-[9pt] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-200 border-b border-black font-black uppercase text-[8pt]">
              <th className="p-1.5 border-r border-black">Week</th>
              <th className="p-1.5 border-r border-black">Date &amp; Time</th>
              <th className="p-1.5 border-r border-black">Type</th>
              <th className="p-1.5 border-r border-black">Event / Opponent</th>
              <th className="p-1.5 border-r border-black">Location / Field</th>
              <th className="p-1.5 border-r border-black">Arrival</th>
              <th className="p-1.5">Uniform</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.map((evt, idx) => {
              const isGame = evt.type === 'game' || evt.type === 'tournament';
              return (
                <tr
                  key={evt.id}
                  className={`border-b border-black/60 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                >
                  <td className="p-1.5 border-r border-black font-bold whitespace-nowrap">
                    {getWeekName(evt.week)}
                  </td>
                  <td className="p-1.5 border-r border-black font-bold whitespace-nowrap">
                    {formatDateDisplay(evt.date)} @ {formatTimeDisplay(evt.startTime)}
                  </td>
                  <td className="p-1.5 border-r border-black uppercase font-black text-[7.5pt]">
                    {evt.type}
                  </td>
                  <td className="p-1.5 border-r border-black font-black">
                    {evt.title}
                  </td>
                  <td className="p-1.5 border-r border-black text-[8pt]">
                    {evt.location}
                  </td>
                  <td className="p-1.5 border-r border-black whitespace-nowrap">
                    {evt.arrivalMinutesBefore ? `${evt.arrivalMinutesBefore}m prior` : '—'}
                  </td>
                  <td className="p-1.5 text-[8pt]">
                    {evt.uniform || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: ADD GAME MODAL */}
      {isAddGameModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  🏈
                </div>
                <h3 className="font-black text-lg text-slate-100">Schedule New Game</h3>
              </div>
              <button
                onClick={() => setIsAddGameModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Opponent Name *</label>
                  <input
                    type="text"
                    value={gameOpponent}
                    onChange={(e) => setGameOpponent(e.target.value)}
                    placeholder="e.g. Carmel Rams 10U"
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Week Number *</label>
                  <select
                    value={gameWeek}
                    onChange={(e) => setGameWeek(e.target.value)}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                  >
                    {getSeasonWeekList(seasonConfig).map((w) => (
                      <option key={w.key} value={w.key}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Game Date *</label>
                  <input
                    type="date"
                    value={gameDate}
                    onChange={(e) => setGameDate(e.target.value)}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Kickoff Time *</label>
                  <input
                    type="time"
                    value={gameStartTime}
                    onChange={(e) => setGameStartTime(e.target.value)}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Home / Away</label>
                  <select
                    value={gameLocationType}
                    onChange={(e) =>
                      setGameLocationType(e.target.value as 'home' | 'away' | 'neutral')
                    }
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Location &amp; Stadium Field *</label>
                <input
                  type="text"
                  value={gameLocation}
                  onChange={(e) => setGameLocation(e.target.value)}
                  placeholder="e.g. Mahopac High School - Turf Stadium"
                  className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Uniform Combo</label>
                  <input
                    type="text"
                    value={gameUniform}
                    onChange={(e) => setGameUniform(e.target.value)}
                    placeholder="e.g. Gold Jerseys & White Pants"
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Arrival Prior (Minutes)</label>
                  <input
                    type="number"
                    value={gameArrivalMins}
                    onChange={(e) => setGameArrivalMins(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Gameplan Notes / Reminders</label>
                <textarea
                  value={gameNotes}
                  onChange={(e) => setGameNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Dynamic warmup 60 mins before kickoff. Focus on contain defense."
                  className="w-full bg-slate-900 text-slate-100 font-medium p-2 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 p-2 bg-slate-900/80 rounded-xl border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncScouting}
                  onChange={(e) => setAutoSyncScouting(e.target.checked)}
                  className="rounded text-amber-400"
                />
                <span className="text-slate-300 text-xs font-bold">
                  🔗 Automatically sync to Week {gameWeek} Scouting Report &amp; Gameplan
                </span>
              </label>

              {/* Pre-Game Practice Plan Auto-Creator */}
              <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-700/80 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreatePreGamePlan}
                    onChange={(e) => setAutoCreatePreGamePlan(e.target.checked)}
                    className="rounded text-indigo-500"
                  />
                  <span className="text-slate-200 text-xs font-bold flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                    <span>⚡ Automatically create Pre-Game Practice Plan (Warmup &amp; Routine)</span>
                  </span>
                </label>
                {autoCreatePreGamePlan && (
                  <div className="pl-6 space-y-2 pt-1 border-t border-slate-800/80">
                    <div>
                      <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                        Pre-Game Routine Template:
                      </label>
                      <select
                        value={selectedPreGameTemplate}
                        onChange={(e) => setSelectedPreGameTemplate(e.target.value)}
                        className="w-full bg-slate-800 text-slate-100 text-xs p-2 rounded-xl border border-slate-700 font-bold focus:border-indigo-400 focus:outline-none"
                      >
                        <option value="Pre-Game Warmup & Routine">
                          ⚡ Pre-Game Warmup &amp; Routine (Dynamic, Air Mesh, Defense Shuck, ST Review)
                        </option>
                        <option value="Walkthrough / Light">
                          🚶 Walkthrough / Light (Chalk Talk, Air Mesh, Defensive Fits)
                        </option>
                        <option value="Standard Practice">
                          📋 Standard Practice Template
                        </option>
                      </select>
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                      Creates a tailored practice plan scheduled {gameArrivalMins}m prior to kickoff ({gameStartTime}) at {gameLocation || 'the stadium'}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                onClick={() => setIsAddGameModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGame}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md"
              >
                Save Game to Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD PRACTICE MODAL */}
      {isAddPracticeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  📋
                </div>
                <h3 className="font-black text-lg text-slate-100">Schedule Practice</h3>
              </div>
              <button
                onClick={() => setIsAddPracticeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Practice Title *</label>
                <input
                  type="text"
                  value={practiceTitle}
                  onChange={(e) => setPracticeTitle(e.target.value)}
                  placeholder="e.g. Week 1 - Tuesday Inside Run & Full Pads"
                  className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Week Folder *</label>
                  <select
                    value={practiceWeek}
                    onChange={(e) => setPracticeWeek(e.target.value)}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-indigo-400 focus:outline-none"
                  >
                    {getSeasonWeekList(seasonConfig).map((w) => (
                      <option key={w.key} value={w.key}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Date *</label>
                  <input
                    type="date"
                    value={practiceDate}
                    onChange={(e) => setPracticeDate(e.target.value)}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-indigo-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Time (Start - End)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={practiceStartTime}
                      onChange={(e) => setPracticeStartTime(e.target.value)}
                      className="w-1/2 bg-slate-900 text-slate-100 font-bold p-1.5 rounded-lg border border-slate-700 text-xs"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="time"
                      value={practiceEndTime}
                      onChange={(e) => setPracticeEndTime(e.target.value)}
                      className="w-1/2 bg-slate-900 text-slate-100 font-bold p-1.5 rounded-lg border border-slate-700 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Field Location</label>
                <input
                  type="text"
                  value={practiceLocation}
                  onChange={(e) => setPracticeLocation(e.target.value)}
                  placeholder="e.g. Crane Road"
                  className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Primary Focus / Goals</label>
                <textarea
                  value={practiceFocus}
                  onChange={(e) => setPracticeFocus(e.target.value)}
                  rows={2}
                  placeholder="e.g. Tackle circuit, 24 dive execution, secondary cover 3 rotation."
                  className="w-full bg-slate-900 text-slate-100 font-medium p-2 rounded-xl border border-slate-700 focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreatePlan}
                    onChange={(e) => setAutoCreatePlan(e.target.checked)}
                    className="rounded text-indigo-500"
                  />
                  <span className="text-slate-200 text-xs font-bold">
                    📝 Automatically generate structured Practice Plan in Practice Generator
                  </span>
                </label>

                {autoCreatePlan && (
                  <div className="pl-6">
                    <label className="block text-[11px] text-slate-400 mb-1">Initial Template:</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full bg-slate-800 text-slate-100 text-xs p-1.5 rounded-lg border border-slate-600"
                    >
                      <option value="Offense & Defense Full Practice">
                        Full Practice (Dynamic Warmup, Indy, Inside Run, Team Scrimmage)
                      </option>
                      <option value="Pre-Game Walkthrough">
                        Pre-Game Walkthrough (Shells, Signals, Special Teams)
                      </option>
                    </select>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={practiceIsNonPractice}
                    onChange={(e) => setPracticeIsNonPractice(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <div>
                    <span className="text-slate-200 text-xs font-bold">
                      Label as Non-Practice Event
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Excludes this session from the cumulative season practice day count (e.g. equipment pickup, team meeting, orientation).
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                onClick={() => setIsAddPracticeModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePractice}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md"
              >
                Save Practice to Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PRE-GAME PRACTICE PLAN */}
      {isCreatePreGameModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center font-black">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-100">
                    Create Pre-Game Practice Plan
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Generate an official pre-game warmup &amp; routine tailored for game day
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreatePreGameModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                  Target Scheduled Game
                </label>
                <select
                  value={preGameTargetGameId}
                  onChange={(e) => setPreGameTargetGameId(e.target.value)}
                  className="w-full bg-slate-900 text-slate-100 font-bold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-400"
                >
                  <option value="">-- Choose a Game from Schedule --</option>
                  {safeScheduleEvents
                    .filter((e) => (e.type === 'game' || e.type === 'tournament' || e.type === 'scrimmage') && !e.isCancelled)
                    .map((game) => {
                      const hasPlan = Boolean(game.preGamePlanId || game.linkedPracticePlanId);
                      return (
                        <option key={game.id} value={game.id}>
                          Week {game.week}: {game.title} &bull; {game.date} ({game.startTime || 'TBD'}) {hasPlan ? '✓ (Plan Attached)' : ''}
                        </option>
                      );
                    })}
                </select>
                {safeScheduleEvents.filter((e) => e.type === 'game' || e.type === 'tournament' || e.type === 'scrimmage').length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    No games found on the schedule. Create a game first or generate plans for upcoming dates.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-black text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                  Pre-Game Warmup Template
                </label>
                <select
                  value={preGameCustomTemplate}
                  onChange={(e) => setPreGameCustomTemplate(e.target.value)}
                  className="w-full bg-slate-900 text-slate-100 font-bold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-400"
                >
                  <option value="Pre-Game Warmup & Routine">
                    Pre-Game Warmup &amp; Routine (Dynamic Stretch, Indy Circuits, Team Scripts, Speeches)
                  </option>
                  <option value="Pre-Game Walkthrough">
                    Pre-Game Walkthrough (Shells, Signals, Redzone &amp; Special Teams)
                  </option>
                  <option value="Offense & Defense Full Practice">
                    Standard Practice (Inside Run, Perimeter, Scrimmage)
                  </option>
                </select>
              </div>

              <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-xl space-y-1.5 text-purple-200 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-purple-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  What happens when you create:
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-purple-200/80">
                  <li>Calculates arrival countdown (e.g. 60 min before kickoff)</li>
                  <li>Adds structured periods: dynamic stretch, offensive line drive, DB/WR routes, team script</li>
                  <li>Links directly into your Practice Generator and the Game Day Hub</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                onClick={() => setIsCreatePreGameModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetGame = safeScheduleEvents.find((e) => e.id === preGameTargetGameId);
                  if (!targetGame) {
                    alert('Please select a game from your schedule.');
                    return;
                  }
                  handleQuickCreatePreGamePlan(targetGame, preGameCustomTemplate);
                  setIsCreatePreGameModalOpen(false);
                }}
                disabled={!preGameTargetGameId}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create &amp; Open Plan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CADENCE WIZARD (RECURRING PRACTICES & MULTI-WEEK WIZARD) */}
      <PracticeWizardModal
        isOpen={isCadenceWizardOpen}
        onClose={() => setIsCadenceWizardOpen(false)}
        practiceTemplates={practiceTemplates}
        currentWeek={currentWeek}
        onGenerate={(result) => {
          if (onPracticeWizardGenerate) {
            onPracticeWizardGenerate(result);
          } else if (onBulkAddEvents) {
            onBulkAddEvents(result.scheduleEvents);
          }
        }}
      />

      {/* MODAL 4: RECORD SCORE / RESULT MODAL */}
      {scoreModalEvent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-base text-slate-100">
                  Record Result for {scoreModalEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setScoreModalEvent(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 p-3 rounded-2xl border border-slate-700 text-center">
                  <span className="block font-black text-amber-400 text-xs mb-1">MAHOPAC 10U</span>
                  <input
                    type="number"
                    value={teamScore}
                    onChange={(e) => setTeamScore(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-center text-2xl font-black bg-slate-800 text-white rounded-xl py-1 border border-slate-600 focus:outline-none"
                  />
                </div>

                <div className="bg-slate-900 p-3 rounded-2xl border border-slate-700 text-center">
                  <span className="block font-black text-slate-300 text-xs mb-1 truncate">
                    {scoreModalEvent.opponent || 'OPPONENT'}
                  </span>
                  <input
                    type="number"
                    value={oppScore}
                    onChange={(e) => setOppScore(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-center text-2xl font-black bg-slate-800 text-white rounded-xl py-1 border border-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Post-Game Recap / Coaching Takeaways</label>
                <textarea
                  value={recapNotes}
                  onChange={(e) => setRecapNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Great line blocking on 24 dive. Defense held Carmel to 0 redzone conversions."
                  className="w-full bg-slate-900 text-slate-100 font-medium p-2 rounded-xl border border-slate-700 focus:outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                onClick={() => setScoreModalEvent(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResult}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md"
              >
                Save Result &amp; Update Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: EDIT EVENT MODAL */}
      {editingEvent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="font-black text-base text-slate-100">Edit Scheduled Event</h3>
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Event Type Selector */}
              <div>
                <label className="block font-black text-slate-300 uppercase tracking-wider text-[10px] mb-1.5">
                  Event Classification
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {[
                    { type: 'game' as ScheduleEventType, label: 'Game 🎮', color: 'amber' },
                    { type: 'practice' as ScheduleEventType, label: 'Practice 🏈', color: 'indigo' },
                    { type: 'scrimmage' as ScheduleEventType, label: 'Scrimmage ⚔️', color: 'rose' },
                    { type: 'meeting' as ScheduleEventType, label: 'Meeting 📋', color: 'purple' },
                    { type: 'walkthrough' as ScheduleEventType, label: 'Walkthru 🚶', color: 'cyan' },
                  ].map((btn) => {
                    const isSelected = editingEvent.type === btn.type;
                    return (
                      <button
                        key={btn.type}
                        type="button"
                        onClick={() => {
                          const updates: Partial<ScheduleEvent> = { type: btn.type };
                          if (btn.type === 'game' && !editingEvent.opponent) {
                            updates.opponent = editingEvent.title.replace(/^(practice|game)\s*[:-]?\s*/i, '').trim() || 'Opponent';
                            if (!editingEvent.locationType) updates.locationType = 'home';
                          }
                          setEditingEvent({ ...editingEvent, ...updates });
                        }}
                        className={`py-1.5 px-2 rounded-xl font-black text-[11px] border transition-all text-center ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm ring-2 ring-amber-400/20'
                            : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title & Week */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-300 mb-1">Event Title</label>
                  <input
                    type="text"
                    value={editingEvent.title}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Season Week</label>
                  <select
                    value={editingEvent.week}
                    onChange={(e) => setEditingEvent({ ...editingEvent, week: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                  >
                    {getSeasonWeekList(seasonConfig).map((w) => (
                      <option key={w.key} value={w.key}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Opponent & Location Type if Game or Scrimmage */}
              {(editingEvent.type === 'game' || editingEvent.type === 'scrimmage') && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-900/60 rounded-2xl border border-slate-700/60">
                  <div className="col-span-2">
                    <label className="block font-bold text-amber-300 mb-1">Opponent Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Carmel Rams 10U"
                      value={editingEvent.opponent || ''}
                      onChange={(e) =>
                        setEditingEvent({
                          ...editingEvent,
                          opponent: e.target.value,
                        })
                      }
                      className="w-full bg-slate-950 text-amber-200 font-black p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Venue</label>
                    <select
                      value={editingEvent.locationType || 'home'}
                      onChange={(e) =>
                        setEditingEvent({
                          ...editingEvent,
                          locationType: e.target.value as 'home' | 'away' | 'neutral',
                        })
                      }
                      className="w-full bg-slate-950 text-slate-200 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                    >
                      <option value="home">Home 🏠</option>
                      <option value="away">Away 🚌</option>
                      <option value="neutral">Neutral 🏟️</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Date & Start/End Time */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={editingEvent.date}
                    onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={editingEvent.startTime}
                    onChange={(e) => setEditingEvent({ ...editingEvent, startTime: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">End Time</label>
                  <input
                    type="time"
                    value={editingEvent.endTime || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, endTime: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Location & Uniform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Location / Field</label>
                  <input
                    type="text"
                    value={editingEvent.location}
                    onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Uniform / Attire</label>
                  <input
                    type="text"
                    placeholder="e.g. Gold Home Jerseys"
                    value={editingEvent.uniform || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, uniform: e.target.value })}
                    className="w-full bg-slate-900 text-slate-100 font-medium p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Arrival Time */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">Arrival Minutes Before Event</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="180"
                    step="5"
                    value={editingEvent.arrivalMinutesBefore || 15}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        arrivalMinutesBefore: parseInt(e.target.value, 10) || 15,
                      })
                    }
                    className="w-24 bg-slate-900 text-slate-100 font-black p-2 rounded-xl border border-slate-700 text-center focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-slate-400 text-xs font-medium">
                    minutes before scheduled kickoff/start time
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Focus / Notes</label>
                <textarea
                  value={editingEvent.focusOrNotes || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, focusOrNotes: e.target.value })}
                  rows={2}
                  placeholder="e.g. Bring extra water, install redzone packages."
                  className="w-full bg-slate-900 text-slate-100 font-medium p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Linked Practice / Pre-Game Plan Spot */}
              <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {editingEvent.type === 'game' || editingEvent.type === 'scrimmage'
                        ? 'Pre-Game Practice Plan & Warmup'
                        : 'Linked Practice Plan'}
                    </span>
                  </label>
                  {editingEvent.preGamePlanId || editingEvent.linkedPracticePlanId ? (
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      Plan Linked
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">None Attached</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={editingEvent.preGamePlanId || editingEvent.linkedPracticePlanId || ''}
                    onChange={(e) => {
                      const val = e.target.value || undefined;
                      setEditingEvent({
                        ...editingEvent,
                        linkedPracticePlanId: val,
                        preGamePlanId: val,
                      });
                    }}
                    className="flex-1 bg-slate-950 text-slate-100 text-xs font-semibold p-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- No Practice Plan Attached --</option>
                    {practicePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.title || 'Untitled Plan'} ({plan.weekFolder || 'No Week'} &bull; {plan.date || 'No Date'})
                      </option>
                    ))}
                  </select>

                  {(editingEvent.type === 'game' || editingEvent.type === 'scrimmage') &&
                    !editingEvent.preGamePlanId &&
                    !editingEvent.linkedPracticePlanId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onSyncPracticeToPlan) {
                            const planId = onSyncPracticeToPlan(editingEvent, 'Pre-Game Warmup & Routine');
                            setEditingEvent({
                              ...editingEvent,
                              linkedPracticePlanId: planId,
                              preGamePlanId: planId,
                            });
                          }
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
                        title="Create matching pre-game warmup plan now"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Warmup</span>
                      </button>
                    )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/80 rounded-xl border border-slate-700">
                <div>
                  <div className="text-xs font-bold text-slate-200">Event Cancellation Status</div>
                  <div className="text-[11px] text-slate-400">Cancelled practices are excluded from practice day counts</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEvent({ ...editingEvent, isCancelled: !editingEvent.isCancelled })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                    editingEvent.isCancelled
                      ? 'bg-rose-950 border-rose-500/60 text-rose-300'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white'
                  }`}
                >
                  {editingEvent.isCancelled ? '🚫 CANCELLED' : 'Active Event'}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/80 rounded-xl border border-slate-700">
                <div>
                  <div className="text-xs font-bold text-slate-200">Practice Total Count</div>
                  <div className="text-[11px] text-slate-400">Label as non-practice so it doesn't count towards the cumulative season total</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEvent({ ...editingEvent, isNonPractice: !editingEvent.isNonPractice })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                    editingEvent.isNonPractice
                      ? 'bg-amber-950 border-amber-500/60 text-amber-300'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white'
                  }`}
                >
                  {editingEvent.isNonPractice ? '📋 NON-PRACTICE (EXCLUDED)' : 'Counts as Practice'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                onClick={() => setEditingEvent(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdateEvent(editingEvent.id, editingEvent);
                  setEditingEvent(null);
                }}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Pre-Game Practice Plan Modal */}
      {linkingPreGameEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-100 text-base">Pre-Game Practice Plan Link</h3>
                  <p className="text-xs text-slate-400">
                    {linkingPreGameEvent.title} &bull; {formatDateDisplay(linkingPreGameEvent.date)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLinkingPreGameEvent(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Select Existing Practice Plan to Attach:
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {practicePlans && practicePlans.length > 0 ? (
                    practicePlans.map((plan) => {
                      const isCurrentlyLinked =
                        linkingPreGameEvent.preGamePlanId === plan.id ||
                        linkingPreGameEvent.linkedPracticePlanId === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => handleLinkPlanToEvent(linkingPreGameEvent.id, plan.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isCurrentlyLinked
                              ? 'bg-indigo-950/60 border-indigo-400 ring-2 ring-indigo-500/30'
                              : 'bg-slate-900/60 border-slate-700/80 hover:border-indigo-500/50 hover:bg-slate-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-slate-100 truncate">
                              {plan.title || 'Untitled Practice Plan'}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{plan.weekFolder || 'Week Plan'}</span>
                              <span>&bull;</span>
                              <span>{plan.date ? formatDateDisplay(plan.date) : 'No Date'}</span>
                              <span>&bull;</span>
                              <span className="text-indigo-300 font-bold">
                                {plan.periods?.length || plan.plan?.length || 0} Periods
                              </span>
                            </div>
                          </div>
                          {isCurrentlyLinked ? (
                            <span className="px-2.5 py-1 bg-indigo-600 text-white font-black text-xs rounded-xl shrink-0">
                              Current Link
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-800 text-indigo-300 font-bold text-xs rounded-xl border border-slate-700 shrink-0">
                              Link Plan
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No practice plans found. Create one below!
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700 flex items-center justify-between gap-2">
                {linkingPreGameEvent.preGamePlanId || linkingPreGameEvent.linkedPracticePlanId ? (
                  <button
                    onClick={() => handleUnlinkPlanFromEvent(linkingPreGameEvent.id)}
                    className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Unlink Current Plan</span>
                  </button>
                ) : (
                  <div />
                )}

                <button
                  onClick={() =>
                    handleQuickCreatePreGamePlan(linkingPreGameEvent, 'Pre-Game Warmup & Routine')
                  }
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Fresh Warmup Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TeamSnap Sync Modal */}
      {isTeamSnapSyncOpen && (
        <TeamSnapSyncModal
          isOpen={isTeamSnapSyncOpen}
          onClose={() => setIsTeamSnapSyncOpen(false)}
          activeTeam={activeTeam || { id: 'team-10u', name: '10U Youth Tackle', ageGroup: '10U', color: 'amber' }}
          existingEvents={safeScheduleEvents}
          onUpdateTeamCalendarUrl={(tId, url) => {
            if (onUpdateTeam) onUpdateTeam(tId, { calendarUrl: url });
          }}
          onImportEvents={(newEvts, replaceExisting) => {
            if (onImportTeamSnapEvents) {
              onImportTeamSnapEvents(newEvts, replaceExisting);
            } else if (onBulkAddEvents) {
              onBulkAddEvents(newEvts);
            }
            setIsTeamSnapSyncOpen(false);
          }}
        />
      )}
    </div>
  );
};
