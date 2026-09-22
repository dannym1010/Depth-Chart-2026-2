export type UnitType = 
  | 'home'
  | 'mobile_hub'
  | 'game_day'
  | 'depth_chart'
  | 'offense' 
  | 'defense' 
  | 'st' 
  | 'groups' 
  | 'scrimmage' 
  | 'practice_live'
  | 'wristband' 
  | 'call_sheet'
  | 'schedule'
  | 'scouting' 
  | 'tendencies'
  | 'html_tendencies'
  | 'practice'
  | 'drills' 
  | 'compliance'
  | 'ppr'
  | 'guide' 
  | 'whiteboard'
  | 'users';

export type UserRole = 'admin' | 'assistant';

export interface CustomTabGroup {
  id: string;
  label: string;
  icon?: string; // emoji or icon name
  color?: string; // e.g. "indigo", "emerald", "amber", "cyan", "rose", "purple"
  tabIds: UnitType[];
  defaultTabId?: UnitType;
  hidden?: boolean; // When true, folder is hidden from navigation
  showOnMainBar?: boolean; // Whether folder displays on the main top tab line
}

export interface Team {
  id: string;
  name: string;
  ageGroup?: string; // e.g. "10U", "12U", "8U", "Flag"
  season?: string; // e.g. "2026", "Fall 2026"
  color?: string; // e.g. "indigo", "amber", "emerald", "sky", "rose", "purple"
  headCoachName?: string;
  calendarUrl?: string; // Team-specific TeamSnap / iCal schedule feed URL
  notes?: string;
}

export interface WeekOption {
  key: string;
  label: string;
  phase: 'preseason' | 'regular' | 'postseason' | 'custom';
}

export interface SeasonConfig {
  preseasonWeeksCount: number; // e.g. 4 (first 4 weeks are preseason)
  preseasonWeekKeys?: string[]; // e.g. ["0", "pre-2", "pre-3", "pre-4"]
  regularSeasonWeeksCount: number; // e.g. 8
  hasPlayoffs?: boolean;
  hasChampionship?: boolean;
  customWeekLabels?: Record<string, string>;
  customWeeks?: WeekOption[];
}

export interface AttendanceRecord {
  id: string;
  scheduleEventId?: string; // Links attendance log to a specific schedule event
  teamId?: string; // Links attendance log to a specific team
  date: string;
  week: string;
  title: string;
  sessionType: 'conditioning' | 'padded';
  hours: number;
  location?: string;
  presentPlayerNums: string[];
  absentPlayerNums: string[];
  excusedPlayerNums?: string[];
  notes?: string;
  timestamp: number;
  playerSessionTypes?: Record<string, 'conditioning' | 'padded'>; // Per-player override (e.g. conditioning for kids catching up while others are padded)
}

export type ScheduleEventType =
  | 'game'
  | 'practice'
  | 'scrimmage'
  | 'meeting'
  | 'walkthrough'
  | 'tournament';

export interface ScheduleEvent {
  id: string;
  teamId?: string; // Links event to a specific team
  type: ScheduleEventType;
  title: string;
  week: string; // e.g. "pre-1", "pre-2", "0", "1", "2", "3", "playoffs"
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "09:00" or "17:30"
  time?: string; // alias for startTime
  dayOfWeek?: string;
  endTime?: string; // e.g. "11:00" or "19:00"
  durationMinutes?: number; // event duration in minutes
  location: string; // e.g. "Mahopac High School - Turf Field"
  locationType?: 'home' | 'away' | 'neutral';
  opponent?: string; // e.g. "Carmel Rams 10U" (for games/scrimmages)
  uniform?: string; // e.g. "Gold Jerseys (Home)", "White / Blue (Away)"
  attireCategory?: 'conditioning' | 'padded' | 'helmets_only' | 'shells' | 'full_pads' | 'walkthrough';
  arrivalMinutesBefore?: number; // e.g. 60 min before game, 15 min before practice
  focusOrNotes?: string;
  linkedPracticePlanId?: string; // Links directly to a PracticePlan.id
  preGamePlanId?: string; // Dedicated link to pre-game practice / warmup plan (for game events)
  isCancelled?: boolean;
  cancellationReason?: string;
  isNonPractice?: boolean; // When true, labeled as non-practice event (excluded from practice day count)
  result?: {
    teamScore?: number;
    opponentScore?: number;
    outcome?: 'W' | 'L' | 'T';
    recapNotes?: string;
  };
  createdAt: number;
  lastEdited: number;
}

export interface RosterPlayer {
  id?: string;
  teamId?: string; // Links player to a specific team
  num: string;
  firstName: string;
  lastName: string;
  rosterName?: string; // Name displayed on Depth Chart, Formations & Positions (defaults to lastName)
  primaryPosition?: string; // e.g. "QB", "RB", "WR", "TE", "C", "LT", "DE", "MLB", etc.
  secondaryPosition?: string; // e.g. "FS", "CB", "DT", "OLB", etc.
  offensivePosition?: string;
  defensivePosition?: string;
  specialTeamsPosition?: string;
  conditioningHours?: number; // Target: 10 hrs required before allowed in full pads
  paddedHours?: number; // Target: 10 hrs in pads required before playing in scrimmage/games
  weeklyHours?: Record<string, number>; // week key -> hours logged
  notes?: string;
  isCaptain?: boolean;
}

// Youth Football Acclimatization Compliance Rules (Max 10 hours conditioning, Max 10 hours padded contact)
export const CONDITIONING_HOURS_REQUIRED = 10;
export const PADDED_HOURS_REQUIRED = 10;
export const MAX_CONDITIONING_HOURS = 10;
export const MAX_PADDED_HOURS = 10;

export interface PlayerComplianceStatus {
  conditioningHours: number;
  paddedHours: number;
  totalHours: number;
  isConditioningCleared: boolean; // >= 10 hrs (good)
  conditioningRemaining: number;
  isPadsCleared: boolean; // Can wear pads
  isScrimmageCleared: boolean; // >= 10 hrs in pads (good)
  paddedRemaining: number;
  complianceStage: 'conditioning_only' | 'pads_cleared' | 'scrimmage_cleared';
  statusText: string;
  badgeColor: string;
}

export function calculatePlayerCompliance(player: Partial<RosterPlayer>): PlayerComplianceStatus {
  // Enforce 10.0 hours max for conditioning and pads
  const rawCond = Number(player.conditioningHours || 0);
  const rawPadded = Number(player.paddedHours || 0);
  const conditioning = Math.min(MAX_CONDITIONING_HOURS, Math.max(0, rawCond));
  const padded = Math.min(MAX_PADDED_HOURS, Math.max(0, rawPadded));
  const total = conditioning + padded;

  const isConditioningCleared = conditioning >= CONDITIONING_HOURS_REQUIRED;
  const conditioningRemaining = Math.max(0, CONDITIONING_HOURS_REQUIRED - conditioning);

  const isPadsCleared = isConditioningCleared;
  const isScrimmageCleared = isPadsCleared && padded >= PADDED_HOURS_REQUIRED;
  const paddedRemaining = Math.max(0, PADDED_HOURS_REQUIRED - padded);

  let complianceStage: 'conditioning_only' | 'pads_cleared' | 'scrimmage_cleared' = 'conditioning_only';
  let statusText = `Needs Conditioning (${conditioning.toFixed(1)}/10.0 hrs • ${conditioningRemaining.toFixed(1)}h needed)`;
  // Red when not enough hours (< 10), green when good (>= 10)
  let badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';

  if (isScrimmageCleared) {
    complianceStage = 'scrimmage_cleared';
    statusText = `Fully Cleared (Good ✓) • 10.0h Cond + 10.0h Pads`;
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  } else if (isPadsCleared) {
    complianceStage = 'pads_cleared';
    statusText = `Needs Padded Hours (${padded.toFixed(1)}/10.0 hrs • ${paddedRemaining.toFixed(1)}h needed)`;
    // Lacks required padded hours (< 10) -> Red
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  }

  return {
    conditioningHours: conditioning,
    paddedHours: padded,
    totalHours: total,
    isConditioningCleared,
    conditioningRemaining,
    isPadsCleared,
    isScrimmageCleared,
    paddedRemaining,
    complianceStage,
    statusText,
    badgeColor,
  };
}

export function formatWeekLabel(weekKey: string, config?: SeasonConfig): string {
  if (!weekKey) return 'Week 1';
  const clean = weekKey.toLowerCase().trim();
  
  if (config?.customWeekLabels && config.customWeekLabels[weekKey]) {
    return config.customWeekLabels[weekKey];
  }

  if (clean === '0' || clean === 'pre-1' || clean === 'pre1' || clean === 'preseason-1') {
    return 'Pre-Season Week 1';
  }
  if (clean === 'pre-2' || clean === 'pre2' || clean === 'preseason-2') {
    return 'Pre-Season Week 2';
  }
  if (clean === 'pre-3' || clean === 'pre3' || clean === 'preseason-3') {
    return 'Pre-Season Week 3';
  }
  if (clean === 'pre-4' || clean === 'pre4' || clean === 'preseason-4') {
    return 'Pre-Season Week 4';
  }
  if (clean === 'playoffs' || clean === 'playoff' || clean === 'post') {
    return 'Playoffs';
  }
  if (clean === 'championship') {
    return 'Championship';
  }

  const numeric = parseInt(clean.replace(/\D/g, ''), 10);
  if (!isNaN(numeric)) {
    if (clean.startsWith('pre')) {
      return `Pre-Season Week ${numeric}`;
    }
    return `Week ${numeric}`;
  }
  return `Week ${weekKey}`;
}

export interface PlacedPlayer {
  name: string;
  num: string;
}

export interface PositionSlot {
  id: string;
  name: string;
  tag?: string;
}

export interface FormationRow {
  id: string;
  label: string;
  slotCount: number;
  positions: (PositionSlot | null)[];
  rowClass?: string;
}

export interface FormationBoard {
  id: string;
  unit: 'offense' | 'defense' | 'st' | 'groups';
  name: string;
  subtitle?: string;
  collapsed?: boolean;
  rows: FormationRow[];
}

export interface WristbandPlay {
  text: string;
  formation?: string;
  type?: string;
  customLabel?: string;
  highlightColor?: string; // e.g. 'yellow' | 'lime' | 'cyan' | 'rose' | 'amber' | 'purple' or hex
  numberHighlightColor?: string; // highlight just the play number badge
  numberTextColor?: string; // text/font color for the play number (e.g. black, white, red, etc.)
  wristbandNum?: number | string;
  rowHighlightColor?: string;
}

export interface WristbandColumn {
  name?: string;
  color: string;
  numberBgColor?: string; // color for highlighting just the play number column
  numberTextColor?: string; // text/font color of the play numbers in this column
  headerTextColor?: string; // text color of the column header (or auto-contrast)
  highlightNumberOnly?: boolean;
  labelPrefix?: string;
  plays: WristbandPlay[];
}

export interface SingleWristband {
  id: string;
  title: string;
  subtitle?: string;
  labelingMode?: 'same_per_card' | 'continuous' | 'letter_num' | 'custom';
  startNumber?: number;
  rowsCount?: number;
  highlightTheme?: string;
  highlightTarget?: 'number_only' | 'full_row'; // Toggle whether highlight applies to just the play number column or the full row
  columns: WristbandColumn[];
}

export interface WristbandData {
  title?: string;
  rows?: number;
  columns?: WristbandColumn[];
  copiesPerPage?: number;
  activeWristbandId?: string;
  wristbands?: SingleWristband[];
  lastEdited?: number;
}

export interface CoachScoutingNote {
  id: string;
  coachEmail?: string;
  coachName?: string;
  author?: string;
  authorRole?: string;
  category?: string; // e.g. "Defense & Fronts", "Offense & Plays", "Special Teams", "O-Line & Blocking", "QB Reads", "Adjustments", "General"
  title: string;
  content: string;
  createdAt?: number;
  timestamp?: number;
  lastEdited?: number;
  lastEditedBy?: string;
}

export interface OpponentKeyPlayer {
  id: string;
  num?: string;
  jersey?: string;
  name: string;
  pos?: string;
  position?: string;
  threatLevel: 'High' | 'Medium' | 'Low';
  notes: string;
}

export interface ScoutingAttachment {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'html';
  dataUrl?: string; // Base64 data URI for PDF or image
  htmlCode?: string; // Raw HTML markup for HTML reports or embeds
  fileSize?: string; // e.g. "450 KB"
  caption?: string; // Coach context or notes
  createdAt: number;
  notes?: CoachScoutingNote[];
}

export interface ScoutingData {
  year?: string;
  week?: string;
  opponent?: string;
  gameDate?: string;
  gameLocation?: string;
  overviewNotes?: string;
  teamOverview?: string;
  offensiveTendencies?: string;
  offenseTendencies?: string;
  offenseFormations?: string;
  runPassRatio?: string;
  gameplanDefense?: string;
  defensiveFronts?: string;
  defenseFront?: string;
  defenseCoverage?: string;
  defenseTendencies?: string;
  gameplanOffense?: string;
  specialTeamsNotes?: string;
  keysToVictory?: string[];
  keyPlayersList?: OpponentKeyPlayer[];
  keyPlayers?: any;
  coachNotes?: CoachScoutingNote[];
  attachments?: ScoutingAttachment[];
  customHtmlReport?: string;
  tendenciesTree?: PlaybookGuideTree;
  tendenciesOrder?: PlaybookGuideOrder;
}

export type DepthSubUnit = 'offense' | 'defense' | 'st' | 'groups' | 'scrimmage' | 'practice_live';

export type LiveDrillFormat = '7v7' | '11v11' | '9v9' | '1v1' | 'custom';

export interface LiveDrillPosition {
  id: string;
  name: string; // e.g. "QB", "RB", "WR (X)", "LT", "CB1", "MLB", etc.
  unit: 'offense' | 'defense';
}

export interface LiveDrillGroup {
  id: string;
  name: string; // e.g., "Period 4: 7v7 Pass Skeleton"
  format: LiveDrillFormat;
  customFormatLabel?: string;
  offenseLabel: string; // e.g., "1st Team Offense (Gold)"
  defenseLabel: string; // e.g., "1st Team Defense (Blue)"
  offenseTeam1Label?: string;
  offenseTeam2Label?: string;
  offenseTeam3Label?: string;
  defenseTeam1Label?: string;
  defenseTeam2Label?: string;
  defenseTeam3Label?: string;
  offenseColor?: string; // e.g., 'gold' | 'blue' | 'red' | 'green' | 'black' | 'white' | 'orange' | 'purple' | 'navy'
  defenseColor?: string; // e.g., 'blue' | 'gold' | 'red' | 'navy' | 'black' | 'white' | 'green'
  offenseTeam2Color?: string;
  defenseTeam2Color?: string;
  offenseTeam3Color?: string;
  defenseTeam3Color?: string;
  /** How many 1s/2s/3s teams to show. Missing means 3. */
  teamCount?: 1 | 2 | 3;
  notes?: string;
  offensePositions: LiveDrillPosition[];
  defensePositions: LiveDrillPosition[];
  lineup: Record<string, PlacedPlayer[]>; // position.id -> PlacedPlayer[]
  createdAt?: number;
  lastEdited?: number;
}

export type FilmUnitColor = 'gold' | 'blue' | 'black';
export type FilmOdk = 'offense' | 'defense' | 'special';
export type FilmStKind = 'kickoff' | 'kickReturn' | 'punt' | 'fgxp';

export interface FilmPlayerRef {
  num: string;
  id?: string;
  name?: string;
}

export interface HudlImportedPlay {
  id: string;
  playNumber: string;
  odk: FilmOdk;
  quarter?: string;
  down?: string;
  distance?: string;
  yardLine?: string;
  hash?: string;
  series?: string;
  gain?: string;
  result?: string;
  playType?: string;
  playDir?: string;
  team?: string;
  rusher?: string;
  passer?: string;
  receiver?: string;
  keyPlayer?: string;
  efficient?: string;
}

export interface FilmPlayAssignment {
  color: FilmUnitColor;
  odkOverride?: FilmOdk;
  stKindOverride?: FilmStKind;
  slotOverrides: Record<string, FilmPlayerRef | null>;
  grades: Record<string, Record<string, string>>;
  playerNotes?: Record<string, string>;
  updatedAt?: number;
}

export interface FilmSession {
  plays: HudlImportedPlay[];
  packages: {
    offense: Record<FilmUnitColor, Record<string, FilmPlayerRef | null>>;
    defense: Record<FilmUnitColor, Record<string, FilmPlayerRef | null>>;
    special?: Record<FilmStKind, Record<FilmUnitColor, Record<string, FilmPlayerRef | null>>>;
  };
  assignments: Record<string, FilmPlayAssignment>;
  importedAt?: number;
  fileName?: string;
  packagesUpdatedAt?: number;
  /** Depth index 0/1/2 maps to black/gold/blue. Missing = older gold/blue/black fill. */
  packagesColorOrder?: string;
  /** Custom display names for PFF slots, keyed as "offense:QB" or "special:kickoff:L1". */
  slotLabels?: Record<string, string>;
}

export interface WeekState {
  formations?: FormationBoard[];
  depthChart?: Record<string, PlacedPlayer[]>;
  scrimmageChart?: Record<string, PlacedPlayer[]>;
  practiceDrillGroups?: LiveDrillGroup[];
  pprPlayCounts?: Record<string, { offense: number; defense: number }>;
  pffReviews?: Record<
    string,
    {
      playNumber?: string;
      notes?: string;
      grade?: string;
      plays?: Array<{
        id: string;
        playNumber?: string;
        notes?: string;
        grade?: string;
        grades?: Record<string, string>;
      }>;
    }
  >;
  filmSession?: FilmSession;
  opponent?: string;
  wristbandData?: WristbandData;
  scouting?: ScoutingData;
}

export interface DrillItem {
  id?: string;
  name: string;
  desc: string;
  key: string;
}

export interface DrillFolder {
  name: string;
  subfolders: DrillFolder[];
  drills: DrillItem[];
}

export interface PracticeStation {
  name: string;
  desc: string;
  coach: string;
  focus: string;
}

export interface PracticePeriod {
  time: number;
  category: string;
  format: 'static' | 'rotating';
  stations: PracticeStation[];
  name?: string;
  title?: string;
  duration?: number;
  durationMinutes?: number;
}

export interface PracticePlan {
  id: string;
  teamId?: string; // Links practice plan to a specific team
  year: string;
  weekFolder: string;
  dayFolder?: string;
  title: string;
  name?: string;
  date: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  isCancelled?: boolean; // When true, excluded from practice number/held count
  cancellationReason?: string;
  isNonPractice?: boolean; // When true, labeled as non-practice event (excluded from practice day total count)
  practiceNumber?: number; // Sequential practice day number from start of season (Day 1 on 8/3)
  lastEdited?: number;
  createdAt?: number;
  plan?: PracticePeriod[];
  periods?: PracticePeriod[];
}

export interface PracticeTemplate {
  name: string;
  periods: PracticePeriod[];
}

export interface StaffCoach {
  email: string;
  name?: string;
  role: string;
  status: 'Active' | 'Pending';
  assignedTeamIds?: string[]; // IDs of teams this coach has access to. If undefined or includes 'all', coach has access to all teams.
  favoriteTeamId?: string; // Startup / favorite team linked to this user login
  startScreen?: UnitType; // Startup screen linked to this user login
  startDepthSubUnit?: DepthSubUnit;
  idleTimeoutMinutes?: number; // Inactivity logout timeout in minutes (e.g. 10, 15, 30, 60, 120, 240, or 0 = disabled/never)
}

export interface PlaybookGuideTree {
  [mainCategory: string]: {
    [subTab: string]: string; // URL / data URI
  };
}

export interface PlaybookGuideOrder {
  main: string[];
  sub: Record<string, string[]>;
}

export interface SectionLock {
  id: string; // e.g. "team_10u_week_1_offense" or "team_10u_week_1_all"
  teamId: string;
  week: string;
  unit: string; // 'offense' | 'defense' | 'st' | 'groups' | 'scrimmage' | 'practice' | 'all'
  holderEmail: string;
  holderName: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface WhiteboardTextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  isBoxed?: boolean;
  fontWeight?: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface PlayResponsibility {
  position: string;
  alignment: string;
  runResponsibility: string;
  passResponsibility: string;
}

export interface WhiteboardToken {
  id: string;
  type: 'X' | 'O' | 'ball' | 'cone' | 'bag' | 'square' | 'letter' | 'target' | 'text' | 'triangle' | 'diamond' | 'star';
  label: string;
  x: number;
  y: number;
  shape?: 'circle' | 'square' | 'triangle' | 'diamond' | 'star';
  color?: string;
  fillMode?: 'fill' | 'nofill'; // 'fill' = solid colored background, 'nofill' = transparent center with colored outline
  radius?: number;
  subLabel?: string;
  isSquare?: boolean;
  fontSize?: number;
  fontWeight?: string;
  isDraggable?: boolean;
}

export interface WhiteboardArrow {
  id: string;
  type: 'blitz' | 'straight' | 'curved' | 'block' | 'drop' | 'run' | 'pass' | 'tackle';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  controlX?: number;
  controlY?: number;
  color: string;
  dashed?: boolean;
  label?: string;
  labelX?: number;
  labelY?: number;
}

export interface WhiteboardZoneBubble {
  id: string;
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  opacity?: number;
  labelX?: number;
  labelY?: number;
  shape?: 'ellipse' | 'circle' | 'rect';
  fillMode?: 'fill' | 'nofill';
}

export interface WhiteboardPlay {
  id: string;
  title: string;
  objective?: string;
  cues?: string[];
  faults?: string[];
  tokens: WhiteboardToken[];
  arrows: WhiteboardArrow[];
  zones: WhiteboardZoneBubble[];
  textElements?: WhiteboardTextElement[];
  responsibilities?: PlayResponsibility[];
  notes?: string[];
  videoUrl?: string;
  hudlPlaybookName?: string;
  formationName?: string;
  createdAt?: number;
}

