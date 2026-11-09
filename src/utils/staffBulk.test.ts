import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyStaffEdits, matchesStaffSearch, parseAccountLines, staffGroup } from './staffBulk.ts';

describe('staff & access for a big list', () => {
  it('reads a pasted list: emails, kids and names in any order; bad lines kept apart', () => {
    const { accounts, bad } = parseAccountLines(
      [
        'Mom@Home.com, 21, Ward family',
        'dad@home.com\t#7',
        'Sam Cole <sam@cole.net>',
        'a@x.com b@y.com',
        'mom@home.com',
        'no email here',
        '',
      ].join('\n')
    );
    assert.deepEqual(accounts, [
      { email: 'mom@home.com', kids: ['21'], name: 'Ward family' },
      { email: 'dad@home.com', kids: ['7'] },
      { email: 'sam@cole.net', kids: [], name: 'Sam Cole' },
      { email: 'a@x.com', kids: [] },
      { email: 'b@y.com', kids: [] },
    ]);
    assert.deepEqual(bad, ['no email here']);
  });

  it('changes many accounts by email, only the ones allowed; null removes; undefined takes a field off', () => {
    const list = [
      { email: 'a@x.com', role: 'Family', status: 'Pending', playerTabs: ['filmroom'] },
      { email: 'b@x.com', role: 'Assistant Coach', status: 'Active' },
      { email: 'owner@x.com', role: 'Master', status: 'Active' },
    ] as any[];
    const may = (c: any) => c.email !== 'owner@x.com';
    const out = applyStaffEdits(
      list,
      [
        { email: 'A@x.com', patch: { status: 'Active', playerTabs: undefined } },
        { email: 'b@x.com', patch: null },
        { email: 'owner@x.com', patch: null },
      ],
      may
    );
    assert.deepEqual(out, [{ email: 'a@x.com', role: 'Family', status: 'Active' }, list[2]]);
    assert.equal(applyStaffEdits(list, [{ email: 'owner@x.com', patch: null }], may), list, 'nothing allowed: the same list');
  });

  it('groups and searches (a family by its kid)', () => {
    const roster = [{ num: '21', firstName: 'Nash', lastName: 'Ward' }];
    const fam = { email: 'mom@home.com', role: 'Family', status: 'Active', kids: ['21'] } as any;
    assert.equal(staffGroup(fam), 'family');
    assert.equal(staffGroup({ ...fam, status: 'Pending' }), 'pending');
    assert.equal(staffGroup({ ...fam, role: 'Player' }), 'player');
    assert.equal(staffGroup({ ...fam, role: 'Assistant Coach' }), 'coach');
    assert.ok(matchesStaffSearch(fam, 'nash', roster));
    assert.ok(matchesStaffSearch(fam, '#21', roster));
    assert.ok(matchesStaffSearch(fam, 'mom ward', roster));
    assert.ok(!matchesStaffSearch(fam, 'cole', roster));
  });
});
