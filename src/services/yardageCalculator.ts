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
  /**
   * Where the gain came from: the next snap on the same drive (the most reliable), the goal line on a
   * touchdown, or the film (the whistle spot / an estimate). 'none' when the start spot isn't known.
   */
  gainSource?: 'next snap' | 'touchdown' | 'film' | 'none';
  /** The film's own estimate of the gain, when the next snap decided it (to show if they differ). */
  filmGain?: number;
}

/** Whether a yard line was given at all. */
export const hasYardLine = (raw?: string | number | null) => raw !== undefined && raw !== null && String(raw).trim() !== '';

/**
 * Converts any yard line string (e.g. "-25", "+40", "35", "OWN 35", "OPP 20", "50") into an absolute yard
 * coordinate from 0 (the offense's own goal line) to 100 (the goal line it's going in). Hudl's yard lines
 * are from the side of the team with the ball, on offense and defense alike: "-25" is its own 25, and a
 * plain "35" (like "+35") is the other team's 35. Checked on our own Hudl data: the next snap's spot is
 * this spot plus the gain on 608 of 609 plays in a row.
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

  // Unsigned: over 50 (e.g. 60) is a distance from the offense's own goal line; otherwise Hudl's far side.
  if (num > 50) return Math.min(100, num);
  return 100 - clampedNum;
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
  trust = 'film',
  touchdown = false,
}: {
  currentStartYard?: string | number;
  currentWhistleYard?: string | number;
  currentGainLoss?: number;
  nextStartYard?: string | number;
  currentOdk?: string;
  nextOdk?: string;
  /**
   * 'spot': the next snap on the same drive decides the gain (the film's whistle spot is only an estimate);
   * use it unless a penalty was called on this play. 'film': the whistle spot / gain given decides it and
   * the next snap is checked against it (a coach typed it in).
   */
  trust?: 'spot' | 'film';
  /** The play scored: the gain is the rest of the field. */
  touchdown?: boolean;
}): YardageAlignmentResult {
  // No start spot: nothing to measure from (don't pretend it was the 25).
  if (!hasYardLine(currentStartYard)) {
    const gain = Number(currentGainLoss) || 0;
    return { startAbs: NaN, startFormatted: '', measuredGain: gain, isAligned: true, discrepancyYards: 0, isPossessionChange: false, penaltySuspected: false, gainSource: 'none' };
  }
  const startAbs = parseAbsoluteYard(currentStartYard);
  const startFormatted = formatAbsoluteYard(startAbs, 'full');
  const inferredSide: 'OWN' | 'OPP' = startAbs >= 50 ? 'OPP' : 'OWN';

  // A touchdown: the rest of the field.
  if (touchdown) {
    return {
      startAbs,
      startFormatted,
      whistleAbs: 100,
      whistleFormatted: 'TD',
      measuredGain: 100 - startAbs,
      isAligned: true,
      discrepancyYards: 0,
      isPossessionChange: false,
      penaltySuspected: false,
      gainSource: 'touchdown',
    };
  }

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
      gainSource: 'film',
    };
  }

  const nextStartAbs = parseAbsoluteYard(nextStartYard);
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
      gainSource: 'film',
    };
  }

  // Next play is on the same drive: the ball should be spotted where this play ended!
  const nextPlayGain = nextStartAbs - startAbs;
  if (trust === 'spot') {
    // The next snap is where this play ended (the film's spot is an estimate from a few frames).
    const filmGain = whistleAbs - startAbs;
    return {
      startAbs,
      startFormatted,
      nextStartAbs,
      nextStartFormatted,
      whistleAbs: nextStartAbs,
      whistleFormatted: nextStartFormatted,
      measuredGain: nextPlayGain,
      nextPlayGain,
      isAligned: true,
      discrepancyYards: 0,
      isPossessionChange: false,
      penaltySuspected: false,
      gainSource: 'next snap',
      ...(currentWhistleYard !== undefined || currentGainLoss !== undefined ? { filmGain } : {}),
    };
  }
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
      gainSource: 'next snap',
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
    gainSource: 'film',
  };
}
