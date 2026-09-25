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
  saveHudlScoutCloud,
  fetchHudlScoutCloud,
  saveSharedBoardCloud,
  patchSharedWeekCloud,
  isBoardPatchScope,
  fetchSharedBoardCloud,
  subscribeSharedBoardCloud,
  isFirestoreQuotaPaused,
  noteFirestoreError,
  cloudModulesForScope,
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
  mergePracticeTemplates,
  practiceTemplatesFingerprint,
  normalizeCascadingDrills,
  CLIENT_ID,
  parseTimeString,
  formatTimeMinutes,
} from './services/storageService';
import type { SharedBoardCloudUpdate } from './services/storageService';
import {
  calculateWeekFolderForDate,
  getDayOfWeekForDate,
  getFormattedDayFolder,
  sanitizePracticePlans,
  findBestActivePracticeId,
  getLocalDateKey,
  shouldSwitchToSharedTodayPlan,
  normalizePracticeWeekdayTemplates,
  mergePracticeWeekdayTemplates,
  resolvePracticeTemplateForWeekday,
  PRACTICE_WEEKDAY_NAMES,
  shouldApplyWeekdayTemplateToPlan,
  practiceSeasonYear,
  practiceWeekdayName,
  getPlanPeriods,
} from './utils/practiceUtils';
import type { PracticeWeekdayTemplateMap } from './utils/practiceUtils';
import { getAutoActiveWeek, normalizeWeeklyData, extractBackupFormations, normalizeFormationUnit, getSeasonWeekList, isDroppedFormation, getPriorSeasonWeekKey, formatWeekCopyLabel, getScopedWeekKey } from './utils/seasonWeekUtils';
import { getPreviousWeekKey, mergePffGradeCriteria, PffPlayerGroupOverrides } from './utils/pprGroups';
import { hydrateFilmSession } from './utils/hudlFilmImport';
import { normalizeRoster, getUnitPositionIds } from './utils/depthChartUtils';
import { triggerPrint } from './utils/printUtils';
import { isEventAlreadyInSchedule } from './utils/teamSnapSync';
import { VALID_UNITS, parseRouteHash, buildRouteHash, checkIsLiveEnvironment } from './utils/routeUtils';
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
import { WristbandView } from './components/WristbandView';
import { getBestWristbandData, mergeRichestWristbandData, pickNewestWristbandData, normalizeWristbandContinuousNumbering, wristbandHasPlays } from './utils/wristbandNormalize';
import { CallSheetMainView } from './components/CallSheetMainView';
import { GameDayHubView } from './components/GameDayHubView';
import { USER_IMPORTED_GAME_DAY_PLAYS, INITIAL_TWO_WRISTBANDS_DATA } from './data/userGameDayPlays';
import { ExcelPlayImportModal } from './components/callSheet/ExcelPlayImportModal';
import { PlayDatabaseEntry, CallSheetData, CallSheetFullData } from './types/callSheet';
import { MASTER_PLAY_DATABASE, DEFAULT_CALL_SHEET_DATA } from './data/callSheetData';
import { syncWristbandToCallSheet } from './utils/wristbandLinking';
import { saveCallSheetSnapshot, countCallSheetPlays } from './utils/callSheetStorage';
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
import { ThemeGalleryModal } from './components/ThemeGalleryModal';
import { useThemePreferences } from './hooks/useThemePreferences';
import type { LatestAppState } from './hooks/appStateTypes';
import {
  mergeDeletedFormationIds,
  mergeFilmSession,
  mergePffCriteriaMaps,
  mergePffPlayerGroups,
  mergePffReviews,
  mergePracticePlansByLastEdited,
  mergeRemoteWeeklyData,
  mergeStaffByEmail,
  mergeOwnTeamHudlMap,
  collectOwnTeamHudlFromWeekly,
  collectHudlScoutBackup,
  applyHudlScoutBackup,
  mergeScheduleEvents,
  mergeDeletedIds,
  applySharedWeekSliceDepth,
  applySharedFormations,
  applyFormationBoardPatches,
  reorderFormationsInUnit,
  mergeScoutingReports,
  normalizeScoutWeekKey,
  pickScoutBundle,
  pickRichestScouting,
  scoutFingerprint,
  shouldKeepLocalCallSheet,
  savedForTeamWeek,
  shouldRejectStaleRemote,
} from './utils/remoteStateMerge';
import { applyCopiedFormationsToDeletedIds, copyWeekCharts, countPlacedPlayers } from './utils/copyWeek';
import { findFolderByPath } from './utils/drillPlanLinking';
import {
  loadLiveDrillSlotLayouts,
  mergeLiveDrillSlotLayouts,
  mergePracticeDrillGroups,
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
import { usePlaybookGuideActions } from './hooks/usePlaybookGuideActions';
import { useDrillLibraryActions } from './hooks/useDrillLibraryActions';
import { useFormationActions } from './hooks/useFormationActions';
import { useDepthChartDragDrop } from './hooks/useDepthChartDragDrop';
import { useAdminSignIn } from './hooks/useAdminSignIn';
import { useGameDayActions } from './hooks/useGameDayActions';
import { useScheduleActions } from './hooks/useScheduleActions';
import { useRosterActions } from './hooks/useRosterActions';
import { usePracticePlanActions } from './hooks/usePracticePlanActions';

export default function App() {
  // State Initialization from LocalStorage or Defaults
  const [weeklyData, setWeeklyData] = useState<Record<string, WeekState>>(() => {
    const raw = safeJSONParse('footballWeeklyData', {});
    const savedDefaults = safeJSONParse('footballDefaultFormations', INITIAL_DEFAULT_FORMATIONS);
    const normalized = normalizeWeeklyData(
      raw,
      Array.isArray(savedDefaults) && savedDefaults.length ? savedDefaults : INITIAL_DEFAULT_FORMATIONS
    );
    // Sanitize any existing form_10_spread or 10 Spread Offense entries
    for (const w of Object.values(normalized)) {
      if (w && Array.isArray(w.formations)) {
        w.formations = w.formations.filter(
          (f) => f && !isDroppedFormation(f)
        );
      }
    }
    return normalized;
  });
  const [ownTeamHudlScout, setOwnTeamHudlScout] = useState<Record<string, any>>(() => {
    const disk = safeJSONParse<Record<string, any>>('footballOwnTeamHudlScout', {}) || {};
    const weekly = safeJSONParse<Record<string, any>>('footballWeeklyData', {}) || {};
    const fromWeeks = collectOwnTeamHudlFromWeekly(weekly);
    const out: Record<string, any> = { ...disk };
    for (const [teamId, bundle] of Object.entries(fromWeeks)) {
      const local = disk[teamId];
      const localPlays = Array.isArray(local?.plays) ? local.plays.length : 0;
      if (local?.sourceCleared || localPlays > 0) continue;
      out[teamId] = bundle;
    }
    return out;
  });
  const [defaultFormations, setDefaultFormations] = useState<FormationBoard[]>(() => {
    const raw = safeJSONParse('footballDefaultFormations', INITIAL_DEFAULT_FORMATIONS);
    const forms = Array.isArray(raw) ? raw : INITIAL_DEFAULT_FORMATIONS;
    return forms.filter((f: any) => f && !isDroppedFormation(f));
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
  const [practiceWeekdayTemplates, setPracticeWeekdayTemplates] = useState<PracticeWeekdayTemplateMap>(
    () => normalizePracticeWeekdayTemplates(safeJSONParse('footballPracticeWeekdayTemplates', {}))
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
    if (!sanitized.includes('form_base_def')) {
      sanitized.push('form_base_def');
    }
    safeJSONSet('footballDeletedFormationIds', sanitized);
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
  // Ids of schedule events a coach deleted, shared so other copies don't re-add them.
  const [deletedScheduleEventIds, setDeletedScheduleEventIds] = useState<string[]>(() => {
    const saved = safeJSONParse('footballDeletedScheduleEventIds', null);
    return saved && Array.isArray(saved) ? saved : [];
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

    // The last sheet this device showed wins; backups and history are only a fallback
    // (they are recovery copies, and picking them by timestamp could revert a newer sheet).
    if (candidates[0] && candidates[0] === saved) return saved as CallSheetData;

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
  const { activeThemeId, selectTheme, themeMode, handleToggleThemeMode } = useThemePreferences(currentUser);
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
    debouncedSave('plays');
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
  const pendingScoutingSaveRef = useRef<boolean>(false);
  const pendingScheduleSaveRef = useRef<boolean>(false);
  const isImportingRef = useRef<boolean>(false);
  const isRemoteSyncRef = useRef<boolean>(false);
  const remoteSyncGenRef = useRef(0);
  const pendingSaveRef = useRef<{ scope: string; extraMeta?: Record<string, any> } | null>(null);
  const lastAppliedOpsAtRef = useRef<Record<string, number>>({});
  const lastWeekPatchSigRef = useRef('');
  const lastSavedPayloadRef = useRef<string>('');
  const localServerVersionRef = useRef<number>(0);
  const localServerUpdatedAtRef = useRef<number>(0);
  const lastLocalEditTimeRef = useRef<number>(
    typeof window !== 'undefined' ? safeJSONParse('footballLastLocalEditTime', 0) : 0
  );
  const lastLocalCallSheetEditTimeRef = useRef<number>(0);
  const lastLocalWristbandEditTimeRef = useRef<number>(0);
  const effectiveWristbandRef = useRef<WristbandData | null>(null);
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
  const recentlyModifiedFormationsRef = useRef<Map<string, number>>(
    new Map(
      typeof window !== 'undefined'
        ? (safeJSONParse('footballRecentlyModifiedFormations', []) || [])
        : []
    )
  );

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
    const sameWeek = wk === currentWeekRef.current;
    setCurrentWeek(wk);
    currentWeekRef.current = wk;
    safeJSONSet('footballCurrentWeek', wk);
    // Re-picking the week already shown must not swap in older stored copies.
    if (sameWeek) return;
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
    // Show this week's call sheet; if the week has none yet, every coach sees the same
    // starting point: the nearest earlier week that has one (not whatever was on screen).
    const weekOrder = getSeasonWeekList(seasonConfig).map((w) => w.key);
    const startIdx = weekOrder.indexOf(wk);
    const candidateWeeks = startIdx >= 0 ? weekOrder.slice(0, startIdx + 1).reverse() : [wk];
    const weekCopies = { ...weeklyData, ...latestStateRef.current.weeklyData };
    const storedForWeek = (key: string) =>
      (weekCopies[getScopedWeekKey(activeTeamIdRef.current, key)] || weekCopies[key])?.callSheetData;
    // The sheet on screen may be a newer save for the target week than its stored copy.
    const onScreen = latestStateRef.current.callSheetData;
    const ownCopy = storedForWeek(wk);
    const onScreenIsNewer =
      onScreen?.week &&
      savedForTeamWeek(onScreen, activeTeamIdRef.current, wk) &&
      countCallSheetPlays(onScreen) > 0 &&
      (Number(onScreen.lastEdited) || 0) >= (Number(ownCopy?.lastEdited) || 0);
    const sourceCs = onScreenIsNewer
      ? onScreen
      : candidateWeeks.map(storedForWeek).find((cs) => cs && countCallSheetPlays(cs) > 0);
    const weekWb =
      latestStateRef.current.wristbandData ||
      targetWeekState?.wristbandData ||
      INITIAL_TWO_WRISTBANDS_DATA;
    const baseCs = sourceCs || DEFAULT_CALL_SHEET_DATA;
    const syncedCs = syncWristbandToCallSheet(weekWb, baseCs, latestStateRef.current.playDatabase);
    setCallSheetData(syncedCs);
    latestStateRef.current.callSheetData = syncedCs;
    safeJSONSet('footballCallSheetData', syncedCs);
  };

  activeUnitRef.current = activeUnit;
  activeTeamIdRef.current = activeTeamId;
  currentWeekRef.current = currentWeek;
  currentPracticeIdRef.current = currentPracticeId;

  const latestStateRef = useRef<LatestAppState>({
    weeklyData,
    ownTeamHudlScout,
    defaultFormations,
    practiceData,
    practiceTemplates,
    practiceWeekdayTemplates,
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
    deletedScheduleEventIds,
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
      ownTeamHudlScout,
      defaultFormations,
      practiceData,
      practiceTemplates,
      practiceWeekdayTemplates,
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
      deletedScheduleEventIds,
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

  // Show another coach's call sheet and keep this week's stored copy in step with it,
  // so switching weeks and back cannot bring an older copy onto the screen.
  const adoptCallSheet = (incoming: CallSheetFullData) => {
    const wb =
      pickNewestWristbandData(latestStateRef.current.wristbandData, effectiveWristbandRef.current) ||
      latestStateRef.current.wristbandData ||
      effectiveWristbandRef.current;
    const cs = wb ? syncWristbandToCallSheet(wb, incoming, latestStateRef.current.playDatabase) : incoming;
    setCallSheetData(cs);
    latestStateRef.current.callSheetData = cs;
    safeJSONSet('footballCallSheetData', cs);
    const teamId = activeTeamIdRef.current;
    const wk = currentWeekRef.current;
    setWeeklyData((prev) => {
      const scoped = getScopedWeekKey(teamId, wk);
      const cur = prev[scoped] || prev[wk];
      if (!cur || cur.callSheetData === cs) return prev;
      const updatedWeek = { ...cur, callSheetData: cs };
      const next = { ...prev, [scoped]: updatedWeek, [wk]: updatedWeek };
      latestStateRef.current.weeklyData = next;
      safeJSONSet('footballWeeklyData', next);
      return next;
    });
  };

  // Fold schedule deletions from another device into ours and return the full list,
  // so merges below can drop those events instead of re-adding them.
  const absorbDeletedScheduleEventIds = (incoming: unknown): string[] => {
    const current = latestStateRef.current.deletedScheduleEventIds || [];
    const merged = mergeDeletedIds(current, incoming);
    if (merged.length !== current.length) {
      latestStateRef.current.deletedScheduleEventIds = merged;
      setDeletedScheduleEventIds(merged);
      safeJSONSet('footballDeletedScheduleEventIds', merged);
    }
    return merged;
  };

  // Determine current active depth chart unit
  const depthSubUnitRef = useRef<string>(depthSubUnit);
  depthSubUnitRef.current = depthSubUnit;

  const currentDepthUnit =
    activeUnit === 'depth_chart'
      ? (depthSubUnit === 'scrimmage' ? 'offense' : (depthSubUnit || 'offense'))
      : (['offense', 'defense', 'st', 'groups', 'practice_live', 'scrimmage'].includes(activeUnit)
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
    curDeletedSet.add('form_base_def');

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
      if (!f || !f.id || curDeletedSet.has(f.id) || isDroppedFormation(f)) continue;
      if (seenFormIds.has(f.id)) continue;
      seenFormIds.add(f.id);
      formations.push(f);
    }

    // Ensure every week has core units (Offense, Defense, ST, Groups) populated
    for (const u of ['offense', 'defense', 'st', 'groups'] as const) {
      if (!formations.some((f) => f && f.unit === u)) {
        let defsForUnit = (defaultFormations || []).filter(
          (f) => f && f.unit === u && !curDeletedSet.has(f.id) && !isDroppedFormation(f)
        );
        if (defsForUnit.length === 0) {
          defsForUnit = INITIAL_DEFAULT_FORMATIONS.filter(
            (f) => f && f.unit === u && !isDroppedFormation(f)
          );
        }
        for (const df of defsForUnit) {
          if (!seenFormIds.has(df.id) && !isDroppedFormation(df)) {
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
        pickNewestWristbandData(
          scopedState?.wristbandData,
          is10U ? legacyState?.wristbandData : undefined,
          is10U ? defScopedState?.wristbandData : undefined
        ) || INITIAL_TWO_WRISTBANDS_DATA,
      scouting:
        pickRichestScouting(scopedState?.scouting, legacyState?.scouting, defScopedState?.scouting) ||
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

  const storedWeekForWrite = (
    wData: Record<string, WeekState>,
    teamId: string,
    week: string
  ): WeekState => {
    const scopedKey = getScopedWeekKey(teamId, week);
    const scoped = wData[scopedKey];
    const legacy = wData[week];
    const resolved = resolveWeekState(wData, teamId, week);
    const hasBoards = (s?: WeekState) =>
      Array.isArray(s?.formations) && s.formations.some((f) => f && f.id);
    const base = hasBoards(scoped) ? scoped! : hasBoards(legacy) ? legacy! : resolved;
    return {
      ...resolved,
      ...base,
      formations: hasBoards(base)
        ? base.formations.filter((f) => f && f.id)
        : resolved.formations,
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
          mergeRichestWristbandData(
            currentResolved.wristbandData,
            safeJSONParse<WristbandData | null>('footballWristbandData', null)
          ) || INITIAL_TWO_WRISTBANDS_DATA,
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

    const isFirestoreDoc = source.startsWith('firestore');
    // Localhost /api/state timestamps are not comparable to Firestore or the other device.
    if (!isFirestoreDoc && shouldRejectStaleRemote(remoteTimestamp, localServerUpdatedAtRef.current)) {
      return;
    }

    if (!isFirestoreDoc) {
      if (typeof version === 'number' && version > localServerVersionRef.current) {
        localServerVersionRef.current = version;
      }
      if (remoteTimestamp > localServerUpdatedAtRef.current) {
        localServerUpdatedAtRef.current = remoteTimestamp;
      }
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

    const skipBoardFromGiantDoc = source === 'firestore_snapshot';

    if (!skipBoardFromGiantDoc && data.weeklyData && Object.keys(data.weeklyData).length > 0) {
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
        applySharedFormations(
          latestStateRef.current.defaultFormations,
          data.defaultFormations,
          recentlyModifiedFormationsRef.current,
          lastLocalEditTimeRef.current
        )
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
    if (data.ownTeamHudlScout && typeof data.ownTeamHudlScout === 'object') {
      setOwnTeamHudlScout((prev) => {
        const merged = mergeOwnTeamHudlMap(
          prev && Object.keys(prev).length ? prev : latestStateRef.current.ownTeamHudlScout,
          data.ownTeamHudlScout
        );
        latestStateRef.current.ownTeamHudlScout = merged;
        safeJSONSet('footballOwnTeamHudlScout', merged);
        return merged;
      });
    }
    if (
      !skipBoardFromGiantDoc &&
      data.defaultFormations &&
      Array.isArray(data.defaultFormations) &&
      data.defaultFormations.length > 0
    ) {
      const mergedDefs = applySharedFormations(
        latestStateRef.current.defaultFormations,
        data.defaultFormations.filter(
          (df: any) => df && df.id && !effectiveDeletedFormIds.has(df.id)
        ),
        recentlyModifiedFormationsRef.current,
        lastLocalEditTimeRef.current
      );
      setDefaultFormations(mergedDefs);
      latestStateRef.current.defaultFormations = mergedDefs;
      safeJSONSet('footballDefaultFormations', mergedDefs);
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

    const mergedScheduleEvents = mergeScheduleEvents(
      latestStateRef.current.scheduleEvents,
      Array.isArray(data.scheduleEvents) ? data.scheduleEvents : undefined,
      absorbDeletedScheduleEventIds(data.deletedScheduleEventIds)
    );
    if (!skipBoardFromGiantDoc && data.scheduleEvents && Array.isArray(data.scheduleEvents)) {
      setScheduleEvents(mergedScheduleEvents);
      latestStateRef.current.scheduleEvents = mergedScheduleEvents;
      safeJSONSet('footballScheduleEvents', mergedScheduleEvents);
    }

    if (!skipBoardFromGiantDoc && data.practiceData && Array.isArray(data.practiceData)) {
      const sanitized = sanitizePracticePlans(
        data.practiceData,
        mergedScheduleEvents.length
          ? mergedScheduleEvents
          : data.scheduleEvents || latestStateRef.current.scheduleEvents || DEFAULT_SCHEDULE_EVENTS
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

      const activeId = currentPracticeIdRef.current;
      const switchTo = shouldSwitchToSharedTodayPlan(
        mergedPlans,
        activeId,
        currentWeekRef.current
      );
      const nextId =
        switchTo ||
        (!mergedPlans.some((p) => p && p.id === activeId)
          ? findBestActivePracticeId(mergedPlans, activeId, currentWeekRef.current)
          : null);
      if (nextId && nextId !== activeId) {
        setCurrentPracticeId(nextId);
        currentPracticeIdRef.current = nextId;
        safeJSONSet('footballCurrentPracticeId', nextId);
      }
    }
    if (!skipBoardFromGiantDoc && data.practiceTemplates) {
      const mergedTemplates = mergePracticeTemplates(
        latestStateRef.current.practiceTemplates,
        data.practiceTemplates,
        { lastLocalEditTime: lastLocalEditTimeRef.current }
      );
      if (
        practiceTemplatesFingerprint(mergedTemplates) !==
        practiceTemplatesFingerprint(latestStateRef.current.practiceTemplates)
      ) {
        setPracticeTemplates(mergedTemplates);
        latestStateRef.current.practiceTemplates = mergedTemplates;
        safeJSONSet('footballPracticeTemplates', mergedTemplates);
      }
    }
    if (!skipBoardFromGiantDoc && data.practiceWeekdayTemplates) {
      const mergedDays = mergePracticeWeekdayTemplates(
        latestStateRef.current.practiceWeekdayTemplates,
        data.practiceWeekdayTemplates
      );
      setPracticeWeekdayTemplates(mergedDays);
      latestStateRef.current.practiceWeekdayTemplates = mergedDays;
      safeJSONSet('footballPracticeWeekdayTemplates', mergedDays);
    }
    if (!skipBoardFromGiantDoc && data.cascadingDrills) {
      if (Date.now() - lastLocalEditTimeRef.current < 15000 && activeUnitRef.current === 'drills') {
        // Local coach is actively editing drills, don't overwrite with remote pulse
      } else {
        const normalizedDrills = normalizeCascadingDrills(data.cascadingDrills);
        setCascadingDrills(normalizedDrills);
        latestStateRef.current.cascadingDrills = normalizedDrills;
        safeJSONSet('footballCascadingDrills', normalizedDrills);
      }
    }
    if (!skipBoardFromGiantDoc && data.guideTree) {
      setGuideTree(data.guideTree);
      latestStateRef.current.guideTree = data.guideTree;
      safeJSONSet('footballPdfGuidesTree', data.guideTree);
    }
    if (!skipBoardFromGiantDoc && data.guideOrder) {
      setGuideOrder(data.guideOrder);
      latestStateRef.current.guideOrder = data.guideOrder;
      safeJSONSet('footballPdfGuidesOrder', data.guideOrder);
    }
    if (!skipBoardFromGiantDoc && data.savedCoaches && Array.isArray(data.savedCoaches)) {
      setSavedCoaches(data.savedCoaches);
      latestStateRef.current.savedCoaches = data.savedCoaches;
      safeJSONSet('footballSavedCoaches', data.savedCoaches);
    }
    if (!skipBoardFromGiantDoc && data.teamSavedCoaches && typeof data.teamSavedCoaches === 'object') {
      setTeamSavedCoaches(data.teamSavedCoaches);
      latestStateRef.current.teamSavedCoaches = data.teamSavedCoaches;
      safeJSONSet('footballTeamSavedCoaches', data.teamSavedCoaches);
    }
    if (typeof data.adminPasscodeSet === 'boolean') {
      setAdminPasscodeSet(data.adminPasscodeSet);
      localStorage.setItem('footballAdminPasscodeSet', data.adminPasscodeSet ? 'true' : 'false');
    }
    if (!skipBoardFromGiantDoc && data.staffList && Array.isArray(data.staffList)) {
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
    if (!skipBoardFromGiantDoc && data.masterPlayLibrary) {
      setMasterPlayLibrary(data.masterPlayLibrary);
      latestStateRef.current.masterPlayLibrary = data.masterPlayLibrary;
      safeJSONSet('footballMasterPlays', data.masterPlayLibrary);
    }
    if (!skipBoardFromGiantDoc && data.playDatabase && Array.isArray(data.playDatabase)) {
      if (Date.now() - lastLocalEditTimeRef.current < 15000 && (activeUnitRef.current === 'call_sheet' || activeUnitRef.current === 'wristband')) {
        // Preserving local play database changes during active session
      } else {
        setPlayDatabase(data.playDatabase);
        latestStateRef.current.playDatabase = data.playDatabase;
        safeJSONSet('footballPlayDatabase', data.playDatabase);
      }
    }
    // One call sheet per team and week, newest save wins: adopt another coach's sheet
    // unless it is for a different week or this coach is typing in theirs right now.
    if (!skipBoardFromGiantDoc && data.callSheetData && typeof data.callSheetData === 'object' && (data.callSheetData.offenseSections || data.callSheetData.defenseSections)) {
      const remoteCs = data.callSheetData as CallSheetFullData;
      const localCs = latestStateRef.current.callSheetData || callSheetData;
      const editingNow = Date.now() - lastLocalCallSheetEditTimeRef.current < 25000;
      const remoteLastEdited = Number(remoteCs.lastEdited) || 0;
      const localLastEdited = Number(localCs?.lastEdited) || 0;
      if (
        savedForTeamWeek(remoteCs, activeTeamIdRef.current, currentWeekRef.current) &&
        !editingNow &&
        remoteLastEdited >= localLastEdited
      ) {
        adoptCallSheet(remoteCs);
      }
    }
    const scopedWeekKey = getScopedWeekKey(activeTeamIdRef.current, currentWeekRef.current);
    const weekWbCandidates = [
      data.weeklyData?.[scopedWeekKey]?.wristbandData,
      data.weeklyData?.[currentWeekRef.current]?.wristbandData,
    ].filter((w) => w && Array.isArray(w.wristbands) && w.wristbands.length > 0);

    let candidateWb = weekWbCandidates.length > 0 ? getBestWristbandData(weekWbCandidates) : undefined;
    if (!candidateWb && data.wristbandData && Array.isArray(data.wristbandData.wristbands) && data.wristbandData.wristbands.length > 0 && savedForTeamWeek(data.wristbandData, activeTeamIdRef.current, currentWeekRef.current)) {
      candidateWb = data.wristbandData;
    }

    if (!skipBoardFromGiantDoc && candidateWb) {
      const remoteWbTime = Number(candidateWb.lastEdited) || 0;
      const localWbTime = Number(latestStateRef.current.wristbandData?.lastEdited) || 0;
      const editingNow = Date.now() - lastLocalWristbandEditTimeRef.current < 25000;
      const forThisWeek = savedForTeamWeek(candidateWb, activeTeamIdRef.current, currentWeekRef.current);
      // Newer local lastEdited always wins. A 2s "still typing" window let stale weekly
      // snapshots (and numbering normalize) put old plays back on screen.
      if (forThisWeek && !editingNow && remoteWbTime > localWbTime) {
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
    if (!skipBoardFromGiantDoc && data.deletedPlayIds && Array.isArray(data.deletedPlayIds)) {
      setDeletedPlayIds(data.deletedPlayIds);
      latestStateRef.current.deletedPlayIds = data.deletedPlayIds;
      safeJSONSet('footballDeletedPlayIds', data.deletedPlayIds);
    }
    if (data.collapsedFolders) {
      setCollapsedFolders(data.collapsedFolders);
      latestStateRef.current.collapsedFolders = data.collapsedFolders;
      safeJSONSet('footballCollapsedFolders', data.collapsedFolders);
    }
    if (!skipBoardFromGiantDoc && data.roster && Array.isArray(data.roster)) {
      const normalized = normalizeRoster(data.roster, true);
      setRoster(normalized);
      latestStateRef.current.roster = normalized;
      safeJSONSet('footballRoster', normalized);
    }
    if (!skipBoardFromGiantDoc && data.teams && Array.isArray(data.teams) && data.teams.length > 0) {
      setTeams(data.teams);
      latestStateRef.current.teams = data.teams;
      safeJSONSet('footballTeams', data.teams);
    }
    if (!skipBoardFromGiantDoc && data.seasonConfig) {
      setSeasonConfig(data.seasonConfig);
      latestStateRef.current.seasonConfig = data.seasonConfig;
      safeJSONSet('footballSeasonConfig', data.seasonConfig);
    }
    if (!skipBoardFromGiantDoc && data.attendanceLogs && Array.isArray(data.attendanceLogs)) {
      setAttendanceLogs(data.attendanceLogs);
      latestStateRef.current.attendanceLogs = data.attendanceLogs;
      safeJSONSet('footballAttendanceLogs', data.attendanceLogs);
    }
    if (!skipBoardFromGiantDoc && data.pffGradeCriteria) {
      const mergedCriteria = mergePffGradeCriteria(
        mergePffCriteriaMaps(latestStateRef.current.pffGradeCriteria, data.pffGradeCriteria)
      );
      setPffGradeCriteria(mergedCriteria);
      latestStateRef.current.pffGradeCriteria = mergedCriteria;
      safeJSONSet('footballPffGradeCriteria', mergedCriteria);
    }
    if (!skipBoardFromGiantDoc && data.pffPlayerGroups && typeof data.pffPlayerGroups === 'object') {
      const mergedGroups = mergePffPlayerGroups(
        latestStateRef.current.pffPlayerGroups,
        data.pffPlayerGroups
      ) as PffPlayerGroupOverrides;
      setPffPlayerGroups(mergedGroups);
      latestStateRef.current.pffPlayerGroups = mergedGroups;
      safeJSONSet('footballPffPlayerGroups', mergedGroups);
    }
    if (!skipBoardFromGiantDoc && data.liveDrillSlotLayouts && typeof data.liveDrillSlotLayouts === 'object') {
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
    if (pendingScoutingSaveRef.current) {
      pendingScoutingSaveRef.current = false;
      setTimeout(() => {
        saveStateToStorage('scouting_update', { activeUnit: 'scouting', scope: 'scouting_update' });
      }, 350);
    }
    if (pendingScheduleSaveRef.current) {
      pendingScheduleSaveRef.current = false;
      setTimeout(() => {
        saveStateToStorage('schedule_update', { scope: 'schedule_update' });
      }, 400);
    }

    const gen = ++remoteSyncGenRef.current;
    window.setTimeout(() => {
      if (gen !== remoteSyncGenRef.current) return;
      isRemoteSyncRef.current = false;
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (pending && isBoardPatchScope(pending.scope)) {
        void saveStateToStorage(pending.scope, pending.extraMeta);
      }
    }, 800);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncStatus({ text: `✅ Live Synced (${timeStr})`, color: '#22c55e' });
  };

  // Trigger Save to LocalStorage, Server API & Firestore
  const saveStateToStorage = async (scope: string = 'all', extraMeta?: Record<string, any>) => {
    if (scope === 'focusout') return;
    if (isRemoteSyncRef.current && (scope === 'all' || scope === 'formation')) return;
    const currentState = latestStateRef.current;

    if (isBoardPatchScope(scope)) {
      const weekKey = normalizeScoutWeekKey(currentWeekRef.current);
      const scopedKey = getScopedWeekKey(activeTeamIdRef.current, weekKey);
      const weekState =
        currentState.weeklyData?.[scopedKey] || currentState.weeklyData?.[weekKey];
      const { db } = getFirebaseServices();
      const posIds = (Array.isArray(extraMeta?.modifiedPosIds) ? extraMeta.modifiedPosIds : []).filter(Boolean);
      const formIds = (Array.isArray(extraMeta?.modifiedFormIds) ? extraMeta.modifiedFormIds : []).filter(Boolean);
      if (extraMeta?.formId && !formIds.includes(extraMeta.formId)) formIds.push(extraMeta.formId);
      if (extraMeta?.movedFormationId && !formIds.includes(extraMeta.movedFormationId)) formIds.push(extraMeta.movedFormationId);
      if (extraMeta?.deletedFormationId && !formIds.includes(extraMeta.deletedFormationId)) {
        formIds.push(extraMeta.deletedFormationId);
      }
      const wantsOrder =
        scope === 'move_formation' ||
        scope === 'formation_add' ||
        scope === 'delete_formation' ||
        scope === 'formation_duplicate';
      if (db && (posIds.length || formIds.length || wantsOrder)) {
        const depthSpots: Record<string, any[]> = {};
        const scrimmageSpots: Record<string, any[]> = {};
        const formationBoards: Record<string, any | null> = {};
        const chartKind = extraMeta?.chartKind === 'scrimmage' ? 'scrimmage' : 'depth';
        posIds.forEach((id: string) => {
          if (chartKind === 'scrimmage') scrimmageSpots[id] = weekState?.scrimmageChart?.[id] || [];
          else depthSpots[id] = weekState?.depthChart?.[id] || [];
        });
        formIds.forEach((id: string) => {
          if (scope === 'delete_formation' && extraMeta?.deletedFormationId === id) {
            formationBoards[id] = null;
            return;
          }
          const board = (weekState?.formations || []).find((f: any) => f && f.id === id);
          if (board) formationBoards[id] = board;
        });
        const sharedOk = await patchSharedWeekCloud({
          teamId: activeTeamIdRef.current,
          week: weekKey,
          depthSpots,
          scrimmageSpots,
          formationBoards,
          formationOrder: wantsOrder
            ? (weekState?.formations || []).map((f: any) => f.id).filter(Boolean)
            : undefined,
          deletedFormationIds: extraMeta?.deletedFormationId ? [extraMeta.deletedFormationId] : undefined,
        });
        try {
          safeJSONSet('footballWeeklyData', currentState.weeklyData);
        } catch {
          /* local cache is best-effort after the live patch */
        }
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setSyncStatus({
          text: sharedOk ? `✅ Saved & Synced (${timeStr})` : '⚠️ Saved on this device only',
          color: sharedOk ? '#22c55e' : '#ef4444',
        });
        return;
      }
    }

    // 1. LocalStorage update
    safeJSONSet('footballWeeklyData', currentState.weeklyData);
    safeJSONSet('footballOwnTeamHudlScout', currentState.ownTeamHudlScout || ownTeamHudlScout);
    safeJSONSet('footballDefaultFormations', currentState.defaultFormations);
    safeJSONSet('footballDeletedFormationIds', currentState.deletedFormationIds || []);
    safeJSONSet('footballPracticeData', currentState.practiceData);
    safeJSONSet('footballPracticeTemplates', currentState.practiceTemplates);
    safeJSONSet('footballPracticeWeekdayTemplates', currentState.practiceWeekdayTemplates || {});
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
      ownTeamHudlScout: currentState.ownTeamHudlScout || ownTeamHudlScout,
      defaultFormations: currentState.defaultFormations,
      deletedFormationIds: currentState.deletedFormationIds || [],
      practiceData: currentState.practiceData,
      practiceTemplates: currentState.practiceTemplates,
      practiceWeekdayTemplates: currentState.practiceWeekdayTemplates || {},
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
      deletedScheduleEventIds: currentState.deletedScheduleEventIds || [],
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
      scope.startsWith('row_') ||
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
      scope === 'scouting_update' ||
      scope.startsWith('scouting') ||
      scope === 'hudl_scout_update' ||
      scope === 'schedule' ||
      scope === 'schedule_update' ||
      (Array.isArray(extraMeta?.modifiedPosIds) && extraMeta.modifiedPosIds.length > 0);

    if (payloadJson === lastSavedPayloadRef.current && !isExplicitUserAction) {
      return;
    }

    // Never overwrite cloud if initial cloud pull has not completed yet
    if (!initialCloudLoadDoneRef.current && scope !== 'force') {
      if (scope.startsWith('practice_drill')) pendingPracticeDrillSaveRef.current = true;
      if (scope === 'scouting_update' || scope.startsWith('scouting') || scope === 'hudl_scout_update') pendingScoutingSaveRef.current = true;
      if (scope === 'schedule_update' || scope === 'schedule') pendingScheduleSaveRef.current = true;
      return;
    }

    if (isFirestoreQuotaPaused()) {
      setSyncStatus({ text: '⚠️ Cloud quota paused — saved on this device', color: '#f59e0b' });
      return;
    }

    lastSavedPayloadRef.current = payloadJson;

    const weekKey = normalizeScoutWeekKey(currentWeekRef.current);
    const scopedKey = getScopedWeekKey(activeTeamIdRef.current, weekKey);
    const weekState =
      currentState.weeklyData?.[scopedKey] || currentState.weeklyData?.[weekKey];
    const { db } = getFirebaseServices();

    setSyncStatus({ text: '☁️ Syncing...', color: '#f59e0b' });

    const authorEmail = currentUser?.email || 'Coach';
    const scopeIsPractice = String(scope).startsWith('practice');
    const scopeIsSchedule = scope === 'schedule' || scope === 'schedule_update';
    let serverOk = false;
    let firestoreOk = false;

    const skipHudlBoardFanout = scope === 'hudl_scout_update' || String(scope).startsWith('hudl_scout');

    // 2. Persistent Server Sync
    if (!skipHudlBoardFanout) {
      try {
        const fallbackUnit =
          ['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current)
            ? currentDepthUnitRef.current
            : (['offense', 'defense', 'st', 'groups'].includes(activeUnitRef.current)
                ? activeUnitRef.current
                : 'offense');
        let effectiveUnit =
          extraMeta?.activeUnit && ['offense', 'defense', 'st', 'groups'].includes(extraMeta.activeUnit)
            ? extraMeta.activeUnit
            : fallbackUnit;
        if (scopeIsPractice) effectiveUnit = 'practice';
        if (scopeIsSchedule) effectiveUnit = 'schedule';
        const metadata = {
          activeTeamId: activeTeamIdRef.current,
          currentWeek: currentWeekRef.current,
          activeUnit: effectiveUnit,
          scope,
          timestamp: Date.now(),
          ...(extraMeta || {}),
          ...(scope === 'ppr_update' || extraMeta?.activeUnit === 'ppr' ? { activeUnit: 'ppr' } : {}),
          ...(scopeIsPractice ? { activeUnit: 'practice' } : {}),
          ...(scopeIsSchedule ? { activeUnit: 'schedule' } : {}),
        };
        const sResult = await saveServerState(payload, authorEmail, metadata);
        if (sResult && typeof sResult.version === 'number') {
          localServerVersionRef.current = sResult.version;
          serverOk = true;
        }
        if (sResult && typeof sResult.updatedAt === 'number') {
          localServerUpdatedAtRef.current = sResult.updatedAt;
          serverOk = true;
        }
      } catch (err) {
        console.warn('Server save warning:', err);
      }
    }

    // 3. Firestore Sync — skip PFF-only writes so a full weeklyData snapshot cannot
    // last-write-wins over another coach's live grades. Server SSE carries the merge.
    if (
      db &&
      initialCloudLoadDoneRef.current &&
      scope === 'force' &&
      !skipHudlBoardFanout
    ) {
      try {
        const cleanPayload = JSON.parse(
          safeJSONStringify({
            ...payload,
            ownTeamHudlScout: undefined,
            updatedAt: Date.now(),
            lastAuthor: authorEmail,
          })
        );
        if (cleanPayload.weeklyData && typeof cleanPayload.weeklyData === 'object') {
          for (const key of Object.keys(cleanPayload.weeklyData)) {
            const week = cleanPayload.weeklyData[key];
            if (week?.scouting?.hudlScout) {
              const { hudlScout: _omit, ...restScout } = week.scouting;
              cleanPayload.weeklyData[key] = { ...week, scouting: restScout };
            }
          }
        }
        delete cleanPayload.ownTeamHudlScout;
        if (scope !== 'force') {
          delete cleanPayload.weeklyData;
          delete cleanPayload.practiceData;
          delete cleanPayload.scheduleEvents;
        }
        await db
          .collection('teamData')
          .doc('depthChartData')
          .set(cleanPayload, { merge: true });
        firestoreOk = true;
      } catch (err: any) {
        noteFirestoreError(err);
        console.warn('Firestore sync warning:', err);
      }
    }

    const weekScout = weekState?.scouting
      ? { ...weekState.scouting, hudlScout: undefined }
      : undefined;
    const weekForms = Array.isArray(weekState?.formations) ? weekState.formations.filter((f: any) => f && f.id) : [];
    const modules = cloudModulesForScope(scope);
    const skipShared = skipHudlBoardFanout || (Array.isArray(modules) && modules.length === 0);
    const writeWeek = !modules || modules.includes('week');
    const sharedOk = skipShared
      ? false
      : await saveSharedBoardCloud({
      teamId: activeTeamIdRef.current,
      week: weekKey,
      scheduleEvents: currentState.scheduleEvents,
      deletedScheduleEventIds: currentState.deletedScheduleEventIds || [],
      practiceData: currentState.practiceData,
      deletedPracticePlanIds: currentState.deletedPracticePlanIds,
      weekSlice:
        !writeWeek || !weekState
          ? undefined
          : {
              depthChart: weekState.depthChart || {},
              formations: weekForms,
              scrimmageChart: weekState.scrimmageChart || {},
              opponent: weekState.opponent || '',
              wristbandData: weekState.wristbandData,
              callSheetData: weekState.callSheetData,
              scouting: weekScout,
              practiceDrillGroups: weekState.practiceDrillGroups,
              pprPlayCounts: weekState.pprPlayCounts,
              pffReviews: weekState.pffReviews,
              filmSession: weekState.filmSession,
              depthSpots: weekState.depthChart || {},
              scrimmageSpots: weekState.scrimmageChart || {},
              formationBoards: Object.fromEntries(weekForms.map((f: any) => [f.id, f])),
              formationOrder: weekForms.map((f: any) => f.id),
            },
      roster: currentState.roster,
      teams: currentState.teams,
      seasonConfig: currentState.seasonConfig,
      staffList: currentState.staffList,
      attendanceLogs: currentState.attendanceLogs,
      cascadingDrills: currentState.cascadingDrills,
      practiceTemplates: currentState.practiceTemplates,
      practiceWeekdayTemplates: currentState.practiceWeekdayTemplates || {},
      liveDrillSlotLayouts: currentState.liveDrillSlotLayouts,
      callSheetData: currentState.callSheetData,
      wristbandData: currentState.wristbandData,
      masterPlayLibrary: currentState.masterPlayLibrary,
      playDatabase: currentState.playDatabase,
      deletedPlayIds: currentState.deletedPlayIds,
      guideTree: currentState.guideTree,
      guideOrder: currentState.guideOrder,
      pffGradeCriteria: currentState.pffGradeCriteria,
      pffPlayerGroups: currentState.pffPlayerGroups,
      savedCoaches: currentState.savedCoaches,
      teamSavedCoaches: currentState.teamSavedCoaches,
      defaultFormations: currentState.defaultFormations,
      deletedFormationIds: currentState.deletedFormationIds,
      modules,
    });

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sharedOk || firestoreOk) {
      setSyncStatus({ text: `✅ Saved & Synced (${timeStr})`, color: '#22c55e' });
    } else if (serverOk) {
      setSyncStatus({ text: '⚠️ Saved on this computer only', color: '#f59e0b' });
    } else {
      setSyncStatus({ text: '⚠️ Saved on this device only', color: '#ef4444' });
    }
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
      pendingSaveRef.current = { scope, extraMeta };
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

  const persistWeekScouting = (field: any, val?: any) => {
    lastLocalEditTimeRef.current = Date.now();
    const teamId = activeTeamIdRef.current;
    const week = currentWeekRef.current;
    setWeeklyData((prev) => {
      const scopedKey = getScopedWeekKey(teamId, week);
      const existingWeek = storedWeekForWrite(prev, teamId, week);
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
        [week]: updatedWeek,
      };
      safeJSONSet('footballWeeklyData', updatedAll);
      latestStateRef.current.weeklyData = updatedAll;
      return updatedAll;
    });
    queueHudlScoutPublish();
  };

  const persistOwnTeamHudlScout = (bundle: any) => {
    lastLocalEditTimeRef.current = Date.now();
    const teamId = activeTeamIdRef.current;
    setOwnTeamHudlScout((prev) => {
      const updated = { ...prev, [teamId]: bundle };
      latestStateRef.current.ownTeamHudlScout = updated;
      safeJSONSet('footballOwnTeamHudlScout', updated);
      return updated;
    });
    queueHudlScoutPublish();
  };

  const hudlPublishTimerRef = useRef<any>(null);
  const queueHudlScoutPublish = () => {
    if (hudlPublishTimerRef.current) clearTimeout(hudlPublishTimerRef.current);
    hudlPublishTimerRef.current = setTimeout(() => {
      hudlPublishTimerRef.current = null;
      void publishHudlScoutToCloud();
    }, 300);
  };

  const applyHudlScoutFromCloud = (teamId: string, week: string, remote: { opponentScout?: any; ownTeamScout?: any }) => {
    if (remote.ownTeamScout) {
      setOwnTeamHudlScout((prev) => {
        const updated = mergeOwnTeamHudlMap(prev, { [teamId]: remote.ownTeamScout });
        if (scoutFingerprint(prev?.[teamId]) === scoutFingerprint(updated?.[teamId])) {
          return prev;
        }
        latestStateRef.current.ownTeamHudlScout = updated;
        safeJSONSet('footballOwnTeamHudlScout', updated);
        return updated;
      });
    }
    if (remote.opponentScout) {
      setWeeklyData((prev) => {
        const wk = normalizeScoutWeekKey(week);
        const scopedKey = getScopedWeekKey(teamId, wk);
        const patchWeek = (key: string, source: typeof prev) => {
          const existingWeek = storedWeekForWrite(source, teamId, wk);
          const nextHudl = pickScoutBundle(existingWeek.scouting?.hudlScout, remote.opponentScout);
          if (scoutFingerprint(existingWeek.scouting?.hudlScout) === scoutFingerprint(nextHudl)) {
            return existingWeek;
          }
          return {
            ...existingWeek,
            scouting: {
              ...(existingWeek.scouting || {}),
              hudlScout: nextHudl,
            },
          };
        };
        const nextScoped = patchWeek(scopedKey, prev);
        const nextWeek = patchWeek(wk, prev);
        if (nextScoped === prev[scopedKey] && nextWeek === prev[wk]) return prev;
        const updatedAll = {
          ...prev,
          [scopedKey]: nextScoped,
          [wk]: nextWeek,
        };
        latestStateRef.current.weeklyData = updatedAll;
        safeJSONSet('footballWeeklyData', updatedAll);
        return updatedAll;
      });
    }
  };

  const hydrateHudlScoutFromCloud = async (teamId = activeTeamIdRef.current, week = currentWeekRef.current) => {
    if (isFirestoreQuotaPaused()) return;
    const wk = normalizeScoutWeekKey(week);
    const remote = await fetchHudlScoutCloud(teamId, wk);
    if (!remote.opponentScout && !remote.ownTeamScout) return;
    const scopedKey = getScopedWeekKey(teamId, wk);
    const localOpp =
      latestStateRef.current.weeklyData?.[scopedKey]?.scouting?.hudlScout ||
      latestStateRef.current.weeklyData?.[wk]?.scouting?.hudlScout;
    const localOwn = latestStateRef.current.ownTeamHudlScout?.[teamId];
    const oppSame = !remote.opponentScout || scoutFingerprint(localOpp) === scoutFingerprint(pickScoutBundle(localOpp, remote.opponentScout));
    const ownSame = !remote.ownTeamScout || scoutFingerprint(localOwn) === scoutFingerprint(pickScoutBundle(localOwn, remote.ownTeamScout));
    if (oppSame && ownSame) return;
    applyHudlScoutFromCloud(teamId, wk, remote);
  };

  const applySharedBoardFromRemote = (remote: SharedBoardCloudUpdate) => {
    isRemoteSyncRef.current = true;
    const remoteGen = ++remoteSyncGenRef.current;
    window.setTimeout(() => {
      if (remoteGen !== remoteSyncGenRef.current) return;
      isRemoteSyncRef.current = false;
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (pending && isBoardPatchScope(pending.scope)) {
        void saveStateToStorage(pending.scope, pending.extraMeta);
      }
    }, 800);

    const take = (key: string, at?: number) => {
      const n = Number(at) || 0;
      if (remote.writerClientId && remote.writerClientId === CLIENT_ID) {
        return false;
      }
      if (n && n <= (lastAppliedOpsAtRef.current[key] || 0)) return false;
      if (n) lastAppliedOpsAtRef.current[key] = n;
      return true;
    };

    if (Array.isArray(remote.scheduleEvents) && take('schedule', remote.scheduleUpdatedAt)) {
      const merged = mergeScheduleEvents(
        latestStateRef.current.scheduleEvents,
        remote.scheduleEvents,
        absorbDeletedScheduleEventIds(remote.deletedScheduleEventIds)
      );
      setScheduleEvents(merged);
      latestStateRef.current.scheduleEvents = merged;
      safeJSONSet('footballScheduleEvents', merged);
    }
    if (Array.isArray(remote.practiceData) && take('practice', remote.practiceUpdatedAt)) {
      const mergedPlans = mergePracticePlansByLastEdited(
        latestStateRef.current.practiceData || [],
        sanitizePracticePlans(remote.practiceData, latestStateRef.current.scheduleEvents || []),
        new Set([
          ...(latestStateRef.current.deletedPracticePlanIds || []),
          ...(remote.deletedPracticePlanIds || []),
        ])
      );
      setPracticeData(mergedPlans);
      latestStateRef.current.practiceData = mergedPlans;
      safeJSONSet('footballPracticeData', mergedPlans);
      const activeId = currentPracticeIdRef.current;
      const switchTo = shouldSwitchToSharedTodayPlan(
        mergedPlans,
        activeId,
        currentWeekRef.current
      );
      const nextId =
        switchTo ||
        (!mergedPlans.some((p) => p && p.id === activeId)
          ? findBestActivePracticeId(mergedPlans, activeId, currentWeekRef.current)
          : null);
      if (nextId && nextId !== activeId) {
        setCurrentPracticeId(nextId);
        currentPracticeIdRef.current = nextId;
        safeJSONSet('footballCurrentPracticeId', nextId);
      }
    }
    const slice = remote.weekSlice;
    const isPatch = slice?.weekWriteKind === 'patch';
    const otherWriter = !remote.writerClientId || remote.writerClientId !== CLIENT_ID;
    const weekAt = Number(remote.weekUpdatedAt || slice?.updatedAt) || 0;
    const patchSig = isPatch
      ? `${weekAt}|${remote.writerClientId || ''}|${JSON.stringify(slice?.depthSpots || {})}|${JSON.stringify(slice?.scrimmageSpots || {})}|${JSON.stringify(slice?.formationBoards || {})}|${JSON.stringify(slice?.formationOrder || [])}`
      : '';
    let takeWeek =
      Boolean(slice) &&
      (slice.depthChart ||
        slice.formations ||
        slice.scrimmageChart ||
        slice.wristbandData ||
        slice.depthSpots ||
        slice.scrimmageSpots ||
        slice.formationBoards) &&
      (isPatch && otherWriter ? true : take('week', weekAt));
    if (isPatch && otherWriter && patchSig && lastWeekPatchSigRef.current === patchSig) {
      takeWeek = false;
    }
    if (takeWeek) {
      if (patchSig) lastWeekPatchSigRef.current = patchSig;
      if (weekAt > (lastAppliedOpsAtRef.current.week || 0)) {
        lastAppliedOpsAtRef.current.week = weekAt;
      }
      const teamId = activeTeamIdRef.current;
      const week = normalizeScoutWeekKey(currentWeekRef.current);
      const scopedKey = getScopedWeekKey(teamId, week);
      const recentSpots = recentlyModifiedPositionsRef.current;
      const recentForms = recentlyModifiedFormationsRef.current;
      const liveProtectMs = otherWriter ? 0 : 2500;
      const now = Date.now();
      setWeeklyData((prev) => {
        const patch = (key: string) => {
          const weekId = key.includes('__week_') ? key.split('__week_').slice(1).join('__week_') : key;
          const cur = storedWeekForWrite(prev, teamId, weekId);
          const nextDepth = isPatch
            ? applySharedWeekSliceDepth(cur.depthChart || {}, slice.depthSpots, recentSpots, now, liveProtectMs)
            : applySharedWeekSliceDepth(
                applySharedWeekSliceDepth(cur.depthChart || {}, slice.depthChart, recentSpots, now, liveProtectMs),
                slice.depthSpots,
                recentSpots,
                now,
                liveProtectMs
              );
          const nextScrim = isPatch
            ? applySharedWeekSliceDepth(cur.scrimmageChart || {}, slice.scrimmageSpots, recentSpots, now, liveProtectMs)
            : applySharedWeekSliceDepth(
                applySharedWeekSliceDepth(cur.scrimmageChart || {}, slice.scrimmageChart, recentSpots, now, liveProtectMs),
                slice.scrimmageSpots,
                recentSpots,
                now,
                liveProtectMs
              );
          const nextForms = isPatch
            ? applyFormationBoardPatches(
                cur.formations,
                slice.formationBoards,
                recentForms,
                now,
                slice.formationOrder,
                liveProtectMs
              )
            : applyFormationBoardPatches(
                applySharedFormations(
                  cur.formations,
                  slice.formations,
                  recentForms,
                  lastLocalEditTimeRef.current,
                  now,
                  true
                ),
                slice.formationBoards,
                recentForms,
                now,
                slice.formationOrder,
                liveProtectMs
              );
          if (isPatch) {
            return {
              ...cur,
              depthChart: nextDepth,
              scrimmageChart: nextScrim,
              formations: nextForms,
            };
          }
          return {
            ...cur,
            depthChart: nextDepth,
            scrimmageChart: nextScrim,
            formations: nextForms,
            opponent: slice.opponent || cur.opponent || '',
            wristbandData: slice.wristbandData || cur.wristbandData,
            callSheetData: slice.callSheetData || cur.callSheetData,
            scouting: mergeScoutingReports(cur.scouting, slice.scouting),
            practiceDrillGroups: mergePracticeDrillGroups(
              cur.practiceDrillGroups,
              slice.practiceDrillGroups
            ),
            pprPlayCounts: slice.pprPlayCounts || cur.pprPlayCounts,
            pffReviews: slice.pffReviews || cur.pffReviews,
            filmSession: slice.filmSession || cur.filmSession,
          };
        };
        const updatedAll = { ...prev, [scopedKey]: patch(scopedKey), [week]: patch(week) };
        latestStateRef.current.weeklyData = updatedAll;
        safeJSONSet('footballWeeklyData', updatedAll);
        return updatedAll;
      });
      // This week's shared doc carries the call sheet too: show another coach's newer save.
      const sliceCs = !isPatch && otherWriter ? (slice.callSheetData as CallSheetFullData | undefined) : undefined;
      if (sliceCs && countCallSheetPlays(sliceCs) > 0) {
        const localCs = latestStateRef.current.callSheetData;
        const editingNow = Date.now() - lastLocalCallSheetEditTimeRef.current < 25000;
        if (
          savedForTeamWeek(sliceCs, teamId, currentWeekRef.current) &&
          !editingNow &&
          (Number(sliceCs.lastEdited) || 0) >= (Number(localCs?.lastEdited) || 0)
        ) {
          adoptCallSheet(sliceCs);
        }
      }
    }
    if (Array.isArray(remote.roster) && take('roster', remote.rosterUpdatedAt)) {
      const normalized = normalizeRoster(remote.roster, true);
      setRoster(normalized);
      latestStateRef.current.roster = normalized;
      safeJSONSet('footballRoster', normalized);
    }
    if (take('season', remote.seasonUpdatedAt)) {
      if (Array.isArray(remote.teams) && remote.teams.length) {
        setTeams(remote.teams);
        latestStateRef.current.teams = remote.teams;
        safeJSONSet('footballTeams', remote.teams);
      }
      if (remote.seasonConfig) {
        setSeasonConfig(remote.seasonConfig);
        latestStateRef.current.seasonConfig = remote.seasonConfig;
        safeJSONSet('footballSeasonConfig', remote.seasonConfig);
      }
    }
    if (Array.isArray(remote.staffList) && take('staff', remote.staffUpdatedAt)) {
      setStaffList((prevStaff) => {
        const mergedStaff = mergeStaffByEmail(prevStaff, remote.staffList || []);
        latestStateRef.current.staffList = mergedStaff;
        safeJSONSet('footballTeamCoaches', mergedStaff);
        return mergedStaff;
      });
    }
    if (Array.isArray(remote.attendanceLogs) && take('attendance', remote.attendanceUpdatedAt)) {
      setAttendanceLogs(remote.attendanceLogs);
      latestStateRef.current.attendanceLogs = remote.attendanceLogs;
      safeJSONSet('footballAttendanceLogs', remote.attendanceLogs);
    }
    if (take('drills', remote.drillsUpdatedAt)) {
      if (remote.cascadingDrills && !(Date.now() - lastLocalEditTimeRef.current < 20000 && activeUnitRef.current === 'drills')) {
        const normalizedDrills = normalizeCascadingDrills(remote.cascadingDrills);
        setCascadingDrills(normalizedDrills);
        latestStateRef.current.cascadingDrills = normalizedDrills;
        safeJSONSet('footballCascadingDrills', normalizedDrills);
      }
      if (remote.practiceTemplates) {
        const mergedTemplates = mergePracticeTemplates(
          latestStateRef.current.practiceTemplates,
          remote.practiceTemplates,
          { lastLocalEditTime: lastLocalEditTimeRef.current }
        );
        if (
          practiceTemplatesFingerprint(mergedTemplates) !==
          practiceTemplatesFingerprint(latestStateRef.current.practiceTemplates)
        ) {
          setPracticeTemplates(mergedTemplates);
          latestStateRef.current.practiceTemplates = mergedTemplates;
          safeJSONSet('footballPracticeTemplates', mergedTemplates);
        }
      }
      if (remote.practiceWeekdayTemplates) {
        const mergedDays = mergePracticeWeekdayTemplates(
          latestStateRef.current.practiceWeekdayTemplates,
          remote.practiceWeekdayTemplates
        );
        setPracticeWeekdayTemplates(mergedDays);
        latestStateRef.current.practiceWeekdayTemplates = mergedDays;
        safeJSONSet('footballPracticeWeekdayTemplates', mergedDays);
      }
      if (remote.liveDrillSlotLayouts && typeof remote.liveDrillSlotLayouts === 'object') {
        const mergedLayouts = mergeLiveDrillSlotLayouts(
          loadLiveDrillSlotLayouts(),
          remote.liveDrillSlotLayouts
        );
        persistLiveDrillSlotLayouts(mergedLayouts);
        safeJSONSet('footballLiveDrillSlotLayouts', mergedLayouts);
      }
    }
    if (remote.callSheetData && take('callSheet', remote.callSheetUpdatedAt)) {
      const localCs = latestStateRef.current.callSheetData;
      const localEdited = Number(localCs?.lastEdited) || 0;
      const remoteEdited = Number(remote.callSheetData.lastEdited) || 0;
      const editingNow = Date.now() - lastLocalCallSheetEditTimeRef.current < 25000;
      const forThisWeek = savedForTeamWeek(remote.callSheetData, activeTeamIdRef.current, currentWeekRef.current);
      if (forThisWeek && !editingNow && remoteEdited >= localEdited) {
        adoptCallSheet(remote.callSheetData);
      }
    }
    if (remote.wristbandData && take('wristband', remote.wristbandUpdatedAt)) {
      const editingNow = Date.now() - lastLocalWristbandEditTimeRef.current < 25000;
      const remoteEdited = Number(remote.wristbandData.lastEdited) || 0;
      const localEdited = Number(latestStateRef.current.wristbandData?.lastEdited) || 0;
      const forThisWeek = savedForTeamWeek(remote.wristbandData, activeTeamIdRef.current, currentWeekRef.current);
      if (forThisWeek && !editingNow && remoteEdited > localEdited) {
        const normWb = normalizeWristbandContinuousNumbering(remote.wristbandData, 'Mahopac 10U');
        setWristbandData(normWb);
        latestStateRef.current.wristbandData = normWb;
        safeJSONSet('footballWristbandData', normWb);
      }
    }
    if (take('plays', remote.playsUpdatedAt)) {
      if (remote.masterPlayLibrary) {
        setMasterPlayLibrary(remote.masterPlayLibrary);
        latestStateRef.current.masterPlayLibrary = remote.masterPlayLibrary;
        safeJSONSet('footballMasterPlays', remote.masterPlayLibrary);
      }
      if (Array.isArray(remote.playDatabase) && !(Date.now() - lastLocalEditTimeRef.current < 20000 && (activeUnitRef.current === 'call_sheet' || activeUnitRef.current === 'wristband'))) {
        setPlayDatabase(remote.playDatabase);
        latestStateRef.current.playDatabase = remote.playDatabase;
        safeJSONSet('footballPlayDatabase', remote.playDatabase);
      }
      if (Array.isArray(remote.deletedPlayIds)) {
        setDeletedPlayIds(remote.deletedPlayIds);
        latestStateRef.current.deletedPlayIds = remote.deletedPlayIds;
        safeJSONSet('footballDeletedPlayIds', remote.deletedPlayIds);
      }
    }
    if (take('guides', remote.guidesUpdatedAt)) {
      if (remote.guideTree) {
        setGuideTree(remote.guideTree);
        latestStateRef.current.guideTree = remote.guideTree;
        safeJSONSet('footballPdfGuidesTree', remote.guideTree);
      }
      if (remote.guideOrder) {
        setGuideOrder(remote.guideOrder);
        latestStateRef.current.guideOrder = remote.guideOrder;
        safeJSONSet('footballPdfGuidesOrder', remote.guideOrder);
      }
    }
    if (take('pff', remote.pffUpdatedAt)) {
      if (remote.pffGradeCriteria) {
        const mergedCriteria = mergePffGradeCriteria(
          mergePffCriteriaMaps(latestStateRef.current.pffGradeCriteria, remote.pffGradeCriteria)
        );
        setPffGradeCriteria(mergedCriteria);
        latestStateRef.current.pffGradeCriteria = mergedCriteria;
        safeJSONSet('footballPffGradeCriteria', mergedCriteria);
      }
      if (remote.pffPlayerGroups && typeof remote.pffPlayerGroups === 'object') {
        const mergedGroups = mergePffPlayerGroups(
          latestStateRef.current.pffPlayerGroups,
          remote.pffPlayerGroups
        ) as PffPlayerGroupOverrides;
        setPffPlayerGroups(mergedGroups);
        latestStateRef.current.pffPlayerGroups = mergedGroups;
        safeJSONSet('footballPffPlayerGroups', mergedGroups);
      }
    }
    if (take('coaches', remote.coachesUpdatedAt)) {
      if (Array.isArray(remote.savedCoaches)) {
        setSavedCoaches(remote.savedCoaches);
        latestStateRef.current.savedCoaches = remote.savedCoaches;
        safeJSONSet('footballSavedCoaches', remote.savedCoaches);
      }
      if (remote.teamSavedCoaches && typeof remote.teamSavedCoaches === 'object') {
        setTeamSavedCoaches(remote.teamSavedCoaches);
        latestStateRef.current.teamSavedCoaches = remote.teamSavedCoaches;
        safeJSONSet('footballTeamSavedCoaches', remote.teamSavedCoaches);
      }
    }
    if (take('formations', remote.formationsUpdatedAt)) {
      if (Array.isArray(remote.defaultFormations) && remote.defaultFormations.length) {
        const nextDefaults = applySharedFormations(
          latestStateRef.current.defaultFormations,
          remote.defaultFormations,
          recentlyModifiedFormationsRef.current,
          lastLocalEditTimeRef.current,
          Date.now(),
          true
        );
        setDefaultFormations(nextDefaults);
        latestStateRef.current.defaultFormations = nextDefaults;
        safeJSONSet('footballDefaultFormations', nextDefaults);
      }
      if (Array.isArray(remote.deletedFormationIds)) {
        setDeletedFormationIds(remote.deletedFormationIds);
        latestStateRef.current.deletedFormationIds = remote.deletedFormationIds;
        safeJSONSet('footballDeletedFormationIds', remote.deletedFormationIds);
      }
    }
  };

  const hydrateSharedBoardFromCloud = async () => {
    if (isFirestoreQuotaPaused()) return;
    const teamId = activeTeamIdRef.current;
    const week = normalizeScoutWeekKey(currentWeekRef.current);
    const remote = await fetchSharedBoardCloud(teamId, week);
    applySharedBoardFromRemote(remote);
  };

  const publishHudlScoutToCloud = async () => {
    const teamId = activeTeamIdRef.current;
    const week = normalizeScoutWeekKey(currentWeekRef.current);
    const scopedKey = getScopedWeekKey(teamId, week);
    const weekState =
      latestStateRef.current.weeklyData?.[scopedKey] ||
      latestStateRef.current.weeklyData?.[week] ||
      latestStateRef.current.weeklyData?.[currentWeekRef.current];
    const opponentScout = weekState?.scouting?.hudlScout;
    const ownTeamScout =
      latestStateRef.current.ownTeamHudlScout?.[teamId] ||
      latestStateRef.current.ownTeamHudlScout?.team_10u;
    const hasOpp =
      (Array.isArray(opponentScout?.plays) && opponentScout.plays.length > 0) ||
      Boolean(opponentScout?.sourceCleared);
    const hasOwn =
      (Array.isArray(ownTeamScout?.plays) && ownTeamScout.plays.length > 0) ||
      Boolean(ownTeamScout?.sourceCleared);
    if (!hasOpp && !hasOwn) return;
    if (isFirestoreQuotaPaused()) {
      setSyncStatus({ text: '⚠️ Cloud quota paused', color: '#f59e0b' });
      return;
    }
    const result = await saveHudlScoutCloud({
      teamId,
      week,
      opponentScout: hasOpp ? opponentScout : undefined,
      ownTeamScout: hasOwn ? ownTeamScout : undefined,
    });
    if (result.ok) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncStatus({ text: `✅ Scout saved (${timeStr})`, color: '#22c55e' });
    } else {
      setSyncStatus({ text: '⚠️ Scout not shared', color: '#ef4444' });
    }
  };

  const republishRestoredHudlScout = async (
    weekly: Record<string, any>,
    ownMap: Record<string, any>
  ) => {
    const seen = new Set<string>();
    for (const [key, week] of Object.entries(weekly || {})) {
      const scout = (week as any)?.scouting?.hudlScout;
      const hasOpp =
        (Array.isArray(scout?.plays) && scout.plays.length > 0) || Boolean(scout?.sourceCleared);
      if (!hasOpp) continue;
      let teamId = activeTeamIdRef.current;
      let weekKey = normalizeScoutWeekKey(key);
      if (key.includes('__week_')) {
        const [t, w] = key.split('__week_');
        teamId = t || teamId;
        weekKey = normalizeScoutWeekKey(w);
      }
      const stamp = `${teamId}|${weekKey}`;
      if (seen.has(stamp)) continue;
      seen.add(stamp);
      const ownTeamScout = ownMap?.[teamId] || ownMap?.team_10u;
      const hasOwn =
        (Array.isArray(ownTeamScout?.plays) && ownTeamScout.plays.length > 0) ||
        Boolean(ownTeamScout?.sourceCleared);
      await saveHudlScoutCloud({
        teamId,
        week: weekKey,
        opponentScout: scout,
        ownTeamScout: hasOwn ? ownTeamScout : undefined,
      });
    }
    for (const [teamId, ownTeamScout] of Object.entries(ownMap || {})) {
      const hasOwn =
        (Array.isArray(ownTeamScout?.plays) && ownTeamScout.plays.length > 0) ||
        Boolean(ownTeamScout?.sourceCleared);
      if (!hasOwn) continue;
      if ([...seen].some((stamp) => stamp.startsWith(`${teamId}|`))) continue;
      await saveHudlScoutCloud({
        teamId,
        week: normalizeScoutWeekKey(currentWeekRef.current),
        ownTeamScout,
      });
    }
  };

  const handleForceRefresh = async () => {
    setSyncStatus({ text: '🔄 Fetching Latest Cloud Data...', color: '#f59e0b' });
    try {
      const { db } = getFirebaseServices();
      if (db) {
        const doc = await db.collection('teamData').doc('depthChartData').get();
        if (doc.exists) {
          applyRemoteState(doc.data(), 'manual_firestore_refresh');
        }
      }
      const serverRes = await fetchServerState();
      if (serverRes && serverRes.hasData && serverRes.state) {
        applyRemoteState(serverRes.state, 'manual_server_refresh', serverRes.version, serverRes.updatedAt);
      }
      await hydrateHudlScoutFromCloud();
      await hydrateSharedBoardFromCloud();
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

  useEffect(() => {
    if (!initialCloudLoadDoneRef.current) return;
    void hydrateHudlScoutFromCloud(activeTeamId, currentWeek);
  }, [activeTeamId, currentWeek]);

  useEffect(() => {
    if (isFirestoreQuotaPaused()) return;
    const { db } = getFirebaseServices();
    if (!db) return;
    const unsub = subscribeSharedBoardCloud(activeTeamId, currentWeek, (remote) => {
      applySharedBoardFromRemote(remote);
    });
    return () => unsub();
  }, [activeTeamId, currentWeek]);

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
        if (db && !isFirestoreQuotaPaused()) {
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
        } else if (!firestoreLoaded) {
          initialCloudLoadDoneRef.current = true;
        }
        await hydrateHudlScoutFromCloud();
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

      return () => {
        if (typeof unsubscribeSSE === 'function') unsubscribeSSE();
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
      if (db && !isFirestoreQuotaPaused()) {
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
              noteFirestoreError(err);
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
      return;
    }
    const switchTo = shouldSwitchToSharedTodayPlan(teamPractices, currentPracticeId, currentWeek);
    const isCurrentValid = teamPractices.some((p) => p && p.id === currentPracticeId);
    const bestId =
      switchTo ||
      (!isCurrentValid || !currentPracticeId
        ? findBestActivePracticeId(teamPractices, currentPracticeId, currentWeek)
        : null);
    if (bestId && bestId !== currentPracticeId) {
      setCurrentPracticeId(bestId);
      safeJSONSet('footballCurrentPracticeId', bestId);
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

  // Do not auto-write the whole cloud board whenever any React state ticks.
  // Feature handlers already save the one module that changed.

  const currentScopedWeekKey = getScopedWeekKey(activeTeamId, currentWeek);
  const currentWeekState: WeekState = resolveWeekState(weeklyData, activeTeamId, currentWeek);

  // Newest whole wristband wins. Mixing columns from the week snapshot and live
  // state put deleted/changed plays back after a coach edited them.
  const effectiveWristbandData: WristbandData = useMemo(() => {
    return (
      pickNewestWristbandData(currentWeekState?.wristbandData, wristbandData) || INITIAL_TWO_WRISTBANDS_DATA
    );
  }, [wristbandData, currentWeekState?.wristbandData]);
  // Read by save/adopt paths so the call sheet's wristband tables use the same wristband the screens show.
  effectiveWristbandRef.current = effectiveWristbandData;

  const rawFormations = currentWeekState.formations;

  const currentFormations: FormationBoard[] = useMemo(() => {
    return (rawFormations || [])
      .filter((f): f is FormationBoard => Boolean(f && typeof f === 'object' && f.id && !isDroppedFormation(f)))
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

  const previousWeekCopyLabel = useMemo(() => {
    const srcWk = getPriorSeasonWeekKey(currentWeek, seasonConfig);
    return srcWk ? formatWeekCopyLabel(srcWk) : '';
  }, [currentWeek, seasonConfig]);

  // Team Access Control & Data Filtering
  const currentUserCoach = staffList.find(
    (c) => c.email.toLowerCase().trim() === (currentUser?.email || '').toLowerCase().trim()
  );

  const isMasterSuperAdminUser = (email?: string) => {
    return false;
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
    safeJSONSet('footballLastLocalEditTime', now);

    const extra = extraMeta || {};
    const touchFormIds = new Set<string>(
      [
        ...(Array.isArray(extra.modifiedFormIds) ? extra.modifiedFormIds : []),
        extra.formId,
        extra.movedFormationId,
        extra.deletedFormationId,
      ].filter(Boolean)
    );
    const touchPosIds = new Set<string>(
      (Array.isArray(extra.modifiedPosIds) ? extra.modifiedPosIds : []).filter(Boolean)
    );
    const formContainsTouchedPos = (form: FormationBoard) =>
      Array.isArray(form?.rows) &&
      form.rows.some(
        (r) =>
          Array.isArray(r?.positions) &&
          r.positions.some((p) => p && p.id && touchPosIds.has(p.id))
      );

    const stampedFormations = Array.isArray(newFormations)
      ? newFormations.map((f) => {
          if (!f || !f.id) return f;
          const shouldStamp =
            !touchFormIds.size && !touchPosIds.size
              ? true
              : touchFormIds.has(f.id) || formContainsTouchedPos(f);
          if (!shouldStamp) return f;
          return { ...f, lastEdited: now };
        })
      : newFormations;

    if (Array.isArray(stampedFormations)) {
      stampedFormations.forEach((f) => {
        if (!f || !f.id) return;
        const shouldMark =
          !touchFormIds.size && !touchPosIds.size
            ? true
            : touchFormIds.has(f.id) || formContainsTouchedPos(f);
        if (!shouldMark) return;
        recentlyModifiedFormationsRef.current.set(f.id, now);
        touchFormIds.add(f.id);
      });
    }

    touchPosIds.forEach((pid) => recentlyModifiedPositionsRef.current.set(pid, now));
    extra.modifiedFormIds = Array.from(touchFormIds);
    extra.modifiedPosIds = Array.from(touchPosIds);
    extraMeta = extra;
    safeJSONSet(
      'footballRecentlyModifiedPositions',
      Array.from(recentlyModifiedPositionsRef.current.entries())
    );
    safeJSONSet(
      'footballRecentlyModifiedFormations',
      Array.from(recentlyModifiedFormationsRef.current.entries())
    );

    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);
    const prev = latestStateRef.current.weeklyData || weeklyData;
    const existing = resolveWeekState(prev, activeTeamId, currentWeek);
    const updatedWeekState: WeekState = {
      ...existing,
      formations: stampedFormations,
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
      setDefaultFormations(stampedFormations);
      safeJSONSet('footballDefaultFormations', stampedFormations);
      latestStateRef.current.defaultFormations = stampedFormations;
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

  const {
    handleDropPlayerOnCard,
    handleRemovePlayerFromCard,
    handleDragStartPlacedPlayer,
    handlePositionCardDragStart,
    handlePositionCardDropOnSlot,
    handleAssignPlayerDirect,
    handleReorderDepthPlayer,
    handleDragStartRosterPlayer,
  } = useDepthChartDragDrop({
    activeUnit,
    depthSubUnit,
    userRole,
    draggedPlayerRef,
    currentScrimmageChart,
    currentDepthChart,
    recordPositionEdit,
    updateCurrentWeekScrimmageChart,
    updateCurrentWeekDepthChart,
    flushAndSaveStateToStorage,
    currentDepthUnit,
    draggedPositionCardRef,
    currentFormations,
    recentlyModifiedPositionsRef,
    recentlyModifiedFormationsRef,
    currentDepthUnitRef,
    updateCurrentWeekFormations,
  });

  const {
    handleAddFormation,
    handleMoveFormation,
    handleDuplicateFormation,
    handleRenameFormation,
    handleDeleteFormation,
    handleRestoreDefaultFormations,
    handleAddRow,
    handleEditRowName,
    handleEditRowSlots,
    handleDeleteRow,
    handleAddPosition,
    handleEditPositionName,
    handleMovePositionRow,
    handleCopyPositionToOtherForm,
    handleDeletePosition,
    handleSetRowSlots,
    handleAddSlotToRow,
    handleRemoveSlotFromRow,
    handleInsertSlotAt,
    handleClearPositionToEmpty,
    handleAssignPositionToSlot,
    handleAddPositionDirect,
    handleRenamePositionDirect,
    handleRenameRowDirect,
    handleAddRowDirect,
    handleAddFormationDirect,
    handleRenameFormationDirect,
    handleDuplicateFormationDirect,
    handleMovePositionDirect,
    handleCopyPositionDirect,
  } = useFormationActions({
    currentFormations,
    recentlyModifiedFormationsRef,
    currentDepthUnitRef,
    updateCurrentWeekFormations,
    recentlyModifiedPositionsRef,
    setSelectedFormationId,
    userRole,
    currentDepthChart,
    currentScrimmageChart,
    updateCurrentWeekDepthChart,
    updateCurrentWeekScrimmageChart,
    deletedFormationIds,
    latestStateRef,
    setDeletedFormationIds,
    lastLocalEditTimeRef,
    setWeeklyData,
    setDefaultFormations,
    selectedFormationId,
    flushAndSaveStateToStorage,
    activeTeamId,
    currentWeek,
    storedWeekForWrite,
    weeklyData,
    defaultFormations,
  });

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
        return {
          ...p,
          lastEdited:
            targetId && p.id === targetId ? now : p.lastEdited || now,
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

  // Applying a weekday template replaces the periods of every upcoming plan on that day
  // for every coach, so ask first.
  const confirmWeekdayTemplateApply = (day: string, templateName: string) =>
    confirm(
      `Replace the periods in every upcoming ${day} practice plan with the "${templateName}" template?

This changes those plans for all coaches. Past ${day} plans are not changed.`
    );

  // Change plans on this device only: no edit stamp, no save. For bookkeeping such as
  // opening a practice, so an older copy on this device can't be pushed over a coach's edits.
  const updatePracticeDataLocally = (updater: (prev: PracticePlan[]) => PracticePlan[]) => {
    setPracticeData((prev) => {
      const updated = updater(prev);
      latestStateRef.current.practiceData = updated;
      safeJSONSet('footballPracticeData', updated);
      return updated;
    });
  };

  const {
    handleImportDrillsCSV,
    handleImportDrillsJSON,
    handleAddTopDrillFolder,
    handleAddSubfolder,
    handleAddDrill,
    handleRenameDrillFolder,
    handleDeleteDrillFolder,
    handleMoveDrillFolder,
    handleUpdateDrill,
    handleDeleteDrill,
    handleMoveDrillToFolder,
    handleExportDrillsCSV,
    handleExportDrillsJSON,
    updateCascadingDrillsAndSave,
  } = useDrillLibraryActions({
    setCascadingDrills,
    latestStateRef,
    lastLocalEditTimeRef,
    debouncedSave,
    cascadingDrills,
  });

  const {
    handleUploadGuideDocument,
    handleSaveGuideHtml,
    handleClearGuideDocument,
  } = usePlaybookGuideActions({
    setGuideTree,
    latestStateRef,
    flushAndSaveStateToStorage,
  });

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

      const weeklyForBackup = latestStateRef.current.weeklyData || weeklyData;
      const ownHudlForBackup =
        latestStateRef.current.ownTeamHudlScout || ownTeamHudlScout || {};
      const hudlScoutUploads = collectHudlScoutBackup(weeklyForBackup, ownHudlForBackup);

      const fullBackup = {
        weeklyData: weeklyForBackup,
        ownTeamHudlScout: ownHudlForBackup,
        hudlScoutUploads,
        defaultFormations,
        practiceData,
        practiceTemplates,
        practiceWeekdayTemplates,
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
      const importedWeekdayTemplates = shouldImport('practiceTemplates')
        ? parsed.practiceWeekdayTemplates || null
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
      const shouldImportHudl = shouldImport('hudlScout') || shouldImport('hudlScoutUploads');
      const importedHudlUploads = shouldImportHudl
        ? parsed.hudlScoutUploads ||
          (parsed.ownTeamHudlScout || parsed.weeklyData
            ? collectHudlScoutBackup(parsed.weeklyData, parsed.ownTeamHudlScout)
            : null)
        : null;

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
        latestStateRef.current.practiceTemplates = normalized;
        safeJSONSet('footballPracticeTemplates', normalized);
        restoredList.push('⚡ Practice Templates');
      }
      if (importedWeekdayTemplates) {
        const normalizedDays = normalizePracticeWeekdayTemplates(importedWeekdayTemplates);
        setPracticeWeekdayTemplates(normalizedDays);
        latestStateRef.current.practiceWeekdayTemplates = normalizedDays;
        safeJSONSet('footballPracticeWeekdayTemplates', normalizedDays);
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

      if (importedHudlUploads) {
        const applied = applyHudlScoutBackup(
          latestStateRef.current.weeklyData || weeklyData,
          latestStateRef.current.ownTeamHudlScout || ownTeamHudlScout,
          importedHudlUploads
        );
        setWeeklyData(applied.weeklyData);
        latestStateRef.current.weeklyData = applied.weeklyData;
        safeJSONSet('footballWeeklyData', applied.weeklyData);
        setOwnTeamHudlScout(applied.ownTeamHudlScout);
        latestStateRef.current.ownTeamHudlScout = applied.ownTeamHudlScout;
        safeJSONSet('footballOwnTeamHudlScout', applied.ownTeamHudlScout);
        restoredList.push('Hudl Scout uploads');
        void republishRestoredHudlScout(applied.weeklyData, applied.ownTeamHudlScout);
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
          practiceWeekdayTemplates: importedWeekdayTemplates || practiceWeekdayTemplates,
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
    showAlert: boolean = true,
    extras?: { copyWristband?: boolean; copyCallSheet?: boolean }
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

    const copyWristband = extras?.copyWristband !== false;
    const copyCallSheet = extras?.copyCallSheet !== false;
    const liveWb = latestStateRef.current.wristbandData;
    const liveCs = latestStateRef.current.callSheetData;
    const copiedWb = copyWristband
      ? deepClone(
          wristbandHasPlays(src.wristbandData) ? src.wristbandData : liveWb
        )
      : undefined;
    const copiedCs = copyCallSheet
      ? deepClone(
          countCallSheetPlays(src.callSheetData) > 0 ? src.callSheetData : liveCs
        )
      : undefined;

    const updatedState: WeekState = {
      ...targetExisting,
      formations: updatedFormations,
      depthChart: updatedDepthChart,
      scrimmageChart: updatedScrimmageChart,
      pprPlayCounts:
        mode === 'both' ? src.pprPlayCounts || {} : targetExisting.pprPlayCounts,
      pffReviews: mode === 'both' ? src.pffReviews || {} : targetExisting.pffReviews,
      filmSession: mode === 'both' ? src.filmSession : targetExisting.filmSession,
      ...(copiedWb ? { wristbandData: copiedWb } : {}),
      ...(copiedCs ? { callSheetData: copiedCs } : {}),
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

    if (copiedWb && wristbandHasPlays(copiedWb)) {
      setWristbandData(copiedWb);
      latestStateRef.current.wristbandData = copiedWb;
      safeJSONSet('footballWristbandData', copiedWb);
    }
    if (copiedCs && countCallSheetPlays(copiedCs) > 0) {
      setCallSheetData(copiedCs);
      latestStateRef.current.callSheetData = copiedCs;
      safeJSONSet('footballCallSheetData', copiedCs);
    }

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
          }${copyWristband ? ', wristband' : ''}${copyCallSheet ? ', and call sheet' : ''} from ${srcLabel} to ${targetLabel}!`
        );
      }, 60);
    }
  };

  const {
    handleSyncPracticeToPlan,
    handleDeleteScheduleEvent,
    handleUpdateScheduleEvent,
    handlePracticeWizardGenerate,
    handleAddScheduleEvent,
    handleBulkAddScheduleEvents,
    handleSyncGameToWeeklyData,
    handleNavigateToWeek,
    handleImportTeamSnapScheduleEvents,
  } = useScheduleActions({
    ensureWeekExists,
    setWeeklyData,
    activeTeamId,
    storedWeekForWrite,
    practiceData,
    updatePracticeDataAndSave,
    updatePracticeDataLocally,
    setScheduleEvents,
    setDeletedScheduleEventIds,
    latestStateRef,
    setCurrentPracticeId,
    practiceWeekdayTemplates,
    practiceTemplates,
    scheduleEvents,
    attendanceLogs,
    setAttendanceLogs,
    setRoster,
    saveStateToStorage,
    lastLocalEditTimeRef,
    flushAndSaveStateToStorage,
    debouncedSave,
    changeCurrentWeek,
    setActiveUnit,
  });

  const {
    handleUpdatePracticeMeta,
    handleQuickCreatePlanFromSchedule,
    handleOpenNewPracticeModal,
    handleEditPracticeDetails,
    handleAutoNumberPractices,
    handleDeletePractice,
    handleApplyPracticeTemplate,
    applyTemplateToFutureWeekdayPlans,
    handleSaveCurrentAsTemplate,
    handleTogglePracticeCancelled,
    handleTogglePracticeNonPractice,
    handleAddPeriod,
    handleRemovePeriod,
    handleMovePeriod,
    handleUpdatePeriodTime,
    handleUpdatePeriodCategory,
    handleUpdatePeriodFormat,
    handleAddStationToPeriod,
    handleRemoveStationFromPeriod,
    handleUpdateStation,
    handleSelectDrillForStation,
  } = usePracticePlanActions({
    scheduleEvents,
    practiceData,
    latestStateRef,
    practiceTemplates,
    practiceWeekdayTemplates,
    activeTeamId,
    updatePracticeDataAndSave,
    setCurrentPracticeId,
    currentPracticeId,
    setScheduleEvents,
    debouncedSave,
    handleSyncPracticeToPlan,
    ensureWeekExists,
    changeCurrentWeek,
    setActiveUnit,
    attendanceLogs,
    setDeletedPracticePlanIds,
    handleDeleteScheduleEvent,
    setAttendanceLogs,
    flushAndSaveStateToStorage,
    seasonConfig,
    activeTeamPracticeData,
    lastLocalEditTimeRef,
    setPracticeTemplates,
    currentPracticeIdRef,
    cascadingDrills,
  });


  const {
    handleUpdatePlayerInRoster,
    handleUpdateRoster,
  } = useRosterActions({
    setRoster,
    latestStateRef,
    setWeeklyData,
    roster,
    debouncedSave,
  });



  const {
    handleUpdateCallSheetData,
    handleUpdateWristbandData,
    handleCopyWristbandFromPreviousWeek,
    handleCopyCallSheetFromPreviousWeek,
  } = useGameDayActions({
    lastLocalWristbandEditTimeRef,
    effectiveWristbandRef,
    currentWeekRef,
    activeTeamIdRef,
    lastLocalEditTimeRef,
    setWristbandData,
    latestStateRef,
    activeTeamId,
    currentWeek,
    setWeeklyData,
    defaultFormations,
    lastLocalCallSheetEditTimeRef,
    callSheetData,
    playDatabase,
    setCallSheetData,
    flushAndSaveStateToStorage,
    weeklyData,
    seasonConfig,
    resolveWeekState,
    effectiveWristbandData,
    setSyncStatus,
  });


  const {
    handleAdminPasscodeSignIn,
    handleSetAndSignInWithAdminPasscode,
    handleLocalDeveloperSignIn,
    handleSetAdminPasscode,
  } = useAdminSignIn({
    setAdminPasscodeSet,
    applyRemoteState,
    setCurrentUser,
    setIsPendingApproval,
    setIsAuthModalOpen,
    setUserRole,
    applyUserPreferencesOnLogin,
  });


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

  // The depth chart board (field view on computers, Pocket Depth Card on phones).
  // readOnly shows it as a non-admin sees it: used by the Mobile HUD, whose saves
  // would otherwise be tagged with the wrong unit. Editing happens on the Depth screen.
  const renderFormationsView = (
    unit: 'offense' | 'defense' | 'st' | 'groups',
    opts: { readOnly?: boolean; key?: string } = {}
  ) => (
        <FormationsView
        key={opts.key || unit}
        unit={unit}
        formations={currentFormations}
        depthChart={currentDepthChart}
        selectedFormationId={selectedFormationId}
        onSelectFormation={setSelectedFormationId}
        userRole={opts.readOnly ? 'assistant' : userRole}
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
        isLockedByOther={opts.readOnly ? false : isLockedByOther}
        lockHolderName={lockHolderName}
        lockHolderEmail={lockHolderEmail}
        isHeldByMe={opts.readOnly ? false : isHeldByMe}
        onAcquireLock={() => handleAcquireLock(currentDepthUnit, currentWeek, false)}
        onReleaseLock={() => handleReleaseLock(currentDepthUnit, currentWeek)}
        onTakeOverLock={() => handleTakeOverLock(currentDepthUnit, currentWeek)}
      />
  );

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
            const existingWeek = storedWeekForWrite(prev, activeTeamId, currentWeek);
            const updatedWeek = {
              ...existingWeek,
              opponent: opp,
              scouting: {
                ...(existingWeek.scouting || {}),
                opponent: opp,
              },
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
                renderDepthCard={(unit) => renderFormationsView(unit, { readOnly: true, key: `hud-${unit}` })}
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

                {renderFormationsView(
                  activeUnit === 'depth_chart'
                    ? (['offense', 'defense', 'st', 'groups'].includes(depthSubUnit) ? (depthSubUnit as 'offense' | 'defense' | 'st' | 'groups') : 'offense')
                    : (activeUnit as 'offense' | 'defense' | 'st' | 'groups')
                )}
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
                    const existingWeek = storedWeekForWrite(prev, activeTeamId, currentWeek);
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
                  debouncedSave('plays');
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
                previousWeekLabel={previousWeekCopyLabel}
                onCopyWristbandFromPreviousWeek={handleCopyWristbandFromPreviousWeek}
                onCopyCallSheetFromPreviousWeek={handleCopyCallSheetFromPreviousWeek}
                scouting={currentWeekState.scouting || {}}
                onUpdateScouting={persistWeekScouting}
                ownTeamScout={ownTeamHudlScout[activeTeamId] || ownTeamHudlScout.team_10u}
                onUpdateOwnTeamScout={persistOwnTeamHudlScout}
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
                  debouncedSave('plays');
                }}
                onUpdateWristbandData={handleUpdateWristbandData}
                previousWeekLabel={previousWeekCopyLabel}
                onCopyWristbandFromPreviousWeek={handleCopyWristbandFromPreviousWeek}
              />
            )}

            {/* Call Sheet (Interactive Offense & Defense Sideline Call Sheet) */}
            {activeUnit === 'call_sheet' && (
              <CallSheetMainView
                key={`cs-${activeTeamId}-${currentWeek}`}
                activeTeamName={currentActiveTeam?.name || 'Mahopac 10U'}
                masterPlayLibrary={masterPlayLibrary}
                onUpdateMasterPlayLibrary={(newPlays) => {
                  setMasterPlayLibrary(newPlays);
                  latestStateRef.current.masterPlayLibrary = newPlays;
                  safeJSONSet('footballMasterPlays', newPlays);
                  debouncedSave('plays');
                }}
                playDatabase={playDatabase}
                onUpdatePlayDatabase={(newDb) => {
                  setPlayDatabase(newDb);
                  latestStateRef.current.playDatabase = newDb;
                  safeJSONSet('footballPlayDatabase', newDb);
                  debouncedSave('plays');
                }}
                callSheetData={callSheetData}
                onUpdateCallSheetData={handleUpdateCallSheetData}
                deletedPlayIds={deletedPlayIds}
                onUpdateDeletedPlayIds={(newDeleted) => {
                  setDeletedPlayIds(newDeleted);
                  latestStateRef.current.deletedPlayIds = newDeleted;
                  safeJSONSet('footballDeletedPlayIds', newDeleted);
                  debouncedSave('plays');
                }}
                wristbandData={effectiveWristbandData}
                previousWeekLabel={previousWeekCopyLabel}
                onCopyCallSheetFromPreviousWeek={handleCopyCallSheetFromPreviousWeek}
              />
            )}

            {/* 4. Hudl Scout */}
            {(activeUnit === 'hudl_scout' || activeUnit === 'scouting') && (
              <ScoutingView
                key={`hudl-${activeTeamId}`}
                scouting={currentWeekState.scouting || {}}
                userRole={userRole}
                currentUser={currentUser}
                staffList={staffList}
                savedCoaches={savedCoaches}
                scheduleEvents={activeTeamScheduleEvents}
                currentWeek={currentWeek}
                activeTeamName={currentActiveTeam?.name || 'Mahopac 10U'}
                ownTeamScout={ownTeamHudlScout[activeTeamId] || ownTeamHudlScout.team_10u}
                onUpdateOwnTeamScout={persistOwnTeamHudlScout}
                onUpdateScouting={persistWeekScouting}
                onNavigateToSchedule={() => setActiveUnit('schedule')}
                onNavigateToTendencies={() => setActiveUnit('tendencies')}
                onNavigateToHtmlTendencies={() => setActiveUnit('tendencies')}
              />
            )}

            {/* Tendencies View (Same layout and functionality as Playbooks & Guides) */}
            {(activeUnit === 'tendencies' || activeUnit === 'html_tendencies') && (
              <TendenciesView
                scouting={currentWeekState.scouting || {}}
                onUpdateScouting={persistWeekScouting}
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
                weekdayTemplates={practiceWeekdayTemplates}
                onApplyWeekdayToUpcoming={(day, templateName) => {
                  const resolved = templateName || 'Standard Practice';
                  if (!confirmWeekdayTemplateApply(day, resolved)) return;
                  const next = { ...practiceWeekdayTemplates };
                  if (resolved && resolved !== 'Standard Practice') next[day] = resolved;
                  else delete next[day];
                  lastLocalEditTimeRef.current = Date.now();
                  setPracticeWeekdayTemplates(next);
                  latestStateRef.current.practiceWeekdayTemplates = next;
                  safeJSONSet('footballPracticeWeekdayTemplates', next);
                  debouncedSave('drills');
                  const applied = applyTemplateToFutureWeekdayPlans(day, resolved);
                  if (applied === 0) {
                    alert(`No upcoming ${day} practice plans found this year.`);
                  } else if (applied > 0) {
                    alert(
                      `Updated ${applied} upcoming ${day} practice plan${applied === 1 ? '' : 's'}. Past ${day} plans were not changed.`
                    );
                  }
                }}
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
          {!['home', 'mobile_hub', 'game_day', 'wristband', 'drills', 'scouting', 'hudl_scout', 'guide', 'practice', 'users', 'schedule', 'compliance', 'call_sheet', 'whiteboard', 'ppr'].includes(
            activeUnit
          ) && (
            <div className="hidden lg:block shrink-0 w-80 self-start sticky top-[10rem] z-20 h-[calc(100dvh-11rem)] print:hidden">
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
            </div>
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
            ['game_day', 'wristband', 'call_sheet', 'scouting', 'hudl_scout', 'tendencies', 'html_tendencies'].includes(activeUnit)
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
        weekdayTemplates={practiceWeekdayTemplates}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSetWeekdayTemplate={(day, templateName) => {
          const next = { ...practiceWeekdayTemplates };
          if (templateName) next[day] = templateName;
          else delete next[day];
          lastLocalEditTimeRef.current = Date.now();
          setPracticeWeekdayTemplates(next);
          latestStateRef.current.practiceWeekdayTemplates = next;
          safeJSONSet('footballPracticeWeekdayTemplates', next);
          debouncedSave('drills');
        }}
        onApplyWeekdayToUpcoming={(day, templateName) => {
          const resolved = templateName || 'Standard Practice';
          if (!confirmWeekdayTemplateApply(day, resolved)) return;
          const applied = applyTemplateToFutureWeekdayPlans(day, resolved);
          if (applied === 0) {
            alert(`No upcoming ${day} practice plans found this year.`);
          } else if (applied > 0) {
            alert(
              `Updated ${applied} upcoming ${day} practice plan${applied === 1 ? '' : 's'}. Past ${day} plans were not changed.`
            );
          }
        }}
        onRenameTemplate={(oldName, newName) => {
          setPracticeTemplates((prev) => {
            const updated = { ...prev };
            updated[newName] = updated[oldName];
            delete updated[oldName];
            lastLocalEditTimeRef.current = Date.now();
            safeJSONSet('footballPracticeTemplates', updated);
            latestStateRef.current.practiceTemplates = updated;
            debouncedSave('practice');
            return updated;
          });
          setPracticeWeekdayTemplates((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const day of PRACTICE_WEEKDAY_NAMES) {
              if (next[day] === oldName) {
                next[day] = newName;
                changed = true;
              }
            }
            if (!changed) return prev;
            latestStateRef.current.practiceWeekdayTemplates = next;
            safeJSONSet('footballPracticeWeekdayTemplates', next);
            return next;
          });
        }}
        onDeleteTemplate={(name) => {
          setPracticeTemplates((prev) => {
            const updated = { ...prev };
            delete updated[name];
            lastLocalEditTimeRef.current = Date.now();
            safeJSONSet('footballPracticeTemplates', updated);
            latestStateRef.current.practiceTemplates = updated;
            debouncedSave('practice');
            return updated;
          });
          setPracticeWeekdayTemplates((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const day of PRACTICE_WEEKDAY_NAMES) {
              if (next[day] === name) {
                delete next[day];
                changed = true;
              }
            }
            if (!changed) return prev;
            latestStateRef.current.practiceWeekdayTemplates = next;
            safeJSONSet('footballPracticeWeekdayTemplates', next);
            return next;
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
        onSelectTheme={selectTheme}
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
