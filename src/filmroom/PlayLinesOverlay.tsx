import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildProjectedFieldGrid, fieldToImage, type HomographyQuad, type ImagePoint } from '../utils/videoHomography';
import { diagramLabel, isDefenseRole, type PlayNode, type PlayStroke } from '../utils/footballEngine';
import { computeAnimatedPlayFrame } from '../utils/playAnimation';

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

interface Props {
  video: () => HTMLVideoElement | null;
  lines: VideoLines;
  /** The video is playing: the lines step aside (they're drawn for the frame it's paused on). */
  playing: boolean;
  onClose: () => void;
}

type Corner = 'losLeft' | 'losRight' | 'backLeft' | 'backRight';
const CORNERS: { key: Corner; color: string }[] = [
  { key: 'losLeft', color: '#f59e0b' },
  { key: 'losRight', color: '#f59e0b' },
  { key: 'backLeft', color: '#38bdf8' },
  { key: 'backRight', color: '#38bdf8' },
];

const strokeColor = (s: { kind: string; color?: string }) =>
  s.color || (s.kind === 'motion' ? MOTION : s.kind === 'run' ? '#ef4444' : s.kind === 'pass' ? '#facc15' : '#cbd5e1');
// Pre-snap motion: brighter than the builder's purple, to show on film.
const MOTION = '#c084fc';
/** Our defense's lines (blitzes, coverage) carry their own color; the offense's don't. */
const isDefenseStroke = (s: PlayStroke) => Boolean(s.color || s.zone || s.man);
const OL = ['LT', 'LG', 'C', 'RG', 'RT'];
// Seconds for the whole play (motion, snap and the play) at full speed.
const PLAY_SECONDS = 3.2;
// Stops the stage under the lines from taking the press as play / pause or a pan.
const keep = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onPointerUp: (e: React.PointerEvent) => e.stopPropagation(),
  onClick: (e: React.MouseEvent) => e.stopPropagation(),
  onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
};

/**
 * The play's players and lines (runs, routes, blocks, motion) drawn on the paused film, through the field's
 * 4-corner lineup. "Run play" plays the motion, the snap and everyone along their lines on the frame;
 * "Line up field" shows the yard lines and the 4 corners to drag onto the film.
 */
export const PlayLinesOverlay: React.FC<Props> = ({ video, lines, playing, onClose }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState(16 / 9);
  const [lineUp, setLineUp] = useState(false);
  const [defense, setDefense] = useState(false);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [slow, setSlow] = useState(false);
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
  }, [lines.name]);

  const { quad } = lines;
  const frame = useMemo(() => computeAnimatedPlayFrame(lines.nodes, lines.strokes, [], lines.ballRole, progress), [lines.nodes, lines.strokes, lines.ballRole, progress]);
  const moving = progress > 0.002;
  const px = (p: { x: number; y: number }) => {
    const uv = fieldToImage(quad, p);
    return [uv.u * cw, uv.v * ch] as const;
  };
  const r = Math.max(7, ch * 0.022);
  const width = Math.max(2, ch * 0.0065);
  const shownNodes = (moving ? frame.nodes : lines.nodes).filter((n) => defense || !isDefenseRole(n.role));
  const shownStrokes = lines.strokes.filter((s) => s.points?.length >= 2 && (defense || !isDefenseStroke(s)));
  const colors = [...new Set([MOTION, ...shownStrokes.map(strokeColor), ...frame.trails.map((t) => t.color)])];
  const markerId = (c: string) => `pl-arrow-${colors.indexOf(c)}`;

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

  const line = (pts: (readonly [number, number])[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const mid = (a: ImagePoint, b: ImagePoint) => ({ u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 });
  const center = mid(mid(quad.losLeft, quad.losRight), mid(quad.backLeft, quad.backRight));
  const btn = 'h-8 px-2.5 rounded-lg text-xs font-bold cursor-pointer';

  return (
    <div ref={boxRef} className="absolute inset-0 z-10 pointer-events-none">
      {!playing && cw > 0 && (
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
          <defs>
            {colors.map((c) => (
              <marker key={c} id={markerId(c)} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill={c} />
              </marker>
            ))}
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
                strokeWidth={g.kind === 'los' ? 2.5 : 1}
                strokeDasharray={g.kind === 'los' ? undefined : '4 4'}
              />
            ))}
          {/* The play's lines; faded while it runs, with each player's trail drawn on top. */}
          <g opacity={moving ? 0.35 : 1}>
            {shownStrokes.map((s, i) => {
              const all = s.points.map(px);
              // Pre-snap motion first (its own color, dashed), then the play from where the motion ends.
              const m = s.motion && s.motion > 0 ? Math.min(s.motion, all.length - 1) : 0;
              const motionPts = m ? all.slice(0, m + 1) : [];
              const pts = m ? all.slice(m) : all;
              const c = strokeColor(s);
              const dashed = s.kind === 'pass';
              const block = s.kind === 'block';
              return (
                <g key={i}>
                  {motionPts.length >= 2 && (
                    <>
                      <path d={line(motionPts)} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth={width + 3} strokeLinecap="round" strokeLinejoin="round" />
                      <path d={line(motionPts)} fill="none" stroke={MOTION} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${width * 2} ${width * 1.5}`} />
                    </>
                  )}
                  {pts.length >= 2 && <path d={line(pts)} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth={width + 3} strokeLinecap="round" strokeLinejoin="round" />}
                  {pts.length >= 2 && <path
                    d={line(pts)}
                    fill="none"
                    stroke={c}
                    strokeWidth={width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={dashed ? `${width * 3} ${width * 2}` : undefined}
                    markerEnd={block ? undefined : `url(#${markerId(c)})`}
                  />}
                  {block && pts.length >= 2 && (() => {
                    // A block ends in a T.
                    const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[pts.length - 2];
                    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
                    const [nx, ny] = [(-(y2 - y1) / len) * r * 0.8, ((x2 - x1) / len) * r * 0.8];
                    return <path d={`M${x2 - nx} ${y2 - ny}L${x2 + nx} ${y2 + ny}`} stroke={c} strokeWidth={width} strokeLinecap="round" />;
                  })()}
                </g>
              );
            })}
          </g>
          {moving &&
            frame.trails
              .filter((t) => t.points.length >= 2 && (defense || !isDefenseRole(t.role)))
              .map((t, i) => (
                <path key={i} d={line(t.points.map(px))} fill="none" stroke={t.color} strokeWidth={width} strokeLinecap="round" markerEnd={`url(#${markerId(t.color)})`} />
              ))}
          {shownNodes.map((n) => {
            const [x, y] = px(n);
            const def = isDefenseRole(n.role);
            return (
              <g key={n.role}>
                <circle cx={x} cy={y} r={r} fill={def ? 'rgba(220,38,38,0.85)' : OL.includes(n.role) ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.92)'} stroke={def ? '#fff' : '#0f172a'} strokeWidth={Math.max(1.5, r * 0.18)} />
                <text x={x} y={y + r * 0.38} textAnchor="middle" fontSize={r * 1.05} fontWeight={800} fontFamily="Barlow Condensed, Arial Narrow, Arial, sans-serif" fill={def || OL.includes(n.role) ? '#fff' : '#0f172a'}>
                  {(n.label || diagramLabel(n.role)).slice(0, 3)}
                </text>
              </g>
            );
          })}
          {moving && (
            <circle
              cx={px(frame.ball)[0]}
              cy={px(frame.ball)[1]}
              r={r * 0.45}
              fill="#92400e"
              stroke="#fff"
              strokeWidth={1.5}
            />
          )}
          {lineUp && (
            <>
              {CORNERS.map(({ key, color }) => (
                <circle
                  key={key}
                  cx={quad[key].u * cw}
                  cy={quad[key].v * ch}
                  r={Math.max(9, r * 0.9)}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={2.5}
                  style={{ cursor: 'grab', pointerEvents: 'auto' }}
                  onPointerDown={startDrag(key)}
                />
              ))}
              <g style={{ cursor: 'move', pointerEvents: 'auto' }} onPointerDown={startDrag('all')}>
                <circle cx={center.u * cw} cy={center.v * ch} r={Math.max(11, r)} fill="rgba(15,23,42,0.75)" stroke="#fff" strokeWidth={2} />
                <path
                  d={`M${center.u * cw - 6} ${center.v * ch}h12M${center.u * cw} ${center.v * ch - 6}v12`}
                  stroke="#fff"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </g>
            </>
          )}
        </svg>
      )}
      {/* The controls: top right of the picture, out of the way of the player's own. */}
      <div className="absolute right-2 top-11 flex flex-col items-end gap-1.5 pointer-events-auto" {...keep}>
        <div className="flex flex-wrap justify-end gap-1 p-1 rounded-xl" style={{ background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' }}>
          <span className="h-8 px-2 inline-flex items-center text-xs font-black truncate max-w-[12rem]" title={lines.name}>
            {lines.name}
          </span>
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
          <button type="button" className={`${btn} ${defense ? 'bg-indigo-600 text-white' : 'hover:bg-white/10'}`} onClick={() => setDefense((v) => !v)}>
            Defense
          </button>
          <button type="button" className={`${btn} hover:bg-white/10`} onClick={onClose} aria-label="Hide play lines">
            ✕
          </button>
        </div>
        {lineUp && !playing && (
          <div className="max-w-xs rounded-lg px-2.5 py-1.5 text-[11px] leading-snug" style={{ background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' }}>
            Drag the <b style={{ color: '#f59e0b' }}>orange</b> dots onto the line of scrimmage and the <b style={{ color: '#38bdf8' }}>blue</b> dots 5 yards behind it, until the orange line sits on the ball. The middle handle moves it all. Saved with this play; the next play on this film starts from it.
          </div>
        )}
        {playing && (
          <div className="rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' }}>
            Pause the video to see the play's lines.
          </div>
        )}
        {moving && !playing && (
          <div className="rounded-lg px-2.5 py-1 text-[11px] font-bold" style={{ background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' }}>
            {frame.phaseLabel}
          </div>
        )}
      </div>
    </div>
  );
};
