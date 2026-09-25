import React, { useState } from 'react';
import { X, Filter, Check } from 'lucide-react';
import { FormationBoard } from '../../types';

/* =========================================================================
   SCRIMMAGE MODALS (FILTER & PRINT)
   ========================================================================= */
interface ScrimmageFilterModalProps {
  isOpen: boolean;
  formations: FormationBoard[];
  currentFilters: string[] | null;
  onClose: () => void;
  onSaveFilters: (selectedIds: string[]) => void;
}

export const ScrimmageFilterModal: React.FC<ScrimmageFilterModalProps> = ({
  isOpen,
  formations,
  currentFilters,
  onClose,
  onSaveFilters,
}) => {
  const relevantForms = formations.filter(
    (f) => f && (f.unit === 'offense' || f.unit === 'defense')
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    currentFilters || relevantForms.map((f) => f.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-800/95 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <h3 className="font-black text-base text-slate-100">
              Filter Scrimmage Boards
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-700 p-3 rounded-2xl bg-slate-900/90">
          {relevantForms.map((f) => {
            const isChecked = selectedIds.includes(f.id);
            return (
              <label
                key={f.id}
                className="flex items-center gap-2.5 p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer hover:border-slate-600 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds([...selectedIds, f.id]);
                    else setSelectedIds(selectedIds.filter((id) => id !== f.id));
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700"
                />
                <span>
                  [{f.unit.toUpperCase()}] {f.name}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSaveFilters(selectedIds);
              onClose();
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 active:scale-95"
          >
            Save Filter
          </button>
        </div>
      </div>
    </div>
  );
};
