import type {
  BasketballPlayer,
  BasketballPossession,
  DefenseType,
  PossessionPhase,
  ShotZone,
} from './types';

export interface TeamEfficiencyMetrics {
  possessionsCount: number;
  points: number;
  ppp: number;
  fgMade: number;
  fgAtt: number;
  fgPct: number;
  threeMade: number;
  threeAtt: number;
  threePct: number;
  efgPct: number;
  turnovers: number;
  toPct: number;
  transitionPossessions: number;
  transitionPpp: number;
  halfCourtPossessions: number;
  halfCourtPpp: number;
  manPossessions: number;
  manPpp: number;
  zonePossessions: number;
  zonePpp: number;
}

export interface SetEfficiencyRow {
  setCall: string;
  count: number;
  pctOfOffense: number;
  points: number;
  ppp: number;
  fgMade: number;
  fgAtt: number;
  fgPct: number;
  threeMade: number;
  threeAtt: number;
  turnovers: number;
  playNumbers: number[];
}

export interface ShotZoneStat {
  zone: ShotZone;
  label: string;
  made: number;
  att: number;
  pct: number;
  points: number;
  ppp: number;
  playNumbers: number[];
}

export interface PlayerBoxRow {
  playerId: string;
  num: string;
  name: string;
  position: string;
  pts: number;
  fgm: number;
  fga: number;
  fgPct: number;
  tpm: number;
  tpa: number;
  tpPct: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  clipPlayNumbers: number[];
}

export const SHOT_ZONE_LABELS: Record<ShotZone, string> = {
  rim: 'At Rim',
  paint: 'Paint / Floater',
  mid_left: 'Left Mid-Range',
  mid_center: 'High Post / FT Mid',
  mid_right: 'Right Mid-Range',
  corner_3_left: 'Left Corner 3',
  corner_3_right: 'Right Corner 3',
  wing_3_left: 'Left Wing 3',
  top_3: 'Top of Key 3',
  wing_3_right: 'Right Wing 3',
};

export const PHASE_LABELS: Record<PossessionPhase, string> = {
  half_court: 'Half-Court',
  transition: 'Transition',
  blob: 'BLOB (Baseline)',
  slob: 'SLOB (Sideline)',
  press_break: 'Press Break',
  defense: 'Defense / Stop',
};

export const DEFENSE_LABELS: Record<DefenseType, string> = {
  man: 'Man-to-Man',
  zone_2_3: '2-3 Zone',
  zone_3_2: '3-2 Zone',
  zone_1_3_1: '1-3-1 Zone',
  press: 'Full-Court Press',
  matchup: 'Matchup Zone',
};

const isFgMake = (r: BasketballPossession['result']) =>
  r === '2pt_make' || r === '3pt_make' || r === 'and_1';

const isFgAttempt = (r: BasketballPossession['result']) =>
  r === '2pt_make' ||
  r === '2pt_miss' ||
  r === '3pt_make' ||
  r === '3pt_miss' ||
  r === 'and_1';

const isThreeMake = (r: BasketballPossession['result']) => r === '3pt_make';

const isThreeAttempt = (r: BasketballPossession['result']) =>
  r === '3pt_make' || r === '3pt_miss';

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function calcPpp(rows: BasketballPossession[]): number {
  if (rows.length === 0) return 0;
  const pts = rows.reduce((s, r) => s + (r.points || 0), 0);
  return round2(pts / rows.length);
}

/** Aggregate overall offensive/defensive efficiency metrics for a side ('us' or 'opponent'). */
export function computeTeamEfficiency(
  possessions: BasketballPossession[],
  side: 'us' | 'opponent'
): TeamEfficiencyMetrics {
  const rows = possessions.filter((p) => p.teamSide === side);
  const possessionsCount = rows.length;
  const points = rows.reduce((sum, p) => sum + (p.points || 0), 0);

  let fgMade = 0;
  let fgAtt = 0;
  let threeMade = 0;
  let threeAtt = 0;
  let turnovers = 0;

  for (const p of rows) {
    if (isFgMake(p.result)) fgMade++;
    if (isFgAttempt(p.result)) fgAtt++;
    if (isThreeMake(p.result)) threeMade++;
    if (isThreeAttempt(p.result)) threeAtt++;
    if (p.result === 'turnover') turnovers++;
  }

  const transitionRows = rows.filter((p) => p.phase === 'transition');
  const halfCourtRows = rows.filter((p) => p.phase === 'half_court');
  const manRows = rows.filter((p) => p.defenseFaced === 'man');
  const zoneRows = rows.filter(
    (p) =>
      p.defenseFaced === 'zone_2_3' ||
      p.defenseFaced === 'zone_3_2' ||
      p.defenseFaced === 'zone_1_3_1' ||
      p.defenseFaced === 'matchup'
  );

  const fgPct = fgAtt > 0 ? round1((fgMade / fgAtt) * 100) : 0;
  const threePct = threeAtt > 0 ? round1((threeMade / threeAtt) * 100) : 0;
  const efgPct = fgAtt > 0 ? round1(((fgMade + 0.5 * threeMade) / fgAtt) * 100) : 0;
  const toPct = possessionsCount > 0 ? round1((turnovers / possessionsCount) * 100) : 0;

  return {
    possessionsCount,
    points,
    ppp: possessionsCount > 0 ? round2(points / possessionsCount) : 0,
    fgMade,
    fgAtt,
    fgPct,
    threeMade,
    threeAtt,
    threePct,
    efgPct,
    turnovers,
    toPct,
    transitionPossessions: transitionRows.length,
    transitionPpp: calcPpp(transitionRows),
    halfCourtPossessions: halfCourtRows.length,
    halfCourtPpp: calcPpp(halfCourtRows),
    manPossessions: manRows.length,
    manPpp: calcPpp(manRows),
    zonePossessions: zoneRows.length,
    zonePpp: calcPpp(zoneRows),
  };
}

/** Group possessions by set / play call to compare Points Per Possession and shooting splits. */
export function computeSetBreakdown(
  possessions: BasketballPossession[],
  side: 'us' | 'opponent'
): SetEfficiencyRow[] {
  const sideRows = possessions.filter((p) => p.teamSide === side);
  const total = sideRows.length;
  const map = new Map<string, BasketballPossession[]>();

  for (const p of sideRows) {
    const key = (p.setCall || 'Unlabelled Set').trim();
    const list = map.get(key) || [];
    list.push(p);
    map.set(key, list);
  }

  const out: SetEfficiencyRow[] = [];
  for (const [setCall, list] of map.entries()) {
    let points = 0;
    let fgMade = 0;
    let fgAtt = 0;
    let threeMade = 0;
    let threeAtt = 0;
    let turnovers = 0;
    const playNumbers: number[] = [];

    for (const p of list) {
      points += p.points || 0;
      if (isFgMake(p.result)) fgMade++;
      if (isFgAttempt(p.result)) fgAtt++;
      if (isThreeMake(p.result)) threeMade++;
      if (isThreeAttempt(p.result)) threeAtt++;
      if (p.result === 'turnover') turnovers++;
      playNumbers.push(p.playNumber);
    }

    out.push({
      setCall,
      count: list.length,
      pctOfOffense: total > 0 ? round1((list.length / total) * 100) : 0,
      points,
      ppp: list.length > 0 ? round2(points / list.length) : 0,
      fgMade,
      fgAtt,
      fgPct: fgAtt > 0 ? round1((fgMade / fgAtt) * 100) : 0,
      threeMade,
      threeAtt,
      turnovers,
      playNumbers,
    });
  }

  return out.sort((a, b) => b.count - a.count || b.ppp - a.ppp);
}

/** Aggregate shooting accuracy and volume across all 10 half-court shot zones. */
export function computeShotZones(
  possessions: BasketballPossession[],
  side: 'us' | 'opponent'
): ShotZoneStat[] {
  const zones = Object.keys(SHOT_ZONE_LABELS) as ShotZone[];
  const sideRows = possessions.filter((p) => p.teamSide === side && Boolean(p.shotZone));

  return zones.map((zone) => {
    const list = sideRows.filter((p) => p.shotZone === zone);
    let made = 0;
    let att = 0;
    let points = 0;
    const playNumbers: number[] = [];

    for (const p of list) {
      if (isFgMake(p.result)) made++;
      if (isFgAttempt(p.result)) att++;
      points += p.points || 0;
      playNumbers.push(p.playNumber);
    }

    return {
      zone,
      label: SHOT_ZONE_LABELS[zone],
      made,
      att,
      pct: att > 0 ? round1((made / att) * 100) : 0,
      points,
      ppp: list.length > 0 ? round2(points / list.length) : 0,
      playNumbers,
    };
  });
}

function extractJerseyToken(text?: string): string {
  if (!text) return '';
  const m = String(text).match(/#(\d{1,3})\b/);
  return m ? m[1] : '';
}

function matchesRosterPlayer(tag: string | undefined, player: BasketballPlayer): boolean {
  if (!tag) return false;
  const tok = extractJerseyToken(tag);
  if (tok && tok === String(player.num)) return true;
  const full = `${player.firstName} ${player.lastName}`.trim().toLowerCase();
  return full.length > 0 && tag.toLowerCase().includes(full);
}

/** Compute player box scores and video clip links from tagged basketball possessions. */
export function computePlayerBoxStats(
  possessions: BasketballPossession[],
  roster: BasketballPlayer[],
  side: 'us' | 'opponent' = 'us'
): PlayerBoxRow[] {
  const rows: PlayerBoxRow[] = roster.map((player) => ({
    playerId: player.id,
    num: player.num,
    name: `${player.firstName} ${player.lastName}`.trim(),
    position: player.position,
    pts: 0,
    fgm: 0,
    fga: 0,
    fgPct: 0,
    tpm: 0,
    tpa: 0,
    tpPct: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    to: 0,
    clipPlayNumbers: [],
  }));

  const addClip = (row: PlayerBoxRow, playNumber: number) => {
    if (!row.clipPlayNumbers.includes(playNumber)) {
      row.clipPlayNumbers.push(playNumber);
    }
  };

  for (const p of possessions) {
    // Scoring / shooting / turnovers attributed on that team's offensive possessions
    if (p.teamSide === side) {
      for (let i = 0; i < roster.length; i++) {
        const player = roster[i];
        const row = rows[i];

        if (matchesRosterPlayer(p.shooter, player)) {
          row.pts += p.points || 0;
          if (isFgMake(p.result)) row.fgm++;
          if (isFgAttempt(p.result)) row.fga++;
          if (isThreeMake(p.result)) row.tpm++;
          if (isThreeAttempt(p.result)) row.tpa++;
          if (p.result === 'turnover') row.to++;
          addClip(row, p.playNumber);
        }

        if (matchesRosterPlayer(p.assister, player)) {
          row.ast++;
          addClip(row, p.playNumber);
        }
      }
    }

    // Rebounds & defensive plays attributed across all possessions without double-counting
    for (let i = 0; i < roster.length; i++) {
      const player = roster[i];
      const row = rows[i];

      const isRebounder =
        matchesRosterPlayer(p.rebounder, player) ||
        (p.result === 'def_reb' && matchesRosterPlayer(p.defender || p.shooter, player));
      if (isRebounder) {
        row.reb++;
        addClip(row, p.playNumber);
      }

      if (p.result === 'def_steal' && matchesRosterPlayer(p.defender || p.shooter, player)) {
        row.stl++;
        addClip(row, p.playNumber);
      } else if (p.result === 'def_block' && matchesRosterPlayer(p.defender || p.shooter, player)) {
        row.blk++;
        addClip(row, p.playNumber);
      }
    }
  }

  for (const r of rows) {
    r.fgPct = r.fga > 0 ? round1((r.fgm / r.fga) * 100) : 0;
    r.tpPct = r.tpa > 0 ? round1((r.tpm / r.tpa) * 100) : 0;
  }

  return rows.sort((a, b) => b.pts - a.pts || b.reb - a.reb || Number(a.num) - Number(b.num));
}
