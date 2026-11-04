// Compare plays: two plays side by side (ours and another team's from the same formation). Each side picks a
// game, a formation and a play; both videos can play together from the snap; under them, the two plays'
// details row by row (the differences marked) and what each team gets from that formation.
// The video itself comes from `renderFilm`, so this screen holds no film or database code.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Columns2, Copy, Download, Pause, Play as PlayIcon, SkipBack, Sparkles, X } from 'lucide-react';
import { saveGeminiKey } from '../services/geminiFilmService';
import { askCompareAi, buildPrompt, captureAt, clipFileName, compareAiEngine, evenTimes, pictureWindow, type AiSide } from './compareAi';
import type { Play } from '../hudlScout/types/football';
import type { PlayerApi } from './FilmPlayer';
import { probeSnap } from './snapProbe';
import { compareSplits, loadTiming, MOMENTS, saveTiming, secs, timingKey, type MomentId, type Moments } from './compareTiming';
import { asOffense, compareNotes, formationList, formationNumbers, formationOf, isDSnap, isPickable, isSnap, playFacts, playNameOf, teamKey, type CompareGame, type FormationNumbers } from './compareData';

export type Side = 'a' | 'b';

export interface CompareFilmProps {
  side: Side;
  game: CompareGame;
  play?: Play;
  /** The team with the ball on the play ("Us" for ours). */
  who: string;
  apiRef: React.MutableRefObject<PlayerApi | null>;
  /** Tallest the video may be (CSS length). */
  maxVideoHeight: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

interface Pick {
  /** The team whose plays are listed (`teamKeyOf`). */
  team: string;
  /** Plays from every game of the team's film, not only `gameKey`'s. */
  allGames: boolean;
  /** The game picked, or the picked play's game. */
  gameKey: string;
  /** '' = every formation. */
  formation: string;
  playId?: string;
}

/** A play in a side's list, with the game (film) it is from; a D play is the other team's snap, shown as offense. */
interface Item {
  game: CompareGame;
  play: Play;
  side: 'O' | 'D';
}

/** Our team's name in the film (the own games'). */
let ownName = '';
/** The team with the ball on a film's O plays: us (every game of ours), or a scouted team by name (every week it was scouted). */
export const teamKeyOf = (g: CompareGame) => (g.source === 'own' ? 'own' : teamKey(g.team, ownName));
/** The team with the ball on its D plays, when known. */
export const otherKeyOf = (g: CompareGame) => (g.otherTeam ? teamKey(g.otherTeam, ownName) : '');
/** The film has the team's snaps: its O plays, or its D plays when the other team is it. */
const hasTeam = (g: CompareGame, team: string) => Boolean(team) && (teamKeyOf(g) === team || (otherKeyOf(g) === team && g.plays.some(isDSnap)));

interface Props {
  games: CompareGame[];
  /** The play to start on the left (the one on screen in the Film Room). */
  start?: { gameKey: string; playId?: string };
  renderFilm: (p: CompareFilmProps) => React.ReactNode;
  onClose: () => void;
  /** Where the timing marks are kept (shared with every coach); without it, on this device only. */
  timing?: TimingStore;
  /** The two games on screen (left, right), so the store can open their shared data. */
  onShown?: (keys: [string, string]) => void;
  /** Set who has the ball on a film's D plays (for every coach); without it, the line can't be changed. */
  onSetOtherTeam?: (game: CompareGame, name: string) => void;
}

export interface TimingStore {
  get: (gameKey: string, playId: string) => Moments;
  /** The play's moments after a change (all of them; an empty set clears the play). */
  set: (gameKey: string, playId: string, moments: Moments) => void;
  /** Saved for the whole staff (else on this device only). */
  shared: boolean;
}

const KEY = 'footballFilmroomCompare';
const readSaved = (): { b?: Partial<Pick> } => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
};

/** A game's plays a side lists: offense snaps in the formation; with every formation, untagged plays (clips) too. */
const playsOf = (g: CompareGame | undefined, formation: string) =>
  g ? g.plays.filter((p) => (formation ? isSnap(p) && formationOf(p) === formation : isPickable(p))) : [];

/** The other team's snaps on a game's film (its D plays), as their offense. */
const dPlaysOf = (g: CompareGame, formation: string) =>
  g.plays.filter((p) => isDSnap(p) && (!formation || formationOf(p) === formation)).map(asOffense);

/** The plays a side lists: the team's snaps (O plays where it has the ball, D plays where the other team is it), from its game or every game. */
function itemsOf(games: CompareGame[], byKey: Map<string, CompareGame>, pk: Pick): Item[] {
  const from = pk.allGames ? games.filter((g) => hasTeam(g, pk.team)) : [byKey.get(pk.gameKey)].filter((g): g is CompareGame => Boolean(g));
  return from.flatMap((g) => [
    ...(teamKeyOf(g) === pk.team ? playsOf(g, pk.formation).map((play): Item => ({ game: g, play, side: 'O' })) : []),
    ...(otherKeyOf(g) === pk.team ? dPlaysOf(g, pk.formation).map((play): Item => ({ game: g, play, side: 'D' })) : []),
  ]);
}

/** The other side's start: the other team with the most snaps in that formation, across all its film. */
function otherStart(games: CompareGame[], byKey: Map<string, CompareGame>, from: CompareGame | undefined, formation: string): Pick | undefined {
  const fromTeam = from ? teamKeyOf(from) : '';
  const teams = [...new Set(games.flatMap((g) => [teamKeyOf(g), otherKeyOf(g)]).filter(Boolean))];
  // Their play against ours: us when the left is a scouted team, else the scouted team that runs it most.
  const others = from && from.source !== 'own' && teams.includes('own') ? ['own'] : teams.filter((t) => t !== fromTeam);
  const pool = others.length ? others : teams;
  const scored = pool
    .map((team) => ({ team, n: itemsOf(games, byKey, { team, allGames: true, gameKey: '', formation }).length }))
    .sort((x, y) => y.n - x.n);
  const best = scored[0];
  if (!best) return undefined;
  const pk: Pick = { team: best.team, allGames: true, gameKey: '', formation: best.n > 0 ? formation : '' };
  const first = itemsOf(games, byKey, pk)[0];
  return { ...pk, gameKey: first?.game.key || games.find((g) => hasTeam(g, best.team))?.key || '', playId: first?.play.id };
}

export const CompareView: React.FC<Props> = ({ games, start, renderFilm, onClose, timing, onShown, onSetOtherTeam }) => {
  ownName = games.find((g) => g.source === 'own')?.team || ownName;
  const byKey = useMemo(() => new Map(games.map((g) => [g.key, g])), [games]);
  const [a, setA] = useState<Pick>(() => {
    const g = (start && byKey.get(start.gameKey)) || games[0];
    const p = g?.plays.find((x) => x.id === start?.playId) || playsOf(g, '')[0];
    const f = p ? formationOf(p) : '';
    // The play on screen, in a list of all its team's plays from every game.
    return { team: g ? teamKeyOf(g) : '', allGames: true, gameKey: g?.key || '', formation: f === '(no formation)' ? '' : f, playId: p?.id };
  });
  const [b, setB] = useState<Pick>(() => {
    const saved = readSaved().b;
    const ga = byKey.get(a.gameKey);
    const pa = ga?.plays.find((x) => x.id === a.playId);
    const f = pa ? formationOf(pa) : '';
    // The last team picked on the right, when it has this formation too; else the best match.
    if (saved?.team && saved.team !== a.team && games.some((g) => hasTeam(g, saved.team!))) {
      const pk: Pick = { team: saved.team, allGames: saved.allGames !== false, gameKey: saved.gameKey || '', formation: f };
      const sg = byKey.get(pk.gameKey);
      if (!pk.allGames && (!sg || !hasTeam(sg, pk.team))) pk.allGames = true;
      const first = itemsOf(games, byKey, pk)[0];
      if (first) return { ...pk, gameKey: first.game.key, playId: first.play.id };
    }
    return otherStart(games, byKey, ga, f) || { team: '', allGames: true, gameKey: '', formation: '' };
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

  // Timing: moments marked on each play. Shared with the staff when the screen is given a store (`timing`), else
  // kept on this device.
  const [localTiming, setLocalTiming] = useState<Record<string, Moments>>(loadTiming);
  const momentsOf = (gameKey: string, playId?: string): Moments =>
    !playId ? {} : timing ? timing.get(gameKey, playId) : localTiming[timingKey(gameKey, playId)] || {};
  const mark = (gameKey: string, playId: string, id: MomentId, t: number | null) => {
    const m: Moments = { ...momentsOf(gameKey, playId) };
    if (t == null) delete m[id];
    else m[id] = Math.round(t * 1000) / 1000;
    if (timing) return timing.set(gameKey, playId, m);
    setLocalTiming((all) => {
      const k = timingKey(gameKey, playId);
      const next = { ...all };
      if (Object.keys(m).length) next[k] = m;
      else delete next[k];
      saveTiming(next);
      return next;
    });
  };

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

  const [onlyTimed, setOnlyTimed] = useState<Record<Side, boolean>>({ a: false, b: false });
  /** The D team being typed on a side (null = not changing it). */
  const [editOther, setEditOther] = useState<Record<Side, string | null>>({ a: null, b: null });
  const sideData = (s: Side) => {
    const pk = picks[s];
    const teamGames = games.filter((g) => hasTeam(g, pk.team));
    const all = itemsOf(games, byKey, pk);
    // Plays with times marked (snap, handoff...): marked in the list, and a side can show only those. (A play's marks
    // are known once its game is on screen.)
    const marked = (i: Item) => MOMENTS.filter((m) => momentsOf(i.game.key, i.play.id)[m.id] != null).length;
    const timedCount = all.filter((i) => marked(i) > 0).length;
    const list = onlyTimed[s] && timedCount ? all.filter((i) => marked(i) > 0) : all;
    const item = list.find((i) => i.game.key === pk.gameKey && i.play.id === pk.playId) || list.find((i) => i.game.key === pk.gameKey) || list[0];
    const play = item?.play;
    // The film on screen: the play's game; a game picked with nothing listed yet (film only) still opens its film.
    const game = item?.game || (!pk.allGames ? byKey.get(pk.gameKey) : undefined);
    const at = item ? list.indexOf(item) : -1;
    // The side's team by name ("Us" for ours).
    const ours = pk.team === 'own';
    const anyGame = game || teamGames[0];
    const who = ours ? 'Us' : anyGame ? ((item ? item.side === 'D' : teamKeyOf(anyGame) !== pk.team) ? anyGame.otherTeam || '' : anyGame.team).trim() : '';
    // The team's numbers from the play's formation: its snaps on every game of film (O and D plays).
    const teamItems = itemsOf(games, byKey, { ...pk, allGames: true, formation: '' });
    const teamPlays = teamItems.map((i) => i.play);
    const f = pk.formation || (play ? formationOf(play) : '');
    const numbers = f && f !== '(no formation)' ? formationNumbers(teamPlays.filter((p) => formationOf(p) === f)) : undefined;
    // Formations to pick: the team's, from the listed games.
    const formations = formationList(pk.allGames ? teamPlays : itemsOf(games, byKey, { ...pk, formation: '' }).map((i) => i.play));
    return { pk, teamGames, game, item, ours, who, list, marked, timedCount, play, at, numbers, formations, formation: f, gamesInTeam: new Set(teamItems.map((i) => i.game.key)).size, moments: momentsOf(game?.key || '', play?.id) };
  };
  const A = sideData('a');
  const B = sideData('b');
  const shownA = A.game?.key || '';
  const shownB = B.game?.key || '';
  useEffect(() => onShown?.([shownA, shownB]), [shownA, shownB, onShown]);

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
  // Download a side's video (the clip as it is, named for the play).
  const [saving, setSaving] = useState<Side | null>(null);
  const download = async (s: Side) => {
    const d = s === 'a' ? A : B;
    const v = apis[s].current?.video?.();
    const src = v?.currentSrc || v?.src;
    if (!src || !d.play || !d.game) return;
    setSaving(s);
    try {
      const blob = await (await fetch(src)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = clipFileName(d.who || 'Team', d.play.playNumber, playNameOf(d.play), blob.type);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      window.alert("Couldn't save this video. Let it load (play it once), then try again.");
    } finally {
      setSaving(null);
    }
  };

  // Ask an AI coach how to get to the line faster: pictures of both plays from the snap to contact, and the times.
  const [ai, setAi] = useState<{ open: boolean; working: boolean; status: string; answer: string; error: string; needKey: boolean }>({
    open: false, working: false, status: '', answer: '', error: '', needKey: false,
  });
  const [aiNote, setAiNote] = useState('');
  const [keyText, setKeyText] = useState('');
  const [copied, setCopied] = useState('');
  const aiSide = (d: typeof A): AiSide | undefined =>
    d.game && d.play
      ? { team: d.who || 'Team', ours: d.ours, title: [`#${d.play.playNumber}`, d.play.down ? `${d.play.down}&${d.play.distance ?? ''}` : '', d.play.formation, playNameOf(d.play)].filter(Boolean).join(' · '), facts: playFacts(d.play), moments: d.moments }
      : undefined;
  const askAi = async () => {
    const sa = aiSide(A);
    const sb = aiSide(B);
    if (!sa || !sb) return;
    if (!compareAiEngine()) return setAi((x) => ({ ...x, open: true, needKey: true, error: '', answer: '' }));
    setAi({ open: true, working: true, status: 'Taking pictures of both plays…', answer: '', error: '', needKey: false });
    pauseBoth();
    try {
      const shots = await Promise.all(
        (['a', 'b'] as Side[]).map(async (s) => {
          const v = apis[s].current?.video?.();
          if (!v || !(v.currentSrc || v.src)) throw new Error("Both videos need to be loaded. Let each one play, then ask again.");
          const m = (s === 'a' ? A : B).moments;
          const guess = m.snap == null ? await probeSnap(v.currentSrc || v.src).catch(() => null) : null;
          const w = pictureWindow(m, v.duration || 0, guess);
          const times = evenTimes(w.start, w.end, 10);
          const pics = await captureAt(v, times);
          return times.map((t, i) => ({ fromSnap: Math.round((t - w.snap) * 100) / 100, dataUrl: pics[i] }));
        })
      );
      const prompt = buildPrompt(sa, sb, shots[0], shots[1], aiNote.trim());
      const answer = await askCompareAi(prompt, [...shots[0], ...shots[1]].map((x) => x.dataUrl), (status) => setAi((x) => ({ ...x, status })));
      setAi({ open: true, working: false, status: '', answer, error: '', needKey: false });
    } catch (e: any) {
      const msg = String(e?.message || e);
      setAi({ open: true, working: false, status: '', answer: '', error: msg === 'NO_KEY' ? '' : msg, needKey: msg === 'NO_KEY' || /refused this device/.test(msg) });
    }
  };
  const copyText = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(''), 2500);
    } catch {
      window.prompt('Copy this:', text);
    }
  };
  /** The same question for another AI (ChatGPT, Claude): pasted with the two downloaded videos. */
  const questionForVideos = () => {
    const sa = aiSide(A);
    const sb = aiSide(B);
    return sa && sb ? buildPrompt(sa, sb, [], [], aiNote.trim()) : '';
  };

  const swap = () => {
    setA(b);
    setB(a);
  };

  const videoMax = 'min(46dvh, calc((100vw - 3rem) / 2 * 9 / 16))';
  // Every team in the film: us first, then each scouted team (a team scouted more than one week is one team).
  const teams = useMemo(() => {
    // A team also counts when it is only ever on the D plays (the team a scouted team played).
    const m = new Map<string, { key: string; label: string; games: number }>();
    const add = (k: string, name: string) => {
      const t = m.get(k) || { key: k, label: k === 'own' ? `Us (${ownName || name})` : name.trim(), games: 0 };
      t.games++;
      m.set(k, t);
    };
    games.forEach((g) => add(teamKeyOf(g), g.team));
    games.forEach((g) => g.otherTeam && !g.filmOnly && g.plays.some(isDSnap) && add(otherKeyOf(g), g.otherTeam));
    return [...m.values()].sort((x, y) => (x.key === 'own' ? -1 : y.key === 'own' ? 1 : 0));
  }, [games]);

  const field = 'h-9 pointer-coarse:h-10 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100 px-2';
  const barBtn = 'inline-flex items-center gap-1 h-9 pointer-coarse:h-10 px-3 rounded-lg text-xs font-bold';

  const pane = (s: Side, d: ReturnType<typeof sideData>) => {
    const set = setPick[s];
    const side = s === 'a' ? 'Left' : 'Right';
    const go = (i: number) => d.list[i] && set((p) => ({ ...p, gameKey: d.list[i].game.key, playId: d.list[i].play.id }));
    /** The play to show after a change: the first one listed. */
    const firstOf = (pk: Pick): Pick => {
      const first = itemsOf(games, byKey, pk)[0];
      return first ? { ...pk, gameKey: first.game.key, playId: first.play.id } : { ...pk, playId: undefined };
    };
    const several = d.teamGames.length > 1;
    return (
      <section aria-label={s === 'a' ? 'Left play' : 'Right play'} className="min-w-0 flex flex-col gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-1.5">
          <select
            aria-label={`${side} team`}
            value={d.pk.team}
            onChange={(e) => {
              const team = e.target.value;
              // Every game of the team's film; the formation kept when the team runs it.
              const pk: Pick = { team, allGames: true, gameKey: games.find((g) => hasTeam(g, team))?.key || '', formation: d.pk.formation };
              if (pk.formation && !itemsOf(games, byKey, pk).length) pk.formation = '';
              set(firstOf(pk));
            }}
            className={field}
          >
            {!teams.some((t) => t.key === d.pk.team) && <option value="">Pick a team</option>}
            {teams.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            aria-label={`${side} game`}
            value={d.pk.allGames ? '*' : d.pk.gameKey}
            onChange={(e) => {
              const v = e.target.value;
              const pk: Pick = v === '*' ? { ...d.pk, allGames: true } : { ...d.pk, allGames: false, gameKey: v };
              // Keep the formation when the film picked has it.
              if (pk.formation && !itemsOf(games, byKey, pk).length) pk.formation = '';
              set(v === '*' && d.play ? { ...pk, gameKey: d.game?.key || pk.gameKey, playId: d.play.id } : firstOf(pk));
            }}
            className={field}
          >
            <option value="*">{several ? `Every game (${d.teamGames.length})` : 'Every game'}</option>
            {d.teamGames.map((g) => (
              <option key={g.key} value={g.key}>
                {g.source === 'own' ? g.name : `${g.group}: ${g.name}`}
                {g.filmOnly ? ' (film only: pick a clip)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-1.5">
          <select
            aria-label={`${side} formation`}
            value={d.pk.formation}
            onChange={(e) => set(firstOf({ ...d.pk, formation: e.target.value }))}
            className={field}
          >
            <option value="">Every formation</option>
            {d.pk.formation && !d.formations.some((f) => f.formation === d.pk.formation) && <option value={d.pk.formation}>{d.pk.formation} (0)</option>}
            {d.formations.map((f) => (
              <option key={f.formation} value={f.formation}>
                {f.formation} ({f.count})
              </option>
            ))}
          </select>
          <select
            aria-label={`${side} play`}
            value={d.at >= 0 ? String(d.at) : ''}
            onChange={(e) => go(Number(e.target.value))}
            className={field}
            disabled={!d.list.length}
          >
            {!d.list.length && (
              <option value="">{!d.pk.team ? 'Pick a team' : d.game?.filmOnly ? 'Opening the film… its clips show here' : d.pk.allGames ? 'No plays in this formation (film-only games: pick the game)' : 'No plays in this formation'}</option>
            )}
            {d.list.map((it, i) => {
              const p = it.play;
              const g = Number(p.gainLoss);
              // From every game: each play says which game it is from.
              const from = d.pk.allGames && several ? it.game.name : '';
              return (
                <option key={`${it.game.key}|${p.id}`} value={String(i)}>
                  {d.marked(it) ? `⏱${d.marked(it)} ` : ''}
                  {[from, `#${p.playNumber}`, p.down ? `${p.down}&${p.distance ?? ''}` : '', d.pk.formation ? '' : p.formation, playNameOf(p), Number.isFinite(g) ? `${g > 0 ? '+' : ''}${g}` : ''].filter(Boolean).join(' · ')}
                </option>
              );
            })}
          </select>
        </div>
        {d.game && !d.game.filmOnly && (
          <div className="-mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300" aria-label={`${side} film teams`}>
            {editOther[s] == null ? (
              <>
                <span>
                  This film: <b>O</b> = {d.game.source === 'own' ? 'Us' : d.game.team} · <b>D</b> ={' '}
                  {d.game.otherTeam ? (
                    <>
                      {d.game.otherTeam}
                      {d.game.otherGuessed ? ' (guessed)' : ''}
                    </>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300 font-bold">not set, so its D plays aren&apos;t listed</span>
                  )}
                </span>
                {onSetOtherTeam && (
                  <button type="button" onClick={() => setEditOther((x) => ({ ...x, [s]: d.game!.otherTeam || '' }))} className="font-bold underline">
                    {d.game.otherTeam ? 'Change' : 'Set the D team'}
                  </button>
                )}
              </>
            ) : (
              <form
                className="flex flex-wrap items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = (editOther[s] || '').trim();
                  if (name && d.game) {
                    onSetOtherTeam?.(d.game, name);
                    // A side showing the old D team follows it to the new name.
                    if (d.pk.team === otherKeyOf(d.game)) set((p) => ({ ...p, team: teamKey(name, ownName) }));
                  }
                  setEditOther((x) => ({ ...x, [s]: null }));
                }}
              >
                <label htmlFor={`other-${s}`}>
                  Team with the ball on <b>{d.game.name}</b>&apos;s D plays:
                </label>
                <input
                  id={`other-${s}`}
                  list="compare-team-names"
                  value={editOther[s] || ''}
                  onChange={(e) => setEditOther((x) => ({ ...x, [s]: e.target.value }))}
                  autoFocus
                  className="h-8 w-40 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs"
                />
                <button type="submit" disabled={!(editOther[s] || '').trim()} className="h-8 px-2.5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50">
                  Save
                </button>
                <button type="button" onClick={() => setEditOther((x) => ({ ...x, [s]: null }))} className="h-8 px-2 font-bold">
                  Cancel
                </button>
              </form>
            )}
          </div>
        )}
        {d.timedCount > 0 && (
          <label className="-mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer self-start">
            <input type="checkbox" checked={onlyTimed[s]} onChange={(e) => setOnlyTimed((o) => ({ ...o, [s]: e.target.checked }))} />
            Only timed plays ⏱ ({d.timedCount})
          </label>
        )}
        {d.game ? (
          renderFilm({
            side: s,
            game: d.game,
            play: d.play,
            who: d.who,
            apiRef: apis[s],
            maxVideoHeight: videoMax,
            hasPrev: d.at > 0,
            hasNext: d.at >= 0 && d.at < d.list.length - 1,
            onPrev: () => go(d.at - 1),
            onNext: () => go(d.at + 1),
          })
        ) : (
          <div className="aspect-video max-w-full rounded-xl bg-slate-900 text-slate-300 text-xs flex items-center justify-center px-4 text-center">{d.pk.team ? 'No plays to show. Pick another formation or one of its games.' : 'Pick a team to compare.'}</div>
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
        {d.game && d.play && (
          <button
            type="button"
            onClick={() => void download(s)}
            disabled={saving === s}
            className="self-start inline-flex items-center gap-1 h-9 pointer-coarse:h-10 px-3 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
            title="Save this play's video file (to send it or open it in another app)"
          >
            <Download size={14} /> {saving === s ? 'Saving…' : 'Download video'}
          </button>
        )}
      </section>
    );
  };

  const factsA = A.play ? playFacts(A.play) : [];
  const factsB = B.play ? playFacts(B.play) : [];
  const rows = (factsA.length ? factsA : factsB).map((r, i) => ({ label: r.label, a: factsA[i]?.value || '', b: factsB[i]?.value || '' })).filter((r) => r.a || r.b);
  const nameA = A.who || 'Left';
  const nameB = B.who || 'Right';
  const ours = A.ours ? A : B.ours ? B : undefined;
  const theirs = ours === A ? B : ours === B ? A : undefined;
  const notes = ours?.numbers && theirs?.numbers && theirs.who && !theirs.ours ? compareNotes(ours.numbers, theirs.numbers, theirs.who) : [];
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
    d.game ? (d.ours ? 'Our season' : `${d.who}${d.gamesInTeam > 1 ? ` (${d.gamesInTeam} games of film)` : ''}`) : '';

  return (
    <div role="dialog" aria-label="Compare plays" className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100" data-film-area>
      <datalist id="compare-team-names">
        {teams.filter((t) => t.key !== 'own').map((t) => (
          <option key={t.key} value={t.label} />
        ))}
        {ownName && <option value={ownName} />}
      </datalist>
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
          <button
            type="button"
            onClick={() => void askAi()}
            disabled={ai.working || !A.play || !B.play}
            className={`${barBtn} bg-violet-600 text-white disabled:opacity-50`}
            title="An AI coach looks at both plays from the snap to contact (and your timing marks) and says how to get to the line faster"
          >
            <Sparkles size={14} /> {ai.working ? 'Asking…' : 'Ask AI'}
          </button>
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

        {ai.open && (
          <section aria-label="AI coach" className="mt-4 rounded-xl border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-violet-600 dark:text-violet-300 shrink-0" />
              <h3 className="text-sm font-black">AI coach: getting to the line faster</h3>
              <button type="button" onClick={() => setAi((x) => ({ ...x, open: false }))} aria-label="Close the AI coach" className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-violet-100 dark:hover:bg-violet-500/20">
                <X size={15} />
              </button>
            </div>
            {ai.working && <p className="mt-2 font-bold" role="status">{ai.status}</p>}
            {ai.error && <p className="mt-2 font-bold text-rose-700 dark:text-rose-300" role="alert">{ai.error}</p>}
            {ai.needKey && (
              <div className="mt-2 space-y-1.5">
                <p>
                  The AI needs a Google Gemini key on this device (free at aistudio.google.com → Get API key), or the Ollama model on this computer (set in the Film Room&apos;s
                  AI breakdown settings).
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    type="password"
                    value={keyText}
                    onChange={(e) => setKeyText(e.target.value)}
                    placeholder="Paste the Gemini API key (AIza…)"
                    aria-label="Gemini API key"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs"
                  />
                  <button
                    type="button"
                    disabled={!/^AIza[0-9A-Za-z_-]{15,}/.test(keyText.trim())}
                    onClick={() => {
                      saveGeminiKey(keyText.trim());
                      setKeyText('');
                      void askAi();
                    }}
                    className="h-9 px-3 rounded-lg bg-violet-600 text-white font-bold disabled:opacity-50"
                  >
                    Save and ask
                  </button>
                </div>
              </div>
            )}
            {ai.answer && <div className="mt-2 whitespace-pre-wrap leading-relaxed text-[13px] max-w-[75ch]" aria-label="AI answer">{ai.answer.replace(/\*\*/g, '')}</div>}
            <label className="mt-3 block">
              <span className="font-bold">Anything to tell the AI?</span>
              <textarea
                value={aiNote}
                onChange={(e) => setAiNote(e.target.value)}
                rows={2}
                placeholder="e.g. Our fullback is #32; watch the QB's first step"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => void askAi()} disabled={ai.working} className="h-9 px-3 rounded-lg bg-violet-600 text-white font-bold disabled:opacity-50">
                {ai.answer || ai.error ? 'Ask again' : 'Ask'}
              </button>
              {ai.answer && (
                <button type="button" onClick={() => void copyText(ai.answer, 'answer')} className="h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-500/40 font-bold inline-flex items-center gap-1">
                  <Copy size={13} /> {copied === 'answer' ? 'Copied' : 'Copy the answer'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void copyText(questionForVideos(), 'question')}
                className="h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-500/40 font-bold inline-flex items-center gap-1"
                title="The same question, to paste into ChatGPT, Claude or Gemini along with the two downloaded videos"
              >
                <Copy size={13} /> {copied === 'question' ? 'Copied' : 'Copy the question for another AI'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
              Sends 10 pictures of each play (just before the snap to contact) and your timing marks{compareAiEngine() === 'ollama' ? ' to the model on this computer' : ' to Google Gemini'}. Mark Snap and Contact first for the best answer. For another AI:
              Download video on both plays, then paste the copied question with them.
            </p>
          </section>
        )}

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
          <p className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">{timing?.shared ? 'Marks are saved with each play for every coach, on every device.' : 'Marks are saved on this device for each play.'} Once both snaps are marked, To the snap starts both videos on their marked snap.</p>
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
