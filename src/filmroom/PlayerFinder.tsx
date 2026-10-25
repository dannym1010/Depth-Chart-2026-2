// Pick any player and see every play he was part of this season, across all our games: carries, passes, catches
// and targets, tackles and assists, with his numbers on top and a table that sorts by any column. A click on a play
// watches it (its game opens first).
import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import { jerseyOf, playerTotals, playsForPlayer, type PlayerPlay, type PlayerRole } from './playerPlays';

interface GameInfo {
  id: string;
  name: string;
  week?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** All of our games this season, and their plays. */
  games: GameInfo[];
  plays: Play[];
  roster: RosterPlayer[];
  /** "Week 3" for a week key. */
  weekLabel?: (week?: string) => string;
  onWatch: (gameId: string, playId: string) => void;
}

type SortKey = 'game' | 'play' | 'qtr' | 'down' | 'yard' | 'role' | 'name' | 'result' | 'gain';
type RoleFilter = 'all' | 'run' | 'pass' | 'catch' | 'defense';

const ROLE_COLOR: Record<PlayerRole, string> = { Rush: '#2563eb', Pass: '#8b5cf6', Catch: '#0891b2', Target: '#94a3b8', Tackle: '#ea580c', Assist: '#f59e0b' };
const EVENT_LABEL: Record<string, string> = { sack: 'Sack', tfl: 'TFL', int: 'INT', ff: 'Forced fumble', fr: 'Fumble rec.', pbu: 'PBU' };

const ordinal = (n: number) => `${n}${['', 'st', 'nd', 'rd'][n] || 'th'}`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

export const PlayerFinder: React.FC<Props> = ({ open, onClose, games, plays, roster, weekLabel, onWatch }) => {
  const [num, setNum] = useState('');
  const [query, setQuery] = useState('');
  const [gameId, setGameId] = useState('all');
  const [role, setRole] = useState<RoleFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'game', desc: false });

  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  // Games in season order (by week, then name), for sorting and the game picker.
  const gameOrder = useMemo(() => {
    const wk = (g: GameInfo) => Number(String(g.week || '').match(/\d+/)?.[0] || 999);
    return new Map([...games].sort((a, b) => wk(a) - wk(b) || a.name.localeCompare(b.name)).map((g, i) => [g.id, i]));
  }, [games]);
  const gameText = (id?: string) => {
    const g = id ? gameById.get(id) : undefined;
    if (!g) return 'Game';
    const w = weekLabel?.(g.week) || g.week || '';
    return w && !g.name.includes(w) ? `${w} · ${g.name}` : g.name;
  };

  // Everyone who shows up on a play, roster first (players with plays get a count).
  const people = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of plays) {
      const seen = new Set<string>();
      for (const label of [p.rusher, p.passer, p.receiver, p.carrierOrTarget, p.defPlay?.maker, p.defPlay?.assist, ...(p.defPlay?.assists || [])]) {
        const n = jerseyOf(label);
        if (n && !seen.has(n)) {
          seen.add(n);
          counts.set(n, (counts.get(n) || 0) + 1);
        }
      }
    }
    const list = roster
      .filter((r) => r.num)
      .map((r) => ({ num: String(Number(r.num)), name: `${r.firstName || ''} ${r.lastName || ''}`.trim(), count: counts.get(String(Number(r.num))) || 0 }));
    const known = new Set(list.map((x) => x.num));
    for (const [n, c] of counts) if (!known.has(n)) list.push({ num: n, name: '', count: c });
    return list.sort((a, b) => Number(a.num) - Number(b.num));
  }, [plays, roster]);
  const shownPeople = people.filter((x) => {
    const q = query.trim().toLowerCase();
    return !q || x.num === q.replace('#', '') || x.name.toLowerCase().includes(q);
  });
  const person = people.find((x) => x.num === num);

  const rows = useMemo(() => (num ? playsForPlayer(plays, num) : []), [plays, num]);
  const inGame = rows.filter((r) => gameId === 'all' || r.play.gameId === gameId);
  const totals = playerTotals(inGame);
  const roleOk = (r: PlayerPlay) =>
    role === 'all' ||
    (role === 'run' && r.roles.includes('Rush')) ||
    (role === 'pass' && r.roles.includes('Pass')) ||
    (role === 'catch' && (r.roles.includes('Catch') || r.roles.includes('Target'))) ||
    (role === 'defense' && (r.roles.includes('Tackle') || r.roles.includes('Assist')));
  const sorted = useMemo(() => {
    const val = (r: PlayerPlay): number | string => {
      const p = r.play;
      switch (sort.key) {
        case 'game':
          return (gameOrder.get(p.gameId || '') ?? 999) * 10000 + (Number(p.playNumber) || 0);
        case 'play':
          return Number(p.playNumber) || 0;
        case 'qtr':
          return Number(p.quarter) || 0;
        case 'down':
          return (Number(p.down) || 9) * 100 + (Number(p.distance) || 0);
        case 'yard':
          return Number(p.yardLine) || 0;
        case 'role':
          return r.roles.join(',');
        case 'name':
          return String(p.callName || p.playName || '');
        case 'result':
          return String(p.result || '');
        default:
          return Number(p.gainLoss) || 0;
      }
    };
    return inGame
      .filter(roleOk)
      .slice()
      .sort((a, b) => {
        const x = val(a), y = val(b);
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return sort.desc ? -c : c;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGame, role, sort, gameOrder]);

  if (!open) return null;
  const head = (key: SortKey, label: string, cls = '') => (
    <th className={`px-2 py-1.5 text-left font-black text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap ${cls}`}>
      <button type="button" className="cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key === 'gain' }))}>
        {label}
        {sort.key === key ? (sort.desc ? ' ▼' : ' ▲') : ''}
      </button>
    </th>
  );
  const chip = (on: boolean) =>
    `px-2.5 h-7 rounded-lg text-xs font-bold cursor-pointer ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`;
  const stat = (label: string, value: string | number) => (
    <div className="min-w-[4.5rem]">
      <div className="text-lg font-black text-slate-900 dark:text-white leading-tight">{value}</div>
      <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
  const group = (title: string, color: string, cells: [string, string | number][]) => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 px-3 py-2" style={{ borderLeftColor: color }}>
      <div className="text-[11px] font-black uppercase tracking-wide mb-1" style={{ color }}>
        {title}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">{cells.map(([l, v]) => <React.Fragment key={l}>{stat(l, v)}</React.Fragment>)}</div>
    </div>
  );
  const t = totals;
  const avg = (yds: number, n: number) => (n ? (Math.round((yds / n) * 10) / 10).toString() : '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Player finder"
        className="w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-black text-slate-900 dark:text-white">Player finder</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Every play a player was part of, all our games this season</span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Who */}
          <div className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 flex flex-col min-h-0 max-h-[30vh] md:max-h-none">
            <div className="p-2">
              <label className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950">
                <Search size={14} className="text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or number" aria-label="Find a player" className="flex-1 min-w-0 bg-transparent text-sm outline-none text-slate-900 dark:text-white" />
              </label>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
              {shownPeople.map((x) => (
                <button
                  key={x.num}
                  type="button"
                  onClick={() => setNum(x.num)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer ${
                    num === x.num ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                  } ${num !== x.num && !x.count ? 'opacity-50' : ''}`}
                  title={x.count ? `${x.count} play${x.count === 1 ? '' : 's'}` : 'No plays tagged with this number yet'}
                >
                  <span className="w-8 text-sm font-black">#{x.num}</span>
                  <span className="flex-1 min-w-0 truncate text-sm">{x.name || <i className="opacity-70">Not on the roster</i>}</span>
                  <span className={`text-[11px] font-bold ${num === x.num ? 'text-white/80' : 'text-slate-400'}`}>{x.count || ''}</span>
                </button>
              ))}
              {!shownPeople.length && <p className="px-2 text-xs text-slate-500">Nobody matches.</p>}
            </div>
          </div>

          {/* His plays */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            {!person ? (
              <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Pick a player on the left to see every play he was part of this season.</p>
            ) : (
              <>
                <div className="p-3 flex flex-col gap-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      #{person.num} {person.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {t.plays} play{t.plays === 1 ? '' : 's'}
                      {gameId === 'all' ? ((n) => ` in ${n} game${n === 1 ? '' : 's'}`)(new Set(rows.map((r) => r.play.gameId)).size) : ''}
                    </span>
                    <select
                      value={gameId}
                      onChange={(e) => setGameId(e.target.value)}
                      aria-label="Game"
                      className="ml-auto h-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-100 px-2"
                    >
                      <option value="all">Whole season</option>
                      {[...games]
                        .sort((a, b) => (gameOrder.get(a.id) ?? 0) - (gameOrder.get(b.id) ?? 0))
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {gameText(g.id)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {t.carries > 0 && group('Rushing', ROLE_COLOR.Rush, [['Carries', t.carries], ['Yards', t.rushYds], ['Avg', avg(t.rushYds, t.carries)], ['TDs', t.touchdowns]])}
                    {t.targets > 0 && group('Receiving', ROLE_COLOR.Catch, [['Targets', t.targets], ['Catches', t.catches], ['Yards', t.recYds], ['Avg', avg(t.recYds, t.catches)]])}
                    {t.attempts > 0 && group('Passing', ROLE_COLOR.Pass, [['Comp / Att', `${t.completions}/${t.attempts}`], ['Yards', t.passYds], ['Comp %', t.attempts ? `${Math.round((t.completions / t.attempts) * 100)}%` : '—']])}
                    {t.tackles + t.assists > 0 &&
                      group('Defense', ROLE_COLOR.Tackle, [
                        ['Tackles', t.tackles],
                        ['Assists', t.assists],
                        ...([['TFL', t.tfl], ['Sacks', t.sacks], ['INT', t.ints], ['Forced fum.', t.forcedFumbles], ['Fum. rec.', t.recoveries], ['PBU', t.pbu]] as [string, number][]).filter(([, v]) => v > 0),
                      ])}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ['all', 'All plays'],
                        ['run', 'Runs'],
                        ['pass', 'Passes'],
                        ['catch', 'Catches & targets'],
                        ['defense', 'Tackles & assists'],
                      ] as const
                    ).map(([k, label]) => (
                      <button key={k} type="button" className={chip(role === k)} onClick={() => setRole(k)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  {sorted.length ? (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-[0_1px_0_rgba(148,163,184,0.4)]">
                        <tr>
                          {head('game', 'Game')}
                          {head('play', '#')}
                          {head('qtr', 'Qtr')}
                          {head('down', 'Down')}
                          {head('yard', 'Yard ln')}
                          {head('role', 'Role')}
                          {head('name', 'Play')}
                          {head('result', 'Result')}
                          {head('gain', 'Gain', 'text-right')}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((r) => {
                          const p = r.play;
                          const gain = Number(p.gainLoss) || 0;
                          return (
                            <tr
                              key={`${p.gameId}-${p.id}`}
                              onClick={() => p.gameId && onWatch(p.gameId, p.id)}
                              className="border-t border-slate-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer"
                              title="Watch this play"
                            >
                              <td className="px-2 py-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300 max-w-[12rem] truncate">{gameText(p.gameId)}</td>
                              <td className="px-2 py-1.5 font-bold text-slate-900 dark:text-white">{p.playNumber}</td>
                              <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{p.quarter ? (p.quarter >= 5 ? 'OT' : `Q${p.quarter}`) : ''}</td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-slate-800 dark:text-slate-100">{p.down ? `${ordinal(p.down)} & ${p.distance || '?'}` : ''}</td>
                              <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{p.rawYardLine || ''}</td>
                              <td className="px-2 py-1.5">
                                <span className="flex flex-wrap gap-1">
                                  {r.roles.map((x) => (
                                    <span key={x} className="px-1.5 rounded text-[11px] font-black text-white" style={{ background: ROLE_COLOR[x] }}>
                                      {x}
                                    </span>
                                  ))}
                                  {r.events.map((e) => (
                                    <span key={e} className="px-1.5 rounded text-[11px] font-black bg-rose-600 text-white">
                                      {EVENT_LABEL[e] || e}
                                    </span>
                                  ))}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100 max-w-[14rem] truncate">{p.callName || p.playName || ''}</td>
                              <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{p.result || ''}</td>
                              <td className="px-2 py-1.5 text-right font-black" style={{ color: gain < 0 ? '#dc2626' : gain >= 10 ? '#16a34a' : undefined }}>
                                {signed(gain)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-6 text-sm text-slate-500 dark:text-slate-400">No plays like that for #{person.num}{gameId === 'all' ? ' this season' : ' in this game'}.</p>
                  )}
                </div>
                <p className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
                  Click a column to sort; click a play to watch it. Players are matched by jersey number on our film&apos;s plays (Hudl&apos;s RUSHER / PASSER / RECEIVER / TACKLER columns, or who a coach picked in the breakdown).
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
