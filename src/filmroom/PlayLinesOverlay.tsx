import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { applyHomography, buildProjectedFieldGrid, getQuadHomographies, HOMOGRAPHY_PRESETS, imageToField, type HomographyQuad, type ImagePoint } from '../utils/videoHomography';
import { DEFENSE_COLOR, diagramLabel, isDefenseRole, lineStartsOn, passThrow, shownText, skillDiagramLabel, STROKE_COLOR, THROW_COLOR, type PlayNode, type PlayStroke } from '../utils/footballEngine';
import { arrowOnField, circleOnField, cutLine, dashLine, densify, lengthOf, pointBack, polygon, polyline, ribbon, tOnField, zigzagLine, type Px } from './linesArt';
import { computeAnimatedPlayFrame, playAnimationSeconds } from '../utils/playAnimation';
import { safeJSONParse, safeJSONSet } from '../services/storageService';

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
}

/** What the Film Player needs: the button, the lines (inside the zoom, so they stay on the field) and the controls (outside it). */
export interface PlayLinesControl {
  on: boolean;
  toggle: () => void;
  layer: (state: { playing: boolean; zoom: number }) => React.ReactNode;
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
const SIDE_KEY = 'mahopac_film_lines_side';
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
const panel = { background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' };
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

/**
 * The play as it lines up on this film: players moved on the film where the coach put them, each one's lines
 * moving with him. The diagram itself isn't changed.
 */
function onFilm(lines: VideoLines): VideoLines {
  const moved = lines.quad.moved;
  if (!moved || !Object.keys(moved).length) return lines;
  const shift = new Map<string, { dx: number; dy: number }>();
  for (const n of lines.nodes) {
    const m = moved[n.role];
    if (m) shift.set(n.role, { dx: m.x - n.x, dy: m.y - n.y });
  }
  const strokes = lines.strokes.map((st) => {
    const owner = lines.nodes.find((n) => shift.has(n.role) && lineStartsOn(st, n, lines.nodes));
    if (!owner) return st;
    const { dx, dy } = shift.get(owner.role)!;
    return { ...st, points: st.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  });
  return { ...lines, nodes: lines.nodes.map((n) => (moved[n.role] ? { ...n, ...moved[n.role] } : n)), strokes };
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
  /** The snap's down and distance: the line to gain (yellow) across the field. */
  situation?: { down?: number; toGo?: number };
}): PlayLinesControl {
  const { lines, video, filmKey, onTurnOn, waiting, situation } = opts;
  const [on, setOn] = useState(false);
  const [lineUp, setLineUp] = useState(false);
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
  // Half speed unless the coach picks full speed.
  const [slow, setSlow] = useState(true);
  // Turned on, it shows the players lined up; the lines come on with a click.
  const [showLines, setShowLines] = useState(false);
  // Lining up: the 4 corners to drag, only when the coach wants an exact fit.
  const [corners, setCorners] = useState(false);
  // A tapped player: just his job.
  const [focus, setFocus] = useState<string | null>(null);
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
        const next = Math.min(1, p + (dt * (slow ? 0.5 : 1)) / seconds);
        if (next >= 1) setRunning(false);
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, slow, seconds]);
  // Another play: back to the start.
  useEffect(() => {
    setRunning(false);
    setProgress(0);
    setFocus(null);
  }, [lines?.name]);

  // The coach's change to the lineup: this play's own from now on, and the film's latest for the plays after it.
  // Players moved on the film are this play's own (saved with its lineup), not the film's for the plays after it.
  const shown = useMemo(() => {
    if (!lines) return null;
    const setQuad = (q: HomographyQuad) => {
      const { fromFilm: _picked, ...own } = q;
      lines.setQuad(own);
      const { moved: _players, ...field } = own;
      safeJSONSet(lineupKey, field);
    };
    return {
      ...onFilm(lines),
      setQuad,
      // A player dragged on the film: where he lines up in this clip. The diagram keeps him where he's drawn.
      moveNode: (role: string, x: number, y: number) => setQuad({ ...lines.quad, moved: { ...lines.quad.moved, [role]: { x, y } } }),
    };
  }, [lines, lineupKey]);
  const filmMoves = Object.keys(lines?.quad.moved || {}).length;
  const frame = useMemo(
    () => (shown ? computeAnimatedPlayFrame(shown.nodes, shown.strokes, [], shown.ballRole, progress) : null),
    [shown, progress]
  );
  const moving = progress > 0.002;
  const focusNode = focus ? lines?.nodes.find((n) => n.role === focus) : undefined;
  const btn = 'h-8 px-2.5 rounded-lg text-xs font-bold cursor-pointer';

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
    layer: ({ playing, zoom }) =>
      shown && frame && !playing ? <LinesDrawing video={video} lines={shown} frame={moving ? frame : null} side={side} showLines={showLines} lineUp={lineUp} corners={corners} zoom={zoom} situation={situation} focus={focus} onFocus={setFocus} /> : null,
    bar: ({ playing, inline }) => (
      <div className={`pointer-events-auto flex flex-col items-start gap-1 ${inline ? '' : 'px-2 pt-1.5'}`} {...keep}>
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl" style={panel}>
          {!(inline && lines) && (
            <span className="h-8 px-2 inline-flex items-center text-xs font-black truncate max-w-[12rem]" title={lines?.name}>
              {lines?.name || 'Play lines'}
            </span>
          )}
          {lines && (
            <>
              <button
                type="button"
                className={btn}
                style={showLines ? { background: '#4f46e5', color: '#ffffff' } : { background: '#ffffff', color: '#111827' }}
                aria-pressed={showLines}
                onClick={() => setShowLines((v) => !v)}
                title="The play's routes, runs, blocks and motion (tap a player for just his job)"
              >
                {showLines ? 'Hide lines' : 'Show lines'}
              </button>
              <button
                type="button"
                className={btn}
                style={{ background: '#f59e0b', color: '#111827' }}
                disabled={playing}
                onClick={() => {
                  setProgress(0);
                  setRunning(true);
                }}
                title="Play the motion, the snap and everyone along their lines on this frame"
              >
                ▶ Run play
              </button>
              <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => setSlow((s) => !s)} title={slow ? 'Running at half speed: tap for full speed' : 'Running at full speed: tap for half speed'}>
                {slow ? '½×' : '1×'}
              </button>
              {moving && (
                <button
                  type="button"
                  className={`${btn} hover:bg-white/10`}
                  onClick={() => {
                    setRunning(false);
                    setProgress(0);
                  }}
                  title="Back to the lineup before the snap"
                >
                  Reset
                </button>
              )}
              <button type="button" className={`${btn} ${lineUp ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`} onClick={() => setLineUp((v) => !v)} title="Show the yard lines: move, turn and size them to fit the field on the film">
                Line up field
              </button>
              <span className="inline-flex rounded-lg overflow-hidden border border-white/15" role="group" aria-label="Show">
                {SIDES.map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={side === id} className={`h-8 px-2 text-xs font-bold cursor-pointer ${side === id ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`} onClick={() => pickSide(id)}>
                    {label}
                  </button>
                ))}
              </span>
            </>
          )}
        </div>
        {lines && lineUp && !playing && shown && (
          // Lining up: move, turn and size the field (the corners only when asked for).
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl" style={panel}>
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
              <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown.setQuad({ ...FILM_START, moved: shown.quad.moved })} title="Back to the starting lineup">
                Reset
              </button>
          </div>
        )}
        {lines && filmMoves > 0 && !lineUp && !playing && shown && (
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl" style={panel}>
            <span className="h-8 px-1.5 inline-flex items-center text-[11px] font-bold opacity-80">
              {filmMoves} player{filmMoves === 1 ? '' : 's'} moved on this film (the diagram is unchanged)
            </span>
            <button
              type="button"
              className={`${btn} hover:bg-white/10`}
              onClick={() => {
                const { moved: _players, ...field } = shown.quad;
                shown.setQuad(field);
              }}
              title="Put the players back where they are in the diagram"
            >
              Reset players
            </button>
          </div>
        )}
      </div>
    ),
    controls: ({ playing }) => (
      <div className="absolute right-2 top-11 z-20 flex flex-col items-end gap-1.5 pointer-events-auto" {...keep}>
        {!lines && (
          <div className="max-w-xs rounded-lg px-2.5 py-1.5 text-[11px] leading-snug" style={panel}>
            {waiting}
          </div>
        )}
        {lines && lineUp && !playing && shown && (
            <div className="max-w-xs rounded-lg px-2.5 py-1.5 text-[11px] leading-snug" style={panel}>
              Drag the field to move it. Turn and size it until the <b style={{ color: '#f59e0b' }}>orange</b> line sits on the ball and the yard lines match the film.
              {corners && (
                <>
                  {' '}
                  Corners: <b style={{ color: '#f59e0b' }}>orange</b> on the line of scrimmage, <b style={{ color: '#38bdf8' }}>blue</b> 5 yards behind it.
                </>
              )}{' '}
              Saved with this play; the next play on this film starts from it.
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
        {lines && moving && !playing && frame && (
          <div className="rounded-lg px-2.5 py-1 text-[11px] font-bold" style={panel}>
            {frame.phaseLabel}
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
  /** Lining up: the 4 corners to drag one at a time. */
  corners: boolean;
  zoom: number;
  /** The down and the yards to go: the line to gain in yellow. */
  situation?: { down?: number; toGo?: number };
  /** One player's job alone (his role), or everyone's. */
  focus: string | null;
  onFocus: (role: string | null) => void;
}> = ({ video, lines, frame, side, showLines, lineUp, corners, zoom, situation, focus, onFocus }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = `pl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState(16 / 9);
  const drag = useRef<{
    corner: Corner | 'all' | 'player';
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
  const px = (p: Pt): Px => {
    const r = applyHomography(H, p.x, p.y);
    return [r.x * cw, r.y * ch];
  };
  const gap = (a: Px, b: Px) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  // How big a yard is on the picture there (across and deep): what lays the lines on the turf, wider near the camera.
  const yardAt = (p: Pt) =>
    Math.sqrt(gap(px({ x: p.x - 0.5, y: p.y }), px({ x: p.x + 0.5, y: p.y })) * gap(px({ x: p.x, y: p.y - 0.5 }), px({ x: p.x, y: p.y + 0.5 })));
  // One builder picture unit on screen (the tags' size).
  const k = Math.max(0.6, ch * 0.0019) / z;
  const halfAt = (p: Pt, yards: number) => Math.max(1.1 * k, Math.min(6.5 * k, yards * yardAt(p)));
  /** A line laid on the turf: its points on the picture and how wide it is at each. */
  const lay = (pts: Pt[], yards: number) => {
    const d = densify(pts, 0.75);
    return { pts: d.map(px), half: d.map((p) => halfAt(p, yards)) };
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
    .filter(({ owner }) => showLines || (focus !== null && owner === focus))
    .sort((a, b) => Number(isDefenseStroke(a.s)) - Number(isDefenseStroke(b.s)) || Number(!a.s.motion) - Number(!b.s.motion) || a.s.points[0].x - b.s.points[0].x);
  const shownNodes = (frame ? frame.nodes : lines.nodes).filter((n) => showing(isDefenseRole(n.role)));
  // Coming in: the rings and the TV lines when the picture stops on a play; the lines when they're shown.
  const layerSince = useSince(lines.name, 1100, reduce);
  const linesSince = useSince(showLines || focus ? `${lines.name}|${side}|${focus ?? ''}|${showLines ? 1 : 0}` : '', 3400, reduce);
  const settled = linesSince >= drawn.length * STAGGER + GROW + 300;

  const toUV = (e: React.PointerEvent): ImagePoint | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return { u: (e.clientX - rect.left) / rect.width, v: (e.clientY - rect.top) / rect.height };
  };
  const startDrag = (corner: Corner | 'all') => (e: React.PointerEvent) => {
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
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const at = toUV(e);
    if (!at) return;
    const clamp = (n: number) => Math.round(Math.max(-0.2, Math.min(1.2, n)) * 1000) / 1000;
    if (d.corner === 'player') {
      // A drag, not a tap, moves him: his spot on the field, to a tenth of a yard.
      if (!d.active) {
        if (!lines.moveNode || Math.hypot(e.clientX - (d.x ?? e.clientX), e.clientY - (d.y ?? e.clientY)) < 6) return;
        d.active = true;
      }
      const f = imageToField(quad, at);
      lines.moveNode?.(d.role!, Math.round(f.x * 10) / 10, Math.round(f.y * 10) / 10);
    } else if (d.corner === 'all') {
      const du = at.u - d.from.u, dv = at.v - d.from.v;
      const move = (p: ImagePoint) => ({ u: clamp(p.u + du), v: clamp(p.v + dv) });
      lines.setQuad({ ...d.quad, losLeft: move(d.quad.losLeft), losRight: move(d.quad.losRight), backLeft: move(d.quad.backLeft), backRight: move(d.quad.backRight), preset: 'custom' });
    } else lines.setQuad({ ...d.quad, [d.corner]: { u: clamp(at.u), v: clamp(at.v) }, preset: 'custom' });
  };
  // Players can be tapped (and dragged) while the play isn't running and the field isn't being lined up.
  const tapOK = !frame && !lineUp;
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
    const motionF: Pt[] = m > 0 ? s.points.slice(0, m + 1) : [];
    const mainRaw = s.points.slice(m);
    const mainF: Pt[] = mainRaw.length >= 2 ? shapedPoints(mainRaw, (j) => Boolean(s.curve || mainRaw[j]?.smooth)) : [];
    const motionLen = lengthOf(motionF);
    const mainLen = lengthOf(mainF);
    const reach = (motionLen + mainLen) * f;
    // The arrowhead lands as the line gets there.
    const head = linesSince === Infinity ? 1 : land((linesSince - order * STAGGER - GROW * 0.8) / 240);
    const endLine = mainF.length >= 2 ? mainF : motionF;
    const end = endLine[endLine.length - 1];
    const from = endLine.length >= 2 ? pointBack(endLine, 1.2) : end;
    const glow: React.ReactNode[] = [];
    const body: React.ReactNode[] = [];

    // Man coverage: dots to the receiver and a ring around him.
    if (s.man && mainF.length >= 2) {
      const dots = polyline(cutLine(mainF, mainLen * f).map(px));
      body.push(
        <path key="w" d={dots} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth={5.5 * k} strokeLinecap="round" strokeDasharray={`0.1 ${7 * k}`} />,
        <path key="c" d={dots} fill="none" stroke={color} strokeWidth={3.2 * k} strokeLinecap="round" strokeDasharray={`0.1 ${7 * k}`} />
      );
      if (f >= 1) body.push(<path key="r" d={polygon(circleOnField(s.man, 1.1 * head).map(px))} fill={color} fillOpacity="0.12" stroke={color} strokeWidth={2.4 * k} />);
      bodies.push(<g key={order} opacity={op}>{body}</g>);
      return;
    }
    // A zone: its area around the end of the line, laid on the field.
    const last = s.points[s.points.length - 1];
    if (s.zone && last && f >= 1) {
      const zf = head;
      const area = polygon(Array.from({ length: 36 }, (_, j) => px({ x: last.x + s.zone!.rx * zf * Math.cos((j / 36) * 2 * Math.PI), y: last.y + s.zone!.ry * zf * Math.sin((j / 36) * 2 * Math.PI) })));
      body.push(<path key="z" d={area} fill={color} fillOpacity="0.16" stroke={color} strokeOpacity="0.7" strokeWidth={1.6 * k} strokeDasharray={`${6 * k} ${4 * k}`} />);
    }
    // Pre-snap motion: a zigzag.
    if (motionF.length >= 2) {
      const cut = cutLine(motionF, Math.min(motionLen, reach));
      if (lengthOf(cut) > 0.05) {
        const zig = lay(zigzagLine(cut, 0.32, 1.1), HALF.motion);
        glow.push(<path key="m" d={ribbon(zig.pts, zig.half.map((h) => h * 2.2 + 2 * k))} fill={FILM_COLOR.motion} />);
        body.push(
          <path key="me" d={ribbon(zig.pts, zig.half.map((h) => h + 1.2 * k))} fill="#ffffff" fillOpacity="0.9" />,
          <path key="mc" d={ribbon(zig.pts, zig.half)} fill={FILM_COLOR.motion} />
        );
      }
    }
    // The route, run or block: under its arrowhead, the line stops inside it.
    const mainReach = Math.max(0, reach - motionLen);
    if (mainF.length >= 2 && mainReach > 0.02) {
      const tuck = block || f < 1 ? 0 : ARROW * 0.55 * head;
      const cut = cutLine(mainF, Math.max(0.02, Math.min(mainLen, mainReach) - tuck));
      const line = lay(cut, W);
      glow.push(<path key="g" d={ribbon(line.pts, line.half.map((h) => h * 2.4 + 2 * k))} fill={color} />);
      if (s.kind === 'pass') {
        // A route: dashes over a faint line of its whole path.
        body.push(<path key="p" d={ribbon(line.pts, line.half.map((h) => h * 0.55))} fill={color} fillOpacity="0.45" />);
        dashLine(cut, 0.95, 0.55).forEach((d, j) => {
          const dash = lay(d, W);
          body.push(
            <path key={`de${j}`} d={ribbon(dash.pts, dash.half.map((h) => h + 1.2 * k), true)} fill="#ffffff" fillOpacity="0.92" />,
            <path key={`dc${j}`} d={ribbon(dash.pts, dash.half, true)} fill={color} />
          );
        });
      } else {
        body.push(
          <path key="e" d={ribbon(line.pts, line.half.map((h) => h + 1.3 * k))} fill="#ffffff" fillOpacity="0.92" />,
          <path key="c" d={ribbon(line.pts, line.half)} fill={color} />
        );
      }
    }
    // The end: a T for a block, else an arrowhead lying on the field.
    if (f >= 1 && head > 0 && end && endLine.length >= 2) {
      if (block && mainF.length >= 2) {
        const t = lay(tOnField(end, from, 0.6 * head), W);
        glow.push(<path key="tg" d={ribbon(t.pts, t.half.map((h) => h * 2.4 + 2 * k), true)} fill={color} />);
        body.push(
          <path key="te" d={ribbon(t.pts, t.half.map((h) => h + 1.3 * k), true)} fill="#ffffff" fillOpacity="0.92" />,
          <path key="tc" d={ribbon(t.pts, t.half, true)} fill={color} />
        );
      } else {
        const tip = polygon(arrowOnField(end, from, ARROW * head, 0.48 * head).map(px));
        const ink = mainF.length >= 2 ? color : FILM_COLOR.motion;
        glow.push(<path key="ag" d={tip} fill={ink} stroke={ink} strokeWidth={6 * k} strokeLinejoin="round" />);
        body.push(<path key="a" d={tip} fill={ink} stroke="#ffffff" strokeOpacity="0.92" strokeWidth={1.4 * k} strokeLinejoin="round" />);
      }
    }
    // Drawn: a light runs along each route and run, the way the player goes.
    if (settled && op === 1 && !reduce && (s.kind === 'run' || s.kind === 'pass') && mainF.length >= 2) {
      const c = densify(cutLine(mainF, Math.max(0.05, mainLen - ARROW * 0.55)), 0.75).map(px);
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
  if (thrown) {
    const tf = linesSince === Infinity ? 1 : easeOut((linesSince - drawn.length * STAGGER - 150) / 600);
    if (tf > 0) {
      const a = px(thrown.from);
      const b = px(thrown.to);
      const lift = Math.min(110 * k, gap(a, b) * 0.32);
      const arc: Px[] = Array.from({ length: 25 }, (_, i) => {
        const t = (i / 24) * tf;
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
      const fp = densify(t.points, 0.5);
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
  if (frame) {
    const g = px(frame.ball);
    const lift = frame.ball.inAir ? (frame.ball.air !== undefined ? Math.sin(Math.PI * frame.ball.air) * 3 : 0.35) * yardAt(frame.ball) : 0;
    ballArt = (
      <g pointerEvents="none">
        <ellipse cx={g[0]} cy={g[1]} rx={5 * k} ry={2.4 * k} fill="#000000" opacity={lift ? 0.3 : 0.4} />
        <g transform={`translate(${g[0].toFixed(1)} ${(g[1] - lift - 3 * k).toFixed(1)}) rotate(-25)`}>
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
  const across = (quad.halfWidth ?? 12) + 10;
  const band = (y: number, yards: number) => {
    const b = lay([{ x: -across * sweep, y }, { x: across * sweep, y }], yards);
    return ribbon(b.pts, b.half);
  };
  let gainTag: React.ReactNode = null;
  if (toGo && sweep >= 1) {
    const text = (situation?.down && ORDINAL[situation.down] ? `${ORDINAL[situation.down]} & ${toGo}` : `${toGo} to go`).toUpperCase();
    const at = px({ x: (quad.halfWidth ?? 12) - 1, y: toGo });
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
    const ring = circleOnField(n, (lineman ? 0.5 : 0.68) * pin).map(px);
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
      {cw > 0 && (
        <svg
          ref={svgRef}
          className="absolute overflow-visible"
          style={{ left, top, width: cw, height: ch, pointerEvents: lineUp ? 'auto' : 'none' }}
          viewBox={`0 0 ${cw} ${ch}`}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          {...(lineUp ? { onPointerDown: startDrag('all'), onClick: (e: React.MouseEvent) => e.stopPropagation(), style: { left, top, width: cw, height: ch, pointerEvents: 'auto' as const, cursor: 'move', touchAction: 'none' as const } } : {})}
        >
          <defs>
            <filter id={`${uid}glow`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={(3.5 * k).toFixed(2)} />
            </filter>
          </defs>
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
          {shownNodes.map(playerArt)}
          {ballArt}
          {lineUp && (
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
              <g style={{ cursor: 'move', pointerEvents: 'auto' }} onPointerDown={startDrag('all')}>
                <circle cx={center.u * cw} cy={center.v * ch} r={handle * 1.2} fill="rgba(15,23,42,0.75)" stroke="#fff" strokeWidth={2 / z} />
                <path
                  d={`M${center.u * cw - handle * 0.6} ${center.v * ch}h${handle * 1.2}M${center.u * cw} ${center.v * ch - handle * 0.6}v${handle * 1.2}`}
                  stroke="#fff"
                  strokeWidth={2 / z}
                  strokeLinecap="round"
                />
              </g>
            </>
          )}
        </svg>
      )}
    </div>
  );
};
