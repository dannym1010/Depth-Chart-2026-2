import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileText, Loader2, Upload, X } from 'lucide-react';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import {
  DraftInput,
  PlayDraft,
  buildDrafts,
  draftStatus,
  inferPlayType,
  mergeDraftsIntoDatabase,
  parseLooseList,
  parsePlaySheet,
  playNameKey,
  tidyPlayName,
} from '../../utils/playbookImport';

interface Props {
  playDatabase: PlayDatabaseEntry[];
  onImport: (next: PlayDatabaseEntry[], summary: { added: number; updated: number }) => void;
  onClose: () => void;
}

interface SourceResult {
  label: string;
  install?: string;
  inputs: DraftInput[];
  warnings: string[];
}

const STATUS_STYLE = {
  new: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  same: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
} as const;
const STATUS_LABEL = { new: 'New', update: 'Adds details', same: 'Already in bank' } as const;

async function readSource(file: File, onProgress: (msg: string, pct: number) => void): Promise<SourceResult> {
  const name = file.name;
  if (/\.pdf$/i.test(name)) {
    const { readPlaybookPdf } = await import('../../utils/playbookPdf');
    const res = await readPlaybookPdf(file, (p) => onProgress(`${name}: ${p.message}`, p.total ? p.done / p.total : 0));
    return { label: name, install: res.install, inputs: res.inputs, warnings: res.warnings };
  }
  if (/\.(png|jpe?g|webp|heic|gif|bmp)$/i.test(name) || file.type.startsWith('image/')) {
    const { readPlaybookImage } = await import('../../utils/playbookPdf');
    const res = await readPlaybookImage(file, (p) => onProgress(`${name}: ${p.message}`, 0.5));
    return { label: name, inputs: res.inputs, warnings: res.warnings };
  }
  if (/\.(xlsx|xls|xlsm|csv)$/i.test(name)) {
    onProgress(`Reading ${name}`, 0.5);
    const wb = /\.csv$/i.test(name) ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }) as unknown[][];
    const { entries } = parsePlaySheet(rows);
    return {
      label: name,
      inputs: entries.map((e) => ({ name: e.name, where: e.where, unit: e.unit, formation: e.formation, category: e.category, notes: e.notes })),
      warnings: entries.length ? [] : ['No play names found in that spreadsheet.'],
    };
  }
  if (/\.txt$/i.test(name)) {
    const entries = parseLooseList(await file.text());
    return { label: name, inputs: entries.map((e) => ({ name: e.name, where: e.where })), warnings: [] };
  }
  return { label: name, inputs: [], warnings: [`${name}: use a PDF, Excel/CSV, picture, or text file.`] };
}

export const PlaybookImportModal: React.FC<Props> = ({ playDatabase, onImport, onClose }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState<{ msg: string; pct: number } | null>(null);
  const [sources, setSources] = useState<SourceResult[]>([]);
  const [install, setInstall] = useState('');
  const [drafts, setDrafts] = useState<PlayDraft[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState(false);

  const rebuild = (all: SourceResult[], installName: string) => {
    const inputs = all.flatMap((s) => s.inputs);
    const next = buildDrafts(inputs, { install: installName || undefined });
    setDrafts(next);
    const sel: Record<string, boolean> = {};
    next.forEach((d) => (sel[d.key] = !d.isSection && draftStatus(playDatabase, d) !== 'same'));
    setPicked(sel);
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const results: SourceResult[] = [...sources];
    let installName = install;
    for (const f of list) {
      setBusy({ msg: `Opening ${f.name}`, pct: 0 });
      try {
        const res = await readSource(f, (msg, pct) => setBusy({ msg, pct }));
        results.push(res);
        if (!installName && res.install) installName = res.install;
      } catch (err) {
        results.push({ label: f.name, inputs: [], warnings: [`Could not read ${f.name}.`] });
        console.warn('Playbook import failed', err);
      }
    }
    setBusy(null);
    setSources(results);
    setInstall(installName);
    rebuild(results, installName);
  };

  const addPasted = () => {
    const entries = parseLooseList(pasted);
    const res: SourceResult = { label: 'Pasted list', inputs: entries.map((e) => ({ name: e.name, where: e.where })), warnings: entries.length ? [] : ['No play names found in the pasted text.'] };
    const all = [...sources, res];
    setSources(all);
    setPasted('');
    rebuild(all, install);
    setTab('file');
  };

  const statusOf = useMemo(() => {
    const m = new Map<string, 'new' | 'update' | 'same'>();
    drafts.forEach((d) => m.set(d.key, draftStatus(playDatabase, d)));
    return m;
  }, [drafts, playDatabase]);

  const chosen = drafts.filter((d) => picked[d.key] && (!d.isSection || d.name));
  const counts = chosen.reduce(
    (acc, d) => {
      const st = d.isSection ? 'new' : statusOf.get(d.key) || 'new';
      acc[st] += 1;
      return acc;
    },
    { new: 0, update: 0, same: 0 }
  );
  const warnings = sources.flatMap((s) => s.warnings);
  const withAssignments = drafts.filter((d) => d.assignments?.length).length;

  const patchDraft = (key: string, patch: Partial<PlayDraft>) =>
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        const next = { ...d, ...patch };
        if (patch.name !== undefined) next.name = patch.name;
        if (patch.unit) next.type = inferPlayType(next.name, patch.unit);
        return next;
      })
    );

  const doImport = () => {
    const ready = chosen.map((d) => {
      const name = tidyPlayName(d.name);
      // A heading the coach chose to keep becomes a normal play.
      return { ...d, name, key: playNameKey(name), isSection: false, install: install || d.install };
    });
    const res = mergeDraftsIntoDatabase(playDatabase, ready);
    onImport(res.next, { added: res.added.length, updated: res.updated.length });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Import plays">
      <div className="w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[92vh] bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Import plays into the Play Bank</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Hudl install PDFs, a printed Hudl playbook page, Excel/CSV, a screenshot, or a pasted list.</p>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 shrink-0 rounded-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sources */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit">
            {(['file', 'paste'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 h-9 rounded-lg text-xs font-black cursor-pointer ${tab === t ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
              >
                {t === 'file' ? 'Files' : 'Paste a list'}
              </button>
            ))}
          </div>

          {tab === 'file' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void addFiles(e.dataTransfer.files);
              }}
              onClick={() => !busy && fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-indigo-500 bg-indigo-50 dark:bg-slate-800' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950/40'
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-indigo-600 dark:text-indigo-400" />
              <p className="mt-2 text-sm font-black text-slate-800 dark:text-slate-100">Drop Hudl playbook files here, or tap to choose</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Best: Hudl → Playbook → an install → <strong>Export</strong> (PDF). Also works: Ctrl+P of the install page, Excel/CSV lists, screenshots. You can add several files.
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.xlsm,.csv,.txt,image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder={'One play per line, e.g.\n21 R 31 TOSS SWEEP\n21 L 38 POWER PASS\n32 R WISHBONE 48 COUNTER'}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 p-3 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tip: in Hudl, select the play list on an install page, copy, and paste it here. Numbers in front are ignored.
              </p>
              <button
                type="button"
                onClick={addPasted}
                disabled={!pasted.trim()}
                className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <ClipboardPaste className="w-4 h-4" /> Read the list
              </button>
            </div>
          )}

          {busy && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Loader2 className="w-4 h-4 animate-spin" /> {busy.msg}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(busy.pct * 100)}%` }} />
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 h-7 px-2 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  <FileText className="w-3 h-3" /> {s.label} · {s.inputs.length}
                </span>
              ))}
            </div>
          )}

          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {w}
            </div>
          ))}

          {/* Preview */}
          {drafts.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">{drafts.filter((d) => !d.isSection).length} plays found</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {withAssignments ? `${withAssignments} with position assignments. ` : ''}Plays already in the bank keep their wristband number and situations.
                  </div>
                </div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Install name
                  <input
                    value={install}
                    onChange={(e) => setInstall(e.target.value)}
                    placeholder="e.g. 2026 10U Install"
                    className="ml-2 h-8 w-44 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs text-slate-900 dark:text-white"
                  />
                </label>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                {drafts.map((d) => {
                  const st = statusOf.get(d.key) || 'new';
                  return (
                    <div key={d.key} className={`flex items-center gap-2 px-2.5 py-1.5 ${d.isSection ? 'bg-slate-50 dark:bg-slate-950/50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(picked[d.key])}
                        onChange={(e) => setPicked((p) => ({ ...p, [d.key]: e.target.checked }))}
                        aria-label={`Import ${d.name}`}
                        className="w-4 h-4 shrink-0"
                      />
                      <input
                        value={d.name}
                        onChange={(e) => patchDraft(d.key, { name: e.target.value })}
                        className={`min-w-0 flex-1 h-8 rounded-md bg-transparent px-1.5 text-[13px] border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:outline-none ${
                          d.isSection ? 'font-black uppercase tracking-wide text-slate-500 dark:text-slate-400' : 'font-bold text-slate-900 dark:text-white'
                        }`}
                        aria-label="Play name"
                      />
                      {d.isSection ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0" title="A Hudl section heading. Tick it to keep it as a play.">
                          Section
                        </span>
                      ) : (
                        <>
                          {d.assignments?.length ? (
                            <span className="hidden sm:inline text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">{d.assignments.length} jobs</span>
                          ) : null}
                          {d.category ? <span className="hidden md:inline text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px] shrink-0">{d.category}</span> : null}
                          <button
                            type="button"
                            onClick={() => patchDraft(d.key, { unit: d.unit === 'offense' ? 'defense' : 'offense' })}
                            className="w-7 h-7 shrink-0 rounded-md border border-slate-300 dark:border-slate-600 text-[11px] font-black text-slate-700 dark:text-slate-200 cursor-pointer"
                            title="Offense or defense (tap to switch)"
                          >
                            {d.unit === 'offense' ? 'O' : 'D'}
                          </button>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {chosen.length ? `${counts.new} new · ${counts.update} get details added` : 'Nothing selected yet'}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={doImport}
              disabled={!chosen.length || Boolean(busy)}
              className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" /> Add to Play Bank
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
