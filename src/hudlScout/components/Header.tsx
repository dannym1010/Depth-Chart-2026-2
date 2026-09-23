import React from 'react';
import { Upload, Printer, Shield } from 'lucide-react';
import { SampleDataset } from '../data/sampleDatasets';

interface HeaderProps {
  currentDataset: SampleDataset | null;
  datasetName: string;
  totalPlays: number;
  onOpenUpload: () => void;
  onSelectSample: (dataset: SampleDataset) => void;
  onOpenCallSheet: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  datasetName,
  totalPlays,
  onOpenUpload,
  onOpenCallSheet,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black shadow-inner shadow-emerald-500/20">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                HudlScout
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  DEFENSIVE DC
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-slate-200">{datasetName}</span>
              <span aria-hidden="true">·</span>
              <span>{totalPlays} Plays Logged</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400/90 font-mono">Local tendency engine</span>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-semibold text-slate-200 truncate max-w-[220px]">{datasetName}</span>
          </div>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-md transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-slate-950" />
            <span>Upload Hudl CSV</span>
          </button>
          <button
            onClick={onOpenCallSheet}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
            title="Open printable Sideline Call Sheet"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Call Sheet</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-slate-800/80 pt-1 pb-0 text-xs scrollbar-none">
        {[
          ['situational', 'Situational Tendencies'],
          ['formations', 'Formations & Personnel'],
          ['field', 'Hash & Field Zones'],
          ['plays', `Play Log (${totalPlays})`],
          ['gameplan', 'Defensive Gameplan'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === id
                ? 'border-emerald-400 text-emerald-400 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
};
