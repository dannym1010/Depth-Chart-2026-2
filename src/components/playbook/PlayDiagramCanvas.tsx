import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FIELD_SVG,
  fieldBgSvg,
  fieldToSvg,
  shapeDrawnLeg,
  isDefenseRole,
  diagramLabel,
  skillDiagramLabel,
  strokePaths,
  MOTION_COLOR,
  svgToField,
  DEFENSE_COLOR,
  shownText,
  tagColors,
  UNIT_TAG,
  tagWidth,
  type NodePlayer,
  runningHoleXs,
  type AssembledPlay,
  type DrawKind,
  type PlayNode,
  type PlayStroke,
} from '../../utils/footballEngine';
import { COLOR, PlayerAssignmentPanel, arrowPts, strokeFor, tBar } from './PlayerAssignmentPanel';
import type { PlayerActionPreset } from '../../utils/playActionPresets';
import type { DefenseWho } from './PlayerAssignmentPanel';

const KIND_LABEL: Record<DrawKind, string> = { run: 'Run', pass: 'Route', block: 'Block' };
/** Keyboard shortcuts for the tools (when the field has focus). */
const TOOL_KEYS: Record<string, Tool> = { v: 'move', r: 'run', p: 'pass', b: 'block', m: 'motion' };

type Pt = { x: number; y: number };

/** Zoom in steps of 5%: 75% (the field with room around it) to 125% (1 = the whole field). */
export const ZOOM_LEVELS = Array.from({ length: 11 }, (_, i) => Math.round((0.75 + i * 0.05) * 100) / 100);
/** Where zooming in centers by default: the box, just behind the line of scrimmage. */
const ZOOM_HOME = { cx: 380, cy: 335 };
/**
 * The part of the field shown at this zoom around this center: zoomed in, kept on the field; zoomed out,
 * the whole field in the middle with room around it.
 */
export function zoomView(zoom: number, center: { cx: number; cy: number }, w: number, h: number) {
  const vw = w / zoom;
  const vh = h / zoom;
  const x = vw >= w ? (w - vw) / 2 : Math.max(0, Math.min(w - vw, center.cx - vw / 2));
  const y = vh >= h ? (h - vh) / 2 : Math.max(0, Math.min(h - vh, center.cy - vh / 2));
  return { x, y, vw, vh };
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const m = svg.getScreenCTM();
  if (!m) return { cx: 0, cy: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { cx: p.x, cy: p.y };
}

function hitNode(nodes: PlayNode[], cx: number, cy: number, tolerance = 18) {
  let best: PlayNode | null = null;
  let bestD = tolerance;
  nodes.forEach((n) => {
    const p = fieldToSvg(n.x, n.y);
    const d = Math.hypot(p.cx - cx, p.cy - cy);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  });
  return best as PlayNode | null;
}

/** Distance (in screen units) from a point to a segment, and where along it the nearest point is. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

/** The line under the pointer (topmost first), and which segment of it. */
function hitStroke(strokes: PlayStroke[], cx: number, cy: number, tolerance = 12) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const pts = strokes[i].points.map((p) => fieldToSvg(p.x, p.y));
    for (let j = 0; j < pts.length - 1; j++) {
      if (toSegment(cx, cy, pts[j].cx, pts[j].cy, pts[j + 1].cx, pts[j + 1].cy).d <= tolerance) return { index: i, segment: j };
    }
  }
  return null;
}

/** The bend point of a line under the pointer. */
function hitVertex(stroke: PlayStroke | undefined, cx: number, cy: number, tolerance = 12) {
  if (!stroke) return -1;
  let best = -1;
  let bestD = tolerance;
  stroke.points.forEach((p, i) => {
    const s = fieldToSvg(p.x, p.y);
    const d = Math.hypot(s.cx - cx, s.cy - cy);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** A freehand line cut down to its bends (Douglas-Peucker), so it has a few points a coach can drag. */
export function simplifyLine(points: Pt[], tolerance = 0.35): Pt[] {
  if (points.length <= 2) return points;
  const a = points[0];
  const b = points[points.length - 1];
  let far = 0;
  let farD = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = toSegment(points[i].x, points[i].y, a.x, a.y, b.x, b.y).d;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  if (farD <= tolerance) return [a, b];
  return [...simplifyLine(points.slice(0, far + 1), tolerance).slice(0, -1), ...simplifyLine(points.slice(far), tolerance)];
}

/** The field (yard lines, ticks, numbers, line of scrimmage): the same as the saved picture. */
const FIELD_BG = fieldBgSvg();

const ICON_BTN =
  'h-9 min-w-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 text-xs font-black shadow-xs transition-all active:scale-95';

interface Props {
  play: AssembledPlay;
  nodes: PlayNode[];
  strokes: PlayStroke[];
  ballRole: string;
  formLabel: string;
  playLabel: string;
  vsLabel: string;
  /** The name the coach calls it. When set, that box on the diagram is an input. */
  playName?: string;
  onPlayName?: (value: string) => void;
  onPlayNameCommit?: (value: string) => void;
  /** Our defense on the play. When set, the "vs." box is a menu. */
  defenseChoices?: { id: string; name: string }[];
  defenseValue?: string;
  onDefense?: (id: string) => void;
  /** Shorter picture, so the name and the call stay on screen beside the video. */
  dense?: boolean;
  coachNote: string;
  onCoachNote: (v: string) => void;
  onMove: (role: string, x: number, y: number) => void;
  onStrokes: (next: PlayStroke[]) => void;
  onReset: () => void;
  /** The lines are the coach's own (not the builder's drawing): moving a player carries his lines with him. */
  linesFollow?: boolean;
  onBallCarrierChange?: (role: string) => void;
  onHoleChange?: (hole: number) => void;
  onSelectPlayer?: (node: PlayNode | null) => void;
  /** 'minimal': just the field and its tools. The screen around it shows the name, defense and note. */
  chrome?: 'full' | 'minimal';
  /** Where the "who does what" panel goes (e.g. a side tab). Under the field when not given. */
  assignmentHost?: HTMLElement | null;
  /** Rename a player on the diagram. */
  onLabelChange?: (role: string, label: string) => void;
  /** Our defense tagged from the depth chart: who is at each spot (hover shows it) and a way to change one. */
  defenseWho?: DefenseWho;
  /** Whose lines are drawn: the offense's (default) or our defense's (a defensive play: blitzes, drops). */
  drawFor?: 'offense' | 'defense';
}

type Tool = DrawKind | 'move' | 'motion';
type Drag =
  /** Moving a player: where he started, the lines then (his own move with him), and where he is now. */
  | { mode: 'player'; role: string; startCx: number; startCy: number; moved: boolean; from: Pt; startLines: PlayStroke[]; at: Pt | null }
  | { mode: 'vertex'; index: number; vertex: number }
  | { mode: 'line'; index: number; from: Pt; start: Pt[] }
  /** Zoomed in: dragging empty field moves the view. */
  | { mode: 'pan'; clientX: number; clientY: number; from: { cx: number; cy: number } }
  /** Drawing: the open line, how many points it had before this press, a new line or not. */
  | { mode: 'draw'; index: number; anchor: number; fresh: boolean; downCx: number; downCy: number; moved: boolean }
  | null;

export const PlayDiagramCanvas: React.FC<Props> = ({
  play,
  nodes: nodesProp,
  strokes: strokesProp,
  ballRole,
  formLabel,
  playLabel,
  vsLabel,
  playName,
  onPlayName,
  onPlayNameCommit,
  defenseChoices,
  defenseValue,
  onDefense,
  dense,
  coachNote,
  onCoachNote,
  onMove,
  onStrokes,
  onReset,
  linesFollow,
  onBallCarrierChange,
  onHoleChange,
  onSelectPlayer,
  chrome = 'full',
  assignmentHost,
  onLabelChange,
  defenseWho,
  drawFor = 'offense',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<Drag>(null);
  // While dragging, the lines and the dragged player live here and redraw once a frame; the builder
  // gets the result once, when the drag ends (redrawing the whole builder on every move was choppy).
  const [draft, setDraft] = useState<PlayStroke[] | null>(null);
  const [dragPos, setDragPos] = useState<{ role: string; x: number; y: number } | null>(null);
  const strokes = draft ?? strokesProp;
  const nodes = useMemo(
    () => (dragPos ? nodesProp.map((n) => (n.role === dragPos.role ? { ...n, x: dragPos.x, y: dragPos.y } : n)) : nodesProp),
    [nodesProp, dragPos]
  );
  const frame = useRef<number | null>(null);
  const pending = useRef<{ strokes?: PlayStroke[]; pos?: { role: string; x: number; y: number }; ghost?: Pt | null }>({});
  const flushFrame = () => {
    frame.current = null;
    const p = pending.current;
    pending.current = {};
    if (p.strokes) setDraft(p.strokes);
    if (p.pos) setDragPos(p.pos);
    if (p.ghost !== undefined) setGhost(p.ghost);
  };
  const schedule = () => {
    if (frame.current == null) frame.current = requestAnimationFrame(flushFrame);
  };
  const cancelFrame = () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = {};
  };
  useEffect(() => cancelFrame, []);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // One step per gesture burst, so a pinch doesn't race through every level.
      const now = Date.now();
      if (now - last < 60) return;
      last = now;
      zoomRef.current(e.deltaY < 0 ? 1 : -1, clientToSvg(svg, e.clientX, e.clientY));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);
  /** Lines changed mid-drag: shown on the next frame, sent to the builder when the drag ends. */
  const preview = (next: PlayStroke[]) => {
    strokesRef.current = next;
    pending.current.strokes = next;
    schedule();
  };
  const [tool, setTool] = useState<Tool>('move');
  // The line being drawn (stays open for more legs until it's finished), and the pointer for its next leg.
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const openRef = useRef<number | null>(null);
  const [ghost, setGhost] = useState<Pt | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  // Phones open zoomed in on the box, so the players are big enough to tap.
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 1.25 : 1));
  const [center, setCenter] = useState(ZOOM_HOME);
  const zoomBy = (dir: 1 | -1, at?: { cx: number; cy: number }) => {
    const i = ZOOM_LEVELS.findIndex((z) => z >= zoom - 0.001);
    const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, i + dir))];
    if (next === zoom) return;
    // Zooming at a point keeps that point under the pointer.
    if (at) {
      const v = zoomView(zoom, center, FIELD_SVG.w, FIELD_SVG.h);
      const fx = (at.cx - v.x) / v.vw;
      const fy = (at.cy - v.y) / v.vh;
      const nw = FIELD_SVG.w / next;
      const nh = FIELD_SVG.h / next;
      setCenter({ cx: at.cx - fx * nw + nw / 2, cy: at.cy - fy * nh + nh / 2 });
    } else if (next > 1 && zoom === 1) setCenter(ZOOM_HOME);
    setZoom(next);
  };
  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const selectedPlayer = selectedRole ? nodes.find((n) => n.role === selectedRole) || null : null;
  const [previewAction, setPreviewAction] = useState<PlayerActionPreset | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ role: string; x: number; y: number; w: number } | null>(null);
  // The last tap on a player, and who was selected before it: a quick second tap on the same player
  // is a double-click, which draws the selected player blocking them.
  const lastTap = useRef<{ role: string; at: number; from: string | null } | null>(null);
  const history = useRef<PlayStroke[][]>([]);
  const strokesRef = useRef(strokes);
  // Mid-drag the ref runs ahead of what's drawn (it has this frame's moves), so leave it alone then.
  if (!drag.current) strokesRef.current = strokes;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const { w, h, losY, scaleY } = FIELD_SVG;
  const sel = selected != null && selected < strokes.length ? selected : null;


  /** Remember the lines before a change, for Undo. */
  const remember = () => {
    history.current = [...history.current.slice(-39), strokesRef.current];
  };
  const change = (next: PlayStroke[]) => {
    strokesRef.current = next;
    onStrokes(next);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    setSelected(null);
    change(prev);
  };
  const removeSelected = () => {
    if (sel == null) return;
    remember();
    change(strokes.filter((_, i) => i !== sel));
    setSelected(null);
  };
  const setKind = (kind: DrawKind) => {
    if (sel == null) return;
    remember();
    change(strokes.map((s, i) => (i === sel ? { ...s, kind } : s)));
  };

  const selectPlayer = (role: string | null) => {
    setSelectedRole(role);
    setPreviewAction(null);
    if (role) {
      finishLine();
      setSelected(null);
      setTool('move');
    }
    onSelectPlayer?.(role ? nodesRef.current.find((n) => n.role === role) || null : null);
  };

  const setOpen = (i: number | null) => {
    openRef.current = i;
    setOpenIdx(i);
    if (i == null) setGhost(null);
  };
  /** Finish the line being drawn: drop repeated points (a double-click lands twice), and a line with no legs. */
  const finishLine = () => {
    const i = openRef.current;
    if (i == null) return;
    setOpen(null);
    const cur = strokesRef.current;
    const line = cur[i];
    if (!line) return;
    const kept: number[] = [];
    line.points.forEach((p, j) => {
      const prev = kept.length ? line.points[kept[kept.length - 1]] : null;
      if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.3) kept.push(j);
    });
    if (kept.length < 2) {
      change(cur.filter((_, j) => j !== i));
      setSelected(null);
      return;
    }
    const motion = line.motion ? kept.filter((j) => j <= line.motion!).length - 1 : 0;
    const { motion: _m, ...rest } = line;
    change(cur.map((x, j) => (j === i ? { ...rest, points: kept.map((k) => line.points[k]), ...(motion > 0 ? { motion } : {}) } : x)));
  };
  /** Pick a tool. Picking Route, Run or Block while a motion is being drawn keeps drawing that player's line. */
  const pickTool = (id: Tool) => {
    if (id === 'move') finishLine();
    setTool(id);
    if (id !== 'move' && openRef.current == null) setSelected(null);
  };
  /** The legs just drawn take the tool's kind: motion only right off the player, before the play's line. */
  const withKind = (line: PlayStroke, anchor: number, t: Tool): PlayStroke => {
    const last = line.points.length - 1;
    if (t === 'motion') {
      const allMotion = (line.motion || 0) >= anchor - 1;
      return allMotion ? { ...line, motion: last } : line;
    }
    return t === 'move' ? line : { ...line, kind: t };
  };
  /** A block that ends on a defender stops at his edge with the T, and says who. */
  const snapBlock = (line: PlayStroke): { line: PlayStroke; done: boolean } => {
    const end = line.points[line.points.length - 1];
    const from = line.points[line.points.length - 2];
    if (!end || !from) return { line, done: false };
    const e = fieldToSvg(end.x, end.y);
    const target = hitNode(nodesRef.current.filter((n) => isDefenseRole(n.role)), e.cx, e.cy, 22);
    if (!target) return { line, done: false };
    const a = fieldToSvg(from.x, from.y);
    const b = fieldToSvg(target.x, target.y);
    const dist = Math.hypot(b.cx - a.cx, b.cy - a.cy);
    const back = Math.min(14, dist / 2);
    const stop = svgToField(b.cx - ((b.cx - a.cx) / (dist || 1)) * back, b.cy - ((b.cy - a.cy) / (dist || 1)) * back);
    const points = [...line.points.slice(0, -1), { x: Math.round(stop.x * 100) / 100, y: Math.round(stop.y * 100) / 100 }];
    return { line: { ...line, points, label: line.label || `Block ${shownText(target, diagramLabel(target.role))}` }, done: true };
  };

  const handleApplyAction = (preset: PlayerActionPreset) => {
    if (!selectedPlayer) return;
    const pNode = selectedPlayer;
    remember();
    const hXs = runningHoleXs(nodes);
    const qb = nodes.find((n) => n.role === '1' || n.role === 'QB');
    const newStroke = { ...preset.generateStroke(pNode, { holesXs: hXs, qbNode: qb }), label: preset.name };
    const mine = strokeFor(strokes, pNode);
    change([...strokes.filter((s) => s !== mine), newStroke]);
    // A run for the ball carrier calls the hole. Anyone else's path (a lead block, a fake) leaves it alone.
    if (preset.category === 'run' && preset.hole != null && pNode.role === ballRole && onHoleChange) {
      onHoleChange(preset.hole);
    }
  };

  /** Draw the blocker's line to a player, ending at the edge of that player with the block's T. */
  const drawBlock = (blockerRole: string, targetRole: string) => {
    const blocker = nodesRef.current.find((n) => n.role === blockerRole);
    const target = nodesRef.current.find((n) => n.role === targetRole);
    if (!blocker || !target || blockerRole === targetRole) return;
    const a = fieldToSvg(blocker.x, blocker.y);
    const b = fieldToSvg(target.x, target.y);
    const dist = Math.hypot(b.cx - a.cx, b.cy - a.cy);
    // Stop just short of the player's center so the T lands on them, not under their number.
    const back = Math.min(14, dist / 2);
    const end = svgToField(b.cx - ((b.cx - a.cx) / (dist || 1)) * back, b.cy - ((b.cy - a.cy) / (dist || 1)) * back);
    const name = shownText(target, diagramLabel(target.role));
    const line: PlayStroke = {
      kind: 'block',
      points: [{ x: blocker.x, y: blocker.y }, { x: Math.round(end.x * 100) / 100, y: Math.round(end.y * 100) / 100 }],
      label: `Block ${name}`,
    };
    const mine = strokeFor(strokesRef.current, blocker);
    remember();
    change([...strokesRef.current.filter((st) => st !== mine), line]);
  };

  const handleClearPlayerRoute = (role: string) => {
    const pNode = nodes.find((n) => n.role === role);
    if (!pNode) return;
    const mine = strokeFor(strokes, pNode);
    if (!mine) return;
    remember();
    change(strokes.filter((s) => s !== mine));
  };

  const pointFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0, cx: 0, cy: 0 };
    const { cx, cy } = clientToSvg(svg, e.clientX, e.clientY);
    return { ...svgToField(cx, cy), cx, cy };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    if (tool === 'move') {
      const vertex = sel != null ? hitVertex(strokes[sel], p.cx, p.cy) : -1;
      if (sel != null && vertex >= 0) {
        remember();
        drag.current = { mode: 'vertex', index: sel, vertex };
        return;
      }
      const n = hitNode(nodes, p.cx, p.cy);
      if (n) {
        if (linesFollow) remember();
        drag.current = { mode: 'player', role: n.role, startCx: p.cx, startCy: p.cy, moved: false, from: { x: n.x, y: n.y }, startLines: strokesRef.current, at: null };
        return;
      }
      const hit = hitStroke(strokes, p.cx, p.cy);
      if (hit) {
        setSelected(hit.index);
        remember();
        drag.current = { mode: 'line', index: hit.index, from: { x: p.x, y: p.y }, start: strokes[hit.index].points };
        return;
      }
      setSelected(null);
      // Zoomed in: dragging empty field moves the view (from where it is now, kept on the field).
      const v = zoomView(zoom, center, w, h);
      drag.current = zoom > 1 ? { mode: 'pan', clientX: e.clientX, clientY: e.clientY, from: { cx: v.x + v.vw / 2, cy: v.y + v.vh / 2 } } : null;
      return;
    }
    // Drawing. A press on another of our players starts his line (from his spot); anywhere else adds a leg
    // to the line being drawn (or starts one there).
    boxRef.current?.focus({ preventScroll: true });
    const near = hitNode(nodesRef.current, p.cx, p.cy, 20);
    let cur = strokesRef.current;
    let i = openRef.current;
    const open = i != null ? cur[i] : null;
    const onOurs = near && (drawFor === 'defense' ? isDefenseRole(near.role) : !isDefenseRole(near.role));
    const atStart = open && near && Math.hypot(open.points[0].x - near.x, open.points[0].y - near.y) < 1.2;
    if (open && onOurs && !atStart) {
      finishLine();
      cur = strokesRef.current;
      i = null;
    }
    remember();
    const here = { x: p.x, y: p.y };
    if (i == null || !cur[i]) {
      const start = onOurs ? { x: near!.x, y: near!.y } : here;
      const line: PlayStroke = tool === 'motion' ? { kind: 'pass', points: [start, here], motion: 1 } : { kind: tool as DrawKind, points: [start, here] };
      i = cur.length;
      change([...cur, line]);
      setOpen(i);
      drag.current = { mode: 'draw', index: i, anchor: 1, fresh: true, downCx: p.cx, downCy: p.cy, moved: false };
    } else {
      drag.current = { mode: 'draw', index: i, anchor: cur[i].points.length, fresh: false, downCx: p.cx, downCy: p.cy, moved: false };
      change(cur.map((x, j) => (j === i ? { ...x, points: [...x.points, here] } : x)));
    }
    setSelected(i);
  };

  /** The defender under the pointer (when defenders are tagged), for the "who plays here" card. */
  const updateHover = (e: React.PointerEvent) => {
    if (!defenseWho || e.pointerType === 'touch') return;
    const svg = svgRef.current;
    const box = fieldRef.current?.getBoundingClientRect();
    if (!svg || !box) return;
    const { cx, cy } = clientToSvg(svg, e.clientX, e.clientY);
    const n = hitNode(nodesRef.current.filter((x) => isDefenseRole(x.role)), cx, cy);
    if (!n) return setHover((h) => (h ? null : h));
    setHover((h) => (h && h.role === n.role && Math.abs(h.x - (e.clientX - box.left)) < 2 && Math.abs(h.y - (e.clientY - box.top)) < 2 ? h : { role: n.role, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width }));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) updateHover(e);
    if (!d && openRef.current != null && e.pointerType !== 'touch') {
      const g = pointFromEvent(e);
      pending.current.ghost = { x: g.x, y: g.y };
      schedule();
    }
    if (!svgRef.current || !d) return;
    if (hover) setHover(null);
    const p = pointFromEvent(e);
    const cur = strokesRef.current;
    if (d.mode === 'player') {
      // A small wobble on a click doesn't move the player.
      if (!d.moved && Math.hypot(p.cx - d.startCx, p.cy - d.startCy) <= 4) return;
      d.moved = true;
      const x = Math.max(-18, Math.min(18, p.x));
      const y = Math.max(-11, Math.min(20, p.y));
      d.at = { x, y };
      pending.current.pos = { role: d.role, x, y };
      if (linesFollow) {
        const dx = x - d.from.x;
        const dy = y - d.from.y;
        const moved = d.startLines.map((s) =>
          s.points.length && Math.hypot(s.points[0].x - d.from.x, s.points[0].y - d.from.y) < 1.1
            ? { ...s, points: s.points.map((q) => ({ ...q, x: q.x + dx, y: q.y + dy })) }
            : s
        );
        if (moved.some((s, i) => s !== d.startLines[i])) preview(moved);
      }
      schedule();
      return;
    }
    if (d.mode === 'pan') {
      const box = svgRef.current.getBoundingClientRect();
      const v = zoomView(zoom, d.from, w, h);
      const k = v.vw / (box.width || 1);
      const next = { cx: d.from.cx - (e.clientX - d.clientX) * k, cy: d.from.cy - (e.clientY - d.clientY) * k };
      // Kept to where the view can go, so dragging back moves right away.
      const half = { w: v.vw / 2, h: v.vh / 2 };
      setCenter({ cx: Math.max(half.w, Math.min(w - half.w, next.cx)), cy: Math.max(half.h, Math.min(h - half.h, next.cy)) });
      return;
    }
    if (d.mode === 'vertex') {
      preview(cur.map((s, i) => (i === d.index ? { ...s, points: s.points.map((q, j) => (j === d.vertex ? { ...q, x: p.x, y: p.y } : q)) } : s)));
      return;
    }
    if (d.mode === 'line') {
      const dx = p.x - d.from.x;
      const dy = p.y - d.from.y;
      preview(cur.map((s, i) => (i === d.index ? { ...s, points: d.start.map((q) => ({ ...q, x: q.x + dx, y: q.y + dy })) } : s)));
      return;
    }
    const line = cur[d.index];
    if (!line) return;
    if (Math.hypot(p.cx - d.downCx, p.cy - d.downCy) > 5) d.moved = true;
    // The hand's path: a point every few pixels (jitter in between is dropped), drawn smooth as it goes. When
    // the drag ends it becomes straight if it was drawn straight, or keeps its curve.
    const prev = line.points[line.points.length - 1];
    if (prev) {
      const ps = fieldToSvg(prev.x, prev.y);
      if (Math.hypot(p.cx - ps.cx, p.cy - ps.cy) < 5) return;
    }
    const smoothed = line.points.map((q, j) => (j > d.anchor && !q.smooth ? { ...q, smooth: true } : q));
    preview(cur.map((s, i) => (i === d.index ? { ...s, points: [...smoothed, { x: p.x, y: p.y }] } : s)));
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    // Whatever this frame hasn't drawn yet is in the ref; the drag's result goes to the builder now.
    cancelFrame();
    setDraft(null);
    setDragPos(null);
    if (d.mode === 'pan') return;
    const cur = strokesRef.current;
    if (d.mode === 'player' && d.moved && d.at) {
      onMove(d.role, d.at.x, d.at.y);
      if (cur !== strokesProp) onStrokes(cur);
      return;
    }
    if (d.mode === 'player' && !d.moved) {
      const now = Date.now();
      const last = lastTap.current;
      const clicked = nodesRef.current.find((n) => n.role === d.role);
      // Double-click a player while another (offense) player was selected: that player blocks them.
      if (last && clicked && last.role === d.role && now - last.at < 450 && last.from && last.from !== d.role && !isDefenseRole(last.from)) {
        lastTap.current = null;
        drawBlock(last.from, d.role);
        selectPlayer(last.from);
        return;
      }
      lastTap.current = { role: d.role, at: now, from: selectedRole };
      selectPlayer(selectedRole === d.role ? null : d.role);
      return;
    }
    if (d.mode === 'draw') {
      let line = cur[d.index];
      if (!line) return;
      if (!d.moved) {
        // A tap: on a new line it only picks the start (click again for each break); otherwise it adds a break.
        if (d.fresh) line = { ...line, points: line.points.slice(0, 1), ...(line.motion ? { motion: 0 } : {}) };
      } else {
        // Straight where it was drawn straight, curved where it was drawn curved. A new line starts on the player;
        // a later leg starts where the press added its point.
        const from = d.fresh ? d.anchor - 1 : d.anchor;
        const leg = shapeDrawnLeg(line.points.slice(from));
        line = { ...line, points: [...line.points.slice(0, from + 1), ...leg.slice(1)] };
      }
      if (line.points.length > d.anchor || !d.fresh) line = withKind(line, d.anchor, tool);
      let done = false;
      if (tool === 'block' && line.points.length >= 2) ({ line, done } = snapBlock(line));
      change(cur.map((s, i) => (i === d.index ? line! : s)));
      if (done) finishLine();
      return;
    }
    const before = history.current[history.current.length - 1];
    if (before === cur) history.current.pop();
    // A bend or a whole line dragged: sent once, now.
    else if (cur !== strokesProp) onStrokes(cur);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'move') {
      finishLine();
      return;
    }
    if (sel == null) return;
    const p = pointFromEvent(e);
    const s = strokes[sel];
    const vertex = hitVertex(s, p.cx, p.cy);
    if (vertex >= 0) {
      if (s.points.length <= 2) return;
      remember();
      change(strokes.map((x, i) => (i === sel ? { ...x, points: x.points.filter((_, j) => j !== vertex) } : x)));
      return;
    }
    const hit = hitStroke([s], p.cx, p.cy);
    if (!hit) return;
    remember();
    const pts = [...s.points];
    pts.splice(hit.segment + 1, 0, { x: p.x, y: p.y });
    change(strokes.map((x, i) => (i === sel ? { ...x, points: pts } : x)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel != null) {
      e.preventDefault();
      removeSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape' || e.key === 'Enter') {
      if (openRef.current != null) {
        e.preventDefault();
        finishLine();
        return;
      }
      if (e.key === 'Escape') {
        setSelected(null);
        selectPlayer(null);
      }
    } else if (!e.ctrlKey && !e.metaKey && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '0')) {
      e.preventDefault();
      if (e.key === '0') setZoom(1);
      else zoomBy(e.key === '-' ? -1 : 1);
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) {
      e.preventDefault();
      pickTool(TOOL_KEYS[e.key.toLowerCase()]);
    }
  };

  const holesXs = runningHoleXs(nodes);

  const glyph = (n: PlayNode) => {
    const { cx, cy } = fieldToSvg(n.x, n.y);
    const cursor = tool === 'move' ? 'pointer' : 'crosshair';
    const isSelected = selectedRole === n.role;
    const custom = n.label?.trim();
    const font = 'system-ui, -apple-system, sans-serif';
    // A name the coach typed can be longer than the usual letter: shrink it to fit the circle.
    const fit = (text: string, base: number, room: number) => Math.min(base, room / Math.max(1, text.length * 0.62));

    // Defense: a red box, wide enough for its name.
    if (isDefenseRole(n.role)) {
      const text = shownText(n, diagramLabel(n.role));
      const bw = Math.max(23, text.length * 7 + 8);
      return (
        <g key={n.role} style={{ cursor }}>
          {isSelected && (
            <rect x={cx - bw / 2 - 4} y={cy - 14} width={bw + 8} height={28} rx={6} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="4 3" />
          )}
          <rect x={cx - bw / 2} y={cy - 10.5} width={bw} height={20} rx={4} fill={DEFENSE_COLOR} stroke="#ffffff" strokeWidth={1.8} />
          <text x={cx} y={cy + 3.6} textAnchor="middle" fill="#ffffff" fontSize={10.5} fontFamily={font} fontWeight="900">
            {text}
          </text>
        </g>
      );
    }
    if (n.role === 'C') {
      const text = custom || 'C';
      const bw = Math.max(18, text.length * 6.5 + 6);
      return (
        <g key={n.role} style={{ cursor }}>
          {isSelected && (
            <rect x={cx - bw / 2 - 4} y={cy - 13} width={bw + 8} height={26} rx={5} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="4 3" />
          )}
          <rect x={cx - bw / 2} y={cy - 9} width={bw} height={18} rx={3} fill="#ffffff" stroke="#0f172a" strokeWidth={2} />
          <text x={cx} y={cy + 4} textAnchor="middle" fill="#0f172a" fontSize="10" fontFamily={font} fontWeight="900">
            {text}
          </text>
        </g>
      );
    }
    const skill = skillDiagramLabel(n.role);
    const isBack = !skill && !(n.line || !/^[1-4]$/.test(n.role));
    const isBall = (skill || isBack) && n.role === ballRole;
    const r = skill || isBack ? 11 : 10;
    const text = custom || (skill ? skill : isBack ? diagramLabel(n.role) : n.role.replace(/^O_?/, '').slice(0, 2));
    const base = skill ? 9 : isBack ? 12 : 7.5;
    const size = fit(text, base, r * 2);
    const fill = isBall ? '#ea580c' : '#ffffff';
    const ink = isBall ? '#ffffff' : '#0f172a';
    const stroke = isBall ? '#ffffff' : '#0f172a';
    return (
      <g key={n.role} style={{ cursor }}>
        {isSelected && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="4 3" />}
        {isBall && <circle cx={cx} cy={cy} r="14" fill="none" stroke="#fb923c" strokeWidth="2.5" strokeOpacity="0.85" />}
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={isBall ? 2.4 : 1.8} />
        <text x={cx} y={cy + size * 0.36} textAnchor="middle" fill={ink} fontSize={size} fontFamily={font} fontWeight="900">
          {text}
        </text>
      </g>
    );
  };

  const toolBtn = (id: Tool, title: string, children: React.ReactNode) => {
    let activeStyle = '';
    if (tool === id) {
      if (id === 'move') activeStyle = 'bg-sky-600 text-white border-sky-600 hover:bg-sky-500';
      else if (id === 'run') activeStyle = 'bg-red-600 text-white border-red-600 hover:bg-red-500';
      else if (id === 'pass') activeStyle = 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500';
      else if (id === 'block') activeStyle = 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800';
      else if (id === 'motion') activeStyle = 'bg-violet-600 text-white border-violet-600 hover:bg-violet-500';
    }
    return (
      <button
        key={id}
        type="button"
        title={title}
        aria-pressed={tool === id}
        onClick={() => pickTool(id)}
        className={`${ICON_BTN} ${activeStyle}`}
      >
        {children}
      </button>
    );
  };

  const drawing = openIdx != null;
  const hint =
    tool === 'move'
      ? sel != null
        ? 'Drag a dot to bend the line, drag the line to move it. Double-click the line to add a bend, a dot to take it out. Delete removes it.'
        : selectedPlayer && !isDefenseRole(selectedPlayer.role)
          ? `${selectedPlayer.role} is selected: double-click a defender to draw ${selectedPlayer.role} blocking that player.`
          : 'Tap a player to pick the assignment. Drag a player to move the spot. Keys: V select · R run · P route · B block · M motion.'
      : tool === 'motion'
        ? drawing
          ? 'Keep clicking or dragging his motion. Then pick Route or Run to draw the play from where the motion ends. Double-click or Enter to finish.'
          : 'Motion: start on the player, then drag or click where he goes before the snap.'
        : tool === 'block'
          ? 'Start on the blocker, end on the defender (the line stops on him with the T).'
          : drawing
            ? `Drag or click for each break of the ${KIND_LABEL[tool as DrawKind].toLowerCase()}. Draw it straight and it stays straight; curve it and it curves. Double-click or Enter to finish.`
            : `Start on a player, then drag or click for each break of the ${KIND_LABEL[tool as DrawKind].toLowerCase()}.`;

  const assignmentPanel = (
    <PlayerAssignmentPanel
      nodes={nodes}
      strokes={strokes}
      ballRole={ballRole}
      selectedRole={selectedPlayer ? selectedPlayer.role : null}
      onSelect={selectPlayer}
      onApply={handleApplyAction}
      onClear={handleClearPlayerRoute}
      onPreview={setPreviewAction}
      onBallCarrierChange={onBallCarrierChange}
    onLabelChange={onLabelChange}
    defenseWho={defenseWho}
      ctx={{ holesXs, qbNode: nodes.find((n) => n.role === '1' || n.role === 'QB') }}
    />
  );

  return (
    <div ref={boxRef} className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs outline-none" onKeyDown={onKeyDown} tabIndex={-1}>
      {/* Unified Minimalist Header Bar */}
      {chrome === 'full' && (
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 truncate max-w-[220px]" title={formLabel}>
            {formLabel}
          </span>
          {onPlayName ? (
            <input
              aria-label="Play name"
              value={playName ?? ''}
              placeholder={playLabel}
              onChange={(e) => onPlayName(e.target.value)}
              onBlur={(e) => (onPlayNameCommit || onPlayName)(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white bg-transparent hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 rounded-lg px-2 py-0.5 outline-none transition-all flex-1 min-w-[120px] max-w-[280px]"
            />
          ) : (
            <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white truncate">
              {playLabel}
            </span>
          )}
        </div>

        {/* Defense Matchup Pill */}
        {onDefense && defenseChoices ? (
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shrink-0 cursor-pointer shadow-2xs">
            <span className="text-[10px] uppercase font-black text-slate-400">vs</span>
            <select
              aria-label="Defense"
              value={defenseValue || ''}
              onChange={(e) => onDefense(e.target.value)}
              className="bg-transparent font-bold uppercase outline-none cursor-pointer text-slate-800 dark:text-slate-200 text-xs"
            >
              <option value="">Offense only</option>
              {defenseChoices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 px-2 py-1 shrink-0">
            <span className="text-[10px] uppercase font-black text-slate-400">vs</span> {vsLabel || '—'}
          </div>
        )}
      </div>
      )}

      {/* Field Canvas Container */}
      <div
        className="relative"
        ref={fieldRef}
        onPointerLeave={() => {
          setHover(null);
          setGhost(null);
        }}
      >
        {hover && defenseWho && (() => {
          // Who plays this spot in every unit; the one on the field (when a unit is picked) stands out.
          const info = defenseWho.current(hover.role);
          const units = defenseWho.everyUnit(hover.role);
          const flip = hover.x > hover.w - 210;
          return (
            <div
              className="pointer-events-none absolute z-20 rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-white shadow-lg ring-1 ring-white/10 whitespace-nowrap"
              style={{ left: flip ? undefined : hover.x + 14, right: flip ? hover.w - hover.x + 14 : undefined, top: Math.max(4, hover.y - 14) }}
            >
              <div className="text-[10.5px] font-black uppercase tracking-wide leading-tight text-slate-400">{info.spot || hover.role}</div>
              {units.map((u) => (
                <div key={u.id} className={`mt-0.5 flex items-center gap-1.5 text-[12px] leading-tight ${u.on ? 'font-black text-white' : 'font-semibold text-slate-300'}`}>
                  <span className="inline-block h-2 w-2 rounded-full ring-1 ring-white/40" style={{ background: UNIT_TAG[u.id].bg }} />
                  <span className="w-9 text-[10.5px] text-slate-400">{u.unit}</span>
                  {u.player ? `#${u.player.num} ${u.player.name}` : <span className="text-slate-500">—</span>}
                  {u.on && <span className="text-[9.5px] font-black uppercase text-emerald-300">on field</span>}
                </div>
              ))}
            </div>
          );
        })()}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
          <div role="group" aria-label="Zoom" className="inline-flex items-center rounded-lg border border-white/20 bg-slate-900/80 backdrop-blur-sm text-white shadow-xs overflow-hidden">
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out (-)"
              disabled={zoom <= ZOOM_LEVELS[0]}
              onClick={() => zoomBy(-1)}
              className="h-7 w-7 text-sm font-black cursor-pointer hover:bg-slate-900 disabled:opacity-35 disabled:cursor-default"
            >
              −
            </button>
            <button
              type="button"
              title="Back to the whole field (0)"
              onClick={() => setZoom(1)}
              className="h-7 min-w-11 px-1 border-x border-white/15 text-[11px] font-bold tabular-nums cursor-pointer hover:bg-slate-900"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in (+). Zoomed in, drag empty field with Select to move around."
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              onClick={() => zoomBy(1)}
              className="h-7 w-7 text-sm font-black cursor-pointer hover:bg-slate-900 disabled:opacity-35 disabled:cursor-default"
            >
              +
            </button>
          </div>
        </div>
        {chrome === 'full' && (
        <input
          value={coachNote}
          onChange={(e) => onCoachNote(e.target.value)}
          placeholder={play.metadata.scheme}
          className="absolute top-2.5 right-3 z-10 w-[42%] max-w-[280px] bg-transparent text-right text-[13px] font-bold text-slate-700 outline-none placeholder:text-slate-400"
        />
        )}

        <svg
          ref={svgRef}
          viewBox={(() => {
            const v = zoomView(zoom, center, w, h);
            return `${v.x} ${v.y} ${v.vw} ${v.vh}`;
          })()}
          className={`bg-[#f0f0f0] touch-none select-none ${dense ? 'max-h-64 w-auto max-w-full mx-auto' : 'w-full h-auto'} ${tool === 'move' ? (zoom > 1 ? 'cursor-grab' : 'cursor-default') : 'cursor-crosshair'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClick}
        >
          <g dangerouslySetInnerHTML={{ __html: FIELD_BG }} />
          {/* The lines: motion zigzag, then the play (dashed route, curve if drawn freehand), arrow or block T */}
          {strokes.map((st, i) => {
            const sp = strokePaths(st);
            if (!sp) return null;
            const { a, b } = sp.cap;
            const cap = tBar(a.cx, a.cy, b.cx, b.cy);
            const isSel = i === sel;
            return (
              <g key={i}>
                {isSel && [sp.motionD, sp.mainD].filter(Boolean).map((d, k) => (
                  <path key={k} d={d} fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {sp.motionD && <path d={sp.motionD} fill="none" stroke={MOTION_COLOR} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
                {sp.mainD && (
                  <path
                    d={sp.mainD}
                    fill="none"
                    stroke={sp.color}
                    strokeWidth={sp.width + 0.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={sp.dashed ? '6 4' : undefined}
                  />
                )}
                {sp.cap.t ? (
                  <line x1={cap.x1} y1={cap.y1} x2={cap.x2} y2={cap.y2} stroke={sp.color} strokeWidth="3" strokeLinecap="round" />
                ) : (
                  <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={sp.cap.color} />
                )}
              </g>
            );
          })}
          {/* The next leg of the line being drawn follows the pointer */}
          {openIdx != null && ghost && strokes[openIdx]?.points.length ? (() => {
            const lastPt = strokes[openIdx].points[strokes[openIdx].points.length - 1];
            const a = fieldToSvg(lastPt.x, lastPt.y);
            const b = fieldToSvg(ghost.x, ghost.y);
            const color = tool === 'motion' ? MOTION_COLOR : tool === 'move' ? '#94a3b8' : COLOR[tool];
            return <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={color} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="3 4" pointerEvents="none" />;
          })() : null}

          {/* Live Dashed Preview on Hover */}
          {previewAction && selectedPlayer && (() => {
            const newStroke = previewAction.generateStroke(selectedPlayer, { holesXs, qbNode: nodes.find((n) => n.role === '1' || n.role === 'QB') });
            if (newStroke.points.length < 2) return null;
            const d = newStroke.points
              .map((pt, j) => {
                const { cx, cy } = fieldToSvg(pt.x, pt.y);
                return `${j === 0 ? 'M' : 'L'}${cx},${cy}`;
              })
              .join(' ');
            const last = newStroke.points[newStroke.points.length - 1];
            const prev = newStroke.points[newStroke.points.length - 2];
            const a = fieldToSvg(prev.x, prev.y);
            const b = fieldToSvg(last.x, last.y);
            const cap = tBar(a.cx, a.cy, b.cx, b.cy);
            return (
              <g key="preview-stroke" opacity="0.85">
                <path
                  d={d}
                  fill="none"
                  stroke={COLOR[newStroke.kind]}
                  strokeWidth={newStroke.kind === 'block' ? 2.8 : 3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="5 3"
                />
                {newStroke.kind === 'block' ? (
                  <line x1={cap.x1} y1={cap.y1} x2={cap.x2} y2={cap.y2} stroke={COLOR.block} strokeWidth="3" strokeLinecap="round" />
                ) : (
                  <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={COLOR[newStroke.kind]} />
                )}
              </g>
            );
          })()}

          {/* Players: Offense in clean circles/squares, Defense in Cardinal Red badges */}
          {nodes.map(glyph)}

          {/* Selected line bend vertices */}
          {sel != null &&
            strokes[sel].points.map((pt, j) => {
              const { cx, cy } = fieldToSvg(pt.x, pt.y);
              return <circle key={`v-${j}`} cx={cx} cy={cy} r="6.5" fill="#fff" stroke="#0284c7" strokeWidth="2" style={{ cursor: 'move' }} />;
            })}
        </svg>
      </div>

      {/* Bottom Tool & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
        <div className="flex flex-wrap items-center gap-1">
          {toolBtn(
            'move',
            'Select and move players',
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 3l14 8-6 2-2 6z" />
              </svg>
              <span className="hidden sm:inline">Select</span>
            </>
          )}
          {toolBtn(
            'pass',
            'Draw a pass route (P)',
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 2">
                <path d="M5 17l9-9" />
                <path d="M14 8h5v5" />
              </svg>
              <span className="hidden sm:inline">Route</span>
            </>
          )}
          {toolBtn(
            'run',
            'Draw a run / ball path (R)',
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 19V5M7 10l5-5 5 5" />
              </svg>
              <span className="hidden sm:inline">Run</span>
            </>
          )}
          {toolBtn(
            'block',
            'Draw a block: start on the blocker, end on the defender (B)',
            <>
              <span className="text-xs font-black">⊥</span>
              <span className="hidden sm:inline">Block</span>
            </>
          )}
          {toolBtn(
            'motion',
            'Draw pre-snap motion, then switch to Route or Run to keep drawing the play (M)',
            <>
              <svg width="16" height="14" viewBox="0 0 26 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
                <path d="M2 14l3-5 3 6 3-6 3 6 3-6 3 5" />
                <path d="M21 9l3 4-4 2" />
              </svg>
              <span className="hidden sm:inline">Motion</span>
            </>
          )}
          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          {drawing && (
            <button
              type="button"
              title="Finish this line (double-click or Enter)"
              onClick={finishLine}
              className={`${ICON_BTN} bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500`}
            >
              ✓ Done
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {sel != null && !drawing && (
            <>
              {(['pass', 'run', 'block'] as DrawKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  title={`Make this line a ${KIND_LABEL[k].toLowerCase()} line`}
                  onClick={() => setKind(k)}
                  className={`${ICON_BTN} ${strokes[sel].kind === k ? 'border-sky-600 text-sky-700 dark:text-sky-400' : ''}`}
                  style={{ color: strokes[sel].kind === k ? undefined : COLOR[k] }}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
              <button type="button" title="Delete this line" onClick={removeSelected} className={`${ICON_BTN} text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40`}>
                Delete
              </button>
              <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            </>
          )}
          <button type="button" title="Undo (Ctrl+Z)" onClick={undo} disabled={!history.current.length} className={ICON_BTN}>
            ↩<span className="hidden sm:inline"> Undo</span>
          </button>
          <button
            type="button"
            title="Start over: players back in place and reset lines"
            onClick={() => {
              history.current = [];
              setSelected(null);
              onReset();
            }}
            className={ICON_BTN}
          >
            ↻<span className="hidden sm:inline"> Reset</span>
          </button>
        </div>
      </div>
      <div className="px-3 py-1 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800/40 text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
        {hint}
      </div>
      {assignmentHost ? createPortal(assignmentPanel, assignmentHost) : assignmentPanel}
    </div>
  );
};
