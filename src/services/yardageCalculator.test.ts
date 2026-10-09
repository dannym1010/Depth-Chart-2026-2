import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAbsoluteYard,
  formatAbsoluteYard,
  calculateNetGain,
  crossCheckPlayYardage,
} from './yardageCalculator.ts';
import { simulateLocalAiBreakdown } from './geminiFilmService.ts';

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

  it('calculates net gain correctly across the 50 yard line', () => {
    // OWN 45 (-45) to OPP 45 (+45): from 45 to 55 = +10
    assert.equal(calculateNetGain('-45', '+45'), 10);
    // Tackle for loss: OWN 35 to OWN 32 = -3
    assert.equal(calculateNetGain('-35', '-32'), -3);
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
});
