import React, { useMemo, useState } from 'react';
import { Atom, Printer, X } from 'lucide-react';
import type { FormationBoard, PlacedPlayer } from '../types';
import { PRINT_COLORS, STRINGS, buildNuclear, kidPath, nuclearPrintHtml, nuclearSvg } from '../utils/nuclearPackage';
import { openCleanPrintTab } from '../utils/printUtils';

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
  const print = () => {
    const title = `${label} nuclear`;
    openCleanPrintTab(nuclearPrintHtml(pkg, formIds, title, `${teamName} · ${formIds.map(labelOf).join(' / ')}`), `${teamName} ${title}`);
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
            <button type="button" onClick={print} disabled={!formIds.length} className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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
      </div>
    </div>
  );
};
