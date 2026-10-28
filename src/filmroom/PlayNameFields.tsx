// The play's name built from its parts (Film Room breakdown and the play builder).
import React, { useState } from 'react';
import type { CallParts } from '../hudlScout/types/football';
import { BACKS, HOLES, PASS_CONCEPTS, PERSONNEL, QB_SPOTS, RUN_CONCEPTS, TAGS, customOptions, parseCall, partsMatch } from './callName';

/**
 * The play's name, built from its parts: personnel, QB under center or in the gun, strength, tags, who gets the
 * ball to which hole (runs) and the concept. Saved with the play; what Hudl brought in stays as it was.
 */
export const PlayNameFields: React.FC<{
  /** The parts picked so far, and the name they make. */
  parts: CallParts;
  name: string;
  readOnly?: boolean;
  /** A run (back and hole shown) or a pass. */
  run: boolean;
  onChange: (parts: CallParts) => void;
  /** Put the name in the Play box. */
  onUseName?: (name: string) => void;
  playBox?: string;
  /** Names already made in this team's games (most used first), to pick in one click. */
  saved?: { name: string; parts: CallParts; count: number }[];
  /** Every name tagged on this film (most used first). */
  filmNames?: { name: string; parts: CallParts; count: number }[];
  /** Options a coach added before (on any play): offered on every play. */
  custom: ReturnType<typeof customOptions>;
}> = ({ parts, name, readOnly, run, onChange, onUseName, playBox, saved = [], filmNames = [], custom }) => {
  const set = (patch: Partial<CallParts>) => onChange({ ...parts, ...patch });
  const pick = <K extends keyof CallParts>(key: K, v: CallParts[K]) => set({ [key]: parts[key] === v ? undefined : v } as Partial<CallParts>);
  const tags = parts.tags || [];
  const hasTag = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const toggleTag = (t: string) => set({ tags: hasTag(t) ? tags.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...tags, t] });
  const withOwn = (base: string[], own: string[], mine?: string[]) => {
    const out = [...base];
    for (const v of [...own, ...(mine || [])]) if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
    return out;
  };
  const concepts = withOwn(run ? RUN_CONCEPTS : PASS_CONCEPTS, run ? custom.runConcepts : custom.passConcepts, parts.concept ? [parts.concept] : []);
  const personnelList = withOwn(PERSONNEL, custom.personnel, parts.personnel ? [parts.personnel] : []);
  const tagList = withOwn(TAGS, custom.tags, tags);

  // A segmented control: the picked one is a raised white tab.
  const seg = <T extends string>(options: { v: T; label: string; title?: string }[], value: T | undefined, onPick: (v: T) => void, cls = '', tight = false) => (
    <div className={`inline-flex flex-wrap rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 gap-0.5 ${cls}`}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            disabled={readOnly}
            aria-pressed={on}
            title={o.title}
            onClick={() => onPick(o.v)}
            className={`h-6 ${tight ? 'min-w-[1.3rem] px-1' : 'min-w-[1.6rem] px-1.5'} rounded-md text-[11px] font-bold transition-colors disabled:cursor-default ${
              on ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
  // Pills (several or one): filled when on.
  const pill = (text: string, on: boolean, onClick: () => void) => (
    <button
      key={text}
      type="button"
      disabled={readOnly}
      aria-pressed={on}
      onClick={onClick}
      className={`h-6 px-2 rounded-full text-[11px] font-bold border transition-colors disabled:cursor-default ${
        on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
      }`}
    >
      {text}
    </button>
  );
  const row = (labelText: string, body: React.ReactNode) => (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{labelText}</span>
      <div className="min-w-0 flex flex-wrap items-center gap-1">{body}</div>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-2.5 flex flex-col gap-2">
      {/* The name the parts make */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Play name</div>
          <div className={`break-words leading-tight ${name ? 'text-base font-black text-slate-900 dark:text-white' : 'text-xs font-semibold text-slate-400'}`}>
            {name || 'Pick the parts below'}
          </div>
        </div>
        {name && !readOnly && onUseName && name !== playBox && (
          <button type="button" onClick={() => onUseName?.(name)} className="shrink-0 h-6 px-2 rounded-md text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10" title="Put this name in the Play box too">
            Use as Play
          </button>
        )}
      </div>

      {/* This film's names, narrowing to the ones with every part picked so far (all games' names until this film has some) */}
      {!readOnly && (filmNames.length > 0 || saved.length > 0) && (() => {
        const pool = filmNames.length ? filmNames : saved;
        const picking = Object.values(parts).some((v) => (Array.isArray(v) ? v.length : v));
        // A name's parts, with any it didn't save (a name typed, or from the AI window) read from the name itself.
        const partsOf = (x: { name: string; parts: CallParts }): CallParts => {
          const full: CallParts = { ...parseCall(x.name) };
          for (const [k, v] of Object.entries(x.parts || {})) if (Array.isArray(v) ? v.length : v) (full as Record<string, unknown>)[k] = v;
          return full;
        };
        const matching = picking ? pool.filter((x) => partsMatch(partsOf(x), parts)) : pool;
        const where = filmNames.length ? 'On this film' : 'Recent';
        return row(
          picking ? `${where} · ${matching.length} match${matching.length === 1 ? '' : 'es'}` : where,
          matching.length ? (
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">{matching.map((x) => pill(x.name, x.name === name, () => onChange(x.parts)))}</div>
          ) : (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">No named play has these yet: keep picking to make a new one.</span>
          )
        );
      })()}

      <div className="h-px bg-slate-200 dark:bg-slate-700/70" />

      {row(
        'Pers',
        <>
          {seg(
            personnelList.map((v) => ({ v, label: v })),
            parts.personnel,
            (v) => pick('personnel', v)
          )}
          {!readOnly && <AddOther label="Other personnel" onAdd={(v) => set({ personnel: v })} />}
        </>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
      {row(
        'QB',
        <>
          {seg(
            QB_SPOTS.map((q) => ({ v: q.v, label: q.v === 'UC' ? 'Under' : q.label === 'Shotgun' ? 'Gun' : q.label, title: q.label })),
            parts.qb,
            (v) => pick('qb', v)
          )}
        </>
      )}
      {row(
        'Side',
        <>
          {seg(
            [
              { v: 'L' as const, label: 'Lt', title: 'Strength left' },
              { v: 'R' as const, label: 'Rt', title: 'Strength right' },
            ],
            parts.strength,
            (v) => pick('strength', v)
          )}
        </>
      )}
      </div>
      {row(
        'Tags',
        <>
          {tagList.map((t) => pill(t, hasTag(t), () => toggleTag(t)))}
          {!readOnly && <AddOther label="Add a tag" onAdd={(v) => !hasTag(v) && set({ tags: [...tags, v] })} />}
        </>
      )}
      {run &&
        row(
          'Ball',
          <>
            {seg(
              BACKS.map((b) => ({ v: b.v, label: b.v, title: b.label })),
              parts.back,
              (v) => pick('back', v)
            )}
          </>
        )}
      {run &&
        row(
          'Hole',
          <>
            {seg(
              HOLES.map((h) => ({ v: h, label: h })),
              parts.hole,
              (v) => pick('hole', v),
              'flex-nowrap',
              true
            )}
          </>
        )}
      {row(
        'Play',
        <>
          {concepts.map((c) => pill(c, parts.concept === c, () => pick('concept', c)))}
          {!readOnly && <AddOther label="Other concept" onAdd={(v) => set({ concept: v })} />}
        </>
      )}
    </div>
  );
};

/** A small + that opens a box to type your own (Enter or leaving it adds it). */
const AddOther: React.FC<{ label: string; onAdd: (v: string) => void }> = ({ label, onAdd }) => {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} title={label} aria-label={label} className="h-6 w-6 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:text-indigo-600 hover:border-indigo-400 text-xs font-black leading-none">
        +
      </button>
    );
  const done = (el: HTMLInputElement) => {
    const v = el.value.trim();
    if (v) onAdd(v);
    setOpen(false);
  };
  return (
    <input
      autoFocus
      aria-label={label}
      placeholder={label}
      onBlur={(e) => done(e.target)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') done(e.target as HTMLInputElement);
        if (e.key === 'Escape') setOpen(false);
      }}
      className="h-6 w-24 rounded-full border border-indigo-300 dark:border-indigo-500/50 bg-white dark:bg-slate-900 px-2 text-[11px] focus:outline-hidden"
    />
  );
};
