// Each defender's rules, picked from a library of terms that fit his position: a lineman's technique, gap
// and how he plays it; a backer's alignment, run fit and drop; a defensive back's alignment, coverage and
// run support. Picks that move a player (a technique) or draw his line (a drop, a blitz, a slant) change
// the field too; the rest are words on his job.
import { PLAYER_JOBS, isLineman } from './defenseCalls';

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

/** Where he plays: the line, the second level, or the secondary. */
export function defenseGroup(role: string): DefenseGroup {
  if (isLineman(role)) return 'line';
  if (/^(CB|FS|SS)/.test(role)) return 'back';
  return 'backer';
}

export const TECHNIQUES = ['0', '1', '2i', '2', '3', '4i', '4', '5', '6', '7', '8', '9'];
const gaps = (prefix = '') => (['A', 'B', 'C', 'D'] as const).map((g) => ({ id: g, label: `${prefix}${g} gap` }));
const blitz = (list: string[]) => list.map((g) => ({ id: g, label: `${g} gap`, job: `blitz:${g}` }));

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
      ],
    },
  ],
  backer: [
    {
      id: 'align',
      label: 'Align',
      options: [
        { id: 'stack', label: 'Stack' },
        { id: 'apex', label: 'Apex' },
        { id: 'walk', label: 'Walked out' },
        { id: 'line', label: 'On the line' },
      ],
    },
    { id: 'fit', label: 'Run fit', options: gaps() },
    {
      id: 'action',
      label: 'Run action',
      options: [
        { id: 'spill', label: 'Spill' },
        { id: 'force', label: 'Force' },
        { id: 'scrape', label: 'Scrape' },
        { id: 'fold', label: 'Fold' },
        { id: 'contain', label: 'Contain' },
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
    parts.push(cat.id === 'tech' ? `${opt.id} technique` : cat.id === 'fit' ? `${opt.label} fit` : opt.label);
  }
  // A drawn job that isn't in his library (given before, from the call menu): its name.
  if (!drawn && assign) parts.push(PLAYER_JOBS.find((j) => j.id === assign)?.label || '');
  const any = parts.filter(Boolean);
  // A lineman's technique leads, even when only his gap or move was picked.
  if (any.length && group === 'line' && !picks.tech) {
    const t = techniqueOf(role);
    if (t) any.unshift(`${t} technique`);
  }
  return any.join(' · ');
}
