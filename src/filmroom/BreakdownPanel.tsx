// Break a game down while watching it: the Hudl columns of the play on screen, filled in beside the video.
// Buttons save right away; typed boxes save when you leave them or press Enter. "Next play" saves and moves on,
// carrying the quarter and ODK to a blank next play.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Eraser } from 'lucide-react';
import type { Play, TeamUnit } from '../hudlScout/types/football';
import { playIsUnitTaggable } from '../hudlScout/utils/unitStats';
import { breakdownRowOf, type BreakdownColumn, type BreakdownRow } from './breakdownEntry';

interface Props {
  play?: Play;
  /** Every play of this team's games, for the formation / play / result suggestions. */
  suggestFrom: Play[];
  onSave: (play: Play, row: BreakdownRow) => void;
  next?: Play;
  /** Save this play (as entered) and move on, in one change. */
  onNext: (row: BreakdownRow) => void;
  /** View-only (a player account): show what's entered, no editing. */
  readOnly?: boolean;
  /** Our film: which unit was on the field (Black / Blue / Gold). */
  onSetUnit?: (play: Play, unit: TeamUnit | undefined) => void;
}

const ODK = [
  { v: 'O', label: 'O', title: 'Offense' },
  { v: 'D', label: 'D', title: 'Defense' },
  { v: 'K', label: 'K', title: 'Kicking' },
];
const QTR = ['1', '2', '3', '4', 'OT'];
const DN = ['1', '2', '3', '4'];
const LMR = ['L', 'M', 'R'];
const RUN_PASS = ['Run', 'Pass', 'RPO', 'Screen'];
const KICKS = ['KO', 'KO Rec', 'Punt', 'Punt Rec', 'PAT', 'FG'];
const RESULTS = ['Rush', 'Complete', 'Incomplete', 'Sack', 'Scramble', 'Interception', 'Fumble', 'Rush, TD', 'Complete, TD', 'Penalty', 'Return', 'Touchback', 'Fair catch'];

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter((x) => x && x !== '-'))].sort((a, b) => a.localeCompare(b));

const UNITS: { id: TeamUnit; label: string; dot: string }[] = [
  { id: 'black', label: 'Black', dot: '#0f172a' },
  { id: 'blue', label: 'Blue', dot: '#2563eb' },
  { id: 'gold', label: 'Gold', dot: '#f59e0b' },
];

export const BreakdownPanel: React.FC<Props> = ({ play, suggestFrom, onSave, next, onNext, readOnly, onSetUnit }) => {
  const saved = useMemo(() => (play ? breakdownRowOf(play) : {}), [play]);
  // Typed boxes: kept here until they're saved.
  const [draft, setDraft] = useState<BreakdownRow>(saved);
  useEffect(() => setDraft(saved), [saved]);

  const lists = useMemo(
    () => ({
      form: uniq(suggestFrom.map((p) => p.formation)),
      play: uniq(suggestFrom.map((p) => p.untaggedName || p.playName)),
      result: uniq([...RESULTS, ...suggestFrom.map((p) => p.result)]),
    }),
    [suggestFrom]
  );

  if (!play) return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Pick a play to break it down.</p>;

  const row = { ...saved, ...draft };
  const save = (patch: BreakdownRow) => {
    const merged = { ...row, ...patch };
    setDraft(merged);
    onSave(play, merged);
  };
  const changed = (BREAKDOWN_TYPED as BreakdownColumn[]).some((c) => (draft[c] || '') !== (saved[c] || ''));
  const commitTyped = () => {
    if (changed) onSave(play, row);
  };
  const toggle = (c: BreakdownColumn, v: string) => save({ [c]: row[c] === v ? '' : v });

  const chips = (c: BreakdownColumn, values: { v: string; label: string; title?: string }[]) => (
    <div className="flex flex-wrap gap-1">
      {values.map((o) => {
        const on = row[c] === o.v;
        return (
          <button
            key={o.v}
            type="button"
            disabled={readOnly}
            aria-pressed={on}
            title={o.title}
            onClick={() => toggle(c, o.v)}
            className={`min-w-[2rem] h-7 px-2 rounded-md text-xs font-bold ${
              on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            } disabled:cursor-default`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
  const plain = (xs: string[]) => xs.map((v) => ({ v, label: v }));
  const box = (c: BreakdownColumn, opts: { placeholder?: string; list?: string; inputMode?: 'numeric' | 'text'; className?: string } = {}) => (
    <input
      value={row[c] || ''}
      readOnly={readOnly}
      onChange={(e) => setDraft((d) => ({ ...d, [c]: e.target.value }))}
      onBlur={commitTyped}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitTyped();
        }
      }}
      placeholder={opts.placeholder}
      list={opts.list}
      inputMode={opts.inputMode}
      aria-label={c}
      className={`h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${opts.className || 'w-full'}`}
    />
  );
  const field = (label: string, body: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {body}
    </div>
  );

  const goNext = () => onNext(row);
  const listId = `bd-${play.id}`;

  return (
    <div className="flex flex-col gap-2 p-3">
      {onSetUnit && playIsUnitTaggable(play) && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Unit</span>
          <div className="flex gap-1">
            {UNITS.map((u) => {
              const on = play.unit === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={on}
                  onClick={() => onSetUnit(play, on ? undefined : u.id)}
                  className={`h-7 px-2 rounded-md text-xs font-bold inline-flex items-center gap-1.5 ${
                    on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full ring-1 ring-white/60" style={{ background: u.dot }} />
                  {u.label}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-400 truncate">Subs: ▸ next to the play number in the play log</span>
        </div>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-x-3">
        {field('ODK', chips('ODK', ODK))}
        {field('Quarter', chips('QTR', plain(QTR)))}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3">
        {field('Down', chips('DN', plain(DN)))}
        {field('Distance', box('DIST', { placeholder: '10', inputMode: 'numeric', className: 'w-16' }))}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-3">
        {field('Yard line', box('YARD LN', { placeholder: '-25 ours · +30 theirs' }))}
        {field('Hash', chips('HASH', plain(LMR)))}
      </div>
      <div className="grid grid-cols-2 gap-x-2">
        {field('Formation', box('OFF FORM', { list: `${listId}-form`, placeholder: 'Trips Rt' }))}
        {field('Play', box('OFF PLAY', { list: `${listId}-play`, placeholder: '34 Power' }))}
      </div>
      {field('Play type', chips('PLAY TYPE', plain(row.ODK === 'K' ? KICKS : RUN_PASS)))}
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-3">
        {field('Dir', chips('PLAY DIR', plain(LMR)))}
        {field('Result', box('RESULT', { list: `${listId}-result`, placeholder: 'Rush, Complete…' }))}
        {field('Gain', box('GN/LS', { placeholder: '0', inputMode: 'numeric', className: 'w-14' }))}
      </div>
      <datalist id={`${listId}-form`}>{lists.form.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id={`${listId}-play`}>{lists.play.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id={`${listId}-result`}>{lists.result.map((v) => <option key={v} value={v} />)}</datalist>

      {!readOnly && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              if (Object.keys(row).some((k) => row[k as BreakdownColumn]) && !window.confirm(`Clear everything entered for play #${play.playNumber}?`)) return;
              setDraft({});
              onSave(play, {});
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <Eraser size={14} /> Clear
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!next}
            className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold bg-indigo-600 text-white disabled:opacity-40"
          >
            Next play <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

/** The columns typed into a box (saved on leaving it), as opposed to buttons (saved on click). */
const BREAKDOWN_TYPED: BreakdownColumn[] = ['DIST', 'YARD LN', 'OFF FORM', 'OFF PLAY', 'RESULT', 'GN/LS'];
