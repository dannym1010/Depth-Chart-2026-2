import React from 'react';
import type { ShotZoneStat } from '../basketballAnalytics';
import type { ShotZone } from '../types';

interface HalfCourtSvgProps {
  /** Interactive picker mode (Film Room tagging) vs Heat Map mode (Scout view). */
  mode: 'picker' | 'heatmap';
  selectedZone?: ShotZone;
  onSelectZone?: (zone: ShotZone) => void;
  zoneStats?: ShotZoneStat[];
  compact?: boolean;
}

interface ZoneRegion {
  zone: ShotZone;
  shortLabel: string;
  path: string;
  labelX: number;
  labelY: number;
}

/** Clean architectural court geometry inside a 320x280 viewBox (hoop at (160, 42)). */
const ZONE_REGIONS: ZoneRegion[] = [
  {
    zone: 'rim',
    shortLabel: 'RIM',
    path: 'M 134,26 A 26,26 0 0,0 186,26 L 186,58 A 26,26 0 0,1 134,58 Z',
    labelX: 160,
    labelY: 45,
  },
  {
    zone: 'paint',
    shortLabel: 'PAINT',
    path: 'M 114,20 L 206,20 L 206,120 L 114,120 Z',
    labelX: 160,
    labelY: 96,
  },
  {
    zone: 'corner_3_left',
    shortLabel: 'L C3',
    path: 'M 12,16 L 48,16 L 48,88 L 12,88 Z',
    labelX: 30,
    labelY: 54,
  },
  {
    zone: 'corner_3_right',
    shortLabel: 'R C3',
    path: 'M 272,16 L 308,16 L 308,88 L 272,88 Z',
    labelX: 290,
    labelY: 54,
  },
  {
    zone: 'mid_left',
    shortLabel: 'L MID',
    path: 'M 48,16 L 114,16 L 114,132 L 56,112 Z',
    labelX: 82,
    labelY: 74,
  },
  {
    zone: 'mid_right',
    shortLabel: 'R MID',
    path: 'M 206,16 L 272,16 L 264,112 L 206,132 Z',
    labelX: 238,
    labelY: 74,
  },
  {
    zone: 'mid_center',
    shortLabel: 'HI POST',
    path: 'M 114,120 L 206,120 L 206,174 L 114,174 Z',
    labelX: 160,
    labelY: 150,
  },
  {
    zone: 'wing_3_left',
    shortLabel: 'L WING 3',
    path: 'M 12,88 L 56,112 L 106,192 L 32,226 L 12,168 Z',
    labelX: 52,
    labelY: 164,
  },
  {
    zone: 'wing_3_right',
    shortLabel: 'R WING 3',
    path: 'M 308,88 L 308,168 L 288,226 L 214,192 L 264,112 Z',
    labelX: 268,
    labelY: 164,
  },
  {
    zone: 'top_3',
    shortLabel: 'TOP 3',
    path: 'M 106,174 L 214,174 L 246,244 L 74,244 Z',
    labelX: 160,
    labelY: 214,
  },
];

function heatColor(stat?: ShotZoneStat): string {
  if (!stat || stat.att === 0) return 'rgba(113, 113, 122, 0.12)';
  if (stat.ppp >= 1.25 || stat.pct >= 55) return 'rgba(16, 185, 129, 0.34)'; // hot emerald
  if (stat.ppp >= 0.9 || stat.pct >= 38) return 'rgba(245, 158, 11, 0.34)'; // amber warm
  return 'rgba(244, 63, 94, 0.28)'; // cold rose
}

function heatStroke(stat?: ShotZoneStat): string {
  if (!stat || stat.att === 0) return 'rgba(161, 161, 170, 0.35)';
  if (stat.ppp >= 1.25 || stat.pct >= 55) return '#10b981';
  if (stat.ppp >= 0.9 || stat.pct >= 38) return '#f59e0b';
  return '#f43f5e';
}

export const HalfCourtSvg: React.FC<HalfCourtSvgProps> = ({
  mode,
  selectedZone,
  onSelectZone,
  zoneStats = [],
  compact = false,
}) => {
  const statsMap = new Map<ShotZone, ShotZoneStat>(zoneStats.map((s) => [s.zone, s]));

  // Render paint before rim so rim sits cleanly on top
  const ordered = [
    ...ZONE_REGIONS.filter((r) => r.zone !== 'rim'),
    ...ZONE_REGIONS.filter((r) => r.zone === 'rim'),
  ];

  return (
    <svg
      viewBox="0 0 320 265"
      className={`w-full select-none ${compact ? 'max-w-[270px]' : 'max-w-[440px]'} mx-auto`}
      role="img"
      aria-label="Basketball half-court shot zones"
    >
      {/* Outer court boundary */}
      <rect
        x="10"
        y="14"
        width="300"
        height="240"
        rx="6"
        className="fill-zinc-100/70 dark:fill-zinc-900/90 stroke-zinc-300 dark:stroke-zinc-700"
        strokeWidth="1.5"
      />

      {/* Interactive shot zone regions */}
      {ordered.map((r) => {
        const stat = statsMap.get(r.zone);
        const isSelected = selectedZone === r.zone;
        const fill =
          mode === 'picker'
            ? isSelected
              ? 'rgba(245, 158, 11, 0.42)'
              : 'rgba(161, 161, 170, 0.08)'
            : isSelected
            ? 'rgba(245, 158, 11, 0.5)'
            : heatColor(stat);
        const stroke = isSelected
          ? '#f59e0b'
          : mode === 'heatmap'
          ? heatStroke(stat)
          : 'rgba(161, 161, 170, 0.35)';

        return (
          <g
            key={r.zone}
            onClick={() => onSelectZone && onSelectZone(r.zone)}
            className={onSelectZone ? 'cursor-pointer transition-opacity hover:opacity-90' : ''}
          >
            <path
              d={r.path}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? '2.2' : '1.2'}
            />
          </g>
        );
      })}

      {/* Architectural court lines overlay (non-blocking pointer events) */}
      <g className="pointer-events-none stroke-zinc-400/75 dark:stroke-zinc-500/75" fill="none" strokeWidth="1.4">
        {/* Key / Lane */}
        <rect x="114" y="14" width="92" height="106" />
        {/* Free throw circle */}
        <circle cx="160" cy="120" r="36" />
        {/* 3PT Arc */}
        <line x1="48" y1="14" x2="48" y2="88" />
        <line x1="272" y1="14" x2="272" y2="88" />
        <path d="M 48,88 A 126,126 0 0,0 272,88" />
        {/* Backboard & Hoop */}
        <line x1="142" y1="24" x2="178" y2="24" strokeWidth="2.2" />
        <circle cx="160" cy="34" r="6" stroke="#f59e0b" strokeWidth="2" />
      </g>

      {/* Labels */}
      {ordered.map((r) => {
        const stat = statsMap.get(r.zone);
        const isSelected = selectedZone === r.zone;
        return (
          <g key={`${r.zone}-lbl`} className="pointer-events-none text-center">
            <text
              x={r.labelX}
              y={mode === 'heatmap' && stat && stat.att > 0 ? r.labelY - 5 : r.labelY + 3}
              textAnchor="middle"
              className={`text-[9px] font-bold tracking-wider ${
                isSelected ? 'fill-amber-600 dark:fill-amber-300' : 'fill-zinc-600 dark:fill-zinc-300'
              }`}
            >
              {r.shortLabel}
            </text>
            {mode === 'heatmap' && stat && stat.att > 0 && (
              <text
                x={r.labelX}
                y={r.labelY + 8}
                textAnchor="middle"
                className="text-[10px] font-extrabold fill-zinc-900 dark:fill-white"
              >
                {stat.made}/{stat.att} ({stat.pct}%)
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
