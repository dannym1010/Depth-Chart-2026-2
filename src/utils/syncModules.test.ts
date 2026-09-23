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
    const { removeScoutGame, clearScoutUploads } = await import('../components/scouting/HudlScoutView.tsx');
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
