import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Film, Image as ImageIcon, Library, ListChecks, Plus, Search, Trash2, Undo2, Upload, X } from 'lucide-react';
import type { PlayAssignment, PlayDatabaseEntry, PlayType } from '../../types/callSheet';
import type { UserRole } from '../../types';
import { bundleFromSaved } from '../../hudlScout/scoutBundle';
import { CallResult, callResults } from '../../hudlScout/utils/playTags';
import { newPlayEntry, playNameKey } from '../../utils/playbookImport';
import { PlaybookImportModal } from './PlaybookImportModal';
import { unsavedDiagram } from '../../utils/playDiagrams';
import { DiagramImage } from './DiagramImage';

/** The factory sample plays that came with the app (not the coach's own game-day plays). */
const isBuiltInSample = (p: PlayDatabaseEntry) => !p.source && /^db_/.test(p.id);
const diagramOf = (p: PlayDatabaseEntry) => p.diagramUrl || unsavedDiagram(playNameKey(p.name));

interface Props {
  playDatabase: PlayDatabaseEntry[];
  onUpdatePlayDatabase: (next: PlayDatabaseEntry[]) => void;
  deletedPlayIds: string[];
  onUpdateDeletedPlayIds: (next: string[]) => void;
  /** Our film (self-scout play log), for what each play gained when we ran it. */
  ownTeamScout?: any;
  teamName: string;
  userRole: UserRole;
  onOpenScouting?: () => void;
  onOpenPff?: () => void;
}

const TYPES: { id: PlayType; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'pass', label: 'Pass' },
  { id: 'play_action', label: 'Play action' },
  { id: 'screen', label: 'Screen' },
  { id: 'rpo', label: 'RPO' },
  { id: 'trick', label: 'Trick' },
  { id: 'two_point', label: '2-pt' },
  { id: 'goal_line', label: 'Goal line' },
  { id: 'blitz', label: 'Blitz' },
  { id: 'coverage', label: 'Coverage' },
];
const typeLabel = (t: string) => TYPES.find((x) => x.id === t)?.label || t;

type SortKey = 'section' | 'name' | 'used' | 'avg';

const input =
  'h-9 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500';

export const PlayLibraryView: React.FC<Props> = ({
  playDatabase,
  onUpdatePlayDatabase,
  deletedPlayIds,
  onUpdateDeletedPlayIds,
  ownTeamScout,
  teamName,
  userRole,
  onOpenScouting,
  onOpenPff,
}) => {
  const canEdit = userRole === 'admin' || userRole === 'assistant';
  const [query, setQuery] = useState('');
  const [side, setSide] = useState<'all' | 'offense' | 'defense'>('all');
  const [section, setSection] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('section');
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkSection, setBulkSection] = useState('');
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const [zoom, setZoom] = useState<PlayDatabaseEntry | null>(null);
  // The factory sample plays stay out of the library unless the coach asks to see them.
  const [showSamples, setShowSamples] = useState(false);
  const sampleCount = useMemo(() => playDatabase.filter(isBuiltInSample).length, [playDatabase]);
  const myPlays = useMemo(() => (showSamples ? playDatabase : playDatabase.filter((p) => !isBuiltInSample(p))), [playDatabase, showSamples]);
  const toastTimer = useRef<any>(null);

  const showToast = (msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  };

  // What each play gained on our film (tags from Our play log / PFF).
  const ownPlays = useMemo(() => bundleFromSaved(ownTeamScout, teamName).plays, [ownTeamScout, teamName]);
  const results = useMemo(() => {
    const m = new Map<string, CallResult>();
    callResults(ownPlays).forEach((r) => m.set(r.id, r));
    return m;
  }, [ownPlays]);
  const taggedFilm = ownPlays.filter((p) => p.playCallId).length;

  const sections = useMemo(() => {
    const set = new Set<string>();
    myPlays.forEach((p) => p.category && set.add(p.category));
    return [...set].sort();
  }, [myPlays]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const words = q.split(/\s+/).filter(Boolean);
    let list = myPlays.filter((p) => {
      if (side !== 'all' && p.unit !== side) return false;
      if (section === 'none' && p.category) return false;
      if (section !== 'all' && section !== 'none' && p.category !== section) return false;
      if (!words.length) return true;
      const hay = `${p.name} ${p.formation} ${p.category || ''} ${(p.tags || []).join(' ')} ${p.concept || ''}`.toUpperCase();
      return words.every((w) => hay.includes(w)) || playNameKey(p.name).includes(playNameKey(q));
    });
    const r = (p: PlayDatabaseEntry) => results.get(p.id);
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (sort === 'used') list = [...list].sort((a, b) => (r(b)?.count || 0) - (r(a)?.count || 0) || a.name.localeCompare(b.name));
    if (sort === 'avg')
      list = [...list].sort((a, b) => (r(b)?.count ? r(b)!.avgGain : -99) - (r(a)?.count ? r(a)!.avgGain : -99) || a.name.localeCompare(b.name));
    return list;
  }, [myPlays, query, side, section, sort, results]);

  // Group by section when sorting by section.
  const groups = useMemo(() => {
    if (sort !== 'section') return [{ name: '', plays: filtered }];
    const map = new Map<string, PlayDatabaseEntry[]>();
    filtered.forEach((p) => {
      const key = p.category || (p.unit === 'defense' ? 'Defense (no section)' : 'Offense (no section)');
      map.set(key, [...(map.get(key) || []), p]);
    });
    return [...map.entries()].map(([name, plays]) => ({ name, plays }));
  }, [filtered, sort]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const update = (id: string, patch: Partial<PlayDatabaseEntry>) =>
    onUpdatePlayDatabase(playDatabase.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const remove = (ids: string[]) => {
    const prevDb = playDatabase;
    const prevDeleted = deletedPlayIds;
    const gone = new Set(ids);
    const names = playDatabase.filter((p) => gone.has(p.id)).map((p) => p.name);
    onUpdatePlayDatabase(playDatabase.filter((p) => !gone.has(p.id)));
    onUpdateDeletedPlayIds(Array.from(new Set([...deletedPlayIds, ...ids])));
    setSelected({});
    setOpenId(null);
    showToast(names.length === 1 ? `Deleted ${names[0]}` : `Deleted ${names.length} plays`, () => {
      onUpdatePlayDatabase(prevDb);
      onUpdateDeletedPlayIds(prevDeleted);
      setToast(null);
    });
  };

  const addPlay = () => {
    const name = window.prompt('Play name (as you call it), e.g. 21 R 31 TOSS SWEEP');
    if (!name || !name.trim()) return;
    const entry = { ...newPlayEntry(name), source: 'manual' };
    onUpdatePlayDatabase([...playDatabase, entry]);
    setQuery('');
    setOpenId(entry.id);
  };

  const diagramCount = myPlays.filter((p) => diagramOf(p)).length;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-3 sm:py-5 space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-600 text-white shrink-0">
              <Library className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Play Library</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {myPlays.length} plays{diagramCount ? ` · ${diagramCount} with diagrams` : ''} · {taggedFilm} film plays tagged
                {sampleCount > 0 && (
                  <>
                    {' · '}
                    <button type="button" onClick={() => setShowSamples((v) => !v)} className="font-bold text-indigo-700 dark:text-indigo-300 underline cursor-pointer">
                      {showSamples ? `Hide the ${sampleCount} built-in sample plays` : `Show ${sampleCount} built-in sample plays`}
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImporting(true)}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black inline-flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Import Hudl playbook
              </button>
              <button
                type="button"
                onClick={addPlay}
                className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-black text-slate-800 dark:text-slate-100 inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add play
              </button>
            </div>
          )}
        </div>
        {/* How it connects */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="font-black text-slate-900 dark:text-white">1 · Import your playbook</div>
            <div className="text-slate-600 dark:text-slate-400 mt-0.5">Hudl install PDFs bring each play’s diagram, name and every position’s job. Upload again to review changes.</div>
          </div>
          <button
            type="button"
            onClick={onOpenScouting}
            className="text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 cursor-pointer"
          >
            <div className="font-black text-slate-900 dark:text-white flex items-center gap-1">
              2 · Tag film <ChevronRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-0.5">Scouting → Play log → “Tag plays”, for our games and opponents.</div>
          </button>
          <button
            type="button"
            onClick={onOpenPff}
            className="text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 cursor-pointer"
          >
            <div className="font-black text-slate-900 dark:text-white flex items-center gap-1">
              3 · Grade in PFF <ChevronRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-slate-600 dark:text-slate-400 mt-0.5">Same play log. Players fill in from the called formation’s depth chart.</div>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center gap-2 sticky top-[62px] sm:top-2 z-20 shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plays: toss, 32 wishbone, boot…"
            className={`${input} w-full pl-8`}
          />
        </div>
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-black">
          {(['all', 'offense', 'defense'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`px-3 h-9 cursor-pointer ${side === s ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}
            >
              {s === 'all' ? 'All' : s === 'offense' ? 'Offense' : 'Defense'}
            </button>
          ))}
        </div>
        <select value={section} onChange={(e) => setSection(e.target.value)} className={input} aria-label="Section">
          <option value="all">All sections</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="none">No section</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={input} aria-label="Sort">
          <option value="section">By section</option>
          <option value="name">A–Z</option>
          <option value="used">Most run</option>
          <option value="avg">Best average</option>
        </select>
      </div>

      {/* Bulk actions */}
      {canEdit && selectedIds.length > 0 && (
        <div className="rounded-2xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-slate-800 p-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-black text-slate-900 dark:text-white">{selectedIds.length} selected</span>
          <input
            value={bulkSection}
            onChange={(e) => setBulkSection(e.target.value)}
            list="play-sections"
            placeholder="Section name"
            className={`${input} h-8 w-40`}
          />
          <button
            type="button"
            onClick={() => {
              const ids = new Set(selectedIds);
              onUpdatePlayDatabase(playDatabase.map((p) => (ids.has(p.id) ? { ...p, category: bulkSection.trim() || undefined } : p)));
              showToast(bulkSection.trim() ? `Moved to ${bulkSection.trim()}` : 'Section cleared');
              setSelected({});
            }}
            className="h-8 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            Set section
          </button>
          {(['offense', 'defense'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                const ids = new Set(selectedIds);
                onUpdatePlayDatabase(playDatabase.map((p) => (ids.has(p.id) ? { ...p, unit: u } : p)));
                setSelected({});
              }}
              className="h-8 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-black text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              Make {u}
            </button>
          ))}
          <button
            type="button"
            onClick={() => window.confirm(`Delete ${selectedIds.length} plays from the Play Bank?`) && remove(selectedIds)}
            className="h-8 px-3 rounded-lg bg-rose-600 text-white font-black inline-flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button type="button" onClick={() => setSelected({})} className="h-8 px-2 font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
            Clear
          </button>
        </div>
      )}
      <datalist id="play-sections">
        {sections.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* The plays */}
      {myPlays.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
          <Film className="w-10 h-10 mx-auto text-slate-400" />
          <p className="mt-2 font-black text-slate-800 dark:text-slate-100">No uploaded plays yet</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">Import your Hudl install PDFs to fill the library with your plays and their diagrams.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">No plays match.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const allOn = g.plays.every((p) => selected[p.id]);
            return (
              <section key={g.name || 'all'} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {g.name && (
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    {canEdit && (
                      <input
                        type="checkbox"
                        checked={allOn}
                        onChange={(e) =>
                          setSelected((s) => {
                            const next = { ...s };
                            g.plays.forEach((p) => (next[p.id] = e.target.checked));
                            return next;
                          })
                        }
                        aria-label={`Select all in ${g.name}`}
                        className="w-4 h-4"
                      />
                    )}
                    <h2 className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{g.name}</h2>
                    <span className="text-[11px] font-bold text-slate-500">{g.plays.length}</span>
                  </div>
                )}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {g.plays.map((p) => (
                    <PlayRow
                      key={p.id}
                      play={p}
                      result={results.get(p.id)}
                      open={openId === p.id}
                      onToggle={() => setOpenId((id) => (id === p.id ? null : p.id))}
                      selected={Boolean(selected[p.id])}
                      onSelect={canEdit ? (on) => setSelected((s) => ({ ...s, [p.id]: on })) : undefined}
                      canEdit={canEdit}
                      onUpdate={(patch) => update(p.id, patch)}
                      onDelete={() => window.confirm(`Delete ${p.name}?`) && remove([p.id])}
                      diagram={diagramOf(p)}
                      onZoom={() => setZoom(p)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {importing && (
        <PlaybookImportModal
          playDatabase={playDatabase}
          onClose={() => setImporting(false)}
          onImport={(next, summary) => {
            const prev = playDatabase;
            const prevDeleted = deletedPlayIds;
            onUpdatePlayDatabase(next);
            if (summary.removed.length) onUpdateDeletedPlayIds(Array.from(new Set([...deletedPlayIds, ...summary.removed])));
            setImporting(false);
            const parts = [`${summary.added} plays added`];
            if (summary.updated) parts.push(`${summary.updated} updated`);
            if (summary.removed.length) parts.push(`${summary.removed.length} removed`);
            const note = summary.unsavedDiagrams
              ? ` ${summary.unsavedDiagrams} diagrams couldn't be saved online (check the connection and import again).`
              : '';
            showToast(`${parts.join(', ')}.${note}`, () => {
              onUpdatePlayDatabase(prev);
              if (summary.removed.length) onUpdateDeletedPlayIds(prevDeleted);
              setToast(null);
            });
          }}
        />
      )}

      {zoom && diagramOf(zoom) && (
        <div className="fixed inset-0 z-[90] bg-black/75 flex items-center justify-center p-3" onClick={() => setZoom(null)} role="dialog" aria-label={`Diagram: ${zoom.name}`}>
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-black text-slate-900 dark:text-white">{zoom.name}</span>
              <button type="button" onClick={() => setZoom(null)} className="w-10 h-10 rounded-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <DiagramImage url={diagramOf(zoom)} alt={`${zoom.name} diagram`} className="w-full rounded-lg border border-slate-200 bg-white" />
            {zoom.notes && <p className="text-xs text-slate-600 dark:text-slate-300">{zoom.notes}</p>}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[70] rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xl px-4 py-2.5 text-sm font-bold flex items-center gap-3">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button type="button" onClick={toast.undo} className="inline-flex items-center gap-1 text-amber-300 dark:text-indigo-700 font-black cursor-pointer">
              <Undo2 className="w-4 h-4" /> Undo
            </button>
          )}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-70 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const PlayRow: React.FC<{
  play: PlayDatabaseEntry;
  result?: CallResult;
  open: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect?: (on: boolean) => void;
  canEdit: boolean;
  onUpdate: (patch: Partial<PlayDatabaseEntry>) => void;
  onDelete: () => void;
  diagram?: string;
  onZoom: () => void;
}> = ({ play, result, open, onToggle, selected, onSelect, canEdit, onUpdate, onDelete, diagram, onZoom }) => {
  return (
    <div className={open ? 'bg-slate-50/70 dark:bg-slate-950/40' : ''}>
      <div className="flex items-center gap-2 px-3 py-2">
        {onSelect && (
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${play.name}`} className="w-4 h-4 shrink-0" />
        )}
        {diagram ? (
          <button
            type="button"
            onClick={onZoom}
            className="shrink-0 w-20 h-9 rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden bg-white cursor-zoom-in"
            aria-label={`View the diagram for ${play.name}`}
          >
            <DiagramImage url={diagram} alt="" loading="lazy" className="w-full h-full object-cover" />
          </button>
        ) : (
          <span className="shrink-0 w-20 h-9 rounded-md border border-dashed border-slate-200 dark:border-slate-700 hidden sm:flex items-center justify-center text-slate-300 dark:text-slate-600" title="No diagram yet">
            <ImageIcon className="w-4 h-4" />
          </span>
        )}
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 flex items-center gap-2 text-left cursor-pointer" aria-expanded={open}>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-slate-900 dark:text-white truncate">{play.name}</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <span className={play.unit === 'defense' ? 'text-blue-700 dark:text-blue-400 font-bold' : 'text-emerald-700 dark:text-emerald-400 font-bold'}>
                {play.unit === 'defense' ? 'D' : 'O'}
              </span>{' '}
              · {typeLabel(play.type)}
              {play.formation ? ` · ${play.formation}` : ''}
              {play.wristbandNum ? ` · Wristband ${play.wristbandNum}` : ''}
              {play.assignments?.length ? ` · ${play.assignments.length} jobs` : ''}
            </span>
          </span>
        </button>
        {result && result.count > 0 ? (
          <span className="shrink-0 text-right">
            <span className={`block text-sm font-black ${result.avgGain >= 4 ? 'text-emerald-700 dark:text-emerald-400' : result.avgGain < 1 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {result.avgGain > 0 ? `+${result.avgGain}` : result.avgGain}
            </span>
            <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
              ×{result.count} · {result.successRate}%
            </span>
          </span>
        ) : (
          <span className="shrink-0 text-[10px] font-bold text-slate-400">not run</span>
        )}
      </div>

      {open && (
        <div className="px-3 pb-4 pt-1 space-y-3">
          {diagram && (
            <button type="button" onClick={onZoom} className="block w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white cursor-zoom-in" aria-label={`Open the diagram for ${play.name}`}>
              <DiagramImage url={diagram} alt={`${play.name} diagram`} className="w-full" />
            </button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 sm:col-span-2">
              Name
              <input disabled={!canEdit} value={play.name} onChange={(e) => onUpdate({ name: e.target.value })} className={`${input} w-full mt-0.5 font-bold`} />
            </label>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Formation
              <input disabled={!canEdit} value={play.formation || ''} onChange={(e) => onUpdate({ formation: e.target.value })} className={`${input} w-full mt-0.5`} />
            </label>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Section
              <input
                disabled={!canEdit}
                value={play.category || ''}
                list="play-sections"
                onChange={(e) => onUpdate({ category: e.target.value || undefined })}
                className={`${input} w-full mt-0.5`}
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Side
              <select disabled={!canEdit} value={play.unit} onChange={(e) => onUpdate({ unit: e.target.value as 'offense' | 'defense' })} className={`${input} w-full mt-0.5`}>
                <option value="offense">Offense</option>
                <option value="defense">Defense</option>
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Type
              <select disabled={!canEdit} value={play.type} onChange={(e) => onUpdate({ type: e.target.value as PlayType })} className={`${input} w-full mt-0.5`}>
                {TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 sm:col-span-2">
              Notes
              <input disabled={!canEdit} value={play.notes || ''} onChange={(e) => onUpdate({ notes: e.target.value || undefined })} className={`${input} w-full mt-0.5`} />
            </label>
          </div>

          <AssignmentsEditor
            value={play.assignments || []}
            canEdit={canEdit}
            onChange={(assignments) => onUpdate({ assignments: assignments.length ? assignments : undefined })}
          />

          {result && result.count > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {[
                ['Times run', result.count],
                ['Avg gain', result.avgGain > 0 ? `+${result.avgGain}` : result.avgGain],
                ['Success', `${result.successRate}%`],
                ['10+ yds', result.explosive],
                ['TDs', result.touchdowns],
                ['Lost yds', result.negative],
              ].map(([label, v]) => (
                <div key={String(label)}>
                  <div className="text-base font-black text-slate-900 dark:text-white">{v}</div>
                  <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {play.install ? `From ${play.install}. ` : ''}
              {play.source === 'hudl' ? 'Imported from Hudl.' : play.source === 'tagging' ? 'Added while tagging film.' : ''}
            </span>
            {canEdit && (
              <button type="button" onClick={onDelete} className="h-8 px-3 rounded-lg border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 font-black inline-flex items-center gap-1 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Delete play
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AssignmentsEditor: React.FC<{ value: PlayAssignment[]; canEdit: boolean; onChange: (next: PlayAssignment[]) => void }> = ({
  value,
  canEdit,
  onChange,
}) => {
  const set = (i: number, patch: Partial<PlayAssignment>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" /> Position assignments
        </span>
        {canEdit && (
          <button type="button" onClick={() => onChange([...value, { pos: '', text: '' }])} className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>
      {value.length === 0 ? (
        <p className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">None yet. Importing the Hudl install PDF reads them for you.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {value.map((a, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1">
              <input
                disabled={!canEdit}
                value={a.pos}
                onChange={(e) => set(i, { pos: e.target.value.toUpperCase() })}
                className="w-14 h-8 rounded-md border border-transparent hover:border-slate-300 dark:hover:border-slate-600 bg-transparent px-1.5 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                aria-label="Position"
              />
              <input
                disabled={!canEdit}
                value={a.text}
                onChange={(e) => set(i, { text: e.target.value })}
                className="flex-1 min-w-0 h-8 rounded-md border border-transparent hover:border-slate-300 dark:hover:border-slate-600 bg-transparent px-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                aria-label="Assignment"
              />
              {canEdit && (
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label="Remove">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
