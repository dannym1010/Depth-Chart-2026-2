import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildProjectedFieldGrid, fieldToImage, HOMOGRAPHY_PRESETS, type HomographyQuad, type ImagePoint } from '../utils/videoHomography';
import { DEFENSE_COLOR, diagramLabel, isDefenseRole, MOTION_COLOR, shownText, skillDiagramLabel, STROKE_COLOR, type PlayNode, type PlayStroke } from '../utils/footballEngine';
import { computeAnimatedPlayFrame } from '../utils/playAnimation';
import { safeJSONParse, safeJSONSet } from '../services/storageService';

/** The selected play as the Play Builder draws it, to lay over the film. */
export interface VideoLines {
  nodes: PlayNode[];
  strokes: PlayStroke[];
  ballRole: string;
  /** Where the field is in the video: 4 corners (fractions of the frame). */
  quad: HomographyQuad;
  setQuad: (quad: HomographyQuad) => void;
  name: string;
}

/** What the Film Player needs: the button, the lines (inside the zoom, so they stay on the field) and the controls (outside it). */
export interface PlayLinesControl {
  on: boolean;
  toggle: () => void;
  layer: (state: { playing: boolean; zoom: number }) => React.ReactNode;
  controls: (state: { playing: boolean }) => React.ReactNode;
}

type Corner = 'losLeft' | 'losRight' | 'backLeft' | 'backRight';
const CORNERS: { key: Corner; color: string }[] = [
  { key: 'losLeft', color: '#f59e0b' },
  { key: 'losRight', color: '#f59e0b' },
  { key: 'backLeft', color: '#38bdf8' },
  { key: 'backRight', color: '#38bdf8' },
];

/** Our defense's lines (blitzes, coverage) carry their own color; the offense's don't. */
const isDefenseStroke = (s: PlayStroke) => Boolean(s.color || s.zone || s.man);
// Seconds for the whole play (motion, snap and the play) at full speed.
const PLAY_SECONDS = 3.2;
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
const notLinedUp = (q: HomographyQuad) => STOCK.includes(JSON.stringify(q));
/** Film starts from behind the offense: the line of scrimmage across the picture, the offense below it. */
const FILM_START = HOMOGRAPHY_PRESETS.endzone.quad;
/**
 * The lineup a quarter turn clockwise about its middle, on a 16:9 picture (for film shot from another angle).
 */
function rotateQuad(q: HomographyQuad): HomographyQuad {
  const A = 16 / 9;
  const all = [q.losLeft, q.losRight, q.backLeft, q.backRight];
  const cu = all.reduce((s, p) => s + p.u, 0) / 4, cv = all.reduce((s, p) => s + p.v, 0) / 4;
  const turn = (p: ImagePoint): ImagePoint => {
    const x = (p.u - cu) * A, y = p.v - cv;
    return { u: Math.round((cu - y / A) * 1000) / 1000, v: Math.round((cv + x) * 1000) / 1000 };
  };
  return { ...q, losLeft: turn(q.losLeft), losRight: turn(q.losRight), backLeft: turn(q.backLeft), backRight: turn(q.backRight), preset: 'custom' };
}

/**
 * Play lines for a film player: on / off, "Run play" (the motion, the snap and everyone along their lines on the
 * paused frame), "Line up field" (the yard lines and 4 corners to drag onto the film) and the defense. The field's
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
}): PlayLinesControl {
  const { lines, video, filmKey, onTurnOn, waiting } = opts;
  const [on, setOn] = useState(false);
  const [lineUp, setLineUp] = useState(false);
  const [defense, setDefense] = useState(false);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [slow, setSlow] = useState(false);
  const lineupKey = `mahopac_film_lineup_${filmKey}`;

  // A play not lined up yet: the last lineup on this film, else the line of scrimmage across the picture.
  useEffect(() => {
    if (!on || !lines || !notLinedUp(lines.quad)) return;
    const saved = safeJSONParse<HomographyQuad | null>(lineupKey, null);
    const next = saved && !notLinedUp(saved) ? saved : FILM_START;
    if (JSON.stringify(next) !== JSON.stringify(lines.quad)) lines.setQuad(next);
  }, [on, lines, lineupKey]);

  // Run play: 0 -> 1 over the play's length, then it stays on the last frame.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        const next = Math.min(1, p + (dt * (slow ? 0.5 : 1)) / PLAY_SECONDS);
        if (next >= 1) setRunning(false);
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, slow]);
  // Another play: back to the start.
  useEffect(() => {
    setRunning(false);
    setProgress(0);
  }, [lines?.name]);

  const shown = lines && { ...lines, setQuad: (q: HomographyQuad) => (lines.setQuad(q), safeJSONSet(lineupKey, q)) };
  const frame = useMemo(
    () => (lines ? computeAnimatedPlayFrame(lines.nodes, lines.strokes, [], lines.ballRole, progress) : null),
    [lines, progress]
  );
  const moving = progress > 0.002;
  const btn = 'h-8 px-2.5 rounded-lg text-xs font-bold cursor-pointer';

  return {
    on,
    toggle: () => {
      if (!on) onTurnOn?.();
      setOn((v) => !v);
    },
    layer: ({ playing, zoom }) =>
      shown && frame && !playing ? <LinesDrawing video={video} lines={shown} frame={moving ? frame : null} defense={defense} lineUp={lineUp} zoom={zoom} /> : null,
    controls: ({ playing }) => (
      <div className="absolute right-2 top-11 z-20 flex flex-col items-end gap-1.5 pointer-events-auto" {...keep}>
        <div className="flex flex-wrap justify-end gap-1 p-1 rounded-xl" style={panel}>
          <span className="h-8 px-2 inline-flex items-center text-xs font-black truncate max-w-[12rem]" title={lines?.name}>
            {lines?.name || 'Play lines'}
          </span>
          {lines && (
            <>
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
              <button type="button" className={`${btn} ${slow ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`} onClick={() => setSlow((s) => !s)} title="Half speed">
                ½×
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
              <button type="button" className={`${btn} ${lineUp ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`} onClick={() => setLineUp((v) => !v)} title="Show the yard lines and drag the corners to fit the field on the film">
                Line up field
              </button>
              {lineUp && (
                <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => shown?.setQuad(rotateQuad(shown.quad))} title="Turn the lineup a quarter turn (film shot from another angle)">
                  ⟳ Rotate
                </button>
              )}
              <button type="button" className={`${btn} ${defense ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`} onClick={() => setDefense((v) => !v)}>
                Defense
              </button>
            </>
          )}
          <button type="button" className={`${btn} hover:bg-white/10`} onClick={() => setOn(false)} aria-label="Hide play lines">
            ✕
          </button>
        </div>
        {!lines && (
          <div className="max-w-xs rounded-lg px-2.5 py-1.5 text-[11px] leading-snug" style={panel}>
            {waiting}
          </div>
        )}
        {lines && lineUp && !playing && (
          <div className="max-w-xs rounded-lg px-2.5 py-1.5 text-[11px] leading-snug" style={panel}>
            Drag the <b style={{ color: '#f59e0b' }}>orange</b> dots onto the line of scrimmage and the <b style={{ color: '#38bdf8' }}>blue</b> dots 5 yards behind it, until the orange line sits on the ball. The middle handle moves it all; Rotate turns it a quarter turn. Saved with this play; the next play on this film starts from it.
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
      </div>
    ),
  };
}

type Pt = { x: number; y: number };
type Px = readonly [number, number];

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
const pathOf = (pts: Px[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
/** Pre-snap motion: a zigzag along the points, on screen (like the builder's). */
function zigzag(pts: Px[], amp: number, step: number) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  let side = 1;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.round(len / step));
    const ux = (bx - ax) / (len || 1), uy = (by - ay) / (len || 1);
    for (let k = 1; k < n; k++) {
      const t = (len * k) / n;
      d += ` L${(ax + ux * t - uy * amp * side).toFixed(1)} ${(ay + uy * t + ux * amp * side).toFixed(1)}`;
      side = -side;
    }
    d += ` L${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  return d;
}
/** The end of a line: an arrowhead, or a T for a block (from a to b). */
function arrowHead([ax, ay]: Px, [bx, by]: Px, l: number) {
  const ang = Math.atan2(by - ay, bx - ax);
  return `${bx},${by} ${bx - l * Math.cos(ang - 0.45)},${by - l * Math.sin(ang - 0.45)} ${bx - l * Math.cos(ang + 0.45)},${by - l * Math.sin(ang + 0.45)}`;
}
function tBar([ax, ay]: Px, [bx, by]: Px, w: number) {
  const ang = Math.atan2(by - ay, bx - ax);
  return `M${bx + w * Math.cos(ang + Math.PI / 2)} ${by + w * Math.sin(ang + Math.PI / 2)}L${bx + w * Math.cos(ang - Math.PI / 2)} ${by + w * Math.sin(ang - Math.PI / 2)}`;
}
/** The last real step of a line (skipping repeats), for its arrow. */
const lastStep = (pts: Px[]): [Px, Px] => {
  const b = pts[pts.length - 1];
  for (let i = pts.length - 2; i >= 0; i--) if (Math.hypot(pts[i][0] - b[0], pts[i][1] - b[1]) > 0.5) return [pts[i], b];
  return [pts[0], b];
};

/**
 * The play's players and lines drawn on the film through the field's 4-corner lineup, the way the play builder
 * draws them: the same colors, curves, motion zigzag, blocks, zones and man rings, and the same player marks. It sits
 * inside the player's zoom, so it stays on the field; sizes are divided by the zoom, so they keep their size on screen.
 */
const LinesDrawing: React.FC<{
  video: () => HTMLVideoElement | null;
  lines: VideoLines;
  /** The play running (null: the lineup before the snap). */
  frame: ReturnType<typeof computeAnimatedPlayFrame> | null;
  defense: boolean;
  lineUp: boolean;
  zoom: number;
}> = ({ video, lines, frame, defense, lineUp, zoom }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState(16 / 9);
  const drag = useRef<{ corner: Corner | 'all'; from: ImagePoint; quad: HomographyQuad } | null>(null);

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
    v.addEventListener('loadedmetadata', read);
    return () => v.removeEventListener('loadedmetadata', read);
  }, [video]);
  let cw = box.w, ch = box.w / aspect;
  if (ch > box.h) {
    ch = box.h;
    cw = box.h * aspect;
  }
  const left = (box.w - cw) / 2, top = (box.h - ch) / 2;

  const { quad } = lines;
  const z = Math.max(1, zoom);
  const px = (p: Pt): Px => {
    const uv = fieldToImage(quad, p);
    return [uv.u * cw, uv.v * ch];
  };
  // One builder picture unit on screen: the builder's sizes (an 11-unit player, a 2.8-unit line) times this.
  const k = Math.max(0.6, ch * 0.0019) / z;
  const handle = Math.max(9, ch * 0.02) / z;
  const moving = Boolean(frame);
  const shownNodes = (frame ? frame.nodes : lines.nodes).filter((n) => defense || !isDefenseRole(n.role));
  const shownStrokes = lines.strokes.filter((s) => s.points?.length >= 2 && (defense || !isDefenseStroke(s)));
  // A white edge under each line, so the builder's colors read on the film.
  const halo = (d: string, w: number, key?: string) => <path key={key} d={d} fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth={w + 2.6 * k} strokeLinecap="round" strokeLinejoin="round" />;

  const toUV = (e: React.PointerEvent): ImagePoint | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return { u: (e.clientX - rect.left) / rect.width, v: (e.clientY - rect.top) / rect.height };
  };
  const startDrag = (corner: Corner | 'all') => (e: React.PointerEvent) => {
    e.stopPropagation();
    const from = toUV(e);
    if (!from) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { corner, from, quad };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const at = toUV(e);
    if (!at) return;
    const clamp = (n: number) => Math.round(Math.max(-0.2, Math.min(1.2, n)) * 1000) / 1000;
    if (d.corner === 'all') {
      const du = at.u - d.from.u, dv = at.v - d.from.v;
      const move = (p: ImagePoint) => ({ u: clamp(p.u + du), v: clamp(p.v + dv) });
      lines.setQuad({ ...d.quad, losLeft: move(d.quad.losLeft), losRight: move(d.quad.losRight), backLeft: move(d.quad.backLeft), backRight: move(d.quad.backRight), preset: 'custom' });
    } else lines.setQuad({ ...d.quad, [d.corner]: { u: clamp(at.u), v: clamp(at.v) }, preset: 'custom' });
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = null;
  };
  const mid = (a: ImagePoint, b: ImagePoint) => ({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 });
  const center = mid(mid(quad.losLeft, quad.losRight), mid(quad.backLeft, quad.backRight));

  /** One line as the builder draws it (see strokePaths), on the film. */
  const strokeEl = (s: PlayStroke, i: number) => {
    const m = Math.min(Math.max(0, Math.round(Number(s.motion) || 0)), s.points.length - 1);
    const motionPts = m > 0 ? s.points.slice(0, m + 1).map(px) : [];
    const main = s.points.slice(m);
    const mainPts = main.length >= 2 ? shapedPoints(main, (j) => Boolean(s.curve || main[j]?.smooth)).map(px) : [];
    const color = s.color || STROKE_COLOR[s.kind];
    const w = (s.kind === 'block' ? 2.6 : 2.8) * k;
    const endPts = mainPts.length >= 2 ? mainPts : motionPts;
    const [a, b] = endPts.length >= 2 ? lastStep(endPts) : [null, null];
    const last = s.points[s.points.length - 1];
    // A zone: an oval of the drawn size around the end of the line, laid on the field.
    const zone =
      s.zone && last
        ? pathOf(Array.from({ length: 33 }, (_, j) => px({ x: last.x + s.zone!.rx * Math.cos((j / 32) * 2 * Math.PI), y: last.y + s.zone!.ry * Math.sin((j / 32) * 2 * Math.PI) }))) + 'Z'
        : '';
    if (s.man && mainPts.length >= 2) {
      const [mx, my] = px(s.man);
      return (
        <g key={i}>
          <circle cx={mx} cy={my} r={17 * k} fill="none" stroke={color} strokeWidth={2.2 * k} />
          <path d={pathOf(mainPts)} fill="none" stroke={color} strokeWidth={2.6 * k} strokeLinecap="round" strokeDasharray={`${0.1 * k} ${6 * k}`} />
        </g>
      );
    }
    return (
      <g key={i}>
        {zone && <path d={zone} fill={color} fillOpacity="0.15" stroke={color} strokeOpacity="0.6" strokeWidth={1.2 * k} />}
        {motionPts.length >= 2 && (
          <>
            {halo(zigzag(motionPts, 4 * k, 7 * k), 2.2 * k)}
            <path d={zigzag(motionPts, 4 * k, 7 * k)} fill="none" stroke={MOTION_COLOR} strokeWidth={2.2 * k} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {mainPts.length >= 2 && (
          <>
            {halo(pathOf(mainPts), w)}
            <path d={pathOf(mainPts)} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.kind === 'pass' ? `${5 * k} ${4 * k}` : undefined} />
          </>
        )}
        {a && b && (mainPts.length >= 2 && s.kind === 'block' ? (
          <>
            {halo(tBar(a, b, 7 * k), 2.4 * k)}
            <path d={tBar(a, b, 7 * k)} stroke={color} strokeWidth={2.4 * k} strokeLinecap="round" />
          </>
        ) : (
          <polygon points={arrowHead(a, b, 8 * k)} fill={mainPts.length >= 2 ? color : MOTION_COLOR} stroke="#ffffff" strokeOpacity="0.8" strokeWidth={1 * k} />
        ))}
      </g>
    );
  };

  /** A player as the builder marks him: our defense a green box, the center a square, the rest circles. */
  const nodeEl = (n: PlayNode) => {
    const [cx, cy] = px(n);
    const font = 'system-ui, -apple-system, sans-serif';
    const custom = n.label?.trim();
    const fit = (text: string, base: number, room: number) => Math.min(base, room / Math.max(1, text.length * 0.62));
    if (isDefenseRole(n.role)) {
      const text = shownText(n, diagramLabel(n.role));
      const bw = Math.max(23, text.length * 7 + 8) * k;
      return (
        <g key={n.role}>
          <rect x={cx - bw / 2} y={cy - 10.5 * k} width={bw} height={20 * k} rx={4 * k} fill={DEFENSE_COLOR} stroke="#ffffff" strokeWidth={1.8 * k} />
          <text x={cx} y={cy + 3.6 * k} textAnchor="middle" fill="#ffffff" fontSize={10.5 * k} fontFamily={font} fontWeight={900}>
            {text}
          </text>
        </g>
      );
    }
    if (n.role === 'C') {
      const text = custom || 'C';
      const bw = Math.max(18, text.length * 6.5 + 6) * k;
      return (
        <g key={n.role}>
          <rect x={cx - bw / 2} y={cy - 9 * k} width={bw} height={18 * k} rx={3 * k} fill="#ffffff" stroke="#0f172a" strokeWidth={2 * k} />
          <text x={cx} y={cy + 4 * k} textAnchor="middle" fill="#0f172a" fontSize={10 * k} fontFamily={font} fontWeight={900}>
            {text}
          </text>
        </g>
      );
    }
    const skill = skillDiagramLabel(n.role);
    const isBack = !skill && !(n.line || !/^[1-4]$/.test(n.role));
    const isBall = (skill || isBack) && n.role === lines.ballRole;
    const r = (skill || isBack ? 11 : 10) * k;
    const text = custom || (skill ? skill : isBack ? diagramLabel(n.role) : n.role.replace(/^O_?/, '').slice(0, 2));
    const size = fit(text, (skill ? 9 : isBack ? 12 : 7.5) * k, r * 2);
    return (
      <g key={n.role}>
        {isBall && <circle cx={cx} cy={cy} r={14 * k} fill="none" stroke="#fb923c" strokeWidth={2.5 * k} strokeOpacity="0.85" />}
        <circle cx={cx} cy={cy} r={r} fill={isBall ? '#ea580c' : '#ffffff'} stroke={isBall ? '#ffffff' : '#0f172a'} strokeWidth={(isBall ? 2.4 : 1.8) * k} />
        <text x={cx} y={cy + size * 0.36} textAnchor="middle" fill={isBall ? '#ffffff' : '#0f172a'} fontSize={size} fontFamily={font} fontWeight={900}>
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
          {...(lineUp ? { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onClick: (e: React.MouseEvent) => e.stopPropagation() } : {})}
        >
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
          {/* The play's lines; faded while it runs, with each player's trail drawn on top. */}
          <g opacity={moving ? 0.35 : 1}>{shownStrokes.map(strokeEl)}</g>
          {frame?.trails
            .filter((t) => t.points.length >= 2 && (defense || !isDefenseRole(t.role)))
            .map((t, i) => {
              const pts = t.points.map(px);
              const [a, b] = lastStep(pts);
              return (
                <g key={`t${i}`}>
                  {halo(pathOf(pts), 2.8 * k)}
                  <path d={pathOf(pts)} fill="none" stroke={t.color} strokeWidth={2.8 * k} strokeLinecap="round" strokeLinejoin="round" />
                  <polygon points={arrowHead(a, b, 8 * k)} fill={t.color} />
                </g>
              );
            })}
          {shownNodes.map(nodeEl)}
          {frame && <circle cx={px(frame.ball)[0]} cy={px(frame.ball)[1]} r={5 * k} fill="#92400e" stroke="#fff" strokeWidth={1.5 * k} />}
          {lineUp && (
            <>
              {CORNERS.map(({ key, color }) => (
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
