import * as XLSX from 'xlsx';
import { FormationBoard, FilmOdk, FilmPlayerRef, FilmPlayAssignment, FilmSession, FilmStKind, FilmUnitColor, HudlImportedPlay, PlacedPlayer, RosterPlayer } from '../types';
import { isPffSourceFormation, playerPprKey, PprGroup, PprSide } from './pprGroups';

export type { FilmPlayerRef, FilmPlayAssignment, FilmSession, FilmUnitColor, FilmOdk, FilmStKind, HudlImportedPlay } from '../types';

export const FILM_UNIT_COLORS: { id: FilmUnitColor; label: string }[] = [
  { id: 'black', label: 'Black · 1s' },
  { id: 'gold', label: 'Gold · 2s' },
  { id: 'blue', label: 'Blue · 3s' },
];

export const FILM_PACKAGES_COLOR_ORDER = 'black-gold-blue';

export const DEPTH_COLOR_BY_INDEX: FilmUnitColor[] = ['black', 'gold', 'blue'];

export interface FilmSlotDef {
  id: string;
  name: string;
  group: PprGroup;
  aliases: string[];
}

export const FILM_OFFENSE_SLOTS: FilmSlotDef[] = [
  { id: 'LT', name: 'LT', group: 'OL', aliases: ['LT'] },
  { id: 'LG', name: 'LG', group: 'OL', aliases: ['LG'] },
  { id: 'C', name: 'C', group: 'OL', aliases: ['C', 'OC', 'CENTER'] },
  { id: 'RG', name: 'RG', group: 'OL', aliases: ['RG'] },
  { id: 'RT', name: 'RT', group: 'OL', aliases: ['RT'] },
  { id: 'Y', name: 'Y / TE', group: 'WR', aliases: ['Y', 'Y1', 'TE'] },
  { id: 'QB', name: 'QB', group: 'QB', aliases: ['QB', '1'] },
  { id: 'FB', name: 'FB', group: 'RB', aliases: ['FB', '2'] },
  { id: 'RB', name: 'RB', group: 'RB', aliases: ['RB', '4', 'HB'] },
  { id: 'X', name: 'X', group: 'WR', aliases: ['X'] },
  { id: 'Z', name: 'Z', group: 'WR', aliases: ['Z', 'W'] },
];

export const FILM_DEFENSE_SLOTS: FilmSlotDef[] = [
  { id: 'WDE', name: 'WDE (Weak)', group: 'DE', aliases: ['WDE', 'LDE', 'LE', 'E9'] },
  { id: 'LDT', name: 'LDT', group: 'DT', aliases: ['LDT', 'T1', 'NG', 'DT1', 'DT'] },
  { id: 'RDT', name: 'RDT', group: 'DT', aliases: ['RDT', 'T3', 'DT2'] },
  { id: 'SDE', name: 'SDE (Strong)', group: 'DE', aliases: ['SDE', 'RDE', 'RE'] },
  { id: 'WLB', name: 'W', group: 'LB', aliases: ['WLB', 'W', 'WILL'] },
  { id: 'MLB', name: 'M', group: 'LB', aliases: ['MLB', 'M', 'MIKE'] },
  { id: 'SLB', name: 'S', group: 'LB', aliases: ['SLB', 'S', 'SAM'] },
  { id: 'ROV', name: 'R', group: 'LB', aliases: ['ROV', 'R', 'ROVER'] },
  { id: 'LCB', name: 'LCB', group: 'DB', aliases: ['LCB', 'CB1'] },
  { id: 'FS', name: 'FS', group: 'DB', aliases: ['FS'] },
  { id: 'RCB', name: 'RCB', group: 'DB', aliases: ['RCB', 'CB2', 'C', 'CB'] },
];

export const FILM_ST_KINDS: { id: FilmStKind; label: string }[] = [
  { id: 'kickoff', label: 'Kickoff' },
  { id: 'kickReturn', label: 'Kick return' },
  { id: 'punt', label: 'Punt' },
  { id: 'fgxp', label: 'FG / 2-pt' },
];

export const FILM_ST_SLOTS: Record<FilmStKind, FilmSlotDef[]> = {
  kickoff: [
    { id: 'L1', name: 'L1', group: 'ST', aliases: ['L1'] },
    { id: 'L2', name: 'L2', group: 'ST', aliases: ['L2'] },
    { id: 'L3', name: 'L3', group: 'ST', aliases: ['L3'] },
    { id: 'L4', name: 'L4', group: 'ST', aliases: ['L4'] },
    { id: 'R4', name: 'R4', group: 'ST', aliases: ['R4'] },
    { id: 'R3', name: 'R3', group: 'ST', aliases: ['R3'] },
    { id: 'R2', name: 'R2', group: 'ST', aliases: ['R2'] },
    { id: 'R1', name: 'R1', group: 'ST', aliases: ['R1'] },
    { id: 'LBH', name: 'LBH', group: 'ST', aliases: ['LBH'] },
    { id: 'KICKER', name: 'Kicker', group: 'ST', aliases: ['KICKER', 'K', 'P'] },
    { id: 'RBH', name: 'RBH', group: 'ST', aliases: ['RBH'] },
  ],
  kickReturn: [
    { id: 'T1', name: 'T1', group: 'ST', aliases: ['T1'] },
    { id: 'G1', name: 'G1', group: 'ST', aliases: ['G1'] },
    { id: 'C', name: 'C', group: 'ST', aliases: ['C'] },
    { id: 'G2', name: 'G2', group: 'ST', aliases: ['G2'] },
    { id: 'T2', name: 'T2', group: 'ST', aliases: ['T2'] },
    { id: 'XL1', name: 'XL1', group: 'ST', aliases: ['XL1'] },
    { id: 'XR1', name: 'XR1', group: 'ST', aliases: ['XR1'] },
    { id: 'XL2', name: 'XL2', group: 'ST', aliases: ['XL2'] },
    { id: 'XR2', name: 'XR2', group: 'ST', aliases: ['XR2'] },
    { id: 'XL3', name: 'XL3', group: 'ST', aliases: ['XL3'] },
    { id: 'XR3', name: 'XR3', group: 'ST', aliases: ['XR3'] },
  ],
  punt: [
    { id: 'Y2', name: 'Y2', group: 'ST', aliases: ['Y2'] },
    { id: 'LT', name: 'LT', group: 'ST', aliases: ['LT'] },
    { id: 'LG', name: 'LG', group: 'ST', aliases: ['LG'] },
    { id: 'C', name: 'C', group: 'ST', aliases: ['C', 'LS'] },
    { id: 'RG', name: 'RG', group: 'ST', aliases: ['RG'] },
    { id: 'RT', name: 'RT', group: 'ST', aliases: ['RT'] },
    { id: 'Y1', name: 'Y1', group: 'ST', aliases: ['Y1'] },
    { id: 'GUNNER3', name: 'Gunner 3', group: 'ST', aliases: ['GUNNER3', '3', 'G3'] },
    { id: 'PP', name: 'PP', group: 'ST', aliases: ['PP', 'PP2', '2', 'PERSONALPROTECTOR'] },
    { id: 'GUNNER4', name: 'Gunner 4', group: 'ST', aliases: ['GUNNER4', '4', 'G4'] },
    { id: 'PUNTER', name: 'Punter', group: 'ST', aliases: ['PUNTER', 'KICKER', 'P', 'K'] },
  ],
  fgxp: [
    { id: 'LE', name: 'LE', group: 'ST', aliases: ['LE'] },
    { id: 'LT', name: 'LT', group: 'ST', aliases: ['LT'] },
    { id: 'LG', name: 'LG', group: 'ST', aliases: ['LG'] },
    { id: 'LS', name: 'LS', group: 'ST', aliases: ['LS', 'C'] },
    { id: 'RG', name: 'RG', group: 'ST', aliases: ['RG'] },
    { id: 'RT', name: 'RT', group: 'ST', aliases: ['RT'] },
    { id: 'RE', name: 'RE', group: 'ST', aliases: ['RE'] },
    { id: 'WINGL', name: 'Wing L', group: 'ST', aliases: ['WINGL', 'WL'] },
    { id: 'WINGR', name: 'Wing R', group: 'ST', aliases: ['WINGR', 'WR'] },
    { id: 'HOLDER', name: 'Holder', group: 'ST', aliases: ['HOLDER', 'H'] },
    { id: 'KICKER', name: 'Kicker', group: 'ST', aliases: ['KICKER', 'K'] },
  ],
};

export function filmStKindFromPlay(
  play: Pick<HudlImportedPlay, 'playType' | 'result'> | undefined,
  override?: FilmStKind
): FilmStKind {
  if (override) return override;
  const text = `${play?.playType || ''} ${play?.result || ''}`.toLowerCase();
  if (/ko\s*rec|kick\s*ret|kor/.test(text)) return 'kickReturn';
  if (/punt/.test(text)) return 'punt';
  if (/2\s*pt|fg|xp|pat|extra|field\s*goal/.test(text)) return 'fgxp';
  return 'kickoff';
}

export function filmSlotsForSt(kind: FilmStKind): FilmSlotDef[] {
  return FILM_ST_SLOTS[kind];
}

export function filmSlotsForSide(side: PprSide): FilmSlotDef[] {
  return side === 'offense' ? FILM_OFFENSE_SLOTS : FILM_DEFENSE_SLOTS;
}

function headerKey(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function colIndex(headers: string[], aliases: string[]): number {
  const keys = headers.map(headerKey);
  for (const alias of aliases) {
    const idx = keys.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function cell(row: string[], idx: number): string {
  if (idx < 0) return '';
  return String(row[idx] ?? '').trim();
}

function jerseyName(jersey: string, name: string): string {
  const num = jersey.replace(/^#+/, '').trim();
  const label = name.trim();
  if (num && label) return `#${num} ${label}`;
  if (label) return label;
  if (num) return `#${num}`;
  return '';
}

export function parseHudlOdk(raw: string): FilmOdk {
  const v = String(raw || '')
    .trim()
    .toUpperCase();
  if (v === 'O' || v.startsWith('OFF')) return 'offense';
  if (v === 'D' || v.startsWith('DEF')) return 'defense';
  return 'special';
}

export function emptyColorLineup(side: PprSide): Record<string, FilmPlayerRef | null> {
  const next: Record<string, FilmPlayerRef | null> = {};
  for (const slot of filmSlotsForSide(side)) next[slot.id] = null;
  return next;
}

const LEGACY_DE_SLOT: Record<string, string> = { LDE: 'WDE', RDE: 'SDE' };

export function remapDeSlotLineup(
  lineup: Record<string, FilmPlayerRef | null> | undefined
): Record<string, FilmPlayerRef | null> {
  const next: Record<string, FilmPlayerRef | null> = { ...(lineup || {}) };
  for (const [from, to] of Object.entries(LEGACY_DE_SLOT)) {
    if (next[from] != null && !next[to]) next[to] = next[from];
    delete next[from];
  }
  return next;
}

export function emptyStLineup(kind: FilmStKind): Record<string, FilmPlayerRef | null> {
  const next: Record<string, FilmPlayerRef | null> = {};
  for (const slot of filmSlotsForSt(kind)) next[slot.id] = null;
  return next;
}

export function emptyFilmPackages(): FilmSession['packages'] {
  const special = {} as Record<FilmStKind, Record<FilmUnitColor, Record<string, FilmPlayerRef | null>>>;
  for (const kind of FILM_ST_KINDS) {
    special[kind.id] = {
      gold: emptyStLineup(kind.id),
      blue: emptyStLineup(kind.id),
      black: emptyStLineup(kind.id),
    };
  }
  return {
    offense: {
      gold: emptyColorLineup('offense'),
      blue: emptyColorLineup('offense'),
      black: emptyColorLineup('offense'),
    },
    defense: {
      gold: emptyColorLineup('defense'),
      blue: emptyColorLineup('defense'),
      black: emptyColorLineup('defense'),
    },
    special,
  };
}

export function emptyFilmSession(): FilmSession {
  return {
    plays: [],
    packages: emptyFilmPackages(),
    assignments: {},
    packagesColorOrder: FILM_PACKAGES_COLOR_ORDER,
  };
}

export function hydrateFilmSession(session?: Partial<FilmSession> | null): FilmSession {
  const empty = emptyFilmSession();
  const packages = session?.packages?.offense && session?.packages?.defense ? session.packages : empty.packages;
  const special = empty.packages.special!;
  const storedSpecial = packages.special;
  if (storedSpecial) {
    for (const kind of FILM_ST_KINDS) {
      special[kind.id] = {
        gold: { ...special[kind.id].gold, ...(storedSpecial[kind.id]?.gold || {}) },
        blue: { ...special[kind.id].blue, ...(storedSpecial[kind.id]?.blue || {}) },
        black: { ...special[kind.id].black, ...(storedSpecial[kind.id]?.black || {}) },
      };
    }
  }
  return {
    plays: Array.isArray(session?.plays) ? session.plays : [],
    packages: {
      offense: {
        gold: remapDeSlotLineup({ ...empty.packages.offense.gold, ...packages.offense.gold }),
        blue: remapDeSlotLineup({ ...empty.packages.offense.blue, ...packages.offense.blue }),
        black: remapDeSlotLineup({ ...empty.packages.offense.black, ...packages.offense.black }),
      },
      defense: {
        gold: remapDeSlotLineup({ ...empty.packages.defense.gold, ...packages.defense.gold }),
        blue: remapDeSlotLineup({ ...empty.packages.defense.blue, ...packages.defense.blue }),
        black: remapDeSlotLineup({ ...empty.packages.defense.black, ...packages.defense.black }),
      },
      special,
    },
    assignments: session?.assignments && typeof session.assignments === 'object' ? session.assignments : {},
    importedAt: session?.importedAt,
    fileName: session?.fileName,
    packagesUpdatedAt: session?.packagesUpdatedAt,
    packagesColorOrder: session?.packagesColorOrder,
  };
}

export function parseHudlExportRows(rawRows: unknown[][]): HudlImportedPlay[] {
  if (!rawRows.length) return [];
  const headerRow = (rawRows[0] || []).map((value) => String(value ?? ''));
  const playIdx = colIndex(headerRow, ['play', 'play#', 'playnumber', 'playno']);
  const qtrIdx = colIndex(headerRow, ['qtr', 'quarter']);
  const odkIdx = colIndex(headerRow, ['odk', 'od', 'offensedefense']);
  const resultIdx = colIndex(headerRow, ['result', 'playresult']);
  const typeIdx = colIndex(headerRow, ['playtype', 'type']);
  const gainIdx = colIndex(headerRow, ['gnls', 'gain', 'yards']);
  const dnIdx = colIndex(headerRow, ['dn', 'down']);
  const distIdx = colIndex(headerRow, ['dist', 'distance', 'togo']);
  const yardIdx = colIndex(headerRow, ['yardln', 'yardline', 'yrdln', 'ballon']);
  const hashIdx = colIndex(headerRow, ['hash']);
  const seriesIdx = colIndex(headerRow, ['series']);
  const dirIdx = colIndex(headerRow, ['playdir']);
  const teamIdx = colIndex(headerRow, ['team']);
  const effIdx = colIndex(headerRow, ['eff', 'efficient']);
  const rusherJ = colIndex(headerRow, ['rusherjersey']);
  const rusherN = colIndex(headerRow, ['rushername']);
  const passerJ = colIndex(headerRow, ['passerjersey']);
  const passerN = colIndex(headerRow, ['passername']);
  const recvJ = colIndex(headerRow, ['receiverjersey']);
  const recvN = colIndex(headerRow, ['receivername']);
  const keyJ = colIndex(headerRow, ['keyplayerjersey']);
  const keyN = colIndex(headerRow, ['keyplayername']);

  const plays: HudlImportedPlay[] = [];
  rawRows.slice(1).forEach((raw, idx) => {
    const row = (raw || []).map((value) => String(value ?? ''));
    const playNumber = cell(row, playIdx) || String(idx + 1);
    const odkRaw = cell(row, odkIdx);
    const result = cell(row, resultIdx);
    const playType = cell(row, typeIdx);
    if (!odkRaw && !result && !playType && !cell(row, yardIdx)) return;
    plays.push({
      id: `hudl_${playNumber}_${idx}`,
      playNumber,
      odk: parseHudlOdk(odkRaw || playType),
      quarter: cell(row, qtrIdx),
      down: cell(row, dnIdx),
      distance: cell(row, distIdx),
      yardLine: cell(row, yardIdx),
      hash: cell(row, hashIdx),
      series: cell(row, seriesIdx),
      gain: cell(row, gainIdx),
      result,
      playType,
      playDir: cell(row, dirIdx),
      team: cell(row, teamIdx),
      rusher: jerseyName(cell(row, rusherJ), cell(row, rusherN)),
      passer: jerseyName(cell(row, passerJ), cell(row, passerN)),
      receiver: jerseyName(cell(row, recvJ), cell(row, recvN)),
      keyPlayer: jerseyName(cell(row, keyJ), cell(row, keyN)),
      efficient: cell(row, effIdx),
    });
  });
  return plays;
}

export function parseHudlWorkbook(workbook: XLSX.WorkBook): HudlImportedPlay[] {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
  return parseHudlExportRows(rows);
}

export async function parseHudlExportFile(file: File): Promise<{ plays: HudlImportedPlay[]; fileName: string }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return { plays: parseHudlWorkbook(workbook), fileName: file.name };
}

export function mergeHudlPlays(
  existing: HudlImportedPlay[],
  incoming: HudlImportedPlay[],
  mode: 'replace' | 'append'
): HudlImportedPlay[] {
  if (mode === 'replace') return incoming;
  const seen = new Set(existing.map((play) => play.playNumber));
  return [...existing, ...incoming.filter((play) => !seen.has(play.playNumber))];
}

export function matchFilmStSlotId(rawName: string, kind: FilmStKind): string | null {
  const cleaned = String(rawName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return null;
  for (const slot of filmSlotsForSt(kind)) {
    if (slot.id === cleaned || slot.aliases.includes(cleaned)) return slot.id;
  }
  return null;
}

export function isStSourceFormation(form: FormationBoard | undefined, kind: FilmStKind): boolean {
  if (!form) return false;
  const name = `${form.name || ''} ${form.id || ''}`.toLowerCase();
  const isSt = form.unit === 'st' || /kick|punt|pat|field goal|fg|special/.test(name);
  if (!isSt) return false;
  if (kind === 'kickReturn') return /kick\s*ret|kor|form_kr|ko rec/.test(name) && !/coverage/.test(name);
  if (kind === 'kickoff') return (/kickoff|\bko\b|form_ko/.test(name) || name.includes('kick off')) && !/return|kor/.test(name);
  if (kind === 'punt') return /punt|form_punt/.test(name);
  return /field goal|\bfg\b|pat|extra|2\s*pt|form_fg/.test(name);
}

export function matchFilmSlotId(rawName: string, side: PprSide): string | null {
  const slots = filmSlotsForSide(side);
  const cleaned = String(rawName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  for (const slot of slots) {
    if (slot.id === cleaned || slot.aliases.includes(cleaned)) return slot.id;
  }
  return null;
}

function rosterPlayerRef(player: RosterPlayer): FilmPlayerRef {
  return {
    num: String(player.num || '').trim(),
    id: player.id,
    name: `${player.firstName || ''} ${player.lastName || ''}`.trim(),
  };
}

export function fillPackagesFromDepth(
  roster: RosterPlayer[],
  depthChart: Record<string, PlacedPlayer[]> | undefined,
  formations: FormationBoard[] | undefined
): FilmSession['packages'] {
  const packages = emptyFilmPackages();
  const byNum = new Map<string, RosterPlayer>();
  for (const player of roster) {
    if (player.num) byNum.set(String(player.num).trim(), player);
  }
  const colors = DEPTH_COLOR_BY_INDEX;

  const fillSide = (side: PprSide) => {
    const used = new Set<string>();
    for (const form of formations || []) {
      if (!isPffSourceFormation(form, side)) continue;
      for (const row of form.rows || []) {
        for (const slot of row.positions || []) {
          if (!slot) continue;
          if (!matchFilmSlotId(slot.name || slot.tag || '', side)) continue;
          const assigned = depthChart?.[slot.id] || [];
          assigned.forEach((placed, idx) => {
            if (idx > 2 || !placed?.num || placed.num === '?') return;
            const color = colors[idx];
            const canonicalId = matchFilmSlotId(slot.name || slot.tag || '', side);
            if (!canonicalId) return;
            const key = `${side}:${color}:${canonicalId}`;
            if (used.has(key)) return;
            const rosterPlayer = byNum.get(String(placed.num).trim());
            packages[side][color][canonicalId] = rosterPlayer
              ? rosterPlayerRef(rosterPlayer)
              : { num: String(placed.num).trim(), name: placed.name };
            used.add(key);
          });
        }
      }
    }
  };

  fillSide('offense');
  fillSide('defense');

  for (const kind of FILM_ST_KINDS) {
    const used = new Set<string>();
    if (!packages.special) continue;
    for (const form of formations || []) {
      if (!isStSourceFormation(form, kind.id)) continue;
      for (const row of form.rows || []) {
        for (const slot of row.positions || []) {
          if (!slot) continue;
          const canonicalId = matchFilmStSlotId(slot.name || slot.tag || '', kind.id);
          if (!canonicalId) continue;
          const assigned = depthChart?.[slot.id] || [];
          assigned.forEach((placed, idx) => {
            if (idx > 2 || !placed?.num || placed.num === '?') return;
            const color = colors[idx];
            const key = `${kind.id}:${color}:${canonicalId}`;
            if (used.has(key)) return;
            const rosterPlayer = byNum.get(String(placed.num).trim());
            packages.special![kind.id][color][canonicalId] = rosterPlayer
              ? rosterPlayerRef(rosterPlayer)
              : { num: String(placed.num).trim(), name: placed.name };
            used.add(key);
          });
        }
      }
    }
  }

  return packages;
}

export function unitHasPlayers(
  packages: FilmSession['packages'] | undefined,
  side: 'offense' | 'defense'
): boolean {
  if (!packages?.[side]) return false;
  return FILM_UNIT_COLORS.some((color) => Object.values(packages[side][color.id] || {}).some(Boolean));
}

export function stHasPlayers(packages: FilmSession['packages'] | undefined): boolean {
  if (!packages?.special) return false;
  return FILM_ST_KINDS.some((kind) =>
    FILM_UNIT_COLORS.some((color) => Object.values(packages.special?.[kind.id]?.[color.id] || {}).some(Boolean))
  );
}

export function packagesHavePlayers(packages: FilmSession['packages'] | undefined): boolean {
  return unitHasPlayers(packages, 'offense') || unitHasPlayers(packages, 'defense') || stHasPlayers(packages);
}

export function playSide(play: HudlImportedPlay, assignment?: FilmPlayAssignment): FilmOdk {
  return assignment?.odkOverride || play.odk;
}

export function resolvePlayLineup(
  session: FilmSession,
  play: HudlImportedPlay
): { slot: FilmSlotDef; player: FilmPlayerRef | null }[] {
  const assignment = session.assignments[play.id];
  const side = playSide(play, assignment);
  const color = assignment?.color || 'black';
  if (side === 'special') {
    const kind = filmStKindFromPlay(play, assignment?.stKindOverride);
    const base = session.packages.special?.[kind]?.[color] || emptyStLineup(kind);
    const overrides = assignment?.slotOverrides || {};
    return filmSlotsForSt(kind).map((slot) => {
      const hasOverride = Object.prototype.hasOwnProperty.call(overrides, slot.id);
      const player = hasOverride ? overrides[slot.id] : base[slot.id] || null;
      return { slot, player };
    });
  }
  const base = remapDeSlotLineup(session.packages?.[side]?.[color] || emptyColorLineup(side));
  const overrides = remapDeSlotLineup(assignment?.slotOverrides || {});
  return filmSlotsForSide(side).map((slot) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, slot.id);
    const player = hasOverride ? overrides[slot.id] : base[slot.id] || null;
    return { slot, player };
  });
}

export function findRosterPlayer(
  roster: RosterPlayer[],
  ref: FilmPlayerRef | null | undefined
): RosterPlayer | undefined {
  if (!ref) return undefined;
  const num = String(ref.num || '').trim();
  const id = String(ref.id || '').trim();
  return roster.find((player) => {
    if (id && playerPprKey(player) === id) return true;
    if (id && String(player.id || '').trim() === id) return true;
    return num && String(player.num || '').trim() === num;
  });
}

export function filmPlayLabel(play: HudlImportedPlay): string {
  const bits = [
    play.result,
    play.playType,
    play.gain ? `${play.gain} yds` : '',
    play.rusher ? `Rush ${play.rusher}` : '',
    play.passer ? `Pass ${play.passer}` : '',
  ].filter(Boolean);
  return bits.join(' · ') || 'Play';
}
