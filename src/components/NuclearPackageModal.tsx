import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Atom, Printer, X } from 'lucide-react';
import type { FormationBoard, PlacedPlayer } from '../types';
import { NUCLEAR_PRINT_DEFAULTS, PRINT_COLORS, STRINGS, buildNuclear, kidPath, nuclearPrintHtml, nuclearSvg, type NuclearPrintOptions } from '../utils/nuclearPackage';
import { openCleanPrintTab } from '../utils/printUtils';
import { loadPrintPrefs, savePrintPrefs } from '../utils/printPrefs';

interface Props {
  onClose: () => void;
  /** The offense boards. */
  formations: FormationBoard[];
  depthChart: Record<string, PlacedPlayer[]>;
  teamName: string;
}

/**
 * One string (black by default) in every formation, on one field: kids who never move once, kids who do at each
 * spot with the formations that put them there. Tap a formation to see only its 11; print a one-page sheet.
 */
export const NuclearPackageModal: React.FC<Props> = ({ onClose, formations, depthChart, teamName }) => {
  const [stringIdx, setStringIdx] = useState(0);
  const all = useMemo(() => buildNuclear(formations, depthChart, stringIdx), [formations, depthChart, stringIdx]);
  // Formations in the package: the ones this string has most of a team in (9 or more), unless the coach picks.
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const full = all.forms.filter((f) => f.filled >= Math.min(9, f.spots));
  const formIds = picked[stringIdx] ?? (full.length ? full : all.forms.filter((f) => f.filled > 0)).map((f) => f.id);
  const pkg = useMemo(() => buildNuclear(formations, depthChart, stringIdx, formIds), [formations, depthChart, stringIdx, formIds.join(',')]);
  const [only, setOnly] = useState<string>('');
  const view = formIds.includes(only) ? only : '';
  const svg = useMemo(() => nuclearSvg(pkg, formIds, { only: view || undefined }), [pkg, formIds.join(','), view]);
  const movers = pkg.kids.filter((k) => !k.fixed && !k.partial);
  const subs = pkg.kids.filter((k) => k.partial);
  const fixed = pkg.kids.filter((k) => k.fixed);
  const label = STRINGS.find((s) => s.idx === stringIdx)?.label || 'Black';
  const labelOf = (id: string) => pkg.forms.find((f) => f.id === id)?.label || id;
  const toggle = (id: string) => {
    const next = formIds.includes(id) ? formIds.filter((x) => x !== id) : formations.map((b) => b.id).filter((x) => x === id || formIds.includes(x));
    setPicked((p) => ({ ...p, [stringIdx]: next }));
  };
  // Print: options with a preview of the page first.
  const [printOpen, setPrintOpen] = useState(false);
  const [opts, setOpts] = useState<NuclearPrintOptions>(() => loadPrintPrefs('nuclear', NUCLEAR_PRINT_DEFAULTS));
  const [title, setTitle] = useState('');
  const sheetTitle = title.trim() || `${label} nuclear`;
  const sheet = useMemo(
    () => (printOpen ? nuclearPrintHtml(pkg, formIds, sheetTitle, `${teamName} · ${formIds.map(labelOf).join(' / ')}`, opts) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [printOpen, pkg, formIds.join(','), sheetTitle, teamName, opts]
  );
  const print = () => {
    savePrintPrefs('nuclear', { ...opts });
    openCleanPrintTab(sheet, `${teamName} ${sheetTitle}`);
  };
  const chip = (on: boolean) =>
    `h-9 px-3 rounded-full text-sm font-black border cursor-pointer ${on ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700'}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Atom className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-900 dark:text-white">{label} nuclear package</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">The same kids in every formation, on one field</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {printOpen && (
              <button type="button" onClick={() => setPrintOpen(false)} className="h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (printOpen ? print() : setPrintOpen(true))}
              disabled={!formIds.length}
              className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> {printOpen ? 'Print' : 'Print…'}
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {printOpen ? (
          <PrintPanel opts={opts} setOpts={setOpts} title={title} setTitle={setTitle} placeholder={`${label} nuclear`} sheet={sheet} />
        ) : (
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1">String</span>
              {STRINGS.map((s) => (
                <button key={s.idx} type="button" onClick={() => setStringIdx(s.idx)} className={chip(stringIdx === s.idx)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1">Formations</span>
              {all.forms.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  className={chip(formIds.includes(f.id))}
                  title={`${f.filled} of ${f.spots} spots filled for ${label}. Tap to ${formIds.includes(f.id) ? 'take it out of' : 'add it to'} the package.`}
                >
                  {f.label}
                  <span className="ml-1 text-[11px] opacity-60">{f.filled}/{f.spots}</span>
                </button>
              ))}
            </div>
          </div>

          {formIds.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1">Show</span>
              <button type="button" onClick={() => setOnly('')} className={chip(!view)}>All on one field</button>
              {formIds.map((id) => (
                <button key={id} type="button" onClick={() => setOnly(id)} className={chip(view === id)}>
                  {labelOf(id)}
                </button>
              ))}
            </div>
          )}

          {svg ? (
            <div className="rounded-xl overflow-x-auto bg-white">
              <div className="min-w-[620px]" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
              No {label} players in these formations yet. Put them on the depth chart, or pick other formations.
            </div>
          )}

          {formIds.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              <span><i className="inline-block w-3 h-3 rounded-full align-[-1px] mr-1.5 border border-slate-400" style={{ background: PRINT_COLORS.ink }} />Same spot in every formation</span>
              <span><i className="inline-block w-3 h-3 rounded-full align-[-1px] mr-1.5" style={{ background: PRINT_COLORS.movers[0] }} />Moves (tagged with the formations at that spot)</span>
              <span><i className="inline-block w-3 h-3 rounded-full align-[-1px] mr-1.5 border-2 border-dashed border-slate-500" />Not in every formation (a sub)</span>
            </div>
          )}

          {(movers.length > 0 || subs.length > 0) && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...movers, ...subs].map((k) => {
                const color = k.partial ? undefined : PRINT_COLORS.movers[movers.indexOf(k) % PRINT_COLORS.movers.length];
                const out = formIds.filter((id) => !k.at[id]).map(labelOf);
                return (
                  <div key={k.key} className="flex items-start gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 min-w-0">
                    <span
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${k.partial ? 'border-2 border-dashed border-slate-500 text-slate-700 dark:text-slate-200' : 'text-white'}`}
                      style={color ? { background: color } : undefined}
                    >
                      {k.num || '?'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 dark:text-white truncate">{k.name}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {kidPath(pkg, k, formIds).map((p, i) => (
                          <span key={i}>
                            {i > 0 && ' → '}
                            <b>{p.spot.label}</b> {p.forms.join(', ')}
                          </span>
                        ))}
                        {out.length > 0 && <span className="text-amber-700 dark:text-amber-300"> · out in {out.join(', ')}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fixed.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <b className="text-slate-700 dark:text-slate-200">Same spot every time:</b>{' '}
              {fixed.map((k) => `#${k.num} ${k.name} (${pkg.spots[Object.values(k.at)[0]]?.label || ''})`).join(' · ')}
            </p>
          )}
          {subs.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              For a true nuclear package (no subs), put one kid in every formation: {subs.map((k) => `#${k.num} ${k.name}`).join(' and ')} {subs.length === 1 ? 'is' : 'are'} only in some.
            </p>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

const Toggle: React.FC<{ on: boolean; onChange: (on: boolean) => void; label: string; hint?: string }> = ({ on, onChange, label, hint }) => (
  <label className="flex items-start gap-2.5 cursor-pointer select-none">
    <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer" />
    <span>
      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{label}</span>
      {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </span>
  </label>
);

/** Print options on the left, the page as it will print on the right. */
const PrintPanel: React.FC<{
  opts: NuclearPrintOptions;
  setOpts: React.Dispatch<React.SetStateAction<NuclearPrintOptions>>;
  title: string;
  setTitle: (t: string) => void;
  placeholder: string;
  sheet: string;
}> = ({ opts, setOpts, title, setTitle, placeholder, sheet }) => {
  const set = (patch: Partial<NuclearPrintOptions>) => setOpts((o) => ({ ...o, ...patch }));
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setWidth(el.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Letter at 96 px an inch.
  const [pw, ph] = opts.orientation === 'landscape' ? [1056, 816] : [816, 1056];
  const scale = Math.min(1, width / pw);
  const seg = (on: boolean) =>
    `flex-1 h-9 px-3 rounded-lg text-sm font-black cursor-pointer ${on ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`;
  return (
    <div className="overflow-y-auto p-4 sm:p-5 grid gap-5 md:grid-cols-[260px_1fr]">
      <div className="space-y-5 min-w-0">
        <div className="space-y-1.5">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Title</div>
          <input
            id="nuclear-print-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Page</div>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button type="button" onClick={() => set({ orientation: 'landscape' })} className={seg(opts.orientation === 'landscape')}>Landscape</button>
            <button type="button" onClick={() => set({ orientation: 'portrait' })} className={seg(opts.orientation === 'portrait')}>Portrait</button>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button type="button" onClick={() => set({ ink: false })} className={seg(!opts.ink)}>Color</button>
            <button type="button" onClick={() => set({ ink: true })} className={seg(opts.ink)}>Black &amp; white</button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">On the page</div>
          <Toggle on={opts.names} onChange={(names) => set({ names })} label="Names on the field" hint="Off: jersey numbers only" />
          <Toggle on={opts.moves} onChange={(moves) => set({ moves })} label="Who moves" hint="Each mover's spots, and who's in the same spot every time" />
          <Toggle on={opts.formations} onChange={(formations) => set({ formations })} label="Each formation small" hint="One diagram per formation under the big field" />
        </div>
        {opts.ink && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            In black and white, the kids who move are white chips with a black ring, and each one's path has its own dashes.
          </p>
        )}
      </div>
      <div ref={box} className="min-w-0">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Preview</div>
        <div className="rounded-lg shadow-lg ring-1 ring-slate-300 dark:ring-slate-700 overflow-hidden bg-white" style={{ width: pw * scale, height: ph * scale }}>
          <iframe
            title="Print preview"
            srcDoc={sheet.replace('<body>', '<body style="padding:0.35in">')}
            style={{ width: pw, height: ph, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};
