import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Zap,
  Shield,
  CheckCircle2,
  XCircle,
  Calculator,
  MapPin,
  FileText,
  Copy,
  Check,
  Layers,
  Info,
  Printer,
} from 'lucide-react';
import { RosterPlayer, AttendanceRecord, SeasonConfig } from '../types';
import {
  getPlayerHoursBreakdown,
  AttendedDayItem,
  calculatePlayerHours,
} from '../utils/hoursCalculation';
import { printSinglePlayerHourReport } from '../utils/printUtils';

export interface PlayerHoursBreakdownModalProps {
  player: RosterPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  attendanceLogs: AttendanceRecord[];
  seasonConfig?: SeasonConfig;
  initialScope?: 'season' | 'preseason' | 'this_week' | 'week';
  selectedWeek?: string;
}

export const PlayerHoursBreakdownModal: React.FC<PlayerHoursBreakdownModalProps> = ({
  player,
  isOpen,
  onClose,
  attendanceLogs,
  seasonConfig,
  initialScope = 'season',
  selectedWeek = '1',
}) => {
  const [currentScope, setCurrentScope] = useState<'season' | 'preseason' | 'this_week'>(
    initialScope === 'week' ? 'this_week' : initialScope
  );
  const [showAbsences, setShowAbsences] = useState<boolean>(false);
  const [copiedEquation, setCopiedEquation] = useState<boolean>(false);

  // Sync initial scope whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentScope(initialScope === 'week' ? 'this_week' : initialScope);
      setShowAbsences(false);
      setCopiedEquation(false);
    }
  }, [isOpen, initialScope]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute breakdown for current selected scope
  const breakdown = useMemo(() => {
    if (!player) return null;
    return getPlayerHoursBreakdown(
      player,
      attendanceLogs,
      currentScope,
      selectedWeek,
      seasonConfig
    );
  }, [player, attendanceLogs, currentScope, selectedWeek, seasonConfig]);

  // Pre-calculate totals for the 3 tabs so coach sees tab labels with hours
  const tabTotals = useMemo(() => {
    if (!player) return { season: 0, preseason: 0, thisWeek: 0 };
    const seasonCalc = calculatePlayerHours(player, attendanceLogs, selectedWeek, seasonConfig);
    const preCalc = Math.round(
      ((seasonCalc.weeklyHours['pre-1'] || 0) +
        (seasonCalc.weeklyHours['pre-2'] || 0) +
        (seasonCalc.weeklyHours['pre-3'] || 0) +
        (seasonCalc.weeklyHours['pre-4'] || 0)) *
        10
    ) / 10;
    return {
      season: seasonCalc.totalSeasonHours,
      preseason: preCalc,
      thisWeek: seasonCalc.thisWeekHours,
    };
  }, [player, attendanceLogs, selectedWeek, seasonConfig]);

  if (!isOpen || !player || !breakdown) return null;

  const displayedDays = showAbsences ? breakdown.days : breakdown.attendedDays;

  const handleCopyEquation = () => {
    if (!breakdown) return;
    const summaryText = [
      `${player.firstName} ${player.lastName} (#${player.num}) - Hours Breakdown`,
      `Scope: ${breakdown.scopeLabel}`,
      `Total Hours: ${breakdown.totalHours.toFixed(1)} hrs (${breakdown.attendedSessionsCount} practices attended)`,
      `Conditioning: ${breakdown.conditioningHours.toFixed(1)} hrs | Padded: ${breakdown.paddedHours.toFixed(1)} hrs`,
      ``,
      `Days Added Together:`,
      ...breakdown.attendedDays.map(
        (d, idx) =>
          `#${idx + 1} - ${d.formattedDate} [${d.weekLabel}] "${d.title}": +${d.hours.toFixed(1)}h (${d.playerAttire}) -> Running Total: ${d.runningTotal.toFixed(1)}h`
      ),
      ``,
      `Formula: ${breakdown.formulaEquation}`,
    ].join('\n');

    navigator.clipboard?.writeText(summaryText);
    setCopiedEquation(true);
    setTimeout(() => setCopiedEquation(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakdown-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center font-mono font-black text-indigo-300 text-lg shadow-inner shrink-0">
              #{player.num}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="breakdown-modal-title"
                  className="font-black text-lg sm:text-xl text-slate-100 tracking-tight"
                >
                  {player.firstName} {player.lastName}
                </h2>
                {player.isCaptain && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                    Captain
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                {player.primaryPosition && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono font-bold text-indigo-300">
                    OFF: {player.primaryPosition}
                  </span>
                )}
                {player.secondaryPosition && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono font-bold text-amber-300">
                    DEF: {player.secondaryPosition}
                  </span>
                )}
                <span className="text-slate-400 font-medium">
                  Day-by-Day Practice Hours Log
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                printSinglePlayerHourReport({
                  player,
                  attendanceLogs,
                  seasonConfig,
                  scope: currentScope === 'this_week' ? 'season' : currentScope,
                });
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs active:scale-95"
              title="Print Official Player Practice Attendance Certificate"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Print Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SCOPE TABS */}
        <div className="px-5 sm:px-6 pt-4 pb-2 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCurrentScope('season')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentScope === 'season'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full Season ({tabTotals.season.toFixed(1)} hrs)</span>
            </button>
            <button
              onClick={() => setCurrentScope('preseason')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentScope === 'preseason'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Pre-Season ({tabTotals.preseason.toFixed(1)} hrs)</span>
            </button>
            <button
              onClick={() => setCurrentScope('this_week')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentScope === 'this_week'
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Week {selectedWeek} ({tabTotals.thisWeek.toFixed(1)} hrs)</span>
            </button>
          </div>

          {/* Toggle show absences */}
          <button
            onClick={() => setShowAbsences((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              showAbsences
                ? 'bg-slate-800 text-slate-200 border-slate-600'
                : 'bg-slate-950 text-slate-400 hover:text-slate-300 border-slate-800'
            }`}
          >
            {showAbsences ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Showing All Days</span>
              </>
            ) : (
              <>
                <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                <span>Attended Days Only ({breakdown.attendedDays.length})</span>
              </>
            )}
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* STATS HIGHLIGHT CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Hours Card */}
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-black text-emerald-400/90 tracking-wider">
                  Total Hours
                </span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black font-mono text-emerald-300">
                  {breakdown.totalHours.toFixed(1)} hrs
                </div>
                <div className="text-[10px] text-emerald-400/80 font-semibold mt-0.5">
                  {breakdown.attendedSessionsCount} practice days added
                </div>
              </div>
            </div>

            {/* Conditioning Hours (Max 10.0h) */}
            {(() => {
              const isCondGood = breakdown.conditioningHours >= 10;
              const condHours = Math.min(10, breakdown.conditioningHours);
              return (
                <div className={`rounded-2xl p-3.5 flex flex-col justify-between border ${
                  isCondGood ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-rose-950/30 border-rose-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] uppercase font-black tracking-wider ${
                      isCondGood ? 'text-emerald-400/90' : 'text-rose-400/90'
                    }`}>
                      Conditioning (Max 10h)
                    </span>
                    <Zap className={`w-4 h-4 ${isCondGood ? 'text-emerald-400' : 'text-rose-400'}`} />
                  </div>
                  <div className="mt-2">
                    <div className={`text-2xl font-black font-mono ${
                      isCondGood ? 'text-emerald-300' : 'text-rose-300'
                    }`}>
                      {condHours.toFixed(1)} / 10.0 hrs
                    </div>
                    <div className={`text-[10px] font-bold mt-0.5 ${
                      isCondGood ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isCondGood ? '✓ 10.0h Met (Good)' : `Needs ${(10 - condHours).toFixed(1)}h more`}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Padded Contact Hours (Max 10.0h) */}
            {(() => {
              const isPadGood = breakdown.paddedHours >= 10;
              const padHours = Math.min(10, breakdown.paddedHours);
              return (
                <div className={`rounded-2xl p-3.5 flex flex-col justify-between border ${
                  isPadGood ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-rose-950/30 border-rose-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] uppercase font-black tracking-wider ${
                      isPadGood ? 'text-emerald-400/90' : 'text-rose-400/90'
                    }`}>
                      Padded Contact (Max 10h)
                    </span>
                    <Shield className={`w-4 h-4 ${isPadGood ? 'text-emerald-400' : 'text-rose-400'}`} />
                  </div>
                  <div className="mt-2">
                    <div className={`text-2xl font-black font-mono ${
                      isPadGood ? 'text-emerald-300' : 'text-rose-300'
                    }`}>
                      {padHours.toFixed(1)} / 10.0 hrs
                    </div>
                    <div className={`text-[10px] font-bold mt-0.5 ${
                      isPadGood ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isPadGood ? '✓ 10.0h Met (Good)' : `Needs ${(10 - padHours).toFixed(1)}h more`}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Attendance Rate */}
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-black text-indigo-400/90 tracking-wider">
                  Attendance
                </span>
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black font-mono text-indigo-300">
                  {breakdown.attendanceRate}%
                </div>
                <div className="text-[10px] text-indigo-400/80 font-semibold mt-0.5">
                  {breakdown.attendedSessionsCount} of {breakdown.totalSessionsCount} sessions
                </div>
              </div>
            </div>
          </div>

          {/* MATHEMATICAL ADDITION EQUATION BOX */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-300">
                <Calculator className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Addition Formula ({breakdown.scopeLabel}):</span>
              </div>
              <div className="font-mono text-xs text-amber-300 break-words leading-relaxed font-semibold">
                {breakdown.formulaEquation}
              </div>
            </div>

            <button
              onClick={handleCopyEquation}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
              title="Copy mathematical breakdown to clipboard"
            >
              {copiedEquation ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Log</span>
                </>
              )}
            </button>
          </div>

          {/* CHRONOLOGICAL DAYS TABLE */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Days That Added Up to {breakdown.totalHours.toFixed(1)} hrs</span>
              </span>
              <span className="text-xs font-mono text-slate-400 font-bold">
                {displayedDays.length} sessions listed
              </span>
            </div>

            {displayedDays.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No practice days recorded for this filter scope.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {displayedDays.map((item: AttendedDayItem, idx: number) => {
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.wasPresent
                          ? 'hover:bg-slate-900/80 bg-slate-900/30'
                          : 'bg-rose-950/10 hover:bg-rose-950/20 opacity-70'
                      }`}
                    >
                      {/* Left: Date & Session Info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </span>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-100">
                              {item.formattedDate}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                item.isPreSeason
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                              }`}
                            >
                              {item.weekLabel}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                item.playerAttire === 'conditioning'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                              }`}
                            >
                              {item.playerAttire === 'conditioning' ? '⚡ Conditioning' : '🛡️ Padded Contact'}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-200">
                            {item.title}
                          </div>

                          {item.location && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{item.location}</span>
                            </div>
                          )}

                          {item.notes && (
                            <div className="text-[11px] text-slate-400 italic">
                              "{item.notes}"
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Hours Added & Running Total */}
                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                        {item.wasPresent ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-xl shadow-xs">
                                +{item.hours.toFixed(1)} hrs
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-1 font-semibold">
                              Running Total: <span className="text-slate-200 font-bold">{item.runningTotal.toFixed(1)} hrs</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 text-rose-400 text-xs font-mono font-bold bg-rose-950/40 border border-rose-500/30 px-2.5 py-1 rounded-xl">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>+0.0 hrs (Absent)</span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 mt-1">
                              No hours added
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All logged sessions update automatically whenever attendance is marked.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black transition-all border border-slate-700 cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
