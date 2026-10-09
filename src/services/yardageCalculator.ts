// Utility for parsing football field yard lines, calculating net gains/losses,
// and cross-checking lines of scrimmage between sequential plays to detect penalties and spot errors.

export interface YardageAlignmentResult {
  startAbs: number;
  startFormatted: string;
  nextStartAbs?: number;
  nextStartFormatted?: string;
  whistleAbs?: number;
  whistleFormatted?: string;
  measuredGain: number; // Based on whistle spot or runner gain
  nextPlayGain?: number; // Net gain to next play LOS
  isAligned: boolean;
  discrepancyYards: number;
  isPossessionChange: boolean;
  penaltySuspected: boolean;
  penaltySuggestion?: string;
  penaltyType?: string;
  penaltyYards?: number;
  penaltyOn?: 'Offense' | 'Defense' | 'None';
}

/**
 * Converts any yard line string (e.g. "-25", "+40", "OWN 35", "OPP 20", "50")
 * into an absolute yard coordinate from 0 (Own Goal Line) to 100 (Opponent Goal Line).
 */
export function parseAbsoluteYard(raw?: string | number | null, defaultSide?: 'OWN' | 'OPP' | 'MID'): number {
  if (raw === undefined || raw === null || raw === '') return 25; // Default own 25

  if (typeof raw === 'number') {
    // If raw is between 0 and 100
    if (raw >= 0 && raw <= 100) return raw;
    return 25;
  }

  const clean = String(raw).trim().toUpperCase();
  if (clean === '50' || clean.includes('50')) return 50;

  const numMatch = clean.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0], 10) : 25;
  const clampedNum = Math.min(49, Math.max(1, num));

  // Explicit prefix checks
  if (clean.startsWith('+') || clean.includes('OPP') || clean.includes('PLUS') || clean.includes('THEIRS')) {
    // Opponent side: 40 opp means 60 from own goal line
    return 100 - clampedNum;
  }
  if (clean.startsWith('-') || clean.includes('OWN') || clean.includes('MINUS') || clean.includes('OURS')) {
    // Own side: 35 own means 35 from own goal line
    return clampedNum;
  }

  // If default side is specified, use it
  if (defaultSide === 'OPP') return 100 - clampedNum;
  if (defaultSide === 'OWN') return clampedNum;

  // If unsigned: coordinate > 50 (e.g. 60) represents distance from own goal line
  if (num > 50) return num;
  return clampedNum;
}

/**
 * Formats an absolute 0..100 yard coordinate into standard football notation.
 * e.g. 35 -> "-35" (OWN 35), 50 -> "50", 65 -> "+35" (OPP 35).
 */
export function formatAbsoluteYard(abs: number, style: 'hudl' | 'full' = 'hudl'): string {
  const clamped = Math.min(100, Math.max(0, Math.round(abs)));
  if (clamped === 50) return '50';
  if (clamped < 50) {
    return style === 'full' ? `OWN ${clamped}` : `-${clamped}`;
  }
  const oppYard = 100 - clamped;
  return style === 'full' ? `OPP ${oppYard}` : `+${oppYard}`;
}

/**
 * Calculates net gain/loss from one yard line to another in absolute terms.
 * Positive = Gain towards opponent end zone.
 * Negative = Loss towards own end zone.
 */
export function calculateNetGain(fromRaw?: string | number | null, toRaw?: string | number | null): number {
  const fromAbs = parseAbsoluteYard(fromRaw);
  const defaultSide: 'OWN' | 'OPP' = fromAbs >= 50 ? 'OPP' : 'OWN';
  const toAbs = parseAbsoluteYard(toRaw, defaultSide);
  return toAbs - fromAbs;
}

/**
 * Cross-checks the current play's whistle tackle spot against the NEXT play's starting line of scrimmage.
 * If they do not align on the same possession, calculates the discrepancy and suggests potential penalties.
 */
export function crossCheckPlayYardage({
  currentStartYard,
  currentWhistleYard,
  currentGainLoss,
  nextStartYard,
  currentOdk = 'O',
  nextOdk = 'O',
}: {
  currentStartYard?: string | number;
  currentWhistleYard?: string | number;
  currentGainLoss?: number;
  nextStartYard?: string | number;
  currentOdk?: string;
  nextOdk?: string;
}): YardageAlignmentResult {
  const startAbs = parseAbsoluteYard(currentStartYard);
  const startFormatted = formatAbsoluteYard(startAbs, 'full');
  const inferredSide: 'OWN' | 'OPP' = startAbs >= 50 ? 'OPP' : 'OWN';

  // Estimate whistle spot
  let whistleAbs: number;
  if (currentWhistleYard !== undefined && currentWhistleYard !== null && String(currentWhistleYard).trim() !== '') {
    whistleAbs = parseAbsoluteYard(currentWhistleYard, inferredSide);
  } else if (currentGainLoss !== undefined) {
    whistleAbs = Math.min(100, Math.max(0, startAbs + currentGainLoss));
  } else {
    whistleAbs = startAbs;
  }

  // If currentGainLoss was explicitly provided and has an opposite sign from (whistleAbs - startAbs),
  // trust currentGainLoss (e.g. runner gained positive yards, but whistle was mistakenly entered backwards)
  if (currentGainLoss !== undefined && currentGainLoss !== 0) {
    const rawDiff = whistleAbs - startAbs;
    if (Math.sign(rawDiff) !== Math.sign(currentGainLoss) && Math.abs(rawDiff) > 0) {
      whistleAbs = Math.min(100, Math.max(0, startAbs + currentGainLoss));
    }
  }

  const whistleFormatted = formatAbsoluteYard(whistleAbs, 'full');
  const measuredGain = whistleAbs - startAbs;

  if (nextStartYard === undefined || nextStartYard === null || nextStartYard === '') {
    // No next play available (end of game/quarter or standalone clip)
    return {
      startAbs,
      startFormatted,
      whistleAbs,
      whistleFormatted,
      measuredGain,
      isAligned: true,
      discrepancyYards: 0,
      isPossessionChange: false,
      penaltySuspected: false,
    };
  }

  const nextStartAbs = parseAbsoluteYard(nextStartYard, inferredSide);
  const nextStartFormatted = formatAbsoluteYard(nextStartAbs, 'full');

  const isPossessionChange = (currentOdk && nextOdk && currentOdk !== nextOdk);

  if (isPossessionChange) {
    return {
      startAbs,
      startFormatted,
      nextStartAbs,
      nextStartFormatted,
      whistleAbs,
      whistleFormatted,
      measuredGain,
      isAligned: true,
      discrepancyYards: 0,
      isPossessionChange: true,
      penaltySuspected: false,
      penaltySuggestion: 'Change of possession (Punt / Turnover on Downs / Turnover)',
    };
  }

  // Next play is on the same drive: the ball should be spotted where this play ended!
  const nextPlayGain = nextStartAbs - startAbs;
  const discrepancy = nextStartAbs - whistleAbs; // e.g. -10 means ball spotted 10 yards backward from whistle

  // Allow +-1 yard margin for measurement/hash placement differences
  const isAligned = Math.abs(discrepancy) <= 1;

  if (isAligned) {
    return {
      startAbs,
      startFormatted,
      nextStartAbs,
      nextStartFormatted,
      whistleAbs,
      whistleFormatted,
      measuredGain: nextPlayGain, // Exact verified spot
      isAligned: true,
      discrepancyYards: 0,
      isPossessionChange: false,
      penaltySuspected: false,
    };
  }

  // Discrepancy detected! Determine likely penalty scenario
  const penaltyYards = Math.abs(discrepancy);
  let penaltyOn: 'Offense' | 'Defense' | 'None' = 'None';
  let penaltySuggestion = '';
  let penaltyType = '';

  if (discrepancy <= -4 && discrepancy >= -6) {
    penaltyOn = 'Offense';
    penaltyType = 'False Start / Illegal Shift / Ineligible Receiver';
    penaltySuggestion = '5-yard penalty on Offense (backed up from spot or previous LOS)';
  } else if (discrepancy <= -8 && discrepancy >= -12) {
    penaltyOn = 'Offense';
    penaltyType = 'Holding / Block in the Back';
    penaltySuggestion = '10-yard penalty on Offense (Holding or Illegal Block in Back)';
  } else if (discrepancy <= -13 && discrepancy >= -17) {
    penaltyOn = 'Offense';
    penaltyType = 'Personal Foul / Unsportsmanlike Conduct';
    penaltySuggestion = '15-yard personal foul penalty on Offense';
  } else if (discrepancy >= 4 && discrepancy <= 6) {
    penaltyOn = 'Defense';
    penaltyType = 'Offside / Encroachment / Neutral Zone';
    penaltySuggestion = '5-yard penalty on Defense (Offside / Encroachment)';
  } else if (discrepancy >= 8 && discrepancy <= 12) {
    penaltyOn = 'Defense';
    penaltyType = 'Holding / Hands to the Face';
    penaltySuggestion = '10-yard penalty on Defense (Holding)';
  } else if (discrepancy >= 13 && discrepancy <= 17) {
    penaltyOn = 'Defense';
    penaltyType = 'Face Mask / Horse Collar / Unnecessary Roughness';
    penaltySuggestion = '15-yard penalty on Defense (Face Mask / Horse Collar)';
  } else {
    penaltySuggestion = `${discrepancy > 0 ? '+' : ''}${discrepancy} yd spot discrepancy. Check for penalty enforcement or official measurement.`;
  }

  return {
    startAbs,
    startFormatted,
    nextStartAbs,
    nextStartFormatted,
    whistleAbs,
    whistleFormatted,
    measuredGain: whistleAbs - startAbs,
    nextPlayGain,
    isAligned: false,
    discrepancyYards: discrepancy,
    isPossessionChange: false,
    penaltySuspected: true,
    penaltySuggestion,
    penaltyType,
    penaltyYards,
    penaltyOn,
  };
}
