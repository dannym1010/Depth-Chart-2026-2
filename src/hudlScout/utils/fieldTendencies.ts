// Strength, field and motion together: where the offense puts its strength (to the wide side or the
// boundary), what it runs from each strength and from balanced sets, where plays go from each hash, and what
// a motion tells you (toward the strength or the field, and whether the play goes with it or away from it).
import type { Play } from '../types/football';
import { isRecordedMotion } from './csvParser';
import { hasDirection, isBalancedPlay, playStrength } from './strength';

export type Toward = 'field' | 'boundary' | 'middle';
type LR = 'L' | 'R';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const isRun = (p: Play) => p.playType === 'RUN' || p.playType === 'RPO';
const isPass = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN';
const avg = (plays: Play[]) => (plays.length ? Math.round((plays.reduce((n, p) => n + (Number(p.gainLoss) || 0), 0) / plays.length) * 10) / 10 : 0);

/** Where the play went: L / R / M, only when the breakdown has a direction. */
export function playWent(p: Play): LR | 'M' | undefined {
  if (!hasDirection(p)) return undefined;
  return p.runSide === 'L' || p.runSide === 'R' || p.runSide === 'M' ? p.runSide : undefined;
}

/** The wide side (field) is away from the hash the ball is on; from the middle there is none. */
export function fieldSide(p: Pick<Play, 'hash'>): LR | undefined {
  return p.hash === 'L' ? 'R' : p.hash === 'R' ? 'L' : undefined;
}

/** A side of the field relative to where the ball is: the wide side (field) or the short side (boundary). */
export function towardField(p: Pick<Play, 'hash'>, side: LR | 'M' | undefined): Toward | undefined {
  if (!side) return undefined;
  if (side === 'M') return 'middle';
  const field = fieldSide(p);
  if (!field) return undefined;
  return side === field ? 'field' : 'boundary';
}

/** Motion direction, as Hudl's MOTION DIR has it (L / R); other labels ("Jet") have no direction. */
export function motionDir(p: Pick<Play, 'motion'>): LR | undefined {
  const m = String(p.motion || '').trim().toUpperCase();
  if (!isRecordedMotion(m)) return undefined;
  if (/^(L|LT|LEFT)\b/.test(m)) return 'L';
  if (/^(R|RT|RIGHT)\b/.test(m)) return 'R';
  return undefined;
}

export interface Split3<K extends string> {
  total: number;
  count: Record<K, number>;
  pct: Record<K, number>;
}
function split3<K extends string>(keys: K[], values: (K | undefined)[]): Split3<K> {
  const count = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const v of values) if (v) count[v] += 1;
  const total = keys.reduce((n, k) => n + count[k], 0);
  return { total, count, pct: Object.fromEntries(keys.map((k) => [k, pct(count[k], total)])) as Record<K, number> };
}

export interface StrengthGroup {
  label: 'Left' | 'Right' | 'Balanced';
  plays: number;
  runPct: number;
  passPct: number;
  avg: number;
  /** Runs to the strong side, middle, weak side (not for balanced). */
  runsBySide?: Split3<'strong' | 'middle' | 'weak'>;
  /** Plays to the field, middle, boundary. */
  byField: Split3<Toward>;
}

export interface HashGroup {
  label: string;
  hash: 'L' | 'M' | 'R';
  plays: number;
  runPct: number;
  /** Plays to the field / middle / boundary (the middle hash: to the left / middle / right). */
  byField: Split3<Toward>;
  byLR: Split3<'L' | 'M' | 'R'>;
}

export interface MotionReport {
  /** Plays with a motion direction. */
  plays: number;
  ofSnaps: number;
  runPct: number;
  avg: number;
  /** Where the motion went: toward the strength or away (balanced sets have neither). */
  toStrength: Split3<'toward' | 'away'>;
  /** Toward the field or the boundary (middle hash: neither). */
  toField: Split3<'field' | 'boundary'>;
  /** Where the play went compared to the motion. */
  playVsMotion: Split3<'with' | 'middle' | 'away'>;
  runsVsMotion: Split3<'with' | 'middle' | 'away'>;
  passesVsMotion: Split3<'with' | 'middle' | 'away'>;
}

export interface FieldTendencies {
  total: number;
  /** Of the plays with a strength and the ball on a hash: strength set to the field or the boundary. */
  strengthToField: Split3<'field' | 'boundary'>;
  byStrength: StrengthGroup[];
  /** Runs when the strength is set to the field, and when it's to the boundary: to the strong side, middle, weak side. */
  runsByPlacement: { field: Split3<'strong' | 'middle' | 'weak'>; boundary: Split3<'strong' | 'middle' | 'weak'>; fieldAvg: { strong: number; weak: number }; boundaryAvg: { strong: number; weak: number } };
  byHash: HashGroup[];
  motion: MotionReport;
  /** The plain-language tendencies worth acting on (60%+ with enough plays). */
  tells: { text: string; pct: number; n: number }[];
}

export function fieldTendencies(all: Play[], subject = 'They'): FieldTendencies {
  // The plays the report shows (its offense / defense switch picks them); kicks and stoppages aren't plays from a formation.
  const plays = all.filter((p) => p.odk !== 'K' && p.odk !== 'S');
  const strengthOf = (p: Play): LR | 'B' | undefined => (isBalancedPlay(p) ? 'B' : playStrength(p));

  // Strength to the field or the boundary.
  const strengthToField = split3(
    ['field', 'boundary'],
    plays.map((p) => {
      const s = strengthOf(p);
      return s === 'L' || s === 'R' ? (towardField(p, s) as 'field' | 'boundary' | undefined) : undefined;
    })
  );

  const group = (label: StrengthGroup['label'], key: LR | 'B'): StrengthGroup => {
    const g = plays.filter((p) => strengthOf(p) === key);
    const runs = g.filter(isRun);
    return {
      label,
      plays: g.length,
      runPct: pct(runs.length, g.length),
      passPct: pct(g.filter(isPass).length, g.length),
      avg: avg(g),
      ...(key !== 'B'
        ? {
            runsBySide: split3(
              ['strong', 'middle', 'weak'],
              runs.map((p) => {
                const went = playWent(p);
                return went === 'M' ? 'middle' : went ? (went === key ? 'strong' : 'weak') : undefined;
              })
            ),
          }
        : {}),
      byField: split3(['field', 'middle', 'boundary'], g.map((p) => towardField(p, playWent(p)))),
    };
  };
  const byStrength = [group('Left', 'L'), group('Right', 'R'), group('Balanced', 'B')].filter((g) => g.plays > 0);

  // Runs by where the strength is set: to the field (wide side) or the boundary.
  const placedRuns = (where: 'field' | 'boundary') =>
    plays.filter((p) => {
      const s = strengthOf(p);
      return isRun(p) && (s === 'L' || s === 'R') && towardField(p, s) === where;
    });
  const runSide = (p: Play): 'strong' | 'middle' | 'weak' | undefined => {
    const went = playWent(p);
    const s = strengthOf(p);
    if (!went || (s !== 'L' && s !== 'R')) return undefined;
    return went === 'M' ? 'middle' : went === s ? 'strong' : 'weak';
  };
  const sideAvg = (runs: Play[]) => ({ strong: avg(runs.filter((p) => runSide(p) === 'strong')), weak: avg(runs.filter((p) => runSide(p) === 'weak')) });
  const fieldRuns = placedRuns('field');
  const boundaryRuns = placedRuns('boundary');
  const runsByPlacement = {
    field: split3(['strong', 'middle', 'weak'], fieldRuns.map(runSide)),
    boundary: split3(['strong', 'middle', 'weak'], boundaryRuns.map(runSide)),
    fieldAvg: sideAvg(fieldRuns),
    boundaryAvg: sideAvg(boundaryRuns),
  };

  const byHash: HashGroup[] = (['L', 'M', 'R'] as const)
    .map((h) => {
      const g = plays.filter((p) => p.hash === h);
      return {
        label: h === 'L' ? 'Left hash' : h === 'R' ? 'Right hash' : 'Middle',
        hash: h,
        plays: g.length,
        runPct: pct(g.filter(isRun).length, g.length),
        byField: split3(['field', 'middle', 'boundary'], g.map((p) => towardField(p, playWent(p)))),
        byLR: split3(['L', 'M', 'R'], g.map(playWent)),
      };
    })
    .filter((g) => g.plays > 0);

  // Motion.
  const moved = plays.filter((p) => motionDir(p));
  const vsMotion = (p: Play): 'with' | 'middle' | 'away' | undefined => {
    const went = playWent(p);
    if (!went) return undefined;
    if (went === 'M') return 'middle';
    return went === motionDir(p) ? 'with' : 'away';
  };
  const motion: MotionReport = {
    plays: moved.length,
    ofSnaps: pct(moved.length, plays.length),
    runPct: pct(moved.filter(isRun).length, moved.length),
    avg: avg(moved),
    toStrength: split3(
      ['toward', 'away'],
      moved.map((p) => {
        const s = strengthOf(p);
        return s === 'L' || s === 'R' ? (motionDir(p) === s ? 'toward' : 'away') : undefined;
      })
    ),
    toField: split3(['field', 'boundary'], moved.map((p) => towardField(p, motionDir(p)) as 'field' | 'boundary' | undefined)),
    playVsMotion: split3(['with', 'middle', 'away'], moved.map(vsMotion)),
    runsVsMotion: split3(['with', 'middle', 'away'], moved.filter(isRun).map(vsMotion)),
    passesVsMotion: split3(['with', 'middle', 'away'], moved.filter(isPass).map(vsMotion)),
  };

  // Tells: 60% or more, with at least 5 plays behind it.
  const tells: FieldTendencies['tells'] = [];
  const tell = (n: number, share: number, text: string) => {
    if (n >= 5 && share >= 60) tells.push({ text, pct: share, n });
  };
  const sf = strengthToField;
  if (sf.total) {
    const toField = sf.pct.field >= sf.pct.boundary;
    tell(sf.total, Math.max(sf.pct.field, sf.pct.boundary), `${subject} set the strength to the ${toField ? 'wide side (field)' : 'boundary'} ${Math.max(sf.pct.field, sf.pct.boundary)}% of the time (${Math.max(sf.count.field, sf.count.boundary)} of ${sf.total}).`);
  }
  for (const where of ['field', 'boundary'] as const) {
    const r = runsByPlacement[where];
    if (!r.total) continue;
    const strongWay = r.pct.strong >= r.pct.weak;
    const share = strongWay ? r.pct.strong : r.pct.weak;
    const place = where === 'field' ? 'wide side (field)' : 'boundary';
    tell(r.total, share, `Strength to the ${place}: ${share}% of runs go ${strongWay ? 'to the strength' : 'away from the strength'} (${strongWay ? r.count.strong : r.count.weak} of ${r.total}).`);
  }
  for (const g of byStrength) {
    if (g.runsBySide && g.runsBySide.total) {
      const r = g.runsBySide;
      const strongWay = r.pct.strong >= r.pct.weak;
      tell(r.total, strongWay ? r.pct.strong : r.pct.weak, `Strength ${g.label.toLowerCase()}: ${strongWay ? r.pct.strong : r.pct.weak}% of runs go to the ${strongWay ? 'strong' : 'weak'} side (${strongWay ? r.count.strong : r.count.weak} of ${r.total}).`);
    }
    if (g.label === 'Balanced' && g.byField.total) {
      const f = g.byField;
      const top = (['field', 'boundary', 'middle'] as Toward[]).sort((a, b) => f.pct[b] - f.pct[a])[0];
      tell(f.total, f.pct[top], `From balanced sets, ${f.pct[top]}% of plays go ${top === 'field' ? 'to the wide side' : top === 'boundary' ? 'to the boundary' : 'up the middle'} (${f.count[top]} of ${f.total}).`);
    }
  }
  for (const h of byHash) {
    if (h.hash === 'M' || !h.byField.total) continue;
    const f = h.byField;
    const top = f.pct.field >= f.pct.boundary ? 'field' : 'boundary';
    tell(f.total, f.pct[top], `On the ${h.label.toLowerCase()}, ${f.pct[top]}% of plays go to the ${top === 'field' ? 'wide side (field)' : 'boundary'} (${f.count[top]} of ${f.total}).`);
  }
  if (motion.plays) {
    const m = motion;
    if (m.toStrength.total) {
      const toward = m.toStrength.pct.toward >= m.toStrength.pct.away;
      tell(m.toStrength.total, Math.max(m.toStrength.pct.toward, m.toStrength.pct.away), `Motion goes ${toward ? 'toward' : 'away from'} the strength ${Math.max(m.toStrength.pct.toward, m.toStrength.pct.away)}% (${Math.max(m.toStrength.count.toward, m.toStrength.count.away)} of ${m.toStrength.total}).`);
    }
    if (m.toField.total) {
      const field = m.toField.pct.field >= m.toField.pct.boundary;
      tell(m.toField.total, Math.max(m.toField.pct.field, m.toField.pct.boundary), `Motion goes to the ${field ? 'wide side' : 'boundary'} ${Math.max(m.toField.pct.field, m.toField.pct.boundary)}% (${Math.max(m.toField.count.field, m.toField.count.boundary)} of ${m.toField.total}).`);
    }
    const v = m.playVsMotion;
    if (v.total) {
      const top = (['with', 'away', 'middle'] as ('with' | 'away' | 'middle')[]).sort((a, b) => v.pct[b] - v.pct[a])[0];
      tell(v.total, v.pct[top], `After motion, the play goes ${top === 'with' ? 'the same way as the motion' : top === 'away' ? 'away from the motion' : 'up the middle'} ${v.pct[top]}% (${v.count[top]} of ${v.total}).`);
    }
    tell(m.plays, Math.max(m.runPct, 100 - m.runPct), `With motion ${subject.toLowerCase()} ${m.runPct >= 50 ? 'run' : 'throw'} ${Math.max(m.runPct, 100 - m.runPct)}% of the time (${m.plays} motion plays).`);
  }
  tells.sort((a, b) => b.pct - a.pct || b.n - a.n);

  return { total: plays.length, strengthToField, byStrength, runsByPlacement, byHash, motion, tells };
}
