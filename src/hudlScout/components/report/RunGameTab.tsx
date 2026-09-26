import React from 'react';
import { Play, TendencyAnalysis } from '../../types/football';
import { RUN_COLOR, RunGapDiagram, RunPassRing } from '../ScoutCharts';
import { ReportVoice, isRunPlay, runSides, shareGreen, topNames } from './reportText';
import { Card, EmptyNote, SectionHeader } from './ui';

interface RunGameTabProps {
  analysis: TendencyAnalysis;
  plays: Play[];
  voice: ReportVoice;
}

type HashKey = 'left' | 'middle' | 'right';

/** Top-down look at the field from behind the offense: ball on the hash, arrows to each side. */
const HashField: React.FC<{ hash: HashKey; leftPct: number; insidePct: number; rightPct: number }> = ({ hash, leftPct, insidePct, rightPct }) => {
  const ballX = hash === 'left' ? 46 : hash === 'right' ? 94 : 70;
  const arrow = (x2: number, y2: number, pct: number, labelX: number, labelY: number, anchor: 'start' | 'middle' | 'end') => {
    if (pct <= 0) {
      return (
        <text x={labelX} y={labelY} textAnchor={anchor} fill="#ffffff" fillOpacity={0.55} style={{ fontSize: 9, fontWeight: 800 }}>
          0%
        </text>
      );
    }
    const w = 1.5 + (pct / 100) * 7;
    const len = Math.hypot(x2 - ballX, y2 - 74);
    const ux = (x2 - ballX) / len;
    const uy = (y2 - 74) / len;
    const head = 5 + w;
    const bx = x2 - ux * head;
    const by = y2 - uy * head;
    const px = -uy;
    const py = ux;
    return (
      <g>
        <line x1={ballX} y1={74} x2={bx} y2={by} stroke="#fde047" strokeWidth={w} strokeLinecap="round" strokeOpacity={0.5 + pct / 200} />
        <polygon
          points={`${x2},${y2} ${bx + px * (w / 2 + 3)},${by + py * (w / 2 + 3)} ${bx - px * (w / 2 + 3)},${by - py * (w / 2 + 3)}`}
          fill="#fde047"
          fillOpacity={0.5 + pct / 200}
        />
        <text x={labelX} y={labelY} textAnchor={anchor} fill="#ffffff" style={{ fontSize: 11, fontWeight: 900 }}>
          {pct}%
        </text>
      </g>
    );
  };
  const leftSide = hash === 'left' ? 'SHORT SIDE' : hash === 'right' ? 'WIDE SIDE' : '';
  const rightSide = hash === 'left' ? 'WIDE SIDE' : hash === 'right' ? 'SHORT SIDE' : '';
  return (
    <svg viewBox="0 0 140 96" className="w-full" role="img" aria-label={`Runs from the ${hash} hash: ${leftPct}% left, ${insidePct}% inside, ${rightPct}% right`}>
      <rect x="0" y="0" width="140" height="96" rx="6" fill="#166534" />
      {/* sidelines and hash marks */}
      <line x1="4" y1="0" x2="4" y2="96" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" />
      <line x1="136" y1="0" x2="136" y2="96" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" />
      <line x1="46" y1="0" x2="46" y2="96" stroke="#ffffff" strokeOpacity="0.35" strokeDasharray="3 4" />
      <line x1="94" y1="0" x2="94" y2="96" stroke="#ffffff" strokeOpacity="0.35" strokeDasharray="3 4" />
      {leftSide && (
        <text x="8" y="92" fill="#ffffff" fillOpacity="0.75" style={{ fontSize: 6.5, fontWeight: 800 }}>
          {leftSide}
        </text>
      )}
      {rightSide && (
        <text x="132" y="92" textAnchor="end" fill="#ffffff" fillOpacity="0.75" style={{ fontSize: 6.5, fontWeight: 800 }}>
          {rightSide}
        </text>
      )}
      {arrow(14, 26, leftPct, 12, 16, 'start')}
      {hash === 'right'
        ? arrow(ballX, 20, insidePct, ballX - 6, 30, 'end')
        : arrow(ballX, 20, insidePct, ballX + 6, 30, 'start')}
      {arrow(126, 26, rightPct, 128, 16, 'end')}
      <ellipse cx={ballX} cy={78} rx={5} ry={3.4} fill="#92400e" stroke="#ffffff" strokeWidth="0.8" />
    </svg>
  );
};

export const RunGameTab: React.FC<RunGameTabProps> = ({ analysis: a, plays, voice }) => {
  const sides = runSides(a);
  const runs = plays.filter(isRunPlay);
  const runCalls = topNames(runs, (p) => p.playName, 6);
  const carriers = topNames(runs, (p) => p.oppRusher || p.carrierOrTarget, 6);
  const we = voice.subject === 'We';
  const h = a.hashTendencies;
  const hashes: { key: HashKey; label: string; total: number; runPct: number; left: number; inside: number; right: number }[] = [
    { key: 'left', label: 'Ball on the left hash', total: h.left.total, runPct: h.left.runPct, left: h.left.runLeftPct, inside: h.left.runInsidePct, right: h.left.runRightPct },
    { key: 'middle', label: 'Ball in the middle', total: h.middle.total, runPct: h.middle.runPct, left: h.middle.runLeftPct, inside: h.middle.runInsidePct, right: h.middle.runRightPct },
    { key: 'right', label: 'Ball on the right hash', total: h.right.total, runPct: h.right.runPct, left: h.right.runLeftPct, inside: h.right.runInsidePct, right: h.right.runRightPct },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      <RunGapDiagram analysis={a} heading={we ? 'Where we run' : voice.unit === 'D' ? 'Where teams run on them' : 'Where they run'} />

      {sides.total > 0 && (
        <Card>
          <SectionHeader title="Which side" subtitle="Share of all runs going left, straight ahead, or right (from behind the offense)." />
          <div className="flex h-9 rounded-lg overflow-hidden text-xs font-black">
            {[
              ['Left', sides.leftPct],
              ['Middle', sides.middlePct],
              ['Right', sides.rightPct],
            ].map(([label, pct]) => (
              <div
                key={label as string}
                className="flex items-center justify-center text-white dark:text-white border-r-2 border-white dark:border-slate-900 last:border-r-0 min-w-[64px]"
                style={{ flexGrow: Math.max(Number(pct), 6), background: shareGreen(Number(pct)) }}
              >
                {label} {pct}%
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionHeader
          title="By ball spot"
          subtitle="Where the ball is placed changes where they go. The wide side has more room; the short side is nearest the sideline."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hashes.map((hs) => (
            <div key={hs.key} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{hs.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{hs.total} plays</div>
                </div>
                {hs.total > 0 && <RunPassRing runPct={hs.runPct} size={48} label="RUN" />}
              </div>
              {hs.total > 0 ? (
                <HashField hash={hs.key} leftPct={hs.left} insidePct={hs.inside} rightPct={hs.right} />
              ) : (
                <EmptyNote>No plays from this spot.</EmptyNote>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">Yellow arrows show where runs went: left, inside, or right. Thicker = more often.</p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <Card>
          <SectionHeader title={we ? 'Our top run plays' : 'Top run plays'} subtitle="Most-called runs, with yards per carry." />
          {runCalls.length === 0 ? (
            <EmptyNote>No play names in the file.</EmptyNote>
          ) : (
            <ul className="space-y-2">
              {runCalls.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{r.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    {r.count}x · {r.avg} yds
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <SectionHeader title="Ball carriers" subtitle="Who gets the carries, with yards per carry." />
          {carriers.length === 0 ? (
            <EmptyNote>No ball-carrier names on these plays. The Players tab explains why.</EmptyNote>
          ) : (
            <ul className="space-y-2">
              {carriers.map((c) => (
                <li key={c.name} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {c.count} carries · {c.avg} yds
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${runs.length ? (c.count / runs.length) * 100 : 0}%`, background: RUN_COLOR }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
