import React from 'react';
import { TendencyAnalysis } from '../types/football';
import { Compass, MapPin } from 'lucide-react';

interface FieldChalkboardProps {
  analysis: TendencyAnalysis;
}

export const FieldChalkboard: React.FC<FieldChalkboardProps> = ({ analysis }) => {
  const { hashTendencies, runDirections, redZonePlays } = analysis;

  const totalRuns = Object.values(runDirections).reduce((a, b) => a + b, 0);

  const getRunPct = (count: number) => {
    return totalRuns > 0 ? Math.round((count / totalRuns) * 100) : 0;
  };

  return (
    <div className="space-y-4">
      {/* 1. Interactive Football Field Chalkboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">
              Hash & Boundary-vs-Field Play Calling Tendencies
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Chalkboard Scouting Grid
          </span>
        </div>

        {/* Visual Football Field */}
        <div className="relative w-full h-56 rounded-lg bg-emerald-950/70 border-2 border-emerald-800/80 overflow-hidden shadow-inner flex flex-col justify-between p-3 select-none">
          {/* Subtle Yard Lines */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-full border-r border-white flex flex-col justify-between py-1">
                <span className="text-[9px] font-mono text-white/70 pl-0.5">{i === 5 ? '50' : i < 5 ? (i + 1) * 10 : (10 - i) * 10}</span>
                <span className="text-[9px] font-mono text-white/70 pl-0.5">{i === 5 ? '50' : i < 5 ? (i + 1) * 10 : (10 - i) * 10}</span>
              </div>
            ))}
          </div>

          {/* Hash Lines Horizontal Markers */}
          <div className="absolute top-[35%] left-0 right-0 border-b border-dashed border-emerald-400/30 pointer-events-none"></div>
          <div className="absolute top-[65%] left-0 right-0 border-b border-dashed border-emerald-400/30 pointer-events-none"></div>

          {/* Left Hash Section */}
          <div className="relative z-10 grid grid-cols-3 h-full gap-3">
            {/* LEFT HASH BOX */}
            <div className="bg-slate-950/85 backdrop-blur border border-emerald-500/40 rounded p-2.5 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 mb-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    LEFT HASH
                  </span>
                  <span className="font-mono text-slate-200">{hashTendencies.left.total} Plays</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 mb-1">
                  {hashTendencies.left.runPct}% RUN / {hashTendencies.left.passPct}% PASS
                </div>
              </div>
              <div className="text-[11px] text-slate-300 bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-amber-400 font-bold block text-[10px] uppercase">Run Direction Skew:</span>
                <div className="flex justify-between font-mono mt-0.5">
                  <span className="text-emerald-300">{hashTendencies.left.runLeftPct}% Boundary (Left)</span>
                  <span className="text-slate-400">{hashTendencies.left.runRightPct}% Field</span>
                </div>
              </div>
            </div>

            {/* MIDDLE HASH BOX */}
            <div className="bg-slate-950/85 backdrop-blur border border-slate-700/60 rounded p-2.5 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-sky-400 mb-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-sky-400" />
                    MIDDLE OF FIELD
                  </span>
                  <span className="font-mono text-slate-200">{hashTendencies.middle.total} Plays</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 mb-1">
                  {hashTendencies.middle.runPct}% RUN / {hashTendencies.middle.passPct}% PASS
                </div>
              </div>
              <div className="text-[11px] text-slate-300 bg-slate-900/90 p-1.5 rounded border border-slate-800 text-center">
                <span className="text-slate-400 text-[10px] uppercase block">Spatial Balance</span>
                <span className="text-slate-200 font-medium">Full playbook open; no boundary constraint</span>
              </div>
            </div>

            {/* RIGHT HASH BOX */}
            <div className="bg-slate-950/85 backdrop-blur border border-purple-500/40 rounded p-2.5 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-purple-400 mb-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-purple-400" />
                    RIGHT HASH
                  </span>
                  <span className="font-mono text-slate-200">{hashTendencies.right.total} Plays</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-100 mb-1">
                  {hashTendencies.right.runPct}% RUN / {hashTendencies.right.passPct}% PASS
                </div>
              </div>
              <div className="text-[11px] text-slate-300 bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-amber-400 font-bold block text-[10px] uppercase">Run Direction Skew:</span>
                <div className="flex justify-between font-mono mt-0.5">
                  <span className="text-slate-400">{hashTendencies.right.runLeftPct}% Field</span>
                  <span className="text-purple-300">{hashTendencies.right.runRightPct}% Boundary (Right)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Run Directional Distribution Heatmap */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>Run Direction Attack Distribution ({totalRuns} Total Run Plays)</span>
          <span className="text-xs font-normal text-slate-400">Offensive Line Gaps</span>
        </h3>

        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {/* Left Perimeter */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Left Edge</span>
            <div className="my-2">
              <span className="text-lg font-black font-mono text-emerald-400">{getRunPct(runDirections.leftPerimeter)}%</span>
              <span className="text-[10px] text-slate-400 block">{runDirections.leftPerimeter} pl</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${getRunPct(runDirections.leftPerimeter)}%` }} />
            </div>
          </div>

          {/* Off-Tackle Left */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Off-Tackle L</span>
            <div className="my-2">
              <span className="text-lg font-black font-mono text-emerald-400">{getRunPct(runDirections.offTackleLeft)}%</span>
              <span className="text-[10px] text-slate-400 block">{runDirections.offTackleLeft} pl</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${getRunPct(runDirections.offTackleLeft)}%` }} />
            </div>
          </div>

          {/* A-Gap Left */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">A-Gap L</span>
            <div className="my-2">
              <span className="text-lg font-black font-mono text-emerald-400">{getRunPct(runDirections.aGapLeft)}%</span>
              <span className="text-[10px] text-slate-400 block">{runDirections.aGapLeft} pl</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${getRunPct(runDirections.aGapLeft)}%` }} />
            </div>
          </div>

          {/* Middle / Center Dive */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between ring-1 ring-emerald-500/20">
            <span className="text-[10px] text-amber-400 uppercase font-semibold">Center / Mid</span>
            <div className="my-2">
              <span className="text-lg font-black font-mono text-amber-400">{getRunPct(runDirections.middle)}%</span>
              <span className="text-[10px] text-slate-400 block">{runDirections.middle} pl</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full" style={{ width: `${getRunPct(runDirections.middle)}%` }} />
            </div>
          </div>

          {/* A-Gap Right */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">A-Gap R</span>
            <div className="my-2">
              <span className="text-lg font-black font-mono text-emerald-400">{getRunPct(runDirections.aGapRight)}%</span>
              <span className="text-[10px] text-slate-400 block">{runDirections.aGapRight} pl</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${getRunPct(runDirections.aGapRight)}%` }} />
            </div>
          </div>

          {/* Off-Tackle Right */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Off-Tackle R</span>
            <div className="my-2">
              <span className="text-lg font-black font-mono text-emerald-400">{getRunPct(runDirections.offTackleRight)}%</span>
              <span className="text-[10px] text-slate-400 block">{runDirections.offTackleRight} pl</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${getRunPct(runDirections.offTackleRight)}%` }} />
            </div>
          </div>

          {/* Right Perimeter */}
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Right Edge</span>
            <div className="my-2">
              <span className="text-lg font-black font-mono text-emerald-400">{getRunPct(runDirections.rightPerimeter)}%</span>
              <span className="text-[10px] text-slate-400 block">{runDirections.rightPerimeter} pl</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${getRunPct(runDirections.rightPerimeter)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Red Zone (Inside 20) Deep Dive */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            Red Zone Play-Calling Dossier ({redZonePlays.total} Total Plays inside Opp 20)
          </h3>
          <span className="text-xs font-mono font-bold text-rose-400">
            {redZonePlays.runPct}% RUN / {redZonePlays.passPct}% PASS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
              Scoring Territory Efficiency
            </span>
            <div className="text-xl font-bold font-mono text-slate-100">
              {redZonePlays.avgGain} yds <span className="text-xs text-slate-400 font-normal">avg per play</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Field compression limits vertical routes; expect tighter splits and crossing routes.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800 col-span-2">
            <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
              Top Red Zone Play Calls
            </span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {redZonePlays.topPlays.map((p, idx) => (
                <div key={idx} className="bg-slate-900 px-3 py-1.5 rounded border border-slate-800 flex items-center gap-2">
                  <span className="font-bold text-slate-200">{p.name}</span>
                  <span className="text-emerald-400 font-mono text-[11px] font-bold">({p.count} calls)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
