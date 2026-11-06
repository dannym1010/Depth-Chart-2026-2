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
  SHIFT_COLOR,
  svgToField,
  lineStartsOn,
  ballXOf,
  setFieldBall,
  MAN_RING,
  passThrow,
  THROW_COLOR,
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
import { computeAnimatedPlayFrame, hasDefensiveStem, playAnimationSeconds, shiftAdjusts, snapProgress } from '../../utils/playAnimation';
import { computeGapIntegrity, type GapFitSlot } from '../../utils/defenseReads';
import type { PlayNoteCheckpoint, PursuitLine } from '../../types/callSheet';
import { readSkipNotesPref, writeSkipNotesPref } from '../scouting/presentStage';

/** How far a player's mark reaches from his spot, in the drawing (a defender's box is wider for his name). */
function markRadius(n: PlayNode): number {
  if (isDefenseRole(n.role)) return Math.max(23, shownText(n, diagramLabel(n.role)).length * 7 + 8) / 2;
  return n.role === 'C' ? 10 : 11;
}

/**
 * Players drawn on top of each other (a pile at the ball, a block) pushed apart just enough to read every one,
 * never more than a couple of yards; the ball carrier keeps his spot.
 */
function spreadPile(nodes: PlayNode[], anchorRole: string): PlayNode[] {
  const pts = nodes.map((n) => {
    const p = fieldToSvg(n.x, n.y);
    return { n, x: p.cx, y: p.cy, ox: p.cx, oy: p.cy, r: markRadius(n), fixed: n.role === anchorRole };
  });
  const MAX = 34;
  for (let it = 0; it < 30; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        if (a.fixed && b.fixed) continue;
        let dx = b.x - a.x;
        let dy = (b.y - a.y) * 1.35;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + 1;
        if (d >= min) continue;
        if (d < 0.01) {
          // Right on top of each other: split them sideways.
          dx = j % 2 ? 1 : -1;
          dy = 0;
          d = 1;
        }
        const push = min - d;
        const ux = dx / d;
        const uy = dy / d / 1.35;
        const wa = a.fixed ? 0 : b.fixed ? 1 : 0.5;
        const wb = 1 - wa;
        a.x -= ux * push * wa;
        a.y -= uy * push * wa;
        b.x += ux * push * wb;
        b.y += uy * push * wb;
        moved = true;
      }
    }
    // Never far from where he really is.
    for (const p of pts) {
      const ox = p.x - p.ox;
      const oy = p.y - p.oy;
      const off = Math.hypot(ox, oy);
      if (off > MAX) {
        p.x = p.ox + (ox / off) * MAX;
        p.y = p.oy + (oy / off) * MAX;
      }
    }
    if (!moved) break;
  }
  return pts.map((p) => (Math.abs(p.x - p.ox) < 0.05 && Math.abs(p.y - p.oy) < 0.05 ? p.n : { ...p.n, ...svgToField(p.x, p.y) }));
}

const PURSUIT_COLORS = [
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#f59e0b', label: 'Gold' },
  { hex: '#10b981', label: 'Green' },
  { hex: '#ec4899', label: 'Pink' },
];

/** Play movement speeds: full, and slow motion for going over it with the team. */
const ANIM_SPEEDS = [0.1, 0.25, 0.5, 1];
/** One step back or on: this much of the play, in seconds. */
const ANIM_STEP_SECONDS = 0.1;
import type { PlayerActionPreset } from '../../utils/playActionPresets';
import type { DefenseWho } from './PlayerAssignmentPanel';

const KIND_LABEL: Record<DrawKind, string> = { run: 'Run', pass: 'Route', block: 'Block' };
/** Keyboard shortcuts for the tools (when the field has focus). */
const TOOL_KEYS: Record<string, Tool> = { v: 'move', r: 'run', p: 'pass', b: 'block', m: 'motion', s: 'shift' };

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
  /** Tallest the field may be (CSS length): narrower to fit, so the whole field shows on the screen (presenting). */
  maxFieldHeight?: string;
  /** The drawing tools under the field (off: just the field, presenting; players still drag). */
  tools?: boolean;
  /** Presentation's full screen: the field alone on the dark screen (no card, none of its own buttons), the play's movement bar over its bottom right corner. */
  bare?: boolean;
  /** Nothing on the field moves under a finger (presenting full screen: a swipe changes the play, a pencil draws over it). */
  locked?: boolean;
  /** Presenting: any scroll (a mouse wheel, two fingers on a trackpad) or a pinch zooms in on that spot, up to 4×; zoomed in, dragging moves around. */
  presentZoom?: boolean;
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
  /** Lines drawn from our defensive call (blitz, stunt, coverage): shown under the coach's own, not editable. */
  extraStrokes?: PlayStroke[];
  /** Per-defender rules (gap fit, run action, flow tempo, read key, etc.) that govern defensive movement. */
  defenseRules?: Record<string, Record<string, string>>;
  /** Live defensive gap-integrity slots to render on the line of scrimmage when "Show Gap Fits" is active. */
  gapFits?: GapFitSlot[];
  /** Defender/player role highlighted in Walkthrough Spotlight / Quiz mode. */
  spotlightRole?: string | null;
  /** Previous defensive positions when switching to a different defensive preset/front/stunt, for pre-snap stem animation. */
  stemFrom?: Record<string, { x: number; y: number }>;
  /** Previous defensive front/stunt/coverage snapshot when switching defenses, so the coach can toggle ghost comparison trails. */
  prevDefense?: {
    label: string;
    nodes: PlayNode[];
    extraStrokes: PlayStroke[];
    defenseRules?: Record<string, Record<string, string>>;
  } | null;
  /** Where our defenders set after their shift (by role): the play pauses after the shift, then they slide there. */
  shiftDefense?: Record<string, { x: number; y: number }>;
  /** The coach dragged a defender while the defense is set after the shift: his spot after the shift. */
  onShiftDefenseMove?: (role: string, x: number, y: number) => void;
  /** Back to the automatic spots after the shift (shown when the coach has moved some). */
  onShiftDefenseReset?: () => void;
  shiftDefenseEdited?: boolean;
  /** The Gaps button on the field: shows who fits each gap (`gapFits`); off when not given. */
  gapsOn?: boolean;
  onToggleGaps?: () => void;
  /** Gaps shown: tap a gap, then the defender who fits it. `over`: the gap is across the center from him. */
  onAssignGap?: (role: string, gap: 'A' | 'B' | 'C' | 'D', over: boolean) => void;
  /** Stopped on their shift (true), or not (false): the builder puts the rules panel on the rules after it. */
  onShiftStop?: (stopped: boolean) => void;
  /** Optional defensive preset switcher bar rendered right inside the Play Movement menu. */
  defensePresetBar?: React.ReactNode;
  /** Timeline checkpoints where Play Movement pauses to display a coaching note and/or pursuit angle lines. */
  checkpoints?: PlayNoteCheckpoint[];
  /** Save updated coaching note / pursuit angle checkpoints. */
  onCheckpointsChange?: (next: PlayNoteCheckpoint[]) => void;
  /** When true, Play Movement runs straight through without pausing at note checkpoints or showing notes. */
  skipNotes?: boolean;
  /** Toggle whether Play Movement skips note pauses. */
  onSkipNotesChange?: (skip: boolean) => void;
  /** Incrementing trigger to open player movement animation menu */
  playTrigger?: number;
  /** Incrementing trigger that opens Play Movement AND starts motion immediately (for Sync Split, 3s Drill, Auto-Loop). */
  startRunTrigger?: number;
  /** Continuous Walkthrough Huddle Loop mode: auto-resumes after 2.2s at pauses and loops at the end of the play. */
  loopPlay?: boolean;
  /** Toggle continuous Loop mode. */
  onLoopPlayChange?: (loop: boolean) => void;
  /** Fired when a play finishes at progress = 1 while `loopPlay` is active. */
  onLoopCycleEnd?: () => void;
  /** When true (during 3-Second Recognition Drill), hides post-snap offensive routes so players only see pre-snap alignment. */
  hideOffenseRoutes?: boolean;
  /** Active Kid Quiz target spot on the field when a defender is spotlighted in Quiz mode. */
  quizTargetSpot?: { x: number; y: number; label: string } | null;
  /** Callback when a player taps the field to answer where their spotlighted defender goes in Kid Quiz mode. */
  onQuizAttempt?: (result: {
    correct: boolean;
    distYards: number;
    tapped: { x: number; y: number };
    target: { x: number; y: number; label: string };
  }) => void;
}

type Tool = DrawKind | 'move' | 'motion' | 'shift';
type Drag =
  /** Moving a player: where he started, the lines then (his own move with him), and where he is now. */
  | { mode: 'player'; role: string; startCx: number; startCy: number; moved: boolean; from: Pt; startLines: PlayStroke[]; at: Pt | null }
  /** Moving one of our defenders to his spot after their shift (the play paused with our defense set). */
  | { mode: 'shift'; role: string; startCx: number; startCy: number; moved: boolean; at: Pt | null }
  /** A player tapped while the play is moving: picks him (his read, his job); it never moves him. */
  | { mode: 'tap'; role: string }
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
  maxFieldHeight,
  tools = true,
  bare = false,
  locked = false,
  presentZoom = false,
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
  extraStrokes,
  defenseRules,
  shiftDefense,
  onShiftDefenseMove,
  onShiftDefenseReset,
  shiftDefenseEdited,
  onShiftStop,
  gapsOn,
  onToggleGaps,
  onAssignGap,
  gapFits,
  spotlightRole,
  stemFrom,
  prevDefense,
  defensePresetBar,
  checkpoints = [],
  onCheckpointsChange,
  skipNotes: skipNotesProp,
  onSkipNotesChange,
  playTrigger = 0,
  startRunTrigger = 0,
  loopPlay: loopPlayProp,
  onLoopPlayChange,
  onLoopCycleEnd,
  hideOffenseRoutes = false,
  quizTargetSpot,
  onQuizAttempt,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<Drag>(null);
  // While dragging, the lines and the dragged player live here and redraw once a frame; the builder
  // gets the result once, when the drag ends (redrawing the whole builder on every move was choppy).
  const [draft, setDraft] = useState<PlayStroke[] | null>(null);
  const [dragPos, setDragPos] = useState<{ role: string; x: number; y: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // The movement bar stays up once opened (back to the start keeps it), until it is closed.
  const [animOpen, setAnimOpen] = useState(false);
  const [animProgress, setAnimProgress] = useState<number>(0);
  // Slow motion for going over it with the team (remembered on this device), and stopping at the snap.
  const [animSpeed, setAnimSpeedState] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('playAnimSpeed'));
      return ANIM_SPEEDS.includes(v) ? v : 1;
    } catch {
      return 1;
    }
  });
  const setAnimSpeed = (v: number) => {
    setAnimSpeedState(v);
    try {
      localStorage.setItem('playAnimSpeed', String(v));
    } catch {
      /* per device only */
    }
  };
  const [stopAtSnap, setStopAtSnapState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('playAnimStopAtSnap') === '1';
    } catch {
      return false;
    }
  });
  const setStopAtSnap = (on: boolean) => {
    setStopAtSnapState(on);
    try {
      localStorage.setItem('playAnimStopAtSnap', on ? '1' : '0');
    } catch {
      /* per device only */
    }
  };
  const [stopAtRead, setStopAtReadState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('playAnimStopAtRead') === '1';
    } catch {
      return false;
    }
  });
  const setStopAtRead = (on: boolean) => {
    setStopAtReadState(on);
    try {
      localStorage.setItem('playAnimStopAtRead', on ? '1' : '0');
    } catch {
      /* per device only */
    }
  };
  const [stopAtFit, setStopAtFitState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('playAnimStopAtFit') === '1';
    } catch {
      return false;
    }
  });
  const setStopAtFit = (on: boolean) => {
    setStopAtFitState(on);
    try {
      localStorage.setItem('playAnimStopAtFit', on ? '1' : '0');
    } catch {
      /* per device only */
    }
  };
  const [stopAtTackle, setStopAtTackleState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('playAnimStopAtTackle') === '1';
    } catch {
      return false;
    }
  });
  const setStopAtTackle = (on: boolean) => {
    setStopAtTackleState(on);
    try {
      localStorage.setItem('playAnimStopAtTackle', on ? '1' : '0');
    } catch {
      /* per device only */
    }
  };
  const [showGhostDefense, setShowGhostDefense] = useState<boolean>(false);
  const strokes = draft ?? strokesProp;
  const nodes = useMemo(
    () => (dragPos ? nodesProp.map((n) => (n.role === dragPos.role ? { ...n, x: dragPos.x, y: dragPos.y } : n)) : nodesProp),
    [nodesProp, dragPos]
  );
  // A defender being dragged to his spot after the shift shows there as he goes.
  const [shiftDrag, setShiftDrag] = useState<{ role: string; x: number; y: number } | null>(null);
  const liveShift = useMemo(
    () => (shiftDefense && shiftDrag ? { ...shiftDefense, [shiftDrag.role]: { x: shiftDrag.x, y: shiftDrag.y } } : shiftDefense),
    [shiftDefense, shiftDrag]
  );
  const adjustsToShift = useMemo(() => shiftAdjusts(nodes, [...strokes, ...(extraStrokes || [])], liveShift), [nodes, strokes, extraStrokes, liveShift]);
  const hasStem = useMemo(() => hasDefensiveStem(nodes, stemFrom) || adjustsToShift, [nodes, stemFrom, adjustsToShift]);
  const seconds = playAnimationSeconds(strokes, extraStrokes || [], adjustsToShift ? 'shift' : hasStem);
  const snapAt = snapProgress(strokes, extraStrokes || [], adjustsToShift ? 'shift' : hasStem);
  const animatedFrame = useMemo(
    () =>
      computeAnimatedPlayFrame(
        nodes,
        strokes,
        extraStrokes || [],
        ballRole,
        animProgress,
        typeof play.metadata?.targetHole === 'number' ? play.metadata.targetHole : null,
        defenseRules,
        stemFrom,
        liveShift,
      ),
    [nodes, strokes, extraStrokes, ballRole, animProgress, play.metadata?.targetHole, defenseRules, stemFrom, liveShift],
  );
  const ghostFrame = useMemo(() => {
    if (!showGhostDefense || !prevDefense) return null;
    const offNodes = nodes.filter((n) => !isDefenseRole(n.role));
    const prevDefNodes = prevDefense.nodes.filter((n) => isDefenseRole(n.role));
    return computeAnimatedPlayFrame(
      [...offNodes, ...prevDefNodes],
      strokes,
      prevDefense.extraStrokes || [],
      ballRole,
      animProgress,
      typeof play.metadata?.targetHole === 'number' ? play.metadata.targetHole : null,
      prevDefense.defenseRules,
    );
  }, [showGhostDefense, prevDefense, nodes, strokes, ballRole, animProgress, play.metadata?.targetHole]);
  const displayNodes = animProgress > 0.002 ? animatedFrame.nodes : nodes;
  /** The play is running (or stopped part way): the plan fades and the movement draws. */
  const moving = animProgress > 0.005;
  // Where each player is drawn: when the play runs, a pile at the ball is spread just enough that every player
  // can be read (the ball carrier stays on the ball).
  const drawnNodes = useMemo(() => (moving ? spreadPile(displayNodes, ballRole) : displayNodes), [moving, displayNodes, ballRole]);
  const drawnAt = useMemo(() => new Map(drawnNodes.map((n) => [n.role, fieldToSvg(n.x, n.y)])), [drawnNodes]);
  // The tackle (once it happens): who made it and where the ball is.
  const tackle = moving ? animatedFrame.collisions?.find((c) => c.kind === 'tackle' && !/Cut Away/.test(c.label)) : undefined;

  useEffect(() => {
    if (playTrigger > 0) {
      setAnimOpen(true);
      setAnimProgress(0);
      setIsPlaying(false);
    }
  }, [playTrigger]);

  useEffect(() => {
    if (startRunTrigger > 0) {
      setAnimOpen(true);
      setAnimProgress(0);
      setIsPlaying(true);
    }
  }, [startRunTrigger]);

  const [localLoopPlay, setLocalLoopPlay] = useState<boolean>(false);
  const loopPlay = loopPlayProp !== undefined ? loopPlayProp : localLoopPlay;
  const setLoopPlay = (next: boolean) => {
    setLocalLoopPlay(next);
    onLoopPlayChange?.(next);
  };

  const [quizTapResult, setQuizTapResult] = useState<{
    correct: boolean;
    distYards: number;
    tapped: { x: number; y: number };
    target: { x: number; y: number; label: string };
  } | null>(null);
  useEffect(() => {
    setQuizTapResult(null);
  }, [spotlightRole, quizTargetSpot?.label]);

  const [localSkipNotes, setLocalSkipNotes] = useState<boolean>(() => readSkipNotesPref());
  const skipNotes = skipNotesProp !== undefined ? skipNotesProp : localSkipNotes;
  const setSkipNotes = (next: boolean) => {
    setLocalSkipNotes(next);
    writeSkipNotesPref(next);
    onSkipNotesChange?.(next);
  };
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [pursuitDrawMode, setPursuitDrawMode] = useState<boolean>(false);
  const [pursuitColor, setPursuitColor] = useState<string>(PURSUIT_COLORS[0].hex);
  const [draftPursuitPoints, setDraftPursuitPoints] = useState<{ x: number; y: number }[] | null>(null);
  const pursuitDrawingRef = useRef<{ points: { x: number; y: number }[]; checkpointId: string } | null>(null);
  const sortedCheckpoints = useMemo(
    () => [...checkpoints].sort((a, b) => a.progress - b.progress),
    [checkpoints],
  );
  const activeCheckpoint = useMemo(
    () =>
      sortedCheckpoints.find((cp) => cp.id === editingCheckpointId && Math.abs(cp.progress - animProgress) <= 0.03) ||
      sortedCheckpoints.find((cp) => Math.abs(cp.progress - animProgress) <= 0.022) ||
      null,
    [sortedCheckpoints, editingCheckpointId, animProgress],
  );
  const ensureCheckpointAtCurrent = (): PlayNoteCheckpoint => {
    const existing = sortedCheckpoints.find((cp) => Math.abs(cp.progress - animProgress) <= 0.025);
    if (existing) {
      setEditingCheckpointId(existing.id);
      return existing;
    }
    const created: PlayNoteCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      progress: Math.round(animProgress * 1000) / 1000,
      note: '',
      pursuitLines: [],
    };
    onCheckpointsChange?.([...checkpoints, created]);
    setEditingCheckpointId(created.id);
    return created;
  };
  const updateCheckpoint = (id: string, patch: Partial<PlayNoteCheckpoint>) => {
    onCheckpointsChange?.(checkpoints.map((cp) => (cp.id === id ? { ...cp, ...patch } : cp)));
  };
  const deleteCheckpoint = (id: string) => {
    onCheckpointsChange?.(checkpoints.filter((cp) => cp.id !== id));
    if (editingCheckpointId === id) {
      setEditingCheckpointId(null);
      setPursuitDrawMode(false);
    }
  };

  // Where the movement is, for the loop (it decides there whether to stop: at auto-pause checkpoints, coaching note checkpoints, or the end).
  const progressRef = useRef(animProgress);
  progressRef.current = animProgress;
  const shiftSetAt = animatedFrame.shiftSetProgress;
  const defenseSetAt = animatedFrame.defenseSetProgress;
  /** Stopped with their shift set (our defense still where it was), or with our defense set after it. */
  const atShiftSet = !isPlaying && shiftSetAt !== undefined && Math.abs(animProgress - shiftSetAt) < 0.004;
  const atDefenseSet = !isPlaying && defenseSetAt !== undefined && animProgress >= defenseSetAt - 0.004 && animProgress < snapAt - 0.002;
  const atShiftStop = atShiftSet || atDefenseSet;
  // Gaps on: stopped on their shift, the gaps where everyone is now. Their shift set: their new gaps against where
  // we still are (what the shift opened up); our defense set: who fits which after our adjustment. Our blitz /
  // stunt lines go with each defender (they start from his spot as the play runs).
  const stopGaps = useMemo<GapFitSlot[] | null>(() => {
    if (!gapFits || !atShiftStop) return null;
    const def = animatedFrame.nodes.filter((n) => isDefenseRole(n.role));
    const off = animatedFrame.nodes.filter((n) => !isDefenseRole(n.role));
    const defense0 = nodes.filter((n) => isDefenseRole(n.role));
    const lines = [...strokes, ...(extraStrokes || [])].map((st) => {
      const owner = defense0.find((n) => lineStartsOn(st, n, defense0));
      const now = owner && def.find((n) => n.role === owner.role);
      if (!owner || !now) return st;
      const dx = now.x - owner.x;
      const dy = now.y - owner.y;
      return { ...st, points: st.points.map((q) => ({ ...q, x: q.x + dx, y: q.y + dy })) };
    });
    return computeGapIntegrity(def, off, defenseRules || {}, lines);
  }, [gapFits, atShiftStop, animatedFrame, nodes, strokes, extraStrokes, defenseRules]);
  // The gaps drawn: on their shift, those; else the builder's (as we line up).
  const gapsShown = stopGaps || gapFits;
  useEffect(() => {
    onShiftStop?.(atShiftStop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atShiftStop]);
  const readAtPoint = animatedFrame.handoffProgress ?? animatedFrame.readProgress ?? snapAt + (1 - snapAt) * 0.2;
  const fitAtPoint = animatedFrame.fitProgress ?? snapAt + (1 - snapAt) * 0.36;
  const autoPausedByLoopRef = useRef<'checkpoint' | 'end' | null>(null);
  useEffect(() => {
    if (!isPlaying) return;
    autoPausedByLoopRef.current = null;
    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      // The first frame can be stamped a hair before the start: never step backward.
      const dt = Math.max(0, (now - lastTs) / 1000);
      lastTs = now;
      const prev = progressRef.current;
      const next = prev + (dt * animSpeed) / seconds;
      // Their shift: stop when it's set (where does our defense go?), and again when our defense is set.
      const shiftStop = [shiftSetAt, defenseSetAt].find((pt) => pt !== undefined && prev < pt - 1e-5 && next >= pt);
      if (shiftStop !== undefined) {
        progressRef.current = shiftStop;
        setAnimProgress(shiftStop);
        autoPausedByLoopRef.current = 'checkpoint';
        setIsPlaying(false);
        return;
      }
      // Multi-checkpoint Auto-Pause (Snap · Handoff / Read · Gap Fit · Tackle)
      if (!skipNotes) {
        const autoStops: number[] = [];
        if (stopAtSnap && snapAt > 0.001) autoStops.push(snapAt);
        if (stopAtRead && readAtPoint > 0.001) autoStops.push(readAtPoint);
        if (stopAtFit && fitAtPoint > 0.001) autoStops.push(fitAtPoint);
        autoStops.sort((a, b) => a - b);
        const hitAuto = autoStops.find((pt) => prev < pt - 1e-5 && next >= pt);
        if (hitAuto !== undefined) {
          progressRef.current = hitAuto;
          setAnimProgress(hitAuto);
          autoPausedByLoopRef.current = 'checkpoint';
          setIsPlaying(false);
          return;
        }
        if (stopAtTackle && next > snapAt + 0.05) {
          const probe = computeAnimatedPlayFrame(
            nodes,
            strokes,
            extraStrokes || [],
            ballRole,
            Math.min(1, next),
            typeof play.metadata?.targetHole === 'number' ? play.metadata.targetHole : null,
            defenseRules,
            stemFrom,
            liveShift,
          );
          if (probe.tackleProgress !== undefined && prev < probe.tackleProgress - 1e-5 && next >= probe.tackleProgress) {
            progressRef.current = probe.tackleProgress;
            setAnimProgress(probe.tackleProgress);
            autoPausedByLoopRef.current = 'checkpoint';
            setIsPlaying(false);
            return;
          }
        }
      }
      // Pause at the next coaching note / pursuit angle checkpoint unless "Play Through (No Notes)" is active.
      if (!skipNotes && sortedCheckpoints.length > 0) {
        const hitCp = sortedCheckpoints.find(
          (cp) =>
            (cp.note.trim().length > 0 || cp.pursuitLines.length > 0) &&
            prev < cp.progress - 1e-5 &&
            next >= cp.progress,
        );
        if (hitCp) {
          progressRef.current = hitCp.progress;
          setAnimProgress(hitCp.progress);
          setEditingCheckpointId(hitCp.id);
          autoPausedByLoopRef.current = 'checkpoint';
          setIsPlaying(false);
          return;
        }
      }
      if (next >= 1) {
        progressRef.current = 1;
        setAnimProgress(1);
        autoPausedByLoopRef.current = 'end';
        setIsPlaying(false);
        return;
      }
      progressRef.current = next;
      setAnimProgress(next);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, animSpeed, seconds, stopAtSnap, stopAtRead, stopAtFit, stopAtTackle, snapAt, readAtPoint, fitAtPoint, skipNotes, sortedCheckpoints, shiftSetAt, defenseSetAt]);

  // Continuous Walkthrough Huddle Loop mode: auto-resumes after 2.2s at pauses and restarts (or advances playlist) after 1.8s at the end
  useEffect(() => {
    if (!loopPlay || isPlaying || pursuitDrawMode) return;
    const reason = autoPausedByLoopRef.current;
    if (!reason) return;
    const delayMs = reason === 'checkpoint' ? 2200 : 1800;
    const timer = window.setTimeout(() => {
      autoPausedByLoopRef.current = null;
      if (reason === 'checkpoint') {
        setEditingCheckpointId(null);
        setIsPlaying(true);
      } else if (reason === 'end') {
        if (onLoopCycleEnd) {
          onLoopCycleEnd();
        }
        setAnimProgress(0);
        setIsPlaying(true);
      }
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [loopPlay, isPlaying, pursuitDrawMode, animProgress, onLoopCycleEnd]);
  /** Play or pause; at the end it starts over. */
  const togglePlay = () => {
    setAnimOpen(true);
    if (isPlaying) return setIsPlaying(false);
    if (animProgress >= 0.99) setAnimProgress(0);
    setIsPlaying(true);
  };
  /** A small step back or on (a tenth of a second of the play), paused, to show one moment at a time. */
  const stepAnim = (dir: 1 | -1) => {
    setIsPlaying(false);
    setAnimProgress((p) => Math.max(0, Math.min(1, p + (dir * ANIM_STEP_SECONDS) / seconds)));
  };
  const animShown = animOpen || isPlaying || animProgress > 0.005;
  // Keys while the movement is up: space plays / pauses, the arrows step, Home goes back to the start.
  useEffect(() => {
    if (!animShown) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Not while typing (a checkbox, the timeline or a button clicked on the bar still lets the keys work).
      const typing = t?.closest('textarea, select, [contenteditable="true"], input:not([type="checkbox"]):not([type="range"]):not([type="radio"]):not([type="button"])');
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') togglePlay();
      else if (e.key === 'ArrowRight') stepAnim(1);
      else if (e.key === 'ArrowLeft') stepAnim(-1);
      else if (e.key === 'Home') {
        setIsPlaying(false);
        setAnimProgress(0);
      } else return;
      e.preventDefault();
      // Ahead of the presentation's keys (its arrows change the play): while the movement is up they step it.
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animShown, isPlaying, animProgress, seconds]);
  // The handoff spot on the ball carrier's run line: picked by tapping his line (the ball changes hands there).
  const [pickHandoff, setPickHandoff] = useState(false);
  const carrierNode = nodesProp.find((n) => n.role === ballRole);
  /** His line: it starts on him, or where his shift / motion ends (a run drawn on from the end of it). */
  const isHisLine = (st: PlayStroke, n: PlayNode) =>
    lineStartsOn(st, n, nodesProp) ||
    strokesProp.some(
      (m) =>
        m !== st &&
        m.points.length >= 2 &&
        (m.motion || 0) >= m.points.length - 1 &&
        lineStartsOn(m, n, nodesProp) &&
        Math.hypot(m.points[m.points.length - 1].x - st.points[0].x, m.points[m.points.length - 1].y - st.points[0].y) < 1.2
    );
  const carrierIdx =
    carrierNode && ballRole !== '1' && ballRole !== 'QB'
      ? strokesProp.findIndex((st) => st.kind === 'run' && st.points.length >= 2 && isHisLine(st, carrierNode))
      : -1;
  // Every runner's run line (backs and receivers; not the QB or the line): a handoff spot can go on any of them.
  // Two (a reverse): the QB hands it to the first, he hands it to the ball carrier.
  const runnerLines = strokesProp
    .map((st, i) => ({
      st,
      i,
      node:
        st.kind === 'run' && st.points.length >= 2
          ? nodesProp.find((n) => !isDefenseRole(n.role) && n.role !== '1' && n.role !== 'QB' && !['LT', 'LG', 'C', 'RG', 'RT'].includes(n.role) && isHisLine(st, n))
          : undefined,
    }))
    .filter((r): r is { st: PlayStroke; i: number; node: PlayNode } => Boolean(r.node));
  const handoffSpots = runnerLines.filter((r) => r.st.handoff).map((r) => ({ i: r.i, role: r.node.role, at: r.st.handoff! }));
  const handoffSpot = handoffSpots.length ? handoffSpots[0].at : undefined;
  /** The closest spot on a line (after any motion) to where the coach tapped. */
  const snapToLine = (idx: number, pt: { x: number; y: number }) => {
    const st = strokesProp[idx];
    const m = st.motion && st.motion > 0 ? Math.min(st.motion, st.points.length - 1) : 0;
    const pts = st.points.slice(m);
    let best = { d: Infinity, x: pts[0].x, y: pts[0].y };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((pt.x - a.x) * (b.x - a.x) + (pt.y - a.y) * (b.y - a.y)) / l2)) : 0;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const d = Math.hypot(pt.x - x, pt.y - y);
      if (d < best.d) best = { d, x, y };
    }
    return { x: Math.round(best.x * 100) / 100, y: Math.round(best.y * 100) / 100, d: best.d };
  };
  /** A tap while picking: on the runner's line nearest it, his handoff spot (the ball comes to him there). */
  const pickHandoffAt = (pt: { x: number; y: number }) => {
    const best = runnerLines
      .map((r) => ({ i: r.i, spot: snapToLine(r.i, pt) }))
      .sort((a, b) => a.spot.d - b.spot.d)[0];
    if (!best || best.spot.d > 3) return;
    onStrokes(strokesProp.map((st, i) => (i === best.i ? { ...st, handoff: { x: best.spot.x, y: best.spot.y } } : st)));
  };
  /** Clear every handoff spot (the QB hands it off just after the snap again). */
  const clearHandoffs = () =>
    onStrokes(
      strokesProp.map((st) => {
        if (!st.handoff) return st;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { handoff: _was, ...rest } = st;
        return rest;
      })
    );
  useEffect(() => {
    if (carrierIdx < 0) setPickHandoff(false);
  }, [carrierIdx]);
  const ctl = 'h-8 w-8 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-black text-slate-200 cursor-pointer inline-flex items-center justify-center';
  // The field is drawn around the ball (a formation on a hash keeps its spacing). From the spots before a
  // drag, so the field doesn't slide while the center is being moved.
  setFieldBall(ballXOf(nodesProp));
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
      // Presenting: any scroll zooms in on the spot under the pointer, smoothly (a mouse wheel, or two fingers on a
      // trackpad; a trackpad's pinch comes as a scroll with Ctrl, in smaller steps).
      if (presentZoomRef.current) {
        e.preventDefault();
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
        zoomAtRef.current(Math.exp(-Math.max(-120, Math.min(120, dy)) * (e.ctrlKey ? 0.012 : 0.003)), clientToSvg(svg, e.clientX, e.clientY));
        return;
      }
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
    // Zoomed in past the steps (presenting): one step out goes back to the last of them.
    const i = ZOOM_LEVELS.findIndex((z) => z >= zoom - 0.001);
    const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, (i < 0 ? ZOOM_LEVELS.length : i) + dir))];
    if (next === zoom || (dir > 0 && next < zoom)) return;
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
  // The view as it is right now (a burst of scrolling lands before the next draw).
  const viewRef = useRef({ zoom, center });
  viewRef.current = { zoom, center };
  /** Presenting: zoom by `factor` keeping `at` (picture units) under the pointer, from the whole field to 4×. */
  const zoomAt = (factor: number, at: { cx: number; cy: number }) => {
    const { zoom: z0, center: c0 } = viewRef.current;
    let next = Math.min(4, Math.max(1, z0 * factor));
    if (next < 1.02) next = 1;
    if (Math.abs(next - z0) < 0.0005) return;
    const v = zoomView(z0, c0, FIELD_SVG.w, FIELD_SVG.h);
    const fx = (at.cx - v.x) / v.vw;
    const fy = (at.cy - v.y) / v.vh;
    const nw = FIELD_SVG.w / next;
    const nh = FIELD_SVG.h / next;
    const c = {
      cx: Math.max(nw / 2, Math.min(FIELD_SVG.w - nw / 2, at.cx - fx * nw + nw / 2)),
      cy: Math.max(nh / 2, Math.min(FIELD_SVG.h - nh / 2, at.cy - fy * nh + nh / 2)),
    };
    viewRef.current = { zoom: next, center: c };
    setZoom(next);
    setCenter(c);
  };
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;
  const presentZoomRef = useRef(presentZoom);
  presentZoomRef.current = presentZoom;
  // A pinch (Safari: on the screen or a trackpad, like the Magic Keyboard's) zooms in on the middle of the fingers.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let start = 0;
    type Gesture = Event & { scale?: number; clientX?: number; clientY?: number };
    const spot = (g: Gesture) => {
      const r = svg.getBoundingClientRect();
      return clientToSvg(svg, Number.isFinite(g.clientX) ? g.clientX! : r.left + r.width / 2, Number.isFinite(g.clientY) ? g.clientY! : r.top + r.height / 2);
    };
    const onStart = (e: Event) => {
      if (!presentZoomRef.current) return;
      e.preventDefault();
      start = viewRef.current.zoom;
    };
    const onChange = (e: Event) => {
      if (!presentZoomRef.current || !start) return;
      e.preventDefault();
      const g = e as Gesture;
      zoomAtRef.current((start * (g.scale || 1)) / viewRef.current.zoom, spot(g));
    };
    const onEnd = (e: Event) => {
      if (!start) return;
      e.preventDefault();
      start = 0;
    };
    svg.addEventListener('gesturestart', onStart);
    svg.addEventListener('gesturechange', onChange);
    svg.addEventListener('gestureend', onEnd);
    return () => {
      svg.removeEventListener('gesturestart', onStart);
      svg.removeEventListener('gesturechange', onChange);
      svg.removeEventListener('gestureend', onEnd);
    };
  }, []);
  const wholeField = () => {
    viewRef.current = { zoom: 1, center: ZOOM_HOME };
    setZoom(1);
    setCenter(ZOOM_HOME);
  };
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  // The gap tapped (its id: "BR" = the right B gap), waiting for the defender who fits it.
  const [pickedGap, setPickedGap] = useState<string | null>(null);
  const pickedSlot = pickedGap && gapsShown ? gapsShown.find((s) => s.id === pickedGap) || null : null;
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
    const shift = line.shift ? Math.min(motion, kept.filter((j) => j <= line.shift!).length - 1) : 0;
    const { motion: _m, shift: _s, ...rest } = line;
    change(cur.map((x, j) => (j === i ? { ...rest, points: kept.map((k) => line.points[k]), ...(motion > 0 ? { motion } : {}), ...(shift > 0 ? { shift } : {}) } : x)));
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
    if (t === 'shift') {
      const allShift = (line.shift || 0) >= anchor - 1 && (line.motion || 0) >= anchor - 1;
      return allShift ? { ...line, shift: last, motion: last } : line;
    }
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
    const mine = strokeFor(strokes, pNode, nodes);
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
    const mine = strokeFor(strokesRef.current, blocker, nodes);
    remember();
    change([...strokesRef.current.filter((st) => st !== mine), line]);
  };

  const handleClearPlayerRoute = (role: string) => {
    const pNode = nodes.find((n) => n.role === role);
    if (!pNode) return;
    const mine = strokeFor(strokes, pNode, nodes);
    if (!mine) return;
    remember();
    change(strokes.filter((s) => s !== mine));
  };

  // The ball carrier's run line: handed off, or thrown to him (a pass to a back).
  const handleThrownChange = (role: string, thrown: boolean) => {
    const pNode = nodes.find((n) => n.role === role);
    const mine = pNode && strokeFor(strokes, pNode, nodes);
    if (!mine || Boolean(mine.thrown) === thrown) return;
    remember();
    change(
      strokes.map((s) => {
        if (s !== mine) return s;
        const { thrown: _was, ...rest } = s;
        return thrown ? { ...rest, thrown: true } : rest;
      })
    );
  };

  const pointFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0, cx: 0, cy: 0 };
    const { cx, cy } = clientToSvg(svg, e.clientX, e.clientY);
    return { ...svgToField(cx, cy), cx, cy };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pickHandoff && carrierIdx >= 0) {
      e.preventDefault();
      pickHandoffAt(pointFromEvent(e));
      setPickHandoff(false);
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;
    if (quizTargetSpot && e.isPrimary && !pursuitDrawMode) {
      const p = pointFromEvent(e);
      const near = hitNode(nodes, p.cx, p.cy, 16);
      // If tapping empty field or gap area (not dragging another defender), score the Kid Quiz tap!
      if (!near || near.role === spotlightRole) {
        e.preventDefault();
        e.stopPropagation();
        const distYards = Math.round(Math.hypot(p.x - quizTargetSpot.x, p.y - quizTargetSpot.y) * 10) / 10;
        const correct = distYards <= 2.8;
        const res = {
          correct,
          distYards,
          tapped: { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 },
          target: quizTargetSpot,
        };
        setQuizTapResult(res);
        onQuizAttempt?.(res);
        return;
      }
    }
    // A gap picked: the defender tapped fits it (anywhere else: never mind).
    if (pickedSlot && onAssignGap && e.isPrimary) {
      e.preventDefault();
      const p = pointFromEvent(e);
      const n = hitNode(nodes.filter((x) => isDefenseRole(x.role)), p.cx, p.cy, 18);
      if (n) {
        const ball = nodes.find((o) => o.role === 'C')?.x ?? 0;
        const hisSide = n.x < ball - 0.1 ? 'left' : 'right';
        onAssignGap(n.role, pickedSlot.gap, hisSide !== pickedSlot.side);
      }
      setPickedGap(null);
      return;
    }
    if (pursuitDrawMode && e.isPrimary) {
      e.preventDefault();
      e.stopPropagation();
      svg.setPointerCapture(e.pointerId);
      const p = pointFromEvent(e);
      const near = hitNode(displayNodes, p.cx, p.cy, 22);
      const startPt = near ? { x: Math.round(near.x * 100) / 100, y: Math.round(near.y * 100) / 100 } : { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
      const cp = ensureCheckpointAtCurrent();
      const pts = [startPt, { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }];
      pursuitDrawingRef.current = { points: pts, checkpointId: cp.id };
      setDraftPursuitPoints(pts);
      return;
    }
    // Stopped on their shift (before or after ours): dragging a defender sets where he goes after their shift. His
    // spot before it stays, so the play still starts from there and he slides over after their shift.
    if ((atShiftSet || atDefenseSet) && onShiftDefenseMove && e.isPrimary) {
      const p = pointFromEvent(e);
      const n = hitNode(drawnNodes.filter((x) => isDefenseRole(x.role)), p.cx, p.cy);
      if (n) {
        e.preventDefault();
        svg.setPointerCapture(e.pointerId);
        // From their shift set: on to our defense set, so he's shown where he goes.
        if (atShiftSet && defenseSetAt !== undefined) setAnimProgress(defenseSetAt);
        drag.current = { mode: 'shift', role: n.role, startCx: p.cx, startCy: p.cy, moved: false, at: null };
        return;
      }
    }
    // The play moving (or stopped partway): a tap on a player where he is now picks him (the QB: his read shows).
    if (moving && e.isPrimary && !pursuitDrawMode && (tool === 'move' || locked)) {
      const p = pointFromEvent(e);
      const n = hitNode(drawnNodes, p.cx, p.cy);
      if (n) {
        e.preventDefault();
        svg.setPointerCapture(e.pointerId);
        drag.current = { mode: 'tap', role: n.role };
        return;
      }
    }
    if (locked) {
      // Allow tapping or dragging a player even on the presentation stage so the coach can adjust alignment & rules live.
      const p = pointFromEvent(e);
      const n = hitNode(nodes, p.cx, p.cy);
      if (n && e.isPrimary) {
        svg.setPointerCapture(e.pointerId);
        if (linesFollow) remember();
        drag.current = { mode: 'player', role: n.role, startCx: p.cx, startCy: p.cy, moved: false, from: { x: n.x, y: n.y }, startLines: strokesRef.current, at: null };
        return;
      }
      // Zoomed in, one finger (or the mouse) drags the view around. A second finger is a pinch.
      if (viewRef.current.zoom > 1 && e.isPrimary) {
        svg.setPointerCapture(e.pointerId);
        const v = zoomView(zoom, center, w, h);
        drag.current = { mode: 'pan', clientX: e.clientX, clientY: e.clientY, from: { cx: v.x + v.vw / 2, cy: v.y + v.vh / 2 } };
      } else drag.current = null;
      return;
    }
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
    const onOurs = Boolean(near);
    const atStart = open && near && Math.hypot(open.points[0].x - near.x, open.points[0].y - near.y) < 1.2;
    if (open && onOurs && !atStart) {
      finishLine();
      cur = strokesRef.current;
      i = null;
    }
    remember();
    const here = { x: p.x, y: p.y };
    // Drawing a route, then Run: his run after the catch, its own red line from where the route ends.
    const route = i != null ? cur[i] : null;
    if (route && route.kind === 'pass' && tool === 'run' && route.points.length >= 2 && !((route.motion || 0) >= route.points.length - 1)) {
      finishLine();
      cur = strokesRef.current;
      const end = (cur[i!] || route).points[(cur[i!] || route).points.length - 1];
      i = cur.length;
      change([...cur, { kind: 'run', points: [{ x: end.x, y: end.y }, here] }]);
      setOpen(i);
      drag.current = { mode: 'draw', index: i, anchor: 1, fresh: false, downCx: p.cx, downCy: p.cy, moved: false };
      setSelected(i);
      return;
    }
    // A run, route or block started where a player's shift or motion ends: that player's line goes on from there
    // (one line: shift, then the play).
    const preSnapEnd =
      (i == null || !cur[i]) && !onOurs && (tool === 'run' || tool === 'pass' || tool === 'block')
        ? cur.findIndex((s) => {
            if (s.points.length < 2 || (s.motion || 0) < s.points.length - 1) return false;
            const e = fieldToSvg(s.points[s.points.length - 1].x, s.points[s.points.length - 1].y);
            return Math.hypot(e.cx - p.cx, e.cy - p.cy) <= 20;
          })
        : -1;
    if (preSnapEnd >= 0) {
      const base = cur[preSnapEnd];
      i = preSnapEnd;
      change(cur.map((x, j) => (j === i ? { ...x, kind: tool as DrawKind, points: [...x.points, here] } : x)));
      setOpen(i);
      drag.current = { mode: 'draw', index: i, anchor: base.points.length, fresh: false, downCx: p.cx, downCy: p.cy, moved: false };
      setSelected(i);
      return;
    }
    if (i == null || !cur[i]) {
      // A run started at the end of a route: his run after the catch, from right where the route ends.
      const routeEnd =
        !onOurs && tool === 'run'
          ? cur
              .filter((s) => s.kind === 'pass' && s.points.length >= 2)
              .map((s) => s.points[s.points.length - 1])
              .find((e) => {
                const at = fieldToSvg(e.x, e.y);
                return Math.hypot(at.cx - p.cx, at.cy - p.cy) <= 20;
              })
          : undefined;
      const start = onOurs ? { x: near!.x, y: near!.y } : routeEnd ? { x: routeEnd.x, y: routeEnd.y } : here;
      const line: PlayStroke =
        tool === 'shift'
          ? { kind: 'pass', points: [start, here], motion: 1, shift: 1 }
          : tool === 'motion'
            ? { kind: 'pass', points: [start, here], motion: 1 }
            : { kind: tool as DrawKind, points: [start, here] };
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
    if (pursuitDrawingRef.current && svgRef.current) {
      const p = pointFromEvent(e);
      const curPts = pursuitDrawingRef.current.points;
      const last = curPts[curPts.length - 1];
      if (last) {
        const ls = fieldToSvg(last.x, last.y);
        if (Math.hypot(p.cx - ls.cx, p.cy - ls.cy) < 5) return;
      }
      const nextPts = [...curPts, { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }];
      pursuitDrawingRef.current.points = nextPts;
      setDraftPursuitPoints(nextPts);
      return;
    }
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
    if (d.mode === 'tap') return;
    if (d.mode === 'shift') {
      if (!d.moved && Math.hypot(p.cx - d.startCx, p.cy - d.startCy) <= 4) return;
      d.moved = true;
      d.at = { x: Math.max(-26, Math.min(26, p.x)), y: Math.max(0.6, Math.min(20, p.y)) };
      setShiftDrag({ role: d.role, x: d.at.x, y: d.at.y });
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
    if (pursuitDrawingRef.current) {
      const { points: rawPts, checkpointId } = pursuitDrawingRef.current;
      pursuitDrawingRef.current = null;
      setDraftPursuitPoints(null);
      if (rawPts.length >= 2) {
        const first = rawPts[0];
        const last = rawPts[rawPts.length - 1];
        if (Math.hypot(last.x - first.x, last.y - first.y) > 0.6) {
          const shaped = shapeDrawnLeg(rawPts).map((pt) => ({
            x: Math.round(pt.x * 100) / 100,
            y: Math.round(pt.y * 100) / 100,
          }));
          const newLine: PursuitLine = { points: shaped, color: pursuitColor };
          const targetCp = checkpoints.find((c) => c.id === checkpointId);
          if (targetCp) {
            updateCheckpoint(checkpointId, { pursuitLines: [...targetCp.pursuitLines, newLine] });
          } else {
            onCheckpointsChange?.([
              ...checkpoints,
              {
                id: checkpointId,
                progress: Math.round(animProgress * 1000) / 1000,
                note: '',
                pursuitLines: [newLine],
              },
            ]);
          }
        }
      }
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    // Whatever this frame hasn't drawn yet is in the ref; the drag's result goes to the builder now.
    cancelFrame();
    setDraft(null);
    setDragPos(null);
    if (d.mode === 'pan') return;
    if (d.mode === 'tap') {
      selectPlayer(selectedRole === d.role ? null : d.role);
      return;
    }
    if (d.mode === 'shift') {
      setShiftDrag(null);
      if (d.moved && d.at) onShiftDefenseMove?.(d.role, Math.round(d.at.x * 100) / 100, Math.round(d.at.y * 100) / 100);
      // A tap: his rules (after their shift).
      else selectPlayer(d.role);
      return;
    }
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
        if (d.fresh) line = { ...line, points: line.points.slice(0, 1), ...(line.motion ? { motion: 0 } : {}), ...(line.shift ? { shift: 0 } : {}) };
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
    // Presenting full screen: a double tap goes back to the whole field.
    if (locked) {
      if (zoom > 1) wholeField();
      return;
    }
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
      const isSpotlight = spotlightRole === n.role;
      return (
        <g key={n.role} data-player-node={n.role} style={{ cursor }}>
          {isSpotlight && (
            <>
              <rect
                x={cx - bw / 2 - 8}
                y={cy - 18}
                width={bw + 16}
                height={36}
                rx={9}
                fill="#facc15"
                fillOpacity={0.26}
                stroke="#f59e0b"
                strokeWidth={3}
              />
              <rect
                x={cx - bw / 2 - 4}
                y={cy - 14}
                width={bw + 8}
                height={28}
                rx={6}
                fill="none"
                stroke="#fef08a"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            </>
          )}
          {isSelected && (
            <rect x={cx - bw / 2 - 4} y={cy - 14} width={bw + 8} height={28} rx={6} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="4 3" />
          )}
          <rect x={cx - bw / 2} y={cy - 10.5} width={bw} height={20} rx={4} fill={isSpotlight ? '#b45309' : DEFENSE_COLOR} stroke={isSpotlight ? '#fde047' : '#ffffff'} strokeWidth={isSpotlight ? 2.4 : 1.8} />
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
        <g key={n.role} data-player-node={n.role} style={{ cursor }}>
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
      <g key={n.role} data-player-node={n.role} style={{ cursor }}>
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
      else if (id === 'shift') activeStyle = 'bg-teal-600 text-white border-teal-600 hover:bg-teal-500';
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
          : 'Tap a player to pick the assignment. Drag a player to move the spot. Keys: V select · R run · P route · B block · S shift · M motion.'
      : tool === 'shift'
        ? drawing
          ? 'Keep clicking or dragging to where he sets. Then pick Motion, Route or Run to keep drawing from his new spot. Double-click or Enter to finish.'
          : 'Shift: start on the player, then drag or click to the spot he moves to and sets before the snap.'
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
      onThrownChange={handleThrownChange}
    onLabelChange={onLabelChange}
    defenseWho={defenseWho}
      ctx={{ holesXs, qbNode: nodes.find((n) => n.role === '1' || n.role === 'QB') }}
    />
  );
  // Presenting: no taller than given, so the whole field shows on the screen (narrower to keep its shape).
  const fieldFit: React.CSSProperties | undefined = maxFieldHeight
    ? { maxWidth: `calc(${maxFieldHeight} * ${FIELD_SVG.w} / ${FIELD_SVG.h})`, marginInline: 'auto' }
    : undefined;

  return (
    <div
      ref={boxRef}
      className={bare ? 'relative outline-none' : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs outline-none'}
      style={bare ? fieldFit : undefined}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
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
        className={bare ? 'relative rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10' : 'relative'}
        style={bare ? undefined : fieldFit}
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
        {/* Presenting (no tool bar): the Gaps button on its own. */}
        {bare && onToggleGaps && (
          <div data-stage-ui className="absolute top-2.5 left-2.5 z-10">
            <button
              type="button"
              aria-pressed={Boolean(gapsOn)}
              onClick={() => {
                setPickedGap(null);
                onToggleGaps();
              }}
              title={gapsOn ? 'Hide the gaps' : 'Show who fits each gap'}
              className={`h-8 px-3 rounded-lg border text-xs font-black inline-flex items-center gap-1 cursor-pointer shadow-xs ${
                gapsOn ? 'border-sky-300 bg-sky-600 text-white' : 'border-sky-400/50 bg-slate-900/85 backdrop-blur-sm text-sky-300 hover:bg-sky-600 hover:text-white'
              }`}
            >
              ▥ Gaps
            </button>
          </div>
        )}
        {!bare && (
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
          {carrierIdx >= 0 && (
            <span className="inline-flex items-center gap-0.5">
              <button
                type="button"
                aria-pressed={pickHandoff}
                onClick={() => setPickHandoff((v) => !v)}
                title={
                  pickHandoff
                    ? 'Tap a runner\'s line where he gets the ball (or click again to stop)'
                    : 'Where the ball changes hands: tap a runner\'s line. A reverse: tap the back\'s line where the QB hands it to him, then Handoff again and the receiver\'s line where the back hands it to him (or leave that one: it\'s where they meet).'
                }
                className={`h-7 px-2.5 rounded-lg border text-xs font-black inline-flex items-center gap-1 cursor-pointer shadow-xs transition-colors ${
                  pickHandoff ? 'border-amber-300 bg-amber-600 text-white' : 'border-amber-400/50 bg-slate-900/85 backdrop-blur-sm text-amber-300 hover:bg-amber-600 hover:text-white'
                }`}
              >
                🏈 {pickHandoff ? 'Tap his line' : 'Handoff'}
              </button>
              {handoffSpot && !pickHandoff && (() => {
                // The QB's handoff (on a reverse, the one to the back, not the ball carrier's): a toss or not.
                const first = handoffSpots.find((s) => s.role !== ballRole) || handoffSpots[0];
                const on = Boolean(strokesProp[first.i]?.toss);
                return (
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      onStrokes(
                        strokesProp.map((st, i) => {
                          if (i !== first.i) return st;
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
                          const { toss: _t, ...rest } = st;
                          return on ? rest : { ...rest, toss: true };
                        })
                      )
                    }
                    title={on ? 'A toss: the QB pitches it to him. Click for a handoff.' : 'Make it a toss: the QB pitches it to him (the ball in the air) instead of handing it off'}
                    className={`h-7 px-2 rounded-lg border text-[11px] font-black cursor-pointer ${
                      on ? 'border-amber-300 bg-amber-600 text-white' : 'border-amber-400/50 bg-slate-900/85 text-amber-300 hover:bg-amber-600 hover:text-white'
                    }`}
                  >
                    Toss
                  </button>
                );
              })()}
              {handoffSpot && !pickHandoff && (
                <button
                  type="button"
                  onClick={clearHandoffs}
                  title="Clear the handoff spots (handed off just after the snap)"
                  aria-label="Clear the handoff spots"
                  className="h-7 w-6 rounded-lg border border-white/20 bg-slate-900/85 text-[11px] font-black text-slate-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </span>
          )}
          {onToggleGaps && (
            <button
              type="button"
              aria-pressed={Boolean(gapsOn)}
              onClick={() => {
                setPickedGap(null);
                onToggleGaps();
              }}
              title={gapsOn ? 'Hide the gaps' : 'Show who fits each gap (green: one man, red: open, amber: two). Tap a gap, then the defender who fits it, to assign it.'}
              className={`h-7 px-2.5 rounded-lg border text-xs font-black inline-flex items-center gap-1 cursor-pointer shadow-xs transition-colors ${
                gapsOn ? 'border-sky-300 bg-sky-600 text-white' : 'border-sky-400/50 bg-slate-900/85 backdrop-blur-sm text-sky-300 hover:bg-sky-600 hover:text-white'
              }`}
            >
              ▥ Gaps
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!animShown) {
                setAnimOpen(true);
                setIsPlaying(false);
              } else if (isPlaying) {
                setIsPlaying(false);
              } else {
                setAnimOpen(false);
                setAnimProgress(0);
              }
            }}
            title="Open the Play Movement menu (press Start inside the menu to run the play)"
            className={`h-7 px-2.5 rounded-lg border text-xs font-black inline-flex items-center gap-1 cursor-pointer shadow-xs transition-colors ${
              animShown
                ? 'border-emerald-300 bg-emerald-600 text-white'
                : 'border-emerald-400/50 bg-slate-900/85 backdrop-blur-sm text-emerald-300 hover:bg-emerald-600 hover:text-white'
            }`}
          >
            {isPlaying ? '⏸ Pause' : animShown ? '🎛 Movement Open' : '▶ Play Movement'}
          </button>
          {animProgress > 0.005 && (
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setAnimProgress(0);
              }}
              title="Reset players back to pre-snap alignment"
              className="h-7 px-2 rounded-lg border border-white/20 bg-slate-900/85 backdrop-blur-sm text-[11px] font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              ↺ Reset
            </button>
          )}
        </div>
        )}
        {bare && zoom > 1 && (
          // Full screen, zoomed in: how far, and back to the whole field.
          <button
            type="button"
            data-stage-ui
            onClick={wholeField}
            title="Back to the whole field (or double-tap the field)"
            className="absolute left-3 bottom-3 z-10 h-10 px-3 rounded-xl inline-flex items-center gap-1.5 text-sm font-black text-white bg-slate-950/75 backdrop-blur-md ring-1 ring-white/15 shadow-2xl cursor-pointer"
          >
            {zoom.toFixed(1)}× <span className="font-bold text-white/70">· Whole field</span>
          </button>
        )}
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
          data-stage-ui={pursuitDrawMode ? '' : undefined}
          viewBox={(() => {
            const v = zoomView(zoom, center, w, h);
            return `${v.x} ${v.y} ${v.vw} ${v.vh}`;
          })()}
          className={`bg-[#f0f0f0] touch-none select-none ${dense ? 'max-h-64 w-auto max-w-full mx-auto' : 'w-full h-auto'} ${pursuitDrawMode ? 'cursor-crosshair' : tool === 'move' ? (zoom > 1 ? 'cursor-grab' : 'cursor-default') : 'cursor-crosshair'}`}
          data-zoomed={zoom > 1 ? '' : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClick}
        >
          <g dangerouslySetInnerHTML={{ __html: FIELD_BG }} />
          {/* Once the play runs, the drawn plan stays as a faint ghost under the real movement. */}
          <g opacity={moving ? 0.2 : 1} style={{ transition: 'opacity 300ms' }}>
          {/* Our defensive call's lines (blitz, stunt, coverage drops and zones), under everything the coach drew */}
          {(extraStrokes || []).map((st, i) => {
            const sp = strokePaths(st);
            if (!sp) return null;
            const { a, b } = sp.cap;
            return (
              <g key={`call-${i}`} pointerEvents="none">
                {sp.zone && <ellipse cx={sp.zone.cx} cy={sp.zone.cy} rx={sp.zone.rx} ry={sp.zone.ry} fill={sp.color} fillOpacity={0.12} stroke={sp.color} strokeOpacity={0.55} strokeWidth={1.2} />}
                {sp.man ? (
                  <>
                    {/* Man: dots to his receiver and a ring around the receiver. */}
                    <circle cx={sp.man.cx} cy={sp.man.cy} r={MAN_RING} fill="none" stroke={sp.color} strokeWidth={2.2} />
                    {sp.mainD && <path d={sp.mainD} fill="none" stroke={sp.color} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="0.1 6" />}
                  </>
                ) : (
                  <>
                    {sp.mainD && <path d={sp.mainD} fill="none" stroke={sp.color} strokeWidth={sp.width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={sp.dashed ? '6 4' : undefined} />}
                    <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={sp.cap.color} />
                  </>
                )}
              </g>
            );
          })}
          {/* The lines: motion zigzag, then the play (dashed route, curve if drawn freehand), arrow or block T */}
          {strokes.map((st, i) => {
            const sp = strokePaths(st);
            if (!sp) return null;
            const { a, b } = sp.cap;
            const cap = tBar(a.cx, a.cy, b.cx, b.cy);
            const isSel = i === sel;
            const hideMainPostSnap = hideOffenseRoutes && !st.zone && !st.man;
            return (
              <g key={i}>
                {!hideMainPostSnap && sp.zone && <ellipse cx={sp.zone.cx} cy={sp.zone.cy} rx={sp.zone.rx} ry={sp.zone.ry} fill={sp.color} fillOpacity={0.12} stroke={sp.color} strokeOpacity={0.55} strokeWidth={1.2} />}
                {isSel && [sp.shiftD, sp.motionD, !hideMainPostSnap ? sp.mainD : ''].filter(Boolean).map((d, k) => (
                  <path key={k} d={d} fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {sp.shiftD && <path d={sp.shiftD} fill="none" stroke={SHIFT_COLOR} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 5" />}
                {sp.motionD && <path d={sp.motionD} fill="none" stroke={MOTION_COLOR} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
                {sp.shiftSet && <circle cx={sp.shiftSet.cx} cy={sp.shiftSet.cy} r="6" fill="#ffffff" stroke={SHIFT_COLOR} strokeWidth="2.2" />}
                {!hideMainPostSnap && sp.mainD && (
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
                {hideMainPostSnap || sp.cap.none ? null : sp.cap.t ? (
                  <line x1={cap.x1} y1={cap.y1} x2={cap.x2} y2={cap.y2} stroke={sp.color} strokeWidth="3" strokeLinecap="round" />
                ) : (
                  <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={sp.cap.color} />
                )}
              </g>
            );
          })}
          </g>
          {/* A pass to the ball carrier: the ball's dotted line from the QB to the catch, and the ball there (the real one flies when the play runs). */}
          {!hideOffenseRoutes && animProgress <= 0.002 && (() => {
            const t = passThrow(nodes, strokes, ballRole);
            if (!t) return null;
            const a = fieldToSvg(t.from.x, t.from.y);
            const b = fieldToSvg(t.to.x, t.to.y);
            const ang = (Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180) / Math.PI;
            return (
              <g pointerEvents="none">
                <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={THROW_COLOR} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="0.1 6" />
                <ellipse cx={b.cx} cy={b.cy} rx={7.5} ry={4.6} fill={THROW_COLOR} stroke="#ffffff" strokeWidth={1.5} transform={`rotate(${ang} ${b.cx} ${b.cy})`} />
              </g>
            );
          })()}
          {/* The next leg of the line being drawn follows the pointer */}
          {openIdx != null && ghost && strokes[openIdx]?.points.length ? (() => {
            const lastPt = strokes[openIdx].points[strokes[openIdx].points.length - 1];
            const a = fieldToSvg(lastPt.x, lastPt.y);
            const b = fieldToSvg(ghost.x, ghost.y);
            const color = tool === 'motion' ? MOTION_COLOR : tool === 'shift' ? SHIFT_COLOR : tool === 'move' ? '#94a3b8' : COLOR[tool];
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

          {/* Live Gap-Integrity & Unaccounted-Gap Warning Overlay */}
          {gapsShown && gapsShown.length > 0 && (animProgress <= 0.05 || stopGaps) && (
            <g key="gap-integrity-overlay" pointerEvents="none">
              {gapsShown.map((slot) => {
                const { cx, cy } = fieldToSvg(slot.x, slot.y);
                const isOpen = slot.status === 'open';
                const isOver = slot.status === 'overloaded';
                const color = isOpen ? '#dc2626' : isOver ? '#d97706' : '#059669';
                const pillText = slot.gap;
                const pw = 18;
                const picked = pickedGap === slot.id;
                return (
                  <g key={slot.id}>
                    {/* Tap a gap, then the defender who fits it. */}
                    {onAssignGap && (
                      <rect
                        x={cx - 16}
                        y={cy - 16}
                        width={32}
                        height={30}
                        fill="transparent"
                        pointerEvents="all"
                        style={{ cursor: 'pointer' }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setPickedGap(picked ? null : slot.id);
                        }}
                      >
                        <title>{`${slot.side === 'left' ? 'Left' : 'Right'} ${slot.gap} gap: tap, then tap the defender who fits it`}</title>
                      </rect>
                    )}
                    {picked && <circle cx={cx} cy={cy} r={17} fill="none" stroke="#38bdf8" strokeWidth={3} />}
                    {slot.defenders.map((d, idx) => {
                      const from = fieldToSvg(d.fromX, d.fromY);
                      return (
                        <line
                          key={`${slot.id}-${d.role}-${idx}`}
                          x1={from.cx}
                          y1={from.cy}
                          x2={cx}
                          y2={cy}
                          stroke={color}
                          strokeWidth={2}
                          strokeOpacity={0.75}
                          strokeDasharray="4 3"
                        />
                      );
                    })}
                    {isOpen && slot.isPointOfAttack && (
                      <rect
                        x={cx - pw / 2 - 4}
                        y={cy - 13}
                        width={pw + 8}
                        height={24}
                        rx={7}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        strokeDasharray="3 2"
                      />
                    )}
                    <rect
                      x={cx - pw / 2}
                      y={cy - 9.5}
                      width={pw}
                      height={17}
                      rx={8.5}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={1.4}
                    />
                    <text
                      x={cx}
                      y={cy + 3}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="900"
                    >
                      {pillText}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Ghost "Compare Two Defenses" Trail & Markers when toggled on */}
          {showGhostDefense && prevDefense && (() => {
            const ghostDefNodes = (ghostFrame ? ghostFrame.nodes : prevDefense.nodes).filter((n) => isDefenseRole(n.role));
            const ghostDefTrails = ghostFrame ? ghostFrame.trails.filter((tr) => isDefenseRole(tr.role)) : [];
            return (
              <g key="ghost-defense-overlay" pointerEvents="none" opacity={0.44}>
                {ghostDefTrails.map((tr, idx) => {
                  if (tr.points.length < 2) return null;
                  const d = tr.points
                    .map((pt, j) => {
                      const { cx, cy } = fieldToSvg(pt.x, pt.y);
                      return `${j === 0 ? 'M' : 'L'}${cx},${cy}`;
                    })
                    .join(' ');
                  const last = tr.points[tr.points.length - 1];
                  const prev = tr.points[tr.points.length - 2];
                  const a = fieldToSvg(prev.x, prev.y);
                  const b = fieldToSvg(last.x, last.y);
                  return (
                    <g key={`ghost-trail-${tr.role}-${idx}`}>
                      <path
                        d={d}
                        fill="none"
                        stroke="#64748b"
                        strokeWidth={3.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="4 4"
                      />
                      <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill="#64748b" />
                    </g>
                  );
                })}
                {ghostDefNodes.map((gn) => {
                  const { cx, cy } = fieldToSvg(gn.x, gn.y);
                  const txt = diagramLabel(gn.role);
                  return (
                    <g key={`ghost-node-${gn.role}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={12.5}
                        fill="#f8fafc"
                        stroke="#475569"
                        strokeWidth={2}
                        strokeDasharray="3 2"
                      />
                      <text
                        x={cx}
                        y={cy + 3.5}
                        textAnchor="middle"
                        fill="#334155"
                        fontSize="8.5"
                        fontWeight="900"
                      >
                        {txt}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* QB Read / Progression Vision Cone (Option, RPO, and Pass Plays) */}
          {/* Off until the coach taps the QB (or the man he reads): then his read shows as the play runs. */}
          {animProgress > 0.005 &&
            animatedFrame.visionCone &&
            selectedRole &&
            (selectedRole === animatedFrame.visionCone.fromRole || selectedRole === animatedFrame.visionCone.targetRole) &&
            (() => {
            const vc = animatedFrame.visionCone;
            const from = fieldToSvg(vc.from.x, vc.from.y);
            const to = fieldToSvg(vc.to.x, vc.to.y);
            const dx = to.cx - from.cx;
            const dy = to.cy - from.cy;
            const dist = Math.hypot(dx, dy) || 1;
            const px = -dy / dist;
            const py = dx / dist;
            const halfW = Math.min(24, Math.max(12, dist * 0.2));
            const p1x = to.cx + px * halfW;
            const p1y = to.cy + py * halfW;
            const p2x = to.cx - px * halfW;
            const p2y = to.cy - py * halfW;
            const coneColor = vc.kind === 'option_read' ? '#f59e0b' : '#0ea5e9';
            const labelW = Math.max(66, vc.label.length * 5.2 + 12);
            const midCx = (from.cx + to.cx) / 2;
            const midCy = (from.cy + to.cy) / 2;
            return (
              <g key="qb-vision-cone" pointerEvents="none">
                <polygon
                  points={`${from.cx},${from.cy} ${p1x},${p1y} ${p2x},${p2y}`}
                  fill={coneColor}
                  fillOpacity={0.2}
                  stroke={coneColor}
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <circle
                  cx={to.cx}
                  cy={to.cy}
                  r={17}
                  fill="none"
                  stroke={coneColor}
                  strokeWidth={2.4}
                  strokeDasharray="4 2"
                />
                <g transform={`translate(${midCx}, ${midCy - 12})`}>
                  <rect
                    x={-labelW / 2}
                    y={-9}
                    width={labelW}
                    height={16}
                    rx={5}
                    fill="#0f172a"
                    fillOpacity={0.9}
                    stroke={coneColor}
                    strokeWidth={1.3}
                  />
                  <text
                    x={0}
                    y={2.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8"
                    fontWeight="900"
                  >
                    {vc.label}
                  </text>
                </g>
              </g>
            );
          })()}

          {/* Players: Offense in clean circles/squares, Defense in Cardinal Red badges */}
          {/* Where the ball ended up: a yellow line across the field at the spot, with the gain and the tackler. */}
          {(tackle || (animProgress >= 0.99 && !animatedFrame.ball.inAir)) && (() => {
            const carrier = animatedFrame.nodes.find((n) => n.role === ballRole);
            if (!carrier) return null;
            const y = fieldToSvg(0, carrier.y).cy;
            const at = fieldToSvg(carrier.x, carrier.y).cx;
            const gain = tackle?.gainYards ?? Math.round(carrier.y * 10) / 10;
            const gainText = `${gain >= 0 ? '+' : ''}${gain.toFixed(1)} yds`;
            const by = tackle ? drawnNodes.find((n) => n.role === tackle.defRole) : undefined;
            const byText = tackle ? `Tackle · ${by ? shownText(by, diagramLabel(by.role)) : tackle.defRole}` : 'End of play';
            const vb = zoomView(zoom, center, w, h);
            // The tag goes on the open side of the field, away from the pile.
            const left = at > vb.x + vb.vw / 2;
            const tagW = Math.round(gainText.length * 9.2 + byText.length * 6.6 + 34);
            const tx = left ? vb.x + 18 : vb.x + vb.vw - 18 - tagW;
            return (
              <g key="ball-spot" pointerEvents="none">
                <line x1={vb.x} y1={y} x2={vb.x + vb.vw} y2={y} stroke="#facc15" strokeWidth={5} strokeOpacity={0.85} />
                <line x1={vb.x} y1={y} x2={vb.x + vb.vw} y2={y} stroke="#fef08a" strokeWidth={1.4} />
                <g transform={`translate(${tx}, ${y - 34})`}>
                  <rect width={tagW} height={28} rx={8} fill="#0f172a" fillOpacity={0.92} stroke="#facc15" strokeWidth={2} />
                  <text x={12} y={19} fill={gain >= 0 ? '#86efac' : '#fca5a5'} fontSize="15" fontWeight="900" fontFamily="system-ui, sans-serif">
                    {gainText}
                  </text>
                  <text x={tagW - 10} y={18.5} textAnchor="end" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="system-ui, sans-serif">
                    {byText}
                  </text>
                </g>
              </g>
            );
          })()}
          {/* Where everyone went: the ball carrier and the tackler bold, everyone else light, so the play reads. */}
          {moving &&
            (() => {
              const key = new Set([ballRole, tackle?.defRole, spotlightRole, ...(animatedFrame.phase === 'post_snap' ? [] : animatedFrame.trails.filter((t) => /_(stem|shift)$/.test(t.role)).map((t) => t.role))].filter(Boolean) as string[]);
              const ordered = [...animatedFrame.trails].sort((a, b) => Number(key.has(a.role)) - Number(key.has(b.role)));
              return ordered.map((tr, idx) => {
                // The line runs to where his mark is drawn (a pile is spread out a little).
                const end = drawnNodes.find((n) => n.role === tr.role);
                const pts = end ? [...tr.points, { x: end.x, y: end.y }] : tr.points;
                if (pts.length < 2) return null;
                const isSpotTrail = spotlightRole === tr.role;
                const isCarrier = tr.role === ballRole;
                const isTackler = tr.role === tackle?.defRole;
                const bold = key.has(tr.role);
                const trailColor = isSpotTrail ? '#f59e0b' : isCarrier ? '#ea580c' : isTackler ? '#dc2626' : tr.color;
                const d = pts
                  .map((pt, j) => {
                    const { cx, cy } = fieldToSvg(pt.x, pt.y);
                    return `${j === 0 ? 'M' : 'L'}${cx},${cy}`;
                  })
                  .join(' ');
                const last = pts[pts.length - 1];
                // The arrow points along his last real step.
                let prev = pts[pts.length - 2];
                for (let k = pts.length - 2; k >= 0; k--) {
                  if (Math.hypot(pts[k].x - last.x, pts[k].y - last.y) > 0.25) {
                    prev = pts[k];
                    break;
                  }
                }
                const a = fieldToSvg(prev.x, prev.y);
                const b = fieldToSvg(last.x, last.y);
                return (
                  <g key={`anim-trail-${tr.role}-${idx}`} pointerEvents="none" opacity={bold ? 1 : 0.38}>
                    {bold && <path d={d} fill="none" stroke="#ffffff" strokeWidth={isCarrier ? 8.5 : 7} strokeOpacity={0.9} strokeLinecap="round" strokeLinejoin="round" />}
                    {isSpotTrail && (
                      <path d={d} fill="none" stroke="#fef08a" strokeWidth={9} strokeOpacity={0.55} strokeLinecap="round" strokeLinejoin="round" />
                    )}
                    <path
                      d={d}
                      fill="none"
                      stroke={trailColor}
                      strokeWidth={isCarrier ? 5 : bold ? 4 : 2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={tr.kind === 'motion' ? '5 4' : undefined}
                    />
                    {!bold ? null : <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={trailColor} />}
                  </g>
                );
              });
            })()}
          {/* A block: the blocker and his man joined (no labels over the pile). */}
          {moving &&
            (animatedFrame.collisions || [])
              .filter((c) => c.kind === 'block')
              .map((c) => {
                const a = drawnAt.get(c.offRole);
                const b = drawnAt.get(c.defRole);
                if (!a || !b) return null;
                return (
                  <g key={`block-${c.offRole}-${c.defRole}`} pointerEvents="none">
                    <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeOpacity={0.9} />
                    <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke="#f97316" strokeWidth={5} strokeLinecap="round" />
                  </g>
                );
              })}
          {tackle && (() => {
            const a = drawnAt.get(ballRole);
            const b = drawnAt.get(tackle.defRole);
            if (!a || !b) return null;
            return (
              <g key="tackle-link" pointerEvents="none">
                <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke="#ffffff" strokeWidth={10} strokeLinecap="round" />
                <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke="#dc2626" strokeWidth={6} strokeLinecap="round" />
              </g>
            );
          })()}
          {drawnNodes.map(glyph)}
          {animProgress > 0.005 && (() => {
            const { cx, cy } = fieldToSvg(animatedFrame.ball.x, animatedFrame.ball.y);
            const inAir = animatedFrame.ball.inAir;
            return (
              <g key="animated-football" transform={`translate(${cx}, ${cy - (inAir ? 14 : 9)})`} pointerEvents="none">
                <ellipse cx={0} cy={0} rx={inAir ? 8.5 : 7} ry={inAir ? 5.2 : 4.5} fill="#92400e" stroke="#fde68a" strokeWidth={1.8} />
                <line x1={-3} y1={0} x2={3} y2={0} stroke="#ffffff" strokeWidth={1.3} />
              </g>
            );
          })()}

          {/* Contact / Tackle & Block Collision Markers (💥 Block / 🛑 Tackle) */}
          {/* The runner slipping a tackle: said once, above him. (Blocks and the tackle are drawn as links and the spot line.) */}
          {moving && (animatedFrame.collisions || []).some((c) => c.kind === 'tackle' && /Cut Away/.test(c.label)) && (
            <g key="collision-markers" pointerEvents="none">
              {(animatedFrame.collisions || []).filter((c) => c.kind === 'tackle' && /Cut Away/.test(c.label)).slice(0, 1).map((col, idx) => {
                const at = drawnAt.get(col.offRole) || fieldToSvg(col.x, col.y);
                const cx = at.cx;
                const cy = at.cy;
                const badgeBg = '#7c3aed';
                const pw = Math.max(64, col.label.length * 6 + 14);
                const yOffset = -30;
                return (
                  <g key={`col-${col.kind}-${col.offRole}-${col.defRole}-${idx}`}>
                    <g transform={`translate(${cx}, ${cy + yOffset})`}>
                      <rect
                        x={-pw / 2}
                        y={-9}
                        width={pw}
                        height={20}
                        rx={10}
                        fill={badgeBg}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={4.5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="900"
                      >
                        {col.label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* Kid Quiz Tap Feedback Marker on the Field */}
          {quizTapResult && (() => {
            const tapSvg = fieldToSvg(quizTapResult.tapped.x, quizTapResult.tapped.y);
            const tgtSvg = fieldToSvg(quizTapResult.target.x, quizTapResult.target.y);
            const col = quizTapResult.correct ? '#16a34a' : '#f59e0b';
            const badgeText = quizTapResult.correct
              ? `✅ Nailed It! (${quizTapResult.target.label})`
              : `🎯 Target: ${quizTapResult.target.label}`;
            const bw = Math.max(76, badgeText.length * 5.2 + 12);
            return (
              <g key="quiz-tap-feedback" pointerEvents="none">
                {!quizTapResult.correct && (
                  <line
                    x1={tapSvg.cx}
                    y1={tapSvg.cy}
                    x2={tgtSvg.cx}
                    y2={tgtSvg.cy}
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    strokeDasharray="4 3"
                  />
                )}
                <circle
                  cx={tgtSvg.cx}
                  cy={tgtSvg.cy}
                  r={18}
                  fill={col}
                  fillOpacity={0.22}
                  stroke={col}
                  strokeWidth={2.6}
                  strokeDasharray="4 2"
                />
                <g transform={`translate(${tgtSvg.cx}, ${tgtSvg.cy - 22})`}>
                  <rect x={-bw / 2} y={-9} width={bw} height={17} rx={5} fill={col} stroke="#ffffff" strokeWidth={1.4} />
                  <text x={0} y={2.5} textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="900">
                    {badgeText}
                  </text>
                </g>
              </g>
            );
          })()}

          {/* Selected line bend vertices */}
          {sel != null &&
            strokes[sel].points.map((pt, j) => {
              const { cx, cy } = fieldToSvg(pt.x, pt.y);
              return <circle key={`v-${j}`} cx={cx} cy={cy} r="6.5" fill="#fff" stroke="#0284c7" strokeWidth="2" style={{ cursor: 'move' }} />;
            })}
          {/* The handoffs: the QB's (HANDOFF) and, on a reverse, the back's to the receiver (REVERSE; where they
              meet when the coach didn't mark it). */}
          {(() => {
            const fr = animatedFrame;
            const spots: { key: string; at: { x: number; y: number }; label: string; when?: number; auto?: boolean }[] = [];
            const tossed = handoffSpots.some((s) => strokesProp[s.i]?.toss);
            if (fr.handoffAt) spots.push({ key: 'h', at: fr.handoffAt, label: tossed ? 'TOSS' : 'HANDOFF', when: fr.handoffProgress });
            if (fr.reverseAt) {
              const marked = handoffSpots.some((s) => s.role === ballRole);
              spots.push({ key: 'r', at: fr.reverseAt, label: 'REVERSE', when: fr.reverseProgress, auto: !marked });
            }
            // A spot marked that doesn't count (a pass, or after the ball carrier's): still shown where it was put.
            if (!spots.length && handoffSpot) spots.push({ key: 'h', at: handoffSpot, label: 'HANDOFF' });
            return spots.map((s) => {
              const p = fieldToSvg(s.at.x, s.at.y);
              const atExchange = animProgress > 0.002 && s.when !== undefined && Math.abs(animProgress - s.when) < 0.06;
              const ink = s.key === 'r' ? '#7c2d12' : '#92400e';
              return (
                <g key={s.key} pointerEvents="none" aria-label={`${s.label} spot`} opacity={animProgress > 0.002 && !atExchange ? 0.72 : s.auto ? 0.85 : 1}>
                  {atExchange && <circle cx={p.cx} cy={p.cy} r="14" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="3 2" />}
                  <ellipse
                    cx={p.cx}
                    cy={p.cy}
                    rx="8"
                    ry="5"
                    fill={atExchange ? '#f59e0b' : s.auto ? 'none' : ink}
                    stroke={s.auto ? ink : '#fff'}
                    strokeWidth="1.5"
                    strokeDasharray={s.auto ? '2 2' : undefined}
                  />
                  {!s.auto && <line x1={p.cx - 3} y1={p.cy} x2={p.cx + 3} y2={p.cy} stroke="#fff" strokeWidth="1.2" />}
                  <text x={p.cx} y={p.cy - 9} textAnchor="middle" fontSize="9" fontWeight="800" fill={ink}>
                    {s.label}
                  </text>
                </g>
              );
            });
          })()}
          {/* Pursuit Angle Lines for the active coaching checkpoint (and live draft while drawing) */}
          {((!skipNotes && activeCheckpoint) || pursuitDrawMode || editingCheckpointId) && (() => {
            const linesToRender: PursuitLine[] = [
              ...(activeCheckpoint ? activeCheckpoint.pursuitLines : []),
              ...(draftPursuitPoints && draftPursuitPoints.length >= 2 ? [{ points: draftPursuitPoints, color: pursuitColor }] : []),
            ];
            if (!linesToRender.length) return null;
            return (
              <g key="pursuit-angle-lines" pointerEvents="none">
                {linesToRender.map((pl, idx) => {
                  if (pl.points.length < 2) return null;
                  const col = pl.color || '#06b6d4';
                  const d = pl.points
                    .map((pt, j) => {
                      const { cx, cy } = fieldToSvg(pt.x, pt.y);
                      return `${j === 0 ? 'M' : 'L'}${cx},${cy}`;
                    })
                    .join(' ');
                  const first = fieldToSvg(pl.points[0].x, pl.points[0].y);
                  const last = pl.points[pl.points.length - 1];
                  const prev = pl.points[pl.points.length - 2];
                  const a = fieldToSvg(prev.x, prev.y);
                  const b = fieldToSvg(last.x, last.y);
                  const midPt = pl.points[Math.floor(pl.points.length / 2)];
                  const midSvg = fieldToSvg(midPt.x, midPt.y);
                  return (
                    <g key={`pursuit-${idx}`}>
                      <path
                        d={d}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={7}
                        strokeOpacity={0.65}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke={col}
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="8 5"
                      />
                      <circle cx={first.cx} cy={first.cy} r={5} fill={col} stroke="#ffffff" strokeWidth={1.6} />
                      <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={col} />
                      {idx === 0 && (
                        <g transform={`translate(${midSvg.cx}, ${midSvg.cy - 10})`}>
                          <rect x={-26} y={-8} width={52} height={14} rx={4} fill={col} stroke="#ffffff" strokeWidth={1.2} />
                          <text x={0} y={2} textAnchor="middle" fill="#0f172a" fontSize="7.5" fontWeight="900">
                            PURSUIT
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })()}
        </svg>

        {/* Their shift: stopped when it's set (where do we go?), and when our defense is set on it. */}
        {pickedSlot && (
          <div
            data-stage-ui
            role="status"
            className="absolute left-3 right-3 top-12 z-20 max-w-md mx-auto rounded-2xl border-2 border-sky-400/90 bg-slate-950/92 backdrop-blur-md text-white px-3.5 py-2 shadow-2xl flex items-center justify-between gap-2"
          >
            <span className="text-sm font-bold">
              {pickedSlot.side === 'left' ? 'Left' : 'Right'} {pickedSlot.gap} gap: tap the defender who fits it.
            </span>
            <button type="button" onClick={() => setPickedGap(null)} className="h-7 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 ring-1 ring-white/30 text-xs font-black cursor-pointer">
              Cancel
            </button>
          </div>
        )}
        {(atShiftSet || atDefenseSet) && !pursuitDrawMode && (
          <div
            data-stage-ui
            role="status"
            className="absolute left-3 right-3 top-12 z-20 max-w-xl mx-auto rounded-2xl border-2 border-teal-400/90 bg-slate-950/92 backdrop-blur-md text-white px-3.5 py-2.5 shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wider text-teal-300">{atShiftSet ? 'They shifted' : 'Our defense is set'}</div>
                <div className="text-sm font-bold leading-snug">
                  {atShiftSet
                    ? onShiftDefenseMove
                      ? 'Where does our defense go? Drag a defender to his new spot, or show it slide over.'
                      : 'Where does our defense go? Continue to show it slide over.'
                    : onShiftDefenseMove
                      ? 'Drag any defender to where he lines up after the shift, or tap him to change his rules after it (gap, contain...). The play still starts from his spot before it.'
                      : 'Lined up on their new formation.'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {atDefenseSet && shiftDefenseEdited && onShiftDefenseReset && (
                  <button
                    type="button"
                    onClick={onShiftDefenseReset}
                    title="Back to the automatic spots: the line counted from the middle man of their line"
                    className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 ring-1 ring-white/30 text-white text-xs font-bold cursor-pointer"
                  >
                    ↺ Auto spots
                  </button>
                )}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-black cursor-pointer"
                >
                  {atShiftSet ? '▶ Show our adjustment' : '▶ Continue'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Coaching Note & Pursuit Angle Checkpoint Overlay Card (shown when paused at a checkpoint or while editing/drawing pursuit angles) */}
        {((!skipNotes && !isPlaying && activeCheckpoint && (activeCheckpoint.note.trim().length > 0 || activeCheckpoint.pursuitLines.length > 0)) ||
          pursuitDrawMode ||
          (activeCheckpoint && editingCheckpointId === activeCheckpoint.id)) && (
          <div
            data-stage-ui
            className="absolute left-3 right-3 top-12 z-20 max-w-xl mx-auto rounded-2xl border-2 border-amber-400/90 bg-slate-950/92 backdrop-blur-md text-white px-3.5 py-2.5 shadow-2xl space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider">
                  📌 Coaching Point{' '}
                  {activeCheckpoint
                    ? `${sortedCheckpoints.findIndex((c) => c.id === activeCheckpoint.id) + 1} of ${sortedCheckpoints.length}`
                    : ''}
                </span>
                <span className="text-[11px] font-bold text-amber-200 tabular-nums">
                  @ {(animProgress * seconds).toFixed(1)}s · {animatedFrame.phaseLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPursuitDrawMode(false);
                    setEditingCheckpointId(null);
                    togglePlay();
                  }}
                  title="Resume play movement until the next coaching note checkpoint (Space)"
                  className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  {animProgress >= 0.99 ? '↻ Replay' : '▶ Continue Play'}
                </button>
                <button
                  type="button"
                  aria-pressed={pursuitDrawMode}
                  onClick={() => {
                    if (!activeCheckpoint) ensureCheckpointAtCurrent();
                    setPursuitDrawMode((v) => !v);
                  }}
                  title="Draw pursuit angle arrows directly on the field for this moment"
                  className={`h-7 px-2.5 rounded-lg border text-[11px] font-black cursor-pointer transition-colors ${
                    pursuitDrawMode
                      ? 'border-cyan-300 bg-cyan-500 text-slate-950'
                      : 'border-cyan-400/50 bg-slate-900 text-cyan-300 hover:bg-slate-800'
                  }`}
                >
                  📐 {pursuitDrawMode ? 'Drawing Pursuit (Drag Field)…' : 'Draw Pursuit Angle'}
                </button>
                {activeCheckpoint && (
                  <button
                    type="button"
                    onClick={() => deleteCheckpoint(activeCheckpoint.id)}
                    title="Delete this coaching note & pursuit stop"
                    className="h-7 px-2 rounded-lg border border-rose-500/40 bg-rose-950/60 text-rose-300 hover:bg-rose-900 text-[11px] font-bold cursor-pointer"
                  >
                    🗑 Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPursuitDrawMode(false);
                    setEditingCheckpointId(null);
                  }}
                  title="Hide editor"
                  className="h-7 w-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 inline-flex items-center justify-center text-xs font-black cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            {activeCheckpoint && (
              <div className="space-y-1.5">
                {activeCheckpoint.note.trim() && editingCheckpointId !== activeCheckpoint.id && !pursuitDrawMode ? (
                  <div
                    onClick={() => setEditingCheckpointId(activeCheckpoint.id)}
                    title="Click to edit coaching note"
                    className="text-sm sm:text-base font-extrabold text-amber-100 bg-slate-900/80 rounded-xl px-3 py-2 border border-amber-400/30 cursor-pointer"
                  >
                    {activeCheckpoint.note}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={activeCheckpoint.note}
                    onChange={(e) => updateCheckpoint(activeCheckpoint.id, { note: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setEditingCheckpointId(null);
                        setPursuitDrawMode(false);
                      }
                    }}
                    placeholder="Type coaching note to show when the play pauses here (e.g. 'Will & Mike: take flat pursuit angle to cut off sweep')…"
                    className="w-full h-9 rounded-xl border border-amber-400/50 bg-slate-900 px-3 text-xs sm:text-sm font-bold text-white placeholder:text-slate-400 outline-none focus:border-amber-300"
                  />
                )}
                {(pursuitDrawMode || activeCheckpoint.pursuitLines.length > 0) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="font-bold text-cyan-300">Pursuit Line Color:</span>
                      {PURSUIT_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => {
                            setPursuitColor(c.hex);
                            setPursuitDrawMode(true);
                          }}
                          title={`Draw ${c.label} pursuit angle`}
                          className={`h-5 w-5 rounded-full cursor-pointer transition-transform ${
                            pursuitColor === c.hex ? 'ring-2 ring-white scale-110' : 'opacity-75 hover:opacity-100'
                          }`}
                          style={{ background: c.hex }}
                        />
                      ))}
                      <span className="text-slate-400 ml-1">
                        Drag from any defender on the field to draw their pursuit angle arrow
                      </span>
                    </div>
                    {activeCheckpoint.pursuitLines.length > 0 && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateCheckpoint(activeCheckpoint.id, {
                              pursuitLines: activeCheckpoint.pursuitLines.slice(0, -1),
                            })
                          }
                          className="h-6 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                        >
                          Undo Line
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCheckpoint(activeCheckpoint.id, { pursuitLines: [] })}
                          className="h-6 px-2 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold cursor-pointer"
                        >
                          Clear Lines ({activeCheckpoint.pursuitLines.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Tool & Controls Bar */}
      {animShown && (
        <div
          data-stage-ui
          className={
            bare
              ? 'absolute right-3 bottom-3 z-10 w-[min(50rem,calc(100%-1.5rem))] flex flex-col gap-1.5 px-3 py-2 rounded-2xl ring-1 ring-white/15 bg-slate-950/90 backdrop-blur-md text-white shadow-2xl'
              : 'flex flex-col gap-1.5 px-3 py-2 border-t border-emerald-500/30 bg-slate-900 text-white'
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            {/* Back to the start, a step back, start / pause, a step on, and key phase spots: to go over it with the team. */}
            <div className="inline-flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => { setIsPlaying(false); setAnimProgress(0); }} title="Back to the pre-snap alignment (Home)" aria-label="Back to the start" className={ctl}>⏮</button>
              <button type="button" onClick={() => stepAnim(-1)} title="Step back (left arrow)" aria-label="Step back" className={ctl}>◀︎</button>
              <button
                type="button"
                onClick={() => {
                  setPursuitDrawMode(false);
                  setEditingCheckpointId(null);
                  togglePlay();
                }}
                title={isPlaying ? 'Pause movement (space)' : 'Start / Continue movement (space)'}
                className="h-8 min-w-[5rem] px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shadow-xs"
              >
                {isPlaying ? '⏸ Pause' : animProgress >= 0.99 ? '↻ Again' : animProgress > 0.005 ? '▶ Continue' : '▶ Start'}
              </button>
              <button type="button" onClick={() => stepAnim(1)} title="Step on (right arrow)" aria-label="Step forward" className={ctl}>▶︎</button>
              {animatedFrame.stemProgress !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setAnimProgress(animatedFrame.stemProgress!);
                  }}
                  title="Jump to Defensive Preset / Formation Stem before the snap"
                  className={`${ctl} w-auto px-2 text-[10px] border border-rose-500/40 text-rose-300`}
                >
                  🛡 Def Preset
                </button>
              )}
              {shiftSetAt !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setAnimProgress(shiftSetAt);
                  }}
                  title="Their shift set: our defense still where it lined up"
                  className={`${ctl} w-auto px-2 text-[10px] border border-teal-500/40 text-teal-200`}
                >
                  Shift
                </button>
              )}
              {defenseSetAt !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setAnimProgress(defenseSetAt);
                  }}
                  title="Our defense set after their shift (drag a defender to move his spot)"
                  className={`${ctl} w-auto px-2 text-[10px] border border-teal-500/40 text-teal-200`}
                >
                  D set
                </button>
              )}
              {snapAt > 0.001 && (
                <button type="button" onClick={() => { setIsPlaying(false); setAnimProgress(snapAt); }} title="Jump to the snap (motion and defensive shifts set)" className={`${ctl} w-auto px-2 text-[10px]`}>
                  Snap
                </button>
              )}
              {animatedFrame.handoffProgress !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setAnimProgress(animatedFrame.handoffProgress!);
                  }}
                  title="Jump to the Handoff spot where 1 (QB) hands the ball to the runner"
                  className={`${ctl} w-auto px-2 text-[10px] border border-amber-400/50 text-amber-300`}
                >
                  🏈 Handoff
                </button>
              )}
              {animatedFrame.stuntProgress !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setAnimProgress(animatedFrame.stuntProgress!);
                  }}
                  title="Jump to the Defensive Stunt / Blitz firing through the line"
                  className={`${ctl} w-auto px-2 text-[10px] border border-red-500/40 text-red-300`}
                >
                  ⚡ Stunt / Blitz
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setAnimProgress(snapAt + (1 - snapAt) * 0.25);
                }}
                title="Jump to Phase 1: Linebackers reading keys & flowing laterally with the backfield"
                className={`${ctl} w-auto px-2 text-[10px] border border-emerald-500/40 text-emerald-300`}
              >
                Flow
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setAnimProgress(snapAt + (1 - snapAt) * 0.52);
                }}
                title="Jump to Phase 2: Linebackers triggering downhill to attack their gap fit"
                className={`${ctl} w-auto px-2 text-[10px] border border-amber-500/40 text-amber-300`}
              >
                Attack
              </button>
              {sortedCheckpoints.map((cp, idx) => {
                const isHere = activeCheckpoint?.id === cp.id;
                return (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setAnimProgress(cp.progress);
                      setEditingCheckpointId(cp.id);
                    }}
                    title={cp.note ? `Note ${idx + 1}: ${cp.note}` : `Coaching Stop ${idx + 1} (${(cp.progress * seconds).toFixed(1)}s)`}
                    className={`${ctl} w-auto px-2 text-[10px] border ${
                      isHere
                        ? 'border-amber-300 bg-amber-500 text-slate-950'
                        : 'border-amber-400/50 text-amber-300'
                    }`}
                  >
                    📌 Note {idx + 1}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  const cp = ensureCheckpointAtCurrent();
                  setEditingCheckpointId(cp.id);
                  setPursuitDrawMode(true);
                }}
                title="Add a Coaching Note and/or draw Pursuit Angle arrows at this point in the play (pauses here during presentation)"
                className="h-8 px-2.5 rounded-md border border-cyan-400/60 bg-cyan-950/70 hover:bg-cyan-900 text-cyan-200 text-[10px] font-black cursor-pointer inline-flex items-center gap-1"
              >
                📐 + Note / Pursuit
              </button>
              <button
                type="button"
                aria-pressed={!skipNotes}
                onClick={() => {
                  const nextSkip = !skipNotes;
                  setSkipNotes(nextSkip);
                  if (nextSkip) {
                    setPursuitDrawMode(false);
                    setEditingCheckpointId(null);
                  }
                }}
                title={
                  skipNotes
                    ? 'Play Through Mode ON: Play Movement will NOT stop at notes or show pursuit overlays (click to re-enable note stops)'
                    : 'Stop & Show Notes ON: Play Movement pauses at each note/pursuit checkpoint (click to play through without stopping)'
                }
                className={`h-8 px-2.5 rounded-md border text-[10px] font-black cursor-pointer inline-flex items-center gap-1 ${
                  !skipNotes
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {skipNotes ? '⏭ Play Through (No Notes)' : '📌 Stop & Show Notes'}
              </button>
              <button
                type="button"
                aria-pressed={loopPlay}
                onClick={() => {
                  const nextLoop = !loopPlay;
                  setLoopPlay(nextLoop);
                  if (nextLoop && !isPlaying) {
                    if (animProgress >= 0.99) setAnimProgress(0);
                    setIsPlaying(true);
                  }
                }}
                title="Walkthrough Huddle Loop: plays continuously, pauses 2s at each note/teaching stop, and loops automatically"
                className={`h-8 px-2.5 rounded-md border text-[10px] font-black cursor-pointer inline-flex items-center gap-1 ${
                  loopPlay
                    ? 'border-emerald-400 bg-emerald-600/30 text-emerald-200'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🔁 {loopPlay ? 'Loop ON' : 'Loop'}
              </button>
              {prevDefense && (
                <button
                  type="button"
                  aria-pressed={showGhostDefense}
                  onClick={() => setShowGhostDefense((v) => !v)}
                  title={`Overlay faint ghost trails of the previous defensive look (${prevDefense.label}) so players can compare why the front/stunt adjustment closed the lane`}
                  className={`h-8 px-2.5 rounded-md border text-[10px] font-black cursor-pointer inline-flex items-center gap-1 ${
                    showGhostDefense
                      ? 'border-violet-400 bg-violet-600/30 text-violet-200'
                      : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  👻 {showGhostDefense ? `Ghost: ${prevDefense.label}` : `Compare: ${prevDefense.label}`}
                </button>
              )}
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 min-w-[110px] text-center">
              {animatedFrame.phaseLabel}
            </span>
            {animProgress > snapAt + 0.01 && (() => {
              const gainYds = Math.round(animatedFrame.ball.y * 10) / 10;
              const isPos = gainYds > 0.2;
              const isNeg = gainYds < -0.2;
              return (
                <span
                  title="Live ball spot relative to the Line of Scrimmage"
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-black tabular-nums whitespace-nowrap ${
                    isPos
                      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                      : isNeg
                        ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                  }`}
                >
                  🏈 {gainYds > 0 ? `+${gainYds.toFixed(1)} yds` : gainYds < 0 ? `${gainYds.toFixed(1)} yds` : 'LOS'}
                </span>
              );
            })()}
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(animProgress * 1000)}
              onChange={(e) => {
                setIsPlaying(false);
                setAnimProgress(Number(e.target.value) / 1000);
              }}
              aria-label="Play movement timeline"
              className="h-1.5 flex-1 min-w-[100px] cursor-pointer accent-emerald-500"
            />
            <span className="font-mono text-[10px] font-bold text-slate-300 tabular-nums whitespace-nowrap">
              {(animProgress * seconds).toFixed(1)}s / {seconds.toFixed(1)}s
            </span>
            <div role="group" aria-label="Speed" className="inline-flex rounded border border-slate-700 overflow-hidden text-[10px] font-extrabold">
              {ANIM_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  aria-pressed={animSpeed === spd}
                  onClick={() => setAnimSpeed(spd)}
                  title={spd < 1 ? `Slow motion: ${spd}× speed` : 'Full speed'}
                  className={`px-1.5 py-1 cursor-pointer ${animSpeed === spd ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {spd}×
                </button>
              ))}
            </div>
            <div
              role="group"
              aria-label="Auto-Pause Checkpoints"
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-bold"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">⏸ Auto-Pause:</span>
              {snapAt > 0.001 && (
                <button
                  type="button"
                  aria-pressed={stopAtSnap}
                  onClick={() => setStopAtSnap(!stopAtSnap)}
                  title="Auto-pause at the Snap (once pre-snap shifts and motion are set)"
                  className={`px-1.5 py-0.5 rounded cursor-pointer font-black transition-colors ${
                    stopAtSnap ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Snap
                </button>
              )}
              <button
                type="button"
                aria-pressed={stopAtRead}
                onClick={() => setStopAtRead(!stopAtRead)}
                title="Auto-pause at the Handoff / QB Read key checkpoint"
                className={`px-1.5 py-0.5 rounded cursor-pointer font-black transition-colors ${
                  stopAtRead ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Handoff / Read
              </button>
              <button
                type="button"
                aria-pressed={stopAtFit}
                onClick={() => setStopAtFit(!stopAtFit)}
                title="Auto-pause at the Linebacker Gap Fit / Downhill Trigger checkpoint"
                className={`px-1.5 py-0.5 rounded cursor-pointer font-black transition-colors ${
                  stopAtFit ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Gap Fit
              </button>
              <button
                type="button"
                aria-pressed={stopAtTackle}
                onClick={() => setStopAtTackle(!stopAtTackle)}
                title="Auto-pause when a defender first makes Tackle contact with the ball carrier"
                className={`px-1.5 py-0.5 rounded cursor-pointer font-black transition-colors ${
                  stopAtTackle ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tackle
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setAnimProgress(0);
                setAnimOpen(false);
              }}
              title="Close the movement menu (back to the alignment)"
              aria-label="Close the movement"
              className="h-7 w-7 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer inline-flex items-center justify-center text-sm font-black"
            >
              ✕
            </button>
          </div>
          {defensePresetBar && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
              {defensePresetBar}
            </div>
          )}
        </div>
      )}
      {tools && (
      <>
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
            'shift',
            'Draw a pre-snap shift: he moves to a new spot and sets. Then switch to Motion, Route or Run to keep drawing (S)',
            <>
              <svg width="16" height="14" viewBox="0 0 26 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M3 12h13" strokeDasharray="2 4" />
                <circle cx="20" cy="12" r="3.5" />
              </svg>
              <span className="hidden sm:inline">Shift</span>
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
      </>
      )}
      {assignmentHost ? createPortal(assignmentPanel, assignmentHost) : assignmentPanel}
    </div>
  );
};
