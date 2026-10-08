/**
 * Playbook database, hole numbers, formation coordinates, and assemblePlay.
 * Ported from Mahopac 10U / Hudl decoupled models (Gemini footballEngine).
 */

/** label: the name a coach gave this player ("Sam", "Jake"), shown on the diagram instead of the usual letter. */
/** The player tagged at a spot (from the depth chart): jersey number, name, the unit, and the spot's name. */
export type NodePlayer = { num: string; name: string; unit?: 'black' | 'gold' | 'blue'; pos?: string };
/** `show`: a tagged defender shows his jersey number instead of his position. */
export type PlayNode = { role: string; x: number; y: number; line?: boolean; label?: string; player?: NodePlayer; show?: 'number' };

/** Our defense on the play diagrams (the builder and the saved pictures). One place to change it. */
export const DEFENSE_COLOR = '#15803d';

/** The little number tag on a tagged defender: the unit's color (Black / Gold / Blue). */
export const UNIT_TAG: Record<string, { bg: string; ink: string }> = {
  black: { bg: '#0f172a', ink: '#ffffff' },
  gold: { bg: '#f59e0b', ink: '#111827' },
  blue: { bg: '#2563eb', ink: '#ffffff' },
};
/** A player's name cut short enough for a defender's box ("Cambigia…"). */
export const shortPlayerName = (name?: string) => {
  const n = String(name || '').trim();
  return n.length > 9 ? `${n.slice(0, 8)}…` : n;
};
/** What a defender's box says: the name a coach typed, else the tagged player's name, else `fallback` (the position letter). */
/** What a player's mark says: the name the coach typed, else (when set) his jersey number, else his position. */
export const shownText = (n: PlayNode, fallback: string) => n.label?.trim() || (n.show === 'number' && n.player?.num ? String(n.player.num) : '') || fallback;
export const tagColors = (player?: NodePlayer) => UNIT_TAG[player?.unit || ''] || { bg: '#64748b', ink: '#ffffff' };
export const tagWidth = (num: string) => Math.max(13, String(num).length * 5.4 + 7);

export const HOLE_SYSTEM: Record<number, { side: string; type: string; description: string }> = {
  1: { side: 'Right', type: 'Perimeter', description: 'Outside sweep / D-gap right' },
  2: { side: 'Right', type: 'Off-Tackle', description: 'C-gap off tackle/TE hip right' },
  3: { side: 'Right', type: 'Off-Guard', description: 'B-gap between RG and RT' },
  4: { side: 'Right', type: 'Interior', description: 'A-gap between C and RG' },
  5: { side: 'Center', type: 'Zero-Hole', description: 'Direct sneak/wedge over Center' },
  6: { side: 'Left', type: 'Interior', description: 'A-gap between C and LG' },
  7: { side: 'Left', type: 'Off-Guard', description: 'B-gap between LG and LT' },
  8: { side: 'Left', type: 'Off-Tackle', description: 'C-gap off tackle/TE hip left' },
  9: { side: 'Left', type: 'Perimeter', description: 'Outside sweep / D-gap left' },
};

export const PERSONNEL_DEFINITIONS: Record<number, { rb: number; te: number; wr: number; label: string }> = {
  10: { rb: 1, te: 0, wr: 4, label: '10 Personnel (Spread 4-Wide)' },
  11: { rb: 1, te: 1, wr: 3, label: '11 Personnel (1 RB, 1 TE, 3 WR)' },
  12: { rb: 1, te: 2, wr: 2, label: '12 Personnel (1 RB, 2 TE, 2 WR)' },
  20: { rb: 2, te: 0, wr: 3, label: '20 Personnel (Spread 2-Back)' },
  21: { rb: 2, te: 1, wr: 2, label: '21 Personnel (Base I / Pro)' },
  22: { rb: 2, te: 2, wr: 1, label: '22 Personnel (Double Tight / Heavy)' },
  30: { rb: 3, te: 0, wr: 2, label: '30 Personnel (Fullhouse Open)' },
  31: { rb: 3, te: 1, wr: 1, label: '31 Personnel (Power I / Heavy T)' },
  32: { rb: 3, te: 2, wr: 0, label: '32 Personnel (Wishbone / Double Wing)' },
};

export interface BaseFormation {
  personnel: number;
  hudlBase: string;
  tags: string[];
  perimeterNodes: PlayNode[];
  /** Weak tackle slides outside the strong tackle. The tight end is the end. */
  tackleOver?: boolean;
}

export const BASE_FORMATIONS: Record<string, BaseFormation> = {
  '10_SPREAD_2X2': {
    personnel: 10,
    hudlBase: 'Spread 2x2',
    tags: ['Bubble', 'Smoke', 'Orbit', 'Stick', 'Snag'],
    perimeterNodes: [
      { role: 'X', x: -16, y: 0, line: true },
      { role: 'H', x: -11, y: -1, line: false },
      { role: 'Y', x: 11, y: -1, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '10_TRIPS': {
    personnel: 10,
    hudlBase: 'Trips Open',
    tags: ['Laser', 'Jet', 'Flood', 'All Hitch'],
    perimeterNodes: [
      { role: 'X', x: -16, y: 0, line: true },
      { role: 'H', x: 8, y: -0.5, line: false },
      { role: 'Y', x: 12, y: -0.5, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '10_QUADS': {
    personnel: 10,
    hudlBase: 'Quads',
    tackleOver: true,
    tags: ['Flood', 'All Hitch', 'Stick'],
    perimeterNodes: [
      { role: 'H', x: 8, y: -1, line: false },
      { role: 'Y', x: 11.5, y: -1, line: false },
      { role: 'X', x: 15, y: 0, line: true },
      { role: 'Z', x: 18.5, y: 0, line: true },
    ],
  },
  '11_PRO': {
    personnel: 11,
    hudlBase: 'Pro',
    tags: ['Jet', 'Bubble', 'Smoke', 'Fake Jet', 'Waggle'],
    perimeterNodes: [
      { role: 'X', x: -15, y: 0, line: true },
      { role: 'W', x: -10.5, y: -1, line: false },
      { role: 'Y', x: 6.5, y: 0, line: true },
      { role: 'Z', x: 15, y: -1, line: false },
    ],
  },
  '11_TRIPS': {
    personnel: 11,
    hudlBase: 'Trips',
    tags: ['Laser', 'Flood', 'Stick', 'Snag'],
    perimeterNodes: [
      { role: 'Y', x: -6, y: 0, line: true },
      { role: 'X', x: 8, y: -1, line: false },
      { role: 'W', x: 12, y: -1, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '12_ACE': {
    personnel: 12,
    hudlBase: 'Ace',
    tags: ['Stretch', 'Zone', 'Boot', 'Nasty'],
    perimeterNodes: [
      { role: 'X', x: -16, y: -1.6, line: false },
      { role: 'Y1', x: -6.4, y: 0, line: true },
      { role: 'Y2', x: 6.4, y: 0, line: true },
      { role: 'Z', x: 16, y: -1.6, line: false },
    ],
  },
  '12_WING': {
    personnel: 12,
    hudlBase: 'Wing',
    tags: ['Power', 'Counter', 'Crack', 'Jet'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y1', x: 6, y: 0, line: true },
      { role: 'Y2', x: 9.2, y: -1.6, line: false },
      { role: 'Z', x: 14, y: -0.5, line: false },
    ],
  },
  '12_DOUBLE_TE_SIDE': {
    personnel: 12,
    hudlBase: 'Double TE Heavy',
    tags: ['Power', 'Buck Sweep', 'Belly', 'Toss Sweep', 'Down'],
    perimeterNodes: [
      { role: 'X', x: -15, y: 0, line: true },
      { role: 'Y1', x: 6, y: 0, line: true },
      { role: 'Y2', x: 8.4, y: 0, line: true },
      { role: 'Z', x: 15, y: -1, line: false },
    ],
  },
  '20_SPREAD_OPEN': {
    personnel: 20,
    hudlBase: 'Spread Open',
    tags: ['Mesh', 'Bubble', 'Speed Option'],
    perimeterNodes: [
      { role: 'X', x: -16, y: 0, line: true },
      { role: 'W', x: -11, y: -1, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '20_TWINS': {
    personnel: 20,
    hudlBase: 'Twins',
    tags: ['Crack', 'Bubble', 'Speed Option'],
    perimeterNodes: [
      { role: 'X', x: -16, y: 0, line: true },
      { role: 'W', x: 11, y: -1.5, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '20_WING_T': {
    personnel: 20,
    hudlBase: 'Wing Open',
    tags: ['Down', 'Buck Lateral', 'Waggle'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'W', x: 9, y: -1.4, line: false },
      { role: 'Z', x: 14, y: 0, line: true },
    ],
  },
  '20_TRIPS': {
    personnel: 20,
    hudlBase: 'Trips',
    tackleOver: true,
    tags: ['Laser', 'Flood', 'Bubble'],
    perimeterNodes: [
      { role: 'W', x: 8, y: -1, line: false },
      { role: 'X', x: 12, y: 0, line: true },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '21_PRO': {
    personnel: 21,
    hudlBase: 'Pro',
    tags: ['Boot', 'Keep', 'Crack', 'Power Pass', 'Dive'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y', x: 6, y: 0, line: true },
      { role: 'Z', x: 14, y: -0.5, line: false },
    ],
  },
  '21_TWINS': {
    personnel: 21,
    hudlBase: 'Twins',
    tags: ['Crack', 'Bubble', 'Quick Screen', 'Go-Out', 'Option', 'Speed Option'],
    perimeterNodes: [
      { role: 'Y', x: -6.4, y: 0, line: true },
      { role: 'W', x: 11, y: -1.5, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '21_TWINS_I': {
    personnel: 21,
    hudlBase: 'Twins I',
    tags: ['Option', 'Speed Option', 'Load', 'Veer', 'Crack'],
    perimeterNodes: [
      { role: 'Y', x: -6, y: 0, line: true },
      { role: 'W', x: 10, y: -0.5, line: false },
      { role: 'Z', x: 14, y: 0, line: true },
    ],
  },
  '21_BEAST': {
    personnel: 21,
    hudlBase: 'Beast',
    tackleOver: true,
    tags: ['Power', 'Sweep', 'Down', 'Keep', 'Option'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y', x: 8.5, y: 0, line: true },
      { role: 'W', x: 10.8, y: -1.15, line: false },
    ],
  },
  '22_BEAST': {
    personnel: 22,
    hudlBase: 'Beast',
    tackleOver: true,
    tags: ['Power', 'Sweep', 'Down', 'Blast'],
    perimeterNodes: [
      { role: 'X', x: -14, y: -0.5, line: false },
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 8.5, y: 0, line: true },
    ],
  },
  '21_TIGHT': {
    personnel: 21,
    hudlBase: 'Tight',
    tags: ['Mesh', 'Down', 'Drag', 'Freeze'],
    perimeterNodes: [
      { role: 'X', x: -8, y: 0, line: true },
      { role: 'Y', x: 6, y: 0, line: true },
      { role: 'Z', x: 8, y: -0.5, line: false },
    ],
  },
  '21_WING_T': {
    personnel: 21,
    hudlBase: 'Pro Wing',
    tags: ['Down', 'Reverse', 'Keep', 'Waggle', 'Option'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y', x: 6, y: 0, line: true },
      { role: 'Z', x: 9.2, y: -1.6, line: false },
    ],
  },
  '22_DOUBLE_TIGHT': {
    personnel: 22,
    hudlBase: 'Double Tight',
    tags: ['Power', 'Counter', 'Down', 'Blast'],
    perimeterNodes: [
      { role: 'X', x: -14, y: -0.5, line: false },
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 6, y: 0, line: true },
    ],
  },
  '22_WING': {
    personnel: 22,
    hudlBase: 'Double Tight Wing',
    tags: ['Power', 'Toss Sweep', 'Power Pass'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y1', x: 6, y: 0, line: true },
      { role: 'Y2', x: 9.2, y: -1.6, line: false },
    ],
  },
  '22_DOUBLE_TE_SIDE': {
    personnel: 22,
    hudlBase: 'Double TE Heavy',
    tags: ['Power', 'Buck Sweep', 'Belly', 'Blast', 'Down G'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y1', x: 6, y: 0, line: true },
      { role: 'Y2', x: 8.4, y: 0, line: true },
    ],
  },
  '30_FULLHOUSE_OPEN': {
    personnel: 30,
    hudlBase: 'Spread Open',
    tags: ['Dive', 'Option', 'Crack'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Z', x: 14, y: 0, line: true },
    ],
  },
  '31_POWER': {
    personnel: 31,
    hudlBase: 'Pro',
    tags: ['Blast', 'Wedge', 'Power Lead'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y', x: 6, y: 0, line: true },
    ],
  },
  '32_WISHBONE': {
    personnel: 32,
    hudlBase: 'Wishbone',
    tags: ['Dive', 'Zone', 'Toss Sweep', 'Counter', 'Power Pass'],
    perimeterNodes: [
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 6, y: 0, line: true },
    ],
  },
  '32_DOUBLE_WING': {
    personnel: 32,
    hudlBase: 'Double Wing',
    tags: ['Rocket', 'Wedge', 'Counter Sweep'],
    perimeterNodes: [
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 6, y: 0, line: true },
    ],
  },
  '11_TE_WING': {
    personnel: 11,
    hudlBase: 'TE Wing',
    tags: ['Down', 'Crack', 'Option'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'W', x: -11, y: -1, line: false },
      { role: 'Y', x: 7.6, y: -1.7, line: false },
      { role: 'Z', x: 14, y: 0, line: true },
    ],
  },
  '11_TE_SLOT': {
    personnel: 11,
    hudlBase: 'TE Slot',
    tags: ['Stick', 'Snag', 'Bubble'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'W', x: -11, y: -1, line: false },
      { role: 'Y', x: 11, y: -1, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '11_TE_WEAK': {
    personnel: 11,
    hudlBase: 'Twins',
    tags: ['Crack', 'Bubble', 'Option'],
    perimeterNodes: [
      { role: 'X', x: -16, y: -1.5, line: false },
      { role: 'Y', x: -6.4, y: 0, line: true },
      { role: 'W', x: 11, y: -1.5, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '12_TE_WING': {
    personnel: 12,
    hudlBase: 'TE Wing',
    tags: ['Power', 'Down', 'Crack'],
    perimeterNodes: [
      { role: 'X', x: -14, y: -0.5, line: false },
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 7.6, y: -1.7, line: false },
      { role: 'Z', x: 14, y: 0, line: true },
    ],
  },
  '12_TE_SLOT': {
    personnel: 12,
    hudlBase: 'TE Slot',
    tags: ['Boot', 'Stick', 'Stretch'],
    perimeterNodes: [
      { role: 'X', x: -14, y: -0.5, line: false },
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 11, y: -1, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '12_TWINS': {
    personnel: 12,
    hudlBase: 'Twins',
    tags: ['Crack', 'Bubble', 'Boot', 'Power'],
    perimeterNodes: [
      { role: 'Y1', x: -6.4, y: 0, line: true },
      { role: 'Y2', x: 6.4, y: 0, line: true },
      { role: 'X', x: 11, y: -1.5, line: false },
      { role: 'Z', x: 16, y: -1.5, line: false },
    ],
  },
  '12_TE_OVER': {
    personnel: 12,
    hudlBase: 'TE Over',
    tags: ['Power', 'Down', 'Sweep'],
    tackleOver: true,
    perimeterNodes: [
      { role: 'X', x: -14, y: -0.5, line: false },
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 8.5, y: 0, line: true },
      { role: 'Z', x: 16, y: -0.5, line: false },
    ],
  },
  '21_TE_WING': {
    personnel: 21,
    hudlBase: 'TE Wing',
    tags: ['Down', 'Waggle', 'Option'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y', x: 7.6, y: -1.7, line: false },
      { role: 'Z', x: 14, y: 0, line: true },
    ],
  },
  '21_TE_SLOT': {
    personnel: 21,
    hudlBase: 'TE Slot',
    tags: ['Stick', 'Boot', 'Bubble'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y', x: 11, y: -1, line: false },
      { role: 'Z', x: 16, y: 0, line: true },
    ],
  },
  '21_TE_SPLIT': {
    personnel: 21,
    hudlBase: 'TE Split',
    tags: ['Stretch', 'Crack', 'Bubble'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Z', x: 10, y: -1, line: false },
      { role: 'Y', x: 14, y: 0, line: true },
    ],
  },
  '22_TE_WING': {
    personnel: 22,
    hudlBase: 'TE Wing',
    tags: ['Power', 'Down', 'Counter'],
    perimeterNodes: [
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 7.6, y: -1.7, line: false },
      { role: 'X', x: 14, y: 0, line: true },
    ],
  },
  '22_TE_SLOT': {
    personnel: 22,
    hudlBase: 'TE Slot',
    tags: ['Boot', 'Stretch', 'Stick'],
    perimeterNodes: [
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 11, y: -1, line: false },
      { role: 'X', x: 16, y: 0, line: true },
    ],
  },
  '22_TWINS': {
    personnel: 22,
    hudlBase: 'Twins',
    tags: ['Crack', 'Power', 'Boot'],
    perimeterNodes: [
      { role: 'Y1', x: -6.4, y: 0, line: true },
      { role: 'Y2', x: 10, y: -1.5, line: false },
      { role: 'X', x: 15, y: 0, line: true },
    ],
  },
  '22_TE_SPLIT': {
    personnel: 22,
    hudlBase: 'TE Split',
    tags: ['Stretch', 'Power', 'Crack'],
    perimeterNodes: [
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'X', x: 10, y: -1, line: false },
      { role: 'Y2', x: 14, y: 0, line: true },
    ],
  },
  '30_TIGHT': {
    personnel: 30,
    hudlBase: 'Tight',
    tags: ['Dive', 'Wedge', 'Option'],
    perimeterNodes: [
      { role: 'X', x: -8, y: 0, line: true },
      { role: 'Z', x: 8, y: 0, line: true },
    ],
  },
  '30_TWINS': {
    personnel: 30,
    hudlBase: 'Twins',
    tackleOver: true,
    tags: ['Crack', 'Bubble', 'Option'],
    perimeterNodes: [
      { role: 'Z', x: 9, y: 0, line: true },
      { role: 'X', x: 13, y: 0, line: true },
    ],
  },
  '31_TE_SPLIT': {
    personnel: 31,
    hudlBase: 'TE Split',
    tags: ['Stretch', 'Crack', 'Power'],
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y', x: 12, y: 0, line: true },
    ],
  },
  '31_TE_NASTY': {
    personnel: 31,
    hudlBase: 'TE Nasty',
    tags: ['Down', 'Wedge', 'Blast'],
    perimeterNodes: [
      { role: 'X', x: -8, y: 0, line: true },
      { role: 'Y', x: 5.4, y: 0, line: true },
    ],
  },
  '31_TE_OVER': {
    personnel: 31,
    hudlBase: 'TE Over',
    tags: ['Power', 'Down', 'Sweep'],
    tackleOver: true,
    perimeterNodes: [
      { role: 'X', x: -14, y: 0, line: true },
      { role: 'Y', x: 8.5, y: 0, line: true },
    ],
  },
  '31_WR_RIGHT': {
    personnel: 31,
    hudlBase: 'Pro',
    tags: ['Blast', 'Wedge', 'Power Lead'],
    perimeterNodes: [
      { role: 'Y', x: -6, y: 0, line: true },
      { role: 'X', x: 14, y: 0, line: true },
    ],
  },
  '31_SPLIT_RIGHT': {
    personnel: 31,
    hudlBase: 'TE Split',
    tags: ['Stretch', 'Crack', 'Power'],
    perimeterNodes: [
      { role: 'Y', x: -12, y: 0, line: true },
      { role: 'X', x: 14, y: 0, line: true },
    ],
  },
  '31_NASTY_RIGHT': {
    personnel: 31,
    hudlBase: 'TE Nasty',
    tags: ['Down', 'Wedge', 'Blast'],
    perimeterNodes: [
      { role: 'Y', x: -5.4, y: 0, line: true },
      { role: 'X', x: 8, y: 0, line: true },
    ],
  },
  '32_TE_SPLIT': {
    personnel: 32,
    hudlBase: 'TE Split',
    tags: ['Stretch', 'Toss Sweep', 'Counter'],
    perimeterNodes: [
      { role: 'Y1', x: -12, y: 0, line: true },
      { role: 'Y2', x: 12, y: 0, line: true },
    ],
  },
  '32_TE_NASTY': {
    personnel: 32,
    hudlBase: 'TE Nasty',
    tags: ['Wedge', 'Down', 'Dive'],
    perimeterNodes: [
      { role: 'Y1', x: -5.4, y: 0, line: true },
      { role: 'Y2', x: 5.4, y: 0, line: true },
    ],
  },
  '32_TE_OVER': {
    personnel: 32,
    hudlBase: 'TE Over',
    tags: ['Power', 'Down', 'Sweep'],
    tackleOver: true,
    perimeterNodes: [
      { role: 'Y1', x: -6, y: 0, line: true },
      { role: 'Y2', x: 8.5, y: 0, line: true },
    ],
  },
  '32_DOUBLE_TE_SIDE': {
    personnel: 32,
    hudlBase: 'Double TE Heavy',
    tags: ['Power', 'Buck Sweep', 'Belly', 'Wedge', 'Blast'],
    perimeterNodes: [
      { role: 'Y1', x: 6, y: 0, line: true },
      { role: 'Y2', x: 8.4, y: 0, line: true },
    ],
  },
};

/** Where the tight end (or the receivers, when there is no tight end) lines up. Backfield is separate. */
export const TE_LOCATIONS: Record<number, { id: string; label: string; baseKey: string }[]> = {
  10: [
    { id: '2x2', label: '2x2', baseKey: '10_SPREAD_2X2' },
    { id: 'trips', label: 'Trips', baseKey: '10_TRIPS' },
    { id: 'quads', label: 'Quads', baseKey: '10_QUADS' },
  ],
  11: [
    { id: 'tight', label: 'Tight', baseKey: '11_PRO' },
    { id: 'wing', label: 'Wing', baseKey: '11_TE_WING' },
    { id: 'slot', label: 'Slot', baseKey: '11_TE_SLOT' },
    { id: 'twins', label: 'Twins', baseKey: '11_TE_WEAK' },
    { id: 'trips', label: 'Trips', baseKey: '11_TRIPS' },
  ],
  12: [
    { id: 'tight', label: 'Tight', baseKey: '12_ACE' },
    { id: 'double_te', label: 'Double TE (1-Side)', baseKey: '12_DOUBLE_TE_SIDE' },
    { id: 'wing', label: 'Wing', baseKey: '12_TE_WING' },
    { id: 'slot', label: 'Slot', baseKey: '12_TE_SLOT' },
    { id: 'twins', label: 'Twins', baseKey: '12_TWINS' },
    { id: 'over', label: 'Tackle over', baseKey: '12_TE_OVER' },
  ],
  20: [
    { id: 'spread', label: 'Spread', baseKey: '20_SPREAD_OPEN' },
    { id: 'twins', label: 'Twins', baseKey: '20_TWINS' },
    { id: 'wing', label: 'Wing', baseKey: '20_WING_T' },
    { id: 'trips', label: 'Trips', baseKey: '20_TRIPS' },
  ],
  21: [
    { id: 'tight', label: 'Tight', baseKey: '21_PRO' },
    { id: 'wing', label: 'Wing', baseKey: '21_TE_WING' },
    { id: 'slot', label: 'Slot', baseKey: '21_TE_SLOT' },
    { id: 'split', label: 'Split', baseKey: '21_TE_SPLIT' },
    { id: 'twins', label: 'Twins', baseKey: '21_TWINS' },
    { id: 'over', label: 'Tackle over', baseKey: '21_BEAST' },
    { id: 'zwing', label: 'Z wing', baseKey: '21_WING_T' },
    { id: 'close', label: 'Close', baseKey: '21_TIGHT' },
  ],
  22: [
    { id: 'tight', label: 'Tight', baseKey: '22_DOUBLE_TIGHT' },
    { id: 'double_te', label: 'Double TE (1-Side)', baseKey: '22_DOUBLE_TE_SIDE' },
    { id: 'wing', label: 'Wing', baseKey: '22_TE_WING' },
    { id: 'slot', label: 'Slot', baseKey: '22_TE_SLOT' },
    { id: 'split', label: 'Split', baseKey: '22_TE_SPLIT' },
    { id: 'twins', label: 'Twins', baseKey: '22_TWINS' },
    { id: 'over', label: 'Tackle over', baseKey: '22_BEAST' },
  ],
  30: [
    { id: 'split', label: 'Split', baseKey: '30_FULLHOUSE_OPEN' },
    { id: 'tight', label: 'Tight', baseKey: '30_TIGHT' },
    { id: 'twins', label: 'Twins', baseKey: '30_TWINS' },
  ],
  31: [
    { id: 'tight', label: 'Tight', baseKey: '31_POWER' },
    { id: 'split', label: 'Split', baseKey: '31_TE_SPLIT' },
    { id: 'nasty', label: 'Snug', baseKey: '31_TE_NASTY' },
    { id: 'over', label: 'Tackle over', baseKey: '31_TE_OVER' },
    { id: 'tight-r', label: 'Tight', baseKey: '31_WR_RIGHT' },
    { id: 'split-r', label: 'Split', baseKey: '31_SPLIT_RIGHT' },
    { id: 'nasty-r', label: 'Snug', baseKey: '31_NASTY_RIGHT' },
  ],
  32: [
    { id: 'tight', label: 'Tight', baseKey: '32_WISHBONE' },
    { id: 'double_te', label: 'Double TE (1-Side)', baseKey: '32_DOUBLE_TE_SIDE' },
    { id: 'split', label: 'Split', baseKey: '32_TE_SPLIT' },
    { id: 'nasty', label: 'Snug', baseKey: '32_TE_NASTY' },
    { id: 'over', label: 'Tackle over', baseKey: '32_TE_OVER' },
  ],
};

const RECEIVER_ALIGN_ORDER = ['left', 'right', 'twins', '1x1', '2x1', 'trips', '2x2', '3x1', 'quads'] as const;

const RECEIVER_ALIGN_LABEL: Record<(typeof RECEIVER_ALIGN_ORDER)[number], string> = {
  left: 'Left',
  right: 'Right',
  twins: 'Twins',
  '1x1': '1x1',
  '2x1': '2x1',
  trips: 'Trips',
  '2x2': '2x2',
  '3x1': 'Trips',
  quads: 'Quads',
};

/** How the wide receivers are split: 1 is left or right, 2 is twins or 1x1, 3 is 2x1 or trips. */
export function receiverAlignment(baseKey: string): string | null {
  const base = BASE_FORMATIONS[baseKey];
  if (!base) return null;
  const te = PERSONNEL_DEFINITIONS[base.personnel]?.te ?? 0;
  let left = 0;
  let right = 0;
  for (const n of base.perimeterNodes) {
    if (te > 0 && (n.role === 'Y' || n.role === 'Y1' || n.role === 'Y2')) continue;
    if (n.x < -0.5) left += 1;
    else if (n.x > 0.5) right += 1;
  }
  const count = left + right;
  if (!count) return null;
  const fewer = Math.min(left, right);
  if (count === 1) return right > left ? 'right' : 'left';
  if (count === 2) return fewer === 0 ? 'twins' : '1x1';
  if (count === 3) return fewer === 0 ? 'trips' : '2x1';
  if (fewer === 0) return 'quads';
  if (fewer === 1) return '3x1';
  return '2x2';
}

/** Alignment choices for this personnel, each with the tight-end spots that fit it. */
export function alignmentsFor(personnel: number): { id: string; label: string; locations: { id: string; label: string; baseKey: string }[] }[] {
  const groups = new Map<string, { id: string; label: string; baseKey: string }[]>();
  for (const loc of TE_LOCATIONS[personnel] || []) {
    const id = receiverAlignment(loc.baseKey);
    if (!id) continue;
    const list = groups.get(id) || [];
    list.push(loc);
    groups.set(id, list);
  }
  return RECEIVER_ALIGN_ORDER.filter((id) => groups.has(id)).map((id) => ({
    id,
    label: RECEIVER_ALIGN_LABEL[id],
    locations: groups.get(id) || [],
  }));
}

export interface BackfieldStructure {
  hudlBackfield: string;
  /** Personnel groups it fits. Set from how many backs it has (2 backs = 20 / 21 / 22). */
  allowedPersonnel: number[];
  nodes: PlayNode[];
  /** One of the everyday backfields, shown as a button; the rest are under "More backfields". */
  common?: boolean;
  /** The same spots as another backfield: kept so plays saved with it still open, not offered. */
  hidden?: boolean;
  /** This back is a wingback: he lines up just outside the strong-side end, wherever the end is. */
  wing?: string;
}

export const BACKFIELD_STRUCTURES: Record<string, BackfieldStructure> = {
  I_FORM: {
    hudlBackfield: 'I-Form',
    common: true,
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: 0, y: -8.2 },
    ],
  },
  WISHBONE: {
    hudlBackfield: 'Wishbone',
    common: true,
    allowedPersonnel: [30, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.6 },
      { role: '3', x: -4.8, y: -7.8 },
      { role: '4', x: 4.8, y: -7.8 },
    ],
  },
  DOUBLE_WING: {
    hudlBackfield: 'Double Wing',
    common: true,
    allowedPersonnel: [32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.2 },
      { role: '3', x: -9.2, y: -1.8 },
      { role: '4', x: 9.2, y: -1.8 },
    ],
  },
  SPLIT_BACKS: {
    hudlBackfield: 'Split',
    common: true,
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -3.2, y: -5.4 },
      { role: '3', x: 3.2, y: -5.4 },
    ],
  },
  WING_T: {
    hudlBackfield: 'Wing-T',
    common: true,
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: 5.2, y: -5.4 },
    ],
  },
  GUN_OFFSET: {
    hudlBackfield: 'Gun',
    common: true,
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '3', x: 3.2, y: -5.0 },
    ],
  },
  PISTOL: {
    hudlBackfield: 'Pistol',
    common: true,
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -4.8 },
      { role: '3', x: 0, y: -7.8 },
    ],
  },
  UNDER_SINGLE: {
    hudlBackfield: 'Under',
    common: true,
    allowedPersonnel: [10, 11, 12, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: 0, y: -5.4 },
    ],
  },
  I_OFFSET_R: {
    hudlBackfield: 'Strong I',
    common: true,
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 2.4, y: -5.2 },
      { role: '3', x: 0, y: -8.0 },
    ],
  },
  I_OFFSET_L: {
    hudlBackfield: 'Weak I',
    common: true,
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -2.4, y: -5.2 },
      { role: '3', x: 0, y: -8.0 },
    ],
  },
  MARYLAND_I: {
    hudlBackfield: 'Maryland I',
    allowedPersonnel: [30, 31, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.0 },
      { role: '4', x: 0, y: -7.4 },
      { role: '3', x: 0, y: -9.8 },
    ],
  },
  WEAK_I: {
    hudlBackfield: 'I Far',
    hidden: true,
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: -2.4, y: -8.0 },
    ],
  },
  GUN_LEFT: {
    hudlBackfield: 'Gun Weak',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '3', x: -3.2, y: -5.0 },
    ],
  },
  GUN_NEAR: {
    hudlBackfield: 'Gun Near',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '3', x: 2.6, y: -6.8 },
    ],
  },
  GUN_TWINS: {
    hudlBackfield: 'Gun Twins',
    allowedPersonnel: [20, 21],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '2', x: -3.4, y: -5.0 },
      { role: '3', x: 3.4, y: -5.0 },
    ],
  },
  PISTOL_OFFSET: {
    hudlBackfield: 'Pistol Offset',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -4.8 },
      { role: '3', x: 2.8, y: -7.2 },
    ],
  },
  UNDER_SPLIT: {
    hudlBackfield: 'Under Split',
    hidden: true,
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -3.2, y: -5.4 },
      { role: '3', x: 3.2, y: -5.4 },
    ],
  },
  QUEEN: {
    hudlBackfield: 'Queen',
    hidden: true,
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: 3.0, y: -5.4 },
    ],
  },
  KING: {
    hudlBackfield: 'King',
    hidden: true,
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: -3.0, y: -5.4 },
    ],
  },
  T_FORM: {
    hudlBackfield: 'T',
    common: true,
    allowedPersonnel: [30, 31, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.6 },
      { role: '3', x: -5.2, y: -5.6 },
      { role: '4', x: 5.2, y: -5.6 },
    ],
  },
  POWER_I: {
    hudlBackfield: 'Power I',
    common: true,
    allowedPersonnel: [30, 31, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '4', x: 2.8, y: -5.6 },
      { role: '3', x: 0, y: -8.2 },
    ],
  },
  FULLHOUSE: {
    hudlBackfield: 'Fullhouse',
    common: true,
    allowedPersonnel: [30, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.6 },
      { role: '3', x: -3.2, y: -5.6 },
      { role: '4', x: 3.2, y: -5.6 },
    ],
  },
  SINGLE_WING: {
    hudlBackfield: 'Single Wing',
    allowedPersonnel: [30, 32],
    nodes: [
      { role: '2', x: -2.6, y: -4.6 },
      { role: '1', x: 2.8, y: -3.0 },
      { role: '3', x: 0.8, y: -6.6 },
      { role: '4', x: 9.2, y: -1.8 },
    ],
  },
  WILDCAT: {
    hudlBackfield: 'Wildcat',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '3', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '1', x: -18, y: -1.2 },
    ],
  },
  I_NEAR: {
    hudlBackfield: 'I Near',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: 2.2, y: -8.0 },
    ],
  },
  I_FAR: {
    hudlBackfield: 'I Far',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: -2.2, y: -8.0 },
    ],
  },
  BROWN: {
    hudlBackfield: 'Brown',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 2.8, y: -4.8 },
      { role: '3', x: -2.2, y: -7.4 },
    ],
  },
  BLUE: {
    hudlBackfield: 'Blue',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -2.8, y: -4.8 },
      { role: '3', x: 2.2, y: -7.4 },
    ],
  },
  WING_T_L: {
    hudlBackfield: 'Wing-T Weak',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: -5.2, y: -5.4 },
    ],
  },
  TACO: {
    hudlBackfield: 'Taco',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 3.4, y: -4.4 },
      { role: '3', x: 0, y: -7.4 },
    ],
  },
  GUN_I: {
    hudlBackfield: 'Gun I',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '2', x: 0, y: -7.8 },
      { role: '3', x: 0, y: -10.6 },
    ],
  },
  PISTOL_I: {
    hudlBackfield: 'Pistol I',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -4.8 },
      { role: '2', x: 0, y: -7.6 },
      { role: '3', x: 0, y: -10.4 },
    ],
  },
  GUN_SPLIT: {
    hudlBackfield: 'Gun Split',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '2', x: -3.2, y: -5.0 },
      { role: '3', x: 3.2, y: -5.0 },
    ],
  },
  RIP_BACK: {
    hudlBackfield: 'Rip',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 2.8, y: -4.8 },
      { role: '3', x: 1.4, y: -7.4 },
    ],
  },
  LIZ_BACK: {
    hudlBackfield: 'Liz',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -2.8, y: -4.8 },
      { role: '3', x: -1.4, y: -7.4 },
    ],
  },
  GUN_FAR: {
    hudlBackfield: 'Gun Far',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '3', x: 4.0, y: -5.0 },
    ],
  },
  GUN_SWING: {
    hudlBackfield: 'Gun Swing',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '3', x: -4.8, y: -3.6 },
    ],
  },
  PISTOL_WEAK: {
    hudlBackfield: 'Pistol Weak',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -4.8 },
      { role: '3', x: -2.8, y: -7.2 },
    ],
  },
  ACE_STRONG: {
    hudlBackfield: 'Ace Strong',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: 3.0, y: -5.4 },
    ],
  },
  ACE_WEAK: {
    hudlBackfield: 'Ace Weak',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: -3.0, y: -5.4 },
    ],
  },
  UNDER_STRONG: {
    hudlBackfield: 'Under Strong',
    hidden: true,
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: 2.8, y: -5.4 },
    ],
  },
  WING_PAIR: {
    hudlBackfield: 'Wing pair',
    allowedPersonnel: [12, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: 0, y: -6.2 },
    ],
  },
  DIAMOND: {
    hudlBackfield: 'Diamond',
    allowedPersonnel: [30, 31, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.2 },
      { role: '3', x: -3.6, y: -7.6 },
      { role: '4', x: 3.6, y: -7.6 },
    ],
  },
  BOX: {
    hudlBackfield: 'Box',
    allowedPersonnel: [30, 31, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -2.8, y: -5.2 },
      { role: '3', x: 2.8, y: -5.2 },
      { role: '4', x: 0, y: -7.8 },
    ],
  },
  T_WEAK: {
    hudlBackfield: 'T Weak',
    allowedPersonnel: [30, 31, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.6 },
      { role: '3', x: -4.6, y: -5.6 },
      { role: '4', x: 3.2, y: -7.6 },
    ],
  },
  BEAST: {
    hudlBackfield: 'Beast',
    common: true,
    allowedPersonnel: [30, 31, 32],
    wing: '4',
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: 0, y: -8.2 },
      { role: '4', x: 8.4, y: -1.15 },
    ],
  },
  // Wing-T with three backs (30 / 31 / 32): FB behind the QB, the halfback offset weak, a wingback outside the strong end.
  WING_T_3: {
    hudlBackfield: 'Wing-T',
    common: true,
    allowedPersonnel: [30, 31, 32],
    wing: '4',
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: -4.2, y: -5.4 },
      { role: '4', x: 8.4, y: -1.15 },
    ],
  },
  WISHBONE_OFFSET: {
    hudlBackfield: 'Wishbone Offset',
    allowedPersonnel: [30, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 2.0, y: -4.8 },
      { role: '3', x: -3.8, y: -7.0 },
      { role: '4', x: 3.8, y: -7.0 },
    ],
  },
};

// A backfield fits the personnel groups with its number of backs (QB not counted): 3 backs = 30 / 31 / 32.
for (const b of Object.values(BACKFIELD_STRUCTURES)) {
  const backs = b.nodes.filter((n) => n.role !== '1').length;
  b.allowedPersonnel = [backs * 10, backs * 10 + 1, backs * 10 + 2];
}

export const INTERIOR_LINE_NODES: PlayNode[] = [
  { role: 'C', x: 0, y: 0, line: true },
  { role: 'LG', x: -2, y: 0, line: true },
  { role: 'RG', x: 2, y: 0, line: true },
  { role: 'LT', x: -4, y: 0, line: true },
  { role: 'RT', x: 4, y: 0, line: true },
];

export interface PlayConcept {
  concept: string;
  hole: number | null;
  scheme: string;
  primaryBack: number;
  fake?: string;
  lead?: string;
  primaryTarget?: string;
}

export const PLAY_CONCEPTS: Record<string, PlayConcept> = {
  '24_DIVE': { concept: '24 Dive', hole: 4, scheme: 'Gap-On-Down', primaryBack: 2, fake: 'Fake 31 Toss' },
  '26_DIVE': { concept: '26 Dive', hole: 6, scheme: 'Gap-On-Down', primaryBack: 2, fake: 'Fake 39 Toss' },
  '34_DIVE': { concept: '34 Dive', hole: 4, scheme: 'Gap-On-Down', primaryBack: 3, fake: 'None' },
  '32_POWER': { concept: '32 Power', hole: 2, scheme: 'Power (BSG Wrap Pull)', primaryBack: 3, lead: 'FB J-Block Kickout' },
  '38_POWER': { concept: '38 Power', hole: 8, scheme: 'Power (BSG Wrap Pull)', primaryBack: 3, lead: 'FB J-Block Kickout' },
  '12_POWER': { concept: '12 Power', hole: 2, scheme: 'Power (BSG Wrap Pull)', primaryBack: 1, lead: 'FB Lead' },
  '38_COUNTER': { concept: '38 Counter', hole: 8, scheme: 'Counter (BSG Pull Kickout)', primaryBack: 3, fake: 'Fake Dive 2-Hole' },
  '32_COUNTER': { concept: '32 Counter', hole: 2, scheme: 'Counter (BSG Pull Kickout)', primaryBack: 3, fake: 'Fake Dive 8-Hole' },
  '48_COUNTER': { concept: '48 Counter', hole: 8, scheme: 'Counter (BSG Pull Kickout)', primaryBack: 4, fake: 'Fake 31 Toss' },
  '33_ZONE': { concept: '33 Zone', hole: 3, scheme: 'Playside Double-Backer', primaryBack: 3, lead: 'FB Lead Hole' },
  '37_ZONE': { concept: '37 Zone', hole: 7, scheme: 'Playside Double-Backer', primaryBack: 3, lead: 'FB Lead Hole' },
  '47_ZONE': { concept: '47 Zone', hole: 7, scheme: 'Playside Double-Backer', primaryBack: 4, lead: 'TB Lead Hole' },
  '31_TOSS': { concept: '31 Toss Sweep', hole: 1, scheme: 'On-Playside-Backer', primaryBack: 3, lead: 'FB Edge Hook' },
  '39_TOSS': { concept: '39 Toss Sweep', hole: 9, scheme: 'On-Playside-Backer', primaryBack: 3, lead: 'FB Edge Hook' },
  '49_TOSS': { concept: '49 Toss Sweep', hole: 9, scheme: 'On-Playside-Backer', primaryBack: 4, lead: 'TB Edge Hook' },
  '22_DOWN': { concept: '22 Down', hole: 2, scheme: 'Down (PSG Pull Kickout)', primaryBack: 2, fake: 'Fake Sweep Option' },
  '28_DOWN': { concept: '28 Down', hole: 8, scheme: 'Down (PSG Pull Kickout)', primaryBack: 2, fake: 'Fake Sweep Option' },
  '11_KEEP': { concept: '11 Keep', hole: 1, scheme: 'Edge Lead', primaryBack: 1, lead: '2 & 3 Lead Edge' },
  '32_POWER_PASS': { concept: '32 Power Pass', hole: null, scheme: 'Power Slide Pass-Pro', primaryBack: 1, primaryTarget: 'Y Corner' },
  '19_BOOT': { concept: '19 Boot', hole: 9, scheme: 'Naked Boot Slide', primaryBack: 1, primaryTarget: 'Y Drag / X Corner' },
  '19_WAGGLE': { concept: '19 Waggle', hole: 9, scheme: 'Guard Pull Waggle', primaryBack: 1, primaryTarget: 'Crossers' },
  BUBBLE_SCREEN: { concept: 'Bubble Screen', hole: null, scheme: 'Perimeter Quick', primaryBack: 1, primaryTarget: 'Z Slot' },
  SMOKE_SCREEN: { concept: 'Smoke Screen', hole: null, scheme: 'Perimeter Quick', primaryBack: 1, primaryTarget: 'X Receiver' },
  MESH_CROSS: { concept: '2-Across Mesh', hole: null, scheme: 'Turnstile Pass-Pro', primaryBack: 1, primaryTarget: 'Mesh Pick' },
  CHECK_15_SNEAK: { concept: 'Freeze Check 15', hole: 5, scheme: 'Center Wedge', primaryBack: 1, lead: 'Plunge' },
  '21_SPEED_OPT': { concept: '21 Speed Option', hole: 1, scheme: 'Read DE, keep or pitch', primaryBack: 3, lead: 'QB / pitch to 3' },
  '29_SPEED_OPT': { concept: '29 Speed Option', hole: 9, scheme: 'Read DE, keep or pitch', primaryBack: 3, lead: 'QB / pitch to 3' },
  '21_LOAD_OPT': { concept: '21 Load Option', hole: 1, scheme: 'FB load the DE, pitch the alley', primaryBack: 2, lead: 'FB load' },
  '29_LOAD_OPT': { concept: '29 Load Option', hole: 9, scheme: 'FB load the DE, pitch the alley', primaryBack: 2, lead: 'FB load' },
  '23_VEER': { concept: '23 Veer', hole: 3, scheme: 'Inside veer, read 3-tech', primaryBack: 3, fake: 'Give or keep' },
  '27_VEER': { concept: '27 Veer', hole: 7, scheme: 'Inside veer, read 3-tech', primaryBack: 3, fake: 'Give or keep' },
  TWINS_OPTION: { concept: 'Twins Speed Option', hole: 1, scheme: 'Twins crack, QB-pitch along the edge', primaryBack: 3, lead: 'Pitch to 3' },
  TWINS_LOAD: { concept: 'Twins Load Option', hole: 1, scheme: 'Twins crack, FB loads DE', primaryBack: 2, lead: 'FB load' },
  BEAST_POWER: { concept: 'Beast Power', hole: 2, scheme: 'Unbalanced extra-hat power', primaryBack: 3, lead: 'FB kickout' },
  BEAST_SWEEP: { concept: 'Beast Sweep', hole: 1, scheme: 'Unbalanced toss/sweep to the beast side', primaryBack: 3, lead: 'FB edge' },
  BEAST_DOWN: { concept: 'Beast Down', hole: 2, scheme: 'Down block, PSG kickout', primaryBack: 2, fake: 'Fake sweep' },
  '34_ISO': { concept: '34 Iso', hole: 4, scheme: 'Lead iso, FB on LB', primaryBack: 3, lead: 'FB kick the LB' },
  '36_ISO': { concept: '36 Iso', hole: 6, scheme: 'Lead iso, FB on LB', primaryBack: 3, lead: 'FB kick the LB' },
  '32_TRAP': { concept: '32 Trap', hole: 2, scheme: 'BSG trap the 3-tech', primaryBack: 3, fake: 'None' },
  '38_TRAP': { concept: '38 Trap', hole: 8, scheme: 'BSG trap the 3-tech', primaryBack: 3, fake: 'None' },
  '25_DRAW': { concept: '25 Draw', hole: 5, scheme: 'Show pass, give late', primaryBack: 2 },
  '21_STRETCH': { concept: '21 Stretch', hole: 1, scheme: 'Outside zone stretch', primaryBack: 3, lead: 'Reach the edge' },
  '29_STRETCH': { concept: '29 Stretch', hole: 9, scheme: 'Outside zone stretch', primaryBack: 3, lead: 'Reach the edge' },
  QB_DRAW: { concept: 'QB Draw', hole: 5, scheme: 'QB delay up A-gap', primaryBack: 1 },
  FOUR_VERTS: { concept: '4 Verts', hole: null, scheme: 'Verticals, check smash', primaryBack: 1, primaryTarget: 'Inside vert' },
  SMASH: { concept: 'Smash', hole: null, scheme: 'Corner / hitch', primaryBack: 1, primaryTarget: 'Corner' },
  STICK: { concept: 'Stick', hole: null, scheme: 'Stick / out / sit', primaryBack: 1, primaryTarget: 'Stick' },
  FLOOD: { concept: 'Flood', hole: null, scheme: '3-level flood', primaryBack: 1, primaryTarget: 'Deep over' },
  RPO_SLANT: { concept: 'RPO Slant', hole: 4, scheme: 'Give or throw slant', primaryBack: 3, primaryTarget: 'Slant' },
  TUNNEL: { concept: 'Tunnel Screen', hole: null, scheme: 'Interior screen', primaryBack: 1, primaryTarget: 'X / Z' },
  SPRINT_OUT: { concept: 'Sprint Out', hole: 1, scheme: 'QB sprint, flood backside', primaryBack: 1, primaryTarget: 'Flat / corner' },
  // Buck Sweep
  '31_BUCK': { concept: '31 Buck Sweep', hole: 1, scheme: 'Buck Sweep (Both Guards Pull)', primaryBack: 3, fake: 'FB Dive 4-Hole', lead: 'PSG Kick / BSG Wrap' },
  '39_BUCK': { concept: '39 Buck Sweep', hole: 9, scheme: 'Buck Sweep (Both Guards Pull)', primaryBack: 3, fake: 'FB Dive 6-Hole', lead: 'PSG Kick / BSG Wrap' },
  '41_BUCK': { concept: '41 Buck Sweep', hole: 1, scheme: 'Buck Sweep (Both Guards Pull)', primaryBack: 4, fake: 'FB Dive 4-Hole', lead: 'PSG Kick / BSG Wrap' },
  '49_BUCK': { concept: '49 Buck Sweep', hole: 9, scheme: 'Buck Sweep (Both Guards Pull)', primaryBack: 4, fake: 'FB Dive 6-Hole', lead: 'PSG Kick / BSG Wrap' },

  // Belly
  '24_BELLY': { concept: '24 Belly', hole: 4, scheme: 'Belly (Down Block / FB B-Gap)', primaryBack: 2, fake: 'QB Boot Fake' },
  '26_BELLY': { concept: '26 Belly', hole: 6, scheme: 'Belly (Down Block / FB B-Gap)', primaryBack: 2, fake: 'QB Boot Fake' },
  '34_BELLY': { concept: '34 Belly', hole: 4, scheme: 'Belly (Down Block / TB B-Gap)', primaryBack: 3, fake: 'QB Boot Fake' },
  '36_BELLY': { concept: '36 Belly', hole: 6, scheme: 'Belly (Down Block / TB B-Gap)', primaryBack: 3, fake: 'QB Boot Fake' },

  // Belly G / Down G
  '22_BELLY_G': { concept: '22 Belly G', hole: 2, scheme: 'Belly G (PSG Pull Kickout)', primaryBack: 2, lead: 'PSG Kickout' },
  '28_BELLY_G': { concept: '28 Belly G', hole: 8, scheme: 'Belly G (PSG Pull Kickout)', primaryBack: 2, lead: 'PSG Kickout' },
  '32_BELLY_G': { concept: '32 Belly G', hole: 2, scheme: 'Belly G (PSG Pull Kickout)', primaryBack: 3, lead: 'PSG Kickout' },
  '38_BELLY_G': { concept: '38 Belly G', hole: 8, scheme: 'Belly G (PSG Pull Kickout)', primaryBack: 3, lead: 'PSG Kickout' },

  // Inside Zone
  '34_INSIDE_ZONE': { concept: '34 Inside Zone', hole: 4, scheme: 'Inside Zone Combo-Climb', primaryBack: 3, lead: 'FB Cutback Seal' },
  '36_INSIDE_ZONE': { concept: '36 Inside Zone', hole: 6, scheme: 'Inside Zone Combo-Climb', primaryBack: 3, lead: 'FB Cutback Seal' },
  '33_INSIDE_ZONE': { concept: '33 Inside Zone', hole: 3, scheme: 'Inside Zone Combo-Climb', primaryBack: 3, lead: 'FB Cutback Seal' },
  '37_INSIDE_ZONE': { concept: '37 Inside Zone', hole: 7, scheme: 'Inside Zone Combo-Climb', primaryBack: 3, lead: 'FB Cutback Seal' },

  // Outside Zone / Stretch
  '31_OUTSIDE_ZONE': { concept: '31 Outside Zone', hole: 1, scheme: 'Outside Zone Lateral Reach', primaryBack: 3, lead: 'FB Edge Hook' },
  '39_OUTSIDE_ZONE': { concept: '39 Outside Zone', hole: 9, scheme: 'Outside Zone Lateral Reach', primaryBack: 3, lead: 'FB Edge Hook' },
  '41_OUTSIDE_ZONE': { concept: '41 Outside Zone', hole: 1, scheme: 'Outside Zone Lateral Reach', primaryBack: 4, lead: 'TB Edge Hook' },
  '49_OUTSIDE_ZONE': { concept: '49 Outside Zone', hole: 9, scheme: 'Outside Zone Lateral Reach', primaryBack: 4, lead: 'TB Edge Hook' },

  // Duo
  '34_DUO': { concept: '34 Duo', hole: 4, scheme: 'Duo Double-Teams (Power No-Pull)', primaryBack: 3, lead: 'FB Insert on LB' },
  '36_DUO': { concept: '36 Duo', hole: 6, scheme: 'Duo Double-Teams (Power No-Pull)', primaryBack: 3, lead: 'FB Insert on LB' },

  // Pin & Pull
  '32_PIN_PULL': { concept: '32 Pin & Pull', hole: 2, scheme: 'Pin & Pull (Uncovered Pull)', primaryBack: 3, lead: 'Puller Lead Alley' },
  '38_PIN_PULL': { concept: '38 Pin & Pull', hole: 8, scheme: 'Pin & Pull (Uncovered Pull)', primaryBack: 3, lead: 'Puller Lead Alley' },
  '31_PIN_PULL': { concept: '31 Pin & Pull', hole: 1, scheme: 'Pin & Pull (Edge Sweep)', primaryBack: 3, lead: 'Puller Lead Edge' },
  '39_PIN_PULL': { concept: '39 Pin & Pull', hole: 9, scheme: 'Pin & Pull (Edge Sweep)', primaryBack: 3, lead: 'Puller Lead Edge' },

  // Jet Sweep
  '41_JET': { concept: '41 Jet Sweep', hole: 1, scheme: 'Full Sprint Motion Sweep', primaryBack: 4, lead: 'Perimeter Reach' },
  '49_JET': { concept: '49 Jet Sweep', hole: 9, scheme: 'Full Sprint Motion Sweep', primaryBack: 4, lead: 'Perimeter Reach' },

  // Reverse
  '28_REVERSE': { concept: '28 Reverse', hole: 8, scheme: 'Counter Flow End-Around Hand', primaryBack: 4, fake: 'Dive / Sweep Fake' },
  '22_REVERSE': { concept: '22 Reverse', hole: 2, scheme: 'Counter Flow End-Around Hand', primaryBack: 4, fake: 'Dive / Sweep Fake' },

  // QB Sneak
  QB_SNEAK: { concept: 'QB Sneak', hole: 5, scheme: 'Direct Plunge Behind Center', primaryBack: 1, lead: 'Center-Guard Wedge' },
};

export function conceptFamily(c: PlayConcept): 'run' | 'pass' | 'option' | 'screen' {
  const s = `${c.concept} ${c.scheme}`.toLowerCase();
  if (/screen|bubble|smoke|tunnel/.test(s)) return 'screen';
  if (/option|veer/.test(s)) return 'option';
  if (/pass|boot|waggle|mesh|flood|stick|smash|vert|rpo|sprint/.test(s)) return 'pass';
  return 'run';
}

/** Run fits. The ball carrier and the hole are picked separately. */
export const RUN_SCHEMES: { id: string; label: string; conceptKey: string }[] = [
  { id: 'power', label: 'Power', conceptKey: '38_POWER' },
  { id: 'buck', label: 'Buck Sweep', conceptKey: '31_BUCK' },
  { id: 'trap', label: 'Trap', conceptKey: '32_TRAP' },
  { id: 'belly', label: 'Belly', conceptKey: '24_BELLY' },
  { id: 'belly_g', label: 'Belly G / Down G', conceptKey: '32_BELLY_G' },
  { id: 'counter', label: 'Counter GT', conceptKey: '38_COUNTER' },
  { id: 'inside_zone', label: 'Inside Zone', conceptKey: '34_INSIDE_ZONE' },
  { id: 'outside_zone', label: 'Outside Zone / Stretch', conceptKey: '31_OUTSIDE_ZONE' },
  { id: 'duo', label: 'Duo', conceptKey: '34_DUO' },
  { id: 'pin_pull', label: 'Pin & Pull', conceptKey: '32_PIN_PULL' },
  { id: 'iso', label: 'Iso', conceptKey: '34_ISO' },
  { id: 'dive', label: 'Dive', conceptKey: '34_DIVE' },
  { id: 'down', label: 'Down', conceptKey: '28_DOWN' },
  { id: 'toss', label: 'Toss / Sweep', conceptKey: '31_TOSS' },
  { id: 'jet_sweep', label: 'Jet Sweep', conceptKey: '41_JET' },
  { id: 'reverse', label: 'Reverse', conceptKey: '28_REVERSE' },
  { id: 'draw', label: 'Draw', conceptKey: '25_DRAW' },
  { id: 'wedge', label: 'Wedge', conceptKey: 'CHECK_15_SNEAK' },
  { id: 'qb_sneak', label: 'QB Sneak', conceptKey: 'QB_SNEAK' },
  { id: 'keep', label: 'QB Keep / Option', conceptKey: '11_KEEP' },
  // Backward compatibility aliases
  { id: 'zone', label: 'Zone', conceptKey: '34_INSIDE_ZONE' },
  { id: 'stretch', label: 'Stretch', conceptKey: '31_OUTSIDE_ZONE' },
];

const ELIGIBLE_ORDER = ['1', '2', '3', '4', 'Y', 'Y1', 'Y2', 'X', 'Z', 'W', 'H', 'W1', 'W2'];

export function eligibleName(role: string) {
  if (role === '1') return 'QB';
  if (role === '2') return 'FB';
  if (role === '3') return 'RB';
  if (role === '4') return 'Wing';
  if (role.startsWith('Y')) return 'TE';
  return 'WR';
}

/** Backs, tight ends, and receivers on this formation. Linemen stay off the list. */
export function eligiblePlayers(nodes: PlayNode[]): PlayNode[] {
  return ELIGIBLE_ORDER.map((role) => nodes.find((n) => n.role === role)).filter((n): n is PlayNode => !!n);
}

export const MASTER_TAGS: Record<string, { type: string; effect: string; axis?: string; xOffsetScale?: number; xOffset?: number; vector?: string }> = {
  Jet: { type: 'Motion', effect: 'Full sprint across formation pre-snap', axis: 'horizontal' },
  Laser: { type: 'Motion', effect: 'Slot aligns/motions inward to tackle box', axis: 'inward' },
  Rocket: { type: 'Motion', effect: 'Deep lateral motion behind tailback depth', axis: 'deep_arc' },
  Orbit: { type: 'Motion', effect: 'Arc motion behind quarterback', axis: 'circular' },
  Zap: { type: 'Motion', effect: 'Wing motions inside to fullback lead spot', axis: 'inward' },
  Fly: { type: 'Motion', effect: 'Receiver flies across at full speed' },
  Ghost: { type: 'Motion', effect: 'Slow fake jet that resets' },
  Zip: { type: 'Motion', effect: 'Short motion to the hip, snap on arrival' },
  Shift: { type: 'Motion', effect: 'Backs/receivers shift before the snap' },
  'Fake Jet': { type: 'Motion', effect: 'Show jet, hand the ball inside' },
  Tight: { type: 'Alignment', effect: 'Compresses receivers inside hash/numbers', xOffsetScale: 0.6 },
  Flex: { type: 'Alignment', effect: 'Detaches tight end 3 yards from tackle', xOffset: 3 },
  Crack: { type: 'Alignment', effect: 'WR angles inward to pin edge/DE on run', vector: 'inside_down' },
  Nasty: { type: 'Alignment', effect: 'Tight end nasty split, inside leverage' },
  Bunch: { type: 'Alignment', effect: 'Three receivers bunched to one side' },
  Stack: { type: 'Alignment', effect: 'Two receivers stacked on one landmark' },
  Reduced: { type: 'Alignment', effect: 'Closed side, reduced split' },
  Wide: { type: 'Alignment', effect: 'Max splits, stretch the secondary' },
  Over: { type: 'Alignment', effect: 'Unbalanced over-shift to strength' },
  Unbalanced: { type: 'Alignment', effect: 'Extra lineman/hat to one side' },
  Beast: { type: 'Alignment', effect: 'Unbalanced extra hat to the strength' },
  Thumper: { type: 'Alignment', effect: 'Two tight ends to the strength side' },
  Boot: { type: 'Action', effect: 'QB naked rollout away from run action' },
  Waggle: { type: 'Action', effect: 'QB rollout protected by pulling guard' },
  Keep: { type: 'Action', effect: 'QB pulls ball from mesh and runs edge' },
  Reverse: { type: 'Action', effect: 'Second handoff to opposite crossing WR' },
  Option: { type: 'Action', effect: 'QB reads DE and keeps or pitches' },
  Naked: { type: 'Action', effect: 'QB boot with no puller' },
  Draw: { type: 'Action', effect: 'Show pass, run late' },
  RPO: { type: 'Action', effect: 'Give or throw off the same mesh' },
  'Play Action': { type: 'Action', effect: 'Fake the run, throw' },
  Freeze: { type: 'Action', effect: 'Hard count / freeze sneak look' },
  Alert: { type: 'Action', effect: 'Check to a tagged throw' },
  Check: { type: 'Action', effect: 'QB can check the play at the line' },
  Bubble: { type: 'Pass', effect: 'Now screen to the slot' },
  Smoke: { type: 'Pass', effect: 'Now screen to the boundary WR' },
  Stick: { type: 'Pass', effect: 'Stick concept, sit in the hole' },
  Snag: { type: 'Pass', effect: 'Snag / corner / flat' },
  Smash: { type: 'Pass', effect: 'Hitch and corner' },
  Flood: { type: 'Pass', effect: 'Three-level flood' },
  Mesh: { type: 'Pass', effect: 'Two shallow crossers pick' },
  Slant: { type: 'Pass', effect: 'Inside breaking slant' },
  Hitch: { type: 'Pass', effect: 'Stop route at 5–6' },
  Fade: { type: 'Pass', effect: 'Fade / go to the pylon' },
  Screen: { type: 'Pass', effect: 'Tagged screen' },
  'Red Zone': { type: 'Situation', effect: 'Inside the 20' },
  Goaline: { type: 'Situation', effect: 'Inside the 5' },
  '2 pt': { type: 'Situation', effect: 'Two-point play' },
  '2 min': { type: 'Situation', effect: 'Two-minute offense' },
  Stretch: { type: 'Action', effect: 'Outside zone stretch' },
  Load: { type: 'Action', effect: 'FB loads the DE on option' },
  Veer: { type: 'Action', effect: 'Inside veer read' },
  Blast: { type: 'Action', effect: 'Lead blast through the hole' },
  Wedge: { type: 'Action', effect: 'Wedge / sneak look' },
  Tempo: { type: 'Situation', effect: 'No-huddle, snap on the clock' },
  '4 min': { type: 'Situation', effect: 'Kill the clock' },
};

export const TAG_GROUPS = ['Motion', 'Alignment', 'Action', 'Pass', 'Situation'] as const;

const SKILL_ROLES = new Set(['X', 'Z', 'Y', 'W', 'H', 'Y1', 'Y2', 'W1', 'W2']);
const TE_ROLES = new Set(['Y', 'Y1', 'Y2']);

function tagged(tags: string[], name: string) {
  return tags.some((t) => t.toLowerCase() === name.toLowerCase());
}

export function applyFormationTags(nodes: PlayNode[], tags: string[], strength: 'Left' | 'Right' = 'Right'): PlayNode[] {
  if (!tags.length) return nodes;
  const side = strength === 'Left' ? -1 : 1;
  const has = (n: string) => tagged(tags, n);
  let next = nodes.map((n) => ({ ...n }));
  const skill = () => next.filter((n) => SKILL_ROLES.has(n.role));

  if (has('Tight')) {
    next = next.map((n) => (SKILL_ROLES.has(n.role) ? { ...n, x: n.x * 0.62 } : n));
  }
  if (has('Wide')) {
    next = next.map((n) => (SKILL_ROLES.has(n.role) ? { ...n, x: n.x * 1.28 } : n));
  }
  if (has('Flex')) {
    next = next.map((n) => {
      if (!TE_ROLES.has(n.role) || n.x === 0) return n;
      return { ...n, x: n.x + Math.sign(n.x) * 3, line: false, y: n.y === 0 ? -0.4 : n.y };
    });
  }
  if (has('Nasty')) {
    const lt = next.find((n) => n.role === 'LT')?.x ?? -4;
    const rt = next.find((n) => n.role === 'RT')?.x ?? 4;
    next = next.map((n) => {
      if (!TE_ROLES.has(n.role) || n.x === 0) return n;
      return { ...n, x: n.x < 0 ? lt - 1.15 : rt + 1.15, y: 0, line: true };
    });
  }
  if (has('Reduced')) {
    next = next.map((n) => {
      if (!SKILL_ROLES.has(n.role)) return n;
      if (Math.sign(n.x) === side) return n;
      return { ...n, x: n.x * 0.55 };
    });
  }
  if (has('Over') || has('Unbalanced') || has('Beast')) {
    next = next.map((n) => (SKILL_ROLES.has(n.role) || n.role === '4' ? { ...n, x: n.x + side * 1.6 } : n));
  }
  if (has('Thumper')) {
    const tackle = next.find((n) => n.role === (side < 0 ? 'LT' : 'RT'));
    const tackleX = tackle?.x ?? side * 4;
    const tes = next.filter((n) => TE_ROLES.has(n.role));
    const pair = tes.slice(0, 2);
    if (pair.length >= 2) {
      const inside = pair[0].role;
      const outside = pair[1].role;
      next = next.map((n) => {
        if (n.role === inside) return { ...n, x: tackleX + side * 1.7, y: 0, line: true };
        if (n.role === outside) return { ...n, x: tackleX + side * 3.4, y: 0, line: true };
        return n;
      });
    }
  }
  if (has('Bunch')) {
    const pack = skill()
      .sort((a, b) => (side > 0 ? b.x - a.x : a.x - b.x))
      .slice(0, 3);
    const ids = new Set(pack.map((p) => p.role));
    const base = side * 8.2;
    let i = 0;
    next = next.map((n) => {
      if (!ids.has(n.role)) return n;
      const slot = i++;
      return { ...n, x: base + side * slot * 1.15, y: slot === 1 ? -0.85 : 0, line: slot !== 1 };
    });
  }
  if (has('Stack')) {
    const pack = skill()
      .sort((a, b) => Math.abs(b.x) - Math.abs(a.x))
      .slice(0, 2);
    if (pack.length === 2) {
      const x = pack[0].x;
      next = next.map((n) => {
        if (n.role === pack[0].role) return { ...n, x, y: 0, line: true };
        if (n.role === pack[1].role) return { ...n, x, y: -1.1, line: false };
        return n;
      });
    }
  }
  if (has('Shift')) {
    next = next.map((n) => (/^[2-4]$/.test(n.role) ? { ...n, x: n.x + side * 1.4 } : n));
  }
  return next;
}

export function resolveTaggedCall(opts: {
  hole: number | null;
  primaryBack: number;
  family: 'run' | 'pass' | 'option' | 'screen';
  tags: string[];
  hasBack?: (n: number) => boolean;
}): { hole: number | null; primaryBack: number; family: 'run' | 'pass' | 'option' | 'screen' } {
  const has = (n: string) => tagged(opts.tags, n);
  let { hole, primaryBack, family } = opts;

  if (has('Keep')) primaryBack = 1;
  if (has('Wedge') || has('Freeze')) {
    hole = 5;
    primaryBack = 1;
  }
  if (has('Stretch')) {
    hole = hole != null && hole < 5 ? 1 : 9;
  }
  if (has('Draw')) {
    if (hole == null) hole = 5;
    family = 'run';
  }
  if (has('Option') || has('Load') || has('Veer')) family = 'option';
  if (has('Boot') || has('Naked') || has('Waggle') || has('Play Action')) family = 'pass';
  if (has('RPO')) family = 'pass';
  if (has('Bubble') || has('Smoke') || has('Screen')) family = 'screen';
  if (has('Stick') || has('Snag') || has('Smash') || has('Flood') || has('Mesh') || has('Slant') || has('Hitch') || has('Fade')) {
    family = 'pass';
  }
  if ((has('Keep') || has('Reverse') || has('Blast') || has('Wedge')) && family !== 'pass' && family !== 'option') family = 'run';
  return { hole, primaryBack, family };
}

export function isDefenseRole(role: string) {
  return /^(DE|DT|NT|SAM|WILL|MIKE|ROV|CB|FS|SS|OLB|ILB|E\d|T\d)/i.test(role);
}

function nodes44(shift = 0): PlayNode[] {
  return [
    { role: 'E9', x: -6.8 + shift, y: 1.9 },
    { role: 'T3', x: -2.35 + shift * 0.25, y: 1.9 },
    { role: 'T1', x: 2.25, y: 1.9 },
    { role: 'E5', x: 6.7, y: 1.9 },
    { role: 'SAM', x: -11.2, y: 3.7 },
    { role: 'ROV', x: -8.1, y: 3.7 },
    { role: 'MIKE', x: -1.2 + shift, y: 4.15 },
    { role: 'WILL', x: 5.3, y: 4.05 },
    { role: 'CBL', x: -14.4, y: 4.25 },
    { role: 'FS', x: 1.5, y: 8.9 },
    { role: 'CBR', x: 14.4, y: 4.25 },
  ];
}

function nodes53(shift = 0): PlayNode[] {
  return [
    { role: 'E9', x: -7.4, y: 1.35 },
    { role: 'T3', x: -3.6, y: 1.35 },
    { role: 'NT', x: 0, y: 1.35 },
    { role: 'T1', x: 3.6, y: 1.35 },
    { role: 'E5', x: 7.4, y: 1.35 },
    { role: 'WILL', x: -5.2 + shift, y: 3.1 },
    { role: 'MIKE', x: shift, y: 3.1 },
    { role: 'SAM', x: 5.2 + shift, y: 3.1 },
    { role: 'CBL', x: -14, y: 3.4 },
    { role: 'FS', x: shift, y: 8.2 },
    { role: 'CBR', x: 14, y: 3.4 },
  ];
}

/** 6-2: six on the line (ends, tackles, guards), two linebackers, three deep. */
function nodes62(): PlayNode[] {
  return [
    { role: 'E9', x: -7.4, y: 1.35 },
    { role: 'T5', x: -4.4, y: 1.35 },
    { role: 'T1', x: -1.1, y: 1.35 },
    { role: 'DT1', x: 1.1, y: 1.35 },
    { role: 'DT5', x: 4.4, y: 1.35 },
    { role: 'DE9', x: 7.4, y: 1.35 },
    { role: 'MIKE', x: -2.2, y: 4 },
    { role: 'WILL', x: 2.2, y: 4 },
    { role: 'CBL', x: -13.5, y: 5 },
    { role: 'FS', x: 0, y: 9 },
    { role: 'CBR', x: 13.5, y: 5 },
  ];
}

/** 4-3: four down (5 and 3 techniques), three linebackers, four defensive backs. */
function nodes43(): PlayNode[] {
  return [
    { role: 'DE5', x: -5, y: 1.35 },
    { role: 'T3', x: -2.6, y: 1.35 },
    { role: 'T1', x: 1, y: 1.35 },
    { role: 'E5', x: 5, y: 1.35 },
    { role: 'SAM', x: -4.6, y: 4.6 },
    { role: 'MIKE', x: 0, y: 4.8 },
    { role: 'WILL', x: 4.6, y: 4.6 },
    { role: 'CBL', x: -14, y: 5 },
    { role: 'FS', x: -4, y: 10 },
    { role: 'SS', x: 4, y: 9 },
    { role: 'CBR', x: 14, y: 5 },
  ];
}

/** 5-2: five down (nose head-up), two linebackers, four defensive backs. */
function nodes52(): PlayNode[] {
  return [
    { role: 'DE5', x: -5.2, y: 1.35 },
    { role: 'T4', x: -3, y: 1.35 },
    { role: 'NT', x: 0, y: 1.35 },
    { role: 'DT4', x: 3, y: 1.35 },
    { role: 'E5', x: 5.2, y: 1.35 },
    { role: 'MIKE', x: -2.4, y: 4.2 },
    { role: 'WILL', x: 2.4, y: 4.2 },
    { role: 'CBL', x: -14, y: 5 },
    { role: 'FS', x: -4, y: 10 },
    { role: 'SS', x: 4, y: 9 },
    { role: 'CBR', x: 14, y: 5 },
  ];
}

/** 3-5-3 (3-3 stack): three down, three stacked linebackers and two outside, three deep. */
function nodes353(): PlayNode[] {
  return [
    { role: 'DE5', x: -4.8, y: 1.35 },
    { role: 'NT', x: 0, y: 1.35 },
    { role: 'E5', x: 4.8, y: 1.35 },
    { role: 'OLBL', x: -9, y: 3.6 },
    { role: 'WILL', x: -4.8, y: 4.4 },
    { role: 'MIKE', x: 0, y: 4.4 },
    { role: 'SAM', x: 4.8, y: 4.4 },
    { role: 'OLBR', x: 9, y: 3.6 },
    { role: 'CBL', x: -14, y: 5.5 },
    { role: 'FS', x: 0, y: 10 },
    { role: 'CBR', x: 14, y: 5.5 },
  ];
}

/**
 * Automatically lines up defensive players based on their technique label (e.g. E9, T3, T1, E5, NT0, E7, T2).
 * Adjusts dynamically based on the offensive line and tight end positions.
 */
export function alignDefenseTechniques(defenseNodes: PlayNode[], offenseNodes: PlayNode[]): PlayNode[] {
  if (!defenseNodes.length || !offenseNodes.length) return defenseNodes;

  const C = offenseNodes.find((n) => n.role === 'C')?.x ?? 0;
  const LG = offenseNodes.find((n) => n.role === 'LG')?.x ?? C - 2;
  const RG = offenseNodes.find((n) => n.role === 'RG')?.x ?? C + 2;
  const ltRaw = offenseNodes.find((n) => n.role === 'LT')?.x ?? C - 4;
  const rtRaw = offenseNodes.find((n) => n.role === 'RT')?.x ?? C + 4;
  const LT = ltRaw < C ? ltRaw : LG - 2;
  const RT = rtRaw > C ? rtRaw : RG + 2;

  // Find tight ends on each side
  const tightEnds = offenseNodes.filter((n) => n.line && ['Y', 'Y1', 'Y2'].includes(n.role));
  const leftTEs = tightEnds.filter((n) => n.x < C).sort((a, b) => b.x - a.x); // closest to farthest left
  const rightTEs = tightEnds.filter((n) => n.x > C).sort((a, b) => a.x - b.x); // closest to farthest right

  const outermostRightTE = rightTEs.length ? rightTEs[rightTEs.length - 1].x : RT + 2;
  const primaryRightTE = rightTEs.length ? rightTEs[0].x : RT + 2;

  const outermostLeftTE = leftTEs.length ? leftTEs[leftTEs.length - 1].x : LT - 2;
  const primaryLeftTE = leftTEs.length ? leftTEs[0].x : LT - 2;

  return defenseNodes.map((dNode) => {
    const roleUpper = dNode.role.toUpperCase();
    const side = dNode.x < C ? -1 : 1;
    const match = roleUpper.match(/^(?:D[ET]|NT|E|T)(\d+i?)$/i);
    let tech = match ? match[1].toLowerCase() : '';
    if (!tech && roleUpper === 'NT') tech = '0';
    if (!tech) return dNode;
    let newX = dNode.x;

    if (tech === '0') {
      newX = C;
    } else if (tech === '1') {
      newX = C + side * 0.9;
    } else if (tech === '2i') {
      newX = (side > 0 ? RG : LG) - side * 0.75;
    } else if (tech === '2') {
      newX = side > 0 ? RG : LG;
    } else if (tech === '3') {
      newX = (side > 0 ? RG : LG) + side * 0.85;
    } else if (tech === '4i') {
      newX = (side > 0 ? RT : LT) - side * 0.8;
    } else if (tech === '4') {
      newX = side > 0 ? RT : LT;
    } else if (tech === '5') {
      newX = (side > 0 ? RT : LT) + side * 0.85;
    } else if (tech === '6') {
      newX = side > 0 ? primaryRightTE : primaryLeftTE;
    } else if (tech === '7') {
      newX = side > 0 ? primaryRightTE - 0.85 : primaryLeftTE + 0.85;
    } else if (tech === '9') {
      newX = side > 0 ? outermostRightTE + 0.9 : outermostLeftTE - 0.9;
    }

    return { ...dNode, x: Number(newX.toFixed(2)), y: dNode.y <= 2.5 ? 1.85 : dNode.y };
  });
}

export interface OurDefenseLook {
  name: string;
  front: string;
  shell: string;
  strength: string;
  notes: string;
  nodes: PlayNode[];
}

export const OUR_DEFENSE_LOOKS: Record<string, OurDefenseLook> = {
  '44_C3_LIZ': { name: '4-4 Cover 3 LIZ', front: '4-4', shell: 'Cover 3', strength: 'Left', notes: 'Base stack, force the edge', nodes: nodes44(-0.6) },
  '44_C3_RIP': { name: '4-4 Cover 3 RIP', front: '4-4', shell: 'Cover 3', strength: 'Right', notes: 'Base stack to the right', nodes: nodes44(0.6) },
  '44_C1': { name: '4-4 Cover 1', front: '4-4', shell: 'Cover 1', strength: 'Even', notes: 'Man under, FS middle', nodes: nodes44(0) },
  '44_BLOW_STING': {
    name: '4-4 Blow Sting LIZ',
    front: '4-4',
    shell: 'Cover 3',
    strength: 'Left',
    notes: 'Sam/Rover fire C-gap, DE pinch',
    nodes: nodes44(-0.6).map((n) => (n.role === 'SAM' || n.role === 'ROV' ? { ...n, y: 1.35 } : n)),
  },
  '44_DOUBLE_DOG': {
    name: '4-4 Double Dog 0',
    front: '4-4',
    shell: 'Cover 0',
    strength: 'Even',
    notes: 'Both ILBs A-gap',
    nodes: nodes44(0).map((n) => (n.role === 'WILL' || n.role === 'MIKE' ? { ...n, y: 1.2 } : n.role === 'FS' ? { ...n, y: 3.2 } : n)),
  },
  '44_PINCH': { name: '4-4 Pinch', front: '4-4', shell: 'Cover 3', strength: 'Even', notes: 'DL crash A/B',     nodes: nodes44(0).map((n) => (/^E|^T/.test(n.role) ? { ...n, x: n.x * 0.7 } : n)) },
  '44_FAN': { name: '4-4 Fan', front: '4-4', shell: 'Cover 3', strength: 'Even', notes: 'DL wide contain', nodes: nodes44(0).map((n) => (/^E|^T/.test(n.role) ? { ...n, x: n.x * 1.15 } : n)) },
  '53_C3': { name: '5-3 Cover 3', front: '5-3', shell: 'Cover 3', strength: 'Even', notes: 'Odd front vs 2 TE', nodes: nodes53(0) },
  '53_OVER': { name: '5-3 Over', front: '5-3', shell: 'Cover 3', strength: 'Left', notes: 'Over-shift to their strength', nodes: nodes53(-0.8) },
  '53_C1': { name: '5-3 Cover 1', front: '5-3', shell: 'Cover 1', strength: 'Even', notes: 'Man under odd front', nodes: nodes53(0) },
  '62': { name: '6-2', front: '6-2', shell: '', strength: 'Even', notes: 'Six on the line, two backers', nodes: nodes62() },
  '43': { name: '4-3', front: '4-3', shell: '', strength: 'Even', notes: 'Four down, three backers', nodes: nodes43() },
  '52': { name: '5-2', front: '5-2', shell: '', strength: 'Even', notes: 'Five down, two backers', nodes: nodes52() },
  '353': { name: '3-5-3', front: '3-5-3', shell: '', strength: 'Even', notes: 'Three down, stacked backers, three deep', nodes: nodes353() },
};

export const DEFENSIVE_FRONTS: Record<
  string,
  {
    front: string;
    shell: string;
    strength: string;
    dl: { role: string; align: string; runResp?: string }[];
    lb: { role: string; depth: number; gap?: string; resp: string }[];
    db: { role: string; depth: number; resp: string }[];
  }
> = {
  '4-4_BASE_STACK_LIZ': {
    front: '4-Man',
    shell: 'Cover 3 Stack',
    strength: 'Left',
    dl: [
      { role: 'E9', align: '9-Tech (Outside TE shoulder)', runResp: 'Contain box downhill' },
      { role: 'T3', align: '3-Tech (Outside Guard shoulder)', runResp: 'Penetrate A/B Gap' },
      { role: 'T1', align: '1-Tech (Shade Center)', runResp: 'A-Gap / Double team' },
      { role: 'E5', align: '5-Tech (Outside Tackle shoulder)', runResp: 'Contain edge' },
    ],
    lb: [
      { role: 'S', depth: 4.5, gap: 'C/D-Gap', resp: 'Hard Edge Force / Curl-Flat' },
      { role: 'W', depth: 4.5, gap: 'A/B-Gap', resp: 'Inside-Out Spill / Hook-Curl' },
      { role: 'M', depth: 4.5, gap: 'A/B-Gap', resp: 'Inside-Out Spill / Hook-Curl' },
      { role: 'R', depth: 4.5, gap: 'C/D-Gap', resp: 'Hard Edge Force / Curl-Flat' },
    ],
    db: [
      { role: 'C_Left', depth: 6, resp: 'Deep 1/3' },
      { role: 'FS', depth: 10, resp: 'Deep Middle 1/3 (Cleaner)' },
      { role: 'C_Right', depth: 6, resp: 'Deep 1/3' },
    ],
  },
  '5-3_OVERSHIFT': {
    front: '5-Man',
    shell: 'Cover 3 Shift',
    strength: 'Left',
    dl: [
      { role: 'E', align: 'Outside TE' },
      { role: 'T', align: '3-Tech Guard' },
      { role: 'N', align: '0-Tech Head-up Center' },
      { role: 'T', align: '3-Tech Guard' },
      { role: 'E', align: 'Outside Tackle' },
    ],
    lb: [
      { role: 'W', depth: 4.5, resp: 'Hook-Curl' },
      { role: 'M', depth: 4.5, resp: 'Inside Lead / Hook-Curl' },
      { role: 'S', depth: 4.5, resp: 'Curl-Flat' },
    ],
    db: [
      { role: 'C_Left', depth: 6, resp: 'Deep 1/3' },
      { role: 'FS', depth: 10, resp: 'Deep Middle 1/3' },
      { role: 'C_Right', depth: 6, resp: 'Deep 1/3' },
    ],
  },
};

export const STUNTS_AND_PRESSURES: Record<string, { target: string; coverage: string }> = {
  BLOW: { target: 'Edge overload blitz', coverage: 'Cover 1 Man' },
  STING: { target: 'Sam/Rover fires C-gap, DE pinches', coverage: 'Cover 3' },
  DOUBLE_DOG_0: { target: 'Both ILBs blitz interior A-gaps', coverage: 'Cover 0 (Zero Safety Help)' },
  PINCH: { target: 'All DL crash inside A & B gaps', coverage: 'Base Shell' },
  FAN: { target: 'DL rushes wide outside containment', coverage: 'Base Shell' },
  DOOM: { target: 'Heavy cross-stunt disrupting gap schemes', coverage: 'Base Shell' },
};

export function validate11Players(playNodes: PlayNode[]) {
  if (!Array.isArray(playNodes)) throw new Error('Play nodes must be an array');
  if (playNodes.length !== 11) {
    throw new Error(`Invalid player count: Formation has ${playNodes.length} players. Exactly 11 required.`);
  }
  const interiorLinemen = playNodes.filter((n) => ['C', 'LG', 'RG', 'LT', 'RT'].includes(n.role)).length;
  if (interiorLinemen !== 5) {
    throw new Error(`Invalid offensive line: Found ${interiorLinemen} interior linemen. Exactly 5 required.`);
  }
  return true;
}

export function mirrorCoordinates(nodes: PlayNode[], strength = 'Right') {
  if (strength !== 'Left') return nodes;
  const flip = new Set(['X', 'Y', 'Z', 'W', 'H', 'Y1', 'Y2', 'W1', 'W2', '1', '2', '3', '4']);
  return nodes.map((node) => {
    if (flip.has(node.role)) return { ...node, x: -node.x };
    if ((node.role === 'LT' && node.x > 0) || (node.role === 'RT' && node.x < 0)) return { ...node, x: -node.x };
    return node;
  });
}

/** Weak tackle slides to the strong side, just inside the tight end. Still 7 on the ball. */
function withTackleOver(nodes: PlayNode[], baseKey: string): PlayNode[] {
  if (!BASE_FORMATIONS[baseKey]?.tackleOver) return nodes;
  return nodes.map((n) => (n.role === 'LT' ? { ...n, x: 6.2 } : n));
}

/** A film's own spots for a backfield, in the strong-to-the-right picture (before strength flips them). */
export type BackfieldSpots = Record<string, { x: number; y: number }>;

const FILM_SKILL_ROLES = new Set(['X', 'Z', 'Y', 'W', 'H', 'Y1', 'Y2', 'W1', 'W2']);

function withBackfieldSpots(nodes: PlayNode[], spots?: BackfieldSpots | null): PlayNode[] {
  if (!spots) return nodes;
  return nodes.map((n) => {
    const spot = spots[n.role];
    if (!spot) return n;
    // A receiver or tight end off the ball is no longer an end man on the line.
    const line = FILM_SKILL_ROLES.has(n.role) ? Math.abs(spot.y) < 0.2 : n.line;
    return { ...n, x: spot.x, y: spot.y, line };
  });
}

/**
 * WR/TE spots were measured on one formation. Another play's tight or wide uses its own formation,
 * plus how far those players were moved from the formation they were saved on.
 */
export function fitBackfieldSpots(
  baseKey: string,
  backfieldKey: string,
  spots?: BackfieldSpots | null,
  spotBaseKey?: string | null
): BackfieldSpots | null | undefined {
  if (!spots || !spotBaseKey || spotBaseKey === baseKey) return spots;
  const saved = combinedNodes(spotBaseKey, backfieldKey);
  const play = combinedNodes(baseKey, backfieldKey);
  if (!saved || !play) return spots;
  const out: BackfieldSpots = { ...spots };
  for (const role of FILM_SKILL_ROLES) {
    if (!spots[role]) continue;
    const from = saved.find((n) => n.role === role);
    const to = play.find((n) => n.role === role);
    if (!from || !to) {
      delete out[role];
      continue;
    }
    out[role] = { x: to.x + (spots[role].x - from.x), y: to.y + (spots[role].y - from.y) };
  }
  return out;
}

/** Take Tight / Wide back off a receiver, so the saved spot is the normal alignment and each play can still pick tight or wide. */
export function neutralSkillX(x: number, role: string, tags: string[]): number {
  if (!FILM_SKILL_ROLES.has(role)) return x;
  let v = x;
  if (tagged(tags, 'Wide')) v /= 1.28;
  if (tagged(tags, 'Tight')) v /= 0.62;
  return v;
}

export function combinedNodes(baseKey: string, backfieldKey: string, spots?: BackfieldSpots | null): PlayNode[] | null {
  const base = BASE_FORMATIONS[baseKey];
  const backfield = BACKFIELD_STRUCTURES[backfieldKey];
  if (!base || !backfield) return null;
  const nodes = withTackleOver([...INTERIOR_LINE_NODES, ...base.perimeterNodes, ...backfield.nodes], baseKey);
  if (!backfield.wing) return withBackfieldSpots(nodes, spots);
  // The wingback sets up a yard off the ball, just outside the last tight player on the strong side.
  // A film's own spots replace that, including the wing, when this film has adjusted the backfield.
  const end = Math.max(...nodes.filter((n) => n.line && n.x > 0 && n.x <= 9.5).map((n) => n.x));
  const winged = nodes.map((n) => (n.role === backfield.wing ? { ...n, x: end + 2.3, y: -1.15 } : n));
  return withBackfieldSpots(winged, spots);
}

/** Two players on the same spot (closer than about a yard). */
export function hasStackedPlayers(nodes: PlayNode[]) {
  return nodes.some((a, i) => nodes.some((b, j) => j > i && Math.hypot(a.x - b.x, a.y - b.y) < 1.3));
}

export function isValidEleven(baseKey: string, backfieldKey: string) {
  const nodes = combinedNodes(baseKey, backfieldKey);
  if (!nodes) return false;
  try {
    validate11Players(nodes);
    return true;
  } catch {
    return false;
  }
}

/** Backfields that make 11 with this formation, with nobody on top of anybody. Copies aren't offered. */
export function compatibleBackfields(baseKey: string) {
  const base = BASE_FORMATIONS[baseKey];
  const keys = Object.keys(BACKFIELD_STRUCTURES).filter(
    (k) => !BACKFIELD_STRUCTURES[k].hidden && isValidEleven(baseKey, k) && !hasStackedPlayers(combinedNodes(baseKey, k) || [])
  );
  if (!base) return keys;
  const preferred = keys.filter((k) => BACKFIELD_STRUCTURES[k].allowedPersonnel.includes(base.personnel));
  const rest = keys.filter((k) => !preferred.includes(k));
  return [...preferred, ...rest];
}

export interface AssembledPlay {
  playName: string;
  hudlExport: { OFF_FORM: string; BACKFIELD: string; OFF_STR: string; PLAY_TYPE: string; TAGS: string };
  nodes: PlayNode[];
  metadata: { personnel: number; targetHole: number | null; holeData: (typeof HOLE_SYSTEM)[number] | null; scheme: string; concept: string };
}

export function assemblePlay(
  baseKey: string,
  backfieldKey: string,
  conceptKey: string,
  strength: 'Left' | 'Right' = 'Right',
  tagKeys: string[] = [],
  spots?: BackfieldSpots | null,
  spotBaseKey?: string | null
): AssembledPlay {
  const base = BASE_FORMATIONS[baseKey];
  const backfield = BACKFIELD_STRUCTURES[backfieldKey];
  const concept = PLAY_CONCEPTS[conceptKey];
  if (!base || !backfield || !concept) {
    throw new Error('Invalid Base, Backfield, or Concept key passed to builder.');
  }
  const nodes = combinedNodes(baseKey, backfieldKey, fitBackfieldSpots(baseKey, backfieldKey, spots, spotBaseKey));
  if (!nodes) throw new Error('Invalid Base, Backfield, or Concept key passed to builder.');
  validate11Players(nodes);
  const dir = strength === 'Left' ? 'L' : 'R';
  return {
    playName: `${base.personnel} ${dir} ${base.hudlBase} ${concept.concept}${tagKeys.length ? ' ' + tagKeys.join(' ') : ''}`,
    hudlExport: {
      OFF_FORM: base.hudlBase,
      BACKFIELD: backfield.hudlBackfield,
      OFF_STR: strength,
      PLAY_TYPE: concept.scheme,
      TAGS: tagKeys.join(', '),
    },
    nodes: applyFormationTags(mirrorCoordinates(nodes, strength), tagKeys, strength),
    metadata: {
      personnel: base.personnel,
      targetHole: concept.hole,
      holeData: concept.hole ? HOLE_SYSTEM[concept.hole] : null,
      scheme: concept.scheme,
      concept: concept.concept,
    },
  };
}

export function tryAssemblePlay(
  baseKey: string,
  backfieldKey: string,
  conceptKey: string,
  strength: 'Left' | 'Right' = 'Right',
  tagKeys: string[] = [],
  spots?: BackfieldSpots | null,
  spotBaseKey?: string | null
): AssembledPlay | null {
  try {
    return assemblePlay(baseKey, backfieldKey, conceptKey, strength, tagKeys, spots, spotBaseKey);
  } catch {
    return null;
  }
}

/** Default gaps when no OL nodes are passed (5 = C, even/odd step left from 6). */
const HOLE_X: Record<number, number> = { 1: 10, 2: 6, 3: 3, 4: 1, 5: 0, 6: -1, 7: -3, 8: -6, 9: -10 };

function nodeX(nodes: PlayNode[], role: string, fallback: number) {
  return nodes.find((n) => n.role === role)?.x ?? fallback;
}

function midX(a: number, b: number) {
  return (a + b) / 2;
}

/**
 * Running holes are fixed to the offensive line, not flipped by strength call:
 * 5 over Center, 6 C-LG, 7 LG-LT, 8 off-tackle left, 9 perimeter left;
 * 4 C-RG, 3 RG-RT, 2 off-tackle right, 1 perimeter right.
 */
export function runningHoleXs(nodes: PlayNode[] = []): Record<number, number> {
  const C = nodeX(nodes, 'C', 0);
  const LG = nodeX(nodes, 'LG', C - 2);
  const RG = nodeX(nodes, 'RG', C + 2);
  const ltRaw = nodeX(nodes, 'LT', C - 4);
  const rtRaw = nodeX(nodes, 'RT', C + 4);
  const LT = ltRaw < C ? ltRaw : LG - 2;
  const RT = rtRaw > C ? rtRaw : RG + 2;
  const tight = nodes.filter((n) => n.line && !['C', 'LG', 'RG', 'LT', 'RT'].includes(n.role) && Math.abs(n.x - C) <= 10);
  const leftTe = tight.filter((n) => n.x < C).sort((a, b) => b.x - a.x)[0];
  const rightTe = tight.filter((n) => n.x > C).sort((a, b) => a.x - b.x)[0];
  const rightOl = nodes.filter((n) => ['RG', 'RT', 'LT'].includes(n.role) && n.x > C).sort((a, b) => a.x - b.x);
  const leftOl = nodes.filter((n) => ['LG', 'LT', 'RT'].includes(n.role) && n.x < C).sort((a, b) => b.x - a.x);
  const outerR = rightOl.length ? rightOl[rightOl.length - 1].x : RT;
  const outerL = leftOl.length ? leftOl[leftOl.length - 1].x : LT;
  return {
    5: C,
    6: midX(C, LG),
    7: midX(LG, LT),
    8: leftTe && leftTe.x < outerL ? midX(outerL, leftTe.x) : outerL - 2,
    9: leftTe && leftTe.x < outerL ? leftTe.x - 4 : outerL - 6,
    4: midX(C, RG),
    3: midX(RG, RT),
    2: rightTe && rightTe.x > outerR ? midX(outerR, rightTe.x) : outerR + 2,
    1: rightTe && rightTe.x > outerR ? rightTe.x + 4 : outerR + 6,
  };
}

export function holeFieldX(hole: number | null, _strength?: string, nodes: PlayNode[] = []) {
  if (hole == null) return null;
  if (nodes.length) return runningHoleXs(nodes)[hole] ?? HOLE_X[hole] ?? 0;
  return HOLE_X[hole] ?? 0;
}

export type DrawKind = 'run' | 'pass' | 'block';
export interface PlayStroke {
  kind: DrawKind;
  /** `smooth`: the line curves through this point (part of a curve the coach drew), not a sharp break. */
  points: { x: number; y: number; smooth?: boolean }[];
  /** The assignment picked for this player (e.g. "Reach Right"). Hand-drawn lines have none. */
  label?: string;
  /** Pre-snap motion: points 0..motion are the motion (a zigzag); the rest is the play (`kind`). */
  motion?: number;
  /** Older lines drawn freehand: the whole line is a smooth curve (newer ones mark each `smooth` point). */
  curve?: boolean;
  /** Its own color (our defense's blitzes and coverage), instead of the kind's. */
  color?: string;
  /** A coverage zone at the end of the line, in yards across (rx) and deep (ry). */
  zone?: { rx: number; ry: number };
}

/** Pre-snap motion is drawn as a zigzag in its own color. */
export const MOTION_COLOR = '#7c3aed';

type SvgPt = { cx: number; cy: number };
const fmt = (p: SvgPt) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`;
/**
 * A smooth curve through every point, the way it was drawn (Catmull-Rom as cubic curves). It ends heading
 * from the next-to-last point to the last, so the arrow lines up with it.
 */
function curveSegs(pts: SvgPt[]) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = { cx: p1.cx + (p2.cx - p0.cx) / 6, cy: p1.cy + (p2.cy - p0.cy) / 6 };
    const c2 = { cx: p2.cx - (p3.cx - p1.cx) / 6, cy: p2.cy - (p3.cy - p1.cy) / 6 };
    d += ` C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }
  return d;
}
/**
 * The line through its points: straight between sharp breaks, and a smooth curve through the points marked
 * smooth (the parts the coach drew curved).
 */
function linePath(pts: SvgPt[], smooth: (i: number) => boolean) {
  let d = `M${fmt(pts[0])}`;
  let start = 0;
  for (let i = 1; i < pts.length; i++) {
    if (i < pts.length - 1 && smooth(i)) continue;
    d += i - start < 2 ? ` L${fmt(pts[i])}` : curveSegs(pts.slice(start, i + 1));
    start = i;
  }
  return d;
}

/**
 * One leg as the coach drew it with a drag (in field yards): straight where it was drawn straight, curved
 * where it was drawn curved, and a sharp break where the hand turned sharply. The first point stays put.
 */
export function shapeDrawnLeg(raw: { x: number; y: number }[]): { x: number; y: number; smooth?: boolean }[] {
  if (raw.length < 2) return raw.map((p) => ({ x: p.x, y: p.y }));
  // In picture units, so a yard across and a yard up count the way they look.
  const sv = raw.map((p) => fieldToSvg(p.x, p.y));
  const dist = (a: SvgPt, b: SvgPt) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
  const offLine = (p: SvgPt, a: SvgPt, b: SvgPt) => {
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((p.cx - a.cx) * dx + (p.cy - a.cy) * dy) / len)) : 0;
    return Math.hypot(p.cx - (a.cx + t * dx), p.cy - (a.cy + t * dy));
  };
  // The drawn shape's key points (Douglas-Peucker, 4 px).
  const keep = new Set([0, sv.length - 1]);
  const simplify = (a: number, b: number) => {
    let far = -1;
    let farD = 4;
    for (let i = a + 1; i < b; i++) {
      const d = offLine(sv[i], sv[a], sv[b]);
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    if (far < 0) return;
    keep.add(far);
    simplify(a, far);
    simplify(far, b);
  };
  simplify(0, sv.length - 1);
  const idx = [...keep].sort((a, b) => a - b);
  // Sharp breaks: where the hand's direction just before the point and just after it differ by more than
  // 35 degrees. Measured close in (about 8 px each way), so a tight curve isn't taken for a break and a
  // 45-degree cut isn't rounded off.
  const reach = (i: number, step: 1 | -1) => {
    let j = i;
    while (j + step >= 0 && j + step < sv.length && dist(sv[i], sv[j]) < 8) j += step;
    return sv[j];
  };
  const turn = (k: number) => {
    const i = idx[k];
    const a = reach(i, -1);
    const b = sv[i];
    const c = reach(i, 1);
    const a1 = Math.atan2(b.cy - a.cy, b.cx - a.cx);
    const a2 = Math.atan2(c.cy - b.cy, c.cx - b.cx);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  };
  const corners = [0];
  for (let k = 1; k < idx.length - 1; k++) if (turn(k) > (35 * Math.PI) / 180) corners.push(k);
  corners.push(idx.length - 1);
  const out: { x: number; y: number; smooth?: boolean }[] = [{ x: raw[0].x, y: raw[0].y }];
  for (let c = 0; c < corners.length - 1; c++) {
    const from = idx[corners[c]];
    const to = idx[corners[c + 1]];
    // Straight if no drawn point strays far from the straight line between the breaks.
    let stray = 0;
    for (let i = from + 1; i < to; i++) stray = Math.max(stray, offLine(sv[i], sv[from], sv[to]));
    const straight = stray < Math.max(7, dist(sv[from], sv[to]) * 0.06);
    if (!straight) {
      for (let k = corners[c] + 1; k < corners[c + 1]; k++) out.push({ x: raw[idx[k]].x, y: raw[idx[k]].y, smooth: true });
    }
    out.push({ x: raw[to].x, y: raw[to].y });
  }
  return out;
}
/** A zigzag along the points (motion before the snap). */
function zigzagPath(pts: SvgPt[], amp = 4, step = 7) {
  let d = `M${fmt(pts[0])}`;
  let side = 1;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.cx - a.cx, b.cy - a.cy);
    const n = Math.max(2, Math.round(len / step));
    const ux = (b.cx - a.cx) / (len || 1);
    const uy = (b.cy - a.cy) / (len || 1);
    for (let k = 1; k < n; k++) {
      const t = (len * k) / n;
      d += ` L${fmt({ cx: a.cx + ux * t - uy * amp * side, cy: a.cy + uy * t + ux * amp * side })}`;
      side = -side;
    }
    d += ` L${fmt(b)}`;
  }
  return d;
}

/**
 * How a line is drawn (in picture units), the same in the editor, the saved picture and print: the motion
 * zigzag, then the play's line (dashed for a pass, curved if drawn freehand), and its end (arrow, or a T
 * for a block). Null for a line with fewer than two points.
 */
export function strokePaths(s: PlayStroke) {
  const pts = s.points.map((p) => fieldToSvg(p.x, p.y));
  if (pts.length < 2) return null;
  const m = Math.min(Math.max(0, Math.round(Number(s.motion) || 0)), pts.length - 1);
  const motionPts = m > 0 ? pts.slice(0, m + 1) : [];
  const mainPts = pts.slice(m);
  const hasMain = mainPts.length >= 2;
  const color = s.color || STROKE_COLOR[s.kind];
  const endPts = hasMain ? mainPts : motionPts;
  // A zone: an oval around the end of the line (yards to picture units, either way from its center).
  const last = s.points[s.points.length - 1];
  const zone =
    s.zone && last
      ? (() => {
          const c = fieldToSvg(last.x, last.y);
          const rx = Math.abs(fieldToSvg(last.x + s.zone!.rx, last.y).cx - fieldToSvg(last.x - s.zone!.rx, last.y).cx) / 2;
          return { cx: c.cx, cy: c.cy, rx, ry: s.zone!.ry * FIELD_SVG.scaleY };
        })()
      : null;
  return {
    zone,
    motionD: motionPts.length >= 2 ? zigzagPath(motionPts) : '',
    mainD: hasMain ? linePath(mainPts, (k) => Boolean(s.curve || s.points[m + k]?.smooth)) : '',
    color,
    dashed: hasMain && s.kind === 'pass',
    width: s.kind === 'block' ? 2.6 : 2.8,
    /** The line ends in a T (a block) or an arrow, from a to b. */
    cap: { t: hasMain && s.kind === 'block', color: hasMain ? color : MOTION_COLOR, a: endPts[endPts.length - 2], b: endPts[endPts.length - 1] },
  };
}

/** TE and WR marks for the diagram. Offensive line stays blank. */
export function skillDiagramLabel(role: string): 'TE' | 'WR' | null {
  if (/^Y\d*$/.test(role)) return 'TE';
  if (/^[XZH]$/.test(role) || /^W\d*$/.test(role)) return 'WR';
  return null;
}

export function diagramLabel(role: string) {
  if (/^[1-4]$/.test(role)) return role;
  if (/^E\d/.test(role) || /^T\d/.test(role)) return role;
  if (role === 'NT') return 'N';
  if (role === 'SAM') return 'S';
  if (role === 'MIKE') return 'M';
  if (role === 'WILL') return 'W';
  if (role === 'ROV') return 'R';
  if (role.startsWith('CB')) return 'C';
  if (role === 'FS') return 'FS';
  if (role === 'SS') return 'SS';
  if (/^D[ET]\d/.test(role)) return role.slice(1);
  if (/^OLB/.test(role)) return 'O';
  return role.replace(/\d+$/, '').slice(0, 3);
}

export function findBack(nodes: PlayNode[], n: number) {
  return nodes.find((p) => p.role === String(n));
}

function pt(x: number, y: number) {
  return { x, y };
}

function line(kind: DrawKind, points: { x: number; y: number }[]): PlayStroke | null {
  if (points.length < 2) return null;
  return { kind, points };
}

function skill(nodes: PlayNode[], roles: string[]) {
  return roles.map((r) => nodes.find((n) => n.role === r)).find(Boolean);
}

function motionMan(nodes: PlayNode[], sign: number) {
  const first = sign > 0 ? ['Z', 'W', 'H', 'Y2', 'W2'] : ['X', 'W', 'H', 'Y1', 'W1'];
  return skill(nodes, first) || skill(nodes, ['Z', 'X', 'Y2', 'Y1', 'W2', 'W1']) || findBack(nodes, 4);
}

function receiverRoute(rec: PlayNode, blob: string, tags: string[], sign: number): PlayStroke | null {
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  if (/vert/.test(blob) || has('Fade')) return line('pass', [pt(rec.x, rec.y), pt(rec.x, rec.y + 5.2)]);
  if (/smash/.test(blob) || has('Smash')) {
    if (Math.abs(rec.x) > 10) return line('pass', [pt(rec.x, rec.y), pt(rec.x, rec.y + 1.4)]);
    return line('pass', [pt(rec.x, rec.y), pt(rec.x, rec.y + 2.2), pt(rec.x + Math.sign(rec.x || 1) * 3.2, rec.y + 4.2)]);
  }
  if (/flood/.test(blob) || has('Flood')) return line('pass', [pt(rec.x, rec.y), pt(rec.x + sign * 2.4, rec.y + 2.4 + Math.abs(rec.x) * 0.08)]);
  if (/stick/.test(blob) || has('Stick')) {
    if (Math.abs(rec.x) < 10) return line('pass', [pt(rec.x, rec.y), pt(rec.x + sign * 0.6, rec.y + 1.7)]);
    return line('pass', [pt(rec.x, rec.y), pt(rec.x, rec.y + 1.2)]);
  }
  if (/mesh/.test(blob) || has('Mesh')) return line('pass', [pt(rec.x, rec.y), pt(-rec.x * 0.25, rec.y + 1.3)]);
  if (has('Slant') || /slant/.test(blob)) return line('pass', [pt(rec.x, rec.y), pt(rec.x - Math.sign(rec.x || 1) * 4, rec.y + 1.8)]);
  if (has('Hitch')) return line('pass', [pt(rec.x, rec.y), pt(rec.x, rec.y + 1.3)]);
  if (rec.role.startsWith('Y')) return line('pass', [pt(rec.x, rec.y), pt(-sign * 4, rec.y + 1.7)]);
  if (rec.role === 'X') return line('pass', [pt(rec.x, rec.y), pt(rec.x, rec.y + 3.4), pt(rec.x + Math.sign(rec.x || -1) * 2, rec.y + 5)]);
  return line('pass', [pt(rec.x, rec.y), pt(rec.x + sign * 1.4, rec.y + 2.6)]);
}

/** Draw the ball, lead, and tagged motions/routes from who is running and which hole. */
export function autoDrawPlay(opts: {
  nodes: PlayNode[];
  hole: number | null;
  primaryBack: number | string;
  concept: string;
  scheme: string;
  tags: string[];
  family: ReturnType<typeof conceptFamily>;
}): PlayStroke[] {
  const { nodes, hole, concept, scheme, tags } = opts;
  const family = opts.family;
  const out: PlayStroke[] = [];
  const add = (s: PlayStroke | null) => {
    if (s) out.push(s);
  };
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const blob = `${concept} ${scheme} ${tags.join(' ')}`.toLowerCase();
  const qb = findBack(nodes, 1);
  const fb = findBack(nodes, 2);
  const tb = findBack(nodes, 3);
  const wb = findBack(nodes, 4);
  const carrier = nodes.find((p) => p.role === String(opts.primaryBack)) || tb || fb || qb;
  const xs = runningHoleXs(nodes);
  const hx = hole != null ? xs[hole] ?? 0 : 0;
  const sign = hole != null && hole < 5 ? 1 : hole != null && hole > 5 ? -1 : 1;

  if ((has('Jet') || has('Fly') || has('Rocket') || has('Fake Jet') || has('Ghost') || has('Zip')) && qb) {
    const wr = motionMan(nodes, sign);
    if (wr) {
      if (has('Ghost')) {
        add(line('run', [pt(wr.x, wr.y), pt(qb.x + (wr.x > 0 ? -3 : 3), qb.y - 0.5), pt(wr.x, wr.y)]));
      } else if (has('Zip')) {
        add(line('run', [pt(wr.x, wr.y), pt(qb.x + (wr.x > 0 ? 2.2 : -2.2), qb.y - 0.15)]));
      } else if (has('Rocket')) {
        add(line('run', [pt(wr.x, wr.y), pt(0, Math.min(wr.y, -4.4)), pt(-Math.sign(wr.x || 1) * 8, -1.1)]));
      } else {
        add(line('run', [pt(wr.x, wr.y), pt(qb.x + (wr.x > 0 ? -2 : 2), qb.y - 0.4), pt(qb.x + (wr.x > 0 ? -7 : 7), qb.y)]));
      }
    }
  }
  if (has('Orbit') && qb) {
    const wr = motionMan(nodes, sign) || skill(nodes, ['Z', 'H', 'W', 'X']);
    if (wr) add(line('run', [pt(wr.x, wr.y), pt(qb.x + 3, qb.y - 1.1), pt(qb.x - 3, qb.y - 1.1), pt(qb.x - 6, qb.y)]));
  }
  if ((has('Laser') || has('Zap')) && qb) {
    const slot = skill(nodes, ['W', 'H', 'Z', 'Y2', 'Y1']) || findBack(nodes, 4);
    if (slot) add(line('run', [pt(slot.x, slot.y), pt(sign * 3.5, -1)]));
  }

  const mesh = qb && carrier ? pt((carrier.x + qb.x) / 2, (carrier.y + qb.y) / 2 + 0.2) : carrier ? pt(carrier.x, carrier.y + 0.8) : pt(0, -1);
  const atLos = pt(hx, 0.2);
  const through = pt(hx + sign * (hole === 1 || hole === 9 ? 1.6 : 0.15), hole === 1 || hole === 9 ? 2.5 : 2.3);

  const rule = /buck/.test(blob)
    ? 'buck'
    : /trap/.test(blob)
      ? 'trap'
      : /belly.*g|down.*g/.test(blob)
        ? 'belly_g'
        : /belly/.test(blob)
          ? 'belly'
          : /counter|reverse/.test(blob)
            ? 'counter'
            : /pin.*pull/.test(blob)
              ? 'pin_pull'
              : /duo/.test(blob)
                ? 'duo'
                : /power/.test(blob)
                  ? 'power'
                  : /iso|blast/.test(blob)
                    ? 'iso'
                    : /wedge|sneak/.test(blob)
                      ? 'wedge'
                      : /draw|delay/.test(blob)
                        ? 'draw'
                        : /toss|sweep|stretch|jet/.test(blob)
                          ? 'toss'
                          : /zone/.test(blob)
                            ? 'zone'
                            : /down/.test(blob)
                              ? 'down'
                              : 'gap';

  const ol = ['LT', 'LG', 'C', 'RG', 'RT']
    .map((r) => nodes.find((n) => n.role === r))
    .filter((n): n is PlayNode => !!n);
  const centerNode = ol.find((n) => n.role === 'C');
  const cx = centerNode?.x ?? 0;
  const psg = sign > 0 ? ol.find((n) => n.role === 'RG') : ol.find((n) => n.role === 'LG');
  const bsg = sign > 0 ? ol.find((n) => n.role === 'LG') : ol.find((n) => n.role === 'RG');
  const pst = sign > 0 ? ol.find((n) => n.role === 'RT') : ol.find((n) => n.role === 'LT');
  const bst = sign > 0 ? ol.find((n) => n.role === 'LT') : ol.find((n) => n.role === 'RT');

  if (family === 'run' || family === 'option') {
    for (const l of ol) {
      const onPlay = Math.sign(l.x - cx) === sign || Math.abs(l.x - cx) < 0.4;

      // 1. Buck Sweep (Both Guards Pull: PSG kicks out edge, BSG wraps through alley, Center blocks back)
      if (rule === 'buck') {
        if (psg && l.role === psg.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x, l.y - 1.0), pt(hx * 0.7, -0.6), pt(hx + sign * 1.5, 0.95)]));
          continue;
        }
        if (bsg && l.role === bsg.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x, l.y - 1.25), pt(hx * 0.45, -0.75), pt(hx + sign * 0.35, 2.2)]));
          continue;
        }
        if (centerNode && l.role === centerNode.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 1.2, 0.85)]));
          continue;
        }
        if (pst && l.role === pst.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 1.35, 0.9)]));
          continue;
        }
        add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.6, 0.85)]));
        continue;
      }

      // 2. Trap (BSG pulls flat across center to trap, Center blocks back, PSG climbs)
      if (rule === 'trap') {
        if (bsg && l.role === bsg.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x, l.y - 0.95), pt(hx * 0.6, -0.45), pt(hx + sign * 0.85, 0.85)]));
          continue;
        }
        if (centerNode && l.role === centerNode.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.95, 0.85)]));
          continue;
        }
        if (psg && l.role === psg.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.3, 1.8)]));
          continue;
        }
        if (pst && l.role === pst.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 1.35, 0.95)]));
          continue;
        }
        add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.5, 0.8)]));
        continue;
      }

      // 3. Belly G / Down (PSG pulls to kick out edge defender, PST blocks down)
      if (rule === 'belly_g' || rule === 'down') {
        if (psg && l.role === psg.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x, l.y - 1.0), pt(hx + sign * 1.3, 0.85)]));
          continue;
        }
        if (pst && l.role === pst.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 1.35, 0.95)]));
          continue;
        }
        add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.65, 0.85)]));
        continue;
      }

      // 4. Belly (Down blocks on DL, B-gap dive)
      if (rule === 'belly') {
        if (pst && l.role === pst.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 1.35, 0.95)]));
          continue;
        }
        if (psg && l.role === psg.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x, 0.95)]));
          continue;
        }
        add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.65, 0.85)]));
        continue;
      }

      // 5. Pin & Pull (PSG pulls around pinned tackle into edge alley)
      if (rule === 'pin_pull') {
        if (psg && l.role === psg.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x, l.y - 1.05), pt(hx + sign * 0.9, -0.45), pt(hx + sign * 1.6, 1.7)]));
          continue;
        }
        if (pst && l.role === pst.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 1.4, 0.9)]));
          continue;
        }
        if (centerNode && l.role === centerNode.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.8, 0.9)]));
          continue;
        }
        add(line('block', [pt(l.x, l.y), pt(l.x + sign * 0.4, 0.9)]));
        continue;
      }

      // 6. Duo (Heavy double teams driving vertically into LBs)
      if (rule === 'duo') {
        add(line('block', [pt(l.x, l.y), pt(l.x + sign * 0.25, 1.45)]));
        continue;
      }

      // 7. Counter / Counter GT (BSG kicks out edge, BST wraps through hole)
      if (rule === 'counter') {
        if (bsg && l.role === bsg.role) {
          add(line('block', [pt(l.x, l.y), pt(0, -1.15), pt(hx + sign * 1.3, -0.7), pt(hx + sign * 2.2, 0.85)]));
          continue;
        }
        if (bst && l.role === bst.role) {
          add(line('block', [pt(l.x, l.y), pt(l.x, l.y - 1.35), pt(hx * 0.6, -0.8), pt(hx + sign * 0.3, 1.9)]));
          continue;
        }
        add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.9, 0.9)]));
        continue;
      }

      // 8. Power (BSG wraps through hole, other line blocks down)
      if (rule === 'power') {
        if (bsg && l.role === bsg.role) {
          add(line('block', [pt(l.x, l.y), pt(0, -1.15), pt(hx * 0.5, -0.7), pt(hx + sign * 0.3, 2.0)]));
          continue;
        }
        add(line('block', [pt(l.x, l.y), pt(l.x - sign * 0.85, 0.9)]));
        continue;
      }

      // 9. Wedge / QB Sneak (Converge into center wedge)
      if (rule === 'wedge') {
        add(line('block', [pt(l.x, l.y), pt(cx + (l.x - cx) * 0.25, 1.3)]));
        continue;
      }

      // 10. Draw (Pass set delay, seal pass rushers wide)
      if (rule === 'draw') {
        add(line('block', [pt(l.x, l.y), pt(l.x + (l.x > 0 ? 0.35 : -0.35), l.y - 1.1), pt(l.x + (l.x > 0 ? 0.65 : -0.65), l.y - 0.2)]));
        continue;
      }

      // 11. Zone / Toss (Lateral reach playside)
      if (rule === 'zone' || rule === 'toss') {
        add(line('block', [pt(l.x, l.y), pt(l.x + sign * (onPlay ? 1.15 : 0.45), 0.95)]));
        continue;
      }

      // 12. Gap / Dive / Iso
      add(line('block', [pt(l.x, l.y), pt(l.x - sign * (Math.abs(l.x - cx) < 0.4 ? 0.15 : 0.7), 0.9)]));
    }

    for (const te of nodes.filter((n) => n.line && ['Y', 'Y1', 'Y2'].includes(n.role) && n.role !== carrier?.role)) {
      const tePlay = Math.sign(te.x || sign) === sign;
      if (rule === 'toss' && tePlay) add(line('block', [pt(te.x, te.y), pt(te.x + sign * 1.6, 1.1)]));
      else if (rule === 'zone') add(line('block', [pt(te.x, te.y), pt(te.x + sign * 0.9, 0.95)]));
      else if (rule === 'buck' || rule === 'belly' || rule === 'belly_g' || rule === 'down') {
        add(line('block', [pt(te.x, te.y), pt(te.x - sign * 1.3, 0.95)]));
      } else {
        add(line('block', [pt(te.x, te.y), pt(te.x - sign * 0.35, 0.85)]));
      }
    }
  }

  // Lead / FB assignments
  if (fb && carrier && fb.role !== carrier.role && (family === 'run' || family === 'option')) {
    if (rule === 'power') {
      add(line('block', [pt(fb.x, fb.y), pt(hx + sign * 1.3, -0.4), pt(hx + sign * 1.8, 0.85)]));
    } else if (rule === 'iso') {
      add(line('block', [pt(fb.x, fb.y), pt(hx * 0.5, -0.3), pt(hx, 1.85)]));
    } else if (rule === 'duo') {
      add(line('block', [pt(fb.x, fb.y), pt(hx * 0.5, -0.3), pt(hx + sign * 0.2, 1.7)]));
    } else if (rule === 'buck') {
      add(line('run', [pt(fb.x, fb.y), pt(-sign * 2.2, -0.2), pt(-sign * 2.8, 1.4)]));
    } else if (rule === 'trap' || rule === 'counter') {
      add(line('run', [pt(fb.x, fb.y), pt(-sign * 2.4, 0.2), pt(-sign * 3.0, 1.3)]));
    } else if (rule === 'belly' || rule === 'belly_g') {
      add(line('block', [pt(fb.x, fb.y), pt(hx * 0.4, -0.3), pt(hx - sign * 0.5, 1.2)]));
    } else if (rule === 'gap') {
      add(line('block', [pt(fb.x, fb.y), pt(hx * 0.4, -0.3), pt(hx + sign * 0.4, 1.15)]));
    }
  }

  const screen = family === 'screen' || has('Bubble') || has('Smoke') || has('Screen');
  const option = family === 'option' || has('Option');
  const boot = has('Boot') || has('Naked') || has('Waggle') || /boot|waggle|sprint/.test(blob);
  const passPlay = family === 'pass' || has('Play Action') || has('RPO') || boot;

  if (screen && qb) {
    const tgt = has('Smoke') || /smoke/.test(blob) ? skill(nodes, ['X']) : skill(nodes, ['Z', 'H', 'W', 'Y']);
    if (tgt) {
      add(line('pass', [pt(qb.x, qb.y), pt(tgt.x, tgt.y + 0.35)]));
      add(line('run', [pt(tgt.x, tgt.y), pt(tgt.x + Math.sign(tgt.x || 1) * 3.2, tgt.y + 1.3)]));
    }
  } else if (option) {
    if (qb) add(line('run', [pt(qb.x, qb.y), pt(sign * 5, -0.15), pt(sign * 8.2, 1.5)]));
    if (tb && tb !== qb) add(line('run', [pt(tb.x, tb.y), pt(sign * 7, -1.15), pt(sign * 11, 0.7)]));
    if (has('Load') && fb) add(line('block', [pt(fb.x, fb.y), pt(sign * 6.4, 0.95)]));
  } else if (passPlay && qb) {
    const rollDir = has('Waggle') || /waggle/.test(blob) ? sign : -sign;
    if (boot) add(line('run', [pt(qb.x, qb.y), pt(qb.x + rollDir * 3.2, qb.y + 0.15), pt(qb.x + rollDir * 6.5, 0.35)]));
    for (const rec of nodes.filter((n) => ['X', 'Z', 'Y', 'W', 'H', 'Y1', 'Y2'].includes(n.role))) {
      add(receiverRoute(rec, blob, tags, sign));
    }
    if ((has('RPO') || has('Play Action') || /rpo|play action/.test(blob)) && carrier && carrier.role !== '1') {
      add(line('run', [pt(carrier.x, carrier.y), mesh, atLos]));
    }
  } else if (has('Keep') && qb) {
    add(line('run', [pt(qb.x, qb.y), pt(hx * 0.5, qb.y * 0.25), atLos, through]));
    if (tb) add(line('run', [pt(tb.x, tb.y), pt(-sign * 2.8, -1)]));
  } else if (has('Reverse')) {
    const wr = skill(nodes, ['Z', 'X']);
    if (wr) add(line('run', [pt(wr.x, wr.y), pt(0, -2), pt(-Math.sign(wr.x || 1) * 8, 1.1)]));
    if (carrier) add(line('run', [pt(carrier.x, carrier.y), mesh]));
  } else if (carrier) {
    if (rule === 'buck') {
      add(line('run', [pt(carrier.x, carrier.y), pt(carrier.x + sign * 2.0, carrier.y + 0.35), pt(hx * 0.8, -0.5), pt(hx, 0.4), through]));
      if (qb) add(line('run', [pt(qb.x, qb.y), pt(qb.x + sign * 0.8, qb.y + 0.3), pt(qb.x - sign * 3.5, 0.2), pt(qb.x - sign * 6, 0.5)]));
    } else if (rule === 'trap') {
      add(line('run', [pt(carrier.x, carrier.y), pt(hx * 0.6, -0.4), atLos, through]));
    } else if (rule === 'belly') {
      add(line('run', [pt(carrier.x, carrier.y), pt(hx * 0.75, -0.4), atLos, through]));
      if (qb) add(line('run', [pt(qb.x, qb.y), pt(qb.x + sign * 1.0, qb.y + 0.4), pt(qb.x - sign * 3.5, 0.2), pt(qb.x - sign * 6, 0.5)]));
      if (tb && tb.role !== carrier.role) add(line('run', [pt(tb.x, tb.y), pt(hx + sign * 2.5, -0.6), pt(hx + sign * 4.5, 1.8)]));
    } else if (rule === 'belly_g') {
      add(line('run', [pt(carrier.x, carrier.y), pt(carrier.x + sign * 1.5, carrier.y + 0.4), pt(hx * 0.8, -0.4), atLos, through]));
    } else if (rule === 'pin_pull') {
      add(line('run', [pt(carrier.x, carrier.y), pt(carrier.x + sign * 2.2, carrier.y + 0.3), pt(hx * 0.85, -0.5), pt(hx, 0.45), through]));
    } else if (rule === 'duo') {
      add(line('run', [pt(carrier.x, carrier.y), pt(hx * 0.6, -0.4), atLos, through]));
    } else if (rule === 'counter') {
      add(line('run', [pt(carrier.x, carrier.y), pt(carrier.x - sign * 2.4, carrier.y + 0.5), mesh, pt(-hx * 0.15, -0.15), atLos, through]));
    } else if (rule === 'wedge' || (carrier.role === '1' && (hole === 5 || !hole))) {
      add(line('run', [pt(carrier.x, carrier.y), atLos, through]));
    } else if (rule === 'draw') {
      add(line('run', [pt(carrier.x, carrier.y), pt(carrier.x, carrier.y + 0.35), mesh, pt(hx, -0.45), through]));
    } else if (rule === 'zone') {
      // First step toward the hole, wherever he lines up (a wingback outside the hole comes back inside).
      const toHole = Math.sign(hx - carrier.x) || sign;
      const step = Math.min(2.6, Math.abs(hx - carrier.x) * 0.6);
      add(
        line('run', [
          pt(carrier.x, carrier.y),
          ...(step >= 0.5 ? [pt(carrier.x + toHole * step, carrier.y + 0.2)] : []),
          pt(hx + sign * 0.15, -0.05),
          pt(hx + sign * 0.55, 4.2),
        ])
      );
      if (tb && tb.role !== carrier.role) add(line('block', [pt(tb.x, tb.y), pt(tb.x - sign * 0.2, 0.2)]));
      if (wb && wb.role !== carrier.role && wb !== tb) add(line('block', [pt(wb.x, wb.y), pt(wb.x + sign * 0.4, 0.15)]));
    } else if (rule === 'toss') {
      // Out toward the hole and turn up there: from a back behind the QB, or from a wing already out wide.
      const toHole = Math.sign(hx - carrier.x) || sign;
      const gap = Math.abs(hx - carrier.x);
      // A wingback taking it across the formation (the 4 back to the 1 hole) goes behind the backfield.
      if (Math.abs(carrier.x) > 3 && Math.sign(carrier.x) !== Math.sign(hx) && hx !== 0) {
        add(line('run', [pt(carrier.x, carrier.y), pt(carrier.x * 0.45, -3.6), pt(hx * 0.45, -3.6), pt(hx * 0.85, -0.9), pt(hx, 0.45), through]));
      } else {
        add(
          line('run', [
            pt(carrier.x, carrier.y),
            ...(gap >= 3 ? [pt(carrier.x + toHole * 2.1, carrier.y + 0.25)] : []),
            pt(carrier.x + (hx - carrier.x) * 0.7, -0.55),
            pt(hx, 0.45),
            through,
          ])
        );
      }
    } else if (carrier.role === '1') {
      add(line('run', [pt(carrier.x, carrier.y), atLos, through]));
    } else {
      add(line('run', [pt(carrier.x, carrier.y), mesh, atLos, through]));
    }
  }

  if (has('Crack')) {
    const wr = sign > 0 ? skill(nodes, ['Z', 'Y', 'Y2']) : skill(nodes, ['X', 'Y', 'Y1']);
    if (wr) add(line('block', [pt(wr.x, wr.y), pt(sign * 6.4, 0.9)]));
  }

  void wb;
  return out;
}

/**
 * The diagram is a whiteboard, not to scale. Inside the box (7 yards each way) a yard is wider, so
 * linemen and backs stand apart and their lines read. Outside it a yard is about as wide as it is
 * deep, so receivers at the numbers still fit. Less room behind the backfield, more downfield.
 */
export const FIELD_SVG = { w: 760, h: 520, losY: 360, scaleX: 24, scaleY: 14, originX: 380 };
const BOX_YARDS = 7;
const OUTSIDE_SCALE = (FIELD_SVG.originX - BOX_YARDS * FIELD_SVG.scaleX) / 15;

export function fieldToSvg(x: number, y: number) {
  const ax = Math.abs(x);
  const dx = ax <= BOX_YARDS ? ax * FIELD_SVG.scaleX : BOX_YARDS * FIELD_SVG.scaleX + (ax - BOX_YARDS) * OUTSIDE_SCALE;
  return { cx: FIELD_SVG.originX + Math.sign(x) * dx, cy: FIELD_SVG.losY - y * FIELD_SVG.scaleY };
}

export function svgToField(cx: number, cy: number) {
  const d = cx - FIELD_SVG.originX;
  const ad = Math.abs(d);
  const box = BOX_YARDS * FIELD_SVG.scaleX;
  const ax = ad <= box ? ad / FIELD_SVG.scaleX : BOX_YARDS + (ad - box) / OUTSIDE_SCALE;
  return { x: Math.sign(d) * ax, y: (FIELD_SVG.losY - cy) / FIELD_SVG.scaleY };
}

export function applyNodeOverrides(nodes: PlayNode[], overrides: Record<string, { x: number; y: number }>) {
  return nodes.map((n) => (overrides[n.role] ? { ...n, x: overrides[n.role].x, y: overrides[n.role].y } : n));
}

const STROKE_COLOR: Record<DrawKind, string> = { run: '#e11d2a', pass: '#2563eb', block: '#111827' };

function strokeSvg(strokes: PlayStroke[]) {
  return strokes
    .map((s) => {
      const sp = strokePaths(s);
      if (!sp) return '';
      const { a, b } = sp.cap;
      const zone = sp.zone ? `<ellipse cx="${sp.zone.cx.toFixed(1)}" cy="${sp.zone.cy.toFixed(1)}" rx="${sp.zone.rx.toFixed(1)}" ry="${sp.zone.ry.toFixed(1)}" fill="${sp.color}" fill-opacity="0.12" stroke="${sp.color}" stroke-opacity="0.55" stroke-width="1.2"/>` : '';
      const motion = sp.motionD ? `<path d="${sp.motionD}" fill="none" stroke="${MOTION_COLOR}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` : '';
      const main = sp.mainD
        ? `<path d="${sp.mainD}" fill="none" stroke="${sp.color}" stroke-width="${sp.width}" stroke-linecap="round" stroke-linejoin="round"${sp.dashed ? ' stroke-dasharray="5 4"' : ''}/>`
        : '';
      const cap = sp.cap.t ? tBar(a.cx, a.cy, b.cx, b.cy, sp.color) : `<polygon points="${arrowHead(a.cx, a.cy, b.cx, b.cy)}" fill="${sp.cap.color}" />`;
      return `${zone}${motion}${main}${cap}`;
    })
    .join('');
}

function tBar(x1: number, y1: number, x2: number, y2: number, color: string) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const w = 7;
  const ax = x2 + w * Math.cos(ang + Math.PI / 2);
  const ay = y2 + w * Math.sin(ang + Math.PI / 2);
  const bx = x2 + w * Math.cos(ang - Math.PI / 2);
  const by = y2 + w * Math.sin(ang - Math.PI / 2);
  return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`;
}

function arrowHead(x1: number, y1: number, x2: number, y2: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const l = 8;
  const p1x = x2 - l * Math.cos(ang - 0.45);
  const p1y = y2 - l * Math.sin(ang - 0.45);
  const p2x = x2 - l * Math.cos(ang + 0.45);
  const p2y = y2 - l * Math.sin(ang + 0.45);
  return `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`;
}

export function fieldBgSvg() {
  const { w, h, losY, scaleY } = FIELD_SVG;
  // A light gray field: a line every 5 yards, a tick every yard on both sidelines and both hashes, big
  // outlined yard numbers turned toward each sideline, and the line of scrimmage in blue.
  const line = (cy: number, stroke: string, width: number) => `<line x1="0" y1="${cy}" x2="${w}" y2="${cy}" stroke="${stroke}" stroke-width="${width}"/>`;
  const top = Math.floor(-(h - losY) / scaleY);
  const bottom = Math.ceil(losY / scaleY);
  let fives = '';
  let ticks = '';
  const hashL = fieldToSvg(-3.4, 0).cx;
  const hashR = fieldToSvg(3.4, 0).cx;
  for (let y = top; y <= bottom; y++) {
    const cy = losY - y * scaleY;
    if (y % 5 === 0) {
      if (y !== 0) fives += line(cy, '#b4b4b4', 1.6);
      continue;
    }
    const t = (x1: number, x2: number) => `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="#b4b4b4" stroke-width="1.2"/>`;
    ticks += t(0, 9) + t(w - 9, w) + t(hashL - 5, hashL + 5) + t(hashR - 5, hashR + 5);
  }
  // Numbers on the 10s, 20 at the line of scrimmage: tops toward the near sideline.
  const font = 'Oswald, Impact, Arial Narrow, system-ui, sans-serif';
  let numbers = '';
  for (let y = top; y <= bottom; y++) {
    if (y % 10 !== 0) continue;
    const n = 20 + y;
    if (n <= 0 || n > 50) continue;
    const cy = losY - y * scaleY;
    const style = `fill="none" stroke="#c7c7c7" stroke-width="1.6" font-size="40" font-weight="700" font-family="${font}" text-anchor="middle" letter-spacing="2"`;
    numbers += `<text x="0" y="0" transform="translate(${92} ${cy}) rotate(90)" dy="14" ${style}>${n}</text>`;
    numbers += `<text x="0" y="0" transform="translate(${w - 92} ${cy}) rotate(-90)" dy="14" ${style}>${n}</text>`;
  }
  return `<rect width="100%" height="100%" fill="#f0f0f0"/>${fives}${ticks}${numbers}<line x1="0" y1="${losY}" x2="${w}" y2="${losY}" stroke="#7b7bef" stroke-width="2.2"/>`;
}

export function playerGlyphSvg(n: PlayNode, ballRole?: string) {
  const { cx, cy } = fieldToSvg(n.x, n.y);
  const custom = n.label?.trim();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
  const font = 'system-ui, -apple-system, sans-serif';
  // A name the coach typed can be longer than the usual letter: shrink it to fit the circle.
  const fit = (text: string, base: number, room: number) => Math.min(base, room / Math.max(1, text.length * 0.62));
  if (isDefenseRole(n.role)) {
    // Defense in a red box, wide enough for its name.
    const text = shownText(n, diagramLabel(n.role));
    const bw = Math.max(22, text.length * 7 + 8);
    return `<g><rect x="${cx - bw / 2}" y="${cy - 10}" width="${bw}" height="19" rx="4" fill="${DEFENSE_COLOR}" stroke="#ffffff" stroke-width="1.8"/><text x="${cx}" y="${cy + 3.6}" text-anchor="middle" fill="#ffffff" font-size="10.5" font-family="${font}" font-weight="900">${esc(text)}</text></g>`;
  }
  if (n.role === 'C') {
    const text = custom || 'C';
    const bw = Math.max(17, text.length * 6.5 + 6);
    return `<g><rect x="${cx - bw / 2}" y="${cy - 8.5}" width="${bw}" height="17" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="2"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#0f172a" font-size="10" font-family="${font}" font-weight="900">${esc(text)}</text></g>`;
  }
  const skill = skillDiagramLabel(n.role);
  const isBack = !skill && !(n.line || !/^[1-4]$/.test(n.role));
  const isBall = (Boolean(skill) || isBack) && ballRole != null && n.role === String(ballRole);
  const r = skill || isBack ? 11 : 9.5;
  const text = custom || (skill ? skill : isBack ? diagramLabel(n.role) : n.role.replace(/^O_?/, '').slice(0, 2));
  const size = fit(text, skill ? 9 : isBack ? 12 : 7.5, r * 2);
  const fill = isBall ? '#ea580c' : '#ffffff';
  const ink = isBall ? '#ffffff' : '#0f172a';
  const stroke = isBall ? '#ffffff' : '#0f172a';
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${isBall ? 2.4 : 1.8}"/><text x="${cx}" y="${cy + size * 0.36}" text-anchor="middle" fill="${ink}" font-size="${size}" font-family="${font}" font-weight="${isBack ? 900 : 800}">${esc(text)}</text></g>`;
}

export function holeMarksSvg(_nodes: PlayNode[] = [], _targetHole?: number | null) {
  // Running hole numbers removed per user request for clear, uncluttered view
  return '';
}

export function diagramSvg(play: AssembledPlay, strokes: PlayStroke[] = [], extraNodes: PlayNode[] = [], ballRole?: string) {
  const { w, h } = FIELD_SVG;
  const dots = [...play.nodes, ...extraNodes].map((n) => playerGlyphSvg(n, ballRole)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${fieldBgSvg()}${strokeSvg(strokes)}${dots}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
