import React from 'react';
import { Upload, Printer, Shield, Plus, X } from 'lucide-react';
import { SampleDataset } from '../data/sampleDatasets';
import { MoreMenu } from '../../components/common/MoreMenu';

export type ScoutTarget = 'opponent' | 'own';

export interface ScoutGame {
  id: string;
  name: string;
  playCount: number;
  addedAt: number;
}

interface HeaderProps {
  currentDataset: SampleDataset | null;
  datasetName: string;
  totalPlays: number;
  onOpenUpload: () => void;
  onSelectSample: (dataset: SampleDataset) => void;
  onOpenCallSheet: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  scoutTarget: ScoutTarget;
  onScoutTargetChange: (target: ScoutTarget) => void;
  games: ScoutGame[];
  selectedGameId?: string;
  onSelectGame?: (gameId: string) => void;
  onRemoveGame: (gameId: string) => void;
  onClearUploads: () => void;
  weekLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  datasetName,
  totalPlays,
  onOpenUpload,
  onOpenCallSheet,
  activeTab,
  setActiveTab,
  scoutTarget,
  onScoutTargetChange,
  games,
  selectedGameId = 'all',
  onSelectGame,
  onRemoveGame,
  onClearUploads,
  weekLabel,
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
              <h1 className="text-lg font-bold text-white tracking-tight">HudlScout</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-slate-200">{datasetName}</span>
              <span aria-hidden="true">·</span>
              <span>{totalPlays} Plays Logged</span>
              {games.length > 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{games.length} games</span>
                </>
              )}
            </div>
            {scoutTarget === 'opponent' && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                Follows the schedule week{weekLabel ? ` (${weekLabel})` : ''}. Change the week at the top to scout another team.
              </p>
            )}
            {scoutTarget === 'own' && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                Season-wide. Pick one game or All games.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="flex rounded-md overflow-hidden border border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => onScoutTargetChange('opponent')}
              className={`px-3 py-1.5 ${scoutTarget === 'opponent' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
            >
              Opponent
            </button>
            <button
              type="button"
              onClick={() => onScoutTargetChange('own')}
              className={`px-3 py-1.5 ${scoutTarget === 'own' ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
            >
              Our team
            </button>
          </div>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-md transition-colors shadow-sm"
          >
            {totalPlays > 0 ? <Plus className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{totalPlays > 0 ? 'Add game' : 'Upload CSV / Excel'}</span>
            <span className="sm:hidden">{totalPlays > 0 ? 'Add' : 'Upload'}</span>
          </button>
          <button
            onClick={onOpenCallSheet}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
            title="Open printable Sideline Call Sheet"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Call Sheet</span>
          </button>
          <MoreMenu
            items={[{ label: 'Remove uploads', onClick: onClearUploads, danger: true, hidden: games.length === 0 }]}
          />
        </div>
      </div>

      {games.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-1 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSelectGame?.('all')}
            className={`inline-flex items-center text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full border ${
              selectedGameId === 'all'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            All games
          </button>
          {games.map((g) => (
            <span
              key={g.id}
              className={`inline-flex items-center gap-1 text-[10px] font-semibold pl-2 pr-1 py-0.5 rounded-full border ${
                selectedGameId === g.id
                  ? 'bg-sky-500 text-slate-950 border-sky-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              <button type="button" onClick={() => onSelectGame?.(g.id)} className="text-left">
                {g.name} · {g.playCount} snaps
              </button>
              <button
                type="button"
                onClick={() => onRemoveGame(g.id)}
                className="p-0.5 rounded-full text-slate-400 hover:text-rose-300 hover:bg-rose-950/80"
                title={`Remove ${g.name}`}
                aria-label={`Remove ${g.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-slate-800/80 pt-1 pb-0 text-xs scrollbar-none">
        {[
          ['situational', 'Situational Tendencies'],
          ['formations', 'Formations & Personnel'],
          ['field', 'Hash & Field Zones'],
          ['plays', `Play Log (${totalPlays})`],
          ...(scoutTarget === 'own' ? [['units', 'Black / Blue / Gold']] : []),
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
