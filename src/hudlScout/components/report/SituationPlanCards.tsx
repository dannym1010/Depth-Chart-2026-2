import React, { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Play } from '../../types/football';
import type { DefenseCall } from '../../utils/ourDefense';
import type { GamePlanCall } from '../../scoutBundle';
import {
  PART_SITUATION,
  formationPlan,
  isLiveSnap,
  keyReads,
  planCallFor,
  playCallName,
  situationPlan,
  type Expect,
  type FormationPart,
  type PlanRow,
} from '../../utils/situationPlan';
import { playFormationBase } from '../../utils/strength';
import { formationKey, type OppFormation } from '../../../utils/scoutOppPlays';
import { isPassPlay, isRunPlay } from './reportText';
import { Card, EmptyNote, RunPassBar, RunPassLegend, SectionHeader, WatchCutupFn, WatchPill } from './ui';

// The game plan from their film: the few things to coach, run or pass on each down and distance,
// and what they run from each formation. Every call starts as a suggestion from our defense; a coach
// can pick one of our defensive calls (Play Library) or type one, and it saves with the week.

export interface CallOption {
  id: string;
  name: string;
}

/** A coach's pick: a Play Library call, or typed text (empty = use the suggestion). */
export type CallPick = { callId?: string; text?: string } | null;

const EXPECT_CLASS: Record<Expect, string> = {
  run: 'text-emerald-700 dark:text-emerald-400',
  pass: 'text-blue-700 dark:text-blue-400',
  mix: 'text-amber-700 dark:text-amber-400',
};

const nameOfPick = (pick: { callId?: string; text?: string } | undefined, options: CallOption[]) =>
  pick?.text?.trim() || (pick?.callId ? options.find((o) => o.id === pick.callId)?.name : '') || '';

function matchSituationKey(p: Play, key: string): boolean {
  if (!isLiveSnap(p)) return false;
  if (key === '1') return p.down === 1;
  const m = key.match(/^([234])-(short|medium|long|xlong)$/);
  if (!m) return false;
  const down = Number(m[1]);
  const band = m[2];
  if (p.down !== down) return false;
  if (band === 'short') return p.distance >= 1 && p.distance <= 3;
  if (band === 'medium') return p.distance >= 4 && p.distance <= 6;
  if (band === 'long') return p.distance >= 7 && p.distance <= 10;
  return p.distance >= 11;
}

function matchFormationPart(p: Play, formation: string, part?: FormationPart): boolean {
  if (!isLiveSnap(p) || playFormationBase(p) !== formation) return false;
  if (!part) return true;
  if (part === 'first') return p.down === 1;
  if (part === 'short') return p.down > 1 && p.distance <= 3;
  if (part === 'medium') return p.down > 1 && p.distance >= 4 && p.distance <= 6;
  return p.down > 1 && p.distance >= 7;
}

/** Our call on one row: the coach's own call when set, else the suggested one; Change opens a picker. */
const CallEditor: React.FC<{
  id: string;
  suggested: DefenseCall;
  chosen?: { name: string; callId?: string; text?: string; from?: string };
  options: CallOption[];
  onSave?: (pick: CallPick) => void;
}> = ({ id, suggested, chosen, options, onSave }) => {
  const [open, setOpen] = useState(false);
  const [callId, setCallId] = useState('');
  const [text, setText] = useState('');
  const start = () => {
    setCallId(chosen?.callId && !chosen.text ? chosen.callId : '');
    setText(chosen?.text || '');
    setOpen(true);
  };
  const save = () => {
    onSave?.(text.trim() ? { text: text.trim() } : callId ? { callId } : null);
    setOpen(false);
  };
  if (open) {
    return (
      <div className="space-y-1.5 text-xs">
        <select
          id={`${id}-pick`}
          value={callId}
          onChange={(e) => {
            setCallId(e.target.value);
            if (e.target.value) setText('');
          }}
          aria-label="Pick one of our defensive calls"
          className="w-full h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-2"
        >
          <option value="">{options.length ? 'Pick one of our calls…' : 'No defensive plays in the Play Library yet'}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input
          id={`${id}-text`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) setCallId('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="or type a call, e.g. 4-4 Double Dog"
          aria-label="Type a call"
          className="w-full h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-2 placeholder:text-slate-400"
        />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={save} className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
          >
            Cancel
          </button>
          {chosen && !chosen.from && (
            <button
              type="button"
              onClick={() => {
                onSave?.(null);
                setOpen(false);
              }}
              className="h-8 px-3 rounded-lg text-slate-600 dark:text-slate-300 hover:underline font-semibold cursor-pointer"
            >
              Use suggested ({suggested.front})
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="text-xs">
      {chosen ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-900 dark:text-slate-100">{chosen.name}</span>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-indigo-500 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300">
              {chosen.from || 'Your call'}
            </span>
          </div>
          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
            Suggested: {suggested.front} · {suggested.coverage}
          </div>
        </>
      ) : (
        <>
          <div className="font-bold text-slate-900 dark:text-slate-100">
            {suggested.front} · {suggested.coverage}
          </div>
          <div className="text-slate-600 dark:text-slate-300 mt-0.5">{suggested.emphasis}</div>
        </>
      )}
      {onSave && (
        <button
          type="button"
          onClick={start}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
        >
          <Pencil className="w-3 h-3" /> {chosen ? 'Change' : 'Set our call'}
        </button>
      )}
    </div>
  );
};

const RowStats: React.FC<{ row: PlanRow; subset?: Play[]; onWatchCutup?: WatchCutupFn }> = ({ row, subset = [], onWatchCutup }) => (
  <div>
    <RunPassBar
      runPct={row.runPct}
      passPct={100 - row.runPct}
      height="h-2"
      showLabels={false}
      onClickRun={
        onWatchCutup && subset.filter(isRunPlay).length > 0
          ? () => onWatchCutup(`${row.label} · Runs`, subset.filter(isRunPlay))
          : undefined
      }
      onClickPass={
        onWatchCutup && subset.filter(isPassPlay).length > 0
          ? () => onWatchCutup(`${row.label} · Passes`, subset.filter(isPassPlay))
          : undefined
      }
    />
    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
      {row.run} run · {row.pass} pass · {row.avgGain} avg
    </div>
  </div>
);

export const KeyReadsCard: React.FC<{ plays: Play[] }> = ({ plays }) => {
  const reads = useMemo(() => keyReads(plays), [plays]);
  if (!reads.length) return null;
  return (
    <Card tone="plan">
      <SectionHeader title="Things to coach this week" subtitle="The clearest tendencies on their film." />
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-800 dark:text-slate-100">
        {reads.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </Card>
  );
};

interface EditProps {
  /** Our defensive calls to pick from. */
  defenseCalls?: CallOption[];
  /** The coaches' own calls on the plan (saved with the week). */
  gamePlanCalls?: Record<string, GamePlanCall>;
  /** Set or clear a row's call (unset = this coach can't edit). */
  onSetGamePlanCall?: (key: string, pick: CallPick) => void;
  onWatchCutup?: WatchCutupFn;
}

export const SituationPlanCard: React.FC<{ plays: Play[]; opponentName: string } & EditProps> = ({
  plays,
  opponentName,
  defenseCalls = [],
  gamePlanCalls = {},
  onSetGamePlanCall,
  onWatchCutup,
}) => {
  const rows = useMemo(() => situationPlan(plays), [plays]);
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <Card>
      <SectionHeader
        title="Run or pass by down & distance"
        subtitle={`What ${opponentName} ran on each down and distance (${total} live snaps; penalties left out), and our call. Click any row or bar to watch those snaps.`}
        right={<RunPassLegend />}
      />
      {rows.length === 0 ? (
        <EmptyNote>No runs or passes with a down and distance yet. Tag DN, DIST and PLAY TYPE on their offense's clips.</EmptyNote>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => {
            const key = `dd:${r.key}`;
            const pick = gamePlanCalls[key];
            const name = nameOfPick(pick, defenseCalls);
            const rowPlays = plays.filter((p) => matchSituationKey(p, r.key));
            const canClick = Boolean(onWatchCutup && rowPlays.length > 0);
            return (
              <div key={r.key} className="py-3 grid grid-cols-1 md:grid-cols-[140px_150px_minmax(0,1fr)_minmax(0,1fr)] gap-2 md:gap-4">
                <div
                  onClick={canClick ? () => onWatchCutup?.(r.label, rowPlays) : undefined}
                  className={canClick ? 'cursor-pointer group' : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      {r.label}
                    </span>
                    {canClick && <WatchPill count={rowPlays.length} />}
                  </div>
                  <div className={`text-xs font-bold ${EXPECT_CLASS[r.expect]}`}>{r.expectText}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.count === 1 ? '1 snap' : `${r.count} snaps`}</div>
                </div>
                <RowStats row={r} subset={rowPlays} onWatchCutup={onWatchCutup} />
                <div className="text-xs text-slate-700 dark:text-slate-200 min-w-0">
                  <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-0.5">They ran</div>
                  {r.ran.join(' · ')}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-0.5">Our call</div>
                  <CallEditor
                    id={key}
                    suggested={r.call}
                    chosen={name ? { name, callId: pick?.callId, text: pick?.text } : undefined}
                    options={defenseCalls}
                    onSave={onSetGamePlanCall ? (p) => onSetGamePlanCall(key, p) : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const FormationPlanCard: React.FC<
  {
    plays: Play[];
    opponentName: string;
    /** Their formations (with our calls vs each, set in Their plays). */
    formations?: OppFormation[];
    /** Save the formations (a call picked here goes into the formation's plan, so it prints on the call sheet). */
    onSaveFormations?: (next: OppFormation[]) => void;
  } & EditProps
> = ({ plays, opponentName, formations, onSaveFormations, defenseCalls = [], gamePlanCalls = {}, onSetGamePlanCall, onWatchCutup }) => {
  const forms = useMemo(() => formationPlan(plays), [plays]);
  const [showAll, setShowAll] = useState(false);
  const main = forms.filter((f) => f.count >= 2);
  const shown = showAll ? forms : main.length ? main : forms;
  const hidden = forms.length - shown.length;
  const live = (formations || []).filter((f) => f?.id && !f.deleted);
  const recordOf = (name: string) => live.find((f) => formationKey(f.name) === formationKey(name));
  const callName = (id?: string) => (id ? defenseCalls.find((o) => o.id === id)?.name : undefined);
  const gameOf = (name: string) => plays.find((p) => formationKey(p.formation) === formationKey(name) && p.gameId)?.gameId || plays.find((p) => p.gameId)?.gameId || '';

  // A Play Library call goes into the formation's plan (base or one situation); a typed call stays on the game plan.
  const save = (formation: string, part: FormationPart | 'base', pick: CallPick) => {
    const key = `form:${formation}:${part}`;
    const typed = pick?.text?.trim();
    const typedBefore = gamePlanCalls[key]?.text?.trim();
    if (typed || !onSaveFormations) {
      onSetGamePlanCall?.(key, pick);
      return;
    }
    if (typedBefore) onSetGamePlanCall?.(key, null);
    const now = Date.now();
    const old = recordOf(formation);
    const plan = { ...(old?.plan || {}), base: old?.plan?.base, calls: [...(old?.plan?.calls || [])] };
    if (part === 'base') plan.base = pick?.callId || undefined;
    else {
      plan.calls = plan.calls.filter((c) => c.situation !== PART_SITUATION[part]);
      if (pick?.callId) plan.calls.push({ id: `c${now.toString(36)}`, situation: PART_SITUATION[part], callId: pick.callId });
    }
    const rec: OppFormation = { ...(old || { id: `form-${now}`, name: formation, gameId: gameOf(formation), editedAt: now }), plan, editedAt: now };
    const list = formations || [];
    onSaveFormations(old ? list.map((x) => (x.id === rec.id ? rec : x)) : [...list, rec]);
  };
  const canEdit = Boolean(onSetGamePlanCall);

  return (
    <Card>
      <SectionHeader
        title="What they run from each formation"
        subtitle={`${opponentName}'s formations, most-used first: their plays on 1st down and on 2nd–4th by yards to go, and our call. Click any formation, play name, or down row to watch those snaps.`}
        right={<RunPassLegend />}
      />
      {forms.length === 0 ? (
        <EmptyNote>No formations on their snaps yet. Tag OFF FORM on their offense's clips.</EmptyNote>
      ) : (
        <div className="space-y-3">
          {shown.map((f) => {
            const rec = recordOf(f.formation);
            const baseKey = `form:${f.formation}:base`;
            const baseTyped = gamePlanCalls[baseKey]?.text?.trim();
            const baseName = baseTyped || callName(rec?.plan?.base);
            const base = baseName ? { name: baseName, callId: baseTyped ? undefined : rec?.plan?.base, text: baseTyped } : undefined;
            const formPlays = plays.filter((p) => matchFormationPart(p, f.formation));
            return (
              <div key={f.formation} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div
                    onClick={onWatchCutup && formPlays.length > 0 ? () => onWatchCutup(`Formation · ${f.formation}`, formPlays) : undefined}
                    className={`flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100 ${
                      onWatchCutup && formPlays.length > 0 ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400' : ''
                    }`}
                  >
                    <span>{f.formation}</span>
                    {f.twoTightEnds && <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">two tight ends</span>}
                    {onWatchCutup && formPlays.length > 0 && <WatchPill count={formPlays.length} label={`Watch ${f.formation}`} />}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {f.count} snaps · {f.run} run · {f.pass} pass · {f.avgGain} avg
                  </div>
                </div>
                {f.menu.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mt-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Plays:</span>
                    {f.menu.map((m) => {
                      const mPlays = formPlays.filter((p) => playCallName(p).toLowerCase() === m.name.toLowerCase());
                      const canClickM = Boolean(onWatchCutup && mPlays.length > 0);
                      return (
                        <button
                          key={m.name}
                          type="button"
                          onClick={canClickM ? () => onWatchCutup?.(`${f.formation} · ${m.name}`, mPlays) : undefined}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                            canClickM
                              ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 hover:border-amber-500/60 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {m.count > 1 ? `${m.name} ×${m.count}` : m.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2 grid grid-cols-1 md:grid-cols-[130px_minmax(0,1fr)] gap-1 md:gap-4 rounded-md bg-slate-50 dark:bg-slate-950/50 px-2 py-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Base vs {f.formation}</div>
                  <CallEditor
                    id={baseKey}
                    suggested={f.call}
                    chosen={base}
                    options={defenseCalls}
                    onSave={canEdit ? (p) => save(f.formation, 'base', p) : undefined}
                  />
                </div>
                <div className="mt-1 divide-y divide-slate-200 dark:divide-slate-800">
                  {f.rows.map((r) => {
                    const part = r.part as FormationPart;
                    const key = `form:${f.formation}:${part}`;
                    const typed = gamePlanCalls[key]?.text?.trim();
                    const planId = planCallFor(rec?.plan, part);
                    const own = typed || callName(planId);
                    const chosen = own
                      ? { name: own, callId: typed ? undefined : planId, text: typed }
                      : base
                        ? { ...base, from: 'Base' }
                        : undefined;
                    const partPlays = plays.filter((p) => matchFormationPart(p, f.formation, part));
                    const canClickPart = Boolean(onWatchCutup && partPlays.length > 0);
                    return (
                      <div key={r.key} className="py-2 grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] gap-1 md:gap-4">
                        <div
                          onClick={canClickPart ? () => onWatchCutup?.(`${f.formation} · ${r.label}`, partPlays) : undefined}
                          className={canClickPart ? 'cursor-pointer group' : undefined}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            <span>{r.label}</span>
                            {canClickPart && <WatchPill count={partPlays.length} />}
                          </div>
                          <div className={`text-xs font-bold ${EXPECT_CLASS[r.expect]}`}>
                            {r.count === 1 ? (r.run ? 'Run' : 'Pass') : r.expectText}
                            <span className="font-medium text-slate-500 dark:text-slate-400"> · {r.count === 1 ? '1 snap' : `${r.run} of ${r.count} run`}</span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-200 min-w-0">{r.ran.join(' · ')}</div>
                        <CallEditor
                          id={key}
                          suggested={r.call}
                          chosen={chosen}
                          options={defenseCalls}
                          onSave={canEdit ? (p) => save(f.formation, part, p) : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {forms.length !== main.length && main.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="min-h-[36px] text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700 cursor-pointer"
            >
              {showAll ? 'Show formations seen 2+ times' : `Show ${hidden} formation${hidden === 1 ? '' : 's'} seen once`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
};
