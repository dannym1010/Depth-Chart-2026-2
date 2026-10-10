import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { DiagramImage } from '../playbook/DiagramImage';
import { BLITZ_SITUATION, PLAN_SITUATIONS, type FormationPlan, type OppFormation } from '../../utils/scoutOppPlays';

const INPUT = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs';

/**
 * Our calls against each of their formations: the base call, the blitzes we like against it, and calls for
 * situations. Used on the Scouting "Their plays" page and on the defense call sheet (same saved plan).
 */
export const FormationPlanEditor: React.FC<{
  formations: OppFormation[];
  defenseCalls: PlayDatabaseEntry[];
  onSavePlan: (f: OppFormation, plan: FormationPlan) => void;
  /** Show each formation's picture vs our defense. */
  showPictures?: boolean;
}> = ({ formations, defenseCalls, onSavePlan, showPictures }) => {
  const [draft, setDraftAll] = useState<Record<string, { situation: string; callId: string; blitzId: string }>>({});
  const callName = (id?: string) => (id ? defenseCalls.find((p) => p.id === id)?.name : undefined);
  const blitzCalls = defenseCalls.filter((c) => c.type === 'blitz');

  return (
    <>
      <ul className="space-y-2">
        {formations.map((f) => {
          const plan: FormationPlan = f.plan || { calls: [] };
          const key = f.id || `film:${f.name}`;
          const d = draft[key] || { situation: '', callId: '', blitzId: '' };
          const setDraft = (p: Partial<typeof d>) => setDraftAll((all) => ({ ...all, [key]: { ...d, ...p } }));
          const blitzes = plan.calls.filter((c) => c.situation === BLITZ_SITUATION);
          const situational = plan.calls.filter((c) => c.situation !== BLITZ_SITUATION);
          const picture = f.defenseUrl || f.diagramUrl;
          const chip = (c: { id: string; situation: string; callId: string }, label: React.ReactNode) => (
            <li key={c.id} className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px]">
              {label}
              <span className="font-bold text-slate-700 dark:text-slate-200">{callName(c.callId) || 'Call removed from the Play Library'}</span>
              <button
                type="button"
                aria-label={`Remove ${c.situation} ${callName(c.callId) || ''}`}
                onClick={() => onSavePlan(f, { ...plan, calls: plan.calls.filter((x) => x.id !== c.id) })}
                className="h-5 w-5 rounded text-slate-400 hover:text-rose-500 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          );
          return (
            <li key={key} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
              <div className={showPictures && picture ? 'grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]' : ''}>
                {showPictures && picture && (
                  <DiagramImage
                    url={picture}
                    alt={`${f.name} vs ${f.defenseName || 'our defense'}`}
                    className="w-full rounded-md border border-emerald-300 dark:border-emerald-700 bg-white self-start"
                  />
                )}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-slate-900 dark:text-white min-w-[7rem]">vs {f.name}</span>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      Base
                      <select
                        aria-label={`Base call vs ${f.name}`}
                        value={plan.base || ''}
                        onChange={(e) => onSavePlan(f, { ...plan, base: e.target.value || undefined })}
                        className={`${INPUT} min-w-[12rem] font-bold`}
                      >
                        <option value="">Pick the base call</option>
                        {defenseCalls.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Blitzes we like against this formation */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 min-w-[7rem]">Blitz options</span>
                    {blitzes.length > 0 && <ul className="contents">{blitzes.map((c) => chip(c, null))}</ul>}
                    <select
                      aria-label={`Add a blitz vs ${f.name}`}
                      value={d.blitzId}
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id || blitzes.some((b) => b.callId === id)) return setDraft({ blitzId: '' });
                        onSavePlan(f, { ...plan, calls: [...plan.calls, { id: `b${Date.now().toString(36)}`, situation: BLITZ_SITUATION, callId: id }] });
                        setDraft({ blitzId: '' });
                      }}
                      className={`${INPUT} min-w-[10rem]`}
                    >
                      <option value="">{blitzCalls.length ? '+ Add a blitz' : 'No blitz calls in the Play Library'}</option>
                      {blitzCalls
                        .filter((c) => !blitzes.some((b) => b.callId === c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {situational.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {situational.map((c) => chip(c, <b className="text-emerald-800 dark:text-emerald-300">{c.situation}:</b>))}
                    </ul>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      list="plan-situations"
                      aria-label={`Situation vs ${f.name}`}
                      placeholder="Situation (3rd & long…)"
                      value={d.situation}
                      onChange={(e) => setDraft({ situation: e.target.value })}
                      className={`${INPUT} w-40`}
                    />
                    <select
                      aria-label={`Call for the situation vs ${f.name}`}
                      value={d.callId}
                      onChange={(e) => setDraft({ callId: e.target.value })}
                      className={`${INPUT} min-w-[12rem]`}
                    >
                      <option value="">Pick the call</option>
                      {defenseCalls.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.type === 'blitz' ? ' (blitz)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!d.situation.trim() || !d.callId}
                      onClick={() => {
                        onSavePlan(f, { ...plan, calls: [...plan.calls, { id: `c${Date.now().toString(36)}`, situation: d.situation.trim(), callId: d.callId }] });
                        setDraft({ situation: '', callId: '' });
                      }}
                      className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-black cursor-pointer disabled:opacity-40"
                    >
                      Add call
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <datalist id="plan-situations">
        {PLAN_SITUATIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </>
  );
};
