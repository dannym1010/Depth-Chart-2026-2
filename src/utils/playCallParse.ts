// Reading a play call the way our coaches write it, to draw it in the play builder:
//   "30 DW 41 SWEEP"  ->  30 personnel (3 backs, 0 tight ends), Double Wing, the 4 back to the 1 hole, sweep.
//   "21 L WT 26 DIVE" ->  21 personnel, strength left, Wing-T, the 2 back to the 6 hole, dive.
// Personnel comes first (backs then tight ends), then the formation, then who gets the ball and to
// which hole (first digit the back, second the hole), then what the play is.

export interface ParsedCall {
  /** 30 = 3 backs, 0 tight ends. */
  personnel?: number;
  strength?: 'Left' | 'Right';
  /** Backfields the formation word can mean, best first (the builder takes the first that fits). */
  backfields: string[];
  /** The formation word as written ("DW"). */
  formationWord?: string;
  /** Tackle over / unbalanced. */
  tackleOver?: boolean;
  /** The back with the ball: 1 QB, 2 FB, 3 RB, 4 the fourth back / wing. */
  ball?: string;
  hole?: number;
  /** The run (a RUN_SCHEMES id). */
  run?: string;
  family?: 'run' | 'pass' | 'screen' | 'option';
}

/** Formation words and the backfields they mean. */
const FORMATION_WORDS: [RegExp, string[]][] = [
  [/^(DW|DBLW|DBL ?WING|DOUBLE ?WING)$/, ['DOUBLE_WING']],
  [/^(WT|WING ?T)$/, ['WING_T_3', 'WING_T']],
  [/^BEAST$/, ['BEAST']],
  [/^(WB|BONE|WISHBONE)$/, ['WISHBONE']],
  [/^(PI|POWER ?I)$/, ['POWER_I']],
  [/^(MI|STACK|MARYLAND|MARYLAND ?I)$/, ['MARYLAND_I']],
  [/^(FH|FULL ?HOUSE)$/, ['FULLHOUSE']],
  [/^T$/, ['T_FORM']],
  [/^(SW|SINGLE ?WING)$/, ['SINGLE_WING']],
  [/^(DIA|DIAMOND)$/, ['DIAMOND']],
  [/^BOX$/, ['BOX']],
  [/^(STRONG ?I|SI)$/, ['I_OFFSET_R']],
  [/^(WEAK ?I|WI)$/, ['I_OFFSET_L']],
  [/^(I|IFORM|I ?FORM|PRO)$/, ['I_FORM']],
  [/^(SPLIT ?BACKS|SPLIT ?BACK)$/, ['SPLIT_BACKS']],
  [/^(GUN|SG|SHOTGUN)$/, ['GUN_OFFSET', 'GUN_SPLIT', 'GUN_I']],
  [/^PISTOL$/, ['PISTOL', 'PISTOL_I']],
  [/^(WILDCAT|WC|CAT)$/, ['WILDCAT']],
];

const RUN_WORDS: [RegExp, string][] = [
  [/^(SWEEP|TOSS|PITCH|STRETCH ?SWEEP)$/, 'toss'],
  [/^STRETCH$/, 'outside_zone'],
  [/^POWER$/, 'power'],
  [/^(BUCK|BUCK ?SWEEP)$/, 'buck'],
  [/^TRAP$/, 'trap'],
  [/^BELLY$/, 'belly'],
  [/^(BELLY ?G|DOWN ?G)$/, 'belly_g'],
  [/^(COUNTER|CTR|CNTR|COUNTER ?GT)$/, 'counter'],
  [/^(INSIDE ?ZONE|IZ)$/, 'inside_zone'],
  [/^(OUTSIDE ?ZONE|OZ)$/, 'outside_zone'],
  [/^DUO$/, 'duo'],
  [/^(PIN ?(?:&|AND) ?PULL|PIN ?PULL)$/, 'pin_pull'],
  [/^ISO$/, 'iso'],
  [/^DIVE$/, 'dive'],
  [/^DOWN$/, 'down'],
  [/^(JET|JET ?SWEEP)$/, 'jet_sweep'],
  [/^(REVERSE|REV)$/, 'reverse'],
  [/^(DRAW|DELAY)$/, 'draw'],
  [/^WEDGE$/, 'wedge'],
  [/^(QB ?SNEAK|SNEAK)$/, 'qb_sneak'],
  [/^(KEEP|KEEPER)$/, 'keep'],
  [/^ZONE$/, 'inside_zone'],
];

const LEFT = /^(L|LT|LFT|LEFT|LIZ)$/;
const RIGHT = /^(R|RT|RGT|RIGHT|RIP)$/;

export function parsePlayCall(text: string): ParsedCall {
  const out: ParsedCall = { backfields: [] };
  const tokens = String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let i = 0;
  // Personnel first: "30", or with the side on it ("32L").
  const first = tokens[0]?.match(/^(\d)(\d)(L|R)?$/);
  if (first && Number(first[1]) + Number(first[2]) <= 5) {
    out.personnel = Number(`${first[1]}${first[2]}`);
    if (first[3]) out.strength = first[3] === 'L' ? 'Left' : 'Right';
    i = 1;
  }
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    const two = tokens[i + 1] ? `${t} ${tokens[i + 1]}` : '';
    if (LEFT.test(t)) {
      out.strength ??= 'Left';
      continue;
    }
    if (RIGHT.test(t)) {
      out.strength ??= 'Right';
      continue;
    }
    if (/^(OVER|UNB|UNBAL|UNBALANCED)$/.test(t)) {
      out.tackleOver = true;
      continue;
    }
    // Two-word names first ("DOUBLE WING", "WING T", "POWER I").
    const twoWord = two && !out.backfields.length ? FORMATION_WORDS.find(([re]) => re.test(two)) : undefined;
    if (twoWord) {
      out.backfields = twoWord[1];
      out.formationWord = two;
      i++;
      continue;
    }
    const word = !out.backfields.length ? FORMATION_WORDS.find(([re]) => re.test(t)) : undefined;
    if (word) {
      out.backfields = word[1];
      out.formationWord = t;
      continue;
    }
    // Who gets the ball and where: "41" is the 4 back to the 1 hole.
    const call = t.match(/^([1-4])([1-9])$/);
    if (call && out.ball == null) {
      out.ball = call[1];
      out.hole = Number(call[2]);
      continue;
    }
    if (!out.run) {
      const run = RUN_WORDS.find(([re]) => re.test(t));
      if (run) {
        out.run = run[1];
        continue;
      }
    }
    if (/^(PASS|BOOT|BOOTLEG|PA|SPRINT|WAGGLE|ROLL)$/.test(t)) out.family ??= 'pass';
    else if (/^SCREEN$/.test(t)) out.family ??= 'screen';
    else if (/^(OPTION|VEER|TRIPLE)$/.test(t)) out.family ??= 'option';
  }
  if (!out.family && (out.run || out.ball)) out.family = 'run';
  return out;
}

/**
 * A call written whole, personnel first: "30 DW 41 SWEEP", "32L 47 ZONE", "21 R 26 DIVE". Not just a
 * play ("47 ZONE", "41 SWEEP": there the number is the back and the hole).
 */
export function isWholeCall(call: string): boolean {
  const p = parsePlayCall(call);
  return p.personnel != null && (p.ball != null || p.backfields.length > 0 || p.strength != null || Boolean(p.tackleOver));
}
