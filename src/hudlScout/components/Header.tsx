import React from 'react';
import { Upload, Printer, Plus, X, SlidersHorizontal } from 'lucide-react';
import { MoreMenu } from '../../components/common/MoreMenu';

export type ScoutTarget = 'opponent' | 'own';
export type ScoutUnit = 'O' | 'D' | 'K' | 'ALL';

export interface ScoutGame {
  id: string;
  name: string;
  playCount: number;
  addedAt: number;
}

interface HeaderProps {
  title: string;
  kicker: string;
  totalPlays: number;
  onOpenUpload: () => void;
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
  unit: ScoutUnit;
  onUnitChange: (unit: ScoutUnit) => void;
  unitCounts: { O: number; D: number; K: number; total: number };
  filterCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

const segBtn = (on: boolean) =>
  `min-h-[34px] px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
    on
      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
  }`;

export const Header: React.FC<HeaderProps> = ({
  title,
  kicker,
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
  unit,
  onUnitChange,
  unitCounts,
  filterCount,
  filtersOpen,
  onToggleFilters,
}) => {
  const own = scoutTarget === 'own';
  const units: [ScoutUnit, string, number][] = [
    ['O', own ? 'Our offense' : 'Their offense', unitCounts.O],
    ['D', own ? 'Our defense' : 'Their defense', unitCounts.D],
    ['K', 'Special teams', unitCounts.K],
    ['ALL', 'Every play', unitCounts.total],
  ];
  const unitHelp: Record<ScoutUnit, string> = own
    ? {
        O: 'Our offense, the way an opponent will see it on film.',
        D: 'Plays other teams ran against our defense.',
        K: 'Our kicking and return plays.',
        ALL: 'Offense, defense, and special teams mixed together.',
      }
    : {
        O: 'Their offense: what our defense will face.',
        D: 'Plays other teams ran against their defense. Use it to plan our offense.',
        K: 'Their kicking and return plays.',
        ALL: 'Offense, defense, and special teams mixed together.',
      };
  const tabs: [string, string][] = [
    ['summary', 'Summary'],
    ['situations', 'Situations'],
    ['run', 'Run game'],
    ['players', 'Players'],
    ...(own ? ([['units', 'Black / Blue / Gold']] as [string, string][]) : []),
    ['gameplan', own ? 'Self-scout plan' : 'Game plan'],
    ['plays', `Play log (${totalPlays})`],
  ];

  return (
    <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-3 flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{kicker}</div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">{title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {totalPlays} plays from {games.length || 0} {games.length === 1 ? 'game' : 'games'}.
            {!own && ' Follows the week picked at the top of the app.'}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="inline-flex p-0.5 gap-0.5 rounded-lg bg-slate-200 dark:bg-slate-800" role="group" aria-label="Whose film">
            <button type="button" onClick={() => onScoutTargetChange('opponent')} className={segBtn(!own)} aria-pressed={!own}>
              Opponent
            </button>
            <button type="button" onClick={() => onScoutTargetChange('own')} className={segBtn(own)} aria-pressed={own}>
              Our team
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenUpload}
            className="min-h-[36px] flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white cursor-pointer"
          >
            {totalPlays > 0 ? <Plus className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {totalPlays > 0 ? 'Add game' : 'Upload film'}
          </button>
          <button
            type="button"
            onClick={onOpenCallSheet}
            className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700 cursor-pointer"
            title="Printable sideline call sheet"
          >
            <Printer className="w-4 h-4" />
            Call sheet
          </button>
          <MoreMenu items={[{ label: 'Remove all uploads', onClick: onClearUploads, danger: true, hidden: games.length === 0 }]} />
        </div>
      </div>

      {games.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mr-1">Games</span>
          <button
            type="button"
            onClick={() => onSelectGame?.('all')}
            className={`min-h-[32px] px-3 rounded-full text-xs font-bold border cursor-pointer ${
              selectedGameId === 'all'
                ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-600 dark:text-white dark:border-slate-500'
                : 'bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            All games
          </button>
          {games.map((g) => (
            <span
              key={g.id}
              className={`min-h-[32px] inline-flex items-center gap-1 pl-3 pr-1 rounded-full text-xs font-semibold border ${
                selectedGameId === g.id
                  ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-600 dark:text-white dark:border-slate-500'
                  : 'bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              <button type="button" onClick={() => onSelectGame?.(g.id)} className="text-left cursor-pointer">
                {g.name} · {g.playCount} plays
              </button>
              <button
                type="button"
                onClick={() => onRemoveGame(g.id)}
                className="p-1.5 rounded-full opacity-70 hover:opacity-100 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                title={`Remove ${g.name}`}
                aria-label={`Remove ${g.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto p-0.5 gap-0.5 rounded-lg bg-slate-200 dark:bg-slate-800" role="group" aria-label="Which plays">
            {units.map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                onClick={() => onUnitChange(id)}
                aria-pressed={unit === id}
                className={segBtn(unit === id)}
              >
                {label} <span className="opacity-80 font-semibold">{n}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            className={`min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
              filterCount > 0 || filtersOpen
                ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500/40'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter{filterCount > 0 ? ` (${filterCount})` : ''}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">{unitHelp[unit]}</p>
      </div>

      <nav className="max-w-7xl mx-auto px-2 sm:px-4 flex items-center gap-1 overflow-x-auto border-t border-slate-200 dark:border-slate-800" aria-label="Report sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`min-h-[44px] px-3 text-sm font-bold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === id
                ? 'border-indigo-600 text-slate-900 dark:border-indigo-400 dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
};
