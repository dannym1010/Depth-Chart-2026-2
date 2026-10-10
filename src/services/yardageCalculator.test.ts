import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAbsoluteYard,
  formatAbsoluteYard,
  calculateNetGain,
  crossCheckPlayYardage,
} from './yardageCalculator.ts';
import { sanitizeAiResult, simulateLocalAiBreakdown } from './geminiFilmService.ts';

describe('yardageCalculator', () => {
  it('correctly parses absolute yard line values', () => {
    assert.equal(parseAbsoluteYard('-35'), 35); // OWN 35
    assert.equal(parseAbsoluteYard('OWN 20'), 20);
    assert.equal(parseAbsoluteYard('50'), 50); // Midfield
    assert.equal(parseAbsoluteYard('+40'), 60); // OPP 40
    assert.equal(parseAbsoluteYard('OPP 30'), 70);
    assert.equal(parseAbsoluteYard('+10'), 90); // OPP 10
  });

  it('correctly formats absolute yard coordinates', () => {
    assert.equal(formatAbsoluteYard(35, 'hudl'), '-35');
    assert.equal(formatAbsoluteYard(50, 'hudl'), '50');
    assert.equal(formatAbsoluteYard(65, 'hudl'), '+35');
    assert.equal(formatAbsoluteYard(35, 'full'), 'OWN 35');
    assert.equal(formatAbsoluteYard(50, 'full'), '50');
    assert.equal(formatAbsoluteYard(65, 'full'), 'OPP 35');
  });

  it('calculates net gain correctly across the 50 yard line and in opponent territory', () => {
    // OWN 45 (-45) to OPP 45 (+45): from 45 to 55 = +10
    assert.equal(calculateNetGain('-45', '+45'), 10);
    // Tackle for loss: OWN 35 to OWN 32 = -3
    assert.equal(calculateNetGain('-35', '-32'), -3);
    // In opponent territory: from OPP 40 (+40) to OPP 34 (+34) is +6 gain forward, NOT backwards!
    assert.equal(calculateNetGain('+40', '+34'), 6);
    assert.equal(calculateNetGain('OPP 40', 'OPP 34'), 6);
    // When next yard is unsigned '34', inherits opponent side from start:
    assert.equal(calculateNetGain('+40', '34'), 6);
  });

  it('verifies opponent territory forward progress in crossCheckPlayYardage', () => {
    const res = crossCheckPlayYardage({
      currentStartYard: '+40',
      currentWhistleYard: '+34',
      nextStartYard: '+34',
    });
    assert.equal(res.measuredGain, 6);
    assert.equal(res.isAligned, true);
    assert.equal(res.discrepancyYards, 0);
  });

  it('verifies aligned plays with no discrepancy', () => {
    const res = crossCheckPlayYardage({
      currentStartYard: '-35',
      currentWhistleYard: '-41',
      nextStartYard: '-41',
    });
    assert.equal(res.measuredGain, 6);
    assert.equal(res.isAligned, true);
    assert.equal(res.discrepancyYards, 0);
    assert.equal(res.penaltySuspected, false);
  });

  it('detects a 10-yard offensive holding penalty discrepancy', () => {
    // Play whistled dead at OWN 45, but next play begins at OWN 35 (-10 yds)
    const res = crossCheckPlayYardage({
      currentStartYard: '-35',
      currentWhistleYard: '-45',
      nextStartYard: '-35',
    });
    assert.equal(res.measuredGain, 10);
    assert.equal(res.isAligned, false);
    assert.equal(res.discrepancyYards, -10);
    assert.equal(res.penaltySuspected, true);
    assert.equal(res.penaltyOn, 'Offense');
    assert.match(res.penaltySuggestion || '', /Holding|Block in Back/);
  });

  it('detects a 5-yard defensive encroachment/offside discrepancy', () => {
    // Play whistled dead at OWN 35, but next play begins at OWN 40 (+5 yds)
    const res = crossCheckPlayYardage({
      currentStartYard: '-30',
      currentWhistleYard: '-35',
      nextStartYard: '-40',
    });
    assert.equal(res.measuredGain, 5);
    assert.equal(res.isAligned, false);
    assert.equal(res.discrepancyYards, 5);
    assert.equal(res.penaltySuspected, true);
    assert.equal(res.penaltyOn, 'Defense');
    assert.match(res.penaltySuggestion || '', /Offside|Encroachment/);
  });

  it('handles scout games by strictly keeping players unlinked', () => {
    const mockRoster = [
      { id: 'p1', num: '21', firstName: 'Nash', lastName: 'Ward', positions: ['RB'] },
      { id: 'p2', num: '52', firstName: 'Jaxson', lastName: 'Pestone', positions: ['MLB'] },
    ];

    const result = simulateLocalAiBreakdown(
      [],
      { id: 'p1', playNumber: 1, rawYardLine: '-30' } as any,
      mockRoster as any,
      ['21 Pro I'],
      ['Power'],
      {
        gameType: 'scout_game',
        offenseTeam: 'Opponent Offense',
        defenseTeam: 'Opponent Defense',
        linkOurRoster: false,
      }
    );

    // Scout game MUST NOT link Nash Ward or Jaxson Pestone to the play!
    assert.ok(result.carrierName?.startsWith('#'), `Carrier name must be jersey number only: ${result.carrierName}`);
    assert.ok(!result.carrierName?.includes('Nash'), 'Must not contain Mahopac roster player name');
    assert.ok(!result.carrierName?.includes('Ward'), 'Must not contain Mahopac roster player name');
    if (result.tacklerNames && result.tacklerNames.length > 0) {
      assert.ok(!result.tacklerNames[0].includes('Jaxson'), 'Must not link defensive player name');
    }
  });

  it('tags ODK as O when scouted team is on offense and D when scouted team is on defense', () => {
    // 1. Scouted team is Carmel. Carmel is on OFFENSE -> ODK must be 'O'
    const offenseResult = simulateLocalAiBreakdown(
      [],
      { id: 'p1', playNumber: 1, rawYardLine: '-25' } as any,
      [],
      [],
      [],
      {
        gameType: 'scout_game',
        scoutedTeam: 'Carmel 10U',
        offenseTeam: 'Carmel 10U',
        defenseTeam: 'Somers 10U',
        linkOurRoster: false,
      }
    );
    assert.equal(offenseResult.odk, 'O', 'When scouted team is on offense, ODK must be O');

    // 2. Scouted team is Carmel. Carmel is on DEFENSE (Somers is on offense) -> ODK must be 'D'
    const defenseResult = simulateLocalAiBreakdown(
      [],
      { id: 'p2', playNumber: 2, rawYardLine: '-35' } as any,
      [],
      [],
      [],
      {
        gameType: 'scout_game',
        scoutedTeam: 'Carmel 10U',
        offenseTeam: 'Somers 10U',
        defenseTeam: 'Carmel 10U',
        linkOurRoster: false,
      }
    );
    assert.equal(defenseResult.odk, 'D', 'When scouted team is on defense, ODK must be D');
  });

  it("reads Hudl's plain yard lines as the far side (the team with the ball's opponent's)", () => {
    assert.equal(parseAbsoluteYard('35'), 65);
    assert.equal(parseAbsoluteYard('-35'), 35);
    // From their 35 to their 30 is a 5-yard gain, not a loss.
    assert.equal(calculateNetGain('35', '30'), 5);
    assert.equal(crossCheckPlayYardage({ currentStartYard: '35', nextStartYard: '30', trust: 'spot' }).measuredGain, 5);
    // Our 45 to their 45.
    assert.equal(crossCheckPlayYardage({ currentStartYard: '-45', nextStartYard: '45', trust: 'spot' }).measuredGain, 10);
  });

  it('the next snap decides the gain over a film estimate, and says the film disagreed', () => {
    const res = crossCheckPlayYardage({ currentStartYard: '-30', currentGainLoss: 3, nextStartYard: '-38', trust: 'spot' });
    assert.equal(res.measuredGain, 8);
    assert.equal(res.gainSource, 'next snap');
    assert.equal(res.filmGain, 3);
    assert.equal(res.whistleFormatted, 'OWN 38');
    assert.equal(res.penaltySuspected, false);
  });

  it('a change of possession or no next play falls back to the film', () => {
    const turnover = crossCheckPlayYardage({ currentStartYard: '-30', currentGainLoss: 4, nextStartYard: '-20', currentOdk: 'O', nextOdk: 'D', trust: 'spot' });
    assert.equal(turnover.measuredGain, 4);
    assert.equal(turnover.gainSource, 'film');
    const last = crossCheckPlayYardage({ currentStartYard: '-30', currentGainLoss: 4, trust: 'spot' });
    assert.equal(last.measuredGain, 4);
    assert.equal(last.gainSource, 'film');
  });

  it('a touchdown gains the rest of the field', () => {
    const res = crossCheckPlayYardage({ currentStartYard: '22', currentGainLoss: 15, touchdown: true, trust: 'spot' });
    assert.equal(res.measuredGain, 22);
    assert.equal(res.gainSource, 'touchdown');
  });

  it("doesn't invent a start spot", () => {
    const res = crossCheckPlayYardage({ currentStartYard: '', currentGainLoss: 6, nextStartYard: '-40', trust: 'spot' });
    assert.equal(res.measuredGain, 6);
    assert.equal(res.gainSource, 'none');
  });
});

describe('cleaning up the AI answer', () => {
  const roster = [{ num: '21', firstName: 'Nash', lastName: 'Ward' }, { num: '52', firstName: 'Jax', lastName: 'P' }] as any;
  const play = { playNumber: 7, odk: 'O', rawYardLine: '35', quarter: 3, down: 2, distance: 6, result: 'Rush', rusher: '#21 Ward' } as any;

  it("keeps the play's Hudl facts, takes the end spot from the next snap, and names our carrier", () => {
    const r = sanitizeAiResult(
      { yardLine: '-40', quarter: 1, down: 1, distance: 10, gainLoss: 2, whistleYardLine: '33', carrierNum: '21', carrierConfidence: 90, tacklerNums: ['44'], tacklerConfidence: 80, result: 'Rush' },
      roster,
      { linkOurRoster: true, ourUnitRole: 'offense', currentStartYard: '35', nextPlayStartYard: '29', currentOdk: 'O', nextPlayOdk: 'O', play }
    );
    assert.equal(r.yardLine, '35');
    assert.equal(r.quarter, 3);
    assert.equal(r.down, 2);
    assert.equal(r.gainLoss, 6); // their 35 to their 29
    assert.equal(r.yardageSource, 'next snap');
    assert.equal(r.filmGain, 2);
    assert.equal(r.carrierName, '#21 Nash Ward');
    assert.deepEqual(r.tacklerNums, ['44']);
  });

  it("leaves unsure numbers blank, but keeps a carrier Hudl already had", () => {
    const r = sanitizeAiResult(
      { gainLoss: 4, carrierNum: '12', carrierConfidence: 30, tacklerNums: ['9'], tacklerConfidence: 20, result: 'Rush' },
      roster,
      { linkOurRoster: true, ourUnitRole: 'offense', currentStartYard: '35', currentOdk: 'O', play }
    );
    assert.equal(r.carrierNum, '21');
    assert.deepEqual(r.tacklerNums, []);
    assert.equal(r.yardageSource, 'film');
    assert.equal(r.gainLoss, 4);
  });

  it('a touchdown is the rest of the field; a flag means the film decides', () => {
    const td = sanitizeAiResult({ gainLoss: 20, result: 'Rush, TD' }, roster, { currentStartYard: '18', currentOdk: 'O', play: { ...play, rawYardLine: '18' } });
    assert.equal(td.gainLoss, 18);
    const flag = sanitizeAiResult({ gainLoss: 7, whistleYardLine: '28', penaltyDetected: true, result: 'Rush' }, roster, { currentStartYard: '35', nextPlayStartYard: '45', currentOdk: 'O', nextPlayOdk: 'O', play });
    assert.equal(flag.gainLoss, 7);
    assert.equal(flag.penaltyDetected, true);
  });

  it("keeps the play's Hudl tags and never invents a formation, play or result", () => {
    const tagged = { ...play, odk: 'D', formation: 'Trips Rt', playName: '34 Power', hash: 'L', direction: 'Right', playType: 'Run', result: 'Rush', backfield: 'Pro' };
    const r = sanitizeAiResult({ odk: 'O', formation: 'Spread', playName: 'Dive', hash: 'R', playDir: 'L', playType: 'Pass', result: 'Complete' }, roster, { currentStartYard: '35', play: tagged });
    assert.equal(r.odk, 'D');
    assert.equal(r.formation, 'Trips Rt');
    assert.equal(r.playName, '34 Power');
    assert.equal(r.hash, 'L');
    assert.equal(r.playDir, 'R');
    assert.equal(r.playType, 'Run');
    assert.equal(r.result, 'Rush');
    // A blank play and a blank answer stay blank (not "Pro I-Form" / "24 Blast" / "4-4 Stack").
    const blank = sanitizeAiResult({}, roster, { currentStartYard: '35', play: { playNumber: 1, rawYardLine: '35' } as any });
    assert.equal(blank.formation, '');
    assert.equal(blank.playName, '');
    assert.equal(blank.result, '');
    assert.equal(blank.hash, '');
    assert.equal(blank.defensiveFront, '');
    assert.equal(blank.coachingNotes, '');
  });
});

