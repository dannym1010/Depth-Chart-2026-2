import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { DefenseSystem, HandSignal } from '../../utils/ourDefense';
import { PRESSURES } from '../../../utils/defenseCalls';
import { Card, EmptyNote, SectionHeader } from './ui';

interface HandSignalsCardProps {
  defense: DefenseSystem;
  /** Unset when this coach may not change the team's defense. */
  onChange?: (next: DefenseSystem) => void;
}

const KINDS: HandSignal['kind'][] = ['Blitz', 'Stunt'];
const newId = () => `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Our blitzes and stunts with the hand signal for each, so every coach signals them the same way. */
export const HandSignalsCard: React.FC<HandSignalsCardProps> = ({ defense: d, onChange }) => {
  const saved = d.signals || [];
  // The team's blitz packages show even before a signal is set for them.
  const listed = [
    ...saved,
    ...d.blitzes
      .filter((b) => !saved.some((x) => x.name.trim().toLowerCase() === b.trim().toLowerCase()))
      .map((b) => ({ id: `blitz:${b}`, name: b, kind: 'Blitz' as const, signal: '' })),
  ];
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<HandSignal[]>(listed);

  const start = () => {
    setRows(listed.map((r) => (r.id.startsWith('blitz:') ? { ...r, id: newId() } : r)));
    setEditing(true);
  };
  const save = () => {
    const signals = rows.map((r) => ({ ...r, name: r.name.trim(), signal: r.signal.trim() })).filter((r) => r.name);
    onChange?.({ ...d, signals });
    setEditing(false);
  };
  const set = (id: string, patch: Partial<HandSignal>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = (kind: HandSignal['kind']) => setRows((prev) => [...prev, { id: newId(), name: '', kind, signal: '' }]);

  // Names to pick from: our blitz packages, our saved fronts, and the blitzes / stunts the play builder draws.
  const suggestions = (kind: HandSignal['kind']) => [
    ...new Set([
      ...(kind === 'Blitz' ? d.blitzes : []),
      ...(d.fronts || []).filter((f) => f.call?.pressure).map((f) => f.name),
      ...PRESSURES.filter((p) => p.group === kind).map((p) => p.short),
    ]),
  ];
  const input =
    'w-full h-8 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400';

  return (
    <Card>
      <SectionHeader
        title="Hand signals"
        subtitle="How we signal each blitz and stunt from the sideline. Saved with the team for every coach."
        right={
          onChange && !editing ? (
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          ) : undefined
        }
      />
      {!editing ? (
        listed.length === 0 ? (
          <EmptyNote>No signals yet.{onChange ? ' Click Edit to add your blitzes and stunts.' : ''}</EmptyNote>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {KINDS.map((kind) => {
              const list = listed.filter((r) => r.kind === kind);
              return (
                <div key={kind}>
                  <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">{kind === 'Blitz' ? 'Blitzes' : 'Stunts'}</div>
                  {list.length === 0 ? (
                    <EmptyNote>None yet.</EmptyNote>
                  ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                      {list.map((r) => (
                        <li key={r.id} className="py-1.5 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3 text-xs">
                          <span className="font-bold text-slate-900 dark:text-slate-100 break-words">{r.name}</span>
                          {r.signal ? (
                            <span className="text-slate-700 dark:text-slate-200 break-words">{r.signal}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">No signal yet</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {KINDS.map((kind) => (
            <div key={kind} className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">{kind === 'Blitz' ? 'Blitzes' : 'Stunts'}</div>
              <datalist id={`signal-names-${kind}`}>
                {suggestions(kind).map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              {rows
                .filter((r) => r.kind === kind)
                .map((r) => (
                  <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_32px] sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_32px] gap-1.5 items-center">
                    <input
                      id={`${r.id}-name`}
                      className={input}
                      value={r.name}
                      list={`signal-names-${kind}`}
                      placeholder={kind === 'Blitz' ? 'Double Dog' : 'Cross LIZ'}
                      aria-label={`${kind} name`}
                      onChange={(e) => set(r.id, { name: e.target.value })}
                    />
                    <input
                      id={`${r.id}-signal`}
                      className={`${input} col-start-1 sm:col-start-auto`}
                      value={r.signal}
                      placeholder="e.g. Both fists on top of the helmet"
                      aria-label={`Hand signal for ${r.name || kind.toLowerCase()}`}
                      onChange={(e) => set(r.id, { signal: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      aria-label={`Remove ${r.name || kind.toLowerCase()}`}
                      className="row-start-1 col-start-2 sm:row-start-auto sm:col-start-auto h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              <button
                type="button"
                onClick={() => add(kind)}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add a {kind.toLowerCase()}
              </button>
            </div>
          ))}
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
