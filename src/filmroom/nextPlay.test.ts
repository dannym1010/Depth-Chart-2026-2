import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filledFrom, followOn, nextPlayFrom } from './nextPlay.ts';
import { applyBreakdown, blankPlays, breakdownRowOf, type BreakdownRow } from './breakdownEntry.ts';
import type { FilmClip } from './types.ts';
import type { Play } from '../hudlScout/types/football.ts';

describe('the next play from this one, by the rules', () => {
  it('a short gain: the next down, the yards still to go, the new spot', () => {
    assert.deepEqual(nextPlayFrom({ QTR: '2', ODK: 'O', DN: '2', DIST: '6', 'YARD LN': '-35', 'GN/LS': '4', RESULT: 'Rush' }), {
      QTR: '2', ODK: 'O', DN: '3', DIST: '2', 'YARD LN': '-39',
    });
    // A loss and an incomplete pass.
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '1', DIST: '10', 'YARD LN': '-20', 'GN/LS': '-3', RESULT: 'Rush' }), { ODK: 'O', DN: '2', DIST: '13', 'YARD LN': '-17' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '7', 'YARD LN': '+40', 'GN/LS': '0', RESULT: 'Incomplete' }), { ODK: 'O', DN: '3', DIST: '7', 'YARD LN': '+40' });
  });

  it('across the 50, and the yard line written the way the play wrote it', () => {
    assert.deepEqual(nextPlayFrom({ ODK: 'D', DN: '2', DIST: '7', 'YARD LN': '-40', 'GN/LS': '13', RESULT: 'Rush' }), { ODK: 'D', DN: '1', DIST: '10', 'YARD LN': '+47' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '3', DIST: '2', 'YARD LN': '-48', 'GN/LS': '2', RESULT: 'Rush' }), { ODK: 'O', DN: '1', DIST: '10', 'YARD LN': '50' });
    // Hudl's plain number for the other team's side stays plain; OWN / OPP stays OWN / OPP.
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '1', DIST: '10', 'YARD LN': '35', 'GN/LS': '4', RESULT: 'Rush' }), { ODK: 'O', DN: '2', DIST: '6', 'YARD LN': '31' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '1', DIST: '10', 'YARD LN': 'OWN 45', 'GN/LS': '9', RESULT: 'Complete' }), { ODK: 'O', DN: '2', DIST: '1', 'YARD LN': 'OPP 46' });
  });

  it('a first down inside the 10 is 1st & goal; the line to gain is never past the goal line', () => {
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '3', DIST: '4', 'YARD LN': '+12', 'GN/LS': '6', RESULT: 'Rush' }), { ODK: 'O', DN: '1', DIST: '6', 'YARD LN': '+6' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '1', DIST: '6', 'YARD LN': '+6', 'GN/LS': '-2', RESULT: 'Rush' }), { ODK: 'O', DN: '2', DIST: '8', 'YARD LN': '+8' });
    // Written as 1st & 10 at the 8: 2 yards later it's 2nd & goal from the 6, not 2nd & 8.
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '1', DIST: '10', 'YARD LN': '+8', 'GN/LS': '2', RESULT: 'Rush' }), { ODK: 'O', DN: '2', DIST: '6', 'YARD LN': '+6' });
  });

  it('short on 4th down: the other team, first and ten, the spot from their side', () => {
    assert.deepEqual(nextPlayFrom({ QTR: '3', ODK: 'O', DN: '4', DIST: '3', 'YARD LN': '+30', 'GN/LS': '1', RESULT: 'Rush' }), {
      QTR: '3', ODK: 'D', DN: '1', DIST: '10', 'YARD LN': '-29',
    });
    assert.deepEqual(nextPlayFrom({ ODK: 'D', DN: '4', DIST: '8', 'YARD LN': 'OWN 45', 'GN/LS': '-5', RESULT: 'Sack' }), { ODK: 'O', DN: '1', DIST: '10', 'YARD LN': 'OPP 40' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '4', DIST: '2', 'YARD LN': '+40', 'GN/LS': '1', RESULT: 'Turnover on downs' }), { ODK: 'D', DN: '1', DIST: '10', 'YARD LN': '-39' });
  });

  it('without an ODK: the down, distance and spot still follow (who has the ball is left)', () => {
    assert.deepEqual(nextPlayFrom({ DN: '2', DIST: '5', 'YARD LN': '-30', 'GN/LS': '7', RESULT: 'Complete' }), { DN: '1', DIST: '10', 'YARD LN': '-37' });
    assert.deepEqual(nextPlayFrom({ DN: '4', DIST: '5', 'YARD LN': '-30', 'GN/LS': '2', RESULT: 'Rush' }), { DN: '1', DIST: '10', 'YARD LN': '+32' });
  });

  it('after a kickoff or a punt: the other side of the ball, first and ten (the spot is the return)', () => {
    assert.deepEqual(nextPlayFrom({ QTR: '1', ODK: 'K', 'PLAY TYPE': 'KO', RESULT: 'Return' }), { QTR: '1', ODK: 'D', DN: '1', DIST: '10' });
    assert.deepEqual(nextPlayFrom({ ODK: 'K', 'PLAY TYPE': 'Punt Rec', RESULT: 'Fair catch' }), { ODK: 'O', DN: '1', DIST: '10' });
    assert.deepEqual(nextPlayFrom({ ODK: 'K', 'PLAY TYPE': 'KO Rec', RESULT: 'Return' }), { ODK: 'O', DN: '1', DIST: '10' });
    // Anything unusual on the kick, or a kick that isn't a kickoff or punt, is left.
    assert.deepEqual(nextPlayFrom({ QTR: '2', ODK: 'K', 'PLAY TYPE': 'KO', RESULT: 'Onside' }), { QTR: '2' });
    assert.deepEqual(nextPlayFrom({ ODK: 'K', 'PLAY TYPE': 'Punt', RESULT: 'Muffed' }), {});
    assert.deepEqual(nextPlayFrom({ ODK: 'K', 'PLAY TYPE': 'FG', RESULT: 'No Good' }), {});
    assert.deepEqual(nextPlayFrom({ QTR: '2', ODK: 'K', RESULT: 'Punt' }), { QTR: '2' });
  });

  it("leaves what the rules can't know: scores, tries, penalties, turnovers, non-plays, missing numbers", () => {
    assert.deepEqual(nextPlayFrom({ QTR: '1', ODK: 'O', DN: '1', DIST: '10', 'YARD LN': '+8', 'GN/LS': '8', RESULT: 'Rush, TD' }), { QTR: '1' });
    assert.deepEqual(nextPlayFrom({ QTR: '2', ODK: 'O', DN: '2', DIST: '10', 'YARD LN': '-2', 'GN/LS': '-3', RESULT: 'Rush, Safety' }), { QTR: '2' });
    assert.deepEqual(nextPlayFrom({ QTR: '4', ODK: 'K', 'PLAY TYPE': 'PAT', RESULT: 'Good' }), { QTR: '4' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', 'PLAY TYPE': '2 Pt', RESULT: 'Rush' }), {});
    // Penalties, however they're written.
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '5', 'YARD LN': '-30', 'GN/LS': '-10', RESULT: 'Penalty' }), { ODK: 'O' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '5', 'YARD LN': '-30', 'GN/LS': '-10', RESULT: 'Holding' }), { ODK: 'O' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '5', 'YARD LN': '-30', 'GN/LS': '9', RESULT: 'Rush, PEN' }), { ODK: 'O' });
    // Turnovers: an interception is the other team's 1st & 10; a fumble, or a flag on the pick, is left.
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '5', 'YARD LN': '-30', 'GN/LS': '0', RESULT: 'Interception' }), { ODK: 'D', DN: '1', DIST: '10' });
    assert.deepEqual(nextPlayFrom({ QTR: '3', ODK: 'O', DN: '2', DIST: '5', 'YARD LN': '-30', 'GN/LS': '0', RESULT: 'Interception, Penalty' }), { QTR: '3' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '5', 'YARD LN': '-30', 'GN/LS': '3', RESULT: 'Rush, Fumble' }), {});
    // Not a play.
    assert.deepEqual(nextPlayFrom({ QTR: '2', ODK: 'S' }), { QTR: '2' });
    // Missing or odd numbers.
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '5', 'GN/LS': '3', RESULT: 'Rush' }), { ODK: 'O' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '5', 'YARD LN': '-30', RESULT: 'Rush' }), { ODK: 'O' });
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '2', DIST: '5', 'YARD LN': '-30', 'GN/LS': '2.5', RESULT: 'Rush' }), { ODK: 'O' });
    // Past the goal line without the result saying so: left for the coach.
    assert.deepEqual(nextPlayFrom({ ODK: 'O', DN: '1', DIST: '10', 'YARD LN': '+5', 'GN/LS': '7', RESULT: 'Rush' }), { ODK: 'O' });
  });
});

describe('saving a play starts the next snap', () => {
  const clips: FilmClip[] = [1, 2, 3, 4].map((n) => ({ kind: 'drive' as const, id: `c${n}`, name: `IMG_000${n}.mp4` }));
  const game = (id = 'g1') => blankPlays(clips, id);
  /** Saving `row` on play `n` the way the Film Room does: the play, and whatever follows on the next snap. */
  const save = (plays: Play[], n: number, row: BreakdownRow) => {
    const p = plays.find((x) => x.playNumber === n)!;
    const follow = followOn(plays, p, row);
    return plays.map((x) => (x.id === p.id ? applyBreakdown(x, row) : follow && x.id === follow.play.id ? applyBreakdown(x, follow.row) : x));
  };
  const rowAt = (plays: Play[], n: number) => breakdownRowOf(plays.find((x) => x.playNumber === n)!);
  const first: BreakdownRow = { QTR: '1', ODK: 'O', DN: '1', DIST: '10', 'YARD LN': '-30', 'GN/LS': '4', RESULT: 'Rush' };

  it('fills a blank next snap, and a correction here carries on to it', () => {
    let plays = save(game(), 1, first);
    assert.deepEqual(rowAt(plays, 2), { ODK: 'O', QTR: '1', DN: '2', DIST: '6', 'YARD LN': '-34', 'GN/LS': '0' });
    // The breakdown can say where play 2's numbers came from (play 1 has nothing before it).
    assert.equal(filledFrom(plays, plays[1]), 1);
    assert.equal(filledFrom(plays, plays[0]), undefined);
    plays = save(plays, 1, { ...first, 'GN/LS': '6' });
    assert.deepEqual(rowAt(plays, 2), { ODK: 'O', QTR: '1', DN: '2', DIST: '4', 'YARD LN': '-36', 'GN/LS': '0' });
    // The same answer again changes nothing; nothing to fill in never clears it.
    assert.equal(followOn(plays, plays[0], { ...first, 'GN/LS': '6' }), undefined);
    assert.equal(followOn(plays, plays[0], { ODK: 'O', RESULT: 'Fumble' }), undefined);
  });

  it('never changes a next snap that a coach (or the AI window) entered', () => {
    let plays = save(game(), 1, first);
    plays = save(plays, 2, { ...rowAt(plays, 2), 'GN/LS': '3', RESULT: 'Rush' });
    plays = save(plays, 1, { ...first, 'GN/LS': '6' });
    assert.equal(rowAt(plays, 2)['YARD LN'], '-34');
    assert.equal(rowAt(plays, 2)['GN/LS'], '3');
    assert.equal(filledFrom(plays, plays[1]), undefined);
    // Play 2's own save started play 3.
    assert.deepEqual(rowAt(plays, 3), { ODK: 'O', QTR: '1', DN: '3', DIST: '3', 'YARD LN': '-37', 'GN/LS': '0' });
  });

  it('a clip marked S passes the situation on, and a correction goes past it', () => {
    let plays = save(game(), 1, { QTR: '2', ODK: 'O', DN: '2', DIST: '6', 'YARD LN': '-35', 'GN/LS': '4', RESULT: 'Rush' });
    // Clip 2 is the scoreboard.
    plays = save(plays, 2, { ...rowAt(plays, 2), ODK: 'S' });
    assert.deepEqual(rowAt(plays, 3), { ODK: 'O', QTR: '2', DN: '3', DIST: '2', 'YARD LN': '-39', 'GN/LS': '0' });
    assert.equal(filledFrom(plays, plays[2]), 1);
    assert.equal(filledFrom(plays, plays[1]), undefined);
    plays = save(plays, 1, { QTR: '2', ODK: 'O', DN: '2', DIST: '6', 'YARD LN': '-35', 'GN/LS': '7', RESULT: 'Rush' });
    assert.deepEqual(rowAt(plays, 3), { ODK: 'O', QTR: '2', DN: '1', DIST: '10', 'YARD LN': '-42', 'GN/LS': '0' });
  });

  it('stays in its own game, and the last snap has nothing after it', () => {
    const two = [...game('g1'), ...game('g2')];
    const p1 = two.find((p) => p.gameId === 'g1' && p.playNumber === 1)!;
    const f = followOn(two, p1, first);
    assert.equal(f?.play.gameId, 'g1');
    assert.equal(f?.play.playNumber, 2);
    const last = two.find((p) => p.gameId === 'g1' && p.playNumber === 4)!;
    assert.equal(followOn(two, last, first), undefined);
  });
});
