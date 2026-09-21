export type PlayType =
  | 'run'
  | 'pass'
  | 'screen'
  | 'rpo'
  | 'play_action'
  | 'trick'
  | 'two_point'
  | 'blitz'
  | 'coverage'
  | 'goal_line';

export interface CallSheetPlay {
  id: string;
  name: string;
  formation?: string;
  type?: PlayType;
  wristbandNum?: number | string;
  wristbandLabel?: string;
  wristbandId?: string;
  wristbandTitle?: string;
  wristbandColor?: string;
  wristbandNumberColor?: string;
  wristbandTextColor?: string;
  wristbandRowColor?: string;
  wristbandHighlightTarget?: 'number_only' | 'full_row';
  isHighlighted?: boolean;
  highlightColor?: string;
  wristbandSlotMatch?: {
    wristbandId: string;
    wristbandTitle: string;
    cardLabel?: string;
    slotNumber: number | string;
    colIdx?: number;
    rowIdx?: number;
    color?: string;
    numberBgColor?: string;
    numberTextColor?: string;
    rowHighlightColor?: string;
    highlightTarget?: 'number_only' | 'full_row';
  };
  personnel?: string;
  notes?: string;
  isCalled?: boolean;
  isStarred?: boolean;
  gainYards?: number;
}

export interface CallSheetSection {
  id: string;
  title: string;
  subtitle?: string;
  headerBgColor: string;
  headerTextColor: string;
  targetUnit: 'offense' | 'defense';
  group: 'top_situations' | 'red_zone' | 'tempo_game_mgmt' | 'script' | 'custom';
  slotsCount: number; // number of rows/slots
  columnsCount?: number; // 1, 2, 3, or 4 columns within the section table
  columnHeaders?: string[]; // Optional sub-column headers for multi-column tables
  colSpan?: number; // Number of columns this section card spans in the outer grid (1, 2, 3, or 4)
  wristbandId?: string; // Linked wristband ID if generated from wristband preset
  wristbandPresetMode?: 'full_two_col' | 'col_1' | 'col_2' | 'col_both_split';
  wristbandColIdx?: number;
  highlightEnabled?: boolean; // toggle highlight tint on or off
  highlightColor?: string; // e.g. 'rose' | 'yellow' | 'emerald' | 'cyan' | 'purple' or hex
  plays: (CallSheetPlay | null)[];
  rowIndex?: number; // Row index tier in call sheet (e.g. Row 1, Row 2, Row 3)
  order?: number; // Ordering index within the row
}

export interface TwoPointRule {
  pointDiff: number;
  leadAction: 'Go for 1' | 'Go for 2';
  leadHighlight: boolean;
  trailAction: 'Go for 1' | 'Go for 2' | 'Decision';
  trailHighlight: boolean;
  notes?: string;
}

export interface TimeoutsState {
  firstHalfUs: boolean[]; // true = available, false = used
  firstHalfOpp: boolean[];
  secondHalfUs: boolean[];
  secondHalfOpp: boolean[];
}

export interface CallSheetFullData {
  teamId?: string;
  title: string;
  topSituationsTitle?: string;
  redZoneTitle?: string;
  tempoTitle?: string;
  customTitle?: string;
  opponent?: string;
  gameDate?: string;
  desktopGridColumns?: number; // 2, 3, 4, or 5 columns on desktop grid
  highlightRedZone: boolean;
  offenseSections: CallSheetSection[];
  defenseSections: CallSheetSection[];
  offenseScript: (CallSheetPlay | null)[];
  defenseScript: (CallSheetPlay | null)[];
  scriptColumnsCount?: number;
  scriptHighlightEnabled?: boolean;
  twoPointRules?: TwoPointRule[];
  twoPointHighlightEnabled?: boolean;
  timeoutsCount?: number; // default 3 per half
  timeoutsHighlightEnabled?: boolean;
  timeouts: TimeoutsState;
  lastEdited?: number;
}

export type CallSheetData = CallSheetFullData;

export interface PlayDatabaseEntry {
  id: string;
  name: string;
  unit: 'offense' | 'defense';
  formation: string;
  type: PlayType;
  situations: string[]; // e.g. ["1-10", "2nd long", "2nd med", "2nd & short (SHOT)", "3rd long", "3rd med", "3rd short", "3rd & 1", "4th & 1", "Backed Up (inside 5)", "TRICKS", "RED ZONE", "2 pt Special", "Goaline Pass", "2 MIN O", "4 Min O", "RUN CLOCK"]
  concept?: string;
  personnel?: string;
  wristbandNum?: number | string;
  wristbandLabel?: string;
  wristbandColor?: string;
  wristbandNumberColor?: string;
  wristbandTextColor?: string;
  wristbandHighlightTarget?: 'number_only' | 'full_row';
  wristbandSlotMatch?: {
    wristbandId: string;
    wristbandTitle: string;
    cardLabel: string;
    slotNumber: number | string;
    numberBgColor?: string;
    rowHighlightColor?: string;
    highlightTarget?: 'number_only' | 'full_row';
  };
  tags?: string[];
  notes?: string;
  isFavorite?: boolean;
}
