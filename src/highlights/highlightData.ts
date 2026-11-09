// Highlights as plain data: merging two coaches' copies, suggestions from the breakdown, titles, reels (built for a
// game, the season or one kid, and put in order), the banquet check, and a reel laid out as a timeline (cards,
// clips, slow motion, freezes, replays) that the in-app player and every export read the same way.
import type { Play } from '../hudlScout/types/football';
import { jerseyOf, playerTotals, playsForPlayer } from '../filmroom/playerPlays';
import { mergeById, mergeTombstones } from '../utils/recordMerge';
import type {
  Highlight, HighlightCategory, HighlightGame, HighlightSettings, HighlightsData, NameStyle, Reel, ReelKind, ReelOptions,
} from './types';

export const EVERYONE = '*';

export const defaultSettings = (): HighlightSettings => ({
  primary: '#1d3f8f',
  accent: '#f2b705',
  text: '#ffffff',
  logoCorner: 'tr',
  font: 'Impact',
  titleStyle: 'bar',
  names: 'first',
  preRoll: 2,
  postRoll: 6.5,
  slowSpeed: 0.5,
  replaySpeed: 0.5,
  gameSound: 'low',
  shape: '16:9',
  size: '1080',
  fps: 30,
  exportFormat: 'fcpxml',
  minPerKid: 3,
  bigGain: 15,
  editedAt: 0,
});

export const emptyHighlights = (): HighlightsData => ({ highlights: [], deletedHighlights: {}, reels: [], deletedReels: {}, settings: defaultSettings() });

export function mergeHighlights(a?: Partial<HighlightsData> | null, b?: Partial<HighlightsData> | null): HighlightsData {
  const x = { ...emptyHighlights(), ...(a || {}) };
  const y = { ...emptyHighlights(), ...(b || {}) };
  const deletedHighlights = mergeTombstones(x.deletedHighlights, y.deletedHighlights);
  const deletedReels = mergeTombstones(x.deletedReels, y.deletedReels);
  const sx = { ...defaultSettings(), ...(x.settings || {}) };
  const sy = { ...defaultSettings(), ...(y.settings || {}) };
  // A highlight's game, from whichever copy still has it (a cloud copy once lost it: the save blanked a game shared
  // by two highlights), else from another highlight of the same play, else marked unknown (never missing).
  const gameOf = new Map<string, HighlightGame>();
  const byPlay = new Map<string, HighlightGame>();
  for (const h of [...(x.highlights || []), ...(y.highlights || [])]) {
    if (!h?.game?.key) continue;
    gameOf.set(h.id, h.game);
    if (h.playId) byPlay.set(h.playId, h.game);
  }
  const withGame = (h: Highlight): Highlight =>
    h.game?.key ? h : { ...h, game: gameOf.get(h.id) || (h.playId && byPlay.get(h.playId)) || { key: '', gameId: '', name: 'Game not known' } };
  return {
    highlights: mergeById(x.highlights, y.highlights, deletedHighlights).map(withGame).sort((m, n) => m.createdAt - n.createdAt),
    deletedHighlights,
    reels: mergeById(x.reels, y.reels, deletedReels).sort((m, n) => m.createdAt - n.createdAt),
    deletedReels,
    settings: (sy.editedAt || 0) > (sx.editedAt || 0) ? sy : sx,
  };
}

/** The season a date belongs to: a fall season's banquet in January still counts for that season. */
export const seasonOf = (d = new Date()) => String(d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear());

export const newId = (prefix: string, now = Date.now()) => `${prefix}_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---- Changes (each stamped, so it wins when copies merge) ----

export const addHighlights = (d: HighlightsData, list: Highlight[]): HighlightsData => ({ ...d, highlights: [...d.highlights, ...list] });

export function editHighlight(d: HighlightsData, id: string, change: (h: Highlight) => Highlight, now = Date.now()): HighlightsData {
  return { ...d, highlights: d.highlights.map((h) => (h.id === id ? { ...change(h), editedAt: now } : h)) };
}

/** Delete highlights (and take them out of every reel). */
export function removeHighlights(d: HighlightsData, ids: string[], now = Date.now()): HighlightsData {
  const gone = new Set(ids);
  const deletedHighlights = { ...d.deletedHighlights };
  ids.forEach((id) => (deletedHighlights[id] = now));
  return {
    ...d,
    highlights: d.highlights.filter((h) => !gone.has(h.id)),
    deletedHighlights,
    reels: d.reels.map((r) => (r.items.some((i) => gone.has(i.highlightId)) ? { ...r, items: r.items.filter((i) => !gone.has(i.highlightId)), editedAt: now } : r)),
  };
}

export function editReel(d: HighlightsData, id: string, change: (r: Reel) => Reel, now = Date.now()): HighlightsData {
  return { ...d, reels: d.reels.map((r) => (r.id === id ? { ...change(r), editedAt: now } : r)) };
}

export function removeReel(d: HighlightsData, id: string, now = Date.now()): HighlightsData {
  return { ...d, reels: d.reels.filter((r) => r.id !== id), deletedReels: { ...d.deletedReels, [id]: now } };
}

export const setSettings = (d: HighlightsData, s: Partial<HighlightSettings>, now = Date.now()): HighlightsData => ({
  ...d,
  settings: { ...d.settings, ...s, editedAt: now },
});

/** Reels a person sees: their own and the ones shared with them (or with everyone). */
export function reelsFor(d: HighlightsData, user: string): Reel[] {
  const me = String(user || '').toLowerCase().trim();
  return d.reels.filter((r) => !me || r.owner === me || r.sharedWith.some((e) => e === EVERYONE || e === me));
}

// ---- Plays -> highlights ----

const scored = (p: Play) => /\btd\b|touchdown/i.test(String(p.result || ''));
const completed = (p: Play) => /\bcomplete/i.test(String(p.result || '')) && !/incomplete/i.test(String(p.result || ''));
const isPass = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN' || Boolean(p.passer) || /complete|pass/i.test(String(p.result || ''));
const isKick = (p: Play) => p.odk === 'K' || /\b(ko|kick|punt)\b/i.test(String(p.rawPlayType || ''));

/** Jersey numbers on a play: who carried, threw, caught, made the tackle. */
export function kidsOnPlay(p: Play): string[] {
  const nums = [p.rusher, p.passer, p.receiver, p.returner, p.kicker, p.defPlay?.maker, ...(p.defPlay?.assists || []), p.defPlay?.assist, ...Object.values(p.defPlay?.by || {})]
    .map((x) => jerseyOf(x))
    .filter(Boolean);
  if (!nums.length && p.carrierOrTarget) nums.push(jerseyOf(p.carrierOrTarget));
  return [...new Set(nums.filter(Boolean))];
}

/** What a play is, as highlight kinds. */
export function categoriesOf(p: Play, bigGain = 15): HighlightCategory[] {
  const out: HighlightCategory[] = [];
  const gain = Number(p.gainLoss) || 0;
  if (scored(p)) out.push('td');
  for (const e of p.defPlay?.events || []) {
    if (e === 'sack') out.push('sack');
    else if (e === 'int') out.push('int');
    else if (e === 'ff' || e === 'fr') out.push('fumble');
    else if (e === 'tfl') out.push('tfl');
    else if (e === 'pbu') out.push('pbu');
    else if (e === 'blk' && !out.includes('kick')) out.push('kick');
  }
  // Our defense stopping them behind the line (a tackler named), even when the TFL box wasn't ticked.
  if (p.odk === 'D' && gain < 0 && (p.defPlay?.maker || p.defPlay?.events?.length) && !out.includes('sack')) out.push('tfl');
  if (isKick(p)) {
    if ((gain >= bigGain || scored(p)) && !out.includes('kick')) out.push('kick');
  } else if (p.odk === 'O' || p.odk === 'UNKNOWN') {
    if (gain >= bigGain || p.isExplosive) out.push(isPass(p) && completed(p) ? 'catch' : isPass(p) ? 'pass' : 'big_run');
  }
  return [...new Set(out)];
}

const yds = (n: number) => `${Math.abs(Math.round(n))}-yd`;

/** A short title for a play ("45-yd TD run", "Sack", "Interception"). */
export function autoTitle(p: Play): string {
  const gain = Number(p.gainLoss) || 0;
  const cats = categoriesOf(p, Infinity);
  if (scored(p)) {
    if (isKick(p)) return `${gain > 0 ? `${yds(gain)} ` : ''}return TD`;
    if (cats.includes('int')) return 'Pick-six';
    if (isPass(p)) return `${gain > 0 ? `${yds(gain)} ` : ''}TD catch`;
    return `${gain > 0 ? `${yds(gain)} ` : ''}TD run`;
  }
  if (cats.includes('int')) return 'Interception';
  if (cats.includes('sack')) return 'Sack';
  if (cats.includes('fumble')) return (p.defPlay?.events || []).includes('fr') ? 'Fumble recovery' : 'Forced fumble';
  if (cats.includes('tfl')) return 'Tackle for loss';
  if (cats.includes('pbu')) return 'Pass breakup';
  if (isKick(p)) return gain > 0 ? `${yds(gain)} return` : 'Kick';
  if (pointTry(p) && tryGood(p) && p.odk !== 'D') return '2-pt conversion';
  // Our defense: the yards are theirs, so the stop is the story.
  if (p.odk === 'D') {
    const down = Number(p.down) || 0;
    if (pointTry(p)) return 'Stopped the 2-pt try';
    if ((down === 3 || down === 4) && gain < (Number(p.distance) || 0)) return `${down === 4 ? '4th' : '3rd'}-down stop`;
    return p.defPlay?.maker ? 'Tackle' : p.playName || 'Defense';
  }
  if (gain > 0) return `${yds(gain)} ${isPass(p) && completed(p) ? 'catch' : isPass(p) ? 'pass' : 'run'}`;
  return p.playName || 'Big play';
}

export interface Suggestion {
  play: Play;
  categories: HighlightCategory[];
  kids: string[];
  title: string;
  /** Bigger = better (touchdowns and turnovers first). */
  weight: number;
}

const WEIGHT: Partial<Record<HighlightCategory, number>> = { td: 5, int: 4, fumble: 4, kick: 3, sack: 3, big_run: 2, catch: 2, pass: 2, tfl: 1, pbu: 1 };

/** The plays of a game worth a look, biggest first; plays already made into highlights are left out. */
export function suggestFromPlays(plays: Play[], taken: Set<string>, bigGain = 15): Suggestion[] {
  return plays
    .filter((p) => p.odk !== 'S' && !taken.has(p.id))
    .map((p) => {
      const categories = categoriesOf(p, bigGain);
      return { play: p, categories, kids: kidsOnPlay(p), title: autoTitle(p), weight: categories.reduce((n, c) => n + (WEIGHT[c] || 1), 0) + Math.max(0, Number(p.gainLoss) || 0) / 100 };
    })
    .filter((s) => s.categories.length)
    .sort((a, b) => b.weight - a.weight || a.play.playNumber - b.play.playNumber);
}

// ---- Recommended plays: every kind of moment worth a highlight, with why ----

/** The kinds of moments, as the coach filters them. */
export type RecGroup = 'scores' | 'turnovers' | 'backfield' | 'big' | 'downs' | 'specials' | 'kids';
export const REC_GROUPS: { id: RecGroup; label: string; hint: string }[] = [
  { id: 'scores', label: 'TDs & points', hint: 'Touchdowns, 2-point tries, safeties' },
  { id: 'turnovers', label: 'Turnovers', hint: 'Interceptions, forced fumbles, recoveries, pass breakups' },
  { id: 'backfield', label: 'Sacks & TFLs', hint: 'Sacks and tackles for a loss' },
  { id: 'big', label: 'Big gains', hint: 'Long runs and catches' },
  { id: 'downs', label: 'Big downs', hint: '3rd and 4th down: converted on offense, stopped on defense' },
  { id: 'specials', label: 'Kicks & returns', hint: 'Long returns and kick scores' },
  { id: 'kids', label: 'Kids who need clips', hint: 'Their best plays, for kids with fewer clips than the banquet asks for' },
];

export interface RecReason {
  group: RecGroup;
  /** "4th-down stop", "TFL (-3)", "#21 needs clips (1 of 3)". */
  label: string;
  weight: number;
}

export interface Recommendation extends Suggestion {
  reasons: RecReason[];
  groups: RecGroup[];
}

const pointTry = (p: Play) => /\b(2|two)[- ]?(pt|point)s?\b|\bconversion\b|\bpat\b|\bxp\b|extra point/i.test(`${p.result || ''} ${p.playName || ''} ${p.rawPlayType || ''}`);
const tryGood = (p: Play) => /\bgood\b|\bsuccess|\bscore|\btd\b|touchdown|\bmade\b/i.test(String(p.result || ''));

/** Why a play is worth a highlight (none: it isn't). */
export function reasonsFor(p: Play, bigGain = 15): RecReason[] {
  const out: RecReason[] = [];
  const add = (group: RecGroup, label: string, weight: number) => out.push({ group, label, weight });
  const gain = Number(p.gainLoss) || 0;
  const ev = p.defPlay?.events || [];
  const offense = p.odk === 'O' || p.odk === 'UNKNOWN';
  const defense = p.odk === 'D';
  const result = String(p.result || '');

  // Points.
  if (pointTry(p) && (scored(p) || tryGood(p)) && !defense) add('scores', '2-pt try good', 6);
  else if (scored(p)) add('scores', isKick(p) ? 'Return TD' : ev.includes('int') ? 'Pick-six' : ev.includes('fr') ? 'Scoop & score' : 'Touchdown', 10);
  if (/\bsafety\b/i.test(result)) add('scores', 'Safety', 8);
  if (defense && pointTry(p) && !tryGood(p)) add('downs', 'Stopped the try', 5);

  // Turnovers and breakups (our defense).
  if (ev.includes('int')) add('turnovers', 'Interception', 8);
  if (ev.includes('ff')) add('turnovers', 'Forced fumble', 7);
  if (ev.includes('fr')) add('turnovers', 'Fumble recovery', 7);
  if (ev.includes('pbu')) add('turnovers', 'Pass breakup', 3);
  if (ev.includes('blk')) add('specials', 'Blocked kick', 8);

  // Behind the line.
  if (ev.includes('sack')) add('backfield', gain < 0 ? `Sack (${gain})` : 'Sack', 6);
  else if (ev.includes('tfl') || (defense && gain < 0 && (p.defPlay?.maker || ev.length))) add('backfield', `TFL${gain < 0 ? ` (${gain})` : ''}`, 4 + Math.min(3, -gain / 3));

  // Big gains (ours).
  if (isKick(p)) {
    if (gain >= bigGain && !scored(p)) add('specials', `${yds(gain)} return`, 4 + gain / 20);
  } else if (offense && (gain >= bigGain || p.isExplosive) && gain > 0) {
    add('big', `${yds(gain)} ${isPass(p) && completed(p) ? 'catch' : isPass(p) ? 'pass' : 'run'}`, 4 + gain / 20);
  }

  // Big downs: 3rd and 4th down, moved the chains on offense, held on defense.
  const down = Number(p.down) || 0;
  const togo = Number(p.distance) || 0;
  if ((down === 3 || down === 4) && togo > 0 && !isKick(p) && !pointTry(p)) {
    if (offense && (gain >= togo || scored(p))) add('downs', `${down === 4 ? '4th' : '3rd'}-down conversion`, down === 4 ? 6 : 2.5);
    if (defense && gain < togo && !scored(p) && (p.defPlay?.maker || ev.length || gain <= 0)) add('downs', `${down === 4 ? '4th' : '3rd'}-down stop`, down === 4 ? 6 : 2.5);
  }
  return out;
}

/**
 * Every play of a game (or the season) worth a highlight, best first, with why: touchdowns and 2-point tries,
 * turnovers, sacks and TFLs, big gains, 3rd and 4th downs, returns. Plays already kept are left out. With the kids'
 * clip counts, a kid short of the banquet's number gets his best plays recommended too (and they rank higher).
 */
export function recommendPlays(
  plays: Play[],
  taken: Set<string>,
  opts: { bigGain?: number; kidCounts?: Map<string, number>; minPerKid?: number } = {}
): Recommendation[] {
  const bigGain = opts.bigGain ?? 15;
  const need = opts.minPerKid ?? 0;
  const short = (k: string) => opts.kidCounts && need > 0 && (opts.kidCounts.get(String(Number(k))) || 0) < need;
  const out: Recommendation[] = [];
  for (const p of plays) {
    if (p.odk === 'S' || taken.has(p.id)) continue;
    const reasons = reasonsFor(p, bigGain);
    const kids = kidsOnPlay(p);
    // A kid who needs clips: his solid plays count too (a tackle, a good run or catch), not only the big ones.
    const gain = Number(p.gainLoss) || 0;
    const solid = reasons.length > 0 || (p.odk === 'D' ? Boolean(p.defPlay?.maker) && gain <= 3 : gain >= 5);
    const needy = solid ? kids.filter(short) : [];
    if (needy.length === 1) {
      const have = opts.kidCounts?.get(String(Number(needy[0]))) || 0;
      reasons.push({ group: 'kids', label: `#${Number(needy[0])} needs clips (${have} of ${need})`, weight: 3 });
    } else if (needy.length > 1) reasons.push({ group: 'kids', label: `Needs clips: ${needy.map((k) => `#${Number(k)}`).join(', ')}`, weight: 3 + needy.length });
    if (!reasons.length) continue;
    const groups = [...new Set(reasons.map((r) => r.group))];
    out.push({
      play: p,
      categories: categoriesOf(p, bigGain),
      kids,
      title: autoTitle(p),
      weight: reasons.reduce((n, r) => n + r.weight, 0),
      reasons,
      groups,
    });
  }
  return out.sort((a, b) => b.weight - a.weight || a.play.playNumber - b.play.playNumber);
}

/** A highlight made from a play, trimmed around its snap when the snap is known (else the whole clip). */
export function highlightFromPlay(opts: {
  game: HighlightGame;
  play: Play;
  view: string;
  clip: string;
  clipLen?: number;
  snap?: number | null;
  settings: HighlightSettings;
  by: string;
  bigGain?: number;
  now?: number;
}): Highlight {
  const { game, play, view, clip, clipLen, snap, settings, by } = opts;
  const now = opts.now ?? Date.now();
  const len = clipLen && clipLen > 0 ? clipLen : undefined;
  const { start, end } = snapWindow(snap, len, settings);
  const categories = categoriesOf(play, opts.bigGain ?? settings.bigGain);
  return {
    id: newId('hl', now),
    game,
    kind: 'play',
    playId: play.id,
    playNumber: play.playNumber,
    seq: Number(play.playNumber) || 0,
    view,
    clip,
    clipLen: len,
    start,
    end,
    title: autoTitle(play),
    categories: categories.length ? categories : ['other'],
    kids: kidsOnPlay(play),
    rating: categories.some((c) => c === 'td' || c === 'int' || c === 'fumble') ? 3 : categories.length ? 2 : 1,
    createdBy: by,
    createdAt: now,
    editedAt: now,
  };
}

/** A Field camera extra (not a play) made into a highlight: the whole clip. */
export function highlightFromExtra(opts: { game: HighlightGame; view: string; clip: string; clipLen?: number; seq: number; where: string; by: string; now?: number }): Highlight {
  const now = opts.now ?? Date.now();
  const len = opts.clipLen && opts.clipLen > 0 ? opts.clipLen : undefined;
  return {
    id: newId('hl', now),
    game: opts.game,
    kind: 'extra',
    seq: opts.seq,
    view: opts.view,
    clip: opts.clip,
    clipLen: len,
    start: 0,
    end: len ?? 10,
    title: 'Sideline',
    categories: ['sideline'],
    kids: [],
    rating: 1,
    where: opts.where,
    createdBy: opts.by,
    createdAt: now,
    editedAt: now,
  };
}

/** The default trim: before / after the snap, kept inside the clip; the whole clip without a snap. */
export function snapWindow(snap: number | null | undefined, clipLen: number | undefined, s: Pick<HighlightSettings, 'preRoll' | 'postRoll'>) {
  if (snap === null || snap === undefined || !Number.isFinite(snap)) return { start: 0, end: clipLen ?? 10 };
  const start = Math.max(0, round2(snap - s.preRoll));
  const end = round2(clipLen ? Math.min(clipLen, snap + s.postRoll) : snap + s.postRoll);
  return { start, end: Math.max(end, start + 0.5) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Where an extra falls in the game: the plays on either side of it in the camera's clips.
 * `playOf`: the clips lined up with plays (clip name -> play number).
 */
export function extraPlace(clips: { name: string }[], index: number, playOf: Map<string, number>): { seq: number; where: string } {
  let before: number | undefined;
  let after: number | undefined;
  for (let i = index - 1; i >= 0 && before === undefined; i--) before = playOf.get(clips[i].name);
  for (let i = index + 1; i < clips.length && after === undefined; i++) after = playOf.get(clips[i].name);
  if (before !== undefined && after !== undefined) return { seq: before + 0.5, where: `between plays #${before} and #${after}` };
  if (before !== undefined) return { seq: before + 0.5, where: `after play #${before}` };
  if (after !== undefined) return { seq: after - 0.5, where: `before play #${after}` };
  return { seq: index + 0.5, where: `clip ${index + 1}` };
}

// ---- Kids ----

export interface Kid {
  num: string;
  firstName?: string;
  lastName?: string;
}

/** How a kid shows on screen: "#7 Jayden", "#7 Jayden Smith", "#7", or nothing. */
export function kidLabel(num: string, roster: Kid[], style: NameStyle): string {
  if (style === 'none' || !num) return '';
  const k = roster.find((r) => String(Number(r.num)) === String(Number(num)));
  if (style === 'number' || !k) return `#${num}`;
  const name = style === 'full' ? [k.firstName, k.lastName].filter(Boolean).join(' ') : k.firstName || k.lastName || '';
  return name ? `#${num} ${name}` : `#${num}`;
}

export const kidsText = (nums: string[], roster: Kid[], style: NameStyle) =>
  nums.map((n) => kidLabel(n, roster, style)).filter(Boolean).join(' · ');

/** The banquet check: every kid on the roster and how many highlights he's in, fewest first. */
export function kidCoverage(roster: Kid[], highlights: Highlight[]): { num: string; label: string; count: number }[] {
  const count = new Map<string, number>();
  for (const h of highlights) for (const k of h.kids) count.set(String(Number(k)), (count.get(String(Number(k))) || 0) + 1);
  return roster
    .filter((r) => r.num !== undefined && String(r.num).trim() !== '')
    .map((r) => ({ num: String(Number(r.num)), label: kidLabel(String(Number(r.num)), roster, 'full'), count: count.get(String(Number(r.num))) || 0 }))
    .sort((a, b) => a.count - b.count || Number(a.num) - Number(b.num));
}

/** A kid's season numbers as card lines ("12 carries · 145 yds", "2 TD"). */
export function statLines(plays: Play[], num: string): string[] {
  const t = playerTotals(playsForPlayer(plays, num));
  const lines: string[] = [];
  if (t.carries) lines.push(`${t.carries} carries · ${t.rushYds} yds`);
  if (t.completions || t.attempts) lines.push(`${t.completions}/${t.attempts} passing · ${t.passYds} yds`);
  if (t.catches) lines.push(`${t.catches} catches · ${t.recYds} yds`);
  if (t.touchdowns) lines.push(`${t.touchdowns} TD`);
  const d = [t.tackles + t.assists ? `${t.tackles + t.assists} tackles` : '', t.sacks ? `${t.sacks} sacks` : '', t.ints ? `${t.ints} INT` : '', t.forcedFumbles ? `${t.forcedFumbles} FF` : '', t.recoveries ? `${t.recoveries} FR` : '', t.tfl ? `${t.tfl} TFL` : '']
    .filter(Boolean)
    .join(' · ');
  if (d) lines.push(d);
  return lines;
}

// ---- Reels ----

export const defaultReelOptions = (kind: ReelKind): ReelOptions => ({
  order: 'game',
  lengthGoal: 0,
  intro: true,
  introTitle: '',
  introSub: '',
  chapters: kind === 'season' || kind === 'player',
  lowerThird: 'result_kid',
  scoreBug: false,
  scoreText: '',
  statsCard: kind === 'player',
  outro: kind === 'game' ? 'score' : 'thanks',
  outroText: '',
  transition: 'cut',
  replays: 'each',
  cardSeconds: 3,
});

export function newReel(opts: { name: string; kind: ReelKind; owner: string; ownerName?: string; gameKey?: string; kid?: string; highlightIds?: string[]; now?: number }): Reel {
  const now = opts.now ?? Date.now();
  return {
    id: newId('reel', now),
    name: opts.name.trim() || 'New reel',
    kind: opts.kind,
    ...(opts.gameKey ? { gameKey: opts.gameKey } : {}),
    ...(opts.kid ? { kid: opts.kid } : {}),
    items: (opts.highlightIds || []).map((highlightId, i) => ({ id: newId(`it${i}`, now), highlightId })),
    options: defaultReelOptions(opts.kind),
    owner: String(opts.owner || '').toLowerCase().trim(),
    ownerName: opts.ownerName,
    sharedWith: [EVERYONE],
    createdAt: now,
    editedAt: now,
  };
}

/** Add highlights to a reel (each once). */
export function addToReel(r: Reel, ids: string[], now = Date.now()): Reel {
  const have = new Set(r.items.map((i) => i.highlightId));
  const add = ids.filter((id) => !have.has(id)).map((highlightId, i) => ({ id: newId(`it${i}`, now), highlightId }));
  return add.length ? { ...r, items: [...r.items, ...add] } : r;
}

export function moveInReel(r: Reel, from: number, to: number): Reel {
  if (to < 0 || to >= r.items.length || from === to) return r;
  const items = r.items.slice();
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it);
  return { ...r, items };
}

/** The games in season order (by week, then name). */
export function gameOrder(games: { key: string; week?: string; name: string }[]): Map<string, number> {
  const weekNum = (w?: string) => {
    const s = String(w || '');
    const n = Number((s.match(/-?\d+/) || [])[0]);
    const pre = /pre/i.test(s) ? -100 : /playoff|champ/i.test(s) ? 100 : 0;
    return (Number.isFinite(n) ? n : 50) + pre;
  };
  const sorted = games.slice().sort((a, b) => weekNum(a.week) - weekNum(b.week) || a.name.localeCompare(b.name));
  return new Map(sorted.map((g, i) => [g.key, i]));
}

const CATEGORY_ORDER: HighlightCategory[] = [
  'td', 'big_run', 'catch', 'pass', 'kick', 'int', 'fumble', 'sack', 'tfl', 'pbu', 'tackle', 'block', 'celebration', 'sideline', 'huddle', 'coin_toss', 'warmups', 'crowd', 'trophy', 'other',
];

/** A reel's highlights in the order it plays. */
export function orderedHighlights(r: Reel, all: Highlight[], games: Map<string, number>): Highlight[] {
  const byId = new Map(all.map((h) => [h.id, h]));
  const list = r.items.map((i) => byId.get(i.highlightId)).filter(Boolean) as Highlight[];
  const inGame = (a: Highlight, b: Highlight) => (games.get(a.game.key) ?? 999) - (games.get(b.game.key) ?? 999) || a.seq - b.seq;
  const cat = (h: Highlight) => {
    const i = CATEGORY_ORDER.indexOf(h.categories[0] || 'other');
    return i < 0 ? CATEGORY_ORDER.length : i;
  };
  switch (r.options.order) {
    case 'hand':
      return list;
    case 'category':
      return list.slice().sort((a, b) => cat(a) - cat(b) || inGame(a, b));
    case 'rating':
      return list.slice().sort((a, b) => b.rating - a.rating || inGame(a, b));
    case 'top10':
      // Best ten, played as a countdown (No. 10 first, the best last).
      return list.slice().sort((a, b) => b.rating - a.rating || inGame(a, b)).slice(0, 10).reverse();
    default:
      return list.slice().sort(inGame);
  }
}

/** A game's reel: its highlights in game order. */
export const gameHighlights = (all: Highlight[], gameKey: string) => all.filter((h) => h.game.key === gameKey).sort((a, b) => a.seq - b.seq);

/** The season's best: ★★ and up (everything when nothing is rated that high). */
export function seasonPicks(all: Highlight[], minRating = 2): Highlight[] {
  const best = all.filter((h) => h.rating >= minRating);
  return best.length ? best : all;
}

/** Every highlight a kid is in. */
export const kidHighlights = (all: Highlight[], num: string) => all.filter((h) => h.kids.some((k) => String(Number(k)) === String(Number(num))));

// ---- The timeline ----

export interface CardSpec {
  kind: 'intro' | 'chapter' | 'outro' | 'stats';
  title: string;
  sub?: string;
  lines?: string[];
}

export interface Overlay {
  /** The lower third: the title and the line under it. */
  title?: string;
  sub?: string;
  /** The small score in a corner. */
  bug?: string;
}

export type Segment =
  | { type: 'card'; card: CardSpec; seconds: number }
  | { type: 'clip'; h: Highlight; view: string; clip: string; from: number; to: number; speed: number; part: 'main' | 'replay'; overlay?: Overlay }
  | { type: 'freeze'; h: Highlight; view: string; clip: string; at: number; seconds: number; overlay?: Overlay };

export const segmentSeconds = (s: Segment) => (s.type === 'clip' ? (s.to - s.from) / s.speed : s.seconds);
export const timelineSeconds = (segs: Segment[]) => segs.reduce((n, s) => n + segmentSeconds(s), 0);

/** One highlight's parts in order: slow motion splits the play, a freeze stops it, the replay comes after. */
export function highlightSegments(h: Highlight, opts: { overlay?: Overlay; replays: ReelOptions['replays']; replaySpeed: number }): Segment[] {
  const base = { h, view: h.view, clip: h.clip };
  const cuts = new Set<number>([h.start, h.end]);
  const slow = h.slow && h.slow.to > h.slow.from ? { from: clamp(h.slow.from, h.start, h.end), to: clamp(h.slow.to, h.start, h.end), speed: h.slow.speed } : undefined;
  if (slow) {
    cuts.add(slow.from);
    cuts.add(slow.to);
  }
  const freeze = h.freeze && h.freeze.at >= h.start && h.freeze.at <= h.end && h.freeze.seconds > 0 ? h.freeze : undefined;
  if (freeze) cuts.add(freeze.at);
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (to - from < 0.02) continue;
    if (freeze && Math.abs(from - freeze.at) < 1e-6) out.push({ type: 'freeze', ...base, at: freeze.at, seconds: freeze.seconds, overlay: opts.overlay });
    const speed = slow && from >= slow.from - 1e-6 && to <= slow.to + 1e-6 ? slow.speed : 1;
    out.push({ type: 'clip', ...base, from, to, speed, part: 'main', overlay: opts.overlay });
  }
  if (freeze && Math.abs(freeze.at - h.end) < 1e-6) out.push({ type: 'freeze', ...base, at: freeze.at, seconds: freeze.seconds, overlay: opts.overlay });
  // A replay: the one set on the highlight (another camera); with every replay on, the play again slowed down.
  const replay =
    opts.replays === 'none' ? undefined : h.replay && h.replay.end > h.replay.start ? h.replay : opts.replays === 'all' ? { view: h.view, clip: h.clip, start: h.start, end: h.end, speed: opts.replaySpeed } : undefined;
  if (replay) out.push({ type: 'clip', h, view: replay.view, clip: replay.clip, from: replay.start, to: replay.end, speed: replay.speed || opts.replaySpeed, part: 'replay' });
  return out;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A whole reel as a timeline: intro, stats, chapters, every highlight's parts, outro. */
export function reelTimeline(opts: {
  reel: Reel;
  highlights: Highlight[];
  games: Map<string, number>;
  settings: HighlightSettings;
  roster: Kid[];
  /** Season plays (for a kid's stats card). */
  plays?: Play[];
  teamName: string;
}): Segment[] {
  const { reel, settings, roster } = opts;
  const o = reel.options;
  const list = orderedHighlights(reel, opts.highlights, opts.games);
  const card = (c: CardSpec): Segment => ({ type: 'card', card: c, seconds: o.cardSeconds });
  const segs: Segment[] = [];
  const firstGame = list[0]?.game;
  if (o.intro) {
    const title =
      o.introTitle ||
      (reel.kind === 'player' && reel.kid ? kidLabel(reel.kid, roster, settings.names === 'none' ? 'number' : 'full') : reel.kind === 'game' && firstGame ? `${opts.teamName} vs ${opponentOf(firstGame.name)}` : reel.name);
    const sub = o.introSub || (reel.kind === 'game' && firstGame ? weekText(firstGame.week) : reel.kind === 'season' ? `${seasonOf()} season` : '');
    segs.push(card({ kind: 'intro', title, sub }));
  }
  if (o.statsCard && reel.kind === 'player' && reel.kid && opts.plays?.length) {
    const lines = statLines(opts.plays, reel.kid);
    if (lines.length) segs.push(card({ kind: 'stats', title: 'Season', lines }));
  }
  const n = list.length;
  list.forEach((h, i) => {
    if (o.order === 'top10') segs.push(card({ kind: 'chapter', title: `No. ${n - i}`, sub: h.title }));
    else if (o.chapters && (i === 0 || list[i - 1].game.key !== h.game.key) && o.order === 'game')
      segs.push(card({ kind: 'chapter', title: h.game.name, sub: weekText(h.game.week) }));
    const kids = kidsText(h.kids, roster, settings.names);
    const overlay: Overlay | undefined =
      o.lowerThird === 'none'
        ? o.scoreBug && o.scoreText
          ? { bug: o.scoreText }
          : undefined
        : {
            title: h.title,
            sub: o.lowerThird === 'result' ? undefined : o.lowerThird === 'full' ? [kids, h.game.name, h.playNumber ? `Play ${h.playNumber}` : ''].filter(Boolean).join(' · ') : kids || undefined,
            ...(o.scoreBug && o.scoreText ? { bug: o.scoreText } : {}),
          };
    segs.push(...highlightSegments(h, { overlay, replays: o.replays, replaySpeed: settings.replaySpeed }));
  });
  if (o.outro !== 'none') {
    const text = o.outroText || (o.outro === 'score' ? 'Final' : o.outro === 'next' ? 'Next game' : `Thanks for a great ${seasonOf()} season`);
    segs.push(card({ kind: 'outro', title: text, sub: o.outro === 'thanks' ? opts.teamName : undefined }));
  }
  return segs;
}

/** "Week 3 - Shrub Oak" -> "Shrub Oak". */
export const opponentOf = (gameName: string) => gameName.replace(/^\s*(pre-?season\s+)?week\s*\d+\s*[-–:]?\s*/i, '').replace(/^\s*(vs\.?|@|at)\s+/i, '').trim() || gameName;

export const weekText = (week?: string) => {
  const s = String(week || '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return `Week ${s}`;
  if (/^pre-?(\d+)$/i.test(s)) return `Pre-Season Week ${s.replace(/\D/g, '')}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "0:00 Intro · 0:03 Week 1 vs Suffern …" for a YouTube description. */
export function chapters(segs: Segment[]): string {
  const out: string[] = [];
  let t = 0;
  let lastGame = '';
  for (const s of segs) {
    if (s.type === 'card' && (s.card.kind === 'intro' || s.card.kind === 'chapter' || s.card.kind === 'outro')) out.push(`${clock(t)} ${s.card.title}${s.card.sub && s.card.kind === 'chapter' ? ` – ${s.card.sub}` : ''}`);
    else if (s.type === 'clip' && s.part === 'main' && s.h.game.key !== lastGame && !out.some((l) => l.endsWith(s.h.game.name))) {
      if (!segs.some((x) => x.type === 'card' && x.card.kind === 'chapter')) out.push(`${clock(t)} ${s.h.game.name}`);
    }
    if (s.type === 'clip') lastGame = s.h.game.key;
    t += segmentSeconds(s);
  }
  // YouTube wants the first chapter at 0:00.
  if (out.length && !out[0].startsWith('0:00')) out.unshift('0:00 Start');
  return out.join('\n');
}

export const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
