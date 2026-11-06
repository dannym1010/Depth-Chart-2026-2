import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { buildProjectedFieldGrid, getQuadHomographies, HOMOGRAPHY_PRESETS, imageToField, type HomographyQuad, type ImagePoint, type UnitFilmTransform } from '../utils/videoHomography';
import { DEFENSE_COLOR, diagramLabel, isDefenseRole, lineStartsOn, passThrow, shiftLegs, shownText, skillDiagramLabel, STROKE_COLOR, THROW_COLOR, type PlayNode, type PlayStroke } from '../utils/footballEngine';
import { arrowOnField, circleOnField, cutLine, dashLine, densify, lengthOf, pointBack, polygon, polyline, ribbon, tOnField, zigzagLine, type Px } from './linesArt';
import { cameraFromFilm, cameraProjector, clipPolygon, filmProjector, lerpCam, MAX_PITCH, MIN_PITCH, VIEWS, visibleRuns, type Cam, type Projector } from './fieldCamera';
import { computeAnimatedPlayFrame, DEFENSE_TRAIL, playAnimationSeconds } from '../utils/playAnimation';
import { computeGapIntegrity, type GapFitSlot } from '../utils/defenseReads';
import { defenseCallStrokes, joinPressure, pressureParts, PRESSURES } from '../utils/defenseCalls';
import { safeJSONParse, safeJSONSet } from '../services/storageService';
import { ChevronLeft, ChevronRight, Columns3, Contrast, Eye, EyeOff, FlipHorizontal2, FlipVertical2, Map as MapIcon, Move, MoveUpRight, Pause, Play, RotateCcw, SkipBack, X } from 'lucide-react';
import { AMBER, btn as BTN, divider, idle, INK, on as onBtn, overVideo, playButton, playButtonStyle, tray, trayItem, trayPicked, trayStyle } from './controlStyles';

/** The selected play as the Play Builder draws it, to lay over the film. */
export interface VideoLines {
  nodes: PlayNode[];
  strokes: PlayStroke[];
  ballRole: string;
  /** Where the field is in the video: 4 corners (fractions of the frame). */
  quad: HomographyQuad;
  setQuad: (quad: HomographyQuad) => void;
  /** A player dragged on the film, to his spot on the field (yards): kept in the lineup, on this film only. */
  moveNode?: (role: string, x: number, y: number) => void;
  name: string;
  /** Our defenders' rules picked in the builder (gap, flow, technique...), by role: their reads and gap fits. */
  defenseRules?: Record<string, Record<string, string>>;
  /** The hole the play goes to (its number), and where it is across the field (yards): the gap it attacks. */
  hole?: number | null;
  holeX?: number | null;
  /** The play's lines without our defense's call, and the call (blitz+stunt ids, coverage, single jobs): so another
   *  blitz or stunt can be picked over the film. */
  baseStrokes?: PlayStroke[];
  pressure?: string;
  coverage?: string;
  defenseAssign?: Record<string, string>;
}

/** What the Film Player needs: the button, the lines (inside the zoom, so they stay on the field) and the controls (outside it). */
export interface PlayLinesControl {
  on: boolean;
  toggle: () => void;
  layer: (state: { playing: boolean; zoom: number }) => React.ReactNode;
  /** CSS filter applied to the underlying video when play lines are shown so routes/assignments stand out clearly. */
  videoFilter?: (state: { playing: boolean }) => string | undefined;
  /** Its buttons: in the player's control bar, just above the Play lines button (inline: in its row, without the play's name). */
  bar: (state: { playing: boolean; inline?: boolean }) => React.ReactNode;
  /** What's happening (the phase, how to line up the field...): over the top right of the video. */
  controls: (state: { playing: boolean }) => React.ReactNode;
}

type Corner = 'losLeft' | 'losRight' | 'backLeft' | 'backRight';
const CORNERS: { key: Corner; color: string }[] = [
  { key: 'losLeft', color: '#f59e0b' },
  { key: 'losRight', color: '#f59e0b' },
  { key: 'backLeft', color: '#38bdf8' },
  { key: 'backRight', color: '#38bdf8' },
];

type Side = 'offense' | 'defense' | 'both';
const SIDES: [Side, string][] = [
  ['offense', 'Offense'],
  ['defense', 'Defense'],
  ['both', 'Both'],
];
type AlignTarget = 'field' | 'offense' | 'defense' | 'players';
const SIDE_KEY = 'mahopac_film_lines_side';
const CLEAN_KEY = 'mahopac_film_lines_clean';
const SHADE_KEY = 'mahopac_film_lines_shade';
const SPEED_KEY = 'mahopac_film_lines_speed';
const GAPS_KEY = 'mahopac_film_lines_gaps';
const DARROWS_KEY = 'mahopac_film_lines_darrows';
const MODE_KEY = 'mahopac_film_lines_mode';
/** Edit: every control (lining up, the clean field, the shade...). Present: just what's needed in front of the team. */
type LinesMode = 'edit' | 'present';
/** The defense's arrows: each defender's path through this much of the play after the snap (his read and fit). */
const DEF_ARROW_UNTIL = 0.6;
/** Run play speeds: slow motion down to a tenth, for going over it with the team. */
const LINE_SPEEDS: [number, string][] = [
  [0.1, '0.1×'],
  [0.25, '¼×'],
  [0.5, '½×'],
  [1, '1×'],
];
/** One step back or on: this much of the play, in seconds. */
const LINE_STEP_SECONDS = 0.1;
const showsDefense = (side: Side) => side !== 'offense';
const showsOffense = (side: Side) => side !== 'defense';
/** Our defense's lines (blitzes, coverage) carry their own color; the offense's don't. */
const isDefenseStroke = (s: PlayStroke) => Boolean(s.color || s.zone || s.man);
// Seconds for the whole play (motion, snap and the play) at full speed.
// Stops the stage under the controls from taking a press as play / pause or a pan.
const keep = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onPointerUp: (e: React.PointerEvent) => e.stopPropagation(),
  onClick: (e: React.MouseEvent) => e.stopPropagation(),
  onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
};
const panel = overVideo;
// A lineup nobody has fitted to a film yet: one of the stock camera angles (the builder starts plays on the sideline one).
const STOCK = Object.values(HOMOGRAPHY_PRESETS)
  .filter((p) => p.quad.preset !== 'custom')
  .map((p) => JSON.stringify(p.quad));
// A stock angle, or the film's lineup picked up (not set on this play): it follows the film's latest lineup.
const notLinedUp = (q: HomographyQuad) => Boolean(q.fromFilm) || STOCK.includes(JSON.stringify(q));
/**
 * Film starts from behind the offense, high up: the line of scrimmage across the middle of the picture, the offense
 * below it. Seen from there the field is wide and its depth short (5 yards of backfield is a sliver of the picture).
 */
const FILM_START: HomographyQuad = {
  losLeft: { u: 0.2, v: 0.5 },
  losRight: { u: 0.8, v: 0.5 },
  backLeft: { u: 0.16, v: 0.63 },
  backRight: { u: 0.84, v: 0.63 },
  halfWidth: 12,
  backDepth: 5,
  preset: 'custom',
};
/** The lineup wider or narrower (along the line of scrimmage) and deeper or shallower (the backfield), the line where it is. */
export function stretchQuad(q: HomographyQuad, width: number, depth: number): HomographyQuad {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const spread = (a: ImagePoint, b: ImagePoint): [ImagePoint, ImagePoint] => {
    const mu = (a.u + b.u) / 2, mv = (a.v + b.v) / 2;
    return [
      { u: mu + (a.u - mu) * width, v: mv + (a.v - mv) * width },
      { u: mu + (b.u - mu) * width, v: mv + (b.v - mv) * width },
    ];
  };
  const [losLeft, losRight] = spread(q.losLeft, q.losRight);
  const [bl, br] = spread(q.backLeft, q.backRight);
  const back = (los: ImagePoint, b: ImagePoint) => ({ u: r(los.u + (b.u - los.u) * depth), v: r(los.v + (b.v - los.v) * depth) });
  return {
    ...q,
    losLeft: { u: r(losLeft.u), v: r(losLeft.v) },
    losRight: { u: r(losRight.u), v: r(losRight.v) },
    backLeft: back(losLeft, bl),
    backRight: back(losRight, br),
    preset: 'custom',
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function hasUnitTransform(ut?: UnitFilmTransform): boolean {
  if (!ut) return false;
  return Boolean(
    (ut.dx && Math.abs(ut.dx) > 0.01) ||
      (ut.dy && Math.abs(ut.dy) > 0.01) ||
      (ut.scaleX !== undefined && Math.abs(ut.scaleX - 1) > 0.01) ||
      (ut.scaleY !== undefined && Math.abs(ut.scaleY - 1) > 0.01)
  );
}

function transformUnitPoint(x: number, y: number, def: boolean, ut?: UnitFilmTransform): { x: number; y: number } {
  if (!ut) return { x, y };
  const sx = ut.scaleX ?? 1;
  const sy = ut.scaleY ?? 1;
  const dx = ut.dx ?? 0;
  const dy = ut.dy ?? 0;
  const baseY = def ? 1.2 : 0;
  return {
    x: r2(x * sx + dx),
    y: r2(baseY + (y - baseY) * sy + dy),
  };
}

/** Shift the full Offense or full Defense unit (and any individually-moved players on that side) by (ddx, ddy) yards. */
export function shiftUnitQuad(
  baseQ: HomographyQuad,
  unit: 'offense' | 'defense',
  ddx: number,
  ddy: number,
): HomographyQuad {
  const key = unit === 'defense' ? 'defenseTransform' : 'offenseTransform';
  const prev = baseQ[key] || {};
  const nextUt: UnitFilmTransform = {
    ...prev,
    dx: r2((prev.dx ?? 0) + ddx),
    dy: r2((prev.dy ?? 0) + ddy),
  };
  const defSide = unit === 'defense';
  const nextMoved: Record<string, { x: number; y: number }> = { ...(baseQ.moved || {}) };
  for (const [role, pt] of Object.entries(nextMoved)) {
    if (isDefenseRole(role) === defSide) {
      nextMoved[role] = { x: r2(pt.x + ddx), y: r2(pt.y + ddy) };
    }
  }
  return {
    ...baseQ,
    [key]: nextUt,
    ...(Object.keys(nextMoved).length ? { moved: nextMoved } : {}),
  };
}

/** Scale the full Offense or full Defense unit's width and/or depth independently. */
export function scaleUnitQuad(
  baseQ: HomographyQuad,
  unit: 'offense' | 'defense',
  multX: number,
  multY: number,
): HomographyQuad {
  const key = unit === 'defense' ? 'defenseTransform' : 'offenseTransform';
  const prev = baseQ[key] || {};
  const sx = Math.max(0.35, Math.min(2.6, r2((prev.scaleX ?? 1) * multX)));
  const sy = Math.max(0.35, Math.min(2.6, r2((prev.scaleY ?? 1) * multY)));
  const dx = prev.dx ?? 0;
  const dy = prev.dy ?? 0;
  const defSide = unit === 'defense';
  const anchorY = (defSide ? 1.2 : 0) + dy;
  const nextMoved: Record<string, { x: number; y: number }> = { ...(baseQ.moved || {}) };
  for (const [role, pt] of Object.entries(nextMoved)) {
    if (isDefenseRole(role) === defSide) {
      nextMoved[role] = {
        x: r2(dx + (pt.x - dx) * multX),
        y: r2(anchorY + (pt.y - anchorY) * multY),
      };
    }
  }
  return {
    ...baseQ,
    [key]: { ...prev, scaleX: sx, scaleY: sy },
    ...(Object.keys(nextMoved).length ? { moved: nextMoved } : {}),
  };
}

/** Reset the full Offense or full Defense unit transform (and that unit's moved players) back to diagram spots. */
export function resetUnitQuad(baseQ: HomographyQuad, unit: 'offense' | 'defense'): HomographyQuad {
  const defSide = unit === 'defense';
  const next: HomographyQuad = { ...baseQ };
  if (defSide) delete next.defenseTransform;
  else delete next.offenseTransform;
  if (next.moved) {
    const kept = Object.fromEntries(Object.entries(next.moved).filter(([role]) => isDefenseRole(role) !== defSide));
    if (Object.keys(kept).length) next.moved = kept;
    else delete next.moved;
  }
  return next;
}

/** Reset individual moved players for Offense only, Defense only, or All, while keeping full-unit transforms. */
export function resetMovedPlayersQuad(baseQ: HomographyQuad, target: 'offense' | 'defense' | 'all'): HomographyQuad {
  const next: HomographyQuad = { ...baseQ };
  if (!next.moved) return next;
  if (target === 'all') {
    delete next.moved;
    return next;
  }
  const defSide = target === 'defense';
  const kept = Object.fromEntries(Object.entries(next.moved).filter(([role]) => isDefenseRole(role) !== defSide));
  if (Object.keys(kept).length) next.moved = kept;
  else delete next.moved;
  return next;
}

/**
 * The play as it lines up on this film: full Offense / full Defense unit alignment and individual players moved
 * on the film where the coach put them, each one's lines moving with him. The diagram itself isn't changed.
 */
function onFilm(lines: VideoLines): VideoLines {
  const { moved, offenseTransform, defenseTransform } = lines.quad;
  const hasMoved = Boolean(moved && Object.keys(moved).length);
  const hasOff = hasUnitTransform(offenseTransform);
  const hasDef = hasUnitTransform(defenseTransform);
  if (!hasMoved && !hasOff && !hasDef) return lines;

  const shift = new Map<string, { dx: number; dy: number }>();
  const nextNodes = lines.nodes.map((n) => {
    const def = isDefenseRole(n.role);
    const ut = def ? defenseTransform : offenseTransform;
    const m = moved?.[n.role];
    const pos = m ? m : transformUnitPoint(n.x, n.y, def, ut);
    if (Math.abs(pos.x - n.x) > 0.001 || Math.abs(pos.y - n.y) > 0.001) {
      shift.set(n.role, { dx: pos.x - n.x, dy: pos.y - n.y });
      return { ...n, x: pos.x, y: pos.y };
    }
    return n;
  });

  const strokes = lines.strokes.map((st) => {
    const owner = lines.nodes.find((n) => lineStartsOn(st, n, lines.nodes));
    if (owner && shift.has(owner.role)) {
      const { dx, dy } = shift.get(owner.role)!;
      return {
        ...st,
        points: st.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
        ...(st.man ? { man: { x: st.man.x + dx, y: st.man.y + dy } } : {}),
      };
    }
    if (!owner) {
      const ut = isDefenseStroke(st) ? defenseTransform : offenseTransform;
      const dx = ut?.dx ?? 0;
      const dy = ut?.dy ?? 0;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        return {
          ...st,
          points: st.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
          ...(st.man ? { man: { x: st.man.x + dx, y: st.man.y + dy } } : {}),
        };
      }
    }
    return st;
  });

  return { ...lines, nodes: nextNodes, strokes };
}
/**
 * The lineup a quarter turn clockwise about its middle, on a 16:9 picture (for film shot from another angle).
 */
function rotateQuad(q: HomographyQuad): HomographyQuad {
  return turnQuad(q, 90, 1);
}
/** The lineup turned `degrees` clockwise and sized by `scale`, about its middle, on a 16:9 picture. */
export function turnQuad(q: HomographyQuad, degrees: number, scale: number): HomographyQuad {
  const A = 16 / 9;
  const all = [q.losLeft, q.losRight, q.backLeft, q.backRight];
  const cu = all.reduce((s, p) => s + p.u, 0) / 4, cv = all.reduce((s, p) => s + p.v, 0) / 4;
  const a = (degrees * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const turn = (p: ImagePoint): ImagePoint => {
    const x = (p.u - cu) * A, y = p.v - cv;
    return { u: Math.round((cu + ((x * cos - y * sin) * scale) / A) * 1000) / 1000, v: Math.round((cv + (x * sin + y * cos) * scale) * 1000) / 1000 };
  };
  return { ...q, losLeft: turn(q.losLeft), losRight: turn(q.losRight), backLeft: turn(q.backLeft), backRight: turn(q.backRight), preset: 'custom' };
}

/**
 * Play lines for a film player: on / off, "Run play" (the motion, the snap and everyone along their lines on the
 * paused frame), "Line up field" (the yard lines and 4 corners to drag onto the film) and whose lines show (offense, defense or both). The field's
 * lineup is kept for the film (`filmKey`): the camera rarely moves, so a play not lined up yet starts from the last one.
 */
export function usePlayLines(opts: {
  lines: VideoLines | null;
  video: () => HTMLVideoElement | null;
  filmKey: string;
  /** Turning on: open whatever draws the play (the Film Room's diagram panel). */
  onTurnOn?: () => void;
  /** Shown when there's no play to draw yet. */
  waiting: string;
  /** The snap's down and distance (the line to gain, in yellow), and its spot and hash (the clean field's markings). */
  situation?: { down?: number; toGo?: number; yardLine?: number; hash?: 'L' | 'M' | 'R' };
}): PlayLinesControl {
  const { lines, video, filmKey, onTurnOn, waiting, situation } = opts;
  const [on, setOn] = useState(false);
  const [lineUp, setLineUp] = useState(false);
  const [alignTarget, setAlignTarget] = useState<AlignTarget>('field');
  // Whose lines show: the coach's last pick.
  const [side, setSide] = useState<Side>(() => {
    const saved = safeJSONParse<Side | null>(SIDE_KEY, null);
    return saved && SIDES.some(([id]) => id === saved) ? saved : 'offense';
  });
  const pickSide = (s: Side) => {
    setSide(s);
    safeJSONSet(SIDE_KEY, s);
  };
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  // Half speed unless the coach picks another (remembered on this device).
  const [speed, setSpeedState] = useState(() => {
    const v = safeJSONParse<number>(SPEED_KEY, 0.5);
    return LINE_SPEEDS.some(([s]) => s === v) ? v : 0.5;
  });
  const setSpeed = (v: number) => {
    setSpeedState(v);
    safeJSONSet(SPEED_KEY, v);
  };
  // The movement bar (start, step, play / pause, the scrubber, speed): up from Run play until it's closed.
  const [moveBar, setMoveBar] = useState(false);
  // Turned on, it shows the players lined up; the lines come on with a click.
  const [showLines, setShowLines] = useState(false);
  // Lining up: the 4 corners to drag, only when the coach wants an exact fit.
  const [corners, setCorners] = useState(false);
  // A tapped player: just his job.
  const [focus, setFocus] = useState<string | null>(null);
  // The clean field (a drawn field instead of the video), and its camera: null is the film's own angle.
  const [clean, setClean] = useState(() => safeJSONParse<boolean>(CLEAN_KEY, false) === true);
  // Shade and blur the video behind the play lines so routes, blocks and assignments pop clearly off the grass.
  const [shade, setShade] = useState(() => safeJSONParse<boolean>(SHADE_KEY, true) !== false);
  const pickShade = (v: boolean) => {
    setShade(v);
    safeJSONSet(SHADE_KEY, v);
  };
  // Our defense's gaps (who fits which, open or doubled) and each defender's arrow (his read and fit), like the
  // builder's: remembered on this device. Either one brings the defense on screen.
  const [showGaps, setShowGaps] = useState(() => safeJSONParse<boolean>(GAPS_KEY, false) === true);
  const [defArrows, setDefArrows] = useState(() => safeJSONParse<boolean>(DARROWS_KEY, false) === true);
  const pickGaps = (v: boolean) => {
    setShowGaps(v);
    safeJSONSet(GAPS_KEY, v);
    if (v && side === 'offense') pickSide('both');
  };
  const pickDefArrows = (v: boolean) => {
    setDefArrows(v);
    safeJSONSet(DARROWS_KEY, v);
    if (v && side === 'offense') pickSide('both');
  };
  // Another blitz and / or stunt over the film (null: the play's own call); its lines draw and it runs with Run play.
  const [callBlitz, setCallBlitz] = useState<string | null>(null);
  const [callStunt, setCallStunt] = useState<string | null>(null);
  const pickCall = (part: 'blitz' | 'stunt', id: string | null) => {
    (part === 'blitz' ? setCallBlitz : setCallStunt)(id);
    if (side === 'offense') pickSide('both');
  };
  const [mode, setModeState] = useState<LinesMode>(() => (safeJSONParse<LinesMode>(MODE_KEY, 'edit') === 'present' ? 'present' : 'edit'));
  const pickMode = (m: LinesMode) => {
    setModeState(m);
    safeJSONSet(MODE_KEY, m);
    if (m === 'present') {
      setLineUp(false);
      setCorners(false);
    }
  };
  const presenting = mode === 'present';
  const [cam, setCam] = useState<Cam | null>(null);
  const camRef = useRef(cam);
  camRef.current = cam;
  const pickClean = (on: boolean) => {
    setClean(on);
    safeJSONSet(CLEAN_KEY, on);
    cancelAnimationFrame(flight.current);
    if (!on) setCam(null);
  };
  // Flying the camera to an angle: from where it is (the film's own angle worked out from the lineup) over 0.6s.
  const flight = useRef(0);
  useEffect(() => () => cancelAnimationFrame(flight.current), []);
  const filmCam = () => (lines ? cameraFromFilm(getQuadHomographies(lines.quad).fieldToImageH, 1600, 900) : null);
  const flyTo = (to: Cam | 'film') => {
    cancelAnimationFrame(flight.current);
    const end = to === 'film' ? filmCam() : to;
    const start = camRef.current ?? filmCam();
    if (!start || !end || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCam(to === 'film' ? null : to);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 600);
      if (t >= 1) {
        setCam(to === 'film' ? null : end);
        return;
      }
      setCam(lerpCam(start, end, 1 - Math.pow(1 - t, 3)));
      flight.current = requestAnimationFrame(step);
    };
    flight.current = requestAnimationFrame(step);
  };
  const lineupKey = `mahopac_film_lineup_${filmKey}`;

  // A play not lined up on its own: the latest lineup on this film (the plays before it in the series), else the line
  // of scrimmage across the picture. Once the coach turns, sizes or moves it on this play, it keeps its own.
  useEffect(() => {
    if (!on || !lines || !notLinedUp(lines.quad)) return;
    const saved = safeJSONParse<HomographyQuad | null>(lineupKey, null);
    const next = saved && !notLinedUp(saved) ? { ...saved, fromFilm: true } : { ...FILM_START, fromFilm: true };
    if (JSON.stringify(next) !== JSON.stringify(lines.quad)) lines.setQuad(next);
  }, [on, lines, lineupKey]);

  // Run play: 0 -> 1 over the play's length (longer with motion: the motion, then set), then it stays on the last frame.
  const seconds = playAnimationSeconds(lines?.strokes || []);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        // A long frame (the tab in the background) moves on one frame's worth, not a jump.
        const next = Math.min(1, p + (Math.min(dt, 0.05) * speed) / seconds);
        if (next >= 1) setRunning(false);
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, seconds]);
  const runPlay = () => {
    setMoveBar(true);
    // From where it is, or from the start once it has finished.
    setProgress((p) => (p >= 1 ? 0 : p));
    setRunning(true);
  };
  const stepPlay = (dir: -1 | 1) => {
    setRunning(false);
    setProgress((p) => Math.max(0, Math.min(1, p + (dir * LINE_STEP_SECONDS) / seconds)));
  };
  // Another play: back to the start.
  useEffect(() => {
    setRunning(false);
    setProgress(0);
    setFocus(null);
    setCallBlitz(null);
    setCallStunt(null);
  }, [lines?.name]);

  // The coach's change to the lineup: this play's own from now on, and the film's latest for the plays after it.
  // Players and full-unit Offense/Defense shifts on the film are this play's own, not the film's for the plays after it.
  const shown = useMemo(() => {
    if (!lines) return null;
    const setQuad = (q: HomographyQuad) => {
      const { fromFilm: _picked, ...own } = q;
      lines.setQuad(own);
      const { moved: _players, offenseTransform: _off, defenseTransform: _def, ...field } = own;
      safeJSONSet(lineupKey, field);
    };
    // Another blitz or stunt picked over the film: the play's lines with that call drawn instead of its own (from
    // the diagram's spots, so it moves with the players lined up on the film).
    const own = pressureParts(lines.pressure);
    const blitz = callBlitz ?? own.blitz;
    const stunt = callStunt ?? own.stunt;
    const recalled = (callBlitz !== null || callStunt !== null) && lines.baseStrokes;
    const src: VideoLines = recalled
      ? {
          ...lines,
          strokes: [
            ...lines.baseStrokes!,
            ...defenseCallStrokes(
              lines.nodes.filter((n) => isDefenseRole(n.role)),
              lines.nodes.filter((n) => !isDefenseRole(n.role)),
              joinPressure(blitz, stunt),
              lines.coverage,
              lines.defenseAssign
            ),
          ],
        }
      : lines;
    return {
      ...onFilm(src),
      setQuad,
      // A player dragged on the film: where he lines up in this clip. The diagram keeps him where he's drawn.
      moveNode: (role: string, x: number, y: number) => setQuad({ ...lines.quad, moved: { ...lines.quad.moved, [role]: { x, y } } }),
    };
  }, [lines, lineupKey, callBlitz, callStunt]);
  const movedEntries = Object.entries(lines?.quad.moved || {});
  const filmMoves = movedEntries.length;
  const offMoves = movedEntries.filter(([r]) => !isDefenseRole(r)).length;
  const defMoves = movedEntries.filter(([r]) => isDefenseRole(r)).length;
  const hasOffUnit = hasUnitTransform(lines?.quad.offenseTransform);
  const hasDefUnit = hasUnitTransform(lines?.quad.defenseTransform);
  const frame = useMemo(
    () => (shown ? computeAnimatedPlayFrame(shown.nodes, shown.strokes, [], shown.ballRole, progress, shown.hole, shown.defenseRules) : null),
    [shown, progress]
  );
  const moving = progress > 0.002;
  const hasDefense = Boolean(shown?.nodes.some((n) => isDefenseRole(n.role)));
  // The gaps, as the builder works them out: from where our defenders line up on this film.
  const gaps = useMemo<GapFitSlot[]>(() => {
    if (!shown || !showGaps || !hasDefense) return [];
    const def = shown.nodes.filter((n) => isDefenseRole(n.role));
    const off = shown.nodes.filter((n) => !isDefenseRole(n.role));
    return computeGapIntegrity(def, off, shown.defenseRules || {}, shown.strokes, shown.holeX);
  }, [shown, showGaps, hasDefense]);
  // Each defender's arrow: his own drawn line (a blitz, a drop, man), else where he goes reading this play.
  const defenseArrows = useMemo<PlayStroke[]>(() => {
    if (!shown || !defArrows || !hasDefense) return [];
    const own = shown.strokes.filter(isDefenseStroke);
    const hasOwn = (n: PlayNode) => own.some((s) => lineStartsOn(s, n, shown.nodes));
    const end = computeAnimatedPlayFrame(shown.nodes, shown.strokes, [], shown.ballRole, 1, shown.hole, shown.defenseRules);
    // The defense's paths keep a point every 0.05 of the play after the snap.
    const upTo = Math.round(DEF_ARROW_UNTIL / 0.05);
    const reads: PlayStroke[] = [];
    for (const n of shown.nodes) {
      if (!isDefenseRole(n.role) || hasOwn(n)) continue;
      const tr = end.trails.find((t) => t.role === n.role);
      if (!tr || tr.points.length < 2) continue;
      // Every other point is plenty for an arrow (and keeps it smooth).
      const cut = tr.points.slice(0, upTo + 1);
      const pts = [{ x: n.x, y: n.y }, ...cut.slice(1).filter((_, i, a) => i % 2 === 1 || i === a.length - 1)];
      if (lengthOf(pts) < 0.9) continue;
      reads.push({ kind: 'run', points: pts.map((p) => ({ x: p.x, y: p.y })), color: DEFENSE_TRAIL });
    }
    return [...own, ...reads];
  }, [shown, defArrows, hasDefense]);
  const focusNode = focus ? lines?.nodes.find((n) => n.role === focus) : undefined;
  // Flipped left and right on this film: the arrows still move the unit the way they point on the picture.
  const flipSign = lines?.quad.flipX ? -1 : 1;
  const flipPlay = (axis: "flipX" | "flipY") => shown && shown.setQuad({ ...shown.quad, [axis]: shown.quad[axis] ? undefined : true });
  const btn = BTN;

  return {
    on,
    toggle: () => {
      if (!on) {
        onTurnOn?.();
        setShowLines(false);
        setFocus(null);
      }
      setOn((v) => !v);
    },
    videoFilter: ({ playing }) => {
      if (!on || !shown || playing || clean || lineUp || !shade) return undefined;
      return showLines || moving || focus !== null
        ? 'blur(3.5px) brightness(0.48) saturate(0.82)'
        : 'blur(1.8px) brightness(0.64) saturate(0.9)';
    },
    layer: ({ playing, zoom }) =>
      shown && frame && !playing ? (
        <LinesDrawing
          video={video}
          lines={defenseArrows.length ? { ...shown, strokes: [...shown.strokes.filter((s) => !defenseArrows.includes(s)), ...defenseArrows] } : shown}
          always={defenseArrows}
          gaps={moving ? [] : gaps}
          frame={moving ? frame : null}
          side={side}
          showLines={showLines}
          lineUp={lineUp}
          alignTarget={alignTarget}
          corners={corners}
          zoom={zoom}
          situation={situation}
          focus={focus}
          onFocus={setFocus}
          clean={clean}
          shade={shade}
          cam={cam}
          onCam={(c) => {
            cancelAnimationFrame(flight.current);
            setCam(c);
          }}
          onView={flyTo}
        />
      ) : null,
    bar: ({ playing, inline }) => (
      <div className={`pointer-events-auto flex flex-col items-start gap-1 ${inline ? '' : 'px-2 pt-1.5'}`} style={{ color: INK }} {...keep}>
        {/* The same look as the player's own controls: plain buttons on the bar, the picked one indigo. */}
        <div className="flex flex-wrap items-center gap-1">
          {!(inline && lines) && (
            <span className="h-9 px-2 inline-flex items-center text-xs font-black truncate max-w-[12rem]" title={lines?.name}>
              {lines?.name || 'Play lines'}
            </span>
          )}
          {lines && (
            <>
              <span className={tray} style={trayStyle} role="group" aria-label="Edit or present">
                {(
                  [
                    ['edit', 'Edit', 'Every control: line it up on the film, the clean field, the shade'],
                    ['present', 'Present', 'Just what you need in front of the team: the lines, the run, the gaps and arrows, the blitz'],
                  ] as [LinesMode, string, string][]
                ).map(([id, label, title]) => (
                  <button key={id} type="button" aria-pressed={mode === id} className={trayItem(mode === id)} style={mode === id ? trayPicked : undefined} onClick={() => pickMode(id)} title={title}>
                    {label}
                  </button>
                ))}
              </span>
              <span className={divider} />
              <button
                type="button"
                className={showLines ? onBtn : idle}
                aria-pressed={showLines}
                onClick={() => setShowLines((v) => !v)}
                title="The play's routes, runs, blocks and motion (tap a player for just his job)"
              >
                {showLines ? <EyeOff size={15} /> : <Eye size={15} />}
                <span className={presenting ? 'hidden md:inline' : 'hidden sm:inline'}>{showLines ? 'Hide lines' : 'Show lines'}</span>
              </button>
              <button
                type="button"
                className={btn}
                style={AMBER}
                disabled={playing}
                onClick={() => {
                  setProgress(0);
                  runPlay();
                }}
                title="Play the motion, the snap and everyone along their lines on this frame (step, slow motion and the scrubber are on the bar at the bottom)"
              >
                <Play size={14} />
                <span className="hidden sm:inline">Run play</span>
              </button>
              {hasDefense && (
                <>
                  <span className={divider} />
                  <button
                    type="button"
                    className={showGaps ? onBtn : idle}
                    aria-pressed={showGaps}
                    onClick={() => pickGaps(!showGaps)}
                    title="Our defense's gaps: who fits each one (green), open (red), two in one (amber)"
                  >
                    <Columns3 size={15} />
                    <span className="hidden sm:inline">Gaps</span>
                  </button>
                  <button
                    type="button"
                    className={defArrows ? onBtn : idle}
                    aria-pressed={defArrows}
                    onClick={() => pickDefArrows(!defArrows)}
                    title="Each defender's arrow: his blitz, stunt or drop, else where he goes reading this play"
                  >
                    <MoveUpRight size={15} />
                    <span className="hidden sm:inline">D arrows</span>
                  </button>
                  {lines.baseStrokes && (
                    <>
                      {(['blitz', 'stunt'] as const).map((part) => {
                        const ownId = pressureParts(lines.pressure)[part];
                        const picked = part === 'blitz' ? callBlitz : callStunt;
                        const value = picked ?? '__play';
                        const group = part === 'blitz' ? 'Blitz' : 'Stunt';
                        const ownLabel = PRESSURES.find((p) => p.id === ownId)?.short;
                        return (
                          <select
                            key={part}
                            value={value}
                            onChange={(e) => pickCall(part, e.target.value === '__play' ? null : e.target.value)}
                            className={`${picked !== null ? onBtn : idle} cursor-pointer appearance-none text-center max-w-[9rem]`}
                            style={picked !== null ? undefined : { background: 'rgba(255,255,255,0.1)', color: INK }}
                            aria-label={group}
                            title={`Run this play against another ${part} (it draws, and moves with Run play). The play's own: ${ownLabel || 'none'}`}
                          >
                            <option value="__play" style={{ background: '#0f172a', color: INK }}>
                              {group}: {ownLabel || 'none'}
                            </option>
                            <option value="" style={{ background: '#0f172a', color: INK }}>
                              No {part}
                            </option>
                            {PRESSURES.filter((p) => p.group === group).map((p) => (
                              <option key={p.id} value={p.id} style={{ background: '#0f172a', color: INK }} title={p.label}>
                                {p.short}
                              </option>
                            ))}
                          </select>
                        );
                      })}
                      {(callBlitz !== null || callStunt !== null) && (
                        <button
                          type="button"
                          className={idle}
                          onClick={() => {
                            setCallBlitz(null);
                            setCallStunt(null);
                          }}
                          title="Back to the play's own call"
                          aria-label="Back to the play's own call"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
              {!presenting && (
                <>
                  <span className={divider} />
                  <span className={tray} style={trayStyle} role="group" aria-label="Show">
                    {SIDES.map(([id, label]) => (
                      <button key={id} type="button" aria-pressed={side === id} className={trayItem(side === id)} style={side === id ? trayPicked : undefined} onClick={() => pickSide(id)}>
                        {label}
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    className={lineUp ? onBtn : idle}
                    aria-pressed={lineUp}
                    onClick={() => setLineUp((v) => !v)}
                    title="Align the field, the full Offense, the full Defense, or individual players independently on the video"
                  >
                    <Move size={15} />
                    <span className="hidden sm:inline">Line up</span>
                  </button>
                  <button
                    type="button"
                    className={shown?.quad.flipX ? onBtn : idle}
                    aria-pressed={Boolean(shown?.quad.flipX)}
                    onClick={() => flipPlay('flipX')}
                    title="Flip left and right: every player (offense and defense) and his line swaps sides"
                    aria-label="Flip left and right"
                  >
                    <FlipHorizontal2 size={15} />
                    <span className="hidden md:inline">Flip ↔</span>
                  </button>
                  <button
                    type="button"
                    className={shown?.quad.flipY ? onBtn : idle}
                    aria-pressed={Boolean(shown?.quad.flipY)}
                    onClick={() => flipPlay('flipY')}
                    title="Flip top and bottom: the offense and the defense swap ends (the offense going the other way on this film)"
                    aria-label="Flip top and bottom"
                  >
                    <FlipVertical2 size={15} />
                    <span className="hidden md:inline">Flip ↕</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={clean}
                    className={clean ? onBtn : idle}
                    onClick={() => pickClean(!clean)}
                    title="The play on a drawn field instead of the video, at the film's angle: drag to turn it any way"
                  >
                    <MapIcon size={15} />
                    <span className="hidden sm:inline">Clean field</span>
                  </button>
                  {!clean && (
                    <button
                      type="button"
                      aria-pressed={shade}
                      className={shade ? onBtn : idle}
                      onClick={() => pickShade(!shade)}
                      title="Shade and blur the video behind the play lines so routes and assignments are easier to see"
                    >
                      <Contrast size={15} />
                      <span className="hidden sm:inline">Shade</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
        {lines && lineUp && !playing && shown && (
          // Independent alignment for Field, Full Offense, Full Defense, and Individual Players.
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl" style={panel}>
            <span className="inline-flex rounded-lg overflow-hidden border border-white/15 mr-1" role="group" aria-label="Align target">
              {(
                [
                  ['field', 'Field'],
                  ['offense', 'Full Offense'],
                  ['defense', 'Full Defense'],
                  ['players', 'Players'],
                ] as [AlignTarget, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={alignTarget === id}
                  onClick={() => {
                    setAlignTarget(id);
                    if (id === 'offense' && side === 'defense') pickSide('both');
                    if (id === 'defense' && side === 'offense') pickSide('both');
                  }}
                  className={`h-8 px-2 text-xs font-bold cursor-pointer ${
                    alignTarget === id
                      ? id === 'offense'
                        ? 'bg-orange-600 text-white'
                        : id === 'defense'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 text-white'
                      : 'hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </span>

            {alignTarget === 'field' && (
              <>
                <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">Turn</span>
                <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown.setQuad(turnQuad(shown.quad, -5, 1))} title="Turn left a little" aria-label="Turn left">
                  ⟲
                </button>
                <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown.setQuad(turnQuad(shown.quad, 5, 1))} title="Turn right a little" aria-label="Turn right">
                  ⟳
                </button>
                <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown.setQuad(rotateQuad(shown.quad))} title="A quarter turn (film shot from the side)">
                  90°
                </button>
                <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">Size</span>
                <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(turnQuad(shown.quad, 0, 1 / 1.08))} title="Smaller" aria-label="Smaller">
                  −
                </button>
                <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(turnQuad(shown.quad, 0, 1.08))} title="Bigger" aria-label="Bigger">
                  +
                </button>
                <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">Width</span>
                <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(stretchQuad(shown.quad, 1 / 1.08, 1))} title="Narrower: the line squeezed in" aria-label="Narrower">
                  −
                </button>
                <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(stretchQuad(shown.quad, 1.08, 1))} title="Wider: the line spread out" aria-label="Wider">
                  +
                </button>
                <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">Depth</span>
                <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(stretchQuad(shown.quad, 1, 1 / 1.1))} title="Shallower: the backfield and the defense closer to the line" aria-label="Shallower">
                  −
                </button>
                <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(stretchQuad(shown.quad, 1, 1.1))} title="Deeper: the backfield and the defense farther from the line" aria-label="Deeper">
                  +
                </button>
                <button type="button" className={`${btn} ${corners ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`} onClick={() => setCorners((v) => !v)} title="Drag each corner for an exact fit">
                  Corners
                </button>
                <button
                  type="button"
                  className={`${btn} hover:bg-white/10`}
                  onClick={() =>
                    shown.setQuad({
                      ...FILM_START,
                      moved: shown.quad.moved,
                      offenseTransform: shown.quad.offenseTransform,
                      defenseTransform: shown.quad.defenseTransform,
                    })
                  }
                  title="Reset field perspective while keeping Offense, Defense, and Player alignments"
                >
                  Reset field
                </button>
              </>
            )}

            {(alignTarget === 'offense' || alignTarget === 'defense') && (() => {
              const unit = alignTarget;
              const unitLabel = unit === 'offense' ? 'Offense' : 'Defense';
              return (
                <>
                  <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">Move {unitLabel}</span>
                  <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown.setQuad(shiftUnitQuad(shown.quad, unit, -0.6 * flipSign, 0))} title={`Move full ${unitLabel} left`}>
                    ←
                  </button>
                  <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown.setQuad(shiftUnitQuad(shown.quad, unit, 0.6 * flipSign, 0))} title={`Move full ${unitLabel} right`}>
                    →
                  </button>
                  <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown.setQuad(shiftUnitQuad(shown.quad, unit, 0, 0.5))} title={`Move full ${unitLabel} deeper downfield`}>
                    ↑
                  </button>
                  <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown.setQuad(shiftUnitQuad(shown.quad, unit, 0, -0.5))} title={`Move full ${unitLabel} toward backfield`}>
                    ↓
                  </button>
                  <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">Size</span>
                  <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(scaleUnitQuad(shown.quad, unit, 1 / 1.08, 1 / 1.08))} title={`Shrink full ${unitLabel} independently`}>
                    −
                  </button>
                  <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(scaleUnitQuad(shown.quad, unit, 1.08, 1.08))} title={`Expand full ${unitLabel} independently`}>
                    +
                  </button>
                  <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">Width</span>
                  <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(scaleUnitQuad(shown.quad, unit, 1 / 1.08, 1))} title={`Narrow full ${unitLabel} width independently`}>
                    −
                  </button>
                  <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(scaleUnitQuad(shown.quad, unit, 1.08, 1))} title={`Widen full ${unitLabel} width independently`}>
                    +
                  </button>
                  <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">Depth</span>
                  <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(scaleUnitQuad(shown.quad, unit, 1, 1 / 1.1))} title={`Shallow full ${unitLabel} depth independently`}>
                    −
                  </button>
                  <button type="button" className={`${btn} hover:bg-white/10 text-base`} onClick={() => shown.setQuad(scaleUnitQuad(shown.quad, unit, 1, 1.1))} title={`Deepen full ${unitLabel} depth independently`}>
                    +
                  </button>
                  <button
                    type="button"
                    className={`${btn} hover:bg-white/10`}
                    onClick={() => shown.setQuad(resetUnitQuad(shown.quad, unit))}
                    title={`Reset full ${unitLabel} back to diagram spots without changing the other unit`}
                  >
                    Reset {unitLabel}
                  </button>
                </>
              );
            })()}

            {alignTarget === 'players' && (
              <>
                <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-85">
                  Drag any player ring on the video to move just that player ({offMoves} O · {defMoves} D moved)
                </span>
                {offMoves > 0 && (
                  <button
                    type="button"
                    className={`${btn} hover:bg-white/10`}
                    onClick={() => shown.setQuad(resetMovedPlayersQuad(shown.quad, 'offense'))}
                    title="Reset individually moved Offense players (keeps Full Offense & Defense alignment)"
                  >
                    Reset O players
                  </button>
                )}
                {defMoves > 0 && (
                  <button
                    type="button"
                    className={`${btn} hover:bg-white/10`}
                    onClick={() => shown.setQuad(resetMovedPlayersQuad(shown.quad, 'defense'))}
                    title="Reset individually moved Defense players (keeps Full Defense & Offense alignment)"
                  >
                    Reset D players
                  </button>
                )}
                {filmMoves > 0 && (
                  <button
                    type="button"
                    className={`${btn} hover:bg-white/10`}
                    onClick={() => shown.setQuad(resetMovedPlayersQuad(shown.quad, 'all'))}
                    title="Reset all individually moved players"
                  >
                    Reset all players
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {lines && !presenting && (filmMoves > 0 || hasOffUnit || hasDefUnit) && !lineUp && !playing && shown && (
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl" style={panel}>
            <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">
              {[
                filmMoves > 0 ? `${filmMoves} player${filmMoves === 1 ? '' : 's'}` : '',
                hasOffUnit ? 'Full Offense' : '',
                hasDefUnit ? 'Full Defense' : '',
              ]
                .filter(Boolean)
                .join(' · ')}{' '}
              aligned on this film
            </span>
            {offMoves > 0 && (
              <button
                type="button"
                className={`${btn} hover:bg-white/10`}
                onClick={() => shown.setQuad(resetMovedPlayersQuad(shown.quad, 'offense'))}
                title="Reset individually moved Offense players"
              >
                Reset O players
              </button>
            )}
            {defMoves > 0 && (
              <button
                type="button"
                className={`${btn} hover:bg-white/10`}
                onClick={() => shown.setQuad(resetMovedPlayersQuad(shown.quad, 'defense'))}
                title="Reset individually moved Defense players"
              >
                Reset D players
              </button>
            )}
            {hasOffUnit && (
              <button
                type="button"
                className={`${btn} hover:bg-white/10`}
                onClick={() => shown.setQuad(resetUnitQuad(shown.quad, 'offense'))}
                title="Reset Full Offense alignment"
              >
                Reset Offense
              </button>
            )}
            {hasDefUnit && (
              <button
                type="button"
                className={`${btn} hover:bg-white/10`}
                onClick={() => shown.setQuad(resetUnitQuad(shown.quad, 'defense'))}
                title="Reset Full Defense alignment"
              >
                Reset Defense
              </button>
            )}
          </div>
        )}
      </div>
    ),
    controls: ({ playing }) => (
      <>
      {lines && moveBar && !playing && !lineUp && (
        // The movement bar, pinned to the bottom right like the film's own: back to the start, a step back, play /
        // pause, a step on, the scrubber, and slow motion down to a tenth.
        <div
          className="absolute right-2 bottom-2 left-2 sm:left-auto z-20 flex flex-wrap items-center justify-end gap-1 p-1.5 rounded-xl pointer-events-auto"
          style={panel}
          role="group"
          aria-label="Play movement"
          {...keep}
        >
          {!presenting && (
            <span className="h-9 px-2 inline-flex items-center text-[11px] font-bold tabular-nums whitespace-nowrap" aria-live="polite">
              {moving && frame ? frame.phaseLabel : 'Lined up'}
            </span>
          )}
          <button type="button" className={idle} onClick={() => { setRunning(false); setProgress(0); }} title="Back to the lineup before the snap" aria-label="Back to the start">
            <SkipBack size={16} />
          </button>
          <button type="button" className={idle} disabled={progress <= 0} onClick={() => stepPlay(-1)} title={`A step back (${LINE_STEP_SECONDS} s of the play)`} aria-label="A step back">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={playButton}
            style={playButtonStyle}
            onClick={() => (running ? setRunning(false) : runPlay())}
            title={running ? 'Pause' : progress >= 1 ? 'Run it again' : 'Play from here'}
            aria-label={running ? 'Pause' : 'Play'}
          >
            {running ? <Pause size={20} /> : progress >= 1 ? <RotateCcw size={18} /> : <Play size={20} className="translate-x-px" />}
          </button>
          <button type="button" className={idle} disabled={progress >= 1} onClick={() => stepPlay(1)} title={`A step on (${LINE_STEP_SECONDS} s of the play)`} aria-label="A step on">
            <ChevronRight size={18} />
          </button>
          {!presenting && (
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => {
                setRunning(false);
                setProgress(Number(e.target.value) / 1000);
              }}
              className="w-28 sm:w-40 accent-indigo-500 cursor-pointer"
              aria-label="Where in the play"
              title="Drag through the play"
            />
          )}
          <span className={`ml-1 ${tray}`} style={trayStyle} role="group" aria-label="Speed">
            {LINE_SPEEDS.map(([s, label]) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                className={trayItem(speed === s)}
                style={speed === s ? trayPicked : undefined}
                onClick={() => setSpeed(s)}
                title={s < 1 ? `Slow motion: ${label} speed` : 'Full speed'}
              >
                {label}
              </button>
            ))}
          </span>
          <button
            type="button"
            className={idle}
            onClick={() => {
              setRunning(false);
              setProgress(0);
              setMoveBar(false);
            }}
            title="Close the movement bar (back to the lineup)"
            aria-label="Close the movement bar"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="absolute right-2 top-11 z-20 flex flex-col items-end gap-1.5 pointer-events-auto" {...keep}>
        {!lines && (
          <div className="max-w-xs rounded-lg px-2.5 py-1.5 text-[11px] leading-snug" style={panel}>
            {waiting}
          </div>
        )}
        {lines && lineUp && !playing && shown && (
          <div className="max-w-xs rounded-lg px-2.5 py-1.5 text-[11px] leading-snug" style={panel}>
            {alignTarget === 'offense' ? (
              <>
                Drag the <b style={{ color: '#fb923c' }}>✢ OFFENSE</b> handle (or anywhere on the field) to move the entire Offense together, or drag any individual player ring.
              </>
            ) : alignTarget === 'defense' ? (
              <>
                Drag the <b style={{ color: '#4ade80' }}>✢ DEFENSE</b> handle (or anywhere on the field) to move the entire Defense together, or drag any individual player ring.
              </>
            ) : alignTarget === 'players' ? (
              <>
                Drag any individual Offense or Defense player ring on the video to align just that player and his route/assignment.
              </>
            ) : (
              <>
                Drag the field to move it, or grab <b style={{ color: '#fb923c' }}>✢ OFFENSE</b>, <b style={{ color: '#4ade80' }}>✢ DEFENSE</b>, or any player ring to align them independently.
                {corners && (
                  <>
                    {' '}
                    Corners: <b style={{ color: '#f59e0b' }}>orange</b> on the line of scrimmage, <b style={{ color: '#38bdf8' }}>blue</b> 5 yards behind it.
                  </>
                )}
              </>
            )}
          </div>
        )}
        {lines && side === 'defense' && !lines.nodes.some((n) => isDefenseRole(n.role)) && (
          <div className="max-w-xs rounded-lg px-2.5 py-1.5 text-[11px] leading-snug" style={panel}>
            No defense on this play yet. Pick one in the play's diagram (vs a defense) and it shows here.
          </div>
        )}
        {lines && playing && (
          <div className="rounded-lg px-2.5 py-1.5 text-[11px]" style={panel}>
            Pause the video to see the play's lines.
          </div>
        )}
        {lines && clean && !lineUp && !playing && (
          // The clean field's angles: the film's own, or one tap to another (dragging turns it any way).
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-0.5 rounded-xl p-1" style={panel} role="group" aria-label="Angle">
              <button type="button" aria-pressed={!cam} className={`h-8 px-2 rounded-lg text-[11px] font-bold cursor-pointer ${!cam ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`} onClick={() => flyTo('film')} title="The film's own angle">
                Film
              </button>
              {VIEWS.map((v) => (
                <button key={v.id} type="button" className="h-8 px-2 rounded-lg text-[11px] font-bold cursor-pointer hover:bg-white/10" onClick={() => flyTo(v.cam)} title={v.title}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="rounded-lg px-2 py-1 text-[10px] font-semibold opacity-90" style={panel}>
              Drag to turn · scroll or pinch to zoom · double-tap for the film&apos;s angle
            </div>
          </div>
        )}
        {lines && focusNode && !playing && (
          <div className="flex items-center gap-1.5 rounded-lg pl-2.5 pr-1 py-1 text-[11px] font-bold" style={panel}>
            Just {tagOf(focusNode)}&apos;s job
            <button type="button" className="h-7 px-2 rounded-md bg-white/15 hover:bg-white/25 cursor-pointer" onClick={() => setFocus(null)}>
              Show all
            </button>
          </div>
        )}
      </div>
      </>
    ),
  };
}

type Pt = { x: number; y: number };

/**
 * A line's points in field yards the way the play builder draws it: straight between sharp breaks, and a smooth
 * curve (Catmull-Rom) through the points drawn curved. Curved parts come back as many short steps, so they bend
 * the right way once they're put on the film's perspective.
 */
function shapedPoints(pts: (Pt & { smooth?: boolean })[], smooth: (i: number) => boolean): Pt[] {
  const out: Pt[] = [pts[0]];
  let start = 0;
  for (let i = 1; i < pts.length; i++) {
    if (i < pts.length - 1 && smooth(i)) continue;
    if (i - start < 2) out.push(pts[i]);
    else {
      const seg = pts.slice(start, i + 1);
      for (let j = 0; j < seg.length - 1; j++) {
        const p0 = seg[j - 1] || seg[j], p1 = seg[j], p2 = seg[j + 1], p3 = seg[j + 2] || p2;
        const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
        const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
        for (let k = 1; k <= 10; k++) {
          const t = k / 10, u = 1 - t;
          out.push({
            x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
            y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
          });
        }
      }
    }
    start = i;
  }
  return out;
}

/** The builder's colors, brighter so they read on grass (our defense's lines keep their own). */
const FILM_COLOR: Record<string, string> = { run: '#ff3349', pass: '#3b8cff', block: '#0f172a', motion: '#a259ff' };
/** A pre-snap shift on film (teal, like the diagram's). */
const SHIFT_FILM = '#14d2b8';
const inkOf = (s: PlayStroke) => s.color || FILM_COLOR[s.kind] || STROKE_COLOR[s.kind];
/** How wide each kind of line is on the turf, either side of its middle (yards). */
const HALF: Record<string, number> = { run: 0.15, pass: 0.13, block: 0.14, motion: 0.09 };
/** The arrowhead's length on the turf (yards). */
const ARROW = 0.8;
// Shown, the lines draw themselves one after another: one starts every STAGGER ms and takes GROW ms.
const STAGGER = 70;
const GROW = 520;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** Up to full size with a little overshoot (an arrowhead or a ring landing). */
const land = (t: number) => {
  const c = clamp01(t);
  if (c >= 1) return 1;
  return 1 + 2.70158 * Math.pow(c - 1, 3) + 1.70158 * Math.pow(c - 1, 2);
};
const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];
/** The field's numbers, painted: each digit's strokes in a box 1 wide and 2 tall (0 at its foot). */
const DIGITS: Record<string, [number, number][][]> = {
  '0': [Array.from({ length: 25 }, (_, i) => [0.5 + 0.48 * Math.cos((i / 24) * 2 * Math.PI), 1 + 0.98 * Math.sin((i / 24) * 2 * Math.PI)] as [number, number])],
  '1': [[[0.25, 1.6], [0.6, 2], [0.6, 0]]],
  '2': [[[0.05, 1.6], [0.2, 1.92], [0.5, 2], [0.8, 1.92], [0.95, 1.6], [0.9, 1.3], [0.05, 0], [0.95, 0]]],
  '3': [
    [[0.05, 1.8], [0.3, 2], [0.7, 2], [0.95, 1.78], [0.95, 1.3], [0.7, 1.05], [0.35, 1.05]],
    [[0.7, 1.05], [0.95, 0.8], [0.95, 0.25], [0.7, 0], [0.3, 0], [0.05, 0.2]],
  ],
  '4': [[[0.75, 0], [0.75, 2], [0.02, 0.62], [1, 0.62]]],
  '5': [[[0.92, 2], [0.12, 2], [0.08, 1.12], [0.5, 1.25], [0.88, 1.05], [0.98, 0.55], [0.75, 0.08], [0.35, 0], [0.05, 0.2]]],
};
/** Half the width of the field (53 1/3 yards), and the hash marks' distance from its middle (high school). */
const HALF_FIELD = 80 / 3;
const HASH = 80 / 3 - 160 / 9;
const FONT = 'system-ui, -apple-system, sans-serif';

/** A player's tag, the way the builder labels him: his own name, else WR / TE / 1 / 2 / LT..., our defenders' spots. */
function tagOf(n: PlayNode): string {
  const custom = n.label?.trim();
  if (isDefenseRole(n.role)) return shownText(n, diagramLabel(n.role));
  if (n.role === 'C') return custom || 'C';
  const skill = skillDiagramLabel(n.role);
  const isBack = !skill && !(n.line || !/^[1-4]$/.test(n.role));
  return custom || (skill ? skill : isBack ? diagramLabel(n.role) : n.role.replace(/^O_?/, '').slice(0, 2));
}

/**
 * Milliseconds since `key` last changed, drawn every frame for `ms` after it (things coming in). Infinity with no
 * key, or for a coach who has asked for less motion: everything shows at once.
 */
function useSince(key: string, ms: number, still: boolean): number {
  const at = useRef({ key: '', t0: 0 });
  if (at.current.key !== key) at.current = { key, t0: performance.now() };
  const [, setTick] = useState(0);
  useEffect(() => {
    if (still || !key) return;
    const t0 = at.current.t0;
    let raf = 0;
    const step = () => {
      setTick((n) => n + 1);
      if (performance.now() - t0 < ms) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, ms, still]);
  return still || !key ? Infinity : performance.now() - at.current.t0;
}

/**
 * The play's players and lines on the film, the way TV draws on the field: each line laid on the turf in the film's
 * perspective (wider near the camera), with a soft glow and a white edge, its arrowhead flat on the field; a ring at
 * each player's feet with his tag (the real player shows through); the line of scrimmage in blue and the line to
 * gain in yellow. Shown, the lines draw themselves one player after another and a light runs along each route.
 * Tapping a player shows his job alone; dragging him moves him to where he lines up on this film.
 */
const LinesDrawing: React.FC<{
  video: () => HTMLVideoElement | null;
  lines: VideoLines;
  /** The play running (null: the lineup before the snap). */
  frame: ReturnType<typeof computeAnimatedPlayFrame> | null;
  /** Whose players and lines show. */
  side: Side;
  /** The play's lines (off: just the players lined up, and their trails when the play runs). */
  showLines: boolean;
  lineUp: boolean;
  alignTarget: AlignTarget;
  /** Lining up: the 4 corners to drag one at a time. */
  corners: boolean;
  zoom: number;
  /** The down and the yards to go (the line to gain in yellow); the spot and the hash (the clean field's markings). */
  situation?: { down?: number; toGo?: number; yardLine?: number; hash?: 'L' | 'M' | 'R' };
  /** One player's job alone (his role), or everyone's. */
  focus: string | null;
  onFocus: (role: string | null) => void;
  /** The clean field: a drawn field instead of the video, the play on it. */
  clean: boolean;
  /** Shade and blur the video behind the play lines so the lines stand out clearly. */
  shade: boolean;
  /** Its camera, turned to any angle (null: the film's own). */
  cam: Cam | null;
  onCam: (cam: Cam | null) => void;
  /** Fly the camera to an angle (or back to the film's). */
  onView: (to: Cam | 'film') => void;
  /** Lines shown even with the play's lines hidden (the defense's arrows). */
  always?: PlayStroke[];
  /** Our defense's gaps: who fits each, open or doubled. */
  gaps?: GapFitSlot[];
}> = ({ video, lines, frame, side, showLines, lineUp, alignTarget, corners, zoom, situation, focus, onFocus, clean, shade, cam, onCam, onView, always = [], gaps = [] }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = `pl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState(16 / 9);
  // The clean field turned by hand: the fingers down, and where the turn started.
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const orbit = useRef<{ x: number; y: number; cam: Cam; pinch?: number } | null>(null);
  const drag = useRef<{
    corner: Corner | 'all' | 'offense' | 'defense' | 'player';
    role?: string;
    from: ImagePoint;
    quad: HomographyQuad;
    /** A player pressed: where, and whether it has become a drag (else it's a tap). */
    x?: number;
    y?: number;
    active?: boolean;
  } | null>(null);

  // The video's picture inside the player (letterboxed when it isn't 16:9).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const v = video();
    if (!v) return;
    const read = () => v.videoWidth && v.videoHeight && setAspect(v.videoWidth / v.videoHeight);
    read();
    // resize: a new clip of another shape (or the iPad's player settling on the real size).
    v.addEventListener('loadedmetadata', read);
    v.addEventListener('resize', read);
    return () => {
      v.removeEventListener('loadedmetadata', read);
      v.removeEventListener('resize', read);
    };
  }, [video]);
  let cw = box.w, ch = box.w / aspect;
  if (ch > box.h) {
    ch = box.h;
    cw = box.h * aspect;
  }
  const left = (box.w - cw) / 2, top = (box.h - ch) / 2;

  const { quad } = lines;
  // The field -> picture mapping, worked out once for this lineup (every point of every line goes through it).
  const H = useMemo(() => getQuadHomographies(quad).fieldToImageH, [quad]);
  const z = Math.max(1, zoom);
  // The camera: the film's own (its lineup), or the clean field's turned to any angle. Lining up uses the film's.
  const free = clean && !lineUp && cam ? cam : null;
  // Flipped on this film (left / right, offense / defense ends): every field point is mirrored on its way to the
  // picture, so the play, its lines, the ball, the gaps and the line to gain all turn together.
  const fx = quad.flipX ? -1 : 1;
  const fy = quad.flipY ? -1 : 1;
  const proj = useMemo<Projector>(() => {
    const base = free ? cameraProjector(free, cw, ch) : filmProjector(H, cw, ch);
    if (fx === 1 && fy === 1) return base;
    const mirror = (p: Pt) => ({ x: fx * p.x, y: fy * p.y });
    return { near: base.near, to: (p, h) => base.to(mirror(p), h), depth: (p) => base.depth(mirror(p)) };
  }, [free, H, cw, ch, fx, fy]);
  /** A spot picked on the picture, back on the play's own field (undoing the flip). */
  const pickedOnField = (q: HomographyQuad, at: ImagePoint) => {
    const f = imageToField(q, at);
    return { x: fx * f.x, y: fy * f.y };
  };
  /** In front of the camera (on the picture). */
  const seen = (p: Pt) => proj.depth(p) >= proj.near;
  const px = (p: Pt): Px => proj.to(p) ?? [-1e4, -1e4];
  const gap = (a: Px, b: Px) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  // How big a yard is on the picture there (across and deep): what lays the lines on the turf, wider near the camera.
  const yardAt = (p: Pt) =>
    Math.sqrt(gap(px({ x: p.x - 0.5, y: p.y }), px({ x: p.x + 0.5, y: p.y })) * gap(px({ x: p.x, y: p.y - 0.5 }), px({ x: p.x, y: p.y + 0.5 })));
  // One builder picture unit on screen (the tags' size).
  const k = Math.max(0.6, ch * 0.0019) / z;
  const halfAt = (p: Pt, yards: number) => Math.max(1.1 * k, Math.min(6.5 * k, yards * yardAt(p)));
  /** A line laid on the turf: its parts in front of the camera, each with its points on the picture and widths. */
  const lay = (pts: Pt[], yards: number) =>
    visibleRuns(densify(pts, 0.75), proj.depth, proj.near).map((run) => ({ pts: run.map(px), half: run.map((p) => halfAt(p, yards)) }));
  /** A laid line as one shape, each side `grow(width)` wide. */
  const rib = (runs: ReturnType<typeof lay>, grow: (h: number) => number = (h) => h, roundEnd = false) =>
    runs.map((r) => ribbon(r.pts, r.half.map(grow), roundEnd)).join('');
  /** A shape on the grass: the part in front of the camera. */
  const shape = (pts: Pt[]) => {
    const c = clipPolygon(pts, proj.depth, proj.near);
    return c.length >= 3 ? polygon(c.map(px)) : '';
  };
  // A finger (an iPad) needs a bigger corner to grab, and room around each player.
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const reduce = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const handle = Math.max(touch ? 16 : 9, ch * 0.02) / z;
  const moving = Boolean(frame);
  const showing = (def: boolean) => (def ? showsDefense(side) : showsOffense(side));
  const ownerOf = (s: PlayStroke) => lines.nodes.find((n) => lineStartsOn(s, n, lines.nodes))?.role;
  // The lines to draw: everyone's (Show lines) or the tapped player's; the offense's before our defense's, motion
  // first, then across the field.
  const drawn = lines.strokes
    .filter((s) => s.points?.length >= 2 && showing(isDefenseStroke(s)))
    .map((s) => ({ s, owner: ownerOf(s) }))
    .filter(({ s, owner }) => showLines || (focus !== null && owner === focus) || (focus === null && always.includes(s)))
    .sort((a, b) => Number(isDefenseStroke(a.s)) - Number(isDefenseStroke(b.s)) || Number(!a.s.motion) - Number(!b.s.motion) || a.s.points[0].x - b.s.points[0].x);
  const shownNodes = (frame ? frame.nodes : lines.nodes).filter((n) => showing(isDefenseRole(n.role)));
  // Coming in: the rings and the TV lines when the picture stops on a play; the lines when they're shown.
  const layerSince = useSince(lines.name, 1100, reduce);
  const linesSince = useSince(showLines || focus || always.length ? `${lines.name}|${side}|${focus ?? ''}|${showLines ? 1 : 0}|${always.length}` : '', 3400, reduce);
  const settled = linesSince >= drawn.length * STAGGER + GROW + 300;

  const toUV = (e: React.PointerEvent): ImagePoint | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return { u: (e.clientX - rect.left) / rect.width, v: (e.clientY - rect.top) / rect.height };
  };
  const startDrag = (corner: Corner | 'all' | 'offense' | 'defense') => (e: React.PointerEvent) => {
    e.stopPropagation();
    const from = toUV(e);
    if (!from) return;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // No capture (an old browser): the drag still follows over the picture.
    }
    drag.current = { corner, from, quad };
  };
  // The clean field: one finger (or the mouse) turns it round the play, two fingers zoom; from the film's own angle.
  const camNow = () => cam ?? cameraFromFilm(H, cw, ch) ?? VIEWS[0].cam;
  const camRef = useRef(cam);
  camRef.current = cam;
  const camNowRef = useRef(camNow);
  camNowRef.current = camNow;
  const onCamRef = useRef(onCam);
  onCamRef.current = onCam;
  const startOrbit = (e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // No capture: the turn still follows over the picture.
    }
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const base = camNow();
    const [a, b] = [...fingers.current.values()];
    orbit.current = b ? { x: e.clientX, y: e.clientY, cam: base, pinch: Math.hypot(a.x - b.x, a.y - b.y) || 1 } : { x: e.clientX, y: e.clientY, cam: base };
  };
  const turnBy = (e: React.PointerEvent) => {
    const o = orbit.current;
    if (!o || !fingers.current.has(e.pointerId)) return false;
    e.stopPropagation();
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (o.pinch && fingers.current.size >= 2) {
      const [a, b] = [...fingers.current.values()];
      onCam({ ...o.cam, dist: Math.max(8, Math.min(150, (o.cam.dist * o.pinch) / (Math.hypot(a.x - b.x, a.y - b.y) || 1))) });
      return true;
    }
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    // A tap doesn't leave the film's angle.
    if (!cam && Math.hypot(dx, dy) < 3) return true;
    onCam({ ...o.cam, yaw: o.cam.yaw - dx * 0.3, pitch: Math.max(MIN_PITCH, Math.min(MAX_PITCH, o.cam.pitch + dy * 0.25)) });
    return true;
  };
  const stopOrbit = (e: React.PointerEvent) => {
    if (!fingers.current.delete(e.pointerId)) return false;
    e.stopPropagation();
    // A finger up from a pinch: the other one turns on from here.
    const rest = [...fingers.current.values()];
    orbit.current = rest.length ? { x: rest[0].x, y: rest[0].y, cam: camRef.current ?? camNow() } : null;
    return true;
  };
  // A scroll (a mouse wheel, two fingers on a trackpad) or a trackpad's pinch zooms the clean field (not the video).
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !clean || lineUp) return;
    const zoomTo = (dist: number) => {
      const base = camRef.current ?? camNowRef.current();
      const next = { ...base, dist: Math.max(8, Math.min(150, dist)) };
      camRef.current = next;
      onCamRef.current(next);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      zoomTo((camRef.current ?? camNowRef.current()).dist * Math.exp(Math.max(-120, Math.min(120, dy)) * (e.ctrlKey ? 0.01 : 0.0025)));
    };
    let start = 0;
    const onStart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      start = (camRef.current ?? camNowRef.current()).dist;
    };
    const onChange = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // Fingers on the screen pinch through the pointers instead.
      if (!start || fingers.current.size >= 2) return;
      zoomTo(start / ((e as Event & { scale?: number }).scale || 1));
    };
    const onEnd = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      start = 0;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onStart);
    el.addEventListener('gesturechange', onChange);
    el.addEventListener('gestureend', onEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onStart);
      el.removeEventListener('gesturechange', onChange);
      el.removeEventListener('gestureend', onEnd);
    };
  }, [clean, lineUp, cw]);
  const onMove = (e: React.PointerEvent) => {
    if (turnBy(e)) return;
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const at = toUV(e);
    if (!at) return;
    const clamp = (n: number) => Math.round(Math.max(-0.2, Math.min(1.2, n)) * 1000) / 1000;
    if (d.corner === 'player') {
      // A drag, not a tap, moves him: his spot on the field, to a tenth of a yard.
      if (!d.active) {
        if (!lines.moveNode || free || Math.hypot(e.clientX - (d.x ?? e.clientX), e.clientY - (d.y ?? e.clientY)) < 6) return;
        d.active = true;
      }
      const f = pickedOnField(quad, at);
      lines.moveNode?.(d.role!, Math.round(f.x * 10) / 10, Math.round(f.y * 10) / 10);
    } else if (d.corner === 'offense' || d.corner === 'defense') {
      const fFrom = pickedOnField(d.quad, d.from);
      const fAt = pickedOnField(d.quad, at);
      const ddx = Math.max(-25, Math.min(25, fAt.x - fFrom.x));
      const ddy = Math.max(-25, Math.min(25, fAt.y - fFrom.y));
      lines.setQuad(shiftUnitQuad(d.quad, d.corner, ddx, ddy));
    } else if (d.corner === 'all') {
      const du = at.u - d.from.u, dv = at.v - d.from.v;
      const move = (p: ImagePoint) => ({ u: clamp(p.u + du), v: clamp(p.v + dv) });
      lines.setQuad({ ...d.quad, losLeft: move(d.quad.losLeft), losRight: move(d.quad.losRight), backLeft: move(d.quad.backLeft), backRight: move(d.quad.backRight), preset: 'custom' });
    } else lines.setQuad({ ...d.quad, [d.corner]: { u: clamp(at.u), v: clamp(at.v) }, preset: 'custom' });
  };
  // Players can be tapped and dragged individually at any time while the play isn't running (even while Align / Line up is open).
  const tapOK = !frame;
  const grab = (n: PlayNode) =>
    tapOK
      ? {
          style: { pointerEvents: 'auto' as const, cursor: lines.moveNode ? 'grab' : 'pointer', touchAction: 'none' as const },
          onPointerDown: (e: React.PointerEvent) => {
            e.stopPropagation();
            const from = toUV(e);
            if (!from) return;
            try {
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
            } catch {
              // No capture (an old browser): the drag still follows over the picture.
            }
            drag.current = { corner: 'player', role: n.role, from, quad, x: e.clientX, y: e.clientY, active: false };
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        }
      : {};
  const endDrag = (e: React.PointerEvent) => {
    if (stopOrbit(e)) return;
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    drag.current = null;
    // A tap on a player: just his job (again: everyone's).
    if (d.corner === 'player' && !d.active && d.role) onFocus(focus === d.role ? null : d.role);
  };
  const mid = (a: ImagePoint, b: ImagePoint) => ({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 });
  const center = mid(mid(quad.losLeft, quad.losRight), mid(quad.backLeft, quad.backRight));

  // Each line: its glow (under all of them, blurred once) and the line itself (a white edge, the color).
  const glows: React.ReactNode[] = [];
  const bodies: React.ReactNode[] = [];
  drawn.forEach(({ s, owner }, order) => {
    const f = linesSince === Infinity ? 1 : easeOut((linesSince - order * STAGGER) / GROW);
    if (f <= 0) return;
    const color = inkOf(s);
    const op = moving ? 0.22 : focus !== null && owner !== focus ? 0.16 : 1;
    const block = s.kind === 'block';
    const W = HALF[s.kind] ?? 0.14;
    const m = Math.min(Math.max(0, Math.round(Number(s.motion) || 0)), s.points.length - 1);
    // A shift first (dashed, to the open circle where he sets), then any motion (a zigzag), then the play.
    const sh = shiftLegs(s);
    const shiftF: Pt[] = sh > 0 ? s.points.slice(0, sh + 1) : [];
    const motionF: Pt[] = m > sh ? s.points.slice(sh, m + 1) : [];
    const mainRaw = s.points.slice(m);
    const mainF: Pt[] = mainRaw.length >= 2 ? shapedPoints(mainRaw, (j) => Boolean(s.curve || mainRaw[j]?.smooth)) : [];
    const shiftLen = lengthOf(shiftF);
    const motionLen = lengthOf(motionF);
    const mainLen = lengthOf(mainF);
    const reach = (shiftLen + motionLen + mainLen) * f;
    // The arrowhead lands as the line gets there.
    const head = linesSince === Infinity ? 1 : land((linesSince - order * STAGGER - GROW * 0.8) / 240);
    const endLine = mainF.length >= 2 ? mainF : motionF;
    const end = endLine[endLine.length - 1];
    const from = endLine.length >= 2 ? pointBack(endLine, 1.2) : end;
    const glow: React.ReactNode[] = [];
    const body: React.ReactNode[] = [];

    // Man coverage: dots to the receiver and a ring around him.
    if (s.man && mainF.length >= 2) {
      const dots = visibleRuns(cutLine(mainF, mainLen * f), proj.depth, proj.near).map((run) => polyline(run.map(px))).join('');
      body.push(
        <path key="w" d={dots} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth={5.5 * k} strokeLinecap="round" strokeDasharray={`0.1 ${7 * k}`} />,
        <path key="c" d={dots} fill="none" stroke={color} strokeWidth={3.2 * k} strokeLinecap="round" strokeDasharray={`0.1 ${7 * k}`} />
      );
      if (f >= 1) body.push(<path key="r" d={shape(circleOnField(s.man, 1.1 * head))} fill={color} fillOpacity="0.12" stroke={color} strokeWidth={2.4 * k} />);
      bodies.push(<g key={order} opacity={op}>{body}</g>);
      return;
    }
    // A zone: its area around the end of the line, laid on the field.
    const last = s.points[s.points.length - 1];
    if (s.zone && last && f >= 1) {
      const zf = head;
      const area = shape(Array.from({ length: 36 }, (_, j) => ({ x: last.x + s.zone!.rx * zf * Math.cos((j / 36) * 2 * Math.PI), y: last.y + s.zone!.ry * zf * Math.sin((j / 36) * 2 * Math.PI) })));
      body.push(<path key="z" d={area} fill={color} fillOpacity="0.16" stroke={color} strokeOpacity="0.7" strokeWidth={1.6 * k} strokeDasharray={`${6 * k} ${4 * k}`} />);
    }
    // A pre-snap shift: dashes to where he sets, and an open circle there.
    if (shiftF.length >= 2) {
      const cut = cutLine(shiftF, Math.min(shiftLen, reach));
      if (lengthOf(cut) > 0.05) {
        glow.push(<path key="sg" d={rib(lay(cut, HALF.motion), (h) => h * 2.2 + 2 * k)} fill={SHIFT_FILM} />);
        dashLine(cut, 0.6, 0.6).forEach((d, j) => {
          const dash = lay(d, HALF.motion);
          body.push(
            <path key={`se${j}`} d={rib(dash, (h) => h + 1.2 * k, true)} fill="#ffffff" fillOpacity="0.92" />,
            <path key={`sc${j}`} d={rib(dash, (h) => h, true)} fill={SHIFT_FILM} />
          );
        });
      }
      if (reach >= shiftLen) {
        const set = shiftF[shiftF.length - 1];
        body.push(<path key="ss" d={shape(circleOnField(set, 0.7))} fill="#ffffff" fillOpacity="0.85" stroke={SHIFT_FILM} strokeWidth={2.6 * k} />);
      }
    }
    // Pre-snap motion: a zigzag.
    if (motionF.length >= 2) {
      const cut = cutLine(motionF, Math.min(motionLen, Math.max(0, reach - shiftLen)));
      if (lengthOf(cut) > 0.05) {
        const zig = lay(zigzagLine(cut, 0.32, 1.1), HALF.motion);
        glow.push(<path key="m" d={rib(zig, (h) => h * 2.2 + 2 * k)} fill={FILM_COLOR.motion} />);
        body.push(
          <path key="me" d={rib(zig, (h) => h + 1.2 * k)} fill="#ffffff" fillOpacity="0.9" />,
          <path key="mc" d={rib(zig)} fill={FILM_COLOR.motion} />
        );
      }
    }
    // The route, run or block: under its arrowhead, the line stops inside it.
    const mainReach = Math.max(0, reach - shiftLen - motionLen);
    if (mainF.length >= 2 && mainReach > 0.02) {
      const tuck = block || f < 1 ? 0 : ARROW * 0.55 * head;
      const cut = cutLine(mainF, Math.max(0.02, Math.min(mainLen, mainReach) - tuck));
      const line = lay(cut, W);
      glow.push(<path key="g" d={rib(line, (h) => h * 2.4 + 2 * k)} fill={color} />);
      if (s.kind === 'pass') {
        // A route: dashes over a faint line of its whole path.
        body.push(<path key="p" d={rib(line, (h) => h * 0.55)} fill={color} fillOpacity="0.45" />);
        dashLine(cut, 0.95, 0.55).forEach((d, j) => {
          const dash = lay(d, W);
          body.push(
            <path key={`de${j}`} d={rib(dash, (h) => h + 1.2 * k, true)} fill="#ffffff" fillOpacity="0.92" />,
            <path key={`dc${j}`} d={rib(dash, (h) => h, true)} fill={color} />
          );
        });
      } else {
        body.push(
          <path key="e" d={rib(line, (h) => h + 1.3 * k)} fill="#ffffff" fillOpacity="0.92" />,
          <path key="c" d={rib(line)} fill={color} />
        );
      }
    }
    // The end: a T for a block, else an arrowhead lying on the field.
    if (f >= 1 && head > 0 && end && endLine.length >= 2) {
      if (block && mainF.length >= 2) {
        const t = lay(tOnField(end, from, 0.6 * head), W);
        glow.push(<path key="tg" d={rib(t, (h) => h * 2.4 + 2 * k, true)} fill={color} />);
        body.push(
          <path key="te" d={rib(t, (h) => h + 1.3 * k, true)} fill="#ffffff" fillOpacity="0.92" />,
          <path key="tc" d={rib(t, (h) => h, true)} fill={color} />
        );
      } else {
        const tip = shape(arrowOnField(end, from, ARROW * head, 0.48 * head));
        const ink = mainF.length >= 2 ? color : FILM_COLOR.motion;
        glow.push(<path key="ag" d={tip} fill={ink} stroke={ink} strokeWidth={6 * k} strokeLinejoin="round" />);
        body.push(<path key="a" d={tip} fill={ink} stroke="#ffffff" strokeOpacity="0.92" strokeWidth={1.4 * k} strokeLinejoin="round" />);
      }
    }
    // Drawn: a light runs along each route and run, the way the player goes.
    if (settled && op === 1 && !reduce && (s.kind === 'run' || s.kind === 'pass') && mainF.length >= 2) {
      const runs = visibleRuns(densify(cutLine(mainF, Math.max(0.05, mainLen - ARROW * 0.55)), 0.75), proj.depth, proj.near);
      const c = runs.length === 1 ? runs[0].map(px) : [];
      let len = 0;
      for (let i = 1; i < c.length; i++) len += gap(c[i - 1], c[i]);
      const dash = Math.min(26 * k, len * 0.3);
      if (len > 8)
        body.push(
          <path key="run" d={polyline(c)} fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth={2.6 * k} strokeLinecap="round" strokeDasharray={`${dash.toFixed(1)} ${(len + dash).toFixed(1)}`} strokeDashoffset={dash.toFixed(1)}>
            <animate attributeName="stroke-dashoffset" values={`${dash.toFixed(1)};${(-len).toFixed(1)}`} dur={`${Math.max(1.2, len / 240).toFixed(2)}s`} begin={`${((order * 0.35) % 2.5).toFixed(2)}s`} repeatCount="indefinite" />
          </path>
        );
    }
    glows.push(<g key={order} opacity={op}>{glow}</g>);
    bodies.push(<g key={order} opacity={op}>{body}</g>);
  });

  // A pass to the ball carrier: the ball's flight, an arc from the QB to the catch, after the routes are drawn.
  const thrown = showing(false) && !moving && (showLines || focus === lines.ballRole) ? passThrow(lines.nodes, lines.strokes, lines.ballRole) : null;
  let throwArt: React.ReactNode = null;
  if (thrown && seen(thrown.from) && seen(thrown.to)) {
    const tf = linesSince === Infinity ? 1 : easeOut((linesSince - drawn.length * STAGGER - 150) / 600);
    if (tf > 0) {
      const a = px(thrown.from);
      const b = px(thrown.to);
      const lift = Math.min(110 * k, gap(a, b) * 0.32);
      // Through a turned camera the ball really flies, a few yards up; on the film it arcs on the picture.
      const high = Math.min(4, Math.hypot(thrown.to.x - thrown.from.x, thrown.to.y - thrown.from.y) * 0.22);
      const arc: Px[] = Array.from({ length: 25 }, (_, i) => {
        const t = (i / 24) * tf;
        if (free) return proj.to({ x: thrown.from.x + (thrown.to.x - thrown.from.x) * t, y: thrown.from.y + (thrown.to.y - thrown.from.y) * t }, 4 * high * t * (1 - t)) ?? b;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * lift * t * (1 - t)] as const;
      });
      const d = polyline(arc);
      const [e1, e0] = [arc[arc.length - 1], arc[arc.length - 2]];
      const ang = (Math.atan2(e1[1] - e0[1], e1[0] - e0[0]) * 180) / Math.PI;
      throwArt = (
        <g opacity={focus !== null && focus !== lines.ballRole ? 0.3 : 1}>
          <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth={5.2 * k} strokeLinecap="round" strokeDasharray={`0.1 ${7 * k}`} />
          <path d={d} fill="none" stroke={THROW_COLOR} strokeWidth={3 * k} strokeLinecap="round" strokeDasharray={`0.1 ${7 * k}`} />
          {tf >= 1 && <ellipse cx={b[0]} cy={b[1]} rx={7 * k} ry={4.3 * k} fill={THROW_COLOR} stroke="#ffffff" strokeWidth={1.5 * k} transform={`rotate(${ang.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)})`} />}
        </g>
      );
    }
  }

  // The play running: a comet behind each player, wide at him and fading out behind.
  const trails = (frame?.trails || [])
    .filter((t) => t.points.length >= 2 && showing(isDefenseRole(t.role)))
    .map((t, i) => {
      // The part in front of the camera that ends where he is now.
      const runs = visibleRuns(densify(t.points, 0.5), proj.depth, proj.near);
      const fp = runs[runs.length - 1] || [];
      const sp = fp.map(px);
      const n = sp.length;
      if (n < 2) return null;
      const half = fp.map((p, j) => halfAt(p, 0.17) * Math.pow(j / (n - 1), 0.8));
      const ink = isDefenseRole(t.role) ? t.color : FILM_COLOR[t.kind] || t.color;
      const id = `${uid}t${i}`;
      return (
        <g key={id} opacity={focus !== null && focus !== t.role ? 0.25 : 1}>
          <defs>
            <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={sp[0][0]} y1={sp[0][1]} x2={sp[n - 1][0]} y2={sp[n - 1][1]}>
              <stop offset="0" stopColor={ink} stopOpacity="0" />
              <stop offset="0.55" stopColor={ink} stopOpacity="0.5" />
              <stop offset="1" stopColor={ink} stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <path d={ribbon(sp, half, true)} fill={`url(#${id})`} />
        </g>
      );
    });

  // The ball while it runs: in the air it rises over its shadow.
  let ballArt: React.ReactNode = null;
  if (frame && seen(frame.ball)) {
    const g = px(frame.ball);
    const high = frame.ball.inAir ? (frame.ball.air !== undefined ? Math.sin(Math.PI * frame.ball.air) * 3 : 0.35) : 0;
    const top = (high && proj.to(frame.ball, high)) || g;
    ballArt = (
      <g pointerEvents="none">
        <ellipse cx={g[0]} cy={g[1]} rx={5 * k} ry={2.4 * k} fill="#000000" opacity={top[1] < g[1] - 1 ? 0.3 : 0.4} />
        <g transform={`translate(${top[0].toFixed(1)} ${(top[1] - 3 * k).toFixed(1)}) rotate(-25)`}>
          <ellipse rx={6 * k} ry={3.6 * k} fill="#7c2d12" stroke="#ffffff" strokeWidth={1.3 * k} />
          <path d={`M${(-2.4 * k).toFixed(1)} 0H${(2.4 * k).toFixed(1)}`} stroke="#ffffff" strokeWidth={1 * k} strokeLinecap="round" />
        </g>
      </g>
    );
  }

  // The line of scrimmage (blue) and the line to gain (yellow), across the field like on TV; they sweep out from
  // the middle when the picture stops on a play.
  const toGo = situation?.toGo && situation.toGo > 0 && situation.toGo <= 30 ? situation.toGo : 0;
  const sweep = layerSince === Infinity ? 1 : easeOut(layerSince / 650);
  // The field's middle (from the ball): the hash the ball is on puts it to the other side.
  const fieldMid = situation?.hash === 'L' ? HASH : situation?.hash === 'R' ? -HASH : 0;
  const [bandL, bandR] = clean ? [fieldMid - HALF_FIELD, fieldMid + HALF_FIELD] : [-((quad.halfWidth ?? 12) + 10), (quad.halfWidth ?? 12) + 10];
  const band = (y: number, yards: number) => {
    const c = (bandL + bandR) / 2;
    return rib(lay([{ x: c + (bandL - c) * sweep, y }, { x: c + (bandR - c) * sweep, y }], yards));
  };
  let gainTag: React.ReactNode = null;
  if (toGo && sweep >= 1) {
    const text = (situation?.down && ORDINAL[situation.down] ? `${ORDINAL[situation.down]} & ${toGo}` : `${toGo} to go`).toUpperCase();
    const spot = clean ? { x: bandR - 5, y: toGo } : { x: (quad.halfWidth ?? 12) - 1, y: toGo };
    const at = seen(spot) ? px(spot) : ([-1e4, -1e4] as const);
    const tw = text.length * 6.6 * k + 14 * k;
    const th = 17 * k;
    const tx = Math.max(4, Math.min(cw - tw - 4, at[0] - tw / 2));
    const ty = Math.max(4, Math.min(ch - th - 4, at[1] - th - 5 * k));
    gainTag = (
      <g pointerEvents="none">
        <rect x={tx} y={ty} width={tw} height={th} rx={4 * k} fill="#facc15" stroke="#0f172a" strokeOpacity="0.5" strokeWidth={1 * k} />
        <text x={tx + tw / 2} y={ty + th / 2 + 3.8 * k} textAnchor="middle" fontSize={10.5 * k} fontWeight={900} fill="#111827" fontFamily={FONT}>
          {text}
        </text>
      </g>
    );
  }

  // The clean field: the video covered by a drawn field (turf, yard lines, hash marks, and the numbers when the spot is
  // known), laid out from the snap's spot and hash, through the same camera as the play.
  let fieldArt: React.ReactNode = null;
  if (clean && !lineUp) {
    const known = Boolean(situation?.yardLine && situation.yardLine > 0 && situation.yardLine < 100);
    // The line of scrimmage, yards from the offense's own goal line (unknown: their 35, no numbers).
    const los = known ? 100 - situation!.yardLine! : 35;
    const yOf = (A: number) => A - los;
    const yLo = Math.max(yOf(-10), -45);
    const yHi = Math.min(yOf(110), 75);
    const L = fieldMid - HALF_FIELD;
    const R = fieldMid + HALF_FIELD;
    const rect = (xa: number, xb: number, ya: number, yb: number) => (yb > ya ? shape([{ x: xa, y: ya }, { x: xb, y: ya }, { x: xb, y: yb }, { x: xa, y: yb }]) : '');
    const stripes: [string[], string[]] = [[], []];
    for (let A = 0; A < 100; A += 5) stripes[(A / 5) % 2].push(rect(L, R, Math.max(yOf(A), yLo), Math.min(yOf(A + 5), yHi)));
    const ends = rect(L, R, Math.max(yOf(-10), yLo), Math.min(yOf(0), yHi)) + rect(L, R, Math.max(yOf(100), yLo), Math.min(yOf(110), yHi));
    const yardLines: string[] = [];
    for (let A = 0; A <= 100; A += 5) {
      const y = yOf(A);
      if (y >= yLo && y <= yHi) yardLines.push(rib(lay([{ x: L, y }, { x: R, y }], A === 0 || A === 100 ? 0.22 : 0.1)));
    }
    const sidelines = rib(lay([{ x: L, y: yLo }, { x: L, y: yHi }], 0.3)) + rib(lay([{ x: R, y: yLo }, { x: R, y: yHi }], 0.3));
    const ticks: string[] = [];
    for (let A = 1; A < 100; A++) {
      const y = yOf(A);
      if (A % 5 === 0 || y < yLo || y > yHi) continue;
      for (const x of [fieldMid - HASH, fieldMid + HASH]) ticks.push(rib(lay([{ x: x - 0.33, y }, { x: x + 0.33, y }], 0.06)));
      ticks.push(rib(lay([{ x: L + 0.3, y }, { x: L + 0.97, y }], 0.06)), rib(lay([{ x: R - 0.97, y }, { x: R - 0.3, y }], 0.06)));
    }
    const numbers: string[] = [];
    if (known) {
      for (let A = 10; A <= 90; A += 10) {
        const y = yOf(A);
        if (y < yLo + 1 || y > yHi - 1) continue;
        const text = String(Math.min(A, 100 - A));
        for (const s of [-1, 1]) {
          // Tops toward the sideline, read standing in the middle of the field facing it; the yard line between the digits.
          const put = (u: number, v: number): Pt => ({ x: fieldMid + s * (HALF_FIELD - 11 + v), y: y - s * u });
          [...text].forEach((d, i) => {
            const from = i === 0 ? -1.8 : 0.5;
            for (const stroke of DIGITS[d] || []) numbers.push(rib(lay(stroke.map(([u, v]) => put(from + u * 1.3, v)), 0.16), (h) => h, true));
          });
        }
      }
    }
    fieldArt = (
      <g>
        <rect x={0} y={0} width={cw} height={ch} fill={`url(#${uid}sky)`} />
        <path d={rect(L - 8, R + 8, yLo - 8, yHi + 8)} fill="#24502a" />
        <path d={stripes[0].join('')} fill="#2f7a36" />
        <path d={stripes[1].join('')} fill="#2a6f31" />
        <path d={ends} fill="#1d5226" />
        <path d={ticks.join('')} fill="#f8fafc" fillOpacity="0.75" />
        <path d={yardLines.join('')} fill="#f8fafc" fillOpacity="0.92" />
        <path d={sidelines} fill="#f8fafc" />
        <path d={numbers.join('')} fill="#f8fafc" fillOpacity="0.85" />
      </g>
    );
  }

  // Our defense's gaps, the builder's way: the gap's letter in a pill (green filled, red open, amber doubled) and a
  // dashed line from each defender to his gap, laid on the turf; the gap the play attacks is ringed when it's open.
  let gapArt: React.ReactNode = null;
  if (gaps.length && showing(true) && !moving && !lineUp) {
    const fade = layerSince === Infinity ? 1 : clamp01((layerSince - 300) / 400);
    const fs = 10 * k;
    const th = fs + 6 * k;
    const tw = th;
    // Only a pill that would sit on its neighbor moves up a row (with a tick down to its gap).
    let lastX = -Infinity;
    let lastLifted = true;
    const placed = [...gaps]
      .sort((a, b) => a.x - b.x)
      .filter((slot) => seen({ x: slot.x, y: slot.y }))
      .map((slot) => {
        const [cx, gy] = px({ x: slot.x, y: slot.y });
        const lifted = !lastLifted && cx - lastX < tw + 3 * k;
        if (!lifted) lastX = cx;
        lastLifted = lifted;
        return { slot, cx, gy, lift: lifted ? th + 4 * k : 0 };
      });
    gapArt = (
      <g pointerEvents="none" opacity={fade}>
        {placed.map(({ slot, cx, gy, lift }) => {
          const spot = { x: slot.x, y: slot.y };
          const isOpen = slot.status === 'open';
          const isOver = slot.status === 'overloaded';
          const color = isOpen ? '#dc2626' : isOver ? '#d97706' : '#059669';
          const text = slot.gap;
          const cy = gy - lift;
          return (
            <g key={slot.id} opacity={focus !== null && !slot.defenders.some((d) => d.role === focus) ? 0.3 : 1}>
              {slot.defenders.map((d, i) => {
                const from = { x: d.fromX, y: d.fromY };
                const run = visibleRuns(densify([from, spot], 0.75), proj.depth, proj.near)[0];
                if (!run || run.length < 2) return null;
                const path = polyline(run.map(px));
                return (
                  <g key={`${d.role}${i}`}>
                    <path d={path} fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth={3.6 * k} strokeLinecap="round" strokeDasharray={`${5 * k} ${4 * k}`} />
                    <path d={path} fill="none" stroke={color} strokeWidth={2.2 * k} strokeLinecap="round" strokeDasharray={`${5 * k} ${4 * k}`} />
                  </g>
                );
              })}
              <path d={shape(circleOnField(spot, 0.32))} fill={color} fillOpacity="0.85" stroke="#ffffff" strokeWidth={1.2 * k} />
              {lift > 0 && <line x1={cx} y1={gy - 2 * k} x2={cx} y2={cy - 6 * k} stroke={color} strokeWidth={1.6 * k} />}
              {isOpen && slot.isPointOfAttack && (
                <rect x={cx - tw / 2 - 3 * k} y={cy - th - 9 * k} width={tw + 6 * k} height={th + 6 * k} rx={6 * k} fill="none" stroke="#ef4444" strokeWidth={2.2 * k} strokeDasharray={`${3 * k} ${2 * k}`} />
              )}
              <rect x={cx - tw / 2} y={cy - th - 6 * k} width={tw} height={th} rx={th / 2} fill={color} stroke="#ffffff" strokeWidth={1.2 * k} />
              <text x={cx} y={cy - th / 2 - 6 * k + fs * 0.36} textAnchor="middle" fill="#ffffff" fontSize={fs} fontWeight={900} fontFamily={FONT}>
                {text}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  /** A player: a ring at his feet (his color) with his tag under it; they land one by one when the picture stops. */
  const playerArt = (n: PlayNode, i: number) => {
    const def = isDefenseRole(n.role);
    const skill = skillDiagramLabel(n.role);
    const isBack = !skill && !(n.line || !/^[1-4]$/.test(n.role));
    const lineman = !def && !skill && !isBack;
    const carrier = !def && !lineman && n.role === lines.ballRole;
    const focused = focus === n.role;
    const pin = layerSince === Infinity ? 1 : land((layerSince - i * 22) / 380);
    if (pin <= 0) return null;
    const around = circleOnField(n, (lineman ? 0.5 : 0.68) * pin);
    if (!around.every(seen)) return null;
    const ring = around.map(px);
    const [cx, cy] = px(n);
    const low = Math.max(...ring.map((q) => q[1]));
    const tint = focused ? '#a5b4fc' : def ? '#4ade80' : carrier ? '#fb923c' : '#ffffff';
    const chip = focused ? '#4f46e5' : def ? DEFENSE_COLOR : carrier ? '#ea580c' : '#ffffff';
    const ink = focused || def || carrier ? '#ffffff' : '#0f172a';
    const text = tagOf(n);
    const fs = (lineman ? 8.5 : 10) * k;
    const tw = Math.max(fs * 1.7, text.length * fs * 0.64 + 7 * k);
    const th = fs + 5 * k;
    const ty = low + 2.5 * k;
    return (
      <g key={n.role} opacity={(focus !== null && !focused ? 0.45 : 1) * clamp01(pin * 1.5)} {...grab(n)}>
        {tapOK && <circle cx={cx} cy={cy} r={Math.max(touch ? 22 / z : 12 / z, (low - cy) * 1.3)} fill="transparent" />}
        <path d={polygon(ring)} fill={tint} fillOpacity="0.22" stroke={tint} strokeWidth={(focused ? 3.2 : 2.2) * k} />
        {(carrier || focused) && !reduce && (
          <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)})`} pointerEvents="none">
            <path d={polygon(ring.map(([x, y]) => [x - cx, y - cy] as const))} fill="none" stroke={tint} strokeWidth={2 * k}>
              <animateTransform attributeName="transform" type="scale" values="1;2" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0" dur="1.6s" repeatCount="indefinite" />
            </path>
          </g>
        )}
        <rect x={cx - tw / 2} y={ty} width={tw} height={th} rx={th / 2} fill={chip} stroke="#0f172a" strokeOpacity={def || carrier || focused ? 0 : 0.55} strokeWidth={1 * k} />
        <text x={cx} y={ty + th / 2 + fs * 0.36} textAnchor="middle" fill={ink} fontSize={fs} fontFamily={FONT} fontWeight={900}>
          {text}
        </text>
      </g>
    );
  };

  return (
    <div ref={boxRef} className="absolute inset-0 z-10 pointer-events-none">
      {cw > 0 && !clean && !lineUp && shade && (
        <div
          className="absolute pointer-events-none transition-all duration-200"
          style={{
            left,
            top,
            width: cw,
            height: ch,
            background:
              showLines || moving || focus !== null
                ? 'radial-gradient(ellipse at center, rgba(2,6,23,0.34) 0%, rgba(2,6,23,0.56) 100%)'
                : 'radial-gradient(ellipse at center, rgba(2,6,23,0.18) 0%, rgba(2,6,23,0.34) 100%)',
            backdropFilter: showLines || moving || focus !== null ? 'blur(3.5px)' : 'blur(1.8px)',
            WebkitBackdropFilter: showLines || moving || focus !== null ? 'blur(3.5px)' : 'blur(1.8px)',
          }}
        />
      )}
      {cw > 0 && (
        <svg
          ref={svgRef}
          className="absolute overflow-visible"
          style={{ left, top, width: cw, height: ch, pointerEvents: lineUp ? 'auto' : 'none' }}
          viewBox={`0 0 ${cw} ${ch}`}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          {...(lineUp
            ? {
                onPointerDown:
                  alignTarget === 'offense'
                    ? startDrag('offense')
                    : alignTarget === 'defense'
                      ? startDrag('defense')
                      : alignTarget === 'field'
                        ? startDrag('all')
                        : undefined,
                onClick: (e: React.MouseEvent) => e.stopPropagation(),
                style: {
                  left,
                  top,
                  width: cw,
                  height: ch,
                  pointerEvents: (alignTarget === 'players' ? 'none' : 'auto') as 'none' | 'auto',
                  cursor: alignTarget === 'players' ? 'default' : 'move',
                  touchAction: 'none' as const,
                },
              }
            : clean
              ? {
                  // The clean field: drag to turn it, double-tap for the film's own angle.
                  onPointerDown: startOrbit,
                  onClick: (e: React.MouseEvent) => e.stopPropagation(),
                  onDoubleClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onView('film');
                  },
                  style: { left, top, width: cw, height: ch, pointerEvents: 'auto' as const, cursor: 'grab', touchAction: 'none' as const },
                }
              : {})}
        >
          <defs>
            <filter id={`${uid}glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={(3.5 * k).toFixed(2)} />
            </filter>
            <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b1020" />
              <stop offset="1" stopColor="#173320" />
            </linearGradient>
          </defs>
          {fieldArt}
          {lineUp &&
            buildProjectedFieldGrid(quad).map((g) => (
              <line
                key={g.id}
                x1={g.p1.u * cw}
                y1={g.p1.v * ch}
                x2={g.p2.u * cw}
                y2={g.p2.v * ch}
                stroke={g.kind === 'los' ? '#f59e0b' : '#ffffff'}
                strokeOpacity={g.kind === 'los' ? 0.95 : 0.4}
                strokeWidth={(g.kind === 'los' ? 2.5 : 1) / z}
                strokeDasharray={g.kind === 'los' ? undefined : `${4 / z} ${4 / z}`}
              />
            ))}
          {!lineUp && sweep > 0 && (
            <g pointerEvents="none">
              <path d={band(0, 0.17)} fill="#38bdf8" fillOpacity="0.55" />
              {toGo > 0 && <path d={band(toGo, 0.19)} fill="#facc15" fillOpacity="0.8" />}
              {gainTag}
            </g>
          )}
          {glows.length > 0 && (
            <g filter={`url(#${uid}glow)`} opacity="0.6" pointerEvents="none">
              {glows}
            </g>
          )}
          <g pointerEvents="none">{bodies}</g>
          {throwArt}
          <g pointerEvents="none">{trails}</g>
          {gapArt}
          {shownNodes.map(playerArt)}
          {ballArt}
          {lineUp && (() => {
            const offSpot: Pt = {
              x: quad.offenseTransform?.dx ?? 0,
              y: -3.2 + (quad.offenseTransform?.dy ?? 0),
            };
            const defSpot: Pt = {
              x: quad.defenseTransform?.dx ?? 0,
              y: 3.4 + (quad.defenseTransform?.dy ?? 0),
            };
            const offPx = seen(offSpot) ? px(offSpot) : null;
            const hasDef = lines.nodes.some((n) => isDefenseRole(n.role));
            const defPx = hasDef && seen(defSpot) ? px(defSpot) : null;
            return (
              <>
                {corners && CORNERS.map(({ key, color }) => (
                  <circle
                    key={key}
                    cx={quad[key].u * cw}
                    cy={quad[key].v * ch}
                    r={handle}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2.5 / z}
                    style={{ cursor: 'grab', pointerEvents: 'auto' }}
                    onPointerDown={startDrag(key)}
                  />
                ))}
                {/* Field handle */}
                <g
                  style={{ cursor: 'move', pointerEvents: 'auto' }}
                  onPointerDown={startDrag('all')}
                >
                  <title>Drag to move the Field perspective</title>
                  <circle
                    cx={center.u * cw}
                    cy={center.v * ch}
                    r={handle * 1.15}
                    fill={alignTarget === 'field' ? '#4f46e5' : 'rgba(15,23,42,0.82)'}
                    stroke="#fff"
                    strokeWidth={2 / z}
                  />
                  <path
                    d={`M${center.u * cw - handle * 0.55} ${center.v * ch}h${handle * 1.1}M${center.u * cw} ${center.v * ch - handle * 0.55}v${handle * 1.1}`}
                    stroke="#fff"
                    strokeWidth={2 / z}
                    strokeLinecap="round"
                  />
                </g>
                {/* Independent Full Offense drag handle */}
                {showsOffense(side) && offPx && (
                  <g
                    transform={`translate(${offPx[0].toFixed(1)} ${offPx[1].toFixed(1)})`}
                    style={{ cursor: 'move', pointerEvents: 'auto' }}
                    onPointerDown={startDrag('offense')}
                  >
                    <title>Drag to move the Full Offense independently</title>
                    <rect
                      x={-38 * k}
                      y={-11 * k}
                      width={76 * k}
                      height={22 * k}
                      rx={11 * k}
                      fill="#ea580c"
                      stroke="#ffffff"
                      strokeWidth={(alignTarget === 'offense' ? 2.6 : 1.6) * k}
                    />
                    <text
                      x={0}
                      y={3.8 * k}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={9.5 * k}
                      fontWeight={900}
                      fontFamily={FONT}
                    >
                      ✢ OFFENSE
                    </text>
                  </g>
                )}
                {/* Independent Full Defense drag handle */}
                {showsDefense(side) && defPx && (
                  <g
                    transform={`translate(${defPx[0].toFixed(1)} ${defPx[1].toFixed(1)})`}
                    style={{ cursor: 'move', pointerEvents: 'auto' }}
                    onPointerDown={startDrag('defense')}
                  >
                    <title>Drag to move the Full Defense independently</title>
                    <rect
                      x={-38 * k}
                      y={-11 * k}
                      width={76 * k}
                      height={22 * k}
                      rx={11 * k}
                      fill="#16a34a"
                      stroke="#ffffff"
                      strokeWidth={(alignTarget === 'defense' ? 2.6 : 1.6) * k}
                    />
                    <text
                      x={0}
                      y={3.8 * k}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={9.5 * k}
                      fontWeight={900}
                      fontFamily={FONT}
                    >
                      ✢ DEFENSE
                    </text>
                  </g>
                )}
              </>
            );
          })()}
        </svg>
      )}
    </div>
  );
};
