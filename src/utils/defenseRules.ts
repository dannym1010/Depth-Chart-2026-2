// Each defender's rules, picked from a library of terms that fit his position: a lineman's technique, gap
// and how he plays it; a backer's alignment, read key, flow tempo, run fit and drop; a defensive back's
// alignment, coverage, read key and run support. Picks that move a player (a technique or alignment) or draw
// his line (a drop, a blitz, a slant) change the field too; the rest govern how he reads and attacks in motion.
import { isLineman, jobLabel } from './defenseCalls';
import type { PlayNode } from './footballEngine';

export type DefenseGroup = 'line' | 'backer' | 'back';

export interface RuleOption {
  id: string;
  label: string;
  /** The line it draws (a PLAYER_JOBS id; "*" = his side, L or R). */
  job?: string;
}
export interface RuleCategory {
  id: string;
  label: string;
  options: RuleOption[];
  /** Picks here draw his line: one drawn job per defender, so picking one clears the others. */
  draws?: boolean;
}

export interface RulePreset {
  id: string;
  label: string;
  summary: string;
  picks: Record<string, string>;
  job?: string;
}

/** Where he plays: the line, the second level, or the secondary. */
export function defenseGroup(role: string): DefenseGroup {
  if (isLineman(role)) return 'line';
  if (/^(CB|FS|SS)/.test(role)) return 'back';
  return 'backer';
}

export const TECHNIQUES = ['0', '1', '2i', '2', '3', '4i', '4', '5', '6', '7', '8', '9'];
const gaps = (prefix = '') => (['A', 'B', 'C', 'D'] as const).map((g) => ({ id: g, label: `${prefix}${g} gap` }));
const blitz = (list: string[]) => list.map((g) => ({ id: g, label: `${g} gap`, job: `blitz:${g}` }));

export const RULE_PRESETS: Record<DefenseGroup, RulePreset[]> = {
  line: [
    {
      id: 'shoot_gap',
      label: 'Shoot Gap',
      summary: 'Fire off on ball snap and penetrate into the backfield',
      picks: { key: 'ball', play: 'penetrate', rush: 'inside' },
    },
    {
      id: 'squeeze_down',
      label: 'Squeeze & Wash',
      summary: 'Read down block, squeeze gap down the line toward the ball',
      picks: { key: 'guard', play: 'squeeze' },
    },
    {
      id: 'box_contain',
      label: 'Hard Contain',
      summary: 'Set outside edge on run and cage QB in pocket on pass',
      picks: { gap: 'D', play: 'contain', rush: 'contain' },
    },
    {
      id: 'wrong_arm',
      label: 'Spill Puller',
      summary: 'Attack inside hip of kickout block to spill ball to backers',
      picks: { key: 'guard', play: 'spill' },
    },
    {
      id: 'anchor_2gap',
      label: 'Two-Gap Anchor',
      summary: 'Control blocker on me, hold point of attack, shed to ball',
      picks: { key: 'emol', play: 'twogap', rush: 'bull' },
    },
  ],
  backer: [
    {
      id: 'flow_fill',
      label: 'Flow & Attack',
      summary: 'Read near back, flow laterally with play, then trigger downhill into gap',
      picks: { key: 'nearback', flow: 'flow_attack', action: 'fill' },
    },
    {
      id: 'fast_scrape',
      label: 'Fast Scrape',
      summary: 'Fast lateral flow over the trash, attack off-tackle inside-out',
      picks: { key: 'flow', flow: 'fast', action: 'scrape' },
    },
    {
      id: 'hard_edge',
      label: 'Force / Set Edge',
      summary: 'Step up outside EMOL, set hard edge and turn the run back inside',
      picks: { key: 'emol', flow: 'downhill', fit: 'D', action: 'contain' },
    },
    {
      id: 'backside_fold',
      label: 'Backside Fold',
      summary: 'Slow-play to check cutback & boot first, then fold inside-out',
      picks: { key: 'guards', flow: 'slow', action: 'fold' },
    },
    {
      id: 'wrong_arm',
      label: 'Wrong-Arm Spill',
      summary: 'Read guard pull and attack downhill to wrong-arm kickout block',
      picks: { key: 'guards', flow: 'downhill', action: 'spill' },
    },
  ],
  back: [
    {
      id: 'alley_fill',
      label: 'Alley Runner',
      summary: 'Read #2 to the ball, trigger downhill into the alley inside-out',
      picks: { key: 'two', run: 'alley' },
    },
    {
      id: 'crack_replace',
      label: 'Crack & Replace',
      summary: 'Read #1 — if receiver cracks inside, immediately replace as force',
      picks: { key: 'one', run: 'crack_replace' },
    },
    {
      id: 'hard_corner',
      label: 'Hard Force',
      summary: 'Squat at 5 yds, set outside force edge and turn ball inside',
      picks: { align: 'off5', key: 'two', run: 'force' },
    },
    {
      id: 'stay_deep',
      label: 'Deep Cutback',
      summary: 'Stay deeper than the deepest and erase cutback / over-the-top',
      picks: { align: 'deep', key: 'qb', run: 'cutback' },
    },
  ],
};

export const RULE_LIBRARY: Record<DefenseGroup, RuleCategory[]> = {
  line: [
    { id: 'tech', label: 'Technique', options: TECHNIQUES.map((t) => ({ id: t, label: `${t} tech` })) },
    { id: 'gap', label: 'Gap', options: gaps() },
    {
      id: 'play',
      label: 'Play it',
      options: [
        { id: 'read', label: 'Read & react' },
        { id: 'penetrate', label: 'Penetrate' },
        { id: 'twogap', label: 'Two-gap' },
        { id: 'squeeze', label: 'Squeeze' },
        { id: 'spill', label: 'Spill' },
        { id: 'contain', label: 'Contain edge' },
        { id: 'wrongarm', label: 'Wrong-arm' },
        { id: 'longstick', label: 'Long-stick' },
      ],
    },
    {
      id: 'key',
      label: 'Read key',
      options: [
        { id: 'ball', label: 'Ball / snap' },
        { id: 'emol', label: 'Man on me' },
        { id: 'nearback', label: 'Near back' },
        { id: 'guard', label: 'Guard pull' },
      ],
    },
    {
      id: 'move',
      label: 'Movement',
      draws: true,
      options: [
        { id: 'slantin', label: 'Slant in', job: 'stunt:in' },
        { id: 'slantout', label: 'Slant out', job: 'stunt:out' },
        { id: 'loopin', label: 'Loop in', job: 'loop:in' },
        { id: 'loopout', label: 'Loop out', job: 'loop:out' },
        { id: 'flat', label: 'Drop to the flat', job: 'zone:flat*' },
      ],
    },
    {
      id: 'rush',
      label: 'Pass rush',
      options: [
        { id: 'contain', label: 'Contain' },
        { id: 'inside', label: 'Inside rush' },
        { id: 'bull', label: 'Bull rush' },
        { id: 'screen', label: 'Feel screen' },
        { id: 'spy', label: 'Cage / spy QB' },
      ],
    },
  ],
  backer: [
    {
      id: 'align',
      label: 'Align',
      options: [
        { id: 'stack', label: 'Stack' },
        { id: 'tight', label: 'Tight (3 yds)' },
        { id: 'deep', label: 'Deep (5 yds)' },
        { id: 'apex', label: 'Apex' },
        { id: 'walk', label: 'Walked out' },
        { id: 'line', label: 'On the line' },
        { id: 'plus', label: 'Shade strong' },
        { id: 'minus', label: 'Shade weak' },
      ],
    },
    {
      id: 'key',
      label: 'Read key',
      options: [
        { id: 'nearback', label: 'Read near back' },
        { id: 'guards', label: 'Read guards' },
        { id: 'mesh', label: 'Read QB / mesh' },
        { id: 'emol', label: 'Read EMOL / TE' },
        { id: 'flow', label: 'Backfield flow' },
      ],
    },
    {
      id: 'flow',
      label: 'Flow & tempo',
      options: [
        { id: 'flow_attack', label: 'Flow then attack' },
        { id: 'fast', label: 'Fast flow' },
        { id: 'scrape', label: 'Patient scrape' },
        { id: 'downhill', label: 'Downhill trigger' },
        { id: 'slow', label: 'Slow-play cutback' },
      ],
    },
    {
      id: 'fit',
      label: 'Run fit',
      options: [...gaps(), { id: 'alley', label: 'Alley' }, { id: 'edge', label: 'Outside edge' }],
    },
    {
      id: 'action',
      label: 'Run action',
      options: [
        { id: 'fill', label: 'Plug / fill' },
        { id: 'spill', label: 'Spill' },
        { id: 'force', label: 'Force' },
        { id: 'scrape', label: 'Scrape' },
        { id: 'fold', label: 'Fold' },
        { id: 'contain', label: 'Contain' },
        { id: 'wrongarm', label: 'Wrong-arm' },
        { id: 'cutback', label: 'Cutback / boot' },
      ],
    },
    {
      id: 'motion',
      label: 'Vs. motion',
      options: [
        { id: 'bump', label: 'Bump with motion' },
        { id: 'lock', label: 'Run with motion' },
        { id: 'hold', label: 'Hold gap' },
        { id: 'blitz_motion', label: 'Blitz on motion' },
      ],
    },
    {
      id: 'pass',
      label: 'Pass',
      draws: true,
      options: [
        { id: 'hook', label: 'Hook', job: 'zone:hook*' },
        { id: 'curl', label: 'Curl', job: 'zone:curl*' },
        { id: 'flat', label: 'Flat', job: 'zone:flat*' },
        { id: 'mid', label: 'Middle hook', job: 'zone:mid' },
        { id: 'man', label: 'Man', job: 'man' },
        { id: 'spy', label: 'Spy the QB', job: 'spy' },
      ],
    },
    { id: 'blitz', label: 'Blitz', draws: true, options: blitz(['A', 'B', 'C', 'D']) },
  ],
  back: [
    {
      id: 'align',
      label: 'Align',
      options: [
        { id: 'press', label: 'Press' },
        { id: 'off5', label: 'Off 5' },
        { id: 'off7', label: 'Off 7' },
        { id: 'deep', label: 'Deep 10–12' },
        { id: 'rolled', label: 'Rolled down' },
        { id: 'inside', label: 'Inside shade' },
        { id: 'outside', label: 'Outside shade' },
      ],
    },
    {
      id: 'cover',
      label: 'Coverage',
      draws: true,
      options: [
        { id: 'deep3', label: 'Deep 1/3', job: 'zone:deep3*' },
        { id: 'deepmid', label: 'Deep middle', job: 'zone:deep3M' },
        { id: 'deep2', label: 'Deep 1/2', job: 'zone:deep2*' },
        { id: 'deep4o', label: 'Deep 1/4 outside', job: 'zone:deep4O*' },
        { id: 'deep4i', label: 'Deep 1/4 inside', job: 'zone:deep4I*' },
        { id: 'flat', label: 'Flat', job: 'zone:flat*' },
        { id: 'curl', label: 'Curl', job: 'zone:curl*' },
        { id: 'man', label: 'Man', job: 'man' },
      ],
    },
    {
      id: 'run',
      label: 'Run support',
      options: [
        { id: 'force', label: 'Force' },
        { id: 'alley', label: 'Alley' },
        { id: 'cutback', label: 'Cutback' },
        { id: 'pursuit', label: 'Pursuit' },
        { id: 'contain', label: 'Contain' },
        { id: 'crack_replace', label: 'Crack & replace' },
        { id: 'fill', label: 'Box fit' },
      ],
    },
    {
      id: 'key',
      label: 'Read',
      options: [
        { id: 'qb', label: 'Read QB' },
        { id: 'one', label: 'Read #1' },
        { id: 'two', label: 'Read #2' },
        { id: 'ball', label: 'Eyes on the ball' },
        { id: 'backfield', label: 'Backfield flow' },
      ],
    },
    {
      id: 'motion',
      label: 'Vs. motion',
      options: [
        { id: 'travel', label: 'Travel (man)' },
        { id: 'bump', label: 'Bump / roll' },
        { id: 'hold', label: 'Stay on side' },
      ],
    },
    { id: 'blitz', label: 'Blitz', draws: true, options: blitz(['C', 'D']) },
  ],
};

/** The job a pick draws for him: "*" becomes his side of the ball. */
export function resolveRuleJob(job: string, n: { x: number }, ball = 0): string {
  return job.endsWith('*') ? job.slice(0, -1) + (n.x < ball ? 'L' : 'R') : job;
}

/** The pick in a drawing category that matches the line he has now (if any). */
export function drawnPick(cat: RuleCategory, assign: string | undefined, n: { x: number }, ball = 0): string {
  if (!assign) return '';
  return cat.options.find((o) => o.job && resolveRuleJob(o.job, n, ball) === assign)?.id || '';
}

/** His technique by name ("E5" → "5"), unless the coach picked one. */
export function techniqueOf(role: string, picks: Record<string, string> = {}): string {
  if (picks.tech) return picks.tech;
  const m = role.match(/^(?:D[ET]|NT|E|T)(\d+i?)$/i);
  return m ? m[1].toLowerCase() : role === 'NT' ? '0' : '';
}

/** The techniques picked for the linemen, by role (for applyTechniques). */
export function pickedTechniques(rules: Record<string, Record<string, string>> = {}): Record<string, string> {
  return Object.fromEntries(Object.entries(rules).filter(([, r]) => r?.tech).map(([role, r]) => [role, r.tech]));
}

/**
 * Applies any picked `align` rules for linebackers and defensive backs to their pre-snap field coordinates.
 * Defenders without an explicit `align` pick stay exactly where the front lined them up.
 */
export function applyRuleAlignments(
  defNodes: PlayNode[],
  offNodes: PlayNode[],
  rules: Record<string, Record<string, string>> = {},
  strongLeft = false
): PlayNode[] {
  if (!defNodes.length || !Object.keys(rules).length) return defNodes;
  const cNode = offNodes.find((n) => n.role === 'C');
  const ballX = cNode ? cNode.x : 0;
  const strongSign = strongLeft ? -1 : 1;

  return defNodes.map((n) => {
    const align = rules[n.role]?.align;
    if (!align) return n;
    const group = defenseGroup(n.role);
    const side = n.x < ballX ? -1 : 1;
    let x = n.x;
    let y = n.y;

    if (group === 'backer') {
      if (align === 'stack') {
        y = 4.0;
      } else if (align === 'tight') {
        y = 2.9;
      } else if (align === 'deep') {
        y = 5.2;
      } else if (align === 'line') {
        y = 1.85;
      } else if (align === 'walk') {
        x = n.x + side * 2.2;
        y = Math.min(n.y, 3.4);
      } else if (align === 'apex') {
        // Apex halfway between EMOL (TE or OT) and nearest wideout on his side
        const sideOff = offNodes.filter((o) => o.role !== 'C' && o.role !== '1' && o.role !== 'QB' && (o.x - ballX) * side > 0);
        const sortedX = sideOff.map((o) => o.x).sort((a, b) => side * (a - b));
        if (sortedX.length >= 2) {
          const emolX = sortedX.find((ox) => Math.abs(ox - ballX) >= 3.2) ?? sortedX[0];
          const outX = sortedX[sortedX.length - 1];
          x = Math.round(((emolX + outX) / 2) * 100) / 100;
        } else {
          x = n.x + side * 1.6;
        }
        y = 3.5;
      } else if (align === 'plus') {
        x = n.x + strongSign * 1.3;
      } else if (align === 'minus') {
        x = n.x - strongSign * 1.3;
      }
    } else if (group === 'back') {
      if (align === 'press') {
        y = 1.85;
      } else if (align === 'off5') {
        y = 5.0;
      } else if (align === 'off7') {
        y = 7.0;
      } else if (align === 'deep') {
        y = 10.8;
      } else if (align === 'rolled') {
        y = 4.4;
        x = ballX + (n.x - ballX) * 0.82;
      } else if (align === 'inside') {
        x = n.x - side * 1.2;
      } else if (align === 'outside') {
        x = n.x + side * 1.2;
      }
    }

    return {
      ...n,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    };
  });
}

/**
 * His rules in words, in the library's order: "3 technique · B gap · Penetrate · Slant in". Empty when
 * nothing was picked for him.
 */
export function rulesText(role: string, picks: Record<string, string> = {}, assign?: string, n?: { x: number }, ball = 0): string {
  const group = defenseGroup(role);
  const parts: string[] = [];
  let drawn = false;
  for (const cat of RULE_LIBRARY[group]) {
    if (cat.draws) {
      const id = n ? drawnPick(cat, assign, n, ball) : '';
      const opt = cat.options.find((o) => o.id === id);
      if (opt) {
        parts.push(cat.id === 'blitz' ? `Blitz ${opt.label}` : opt.label);
        drawn = true;
      }
      continue;
    }
    const opt = cat.options.find((o) => o.id === picks[cat.id]);
    if (!opt) continue;
    // A gap assigned across the center from him (on the field's Gaps): "the other A gap".
    const across = (cat.id === 'gap' || cat.id === 'fit') && picks.gapSide === 'over' ? ' (across the ball)' : '';
    parts.push(cat.id === 'tech' ? `${opt.id} technique` : cat.id === 'fit' ? `${opt.label} fit${across}` : `${opt.label}${across}`);
  }
  // A defensive back given a gap on the field (a safety walked down into the box): it shows too.
  if (picks.fit && !RULE_LIBRARY[group].some((c) => c.id === 'fit')) {
    parts.push(`${picks.fit} gap fit${picks.gapSide === 'over' ? ' (across the ball)' : ''}`);
  }
  // A drawn job that isn't in his library (given before, from the call menu): its name.
  if (!drawn && assign) parts.push(jobLabel(assign));
  const any = parts.filter(Boolean);
  // A lineman's technique leads, even when only his gap or move was picked.
  if (any.length && group === 'line' && !picks.tech) {
    const t = techniqueOf(role);
    if (t) any.unshift(`${t} technique`);
  }
  return any.join(' · ');
}

// What each pick means, shown when a coach hovers it. Keyed "category.option" per group.
const TECH_TIPS: Record<string, string> = {
  '0': 'Head-up on the center. Usually plays both A gaps.',
  '1': "Shaded on the center's shoulder. Plays the A gap.",
  '2i': 'Inside shoulder of the guard. Plays the A gap.',
  '2': 'Head-up on the guard.',
  '3': 'Outside shoulder of the guard. Plays the B gap — a 3-tech should get upfield.',
  '4i': 'Inside shoulder of the tackle. Plays the B gap.',
  '4': 'Head-up on the tackle.',
  '5': 'Outside shoulder of the tackle. Plays the C gap.',
  '6': 'Head-up on the tight end.',
  '7': 'Inside shoulder of the tight end. Plays the C gap.',
  '8': 'Wide outside — a step or two outside the tight end (or where one would be).',
  '9': 'Outside shoulder of the tight end. Plays the D gap and the edge.',
};
const GAP_TIPS: Record<string, string> = {
  A: 'between the center and the guard.',
  B: 'between the guard and the tackle.',
  C: 'between the tackle and the tight end (just outside the tackle if there is no TE).',
  D: 'outside the tight end — the edge.',
};

const RULE_TIPS: Record<DefenseGroup, Record<string, string>> = {
  line: {
    'play.read': 'Take on the blocker, find the ball, then go make the tackle.',
    'play.penetrate': 'Fire off at the snap and get into the backfield through his gap.',
    'play.twogap': 'Lock out the blocker in front of him and be ready to shed to either side.',
    'play.squeeze': 'When the man on him blocks down, ride him inside and make the hole smaller.',
    'play.spill': 'Attack a kick-out block from the inside so the runner has to bounce outside to the backers.',
    'play.contain': 'Keep the ball inside him. Never let the runner or QB get around his outside shoulder.',
    'play.wrongarm': 'Duck under a kick-out block with his outside arm free, blowing up the play and spilling it wide.',
    'play.longstick': 'Slant hard across two gaps at the snap to beat a zone block.',
    'key.ball': 'Move on the ball, not the cadence. Go when the ball moves.',
    'key.emol': 'Read the blocker in front of him — his block tells where the play goes.',
    'key.nearback': 'Read the running back closest to him. Where he goes, the play goes.',
    'key.guard': 'Watch the guard. If he pulls, follow him — he takes you to the ball.',
    'move.slantin': 'At the snap, step and slant one gap inside.',
    'move.slantout': 'At the snap, step and slant one gap outside.',
    'move.loopin': 'Take a step back and loop around inside to the next gap (a stunt).',
    'move.loopout': 'Take a step back and loop around outside to the next gap (a stunt).',
    'move.flat': 'Drop off the line into the flat — a surprise zone dropper.',
    'rush.contain': "On a pass, rush from the outside and keep the QB in the pocket. Don't rush past him.",
    'rush.inside': 'On a pass, rush through the inside gap — the shortest path to the QB.',
    'rush.bull': 'Drive straight through the blocker and push him back into the QB.',
    'rush.screen': 'Rush, but if the line lets him through too easily, stop and look for a screen.',
    'rush.spy': "Don't rush hard — mirror the QB and tackle him if he runs.",
  },
  backer: {
    'align.stack': 'Line up right behind a lineman.',
    'align.tight': 'Line up close — about 3 yards off the ball.',
    'align.deep': 'Line up deeper — about 5 yards off the ball, to see more.',
    'align.apex': 'Split the difference between the last lineman and the slot receiver.',
    'align.walk': 'Walk out over the slot or wide receiver.',
    'align.line': 'Walk up onto the line of scrimmage like an extra lineman.',
    'align.plus': 'Shade toward the strong side (the tight end / more receivers).',
    'align.minus': 'Shade toward the weak side.',
    'key.nearback': 'Read the running back closest to him. Where he goes, the play goes.',
    'key.guards': 'Read the guards. A guard pulls = follow him; guards pass block = drop.',
    'key.mesh': 'Watch the QB and running back at the handoff — find who has the ball.',
    'key.emol': 'Read the end man on the line (the tackle or tight end) in front of him.',
    'key.flow': 'Read which way the whole backfield moves and go with it.',
    'flow.flow_attack': 'Shuffle with the play, then hit the hole when it shows.',
    'flow.fast': 'Run hard sideways with the flow to beat the runner to the edge.',
    'flow.scrape': 'Slide sideways behind the line, staying inside the runner, then fill the open hole.',
    'flow.downhill': 'Attack straight forward as soon as he reads run.',
    'flow.slow': 'Hold a beat for the cutback, reverse or bootleg before he chases. Good on the backside.',
    'fit.alley': 'The lane between the end of the line and the force player outside.',
    'fit.edge': 'He is the outside man: keep the run from getting outside him.',
    'action.fill': 'Step into his gap and fill it. Meet the runner in the hole.',
    'action.spill': 'Attack a lead blocker inside-out so the runner bounces wide to help.',
    'action.force': 'Set the edge and turn the run back inside to teammates.',
    'action.scrape': 'Slide behind the line to the outside and make the play off tackle.',
    'action.fold': 'Come behind the line from the backside and fill inside-out.',
    'action.contain': 'Keep everything inside him. Never let the ball get outside.',
    'action.wrongarm': 'Duck under the blocker with his outside arm free to blow the play up.',
    'action.cutback': 'Stay home on the backside for the cutback, reverse or bootleg.',
    'motion.bump': 'When a player motions, slide over one man with the motion.',
    'motion.lock': 'Run with the motion man step for step (man coverage).',
    'motion.hold': 'Ignore the motion and stay in his gap.',
    'motion.blitz_motion': 'Motion is the trigger — blitz when it happens.',
    'pass.hook': 'Drop to the hook zone, about 8–10 yards deep, just inside the receivers.',
    'pass.curl': 'Drop to the curl zone, 10–12 yards deep, between the hash and the numbers.',
    'pass.flat': 'Get to the flat — the short area out by the sideline.',
    'pass.mid': 'Drop straight back into the middle hook, under the deep safety.',
    'pass.man': 'Cover one receiver (or back) wherever he goes.',
    'pass.spy': 'Mirror the QB. If he runs, he is yours.',
  },
  back: {
    'align.press': 'Line up right on the receiver at the line to jam him.',
    'align.off5': 'Line up about 5 yards off the receiver.',
    'align.off7': 'Line up about 7 yards off the receiver.',
    'align.deep': 'Line up 10–12 yards deep. Nothing gets behind him.',
    'align.rolled': 'Walk down closer to the line to help against the run.',
    'align.inside': 'Line up on the inside shoulder of the receiver — takes away slants and the middle.',
    'align.outside': 'Line up on the outside shoulder — takes away the fade and out routes.',
    'cover.deep3': 'Cover the deep third of the field on his side. Nothing gets behind him.',
    'cover.deepmid': 'Cover the deep middle third — the middle-of-the-field safety.',
    'cover.deep2': 'Cover the deep half of the field on his side (two-deep safety).',
    'cover.deep4o': 'Cover the outside deep quarter of the field (Cover 4 corner).',
    'cover.deep4i': 'Cover the inside deep quarter of the field (Cover 4 safety).',
    'cover.flat': 'Cover the flat — the short area out by the sideline.',
    'cover.curl': 'Cover the curl zone, 10–12 yards deep, between the hash and the numbers.',
    'cover.man': 'Cover one receiver wherever he goes.',
    'run.force': 'He is the force player: set the edge and turn the run back inside.',
    'run.alley': 'Come downhill through the alley (inside the force player) to make the tackle.',
    'run.cutback': 'Stay back on the backside and make the tackle if the runner cuts back.',
    'run.pursuit': 'Take a pursuit angle to the ball — go to where the runner will be, not where he is.',
    'run.contain': 'Keep the run inside him. Never let the runner get outside.',
    'run.crack_replace': 'If the receiver blocks inside (a crack block), he replaces the player who got blocked and takes the edge.',
    'run.fill': 'Come into the box and fill a gap like a linebacker.',
    'key.qb': 'Read the QB. Drop back = play the pass; handoff = come up for the run.',
    'key.one': 'Read the widest receiver (#1). His release tells run or pass.',
    'key.two': 'Read the second receiver in from the sideline (#2). His release tells run or pass.',
    'key.ball': 'Watch the ball and react to it.',
    'key.backfield': 'Read which way the backfield moves and go with it.',
    'motion.travel': 'Run with the motion man across the formation (man coverage).',
    'motion.bump': 'Slide over with the motion and let the whole secondary rotate.',
    'motion.hold': 'Ignore the motion and stay on his side of the field.',
  },
};

/** What a pick means, in a sentence, for its hover note (empty when there's none). */
export function ruleTip(group: DefenseGroup, category: string, option: string): string {
  if (category === 'tech') return TECH_TIPS[option] || '';
  const gap = GAP_TIPS[option];
  if (gap && (category === 'gap' || category === 'fit')) return `His gap: ${gap}`;
  if (gap && category === 'blitz') return `At the snap, attack through the ${option} gap (${gap.replace(/\.$/, '')}) and into the backfield.`;
  return RULE_TIPS[group][`${category}.${option}`] || '';
}

/** What a heading means, for its hover note. */
export const CATEGORY_TIPS: Record<string, string> = {
  tech: 'Where he lines up on the offensive line.',
  gap: 'The gap he is responsible for on a run.',
  play: 'How he plays the blocker in front of him.',
  key: 'What he watches at the snap to know where the play is going.',
  move: 'A movement at the snap that draws his line on the field.',
  rush: 'How he rushes the passer.',
  align: 'Where he lines up before the snap.',
  flow: 'How fast and how he moves once he reads the play.',
  fit: 'His run gap or lane.',
  action: 'What he does when it is a run.',
  motion: 'What he does when the offense sends a player in motion.',
  pass: 'His job when it is a pass (draws his drop on the field).',
  cover: 'His pass coverage (draws his drop on the field).',
  run: 'His job when it is a run.',
  blitz: 'Send him at the snap through this gap (draws his path).',
};
