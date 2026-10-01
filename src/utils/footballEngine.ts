/**
 * Playbook database, hole numbers, formation coordinates, and assemblePlay.
 * Ported from Mahopac 10U / Hudl decoupled models (Gemini footballEngine).
 */

export type PlayNode = { role: string; x: number; y: number; line?: boolean };

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
      { role: 'X', x: -14, y: -0.5, line: false },
      { role: 'Y', x: 6, y: 0, line: true },
      { role: 'W', x: 10, y: -0.5, line: false },
      { role: 'Z', x: 14, y: 0, line: true },
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
};

/** Where the tight end (or the receivers, when there is no tight end) lines up. Backfield is separate. */
export const TE_LOCATIONS: Record<number, { id: string; label: string; baseKey: string }[]> = {
  10: [
    { id: '2x2', label: '2x2', baseKey: '10_SPREAD_2X2' },
    { id: 'trips', label: 'Trips', baseKey: '10_TRIPS' },
  ],
  11: [
    { id: 'tight', label: 'Tight', baseKey: '11_PRO' },
    { id: 'wing', label: 'Wing', baseKey: '11_TE_WING' },
    { id: 'slot', label: 'Slot', baseKey: '11_TE_SLOT' },
    { id: 'twins', label: 'Twins', baseKey: '11_TE_WEAK' },
  ],
  12: [
    { id: 'tight', label: 'Tight', baseKey: '12_ACE' },
    { id: 'wing', label: 'Wing', baseKey: '12_TE_WING' },
    { id: 'slot', label: 'Slot', baseKey: '12_TE_SLOT' },
    { id: 'twins', label: 'Twins', baseKey: '12_TWINS' },
    { id: 'over', label: 'Tackle over', baseKey: '12_TE_OVER' },
  ],
  20: [
    { id: 'spread', label: 'Spread', baseKey: '20_SPREAD_OPEN' },
    { id: 'twins', label: 'Twins', baseKey: '20_TWINS' },
    { id: 'wing', label: 'Wing', baseKey: '20_WING_T' },
  ],
  21: [
    { id: 'tight', label: 'Tight', baseKey: '21_PRO' },
    { id: 'wing', label: 'Wing', baseKey: '21_TE_WING' },
    { id: 'slot', label: 'Slot', baseKey: '21_TE_SLOT' },
    { id: 'split', label: 'Split', baseKey: '21_TE_SPLIT' },
    { id: 'twins', label: 'Twins', baseKey: '21_TWINS' },
    { id: 'over', label: 'Tackle over', baseKey: '21_BEAST' },
  ],
  22: [
    { id: 'tight', label: 'Tight', baseKey: '22_DOUBLE_TIGHT' },
    { id: 'wing', label: 'Wing', baseKey: '22_TE_WING' },
    { id: 'slot', label: 'Slot', baseKey: '22_TE_SLOT' },
    { id: 'split', label: 'Split', baseKey: '22_TE_SPLIT' },
    { id: 'twins', label: 'Twins', baseKey: '22_TWINS' },
    { id: 'over', label: 'Tackle over', baseKey: '22_BEAST' },
  ],
  30: [
    { id: 'split', label: 'Split', baseKey: '30_FULLHOUSE_OPEN' },
    { id: 'tight', label: 'Tight', baseKey: '30_TIGHT' },
  ],
  31: [
    { id: 'tight', label: 'Tight', baseKey: '31_POWER' },
    { id: 'split', label: 'Split', baseKey: '31_TE_SPLIT' },
    { id: 'nasty', label: 'Snug', baseKey: '31_TE_NASTY' },
    { id: 'over', label: 'Tackle over', baseKey: '31_TE_OVER' },
  ],
  32: [
    { id: 'tight', label: 'Tight', baseKey: '32_WISHBONE' },
    { id: 'split', label: 'Split', baseKey: '32_TE_SPLIT' },
    { id: 'nasty', label: 'Snug', baseKey: '32_TE_NASTY' },
    { id: 'over', label: 'Tackle over', baseKey: '32_TE_OVER' },
  ],
};

export interface BackfieldStructure {
  hudlBackfield: string;
  allowedPersonnel: number[];
  nodes: PlayNode[];
}

export const BACKFIELD_STRUCTURES: Record<string, BackfieldStructure> = {
  I_FORM: {
    hudlBackfield: 'I-Form',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: 0, y: -8.2 },
    ],
  },
  WISHBONE: {
    hudlBackfield: 'Wishbone',
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
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -3.2, y: -5.4 },
      { role: '3', x: 3.2, y: -5.4 },
    ],
  },
  WING_T: {
    hudlBackfield: 'Wing-T',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: 5.2, y: -5.4 },
    ],
  },
  GUN_OFFSET: {
    hudlBackfield: 'Gun',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -5.0 },
      { role: '3', x: 3.2, y: -5.0 },
    ],
  },
  PISTOL: {
    hudlBackfield: 'Pistol',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -4.8 },
      { role: '3', x: 0, y: -7.8 },
    ],
  },
  UNDER_SINGLE: {
    hudlBackfield: 'Under',
    allowedPersonnel: [10, 11, 12, 32],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: 0, y: -5.4 },
    ],
  },
  I_OFFSET_R: {
    hudlBackfield: 'I Offset Right',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 2.4, y: -5.2 },
      { role: '3', x: 0, y: -8.0 },
    ],
  },
  I_OFFSET_L: {
    hudlBackfield: 'I Offset Left',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -2.4, y: -5.2 },
      { role: '3', x: 0, y: -8.0 },
    ],
  },
  MARYLAND_I: {
    hudlBackfield: 'Maryland I',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: 2.4, y: -8.0 },
    ],
  },
  WEAK_I: {
    hudlBackfield: 'Weak I',
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: 0, y: -5.4 },
      { role: '3', x: -2.4, y: -8.0 },
    ],
  },
  GUN_LEFT: {
    hudlBackfield: 'Gun Left',
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
    allowedPersonnel: [20, 21, 22],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '2', x: -3.2, y: -5.4 },
      { role: '3', x: 3.2, y: -5.4 },
    ],
  },
  QUEEN: {
    hudlBackfield: 'Queen',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: 3.0, y: -5.4 },
    ],
  },
  KING: {
    hudlBackfield: 'King',
    allowedPersonnel: [10, 11, 12],
    nodes: [
      { role: '1', x: 0, y: -2.6 },
      { role: '3', x: -3.0, y: -5.4 },
    ],
  },
  T_FORM: {
    hudlBackfield: 'T',
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
    hudlBackfield: 'Wing-T Left',
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
  { id: 'zone', label: 'Zone', conceptKey: '37_ZONE' },
  { id: 'power', label: 'Power', conceptKey: '38_POWER' },
  { id: 'counter', label: 'Counter', conceptKey: '38_COUNTER' },
  { id: 'dive', label: 'Dive', conceptKey: '34_DIVE' },
  { id: 'toss', label: 'Toss / Sweep', conceptKey: '31_TOSS' },
  { id: 'stretch', label: 'Stretch', conceptKey: '21_STRETCH' },
  { id: 'down', label: 'Down', conceptKey: '28_DOWN' },
  { id: 'iso', label: 'Iso', conceptKey: '34_ISO' },
  { id: 'trap', label: 'Trap', conceptKey: '32_TRAP' },
  { id: 'wedge', label: 'Wedge', conceptKey: 'CHECK_15_SNEAK' },
  { id: 'keep', label: 'QB Keep', conceptKey: '11_KEEP' },
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
  Hitch: { type: 'Pass', effect: 'Stop route at 5â€“6' },
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
  return /^(DE|DT|NT|SAM|WILL|MIKE|ROV|CB|FS|OLB|ILB|E\d|T\d)/i.test(role);
}

function nodes44(shift = 0): PlayNode[] {
  return [
    { role: 'E9', x: -6.8 + shift, y: 1.9 },
    { role: 'T3', x: -2.35 + shift * 0.25, y: 1.9 },
    { role: 'T1', x: 2.25, y: 1.9 },
    { role: 'E5', x: 6.7, y: 1.9 },
    { role: 'SAM', x: -11.2, y: 3.7 },
    { role: 'ROV', x: -8.1, y: 3.25 },
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

export function combinedNodes(baseKey: string, backfieldKey: string): PlayNode[] | null {
  const base = BASE_FORMATIONS[baseKey];
  const backfield = BACKFIELD_STRUCTURES[backfieldKey];
  if (!base || !backfield) return null;
  return withTackleOver([...INTERIOR_LINE_NODES, ...base.perimeterNodes, ...backfield.nodes], baseKey);
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

export function compatibleBackfields(baseKey: string) {
  const base = BASE_FORMATIONS[baseKey];
  const keys = Object.keys(BACKFIELD_STRUCTURES).filter((k) => isValidEleven(baseKey, k));
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
  tagKeys: string[] = []
): AssembledPlay {
  const base = BASE_FORMATIONS[baseKey];
  const backfield = BACKFIELD_STRUCTURES[backfieldKey];
  const concept = PLAY_CONCEPTS[conceptKey];
  if (!base || !backfield || !concept) {
    throw new Error('Invalid Base, Backfield, or Concept key passed to builder.');
  }
  const nodes = combinedNodes(baseKey, backfieldKey);
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
  tagKeys: string[] = []
): AssembledPlay | null {
  try {
    return assemblePlay(baseKey, backfieldKey, conceptKey, strength, tagKeys);
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
  points: { x: number; y: number }[];
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

  const rule = /counter/.test(blob)
    ? 'counter'
    : /power|iso|blast/.test(blob)
      ? 'power'
      : /toss|sweep|stretch/.test(blob)
        ? 'toss'
        : /zone/.test(blob)
          ? 'zone'
          : 'gap';

  const ol = ['LT', 'LG', 'C', 'RG', 'RT']
    .map((r) => nodes.find((n) => n.role === r))
    .filter((n): n is PlayNode => !!n);
  const puller = sign > 0 ? ol.find((n) => n.role === 'LG') : ol.find((n) => n.role === 'RG');

  if (family === 'run' || family === 'option') {
    for (const l of ol) {
      const onPlay = Math.sign(l.x - (nodes.find((n) => n.role === 'C')?.x ?? 0)) === sign || Math.abs(l.x) < 0.4;
      if ((rule === 'power' || rule === 'counter') && puller && l.role === puller.role) {
        add(line('block', [pt(l.x, l.y), pt(0, -1.15), pt(hx + sign * 1.3, -0.7), pt(hx + sign * 2.2, 0.85)]));
        continue;
      }
      if (rule === 'zone' || rule === 'toss') {
        add(line('block', [pt(l.x, l.y), pt(l.x + sign * (onPlay ? 1.15 : 0.45), 0.95)]));
      } else {
        add(line('block', [pt(l.x, l.y), pt(l.x - sign * (Math.abs(l.x) < 0.4 ? 0.15 : 0.7), 0.9)]));
      }
    }
    for (const te of nodes.filter((n) => n.line && ['Y', 'Y1', 'Y2'].includes(n.role) && n.role !== carrier?.role)) {
      const tePlay = Math.sign(te.x || sign) === sign;
      if (rule === 'toss' && tePlay) add(line('block', [pt(te.x, te.y), pt(te.x + sign * 1.6, 1.1)]));
      else if (rule === 'zone') add(line('block', [pt(te.x, te.y), pt(te.x + sign * 0.9, 0.95)]));
      else add(line('block', [pt(te.x, te.y), pt(te.x - sign * 0.35, 0.85)]));
    }
  }

  const lead = rule === 'power' || rule === 'gap' || /iso|dive|blast/.test(blob);
  if (fb && carrier && fb.role !== carrier.role && lead && (family === 'run' || family === 'option')) {
    add(line('block', [pt(fb.x, fb.y), pt(hx * 0.4, -0.3), pt(hx + sign * 0.4, 1.15)]));
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
    if (/counter/.test(blob)) {
      add(line('run', [pt(carrier.x, carrier.y), pt(carrier.x - sign * 2.4, carrier.y + 0.5), mesh, pt(-hx * 0.15, -0.15), atLos, through]));
    } else if (/zone/.test(blob)) {
      add(
        line('run', [
          pt(carrier.x, carrier.y),
          pt(carrier.x + sign * 2.6, carrier.y + 0.2),
          pt(hx + sign * 0.15, -0.05),
          pt(hx + sign * 0.55, 4.2),
        ])
      );
      if (tb && tb.role !== carrier.role) add(line('block', [pt(tb.x, tb.y), pt(tb.x - sign * 0.2, 0.2)]));
      if (wb && wb.role !== carrier.role && wb !== tb) add(line('block', [pt(wb.x, wb.y), pt(wb.x + sign * 0.4, 0.15)]));
    } else if (/toss|sweep|stretch/.test(blob)) {
      add(
        line('run', [
          pt(carrier.x, carrier.y),
          pt(carrier.x + sign * 2.1, carrier.y + 0.25),
          pt(hx * 0.62, -0.55),
          pt(hx, 0.45),
          through,
        ])
      );
    } else if (/draw/.test(blob)) {
      add(line('run', [pt(carrier.x, carrier.y), pt(carrier.x, carrier.y + 0.35), mesh, pt(hx, -0.45), through]));
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

export const FIELD_SVG = { w: 760, h: 520, losY: 292, scaleX: 17, scaleY: 12.2, originX: 380 };

export function fieldToSvg(x: number, y: number) {
  return { cx: FIELD_SVG.originX + x * FIELD_SVG.scaleX, cy: FIELD_SVG.losY - y * FIELD_SVG.scaleY };
}

export function svgToField(cx: number, cy: number) {
  return { x: (cx - FIELD_SVG.originX) / FIELD_SVG.scaleX, y: (FIELD_SVG.losY - cy) / FIELD_SVG.scaleY };
}

export function applyNodeOverrides(nodes: PlayNode[], overrides: Record<string, { x: number; y: number }>) {
  return nodes.map((n) => (overrides[n.role] ? { ...n, x: overrides[n.role].x, y: overrides[n.role].y } : n));
}

const STROKE_COLOR: Record<DrawKind, string> = { run: '#e11d2a', pass: '#2563eb', block: '#111827' };

function strokeSvg(strokes: PlayStroke[]) {
  return strokes
    .map((s) => {
      if (s.points.length < 2) return '';
      const d = s.points.map((p, i) => {
        const { cx, cy } = fieldToSvg(p.x, p.y);
        return `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`;
      }).join(' ');
      const last = s.points[s.points.length - 1];
      const prev = s.points[s.points.length - 2];
      const a = fieldToSvg(prev.x, prev.y);
      const b = fieldToSvg(last.x, last.y);
      const dash = s.kind === 'pass' ? ' stroke-dasharray="5 4"' : '';
      const width = s.kind === 'block' ? 2.4 : 2.6;
      const cap = s.kind === 'block' ? tBar(a.cx, a.cy, b.cx, b.cy, STROKE_COLOR[s.kind]) : `<polygon points="${arrowHead(a.cx, a.cy, b.cx, b.cy)}" fill="${STROKE_COLOR[s.kind]}" />`;
      return `<path d="${d}" fill="none" stroke="${STROKE_COLOR[s.kind]}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash}/>${cap}`;
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
  const { w, h, losY, originX, scaleX, scaleY } = FIELD_SVG;
  const yards = [
    { y: -20, n: '0' },
    { y: -10, n: '10' },
    { y: 0, n: '20' },
    { y: 10, n: '30' },
  ];
  const lines = yards
    .map(({ y, n }) => {
      const cy = losY - y * scaleY;
      const big = n === '20';
      return `<line x1="0" y1="${cy}" x2="${w}" y2="${cy}" stroke="${big ? '#3b82f6' : '#d4d4d8'}" stroke-width="${big ? 2 : 1}"/><text x="28" y="${cy - 6}" fill="#d4d4d8" font-size="28" font-family="system-ui" font-weight="800">${n}</text><text x="${w - 28}" y="${cy - 6}" text-anchor="end" fill="#d4d4d8" font-size="28" font-family="system-ui" font-weight="800">${n}</text>`;
    })
    .join('');
  const hashes = [-20, -10, 0, 10]
    .map((y) => {
      const cy = losY - y * scaleY;
      const left = originX - 3.4 * scaleX;
      const right = originX + 3.4 * scaleX;
      let ticks = '';
      for (let i = 0; i < 5; i++) {
        const yy = cy - i * (scaleY / 5);
        ticks += `<line x1="${left}" y1="${yy}" x2="${left + 8}" y2="${yy}" stroke="#a1a1aa" stroke-width="1"/><line x1="${right - 8}" y1="${yy}" x2="${right}" y2="${yy}" stroke="#a1a1aa" stroke-width="1"/>`;
      }
      return ticks;
    })
    .join('');
  return `<rect width="100%" height="100%" fill="#f4f4f5"/>${lines}${hashes}<line x1="0" y1="${losY}" x2="${w}" y2="${losY}" stroke="#2563eb" stroke-width="2"/>`;
}

export function playerGlyphSvg(n: PlayNode, ballRole?: string) {
  const { cx, cy } = fieldToSvg(n.x, n.y);
  const label = diagramLabel(n.role);
  if (isDefenseRole(n.role)) {
    return `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#3f3f46" font-size="13" font-family="system-ui" font-weight="700">${label}</text>`;
  }
  if (n.role === 'C') {
    return `<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" fill="#fff" stroke="#111827" stroke-width="1.6"/>`;
  }
  const skill = skillDiagramLabel(n.role);
  if (skill) {
    const isBall = ballRole != null && n.role === String(ballRole);
    const fill = isBall ? '#dc2626' : '#fff';
    const ink = isBall ? '#fff' : '#111827';
    return `<circle cx="${cx}" cy="${cy}" r="10" fill="${fill}" stroke="#111827" stroke-width="1.6"/><text x="${cx}" y="${cy + 3}" text-anchor="middle" fill="${ink}" font-size="8" font-family="system-ui" font-weight="800">${skill}</text>`;
  }
  if (n.line || !/^[1-4]$/.test(n.role)) {
    return `<circle cx="${cx}" cy="${cy}" r="7" fill="#fff" stroke="#111827" stroke-width="1.6"/>`;
  }
  const isBall = ballRole != null && n.role === String(ballRole);
  const fill = isBall ? '#dc2626' : '#fff';
  const ink = isBall ? '#fff' : '#111827';
  return `<circle cx="${cx}" cy="${cy}" r="9" fill="${fill}" stroke="#111827" stroke-width="1.6"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="${ink}" font-size="11" font-family="system-ui" font-weight="800">${label}</text>`;
}

export function holeMarksSvg(_nodes?: PlayNode[], _targetHole?: number | null) {
  return '';
}

export function diagramSvg(play: AssembledPlay, strokes: PlayStroke[] = [], extraNodes: PlayNode[] = [], ballRole?: string) {
  const { w, h } = FIELD_SVG;
  const dots = [...play.nodes, ...extraNodes].map((n) => playerGlyphSvg(n, ballRole)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${fieldBgSvg()}${strokeSvg(strokes)}${dots}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
