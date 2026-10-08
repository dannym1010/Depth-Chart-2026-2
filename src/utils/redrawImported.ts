// Plays imported from a playbook (Hudl PDF, a list) drawn the way the play builder draws ours: the call read
// from the name (formation, backfield, side, the back to the hole), the blocking and the ball path, and our
// defense lined up on it. A receiver or back whose written job names a route or a block (STALK, SLANT, GO...)
// gets that line. Only the picture and the builder's settings are new; the play's name, assignments, notes,
// wristband number and tags stay as imported.
import type { PlayBuilderState, PlayDatabaseEntry } from '../types/callSheet';
import { callDrawing } from './callDiagram';
import { OUR_DEFENSE_LOOKS, alignDefenseTechniques, diagramSvg, runningHoleXs, type PlayStroke } from './footballEngine';
import { getActionsForPosition } from './playActionPresets';
import { isScoutPlayEntry } from './scoutOppPlays';
import { withMyAlignment } from '../hudlScout/utils/ourDefense';

/** One of our offensive plays that was never drawn in the builder (imported, or added by name). */
export function needsRedraw(p: PlayDatabaseEntry): boolean {
  return p.unit === 'offense' && !p.builder && !isScoutPlayEntry(p) && Boolean(p.name?.trim());
}

/** A written job's route or block, as the name of one of the builder's player actions. */
const JOB_LINES: { when: RegExp; action: RegExp }[] = [
  { when: /\bSTALK\b/, action: /^Stalk Block/ },
  { when: /\bCRACK\b/, action: /^Crack Block/ },
  { when: /\bSLANT\b/, action: /Quick Slant/ },
  { when: /\b(GO|FADE|STREAK|FLY|VERTICAL)\b/, action: /Go \/ Fade/ },
  { when: /\bHITCH\b|\bSTOP\b/, action: /Hitch/ },
  { when: /\bCURL\b/, action: /Deep Curl/ },
  { when: /\bPOST\b/, action: /Post/ },
  { when: /\b(CORNER|FLAG)\b/, action: /Corner/ },
  { when: /\b(DRAG|SHALLOW)\b/, action: /Drag/ },
  { when: /\bDIG\b/, action: /Deep In/ },
  { when: /\bQUICK OUT\b|^OUT\b|\bOUT ROUTE\b/, action: /Quick Out/ },
  { when: /\bSWING\b.*\bLEFT\b/, action: /Swing Route Left/ },
  { when: /\bSWING\b.*\bRIGHT\b/, action: /Swing Route Right/ },
  { when: /\bWHEEL\b.*\bLEFT\b/, action: /Wheel Route Left/ },
  { when: /\bWHEEL\b.*\bRIGHT\b/, action: /Wheel Route Right/ },
];

/** The play's position for a written job's position ("QB" → 1, "Y1", "X"...); null for the line. */
function roleFor(pos: string): string | null {
  const p = String(pos || '').trim().toUpperCase();
  if (p === 'QB' || p === 'Q' || p === 'QB1') return '1';
  if (p === 'FB' || p === 'FB2') return '2';
  if (p === 'TB' || p === 'RB' || p === 'TB3') return '3';
  if (/^[1-4]$/.test(p) || /^(X|Z|H|Y\d?|W\d?)$/.test(p)) return p;
  return null;
}

export interface Redrawn {
  builder: PlayBuilderState;
  /** The picture as an SVG data URL. */
  diagramUrl: string;
  /** Lines taken from the written jobs (for the coach to see what was read). */
  fromJobs: { role: string; job: string; line: string }[];
}

/** The play drawn the builder's way, or null when its name can't be lined up. */
export function redrawFromName(p: PlayDatabaseEntry): Redrawn | null {
  const kind = p.type === 'pass' || p.type === 'play_action' ? 'pass' : p.type === 'screen' ? 'screen' : undefined;
  const d = callDrawing({ name: p.name, formation: p.formation, personnel: p.personnel, kind });
  if (!d) return null;
  const nodes = d.play.nodes;
  let strokes: PlayStroke[] = [...d.strokes];
  const fromJobs: Redrawn['fromJobs'] = [];
  const holesXs = runningHoleXs(nodes);
  const qbNode = nodes.find((n) => n.role === '1') || null;
  for (const a of p.assignments || []) {
    const role = roleFor(a.pos);
    if (!role || role === '1') continue;
    const node = nodes.find((n) => n.role === role);
    if (!node) continue;
    const text = String(a.text || '').toUpperCase();
    const rule = JOB_LINES.find((r) => r.when.test(text));
    if (!rule) continue;
    const preset = getActionsForPosition(role, Boolean(node.line)).find((x) => rule.action.test(x.name));
    if (!preset) continue;
    const line = { ...preset.generateStroke(node, { holesXs, qbNode }), label: preset.name };
    // His line replaces the one drawn for him.
    strokes = strokes.filter((st) => !(st.points[0] && Math.hypot(st.points[0].x - node.x, st.points[0].y - node.y) < 1.4));
    strokes.push(line);
    fromJobs.push({ role, job: a.text, line: preset.name });
  }
  const look = OUR_DEFENSE_LOOKS[d.lookKey];
  const defense = look ? withMyAlignment(d.lookKey, alignDefenseTechniques(look.nodes, nodes)) : [];
  const builder: PlayBuilderState = {
    personnel: d.setup.personnel,
    baseKey: d.setup.baseKey,
    backfield: d.setup.backfield,
    conceptKey: d.conceptKey,
    runId: d.runId,
    family: d.setup.family,
    strength: d.setup.strength,
    hash: 'Middle',
    hole: d.setup.hole,
    ball: String(d.ball),
    tags: d.tags,
    coachNote: '',
    situations: p.situations || [],
    defenseKey: d.lookKey,
    putDefInName: false,
    overrides: {},
    // Lines from the written jobs are the coach's own lines now (the builder keeps them as drawn).
    ...(fromJobs.length ? { strokes } : {}),
    name: p.name,
  };
  return { builder, diagramUrl: diagramSvg(d.play, strokes, defense, String(d.ball)), fromJobs };
}
