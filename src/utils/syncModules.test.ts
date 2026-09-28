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
    assert.equal(auto[1].plays[1], null);
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
    assert.equal(tagged.playCall, '21 L 39 TOSS SWEEP');
    assert.equal(tagged.playName, '21 L 39 TOSS SWEEP');
    assert.equal(tagged.formation, '21 L');
    const [back] = tagPlays([tagged], ['p1'], null);
    assert.equal(back.playCallId, undefined);
    assert.equal(back.playName, 'Rush');
    assert.equal(back.formation, '-');
    // A formation from the film is kept.
    const [withForm] = tagPlays([play({ formation: 'GUN' }) as any], ['p1'], entry);
    assert.equal(withForm.formation, 'GUN');
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
    assert.equal(first.SUBS, 'RB: #7 Mike');
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
