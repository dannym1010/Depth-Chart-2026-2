import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { DEFAULT_DEFENSE, DefenseSystem } from '../../utils/ourDefense';
import { Card, SectionHeader } from './ui';

interface OurDefenseCardProps {
  defense: DefenseSystem;
  /** Unset when this coach may not change the team's defense. */
  onChange?: (next: DefenseSystem) => void;
}

const FIELDS: { key: Exclude<keyof DefenseSystem, 'blitzes' | 'alignments' | 'fronts'>; label: string }[] = [
  { key: 'base', label: 'Base front' },
  { key: 'baseCoverage', label: 'Base coverage' },
  { key: 'baseContain', label: 'Contain in the base' },
  { key: 'check', label: 'Check vs two tight ends' },
  { key: 'checkCoverage', label: 'Coverage in the check' },
  { key: 'checkContain', label: 'Contain in the check' },
  { key: 'over', label: 'Line one gap to the strength' },
];

/** Our defense, which every call in the report is made from; coaches who run the team can change it. */
export const OurDefenseCard: React.FC<OurDefenseCardProps> = ({ defense: d, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DefenseSystem>(d);
  const [blitzText, setBlitzText] = useState(d.blitzes.join(', '));
  const start = () => {
    setDraft(d);
    setBlitzText(d.blitzes.join(', '));
    setEditing(true);
  };
  const save = () => {
    onChange?.({ ...draft, blitzes: blitzText.split(/[,\n]/).map((b) => b.trim()).filter(Boolean) });
    setEditing(false);
  };
  const input =
    'w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100';

  return (
    <Card>
      <SectionHeader
        title="Our defense"
        subtitle="Every call in this report is made from these."
        right={
          onChange && !editing ? (
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" /> Change
            </button>
          ) : undefined
        }
      />
      {!editing ? (
        <ul className="text-xs text-slate-700 dark:text-slate-200 space-y-1">
          <li>
            <strong>Base:</strong> {d.base} {d.baseCoverage}. {d.baseContain} have contain.
          </li>
          <li>
            <strong>Two tight ends:</strong> check {d.check} ({d.checkCoverage}). {d.checkContain} have contain.
          </li>
          <li>
            <strong>{d.over}:</strong> the {d.check} with the line slid one gap toward the strength, when they run to it.
          </li>
          <li>
            <strong>Blitzes:</strong> {d.blitzes.length ? d.blitzes.join(', ') : <span className="text-slate-500 dark:text-slate-400">none named yet</span>}. Called on
            passing downs.
          </li>
        </ul>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {f.label}
                <input
                  className={input}
                  value={draft[f.key]}
                  placeholder={DEFAULT_DEFENSE[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              </label>
            ))}
            <label className="sm:col-span-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Blitz packages (separate with commas; the first is the one called on passing downs)
              <input className={input} value={blitzText} placeholder="Fire, Storm, Dog" onChange={(e) => setBlitzText(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};
