import type {
  AttendanceRecord,
  DrillFolder,
  FormationBoard,
  PlaybookGuideOrder,
  PlaybookGuideTree,
  PracticePeriod,
  PracticePlan,
  RosterPlayer,
  ScheduleEvent,
  SeasonConfig,
  StaffCoach,
  Team,
  WeekState,
  WristbandData,
} from '../types';
import type { CallSheetFullData, PlayDatabaseEntry } from '../types/callSheet';
import type { PracticeWeekdayTemplateMap } from '../utils/practiceUtils';
import type { PffGradeCriteriaMap, PffPlayerGroupOverrides } from '../utils/pprGroups';
import type { LiveDrillSlotLayouts } from '../components/practiceDrillsUtils';

// Snapshot of every shared board module that App mirrors into latestStateRef on
// each render, so save and sync code always reads the newest values.
export interface LatestAppState {
  weeklyData: Record<string, WeekState>;
  ownTeamHudlScout: Record<string, any>;
  defaultFormations: FormationBoard[];
  practiceData: PracticePlan[];
  practiceTemplates: Record<string, PracticePeriod[]>;
  practiceWeekdayTemplates: PracticeWeekdayTemplateMap;
  cascadingDrills: DrillFolder[];
  guideTree: PlaybookGuideTree;
  guideOrder: PlaybookGuideOrder;
  savedCoaches: string[];
  teamSavedCoaches: Record<string, string[]>;
  staffList: StaffCoach[];
  adminPasscodeSet: boolean;
  masterPlayLibrary: string[];
  playDatabase: PlayDatabaseEntry[];
  callSheetData: CallSheetFullData;
  wristbandData: WristbandData;
  globalIdleTimeoutMinutes: number;
  deletedPlayIds: string[];
  deletedFormationIds: string[];
  deletedPracticePlanIds: string[];
  deletedScheduleEventIds: string[];
  collapsedFolders: Record<string, boolean>;
  scheduleEvents: ScheduleEvent[];
  roster: RosterPlayer[];
  teams: Team[];
  seasonConfig: SeasonConfig;
  attendanceLogs: AttendanceRecord[];
  pffGradeCriteria: PffGradeCriteriaMap;
  pffPlayerGroups: PffPlayerGroupOverrides;
  liveDrillSlotLayouts: LiveDrillSlotLayouts;
}
