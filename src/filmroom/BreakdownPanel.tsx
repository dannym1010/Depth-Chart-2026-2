import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Eraser, Sparkles } from 'lucide-react';
import type { Play, TeamUnit } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import { playIsUnitTaggable } from '../hudlScout/utils/unitStats';
import { isBalancedPlay, playStrength } from '../hudlScout/utils/strength';
import { breakdownRowOf, type BreakdownColumn, type BreakdownRow } from './breakdownEntry';
import { AiClipAnalyzerModal } from './AiClipAnalyzerModal';
import { BACKS, HOLES, PASS_CONCEPTS, PERSONNEL, QB_SPOTS, RUN_CONCEPTS, TAGS, customOptions, parseCall, partsMatch, savedNames, startingParts, withParts } from './callName';
import type { CallParts } from '../hudlScout/types/football';

interface Props {
  play?: Play;
  /** Every play of this team's games, for the formation / play / result suggestions. */
  suggestFrom: Play[];
  onSave: (play: Play, row: BreakdownRow) => void;
  next?: Play;
  /** The next snap of this game (by play number), whatever order the list is in: where this play ended. */
  nextSnap?: Play;
  /** Save this play (as entered, with the AI window's extras and note) and move on, in one change. */
  onNext: (row: BreakdownRow, patch?: Partial<Play>, notes?: string) => void;
  /** The play this one's down and distance were filled in from by the rules (while nothing else is entered on it). */
  filledFrom?: number;
  /** View-only (a player account): show what's entered, no editing. */
  readOnly?: boolean;
  /** Our film: which unit was on the field (Black / Blue / Gold). */
  onSetUnit?: (play: Play, unit: TeamUnit | undefined) => void;
  /** Fields that aren't Hudl breakdown columns: strength, personnel, backfield, motion, players, flags. */
  onPatch?: (play: Play, patch: Partial<Play>) => void;
  /** Saves both Hudl breakdown row and extended Play patch atomically in one state change */
  onSaveBreakdownWithPatch?: (play: Play, row: BreakdownRow, patch: Partial<Play>, notes?: string) => void;
  /** Video element for frame capture */
  videoElement?: HTMLVideoElement | null;
  /** The player's video as it is now (for the AI window to pause it and read the clip). */
  getVideo?: () => HTMLVideoElement | null;
  /** Active team roster */
  roster?: RosterPlayer[];
  /** Opponent team name */
  opponentName?: string;
  /** Our team name (e.g. Mahopac 10U) */
  teamName?: string;
  /** True if this is our game, false if opponent scout film */
  isOwnGame?: boolean;
  /** Active game id or key for persisting game setup */
  gameId?: string;
  /** Add a text note to the play */
  onAddNote?: (playId: string, text: string) => void;
  /** Only master / program admin sees AI Auto-Breakdown assistant */
  isProgramAdmin?: boolean;
}

const ODK = [
  { v: 'O', label: 'O', title: 'Offense' },
  { v: 'D', label: 'D', title: 'Defense' },
  { v: 'K', label: 'K', title: 'Kicking' },
  { v: 'S', label: 'S', title: 'Not a play (camera test, scoreboard): kept with the film, never counted' },
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

export const BreakdownPanel: React.FC<Props> = ({
  play,
  suggestFrom,
  onSave,
  next,
  nextSnap,
  onNext,
  filledFrom,
  readOnly,
  onSetUnit,
  onPatch,
  onSaveBreakdownWithPatch,
  videoElement,
  getVideo,
  roster = [],
  opponentName = 'Opponent',
  teamName = 'Mahopac 10U',
  isOwnGame = true,
  gameId = '',
  onAddNote,
  isProgramAdmin = false,
}) => {
  const saved = useMemo(() => (play ? breakdownRowOf(play) : {}), [play]);
  // Typed boxes: kept here until they're saved.
  const [draft, setDraft] = useState<BreakdownRow>(saved);
  useEffect(() => setDraft(saved), [saved]);
  const [showAiModal, setShowAiModal] = useState(false);

  const lists = useMemo(() => {
    const names = savedNames(suggestFrom);
    return {
      form: uniq(suggestFrom.map((p) => p.formation)),
      play: uniq(suggestFrom.map((p) => p.untaggedName || p.playName)),
      result: uniq([...RESULTS, ...suggestFrom.map((p) => p.result)]),
      // The play names coaches have made, once for both the Play name boxes and the AI window.
      names,
      nameText: names.map((n) => n.name),
      // The names tagged on this film (the game being watched).
      // (not the play being named: picking a part names it, and it would match itself)
      filmNames: savedNames(suggestFrom.filter((p) => p.id !== play?.id && (!play?.gameId || p.gameId === play.gameId))),
    };
  }, [suggestFrom, play?.gameId, play?.id]);

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
          // Shift+Enter: this play as typed, and on to the next one (the Next play button).
          if (e.shiftKey && next) goNext();
          else commitTyped();
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

  const handleAiApply = (newRow: BreakdownRow, patch: Partial<Play>, notes?: string) => {
    setDraft(newRow);
    if (onSaveBreakdownWithPatch) {
      onSaveBreakdownWithPatch(play, newRow, patch, notes);
    } else {
      save(newRow);
      if (onPatch) onPatch(play, patch);
      if (notes && onAddNote) onAddNote(play.id, notes);
    }
  };

  // One save for both: a save and then a Next would make the second from the plays as they were and lose the first.
  const handleAiApplyAndNext = (newRow: BreakdownRow, patch: Partial<Play>, notes?: string) => {
    setDraft(newRow);
    onNext(newRow, patch, notes);
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* AI Breakdown Quick Action Header - Master Admin only */}
      {!readOnly && isProgramAdmin && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 border border-indigo-200/80 dark:border-indigo-800/50">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-indigo-600 text-white shadow-xs">
              <Sparkles size={12} className="animate-pulse" />
            </span>
            <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">AI Film Assistant</span>
          </div>
          <button
            type="button"
            onClick={() => {
              // The film stays on this play while the AI reads it (a clip playing to its end went on to the next one).
              (getVideo?.() || videoElement)?.pause();
              setShowAiModal(true);
            }}
            className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Sparkles size={12} /> Auto-Breakdown
          </button>
        </div>
      )}

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
      {row.ODK === 'S' && (
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          S: not a play (a camera test, the scoreboard). It stays with the film but isn&apos;t counted in stats, reports or drives.
        </p>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-x-3">
        {field('Down', chips('DN', plain(DN)))}
        {field('Distance', box('DIST', { placeholder: '10', inputMode: 'numeric', className: 'w-16' }))}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-3">
        {field('Yard line', box('YARD LN', { placeholder: '-25 ours · +30 theirs' }))}
        {field('Hash', chips('HASH', plain(LMR)))}
      </div>
      {filledFrom !== undefined && (
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {row['YARD LN'] ? 'Down, distance and yard line' : 'Down and distance'} from play #{filledFrom}, by the rules. A flag or turnover on #{filledFrom} changes them: fix them here.
        </p>
      )}
      {onPatch && (
        <PlayNameFields
          play={play}
          readOnly={readOnly}
          run={!/^(pass|screen)$/i.test(String(row['PLAY TYPE'] || ''))}
          onChange={(parts) => onPatch(play, withParts({ ...play, playType: (row['PLAY TYPE'] as Play['playType']) || play.playType }, parts))}
          onUseName={(name) => save({ 'OFF PLAY': name })}
          playBox={String(row['OFF PLAY'] || '')}
          saved={lists.names}
          filmNames={lists.filmNames}
          custom={customOptions(suggestFrom)}
        />
      )}
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
      {onPatch && (
        <MoreFields play={play} onPatch={onPatch} readOnly={readOnly} chipClass={chipClass} />
      )}
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
            title="Save this play and go to the next one (Shift+Enter in any box)"
            className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold bg-indigo-600 text-white disabled:opacity-40"
          >
            Next play <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* AI Breakdown Modal - Master Admin only */}
      {isProgramAdmin && (
        <AiClipAnalyzerModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          play={play}
          nextPlay={nextSnap}
          videoElement={videoElement}
          getVideo={getVideo}
          roster={roster}
          knownFormations={lists.form}
          knownPlays={lists.play}
          knownNames={lists.nameText}
          teamName={teamName}
          opponentName={opponentName}
          isOwnGame={isOwnGame}
          gameId={gameId}
          onApply={handleAiApply}
          onApplyAndNext={next ? handleAiApplyAndNext : undefined}
          hasNextPlay={Boolean(next)}
        />
      )}
    </div>
  );
};

/**
 * The play's name, built from its parts: personnel, QB under center or in the gun, strength, tags, who gets the
 * ball to which hole (runs) and the concept. Saved with the play; what Hudl brought in stays as it was.
 */
const PlayNameFields: React.FC<{
  play: Play;
  readOnly?: boolean;
  /** A run (back and hole shown) or a pass. */
  run: boolean;
  onChange: (parts: CallParts) => void;
  /** Put the name in the Play box. */
  onUseName: (name: string) => void;
  playBox: string;
  /** Names already made in this team's games (most used first), to pick in one click. */
  saved: { name: string; parts: CallParts; count: number }[];
  /** Every name tagged on this film (most used first). */
  filmNames: { name: string; parts: CallParts; count: number }[];
  /** Options a coach added before (on any play): offered on every play. */
  custom: ReturnType<typeof customOptions>;
}> = ({ play, readOnly, run, onChange, onUseName, playBox, saved, filmNames, custom }) => {
  const parts = startingParts(play);
  const set = (patch: Partial<CallParts>) => onChange({ ...parts, ...patch });
  const pick = <K extends keyof CallParts>(key: K, v: CallParts[K]) => set({ [key]: parts[key] === v ? undefined : v } as Partial<CallParts>);
  const tags = parts.tags || [];
  const hasTag = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const toggleTag = (t: string) => set({ tags: hasTag(t) ? tags.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...tags, t] });
  const name = play.callName || '';
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
        {name && !readOnly && name !== playBox && (
          <button type="button" onClick={() => onUseName(name)} className="shrink-0 h-6 px-2 rounded-md text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10" title="Put this name in the Play box too">
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

/** The columns typed into a box (saved on leaving it), as opposed to buttons (saved on click). */
const BREAKDOWN_TYPED: BreakdownColumn[] = ['DIST', 'YARD LN', 'OFF FORM', 'OFF PLAY', 'RESULT', 'GN/LS'];

const chipClass = (on: boolean) =>
  `min-w-[2rem] h-7 px-2 rounded-md text-xs font-bold ${
    on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
  } disabled:cursor-default`;

/** The rest of a play's breakdown: strength (as set, or read from the formation), personnel, backfield,
 * motion, who had the ball, and the explosive / efficient flags. Typed boxes save on Enter or leaving them. */
const MoreFields: React.FC<{ play: Play; onPatch: (play: Play, patch: Partial<Play>) => void; readOnly?: boolean; chipClass: (on: boolean) => string }> = ({ play, onPatch, readOnly, chipClass }) => {
  const auto = (() => {
    const { strength: _s, ...rest } = play;
    if (isBalancedPlay(rest)) return 'Balanced';
    const side = playStrength(rest);
    return side === 'L' ? 'Left' : side === 'R' ? 'Right' : 'none';
  })();
  const strengthChips: { v: Play['strength'] | 'auto'; label: string }[] = [
    { v: 'auto', label: `Auto (${auto})` },
    { v: 'L', label: 'Left' },
    { v: 'R', label: 'Right' },
    { v: 'balanced', label: 'Balanced' },
  ];
  const text = (key: 'personnel' | 'backfield' | 'motion' | 'rusher' | 'passer' | 'receiver', label: string, placeholder: string) => {
    const shown = play[key] && play[key] !== '-' ? String(play[key]) : '';
    return (
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <input
          key={`${play.id}-${key}-${shown}`}
          defaultValue={shown}
          readOnly={readOnly}
          placeholder={placeholder}
          aria-label={label}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== shown) onPatch(play, { [key]: v });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-8 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        />
      </label>
    );
  };
  // Motion as Hudl's MOTION DIR has it: L / R (anything else, like "Jet", shows as its own choice).
  const motion = play.motion && play.motion !== '-' ? play.motion.trim() : '';
  const otherMotion = motion && !/^(L|R)$/i.test(motion) ? motion : '';
  const motionChips = [
    { v: '', label: 'None' },
    { v: 'L', label: 'Left' },
    { v: 'R', label: 'Right' },
    ...(otherMotion ? [{ v: otherMotion, label: otherMotion }] : []),
  ];
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Motion</span>
        <div className="flex flex-wrap gap-1">
          {motionChips.map((c) => {
            const on = motion.toUpperCase() === c.v.toUpperCase();
            return (
              <button key={c.label} type="button" disabled={readOnly} aria-pressed={on} onClick={() => onPatch(play, { motion: c.v || '-' })} className={chipClass(on)}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Strength</span>
        <div className="flex flex-wrap gap-1">
          {strengthChips.map((c) => {
            const on = (play.strength || 'auto') === c.v;
            return (
              <button
                key={c.v}
                type="button"
                disabled={readOnly}
                aria-pressed={on}
                title={c.v === 'auto' ? 'Read from the formation (21 L, Trips Rt...) or the play call' : undefined}
                onClick={() => onPatch(play, { strength: c.v === 'auto' ? undefined : (c.v as Play['strength']) })}
                className={chipClass(on)}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      <details className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5">
        <summary className="cursor-pointer text-[11px] font-black text-slate-600 dark:text-slate-300">More: personnel, backfield, players, flags</summary>
        <div className="mt-2 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {text('personnel', 'Personnel', '21')}
            {text('backfield', 'Backfield', 'I')}
            {text('motion', 'Motion (other)', 'Jet, Orbit')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {text('rusher', 'Ball carrier', '#21')}
            {text('passer', 'Passer', '#10')}
            {text('receiver', 'Receiver', '#4')}
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" disabled={readOnly} aria-pressed={play.isExplosive} onClick={() => onPatch(play, { isExplosive: !play.isExplosive })} className={chipClass(play.isExplosive)}>
              Explosive
            </button>
            <button type="button" disabled={readOnly} aria-pressed={play.isEfficient} onClick={() => onPatch(play, { isEfficient: !play.isEfficient })} className={chipClass(play.isEfficient)}>
              Efficient
            </button>
          </div>
        </div>
      </details>
    </>
  );
};
