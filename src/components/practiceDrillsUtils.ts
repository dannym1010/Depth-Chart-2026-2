import {
  LiveDrillGroup,
  LiveDrillFormat,
  LiveDrillPosition,
  PlacedPlayer,
  RosterPlayer,
  FormationBoard,
} from '../types';
import { cleanTruncatedPosition } from '../utils/depthChartUtils';

// ============================================================================
// 1. TEAM COLORS SYSTEM
// ============================================================================
export interface TeamColorConfig {
  id: string;
  label: string;
  hex: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  bgLightClass: string;
  ringClass: string;
  headerGrad: string;
  chipBg: string;
  chipText: string;
  printBorder: string;
}

export const TEAM_COLOR_OPTIONS: TeamColorConfig[] = [
  {
    id: 'gold',
    label: 'Gold / Yellow',
    hex: '#f59e0b',
    badgeBg: 'bg-amber-400',
    badgeText: 'text-slate-950',
    borderClass: 'border-amber-400 dark:border-amber-500/70',
    bgLightClass: 'bg-amber-500/10 dark:bg-amber-500/15',
    ringClass: 'ring-amber-400',
    headerGrad: 'from-amber-500/20 to-amber-500/5',
    chipBg: 'bg-amber-500',
    chipText: 'text-slate-950 font-black',
    printBorder: 'border-amber-500',
  },
  {
    id: 'blue',
    label: 'Royal Blue',
    hex: '#2563eb',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    borderClass: 'border-blue-500 dark:border-blue-500/70',
    bgLightClass: 'bg-blue-500/10 dark:bg-blue-500/15',
    ringClass: 'ring-blue-500',
    headerGrad: 'from-blue-600/20 to-blue-600/5',
    chipBg: 'bg-blue-600',
    chipText: 'text-white font-black',
    printBorder: 'border-blue-600',
  },
  {
    id: 'navy',
    label: 'Navy Blue',
    hex: '#1e1b4b',
    badgeBg: 'bg-indigo-950',
    badgeText: 'text-white border border-indigo-700',
    borderClass: 'border-indigo-800 dark:border-indigo-600/70',
    bgLightClass: 'bg-indigo-900/15 dark:bg-indigo-900/25',
    ringClass: 'ring-indigo-600',
    headerGrad: 'from-indigo-900/30 to-indigo-900/10',
    chipBg: 'bg-indigo-900',
    chipText: 'text-white font-black',
    printBorder: 'border-indigo-900',
  },
  {
    id: 'red',
    label: 'Cardinal / Red',
    hex: '#e11d48',
    badgeBg: 'bg-rose-600',
    badgeText: 'text-white',
    borderClass: 'border-rose-500 dark:border-rose-500/70',
    bgLightClass: 'bg-rose-500/10 dark:bg-rose-500/15',
    ringClass: 'ring-rose-500',
    headerGrad: 'from-rose-600/20 to-rose-600/5',
    chipBg: 'bg-rose-600',
    chipText: 'text-white font-black',
    printBorder: 'border-rose-600',
  },
  {
    id: 'green',
    label: 'Kelly / Forest Green',
    hex: '#059669',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    borderClass: 'border-emerald-500 dark:border-emerald-500/70',
    bgLightClass: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    ringClass: 'ring-emerald-500',
    headerGrad: 'from-emerald-600/20 to-emerald-600/5',
    chipBg: 'bg-emerald-600',
    chipText: 'text-white font-black',
    printBorder: 'border-emerald-600',
  },
  {
    id: 'black',
    label: 'Black / Stealth',
    hex: '#0f172a',
    badgeBg: 'bg-slate-950',
    badgeText: 'text-white border border-slate-700',
    borderClass: 'border-slate-800 dark:border-slate-600',
    bgLightClass: 'bg-slate-900/10 dark:bg-slate-800/50',
    ringClass: 'ring-slate-400',
    headerGrad: 'from-slate-900/30 to-slate-900/10',
    chipBg: 'bg-slate-900',
    chipText: 'text-white font-black',
    printBorder: 'border-slate-900',
  },
  {
    id: 'white',
    label: 'White / Silver',
    hex: '#f1f5f9',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-900 border border-slate-300',
    borderClass: 'border-slate-300 dark:border-slate-600',
    bgLightClass: 'bg-slate-100/80 dark:bg-slate-800/40',
    ringClass: 'ring-slate-300',
    headerGrad: 'from-slate-200/50 to-slate-100/20',
    chipBg: 'bg-slate-200 dark:bg-slate-700',
    chipText: 'text-slate-900 dark:text-white font-black',
    printBorder: 'border-slate-400',
  },
  {
    id: 'orange',
    label: 'Orange / Blaze',
    hex: '#ea580c',
    badgeBg: 'bg-orange-500',
    badgeText: 'text-white',
    borderClass: 'border-orange-500 dark:border-orange-500/70',
    bgLightClass: 'bg-orange-500/10 dark:bg-orange-500/15',
    ringClass: 'ring-orange-500',
    headerGrad: 'from-orange-500/20 to-orange-500/5',
    chipBg: 'bg-orange-500',
    chipText: 'text-white font-black',
    printBorder: 'border-orange-500',
  },
  {
    id: 'purple',
    label: 'Purple',
    hex: '#9333ea',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    borderClass: 'border-purple-500 dark:border-purple-500/70',
    bgLightClass: 'bg-purple-500/10 dark:bg-purple-500/15',
    ringClass: 'ring-purple-500',
    headerGrad: 'from-purple-600/20 to-purple-600/5',
    chipBg: 'bg-purple-600',
    chipText: 'text-white font-black',
    printBorder: 'border-purple-600',
  },
  {
    id: 'cyan',
    label: 'Teal / Aqua',
    hex: '#0891b2',
    badgeBg: 'bg-cyan-600',
    badgeText: 'text-white',
    borderClass: 'border-cyan-500 dark:border-cyan-500/70',
    bgLightClass: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    ringClass: 'ring-cyan-500',
    headerGrad: 'from-cyan-600/20 to-cyan-600/5',
    chipBg: 'bg-cyan-600',
    chipText: 'text-white font-black',
    printBorder: 'border-cyan-600',
  },
  {
    id: 'maroon',
    label: 'Maroon / Crimson',
    hex: '#881337',
    badgeBg: 'bg-rose-900',
    badgeText: 'text-white',
    borderClass: 'border-rose-900 dark:border-rose-800',
    bgLightClass: 'bg-rose-900/15 dark:bg-rose-900/25',
    ringClass: 'ring-rose-800',
    headerGrad: 'from-rose-950/30 to-rose-900/10',
    chipBg: 'bg-rose-900',
    chipText: 'text-white font-black',
    printBorder: 'border-rose-900',
  },
  {
    id: 'charcoal',
    label: 'Charcoal / Steel',
    hex: '#334155',
    badgeBg: 'bg-slate-700',
    badgeText: 'text-white',
    borderClass: 'border-slate-600 dark:border-slate-500',
    bgLightClass: 'bg-slate-700/15 dark:bg-slate-700/25',
    ringClass: 'ring-slate-500',
    headerGrad: 'from-slate-700/20 to-slate-700/5',
    chipBg: 'bg-slate-700',
    chipText: 'text-white font-black',
    printBorder: 'border-slate-700',
  },
];

export const TEAM_COLOR_MAP: Record<string, TeamColorConfig> = TEAM_COLOR_OPTIONS.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<string, TeamColorConfig>
);

export function getTeamColorConfig(colorId?: string, fallback: 'gold' | 'blue' = 'gold'): TeamColorConfig {
  if (!colorId) {
    return TEAM_COLOR_MAP[fallback] || TEAM_COLOR_OPTIONS[0];
  }

  // Known preset
  if (TEAM_COLOR_MAP[colorId]) {
    return TEAM_COLOR_MAP[colorId];
  }

  // Support arbitrary custom HEX color codes (e.g. "#8b0000", "#ff6600")
  if (colorId.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(colorId)) {
    const rawHex = colorId.startsWith('#') ? colorId : `#${colorId}`;
    const cleanHex = rawHex.replace('#', '');
    let r = 0;
    let g = 0;
    let b = 0;
    if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16) || 0;
      g = parseInt(cleanHex.substring(2, 4), 16) || 0;
      b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    } else if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16) || 0;
      g = parseInt(cleanHex[1] + cleanHex[1], 16) || 0;
      b = parseInt(cleanHex[2] + cleanHex[2], 16) || 0;
    }
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    const isLight = yiq >= 150;

    return {
      id: rawHex,
      label: rawHex.toUpperCase(),
      hex: rawHex,
      badgeBg: 'bg-slate-800',
      badgeText: isLight ? 'text-slate-950 font-black' : 'text-white font-black',
      borderClass: 'border-slate-300 dark:border-slate-650',
      bgLightClass: 'bg-slate-100/60 dark:bg-slate-800/40',
      ringClass: 'ring-slate-400',
      headerGrad: 'from-slate-500/20 to-slate-500/5',
      chipBg: 'bg-slate-800',
      chipText: isLight ? 'text-slate-950 font-black' : 'text-white font-black',
      printBorder: 'border-slate-800',
    };
  }

  return TEAM_COLOR_MAP[fallback] || TEAM_COLOR_OPTIONS[0];
}

// Preset color matchups
export const COLOR_MATCHUP_PRESETS = [
  { label: 'Gold vs Blue', offense: 'gold', defense: 'blue' },
  { label: 'White vs Blue', offense: 'white', defense: 'blue' },
  { label: 'Red vs White', offense: 'red', defense: 'white' },
  { label: 'Black vs Gold', offense: 'black', defense: 'gold' },
  { label: 'Green vs White', offense: 'green', defense: 'white' },
  { label: 'Navy vs Orange', offense: 'navy', defense: 'orange' },
];

// ============================================================================
// 2. DEFAULT GROUP LABELS (Clean, customizable, no hardcoded colors)
// ============================================================================
export const DEFAULT_OFFENSE_LABELS: string[] = [
  '1st Team Offense',
  '2nd Team Offense',
  'Varsity Offense',
  'JV Offense',
  'Scout Offense',
  'Red Zone Offense',
];

export const DEFAULT_DEFENSE_LABELS: string[] = [
  '1st Team Defense',
  '2nd Team Defense',
  'Varsity Defense',
  'JV Defense',
  'Scout Defense',
  'Goal Line Defense',
];

// Backward-compatibility aliases
export const OFFENSE_LABEL_PRESETS = DEFAULT_OFFENSE_LABELS;
export const DEFENSE_LABEL_PRESETS = DEFAULT_DEFENSE_LABELS;

// Suggested position buttons for adding slots
export const SUGGESTED_OFFENSE_TAGS = [
  'QB', 'RB', 'FB', 'WR (X)', 'WR (Z)', 'Slot (W)', 'H / Slot', 'TE (Y)',
  'LT', 'LG', 'C', 'RG', 'RT', 'TE 2', 'WR 3', 'Wing',
];

export const SUGGESTED_DEFENSE_TAGS = [
  'CB1', 'CB2', 'FS', 'SS', 'MLB', 'WLB', 'SLB', 'Nickel / DB',
  'LDE', 'LDT', 'RDT', 'RDE', 'NT', 'Rover', 'Edge', 'Dime DB',
];

// ============================================================================
// 3. DEFAULT DRILL POSITIONS GENERATOR
// ============================================================================
export function generateDefaultPositions(format: LiveDrillFormat): {
  offense: LiveDrillPosition[];
  defense: LiveDrillPosition[];
} {
  const ts = Date.now();
  if (format === '7v7') {
    return {
      offense: [
        { id: `off_qb_${ts}`, name: 'QB', unit: 'offense' },
        { id: `off_rb_${ts}`, name: 'RB', unit: 'offense' },
        { id: `off_x_${ts}`, name: 'WR (X)', unit: 'offense' },
        { id: `off_z_${ts}`, name: 'WR (Z)', unit: 'offense' },
        { id: `off_w_${ts}`, name: 'Slot (W)', unit: 'offense' },
        { id: `off_y_${ts}`, name: 'TE (Y)', unit: 'offense' },
        { id: `off_h_${ts}`, name: 'H / Slot', unit: 'offense' },
      ],
      defense: [
        { id: `def_cb1_${ts}`, name: 'CB1', unit: 'defense' },
        { id: `def_cb2_${ts}`, name: 'CB2', unit: 'defense' },
        { id: `def_fs_${ts}`, name: 'FS', unit: 'defense' },
        { id: `def_ss_${ts}`, name: 'SS', unit: 'defense' },
        { id: `def_mlb_${ts}`, name: 'MLB', unit: 'defense' },
        { id: `def_wlb_${ts}`, name: 'WLB', unit: 'defense' },
        { id: `def_slb_${ts}`, name: 'SLB / Nickel', unit: 'defense' },
      ],
    };
  }

  if (format === '11v11') {
    return {
      offense: [
        { id: `off_lt_${ts}`, name: 'LT', unit: 'offense' },
        { id: `off_lg_${ts}`, name: 'LG', unit: 'offense' },
        { id: `off_c_${ts}`, name: 'C', unit: 'offense' },
        { id: `off_rg_${ts}`, name: 'RG', unit: 'offense' },
        { id: `off_rt_${ts}`, name: 'RT', unit: 'offense' },
        { id: `off_te_${ts}`, name: 'TE (Y)', unit: 'offense' },
        { id: `off_qb_${ts}`, name: 'QB', unit: 'offense' },
        { id: `off_rb_${ts}`, name: 'RB', unit: 'offense' },
        { id: `off_x_${ts}`, name: 'WR (X)', unit: 'offense' },
        { id: `off_z_${ts}`, name: 'WR (Z)', unit: 'offense' },
        { id: `off_w_${ts}`, name: 'Slot (W)', unit: 'offense' },
      ],
      defense: [
        { id: `def_lde_${ts}`, name: 'LDE', unit: 'defense' },
        { id: `def_ldt_${ts}`, name: 'LDT', unit: 'defense' },
        { id: `def_rdt_${ts}`, name: 'RDT', unit: 'defense' },
        { id: `def_rde_${ts}`, name: 'RDE', unit: 'defense' },
        { id: `def_wlb_${ts}`, name: 'WLB', unit: 'defense' },
        { id: `def_mlb_${ts}`, name: 'MLB', unit: 'defense' },
        { id: `def_slb_${ts}`, name: 'SLB', unit: 'defense' },
        { id: `def_cb1_${ts}`, name: 'CB1', unit: 'defense' },
        { id: `def_cb2_${ts}`, name: 'CB2', unit: 'defense' },
        { id: `def_fs_${ts}`, name: 'FS', unit: 'defense' },
        { id: `def_ss_${ts}`, name: 'SS', unit: 'defense' },
      ],
    };
  }

  if (format === '9v9') {
    return {
      offense: [
        { id: `off_lt_${ts}`, name: 'LT', unit: 'offense' },
        { id: `off_lg_${ts}`, name: 'LG', unit: 'offense' },
        { id: `off_c_${ts}`, name: 'C', unit: 'offense' },
        { id: `off_rg_${ts}`, name: 'RG', unit: 'offense' },
        { id: `off_rt_${ts}`, name: 'RT', unit: 'offense' },
        { id: `off_te_${ts}`, name: 'TE (Y)', unit: 'offense' },
        { id: `off_qb_${ts}`, name: 'QB', unit: 'offense' },
        { id: `off_fb_${ts}`, name: 'FB', unit: 'offense' },
        { id: `off_rb_${ts}`, name: 'RB', unit: 'offense' },
      ],
      defense: [
        { id: `def_lde_${ts}`, name: 'LDE', unit: 'defense' },
        { id: `def_ldt_${ts}`, name: 'LDT', unit: 'defense' },
        { id: `def_rdt_${ts}`, name: 'RDT', unit: 'defense' },
        { id: `def_rde_${ts}`, name: 'RDE', unit: 'defense' },
        { id: `def_wlb_${ts}`, name: 'WLB', unit: 'defense' },
        { id: `def_mlb_${ts}`, name: 'MLB', unit: 'defense' },
        { id: `def_slb_${ts}`, name: 'SLB', unit: 'defense' },
        { id: `def_fs_${ts}`, name: 'FS', unit: 'defense' },
        { id: `def_ss_${ts}`, name: 'SS', unit: 'defense' },
      ],
    };
  }

  if (format === '1v1') {
    return {
      offense: [
        { id: `off_wr1_${ts}`, name: 'WR 1', unit: 'offense' },
        { id: `off_wr2_${ts}`, name: 'WR 2', unit: 'offense' },
        { id: `off_wr3_${ts}`, name: 'WR 3', unit: 'offense' },
        { id: `off_te1_${ts}`, name: 'TE (Y)', unit: 'offense' },
      ],
      defense: [
        { id: `def_cb1_${ts}`, name: 'CB 1', unit: 'defense' },
        { id: `def_cb2_${ts}`, name: 'CB 2', unit: 'defense' },
        { id: `def_nb1_${ts}`, name: 'Nickel / DB', unit: 'defense' },
        { id: `def_s1_${ts}`, name: 'Safety', unit: 'defense' },
      ],
    };
  }

  // Custom default (5v5 Trenches / Linemen)
  return {
    offense: [
      { id: `off_lt_${ts}`, name: 'LT', unit: 'offense' },
      { id: `off_lg_${ts}`, name: 'LG', unit: 'offense' },
      { id: `off_c_${ts}`, name: 'C', unit: 'offense' },
      { id: `off_rg_${ts}`, name: 'RG', unit: 'offense' },
      { id: `off_rt_${ts}`, name: 'RT', unit: 'offense' },
    ],
    defense: [
      { id: `def_lde_${ts}`, name: 'LDE', unit: 'defense' },
      { id: `def_ldt_${ts}`, name: 'LDT', unit: 'defense' },
      { id: `def_nt_${ts}`, name: 'NT', unit: 'defense' },
      { id: `def_rdt_${ts}`, name: 'RDT', unit: 'defense' },
      { id: `def_rde_${ts}`, name: 'RDE', unit: 'defense' },
    ],
  };
}

export function createInitialPracticeDrillGroups(): LiveDrillGroup[] {
  const g7 = generateDefaultPositions('7v7');
  const g11 = generateDefaultPositions('11v11');

  return [
    {
      id: `live_group_7v7_${Date.now()}`,
      name: 'Period 4: 7v7 Pass Skeleton',
      format: '7v7',
      offenseLabel: '1st Team Offense',
      defenseLabel: '1st Team Defense',
      offenseColor: 'gold',
      defenseColor: 'blue',
      notes: 'Focus on 3-step & 5-step pass drops. Defense in Cover 3 match.',
      offensePositions: g7.offense,
      defensePositions: g7.defense,
      lineup: {},
      createdAt: Date.now(),
    },
    {
      id: `live_group_11v11_${Date.now() + 1}`,
      name: 'Period 6: 11v11 Team Live',
      format: '11v11',
      offenseLabel: 'Varsity Offense',
      defenseLabel: 'Varsity Defense',
      offenseColor: 'gold',
      defenseColor: 'blue',
      notes: 'Full team live 11v11 script with offensive & defensive rotations.',
      offensePositions: g11.offense,
      defensePositions: g11.defense,
      lineup: {},
      createdAt: Date.now() + 1,
    },
  ];
}

// ============================================================================
// 4. SMART POSITION MATCHING & AUTO-FILL ENGINE
// ============================================================================

/**
 * Normalizes text for position comparisons (lowercased, alphanumeric only)
 */
export function normalizePositionToken(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type PositionCategory =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'DL'
  | 'LB'
  | 'DB'
  | 'ST'
  | 'ATH';

export interface PositionClassification {
  category: PositionCategory;
  subRole: string;
  isSpecialized: boolean; // QB, K, P, LS are strictly specialized
}

/**
 * Classifies any raw football position name into standard category and sub-role
 */
export function getPositionCategory(rawName: string): PositionClassification {
  const clean = cleanTruncatedPosition(rawName).toUpperCase();
  const token = normalizePositionToken(rawName);

  // 1. Quarterback - STRICT: only actual QB
  if (
    clean === 'QB' ||
    token === 'qb' ||
    token === '1qb' ||
    token.includes('quarterback') ||
    token === 'passer' ||
    token === '1' ||
    token === 'grpqb'
  ) {
    return { category: 'QB', subRole: 'QB', isSpecialized: true };
  }

  // 2. Running Back / Fullback / Halfback
  if (
    clean === 'RB' ||
    clean === 'FB' ||
    clean === 'HB' ||
    token === 'rb' ||
    token === 'fb' ||
    token === 'hb' ||
    token.includes('halfback') ||
    token.includes('tailback') ||
    token.includes('fullback') ||
    token.includes('runningback') ||
    token === '4rb' ||
    token === '2fb' ||
    token === '3hb'
  ) {
    const isFB = clean === 'FB' || token.includes('fb') || token.includes('fullback');
    return { category: 'RB', subRole: isFB ? 'FB' : 'RB', isSpecialized: false };
  }

  // 3. Wide Receiver / Slot / Flanker / Split End
  if (
    clean === 'WR' ||
    clean === 'X' ||
    clean === 'Z' ||
    clean === 'W' ||
    clean === 'H' ||
    token.startsWith('wr') ||
    token.includes('wideout') ||
    token.includes('receiver') ||
    token.includes('splitend') ||
    token.includes('flanker') ||
    token.includes('slot')
  ) {
    let sub = 'WR';
    if (clean === 'X' || token.includes('x')) sub = 'X';
    else if (clean === 'Z' || token.includes('z')) sub = 'Z';
    else if (clean === 'W' || token.includes('slot') || token.includes('w') || clean === 'H') sub = 'SLOT';
    return { category: 'WR', subRole: sub, isSpecialized: false };
  }

  // 4. Tight End
  if (
    clean === 'TE' ||
    clean === 'Y' ||
    token === 'te' ||
    token === 'y' ||
    token === 'y1' ||
    token === 'y2' ||
    token.includes('tightend')
  ) {
    return { category: 'TE', subRole: 'TE', isSpecialized: false };
  }

  // 5. Offensive Line (LT, LG, C, RG, RT, OL)
  if (
    clean === 'LT' ||
    clean === 'LG' ||
    clean === 'C' ||
    clean === 'RG' ||
    clean === 'RT' ||
    clean === 'OL' ||
    token.includes('tackle') ||
    token.includes('guard') ||
    token.includes('center') ||
    token === 'lt' ||
    token === 'lg' ||
    token === 'c' ||
    token === 'rg' ||
    token === 'rt' ||
    token === 'ol' ||
    token === 'ot' ||
    token === 'og' ||
    token === 'ot1' ||
    token === 'ot2' ||
    token === 'og1' ||
    token === 'og2' ||
    token.includes('lineman')
  ) {
    let sub = 'OL';
    if (clean === 'C' || token === 'c' || token.includes('center')) sub = 'C';
    else if (clean === 'LT' || token === 'lt' || token.includes('lefttackle') || token === 'ot1') sub = 'LT';
    else if (clean === 'LG' || token === 'lg' || token.includes('leftguard') || token === 'og1') sub = 'LG';
    else if (clean === 'RG' || token === 'rg' || token.includes('rightguard') || token === 'og2') sub = 'RG';
    else if (clean === 'RT' || token === 'rt' || token.includes('righttackle') || token === 'ot2') sub = 'RT';
    return { category: 'OL', subRole: sub, isSpecialized: false };
  }

  // 6. Defensive Line (LDE, RDE, DE, LDT, RDT, DT, NT, DL)
  if (
    clean === 'DE' ||
    clean === 'DT' ||
    clean === 'NT' ||
    clean === 'DL' ||
    token.includes('defensiveend') ||
    token.includes('defensivetackle') ||
    token.includes('nosetackle') ||
    token.includes('nose') ||
    token.includes('edge') ||
    token.startsWith('de') ||
    token.startsWith('dt') ||
    token === 'lde' ||
    token === 'rde' ||
    token === 'ldt' ||
    token === 'rdt' ||
    token === 'nt' ||
    token === 'dl'
  ) {
    let sub = 'DL';
    if (clean === 'NT' || token.includes('nt') || token.includes('nose')) sub = 'NT';
    else if (clean === 'DT' || token.includes('dt') || token === 'ldt' || token === 'rdt') sub = 'DT';
    else if (clean === 'DE' || token.includes('de') || token.includes('edge') || token === 'lde' || token === 'rde') sub = 'DE';
    return { category: 'DL', subRole: sub, isSpecialized: false };
  }

  // 7. Linebacker (MLB, WLB, SLB, LB, ILB, OLB)
  if (
    clean === 'MLB' ||
    clean === 'WLB' ||
    clean === 'SLB' ||
    clean === 'LB' ||
    clean === 'ILB' ||
    clean === 'OLB' ||
    token.includes('linebacker') ||
    token.includes('mike') ||
    token.includes('will') ||
    token.includes('sam') ||
    token.includes('rover') ||
    token.endsWith('lb') ||
    token === 'lb' ||
    token === 'mlb' ||
    token === 'wlb' ||
    token === 'slb' ||
    token === 'ilb' ||
    token === 'olb'
  ) {
    let sub = 'LB';
    if (clean === 'MLB' || token.includes('mike') || token === 'mlb' || token === 'ilb') sub = 'MLB';
    else if (clean === 'WLB' || token.includes('will') || token === 'wlb') sub = 'WLB';
    else if (clean === 'SLB' || token.includes('sam') || token.includes('rover') || token === 'slb') sub = 'SLB';
    return { category: 'LB', subRole: sub, isSpecialized: false };
  }

  // 8. Defensive Back (CB, FS, SS, S, Nickel, DB)
  if (
    clean === 'CB' ||
    clean === 'FS' ||
    clean === 'SS' ||
    clean === 'S' ||
    clean === 'DB' ||
    token.includes('corner') ||
    token.includes('safety') ||
    token.includes('nickel') ||
    token.includes('defensiveback') ||
    token.startsWith('cb') ||
    token === 'fs' ||
    token === 'ss' ||
    token === 's' ||
    token === 'db' ||
    token === 'nb'
  ) {
    let sub = 'DB';
    if (token.startsWith('cb') || token.includes('corner') || clean === 'CB') sub = 'CB';
    else if (token === 'fs' || token.includes('free') || clean === 'FS') sub = 'FS';
    else if (token === 'ss' || token.includes('strong') || clean === 'SS') sub = 'SS';
    else if (token.includes('nickel') || token === 'nb') sub = 'NICKEL';
    return { category: 'DB', subRole: sub, isSpecialized: false };
  }

  // 9. Special Teams (K, P, LS)
  if (clean === 'K' || clean === 'P' || clean === 'LS' || token === 'k' || token === 'p' || token === 'ls') {
    return { category: 'ST', subRole: clean, isSpecialized: true };
  }

  return { category: 'ATH', subRole: 'ATH', isSpecialized: false };
}

/**
 * Checks if target position name matches a candidate position name or ID
 */
export function isPositionMatch(targetName: string, candidateName: string, candidateId: string = ''): boolean {
  if (isExactPositionSlotMatch(targetName, candidateName, candidateId)) {
    return true;
  }

  const tClass = getPositionCategory(targetName);
  const cClass = getPositionCategory(candidateName || candidateId);

  // Strict QB separation
  if (tClass.category === 'QB' || cClass.category === 'QB') {
    return tClass.category === 'QB' && cClass.category === 'QB';
  }

  if (tClass.category === cClass.category) {
    return true;
  }

  // Secondary flex overlaps (WR/TE flex)
  if (tClass.category === 'WR' && cClass.category === 'TE') return true;
  if (tClass.category === 'TE' && cClass.category === 'WR') return true;

  return false;
}

/**
 * Checks if drill position strictly matches the formation position slot
 * e.g. QB <-> 1 (QB), LT <-> LT, C <-> C, MLB <-> MIKE/MLB, etc.
 */
export function isExactPositionSlotMatch(drillPosName: string, formPosName: string, formPosId: string = ''): boolean {
  const dClean = cleanTruncatedPosition(drillPosName).toUpperCase();
  const fClean = cleanTruncatedPosition(formPosName).toUpperCase();
  const dToken = normalizePositionToken(drillPosName);
  const fToken = normalizePositionToken(formPosName);
  const idToken = normalizePositionToken(formPosId);

  // Direct clean or token match
  if (dClean === fClean && dClean.length > 0) return true;
  if (dToken === fToken && dToken.length > 0) return true;

  // 1. Quarterback: strict QB slot mapping
  const isDQB = dClean === 'QB' || dToken === 'qb' || dToken === '1' || dToken === '1qb' || dToken.includes('quarterback') || dToken === 'passer';
  const isFQB = fClean === 'QB' || fToken === 'qb' || fToken === '1' || fToken === '1qb' || fToken.includes('quarterback') || idToken.includes('qb') || idToken.endsWith('-1');
  if (isDQB || isFQB) return isDQB && isFQB;

  // 2. Running Back / Tailback
  const isDRB = dClean === 'RB' || dToken === 'rb' || dToken === '4' || dToken === '4rb' || dToken === 'tb' || dToken === '3tb' || dToken === 'hb' || dToken.includes('runningback') || dToken.includes('halfback') || dToken.includes('tailback');
  const isFRB = fClean === 'RB' || fToken === 'rb' || fToken === '4' || fToken === '4rb' || fToken === 'tb' || fToken === '3tb' || fToken === 'hb' || fToken.includes('runningback') || fToken.includes('halfback') || fToken.includes('tailback') || idToken.includes('rb') || idToken.endsWith('-4');
  if (isDRB || isFRB) return isDRB && isFRB;

  // 3. Fullback
  const isDFB = dClean === 'FB' || dToken === 'fb' || dToken === '2' || dToken === '2fb' || dToken.includes('fullback');
  const isFFB = fClean === 'FB' || fToken === 'fb' || fToken === '2' || fToken === '2fb' || fToken.includes('fullback') || idToken.includes('fb') || idToken.endsWith('-2');
  if (isDFB || isFFB) return isDFB && isFFB;

  // 4. Center
  const isDC = dClean === 'C' || dToken === 'c' || dToken.includes('center');
  const isFC = fClean === 'C' || fToken === 'c' || fToken.includes('center') || idToken.endsWith('-c') || idToken.includes('-c-');
  if (isDC || isFC) return isDC && isFC;

  // 5. Left Tackle
  const isDLT = dClean === 'LT' || dToken === 'lt' || dToken.includes('lefttackle');
  const isFLT = fClean === 'LT' || fToken === 'lt' || fToken.includes('lefttackle') || idToken.includes('lt');
  if (isDLT || isFLT) return isDLT && isFLT;

  // 6. Left Guard
  const isDLG = dClean === 'LG' || dToken === 'lg' || dToken.includes('leftguard');
  const isFLG = fClean === 'LG' || fToken === 'lg' || fToken.includes('leftguard') || idToken.includes('lg');
  if (isDLG || isFLG) return isDLG && isFLG;

  // 7. Right Guard
  const isDRG = dClean === 'RG' || dToken === 'rg' || dToken.includes('rightguard');
  const isFRG = fClean === 'RG' || fToken === 'rg' || fToken.includes('rightguard') || idToken.includes('rg');
  if (isDRG || isFRG) return isDRG && isFRG;

  // 8. Right Tackle
  const isDRT = dClean === 'RT' || dToken === 'rt' || dToken.includes('righttackle');
  const isFRT = fClean === 'RT' || fToken === 'rt' || fToken.includes('righttackle') || idToken.includes('rt');
  if (isDRT || isFRT) return isDRT && isFRT;

  // 9. Tight End (TE, Y, Y1, Y2)
  const isDTE = dClean === 'TE' || dClean === 'Y' || dClean === 'Y1' || dToken.includes('te') || dToken === 'y' || dToken === 'y1' || dToken === 'tey' || dToken.includes('tightend');
  const isFTE = fClean === 'TE' || fClean === 'Y' || fClean === 'Y1' || fToken.includes('te') || fToken === 'y' || fToken === 'y1' || fToken === 'tey' || fToken.includes('tightend') || idToken.includes('y1') || idToken.includes('-y-') || idToken.includes('te');
  if (isDTE || isFTE) return isDTE && isFTE;

  // 10. Wide Receiver X (Split End)
  const isDX = dClean === 'X' || dToken === 'x' || dToken === 'wrx' || dToken === 'wr1' || dToken.includes('splitend');
  const isFX = fClean === 'X' || fToken === 'x' || fToken === 'wrx' || fToken === 'wr1' || fToken.includes('splitend') || idToken.endsWith('-x') || idToken.includes('-x-');
  if (isDX || isFX) return isDX && isFX;

  // 11. Wide Receiver Z (Flanker)
  const isDZ = dClean === 'Z' || dToken === 'z' || dToken === 'wrz' || dToken === 'wr2' || dToken.includes('flanker');
  const isFZ = fClean === 'Z' || fToken === 'z' || fToken === 'wrz' || fToken === 'wr2' || fToken.includes('flanker') || idToken.endsWith('-z') || idToken.includes('-z-');
  if (isDZ || isFZ) return isDZ && isFZ;

  // 12. Slot Receiver W (Slot / H)
  const isDW = dClean === 'W' || dToken === 'w' || dToken.includes('slot') || dToken === 'wr3' || dToken.includes('hslot');
  const isFW = fClean === 'W' || fToken === 'w' || fToken.includes('slot') || fToken === 'wr3' || fToken.includes('hslot') || idToken.endsWith('-w') || idToken.includes('-w-');
  if (isDW || isFW) return isDW && isFW;

  // 13. Defensive End 1 / Left DE
  const isFLDE = fClean === 'LDE' || fClean === 'DE 1' || fClean === 'DE1' || fToken === 'lde' || fToken === 'de1' || fToken.includes('leftend') || idToken.includes('de1') || idToken.includes('lde');
  if (dToken === 'lde' || dToken === 'de1' || dClean === 'DE1') {
    if (isFLDE) return true;
  }

  // 14. Defensive End 2 / Right DE
  const isFRDE = fClean === 'RDE' || fClean === 'DE 2' || fClean === 'DE2' || fToken === 'rde' || fToken === 'de2' || fToken.includes('rightend') || idToken.includes('de2') || idToken.includes('rde');
  if (dToken === 'rde' || dToken === 'de2' || dClean === 'DE2') {
    if (isFRDE) return true;
  }

  // General Defensive End match if not split into LDE/RDE
  if (dClean === 'DE' || dToken === 'de') {
    const isFDE = fClean.startsWith('DE') || fToken.startsWith('de') || idToken.includes('de');
    if (isFDE) return true;
  }

  // 15. Defensive Tackle 1 / Left DT
  const isFLDT = fClean === 'LDT' || fClean === 'DT 1' || fClean === 'DT1' || fToken === 'ldt' || fToken === 'dt1' || idToken.includes('dt1') || idToken.includes('ldt') || fToken === 't3';
  if (dToken === 'ldt' || dToken === 'dt1' || dClean === 'DT1') {
    if (isFLDT) return true;
  }

  // 16. Nose Tackle / Nose Guard
  const isDNT = dClean === 'NT' || dToken === 'nt' || dToken.includes('nose');
  const isFNT = fClean === 'NT' || fToken === 'nt' || fToken.includes('nose') || idToken.includes('nt') || fToken === 'n0';
  if (isDNT || isFNT) return isDNT && isFNT;

  // 17. Defensive Tackle 2 / Right DT
  const isFRDT = fClean === 'RDT' || fClean === 'DT 2' || fClean === 'DT2' || fToken === 'rdt' || fToken === 'dt2' || idToken.includes('dt2') || idToken.includes('rdt');
  if (dToken === 'rdt' || dToken === 'dt2' || dClean === 'DT2') {
    if (isFRDT) return true;
  }

  // General Defensive Tackle
  if (dClean === 'DT' || dToken === 'dt') {
    const isFDT = fClean.startsWith('DT') || fToken.startsWith('dt') || idToken.includes('dt');
    if (isFDT) return true;
  }

  // 18. Will Linebacker (WLB / WILL)
  const isDWLB = dClean === 'WLB' || dToken === 'wlb' || dToken.includes('will');
  const isFWLB = fClean === 'WLB' || fClean === 'WILL' || fToken === 'wlb' || fToken.includes('will') || idToken.includes('will') || idToken.includes('wlb');
  if (isDWLB || isFWLB) return isDWLB && isFWLB;

  // 19. Mike Linebacker (MLB / MIKE)
  const isDMLB = dClean === 'MLB' || dToken === 'mlb' || dToken.includes('mike') || dToken === 'ilb';
  const isFMLB = fClean === 'MLB' || fClean === 'MIKE' || fToken === 'mlb' || fToken.includes('mike') || fToken === 'ilb' || idToken.includes('mike') || idToken.includes('mlb');
  if (isDMLB || isFMLB) return isDMLB && isFMLB;

  // 20. Sam Linebacker (SLB / SAM)
  const isDSLB = dClean === 'SLB' || dToken === 'slb' || dToken.includes('sam') || dToken.includes('nickel') || dToken === 'olb';
  const isFSLB = fClean === 'SLB' || fClean === 'SAM' || fToken === 'slb' || fToken.includes('sam') || idToken.includes('sam') || idToken.includes('slb');
  if (isDSLB || isFSLB) return isDSLB && isFSLB;

  // 21. Cornerback 1
  const isDCB1 = dClean === 'CB1' || dToken === 'cb1';
  const isFCB1 = fClean === 'CB 1' || fClean === 'CB1' || fToken === 'cb1' || idToken.includes('cb1');
  if (isDCB1 && isFCB1) return true;

  // 22. Cornerback 2
  const isDCB2 = dClean === 'CB2' || dToken === 'cb2';
  const isFCB2 = fClean === 'CB 2' || fClean === 'CB2' || fToken === 'cb2' || idToken.includes('cb2');
  if (isDCB2 && isFCB2) return true;

  // General Cornerback
  const isDCB = dClean === 'CB' || dToken.startsWith('cb') || dToken.includes('corner');
  const isFCB = fClean.startsWith('CB') || fToken.startsWith('cb') || fToken.includes('corner') || idToken.includes('cb');
  if (isDCB && isFCB) return true;

  // 23. Free Safety
  const isDFS = dClean === 'FS' || dToken === 'fs' || dToken.includes('free');
  const isFFS = fClean === 'FS' || fToken === 'fs' || fToken.includes('free') || idToken.includes('fs');
  if (isDFS || isFFS) return isDFS && isFFS;

  // 24. Strong Safety / ROVER
  const isDSS = dClean === 'SS' || dToken === 'ss' || dToken.includes('strong') || dToken.includes('rover');
  const isFSS = fClean === 'SS' || fToken === 'ss' || fToken.includes('strong') || fToken.includes('rover') || idToken.includes('rover') || idToken.includes('ss');
  if (isDSS || isFSS) return isDSS && isFSS;

  return false;
}

/**
 * Determines eligibility and compatibility score between drill slot and candidate
 */
export function isPositionEligible(
  targetPosName: string,
  candPosName: string,
  targetUnit: 'offense' | 'defense',
  candUnit?: string,
  candPosId?: string
): { eligible: boolean; score: number; exactMatch: boolean } {
  // Check exact position match first
  if (isExactPositionSlotMatch(targetPosName, candPosName, candPosId || '')) {
    return { eligible: true, score: 1000, exactMatch: true };
  }

  const targetClass = getPositionCategory(targetPosName);
  const candClass = getPositionCategory(candPosName);

  // 1. STRICT QUARTERBACK VALIDATION:
  // "only put QB in the drill at QB only if hes on the off or def depth chart."
  if (targetClass.category === 'QB') {
    if (candClass.category === 'QB') {
      return { eligible: true, score: 100, exactMatch: true };
    }
    // Never place non-QBs at QB
    return { eligible: false, score: 0, exactMatch: false };
  }

  // Non-QBs: prevent QBs from being accidentally auto-filled into other positions
  if (candClass.category === 'QB') {
    return { eligible: false, score: 0, exactMatch: false };
  }

  // 2. Exact category matching
  if (targetClass.category === candClass.category) {
    let score = 80;
    // Bonus for matching sub-role (e.g., LT for LT, MLB for MLB, CB for CB)
    if (targetClass.subRole === candClass.subRole) {
      score += 20;
    }
    // Unit match bonus
    if (candUnit && candUnit === targetUnit) {
      score += 10;
    }
    return { eligible: true, score, exactMatch: targetClass.subRole === candClass.subRole };
  }

  // 3. Permissible hybrid/flex position overlaps (only when same category not available):
  // WR / TE flex:
  if (targetClass.category === 'WR' && candClass.category === 'TE') {
    return { eligible: true, score: 60, exactMatch: false };
  }
  if (targetClass.category === 'TE' && candClass.category === 'WR') {
    return { eligible: true, score: 55, exactMatch: false };
  }
  // TE / OL blocking hybrid:
  if (targetClass.category === 'TE' && candClass.category === 'OL') {
    return { eligible: true, score: 45, exactMatch: false };
  }

  // Otherwise not eligible
  return { eligible: false, score: 0, exactMatch: false };
}

export interface AutoFillSummary {
  filledOffense: number;
  totalOffense: number;
  filledDefense: number;
  totalDefense: number;
  startersMixed: number;
  backupsAdded: number;
  sourceDescription: string;
}

export interface CandidateRecord {
  num: string;
  name: string;
  depthString: number; // 1 = 1st string (Black), 2 = 2nd string (Gold), 3 = 3rd string (Blue), 4 = 4th, 5 = 5th
  category: PositionCategory;
  subRole: string;
  score: number;
  source: 'depth_chart' | 'scrimmage' | 'roster';
  isExactPosition: boolean;
}

/**
 * Collects and ranks eligible candidates for a specific drill position slot
 * strictly leveraging the actual depth chart as the primary source of truth.
 *
 * Enforces the user's explicit rule:
 * "the offensive and defensive formation has positions black, gold and blue(1,2,3).
 *  To autofill the use the postions they are in, so QB is QB, etc"
 */
function getCandidatesForDrillPosition(params: {
  pos: LiveDrillPosition;
  unit: 'offense' | 'defense';
  formations: FormationBoard[];
  depthChart: Record<string, PlacedPlayer[]>;
  scrimmageChart?: Record<string, PlacedPlayer[]>;
  roster: RosterPlayer[];
}): CandidateRecord[] {
  const { pos, unit, formations, depthChart, scrimmageChart = {}, roster } = params;
  const candidateMap = new Map<string, CandidateRecord>();

  const isQB = getPositionCategory(pos.name).category === 'QB';

  // 1. Scan Formations on the Depth Chart matching this unit
  for (const form of formations) {
    const formUnit = form.unit || (form.id.includes('def') ? 'defense' : 'offense');
    if (formUnit !== unit) continue;

    for (const row of form.rows || []) {
      for (const p of row.positions || []) {
        if (!p) continue;
        const players = depthChart[p.id] || [];
        if (players.length === 0) continue;

        // Check if this formation position is an exact match for the drill slot
        const isExact = isExactPositionSlotMatch(pos.name, p.name, p.id);
        const { eligible, score } = isPositionEligible(pos.name, p.name, unit, formUnit, p.id);

        if (isExact || eligible) {
          players.forEach((player, idx) => {
            if (!player || !player.num || player.num === '?') return;
            const playerNum = String(player.num);
            const depthString = idx + 1; // 1 = Black, 2 = Gold, 3 = Blue, 4 = 4th backup, 5 = 5th backup
            const pClass = getPositionCategory(p.name);
            const candidateScore = isExact ? (10000 - depthString * 10) : score;

            const existing = candidateMap.get(playerNum);
            // Give absolute precedence to exact position matches
            if (
              !existing ||
              (isExact && !existing.isExactPosition) ||
              (isExact && existing.isExactPosition && depthString < existing.depthString) ||
              (!isExact && !existing.isExactPosition && depthString < existing.depthString)
            ) {
              candidateMap.set(playerNum, {
                num: playerNum,
                name: player.name || `Player #${playerNum}`,
                depthString,
                category: pClass.category,
                subRole: pClass.subRole,
                score: candidateScore,
                source: 'depth_chart',
                isExactPosition: isExact,
              });
            }
          });
        }
      }
    }
  }

  // Also check direct depthChart keys (e.g. depthChart["QB"] or depthChart["LT"])
  for (const [key, players] of Object.entries(depthChart)) {
    if (!players || players.length === 0) continue;
    const isExact = isExactPositionSlotMatch(pos.name, key, key);
    const { eligible, score } = isPositionEligible(pos.name, key, unit, undefined, key);

    if (isExact || eligible) {
      players.forEach((player, idx) => {
        if (!player || !player.num || player.num === '?') return;
        const playerNum = String(player.num);
        const depthString = idx + 1;
        const pClass = getPositionCategory(key);
        const candidateScore = isExact ? (10000 - depthString * 10) : score;

        const existing = candidateMap.get(playerNum);
        if (
          !existing ||
          (isExact && !existing.isExactPosition) ||
          (isExact && existing.isExactPosition && depthString < existing.depthString) ||
          (!isExact && !existing.isExactPosition && depthString < existing.depthString)
        ) {
          candidateMap.set(playerNum, {
            num: playerNum,
            name: player.name || `Player #${playerNum}`,
            depthString,
            category: pClass.category,
            subRole: pClass.subRole,
            score: candidateScore,
            source: 'depth_chart',
            isExactPosition: isExact,
          });
        }
      });
    }
  }

  // If we found ANY exact position candidates for this slot:
  // "the offensive and defensive formation has positions black, gold and blue(1,2,3).
  //  To autofill the use the postions they are in, so QB is QB, etc"
  // STRIKE ALL non-exact position candidates so players from other positions (e.g. guards at tackle,
  // or safeties at cornerback) NEVER displace or precede actual depth chart players of that position!
  const hasExactMatches = Array.from(candidateMap.values()).some((c) => c.isExactPosition);
  let candidateList = Array.from(candidateMap.values());
  if (hasExactMatches) {
    candidateList = candidateList.filter((c) => c.isExactPosition);
  }

  // 2. Check Scrimmage Chart ONLY if no exact formation candidates exist
  if (candidateList.length === 0) {
    for (const [posId, players] of Object.entries(scrimmageChart)) {
      if (!players || players.length === 0) continue;
      const isExact = isExactPositionSlotMatch(pos.name, posId, posId);
      const { eligible, score } = isPositionEligible(pos.name, posId, unit, undefined, posId);
      if (isExact || eligible) {
        players.forEach((player, idx) => {
          if (!player || !player.num || player.num === '?') return;
          const playerNum = String(player.num);
          const depthString = idx + 1;
          const pClass = getPositionCategory(posId);
          if (!candidateMap.has(playerNum)) {
            candidateList.push({
              num: playerNum,
              name: player.name || `Player #${playerNum}`,
              depthString: depthString + 1,
              category: pClass.category,
              subRole: pClass.subRole,
              score: isExact ? 500 : score - 5,
              source: 'scrimmage',
              isExactPosition: isExact,
            });
          }
        });
      }
    }
  }

  // 3. Fallback to Active Roster ONLY if depth chart had zero eligible candidates
  // "only put QB in the drill at QB only if hes on the off or def depth chart."
  if (candidateList.length === 0) {
    roster.forEach((r) => {
      const pNum = String(r.num);
      const rPrimary = r.primaryPosition || '';
      const rSecondary = r.secondaryPosition || '';
      const rOff = r.offensivePosition || '';
      const rDef = r.defensivePosition || '';

      if (isQB) {
        // QB slot: player MUST be listed as QB on roster if not on depth chart
        const isRosterQB =
          getPositionCategory(rPrimary).category === 'QB' ||
          getPositionCategory(rSecondary).category === 'QB' ||
          getPositionCategory(rOff).category === 'QB';
        if (isRosterQB) {
          candidateList.push({
            num: pNum,
            name: `${r.firstName} ${r.lastName}`.trim() || r.rosterName,
            depthString: 1,
            category: 'QB',
            subRole: 'QB',
            score: 75,
            source: 'roster',
            isExactPosition: true,
          });
        }
      } else {
        // Other positions: match primary or secondary roster position
        const testPositions = [rPrimary, rSecondary, rOff, rDef].filter(Boolean);
        for (const testPos of testPositions) {
          const isExact = isExactPositionSlotMatch(pos.name, testPos, testPos);
          const { eligible, score } = isPositionEligible(pos.name, testPos, unit, undefined, testPos);
          if (isExact || eligible) {
            const pClass = getPositionCategory(testPos);
            candidateList.push({
              num: pNum,
              name: `${r.firstName} ${r.lastName}`.trim() || r.rosterName,
              depthString: 3,
              category: pClass.category,
              subRole: pClass.subRole,
              score: isExact ? 200 : score - 15,
              source: 'roster',
              isExactPosition: isExact,
            });
            break;
          }
        }
      }
    });
  }

  // Sort candidates:
  // 1. isExactPosition descending (exact position matches ALWAYS come first)
  // 2. depthString ascending (1st string Black = 1, 2nd string Gold = 2, 3rd string Blue = 3, 4th = 4, 5th = 5)
  // 3. score descending
  const sorted = candidateList.sort((a, b) => {
    if (a.isExactPosition !== b.isExactPosition) {
      return a.isExactPosition ? -1 : 1;
    }
    if (a.depthString !== b.depthString) {
      return a.depthString - b.depthString;
    }
    return b.score - a.score;
  });

  return sorted;
}

/**
 * High-powered, intelligent auto-fill for drill positions
 * 1. Derives position assignments strictly from the actual Depth Chart (offense & defense).
 * 2. Uses the positions they are in from offensive and defensive formations:
 *    - Black (1) -> Team 1
 *    - Gold (2)  -> Team 2
 *    - Blue (3)  -> Team 3
 *    - 4th & 5th -> Backups & playing time rotations
 *    - QB is QB, RB is RB, LT is LT, MLB is MLB, etc.
 * 3. Supports Pure Depth Chart Hierarchy (recommended default) and Balanced Mix mode.
 */
export function executeIntelligentAutoFill(params: {
  group: LiveDrillGroup;
  formations: FormationBoard[];
  depthChart: Record<string, PlacedPlayer[]>;
  scrimmageChart?: Record<string, PlacedPlayer[]>;
  roster: RosterPlayer[];
  targetString?: 1 | 2 | 3 | 'all'; // 1 = Starters (Black), 2 = 2nd Team (Gold), 3 = 3rd Team (Blue), 'all' = All 3
  balanceMode?: 'pure_depth' | 'semi_balanced_head_to_head' | 'even_mix';
  fillUnit?: 'both' | 'offense' | 'defense';
}): { nextLineup: Record<string, PlacedPlayer[]>; summary: AutoFillSummary } {
  const {
    group,
    formations = [],
    depthChart = {},
    scrimmageChart = {},
    roster = [],
    targetString = 'all',
    balanceMode = 'pure_depth',
    fillUnit = 'both',
  } = params;

  let nextLineup: Record<string, PlacedPlayer[]> = { ...group.lineup };

  let filledOffense = 0;
  let filledDefense = 0;
  let startersMixed = 0;
  let backupsAdded = 0;

  // Process a unit (offense or defense)
  const processUnit = (unit: 'offense' | 'defense') => {
    const positions = unit === 'offense' ? group.offensePositions : group.defensePositions;

    // Track players assigned per team to avoid jersey conflicts within the same team on the field
    const usedByTeam: [Set<string>, Set<string>, Set<string>] = [
      new Set<string>(), // Team 1 (index 0 - Black)
      new Set<string>(), // Team 2 (index 1 - Gold)
      new Set<string>(), // Team 3 (index 2 - Blue)
    ];

    // Pre-populate used sets from existing lineup if targeting a single string
    if (targetString !== 'all') {
      positions.forEach((p) => {
        const assigned = nextLineup[p.id] || [];
        [0, 1, 2].forEach((tIdx) => {
          if (tIdx !== (targetString - 1) && assigned[tIdx] && assigned[tIdx].num !== '?') {
            usedByTeam[tIdx].add(String(assigned[tIdx].num));
          }
        });
      });
    }

    positions.forEach((pos, pIdx) => {
      const candidates = getCandidatesForDrillPosition({
        pos,
        unit,
        formations,
        depthChart,
        scrimmageChart,
        roster,
      });

      const currentList = [...(nextLineup[pos.id] || [])];
      // Ensure slots exist for at least 3 teams
      while (currentList.length < 3) {
        currentList.push({ num: '?', name: 'TBD' });
      }

      if (targetString === 'all') {
        if (balanceMode === 'semi_balanced_head_to_head') {
          // ================================================================
          // SEMI-BALANCED HEAD-TO-HEAD (TEAM 1 VS TEAM 2)
          // Designed specifically for competitive scrimmage where Team 1 and
          // Team 2 go against each other.
          // 50% Starters (Black) and 50% 2nd-string depth (Gold) are alternated
          // across Team 1 and Team 2 by position group (QB, RB, WR, OL, DL, LB, DB).
          // Team 3 retains 3rd-string depth (Blue) & developmental players.
          // Backups (4th & 5th strings) populate active rotation slots.
          // ================================================================
          const assignedCandidates = new Set<string>();

          if (candidates.length === 1) {
            const cand = candidates[0];
            const targetTeam = pIdx % 2 === 0 ? 0 : 1;
            currentList[targetTeam] = { num: cand.num, name: cand.name };
            usedByTeam[targetTeam].add(cand.num);
            assignedCandidates.add(cand.num);
            if (unit === 'offense') filledOffense++;
            else filledDefense++;
          } else if (candidates.length >= 2) {
            // Even index: Team 1 gets Starter (0), Team 2 gets 2nd string (1)
            // Odd index:  Team 2 gets Starter (0), Team 1 gets 2nd string (1)
            const teamForStarter = pIdx % 2 === 0 ? 0 : 1;
            const teamForBackup = pIdx % 2 === 0 ? 1 : 0;

            const starterCand = candidates[0];
            const backupCand = candidates[1];

            if (!usedByTeam[teamForStarter].has(starterCand.num)) {
              currentList[teamForStarter] = { num: starterCand.num, name: starterCand.name };
              usedByTeam[teamForStarter].add(starterCand.num);
              assignedCandidates.add(starterCand.num);
              startersMixed++;
              if (unit === 'offense') filledOffense++;
              else filledDefense++;
            }

            if (!usedByTeam[teamForBackup].has(backupCand.num)) {
              currentList[teamForBackup] = { num: backupCand.num, name: backupCand.name };
              usedByTeam[teamForBackup].add(backupCand.num);
              assignedCandidates.add(backupCand.num);
              startersMixed++;
              if (unit === 'offense') filledOffense++;
              else filledDefense++;
            }

            // Team 3 (slot 2) receives the 3rd string candidate (Blue)
            if (candidates[2] && !usedByTeam[2].has(candidates[2].num) && !assignedCandidates.has(candidates[2].num)) {
              currentList[2] = { num: candidates[2].num, name: candidates[2].name };
              usedByTeam[2].add(candidates[2].num);
              assignedCandidates.add(candidates[2].num);
              if (unit === 'offense') filledOffense++;
              else filledDefense++;
            }
          }

          // 4th & 5th String Backups (Index 3 & 4)
          const unassignedCandidates = candidates.filter((c) => !assignedCandidates.has(c.num));
          if (unassignedCandidates.length > 0) {
            if (unassignedCandidates[0]) {
              currentList[3] = { num: unassignedCandidates[0].num, name: unassignedCandidates[0].name };
              backupsAdded++;
            }
            if (unassignedCandidates[1]) {
              currentList[4] = { num: unassignedCandidates[1].num, name: unassignedCandidates[1].name };
              backupsAdded++;
            }
          }
        } else if (balanceMode === 'even_mix') {
          // ================================================================
          // BALANCED MIXING OF 1ST, 2ND & 3RD STRINGS
          // Mix depth chart tiers across teams for competitive balance,
          // while strictly using players assigned to this EXACT position.
          // ================================================================
          const assignedCandidates = new Set<string>();

          // If only 1 candidate exists for this position (e.g. only 1 QB in Black):
          // That starter stays on Team 1!
          if (candidates.length === 1) {
            const cand = candidates[0];
            currentList[0] = { num: cand.num, name: cand.name };
            usedByTeam[0].add(cand.num);
            assignedCandidates.add(cand.num);
            if (unit === 'offense') filledOffense++;
            else filledDefense++;
          } else {
            const shift = pIdx % 3;
            const tierToTeam: [number, number, number] = [
              (0 + shift) % 3,
              (1 + shift) % 3,
              (2 + shift) % 3,
            ];

            for (let tier = 0; tier < 3; tier++) {
              const teamIdx = tierToTeam[tier];
              let pickedCand: CandidateRecord | null = null;

              // Try matching candidate corresponding to this tier (0 = Black/1st, 1 = Gold/2nd, 2 = Blue/3rd)
              if (candidates[tier] && !usedByTeam[teamIdx].has(candidates[tier].num) && !assignedCandidates.has(candidates[tier].num)) {
                pickedCand = candidates[tier];
              } else {
                for (const cand of candidates) {
                  if (!usedByTeam[teamIdx].has(cand.num) && !assignedCandidates.has(cand.num)) {
                    pickedCand = cand;
                    break;
                  }
                }
              }

              // Backups can step in for playing time
              if (!pickedCand && candidates.length > 3) {
                for (let b = 3; b < candidates.length; b++) {
                  if (!usedByTeam[teamIdx].has(candidates[b].num) && !assignedCandidates.has(candidates[b].num)) {
                    pickedCand = candidates[b];
                    break;
                  }
                }
              }

              if (pickedCand) {
                currentList[teamIdx] = { num: pickedCand.num, name: pickedCand.name };
                usedByTeam[teamIdx].add(pickedCand.num);
                assignedCandidates.add(pickedCand.num);
                startersMixed++;
                if (unit === 'offense') filledOffense++;
                else filledDefense++;
              }
            }
          }

          // 4th & 5th String Backups (Index 3 & 4)
          const unassignedCandidates = candidates.filter((c) => !assignedCandidates.has(c.num));
          if (unassignedCandidates.length > 0) {
            if (unassignedCandidates[0]) {
              currentList[3] = { num: unassignedCandidates[0].num, name: unassignedCandidates[0].name };
              backupsAdded++;
            }
            if (unassignedCandidates[1]) {
              currentList[4] = { num: unassignedCandidates[1].num, name: unassignedCandidates[1].name };
              backupsAdded++;
            }
          }
        } else {
          // ================================================================
          // FORMATIONS DEPTH CHART (PURE DEPTH)
          // "the offensive and defensive formation has positions black, gold and blue(1,2,3).
          //  To autofill the use the postions they are in, so QB is QB, etc"
          // Team 1 = Black (1st string, depthString 1)
          // Team 2 = Gold  (2nd string, depthString 2)
          // Team 3 = Blue  (3rd string, depthString 3)
          // Index 3 = 4th string backup
          // Index 4 = 5th string backup
          // ================================================================
          const assignedCandidates = new Set<string>();

          for (let teamIdx = 0; teamIdx < 3; teamIdx++) {
            const expectedDepthString = teamIdx + 1; // 1 = Black, 2 = Gold, 3 = Blue

            // Find candidate with exact depthString for this team slot
            let pickedCand: CandidateRecord | null =
              candidates.find((c) => c.depthString === expectedDepthString && !usedByTeam[teamIdx].has(c.num) && !assignedCandidates.has(c.num)) || null;

            // If no exact depth tier candidate, find first available candidate for this position
            if (!pickedCand) {
              for (const cand of candidates) {
                if (!usedByTeam[teamIdx].has(cand.num) && !assignedCandidates.has(cand.num)) {
                  pickedCand = cand;
                  break;
                }
              }
            }

            if (pickedCand) {
              currentList[teamIdx] = { num: pickedCand.num, name: pickedCand.name };
              usedByTeam[teamIdx].add(pickedCand.num);
              assignedCandidates.add(pickedCand.num);
              if (unit === 'offense') filledOffense++;
              else filledDefense++;
            }
          }

          // Backups at index 3 & 4 (4th and 5th string candidates from this position)
          const unassignedCandidates = candidates.filter((c) => !assignedCandidates.has(c.num));
          if (unassignedCandidates.length > 0) {
            // Find depthString === 4 candidate or first unassigned
            const backup4 = unassignedCandidates.find((c) => c.depthString === 4) || unassignedCandidates[0];
            if (backup4) {
              currentList[3] = { num: backup4.num, name: backup4.name };
              assignedCandidates.add(backup4.num);
              backupsAdded++;
            }

            const remainingFor5 = unassignedCandidates.filter((c) => !assignedCandidates.has(c.num));
            const backup5 = remainingFor5.find((c) => c.depthString === 5) || remainingFor5[0];
            if (backup5) {
              currentList[4] = { num: backup5.num, name: backup5.name };
              assignedCandidates.add(backup5.num);
              backupsAdded++;
            }
          }
        }
      } else {
        // Target single string:
        // 1 = Team 1 (Black / 1st String)
        // 2 = Team 2 (Gold / 2nd String)
        // 3 = Team 3 (Blue / 3rd String)
        const targetIdx = targetString - 1;
        const expectedDepth = targetString;

        // Find candidate matching this exact depth tier (Black=1, Gold=2, Blue=3)
        let pickedCand: CandidateRecord | null =
          candidates.find((c) => c.depthString === expectedDepth && !usedByTeam[targetIdx].has(c.num)) || null;

        if (!pickedCand) {
          for (const cand of candidates) {
            if (!usedByTeam[targetIdx].has(cand.num)) {
              pickedCand = cand;
              break;
            }
          }
        }

        if (pickedCand) {
          currentList[targetIdx] = { num: pickedCand.num, name: pickedCand.name };
          usedByTeam[targetIdx].add(pickedCand.num);
          if (unit === 'offense') filledOffense++;
          else filledDefense++;
        }
      }

      nextLineup[pos.id] = currentList;
    });
  };

  if (fillUnit === 'both' || fillUnit === 'offense') {
    processUnit('offense');
  }
  if (fillUnit === 'both' || fillUnit === 'defense') {
    processUnit('defense');
  }

  const modeDescription =
    targetString === 'all'
      ? balanceMode === 'semi_balanced_head_to_head'
        ? 'Semi-Balanced Head-to-Head (Team 1 vs Team 2 Scrimmage)'
        : balanceMode === 'even_mix'
          ? 'Semi-Balanced 3-Way Mix (Teams 1, 2 & 3)'
          : 'Formation Depth Chart (Black=Team 1, Gold=Team 2, Blue=Team 3)'
      : targetString === 1
        ? 'Team 1 (Black / 1st String)'
        : targetString === 2
          ? 'Team 2 (Gold / 2nd String)'
          : 'Team 3 (Blue / 3rd String)';

  return {
    nextLineup,
    summary: {
      filledOffense,
      totalOffense: group.offensePositions.length,
      filledDefense,
      totalDefense: group.defensePositions.length,
      startersMixed,
      backupsAdded,
      sourceDescription: `${modeDescription} from Formation Depth Chart`,
    },
  };
}

