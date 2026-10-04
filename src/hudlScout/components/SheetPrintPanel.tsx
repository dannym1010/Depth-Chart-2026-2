import React from 'react';
import type { CallSheetSectionKey } from '../scoutBundle';
import { DEFAULT_SHEET_OPTIONS, type SheetPrintOptions } from '../utils/defenseSheetPrint';

interface Props {
  options: SheetPrintOptions;
  onChange: (next: SheetPrintOptions) => void;
  sections: { key: CallSheetSectionKey; title: string }[];
  /** How many of their play types are on the report (the play page is hidden when there are none). */
  playTypeCount: number;
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

/** What prints, and how: one quiet panel under the sheet's buttons. */
export const SheetPrintPanel: React.FC<Props> = ({ options: o, onChange, sections, playTypeCount }) => {
  const set = (patch: Partial<SheetPrintOptions>) => onChange({ ...o, ...patch });
  const toggleSection = (key: CallSheetSectionKey) => set({ sections: { ...o.sections, [key]: !o.sections[key] } });
  const isDefault = JSON.stringify(o) === JSON.stringify(DEFAULT_SHEET_OPTIONS);
  return (
    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 print:hidden">
      <div>
        {label('Print')}
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
            <button key={s.key} type="button" className={chip(o.sections[s.key])} onClick={() => toggleSection(s.key)}>
              {s.title}
            </button>
          ))}
          <button type="button" className={chip(o.note)} onClick={() => set({ note: !o.note })}>
            Reminder
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

      <div className="flex flex-wrap items-end gap-x-5 gap-y-2.5">
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
        {o.playTypes && playTypeCount > 0 && (
          <>
            <div>
              {label('Plays across')}
              {seg([{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }] as const, o.playTypeCols, (playTypeCols) => set({ playTypeCols }))}
            </div>
            <div>
              {label('Under each play')}
              {seg([{ value: true, label: 'Calls & film' }, { value: false, label: 'Name only' }] as const, o.playTypeDetail, (playTypeDetail) => set({ playTypeDetail }))}
            </div>
          </>
        )}
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_SHEET_OPTIONS)}
            className="h-8 px-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">Crossed-out items won&apos;t print. Your choices are kept on this device.</p>
    </div>
  );
};
