// A column's filter, like Excel: tick the values to show. Opens next to the button that opened it.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

interface ColumnFilterProps {
  title: string;
  anchor: HTMLElement;
  options: { value: string; count: number }[];
  /** Values ticked; undefined = everything (no filter). */
  selected?: string[];
  onChange: (next: string[] | undefined) => void;
  onClose: () => void;
}

export const ColumnFilter: React.FC<ColumnFilterProps> = ({ title, anchor, options, selected, onChange, onClose }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const width = 260;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const below = r.bottom + 4;
    const height = boxRef.current?.offsetHeight || 360;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 4) : below;
    setPos({ top, left });
  }, [anchor, options.length]);

  // Close on a click elsewhere, Escape, or when the page scrolls under it.
  useEffect(() => {
    const inside = (e: Event) => boxRef.current?.contains(e.target as Node) || anchor.contains(e.target as Node);
    const down = (e: Event) => !inside(e) && onClose();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const scroll = (e: Event) => !boxRef.current?.contains(e.target as Node) && onClose();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  const all = options.map((o) => o.value);
  const ticked = new Set(selected ?? all);
  const shown = useMemo(
    () => (query.trim() ? options.filter((o) => o.value.toLowerCase().includes(query.trim().toLowerCase())) : options),
    [options, query]
  );
  const set = (next: Set<string>) => onChange(all.every((v) => next.has(v)) ? undefined : all.filter((v) => next.has(v)));
  const toggle = (v: string) => {
    const next = new Set(ticked);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    set(next);
  };

  return createPortal(
    <div
      ref={boxRef}
      role="dialog"
      aria-label={`Filter ${title}`}
      style={{ top: pos.top, left: pos.left, width: 260 }}
      className="fixed z-[100] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl text-xs text-slate-200 flex flex-col max-h-[min(24rem,70vh)]"
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-slate-800">
        <span className="font-black uppercase tracking-wide text-[11px] text-slate-300 flex-1 truncate">Filter {title}</span>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Close filter">
          <X className="w-4 h-4" />
        </button>
      </div>
      {options.length > 8 && (
        <div className="relative px-3 pt-2">
          <Search className="w-3.5 h-3.5 absolute left-5 top-1/2 translate-y-[-25%] text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search values…"
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-7 pr-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => set(new Set([...ticked, ...shown.map((o) => o.value)]))}
          className="px-2 h-7 rounded-md border border-slate-700 font-bold hover:bg-slate-800 cursor-pointer"
        >
          {query ? 'Tick shown' : 'All'}
        </button>
        <button
          type="button"
          onClick={() => {
            const next = new Set(ticked);
            shown.forEach((o) => next.delete(o.value));
            set(next);
          }}
          className="px-2 h-7 rounded-md border border-slate-700 font-bold hover:bg-slate-800 cursor-pointer"
        >
          {query ? 'Untick shown' : 'None'}
        </button>
        {selected && (
          <button type="button" onClick={() => onChange(undefined)} className="ml-auto text-indigo-300 font-bold hover:underline cursor-pointer">
            Clear filter
          </button>
        )}
      </div>
      <div className="overflow-y-auto px-1.5 pb-2">
        {shown.map((o) => (
          <label key={o.value} className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-slate-800 cursor-pointer">
            <input type="checkbox" checked={ticked.has(o.value)} onChange={() => toggle(o.value)} className="accent-indigo-500" />
            <span className="flex-1 truncate">{o.value}</span>
            <span className="text-slate-500 tabular-nums">{o.count}</span>
          </label>
        ))}
        {!shown.length && <p className="px-2 py-2 text-slate-500">No values match.</p>}
      </div>
    </div>,
    document.body
  );
};
