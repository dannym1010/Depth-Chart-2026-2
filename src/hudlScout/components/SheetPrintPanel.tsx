import React, { useState } from 'react';
import { ChevronDown, StickyNote } from 'lucide-react';
import { DEFAULT_SHEET_OPTIONS, type SheetPrintOptions } from '../utils/defenseSheetPrint';
import { PlanNotes } from '../../components/scouting/FormationPlanEditor';

/** Print a formation or leave it off; print one of its plays or leave it off; its game plan notes (saved on the formation). */
export type FormationPrintChange = { print: boolean } | { playIds: string[]; show: boolean } | { playIds: string[]; point: string } | { notes: string };

/** One of their plays' coaching point: typed here, saved (for every coach) when the box is left. */
const PointInput: React.FC<{ value: string; play: string; onSave: (point: string) => void }> = ({ value, play, onSave }) => {
  const [text, setText] = useState(value);
  return (
    <textarea
      value={text}
      rows={text.length > 60 ? 3 : 1}
      aria-label={`Coaching point for ${play}`}
      placeholder="Add a coaching point…"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value.trim() && onSave(text.trim())}
      className="w-full min-h-[28px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 py-1 text-[11px] leading-snug resize-y"
    />
  );
};

type PlayRow = { name: string; ids: string[]; hidden: boolean; point?: string; onReport?: boolean };

/** Their plays, one row each: a checkbox to print it and its coaching point. */
const PlayRows: React.FC<{ plays: PlayRow[]; onShow: (ids: string[], show: boolean) => void; onPoint: (ids: string[], point: string) => void }> = ({ plays, onShow, onPoint }) => (
  <ul className="mt-1.5 space-y-1">
    {plays.map((p) => (
      <li key={p.name} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5">
        <label className={`inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer max-w-[9rem] ${p.hidden ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
          <input type="checkbox" className="h-3.5 w-3.5 shrink-0 cursor-pointer" checked={!p.hidden} onChange={() => onShow(p.ids, p.hidden)} aria-label={`Print ${p.name}`} />
          <span className="truncate" title={p.onReport === false ? `${p.name} (not on the report)` : p.name}>
            {p.name}
          </span>
          {p.onReport === false && <span className="shrink-0 text-[9px] font-bold text-slate-400" title="Not on the scouting report">·new</span>}
        </label>
        {p.hidden ? <span /> : <PointInput key={`${p.name}:${p.point || ''}`} value={p.point || ''} play={p.name} onSave={(point) => onPoint(p.ids, point)} />}
      </li>
    ))}
  </ul>
);

/** Print one of their plays or leave it off the call sheet's play page; or its coaching point. */
export type TheirPlayChange = { playIds: string[]; sheetShow: boolean } | { playIds: string[]; point: string };

interface Props {
  options: SheetPrintOptions;
  onChange: (next: SheetPrintOptions) => void;
  sections: { key: string; title: string }[];
  /** How many of their play types are on the report (the play page is hidden when there are none). */
  playTypeCount: number;
  /** How many of their formations have our calls set (Their plays → Our calls vs their formations). */
  formationPlanCount?: number;
  /** Their formations on the sheet, with what prints of each. */
  formations?: { id?: string; name: string; printSkip?: boolean; notes?: string; plays?: { name: string; ids: string[]; hidden: boolean; point?: string }[] }[];
  onFormationPrint?: (id: string, change: FormationPrintChange) => void;
  /** The play page's cards (one per play type), with which of their plays print. */
  playTypes?: { key: string; label: string; plays: PlayRow[]; kind: 'run' | 'pass' }[];
  onTheirPlay?: (change: TheirPlayChange) => void;
}

const chip = (on: boolean) =>
  `h-8 px-2.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
    on
      ? 'bg-indigo-600 text-white border-indigo-600'
      : 'bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 line-through decoration-slate-400/70 hover:text-slate-800 dark:hover:text-slate-200'
  }`;

const seg = <T extends string | number | boolean>(options: readonly { value: T; label: string }[], value: T, onPick: (v: T) => void) => (
  <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-bold">
    {options.map((o) => (
      <button
        key={String(o.value)}
        type="button"
        aria-pressed={value === o.value}
        onClick={() => onPick(o.value)}
        className={`h-8 px-2.5 cursor-pointer ${
          value === o.value
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const label = (text: string) => (
  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{text}</div>
);

const SHOW_HIDE = [{ value: true, label: 'Show' }, { value: false, label: 'Hide' }] as const;

/** What prints, and how: a column beside the preview (the preview is the printout). */
export const SheetPrintPanel: React.FC<Props> = ({ options: o, onChange, sections, playTypeCount, formationPlanCount = 0, formations = [], onFormationPrint, playTypes = [], onTheirPlay }) => {
  const set = (patch: Partial<SheetPrintOptions>) => onChange({ ...o, ...patch });
  const toggleSection = (key: string) => set({ sections: { ...o.sections, [key]: o.sections[key] === false } });
  const isDefault = JSON.stringify(o) === JSON.stringify(DEFAULT_SHEET_OPTIONS);
  // One formation's plays or notes open at a time, so the list stays short.
  const [open, setOpen] = useState<{ id: string; what: 'plays' | 'notes' } | null>(null);
  const toggleOpen = (id: string, what: 'plays' | 'notes') => setOpen((cur) => (cur?.id === id && cur.what === what ? null : { id, what }));
  const listed = formations.filter((f) => f.id);

  return (
    <div className="p-3 space-y-4 text-slate-800 dark:text-slate-200">
      <div>
        {label('On the sheet')}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(o.title)} onClick={() => set({ title: !o.title })}>
            Title
          </button>
          <button type="button" className={chip(o.stats)} onClick={() => set({ stats: !o.stats })}>
            Run / pass numbers
          </button>
          <button type="button" className={chip(o.alerts)} onClick={() => set({ alerts: !o.alerts })}>
            Sideline tells
          </button>
          {sections.map((s) => (
            <button key={s.key} type="button" className={chip(o.sections[s.key] !== false)} onClick={() => toggleSection(s.key)}>
              {s.title}
            </button>
          ))}
          <button type="button" className={chip(o.note)} onClick={() => set({ note: !o.note })}>
            Reminder
          </button>
          <button
            type="button"
            disabled={!formationPlanCount}
            title={!formationPlanCount ? 'No calls set against their formations yet (Their plays)' : undefined}
            className={`${chip(o.formationPlans && Boolean(formationPlanCount))} disabled:opacity-40 disabled:cursor-not-allowed`}
            onClick={() => set({ formationPlans: !o.formationPlans })}
          >
            Our calls vs their formations{formationPlanCount ? ` (${formationPlanCount})` : ''}
          </button>
          <button
            type="button"
            disabled={playTypeCount === 0}
            title={playTypeCount === 0 ? 'No plays are on the report yet (Their plays)' : undefined}
            className={`${chip(o.playTypes && playTypeCount > 0)} disabled:opacity-40 disabled:cursor-not-allowed`}
            onClick={() => set({ playTypes: !o.playTypes })}
          >
            Their plays vs. our defense{playTypeCount ? ` (${playTypeCount})` : ''}
          </button>
        </div>
      </div>

      {o.formationPlans && formationPlanCount > 0 && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 p-2.5 space-y-2.5">
          <div className="text-xs font-black text-emerald-800 dark:text-emerald-300">Our calls vs their formations</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div>
              {label('Across')}
              {seg([{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }] as const, o.formationCols, (formationCols) => set({ formationCols }))}
            </div>
            <div>
              {label('Their plays')}
              {seg([{ value: 1, label: '1 column' }, { value: 2, label: '2 columns' }] as const, o.theirPlayCols, (theirPlayCols) => set({ theirPlayCols }))}
            </div>
            <div>
              {label('Coaching points')}
              {seg(SHOW_HIDE, o.theirPlayPoints, (theirPlayPoints) => set({ theirPlayPoints }))}
            </div>
            <div>
              {label('Picture')}
              {seg(SHOW_HIDE, o.formationPicture, (formationPicture) => set({ formationPicture }))}
            </div>
            <div>
              {label('Game plan notes')}
              {seg(SHOW_HIDE, o.formationNotes, (formationNotes) => set({ formationNotes }))}
            </div>
          </div>

          {onFormationPrint && listed.length > 0 && (
            <div>
              {label('Formations')}
              <ul className="rounded-md border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                {listed.map((f) => {
                  const plays = f.plays || [];
                  const shown = plays.filter((p) => !p.hidden).length;
                  const playsOpen = open?.id === f.id && open.what === 'plays';
                  const notesOpen = open?.id === f.id && open.what === 'notes';
                  return (
                    <li key={f.id} className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className={`flex-1 min-w-0 inline-flex items-center gap-1.5 text-xs font-black cursor-pointer ${f.printSkip ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                          <input type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer" checked={!f.printSkip} onChange={(e) => onFormationPrint(f.id!, { print: e.target.checked })} />
                          <span className="truncate">{f.name}</span>
                        </label>
                        {!f.printSkip && plays.length > 0 && (
                          <button
                            type="button"
                            aria-expanded={playsOpen}
                            onClick={() => toggleOpen(f.id!, 'plays')}
                            title="Their plays under it: which print, and their coaching points"
                            className={`h-7 px-2 rounded text-[11px] font-bold inline-flex items-center gap-0.5 cursor-pointer ${playsOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'}`}
                          >
                            Plays {shown}/{plays.length}
                            <ChevronDown className={`w-3 h-3 transition-transform ${playsOpen ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                        {!f.printSkip && (
                          <button
                            type="button"
                            aria-expanded={notesOpen}
                            onClick={() => toggleOpen(f.id!, 'notes')}
                            title={f.notes ? 'Edit the game plan notes' : 'Add game plan notes'}
                            aria-label={`Game plan notes for ${f.name}`}
                            className={`h-7 px-2 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${notesOpen ? 'bg-indigo-600 text-white' : f.notes ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                          >
                            <StickyNote className="w-3 h-3" /> Notes
                          </button>
                        )}
                      </div>
                      {playsOpen && (
                        <PlayRows
                          plays={plays}
                          onShow={(playIds, show) => onFormationPrint(f.id!, { playIds, show })}
                          onPoint={(playIds, point) => onFormationPrint(f.id!, { playIds, point })}
                        />
                      )}
                      {notesOpen && (
                        <div className="mt-1.5">
                          <PlanNotes
                            key={`${f.id}:${f.notes || ''}`}
                            label={`Game plan notes vs ${f.name}`}
                            value={f.notes || ''}
                            rows={4}
                            onSave={(notes) => onFormationPrint(f.id!, { notes })}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Saved for every coach (same choices as the formations printout).</p>
            </div>
          )}
        </div>
      )}

      {o.playTypes && playTypeCount > 0 && (
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-900 p-2.5 space-y-2.5">
          <div className="text-xs font-black text-indigo-800 dark:text-indigo-300">Their plays vs. our defense (own page)</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <div>
              {label('Across')}
              {seg([{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }] as const, o.playTypeCols, (playTypeCols) => set({ playTypeCols }))}
            </div>
            <div>
              {label('Under each play')}
              {seg([{ value: true, label: 'Calls & film' }, { value: false, label: 'Name only' }] as const, o.playTypeDetail, (playTypeDetail) => set({ playTypeDetail }))}
            </div>
            <div>
              {label('Order')}
              {seg([{ value: 'run', label: 'Runs first' }, { value: 'pass', label: 'Passes first' }, { value: 'list', label: 'As listed' }] as const, o.playTypeSort, (playTypeSort) => set({ playTypeSort }))}
            </div>
            <div>
              {label('Coaching points')}
              {seg(SHOW_HIDE, o.playTypePoints, (playTypePoints) => set({ playTypePoints }))}
            </div>
            <div>
              {label('Picture')}
              {seg(SHOW_HIDE, o.playTypePicture, (playTypePicture) => set({ playTypePicture }))}
            </div>
            {o.playTypePicture && (
              <div>
                {label('Zone drops')}
                {seg(SHOW_HIDE, o.playTypeZones, (playTypeZones) => set({ playTypeZones }))}
              </div>
            )}
          </div>

          {onTheirPlay && playTypes.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-2">
                {label('Plays')}
                <div className="flex gap-1 -mt-1">
                  {[
                    { text: 'All', on: () => true },
                    { text: 'Runs', on: (k: string) => k === 'run' },
                    { text: 'Passes', on: (k: string) => k === 'pass' },
                    { text: 'None', on: () => false },
                  ].map((b) => (
                    <button
                      key={b.text}
                      type="button"
                      title={b.text === 'All' || b.text === 'None' ? `${b.text} of their plays` : `Only the ${b.text.toLowerCase()}`}
                      onClick={() => {
                        const ids = (show: boolean) => playTypes.filter((t) => b.on(t.kind) === show).flatMap((t) => t.plays.flatMap((p) => p.ids));
                        if (ids(true).length) onTheirPlay({ playIds: ids(true), sheetShow: true });
                        if (ids(false).length) onTheirPlay({ playIds: ids(false), sheetShow: false });
                      }}
                      className="h-6 px-2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {b.text}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Printing {playTypes.reduce((n, t) => n + t.plays.filter((p) => !p.hidden).length, 0)} of{' '}
                {playTypes.reduce((n, t) => n + t.plays.length, 0)} of their plays ({playTypes.filter((t) => t.kind === 'run').length} run,{' '}
                {playTypes.filter((t) => t.kind === 'pass').length} pass cards)
              </p>
              <ul className="rounded-md border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                {playTypes.map((t) => {
                  const shown = t.plays.filter((p) => !p.hidden).length;
                  const off = shown === 0;
                  const isOpen = open?.id === `type:${t.key}`;
                  const ids = t.plays.flatMap((p) => p.ids);
                  return (
                    <li key={t.key} className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className={`flex-1 min-w-0 inline-flex items-center gap-1.5 text-xs font-black cursor-pointer ${off ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 cursor-pointer"
                            checked={!off}
                            ref={(el) => {
                              if (el) el.indeterminate = !off && shown < t.plays.length;
                            }}
                            onChange={() => onTheirPlay({ playIds: ids, sheetShow: off })}
                          />
                          <span
                            className={`shrink-0 h-4 px-1 rounded text-[9px] font-black leading-4 ${t.kind === 'run' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200' : 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200'}`}
                            title={t.kind === 'run' ? 'Run' : 'Pass'}
                          >
                            {t.kind === 'run' ? 'RUN' : 'PASS'}
                          </span>
                          <span className="truncate">{t.label}</span>
                        </label>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => toggleOpen(`type:${t.key}`, 'plays')}
                          title="Which of these plays print, and their coaching points"
                          className={`h-7 px-2 rounded text-[11px] font-bold inline-flex items-center gap-0.5 cursor-pointer ${isOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'}`}
                        >
                          Plays {shown}/{t.plays.length}
                          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {isOpen && (
                        <PlayRows
                          plays={t.plays}
                          onShow={(playIds, show) => onTheirPlay({ playIds, sheetShow: show })}
                          onPoint={(playIds, point) => onTheirPlay({ playIds, point })}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Every play of theirs is here; the ones on the scouting report start checked (·new = not on the report). Saved for every coach. A coaching point is the one on the play in the play builder.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
        <div>
          {label('Text')}
          {seg([{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }] as const, o.size, (size) => set({ size }))}
        </div>
        <div>
          {label('Ink')}
          {seg([{ value: 'color', label: 'Color' }, { value: 'bw', label: 'Black & white' }] as const, o.ink, (ink) => set({ ink }))}
        </div>
        <div>
          {label('Paper')}
          {seg([{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }] as const, o.orientation, (orientation) => set({ orientation }))}
        </div>
        <div>
          {label('Numbers')}
          {seg([{ value: true, label: '1. 2. 3.' }, { value: false, label: 'None' }] as const, o.numbers, (numbers) => set({ numbers }))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">Crossed-out items won&apos;t print. The look is kept on this device.</p>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_SHEET_OPTIONS)}
            className="h-8 px-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer shrink-0"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
