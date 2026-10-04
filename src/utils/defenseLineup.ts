// Who plays where on our defense in the play builder. Pick Black, Gold or Blue and each defender on the
// diagram is tagged with the player the week's depth chart has at that spot for that unit (Black 1s,
// Gold 2s, Blue 3s), the same order the Film Room uses. A coach can still change one defender.
import type { FormationBoard, PlacedPlayer, RosterPlayer } from '../types';
import type { NodePlayer, PlayNode } from './footballEngine';

export type DefUnit = 'black' | 'gold' | 'blue';

export const DEF_UNITS: { id: DefUnit; label: string; depth: number }[] = [
  { id: 'black', label: 'Black', depth: 0 },
  { id: 'gold', label: 'Gold', depth: 1 },
  { id: 'blue', label: 'Blue', depth: 2 },
];

export interface DefenseRosterSource {
  depthChart?: Record<string, PlacedPlayer[]>;
  formations?: FormationBoard[];
  roster?: RosterPlayer[];
}

export type DefenseFront = '44' | '53';

/** The front a look of ours is (its key starts 44_ / 53_; the blitz looks are built on the 4-4). */
export const frontOfLook = (key: string): DefenseFront => (String(key).startsWith('53') ? '53' : '44');

const norm = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * The depth chart spot (by its name on the chart: "MIKE", "SDE", "DT 1", "CB 2") a defender stands at.
 * The chart is laid out with the strength to the right, so when a look is set to the left the line
 * and the corners swap sides.
 */
export function defenseSpotName(role: string, front: DefenseFront, strongLeft: boolean): string {
  const r = role.toUpperCase();
  const fixed: Record<string, string> = { SAM: 'SAM', MIKE: 'MIKE', WILL: 'WILL', ROV: 'ROVER', FS: 'FS', NT: 'NT' };
  if (fixed[r]) return fixed[r];
  if (r === 'CBL') return strongLeft ? 'CB1' : 'CB2';
  if (r === 'CBR') return strongLeft ? 'CB2' : 'CB1';
  const line: Record<string, string> =
    front === '44'
      ? strongLeft
        ? { E9: 'SDE', T3: 'DT2', T1: 'DT1', E5: 'WDE' }
        : { E9: 'WDE', T3: 'DT1', T1: 'DT2', E5: 'SDE' }
      : { E9: 'DE1', T3: 'DT1', T1: 'DT2', E5: 'DE2' };
  return line[r] || '';
}

const placedPlayer = (p: PlacedPlayer | undefined, roster: RosterPlayer[]): { num: string; name: string } | null => {
  if (!p?.num || String(p.num).trim() === '?') return null;
  const num = String(p.num).trim();
  const r = roster.find((x) => String(x.num).trim() === num);
  return { num, name: (p.name || r?.rosterName || r?.lastName || '').trim() };
};

/**
 * The boards to look in: the 44 Defense chart first (it is the one we use for every look), then the
 * look's own board for spots the 44 doesn't have (the 5-3's NT and DE 1 / DE 2), then the defensive
 * depth chart groups, then the rest.
 */
function boardsFor(front: DefenseFront, formations: FormationBoard[] | undefined): FormationBoard[] {
  const defense = (formations || []).filter((f) => f.unit === 'defense');
  const groups = (formations || []).filter((f) => f.unit === 'groups' && /defens/i.test(f.name));
  const base = defense.filter((f) => /^\s*(44|4-4)\b/i.test(f.name));
  const own = front === '53' ? defense.filter((f) => /^\s*(53|5-3)\b/i.test(f.name)) : [];
  const first = [...base, ...own];
  return [...first, ...groups, ...defense.filter((f) => !first.includes(f))];
}

/** The player at a spot for one unit, or null when the chart has nobody there. */
export function defensePlayerAt(spot: string, unit: DefUnit, front: DefenseFront, src: DefenseRosterSource): NodePlayer | null {
  const depth = DEF_UNITS.find((u) => u.id === unit)?.depth ?? 0;
  const roster = src.roster || [];
  for (const board of boardsFor(front, src.formations)) {
    for (const row of board.rows || []) {
      for (const pos of row.positions || []) {
        if (!pos || norm(pos.name || pos.tag || '') !== spot) continue;
        const who = placedPlayer(src.depthChart?.[pos.id]?.[depth], roster);
        if (who) return { ...who, unit, pos: pos.name || pos.tag || spot };
      }
    }
  }
  return null;
}

/** Each defender's player for the unit; one the coach chose for a defender wins over the chart. */
export function lineupForDefense(
  nodes: PlayNode[],
  opts: {
    unit: DefUnit;
    front: DefenseFront;
    strongLeft: boolean;
    src: DefenseRosterSource;
    overrides?: Record<string, NodePlayer>;
  }
): Record<string, NodePlayer> {
  const out: Record<string, NodePlayer> = {};
  for (const n of nodes) {
    const spot = defenseSpotName(n.role, opts.front, opts.strongLeft);
    const chosen = opts.overrides?.[n.role];
    if (chosen) {
      out[n.role] = { ...chosen, pos: chosen.pos || spot };
      continue;
    }
    if (!spot) continue;
    const who = defensePlayerAt(spot, opts.unit, opts.front, opts.src);
    if (who) out[n.role] = who;
  }
  return out;
}

/** The choices for one defender: each unit's player at that spot, and everyone on the roster. */
export function whoOptions(spot: string, front: DefenseFront, src: DefenseRosterSource): { depth: NodePlayer[]; roster: NodePlayer[] } {
  const depth = DEF_UNITS.map((u) => defensePlayerAt(spot, u.id, front, src)).filter(Boolean) as NodePlayer[];
  const roster = [...(src.roster || [])]
    .filter((r) => r.num)
    .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0))
    .map((r) => ({ num: String(r.num).trim(), name: (r.rosterName || r.lastName || '').trim() }));
  return { depth, roster };
}

export const playerLabel = (p: Pick<NodePlayer, 'num' | 'name'>) => `#${p.num}${p.name ? ` ${p.name}` : ''}`;
