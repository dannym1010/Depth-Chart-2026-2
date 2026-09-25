import React, { useState } from 'react';
import {
  X,
  Copy,
  AlertTriangle,
  Users,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { Team, SeasonConfig, ScheduleEvent, WeekState } from '../../types';
import { getSeasonWeekList, getWeekDisplayLabelWithOpponent, formatWeekLabel } from '../../utils/seasonWeekUtils';

/* =========================================================================
   COPY WEEK MODAL
   ========================================================================= */
export type CopyWeekMode = 'both' | 'formations_only' | 'positions_only';

interface CopyWeekModalProps {
  isOpen: boolean;
  currentWeek: string;
  activeTeamId?: string;
  teams?: Team[];
  seasonConfig?: SeasonConfig;
  scheduleEvents?: ScheduleEvent[];
  weeklyData?: Record<string, WeekState>;
  resolveWeekStateFn?: (
    wData: Record<string, WeekState>,
    teamId: string,
    week: string
  ) => WeekState;
  onClose: () => void;
  onExecuteCopy: (
    srcWeek: string,
    targetWeek: string,
    copyMode?: CopyWeekMode,
    srcTeamId?: string,
    showAlert?: boolean,
    extras?: { copyWristband?: boolean; copyCallSheet?: boolean }
  ) => void;
}

export const CopyWeekModal: React.FC<CopyWeekModalProps> = ({
  isOpen,
  currentWeek,
  activeTeamId = 'team_10u',
  teams = [],
  seasonConfig,
  scheduleEvents = [],
  weeklyData = {},
  resolveWeekStateFn,
  onClose,
  onExecuteCopy,
}) => {
  const [srcTeamId, setSrcTeamId] = useState<string>(activeTeamId);
  const [srcWeek, setSrcWeek] = useState<string>(() => {
    const num = parseInt(currentWeek, 10);
    if (!isNaN(num) && num > 1) return String(num - 1);
    if (currentWeek === '1') return '0';
    return '0';
  });
  const [targetWeek, setTargetWeek] = useState<string>(currentWeek);
  const [copyMode, setCopyMode] = useState<CopyWeekMode>('both');
  const [copyWristband, setCopyWristband] = useState(true);
  const [copyCallSheet, setCopyCallSheet] = useState(true);

  if (!isOpen) return null;

  const allWeeks = getSeasonWeekList(seasonConfig);

  // Compute live statistics for source week using resolved state
  const srcScopedKey = `${srcTeamId}__week_${srcWeek}`;
  const srcState = resolveWeekStateFn
    ? resolveWeekStateFn(weeklyData, srcTeamId, srcWeek)
    : (weeklyData[srcScopedKey] || weeklyData[srcWeek] || {
        formations: [],
        depthChart: {},
        scrimmageChart: {},
      });
  const srcFormCount = srcState.formations?.length || 0;
  const srcPlayerAssignmentCount = Object.values(srcState.depthChart || {}).reduce(
    (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
    0
  );

  // Target stats
  const targetScopedKey = `${activeTeamId}__week_${targetWeek}`;
  const targetState = resolveWeekStateFn
    ? resolveWeekStateFn(weeklyData, activeTeamId, targetWeek)
    : (weeklyData[targetScopedKey] || weeklyData[targetWeek]);
  const targetFormCount = targetState?.formations?.length || 0;
  const targetPlayerCount = Object.values(targetState?.depthChart || {}).reduce(
    (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
    0
  );

  const srcTeamName = teams.find((t) => t.id === srcTeamId)?.name || 'Active Team';
  const targetTeamName = teams.find((t) => t.id === activeTeamId)?.name || 'Active Team';

  const handleCopy = () => {
    if (srcWeek === targetWeek && srcTeamId === activeTeamId) {
      alert('Source week and Target week cannot be the same within the same squad.');
      return;
    }
    onExecuteCopy(srcWeek, targetWeek, copyMode, srcTeamId, true, {
      copyWristband,
      copyCallSheet,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-850 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-700/80 my-8">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-100">
                Copy Week Formations &amp; Depth Chart
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">
                Transfer playbook schemes and player assignments across any weeks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-semibold">
          {/* Source Selection Group */}
          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-750 space-y-3">
            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider block">
              1. Source Selection (Copy From)
            </span>

            {teams.length > 1 && (
              <div>
                <label className="block text-slate-300 mb-1 font-bold text-[11px]">
                  Source Squad / Division:
                </label>
                <select
                  value={srcTeamId}
                  onChange={(e) => setSrcTeamId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-300 mb-1 font-bold text-[11px]">
                Source Week:
              </label>
              <select
                value={srcWeek}
                onChange={(e) => setSrcWeek(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {allWeeks.map((wk) => (
                  <option key={wk.key} value={wk.key}>
                    {getWeekDisplayLabelWithOpponent(wk.key, wk.label, scheduleEvents, srcTeamId)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>Source Payload:</span>
              <span className="font-bold text-indigo-300">
                {srcFormCount} Formation{srcFormCount === 1 ? '' : 's'} &bull; {srcPlayerAssignmentCount} Player Placement{srcPlayerAssignmentCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Target Selection Group */}
          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-750 space-y-3">
            <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block">
              2. Target Selection (Copy To)
            </span>

            <div>
              <label className="block text-slate-300 mb-1 font-bold text-[11px]">
                Target Week ({targetTeamName}):
              </label>
              <select
                value={targetWeek}
                onChange={(e) => setTargetWeek(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {allWeeks.map((wk) => (
                  <option key={wk.key} value={wk.key}>
                    {getWeekDisplayLabelWithOpponent(wk.key, wk.label, scheduleEvents, activeTeamId)}
                  </option>
                ))}
              </select>
            </div>

            {targetState && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                <span>Current Target Contents:</span>
                <span className="font-bold text-amber-300">
                  {targetFormCount} Formations &bull; {targetPlayerCount} Placed Players
                </span>
              </div>
            )}
          </div>

          {/* Copy Mode Options */}
          <div className="space-y-2">
            <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">
              3. Choose What to Copy
            </span>

            <div className="grid grid-cols-1 gap-2">
              <label
                onClick={() => setCopyMode('both')}
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  copyMode === 'both'
                    ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 shadow-sm'
                    : 'bg-slate-900/60 border-slate-750 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="radio"
                  name="copyMode"
                  checked={copyMode === 'both'}
                  onChange={() => setCopyMode('both')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Formations &amp; Player Positions (Complete Depth Chart)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    Clones all formations, rows, position tags, plus all 1st (ST), 2nd (D2), and 3rd (D3) player assignments.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setCopyMode('formations_only')}
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  copyMode === 'formations_only'
                    ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 shadow-sm'
                    : 'bg-slate-900/60 border-slate-750 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="radio"
                  name="copyMode"
                  checked={copyMode === 'formations_only'}
                  onChange={() => setCopyMode('formations_only')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Formations Only (Fresh Blank Depth Chart)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    Copies all formation boards and slot structures, but starts with empty player slots for a clean weekly lineup.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setCopyMode('positions_only')}
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  copyMode === 'positions_only'
                    ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 shadow-sm'
                    : 'bg-slate-900/60 border-slate-750 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="radio"
                  name="copyMode"
                  checked={copyMode === 'positions_only'}
                  onChange={() => setCopyMode('positions_only')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Player Positions Only (Apply to Target Formations)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    Preserves the target week's existing formation schemes, and maps player depth chart slots onto matching positions.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">
              4. Game Day (Wristband &amp; Call Sheet)
            </span>
            <label className="flex items-start gap-3 p-3 rounded-2xl border bg-slate-900/60 border-slate-750 text-slate-300 cursor-pointer hover:bg-slate-800/80">
              <input
                type="checkbox"
                checked={copyWristband}
                onChange={(e) => setCopyWristband(e.target.checked)}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-bold text-xs text-white">Copy wristband</div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                  Puts the source week&apos;s wristband plays on the target week.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-2xl border bg-slate-900/60 border-slate-750 text-slate-300 cursor-pointer hover:bg-slate-800/80">
              <input
                type="checkbox"
                checked={copyCallSheet}
                onChange={(e) => setCopyCallSheet(e.target.checked)}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-bold text-xs text-white">Copy call sheet</div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                  Puts the source week&apos;s sideline call sheet on the target week.
                </p>
              </div>
            </label>
          </div>

          <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl text-indigo-200 text-[11px] leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>
              Transferring from <strong className="text-white">{formatWeekLabel(srcWeek)}</strong> ({srcTeamName}) to{' '}
              <strong className="text-white">{formatWeekLabel(targetWeek)}</strong> ({targetTeamName}). Changes are saved to cloud &amp; synced in real-time across all coach screens.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-700/80">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            className="px-5 py-2 font-black text-xs rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Execute Copy Week</span>
          </button>
        </div>
      </div>
    </div>
  );
};
