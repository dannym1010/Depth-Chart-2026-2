import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Minus,
  Palette,
  Trash2,
  Columns,
  Sparkles,
  Edit2,
  Check,
  X,
  Sliders,
  Eraser,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { CallSheetSection, CallSheetPlay } from '../../types/callSheet';
import { CallSheetCellView } from './CallSheetCellView';

interface CallSheetSectionBoxProps {
  section: CallSheetSection;
  isRedZoneParent?: boolean;
  onSlotClick: (slotIndex: number) => void;
  onClearSlot: (slotIndex: number) => void;
  onDropPlay: (slotIndex: number, play: CallSheetPlay) => void;
  onUpdateSection?: (updated: CallSheetSection) => void;
  onDeleteSection?: (sectionId: string) => void;
  // Drag & Reorder props for the table itself:
  isDraggable?: boolean;
  onDragStartTable?: (e: React.DragEvent, sectionId: string) => void;
  onDragEndTable?: (e: React.DragEvent) => void;
  onDragOverTable?: (e: React.DragEvent, sectionId: string) => void;
  onDropOnTable?: (e: React.DragEvent, targetSectionId: string) => void;
  onMoveTableLeft?: (sectionId: string) => void;
  onMoveTableRight?: (sectionId: string) => void;
  onMoveTableUpRow?: (sectionId: string) => void;
  onMoveTableDownRow?: (sectionId: string) => void;
  onMoveTableToRow?: (sectionId: string, targetRowIndex: number) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  canMoveUpRow?: boolean;
  canMoveDownRow?: boolean;
  isDragTarget?: boolean;
  isDragging?: boolean;
  rowIndex?: number;
  availableRowIndices?: number[];
}

const COLOR_SWATCHES = [
  '#dc2626', // Red
  '#16a34a', // Green
  '#ea580c', // Orange
  '#2563eb', // Blue
  '#eab308', // Yellow
  '#78350f', // Olive/Brown
  '#65a30d', // Light Olive
  '#09090b', // Black
  '#0284c7', // Cyan
  '#84cc16', // Lime
  '#7e22ce', // Purple
  '#0f766e', // Teal
  '#64748b', // Slate
  '#60a5fa', // Light Blue
  '#881337', // Maroon
];

const HIGHLIGHT_COLORS: { id: string; label: string; bgClass: string; cellClass: string }[] = [
  {
    id: 'rose',
    label: 'Red / Rose',
    bgClass: 'bg-rose-950/25 border-rose-800/80 print:bg-rose-50/70 print:border-rose-400',
    cellClass: 'bg-rose-950/25 hover:bg-rose-950/45 text-rose-100 border-rose-800/50 print:bg-rose-50/80 print:hover:bg-rose-100/90 print:text-slate-900 print:border-rose-300',
  },
  {
    id: 'yellow',
    label: 'Gold / Alert',
    bgClass: 'bg-yellow-950/25 border-yellow-700/80 print:bg-yellow-50/80 print:border-yellow-400',
    cellClass: 'bg-yellow-950/25 hover:bg-yellow-950/45 text-yellow-100 border-yellow-800/50 print:bg-yellow-50/80 print:hover:bg-yellow-100/90 print:text-slate-900 print:border-yellow-300',
  },
  {
    id: 'emerald',
    label: 'Green / Go',
    bgClass: 'bg-emerald-950/25 border-emerald-800/80 print:bg-emerald-50/70 print:border-emerald-400',
    cellClass: 'bg-emerald-950/25 hover:bg-emerald-950/45 text-emerald-100 border-emerald-800/50 print:bg-emerald-50/80 print:hover:bg-emerald-100/90 print:text-slate-900 print:border-emerald-300',
  },
  {
    id: 'cyan',
    label: 'Cyan / Deep',
    bgClass: 'bg-cyan-950/25 border-cyan-800/80 print:bg-cyan-50/70 print:border-cyan-400',
    cellClass: 'bg-cyan-950/25 hover:bg-cyan-950/45 text-cyan-100 border-cyan-800/50 print:bg-cyan-50/80 print:hover:bg-cyan-100/90 print:text-slate-900 print:border-cyan-300',
  },
  {
    id: 'purple',
    label: 'Purple / Special',
    bgClass: 'bg-purple-950/25 border-purple-800/80 print:bg-purple-50/70 print:border-purple-400',
    cellClass: 'bg-purple-950/25 hover:bg-purple-950/45 text-purple-100 border-purple-800/50 print:bg-purple-50/80 print:hover:bg-purple-100/90 print:text-slate-900 print:border-purple-300',
  },
];

export const CallSheetSectionBox: React.FC<CallSheetSectionBoxProps> = ({
  section,
  isRedZoneParent = false,
  onSlotClick,
  onClearSlot,
  onDropPlay,
  onUpdateSection,
  onDeleteSection,
  isDraggable = false,
  onDragStartTable,
  onDragEndTable,
  onDragOverTable,
  onDropOnTable,
  onMoveTableLeft,
  onMoveTableRight,
  onMoveTableUpRow,
  onMoveTableDownRow,
  onMoveTableToRow,
  canMoveLeft = false,
  canMoveRight = false,
  canMoveUpRow = false,
  canMoveDownRow = false,
  isDragTarget = false,
  isDragging = false,
  rowIndex,
  availableRowIndices = [],
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(section.title);
  }, [section.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const columnsCount = section.columnsCount || 1;
  const isHighlighted = section.highlightEnabled ?? isRedZoneParent;
  const highlightColorKey = section.highlightColor || (isRedZoneParent ? 'rose' : 'yellow');
  const highlightConfig = HIGHLIGHT_COLORS.find((h) => h.id === highlightColorKey) || HIGHLIGHT_COLORS[0];

  const filledCount = section.plays.filter(Boolean).length;

  const handleSaveTitle = () => {
    if (onUpdateSection && editTitle.trim()) {
      onUpdateSection({
        ...section,
        title: editTitle.trim(),
      });
    }
    setIsEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setEditTitle(section.title);
    setIsEditingTitle(false);
  };

  const handleSelectColor = (color: string) => {
    if (onUpdateSection) {
      const isLight = ['#eab308', '#84cc16', '#60a5fa', '#facc15'].includes(color);
      onUpdateSection({
        ...section,
        headerBgColor: color,
        headerTextColor: isLight ? '#000000' : '#ffffff',
      });
    }
  };

  const handleDirectUpdatePlay = (slotIndex: number, play: CallSheetPlay) => {
    if (onUpdateSection) {
      const nextPlays = [...section.plays];
      nextPlays[slotIndex] = play;
      onUpdateSection({
        ...section,
        plays: nextPlays,
      });
    }
  };

  const handleAddSlot = () => {
    if (onUpdateSection) {
      onUpdateSection({
        ...section,
        slotsCount: section.slotsCount + 1,
        plays: [...section.plays, null],
      });
    }
  };

  const handleRemoveSlot = () => {
    if (onUpdateSection && section.slotsCount > 1) {
      onUpdateSection({
        ...section,
        slotsCount: section.slotsCount - 1,
        plays: section.plays.slice(0, section.slotsCount - 1),
      });
    }
  };

  const handleSetColumns = (newCols: number) => {
    if (onUpdateSection) {
      const existingHeaders = section.columnHeaders || [];
      const newHeaders = Array.from({ length: newCols }).map(
        (_, i) => existingHeaders[i] || `Col ${i + 1}`
      );
      onUpdateSection({
        ...section,
        columnsCount: newCols,
        columnHeaders: newHeaders,
        colSpan: newCols >= 2 ? Math.min(newCols, 3) : 1,
      });
    }
  };

  const handleUpdateColumnHeader = (colIdx: number, text: string) => {
    if (onUpdateSection) {
      const current = [...(section.columnHeaders || Array.from({ length: columnsCount }).map((_, i) => `Col ${i + 1}`))];
      current[colIdx] = text;
      onUpdateSection({
        ...section,
        columnHeaders: current,
      });
    }
  };

  const handleToggleHighlight = () => {
    if (onUpdateSection) {
      onUpdateSection({
        ...section,
        highlightEnabled: !isHighlighted,
      });
    }
  };

  const handleSelectHighlightColor = (colorId: string) => {
    if (onUpdateSection) {
      onUpdateSection({
        ...section,
        highlightEnabled: true,
        highlightColor: colorId,
      });
    }
  };

  const handleClearTablePlays = () => {
    if (onUpdateSection) {
      onUpdateSection({
        ...section,
        plays: Array(section.slotsCount).fill(null),
      });
    }
  };

  const handleDelete = () => {
    if (onDeleteSection) {
      onDeleteSection(section.id);
    }
    setIsConfirmingDelete(false);
  };

  // Determine container styling based on highlight status
  const containerClasses = isHighlighted
    ? highlightConfig.bgClass
    : 'bg-slate-900 border-slate-750 print:bg-white print:border-black';

  return (
    <div
      onDragOver={(e) => {
        const isTableDrag =
          (window as any).__activeCallSheetTableDrag ||
          e.dataTransfer.types.includes('application/callsheet-table-drag');
        if (isTableDrag) {
          e.preventDefault();
          e.stopPropagation();
          onDragOverTable?.(e, section.id);
        }
      }}
      onDrop={(e) => {
        const isTableDrag =
          (window as any).__activeCallSheetTableDrag ||
          e.dataTransfer.types.includes('application/callsheet-table-drag') ||
          e.dataTransfer.getData('application/callsheet-table-drag');
        if (isTableDrag) {
          e.preventDefault();
          e.stopPropagation();
          onDropOnTable?.(e, section.id);
        }
      }}
      className={`border shadow-xs rounded-none overflow-hidden print:overflow-visible print:border-black callsheet-section-card callsheet-avoid-break flex flex-col transition-all group ${containerClasses} ${
        isDragging ? 'opacity-35 ring-2 ring-indigo-500 scale-[0.98]' : ''
      } ${
        isDragTarget ? 'ring-2 ring-indigo-500 shadow-lg scale-[1.01] border-indigo-500' : ''
      }`}
    >
      {/* 1. Header Bar */}
      <div
        draggable={isDraggable && !isEditingTitle}
        onDragStart={(e) => {
          if (isEditingTitle) return;
          (window as any).__activeCallSheetTableDrag = section.id;
          e.dataTransfer.setData('application/callsheet-table-drag', section.id);
          e.dataTransfer.setData('text/plain', section.id);
          e.dataTransfer.effectAllowed = 'move';
          onDragStartTable?.(e, section.id);
        }}
        onDragEnd={(e) => {
          (window as any).__activeCallSheetTableDrag = null;
          onDragEndTable?.(e);
        }}
        className={`py-1 px-2 flex items-center justify-between font-black text-xs uppercase tracking-wider select-none relative transition-colors ${
          isDraggable && !isEditingTitle ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={{
          backgroundColor: section.headerBgColor,
          color: section.headerTextColor,
        }}
      >
        {!isEditingTitle ? (
          <div className="flex items-center justify-between w-full min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {isDraggable && (
                <div
                  title="Drag table to rearrange or move across rows"
                  className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-inherit opacity-85 hover:opacity-100 hover:bg-black/25 rounded transition-opacity print:hidden shrink-0 flex items-center"
                >
                  <GripVertical className="w-4 h-4" />
                </div>
              )}
              <span
                className="truncate cursor-pointer hover:underline text-[11.5px] sm:text-xs"
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit table title (or click settings icon for layout & rows)"
              >
                {section.title}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {/* Quick Move Buttons on hover */}
              <div className="hidden group-hover:flex items-center gap-0.5 print:hidden">
                {canMoveLeft && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveTableLeft?.(section.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/25 text-inherit transition-colors cursor-pointer"
                    title="Move table left"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                )}
                {canMoveRight && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveTableRight?.(section.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/25 text-inherit transition-colors cursor-pointer"
                    title="Move table right"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                {canMoveUpRow && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveTableUpRow?.(section.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/25 text-inherit transition-colors cursor-pointer"
                    title="Move table to row above"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                )}
                {canMoveDownRow && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveTableDownRow?.(section.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/25 text-inherit transition-colors cursor-pointer"
                    title="Move table to row below"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                )}
              </div>
              {/* Quick edit drawer toggle button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDrawerOpen(!isDrawerOpen);
                }}
                className={`hover:scale-110 p-0.5 rounded text-inherit transition-all print:hidden cursor-pointer ${
                  isDrawerOpen ? 'bg-black/30 opacity-100' : 'opacity-70 group-hover:opacity-100'
                }`}
                title="Table options & layout settings"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') handleCancelEditTitle();
              }}
              className="px-1.5 py-0.5 bg-black/40 text-white rounded text-xs font-bold border border-white/40 focus:outline-none w-full"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSaveTitle}
              className="px-1.5 py-0.5 rounded bg-white text-black text-[10px] font-black cursor-pointer shrink-0"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* 2. Interactive Editing Drawer (Rows, Columns, Highlight, Color, Delete, Row Position) */}
      {isDrawerOpen && (
        <div className="p-2 bg-slate-950 border-b border-slate-800 text-slate-200 text-xs space-y-2 print:hidden animate-in fade-in duration-150">
          {/* Top Row: Rows, Columns, Highlight, and Delete */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Rows (+/-) */}
            <div className="flex items-center gap-1 bg-slate-850 px-1.5 py-0.5 rounded border border-slate-750 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Rows:</span>
              <span className="font-mono font-black text-amber-400 text-xs px-1">
                {section.slotsCount}
              </span>
              <button
                type="button"
                onClick={handleAddSlot}
                className="p-0.5 hover:bg-slate-700 text-emerald-400 rounded cursor-pointer"
                title="Add row"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemoveSlot}
                className="p-0.5 hover:bg-slate-700 text-rose-400 rounded cursor-pointer"
                title="Remove bottom row"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Columns (1, 2, 3, 4) */}
            <div className="flex items-center gap-1 bg-slate-850 px-1.5 py-0.5 rounded border border-slate-750 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-0.5">
                <Columns className="w-3 h-3" />
                Cols:
              </span>
              {[1, 2, 3, 4].map((cols) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => handleSetColumns(cols)}
                  className={`px-1.5 py-0.2 rounded text-[10px] font-black cursor-pointer ${
                    columnsCount === cols
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cols}
                </button>
              ))}
            </div>

            {/* Highlight Toggle */}
            <button
              type="button"
              onClick={handleToggleHighlight}
              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                isHighlighted
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                  : 'bg-slate-850 text-slate-400 border-slate-750 hover:text-slate-200'
              }`}
              title="Toggle table highlight ON or OFF"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Highlight {isHighlighted ? 'ON' : 'OFF'}</span>
            </button>

            {/* Delete Section Button */}
            {onDeleteSection && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-800/60 hover:bg-rose-600 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                title="Delete this section table"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>

          {/* Row Placement quick controls */}
          {(canMoveLeft || canMoveRight || canMoveUpRow || canMoveDownRow || rowIndex !== undefined || onMoveTableToRow) && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <GripVertical className="w-3 h-3" />
                  Row {rowIndex !== undefined ? rowIndex + 1 : 1}:
                </span>
                {onMoveTableToRow && availableRowIndices.length > 0 && (
                  <select
                    value={rowIndex !== undefined ? rowIndex : 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) onMoveTableToRow(section.id, val);
                    }}
                    className="bg-slate-850 text-indigo-300 font-bold text-[10px] rounded px-1.5 py-0.5 border border-slate-750 focus:outline-none cursor-pointer"
                    title="Change which row this table belongs to"
                  >
                    {availableRowIndices.map((r) => (
                      <option key={r} value={r}>
                        Move to Row {r + 1}
                      </option>
                    ))}
                    <option value={Math.max(...availableRowIndices, 0) + 1}>+ New Row</option>
                  </select>
                )}
              </div>
              <div className="flex items-center gap-1">
                {canMoveLeft && (
                  <button
                    type="button"
                    onClick={() => onMoveTableLeft?.(section.id)}
                    className="px-1.5 py-0.5 rounded bg-slate-850 hover:bg-slate-750 text-slate-200 border border-slate-750 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <ArrowLeft className="w-3 h-3" /> Left
                  </button>
                )}
                {canMoveRight && (
                  <button
                    type="button"
                    onClick={() => onMoveTableRight?.(section.id)}
                    className="px-1.5 py-0.5 rounded bg-slate-850 hover:bg-slate-750 text-slate-200 border border-slate-750 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    Right <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                {canMoveUpRow && (
                  <button
                    type="button"
                    onClick={() => onMoveTableUpRow?.(section.id)}
                    className="px-1.5 py-0.5 rounded bg-slate-850 hover:bg-slate-750 text-indigo-300 border border-slate-750 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <ArrowUp className="w-3 h-3" /> Row Above
                  </button>
                )}
                {canMoveDownRow && (
                  <button
                    type="button"
                    onClick={() => onMoveTableDownRow?.(section.id)}
                    className="px-1.5 py-0.5 rounded bg-slate-850 hover:bg-slate-750 text-indigo-300 border border-slate-750 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <ArrowDown className="w-3 h-3" /> Row Below
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Highlight Color Palette (when highlight is on) */}
          {isHighlighted && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
              <span className="text-[10px] font-bold text-slate-400">Tint Color:</span>
              <div className="flex items-center gap-1">
                {HIGHLIGHT_COLORS.map((hc) => (
                  <button
                    key={hc.id}
                    type="button"
                    onClick={() => handleSelectHighlightColor(hc.id)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                      highlightColorKey === hc.id
                        ? 'bg-white text-black border-white shadow-2xs'
                        : 'bg-slate-850 text-slate-300 border-slate-750 hover:border-slate-600'
                    }`}
                  >
                    {hc.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Header Color Swatches */}
          <div className="flex items-center gap-1 pt-1 border-t border-slate-200 dark:border-slate-800 overflow-x-auto pb-0.5">
            <Palette className="w-3 h-3 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Header:</span>
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleSelectColor(color)}
                className={`w-4 h-4 rounded-full shrink-0 border cursor-pointer hover:scale-110 transition-transform ${
                  section.headerBgColor === color
                    ? 'ring-2 ring-indigo-500 border-black'
                    : 'border-slate-300 dark:border-white/30'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sub-column headers when multi-column */}
      {columnsCount > 1 && (
        <div
          className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700 divide-x divide-slate-300 dark:divide-slate-700 print:bg-slate-100"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: columnsCount }).map((_, colIdx) => (
            <div key={colIdx} className="px-1 py-0.5 flex items-center justify-between min-w-0">
              <input
                type="text"
                value={section.columnHeaders?.[colIdx] ?? `Col ${colIdx + 1}`}
                onChange={(e) => handleUpdateColumnHeader(colIdx, e.target.value)}
                placeholder={`Col ${colIdx + 1}`}
                className="w-full text-[10px] font-black uppercase text-center bg-transparent border-0 focus:outline-none focus:bg-white/50 dark:focus:bg-black/30 rounded text-slate-700 dark:text-slate-200 tracking-wider"
                title={`Click to edit header for Column ${colIdx + 1}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* 3. Cell Slots Table with Dynamic Multi-Column Support */}
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
        {Array.from({ length: section.slotsCount }).map((_, slotIdx) => {
          const play = section.plays[slotIdx] || null;
          return (
            <CallSheetCellView
              key={`${section.id}-${slotIdx}`}
              sectionId={section.id}
              slotIndex={slotIdx}
              play={play}
              isRedZone={isRedZoneParent}
              highlightClass={isHighlighted ? highlightConfig.cellClass : undefined}
              onSlotClick={() => onSlotClick(slotIdx)}
              onClearSlot={() => onClearSlot(slotIdx)}
              onDropPlay={(p) => onDropPlay(slotIdx, p)}
              onDirectUpdatePlay={(p) => handleDirectUpdatePlay(slotIdx, p)}
            />
          );
        })}
      </div>
    </div>
  );
};
