import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { playoffPicture } from './playoffs.ts';

const row = (team: string, w: number, l: number, ow = w, ol = l) => ({ team, w, l, t: 0, pct: '', ow, ol, ot: 0, opct: '' });
const game = (week: string, home: string, away: string, hs?: number, as?: number) => ({ week, date: '', level: '10U', home, away, location: '', time: '', ...(hs != null ? { homeScore: hs, awayScore: as } : {}) });

describe('playoff picture (TYFC post-season rules)', () => {
  const standings = {
    level: '10U',
    divisions: [
      { name: 'North West', rows: [row('A', 3, 0), row('B', 2, 1), row('C', 1, 2), row('D', 0, 3)] },
      { name: 'South East', rows: [row('E', 3, 0), row('F', 1, 2), row('G', 1, 2), row('H', 0, 3)] },
    ],
  };
  // G beat F head to head; the week 8 games are still to play.
  const results = [game('2', 'G', 'F', 14, 7)];
  const schedule = [game('8', 'A', 'B'), game('8', 'E', 'H'), game('8', 'F', 'G')];

  it('seeds each conference, breaks ties head to head, and makes the matchups', () => {
    const p = playoffPicture({ level: '10U', standings, schedule, results, standingsWeek: '7', ourTeam: 'B' })!;
    assert.equal(p.format, '9U-11U');
    const se = p.groups.find((g) => g.name === 'SE')!;
    assert.deepEqual(se.teams.map((t) => t.team), ['E', 'G', 'F', 'H']);
    assert.equal(se.teams[1].tiebreak, 'head to head');
    const semis = p.matchups.find((m) => m.round === 'TYF semis')!;
    assert.deepEqual(semis.games, [{ a: 'A', b: 'G' }, { a: 'E', b: 'B' }]);
  });

  it("counts every way the games left can go, and shows our team's seed with a win and a loss", () => {
    const p = playoffPicture({ level: '10U', standings, schedule, results, standingsWeek: '7', ourTeam: 'B' })!;
    assert.equal(p.remaining.length, 3);
    assert.ok(p.exhaustive);
    // B beats A: both 3-1, B won head to head -> #1. B loses: #2.
    assert.deepEqual(p.ours!.win.seeds, { 1: 1 });
    assert.deepEqual(p.ours!.loss.seeds, { 2: 1 });
    const b = p.chances.find((c) => c.team === 'B')!;
    assert.equal(b.bracket['TYF semis'], 1);
    // F and G play: the winner is #2 SE (TYF semis), the loser #3 (Orange Bowl).
    const f = p.chances.find((c) => c.team === 'F')!;
    assert.equal(f.bracket['TYF semis'], 0.5);
    assert.equal(f.bracket['Orange Bowl'], 0.5);
  });

  it('12U-13U: one table by overall record, #9 season over', () => {
    const teams = 'ABCDEFGHI'.split('');
    const st = { level: '12U', divisions: [{ name: 'All teams', rows: teams.map((t, i) => row(t, 8 - i, i)) }] };
    const p = playoffPicture({ level: '12U', standings: st, schedule: [], results: [], standingsWeek: '8', ourTeam: 'I' })!;
    assert.equal(p.format, '12U-13U');
    assert.deepEqual(p.matchups[0].games, [{ a: 'A', b: 'D' }, { a: 'B', b: 'C' }]);
    assert.deepEqual(p.matchups[1].games, [{ a: 'E', b: 'H' }, { a: 'F', b: 'G' }]);
    assert.equal(p.chances.find((c) => c.team === 'I')!.bracket['Season over'], 1);
  });
});
