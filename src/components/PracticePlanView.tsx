import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Edit,
  Hash,
  Trash2,
  Save,
  Settings,
  Printer,
  Calendar,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  X,
  ArrowUp,
  ArrowDown,
  Check,
  UserPlus,
  Sparkles,
  Search,
  Layers,
  Ban,
  RotateCcw,
  AlertTriangle,
  Users,
  CheckCircle2,
  Filter,
  Eye,
  PenTool,
  BookOpen,
  Shield,
  Play,
  Pause,
  RotateCw,
  Timer,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  SkipForward,
  Settings2,
  SunMedium,
  Smartphone,
  Vibrate,
  Sliders,
} from 'lucide-react';
import {
  PracticePlan,
  PracticePeriod,
  PracticeStation,
  DrillFolder,
  DrillItem,
  UserRole,
  ScheduleEvent,
  FormationBoard,
  PlacedPlayer,
} from '../types';
import { formatTimeMinutes, parseTimeString } from '../services/storageService';
import { PracticeWizardModal, PracticeWizardGeneratedResult } from './PracticeWizardModal';
import {
  getPracticeSequenceMap,
  calculateWeekFolderForDate,
  getDayOfWeekForDate,
  getFormattedDayFolder,
  findBestActivePracticeId,
} from '../utils/practiceUtils';
import {
  triggerPrint,
  printCleanHTML,
  generatePracticePlanHTML,
  openCleanPrintTab,
} from '../utils/printUtils';
import { WhiteboardDrill, WHITEBOARD_DRILLS } from './whiteboard/whiteboardDrillData';
import { findMatchingWhiteboardDrill, createCustomDrillFromStation } from '../utils/drillPlanLinking';
import { printDrillSheet } from './whiteboard/drillPrintHelper';
import { PracticePlanPrintModal } from './PracticePlanPrintModal';
import { DrillInstructionsModal } from './whiteboard/DrillInstructionsModal';
import { PocketDepthChartPrintModal } from './PocketDepthChartPrintModal';

interface PracticePlanViewProps {
  practices: PracticePlan[];
  currentPracticeId: string | null;
  practiceTemplates: Record<string, PracticePeriod[]>;
  cascadingDrills: DrillFolder[];
  savedCoaches: string[];
  printFontSize: string;
  userRole: UserRole;
  scheduleEvents?: ScheduleEvent[];
  formations?: FormationBoard[];
  depthChart?: Record<string, PlacedPlayer[]>;
  activeTeamName?: string;
  onSelectPractice: (id: string) => void;
  onOpenNewPracticeModal: () => void;
  onEditPracticeDetails: () => void;
  onAutoNumberPractices: () => void;
  onDeletePractice: () => void;
  onApplyTemplate: (templateName: string) => void;
  onSaveCurrentAsTemplate: () => void;
  onOpenTemplatesModal: () => void;
  onUpdatePrintFontSize: (size: string) => void;
  onUpdateMeta: (field: keyof PracticePlan, value: any) => void;
  onTogglePracticeCancelled?: (practiceId: string, isCancelled?: boolean, reason?: string) => void;
  onTogglePracticeNonPractice?: (practiceId: string, isNonPractice: boolean) => void;
  onAddPeriod: () => void;
  onRemovePeriod: (pIdx: number) => void;
  onMovePeriod: (pIdx: number, direction: number) => void;
  onUpdatePeriodTime: (pIdx: number, time: number) => void;
  onUpdatePeriodCategory: (pIdx: number, cat: string) => void;
  onUpdatePeriodFormat: (pIdx: number, format: 'static' | 'rotating') => void;
  onAddStationToPeriod: (pIdx: number) => void;
  onRemoveStationFromPeriod: (pIdx: number, sIdx: number) => void;
  onUpdateStation: (
    pIdx: number,
    sIdx: number,
    field: keyof PracticeStation,
    value: string
  ) => void;
  onSelectDrillForStation: (
    pIdx: number,
    sIdx: number,
    drill: DrillItem
  ) => void;
  onAddNewSavedCoach: (name: string) => void;
  onDeleteSavedCoach: (name: string) => void;
  onNavigateToSchedule?: () => void;
  onPracticeWizardGenerate?: (result: PracticeWizardGeneratedResult) => void;
  onQuickCreateFromSchedule?: (event: any) => void;
  onOpenWhiteboardDrill?: (drillId: string, category?: string) => void;
  whiteboardDrills?: WhiteboardDrill[];
}

export const PracticePlanView: React.FC<PracticePlanViewProps> = ({
  practices,
  currentPracticeId,
  practiceTemplates,
  cascadingDrills,
  savedCoaches,
  printFontSize,
  userRole,
  scheduleEvents = [],
  onSelectPractice,
  onOpenNewPracticeModal,
  onEditPracticeDetails,
  onAutoNumberPractices,
  onDeletePractice,
  onApplyTemplate,
  onSaveCurrentAsTemplate,
  onOpenTemplatesModal,
  onUpdatePrintFontSize,
  onUpdateMeta,
  onTogglePracticeCancelled,
  onTogglePracticeNonPractice,
  onAddPeriod,
  onRemovePeriod,
  onMovePeriod,
  onUpdatePeriodTime,
  onUpdatePeriodCategory,
  onUpdatePeriodFormat,
  onAddStationToPeriod,
  onRemoveStationFromPeriod,
  onUpdateStation,
  onSelectDrillForStation,
  onAddNewSavedCoach,
  onDeleteSavedCoach,
  onNavigateToSchedule,
  onPracticeWizardGenerate,
  onQuickCreateFromSchedule,
  onOpenWhiteboardDrill,
  whiteboardDrills,
  formations = [],
  depthChart = {},
  activeTeamName,
}) => {
  const [isPlanLibraryOpen, setIsPlanLibraryOpen] = useState(false);
  const [dropdownSearchTerm, setDropdownSearchTerm] = useState('');
  const [dropdownViewMode, setDropdownViewMode] = useState<'tree' | 'flat' | 'schedule'>('tree');
  const [filterTag, setFilterTag] = useState<'all' | 'active_only' | 'cancelled' | 'recent' | 'this_week' | 'upcoming' | 'past'>('all');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeCoachPopup, setActiveCoachPopup] = useState<string | null>(null);
  const [coachSearchTerm, setCoachSearchTerm] = useState('');
  const [quickNewCoachInput, setQuickNewCoachInput] = useState('');
  const [collapsedTreeFolders, setCollapsedTreeFolders] = useState<Record<string, boolean>>({});
  const [stationGroupFilters, setStationGroupFilters] = useState<Record<string, string>>({});
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [isPrintPackageModalOpen, setIsPrintPackageModalOpen] = useState(false);
  const [isPocketModalOpen, setIsPocketModalOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);
  const effectiveWhiteboardDrills = useMemo(
    () => (whiteboardDrills && whiteboardDrills.length > 0 ? whiteboardDrills : WHITEBOARD_DRILLS),
    [whiteboardDrills]
  );

  // Sideline / View-Only Mode State (Optimized for Mobile and Field Reading)
  const [viewOnlyMode, setViewOnlyMode] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [viewFilterPeriod, setViewFilterPeriod] = useState<number | 'all'>('all');
  const [viewFontSize, setViewFontSize] = useState<'normal' | 'large'>('normal');
  const [activeViewingPeriodIdx, setActiveViewingPeriodIdx] = useState<number>(0);

  // Drill Instructions & Diagram Preview Modal state
  const [instructionsModalDrill, setInstructionsModalDrill] = useState<{
    drill: WhiteboardDrill | null;
    stationName: string;
    stationDesc?: string;
    stationFocus?: string;
    stationCoach?: string;
    periodName?: string;
    periodNumber?: number;
    periodDuration?: number;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setIsPrintMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentPlan =
    practices.find((p) => p && p.id === currentPracticeId) ||
    practices.find((p) => p && p.id === findBestActivePracticeId(practices)) ||
    practices[0];

  // Identify the most recently edited practice plan
  const latestEditedPlan = useMemo(() => {
    if (!practices || practices.length === 0) return null;
    const sorted = [...practices]
      .filter((p) => p && typeof p.lastEdited === 'number' && p.lastEdited > 0)
      .sort((a, b) => (b.lastEdited || 0) - (a.lastEdited || 0));
    return sorted[0] || null;
  }, [practices]);

  // Identify today's practice or closest upcoming practice
  const todayOrUpcomingPlan = useMemo(() => {
    if (!practices || practices.length === 0) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    const today = practices.find((p) => p && p.date === todayStr && !p.isCancelled);
    if (today) return today;
    const upcoming = practices
      .filter((p) => p && p.date && p.date >= todayStr && !p.isCancelled)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return upcoming[0] || null;
  }, [practices]);

  const formatLastEditedTime = (ts?: number) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString([], {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate dynamic practice sequence map across all practices starting from 8/3
  const practiceSeqMap = getPracticeSequenceMap(practices, scheduleEvents);
  const currentSeq = currentPlan
    ? practiceSeqMap[currentPlan.id] ||
      (currentPlan.date ? practiceSeqMap[currentPlan.date] : undefined) || {
        practiceNumber: 1,
        isCancelled: Boolean(currentPlan.isCancelled),
        isNonPractice: Boolean(currentPlan.isNonPractice),
        totalActivePractices: practices.filter((p) => !p.isCancelled && !p.isNonPractice).length,
        totalCancelledPractices: practices.filter((p) => p.isCancelled).length,
        totalNonPracticeEvents: practices.filter((p) => p.isNonPractice).length,
        isPast: false,
        displayDayLabel: currentPlan.isCancelled
          ? 'Cancelled'
          : currentPlan.isNonPractice
          ? 'Non-Practice'
          : 'Day 1',
        fullBadgeLabel: currentPlan.isCancelled
          ? 'Cancelled (Not Counted)'
          : currentPlan.isNonPractice
          ? 'Non-Practice (Not Counted)'
          : 'Practice Day #1',
        formattedTitle: currentPlan.title,
      }
    : null;

  // Auto expand current plan's folders when library opens
  useEffect(() => {
    if (isPlanLibraryOpen && currentPlan) {
      const yr = currentPlan.year || '2026';
      const wk = currentPlan.weekFolder || 'Week 1';
      setCollapsedTreeFolders((prev) => ({
        ...prev,
        [`yr_${yr}`]: false,
        [`wk_${yr}_${wk}`]: false,
      }));
    }
  }, [isPlanLibraryOpen, currentPlan]);

  // ESC key listener to close modal & popups
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeCoachPopup) {
          setActiveCoachPopup(null);
        } else if (isPlanLibraryOpen) {
          setIsPlanLibraryOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlanLibraryOpen, activeCoachPopup]);

  // Helper to extract category folder info and its position/subgroup hierarchy
  const getCategoryFolderInfo = (
    catName: string,
    drillTree: DrillFolder[]
  ): {
    folderName: string;
    directDrills: DrillItem[];
    subfolders: { name: string; drills: DrillItem[] }[];
    allCategoryDrills: DrillItem[];
  } => {
    const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = clean(catName);

    if (!target) {
      return {
        folderName: '',
        directDrills: [],
        subfolders: [],
        allCategoryDrills: [],
      };
    }

    const isMatch = (folderClean: string, targetClean: string) => {
      if (folderClean === targetClean) return true;
      if (
        (targetClean.includes('offens') || targetClean === 'off') &&
        (folderClean.includes('offens') || folderClean === 'off')
      ) {
        return true;
      }
      if (
        (targetClean.includes('defens') || targetClean === 'def') &&
        (folderClean.includes('defens') || folderClean === 'def')
      ) {
        return true;
      }
      if (targetClean.includes('special') && folderClean.includes('special')) return true;
      if (
        (targetClean.includes('warm') || targetClean.includes('agility')) &&
        (folderClean.includes('warm') || folderClean.includes('agility'))
      ) {
        return true;
      }
      if (targetClean.length >= 3 && (folderClean.includes(targetClean) || targetClean.includes(folderClean))) {
        return true;
      }
      return false;
    };

    let matchedFolder: DrillFolder | null = null;

    const findFolder = (list: DrillFolder[]): DrillFolder | null => {
      for (const f of list) {
        const fClean = clean(f.name);
        if (isMatch(fClean, target)) {
          return f;
        }
        if (f.subfolders && f.subfolders.length > 0) {
          const sub = findFolder(f.subfolders);
          if (sub) return sub;
        }
      }
      return null;
    };

    matchedFolder = findFolder(drillTree);

    if (!matchedFolder) {
      const flatDrills: DrillItem[] = [];
      const collectMatching = (list: DrillFolder[]) => {
        list.forEach((f) => {
          const fClean = clean(f.name);
          const fMatches = isMatch(fClean, target);
          (f.drills || []).forEach((d) => {
            const dClean = clean(d.name);
            if (fMatches || isMatch(dClean, target)) {
              flatDrills.push(d);
            }
          });
          if (f.subfolders) collectMatching(f.subfolders);
        });
      };
      collectMatching(drillTree);

      return {
        folderName: catName,
        directDrills: flatDrills,
        subfolders: [],
        allCategoryDrills: flatDrills,
      };
    }

    const directDrills = matchedFolder.drills || [];
    const subfolders: { name: string; drills: DrillItem[] }[] = [];
    const allCategoryDrills: DrillItem[] = [...directDrills];

    if (matchedFolder.subfolders && matchedFolder.subfolders.length > 0) {
      if (directDrills.length > 0) {
        subfolders.push({
          name: `Base / General`,
          drills: directDrills,
        });
      }

      const collectSubgroups = (sf: DrillFolder, prefix = '') => {
        const fullName = prefix ? `${prefix} ➔ ${sf.name}` : sf.name;
        const sDrills = sf.drills || [];
        if (sDrills.length > 0) {
          subfolders.push({
            name: fullName,
            drills: sDrills,
          });
          allCategoryDrills.push(...sDrills);
        }
        if (sf.subfolders) {
          sf.subfolders.forEach((child) => collectSubgroups(child, fullName));
        }
      };

      matchedFolder.subfolders.forEach((sf) => collectSubgroups(sf));
    }

    return {
      folderName: matchedFolder.name,
      directDrills,
      subfolders,
      allCategoryDrills,
    };
  };

  // Helper to flat list drills from matching category or all
  const getDrillsForCategory = (catName: string): DrillItem[] => {
    const flat: DrillItem[] = [];
    const cleanCat = (catName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const traverse = (nodeList: DrillFolder[]) => {
      nodeList.forEach((n) => {
        const cleanNode = (n.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const isMatch =
          cleanNode === cleanCat ||
          cleanNode.includes(cleanCat) ||
          cleanCat.includes(cleanNode) ||
          ((cleanCat.includes('offens') || cleanCat === 'off') &&
            (cleanNode.includes('offens') || cleanNode === 'off')) ||
          ((cleanCat.includes('defens') || cleanCat === 'def') &&
            (cleanNode.includes('defens') || cleanNode === 'def')) ||
          (cleanCat.includes('special') && cleanNode.includes('special')) ||
          ((cleanCat.includes('warm') || cleanCat.includes('agility')) &&
            (cleanNode.includes('warm') || cleanNode.includes('agility')));

        if (cleanCat && isMatch) {
          if (n.drills) flat.push(...n.drills);
        }
        if (n.subfolders) traverse(n.subfolders);
      });
    };

    traverse(cascadingDrills);
    return flat;
  };

  // Group all drills from cascadingDrills by folder hierarchy for quick dropdown select
  const allCategorizedDrills = useMemo(() => {
    const groups: { category: string; drills: DrillItem[] }[] = [];
    const collect = (folder: DrillFolder, prefix = '') => {
      const fullName = prefix ? `${prefix} ➔ ${folder.name}` : folder.name;
      if (folder.drills && folder.drills.length > 0) {
        groups.push({ category: fullName, drills: folder.drills });
      }
      if (folder.subfolders) {
        folder.subfolders.forEach((sf) => collect(sf, fullName));
      }
    };
    cascadingDrills.forEach((f) => collect(f));
    return groups;
  }, [cascadingDrills]);

  // Build hierarchical year -> week -> practice tree
  const practiceTree: Record<string, Record<string, PracticePlan[]>> = {};
  const sortedPractices = [...practices].sort((a, b) => {
    const dateA = a.date || '1970-01-01';
    const dateB = b.date || '1970-01-01';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
  });

  sortedPractices.forEach((p) => {
    const yr = p.year || '2026';
    const wk = p.weekFolder || 'Week 1';
    if (!practiceTree[yr]) practiceTree[yr] = {};
    if (!practiceTree[yr][wk]) practiceTree[yr][wk] = [];
    practiceTree[yr][wk].push(p);
  });

  const sortWeekKeys = (keys: string[]) => {
    return [...keys].sort((a, b) => {
      const getWeight = (w: string) => {
        const lower = w.toLowerCase();
        if (lower.includes('pre-1') || lower.includes('preseason wk 1') || lower.includes('preseason week 1')) return 1;
        if (lower.includes('pre-2') || lower.includes('preseason wk 2') || lower.includes('preseason week 2')) return 2;
        if (lower.includes('pre-3') || lower.includes('preseason wk 3')) return 3;
        if (lower.includes('pre-4') || lower.includes('preseason wk 4')) return 4;
        const numMatch = w.match(/\d+/);
        if (numMatch) return 10 + parseInt(numMatch[0], 10);
        if (lower.includes('playoff')) return 90;
        if (lower.includes('champ')) return 95;
        return 50;
      };
      return getWeight(a) - getWeight(b);
    });
  };

  const currentIndex = sortedPractices.findIndex((p) => p.id === currentPlan?.id);
  const prevPractice = currentIndex > 0 ? sortedPractices[currentIndex - 1] : null;
  const nextPractice =
    currentIndex >= 0 && currentIndex < sortedPractices.length - 1
      ? sortedPractices[currentIndex + 1]
      : null;

  const currentPlanPeriods = Array.isArray(currentPlan?.plan)
    ? currentPlan.plan
    : Array.isArray(currentPlan?.periods)
    ? currentPlan.periods
    : [];
  const currentPlanPeriodsCount = currentPlanPeriods.length;
  const currentPlanDurationMinutes = currentPlanPeriods.reduce(
    (acc, per) => acc + (Number(per?.time) || 0),
    0
  );

  // Unplanned schedule events (practices/scrimmages without a created plan)
  const unplannedScheduleEvents = scheduleEvents.filter(
    (e) =>
      (e.type === 'practice' || e.type === 'scrimmage') &&
      !practices.some((p) => p && p.date === e.date)
  );

  const baseStartMinutes = useMemo(() => {
    return parseTimeString(currentPlan?.startTime || '17:05');
  }, [currentPlan?.startTime]);

  const practiceEndMinutes = baseStartMinutes + currentPlanDurationMinutes;
  const practiceTimeSpanStr = `${formatTimeMinutes(baseStartMinutes)} - ${formatTimeMinutes(practiceEndMinutes)}`;

  // Live real-time clock (updated every 5 seconds)
  const [currentClockTime, setCurrentClockTime] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentClockTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const currentClockMinutes = currentClockTime.getHours() * 60 + currentClockTime.getMinutes();
  const formattedClockTime = formatTimeMinutes(currentClockMinutes);

  const isPracticeToday = useMemo(() => {
    if (!currentPlan?.date) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return currentPlan.date === todayStr;
  }, [currentPlan?.date]);

  // Determine if practice is currently in progress
  const isPracticeLiveNow = useMemo(() => {
    if (!isPracticeToday) return false;
    return currentClockMinutes >= baseStartMinutes && currentClockMinutes < practiceEndMinutes;
  }, [isPracticeToday, currentClockMinutes, baseStartMinutes, practiceEndMinutes]);

  // Find which period is active based on real clock time
  const realTimePeriodIdx = useMemo(() => {
    if (!isPracticeToday) return -1;
    let running = baseStartMinutes;
    for (let i = 0; i < currentPlanPeriods.length; i++) {
      const dur = Number(currentPlanPeriods[i]?.time) || 0;
      if (currentClockMinutes >= running && currentClockMinutes < running + dur) {
        return i;
      }
      running += dur;
    }
    return -1;
  }, [isPracticeToday, currentClockMinutes, baseStartMinutes, currentPlanPeriods]);

  // Live Sideline Period Countdown Stopwatch / Whistle Timer
  const [periodTimerActive, setPeriodTimerActive] = useState<boolean>(false);
  const [periodTimerIdx, setPeriodTimerIdx] = useState<number>(0);
  const [periodTimerSecondsLeft, setPeriodTimerSecondsLeft] = useState<number>(0);
  const [timerExpiredNotice, setTimerExpiredNotice] = useState<boolean>(false);

  // Auto-notification & Auto-advance preferences (persisted locally)
  const [timerAutoAdvance, setTimerAutoAdvance] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('football_timer_auto_advance');
      return v !== null ? JSON.parse(v) : true;
    } catch {
      return true;
    }
  });

  const [timerTransitionSec, setTimerTransitionSec] = useState<number>(() => {
    try {
      const v = localStorage.getItem('football_timer_transition_sec');
      return v !== null ? JSON.parse(v) : 10;
    } catch {
      return 10;
    }
  });

  const [timerVoiceEnabled, setTimerVoiceEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('football_timer_voice');
      return v !== null ? JSON.parse(v) : true;
    } catch {
      return true;
    }
  });

  const [timerSoundEnabled, setTimerSoundEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('football_timer_sound');
      return v !== null ? JSON.parse(v) : true;
    } catch {
      return true;
    }
  });

  const [timerWarningEnabled, setTimerWarningEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('football_timer_warning');
      return v !== null ? JSON.parse(v) : true;
    } catch {
      return true;
    }
  });

  const [timerVibrationEnabled, setTimerVibrationEnabled] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('football_timer_vibrate');
      return v !== null ? JSON.parse(v) : true;
    } catch {
      return true;
    }
  });

  // Transition break state between periods (e.g. 10s rotation break)
  const [isTransitionBreak, setIsTransitionBreak] = useState<boolean>(false);
  const [transitionSecondsLeft, setTransitionSecondsLeft] = useState<number>(0);

  // System notification permission status
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  // Mobile stopwatch settings modal / expanded drawer toggle
  const [isStopwatchSettingsOpen, setIsStopwatchSettingsOpen] = useState<boolean>(false);

  // Keep mobile screen awake during active practice timing
  const [screenWakeLocked, setScreenWakeLocked] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  // Mutable ref so timer intervals always see current settings & periods without re-binding
  const timerSettingsRef = useRef({
    autoAdvance: timerAutoAdvance,
    transitionSec: timerTransitionSec,
    voice: timerVoiceEnabled,
    sound: timerSoundEnabled,
    warning: timerWarningEnabled,
    periods: currentPlanPeriods,
    currentIdx: periodTimerIdx,
  });

  useEffect(() => {
    timerSettingsRef.current = {
      autoAdvance: timerAutoAdvance,
      transitionSec: timerTransitionSec,
      voice: timerVoiceEnabled,
      sound: timerSoundEnabled,
      warning: timerWarningEnabled,
      periods: currentPlanPeriods,
      currentIdx: periodTimerIdx,
    };
  }, [
    timerAutoAdvance,
    timerTransitionSec,
    timerVoiceEnabled,
    timerSoundEnabled,
    timerWarningEnabled,
    currentPlanPeriods,
    periodTimerIdx,
  ]);

  // Save preference changes to localStorage
  const updateTimerAutoAdvance = (val: boolean) => {
    setTimerAutoAdvance(val);
    try {
      localStorage.setItem('football_timer_auto_advance', JSON.stringify(val));
    } catch {}
  };

  const updateTimerTransitionSec = (val: number) => {
    setTimerTransitionSec(val);
    try {
      localStorage.setItem('football_timer_transition_sec', JSON.stringify(val));
    } catch {}
  };

  const updateTimerVoiceEnabled = (val: boolean) => {
    setTimerVoiceEnabled(val);
    try {
      localStorage.setItem('football_timer_voice', JSON.stringify(val));
    } catch {}
  };

  const updateTimerSoundEnabled = (val: boolean) => {
    setTimerSoundEnabled(val);
    try {
      localStorage.setItem('football_timer_sound', JSON.stringify(val));
    } catch {}
  };

  const updateTimerWarningEnabled = (val: boolean) => {
    setTimerWarningEnabled(val);
    try {
      localStorage.setItem('football_timer_warning', JSON.stringify(val));
    } catch {}
  };

  const updateTimerVibrationEnabled = (val: boolean) => {
    setTimerVibrationEnabled(val);
    try {
      localStorage.setItem('football_timer_vibrate', JSON.stringify(val));
    } catch {}
  };

  // Screen Wake Lock Handler
  useEffect(() => {
    if (periodTimerActive) {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        (navigator as any).wakeLock
          .request('screen')
          .then((lock: any) => {
            wakeLockRef.current = lock;
            setScreenWakeLocked(true);
            lock.addEventListener('release', () => {
              setScreenWakeLocked(false);
            });
          })
          .catch(() => {
            setScreenWakeLocked(false);
          });
      }
    } else {
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
        wakeLockRef.current = null;
        setScreenWakeLocked(false);
      }
    }
    return () => {
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
      }
    };
  }, [periodTimerActive]);

  // Speech synthesis voice prompt
  const speakVoicePrompt = (text: string) => {
    if (!timerVoiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Google') ||
            v.name.includes('Natural') ||
            v.name.includes('Samantha') ||
            v.name.includes('Alex') ||
            v.name.includes('Daniel') ||
            v.name.includes('English'))
      );
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  // Browser System / Lockscreen Notification
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setNotificationPermission(res);
        if (res === 'granted') {
          sendSystemNotification(
            'Practice Stopwatch Alerts Active',
            'You will receive automatic notifications to stop and start periods on your phone!'
          );
        }
      } catch (e) {
        console.warn('Error requesting notification permission:', e);
      }
    }
  };

  const sendSystemNotification = (title: string, body: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'practice-period-timer',
          silent: false,
        });
      }
    } catch (e) {
      console.warn('System notification error:', e);
    }
  };

  // Authentic Referee Whistle Synthesizer & Vibration
  const playWhistleBurst = (type: 'stop' | 'start' | 'warning' | 'transition' = 'stop') => {
    if (!timerSoundEnabled) return;
    try {
      if (timerVibrationEnabled && typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        if (type === 'stop') {
          navigator.vibrate([350, 100, 350, 100, 500]);
        } else if (type === 'start') {
          navigator.vibrate([250, 80, 250]);
        } else if (type === 'warning') {
          navigator.vibrate([200]);
        } else {
          navigator.vibrate([100]);
        }
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      // Realistic whistle burst patterns
      const bursts =
        type === 'stop'
          ? [0, 0.28, 0.58]
          : type === 'start'
          ? [0, 0.25]
          : type === 'warning'
          ? [0]
          : [0];
      const blastDuration = type === 'warning' ? 0.22 : type === 'transition' ? 0.15 : 0.24;

      bursts.forEach((startOffset) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Dual frequencies simulate authentic pea-whistle harmonics
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(2450, ctx.currentTime + startOffset);
        osc1.frequency.linearRampToValueAtTime(2900, ctx.currentTime + startOffset + blastDuration);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2150, ctx.currentTime + startOffset);
        osc2.frequency.linearRampToValueAtTime(2600, ctx.currentTime + startOffset + blastDuration);

        gain.gain.setValueAtTime(0.01, ctx.currentTime + startOffset);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + startOffset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startOffset + blastDuration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime + startOffset);
        osc1.stop(ctx.currentTime + startOffset + blastDuration);
        osc2.start(ctx.currentTime + startOffset);
        osc2.stop(ctx.currentTime + startOffset + blastDuration);
      });
    } catch {}
  };

  // Initialize or synchronize timer duration when periodTimerIdx changes or plan changes
  useEffect(() => {
    const durationMins = Number(currentPlanPeriods[periodTimerIdx]?.time) || 10;
    setPeriodTimerSecondsLeft(durationMins * 60);
    setTimerExpiredNotice(false);
    setIsTransitionBreak(false);
  }, [periodTimerIdx, currentPlanPeriods]);

  // Timer interval countdown with Automatic Stop & Start Notifications
  useEffect(() => {
    if (!periodTimerActive) return;

    const interval = setInterval(() => {
      // 1. If currently in transition break (between periods)
      if (isTransitionBreak) {
        setTransitionSecondsLeft((prev) => {
          if (prev <= 1) {
            // Transition break finished! START NEXT PERIOD!
            setIsTransitionBreak(false);
            const { periods, currentIdx } = timerSettingsRef.current;
            const nextIdx = currentIdx + 1;
            if (nextIdx < periods.length) {
              setPeriodTimerIdx(nextIdx);
              const nextDur = (Number(periods[nextIdx]?.time) || 10) * 60;
              setPeriodTimerSecondsLeft(nextDur);
              setActiveViewingPeriodIdx(nextIdx);

              // Sound START whistle!
              playWhistleBurst('start');

              const nextCat = periods[nextIdx]?.category || `Period ${nextIdx + 1}`;
              const nextTime = periods[nextIdx]?.time || 10;
              speakVoicePrompt(`Start Period ${nextIdx + 1}: ${nextCat}. ${nextTime} minutes.`);
              sendSystemNotification(
                `START! Period ${nextIdx + 1}: ${nextCat}`,
                `${nextTime} minutes scheduled. Clock running!`
              );
            } else {
              setPeriodTimerActive(false);
              speakVoicePrompt('Practice plan complete! Great work today!');
              sendSystemNotification('Practice Complete', 'All scheduled periods have finished!');
            }
            return 0;
          }

          // Audible voice countdown during final 3 seconds of rotation break
          if (prev === 4 && timerVoiceEnabled) {
            speakVoicePrompt('3');
          } else if (prev === 3 && timerVoiceEnabled) {
            speakVoicePrompt('2');
          } else if (prev === 2 && timerVoiceEnabled) {
            speakVoicePrompt('1');
          }

          return prev - 1;
        });
        return;
      }

      // 2. Active Period Countdown
      setPeriodTimerSecondsLeft((prev) => {
        const { autoAdvance, transitionSec, warning, periods, currentIdx } = timerSettingsRef.current;
        const currentPeriodNum = currentIdx + 1;
        const curCat = periods[currentIdx]?.category || `Period ${currentPeriodNum}`;

        // 1-minute warning (60 seconds)
        if (prev === 61 && warning) {
          playWhistleBurst('warning');
          speakVoicePrompt(`One minute remaining in Period ${currentPeriodNum}: ${curCat}.`);
          sendSystemNotification(
            `1 Minute Warning: Period ${currentPeriodNum}`,
            `Finish up drill reps in ${curCat}`
          );
        }

        // Period time expired (hits 0) -> AUTOMATIC NOTIFY TO STOP!
        if (prev <= 1) {
          const nextIdx = currentIdx + 1;
          const hasNext = nextIdx < periods.length;

          // Sound Triple Whistle STOP blast!
          playWhistleBurst('stop');

          if (hasNext && autoAdvance) {
            const nextCat = periods[nextIdx]?.category || `Period ${nextIdx + 1}`;
            const nextTime = periods[nextIdx]?.time || 10;

            if (transitionSec > 0) {
              // Enter rotation break countdown
              setIsTransitionBreak(true);
              setTransitionSecondsLeft(transitionSec);
              speakVoicePrompt(
                `Stop! Period ${currentPeriodNum} is complete. Blow whistle and rotate! Next up is Period ${nextIdx + 1}: ${nextCat}.`
              );
              sendSystemNotification(
                `STOP! Period ${currentPeriodNum} Complete`,
                `Rotate stations now! Next: Period ${nextIdx + 1} (${nextCat} - ${nextTime}m)`
              );
            } else {
              // Immediate advance without break
              setPeriodTimerIdx(nextIdx);
              const nextDur = nextTime * 60;
              setActiveViewingPeriodIdx(nextIdx);
              setTimeout(() => {
                playWhistleBurst('start');
                speakVoicePrompt(`Start Period ${nextIdx + 1}: ${nextCat}. ${nextTime} minutes.`);
                sendSystemNotification(
                  `START! Period ${nextIdx + 1}: ${nextCat}`,
                  `${nextTime} minutes scheduled.`
                );
              }, 600);
              return nextDur;
            }
            return 0;
          } else {
            // Last period or manual advance
            setPeriodTimerActive(false);
            setTimerExpiredNotice(true);
            speakVoicePrompt(`Stop! Period ${currentPeriodNum} is complete!`);
            sendSystemNotification(
              `STOP! Period ${currentPeriodNum} Finished`,
              hasNext ? `Next: Period ${nextIdx + 1}` : `Practice plan complete!`
            );
            return 0;
          }
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [periodTimerActive, isTransitionBreak]);

  // Skip or advance to Next Period manually
  const handleSkipToNextPeriod = () => {
    if (periodTimerIdx < currentPlanPeriods.length - 1) {
      const nextIdx = periodTimerIdx + 1;
      setIsTransitionBreak(false);
      setPeriodTimerIdx(nextIdx);
      const nextDur = (Number(currentPlanPeriods[nextIdx]?.time) || 10) * 60;
      setPeriodTimerSecondsLeft(nextDur);
      setPeriodTimerActive(true);
      setTimerExpiredNotice(false);
      setActiveViewingPeriodIdx(nextIdx);
      playWhistleBurst('start');
      const nextCat = currentPlanPeriods[nextIdx]?.category || `Period ${nextIdx + 1}`;
      const nextMins = currentPlanPeriods[nextIdx]?.time || 10;
      speakVoicePrompt(`Start Period ${nextIdx + 1}: ${nextCat}. ${nextMins} minutes.`);
      sendSystemNotification(`START! Period ${nextIdx + 1}: ${nextCat}`, `${nextMins} minutes.`);
    }
  };

  // Toggle Stopwatch Play / Pause
  const handleToggleTimer = () => {
    if (periodTimerSecondsLeft === 0 && !isTransitionBreak) {
      const dur = (Number(currentPlanPeriods[periodTimerIdx]?.time) || 10) * 60;
      setPeriodTimerSecondsLeft(dur);
    }
    const nextState = !periodTimerActive;
    setPeriodTimerActive(nextState);
    setTimerExpiredNotice(false);
    if (nextState) {
      playWhistleBurst('start');
      const curCat = currentPlanPeriods[periodTimerIdx]?.category || `Period ${periodTimerIdx + 1}`;
      speakVoicePrompt(`Practice timer started. Period ${periodTimerIdx + 1}: ${curCat}.`);
    }
  };

  // Reset current period timer
  const handleResetTimer = () => {
    setPeriodTimerActive(false);
    setIsTransitionBreak(false);
    const dur = (Number(currentPlanPeriods[periodTimerIdx]?.time) || 10) * 60;
    setPeriodTimerSecondsLeft(dur);
    setTimerExpiredNotice(false);
  };

  // Fast-forward transition break immediately to start next period
  const handleStartNextPeriodNow = () => {
    setIsTransitionBreak(false);
    const nextIdx = periodTimerIdx + 1;
    if (nextIdx < currentPlanPeriods.length) {
      setPeriodTimerIdx(nextIdx);
      const nextDur = (Number(currentPlanPeriods[nextIdx]?.time) || 10) * 60;
      setPeriodTimerSecondsLeft(nextDur);
      setPeriodTimerActive(true);
      setActiveViewingPeriodIdx(nextIdx);
      playWhistleBurst('start');
      const nextCat = currentPlanPeriods[nextIdx]?.category || `Period ${nextIdx + 1}`;
      const nextMins = currentPlanPeriods[nextIdx]?.time || 10;
      speakVoicePrompt(`Start Period ${nextIdx + 1}: ${nextCat}. ${nextMins} minutes.`);
      sendSystemNotification(`START! Period ${nextIdx + 1}: ${nextCat}`, `${nextMins} minutes.`);
    }
  };

  const handleShiftStartTime = (deltaMinutes: number) => {
    const currentMins = parseTimeString(currentPlan?.startTime || '17:05');
    const newMins = Math.max(0, Math.min(23 * 60 + 59, currentMins + deltaMinutes));
    const h = Math.floor(newMins / 60);
    const m = newMins % 60;
    const timeStr = `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
    onUpdateMeta('startTime', timeStr);
  };

  const handleSetStartTimeToNow = () => {
    const now = new Date();
    // Round to nearest 5 minutes
    const roundedMins = Math.round(now.getMinutes() / 5) * 5;
    const h = (now.getHours() + Math.floor(roundedMins / 60)) % 24;
    const m = roundedMins % 60;
    const timeStr = `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
    onUpdateMeta('startTime', timeStr);
  };

  const formatTimerSeconds = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

  // Filter practices based on search and tag
  const filteredPractices = sortedPractices.filter((p) => {
    if (!p) return false;
    const term = dropdownSearchTerm.toLowerCase().trim();
    if (term) {
      const seq = practiceSeqMap[p.id];
      const matchTitle = (p.title || '').toLowerCase().includes(term);
      const matchWeek = (p.weekFolder || '').toLowerCase().includes(term);
      const matchDate = (p.date || '').toLowerCase().includes(term);
      const matchDay = (p.dayFolder || p.day || '').toLowerCase().includes(term);
      const matchSeq = seq?.practiceNumber ? `practice #${seq.practiceNumber}`.includes(term) || `day ${seq.practiceNumber}`.includes(term) : false;
      const matchFocus = (p.plan || p.periods || []).some((per) =>
        per &&
        Array.isArray(per.stations) &&
        per.stations.some(
          (st) =>
            st &&
            (((st.name || '').toLowerCase().includes(term)) ||
              ((st.focus || '').toLowerCase().includes(term)) ||
              ((st.desc || '').toLowerCase().includes(term)))
        )
      );
      if (!matchTitle && !matchWeek && !matchDate && !matchDay && !matchSeq && !matchFocus) {
        return false;
      }
    }

    if (filterTag === 'active_only') {
      return !p.isCancelled;
    }

    if (filterTag === 'cancelled') {
      return Boolean(p.isCancelled);
    }

    if (filterTag === 'this_week' && currentPlan) {
      return p.weekFolder === currentPlan.weekFolder;
    }

    if (filterTag === 'recent') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return typeof p.lastEdited === 'number' && p.lastEdited >= sevenDaysAgo;
    }

    if (filterTag === 'upcoming') {
      const today = new Date().toISOString().split('T')[0];
      return (p.date || '9999-99-99') >= today;
    }

    if (filterTag === 'past') {
      const today = new Date().toISOString().split('T')[0];
      return (p.date || '0000-00-00') < today;
    }

    return true;
  });

  const handleExecutePrint = (mode: 'clean' | 'tab' | 'direct' = 'clean') => {
    setIsPrintMenuOpen(false);
    const numSize = parseInt(printFontSize, 10) || 12;
    const cleanHtml = generatePracticePlanHTML(
      currentPlan,
      currentPlanPeriods,
      currentSeq,
      numSize
    );

    if (mode === 'tab') {
      openCleanPrintTab(cleanHtml, `Practice Plan - ${currentPlan?.title || 'Sheet'}`);
    } else if (mode === 'direct') {
      triggerPrint();
    } else {
      printCleanHTML(cleanHtml, `Practice Plan - ${currentPlan?.title || 'Sheet'}`);
    }
  };

  const handleToggleCancel = () => {
    if (!currentPlan) return;
    if (onTogglePracticeCancelled) {
      if (!currentPlan.isCancelled) {
        const reason = prompt('Optional cancellation reason (e.g. Weather, Lightning, Field Conflict):', 'Weather / Field Conflict');
        onTogglePracticeCancelled(currentPlan.id, true, reason || 'Cancelled');
      } else {
        onTogglePracticeCancelled(currentPlan.id, false, '');
      }
    } else {
      // Fallback to onUpdateMeta
      const nextState = !currentPlan.isCancelled;
      onUpdateMeta('isCancelled', nextState);
    }
  };

  const handleToggleNonPractice = () => {
    if (!currentPlan) return;
    const nextState = !currentPlan.isNonPractice;
    if (onTogglePracticeNonPractice) {
      onTogglePracticeNonPractice(currentPlan.id, nextState);
    } else {
      onUpdateMeta('isNonPractice', nextState);
    }
  };

  return (
    <div className="space-y-5 pb-80 sm:pb-96 min-h-[calc(100vh-120px)] print:space-y-0 print:pb-0 print:min-h-0 print:m-0 print:p-0">
      {/* Top Action & Navigation Bar */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 print:hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700/80">
          
          {/* Enhanced Practice Plan Selector & Quick Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Prev Practice Arrow */}
            <button
              type="button"
              disabled={!prevPractice}
              onClick={() => prevPractice && onSelectPractice(prevPractice.id)}
              title={prevPractice ? `Go to Previous: ${prevPractice.title}` : 'No earlier practices'}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                prevPractice
                  ? 'bg-slate-900 hover:bg-slate-750 text-slate-200 border-slate-700 hover:border-slate-500 active:scale-95 cursor-pointer shadow-sm'
                  : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed opacity-40'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Primary Practice Hub Selector Trigger */}
            <button
              type="button"
              onClick={() => setIsPlanLibraryOpen(true)}
              className={`px-3.5 py-2 border rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md transition-all active:scale-98 group cursor-pointer ${
                currentPlan?.isCancelled
                  ? 'bg-gradient-to-r from-rose-950/80 to-slate-900 border-rose-500/50 text-rose-100'
                  : 'bg-gradient-to-r from-slate-900 to-slate-850 hover:from-slate-800 hover:to-slate-750 border-slate-700/90 hover:border-indigo-500/60 text-slate-100'
              }`}
              title="Click to open Practice Plan Library & Folder Hub"
            >
              <div
                className={`p-1.5 rounded-lg transition-all shadow-inner ${
                  currentPlan?.isCancelled
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white'
                }`}
              >
                {currentPlan?.isCancelled ? <Ban className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-500/40 text-[9px] font-black text-indigo-300 uppercase tracking-wider">
                    {currentPlan?.weekFolder || 'Week 1'}
                  </span>
                  {currentSeq?.isCancelled ? (
                    <span className="px-1.5 py-0.2 rounded bg-rose-900/80 border border-rose-500/50 text-[9px] font-black text-rose-300 uppercase tracking-wider">
                      CANCELLED
                    </span>
                  ) : currentSeq?.practiceNumber ? (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/40 text-[9px] font-black text-emerald-300 uppercase tracking-wider">
                      Day {currentSeq.practiceNumber}
                    </span>
                  ) : null}
                  <span className={`font-black text-xs truncate max-w-[180px] sm:max-w-[240px] ${currentPlan?.isCancelled ? 'line-through text-rose-200/80' : 'text-slate-100'}`}>
                    {currentPlan ? currentPlan.title : 'Select Practice Plan...'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{currentPlan?.date || 'No Date'}</span>
                  <span>•</span>
                  <span>{currentPlan?.day || getDayOfWeekForDate(currentPlan?.date)}</span>
                  <span>•</span>
                  <span className="text-amber-300 font-bold">{practiceTimeSpanStr}</span>
                  <span>•</span>
                  <span>{currentPlanPeriodsCount} Periods ({currentPlanDurationMinutes}m)</span>
                </div>
              </div>
              <div className="pl-1 border-l border-slate-700/80 text-slate-400 group-hover:text-indigo-300 transition-colors flex items-center gap-1">
                <span className="hidden lg:inline text-[10px] uppercase font-bold tracking-wider">Browse</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Next Practice Arrow */}
            <button
              type="button"
              disabled={!nextPractice}
              onClick={() => nextPractice && onSelectPractice(nextPractice.id)}
              title={nextPractice ? `Go to Next: ${nextPractice.title}` : 'No later practices'}
              className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                nextPractice
                  ? 'bg-slate-900 hover:bg-slate-750 text-slate-200 border-slate-700 hover:border-slate-500 active:scale-95 cursor-pointer shadow-sm'
                  : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed opacity-40'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Practice Day Counter Badge (Dynamic & State-Aware) */}
            {currentSeq && (
              <div
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold shadow-inner ${
                  currentSeq.isCancelled
                    ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                    : currentSeq.isNonPractice
                    ? 'bg-amber-950/80 border-amber-500/50 text-amber-200'
                    : 'bg-indigo-950/80 border-indigo-500/40 text-indigo-200'
                }`}
                title={
                  currentSeq.isCancelled
                    ? 'Cancelled practice: Excluded from cumulative practice day held count.'
                    : currentSeq.isNonPractice
                    ? 'Non-practice event: Excluded from cumulative practice day count.'
                    : `Held Practice #${currentSeq.practiceNumber} of ${currentSeq.totalActivePractices} active practices in the season.`
                }
              >
                {currentSeq.isCancelled ? (
                  <>
                    <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="font-black text-rose-300 uppercase tracking-tight text-[11px]">
                      Cancelled (Not Counted)
                    </span>
                  </>
                ) : currentSeq.isNonPractice ? (
                  <>
                    <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-black text-amber-300 uppercase tracking-tight text-[11px]">
                      Non-Practice (Not Counted)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white font-black text-[10px]">
                      Day {currentSeq.practiceNumber}
                    </span>
                    <span className="font-mono text-slate-300 text-[11px]">
                      Practice #{currentSeq.practiceNumber} Held
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Practice Plan Management Buttons */}
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 border border-amber-400/40 cursor-pointer"
                  title="Multi-Week & Multi-Day Practice Wizard"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>Practice Wizard</span>
                </button>
                <button
                  onClick={onOpenNewPracticeModal}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Plan</span>
                </button>
                <button
                  onClick={onEditPracticeDetails}
                  title="Edit Date, Day, Year, Week title"
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-750 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Details</span>
                </button>
                <button
                  onClick={onAutoNumberPractices}
                  title="Auto-number non-cancelled practice days sequentially by date"
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-750 hover:bg-slate-700 text-sky-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Hash className="w-3.5 h-3.5 text-sky-400" />
                  <span>Auto # Days</span>
                </button>

                {/* Cancel / Reinstate Toggle Button */}
                <button
                  type="button"
                  onClick={handleToggleCancel}
                  title={
                    currentPlan?.isCancelled
                      ? 'Reinstate this practice (will re-enter practice day numbering sequence)'
                      : 'Cancel this practice (will exclude from practice day count and automatically re-number remaining practices)'
                  }
                  className={`px-3 py-2 font-bold text-xs rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPlan?.isCancelled
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                      : 'bg-slate-900 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border-slate-700 hover:border-rose-500/50'
                  }`}
                >
                  {currentPlan?.isCancelled ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reinstate Practice</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel Practice</span>
                    </>
                  )}
                </button>

                {/* Non-Practice Toggle Button */}
                <button
                  type="button"
                  onClick={handleToggleNonPractice}
                  title={
                    currentPlan?.isNonPractice
                      ? 'Re-count as regular practice (will be assigned a Practice Day number)'
                      : 'Label as non-practice event (will exclude from cumulative practice day count and re-number remaining practices)'
                  }
                  className={`px-3 py-2 font-bold text-xs rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                    currentPlan?.isNonPractice
                      ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-600/30'
                      : 'bg-slate-900 hover:bg-amber-950/60 text-amber-400 hover:text-amber-300 border-slate-700 hover:border-amber-500/50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{currentPlan?.isNonPractice ? 'Is Non-Practice' : 'Mark Non-Practice'}</span>
                </button>

                <button
                  onClick={onDeletePractice}
                  title="Delete this practice plan"
                  className="p-2 text-rose-400 hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Templates & Print Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {userRole === 'admin' && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-xl">
                <span className="text-[11px] font-black uppercase text-slate-300">
                  Template:
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onApplyTemplate(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="bg-slate-800 border border-slate-600 text-xs font-semibold text-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="">-- Apply --</option>
                  {Object.keys(practiceTemplates).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onSaveCurrentAsTemplate}
                  title="Save current plan as template"
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-indigo-400 transition-colors"
                >
                  <Save className="w-3.5 h-3.5 text-indigo-400" />
                </button>
                <button
                  onClick={onOpenTemplatesModal}
                  title="Manage templates"
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Print font size */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-xl">
              <span className="text-[11px] font-black uppercase text-slate-300">Font:</span>
              <select
                value={printFontSize}
                onChange={(e) => onUpdatePrintFontSize(e.target.value)}
                className="bg-slate-800 border border-slate-600 text-xs font-semibold text-slate-200 rounded-lg px-1.5 py-1 focus:outline-none cursor-pointer"
              >
                <option value="9">9px (Compact)</option>
                <option value="10">10px (Small)</option>
                <option value="11">11px (Medium)</option>
                <option value="12">12px (Large - Default)</option>
                <option value="13">13px (XL)</option>
                <option value="14">14px (2XL - Big)</option>
                <option value="15">15px (3XL)</option>
                <option value="16">16px (Jumbo)</option>
              </select>
            </div>

            {userRole === 'admin' && (
              <button
                onClick={onAddPeriod}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Period</span>
              </button>
            )}

            {onNavigateToSchedule && (
              <button
                type="button"
                onClick={onNavigateToSchedule}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="View in Season Schedule"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Season Schedule</span>
              </button>
            )}

            {/* View Mode vs Edit Mode Toggle (Elevated for field and mobile use) */}
            <div className="flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-700/80 shadow-inner">
              <button
                type="button"
                onClick={() => setViewOnlyMode(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewOnlyMode
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to viewing-focused sideline mode (easy to read on phone/tablet, no edit clutter)"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setViewOnlyMode(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  !viewOnlyMode
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to full editing mode"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Mode</span>
              </button>
            </div>

            {/* Multi-Mode Smart Print Button */}
            <div className="relative inline-flex items-center" ref={printMenuRef}>
              <button
                type="button"
                onClick={() => setIsPrintPackageModalOpen(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-750 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-l-xl border border-r-0 border-slate-700 shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="Print practice plan with option to select drill whiteboard sheets"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-400" />
                <span>Print Plan</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrintMenuOpen(!isPrintMenuOpen)}
                className="px-2 py-2 bg-slate-900 hover:bg-slate-750 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-r-xl border border-slate-700 shadow-md transition-all active:scale-95 cursor-pointer"
                title="Print options & new-tab printable sheet"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPrintMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPrintMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-68 bg-slate-850 border border-slate-600 rounded-2xl shadow-2xl p-2 z-50 space-y-1 backdrop-blur-md ring-1 ring-slate-700/80 animate-in fade-in duration-150">
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-400 border-b border-slate-700">
                    Print Options
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintMenuOpen(false);
                      setIsPrintPackageModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-indigo-300 hover:bg-indigo-600 hover:text-white flex items-center gap-2 transition-all cursor-pointer bg-indigo-950/40 border border-indigo-700/40"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <div>
                      <div>Print Plan & Drill Sheets...</div>
                      <div className="text-[10px] text-indigo-200 font-normal">Select drills to print alongside plan</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintMenuOpen(false);
                      setIsPocketModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:bg-amber-600 hover:text-white flex items-center gap-2 transition-all cursor-pointer bg-amber-950/40 border border-amber-700/40"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <div>
                      <div>Pocket Depth Chart (All Formations)...</div>
                      <div className="text-[10px] text-amber-200 font-normal">Print all formations (Offense, Defense, ST)</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintMenuOpen(false);
                      handleExecutePrint('clean');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-indigo-600 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <div>
                      <div>Quick Print (Plan Only)</div>
                      <div className="text-[10px] text-slate-400 group-hover:text-indigo-100 font-normal">Fast layout, avoids browser preview hangs</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintMenuOpen(false);
                      handleExecutePrint('tab');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-indigo-600 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <div>
                      <div>Open Printable Tab (Plan Only)</div>
                      <div className="text-[10px] text-slate-400 group-hover:text-indigo-100 font-normal">Best for saving PDF or Chrome iframe bypass</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintMenuOpen(false);
                      handleExecutePrint('direct');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <div>
                      <div>Standard Full Page Print</div>
                      <div className="text-[10px] text-slate-400 font-normal">Direct window.print()</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coach Latest Edit Notification / Quick Switcher Banner */}
        {latestEditedPlan && currentPlan && latestEditedPlan.id !== currentPlan.id && (
          <div className="bg-gradient-to-r from-amber-950/70 via-indigo-950/70 to-slate-900 border border-amber-500/40 rounded-2xl p-3 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                  <span>Recent Coach Edit:</span>
                  <span className="font-black text-amber-300">{latestEditedPlan.title}</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-900/60 border border-indigo-500/40 text-[10px] text-indigo-300">
                    {latestEditedPlan.weekFolder} • {latestEditedPlan.date || 'No Date'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({formatLastEditedTime(latestEditedPlan.lastEdited)})
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  A head coach recently updated this plan. Click below to view the latest edits.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectPractice(latestEditedPlan.id)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>View Latest Plan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Cancellation Alert Banner */}
        {currentPlan?.isCancelled && (
          <div className="bg-rose-950/80 border border-rose-500/60 rounded-2xl p-3.5 text-xs text-rose-200 flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <div className="font-black text-rose-100 uppercase tracking-tight">
                  This practice is marked as CANCELLED
                </div>
                <div className="text-[11px] text-rose-300/90 font-medium">
                  {currentPlan.cancellationReason
                    ? `Reason: ${currentPlan.cancellationReason}. `
                    : ''}
                  This practice is excluded from the cumulative practice day count. Subsequent practices are automatically re-numbered.
                </div>
              </div>
            </div>
            {userRole === 'admin' && (
              <button
                type="button"
                onClick={handleToggleCancel}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reinstate</span>
              </button>
            )}
          </div>
        )}

        {/* Non-Practice Notification Banner */}
        {currentPlan && currentPlan.isNonPractice && !currentPlan.isCancelled && (
          <div className="bg-amber-950/80 border border-amber-500/50 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="font-black text-amber-100 uppercase tracking-tight">
                  This event is marked as NON-PRACTICE
                </div>
                <div className="text-[11px] text-amber-300/90 font-medium">
                  This session is excluded from the cumulative practice day count (e.g. equipment pickup, team meeting, orientation). Subsequent practices are automatically re-numbered.
                </div>
              </div>
            </div>
            {userRole === 'admin' && (
              <button
                type="button"
                onClick={handleToggleNonPractice}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Count as Practice</span>
              </button>
            )}
          </div>
        )}

        {/* Practice Meta Bar */}
        {currentPlan && (
          <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-700 text-xs font-semibold text-slate-200">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">
                Year
              </span>
              <input
                type="text"
                value={currentPlan.year || '2026'}
                disabled={userRole !== 'admin'}
                onChange={(e) => onUpdateMeta('year', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-slate-100 disabled:bg-transparent disabled:border-transparent"
              />
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">
                Week Folder
              </span>
              <input
                type="text"
                value={currentPlan.weekFolder || 'Week 1'}
                disabled={userRole !== 'admin'}
                onChange={(e) => onUpdateMeta('weekFolder', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-slate-100 disabled:bg-transparent disabled:border-transparent"
              />
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">
                Practice Date
              </span>
              <input
                type="date"
                value={currentPlan.date || ''}
                disabled={userRole !== 'admin'}
                onChange={(e) => {
                  const newDate = e.target.value;
                  onUpdateMeta('date', newDate);
                  if (newDate) {
                    const derivedDay = getDayOfWeekForDate(newDate);
                    const derivedDayFolder = getFormattedDayFolder(newDate);
                    const derivedWeek = calculateWeekFolderForDate(newDate, scheduleEvents);
                    onUpdateMeta('day', derivedDay);
                    onUpdateMeta('dayFolder', derivedDayFolder);
                    onUpdateMeta('weekFolder', derivedWeek);
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-slate-100 disabled:bg-transparent disabled:border-transparent"
              />
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">
                Day of Week
              </span>
              <select
                value={currentPlan.day || getDayOfWeekForDate(currentPlan.date)}
                disabled={userRole !== 'admin'}
                onChange={(e) => {
                  const newDay = e.target.value;
                  onUpdateMeta('day', newDay);
                  onUpdateMeta('dayFolder', newDay);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-slate-100 disabled:bg-transparent disabled:border-transparent"
              >
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">
                Start Time
              </span>
              <input
                type="time"
                value={currentPlan.startTime || '17:05'}
                disabled={userRole !== 'admin'}
                onChange={(e) => onUpdateMeta('startTime', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-slate-100 disabled:bg-transparent disabled:border-transparent"
              />
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">
                Practice Status
              </span>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  disabled={userRole !== 'admin'}
                  onClick={handleToggleCancel}
                  className={`w-full py-1.5 px-2 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1 ${
                    currentPlan.isCancelled
                      ? 'bg-rose-950 border-rose-500/60 text-rose-300 hover:bg-rose-900'
                      : 'bg-emerald-950 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900'
                  }`}
                >
                  {currentPlan.isCancelled ? (
                    <>
                      <Ban className="w-3 h-3" />
                      <span>Cancelled</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1">
                Practice Count
              </span>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  disabled={userRole !== 'admin'}
                  onClick={handleToggleNonPractice}
                  title="Toggle whether this event counts towards the cumulative season practice day total"
                  className={`w-full py-1.5 px-2 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-1 ${
                    currentPlan.isNonPractice
                      ? 'bg-amber-950 border-amber-500/60 text-amber-300 hover:bg-amber-900'
                      : 'bg-indigo-950 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900'
                  }`}
                >
                  {currentPlan.isNonPractice ? (
                    <>
                      <FileText className="w-3 h-3" />
                      <span>Non-Practice</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Counted</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FULL VIEWPORT PRACTICE PLAN LIBRARY & FOLDER HUB MODAL */}
      {isPlanLibraryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIsPlanLibraryOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner shrink-0">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
                      Practice Plan Library &amp; Schedule Folders
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-500/40 text-[10px] font-black text-indigo-300 font-mono">
                      {practices.filter((p) => !p.isCancelled).length} Active / {practices.length} Total
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Browse and jump to any practice plan. Practices are dynamically numbered sequentially by date (excluding cancellations).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPlanLibraryOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar: Search, View Mode, Filter Chips */}
            <div className="p-4 sm:px-6 bg-slate-900/95 border-b border-slate-800 space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={dropdownSearchTerm}
                    onChange={(e) => setDropdownSearchTerm(e.target.value)}
                    placeholder="Search by practice #, title, week folder, date, day, or drill..."
                    className="w-full pl-9.5 pr-8 py-2 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
                    autoFocus
                  />
                  {dropdownSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setDropdownSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* View Mode Selector */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setDropdownViewMode('tree')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      dropdownViewMode === 'tree'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>📁 Week Folders</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDropdownViewMode('flat')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      dropdownViewMode === 'flat'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>🗂️ All Plans (Grid)</span>
                  </button>
                  {unplannedScheduleEvents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDropdownViewMode('schedule')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        dropdownViewMode === 'schedule'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-amber-400/80 hover:text-amber-300'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>📅 Unplanned ({unplannedScheduleEvents.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Chips Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0">Filter:</span>
                <button
                  type="button"
                  onClick={() => setFilterTag('all')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                    filterTag === 'all'
                      ? 'bg-slate-700 text-white border border-slate-600'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  All ({sortedPractices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTag('active_only')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                    filterTag === 'active_only'
                      ? 'bg-emerald-600/40 text-emerald-200 border border-emerald-500/60'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Active ({practices.filter((p) => !p.isCancelled).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTag('cancelled')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                    filterTag === 'cancelled'
                      ? 'bg-rose-600/40 text-rose-200 border border-rose-500/60'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Cancelled ({practices.filter((p) => p.isCancelled).length})
                </button>
                {currentPlan && (
                  <button
                    type="button"
                    onClick={() => setFilterTag('this_week')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                      filterTag === 'this_week'
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Current {currentPlan.weekFolder || 'Week'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilterTag('recent')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                    filterTag === 'recent'
                      ? 'bg-amber-500 text-slate-950 border border-amber-400 shadow-sm'
                      : 'bg-slate-950 text-amber-400/90 hover:text-amber-300 border border-slate-800'
                  }`}
                >
                  ⚡ Recently Edited
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTag('upcoming')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                    filterTag === 'upcoming'
                      ? 'bg-sky-600/30 text-sky-300 border border-sky-500/50'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTag('past')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                    filterTag === 'past'
                      ? 'bg-slate-700/50 text-slate-300 border border-slate-600'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Past
                </button>

                {dropdownViewMode === 'tree' && (
                  <div className="ml-auto shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCollapsedTreeFolders({})}
                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      Expand All
                    </button>
                    <span className="text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allCollapsed: Record<string, boolean> = {};
                        Object.keys(practiceTree).forEach((yr) => {
                          allCollapsed[`yr_${yr}`] = true;
                          Object.keys(practiceTree[yr]).forEach((wk) => {
                            allCollapsed[`wk_${yr}_${wk}`] = true;
                          });
                        });
                        setCollapsedTreeFolders(allCollapsed);
                      }}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      Collapse All
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Body - Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              
              {/* Highlighted Spotlight: Most Recently Edited Practice */}
              {latestEditedPlan && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 shadow-md flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                          Most Recently Edited by Coach
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          • {formatLastEditedTime(latestEditedPlan.lastEdited)}
                        </span>
                      </div>
                      <div className="font-black text-sm text-slate-100 mt-0.5">
                        {latestEditedPlan.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>{latestEditedPlan.weekFolder}</span>
                        <span>•</span>
                        <span>{latestEditedPlan.date || 'No Date'}</span>
                        <span>•</span>
                        <span>{latestEditedPlan.startTime || '17:05'}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">
                          {(latestEditedPlan.plan || latestEditedPlan.periods || []).length} Periods
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPractice(latestEditedPlan.id);
                      setIsPlanLibraryOpen(false);
                    }}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm ${
                      currentPracticeId === latestEditedPlan.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {currentPracticeId === latestEditedPlan.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Currently Viewing</span>
                      </>
                    ) : (
                      <>
                        <span>Open This Plan</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* MODE 1: HIERARCHICAL WEEK FOLDERS VIEW */}
              {dropdownViewMode === 'tree' && (
                <div className="space-y-4">
                  {Object.keys(practiceTree).length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No practice plans found. Click "+ New Plan" to create your first practice plan.
                    </div>
                  )}

                  {Object.keys(practiceTree).sort().reverse().map((yr) => {
                    const yrKey = `yr_${yr}`;
                    const isYrCollapsed = collapsedTreeFolders[yrKey];
                    const weekKeys = sortWeekKeys(Object.keys(practiceTree[yr]));
                    const totalSeasonPlans = weekKeys.reduce(
                      (acc, wk) => acc + practiceTree[yr][wk].length,
                      0
                    );

                    return (
                      <div
                        key={yr}
                        className="bg-slate-950/60 border border-slate-800 rounded-3xl p-3 sm:p-4 space-y-3"
                      >
                        {/* Year Folder Header */}
                        <div
                          onClick={() =>
                            setCollapsedTreeFolders({
                              ...collapsedTreeFolders,
                              [yrKey]: !isYrCollapsed,
                            })
                          }
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 cursor-pointer select-none transition-colors border border-slate-750"
                        >
                          <div className="flex items-center gap-2">
                            {isYrCollapsed ? (
                              <Folder className="w-4 h-4 text-amber-400" />
                            ) : (
                              <FolderOpen className="w-4 h-4 text-amber-400" />
                            )}
                            <span className="font-black text-sm text-indigo-300">
                              Season {yr}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-950 text-[10px] font-mono font-bold text-slate-400">
                              {totalSeasonPlans} Plans
                            </span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                              isYrCollapsed ? '-rotate-90' : ''
                            }`}
                          />
                        </div>

                        {/* Week Folders in this Year */}
                        {!isYrCollapsed && (
                          <div className="space-y-3 pl-1 sm:pl-2">
                            {weekKeys.map((wk) => {
                              const wkKey = `wk_${yr}_${wk}`;
                              const isWkCollapsed = collapsedTreeFolders[wkKey];
                              const weekPractices = practiceTree[yr][wk].filter((p) =>
                                filteredPractices.some((fp) => fp.id === p.id)
                              );

                              if (dropdownSearchTerm && weekPractices.length === 0) {
                                return null;
                              }

                              const totalWeekMinutes = practiceTree[yr][wk].reduce((acc, p) => {
                                const pList = p.plan || p.periods || [];
                                return (
                                  acc +
                                  pList.reduce(
                                    (pAcc, per) => pAcc + (per.time || 0),
                                    0
                                  )
                                );
                              }, 0);

                              const hasCurrentPlanInWeek = practiceTree[yr][wk].some(
                                (p) => p.id === currentPracticeId
                              );

                              return (
                                <div
                                  key={wk}
                                  className={`rounded-2xl border transition-all ${
                                    hasCurrentPlanInWeek
                                      ? 'bg-indigo-950/20 border-indigo-500/40 ring-1 ring-indigo-500/20'
                                      : 'bg-slate-900/80 border-slate-800'
                                  }`}
                                >
                                  {/* Week Folder Header */}
                                  <div
                                    onClick={() =>
                                      setCollapsedTreeFolders({
                                        ...collapsedTreeFolders,
                                        [wkKey]: !isWkCollapsed,
                                      })
                                    }
                                    className="flex items-center justify-between gap-2 p-3 cursor-pointer select-none hover:bg-slate-800/60 rounded-2xl transition-colors"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      {isWkCollapsed ? (
                                        <Folder className="w-4 h-4 text-amber-400" />
                                      ) : (
                                        <FolderOpen className="w-4 h-4 text-amber-400" />
                                      )}
                                      <span className="font-black text-xs text-slate-100">
                                        {wk}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400">
                                        {practiceTree[yr][wk].length} {practiceTree[yr][wk].length === 1 ? 'Plan' : 'Plans'}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                                        ({totalWeekMinutes} min total)
                                      </span>
                                      {hasCurrentPlanInWeek && (
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-[9px] font-black text-indigo-300 uppercase tracking-wider">
                                          Active Week
                                        </span>
                                      )}
                                    </div>
                                    <ChevronDown
                                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                        isWkCollapsed ? '-rotate-90' : ''
                                      }`}
                                    />
                                  </div>

                                  {/* Plans inside this Week */}
                                  {!isWkCollapsed && (
                                    <div className="p-2 sm:p-3 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {weekPractices.map((p) => {
                                        const isSelected = p.id === currentPracticeId;
                                        const pList = p.plan || p.periods || [];
                                        const periodCount = pList.length;
                                        const totalMinutes = pList.reduce(
                                          (acc, per) => acc + (per.time || 0),
                                          0
                                        );
                                        const seq = practiceSeqMap[p.id];

                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                              onSelectPractice(p.id);
                                              setIsPlanLibraryOpen(false);
                                            }}
                                            className={`text-left p-3 rounded-2xl transition-all border flex items-start justify-between gap-3 group cursor-pointer ${
                                              p.isCancelled
                                                ? 'bg-rose-950/40 hover:bg-rose-950/60 border-rose-500/30'
                                                : isSelected
                                                ? 'bg-indigo-950 text-indigo-100 border-indigo-500 shadow-lg ring-1 ring-indigo-500/50'
                                                : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border-slate-800 hover:border-slate-700'
                                            }`}
                                          >
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                {seq?.isCancelled ? (
                                                  <span className="px-2 py-0.5 rounded-md bg-rose-900 border border-rose-500/60 text-[9px] font-black text-rose-200 uppercase tracking-tight">
                                                    🚫 Cancelled
                                                  </span>
                                                ) : seq?.practiceNumber ? (
                                                  <span className="px-2 py-0.5 rounded-md bg-indigo-900/80 border border-indigo-500/50 text-[10px] font-black text-indigo-300">
                                                    Day {seq.practiceNumber} • Prac #{seq.practiceNumber}
                                                  </span>
                                                ) : null}

                                                {latestEditedPlan && p.id === latestEditedPlan.id && (
                                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-[9px] font-black text-amber-300 flex items-center gap-1">
                                                    <Sparkles className="w-2.5 h-2.5" />
                                                    Latest Edit
                                                  </span>
                                                )}

                                                {p.dayFolder && (
                                                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-750 text-[10px] font-bold text-amber-400">
                                                    {p.dayFolder}
                                                  </span>
                                                )}
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                  {p.date || 'No date'}
                                                </span>
                                              </div>
                                              <div className={`font-black text-xs truncate group-hover:text-indigo-300 transition-colors ${p.isCancelled ? 'line-through text-rose-300/80' : 'text-slate-100'}`}>
                                                {p.title}
                                              </div>
                                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2 font-mono">
                                                <span>{p.startTime || '17:05'}</span>
                                                <span>•</span>
                                                <span>{periodCount} Periods</span>
                                                <span>•</span>
                                                <span className="text-emerald-400">{totalMinutes} min</span>
                                              </div>
                                            </div>
                                            <div className="shrink-0 pt-1">
                                              {isSelected ? (
                                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                                                  <Check className="w-3.5 h-3.5" />
                                                  <span>Active</span>
                                                </div>
                                              ) : (
                                                <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  Open →
                                                </span>
                                              )}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODE 2: ALL PLANS GRID CARDS VIEW */}
              {dropdownViewMode === 'flat' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredPractices.map((p) => {
                      const isSelected = p.id === currentPracticeId;
                      const pList = p.plan || p.periods || [];
                      const periodCount = pList.length;
                      const totalMinutes = pList.reduce(
                        (acc, per) => acc + (per.time || 0),
                        0
                      );
                      const seq = practiceSeqMap[p.id];

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            onSelectPractice(p.id);
                            setIsPlanLibraryOpen(false);
                          }}
                          className={`p-4 rounded-3xl transition-all border flex flex-col justify-between gap-3 group cursor-pointer ${
                            p.isCancelled
                              ? 'bg-rose-950/30 hover:bg-rose-950/50 border-rose-500/40 shadow-sm'
                              : isSelected
                              ? 'bg-indigo-950/90 text-indigo-100 border-indigo-500 shadow-xl ring-2 ring-indigo-500/40'
                              : 'bg-slate-950/80 hover:bg-slate-800/90 text-slate-300 hover:text-slate-100 border-slate-800 hover:border-slate-700 shadow-md'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-750 text-[10px] font-black text-indigo-300 uppercase">
                                  {p.weekFolder || 'Week'}
                                </span>
                                {seq?.isCancelled ? (
                                  <span className="px-2 py-0.5 rounded-lg bg-rose-900/80 border border-rose-500/50 text-[9px] font-black text-rose-200 uppercase">
                                    Cancelled
                                  </span>
                                ) : seq?.practiceNumber ? (
                                  <span className="px-2 py-0.5 rounded-lg bg-indigo-900/80 border border-indigo-500/40 text-[9px] font-black text-indigo-200">
                                    Day {seq.practiceNumber}
                                  </span>
                                ) : null}
                                {latestEditedPlan && p.id === latestEditedPlan.id && (
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-[9px] font-black text-amber-300 uppercase flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Latest Edit
                                  </span>
                                )}
                              </div>
                              {isSelected ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                                  <Check className="w-3 h-3" />
                                  Active Plan
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {p.date || 'No Date'}
                                </span>
                              )}
                            </div>

                            <h3 className={`font-black text-sm mb-1 group-hover:text-indigo-300 transition-colors ${p.isCancelled ? 'line-through text-rose-300/80' : 'text-slate-100'}`}>
                              {p.title}
                            </h3>

                            {p.dayFolder && (
                              <div className="text-[11px] font-bold text-amber-400/90 mb-2">
                                {p.dayFolder}
                              </div>
                            )}

                            {/* Preview period categories */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {pList.slice(0, 3).map((per, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-800 text-[9px] font-semibold text-slate-400 truncate max-w-[110px]"
                                >
                                  {per.category}
                                </span>
                              ))}
                              {pList.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-slate-900/90 text-[9px] font-bold text-slate-500">
                                  +{pList.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-850 flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>{periodCount} Periods</span>
                            <span className="font-bold text-emerald-400">{totalMinutes} min</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredPractices.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                      <Search className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p className="font-bold text-sm text-slate-400">No practice plans matched your search.</p>
                      <p className="text-xs text-slate-500 mt-1">Try clearing filters or search keywords.</p>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 3: UNPLANNED SCHEDULE PRACTICES VIEW */}
              {dropdownViewMode === 'schedule' && (
                <div className="space-y-3">
                  <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black text-amber-300">Unplanned Schedule Practices Detected</div>
                      <p className="mt-0.5 text-amber-200/80">
                        These practice/scrimmage dates exist on your season schedule but don't have a practice plan attached yet. Click "+ Create Plan" to generate one instantly!
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {unplannedScheduleEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                              Week {evt.week || 1}
                            </span>
                            <span className="font-black text-sm text-slate-100">{evt.title}</span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                            <span>📅 {evt.date}</span>
                            <span>•</span>
                            <span>⏰ {evt.startTime || evt.time || '17:05'}</span>
                            {evt.location && (
                              <>
                                <span>•</span>
                                <span>📍 {evt.location}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {onQuickCreateFromSchedule && (
                          <button
                            type="button"
                            onClick={() => {
                              onQuickCreateFromSchedule(evt);
                              setIsPlanLibraryOpen(false);
                            }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Create Plan</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 bg-slate-850 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-2">
                {userRole === 'admin' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlanLibraryOpen(false);
                        onOpenNewPracticeModal();
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Plan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlanLibraryOpen(false);
                        setIsWizardOpen(true);
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                      <span>Practice Wizard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAutoNumberPractices();
                      }}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-sky-300 font-bold text-xs rounded-xl border border-slate-750 flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Hash className="w-3.5 h-3.5 text-sky-400" />
                      <span>Auto # Days</span>
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsPlanLibraryOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Sheet Title Header */}
      <div className="hidden print:block mb-2.5 border-b-2 border-black pb-1.5">
        <div className="flex items-baseline justify-between">
          <h1 className="font-black text-lg uppercase tracking-tight text-black">
            Mahopac 10U Practice Plan
          </h1>
          <div className="text-sm font-black text-black">
            {currentSeq?.isCancelled
              ? `[CANCELLED SESSION]`
              : currentSeq?.practiceNumber
              ? `Day #${currentSeq.practiceNumber} (Prac #${currentSeq.practiceNumber})`
              : ''}
            {' • '}
            {currentPlan?.title}
          </div>
        </div>
        <div className="text-xs font-bold text-slate-800 flex items-center justify-between mt-0.5">
          <span>Date: {currentPlan?.date} ({currentPlan?.day || getDayOfWeekForDate(currentPlan?.date)}) • Time: {currentPlan?.startTime || '5:05 PM'}{currentPlan?.endTime ? ` - ${currentPlan.endTime}` : ''} • Location: {currentPlan?.location || 'Crane Road'}</span>
          <span>{currentPlan?.weekFolder}</span>
        </div>
      </div>

      {/* View-Focused Sideline Reader (Mobile & Field Friendly) */}
      {viewOnlyMode && (
        <div className="print:hidden space-y-4 animate-in fade-in duration-200">
          {/* Top Banner with Text Size and Period Count */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-black">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Sideline Viewing Mode
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Read-Only
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Optimized for fast reading on phones, tablets, and field conditions.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewFontSize((prev) => (prev === 'normal' ? 'large' : 'normal'))}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewFontSize === 'large'
                    ? 'bg-amber-400 text-slate-950 border-amber-500 font-black shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <span>Font Size:</span>
                <span className="font-black uppercase">{viewFontSize === 'large' ? 'Large' : 'Normal'}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewOnlyMode(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-slate-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Switch to Edit</span>
              </button>
            </div>
          </div>

          {/* Dedicated Mobile Practice Time & Field Stopwatch HUD */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
            {/* Top Row: Scheduled Window & Real-Time Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-800/90">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono font-black text-sm sm:text-base shadow-sm">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>{practiceTimeSpanStr}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700">
                    {currentPlanDurationMinutes}m Total • {currentPlanPeriods.length} Periods
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                  <span>{currentPlan?.day || getDayOfWeekForDate(currentPlan?.date)}</span>
                  <span>•</span>
                  <span>{currentPlan?.date || 'No Date'}</span>
                  <span>•</span>
                  <span className="font-mono text-slate-300">Local Clock: {formattedClockTime}</span>
                </div>
              </div>

              {/* Real-Time Practice Status Pill */}
              <div className="flex items-center gap-2">
                {isPracticeLiveNow && realTimePeriodIdx >= 0 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black animate-pulse shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>LIVE NOW: P{realTimePeriodIdx + 1} ({currentPlanPeriods[realTimePeriodIdx]?.category || 'Drill'})</span>
                  </div>
                ) : isPracticeToday && currentClockMinutes < baseStartMinutes ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black shadow-sm">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Starts in {baseStartMinutes - currentClockMinutes} mins</span>
                  </div>
                ) : isPracticeToday && currentClockMinutes >= practiceEndMinutes ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 text-xs font-bold">
                    <Check className="w-3.5 h-3.5 text-slate-500" />
                    <span>Practice Completed</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Quick Shift Practice Start Time (Touch-Friendly for Field Coaches) */}
            {userRole === 'admin' && (
              <div className="bg-slate-950/70 rounded-2xl border border-slate-800/90 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Start Time:</span>
                  </span>
                  <input
                    type="time"
                    value={currentPlan?.startTime || '17:05'}
                    onChange={(e) => onUpdateMeta('startTime', e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Quick Shift Nudge Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-medium mr-0.5">Shift:</span>
                  <button
                    type="button"
                    onClick={() => handleShiftStartTime(-15)}
                    className="px-2 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-750 active:scale-95 transition-all"
                  >
                    -15m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftStartTime(-5)}
                    className="px-2 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-750 active:scale-95 transition-all"
                  >
                    -5m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftStartTime(5)}
                    className="px-2 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-750 active:scale-95 transition-all"
                  >
                    +5m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftStartTime(15)}
                    className="px-2 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-750 active:scale-95 transition-all"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={handleSetStartTimeToNow}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-bold active:scale-95 transition-all flex items-center gap-1"
                    title="Snap practice start time to current time"
                  >
                    <Timer className="w-3 h-3 text-indigo-400" />
                    <span>Set to Now</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live Sideline Whistle Stopwatch / Countdown Timer */}
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-3xl border border-slate-800 p-4 sm:p-5 space-y-3.5 shadow-2xl">
              {/* Transition / Station Rotation Break Banner */}
              {isTransitionBreak && (
                <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-amber-500/20 border border-amber-500/60 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-pulse shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
                      <RotateCw className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-2">
                        <span>ROTATION BREAK ({transitionSecondsLeft}s LEFT)</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-200 border border-amber-500/40 text-[10px] font-black">
                          NEXT: PERIOD {periodTimerIdx + 2}
                        </span>
                      </div>
                      <div className="text-xs text-slate-200 mt-0.5">
                        Whistle sounded! Rotate stations to{' '}
                        <strong className="text-white font-black">
                          {currentPlanPeriods[periodTimerIdx + 1]?.category || 'Next Drill'}
                        </strong>{' '}
                        ({currentPlanPeriods[periodTimerIdx + 1]?.time || 10}m)
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartNextPeriodNow}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Period {periodTimerIdx + 2} Now</span>
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black transition-all ${
                    isTransitionBreak
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : periodTimerActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    <Timer className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-2 flex-wrap">
                      <span>Period {periodTimerIdx + 1} Practice Clock</span>
                      {currentPlanPeriods[periodTimerIdx]?.category && (
                        <span className="text-[10px] uppercase font-black text-amber-300 px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/40">
                          {currentPlanPeriods[periodTimerIdx].category}
                        </span>
                      )}
                      {screenWakeLocked && (
                        <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/30 flex items-center gap-1">
                          <SunMedium className="w-3 h-3 text-emerald-400" />
                          <span>Screen Awake</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{currentPlanPeriods[periodTimerIdx]?.time || 10}m Scheduled Duration</span>
                      <span>•</span>
                      <span className={timerAutoAdvance ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                        {timerAutoAdvance ? `Auto-Advance (${timerTransitionSec}s break)` : 'Manual Advance'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Big Digital Countdown Display */}
                <div className="flex items-center gap-2 font-mono">
                  <span
                    className={`text-3xl sm:text-4xl font-black tracking-tight px-4 py-1.5 rounded-2xl border transition-all ${
                      isTransitionBreak
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 animate-pulse'
                        : periodTimerSecondsLeft === 0
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-bounce'
                        : periodTimerActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-900 text-slate-200 border-slate-800'
                    }`}
                  >
                    {isTransitionBreak
                      ? `00:${transitionSecondsLeft < 10 ? '0' + transitionSecondsLeft : transitionSecondsLeft}`
                      : formatTimerSeconds(periodTimerSecondsLeft)}
                  </span>
                </div>
              </div>

              {/* Visual Progress Bar */}
              {(() => {
                const totalSec = (Number(currentPlanPeriods[periodTimerIdx]?.time) || 10) * 60;
                const elapsedSec = Math.max(0, totalSec - periodTimerSecondsLeft);
                const pct = isTransitionBreak
                  ? Math.min(100, Math.max(0, ((timerTransitionSec - transitionSecondsLeft) / Math.max(1, timerTransitionSec)) * 100))
                  : Math.min(100, Math.max(0, (elapsedSec / Math.max(1, totalSec)) * 100));
                return (
                  <div className="w-full h-2 rounded-full bg-slate-850 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isTransitionBreak
                          ? 'bg-amber-400'
                          : periodTimerSecondsLeft <= 60
                          ? 'bg-rose-500'
                          : periodTimerSecondsLeft <= 180
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                );
              })()}

              {/* Timer Controls Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleToggleTimer}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                      periodTimerActive
                        ? 'bg-amber-500 hover:bg-amber-450 text-slate-950'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    }`}
                  >
                    {periodTimerActive ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause Stopwatch</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Whistle Timer</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="px-3 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    title="Reset period countdown"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  {periodTimerIdx < currentPlanPeriods.length - 1 && (
                    <button
                      type="button"
                      onClick={handleSkipToNextPeriod}
                      className="px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer"
                    >
                      <span>Skip to P{periodTimerIdx + 2}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playWhistleBurst('stop');
                      speakVoicePrompt(`Test: Stop! Period ${periodTimerIdx + 1} complete. Blow whistle and rotate!`);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-amber-400 border border-slate-750 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Test whistle sound and voice announcement"
                  >
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Test Audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsStopwatchSettingsOpen(!isStopwatchSettingsOpen)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isStopwatchSettingsOpen
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-750'
                    }`}
                  >
                    <Settings2 className="w-4 h-4" />
                    <span>Auto-Notify Setup</span>
                  </button>
                </div>
              </div>

              {/* Automatic Stop & Start Notification Settings Panel */}
              {isStopwatchSettingsOpen && (
                <div className="bg-slate-950/80 rounded-2xl border border-slate-800/90 p-4 space-y-3 animate-in fade-in duration-200">
                  <div className="text-xs font-black text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BellRing className="w-4 h-4 text-amber-400" />
                      <span>Automatic Stop & Start Notification Options</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Optimized for Mobile Sideline Use
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {/* 1. Auto-Advance to Next Period */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">Auto-Advance Period</div>
                        <div className="text-[11px] text-slate-400">Automatically transitions and starts next period</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateTimerAutoAdvance(!timerAutoAdvance)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          timerAutoAdvance ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {timerAutoAdvance ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {/* 2. Transition / Rotation Break Duration */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">Rotation Break Buffer</div>
                        <div className="text-[11px] text-slate-400">Rest / water / station rotation time</div>
                      </div>
                      <select
                        value={timerTransitionSec}
                        onChange={(e) => updateTimerTransitionSec(Number(e.target.value))}
                        disabled={!timerAutoAdvance}
                        aria-label="Rotation Break Buffer"
                        className="bg-slate-850 border border-slate-700 text-amber-300 font-bold text-xs rounded-lg px-2 py-1 focus:outline-none disabled:opacity-50"
                      >
                        <option value={0}>0s (Immediate)</option>
                        <option value={5}>5 seconds</option>
                        <option value={10}>10 seconds</option>
                        <option value={15}>15 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>1 minute</option>
                      </select>
                    </div>

                    {/* 3. Voice Speech Announcements */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">Voice Audio Alerts</div>
                        <div className="text-[11px] text-slate-400">Speaks STOP & START commands out loud</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateTimerVoiceEnabled(!timerVoiceEnabled)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          timerVoiceEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {timerVoiceEnabled ? 'VOICE ON' : 'MUTED'}
                      </button>
                    </div>

                    {/* 4. Referee Whistle Sound */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">Referee Whistle Chime</div>
                        <div className="text-[11px] text-slate-400">Loud multi-tone field whistle chime</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateTimerSoundEnabled(!timerSoundEnabled)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          timerSoundEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {timerSoundEnabled ? 'WHISTLE ON' : 'OFF'}
                      </button>
                    </div>

                    {/* 5. 1-Minute Warning */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">1-Minute Early Warning</div>
                        <div className="text-[11px] text-slate-400">Alerts coaches at 60 seconds remaining</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateTimerWarningEnabled(!timerWarningEnabled)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          timerWarningEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {timerWarningEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {/* 6. Lockscreen System Notifications */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">Lockscreen Push Alerts</div>
                        <div className="text-[11px] text-slate-400">Notifies phone when locked or in pocket</div>
                      </div>
                      {notificationPermission === 'granted' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={requestNotificationPermission}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-sm"
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Time Expired Whistle Notification Alert */}
              {timerExpiredNotice && (
                <div className="p-3.5 bg-rose-500/20 border border-rose-500/60 rounded-2xl flex flex-wrap items-center justify-between gap-2 animate-bounce text-rose-200 text-xs font-black shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <BellRing className="w-5 h-5 text-rose-400 animate-spin" />
                    <span>WHISTLE! Period {periodTimerIdx + 1} ({currentPlanPeriods[periodTimerIdx]?.category || 'Drill'}) Time Expired!</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {periodTimerIdx < currentPlanPeriods.length - 1 && (
                      <button
                        type="button"
                        onClick={handleSkipToNextPeriod}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black text-white shadow-md cursor-pointer"
                      >
                        Start Period {periodTimerIdx + 2} Now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setTimerExpiredNotice(false)}
                      className="px-2.5 py-1.5 bg-rose-950/80 rounded-xl text-xs hover:bg-rose-900 border border-rose-500/40 text-white cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Period Selector Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setViewFilterPeriod('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                viewFilterPeriod === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All Periods ({currentPlanPeriods.length})
            </button>
            {currentPlanPeriods.map((period, pIdx) => {
              const isSelected = viewFilterPeriod === pIdx;
              const isLiveRealTime = realTimePeriodIdx === pIdx;
              const isTimerRunning = periodTimerIdx === pIdx && periodTimerActive;
              return (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => setViewFilterPeriod(pIdx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-md font-black'
                      : isLiveRealTime
                      ? 'bg-slate-900 text-emerald-400 border-emerald-400/80 ring-1 ring-emerald-500/40'
                      : isTimerRunning
                      ? 'bg-slate-900 text-amber-300 border-amber-400/60'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {isLiveRealTime && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
                  <span>P{pIdx + 1}</span>
                  <span className="text-[10px] opacity-80 font-mono">({period.time || 0}m)</span>
                </button>
              );
            })}
          </div>

          {/* Mobile-Friendly Period Cards */}
          <div className="space-y-4">
            {currentPlanPeriods
              .map((period, pIdx) => ({ period, pIdx }))
              .filter(({ pIdx }) => viewFilterPeriod === 'all' || viewFilterPeriod === pIdx)
              .map(({ period, pIdx }) => {
                // Calculate time string safely from baseStartMinutes
                let runningMin = baseStartMinutes;
                for (let i = 0; i < pIdx; i++) {
                  runningMin += Number(currentPlanPeriods[i]?.time) || 0;
                }
                const pDuration = Number(period.time) || 0;
                const pEndMin = runningMin + pDuration;
                const timeSpanStr = `${formatTimeMinutes(runningMin)} - ${formatTimeMinutes(pEndMin)}`;

                const rawStations = Array.isArray(period.stations) ? period.stations : [];
                const validStations = rawStations.filter((st): st is PracticeStation => Boolean(st && typeof st === 'object'));
                const isRunning = activeViewingPeriodIdx === pIdx;
                const isLiveNow = realTimePeriodIdx === pIdx;

                return (
                  <div
                    key={pIdx}
                    className={`rounded-3xl border transition-all p-4 sm:p-5 space-y-3.5 shadow-xl ${
                      isLiveNow
                        ? 'bg-slate-850 border-emerald-500/80 ring-2 ring-emerald-500/40'
                        : isRunning
                        ? 'bg-slate-850 border-indigo-500/70 ring-1 ring-indigo-500/30'
                        : 'bg-slate-850/90 border-slate-700/80'
                    }`}
                  >
                    {/* Period Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-750">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                          Period {pIdx + 1}
                        </span>

                        {period.category && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black uppercase bg-slate-900 text-amber-300 border border-slate-700">
                            {period.category}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-slate-900 text-slate-300 border border-slate-800">
                          {period.format === 'rotating' ? '🔄 Stations Rotate' : 'Static Whole-Group'}
                        </span>

                        {isLiveNow && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Live Now</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Period Scheduled Time Window */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono text-xs font-black border border-slate-750">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{timeSpanStr}</span>
                          <span className="text-emerald-400 font-sans">({pDuration}m)</span>
                        </div>

                        {/* Quick +/- 5m drill adjustment on mobile for coaches */}
                        {userRole === 'admin' && (
                          <div className="flex items-center bg-slate-900 rounded-xl border border-slate-750 p-0.5">
                            <button
                              type="button"
                              onClick={() => onUpdatePeriodTime(pIdx, Math.max(1, pDuration - 5))}
                              className="px-2 py-0.5 text-xs font-black text-rose-400 hover:bg-rose-950/50 rounded-lg transition-all active:scale-95"
                              title="Decrease period by 5 minutes"
                            >
                              -5m
                            </button>
                            <span className="text-slate-600 text-[10px]">•</span>
                            <button
                              type="button"
                              onClick={() => onUpdatePeriodTime(pIdx, pDuration + 5)}
                              className="px-2 py-0.5 text-xs font-black text-emerald-400 hover:bg-emerald-950/50 rounded-lg transition-all active:scale-95"
                              title="Increase period by 5 minutes"
                            >
                              +5m
                            </button>
                          </div>
                        )}

                        {/* Period Timer Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setPeriodTimerIdx(pIdx);
                            setPeriodTimerSecondsLeft(pDuration * 60);
                            setPeriodTimerActive(true);
                            setActiveViewingPeriodIdx(pIdx);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            periodTimerIdx === pIdx && periodTimerActive
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750'
                          }`}
                          title="Start whistle timer for this period"
                        >
                          <Timer className="w-3.5 h-3.5 text-amber-400" />
                          <span>{periodTimerIdx === pIdx && periodTimerActive ? 'Timing...' : 'Run Timer'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Stations / Drills in this Period */}
                    <div className="space-y-3">
                      {validStations.map((station, sIdx) => {
                        const numStations = validStations.length;
                        const stationDuration = period.format === 'rotating' && numStations > 0 ? Math.max(1, Math.round(pDuration / numStations)) : pDuration;
                        const stationStartMin = runningMin + sIdx * stationDuration;
                        const stationEndMin = sIdx === numStations - 1 ? pEndMin : stationStartMin + stationDuration;
                        const stationTimeStr = `${formatTimeMinutes(stationStartMin)} - ${formatTimeMinutes(stationEndMin)}`;

                        return (
                        <div
                          key={sIdx}
                          className="bg-slate-900/90 rounded-2xl border border-slate-750 p-3.5 sm:p-4 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {validStations.length > 1 && (
                                <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-black text-xs">
                                  {sIdx + 1}
                                </span>
                              )}
                              <h4
                                className={`font-black text-white tracking-tight ${
                                  viewFontSize === 'large' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                                }`}
                              >
                                {station.name || `Drill Station ${sIdx + 1}`}
                              </h4>

                              {/* Station Rotation Time Pill */}
                              {period.format === 'rotating' && validStations.length > 1 && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-950/40 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>{stationTimeStr} ({stationDuration}m)</span>
                                </span>
                              )}
                            </div>

                            {station.coach && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-950/80 border border-indigo-700/50 text-indigo-200 text-xs font-black">
                                <Users className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Coach: {station.coach}</span>
                              </div>
                            )}
                          </div>

                          {station.desc && (
                            <p
                              className={`text-slate-200 leading-relaxed font-medium whitespace-pre-wrap ${
                                viewFontSize === 'large' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                              }`}
                            >
                              {station.desc}
                            </p>
                          )}

                          {station.focus && (
                            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5 text-amber-200 flex items-start gap-2">
                              <span className="font-black text-amber-400 uppercase text-[11px] shrink-0 mt-0.5">
                                Key Focus:
                              </span>
                              <span
                                className={`font-semibold ${
                                  viewFontSize === 'large' ? 'text-xs sm:text-sm' : 'text-xs'
                                }`}
                              >
                                {station.focus}
                              </span>
                            </div>
                          )}

                          {/* Drill Whiteboard Link, Instructions & Print Drill (print:hidden) */}
                          {station.name && (
                            <div className="flex items-center gap-2 pt-1 flex-wrap print:hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const matched = findMatchingWhiteboardDrill(station.name, effectiveWhiteboardDrills);
                                  const drillObj =
                                    matched ||
                                    createCustomDrillFromStation(station, pIdx + 1, period.category || period.name);
                                  setInstructionsModalDrill({
                                    drill: drillObj,
                                    stationName: station.name,
                                    stationDesc: station.desc,
                                    stationFocus: station.focus,
                                    stationCoach: station.coach,
                                    periodName: period.name || period.title,
                                    periodNumber: pIdx + 1,
                                    periodDuration: period.durationMinutes || period.duration,
                                  });
                                }}
                                className="px-2.5 py-1 bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 hover:text-white text-xs font-bold rounded-lg border border-indigo-500/35 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                title={`View instructions, cues, and diagram for ${station.name}`}
                              >
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Instructions</span>
                              </button>

                              {onOpenWhiteboardDrill && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matched = findMatchingWhiteboardDrill(station.name, effectiveWhiteboardDrills);
                                    if (matched) {
                                      onOpenWhiteboardDrill(matched.id, matched.category);
                                    } else {
                                      onOpenWhiteboardDrill(station.name);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 hover:text-white text-xs font-bold rounded-lg border border-blue-500/35 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                  title={`Open ${station.name} in interactive whiteboard`}
                                >
                                  <PenTool className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Open in Whiteboard</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const matched = findMatchingWhiteboardDrill(station.name, effectiveWhiteboardDrills);
                                  if (matched) {
                                    printDrillSheet(matched, 0);
                                  } else {
                                    printDrillSheet({
                                      id: `station-${pIdx}-${sIdx}`,
                                      title: station.name,
                                      subtitle: `${period.category || 'Practice'} • Period ${pIdx + 1}`,
                                      category: 'TEAM',
                                      categoryLabel: 'Practice Drill',
                                      objective: station.desc || 'Station execution & coaching fundamentals',
                                      diagramKeys: [],
                                      cues: station.focus ? [station.focus] : ['Execute with burst', 'Communicate assignments'],
                                      faults: ['Lack of burst', 'Slowing down before completion'],
                                      phases: [
                                        {
                                          name: 'Field Setup & Execution',
                                          description: station.desc || 'Station execution & coaching fundamentals',
                                          tokens: [],
                                          arrows: [],
                                          zones: [],
                                        },
                                      ],
                                    }, 0);
                                  }
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                title={`Print isolated drill sheet for ${station.name}`}
                              >
                                <Printer className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Print Drill Sheet</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                      {validStations.length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-400 italic">
                          No drill stations listed for this period.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Main Practice Schedule Table */}
      <div className={`bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl overflow-visible print:bg-transparent print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 ${viewOnlyMode ? 'hidden print:block' : ''}`}>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse practice-table text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 font-black uppercase text-[11px] border-b border-slate-700 print:bg-slate-100 print:text-black">
                <th className="py-3 px-3 text-left w-24 sm:w-28 print:w-[13%]">Time / Period</th>
                <th className="py-3 px-3 text-left w-28 sm:w-32 print:w-[10%]">Category</th>
                <th className="py-3 px-3.5 text-left print:w-[49%]">Stations / Drills</th>
                <th className="py-3 px-2.5 text-left w-28 sm:w-32 print:w-[11%]">Coaches</th>
                <th className="py-3 px-3 text-left w-36 sm:w-40 print:w-[17%]">Focus / Cues</th>
                {userRole === 'admin' && (
                  <th className="py-3 px-2 text-center w-20 print:hidden">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(currentPlanPeriods || [])
                .filter((row): row is PracticePeriod => Boolean(row && typeof row === 'object'))
                .map((row, pIdx, allPeriods) => {
                  const rowDuration = Number(row.time) || 0;
                  const periodStartMin = baseStartMinutes + (currentPlanPeriods || []).slice(0, pIdx).reduce((acc, p) => acc + (Number(p?.time) || 0), 0);
                  const periodEndMin = periodStartMin + rowDuration;
                  const timeString = `${formatTimeMinutes(periodStartMin)} - ${formatTimeMinutes(periodEndMin)}`;
                  const isRotating = row.format === 'rotating';

                  const rawStations = Array.isArray(row.stations) ? row.stations : [];
                  const validStations = rawStations.filter(
                    (st): st is PracticeStation => Boolean(st && typeof st === 'object')
                  );
                  const stationsList =
                    validStations.length > 0
                      ? validStations
                      : [{ name: '', desc: '', coach: '', focus: '' }];
                  const numStations = stationsList.length > 0 ? stationsList.length : 1;
                  const stationDuration =
                    isRotating && numStations > 0
                      ? rowDuration / numStations
                      : rowDuration;

                  const catInfo = getCategoryFolderInfo(row.category, cascadingDrills);
                  const isNearBottom = pIdx >= allPeriods.length - 2;

                  const element = stationsList.map((station, sIdx) => {
                    const safeStation = station || { name: '', desc: '', coach: '', focus: '' };
                    const isFirstStationInPeriod = sIdx === 0;
                    const coachPopupId = `coach_popup_${pIdx}_${sIdx}`;
                    const isCoachPopupOpen = activeCoachPopup === coachPopupId;
                    const stationFilterKey = `${pIdx}_${sIdx}`;
                    const currentGroupFilter = stationGroupFilters[stationFilterKey] || '';
                    const selectedSubfolderObj = catInfo.subfolders.find(
                      (sf) => sf.name === currentGroupFilter
                    );

                    const assignedCoachTokens = (safeStation.coach || '')
                      .split(/[,/&+\n]+/)
                      .map((c) => c.trim())
                      .filter(Boolean);

                    const stationStartMin =
                      periodStartMin + sIdx * stationDuration;
                    const stationEndMin = stationStartMin + stationDuration;

                    return (
                      <tr
                        key={`${pIdx}_${sIdx}`}
                        className={`border-b border-slate-700/70 ${
                          pIdx % 2 === 0 ? 'bg-slate-800/80' : 'bg-slate-850/60 bg-slate-800/50'
                        }`}
                      >
                        {/* Time / Period Cell (Rowspan) */}
                        {isFirstStationInPeriod && (
                          <td
                            rowSpan={numStations}
                            className="py-3.5 px-3.5 align-top border-r border-slate-700 font-bold"
                          >
                            <div className="text-xs font-black text-indigo-300 uppercase tracking-tight print:hidden">
                              Period {pIdx + 1}
                            </div>
                            <div className="hidden print:block font-black text-black uppercase tracking-tight leading-tight print-text-title">
                              Period {pIdx + 1}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 print:hidden">
                              <input
                                type="number"
                                value={row.time}
                                disabled={userRole !== 'admin'}
                                onChange={(e) =>
                                  onUpdatePeriodTime(
                                    pIdx,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                                className="w-12 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-100"
                              />
                              <span className="text-[11px] text-slate-400 font-medium">mins</span>
                            </div>
                            <div className="text-[11px] font-extrabold text-amber-300 mt-1.5 font-mono print:hidden">
                              {timeString}
                            </div>
                            <div className="hidden print:block font-extrabold text-black font-mono mt-1 leading-tight print-text-body">
                              {timeString}
                            </div>
                            <div className="hidden print:block font-bold text-slate-700 mt-0.5 leading-none print-text-sub">
                              ({row.time} min)
                            </div>
                          </td>
                        )}

                        {/* Category / Format Cell (Rowspan) */}
                        {isFirstStationInPeriod && (
                          <td
                            rowSpan={numStations}
                            className="py-3.5 px-3.5 align-top border-r border-slate-700 space-y-2"
                          >
                            <div className="print:hidden">
                              <select
                                value={row.category}
                                disabled={userRole !== 'admin'}
                                onChange={(e) =>
                                  onUpdatePeriodCategory(pIdx, e.target.value)
                                }
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200"
                              >
                                {cascadingDrills.map((folder) => (
                                  <option key={folder.name} value={folder.name}>
                                    {folder.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="hidden print:block font-black text-black uppercase tracking-tight leading-tight break-words print-text-title">
                              {row.category}
                            </div>

                            {/* Format selector (Static vs Rotating) */}
                            <div className="print:hidden">
                              <label className="text-[10px] uppercase font-black text-slate-400 block mb-1 tracking-wider">
                                Station Mode:
                              </label>
                              <select
                                value={row.format || 'static'}
                                disabled={userRole !== 'admin'}
                                onChange={(e) =>
                                  onUpdatePeriodFormat(
                                    pIdx,
                                    e.target.value as 'static' | 'rotating'
                                  )
                                }
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-slate-300"
                              >
                                <option value="static">Static Group</option>
                                <option value="rotating">Rotating Stations</option>
                              </select>
                            </div>
                            <div className="hidden print:block font-bold text-slate-700 mt-1 leading-none print-text-sub">
                              {isRotating ? 'Rotating' : 'Full Group'}
                            </div>
                          </td>
                        )}

                        {/* Station / Drill Title & Instructions */}
                        <td className="py-3 px-3.5 align-top border-r border-slate-700 space-y-2 print:space-y-1">
                          {/* Station Header: Station badge + Add Station & Delete Station buttons */}
                          <div className="flex items-center justify-between gap-2 flex-wrap pb-0.5 print:pb-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isRotating ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[10.5px] font-black border border-indigo-500/30 print:bg-slate-200 print:text-black print:border-slate-400 print:py-0.5 print:px-1.5 print:mb-1 print-text-badge">
                                  <Clock className="w-3 h-3 print:hidden" />
                                  <span className="font-mono print:font-bold">
                                    Station {sIdx + 1}: {formatTimeMinutes(stationStartMin)} -{' '}
                                    {formatTimeMinutes(stationEndMin)} (
                                    {Math.round(stationDuration)} min)
                                  </span>
                                </div>
                              ) : (
                                numStations > 1 && (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[10.5px] font-black border border-indigo-500/30 print:hidden">
                                    <span>Station {sIdx + 1} of {numStations}</span>
                                  </div>
                                )
                              )}
                            </div>

                            {/* Station-level Controls (Add Station / Delete Station) */}
                            {userRole === 'admin' && (
                              <div className="flex items-center gap-1.5 print:hidden ml-auto">
                                <button
                                  type="button"
                                  onClick={() => onAddStationToPeriod(pIdx)}
                                  title="Add another station to this period"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold text-sky-300 bg-sky-950/60 hover:bg-sky-900 border border-sky-700/60 rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
                                >
                                  <Plus className="w-3 h-3 text-sky-400" />
                                  <span>+ Station</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (numStations > 1) {
                                      if (confirm(`Delete Station ${sIdx + 1} ("${safeStation.name || 'Station'}") from Period ${pIdx + 1}? (The rest of Period ${pIdx + 1} will be kept)`)) {
                                        onRemoveStationFromPeriod(pIdx, sIdx);
                                      }
                                    } else {
                                      if (confirm(`Clear this station's drill details and coach assignments? (To delete the entire period, use "Del Period" in the Actions column)`)) {
                                        onRemoveStationFromPeriod(pIdx, sIdx);
                                      }
                                    }
                                  }}
                                  title={numStations > 1 ? `Delete Station ${sIdx + 1} from Period ${pIdx + 1}` : 'Clear station drill contents'}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold text-rose-300 hover:text-rose-100 bg-rose-950/60 hover:bg-rose-900 border border-rose-700/60 rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-400" />
                                  <span>{numStations > 1 ? `Delete Station ${sIdx + 1}` : 'Clear Station'}</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Position / Group & Drill Selectors */}
                          <div className="space-y-1.5 print:hidden">
                            {/* Position / Subgroup Filter Pill (Shown if category has multiple subfolders/positions) */}
                            {catInfo.subfolders.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1 text-[10.5px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                                  <Filter className="w-3 h-3 text-indigo-400" />
                                  <span>Position / Group:</span>
                                </div>
                                <select
                                  value={currentGroupFilter}
                                  disabled={userRole !== 'admin'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStationGroupFilters((prev) => ({
                                      ...prev,
                                      [stationFilterKey]: val,
                                    }));
                                  }}
                                  className="bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2 py-0.5 text-[11px] font-bold text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer truncate max-w-full"
                                >
                                  <option value="">
                                    📁 All {row.category} ({catInfo.allCategoryDrills.length} drills)
                                  </option>
                                  {catInfo.subfolders.map((sf) => (
                                    <option key={sf.name} value={sf.name}>
                                      🏈 {sf.name} ({sf.drills.length} drills)
                                    </option>
                                  ))}
                                  <option value="__ALL_CATEGORIES__">
                                    🌐 Browse All Library Categories (120+ drills)
                                  </option>
                                </select>
                              </div>
                            )}

                            {/* Truncated Drill Select Dropdown */}
                            <select
                              defaultValue=""
                              disabled={userRole !== 'admin'}
                              onChange={(e) => {
                                const drillName = e.target.value;
                                if (!drillName) return;
                                // Search in catInfo first, then allCategorizedDrills
                                let found = catInfo.allCategoryDrills.find((d) => d.name === drillName);
                                if (!found) {
                                  for (const grp of allCategorizedDrills) {
                                    found = grp.drills.find((d) => d.name === drillName);
                                    if (found) break;
                                  }
                                }
                                if (found) {
                                  onSelectDrillForStation(pIdx, sIdx, found);
                                  e.target.value = '';
                                }
                              }}
                              className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                            >
                              <option value="">
                                {selectedSubfolderObj
                                  ? `-- Choose ${selectedSubfolderObj.name} Drill (${selectedSubfolderObj.drills.length}) --`
                                  : currentGroupFilter === '__ALL_CATEGORIES__'
                                  ? `-- Choose Drill from Entire Library (120+ drills) --`
                                  : catInfo.allCategoryDrills.length > 0
                                  ? `-- Choose ${row.category} Drill (${catInfo.allCategoryDrills.length} drills) --`
                                  : `-- Choose Drill from Library --`}
                              </option>

                              {selectedSubfolderObj ? (
                                selectedSubfolderObj.drills.map((d, dIdx) => (
                                  <option key={`sub_${dIdx}`} value={d.name}>
                                    {d.name}
                                  </option>
                                ))
                              ) : currentGroupFilter === '__ALL_CATEGORIES__' ? (
                                allCategorizedDrills.map((grp, gIdx) => (
                                  <optgroup key={`grp_${gIdx}`} label={`📁 ${grp.category} (${grp.drills.length})`}>
                                    {grp.drills.map((d, dIdx) => (
                                      <option key={`all_${gIdx}_${dIdx}`} value={d.name}>
                                        {d.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))
                              ) : catInfo.subfolders.length > 0 ? (
                                catInfo.subfolders.map((sf, sfIdx) => (
                                  <optgroup key={`sf_${sfIdx}`} label={`📁 ${sf.name} (${sf.drills.length})`}>
                                    {sf.drills.map((d, dIdx) => (
                                      <option key={`sf_drill_${sfIdx}_${dIdx}`} value={d.name}>
                                        {d.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))
                              ) : (
                                catInfo.directDrills.map((d, dIdx) => (
                                  <option key={`dir_${dIdx}`} value={d.name}>
                                    {d.name}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>

                          {/* Station Title */}
                          <input
                            type="text"
                            value={safeStation.name || ''}
                            disabled={userRole !== 'admin'}
                            onChange={(e) =>
                              onUpdateStation(pIdx, sIdx, 'name', e.target.value)
                            }
                            placeholder="Drill / Group Name"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-100 focus:ring-1 focus:ring-indigo-500 disabled:bg-transparent disabled:border-transparent print:hidden"
                          />

                          {/* Station Details */}
                          <textarea
                            rows={2}
                            value={safeStation.desc || ''}
                            disabled={userRole !== 'admin'}
                            onChange={(e) =>
                              onUpdateStation(pIdx, sIdx, 'desc', e.target.value)
                            }
                            placeholder="Instructions, alignments, cone layout..."
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 text-xs font-medium text-slate-200 leading-relaxed focus:ring-1 focus:ring-indigo-500 resize-y disabled:bg-transparent disabled:border-transparent placeholder:text-slate-500 print:hidden"
                          />

                          {/* Whiteboard Link, Instructions & Print Drill Sheet (print:hidden) */}
                          {safeStation.name && (
                            <div className="flex items-center gap-2 pt-1 print:hidden flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const matched = findMatchingWhiteboardDrill(safeStation.name, effectiveWhiteboardDrills);
                                  const drillObj =
                                    matched ||
                                    createCustomDrillFromStation(safeStation, pIdx + 1, row.category || row.name);
                                  setInstructionsModalDrill({
                                    drill: drillObj,
                                    stationName: safeStation.name,
                                    stationDesc: safeStation.desc,
                                    stationFocus: safeStation.focus,
                                    stationCoach: safeStation.coach,
                                    periodName: row.name || row.title,
                                    periodNumber: pIdx + 1,
                                    periodDuration: row.durationMinutes || row.duration,
                                  });
                                }}
                                className="px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 hover:text-indigo-100 text-[10px] font-bold rounded-md border border-indigo-500/30 flex items-center gap-1 transition-all cursor-pointer"
                                title={`View instructions, cues, and diagram for ${safeStation.name}`}
                              >
                                <BookOpen className="w-2.5 h-2.5 text-indigo-400" />
                                <span>Instructions</span>
                              </button>

                              {onOpenWhiteboardDrill && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matched = findMatchingWhiteboardDrill(safeStation.name, effectiveWhiteboardDrills);
                                    if (matched) {
                                      onOpenWhiteboardDrill(matched.id, matched.category);
                                    } else {
                                      onOpenWhiteboardDrill(safeStation.name);
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 hover:text-blue-100 text-[10px] font-bold rounded-md border border-blue-500/30 flex items-center gap-1 transition-all cursor-pointer"
                                  title={`Open ${safeStation.name} on Interactive Whiteboard`}
                                >
                                  <PenTool className="w-2.5 h-2.5 text-blue-400" />
                                  <span>Open in Whiteboard</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const matched = findMatchingWhiteboardDrill(safeStation.name, effectiveWhiteboardDrills);
                                  if (matched) {
                                    printDrillSheet(matched, 0);
                                  } else {
                                    printDrillSheet({
                                      id: `station-${pIdx}-${sIdx}`,
                                      title: safeStation.name,
                                      subtitle: `${row.category || 'Practice'} • Period ${pIdx + 1}`,
                                      category: 'TEAM',
                                      categoryLabel: 'Practice Drill',
                                      objective: safeStation.desc || 'Station execution & coaching fundamentals',
                                      diagramKeys: [],
                                      cues: safeStation.focus ? [safeStation.focus] : ['Execute with burst', 'Communicate assignments'],
                                      faults: ['Lack of burst', 'Slowing down before completion'],
                                      phases: [
                                        {
                                          name: 'Field Setup & Execution',
                                          description: safeStation.desc || 'Station execution & coaching fundamentals',
                                          tokens: [],
                                          arrows: [],
                                          zones: [],
                                        },
                                      ],
                                    }, 0);
                                  }
                                }}
                                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold rounded-md border border-slate-600 flex items-center gap-1 transition-all cursor-pointer"
                                title={`Print isolated drill sheet for ${safeStation.name}`}
                              >
                                <Printer className="w-2.5 h-2.5 text-indigo-400" />
                                <span>Print Drill Sheet</span>
                              </button>
                            </div>
                          )}

                          {/* Print view */}
                          <div className="hidden print:block">
                            <div className="font-black text-black uppercase tracking-tight leading-snug print-text-title">
                              {safeStation.name || 'Station / Drill'}
                            </div>
                            {safeStation.desc && (
                              <div className="font-semibold text-slate-950 mt-1 whitespace-pre-wrap leading-relaxed print-text-body">
                                {safeStation.desc}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Coaches Column & Smart Scrolling Selector */}
                        <td className="py-3 px-3.5 align-top border-r border-slate-700 relative">
                          {/* Render assigned coach chips for immediate clarity */}
                          {assignedCoachTokens.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5 print:hidden">
                              {assignedCoachTokens.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-500/40 text-[10px] font-bold text-indigo-300 flex items-center gap-1"
                                >
                                  <span>{c}</span>
                                  {userRole === 'admin' && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextTokens = assignedCoachTokens.filter((_, idx) => idx !== cIdx);
                                        onUpdateStation(pIdx, sIdx, 'coach', nextTokens.join(', '));
                                      }}
                                      className="hover:text-rose-400 text-indigo-400 cursor-pointer p-0.5 rounded"
                                      title={`Remove ${c} from this station`}
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          <textarea
                            rows={2}
                            value={safeStation.coach || ''}
                            disabled={userRole !== 'admin'}
                            onChange={(e) =>
                              onUpdateStation(pIdx, sIdx, 'coach', e.target.value)
                            }
                            placeholder="Type or select coach names..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-100 leading-tight focus:ring-1 focus:ring-indigo-500 resize-y disabled:bg-transparent disabled:border-transparent placeholder:text-slate-500 print:hidden hidden-print"
                          />

                          <div
                            onClick={() => {
                              setCoachSearchTerm('');
                              setActiveCoachPopup(
                                isCoachPopupOpen ? null : coachPopupId
                              );
                            }}
                            className="text-[11px] text-indigo-400 font-bold cursor-pointer mt-1.5 hover:underline print:hidden hidden-print flex items-center gap-1 select-none"
                          >
                            <Users className="w-3 h-3 text-indigo-400" />
                            <span>Select Coaches</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${isCoachPopupOpen ? 'rotate-180' : ''}`} />
                          </div>

                          <div className="hidden print:block font-bold text-black leading-snug break-words print-text-body">
                            {safeStation.coach || '—'}
                          </div>

                          {/* Enhanced Coach Multi-select Popup with Upward Smart Flipping */}
                          {isCoachPopupOpen && (
                            <div
                              className={`absolute left-0 w-72 bg-slate-850 border border-slate-600 rounded-2xl shadow-2xl p-3.5 z-50 space-y-2.5 print:hidden hidden-print backdrop-blur-md ring-1 ring-slate-700/80 ${
                                isNearBottom ? 'bottom-full mb-2' : 'top-full mt-1.5'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                <div className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                                  <span className="text-xs font-black text-slate-100">
                                    Assign Coaching Staff
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveCoachPopup(null)}
                                  className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-750 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Coach Search filter */}
                              {savedCoaches.length > 4 && (
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                  <input
                                    type="text"
                                    value={coachSearchTerm}
                                    onChange={(e) => setCoachSearchTerm(e.target.value)}
                                    placeholder="Search coaches..."
                                    className="w-full pl-8 pr-2.5 py-1 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                              )}

                              {/* Coaches List with Large Readability */}
                              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                                {savedCoaches
                                  .filter((c) =>
                                    !coachSearchTerm ||
                                    c.toLowerCase().includes(coachSearchTerm.toLowerCase().trim())
                                  )
                                  .map((coachName) => {
                                    const normCoach = coachName.toLowerCase().replace(/^coach\s+/, '').trim();
                                    const isChecked = assignedCoachTokens.some((t) => {
                                      const normT = t.toLowerCase().replace(/^coach\s+/, '').trim();
                                      return (
                                        normT === normCoach ||
                                        t.toLowerCase().trim() === coachName.toLowerCase().trim()
                                      );
                                    });

                                    return (
                                      <div
                                        key={coachName}
                                        className={`flex items-center justify-between p-2 rounded-xl transition-all border ${
                                          isChecked
                                            ? 'bg-indigo-950/70 border-indigo-500/40 text-indigo-100'
                                            : 'hover:bg-slate-750/70 border-transparent text-slate-200'
                                        }`}
                                      >
                                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              let updatedTokens = [...assignedCoachTokens];
                                              if (e.target.checked) {
                                                const exists = updatedTokens.some((t) => {
                                                  const normT = t.toLowerCase().replace(/^coach\s+/, '').trim();
                                                  return normT === normCoach || t.toLowerCase() === coachName.toLowerCase();
                                                });
                                                if (!exists) {
                                                  updatedTokens.push(coachName);
                                                }
                                              } else {
                                                updatedTokens = updatedTokens.filter((t) => {
                                                  const normT = t.toLowerCase().replace(/^coach\s+/, '').trim();
                                                  return normT !== normCoach && t.toLowerCase().trim() !== coachName.toLowerCase().trim();
                                                });
                                              }
                                              onUpdateStation(
                                                pIdx,
                                                sIdx,
                                                'coach',
                                                updatedTokens.join(', ')
                                              );
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700 w-4 h-4 cursor-pointer"
                                          />
                                          <span className="text-xs font-bold">
                                            {coachName}
                                          </span>
                                        </label>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Remove "${coachName}" from the team coach list?`)) {
                                              const updatedTokens = assignedCoachTokens.filter((t) => {
                                                const normT = t.toLowerCase().replace(/^coach\s+/, '').trim();
                                                return normT !== normCoach && t.toLowerCase().trim() !== coachName.toLowerCase().trim();
                                              });
                                              onUpdateStation(pIdx, sIdx, 'coach', updatedTokens.join(', '));
                                              onDeleteSavedCoach(coachName);
                                            }
                                          }}
                                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                          title={`Delete ${coachName} from team list`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}

                                {savedCoaches.length === 0 && (
                                  <div className="p-3 text-center text-xs text-slate-400">
                                    No saved coaches found for this team. Add coaches below.
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-700 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={quickNewCoachInput}
                                    onChange={(e) => setQuickNewCoachInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && quickNewCoachInput.trim()) {
                                        e.preventDefault();
                                        onAddNewSavedCoach(quickNewCoachInput.trim());
                                        setQuickNewCoachInput('');
                                      }
                                    }}
                                    placeholder="Add coach name(s)..."
                                    className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (quickNewCoachInput.trim()) {
                                        onAddNewSavedCoach(quickNewCoachInput.trim());
                                        setQuickNewCoachInput('');
                                      } else {
                                        const name = prompt('Enter new Coach Name (e.g. Coach Dan, Coach Mike):');
                                        if (name && name.trim()) {
                                          onAddNewSavedCoach(name.trim());
                                        }
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Add</span>
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-400 text-center">
                                  You can add multiple names separated by commas
                                </div>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Coaching Focus Column */}
                        <td className="py-3 px-3.5 align-top border-r border-slate-700">
                          <textarea
                            rows={2}
                            value={safeStation.focus || ''}
                            disabled={userRole !== 'admin'}
                            onChange={(e) =>
                              onUpdateStation(pIdx, sIdx, 'focus', e.target.value)
                            }
                            placeholder="Key coaching cues & assignments..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs font-semibold text-slate-200 leading-tight focus:ring-1 focus:ring-indigo-500 resize-y disabled:bg-transparent disabled:border-transparent placeholder:text-slate-500 print:hidden"
                          />
                          <div className="hidden print:block font-medium text-black whitespace-pre-wrap leading-relaxed print-text-body">
                            {safeStation.focus || '—'}
                          </div>
                        </td>

                        {/* Period Actions (Only on first station row in the period) */}
                        {userRole === 'admin' && isFirstStationInPeriod && (
                          <td
                            rowSpan={numStations}
                            className="py-3.5 px-2 align-top text-center print:hidden"
                          >
                            <div className="flex flex-col items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/60">
                              <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                                Period
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onMovePeriod(pIdx, -1)}
                                  title="Move Period Up"
                                  className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-slate-100 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onMovePeriod(pIdx, 1)}
                                  title="Move Period Down"
                                  className="p-1 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-slate-100 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => onRemovePeriod(pIdx)}
                                title="Delete Entire Period"
                                className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/70 border border-rose-800/50 text-rose-300 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer w-full justify-center"
                              >
                                <Trash2 className="w-3 h-3 text-rose-400" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  });

                  return element;
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extra bottom scroll cushion to allow generous scrolling */}
      <div className="h-44 print:hidden" aria-hidden="true" />

      {/* Practice Cadence & Multi-Week Wizard */}
      <PracticeWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        practiceTemplates={practiceTemplates}
        currentWeek={currentPlan?.weekFolder ? currentPlan.weekFolder.replace('Week ', '') : '1'}
        onGenerate={(res) => {
          if (onPracticeWizardGenerate) {
            onPracticeWizardGenerate(res);
          }
        }}
      />

      {/* Practice Plan & Selected Drill Whiteboard Package Print Modal */}
      {currentPlan && (
        <PracticePlanPrintModal
          isOpen={isPrintPackageModalOpen}
          onClose={() => setIsPrintPackageModalOpen(false)}
          plan={currentPlan}
          periods={currentPlanPeriods}
          seqInfo={currentSeq}
          whiteboardDrills={effectiveWhiteboardDrills}
          initialPrintFontSize={printFontSize}
          onOpenWhiteboardDrill={onOpenWhiteboardDrill}
          formations={formations}
          depthChart={depthChart}
          activeTeamName={activeTeamName}
        />
      )}

      {/* Pocket Depth Chart Print Modal (All Formations) */}
      {isPocketModalOpen && (
        <PocketDepthChartPrintModal
          isOpen={isPocketModalOpen}
          onClose={() => setIsPocketModalOpen(false)}
          formations={formations}
          depthChart={depthChart}
          activeUnit="all"
          activeTeamName={activeTeamName || 'Football Manager'}
          seasonLabel="Practice & Game Formations"
        />
      )}

      {/* Drill Instructions & Whiteboard Preview Modal */}
      <DrillInstructionsModal
        isOpen={!!instructionsModalDrill}
        onClose={() => setInstructionsModalDrill(null)}
        drill={instructionsModalDrill?.drill || null}
        stationName={instructionsModalDrill?.stationName}
        stationDesc={instructionsModalDrill?.stationDesc}
        stationFocus={instructionsModalDrill?.stationFocus}
        stationCoach={instructionsModalDrill?.stationCoach}
        periodName={instructionsModalDrill?.periodName}
        periodNumber={instructionsModalDrill?.periodNumber}
        periodDuration={instructionsModalDrill?.periodDuration}
        onOpenWhiteboard={(drillId, cat) => {
          setInstructionsModalDrill(null);
          if (onOpenWhiteboardDrill) {
            onOpenWhiteboardDrill(drillId, cat);
          }
        }}
      />

      {/* Mobile Floating Sideline Stopwatch Dock (Optimized for Phones on Field) */}
      {currentPlanPeriods.length > 0 && (
        <div className="fixed bottom-2 left-2 right-2 md:hidden z-40 bg-slate-950/95 border border-slate-800 backdrop-blur-md rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${
              isTransitionBreak
                ? 'bg-amber-500 text-slate-950 animate-pulse'
                : periodTimerActive
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-850 text-slate-300'
            }`}>
              {isTransitionBreak ? <RotateCw className="w-5 h-5 animate-spin" /> : <Timer className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-white truncate">
                  {isTransitionBreak ? (
                    <span className="text-amber-300">BREAK ({transitionSecondsLeft}s)</span>
                  ) : (
                    `P${periodTimerIdx + 1}: ${currentPlanPeriods[periodTimerIdx]?.category || 'Drill'}`
                  )}
                </span>
                {timerAutoAdvance && (
                  <span className="text-[9px] font-bold px-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 shrink-0">
                    AUTO
                  </span>
                )}
              </div>
              <div className="font-mono text-base font-black tracking-tight text-white leading-tight">
                {isTransitionBreak
                  ? `00:${transitionSecondsLeft < 10 ? '0' + transitionSecondsLeft : transitionSecondsLeft}`
                  : formatTimerSeconds(periodTimerSecondsLeft)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isTransitionBreak ? (
              <button
                type="button"
                onClick={handleStartNextPeriodNow}
                className="h-11 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start P{periodTimerIdx + 2}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleToggleTimer}
                  className={`h-11 px-3.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${
                    periodTimerActive
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-600 text-white shadow-emerald-600/30'
                  }`}
                >
                  {periodTimerActive ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start</span>
                    </>
                  )}
                </button>

                {periodTimerIdx < currentPlanPeriods.length - 1 && (
                  <button
                    type="button"
                    onClick={handleSkipToNextPeriod}
                    className="w-11 h-11 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 flex items-center justify-center active:scale-95"
                    title="Skip to next period"
                    aria-label="Skip to next period"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setIsStopwatchSettingsOpen(true)}
              className="w-11 h-11 rounded-xl bg-slate-850 hover:bg-slate-800 text-amber-400 border border-slate-750 flex items-center justify-center active:scale-95"
              title="Stopwatch Automation Settings"
              aria-label="Stopwatch Automation Settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
