import React, { useState } from 'react';
import { Plus, Minus, Columns, Sparkles, Edit2, Settings } from 'lucide-react';
import { CallSheetPlay } from '../../types/callSheet';
import { CallSheetCellView } from './CallSheetCellView';

interface ScriptsBoxProps {
  scriptPlays: (CallSheetPlay | null)[];
  columnsCount?: number;
  highlightEnabled?: boolean;
  onSlotClick: (index: number) => void;
  onClearSlot: (index: number) => void;
  onDropPlay: (index: number, play: CallSheetPlay) => void;
  onAddRow?: () => void;
  onRemoveRow?: () => void;
  onToggleColumns?: (cols: number) => void;
  onToggleHighlight?: () => void;
}

export const ScriptsBox: React.FC<ScriptsBoxProps> = ({
  scriptPlays,
  columnsCount = 1,
  highlightEnabled = false,
  onSlotClick,
  onClearSlot,
  onDropPlay,
  onAddRow,
  onRemoveRow,
  onToggleColumns,
  onToggleHighlight,
}) => {
  const [isEditing, setIsEditing] = useState(false);

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
      {/* Header Bar matching reference: Purple header */}
      <div
        className="py-1 px-3 flex items-center justify-between font-black text-sm uppercase tracking-wider text-white shadow-xs select-none"
        style={{ backgroundColor: '#7e22ce' }}
      >
        <div className="flex items-center gap-1.5">
          <span>Scripts</span>
          <span className="text-[10px] opacity-80 font-mono font-normal">
            ({scriptPlays.filter(Boolean).length}/{scriptPlays.length})
          </span>
        </div>

        {/* Edit toggle button */}
        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer print:hidden text-[10px] font-bold flex items-center gap-1"
          title="Edit script rows, columns, or highlight"
        >
          <Settings className="w-3 h-3" />
          <span className="hidden sm:inline">{isEditing ? 'Done' : 'Edit'}</span>
        </button>
      </div>

      {/* Editing Controls Drawer */}
      {isEditing && (
        <div className="p-2 bg-slate-850 dark:bg-slate-950 border-b border-slate-700 text-slate-200 text-xs flex items-center justify-between gap-2 flex-wrap print:hidden animate-in fade-in duration-150">
          {/* Rows +/- */}
          <div className="flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Rows:</span>
            <span className="font-mono font-black text-amber-300 text-xs px-1">
              {scriptPlays.length}
            </span>
            {onAddRow && (
              <button
                type="button"
                onClick={onAddRow}
                className="p-0.5 hover:bg-slate-700 text-emerald-400 rounded cursor-pointer"
                title="Add script row"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onRemoveRow && (
              <button
                type="button"
                onClick={onRemoveRow}
                className="p-0.5 hover:bg-slate-700 text-rose-400 rounded cursor-pointer"
                title="Remove bottom script row"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Columns (1, 2, 3, 4) */}
          <div className="flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-0.5">
              <Columns className="w-3 h-3" />
              Cols:
            </span>
            {[1, 2, 3, 4].map((cols) => (
              <button
                key={cols}
                type="button"
                onClick={() => onToggleColumns && onToggleColumns(cols)}
                className={`px-1.5 py-0.2 rounded text-[10px] font-black cursor-pointer ${
                  columnsCount === cols
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cols}
              </button>
            ))}
          </div>

          {/* Highlight Toggle */}
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
        </div>
      )}

      {/* Scripted Rows with Multi-Column Support */}
      <div
        className={`flex-1 divide-y divide-slate-300 dark:divide-slate-800 ${
          columnsCount > 1
            ? `grid grid-cols-${columnsCount} divide-y-0 divide-x divide-slate-300 dark:divide-slate-800`
            : 'flex flex-col'
        }`}
        style={
          columnsCount > 1
            ? {
                display: 'grid',
                gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))`,
              }
            : undefined
        }
      >
        {scriptPlays.map((play, idx) => (
          <CallSheetCellView
            key={`script-${idx}`}
            sectionId="script"
            slotIndex={idx}
            play={play}
            highlightClass={cellHighlight}
            onSlotClick={() => onSlotClick(idx)}
            onClearSlot={() => onClearSlot(idx)}
            onDropPlay={(p) => onDropPlay(idx, p)}
            onDirectUpdatePlay={(p) => onDropPlay(idx, p)}
          />
        ))}
      </div>
    </div>
  );
};
