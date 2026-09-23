import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Zap,
  Shield,
  Target,
  Users,
  Swords,
  ClipboardList,
  Copy,
  Check,
  Sparkles,
  Smartphone,
  Watch,
  Calendar,
  Menu,
  Layers,
  PenTool,
  Flame,
} from 'lucide-react';
import { MobileNavigationModal } from './components/MobileNavigationModal';
import {
  UnitType,
  DepthSubUnit,
  LiveDrillGroup,
  UserRole,
  RosterPlayer,
  PlacedPlayer,
  FormationBoard,
  FormationRow,
  PositionSlot,
  PracticePlan,
  DrillFolder,
  PlaybookGuideTree,
  PlaybookGuideOrder,
  StaffCoach,
  WeekState,
  PracticePeriod,
  PracticeStation,
  DrillItem,
  ScoutingData,
  ScheduleEvent,
  SeasonConfig,
  AttendanceRecord,
  Team,
  formatWeekLabel,
  SectionLock,
  WristbandData,
} from './types';
import {
  MASTER_ROSTER,
  INITIAL_DEFAULT_FORMATIONS,
  DEFAULT_CASCADING_DRILLS,
  DEFAULT_PRACTICE_TEMPLATES,
  DEFAULT_GUIDES_TREE,
  DEFAULT_GUIDES_ORDER,
  DEFAULT_SAVED_COACHES,
  DEFAULT_SAVED_COACHES_BY_TEAM,
  DEFAULT_TEAM_COACHES,
  MASTER_PLAY_LIBRARY,
  DEFAULT_SCHEDULE_EVENTS,
  DEFAULT_SEASON_CONFIG,
  DEFAULT_ATTENDANCE_LOGS,
  DEFAULT_INITIAL_PRACTICES,
  DEFAULT_TEAMS,
} from './data/initialData';
import {
  safeJSONParse,
  safeJSONSet,
  deepClone,
  safeJSONStringify,
  getFirebaseServices,
  parseCSV,
  escapeCSV,
  fetchServerState,
  checkServerHealth,
  saveServerState,
  subscribeServerEvents,
  fetchServerLocks,
  acquireServerLock,
  releaseServerLock,
  heartbeatServerLock,
  fetchActiveUsers,
  registerPresence,
  leavePresence,
  establishOpsSession,
  clearOpsSession,
  setAdminPasscodeOnServer,
  ActiveUserSession,
  normalizePracticeTemplates,
  normalizeCascadingDrills,
  CLIENT_ID,
  parseTimeString,
  formatTimeMinutes,
} from './services/storageService';
import {
  calculateWeekFolderForDate,
  getDayOfWeekForDate,
  getFormattedDayFolder,
  sanitizePracticePlans,
  findBestActivePracticeId,
} from './utils/practiceUtils';
import { getAutoActiveWeek, normalizeWeeklyData, extractBackupFormations, normalizeFormationUnit, getSeasonWeekList } from './utils/seasonWeekUtils';
import { getPreviousWeekKey, mergePffGradeCriteria, PffPlayerGroupOverrides } from './utils/pprGroups';
import { hydrateFilmSession } from './utils/hudlFilmImport';
import { normalizeRoster } from './utils/depthChartUtils';
import { triggerPrint } from './utils/printUtils';
import { isEventAlreadyInSchedule } from './utils/teamSnapSync';
import { VALID_UNITS, parseRouteHash, buildRouteHash } from './utils/routeUtils';
import {
  LOCAL_DEV_EMAIL,
  buildLocalDeveloperUser,
  canUseLocalDeveloperLogin,
  clearLocalDeveloperSession,
  hasLocalDeveloperSession,
  markLocalDeveloperSession,
} from './utils/localDeveloperAuth';

import { Header } from './components/Header';
import { NavigationTabs } from './components/NavigationTabs';
import { SidebarNavigation } from './components/SidebarNavigation';
import { DefensivePositionCategory, loadEffectiveWhiteboardDrills } from './components/whiteboard/whiteboardDrillData';
import { RosterSidebar } from './components/RosterSidebar';
import { FormationsView } from './components/FormationsView';
import { ScrimmageView } from './components/ScrimmageView';
import { PracticeLiveDrillsView } from './components/PracticeLiveDrillsView';
import { PlayerPprView } from './components/PlayerPprView';
import { WristbandView, normalizeWristbandContinuousNumbering } from './components/WristbandView';
import { CallSheetMainView } from './components/CallSheetMainView';
import { GameDayHubView } from './components/GameDayHubView';
import { USER_IMPORTED_GAME_DAY_PLAYS, INITIAL_TWO_WRISTBANDS_DATA } from './data/userGameDayPlays';
import { ExcelPlayImportModal } from './components/callSheet/ExcelPlayImportModal';
import { PlayDatabaseEntry, CallSheetData, CallSheetFullData } from './types/callSheet';
import { MASTER_PLAY_DATABASE, DEFAULT_CALL_SHEET_DATA } from './data/callSheetData';
import { syncWristbandToCallSheet } from './utils/wristbandLinking';
import { saveCallSheetSnapshot } from './utils/callSheetStorage';
import { ScoutingView } from './components/ScoutingView';
import { TendenciesView } from './components/scouting/TendenciesView';
import { PlaybookGuidesView } from './components/PlaybookGuidesView';
import { WhiteboardView } from './components/WhiteboardView';
import { DrillLibraryView } from './components/DrillLibraryView';
import { PracticePlanView } from './components/PracticePlanView';
import { StaffManagerView } from './components/StaffManagerView';
import { ScheduleView } from './components/ScheduleView';
import { PlayerHoursTracker } from './components/PlayerHoursTracker';
import { MobileHubView } from './components/MobileHubView';
import { HomeView } from './components/HomeView';
import { RosterManagerModal } from './components/RosterManagerModal';
import { PracticeWizardGeneratedResult } from './components/PracticeWizardModal';
import { PreferencesModal } from './components/PreferencesModal';
import { ThemeGalleryModal, THEME_SCHEMES } from './components/ThemeGalleryModal';
import { applyThemeScheme } from './utils/themeScheme';
import {
  mergeDeletedFormationIds,
  mergeFilmSession,
  mergePffCriteriaMaps,
  mergePffPlayerGroups,
  mergePffReviews,
  mergePracticePlansByLastEdited,
  mergeRemoteWeeklyData,
  mergeStaffByEmail,
  shouldKeepLocalCallSheet,
  shouldRejectStaleRemote,
} from './utils/remoteStateMerge';
import { applyCopiedFormationsToDeletedIds, copyWeekCharts } from './utils/copyWeek';
import {
  loadLiveDrillSlotLayouts,
  mergeLiveDrillSlotLayouts,
  persistLiveDrillSlotLayouts,
  scorePracticeDrillGroups,
} from './components/practiceDrillsUtils';
import { SeasonConfigModal } from './components/SeasonConfigModal';
import { ActiveCoachesModal } from './components/ActiveCoachesModal';
import { IdleTimeoutModal } from './components/IdleTimeoutModal';
import {
  AuthModal,
  CopyWeekModal,
  SelectivePrintModal,
  ScrimmageFilterModal,
  TemplatesManagerModal,
  ImportBackupModal,
} from './components/Modals';

export default function App() {
  // State Initialization from LocalStorage or Defaults
  const [weeklyData, setWeeklyData] = useState<Record<string, WeekState>>(() => {
    const raw = safeJSONParse('footballWeeklyData', {});
    const normalized = normalizeWeeklyData(raw);
    // Sanitize any existing form_10_spread or 10 Spread Offense entries
    for (const w of Object.values(normalized)) {
      if (w && Array.isArray(w.formations)) {
        w.formations = w.formations.filter(
          (f) => f && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
        );
      }
    }
    return normalized;
  });
  const [defaultFormations, setDefaultFormations] = useState<FormationBoard[]>(() => {
    const raw = safeJSONParse('footballDefaultFormations', INITIAL_DEFAULT_FORMATIONS);
    const forms = Array.isArray(raw) ? raw : INITIAL_DEFAULT_FORMATIONS;
    return forms.filter(
      (f: any) => f && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
    );
  });
  const [practiceData, setPracticeData] = useState<PracticePlan[]>(() => {
    const saved = safeJSONParse('footballPracticeData', null);
    let plansToUse: PracticePlan[] = [];
    if (saved && Array.isArray(saved) && saved.length > 0) {
      plansToUse = [...saved];
    } else {
      plansToUse = [...DEFAULT_INITIAL_PRACTICES];
    }
    // Filter out deprecated sample plan p_w3_2 and any 9/17 Situational 2-Minute plan
    plansToUse = plansToUse.filter((p) => {
      if (!p || typeof p !== 'object') return false;
      if (p.id === 'p_w3_2') return false;
      if (p.title && p.title.toLowerCase().includes('situational 2-minute') && p.date && p.date.includes('09-17')) return false;
      if (p.title === 'Week 3 - Situational 2-Minute & Scrimmage') return false;
      return true;
    });
    const sanitized = sanitizePracticePlans(
      plansToUse,
      safeJSONParse('footballScheduleEvents', DEFAULT_SCHEDULE_EVENTS)
    );
    safeJSONSet('footballPracticeData', sanitized);
    return sanitized;
  });
  const [practiceTemplates, setPracticeTemplates] = useState<
    Record<string, PracticePeriod[]>
  >(() =>
    normalizePracticeTemplates(
      safeJSONParse('footballPracticeTemplates', DEFAULT_PRACTICE_TEMPLATES)
    )
  );
  const [cascadingDrills, setCascadingDrills] = useState<DrillFolder[]>(() =>
    normalizeCascadingDrills(
      safeJSONParse('footballCascadingDrills', DEFAULT_CASCADING_DRILLS)
    )
  );
  const [guideTree, setGuideTree] = useState<PlaybookGuideTree>(() => {
    const saved = safeJSONParse<PlaybookGuideTree>('footballPdfGuidesTree', DEFAULT_GUIDES_TREE);
    const merged: PlaybookGuideTree = { ...DEFAULT_GUIDES_TREE, ...saved };
    // Seamlessly migrate: Remove standalone Hudl Installs and ensure Defense contains all Hudl plays
    if (merged['📥 Hudl Installs']) {
      delete merged['📥 Hudl Installs'];
    }
    if (merged['🛡️ Defense']) {
      merged['🛡️ Defense'] = {
        ...DEFAULT_GUIDES_TREE['🛡️ Defense'],
        ...merged['🛡️ Defense'],
      };
    }
    return merged;
  });
  const [guideOrder, setGuideOrder] = useState<PlaybookGuideOrder>(() => {
    const saved = safeJSONParse<PlaybookGuideOrder>('footballPdfGuidesOrder', DEFAULT_GUIDES_ORDER);
    if (
      !saved ||
      !saved.main ||
      !saved.main.includes('🛡️ Defense') ||
      saved.main.includes('📥 Hudl Installs')
    ) {
      return DEFAULT_GUIDES_ORDER;
    }
    // Also strip Hudl Installs from sub if present
    if (saved.sub && saved.sub['📥 Hudl Installs']) {
      delete saved.sub['📥 Hudl Installs'];
    }
    return saved;
  });
  const [savedCoaches, setSavedCoaches] = useState<string[]>(() =>
    safeJSONParse('footballSavedCoaches', DEFAULT_SAVED_COACHES)
  );
  const [teamSavedCoaches, setTeamSavedCoaches] = useState<Record<string, string[]>>(() =>
    safeJSONParse('footballTeamSavedCoaches', DEFAULT_SAVED_COACHES_BY_TEAM)
  );
  const [staffList, setStaffList] = useState<StaffCoach[]>(() =>
    safeJSONParse('footballTeamCoaches', DEFAULT_TEAM_COACHES)
  );
  const [adminPasscodeSet, setAdminPasscodeSet] = useState<boolean>(() => {
    try {
      localStorage.removeItem('footballAdminCustomPasscode');
    } catch {
      // ignore
    }
    return localStorage.getItem('footballAdminPasscodeSet') === 'true';
  });
  const [masterPlayLibrary, setMasterPlayLibrary] = useState<string[]>(() =>
    safeJSONParse('footballMasterPlays', MASTER_PLAY_LIBRARY)
  );
  const [deletedPlayIds, setDeletedPlayIds] = useState<string[]>(() => {
    const saved = safeJSONParse('footballDeletedPlayIds', null);
    if (saved && Array.isArray(saved)) return saved;
    return [];
  });
  const [deletedFormationIds, setDeletedFormationIds] = useState<string[]>(() => {
    const saved = safeJSONParse('footballDeletedFormationIds', null);
    const list = saved && Array.isArray(saved) ? [...saved] : [];
    const coreDefaultIds = new Set(
      INITIAL_DEFAULT_FORMATIONS.filter((f) => f.id !== 'form_10_spread').map((f) => f.id)
    );
    const sanitized = list.filter((id) => !coreDefaultIds.has(id));
    if (!sanitized.includes('form_10_spread')) {
      sanitized.push('form_10_spread');
    }
    return sanitized;
  });
  const [deletedPracticePlanIds, setDeletedPracticePlanIds] = useState<string[]>(() => {
    const saved = safeJSONParse('footballDeletedPracticePlanIds', null);
    const list = saved && Array.isArray(saved) ? [...saved] : [];
    if (!list.includes('p_w3_2')) {
      list.push('p_w3_2');
      safeJSONSet('footballDeletedPracticePlanIds', list);
    }
    return list;
  });
  const [playDatabase, setPlayDatabase] = useState<PlayDatabaseEntry[]>(() => {
    const saved = safeJSONParse('footballPlayDatabase', null);
    const savedDeleted = safeJSONParse('footballDeletedPlayIds', []);
    const deletedSet = new Set(Array.isArray(savedDeleted) ? savedDeleted : []);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      const existingFiltered = saved.filter((p: PlayDatabaseEntry) => !deletedSet.has(p.id));
      const missingUserPlays = USER_IMPORTED_GAME_DAY_PLAYS.filter(
        (up) => !deletedSet.has(up.id) && !existingFiltered.some((ep) => ep.name.toLowerCase() === up.name.toLowerCase())
      );
      if (missingUserPlays.length > 0) {
        const combined = [...missingUserPlays, ...existingFiltered];
        safeJSONSet('footballPlayDatabase', combined);
        return combined;
      }
      return existingFiltered;
    }
    return MASTER_PLAY_DATABASE.filter((p) => !deletedSet.has(p.id));
  });
  const [callSheetData, setCallSheetData] = useState<CallSheetData>(() => {
    const saved = safeJSONParse<CallSheetData | null>('footballCallSheetData', null);
    const backup = safeJSONParse<CallSheetData | null>('footballCallSheetData_backup', null);
    const historyList = safeJSONParse<any[]>('footballCallSheet_history', []);
    const historyLatest = historyList && historyList.length > 0 ? (historyList[0]?.data as CallSheetData) : null;

    const candidates = [saved, backup, historyLatest].filter(
      (c): c is CallSheetData => Boolean(c && typeof c === 'object' && (c.offenseSections || c.defenseSections))
    );

    let best: CallSheetData = DEFAULT_CALL_SHEET_DATA;
    let bestScore = -1;

    for (const c of candidates) {
      const lastEdited = (c as any).lastEdited || 0;
      let count = 0;
      (c.offenseSections || []).forEach((s) => s.plays?.forEach((p) => { if (p?.name?.trim()) count++; }));
      (c.defenseSections || []).forEach((s) => s.plays?.forEach((p) => { if (p?.name?.trim()) count++; }));
      const score = lastEdited > 0 ? lastEdited : count * 10;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  });
  const [wristbandData, setWristbandData] = useState<WristbandData>(() => {
    const saved = safeJSONParse<WristbandData | null>('footballWristbandData', null);
    if (saved && Array.isArray(saved.wristbands) && saved.wristbands.length > 0) {
      return saved;
    }
    return INITIAL_TWO_WRISTBANDS_DATA;
  });
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>(() => {
    const saved = safeJSONParse('footballScheduleEvents', null);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
    return DEFAULT_SCHEDULE_EVENTS;
  });
  const [seasonConfig, setSeasonConfig] = useState<SeasonConfig>(() =>
    safeJSONParse('footballSeasonConfig', DEFAULT_SEASON_CONFIG)
  );
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>(() => {
    const saved = safeJSONParse('footballAttendanceLogs', null);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      const hasWeek1 = saved.some(
        (l: AttendanceRecord) => l.week === '1' || l.scheduleEventId === 'evt_w1_p0'
      );
      if (!hasWeek1) {
        const week1Defaults = DEFAULT_ATTENDANCE_LOGS.filter((l) => l.week === '1');
        if (week1Defaults.length > 0) {
          const merged = [...saved, ...week1Defaults];
          safeJSONSet('footballAttendanceLogs', merged);
          return merged;
        }
      }
      return saved;
    }
    return DEFAULT_ATTENDANCE_LOGS;
  });
  const [pffGradeCriteria, setPffGradeCriteria] = useState(() =>
    mergePffGradeCriteria(safeJSONParse('footballPffGradeCriteria', null))
  );
  const [pffPlayerGroups, setPffPlayerGroups] = useState<PffPlayerGroupOverrides>(() =>
    safeJSONParse('footballPffPlayerGroups', {}) || {}
  );
  const [roster, setRoster] = useState<RosterPlayer[]>(() => {
    const saved = safeJSONParse('footballRoster', null);
    const normalized = normalizeRoster(saved, true);
    safeJSONSet('footballRoster', normalized);
    return normalized;
  });
  const [teams, setTeams] = useState<Team[]>(() =>
    safeJSONParse('footballTeams', DEFAULT_TEAMS)
  );

  // User Default Preferences
  const [defaultTeamId, setDefaultTeamId] = useState<string>(() =>
    safeJSONParse('footballDefaultTeamId', DEFAULT_TEAMS[0]?.id || 'team_10u')
  );
  const [defaultScreen, setDefaultScreen] = useState<UnitType>(() => {
    const saved = safeJSONParse('footballDefaultScreen', null);
    if (saved) return saved;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return isMobile ? 'mobile_hub' : 'schedule';
  });
  const [defaultDepthSubUnit, setDefaultDepthSubUnit] = useState<DepthSubUnit>(
    () => safeJSONParse('footballDefaultDepthSubUnit', 'offense')
  );

  // Active Session States (initializes to User Defaults if set)
  const [activeTeamId, setActiveTeamId] = useState<string>(() => {
    const savedDefault = safeJSONParse('footballDefaultTeamId', null);
    if (savedDefault) return savedDefault;
    return safeJSONParse('footballActiveTeamId', DEFAULT_TEAMS[0]?.id || 'team_10u');
  });

  const [currentWeek, setCurrentWeek] = useState<string>(() => {
    const saved = safeJSONParse('footballCurrentWeek', null);
    if (saved) return saved;
    const events = safeJSONParse('footballScheduleEvents', DEFAULT_SCHEDULE_EVENTS);
    const auto = getAutoActiveWeek(events);
    return auto.activeWeek || '1';
  });
  const [dismissedCopyPrompts, setDismissedCopyPrompts] = useState<Set<string>>(new Set());
  const isInternalNavRef = useRef(false);
  const modalOpenInHistoryRef = useRef<string | null>(null);

  const [_activeUnit, _setActiveUnitRaw] = useState<UnitType>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const parsed = parseRouteHash(window.location.hash);
      if (parsed.unit) return parsed.unit;
    }
    const savedDefault = safeJSONParse('footballDefaultScreen', null);
    if (savedDefault && VALID_UNITS.has(savedDefault)) return savedDefault;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) return 'mobile_hub';
    return safeJSONParse('footballActiveUnit', 'home');
  });
  const activeUnit = _activeUnit;

  const [depthSubUnit, setDepthSubUnit] = useState<DepthSubUnit>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const parsed = parseRouteHash(window.location.hash);
      if (parsed.subUnit) return parsed.subUnit;
    }
    const savedDefault = safeJSONParse('footballDefaultDepthSubUnit', null);
    if (savedDefault) return savedDefault;
    return 'offense';
  });
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(
    null
  );
  const [currentPracticeId, setCurrentPracticeId] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const parsed = parseRouteHash(window.location.hash);
      if (parsed.practiceId && parsed.practiceId !== 'p_w3_2') return parsed.practiceId;
    }
    const saved = safeJSONParse<string | null>('footballCurrentPracticeId', null);
    if (saved === 'p_w3_2') {
      safeJSONSet('footballCurrentPracticeId', null);
      return null;
    }
    return saved;
  });
  const [activeGuideMain, setActiveGuideMain] = useState<string>('Offense');
  const [activeGuideSub, setActiveGuideSub] = useState<string>('Full Playbook');
  const [printFontSize, setPrintFontSize] = useState<string>(() =>
    safeJSONParse('footballPrintFontSize', '12')
  );
  const [activeWhiteboardDrillId, setActiveWhiteboardDrillId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const parsed = parseRouteHash(window.location.hash);
      if (parsed.drillId) return parsed.drillId;
    }
    return 'krausko-blitz-master';
  });
  const [activeWhiteboardCategory, setActiveWhiteboardCategory] = useState<DefensivePositionCategory | 'ALL'>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const parsed = parseRouteHash(window.location.hash);
      if (parsed.drillCategory) return parsed.drillCategory;
    }
    return 'LB';
  });
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() =>
    safeJSONParse('footballSidebarExpanded', false)
  );
  const [autoOpenTakeAttendance, setAutoOpenTakeAttendance] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const parsed = parseRouteHash(window.location.hash);
      return Boolean(parsed.openTakeAttendance);
    }
    return false;
  });

  // Centralized route navigator supporting browser history, Back/Forward buttons, and deep links
  const navigateToUnit = useCallback(
    (
      unit: UnitType,
      options?: {
        subUnit?: DepthSubUnit;
        drillId?: string;
        drillCategory?: DefensivePositionCategory | 'ALL';
        practiceId?: string;
        openTakeAttendance?: boolean;
        replace?: boolean;
      }
    ) => {
      const effectiveSubUnit =
        options?.subUnit ||
        (['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'].includes(unit)
          ? (unit as DepthSubUnit)
          : undefined);

      if (effectiveSubUnit) {
        setDepthSubUnit(effectiveSubUnit);
      }
      if (options?.drillId) {
        setActiveWhiteboardDrillId(options.drillId);
      }
      if (options?.drillCategory) {
        setActiveWhiteboardCategory(options.drillCategory);
      }
      if (options?.practiceId) {
        setCurrentPracticeId(options.practiceId);
        safeJSONSet('footballCurrentPracticeId', options.practiceId);
      }
      if (options?.openTakeAttendance) {
        setAutoOpenTakeAttendance(true);
      }

      _setActiveUnitRaw(unit);
      safeJSONSet('footballActiveUnit', unit);

      if (typeof window !== 'undefined') {
        const hash = buildRouteHash(unit, {
          subUnit: effectiveSubUnit || depthSubUnit,
          drillId: options?.drillId || (unit === 'whiteboard' ? activeWhiteboardDrillId : undefined),
          drillCategory: options?.drillCategory || (unit === 'whiteboard' ? activeWhiteboardCategory : undefined),
          practiceId: options?.practiceId || (unit === 'practice' ? currentPracticeId || undefined : undefined),
          openTakeAttendance: options?.openTakeAttendance,
        });

        const stateObj = {
          unit,
          subUnit: effectiveSubUnit,
          drillId: options?.drillId,
          drillCategory: options?.drillCategory,
          practiceId: options?.practiceId,
          openTakeAttendance: options?.openTakeAttendance,
        };

        if (window.location.hash !== hash) {
          isInternalNavRef.current = true;
          if (options?.replace) {
            window.history.replaceState(stateObj, '', hash);
          } else {
            window.history.pushState(stateObj, '', hash);
          }
          setTimeout(() => {
            isInternalNavRef.current = false;
          }, 80);
        } else if (options?.replace) {
          window.history.replaceState(stateObj, '', hash);
        }
      }
    },
    [depthSubUnit, activeWhiteboardDrillId, activeWhiteboardCategory, currentPracticeId]
  );

  // Wrapped setActiveUnit maintaining backward compatibility across the entire application
  const setActiveUnit = useCallback(
    (action: React.SetStateAction<UnitType>) => {
      if (typeof action === 'function') {
        _setActiveUnitRaw((prev) => {
          const next = action(prev);
          if (next !== prev) {
            navigateToUnit(next);
          }
          return next;
        });
      } else {
        navigateToUnit(action);
      }
    },
    [navigateToUnit]
  );

  // Synchronize browser history Back and Forward buttons with internal unit and drill state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Ensure current route has valid hash on initial load
    const currentParsed = parseRouteHash(window.location.hash);
    if (!currentParsed.unit) {
      const initialHash = buildRouteHash(activeUnit, {
        subUnit: depthSubUnit,
        drillId: activeUnit === 'whiteboard' ? activeWhiteboardDrillId : undefined,
        drillCategory: activeUnit === 'whiteboard' ? activeWhiteboardCategory : undefined,
        practiceId: activeUnit === 'practice' ? currentPracticeId || undefined : undefined,
      });
      window.history.replaceState(
        {
          unit: activeUnit,
          subUnit: depthSubUnit,
          drillId: activeUnit === 'whiteboard' ? activeWhiteboardDrillId : undefined,
          drillCategory: activeUnit === 'whiteboard' ? activeWhiteboardCategory : undefined,
          practiceId: activeUnit === 'practice' ? currentPracticeId || undefined : undefined,
        },
        '',
        initialHash
      );
    } else if (currentParsed.unit !== activeUnit && VALID_UNITS.has(currentParsed.unit)) {
      _setActiveUnitRaw(currentParsed.unit as UnitType);
      safeJSONSet('footballActiveUnit', currentParsed.unit);
      if (currentParsed.subUnit) setDepthSubUnit(currentParsed.subUnit);
      if (currentParsed.drillId) setActiveWhiteboardDrillId(currentParsed.drillId);
      if (currentParsed.drillCategory) setActiveWhiteboardCategory(currentParsed.drillCategory);
      if (currentParsed.practiceId) setCurrentPracticeId(currentParsed.practiceId);
    }

    const handleUrlChange = (e?: PopStateEvent) => {
      // If triggered by our own pushState/replaceState, ignore
      if (isInternalNavRef.current) {
        return;
      }

      // 1. If mobile navigation drawer was open, close it on back
      if (modalOpenInHistoryRef.current === 'mobile_nav') {
        modalOpenInHistoryRef.current = null;
        setIsMobileNavOpen(false);
        return;
      }

      // 2. Parse destination from history state or URL hash
      const stateUnit = e?.state?.unit;
      const parsed = parseRouteHash(window.location.hash);
      const targetUnit = (stateUnit && VALID_UNITS.has(stateUnit) ? stateUnit : parsed.unit) as UnitType | null;

      if (targetUnit && VALID_UNITS.has(targetUnit)) {
        _setActiveUnitRaw(targetUnit);
        safeJSONSet('footballActiveUnit', targetUnit);

        const targetSubUnit = e?.state?.subUnit || parsed.subUnit;
        if (targetSubUnit) {
          setDepthSubUnit(targetSubUnit);
        } else if (['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'].includes(targetUnit)) {
          setDepthSubUnit(targetUnit as DepthSubUnit);
        }

        const targetDrillId = e?.state?.drillId || parsed.drillId;
        if (targetDrillId) {
          setActiveWhiteboardDrillId(targetDrillId);
        }
        const targetDrillCat = e?.state?.drillCategory || parsed.drillCategory;
        if (targetDrillCat) {
          setActiveWhiteboardCategory(targetDrillCat);
        }

        const targetPracticeId = e?.state?.practiceId || parsed.practiceId;
        if (targetPracticeId) {
          setCurrentPracticeId(targetPracticeId);
        }

        if (e?.state?.openTakeAttendance || parsed.openTakeAttendance) {
          setAutoOpenTakeAttendance(true);
        }
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Filter & Search States
  const [rosterSearchTerm, setRosterSearchTerm] = useState('');
  const [playSearchTerm, setPlaySearchTerm] = useState('');
  const [scrimmageFilters, setScrimmageFilters] = useState<string[] | null>(() =>
    safeJSONParse('footballScrimmageFilters', null)
  );
  const [collapsedFolders, setCollapsedFolders] = useState<
    Record<string, boolean>
  >(() => safeJSONParse('footballCollapsedFolders', {}));

  // Auth & Roles
  const [currentUser, setCurrentUser] = useState<any>(() =>
    typeof window !== 'undefined' && hasLocalDeveloperSession()
      ? buildLocalDeveloperUser()
      : null
  );
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ text: string; color: string }>({
    text: 'Local Storage Mode',
    color: '#22c55e',
  });

  // Real-Time Concurrency Section Locks & Active Users Presence
  const [activeLocks, setActiveLocks] = useState<SectionLock[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUserSession[]>([]);
  const [isActiveCoachesModalOpen, setIsActiveCoachesModalOpen] = useState(false);
  const [isIdleTimedOut, setIsIdleTimedOut] = useState(false);
  const lastUserActivityTimeRef = useRef<number>(Date.now());
  const isUserIdleRef = useRef<boolean>(false);

  // Modal Dialog States
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [isThemeGalleryOpen, setIsThemeGalleryOpen] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string>(() =>
    safeJSONParse('footballActiveThemeId', 'electric_volt')
  );
  // Site Display Theme Mode ('dark' | 'light') with account-based preference restoration
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    try {
      const lastUserKey = (localStorage.getItem('footballLastUserKey') || '').toLowerCase().trim();
      const userThemes = safeJSONParse<Record<string, 'dark' | 'light'>>('footballUserThemePreferences', {});
      const savedForUser = lastUserKey && userThemes ? userThemes[lastUserKey] : undefined;
      if (savedForUser === 'light' || savedForUser === 'dark') {
        return savedForUser;
      }
      const saved = localStorage.getItem('footballThemeMode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  const handleToggleThemeMode = (specificMode?: 'dark' | 'light') => {
    // Guard against callers wired straight to onClick, which would pass a
    // MouseEvent here and persist it as the theme mode.
    const requested = specificMode === 'dark' || specificMode === 'light' ? specificMode : undefined;
    setThemeMode((prev) => (requested ? requested : prev === 'dark' ? 'light' : 'dark'));
  };

  // Synchronize themeMode class on document & body + persist to user map & local storage
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'light') {
      root.classList.add('theme-light');
      document.body.classList.add('theme-light');
      root.classList.remove('theme-dark', 'dark');
      document.body.classList.remove('theme-dark', 'dark');
    } else {
      root.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
      root.classList.add('theme-dark', 'dark');
      document.body.classList.add('theme-dark', 'dark');
    }

    try {
      localStorage.setItem('footballThemeMode', themeMode);
    } catch {
      // ignore
    }

    const userKey = (currentUser?.email || currentUser?.displayName || 'guest').toLowerCase().trim();
    if (userKey) {
      try {
        localStorage.setItem('footballLastUserKey', userKey);
      } catch {
        // ignore
      }
      const userThemes = safeJSONParse<Record<string, 'dark' | 'light'>>('footballUserThemePreferences', {}) || {};
      userThemes[userKey] = themeMode;
      safeJSONSet('footballUserThemePreferences', userThemes);
    }
  }, [themeMode, currentUser?.email, currentUser?.displayName]);

  // Paint the selected visual scheme onto the document as CSS variables. Runs
  // after the light/dark effect above so it can override the mode's base ramp.
  useEffect(() => {
    applyThemeScheme(
      THEME_SCHEMES.find((scheme) => scheme.id === activeThemeId),
      themeMode
    );
  }, [activeThemeId, themeMode]);

  // When user logs in or switches account, automatically load their saved Light / Dark theme preference!
  useEffect(() => {
    const userKey = (currentUser?.email || currentUser?.displayName || 'guest').toLowerCase().trim();
    if (!userKey) return;
    try {
      localStorage.setItem('footballLastUserKey', userKey);
    } catch {
      // ignore
    }
    const userThemes = safeJSONParse<Record<string, 'dark' | 'light'>>('footballUserThemePreferences', {});
    if (userThemes && userThemes[userKey] && (userThemes[userKey] === 'light' || userThemes[userKey] === 'dark')) {
      setThemeMode(userThemes[userKey]);
    }
  }, [currentUser?.email, currentUser?.displayName]);
  const [isSeasonConfigModalOpen, setIsSeasonConfigModalOpen] = useState(false);
  const [isCopyWeekModalOpen, setIsCopyWeekModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [editingPlayerForModal, setEditingPlayerForModal] = useState<RosterPlayer | null>(null);
  const [selectivePrintUnit, setSelectivePrintUnit] = useState<
    'offense' | 'defense' | 'st' | 'groups' | null
  >(null);
  const [isScrimmageFilterOpen, setIsScrimmageFilterOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExcelPlayImportModalOpen, setIsExcelPlayImportModalOpen] = useState(false);

  // Global Excel Play Import handler
  const handleGlobalImportPlays = (importedPlays: PlayDatabaseEntry[], mode: 'append' | 'replace') => {
    // 1. Update masterPlayLibrary (strings)
    const newPlayNames = importedPlays.map((p) => p.name);
    let nextMaster: string[] = [];
    if (mode === 'replace') {
      nextMaster = Array.from(new Set(newPlayNames));
    } else {
      nextMaster = Array.from(new Set([...masterPlayLibrary, ...newPlayNames]));
    }
    setMasterPlayLibrary(nextMaster);
    latestStateRef.current.masterPlayLibrary = nextMaster;
    safeJSONSet('footballMasterPlays', nextMaster);

    // 2. Also update footballPlayDatabase
    const currentDb = playDatabase && playDatabase.length > 0 ? playDatabase : (safeJSONParse<PlayDatabaseEntry[]>('footballPlayDatabase', []) || []);
    let nextDb: PlayDatabaseEntry[] = [];
    if (mode === 'replace') {
      nextDb = importedPlays;
    } else {
      const existingFiltered = currentDb.filter(
        (ep) => !importedPlays.some((ip) => ip.name.toLowerCase() === ep.name.toLowerCase() && ip.unit === ep.unit)
      );
      nextDb = [...importedPlays, ...existingFiltered];
    }
    setPlayDatabase(nextDb);
    latestStateRef.current.playDatabase = nextDb;
    safeJSONSet('footballPlayDatabase', nextDb);
    debouncedSave('all');
  };

  // Drag-and-Drop Transferred Data Ref
  const draggedPlayerRef = useRef<{
    type: 'roster' | 'placed_player';
    name: string;
    num: string;
    sourcePosId?: string;
    sourceIndex?: number;
    isScrimmage?: boolean;
  } | null>(null);

  const draggedPositionCardRef = useRef<{
    formId: string;
    rIdx: number;
    pIdx: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drillCsvInputRef = useRef<HTMLInputElement | null>(null);
  const drillJsonInputRef = useRef<HTMLInputElement | null>(null);

  // Debounced Cloud Sync Timeout
  const saveTimeoutRef = useRef<any>(null);
  const initialCloudLoadDoneRef = useRef<boolean>(false);
  const pendingPracticeDrillSaveRef = useRef<boolean>(false);
  const isImportingRef = useRef<boolean>(false);
  const isRemoteSyncRef = useRef<boolean>(false);
  const lastSavedPayloadRef = useRef<string>('');
  const localServerVersionRef = useRef<number>(0);
  const localServerUpdatedAtRef = useRef<number>(0);
  const lastLocalEditTimeRef = useRef<number>(
    typeof window !== 'undefined' ? safeJSONParse('footballLastLocalEditTime', 0) : 0
  );
  const lastLocalCallSheetEditTimeRef = useRef<number>(0);
  const lastLocalWristbandEditTimeRef = useRef<number>(0);
  const activeUnitRef = useRef<string>(activeUnit);
  const activeTeamIdRef = useRef<string>(activeTeamId);
  const currentWeekRef = useRef<string>(currentWeek);
  const currentPracticeIdRef = useRef<string | null>(currentPracticeId);
  const recentlyModifiedPositionsRef = useRef<Map<string, number>>(
    new Map(
      typeof window !== 'undefined'
        ? (safeJSONParse('footballRecentlyModifiedPositions', []) || [])
        : []
    )
  );
  const recentlyModifiedFormationsRef = useRef<Map<string, number>>(new Map());

  // Helper to persistently record local position modifications
  const recordPositionEdit = (posId: string) => {
    const now = Date.now();
    lastLocalEditTimeRef.current = now;
    safeJSONSet('footballLastLocalEditTime', now);
    recentlyModifiedPositionsRef.current.set(posId, now);
    safeJSONSet(
      'footballRecentlyModifiedPositions',
      Array.from(recentlyModifiedPositionsRef.current.entries())
    );
  };

  // Helper to change current week and persist to localStorage
  const changeCurrentWeek = (wk: string) => {
    setCurrentWeek(wk);
    currentWeekRef.current = wk;
    safeJSONSet('footballCurrentWeek', wk);
    const targetKey = getScopedWeekKey(activeTeamIdRef.current, wk);
    const targetWeekState = weeklyData[targetKey] || weeklyData[wk];
    if (targetWeekState?.wristbandData?.wristbands?.length) {
      setWristbandData(targetWeekState.wristbandData);
      latestStateRef.current.wristbandData = targetWeekState.wristbandData;
      safeJSONSet('footballWristbandData', targetWeekState.wristbandData);
    } else {
      setWristbandData(INITIAL_TWO_WRISTBANDS_DATA);
      latestStateRef.current.wristbandData = INITIAL_TWO_WRISTBANDS_DATA;
      safeJSONSet('footballWristbandData', INITIAL_TWO_WRISTBANDS_DATA);
    }
  };

  activeUnitRef.current = activeUnit;
  activeTeamIdRef.current = activeTeamId;
  currentWeekRef.current = currentWeek;
  currentPracticeIdRef.current = currentPracticeId;

  const latestStateRef = useRef({
    weeklyData,
    defaultFormations,
    practiceData,
    practiceTemplates,
    cascadingDrills,
    guideTree,
    guideOrder,
    savedCoaches,
    teamSavedCoaches,
    staffList,
    adminPasscodeSet,
    masterPlayLibrary,
    playDatabase,
    callSheetData,
    wristbandData,
    globalIdleTimeoutMinutes: 30,
    deletedPlayIds,
    deletedFormationIds,
    deletedPracticePlanIds,
    collapsedFolders,
    scheduleEvents,
    roster,
    teams,
    seasonConfig,
    attendanceLogs,
    pffGradeCriteria,
    pffPlayerGroups,
    liveDrillSlotLayouts: loadLiveDrillSlotLayouts(),
  });

  useEffect(() => {
    latestStateRef.current = {
      weeklyData,
      defaultFormations,
      practiceData,
      practiceTemplates,
      cascadingDrills,
      guideTree,
      guideOrder,
      savedCoaches,
      teamSavedCoaches,
      staffList,
      adminPasscodeSet,
      masterPlayLibrary,
      playDatabase,
      callSheetData,
      wristbandData,
      globalIdleTimeoutMinutes: safeJSONParse('footballGlobalIdleTimeoutMinutes', 30),
      deletedPlayIds,
      deletedFormationIds,
      deletedPracticePlanIds,
      collapsedFolders,
      scheduleEvents,
      roster,
      teams,
      seasonConfig,
      attendanceLogs,
      pffGradeCriteria,
      pffPlayerGroups,
      liveDrillSlotLayouts: loadLiveDrillSlotLayouts(),
    };
  });

  // Determine current active depth chart unit
  const depthSubUnitRef = useRef<string>(depthSubUnit);
  depthSubUnitRef.current = depthSubUnit;

  const currentDepthUnit =
    activeUnit === 'depth_chart'
      ? (depthSubUnit === 'scrimmage' ? 'offense' : (depthSubUnit || 'offense'))
      : (['offense', 'defense', 'st', 'groups'].includes(activeUnit)
          ? (activeUnit as 'offense' | 'defense' | 'st' | 'groups')
          : 'offense');

  const currentDepthUnitRef = useRef<string>(currentDepthUnit);
  currentDepthUnitRef.current = currentDepthUnit;

  // Find active lock for current section
  const currentUnitLock = activeLocks.find((l) => {
    if (!l) return false;
    const sameTeam = l.teamId === activeTeamId;
    const sameWeek = String(l.week) === String(currentWeek);
    const sameUnit = l.unit === currentDepthUnit || l.unit === 'all';
    const notExpired = l.expiresAt > Date.now();
    return sameTeam && sameWeek && sameUnit && notExpired;
  });

  const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();
  const lockHolderEmail = (currentUnitLock?.holderEmail || '').toLowerCase().trim();

  const isLockedByOther = Boolean(
    currentUnitLock &&
    currentUserEmail &&
    lockHolderEmail &&
    lockHolderEmail !== currentUserEmail
  );

  const isHeldByMe = Boolean(
    currentUnitLock &&
    currentUserEmail &&
    lockHolderEmail &&
    lockHolderEmail === currentUserEmail
  );

  const lockHolderName = currentUnitLock?.holderName || currentUnitLock?.holderEmail || 'Another Coach';

  const handleAcquireLock = async (
    unitName: string = currentDepthUnit,
    weekNum: string = currentWeek,
    force = false
  ) => {
    const authorEmail = currentUser?.email || 'Coach';
    const authorName = currentUser?.displayName || authorEmail.split('@')[0];
    const res = await acquireServerLock({
      teamId: activeTeamId,
      week: String(weekNum),
      unit: unitName,
      holderEmail: authorEmail,
      holderName: authorName,
      force,
    });
    if (res && res.lock) {
      setActiveLocks((prev) => {
        const filtered = prev.filter(
          (l) => !(l.teamId === activeTeamId && String(l.week) === String(weekNum) && l.unit === unitName)
        );
        return [...filtered, res.lock!];
      });
    }
    return res;
  };

  const handleReleaseLock = async (
    unitName: string = currentDepthUnit,
    weekNum: string = currentWeek
  ) => {
    const authorEmail = currentUser?.email || 'Coach';
    const ok = await releaseServerLock({
      teamId: activeTeamId,
      week: String(weekNum),
      unit: unitName,
      holderEmail: authorEmail,
    });
    if (ok) {
      setActiveLocks((prev) =>
        prev.filter(
          (l) => !(l.teamId === activeTeamId && String(l.week) === String(weekNum) && l.unit === unitName)
        )
      );
    }
  };

  const handleTakeOverLock = async (
    unitName: string = currentDepthUnit,
    weekNum: string = currentWeek
  ) => {
    await handleAcquireLock(unitName, weekNum, true);
  };

  // Heartbeat to keep active editing locks alive
  useEffect(() => {
    if (!isHeldByMe || !currentUser?.email) return;
    const interval = setInterval(async () => {
      await heartbeatServerLock({
        teamId: activeTeamId,
        week: String(currentWeek),
        unit: currentDepthUnit,
        holderEmail: currentUser.email,
      });
    }, 25000);
    return () => clearInterval(interval);
  }, [isHeldByMe, activeTeamId, currentWeek, currentDepthUnit, currentUser?.email]);

  // Helper to count placed players in depth chart or scrimmage chart
  const countPlacedPlayers = (dc?: Record<string, PlacedPlayer[]>): number => {
    if (!dc || typeof dc !== 'object') return 0;
    return Object.values(dc).reduce(
      (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
      0
    );
  };

  // Helper to compute team-scoped week key
  const getScopedWeekKey = (teamId: string, week: string) => `${teamId}__week_${week}`;

  const getBestWristbandData = (
    candidates: (WristbandData | null | undefined)[]
  ): WristbandData => {
    const getRows = (wb: any) =>
      Math.max(Number(wb?.rows) || 13, ...(wb?.wristbands || []).map((w: any) => Number(w?.rowsCount) || 13));
    const countPlays = (wb: any) => {
      if (!wb || !Array.isArray(wb.wristbands)) return 0;
      let c = 0;
      for (const w of wb.wristbands) {
        for (const col of w?.columns || []) {
          for (const p of col?.plays || []) {
            if (p?.text?.trim()) c++;
          }
        }
      }
      return c;
    };

    let best: WristbandData | null = null;
    for (const c of candidates) {
      if (!c || !Array.isArray(c.wristbands) || c.wristbands.length === 0) continue;
      if (!best) {
        best = c;
        continue;
      }
      const cTime = Number(c.lastEdited) || 0;
      const bTime = Number(best.lastEdited) || 0;
      if (cTime > bTime) {
        best = c;
      } else if (cTime === bTime) {
        const cRows = getRows(c);
        const bRows = getRows(best);
        if (cRows > bRows || (cRows === bRows && countPlays(c) > countPlays(best))) {
          best = c;
        }
      }
    }
    return best || INITIAL_TWO_WRISTBANDS_DATA;
  };

  // Helper to resolve the richest week state (formations, depthChart, scrimmageChart, etc.)
  const resolveWeekState = (
    wData: Record<string, WeekState>,
    teamId: string,
    week: string
  ): WeekState => {
    const scopedKey = getScopedWeekKey(teamId, week);
    const scopedState = wData[scopedKey];
    const legacyState = wData[week];
    const defScopedKey = getScopedWeekKey('team_10u', week);
    const defScopedState = wData[defScopedKey];

    // Formations resolution
    const coreDefaultIds = new Set(
      INITIAL_DEFAULT_FORMATIONS.filter((f) => f.id !== 'form_10_spread').map((f) => f.id)
    );
    const rawDeleted = [
      ...(deletedFormationIds || []),
      ...(latestStateRef.current?.deletedFormationIds || []),
    ].filter((id) => !coreDefaultIds.has(id));
    const curDeletedSet = new Set<string>(rawDeleted);
    curDeletedSet.add('form_10_spread');

    let rawCandidateForms: FormationBoard[] = [];
    let hasExplicitFormations = false;

    if (Array.isArray(scopedState?.formations)) {
      rawCandidateForms = [...scopedState.formations];
      hasExplicitFormations = true;
    } else if (Array.isArray(legacyState?.formations)) {
      rawCandidateForms = [...legacyState.formations];
      hasExplicitFormations = true;
    } else if (Array.isArray(defScopedState?.formations)) {
      rawCandidateForms = [...defScopedState.formations];
      hasExplicitFormations = true;
    } else if (Array.isArray(wData['0']?.formations) && wData['0'].formations.length > 0) {
      rawCandidateForms = [...wData['0'].formations];
      hasExplicitFormations = true;
    } else if (
      Array.isArray(wData[getScopedWeekKey('team_10u', '0')]?.formations) &&
      wData[getScopedWeekKey('team_10u', '0')].formations.length > 0
    ) {
      rawCandidateForms = [...wData[getScopedWeekKey('team_10u', '0')].formations];
      hasExplicitFormations = true;
    } else {
      rawCandidateForms =
        defaultFormations && Array.isArray(defaultFormations) && defaultFormations.length > 0
          ? [...defaultFormations]
          : [...INITIAL_DEFAULT_FORMATIONS];
    }

    // Deduplicate by ID and filter out deleted formations
    const seenFormIds = new Set<string>();
    let formations: FormationBoard[] = [];

    for (const f of rawCandidateForms) {
      if (
        !f ||
        !f.id ||
        curDeletedSet.has(f.id) ||
        f.id === 'form_10_spread' ||
        f.name === '10 Spread Offense'
      )
        continue;
      if (seenFormIds.has(f.id)) continue;
      seenFormIds.add(f.id);
      formations.push(f);
    }

    // Ensure every week has core units (Offense, Defense, ST, Groups) populated
    for (const u of ['offense', 'defense', 'st', 'groups'] as const) {
      if (!formations.some((f) => f && f.unit === u)) {
        let defsForUnit = (defaultFormations || []).filter(
          (f) =>
            f &&
            f.unit === u &&
            !curDeletedSet.has(f.id) &&
            f.id !== 'form_10_spread' &&
            f.name !== '10 Spread Offense'
        );
        if (defsForUnit.length === 0) {
          defsForUnit = INITIAL_DEFAULT_FORMATIONS.filter(
            (f) =>
              f &&
              f.unit === u &&
              f.id !== 'form_10_spread' &&
              f.name !== '10 Spread Offense'
          );
        }
        for (const df of defsForUnit) {
          if (
            !seenFormIds.has(df.id) &&
            df.id !== 'form_10_spread'
          ) {
            formations.push(deepClone(df));
            seenFormIds.add(df.id);
          }
        }
      }
    }

    // Depth chart resolution: prioritize the state with real player assignments so empty stubs never wipe valid depth charts
    let depthChart: Record<string, PlacedPlayer[]> = {};
    const scopedDCCount = countPlacedPlayers(scopedState?.depthChart);
    const legacyDCCount = countPlacedPlayers(legacyState?.depthChart);
    const defScopedDCCount = countPlacedPlayers(defScopedState?.depthChart);
    const is10U = !teamId || teamId === 'team_10u';

    if (scopedDCCount > 0) {
      depthChart = scopedState!.depthChart!;
    } else if (is10U && legacyDCCount > 0) {
      depthChart = legacyState!.depthChart!;
    } else if (is10U && defScopedDCCount > 0) {
      depthChart = defScopedState!.depthChart!;
    } else if (scopedState && scopedState.depthChart !== undefined) {
      depthChart = scopedState.depthChart;
    } else if (is10U && legacyState && legacyState.depthChart !== undefined) {
      depthChart = legacyState.depthChart;
    } else if (is10U && defScopedState && defScopedState.depthChart !== undefined) {
      depthChart = defScopedState.depthChart;
    } else {
      depthChart = {};
    }

    // Scrimmage chart resolution: prioritize the state with real player assignments
    let scrimmageChart: Record<string, PlacedPlayer[]> = {};
    const scopedSCCount = countPlacedPlayers(scopedState?.scrimmageChart);
    const legacySCCount = countPlacedPlayers(legacyState?.scrimmageChart);
    const defScopedSCCount = countPlacedPlayers(defScopedState?.scrimmageChart);

    if (scopedSCCount > 0) {
      scrimmageChart = scopedState!.scrimmageChart!;
    } else if (is10U && legacySCCount > 0) {
      scrimmageChart = legacyState!.scrimmageChart!;
    } else if (is10U && defScopedSCCount > 0) {
      scrimmageChart = defScopedState!.scrimmageChart!;
    } else if (scopedState && scopedState.scrimmageChart !== undefined) {
      scrimmageChart = scopedState.scrimmageChart;
    } else if (is10U && legacyState && legacyState.scrimmageChart !== undefined) {
      scrimmageChart = legacyState.scrimmageChart;
    } else if (is10U && defScopedState && defScopedState.scrimmageChart !== undefined) {
      scrimmageChart = defScopedState.scrimmageChart;
    } else {
      scrimmageChart = {};
    }

    // Practice drill groups: keep the sheet with real names/assignments, not empty factory seeds
    const drillCandidates = [
      scopedState?.practiceDrillGroups,
      is10U ? legacyState?.practiceDrillGroups : undefined,
      is10U ? defScopedState?.practiceDrillGroups : undefined,
    ].filter((groups): groups is LiveDrillGroup[] => Array.isArray(groups) && groups.length > 0);
    let practiceDrillGroups: LiveDrillGroup[] = [];
    if (drillCandidates.length > 0) {
      practiceDrillGroups = drillCandidates.reduce((best, groups) =>
        scorePracticeDrillGroups(groups) > scorePracticeDrillGroups(best) ? groups : best
      );
    }

    return {
      formations,
      depthChart,
      scrimmageChart,
      practiceDrillGroups,
      opponent:
        scopedState?.opponent ||
        legacyState?.opponent ||
        defScopedState?.opponent ||
        '',
      wristbandData:
        (scopedState?.wristbandData?.wristbands?.length ? scopedState.wristbandData : undefined) ||
        (legacyState?.wristbandData?.wristbands?.length ? legacyState.wristbandData : undefined) ||
        (defScopedState?.wristbandData?.wristbands?.length ? defScopedState.wristbandData : undefined) ||
        (latestStateRef.current?.wristbandData?.wristbands?.length ? latestStateRef.current.wristbandData : undefined) ||
        safeJSONParse<WristbandData | null>('footballWristbandData', null) ||
        INITIAL_TWO_WRISTBANDS_DATA,
      scouting:
        scopedState?.scouting ||
        legacyState?.scouting ||
        defScopedState?.scouting,
      pprPlayCounts: (() => {
        const scopedCounts = scopedState?.pprPlayCounts;
        const legacyCounts = legacyState?.pprPlayCounts;
        const defCounts = defScopedState?.pprPlayCounts;
        if (scopedCounts && Object.keys(scopedCounts).length > 0) return scopedCounts;
        if (is10U && legacyCounts && Object.keys(legacyCounts).length > 0) return legacyCounts;
        if (is10U && defCounts && Object.keys(defCounts).length > 0) return defCounts;
        return scopedCounts || (is10U ? legacyCounts || defCounts : undefined) || {};
      })(),
      pffReviews: (() => {
        const scopedReviews = scopedState?.pffReviews;
        const legacyReviews = legacyState?.pffReviews;
        const defReviews = defScopedState?.pffReviews;
        if (scopedReviews && Object.keys(scopedReviews).length > 0) return scopedReviews;
        if (is10U && legacyReviews && Object.keys(legacyReviews).length > 0) return legacyReviews;
        if (is10U && defReviews && Object.keys(defReviews).length > 0) return defReviews;
        return scopedReviews || (is10U ? legacyReviews || defReviews : undefined) || {};
      })(),
      filmSession: (() => {
        const scopedFilm = scopedState?.filmSession;
        const legacyFilm = legacyState?.filmSession;
        const defFilm = defScopedState?.filmSession;
        const pick = (session?: WeekState['filmSession']) =>
          session && Array.isArray((session as { plays?: unknown[] }).plays) && (session as { plays?: unknown[] }).plays!.length > 0
            ? session
            : undefined;
        return hydrateFilmSession(
          pick(scopedFilm) || (is10U ? pick(legacyFilm) || pick(defFilm) : undefined) || scopedFilm || (is10U ? legacyFilm || defFilm : undefined)
        );
      })(),
    };
  };

  // Ensure current week object exists and copies formations from source week
  const ensureWeekExists = (week: string, sourceWeek?: string) => {
    setWeeklyData((prev) => {
      const currentResolved = resolveWeekState(prev, activeTeamId, week);
      const scopedKey = getScopedWeekKey(activeTeamId, week);

      if (currentResolved.formations && currentResolved.formations.length > 0) {
        if (prev[scopedKey] && prev[week]) return prev;
        return {
          ...prev,
          [scopedKey]: currentResolved,
          [week]: currentResolved,
        };
      }

      // Determine source week to copy formations from
      let srcWk = sourceWeek;
      if (!srcWk) {
        const num = parseInt(week, 10);
        if (!isNaN(num) && num > 1) {
          srcWk = String(num - 1);
        } else if (week === '1') {
          srcWk = '0';
        } else {
          srcWk = '0';
        }
      }

      const srcResolved = resolveWeekState(prev, activeTeamId, srcWk);
      const templateForms =
        srcResolved.formations && srcResolved.formations.length > 0
          ? srcResolved.formations
          : defaultFormations && defaultFormations.length > 0
            ? defaultFormations
            : INITIAL_DEFAULT_FORMATIONS;

      const newWeekState: WeekState = {
        formations: deepClone(templateForms),
        depthChart: currentResolved.depthChart || {},
        scrimmageChart: currentResolved.scrimmageChart || {},
        practiceDrillGroups: currentResolved.practiceDrillGroups || srcResolved.practiceDrillGroups || [],
        opponent: currentResolved.opponent || '',
        wristbandData:
          (currentResolved.wristbandData?.wristbands?.length
            ? deepClone(currentResolved.wristbandData)
            : undefined) ||
          safeJSONParse<WristbandData | null>('footballWristbandData', null) ||
          INITIAL_TWO_WRISTBANDS_DATA,
        scouting: currentResolved.scouting || {
          year: '2026',
          week: `Week ${week}`,
          opponent: '',
          gameDate: '',
          gameLocation: '',
          teamOverview: '',
          offensiveTendencies: '',
          defensiveFronts: '',
          specialTeamsNotes: '',
          keysToVictory: [],
          keyPlayersList: [],
          coachNotes: [],
        },
      };

      return {
        ...prev,
        [scopedKey]: newWeekState,
        [week]: newWeekState,
      };
    });
  };

// Helper to extract all position IDs belonging to a formation unit
function getUnitPositionIds(formations: FormationBoard[], unit: string): Set<string> {
  const ids = new Set<string>();
  if (Array.isArray(formations)) {
    formations.forEach((f) => {
      if (f && f.unit === unit && Array.isArray(f.rows)) {
        f.rows.forEach((r) => {
          if (r && Array.isArray(r.positions)) {
            r.positions.forEach((p) => {
              if (p && p.id) ids.add(p.id);
            });
          }
        });
      }
    });
  }
  return ids;
}


  // Centralized helper to apply remote state updates cleanly without race conditions
  const applyRemoteState = (
    data: any,
    source: string = 'remote',
    version?: number,
    updatedAt?: number
  ) => {
    if (!data || typeof data !== 'object') return;

    const remoteTimestamp =
      typeof updatedAt === 'number'
        ? updatedAt
        : typeof data.updatedAt === 'number'
        ? data.updatedAt
        : 0;

    // Guard against stale remote updates
    if (shouldRejectStaleRemote(remoteTimestamp, localServerUpdatedAtRef.current)) {
      return;
    }

    if (typeof version === 'number' && version > localServerVersionRef.current) {
      localServerVersionRef.current = version;
    }
    if (remoteTimestamp > localServerUpdatedAtRef.current) {
      localServerUpdatedAtRef.current = remoteTimestamp;
    }

    isRemoteSyncRef.current = true;

    const coreDefaultIds = new Set(
      INITIAL_DEFAULT_FORMATIONS.filter((f) => f.id !== 'form_10_spread').map((f) => f.id)
    );
    const effectiveDeletedFormIds = new Set<string>(
      mergeDeletedFormationIds(
        latestStateRef.current.deletedFormationIds,
        data.deletedFormationIds,
        coreDefaultIds
      )
    );

    if (Array.isArray(data.deletedFormationIds) && data.deletedFormationIds.length > 0) {
      setDeletedFormationIds((prev) => {
        const merged = mergeDeletedFormationIds(prev, data.deletedFormationIds, coreDefaultIds);
        latestStateRef.current.deletedFormationIds = merged;
        safeJSONSet('footballDeletedFormationIds', merged);
        return merged;
      });
    }

    if (data.weeklyData && Object.keys(data.weeklyData).length > 0) {
      const rawUnit =
        activeUnitRef.current === 'depth_chart'
          ? currentDepthUnitRef.current
          : activeUnitRef.current;
      const effectiveUnit: 'offense' | 'defense' | 'st' | 'groups' =
        ['offense', 'defense', 'st', 'groups'].includes(rawUnit)
          ? (rawUnit as 'offense' | 'defense' | 'st' | 'groups')
          : (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current)
              ? (currentDepthUnitRef.current as 'offense' | 'defense' | 'st' | 'groups')
              : 'offense');

      const normalizedWeekly = normalizeWeeklyData(
        data.weeklyData,
        data.defaultFormations || latestStateRef.current.defaultFormations
      );
      setWeeklyData((prev) => {
        const mergedWeekly = mergeRemoteWeeklyData(
          prev && Object.keys(prev).length ? prev : latestStateRef.current.weeklyData,
          normalizedWeekly,
          activeTeamIdRef.current,
          currentWeekRef.current,
          effectiveUnit,
          lastLocalEditTimeRef.current,
          recentlyModifiedPositionsRef.current,
          Array.from(effectiveDeletedFormIds),
          recentlyModifiedFormationsRef.current
        );
        latestStateRef.current.weeklyData = mergedWeekly;
        safeJSONSet('footballWeeklyData', mergedWeekly);
        return mergedWeekly;
      });
    }
    if (
      data.defaultFormations &&
      Array.isArray(data.defaultFormations) &&
      data.defaultFormations.length > 0
    ) {
      const rawUnit =
        activeUnitRef.current === 'depth_chart'
          ? currentDepthUnitRef.current
          : activeUnitRef.current;
      const effectiveUnit: 'offense' | 'defense' | 'st' | 'groups' =
        ['offense', 'defense', 'st', 'groups'].includes(rawUnit)
          ? (rawUnit as 'offense' | 'defense' | 'st' | 'groups')
          : (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current)
              ? (currentDepthUnitRef.current as 'offense' | 'defense' | 'st' | 'groups')
              : 'offense');

      if (Date.now() - lastLocalEditTimeRef.current < 25000) {
        const localDefs = latestStateRef.current.defaultFormations || [];
        const mergedDefs: FormationBoard[] = [];
        const usedIds = new Set<string>();
        localDefs.forEach((lf) => {
          if (lf && lf.id && !effectiveDeletedFormIds.has(lf.id)) {
            const isRecent =
              recentlyModifiedFormationsRef.current.has(lf.id) &&
              Date.now() - (recentlyModifiedFormationsRef.current.get(lf.id) || 0) < 25000;
            if (lf.unit === effectiveUnit || isRecent) {
              mergedDefs.push(lf);
              usedIds.add(lf.id);
            }
          }
        });
        data.defaultFormations.forEach((rf: any) => {
          if (rf && rf.id && !usedIds.has(rf.id) && !effectiveDeletedFormIds.has(rf.id)) {
            mergedDefs.push(rf);
            usedIds.add(rf.id);
          }
        });
        setDefaultFormations(mergedDefs);
        latestStateRef.current.defaultFormations = mergedDefs;
        safeJSONSet('footballDefaultFormations', mergedDefs);
      } else {
        const localDefs = latestStateRef.current.defaultFormations || [];
        const filteredDefs = data.defaultFormations.filter(
          (df: any) => df && df.id && !effectiveDeletedFormIds.has(df.id)
        );
        localDefs.forEach((lf) => {
          if (lf && lf.id && !effectiveDeletedFormIds.has(lf.id)) {
            const isRecent =
              recentlyModifiedFormationsRef.current.has(lf.id) &&
              Date.now() - (recentlyModifiedFormationsRef.current.get(lf.id) || 0) < 25000;
            if (isRecent) {
              const idx = filteredDefs.findIndex((f: any) => f.id === lf.id);
              if (idx !== -1) {
                filteredDefs[idx] = lf;
              } else {
                filteredDefs.push(lf);
              }
            }
          }
        });
        setDefaultFormations(filteredDefs);
        latestStateRef.current.defaultFormations = filteredDefs;
        safeJSONSet('footballDefaultFormations', filteredDefs);
      }
    }

    const effectiveDeletedPlanIds = new Set<string>([
      ...(latestStateRef.current.deletedPracticePlanIds || []),
      ...(Array.isArray(data.deletedPracticePlanIds) ? data.deletedPracticePlanIds : []),
    ]);
    if (Array.isArray(data.deletedPracticePlanIds) && data.deletedPracticePlanIds.length > 0) {
      setDeletedPracticePlanIds((prev) => {
        const merged = Array.from(new Set([...prev, ...data.deletedPracticePlanIds]));
        latestStateRef.current.deletedPracticePlanIds = merged;
        safeJSONSet('footballDeletedPracticePlanIds', merged);
        return merged;
      });
    }

    if (data.practiceData && Array.isArray(data.practiceData)) {
      const sanitized = sanitizePracticePlans(
        data.practiceData,
        data.scheduleEvents || latestStateRef.current.scheduleEvents || DEFAULT_SCHEDULE_EVENTS
      );
      const mergedPlans = mergePracticePlansByLastEdited(
        latestStateRef.current.practiceData || [],
        sanitized,
        effectiveDeletedPlanIds,
        {
          lastLocalEditTime: lastLocalEditTimeRef.current,
          activePracticeId: currentPracticeIdRef.current,
          isPracticeView: activeUnitRef.current === 'practice',
        }
      );

      setPracticeData(mergedPlans);
      latestStateRef.current.practiceData = mergedPlans;
      safeJSONSet('footballPracticeData', mergedPlans);

      // Protect active practice ID from flipping unexpectedly while coach is editing
      const activeId = currentPracticeIdRef.current;
      const isValidActive = mergedPlans.some((p) => p && p.id === activeId);
      if (!isValidActive) {
        const bestId = findBestActivePracticeId(mergedPlans, activeId, currentWeekRef.current);
        if (bestId) {
          setCurrentPracticeId(bestId);
          currentPracticeIdRef.current = bestId;
          safeJSONSet('footballCurrentPracticeId', bestId);
        }
      }
    }
    if (data.practiceTemplates) {
      const normalizedTemplates = normalizePracticeTemplates(data.practiceTemplates);
      setPracticeTemplates(normalizedTemplates);
      latestStateRef.current.practiceTemplates = normalizedTemplates;
      safeJSONSet('footballPracticeTemplates', normalizedTemplates);
    }
    if (data.cascadingDrills) {
      if (Date.now() - lastLocalEditTimeRef.current < 15000 && activeUnitRef.current === 'drills') {
        // Local coach is actively editing drills, don't overwrite with remote pulse
      } else {
        const normalizedDrills = normalizeCascadingDrills(data.cascadingDrills);
        setCascadingDrills(normalizedDrills);
        latestStateRef.current.cascadingDrills = normalizedDrills;
        safeJSONSet('footballCascadingDrills', normalizedDrills);
      }
    }
    if (data.guideTree) {
      setGuideTree(data.guideTree);
      latestStateRef.current.guideTree = data.guideTree;
      safeJSONSet('footballPdfGuidesTree', data.guideTree);
    }
    if (data.guideOrder) {
      setGuideOrder(data.guideOrder);
      latestStateRef.current.guideOrder = data.guideOrder;
      safeJSONSet('footballPdfGuidesOrder', data.guideOrder);
    }
    if (data.savedCoaches && Array.isArray(data.savedCoaches)) {
      setSavedCoaches(data.savedCoaches);
      latestStateRef.current.savedCoaches = data.savedCoaches;
      safeJSONSet('footballSavedCoaches', data.savedCoaches);
    }
    if (data.teamSavedCoaches && typeof data.teamSavedCoaches === 'object') {
      setTeamSavedCoaches(data.teamSavedCoaches);
      latestStateRef.current.teamSavedCoaches = data.teamSavedCoaches;
      safeJSONSet('footballTeamSavedCoaches', data.teamSavedCoaches);
    }
    if (typeof data.adminPasscodeSet === 'boolean') {
      setAdminPasscodeSet(data.adminPasscodeSet);
      localStorage.setItem('footballAdminPasscodeSet', data.adminPasscodeSet ? 'true' : 'false');
    }
    if (data.staffList && Array.isArray(data.staffList)) {
      setStaffList((prevStaff) => {
        const mergedStaff = mergeStaffByEmail(prevStaff, data.staffList);
        latestStateRef.current.staffList = mergedStaff;
        safeJSONSet('footballTeamCoaches', mergedStaff);
        return mergedStaff;
      });

      // Real-time access check for current user
      if (currentUser?.email && !currentUser?.isAdminPasscodeAuth) {
        const cleanUserEmail = currentUser.email.toLowerCase().trim();
        const myCoach = data.staffList.find(
          (c: StaffCoach) => c.email.toLowerCase().trim() === cleanUserEmail
        );
        if (myCoach && myCoach.status === 'Active') {
          setIsPendingApproval(false);
          const isHead =
            myCoach.role?.toLowerCase().includes('head coach') ||
            myCoach.role?.toLowerCase().includes('admin');
          setUserRole(isHead ? 'admin' : 'assistant');
        } else if (!myCoach || myCoach.status === 'Pending') {
          setIsPendingApproval(true);
        }
      }
    }
    if (data.masterPlayLibrary) {
      setMasterPlayLibrary(data.masterPlayLibrary);
      latestStateRef.current.masterPlayLibrary = data.masterPlayLibrary;
      safeJSONSet('footballMasterPlays', data.masterPlayLibrary);
    }
    if (data.playDatabase && Array.isArray(data.playDatabase)) {
      if (Date.now() - lastLocalEditTimeRef.current < 15000 && (activeUnitRef.current === 'call_sheet' || activeUnitRef.current === 'wristband')) {
        // Preserving local play database changes during active session
      } else {
        setPlayDatabase(data.playDatabase);
        latestStateRef.current.playDatabase = data.playDatabase;
        safeJSONSet('footballPlayDatabase', data.playDatabase);
      }
    }
    if (data.callSheetData && typeof data.callSheetData === 'object' && (data.callSheetData.offenseSections || data.callSheetData.defenseSections)) {
      const localCs = latestStateRef.current.callSheetData || callSheetData;
      const backupCs = safeJSONParse<CallSheetFullData | null>('footballCallSheetData_backup', null);
      const historyList = safeJSONParse<any[]>('footballCallSheet_history', []);
      const historyLatest = historyList && historyList.length > 0 ? (historyList[0]?.data as CallSheetFullData) : null;

      const candidates = [localCs, backupCs, historyLatest].filter(
        (c): c is CallSheetFullData => Boolean(c && typeof c === 'object' && (c.offenseSections || c.defenseSections))
      );

      let bestLocalCs: CallSheetFullData = localCs;
      let highestLocalTimestamp = 0;
      for (const cand of candidates) {
        const t = cand.lastEdited || 0;
        if (t > highestLocalTimestamp) {
          highestLocalTimestamp = t;
          bestLocalCs = cand;
        }
      }

      const isLocalRecent = Date.now() - Math.max(lastLocalEditTimeRef.current, lastLocalCallSheetEditTimeRef.current) < 900000; // 15 min buffer
      const localLastEdited = Math.max(localCs?.lastEdited || 0, highestLocalTimestamp);
      const remoteLastEdited = (data.callSheetData as any)?.lastEdited || 0;

      const countPlays = (cs?: CallSheetFullData) => {
        if (!cs) return 0;
        let count = 0;
        (cs.offenseSections || []).forEach((s) => s.plays?.forEach((p) => { if (p?.name?.trim()) count++; }));
        (cs.defenseSections || []).forEach((s) => s.plays?.forEach((p) => { if (p?.name?.trim()) count++; }));
        return count;
      };

      const localPlayCount = countPlays(bestLocalCs);
      const remotePlayCount = countPlays(data.callSheetData);

      // Do NOT overwrite if:
      // 1. Local was edited recently (< 15 mins)
      // 2. Local timestamp is >= remote timestamp and local has plays
      // 3. Local has plays while remote is empty
      if (
        shouldKeepLocalCallSheet({
          isLocalRecent,
          localLastEdited,
          remoteLastEdited,
          localPlayCount,
          remotePlayCount,
        })
      ) {
        // Preserving local call sheet data
        if (localLastEdited > remoteLastEdited && bestLocalCs) {
          setCallSheetData(bestLocalCs);
          latestStateRef.current.callSheetData = bestLocalCs;
          safeJSONSet('footballCallSheetData', bestLocalCs);
          safeJSONSet('footballCallSheetData_backup', bestLocalCs);
          debouncedSave('all');
        }
      } else if (data.callSheetData) {
        // Always back up best local copy before adopting remote update
        if (bestLocalCs && localPlayCount > 0) {
          safeJSONSet('footballCallSheetData_backup', bestLocalCs);
        }
        setCallSheetData(data.callSheetData);
        latestStateRef.current.callSheetData = data.callSheetData;
        safeJSONSet('footballCallSheetData', data.callSheetData);
      }
    }
    const scopedWeekKey = getScopedWeekKey(activeTeamIdRef.current, currentWeekRef.current);
    const weekWbCandidates = [
      data.weeklyData?.[scopedWeekKey]?.wristbandData,
      data.weeklyData?.[currentWeekRef.current]?.wristbandData,
    ].filter((w) => w && Array.isArray(w.wristbands) && w.wristbands.length > 0);

    let candidateWb = weekWbCandidates.length > 0 ? getBestWristbandData(weekWbCandidates) : undefined;
    if (!candidateWb && data.wristbandData && Array.isArray(data.wristbandData.wristbands) && data.wristbandData.wristbands.length > 0) {
      candidateWb = data.wristbandData;
    }

    if (candidateWb) {
      const remoteWbTime = Number(candidateWb.lastEdited) || 0;
      const localWbTime = Number(latestStateRef.current.wristbandData?.lastEdited) || 0;
      const isActivelyEditingWristband =
        Date.now() - lastLocalWristbandEditTimeRef.current < 2000 &&
        (activeUnitRef.current === 'wristband' || activeUnitRef.current === 'game_day') &&
        localWbTime >= remoteWbTime;

      if (!isActivelyEditingWristband) {
        const normWb = normalizeWristbandContinuousNumbering(
          candidateWb,
          currentActiveTeam?.name || 'Mahopac 10U'
        );
        setWristbandData(normWb);
        latestStateRef.current.wristbandData = normWb;
        safeJSONSet('footballWristbandData', normWb);

        // Also update weeklyData so views consuming weeklyData immediately receive the updated wristband
        setWeeklyData((prev) => {
          const curScoped = prev[scopedWeekKey] || prev[currentWeekRef.current];
          if (!curScoped) return prev;
          const nextWeekly = {
            ...prev,
            [scopedWeekKey]: {
              ...curScoped,
              wristbandData: normWb,
            },
            [currentWeekRef.current]: {
              ...curScoped,
              wristbandData: normWb,
            },
          };
          latestStateRef.current.weeklyData = nextWeekly;
          safeJSONSet('footballWeeklyData', nextWeekly);
          return nextWeekly;
        });
      }
    }
    if (typeof data.globalIdleTimeoutMinutes === 'number') {
      safeJSONSet('footballGlobalIdleTimeoutMinutes', data.globalIdleTimeoutMinutes);
    }
    if (data.deletedPlayIds && Array.isArray(data.deletedPlayIds)) {
      setDeletedPlayIds(data.deletedPlayIds);
      latestStateRef.current.deletedPlayIds = data.deletedPlayIds;
      safeJSONSet('footballDeletedPlayIds', data.deletedPlayIds);
    }
    if (data.collapsedFolders) {
      setCollapsedFolders(data.collapsedFolders);
      latestStateRef.current.collapsedFolders = data.collapsedFolders;
      safeJSONSet('footballCollapsedFolders', data.collapsedFolders);
    }
    if (data.scheduleEvents && Array.isArray(data.scheduleEvents)) {
      setScheduleEvents(data.scheduleEvents);
      latestStateRef.current.scheduleEvents = data.scheduleEvents;
      safeJSONSet('footballScheduleEvents', data.scheduleEvents);
    }
    if (data.roster && Array.isArray(data.roster)) {
      const normalized = normalizeRoster(data.roster, true);
      setRoster(normalized);
      latestStateRef.current.roster = normalized;
      safeJSONSet('footballRoster', normalized);
    }
    if (data.teams && Array.isArray(data.teams) && data.teams.length > 0) {
      setTeams(data.teams);
      latestStateRef.current.teams = data.teams;
      safeJSONSet('footballTeams', data.teams);
    }
    if (data.seasonConfig) {
      setSeasonConfig(data.seasonConfig);
      latestStateRef.current.seasonConfig = data.seasonConfig;
      safeJSONSet('footballSeasonConfig', data.seasonConfig);
    }
    if (data.attendanceLogs && Array.isArray(data.attendanceLogs)) {
      setAttendanceLogs(data.attendanceLogs);
      latestStateRef.current.attendanceLogs = data.attendanceLogs;
      safeJSONSet('footballAttendanceLogs', data.attendanceLogs);
    }
    if (data.pffGradeCriteria) {
      const mergedCriteria = mergePffGradeCriteria(
        mergePffCriteriaMaps(latestStateRef.current.pffGradeCriteria, data.pffGradeCriteria)
      );
      setPffGradeCriteria(mergedCriteria);
      latestStateRef.current.pffGradeCriteria = mergedCriteria;
      safeJSONSet('footballPffGradeCriteria', mergedCriteria);
    }
    if (data.pffPlayerGroups && typeof data.pffPlayerGroups === 'object') {
      const mergedGroups = mergePffPlayerGroups(
        latestStateRef.current.pffPlayerGroups,
        data.pffPlayerGroups
      ) as PffPlayerGroupOverrides;
      setPffPlayerGroups(mergedGroups);
      latestStateRef.current.pffPlayerGroups = mergedGroups;
      safeJSONSet('footballPffPlayerGroups', mergedGroups);
    }
    if (data.liveDrillSlotLayouts && typeof data.liveDrillSlotLayouts === 'object') {
      const mergedLayouts = mergeLiveDrillSlotLayouts(
        loadLiveDrillSlotLayouts(),
        data.liveDrillSlotLayouts
      );
      persistLiveDrillSlotLayouts(mergedLayouts);
      safeJSONSet('footballLiveDrillSlotLayouts', mergedLayouts);
    }

    lastSavedPayloadRef.current = safeJSONStringify(latestStateRef.current);
    initialCloudLoadDoneRef.current = true;
    if (pendingPracticeDrillSaveRef.current) {
      pendingPracticeDrillSaveRef.current = false;
      setTimeout(() => {
        saveStateToStorage('practice_drill_update');
      }, 300);
    }

    // Reset isRemoteSyncRef quickly after the React state cycle
    setTimeout(() => {
      isRemoteSyncRef.current = false;
    }, 250);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncStatus({ text: `✅ Live Synced (${timeStr})`, color: '#22c55e' });
  };

  // Trigger Save to LocalStorage, Server API & Firestore
  const saveStateToStorage = async (scope: string = 'all', extraMeta?: Record<string, any>) => {
    const currentState = latestStateRef.current;

    // 1. LocalStorage update
    safeJSONSet('footballWeeklyData', currentState.weeklyData);
    safeJSONSet('footballDefaultFormations', currentState.defaultFormations);
    safeJSONSet('footballDeletedFormationIds', currentState.deletedFormationIds || []);
    safeJSONSet('footballPracticeData', currentState.practiceData);
    safeJSONSet('footballPracticeTemplates', currentState.practiceTemplates);
    safeJSONSet('footballCascadingDrills', currentState.cascadingDrills);
    safeJSONSet('footballPdfGuidesTree', currentState.guideTree);
    safeJSONSet('footballPdfGuidesOrder', currentState.guideOrder);
    safeJSONSet('footballSavedCoaches', currentState.savedCoaches);
    safeJSONSet('footballTeamSavedCoaches', currentState.teamSavedCoaches);
    safeJSONSet('footballTeamCoaches', currentState.staffList);
    localStorage.setItem('footballAdminPasscodeSet', adminPasscodeSet ? 'true' : 'false');
    safeJSONSet('footballMasterPlays', currentState.masterPlayLibrary);
    safeJSONSet('footballPlayDatabase', currentState.playDatabase);
    safeJSONSet('footballCallSheetData', currentState.callSheetData);
    safeJSONSet('footballWristbandData', currentState.wristbandData);
    safeJSONSet('footballDeletedPlayIds', currentState.deletedPlayIds);
    safeJSONSet('footballCollapsedFolders', currentState.collapsedFolders);
    safeJSONSet('footballScheduleEvents', currentState.scheduleEvents);
    safeJSONSet('footballRoster', currentState.roster);
    safeJSONSet('footballTeams', currentState.teams);
    safeJSONSet('footballSeasonConfig', currentState.seasonConfig);
    safeJSONSet('footballAttendanceLogs', currentState.attendanceLogs);
    safeJSONSet('footballPffGradeCriteria', currentState.pffGradeCriteria);
    safeJSONSet('footballPffPlayerGroups', currentState.pffPlayerGroups);
    safeJSONSet('footballLiveDrillSlotLayouts', loadLiveDrillSlotLayouts());
    safeJSONSet('footballCurrentWeek', currentWeekRef.current);
    safeJSONSet('footballActiveTeamId', activeTeamIdRef.current);
    safeJSONSet('footballLastLocalEditTime', lastLocalEditTimeRef.current);
    safeJSONSet(
      'footballRecentlyModifiedPositions',
      Array.from(recentlyModifiedPositionsRef.current.entries())
    );

    const payload = {
      weeklyData: currentState.weeklyData,
      defaultFormations: currentState.defaultFormations,
      deletedFormationIds: currentState.deletedFormationIds || [],
      practiceData: currentState.practiceData,
      practiceTemplates: currentState.practiceTemplates,
      cascadingDrills: currentState.cascadingDrills,
      guideTree: currentState.guideTree,
      guideOrder: currentState.guideOrder,
      savedCoaches: currentState.savedCoaches,
      teamSavedCoaches: currentState.teamSavedCoaches,
      staffList: currentState.staffList,
      masterPlayLibrary: currentState.masterPlayLibrary,
      playDatabase: currentState.playDatabase,
      callSheetData: currentState.callSheetData,
      wristbandData: currentState.wristbandData,
      globalIdleTimeoutMinutes: getActiveUserIdleTimeoutMinutes(),
      deletedPlayIds: currentState.deletedPlayIds,
      collapsedFolders: currentState.collapsedFolders,
      scheduleEvents: currentState.scheduleEvents,
      roster: currentState.roster,
      teams: currentState.teams,
      seasonConfig: currentState.seasonConfig,
      attendanceLogs: currentState.attendanceLogs,
      pffGradeCriteria: currentState.pffGradeCriteria,
      pffPlayerGroups: currentState.pffPlayerGroups,
      liveDrillSlotLayouts: loadLiveDrillSlotLayouts(),
    };

    const payloadJson = safeJSONStringify(payload);
    const isExplicitUserAction =
      scope.startsWith('position_') ||
      scope.startsWith('player_') ||
      scope.startsWith('formation_') ||
      scope.startsWith('practice') ||
      scope.startsWith('wristband') ||
      scope.startsWith('call_sheet') ||
      scope.startsWith('idle_timeout') ||
      scope.startsWith('staff_pref') ||
      scope === 'delete_formation' ||
      scope === 'move_formation' ||
      scope === 'copy_week' ||
      scope === 'force' ||
      scope === 'initial_seed' ||
      scope === 'ppr_update' ||
      scope.startsWith('ppr') ||
      (Array.isArray(extraMeta?.modifiedPosIds) && extraMeta.modifiedPosIds.length > 0);

    if (payloadJson === lastSavedPayloadRef.current && !isExplicitUserAction) {
      return;
    }

    // Never overwrite cloud if initial cloud pull has not completed yet
    if (!initialCloudLoadDoneRef.current && scope !== 'force') {
      if (scope.startsWith('practice_drill')) pendingPracticeDrillSaveRef.current = true;
      return;
    }

    lastSavedPayloadRef.current = payloadJson;

    setSyncStatus({ text: '☁️ Syncing...', color: '#f59e0b' });

    const authorEmail = currentUser?.email || 'Coach';

    // 2. Persistent Server Sync
    try {
      const fallbackUnit =
        ['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current)
          ? currentDepthUnitRef.current
          : (['offense', 'defense', 'st', 'groups'].includes(activeUnitRef.current)
              ? activeUnitRef.current
              : 'offense');
      const effectiveUnit =
        extraMeta?.activeUnit && ['offense', 'defense', 'st', 'groups'].includes(extraMeta.activeUnit)
          ? extraMeta.activeUnit
          : fallbackUnit;
      const metadata = {
        activeTeamId: activeTeamIdRef.current,
        currentWeek: currentWeekRef.current,
        activeUnit: effectiveUnit,
        scope,
        timestamp: Date.now(),
        ...(extraMeta || {}),
        ...(scope === 'ppr_update' || extraMeta?.activeUnit === 'ppr' ? { activeUnit: 'ppr' } : {}),
      };
      const sResult = await saveServerState(payload, authorEmail, metadata);
      if (sResult && typeof sResult.version === 'number') {
        localServerVersionRef.current = sResult.version;
      }
      if (sResult && typeof sResult.updatedAt === 'number') {
        localServerUpdatedAtRef.current = sResult.updatedAt;
      }
    } catch (err) {
      console.warn('Server save warning:', err);
    }

    // 3. Firestore Sync — skip PFF-only writes so a full weeklyData snapshot cannot
    // last-write-wins over another coach's live grades. Server SSE carries the merge.
    const { db } = getFirebaseServices();
    if (db && initialCloudLoadDoneRef.current && scope !== 'ppr_update') {
      try {
        const cleanPayload = JSON.parse(
          safeJSONStringify({
            ...payload,
            updatedAt: Date.now(),
            lastAuthor: authorEmail,
          })
        );
        await db
          .collection('teamData')
          .doc('depthChartData')
          .set(cleanPayload, { merge: true });
      } catch (err: any) {
        console.warn('Firestore sync warning:', err);
      }
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncStatus({ text: `✅ Saved & Synced (${timeStr})`, color: '#22c55e' });
  };

  // Immediate non-debounced flush to storage & cloud
  const flushAndSaveStateToStorage = async (scope: string = 'immediate', extraMeta?: Record<string, any>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await saveStateToStorage(scope, extraMeta);
  };

  const debouncedSave = (scope: string = 'all', extraMeta?: Record<string, any>) => {
    if (isRemoteSyncRef.current) {
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveStateToStorage(scope, extraMeta);
    }, 400);
  };

  const handleForceSave = async () => {
    lastSavedPayloadRef.current = '';
    setSyncStatus({ text: '☁️ Saving to Cloud & Server...', color: '#f59e0b' });
    await saveStateToStorage('force');
  };

  const handleForceRefresh = async () => {
    setSyncStatus({ text: '🔄 Fetching Latest Cloud Data...', color: '#f59e0b' });
    try {
      const { db } = getFirebaseServices();
      if (db) {
        const doc = await db.collection('teamData').doc('depthChartData').get();
        if (doc.exists) {
          applyRemoteState(doc.data(), 'manual_firestore_refresh');
          return;
        }
      }
      const serverRes = await fetchServerState();
      if (serverRes && serverRes.hasData && serverRes.state) {
        applyRemoteState(serverRes.state, 'manual_server_refresh', serverRes.version, serverRes.updatedAt);
        return;
      }
      setSyncStatus({ text: '✅ Up to Date', color: '#22c55e' });
    } catch (err) {
      console.warn('Manual refresh error:', err);
      setSyncStatus({ text: 'Sync Error', color: '#ef4444' });
    }
  };

  // Update root CSS variable for print font size
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--print-font-size',
      `${printFontSize}px`
    );
  }, [printFontSize]);

  // Global blur / focusout sync listener: whenever a coach clicks out of any input/box/dropdown,
  // immediately flush changes to Firestore & Server so other coaches see them instantly
  useEffect(() => {
    const handleGlobalFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        flushAndSaveStateToStorage('focusout');
      }
    };

    const handleBeforeUnload = () => {
      saveStateToStorage('beforeunload');
    };

    document.addEventListener('focusout', handleGlobalFocusOut);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('focusout', handleGlobalFocusOut);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Initial Server Persistence & Live Real-Time Multi-Coach Subscription
  useEffect(() => {
    let isMounted = true;

    async function initPersistence() {
      try {
        // 1. Check Firestore FIRST for existing cloud data
        const { db } = getFirebaseServices();
        let firestoreLoaded = false;
        if (db) {
          try {
            const doc = await db.collection('teamData').doc('depthChartData').get();
            if (!isMounted) return;
            if (doc && doc.exists) {
              const data = doc.data();
              if (data) {
                applyRemoteState(data, 'firestore_init');
                initialCloudLoadDoneRef.current = true;
                firestoreLoaded = true;
              }
            }
          } catch (fErr) {
            console.warn('Initial firestore fetch warning:', fErr);
          }
        }

        // 2. Fetch server state & locks
        const [serverRes, locksRes] = await Promise.all([
          fetchServerState(),
          fetchServerLocks(),
        ]);
        if (!isMounted) return;

        if (Array.isArray(locksRes)) {
          setActiveLocks(locksRes);
        }

        if (serverRes && serverRes.hasData && serverRes.state) {
          applyRemoteState(serverRes.state, 'server_init', serverRes.version, serverRes.updatedAt);
          initialCloudLoadDoneRef.current = true;
          // Synchronize local edit time with server so refresh never causes stale auto-overwrites
          lastLocalEditTimeRef.current = Math.max(lastLocalEditTimeRef.current, serverRes.updatedAt || 0);
          safeJSONSet('footballLastLocalEditTime', lastLocalEditTimeRef.current);
        } else if (!firestoreLoaded) {
          initialCloudLoadDoneRef.current = true;
        }
      } catch (err) {
        console.warn('Initial server state fetch warning:', err);
        initialCloudLoadDoneRef.current = true;
      }

      // 3. Subscribe to real-time multi-coach updates via SSE
      const unsubscribeSSE = subscribeServerEvents((eventData) => {
        if (!isMounted) return;
        if (eventData.type === 'connected') {
          if (Array.isArray(eventData.locks)) {
            setActiveLocks(eventData.locks);
          }
          if (Array.isArray(eventData.activeUsers)) {
            setActiveUsers(eventData.activeUsers);
          }
        } else if (eventData.type === 'locks_update' && Array.isArray(eventData.locks)) {
          setActiveLocks(eventData.locks);
        } else if (eventData.type === 'presence_update' && Array.isArray(eventData.users)) {
          setActiveUsers(eventData.users);
        } else if (eventData.type === 'sync' && eventData.state) {
          if (eventData.senderClientId === CLIENT_ID) return;
          applyRemoteState(eventData.state, 'sse_live_update', eventData.version, eventData.updatedAt);
        }
      });

      // 4. Resilient polling fallback every 4 seconds (throttled when tab is hidden or idle)
      const pollInterval = setInterval(async () => {
        if (!isMounted) return;
        // Optimization: pause polling when browser tab is hidden or user is idle to save CPU & memory
        if (document.hidden || Date.now() - lastUserActivityTimeRef.current > 3 * 60 * 1000) {
          return;
        }
        try {
          const [health, currentLocks] = await Promise.all([
            checkServerHealth(),
            fetchServerLocks(),
          ]);
          if (Array.isArray(currentLocks)) {
            setActiveLocks((prev) => {
              if (prev.length === currentLocks.length) {
                const isIdentical = prev.every(
                  (p, i) =>
                    p.id === currentLocks[i].id &&
                    p.holderEmail === currentLocks[i].holderEmail &&
                    p.expiresAt === currentLocks[i].expiresAt
                );
                if (isIdentical) return prev;
              }
              return currentLocks;
            });
          }
          if (health && health.hasCachedState) {
            if (
              (typeof health.stateVersion === 'number' && health.stateVersion > localServerVersionRef.current) ||
              (typeof health.stateUpdatedAt === 'number' && health.stateUpdatedAt > localServerUpdatedAtRef.current)
            ) {
              const serverRes = await fetchServerState();
              if (serverRes && serverRes.hasData && serverRes.state) {
                applyRemoteState(serverRes.state, 'poll_sync', serverRes.version, serverRes.updatedAt);
              }
            }
          }
        } catch {
          // silent catch during polling
        }
      }, 4000);

      // 5. Lightweight server check on window focus / tab visibility change (OOM-safe)
      let isFocusChecking = false;
      let lastFocusCheckTime = 0;

      const handleWindowFocus = async () => {
        if (!isMounted) return;
        if (document.hidden) return; // Do not run when switching away from the tab
        const now = Date.now();
        if (now - lastFocusCheckTime < 10000 || isFocusChecking) return;
        if (now - lastLocalEditTimeRef.current < 25000) return;

        isFocusChecking = true;
        lastFocusCheckTime = now;

        try {
          // Lightweight health check: only fetch server state if server version/updatedAt actually changed
          const health = await checkServerHealth();
          if (health && typeof health.stateVersion === 'number') {
            if (
              health.stateVersion > localServerVersionRef.current ||
              health.stateUpdatedAt > localServerUpdatedAtRef.current
            ) {
              const serverRes = await fetchServerState();
              if (serverRes && serverRes.hasData && serverRes.state) {
                applyRemoteState(serverRes.state, 'focus_sync', serverRes.version, serverRes.updatedAt);
              }
            }
          }
        } catch {
          // silent catch on focus check
        } finally {
          isFocusChecking = false;
        }
      };

      window.addEventListener('focus', handleWindowFocus);
      document.addEventListener('visibilitychange', handleWindowFocus);

      return () => {
        if (typeof unsubscribeSSE === 'function') unsubscribeSSE();
        clearInterval(pollInterval);
        window.removeEventListener('focus', handleWindowFocus);
        document.removeEventListener('visibilitychange', handleWindowFocus);
      };
    }

    const unsubPromise = initPersistence();

    return () => {
      isMounted = false;
      unsubPromise.then((cleanup) => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, []);

  // User Presence & 10-Minute Idle Logout
  const handleSignOut = useCallback(async () => {
    try {
      if (currentUser?.email) {
        await leavePresence(currentUser.email);
        await releaseServerLock({
          teamId: activeTeamId,
          week: String(currentWeek),
          unit: currentDepthUnit,
          holderEmail: currentUser.email,
        });
      }
    } catch {}
    sessionStorage.removeItem('football_admin_passcode_active');
    sessionStorage.removeItem('football_dev_test_mode');
    clearLocalDeveloperSession();
    await clearOpsSession();
    const { auth } = getFirebaseServices();
    if (auth) {
      try {
        await auth.signOut();
      } catch {}
    }
    setCurrentUser(null);
    setIsPendingApproval(false);
    window.location.reload();
  }, [currentUser?.email, activeTeamId, currentWeek, currentDepthUnit]);

  const getActiveUserIdleTimeoutMinutes = useCallback((): number => {
    const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
    if (!cleanEmail) {
      return safeJSONParse<number>('footballGlobalIdleTimeoutMinutes', 30);
    }
    const userStored = safeJSONParse<number | null>(
      'footballIdleTimeoutMinutes_' + cleanEmail,
      null
    );
    if (typeof userStored === 'number') {
      return userStored;
    }
    const coach = staffList.find(
      (c) => c.email.toLowerCase().trim() === cleanEmail
    );
    if (typeof coach?.idleTimeoutMinutes === 'number') {
      return coach.idleTimeoutMinutes;
    }
    return safeJSONParse<number>('footballGlobalIdleTimeoutMinutes', 30);
  }, [currentUser?.email, staffList]);

  const handleUpdateActiveUserIdleTimeout = useCallback(
    async (minutes: number) => {
      const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
      safeJSONSet('footballGlobalIdleTimeoutMinutes', minutes);
      latestStateRef.current.globalIdleTimeoutMinutes = minutes;
      if (cleanEmail) {
        safeJSONSet('footballIdleTimeoutMinutes_' + cleanEmail, minutes);
        const currentPref = safeJSONParse('footballUserPref_' + cleanEmail, {});
        safeJSONSet('footballUserPref_' + cleanEmail, {
          ...currentPref,
          idleTimeoutMinutes: minutes,
        });

        const coachIdx = staffList.findIndex(
          (c) => c.email.toLowerCase().trim() === cleanEmail
        );
        if (coachIdx !== -1) {
          handleUpdateStaffPreferences(
            coachIdx,
            staffList[coachIdx].favoriteTeamId,
            staffList[coachIdx].startScreen,
            minutes
          );
        } else {
          // Sync directly to cloud and server
          const { db } = getFirebaseServices();
          if (db) {
            db.collection('teamData')
              .doc('depthChartData')
              .set({ globalIdleTimeoutMinutes: minutes, updatedAt: Date.now() }, { merge: true })
              .catch(() => {});
          }
          await flushAndSaveStateToStorage('idle_timeout_update', {
            idleTimeoutMinutes: minutes,
            userEmail: cleanEmail,
          });
        }
      } else {
        const { db } = getFirebaseServices();
        if (db) {
          db.collection('teamData')
            .doc('depthChartData')
            .set({ globalIdleTimeoutMinutes: minutes, updatedAt: Date.now() }, { merge: true })
            .catch(() => {});
        }
        await flushAndSaveStateToStorage('idle_timeout_update', {
          idleTimeoutMinutes: minutes,
        });
      }
    },
    [currentUser?.email, staffList]
  );

  const handleIdleTimeoutLogout = useCallback(async () => {
    // 1. Flush and save all pending depth chart, roster, and season changes to disk and cloud
    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      await flushAndSaveStateToStorage('force_idle_logout_flush', {
        scope: 'force',
        timestamp: Date.now(),
      });
      console.log('✅ State successfully flushed to storage, disk & cloud before idle logout');
    } catch (saveErr) {
      console.warn('Warning: error saving state before idle logout:', saveErr);
    }

    // 2. Safely release multi-coach lock & leave live presence
    try {
      if (currentUser?.email) {
        await leavePresence(currentUser.email);
        await releaseServerLock({
          teamId: activeTeamId,
          week: String(currentWeek),
          unit: currentDepthUnit,
          holderEmail: currentUser.email,
        });
      }
    } catch {}

    // 3. Clear session and transition to idle modal
    sessionStorage.removeItem('football_admin_passcode_active');
    sessionStorage.removeItem('football_dev_test_mode');
    clearLocalDeveloperSession();
    await clearOpsSession();
    const { auth } = getFirebaseServices();
    if (auth) {
      try {
        await auth.signOut();
      } catch {}
    }
    setCurrentUser(null);
    setIsPendingApproval(false);
    setIsIdleTimedOut(true);
  }, [currentUser?.email, activeTeamId, currentWeek, currentDepthUnit]);

  // Global Idle Detection: Configurable per-user and system-level inactivity timer
  useEffect(() => {
    const markActivity = () => {
      const now = Date.now();
      if (now - lastUserActivityTimeRef.current > 2000) {
        lastUserActivityTimeRef.current = now;
      }
      if (isUserIdleRef.current) {
        isUserIdleRef.current = false;
        if (currentUser?.email && !isIdleTimedOut) {
          registerPresence({
            email: currentUser.email,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            role: userRole === 'admin' ? 'Head Coach / Admin' : 'Assistant Coach',
            activeTeamId,
            activeUnit,
            currentWeek: String(currentWeek),
            isIdle: false,
          }).then((users) => {
            if (Array.isArray(users)) setActiveUsers(users);
          }).catch(() => {});
        }
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));

    // Idle timer check every 10 seconds
    const idleCheckInterval = setInterval(() => {
      if (!currentUser || isIdleTimedOut) return;

      const idleDuration = Date.now() - lastUserActivityTimeRef.current;
      const timeoutMinutes = getActiveUserIdleTimeoutMinutes();

      // Mark idle badge in presence (warning threshold)
      const idleWarningThreshold = timeoutMinutes > 0
        ? Math.min(3 * 60 * 1000, (timeoutMinutes * 60 * 1000) / 2)
        : 5 * 60 * 1000;

      if (idleDuration > idleWarningThreshold && !isUserIdleRef.current) {
        isUserIdleRef.current = true;
        registerPresence({
          email: currentUser.email,
          displayName: currentUser.displayName || currentUser.email.split('@')[0],
          role: userRole === 'admin' ? 'Head Coach / Admin' : 'Assistant Coach',
          activeTeamId,
          activeUnit,
          currentWeek: String(currentWeek),
          isIdle: true,
        }).then((users) => {
          if (Array.isArray(users)) setActiveUsers(users);
        }).catch(() => {});
      }

      // Hard logout after configured inactivity duration (0 = Disabled / Never)
      if (timeoutMinutes > 0 && idleDuration >= timeoutMinutes * 60 * 1000) {
        handleIdleTimeoutLogout();
      }
    }, 10000);

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, markActivity));
      clearInterval(idleCheckInterval);
    };
  }, [
    currentUser,
    isIdleTimedOut,
    activeTeamId,
    activeUnit,
    currentWeek,
    userRole,
    handleIdleTimeoutLogout,
    getActiveUserIdleTimeoutMinutes,
  ]);

  // Real-Time Presence Heartbeat (every 30s while connected)
  useEffect(() => {
    if (!currentUser?.email || isIdleTimedOut) return;

    const report = () => {
      if (document.hidden) return;
      const isIdle = Date.now() - lastUserActivityTimeRef.current > 3 * 60 * 1000;
      registerPresence({
        email: currentUser.email,
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        role: userRole === 'admin' ? 'Head Coach / Admin' : 'Assistant Coach',
        activeTeamId,
        activeUnit,
        currentWeek: String(currentWeek),
        isIdle,
      }).then((users) => {
        if (Array.isArray(users)) setActiveUsers(users);
      }).catch(() => {});
    };

    report();
    const presenceTimer = setInterval(report, 30000);

    const handleBeforeUnload = () => {
      leavePresence(currentUser?.email);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(presenceTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.email, isIdleTimedOut, activeTeamId, activeUnit, currentWeek, userRole]);

  // Apply favorite team & start screen associated with the user login
  const applyUserPreferencesOnLogin = (email: string) => {
    if (!email) return;
    const cleanEmail = email.toLowerCase().trim();

    // 1. Check user-specific localStorage preference
    const savedUserPref = safeJSONParse('footballUserPref_' + cleanEmail, null);

    // 2. Check staff list / initial coaches entry
    const coachEntry =
      latestStateRef.current.staffList.find(
        (c) => c.email.toLowerCase().trim() === cleanEmail
      ) ||
      DEFAULT_TEAM_COACHES.find(
        (c) => c.email.toLowerCase().trim() === cleanEmail
      );

    const targetTeamId =
      savedUserPref?.favoriteTeamId ||
      coachEntry?.favoriteTeamId ||
      safeJSONParse('footballDefaultTeamId', null);

    const targetScreen =
      savedUserPref?.startScreen ||
      coachEntry?.startScreen ||
      safeJSONParse('footballDefaultScreen', null);

    const targetSubUnit =
      savedUserPref?.startDepthSubUnit ||
      coachEntry?.startDepthSubUnit ||
      safeJSONParse('footballDefaultDepthSubUnit', null);

    if (targetTeamId) {
      const existingTeam = latestStateRef.current.teams.find(
        (t) =>
          t.id === targetTeamId ||
          t.id.replace(/-/g, '_') === targetTeamId.replace(/-/g, '_')
      );
      const finalTeamId = existingTeam ? existingTeam.id : targetTeamId;
      setActiveTeamId(finalTeamId);
      setDefaultTeamId(finalTeamId);
      safeJSONSet('footballActiveTeamId', finalTeamId);
      safeJSONSet('footballDefaultTeamId', finalTeamId);
    }

    if (targetScreen) {
      setActiveUnit(targetScreen);
      setDefaultScreen(targetScreen);
      safeJSONSet('footballActiveUnit', targetScreen);
      safeJSONSet('footballDefaultScreen', targetScreen);
      if (targetSubUnit) {
        setDepthSubUnit(targetSubUnit);
        setDefaultDepthSubUnit(targetSubUnit);
        safeJSONSet('footballDefaultDepthSubUnit', targetSubUnit);
      }
    }

    const targetIdleTimeout =
      typeof savedUserPref?.idleTimeoutMinutes === 'number'
        ? savedUserPref.idleTimeoutMinutes
        : (typeof coachEntry?.idleTimeoutMinutes === 'number'
            ? coachEntry.idleTimeoutMinutes
            : safeJSONParse<number>('footballGlobalIdleTimeoutMinutes', 30));

    if (typeof targetIdleTimeout === 'number') {
      safeJSONSet('footballIdleTimeoutMinutes_' + cleanEmail, targetIdleTimeout);
    }
  };

  // Initial Firebase Auth Listener & Cloud Sync Subscription
  useEffect(() => {
    const { auth, db } = getFirebaseServices();

    if (auth) {
      // Process any pending redirect auth results from Google Sign-in
      auth
        .getRedirectResult()
        .then((result: any) => {
          if (result?.user) {
            setCurrentUser(result.user);
            setIsAuthModalOpen(false);
            applyUserPreferencesOnLogin(result.user.email);
          }
        })
        .catch((err: any) => {
          console.warn('Redirect auth result error:', err);
        });

      const unsubscribeAuth = auth.onAuthStateChanged(async (user: any) => {
        if (user) {
          setCurrentUser(user);
          applyUserPreferencesOnLogin(user.email);

          try {
            const idToken = await user.getIdToken();
            await establishOpsSession({ method: 'firebase', idToken });
          } catch (sessionErr) {
            console.warn('Operations API session after Firebase login failed:', sessionErr);
          }

          // On user login, immediately pull all live team data from Firestore
          let latestStaff: StaffCoach[] = staffList;
          if (db) {
            try {
              const doc = await db.collection('teamData').doc('depthChartData').get();
              if (doc && doc.exists) {
                const cloudData = doc.data();
                if (cloudData) {
                  applyRemoteState(cloudData, 'auth_login_pull');
                  if (cloudData.staffList && Array.isArray(cloudData.staffList)) {
                    latestStaff = cloudData.staffList;
                  }
                }
              }
            } catch (loginPullErr) {
              console.warn('Error pulling cloud data on login:', loginPullErr);
            }
          }

          // Check if coach is approved in staffList
          const cleanEmail = (user.email || '').toLowerCase().trim();
          const existingIdx = latestStaff.findIndex(
            (c) => c.email.toLowerCase().trim() === cleanEmail
          );

          if (existingIdx !== -1) {
            const coachEntry = latestStaff[existingIdx];
            if (coachEntry.status === 'Active') {
              setIsPendingApproval(false);
              const isHead =
                coachEntry.role?.toLowerCase().includes('head coach') ||
                coachEntry.role?.toLowerCase().includes('admin');
              setUserRole(isHead ? 'admin' : 'assistant');
              setIsAuthModalOpen(false);
            } else {
              setIsPendingApproval(true);
              setIsAuthModalOpen(true);
            }
          } else if (cleanEmail) {
            // New user registration - always Pending approval until admin approves
            const newEntry: StaffCoach = {
              email: cleanEmail,
              role: 'Assistant Coach',
              status: 'Pending',
              assignedTeamIds: ['all'],
            };
            const updatedStaff = [...latestStaff, newEntry];
            setStaffList(updatedStaff);
            safeJSONSet('footballTeamCoaches', updatedStaff);
            if (db) {
              db.collection('teamData')
                .doc('depthChartData')
                .set({ staffList: updatedStaff }, { merge: true })
                .catch((err: any) => console.warn('Staff update error:', err));
            }
            setIsPendingApproval(true);
            setIsAuthModalOpen(true);
          }

          setSyncStatus({
            text: '✅ Live Multi-Coach Connected',
            color: '#22c55e',
          });
        } else {
          // Check if admin passcode session is active
          if (hasLocalDeveloperSession()) {
            setCurrentUser(buildLocalDeveloperUser());
            setIsPendingApproval(false);
            setIsAuthModalOpen(false);
            setUserRole('admin');
          } else if (sessionStorage.getItem('football_admin_passcode_active') === 'true') {
            setCurrentUser({
              email: 'admin@coachportal.local',
              displayName: 'Head Coach (Admin)',
              isAdminPasscodeAuth: true,
            });
            setIsPendingApproval(false);
            setIsAuthModalOpen(false);
            setUserRole('admin');
          } else {
            // Stay on the login card without remounting it. Calling setState
            // with a new object here was wiping the Admin Passcode tab back to Sign In.
            setCurrentUser((prev) => (prev == null || prev.isAdminPasscodeAuth ? prev : null));
            setIsPendingApproval(false);
            setIsAuthModalOpen(true);
          }
        }
      });

      // Real-time Firestore sync
      if (db) {
        const unsubscribeFirestore = db
          .collection('teamData')
          .doc('depthChartData')
          .onSnapshot(
            (doc: any) => {
              if (isImportingRef.current) {
                return;
              }
              if (doc && doc.exists) {
                if (doc.metadata && doc.metadata.hasPendingWrites) {
                  return;
                }
                const data = doc.data();
                if (!data) return;

                const remotePayloadJson = safeJSONStringify(data);
                if (remotePayloadJson === lastSavedPayloadRef.current) {
                  initialCloudLoadDoneRef.current = true;
                  return;
                }

                applyRemoteState(data, 'firestore_snapshot');
              } else {
                initialCloudLoadDoneRef.current = true;
              }
            },
            (err: any) => {
              console.warn('Firestore subscription error:', err);
              initialCloudLoadDoneRef.current = true;
            }
          );

        return () => {
          unsubscribeAuth();
          unsubscribeFirestore();
        };
      }
      return () => unsubscribeAuth();
    } else {
      // Offline mode
      setCurrentUser({ email: 'Local Coach (Offline)' });
      void establishOpsSession({ method: 'loopback', email: 'offline@localhost' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (hasLocalDeveloperSession()) {
          await establishOpsSession({ method: 'local_developer' });
        }
        const health = await checkServerHealth();
        if (typeof health?.adminPasscodeSet === 'boolean' && !cancelled) {
          setAdminPasscodeSet(health.adminPasscodeSet);
          localStorage.setItem('footballAdminPasscodeSet', health.adminPasscodeSet ? 'true' : 'false');
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Could not restore operations API session:', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize current practice & formations
  useEffect(() => {
    ensureWeekExists(currentWeek);

    const teamPractices = activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData;
    if (practiceData.length === 0) {
      const defaultPlan: PracticePlan = {
        id: 'prac_' + Date.now(),
        teamId: activeTeamId,
        year: '2026',
        weekFolder: currentWeek,
        title: 'Practice #1',
        date: new Date().toISOString().split('T')[0],
        day: getDayOfWeekForDate(new Date().toISOString().split('T')[0]),
        startTime: '17:05',
        lastEdited: Date.now(),
        plan: deepClone(DEFAULT_PRACTICE_TEMPLATES['Standard Practice'] || []),
      };
      setPracticeData([defaultPlan]);
      setCurrentPracticeId(defaultPlan.id);
      safeJSONSet('footballCurrentPracticeId', defaultPlan.id);
    } else {
      const isCurrentValid = teamPractices.some((p) => p && p.id === currentPracticeId);
      if (!isCurrentValid || !currentPracticeId) {
        const bestId = findBestActivePracticeId(teamPractices, currentPracticeId, currentWeek);
        if (bestId && bestId !== currentPracticeId) {
          setCurrentPracticeId(bestId);
          safeJSONSet('footballCurrentPracticeId', bestId);
        }
      }
    }
  }, [currentWeek, activeTeamId, practiceData.length]);

  // Auto-advance depth chart week after game score is entered or day after game is scheduled
  useEffect(() => {
    const auto = getAutoActiveWeek(scheduleEvents);
    if (auto.activeWeek) {
      const lastRecordedAutoWeek = safeJSONParse('footballLastAutoWeek', null);
      if (lastRecordedAutoWeek && auto.activeWeek !== lastRecordedAutoWeek) {
        safeJSONSet('footballLastAutoWeek', auto.activeWeek);
        setCurrentWeek(auto.activeWeek);
        ensureWeekExists(auto.activeWeek, auto.priorWeek);
      } else if (!lastRecordedAutoWeek) {
        safeJSONSet('footballLastAutoWeek', auto.activeWeek);
      }
    }
  }, [scheduleEvents]);

  // Sync state changes
  useEffect(() => {
    debouncedSave('all');
  }, [
    weeklyData,
    defaultFormations,
    practiceData,
    practiceTemplates,
    cascadingDrills,
    guideTree,
    guideOrder,
    savedCoaches,
    teamSavedCoaches,
    staffList,
    masterPlayLibrary,
    collapsedFolders,
    scheduleEvents,
    roster,
    teams,
    seasonConfig,
    attendanceLogs,
  ]);

  const currentScopedWeekKey = getScopedWeekKey(activeTeamId, currentWeek);
  const currentWeekState: WeekState = resolveWeekState(weeklyData, activeTeamId, currentWeek);

  const effectiveWristbandData: WristbandData = useMemo(() => {
    const cwWb = currentWeekState?.wristbandData;
    if (cwWb && Array.isArray(cwWb.wristbands) && cwWb.wristbands.length > 0) {
      return cwWb;
    }
    const wb = wristbandData;
    if (wb && Array.isArray(wb.wristbands) && wb.wristbands.length > 0) {
      return wb;
    }
    return INITIAL_TWO_WRISTBANDS_DATA;
  }, [wristbandData, currentWeekState?.wristbandData]);

  const rawFormations = currentWeekState.formations;

  const currentFormations: FormationBoard[] = useMemo(() => {
    return (rawFormations || [])
      .filter((f): f is FormationBoard => Boolean(f && typeof f === 'object' && f.id))
      .map((f) => ({
        ...f,
        rows: (f.rows || []).map((r, rIdx) => {
          const rawPositions = Array.isArray(r.positions) ? r.positions : [];
          // Preserve valid position objects and nulls (empty spacing slots)
          const positions: (PositionSlot | null)[] = rawPositions.map((pos) =>
            pos && typeof pos === 'object' && pos.id && pos.name
              ? { id: String(pos.id), name: String(pos.name) }
              : null
          );
          const targetCount = Math.max(
            positions.length,
            typeof r.slotCount === 'number' ? r.slotCount : 0,
            1
          );
          while (positions.length < targetCount) {
            positions.push(null);
          }
          return {
            ...r,
            id: r.id || `row_${rIdx}`,
            label: r.label || `Level ${rIdx + 1}`,
            slotCount: positions.length,
            positions,
          };
        }),
      }));
  }, [rawFormations]);
  const currentDepthChart = currentWeekState.depthChart || {};
  const currentScrimmageChart = currentWeekState.scrimmageChart || {};

  // Check if current week needs prompt to copy players from previous week
  const depthChartCopyCandidate = useMemo(() => {
    if (dismissedCopyPrompts.has(currentWeek)) return null;
    const targetState = resolveWeekState(weeklyData, activeTeamId, currentWeek);
    const targetDepthCount = countPlacedPlayers(targetState?.depthChart);
    if (targetDepthCount > 0) return null;

    let srcWk = '0';
    const num = parseInt(currentWeek, 10);
    if (!isNaN(num) && num > 1) {
      srcWk = String(num - 1);
    } else if (currentWeek === '1') {
      srcWk = '0';
    } else if (currentWeek === 'playoffs') {
      srcWk = '8';
    } else if (currentWeek === '0') {
      return null;
    }

    const srcState = resolveWeekState(weeklyData, activeTeamId, srcWk);
    const srcCount = countPlacedPlayers(srcState?.depthChart);

    if (srcCount > 0) {
      return {
        targetWeek: currentWeek,
        sourceWeek: srcWk,
        sourceCount: srcCount,
      };
    }
    return null;
  }, [weeklyData, activeTeamId, currentWeek, dismissedCopyPrompts]);

  // Team Access Control & Data Filtering
  const currentUserCoach = staffList.find(
    (c) => c.email.toLowerCase().trim() === (currentUser?.email || '').toLowerCase().trim()
  );

  const isMasterSuperAdminUser = (email?: string) => {
    return false;
  };

  const checkIsLiveEnvironment = () => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.includes('local')) {
      return false;
    }
    return true;
  };

  const isUserApproved = (email?: string, userObj?: any): boolean => {
    if (userObj?.isAdminPasscodeAuth) return true;
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    if (isMasterSuperAdminUser(clean)) return true;
    const coach = staffList.find((c) => c.email.toLowerCase().trim() === clean);
    return Boolean(coach && coach.status === 'Active');
  };

  const accessibleTeams = React.useMemo(() => {
    // Admin Passcode auth or admin role ALWAYS has full access to ALL teams unconditionally
    if (currentUser?.isAdminPasscodeAuth || userRole === 'admin') {
      return teams;
    }

    // For all other Head Coaches and Assistant Coaches, strictly check allowed assignedTeamIds
    if (currentUserCoach) {
      const assigned = currentUserCoach.assignedTeamIds;
      if (assigned && assigned.length > 0) {
        if (assigned.includes('all')) return teams;
        const permitted = teams.filter((t) => assigned.includes(t.id));
        if (permitted.length > 0) return permitted;
      }
    }

    return teams.slice(0, 1);
  }, [teams, currentUserCoach, currentUser]);

  // Active Team Saved Practice Coaches (Per-Team Roster - strictly on this team only)
  const activeTeamSavedCoaches = React.useMemo(() => {
    if (teamSavedCoaches && teamSavedCoaches[activeTeamId] && Array.isArray(teamSavedCoaches[activeTeamId])) {
      return teamSavedCoaches[activeTeamId].filter(
        (c) => c && typeof c === 'string' && c.trim()
      );
    }
    return [];
  }, [teamSavedCoaches, activeTeamId]);

  // Ensure activeTeamId is within accessible teams
  useEffect(() => {
    if (accessibleTeams.length > 0 && !accessibleTeams.some((t) => t.id === activeTeamId)) {
      const fallback = accessibleTeams[0].id;
      setActiveTeamId(fallback);
      safeJSONSet('footballActiveTeamId', fallback);
    }
  }, [accessibleTeams, activeTeamId]);

  const currentActiveTeam = React.useMemo(() => {
    return (
      teams.find((t) => t.id === activeTeamId) ||
      accessibleTeams[0] ||
      teams[0] || { id: 'team-10u', name: '10U Youth Tackle', ageGroup: '10U', color: 'amber' }
    );
  }, [teams, accessibleTeams, activeTeamId]);

  // Filter roster, schedule events, and practice plans by active team (strictly isolated)
  const activeTeamRoster = React.useMemo(() => {
    return roster.filter((p) => {
      if (!p) return false;
      if (p.teamId) {
        return (
          p.teamId === activeTeamId ||
          (p.teamId === 'team_10u' && activeTeamId === 'team-10u') ||
          (p.teamId === 'team-10u' && activeTeamId === 'team_10u')
        );
      }
      return (
        activeTeamId === 'team_10u' ||
        activeTeamId === 'team-10u' ||
        activeTeamId === teams[0]?.id
      );
    });
  }, [roster, activeTeamId, teams]);

  const activeTeamScheduleEvents = React.useMemo(() => {
    return scheduleEvents.filter((e) => {
      if (!e) return false;
      if (e.teamId) {
        return (
          e.teamId === activeTeamId ||
          (e.teamId === 'team_10u' && activeTeamId === 'team-10u') ||
          (e.teamId === 'team-10u' && activeTeamId === 'team_10u')
        );
      }
      return (
        activeTeamId === 'team_10u' ||
        activeTeamId === 'team-10u' ||
        activeTeamId === teams[0]?.id
      );
    });
  }, [scheduleEvents, activeTeamId, teams]);

  const activeTeamPracticeData = React.useMemo(() => {
    return practiceData.filter((p) => {
      if (!p) return false;
      if (p.teamId) {
        return (
          p.teamId === activeTeamId ||
          (p.teamId === 'team_10u' && activeTeamId === 'team-10u') ||
          (p.teamId === 'team-10u' && activeTeamId === 'team_10u')
        );
      }
      return (
        activeTeamId === 'team_10u' ||
        activeTeamId === 'team-10u' ||
        activeTeamId === teams[0]?.id
      );
    });
  }, [practiceData, activeTeamId, teams]);

  // Team CRUD handlers
  const handleAddTeam = (newTeamData: Omit<Team, 'id'>) => {
    const newTeam: Team = {
      ...newTeamData,
      id: 'team_' + Date.now(),
    };
    let updatedTeams: Team[] = [];
    setTeams((prev) => {
      updatedTeams = [...prev, newTeam];
      safeJSONSet('footballTeams', updatedTeams);
      latestStateRef.current.teams = updatedTeams;
      return updatedTeams;
    });

    // Seed default practice coaches for this new team with specific coaching staff
    let updatedCoaches: Record<string, string[]> = {};
    const baseCoaches = savedCoaches && savedCoaches.length > 0 ? savedCoaches : DEFAULT_SAVED_COACHES;
    setTeamSavedCoaches((prev) => {
      updatedCoaches = {
        ...prev,
        [newTeam.id]: [...baseCoaches],
      };
      safeJSONSet('footballTeamSavedCoaches', updatedCoaches);
      latestStateRef.current.teamSavedCoaches = updatedCoaches;
      return updatedCoaches;
    });

    setActiveTeamId(newTeam.id);
    safeJSONSet('footballActiveTeamId', newTeam.id);

    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set(
          {
            teams: updatedTeams,
            teamSavedCoaches: updatedCoaches,
            updatedAt: Date.now(),
          },
          { merge: true }
        )
        .catch((err: any) => console.warn('Firestore add team sync error:', err));
    }
  };

  const handleUpdateTeam = (teamId: string, updated: Partial<Team>) => {
    let updatedTeams: Team[] = [];
    setTeams((prev) => {
      updatedTeams = prev.map((t) => (t.id === teamId ? { ...t, ...updated } : t));
      safeJSONSet('footballTeams', updatedTeams);
      latestStateRef.current.teams = updatedTeams;
      return updatedTeams;
    });

    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set(
          {
            teams: updatedTeams,
            updatedAt: Date.now(),
          },
          { merge: true }
        )
        .catch((err: any) => console.warn('Firestore update team sync error:', err));
    }
  };

  const handleDeleteTeam = (teamId: string) => {
    let finalTeams: Team[] = [];
    setTeams((prev) => {
      const remaining = prev.filter((t) => t.id !== teamId);
      finalTeams =
        remaining.length > 0
          ? remaining
          : [
              {
                id: 'team_' + Date.now(),
                name: '10U Youth Tackle',
                ageGroup: '10U',
                season: '2026 Season',
                color: 'amber',
                headCoachName: '',
                notes: 'Primary program team',
              },
            ];
      safeJSONSet('footballTeams', finalTeams);
      latestStateRef.current.teams = finalTeams;

      if (activeTeamId === teamId || !finalTeams.some((t) => t.id === activeTeamId)) {
        const nextId = finalTeams[0].id;
        setActiveTeamId(nextId);
        safeJSONSet('footballActiveTeamId', nextId);
      }
      return finalTeams;
    });

    // Clean up coach team assignments
    let updatedStaff: StaffCoach[] = [];
    setStaffList((prev) => {
      updatedStaff = prev.map((coach) => {
        if (!coach.assignedTeamIds) return coach;
        return {
          ...coach,
          assignedTeamIds: coach.assignedTeamIds.filter((id) => id !== teamId),
        };
      });
      safeJSONSet('footballTeamCoaches', updatedStaff);
      latestStateRef.current.staffList = updatedStaff;
      return updatedStaff;
    });

    // Clean up per-team saved coaches
    let updatedCoaches: Record<string, string[]> = {};
    setTeamSavedCoaches((prev) => {
      const copy = { ...prev };
      delete copy[teamId];
      updatedCoaches = copy;
      safeJSONSet('footballTeamSavedCoaches', copy);
      latestStateRef.current.teamSavedCoaches = copy;
      return copy;
    });

    // Direct instant Firestore write to permanently delete the team from the cloud
    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set(
          {
            teams: finalTeams,
            staffList: updatedStaff,
            teamSavedCoaches: updatedCoaches,
            updatedAt: Date.now(),
          },
          { merge: true }
        )
        .catch((err: any) => console.warn('Firestore delete team sync error:', err));
    }
  };

  const handleUpdateStaffAssignedTeams = (idx: number, teamIds: string[]) => {
    let updated: StaffCoach[] = [];
    setStaffList((prev) => {
      updated = [...prev];
      updated[idx] = { ...updated[idx], assignedTeamIds: teamIds };
      safeJSONSet('footballTeamCoaches', updated);
      latestStateRef.current.staffList = updated;
      return updated;
    });

    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set({ staffList: updated, updatedAt: Date.now() }, { merge: true })
        .catch((err: any) => console.warn('Firestore staff update sync error:', err));
    }
  };

  const handleSetDefaultTeam = (teamId: string) => {
    setDefaultTeamId(teamId);
    safeJSONSet('footballDefaultTeamId', teamId);
    setActiveTeamId(teamId);
    safeJSONSet('footballActiveTeamId', teamId);

    // Save to current user's preferences
    const cleanEmail = (currentUser?.email || 'admin@coachportal.local').toLowerCase().trim();
    if (cleanEmail) {
      const existingPref = safeJSONParse('footballUserPref_' + cleanEmail, {});
      const updatedPref = { ...existingPref, favoriteTeamId: teamId };
      safeJSONSet('footballUserPref_' + cleanEmail, updatedPref);

      // Also update in staffList so it syncs across devices/cloud
      setStaffList((prev) => {
        const idx = prev.findIndex((c) => c.email.toLowerCase().trim() === cleanEmail);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], favoriteTeamId: teamId };
          safeJSONSet('footballTeamCoaches', copy);
          latestStateRef.current.staffList = copy;
          return copy;
        }
        return prev;
      });
    }
  };

  const handleSetDefaultScreen = (
    screen: UnitType,
    subUnit?: 'offense' | 'defense' | 'st' | 'groups' | 'scrimmage'
  ) => {
    setDefaultScreen(screen);
    safeJSONSet('footballDefaultScreen', screen);
    if (subUnit) {
      setDefaultDepthSubUnit(subUnit);
      safeJSONSet('footballDefaultDepthSubUnit', subUnit);
      setDepthSubUnit(subUnit);
    }
    setActiveUnit(screen);
    safeJSONSet('footballActiveUnit', screen);

    // Save to current user's preferences
    const cleanEmail = (currentUser?.email || 'admin@coachportal.local').toLowerCase().trim();
    if (cleanEmail) {
      const existingPref = safeJSONParse('footballUserPref_' + cleanEmail, {});
      const updatedPref = {
        ...existingPref,
        startScreen: screen,
        startDepthSubUnit: subUnit,
      };
      safeJSONSet('footballUserPref_' + cleanEmail, updatedPref);

      // Also update in staffList so it syncs across devices/cloud
      setStaffList((prev) => {
        const idx = prev.findIndex((c) => c.email.toLowerCase().trim() === cleanEmail);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            startScreen: screen,
            startDepthSubUnit: subUnit,
          };
          safeJSONSet('footballTeamCoaches', copy);
          latestStateRef.current.staffList = copy;
          return copy;
        }
        return prev;
      });
    }
  };

  const handleUpdateStaffPreferences = (
    idx: number,
    favoriteTeamId?: string,
    startScreen?: UnitType,
    idleTimeoutMinutes?: number
  ) => {
    let updated: StaffCoach[] = [];
    setStaffList((prev) => {
      if (!prev[idx]) return prev;
      updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        ...(favoriteTeamId ? { favoriteTeamId } : {}),
        ...(startScreen ? { startScreen } : {}),
        ...(typeof idleTimeoutMinutes === 'number' ? { idleTimeoutMinutes } : {}),
      };
      safeJSONSet('footballTeamCoaches', updated);
      latestStateRef.current.staffList = updated;

      const coachEmail = updated[idx].email.toLowerCase().trim();
      const currentPref = safeJSONParse('footballUserPref_' + coachEmail, {});
      safeJSONSet('footballUserPref_' + coachEmail, {
        ...currentPref,
        ...(favoriteTeamId ? { favoriteTeamId } : {}),
        ...(startScreen ? { startScreen } : {}),
        ...(typeof idleTimeoutMinutes === 'number' ? { idleTimeoutMinutes } : {}),
      });

      if (typeof idleTimeoutMinutes === 'number') {
        safeJSONSet('footballIdleTimeoutMinutes_' + coachEmail, idleTimeoutMinutes);
      }

      // If updating the currently logged in coach, apply active changes
      const currentEmail = (currentUser?.email || '').toLowerCase().trim();
      if (coachEmail === currentEmail) {
        if (favoriteTeamId) {
          setDefaultTeamId(favoriteTeamId);
          setActiveTeamId(favoriteTeamId);
          safeJSONSet('footballDefaultTeamId', favoriteTeamId);
          safeJSONSet('footballActiveTeamId', favoriteTeamId);
        }
        if (startScreen) {
          setDefaultScreen(startScreen);
          setActiveUnit(startScreen);
          safeJSONSet('footballDefaultScreen', startScreen);
          safeJSONSet('footballActiveUnit', startScreen);
        }
      }

      return updated;
    });

    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set({
          staffList: updated,
          ...(typeof idleTimeoutMinutes === 'number' ? { globalIdleTimeoutMinutes: idleTimeoutMinutes } : {}),
          updatedAt: Date.now()
        }, { merge: true })
        .catch((err: any) => console.warn('Firestore staff pref update sync error:', err));
    }

    saveServerState(
      {
        ...latestStateRef.current,
        staffList: updated,
        ...(typeof idleTimeoutMinutes === 'number' ? { globalIdleTimeoutMinutes: idleTimeoutMinutes } : {}),
      },
      currentUser?.email || 'Admin',
      {
        scope: 'staff_pref_update',
        timestamp: Date.now(),
      }
    ).catch(() => {});
  };

  const handleAddStaffCoach = (
    email: string,
    role: string = 'Assistant Coach',
    assignedTeamIds: string[] = [activeTeamId],
    favoriteTeamId: string = activeTeamId || 'team_10u',
    startScreen: UnitType = 'schedule',
    idleTimeoutMinutes: number = 30
  ) => {
    const cleanEmail = email.toLowerCase().trim();
    if (staffList.some((c) => c.email.toLowerCase().trim() === cleanEmail)) {
      alert('Coach email already in staff list.');
      return;
    }
    const newEntry: StaffCoach = {
      email: cleanEmail,
      role: role || 'Assistant Coach',
      status: 'Active',
      assignedTeamIds: assignedTeamIds && assignedTeamIds.length > 0 ? assignedTeamIds : [activeTeamId],
      favoriteTeamId,
      startScreen,
      idleTimeoutMinutes,
    };
    let updatedStaff: StaffCoach[] = [];
    setStaffList((prev) => {
      updatedStaff = [...prev, newEntry];
      safeJSONSet('footballTeamCoaches', updatedStaff);
      safeJSONSet('footballIdleTimeoutMinutes_' + cleanEmail, idleTimeoutMinutes);
      latestStateRef.current.staffList = updatedStaff;
      return updatedStaff;
    });

    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set({ staffList: updatedStaff, updatedAt: Date.now() }, { merge: true })
        .catch((err: any) => console.warn('Firestore add staff sync error:', err));
    }

    saveServerState(latestStateRef.current, currentUser?.email || 'Admin', {
      scope: 'staff_add',
      timestamp: Date.now(),
    }).catch(() => {});
  };

  const handleAddNewSavedCoach = (rawName: string, targetTeamId?: string) => {
    if (!rawName || !rawName.trim()) return;
    const tid = targetTeamId || activeTeamId;
    const namesToAdd = rawName
      .split(/[,;\n]+/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (namesToAdd.length === 0) return;

    let updatedTeamCoaches: Record<string, string[]> = {};
    setTeamSavedCoaches((prev) => {
      const currentList = Array.isArray(prev[tid]) ? prev[tid] : [];
      const nextList = [...currentList];
      namesToAdd.forEach((name) => {
        if (!nextList.some((c) => c.toLowerCase() === name.toLowerCase())) {
          nextList.push(name);
        }
      });
      updatedTeamCoaches = {
        ...prev,
        [tid]: nextList,
      };
      safeJSONSet('footballTeamSavedCoaches', updatedTeamCoaches);
      latestStateRef.current.teamSavedCoaches = updatedTeamCoaches;
      return updatedTeamCoaches;
    });

    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set(
          {
            teamSavedCoaches: latestStateRef.current.teamSavedCoaches,
            updatedAt: Date.now(),
          },
          { merge: true }
        )
        .catch((err: any) => console.warn('Firestore add coach sync error:', err));
    }
  };

  const handleDeleteSavedCoach = (name: string, targetTeamId?: string) => {
    const tid = targetTeamId || activeTeamId;
    const normTarget = name.toLowerCase().trim();

    let updatedTeamCoaches: Record<string, string[]> = {};
    setTeamSavedCoaches((prev) => {
      const currentList = Array.isArray(prev[tid]) ? prev[tid] : [];
      updatedTeamCoaches = {
        ...prev,
        [tid]: currentList.filter((c) => c.toLowerCase().trim() !== normTarget),
      };
      safeJSONSet('footballTeamSavedCoaches', updatedTeamCoaches);
      latestStateRef.current.teamSavedCoaches = updatedTeamCoaches;
      return updatedTeamCoaches;
    });

    // Also scrub this coach from any assigned stations in practiceData
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.teamId && p.teamId !== tid) return p;
        const periods = Array.isArray(p.plan) && p.plan.length > 0 ? p.plan : (Array.isArray(p.periods) ? p.periods : []);
        let changed = false;
        const updatedPeriods = periods.map((per) => {
          const stations = Array.isArray(per.stations) ? per.stations : [];
          const updatedStations = stations.map((st) => {
            if (!st.coach) return st;
            const coachTokens = st.coach.split(',').map((c) => c.trim()).filter(Boolean);
            const filteredTokens = coachTokens.filter((c) => c.toLowerCase() !== normTarget);
            if (filteredTokens.length !== coachTokens.length) {
              changed = true;
              return { ...st, coach: filteredTokens.join(', ') };
            }
            return st;
          });
          return { ...per, stations: updatedStations };
        });
        if (changed) {
          return { ...p, plan: updatedPeriods, periods: updatedPeriods, lastEdited: Date.now() };
        }
        return p;
      })
    );

    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set(
          JSON.parse(
            safeJSONStringify({
              teamSavedCoaches: latestStateRef.current.teamSavedCoaches,
              updatedAt: Date.now(),
            })
          ),
          { merge: true }
        )
        .catch((err: any) => console.warn('Firestore delete coach sync error:', err));
    }
  };

  const handleCopyCoachesFromTeam = (sourceTeamId: string, targetTeamId: string) => {
    const sourceList = Array.isArray(teamSavedCoaches[sourceTeamId]) ? teamSavedCoaches[sourceTeamId] : [];
    let updatedTeamCoaches: Record<string, string[]> = {};
    setTeamSavedCoaches((prev) => {
      updatedTeamCoaches = {
        ...prev,
        [targetTeamId]: [...sourceList],
      };
      safeJSONSet('footballTeamSavedCoaches', updatedTeamCoaches);
      latestStateRef.current.teamSavedCoaches = updatedTeamCoaches;
      return updatedTeamCoaches;
    });

    const { db } = getFirebaseServices();
    if (db) {
      db.collection('teamData')
        .doc('depthChartData')
        .set(
          {
            teamSavedCoaches: updatedTeamCoaches,
            updatedAt: Date.now(),
          },
          { merge: true }
        )
        .catch((err: any) => console.warn('Firestore copy coaches sync error:', err));
    }
  };

  // Auto-select first formation if none selected
  useEffect(() => {
    const unitForms = currentFormations.filter((f) => f && f.unit === activeUnit);
    if (unitForms.length > 0) {
      if (
        !selectedFormationId ||
        !unitForms.some((f) => f.id === selectedFormationId)
      ) {
        setSelectedFormationId(unitForms[0].id);
      }
    }
  }, [activeUnit, currentFormations]);

  // Helper to update current week formations
  const updateCurrentWeekFormations = (
    newFormations: FormationBoard[],
    syncToDefaults = false,
    saveImmediate = false,
    extraMeta?: Record<string, any>
  ) => {
    const now = Date.now();
    lastLocalEditTimeRef.current = now;

    if (Array.isArray(newFormations)) {
      newFormations.forEach((f) => {
        if (f && f.id) {
          recentlyModifiedFormationsRef.current.set(f.id, now);
          if (Array.isArray(f.rows)) {
            f.rows.forEach((r) => {
              if (r && Array.isArray(r.positions)) {
                r.positions.forEach((p) => {
                  if (p && p.id) {
                    recentlyModifiedPositionsRef.current.set(p.id, now);
                  }
                });
              }
            });
          }
        }
      });
    }

    if (Array.isArray(extraMeta?.modifiedPosIds)) {
      extraMeta.modifiedPosIds.forEach((pid: string) => {
        if (pid) recentlyModifiedPositionsRef.current.set(pid, now);
      });
    }

    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
    const prev = latestStateRef.current.weeklyData || weeklyData;
    const existing = resolveWeekState(prev, activeTeamId, currentWeek);
    const updatedWeekState: WeekState = {
      ...existing,
      formations: newFormations,
    };
    const updatedAll: Record<string, WeekState> = {
      ...prev,
      [scopedKey]: updatedWeekState,
    };
    if (activeTeamId === 'team_10u' || !activeTeamId) {
      updatedAll[currentWeek] = updatedWeekState;
    }
    latestStateRef.current.weeklyData = updatedAll;
    safeJSONSet('footballWeeklyData', updatedAll);
    safeJSONSet('footballCurrentWeek', currentWeek);
    safeJSONSet('footballActiveTeamId', activeTeamId);
    setWeeklyData(updatedAll);

    if (syncToDefaults) {
      setDefaultFormations(newFormations);
      safeJSONSet('footballDefaultFormations', newFormations);
      latestStateRef.current.defaultFormations = newFormations;
    }

    const fallbackUnit =
      ['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current)
        ? currentDepthUnitRef.current
        : (['offense', 'defense', 'st', 'groups'].includes(activeUnitRef.current)
            ? activeUnitRef.current
            : 'offense');
    const effectiveUnit =
      extraMeta?.activeUnit && ['offense', 'defense', 'st', 'groups'].includes(extraMeta.activeUnit)
        ? extraMeta.activeUnit
        : fallbackUnit;

    if (saveImmediate) {
      const scope = extraMeta?.scope || 'formation_edit';
      flushAndSaveStateToStorage(scope, {
        activeUnit: effectiveUnit,
        ...(extraMeta || {}),
      });
    } else {
      debouncedSave('formation');
    }
  };

  // Helper to update depth chart
  const updateCurrentWeekDepthChart = (
    newDepthChart: Record<string, PlacedPlayer[]>
  ) => {
    const now = Date.now();
    lastLocalEditTimeRef.current = now;
    safeJSONSet('footballLastLocalEditTime', now);
    safeJSONSet('footballCurrentWeek', currentWeek);
    safeJSONSet('footballActiveTeamId', activeTeamId);

    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
    const prev = latestStateRef.current.weeklyData || weeklyData;
    const existing = resolveWeekState(prev, activeTeamId, currentWeek);
    const updatedWeekState: WeekState = {
      ...existing,
      depthChart: newDepthChart,
    };
    const updatedAll: Record<string, WeekState> = {
      ...prev,
      [scopedKey]: updatedWeekState,
    };
    if (activeTeamId === 'team_10u' || !activeTeamId) {
      updatedAll[currentWeek] = updatedWeekState;
    }
    latestStateRef.current.weeklyData = updatedAll;
    safeJSONSet('footballWeeklyData', updatedAll);
    setWeeklyData(updatedAll);
  };

  // Helper to update scrimmage chart
  const updateCurrentWeekScrimmageChart = (
    newScrimChart: Record<string, PlacedPlayer[]>
  ) => {
    const now = Date.now();
    lastLocalEditTimeRef.current = now;
    safeJSONSet('footballLastLocalEditTime', now);
    safeJSONSet('footballCurrentWeek', currentWeek);
    safeJSONSet('footballActiveTeamId', activeTeamId);

    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
    const prev = latestStateRef.current.weeklyData || weeklyData;
    const existing = resolveWeekState(prev, activeTeamId, currentWeek);
    const updatedWeekState: WeekState = {
      ...existing,
      scrimmageChart: newScrimChart,
    };
    const updatedAll: Record<string, WeekState> = {
      ...prev,
      [scopedKey]: updatedWeekState,
    };
    if (activeTeamId === 'team_10u' || !activeTeamId) {
      updatedAll[currentWeek] = updatedWeekState;
    }
    latestStateRef.current.weeklyData = updatedAll;
    safeJSONSet('footballWeeklyData', updatedAll);
    setWeeklyData(updatedAll);
  };

  // Helper to copy formations from another team into active team
  const handleCopyFormationsFromTeam = (sourceTeamId: string) => {
    if (userRole !== 'admin') return;
    const sourceScopedKey = getScopedWeekKey(sourceTeamId, currentWeek);
    const sourceState = weeklyData[sourceScopedKey] || weeklyData[sourceTeamId] || weeklyData[currentWeek];
    const sourceFormations = sourceState?.formations || defaultFormations;
    if (!sourceFormations || sourceFormations.length === 0) {
      alert('Selected source team has no formations available to copy.');
      return;
    }
    const targetScopedKey = getScopedWeekKey(activeTeamId, currentWeek);
    const clonedFormations = deepClone(sourceFormations);
    setWeeklyData((prev) => ({
      ...prev,
      [targetScopedKey]: {
        ...(prev[targetScopedKey] || prev[currentWeek] || {}),
        formations: clonedFormations,
      },
    }));
    alert(`Successfully cloned ${clonedFormations.length} formations to ${currentActiveTeam.name}!`);
  };

  /* =========================================================================
     DRAG AND DROP HANDLERS (PLAYERS & POSITION CARDS)
     ========================================================================= */
  const handleDragStartRosterPlayer = (
    e: React.DragEvent,
    player: RosterPlayer
  ) => {
    if (userRole !== 'admin') return;
    const rosterDisplayName = (player.rosterName || player.lastName || `${player.firstName} ${player.lastName}`).trim();
    draggedPlayerRef.current = {
      type: 'roster',
      name: rosterDisplayName,
      num: player.num,
    };
    e.dataTransfer.setData('text/plain', rosterDisplayName);
    e.dataTransfer.setData(
      'application/x-football-player',
      JSON.stringify({
        num: player.num,
        name: player.lastName || rosterDisplayName,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartPlacedPlayer = (
    e: React.DragEvent,
    posId: string,
    idx: number,
    player: PlacedPlayer
  ) => {
    if (userRole !== 'admin') return;
    draggedPlayerRef.current = {
      type: 'placed_player',
      name: player.name,
      num: player.num,
      sourcePosId: posId,
      sourceIndex: idx,
      isScrimmage: activeUnit === 'scrimmage',
    };
    e.dataTransfer.setData('text/plain', player.name);
    e.stopPropagation();
  };

  const handleDropPlayerOnCard = (
    targetPosId: string,
    targetFormId: string,
    targetRowId: string
  ) => {
    if (userRole !== 'admin' || !draggedPlayerRef.current) return;
    const dragged = draggedPlayerRef.current;
    const isScrimmage = dragged.isScrimmage || activeUnit === 'scrimmage';

    const chart = isScrimmage
      ? { ...currentScrimmageChart }
      : { ...currentDepthChart };

    if (!chart[targetPosId]) chart[targetPosId] = [];

    let playerObj: PlacedPlayer | null = null;
    const modifiedPosIds: string[] = [targetPosId];
    recordPositionEdit(targetPosId);

    if (dragged.type === 'placed_player' && dragged.sourcePosId !== undefined) {
      if (dragged.sourcePosId !== targetPosId) {
        modifiedPosIds.push(dragged.sourcePosId);
        recordPositionEdit(dragged.sourcePosId);
      }
      if (chart[dragged.sourcePosId] && dragged.sourceIndex !== undefined) {
        playerObj = chart[dragged.sourcePosId][dragged.sourceIndex];
        chart[dragged.sourcePosId].splice(dragged.sourceIndex, 1);
      }
    } else if (dragged.type === 'roster') {
      playerObj = { name: dragged.name, num: dragged.num };
    }

    if (playerObj) {
      chart[targetPosId].push(playerObj);
    }

    if (isScrimmage) {
      updateCurrentWeekScrimmageChart(chart);
    } else {
      updateCurrentWeekDepthChart(chart);
    }

    draggedPlayerRef.current = null;
    flushAndSaveStateToStorage('player_move', { modifiedPosIds });
  };

  const handleRemovePlayerFromCard = (posId: string, playerIndex: number) => {
    if (userRole !== 'admin') return;
    const isScrimmage = activeUnit === 'scrimmage';
    const chart = isScrimmage
      ? { ...currentScrimmageChart }
      : { ...currentDepthChart };

    if (chart[posId]) {
      chart[posId].splice(playerIndex, 1);
      recordPositionEdit(posId);
      if (isScrimmage) updateCurrentWeekScrimmageChart(chart);
      else updateCurrentWeekDepthChart(chart);
      flushAndSaveStateToStorage('player_remove', { modifiedPosIds: [posId] });
    }
  };

  const handleAssignPlayerDirect = (
    posId: string,
    player: PlacedPlayer,
    targetIndex?: number
  ) => {
    if (userRole !== 'admin') return;
    const isScrimmage = activeUnit === 'scrimmage';
    const chart = isScrimmage
      ? { ...currentScrimmageChart }
      : { ...currentDepthChart };

    if (!chart[posId]) chart[posId] = [];

    // Remove player if already in this position to avoid duplicates
    const filtered = chart[posId].filter((p) => p.num.trim() !== player.num.trim());
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= filtered.length) {
      filtered.splice(targetIndex, 0, player);
    } else {
      filtered.push(player);
    }
    chart[posId] = filtered;
    recordPositionEdit(posId);

    if (isScrimmage) {
      updateCurrentWeekScrimmageChart(chart);
    } else {
      updateCurrentWeekDepthChart(chart);
    }
    flushAndSaveStateToStorage('player_assign_direct', { modifiedPosIds: [posId] });
  };

  const handleReorderDepthPlayer = (
    posId: string,
    fromIndex: number,
    toIndex: number
  ) => {
    if (userRole !== 'admin') return;
    const isScrimmage = activeUnit === 'scrimmage';
    const chart = isScrimmage
      ? { ...currentScrimmageChart }
      : { ...currentDepthChart };

    if (!chart[posId] || !chart[posId][fromIndex]) return;
    const list = [...chart[posId]];
    const [moved] = list.splice(fromIndex, 1);
    const clampedToIndex = Math.max(0, Math.min(list.length, toIndex));
    list.splice(clampedToIndex, 0, moved);
    chart[posId] = list;
    recordPositionEdit(posId);

    if (isScrimmage) {
      updateCurrentWeekScrimmageChart(chart);
    } else {
      updateCurrentWeekDepthChart(chart);
    }
    flushAndSaveStateToStorage('player_reorder_depth', { modifiedPosIds: [posId] });
  };

  // Drag and Drop Position Cards Across Rows & Slots
  const handlePositionCardDragStart = (
    e: React.DragEvent,
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    if (userRole !== 'admin') return;
    draggedPositionCardRef.current = { formId, rIdx, pIdx };
    draggedPlayerRef.current = null;
    e.dataTransfer.setData('text/plain', 'position_card');
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handlePositionCardDropOnSlot = (
    e: React.DragEvent,
    targetFormId: string,
    targetRIdx: number,
    targetPIdx: number
  ) => {
    if (userRole !== 'admin' || !draggedPositionCardRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const { formId: srcFormId, rIdx: srcRIdx, pIdx: srcPIdx } =
      draggedPositionCardRef.current;

    const forms = deepClone(currentFormations) as FormationBoard[];
    const srcForm = forms.find((f) => f.id === srcFormId);
    const targetForm = forms.find((f) => f.id === targetFormId);

    if (srcForm && targetForm) {
      const srcRow = srcForm.rows[srcRIdx];
      const targetRow = targetForm.rows[targetRIdx];

      if (srcRow && targetRow) {
        if (srcFormId === targetFormId && srcRIdx === targetRIdx && srcPIdx === targetPIdx) {
          draggedPositionCardRef.current = null;
          return;
        }

        const srcPos = srcRow.positions[srcPIdx];
        const targetPos = targetRow.positions[targetPIdx];

        srcRow.positions[srcPIdx] = targetPos || null;
        targetRow.positions[targetPIdx] = srcPos || null;

        const modPosIds: string[] = [];
        if (srcPos?.id) {
          modPosIds.push(srcPos.id);
          recentlyModifiedPositionsRef.current.set(srcPos.id, Date.now());
        }
        if (targetPos?.id) {
          modPosIds.push(targetPos.id);
          recentlyModifiedPositionsRef.current.set(targetPos.id, Date.now());
        }
        recentlyModifiedFormationsRef.current.set(srcFormId, Date.now());
        recentlyModifiedFormationsRef.current.set(targetFormId, Date.now());

        const targetUnit = srcForm.unit || targetForm.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');

        updateCurrentWeekFormations(forms, true, true, {
          scope: 'position_card_move',
          modifiedPosIds: modPosIds,
          activeUnit: targetUnit,
        });
      }
    }
    draggedPositionCardRef.current = null;
  };

  /* =========================================================================
     FORMATION ACTIONS
     ========================================================================= */

  const handleSetRowSlots = (formId: string, rIdx: number, newCount: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    const safeCount = Math.max(1, Math.min(12, newCount));
    recentlyModifiedFormationsRef.current.set(formId, Date.now());
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        let positions = [...rows[rIdx].positions];
        while (positions.length < safeCount) positions.push(null);
        if (safeCount < positions.length) positions = positions.slice(0, safeCount);
        rows[rIdx] = { ...rows[rIdx], slotCount: safeCount, positions };
        return { ...f, rows };
      }
      return f;
    });
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'formation_set_slots',
      activeUnit: targetUnit,
    });
  };

  const handleAddSlotToRow = (formId: string, rIdx: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]) return;
    const currentCount = form.rows[rIdx].positions.length;
    if (currentCount >= 12) return;
    handleSetRowSlots(formId, rIdx, currentCount + 1);
  };

  const handleRemoveSlotFromRow = (formId: string, rIdx: number, pIdx?: number) => {
    const now = Date.now();
    recentlyModifiedFormationsRef.current.set(formId, now);
    const form = currentFormations.find((f) => f.id === formId);
    const modPosIds: string[] = [];

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        let positions = [...rows[rIdx].positions];
        if (positions.length <= 1) return f;
        if (typeof pIdx === 'number' && pIdx >= 0 && pIdx < positions.length) {
          const removed = positions[pIdx];
          if (removed?.id) {
            modPosIds.push(removed.id);
            recentlyModifiedPositionsRef.current.set(removed.id, now);
          }
          positions.splice(pIdx, 1);
        } else {
          const lastNullIdx = positions.lastIndexOf(null);
          if (lastNullIdx !== -1) {
            positions.splice(lastNullIdx, 1);
          } else {
            const popped = positions.pop();
            if (popped?.id) {
              modPosIds.push(popped.id);
              recentlyModifiedPositionsRef.current.set(popped.id, now);
            }
          }
        }
        rows[rIdx] = { ...rows[rIdx], slotCount: positions.length, positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'formation_slot_remove',
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleInsertSlotAt = (formId: string, rIdx: number, pIdx: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    recentlyModifiedFormationsRef.current.set(formId, Date.now());
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        const positions = [...rows[rIdx].positions];
        if (positions.length >= 12) return f;
        const insertIdx = Math.max(0, Math.min(positions.length, pIdx));
        positions.splice(insertIdx, 0, null);
        rows[rIdx] = { ...rows[rIdx], slotCount: positions.length, positions };
        return { ...f, rows };
      }
      return f;
    });
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'formation_slot_insert',
      activeUnit: targetUnit,
    });
  };

  const handleClearPositionToEmpty = (formId: string, rIdx: number, pIdx: number) => {
    const now = Date.now();
    recentlyModifiedFormationsRef.current.set(formId, now);
    const form = currentFormations.find((f) => f.id === formId);
    const oldPos = form?.rows[rIdx]?.positions[pIdx];
    const modPosIds: string[] = [];
    if (oldPos?.id) {
      modPosIds.push(oldPos.id);
      recentlyModifiedPositionsRef.current.set(oldPos.id, now);
    }

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        const positions = [...rows[rIdx].positions];
        if (pIdx >= 0 && pIdx < positions.length) {
          positions[pIdx] = null;
        }
        rows[rIdx] = { ...rows[rIdx], positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_clear_slot',
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleAssignPositionToSlot = (
    formId: string,
    rIdx: number,
    pIdx: number,
    posName: string
  ) => {
    if (!posName || !posName.trim()) return;
    const cleanName = posName.trim();
    const newPosId = `${formId}-${cleanName}-${Date.now()}_${pIdx}`;
    const newPos: PositionSlot = { id: newPosId, name: cleanName };

    const form = currentFormations.find((f) => f.id === formId);
    const oldPos = form?.rows[rIdx]?.positions[pIdx];
    const now = Date.now();
    const modPosIds: string[] = [newPosId];
    if (oldPos?.id) {
      modPosIds.push(oldPos.id);
      recentlyModifiedPositionsRef.current.set(oldPos.id, now);
    }
    recentlyModifiedFormationsRef.current.set(formId, now);
    recentlyModifiedPositionsRef.current.set(newPosId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        const positions = [...rows[rIdx].positions];
        while (positions.length <= pIdx) {
          positions.push(null);
        }
        positions[pIdx] = newPos;
        rows[rIdx] = { ...rows[rIdx], slotCount: positions.length, positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');

    updateCurrentWeekFormations(forms, true, true, {
      scope: 'formation_slot_assign',
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleAddPositionDirect = (
    formId: string,
    rIdx: number,
    posName: string
  ) => {
    if (!posName || !posName.trim()) return;
    const cleanName = posName.trim();
    const newPosId = `${formId}-${cleanName}-${Date.now()}`;
    const newPos: PositionSlot = { id: newPosId, name: cleanName };
    const now = Date.now();

    recentlyModifiedFormationsRef.current.set(formId, now);
    recentlyModifiedPositionsRef.current.set(newPosId, now);

    const form = currentFormations.find((f) => f.id === formId);
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        const positions = [...rows[rIdx].positions];
        const emptyIdx = positions.indexOf(null);
        if (emptyIdx !== -1) {
          positions[emptyIdx] = newPos;
        } else {
          positions.push(newPos);
        }
        rows[rIdx] = { ...rows[rIdx], slotCount: positions.length, positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_add',
      modifiedPosIds: [newPosId],
      activeUnit: targetUnit,
    });
  };

  const handleRenamePositionDirect = (
    formId: string,
    rIdx: number,
    pIdx: number,
    newName: string
  ) => {
    if (!newName || !newName.trim()) return;
    const cleanName = newName.trim();
    const form = currentFormations.find((f) => f.id === formId);
    const oldPos = form?.rows[rIdx]?.positions[pIdx];
    if (!oldPos) return;

    const now = Date.now();
    recentlyModifiedFormationsRef.current.set(formId, now);
    recentlyModifiedPositionsRef.current.set(oldPos.id, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]?.positions[pIdx]) return f;
        const positions = [...rows[rIdx].positions];
        positions[pIdx] = { ...positions[pIdx]!, name: cleanName };
        rows[rIdx] = { ...rows[rIdx], positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_rename',
      modifiedPosIds: [oldPos.id],
      activeUnit: targetUnit,
    });
  };

  const handleRenameRowDirect = (
    formId: string,
    rIdx: number,
    newName: string
  ) => {
    if (!newName || !newName.trim()) return;
    const cleanName = newName.trim();
    const form = currentFormations.find((f) => f.id === formId);
    recentlyModifiedFormationsRef.current.set(formId, Date.now());
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        rows[rIdx] = { ...rows[rIdx], label: cleanName };
        return { ...f, rows };
      }
      return f;
    });
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'row_rename',
      activeUnit: targetUnit,
    });
  };

  const handleAddRowDirect = (
    formId: string,
    label: string,
    slotCount: number = 7
  ) => {
    const cleanLabel = (label && label.trim()) || 'Secondary Level';
    const safeSlots = Math.max(1, Math.min(12, slotCount || 7));
    const form = currentFormations.find((f) => f.id === formId);
    recentlyModifiedFormationsRef.current.set(formId, Date.now());
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        return {
          ...f,
          rows: [
            ...f.rows,
            {
              id: `row_${Date.now()}_${f.rows.length}`,
              label: cleanLabel,
              slotCount: safeSlots,
              positions: Array(safeSlots).fill(null),
            },
          ],
        };
      }
      return f;
    });
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'row_add',
      activeUnit: targetUnit,
    });
  };

  const handleAddFormationDirect = (
    unit: 'offense' | 'defense' | 'st' | 'groups',
    name: string,
    templateKey?: string
  ) => {
    const cleanName = (name && name.trim()) || `New ${unit.toUpperCase()} Formation`;
    const newId = `form_${Date.now()}`;
    
    let initialRows: FormationRow[] = [
      {
        id: `row_${Date.now()}_0`,
        label: unit === 'offense' ? 'Offensive Line' : unit === 'defense' ? 'Defensive Line' : unit === 'st' ? 'Line / Coverage' : 'Level 1',
        slotCount: 7,
        positions: Array(7).fill(null),
      },
    ];

    if (templateKey === '11_offense' || (unit === 'offense' && cleanName.toLowerCase().includes('11'))) {
      initialRows = [
        {
          id: `row_${Date.now()}_0`,
          label: 'Offensive Line & TE (Y1)',
          slotCount: 7,
          positions: [
            { id: `${newId}-LT`, name: 'LT' },
            { id: `${newId}-LG`, name: 'LG' },
            { id: `${newId}-C`, name: 'C' },
            { id: `${newId}-RG`, name: 'RG' },
            { id: `${newId}-RT`, name: 'RT' },
            { id: `${newId}-Y1`, name: 'Y1' },
            null,
          ],
        },
        {
          id: `row_${Date.now()}_1`,
          label: 'Wide Receivers (X, W, Z)',
          slotCount: 7,
          positions: [
            { id: `${newId}-X`, name: 'X' },
            null,
            null,
            null,
            { id: `${newId}-W`, name: 'W' },
            null,
            { id: `${newId}-Z`, name: 'Z' },
          ],
        },
        {
          id: `row_${Date.now()}_2`,
          label: 'Backfield (1 - 4)',
          slotCount: 7,
          positions: [
            null,
            null,
            { id: `${newId}-1`, name: '1 (QB)' },
            null,
            { id: `${newId}-4`, name: '4 (RB)' },
            null,
            null,
          ],
        },
      ];
    } else if (templateKey === '44_defense' || (unit === 'defense' && cleanName.toLowerCase().includes('4-4'))) {
      initialRows = [
        {
          id: `row_${Date.now()}_0`,
          label: 'Defensive Line (WDE, DT, NT, SDE)',
          slotCount: 7,
          positions: [
            null,
            { id: `${newId}-WDE`, name: 'WDE' },
            { id: `${newId}-LDT`, name: 'LDT' },
            null,
            { id: `${newId}-RDT`, name: 'RDT' },
            { id: `${newId}-SDE`, name: 'SDE' },
            null,
          ],
        },
        {
          id: `row_${Date.now()}_1`,
          label: 'Linebackers (WLB, MLB, SLB, ROV)',
          slotCount: 7,
          positions: [
            { id: `${newId}-WLB`, name: 'WLB' },
            null,
            { id: `${newId}-MLB`, name: 'MLB' },
            null,
            { id: `${newId}-SLB`, name: 'SLB' },
            null,
            { id: `${newId}-ROV`, name: 'ROV' },
          ],
        },
        {
          id: `row_${Date.now()}_2`,
          label: 'Secondary (LCB, FS, SS, RCB)',
          slotCount: 7,
          positions: [
            { id: `${newId}-LCB`, name: 'LCB' },
            null,
            { id: `${newId}-FS`, name: 'FS' },
            null,
            { id: `${newId}-SS`, name: 'SS' },
            null,
            { id: `${newId}-RCB`, name: 'RCB' },
          ],
        },
      ];
    } else if (unit === 'defense') {
      initialRows = [
        {
          id: `row_${Date.now()}_0`,
          label: 'Defensive Line',
          slotCount: 7,
          positions: [
            null,
            { id: `${newId}-WDE`, name: 'WDE' },
            { id: `${newId}-DT1`, name: 'DT1' },
            null,
            { id: `${newId}-DT2`, name: 'DT2' },
            { id: `${newId}-SDE`, name: 'SDE' },
            null,
          ],
        },
        {
          id: `row_${Date.now()}_1`,
          label: 'Linebackers',
          slotCount: 7,
          positions: [
            null,
            { id: `${newId}-WLB`, name: 'WLB' },
            null,
            { id: `${newId}-MLB`, name: 'MLB' },
            null,
            { id: `${newId}-SLB`, name: 'SLB' },
            null,
          ],
        },
        {
          id: `row_${Date.now()}_2`,
          label: 'Secondary',
          slotCount: 7,
          positions: [
            { id: `${newId}-CB1`, name: 'CB1' },
            null,
            { id: `${newId}-FS`, name: 'FS' },
            null,
            { id: `${newId}-SS`, name: 'SS' },
            null,
            { id: `${newId}-CB2`, name: 'CB2' },
          ],
        },
      ];
    } else if (unit === 'st') {
      initialRows = [
        {
          id: `row_${Date.now()}_0`,
          label: 'Front Line & Coverage',
          slotCount: 7,
          positions: [
            { id: `${newId}-L1`, name: 'L1' },
            { id: `${newId}-L2`, name: 'L2' },
            { id: `${newId}-LS`, name: 'LS/C' },
            { id: `${newId}-R2`, name: 'R2' },
            { id: `${newId}-R1`, name: 'R1' },
            { id: `${newId}-GN1`, name: 'Gunner L' },
            { id: `${newId}-GN2`, name: 'Gunner R' },
          ],
        },
        {
          id: `row_${Date.now()}_1`,
          label: 'Specialists & Returners',
          slotCount: 7,
          positions: [
            null,
            { id: `${newId}-UP`, name: 'Upback' },
            null,
            { id: `${newId}-K`, name: 'K / P' },
            null,
            { id: `${newId}-RET`, name: 'Returner' },
            null,
          ],
        },
      ];
    }

    const newForm: FormationBoard = {
      id: newId,
      unit,
      name: cleanName,
      collapsed: false,
      rows: initialRows,
    };

    const updated = [...currentFormations, newForm];
    updateCurrentWeekFormations(updated, true, true, {
      scope: 'formation_add',
      activeUnit: unit,
    });
    setSelectedFormationId(newId);
  };

  const handleRenameFormationDirect = (formId: string, newName: string) => {
    if (!newName || !newName.trim()) return;
    const clean = newName.trim();
    const form = currentFormations.find((f) => f.id === formId);
    const updated = currentFormations.map((f) =>
      f.id === formId ? { ...f, name: clean } : f
    );
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(updated, true, true, {
      scope: 'formation_rename',
      activeUnit: targetUnit,
    });
  };

  const handleDuplicateFormationDirect = (formId: string, newName: string) => {
    if (userRole !== 'admin') return;
    const form = currentFormations.find((f) => f.id === formId);
    if (!form) return;
    const clean = (newName && newName.trim()) || `${form.name} (Copy)`;

    const newFormId = `form_${Date.now()}`;
    const dc = { ...currentDepthChart };
    const sc = { ...currentScrimmageChart };

    const clonedForm: FormationBoard = {
      id: newFormId,
      unit: form.unit,
      name: clean,
      collapsed: false,
      rows: form.rows.map((row, rIdx) => ({
        id: `row_${Date.now()}_${rIdx}`,
        label: row.label,
        slotCount: row.slotCount,
        positions: row.positions.map((pos, pIdx) => {
          if (pos) {
            const newPosId = `${newFormId}-${pos.name}-${Date.now()}_${pIdx}`;
            if (dc[pos.id]) dc[newPosId] = deepClone(dc[pos.id]);
            if (sc[pos.id]) sc[newPosId] = deepClone(sc[pos.id]);
            return { id: newPosId, name: pos.name };
          }
          return null;
        }),
      })),
    };

    const updated = [...currentFormations, clonedForm];
    const targetUnit = form.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekDepthChart(dc);
    updateCurrentWeekScrimmageChart(sc);
    updateCurrentWeekFormations(updated, true, true, {
      scope: 'formation_duplicate',
      activeUnit: targetUnit,
    });
    setSelectedFormationId(newFormId);
  };

  const handleMovePositionDirect = (
    formId: string,
    srcRIdx: number,
    srcPIdx: number,
    targetRIdx: number
  ) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[srcRIdx]?.positions[srcPIdx]) return;
    const pos = form.rows[srcRIdx].positions[srcPIdx]!;
    if (targetRIdx < 0 || targetRIdx >= form.rows.length) return;

    const now = Date.now();
    const modPosIds: string[] = [pos.id];
    recentlyModifiedPositionsRef.current.set(pos.id, now);
    recentlyModifiedFormationsRef.current.set(formId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = deepClone(f.rows);
        rows[srcRIdx].positions[srcPIdx] = null;
        const emptyIdx = rows[targetRIdx].positions.indexOf(null);
        if (emptyIdx !== -1) {
          const displaced = rows[targetRIdx].positions[emptyIdx];
          if (displaced?.id) {
            modPosIds.push(displaced.id);
            recentlyModifiedPositionsRef.current.set(displaced.id, now);
          }
          rows[targetRIdx].positions[emptyIdx] = pos;
        } else {
          rows[targetRIdx].positions.push(pos);
          rows[targetRIdx].slotCount = rows[targetRIdx].positions.length;
        }
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');

    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_move_direct',
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleCopyPositionDirect = (
    formId: string,
    srcRIdx: number,
    srcPIdx: number,
    targetFormId: string
  ) => {
    const srcForm = currentFormations.find((f) => f.id === formId);
    if (!srcForm || !srcForm.rows[srcRIdx]?.positions[srcPIdx]) return;
    const pos = srcForm.rows[srcRIdx].positions[srcPIdx]!;

    const targetForm = currentFormations.find((f) => f.id === targetFormId);
    if (!targetForm) return;

    const newPosId = `${targetForm.id}-${pos.name}-${Date.now()}`;
    const newPos = { id: newPosId, name: pos.name };
    const now = Date.now();

    recentlyModifiedFormationsRef.current.set(formId, now);
    recentlyModifiedFormationsRef.current.set(targetFormId, now);
    recentlyModifiedPositionsRef.current.set(pos.id, now);
    recentlyModifiedPositionsRef.current.set(newPosId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === targetForm.id) {
        const rows = [...f.rows];
        rows[0].positions.push(newPos);
        rows[0].slotCount = rows[0].positions.length;
        return { ...f, rows };
      }
      return f;
    });

    const dc = { ...currentDepthChart };
    if (dc[pos.id]) dc[newPosId] = deepClone(dc[pos.id]);

    const targetUnit = targetForm.unit || srcForm.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');

    updateCurrentWeekDepthChart(dc);
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_copy',
      modifiedPosIds: [pos.id, newPosId],
      activeUnit: targetUnit,
    });
  };

  const handleAddFormation = (unit: 'offense' | 'defense' | 'st' | 'groups') => {
    handleAddFormationDirect(unit, `New ${unit.toUpperCase()} Formation`);
  };

  const handleDuplicateFormation = (formId: string) => {
    handleDuplicateFormationDirect(formId, '');
  };

  const handleRenameFormation = (formId: string) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form) return;
    handleRenameFormationDirect(formId, form.name);
  };

  const handleDeleteFormation = (formId: string) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form) return;

    // Collect all position IDs in the deleted formation to clean up depthChart/scrimmageChart
    const deletedPosIds = new Set<string>();
    if (Array.isArray(form.rows)) {
      form.rows.forEach((r) => {
        if (r && Array.isArray(r.positions)) {
          r.positions.forEach((p) => {
            if (p && p.id) deletedPosIds.add(p.id);
          });
        }
      });
    }

    const updated = currentFormations.filter((f) => f.id !== formId);

    // Track deleted formation ID to prevent resurrection
    const nextDeletedIds = Array.from(
      new Set([...(deletedFormationIds || []), ...(latestStateRef.current.deletedFormationIds || []), formId])
    );
    setDeletedFormationIds(nextDeletedIds);
    latestStateRef.current.deletedFormationIds = nextDeletedIds;
    safeJSONSet('footballDeletedFormationIds', nextDeletedIds);

    lastLocalEditTimeRef.current = Date.now();
    setWeeklyData((prev) => {
      const updatedAll: Record<string, WeekState> = {};
      for (const [wKey, wState] of Object.entries(prev)) {
        if (!wState) continue;
        const newFormations = (wState.formations || []).filter((f) => f && f.id !== formId);
        const newDepthChart = { ...(wState.depthChart || {}) };
        const newScrimmageChart = { ...(wState.scrimmageChart || {}) };
        deletedPosIds.forEach((posId) => {
          delete newDepthChart[posId];
          delete newScrimmageChart[posId];
        });
        updatedAll[wKey] = {
          ...wState,
          formations: newFormations,
          depthChart: newDepthChart,
          scrimmageChart: newScrimmageChart,
        };
      }
      safeJSONSet('footballWeeklyData', updatedAll);
      latestStateRef.current.weeklyData = updatedAll;
      return updatedAll;
    });

    const nextDefaultForms = (latestStateRef.current.defaultFormations || []).filter(
      (f) => f && f.id !== formId
    );
    setDefaultFormations(nextDefaultForms);
    safeJSONSet('footballDefaultFormations', nextDefaultForms);
    latestStateRef.current.defaultFormations = nextDefaultForms;

    if (selectedFormationId === formId) {
      const targetUnit = form.unit;
      const remainingSameUnit = updated.filter((f) => f.unit === targetUnit);
      if (remainingSameUnit.length > 0) {
        setSelectedFormationId(remainingSameUnit[0].id);
      } else if (updated.length > 0) {
        setSelectedFormationId(updated[0].id);
      }
    }

    flushAndSaveStateToStorage('delete_formation', { deletedFormationId: formId });
  };

  const handleMoveFormation = (formId: string, direction: number) => {
    const forms = [...currentFormations];
    const targetForm = forms.find((f) => f.id === formId);
    if (!targetForm) return;

    const targetUnit = targetForm.unit;
    const unitForms = forms.filter((f) => f.unit === targetUnit);
    const uIdx = unitForms.findIndex((f) => f.id === formId);
    if (uIdx === -1) return;
    const targetUIdx = uIdx + direction;
    if (targetUIdx < 0 || targetUIdx >= unitForms.length) return;

    // Create cleanly reordered array for this unit
    const reorderedUnitForms = [...unitForms];
    const [movedItem] = reorderedUnitForms.splice(uIdx, 1);
    reorderedUnitForms.splice(targetUIdx, 0, movedItem);

    // Reconstruct full formations array replacing targetUnit formations in-place
    let repIdx = 0;
    const nextFormations = forms.map((f) => {
      if (f.unit === targetUnit) {
        const rep = reorderedUnitForms[repIdx];
        repIdx++;
        return rep || f;
      }
      return f;
    });

    lastLocalEditTimeRef.current = Date.now();
    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);

    // Synchronize across all weeks for active team and legacy key
    setWeeklyData((prev) => {
      const updatedAll: Record<string, WeekState> = {};
      for (const [wKey, wState] of Object.entries(prev)) {
        if (!wState) continue;
        const isCurrentTeamWeek =
          wKey.startsWith(`${activeTeamId}__`) ||
          (!wKey.includes('__') && activeTeamId === 'team_10u');

        if (isCurrentTeamWeek && Array.isArray(wState.formations)) {
          // Reorder unit formations in this week to match new order
          const weekUnitForms = wState.formations.filter((f) => f && f.unit === targetUnit);
          const thisUnitOrdered = reorderedUnitForms.filter((rf) =>
            weekUnitForms.some((f) => f && f.id === rf.id)
          );
          let wRepIdx = 0;
          const finalWeekForms = wState.formations.map((f) => {
            if (f && f.unit === targetUnit) {
              const rep = thisUnitOrdered[wRepIdx];
              wRepIdx++;
              return rep || f;
            }
            return f;
          });

          updatedAll[wKey] = {
            ...wState,
            formations: finalWeekForms,
          };
        } else {
          updatedAll[wKey] = wState;
        }
      }

      // Explicitly set target scoped week and currentWeek
      const curState = resolveWeekState(prev, activeTeamId, currentWeek);
      updatedAll[scopedKey] = { ...curState, formations: nextFormations };
      updatedAll[currentWeek] = { ...curState, formations: nextFormations };

      latestStateRef.current.weeklyData = updatedAll;
      safeJSONSet('footballWeeklyData', updatedAll);
      return updatedAll;
    });

    // Reorder defaultFormations
    const curDefaults = latestStateRef.current.defaultFormations || defaultFormations || [];
    let dRepIdx = 0;
    const nextDefaults = curDefaults.map((df) => {
      if (df.unit === targetUnit) {
        const rep = reorderedUnitForms[dRepIdx];
        dRepIdx++;
        return rep || df;
      }
      return df;
    });
    setDefaultFormations(nextDefaults);
    latestStateRef.current.defaultFormations = nextDefaults;
    safeJSONSet('footballDefaultFormations', nextDefaults);

    flushAndSaveStateToStorage('move_formation', {
      movedFormationId: formId,
      direction,
      activeUnit: targetUnit,
    });
  };

  const handleRestoreDefaultFormations = (targetUnit: 'offense' | 'defense' | 'st' | 'groups') => {
    const baseDefaults = INITIAL_DEFAULT_FORMATIONS.filter(
      (f) =>
        f &&
        f.unit === targetUnit &&
        f.id !== 'form_10_spread' &&
        f.name !== '10 Spread Offense'
    );
    const baseDefaultIds = new Set(baseDefaults.map((f) => f.id));

    // Clear these IDs from deletedFormationIds
    const nextDeleted = (deletedFormationIds || []).filter((id) => !baseDefaultIds.has(id));
    if (!nextDeleted.includes('form_10_spread')) {
      nextDeleted.push('form_10_spread');
    }
    setDeletedFormationIds(nextDeleted);
    latestStateRef.current.deletedFormationIds = nextDeleted;
    safeJSONSet('footballDeletedFormationIds', nextDeleted);

    // Replace targetUnit in defaultFormations
    const otherUnitDefaults = (latestStateRef.current.defaultFormations || defaultFormations || []).filter(
      (f) => f && f.unit !== targetUnit && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
    );
    const nextDefaults = [...otherUnitDefaults, ...deepClone(baseDefaults)];
    setDefaultFormations(nextDefaults);
    latestStateRef.current.defaultFormations = nextDefaults;
    safeJSONSet('footballDefaultFormations', nextDefaults);

    // Update weeklyData across all weeks
    lastLocalEditTimeRef.current = Date.now();
    setWeeklyData((prev) => {
      const updatedAll: Record<string, WeekState> = {};
      for (const [wKey, wState] of Object.entries(prev)) {
        if (!wState) continue;
        const otherUnitForms = (wState.formations || []).filter(
          (f) => f && f.unit !== targetUnit && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
        );
        updatedAll[wKey] = {
          ...wState,
          formations: [...otherUnitForms, ...deepClone(baseDefaults)],
        };
      }
      latestStateRef.current.weeklyData = updatedAll;
      safeJSONSet('footballWeeklyData', updatedAll);
      return updatedAll;
    });

    if (baseDefaults.length > 0) {
      setSelectedFormationId(baseDefaults[0].id);
    }

    flushAndSaveStateToStorage('restore_default_formations', { targetUnit });
  };

  const handleAddRow = (formId: string) => {
    handleAddRowDirect(formId, 'Secondary Level', 7);
  };

  const handleEditRowName = (formId: string, rIdx: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]) return;
    handleRenameRowDirect(formId, rIdx, form.rows[rIdx].label);
  };

  const handleEditRowSlots = (formId: string, rIdx: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]) return;
    handleSetRowSlots(formId, rIdx, form.rows[rIdx].positions.length);
  };

  const handleDeleteRow = (formId: string, rIdx: number) => {
    if (!confirm('Delete this row?')) return;
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]) return;

    const now = Date.now();
    const modPosIds: string[] = [];
    form.rows[rIdx].positions.forEach((p) => {
      if (p?.id) {
        modPosIds.push(p.id);
        recentlyModifiedPositionsRef.current.set(p.id, now);
      }
    });
    recentlyModifiedFormationsRef.current.set(formId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        rows.splice(rIdx, 1);
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'row_delete',
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleAddPosition = (formId: string, rIdx: number) => {
    handleAddPositionDirect(formId, rIdx, 'Pos');
  };

  const handleEditPositionName = (
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]?.positions[pIdx]) return;
    handleRenamePositionDirect(formId, rIdx, pIdx, form.rows[rIdx].positions[pIdx]!.name);
  };

  const handleMovePositionRow = (
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]?.positions[pIdx]) return;
    handleMovePositionDirect(formId, rIdx, pIdx, (rIdx + 1) % form.rows.length);
  };

  const handleCopyPositionToOtherForm = (
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    const otherForm = currentFormations.find((f) => f.id !== formId);
    if (otherForm) {
      handleCopyPositionDirect(formId, rIdx, pIdx, otherForm.id);
    }
  };

  const handleDeletePosition = (
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    const form = currentFormations.find((f) => f.id === formId);
    const pos = form?.rows[rIdx]?.positions[pIdx];
    const now = Date.now();
    const modPosIds: string[] = [];
    if (pos?.id) {
      modPosIds.push(pos.id);
      recentlyModifiedPositionsRef.current.set(pos.id, now);
    }
    recentlyModifiedFormationsRef.current.set(formId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        rows[rIdx].positions.splice(pIdx, 1);
        rows[rIdx].slotCount = rows[rIdx].positions.length;
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_delete',
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  /* =========================================================================
     PRACTICE PLAN ACTIONS
     ========================================================================= */
  const updatePracticeDataAndSave = (
    updater: (prev: PracticePlan[]) => PracticePlan[],
    immediate: boolean = false,
    modifiedPlanId?: string
  ) => {
    const now = Date.now();
    lastLocalEditTimeRef.current = now;
    setPracticeData((prev) => {
      const targetId = modifiedPlanId || currentPracticeIdRef.current;
      const rawUpdated = updater(prev);
      const updated = rawUpdated.map((p) => {
        if (!p) return p;
        const wasTargeted = targetId ? p.id === targetId : true;
        return {
          ...p,
          lastEdited: wasTargeted ? now : (p.lastEdited || now),
        };
      });
      latestStateRef.current.practiceData = updated;
      safeJSONSet('footballPracticeData', updated);
      return updated;
    });
    if (immediate) {
      flushAndSaveStateToStorage('practice_immediate');
    } else {
      debouncedSave('practice');
    }
  };

  const handleOpenNewPracticeModal = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = prompt('Enter Date (YYYY-MM-DD):', todayStr);
    if (!dateStr || !dateStr.trim()) return;

    const cleanDate = dateStr.trim();
    const dayOfWeek = getDayOfWeekForDate(cleanDate);
    const dayFolder = getFormattedDayFolder(cleanDate);
    const weekFolder = calculateWeekFolderForDate(cleanDate, scheduleEvents);

    // Calculate next sequential practice number among non-cancelled practices
    const activeCount = practiceData.filter((p) => !p.isCancelled).length;
    const defaultTitle = `Practice #${activeCount + 1} - ${dayOfWeek} (${weekFolder})`;
    const title = prompt('Enter Practice Title:', defaultTitle);
    if (!title || !title.trim()) return;

    const newPrac: PracticePlan = {
      id: `prac_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      teamId: activeTeamId,
      year: cleanDate.includes('-') ? cleanDate.split('-')[0] : '2026',
      weekFolder: weekFolder,
      dayFolder: dayFolder,
      title: title.trim(),
      date: cleanDate,
      day: dayOfWeek,
      startTime: '17:05',
      endTime: '19:00',
      location: 'Crane Road',
      lastEdited: Date.now(),
      plan: deepClone(DEFAULT_PRACTICE_TEMPLATES['Standard Practice']),
    };

    updatePracticeDataAndSave((prev) => [...prev, newPrac]);
    setCurrentPracticeId(newPrac.id);
  };

  const handleEditPracticeDetails = () => {
    const cur = practiceData.find((p) => p.id === currentPracticeId);
    if (!cur) return;
    const yr = prompt('Edit Season Year:', cur.year || '2026');
    if (yr === null) return;
    const dt = prompt('Edit Date (YYYY-MM-DD):', cur.date);
    if (dt === null) return;

    const cleanDate = dt.trim();
    const autoWeek = calculateWeekFolderForDate(cleanDate, scheduleEvents);
    const autoDay = getDayOfWeekForDate(cleanDate);
    const autoDayFolder = getFormattedDayFolder(cleanDate);

    const wk = prompt('Edit Week Folder:', autoWeek || cur.weekFolder || 'Week 1');
    if (wk === null) return;
    const title = prompt('Edit Practice Title:', cur.title);
    if (title === null) return;

    updatePracticeDataAndSave((prev) =>
      prev.map((p) =>
        p.id === currentPracticeId
          ? {
              ...p,
              year: yr.trim(),
              weekFolder: wk.trim(),
              title: title.trim(),
              date: cleanDate,
              day: autoDay,
              dayFolder: autoDayFolder,
              lastEdited: Date.now(),
            }
          : p
      )
    );
  };

  const handleTogglePracticeCancelled = (
    practiceId: string,
    isCancelled?: boolean,
    reason?: string
  ) => {
    let targetDate = '';
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === practiceId) {
          targetDate = p.date || '';
          const newStatus = isCancelled !== undefined ? isCancelled : !p.isCancelled;
          return {
            ...p,
            isCancelled: newStatus,
            cancellationReason: reason !== undefined ? reason : (newStatus ? 'Cancelled' : ''),
            lastEdited: Date.now(),
          };
        }
        return p;
      })
    );

    // Also sync to matching ScheduleEvent if any
    setScheduleEvents((prev) => {
      const curPlan = practiceData.find((p) => p.id === practiceId);
      const next = prev.map((ev) => {
        if (
          ev.linkedPracticePlanId === practiceId ||
          (ev.date && targetDate && ev.date === targetDate && (ev.type === 'practice' || ev.type === 'scrimmage'))
        ) {
          const newStatus = isCancelled !== undefined ? isCancelled : !ev.isCancelled;
          return {
            ...ev,
            isCancelled: newStatus,
            cancellationReason: reason !== undefined ? reason : (curPlan?.cancellationReason || (newStatus ? 'Cancelled' : '')),
            lastEdited: Date.now(),
          };
        }
        return ev;
      });
      safeJSONSet('footballScheduleEvents', next);
      latestStateRef.current.scheduleEvents = next;
      return next;
    });
  };

  const handleTogglePracticeNonPractice = (
    practiceId: string,
    isNonPractice?: boolean
  ) => {
    let targetDate = '';
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === practiceId) {
          targetDate = p.date || '';
          const newStatus = isNonPractice !== undefined ? isNonPractice : !p.isNonPractice;
          return {
            ...p,
            isNonPractice: newStatus,
            lastEdited: Date.now(),
          };
        }
        return p;
      })
    );

    // Also sync to matching ScheduleEvent if any
    setScheduleEvents((prev) => {
      const next = prev.map((ev) => {
        if (
          ev.linkedPracticePlanId === practiceId ||
          (ev.date && targetDate && ev.date === targetDate && (ev.type === 'practice' || ev.type === 'scrimmage' || ev.type === 'walkthrough'))
        ) {
          const newStatus = isNonPractice !== undefined ? isNonPractice : !ev.isNonPractice;
          return {
            ...ev,
            isNonPractice: newStatus,
            lastEdited: Date.now(),
          };
        }
        return ev;
      });
      safeJSONSet('footballScheduleEvents', next);
      latestStateRef.current.scheduleEvents = next;
      return next;
    });
    debouncedSave('schedule');
  };

  const handleQuickCreatePlanFromSchedule = (evt: ScheduleEvent) => {
    const planId = handleSyncPracticeToPlan(evt);
    const rawWeek = String(evt.week !== undefined ? evt.week : '1');
    const match = rawWeek.match(/Week\s*(\d+)/i);
    const weekNum = match ? match[1] : rawWeek.replace(/\D/g, '') || '1';
    ensureWeekExists(weekNum);
    changeCurrentWeek(weekNum);
    setCurrentPracticeId(planId);
    setActiveUnit('practice');
  };

  const handleUpdateRoster = (newRoster: RosterPlayer[]) => {
    const normalized = normalizeRoster(newRoster, false);
    setRoster(normalized);
    safeJSONSet('footballRoster', normalized);
    latestStateRef.current.roster = normalized;

    // Build map of jersey number -> display name
    const nameMap = new Map<string, string>();
    normalized.forEach((p) => {
      const displayName = (p.rosterName || p.lastName || `${p.firstName} ${p.lastName}`).trim();
      nameMap.set(p.num.trim(), displayName);
    });

    // Cascade updated names to placed players in depth charts and scrimmage charts
    setWeeklyData((prev) => {
      let changed = false;
      const nextWeekly = { ...prev };
      Object.keys(nextWeekly).forEach((wKey) => {
        const wState = nextWeekly[wKey];
        if (!wState) return;
        let weekChanged = false;
        let newDC = wState.depthChart;
        let newSC = wState.scrimmageChart;

        if (newDC) {
          const updatedDC: Record<string, PlacedPlayer[]> = {};
          let dcChanged = false;
          Object.entries(newDC).forEach(([posId, players]) => {
            if (Array.isArray(players)) {
              let posChanged = false;
              const nextPlayers = players.map((p) => {
                if (p && p.num && nameMap.has(p.num.trim())) {
                  const mappedName = nameMap.get(p.num.trim())!;
                  if (p.name !== mappedName) {
                    posChanged = true;
                    return { ...p, name: mappedName };
                  }
                }
                return p;
              });
              if (posChanged) {
                dcChanged = true;
                updatedDC[posId] = nextPlayers;
              } else {
                updatedDC[posId] = players;
              }
            } else {
              updatedDC[posId] = players;
            }
          });
          if (dcChanged) {
            newDC = updatedDC;
            weekChanged = true;
          }
        }

        if (newSC) {
          const updatedSC: Record<string, PlacedPlayer[]> = {};
          let scChanged = false;
          Object.entries(newSC).forEach(([posId, players]) => {
            if (Array.isArray(players)) {
              let posChanged = false;
              const nextPlayers = players.map((p) => {
                if (p && p.num && nameMap.has(p.num.trim())) {
                  const mappedName = nameMap.get(p.num.trim())!;
                  if (p.name !== mappedName) {
                    posChanged = true;
                    return { ...p, name: mappedName };
                  }
                }
                return p;
              });
              if (posChanged) {
                scChanged = true;
                updatedSC[posId] = nextPlayers;
              } else {
                updatedSC[posId] = players;
              }
            } else {
              updatedSC[posId] = players;
            }
          });
          if (scChanged) {
            newSC = updatedSC;
            weekChanged = true;
          }
        }

        if (weekChanged) {
          changed = true;
          nextWeekly[wKey] = {
            ...wState,
            depthChart: newDC,
            scrimmageChart: newSC,
          };
        }
      });
      return changed ? nextWeekly : prev;
    });
  };

  const handleUpdatePlayerInRoster = (updatedPlayer: RosterPlayer) => {
    const next = roster.map((p) =>
      p.id === updatedPlayer.id || p.num === updatedPlayer.num ? updatedPlayer : p
    );
    handleUpdateRoster(next);
  };

  const handleAutoNumberPractices = () => {
    if (
      confirm(
        'Auto-number non-cancelled practice plans sequentially by date? (Cancelled practices will be excluded from the practice count and subsequent plans will be re-numbered)'
      )
    ) {
      updatePracticeDataAndSave((prev) => {
        // Sort chronologically
        const sorted = [...prev].sort((a, b) => {
          const dateA = a.date || '1970-01-01';
          const dateB = b.date || '1970-01-01';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
        });

        let seqNum = 0;
        const newTitleMap: Record<string, string> = {};
        sorted.forEach((p) => {
          if (p.isCancelled) {
            newTitleMap[p.id] = p.title.startsWith('[Cancelled]')
              ? p.title
              : `[Cancelled] ${p.title.replace(/^Practice #\d+\s*[:-]?\s*/i, '')}`;
          } else {
            seqNum++;
            const dayName = p.day || getDayOfWeekForDate(p.date);
            const wk = p.weekFolder || calculateWeekFolderForDate(p.date, scheduleEvents);
            
            // Check if there is existing custom focus text in the title (after " - ")
            const dashIdx = p.title.indexOf(' - ');
            const hasCustomText =
              dashIdx !== -1 &&
              !p.title.substring(dashIdx + 3).startsWith('Practice #');
            const customFocus = hasCustomText
              ? p.title.substring(dashIdx + 3).trim()
              : `${dayName} (${wk})`;

            newTitleMap[p.id] = `Practice #${seqNum} - ${customFocus}`;
          }
        });

        return prev.map((p) => ({
          ...p,
          title: newTitleMap[p.id] || p.title,
          lastEdited: Date.now(),
        }));
      });
    }
  };

  const handleDeletePractice = () => {
    if (practiceData.length <= 1) {
      alert('Cannot delete the last practice plan.');
      return;
    }
    const planToDelete = practiceData.find((p) => p.id === currentPracticeId);
    if (!planToDelete) return;

    const matchingEvent = scheduleEvents.find(
      (e) =>
        e.linkedPracticePlanId === planToDelete.id ||
        (planToDelete.date && e.date === planToDelete.date && (e.type === 'practice' || e.type === 'scrimmage'))
    );

    const hasAttendance = attendanceLogs.some(
      (l) => planToDelete.date && l.date === planToDelete.date
    );

    let confirmPrompt = `Delete practice plan "${planToDelete.title || 'Current Practice'}"?`;
    if (matchingEvent || hasAttendance) {
      confirmPrompt += `\n\nThis will also remove this practice from the Schedule and Attendance Tracker.`;
    }

    if (confirm(confirmPrompt)) {
      const deletedPlanId = planToDelete.id;
      setDeletedPracticePlanIds((prev) => {
        const next = Array.from(new Set([...prev, deletedPlanId]));
        latestStateRef.current.deletedPracticePlanIds = next;
        safeJSONSet('footballDeletedPracticePlanIds', next);
        return next;
      });

      const remaining = practiceData.filter((p) => p.id !== deletedPlanId);
      updatePracticeDataAndSave(() => remaining, true);
      setCurrentPracticeId(remaining[0]?.id || null);

      if (matchingEvent) {
        handleDeleteScheduleEvent(matchingEvent.id);
      } else if (hasAttendance && planToDelete.date) {
        // Clean up attendance logs for this date if no event
        const matchingLogs = attendanceLogs.filter((l) => l.date === planToDelete.date);
        if (matchingLogs.length > 0) {
          const matchingIds = new Set(matchingLogs.map((l) => l.id));
          const updatedLogs = attendanceLogs.filter((l) => !matchingIds.has(l.id));
          setAttendanceLogs(updatedLogs);
          safeJSONSet('footballAttendanceLogs', updatedLogs);
        }
      }
      flushAndSaveStateToStorage('delete_practice_plan', { deletedPracticePlanId: deletedPlanId });
    }
  };

  const handleApplyPracticeTemplate = (templateName: string) => {
    const tmpl = practiceTemplates[templateName];
    if (!tmpl) {
      alert(`Template "${templateName}" not found.`);
      return;
    }
    const planToApply = Array.isArray(tmpl)
      ? tmpl
      : (tmpl as any).plan || (tmpl as any).periods;
    if (!Array.isArray(planToApply) || planToApply.length === 0) {
      alert(`Template "${templateName}" has no periods to apply.`);
      return;
    }
    if (
      confirm(
        `Apply template "${templateName}"? This will replace the periods in the active practice plan.`
      )
    ) {
      const activeList =
        activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData;
      const targetId =
        currentPracticeId ||
        findBestActivePracticeId(activeList) ||
        activeList[0]?.id;

      if (!targetId) {
        alert('Please create or select a practice plan first.');
        return;
      }

      updatePracticeDataAndSave((prev) =>
        prev.map((p) =>
          p.id === targetId
            ? {
                ...p,
                plan: deepClone(planToApply),
                periods: deepClone(planToApply),
                lastEdited: Date.now(),
              }
            : p
        )
      );
      debouncedSave('practice');
    }
  };

  const handleSaveCurrentAsTemplate = (customName?: string) => {
    const activeList =
      activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData;
    const cur =
      activeList.find((p) => p && p.id === currentPracticeId) ||
      activeList.find((p) => p && p.id === findBestActivePracticeId(activeList)) ||
      activeList[0];

    const periodsToSave = cur
      ? Array.isArray(cur.plan) && cur.plan.length > 0
        ? cur.plan
        : Array.isArray(cur.periods) && cur.periods.length > 0
        ? cur.periods
        : []
      : [];

    if (!cur || periodsToSave.length === 0) {
      alert('No practice periods found in the active practice plan to save. Please add periods before saving as a template.');
      return;
    }

    const defaultName = cur.name ? `${cur.name} Template` : 'Standard Practice Template';
    const name =
      typeof customName === 'string' && customName.trim()
        ? customName.trim()
        : prompt('Enter a name for this practice template:', defaultName);

    if (name && name.trim()) {
      const trimmed = name.trim();
      const next = {
        ...practiceTemplates,
        [trimmed]: deepClone(periodsToSave),
      };
      setPracticeTemplates(next);
      latestStateRef.current.practiceTemplates = next;
      safeJSONSet('footballPracticeTemplates', next);
      debouncedSave('practice');

      const { db } = getFirebaseServices();
      if (db) {
        db.collection('teamData')
          .doc('depthChartData')
          .set({ practiceTemplates: next, updatedAt: Date.now() }, { merge: true })
          .catch((err: any) => console.warn('Firestore practice template save error:', err));
      }

      alert(`Practice Template "${trimmed}" saved! You can now apply it to any practice plan.`);
    }
  };

  const handleUpdatePracticeMeta = (
    field: keyof PracticePlan,
    value: any,
    targetPlanId?: string
  ) => {
    const targetId = targetPlanId || currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const updated = { ...p, [field]: value, lastEdited: Date.now() };
          if (field === 'date' && value) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const parts = String(value).split('-');
            if (parts.length === 3) {
              const y = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10);
              const d = parseInt(parts[2], 10);
              if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                const dt = new Date(y, m - 1, d, 12, 0, 0);
                const dayOfWeek = dayNames[dt.getDay()];
                if (dayOfWeek) {
                  updated.day = dayOfWeek;
                  updated.dayFolder = dayOfWeek;
                }
              }
            }
          }
          return updated;
        }
        return p;
      }),
      false,
      targetId
    );

    // If changing start time, date, isNonPractice, or isCancelled, also update any linked schedule event
    if (field === 'startTime' || field === 'date' || field === 'isNonPractice' || field === 'isCancelled') {
      setScheduleEvents((prev) => {
        const next = prev.map((ev) => {
          if (ev.linkedPracticePlanId === targetId || (targetId && ev.id === targetId)) {
            const updatedEv = { ...ev };
            if (field === 'startTime') {
              updatedEv.time = formatTimeMinutes(parseTimeString(value));
              updatedEv.startTime = value;
            }
            if (field === 'date') {
              updatedEv.date = value;
            }
            if (field === 'isNonPractice') {
              updatedEv.isNonPractice = Boolean(value);
            }
            if (field === 'isCancelled') {
              updatedEv.isCancelled = Boolean(value);
            }
            return updatedEv;
          }
          return ev;
        });
        safeJSONSet('footballScheduleEvents', next);
        latestStateRef.current.scheduleEvents = next;
        return next;
      });
      debouncedSave('schedule');
    }
  };

  const getPlanPeriods = (p: PracticePlan): PracticePeriod[] => {
    if (Array.isArray(p.plan) && p.plan.length > 0) return p.plan;
    if (Array.isArray(p.periods) && p.periods.length > 0) return p.periods;
    if (Array.isArray(p.plan)) return p.plan;
    if (Array.isArray(p.periods)) return p.periods;
    return [];
  };

  const handleAddPeriod = () => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const defaultCat =
            cascadingDrills[0]?.name || '⚡ (Warm-up, Agility and Conditioning)';
          const currentPlan = getPlanPeriods(p);
          const newPlan = [
            ...currentPlan,
            {
              time: 15,
              category: defaultCat,
              format: 'static' as const,
              stations: [
                {
                  name: 'New Station',
                  desc: 'Drill details...',
                  coach: '',
                  focus: 'Effort & technique',
                },
              ],
            },
          ];
          return {
            ...p,
            lastEdited: Date.now(),
            plan: newPlan,
            periods: newPlan,
          };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleRemovePeriod = (pIdx: number) => {
    if (confirm('Delete this period?')) {
      const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
      updatePracticeDataAndSave((prev) =>
        prev.map((p) => {
          if (p.id === targetId) {
            const plan = [...getPlanPeriods(p)];
            if (pIdx >= 0 && pIdx < plan.length) {
              plan.splice(pIdx, 1);
            }
            return { ...p, plan, periods: plan, lastEdited: Date.now() };
          }
          return p;
        }),
        false,
        targetId
      );
    }
  };

  const handleMovePeriod = (pIdx: number, direction: number) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          const newIdx = pIdx + direction;
          if (newIdx < 0 || newIdx >= plan.length) return p;
          const [moved] = plan.splice(pIdx, 1);
          plan.splice(newIdx, 0, moved);
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleUpdatePeriodTime = (pIdx: number, time: number) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (plan[pIdx]) {
            plan[pIdx] = { ...plan[pIdx], time };
          }
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleUpdatePeriodCategory = (pIdx: number, category: string) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (plan[pIdx]) {
            plan[pIdx] = { ...plan[pIdx], category };
          }
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleUpdatePeriodFormat = (
    pIdx: number,
    format: 'static' | 'rotating'
  ) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (plan[pIdx]) {
            plan[pIdx] = { ...plan[pIdx], format };
          }
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleAddStationToPeriod = (pIdx: number) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (plan[pIdx]) {
            const currentStations = Array.isArray(plan[pIdx].stations) ? plan[pIdx].stations : [];
            plan[pIdx] = {
              ...plan[pIdx],
              stations: [
                ...currentStations,
                {
                  name: 'New Station',
                  desc: 'Drill details...',
                  coach: '',
                  focus: 'Execution',
                },
              ],
            };
          }
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleRemoveStationFromPeriod = (pIdx: number, sIdx: number) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (!plan[pIdx]) return p;
          const currentStations = Array.isArray(plan[pIdx].stations) ? plan[pIdx].stations : [];
          if (currentStations.length <= 1) {
            // Reset the single station to empty
            const stations = [
              {
                name: '',
                desc: '',
                coach: '',
                focus: '',
              },
            ];
            plan[pIdx] = { ...plan[pIdx], stations };
            return { ...p, plan, periods: plan, lastEdited: Date.now() };
          }
          const stations = [...currentStations];
          stations.splice(sIdx, 1);
          plan[pIdx] = { ...plan[pIdx], stations };
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
    flushAndSaveStateToStorage('remove_station');
  };

  const handleUpdateStation = (
    pIdx: number,
    sIdx: number,
    field: keyof PracticeStation,
    value: string
  ) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (!plan[pIdx]) return p;
          const stations = Array.isArray(plan[pIdx].stations) ? [...plan[pIdx].stations] : [{ name: '', desc: '', coach: '', focus: '' }];
          if (stations[sIdx]) {
            stations[sIdx] = { ...stations[sIdx], [field]: value };
          } else {
            stations[sIdx] = { name: '', desc: '', coach: '', focus: '', [field]: value };
          }
          plan[pIdx] = { ...plan[pIdx], stations };
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleSelectDrillForStation = (
    pIdx: number,
    sIdx: number,
    drill: DrillItem
  ) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (!plan[pIdx]) return p;
          const stations = Array.isArray(plan[pIdx].stations) ? [...plan[pIdx].stations] : [{ name: '', desc: '', coach: '', focus: '' }];
          stations[sIdx] = {
            ...(stations[sIdx] || { coach: '' }),
            name: drill.name,
            desc: drill.desc,
            focus: drill.key,
          };
          plan[pIdx] = { ...plan[pIdx], stations };
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  /* =========================================================================
     DRILL LIBRARY RECURSIVE ACTIONS
     ========================================================================= */
  const findFolderByPath = (
    list: DrillFolder[],
    pathKey: string
  ): DrillFolder | null => {
    for (let i = 0; i < list.length; i++) {
      const cur = String(i);
      if (cur === pathKey) return list[i];
      if (pathKey.startsWith(`${cur}_`)) {
        const sub = pathKey.substring(cur.length + 1);
        if (list[i].subfolders) {
          const found = findFolderByPath(list[i].subfolders, sub);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const updateCascadingDrillsAndSave = (
    updater: (prev: DrillFolder[]) => DrillFolder[]
  ) => {
    setCascadingDrills((prev) => {
      const updated = updater(prev);
      latestStateRef.current.cascadingDrills = updated;
      safeJSONSet('footballCascadingDrills', updated);
      lastLocalEditTimeRef.current = Date.now();
      return updated;
    });
    debouncedSave('drills');
  };

  const handleAddTopDrillFolder = () => {
    const name = prompt('Enter new Top-Level Folder Name (e.g. Special Teams):');
    if (name && name.trim()) {
      updateCascadingDrillsAndSave((prev) => [
        ...prev,
        { name: name.trim(), subfolders: [], drills: [] },
      ]);
    }
  };

  const handleAddSubfolder = (pathKey: string) => {
    const name = prompt('Enter Subfolder Name:');
    if (name && name.trim()) {
      updateCascadingDrillsAndSave((prev) => {
        const updated = deepClone(prev);
        const target = findFolderByPath(updated, pathKey);
        if (target) {
          if (!target.subfolders) target.subfolders = [];
          target.subfolders.push({
            name: name.trim(),
            subfolders: [],
            drills: [],
          });
        }
        return updated;
      });
    }
  };

  const handleAddDrill = (pathKey: string) => {
    const newDrillId = `drill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      const target = findFolderByPath(updated, pathKey);
      if (target) {
        if (!target.drills) target.drills = [];
        target.drills.push({
          id: newDrillId,
          name: 'New Drill',
          desc: '',
          key: '',
        });
      }
      return updated;
    });
  };

  const handleRenameDrillFolder = (pathKey: string) => {
    const target = findFolderByPath(cascadingDrills, pathKey);
    if (target) {
      const newName = prompt('Rename Folder:', target.name);
      if (newName && newName.trim()) {
        updateCascadingDrillsAndSave((prev) => {
          const updated = deepClone(prev);
          const t = findFolderByPath(updated, pathKey);
          if (t) {
            t.name = newName.trim();
          }
          return updated;
        });
      }
    }
  };

  const handleDeleteDrillFolder = (pathKey: string) => {
    if (!confirm('Delete this folder and all its drills?')) return;
    const parts = pathKey.split('_');
    const idx = parseInt(parts.pop()!, 10);
    const parentPath = parts.join('_');

    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      if (parentPath === '') {
        updated.splice(idx, 1);
      } else {
        const parent = findFolderByPath(updated, parentPath);
        if (parent && parent.subfolders) {
          parent.subfolders.splice(idx, 1);
        }
      }
      return updated;
    });
  };

  const handleMoveDrillFolder = (pathKey: string, direction: number) => {
    const parts = pathKey.split('_');
    const idx = parseInt(parts.pop()!, 10);
    const parentPath = parts.join('_');

    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      let list = updated;
      if (parentPath !== '') {
        const parent = findFolderByPath(updated, parentPath);
        if (parent && parent.subfolders) list = parent.subfolders;
      }

      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= list.length) return prev;
      const [moved] = list.splice(idx, 1);
      list.splice(newIdx, 0, moved);
      return updated;
    });
  };

  const handleUpdateDrill = (
    pathKey: string,
    drillIdx: number,
    field: keyof DrillItem,
    value: string
  ) => {
    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      const target = findFolderByPath(updated, pathKey);
      if (target && target.drills?.[drillIdx]) {
        target.drills[drillIdx][field] = value;
      }
      return updated;
    });
  };

  const handleDeleteDrill = (pathKey: string, drillIdx: number) => {
    if (confirm('Delete this drill?')) {
      updateCascadingDrillsAndSave((prev) => {
        const updated = deepClone(prev);
        const target = findFolderByPath(updated, pathKey);
        if (target && target.drills) {
          target.drills.splice(drillIdx, 1);
        }
        return updated;
      });
    }
  };

  const handleMoveDrillToFolder = (
    sourcePath: string,
    drillIdx: number,
    targetPath: string
  ) => {
    if (sourcePath === targetPath) return;
    updateCascadingDrillsAndSave((prev) => {
      const updated = deepClone(prev);
      const source = findFolderByPath(updated, sourcePath);
      const target = findFolderByPath(updated, targetPath);

      if (source && target && source.drills?.[drillIdx]) {
        const [movedDrill] = source.drills.splice(drillIdx, 1);
        if (!target.drills) target.drills = [];
        target.drills.push(movedDrill);
      }
      return updated;
    });
  };

  // CSV & JSON Drill Import / Export
  const handleExportDrillsCSV = () => {
    const rows: string[][] = [
      ['Top Folder', 'Subfolder', 'Drill Name', 'Setup & Instructions', 'Coaching Focus'],
    ];

    const traverse = (
      folders: DrillFolder[],
      topName = '',
      subName = ''
    ) => {
      folders.forEach((f) => {
        const curTop = topName || f.name;
        const curSub = topName ? (subName ? `${subName} > ${f.name}` : f.name) : '';
        (f.drills || []).forEach((d) => {
          rows.push([curTop, curSub, d.name || '', d.desc || '', d.key || '']);
        });
        if (f.subfolders?.length) {
          traverse(f.subfolders, curTop, curSub);
        }
      });
    };

    traverse(cascadingDrills);
    const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drills_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleImportDrillsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsedRows = parseCSV(evt.target?.result as string);
        if (parsedRows.length < 2) {
          alert('CSV file empty or invalid.');
          return;
        }

        const newTree: DrillFolder[] = [];
        const getOrCreate = (tree: DrillFolder[], name: string) => {
          let found = tree.find(
            (item) => item.name.toLowerCase() === name.toLowerCase()
          );
          if (!found) {
            found = { name, subfolders: [], drills: [] };
            tree.push(found);
          }
          return found;
        };

        const startIdx = parsedRows[0][0]?.toLowerCase().includes('folder') ? 1 : 0;
        for (let i = startIdx; i < parsedRows.length; i++) {
          const r = parsedRows[i];
          if (!r || r.length < 3) continue;
          const topFolderName = (r[0] || 'General').trim() || 'General';
          const subfolderName = (r[1] || '').trim();
          const drillName = (r[2] || '').trim();
          const drillDesc = (r[3] || '').trim();
          const drillKey = (r[4] || '').trim();
          if (!drillName) continue;

          const topFolder = getOrCreate(newTree, topFolderName);
          let targetFolder = topFolder;
          if (subfolderName) {
            const subParts = subfolderName.split('>').map((s) => s.trim()).filter(Boolean);
            let curParent = topFolder;
            subParts.forEach((sp) => {
              curParent = getOrCreate(curParent.subfolders, sp);
            });
            targetFolder = curParent;
          }
          if (!targetFolder.drills) targetFolder.drills = [];
          targetFolder.drills.push({
            id: `drill_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
            name: drillName,
            desc: drillDesc,
            key: drillKey,
          });
        }

        if (newTree.length > 0) {
          updateCascadingDrillsAndSave(() => newTree);
          alert('Drills CSV imported successfully!');
        }
      } catch (err: any) {
        alert(`Error importing CSV: ${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportDrillsJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(safeJSONStringify(cascadingDrills, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `drills_folders_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleImportDrillsJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed)) {
          const normalized = normalizeCascadingDrills(parsed);
          updateCascadingDrillsAndSave(() => normalized);
          alert('Drills JSON imported successfully!');
        }
      } catch (err: any) {
        alert(`Error parsing JSON: ${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  /* =========================================================================
     PLAYBOOKS & GUIDES ACTIONS
     ========================================================================= */
  const handleSaveGuideHtml = (main: string, sub: string, htmlContent: string) => {
    setGuideTree((prev) => {
      const next = {
        ...prev,
        [main]: {
          ...(prev[main] || {}),
          [sub]: htmlContent,
        },
      };
      latestStateRef.current.guideTree = next;
      safeJSONSet('footballPdfGuidesTree', next);
      return next;
    });
    flushAndSaveStateToStorage('guide_html_update');
  };

  const handleClearGuideDocument = (main: string, sub: string) => {
    setGuideTree((prev) => {
      const next = {
        ...prev,
        [main]: {
          ...(prev[main] || {}),
          [sub]: '',
        },
      };
      latestStateRef.current.guideTree = next;
      safeJSONSet('footballPdfGuidesTree', next);
      return next;
    });
    flushAndSaveStateToStorage('guide_clear');
  };

  const handleUploadGuideDocument = (
    main: string,
    sub: string,
    file: File
  ) => {
    const isHtmlFile =
      file.name.toLowerCase().endsWith('.html') ||
      file.name.toLowerCase().endsWith('.htm') ||
      file.type === 'text/html';

    if (isHtmlFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = (e.target?.result as string) || '';
        handleSaveGuideHtml(main, sub, content);
      };
      reader.readAsText(file);
      return;
    }

    const { storage } = getFirebaseServices();
    if (storage) {
      const storageRef = storage.ref(`playbook_guides/${Date.now()}_${file.name}`);
      storageRef
        .put(file)
        .then((snapshot: any) => snapshot.ref.getDownloadURL())
        .then((downloadUrl: string) => {
          setGuideTree((prev) => {
            const next = {
              ...prev,
              [main]: {
                ...(prev[main] || {}),
                [sub]: downloadUrl,
              },
            };
            latestStateRef.current.guideTree = next;
            safeJSONSet('footballPdfGuidesTree', next);
            return next;
          });
          flushAndSaveStateToStorage('guide_upload');
        })
        .catch((err: any) => {
          console.warn('Storage upload error, falling back to local data URL:', err);
          const localUrl = URL.createObjectURL(file);
          setGuideTree((prev) => {
            const next = {
              ...prev,
              [main]: {
                ...(prev[main] || {}),
                [sub]: localUrl,
              },
            };
            latestStateRef.current.guideTree = next;
            safeJSONSet('footballPdfGuidesTree', next);
            return next;
          });
          flushAndSaveStateToStorage('guide_upload_local');
        });
    } else {
      const localUrl = URL.createObjectURL(file);
      setGuideTree((prev) => {
        const next = {
          ...prev,
          [main]: {
            ...(prev[main] || {}),
            [sub]: localUrl,
          },
        };
        latestStateRef.current.guideTree = next;
        safeJSONSet('footballPdfGuidesTree', next);
        return next;
      });
      flushAndSaveStateToStorage('guide_upload_local');
    }
  };

  /* =========================================================================
     BACKUP & IMPORT FULL APPLICATION STATE
     ========================================================================= */
  const handleExportFullBackup = () => {
    try {
      const activeWb =
        latestStateRef.current.wristbandData ||
        safeJSONParse<WristbandData | null>('footballWristbandData', null) ||
        currentWeekState.wristbandData ||
        INITIAL_TWO_WRISTBANDS_DATA;

      const fullBackup = {
        weeklyData,
        defaultFormations,
        practiceData,
        practiceTemplates,
        cascadingDrills,
        guideTree,
        guideOrder,
        savedCoaches,
        teamSavedCoaches,
        staffList,
        masterPlayLibrary,
        playDatabase: latestStateRef.current.playDatabase || playDatabase,
        callSheetData: latestStateRef.current.callSheetData || callSheetData,
        wristbandData: activeWb,
        deletedPlayIds: latestStateRef.current.deletedPlayIds || deletedPlayIds,
        collapsedFolders,
        scheduleEvents,
        roster,
        teams,
        seasonConfig,
        attendanceLogs,
        exportedAt: new Date().toISOString(),
      };
      const jsonStr = safeJSONStringify(fullBackup, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `football_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err: any) {
      console.error('Backup export failed:', err);
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const applyImportDataObject = (
    parsed: any,
    selectedOptions?: Record<string, boolean>
  ) => {
    try {
      isImportingRef.current = true;
      const shouldImport = (key: string) => {
        if (!selectedOptions) return true;
        return Boolean(selectedOptions[key]);
      };

      const restoredList: string[] = [];

      const importedWeekly = shouldImport('weeklyData')
        ? parsed.weeklyData || (parsed['0'] && parsed['0'].depthChart ? parsed : null)
        : null;
      const extractedBackupForms = extractBackupFormations(parsed);
      const importedDefaults = shouldImport('defaultFormations')
        ? extractedBackupForms || parsed.defaultFormations || null
        : null;
      const importedPractice = shouldImport('practiceData')
        ? parsed.practiceData || null
        : null;
      const importedTemplates = shouldImport('practiceTemplates')
        ? parsed.practiceTemplates || null
        : null;
      const importedDrills = shouldImport('cascadingDrills')
        ? parsed.cascadingDrills || null
        : null;
      const importedGuideTree = shouldImport('guideTree')
        ? parsed.guideTree || parsed.pdfGuidesTree || null
        : null;
      const importedGuideOrder = shouldImport('guideTree')
        ? parsed.guideOrder || parsed.pdfGuidesOrder || null
        : null;
      const importedSavedCoaches = shouldImport('staffList')
        ? parsed.savedCoaches || parsed.savedCoachesList || null
        : null;
      const importedTeamSavedCoaches = shouldImport('staffList')
        ? parsed.teamSavedCoaches || null
        : null;
      const importedStaffList = shouldImport('staffList')
        ? parsed.staffList || parsed.teamCoachesList || null
        : null;
      const importedPlays = shouldImport('masterPlayLibrary')
        ? parsed.masterPlayLibrary || null
        : null;
      const importedPlayDb = shouldImport('playDatabase')
        ? parsed.playDatabase || null
        : null;
      const importedCallSheet = shouldImport('callSheetData')
        ? parsed.callSheetData || parsed.callSheet || null
        : null;
      const importedWristband = shouldImport('wristbandData')
        ? parsed.wristbandData || parsed.wristband || null
        : null;
      const importedDeletedPlays = parsed.deletedPlayIds || null;
      const importedCollapsed = shouldImport('cascadingDrills')
        ? parsed.collapsedFolders || {}
        : null;
      const importedSchedule = shouldImport('scheduleEvents')
        ? parsed.scheduleEvents || null
        : null;
      const importedRoster = shouldImport('roster') ? parsed.roster || null : null;
      const importedTeams = shouldImport('roster') ? parsed.teams || null : null;
      const importedSeasonConfig = shouldImport('scheduleEvents') ? parsed.seasonConfig || null : null;
      const importedAttendance = shouldImport('scheduleEvents') ? parsed.attendanceLogs || null : null;

      // Un-delete formations and ensure no formations are suppressed by stale deletedFormationIds
      const restoredFormationIds = new Set<string>();
      if (importedDefaults && Array.isArray(importedDefaults)) {
        importedDefaults.forEach((f: any) => { if (f?.id) restoredFormationIds.add(f.id); });
      }
      if (importedWeekly && typeof importedWeekly === 'object') {
        Object.values(importedWeekly).forEach((wk: any) => {
          if (wk && Array.isArray(wk.formations)) {
            wk.formations.forEach((f: any) => { if (f?.id) restoredFormationIds.add(f.id); });
          }
        });
      }
      if (importedDefaults || restoredFormationIds.size > 0) {
        const nextDeleted = (deletedFormationIds || []).filter((id) => !restoredFormationIds.has(id));
        setDeletedFormationIds(nextDeleted);
        latestStateRef.current.deletedFormationIds = nextDeleted;
        safeJSONSet('footballDeletedFormationIds', nextDeleted);
      }

      // Restoring formations and weekly data
      if (importedDefaults && Array.isArray(importedDefaults) && importedDefaults.length > 0) {
        setDefaultFormations(importedDefaults);
        latestStateRef.current.defaultFormations = importedDefaults;
        safeJSONSet('footballDefaultFormations', importedDefaults);
        restoredList.push('📐 Formations & Alignments');

        // Merge restored formations across all weeks so active and subsequent weeks immediately have them
        const baseWData: Record<string, WeekState> =
          importedWeekly || latestStateRef.current.weeklyData || weeklyData || {};
        const updatedWData: Record<string, WeekState> = {};
        for (const [wKey, rawState] of Object.entries(baseWData)) {
          if (!rawState || typeof rawState !== 'object') continue;
          const wState = rawState as WeekState;
          const forms = Array.isArray(wState.formations) ? [...wState.formations] : [];
          const seenIds = new Set(forms.map((f: any) => f.id));
          const seenKeys = new Set(forms.map((f: any) => `${f.unit}__${(f.name || '').toLowerCase().trim()}`));
          for (const f of importedDefaults) {
            const key = `${f.unit}__${(f.name || '').toLowerCase().trim()}`;
            if (!seenIds.has(f.id) && !seenKeys.has(key)) {
              forms.push(deepClone(f));
              seenIds.add(f.id);
              seenKeys.add(key);
            }
          }
          updatedWData[wKey] = {
            ...wState,
            formations: forms,
          };
        }
        setWeeklyData(updatedWData);
        latestStateRef.current.weeklyData = updatedWData;
        safeJSONSet('footballWeeklyData', updatedWData);
      } else if (importedWeekly) {
        setWeeklyData(importedWeekly);
        latestStateRef.current.weeklyData = importedWeekly;
        safeJSONSet('footballWeeklyData', importedWeekly);
        restoredList.push('🏈 Game Plans & Depth Charts');
      }
      if (importedPractice) {
        const sanitized = sanitizePracticePlans(
          importedPractice,
          importedSchedule || scheduleEvents
        );
        setPracticeData(sanitized);
        safeJSONSet('footballPracticeData', sanitized);
        restoredList.push('📋 Practice Plans');
      }
      if (importedTemplates) {
        const normalized = normalizePracticeTemplates(importedTemplates);
        setPracticeTemplates(normalized);
        safeJSONSet('footballPracticeTemplates', normalized);
        restoredList.push('⚡ Practice Templates');
      }
      if (importedDrills) {
        const normalizedDrills = normalizeCascadingDrills(importedDrills);
        setCascadingDrills(normalizedDrills);
        safeJSONSet('footballCascadingDrills', normalizedDrills);
        restoredList.push('💥 Drill Library');
      }
      if (importedGuideTree) {
        setGuideTree(importedGuideTree);
        safeJSONSet('footballPdfGuidesTree', importedGuideTree);
        restoredList.push('📖 Playbook Guides');
      }
      if (importedGuideOrder) {
        setGuideOrder(importedGuideOrder);
        safeJSONSet('footballPdfGuidesOrder', importedGuideOrder);
      }
      if (importedSavedCoaches) {
        setSavedCoaches(importedSavedCoaches);
        safeJSONSet('footballSavedCoaches', importedSavedCoaches);
        restoredList.push('🧢 Coaching Directory');
      }
      if (importedTeamSavedCoaches) {
        setTeamSavedCoaches(importedTeamSavedCoaches);
        safeJSONSet('footballTeamSavedCoaches', importedTeamSavedCoaches);
      }
      if (importedStaffList) {
        setStaffList(importedStaffList);
        safeJSONSet('footballTeamCoaches', importedStaffList);
      }
      if (importedPlays) {
        setMasterPlayLibrary(importedPlays);
        safeJSONSet('footballMasterPlays', importedPlays);
        restoredList.push('🎯 Play Library');
      }
      if (importedPlayDb && Array.isArray(importedPlayDb)) {
        setPlayDatabase(importedPlayDb);
        latestStateRef.current.playDatabase = importedPlayDb;
        safeJSONSet('footballPlayDatabase', importedPlayDb);
        restoredList.push('📚 Play Database');
      }
      if (importedCallSheet && (importedCallSheet.offenseSections || importedCallSheet.defenseSections)) {
        setCallSheetData(importedCallSheet);
        latestStateRef.current.callSheetData = importedCallSheet;
        safeJSONSet('footballCallSheetData', importedCallSheet);
        restoredList.push('📑 Call Sheet');
      }
      if (importedWristband && Array.isArray(importedWristband.wristbands) && importedWristband.wristbands.length > 0) {
        const normWb = normalizeWristbandContinuousNumbering(importedWristband);
        setWristbandData(normWb);
        latestStateRef.current.wristbandData = normWb;
        safeJSONSet('footballWristbandData', normWb);

        const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
        setWeeklyData((prev) => {
          const wk = prev[scopedKey] || prev[currentWeek] || {};
          const next = {
            ...prev,
            [scopedKey]: { ...wk, wristbandData: normWb },
            [currentWeek]: { ...wk, wristbandData: normWb },
          };
          latestStateRef.current.weeklyData = next;
          safeJSONSet('footballWeeklyData', next);
          return next;
        });
        restoredList.push('🔤 Wristbands');
      }
      if (importedDeletedPlays && Array.isArray(importedDeletedPlays)) {
        setDeletedPlayIds(importedDeletedPlays);
        latestStateRef.current.deletedPlayIds = importedDeletedPlays;
        safeJSONSet('footballDeletedPlayIds', importedDeletedPlays);
      }
      if (importedCollapsed) {
        setCollapsedFolders(importedCollapsed);
        safeJSONSet('footballCollapsedFolders', importedCollapsed);
      }
      if (importedSchedule) {
        setScheduleEvents(importedSchedule);
        safeJSONSet('footballScheduleEvents', importedSchedule);
        restoredList.push('📅 Season Calendar');
      }
      if (importedRoster) {
        setRoster(importedRoster);
        safeJSONSet('footballRoster', importedRoster);
        restoredList.push('👥 Team Roster');
      }
      if (importedTeams) {
        setTeams(importedTeams);
        safeJSONSet('footballTeams', importedTeams);
      }
      if (importedSeasonConfig) {
        setSeasonConfig(importedSeasonConfig);
        safeJSONSet('footballSeasonConfig', importedSeasonConfig);
      }
      if (importedAttendance) {
        setAttendanceLogs(importedAttendance);
        safeJSONSet('footballAttendanceLogs', importedAttendance);
      }

      // Direct synchronous push to Cloud Firestore keeping unselected fields intact
      const { db } = getFirebaseServices();
      if (db) {
        setSyncStatus({ text: '☁️ Uploading Restored Data to Cloud...', color: '#f59e0b' });
        const payload = deepClone({
          weeklyData: importedWeekly || weeklyData,
          defaultFormations: importedDefaults || defaultFormations,
          practiceData: importedPractice || practiceData,
          practiceTemplates: importedTemplates || practiceTemplates,
          cascadingDrills: importedDrills
            ? normalizeCascadingDrills(importedDrills)
            : cascadingDrills,
          guideTree: importedGuideTree || guideTree,
          guideOrder: importedGuideOrder || guideOrder,
          savedCoaches: importedSavedCoaches || savedCoaches,
          staffList: importedStaffList || staffList,
          masterPlayLibrary: importedPlays || masterPlayLibrary,
          playDatabase: importedPlayDb || playDatabase,
          callSheetData: importedCallSheet || callSheetData,
          wristbandData: importedWristband || wristbandData,
          deletedPlayIds: importedDeletedPlays || deletedPlayIds,
          roster: importedRoster || roster,
          teams: importedTeams || teams,
          seasonConfig: importedSeasonConfig || seasonConfig,
          attendanceLogs: importedAttendance || attendanceLogs,
          collapsedFolders: importedCollapsed || collapsedFolders,
          scheduleEvents: importedSchedule || scheduleEvents,
        });

        db.collection('teamData')
          .doc('depthChartData')
          .set(
            {
              ...payload,
              updatedAt:
                window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date(),
            },
            { merge: true }
          )
          .then(() => {
            setSyncStatus({ text: '✅ Live Cloud Synced', color: '#22c55e' });
            setTimeout(() => {
              isImportingRef.current = false;
            }, 3000);
          })
          .catch((err: any) => {
            console.warn('Direct cloud sync error:', err);
            setTimeout(() => {
              isImportingRef.current = false;
            }, 3000);
          });
      } else {
        setTimeout(() => {
          isImportingRef.current = false;
        }, 3000);
      }

      const summary =
        restoredList.length > 0 ? restoredList.join(', ') : 'Selected modules';
      alert(`Successfully restored: ${summary}\nAll changes saved and synchronized!`);
    } catch (err: any) {
      isImportingRef.current = false;
      alert(`Error importing backup: ${err.message}`);
    }
  };

  const handleImportFullBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        applyImportDataObject(parsed);
      } catch (err: any) {
        alert(`Error parsing JSON file: ${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handlePasteImport = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      applyImportDataObject(parsed);
    } catch (err: any) {
      alert(`Error parsing pasted JSON: ${err.message}`);
    }
  };

  const handleResetData = () => {
    if (confirm('Wipe all local team data and reset to default playbook?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // 1-Click Copy Week Execution
  const handleExecuteCopyWeek = (
    srcWeek: string,
    targetWeek: string,
    copyModeOrPlayerSpots: 'both' | 'formations_only' | 'positions_only' | boolean = 'both',
    srcTeamIdParam?: string,
    showAlert: boolean = true
  ) => {
    const srcTeamId = srcTeamIdParam || activeTeamId;
    ensureWeekExists(srcWeek);
    ensureWeekExists(targetWeek);

    // Combine current working weekly data with latest ref state for richest resolution
    const currentAllWeekly = { ...weeklyData, ...latestStateRef.current.weeklyData };
    const src = resolveWeekState(currentAllWeekly, srcTeamId, srcWeek);
    const targetExisting = resolveWeekState(currentAllWeekly, activeTeamId, targetWeek);

    const copied = copyWeekCharts({
      src,
      targetExisting,
      defaultFormations,
      mode: copyModeOrPlayerSpots,
    });
    const mode = copied.mode;
    const updatedFormations = copied.formations;
    const updatedDepthChart = copied.depthChart;
    const updatedScrimmageChart = copied.scrimmageChart;

    const nextDeletedIds = applyCopiedFormationsToDeletedIds(
      deletedFormationIds,
      updatedFormations,
      mode
    );
    if (mode === 'both' || mode === 'formations_only') {
      setDeletedFormationIds(nextDeletedIds);
      latestStateRef.current.deletedFormationIds = nextDeletedIds;
      safeJSONSet('footballDeletedFormationIds', nextDeletedIds);
    }

    const updatedState: WeekState = {
      ...targetExisting,
      formations: updatedFormations,
      depthChart: updatedDepthChart,
      scrimmageChart: updatedScrimmageChart,
      pprPlayCounts:
        mode === 'both' ? src.pprPlayCounts || {} : targetExisting.pprPlayCounts,
      pffReviews: mode === 'both' ? src.pffReviews || {} : targetExisting.pffReviews,
      filmSession: mode === 'both' ? src.filmSession : targetExisting.filmSession,
    };

    const targetScopedKey = getScopedWeekKey(activeTeamId, targetWeek);

    // Synchronously update local edit timestamp and latest state ref with 15s protection window
    lastLocalEditTimeRef.current = Date.now();
    currentWeekRef.current = targetWeek;

    const nextWeekly: Record<string, WeekState> = {
      ...latestStateRef.current.weeklyData,
      ...weeklyData,
      [targetScopedKey]: updatedState,
      [targetWeek]: updatedState,
    };

    latestStateRef.current.weeklyData = nextWeekly;
    safeJSONSet('footballWeeklyData', nextWeekly);

    // Update React state
    setWeeklyData(nextWeekly);
    changeCurrentWeek(targetWeek);

    // Save and sync immediately to local and cloud with authoritative copy_week scope
    saveStateToStorage('copy_week');

    const srcLabel = srcWeek === '0' ? 'Preseason / Week 0' : srcWeek === 'playoffs' ? 'Playoffs' : `Week ${srcWeek}`;
    const targetLabel = targetWeek === '0' ? 'Preseason / Week 0' : targetWeek === 'playoffs' ? 'Playoffs' : `Week ${targetWeek}`;
    const copiedCount = countPlacedPlayers(updatedDepthChart);

    setSyncStatus({
      text: `✅ Copied ${srcLabel} → ${targetLabel} (${copiedCount} players)`,
      color: '#22c55e',
    });

    if (showAlert) {
      setTimeout(() => {
        alert(
          `Successfully copied ${
            mode === 'both'
              ? `all formations and player depth spots (${copiedCount} player placements)`
              : mode === 'formations_only'
              ? 'formations only'
              : `player depth spots (${copiedCount} player placements)`
          } from ${srcLabel} to ${targetLabel}!`
        );
      }, 60);
    }
  };

  /* =========================================================================
     SEASON SCHEDULE & WORKFLOW SYNC HANDLERS
     ========================================================================= */
  const handleSyncGameToWeeklyData = (
    eventOrWeek: ScheduleEvent | string,
    opponentName?: string,
    dateStr?: string,
    timeStr?: string,
    locationStr?: string
  ) => {
    let weekKey = '1';
    let oppName = '';
    let gameDateTime = '';
    let location = 'Mahopac High School';

    if (typeof eventOrWeek === 'object') {
      weekKey = eventOrWeek.week || '1';
      oppName = eventOrWeek.opponent || eventOrWeek.title;
      gameDateTime = `${eventOrWeek.date} @ ${eventOrWeek.startTime || '10:00 AM'}`;
      location = eventOrWeek.location || 'Mahopac High School';
    } else {
      weekKey = eventOrWeek || '1';
      oppName = opponentName || '';
      gameDateTime = `${dateStr || ''} @ ${timeStr || '10:00 AM'}`.trim();
      location = locationStr || 'Mahopac High School';
    }

    ensureWeekExists(weekKey);

    setWeeklyData((prev) => {
      const scopedKey = getScopedWeekKey(activeTeamId, weekKey);
      const existingWeek = prev[scopedKey] || prev[weekKey] || {
        formations: deepClone(defaultFormations),
        depthChart: {},
        scrimmageChart: {},
        opponent: oppName,
        scouting: {
          year: '2026',
          week: `Week ${weekKey}`,
          opponent: oppName,
          gameDate: gameDateTime,
          gameLocation: location,
          teamOverview: '',
          offensiveTendencies: '',
          defensiveFronts: '',
          specialTeamsNotes: '',
          keysToVictory: [],
          keyPlayersList: [],
          coachNotes: [],
        },
      };

      const updatedWeekState = {
        ...existingWeek,
        opponent: oppName,
        scouting: {
          ...(existingWeek.scouting || {}),
          opponent: oppName,
          gameDate: gameDateTime,
          gameLocation: location,
          week: `Week ${weekKey}`,
          year: '2026',
        },
      };

      return {
        ...prev,
        [scopedKey]: updatedWeekState,
        [weekKey]: updatedWeekState,
      };
    });
  };

  const handleSyncPracticeToPlan = (event: ScheduleEvent, templateName?: string): string => {
    // 1. Calculate Day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let dayOfWeek = event.dayOfWeek;
    if (!dayOfWeek && event.date) {
      const parts = event.date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const dt = new Date(y, m - 1, d, 12, 0, 0);
          dayOfWeek = dayNames[dt.getDay()];
        }
      }
    }
    if (!dayOfWeek) dayOfWeek = 'Wednesday';

    // 2. Calculate Week Folder
    const rawWeek = String(event.week !== undefined ? event.week : '1').trim();
    let weekFolder = `Week ${rawWeek}`;
    if (rawWeek === '0' || rawWeek.toLowerCase().includes('pre-1') || rawWeek.toLowerCase().includes('pre1')) {
      weekFolder = 'Preseason Wk 1';
    } else if (rawWeek.toLowerCase().includes('pre-2') || rawWeek.toLowerCase().includes('pre2')) {
      weekFolder = 'Preseason Wk 2';
    } else if (rawWeek.toLowerCase().startsWith('week')) {
      weekFolder = rawWeek;
    } else if (rawWeek.toLowerCase().includes('pre')) {
      weekFolder = 'Preseason Wk 1';
    } else {
      weekFolder = `Week ${rawWeek}`;
    }

    // 3. Year, Time, Location & Title
    const isGame = event.type === 'game' || event.type === 'tournament' || event.type === 'scrimmage';
    const year = event.date && event.date.includes('-') ? event.date.split('-')[0] : '2026';
    
    // For games, default the warmup window based on arrivalMinutesBefore (e.g. 60-90m prior to kickoff)
    let startTime = event.startTime || event.time || '17:30';
    let endTime = event.endTime || '19:00';
    if (isGame && event.startTime) {
      const arrivalMins = event.arrivalMinutesBefore || 60;
      const [hStr, mStr] = event.startTime.split(':');
      const kickoffTotalMins = parseInt(hStr || '12', 10) * 60 + parseInt(mStr || '00', 10);
      const warmupStartMins = Math.max(0, kickoffTotalMins - arrivalMins);
      const warmupEndMins = Math.max(warmupStartMins + 30, kickoffTotalMins - 15);
      
      const formatMins = (mins: number) => {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };
      startTime = formatMins(warmupStartMins);
      endTime = formatMins(warmupEndMins);
    }

    const location = event.location || 'Crane Road';
    const title = isGame
      ? (event.title.toLowerCase().includes('pre-game') || event.title.toLowerCase().includes('warmup')
          ? event.title
          : `Pre-Game Warmup: ${event.title}`)
      : (event.title || `${weekFolder} Practice`);

    // 4. Find existing practice plan
    const targetPlanId = event.preGamePlanId || event.linkedPracticePlanId;
    let existing = targetPlanId
      ? practiceData.find((p) => p && p.id === targetPlanId)
      : undefined;

    if (!existing && event.date) {
      existing = practiceData.find(
        (p) =>
          p &&
          p.date === event.date &&
          (isGame
            ? p.title?.toLowerCase().includes('pre-game') ||
              p.title?.toLowerCase().includes('warmup') ||
              p.id === targetPlanId
            : true)
      );
    }

    if (!existing) {
      existing = practiceData.find(
        (p) =>
          p &&
          (p.id === event.id ||
            (p.title &&
              event.title &&
              p.title.trim().toLowerCase() === event.title.trim().toLowerCase() &&
              (p.weekFolder === weekFolder || p.weekFolder === `Week ${event.week}`)))
      );
    }

    // Fallback: check DEFAULT_INITIAL_PRACTICES if not yet in state
    if (!existing && event.date) {
      const defaultInitial = DEFAULT_INITIAL_PRACTICES.find(
        (p) => p.date === event.date || p.id === event.linkedPracticePlanId || p.id === event.id
      );
      if (defaultInitial) {
        existing = defaultInitial;
      }
    }

    const formattedDayFolder = getFormattedDayFolder(event.date);

    if (existing) {
      const existingId = existing.id;
      const existingPlan = existing;
      updatePracticeDataAndSave((prev) => {
        const alreadyInList = prev.some((p) => p.id === existingId);
        if (alreadyInList) {
          return prev.map((p) =>
            p.id === existingId
              ? {
                  ...p,
                  teamId: p.teamId || event.teamId || activeTeamId || 'team_10u',
                  title: p.title || title,
                  date: event.date || p.date,
                  day: dayOfWeek,
                  dayFolder: p.dayFolder || formattedDayFolder,
                  startTime: startTime,
                  endTime: endTime,
                  weekFolder: weekFolder,
                  year: year,
                  location: location,
                  lastEdited: Date.now(),
                }
              : p
          );
        } else {
          const rawPeriods = Array.isArray(existingPlan.plan) && existingPlan.plan.length > 0
            ? existingPlan.plan
            : Array.isArray(existingPlan.periods) && existingPlan.periods.length > 0
            ? existingPlan.periods
            : [];
          return [
            ...prev,
            {
              ...existingPlan,
              teamId: existingPlan.teamId || event.teamId || activeTeamId || 'team_10u',
              date: event.date || existingPlan.date,
              day: dayOfWeek,
              dayFolder: existingPlan.dayFolder || formattedDayFolder,
              weekFolder: weekFolder,
              year: year,
              plan: rawPeriods,
              periods: rawPeriods,
              lastEdited: Date.now(),
            },
          ];
        }
      });

      if (event.linkedPracticePlanId !== existingId) {
        setScheduleEvents((prev) => {
          const next = prev.map((ev) =>
            ev.id === event.id
              ? {
                  ...ev,
                  linkedPracticePlanId: existingId,
                  preGamePlanId: isGame ? existingId : ev.preGamePlanId,
                }
              : ev
          );
          safeJSONSet('footballScheduleEvents', next);
          latestStateRef.current.scheduleEvents = next;
          return next;
        });
      }

      setCurrentPracticeId(existingId);
      return existingId;
    }

    // 5. Create new plan auto-populated with date, time, week folder, and day
    const newPracticeId = 'prac_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const defaultTemplateKey = isGame ? 'Pre-Game Warmup & Routine' : 'Standard Practice';
    const planTemplate =
      templateName && DEFAULT_PRACTICE_TEMPLATES[templateName]
        ? DEFAULT_PRACTICE_TEMPLATES[templateName]
        : (DEFAULT_PRACTICE_TEMPLATES[defaultTemplateKey] || DEFAULT_PRACTICE_TEMPLATES['Standard Practice'] || []);

    const newPlan: PracticePlan = {
      id: newPracticeId,
      teamId: event.teamId || activeTeamId,
      year: year,
      weekFolder: weekFolder,
      dayFolder: dayOfWeek,
      title: title,
      date: event.date || '',
      day: dayOfWeek,
      startTime: startTime,
      endTime: endTime,
      location: location,
      lastEdited: Date.now(),
      plan: deepClone(planTemplate),
      periods: deepClone(planTemplate),
    };

    updatePracticeDataAndSave((prev) => [...prev, newPlan]);

    setScheduleEvents((prev) => {
      const next = prev.map((ev) =>
        ev.id === event.id
          ? {
              ...ev,
              linkedPracticePlanId: newPracticeId,
              preGamePlanId: isGame ? newPracticeId : ev.preGamePlanId,
            }
          : ev
      );
      safeJSONSet('footballScheduleEvents', next);
      latestStateRef.current.scheduleEvents = next;
      return next;
    });

    setCurrentPracticeId(newPracticeId);
    return newPracticeId;
  };

  const handleAddScheduleEvent = (
    eventData: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>
  ) => {
    const newId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newEvent: ScheduleEvent = {
      ...eventData,
      teamId: eventData.teamId || activeTeamId,
      id: newId,
      createdAt: Date.now(),
      lastEdited: Date.now(),
    };

    setScheduleEvents((prev) => {
      const updated = [...prev, newEvent];
      safeJSONSet('footballScheduleEvents', updated);
      return updated;
    });

    if (newEvent.type === 'game') {
      handleSyncGameToWeeklyData(newEvent);
    }
  };

  const handleUpdateScheduleEvent = (
    id: string,
    updates: Partial<ScheduleEvent>
  ) => {
    setScheduleEvents((prev) => {
      const updatedList = prev.map((ev) => {
        if (ev.id === id) {
          const updated = { ...ev, ...updates, lastEdited: Date.now() };
          if (updated.type === 'game') {
            handleSyncGameToWeeklyData(updated);
          }
          if (updates.isNonPractice !== undefined || updates.isCancelled !== undefined) {
            updatePracticeDataAndSave((prevPlans) =>
              prevPlans.map((plan) => {
                if (plan.id === updated.linkedPracticePlanId || (plan.date && plan.date === updated.date)) {
                  return {
                    ...plan,
                    ...(updates.isNonPractice !== undefined ? { isNonPractice: updates.isNonPractice } : {}),
                    ...(updates.isCancelled !== undefined ? { isCancelled: updates.isCancelled } : {}),
                    lastEdited: Date.now(),
                  };
                }
                return plan;
              })
            );
          }
          return updated;
        }
        return ev;
      });
      safeJSONSet('footballScheduleEvents', updatedList);
      return updatedList;
    });
  };

  const handleDeleteScheduleEvent = (id: string) => {
    // 1. Find event to delete
    const eventToDelete = scheduleEvents.find((ev) => ev.id === id);

    // 2. Remove from scheduleEvents
    const updatedEvents = scheduleEvents.filter((ev) => ev.id !== id);
    setScheduleEvents(updatedEvents);
    safeJSONSet('footballScheduleEvents', updatedEvents);

    // 3. Find and remove matching attendance logs
    // Check if any other practice/scrimmage still exists on this date
    const remainingPracticesOnDate = updatedEvents.filter(
      (e) => eventToDelete && e.date === eventToDelete.date && (e.type === 'practice' || e.type === 'scrimmage' || e.type === 'walkthrough')
    );

    const matchingLogs = attendanceLogs.filter((log) => {
      if (log.id === id || log.id === `att_${id}`) return true;
      if (log.scheduleEventId === id) return true;
      if (eventToDelete && log.date === eventToDelete.date) {
        if (!log.teamId || log.teamId === eventToDelete.teamId) {
          // If no other practice exists on this date, this log belonged to the deleted event
          if (remainingPracticesOnDate.length === 0) return true;
        }
      }
      return false;
    });

    if (matchingLogs.length > 0) {
      const matchingIds = new Set(matchingLogs.map((l) => l.id));
      const updatedLogs = attendanceLogs.filter((l) => !matchingIds.has(l.id));
      setAttendanceLogs(updatedLogs);
      safeJSONSet('footballAttendanceLogs', updatedLogs);

      // 4. Reverse hours credited to players from these deleted attendance logs
      setRoster((prevRoster) => {
        let changed = false;
        const newRoster = prevRoster.map((player) => {
          let pCopy = { ...player };
          matchingLogs.forEach((log) => {
            const wasPresent = log.presentPlayerNums?.includes(player.num);
            if (wasPresent && (log.hours || 0) > 0) {
              changed = true;
              const logWeek = log.week || '0';
              const curWeekly = pCopy.weeklyHours?.[logWeek] || 0;
              const newWeekly = Math.max(0, +(curWeekly - log.hours).toFixed(2));

              let newCond = pCopy.conditioningHours || 0;
              let newPadded = pCopy.paddedHours || 0;
              if (log.sessionType === 'conditioning') {
                newCond = Math.max(0, +(newCond - log.hours).toFixed(2));
              } else {
                newPadded = Math.max(0, +(newPadded - log.hours).toFixed(2));
              }

              pCopy = {
                ...pCopy,
                weeklyHours: {
                  ...pCopy.weeklyHours,
                  [logWeek]: newWeekly,
                },
                conditioningHours: newCond,
                paddedHours: newPadded,
              };
            }
          });
          return pCopy;
        });

        if (changed) {
          safeJSONSet('footballRoster', newRoster);
          return newRoster;
        }
        return prevRoster;
      });
    }

    saveStateToStorage('schedule');
  };

  const handleBulkAddScheduleEvents = (
    eventsList: Array<Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>>
  ) => {
    const created: ScheduleEvent[] = eventsList.map((e, idx) => ({
      ...e,
      teamId: e.teamId || activeTeamId,
      id: `evt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      lastEdited: Date.now(),
    }));

    setScheduleEvents((prev) => {
      const updated = [...prev, ...created];
      safeJSONSet('footballScheduleEvents', updated);
      return updated;
    });
  };

  const handleImportTeamSnapScheduleEvents = (
    newEvents: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[],
    replaceExisting?: boolean
  ) => {
    let newlyCreatedEvents: ScheduleEvent[] = [];

    setScheduleEvents((prev) => {
      let eventsToImport = newEvents;

      // When appending (not replacing), only pull in events that are not already in the database
      if (!replaceExisting) {
        eventsToImport = newEvents.filter((ne) => {
          const duplicateCheck = isEventAlreadyInSchedule(ne as any, prev, activeTeamId);
          return !duplicateCheck.isDuplicate;
        });
      }

      if (eventsToImport.length === 0 && !replaceExisting) {
        return prev;
      }

      const created: ScheduleEvent[] = eventsToImport.map((e, idx) => ({
        ...e,
        teamId: e.teamId || activeTeamId,
        id: `evt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: Date.now(),
        lastEdited: Date.now(),
      }));

      newlyCreatedEvents = created;

      let nextEvents: ScheduleEvent[];
      if (replaceExisting) {
        // Completely replace schedule for active team (accounting for team_10u / team-10u aliases)
        const isCurrentTeam = (tid?: string) =>
          !tid ||
          tid === activeTeamId ||
          (tid === 'team_10u' && (activeTeamId === 'team_10u' || activeTeamId === 'team-10u')) ||
          (tid === 'team-10u' && (activeTeamId === 'team_10u' || activeTeamId === 'team-10u'));

        nextEvents = [
          ...prev.filter((ev) => !isCurrentTeam(ev.teamId)),
          ...created,
        ];
      } else {
        nextEvents = [...prev, ...created];
      }
      safeJSONSet('footballScheduleEvents', nextEvents);
      return nextEvents;
    });

    // Auto-sync practice plans and games for imported events
    newlyCreatedEvents.forEach((evt) => {
      if (evt.type === 'practice' || !evt.type) {
        handleSyncPracticeToPlan(evt);
      } else if (evt.type === 'game') {
        handleSyncGameToWeeklyData(evt);
      }
    });

    debouncedSave('all');
  };

  const handlePracticeWizardGenerate = (result: PracticeWizardGeneratedResult) => {
    if (result.practicePlans && result.practicePlans.length > 0) {
      const taggedPlans = result.practicePlans.map((p) => ({
        ...p,
        teamId: p.teamId || activeTeamId,
        lastEdited: Date.now(),
      }));
      updatePracticeDataAndSave((prev) => [...prev, ...taggedPlans]);
      if (taggedPlans[0]?.id) {
        setCurrentPracticeId(taggedPlans[0].id);
      }
    }

    if (result.scheduleEvents && result.scheduleEvents.length > 0) {
      const created: ScheduleEvent[] = result.scheduleEvents.map((e, idx) => ({
        ...e,
        teamId: e.teamId || activeTeamId,
        id: `evt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: Date.now(),
        lastEdited: Date.now(),
      }));
      setScheduleEvents((prev) => {
        const next = [...prev, ...created];
        safeJSONSet('footballScheduleEvents', next);
        latestStateRef.current.scheduleEvents = next;
        return next;
      });
    }

    debouncedSave('all');
  };

  const handleNavigateToWeek = (
    weekFolder: string,
    unit?: UnitType,
    practiceId?: string
  ) => {
    const match = weekFolder.match(/Week\s*(\d+)/i);
    const weekKey = match ? match[1] : weekFolder.replace(/\D/g, '') || '1';

    ensureWeekExists(weekKey);
    changeCurrentWeek(weekKey);

    if (practiceId) {
      setCurrentPracticeId(practiceId);
    }

    if (unit) {
      setActiveUnit(unit);
    }
  };

  const handleUpdateWristbandData = (updatedWb: WristbandData) => {
    const now = Date.now();
    lastLocalWristbandEditTimeRef.current = now;
    lastLocalEditTimeRef.current = now;
    const maxRows = Math.max(
      ...(updatedWb.wristbands || []).map((w) => w.rowsCount || 13),
      updatedWb.rows || 13
    );
    const taggedWb: WristbandData = { ...updatedWb, rows: maxRows, lastEdited: now };
    setWristbandData(taggedWb);
    latestStateRef.current.wristbandData = taggedWb;
    safeJSONSet('footballWristbandData', taggedWb);
    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
    setWeeklyData((prev) => {
      const existingWeek = prev[scopedKey] || prev[currentWeek] || {
        formations: defaultFormations,
        depthChart: {},
        scrimmageChart: {},
        opponent: '',
      };
      const updatedWeek = {
        ...existingWeek,
        wristbandData: taggedWb,
      };
      const nextWeekly = {
        ...prev,
        [scopedKey]: updatedWeek,
        [currentWeek]: updatedWeek,
      };
      latestStateRef.current.weeklyData = nextWeekly;
      safeJSONSet('footballWeeklyData', nextWeekly);
      return nextWeekly;
    });

    lastLocalCallSheetEditTimeRef.current = now;

    // Automatically synchronize call sheet tables whenever wristband is updated
    const currentCs = latestStateRef.current.callSheetData || callSheetData;
    const currentDb = latestStateRef.current.playDatabase || playDatabase;
    const syncedCs = syncWristbandToCallSheet(taggedWb, currentCs, currentDb);
    const taggedCs: CallSheetFullData = { ...syncedCs, lastEdited: now };
    setCallSheetData(taggedCs);
    latestStateRef.current.callSheetData = taggedCs;
    safeJSONSet('footballCallSheetData', taggedCs);
    safeJSONSet('footballCallSheetData_backup', taggedCs);

    // Save and broadcast immediately so other coaches receive changes instantly
    // and refreshing immediately will NOT lose changes
    flushAndSaveStateToStorage('wristband_update', { activeUnit: 'wristband', scope: 'wristband_update' });
  };

  const handleUpdateCallSheetData = (newCs: CallSheetFullData) => {
    const now = newCs.lastEdited || Date.now();
    lastLocalEditTimeRef.current = now;
    lastLocalCallSheetEditTimeRef.current = now;
    const taggedCs: CallSheetFullData = { ...newCs, lastEdited: now };
    setCallSheetData(taggedCs);
    latestStateRef.current.callSheetData = taggedCs;
    saveCallSheetSnapshot(taggedCs);
    safeJSONSet('footballCallSheetData', taggedCs);
    safeJSONSet('footballCallSheetData_backup', taggedCs);

    // Save and broadcast immediately so other coaches receive changes instantly
    // and refreshing immediately will NOT lose changes
    flushAndSaveStateToStorage('call_sheet_update', { activeUnit: 'call_sheet', scope: 'call_sheet_update' });
  };

  const handleSetAdminPasscode = async (newPasscode: string) => {
    const trimmed = newPasscode.trim();
    const result = await setAdminPasscodeOnServer(trimmed);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save admin passcode');
    }
    setAdminPasscodeSet(true);
    localStorage.setItem('footballAdminPasscodeSet', 'true');
    localStorage.removeItem('footballAdminCustomPasscode');
  };

  const pullServerStateAfterSession = async () => {
    try {
      const serverRes = await fetchServerState();
      if (serverRes && serverRes.hasData && serverRes.state) {
        applyRemoteState(serverRes.state, 'session_login_pull', serverRes.version, serverRes.updatedAt);
      }
      const health = await checkServerHealth();
      if (typeof health?.adminPasscodeSet === 'boolean') {
        setAdminPasscodeSet(health.adminPasscodeSet);
        localStorage.setItem('footballAdminPasscodeSet', health.adminPasscodeSet ? 'true' : 'false');
      }
    } catch (err) {
      console.warn('Server state pull after session failed:', err);
    }
  };

  const handleAdminPasscodeSignIn = async (enteredPasscode: string): Promise<boolean> => {
    const trimmed = enteredPasscode.trim();
    if (!trimmed) return false;
    const ok = await establishOpsSession({ method: 'passcode', passcode: trimmed });
    if (!ok) return false;
    sessionStorage.setItem('football_admin_passcode_active', 'true');
    const adminUser = {
      email: 'admin@coachportal.local',
      displayName: 'Head Coach (Admin)',
      isAdminPasscodeAuth: true,
    };
    setCurrentUser(adminUser);
    setIsPendingApproval(false);
    setIsAuthModalOpen(false);
    setUserRole('admin');
    applyUserPreferencesOnLogin('admin@coachportal.local');
    setAdminPasscodeSet(true);
    localStorage.setItem('footballAdminPasscodeSet', 'true');
    await pullServerStateAfterSession();
    return true;
  };

  const handleLocalDeveloperSignIn = async (): Promise<boolean> => {
    if (!canUseLocalDeveloperLogin() || !markLocalDeveloperSession()) {
      return false;
    }
    setCurrentUser(buildLocalDeveloperUser());
    setIsPendingApproval(false);
    setIsAuthModalOpen(false);
    setUserRole('admin');
    applyUserPreferencesOnLogin(LOCAL_DEV_EMAIL);
    const ok = await establishOpsSession({ method: 'local_developer' });
    if (ok) await pullServerStateAfterSession();
    return true;
  };

  const handleSetAndSignInWithAdminPasscode = async (newPasscode: string) => {
    const trimmed = newPasscode.trim();
    const sessionOk = await establishOpsSession({ method: 'passcode', passcode: trimmed });
    if (!sessionOk) {
      throw new Error('Could not set the admin passcode on this computer.');
    }
    await handleSetAdminPasscode(trimmed);
    sessionStorage.setItem('football_admin_passcode_active', 'true');
    const adminUser = {
      email: 'admin@coachportal.local',
      displayName: 'Head Coach (Admin)',
      isAdminPasscodeAuth: true,
    };
    setCurrentUser(adminUser);
    setIsPendingApproval(false);
    setIsAuthModalOpen(false);
    setUserRole('admin');
    applyUserPreferencesOnLogin('admin@coachportal.local');
    await pullServerStateAfterSession();
  };

  const isLive = checkIsLiveEnvironment();
  const isApproved = isUserApproved(currentUser?.email, currentUser);
  const shouldBlockAccess = !currentUser || isPendingApproval || (!isApproved && isLive);

  if (shouldBlockAccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-900 dark:text-slate-100">
        <AuthModal
          key="coach-portal-auth"
          isOpen={true}
          isPendingApproval={Boolean(currentUser && !isApproved)}
          pendingEmail={currentUser?.email || ''}
          currentUserEmail={currentUser?.email || ''}
          isLiveEnvironment={isLive}
          adminPasscodeSet={adminPasscodeSet}
          onAdminPasscodeSignIn={handleAdminPasscodeSignIn}
          onSetAdminPasscode={handleSetAndSignInWithAdminPasscode}
          onLocalDeveloperSignIn={handleLocalDeveloperSignIn}
          onEmailAuth={async (email, pass, isSignUp) => {
            const { auth } = getFirebaseServices();
            if (!auth) {
              const clean = email.toLowerCase().trim();
              const isMaster = isMasterSuperAdminUser(clean);
              const approved = isMaster || !isLive;
              const userObj = { email: clean, displayName: isMaster ? 'Administrator' : 'Coach' };
              setCurrentUser(userObj);
              if (!approved) {
                setIsPendingApproval(true);
              } else {
                setIsPendingApproval(false);
                setIsAuthModalOpen(false);
                setUserRole(isMaster ? 'admin' : 'assistant');
                applyUserPreferencesOnLogin(clean);
              }
              await establishOpsSession({ method: 'loopback', email: clean });
              return;
            }
            if (isSignUp) {
              await auth.createUserWithEmailAndPassword(email, pass);
            } else {
              await auth.signInWithEmailAndPassword(email, pass);
            }
          }}
          onGoogleSignIn={async () => {
            const { auth } = getFirebaseServices();
            if (!auth) {
              setCurrentUser({ email: 'admin@coachportal.local', displayName: 'Administrator' });
              setIsPendingApproval(false);
              setIsAuthModalOpen(false);
              setUserRole('admin');
              applyUserPreferencesOnLogin('admin@coachportal.local');
              await establishOpsSession({ method: 'loopback', email: 'admin@coachportal.local' });
              return;
            }
            const provider = new window.firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await auth.signInWithPopup(provider);
          }}
          onRefreshApprovalStatus={async () => {
            const { db } = getFirebaseServices();
            if (!db || !currentUser?.email) return;
            try {
              const doc = await db.collection('teamData').doc('depthChartData').get();
              if (doc && doc.exists) {
                const data = doc.data();
                if (data && Array.isArray(data.staffList)) {
                  setStaffList(data.staffList);
                  safeJSONSet('footballTeamCoaches', data.staffList);
                  const clean = currentUser.email.toLowerCase().trim();
                  const found = data.staffList.find((c: StaffCoach) => c.email.toLowerCase().trim() === clean);
                  if (found && found.status === 'Active') {
                    setIsPendingApproval(false);
                    const isHead =
                      found.role?.toLowerCase().includes('head coach') ||
                      found.role?.toLowerCase().includes('admin');
                    setUserRole(isHead ? 'admin' : 'assistant');
                  } else {
                    alert('Your account is still pending approval. The Head Coach or Admin will approve you in the Staff Portal.');
                  }
                }
              }
            } catch (err: any) {
              console.warn('Error checking approval status:', err);
            }
          }}
          onSignOut={() => {
            sessionStorage.removeItem('football_admin_passcode_active');
            sessionStorage.removeItem('football_dev_test_mode');
            clearLocalDeveloperSession();
            void clearOpsSession();
            const { auth } = getFirebaseServices();
            if (auth) auth.signOut().then(() => window.location.reload());
            else {
              setCurrentUser(null);
              setIsPendingApproval(false);
              window.location.reload();
            }
          }}
          staffList={staffList}
          teams={teams}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 print:bg-white print:text-black flex flex-row print:block print:h-auto print:min-h-0 print:overflow-visible font-sans text-slate-900 dark:text-slate-100 selection:bg-indigo-600 selection:text-white overflow-x-hidden print:overflow-x-visible">
      {/* Hidden File Inputs for Import */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleImportFullBackup}
      />
      <input
        type="file"
        ref={drillCsvInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleImportDrillsCSV}
      />
      <input
        type="file"
        ref={drillJsonInputRef}
        className="hidden"
        accept=".json"
        onChange={handleImportDrillsJSON}
      />

      {/* Left Vertical Sidebar Navigation (Folder System with Cascading Expansion & Hover Details) */}
      <SidebarNavigation
        activeUnit={activeUnit}
        onSelectUnit={(unit) => {
          if (unit === 'depth_chart') {
            setActiveUnit(depthSubUnit || 'offense');
          } else {
            setActiveUnit(unit);
          }
        }}
        userRole={userRole}
        depthSubUnit={depthSubUnit}
        onSelectDepthSubUnit={(sub) => {
          setDepthSubUnit(sub);
          setActiveUnit(sub);
        }}
        defaultScreen={defaultScreen}
        onSetDefaultScreen={handleSetDefaultScreen}
        onOpenPreferencesModal={() => setIsPreferencesModalOpen(true)}
        activeWhiteboardDrillId={activeWhiteboardDrillId}
        activeWhiteboardCategory={activeWhiteboardCategory}
        onSelectWhiteboardDrill={(drillId, category) => {
          setActiveWhiteboardDrillId(drillId);
          setActiveWhiteboardCategory(category);
          setActiveUnit('whiteboard');
        }}
        onSelectWhiteboardCategory={(category) => {
          setActiveWhiteboardCategory(category);
          setActiveUnit('whiteboard');
        }}
        activeTeam={currentActiveTeam}
        guideTree={guideTree}
        onSelectGuideMain={(main) => {
          setActiveGuideMain(main);
          setActiveUnit('guide');
        }}
        isExpanded={isSidebarExpanded}
        onToggleExpanded={() => setIsSidebarExpanded((prev) => !prev)}
      />

      {/* Main Right Scrollable Viewport (Header + Active Screen) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto print:h-auto print:min-h-0 print:max-h-none print:overflow-visible print:block print:w-full">
        {/* Main Athletic Header */}
        <Header
        currentWeek={currentWeek}
        onWeekChange={(wk) => {
          changeCurrentWeek(wk);
          ensureWeekExists(wk);
        }}
        opponent={currentWeekState.opponent || ''}
        onOpponentChange={(opp) => {
          setWeeklyData((prev) => {
            const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
            const existingWeek = prev[scopedKey] || prev[currentWeek] || {
              formations: defaultFormations,
              depthChart: {},
              scrimmageChart: {},
              opponent: opp,
            };
            const updatedWeek = {
              ...existingWeek,
              opponent: opp,
              scouting: {
                ...(existingWeek.scouting || {}),
                opponent: opp,
              },
            };
            return {
              ...prev,
              [scopedKey]: updatedWeek,
              [currentWeek]: updatedWeek,
            };
          });
        }}
        scheduleEvents={activeTeamScheduleEvents}
        userEmail={currentUser?.email || 'Head Coach'}
        userRole={userRole}
        onRoleChange={setUserRole}
        syncStatus={syncStatus}
        activeUnit={activeUnit}
        onNavigateToHome={() => navigateToUnit('home')}
        onNavigateToSchedule={() => setActiveUnit('schedule')}
        onNavigateToMobileHub={() => setActiveUnit('mobile_hub')}
        onSignOut={handleSignOut}
        activeCoachesCount={Math.max(1, activeUsers.length)}
        onOpenActiveCoachesModal={() => setIsActiveCoachesModalOpen(true)}
        onToggleFullScreen={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            if (document.exitFullscreen) document.exitFullscreen();
          }
        }}
        onExportData={handleExportFullBackup}
        onImportClick={() => setIsImportModalOpen(true)}
        onResetData={handleResetData}
        onOpenCopyWeekModal={() => setIsCopyWeekModalOpen(true)}
        seasonConfig={seasonConfig}
        onOpenSeasonConfigModal={() => setIsSeasonConfigModalOpen(true)}
        teams={teams}
        activeTeamId={activeTeamId}
        defaultTeamId={defaultTeamId}
        onSelectTeam={setActiveTeamId}
        onSetDefaultTeam={handleSetDefaultTeam}
        userAssignedTeamIds={currentUserCoach?.assignedTeamIds}
        onOpenManageTeams={() => setActiveUnit('users')}
        onOpenPreferencesModal={() => setIsPreferencesModalOpen(true)}
        onOpenThemeGallery={() => setIsThemeGalleryOpen(true)}
        themeMode={themeMode}
        onToggleThemeMode={handleToggleThemeMode}
        onForceSave={handleForceSave}
        onForceRefresh={handleForceRefresh}
        onOpenMobileNav={() => setIsMobileNavOpen(true)}
      />

      {/* Main Layout Area */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 md:p-6 pb-24 md:pb-6 print:p-0 print:m-0 print:max-w-none print:w-full print:block print:overflow-visible">
        <div className="flex flex-col lg:flex-row gap-6 items-start print:block print:gap-0 print:w-full print:overflow-visible">
          {/* Main Board / Panel Column */}
          <div className="flex-1 min-w-0 w-full print:block print:w-full print:overflow-visible">
            {/* 0.0. PC / Desktop Clean Home Splash Screen */}
            {activeUnit === 'home' && (
              <HomeView
                activeTeam={currentActiveTeam}
                teams={teams}
                onSelectTeam={setActiveTeamId}
                currentWeek={currentWeek}
                seasonConfig={seasonConfig}
                scheduleEvents={activeTeamScheduleEvents}
                practicePlans={activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData}
                roster={activeTeamRoster}
                userRole={userRole}
                onNavigateToUnit={(unit, options) => {
                  if (options?.week) {
                    changeCurrentWeek(options.week);
                    ensureWeekExists(options.week);
                  }
                  if (options?.practiceId) {
                    setCurrentPracticeId(options.practiceId);
                    safeJSONSet('footballCurrentPracticeId', options.practiceId);
                  }
                  if (options?.openTakeAttendance) {
                    setAutoOpenTakeAttendance(true);
                  }
                  navigateToUnit(unit, options as any);
                }}
                onSelectPractice={(id) => {
                  setCurrentPracticeId(id);
                  safeJSONSet('footballCurrentPracticeId', id);
                }}
                onOpenPrintPractice={() => triggerPrint()}
              />
            )}

            {/* 0. Mobile Starting Screen & Coach Hub */}
            {activeUnit === 'mobile_hub' && (
              <MobileHubView
                activeTeam={currentActiveTeam}
                teams={teams}
                onSelectTeam={setActiveTeamId}
                currentWeek={currentWeek}
                onSelectWeek={(wk) => {
                  changeCurrentWeek(wk);
                  ensureWeekExists(wk);
                }}
                userRole={userRole}
                roster={activeTeamRoster}
                scheduleEvents={activeTeamScheduleEvents}
                practicePlans={activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData}
                currentWeekState={currentWeekState}
                formations={currentFormations}
                depthChart={currentDepthChart}
                defaultScreen={defaultScreen}
                onSetDefaultScreen={handleSetDefaultScreen}
                onNavigateToUnit={(unit, optionsOrSubUnit) => {
                  if (typeof optionsOrSubUnit === 'object' && optionsOrSubUnit !== null) {
                    if (optionsOrSubUnit.week) {
                      changeCurrentWeek(optionsOrSubUnit.week);
                      ensureWeekExists(optionsOrSubUnit.week);
                    }
                    if (optionsOrSubUnit.practiceId) {
                      setCurrentPracticeId(optionsOrSubUnit.practiceId);
                      safeJSONSet('footballCurrentPracticeId', optionsOrSubUnit.practiceId);
                    }
                    if (optionsOrSubUnit.openTakeAttendance) {
                      setAutoOpenTakeAttendance(true);
                    }
                    navigateToUnit(unit, optionsOrSubUnit);
                  } else {
                    const subUnit = optionsOrSubUnit;
                    navigateToUnit(unit, subUnit ? { subUnit } : undefined);
                  }
                }}
                onQuickAttendanceSave={(rec) => {
                  setAttendanceLogs((prev) => {
                    // Update or prepend record for the date
                    const filtered = prev.filter((r) => r.id !== rec.id && r.date !== rec.date);
                    const updated = [rec, ...filtered];
                    safeJSONSet('footballAttendanceLogs', updated);
                    return updated;
                  });
                  saveStateToStorage('attendance');
                }}
                attendanceLogs={attendanceLogs}
                currentPracticeId={currentPracticeId}
                onSelectPractice={(id) => {
                  setCurrentPracticeId(id);
                  safeJSONSet('footballCurrentPracticeId', id);
                }}
                onUpdatePracticeMeta={handleUpdatePracticeMeta}
                onSyncPracticeToPlan={handleSyncPracticeToPlan}
                onCreatePracticePlan={(newPlan, linkedEventId) => {
                  updatePracticeDataAndSave((prev) => [...prev, newPlan], true, newPlan.id);
                  setCurrentPracticeId(newPlan.id);
                  safeJSONSet('footballCurrentPracticeId', newPlan.id);
                  if (linkedEventId) {
                    setScheduleEvents((prev) => {
                      const next = prev.map((ev) =>
                        ev.id === linkedEventId ? { ...ev, linkedPracticePlanId: newPlan.id } : ev
                      );
                      safeJSONSet('footballScheduleEvents', next);
                      latestStateRef.current.scheduleEvents = next;
                      return next;
                    });
                    debouncedSave('schedule');
                  }
                }}
                onOpenPreferencesModal={() => setIsPreferencesModalOpen(true)}
                onOpenScheduleModal={() => setActiveUnit('schedule')}
                onOpenThemeGallery={() => setIsThemeGalleryOpen(true)}
                guideTree={guideTree}
                guideOrder={guideOrder}
                activeGuideMain={activeGuideMain}
                activeGuideSub={activeGuideSub}
                onSelectGuideMain={setActiveGuideMain}
                onSelectGuideSub={setActiveGuideSub}
                whiteboardDrills={loadEffectiveWhiteboardDrills()}
                onOpenWhiteboardDrill={(drillId, cat) => {
                  navigateToUnit('whiteboard', {
                    drillId,
                    drillCategory: cat as any,
                  });
                }}
              />
            )}

            {/* Depth Chart Sub-Navigation Bar */}
            {['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live', 'depth_chart'].includes(
              activeUnit
            ) && (
              <div className="mb-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-xs dark:shadow-md">
                <span className="px-3 py-1 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5 shrink-0">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Depth Chart:</span>
                </span>
                {[
                  { id: 'offense', label: 'Offense', icon: Zap, isSpecial: false },
                  { id: 'defense', label: 'Defense', icon: Shield, isSpecial: false },
                  { id: 'st', label: 'Special Teams', icon: Target, isSpecial: false },
                  { id: 'groups', label: 'Position Groups', icon: Users, isSpecial: false },
                  { id: 'scrimmage', label: '11v11 Scrimmage & Rotation', icon: Swords, isSpecial: true, tag: 'Live', badgeColor: 'violet' },
                  { id: 'practice_live', label: 'Practice 7v7 & 11v11 Drills', icon: Flame, isSpecial: true, tag: 'Live Drills', badgeColor: 'orange' },
                ].map((sub) => {
                  const Icon = sub.icon;
                  const isActive =
                    activeUnit === sub.id ||
                    (activeUnit === 'depth_chart' && depthSubUnit === sub.id);

                  if (sub.isSpecial) {
                    const isOrange = sub.badgeColor === 'orange';
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setDepthSubUnit(sub.id as DepthSubUnit);
                          setActiveUnit(sub.id as UnitType);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
                          isActive
                            ? isOrange
                              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-500 shadow-sm shadow-orange-600/25 ring-1 ring-orange-400/40'
                              : 'bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-600/25 ring-1 ring-violet-400/40'
                            : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-750 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border-slate-200 dark:border-slate-700 shadow-xs'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${
                          isActive 
                            ? 'text-white' 
                            : isOrange 
                              ? 'text-orange-600 dark:text-orange-400' 
                              : 'text-violet-600 dark:text-violet-400'
                        }`} />
                        <span>{sub.label}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : isOrange
                                ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700/50'
                                : 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50'
                          }`}
                        >
                          {sub.tag}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setDepthSubUnit(sub.id as DepthSubUnit);
                        setActiveUnit(sub.id as UnitType);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                          : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 1. Formations View (Offense, Defense, Special Teams, Depth Chart Groups) */}
            {((['offense', 'defense', 'st', 'groups'].includes(activeUnit)) ||
              (activeUnit === 'depth_chart' && ['offense', 'defense', 'st', 'groups'].includes(depthSubUnit))) && (
              <>
                {depthChartCopyCandidate && (
                  <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/50 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center shrink-0">
                        <Copy className="w-5 h-5 text-indigo-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">
                            ⚡ {formatWeekLabel(depthChartCopyCandidate.targetWeek)} Depth Chart Ready
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            Formations Auto-Copied
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium mt-0.5">
                          Formations from <strong className="text-white font-bold">{formatWeekLabel(depthChartCopyCandidate.sourceWeek)}</strong> were automatically copied over. Would you like to copy all player depth chart spots ({depthChartCopyCandidate.sourceCount} player assignments) as well?
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          handleExecuteCopyWeek(
                            depthChartCopyCandidate.sourceWeek,
                            depthChartCopyCandidate.targetWeek,
                            'both',
                            undefined,
                            true
                          );
                          setDismissedCopyPrompts((prev) => new Set(prev).add(depthChartCopyCandidate.targetWeek));
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Copy Player Spots from {formatWeekLabel(depthChartCopyCandidate.sourceWeek)}</span>
                      </button>

                      <button
                        onClick={() => {
                          setDismissedCopyPrompts((prev) => new Set(prev).add(depthChartCopyCandidate.targetWeek));
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 active:scale-95 transition-all cursor-pointer"
                      >
                        Keep Formations Only (Fresh Lineup)
                      </button>
                    </div>
                  </div>
                )}

                <FormationsView
                key={
                  activeUnit === 'depth_chart'
                    ? (['offense', 'defense', 'st', 'groups'].includes(depthSubUnit) ? (depthSubUnit as 'offense' | 'defense' | 'st' | 'groups') : 'offense')
                    : (activeUnit as 'offense' | 'defense' | 'st' | 'groups')
                }
                unit={
                  activeUnit === 'depth_chart'
                    ? (['offense', 'defense', 'st', 'groups'].includes(depthSubUnit) ? (depthSubUnit as 'offense' | 'defense' | 'st' | 'groups') : 'offense')
                    : (activeUnit as 'offense' | 'defense' | 'st' | 'groups')
                }
                formations={currentFormations}
                depthChart={currentDepthChart}
                selectedFormationId={selectedFormationId}
                onSelectFormation={setSelectedFormationId}
                userRole={userRole}
                activeTeam={currentActiveTeam}
                teams={teams}
                onCopyFormationsFromTeam={handleCopyFormationsFromTeam}
                onAddFormation={handleAddFormation}
                onMoveFormation={handleMoveFormation}
                onDuplicateFormation={handleDuplicateFormation}
                onRenameFormation={handleRenameFormation}
                onDeleteFormation={handleDeleteFormation}
                onRestoreDefaultFormations={handleRestoreDefaultFormations}
                onAddRow={handleAddRow}
                onEditRowName={handleEditRowName}
                onEditRowSlots={handleEditRowSlots}
                onDeleteRow={handleDeleteRow}
                onAddPosition={handleAddPosition}
                onEditPositionName={handleEditPositionName}
                onMovePositionRow={handleMovePositionRow}
                onCopyPositionToOtherForm={handleCopyPositionToOtherForm}
                onDeletePosition={handleDeletePosition}
                onDropPlayerOnCard={handleDropPlayerOnCard}
                onRemovePlayerFromCard={handleRemovePlayerFromCard}
                onOpenSelectivePrintModal={(unit) =>
                  setSelectivePrintUnit(unit)
                }
                onOpenCopyWeekModal={() => setIsCopyWeekModalOpen(true)}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                onDragStartPlacedPlayer={handleDragStartPlacedPlayer}
                onPositionCardDragStart={handlePositionCardDragStart}
                onPositionCardDropOnSlot={handlePositionCardDropOnSlot}
                onSetRowSlots={handleSetRowSlots}
                onAddSlotToRow={handleAddSlotToRow}
                onRemoveSlotFromRow={handleRemoveSlotFromRow}
                onInsertSlotAt={handleInsertSlotAt}
                onClearPositionToEmpty={handleClearPositionToEmpty}
                onAssignPositionToSlot={handleAssignPositionToSlot}
                onAddPositionDirect={handleAddPositionDirect}
                onRenamePositionDirect={handleRenamePositionDirect}
                onRenameRowDirect={handleRenameRowDirect}
                onAddRowDirect={handleAddRowDirect}
                onAddFormationDirect={handleAddFormationDirect}
                onRenameFormationDirect={handleRenameFormationDirect}
                onDuplicateFormationDirect={handleDuplicateFormationDirect}
                onMovePositionDirect={handleMovePositionDirect}
                onCopyPositionDirect={handleCopyPositionDirect}
                roster={roster.filter((p) => !p.teamId || p.teamId === activeTeamId)}
                onAssignPlayerDirect={handleAssignPlayerDirect}
                onReorderDepthPlayer={handleReorderDepthPlayer}
                isLockedByOther={isLockedByOther}
                lockHolderName={lockHolderName}
                lockHolderEmail={lockHolderEmail}
                isHeldByMe={isHeldByMe}
                onAcquireLock={() => handleAcquireLock(currentDepthUnit, currentWeek, false)}
                onReleaseLock={() => handleReleaseLock(currentDepthUnit, currentWeek)}
                onTakeOverLock={() => handleTakeOverLock(currentDepthUnit, currentWeek)}
              />
              </>
            )}

            {/* 2. Practice / Scrimmage Rotation */}
            {(activeUnit === 'scrimmage' || (activeUnit === 'depth_chart' && depthSubUnit === 'scrimmage')) && (
              <ScrimmageView
                formations={currentFormations}
                scrimmageChart={currentScrimmageChart}
                scrimmageFilters={scrimmageFilters}
                userRole={userRole}
                activeTeam={currentActiveTeam}
                onOpenScrimmageFilterModal={() =>
                  setIsScrimmageFilterOpen(true)
                }
                onOpenScrimmagePrintModal={() => triggerPrint()}
                onDropPlayerOnScrimmageCard={handleDropPlayerOnCard}
                onRemovePlayerFromScrimmageCard={handleRemovePlayerFromCard}
                onDragStartPlacedPlayer={handleDragStartPlacedPlayer}
              />
            )}

            {/* 2b. Practice Live Drills & Matchups (7v7 / 11v11) */}
            {(activeUnit === 'practice_live' || (activeUnit === 'depth_chart' && depthSubUnit === 'practice_live')) && (
              <PracticeLiveDrillsView
                currentWeek={currentWeek}
                practiceDrillGroups={currentWeekState.practiceDrillGroups || []}
                onUpdatePracticeDrillGroups={(updatedGroups) => {
                  lastLocalEditTimeRef.current = Date.now();
                  setWeeklyData((prev) => {
                    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
                    const existingWeek = prev[scopedKey] || prev[currentWeek] || {
                      formations: defaultFormations,
                      depthChart: {},
                      scrimmageChart: {},
                    };
                    const updatedWeek: WeekState = {
                      ...existingWeek,
                      practiceDrillGroups: updatedGroups,
                    };
                    const updatedAll = {
                      ...prev,
                      [scopedKey]: updatedWeek,
                      [currentWeek]: updatedWeek,
                    };
                    latestStateRef.current.weeklyData = updatedAll;
                    safeJSONSet('footballWeeklyData', updatedAll);
                    return updatedAll;
                  });
                  flushAndSaveStateToStorage('practice_drill_update');
                }}
                roster={activeTeamRoster}
                userRole={userRole}
                depthChart={currentDepthChart}
                scrimmageChart={currentWeekState.scrimmageChart || {}}
                formations={currentFormations}
                activeTeam={currentActiveTeam}
                onDragStartPlacedPlayer={handleDragStartPlacedPlayer}
              />
            )}

            {activeUnit === 'ppr' && (
              <PlayerPprView
                currentWeek={currentWeek}
                currentWeekLabel={formatWeekLabel(currentWeek, seasonConfig)}
                priorWeekKey={getPreviousWeekKey(
                  currentWeek,
                  getSeasonWeekList(seasonConfig).map((w) => w.key)
                )}
                priorWeekLabel={formatWeekLabel(
                  getPreviousWeekKey(currentWeek, getSeasonWeekList(seasonConfig).map((w) => w.key)),
                  seasonConfig
                )}
                priorOpponent={
                  resolveWeekState(
                    weeklyData,
                    activeTeamId,
                    getPreviousWeekKey(currentWeek, getSeasonWeekList(seasonConfig).map((w) => w.key))
                  ).opponent || ''
                }
                roster={activeTeamRoster}
                priorDepthChart={
                  resolveWeekState(
                    weeklyData,
                    activeTeamId,
                    getPreviousWeekKey(currentWeek, getSeasonWeekList(seasonConfig).map((w) => w.key))
                  ).depthChart || {}
                }
                priorFormations={
                  resolveWeekState(
                    weeklyData,
                    activeTeamId,
                    getPreviousWeekKey(currentWeek, getSeasonWeekList(seasonConfig).map((w) => w.key))
                  ).formations || currentFormations
                }
                reviews={
                  resolveWeekState(
                    weeklyData,
                    activeTeamId,
                    getPreviousWeekKey(currentWeek, getSeasonWeekList(seasonConfig).map((w) => w.key))
                  ).pffReviews || {}
                }
                userRole={userRole}
                gradeCriteria={pffGradeCriteria}
                playerGroups={pffPlayerGroups}
                filmSession={
                  resolveWeekState(
                    weeklyData,
                    activeTeamId,
                    getPreviousWeekKey(currentWeek, getSeasonWeekList(seasonConfig).map((w) => w.key))
                  ).filmSession
                }
                onUpdateFilmSession={(nextSession) => {
                  lastLocalEditTimeRef.current = Date.now();
                  const gradeWeek = getPreviousWeekKey(
                    currentWeek,
                    getSeasonWeekList(seasonConfig).map((w) => w.key)
                  );
                  setWeeklyData((prev) => {
                    const scopedKey = getScopedWeekKey(activeTeamId, gradeWeek);
                    const existingWeek = prev[scopedKey] || prev[gradeWeek] || {
                      formations: defaultFormations,
                      depthChart: {},
                      scrimmageChart: {},
                    };
                    const updatedWeek: WeekState = {
                      ...existingWeek,
                      filmSession: mergeFilmSession(existingWeek.filmSession, nextSession),
                    };
                    const updatedAll = {
                      ...prev,
                      [scopedKey]: updatedWeek,
                      [gradeWeek]: updatedWeek,
                    };
                    latestStateRef.current.weeklyData = updatedAll;
                    safeJSONSet('footballWeeklyData', updatedAll);
                    return updatedAll;
                  });
                  flushAndSaveStateToStorage('ppr_update');
                }}
                onUpdatePlayerGroups={(nextGroups) => {
                  lastLocalEditTimeRef.current = Date.now();
                  setPffPlayerGroups(nextGroups);
                  latestStateRef.current.pffPlayerGroups = nextGroups;
                  safeJSONSet('footballPffPlayerGroups', nextGroups);
                  flushAndSaveStateToStorage('ppr_update');
                }}
                onUpdateGradeCriteria={(nextCriteria) => {
                  lastLocalEditTimeRef.current = Date.now();
                  setPffGradeCriteria(nextCriteria);
                  latestStateRef.current.pffGradeCriteria = nextCriteria;
                  safeJSONSet('footballPffGradeCriteria', nextCriteria);
                  flushAndSaveStateToStorage('ppr_update');
                }}
                onUpdateReviews={(nextReviews) => {
                  lastLocalEditTimeRef.current = Date.now();
                  const gradeWeek = getPreviousWeekKey(
                    currentWeek,
                    getSeasonWeekList(seasonConfig).map((w) => w.key)
                  );
                  setWeeklyData((prev) => {
                    const scopedKey = getScopedWeekKey(activeTeamId, gradeWeek);
                    const existingWeek = prev[scopedKey] || prev[gradeWeek] || {
                      formations: defaultFormations,
                      depthChart: {},
                      scrimmageChart: {},
                    };
                    const updatedWeek: WeekState = {
                      ...existingWeek,
                      pffReviews: mergePffReviews(existingWeek.pffReviews, nextReviews),
                    };
                    const updatedAll = {
                      ...prev,
                      [scopedKey]: updatedWeek,
                      [gradeWeek]: updatedWeek,
                    };
                    latestStateRef.current.weeklyData = updatedAll;
                    safeJSONSet('footballWeeklyData', updatedAll);
                    return updatedAll;
                  });
                  flushAndSaveStateToStorage('ppr_update');
                }}
              />
            )}

            {/* Game Day Hub (Call Sheet, Wristbands & Scouting) */}
            {activeUnit === 'game_day' && (
              <GameDayHubView
                userRole={userRole}
                activeTeamName={currentActiveTeam?.name || 'Mahopac 10U'}
                opponent={currentWeekState.opponent || ''}
                onUpdateOpponent={(newOpponent) => {
                  setWeeklyData((prev) => {
                    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
                    const existingWeek = prev[scopedKey] || prev[currentWeek] || {
                      formations: defaultFormations,
                      depthChart: {},
                      scrimmageChart: {},
                      opponent: '',
                    };
                    const updatedWeek = {
                      ...existingWeek,
                      opponent: newOpponent,
                    };
                    return {
                      ...prev,
                      [scopedKey]: updatedWeek,
                      [currentWeek]: updatedWeek,
                    };
                  });
                }}
                currentWeek={currentWeek}
                playDatabase={playDatabase}
                onUpdatePlayDatabase={(newDb) => {
                  setPlayDatabase(newDb);
                  latestStateRef.current.playDatabase = newDb;
                  safeJSONSet('footballPlayDatabase', newDb);
                  debouncedSave('all');
                }}
                callSheetData={callSheetData}
                onUpdateCallSheetData={handleUpdateCallSheetData}
                deletedPlayIds={deletedPlayIds}
                onUpdateDeletedPlayIds={(newIds) => {
                  setDeletedPlayIds(newIds);
                  safeJSONSet('footballDeletedPlayIds', newIds);
                }}
                wristbandData={effectiveWristbandData}
                onUpdateWristbandData={handleUpdateWristbandData}
                scouting={currentWeekState.scouting || {}}
                onUpdateScouting={(field: any, val?: any) => {
                  setWeeklyData((prev) => {
                    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
                    const existingWeek = prev[scopedKey] || prev[currentWeek] || {
                      formations: defaultFormations,
                      depthChart: {},
                      scrimmageChart: {},
                      opponent: '',
                    };
                    const updates = typeof field === 'object' && field !== null ? field : { [field]: val };
                    const updatedScouting = {
                      ...(existingWeek.scouting || {}),
                      ...updates,
                    };
                    const updatedWeek = {
                      ...existingWeek,
                      opponent: updates.opponent !== undefined ? updates.opponent : (existingWeek.opponent || ''),
                      scouting: updatedScouting,
                    };
                    return {
                      ...prev,
                      [scopedKey]: updatedWeek,
                      [currentWeek]: updatedWeek,
                    };
                  });
                }}
                staffList={staffList}
                savedCoaches={savedCoaches}
                scheduleEvents={activeTeamScheduleEvents}
                activeTeamRoster={activeTeamRoster}
                currentUser={currentUser}
                onNavigateToSchedule={() => setActiveUnit('schedule')}
                practicePlans={practiceData}
                onSyncPracticeToPlan={handleSyncPracticeToPlan}
                onNavigateToPractice={(planId) => {
                  navigateToUnit('practice', {
                    practiceId: planId,
                  });
                }}
                onUpdateScheduleEvent={handleUpdateScheduleEvent}
              />
            )}

            {/* 3. Wristband Builder */}
            {activeUnit === 'wristband' && (
              <WristbandView
                wristbandData={effectiveWristbandData}
                userRole={userRole}
                masterPlayLibrary={masterPlayLibrary}
                playDatabase={playDatabase}
                callSheetData={callSheetData}
                activeTeamName={currentActiveTeam?.name || 'Mahopac 10U'}
                onUpdateCallSheetData={handleUpdateCallSheetData}
                onUpdatePlayDatabase={(newDb) => {
                  setPlayDatabase(newDb);
                  latestStateRef.current.playDatabase = newDb;
                  safeJSONSet('footballPlayDatabase', newDb);
                  debouncedSave('all');
                }}
                onUpdateWristbandData={handleUpdateWristbandData}
              />
            )}

            {/* Call Sheet (Interactive Offense & Defense Sideline Call Sheet) */}
            {activeUnit === 'call_sheet' && (
              <CallSheetMainView
                activeTeamName={currentActiveTeam?.name || 'Mahopac 10U'}
                masterPlayLibrary={masterPlayLibrary}
                onUpdateMasterPlayLibrary={(newPlays) => {
                  setMasterPlayLibrary(newPlays);
                  latestStateRef.current.masterPlayLibrary = newPlays;
                  safeJSONSet('footballMasterPlays', newPlays);
                  debouncedSave('all');
                }}
                playDatabase={playDatabase}
                onUpdatePlayDatabase={(newDb) => {
                  setPlayDatabase(newDb);
                  latestStateRef.current.playDatabase = newDb;
                  safeJSONSet('footballPlayDatabase', newDb);
                  debouncedSave('all');
                }}
                callSheetData={callSheetData}
                onUpdateCallSheetData={handleUpdateCallSheetData}
                deletedPlayIds={deletedPlayIds}
                onUpdateDeletedPlayIds={(newDeleted) => {
                  setDeletedPlayIds(newDeleted);
                  latestStateRef.current.deletedPlayIds = newDeleted;
                  safeJSONSet('footballDeletedPlayIds', newDeleted);
                  debouncedSave('all');
                }}
                wristbandData={effectiveWristbandData}
              />
            )}

            {/* 4. Scouting Report */}
            {activeUnit === 'scouting' && (
              <ScoutingView
                key={`scout-${activeTeamId}-${currentWeek}`}
                scouting={currentWeekState.scouting || {}}
                userRole={userRole}
                currentUser={currentUser}
                staffList={staffList}
                savedCoaches={savedCoaches}
                scheduleEvents={activeTeamScheduleEvents}
                currentWeek={currentWeek}
                onUpdateScouting={(field: any, val?: any) => {
                  lastLocalEditTimeRef.current = Date.now();
                  setWeeklyData((prev) => {
                    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
                    const existingWeek = prev[scopedKey] || prev[currentWeek] || {
                      formations: defaultFormations,
                      depthChart: {},
                      scrimmageChart: {},
                      opponent: '',
                    };
                    const updates = typeof field === 'object' && field !== null ? field : { [field]: val };
                    const updatedScouting = {
                      ...(existingWeek.scouting || {}),
                      ...updates,
                    };
                    const updatedWeek = {
                      ...existingWeek,
                      opponent: updates.opponent !== undefined ? updates.opponent : (existingWeek.opponent || ''),
                      scouting: updatedScouting,
                    };
                    const updatedAll = {
                      ...prev,
                      [scopedKey]: updatedWeek,
                      [currentWeek]: updatedWeek,
                    };
                    safeJSONSet('footballWeeklyData', updatedAll);
                    latestStateRef.current.weeklyData = updatedAll;
                    return updatedAll;
                  });
                  flushAndSaveStateToStorage('scouting_update');
                }}
                onNavigateToSchedule={() => setActiveUnit('schedule')}
                onNavigateToTendencies={() => setActiveUnit('tendencies')}
                onNavigateToHtmlTendencies={() => setActiveUnit('tendencies')}
              />
            )}

            {/* Tendencies View (Same layout and functionality as Playbooks & Guides) */}
            {(activeUnit === 'tendencies' || activeUnit === 'html_tendencies') && (
              <TendenciesView
                scouting={currentWeekState.scouting || {}}
                onUpdateScouting={(field: any, val?: any) => {
                  lastLocalEditTimeRef.current = Date.now();
                  setWeeklyData((prev) => {
                    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
                    const existingWeek = prev[scopedKey] || prev[currentWeek] || {
                      formations: defaultFormations,
                      depthChart: {},
                      scrimmageChart: {},
                      opponent: '',
                    };
                    const updates = typeof field === 'object' && field !== null ? field : { [field]: val };
                    const updatedScouting = {
                      ...(existingWeek.scouting || {}),
                      ...updates,
                    };
                    const updatedWeek = {
                      ...existingWeek,
                      opponent: updates.opponent !== undefined ? updates.opponent : (existingWeek.opponent || ''),
                      scouting: updatedScouting,
                    };
                    const updatedAll = {
                      ...prev,
                      [scopedKey]: updatedWeek,
                      [currentWeek]: updatedWeek,
                    };
                    safeJSONSet('footballWeeklyData', updatedAll);
                    latestStateRef.current.weeklyData = updatedAll;
                    return updatedAll;
                  });
                  flushAndSaveStateToStorage('scouting_update');
                }}
                opponentName={currentWeekState.opponent || currentWeekState.scouting?.opponent || 'Opponent'}
                weekName={currentWeek.startsWith('Week') ? currentWeek : `Week ${currentWeek}`}
                userRole={userRole}
                activeTeam={currentActiveTeam}
                onNavigateToScouting={() => setActiveUnit('scouting')}
              />
            )}

            {/* 5. Playbooks & Guides */}
            {activeUnit === 'guide' && (
              <PlaybookGuidesView
                guideTree={guideTree}
                guideOrder={guideOrder}
                activeMain={activeGuideMain}
                activeSub={activeGuideSub}
                userRole={userRole}
                activeTeam={currentActiveTeam}
                onSelectMain={setActiveGuideMain}
                onSelectSub={setActiveGuideSub}
                onUploadDocument={handleUploadGuideDocument}
                onSaveHtmlContent={handleSaveGuideHtml}
                onClearDocument={handleClearGuideDocument}
                onAddMainFolder={(name) => {
                  const updatedTree = { ...guideTree, [name]: { 'Full Playbook': '' } };
                  const updatedOrder = {
                    main: [...guideOrder.main, name],
                    sub: { ...guideOrder.sub, [name]: ['Full Playbook'] },
                  };
                  setGuideTree(updatedTree);
                  setGuideOrder(updatedOrder);
                  latestStateRef.current.guideTree = updatedTree;
                  latestStateRef.current.guideOrder = updatedOrder;
                  safeJSONSet('footballPdfGuidesTree', updatedTree);
                  safeJSONSet('footballPdfGuidesOrder', updatedOrder);
                  setActiveGuideMain(name);
                  setActiveGuideSub('Full Playbook');
                  flushAndSaveStateToStorage('playbook_add_main');
                }}
                onAddSubTab={(main, name) => {
                  const updatedTree = {
                    ...guideTree,
                    [main]: { ...(guideTree[main] || {}), [name]: '' },
                  };
                  const updatedOrder = {
                    ...guideOrder,
                    sub: {
                      ...guideOrder.sub,
                      [main]: [...(guideOrder.sub[main] || []), name],
                    },
                  };
                  setGuideTree(updatedTree);
                  setGuideOrder(updatedOrder);
                  latestStateRef.current.guideTree = updatedTree;
                  latestStateRef.current.guideOrder = updatedOrder;
                  safeJSONSet('footballPdfGuidesTree', updatedTree);
                  safeJSONSet('footballPdfGuidesOrder', updatedOrder);
                  setActiveGuideSub(name);
                  flushAndSaveStateToStorage('playbook_add_sub');
                }}
                onRenameMainFolder={(oldName, newName) => {
                  const updatedTree = { ...guideTree };
                  updatedTree[newName] = updatedTree[oldName];
                  delete updatedTree[oldName];
                  setGuideTree(updatedTree);

                  const updatedOrder = { ...guideOrder };
                  const mIdx = updatedOrder.main.indexOf(oldName);
                  if (mIdx !== -1) updatedOrder.main[mIdx] = newName;
                  if (updatedOrder.sub[oldName]) {
                    updatedOrder.sub[newName] = updatedOrder.sub[oldName];
                    delete updatedOrder.sub[oldName];
                  }
                  setGuideOrder(updatedOrder);
                  latestStateRef.current.guideTree = updatedTree;
                  latestStateRef.current.guideOrder = updatedOrder;
                  safeJSONSet('footballPdfGuidesTree', updatedTree);
                  safeJSONSet('footballPdfGuidesOrder', updatedOrder);
                  if (activeGuideMain === oldName) setActiveGuideMain(newName);
                  flushAndSaveStateToStorage('playbook_rename_main');
                }}
                onRenameSubTab={(main, oldName, newName) => {
                  const updatedTree = { ...guideTree };
                  if (updatedTree[main]) {
                    const val = updatedTree[main][oldName];
                    delete updatedTree[main][oldName];
                    updatedTree[main][newName] = val;
                    setGuideTree(updatedTree);
                  }

                  const updatedOrder = { ...guideOrder };
                  if (updatedOrder.sub[main]) {
                    const sIdx = updatedOrder.sub[main].indexOf(oldName);
                    if (sIdx !== -1) updatedOrder.sub[main][sIdx] = newName;
                    setGuideOrder(updatedOrder);
                  }
                  latestStateRef.current.guideTree = updatedTree;
                  latestStateRef.current.guideOrder = updatedOrder;
                  safeJSONSet('footballPdfGuidesTree', updatedTree);
                  safeJSONSet('footballPdfGuidesOrder', updatedOrder);
                  if (activeGuideSub === oldName) setActiveGuideSub(newName);
                  flushAndSaveStateToStorage('playbook_rename_sub');
                }}
                onDeleteMainFolder={(name) => {
                  const updatedTree = { ...guideTree };
                  delete updatedTree[name];
                  setGuideTree(updatedTree);

                  const updatedOrder = { ...guideOrder };
                  updatedOrder.main = updatedOrder.main.filter((m) => m !== name);
                  delete updatedOrder.sub[name];
                  setGuideOrder(updatedOrder);
                  latestStateRef.current.guideTree = updatedTree;
                  latestStateRef.current.guideOrder = updatedOrder;
                  safeJSONSet('footballPdfGuidesTree', updatedTree);
                  safeJSONSet('footballPdfGuidesOrder', updatedOrder);

                  if (activeGuideMain === name) {
                    const nextMain = updatedOrder.main[0] || 'Offense';
                    setActiveGuideMain(nextMain);
                    setActiveGuideSub(
                      updatedOrder.sub[nextMain]?.[0] || 'Full Playbook'
                    );
                  }
                  flushAndSaveStateToStorage('playbook_delete_main');
                }}
                onDeleteSubTab={(main, name) => {
                  const updatedTree = { ...guideTree };
                  if (updatedTree[main]) {
                    delete updatedTree[main][name];
                    setGuideTree(updatedTree);
                  }

                  const updatedOrder = { ...guideOrder };
                  if (updatedOrder.sub[main]) {
                    updatedOrder.sub[main] = updatedOrder.sub[main].filter(
                      (s) => s !== name
                    );
                    setGuideOrder(updatedOrder);
                    if (activeGuideSub === name) {
                      setActiveGuideSub(updatedOrder.sub[main][0] || '');
                    }
                  }
                  latestStateRef.current.guideTree = updatedTree;
                  latestStateRef.current.guideOrder = updatedOrder;
                  safeJSONSet('footballPdfGuidesTree', updatedTree);
                  safeJSONSet('footballPdfGuidesOrder', updatedOrder);
                  flushAndSaveStateToStorage('playbook_delete_sub');
                }}
                onMoveMainFolder={(name, direction) => {
                  const idx = guideOrder.main.indexOf(name);
                  if (idx === -1) return;
                  const newIdx = idx + direction;
                  if (newIdx < 0 || newIdx >= guideOrder.main.length) return;
                  const list = [...guideOrder.main];
                  const [moved] = list.splice(idx, 1);
                  list.splice(newIdx, 0, moved);
                  const updatedOrder = { ...guideOrder, main: list };
                  setGuideOrder(updatedOrder);
                  latestStateRef.current.guideOrder = updatedOrder;
                  safeJSONSet('footballPdfGuidesOrder', updatedOrder);
                  flushAndSaveStateToStorage('playbook_move_main');
                }}
                onMoveSubTab={(main, name, direction) => {
                  const subList = guideOrder.sub[main] || [];
                  const idx = subList.indexOf(name);
                  if (idx === -1) return;
                  const newIdx = idx + direction;
                  if (newIdx < 0 || newIdx >= subList.length) return;
                  const list = [...subList];
                  const [moved] = list.splice(idx, 1);
                  list.splice(newIdx, 0, moved);
                  const updatedOrder = {
                    ...guideOrder,
                    sub: { ...guideOrder.sub, [main]: list },
                  };
                  setGuideOrder(updatedOrder);
                  latestStateRef.current.guideOrder = updatedOrder;
                  safeJSONSet('footballPdfGuidesOrder', updatedOrder);
                  flushAndSaveStateToStorage('playbook_move_sub');
                }}
              />
            )}

            {/* 5.5. Interactive Whiteboard Playbook */}
            {activeUnit === 'whiteboard' && (
              <WhiteboardView
                userRole={userRole}
                activeTeam={currentActiveTeam}
                onNavigateToGuide={() => setActiveUnit('guide')}
                onNavigateToDrills={() => setActiveUnit('drills')}
                externalDrillId={activeWhiteboardDrillId}
                externalCategory={activeWhiteboardCategory}
                practices={activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData}
                currentPracticeId={currentPracticeId}
                onNavigateToPracticePlan={(practiceId, drillTitle) => {
                  navigateToUnit('practice', {
                    practiceId,
                  });
                }}
                onDrillSelect={(drillId, cat) => {
                  setActiveWhiteboardDrillId(drillId);
                  setActiveWhiteboardCategory(cat);
                  navigateToUnit('whiteboard', {
                    drillId,
                    drillCategory: cat,
                    replace: true,
                  });
                }}
                onCategorySelect={(cat) => {
                  setActiveWhiteboardCategory(cat);
                  navigateToUnit('whiteboard', {
                    drillId: activeWhiteboardDrillId,
                    drillCategory: cat,
                    replace: true,
                  });
                }}
                onSaveToGuidePlaybook={(mainFolder, subTabName, htmlContent) => {
                  setGuideTree((prev) => {
                    const next = {
                      ...prev,
                      [mainFolder]: {
                        ...(prev[mainFolder] || {}),
                        [subTabName]: htmlContent,
                      },
                    };
                    latestStateRef.current.guideTree = next;
                    safeJSONSet('footballPdfGuidesTree', next);
                    return next;
                  });
                  setGuideOrder((prev) => {
                    const mainList = prev.main.includes(mainFolder)
                      ? prev.main
                      : [...prev.main, mainFolder];
                    const curSubs = prev.sub[mainFolder] || [];
                    const nextSubs = curSubs.includes(subTabName)
                      ? curSubs
                      : [...curSubs, subTabName];
                    const next = {
                      ...prev,
                      main: mainList,
                      sub: {
                        ...prev.sub,
                        [mainFolder]: nextSubs,
                      },
                    };
                    latestStateRef.current.guideOrder = next;
                    safeJSONSet('footballPdfGuidesOrder', next);
                    return next;
                  });
                  flushAndSaveStateToStorage('whiteboard_save_guide');
                }}
              />
            )}

            {/* 6. Drill Library */}
            {activeUnit === 'drills' && (
              <DrillLibraryView
                cascadingDrills={cascadingDrills}
                collapsedFolders={collapsedFolders}
                userRole={userRole}
                onNavigateToWhiteboard={(drillId, cat) => {
                  if (drillId) setActiveWhiteboardDrillId(drillId);
                  if (cat) setActiveWhiteboardCategory(cat as any);
                  setActiveUnit('whiteboard');
                }}
                onToggleFolder={(pathKey) => {
                  setCollapsedFolders((prev) => {
                    const isCurrentlyCollapsed = prev[pathKey] !== undefined ? prev[pathKey] : true;
                    return {
                      ...prev,
                      [pathKey]: !isCurrentlyCollapsed,
                    };
                  });
                }}
                onAddTopFolder={handleAddTopDrillFolder}
                onAddSubfolder={handleAddSubfolder}
                onAddDrill={handleAddDrill}
                onRenameFolder={handleRenameDrillFolder}
                onDeleteFolder={handleDeleteDrillFolder}
                onMoveFolder={handleMoveDrillFolder}
                onUpdateDrill={handleUpdateDrill}
                onDeleteDrill={handleDeleteDrill}
                onMoveDrillToFolder={handleMoveDrillToFolder}
                onExportCSV={handleExportDrillsCSV}
                onImportCSVClick={() => drillCsvInputRef.current?.click()}
                onExportJSON={handleExportDrillsJSON}
                onImportJSONClick={() => drillJsonInputRef.current?.click()}
                onForceSyncCloud={() => saveStateToStorage('all')}
                onResetDefaults={() => {
                  if (confirm('Reset Drill Library to default categories?')) {
                    updateCascadingDrillsAndSave(() => deepClone(DEFAULT_CASCADING_DRILLS));
                  }
                }}
              />
            )}

            {/* 7. Practice Plan Generator */}
            {activeUnit === 'practice' && (
              <PracticePlanView
                practices={activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData}
                currentPracticeId={currentPracticeId}
                practiceTemplates={practiceTemplates}
                cascadingDrills={cascadingDrills}
                savedCoaches={activeTeamSavedCoaches}
                printFontSize={printFontSize}
                userRole={userRole}
                scheduleEvents={activeTeamScheduleEvents}
                onQuickCreateFromSchedule={handleQuickCreatePlanFromSchedule}
                onSelectPractice={(id) => {
                  setCurrentPracticeId(id);
                  safeJSONSet('footballCurrentPracticeId', id);
                }}
                onOpenNewPracticeModal={handleOpenNewPracticeModal}
                onEditPracticeDetails={handleEditPracticeDetails}
                onAutoNumberPractices={handleAutoNumberPractices}
                onDeletePractice={handleDeletePractice}
                onApplyTemplate={handleApplyPracticeTemplate}
                onSaveCurrentAsTemplate={handleSaveCurrentAsTemplate}
                onOpenTemplatesModal={() => setIsTemplatesModalOpen(true)}
                onUpdatePrintFontSize={(size) => {
                  setPrintFontSize(size);
                  safeJSONSet('footballPrintFontSize', size);
                }}
                onUpdateMeta={handleUpdatePracticeMeta}
                onTogglePracticeCancelled={handleTogglePracticeCancelled}
                onTogglePracticeNonPractice={handleTogglePracticeNonPractice}
                onAddPeriod={handleAddPeriod}
                onRemovePeriod={handleRemovePeriod}
                onMovePeriod={handleMovePeriod}
                onUpdatePeriodTime={handleUpdatePeriodTime}
                onUpdatePeriodCategory={handleUpdatePeriodCategory}
                onUpdatePeriodFormat={handleUpdatePeriodFormat}
                onAddStationToPeriod={handleAddStationToPeriod}
                onRemoveStationFromPeriod={handleRemoveStationFromPeriod}
                onUpdateStation={handleUpdateStation}
                onSelectDrillForStation={handleSelectDrillForStation}
                onAddNewSavedCoach={(name) => handleAddNewSavedCoach(name, activeTeamId)}
                onDeleteSavedCoach={(name) => handleDeleteSavedCoach(name, activeTeamId)}
                onNavigateToSchedule={() => setActiveUnit('schedule')}
                onPracticeWizardGenerate={handlePracticeWizardGenerate}
                onOpenWhiteboardDrill={(drillId, cat) => {
                  navigateToUnit('whiteboard', {
                    drillId,
                    drillCategory: cat as any,
                  });
                }}
                formations={currentFormations}
                depthChart={currentDepthChart}
                activeTeamName={teams.find((t) => t.id === activeTeamId)?.name || 'Football Team'}
              />
            )}

            {/* 8. Staff & User Management */}
            {activeUnit === 'users' && userRole === 'admin' && (
              <StaffManagerView
                staffList={staffList}
                savedCoaches={activeTeamSavedCoaches}
                teamSavedCoaches={teamSavedCoaches}
                userRole={userRole}
                teams={teams}
                activeTeamId={activeTeamId}
                defaultTeamId={defaultTeamId}
                onSelectTeam={setActiveTeamId}
                onSetDefaultTeam={handleSetDefaultTeam}
                onAddTeam={handleAddTeam}
                onUpdateTeam={handleUpdateTeam}
                onDeleteTeam={handleDeleteTeam}
                onAddStaffCoach={handleAddStaffCoach}
                onUpdateStaffRole={(idx, role) => {
                  setStaffList((prev) => {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], role };
                    safeJSONSet('footballTeamCoaches', updated);
                    return updated;
                  });
                }}
                onToggleStaffApproval={(idx) => {
                  setStaffList((prev) => {
                    const updated = [...prev];
                    const target = updated[idx];
                    if (!target) return prev;
                    const newStatus = target.status === 'Active' ? 'Pending' : 'Active';
                    updated[idx] = {
                      ...target,
                      status: newStatus,
                    };
                    safeJSONSet('footballTeamCoaches', updated);
                    latestStateRef.current.staffList = updated;
                    const { db } = getFirebaseServices();
                    if (db) {
                      db.collection('teamData')
                        .doc('depthChartData')
                        .set({ staffList: updated, updatedAt: Date.now() }, { merge: true })
                        .catch((err: any) => console.warn('Firestore toggle staff sync error:', err));
                    }
                    return updated;
                  });
                }}
                onRemoveStaffCoach={(idx) => {
                  const targetCoach = staffList[idx];
                  if (
                    idx === 0 &&
                    targetCoach.role.toLowerCase().includes('head coach')
                  ) {
                    alert('Cannot remove the primary Head Coach / Master Admin.');
                    return;
                  }
                  if (confirm(`Remove ${targetCoach.email}? This will revoke their access to the site.`)) {
                    setStaffList((prev) => {
                      const updated = prev.filter((_, i) => i !== idx);
                      safeJSONSet('footballTeamCoaches', updated);
                      latestStateRef.current.staffList = updated;
                      const { db } = getFirebaseServices();
                      if (db) {
                        db.collection('teamData')
                          .doc('depthChartData')
                          .set({ staffList: updated, updatedAt: Date.now() }, { merge: true })
                          .catch((err: any) => console.warn('Firestore remove staff sync error:', err));
                      }
                      return updated;
                    });
                  }
                }}
                onUpdateStaffAssignedTeams={handleUpdateStaffAssignedTeams}
                onUpdateStaffPreferences={handleUpdateStaffPreferences}
                currentUserEmail={currentUser?.email || 'admin@coachportal.local'}
                adminPasscodeSet={adminPasscodeSet}
                onUpdateAdminPasscode={handleSetAdminPasscode}
                onAddNewSavedCoach={handleAddNewSavedCoach}
                onDeleteSavedCoach={handleDeleteSavedCoach}
                onCopyCoachesFromTeam={handleCopyCoachesFromTeam}
              />
            )}

            {/* 9. Season Schedule & Games Hub */}
            {activeUnit === 'schedule' && (
              <ScheduleView
                scheduleEvents={activeTeamScheduleEvents}
                userRole={userRole}
                currentWeek={currentWeek}
                activeTeam={currentActiveTeam}
                practicePlans={practiceData}
                weeklyData={weeklyData}
                practiceTemplates={practiceTemplates}
                seasonConfig={seasonConfig}
                onOpenSeasonConfigModal={() => setIsSeasonConfigModalOpen(true)}
                onAddEvent={handleAddScheduleEvent}
                onUpdateEvent={handleUpdateScheduleEvent}
                onDeleteEvent={handleDeleteScheduleEvent}
                onBulkAddEvents={handleBulkAddScheduleEvents}
                onPracticeWizardGenerate={handlePracticeWizardGenerate}
                onSyncGameToWeeklyData={handleSyncGameToWeeklyData}
                onSyncPracticeToPlan={handleSyncPracticeToPlan}
                onNavigateToWeek={handleNavigateToWeek}
                onImportTeamSnapEvents={handleImportTeamSnapScheduleEvents}
                onUpdateTeam={handleUpdateTeam}
              />
            )}

            {/* 10. Practice Hours & Acclimatization Compliance */}
            {activeUnit === 'compliance' && (
              <PlayerHoursTracker
                roster={activeTeamRoster}
                userRole={userRole}
                currentWeek={currentWeek}
                scheduleEvents={activeTeamScheduleEvents}
                seasonConfig={seasonConfig}
                attendanceLogs={attendanceLogs}
                initialOpenTakeAttendance={autoOpenTakeAttendance}
                onClearInitialOpenTakeAttendance={() => setAutoOpenTakeAttendance(false)}
                onUpdatePlayer={handleUpdatePlayerInRoster}
                onUpdateRoster={handleUpdateRoster}
                onAddScheduleEvent={handleAddScheduleEvent}
                onUpdateScheduleEvent={(event) => handleUpdateScheduleEvent(event.id, event)}
                onDeleteScheduleEvent={handleDeleteScheduleEvent}
                onOpenAddPlayerModal={() => {
                  setEditingPlayerForModal(null);
                  setIsRosterModalOpen(true);
                }}
                onOpenEditPlayerModal={(player) => {
                  setEditingPlayerForModal(player);
                  setIsRosterModalOpen(true);
                }}
                onOpenRosterManager={() => setIsRosterModalOpen(true)}
                onUpdateSeasonConfig={(cfg) => {
                  setSeasonConfig(cfg);
                  safeJSONSet('footballSeasonConfig', cfg);
                }}
                onUpdateAttendanceLogs={(logs) => {
                  setAttendanceLogs(logs);
                  safeJSONSet('footballAttendanceLogs', logs);
                }}
              />
            )}
          </div>

          {/* Master Roster Sidebar (Shown on Depth Charts and Scrimmage) */}
          {!['home', 'mobile_hub', 'game_day', 'wristband', 'drills', 'scouting', 'guide', 'practice', 'users', 'schedule', 'compliance', 'call_sheet', 'whiteboard', 'ppr'].includes(
            activeUnit
          ) && (
            <RosterSidebar
              roster={activeTeamRoster}
              activeTeamName={currentActiveTeam.name}
              totalProgramPlayers={roster.length}
              onCopyFromMainTeam={() => {
                const sourceTeam = teams.find((t) => (t.id === 'team_10u' || t.id === 'team-10u')) || teams[0];
                if (!sourceTeam) return;
                const sourcePlayers = roster.filter(
                  (p) => (p.teamId || teams[0]?.id) === sourceTeam.id ||
                         (p.teamId === 'team_10u' && sourceTeam.id === 'team-10u') ||
                         (p.teamId === 'team-10u' && sourceTeam.id === 'team_10u')
                );
                if (sourcePlayers.length === 0) return;
                const cloned = sourcePlayers.map((p) => ({
                  ...p,
                  teamId: activeTeamId,
                }));
                const otherPlayers = roster.filter((p) => (p.teamId || teams[0]?.id) !== activeTeamId);
                const merged = [...otherPlayers, ...cloned];
                handleUpdateRoster(merged);
              }}
              onRestoreDefaultRoster={() => {
                handleUpdateRoster(MASTER_ROSTER);
              }}
              searchTerm={rosterSearchTerm}
              onSearchChange={setRosterSearchTerm}
              activeUnit={activeUnit}
              selectedFormationId={selectedFormationId}
              currentWeekState={currentWeekState}
              userRole={userRole}
              playLibrary={masterPlayLibrary}
              playSearchTerm={playSearchTerm}
              onPlaySearchChange={setPlaySearchTerm}
              onDragStartPlayer={handleDragStartRosterPlayer}
              onDragStartPlay={(e, play) => {
                e.dataTransfer.setData('text/plain', play);
              }}
              onOpenRosterManager={() => setIsRosterModalOpen(true)}
              onOpenExcelPlayImport={() => setIsExcelPlayImportModalOpen(true)}
              onSelectPlayerForEdit={(p) => {
                setEditingPlayerForModal(p);
                setIsRosterModalOpen(true);
              }}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Quick Launch Dock (Phone Viewports) */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl print:hidden">
        <button
          type="button"
          onClick={() => setActiveUnit('mobile_hub')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            activeUnit === 'mobile_hub' ? 'text-indigo-400 font-black' : 'text-slate-400 font-semibold'
          }`}
        >
          <Smartphone className="w-5 h-5" />
          <span className="text-[10px]">Hub</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const target = depthSubUnit || 'offense';
            setDepthSubUnit(target);
            setActiveUnit(target);
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            ['offense', 'defense', 'st', 'groups', 'scrimmage', 'depth_chart'].includes(activeUnit)
              ? 'text-indigo-400 font-black'
              : 'text-slate-400 font-semibold'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">Depth</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveUnit('game_day')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            ['game_day', 'wristband', 'call_sheet', 'scouting', 'tendencies', 'html_tendencies'].includes(activeUnit)
              ? 'text-red-400 font-black'
              : 'text-slate-400 font-semibold'
          }`}
        >
          <Swords className="w-5 h-5" />
          <span className="text-[10px]">Game Day</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveUnit('whiteboard')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            activeUnit === 'whiteboard' || activeUnit === 'drills'
              ? 'text-emerald-400 font-black'
              : 'text-slate-400 font-semibold'
          }`}
        >
          <PenTool className="w-5 h-5" />
          <span className="text-[10px]">Drills</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsMobileNavOpen(true);
            try {
              window.history.pushState(
                { modal: 'mobile_nav', unit: activeUnit },
                '',
                window.location.hash
              );
              modalOpenInHistoryRef.current = 'mobile_nav';
            } catch (e) {
              // ignore
            }
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
            isMobileNavOpen ? 'text-indigo-400 font-black' : 'text-slate-400 font-semibold'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">All Views</span>
        </button>
      </nav>
      </div>

      {/* Full Mobile Navigation Sheet Modal */}
      <MobileNavigationModal
        isOpen={isMobileNavOpen}
        onClose={() => {
          setIsMobileNavOpen(false);
          if (modalOpenInHistoryRef.current === 'mobile_nav') {
            modalOpenInHistoryRef.current = null;
            window.history.back();
          }
        }}
        activeUnit={activeUnit}
        depthSubUnit={depthSubUnit}
        onSelectUnit={(unit, subUnit) => {
          if (modalOpenInHistoryRef.current === 'mobile_nav') {
            modalOpenInHistoryRef.current = null;
            if (subUnit) {
              navigateToUnit(subUnit, { subUnit, replace: true });
            } else if (unit === 'depth_chart') {
              const target = depthSubUnit || 'offense';
              navigateToUnit(target, { subUnit: target, replace: true });
            } else {
              navigateToUnit(unit, { replace: true });
            }
          } else {
            if (subUnit) {
              navigateToUnit(subUnit, { subUnit });
            } else if (unit === 'depth_chart') {
              const target = depthSubUnit || 'offense';
              navigateToUnit(target, { subUnit: target });
            } else {
              navigateToUnit(unit);
            }
          }
          setIsMobileNavOpen(false);
        }}
        userRole={userRole}
        activeTeamName={currentActiveTeam?.name || 'Mahopac 10U'}
        onOpenPreferencesModal={() => setIsPreferencesModalOpen(true)}
      />

      {/* Global Dialog Modals */}
      <CopyWeekModal
        isOpen={isCopyWeekModalOpen}
        currentWeek={currentWeek}
        activeTeamId={activeTeamId}
        teams={teams}
        seasonConfig={seasonConfig}
        scheduleEvents={scheduleEvents}
        weeklyData={weeklyData}
        resolveWeekStateFn={resolveWeekState}
        onClose={() => setIsCopyWeekModalOpen(false)}
        onExecuteCopy={handleExecuteCopyWeek}
      />

      {selectivePrintUnit && (
        <SelectivePrintModal
          isOpen={Boolean(selectivePrintUnit)}
          unit={selectivePrintUnit}
          formations={currentFormations}
          onClose={() => setSelectivePrintUnit(null)}
          onPrintSelected={(selectedIds) => {
            // Close the modal dialog first so backdrop or dialog traps do not block the print spooler
            setSelectivePrintUnit(null);

            triggerPrint({
              orientation: 'landscape',
              bodyClasses: ['is-printing-formations'],
              documentTitle: `${currentActiveTeam ? `${currentActiveTeam.name.toUpperCase()}_` : ''}${selectivePrintUnit.toUpperCase()}_FORMATION_DEPTH_CHARTS`,
              beforePrint: () => {
                document
                  .querySelectorAll('.formation-container')
                  .forEach((card: any) => {
                    const fId = card.getAttribute('data-form-id');
                    if (fId && !selectedIds.includes(fId)) {
                      card.classList.add('hidden-print');
                    } else {
                      card.classList.remove('hidden-print');
                    }
                  });
              },
              afterPrint: () => {
                document
                  .querySelectorAll('.formation-container')
                  .forEach((card: any) => {
                    card.classList.remove('hidden-print');
                  });
              },
            });
          }}
        />
      )}

      <ScrimmageFilterModal
        isOpen={isScrimmageFilterOpen}
        formations={currentFormations}
        currentFilters={scrimmageFilters}
        onClose={() => setIsScrimmageFilterOpen(false)}
        onSaveFilters={(selectedIds) => {
          setScrimmageFilters(selectedIds);
          safeJSONSet('footballScrimmageFilters', selectedIds);
        }}
      />

      <TemplatesManagerModal
        isOpen={isTemplatesModalOpen}
        templates={practiceTemplates}
        onClose={() => setIsTemplatesModalOpen(false)}
        onRenameTemplate={(oldName, newName) => {
          setPracticeTemplates((prev) => {
            const updated = { ...prev };
            updated[newName] = updated[oldName];
            delete updated[oldName];
            safeJSONSet('footballPracticeTemplates', updated);
            latestStateRef.current.practiceTemplates = updated;
            debouncedSave('practice');
            const { db } = getFirebaseServices();
            if (db) {
              db.collection('teamData')
                .doc('depthChartData')
                .set({ practiceTemplates: updated, updatedAt: Date.now() }, { merge: true })
                .catch((err: any) => console.warn('Firestore template rename error:', err));
            }
            return updated;
          });
        }}
        onDeleteTemplate={(name) => {
          setPracticeTemplates((prev) => {
            const updated = { ...prev };
            delete updated[name];
            safeJSONSet('footballPracticeTemplates', updated);
            latestStateRef.current.practiceTemplates = updated;
            debouncedSave('practice');
            const { db } = getFirebaseServices();
            if (db) {
              db.collection('teamData')
                .doc('depthChartData')
                .set({ practiceTemplates: updated, updatedAt: Date.now() }, { merge: true })
                .catch((err: any) => console.warn('Firestore template delete error:', err));
            }
            return updated;
          });
        }}
        onSaveNewTemplate={(name) => {
          handleSaveCurrentAsTemplate(name);
        }}
      />

      <ImportBackupModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onApplySelectiveImport={(parsedData, selectedOptions) =>
          applyImportDataObject(parsedData, selectedOptions)
        }
      />

      <RosterManagerModal
        isOpen={isRosterModalOpen}
        onClose={() => {
          setIsRosterModalOpen(false);
          setEditingPlayerForModal(null);
        }}
        roster={roster}
        onUpdateRoster={handleUpdateRoster}
        userRole={userRole}
        editingPlayer={editingPlayerForModal}
        onClearEditingPlayer={() => setEditingPlayerForModal(null)}
        teams={teams}
        activeTeamId={activeTeamId}
        formations={currentFormations}
        depthChart={currentDepthChart}
      />

      <PreferencesModal
        isOpen={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
        teams={teams}
        activeTeamId={activeTeamId}
        defaultTeamId={defaultTeamId}
        onSetDefaultTeam={handleSetDefaultTeam}
        activeUnit={activeUnit}
        defaultScreen={defaultScreen}
        defaultDepthSubUnit={defaultDepthSubUnit}
        onSetDefaultScreen={handleSetDefaultScreen}
        userRole={userRole}
        currentUserEmail={currentUser?.email || 'admin@coachportal.local'}
        onOpenThemeGallery={() => setIsThemeGalleryOpen(true)}
        onOpenSeasonConfigModal={() => setIsSeasonConfigModalOpen(true)}
        onOpenManageTeams={() => setActiveUnit('users')}
        onOpenCopyWeekModal={() => setIsCopyWeekModalOpen(true)}
        onExportData={handleExportFullBackup}
        onImportClick={() => setIsImportModalOpen(true)}
        onResetData={handleResetData}
        onForceSave={handleForceSave}
        onForceRefresh={handleForceRefresh}
        themeMode={themeMode}
        onToggleThemeMode={handleToggleThemeMode}
        idleTimeoutMinutes={getActiveUserIdleTimeoutMinutes()}
        onUpdateIdleTimeout={handleUpdateActiveUserIdleTimeout}
      />

      <ThemeGalleryModal
        isOpen={isThemeGalleryOpen}
        onClose={() => setIsThemeGalleryOpen(false)}
        selectedThemeId={activeThemeId}
        onSelectTheme={(id) => {
          setActiveThemeId(id);
          safeJSONSet('footballActiveThemeId', id);
        }}
        themeMode={themeMode}
        onToggleThemeMode={handleToggleThemeMode}
      />

      <SeasonConfigModal
        isOpen={isSeasonConfigModalOpen}
        onClose={() => setIsSeasonConfigModalOpen(false)}
        seasonConfig={seasonConfig}
        onSaveSeasonConfig={(newCfg) => {
          setSeasonConfig(newCfg);
          safeJSONSet('footballSeasonConfig', newCfg);
        }}
        scheduleEvents={scheduleEvents}
        activeTeamId={activeTeamId}
        teams={teams}
      />

      {/* Global Excel Play Library Import Modal */}
      <ExcelPlayImportModal
        isOpen={isExcelPlayImportModalOpen}
        onClose={() => setIsExcelPlayImportModalOpen(false)}
        defaultUnit="offense"
        existingPlaysCount={masterPlayLibrary.length}
        onImportPlays={handleGlobalImportPlays}
      />

      {/* Active Coaches Live Presence Modal */}
      <ActiveCoachesModal
        isOpen={isActiveCoachesModalOpen}
        onClose={() => setIsActiveCoachesModalOpen(false)}
        activeUsers={activeUsers}
        currentUserEmail={currentUser?.email}
        activeLocks={activeLocks}
        teamNameMap={teams.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {})}
        onRefresh={async () => {
          const fresh = await fetchActiveUsers();
          if (Array.isArray(fresh)) setActiveUsers(fresh);
        }}
      />

      {/* Configurable Idle Inactivity Timeout Modal */}
      <IdleTimeoutModal
        isOpen={isIdleTimedOut}
        timeoutMinutes={getActiveUserIdleTimeoutMinutes()}
        onLogInAgain={() => {
          setIsIdleTimedOut(false);
          lastUserActivityTimeRef.current = Date.now();
          isUserIdleRef.current = false;
          setIsAuthModalOpen(true);
        }}
      />
    </div>
  );
}
