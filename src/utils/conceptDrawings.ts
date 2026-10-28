// A coach's own drawing of a play concept ("Counter" for the 4 back), saved once from the play builder: the next
// play picked with that concept is drawn the same, on the same players, turned to the side the play goes.
import { parseCall } from '../filmroom/callName';
import type { PlayNode, PlayStroke } from './footballEngine';

/** One drawn line, kept on the player it starts on: where he stood (from the ball) and the line from him. */
export interface ConceptLine {
  role: string;
  line?: boolean;
  at: { x: number; y: number };
  stroke: PlayStroke;
}

export interface ConceptDrawing {
  /** "counter|4": the concept and who carries it. */
  key: string;
  /** "Counter, 4 back". */
  label: string;
  /** The side it was drawn going to (L / R); drawn the other way, it's turned over. */
  side: 'L' | 'R' | '';
  lines: ConceptLine[];
  savedAt: number;
}

export type ConceptDrawings = Record<string, ConceptDrawing>;

/** The concept and its ball carrier in a call ("21 Gun Rt 44 Counter" -> counter|4); null when it names no concept. */
export function conceptKeyOf(name: string): { key: string; label: string } | null {
  const parts = parseCall(name);
  const concept = String(parts.concept || '').trim();
  if (!concept) return null;
  const back = String(parts.back || '').trim();
  const backLabel: Record<string, string> = { '1': 'QB', '2': '2 back', '3': '3 back', '4': '4 back' };
  return { key: `${concept.toLowerCase()}|${back}`, label: back ? `${concept}, ${backLabel[back] || `${back} back`}` : concept };
}

/** The way a play goes: its hole (1-4 right, 6-9 left), else its strength. */
export function playSide(hole: number | string | null | undefined, strength?: string): 'L' | 'R' | '' {
  const h = Number(hole);
  if (Number.isFinite(h) && hole !== '' && hole != null && h !== 5) return h < 5 ? 'R' : 'L';
  if (/^(l|lt|left)$/i.test(String(strength || ''))) return 'L';
  if (/^(r|rt|right)$/i.test(String(strength || ''))) return 'R';
  return '';
}

const round = (v: number) => Math.round(v * 100) / 100;

/** The player a line starts on: the nearest within 1.4 yards. */
function ownerOf(stroke: PlayStroke, nodes: PlayNode[]): PlayNode | undefined {
  const s = stroke.points?.[0];
  if (!s) return undefined;
  let best: PlayNode | undefined;
  let bestD = 1.4;
  for (const n of nodes) {
    const d = Math.hypot(s.x - n.x, s.y - n.y);
    if (d < bestD) {
      best = n;
      bestD = d;
    }
  }
  return best;
}

/** The offense's lines on the field, kept on their players (lines that start on nobody, or on the defense, stay out). */
export function captureConcept(offense: PlayNode[], strokes: PlayStroke[], ballX: number): ConceptLine[] {
  const out: ConceptLine[] = [];
  for (const st of strokes) {
    if (st.zone || st.man || st.color) continue;
    const n = ownerOf(st, offense);
    if (!n) continue;
    out.push({
      role: n.role,
      ...(n.line ? { line: true } : {}),
      at: { x: round(n.x - ballX), y: round(n.y) },
      stroke: { ...st, points: st.points.map((p) => ({ ...p, x: round(p.x - n.x), y: round(p.y - n.y) })) },
    });
  }
  return out;
}

const MIRROR_ROLE: Record<string, string> = { LT: 'RT', RT: 'LT', LG: 'RG', RG: 'LG' };

/**
 * The saved lines drawn on this play's players: each on the same player (the one in the same spot when the play
 * goes the other way, the picture turned over), moved to where he lines up. A line whose player isn't on this
 * formation is left off.
 */
export function drawConcept(d: ConceptDrawing, offense: PlayNode[], ballX: number, side: 'L' | 'R' | ''): PlayStroke[] {
  const flip = Boolean(d.side && side && d.side !== side);
  const taken = new Map<string, PlayNode>();
  const used = new Set<string>();
  const near = (spot: { x: number; y: number }, line: boolean | undefined) =>
    offense
      .filter((n) => Boolean(n.line) === Boolean(line) && !used.has(n.role))
      .map((n) => ({ n, d: Math.hypot(n.x - spot.x, n.y - spot.y) }))
      .filter((x) => x.d < 4)
      .sort((a, b) => a.d - b.d)[0]?.n;
  const out: PlayStroke[] = [];
  for (const l of d.lines) {
    let n = taken.get(l.role);
    if (!n) {
      const spot = { x: ballX + (flip ? -l.at.x : l.at.x), y: l.at.y };
      const want = flip ? MIRROR_ROLE[l.role] || l.role : l.role;
      const same = offense.find((x) => x.role === want && !used.has(x.role));
      // The same player, unless he's lined up somewhere else entirely on this play (then whoever is there).
      n = same && (!flip || Math.hypot(same.x - spot.x, same.y - spot.y) < 4) ? same : near(spot, l.line) || (!flip ? same : undefined);
      if (!n) continue;
      taken.set(l.role, n);
      used.add(n.role);
    }
    const at = n;
    out.push({ ...l.stroke, points: l.stroke.points.map((p) => ({ ...p, x: round(at.x + (flip ? -p.x : p.x)), y: round(at.y + p.y) })) });
  }
  return out;
}

// The team's saved drawings (set by the app from the team) and who may save them (null for a coach who can't edit).
let drawings: ConceptDrawings = {};
let saver: ((key: string, drawing: ConceptDrawing | null) => void) | null = null;
export function setConceptDrawings(next: ConceptDrawings | undefined) {
  drawings = next || {};
}
export const conceptDrawing = (key: string): ConceptDrawing | undefined => drawings[key];
export function setConceptDrawingSaver(fn: typeof saver) {
  saver = fn;
}
export const conceptDrawingSaver = () => saver;
