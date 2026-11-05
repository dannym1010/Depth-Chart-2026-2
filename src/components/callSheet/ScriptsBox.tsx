import React, { useState } from 'react';
import { Plus, Minus, Columns, Sparkles, Settings, ArrowUp, ArrowDown, ListPlus, Eraser } from 'lucide-react';
import { CallSheetPlay } from '../../types/callSheet';
import { CallSheetCellView } from './CallSheetCellView';

interface ScriptsBoxProps {
  scriptPlays: (CallSheetPlay | null)[];
  /** Header title (the opening script is "Scripts"; an extra script has its own name). */
  title?: string;
  headerColor?: string;
  /** Rename the script (extra scripts). */
  onRename?: (title: string) => void;
  /** Section id the cells belong to (drag-and-drop between tables). */
  sectionId?: string;
  columnsCount?: number;
  highlightEnabled?: boolean;
  onSlotClick: (index: number) => void;
  onClearSlot: (index: number) => void;
  onDropPlay: (index: number, play: CallSheetPlay) => void;
  onAddRow?: () => void;
  onRemoveRow?: () => void;
  onToggleColumns?: (cols: number) => void;
  onToggleHighlight?: () => void;
  /** Pick plays in order; they fill the empty rows (rows are added when it runs out). */
  onAddPlays?: () => void;
  /** Move a row's play up or down. */
  onMoveRow?: (index: number, dir: -1 | 1) => void;
  /** Empty every row. */
  onClearAll?: () => void;
}

export const ScriptsBox: React.FC<ScriptsBoxProps> = ({
  scriptPlays,
  title = 'Scripts',
  headerColor = '#7e22ce',
  onRename,
  sectionId = 'script',
  columnsCount = 1,
  highlightEnabled = false,
  onSlotClick,
  onClearSlot,
  onDropPlay,
  onAddRow,
  onRemoveRow,
  onToggleColumns,
  onToggleHighlight,
  onAddPlays,
  onMoveRow,
  onClearAll,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const filled = scriptPlays.filter(Boolean).length;

  const containerClasses = highlightEnabled
    ? 'bg-purple-950/20 border-purple-800 print:bg-purple-50/75 print:border-purple-400'
    : 'bg-slate-900 border-slate-750 print:bg-white print:border-black';

  const cellHighlight = highlightEnabled
    ? 'bg-purple-950/25 hover:bg-purple-950/45 text-purple-100 border-purple-800/50 print:bg-purple-50/70 print:hover:bg-purple-100 print:text-slate-900 print:border-purple-200'
    : undefined;

  return (
    <div
      className={`border shadow-xs rounded-none overflow-hidden print:overflow-visible print:border-black callsheet-scripts-box callsheet-avoid-break flex flex-col group transition-all ${containerClasses}`}
    >
      <div
        className="py-1 px-3 flex items-center justify-between gap-2 font-black text-sm uppercase tracking-wider text-white shadow-xs select-none"
        style={{ backgroundColor: headerColor }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditing && onRename ? (
            <input
              type="text"
              defaultValue={title}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== title && onRename(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              aria-label="Script name"
              className="min-w-0 w-32 px-1 py-0 rounded bg-white/15 border border-white/30 text-white text-xs font-black uppercase outline-none focus:border-white"
            />
          ) : (
            <span className="truncate">{title}</span>
          )}
          <span className="text-[10px] opacity-80 font-mono font-normal shrink-0">
            ({filled}/{scriptPlays.length})
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 print:hidden">
          {onAddPlays && (
            <button
              type="button"
              onClick={onAddPlays}
              className="px-1.5 py-0.5 rounded text-white/90 hover:text-white bg-white/10 hover:bg-white/25 transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1"
              title="Pick plays in the order you want them; they fill the empty rows (rows are added if it runs out)"
            >
              <ListPlus className="w-3 h-3" />
              <span>Add plays</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsEditing(!isEditing);
              setConfirmClear(false);
            }}
            className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1"
            title="Edit script rows, order, columns, or highlight"
          >
            <Settings className="w-3 h-3" />
            <span className="hidden sm:inline">{isEditing ? 'Done' : 'Edit'}</span>
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="p-2 bg-slate-850 dark:bg-slate-950 border-b border-slate-700 text-slate-200 text-xs flex items-center justify-between gap-2 flex-wrap print:hidden animate-in fade-in duration-150">
          <div className="flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Rows:</span>
            <span className="font-mono font-black text-amber-300 text-xs px-1">{scriptPlays.length}</span>
            {onAddRow && (
              <button type="button" onClick={onAddRow} className="p-0.5 hover:bg-slate-700 text-emerald-400 rounded cursor-pointer" title="Add script row">
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onRemoveRow && (
              <button type="button" onClick={onRemoveRow} className="p-0.5 hover:bg-slate-700 text-rose-400 rounded cursor-pointer" title="Remove bottom script row">
                <Minus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {onToggleColumns && (
            <div className="flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-0.5">
                <Columns className="w-3 h-3" />
                Cols:
              </span>
              {[1, 2, 3, 4].map((cols) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => onToggleColumns(cols)}
                  className={`px-1.5 py-0.2 rounded text-[10px] font-black cursor-pointer ${
                    columnsCount === cols ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cols}
                </button>
              ))}
            </div>
          )}

          {onToggleHighlight && (
            <button
              type="button"
              onClick={onToggleHighlight}
              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                highlightEnabled
                  ? 'bg-purple-400/20 text-purple-300 border-purple-400/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Toggle Script Highlight ON or OFF"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Highlight {highlightEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {onClearAll && filled > 0 && (
            confirmClear ? (
              <span className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-rose-300">Empty all {filled}?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                >
                  Yes
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer">
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-300 cursor-pointer"
                title="Empty every row of this script"
              >
                <Eraser className="w-3 h-3" />
                <span>Clear all</span>
              </button>
            )
          )}
          {onMoveRow && <span className="w-full text-[10px] text-slate-400">Use the arrows on each row to change the order.</span>}
        </div>
      )}

      <div
        className={`flex-1 divide-y divide-slate-300 dark:divide-slate-800 ${
          columnsCount > 1 ? `grid grid-cols-${columnsCount} divide-y-0 divide-x divide-slate-300 dark:divide-slate-800` : 'flex flex-col'
        }`}
        style={columnsCount > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))` } : undefined}
      >
        {scriptPlays.map((play, idx) => (
          <div key={`${sectionId}-${idx}`} className="flex items-stretch min-w-0">
            {isEditing && onMoveRow && (
              <div className="flex flex-col justify-center shrink-0 bg-slate-800/60 print:hidden">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => onMoveRow(idx, -1)}
                  aria-label={`Move row ${idx + 1} up`}
                  className="px-0.5 text-slate-300 hover:text-white disabled:opacity-25 cursor-pointer disabled:cursor-default"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={idx === scriptPlays.length - 1}
                  onClick={() => onMoveRow(idx, 1)}
                  aria-label={`Move row ${idx + 1} down`}
                  className="px-0.5 text-slate-300 hover:text-white disabled:opacity-25 cursor-pointer disabled:cursor-default"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CallSheetCellView
                sectionId={sectionId}
                slotIndex={idx}
                play={play}
                highlightClass={cellHighlight}
                onSlotClick={() => onSlotClick(idx)}
                onClearSlot={() => onClearSlot(idx)}
                onDropPlay={(p) => onDropPlay(idx, p)}
                onDirectUpdatePlay={(p) => onDropPlay(idx, p)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
