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
  wristbandPresetMode?: 'full_two_col' | 'full_four_col' | 'wb_color_col' | 'col_1' | 'col_2' | 'col_both_split';
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
  /** Team and week this sheet was saved for; sheets for another week are ignored when syncing. */
  teamId?: string;
  week?: string;
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

/** Everything the play builder needs to re-open a play: the look, the play, the moved spots and the lines drawn. */
export interface PlayBuilderState {
  personnel: number;
  baseKey: string;
  backfield: string;
  conceptKey: string;
  runId: string;
  family: 'all' | 'run' | 'pass' | 'option' | 'screen';
  strength: 'Left' | 'Right';
  hash: 'Left' | 'Middle' | 'Right';
  hole: number | '';
  ball: string;
  tags: string[];
  coachNote: string;
  situations: string[];
  defenseKey: string;
  putDefInName: boolean;
  overrides: Record<string, { x: number; y: number }>;
  /** The lines as the coach drew them (missing = the builder's own drawing). */
  strokes?: unknown[];
  /** Names the coach gave players on the diagram, by role (e.g. MIKE: "Sam"). */
  labels?: Record<string, string>;
  /** Which unit's depth chart tags our defenders (Black 1s, Gold 2s, Blue 3s), or 'off'. */
  defenseUnit?: 'black' | 'gold' | 'blue' | 'off';
  /** A defender the coach set by hand instead of the depth chart, by role. */
  defenseWho?: Record<string, { num: string; name: string; unit?: 'black' | 'gold' | 'blue'; pos?: string }>;
  /** Our call on top of the front: a blitz or stunt, and a coverage (drawn from the picks). */
  defensePressure?: string;
  defenseCoverage?: string;
  /** Jobs the coach gave single defenders over the call (by role): "zone:flatL", "blitz:B", "man"... */
  defenseAssign?: Record<string, string>;
  /** The coach picked this play's defense himself: it stays, even when their formation has another. */
  defenseOwn?: boolean;
  /** What our defenders' boxes say: their position (default) or the tagged player's jersey number. */
  defenseShow?: 'position' | 'number';
  /** Our defensive plays: each defender's job as the coach typed it, by role (the rest come from the drawing). */
  jobs?: Record<string, string>;
  /** Who was tagged on each defender when the play was saved (so a redraw keeps the tags). */
  defensePlayers?: Record<string, { num: string; name: string; unit?: 'black' | 'gold' | 'blue'; pos?: string }>;
  /** The name as the coach typed it (a scout play keeps this instead of the generated call). */
  name?: string;
}

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
  /** Our defensive look drawn / saved with this offensive play. */
  vsDefense?: string;
  /** The play builder's settings for this play, so its diagram re-opens as it was left. */
  builder?: PlayBuilderState;
  notes?: string;
  isFavorite?: boolean;
  /** Playbook section the play sits under in Hudl (e.g. "PLAY ACTION PASS"). */
  category?: string;
  /** Hudl install the play came from (e.g. "2026 10U Install"). */
  install?: string;
  /** Each position's job, read from the Hudl install sheet. */
  assignments?: PlayAssignment[];
  /** Where the play came from: 'hudl' for Hudl playbook imports. */
  source?: string;
  importedAt?: number;
  /** Picture of the play drawn in Hudl (from the install PDF). */
  diagramUrl?: string;
  /** The picture the play came with (a playbook import), kept when it was redrawn here. */
  importDiagramUrl?: string;
  /** Fingerprint of that picture, to spot a changed diagram when the install is uploaded again. */
  diagramHash?: string;
  /** When a coach last changed this play (decides which copy wins when two coaches' Play Banks merge). */
  editedAt?: number;
  /** The team this play belongs to (plays without one are 10U's, the original team). */
  teamId?: string;
}

export interface PlayAssignment {
  pos: string;
  text: string;
}
