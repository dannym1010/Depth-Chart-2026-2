// The league page's Playoffs and Rules tabs: the playoff picture if the season ended today, every team's chances
// from the games left, where our team lands with a win or a loss, and the league's post-season rules.
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { sameTeam } from '../utils/leagueParse';
import { BRACKETS, POSTSEASON_RULES, playoffFormat, type Bracket, type Dist, type PlayoffPicture } from '../utils/playoffs';

const card = 'bg-slate-800/90 rounded-2xl border border-slate-700/80 p-4';
const RULES_PAGE = 'https://www.taconicyfc.com/Default.aspx?tabid=1498805';

const BRACKET_STYLE: Record<Bracket, string> = {
  'TYF semis': 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  'Orange Bowl': 'bg-orange-500/20 text-orange-200 border-orange-500/40',
  'Friendship game': 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  'Season over': 'bg-slate-700/60 text-slate-300 border-slate-600',
};
const BAR: Record<Bracket, string> = { 'TYF semis': 'bg-emerald-500', 'Orange Bowl': 'bg-orange-500', 'Friendship game': 'bg-sky-500', 'Season over': 'bg-slate-500' };

const pct = (v: number) => (v >= 0.995 ? '100%' : v <= 0.005 ? '—' : `${Math.round(v * 100)}%`);

/** Who a seed plays in the first round (the league's matchups). */
function opponentOf(format: PlayoffPicture['format'], seed: number, group: string): string {
  if (format === '12U-13U') {
    const opp: Record<number, number> = { 1: 4, 2: 3, 3: 2, 4: 1, 5: 8, 6: 7, 7: 6, 8: 5 };
    return opp[seed] ? `#${opp[seed]}` : '';
  }
  const other = group === 'NW' ? 'SE' : 'NW';
  const opp: Record<number, number> = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 5, 6: 6 };
  return opp[seed] ? `#${opp[seed]} ${other}` : '';
}

function bracketOfSeed(format: PlayoffPicture['format'], seed: number, picture: PlayoffPicture): Bracket {
  if (format === '12U-13U') return seed <= 4 ? 'TYF semis' : seed <= 8 ? 'Orange Bowl' : 'Season over';
  if (seed <= 2) return 'TYF semis';
  if (seed <= 4) return 'Orange Bowl';
  if (seed === 5) return 'Friendship game';
  if (seed === 6 && picture.groups.every((g) => g.teams.length >= 6)) return 'Friendship game';
  return 'Season over';
}

const Tag: React.FC<{ b: Bracket }> = ({ b }) => <span className={`inline-block px-1.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide ${BRACKET_STYLE[b]}`}>{b}</span>;

/** Where a team ends up: each seed it can get, with how likely. */
const Outcome: React.FC<{ title: string; d: Dist; format: PlayoffPicture['format']; group: string; picture: PlayoffPicture; tone: string }> = ({ title, d, format, group, picture, tone }) => {
  const seeds = Object.entries(d.seeds)
    .map(([s, p]) => ({ seed: Number(s), p }))
    .filter((x) => x.p > 0.001)
    .sort((a, b) => a.seed - b.seed);
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="text-xs font-black uppercase tracking-wide mb-1.5">{title}</div>
      <ul className="space-y-1">
        {seeds.map(({ seed, p }) => {
          const b = bracketOfSeed(format, seed, picture);
          const opp = b === 'Season over' ? '' : opponentOf(format, seed, group);
          return (
            <li key={seed} className="flex flex-wrap items-center gap-2 text-sm">
              <b className="text-white">
                #{seed}
                {format === '9U-11U' ? ` ${group}` : ''}
              </b>
              <Tag b={b} />
              {opp && <span className="text-slate-300 text-xs">vs {opp}</span>}
              {seeds.length > 1 && <span className="ml-auto text-xs text-slate-400 tabular-nums">{pct(p)} of the ways</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const LeaguePlayoffs: React.FC<{ picture: PlayoffPicture | null; level: string; ourTeam: string; standingsWeek?: string }> = ({ picture, level, ourTeam, standingsWeek }) => {
  if (!picture) {
    return (
      <div className={`${card} text-sm text-slate-400`}>
        {playoffFormat(level) ? `No ${level} standings posted yet, so there's no playoff picture.` : `The league's post-season rules cover 9U to 13U; there's no ${level} playoff picture.`}
      </div>
    );
  }
  const { format } = picture;
  const ours = picture.chances.find((c) => sameTeam(c.team, ourTeam));
  const ourGame = picture.ours?.game;
  return (
    <div className="space-y-4">
      {/* Our team: with a win, with a loss */}
      {ours && (
        <div className={card}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
            <h4 className="font-black text-slate-100">{ourTeam}</h4>
            {ourGame ? (
              <span className="text-xs text-slate-400">
                Next: Week {ourGame.week} {sameTeam(ourGame.home, ourTeam) ? `vs ${ourGame.away}` : `@ ${ourGame.home}`} · {ourGame.date}
              </span>
            ) : (
              <span className="text-xs text-slate-400">No regular season games left</span>
            )}
          </div>
          {picture.ours ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <Outcome title={`With a win`} d={picture.ours.win} format={format} group={ours.group} picture={picture} tone="border-emerald-500/40 bg-emerald-500/5 text-emerald-200" />
              <Outcome title={`With a loss`} d={picture.ours.loss} format={format} group={ours.group} picture={picture} tone="border-rose-500/40 bg-rose-500/5 text-rose-200" />
            </div>
          ) : (
            <Outcome title="Where we finish" d={ours} format={format} group={ours.group} picture={picture} tone="border-slate-600 text-slate-200" />
          )}
          {picture.ours && (
            <p className="mt-2 text-[11px] text-slate-400">
              Seeds depend on the other games too: when there's more than one, it shows how many of the ways the other games can go end that way.
            </p>
          )}
        </div>
      )}

      {/* If the season ended today */}
      <div className={card}>
        <h4 className="font-black text-slate-100 mb-1">If the season ended today</h4>
        <p className="text-xs text-slate-400 mb-3">
          {format === '9U-11U' ? 'Seeded in each conference by conference record' : 'Seeded by overall record'}
          {standingsWeek ? ` (standings after week ${standingsWeek})` : ''}; ties broken by the league&apos;s tie-breakers (see Rules).
        </p>
        <div className={`grid gap-4 ${picture.groups.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {picture.groups.map((g) => (
            <table key={g.name} className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-700">
                  <th className="text-left font-black py-1 w-8">{g.name === 'All teams' ? '' : g.name}</th>
                  <th className="text-left font-black py-1">Team</th>
                  <th className="text-right font-black py-1">{format === '9U-11U' ? 'Conf' : 'Record'}</th>
                  {format === '9U-11U' && <th className="text-right font-black py-1">Overall</th>}
                  <th className="text-right font-black py-1 pl-2">Goes to</th>
                </tr>
              </thead>
              <tbody>
                {g.teams.map((t) => (
                  <tr key={t.team} className={`border-b border-slate-700/50 ${sameTeam(t.team, ourTeam) ? 'bg-amber-500/10' : ''}`}>
                    <td className="py-1.5 font-black text-slate-300 tabular-nums">#{t.seed}</td>
                    <td className={`py-1.5 ${sameTeam(t.team, ourTeam) ? 'text-amber-300 font-black' : 'text-slate-100 font-semibold'}`}>
                      {t.team}
                      {t.tiebreak && <span className="ml-1.5 text-[10px] font-semibold text-slate-400">({t.tiebreak === 'coin flip' ? 'tied: coin flip if it stays' : `by ${t.tiebreak}`})</span>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-200">{t.record}</td>
                    {format === '9U-11U' && <td className="py-1.5 text-right tabular-nums text-slate-400">{t.overall}</td>}
                    <td className="py-1.5 text-right pl-2">
                      <Tag b={bracketOfSeed(format, t.seed, picture)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          {picture.matchups.map((m) => (
            <div key={m.round} className="rounded-xl border border-slate-700 p-2.5">
              <div className="mb-1">
                <Tag b={m.round} />
              </div>
              {m.games.map((x, i) => (
                <div key={i} className="text-sm text-slate-100">
                  <span className={sameTeam(x.a, ourTeam) ? 'text-amber-300 font-black' : ''}>{x.a}</span> <span className="text-slate-500">vs</span>{' '}
                  <span className={sameTeam(x.b, ourTeam) ? 'text-amber-300 font-black' : ''}>{x.b}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Chances */}
      <div className={card}>
        <h4 className="font-black text-slate-100 mb-1">Playoff chances</h4>
        <p className="text-xs text-slate-400 mb-3">
          {picture.remaining.length
            ? `${picture.exhaustive ? 'Every way' : 'A large sample of the ways'} the ${picture.remaining.length} game${picture.remaining.length === 1 ? '' : 's'} left can go (each team as likely to win as lose; ties not counted).`
            : 'The regular season is over: these are the final seeds.'}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-700">
                <th className="text-left font-black py-1">Team</th>
                {BRACKETS.map((b) => (
                  <th key={b} className="text-right font-black py-1">
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...picture.chances]
                .sort((a, b) => a.group.localeCompare(b.group) || b.bracket['TYF semis'] - a.bracket['TYF semis'] || b.bracket['Orange Bowl'] - a.bracket['Orange Bowl'])
                .map((c) => (
                  <tr key={c.team} className={`border-b border-slate-700/50 ${sameTeam(c.team, ourTeam) ? 'bg-amber-500/10' : ''}`}>
                    <td className={`py-1.5 ${sameTeam(c.team, ourTeam) ? 'text-amber-300 font-black' : 'text-slate-100 font-semibold'}`}>
                      {c.team}
                      {format === '9U-11U' && <span className="ml-1.5 text-[10px] text-slate-400">{c.group}</span>}
                    </td>
                    {BRACKETS.map((b) => (
                      <td key={b} className="py-1.5 text-right tabular-nums text-slate-200">
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          {c.bracket[b] > 0.005 && <span className={`h-1.5 rounded-full ${BAR[b]}`} style={{ width: `${Math.max(4, c.bracket[b] * 44)}px` }} />}
                          {pct(c.bracket[b])}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {picture.remaining.length > 0 && (
          <div className="mt-3 text-xs text-slate-400">
            <span className="font-bold text-slate-300">Games left: </span>
            {picture.remaining.map((g, i) => (
              <span key={i}>
                {i ? ' · ' : ''}W{g.week} {g.away} @ {g.home}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const LeagueRules: React.FC<{ level: string }> = ({ level }) => {
  const n = Number((level.match(/\d+/) || [])[0]) || 0;
  const mine = (levels: string) => {
    const [a, b] = levels.match(/\d+/g)!.map(Number);
    return n >= a && n <= b;
  };
  const rules = [...POSTSEASON_RULES].sort((a, b) => Number(mine(b.levels)) - Number(mine(a.levels)));
  return (
    <div className="space-y-4">
      <div className={`${card} text-sm text-slate-300`}>
        <h4 className="font-black text-slate-100">Post-season tie-breaking & matchups by seeding</h4>
        <p className="text-xs text-slate-400 mt-1">
          Questions go to your program directors / TYFC General Board member.{' '}
          <a href={RULES_PAGE} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline inline-flex items-center gap-0.5">
            Full TYFC rules <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>
      {rules.map((r) => (
        <div key={r.levels} className={`${card} ${mine(r.levels) ? 'ring-1 ring-amber-500/50' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-black text-slate-100">{r.levels}</h4>
            {mine(r.levels) && <span className="text-[10px] font-black uppercase tracking-wide text-amber-300">your level</span>}
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-slate-400 mb-1">{r.tiebreakTitle}</div>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-200">
                {r.tiebreakers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
              {r.note && <p className="mt-1 text-xs text-slate-400">{r.note}</p>}
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-slate-400 mb-1">Post-season matchups</div>
              <ul className="space-y-1 text-slate-200">
                {r.matchups.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
