import React, { useState } from 'react';
import {
  Sparkles,
  Settings,
  Plus,
  Trash2,
  Columns,
  Check,
  RotateCcw,
} from 'lucide-react';
import { TwoPointRule } from '../../types/callSheet';
import { TWO_POINT_CHART_RULES } from '../../data/callSheetData';

interface TwoPointChartBoxProps {
  rules?: TwoPointRule[];
  highlightEnabled?: boolean;
  onUpdateRules?: (rules: TwoPointRule[]) => void;
  onToggleHighlight?: () => void;
}

export const TwoPointChartBox: React.FC<TwoPointChartBoxProps> = ({
  rules: controlledRules,
  highlightEnabled = true,
  onUpdateRules,
  onToggleHighlight,
}) => {
  const [internalRules, setInternalRules] = useState<TwoPointRule[]>(
    controlledRules || TWO_POINT_CHART_RULES
  );
  const rules = controlledRules || internalRules;

  const [activeTestDiff, setActiveTestDiff] = useState<number | null>(null);
  const [testLeadOrTrail, setTestLeadOrTrail] = useState<'lead' | 'trail'>('trail');
  const [isEditing, setIsEditing] = useState(false);
  const [showNotesCol, setShowNotesCol] = useState(false);

  const selectedRule = activeTestDiff
    ? rules.find((r) => r.pointDiff === activeTestDiff)
    : null;

  const updateRules = (newRules: TwoPointRule[]) => {
    setInternalRules(newRules);
    if (onUpdateRules) {
      onUpdateRules(newRules);
    }
  };

  const handleAddRow = () => {
    const nextDiff = (rules[rules.length - 1]?.pointDiff || 18) + 1;
    const newRule: TwoPointRule = {
      pointDiff: nextDiff,
      leadAction: 'Go for 1',
      leadHighlight: false,
      trailAction: 'Go for 1',
      trailHighlight: false,
      notes: `Situation for ${nextDiff} point differential`,
    };
    updateRules([...rules, newRule]);
  };

  const handleRemoveRow = (diff: number) => {
    updateRules(rules.filter((r) => r.pointDiff !== diff));
  };

  const handleToggleRowLeadHighlight = (diff: number) => {
    updateRules(
      rules.map((r) =>
        r.pointDiff === diff ? { ...r, leadHighlight: !r.leadHighlight } : r
      )
    );
  };

  const handleToggleRowTrailHighlight = (diff: number) => {
    updateRules(
      rules.map((r) =>
        r.pointDiff === diff ? { ...r, trailHighlight: !r.trailHighlight } : r
      )
    );
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset 2-Point Conversion matrix to standard championship rules?')) {
      updateRules(TWO_POINT_CHART_RULES);
    }
  };

  return (
    <div
      className={`border shadow-xs rounded-none overflow-hidden print:overflow-visible print:border-black callsheet-twopoint-box callsheet-avoid-break flex flex-col transition-all ${
        highlightEnabled
          ? 'border-yellow-700/60 bg-slate-900 print:border-yellow-400/80 print:bg-white'
          : 'border-slate-800 bg-slate-900 print:border-slate-300 print:bg-white'
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className="bg-slate-800 p-1.5 border-b border-slate-700 flex items-center justify-between gap-2 text-xs print:bg-slate-200/90 print:border-slate-300">
        <div className="flex items-center gap-1 font-black text-slate-100 text-xs sm:text-[13px] print:text-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>2-PT CONVERSION MATRIX</span>
        </div>

        <div className="flex items-center gap-1.5 print:hidden">
          {/* Highlight toggle */}
          {onToggleHighlight ? (
            <button
              type="button"
              onClick={onToggleHighlight}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                highlightEnabled
                  ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Toggle yellow rule highlights on or off"
            >
              Highlight {highlightEnabled ? 'ON' : 'OFF'}
            </button>
          ) : null}

          {/* Edit toggle */}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Settings className="w-3 h-3" />
            <span>{isEditing ? 'Done' : 'Edit Table'}</span>
          </button>
        </div>
      </div>

      {/* 2. Editing Drawer (Add Row, Toggle Notes Column, Reset) */}
      {isEditing && (
        <div className="p-2 bg-slate-850 dark:bg-slate-950 border-b border-slate-700 text-slate-200 text-xs flex items-center justify-between gap-2 flex-wrap print:hidden animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Row</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNotesCol(!showNotesCol)}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border cursor-pointer ${
                showNotesCol
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>{showNotesCol ? 'Hide Notes Col' : 'Show Notes Col'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded text-[10px] font-bold flex items-center gap-1 border border-slate-700 cursor-pointer"
              title="Reset to default rules"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <span className="text-[10px] text-slate-400">
            Click highlights or trash icons in rows below to modify
          </span>
        </div>
      )}

      {/* 3. Interactive Quick Tester (Hidden on print) */}
      <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between gap-2 text-xs print:hidden">
        <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
          Situation Checker:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTestLeadOrTrail('lead')}
            className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-colors ${
              testLeadOrTrail === 'lead'
                ? 'bg-amber-400 text-black shadow-xs'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Lead By
          </button>
          <button
            type="button"
            onClick={() => setTestLeadOrTrail('trail')}
            className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer transition-colors ${
              testLeadOrTrail === 'trail'
                ? 'bg-amber-400 text-black shadow-xs'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Trail By
          </button>
        </div>
      </div>

      {/* Analytics insight banner (if row clicked) */}
      {selectedRule && selectedRule.notes && (
        <div className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-700/50 text-[11px] text-amber-950 dark:text-amber-200 font-bold flex items-center gap-1.5 print:hidden">
          <span className="font-black text-amber-700 dark:text-amber-400 font-mono">
            {testLeadOrTrail === 'lead'
              ? `Up ${selectedRule.pointDiff}:`
              : `Down ${selectedRule.pointDiff}:`}
          </span>
          <span>{selectedRule.notes}</span>
        </div>
      )}

      {/* 4. The 2-Pt Decision Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-center border-collapse text-[10.5px] sm:text-[11px] font-sans">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800 font-black tracking-wider text-slate-100 print:border-slate-400 print:bg-slate-200/90 print:text-slate-900">
              <th colSpan={2} className="py-1 px-2 border-r border-slate-700 font-black print:border-slate-400">
                LEAD BY
              </th>
              <th colSpan={2} className="py-1 px-2 font-black border-r border-slate-700 print:border-slate-400">
                TRAIL BY
              </th>
              {showNotesCol && (
                <th className="py-1 px-2 font-black">
                  NOTES
                </th>
              )}
              {isEditing && (
                <th className="py-1 px-1 font-black w-8">
                  ACT
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rules.map((row) => {
              const isLeadSelected = activeTestDiff === row.pointDiff && testLeadOrTrail === 'lead';
              const isTrailSelected = activeTestDiff === row.pointDiff && testLeadOrTrail === 'trail';

              const leadHasHighlight = highlightEnabled && row.leadHighlight;
              const trailHasHighlight = highlightEnabled && row.trailHighlight;

              return (
                <tr
                  key={row.pointDiff}
                  onClick={() => !isEditing && setActiveTestDiff(row.pointDiff)}
                  className="border-b border-slate-800 hover:bg-slate-800/60 transition-colors cursor-pointer print:border-slate-300 print:hover:bg-slate-100/80"
                >
                  {/* LEAD BY: Point Label */}
                  <td
                    className={`py-0.5 px-2 font-semibold text-slate-200 print:text-slate-800 text-left border-r border-slate-800 print:border-slate-300 select-none ${
                      leadHasHighlight
                        ? 'bg-yellow-400 text-black font-bold print:bg-yellow-300!'
                        : ''
                    } ${isLeadSelected ? 'ring-2 ring-indigo-500 font-black' : ''}`}
                    onClick={() => isEditing && handleToggleRowLeadHighlight(row.pointDiff)}
                    title={isEditing ? 'Click to toggle lead highlight' : undefined}
                  >
                    {row.pointDiff} {row.pointDiff === 1 ? 'point' : 'points'}
                  </td>

                  {/* LEAD BY: Action */}
                  <td
                    className={`py-0.5 px-2 font-black border-r-2 border-slate-700 print:border-slate-500 whitespace-nowrap select-none ${
                      leadHasHighlight
                        ? 'bg-yellow-400 text-black print:bg-yellow-300!'
                        : 'text-slate-300 print:text-slate-700'
                    }`}
                    onClick={() => isEditing && handleToggleRowLeadHighlight(row.pointDiff)}
                    title={isEditing ? 'Click to toggle lead highlight' : undefined}
                  >
                    {row.leadAction}
                  </td>

                  {/* TRAIL BY: Point Label */}
                  <td
                    className={`py-0.5 px-2 font-semibold text-slate-200 print:text-slate-800 text-left border-r border-slate-800 print:border-slate-300 select-none ${
                      trailHasHighlight
                        ? 'bg-yellow-400 text-black font-bold print:bg-yellow-300!'
                        : ''
                    } ${isTrailSelected ? 'ring-2 ring-indigo-500 font-black' : ''}`}
                    onClick={() => isEditing && handleToggleRowTrailHighlight(row.pointDiff)}
                    title={isEditing ? 'Click to toggle trail highlight' : undefined}
                  >
                    {row.pointDiff} {row.pointDiff === 1 ? 'point' : 'points'}
                  </td>

                  {/* TRAIL BY: Action */}
                  <td
                    className={`py-0.5 px-2 font-black border-r border-slate-800 print:border-slate-400 whitespace-nowrap select-none ${
                      trailHasHighlight
                        ? 'bg-yellow-400 text-black print:bg-yellow-300!'
                        : 'text-slate-300 print:text-slate-700'
                    }`}
                    onClick={() => isEditing && handleToggleRowTrailHighlight(row.pointDiff)}
                    title={isEditing ? 'Click to toggle trail highlight' : undefined}
                  >
                    {row.trailAction}
                  </td>

                  {/* Optional Notes Column */}
                  {showNotesCol && (
                    <td className="py-0.5 px-2 text-left text-[10px] text-slate-500 dark:text-slate-400 border-r border-slate-300 dark:border-slate-750 truncate max-w-[140px]">
                      {row.notes || '—'}
                    </td>
                  )}

                  {/* Editing Delete action */}
                  {isEditing && (
                    <td className="py-0.5 px-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.pointDiff)}
                        className="text-slate-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                        title="Delete rule row"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
