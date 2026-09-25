export interface HudlRawRow {
  [key: string]: string;
}

export type PlayType = 'RUN' | 'PASS' | 'RPO' | 'SCREEN' | 'SPECIAL' | 'PENALTY' | 'OTHER';

export type FieldZone = 'backed_up' | 'own_territory' | 'plus_territory' | 'red_zone' | 'goal_line';

export type HashPosition = 'L' | 'M' | 'R';

/** Which of our units was on the field (our-team play log only). */
export type TeamUnit = 'black' | 'blue' | 'gold';

export interface Play {
  id: string;
  playNumber: number;
  odk: 'O' | 'D' | 'K' | 'S' | 'UNKNOWN';
  quarter: number;
  down: number;
  distance: number;
  yardLine: number; // 1 to 99 relative to opponent goal line (100 - own yard)
  rawYardLine: string; // e.g. "-25", "+35", "OWN 25", "OPP 40"
  yardLineSide: 'OWN' | 'OPP' | 'MID';
  fieldZone: FieldZone;
  hash: HashPosition;
  playType: PlayType;
  formation: string;
  backfield: string;
  motion: string;
  playName: string;
  direction: string;
  gainLoss: number;
  result: string;
  personnel: string;
  carrierOrTarget: string;
  oppRusher?: string;
  oppPasser?: string;
  oppReceiver?: string;
  series?: number;
  isExplosive: boolean;
  isEfficient: boolean;
  notes?: string;
  /** L/R/M of the run/pass attack, independent of field/boundary wording. */
  runSide: HashPosition;
  gameId?: string;
  /** Our unit on the field for this play (Black / Blue / Gold), tagged by a coach. */
  unit?: TeamUnit;
}

export interface DownDistGroup {
  label: string;
  down: number;
  distMin: number;
  distMax: number;
  count: number;
  runCount: number;
  passCount: number;
  runPct: number;
  passPct: number;
  avgGain: number;
  successRate: number;
  topFormations: { name: string; count: number; pct: number }[];
  topPlays: { name: string; type: PlayType; count: number; avgGain: number }[];
  primaryDirection: string;
  defensiveAlert: string;
}

export interface FormationStat {
  formation: string;
  count: number;
  pctOfTotal: number;
  runCount: number;
  passCount: number;
  runPct: number;
  passPct: number;
  avgGain: number;
  efficiencyRate: number;
  explosiveRate: number;
  topPlays: { name: string; count: number; runOrPass: string; avgGain: number }[];
  hashBias: { left: number; middle: number; right: number };
  motionPct: number;
}

export interface OpponentTell {
  id: string;
  category: 'FORMATION' | 'DOWN_DISTANCE' | 'HASH' | 'MOTION' | 'BACKFIELD' | 'RED_ZONE';
  title: string;
  trigger: string;
  statEvidence: string;
  confidencePct: number;
  sampleSize: number;
  recommendedCounter: string;
  severity: 'HIGH' | 'MEDIUM' | 'NOTABLE';
}

export interface TendencyAnalysis {
  totalPlays: number;
  runPlays: number;
  passPlays: number;
  runPct: number;
  passPct: number;
  avgGainOverall: number;
  avgGainRun: number;
  avgGainPass: number;
  overallEfficiencyRate: number;
  explosivePlayCount: number;
  explosivePlayRate: number;
  thirdDownConversions: {
    total: number;
    converted: number;
    rate: number;
    short: { total: number; converted: number; rate: number; runPct: number; passPct: number };
    medium: { total: number; converted: number; rate: number; runPct: number; passPct: number };
    long: { total: number; converted: number; rate: number; runPct: number; passPct: number };
  };
  redZonePlays: {
    total: number;
    runPct: number;
    passPct: number;
    avgGain: number;
    topPlays: { name: string; count: number }[];
  };
  situationalGroups: DownDistGroup[];
  formations: FormationStat[];
  hashTendencies: {
    left: { total: number; runPct: number; passPct: number; runLeftPct: number; runRightPct: number; runInsidePct: number; widePct: number; boundaryPct: number };
    middle: { total: number; runPct: number; passPct: number; runLeftPct: number; runRightPct: number; runInsidePct: number };
    right: { total: number; runPct: number; passPct: number; runLeftPct: number; runRightPct: number; runInsidePct: number; widePct: number; boundaryPct: number };
  };
  wideSide: {
    runCount: number;
    hashRunCount: number;
    wideCount: number;
    boundaryCount: number;
    insideCount: number;
    widePct: number;
    boundaryPct: number;
    insidePct: number;
    middleFavor: 'left' | 'right' | 'balanced' | 'none';
    middleLeftPct: number;
    middleRightPct: number;
  };
  runDirections: {
    leftPerimeter: number;
    offTackleLeft: number;
    aGapLeft: number;
    middle: number;
    aGapRight: number;
    offTackleRight: number;
    rightPerimeter: number;
  };
  tells: OpponentTell[];
}

export interface AIScoutingReport {
  executiveSummary: string;
  opponentIdentity: {
    offensiveSystem: string;
    tempoPace: string;
    strengths: string[];
    vulnerabilities: string[];
  };
  defensivePhilosophyRecommendation: {
    recommendedBaseFront: string;
    secondaryAlignment: string;
    rationale: string;
  };
  downAndDistanceGameplan: {
    firstAndTen: { coverage: string; front: string; emphasis: string };
    secondAndShort: { coverage: string; front: string; emphasis: string };
    secondAndLong: { coverage: string; front: string; emphasis: string };
    thirdAndShort: { coverage: string; front: string; emphasis: string };
    thirdAndLong: { coverage: string; front: string; emphasis: string };
    redZone: { coverage: string; front: string; emphasis: string };
  };
  blitzAndPressurePackages: {
    name: string;
    situation: string;
    description: string;
    targetWeakness: string;
  }[];
  keyPlayerMatchups: {
    targetOrPlayer: string;
    role: string;
    scoutingNote: string;
    defensiveCounter: string;
  }[];
  wristbandCallSheet: {
    firstDownCalls: string[];
    runStopCalls: string[];
    passBlitzCalls: string[];
    thirdDownMustStops: string[];
    redZoneLocks: string[];
  };
}
