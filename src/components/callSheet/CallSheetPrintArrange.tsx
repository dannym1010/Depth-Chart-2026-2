// Print → Arrange: a map of the printed page. Drag a table (or tap it, then tap where it goes) to another spot, row or
// part; move whole parts up and down; set a table's width; choose where page 2 starts. Every move is saved on the call
// sheet (the screen follows), and the live preview beside it shows the real printout.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlignVerticalJustifyStart, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, RotateCcw, Undo2, X } from 'lucide-react';
import type { CallSheetFullData, CallSheetSection, FreePrintLayout } from '../../types/callSheet';
import { FreeLayoutEditor } from './CallSheetFreeLayout';
import { BOTTOM_LABELS, bottomOrder, isBuiltIn, placeBottomBox } from '../../utils/callSheetBottom';
import {
  BLOCK_OF_LIST,
  LIST_GROUPS,
  PAGE_BREAK,
  PRINT_BLOCK_LABELS,
  type ListGroup,
  type PrintBlock,
  type TableSpot,
  freeBoxList,
  freeLayoutOf,
  showFreeBox,
  startFreeLayout,
  tidyFreeLayout,
  withFreeLayout,
  isVsTable,
  placeBlock,
  placeTable,
  printOrder,
  rowLayout,
  setTableWidth,
  sheetPartOf,
  stepBlock,
  tableSpan,
  topRows,
  withPrintOrder,
} from '../../utils/callSheetPrintLayout';

/** Which parts print (the same switches as Print settings). */
export type IncludeKey = 'top' | 'vs' | 'redzone' | 'tempo' | 'custom' | 'scripts' | 'twoPoint' | 'timeouts';

type Item = { type: 'table' | 'block' | 'bottom'; id: string };
type Drop =
  | { t: 'table'; spot: TableSpot }
  | { t: 'block'; before: string | null }
  | { t: 'bottom'; before: string | null };

interface Props {
  data: CallSheetFullData;
  unit: 'offense' | 'defense';
  columns: number;
  fitMode: 'auto' | '1page' | '2page';
  include: Record<IncludeKey, boolean>;
  setInclude: (key: IncludeKey, on: boolean) => void;
  onChange: (next: CallSheetFullData) => void;
  /** The real printout with the current settings, and its paper. */
  previewHtml: string;
  orientation: 'landscape' | 'portrait';
}

const bottomInclude = (key: string): IncludeKey => (key === 'twopoint' ? 'twoPoint' : key === 'timeouts' ? 'timeouts' : 'scripts');

export const CallSheetPrintArrange: React.FC<Props> = ({ data, unit, columns, fitMode, include, setInclude, onChange, previewHtml, orientation }) => {
  const shownTops = useRef<Record<string, number>>({});
  const secKey = unit === 'offense' ? 'offenseSections' : 'defenseSections';
  const sections = data[secKey] || [];
  const cols = Math.max(1, Math.min(6, columns || 4));

  const [picked, setPicked] = useState<Item | null>(null);
  const [drag, setDrag] = useState<{ item: Item; over: string | null } | null>(null);
  const [history, setHistory] = useState<CallSheetFullData[]>([]);
  const press = useRef<{ item: Item; x: number; y: number; canDrag: boolean; dragging: boolean; over: string | null } | null>(null);

  const active = drag?.item || picked;

  // ---- what's on the page ----
  const fullRows = useMemo(() => topRows(sections, cols), [sections, cols]);
  const rows = useMemo(
    () => fullRows.map((r, i) => ({ i, secs: r.filter((s) => !isVsTable(s)) })).filter((r) => r.secs.length > 0),
    [fullRows]
  );
  const lists = useMemo(() => {
    const out = {} as Record<ListGroup, CallSheetSection[]>;
    for (const g of LIST_GROUPS) out[g] = sections.filter((s) => sheetPartOf(s) === g);
    return out;
  }, [sections]);
  const vsCount = sections.filter(isVsTable).length;
  const bottom = bottomOrder(data, unit);
  const order = printOrder(data, unit);
  const byId = (id: string) => sections.find((s) => s.id === id);

  const tableActive = active?.type === 'table';
  const blockShown = (k: string): boolean => {
    if (k === PAGE_BREAK) return fitMode === '2page';
    if (k === 'top') return rows.length > 0 || tableActive;
    if (k === 'vs') return vsCount > 0;
    if (k === 'bottom') return bottom.length > 0;
    const g = (Object.keys(BLOCK_OF_LIST) as ListGroup[]).find((x) => BLOCK_OF_LIST[x] === k);
    return !!g && (lists[g].length > 0 || tableActive);
  };
  const blockOn = (k: string): boolean => {
    if (k === 'bottom') return include.scripts || include.twoPoint || include.timeouts;
    return include[k as IncludeKey] !== false;
  };

  // ---- changes (each one undoable) ----
  const commit = (next: CallSheetFullData) => {
    setHistory((h) => [...h.slice(-29), data]);
    onChange(next);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    onChange(prev);
  };
  const apply = (item: Item, drop: Drop) => {
    if (item.type === 'table' && drop.t === 'table') {
      const next = placeTable(sections, item.id, drop.spot, cols);
      if (next !== sections) commit({ ...data, [secKey]: next });
    } else if (item.type === 'block' && drop.t === 'block') {
      if (drop.before !== item.id) commit(withPrintOrder(data, unit, placeBlock(order, item.id, drop.before)));
    } else if (item.type === 'bottom' && drop.t === 'bottom') {
      if (drop.before !== item.id) commit(placeBottomBox(data, unit, item.id, drop.before));
    }
  };
  const accepts = (item: Item | null, drop: Drop) => !!item && drop.t === item.type;

  // ---- drag (mouse anywhere on a chip; touch from its grip) and tap-to-place ----
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!p.dragging) {
        if (!p.canDrag || Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
        p.dragging = true;
        setPicked(null);
      }
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]') as HTMLElement | null;
      const raw = el?.getAttribute('data-drop') || null;
      const ok = raw && accepts(p.item, JSON.parse(raw) as Drop) ? raw : null;
      p.over = ok;
      setDrag({ item: p.item, over: ok });
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p) return;
      if (p.dragging) {
        if (p.over) apply(p.item, JSON.parse(p.over) as Drop);
        setDrag(null);
        return;
      }
      if (e.type === 'pointercancel') return;
      // A tap: with something picked, a chip you tap is where it goes (before that one); else pick / unpick.
      const target = e.target instanceof Element ? (e.target.closest('[data-drop]') as HTMLElement | null) : null;
      const raw = target?.getAttribute('data-drop');
      const cur = picked;
      const same = !!cur && cur.type === p.item.type && cur.id === p.item.id;
      if (cur && !same && raw) {
        const d = JSON.parse(raw) as Drop;
        if (accepts(cur, d)) {
          apply(cur, d);
          setPicked(null);
          return;
        }
      }
      setPicked(same ? null : p.item);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  const pressOn = (item: Item) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, select, label')) return;
    const grip = !!(e.target as HTMLElement).closest('[data-grip]');
    press.current = { item, x: e.clientX, y: e.clientY, canDrag: e.pointerType === 'mouse' || grip, dragging: false, over: null };
  };

  const dropAttr = (d: Drop) => JSON.stringify(d);
  const isOver = (d: Drop) => drag?.over === dropAttr(d);
  const isActive = (item: Item) => !!active && active.type === item.type && active.id === item.id;

  // A spot to drop on (shown only while something of its kind is picked or dragged).
  const slot = (drop: Drop, label: string, className = '') =>
    accepts(active, drop) ? (
      <div
        key={`slot-${dropAttr(drop)}`}
        data-drop={dropAttr(drop)}
        onClick={() => {
          if (picked && accepts(picked, drop)) {
            apply(picked, drop);
            setPicked(null);
          }
        }}
        className={`flex items-center justify-center rounded-md border-2 border-dashed text-[10px] font-bold uppercase tracking-wide cursor-pointer select-none transition-colors ${
          isOver(drop) ? 'border-amber-400 bg-amber-400/25 text-amber-200' : 'border-indigo-400/60 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
        } ${className}`}
      >
        {label}
      </div>
    ) : null;

  // ---- a table chip ----
  const chip = (sec: CallSheetSection, drop: Drop, span: number) => {
    const item: Item = { type: 'table', id: sec.id };
    const filled = (sec.plays || []).filter((p) => p && p.name && p.name.trim()).length;
    const inner = sec.columnsCount && sec.columnsCount > 1 ? sec.columnsCount : 1;
    const lines = Math.ceil(Math.max(1, filled) / inner);
    const over = isOver(drop) && !isActive(item);
    return (
      <div
        key={sec.id}
        data-drop={dropAttr(drop)}
        onPointerDown={pressOn(item)}
        style={{ gridColumn: span > 1 ? `span ${span}` : undefined, minHeight: Math.min(110, 30 + lines * 7) }}
        className={`relative min-w-0 rounded-md border bg-slate-800 cursor-pointer select-none overflow-hidden transition-shadow ${
          isActive(item) ? 'ring-2 ring-amber-400 border-amber-400 opacity-80' : 'border-slate-600 hover:border-slate-400'
        } ${over ? 'shadow-[inset_4px_0_0_0_#fbbf24]' : ''}`}
        title={`${sec.title}: drag it, or tap it then tap where it goes`}
      >
        <div className="h-1.5" style={{ background: sec.headerBgColor || '#0284c7' }} />
        <div className="flex items-start gap-1 px-1 py-1">
          <span data-grip className="shrink-0 text-slate-500 touch-none cursor-grab active:cursor-grabbing" aria-hidden>
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black text-white leading-tight truncate">{sec.title || 'Table'}</div>
            <div className="text-[9.5px] text-slate-400">
              {filled}/{sec.slotsCount} plays{tableSpan(sec) > 1 ? ` · width ${tableSpan(sec)}` : ''}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---- the picked thing's quick moves ----
  const pickedSec = picked?.type === 'table' ? byId(picked.id) : undefined;
  const tableMoves = (sec: CallSheetSection) => {
    const part = sheetPartOf(sec);
    const go = (spot: TableSpot) => apply({ type: 'table', id: sec.id }, { t: 'table', spot });
    if (part === 'top') {
      const ri = rows.findIndex((r) => r.secs.some((s) => s.id === sec.id));
      const row = rows[ri];
      const k = row ? row.secs.findIndex((s) => s.id === sec.id) : -1;
      return {
        left: k > 0 ? () => go({ kind: 'row', row: row.i, before: row.secs[k - 1].id }) : undefined,
        right: row && k < row.secs.length - 1 ? () => go({ kind: 'row', row: row.i, before: row.secs[k + 2]?.id || null }) : undefined,
        up: ri > 0 ? () => go({ kind: 'row', row: rows[ri - 1].i, before: null }) : row && row.secs.length > 1 ? () => go({ kind: 'newRow', at: row.i }) : undefined,
        down:
          ri >= 0 && ri < rows.length - 1
            ? () => go({ kind: 'row', row: rows[ri + 1].i, before: null })
            : row && row.secs.length > 1
              ? () => go({ kind: 'newRow', at: row.i + 1 })
              : undefined,
      };
    }
    if (part === 'script') return {};
    const list = lists[part];
    const k = list.findIndex((s) => s.id === sec.id);
    return {
      left: k > 0 ? () => go({ kind: 'list', group: part, before: list[k - 1].id }) : undefined,
      right: k >= 0 && k < list.length - 1 ? () => go({ kind: 'list', group: part, before: list[k + 2]?.id || null }) : undefined,
    };
  };
  const moveTo = (sec: CallSheetSection, where: string) => {
    const spot: TableSpot =
      where === 'top' ? { kind: 'newRow', at: fullRows.length } : { kind: 'list', group: where as ListGroup, before: null };
    apply({ type: 'table', id: sec.id }, { t: 'table', spot });
  };

  const iconBtn = (label: string, onClick: (() => void) | undefined, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!onClick}
      onClick={onClick}
      className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 text-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-700 cursor-pointer disabled:cursor-default"
    >
      {icon}
    </button>
  );

  const pickedBar = () => {
    if (!picked) {
      return (
        <p className="text-[11px] text-slate-400 leading-snug">
          <b className="text-slate-200">Drag</b> a table or a part to move it, or <b className="text-slate-200">tap</b> it, then tap where it goes. Changes
          save to the call sheet (the screen follows).
        </p>
      );
    }
    let name = '';
    let moves: { left?: () => void; right?: () => void; up?: () => void; down?: () => void } = {};
    if (picked.type === 'table' && pickedSec) {
      name = pickedSec.title || 'Table';
      moves = tableMoves(pickedSec);
    } else if (picked.type === 'block') {
      name = PRINT_BLOCK_LABELS[picked.id as PrintBlock] || picked.id;
      const step = (dir: -1 | 1) => {
        const next = stepBlock(order, picked.id, dir, blockShown);
        return next.join() === order.join() ? undefined : () => commit(withPrintOrder(data, unit, next));
      };
      moves = { up: step(-1), down: step(1) };
    } else if (picked.type === 'bottom') {
      name = isBuiltIn(picked.id) ? BOTTOM_LABELS[picked.id] : byId(picked.id)?.title || 'Script';
      const k = bottom.indexOf(picked.id);
      moves = {
        left: k > 0 ? () => commit(placeBottomBox(data, unit, picked.id, bottom[k - 1])) : undefined,
        right: k >= 0 && k < bottom.length - 1 ? () => commit(placeBottomBox(data, unit, picked.id, bottom[k + 2] || null)) : undefined,
      };
    }
    const part = pickedSec ? sheetPartOf(pickedSec) : null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-400/10 px-2 py-1.5">
        <span className="text-[11px] font-black text-amber-200 mr-1 min-w-0 truncate max-w-[12rem]">Moving: {name}</span>
        {picked.type !== 'block' && iconBtn('Left', moves.left, <ChevronLeft className="w-4 h-4" />)}
        {picked.type !== 'block' && iconBtn('Right', moves.right, <ChevronRight className="w-4 h-4" />)}
        {(picked.type === 'block' || part === 'top') && iconBtn(picked.type === 'block' ? 'Up' : 'Row up', moves.up, <ChevronUp className="w-4 h-4" />)}
        {(picked.type === 'block' || part === 'top') && iconBtn(picked.type === 'block' ? 'Down' : 'Row down', moves.down, <ChevronDown className="w-4 h-4" />)}
        {pickedSec && part !== 'script' && (
          <>
            <span className="text-[10px] font-bold uppercase text-slate-400 ml-1">Width</span>
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => commit({ ...data, [secKey]: setTableWidth(sections, pickedSec.id, w) })}
                className={`w-7 h-7 rounded-md text-[11px] font-black border cursor-pointer ${
                  tableSpan(pickedSec) === w ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {w}
              </button>
            ))}
            <select
              value=""
              onChange={(e) => e.target.value && moveTo(pickedSec, e.target.value)}
              className="h-7 rounded-md bg-slate-800 border border-slate-600 text-[11px] font-bold text-slate-200 px-1 cursor-pointer"
              aria-label="Move to another part"
            >
              <option value="">Move to…</option>
              {part !== 'top' && <option value="top">Situations (new row)</option>}
              {LIST_GROUPS.filter((g) => g !== part).map((g) => (
                <option key={g} value={g}>
                  {PRINT_BLOCK_LABELS[BLOCK_OF_LIST[g]]}
                </option>
              ))}
            </select>
          </>
        )}
        <button type="button" onClick={() => setPicked(null)} className="ml-auto w-7 h-7 rounded-md text-slate-300 hover:bg-slate-700 flex items-center justify-center cursor-pointer" aria-label="Done">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // ---- each part's contents ----
  const topBody = () => (
    <div className="flex flex-col gap-1">
      {slot({ t: 'table', spot: { kind: 'newRow', at: rows[0]?.i ?? 0 } }, 'New row here', 'h-6')}
      {rows.map((r, ri) => {
        const lay = rowLayout(r.secs, cols);
        return (
          <React.Fragment key={r.i}>
            <div className="flex items-stretch gap-1">
              <div className="grid flex-1 gap-1 min-w-0" style={{ gridTemplateColumns: lay.template }}>
                {r.secs.map((s) => chip(s, { t: 'table', spot: { kind: 'row', row: r.i, before: s.id } }, lay.spanOf(s)))}
              </div>
              {slot({ t: 'table', spot: { kind: 'row', row: r.i, before: null } }, 'End', 'w-10 shrink-0')}
            </div>
            {slot({ t: 'table', spot: { kind: 'newRow', at: ri < rows.length - 1 ? rows[ri + 1].i : fullRows.length } }, 'New row here', 'h-6')}
          </React.Fragment>
        );
      })}
    </div>
  );

  const listBody = (g: ListGroup) => {
    const list = lists[g];
    const lay = rowLayout(list, cols);
    return (
      <div className="flex items-stretch gap-1">
        {list.length > 0 ? (
          <div className="grid flex-1 gap-1 min-w-0" style={{ gridTemplateColumns: lay.template }}>
            {list.map((s) => chip(s, { t: 'table', spot: { kind: 'list', group: g, before: s.id } }, lay.spanOf(s)))}
          </div>
        ) : null}
        {slot({ t: 'table', spot: { kind: 'list', group: g, before: null } }, list.length ? 'End' : 'Put it here', list.length ? 'w-10 shrink-0' : 'flex-1 h-9')}
      </div>
    );
  };

  const bottomBody = () => (
    <div className="flex flex-wrap items-stretch gap-1">
      {bottom.map((key) => {
        const item: Item = { type: 'bottom', id: key };
        const drop: Drop = { t: 'bottom', before: key };
        const inc = bottomInclude(key);
        const on = include[inc];
        return (
          <div
            key={key}
            data-drop={dropAttr(drop)}
            onPointerDown={pressOn(item)}
            className={`flex-1 min-w-[7rem] rounded-md border bg-slate-800 px-1.5 py-1.5 cursor-pointer select-none flex items-center gap-1 ${
              isActive(item) ? 'ring-2 ring-amber-400 border-amber-400' : 'border-slate-600 hover:border-slate-400'
            } ${isOver(drop) && !isActive(item) ? 'shadow-[inset_4px_0_0_0_#fbbf24]' : ''} ${on ? '' : 'opacity-50'}`}
          >
            <span data-grip className="shrink-0 text-slate-500 touch-none cursor-grab" aria-hidden>
              <GripVertical className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-black text-white truncate flex-1 min-w-0">
              {isBuiltIn(key) ? BOTTOM_LABELS[key] : byId(key)?.title || 'Script'}
            </span>
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => setInclude(inc, e.target.checked)}
              title={on ? 'Printing' : 'Not printing'}
              aria-label="Print it"
              className="rounded cursor-pointer"
            />
          </div>
        );
      })}
      {slot({ t: 'bottom', before: null }, 'End', 'w-10')}
    </div>
  );

  const blockBody = (k: string) => {
    if (k === 'top') return topBody();
    if (k === 'bottom') return bottomBody();
    if (k === 'vs') return <p className="text-[11px] text-slate-400">{vsCount} formation{vsCount === 1 ? '' : 's'}, each with its picture, most-run first.</p>;
    const g = (Object.keys(BLOCK_OF_LIST) as ListGroup[]).find((x) => BLOCK_OF_LIST[x] === k);
    return g ? listBody(g) : null;
  };

  const shownOrder = order.filter(blockShown);
  const blockIncludeKey = (k: string): IncludeKey | null => (k === 'bottom' || k === PAGE_BREAK ? null : (k as IncludeKey));

  // ---- free layout ----
  const free = freeLayoutOf(data, unit);
  const freeOn = !!free?.on;
  const boxList = freeBoxList(data, unit, cols, bottom, (k) => (isBuiltIn(k) ? BOTTOM_LABELS[k] : byId(k)?.title || 'Script'));
  const labels = Object.fromEntries(boxList.map((b) => [b.id, b.label]));
  const setFree = (l: FreePrintLayout) => commit(withFreeLayout(data, unit, l));
  const toolBtn = 'h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-600 text-[11px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-700 disabled:opacity-40 disabled:cursor-default';

  const modeBar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 p-1 rounded-lg bg-slate-850 border border-slate-750">
        {(
          [
            [false, 'Rows (automatic)'],
            [true, 'Free (drag on the page)'],
          ] as const
        ).map(([on, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (on === freeOn) return;
              setPicked(null);
              setFree(on ? startFreeLayout(free, boxList) : { ...(free as FreePrintLayout), on: false });
            }}
            className={`px-3 py-1 rounded-md text-[11px] font-black cursor-pointer ${freeOn === on ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <button type="button" onClick={undo} disabled={!history.length} className={toolBtn}>
        <Undo2 className="w-3.5 h-3.5" /> Undo
      </button>
    </div>
  );

  if (freeOn && free) {
    const removed = (free.hidden || []).filter((id) => labels[id]);
    return (
      <div className="flex flex-col gap-2">
        {modeBar}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFree(tidyFreeLayout(free, shownTops.current))} className={toolBtn} title="Same order, every box moved up as far as it goes">
            <AlignVerticalJustifyStart className="w-3.5 h-3.5" /> Tidy up (close gaps)
          </button>
          <button
            type="button"
            onClick={() => setFree({ ...startFreeLayout(undefined, boxList), hidden: [] })}
            className={toolBtn}
            title="Put every box back where the rows layout has it"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Start over from rows
          </button>
          <p className="text-[11px] text-slate-400 basis-full sm:basis-auto">
            <b className="text-slate-200">Drag</b> any box on the page (iPad: tap it first, then drag). Drag its <b className="text-slate-200">right edge</b> to
            change its width; <b className="text-slate-200">Remove</b> takes it off the printout. Boxes snap into line and never overlap.
          </p>
        </div>
        {removed.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Off the printout:</span>
            {removed.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFree(showFreeBox(free, id))}
                className="h-7 px-2 rounded-md bg-slate-800 border border-dashed border-slate-500 text-[11px] font-bold text-slate-200 cursor-pointer hover:bg-slate-700"
                title="Put it back (at the end)"
              >
                + {labels[id]}
              </button>
            ))}
          </div>
        )}
        <FreeLayoutEditor
          html={previewHtml}
          orientation={orientation}
          layout={free}
          labels={labels}
          onLayout={setFree}
          onMeasured={(t) => (shownTops.current = t)}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-start">
    <div className="min-w-0 flex flex-col gap-2">
      {modeBar}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => commit(withPrintOrder(data, unit, []))}
          className="h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-600 text-[11px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-700"
          title="Situations, then red zone, tempo, custom, and the bottom boxes last"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Standard part order
        </button>
        <span className="text-[11px] text-slate-400">{cols} columns across</span>
      </div>
      {pickedBar()}

      <div className="flex flex-col gap-1.5">
        {shownOrder.map((k) => {
          const item: Item = { type: 'block', id: k };
          const before: Drop = { t: 'block', before: k };
          const incKey = blockIncludeKey(k);
          const on = k === PAGE_BREAK || blockOn(k);
          const head = (
            <div
              data-drop={dropAttr(before)}
              onPointerDown={pressOn(item)}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer select-none ${
                isActive(item) ? 'bg-amber-400/20 ring-2 ring-amber-400' : 'hover:bg-slate-800'
              } ${isOver(before) && !isActive(item) ? 'shadow-[inset_0_3px_0_0_#fbbf24]' : ''}`}
            >
              <span data-grip className="text-slate-500 touch-none cursor-grab" aria-hidden>
                <GripVertical className="w-4 h-4" />
              </span>
              <span className={`text-[11px] font-black uppercase tracking-wider ${k === PAGE_BREAK ? 'text-rose-300' : 'text-slate-100'}`}>
                {PRINT_BLOCK_LABELS[k as PrintBlock] || k}
              </span>
              {!on && <span className="text-[9.5px] font-bold uppercase text-slate-500">not printing</span>}
              {incKey && (
                <label className="ml-auto flex items-center gap-1 text-[10px] font-bold text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={on} onChange={(e) => setInclude(incKey, e.target.checked)} className="rounded cursor-pointer" />
                  Print
                </label>
              )}
              {k === 'bottom' && (
                <label className="ml-auto flex items-center gap-1 text-[10px] font-bold text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      setInclude('scripts', e.target.checked);
                      setInclude('twoPoint', e.target.checked);
                      setInclude('timeouts', e.target.checked);
                    }}
                    className="rounded cursor-pointer"
                  />
                  Print
                </label>
              )}
            </div>
          );
          return (
            <React.Fragment key={k}>
              {slot(before, 'Put it here', 'h-6')}
              {k === PAGE_BREAK ? (
                <div className="rounded-md border-2 border-dashed border-rose-400/60">{head}</div>
              ) : (
                <div className={`rounded-lg border border-slate-700 bg-slate-850/60 p-1.5 flex flex-col gap-1 ${on ? '' : 'opacity-50'}`}>
                  {head}
                  {blockBody(k)}
                </div>
              )}
            </React.Fragment>
          );
        })}
        {slot({ t: 'block', before: null }, 'Put it last', 'h-6')}
      </div>
    </div>
      <div className="min-w-0 lg:sticky lg:top-0">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5">
          Preview ({orientation}, {cols} columns{fitMode === '2page' ? ', 2 pages' : fitMode === '1page' ? ', 1 page' : ''})
        </div>
        <PrintPreviewFrame html={previewHtml} orientation={orientation} />
      </div>
    </div>
  );
};

/** Page content at 96 dpi inside the 0.2" print margins. */
const PAGE = { landscape: { w: 1018, h: 778 }, portrait: { w: 778, h: 1018 } };

/** The real printout, scaled to fit, with dashed lines about where each page ends. */
export const PrintPreviewFrame: React.FC<{ html: string; orientation: 'landscape' | 'portrait' }> = ({ html, orientation }) => {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const page = PAGE[orientation];
  const [width, setWidth] = useState(480);
  const [height, setHeight] = useState(page.h);
  // Wait a moment after a change, so a run of moves reloads the preview once.
  const [shown, setShown] = useState(html);
  useEffect(() => {
    const t = setTimeout(() => setShown(html), 200);
    return () => clearTimeout(t);
  }, [html]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 480));
    ro.observe(el);
    setWidth(el.clientWidth || 480);
    return () => ro.disconnect();
  }, []);

  const measure = () => {
    try {
      const d = frame.current?.contentDocument;
      if (d) setHeight(Math.max(page.h, d.documentElement.scrollHeight));
    } catch {
      /* not readable */
    }
  };

  // On screen, show where page 2 starts (the break prints as a page break).
  const doc = useMemo(
    () =>
      shown.replace(
        '</head>',
        '<style>@media screen{.page-break-before{border-top:3px dashed #e11d48 !important;margin:10px 0 !important;}}</style></head>'
      ),
    [shown]
  );
  const scale = width / page.w;
  const pages = Math.max(1, Math.ceil((height - 4) / page.h));

  return (
    <div className="flex flex-col gap-1">
      <div ref={box} className="relative w-full overflow-hidden rounded-lg border border-slate-600 bg-white" style={{ height: Math.ceil(height * scale) }}>
        <iframe
          ref={frame}
          title="Printout preview"
          srcDoc={doc}
          sandbox="allow-same-origin"
          onLoad={() => {
            measure();
            setTimeout(measure, 400);
          }}
          style={{ width: page.w, height, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0, pointerEvents: 'none', display: 'block' }}
        />
        {Array.from({ length: pages - 1 }, (_, i) => (
          <div key={i} className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500 pointer-events-none" style={{ top: (i + 1) * page.h * scale }}>
            <span className="absolute right-1 -top-4 text-[9px] font-black uppercase bg-amber-500 text-white rounded px-1">≈ page {i + 2}</span>
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-slate-400">
        {pages > 1 ? `About ${pages} pages. ` : 'Fits on 1 page. '}Orange lines: about where each page ends.
      </p>
    </div>
  );
};
