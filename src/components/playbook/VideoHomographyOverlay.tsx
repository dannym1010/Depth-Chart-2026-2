import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildProjectedFieldGrid,
  DEFAULT_HOMOGRAPHY_QUAD,
  fieldToImage,
  flipHomographyOffenseDefense,
  HOMOGRAPHY_PRESETS,
  imageToField,
  type HomographyQuad,
  type ImagePoint,
} from '../../utils/videoHomography';
import {
  diagramLabel,
  isDefenseRole,
  type PlayNode,
  type PlayStroke,
} from '../../utils/footballEngine';

interface VideoHomographyOverlayProps {
  /** Getter for the active HTMLVideoElement in Film Player */
  getVideo?: () => HTMLVideoElement | null;
  /** Pre-captured frame data URL (e.g. from AI Auto-Sketch) */
  initialFrameUrl?: string | null;
  /** Current 4-corner perspective homography quad */
  quad: HomographyQuad;
  /** Update the homography quad */
  onChangeQuad: (quad: HomographyQuad) => void;
  /** Offensive & defensive nodes from Play Builder */
  nodes: PlayNode[];
  /** Play strokes (run paths, pass routes, blocks, motion) from Play Builder */
  strokes: PlayStroke[];
  /** Ball carrier role */
  ballRole?: string;
  /** Called when the coach drags a player token on the video frame -> updates Play Builder (x, y) */
  onMoveNode: (role: string, x: number, y: number) => void;
  /** Trigger AI Vision Auto-Sketch from inside the calibrator */
  onRunAutoSketch?: () => void;
  autoSketchBusy?: boolean;
  onClose?: () => void;
}

type CornerKey = 'losLeft' | 'losRight' | 'backLeft' | 'backRight';

const CORNER_META: { key: CornerKey; label: string; sub: string; color: string }[] = [
  { key: 'losLeft', label: 'LOS L', sub: '(-12, 0)', color: '#f59e0b' },
  { key: 'losRight', label: 'LOS R', sub: '(+12, 0)', color: '#f59e0b' },
  { key: 'backLeft', label: 'Back L', sub: '(-12, -5yd)', color: '#38bdf8' },
  { key: 'backRight', label: 'Back R', sub: '(+12, -5yd)', color: '#38bdf8' },
];

export const VideoHomographyOverlay: React.FC<VideoHomographyOverlayProps> = ({
  getVideo,
  initialFrameUrl,
  quad,
  onChangeQuad,
  nodes,
  strokes,
  ballRole,
  onMoveNode,
  onRunAutoSketch,
  autoSketchBusy = false,
  onClose,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(initialFrameUrl || null);
  const [frameTime, setFrameTime] = useState<number | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<CornerKey | null>(null);
  const [draggingRole, setDraggingRole] = useState<string | null>(null);
  const [showDefense, setShowDefense] = useState<boolean>(true);
  const [showStrokes, setShowStrokes] = useState<boolean>(true);
  const [hoverFieldPt, setHoverFieldPt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (initialFrameUrl) {
      setFrameUrl(initialFrameUrl);
    }
  }, [initialFrameUrl]);

  const captureCurrentVideoFrame = useCallback(() => {
    const video = getVideo?.();
    if (!video || (!video.currentSrc && !video.src)) return;
    try {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const scale = Math.min(1, 1280 / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setFrameUrl(canvas.toDataURL('image/jpeg', 0.9));
        setFrameTime(Math.round(video.currentTime * 10) / 10);
      }
    } catch {
      // Cross-origin fallback: still render homography grid
    }
  }, [getVideo]);

  useEffect(() => {
    if (!frameUrl) {
      captureCurrentVideoFrame();
    }
  }, [frameUrl, captureCurrentVideoFrame]);

  const gridLines = useMemo(() => buildProjectedFieldGrid(quad), [quad]);

  const projectedNodes = useMemo(() => {
    return nodes
      .filter((n) => showDefense || !isDefenseRole(n.role))
      .map((n) => {
        const imgPt = fieldToImage(quad, { x: n.x, y: n.y });
        return {
          ...n,
          u: imgPt.u,
          v: imgPt.v,
          isDef: isDefenseRole(n.role),
          isOL: ['LT', 'LG', 'C', 'RG', 'RT'].includes(n.role),
        };
      });
  }, [nodes, quad, showDefense]);

  const projectedStrokes = useMemo(() => {
    if (!showStrokes) return [];
    return strokes
      .filter((s) => s.points && s.points.length >= 2)
      .map((s, idx) => {
        const pts = s.points.map((p) => fieldToImage(quad, p));
        return {
          id: `stroke_${idx}`,
          kind: s.kind,
          color: s.color || (s.motion ? '#38bdf8' : s.kind === 'run' ? '#ef4444' : s.kind === 'pass' ? '#f59e0b' : '#94a3b8'),
          dashed: Boolean(s.motion || s.kind === 'pass'),
          pts,
        };
      });
  }, [strokes, quad, showStrokes]);

  const clientToUV = useCallback((clientX: number, clientY: number): ImagePoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const u = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width));
    const v = Math.max(0.02, Math.min(0.98, (clientY - rect.top) / rect.height));
    return {
      u: Math.round(u * 1000) / 1000,
      v: Math.round(v * 1000) / 1000,
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const uv = clientToUV(e.clientX, e.clientY);
      if (!uv) return;
      const fieldPt = imageToField(quad, uv);
      setHoverFieldPt(fieldPt);

      if (draggingCorner) {
        onChangeQuad({
          ...quad,
          [draggingCorner]: uv,
          preset: 'custom',
        });
      } else if (draggingRole) {
        onMoveNode(draggingRole, fieldPt.x, fieldPt.y);
      }
    },
    [clientToUV, draggingCorner, draggingRole, onChangeQuad, onMoveNode, quad],
  );

  const handlePointerUp = useCallback(() => {
    setDraggingCorner(null);
    setDraggingRole(null);
  }, []);

  const W = 1000;
  const H = 562.5; // 16:9 normalized SVG viewport

  const quadPolyPoints = `${quad.losLeft.u * W},${quad.losLeft.v * H} ${quad.losRight.u * W},${quad.losRight.v * H} ${quad.backRight.u * W},${quad.backRight.v * H} ${quad.backLeft.u * W},${quad.backLeft.v * H}`;

  return (
    <div className="mb-3 rounded-xl border border-indigo-500/40 bg-slate-950/95 p-3 shadow-2xl">
      {/* Header & Controls */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/20 text-xs font-black text-indigo-300 border border-indigo-400/30">
            📐
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-200">
                3D Video Homography & Perspective Field Map
              </span>
              {frameTime !== null && (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                  Frame @ {frameTime.toFixed(1)}s
                </span>
              )}
              {hoverFieldPt && (
                <span className="rounded bg-indigo-950/80 border border-indigo-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-300">
                  Field: ({hoverFieldPt.x > 0 ? `+${hoverFieldPt.x}` : hoverFieldPt.x}yd,{' '}
                  {hoverFieldPt.y > 0 ? `+${hoverFieldPt.y}` : hoverFieldPt.y}yd)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Drag the <strong className="text-amber-300">4 Quad Handles</strong> to align the Line of Scrimmage &amp; yard lines with the camera angle, or <strong className="text-sky-300">drag any player token on the video</strong> to snap their 2D diagram spot via $H(u,v) \to (x,y)$.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChangeQuad(flipHomographyOffenseDefense(quad))}
            className="rounded-md border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[11px] font-extrabold text-amber-200 hover:bg-amber-500/35 cursor-pointer"
            title="If Offense and Defense are on opposite sides of the Line of Scrimmage on the video, click to swap them across the LOS"
          >
            ⇄ Swap Offense / Defense Side
          </button>
          {getVideo && (
            <button
              type="button"
              onClick={captureCurrentVideoFrame}
              className="rounded-md border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:border-sky-400/50 hover:text-white"
              title="Capture current paused frame from the Film Player"
            >
              📸 Grab Video Frame
            </button>
          )}
          {onRunAutoSketch && (
            <button
              type="button"
              onClick={onRunAutoSketch}
              disabled={autoSketchBusy}
              className="rounded-md border border-indigo-400/50 bg-indigo-600/30 px-2.5 py-1 text-[11px] font-extrabold text-indigo-100 hover:bg-indigo-600/50 disabled:opacity-50"
            >
              {autoSketchBusy ? '⏳ Mapping…' : '✨ Re-Run AI Vision'}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-white"
            >
              ✕ Hide
            </button>
          )}
        </div>
      </div>

      {/* Camera Perspective Presets & Layer Toggles */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Camera Angle:
          </span>
          {(
            ['sideline_l2r', 'sideline_r2l', 'endzone', 'pressbox_top_down'] as const
          ).map((presetKey) => {
            const p = HOMOGRAPHY_PRESETS[presetKey];
            const active = quad.preset === presetKey;
            return (
              <button
                key={presetKey}
                type="button"
                onClick={() => onChangeQuad({ ...p.quad })}
                className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title={p.description}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <label className="flex cursor-pointer items-center gap-1 text-slate-300">
            <input
              type="checkbox"
              checked={showDefense}
              onChange={(e) => setShowDefense(e.target.checked)}
              className="accent-rose-500"
            />
            <span>Defense</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1 text-slate-300">
            <input
              type="checkbox"
              checked={showStrokes}
              onChange={(e) => setShowStrokes(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Play Vectors</span>
          </label>
        </div>
      </div>

      {/* Interactive Perspective Video + Homography SVG Canvas */}
      <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full select-none touch-none"
          style={{ maxHeight: 380 }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <marker
              id="homography-arrow-run"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
            <marker
              id="homography-arrow-pass"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
            </marker>
            <marker
              id="homography-arrow-block"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Background Video Frame Snapshot or Synthetic Turf */}
          {frameUrl ? (
            <image
              href={frameUrl}
              x={0}
              y={0}
              width={W}
              height={H}
              preserveAspectRatio="none"
            />
          ) : (
            <rect x={0} y={0} width={W} height={H} fill="#062c1c" />
          )}

          {/* Subtle dark vignette for legibility */}
          <rect x={0} y={0} width={W} height={H} fill="rgba(2, 6, 23, 0.22)" />

          {/* Calibration Quad Translucent Fill */}
          <polygon
            points={quadPolyPoints}
            fill="rgba(56, 189, 248, 0.08)"
            stroke="rgba(56, 189, 248, 0.45)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />

          {/* 3D Projective Warped Football Field Grid Lines */}
          {gridLines.map((ln) => {
            const x1 = ln.p1.u * W;
            const y1 = ln.p1.v * H;
            const x2 = ln.p2.u * W;
            const y2 = ln.p2.v * H;
            const isLos = ln.kind === 'los';
            const isHash = ln.kind === 'hash';
            const isCenter = ln.kind === 'center_axis';
            return (
              <g key={ln.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={
                    isLos
                      ? '#f59e0b'
                      : isCenter
                        ? 'rgba(250, 204, 21, 0.55)'
                        : isHash
                          ? 'rgba(255, 255, 255, 0.35)'
                          : 'rgba(255, 255, 255, 0.28)'
                  }
                  strokeWidth={isLos ? 3 : isCenter ? 1.5 : 1.2}
                  strokeDasharray={
                    isHash ? '4 6' : isCenter ? '3 5' : undefined
                  }
                />
                {ln.label && (
                  <text
                    x={x1 + 8}
                    y={y1 - 4}
                    fill={isLos ? '#fde68a' : 'rgba(226, 232, 240, 0.85)'}
                    fontSize={isLos ? 12 : 10}
                    fontWeight={800}
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                  >
                    {ln.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Projected Post-Snap Play Vectors (Run / Pass / Block / Motion) */}
          {projectedStrokes.map((s) => {
            const d = s.pts
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.u * W} ${pt.v * H}`)
              .join(' ');
            const markerId =
              s.kind === 'run'
                ? 'url(#homography-arrow-run)'
                : s.kind === 'pass'
                  ? 'url(#homography-arrow-pass)'
                  : 'url(#homography-arrow-block)';
            return (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={3.2}
                strokeDasharray={s.dashed ? '6 4' : undefined}
                markerEnd={markerId}
                opacity={0.92}
              />
            );
          })}

          {/* Projected Offensive & Defensive Player Tokens (Draggable in Camera Space!) */}
          {projectedNodes.map((n) => {
            const cx = n.u * W;
            const cy = n.v * H;
            if (cx < -40 || cx > W + 40 || cy < -40 || cy > H + 40) return null;
            const isBall = ballRole === n.role;
            const isDragging = draggingRole === n.role;
            const lbl = diagramLabel(n.role);
            const fill = n.isDef
              ? '#e11d48'
              : isBall
                ? '#dc2626'
                : n.isOL
                  ? '#1e293b'
                  : '#2563eb';
            const stroke = isDragging
              ? '#fde047'
              : isBall
                ? '#fef08a'
                : '#ffffff';

            return (
              <g
                key={n.role}
                transform={`translate(${cx}, ${cy})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (!n.isOL) {
                    setDraggingRole(n.role);
                  }
                }}
                style={{ cursor: n.isOL ? 'default' : 'grab' }}
              >
                {/* Ground shadow / foot anchor */}
                <ellipse
                  cx={0}
                  cy={11}
                  rx={12}
                  ry={4.5}
                  fill="rgba(0,0,0,0.55)"
                />
                <circle
                  r={n.isOL ? 11 : 13}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isDragging ? 3 : 2}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize={n.isOL ? 9 : 10}
                  fontWeight={900}
                >
                  {lbl}
                </text>
              </g>
            );
          })}

          {/* 4 Draggable Perspective Calibration Quad Corner Handles */}
          {CORNER_META.map((c) => {
            const pt = quad[c.key];
            const cx = pt.u * W;
            const cy = pt.v * H;
            const active = draggingCorner === c.key;
            return (
              <g
                key={c.key}
                transform={`translate(${cx}, ${cy})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDraggingCorner(c.key);
                }}
                style={{ cursor: 'move' }}
              >
                <circle
                  r={active ? 14 : 11}
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke={c.color}
                  strokeWidth={active ? 3.5 : 2.5}
                />
                <circle r={4} fill={c.color} />
                <rect
                  x={-28}
                  y={-28}
                  width={56}
                  height={15}
                  rx={4}
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke={c.color}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={-18}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize={9}
                  fontWeight={800}
                >
                  {c.label}
                </text>
              </g>
            );
          })}
        </svg>

        {!frameUrl && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
            <span className="rounded-full bg-slate-950/85 px-3 py-1 text-[11px] font-semibold text-slate-300 border border-slate-700">
              Pause a video clip in the Film Player and click &ldquo;📸 Grab Video Frame&rdquo; to overlay directly on the film.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
