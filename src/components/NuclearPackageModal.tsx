import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, Atom, Printer, X } from 'lucide-react';
import type { FormationBoard, PlacedPlayer } from '../types';
import { NUCLEAR_PRINT_DEFAULTS, PRINT_COLORS, STRINGS, buildNuclear, changedFromBase, nuclearBase, nuclearFormColors, nuclearGrid, nuclearSwitch, nuclearSwitchSvg, nuclearPrintHtml, nuclearSvg, type NuclearPrintOptions } from '../utils/nuclearPackage';
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
  // The formation the chart shades changes from: 21 unless the coach taps another column.
  const [basePick, setBasePick] = useState('');
  const base = formIds.includes(basePick) ? basePick : nuclearBase(pkg, formIds);
  const baseIdx = formIds.indexOf(base);
  const view = formIds.includes(only) ? only : '';
  const svg = useMemo(() => nuclearSvg(pkg, formIds, { only: view || undefined, base }), [pkg, formIds.join(','), view, base]);
  // Each formation's color (the base is black): its moves on the field and in the chart.
  const fc = nuclearFormColors(formIds, base);
  const dot = (id: string) => (id === base ? null : <i className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-[0px]" style={{ background: fc[id] }} />);
  // Switching formations: from the base to the next one, unless the coach picks.
  const [swPick, setSwPick] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const swFrom = formIds.includes(swPick.from) ? swPick.from : base;
  const swTo = formIds.includes(swPick.to) && swPick.to !== swFrom ? swPick.to : formIds.find((id) => id !== swFrom) || '';
  const sw = swFrom && swTo ? nuclearSwitch(pkg, swFrom, swTo) : null;
  const swPaired = new Set(sw?.ins.map((i) => i.for).filter(Boolean));
  const who = (k: { num: string; name: string }) => (
    <>
      <b className="text-slate-900 dark:text-white">#{k.num}</b> {k.name}
    </>
  );
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
    () => (printOpen ? nuclearPrintHtml(pkg, formIds, sheetTitle, `${teamName} · ${formIds.map(labelOf).join(' / ')}`, { ...opts, baseId: base }) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [printOpen, pkg, formIds.join(','), sheetTitle, teamName, opts, base]
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
                  {dot(id)}
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
              <span><i className="inline-block w-3 h-3 rounded-full align-[-1px] mr-1.5 border border-slate-400" style={{ background: PRINT_COLORS.ink }} />Black: his {labelOf(base)} spot</span>
              <span><i className="inline-block w-3 h-3 rounded-full align-[-1px] mr-1.5 border-2 bg-white" style={{ borderColor: PRINT_COLORS.forms[0] }} />In a formation's color: where he moves in it</span>
              <span><i className="inline-block w-3 h-3 rounded-full align-[-1px] mr-1.5 border-2 border-dashed border-slate-500" />Not in every formation (a sub)</span>
              <span className="text-slate-500 dark:text-slate-400">Tap a formation in the chart to make it the base.</span>
            </div>
          )}

          {(movers.length > 0 || subs.length > 0) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 dark:border-slate-200">
                    <th className="text-left py-1.5 pr-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Who lines up where</th>
                    {formIds.map((id) => (
                      <th key={id} className={`px-1 py-1 ${id === base ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                        <button
                          type="button"
                          onClick={() => setBasePick(id)}
                          className="w-full font-black text-slate-900 dark:text-white cursor-pointer leading-tight"
                          title={id === base ? 'Changes are shaded against this formation' : `Shade changes from ${labelOf(id)} instead`}
                        >
                          {dot(id)}
                          {labelOf(id)}
                          <span className={`block text-[9px] uppercase tracking-wider ${id === base ? 'text-amber-600 dark:text-amber-400' : 'invisible'}`}>base</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nuclearGrid(pkg, formIds).map(({ kid: k, cells }) => (
                    <tr key={k.key} className="border-b border-slate-200 dark:border-slate-800">
                      <td className="py-1.5 pr-3">
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${k.partial ? 'border-2 border-dashed border-slate-500 text-slate-700 dark:text-slate-200' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}
                          >
                            {k.num || '?'}
                          </span>
                          <span className="font-black text-slate-900 dark:text-white truncate">{k.name}</span>
                        </span>
                      </td>
                      {cells.map((c, i) => {
                        const moved = changedFromBase(cells, i, baseIdx);
                        return (
                          <td
                            key={i}
                            className={`px-2 py-1.5 text-center ${i === baseIdx && !moved ? 'bg-slate-100 dark:bg-slate-800 ' : ''}${!c ? 'italic text-slate-400' : moved ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-200'}`}
                            style={moved ? { background: `${fc[formIds[i]]}40` } : undefined}
                          >
                            {c || 'out'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sw && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Switch</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500 mr-0.5">From</span>
                  {formIds.map((id) => (
                    <button key={id} type="button" onClick={() => setSwPick({ from: id, to: swTo === id ? swFrom : swTo })} className={chip(swFrom === id)}>
                      {dot(id)}
                      {labelOf(id)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSwPick({ from: swTo, to: swFrom })}
                  className="h-9 w-9 rounded-full border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer"
                  title="Switch back the other way"
                  aria-label="Swap from and to"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500 mr-0.5">To</span>
                  {formIds
                    .filter((id) => id !== swFrom)
                    .map((id) => (
                      <button key={id} type="button" onClick={() => setSwPick({ from: swFrom, to: id })} className={chip(swTo === id)}>
                        {dot(id)}
                        {labelOf(id)}
                      </button>
                    ))}
                </div>
              </div>
              <div className="rounded-lg overflow-hidden bg-white max-w-2xl" dangerouslySetInnerHTML={{ __html: nuclearSwitchSvg(pkg, formIds, swFrom, swTo, { base }) }} />
              <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                {sw.ins.map((i) => (
                  <li key={`in${i.kid.key}`}>
                    <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white align-[1px]">IN</span>
                    {who(i.kid)}
                    {i.for && <> for {who(i.for)}</>} → <b className="text-slate-900 dark:text-white">{i.to}</b>
                  </li>
                ))}
                {sw.outs
                  .filter((o) => !swPaired.has(o.kid))
                  .map((o) => (
                    <li key={`out${o.kid.key}`}>
                      <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-black border border-slate-500 align-[1px]">OUT</span>
                      {who(o.kid)} ({o.from})
                    </li>
                  ))}
                {sw.moves.map((m) => (
                  <li key={`mv${m.kid.key}`}>
                    {who(m.kid)} {m.from} → <b className="text-slate-900 dark:text-white">{m.to}</b>
                  </li>
                ))}
                {!sw.ins.length && !sw.outs.length && !sw.moves.length && <li className="italic text-slate-500">No change: the same kids in the same spots.</li>}
              </ul>
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
  // The sheet runs as long as it needs (the switch diagrams carry on past page 1): the preview is as tall as it.
  const [tall, setTall] = useState(ph);
  const frame = useRef<HTMLIFrameElement>(null);
  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (doc?.body) setTall(Math.max(ph, Math.ceil(doc.documentElement.scrollHeight)));
  };
  useEffect(() => {
    // Fonts and the fields settle after load.
    const t = setTimeout(measure, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, ph]);
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
          <Toggle
            on={opts.switchDiagrams}
            onChange={(switchDiagrams) => set({ switchDiagrams })}
            label="Switch diagrams"
            hint="Under the big field: every formation to every other, drawn like plays (who moves, who runs on, who comes out)"
          />
          {opts.switchDiagrams && (
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 ml-6">
              <button type="button" onClick={() => set({ switchSize: 'big' })} className={seg(opts.switchSize !== 'small')}>Big</button>
              <button type="button" onClick={() => set({ switchSize: 'small' })} className={seg(opts.switchSize === 'small')}>Small</button>
            </div>
          )}
          <Toggle on={opts.moves} onChange={(moves) => set({ moves })} label="Who lines up where" hint="Each kid's spot in every formation, and who's in the same spot every time" />
          <Toggle on={opts.formations} onChange={(formations) => set({ formations })} label="Each formation small" hint="One diagram per formation, after the switches" />
          <Toggle on={opts.switches} onChange={(switches) => set({ switches })} label="Switch chart" hint="Every formation to every other: who comes in, who goes out, who moves" />
        </div>
        {opts.ink && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            In black and white, a kid's move is an outlined chip and the formation tags are outlined.
          </p>
        )}
      </div>
      <div ref={box} className="min-w-0">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Preview</div>
        {/* The switch chart starts a new page when printed: a dashed line here. */}
        <div className="rounded-lg shadow-lg ring-1 ring-slate-300 dark:ring-slate-700 overflow-hidden bg-white" style={{ width: pw * scale, height: tall * scale }}>
          <iframe
            ref={frame}
            title="Print preview"
            onLoad={measure}
            srcDoc={sheet
              .replace('<body>', '<body style="padding:0.35in">')
              .replace('.switches { break-before: page; }', '.switches { margin-top: 0.35in; padding-top: 0.35in; border-top: 2px dashed #c9cfc8; }')}
            style={{ width: pw, height: tall, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};
