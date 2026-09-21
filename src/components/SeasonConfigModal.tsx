import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Settings,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  X,
  Sparkles,
  Sliders,
  ChevronRight,
  Info,
  Layers,
} from 'lucide-react';
import { SeasonConfig, WeekOption, ScheduleEvent, Team, formatWeekLabel } from '../types';
import { getSeasonWeekList, getWeekDisplayLabelWithOpponent } from '../utils/seasonWeekUtils';

interface SeasonConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonConfig: SeasonConfig;
  onSaveSeasonConfig: (updatedConfig: SeasonConfig) => void;
  scheduleEvents?: ScheduleEvent[];
  activeTeamId?: string;
  teams?: Team[];
}

export const SeasonConfigModal: React.FC<SeasonConfigModalProps> = ({
  isOpen,
  onClose,
  seasonConfig,
  onSaveSeasonConfig,
  scheduleEvents = [],
  activeTeamId,
  teams = [],
}) => {
  // Local state initialized from current seasonConfig
  const [preseasonCount, setPreseasonCount] = useState<number>(
    seasonConfig?.preseasonWeeksCount ?? 4
  );
  const [regularSeasonCount, setRegularSeasonCount] = useState<number>(
    seasonConfig?.regularSeasonWeeksCount ?? 8
  );
  const [hasPlayoffs, setHasPlayoffs] = useState<boolean>(
    seasonConfig?.hasPlayoffs !== false
  );
  const [hasChampionship, setHasChampionship] = useState<boolean>(
    seasonConfig?.hasChampionship !== false
  );

  // Map of custom labels by weekKey
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() => {
    return { ...(seasonConfig?.customWeekLabels || {}) };
  });

  // Custom added weeks list
  const [customWeeksList, setCustomWeeksList] = useState<WeekOption[]>(() => {
    return seasonConfig?.customWeeks ? [...seasonConfig.customWeeks] : [];
  });

  // Add custom week inline state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newWeekKey, setNewWeekKey] = useState('');
  const [newWeekLabel, setNewWeekLabel] = useState('');
  const [newWeekPhase, setNewWeekPhase] = useState<'preseason' | 'regular' | 'postseason' | 'custom'>('regular');

  if (!isOpen) return null;

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];

  // Build the effective list of weeks currently generated
  const effectiveWeeks: WeekOption[] = [];

  // Pre-season
  for (let i = 1; i <= preseasonCount; i++) {
    const key = i === 1 ? '0' : `pre-${i}`;
    const defaultLabel = `Pre-Season Week ${i}`;
    effectiveWeeks.push({
      key,
      label: customLabels[key] || defaultLabel,
      phase: 'preseason',
    });
  }

  // Regular season
  for (let i = 1; i <= regularSeasonCount; i++) {
    const key = String(i);
    const defaultLabel = `Week ${i}`;
    effectiveWeeks.push({
      key,
      label: customLabels[key] || defaultLabel,
      phase: 'regular',
    });
  }

  // Post season
  if (hasPlayoffs) {
    effectiveWeeks.push({
      key: 'playoffs',
      label: customLabels['playoffs'] || 'Playoffs',
      phase: 'postseason',
    });
  }
  if (hasChampionship) {
    effectiveWeeks.push({
      key: 'championship',
      label: customLabels['championship'] || 'Championship',
      phase: 'postseason',
    });
  }

  // Extra custom weeks
  customWeeksList.forEach((cw) => {
    if (!effectiveWeeks.some((w) => w.key === cw.key)) {
      effectiveWeeks.push({
        ...cw,
        label: customLabels[cw.key] || cw.label,
      });
    }
  });

  const handleLabelChange = (key: string, newLabel: string) => {
    setCustomLabels((prev) => ({
      ...prev,
      [key]: newLabel,
    }));
  };

  const handleResetLabel = (key: string, defaultLabel: string) => {
    setCustomLabels((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleResetToStandardDefaults = () => {
    setPreseasonCount(4);
    setRegularSeasonCount(8);
    setHasPlayoffs(true);
    setHasChampionship(true);
    setCustomWeeksList([]);
    setCustomLabels({
      '0': 'Pre-Season Week 1',
      'pre-1': 'Pre-Season Week 1',
      'pre-2': 'Pre-Season Week 2',
      'pre-3': 'Pre-Season Week 3',
      'pre-4': 'Pre-Season Week 4',
      '1': 'Week 1',
      '2': 'Week 2',
      '3': 'Week 3',
      '4': 'Week 4',
      '5': 'Week 5',
      '6': 'Week 6',
      '7': 'Week 7',
      '8': 'Week 8',
      'playoffs': 'Playoffs',
      'championship': 'Championship',
    });
  };

  const handleApplyPresetCounts = (newPre: number, newReg: number) => {
    setPreseasonCount(newPre);
    setRegularSeasonCount(newReg);

    const labels: Record<string, string> = { ...customLabels };
    for (let i = 1; i <= newPre; i++) {
      const key = i === 1 ? '0' : `pre-${i}`;
      if (!labels[key]) {
        labels[key] = `Pre-Season Week ${i}`;
      }
      if (i === 1 && !labels['pre-1']) {
        labels['pre-1'] = `Pre-Season Week 1`;
      }
    }
    for (let i = 1; i <= newReg; i++) {
      const key = String(i);
      if (!labels[key]) {
        labels[key] = `Week ${i}`;
      }
    }
    setCustomLabels(labels);
  };

  const handleAddCustomWeek = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newWeekKey.trim().toLowerCase().replace(/\s+/g, '-');
    const cleanLabel = newWeekLabel.trim();
    if (!cleanKey || !cleanLabel) return;

    if (effectiveWeeks.some((w) => w.key === cleanKey)) {
      alert(`A week with identifier "${cleanKey}" already exists.`);
      return;
    }

    const newOption: WeekOption = {
      key: cleanKey,
      label: cleanLabel,
      phase: newWeekPhase,
    };

    setCustomWeeksList((prev) => [...prev, newOption]);
    setCustomLabels((prev) => ({
      ...prev,
      [cleanKey]: cleanLabel,
    }));

    setNewWeekKey('');
    setNewWeekLabel('');
    setShowAddCustom(false);
  };

  const handleRemoveCustomWeek = (key: string) => {
    setCustomWeeksList((prev) => prev.filter((w) => w.key !== key));
    setCustomLabels((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = () => {
    const updatedConfig: SeasonConfig = {
      preseasonWeeksCount: Math.max(1, Math.min(10, preseasonCount)),
      regularSeasonWeeksCount: Math.max(1, Math.min(16, regularSeasonCount)),
      hasPlayoffs,
      hasChampionship,
      preseasonWeekKeys: Array.from({ length: preseasonCount }, (_, i) =>
        i === 0 ? '0' : `pre-${i + 1}`
      ),
      customWeekLabels: customLabels,
      customWeeks: customWeeksList.length > 0 ? customWeeksList : undefined,
    };

    onSaveSeasonConfig(updatedConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-white flex items-center gap-2">
                Season Weeks & Dropdown Setup
              </h2>
              <p className="text-xs text-slate-400">
                Customize pre-season length, regular season weeks, and dropdown labels for all screens.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-5 pr-1 flex-1">
          {/* Quick Season Presets */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Season Structure Presets
              </span>
              <span className="text-[11px] text-slate-400">
                Total: <strong className="text-white">{preseasonCount + regularSeasonCount + (hasPlayoffs ? 1 : 0) + (hasChampionship ? 1 : 0)} Weeks</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pre-Season Count */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">⚡ Pre-Season Weeks:</span>
                  <span className="font-black text-amber-400">{preseasonCount} Weeks</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {[2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleApplyPresetCounts(cnt, regularSeasonCount)}
                      className={`flex-1 py-1 text-xs font-black rounded-lg border transition-all cursor-pointer ${
                        preseasonCount === cnt
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {cnt} Wks
                    </button>
                  ))}
                </div>
              </div>

              {/* Regular Season Count */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">🏈 Regular Season Weeks:</span>
                  <span className="font-black text-indigo-400">{regularSeasonCount} Weeks</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {[6, 7, 8, 9, 10].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleApplyPresetCounts(preseasonCount, cnt)}
                      className={`flex-1 py-1 text-xs font-black rounded-lg border transition-all cursor-pointer ${
                        regularSeasonCount === cnt
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Post-Season Toggles */}
            <div className="flex items-center gap-4 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white font-medium">
                <input
                  type="checkbox"
                  checked={hasPlayoffs}
                  onChange={(e) => setHasPlayoffs(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Include Playoffs</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white font-medium">
                <input
                  type="checkbox"
                  checked={hasChampionship}
                  onChange={(e) => setHasChampionship(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Include Championship / Bowl</span>
              </label>
            </div>
          </div>

          {/* Editable Week Labels List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Custom Week Dropdown Labels
                </h3>
                <p className="text-[11px] text-slate-400">
                  Edit the text displayed in the week selectors for each game or practice week.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Extra Week</span>
              </button>
            </div>

            {/* Inline Add Custom Week Form */}
            {showAddCustom && (
              <form
                onSubmit={handleAddCustomWeek}
                className="p-3 bg-slate-950 border border-amber-500/40 rounded-2xl space-y-2 animate-in fade-in"
              >
                <span className="text-xs font-black text-amber-400 block">
                  Add Special / Extra Custom Week
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Key (e.g. bye-week, week-9)"
                    value={newWeekKey}
                    onChange={(e) => setNewWeekKey(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Label (e.g. Bye Week, Week 9)"
                    value={newWeekLabel}
                    onChange={(e) => setNewWeekLabel(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newWeekPhase}
                      onChange={(e) => setNewWeekPhase(e.target.value as any)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-200 focus:outline-none flex-1"
                    >
                      <option value="preseason">⚡ Pre-Season</option>
                      <option value="regular">🏈 Regular Season</option>
                      <option value="postseason">🏆 Post-Season</option>
                      <option value="custom">📌 Other</option>
                    </select>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* List of weeks */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {effectiveWeeks.map((w) => {
                const isCustomAdded = customWeeksList.some((cw) => cw.key === w.key);
                const currentVal = customLabels[w.key] ?? w.label;

                // Check if there is an opponent from schedule
                const displayWithOpponent = getWeekDisplayLabelWithOpponent(
                  w.key,
                  currentVal,
                  scheduleEvents,
                  activeTeamId
                );

                const hasScheduledGame = displayWithOpponent !== currentVal;

                return (
                  <div
                    key={w.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md border ${
                          w.phase === 'preseason'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : w.phase === 'postseason'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        }`}
                      >
                        {w.phase === 'preseason' ? 'Pre-Season' : w.phase === 'postseason' ? 'Post-Season' : 'Regular'}
                      </span>
                      <span className="font-mono text-[10.5px] text-slate-400 font-semibold min-w-[45px]">
                        [{w.key}]
                      </span>
                    </div>

                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) => handleLabelChange(w.key, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-750 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs text-white font-semibold focus:outline-none"
                        placeholder={w.label}
                      />
                    </div>

                    {hasScheduledGame && (
                      <div className="text-[10px] text-emerald-400 font-medium truncate max-w-[150px] shrink-0 sm:block hidden">
                        ⚡ {displayWithOpponent.split('(')[1]?.replace(')', '')}
                      </div>
                    )}

                    {isCustomAdded && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomWeek(w.key)}
                        className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/40 cursor-pointer"
                        title="Remove custom week"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleResetToStandardDefaults}
            className="text-xs font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1.5 cursor-pointer"
            title="Reset to Pre-Season Week 1-4 and Week 1-8"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Clean Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 text-slate-950" />
              <span>Save Season Weeks</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
