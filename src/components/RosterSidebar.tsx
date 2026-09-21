import React from 'react';
import { Search, UserCheck, GripVertical, BookOpen, Layers, UserPlus, Zap, Shield, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { RosterPlayer, UserRole, UnitType, WeekState, calculatePlayerCompliance } from '../types';
import { cleanTruncatedPosition } from '../utils/depthChartUtils';

interface RosterSidebarProps {
  roster: RosterPlayer[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeUnit: UnitType;
  selectedFormationId: string | null;
  currentWeekState: WeekState;
  userRole: UserRole;
  playLibrary: string[];
  playSearchTerm: string;
  onPlaySearchChange: (term: string) => void;
  onDragStartPlayer: (e: React.DragEvent, player: RosterPlayer) => void;
  onDragStartPlay?: (e: React.DragEvent, play: string) => void;
  onOpenRosterManager?: () => void;
  onOpenCompliance?: () => void;
  onSelectPlayerForEdit?: (player: RosterPlayer) => void;
  activeTeamName?: string;
  totalProgramPlayers?: number;
  onCopyFromMainTeam?: () => void;
  onRestoreDefaultRoster?: () => void;
  onOpenExcelPlayImport?: () => void;
}

export const RosterSidebar: React.FC<RosterSidebarProps> = ({
  roster,
  searchTerm,
  onSearchChange,
  activeUnit,
  selectedFormationId,
  currentWeekState,
  userRole,
  playLibrary,
  playSearchTerm,
  onPlaySearchChange,
  onDragStartPlayer,
  onDragStartPlay,
  onOpenRosterManager,
  onOpenCompliance,
  onSelectPlayerForEdit,
  activeTeamName,
  totalProgramPlayers = 0,
  onCopyFromMainTeam,
  onRestoreDefaultRoster,
  onOpenExcelPlayImport,
}) => {
  // If Wristband tab is active, show Play Library
  if (activeUnit === 'wristband') {
    const filteredPlays = playLibrary.filter((p) =>
      p.toLowerCase().includes(playSearchTerm.toLowerCase().trim())
    );

    return (
      <div className="w-full lg:w-72 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-4 sticky top-[170px] flex flex-col max-h-[calc(100vh-190px)] print:hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="font-black text-sm text-slate-100 tracking-tight">
              Play Library
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenExcelPlayImport && (
              <button
                type="button"
                onClick={onOpenExcelPlayImport}
                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs"
                title="Import plays from Excel (.xlsx, .csv)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {filteredPlays.length} Plays
            </span>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={playSearchTerm}
            onChange={(e) => onPlaySearchChange(e.target.value)}
            placeholder="Search plays..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-750 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <ul className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
          {filteredPlays.map((play, idx) => {
            const playNum = idx + 1;
            const isLeft = playNum <= 16;
            return (
              <li
                key={idx}
                draggable={userRole === 'admin'}
                onDragStart={(e) => onDragStartPlay && onDragStartPlay(e, play)}
                className="px-2.5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-indigo-400/50 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all select-none group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Highlighted Play Number Badge */}
                  <span
                    className={`font-mono font-black text-[10px] px-1.5 py-0.5 rounded-md min-w-[24px] text-center shrink-0 ${
                      isLeft
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                    }`}
                  >
                    #{playNum}
                  </span>
                  <span className="truncate uppercase font-bold text-[11px] text-slate-100">
                    {play}
                  </span>
                </div>
                <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-300 transition-colors shrink-0 ml-1" />
              </li>
            );
          })}
          {filteredPlays.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400 font-medium space-y-2">
              <p>No plays found</p>
              {onOpenExcelPlayImport && (
                <button
                  type="button"
                  onClick={onOpenExcelPlayImport}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import from Excel</span>
                </button>
              )}
            </div>
          )}
        </ul>
      </div>
    );
  }

  // Filter Master Roster
  const filteredRoster = roster.filter((p) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const fName = p.firstName.toLowerCase();
    const lName = p.lastName.toLowerCase();
    const rName = (p.rosterName || '').toLowerCase();
    const num = p.num.toLowerCase();
    const pos = (p.primaryPosition || '').toLowerCase();
    const secPos = (p.secondaryPosition || '').toLowerCase();
    return fName.includes(term) || lName.includes(term) || rName.includes(term) || num.includes(term) || pos.includes(term) || secPos.includes(term);
  });

  const isScrimmageTab = activeUnit === 'scrimmage';
  const activeChart = isScrimmageTab
    ? currentWeekState.scrimmageChart || {}
    : currentWeekState.depthChart || {};

  return (
    <div className="w-full lg:w-80 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-4 sticky top-[170px] flex flex-col max-h-[calc(100vh-190px)] print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-black text-sm text-slate-100 tracking-tight truncate">
              {activeTeamName ? `${activeTeamName}` : 'Team Roster'}
            </h2>
            <p className="text-[10px] text-slate-400 font-semibold truncate">
              {roster.length} {roster.length === 1 ? 'Player' : 'Players'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {userRole === 'admin' && onOpenRosterManager && (
            <button
              onClick={onOpenRosterManager}
              className="p-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 transition-all text-[10px] font-bold flex items-center gap-1 px-2 cursor-pointer"
              title="Add or edit players"
            >
              <UserPlus className="w-3 h-3" />
              <span>Edit</span>
            </button>
          )}
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
            {roster.length}
          </span>
        </div>
      </div>

      <div className="mb-2">
        <p className="text-[10px] text-slate-400 font-medium leading-tight">
          {isScrimmageTab
            ? 'Drag to assign Gold / Blue scrimmage rotations'
            : 'Drag players into formation spots or depth charts'}
        </p>
      </div>

      {/* Search Box */}
      <div className="relative mb-2.5">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, #, pos..."
          className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-750 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Roster List */}
      <ul className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
        {filteredRoster.map((player) => {
          const comp = calculatePlayerCompliance(player);
          // Calculate placements in current view
          const placements: { posName: string; badgeClass: string }[] = [];
          const allForms = currentWeekState.formations || [];

          if (isScrimmageTab) {
            allForms
              .filter((f) => f && (f.unit === 'offense' || f.unit === 'defense'))
              .forEach((form) => {
                (form.rows || []).forEach((row) => {
                  (row.positions || []).forEach((pos) => {
                    if (pos && activeChart[pos.id]) {
                      (activeChart[pos.id] || []).forEach((p, idx) => {
                        if (p && String(p.num) === String(player.num)) {
                          placements.push({
                            posName: pos.name,
                            badgeClass:
                              idx === 0
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 font-black border border-amber-300 dark:border-amber-700/60 shadow-xs'
                                : idx === 1
                                ? 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200 font-black border border-sky-300 dark:border-sky-700/60 shadow-xs'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-black border border-slate-200 dark:border-slate-600 shadow-xs',
                          });
                        }
                      });
                    }
                  });
                });
              });
          } else {
            const currentForm = allForms.find(
              (f) => f && f.id === selectedFormationId && f.unit === activeUnit
            );
            if (currentForm) {
              (currentForm.rows || []).forEach((row) => {
                (row.positions || []).forEach((pos) => {
                  if (pos && activeChart[pos.id]) {
                    (activeChart[pos.id] || []).forEach((p, idx) => {
                      if (p && String(p.num) === String(player.num)) {
                        placements.push({
                          posName: pos.name,
                          badgeClass:
                            idx === 0
                              ? 'bg-slate-900 text-white dark:bg-slate-950 dark:text-zinc-100 border border-slate-700 dark:border-slate-600 font-black'
                              : idx === 1
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 font-black'
                              : idx === 2
                              ? 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200 border border-sky-300 dark:border-sky-700/60 font-black'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-black',
                        });
                      }
                    });
                  }
                });
              });
            }
          }

          return (
            <li
              key={player.num}
              draggable={userRole === 'admin'}
              onDragStart={(e) => onDragStartPlayer(e, player)}
              onClick={() => onSelectPlayerForEdit && onSelectPlayerForEdit(player)}
              className={`p-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 hover:border-indigo-400/50 rounded-xl flex items-center justify-between text-xs transition-all select-none ${
                userRole === 'admin' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-black text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 rounded-lg px-1.5 py-0.5 text-[11px] min-w-[26px] text-center font-mono">
                  #{player.num}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-100 uppercase tracking-tight text-[11px] truncate">
                      {player.firstName} {player.lastName}
                    </span>
                    {player.isCaptain && (
                      <span className="px-1 py-0.1 bg-amber-400 text-slate-950 font-black text-[8px] rounded">
                        C
                      </span>
                    )}
                  </div>
                  {/* Position Sub-Tag */}
                  <div className="flex items-center gap-1 text-[9px]">
                    {player.primaryPosition && (
                      <span className="text-indigo-400 font-semibold">{cleanTruncatedPosition(player.primaryPosition)}</span>
                    )}
                    {player.secondaryPosition && (
                      <>
                        <span className="text-slate-600">/</span>
                        <span className="text-amber-400 font-semibold">{cleanTruncatedPosition(player.secondaryPosition)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Badges for active positions */}
              {placements.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                  {placements.map((pl, pIdx) => (
                    <span
                      key={pIdx}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider ${pl.badgeClass}`}
                    >
                      {cleanTruncatedPosition(pl.posName)}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {filteredRoster.length === 0 && (
          <div className="py-6 px-3 text-center space-y-3">
            <p className="text-xs text-slate-400 font-medium">
              {roster.length === 0
                ? activeTeamName
                  ? `No players assigned to ${activeTeamName} yet.`
                  : 'No players on roster yet.'
                : 'No matching players found.'}
            </p>
            {roster.length === 0 && (
              <div className="space-y-2 pt-1">
                {totalProgramPlayers > 0 && onCopyFromMainTeam && (
                  <button
                    type="button"
                    onClick={onCopyFromMainTeam}
                    className="w-full py-2 px-3 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Copy 10U Roster ({totalProgramPlayers})</span>
                  </button>
                )}
                {totalProgramPlayers === 0 && onRestoreDefaultRoster && (
                  <button
                    type="button"
                    onClick={onRestoreDefaultRoster}
                    className="w-full py-2 px-3 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Restore Default Roster</span>
                  </button>
                )}
                {userRole === 'admin' && onOpenRosterManager && (
                  <button
                    type="button"
                    onClick={onOpenRosterManager}
                    className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-750 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Manage / Add Players</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </ul>
    </div>
  );
};
