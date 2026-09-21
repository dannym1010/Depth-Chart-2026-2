import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Star, Trash2, Edit2, Check, X, Copy, ClipboardPaste } from 'lucide-react';
import { CallSheetPlay } from '../../types/callSheet';
import { WristbandSlotMatch, isDarkColor } from '../../utils/wristbandLinking';
import { getCopiedPlay, setCopiedPlay, subscribeCopiedPlay } from '../../utils/callSheetClipboard';

interface CallSheetCellViewProps {
  sectionId: string;
  slotIndex: number;
  play: CallSheetPlay | null;
  isRedZone?: boolean;
  highlightClass?: string;
  wristbandSlotMatch?: WristbandSlotMatch;
  onSlotClick: () => void;
  onClearSlot?: () => void;
  onDropPlay?: (droppedPlay: CallSheetPlay) => void;
  onDirectUpdatePlay?: (updatedPlay: CallSheetPlay) => void;
}

export const CallSheetCellView: React.FC<CallSheetCellViewProps> = ({
  sectionId,
  slotIndex,
  play,
  isRedZone = false,
  highlightClass,
  onSlotClick,
  onClearSlot,
  onDropPlay,
  onDirectUpdatePlay,
}) => {
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineName, setInlineName] = useState(play?.name || '');
  const [inlineWristband, setInlineWristband] = useState(play?.wristbandNum ? String(play.wristbandNum) : '');
  const [isDragOver, setIsDragOver] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [clipboardPlay, setClipboardPlay] = useState<CallSheetPlay | null>(() => getCopiedPlay());
  const inputRef = useRef<HTMLInputElement>(null);

  // Unconditionally evaluate hooks at top level before any early returns (Prevents React Error #300)
  const cleanPlayName = useMemo(() => {
    if (!play?.name) return '';
    return play.name
      .replace(/^#\s*\d*\s*[-.:]?\s*/i, '')
      .replace(/^\d+[\.\)]\s+/, '')
      .replace(/^#\s*/, '')
      .trim();
  }, [play?.name]);

  // Suppress 21 L / 21 R and 21 formation & personnel text to give maximum space to the play name
  const displayFormation = useMemo(() => {
    const rawForm = (play?.formation || '').trim();
    const nameToCheck = (play?.name || '').toUpperCase();
    const upperForm = rawForm.toUpperCase();
    if (
      upperForm === '21' ||
      upperForm === '21 L' ||
      upperForm === '21 R' ||
      upperForm.includes('21') ||
      nameToCheck.includes(upperForm) ||
      nameToCheck.startsWith('21') ||
      nameToCheck.includes('21 L') ||
      nameToCheck.includes('21 R') ||
      /\b21\b/.test(nameToCheck)
    ) {
      return '';
    }
    return rawForm;
  }, [play?.formation, play?.name]);

  useEffect(() => {
    return subscribeCopiedPlay((latest) => {
      setClipboardPlay(latest);
    });
  }, []);

  useEffect(() => {
    if (play) {
      setInlineName(play.name);
      setInlineWristband(play.wristbandNum ? String(play.wristbandNum) : '');
    } else {
      setInlineName('');
      setInlineWristband('');
    }
  }, [play]);

  useEffect(() => {
    if (isInlineEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isInlineEditing]);

  const handleCopyPlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!play || !play.name) return;
    setCopiedPlay({ ...play });
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1600);
  };

  const handlePastePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!clipboardPlay) return;
    const pasted: CallSheetPlay = {
      ...clipboardPlay,
      id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    if (onDirectUpdatePlay) {
      onDirectUpdatePlay(pasted);
    } else if (onDropPlay) {
      onDropPlay(pasted);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    // If a table is being dragged to re-order, let the event bubble cleanly to the table container
    if (
      (window as any).__activeCallSheetTableDrag ||
      e.dataTransfer.types.includes('application/callsheet-table-drag')
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    // If a table is being dragged, let the parent section/box handle the drop
    if (
      (window as any).__activeCallSheetTableDrag ||
      e.dataTransfer.types.includes('application/callsheet-table-drag')
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const activeDrag = (window as any).__activeCallSheetPlayDrag;
    (window as any).__activeCallSheetPlayDrag = null;

    try {
      // 1. Direct active drag memory object (handles all browsers and iframes reliably)
      if (activeDrag && (activeDrag.name || activeDrag.text) && onDropPlay) {
        onDropPlay({
          ...activeDrag,
          id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: activeDrag.name || activeDrag.text,
        });
        return;
      }

      // 2. Try application/json or callSheetPlayTransfer
      const dataStr =
        e.dataTransfer.getData('application/json') ||
        e.dataTransfer.getData('callSheetPlayTransfer');
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        if (parsed && (parsed.name || parsed.text) && onDropPlay) {
          onDropPlay({
            ...parsed,
            id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: parsed.name || parsed.text,
          });
          return;
        }
      }

      // 3. Try plain text
      const textStr = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
      if (textStr && onDropPlay) {
        try {
          const parsed = JSON.parse(textStr);
          if (parsed && (parsed.name || parsed.text)) {
            onDropPlay({
              ...parsed,
              id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: parsed.name || parsed.text,
            });
            return;
          }
        } catch {}
        onDropPlay({
          id: `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: textStr.trim().toUpperCase(),
        });
      }
    } catch (err) {
      console.error('Failed to parse dropped play:', err);
    }
  };

  const handleSaveInline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inlineName.trim();
    if (!trimmed) {
      setIsInlineEditing(false);
      return;
    }
    const wbNum = inlineWristband.trim() ? parseInt(inlineWristband.trim(), 10) : undefined;
    const updated: CallSheetPlay = {
      id: play?.id || `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      formation: play?.formation || '',
      type: play?.type,
      wristbandNum: !isNaN(wbNum as number) ? wbNum : play?.wristbandNum,
      personnel: play?.personnel,
      notes: play?.notes,
    };
    if (onDirectUpdatePlay) {
      onDirectUpdatePlay(updated);
    } else if (onDropPlay) {
      onDropPlay(updated);
    }
    setIsInlineEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isInlineEditing) {
      if (e.key === 'Enter') {
        handleSaveInline();
      } else if (e.key === 'Escape') {
        setInlineName(play?.name || '');
        setIsInlineEditing(false);
      }
      return;
    }

    // Copy shortcut (Ctrl+C / Cmd+C)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && play?.name) {
      e.preventDefault();
      handleCopyPlay();
    }
    // Paste shortcut (Ctrl+V / Cmd+V)
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboardPlay) {
      e.preventDefault();
      handlePastePlay();
    }
  };

  // Base background class
  const baseBgClass = highlightClass
    ? highlightClass
    : isRedZone
    ? 'bg-rose-950/25 hover:bg-rose-950/40 text-rose-100 border-rose-800/40 print:bg-rose-50/80 print:hover:bg-rose-100/90 print:text-slate-900 print:border-rose-300/80'
    : 'bg-slate-900 hover:bg-slate-850 text-slate-100 border-slate-800 print:bg-white print:hover:bg-slate-50 print:text-slate-900 print:border-slate-300';

  if (isInlineEditing) {
    return (
      <div
        className={`h-7 sm:h-7.5 px-2 border-b flex items-center gap-1.5 text-xs ${baseBgClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          placeholder="WB"
          value={inlineWristband}
          onChange={(e) => setInlineWristband(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-10 px-1 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-white text-center"
          title="Wristband Number"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Play Name"
          value={inlineName}
          onChange={(e) => setInlineName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] font-bold uppercase bg-slate-800 border border-indigo-500 rounded text-white"
        />
        <button
          type="button"
          onClick={handleSaveInline}
          className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded cursor-pointer"
          title="Save"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => {
            setInlineName(play?.name || '');
            setIsInlineEditing(false);
          }}
          className="p-1 text-slate-400 hover:bg-slate-500/20 rounded cursor-pointer"
          title="Cancel"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // If slot is empty
  if (!play || !play.name || !play.name.trim()) {
    return (
      <div
        tabIndex={0}
        onClick={onSlotClick}
        onDoubleClick={() => setIsInlineEditing(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        className={`callsheet-cell-slot callsheet-slot-empty h-7 sm:h-7.5 px-2 border-b flex items-center justify-between text-xs transition-all cursor-pointer group outline-none print:border-slate-300 print:bg-white ${baseBgClass} ${
          isDragOver ? 'ring-2 ring-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50' : ''
        }`}
        title="Click to select play, or paste copied play (Ctrl+V)"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 print:hidden">
          {clipboardPlay ? (
            <button
              type="button"
              onClick={(e) => handlePastePlay(e)}
              className="text-[10.5px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1.5 cursor-pointer print:hidden"
              title={`Paste copied play: ${clipboardPlay.name}`}
            >
              <ClipboardPaste className="w-3 h-3 text-indigo-500" />
              <span>Paste {clipboardPlay.name}</span>
            </button>
          ) : (
            <span className="text-[10px] text-indigo-500/80 dark:text-indigo-400/80 font-bold print:hidden">
              + Pick Play
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 print:hidden">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsInlineEditing(true);
            }}
            className="text-[10px] text-slate-500 hover:text-indigo-400 font-bold px-1 py-0.5 rounded cursor-pointer print:hidden"
            title="Type play directly"
          >
            Type
          </button>
          {clipboardPlay && (
            <button
              type="button"
              onClick={(e) => handlePastePlay(e)}
              className="p-1 rounded text-indigo-500 hover:bg-indigo-500/20 transition-colors cursor-pointer print:hidden"
              title={`Paste ${clipboardPlay.name}`}
            >
              <ClipboardPaste className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Linked wristband metadata
  const hasRealName = Boolean(play.name && play.name.trim());
  const match = play.wristbandSlotMatch;
  const hasWristbandSpot = Boolean(match || play.wristbandNum);
  const rawNum = match?.slotNumber ? String(match.slotNumber) : (play.wristbandNum ? String(play.wristbandNum) : '');
  const cleanDisplayNum = rawNum.replace(/^#\s*/, '').trim();

  // Exact number badge color matching wristband
  const numberBgColor =
    play.wristbandNumberColor ||
    match?.numberBgColor ||
    (play.wristbandColor && play.wristbandColor.startsWith('#') ? play.wristbandColor : undefined);

  const numberTextColor =
    play.wristbandTextColor ||
    match?.numberTextColor ||
    (numberBgColor ? (isDarkColor(numberBgColor) ? '#ffffff' : '#000000') : '#000000');

  const isWhiteText =
    numberTextColor.toLowerCase() === '#ffffff' ||
    numberTextColor.toLowerCase() === '#fff' ||
    numberTextColor.toLowerCase() === 'white' ||
    (numberBgColor ? isDarkColor(numberBgColor) : false);

  const finalBadgeTextColor = isWhiteText ? '#ffffff' : numberTextColor;

  // Row highlight color
  const rowHighlightColor =
    play.wristbandRowColor ||
    (play.isHighlighted && play.highlightColor ? play.highlightColor : undefined) ||
    match?.rowHighlightColor;

  const isDarkRowHighlight = rowHighlightColor ? isDarkColor(rowHighlightColor) : false;

  const isStarred = Boolean(play.isStarred);
  const isLongName = play.name.length > 20;

  const effectiveBgStyle: React.CSSProperties | undefined = rowHighlightColor
    ? {
        backgroundColor: rowHighlightColor,
        borderLeft: `3.5px solid ${numberBgColor || '#4f46e5'}`,
        color: isDarkRowHighlight ? '#ffffff' : '#0f172a',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }
    : undefined;

  return (
    <div
      tabIndex={0}
      draggable={Boolean(hasRealName && !isInlineEditing)}
      onDragStart={(e) => {
        if (!play || !hasRealName) return;
        const playData = {
          ...play,
          id: play.id || `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sourceSectionId: sectionId,
          sourceSlotIndex: slotIndex,
        };
        (window as any).__activeCallSheetPlayDrag = playData;
        let jsonStr = '';
        try {
          jsonStr = JSON.stringify(playData);
          e.dataTransfer.setData('application/json', jsonStr);
          e.dataTransfer.setData('callSheetPlayTransfer', jsonStr);
          e.dataTransfer.setData('text/plain', play.name);
        } catch {}
        e.dataTransfer.effectAllowed = 'copyMove';
      }}
      onDragEnd={() => {
        (window as any).__activeCallSheetPlayDrag = null;
      }}
      onClick={onSlotClick}
      onDoubleClick={() => setIsInlineEditing(true)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      style={effectiveBgStyle}
      data-row-text-white={isDarkRowHighlight ? 'true' : 'false'}
      className={`min-h-[28px] sm:min-h-[30px] py-1 px-1.5 sm:px-2 border-b flex items-center justify-between gap-1 text-xs select-none transition-all cursor-pointer group print:py-0.5 print:min-h-0 outline-none callsheet-cell-slot ${
        !hasRealName ? 'callsheet-slot-empty' : ''
      } ${
        isDarkRowHighlight
          ? 'has-dark-row-highlight text-white border-slate-300'
          : rowHighlightColor
          ? 'text-slate-900 border-slate-300'
          : baseBgClass
      } ${isDragOver ? 'ring-2 ring-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50' : ''}`}
      title="Click to change play, drag to move/copy to another cell, or press Ctrl+C / Ctrl+V"
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1 print:overflow-visible">
        {/* Exact Wristband Number Badge - cleanly displays slot number without hash sign */}
        {cleanDisplayNum && (
          <span
            data-wristband-badge="true"
            data-text-color={isWhiteText ? 'white' : 'black'}
            className={`wristband-number-badge px-1.5 py-0.5 rounded font-black text-[9.5px] font-mono shrink-0 shadow-xs flex items-center gap-0.5 leading-tight select-none print:text-[9px] print:px-1 ${
              isWhiteText ? 'badge-text-white print:!text-white' : 'badge-text-black print:!text-black'
            } ${
              !hasRealName ? 'print:hidden' : ''
            } ${
              hasWristbandSpot
                ? 'border border-black/20'
                : 'bg-slate-200 dark:bg-slate-700/80 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600'
            }`}
            style={
              hasWristbandSpot && numberBgColor
                ? {
                    backgroundColor: numberBgColor,
                    color: finalBadgeTextColor,
                    WebkitTextFillColor: finalBadgeTextColor,
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }
                : undefined
            }
            title={
              hasWristbandSpot
                ? (play.wristbandTitle || match?.wristbandTitle
                  ? `${play.wristbandTitle || match?.wristbandTitle} Slot ${cleanDisplayNum}`
                  : `Wristband Slot ${cleanDisplayNum}`)
                : `No spot on wristband (${cleanDisplayNum})`
            }
          >
            {cleanDisplayNum}
          </span>
        )}

        {/* Play Name - Full play visible with expanded space */}
        <span
          className={`font-black uppercase tracking-tight break-words min-w-0 flex-1 print:overflow-visible print:break-words ${
            isLongName
              ? 'text-[11px] sm:text-[11.5px] leading-tight print:text-[10px]'
              : 'text-[12px] sm:text-[13px] leading-tight print:text-[11.5px]'
          } ${
            !hasRealName
              ? 'text-slate-400 dark:text-slate-500 italic font-normal print:hidden'
              : isDarkRowHighlight
              ? 'text-white font-bold print:!text-white'
              : rowHighlightColor
              ? 'text-slate-900 font-bold'
              : 'text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 print:!text-black print:group-hover:!text-black'
          }`}
          style={
            isDarkRowHighlight
              ? { color: '#ffffff', WebkitTextFillColor: '#ffffff' }
              : rowHighlightColor
              ? { color: '#0f172a', WebkitTextFillColor: '#0f172a' }
              : undefined
          }
        >
          {hasRealName ? (
            cleanPlayName
          ) : (
            <span className="print:hidden">(Open Slot)</span>
          )}
        </span>

        {/* Formation or Type tag (non-21 formations only) */}
        {displayFormation && (
          <span
            className={`text-[9px] font-mono shrink-0 hidden sm:inline-block print:text-[8px] print:inline-block ${
              isDarkRowHighlight
                ? 'text-white/90 print:!text-white'
                : rowHighlightColor
                ? 'text-slate-700'
                : 'text-slate-500 dark:text-slate-400 print:!text-slate-800 print:group-hover:!text-slate-800'
            }`}
          >
            ({displayFormation})
          </span>
        )}

        {/* Copied feedback badge */}
        {copyFeedback && (
          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-1 py-0.2 rounded animate-pulse">
            Copied!
          </span>
        )}
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-1 shrink-0 print:hidden">
        {isStarred && (
          <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
        )}

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopyPlay}
          className="w-4 h-4 rounded hover:bg-slate-500/20 text-slate-400 hover:text-indigo-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          title="Copy play (Ctrl+C)"
        >
          <Copy className="w-2.5 h-2.5" />
        </button>

        {/* Paste button if clipboard has play */}
        {clipboardPlay && (
          <button
            type="button"
            onClick={handlePastePlay}
            className="w-4 h-4 rounded hover:bg-slate-500/20 text-slate-400 hover:text-emerald-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title={`Paste ${clipboardPlay.name} (Ctrl+V)`}
          >
            <ClipboardPaste className="w-2.5 h-2.5" />
          </button>
        )}

        {/* Quick edit inline button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsInlineEditing(true);
          }}
          className="w-4 h-4 rounded hover:bg-slate-500/20 text-slate-400 hover:text-indigo-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          title="Type/edit directly"
        >
          <Edit2 className="w-2.5 h-2.5" />
        </button>

        {onClearSlot && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClearSlot();
            }}
            className="w-4 h-4 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Clear play from slot"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
};
