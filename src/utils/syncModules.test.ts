import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPasscode, isPasscodeHash, sanitizeStateSecrets, verifyPasscode } from './passcodeHash.ts';
import {
  applyCopiedFormationsToDeletedIds,
  copyWeekCharts,
  countPlacedPlayers,
} from './copyWeek.ts';
import { wristbandHasPlays } from './wristbandNormalize.ts';
import {
  getPriorSeasonWeekKey as getCopySourceWeekKey,
  formatWeekCopyLabel,
  normalizeWeeklyData,
} from './seasonWeekUtils.ts';
import {
  mergeDeletedFormationIds,
  mergeFilmSession,
  mergePffReviews,
  mergePracticePlansByLastEdited,
  applySharedWeekSliceDepth,
    applySharedFormations,
    applyFormationBoardPatches,
    mergeRemoteWeeklyData,
  reorderFormationsInUnit,
  mergeScoutingReports,
  mergeStaffByEmail,
  pickBetterFormation,
  pickRichestScouting,
  weekHasIncomingScout,
  shouldKeepLocalCallSheet,
  shouldRejectStaleRemote,
} from './remoteStateMerge.ts';
import type { FormationBoard, LiveDrillGroup, PlacedPlayer, RosterPlayer, WeekState } from '../types.ts';
import {
  DEFAULT_PFF_GRADE_CRITERIA,
  bumpPlayCount,
  classifyPositionToken,
  countLinedUpSlots,
  formatPffAverage,
  getPlayerPffPlays,
  getPreviousWeekKey,
  loggedPlays,
  mergePffGradeCriteria,
  normalizePffPlays,
  playersFromDepthChart,
  setPlayerPffPlays,
  summarizePffPlays,
  upsertPffPlay,
} from './pprGroups.ts';

function player(_id: string, name: string): PlacedPlayer {
  return { name, num: '0' };
}

function form(id: string, name: string, unit: string, posId: string): FormationBoard {
  return {
    id,
    name,
    unit,
    rows: [{ id: `${id}-r`, positions: [{ id: posId, name: 'QB' }] }],
  } as FormationBoard;
}

describe('passcodeHash', () => {
  it('hashes and verifies, and never looks like plaintext', () => {
    const hash = hashPasscode('coach-secret');
    assert.equal(isPasscodeHash(hash), true);
    assert.equal(hash.includes('coach-secret'), false);
    assert.equal(verifyPasscode('coach-secret', hash), true);
    assert.equal(verifyPasscode('wrong', hash), false);
  });

  it('strips secrets from client-facing state', () => {
    const sanitized = sanitizeStateSecrets({
      roster: [1],
      adminPasscode: 'plain',
      adminPasscodeHash: 'scrypt$1$1$1$ab$cd',
    }) as { adminPasscode?: string; adminPasscodeHash?: string; adminPasscodeSet?: boolean };
    assert.equal(sanitized?.adminPasscode, undefined);
    assert.equal(sanitized?.adminPasscodeHash, undefined);
    assert.equal(sanitized?.adminPasscodeSet, true);
  });
});

describe('copyWeek', () => {
  const srcForm = form('form_a', '21 PERSONNEL', 'offense', 'pos-src');
  const src: WeekState = {
    formations: [srcForm],
    depthChart: { 'pos-src': [player('p1', 'Dan')] },
    scrimmageChart: { 'pos-src': [player('p1', 'Dan')] },
  } as WeekState;
  const target: WeekState = {
    formations: [form('form_b', '21 PERSONNEL', 'offense', 'pos-tgt')],
    depthChart: {},
    scrimmageChart: {},
  } as WeekState;

  it('copies formations and spots in both mode', () => {
    const result = copyWeekCharts({
      src,
      targetExisting: target,
      defaultFormations: [],
      mode: 'both',
    });
    assert.equal(result.mode, 'both');
    assert.equal(result.formations[0].id, 'form_a');
    assert.equal(countPlacedPlayers(result.depthChart), 1);
  });

  it('clears depth in formations_only', () => {
    const result = copyWeekCharts({
      src,
      targetExisting: target,
      defaultFormations: [],
      mode: 'formations_only',
    });
    assert.equal(Object.keys(result.depthChart).length, 0);
    assert.equal(result.formations[0].id, 'form_a');
  });

  it('maps players onto target slots by formation and position name', () => {
    const result = copyWeekCharts({
      src,
      targetExisting: target,
      defaultFormations: [],
      mode: 'positions_only',
    });
    assert.equal(result.formations[0].id, 'form_b');
    assert.equal(result.depthChart['pos-tgt'][0].name, 'Dan');
  });

  it('keeps target formations and depth chart intact in wristband_only mode', () => {
    const result = copyWeekCharts({
      src,
      targetExisting: target,
      defaultFormations: [],
      mode: 'wristband_only',
    });
    assert.equal(result.mode, 'wristband_only');
    assert.equal(result.formations[0].id, 'form_b');
    assert.equal(Object.keys(result.depthChart).length, 0);
  });

  it('un-deletes copied formation ids', () => {
    const next = applyCopiedFormationsToDeletedIds(['form_a', 'other'], [srcForm], 'both');
    assert.deepEqual(next, ['other']);
  });
});

describe('copy wristband from previous week', () => {
  it('picks the prior season week for a regular-season week', () => {
    assert.equal(getCopySourceWeekKey('2'), '1');
    assert.equal(formatWeekCopyLabel('1'), 'Week 1');
    assert.equal(formatWeekCopyLabel('0'), 'Preseason / Week 0');
  });

  it('detects whether a wristband has plays to copy', () => {
    assert.equal(
      wristbandHasPlays({
        wristbands: [{ columns: [{ plays: [{ text: '  ' }] }] }],
      } as any),
      false
    );
    assert.equal(
      wristbandHasPlays({
        wristbands: [{ columns: [{ plays: [{ text: '24 Blast' }] }] }],
      } as any),
      true
    );
  });
});

describe('copy wristband plays to call sheet row 1', () => {
  it('puts each wristband color in its own table and overflows extra columns under row 1', async () => {
    const { copyWristbandPlaysToFirstRow, listWristbandColumns } = await import(
      './wristbandLinking.ts'
    );
    const makeCol = (name: string, color: string, plays: Array<{ text: string; wristbandNum: number; numberHighlightColor: string; rowHighlightColor?: string }>) => ({
      name,
      color,
      numberBgColor: color,
      numberTextColor: '#000000',
      plays,
    });
    const wb = {
      wristbands: [
        {
          id: 'wb_1',
          title: 'Game Wristband',
          labelingMode: 'continuous',
          startNumber: 1,
          rowsCount: 2,
          columns: [
            makeCol('Blue', '#2563eb', [
              { text: '24 Blast', wristbandNum: 1, numberHighlightColor: '#2563eb', rowHighlightColor: '#93c5fd' },
              { text: '25 Iso', wristbandNum: 2, numberHighlightColor: '#2563eb' },
            ]),
            makeCol('Gold', '#facc15', [
              { text: '26 Power', wristbandNum: 3, numberHighlightColor: '#facc15' },
            ]),
            makeCol('Green', '#22c55e', [
              { text: '27 Sweep', wristbandNum: 4, numberHighlightColor: '#22c55e' },
            ]),
            makeCol('Pink', '#ec4899', [
              { text: 'Boot', wristbandNum: 5, numberHighlightColor: '#ec4899', rowHighlightColor: '#fbcfe8' },
            ]),
            makeCol('Orange', '#f97316', [
              { text: 'QB Sneak', wristbandNum: 6, numberHighlightColor: '#f97316' },
            ]),
          ],
        },
      ],
    } as any;
    const listed = listWristbandColumns(wb);
    assert.equal(listed.length, 5);
    assert.equal(listed[0].header, 'Blue');
    assert.equal(listed[0].plays[0]?.wristbandNum, 1);
    assert.equal(listed[0].plays[0]?.wristbandNumberColor, '#2563eb');
    const sheet = copyWristbandPlaysToFirstRow(
      {
        title: 'CS',
        highlightRedZone: false,
        offenseSections: [
          {
            id: 'off_1_10',
            title: '1-10',
            group: 'top_situations',
            rowIndex: 0,
            plays: [],
            headerBgColor: '#dc2626',
            headerTextColor: '#fff',
            targetUnit: 'offense',
            slotsCount: 1,
          },
        ],
        defenseSections: [],
        offenseScript: [],
        defenseScript: [],
        timeouts: { firstHalfUs: [], firstHalfOpp: [], secondHalfUs: [], secondHalfOpp: [] },
      } as any,
      wb,
      'offense'
    );
    const colorTables = sheet.offenseSections.filter((s) => s.wristbandPresetMode === 'wb_color_col');
    assert.equal(colorTables.length, 5);
    assert.equal(colorTables[0].title, 'Blue');
    assert.equal(colorTables[0].columnsCount, 1);
    assert.equal(colorTables[0].rowIndex, 0);
    assert.equal(colorTables[0].order, 0);
    assert.equal(colorTables[0].plays[0]?.name, '24 Blast');
    assert.equal(colorTables[0].plays[0]?.wristbandNum, 1);
    assert.equal(colorTables[3].title, 'Pink');
    assert.equal(colorTables[3].rowIndex, 0);
    assert.equal(colorTables[3].plays[0]?.wristbandNum, 5);
    assert.equal(colorTables[4].title, 'Orange');
    assert.equal(colorTables[4].rowIndex, 1);
    const old = sheet.offenseSections.find((s) => s.id === 'off_1_10');
    assert.equal(old?.rowIndex, 2);
  });

  it('prefers live green/pink wristband plays over factory week snapshot', async () => {
    const { copyWristbandPlaysToFirstRow } = await import('./wristbandLinking.ts');
    const { mergeRichestWristbandData } = await import('./wristbandNormalize.ts');
    const factoryGreen = {
      name: 'GREEN (27 - 39)',
      color: '#16a34a',
      plays: [{ text: '32 L 26 DIVE', wristbandNum: 27 }],
    };
    const factoryPink = {
      name: 'PINK (40 - 52)',
      color: '#ec4899',
      plays: [{ text: '32 R 24 DIVE', wristbandNum: 40 }],
    };
    const weekWb = {
      lastEdited: 200,
      wristbands: [
        {
          id: 'wb_1',
          title: 'Blue Gold',
          columns: [
            { name: 'BLUE (1 - 13)', color: '#2563eb', plays: [{ text: '24 Blast', wristbandNum: 1 }] },
            { name: 'GOLD (14 - 26)', color: '#facc15', plays: [{ text: '26 Power', wristbandNum: 14 }] },
          ],
        },
        { id: 'wb_2', title: 'Green Pink', columns: [factoryGreen, factoryPink] },
      ],
    };
    const liveWb = {
      lastEdited: 100,
      wristbands: [
        {
          id: 'wb_1',
          title: 'Blue Gold',
          columns: [
            { name: 'BLUE (1 - 13)', color: '#2563eb', plays: [{ text: '24 Blast', wristbandNum: 1 }] },
            { name: 'GOLD (14 - 26)', color: '#facc15', plays: [{ text: '26 Power', wristbandNum: 14 }] },
          ],
        },
        {
          id: 'wb_2',
          title: 'Green Pink',
          columns: [
            { name: 'GREEN (27 - 39)', color: '#16a34a', plays: [{ text: '11 L JET SWEEP', wristbandNum: 27 }] },
            { name: 'PINK (40 - 52)', color: '#ec4899', plays: [{ name: '11 R BUBBLE', wristbandNum: 40 }] },
          ],
        },
      ],
    };
    const merged = mergeRichestWristbandData(weekWb as any, liveWb as any);
    const sheet = copyWristbandPlaysToFirstRow(
      {
        title: 'CS',
        highlightRedZone: false,
        offenseSections: [],
        defenseSections: [],
        offenseScript: [],
        defenseScript: [],
        timeouts: { firstHalfUs: [], firstHalfOpp: [], secondHalfUs: [], secondHalfOpp: [] },
      } as any,
      merged,
      'offense'
    );
    const green = sheet.offenseSections.find((s) => /green/i.test(s.title));
    const pink = sheet.offenseSections.find((s) => /pink/i.test(s.title));
    assert.equal(green?.plays[0]?.name, '11 L JET SWEEP');
    assert.equal(pink?.plays[0]?.name, '11 R BUBBLE');
  });

  it('keeps a newer wristband with fewer plays instead of resurrecting an older snapshot', async () => {
    const { pickNewestWristbandData } = await import('./wristbandNormalize.ts');
    const olderFull = {
      lastEdited: 100,
      wristbands: [
        {
          id: 'wb_1',
          columns: [
            { name: 'BLUE', plays: [{ text: 'OLD PLAY', wristbandNum: 1 }, { text: 'KEEP', wristbandNum: 2 }] },
          ],
        },
      ],
    };
    const newerCleared = {
      lastEdited: 200,
      wristbands: [
        {
          id: 'wb_1',
          columns: [{ name: 'BLUE', plays: [{ text: 'KEEP', wristbandNum: 2 }] }],
        },
      ],
    };
    const picked = pickNewestWristbandData(olderFull as any, newerCleared as any);
    assert.equal(picked?.lastEdited, 200);
    assert.equal(picked?.wristbands?.[0]?.columns?.[0]?.plays?.[0]?.text, 'KEEP');
    assert.equal(picked?.wristbands?.[0]?.columns?.[0]?.plays?.length, 1);
  });

  it('shows each wristband card exactly as the Wristbands screen does (no copying blue/gold onto green/pink)', async () => {
    const { copyWristbandPlaysToFirstRow } = await import('./wristbandLinking.ts');
    const wb = {
      lastEdited: 1,
      wristbands: [
        {
          id: 'wb_1',
          title: 'Blue Gold',
          labelingMode: 'same_per_card',
          startNumber: 1,
          rowsCount: 1,
          columns: [
            { name: 'BLUE (1 - 13)', color: '#2563eb', plays: [{ text: '21 L 26 DIVE', wristbandNum: 1 }] },
            { name: 'GOLD (14 - 26)', color: '#facc15', plays: [{ text: '21 R 24 DIVE', wristbandNum: 14 }] },
          ],
        },
        {
          id: 'wb_2',
          title: 'Green Pink',
          labelingMode: 'continuous',
          startNumber: 27,
          rowsCount: 1,
          columns: [
            { name: 'GREEN (27 - 39)', color: '#16a34a', plays: [{ text: '32 L 26 DIVE', wristbandNum: 27 }] },
            { name: 'PINK (40 - 52)', color: '#ec4899', plays: [{ text: '32 R 24 DIVE', wristbandNum: 40 }] },
          ],
        },
      ],
    };
    const sheet = copyWristbandPlaysToFirstRow(
      {
        title: 'CS',
        highlightRedZone: false,
        offenseSections: [],
        defenseSections: [],
        offenseScript: [],
        defenseScript: [],
        timeouts: { firstHalfUs: [], firstHalfOpp: [], secondHalfUs: [], secondHalfOpp: [] },
      } as any,
      wb as any,
      'offense'
    );
    const green = sheet.offenseSections.find((s) => /green/i.test(s.title));
    const pink = sheet.offenseSections.find((s) => /pink/i.test(s.title));
    assert.equal(green?.plays[0]?.name, '32 L 26 DIVE');
    assert.equal(pink?.plays[0]?.name, '32 R 24 DIVE');
  });

  it('does not copy Blue/Gold plays onto Green/Pink even when card 1 is same_per_card', async () => {
    const { mergeRichestWristbandData } = await import('./wristbandNormalize.ts');
    const wb = {
      lastEdited: 100,
      wristbands: [
        {
          id: 'wb_1',
          title: 'Blue Gold',
          labelingMode: 'same_per_card',
          columns: [
            { name: 'BLUE', color: '#2563eb', plays: [{ text: '21 L 26 DIVE' }] },
            { name: 'GOLD', color: '#facc15', plays: [{ text: '21 R 24 DIVE' }] },
          ],
        },
        {
          id: 'wb_2',
          title: 'Green Pink',
          labelingMode: 'same_per_card',
          columns: [
            { name: 'GREEN', color: '#16a34a', plays: [] },
            { name: 'PINK', color: '#ec4899', plays: [] },
          ],
        },
      ],
    };
    const merged = mergeRichestWristbandData(wb as any);
    assert.equal(merged?.wristbands?.[1]?.columns?.[0]?.plays?.length || 0, 0);
  });

  it('does not fill the whole call sheet cell when the wristband is number-only highlight', async () => {
    const { callSheetPlayFromWristbandSlot } = await import('./wristbandLinking.ts');
    const col = {
      name: 'Blue',
      color: '#2563eb',
      numberBgColor: '#2563eb',
      numberTextColor: '#ffffff',
      plays: [
        {
          text: '24 Blast',
          wristbandNum: 1,
          numberHighlightColor: '#2563eb',
          rowHighlightColor: '#93c5fd',
          highlightColor: '#93c5fd',
        },
      ],
    };
    const wb = {
      id: 'wb_1',
      title: 'Game Wristband',
      highlightTarget: 'number_only',
      labelingMode: 'continuous',
      startNumber: 1,
      rowsCount: 1,
      columns: [col],
    } as any;
    const play = callSheetPlayFromWristbandSlot(col.plays[0] as any, col as any, wb, [wb], 0, 0, 0);
    assert.equal(play?.wristbandHighlightTarget, 'number_only');
    assert.equal(play?.wristbandRowColor, undefined);
    assert.equal(play?.isHighlighted, false);
    assert.equal(play?.wristbandNumberColor, '#2563eb');
  });
});

describe('remoteStateMerge', () => {
  it('rejects stale remotes', () => {
    assert.equal(shouldRejectStaleRemote(100, 200), true);
    assert.equal(shouldRejectStaleRemote(200, 100), false);
  });

  it('keeps local-only weeks and does not drop a local depth spot remote left empty', () => {
    const local: Record<string, WeekState> = {
      'team_10u__week_1': {
        formations: [form('form_21', '21', 'offense', '21-qb')],
        depthChart: { '21-qb': [player('p1', 'Dan')] },
        scrimmageChart: {},
      } as WeekState,
      'team_10u__week_2': {
        formations: [form('form_21', '21', 'offense', '21-qb')],
        depthChart: { '21-qb': [player('p2', 'Pat')] },
        scrimmageChart: {},
      } as WeekState,
    };
    const remote: Record<string, WeekState> = {
      'team_10u__week_1': {
        formations: [form('form_21', '21', 'offense', '21-qb')],
        depthChart: {},
        scrimmageChart: {},
      } as WeekState,
    };
    const merged = mergeRemoteWeeklyData(local, remote, 'team_10u', '3', 'offense', 0);
    assert.equal(merged['team_10u__week_2'].depthChart['21-qb'][0].name, 'Pat');
    assert.equal(merged['team_10u__week_1'].depthChart['21-qb'][0].name, 'Dan');
  });

  it('keeps a filled Hudl scout when the other side is empty', () => {
    const filled = { plays: [{ id: '1' }, { id: '2' }], datasetName: 'Carmel', updatedAt: 10, coachNotes: '' };
    const empty = { plays: [], updatedAt: 99 };
    const merged = mergeScoutingReports({ hudlScout: filled }, { hudlScout: empty });
    assert.equal(merged.hudlScout.plays.length, 2);
    assert.equal(merged.hudlScout.datasetName, 'Carmel');
  });

  it('keeps an intentional scout file removal over an older filled copy', () => {
    const filled = {
      plays: [{ id: '1' }, { id: '2' }],
      games: [{ id: 'g1' }, { id: 'g2' }],
      datasetName: 'Carmel',
      updatedAt: 10,
    };
    const cleared = { plays: [], games: [], datasetName: '', updatedAt: 50, sourceCleared: true };
    const merged = mergeScoutingReports({ hudlScout: filled }, { hudlScout: cleared });
    assert.equal(merged.hudlScout.plays.length, 0);
    assert.equal(merged.hudlScout.sourceCleared, true);
  });

  it('keeps the newer scout after one of two uploaded games is removed', () => {
    const twoGames = {
      plays: [{ id: '1' }, { id: '2' }],
      games: [{ id: 'g1' }, { id: 'g2' }],
      datasetName: 'Carmel',
      updatedAt: 10,
    };
    const oneGame = {
      plays: [{ id: '2' }],
      games: [{ id: 'g2' }],
      datasetName: 'Carmel',
      updatedAt: 80,
    };
    const merged = mergeScoutingReports({ hudlScout: oneGame }, { hudlScout: twoGames });
    assert.equal(merged.hudlScout.plays.length, 1);
    assert.equal(merged.hudlScout.games.length, 1);
  });

  it('picks the scouting report that actually has Hudl plays', () => {
    const empty = { hudlScout: { plays: [], updatedAt: 9 } };
    const filled = { hudlScout: { plays: [{ id: '1' }], datasetName: 'Carmel', updatedAt: 2 } };
    assert.equal(pickRichestScouting(empty, filled)?.hudlScout.datasetName, 'Carmel');
    assert.equal(weekHasIncomingScout({ scouting: filled }), true);
    assert.equal(weekHasIncomingScout({ scouting: empty }), false);
  });

  it('unions our-team Hudl games from weekly reports into one season bundle', async () => {
    const { unionScoutBundles, collectOwnTeamHudlFromWeekly, mergeOwnTeamHudlMap } = await import('./remoteStateMerge.ts');
    const week1 = { plays: [{ id: 'a' }], games: [{ id: 'g1', name: 'Scrimmage' }], updatedAt: 1 };
    const week2 = { plays: [{ id: 'b' }], games: [{ id: 'g2', name: 'Carmel' }], updatedAt: 2 };
    const unioned = unionScoutBundles(week1, week2);
    assert.equal(unioned.plays.length, 2);
    assert.equal(unioned.games.length, 2);
    const collected = collectOwnTeamHudlFromWeekly({
      'team_10u__week_1': { scouting: { hudlScout: { ownTeam: week1 } } },
      'team_10u__week_2': { scouting: { hudlScout: { ownTeam: week2 } } },
    });
    assert.equal(collected.team_10u.plays.length, 2);
    const mapped = mergeOwnTeamHudlMap({ team_10u: week1 }, { team_10u: week2 });
    assert.equal(mapped.team_10u.plays.length, 1);
    assert.equal(mapped.team_10u.plays[0].id, 'b');
  });

  it('does not put a deleted our-team Hudl file back when a newer upload has fewer plays', async () => {
    const { pickScoutBundle, unionScoutBundles } = await import('./remoteStateMerge.ts');
    const oldTwo = {
      plays: [{ id: 'old' }, { id: 'keep' }],
      games: [{ id: 'g-old' }, { id: 'g-new' }],
      datasetName: 'Old film',
      updatedAt: 10,
    };
    const reupload = {
      plays: [{ id: 'keep' }],
      games: [{ id: 'g-new' }],
      datasetName: 'This week',
      updatedAt: 90,
      sourceCleared: false,
    };
    const picked = pickScoutBundle(reupload, oldTwo);
    assert.equal(picked.plays.length, 1);
    assert.equal(picked.games[0].id, 'g-new');
    const cleared = { plays: [], games: [], updatedAt: 80, sourceCleared: true };
    const afterClear = unionScoutBundles(cleared, oldTwo);
    assert.equal(afterClear.plays.length, 0);
    assert.equal(afterClear.sourceCleared, true);
  });

  it('writes opponent Hudl film onto the weekly scout so other coaches can load it', async () => {
    const { applyHudlScoutPatch } = await import('./remoteStateMerge.ts');
    const state = applyHudlScoutPatch(
      { weeklyData: {}, ownTeamHudlScout: {} },
      {
        teamId: 'team_10u',
        week: 'Week 2',
        opponentScout: { plays: [{ id: 'p1' }], datasetName: 'Carmel', updatedAt: 9 },
        ownTeamScout: { plays: [{ id: 'ours' }], datasetName: 'Mahopac', updatedAt: 9 },
      }
    );
    assert.equal(state.weeklyData['team_10u__week_2'].scouting.hudlScout.plays.length, 1);
    assert.equal(state.weeklyData['2'].scouting.hudlScout.datasetName, 'Carmel');
    assert.equal(state.ownTeamHudlScout.team_10u.plays[0].id, 'ours');
  });

  it('keeps TeamSnap practices when a refresh sends an older shorter schedule', async () => {
    const { mergeScheduleEvents } = await import('./remoteStateMerge.ts');
    const local = [
      { id: 'evt_old', date: '2026-09-03', startTime: '17:30', title: 'Week 1 Practice', type: 'practice', lastEdited: 1 },
      { id: 'evt_ts_1', date: '2026-09-10', startTime: '17:30', title: 'TeamSnap Practice', type: 'practice', lastEdited: 50 },
    ];
    const remote = [
      { id: 'evt_old', date: '2026-09-03', startTime: '17:30', title: 'Week 1 Practice', type: 'practice', lastEdited: 1 },
    ];
    const merged = mergeScheduleEvents(local, remote);
    assert.equal(merged.some((e: any) => e.id === 'evt_ts_1'), true);
    assert.equal(merged.length, 2);
  });

  it('keeps edited positional-group boards and GRP- depth spots over factory remote', () => {
    const localForm = {
      id: 'form_grp_off',
      unit: 'groups' as const,
      name: 'Offensive Depth Chart',
      rows: [{ id: 'r1', positions: [{ id: 'GRP-QB', name: 'QB 1s' }, { id: 'GRP-X', name: 'X' }, { id: 'GRP-NEW', name: 'Slot' }] }],
    };
    const remoteForm = {
      id: 'form_grp_off',
      unit: 'groups' as const,
      name: 'Offensive Depth Chart',
      rows: [{ id: 'r1', positions: [{ id: 'GRP-QB', name: 'QB' }] }],
    };
    assert.equal(pickBetterFormation(localForm as any, remoteForm as any)?.rows[0].positions.length, 3);
    const local: Record<string, WeekState> = {
      'team_10u__week_1': {
        formations: [localForm as any],
        depthChart: { 'GRP-QB': [player('p1', 'Ace')] },
        scrimmageChart: {},
        scouting: { hudlScout: { plays: [{ id: 'p' }], datasetName: 'Carmel', updatedAt: 5 } },
      } as WeekState,
    };
    const remote: Record<string, WeekState> = {
      'team_10u__week_1': {
        formations: [remoteForm as any],
        depthChart: { 'GRP-QB': [] },
        scrimmageChart: {},
        scouting: { hudlScout: { plays: [], updatedAt: 50 } },
      } as WeekState,
    };
    const merged = mergeRemoteWeeklyData(local, remote, 'team_10u', '1', 'groups', 0);
    assert.equal(merged['team_10u__week_1'].formations.find((f) => f.id === 'form_grp_off')?.rows[0].positions.length, 3);
    assert.equal(merged['team_10u__week_1'].depthChart['GRP-QB'][0].name, 'Ace');
    assert.equal(merged['team_10u__week_1'].scouting?.hudlScout?.plays?.length, 1);
  });

  it('keeps the newer practice plan and local-only plans', () => {
    const merged = mergePracticePlansByLastEdited(
      [
        { id: 'a', lastEdited: 50, title: 'local-newer' } as any,
        { id: 'b', lastEdited: 1, title: 'local-only' } as any,
      ],
      [
        { id: 'a', lastEdited: 10, title: 'remote-old' } as any,
        { id: 'c', lastEdited: 5, title: 'remote-only' } as any,
      ],
      new Set()
    );
    assert.equal(merged.find((p) => p.id === 'a')?.title, 'local-newer');
    assert.ok(merged.some((p) => p.id === 'b'));
    assert.ok(merged.some((p) => p.id === 'c'));
  });

  it('does not rewrite every ops doc on a routine all-save', async () => {
    const { cloudModulesForScope } = await import('../services/storageService.ts');
    assert.deepEqual(cloudModulesForScope('all'), []);
    assert.deepEqual(cloudModulesForScope('focusout'), []);
    assert.deepEqual(cloudModulesForScope('practice'), ['practice']);
    assert.deepEqual(cloudModulesForScope('plays'), ['plays']);
    assert.equal(cloudModulesForScope('force'), undefined);
  });

  it('lets another coach see a newer practice plan even if this device is on the practice screen', () => {
    const merged = mergePracticePlansByLastEdited(
      [{ id: 'a', lastEdited: 10, title: 'old-on-this-phone' } as any],
      [{ id: 'a', lastEdited: 90, title: 'new-from-other-coach' } as any],
      new Set(),
      { isPracticeView: true, lastLocalEditTime: Date.now(), activePracticeId: 'a' }
    );
    assert.equal(merged.find((p) => p.id === 'a')?.title, 'new-from-other-coach');
  });

  it('picks the filled shared today plan over a newer blank seed', async () => {
    const { findBestActivePracticeId, shouldSwitchToSharedTodayPlan, getLocalDateKey } = await import(
      './practiceUtils.ts'
    );
    const today = getLocalDateKey();
    const blank = {
      id: 'blank-seed',
      date: today,
      lastEdited: 999,
      title: 'Practice #1',
      plan: [{ stations: [{ name: '', desc: '', coach: '', focus: '' }] }],
    } as any;
    const filled = {
      id: 'shared-today',
      date: today,
      lastEdited: 10,
      title: 'Thursday Install',
      plan: [
        {
          stations: [
            { name: 'Inside Zone', desc: 'QB/RB mesh', coach: 'Dan', focus: 'Footwork' },
          ],
        },
      ],
    } as any;
    assert.equal(findBestActivePracticeId([blank, filled], 'blank-seed'), 'shared-today');
    assert.equal(shouldSwitchToSharedTodayPlan([blank, filled], 'blank-seed'), 'shared-today');
    assert.equal(shouldSwitchToSharedTodayPlan([filled], 'shared-today'), null);
  });

  it('uses the local calendar date after evening in US timezones', async () => {
    const { getLocalDateKey } = await import('./practiceUtils.ts');
    const lateLocal = new Date(2026, 8, 24, 23, 30, 0);
    assert.equal(getLocalDateKey(lateLocal), '2026-09-24');
  });

  it('applies another coach depth spots on the same week instead of keeping the idle local chart', () => {
    const qbForm = form('form_21', '21', 'offense', '21-qb');
    const local: Record<string, WeekState> = {
      'team_10u__week_1': {
        formations: [qbForm],
        depthChart: { '21-qb': [player('p1', 'Dan')] },
        scrimmageChart: {},
      } as WeekState,
    };
    const remote: Record<string, WeekState> = {
      'team_10u__week_1': {
        formations: [qbForm],
        depthChart: { '21-qb': [player('p2', 'Pat')] },
        scrimmageChart: {},
      } as WeekState,
    };
    const merged = mergeRemoteWeeklyData(local, remote, 'team_10u', '1', 'offense', 0);
    assert.equal(merged['team_10u__week_1'].depthChart['21-qb'][0].name, 'Pat');
  });

  it('does not put a just-deleted depth player back from a stale cloud copy', () => {
    const now = Date.now();
    const recent = new Map<string, number>([['21-qb', now]]);
    const local: Record<string, WeekState> = {
      'team_10u__week_1': {
        formations: [form('form_21', '21', 'offense', '21-qb')],
        depthChart: { '21-qb': [] },
        scrimmageChart: {},
      } as WeekState,
    };
    const remote: Record<string, WeekState> = {
      'team_10u__week_1': {
        formations: [form('form_21', '21', 'offense', '21-qb')],
        depthChart: { '21-qb': [player('p1', 'Dan')] },
        scrimmageChart: {},
      } as WeekState,
    };
    const merged = mergeRemoteWeeklyData(
      local,
      remote,
      'team_10u',
      '1',
      'offense',
      now,
      recent
    );
    assert.equal(merged['team_10u__week_1'].depthChart['21-qb'].length, 0);
    const fromSlice = applySharedWeekSliceDepth(
      { '21-qb': [] },
      { '21-qb': [player('p1', 'Dan')] },
      recent,
      now
    );
    assert.equal(fromSlice['21-qb'].length, 0);
  });

  it('keeps a renamed position and formation order while this device is still editing', () => {
    const now = Date.now();
    const recent = new Map<string, number>([['form_a', now], ['form_b', now]]);
    const local = [
      form('form_b', '22', 'offense', 'b-qb'),
      { ...form('form_a', '21', 'offense', 'a-qb'), rows: [{ id: 'r', positions: [{ id: 'a-qb', name: 'QB 1s' }] }] },
    ] as FormationBoard[];
    const remote = [
      form('form_a', '21', 'offense', 'a-qb'),
      form('form_b', '22', 'offense', 'b-qb'),
    ];
    const merged = applySharedFormations(local, remote, recent, now, now);
    assert.equal(merged[0].id, 'form_b');
    assert.equal(merged[1].rows[0].positions[0]?.name, 'QB 1s');
  });

  it('keeps a moved depth-chart position after refresh when cloud still has the old layout', () => {
    const now = 1_700_000_000_000;
    const moved = {
      ...form('form_a', '21', 'offense', 'a-qb'),
      lastEdited: now,
      rows: [
        { id: 'r1', positions: [null, { id: 'a-qb', name: 'QB' }] },
        { id: 'r2', positions: [{ id: 'a-rb', name: 'RB' }] },
      ],
    } as FormationBoard;
    const stale = {
      ...form('form_a', '21', 'offense', 'a-qb'),
      lastEdited: now - 60_000,
      rows: [
        { id: 'r1', positions: [{ id: 'a-qb', name: 'QB' }] },
        { id: 'r2', positions: [{ id: 'a-rb', name: 'RB' }] },
      ],
    } as FormationBoard;
    const merged = applySharedFormations([moved], [stale], new Map(), 0, now + 120_000);
    assert.equal(merged[0].rows[0].positions[0], null);
    assert.equal(merged[0].rows[0].positions[1]?.id, 'a-qb');
  });

  it('takes a newer remote position layout so other coaches see the move', () => {
    const now = 1_700_000_000_000;
    const localOld = {
      ...form('form_a', '21', 'offense', 'a-qb'),
      lastEdited: now - 60_000,
      rows: [{ id: 'r1', positions: [{ id: 'a-qb', name: 'QB' }] }],
    } as FormationBoard;
    const remoteMoved = {
      ...form('form_a', '21', 'offense', 'a-qb'),
      lastEdited: now,
      rows: [{ id: 'r1', positions: [null, { id: 'a-qb', name: 'QB' }] }],
    } as FormationBoard;
    const merged = applySharedFormations([localOld], [remoteMoved], new Map(), 0, now + 120_000);
    assert.equal(merged[0].rows[0].positions[0], null);
    assert.equal(merged[0].rows[0].positions[1]?.id, 'a-qb');
  });

  it('takes another coach newer board when this device only has an older lastEdited stamp', () => {
    const now = 1_700_000_000_000;
    const local = {
      ...form('form_a', '21', 'offense', 'a-qb'),
      lastEdited: now,
      rows: [{ id: 'r1', positions: [{ id: 'a-qb', name: 'QB' }] }],
    } as FormationBoard;
    const remote = {
      ...form('form_a', '21', 'offense', 'a-qb'),
      lastEdited: now - 1,
      rows: [{ id: 'r1', positions: [null, { id: 'a-qb', name: 'QB 1s' }] }],
    } as FormationBoard;
    const merged = applySharedFormations([local], [remote], new Map(), now, now + 120_000, true);
    assert.equal(merged[0].rows[0].positions[1]?.name, 'QB 1s');
  });

  it('applies another coach slot patch without replacing the rest of the week boards', () => {
    const now = 1_700_000_000_000;
    const localA = form('form_a', '21', 'offense', 'a-qb');
    const localB = form('form_b', '22', 'offense', 'b-qb');
    const remoteA = {
      ...form('form_a', '21', 'offense', 'a-qb'),
      lastEdited: now,
      rows: [{ id: 'r1', positions: [null, { id: 'a-qb', name: 'QB 1s' }] }],
    } as FormationBoard;
    const merged = applyFormationBoardPatches(
      [localA, localB],
      { form_a: remoteA },
      new Map(),
      now + 120_000
    );
    assert.equal(merged[0].rows[0].positions[1]?.name, 'QB 1s');
    assert.equal(merged[1].id, 'form_b');
    const spots = applySharedWeekSliceDepth(
      { 'a-qb': [player('p1', 'Dan')], 'b-rb': [player('p2', 'Pat')] },
      { 'a-qb': [player('p3', 'Sam')] },
      new Map(),
      now + 120_000
    );
    assert.equal(spots['a-qb'][0].name, 'Sam');
    assert.equal(spots['b-rb'][0].name, 'Pat');
  });

  it('takes another coach live patch even if this screen still has a 25s protect stamp', () => {
    const now = 1_700_000_000_000;
    const recent = new Map<string, number>([['a-qb', now - 5000]]);
    const spots = applySharedWeekSliceDepth(
      { 'a-qb': [player('p1', 'Dan')] },
      { 'a-qb': [player('p3', 'Sam')] },
      recent,
      now,
      2500
    );
    assert.equal(spots['a-qb'][0].name, 'Sam');
    const liveOtherCoach = applySharedWeekSliceDepth(
      { 'a-qb': [player('p1', 'Dan')] },
      { 'a-qb': [player('p3', 'Sam')] },
      recent,
      now,
      0
    );
    assert.equal(liveOtherCoach['a-qb'][0].name, 'Sam');
  });

  it('keeps a moved 4-4 first after refresh when cloud still has factory order', () => {
    const now = 1_700_000_000_000;
    const local = {
      'team_10u__week_1': {
        formations: [
          { ...form('form_44', '4-4', 'defense', '44-m'), lastEdited: now },
          { ...form('form_53', '5-3', 'defense', '53-m'), lastEdited: now },
        ],
        depthChart: {},
        scrimmageChart: {},
        opponent: '',
      },
    } as Record<string, WeekState>;
    const remote = {
      'team_10u__week_1': {
        formations: [
          form('form_53', '5-3', 'defense', '53-m'),
          form('form_44', '4-4', 'defense', '44-m'),
        ],
        depthChart: {},
        scrimmageChart: {},
        opponent: '',
      },
    } as Record<string, WeekState>;
    const merged = mergeRemoteWeeklyData(local, remote, 'team_10u', '1', 'defense', 0);
    assert.equal(merged['team_10u__week_1'].formations[0].id, 'form_44');
    const fromStub = mergeRemoteWeeklyData(
      {
        'team_10u__week_1': { opponent: 'Carmel', formations: [], depthChart: {}, scrimmageChart: {} },
        '1': {
          formations: [
            { ...form('form_44', '4-4', 'defense', '44-m'), lastEdited: now },
            { ...form('form_53', '5-3', 'defense', '53-m'), lastEdited: now },
          ],
          depthChart: {},
          scrimmageChart: {},
          opponent: '',
        },
      } as Record<string, WeekState>,
      remote,
      'team_10u',
      '1',
      'defense',
      0
    );
    assert.equal(fromStub['team_10u__week_1'].formations[0].id, 'form_44');
    const reordered = reorderFormationsInUnit(
      [form('form_21', '21', 'offense', '21-qb'), form('form_53', '5-3', 'defense', '53-m'), form('form_44', '4-4', 'defense', '44-m')],
      'defense',
      [form('form_44', '4-4', 'defense', '44-m'), form('form_53', '5-3', 'defense', '53-m')]
    );
    assert.equal(reordered[1].id, 'form_44');
    assert.equal(reordered[2].id, 'form_53');
    assert.equal(reordered[0].id, 'form_21');
  });

  it('does not refill an opponent-only week from factory order when saved defaults already have 4-4 first', () => {
    const now = 1_700_000_000_000;
    const defaults = [
      { ...form('form_44', '4-4', 'defense', '44-m'), lastEdited: now },
      { ...form('form_53', '5-3', 'defense', '53-m'), lastEdited: now },
      form('form_21', '21', 'offense', '21-qb'),
    ] as FormationBoard[];
    const normalized = normalizeWeeklyData(
      {
        'team_10u__week_4': { opponent: 'Carmel' } as WeekState,
      },
      defaults
    );
    const def = (normalized['team_10u__week_4'].formations || []).filter((f) => f.unit === 'defense');
    assert.equal(def[0].id, 'form_44');
    const partial = normalizeWeeklyData(
      {
        '4': {
          formations: [{ ...form('form_base_def', 'Base', 'defense', 'base-m') }],
          depthChart: {},
          scrimmageChart: {},
          opponent: '',
        } as WeekState,
      },
      [...defaults, form('form_base_def', 'Base', 'defense', 'base-m')]
    );
    const partialDef = (partial['4'].formations || []).filter((f) => f.unit === 'defense');
    assert.equal(partialDef.map((f) => f.id).join(','), 'form_44,form_53');
    assert.equal(partialDef.some((f) => f.id === 'form_base_def' || f.name === 'Base'), false);
  });

  it('merges staff by email without dropping local idle timeout', () => {
    const merged = mergeStaffByEmail(
      [{ email: 'a@x.com', idleTimeoutMinutes: 40, role: 'Assistant Coach', status: 'Active' } as any],
      [{ email: 'a@x.com', role: 'Head Coach', status: 'Active' } as any]
    );
    assert.equal(merged[0].role, 'Head Coach');
    assert.equal(merged[0].idleTimeoutMinutes, 40);
  });

  it('does not let an empty remote call sheet wipe local plays', () => {
    assert.equal(
      shouldKeepLocalCallSheet({
        isLocalRecent: false,
        localLastEdited: 1,
        remoteLastEdited: 99,
        localPlayCount: 8,
        remotePlayCount: 0,
      }),
      true
    );
  });

  it('unions deleted formation ids and always keeps form_10_spread', () => {
    const merged = mergeDeletedFormationIds(['a'], ['b'], new Set(['form_21']));
    assert.ok(merged.includes('a'));
    assert.ok(merged.includes('b'));
    assert.ok(merged.includes('form_10_spread'));
    assert.ok(merged.includes('form_base_def'));
  });

  it('keeps both coaches PFF grades when they rate different players at the same time', () => {
    const merged = mergePffReviews(
      {
        p1: {
          plays: [{ id: 'film_a', playNumber: '3', grades: { st_effort: '4' }, updatedAt: 10 }],
        },
      },
      {
        p2: {
          plays: [{ id: 'film_a', playNumber: '3', grades: { st_effort: '5' }, updatedAt: 11 }],
        },
      }
    );
    assert.equal(merged?.p1.plays?.[0].grades?.st_effort, '4');
    assert.equal(merged?.p2.plays?.[0].grades?.st_effort, '5');
  });

  it('merges facet grades on the same player and keeps the newer play edit', () => {
    const merged = mergePffReviews(
      {
        p1: {
          plays: [
            {
              id: 'film_a',
              playNumber: '3',
              grades: { st_effort: '2', st_tackle: '3' },
              updatedAt: 10,
            },
          ],
        },
      },
      {
        p1: {
          plays: [{ id: 'film_a', playNumber: '3', grades: { st_effort: '5' }, updatedAt: 20 }],
        },
      }
    );
    assert.equal(merged?.p1.plays?.[0].grades?.st_effort, '5');
    assert.equal(merged?.p1.plays?.[0].grades?.st_tackle, '3');
  });

  it('merges film assignments so two coaches can grade different players on one play', () => {
    const merged = mergeFilmSession(
      {
        plays: [{ id: 'hudl_1_0', playNumber: '1', odk: 'special' }],
        packages: { offense: { gold: {}, blue: {}, black: {} }, defense: { gold: {}, blue: {}, black: {} } },
        assignments: {
          hudl_1_0: {
            color: 'gold',
            slotOverrides: {},
            grades: { p1: { st_effort: '4' } },
            updatedAt: 10,
          },
        },
      } as any,
      {
        plays: [{ id: 'hudl_1_0', playNumber: '1', odk: 'special' }],
        packages: { offense: { gold: {}, blue: {}, black: {} }, defense: { gold: {}, blue: {}, black: {} } },
        assignments: {
          hudl_1_0: {
            color: 'blue',
            slotOverrides: {},
            grades: { p2: { st_effort: '5' } },
            updatedAt: 20,
          },
        },
      } as any
    );
    assert.equal(merged?.assignments.hudl_1_0.color, 'blue');
    assert.equal(merged?.assignments.hudl_1_0.grades.p1.st_effort, '4');
    assert.equal(merged?.assignments.hudl_1_0.grades.p2.st_effort, '5');
  });
});

describe('pprGroups', () => {
  it('maps youth positions into offense and defense groups', () => {
    assert.deepEqual(classifyPositionToken('QB'), { side: 'offense', group: 'QB' });
    assert.deepEqual(classifyPositionToken('FB'), { side: 'offense', group: 'RB' });
    assert.deepEqual(classifyPositionToken('TE'), { side: 'offense', group: 'WR' });
    assert.deepEqual(classifyPositionToken('LT'), { side: 'offense', group: 'OL' });
    assert.deepEqual(classifyPositionToken('DE'), { side: 'defense', group: 'DE' });
    assert.deepEqual(classifyPositionToken('NG'), { side: 'defense', group: 'DT' });
    assert.deepEqual(classifyPositionToken('MLB'), { side: 'defense', group: 'LB' });
    assert.deepEqual(classifyPositionToken('FS'), { side: 'defense', group: 'DB' });
    assert.deepEqual(classifyPositionToken('E', 'defense'), { side: 'defense', group: 'DE' });
    assert.deepEqual(classifyPositionToken('C', 'defense'), { side: 'defense', group: 'DB' });
    assert.deepEqual(classifyPositionToken('C', 'offense'), { side: 'offense', group: 'OL' });
    assert.deepEqual(classifyPositionToken('T', 'defense'), { side: 'defense', group: 'DT' });
    assert.deepEqual(classifyPositionToken('NG', 'defense'), { side: 'defense', group: 'DT' });
    assert.deepEqual(classifyPositionToken('S', 'defense'), { side: 'defense', group: 'LB' });
    assert.deepEqual(classifyPositionToken('FS', 'defense'), { side: 'defense', group: 'DB' });
    assert.deepEqual(classifyPositionToken('W', 'defense'), { side: 'defense', group: 'LB' });
    assert.deepEqual(classifyPositionToken('M', 'defense'), { side: 'defense', group: 'LB' });
    assert.deepEqual(classifyPositionToken('R', 'defense'), { side: 'defense', group: 'LB' });
    assert.deepEqual(classifyPositionToken('WDE', 'defense'), { side: 'defense', group: 'DE' });
    assert.deepEqual(classifyPositionToken('SDE', 'defense'), { side: 'defense', group: 'DE' });
    assert.deepEqual(classifyPositionToken('CB', 'defense'), { side: 'defense', group: 'DB' });
  });

  it('counts lined-up drill slots and logs plays per side', () => {
    const player = { id: 'p1', num: '12', firstName: 'Dan', lastName: 'Smith', offensivePosition: 'QB' };
    const groups = [
      {
        id: 'g1',
        offensePositions: [{ id: 'qb', name: 'QB', unit: 'offense' }],
        defensePositions: [],
        lineup: { qb: [{ id: 'p1', num: '12', name: 'Smith' }, { id: 'p2', num: '7', name: 'Other' }] },
      },
    ] as unknown as LiveDrillGroup[];
    assert.equal(countLinedUpSlots(groups, player, 'offense'), 1);
    const bumped = bumpPlayCount({}, player, 'offense', 2);
    assert.equal(loggedPlays(bumped, player, 'offense'), 2);
    assert.equal(loggedPlays(bumpPlayCount(bumped, player, 'offense', -5), player, 'offense'), 0);
  });

  it('picks the prior season week for Monday PFF grading', () => {
    assert.equal(getPreviousWeekKey('2', ['pre-4', '1', '2', '3']), '1');
    assert.equal(getPreviousWeekKey('pre-1', ['pre-1', 'pre-2']), 'pre-1');
  });

  it('turns a single PFF grade into a multi-play sheet and averages grades', () => {
    const player = { id: 'p1', num: '12', firstName: 'Dan', lastName: 'Smith' } as RosterPlayer;
    const migrated = normalizePffPlays({ playNumber: '18', grade: '4', notes: 'good block' });
    assert.equal(migrated.length, 1);
    assert.equal(migrated[0].playNumber, '18');
    let reviews = setPlayerPffPlays({}, player, migrated);
    reviews = upsertPffPlay(reviews, player, 'play-2', { playNumber: '22', grade: '2', notes: 'miss' });
    const summary = summarizePffPlays(getPlayerPffPlays(reviews, player));
    assert.equal(summary.playCount, 2);
    assert.equal(formatPffAverage(summary.average), '3');
  });

  it('seeds four editable PFF grade items per position and averages mapped grades', () => {
    assert.equal(DEFAULT_PFF_GRADE_CRITERIA.QB.length, 4);
    assert.equal(DEFAULT_PFF_GRADE_CRITERIA.RB.some((item) => item.label === 'Blocking'), true);
    assert.equal(DEFAULT_PFF_GRADE_CRITERIA.DB[0].label, 'Coverage');
    const merged = mergePffGradeCriteria({ QB: [{ id: 'qb_decision', label: 'Reads' }] });
    assert.equal(merged.QB[0].label, 'Reads');
    assert.equal(merged.RB.some((item) => item.id === 'rb_block'), true);
    const avg = summarizePffPlays([
      {
        id: 'p1',
        playNumber: '7',
        grades: { qb_decision: '5', qb_accuracy: '3' },
      },
    ]);
    assert.equal(formatPffAverage(avg.average), '4');
    const withNa = summarizePffPlays([
      {
        id: 'p2',
        playNumber: '8',
        grades: { qb_decision: '5', qb_accuracy: 'NA' },
      },
    ]);
    assert.equal(formatPffAverage(withNa.average), '5');
  });

  it('groups PFF players from 21 offense and 4-4 defense only, plus added overrides', () => {
    const qb = { id: 'p-qb', num: '12', firstName: 'Q', lastName: 'B' } as RosterPlayer;
    const rb = { id: 'p-rb', num: '21', firstName: 'R', lastName: 'B' } as RosterPlayer;
    const extra = { id: 'p-x', num: '7', firstName: 'X', lastName: 'Tra' } as RosterPlayer;
    const eleven = { id: 'p-11', num: '11', firstName: 'O', lastName: 'Ther' } as RosterPlayer;
    const formations = [
      {
        id: '21_l',
        name: '21 L',
        unit: 'offense',
        rows: [{ id: 'r1', positions: [{ id: 'slot-qb', name: '1 (QB)' }, { id: 'slot-rb', name: '4 (RB)' }] }],
      },
      {
        id: '11_offense',
        name: '11 PERSONNEL',
        unit: 'offense',
        rows: [{ id: 'r2', positions: [{ id: 'slot-other', name: 'QB' }] }],
      },
      {
        id: '44_defense',
        name: '4-4 BASE STACK LIZ',
        unit: 'defense',
        rows: [{ id: 'r3', positions: [{ id: 'slot-e', name: 'E' }] }],
      },
    ] as unknown as FormationBoard[];
    const depth = {
      'slot-qb': [{ num: '12' }],
      'slot-rb': [{ num: '21' }],
      'slot-other': [{ num: '11' }],
      'slot-e': [{ num: '21' }],
    } as unknown as Record<string, PlacedPlayer[]>;
    const qbRows = playersFromDepthChart([qb, rb, extra, eleven], depth, formations, 'offense', 'QB');
    assert.deepEqual(qbRows.map((row) => row.player.num), ['12']);
    const rbRows = playersFromDepthChart([qb, rb, extra, eleven], depth, formations, 'offense', 'RB', {
      'offense__p-x': 'RB',
    });
    assert.deepEqual(rbRows.map((row) => row.player.num), ['21', '7']);
    const deRows = playersFromDepthChart([qb, rb, extra, eleven], depth, formations, 'defense', 'DE');
    assert.deepEqual(deRows.map((row) => row.player.num), ['21']);
  });
});

describe('hudlFilmImport', () => {
  it('reads PlaylistData ODK O/D/K, result, and rusher from Hudl export headers', async () => {
    const { parseHudlExportRows, parseHudlOdk, filmPlayLabel } = await import('./hudlFilmImport.ts');
    assert.equal(parseHudlOdk('O'), 'offense');
    assert.equal(parseHudlOdk('D'), 'defense');
    assert.equal(parseHudlOdk('K'), 'special');
    const plays = parseHudlExportRows([
      ['PLAY #', 'QTR', 'TEAM', 'ODK', 'GN/LS', 'RESULT', 'PLAY TYPE', 'DIST', 'DN', 'HASH', 'YARD LN', 'RUSHER_Jersey', 'RUSHER_Name'],
      ['1', '1', '', 'K', '', 'Fumble', 'KO', '', '', 'M', '-40', '', ''],
      ['2', '1', '', 'O', '4', 'Rush', 'Run', '10', '1', 'R', '38', '13', 'Landon Veto'],
      ['17', '2', '', 'D', '5', 'Penalty', '', '10', '1', 'R', '-25', '', ''],
    ]);
    assert.equal(plays.length, 3);
    assert.equal(plays[0].odk, 'special');
    assert.equal(plays[1].odk, 'offense');
    assert.equal(plays[1].result, 'Rush');
    assert.equal(plays[1].rusher, '#13 Landon Veto');
    assert.equal(plays[2].odk, 'defense');
    assert.match(filmPlayLabel(plays[1]), /Rush/);
  });

  it('maps Hudl ST play types to kickoff, kick return, punt, and FG/2-pt', async () => {
    const { filmStKindFromPlay, fillPackagesFromDepth, resolvePlayLineup, hydrateFilmSession } = await import(
      './hudlFilmImport.ts'
    );
    assert.equal(filmStKindFromPlay({ playType: 'KO Rec', result: 'Return' }), 'kickReturn');
    assert.equal(filmStKindFromPlay({ playType: 'KO', result: 'Return' }), 'kickoff');
    assert.equal(filmStKindFromPlay({ playType: 'Punt', result: '' }), 'punt');
    assert.equal(filmStKindFromPlay({ playType: '2 Pt.', result: 'Good' }), 'fgxp');
    assert.equal(filmStKindFromPlay({ playType: 'KO Rec', result: '' }, 'punt'), 'punt');

    const roster = [
      { id: 'p1', num: '11', firstName: 'Kit', lastName: 'Kick' },
      { id: 'p2', num: '22', firstName: 'Ret', lastName: 'Turn' },
    ] as RosterPlayer[];
    const formations = [
      form('form_ko', 'Kickoff Team', 'st', 'KO-L1'),
      form('form_kr', 'Kick Return Team', 'st', 'KR-T1'),
    ];
    formations[0].rows[0].positions[0].name = 'L1';
    formations[1].rows[0].positions[0].name = 'T1';
    const depth = {
      'KO-L1': [{ id: 'p1', name: 'Kit Kick', num: '11' } as PlacedPlayer],
      'KR-T1': [{ id: 'p2', name: 'Ret Turn', num: '22' } as PlacedPlayer],
    };
    const packages = fillPackagesFromDepth(roster, depth, formations);
    assert.equal(packages.special?.kickoff.black.L1?.num, '11');
    assert.equal(packages.special?.kickReturn.black.T1?.num, '22');

    const session = hydrateFilmSession({
      plays: [{ id: 'k1', playNumber: '1', odk: 'special', playType: 'KO Rec' }],
      packages,
      assignments: { k1: { color: 'black', slotOverrides: {}, grades: {} } },
    });
    const lineup = resolvePlayLineup(session, session.plays[0]);
    assert.equal(lineup.find((row) => row.slot.id === 'T1')?.player?.num, '22');
  });

  it('fills 4-4 defense 1s/2s/3s as black/gold/blue, not the 3s as black', async () => {
    const { fillPackagesFromDepth } = await import('./hudlFilmImport.ts');
    const roster = [
      { id: 'p8', num: '8', firstName: 'James', lastName: 'Kilkenny' },
      { id: 'p17', num: '17', firstName: 'David', lastName: 'Dicob' },
      { id: 'p99', num: '99', firstName: 'Gold', lastName: 'Two' },
    ] as RosterPlayer[];
    const formations = [
      {
        id: 'form_44',
        name: '44 Defense',
        unit: 'defense',
        rows: [{ id: 'row_44_dl', positions: [{ id: '44-WDE', name: 'WDE' }] }],
      } as FormationBoard,
    ];
    const packages = fillPackagesFromDepth(
      roster,
      {
        '44-WDE': [
          { name: 'Dicob', num: '17' },
          { name: 'Two', num: '99' },
          { name: 'Kilkenny', num: '8' },
        ],
      },
      formations
    );
    assert.equal(packages.defense.black.WDE?.num, '17');
    assert.equal(packages.defense.gold.WDE?.num, '99');
    assert.equal(packages.defense.blue.WDE?.num, '8');
  });
});

describe('live drill multi-spot assignment', () => {
  it('allows the same jersey on multiple offense spots and on defense without removing them', async () => {
    const {
      canAssignPlayerToDrillUnit,
      getPlayerLinedUpUnit,
      prepareDrillGroupForUnitAssign,
    } = await import('../components/practiceDrillsUtils.ts');
    const group: LiveDrillGroup = {
      id: 'g1',
      name: '7v7',
      format: '7v7',
      offenseLabel: 'O',
      defenseLabel: 'D',
      offensePositions: [
        { id: 'qb', name: 'QB', unit: 'offense' },
        { id: 'wr', name: 'WR', unit: 'offense' },
      ],
      defensePositions: [{ id: 'cb', name: 'CB', unit: 'defense' }],
      lineup: {
        qb: [{ num: '12', name: 'Dan' }],
        wr: [{ num: '12', name: 'Dan' }],
      },
    };
    assert.equal(getPlayerLinedUpUnit(group, '12'), 'offense');
    assert.equal(canAssignPlayerToDrillUnit(group, '12', 'offense').ok, true);
    assert.equal(canAssignPlayerToDrillUnit(group, '12', 'defense').ok, true);
    const prepared = prepareDrillGroupForUnitAssign(group, '12', 'defense');
    assert.equal(prepared.movedFrom, undefined);
    assert.equal(getPlayerLinedUpUnit(prepared.group, '12'), 'offense');
    assert.equal(canAssignPlayerToDrillUnit(group, '88', 'defense').ok, true);
  });

  it('red-boxes a jersey only when it is on both sides of the same matchup', async () => {
    const { bothSideJerseysByTeam } = await import('../components/practiceDrillsUtils.ts');
    const group: LiveDrillGroup = {
      id: 'g1',
      name: '7v7',
      format: '7v7',
      offenseLabel: 'O',
      defenseLabel: 'D',
      teamCount: 2,
      offensePositions: [{ id: 'wr', name: 'WR', unit: 'offense' }],
      defensePositions: [{ id: 'cb', name: 'CB', unit: 'defense' }],
      lineup: {
        wr: [{ num: '12', name: 'Dan' }, { num: '12', name: 'Dan' }],
        cb: [{ num: '12', name: 'Dan' }, { num: '88', name: 'Pat' }],
      },
    };
    const flags = bothSideJerseysByTeam(group);
    assert.equal(flags[0].has('12'), true);
    assert.equal(flags[1].has('12'), false);
    assert.equal(flags[2].size, 0);
  });

  it('auto-fill does not put the same jersey on matching offense and defense teams', async () => {
    const { executeIntelligentAutoFill } = await import('../components/practiceDrillsUtils.ts');
    const group: LiveDrillGroup = {
      id: 'g1',
      name: '7v7',
      format: '7v7',
      offenseLabel: 'O',
      defenseLabel: 'D',
      teamCount: 2,
      offensePositions: [{ id: 'wr', name: 'WR (X)', unit: 'offense' }],
      defensePositions: [{ id: 'cb', name: 'CB1', unit: 'defense' }],
      lineup: {},
    };
    const formations: any[] = [
      { id: 'off', unit: 'offense', rows: [{ positions: [{ id: 'dc-wr', name: 'WR (X)' }] }] },
      { id: 'def', unit: 'defense', rows: [{ positions: [{ id: 'dc-cb', name: 'CB1' }] }] },
    ];
    const result = executeIntelligentAutoFill({
      group,
      formations,
      depthChart: {
        'dc-wr': [{ num: '11', name: 'Berish' }],
        'dc-cb': [{ num: '11', name: 'Berish' }],
      },
      roster: [],
      targetString: 'all',
      fillUnit: 'both',
    });
    const o1 = result.nextLineup.wr?.[0]?.num;
    const d1 = result.nextLineup.cb?.[0]?.num;
    assert.notEqual(o1 === '11' && d1 === '11', true);
  });

  it('gives 7v7 multi-position starters both spots and the top QB most QB reps', async () => {
    const { executeIntelligentAutoFill } = await import('../components/practiceDrillsUtils.ts');
    const group: LiveDrillGroup = {
      id: 'g1',
      name: '7v7',
      format: '7v7',
      offenseLabel: 'O',
      defenseLabel: 'D',
      teamCount: 3,
      offensePositions: [
        { id: 'qb', name: 'QB', unit: 'offense' },
        { id: 'rb', name: 'RB', unit: 'offense' },
        { id: 'h', name: 'H / Slot', unit: 'offense' },
        { id: 'x', name: 'WR (X)', unit: 'offense' },
        { id: 'z', name: 'WR (Z)', unit: 'offense' },
      ],
      defensePositions: [
        { id: 'cb', name: 'CB1', unit: 'defense' },
        { id: 'fs', name: 'FS', unit: 'defense' },
      ],
      lineup: {},
    };
    const formations: any[] = [
      {
        id: 'off',
        unit: 'offense',
        rows: [{
          positions: [
            { id: 'p1', name: '1 (QB)' },
            { id: 'p2', name: '2 (FB)' },
            { id: 'p3', name: '3 (HB)' },
            { id: 'p4', name: '4 (RB)' },
            { id: 'px', name: 'X' },
            { id: 'pz', name: 'Z' },
          ],
        }],
      },
      {
        id: 'def',
        unit: 'defense',
        rows: [{
          positions: [
            { id: 'cb', name: 'CB1' },
            { id: 'fs', name: 'FS' },
          ],
        }],
      },
    ];
    const result = executeIntelligentAutoFill({
      group,
      formations,
      depthChart: {
        p1: [{ num: '10', name: 'Ace' }, { num: '19', name: 'Nardella' }, { num: '8', name: 'Kilkenny' }],
        p2: [{ num: '10', name: 'Ace' }, { num: '34', name: 'Flemming' }],
        p3: [{ num: '7', name: 'Silva' }],
        p4: [{ num: '13', name: 'Veto' }],
        px: [{ num: '11', name: 'Berish' }],
        pz: [{ num: '11', name: 'Berish' }, { num: '12', name: 'Barry' }],
        cb: [{ num: '4', name: 'Vince' }, { num: '22', name: 'Pestone' }],
        fs: [{ num: '4', name: 'Vince' }, { num: '20', name: 'Furfaro' }],
      },
      roster: [],
      targetString: 'all',
      fillUnit: 'both',
    });
    const nums = (posId: string) =>
      [0, 1, 2].map((idx) => result.nextLineup[posId]?.[idx]?.num).filter((num) => num && num !== '?');
    const qb = nums('qb');
    const rb = nums('rb');
    const fb = nums('h');
    const qbReps = qb.filter((num) => num === '10').length;
    const otherQbReps = Math.max(...['19', '8'].map((num) => qb.filter((spot) => spot === num).length), 0);
    assert.ok(qbReps > otherQbReps, `top QB reps ${qbReps} should beat ${otherQbReps}`);
    assert.ok(fb.includes('10'), 'QB/FB starter gets FB reps');
    assert.equal(fb.includes('34') || fb.includes('10'), true);
    assert.equal(rb.includes('10'), false);
    assert.equal(rb.includes('34'), false);
    assert.ok(rb.includes('7') || rb.includes('13'));
    for (let team = 0; team < 3; team++) {
      const qbNum = result.nextLineup.qb?.[team]?.num;
      const fbNum = result.nextLineup.h?.[team]?.num;
      assert.equal(qbNum === '10' && fbNum === '10', false);
    }
    assert.ok(nums('x').includes('11'));
    assert.ok(nums('z').includes('11'));
    const cbTeams = [0, 1, 2].filter((idx) => result.nextLineup.cb?.[idx]?.num === '4');
    const fsTeams = [0, 1, 2].filter((idx) => result.nextLineup.fs?.[idx]?.num === '4');
    assert.ok(cbTeams.length > 0 && fsTeams.length > 0);
    assert.equal(cbTeams.some((team) => fsTeams.includes(team)), false);
  });

  it('fills 7v7 from position groups and can re-roll receivers, Sam, and Rover', async () => {
    const { executeIntelligentAutoFill } = await import('../components/practiceDrillsUtils.ts');
    const group: LiveDrillGroup = {
      id: 'g1',
      name: '7v7',
      format: '7v7',
      offenseLabel: 'O',
      defenseLabel: 'D',
      teamCount: 2,
      offensePositions: [
        { id: 'qb', name: 'QB', unit: 'offense' },
        { id: 'x', name: 'WR (X)', unit: 'offense' },
        { id: 'z', name: 'WR (Z)', unit: 'offense' },
        { id: 'w', name: 'Slot (W)', unit: 'offense' },
      ],
      defensePositions: [
        { id: 'cb', name: 'CB1', unit: 'defense' },
        { id: 'will', name: 'WLB', unit: 'defense' },
        { id: 'sam', name: 'SLB / Nickel', unit: 'defense' },
        { id: 'rover', name: 'SS', unit: 'defense' },
      ],
      lineup: {},
    };
    const formations: any[] = [
      { id: 'form_21', unit: 'offense', name: '21 Offense', rows: [{ positions: [{ id: '21-1', name: '1 (QB)' }] }] },
      {
        id: 'form_grp_off',
        unit: 'groups',
        name: 'Offensive Depth Chart',
        rows: [{
          positions: [
            { id: 'GRP-QB', name: 'QB' },
            { id: 'GRP-X', name: 'X' },
            { id: 'GRP-Z', name: 'Z' },
            { id: 'GRP-W', name: 'W' },
          ],
        }],
      },
      {
        id: 'form_grp_def',
        unit: 'groups',
        name: 'Defensive Depth Chart',
        rows: [{
          positions: [
            { id: 'GRP-CB1', name: 'CB 1' },
            { id: 'GRP-WILL', name: 'WILL' },
            { id: 'GRP-SAM', name: 'SAM' },
            { id: 'GRP-ROVER', name: 'ROVER' },
          ],
        }],
      },
    ];
    const depthChart = {
      '21-1': [{ num: '99', name: 'Wrong' }],
      'GRP-QB': [{ num: '10', name: 'Ace' }],
      'GRP-X': [{ num: '11', name: 'Berish' }],
      'GRP-Z': [{ num: '12', name: 'Barry' }],
      'GRP-W': [{ num: '4', name: 'Vince' }],
      'GRP-CB1': [{ num: '22', name: 'Pestone' }],
      'GRP-WILL': [{ num: '7', name: 'Silva' }],
      'GRP-SAM': [{ num: '6', name: 'Henderson' }],
      'GRP-ROVER': [{ num: '8', name: 'Kilkenny' }],
    };
    const run = (roll: number) => executeIntelligentAutoFill({
      group,
      formations,
      depthChart,
      roster: [],
      targetString: 'all',
      fillUnit: 'both',
      roll,
    });
    const first = run(1);
    const qbNums = [0, 1].map((idx) => first.nextLineup.qb?.[idx]?.num);
    assert.equal(qbNums.includes('99'), false);
    assert.ok(qbNums.includes('10'));

    let xOnZ = false;
    let samOut = false;
    let roverOut = false;
    let changed = false;
    const snap = (lineup: Record<string, { num?: string }[] | undefined>) =>
      ['x', 'z', 'w', 'cb', 'will', 'sam', 'rover'].map((id) => (lineup[id] || []).map((p) => p?.num).join(',')).join('|');
    const firstSnap = snap(first.nextLineup);
    for (let roll = 1; roll <= 24; roll++) {
      const result = run(roll);
      const on = (posId: string, jersey: string) =>
        [0, 1].some((idx) => result.nextLineup[posId]?.[idx]?.num === jersey);
      if (on('z', '11') || on('w', '11')) xOnZ = true;
      if (on('cb', '6') || on('will', '6') || on('rover', '6')) samOut = true;
      if (on('cb', '8') || on('will', '8') || on('sam', '8')) roverOut = true;
      if (snap(result.nextLineup) !== firstSnap) changed = true;
    }
    assert.equal(xOnZ, true);
    assert.equal(samOut, true);
    assert.equal(roverOut, true);
    assert.equal(changed, true);
  });

  it('keeps renamed drill slots when merging remote factory defaults', async () => {
    const { mergePracticeDrillGroups } = await import('../components/practiceDrillsUtils.ts');
    const local: LiveDrillGroup[] = [{
      id: 'g1',
      name: '7v7',
      format: '7v7',
      offenseLabel: 'O',
      defenseLabel: 'D',
      lastEdited: 200,
      offensePositions: [{ id: 'qb', name: 'QB1 Gun', unit: 'offense' }],
      defensePositions: [{ id: 'cb', name: 'Boundary CB', unit: 'defense' }],
      lineup: {},
    }];
    const remote: LiveDrillGroup[] = [{
      id: 'g1',
      name: '7v7',
      format: '7v7',
      offenseLabel: 'O',
      defenseLabel: 'D',
      lastEdited: 100,
      offensePositions: [{ id: 'qb', name: 'QB', unit: 'offense' }],
      defensePositions: [{ id: 'cb', name: 'CB1', unit: 'defense' }],
      lineup: {},
    }];
    const merged = mergePracticeDrillGroups(local, remote);
    assert.equal(merged[0].offensePositions[0].name, 'QB1 Gun');
    assert.equal(merged[0].defensePositions[0].name, 'Boundary CB');
  });

  it('keeps filled 7v7 lineups when a newer factory sheet arrives', async () => {
    const { mergePracticeDrillGroups } = await import('../components/practiceDrillsUtils.ts');
    const local: any[] = [{
      id: 'live_group_7v7_old',
      name: '7v7',
      format: '7v7',
      lastEdited: 100,
      offensePositions: [{ id: 'qb', name: 'Gun QB', unit: 'offense' }],
      defensePositions: [{ id: 'cb', name: 'CB1', unit: 'defense' }],
      lineup: { qb: [{ num: '12', name: 'Dan' }] },
    }];
    const remote: any[] = [{
      id: 'live_group_7v7',
      name: '7v7',
      format: '7v7',
      lastEdited: 999999,
      offensePositions: [{ id: 'qb', name: 'QB', unit: 'offense' }],
      defensePositions: [{ id: 'cb', name: 'CB1', unit: 'defense' }],
      lineup: {},
    }];
    const merged = mergePracticeDrillGroups(local, remote);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].lineup.qb[0].num, '12');
    assert.equal(merged[0].offensePositions[0].name, 'Gun QB');
  });

  it('does not let an empty remote week wipe saved drill assignments', async () => {
    const { mergePracticeDrillGroups } = await import('../components/practiceDrillsUtils.ts');
    const local: any[] = [{
      id: 'live_group_11v11',
      name: '11v11',
      format: '11v11',
      lastEdited: 50,
      offensePositions: [{ id: 'lt', name: 'LT', unit: 'offense' }],
      defensePositions: [{ id: 'de', name: 'LDE', unit: 'defense' }],
      lineup: { lt: [{ num: '55', name: 'Mike' }] },
    }];
    const merged = mergePracticeDrillGroups(local, []);
    assert.equal(merged[0].lineup.lt[0].num, '55');
  });
});

describe('hudl scout', () => {
  it('parses a Hudl CSV play into offense run tendencies', async () => {
    const { parseCsvRows, autoDetectColumnMapping, normalizeHudlRow } = await import('../hudlScout/utils/csvParser.ts');
    const { calculateTendencies } = await import('../hudlScout/utils/tendencyEngine.ts');
    const csv = `PLAY #,QTR,ODK,PLAY TYPE,DN,DIST,GN/LS,HASH,YARD LN
1,1,O,Run,1,10,5,R,-35`;
    const { headers, rows } = parseCsvRows(csv);
    const mapping = autoDetectColumnMapping(headers);
    const play = normalizeHudlRow(rows[0], mapping, 0);
    assert.equal(play.odk, 'O');
    const analysis = calculateTendencies([play]);
    assert.equal(analysis.totalPlays, 1);
    assert.equal(analysis.runPlays, 1);
  });

  it('builds a local gameplan from Hudl tendencies', async () => {
    const { parseCsvRows, autoDetectColumnMapping, normalizeHudlRow } = await import('../hudlScout/utils/csvParser.ts');
    const { calculateTendencies } = await import('../hudlScout/utils/tendencyEngine.ts');
    const { buildLocalGameplan, answerCoachQuestion } = await import('../hudlScout/utils/buildLocalGameplan.ts');
    const csv = `PLAY #,QTR,ODK,PLAY TYPE,DN,DIST,GN/LS,HASH,YARD LN
1,1,O,Run,1,10,5,R,-35
2,1,O,Pass,3,8,12,L,+40`;
    const { headers, rows } = parseCsvRows(csv);
    const mapping = autoDetectColumnMapping(headers);
    const plays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    const analysis = calculateTendencies(plays);
    const report = buildLocalGameplan(analysis, plays, 'Carmel');
    assert.ok(report.executiveSummary.includes('Carmel'));
    assert.ok(report.wristbandCallSheet.firstDownCalls.length > 0);
    const answer = answerCoachQuestion('What do they do on 1st down?', analysis, plays, 'Carmel', report);
    assert.ok(answer.toLowerCase().includes('1st'));
  });

  it('counts left-hash field runs as wide side and middle-hash favor without double-counting', async () => {
    const { parseCsvRows, autoDetectColumnMapping, normalizeHudlRow, classifyRunSide } = await import('../hudlScout/utils/csvParser.ts');
    const { calculateTendencies } = await import('../hudlScout/utils/tendencyEngine.ts');
    assert.equal(classifyRunSide('Right', 'L'), 'R');
    assert.equal(classifyRunSide('Field', 'L'), 'R');
    assert.equal(classifyRunSide('Boundary', 'R'), 'R');
    assert.equal(classifyRunSide('Left', 'R'), 'L');
    const csv = `PLAY #,QTR,ODK,PLAY TYPE,DN,DIST,GN/LS,HASH,YARD LN,PLAY DIR
1,1,O,Run,1,10,5,L,-35,Right
2,1,O,Run,1,10,4,L,-30,Left
3,1,O,Run,1,10,3,R,-25,Left
4,1,O,Run,1,10,2,M,-20,Left
5,1,O,Run,1,10,6,M,-15,Right
6,1,O,Run,1,10,1,R,-10,Right`;
    const { headers, rows } = parseCsvRows(csv);
    const mapping = autoDetectColumnMapping(headers);
    const plays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    const analysis = calculateTendencies(plays);
    assert.equal(analysis.runPlays, 6);
    const dirSum = Object.values(analysis.runDirections).reduce((a, b) => a + b, 0);
    assert.equal(dirSum, 6);
    assert.equal(analysis.wideSide.wideCount, 2);
    assert.equal(analysis.wideSide.boundaryCount, 2);
    assert.equal(analysis.hashTendencies.left.widePct, 50);
    assert.equal(analysis.hashTendencies.left.boundaryPct, 50);
    assert.equal(analysis.hashTendencies.middle.runLeftPct, 50);
    assert.equal(analysis.hashTendencies.middle.runRightPct, 50);
    assert.equal(analysis.hashTendencies.right.widePct, 50);
    assert.equal(analysis.hashTendencies.right.boundaryPct, 50);
  });

  it('does not let inside-hash dives shrink wide-side percentage', async () => {
    const { parseCsvRows, autoDetectColumnMapping, normalizeHudlRow, classifyRunSide } = await import('../hudlScout/utils/csvParser.ts');
    const { calculateTendencies } = await import('../hudlScout/utils/tendencyEngine.ts');
    assert.equal(classifyRunSide('8', 'L'), 'R');
    assert.equal(classifyRunSide('2', 'R'), 'L');
    const csv = `PLAY #,QTR,ODK,PLAY TYPE,DN,DIST,GN/LS,HASH,YARD LN,PLAY DIR,RESULT
1,1,O,Run,1,10,5,L,-35,Right,Gain
2,1,O,Run,1,10,4,L,-30,M,Gain
3,1,O,Run,1,10,3,L,-25,M,Gain
4,1,O,Penalty,1,10,0,L,-20,Right,Penalty`;
    const { headers, rows } = parseCsvRows(csv);
    const mapping = autoDetectColumnMapping(headers);
    const plays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    const analysis = calculateTendencies(plays);
    assert.equal(analysis.wideSide.wideCount, 1);
    assert.equal(analysis.wideSide.boundaryCount, 0);
    assert.equal(analysis.wideSide.widePct, 100);
    assert.equal(analysis.hashTendencies.left.widePct, 100);
  });

  it('converts an Excel workbook into Hudl CSV rows', async () => {
    const XLSX = await import('xlsx');
    const { workbookBufferToCsv, parseCsvRows, autoDetectColumnMapping, normalizeHudlRow } = await import('../hudlScout/utils/csvParser.ts');
    const ws = XLSX.utils.aoa_to_sheet([
      ['PLAY #', 'QTR', 'ODK', 'PLAY TYPE', 'DN', 'DIST', 'GN/LS', 'HASH', 'YARD LN', 'PLAY DIR'],
      [1, 1, 'O', 'Run', 1, 10, 5, 'L', -35, 'Right'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hudl');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const csv = workbookBufferToCsv(buffer);
    const { headers, rows } = parseCsvRows(csv);
    const play = normalizeHudlRow(rows[0], autoDetectColumnMapping(headers), 0);
    assert.equal(play.odk, 'O');
    assert.equal(play.hash, 'L');
    assert.equal(play.runSide, 'R');
  });

  it('does not invent a motion tell when the export has no motion direction', async () => {
    const { parseCsvRows, autoDetectColumnMapping, normalizeHudlRow, hasMotionDirectionData } = await import('../hudlScout/utils/csvParser.ts');
    const { calculateTendencies } = await import('../hudlScout/utils/tendencyEngine.ts');
    const header = 'PLAY #,QTR,ODK,PLAY TYPE,DN,DIST,GN/LS,HASH,YARD LN';
    const rowsCsv = [1, 2, 3, 4, 5, 6]
      .map((n) => `${n},1,O,Pass,1,10,8,L,-30`)
      .join('\n');
    const { headers, rows } = parseCsvRows(`${header}\n${rowsCsv}`);
    const mapping = autoDetectColumnMapping(headers);
    assert.equal(mapping.motion, '');
    const plays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    assert.equal(hasMotionDirectionData(plays), false);
    const analysis = calculateTendencies(plays);
    assert.ok(!analysis.tells.some((t) => t.category === 'MOTION'));
    assert.ok(analysis.formations.every((f) => f.motionPct === 0));
  });

  it('flags a motion tell only when motion direction is tagged', async () => {
    const { parseCsvRows, autoDetectColumnMapping, normalizeHudlRow, hasMotionDirectionData } = await import('../hudlScout/utils/csvParser.ts');
    const { calculateTendencies } = await import('../hudlScout/utils/tendencyEngine.ts');
    const csv = `PLAY #,QTR,ODK,PLAY TYPE,DN,DIST,GN/LS,HASH,YARD LN,MOTION DIR
1,1,O,Pass,1,10,8,L,-30,Jet L
2,1,O,Pass,1,10,12,L,-25,Jet L
3,1,O,Pass,1,10,6,R,-20,Orbit R
4,1,O,Pass,1,10,9,R,-15,Orbit R`;
    const { headers, rows } = parseCsvRows(csv);
    const mapping = autoDetectColumnMapping(headers);
    assert.equal(mapping.motion, 'MOTION DIR');
    const plays = rows.map((r, i) => normalizeHudlRow(r, mapping, i));
    assert.equal(hasMotionDirectionData(plays), true);
    const analysis = calculateTendencies(plays);
    const motionTell = analysis.tells.find((t) => t.id === 'tell-motion');
    assert.ok(motionTell);
    assert.ok(motionTell.title.includes('Pass'));
  });

  it('drops one tagged upload from a stacked scout report', async () => {
    const { removeScoutGame, clearScoutUploads } = await import('../hudlScout/scoutBundle.ts');
    const bundle = {
      plays: [
        { id: 'a', gameId: 'g1' },
        { id: 'b', gameId: 'g2' },
      ],
      datasetName: 'Carmel',
      offensiveScheme: '',
      coachNotes: '',
      filters: { odk: 'O', quarter: 'ALL', down: 'ALL', fieldZone: 'ALL', hash: 'ALL', playType: 'ALL', formation: 'ALL' },
      games: [
        { id: 'g1', name: 'wrong.xlsx', playCount: 1, addedAt: 1 },
        { id: 'g2', name: 'right.csv', playCount: 1, addedAt: 2 },
      ],
      updatedAt: 1,
      sourceCleared: false,
    } as any;
    const afterOne = removeScoutGame(bundle, 'g1', 'Opponent');
    assert.equal(afterOne.plays.length, 1);
    assert.equal(afterOne.plays[0].id, 'b');
    assert.equal(afterOne.games.length, 1);
    assert.equal(afterOne.games[0].name, 'right.csv');
    const cleared = clearScoutUploads(afterOne, 'Opponent');
    assert.equal(cleared.plays.length, 0);
    assert.equal(cleared.games.length, 0);
    assert.equal(cleared.sourceCleared, true);
  });
});

describe('practice template merge', () => {
  it('keeps custom templates when a default-only cloud snapshot arrives', async () => {
    const { mergePracticeTemplates } = await import('../services/storageService.ts');
    const customPeriod = {
      time: 12,
      category: 'Indy',
      format: 'static',
      stations: [{ name: 'Inside run', desc: '', coach: '', focus: '' }],
    };
    const merged = mergePracticeTemplates(
      { 'Tuesday Pads': [customPeriod] },
      {}
    );
    assert.ok(merged['Tuesday Pads']);
    assert.equal(merged['Tuesday Pads'].length, 1);
    assert.equal(merged['Tuesday Pads'][0].category, 'Indy');
    assert.ok(merged['Standard Practice']);
  });

  it('keeps the richer copy of a shared template name', async () => {
    const { mergePracticeTemplates } = await import('../services/storageService.ts');
    const thin = [{ time: 5, category: 'Stretch', format: 'static', stations: [] }];
    const rich = [
      { time: 10, category: 'Stretch', format: 'static', stations: [{ name: 'A', desc: '', coach: '', focus: '' }] },
      { time: 15, category: 'Indy', format: 'static', stations: [{ name: 'B', desc: '', coach: '', focus: '' }] },
    ];
    const merged = mergePracticeTemplates(
      { 'Team Script': thin },
      { 'Team Script': rich }
    );
    assert.equal(merged['Team Script'].length, 2);
  });

  it('does not swap a just-saved template for a thinner remote copy', async () => {
    const { mergePracticeTemplates } = await import('../services/storageService.ts');
    const local = [
      { time: 10, category: 'Install', format: 'static', stations: [{ name: '11s', desc: '', coach: '', focus: '' }] },
      { time: 10, category: 'Team', format: 'static', stations: [{ name: 'Skelly', desc: '', coach: '', focus: '' }] },
    ];
    const remote = [{ time: 5, category: 'Stretch', format: 'static', stations: [] }];
    const merged = mergePracticeTemplates(
      { 'Game Week': local },
      { 'Game Week': remote },
      { lastLocalEditTime: Date.now() - 1000, now: Date.now() }
    );
    assert.equal(merged['Game Week'].length, 2);
  });
});

describe('scout call sheet edits sync between coaches', () => {
  const base = { plays: [{ id: 'p1' }], games: [{ id: 'g1', name: 'carmel.csv' }], datasetName: 'Carmel' };

  it('keeps the newer coach edit', () => {
    const older = { ...base, updatedAt: 100, callSheet: { sections: { firstDownCalls: ['Old call'] }, updatedAt: 100 } };
    const newer = { ...base, updatedAt: 200, callSheet: { sections: { firstDownCalls: ['New call'] }, updatedAt: 200 } };
    const merged = mergeScoutingReports({ hudlScout: older }, { hudlScout: newer });
    assert.deepEqual(merged.hudlScout.callSheet.sections.firstDownCalls, ['New call']);
  });

  it('a reset to suggested is not undone by an older edited copy', () => {
    const edited = { ...base, updatedAt: 100, callSheet: { sections: { redZoneLocks: ['Goal line 6-2'] }, updatedAt: 100 } };
    const reset = { ...base, updatedAt: 200, callSheet: { sections: {}, updatedAt: 200 } };
    const merged = mergeScoutingReports({ hudlScout: edited }, { hudlScout: reset });
    assert.deepEqual(merged.hudlScout.callSheet.sections, {});
  });

  it('an edit survives a newer copy that never touched the call sheet', () => {
    const edited = { ...base, updatedAt: 100, callSheet: { sections: { runStopCalls: ['Bear front'] }, updatedAt: 100 } };
    const newerNoSheet = { ...base, updatedAt: 200 };
    const merged = mergeScoutingReports({ hudlScout: edited }, { hudlScout: newerNoSheet });
    assert.deepEqual(merged.hudlScout.callSheet.sections.runStopCalls, ['Bear front']);
  });

  it('reads saved edits back into the bundle', async () => {
    const { bundleFromSaved } = await import('../hudlScout/scoutBundle.ts');
    const bundle = bundleFromSaved({ ...base, updatedAt: 5, callSheet: { sections: { passBlitzCalls: ['Fire zone'] }, note: 'Keep contain', updatedAt: 5 } }, 'X');
    assert.deepEqual(bundle.callSheet?.sections.passBlitzCalls, ['Fire zone']);
    assert.equal(bundle.callSheet?.note, 'Keep contain');
    assert.equal(bundleFromSaved({ ...base, updatedAt: 5 }, 'X').callSheet, undefined);
  });
});

describe('hudl scout backup', () => {
  it('packs opponent week uploads and our-team files into the backup snapshot', async () => {
    const { collectHudlScoutBackup, summarizeHudlScoutBackup, applyHudlScoutBackup } = await import(
      '../utils/remoteStateMerge.ts'
    );
    const opp = { plays: [{ id: 'p1' }], games: [{ id: 'g1', name: 'carmel.csv' }], datasetName: 'Carmel', updatedAt: 9 };
    const own = { plays: [{ id: 'p2' }, { id: 'p3' }], games: [{ id: 'g2', name: 'us.csv' }], datasetName: 'Mahopac', updatedAt: 8 };
    const packed = collectHudlScoutBackup(
      { 'team_10u__week_4': { scouting: { hudlScout: opp } } },
      { team_10u: own }
    );
    assert.equal(packed.opponentByWeek['team_10u__week_4'].plays.length, 1);
    assert.equal(packed.ownTeam.team_10u.plays.length, 2);
    const summary = summarizeHudlScoutBackup({ hudlScoutUploads: packed });
    assert.equal(summary.isAvailable, true);
    assert.equal(summary.playCount, 3);
    assert.equal(summary.weekCount, 1);
    assert.equal(summary.teamCount, 1);
    const restored = applyHudlScoutBackup({}, {}, packed);
    assert.equal(restored.weeklyData['team_10u__week_4'].scouting.hudlScout.datasetName, 'Carmel');
    assert.equal(restored.ownTeamHudlScout.team_10u.plays.length, 2);
  });
});

describe('weekday practice templates', () => {
  it('picks the template assigned to that weekday', async () => {
    const { resolvePracticeTemplateForWeekday } = await import('./practiceUtils.ts');
    const names = ['Standard Practice', 'Tuesday Full Pads', 'Thursday Walkthrough'];
    assert.equal(
      resolvePracticeTemplateForWeekday('Tuesday', { Tuesday: 'Tuesday Full Pads' }, names),
      'Tuesday Full Pads'
    );
    assert.equal(
      resolvePracticeTemplateForWeekday('Thursday', { Tuesday: 'Tuesday Full Pads' }, names),
      'Standard Practice'
    );
    assert.equal(
      resolvePracticeTemplateForWeekday('Friday', { Friday: 'Missing Template' }, names),
      'Standard Practice'
    );
  });

  it('applies weekday templates only to future plans in that year', async () => {
    const { shouldApplyWeekdayTemplateToPlan } = await import('./practiceUtils.ts');
    const tueFuture = {
      id: 'p1',
      date: '2026-09-29',
      day: 'Tuesday',
      year: '2026',
      title: 'Week 5 Tuesday',
    };
    const tuePast = {
      id: 'p0',
      date: '2026-09-22',
      day: 'Tuesday',
      year: '2026',
      title: 'Week 4 Tuesday',
    };
    const thuFuture = {
      id: 'p2',
      date: '2026-10-01',
      day: 'Thursday',
      year: '2026',
      title: 'Week 5 Thursday',
    };
    const opts = { weekday: 'Tuesday', year: '2026', today: '2026-09-24', teamId: 'team_10u' };
    assert.equal(shouldApplyWeekdayTemplateToPlan(tueFuture as any, opts), true);
    assert.equal(shouldApplyWeekdayTemplateToPlan(tuePast as any, opts), false);
    assert.equal(shouldApplyWeekdayTemplateToPlan(thuFuture as any, opts), false);
    assert.equal(
      shouldApplyWeekdayTemplateToPlan({ ...tueFuture, day: 'Thursday' } as any, opts),
      true
    );
    assert.equal(
      shouldApplyWeekdayTemplateToPlan({ ...tueFuture, year: '2025' } as any, opts),
      true
    );
    assert.equal(
      shouldApplyWeekdayTemplateToPlan({ ...tueFuture, title: 'Pre-Game Warmup: Carmel' } as any, opts),
      false
    );
  });
});

describe('schedule deletes and roster saves stick', () => {
  const ev = (id: string, date: string, title = 'Practice') => ({ id, date, title, type: 'practice', teamId: 'team_10u', lastEdited: 1 });

  it('drops tombstoned events from both local and remote copies', async () => {
    const { mergeScheduleEvents } = await import('./remoteStateMerge.ts');
    const local = [ev('a', '2026-09-01'), ev('b', '2026-09-02')];
    const remote = [ev('a', '2026-09-01'), ev('b', '2026-09-02'), ev('c', '2026-09-03')];
    const ids = (list: any[]) => list.map((e) => e.id).sort();
    assert.deepEqual(ids(mergeScheduleEvents(local, remote)), ['a', 'b', 'c']);
    assert.deepEqual(ids(mergeScheduleEvents(local, remote, ['b'])), ['a', 'c']);
    // one side empty still honors tombstones
    assert.deepEqual(ids(mergeScheduleEvents([], remote, ['c'])), ['a', 'b']);
    assert.deepEqual(ids(mergeScheduleEvents(local, [], new Set(['a']))), ['b']);
  });

  it('unions tombstone lists without blanks or duplicates', async () => {
    const { mergeDeletedIds } = await import('./remoteStateMerge.ts');
    assert.deepEqual(mergeDeletedIds(['a', 'b'], ['b', '', 'c'], undefined, null).sort(), ['a', 'b', 'c']);
  });

  it('server keeps a deleted event out even when an older copy still has it', async () => {
    const { mergeServerState } = await import('../../server/stateMerge.ts');
    const current = { scheduleEvents: [ev('a', '2026-09-01'), ev('b', '2026-09-02')] };
    const afterDelete = mergeServerState(current, { scheduleEvents: [ev('a', '2026-09-01')], deletedScheduleEventIds: ['b'] }, { scope: 'schedule' });
    assert.deepEqual(afterDelete.scheduleEvents.map((e: any) => e.id), ['a']);
    assert.deepEqual(afterDelete.deletedScheduleEventIds, ['b']);
    // a stale device later saves the old list without tombstones: 'b' must stay gone
    const stale = mergeServerState(afterDelete, { scheduleEvents: [ev('a', '2026-09-01'), ev('b', '2026-09-02')] }, { scope: 'schedule' });
    assert.deepEqual(stale.scheduleEvents.map((e: any) => e.id), ['a']);
  });

  it('server replaces the roster on a roster save but still merges other saves', async () => {
    const { mergeServerState } = await import('../../server/stateMerge.ts');
    const p = (num: string) => ({ id: 'p' + num, num, firstName: 'P', lastName: num });
    const current = { roster: [p('1'), p('2'), p('3')] };
    const removed = mergeServerState(current, { roster: [p('1'), p('3')] }, { scope: 'roster' });
    assert.deepEqual(removed.roster.map((x: any) => x.num), ['1', '3']);
    const other = mergeServerState(current, { roster: [p('1')] }, { scope: 'practice' });
    assert.deepEqual(other.roster.map((x: any) => x.num).sort(), ['1', '2', '3']);
  });

  it('server does not let a stale default roster re-add a deleted player', async () => {
    const { mergeServerState } = await import('../../server/stateMerge.ts');
    const p = (num: string, extra: any = {}) => ({ id: 'p' + num, num, firstName: 'P', lastName: num, ...extra });
    const afterDelete = { roster: [p('1'), p('3')] };
    // a fresh device saves its built-in roster (still containing #2) under another scope
    const stale = mergeServerState(afterDelete, { roster: [p('1', { paddedHours: 2 }), p('2'), p('3')] }, { scope: 'attendance' });
    assert.deepEqual(stale.roster.map((x: any) => x.num), ['1', '3']);
    assert.equal(stale.roster[0].paddedHours, 2, 'existing players still take updates');
    // a deliberate full push or backup restore may still add players
    const restored = mergeServerState(afterDelete, { roster: [p('1'), p('2'), p('3')] }, { scope: 'import_backup' });
    assert.deepEqual(restored.roster.map((x: any) => x.num).sort(), ['1', '2', '3']);
  });
});

describe('call sheets and wristbands saved for the shown team and week', () => {
  it('matches tagged sheets exactly and lets untagged ones through', async () => {
    const { savedForTeamWeek } = await import('./remoteStateMerge.ts');
    assert.equal(savedForTeamWeek({ teamId: 'team_10u', week: '4' }, 'team_10u', '4'), true);
    assert.equal(savedForTeamWeek({ teamId: 'team_10u', week: '4' }, 'team_10u', '5'), false);
    assert.equal(savedForTeamWeek({ teamId: 'team_9u', week: '4' }, 'team_10u', '4'), false);
    assert.equal(savedForTeamWeek({ teamId: 'team-10u', week: 'Week 4' }, 'team_10u', '4'), true);
    // preseason keys must not collide with regular weeks
    assert.equal(savedForTeamWeek({ week: 'pre-1' }, 'team_10u', '1'), false);
    assert.equal(savedForTeamWeek({}, 'team_10u', '4'), true);
    assert.equal(savedForTeamWeek(null, 'team_10u', '4'), false);
  });
});

describe('games with film but no Hudl breakdown', () => {
  const node = (name: string, videos = 0, dirs: any[] = []): any => ({ name, open: async () => ({ dirs, videos }) });
  const tree = () =>
    node('Mahopac Film', 0, [
      node('10U', 0, [
        node('Week 1 - Suffern', 5),
        node('Week 2 - Yorktown', 0, [node('Sideline', 4), node('End Zone', 4)]),
        node('Game vs Beacon', 3),
        node('Week 4 - Empty'),
        node('Scouting', 0, [
          node('Week 5 - Wappingers', 0, [node('vs Carmel 9-6', 6), node('vs Somers 9-13', 5)]),
          node('Wappingers Film', 3),
        ]),
      ]),
    ]);

  it('finds every game folder with film, and says which folders it could not place', async () => {
    const { findFilmFolders } = await import('../filmroom/folderRoutes.ts');
    const found = await findFilmFolders(tree(), 'Mahopac 10U Youth Tackle');
    const label = (g: any) => `${g.source}:${g.week}:${g.name}`;
    assert.deepEqual(found.games.map(label), [
      'own:1:Week 1 - Suffern',
      'own:2:Week 2 - Yorktown',
      'opponent:5:Wappingers vs Carmel 9-6',
      'opponent:5:Wappingers vs Somers 9-13',
    ]);
    assert.deepEqual(found.unplaced.map((u) => u.path.slice(1).join('/')), ['Game vs Beacon', 'Scouting/Wappingers Film']);
    assert.match(found.unplaced[0].reason, /Week 3/);
    assert.ok(new Set(found.games.map((g) => g.id)).size === found.games.length, 'each folder has its own id');
  });

  it('lists film-only games in their week, and leaves a week alone that already has a game', async () => {
    const { findFilmFolders } = await import('../filmroom/folderRoutes.ts');
    const { buildLibrary } = await import('../filmroom/FilmLibrary.tsx');
    const { games } = await findFilmFolders(tree(), 'Mahopac 10U Youth Tackle');
    const weeks = [
      { key: '1', label: 'Week 1', opponent: 'Suffern' },
      { key: '2', label: 'Week 2', opponent: 'Yorktown' },
      { key: '5', label: 'Week 5', opponent: 'Wappingers' },
    ];
    const lib = buildLibrary(weeks, [{ id: 'g2', name: 'MSA vs Yorktown', week: '2', playCount: 40 }], '5', undefined, games);
    const byWeek = Object.fromEntries(lib.weeks.map((w) => [w.key, w.games.map((g) => `${g.name}${g.filmOnly ? ' (film)' : ''}`)]));
    assert.deepEqual(byWeek['1'], ['Week 1 - Suffern (film)']);
    assert.deepEqual(byWeek['2'], ['MSA vs Yorktown'], 'week 2 already has our game from Hudl');
    assert.deepEqual(byWeek['5'], ['Wappingers vs Carmel 9-6 (film)', 'Wappingers vs Somers 9-13 (film)']);
    // Hudl's own scouting game for the week wins over the film-only ones.
    const withScout = buildLibrary(weeks, [], '5', { games: [{ id: 'a', name: 'Somers vs Carmel O', playCount: 80 }], plays: [{}] }, games);
    assert.deepEqual(withScout.weeks.find((w) => w.key === '5')!.games.map((g) => g.name), ['Somers vs Carmel O']);
  });

  it('makes each clip a play, in order, with notes that stay with the clip', async () => {
    const { playsFromClips } = await import('../filmroom/clipPlays.ts');
    const clips = [
      { kind: 'drive', id: 'a', name: 'IMG_0012.MOV' },
      { kind: 'drive', id: 'b', name: 'IMG_0013.MOV' },
      { kind: 'drive', id: 'c', name: 'IMG_0013.MOV' },
    ] as any;
    const plays = playsFromClips(clips, 'film-own-x');
    assert.deepEqual(plays.map((p) => p.playNumber), [1, 2, 3]);
    assert.equal(plays[0].id, 'clip-img-0012');
    assert.equal(new Set(plays.map((p) => p.id)).size, 3, 'two clips with the same name still get their own id');
    assert.equal(plays[0].playName, 'IMG_0012');
    assert.equal(plays[0].gameId, 'film-own-x');
  });
});

describe('our defense tagged from the depth chart', () => {
  const pos = (id: string, name: string) => ({ id, name });
  const board = (name: string, unit: string, positions: { id: string; name: string }[]) =>
    ({ id: name, unit, name, rows: [{ id: 'r', positions }] }) as any;
  const formations = [
    board('44 Defense', 'defense', [pos('44-WDE', 'WDE'), pos('44-DT1', 'DT 1'), pos('44-DT2', 'DT 2'), pos('44-SDE', 'SDE'), pos('44-MIKE', 'MIKE'), pos('44-CB1', 'CB 1'), pos('44-CB2', 'CB 2')]),
    board('53 Defense', 'defense', [pos('53-DE1', 'DE 1'), pos('53-NT', 'NT'), pos('53-MIKE', 'MIKE')]),
    board('Defensive Depth Chart', 'groups', [pos('GRP-MIKE', 'MIKE'), pos('GRP-SAM', 'SAM')]),
  ];
  const p = (num: string, name: string) => ({ num, name });
  const depthChart = {
    '44-MIKE': [p('21', 'Ward'), p('40', 'Sokol'), p('44', 'Jones')],
    '44-SDE': [p('55', 'Strong'), p('56', 'Gold SDE')],
    '44-WDE': [p('50', 'Weak')],
    '44-CB1': [p('3', 'Corner One')],
    '44-CB2': [p('4', 'Corner Two')],
    '53-NT': [p('77', 'Nose')],
    '53-DE1': [p('90', 'End One')],
    'GRP-SAM': [p('10', 'Sam Black'), p('11', 'Sam Gold')],
  } as any;
  const src = { depthChart, formations, roster: [{ num: '21', firstName: 'Landon', lastName: 'Ward' }] as any };
  const nodes = ['E9', 'T3', 'T1', 'E5', 'MIKE', 'CBL', 'CBR', 'SAM'].map((role) => ({ role, x: 0, y: 1 }));

  it('takes Black, Gold or Blue from the depth chart order', async () => {
    const { lineupForDefense } = await import('./defenseLineup.ts');
    const at = (unit: any) => lineupForDefense(nodes, { unit, front: '44', strongLeft: false, src });
    assert.equal(at('black').MIKE.num, '21');
    assert.equal(at('gold').MIKE.num, '40');
    assert.equal(at('blue').MIKE.num, '44');
    assert.equal(at('black').MIKE.unit, 'black');
    assert.equal(at('black').MIKE.pos, 'MIKE');
  });

  it('puts the strong-side end and the corners on the side the look is set to', async () => {
    const { lineupForDefense } = await import('./defenseLineup.ts');
    const right = lineupForDefense(nodes, { unit: 'black', front: '44', strongLeft: false, src });
    assert.equal(right.E5.pos, 'SDE');
    assert.equal(right.E9.pos, 'WDE');
    assert.equal(right.CBR.pos, 'CB 1');
    const left = lineupForDefense(nodes, { unit: 'black', front: '44', strongLeft: true, src });
    assert.equal(left.E9.pos, 'SDE');
    assert.equal(left.E9.num, '55');
    assert.equal(left.E5.pos, 'WDE');
    assert.equal(left.CBL.pos, 'CB 1');
  });

  it('leaves out a spot nobody is on, and uses the defensive depth chart when the board is empty', async () => {
    const { lineupForDefense } = await import('./defenseLineup.ts');
    const out = lineupForDefense(nodes, { unit: 'blue', front: '44', strongLeft: false, src });
    assert.equal(out.E5, undefined, 'nobody third string at SDE');
    assert.equal(out.SAM, undefined, 'no blue SAM anywhere');
    const gold = lineupForDefense(nodes, { unit: 'gold', front: '44', strongLeft: false, src });
    assert.equal(gold.SAM.num, '11', 'SAM is on the groups board only');
  });

  it('uses the 44 Defense chart for every look, and the 5-3 chart only for spots the 44 does not have', async () => {
    const { lineupForDefense } = await import('./defenseLineup.ts');
    const withFiveThree = { ...src, depthChart: { ...depthChart, '53-MIKE': [p('22', 'Pestone')] } };
    const out = lineupForDefense([{ role: 'MIKE', x: 0, y: 3 }, { role: 'NT', x: 0, y: 1 }], { unit: 'black', front: '53', strongLeft: false, src: withFiveThree });
    assert.equal(out.MIKE.num, '21', 'MIKE comes from the 44 Defense chart');
    assert.equal(out.NT.num, '77', 'NT is only on the 53 chart');
  });

  it('shows the tagged player\'s name on a defender, unless the coach typed one', async () => {
    const { shownText, shortPlayerName } = await import('./footballEngine.ts');
    const node = { role: 'MIKE', x: 0, y: 3 } as any;
    assert.equal(shownText(node, 'M'), 'M');
    assert.equal(shownText({ ...node, player: { num: '21', name: 'Ward' } }, 'M'), 'Ward');
    assert.equal(shownText({ ...node, player: { num: '21', name: 'Ward' }, label: 'Sam' }, 'M'), 'Sam');
    assert.equal(shortPlayerName('Cambigianis'), 'Cambigia\u2026');
  });

  it('lets a coach set one defender, and reads the 5-3 board for a 5-3 look', async () => {
    const { lineupForDefense } = await import('./defenseLineup.ts');
    const set = lineupForDefense(nodes, { unit: 'black', front: '44', strongLeft: false, src, overrides: { MIKE: p('99', 'Sub') } });
    assert.equal(set.MIKE.num, '99');
    const five = lineupForDefense([{ role: 'NT', x: 0, y: 1 }, { role: 'E9', x: -7, y: 1 }], { unit: 'black', front: '53', strongLeft: false, src });
    assert.equal(five.NT.num, '77');
    assert.equal(five.E9.num, '90');
  });
});

describe('their plays combined by play type', () => {
  const card = (name: string, formation = '', personnel = '', kind: any = 'run') =>
    ({ id: name, gameId: 'g', name, formation, personnel, kind, down: '1st', notes: '', onReport: true, editedAt: 0 }) as any;

  it('counts the same play run left or right, or by another back to the other hole, as one type', async () => {
    const { groupOppPlays } = await import('./scoutOppPlays.ts');
    const groups = groupOppPlays([
      card('32 L WB 44 ZONE'),
      card('32 R WB 43 ZONE'),
      card('37 Zone', 'Wishbone', '32'),
      card('43 zone', 'WISHBONE', '32'),
      card('30 DW 41 SWEEP'),
      card('30 DW 49 SWEEP'),
      card('21 R WT 23 DIVE'),
      card('21 R WT 23 POWER'),
      card('TWINS L Z BUBBLE', 'TWINS LT', '11', 'screen'),
      card('TWINS R Z BUBBLE', 'TWINS RT', '11', 'screen'),
    ]);
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.plays.map((p: any) => p.name)]));
    assert.deepEqual(byLabel['32 Wishbone · Inside Zone'], ['32 L WB 44 ZONE', '32 R WB 43 ZONE', '37 Zone', '43 zone']);
    assert.deepEqual(byLabel['30 Double Wing · Toss / Sweep'], ['30 DW 41 SWEEP', '30 DW 49 SWEEP']);
    assert.equal(groups.length, 5, 'dive and power stay apart; the bubbles go together');
  });

  it('keeps a different formation or personnel as its own type', async () => {
    const { groupOppPlays } = await import('./scoutOppPlays.ts');
    const groups = groupOppPlays([card('32 L WB 44 ZONE'), card('21 L WT 44 ZONE'), card('32 L DW 44 ZONE')]);
    assert.equal(groups.length, 3);
  });

  it('draws a play type on the play the coach drew', async () => {
    const { leadOppPlay } = await import('./filmBackfields.ts');
    const a = card('32 L WB 44 ZONE');
    const b = card('32 R WB 43 ZONE');
    assert.equal(leadOppPlay([a, b], []).id, a.id);
    assert.equal(leadOppPlay([a, b], [{ id: `scout_${b.id}`, builder: {} } as any]).id, b.id);
  });
});

describe('call sheet first row mirrors the wristbands', () => {
  it('adds one table per wristband color column on row 1 and stays stable on re-sync', async () => {
    const { syncWristbandToCallSheet, listWristbandColumns, isAutoWristbandRowTable } = await import('./wristbandLinking.ts');
    const { INITIAL_TWO_WRISTBANDS_DATA } = await import('../data/userGameDayPlays.ts');
    const { DEFAULT_CALL_SHEET_DATA } = await import('../data/callSheetData.ts');
    const wb = INITIAL_TWO_WRISTBANDS_DATA;
    const cols = listWristbandColumns(wb);
    assert.ok(cols.length > 0, 'fixture wristband has columns');

    const base = { ...DEFAULT_CALL_SHEET_DATA, offenseSections: DEFAULT_CALL_SHEET_DATA.offenseSections.filter((s: any) => !isAutoWristbandRowTable(s)) };
    const customIds = base.offenseSections.map((s: any) => s.id);
    const once = syncWristbandToCallSheet(wb, base);
    const auto = once.offenseSections.filter(isAutoWristbandRowTable);
    assert.equal(auto.length, cols.length);
    assert.deepEqual(auto.map((s: any) => s.title), cols.map((c) => c.header));
    assert.ok(auto.slice(0, 4).every((s: any) => s.rowIndex === 0), 'first four wristband tables sit on row 1');
    auto.slice(0, 4).forEach((s: any) => {
      assert.equal(s.columnsCount, 1);
      assert.equal(s.colSpan, 1);
    });
    // coach tables are kept, just moved below the wristband rows
    const kept = once.offenseSections.filter((s: any) => !isAutoWristbandRowTable(s));
    assert.deepEqual(kept.map((s: any) => s.id), customIds);
    const wbRows = Math.ceil(cols.length / 4);
    const topKept = kept.filter((s: any) => (s.group || 'top_situations') === 'top_situations');
    if (topKept.length) assert.ok(Math.min(...topKept.map((s: any) => s.rowIndex ?? 0)) >= wbRows);

    const twice = syncWristbandToCallSheet(wb, once);
    assert.deepEqual(twice.offenseSections, once.offenseSections, 're-sync does not keep shifting rows');
    // defense sheet is left alone unless it already has wristband tables
    assert.deepEqual(once.defenseSections.filter(isAutoWristbandRowTable).length, base.defenseSections.filter(isAutoWristbandRowTable).length);
  });

  it('keeps where a coach moved a wristband table and how wide it is', async () => {
    const { syncWristbandToCallSheet, isAutoWristbandRowTable } = await import('./wristbandLinking.ts');
    const { INITIAL_TWO_WRISTBANDS_DATA } = await import('../data/userGameDayPlays.ts');
    const { DEFAULT_CALL_SHEET_DATA } = await import('../data/callSheetData.ts');
    const { deepClone } = await import('../services/storageService.ts');
    const base = { ...DEFAULT_CALL_SHEET_DATA, offenseSections: DEFAULT_CALL_SHEET_DATA.offenseSections.filter((s: any) => !isAutoWristbandRowTable(s)) };
    const first = syncWristbandToCallSheet(INITIAL_TWO_WRISTBANDS_DATA, base);
    const firstAuto = first.offenseSections.filter(isAutoWristbandRowTable);
    const movedId = firstAuto[0].id;
    // the coach drags the first color table to row 3, last in the row, two wide; and a coach table to row 1
    const coachTable = first.offenseSections.find((s: any) => !isAutoWristbandRowTable(s) && (s.group || 'top_situations') === 'top_situations');
    const arranged = {
      ...first,
      offenseSections: first.offenseSections.map((s: any) =>
        s.id === movedId ? { ...s, rowIndex: 2, order: 9, colSpan: 2 } : coachTable && s.id === coachTable.id ? { ...s, rowIndex: 0, order: 5 } : s
      ),
    };
    const edited = deepClone(INITIAL_TWO_WRISTBANDS_DATA);
    edited.wristbands[0].columns[0].plays[0] = { ...edited.wristbands[0].columns[0].plays[0], text: '99 TEST POWER' };
    const next = syncWristbandToCallSheet(edited, arranged);
    const moved = next.offenseSections.find((s: any) => s.id === movedId);
    assert.equal(moved.rowIndex, 2);
    assert.equal(moved.order, 9);
    assert.equal(moved.colSpan, 2);
    assert.equal(moved.plays[0]?.name, '99 TEST POWER', 'plays still follow the wristband');
    if (coachTable) {
      const c = next.offenseSections.find((s: any) => s.id === coachTable.id);
      assert.equal(c.rowIndex, 0, 'coach tables are not pushed down again');
      assert.equal(c.order, 5);
    }
    assert.deepEqual(syncWristbandToCallSheet(edited, next).offenseSections, next.offenseSections);
  });

  it('updates the first four color tables when a wristband play changes', async () => {
    const { syncWristbandToCallSheet, isAutoWristbandRowTable } = await import('./wristbandLinking.ts');
    const { INITIAL_TWO_WRISTBANDS_DATA } = await import('../data/userGameDayPlays.ts');
    const { DEFAULT_CALL_SHEET_DATA } = await import('../data/callSheetData.ts');
    const { deepClone } = await import('../services/storageService.ts');
    const base = { ...DEFAULT_CALL_SHEET_DATA, offenseSections: DEFAULT_CALL_SHEET_DATA.offenseSections.filter((s: any) => !isAutoWristbandRowTable(s)) };
    const first = syncWristbandToCallSheet(INITIAL_TWO_WRISTBANDS_DATA, base);
    const edited = deepClone(INITIAL_TWO_WRISTBANDS_DATA);
    edited.lastEdited = Date.now();
    edited.wristbands[0].columns[0].plays[0] = {
      ...edited.wristbands[0].columns[0].plays[0],
      text: '99 TEST POWER',
    };
    const next = syncWristbandToCallSheet(edited, first);
    const auto = next.offenseSections.filter(isAutoWristbandRowTable);
    assert.ok(auto.length >= 4, 'four color tables');
    assert.equal(auto[0].plays[0]?.name, '99 TEST POWER');
    const { wristbandRowFingerprint } = await import('./wristbandLinking.ts');
    assert.notEqual(wristbandRowFingerprint(first), wristbandRowFingerprint(next));
  });

  it('copies all four color columns exactly and drops old two-column wristband tables', async () => {
    const { syncWristbandToCallSheet, isAutoWristbandRowTable, isLegacyWristbandTable } = await import(
      './wristbandLinking.ts'
    );
    const wb = {
      lastEdited: 1,
      wristbands: [
        {
          id: 'wb_1',
          labelingMode: 'continuous',
          rowsCount: 2,
          columns: [
            { name: 'BLUE (1 - 13)', color: '#2563eb', plays: [{ text: '21 L 26 DIVE' }, { text: '21 L 37 ZONE' }] },
            { name: 'GOLD (14 - 26)', color: '#facc15', plays: [{ text: '21 R 24 DIVE' }, { text: '' }] },
          ],
        },
        {
          id: 'wb_2',
          labelingMode: 'continuous',
          rowsCount: 2,
          columns: [
            { name: 'GREEN (27 - 39)', color: '#16a34a', plays: [{ text: '11 L JET' }, { text: '11 R BUBBLE' }] },
            { name: 'PINK (40 - 52)', color: '#ec4899', plays: [{ text: 'BOOT' }] },
          ],
        },
      ],
    };
    const sheet = {
      title: 'CS',
      offenseSections: [
        {
          id: 'wb_table_wb_1_full_old',
          title: 'Wristband 1',
          wristbandPresetMode: 'full_two_col',
          columnsCount: 2,
          group: 'top_situations',
          plays: [{ name: 'STALE' }],
        },
      ],
      defenseSections: [],
      offenseScript: [],
      defenseScript: [],
      timeouts: {},
    } as any;
    const out = syncWristbandToCallSheet(wb as any, sheet);
    const auto = out.offenseSections.filter(isAutoWristbandRowTable);
    assert.equal(auto.length, 4);
    assert.deepEqual(
      auto.map((s: any) => s.title),
      ['Blue', 'Gold', 'Green', 'Pink']
    );
    assert.equal(auto[0].plays[0]?.name, '21 L 26 DIVE');
    assert.equal(auto[0].plays[1]?.name, '21 L 37 ZONE');
    assert.equal(auto[1].plays[0]?.name, '21 R 24 DIVE');
    assert.equal(auto[1].plays.length, 1, 'empty wristband slots at the bottom are not shown');
    assert.equal(auto[1].slotsCount, 1);
    assert.equal(auto[2].plays[0]?.name, '11 L JET');
    assert.equal(auto[2].plays[1]?.name, '11 R BUBBLE');
    assert.equal(auto[3].plays[0]?.name, 'BOOT');
    assert.equal(out.offenseSections.some(isLegacyWristbandTable), false);
  });
});

describe('wristband row keeps the coach tables in their 4-across layout', () => {
  it('pins unplaced tables to the rows they were shown on, one row lower', async () => {
    const { syncWristbandToCallSheet, isAutoWristbandRowTable } = await import('./wristbandLinking.ts');
    const { INITIAL_TWO_WRISTBANDS_DATA } = await import('../data/userGameDayPlays.ts');
    const { DEFAULT_CALL_SHEET_DATA } = await import('../data/callSheetData.ts');
    const custom = Array.from({ length: 11 }, (_, i) => ({ id: `t${i}`, title: `T${i}`, group: 'top_situations', plays: [] }));
    const cs = { ...DEFAULT_CALL_SHEET_DATA, desktopGridColumns: 4, offenseSections: custom } as any;
    const out = syncWristbandToCallSheet(INITIAL_TWO_WRISTBANDS_DATA, cs);
    const kept = out.offenseSections.filter((s: any) => !isAutoWristbandRowTable(s));
    const wbRows = Math.ceil(out.offenseSections.filter(isAutoWristbandRowTable).length / 4);
    kept.forEach((s: any, i: number) => {
      assert.equal(s.rowIndex, wbRows + Math.floor(i / 4), `${s.title} row`);
      assert.equal(s.order, i % 4, `${s.title} order`);
    });
  });
});

describe('Black / Blue / Gold unit stats (our-team play log)', () => {
  const play = (o: any) => ({
    id: o.id, playNumber: o.n, odk: o.odk || 'O', quarter: 1, down: o.down || 1, distance: o.dist || 10,
    yardLine: 50, rawYardLine: '50', yardLineSide: 'MID', fieldZone: 'midfield', hash: 'M', playType: o.type || 'RUN',
    formation: '-', backfield: '-', motion: '-', playName: 'Rush', direction: '', gainLoss: o.gain || 0, result: o.result || 'Rush',
    personnel: '-', carrierOrTarget: '', isExplosive: (o.gain || 0) >= 10, isEfficient: Boolean(o.eff), runSide: 'M',
    gameId: o.game || 'g1', series: o.series ?? 1, unit: o.unit,
  });

  it('splits offense and defense numbers by unit and skips penalties', async () => {
    const { computeUnitStats } = await import('../hudlScout/utils/unitStats.ts');
    const plays = [
      play({ id: 'a', n: 1, unit: 'black', gain: 12, eff: true }),
      play({ id: 'b', n: 2, unit: 'black', gain: -2 }),
      play({ id: 'c', n: 3, unit: 'black', gain: 6, down: 3, dist: 5, eff: true, result: 'Rush, TD' }),
      play({ id: 'd', n: 4, unit: 'gold', type: 'PASS', gain: 0, result: 'Incomplete' }),
      play({ id: 'e', n: 5, unit: 'gold', type: 'PENALTY', gain: 5, result: 'Penalty' }),
      play({ id: 'f', n: 6, odk: 'D', unit: 'blue', gain: 3, result: 'Fumble' }),
      play({ id: 'g', n: 7, odk: 'K', gain: 30, result: 'Return' }),
      play({ id: 'h', n: 8, gain: 4 }),
    ];
    const s = computeUnitStats(plays as any);
    const blk = s.offense.black;
    assert.equal(blk.plays, 3);
    assert.equal(blk.yards, 16);
    assert.equal(blk.yardsPerPlay, 5.3);
    assert.equal(blk.touchdowns, 1);
    assert.equal(blk.thirdDowns, 1);
    assert.equal(blk.thirdDownConversions, 1);
    assert.equal(blk.successfulPlays, 2);
    assert.equal(blk.explosivePlays, 1);
    assert.equal(blk.negativePlays, 1);
    assert.equal(s.offense.gold.plays, 1, 'penalty is not counted as a snap');
    assert.equal(s.offense.gold.passes, 1);
    assert.equal(s.defense.blue.turnovers, 1, 'defense fumble is a takeaway');
    assert.equal(s.offense.untagged.plays, 1);
    assert.equal(s.offense.blue.plays + s.defense.gold.plays, 0, 'kick plays are left out');
  });

  it('tags one play or the rest of its series, same side and game only', async () => {
    const { tagPlayUnits, unitTagProgress } = await import('../hudlScout/utils/unitStats.ts');
    const plays = [
      play({ id: 'a', n: 1, series: 2 }),
      play({ id: 'b', n: 2, series: 2 }),
      play({ id: 'c', n: 3, series: 2, odk: 'D' }),
      play({ id: 'd', n: 4, series: 3 }),
      play({ id: 'e', n: 5, series: 2, game: 'g2' }),
      play({ id: 'k', n: 6, series: 2, odk: 'K' }),
    ];
    const one = tagPlayUnits(plays as any, 'a', 'blue', 'play');
    assert.deepEqual(one.map((p: any) => p.unit || '-'), ['blue', '-', '-', '-', '-', '-']);
    const series = tagPlayUnits(plays as any, 'a', 'gold', 'rest_of_series');
    assert.deepEqual(series.map((p: any) => p.unit || '-'), ['gold', 'gold', '-', '-', '-', '-']);
    assert.deepEqual(unitTagProgress(series as any), { tagged: 2, total: 5 });
    const cleared = tagPlayUnits(series as any, 'a', undefined, 'play');
    assert.equal((cleared as any)[0].unit, undefined);
  });
});

describe('drill whiteboards draw cleanly', () => {
  it('every step of every built-in drill renders with real numbers and keeps its words', async () => {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { WHITEBOARD_DRILLS } = await import('../components/whiteboard/whiteboardDrillData.ts');
    const { DrillBoardSvg, boardFrame } = await import('../components/whiteboard/DrillBoardSvg.tsx');
    let steps = 0;
    for (const drill of WHITEBOARD_DRILLS) {
      const frame = boardFrame(drill.phases);
      drill.phases.forEach((phase, i) => {
        const svg = renderToStaticMarkup(React.createElement(DrillBoardSvg, { drill, phaseIdx: i, frame, forPrint: true }));
        steps++;
        assert.ok(!/NaN|Infinity/.test(svg), `${drill.id} step ${i + 1} has a bad coordinate`);
        (phase.textElements || []).forEach((t) => {
          const words = t.text.split(' ').filter(Boolean);
          assert.ok(words.every((w) => svg.includes(w.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'))), `${drill.id} note lost words`);
        });
      });
    }
    assert.ok(steps > 150);
  });

  it('the phone frame draws bigger but never pulls separate players into each other', async () => {
    const { WHITEBOARD_DRILLS } = await import('../components/whiteboard/whiteboardDrillData.ts');
    const { boardFrame, tokenKind } = await import('../components/whiteboard/DrillBoardSvg.tsx');
    let bigger = 0;
    for (const drill of WHITEBOARD_DRILLS) {
      const wide = boardFrame(drill.phases);
      const phone = boardFrame(drill.phases, { compact: true });
      assert.ok(phone.viewBox.w <= wide.viewBox.w + 1, `${drill.id} phone frame is wider`);
      if (phone.viewBox.w < wide.viewBox.w * 0.85) bigger++;
      drill.phases.forEach((p, i) => {
        const ts = (p.tokens || []).filter((t) => tokenKind(t) !== 'text');
        for (let a = 0; a < ts.length; a++) {
          for (let b = a + 1; b < ts.length; b++) {
            const d = Math.hypot(ts[a].x - ts[b].x, ts[a].y - ts[b].y);
            if (d * wide.scale >= 62) assert.ok(d * phone.scale >= 61.9, `${drill.id} step ${i + 1}: ${ts[a].label} and ${ts[b].label} crowd on a phone`);
          }
        }
      });
    }
    assert.ok(bigger > 50, `only ${bigger} drills got bigger on a phone`);
  });

  it('classifies players, bags, cones and ball carriers', async () => {
    const { tokenKind } = await import('../components/whiteboard/DrillBoardSvg.tsx');
    assert.equal(tokenKind({ id: 'a', type: 'X', label: 'MLB', x: 0, y: 0 }), 'defense');
    assert.equal(tokenKind({ id: 'b', type: 'letter', label: 'E5', x: 0, y: 0 }), 'defense');
    assert.equal(tokenKind({ id: 'c', type: 'O', label: 'RB', x: 0, y: 0 }), 'carrier');
    assert.equal(tokenKind({ id: 'd', type: 'O', label: 'BALL', x: 0, y: 0 }), 'carrier');
    assert.equal(tokenKind({ id: 'e', type: 'O', label: 'LG', x: 0, y: 0 }), 'lineman');
    assert.equal(tokenKind({ id: 'f', type: 'O', label: 'WR', x: 0, y: 0 }), 'offense');
    assert.equal(tokenKind({ id: 'g', type: 'bag', label: 'BAG 1', x: 0, y: 0 }), 'bag');
    assert.equal(tokenKind({ id: 'h', type: 'cone', label: 'FINISH', x: 0, y: 0 }), 'cone');
    assert.equal(tokenKind({ id: 'i', type: 'O', label: 'COACH', x: 0, y: 0 }), 'coach');
  });
});

describe('Hudl playbook import', () => {
  it('reads pasted lists: list numbers go, play numbers stay, numbered headings become sections', async () => {
    const { parseLooseList, buildDrafts } = await import('./playbookImport.ts');
    const entries = parseLooseList('1\n⇕\n21 R RUNNING HOLES\n2 21R 24 DIVE\n3. 21L 26 DIVE\n17 NOW SCREENS\n21 R TWINS L 24 DIVE Z BUBBLE\nAll Installs / 2026 10U Install\n21 R 32 POWER');
    assert.deepEqual(
      entries.map((e) => e.name),
      ['21 R RUNNING HOLES', '21R 24 DIVE', '21L 26 DIVE', 'NOW SCREENS', '21 R TWINS L 24 DIVE Z BUBBLE', '21 R 32 POWER']
    );
    const drafts = buildDrafts(entries);
    assert.equal(drafts.find((d) => d.name === 'NOW SCREENS')?.isSection, true);
    assert.equal(drafts.find((d) => d.name.includes('BUBBLE'))?.category, 'NOW SCREENS');
    assert.equal(drafts.find((d) => d.name.includes('BUBBLE'))?.type, 'screen');
  });

  it('a section heading stops at the next play family', async () => {
    const { buildDrafts } = await import('./playbookImport.ts');
    const drafts = buildDrafts([
      { name: 'PLAY ACTION PASS' },
      { name: '21 R 32 POWER PASS' },
      { name: '21 L 38 POWER PASS' },
      { name: '32 R WISHBONE 26 DIVE' },
    ]);
    assert.equal(drafts.find((d) => d.name === '21 L 38 POWER PASS')?.category, 'PLAY ACTION PASS');
    assert.equal(drafts.find((d) => d.name === '32 R WISHBONE 26 DIVE')?.category, undefined);
    assert.equal(drafts.find((d) => d.name === '32 R WISHBONE 26 DIVE')?.formation, '32 R WISHBONE');
    assert.equal(drafts.find((d) => d.name === '21 R 32 POWER PASS')?.type, 'play_action');
  });

  it('reads the printed Hudl install page by rows, ignoring icon glyphs', async () => {
    const { parseHudlListPages } = await import('./playbookImport.ts');
    const items = [
      { str: 'All Installs', x: 202, y: 606 },
      { str: '/ 2026 10U Install', x: 268, y: 606 },
      { str: '32 Plays', x: 216, y: 534 },
      { str: '1', x: 219, y: 449 },
      { str: '', x: 230, y: 446 },
      { str: '21 R RUNNING HOLES', x: 251, y: 449 },
      { str: '2', x: 219, y: 415 },
      { str: '21R 24 DIVE', x: 251, y: 415 },
    ];
    const res = parseHudlListPages([items]);
    assert.equal(res.install, '2026 10U Install');
    assert.deepEqual(res.entries.map((e) => e.name), ['21 R RUNNING HOLES', '21R 24 DIVE']);
  });

  it('fixes common text-recognition slips and reads position tables', async () => {
    const { fixOcrCall, parseAssignmentLines } = await import('./playbookImport.ts');
    assert.equal(fixOcrCall('211 26 DIVE'), '21L 26 DIVE');
    assert.equal(fixOcrCall('21 R 31 TOSS SWEEP'), '21 R 31 TOSS SWEEP');
    const { sheetPlayName, sheetSectionName, sheetBody, isSheetHeader } = await import('./playbookImport.ts');
    assert.equal(sheetPlayName('Bl 32 Wishbone 26 Dive'), '32 Wishbone 26 Dive');
    assert.equal(sheetPlayName('8 | 32 Wishbone Y Waggle'), '32 Wishbone Y Waggle');
    assert.equal(sheetPlayName('31 6un T 23 Blast'), '31 Gun T 23 Blast');
    assert.equal(sheetPlayName('316un T 32 Counter'), '31 Gun T 32 Counter');
    assert.equal(sheetPlayName('56 Air Raid Empty 5 Wide 4 Zone Jet'), 'Air Raid Empty 5 Wide 4 Zone Jet');
    assert.equal(sheetPlayName('32 Wishbone 0B Sweep 11'), '32 Wishbone QB Sweep 11');
    assert.equal(sheetPlayName('J Air Raid Pistol Vapor Jet Right'), 'Air Raid Pistol Vapor Jet Right');
    assert.equal(sheetSectionName('FORMATION 32 WISHBONE'), '32 WISHBONE');
    assert.equal(sheetSectionName('MAHOPAC OFFENSE'), '');
    assert.equal(isSheetHeader(20, 200), true);
    assert.equal(isSheetHeader(250, 250), false);
    const body = sheetBody('Inside-Over free blocking scheme for the line.\nQB Hand off to the fullback and carry out the fake.\nWR Stalk the corner.');
    assert.equal(body.assignments?.find((a) => a.pos === 'QB')?.text.startsWith('Hand off'), true);
    assert.match(body.notes || '', /blocking scheme/i);
    const jobs = parseAssignmentLines('z Stalk\n\nY On-Playside-Backer\n1 Toss To 3, Boot Away\nCc On-Playside-Backer\nNo\n\n—\n© —\nBSG Pull Kick Out');
    assert.deepEqual(jobs, [
      { pos: 'Z', text: 'Stalk' },
      { pos: 'Y', text: 'On-Playside-Backer' },
      { pos: '1', text: 'Toss To 3, Boot Away' },
      { pos: 'C', text: 'On-Playside-Backer' },
      { pos: 'BSG', text: 'Pull Kick Out' },
    ]);
  });

  it('merges into the Play Bank by name: wristband plays keep their number and gain Hudl details', async () => {
    const { buildDrafts, mergeDraftsIntoDatabase, draftStatus } = await import('./playbookImport.ts');
    const db = [
      { id: 'usr_play_14', name: '21 R 24 DIVE', unit: 'offense', formation: '21 R', type: 'run', wristbandNum: 14, situations: ['1-10'] },
    ] as any[];
    const drafts = buildDrafts(
      [
        { name: '21R 24 DIVE', assignments: [{ pos: '2', text: 'Receive hand off, hit hole' }] },
        { name: '32 R WISHBONE 48 COUNTER' },
      ],
      { install: '2026 10U Install' }
    );
    assert.equal(draftStatus(db, drafts[0]), 'update');
    assert.equal(draftStatus(db, drafts[1]), 'new');
    const res = mergeDraftsIntoDatabase(db, drafts, 5);
    assert.equal(res.next.length, 2);
    const dive = res.next.find((p) => p.id === 'usr_play_14')!;
    assert.equal(dive.wristbandNum, 14);
    assert.deepEqual(dive.situations, ['1-10']);
    assert.equal(dive.assignments?.[0].pos, '2');
    assert.equal(dive.install, '2026 10U Install');
    const counter = res.added[0];
    assert.equal(counter.formation, '32 R WISHBONE');
    assert.equal(counter.source, 'hudl');
    // Importing the same thing again changes nothing.
    const again = mergeDraftsIntoDatabase(res.next, drafts, 6);
    assert.equal(again.added.length, 0);
    assert.equal(again.updated.length, 0);
  });
});

describe('tagging film plays with play calls', () => {
  const play = (over: any = {}) => ({
    id: 'p1',
    playNumber: 1,
    odk: 'O',
    quarter: 1,
    down: 1,
    distance: 10,
    yardLine: 70,
    rawYardLine: '-30',
    yardLineSide: 'OWN',
    fieldZone: 'own_territory',
    hash: 'L',
    playType: 'RUN',
    formation: '-',
    backfield: '-',
    motion: '-',
    playName: 'Rush',
    direction: 'Left',
    gainLoss: 6,
    result: 'Rush',
    personnel: '-',
    carrierOrTarget: '',
    isExplosive: false,
    isEfficient: true,
    runSide: 'L',
    ...over,
  });

  it('tags and untags, putting the film name and formation back', async () => {
    const { tagPlays } = await import('../hudlScout/utils/playTags.ts');
    const entry = { id: 'x1', name: '21 L 39 TOSS SWEEP', formation: '21 L' };
    const [tagged] = tagPlays([play() as any], ['p1'], entry);
    // Personnel + side go to the formation; the play call is just the play.
    assert.equal(tagged.playCall, '39 TOSS SWEEP');
    assert.equal(tagged.playName, '39 TOSS SWEEP');
    assert.equal(tagged.formation, '21 L');
    assert.equal(tagged.playCallId, 'x1');
    const [back] = tagPlays([tagged], ['p1'], null);
    assert.equal(back.playCallId, undefined);
    assert.equal(back.playName, 'Rush');
    assert.equal(back.formation, '-');
    // The call's formation wins over the film's ("21" or "GUN" on the film, "21 L" called).
    const [withForm] = tagPlays([play({ formation: 'GUN' }) as any], ['p1'], entry);
    assert.equal(withForm.formation, '21 L');
    // A call without personnel + side keeps the film's formation.
    const [plain] = tagPlays([play({ formation: 'GUN' }) as any], ['p1'], { id: 'x2', name: 'HAWK SPECIAL', formation: '' });
    assert.equal(plain.formation, 'GUN');
    assert.equal(plain.playCall, 'HAWK SPECIAL');
  });

  it('splits a call into formation (personnel + L/R) and play: "32L 47 Zone" -> "32 L" + "47 Zone"', async () => {
    const { splitCall, splitTaggedCalls } = await import('../hudlScout/utils/playTags.ts');
    assert.deepEqual(splitCall('32L 47 Zone'), { formation: '32 L', play: '47 Zone' });
    assert.deepEqual(splitCall('21 R 22 DOWN'), { formation: '21 R', play: '22 DOWN' });
    assert.deepEqual(splitCall('11 LEFT BUBBLE PASS'), { formation: '11 L', play: 'BUBBLE PASS' });
    assert.deepEqual(splitCall('21 L TWINS R Z BUBBLE'), { formation: '21 L', play: 'TWINS R Z BUBBLE' });
    // Not personnel + side: the whole call stays the play.
    assert.deepEqual(splitCall('47 ZONE'), { play: '47 ZONE' }); // 4 + 7 isn't personnel
    assert.deepEqual(splitCall('32 LEAD'), { play: '32 LEAD' });
    assert.deepEqual(splitCall('HAWK SPECIAL'), { play: 'HAWK SPECIAL' });
    assert.deepEqual(splitCall('21 L'), { play: '21 L' });
    // Plays tagged before: read as formation + play.
    const [old] = splitTaggedCalls([{ id: 'a', playCallId: 'x', playCall: '21 L 26 DIVE', playName: '21 L 26 DIVE', formation: '21' } as any]);
    assert.deepEqual([old.formation, old.playCall, old.playName], ['21 L', '26 DIVE', '26 DIVE']);
    const untagged = [{ id: 'b', playName: '21 L 26 DIVE', formation: '-' } as any];
    assert.equal(splitTaggedCalls(untagged), untagged); // untagged film plays are left alone
  });

  it('offers the right side of the ball first and finds calls by any words', async () => {
    const { rankCalls, callResults } = await import('../hudlScout/utils/playTags.ts');
    const db = [
      { id: 'd1', name: '4-4 BASE STACK RIP', unit: 'defense', formation: '4-4', type: 'coverage', situations: [] },
      { id: 'o1', name: '21 R 31 TOSS SWEEP', unit: 'offense', formation: '21 R', type: 'run', situations: [] },
      { id: 'o2', name: '21 L 39 TOSS SWEEP', unit: 'offense', formation: '21 L', type: 'run', situations: [] },
    ] as any[];
    const ranked = rankCalls(play() as any, db, new Map());
    assert.equal(ranked[0].unit, 'offense');
    assert.equal(ranked[0].id, 'o2'); // film went left
    assert.deepEqual(rankCalls(play() as any, db, new Map(), 'toss 31').map((e) => e.id), ['o1']);
    const results = callResults([
      play({ id: 'a', playCallId: 'o1', playCall: '21 R 31 TOSS SWEEP', gainLoss: 8, isEfficient: true }),
      play({ id: 'b', playCallId: 'o1', playCall: '21 R 31 TOSS SWEEP', gainLoss: -2, isEfficient: false }),
      play({ id: 'c', playCallId: 'o1', playCall: '21 R 31 TOSS SWEEP', gainLoss: 12, isEfficient: true, result: 'Rush, TD' }),
    ] as any);
    assert.equal(results[0].count, 3);
    assert.equal(results[0].avgGain, 6);
    assert.equal(results[0].successRate, 67);
    assert.equal(results[0].touchdowns, 1);
    assert.equal(results[0].negative, 1);
  });
});

describe('one play log for self-scout and PFF', () => {
  it('links our uploaded games to the week they were played from the schedule', async () => {
    const { guessGameWeek, playsForWeek } = await import('../hudlScout/scoutBundle.ts');
    const events = [
      { type: 'game', week: '1', opponent: 'Suffern' },
      { type: 'game', week: '2', opponent: '@ Yorktown' },
      { type: 'practice', week: '2', opponent: 'Shrub Oak' },
    ];
    assert.equal(guessGameWeek('MSA vs Suffern', events), '1');
    assert.equal(guessGameWeek('MSA vs Yorktown', events), '2');
    assert.equal(guessGameWeek('MSA vs Shrub Oak', events), undefined);
    const bundle = {
      games: [
        { id: 'g1', name: 'MSA vs Suffern', playCount: 1, addedAt: 1, week: '1' },
        { id: 'g2', name: 'MSA vs Yorktown', playCount: 1, addedAt: 2, week: '' },
      ],
      plays: [{ id: 'a', gameId: 'g1' }, { id: 'b', gameId: 'g2' }],
    } as any;
    assert.deepEqual(playsForWeek(bundle, '1').map((p: any) => p.id), ['a']);
    assert.deepEqual(playsForWeek(bundle, '2'), []);
  });

  it('finds the formation behind a call and fills the lineup from that week’s depth chart', async () => {
    const { formationForCall, lineupFromFormation } = await import('./pffFilm.ts');
    const formations = [
      { id: 'form_21', unit: 'offense', name: '21 Offense', rows: [] },
      {
        id: 'f32',
        unit: 'offense',
        name: '32 Offense',
        rows: [
          { id: 'r1', label: '', slotCount: 3, positions: [{ id: 's_qb', name: '1 (QB)' }, { id: 's_y2', name: 'Y2' }, { id: 's_lt', name: 'LT' }] },
        ],
      },
      { id: 'form_44', unit: 'defense', name: '44 Defense', rows: [] },
    ] as any[];
    assert.equal(formationForCall('32 R WISHBONE 26 DIVE', formations, 'offense')?.id, 'f32');
    assert.equal(formationForCall('21R 24 DIVE', formations, 'offense')?.id, 'form_21');
    assert.equal(formationForCall('4-4 BASE STACK RIP', formations, 'defense')?.id, 'form_44');
    assert.equal(formationForCall('SCREEN', formations, 'offense'), undefined);
    const depth = { s_qb: [{ num: '7', name: 'A' }, { num: '12', name: 'B' }], s_y2: [{ num: '80', name: 'C' }], s_lt: [] };
    const roster = [{ id: 'r7', num: '7', firstName: 'Al', lastName: 'Q' }] as any[];
    const black = lineupFromFormation(formations[1], depth, roster, 'black', 'offense');
    assert.deepEqual(black.map((l) => [l.slot.id, l.slot.group, l.player?.num ?? null]), [
      ['QB', 'QB', '7'],
      ['Y2', 'WR', '80'],
      ['LT', 'OL', null],
    ]);
    assert.equal(black[0].player?.name, 'Al Q');
    const gold = lineupFromFormation(formations[1], depth, roster, 'gold', 'offense');
    assert.equal(gold[0].player?.num, '12');
  });

  it('moves a PFF-only upload into the shared log, keeping ids and merging a duplicate game', async () => {
    const { moveFilmIntoSharedLog } = await import('./pffFilm.ts');
    const film = [
      { id: 'hudl_1_0', playNumber: '1', odk: 'offense', down: '1', distance: '10', gain: '4', result: 'Rush', playType: 'Run' },
      { id: 'hudl_2_1', playNumber: '2', odk: 'defense', down: '2', distance: '6', gain: '-1', result: 'Rush', playType: 'Run' },
    ] as any[];
    const bundle = {
      plays: [
        { id: 's1', gameId: 'old', playNumber: 1, unit: 'gold', playCallId: 'o1', playCall: '21 R 24 DIVE', playName: '21 R 24 DIVE', formation: '21 R' },
        { id: 's2', gameId: 'old', playNumber: 2 },
      ],
      games: [{ id: 'old', name: 'MSA vs Suffern', playCount: 2, addedAt: 1 }],
      datasetName: 'Mahopac',
      offensiveScheme: '',
      coachNotes: '',
      filters: {},
      updatedAt: 1,
      sourceCleared: false,
    } as any;
    const res = moveFilmIntoSharedLog(bundle, film, { hudl_1_0: 'black' }, '1', 'Week 1 game', 100);
    assert.equal(res.mergedDuplicate, 'MSA vs Suffern');
    assert.equal(res.bundle.games.length, 1);
    assert.equal(res.bundle.games[0].week, '1');
    assert.deepEqual(res.bundle.plays.map((p: any) => p.id), ['hudl_1_0', 'hudl_2_1']);
    assert.equal(res.bundle.plays[0].unit, 'black'); // the PFF choice wins
    assert.equal(res.bundle.plays[0].playCall, '21 R 24 DIVE'); // the self-scout tag is kept
    assert.equal(res.bundle.plays[1].odk, 'D');
  });

  it('keeps whether PFF units follow the depth chart through sync', () => {
    const merged = mergeFilmSession(
      { plays: [], packages: { offense: {}, defense: {} }, assignments: {}, packagesUpdatedAt: 1, packagesSource: 'manual' } as any,
      { plays: [], packages: { offense: {}, defense: {} }, assignments: {}, packagesUpdatedAt: 2, packagesSource: 'auto' } as any
    );
    assert.equal(merged?.packagesSource, 'auto');
  });
});

describe('editing the Drill Library', () => {
  const tree = () => [
    {
      name: 'Defense',
      drills: [{ id: 'd0', name: 'Pursuit', desc: '', key: '' }],
      subfolders: [
        { name: 'Linebackers', drills: [{ id: 'lb1', name: 'Shed', desc: '', key: '' }], subfolders: [] },
        { name: 'Defensive Line', drills: [{ id: 'dl1', name: 'Get-off', desc: '', key: '' }], subfolders: [] },
      ],
    },
    { name: 'Offense', drills: [{ id: 'o1', name: 'Mesh', desc: '', key: '' }], subfolders: [] },
  ];

  it('deletes a section and can move its drills (including sub-sections) somewhere else first', async () => {
    const { deleteFolder, countDrills, getFolder } = await import('./drillTreeEdit.ts');
    const t = tree();
    const moved = deleteFolder(t as any, [0], [1]);
    assert.equal(moved.length, 1);
    assert.deepEqual(moved[0].drills.map((d) => d.id), ['o1', 'd0', 'lb1', 'dl1']);
    const dropped = deleteFolder(t as any, [0]);
    assert.equal(dropped.length, 1);
    assert.equal(countDrills(dropped[0]), 1);
    // A sub-section: its drills can go to the parent.
    const sub = deleteFolder(t as any, [0, 1], [0]);
    assert.deepEqual(getFolder(sub, [0])!.drills.map((d) => d.id), ['d0', 'dl1']);
    assert.equal(getFolder(sub, [0])!.subfolders.length, 1);
    // The original is never changed.
    assert.equal(t[0].subfolders.length, 2);
  });

  it('renames, reorders, adds, moves and copies without touching the old tree', async () => {
    const e = await import('./drillTreeEdit.ts');
    const t = tree() as any;
    assert.equal(e.renameFolder(t, [0, 0], 'LBs')[0].subfolders[0].name, 'LBs');
    assert.deepEqual(e.moveFolder(t, [1], -1).map((f) => f.name), ['Offense', 'Defense']);
    assert.equal(e.moveFolder(t, [0], -1), t);
    const added = e.addFolder(t, [0], 'Secondary');
    assert.deepEqual(added.path, [0, 2]);
    const withDrill = e.addDrill(added.tree, added.path, { name: 'Backpedal' });
    assert.equal(e.getFolder(withDrill.tree, [0, 2])!.drills[0].name, 'Backpedal');
    const moved = e.moveDrill(t, [0, 0], 0, [1]);
    assert.deepEqual(moved[1].drills.map((d: any) => d.id), ['o1', 'lb1']);
    assert.equal(moved[0].subfolders[0].drills.length, 0);
    const copied = e.duplicateDrill(t, [1], 0);
    assert.equal(copied[1].drills[1].name, 'Mesh (copy)');
    assert.notEqual(copied[1].drills[1].id, 'o1');
    assert.equal(t[1].drills.length, 1);
    assert.deepEqual(e.folderOptions(t).map((o) => o.label), ['Defense', 'Defense › Linebackers', 'Defense › Defensive Line', 'Offense']);
  });
});

describe('formations on film plays', () => {
  it('reads formations as a number plus letters and matches calls to them', async () => {
    const { tidyFormation, isNumberFormation, callFitsFormation } = await import('../hudlScout/utils/playTags.ts');
    assert.equal(tidyFormation('21r'), '21 R');
    assert.equal(tidyFormation(' 32  wb '), '32 WB');
    assert.equal(isNumberFormation('GUN'), false);
    assert.equal(isNumberFormation('-'), false);
    assert.equal(isNumberFormation('21'), true);
    const call = (name: string) => ({ name, formation: '' });
    assert.equal(callFitsFormation(call('21 R 31 TOSS SWEEP'), '21'), true);
    assert.equal(callFitsFormation(call('21R 24 DIVE'), '21 R'), true);
    assert.equal(callFitsFormation(call('21 R 31 TOSS SWEEP'), '21 L'), false);
    assert.equal(callFitsFormation(call('21 R TWINS L 24 DIVE Z BUBBLE'), '21 TWINS'), true);
    assert.equal(callFitsFormation(call('32 R WISHBONE 26 DIVE'), '32 WISHBONE'), true);
    assert.equal(callFitsFormation(call('32 R WISHBONE 26 DIVE'), '21'), false);
    assert.equal(callFitsFormation(call('11 R 11 KEEP'), '1'), false);
  });

  it('sets a formation, keeps it through untagging, and copies it down the drive', async () => {
    const { setPlaysFormation, restOfSeriesIds, tagPlays } = await import('../hudlScout/utils/playTags.ts');
    const base = { odk: 'O', gameId: 'g', series: 2, formation: '-', playName: 'Rush' };
    const plays = [
      { ...base, id: 'a', playNumber: 5 },
      { ...base, id: 'b', playNumber: 6 },
      { ...base, id: 'c', playNumber: 7 },
      { ...base, id: 'd', playNumber: 8, series: 3 },
      { ...base, id: 'e', playNumber: 9, odk: 'D' },
    ] as any[];
    assert.deepEqual(restOfSeriesIds(plays, 'a'), ['b', 'c']);
    let next = setPlaysFormation(plays, ['a'], '21r');
    assert.equal(next[0].formation, '21 R');
    next = tagPlays(next, ['a'], { id: 'x', name: '21 R 24 DIVE', formation: '21 R' });
    next = setPlaysFormation(next, ['a'], '32 wb');
    next = tagPlays(next, ['a'], null);
    assert.equal(next[0].formation, '32 WB');
  });
});

describe('players on the ball from Hudl', () => {
  it('reads RUSHER / PASSER / RECEIVER jersey and name columns, not the opponent ones', async () => {
    const { autoDetectColumnMapping, normalizeHudlRow } = await import('../hudlScout/utils/csvParser.ts');
    const headers = ['PLAY #', 'ODK', 'PLAY TYPE', 'RESULT', 'GN/LS', 'OPP RUSHER', 'OPP PASSER', 'PASSER_Jersey', 'PASSER_Name', 'RECEIVER_Jersey', 'RECEIVER_Name', 'RUSHER_Jersey', 'RUSHER_Name'];
    const m = autoDetectColumnMapping(headers);
    const run = normalizeHudlRow({ 'PLAY #': '2', ODK: 'O', 'PLAY TYPE': 'Run', RESULT: 'Rush', 'GN/LS': '4', RUSHER_Jersey: '13', RUSHER_Name: 'Landon Veto' } as any, m, 0);
    assert.equal(run.rusher, '#13 Landon Veto');
    assert.equal(run.carrierOrTarget, '#13 Landon Veto');
    const pass = normalizeHudlRow(
      { 'PLAY #': '3', ODK: 'O', 'PLAY TYPE': 'Pass', RESULT: 'Complete', 'GN/LS': '9', PASSER_Jersey: '21', PASSER_Name: 'Nash Ward', RECEIVER_Jersey: '10', RECEIVER_Name: 'Luke M' } as any,
      m,
      1
    );
    assert.equal(pass.passer, '#21 Nash Ward');
    assert.equal(pass.receiver, '#10 Luke M');
    assert.equal(pass.carrierOrTarget, '#10 Luke M');
  });

  it('updates a re-uploaded game in place and keeps the coaches’ tags', async () => {
    const { findSameGame, refreshGamePlays } = await import('../hudlScout/scoutBundle.ts');
    const bundle = {
      games: [{ id: 'g', name: 'MSA vs Suffern', playCount: 2, addedAt: 1 }],
      plays: [
        { id: 'a', gameId: 'g', playNumber: 1, playCallId: 'x', playCall: '21 R 24 DIVE', formation: '21 R', unit: 'gold' },
        { id: 'b', gameId: 'g', playNumber: 2 },
      ],
      updatedAt: 1,
    } as any;
    const fresh = [
      { id: 'n1', playNumber: 1, rusher: '#13 Landon Veto', carrierOrTarget: '#13 Landon Veto', formation: '-' },
      { id: 'n2', playNumber: 2, passer: '#21 Nash Ward' },
    ] as any[];
    assert.equal(findSameGame(bundle, fresh)?.id, 'g');
    assert.equal(findSameGame(bundle, fresh.slice(0, 1)), undefined);
    const next = refreshGamePlays(bundle, 'g', fresh);
    assert.equal(next.plays[0].id, 'a');
    assert.equal(next.plays[0].rusher, '#13 Landon Veto');
    assert.equal(next.plays[0].playCall, '21 R 24 DIVE');
    assert.equal(next.plays[0].formation, '21 R');
    assert.equal(next.plays[0].unit, 'gold');
    assert.equal(next.plays[1].passer, '#21 Nash Ward');
  });
});

describe('who is on the field in our film', () => {
  const formations = [
    {
      id: 'f21',
      unit: 'offense',
      name: '21 Offense',
      rows: [{ id: 'r', label: '', slotCount: 2, positions: [{ id: 's_qb', name: '1 (QB)' }, { id: 's_rb', name: '3 (HB)' }] }],
    },
  ] as any[];
  const depthChart = { s_qb: [{ num: '21', name: 'Nash' }, { num: '7', name: 'Backup' }], s_rb: [{ num: '13', name: 'Landon' }, { num: '22', name: 'Jaxson' }] };
  const roster = [
    { id: 'p21', num: '21', firstName: 'Nash', lastName: 'Ward' },
    { id: 'p13', num: '13', firstName: 'Landon', lastName: 'Veto' },
    { id: 'p22', num: '22', firstName: 'Jaxson', lastName: 'Pestone' },
    { id: 'p7', num: '7', firstName: 'Sam', lastName: 'Q' },
  ] as any[];

  it('fills the unit down the drive, but not over plays a coach set differently', async () => {
    const { tagPlayUnits } = await import('../hudlScout/utils/unitStats.ts');
    const base = { odk: 'O', gameId: 'g', series: 1 };
    const plays = [
      { ...base, id: 'a', playNumber: 1 },
      { ...base, id: 'b', playNumber: 2 },
      { ...base, id: 'c', playNumber: 3, unit: 'blue' },
      { ...base, id: 'd', playNumber: 4 },
      { ...base, id: 'e', playNumber: 5, series: 2 },
    ] as any[];
    let next = tagPlayUnits(plays, 'a', 'gold', 'fill_series');
    assert.deepEqual(next.map((p) => p.unit), ['gold', 'gold', 'blue', 'gold', undefined]);
    // Change play 2: it and the plays that followed gold change, the blue one stays.
    next = tagPlayUnits(next, 'b', 'black', 'fill_series');
    assert.deepEqual(next.map((p) => p.unit), ['gold', 'black', 'blue', 'black', undefined]);
  });

  it('builds the lineup from the week depth chart and applies subs for one play', async () => {
    const { filmLineup, setPlaySub } = await import('./filmLineup.ts');
    const play = { id: 'x', odk: 'O', unit: 'gold', formation: '-', playNumber: 1 } as any;
    const lu = filmLineup(play, { formations, depthChart }, roster)!;
    assert.equal(lu.board?.id, 'f21');
    assert.deepEqual(lu.slots.map((s) => s.player?.num), ['7', '22']);
    const [withSub] = setPlaySub([play], 'x', 'RB', { num: '13', name: 'Landon Veto' });
    const lu2 = filmLineup(withSub, { formations, depthChart }, roster)!;
    assert.equal(lu2.slots[1].player?.num, '13');
    assert.equal(lu2.slots[1].subbed, true);
    const [undone] = setPlaySub([withSub], 'x', 'RB', undefined);
    assert.equal(filmLineup(undone, { formations, depthChart }, roster)!.slots[1].player?.num, '22');
  });

  it('counts snaps, touches and success per player', async () => {
    const { filmLineup } = await import('./filmLineup.ts');
    const { playerFilmStats } = await import('./playerFilmStats.ts');
    const p = (over: any) => ({ odk: 'O', formation: '-', playType: 'RUN', result: 'Rush', gainLoss: 0, isEfficient: false, ...over });
    const plays = [
      p({ id: '1', playNumber: 1, rusher: '#13 Landon Veto', gainLoss: 6, isEfficient: true }),
      p({ id: '2', playNumber: 2, rusher: '#13 Landon Veto', gainLoss: 12, isEfficient: true, result: 'Rush, TD' }),
      p({ id: '3', playNumber: 3, unit: 'gold', rusher: '#22 Jaxson Pestone', gainLoss: -2 }),
      p({ id: '4', playNumber: 4, result: 'Penalty', playType: 'PENALTY' }),
    ] as any[];
    const res = playerFilmStats(plays, (pl) => filmLineup(pl, { formations, depthChart }, roster), roster);
    assert.equal(res.offSnaps, 3);
    const landon = res.players.find((x) => x.num === '13')!;
    assert.equal(landon.offSnaps, 2);
    assert.equal(landon.carries, 2);
    assert.equal(landon.rushYds, 18);
    assert.equal(landon.touchSuccess, 100);
    assert.equal(landon.touchdowns, 1);
    assert.equal(landon.onFieldSuccess, 100);
    const nash = res.players.find((x) => x.num === '21')!;
    assert.equal(nash.offSnaps, 2);
    assert.equal(nash.name, 'Nash Ward');
    const jax = res.players.find((x) => x.num === '22')!;
    assert.equal(jax.offSnaps, 1);
    assert.equal(jax.onFieldSuccess, 0);
  });
});

describe('drives from the play log', () => {
  it('groups plays in a row by the same side; kicks and possession changes start a new drive', async () => {
    const { assignDrives } = await import('../hudlScout/scoutBundle.ts');
    const seq = 'K O O S O K D D O O D'.split(' ');
    const plays = seq.map((odk, i) => ({ id: `p${i + 1}`, gameId: 'g', playNumber: i + 1, odk, series: 1 })) as any[];
    // A second game numbers its own drives.
    plays.push({ id: 'q1', gameId: 'h', playNumber: 1, odk: 'D', series: 7 } as any);
    const out = assignDrives(plays);
    assert.deepEqual(
      out.map((p) => p.series),
      [undefined, 1, 1, undefined, 1, undefined, 2, 2, 3, 3, 4, 1]
    );
    // Numbering follows play number, not the order the rows arrived in.
    const shuffled = assignDrives([...plays].reverse());
    assert.equal(shuffled.find((p) => p.id === 'p9')!.series, 3);
    // Already right: same array back (no needless saves).
    assert.equal(assignDrives(out), out);
  });
});

describe('picking who had the ball on a play', () => {
  it('sets runner / passer / receiver and keeps the carrier line in step', async () => {
    const { setPlayBallPlayer, rosterLabel } = await import('./filmLineup.ts');
    const plays = [{ id: 'a', playType: 'PASS', carrierOrTarget: '' }, { id: 'b', playType: 'RUN' }] as any[];
    let next = setPlayBallPlayer(plays, 'a', 'passer', rosterLabel({ num: '21', firstName: 'Nash', lastName: 'Ward' }));
    next = setPlayBallPlayer(next, 'a', 'receiver', '#10 Luke M');
    assert.equal(next[0].passer, '#21 Nash Ward');
    assert.equal(next[0].carrierOrTarget, '#10 Luke M');
    next = setPlayBallPlayer(next, 'b', 'rusher', '#13 Landon Veto');
    assert.equal(next[1].carrierOrTarget, '#13 Landon Veto');
    next = setPlayBallPlayer(next, 'a', 'receiver', '');
    assert.equal(next[0].receiver, undefined);
    assert.equal(next[0].carrierOrTarget, '#21 Nash Ward');
  });
});

describe('re-uploading and defensive stats', () => {
  it('a new export of the same game merges by play number and keeps everything coaches set', async () => {
    const { findSameGame, mergeGamePlays } = await import('../hudlScout/scoutBundle.ts');
    const old = [1, 2, 3, 4].map((n) => ({ id: `old${n}`, gameId: 'g', playNumber: n, odk: 'O', formation: '-', playName: 'Rush' })) as any[];
    old[0] = { ...old[0], unit: 'gold', formation: '21 R', subs: { QB: { num: '7' } }, rusher: '#13 Picked' };
    old[1] = { ...old[1], playCallId: 'x', playCall: '21 R 24 DIVE', playName: '21 R 24 DIVE', untaggedName: 'Rush', untaggedFormation: '-' };
    old[2] = { ...old[2], odk: 'D', defPlay: { maker: '#22 Jax', events: ['sack'] } };
    const bundle = { games: [{ id: 'g', name: 'MSA vs Suffern', playCount: 4, addedAt: 1, week: '1' }], plays: old, updatedAt: 1 } as any;
    // Hudl re-export: play 4 gone, play 5 added, names now filled in.
    const fresh = [
      { id: 'n1', playNumber: 1, odk: 'O', formation: '-', playName: 'Rush' },
      { id: 'n2', playNumber: 2, odk: 'O', formation: '-', playName: 'Rush', rusher: '#22 Hudl' },
      { id: 'n3', playNumber: 3, odk: 'D', formation: '-', playName: 'Rush', result: 'Sack' },
      { id: 'n5', playNumber: 5, odk: 'O', formation: '-', playName: 'Pass' },
    ] as any[];
    assert.equal(findSameGame(bundle, fresh), undefined); // not identical...
    assert.equal(findSameGame(bundle, fresh, { week: '1' })?.id, 'g'); // ...but the same week's game
    const next = mergeGamePlays(bundle, 'g', fresh);
    const by = (n: number) => next.plays.find((p: any) => p.playNumber === n)!;
    assert.equal(next.plays.length, 4);
    assert.equal(by(1).id, 'old1');
    assert.equal(by(1).unit, 'gold');
    assert.equal(by(1).formation, '21 R');
    assert.deepEqual(by(1).subs, { QB: { num: '7' } });
    assert.equal(by(1).rusher, '#13 Picked');
    assert.equal(by(2).playCall, '21 R 24 DIVE');
    assert.equal(by(2).rusher, '#22 Hudl');
    assert.equal(by(3).defPlay.maker, '#22 Jax');
    assert.equal(by(5).gameId, 'g');
    assert.equal(next.games[0].playCount, 4);
  });

  it('reads sacks, picks, fumbles and tackles for loss from the result', async () => {
    const { defPlayFrom } = await import('../hudlScout/utils/csvParser.ts');
    assert.deepEqual(defPlayFrom('Sack', -6, 'PASS')?.events, ['sack']);
    assert.deepEqual(defPlayFrom('Rush', -2, 'RUN')?.events, ['tfl']);
    assert.deepEqual(defPlayFrom('Interception', 0, 'PASS')?.events, ['int']);
    assert.deepEqual(defPlayFrom('Fumble, recovered', 3, 'RUN')?.events, ['ff', 'fr']);
    assert.equal(defPlayFrom('Rush', 4, 'RUN'), undefined);
    assert.equal(defPlayFrom('Rush', 4, 'RUN', '#22 Jax')?.maker, '#22 Jax');
  });

  it('credits tackles and plays made, and stop rate for everyone on the field', async () => {
    const { playerFilmStats } = await import('./playerFilmStats.ts');
    const lineup = { side: 'defense', slots: [{ slot: { id: 'M', name: 'MIKE' }, player: { num: '22' } }, { slot: { id: 'W', name: 'WILL' }, player: { num: '40' } }] };
    const plays = [
      { id: 'a', odk: 'D', playNumber: 1, gainLoss: -4, isEfficient: false, result: 'Sack', playType: 'PASS', defPlay: { maker: '#22 Jax', assist: '#40 Chris' } },
      { id: 'b', odk: 'D', playNumber: 2, gainLoss: 8, isEfficient: true, result: 'Rush', playType: 'RUN', defPlay: { maker: '#40 Chris' } },
    ] as any[];
    const res = playerFilmStats(plays, () => lineup as any, [{ num: '22', firstName: 'Jax', lastName: 'P' }, { num: '40', firstName: 'Chris', lastName: 'S' }] as any);
    const jax = res.players.find((p) => p.num === '22')!;
    const chris = res.players.find((p) => p.num === '40')!;
    assert.equal(res.defSnaps, 2);
    assert.equal(jax.tackles, 1);
    assert.equal(jax.sacks, 1);
    assert.equal(jax.defSnaps, 2);
    assert.equal(jax.stopRate, 50);
    assert.equal(jax.yardsAllowedPerSnap, 2);
    assert.equal(chris.tackles, 1);
    assert.equal(chris.assists, 1);
  });
});

describe('film tags reach every coach', () => {
  const game = { id: 'g', name: 'MSA vs Suffern', playCount: 3, addedAt: 1 };
  const base = () => [1, 2, 3].map((n) => ({ id: `p${n}`, gameId: 'g', playNumber: n, odk: 'O', playName: 'Rush' }));

  it('two coaches tagging different plays both keep their tags', async () => {
    const { pickScoutBundle } = await import('./scoutMerge.ts');
    const desktop = { games: [game], plays: base().map((p) => (p.id === 'p1' ? { ...p, playCall: '21 R 24 DIVE', playCallId: 'x', editedAt: 100 } : p)), updatedAt: 100 };
    const phone = { games: [game], plays: base().map((p) => (p.id === 'p3' ? { ...p, unit: 'gold', editedAt: 120 } : p)), updatedAt: 120 };
    const merged = pickScoutBundle(desktop, phone);
    assert.equal(merged.plays.find((p: any) => p.id === 'p1').playCall, '21 R 24 DIVE');
    assert.equal(merged.plays.find((p: any) => p.id === 'p3').unit, 'gold');
    assert.equal(merged.plays.length, 3);
  });

  it('an old copy saved later (a phone that was behind) does not wipe newer tags', async () => {
    const { pickScoutBundle } = await import('./scoutMerge.ts');
    const tagged = { games: [game], plays: base().map((p) => ({ ...p, playCall: 'POWER', playCallId: 'y', editedAt: 200 })), updatedAt: 200 };
    const stalePhone = { games: [game], plays: base(), updatedAt: 900, filters: { odk: 'D' } };
    const merged = pickScoutBundle(stalePhone, tagged);
    assert.ok(merged.plays.every((p: any) => p.playCall === 'POWER'));
    assert.equal(merged.filters.odk, 'D'); // report settings follow the copy saved last
  });

  it('the newest edit of the same play wins, including removing a tag', async () => {
    const { pickScoutBundle } = await import('./scoutMerge.ts');
    const a = { games: [game], plays: base().map((p) => (p.id === 'p2' ? { ...p, playCall: 'SWEEP', playCallId: 's', editedAt: 300 } : p)), updatedAt: 300 };
    const b = { games: [game], plays: base().map((p) => (p.id === 'p2' ? { ...p, editedAt: 400 } : p)), updatedAt: 250 };
    assert.equal(pickScoutBundle(a, b).plays.find((p: any) => p.id === 'p2').playCall, undefined);
  });

  it('removed games stay removed; a game added on a device that was behind is kept', async () => {
    const { pickScoutBundle } = await import('./scoutMerge.ts');
    const newGame = { id: 'h', name: 'MSA vs Yorktown', playCount: 1, addedAt: 500 };
    const withNew = { games: [game, newGame], plays: [...base(), { id: 'q1', gameId: 'h', playNumber: 1, odk: 'O' }], updatedAt: 500 };
    const removedG = { games: [], plays: [], deletedGameIds: ['g'], updatedAt: 400 };
    const merged = pickScoutBundle(withNew, removedG);
    assert.deepEqual(merged.games.map((g: any) => g.id), ['h']);
    assert.deepEqual(merged.plays.map((p: any) => p.id), ['q1']);
    // The other way round: the newer copy never saw game h (added after it was saved), so h is kept.
    const behind = { games: [game], plays: base(), updatedAt: 450 };
    const olderWithH = { games: [game, newGame], plays: [...base(), { id: 'q1', gameId: 'h', playNumber: 1 }], updatedAt: 440 };
    const m2 = pickScoutBundle(behind, { ...olderWithH, updatedAt: 440, games: [game, { ...newGame, addedAt: 460 }] });
    assert.ok(m2.games.some((g: any) => g.id === 'h'));
    assert.ok(m2.plays.some((p: any) => p.id === 'q1'));
  });

  it('tagging, units, formations, subs and players stamp the play', async () => {
    const { tagPlays, setPlaysFormation } = await import('../hudlScout/utils/playTags.ts');
    const { tagPlayUnits } = await import('../hudlScout/utils/unitStats.ts');
    const { setPlaySub, setPlayBallPlayer, setPlayDefPlay } = await import('./filmLineup.ts');
    const plays = base() as any[];
    const stamped = (next: any[], id: string) => Number(next.find((p) => p.id === id).editedAt) > 0;
    assert.ok(stamped(tagPlays(plays, ['p1'], { id: 'x', name: 'X', formation: '' }), 'p1'));
    assert.ok(stamped(setPlaysFormation(plays, ['p1'], '21'), 'p1'));
    assert.ok(stamped(tagPlayUnits(plays, 'p1', 'gold', 'play'), 'p1'));
    assert.ok(stamped(setPlaySub(plays, 'p1', 'QB', { num: '7' }), 'p1'));
    assert.ok(stamped(setPlayBallPlayer(plays, 'p1', 'rusher', '#13 L'), 'p1'));
    assert.ok(stamped(setPlayDefPlay(plays, 'p1', { maker: '#22 J' }), 'p1'));
    assert.equal(tagPlays(plays, ['p1'], { id: 'x', name: 'X', formation: '' })[1].editedAt, undefined);
  });
});

describe('hudl called play', () => {
  it('reads the OFF PLAY column as the called play', async () => {
    const { parseCsvRows, autoDetectColumnMapping, normalizeHudlRow } = await import('../hudlScout/utils/csvParser.ts');
    const csv = `PLAY #,ODK,PLAY TYPE,OFF PLAY,GN/LS
1,O,Run,32 Wedge,4
2,O,Run,-,2`;
    const { headers, rows } = parseCsvRows(csv);
    const m = autoDetectColumnMapping(headers);
    const plays = rows.map((r, i) => normalizeHudlRow(r, m, i));
    assert.equal(plays[0].hudlCall, '32 Wedge');
    assert.equal(plays[1].hudlCall, undefined);
  });

  it('tags plays from the called play and never overwrites a coach tag', async () => {
    const { autoTagFromHudl } = await import('../hudlScout/utils/playTags.ts');
    const db = [{ id: 'w', name: '32 WEDGE', formation: '' }] as any[];
    const plays = [
      { id: 'a', gameId: 'g', playNumber: 1, odk: 'O', playType: 'Run', hudlCall: '32 wedge' },
      { id: 'b', gameId: 'g', playNumber: 2, odk: 'O', playType: 'Run', hudlCall: '32 Wedge', playCallId: 'coach', playCall: 'Coach pick' },
      { id: 'c', gameId: 'g', playNumber: 3, odk: 'O', playType: 'Pass', hudlCall: 'Rocket' },
      { id: 'd', gameId: 'h', playNumber: 1, odk: 'O', playType: 'Run', hudlCall: '32 Wedge' },
    ] as any[];
    const res = autoTagFromHudl(plays, db, new Set(['a', 'b', 'c']));
    assert.equal(res.tagged, 1);
    assert.equal(res.plays.find((p: any) => p.id === 'a').playCallId, 'w');
    assert.equal(res.plays.find((p: any) => p.id === 'b').playCallId, 'coach');
    assert.equal(res.plays.find((p: any) => p.id === 'd').playCallId, undefined);
    assert.deepEqual(res.unmatched, ['Rocket']);
  });
});

describe('matching a re-upload to its game', () => {
  it('a different game with the same play numbers is not taken for this one', async () => {
    const { findSameGame } = await import('../hudlScout/scoutBundle.ts');
    const mk = (gameId: string, shift: number) =>
      [1, 2, 3, 4, 5].map((n) => ({ id: `${gameId}${n}`, gameId, playNumber: n, odk: 'O', quarter: 1, down: ((n + shift) % 4) + 1, distance: 10 - shift, yardLine: 30 + n * 5 + shift, gainLoss: n + shift }));
    const bundle = { games: [{ id: 'g', name: 'MSA vs Shrub Oak', playCount: 5, addedAt: 1, week: '3' }], plays: mk('g', 0), updatedAt: 1 } as any;
    const other = mk('x', 2);
    assert.equal(findSameGame(bundle, other), undefined);
    assert.equal(findSameGame(bundle, other, { week: '3' }), undefined);
    // The same game exported again (one gain corrected) still matches.
    const again = mk('y', 0);
    again[2] = { ...again[2], gainLoss: 9 };
    assert.equal(findSameGame(bundle, again)?.id, 'g');
  });
});

describe('uploading the playbook again', () => {
  const bank = () =>
    [
      { id: 'a', name: '21 R 31 TOSS SWEEP', unit: 'offense', formation: '21 R', type: 'run', situations: ['1-10'], wristbandNum: 4, source: 'hudl', install: '2026 10U Install', category: 'SWEEPS', assignments: [{ pos: 'Z', text: 'Stalk' }], diagramUrl: 'https://x/a.jpg', diagramHash: '0'.repeat(240) },
      { id: 'b', name: '21 L 26 DIVE', unit: 'offense', formation: '21 L', type: 'run', situations: [], wristbandNum: 1 },
      { id: 'c', name: '32 R POWER', unit: 'offense', formation: '32 R', type: 'run', situations: [], source: 'hudl', install: '2026 10U Install' },
    ] as any[];
  it('lists what changed and applies it, keeping wristband numbers and situations', async () => {
    const { buildDrafts, draftChanges, draftStatus, mergeDraftsIntoDatabase } = await import('./playbookImport.ts');
    const changedHash = 'f'.repeat(30) + '0'.repeat(210);
    const drafts = buildDrafts(
      [
        { name: '21 R 31 TOSS SWEEP', assignments: [{ pos: 'Z', text: 'Crack the OLB' }], diagram: { hash: changedHash } },
        { name: '21 L 26 DIVE', diagram: { hash: '1'.repeat(240) } },
        { name: '21 R 99 NEW', diagram: { hash: '2'.repeat(240) } },
      ],
      { install: '2026 10U Install' }
    );
    const db = bank();
    assert.deepEqual(draftChanges(db[0], drafts[0]), ['Diagram changed', 'Position jobs changed']);
    assert.deepEqual(draftChanges(db[1], drafts[1]), ['Now from your upload', 'Adds the diagram', 'Adds the install name']);
    assert.equal(draftStatus(db, drafts[2]), 'new');
    drafts[0].diagramUrl = 'https://x/a2.jpg';
    drafts[1].diagramUrl = 'https://x/b.jpg';
    const res = mergeDraftsIntoDatabase(db, drafts);
    const a = res.next.find((p: any) => p.id === 'a');
    assert.equal(a.diagramUrl, 'https://x/a2.jpg');
    assert.equal(a.assignments[0].text, 'Crack the OLB');
    assert.equal(a.wristbandNum, 4);
    assert.deepEqual(a.situations, ['1-10']);
    const b = res.next.find((p: any) => p.id === 'b');
    assert.equal(b.source, 'hudl');
    assert.equal(b.diagramUrl, 'https://x/b.jpg');
    assert.equal(b.wristbandNum, 1);
    assert.equal(res.added.length, 1);
  });

  it('the same drawing rendered again is not a change', async () => {
    const { diagramsDiffer } = await import('./playbookImport.ts');
    const h = '0'.repeat(240);
    assert.equal(diagramsDiffer(h, '1' + '0'.repeat(239)), false);
    assert.equal(diagramsDiffer(h, 'f'.repeat(30) + '0'.repeat(210)), true);
  });
});

describe('Play Bank shared by coaches', () => {
  const play = (id: string, extra: any = {}) => ({ id, name: id.toUpperCase(), unit: 'offense', formation: '', type: 'run', situations: [], ...extra });
  it('plays another coach added are kept, and so are this coach\'s own', async () => {
    const { mergePlayBanks } = await import('./playBankMerge.ts');
    const mine = [play('a'), play('b'), play('mine_new', { editedAt: 50 })] as any[];
    const theirs = [play('a'), play('b'), play('their_new', { editedAt: 60 })] as any[];
    const merged = mergePlayBanks(mine, theirs, []);
    assert.deepEqual(merged.map((p: any) => p.id), ['a', 'b', 'their_new', 'mine_new']);
  });
  it('the later edit of the same play wins; deleted plays stay deleted', async () => {
    const { mergePlayBanks, mergeDeletedPlayIds, stampPlayEdits } = await import('./playBankMerge.ts');
    const before = [play('a'), play('b')] as any[];
    const mine = stampPlayEdits(before, [play('a', { notes: 'mine' }), play('b')], 100);
    assert.equal(mine[0].editedAt, 100);
    assert.equal(mine[1].editedAt, undefined);
    const theirs = [play('a', { notes: 'theirs', editedAt: 90 }), play('b', { notes: 'theirs', editedAt: 120 })] as any[];
    const merged = mergePlayBanks(mine, theirs, []);
    assert.equal(merged.find((p: any) => p.id === 'a').notes, 'mine');
    assert.equal(merged.find((p: any) => p.id === 'b').notes, 'theirs');
    const gone = mergeDeletedPlayIds(['b'], ['c']);
    assert.deepEqual(mergePlayBanks(mine, [...theirs, play('c')] as any[], gone).map((p: any) => p.id), ['a']);
  });
  it('nothing new: keeps the same list', async () => {
    const { mergePlayBanks } = await import('./playBankMerge.ts');
    const mine = [play('a'), play('b')] as any[];
    assert.equal(mergePlayBanks(mine, [play('a'), play('b')] as any[], []), mine);
  });
});

describe('attendance, roster and saves shared by coaches', () => {
  it('two coaches taking attendance keep both sessions; a delete sticks until the session is taken again', async () => {
    const { mergeAttendanceLogs, mergeTombstones } = await import('./recordMerge.ts');
    const a = { id: 's1', date: '2026-09-20', timestamp: 100, presentPlayerNums: ['7'] };
    const b = { id: 's2', date: '2026-09-21', timestamp: 110, presentPlayerNums: ['9'] };
    const both = mergeAttendanceLogs([a] as any[], [b] as any[], {});
    assert.deepEqual(both.map((r: any) => r.id), ['s2', 's1']);
    const deleted = mergeTombstones({ s1: 200 }, {});
    assert.deepEqual(mergeAttendanceLogs(both, [a, b] as any[], deleted).map((r: any) => r.id), ['s2']);
    const retaken = { ...a, editedAt: 300 };
    assert.deepEqual(mergeAttendanceLogs([b] as any[], [retaken, b] as any[], deleted).map((r: any) => r.id).sort(), ['s1', 's2']);
  });

  it('roster: players are team + number; edits merge per player; removed players stay removed', async () => {
    const { mergeRosters, stampRosterEdits, removedPlayerKeys, playerKey } = await import('./recordMerge.ts');
    const p = (num: string, teamId: string, extra: any = {}) => ({ num, teamId, firstName: 'A', lastName: num, ...extra });
    assert.notEqual(playerKey(p('7', 'team_10u')), playerKey(p('7', 'team_9u')));
    const before = [p('7', 'team_10u'), p('7', 'team_9u'), p('12', 'team_10u')];
    const mine = stampRosterEdits(before, [p('7', 'team_10u', { notes: 'mine' }), p('7', 'team_9u'), p('12', 'team_10u')], 100);
    assert.equal(mine[0].editedAt, 100);
    assert.equal(mine[1].editedAt, undefined);
    const theirs = [p('7', 'team_10u', { notes: 'old', editedAt: 50 }), p('7', 'team_9u', { notes: 'theirs', editedAt: 120 }), p('12', 'team_10u'), p('22', 'team_10u', { editedAt: 130 })];
    const merged = mergeRosters(mine, theirs, { [playerKey(p('12', 'team_10u'))]: 150 });
    assert.equal(merged.find((x: any) => x.num === '7' && x.teamId === 'team_10u').notes, 'mine');
    assert.equal(merged.find((x: any) => x.num === '7' && x.teamId === 'team_9u').notes, 'theirs');
    assert.ok(merged.some((x: any) => x.num === '22'));
    assert.ok(!merged.some((x: any) => x.num === '12'));
    assert.deepEqual(removedPlayerKeys(before, before.slice(0, 2)), [playerKey(p('12', 'team_10u'))]);
  });

  it('hours only count sessions of the player\'s own team', async () => {
    const { calculatePlayerHours } = await import('./hoursCalculation.ts');
    const logs = [
      { id: 'a', teamId: 'team_10u', week: '1', date: '2026-09-01', hours: 2, sessionType: 'padded', presentPlayerNums: ['7'], absentPlayerNums: [] },
      { id: 'b', teamId: 'team_9u', week: '1', date: '2026-09-01', hours: 3, sessionType: 'padded', presentPlayerNums: ['7'], absentPlayerNums: [] },
    ] as any[];
    assert.equal(calculatePlayerHours({ num: '7', teamId: 'team-10u' } as any, logs, '1').paddedHours, 2);
    assert.equal(calculatePlayerHours({ num: '7', teamId: 'team_9u' } as any, logs, '1').paddedHours, 3);
  });

  it('changes saved together write every kind of document', async () => {
    const { cloudModulesForScope } = await import('../services/storageService.ts');
    assert.deepEqual(cloudModulesForScope('roster+attendance')?.sort(), ['attendance', 'roster']);
    assert.equal(cloudModulesForScope('roster+force'), undefined);
    assert.deepEqual(cloudModulesForScope('focusout+practice'), ['practice']);
  });
});

describe('play library order', () => {
  it('groups by formation number, Left before Right, then the call in number order', async () => {
    const { compareByFormation, formationGroupOf, playSideOf } = await import('./playbookImport.ts');
    const mk = (name: string, formation = '', unit = 'offense') => ({ name, formation, unit }) as any;
    const plays = [
      mk('32 R WISHBONE 26 DIVE', '32 R WISHBONE'),
      mk('21 R 31 TOSS SWEEP', '21 R'),
      mk('11 R SMOKE', '11 R'),
      mk('21L 26 DIVE', '21 L'),
      mk('21 L 19 KEEP', '21 L'),
      mk('4-4 BASE STACK LIZ', '4-4', 'defense'),
      mk('11 L JET', '11 L'),
    ];
    assert.deepEqual(
      [...plays].sort(compareByFormation).map((p) => p.name),
      ['11 L JET', '11 R SMOKE', '21 L 19 KEEP', '21L 26 DIVE', '21 R 31 TOSS SWEEP', '32 R WISHBONE 26 DIVE', '4-4 BASE STACK LIZ']
    );
    assert.equal(formationGroupOf(mk('21L 26 DIVE')), '21');
    assert.equal(playSideOf(mk('21L 26 DIVE')), 'L');
    assert.equal(playSideOf(mk('32 R WISHBONE 26 DIVE')), 'R');
  });
});

describe('play builder engine', () => {
  it('assembles 21 Pro I-Form toss as 11 players with a Hudl name', async () => {
    const { assemblePlay, isValidEleven, compatibleBackfields, autoDrawPlay, findBack } = await import('./footballEngine.ts');
    const play = assemblePlay('21_PRO', 'I_FORM', '31_TOSS', 'Right');
    assert.equal(play.nodes.length, 11);
    assert.ok(findBack(play.nodes, 1));
    assert.ok(findBack(play.nodes, 2));
    assert.ok(findBack(play.nodes, 3));
    assert.equal(play.hudlExport.OFF_FORM, 'Pro');
    assert.equal(play.hudlExport.BACKFIELD, 'I-Form');
    assert.ok(play.playName.includes('31 Toss Sweep'));
    assert.equal(play.metadata.targetHole, 1);
    assert.equal(isValidEleven('21_PRO', 'I_FORM'), true);
    assert.ok(compatibleBackfields('21_PRO').includes('I_FORM'));
    assert.ok(compatibleBackfields('21_PRO').includes('I_OFFSET_R'));
    assert.ok(compatibleBackfields('21_PRO').includes('WILDCAT'));
    const beast = assemblePlay('21_BEAST', 'WING_T', 'BEAST_SWEEP', 'Right');
    assert.equal(beast.nodes.length, 11);
    assert.equal(beast.hudlExport.OFF_FORM, 'Beast');
    assert.equal(beast.hudlExport.BACKFIELD, 'Wing-T');
    const twinsOpt = assemblePlay('21_TWINS_I', 'WING_T', 'TWINS_OPTION', 'Right');
    assert.ok(twinsOpt.playName.includes('Twins Speed Option'));
    const gunI = assemblePlay('21_PRO', 'GUN_I', '32_POWER', 'Right');
    assert.equal(gunI.nodes.length, 11);
    const { OUR_DEFENSE_LOOKS, conceptFamily, PLAY_CONCEPTS } = await import('./footballEngine.ts');
    assert.equal(OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes.length, 11);
    assert.equal(conceptFamily(PLAY_CONCEPTS.SMASH), 'pass');
    const lines = autoDrawPlay({
      nodes: play.nodes,
      hole: 1,
      primaryBack: 3,
      concept: PLAY_CONCEPTS['31_TOSS'].concept,
      scheme: PLAY_CONCEPTS['31_TOSS'].scheme,
      tags: ['Jet'],
      family: conceptFamily(PLAY_CONCEPTS['31_TOSS']),
    });
    assert.ok(lines.some((s) => s.kind === 'run' && s.points[s.points.length - 1].x > 4));
    assert.ok(lines.length >= 2);
  });

  it('numbers running holes from Center: 5 over C, 6 C-LG, 7 LG-T', async () => {
    const { assemblePlay, runningHoleXs } = await import('./footballEngine.ts');
    const right = assemblePlay('21_PRO', 'I_FORM', '26_DIVE', 'Right');
    const xs = runningHoleXs(right.nodes);
    const C = right.nodes.find((n) => n.role === 'C')!.x;
    const LG = right.nodes.find((n) => n.role === 'LG')!.x;
    const LT = right.nodes.find((n) => n.role === 'LT')!.x;
    const RG = right.nodes.find((n) => n.role === 'RG')!.x;
    assert.equal(xs[5], C);
    assert.equal(xs[6], (C + LG) / 2);
    assert.equal(xs[7], (LG + LT) / 2);
    assert.ok(xs[6] < xs[5]);
    assert.ok(xs[4] > xs[5]);
    assert.equal(xs[4], (C + RG) / 2);
    const left = assemblePlay('21_PRO', 'I_FORM', '26_DIVE', 'Left');
    const lxs = runningHoleXs(left.nodes);
    const lgL = left.nodes.find((n) => n.role === 'LG')!.x;
    assert.equal(lxs[6], (left.nodes.find((n) => n.role === 'C')!.x + lgL) / 2);
    assert.ok(lxs[6] < 0);
  });

  it('numbers the QB as 1 and applies tags to the diagram', async () => {
    const { assemblePlay, applyFormationTags, resolveTaggedCall, autoDrawPlay, conceptFamily, PLAY_CONCEPTS, diagramLabel } = await import('./footballEngine.ts');
    assert.equal(diagramLabel('1'), '1');
    const pro = assemblePlay('21_PRO', 'I_FORM', '31_TOSS', 'Right');
    const x0 = pro.nodes.find((n) => n.role === 'X')!.x;
    const tight = applyFormationTags(pro.nodes, ['Tight'], 'Right');
    assert.ok(Math.abs(tight.find((n) => n.role === 'X')!.x) < Math.abs(x0));
    const flex = applyFormationTags(pro.nodes, ['Flex'], 'Right');
    assert.ok(Math.abs(flex.find((n) => n.role === 'Y')!.x) > Math.abs(pro.nodes.find((n) => n.role === 'Y')!.x));
    const keep = resolveTaggedCall({ hole: 7, primaryBack: 4, family: 'run', tags: ['Keep'], hasBack: () => true });
    assert.equal(keep.primaryBack, 1);
    const stretch = resolveTaggedCall({ hole: 7, primaryBack: 4, family: 'run', tags: ['Stretch'] });
    assert.equal(stretch.hole, 9);
    const thump = assemblePlay('32_WISHBONE', 'WISHBONE', '47_ZONE', 'Left', ['Thumper']);
    const y1 = thump.nodes.find((n) => n.role === 'Y1')!;
    const y2 = thump.nodes.find((n) => n.role === 'Y2')!;
    const lt = thump.nodes.find((n) => n.role === 'LT')!.x;
    assert.ok(y1.x < 0 && y2.x < 0);
    assert.ok(y1.line && y2.line);
    assert.ok(Math.min(y1.x, y2.x) < lt);
    assert.ok(Math.max(y1.x, y2.x) < 0);
    const bone = assemblePlay('32_WISHBONE', 'WISHBONE', '47_ZONE', 'Left', ['Jet']);
    const jet = autoDrawPlay({
      nodes: bone.nodes,
      hole: 7,
      primaryBack: 4,
      concept: PLAY_CONCEPTS['47_ZONE'].concept,
      scheme: PLAY_CONCEPTS['47_ZONE'].scheme,
      tags: ['Jet'],
      family: conceptFamily(PLAY_CONCEPTS['47_ZONE']),
    });
    assert.ok(jet.some((s) => s.kind === 'run' && s.points.length >= 3 && Math.abs(s.points[0].x) > 4));
  });

  it('every backfield uses 1-2-3-4 and textbook alignment', async () => {
    const { BACKFIELD_STRUCTURES } = await import('./footballEngine.ts');
    const keys = Object.keys(BACKFIELD_STRUCTURES);
    assert.ok(keys.length >= 40);
    for (const key of keys) {
      const b = BACKFIELD_STRUCTURES[key];
      const roles = b.nodes.map((n) => n.role);
      assert.equal(new Set(roles).size, roles.length, key);
      assert.ok(roles.every((r) => /^[1-4]$/.test(r)), key);
      if (key !== 'WILDCAT') assert.ok(roles.includes('1'), key);
      for (let i = 0; i < b.nodes.length; i++) {
        for (let j = i + 1; j < b.nodes.length; j++) {
          const a = b.nodes[i];
          const c = b.nodes[j];
          assert.ok(Math.hypot(a.x - c.x, a.y - c.y) > 0.9, `${key} ${a.role}/${c.role} overlap`);
        }
      }
    }
    const bone = BACKFIELD_STRUCTURES.WISHBONE.nodes;
    assert.equal(bone.find((n) => n.role === '2')!.x, 0);
    assert.ok(bone.find((n) => n.role === '3')!.x < 0);
    assert.ok(bone.find((n) => n.role === '4')!.x > 0);
    const gunI = BACKFIELD_STRUCTURES.GUN_I.nodes;
    const q = gunI.find((n) => n.role === '1')!;
    const f = gunI.find((n) => n.role === '2')!;
    const t = gunI.find((n) => n.role === '3')!;
    assert.ok(q.y < -4);
    assert.ok(f.y < q.y);
    assert.ok(t.y < f.y);
    assert.ok(BACKFIELD_STRUCTURES.KING.nodes.find((n) => n.role === '3')!.x < 0);
    assert.ok(BACKFIELD_STRUCTURES.QUEEN.nodes.find((n) => n.role === '3')!.x > 0);
    const { BASE_FORMATIONS, isValidEleven, compatibleBackfields, assemblePlay, autoDrawPlay } = await import('./footballEngine.ts');
    for (const key of Object.keys(BASE_FORMATIONS)) {
      const backs = compatibleBackfields(key);
      assert.ok(backs.length > 0, key);
      assert.equal(isValidEleven(key, backs[0]), true, key);
    }
    const dw = assemblePlay('32_DOUBLE_WING', 'DOUBLE_WING', '38_POWER', 'Right');
    assert.equal(dw.nodes.length, 11);
    assert.ok(dw.nodes.some((n) => n.role === '3' && n.x < -4));
    const power = autoDrawPlay({
      nodes: dw.nodes,
      hole: 8,
      primaryBack: 3,
      concept: '38 Power',
      scheme: 'Power',
      tags: [],
      family: 'run',
    });
    assert.ok(power.some((s) => s.kind === 'block' && s.points.length >= 4));
  });
});

describe('this device\'s storage', () => {
  it('stores each week once and moves film out, and reads it back the same', async () => {
    const { packWeeklyData, unpackWeeklyData } = await import('./bigLocalStore.ts');
    const week = { opponent: 'Carmel', depthChart: { qb: [{ num: '7' }] }, scouting: { notes: 'x', hudlScout: { plays: [{ id: 'p1' }] } } };
    const data = { team_10u__week_4: week, '4': week, team_9u__week_4: { opponent: 'Other' } };
    const { local, film } = packWeeklyData(data, true);
    assert.deepEqual(local['4'], { __sameAs: 'team_10u__week_4' });
    assert.equal(local.team_10u__week_4.scouting.hudlScout, undefined);
    assert.equal(local.team_10u__week_4.scouting.notes, 'x');
    assert.deepEqual(Object.keys(film).sort(), ['4', 'team_10u__week_4']);
    const back = unpackWeeklyData(JSON.parse(JSON.stringify(local)));
    assert.equal(back['4'].opponent, 'Carmel');
    assert.equal(back.team_9u__week_4.opponent, 'Other');
    // Not moved when the device database isn't ready.
    assert.ok(packWeeklyData(data, false).local.team_10u__week_4.scouting.hudlScout);
    // A plain week that differs from the team's week is kept as is.
    assert.equal(packWeeklyData({ team_10u__week_5: { opponent: 'A' }, '5': { opponent: 'B' } }, true).local['5'].opponent, 'B');
  });
});

describe('who manages which teams and coaches', () => {
  const teams = [{ id: 'team_10u', name: '10U' }, { id: 'team_9u', name: '9U' }, { id: 'team_12u', name: '12U' }] as any[];
  const owner = { email: 'dannym1010@gmail.com', role: 'Master Super Admin', status: 'Active', assignedTeamIds: ['all'] } as any;
  const head10 = { email: 'head10@x.com', role: 'Head Coach (Admin)', status: 'Active', assignedTeamIds: ['team_10u'] } as any;
  const asst10 = { email: 'asst10@x.com', role: 'Assistant Coach', status: 'Active', assignedTeamIds: ['team_10u'] } as any;
  const asst9 = { email: 'asst9@x.com', role: 'Assistant Coach', status: 'Active', assignedTeamIds: ['team_9u'] } as any;
  const both = { email: 'both@x.com', role: 'Assistant Coach', status: 'Active', assignedTeamIds: ['team_10u', 'team_9u'] } as any;
  const newbie = { email: 'new@x.com', role: 'Assistant Coach', status: 'Pending', assignedTeamIds: [] } as any;

  it('the owner has every team and manages everyone but themselves', async () => {
    const { coachTeamIds, canManageCoach, isProgramAdminCoach } = await import('./staffAccess.ts');
    assert.ok(isProgramAdminCoach(owner));
    assert.ok(isProgramAdminCoach({ email: 'DannyM1010@gmail.com', role: 'Assistant Coach', status: 'Pending' } as any));
    assert.deepEqual(coachTeamIds(owner, teams), ['team_10u', 'team_9u', 'team_12u']);
    const me = { email: owner.email, isProgramAdmin: true, teamIds: teams.map((t) => t.id) };
    assert.ok(canManageCoach(me, head10, teams));
    assert.ok(canManageCoach(me, asst9, teams));
    assert.equal(canManageCoach(me, owner, teams), false);
  });

  it('a team admin manages only coaches on their own teams, never the owner or themselves', async () => {
    const { canManageCoach, canSeeCoach, coachTeamIds, isProgramAdminCoach } = await import('./staffAccess.ts');
    assert.equal(isProgramAdminCoach(head10), false);
    const mgr = { email: head10.email, isProgramAdmin: false, teamIds: coachTeamIds(head10, teams) };
    assert.deepEqual(mgr.teamIds, ['team_10u']);
    assert.ok(canManageCoach(mgr, asst10, teams));
    assert.equal(canManageCoach(mgr, asst9, teams), false);
    assert.equal(canManageCoach(mgr, both, teams), false); // also on 9U
    assert.equal(canManageCoach(mgr, owner, teams), false);
    assert.equal(canManageCoach(mgr, head10, teams), false);
    assert.ok(canManageCoach(mgr, newbie, teams)); // new sign-up waiting for a team
    assert.ok(canSeeCoach(mgr, both, teams));
    assert.equal(canSeeCoach(mgr, asst9, teams), false);
    assert.ok(canSeeCoach(mgr, owner, teams)); // listed (read-only) so they know who runs the program
  });

  it('team ids match with either spelling', async () => {
    const { coachTeamIds } = await import('./staffAccess.ts');
    assert.deepEqual(coachTeamIds({ ...asst10, assignedTeamIds: ['team-10u'] }, teams), ['team_10u']);
  });
});

describe('each team keeps its own data', () => {
  it('sheets saved before they carried a team are 10U\'s only', async () => {
    const { savedForTeamWeek } = await import('./remoteStateMerge.ts');
    assert.ok(savedForTeamWeek({ week: '4' }, 'team_10u', '4'));
    assert.equal(savedForTeamWeek({ week: '4' }, 'team_9u', '4'), false);
    assert.ok(savedForTeamWeek({ teamId: 'team_9u', week: '4' }, 'team_9u', '4'));
    assert.equal(savedForTeamWeek({ teamId: 'team_10u', week: '4' }, 'team_9u', '4'), false);
  });
  it('a new team starts with an empty call sheet and wristband in the same layout', async () => {
    const { blankCallSheetData, blankWristbandData } = await import('./blankSheets.ts');
    const { countCallSheetPlays } = await import('./callSheetStorage.ts');
    const cs = blankCallSheetData('team_9u', '4');
    assert.equal(countCallSheetPlays(cs), 0);
    assert.ok(cs.offenseSections.length > 0);
    assert.equal(cs.teamId, 'team_9u');
    const wb = blankWristbandData('team_9u', '4');
    const plays = (wb.wristbands || []).flatMap((b) => b.columns.flatMap((c) => c.plays));
    assert.ok(plays.length > 0);
    assert.ok(plays.every((p) => p.text === ''));
    assert.equal(wb.week, '4');
  });
  it('only 10U owns the plain week copies', async () => {
    const { isPrimaryTeamId } = await import('./seasonWeekUtils.ts');
    assert.ok(isPrimaryTeamId('team_10u'));
    assert.ok(isPrimaryTeamId('team-10u'));
    assert.equal(isPrimaryTeamId('team_9u'), false);
  });
});

describe('roster import', () => {
  it('reads a TeamSnap members export and leaves out parents and managers', async () => {
    const { parseRosterCsv } = await import('./rosterCsv.ts');
    const csv = [
      'First,Last,Address,City,State,Zip,Birthdate,Jersey Number,Position,Email,Phone Number,Gender,Contact 1 Name',
      'Dan,Mancini,"",,,,"",,,dan@x.com,"",,""',
      'Kyle,Mancini,"","","","",2017-10-09,15,"",k@x.com,"",,Courtney Mancini',
      'Dante,Frazer,"",,,,"",0,,d@x.com,"",Male,""',
      'Liam,O\'Brien,"",,,,"",44,QB,l@x.com,"",Male,"Pat O\'Brien"',
    ].join('\n');
    const r = parseRosterCsv(csv, 'team_9u');
    assert.deepEqual(r.players.map((p) => `${p.num} ${p.firstName} ${p.lastName}`), ['15 Kyle Mancini', '0 Dante Frazer', "44 Liam O'Brien"]);
    assert.equal(r.players[2].primaryPosition, 'QB');
    assert.equal(r.players[0].teamId, 'team_9u');
    assert.deepEqual(r.skipped, ['Dan Mancini: no jersey number']);
  });
  it('still reads simple "number, first, last" lists', async () => {
    const { parseRosterCsv } = await import('./rosterCsv.ts');
    const r = parseRosterCsv('7, John, Smith, QB, LB\n12, Mike, Jones', 'team_10u');
    assert.deepEqual(r.players.map((p) => `${p.num} ${p.lastName} ${p.primaryPosition}/${p.secondaryPosition}`), ['7 Smith QB/LB', '12 Jones ATH/ATH']);
  });
});

describe('practice coach names shared by coaches', () => {
  it('a name another coach added is kept, and a removed name stays removed', async () => {
    const { mergeTeamCoaches, noteCoachNames } = await import('./coachNamesMerge.ts');
    // This device added Coach Tom; the other coach added Coach Sal and removed Coach Old.
    const mineMeta = noteCoachNames({}, 'team_10u', ['Coach Tom'], [], 100);
    const theirMeta = noteCoachNames({}, 'team_10u', ['Coach Sal'], ['Coach Old'], 110);
    const merged = mergeTeamCoaches(
      { team_10u: ['Coach Mike', 'Coach Old', 'Coach Tom'] },
      mineMeta,
      { team_10u: ['Coach Mike', 'Coach Sal'], team_9u: ['Coach Ann'] },
      theirMeta
    );
    assert.deepEqual(merged.lists.team_10u, ['Coach Mike', 'Coach Tom', 'Coach Sal']);
    assert.deepEqual(merged.lists.team_9u, ['Coach Ann']);
    // Adding it back later brings it back.
    const readded = noteCoachNames(merged.meta, 'team_10u', ['Coach Old'], [], 200);
    assert.ok(mergeTeamCoaches(merged.lists, readded, { team_10u: ['Coach Mike'] }, merged.meta).lists.team_10u.includes('Coach Old'));
  });
  it('an old copy without the name does not remove it', async () => {
    const { mergeTeamCoaches, noteCoachNames } = await import('./coachNamesMerge.ts');
    const meta = noteCoachNames({}, 'team_9u', ['Coach Pat'], [], 50);
    const merged = mergeTeamCoaches({ team_9u: ['Coach Pat'] }, meta, { team_9u: [] }, {});
    assert.deepEqual(merged.lists.team_9u, ['Coach Pat']);
  });
});

describe('a new team starts brand new', () => {
  it('its wristband is empty and named for the team', async () => {
    const { blankWristbandData } = await import('./blankSheets.ts');
    const wb = blankWristbandData('team_9u', '1', '9U Youth Tackle');
    assert.ok((wb.wristbands || []).every((b) => /^9U YOUTH TACKLE/.test(b.title) && !/10U/.test(b.title)));
  });
  it('copies of 10U\'s wristband, call sheet, film and scouting are recognised', async () => {
    const { primarySheetSignatures, wristbandSignature, callSheetSignature, withoutCopiedGames, isCopiedScoutReport } = await import('./teamCopies.ts');
    const wb = { wristbands: [{ columns: [{ plays: [{ text: '21 L 26 DIVE' }, { text: '' }] }] }] };
    const cs = { offenseSections: [{ plays: [{ name: '21 R 31 TOSS SWEEP' }, null] }], defenseSections: [] };
    const sigs = primarySheetSignatures({ team_10u__week_4: { wristbandData: wb, callSheetData: cs }, team_9u__week_4: { wristbandData: { wristbands: [{ columns: [{ plays: [{ text: 'OTHER' }] }] }] } } });
    assert.ok(sigs.wristbands.has(wristbandSignature(JSON.parse(JSON.stringify(wb)))));
    assert.ok(sigs.callSheets.has(callSheetSignature(cs)));
    assert.equal(sigs.wristbands.size, 1); // 9U's own card isn't 10U's
    assert.equal(wristbandSignature({ wristbands: [{ columns: [{ plays: [{ text: '' }] }] }] }), ''); // empty card is nobody's copy

    const mk = (gameId: string, n: number, shift = 0) => Array.from({ length: n }, (_, i) => ({ id: `${gameId}${i}`, gameId, playNumber: i + 1, odk: 'O', down: (i % 4) + 1, distance: 10, gainLoss: i + shift }));
    const tenU = { games: [{ id: 'g1', name: 'MSA vs Carmel' }], plays: mk('g1', 20) };
    const nineU = { games: [{ id: 'c1', name: 'MSA vs Carmel' }, { id: 'n1', name: '9U vs Brewster' }], plays: [...mk('c1', 20), ...mk('n1', 15, 3)] };
    const cleaned = withoutCopiedGames(nineU, tenU);
    assert.deepEqual(cleaned.games.map((g: any) => g.id), ['n1']);
    assert.ok(cleaned.deletedGameIds.includes('c1'));
    assert.equal(cleaned.plays.length, 15);
    assert.ok(isCopiedScoutReport({ plays: mk('x', 5) }, { plays: mk('y', 5) }));
    assert.equal(isCopiedScoutReport({ plays: mk('x', 5, 2) }, { plays: mk('y', 5) }), false);
  });
});

describe('leftover copies that 10U has since edited', () => {
  it('a sheet matching 10U slot for slot (90%+) is a copy; a team\'s own sheet is not', async () => {
    const { callSheetSlots, isNearCopy } = await import('./teamCopies.ts');
    const sheet = (names: (string | null)[]) => ({ offenseSections: [{ id: 'off_1_10', plays: names.map((n) => (n ? { name: n } : null)) }], defenseSections: [] });
    const tenU = callSheetSlots(sheet(Array.from({ length: 20 }, (_, i) => `PLAY ${i}`)));
    const copyThenEdited = callSheetSlots(sheet([...Array.from({ length: 19 }, (_, i) => `PLAY ${i}`), 'NEW 10U PLAY'])); // 10U changed 1 slot since
    assert.ok(isNearCopy(copyThenEdited, [tenU]));
    const own = callSheetSlots(sheet(['PLAY 0', 'PLAY 5', 'OTHER', 'PLAY 1', ...Array.from({ length: 10 }, (_, i) => `9U ${i}`)]));
    assert.equal(isNearCopy(own, [tenU]), false);
    assert.equal(isNearCopy(new Map(), [tenU]), false);
  });
});

describe('practice plans from the schedule', () => {
  const tmpl = { 'Standard Practice': [{ time: 15, category: 'Warm-up', stations: [] }], 'Friday Walk': [{ time: 30, category: 'Walkthrough', stations: [] }] } as any;
  const ev = (id: string, date: string, extra: any = {}) => ({ id, teamId: 'team_9u', type: 'practice', title: 'Practice', date, week: '5', startTime: '18:00', endTime: '19:30', location: 'Field 2', ...extra });
  it('each upcoming practice of the team gets its own plan with the practice time', async () => {
    const { missingPracticePlans, planIdForEvent } = await import('./autoPracticePlans.ts');
    const plans = missingPracticePlans({
      teamId: 'team_9u',
      events: [ev('a', '2026-09-29'), ev('b', '2026-10-02'), ev('old', '2026-09-01'), ev('x', '2026-09-30', { isCancelled: true }), ev('g', '2026-10-03', { type: 'game' }), { ...ev('t10', '2026-09-29'), teamId: 'team_10u' }] as any,
      plans: [{ id: 'p10', teamId: 'team_10u', date: '2026-09-29' }] as any, // 10U practicing the same day doesn't count
      templates: tmpl,
      weekdayTemplates: { Friday: 'Friday Walk' },
      fromDate: '2026-09-28',
    });
    assert.deepEqual(plans.map((p) => p.id), [planIdForEvent('a'), planIdForEvent('b')]);
    assert.equal(plans[0].startTime, '18:00');
    assert.equal(plans[0].endTime, '19:30');
    assert.equal(plans[0].location, 'Field 2');
    assert.equal(plans[0].teamId, 'team_9u');
    assert.equal(plans[0].weekFolder, 'Week 5');
    assert.equal(plans[1].day, 'Friday');
    assert.equal(plans[1].plan?.[0].category, 'Walkthrough');
    assert.equal(plans[0].lastEdited, 1);
  });
  it('never twice, and never brings back a deleted plan', async () => {
    const { missingPracticePlans, planIdForEvent } = await import('./autoPracticePlans.ts');
    const base = { teamId: 'team_9u', templates: tmpl, fromDate: '2026-09-28' };
    assert.equal(missingPracticePlans({ ...base, events: [ev('a', '2026-09-29')] as any, plans: [{ id: planIdForEvent('a'), teamId: 'team_9u', date: '2026-09-29' }] as any }).length, 0);
    assert.equal(missingPracticePlans({ ...base, events: [ev('a', '2026-09-29')] as any, plans: [{ id: 'mine', teamId: 'team_9u', date: '2026-09-29' }] as any }).length, 0);
    assert.equal(missingPracticePlans({ ...base, events: [ev('a', '2026-09-29')] as any, plans: [], deletedPlanIds: [planIdForEvent('a')] }).length, 0);
  });
});

describe('times show as AM / PM', () => {
  it('turns 24-hour times into AM / PM and leaves others alone', async () => {
    const { formatClock, formatClockRange } = await import('./timeFormat.ts');
    assert.equal(formatClock('18:00'), '6:00 PM');
    assert.equal(formatClock('07:05'), '7:05 AM');
    assert.equal(formatClock('00:30'), '12:30 AM');
    assert.equal(formatClock('12:00'), '12:00 PM');
    assert.equal(formatClock('5:30 pm'), '5:30 PM');
    assert.equal(formatClock('10:00 AM Kickoff'), '10:00 AM Kickoff');
    assert.equal(formatClock(''), '');
    assert.equal(formatClock('TBD'), 'TBD');
    assert.equal(formatClockRange('18:00', '19:30'), '6:00 PM - 7:30 PM');
    assert.equal(formatClockRange('18:00', ''), '6:00 PM');
  });
});

describe('staff accounts never get dropped by an older copy', () => {
  it('coaches in either copy are kept; removed coaches stay removed; later change wins', async () => {
    const { mergeStaffLists, stampStaffEdits } = await import('./recordMerge.ts');
    const a = { email: 'A@x.com', role: 'Head Coach (Admin)', status: 'Active' };
    const b = { email: 'b@x.com', role: 'Assistant Coach', status: 'Active' };
    const c = { email: 'c@x.com', role: 'Assistant Coach', status: 'Pending' };
    // An old copy (only a) meets the full list (a, b, c): nobody is lost.
    const merged = mergeStaffLists([a] as any[], [a, b, c] as any[], {});
    assert.deepEqual(merged.map((x: any) => x.email).sort(), ['A@x.com', 'b@x.com', 'c@x.com']);
    const merged2 = mergeStaffLists([a, b, c] as any[], [a] as any[], {});
    assert.equal(merged2.length, 3);
    // Removed on purpose (after they were last changed): gone.
    assert.deepEqual(mergeStaffLists([a, b] as any[], [a, b] as any[], { 'b@x.com': 500 }).map((x: any) => x.email), ['A@x.com']);
    // Approved later on one device wins over the older pending copy.
    const approved = stampStaffEdits([c] as any[], [{ ...c, status: 'Active' }] as any[], 900);
    assert.equal(mergeStaffLists(approved, [c] as any[], {})[0].status, 'Active');
  });
});

describe('each team has its own coaches', () => {
  it('older "all teams" or unset accounts are 10U coaches; only the owner has every team', async () => {
    const { coachTeamIds } = await import('./staffAccess.ts');
    const teams = [{ id: 'team_10u', name: '10U' }, { id: 'team_9u', name: '9U' }] as any[];
    assert.deepEqual(coachTeamIds({ email: 'a@x.com', role: 'Head Coach (Admin)', status: 'Active', assignedTeamIds: ['all'] } as any, teams), ['team_10u']);
    assert.deepEqual(coachTeamIds({ email: 'b@x.com', role: 'Assistant Coach', status: 'Active' } as any, teams), ['team_10u']);
    assert.deepEqual(coachTeamIds({ email: 'c@x.com', role: 'Assistant Coach', status: 'Active', assignedTeamIds: ['team_9u'] } as any, teams), ['team_9u']);
    assert.deepEqual(coachTeamIds({ email: 'new@x.com', role: 'Assistant Coach', status: 'Pending', assignedTeamIds: [] } as any, teams), []);
    assert.deepEqual(coachTeamIds({ email: 'dannym1010@gmail.com', role: 'Master Super Admin', status: 'Active', assignedTeamIds: ['all'] } as any, teams), ['team_10u', 'team_9u']);
  });
});

describe('export the play log for Hudl', () => {
  it('keeps the uploaded columns and adds what coaches set, in play order', async () => {
    const { parseCsvRows, autoDetectColumnMapping, normalizeHudlRow } = await import('../hudlScout/utils/csvParser.ts');
    const { hudlExportRows } = await import('../hudlScout/utils/hudlExport.ts');
    const csv = `PLAY #,ODK,DN,DIST,YARD LN,PLAY TYPE,GN/LS,OFF FORM,OFF PLAY,PLAY DIR,MY CUSTOM
2,O,2,6,-34,Run,5,-,-,L,x2
1,O,1,10,-30,Run,4,-,-,R,x1`;
    const { headers, rows } = parseCsvRows(csv);
    const m = autoDetectColumnMapping(headers);
    const plays = rows.map((r, i) => normalizeHudlRow(r, m, i)) as any[];
    // A coach tagged play 1 and set the unit, runner and a sub.
    plays[1] = { ...plays[1], playCall: '21 R 31 TOSS SWEEP', formation: '21 R', unit: 'gold', rusher: '#13 Landon Veto', subs: { RB: { num: '7', name: 'Mike' } } };
    const out = hudlExportRows(plays);
    assert.deepEqual(out.rows.map((r) => r['PLAY #']), ['1', '2']);
    const first = out.rows[0];
    assert.equal(first['PLAY DIR'], 'R'); // uploaded column kept as it was
    assert.equal(first['MY CUSTOM'], 'x1');
    assert.equal(first['OFF PLAY'], '21 R 31 TOSS SWEEP');
    assert.equal(first['OFF FORM'], '21 R');
    assert.equal(first.UNIT, 'Gold');
    assert.equal(first.RUSHER_Jersey, '13');
    assert.equal(first.RUSHER_Name, 'Landon Veto');
    assert.equal(first.SUBS, 'RB 7 Mike');
    assert.ok(out.headers.indexOf('PLAY #') < out.headers.indexOf('UNIT'));
    // Reading the exported sheet back gives the same called play and runner.
    const csv2 = [out.headers.join(','), ...out.rows.map((r) => out.headers.map((h) => String(r[h] ?? '')).join(','))].join('\n');
    const back = parseCsvRows(csv2);
    const again = back.rows.map((r, i) => normalizeHudlRow(r, autoDetectColumnMapping(back.headers), i));
    assert.equal(again[0].hudlCall, '21 R 31 TOSS SWEEP');
    assert.equal(again[0].rusher, '#13 Landon Veto');
  });
  it('plays uploaded before rows were kept still export the standard columns', async () => {
    const { hudlExportRow } = await import('../hudlScout/utils/hudlExport.ts');
    const r = hudlExportRow({ playNumber: 3, odk: 'D', quarter: 2, down: 3, distance: 4, rawYardLine: '+40', hash: 'L', playType: 'PASS', result: 'Incomplete', gainLoss: 0, formation: '32 R', direction: 'Left', defPlay: { maker: '#22 Jax', events: ['sack'] }, playCall: '4-4 STACK' } as any);
    assert.equal(r['PLAY #'], 3);
    assert.equal(r.ODK, 'D');
    assert.equal(r['DEF PLAY'], '4-4 STACK');
    assert.equal(r.TACKLER_Jersey, '22');
    assert.equal(r['DEF EVENTS'], 'SACK');
  });
  it('the CSV has no quotes, semicolons or commas inside values (Hudl\'s uploader gets stuck on them)', async () => {
    const { parseCsvRows } = await import('../hudlScout/utils/csvParser.ts');
    const { hudlExportCsv, hudlCell } = await import('../hudlScout/utils/hudlExport.ts');
    assert.equal(hudlCell('Rush, TD'), 'Rush TD');
    assert.equal(hudlCell('say "hi"\nthere'), 'say hi there');
    assert.equal(hudlCell(-3), -3);
    assert.equal(hudlCell('Left (Wide / Field)'), 'Left (Wide - Field)');
    const plays = [
      { playNumber: 14, odk: 'O', quarter: 2, down: 3, distance: 1, rawYardLine: '-1', hash: 'L', playType: 'RUN', result: 'Rush, TD', gainLoss: 1, formation: '21 R', direction: 'Middle / Inside', unit: 'gold', rusher: '#13 Landon Veto', subs: { QB: { num: '7', name: 'Jayden Silva' }, RB: { num: '22', name: 'Jaxson Pestone' } } },
      { playNumber: 13, odk: 'O', quarter: 2, down: 1, distance: 10, rawYardLine: '-40', hash: 'M', playType: 'RUN', result: 'Rush', gainLoss: 5, hudlRow: { 'PLAY #': '13', RESULT: '"Rush"', NOTES: 'good; fast, hard' } },
    ] as any[];
    const csv = hudlExportCsv(plays);
    const lines = csv.trimEnd().split('\r\n');
    assert.ok(!/[";]/.test(csv));
    assert.ok(lines.slice(1).every((l) => !l.includes('/'))); // no slashes in any value
    assert.ok(lines[0].includes('GN/LS')); // Hudl's own column names stay as they are
    const width = lines[0].split(',').length;
    assert.ok(lines.every((l) => l.split(',').length === width)); // every row lines up with the headers
    const back = parseCsvRows(csv);
    assert.equal(back.rows[0]['PLAY #'], '13');
    assert.equal(back.rows[0].RESULT, 'Rush');
    assert.equal(back.rows[0].NOTES, 'good - fast hard');
    assert.equal(back.rows[1].RESULT, 'Rush TD');
    assert.equal(back.rows[1]['PLAY DIR'], 'Middle - Inside');
    assert.equal(back.rows[1].SUBS, 'QB 7 Jayden Silva - RB 22 Jaxson Pestone');
  });
});

describe('play log columns: sort and filter any column', () => {
  const mk = (n: number, extra: any = {}) => ({ id: `p${n}`, playNumber: n, odk: 'O', quarter: 1, down: 1, distance: 10, yardLine: 50, rawYardLine: '-50', hash: 'M', playType: 'RUN', formation: '-', playName: '', result: 'Rush', gainLoss: 0, direction: '', carrierOrTarget: '', isExplosive: false, isEfficient: false, motion: '', ...extra });
  it('sorts by any column (numbers as numbers, blanks last) and filters by ticked values', async () => {
    const { sortPlays, filterPlays, filterOptions } = await import('../hudlScout/utils/playColumns.ts');
    const plays = [
      mk(1, { formation: '21 R', gainLoss: 12, result: 'Rush, TD', isExplosive: true }),
      mk(2, { formation: '-', gainLoss: -3, down: 3, distance: 2, odk: 'D' }),
      mk(3, { formation: '11 R', gainLoss: 4, down: 2, distance: 10 }),
      mk(10, { formation: '21 R', gainLoss: 4, odk: 'K', down: 0 }),
    ] as any[];
    assert.deepEqual(sortPlays(plays, 'gainLoss', false).map((p) => p.playNumber), [1, 3, 10, 2]);
    assert.deepEqual(sortPlays(plays, 'formation', true).map((p) => p.playNumber), [3, 1, 10, 2]); // "-" (blank) last
    assert.deepEqual(sortPlays(plays, 'downDist', true).map((p) => p.playNumber), [1, 3, 2, 10]); // kicks last
    assert.deepEqual(sortPlays(plays, 'playNumber', false).map((p) => p.playNumber), [10, 3, 2, 1]);
    assert.deepEqual(filterPlays(plays, { formation: ['21 R'] }).map((p) => p.playNumber), [1, 10]);
    assert.deepEqual(filterPlays(plays, { formation: ['21 R'], odk: ['O'] }).map((p) => p.playNumber), [1]);
    assert.deepEqual(filterPlays(plays, { flags: ['Explosive'] }).map((p) => p.playNumber), [1]);
    // A column's list shows what the other filters leave, with counts; blanks last.
    assert.deepEqual(filterOptions(filterPlays(plays, { odk: ['O'] }, 'formation'), 'formation'), [
      { value: '11 R', count: 1 },
      { value: '21 R', count: 1 },
    ]);
    assert.equal(filterOptions(plays, 'formation').at(-1)!.value, '(blank)');
  });
});

describe('Hudl Scout reports by week', () => {
  it('each week has its own cloud copy of the scouting film (pre-season, playoffs and championship too)', async () => {
    const { hudlCloudWeek } = await import('../services/storageService.ts');
    assert.equal(hudlCloudWeek('5'), '5'); // regular weeks unchanged
    assert.equal(hudlCloudWeek('05'), '5');
    assert.equal(hudlCloudWeek('Week 5'), '5');
    assert.equal(hudlCloudWeek('pre-4'), 'pre-4'); // was "4": shared Week 4's copy
    assert.equal(hudlCloudWeek('playoffs'), 'playoffs'); // was "1"
    assert.equal(hudlCloudWeek('championship'), 'championship'); // was "1"
    assert.notEqual(hudlCloudWeek('pre-4'), hudlCloudWeek('4'));
  });
  it('the reports library lists each week\'s games and flags a scouting game filed in two weeks', async () => {
    const { buildLibrary } = await import('../filmroom/FilmLibrary.tsx');
    const carmel = { games: [{ id: 'g1', name: 'Somers vs Carmel O', playCount: 89 }, { id: 'g2', name: 'Carmel_O vs Shrub Oak', playCount: 67 }], plays: [] };
    const weeks = [
      { key: '4', label: 'Week 4', opponent: 'Carmel Rams', hudlScout: carmel },
      { key: '5', label: 'Week 5', opponent: 'Wappingers Wildcats', hudlScout: carmel }, // copied by mistake
      { key: '6', label: 'Week 6', opponent: 'Brewster', hudlScout: { games: [{ id: 'g9', name: 'Brewster vs Somers', playCount: 50 }] } },
    ];
    const lib = buildLibrary(weeks, [{ id: 'o1', name: 'MSA vs Shrub Oak', week: '3', playCount: 58 }, { id: 'o2', name: 'MSA vs Carmel', week: '4', playCount: 60 }], '5');
    const w = (k: string) => lib.weeks.find((x) => x.key === k)!;
    assert.deepEqual(w('4').games.map((g) => [g.source, g.name, g.note]), [
      ['own', 'MSA vs Carmel', undefined],
      ['opponent', 'Somers vs Carmel O', 'Also in Week 5'],
      ['opponent', 'Carmel_O vs Shrub Oak', 'Also in Week 5'],
    ]);
    assert.equal(w('5').games[0].note, 'Also in Week 4');
    assert.equal(w('6').games[0].note, undefined);
    assert.deepEqual(lib.others.map((g) => g.name), ['MSA vs Shrub Oak']); // week 3 isn't a listed week
  });
});

describe('every save reaches the cloud', () => {
  it('each save name used in the app sends something to the other coaches (a copied week, a duplicated formation...)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { cloudModulesForScope } = await import('../services/storageService.ts');
    const root = path.resolve(process.cwd(), 'src');
    const files: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.ts$/.test(e.name)) files.push(p);
    });
    walk(root);
    const scopes = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\b(?:saveStateToStorage|flushAndSaveStateToStorage|debouncedSave)\(\s*['"`]([a-z_+]+)['"`]/g)) scopes.add(m[1]);
      // Formation edits pass their save name as { scope: '...' } to updateCurrentWeekFormations.
      if (/useFormationActions|useDepthChartDragDrop/.test(f)) for (const m of src.matchAll(/scope:\s*['"`]([a-z_]+)['"`]/g)) scopes.add(m[1]);
    }
    assert.ok(scopes.size > 20, `found ${scopes.size} save names`);
    // Saves that are meant to stay on this device (a flush of what's waiting, a personal setting,
    // or data that has its own cloud path).
    const localOnly = new Set(['focusout', 'beforeunload', 'immediate', 'idle_timeout_update', 'force_idle_logout_flush', 'scouting_update']);
    const silent = [...scopes].filter((s) => !localOnly.has(s)).filter((s) => {
      const mods = cloudModulesForScope(s);
      return Array.isArray(mods) && mods.length === 0;
    });
    assert.deepEqual(silent, [], `these saves never reach the cloud: ${silent.join(', ')}`);
    assert.deepEqual(cloudModulesForScope('copy_week'), ['week', 'formations', 'call_sheet', 'wristband']);
  });
});

describe('strong side / weak side (formation side letter vs play direction)', () => {
  const mk = (n: number, formation: string, runSide: string, extra: any = {}) =>
    ({ id: `p${n}`, playNumber: n, odk: 'O', down: 1, distance: 10, formation, runSide, direction: runSide === 'M' ? 'Middle / Inside' : runSide === 'L' ? 'Left' : 'Right', playType: 'RUN', gainLoss: 4, isEfficient: true, ...extra }) as any;
  it('21 L run left = strong, 21 L run right = weak, middle is middle; no side or no direction is not counted', async () => {
    const { formationStrength, formationBase, playStrengthSide, strengthReport } = await import('../hudlScout/utils/strength.ts');
    assert.equal(formationStrength('21 L'), 'L');
    assert.equal(formationStrength('21 R'), 'R');
    assert.equal(formationStrength('Trips Rt'), 'R');
    assert.equal(formationStrength('Doubles Left'), 'L');
    assert.equal(formationStrength('32 WB'), undefined);
    assert.equal(formationStrength('-'), undefined);
    assert.equal(formationBase('21 L'), '21');
    assert.equal(formationBase('32 WB R'), '32 WB');
    assert.equal(playStrengthSide(mk(1, '21 L', 'L')), 'strong');
    assert.equal(playStrengthSide(mk(2, '21 L', 'R')), 'weak');
    assert.equal(playStrengthSide(mk(3, '21 R', 'R')), 'strong');
    assert.equal(playStrengthSide(mk(4, '21 R', 'M')), 'middle');
    assert.equal(playStrengthSide(mk(5, '32 WB', 'L')), undefined);
    // Hudl's PLAY DIR was blank: not "middle"
    assert.equal(playStrengthSide(mk(6, '21 L', 'M', { hudlRow: { 'PLAY DIR': '' } })), undefined);
    assert.equal(playStrengthSide(mk(7, '21 L', 'L', { hudlRow: { 'PLAY DIR': 'Left (Boundary)' } })), 'strong');

    const plays = [
      mk(1, '21 L', 'L', { gainLoss: 3 }), mk(2, '21 R', 'R', { gainLoss: 5 }), mk(3, '21 L', 'R', { gainLoss: 9, down: 2 }),
      mk(4, '11 R', 'M', { gainLoss: 1, isEfficient: false }), mk(5, '11 R', 'R', { playType: 'PASS', gainLoss: 12 }), mk(6, '32 WB', 'L'),
    ];
    const isRun = (p: any) => p.playType === 'RUN';
    const r = strengthReport(plays, isRun, (p: any) => p.playType === 'PASS');
    assert.deepEqual(r.runs.count, { strong: 2, weak: 1, middle: 1 });
    assert.equal(r.runs.pct.strong, 50);
    assert.equal(r.runs.avg.strong, 4);
    assert.equal(r.runs.avg.weak, 9);
    assert.equal(r.passes.count.strong, 1);
    assert.deepEqual(r.byFormation.map((f) => [f.formation, f.total]), [['21', 3], ['11', 2]]);
    assert.equal(r.byDown.find((d) => d.down === 2)!.runs.count.weak, 1);
    assert.equal(r.strengthLeft, 2);
    assert.equal(r.strengthRight, 3);

    // The formation is just "21": the side comes from the tagged play call ("21 L 26 DIVE").
    const { callStrength, playFormationBase } = await import('../hudlScout/utils/strength.ts');
    assert.equal(callStrength('21 L 26 DIVE'), 'L');
    assert.equal(callStrength('21 R 22 DOWN'), 'R');
    assert.equal(callStrength('21 L TWINS R Z BUBBLE'), 'L');
    assert.equal(callStrength('32 WISHBONE R 28 SWEEP'), 'R');
    assert.equal(callStrength('HAWK SPECIAL'), undefined);
    assert.equal(callStrength('Rush'), undefined);
    const tagged = [
      mk(11, '21', 'L', { playCall: '21 L 26 DIVE' }),
      mk(12, '21', 'R', { playCall: '21 L 26 DIVE' }),
      mk(13, '-', 'R', { playCall: '21 R 22 DOWN', playName: '21 R 22 DOWN' }),
      mk(14, '21', 'L', { playName: 'Rush' }),
    ];
    assert.deepEqual(tagged.map(playStrengthSide), ['strong', 'weak', 'strong', undefined]);
    assert.equal(playFormationBase(tagged[2]), '21');

    const { sortPlays, filterPlays } = await import('../hudlScout/utils/playColumns.ts');
    assert.deepEqual(filterPlays(plays, { strength: ['Weak'] }).map((p) => p.playNumber), [3]);
    assert.deepEqual(sortPlays(plays, 'strength', true).map((p) => p.playNumber).slice(0, 3), [1, 2, 5]); // strong first, blanks last
  });
});

describe('balanced formations have no strong side; write-in plays', () => {
  const mk = (n: number, formation: string, runSide: string, extra: any = {}) =>
    ({ id: `p${n}`, playNumber: n, odk: 'O', down: 1, distance: 10, formation, runSide, direction: runSide === 'L' ? 'Left' : 'Right', playType: 'RUN', gainLoss: 4, isEfficient: true, ...extra }) as any;
  it('32 is balanced (even when the call says R); 21 L is still strong / weak; the list is per team', async () => {
    const { playStrengthSide, isBalancedPlay, setBalancedFormations, strengthReport } = await import('../hudlScout/utils/strength.ts');
    const { strengthText } = await import('../hudlScout/utils/playColumns.ts');
    setBalancedFormations(undefined); // default: 32
    const plays = [
      mk(1, '32', 'L'),
      mk(2, '32 WB', 'R'),
      mk(3, '-', 'R', { playCall: '32 WISHBONE R 28 SWEEP' }),
      mk(4, '21', 'L', { playCall: '21 L 26 DIVE' }),
      mk(5, '21', 'R', { playCall: '21 L 26 DIVE' }),
    ];
    assert.deepEqual(plays.map(isBalancedPlay), [true, true, true, false, false]);
    assert.deepEqual(plays.map(playStrengthSide), [undefined, undefined, undefined, 'strong', 'weak']);
    assert.deepEqual(plays.map(strengthText), ['Balanced', 'Balanced', 'Balanced', 'Strong', 'Weak']);
    const r = strengthReport(plays, (p: any) => p.playType === 'RUN', () => false);
    assert.equal(r.runs.total, 2);
    assert.equal(r.balanced, 3);
    assert.equal(r.strengthLeft + r.strengthRight, 2); // balanced plays aren't "strength left / right"
    // A team can add more (e.g. 22) or have none.
    setBalancedFormations(['32', '22']);
    assert.ok(isBalancedPlay(mk(6, '22', 'L')));
    setBalancedFormations([]);
    assert.equal(playStrengthSide(mk(7, '32 R', 'R')), 'strong');
    setBalancedFormations(undefined);
  });
  it('a write-in tags the play with the typed name, isn\'t in the Play Bank, and is offered again', async () => {
    const { writeInEntry, writeInsFromPlays, isWriteIn, tagPlays } = await import('../hudlScout/utils/playTags.ts');
    const entry = writeInEntry('  21 L  Jet Sweep ', 'offense');
    assert.ok(isWriteIn(entry.id));
    assert.equal(entry.name, '21 L Jet Sweep');
    const plays = tagPlays([mk(1, '-', 'L'), mk(2, '-', 'R')], ['p1'], entry);
    assert.equal(plays[0].playCall, 'Jet Sweep'); // "21 L" goes to the formation
    assert.equal(plays[0].playCallId, entry.id);
    assert.equal(plays[0].formation, '21 L');
    const again = writeInsFromPlays(plays);
    assert.deepEqual(again.map((e) => [e.id, e.name]), [[entry.id, '21 L Jet Sweep']]);
    const { strengthText } = await import('../hudlScout/utils/playColumns.ts');
    assert.equal(strengthText(plays[0]), 'Strong'); // side read from the written-in call
  });
  it('a write-in typed on a "32 DW" play keeps that formation and is offered with every formation', async () => {
    const { writeInEntry, writeInsFromPlays, tagPlays, callFitsFormation } = await import('../hudlScout/utils/playTags.ts');
    const w = writeInEntry('47 ZONE', 'offense', '32 DW');
    assert.equal(w.formation, '32 DW'); // not "47"
    // Tagged on a play with no formation: the write-in's formation fills it (not "47").
    const [t] = tagPlays([mk(1, '-', 'L')], ['p1'], w);
    assert.deepEqual([t.formation, t.playCall], ['32 DW', '47 ZONE']);
    // On a play filmed "32 DW": formation kept, call "47 ZONE".
    const [t2] = tagPlays([mk(2, '32 DW', 'L')], ['p2'], w);
    assert.deepEqual([t2.formation, t2.playCall], ['32 DW', '47 ZONE']);
    // Offered again from any game's plays, and with any formation's list.
    const again = writeInsFromPlays([t2]);
    assert.deepEqual(again.map((e) => [e.name, e.formation]), [['47 ZONE', '32 DW']]);
    assert.ok(callFitsFormation(again[0], '32 DW'));
    assert.ok(callFitsFormation(again[0], '21'));
    // Play Bank plays still follow the formation.
    assert.ok(!callFitsFormation({ id: 'pb1', name: '21 R 22 DOWN', formation: '21 R' }, '32 DW'));
  });
});

describe('tackles on defense and special teams, any number of assists', () => {
  it('keeps several assists (no one twice, not the tackler), reads the old single assist, and counts them', async () => {
    const { setPlayDefPlay, defAssists } = await import('./filmLineup.ts');
    const plays = [
      { id: 'd', playNumber: 1, odk: 'D', defPlay: { maker: '#22 Jax', assist: '#5 Old' } },
      { id: 'k', playNumber: 2, odk: 'K', result: 'Return, Fumble', gainLoss: 0, playType: 'SPECIAL' },
    ] as any[];
    assert.deepEqual(defAssists(plays[0].defPlay), ['#5 Old']);
    let next = setPlayDefPlay(plays, 'd', { assists: ['#5 Old', '#7 Sam', '#7 Sam', '#22 Jax', ''] });
    assert.deepEqual(next[0].defPlay, { maker: '#22 Jax', assists: ['#5 Old', '#7 Sam'] });
    next = setPlayDefPlay(next, 'k', { maker: '#9 Kick', assists: ['#3 Cover', '#4 Cover'] });
    assert.deepEqual(defAssists(next[1].defPlay), ['#3 Cover', '#4 Cover']);

    const { playerFilmStats } = await import('./playerFilmStats.ts');
    const stats = playerFilmStats(next, () => null, []);
    const by = (n: string) => stats.players.find((p: any) => p.num === n) as any;
    assert.equal(by('22').tackles, 1);
    assert.equal(by('7').assists, 1);
    assert.equal(by('9').tackles, 1);
    assert.equal(by('9').stTackles, 1);
    assert.equal(by('9').ff || 0, 0); // a kick's result text alone doesn't credit a fumble
    assert.equal(by('3').assists, 1);
    assert.equal(by('4').stTackles, 1);

    const { hudlExportRow } = await import('../hudlScout/utils/hudlExport.ts');
    const row = hudlExportRow({ ...next[0], quarter: 1, down: 1, distance: 10, playType: 'RUN', result: '', gainLoss: 0 });
    assert.equal(row.ASSIST_Jersey, '5 - 7');
    assert.equal(row.ASSIST_Name, 'Old - Sam');
  });
});

describe('film room: one shared film folder, each game finds its own folder', () => {
  // A folder tree like the "Mahopac Film" template: { name: [children] }, a string = a video file.
  type Tree = { [name: string]: (Tree | string)[] };
  const node = (name: string, kids: (Tree | string)[]): any => ({
    name,
    open: async () => ({
      dirs: kids.filter((k) => typeof k !== 'string').map((k) => { const [n, c] = Object.entries(k as Tree)[0]; return node(n, c); }),
      videos: kids.filter((k) => typeof k === 'string' && /\.(mp4|mov)$/i.test(k)).length,
    }),
  });
  const film = node('Mahopac Film', [
    'HOW TO USE - Mahopac Film.txt',
    { '10U': [
      { 'Pre-Season Week 4 - Brewster Scrimmage': ['IMG_0001.MOV'] },
      { 'Week 3 - Shrub Oak': ['PUT HUDL CLIPS HERE.txt', 'IMG_0012.MOV'] },
      { 'Week 5 - Wappingers Wildcats': [] },
      { Scouting: [
        { 'Week 5 - Wappingers Wildcats': [{ 'vs Carmel': ['a.mp4'] }, { 'vs Somers': ['b.mp4'] }] },
        { 'Week 6 - Brewster': ['c.mp4'] },
      ] },
    ] },
    { '9U': [{ 'Week 3 - Shrub Oak': ['x.mp4'] }] },
  ]);
  it('reads the week from folder names and the team from the age group', async () => {
    const { weekKeyFromFolder, normalizeWeek, pickTeamFolder, isFilmRoot, weekFolderLabel } = await import('../filmroom/folderRoutes.ts');
    assert.equal(weekKeyFromFolder('Week 3 - Shrub Oak'), '3');
    assert.equal(weekKeyFromFolder('Pre-Season Week 4 - Brewster Scrimmage'), 'pre-4');
    assert.equal(weekKeyFromFolder('wk 08 carmel'), '8');
    assert.equal(weekKeyFromFolder('Playoffs - Carmel'), 'playoffs');
    assert.equal(weekKeyFromFolder('Shrub Oak'), undefined);
    assert.equal(normalizeWeek('team_10u__week_5'), '5');
    assert.equal(normalizeWeek('Week 05'), '5');
    assert.equal(normalizeWeek('pre-4'), 'pre-4');
    assert.equal(weekFolderLabel('pre-4'), 'Pre-Season Week 4');
    const dirs = [{ name: '12U' }, { name: '10U' }, { name: '9U' }];
    assert.equal(pickTeamFolder(dirs, '10U Youth Tackle')?.name, '10U');
    assert.equal(pickTeamFolder(dirs, '9U Youth Tackle')?.name, '9U');
    assert.equal(pickTeamFolder(dirs, '8U Rookie / Flag'), undefined);
    assert.ok(isFilmRoot(dirs));
    assert.ok(!isFilmRoot([{ name: 'Week 3 - Shrub Oak' }]));
  });
  it('finds our game, a scouting game, and one of two opponent games in a week; says what is missing', async () => {
    const { resolveGameFolder } = await import('../filmroom/folderRoutes.ts');
    const path = async (game: any, team = '10U Youth Tackle', opp?: string) => {
      const r = await resolveGameFolder(film, game, team, opp);
      return 'missing' in r ? `missing: ${r.missing}` : r.path.join(' / ');
    };
    assert.equal(await path({ source: 'own', week: '3', name: 'MSA vs Shrub Oak' }), 'Mahopac Film / 10U / Week 3 - Shrub Oak');
    assert.equal(await path({ source: 'own', week: 'pre-4', name: 'Brewster scrimmage' }), 'Mahopac Film / 10U / Pre-Season Week 4 - Brewster Scrimmage');
    assert.equal(await path({ source: 'own', week: '3', name: 'MSA vs Shrub Oak' }, '9U Youth Tackle'), 'Mahopac Film / 9U / Week 3 - Shrub Oak');
    assert.equal(await path({ source: 'opponent', week: '6', name: 'Brewster vs Somers' }), 'Mahopac Film / 10U / Scouting / Week 6 - Brewster');
    assert.equal(await path({ source: 'opponent', week: '5', name: 'Wappingers vs Somers 9/14' }, '10U Youth Tackle', 'Wappingers Wildcats'), 'Mahopac Film / 10U / Scouting / Week 5 - Wappingers Wildcats / vs Somers');
    assert.equal(await path({ source: 'own', week: '7', name: 'MSA vs Somers' }), 'missing: a "Week 7 - ..." folder in "10U"');
    // The game's week set wrong in Hudl Scout (or not at all): the one folder named for the opponent.
    assert.equal(await path({ source: 'own', week: 'pre-2', name: 'MSA vs Wappingers' }), 'Mahopac Film / 10U / Week 5 - Wappingers Wildcats');
    assert.equal(await path({ source: 'own', week: '', name: 'MSA vs Shrub Oak' }), 'Mahopac Film / 10U / Week 3 - Shrub Oak');
    assert.equal(await path({ source: 'own', week: '1', name: 'x' }, '12U Senior Tackle'), 'missing: a "12U" folder in "Mahopac Film"');
    assert.equal(await path({ source: 'opponent', week: '3', name: 'x' }, '9U Youth Tackle'), 'missing: a "Scouting" folder in "9U"');
    assert.match(await path({ source: 'own', week: '', name: 'x' }), /week this game was played/);
  });
});

describe('film room: several scouting games in a week, and camera views', () => {
  type Tree = { [name: string]: (Tree | string)[] };
  const node = (name: string, kids: (Tree | string)[]): any => ({
    name,
    open: async () => ({
      dirs: kids.filter((k) => typeof k !== 'string').map((k) => { const [n, c] = Object.entries(k as Tree)[0]; return node(n, c); }),
      videos: kids.filter((k) => typeof k === 'string' && /\.(mp4|mov)$/i.test(k)).length,
    }),
  });
  const film = node('Mahopac Film', [
    { '10U': [
      { 'Week 3 - Shrub Oak': [{ Sideline: ['s1.mp4', 's2.mp4'] }, { 'End Zone': ['e1.mp4', 'e2.mp4'] }, 'PUT CLIPS HERE.txt'] },
      { 'Week 4 - Brewster': ['a.mp4', { 'End Zone': ['e.mp4'] }] },
      { Scouting: [
        { 'Week 5 - Wappingers': [
          { 'vs Carmel 9-14': [{ Sideline: ['c1.mp4'] }, { 'End Zone': ['c2.mp4'] }] },
          { 'vs Somers 9-21': ['s.mp4'] },
        ] },
        { 'Week 6 - Brewster': [{ 'Game A': ['x.mp4'] }, { 'Game B': ['y.mp4'] }] },
      ] },
    ] },
  ]);
  const where = async (game: any, pick?: string) => {
    const { resolveGameFolder } = await import('../filmroom/folderRoutes.ts');
    const r: any = await resolveGameFolder(film, game, '10U Youth Tackle', 'Wappingers', pick);
    if (r.missing) return `missing: ${r.missing}`;
    if (r.choices) return `choose: ${r.choices.map((c: any) => c.name).join(', ')}`;
    return r.path.slice(1).join(' / ') + (r.siblings ? ` [of ${r.siblings.length}]` : '');
  };
  it('finds the right scouting game by names or date, asks when it can\'t tell, and keeps a coach\'s pick', async () => {
    assert.equal(await where({ source: 'opponent', week: '5', name: 'Wappingers vs Somers' }), '10U / Scouting / Week 5 - Wappingers / vs Somers 9-21 [of 2]');
    assert.equal(await where({ source: 'opponent', week: '5', name: 'Wappingers @ Carmel 9/14/2025' }), '10U / Scouting / Week 5 - Wappingers / vs Carmel 9-14 [of 2]');
    // Only the date says which: 9/21
    assert.equal(await where({ source: 'opponent', week: '5', name: 'WAPP film 9/21' }), '10U / Scouting / Week 5 - Wappingers / vs Somers 9-21 [of 2]');
    // Nothing says which: a coach picks once, then it sticks.
    assert.equal(await where({ source: 'opponent', week: '6', name: 'Brewster film' }), 'choose: Game A, Game B');
    assert.equal(await where({ source: 'opponent', week: '6', name: 'Brewster film' }, 'Game B'), '10U / Scouting / Week 6 - Brewster / Game B [of 2]');
    // Camera-view folders are this game's views, not other games.
    assert.equal(await where({ source: 'own', week: '3', name: 'MSA vs Shrub Oak' }), '10U / Week 3 - Shrub Oak');
    const { dateKeys, isViewName } = await import('../filmroom/folderRoutes.ts');
    assert.deepEqual(dateKeys('SYF vs Shrub Oak 10/19/2025'), ['10-19']);
    assert.deepEqual(dateKeys('2025-09-14 Carmel'), ['9-14']);
    assert.ok(isViewName('End Zone') && isViewName('Sideline') && isViewName('EZ') && isViewName('Wide angle'));
    assert.ok(!isViewName('vs Carmel') && !isViewName('Game A'));
  });
  it('a game\'s views: Sideline first, then End Zone; loose clips next to a view folder are the main film', async () => {
    const { gameViews, resolveGameFolder } = await import('../filmroom/folderRoutes.ts');
    const names = async (week: string, source: 'own' | 'opponent' = 'own', name = 'x') => {
      const r: any = await resolveGameFolder(film, { source, week, name }, '10U Youth Tackle');
      return (await gameViews(r.node)).map((v: any) => v.name);
    };
    assert.deepEqual(await names('3'), ['Sideline', 'End Zone']);
    assert.deepEqual(await names('4'), ['Week 4 - Brewster', 'End Zone']);
    assert.deepEqual(await names('5', 'opponent', 'Wappingers vs Carmel'), ['Sideline', 'End Zone']);
  });
  it('the folder a coach picked merges like the Drive link (newest wins)', async () => {
    const { mergeShared } = await import('../filmroom/sharedMerge.ts');
    const a = { notes: [], deletedNotes: {}, drawings: {}, folderPick: { name: 'Game A', editedAt: 1 } };
    const b = { notes: [], deletedNotes: {}, drawings: {}, folderPick: { name: 'Game B', editedAt: 2 } };
    assert.equal(mergeShared(a, b).folderPick?.name, 'Game B');
    assert.equal(mergeShared(b, a).folderPick?.name, 'Game B');
  });
});

describe('film room: breakdown files in the film folder become Hudl Scout games', () => {
  const csv = `PLAY #,ODK,QTR,DN,DIST,YARD LN,HASH,PLAY TYPE,RESULT,GN/LS,OFF FORM,OFF PLAY,PLAY DIR
1,O,1,1,10,-30,M,Run,Rush,4,21,21 R 22 DOWN,Right
2,O,1,2,6,-34,L,Run,Rush,2,21,21 L 28 DOWN,Left
3,D,1,1,10,40,R,Run,Rush,-3,,,Left`;
  type Tree = { [name: string]: (Tree | string)[] };
  const node = (name: string, kids: (Tree | string)[]): any => ({
    name,
    open: async () => ({
      dirs: kids.filter((k) => typeof k !== 'string').map((k) => { const [n, c] = Object.entries(k as Tree)[0]; return node(n, c); }),
      videos: kids.filter((k) => typeof k === 'string' && /\.(mp4|mov)$/i.test(k)).length,
      sheets: kids
        .filter((k) => typeof k === 'string' && /\.(csv|xlsx)$/i.test(k))
        .map((k) => ({ name: k as string, get: async () => new Blob([csv], { type: 'text/csv' }) })),
    }),
  });
  const film = node('Mahopac Film', [
    { '10U': [
      { 'Week 3 - Shrub Oak': ['a.mp4', 'MSA vs Shrub Oak - Hudl breakdown.csv'] },
      { 'Week 4 - Brewster': ['b.mp4'] },
      { Scouting: [
        { 'Week 5 - Wappingers Wildcats': ['s.mp4', 'wapp.csv'] },
        { 'Week 6 - Brewster': [{ 'vs Carmel 9-14': ['c.mp4', 'carmel.xlsx'] }, { Sideline: ['x.mp4', 'ignored.csv'] }] },
      ] },
    ] },
  ]);
  it('finds each game folder with a breakdown file (ours and scouting, by week)', async () => {
    const { findBreakdowns } = await import('../filmroom/folderRoutes.ts');
    const found = await findBreakdowns(film, '10U Youth Tackle');
    assert.deepEqual(found.map((f) => [f.source, f.week, f.gameName, f.sheet.name]), [
      ['own', '3', 'Week 3 - Shrub Oak', 'MSA vs Shrub Oak - Hudl breakdown.csv'],
      ['opponent', '5', 'Week 5 - Wappingers Wildcats', 'wapp.csv'],
      ['opponent', '6', 'Brewster vs Carmel 9-14', 'carmel.xlsx'],
    ]);
    assert.equal(found[0].id, 'folder-own-10u-week-3-shrub-oak');
    assert.deepEqual(await findBreakdowns(film, '9U Youth Tackle'), []);
  });
  it('reads the file and adds the game once; a removed game stays removed; a game uploaded by hand is not added again', async () => {
    const { readBreakdown } = await import('../filmroom/folderImport.ts');
    const { addFolderGame, bundleFromSaved } = await import('../hudlScout/scoutBundle.ts');
    const plays = await readBreakdown('x.csv', new Blob([csv]));
    assert.equal(plays.length, 3);
    assert.equal(plays[0].hudlCall, '21 R 22 DOWN');
    const empty = bundleFromSaved(undefined, 'MSA');
    const first = addFolderGame(empty, plays, { id: 'folder-own-10u-week-3', name: 'Week 3 - Shrub Oak', week: '3' });
    assert.ok(first.added);
    assert.deepEqual(first.bundle.games.map((g) => [g.id, g.week, g.playCount]), [['folder-own-10u-week-3', '3', 3]]);
    assert.ok(first.bundle.plays.every((p) => p.gameId === 'folder-own-10u-week-3'));
    // The same folder again (this device, or another coach's): nothing new.
    assert.equal(addFolderGame(first.bundle, plays, { id: 'folder-own-10u-week-3', name: 'Week 3 - Shrub Oak', week: '3' }).added, false);
    // A coach removed it in Hudl Scout: it isn't brought back.
    const removed = { ...empty, deletedGameIds: ['folder-own-10u-week-3'] };
    assert.equal(addFolderGame(removed, plays, { id: 'folder-own-10u-week-3', name: 'Week 3 - Shrub Oak', week: '3' }).added, false);
    // The same game was uploaded by hand (another id, same plays): not added twice.
    const byHand = addFolderGame(empty, plays, { id: 'game-123', name: 'MSA vs Shrub Oak', week: '3' }).bundle;
    assert.equal(addFolderGame(byHand, plays, { id: 'folder-own-10u-week-3', name: 'Week 3 - Shrub Oak', week: '3' }).added, false);
  });
});

describe('film room', () => {
  it('matches clips to plays by the number in the file name, else in order', async () => {
    const { matchClipsToPlays, playNumberInName } = await import('../filmroom/clipMatching.ts');
    assert.equal(playNumberInName('Play 12.mp4'), 12);
    assert.equal(playNumberInName('012.mp4'), 12);
    assert.equal(playNumberInName('MSA vs Carmel - Clip_007.mov'), 7);
    assert.equal(playNumberInName('Sideline.mp4'), undefined);
    const plays = [{ id: 'a', playNumber: 1 }, { id: 'b', playNumber: 2 }, { id: 'c', playNumber: 10 }];
    const byNum = matchClipsToPlays([{ name: 'Play 10.mp4' }, { name: 'Play 1.mp4' }, { name: 'Play 2.mp4' }], plays);
    assert.deepEqual([byNum.get('a'), byNum.get('b'), byNum.get('c')], [1, 2, 0]);
    const inOrder = matchClipsToPlays([{ name: 'angle b.mp4' }, { name: 'angle a.mp4' }], plays);
    assert.deepEqual([inOrder.get('a'), inOrder.get('b'), inOrder.get('c')], [1, 0, undefined]);
  });
  it('clips that are just in order (camera / phone names) go with the plays in order, not by the camera number', async () => {
    const { matchClipsToPlays, clipMatchMode, playNumberInName } = await import('../filmroom/clipMatching.ts');
    for (const n of ['IMG_0012.MOV', 'GOPR0045.MP4', 'GX010012.MP4', 'P1010023.MP4', 'DSC_0003.MOV', '20260920_101512.mp4', 'VID_20260920_101512.mp4']) {
      assert.equal(playNumberInName(n), undefined, n);
    }
    const plays = Array.from({ length: 5 }, (_, i) => ({ id: `p${i + 1}`, playNumber: i + 1 }));
    // Camera numbering that starts at 12: still the first clip = the first play.
    const clips = ['IMG_0012.MOV', 'IMG_0013.MOV', 'IMG_0014.MOV', 'IMG_0015.MOV', 'IMG_0016.MOV'].map((name) => ({ name }));
    assert.equal(clipMatchMode(clips, plays), 'order');
    const m = matchClipsToPlays(clips, plays);
    assert.deepEqual(plays.map((p) => m.get(p.id)), [0, 1, 2, 3, 4]);
    // "IMG_9.MOV" before "IMG_10.MOV" (natural order), whatever order the folder lists them in.
    assert.equal(clipMatchMode([{ name: 'IMG_10.MOV' }, { name: 'IMG_9.MOV' }], plays), 'order');
    const m2 = matchClipsToPlays([{ name: 'IMG_10.MOV' }, { name: 'IMG_9.MOV' }], plays);
    assert.deepEqual([m2.get('p1'), m2.get('p2')], [1, 0]);
    // Numbers that aren't this game's plays (e.g. "Clip 101"...) fall back to order too.
    assert.equal(clipMatchMode([{ name: 'Clip 101.mp4' }, { name: 'Clip 102.mp4' }], plays), 'order');
  });
  it('coaches keep each other\'s notes; a deleted note stays deleted; later drawing wins', async () => {
    const { mergeShared, filmGameKey, sharedDocId } = await import('../filmroom/sharedMerge.ts');
    const n = (id: string, at: number) => ({ id, playId: 'p1', t: 1, text: id, author: 'x', createdAt: at, editedAt: at });
    const mine = { notes: [n('n1', 1), n('n2', 2)], deletedNotes: {}, drawings: { p1: { marks: [], editedAt: 5 } } };
    const theirs = { notes: [n('n1', 1), n('n3', 3)], deletedNotes: { n2: 10 }, drawings: { p1: { marks: [{ id: 'm', kind: 'pen', color: '#f00', width: 3, points: [] }], editedAt: 9 } } };
    const merged = mergeShared(mine as any, theirs as any);
    assert.deepEqual(merged.notes.map((x) => x.id), ['n1', 'n3']);
    assert.equal(merged.drawings.p1.marks.length, 1);
    assert.equal(filmGameKey('opponent', 'g1', 'pre-2'), 'opp_wpre-2_g1');
    assert.equal(sharedDocId('team_10u', 'own_g 1'), 'filmroom_team_10u_own_g1');
  });
});

describe('our defense in the scouting calls', () => {
  const mk = (n: number, formation: string, runSide: string, extra: any = {}) =>
    ({ id: `d${n}`, playNumber: n, odk: 'O', down: 1, distance: 10, formation, personnel: '-', runSide, direction: runSide === 'L' ? 'Left' : runSide === 'R' ? 'Right' : 'Middle', playType: 'RUN', gainLoss: 4, isEfficient: true, ...extra }) as any;
  it('4-4 Cover 3 with OLB contain; 5-3 vs two tight ends with DE contain; 5-3 Over when they run to the strength; blitz on passing downs', async () => {
    const { ourDefenseCall, tightEnds, setDefenseSystem, formationCounter } = await import('../hudlScout/utils/ourDefense.ts');
    const { setBalancedFormations } = await import('../hudlScout/utils/strength.ts');
    setBalancedFormations(undefined);
    setDefenseSystem(undefined);
    assert.equal(tightEnds(mk(1, '21 L', 'L')), 1);
    assert.equal(tightEnds(mk(1, '22 R', 'L')), 2);
    assert.equal(tightEnds(mk(1, '32', 'L')), 2);
    assert.equal(tightEnds(mk(1, 'Pro Right', 'L', { personnel: '12' })), 2);
    assert.equal(tightEnds(mk(1, 'Double TE Wing', 'L')), 2);
    assert.equal(tightEnds(mk(1, 'Trips Rt', 'L')), undefined);

    const base = ourDefenseCall(60, false, [mk(1, '21 L', 'L'), mk(2, '21 R', 'L'), mk(3, '11 R', 'R')]);
    assert.equal(base.front, '4-4');
    assert.equal(base.coverage, 'Cover 3');
    assert.match(base.emphasis, /OLBs have contain/);

    // Two tight ends, runs split: the straight 5-3, DEs contain.
    const check = ourDefenseCall(70, false, [mk(1, '22 L', 'L'), mk(2, '22 R', 'L'), mk(3, '22 L', 'R'), mk(4, '22 R', 'R')]);
    assert.equal(check.front, '5-3');
    assert.match(check.emphasis, /DEs have contain/);

    // Two tight ends, runs to the strength: 5-3 Over.
    const over = ourDefenseCall(80, false, [mk(1, '22 L', 'L'), mk(2, '22 R', 'R'), mk(3, '22 L', 'L'), mk(4, '22 R', 'R')]);
    assert.equal(over.front, '5-3 Over');
    assert.match(over.emphasis, /one gap to the strength/);

    // Balanced 32 has no strength: the straight 5-3.
    assert.equal(ourDefenseCall(80, false, [mk(1, '32', 'L'), mk(2, '32', 'R'), mk(3, '32', 'L')]).front, '5-3');

    // Passing down: the team's first blitz.
    setDefenseSystem({ blitzes: ['Fire', 'Storm'] });
    const pass = ourDefenseCall(20, false, [mk(1, '11 R', 'R', { playType: 'PASS' })], true);
    assert.equal(pass.front, '4-4 + Fire');
    assert.match(pass.emphasis, /bring Fire with Cover 3/);
    assert.match(formationCounter('22 R', true), /check 5-3.*DEs have contain/);
    assert.match(formationCounter('Trips Rt', false), /4-4 Cover 3\. OLBs keep contain/);
    setDefenseSystem(undefined);
  });
});

describe('opponent plays drawn from Their plays stay out of our playbook', () => {
  it('a scout_ row or a scout source is an opponent play; our plays are not', async () => {
    const { isScoutPlayEntry } = await import('./scoutOppPlays.ts');
    assert.equal(isScoutPlayEntry({ id: 'scout_opp-1', source: 'builder' }), true);
    assert.equal(isScoutPlayEntry({ id: 'p1', source: 'scout' }), true);
    assert.equal(isScoutPlayEntry({ id: 'p1', source: 'builder' }), false);
    assert.equal(isScoutPlayEntry({ id: 'p2' }), false);
    assert.equal(isScoutPlayEntry(null), false);
  });
});

describe('Their plays: every play tagged on the film gets a card', () => {
  const snap = (n: number, extra: any) => ({ id: `s${n}`, playNumber: n, odk: 'O', down: 1, distance: 10, fieldZone: 'own_territory', formation: '21 L', personnel: '-', playType: 'RUN', gameId: 'g1', ...extra }) as any;
  it('a library play keeps its name, a write-in gets its formation, ids are the same on every device, removed cards stay gone', async () => {
    const { cardsFromTags, tagCardId, snapsForCall } = await import('./scoutOppPlays.ts');
    const film = [
      snap(1, { playCallId: 'usr_play_8', playCall: '38 POWER', playName: '38 POWER' }),
      snap(2, { playCallId: 'usr_play_8', playCall: '38 POWER', playName: '38 POWER', down: 3, distance: 2 }),
      snap(3, { playCallId: 'writein:47 zone', playCall: '47 ZONE', playName: '47 ZONE', formation: '32 DW' }),
      snap(4, { playCallId: 'scout_opp-1', playCall: 'CARMEL TOSS' }),
      snap(5, {}),
    ];
    const names: Record<string, string> = { usr_play_8: '21 L 38 POWER' };
    const cards = cardsFromTags('g1', film, [], [], (id) => names[id]);
    assert.deepEqual(cards.map((c) => [c.name, c.formation, c.fromPlayId, c.notes]), [
      ['21 L 38 POWER', '21 L', 'usr_play_8', 'Tagged on 2 snaps.'],
      ['32 DW 47 ZONE', '32 DW', 'writein:47 zone', 'Tagged on 1 snap.'],
    ]);
    assert.equal(cards[0].id, tagCardId('g1', 'usr_play_8'));
    assert.equal(cards[1].personnel, '32');
    // Already a card, or removed: not made again.
    assert.equal(cardsFromTags('g1', film, cards, [], (id) => names[id]).length, 0);
    assert.deepEqual(cardsFromTags('g1', film, [], [cards[0].id], (id) => names[id]).map((c) => c.name), ['32 DW 47 ZONE']);
    // The card's film snaps are the tagged ones.
    assert.deepEqual(snapsForCall(film, 'g1', cards[0].name, `scout_${cards[0].id}`, cards[0].fromPlayId).map((s) => s.id), ['s1', 's2']);
  });
});

describe('play builder backfields', () => {
  it('each backfield fits the personnel with its number of backs, nobody is stacked on anybody, Beast is Power I with a wing', async () => {
    const { BASE_FORMATIONS, BACKFIELD_STRUCTURES, compatibleBackfields, combinedNodes, hasStackedPlayers, PERSONNEL_DEFINITIONS } = await import('./footballEngine.ts');
    for (const [key, b] of Object.entries(BACKFIELD_STRUCTURES)) {
      const backs = b.nodes.filter((n) => n.role !== '1').length;
      assert.deepEqual(b.allowedPersonnel, [backs * 10, backs * 10 + 1, backs * 10 + 2], key);
    }
    for (const baseKey of Object.keys(BASE_FORMATIONS)) {
      for (const bk of compatibleBackfields(baseKey)) {
        assert.equal(hasStackedPlayers(combinedNodes(baseKey, bk)!), false, `${baseKey} + ${bk}`);
        assert.equal(BACKFIELD_STRUCTURES[bk].hidden, undefined, bk);
        assert.equal(PERSONNEL_DEFINITIONS[BASE_FORMATIONS[baseKey].personnel].rb, BACKFIELD_STRUCTURES[bk].nodes.length - 1, `${baseKey} + ${bk}`);
      }
    }
    // 31 personnel gets the 3-back sets (Wishbone was 30 / 32 only).
    assert.ok(compatibleBackfields('31_POWER').includes('WISHBONE'));
    assert.ok(compatibleBackfields('31_POWER').includes('BEAST'));
    // Beast: QB, FB and TB stacked, the wing a yard off the ball just outside the strong-side end.
    const beast = combinedNodes('32_WISHBONE', 'BEAST')!;
    const at = (r: string) => beast.find((n) => n.role === r)!;
    assert.deepEqual([at('1').x, at('2').x, at('3').x], [0, 0, 0]);
    assert.ok(at('3').y < at('2').y && at('2').y < at('1').y);
    assert.ok(at('4').x > at('Y2').x && at('4').x - at('Y2').x < 3 && at('4').y < 0 && at('4').y > -2);
    // Tackle over: the end is further out, so is the wing.
    const over = combinedNodes('32_TE_OVER', 'BEAST')!;
    assert.ok(over.find((n) => n.role === '4')!.x > over.find((n) => n.role === 'Y2')!.x);
    // Maryland I is the three-back stack.
    assert.ok(BACKFIELD_STRUCTURES.MARYLAND_I.nodes.every((n) => n.x === 0));
    // Copies aren't offered.
    assert.ok(!compatibleBackfields('11_PRO').includes('KING'));
  });
  it('a freehand line keeps only its bends', async () => {
    const { simplifyLine } = await import('../components/playbook/PlayDiagramCanvas.tsx');
    const wobbly = [{ x: 0, y: 0 }, { x: 1, y: 0.05 }, { x: 2, y: -0.04 }, { x: 3, y: 0 }, { x: 3.05, y: 1 }, { x: 2.98, y: 2 }, { x: 3, y: 3 }];
    assert.deepEqual(simplifyLine(wobbly), [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }]);
  });
});

describe('reading a play call to draw it', () => {
  it('personnel, formation, side, the back to the hole, and the play', async () => {
    const { parsePlayCall } = await import('./playCallParse.ts');
    const a = parsePlayCall('30 DW 41 SWEEP');
    assert.equal(a.personnel, 30);
    assert.deepEqual(a.backfields, ['DOUBLE_WING']);
    assert.equal(a.ball, '4');
    assert.equal(a.hole, 1);
    assert.equal(a.run, 'toss');
    assert.equal(a.family, 'run');
    const b = parsePlayCall('21 L WT 26 DIVE');
    assert.deepEqual([b.personnel, b.strength, b.backfields[0], b.ball, b.hole, b.run], [21, 'Left', 'WING_T_3', '2', 6, 'dive']);
    const c = parsePlayCall('32R Beast 38 Power');
    assert.deepEqual([c.personnel, c.strength, c.backfields[0], c.ball, c.hole, c.run], [32, 'Right', 'BEAST', '3', 8, 'power']);
    // The personnel isn't read as the ball and hole; no number = no hole.
    const d = parsePlayCall('31 DOUBLE WING WEDGE');
    assert.deepEqual([d.personnel, d.backfields[0], d.ball, d.hole, d.run], [31, 'DOUBLE_WING', undefined, undefined, 'wedge']);
    assert.equal(parsePlayCall('20 WING T 18 BOOT PASS').family, 'pass');
    assert.equal(parsePlayCall('22 OVER I 38 POWER').tackleOver, true);
  });
  it('a write-in typed whole keeps its own name (no film formation in front)', async () => {
    const { tagCardName } = await import('./scoutOppPlays.ts');
    const { callResults } = await import('../hudlScout/utils/playTags.ts');
    assert.equal(tagCardName({ formation: '21 R', playCall: '30 DW 41 SWEEP' }), '30 DW 41 SWEEP');
    assert.equal(tagCardName({ formation: '32 DW', playCall: '47 ZONE' }), '32 DW 47 ZONE');
    const rows = callResults([
      { id: 'a', playCallId: 'writein:x', playCall: '30 DW 41 SWEEP', formation: '21 R', gainLoss: 3 } as any,
      { id: 'b', playCallId: 'p1', playCall: '47 ZONE', formation: '32 L', gainLoss: 3 } as any,
    ]);
    assert.deepEqual(rows.map((r) => r.name).sort(), ['30 DW 41 SWEEP', '32 L 47 ZONE']);
  });
});

describe('a scout play drawn from its name', () => {
  it('lines up the call and draws it against our defense', async () => {
    const { callSetup, drawCall } = await import('./callDiagram.ts');
    const s = callSetup({ name: '30 DW 41 SWEEP' });
    assert.deepEqual([s.personnel, s.backfield, s.ball, s.hole, s.run, s.family], [30, 'DOUBLE_WING', '4', 1, 'toss', 'run']);
    const url = drawCall({ name: '30 DW 41 SWEEP' })!;
    assert.ok(url.startsWith('data:image/svg+xml'));
    const svg = decodeURIComponent(url.split(',')[1]);
    assert.ok((svg.match(/<circle|<rect/g) || []).length >= 11, 'the offense is drawn');
    assert.ok(svg.includes('#e11d2a'), 'the ball path is drawn');
    // A Hudl name with no personnel still draws (21 personnel, the play from its word).
    assert.ok(drawCall({ name: 'CARMEL 3 ZONE' }));
    assert.equal(callSetup({ name: '21 L 38 POWER', formation: '21 L' }).strength, 'Left');
  });
});

describe('position action presets and auto-draw routes', () => {
  it('generates role metadata and routes for QB, backs, receivers, and linemen', async () => {
    const { getPositionMeta, getActionsForPosition } = await import('./playActionPresets.ts');
    assert.equal(getPositionMeta('1').group, 'qb');
    assert.equal(getPositionMeta('3').group, 'back');
    assert.equal(getPositionMeta('X').group, 'receiver');
    assert.equal(getPositionMeta('C').group, 'lineman');

    const qbActions = getActionsForPosition('1');
    const sneak = qbActions.find((a) => a.id === 'qb_sneak');
    assert.ok(sneak);
    const sneakLine = sneak.generateStroke({ x: 0, y: -4, role: '1' }, { holesXs: { 5: 0 } });
    assert.equal(sneakLine.kind, 'run');

    const rbActions = getActionsForPosition('3');
    const hole2 = rbActions.find((a) => a.hole === 2);
    assert.ok(hole2);
    const hole2Line = hole2.generateStroke({ x: 0, y: -5, role: '3' }, { holesXs: { 2: 5.5 } });
    assert.equal(hole2Line.kind, 'run');

    const xActions = getActionsForPosition('X');
    const slant = xActions.find((a) => a.id === 'rec_1_slant');
    assert.ok(slant);
    const slantLine = slant.generateStroke({ x: -14, y: 0, role: 'X' }, { holesXs: {} });
    assert.equal(slantLine.kind, 'pass');
  });
});

