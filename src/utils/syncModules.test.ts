import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPasscode, isPasscodeHash, sanitizeStateSecrets, verifyPasscode } from './passcodeHash.ts';
import {
  applyCopiedFormationsToDeletedIds,
  copyWeekCharts,
  countPlacedPlayers,
} from './copyWeek.ts';
import {
  mergeDeletedFormationIds,
  mergeFilmSession,
  mergePffReviews,
  mergePracticePlansByLastEdited,
  mergeRemoteWeeklyData,
  mergeStaffByEmail,
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

function player(id: string, name: string): PlacedPlayer {
  return { id, name, num: '0' } as PlacedPlayer;
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
          { id: 'p17', name: 'Dicob', num: '17' },
          { id: 'p99', name: 'Two', num: '99' },
          { id: 'p8', name: 'Kilkenny', num: '8' },
        ] as PlacedPlayer[],
      },
      formations
    );
    assert.equal(packages.defense.black.WDE?.num, '17');
    assert.equal(packages.defense.gold.WDE?.num, '99');
    assert.equal(packages.defense.blue.WDE?.num, '8');
  });
});

describe('live drill multi-spot assignment', () => {
  it('allows the same jersey on multiple offense spots but not on defense too', async () => {
    const { canAssignPlayerToDrillUnit, getPlayerLinedUpUnit } = await import('../components/practiceDrillsUtils.ts');
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
      },
    };
    assert.equal(getPlayerLinedUpUnit(group, '12'), 'offense');
    assert.equal(canAssignPlayerToDrillUnit(group, '12', 'offense').ok, true);
    assert.equal(canAssignPlayerToDrillUnit(group, '12', 'defense').ok, false);
    assert.equal(canAssignPlayerToDrillUnit(group, '88', 'defense').ok, true);
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
