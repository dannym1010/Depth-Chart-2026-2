// Our defensive call, picked step by step: the front, a blitz and / or a stunt, the coverage, then any
// player's own job. Players sit on a small map like they line up; tapping one (here or on the field) opens
// his options: a mini field of zones to drop to, the gaps to rush, man or spy; linemen slant or loop.
import React, { useEffect, useState } from 'react';
import { ChevronDown, RotateCcw, X } from 'lucide-react';
import type { PlayNode, PlayStroke } from '../../utils/footballEngine';
import { COVERAGES, PRESSURES, isLineman, joinPressure, pressureParts } from '../../utils/defenseCalls';

interface Props {
  /** The front buttons, the coach's own fronts, and his other saved looks. */
  fronts: { id: string; label: string }[];
  frontId: string;
  otherLooks: { id: string; label: string }[];
  allowNone: boolean;
  onFront: (id: string) => void;
  pressure: string;
  onPressure: (value: string) => void;
  coverage: string;
  onCoverage: (value: string) => void;
  /** Our defenders as lined up, with the label each shows. */
  defenders: { node: PlayNode; label: string }[];
  assign: Record<string, string>;
  onAssign: (role: string, job: string) => void;
  onResetAssign: () => void;
  selected: string | null;
  onSelect: (role: string | null) => void;
  /** The lines drawn for the call (to say what each player is doing). */
  callStrokes: PlayStroke[];
  callName: string;
  hasLook: boolean;
}

const chip = (on: boolean) =>
  `h-7 px-3 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
    on ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
  }`;

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-2">
    <span className="w-14 shrink-0 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</div>
  </div>
);

/** Zone spots on the mini field (field x -16..16, depth 0..17). */
const UNDER = [
  { id: 'flatL', x: -13.5, y: 3.5, label: 'Flat' },
  { id: 'curlL', x: -9, y: 7.5, label: 'Curl' },
  { id: 'hookL', x: -4.4, y: 5.5, label: 'Hook' },
  { id: 'mid', x: 0, y: 9, label: 'Mid' },
  { id: 'hookR', x: 4.4, y: 5.5, label: 'Hook' },
  { id: 'curlR', x: 9, y: 7.5, label: 'Curl' },
  { id: 'flatR', x: 13.5, y: 3.5, label: 'Flat' },
];
const DEEP: Record<'3' | '2' | '4', { id: string; x: number; label: string }[]> = {
  '3': [
    { id: 'deep3L', x: -11, label: 'Deep ⅓' },
    { id: 'deep3M', x: 0, label: 'Deep ⅓' },
    { id: 'deep3R', x: 11, label: 'Deep ⅓' },
  ],
  '2': [
    { id: 'deep2L', x: -7.5, label: 'Deep ½' },
    { id: 'deep2R', x: 7.5, label: 'Deep ½' },
  ],
  '4': [
    { id: 'deep4OL', x: -13, label: '¼' },
    { id: 'deep4IL', x: -4.5, label: '¼' },
    { id: 'deep4IR', x: 4.5, label: '¼' },
    { id: 'deep4OR', x: 13, label: '¼' },
  ],
};
const pos = (x: number, y: number) => ({ left: `${50 + (x / 36) * 100}%`, bottom: `${7 + (y / 17) * 80}%` });

/** The mini field: tap a bubble to send him there. */
const ZoneMap: React.FC<{ value: string; onPick: (zone: string) => void }> = ({ value, onPick }) => {
  const [deep, setDeep] = useState<'3' | '2' | '4'>(value.startsWith('zone:deep2') ? '2' : value.startsWith('zone:deep4') ? '4' : '3');
  const bubble = (id: string, label: string, x: number, y: number, deepZone: boolean) => {
    const on = value === `zone:${id}`;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onPick(`zone:${id}`)}
        style={pos(x, y)}
        aria-pressed={on}
        title={`${label} (${x < 0 ? 'left' : x > 0 ? 'right' : 'middle'})`}
        className={`absolute -translate-x-1/2 translate-y-1/2 whitespace-nowrap rounded-full border text-[10px] font-bold transition-colors cursor-pointer ${
          deepZone ? 'px-3 py-1' : 'px-2 py-0.5'
        } ${on ? 'bg-teal-700 border-teal-700 text-white shadow' : 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:border-teal-700 dark:text-teal-200'}`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Drop to</span>
      <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
        {(['3', '2', '4'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDeep(d)}
            className={`h-5 w-6 rounded-full text-[10px] font-bold cursor-pointer ${deep === d ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500'}`}
            title={d === '3' ? 'Deep thirds' : d === '2' ? 'Deep halves' : 'Deep quarters'}
          >
            {d === '3' ? '⅓' : d === '2' ? '½' : '¼'}
          </button>
        ))}
      </div>
    </div>
    <div className="relative h-40 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="absolute left-0 right-0 border-t-2 border-indigo-300/70" style={{ bottom: '7%' }} />
      {DEEP[deep].map((z) => bubble(z.id, z.label, z.x, 14.5, true))}
      {UNDER.map((z) => bubble(z.id, z.label, z.x, z.y, false))}
    </div>
    </div>
  );
};

export const DefenseCallPicker: React.FC<Props> = (p) => {
  const { blitz, stunt } = pressureParts(p.pressure);
  const [dropOpen, setDropOpen] = useState(false);
  const sel = p.defenders.find((d) => d.node.role === p.selected) || null;
  const jobOf = (n: PlayNode) => p.callStrokes.find((st) => st.points[0] && Math.abs(st.points[0].x - n.x) < 0.05 && Math.abs(st.points[0].y - n.y) < 0.05)?.label;
  const levels = [
    p.defenders.filter((d) => (!isLineman(d.node.role) && d.node.y >= 6.5) || /^CB/.test(d.node.role)),
    p.defenders.filter((d) => !isLineman(d.node.role) && d.node.y < 6.5 && !/^CB/.test(d.node.role)),
    p.defenders.filter((d) => isLineman(d.node.role)),
  ].map((row) => [...row].sort((a, b) => a.node.x - b.node.x));
  const changed = Object.keys(p.assign).length;
  type Step = 'front' | 'blitz' | 'stunt' | 'cover' | 'players';
  const [open, setOpen] = useState<Step | null>(null);
  const toggle = (step: Step) => setOpen((o) => (o === step ? null : step));
  // A defender tapped on the field opens his card.
  useEffect(() => {
    if (p.selected) setOpen('players');
  }, [p.selected]);
  const pickFront = (id: string) => {
    p.onFront(id);
    setOpen(null);
  };
  const pickPressure = (v: string) => {
    p.onPressure(v);
    setOpen(null);
  };
  const pickCoverage = (v: string) => {
    p.onCoverage(v);
    setOpen(null);
  };
  const frontLabel = !p.frontId ? 'None' : p.fronts.find((f) => f.id === p.frontId)?.label || p.otherLooks.find((o) => o.id === p.frontId)?.label || p.frontId;
  const short = (id: string) => PRESSURES.find((x) => x.id === id)?.short || 'None';
  const steps: { id: Step; label: string; value: string }[] = [
    { id: 'front', label: 'Front', value: frontLabel },
    ...(p.hasLook
      ? ([
          { id: 'blitz', label: 'Blitz', value: blitz ? short(blitz) : 'None' },
          { id: 'stunt', label: 'Stunt', value: stunt ? short(stunt) : 'None' },
          { id: 'cover', label: 'Cover', value: COVERAGES.find((c) => c.id === p.coverage)?.short || 'None' },
          { id: 'players', label: 'Players', value: changed ? `${changed} changed` : 'As called' },
        ] as { id: Step; label: string; value: string }[])
      : []),
  ];

  return (
    <div className="space-y-2.5">
      {/* What's picked, one button a step: tap one to change it. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Our call">
        {steps.map((st) => (
          <button
            key={st.id}
            type="button"
            aria-expanded={open === st.id}
            onClick={() => toggle(st.id)}
            className={`h-8 pl-3 pr-2 rounded-full border text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              open === st.id
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{st.label}</span>
            <span className="font-semibold">{st.value}</span>
            <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${open === st.id ? 'rotate-180' : ''}`} />
          </button>
        ))}
      </div>
      {open === 'front' && (
      <Row label="Front">
        {p.allowNone && (
          <button type="button" aria-pressed={!p.frontId} className={chip(!p.frontId)} onClick={() => pickFront('')}>
            None
          </button>
        )}
        {p.fronts.map((f) => (
          <button key={f.id} type="button" aria-pressed={p.frontId === f.id} className={chip(p.frontId === f.id)} onClick={() => pickFront(f.id)}>
            {f.label}
          </button>
        ))}
        {p.otherLooks.length > 0 && (
          <select
            aria-label="Other saved looks"
            value={p.otherLooks.some((o) => o.id === p.frontId) ? p.frontId : ''}
            onChange={(e) => e.target.value && pickFront(e.target.value)}
            className="h-7 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border-0 cursor-pointer"
          >
            <option value="">More…</option>
            {p.otherLooks.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Row>
      )}

      {p.hasLook && (
        <>
          {open === 'blitz' && (
          <Row label="Blitz">
            <button type="button" aria-pressed={!blitz} className={chip(!blitz)} onClick={() => pickPressure(joinPressure('', stunt))}>
              None
            </button>
            {PRESSURES.filter((x) => x.group === 'Blitz').map((x) => (
              <button key={x.id} type="button" title={x.label} aria-pressed={blitz === x.id} className={chip(blitz === x.id)} onClick={() => pickPressure(joinPressure(x.id, stunt))}>
                {x.short}
              </button>
            ))}
          </Row>
          )}
          {open === 'stunt' && (
          <Row label="Stunt">
            <button type="button" aria-pressed={!stunt} className={chip(!stunt)} onClick={() => pickPressure(joinPressure(blitz, ''))}>
              None
            </button>
            {PRESSURES.filter((x) => x.group === 'Stunt').map((x) => (
              <button key={x.id} type="button" title={x.label} aria-pressed={stunt === x.id} className={chip(stunt === x.id)} onClick={() => pickPressure(joinPressure(blitz, x.id))}>
                {x.short}
              </button>
            ))}
          </Row>
          )}
          {open === 'cover' && (
          <Row label="Cover">
            <button type="button" aria-pressed={!p.coverage} className={chip(!p.coverage)} onClick={() => pickCoverage('')}>
              None
            </button>
            {COVERAGES.map((c) => (
              <button key={c.id} type="button" title={c.label} aria-pressed={p.coverage === c.id} className={chip(p.coverage === c.id)} onClick={() => pickCoverage(c.id)}>
                {c.short}
              </button>
            ))}
          </Row>
          )}

          {/* Players, set out like they line up. Tap one to change his job. */}
          {open === 'players' && (
          <div className="flex gap-2">
            <span className="w-14 shrink-0 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Players</span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-2 space-y-1.5" role="group" aria-label="Our defenders">
                {levels.map((row, i) =>
                  row.length ? (
                    <div key={i} className="flex justify-center gap-1.5 flex-wrap">
                      {row.map(({ node, label }) => {
                        const on = p.selected === node.role;
                        const own = Boolean(p.assign[node.role]);
                        return (
                          <button
                            key={node.role}
                            type="button"
                            aria-pressed={on}
                            aria-label={`${node.role} job`}
                            title={jobOf(node) || (isLineman(node.role) ? 'Rush' : 'No job drawn')}
                            onClick={() => p.onSelect(on ? null : node.role)}
                            className={`relative h-7 min-w-9 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                              on ? 'bg-green-700 text-white ring-2 ring-offset-1 ring-indigo-500 dark:ring-offset-slate-900' : 'bg-green-700/90 text-white hover:bg-green-700'
                            }`}
                          >
                            {label}
                            {own && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : null
                )}
              </div>
              {changed > 0 && !sel && (
                <button type="button" onClick={p.onResetAssign} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
                  <RotateCcw className="w-3 h-3" /> Back to the call for all {changed}
                </button>
              )}

              {sel && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md bg-green-700 px-1.5 text-[11px] font-black text-white">{sel.label}</span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{jobOf(sel.node) || (isLineman(sel.node.role) ? 'Rush' : 'No job drawn yet')}</span>
                    </div>
                    <button type="button" aria-label="Close" onClick={() => p.onSelect(null)} className="h-6 w-6 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isLineman(sel.node.role) && (
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ['stunt:in', 'Slant in'],
                        ['stunt:out', 'Slant out'],
                        ['loop:in', 'Loop in'],
                        ['loop:out', 'Loop out'],
                      ].map(([id, label]) => (
                        <button key={id} type="button" aria-pressed={p.assign[sel.node.role] === id} className={chip(p.assign[sel.node.role] === id)} onClick={() => p.onAssign(sel.node.role, id)}>
                          {label}
                        </button>
                      ))}
                      <button type="button" aria-pressed={dropOpen} className={chip(dropOpen || String(p.assign[sel.node.role] || '').startsWith('zone:'))} onClick={() => setDropOpen((o) => !o)}>
                        Drop into a zone
                      </button>
                    </div>
                  )}
                  {(!isLineman(sel.node.role) || dropOpen || String(p.assign[sel.node.role] || '').startsWith('zone:')) && (
                    <ZoneMap value={p.assign[sel.node.role] || ''} onPick={(z) => p.onAssign(sel.node.role, z)} />
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">Rush</span>
                    {(['A', 'B', 'C', 'D'] as const).map((gap) => (
                      <button key={gap} type="button" aria-pressed={p.assign[sel.node.role] === `blitz:${gap}`} className={chip(p.assign[sel.node.role] === `blitz:${gap}`)} onClick={() => p.onAssign(sel.node.role, `blitz:${gap}`)}>
                        {gap} gap
                      </button>
                    ))}
                    {!isLineman(sel.node.role) &&
                      [
                        ['man', 'Man'],
                        ['spy', 'Spy'],
                      ].map(([id, label]) => (
                        <button key={id} type="button" aria-pressed={p.assign[sel.node.role] === id} className={chip(p.assign[sel.node.role] === id)} onClick={() => p.onAssign(sel.node.role, id)}>
                          {label}
                        </button>
                      ))}
                    <button type="button" aria-pressed={!p.assign[sel.node.role]} className={chip(!p.assign[sel.node.role])} onClick={() => p.onAssign(sel.node.role, '')}>
                      As called
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
};
