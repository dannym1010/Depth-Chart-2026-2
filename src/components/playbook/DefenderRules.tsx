// One defender's rules, opened from the Jobs list (or by tapping him on the field): the terms that fit his
// position, a row each, plus 1-click coaching packages. A technique or alignment moves him; a drop, blitz or
// slant draws his line; read key, flow tempo, run fit and run action drive how he moves when the play runs.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, RotateCcw, Sparkles } from 'lucide-react';
import {
  CATEGORY_TIPS,
  RULE_LIBRARY,
  RULE_PRESETS,
  defenseGroup,
  drawnPick,
  resolveRuleJob,
  ruleTip,
  techniqueOf,
  type RulePreset,
} from '../../utils/defenseRules';
import { ZoneMap } from './DefenseCallPicker';

interface Tip {
  title: string;
  text: string;
  x: number;
  y: number;
  below: boolean;
}

/**
 * A note that pops up while the mouse is over a pick and goes away when it leaves. On a touch screen a tap
 * shows it for a few seconds (the tap still picks).
 */
function useHoverTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [tip]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = (el: HTMLElement, title: string, text: string) => {
    const r = el.getBoundingClientRect();
    const below = r.top < 110;
    setTip({ title, text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
  };
  /** Spread onto anything that should explain itself. */
  const tipProps = (title: string, text: string) =>
    text
      ? {
          'aria-description': text,
          onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
            if (e.pointerType !== 'touch') show(e.currentTarget, title, text);
          },
          onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
            if (e.pointerType !== 'touch') setTip(null);
          },
          onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            if (e.pointerType !== 'touch') return;
            show(e.currentTarget, title, text);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setTip(null), 3000);
          },
          onFocus: (e: React.FocusEvent<HTMLElement>) => {
            if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget, title, text);
          },
          onBlur: () => setTip(null),
        }
      : {};

  const W = 260;
  const node =
    tip &&
    createPortal(
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          left: Math.min(Math.max(tip.x, W / 2 + 8), window.innerWidth - W / 2 - 8),
          top: tip.y,
          width: 'max-content',
          maxWidth: W,
          transform: `translate(-50%, ${tip.below ? '0' : '-100%'})`,
          zIndex: 2147483000,
          pointerEvents: 'none',
        }}
        className="rounded-lg bg-slate-950 text-white ring-1 ring-white/15 shadow-xl px-2.5 py-1.5 text-xs leading-snug"
      >
        <div className="font-bold">{tip.title}</div>
        <div className="text-slate-200">{tip.text}</div>
      </div>,
      document.body
    );
  return { tipProps, tipNode: node };
}

interface Props {
  node: { role: string; x: number };
  picks: Record<string, string>;
  /** The line drawn for him (a PLAYER_JOBS id), or none. */
  assign: string;
  ball: number;
  typed: string;
  /** His job when nothing is picked (from the front and coverage). */
  standard: string;
  onPick: (category: string, option: string) => void;
  onAssign: (job: string) => void;
  onTyped: (text: string) => void;
  onReset: () => void;
  /** Optional callback to apply a multi-rule preset at once. */
  onPreset?: (picks: Record<string, string>, job?: string) => void;
  /** Optional callback to immediately run the play animation to preview this defender's adjustment. */
  onRunPlay?: () => void;
  /** Categories not shown (after their shift: his technique and alignment, since he's dragged to his spot). */
  hide?: string[];
  /** The reset link's words (default: back to the front's job). */
  resetLabel?: string;
}

const chip = (on: boolean, hint = false) =>
  `h-7 px-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
    on
      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
      : hint
        ? 'bg-white text-slate-700 border border-dashed border-slate-400 dark:bg-slate-900 dark:text-slate-200'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
  }`;

export const DefenderRules: React.FC<Props> = ({
  node,
  picks,
  assign,
  ball,
  typed,
  standard,
  onPick,
  onAssign,
  onTyped,
  onReset,
  onPreset,
  onRunPlay,
  hide = [],
  resetLabel,
}) => {
  const group = defenseGroup(node.role);
  const presets = RULE_PRESETS[group] || [];
  const [zones, setZones] = useState(false);
  const { tipProps, tipNode } = useHoverTip();
  const anything = Object.keys(picks).length > 0 || Boolean(assign) || Boolean(typed);

  const isPresetActive = (p: RulePreset) =>
    Object.entries(p.picks).every(([k, v]) => picks[k] === v) &&
    (!p.job || resolveRuleJob(p.job, node, ball) === assign);

  const applyPreset = (p: RulePreset) => {
    if (onPreset) {
      onPreset(p.picks, p.job ? resolveRuleJob(p.job, node, ball) : undefined);
      return;
    }
    for (const [cat, opt] of Object.entries(p.picks)) {
      onPick(cat, opt);
    }
    if (p.job) {
      onAssign(resolveRuleJob(p.job, node, ball));
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 p-2.5 space-y-2.5">
      {presets.length > 0 && (
        <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Sparkles className="w-3 h-3" /> Quick Coaching Package
            </span>
            {onRunPlay && (
              <button
                type="button"
                onClick={onRunPlay}
                title="Run the play animation to watch this defender's read & attack"
                className="h-6 px-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Play className="w-3 h-3 fill-current" /> Test in Motion
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => {
              const active = isPresetActive(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  {...tipProps(p.label, p.summary)}
                  onClick={() => applyPreset(p)}
                  className={`h-7 px-2.5 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap border ${
                    active
                      ? 'bg-emerald-700 border-emerald-700 text-white shadow-2xs'
                      : 'bg-emerald-50/90 border-emerald-300/80 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {RULE_LIBRARY[group].filter((cat) => !hide.includes(cat.id)).map((cat) => {
        const current = cat.draws ? drawnPick(cat, assign, node, ball) : picks[cat.id] || '';
        // His technique by name shows as a hint until one is picked.
        const hint = cat.id === 'tech' && !current ? techniqueOf(node.role) : '';
        return (
          <div key={cat.id}>
            <div className="mb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-help"
                {...tipProps(cat.label, CATEGORY_TIPS[cat.id] || '')}
              >
                {cat.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.options.map((o) => {
                const on = current === o.id;
                const meaning = ruleTip(group, cat.id, o.id);
                const tipTitle = cat.id === 'blitz' ? `Blitz the ${o.label}` : o.label;
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    className={chip(on, hint === o.id)}
                    {...tipProps(tipTitle, hint === o.id ? `${meaning} (Where this front lines him up.)`.trim() : meaning)}
                    onClick={() => {
                      if (cat.draws) onAssign(on || !o.job ? '' : resolveRuleJob(o.job, node, ball));
                      else onPick(cat.id, on ? '' : o.id);
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
              {/* Backers and DBs: any zone on the field. */}
              {(cat.id === 'pass' || cat.id === 'cover') && (
                <button
                  type="button"
                  aria-pressed={zones}
                  className={chip(zones)}
                  {...tipProps('Other zone', 'Pick any zone on the field map for his drop.')}
                  onClick={() => setZones((z) => !z)}
                >
                  Other zone…
                </button>
              )}
            </div>
            {zones && (cat.id === 'pass' || cat.id === 'cover') && (
              <div className="mt-1.5">
                <ZoneMap value={assign} onPick={(z) => onAssign(z === assign ? '' : z)} />
              </div>
            )}
          </div>
        );
      })}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">In your words</div>
        <input
          value={typed}
          placeholder={standard ? `Instead of the picks, e.g. "${standard}"` : 'Say his job your way'}
          aria-label={`${node.role} job in your words`}
          onChange={(e) => onTyped(e.target.value.slice(0, 80))}
          className="w-full h-8 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
        />
      </div>
      {anything && (
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
            <RotateCcw className="w-3 h-3" /> {resetLabel || <>Back to the front&apos;s job</>}
          </button>
          {onRunPlay && (
            <button
              type="button"
              onClick={onRunPlay}
              className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" /> Run play now
            </button>
          )}
        </div>
      )}
      {tipNode}
    </div>
  );
};
