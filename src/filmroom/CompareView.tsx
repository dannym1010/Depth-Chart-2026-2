// Compare plays: two plays side by side (ours and another team's from the same formation). Each side picks a
// game, a formation and a play; both videos can play together from the snap; under them, the two plays'
// details row by row (the differences marked) and what each team gets from that formation.
// The video itself comes from `renderFilm`, so this screen holds no film or database code.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Columns2, Pause, Play as PlayIcon, SkipBack, X } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { PlayerApi } from './FilmPlayer';
import { probeSnap } from './snapProbe';
import { compareSplits, loadTiming, MOMENTS, saveTiming, secs, timingKey, type MomentId, type Moments } from './compareTiming';
import { compareNotes, formationList, formationNumbers, formationOf, isSnap, playFacts, playNameOf, type CompareGame, type FormationNumbers } from './compareData';

export type Side = 'a' | 'b';

export interface CompareFilmProps {
  side: Side;
  game: CompareGame;
  play?: Play;
  apiRef: React.MutableRefObject<PlayerApi | null>;
  /** Tallest the video may be (CSS length). */
  maxVideoHeight: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

interface Pick {
  gameKey: string;
  /** '' = every formation. */
  formation: string;
  playId?: string;
}

interface Props {
  games: CompareGame[];
  /** The play to start on the left (the one on screen in the Film Room). */
  start?: { gameKey: string; playId?: string };
  renderFilm: (p: CompareFilmProps) => React.ReactNode;
  onClose: () => void;
}

const KEY = 'footballFilmroomCompare';
const readSaved = (): { b?: Pick } => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
};

/** The plays a side lists: offense snaps of its game, in its formation. */
const listOf = (g: CompareGame | undefined, formation: string) => (g ? g.plays.filter((p) => isSnap(p) && (!formation || formationOf(p) === formation)) : []);

/** The other side's start: a game from the other team with the most snaps in that formation. */
function otherStart(games: CompareGame[], from: CompareGame | undefined, formation: string): Pick | undefined {
  const others = games.filter((g) => g.source !== from?.source);
  const pool = others.length ? others : games.filter((g) => g.key !== from?.key);
  const scored = pool.map((g) => ({ g, n: listOf(g, formation).length })).sort((x, y) => y.n - x.n);
  const best = scored[0];
  if (!best) return undefined;
  const has = best.n > 0;
  return { gameKey: best.g.key, formation: has ? formation : '', playId: listOf(best.g, has ? formation : '')[0]?.id };
}

export const CompareView: React.FC<Props> = ({ games, start, renderFilm, onClose }) => {
  const byKey = useMemo(() => new Map(games.map((g) => [g.key, g])), [games]);
  const [a, setA] = useState<Pick>(() => {
    const g = (start && byKey.get(start.gameKey)) || games[0];
    const p = g?.plays.find((x) => x.id === start?.playId) || listOf(g, '')[0];
    const f = p ? formationOf(p) : '';
    return { gameKey: g?.key || '', formation: f === '(no formation)' ? '' : f, playId: p?.id };
  });
  const [b, setB] = useState<Pick>(() => {
    const saved = readSaved().b;
    const ga = byKey.get(a.gameKey);
    const pa = ga?.plays.find((x) => x.id === a.playId);
    const f = pa ? formationOf(pa) : '';
    // The last game picked on the right, when it has this formation too; else the best match.
    if (saved && byKey.has(saved.gameKey) && saved.gameKey !== a.gameKey && listOf(byKey.get(saved.gameKey), f).length) {
      return { gameKey: saved.gameKey, formation: f, playId: listOf(byKey.get(saved.gameKey), f)[0]?.id };
    }
    return otherStart(games, ga, f) || { gameKey: '', formation: '' };
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ b }));
    } catch {
      /* a convenience only */
    }
  }, [b]);

  const apis = { a: useRef<PlayerApi | null>(null), b: useRef<PlayerApi | null>(null) };
  const picks = { a, b };
  const setPick = { a: setA, b: setB };

  // Timing: moments marked on each play (kept on this device).
  const [timing, setTiming] = useState<Record<string, Moments>>(loadTiming);
  const momentsOf = (gameKey: string, playId?: string): Moments => (playId ? timing[timingKey(gameKey, playId)] || {} : {});
  const mark = (gameKey: string, playId: string, id: MomentId, t: number | null) =>
    setTiming((all) => {
      const k = timingKey(gameKey, playId);
      const m = { ...(all[k] || {}) };
      if (t == null) delete m[id];
      else m[id] = Math.round(t * 1000) / 1000;
      const next = { ...all };
      if (Object.keys(m).length) next[k] = m;
      else delete next[k];
      saveTiming(next);
      return next;
    });

  // Escape closes (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest?.('input,select,textarea')) onClose();
    };
    window.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  const sideData = (s: Side) => {
    const pk = picks[s];
    const game = byKey.get(pk.gameKey);
    const list = listOf(game, pk.formation);
    const play = list.find((p) => p.id === pk.playId) || list[0];
    const at = play ? list.indexOf(play) : -1;
    // The team's numbers from the play's formation: our whole season, or every game of that week's scouting.
    const teamPlays = game ? games.filter((g) => (game.source === 'own' ? g.source === 'own' : g.source === 'opponent' && g.week === game.week)).flatMap((g) => g.plays) : [];
    const f = pk.formation || (play ? formationOf(play) : '');
    const numbers = f && f !== '(no formation)' ? formationNumbers(teamPlays.filter((p) => formationOf(p) === f)) : undefined;
    return { pk, game, list, play, at, numbers, formation: f, gamesInTeam: game ? new Set(teamPlays.map((p) => p.gameId)).size : 0, moments: momentsOf(pk.gameKey, play?.id) };
  };
  const A = sideData('a');
  const B = sideData('b');

  // Both videos together.
  const [busy, setBusy] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const each = (fn: (api: PlayerApi, v: HTMLVideoElement | null) => void) => (['a', 'b'] as Side[]).forEach((s) => apis[s].current && fn(apis[s].current!, apis[s].current!.video?.() || null));
  const playBoth = () => each((_, v) => void v?.play().catch(() => undefined));
  const pauseBoth = () => each((_, v) => v?.pause());
  const setSpeed = (x: number) => {
    setSpeedState(x);
    each((api, v) => {
      if (api.setSpeed) api.setSpeed(x);
      else if (v) v.playbackRate = x;
    });
  };
  /** Both back to just before the snap (the marked one, else the one found in the video), paused, so they start together. */
  const toSnap = async () => {
    setBusy(true);
    try {
      pauseBoth();
      await Promise.all(
        (['a', 'b'] as Side[]).map(async (s) => {
          const api = apis[s].current;
          const v = api?.video?.();
          const src = v?.currentSrc || v?.src;
          if (!api || !src || !v) return;
          const marked = (s === 'a' ? A : B).moments.snap;
          if (marked != null) return api.seek(Math.max(0, marked - 1));
          // Finding the snap can take a few seconds: a video the coach moved or played meanwhile is left where it is.
          const was = v.currentTime;
          const t = await probeSnap(src).catch(() => null);
          if (api.video?.() !== v || (v.currentSrc || v.src) !== src || !v.paused || Math.abs(v.currentTime - was) > 0.05) return;
          api.seek(t == null ? 0 : Math.max(0, t - 1));
        })
      );
    } finally {
      setBusy(false);
    }
  };
  const swap = () => {
    setA(b);
    setB(a);
  };

  const videoMax = 'min(46dvh, calc((100vw - 3rem) / 2 * 9 / 16))';
  const groups = useMemo(() => {
    const m = new Map<string, CompareGame[]>();
    games.forEach((g) => m.set(g.group, [...(m.get(g.group) || []), g]));
    return [...m.entries()];
  }, [games]);

  const field = 'h-9 pointer-coarse:h-10 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100 px-2';
  const barBtn = 'inline-flex items-center gap-1 h-9 pointer-coarse:h-10 px-3 rounded-lg text-xs font-bold';

  const pane = (s: Side, d: ReturnType<typeof sideData>) => {
    const set = setPick[s];
    const formations = d.game ? formationList(d.game.plays) : [];
    const go = (i: number) => d.list[i] && set((p) => ({ ...p, playId: d.list[i].id }));
    return (
      <section aria-label={s === 'a' ? 'Left play' : 'Right play'} className="min-w-0 flex flex-col gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-1.5">
          <select
            aria-label={`${s === 'a' ? 'Left' : 'Right'} game`}
            value={d.pk.gameKey}
            onChange={(e) => {
              const g = byKey.get(e.target.value);
              // Keep the formation when the new game has it.
              const keep = d.pk.formation && listOf(g, d.pk.formation).length ? d.pk.formation : '';
              set({ gameKey: e.target.value, formation: keep, playId: listOf(g, keep)[0]?.id });
            }}
            className={field}
          >
            {!d.game && <option value="">Pick a game</option>}
            {groups.map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.source === 'own' ? g.name : `${g.team}: ${g.name}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            aria-label={`${s === 'a' ? 'Left' : 'Right'} formation`}
            value={d.pk.formation}
            onChange={(e) => set((p) => ({ ...p, formation: e.target.value, playId: listOf(d.game, e.target.value)[0]?.id }))}
            className={field}
          >
            <option value="">Every formation</option>
            {d.pk.formation && !formations.some((f) => f.formation === d.pk.formation) && <option value={d.pk.formation}>{d.pk.formation} (0)</option>}
            {formations.map((f) => (
              <option key={f.formation} value={f.formation}>
                {f.formation} ({f.count})
              </option>
            ))}
          </select>
        </div>
        <select aria-label={`${s === 'a' ? 'Left' : 'Right'} play`} value={d.play?.id || ''} onChange={(e) => set((p) => ({ ...p, playId: e.target.value }))} className={field} disabled={!d.list.length}>
          {!d.list.length && <option value="">{d.game ? 'No offense plays in this formation' : 'Pick a game'}</option>}
          {d.list.map((p) => {
            const g = Number(p.gainLoss);
            return (
              <option key={p.id} value={p.id}>
                {[`#${p.playNumber}`, p.down ? `${p.down}&${p.distance ?? ''}` : '', d.pk.formation ? '' : p.formation, playNameOf(p), Number.isFinite(g) ? `${g > 0 ? '+' : ''}${g}` : ''].filter(Boolean).join(' · ')}
              </option>
            );
          })}
        </select>
        {d.game ? (
          renderFilm({
            side: s,
            game: d.game,
            play: d.play,
            apiRef: apis[s],
            maxVideoHeight: videoMax,
            hasPrev: d.at > 0,
            hasNext: d.at >= 0 && d.at < d.list.length - 1,
            onPrev: () => go(d.at - 1),
            onNext: () => go(d.at + 1),
          })
        ) : (
          <div className="aspect-video max-w-full rounded-xl bg-slate-900 text-slate-300 text-xs flex items-center justify-center px-4 text-center">Pick a game with a breakdown to compare.</div>
        )}
        {d.game && d.play && (
          <div role="group" aria-label={`${s === 'a' ? 'Left' : 'Right'} timing`} className="flex flex-wrap items-center gap-1.5">
            {MOMENTS.map((m) => {
              const t = d.moments[m.id];
              const fromSnap = t != null && d.moments.snap != null && m.id !== 'snap' ? t - d.moments.snap : undefined;
              const gameKey = d.game!.key;
              const playId = d.play!.id;
              return (
                <span key={m.id} className={`inline-flex items-stretch rounded-lg border overflow-hidden text-xs font-bold ${t != null ? 'border-indigo-500' : 'border-slate-300 dark:border-slate-600'}`}>
                  <button
                    type="button"
                    aria-label={`Mark ${m.label}`}
                    title={t != null ? `Mark ${m.label} again at the moment on screen` : `Pause on the ${m.label.toLowerCase()} (step a frame with ◀ ▶), then tap`}
                    onClick={() => {
                      const v = apis[s].current?.video?.();
                      const now = v ? v.currentTime : apis[s].current?.time();
                      if (now != null) mark(gameKey, playId, m.id, now);
                    }}
                    className={`h-9 pointer-coarse:h-10 px-2.5 ${t != null ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950'}`}
                  >
                    {m.label}
                    {t != null && <span className="ml-1 font-black tabular-nums">{fromSnap != null ? `+${fromSnap.toFixed(2)}` : m.id === 'snap' ? '✓' : t.toFixed(2)}</span>}
                  </button>
                  {t != null && (
                    <>
                      <button type="button" aria-label={`Go to the ${m.label}`} title={`Go to the ${m.label.toLowerCase()}`} onClick={() => apis[s].current?.seek(t)} className="h-9 pointer-coarse:h-10 px-1.5 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200">
                        ↦
                      </button>
                      <button type="button" aria-label={`Clear the ${m.label}`} title="Clear" onClick={() => mark(gameKey, playId, m.id, null)} className="h-9 pointer-coarse:h-10 px-1.5 bg-white dark:bg-slate-950 text-slate-500">
                        ×
                      </button>
                    </>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const factsA = A.play ? playFacts(A.play) : [];
  const factsB = B.play ? playFacts(B.play) : [];
  const rows = (factsA.length ? factsA : factsB).map((r, i) => ({ label: r.label, a: factsA[i]?.value || '', b: factsB[i]?.value || '' })).filter((r) => r.a || r.b);
  const nameA = A.game?.source === 'own' ? 'Us' : A.game?.team || 'Left';
  const nameB = B.game?.source === 'own' ? 'Us' : B.game?.team || 'Right';
  const ours = A.game?.source === 'own' ? A : B.game?.source === 'own' ? B : undefined;
  const theirs = ours === A ? B : ours === B ? A : undefined;
  const notes = ours?.numbers && theirs?.numbers && theirs.game ? compareNotes(ours.numbers, theirs.numbers, theirs.game.team) : [];
  const sameF = A.formation && A.formation === B.formation;
  const splits = compareSplits(A.moments, B.moments);

  const numberRows: { label: string; get: (n: FormationNumbers) => string; better?: (x: FormationNumbers, y: FormationNumbers) => number }[] = [
    { label: 'Snaps', get: (n) => String(n.snaps) },
    { label: 'Yards a snap', get: (n) => `${n.avg > 0 ? '+' : ''}${n.avg}`, better: (x, y) => x.avg - y.avg },
    { label: 'On schedule', get: (n) => `${n.success}%`, better: (x, y) => x.success - y.success },
    { label: '10+ yard plays', get: (n) => `${n.explosive}%`, better: (x, y) => x.explosive - y.explosive },
    { label: 'Lost yards', get: (n) => `${n.lost}%`, better: (x, y) => y.lost - x.lost },
    { label: 'Run', get: (n) => `${n.runPct}%` },
  ];
  const teamLabel = (d: typeof A) =>
    d.game ? (d.game.source === 'own' ? 'Our season' : `${d.game.team}${d.gamesInTeam > 1 ? ` (${d.gamesInTeam} games of film)` : ''}`) : '';

  return (
    <div role="dialog" aria-label="Compare plays" className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100" data-film-area>
      <header
        className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))', paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))' }}
      >
        <Columns2 size={16} className="text-indigo-500 shrink-0" />
        <h2 className="text-sm font-black mr-2">Compare plays</h2>
        <div role="group" aria-label="Both videos" className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => void toSnap()} disabled={busy} className={`${barBtn} bg-slate-100 dark:bg-slate-800 disabled:opacity-50`} title="Both videos to just before the snap, so they start together">
            <SkipBack size={14} /> {busy ? 'Finding the snap…' : 'To the snap'}
          </button>
          <button type="button" onClick={playBoth} className={`${barBtn} bg-indigo-600 text-white`}>
            <PlayIcon size={14} /> Play both
          </button>
          <button type="button" onClick={pauseBoth} className={`${barBtn} bg-slate-100 dark:bg-slate-800`}>
            <Pause size={14} /> Pause both
          </button>
          <div role="group" aria-label="Speed of both" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {[0.25, 0.5, 1].map((x) => (
              <button key={x} type="button" aria-pressed={speed === x} onClick={() => setSpeed(x)} className={`h-9 pointer-coarse:h-10 px-2.5 text-xs font-bold ${speed === x ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950'}`}>
                {x === 0.25 ? '¼×' : x === 0.5 ? '½×' : '1×'}
              </button>
            ))}
          </div>
          <button type="button" onClick={swap} className={`${barBtn} bg-slate-100 dark:bg-slate-800`} title="Swap the left and right plays">
            <ArrowLeftRight size={14} /> Swap
          </button>
        </div>
        <button type="button" onClick={onClose} aria-label="Close compare" className="ml-auto w-9 h-9 pointer-coarse:w-10 pointer-coarse:h-10 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
          {pane('a', A)}
          {pane('b', B)}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="px-3 pt-2.5 text-sm font-black">Timing</div>
          {splits.length ? (
            <table className="w-full text-xs mt-1" aria-label="Timing of the two plays">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 px-3 w-36"></th>
                  <th className="py-2 px-3">{nameA}{A.play ? ` · #${A.play.playNumber}` : ''}</th>
                  <th className="py-2 px-3">{nameB}{B.play ? ` · #${B.play.playNumber}` : ''}</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((sp) => (
                  <tr key={sp.id} className="border-b last:border-0 border-slate-100 dark:border-slate-800">
                    <th scope="row" className="py-1.5 px-3 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{sp.label}</th>
                    {(['a', 'b'] as Side[]).map((k) => (
                      <td key={k} className="py-1.5 px-3 font-black tabular-nums">
                        <span className={sp.faster === k ? 'text-emerald-700 dark:text-emerald-400' : ''} data-faster={sp.faster === k || undefined}>
                          {secs(sp[k])}
                          {sp.faster === k && sp.diff != null ? ` ▲ ${sp.diff.toFixed(2)} s quicker` : ''}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-3 pt-1 text-xs text-slate-600 dark:text-slate-300">
              Under each video: pause on the snap (step a frame at a time with ◀ ▶) and tap <b>Snap</b>, then do the same for the <b>Handoff</b>, the back reaching the <b>Hole</b>,
              first <b>Contact</b> and the <b>Whistle</b>. The times from snap to handoff, handoff to hole and so on show here for both plays, the quicker one in green.
            </p>
          )}
          <p className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">Marks are saved on this device for each play. Once both snaps are marked, To the snap starts both videos on their marked snap.</p>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-xs" aria-label="The two plays">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 px-3 w-32">This play</th>
                  <th className="py-2 px-3">{nameA}{A.play ? ` · #${A.play.playNumber}` : ''}</th>
                  <th className="py-2 px-3">{nameB}{B.play ? ` · #${B.play.playNumber}` : ''}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const differs = r.a.toUpperCase() !== r.b.toUpperCase();
                  return (
                    <tr key={r.label} data-differs={differs || undefined} className="border-b last:border-0 border-slate-100 dark:border-slate-800">
                      <th scope="row" className="py-1.5 px-3 text-left font-semibold text-slate-500 dark:text-slate-400">
                        <span className={differs ? 'inline-block px-1.5 -mx-1.5 rounded bg-amber-200 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100' : ''}>{r.label}</span>
                        {differs && <span className="sr-only"> (different)</span>}
                      </th>
                      {[r.a, r.b].map((v, i) => (
                        <td key={i} className="py-1.5 px-3 font-bold break-words">
                          <span className={differs ? 'text-amber-800 dark:text-amber-300' : ''}>{v || '—'}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">Labels in yellow: the two plays are different there.</p>
          </div>
        )}

        {(A.numbers || B.numbers) && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="px-3 pt-2.5 text-sm font-black">
              {sameF ? `From ${A.formation}` : 'From each play’s formation'}
              {!sameF && A.formation && B.formation && <span className="ml-2 text-xs font-bold text-amber-700 dark:text-amber-300">({A.formation} vs {B.formation}: not the same formation)</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs mt-1" aria-label="What each team gets from the formation">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2 px-3 w-32"></th>
                    <th className="py-2 px-3">{teamLabel(A)}</th>
                    <th className="py-2 px-3">{teamLabel(B)}</th>
                  </tr>
                </thead>
                <tbody>
                  {numberRows.map((r) => {
                    const cmp = A.numbers && B.numbers && r.better && A.numbers.snaps >= 3 && B.numbers.snaps >= 3 ? r.better(A.numbers, B.numbers) : 0;
                    const good = 'text-emerald-700 dark:text-emerald-400';
                    return (
                      <tr key={r.label} className="border-b last:border-0 border-slate-100 dark:border-slate-800">
                        <th scope="row" className="py-1.5 px-3 text-left font-semibold text-slate-500 dark:text-slate-400">{r.label}</th>
                        {[
                          [A.numbers, cmp > 0],
                          [B.numbers, cmp < 0],
                        ].map(([nums, better], i) => (
                          <td key={i} className="py-1.5 px-3 font-black tabular-nums">
                            <span className={better ? good : ''} data-better={better || undefined}>
                              {nums ? r.get(nums as FormationNumbers) : '—'}
                              {better ? ' ▲' : ''}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr>
                    <th scope="row" className="py-1.5 px-3 text-left align-top font-semibold text-slate-500 dark:text-slate-400">Plays from it</th>
                    {[A, B].map((d, i) => (
                      <td key={i} className="py-1.5 px-3 align-top">
                        {d.numbers?.plays.length ? (
                          <ul className="space-y-0.5">
                            {d.numbers.plays.slice(0, 6).map((p) => (
                              <li key={p.name} className="flex gap-2 min-w-0">
                                <span className="truncate font-bold" title={p.name}>{p.name}</span>
                                <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                                  ×{p.snaps} · {p.avg > 0 ? '+' : ''}{p.avg}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '—'
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {notes.length > 0 && (
              <ul className="mx-3 mb-3 mt-1 space-y-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-xs text-indigo-950 dark:text-indigo-100" aria-label="What stands out">
                {notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            )}
            {ours && theirs && (!ours.numbers || !theirs.numbers || ours.numbers.snaps < 3 || theirs.numbers.snaps < 3) && (
              <p className="mx-3 mb-3 text-[11px] text-slate-500 dark:text-slate-400">Fewer than 3 snaps on a side: watch the film, the numbers are too few to say much.</p>
            )}
            <p className="px-3 pb-2.5 text-[11px] text-slate-500 dark:text-slate-400">Green ▲ is the better number. On schedule: the snap gained enough for its down (Hudl Scout&apos;s efficiency).</p>
          </div>
        )}
      </div>
    </div>
  );
};
