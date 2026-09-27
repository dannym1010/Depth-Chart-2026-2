import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { DrillFolder } from '../../types';
import {
  FolderPath,
  addDrill,
  addFolder,
  countDrills,
  deleteDrill,
  deleteFolder,
  duplicateDrill,
  folderOptions,
  getFolder,
  isInside,
  moveDrill,
  moveFolder,
  renameFolder,
  reorderDrill,
  samePath,
  updateDrill,
} from '../../utils/drillTreeEdit';
import { stripLeadingIcon } from './DrillCategoryDrawer';

interface Props {
  tree: DrillFolder[];
  onChange: (next: DrillFolder[]) => void;
  onDone: () => void;
}

const pathKey = (p: FolderPath) => p.join('_');
const iconBtn =
  'w-8 h-8 shrink-0 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default';

/** A text box that saves when you leave it (or press Enter), so typing stays quick. */
const CommitInput: React.FC<{
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  ariaLabel: string;
}> = ({ value, onCommit, className = '', placeholder, multiline, autoFocus, ariaLabel }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  if (multiline) {
    return (
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        rows={3}
        aria-label={ariaLabel}
        className={`w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 ${className}`}
      />
    );
  }
  return (
    <input
      value={draft}
      autoFocus={autoFocus}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`min-w-0 h-9 rounded-lg border border-transparent hover:border-slate-700 bg-transparent px-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-slate-950 ${className}`}
    />
  );
};

export const DrillLibraryEditor: React.FC<Props> = ({ tree, onChange, onDone }) => {
  const [history, setHistory] = useState<DrillFolder[][]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [openDrill, setOpenDrill] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<FolderPath | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const noteTimer = useRef<any>(null);

  const apply = (next: DrillFolder[], msg?: string) => {
    if (next === tree) return;
    setHistory((h) => [...h.slice(-24), tree]);
    onChange(next);
    if (msg) {
      setNote(msg);
      clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setNote(''), 3500);
    }
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    onChange(prev);
    setNote('Undone');
  };

  const options = useMemo(() => folderOptions(tree), [tree]);
  const total = tree.reduce((n, f) => n + countDrills(f), 0);
  const q = query.trim().toLowerCase();
  const matches = (name: string, desc = '', key = '') => !q || `${name} ${desc} ${key}`.toLowerCase().includes(q);
  const folderHasMatch = (f: DrillFolder): boolean =>
    !q || (f.drills || []).some((d) => matches(d.name, d.desc, d.key)) || (f.subfolders || []).some(folderHasMatch) || f.name.toLowerCase().includes(q);

  const renderFolder = (folder: DrillFolder, path: FolderPath): React.ReactNode => {
    if (!folderHasMatch(folder)) return null;
    const key = pathKey(path);
    const isOpen = Boolean(q) || Boolean(open[key]);
    const siblingsCount = path.length === 1 ? tree.length : getFolder(tree, path.slice(0, -1))?.subfolders?.length || 0;
    const idx = path[path.length - 1];
    const drills = folder.drills || [];
    return (
      <div key={key} className={path.length === 1 ? 'rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden' : 'border-l-2 border-slate-700 ml-2 sm:ml-4 pl-2 sm:pl-3'}>
        {/* Section header */}
        <div className={`flex flex-wrap items-center gap-1.5 ${path.length === 1 ? 'px-2 sm:px-3 py-2 bg-slate-950/70 border-b border-slate-800' : 'py-1.5'}`}>
          <button type="button" onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))} className={iconBtn} aria-label={isOpen ? 'Close section' : 'Open section'} aria-expanded={isOpen}>
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <CommitInput
            value={folder.name}
            onCommit={(v) => apply(renameFolder(tree, path, v), 'Section renamed')}
            ariaLabel="Section name"
            autoFocus={focusKey === `f_${key}`}
            className={`flex-1 min-w-[150px] font-black ${path.length === 1 ? 'text-base' : ''}`}
          />
          <span className="text-[11px] font-bold text-slate-400 shrink-0">{countDrills(folder)} drills</span>
          <div className="flex items-center justify-end gap-1 ml-auto w-full sm:w-auto">
            <button type="button" className={iconBtn} disabled={idx === 0} onClick={() => apply(moveFolder(tree, path, -1))} aria-label="Move section up" title="Move up">
              <ArrowUp className="w-4 h-4" />
            </button>
            <button type="button" className={iconBtn} disabled={idx >= siblingsCount - 1} onClick={() => apply(moveFolder(tree, path, 1))} aria-label="Move section down" title="Move down">
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`${iconBtn} w-auto px-2 gap-1 text-[11px] font-black`}
              onClick={() => {
                const res = addDrill(tree, path);
                apply(res.tree, 'Drill added');
                setOpen((o) => ({ ...o, [key]: true }));
                setOpenDrill(`${key}:${res.index}`);
                setFocusKey(`d_${key}:${res.index}`);
              }}
              title="Add a drill to this section"
            >
              <Plus className="w-3.5 h-3.5" /> Drill
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => {
                const res = addFolder(tree, path, 'New sub-section');
                apply(res.tree, 'Sub-section added');
                setOpen((o) => ({ ...o, [key]: true, [pathKey(res.path)]: true }));
                setFocusKey(`f_${pathKey(res.path)}`);
              }}
              aria-label="Add a sub-section"
              title="Add a sub-section"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`${iconBtn} hover:text-rose-300 hover:bg-rose-950/50`}
              onClick={() => (countDrills(folder) === 0 && !(folder.subfolders || []).length ? apply(deleteFolder(tree, path), `Deleted ${folder.name}`) : setDeleting(path))}
              aria-label={`Delete section ${folder.name}`}
              title="Delete section"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isOpen && (
          <div className={path.length === 1 ? 'p-2 sm:p-3 space-y-1.5' : 'space-y-1.5 pb-1'}>
            {drills.map((d, i) => {
              if (!matches(d.name, d.desc, d.key)) return null;
              const dKey = `${key}:${i}`;
              const expanded = openDrill === dKey;
              return (
                <div key={d.id || dKey} className="rounded-xl border border-slate-800 bg-slate-950/50">
                  <div className="flex flex-wrap items-center gap-1 px-1.5 py-1">
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0} onClick={() => apply(reorderDrill(tree, path, i, -1))} className="h-4 w-6 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer" aria-label="Move drill up">
                        <ArrowUp className="w-3.5 h-3.5 mx-auto" />
                      </button>
                      <button type="button" disabled={i === drills.length - 1} onClick={() => apply(reorderDrill(tree, path, i, 1))} className="h-4 w-6 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer" aria-label="Move drill down">
                        <ArrowDown className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </div>
                    <CommitInput
                      value={d.name}
                      onCommit={(v) => apply(updateDrill(tree, path, i, { name: v }))}
                      ariaLabel="Drill name"
                      autoFocus={focusKey === `d_${dKey}`}
                      className="flex-1 min-w-[160px] font-bold"
                    />
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => setOpenDrill(expanded ? null : dKey)}
                        className={`h-8 px-2 rounded-lg text-[11px] font-black border cursor-pointer ${expanded ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                        aria-expanded={expanded}
                      >
                        Details
                      </button>
                      <select
                        value=""
                        onChange={(e) => {
                          const target = options.find((o) => pathKey(o.path) === e.target.value);
                          if (target) apply(moveDrill(tree, path, i, target.path), `Moved to ${stripLeadingIcon(target.label)}`);
                        }}
                        className="h-8 w-24 sm:w-32 rounded-lg border border-slate-700 bg-slate-900 text-[11px] font-bold text-slate-300 px-1 cursor-pointer"
                        aria-label="Move drill to another section"
                      >
                        <option value="">Move to…</option>
                        {options
                          .filter((o) => !samePath(o.path, path))
                          .map((o) => (
                            <option key={pathKey(o.path)} value={pathKey(o.path)}>
                              {'  '.repeat(o.depth)}
                              {stripLeadingIcon(o.label)}
                            </option>
                          ))}
                      </select>
                      <button type="button" className={iconBtn} onClick={() => apply(duplicateDrill(tree, path, i), 'Drill copied')} aria-label="Duplicate drill" title="Duplicate">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className={`${iconBtn} hover:text-rose-300 hover:bg-rose-950/50`}
                        onClick={() => apply(deleteDrill(tree, path, i), `Deleted ${d.name}`)}
                        aria-label={`Delete drill ${d.name}`}
                        title="Delete drill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="px-2.5 pb-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <label className="text-[10.5px] font-black uppercase tracking-wide text-slate-400">
                        Setup &amp; execution
                        <CommitInput multiline value={d.desc || ''} onCommit={(v) => apply(updateDrill(tree, path, i, { desc: v }))} ariaLabel="Setup and execution" placeholder="How to set it up and run it" className="mt-1 normal-case tracking-normal font-normal" />
                      </label>
                      <label className="text-[10.5px] font-black uppercase tracking-wide text-emerald-400">
                        Key coaching focus
                        <CommitInput multiline value={d.key || ''} onCommit={(v) => apply(updateDrill(tree, path, i, { key: v }))} ariaLabel="Key coaching focus" placeholder="The one thing to coach" className="mt-1 normal-case tracking-normal font-normal" />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
            {!drills.length && !(folder.subfolders || []).length && (
              <p className="text-xs text-slate-500 px-1 py-1">Empty section. Add a drill or a sub-section.</p>
            )}
            {(folder.subfolders || []).map((sub, j) => renderFolder(sub, [...path, j]))}
          </div>
        )}
      </div>
    );
  };

  const deletingFolder = deleting ? getFolder(tree, deleting) : undefined;

  return (
    <div className="space-y-3">
      {/* Editing bar */}
      <div className="sticky top-[62px] sm:top-2 z-20 rounded-2xl border border-indigo-500/50 bg-slate-950/95 backdrop-blur p-2.5 sm:p-3 shadow-xl space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
            <div className="text-sm font-black text-white">Editing the Drill Library</div>
            <div className="text-[11px] text-slate-400 truncate">
              {note || `${total} drills in ${tree.length} sections · changes save as you go`}
            </div>
          </div>
          <button type="button" onClick={undo} disabled={!history.length} className="h-9 px-3 rounded-xl border border-slate-700 text-xs font-black text-slate-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-30">
            <Undo2 className="w-4 h-4" /> Undo
          </button>
          <button
            type="button"
            onClick={() => {
              const res = addFolder(tree, null, 'New section');
              apply(res.tree, 'Section added');
              setOpen((o) => ({ ...o, [pathKey(res.path)]: true }));
              setFocusKey(`f_${pathKey(res.path)}`);
              requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
            }}
            className="h-9 px-3 rounded-xl border border-slate-700 text-xs font-black text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" /> New section
          </button>
          <button type="button" onClick={onDone} className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer">
            <Check className="w-4 h-4" /> Done
          </button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a drill or section to edit"
            className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="space-y-2.5">{tree.map((f, i) => renderFolder(f, [i]))}</div>

      {deleting && deletingFolder && (
        <DeleteSectionDialog
          folder={deletingFolder}
          options={options.filter((o) => !samePath(o.path, deleting) && !isInside(o.path, deleting))}
          onCancel={() => setDeleting(null)}
          onDelete={(moveTo) => {
            const name = deletingFolder.name;
            apply(deleteFolder(tree, deleting, moveTo), moveTo ? `Deleted ${name}, drills moved` : `Deleted ${name}`);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
};

const DeleteSectionDialog: React.FC<{
  folder: DrillFolder;
  options: { path: FolderPath; label: string; depth: number }[];
  onCancel: () => void;
  onDelete: (moveTo?: FolderPath) => void;
}> = ({ folder, options, onCancel, onDelete }) => {
  const n = countDrills(folder);
  const [mode, setMode] = useState<'move' | 'delete'>(n ? 'move' : 'delete');
  const [target, setTarget] = useState(options[0] ? pathKey(options[0].path) : '');
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Delete section">
      <div className="w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-4 space-y-3 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-white">Delete “{stripLeadingIcon(folder.name)}”?</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              It has {n} drill{n === 1 ? '' : 's'}
              {folder.subfolders?.length ? ` in it and ${folder.subfolders.length} sub-section${folder.subfolders.length === 1 ? '' : 's'}` : ''}.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="p-1 text-slate-400 hover:text-white cursor-pointer" aria-label="Cancel">
            <X className="w-5 h-5" />
          </button>
        </div>
        {n > 0 && (
          <div className="space-y-2">
            <label className={`flex items-start gap-2 rounded-xl border p-2.5 cursor-pointer ${mode === 'move' ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-700'}`}>
              <input type="radio" checked={mode === 'move'} onChange={() => setMode('move')} className="mt-1" />
              <span className="flex-1 text-sm text-slate-100">
                Keep the drills: move them to
                <select
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setMode('move');
                  }}
                  className="mt-1.5 w-full h-9 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 px-2"
                >
                  {options.map((o) => (
                    <option key={pathKey(o.path)} value={pathKey(o.path)}>
                      {'  '.repeat(o.depth)}
                      {stripLeadingIcon(o.label)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className={`flex items-start gap-2 rounded-xl border p-2.5 cursor-pointer ${mode === 'delete' ? 'border-rose-500 bg-rose-950/30' : 'border-slate-700'}`}>
              <input type="radio" checked={mode === 'delete'} onChange={() => setMode('delete')} className="mt-1" />
              <span className="text-sm text-slate-100">Delete the drills too</span>
            </label>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-xl border border-slate-700 text-xs font-black text-slate-200 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDelete(mode === 'move' && n > 0 ? options.find((o) => pathKey(o.path) === target)?.path : undefined)}
            className="h-10 px-4 rounded-xl bg-rose-600 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Delete section
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
