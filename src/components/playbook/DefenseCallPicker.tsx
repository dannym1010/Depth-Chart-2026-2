// Our defensive call, picked step by step: the front, a blitz and / or a stunt, and the coverage. Each
// player's own rules are set in the Jobs tab (DefenderRules), which uses the zone map here.
import React, { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { COVERAGES, MAN_COVERAGES, PRESSURES, isLineman, joinPressure, pressureParts } from '../../utils/defenseCalls';

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
  callName: string;
  hasLook: boolean;
  /** Our defenders on the field, their receivers, and each defender's own job (a PLAYER_JOBS id or man:<role>). */
  defenders?: { role: string; label: string }[];
  receivers?: { role: string; label: string }[];
  assign?: Record<string, string>;
  /** Give one defender his own job ('' = back to the call). */
  onAssign?: (role: string, job: string) => void;
  /** The gap the blitz / stunt sends each defender through (by role). */
  rushGaps?: Record<string, string>;
  /** Who each defender has in the man coverage as drawn now (receiver's name, by role). */
  manShown?: Record<string, string>;
}

const GAPS = ['A', 'B', 'C', 'D'];

/** Each defender with the gap he rushes: tap a gap to move his arrow there, or "—" to keep him out of the rush. */
const RushList: React.FC<{
  defenders: { role: string; label: string }[];
  assign: Record<string, string>;
  rushGaps: Record<string, string>;
  onAssign: (role: string, job: string) => void;
}> = ({ defenders, assign, rushGaps, onAssign }) => {
  const line = defenders.filter((d) => isLineman(d.role));
  const rest = defenders.filter((d) => !isLineman(d.role));
  const row = (d: { role: string; label: string }) => {
    const job = assign[d.role] || '';
    const own = job.startsWith('blitz:') ? job.slice(6) : job === 'off' ? '' : undefined;
    const call = rushGaps[d.role] || '';
    const now = own !== undefined ? own : job ? '' : call;
    const changed = own !== undefined || (Boolean(job) && !job.startsWith('blitz:'));
    const set = (gap: string) => {
      if (gap === call && !job.startsWith('man')) return onAssign(d.role, '');
      if (gap) return onAssign(d.role, `blitz:${gap}`);
      onAssign(d.role, call ? 'off' : '');
    };
    return (
      <div key={d.role} className="flex items-center gap-1.5">
        <span className="w-12 shrink-0 text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={d.role}>
          {d.label}
        </span>
        <div className="flex gap-1">
          <button type="button" aria-pressed={!now} title={isLineman(d.role) ? 'His base job, no stunt' : 'No blitz: plays the coverage'} className={chip(!now)} onClick={() => set('')}>
            —
          </button>
          {GAPS.map((gap) => (
            <button key={gap} type="button" aria-pressed={now === gap} title={`${d.label}: ${gap} gap`} aria-label={`${d.label} ${gap} gap`} className={`${chip(now === gap)} !px-2.5`} onClick={() => set(gap)}>
              {gap}
            </button>
          ))}
        </div>
        {changed && (
          <button type="button" onClick={() => onAssign(d.role, '')} title="Back to what the call has him do" aria-label={`Reset ${d.label}`} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 p-2.5 space-y-2">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">The gap each player rushes. Tap a gap to move his arrow, or — to keep him out of the rush. Saved with this call.</p>
      <div className="grid grid-cols-1 gap-y-2">
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Line</div>
          {line.map(row)}
        </div>
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Backers &amp; secondary</div>
          {rest.map(row)}
        </div>
      </div>
    </div>
  );
};

/** In man coverage: who covers who. Auto keeps the matchup the coverage picks. */
const ManList: React.FC<{
  defenders: { role: string; label: string }[];
  receivers: { role: string; label: string }[];
  assign: Record<string, string>;
  manShown: Record<string, string>;
  onAssign: (role: string, job: string) => void;
}> = ({ defenders, receivers, assign, manShown, onAssign }) => {
  const list = defenders.filter((d) => !isLineman(d.role) && !(assign[d.role] || '').startsWith('blitz:') && (manShown[d.role] || (assign[d.role] || '').startsWith('man:')));
  if (!list.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 p-2.5 space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Who covers who</div>
      <div className="grid grid-cols-1 gap-y-2">
        {list.map((d) => {
          const job = assign[d.role] || '';
          return (
            <label key={d.role} className="flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0 font-bold text-slate-800 dark:text-slate-100 truncate">{d.label}</span>
              <select
                id={`man-${d.role}`}
                value={job.startsWith('man:') ? job : ''}
                onChange={(e) => onAssign(d.role, e.target.value)}
                aria-label={`Who ${d.label} covers`}
                className="flex-1 min-w-0 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-1.5"
              >
                <option value="">Auto{manShown[d.role] && !job.startsWith('man:') ? ` (${manShown[d.role]})` : ''}</option>
                {receivers.map((r) => (
                  <option key={r.role} value={`man:${r.role}`}>
                    Man on {r.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
};

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
export const ZoneMap: React.FC<{ value: string; onPick: (zone: string) => void }> = ({ value, onPick }) => {
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
  type Step = 'front' | 'blitz' | 'stunt' | 'rush' | 'cover';
  const [open, setOpen] = useState<Step | null>(null);
  const toggle = (step: Step) => setOpen((o) => (o === step ? null : step));
  const pickFront = (id: string) => {
    p.onFront(id);
    setOpen(null);
  };
  const pickPressure = (v: string) => {
    p.onPressure(v);
    // A blitz or stunt picked: show who rushes where, to adjust it.
    setOpen(v && p.defenders && p.onAssign ? 'rush' : null);
  };
  const pickCoverage = (v: string) => {
    p.onCoverage(v);
    // A man coverage stays open to set who covers who.
    setOpen(MAN_COVERAGES.has(v) && p.onAssign ? 'cover' : null);
  };
  const frontLabel = !p.frontId ? 'None' : p.fronts.find((f) => f.id === p.frontId)?.label || p.otherLooks.find((o) => o.id === p.frontId)?.label || p.frontId;
  const short = (id: string) => PRESSURES.find((x) => x.id === id)?.short || 'None';
  const assign = p.assign || {};
  // Backers and DBs rushing (the call's or their own), not counting the line.
  const rushCount = (p.defenders || []).filter((d) => {
    if (isLineman(d.role)) return false;
    const job = assign[d.role] || '';
    return job.startsWith('blitz:') || (!job && Boolean(p.rushGaps?.[d.role]));
  }).length;
  const steps: { id: Step; label: string; value: string }[] = [
    { id: 'front', label: 'Front', value: frontLabel },
    ...(p.hasLook
      ? ([
          { id: 'blitz', label: 'Blitz', value: blitz ? short(blitz) : 'None' },
          { id: 'stunt', label: 'Stunt', value: stunt ? short(stunt) : 'None' },
          ...(p.defenders && p.onAssign ? [{ id: 'rush' as Step, label: 'Rush', value: rushCount ? `${rushCount} rushing` : 'Adjust' }] : []),
          { id: 'cover', label: 'Cover', value: COVERAGES.find((c) => c.id === p.coverage)?.short || 'None' },
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
          {open === 'rush' && p.defenders && p.onAssign && (
            <RushList defenders={p.defenders} assign={assign} rushGaps={p.rushGaps || {}} onAssign={p.onAssign} />
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
          {/* Man coverage: pick who covers who (open with the Cover step, or right after picking it). */}
          {open === 'cover' && MAN_COVERAGES.has(p.coverage) && p.defenders && p.receivers && p.onAssign && (
            <ManList defenders={p.defenders} receivers={p.receivers} assign={assign} manShown={p.manShown || {}} onAssign={p.onAssign} />
          )}

        </>
      )}
    </div>
  );
};
