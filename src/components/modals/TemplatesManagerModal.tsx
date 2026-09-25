import React from 'react';
import { X, Settings } from 'lucide-react';
import { PracticePeriod } from '../../types';
import { PRACTICE_WEEKDAY_NAMES, PracticeWeekdayTemplateMap } from '../../utils/practiceUtils';

/* =========================================================================
   TEMPLATES MANAGER MODAL
   ========================================================================= */
interface TemplatesManagerModalProps {
  isOpen: boolean;
  templates: Record<string, PracticePeriod[]>;
  weekdayTemplates?: PracticeWeekdayTemplateMap;
  onClose: () => void;
  onRenameTemplate: (oldName: string, newName: string) => void;
  onDeleteTemplate: (name: string) => void;
  onSaveNewTemplate?: (name: string) => void;
  onSetWeekdayTemplate?: (day: (typeof PRACTICE_WEEKDAY_NAMES)[number], templateName: string) => void;
  onApplyWeekdayToUpcoming?: (day: (typeof PRACTICE_WEEKDAY_NAMES)[number], templateName: string) => void;
}

export const TemplatesManagerModal: React.FC<TemplatesManagerModalProps> = ({
  isOpen,
  templates,
  weekdayTemplates = {},
  onClose,
  onRenameTemplate,
  onDeleteTemplate,
  onSaveNewTemplate,
  onSetWeekdayTemplate,
  onApplyWeekdayToUpcoming,
}) => {
  const [newTemplateName, setNewTemplateName] = React.useState('');

  if (!isOpen) return null;

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    if (onSaveNewTemplate) {
      onSaveNewTemplate(newTemplateName.trim());
      setNewTemplateName('');
    }
  };

  const templateNames = Object.keys(templates);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-800/95 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-700/80 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <h3 className="font-black text-base text-slate-100">
              Manage Practice Templates
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {onSaveNewTemplate && (
          <form onSubmit={handleCreateTemplate} className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Save Active Practice as New Template
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g. Tuesday Full Pads / Thursday Walkthrough"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!newTemplateName.trim()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {onSetWeekdayTemplate && (
          <div className="space-y-2 border border-slate-700 p-3 rounded-2xl bg-slate-900/90">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
              Default template by weekday
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Choose a template for already-synced practices on that weekday. Only today and later this year are updated.
            </p>
            <div className="space-y-1.5">
              {PRACTICE_WEEKDAY_NAMES.map((day) => (
                <div key={day} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs font-bold text-slate-200">{day}</span>
                  <select
                    value={weekdayTemplates[day] || ''}
                    onChange={(e) => onSetWeekdayTemplate?.(day, e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none"
                  >
                    <option value="">Standard Practice</option>
                    {templateNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {onApplyWeekdayToUpcoming && (
                    <button
                      type="button"
                      onClick={() =>
                        onApplyWeekdayToUpcoming(day, weekdayTemplates[day] || 'Standard Practice')
                      }
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      Apply upcoming
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-700 p-3 rounded-2xl bg-slate-900/90">
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Saved Templates ({Object.keys(templates).length})
          </div>
          {Object.entries(templates).map(([name, periods]) => {
            const count = Array.isArray(periods) ? periods.length : 0;
            return (
              <div
                key={name}
                className="flex items-center justify-between p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-xs font-bold text-slate-200"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="truncate">{name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 text-[10px] font-mono border border-slate-700/60 shrink-0">
                    {count} {count === 1 ? 'period' : 'periods'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const newName = prompt('Rename template:', name);
                      if (newName && newName.trim() && newName !== name) {
                        onRenameTemplate(name, newName.trim());
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 rounded-lg text-slate-300 text-[11px] border border-slate-700 cursor-pointer"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete template "${name}"?`)) onDeleteTemplate(name);
                    }}
                    className="p-1 hover:bg-rose-950/50 text-rose-400 rounded-lg cursor-pointer"
                    title="Delete template"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {Object.keys(templates).length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400 italic">
              No saved templates yet. Click Save above to save your current plan as a reusable template.
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
