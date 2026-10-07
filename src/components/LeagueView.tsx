// The league's schedule, scores and standings for this team's level only (10U sees 10U), read from the files
// the league posts each week. Our games are picked out and our row is highlighted.
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trophy, CalendarDays, ListOrdered, ExternalLink } from 'lucide-react';
import type { Team } from '../types';
import { clubSummary, forLevel, leagueClubs, sameLevel, sameTeam, type LeagueData, type LeagueGame } from '../utils/leagueParse';
import { fetchLeague, leagueIsStale, readCachedLeague } from '../utils/leagueFetch';

const LEAGUE_SITE = 'https://www.taconicyfc.com/Default.aspx?tabid=2251499';

/** Our name in the league's files: the team's setting, else a league team named in our team name, else Mahopac. */
export function leagueNameFor(team: Team | undefined, data: LeagueData | null): string {
  if (team?.leagueName?.trim()) return team.leagueName.trim();
  const ours = (team?.name || '').toLowerCase();
  const names = new Set((data?.schedule || []).flatMap((g) => [g.home, g.away]));
  const hit = [...names].filter((n) => n && ours.includes(n.toLowerCase())).sort((a, b) => b.length - a.length)[0];
  return hit || 'Mahopac';
}

/** A league date ("9/27/26") that's before today. */
const isPast = (date: string) => {
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return false;
  const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(y, Number(m[1]) - 1, Number(m[2]) + 1) <= new Date();
};

type Tab = 'ours' | 'scores' | 'standings' | 'schedule' | 'club';

const card = 'bg-slate-800/90 rounded-2xl border border-slate-700/80 p-4';
const th = 'py-2 px-2 text-[10px] font-black uppercase tracking-wide text-slate-400 text-right first:text-left whitespace-nowrap';
const td = 'py-1.5 px-2 text-sm text-right first:text-left tabular-nums whitespace-nowrap';

interface Props {
  team?: Team;
  onUpdateTeam?: (teamId: string, updates: Partial<Team>) => void;
  canEdit?: boolean;
}

export const LeagueView: React.FC<Props> = ({ team, onUpdateTeam, canEdit }) => {
  const [data, setData] = useState<LeagueData | null>(() => readCachedLeague());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('ours');
  const [editingName, setEditingName] = useState(false);
  const level = (team?.ageGroup || '').trim();

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchLeague());
    } catch (e: any) {
      setError(e?.message || 'Could not load the league files.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (leagueIsStale(data)) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ourName = leagueNameFor(team, data);
  const view = useMemo(() => (data && level ? forLevel(data, level, ourName) : null), [data, level, ourName]);
  /** A team's games at this level, and its record and points from the scores posted. */
  const teamSeason = (name: string) => {
    const games = (view?.schedule || []).filter((g) => sameTeam(g.home, name) || sameTeam(g.away, name));
    let w = 0, l = 0, t = 0, pf = 0, pa = 0;
    for (const g of games) {
      if (g.homeScore == null || g.awayScore == null) continue;
      const us = sameTeam(g.home, name) ? g.homeScore : g.awayScore;
      const them = sameTeam(g.home, name) ? g.awayScore : g.homeScore;
      pf += us;
      pa += them;
      if (us > them) w++;
      else if (us < them) l++;
      else t++;
    }
    return { games, w, l, t, pf, pa };
  };
  const record = useMemo(() => teamSeason(ourName), [view, ourName]); // eslint-disable-line react-hooks/exhaustive-deps
  const levelTeams = useMemo(() => [...new Set((view?.schedule || []).flatMap((g) => [g.home, g.away]))].sort((a, b) => a.localeCompare(b)), [view]);
  // The team shown on the Team games tab (ours unless a coach picks another).
  const [pickedTeam, setPickedTeam] = useState('');
  // All levels: one club's record at every age level, added up (ours unless another is picked).
  const [pickedClub, setPickedClub] = useState('');
  const clubs = useMemo(() => (data ? leagueClubs(data) : []), [data]);
  const club = pickedClub && clubs.some((c) => sameTeam(c, pickedClub)) ? pickedClub : clubs.find((c) => sameTeam(c, ourName)) || ourName;
  const clubView = useMemo(() => (data ? clubSummary(data, club) : null), [data, club]);
  const shownTeam = pickedTeam && levelTeams.some((n) => sameTeam(n, pickedTeam)) ? pickedTeam : ourName;
  const shown = useMemo(() => teamSeason(shownTeam), [view, shownTeam]); // eslint-disable-line react-hooks/exhaustive-deps
  const openTeam = (name: string) => {
    setPickedTeam(name);
    setTab('ours');
  };
  const weeks = useMemo(() => [...new Set((view?.schedule || []).map((g) => g.week))].sort((a, b) => Number(a) - Number(b)), [view]);
  const lastScoredWeek = useMemo(() => [...new Set((view?.results || []).map((g) => g.week))].sort((a, b) => Number(b) - Number(a))[0], [view]);
  const [week, setWeek] = useState<string>('');
  const scoreWeek = week || lastScoredWeek || '';

  const hl = (name: string) => (sameTeam(name, ourName) ? 'text-amber-300 font-black' : 'text-slate-100');
  const score = (g: LeagueGame, side: 'home' | 'away') => {
    const v = side === 'home' ? g.homeScore : g.awayScore;
    const o = side === 'home' ? g.awayScore : g.homeScore;
    if (v == null) return null;
    return <span className={`tabular-nums ${o != null && v > o ? 'font-black text-white' : 'text-slate-400'}`}>{v}</span>;
  };
  const GameRow: React.FC<{ g: LeagueGame; showWeek?: boolean }> = ({ g, showWeek }) => (
    <div className="flex items-center gap-3 py-2 border-b border-slate-700/60 last:border-0 text-sm">
      <div className="w-24 shrink-0 text-xs text-slate-400">
        {showWeek && <div className="font-bold text-slate-300">Week {g.week}</div>}
        {g.date}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => openTeam(g.away)} className={`truncate text-left hover:underline ${hl(g.away)}`} title={`See ${g.away}'s games`}>{g.away}</button>
          {score(g, 'away')}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => openTeam(g.home)} className={`truncate text-left hover:underline ${hl(g.home)}`} title={`See ${g.home}'s games`}>@ {g.home}</button>
          {score(g, 'home')}
        </div>
      </div>
      <div className="w-32 shrink-0 text-right text-xs text-slate-400 hidden sm:block">
        <div>{g.homeScore != null ? 'Final' : isPast(g.date) ? 'No score posted' : g.time}</div>
        <div className="truncate">{g.location}</div>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'ours', label: 'Team games', icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: 'scores', label: 'Scores', icon: <ListOrdered className="w-3.5 h-3.5" /> },
    { id: 'standings', label: 'Standings', icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: 'schedule', label: 'League schedule', icon: <CalendarDays className="w-3.5 h-3.5" /> },
    { id: 'club', label: 'All levels', icon: <ListOrdered className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4 print:hidden">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h3 className="font-black text-slate-100 text-base">League · {level || 'no level set'}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            From the Taconic Youth Football schedule, results and standings files.{' '}
            {data ? `Updated ${new Date(data.fetchedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : ''}{' '}
            <a href={LEAGUE_SITE} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline inline-flex items-center gap-0.5">
              League site <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            We're <b className="text-amber-300">{ourName}</b> in the league files
            {canEdit && team && onUpdateTeam && !editingName && (
              <button onClick={() => setEditingName(true)} className="ml-2 text-indigo-300 hover:underline">change</button>
            )}
            {editingName && team && onUpdateTeam && (
              <select
                autoFocus
                value={ourName}
                onChange={(e) => {
                  onUpdateTeam(team.id, { leagueName: e.target.value });
                  setEditingName(false);
                }}
                onBlur={() => setEditingName(false)}
                className="ml-2 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-100"
              >
                {[...new Set((view?.schedule || []).flatMap((g) => [g.home, g.away]))].sort().map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view && view.ourGames.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Record</div>
              <div className="text-xl font-black text-white tabular-nums">{record.w}-{record.l}{record.t ? `-${record.t}` : ''}</div>
            </div>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
      {!level && (
        <div className={`${card} text-sm text-slate-300`}>This team has no level (age group) set, so there's nothing to match in the league files. Set it in the team settings (e.g. 10U).</div>
      )}
      {!data && loading && <div className={`${card} text-sm text-slate-400`}>Reading the league's files…</div>}

      {view && (
        <>
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-750 w-fit max-w-full overflow-x-auto text-xs">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'ours' && (
            <div className={card}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2 text-xs">
                <label className="flex items-center gap-2">
                  <span className="font-bold text-slate-300">Team</span>
                  <select
                    value={levelTeams.find((n) => sameTeam(n, shownTeam)) || shownTeam}
                    onChange={(e) => setPickedTeam(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-100"
                  >
                    {levelTeams.map((n) => (
                      <option key={n} value={n}>{n}{sameTeam(n, ourName) ? ' (us)' : ''}</option>
                    ))}
                  </select>
                </label>
                <span className="text-slate-300">
                  Record <b className="text-white tabular-nums">{shown.w}-{shown.l}{shown.t ? `-${shown.t}` : ''}</b>
                </span>
                <span className="text-slate-300">
                  Points <b className="text-white tabular-nums">{shown.pf}</b> for · <b className="text-white tabular-nums">{shown.pa}</b> against
                </span>
                {!sameTeam(shownTeam, ourName) && (
                  <button onClick={() => setPickedTeam('')} className="text-indigo-300 hover:underline">Back to {ourName}</button>
                )}
              </div>
              {shown.games.length ? (
                shown.games.map((g, i) => <GameRow key={i} g={g} showWeek />)
              ) : (
                <p className="text-sm text-slate-400">No {level} games for {shownTeam} in the league schedule.</p>
              )}
              {view.byes.filter((b) => sameTeam(b.team, shownTeam)).map((b) => (
                <p key={b.week} className="text-xs text-slate-400 mt-2">Week {b.week} ({b.date}): bye</p>
              ))}
            </div>
          )}

          {tab === 'scores' && (
            <div className={card}>
              <div className="flex items-center gap-2 mb-2 text-xs">
                <span className="font-bold text-slate-300">Week</span>
                <select value={scoreWeek} onChange={(e) => setWeek(e.target.value)} className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-100">
                  {weeks.map((w) => (
                    <option key={w} value={w}>Week {w}{view.results.some((r) => r.week === w) ? '' : ' (no results posted)'}</option>
                  ))}
                </select>
              </div>
              {(() => {
                const games = view.schedule.filter((g) => g.week === scoreWeek);
                const posted = view.results.filter((g) => g.week === scoreWeek);
                // Games played but not in the schedule (moved or added) still show from the results file.
                const extra = posted.filter((r) => !games.some((g) => g.date === r.date && (sameTeam(g.home, r.home) || sameTeam(g.home, r.away))));
                const all = [...games, ...extra];
                return all.length ? all.map((g, i) => <GameRow key={i} g={g} />) : <p className="text-sm text-slate-400">No {level} games that week.</p>;
              })()}
            </div>
          )}

          {tab === 'standings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {view.standings?.divisions.length ? (
                view.standings.divisions.map((d) => (
                  <div key={d.name} className={card}>
                    <h4 className="font-black text-slate-100 mb-2">
                      {d.name} Division
                      {data?.standingsWeek && <span className="ml-2 text-xs font-bold text-slate-400">after week {data.standingsWeek}</span>}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700">
                            {['Team', 'W', 'L', 'T', 'Pct', 'Overall', 'Pct'].map((h, i) => <th key={i} className={th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {d.rows.map((r) => (
                            <tr key={r.team} className={`border-b border-slate-700/60 last:border-0 ${sameTeam(r.team, ourName) ? 'bg-amber-500/10' : ''}`}>
                              <td className={`${td} ${hl(r.team)}`}>
                                <button onClick={() => openTeam(r.team)} className="hover:underline text-left" title={`See ${r.team}'s games and scores`}>
                                  {r.team}
                                </button>
                              </td>
                              <td className={`${td} text-slate-100`}>{r.w}</td>
                              <td className={`${td} text-slate-100`}>{r.l}</td>
                              <td className={`${td} text-slate-100`}>{r.t}</td>
                              <td className={`${td} text-slate-300`}>{r.pct}</td>
                              <td className={`${td} text-slate-100`}>{r.ow}-{r.ol}{r.ot ? `-${r.ot}` : ''}</td>
                              <td className={`${td} text-slate-300`}>{r.opct}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`${card} text-sm text-slate-400`}>No {level} standings posted yet.</div>
              )}
            </div>
          )}

          {tab === 'club' && clubView && (
            <div className={card}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-xs">
                <label className="flex items-center gap-2">
                  <span className="font-bold text-slate-300">Club</span>
                  <select
                    value={clubs.find((c) => sameTeam(c, club)) || club}
                    onChange={(e) => setPickedClub(e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-100"
                  >
                    {clubs.map((c) => (
                      <option key={c} value={c}>
                        {c}
                        {sameTeam(c, ourName) ? ' (us)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-slate-300">
                  Every level <b className="text-white text-base tabular-nums">{clubView.total.w}-{clubView.total.l}{clubView.total.t ? `-${clubView.total.t}` : ''}</b>
                </span>
              </div>
              {clubView.levels.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {['Level', 'Record', 'Division', 'Pts for', 'Pts against'].map((h) => (
                          <th key={h} className={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clubView.levels.map((r) => (
                        <tr key={r.level} className={`border-b border-slate-700/60 ${sameLevel(r.level, level) && sameTeam(club, ourName) ? 'bg-amber-500/10' : ''}`}>
                          <td className={`${td} font-black text-slate-100`}>{r.level}</td>
                          <td className={`${td} font-black text-white`}>
                            {r.w}-{r.l}{r.t ? `-${r.t}` : ''}
                            {!r.fromStandings && <span className="ml-1 text-[10px] font-semibold text-slate-400" title="Not in the standings: counted from the posted scores">scores</span>}
                          </td>
                          <td className={`${td} text-slate-300`}>{r.div ? `${r.div.w}-${r.div.l}${r.div.t ? `-${r.div.t}` : ''} ${r.division || ''}` : '–'}</td>
                          <td className={`${td} text-slate-300`}>{r.pf}</td>
                          <td className={`${td} text-slate-300`}>{r.pa}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-500">
                        <td className={`${td} font-black text-white`}>All levels</td>
                        <td className={`${td} font-black text-white`}>{clubView.total.w}-{clubView.total.l}{clubView.total.t ? `-${clubView.total.t}` : ''}</td>
                        <td className={td} />
                        <td className={`${td} font-black text-white`}>{clubView.total.pf}</td>
                        <td className={`${td} font-black text-white`}>{clubView.total.pa}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Records are the standings' overall records{data?.standingsWeek ? ` after week ${data.standingsWeek}` : ''} (every game). Points are from the scores the league posted, so a week without results isn't in them.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No games for {club} in the league files.</p>
              )}
            </div>
          )}

          {tab === 'schedule' && (
            <div className={card}>
              {weeks.map((w) => (
                <div key={w} className="mb-3 last:mb-0">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-400 mb-1">
                    Week {w}
                    {view.byes.filter((b) => b.week === w).length > 0 && (
                      <span className="ml-2 normal-case font-bold">Bye: {view.byes.filter((b) => b.week === w).map((b) => b.team).join(', ')}</span>
                    )}
                  </div>
                  {view.schedule.filter((g) => g.week === w).map((g, i) => <GameRow key={i} g={g} />)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
