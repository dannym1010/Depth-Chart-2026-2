import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAYER_TABS, firstPlayerScreen, isPlayerRole, playerCanSee } from './playerAccess.ts';
import { appRoleFor } from './staffAccess.ts';

describe('player accounts', () => {
  it('turns a staff role into an app role', () => {
    assert.equal(appRoleFor({ role: 'Player' }), 'player');
    assert.equal(appRoleFor({ role: 'Head Coach (Admin)' }), 'admin');
    assert.equal(appRoleFor({ role: 'Assistant Coach' }), 'assistant');
    assert.equal(appRoleFor(undefined), 'assistant');
    assert.equal(isPlayerRole('player'), true);
    assert.equal(isPlayerRole('Head Coach (Admin)'), false);
  });

  it('shows only the picked tabs and the screens under them', () => {
    const tabs = ['depth_chart', 'playbook'];
    assert.equal(playerCanSee(tabs, 'offense'), true);
    assert.equal(playerCanSee(tabs, 'defense'), true);
    assert.equal(playerCanSee(tabs, 'playbook'), true);
    assert.equal(playerCanSee(tabs, 'call_sheet'), false);
    assert.equal(playerCanSee(tabs, 'users'), false);
    assert.equal(firstPlayerScreen(tabs), 'depth_chart');
  });

  it('uses the defaults until a coach picks, and nothing when none are on', () => {
    assert.equal(playerCanSee(undefined, 'schedule'), DEFAULT_PLAYER_TABS.includes('schedule'));
    assert.equal(firstPlayerScreen(undefined), 'home');
    assert.equal(firstPlayerScreen([]), null);
    assert.equal(playerCanSee([], 'home'), false);
  });
});

describe('family accounts', () => {
  it('start with the Film Room only, view-only (a head coach can add tabs)', async () => {
    const { FAMILY_ROLE, isFamilyRole, isViewOnlyRole, viewerTabs, playerCanSee, firstPlayerScreen } = await import('./playerAccess.ts');
    const { appRoleFor } = await import('./staffAccess.ts');
    const fam = { role: FAMILY_ROLE };
    assert.ok(isFamilyRole(fam.role));
    assert.ok(isViewOnlyRole(fam.role));
    assert.ok(isViewOnlyRole('Player'));
    assert.ok(!isViewOnlyRole('Assistant Coach'));
    assert.equal(appRoleFor(fam), 'player');
    assert.deepEqual(viewerTabs(fam), ['filmroom']);
    assert.ok(playerCanSee(viewerTabs(fam), 'filmroom'));
    assert.ok(!playerCanSee(viewerTabs(fam), 'playbook'));
    assert.ok(!playerCanSee(viewerTabs(fam), 'hudl_scout'));
    assert.equal(firstPlayerScreen(viewerTabs(fam)), 'filmroom');
    // A player keeps the tabs a coach picked.
    assert.deepEqual(viewerTabs({ role: 'Player', playerTabs: ['home'] }), ['home']);
  });
});

describe('the database access list', () => {
  it('puts active head coaches, coaches and viewers in their groups; pending and removed stay out', async () => {
    const { accessFromStaff } = await import('./staffAccess.ts');
    const a = accessFromStaff([
      { email: 'Head@Coach.com ', role: 'Head Coach (Admin)', status: 'Active' },
      { email: 'asst@coach.com', role: 'Assistant Coach', status: 'Active' },
      { email: 'kid@team.com', role: 'Player', status: 'Active' },
      { email: 'mom@home.com', role: 'Family', status: 'Active' },
      { email: 'new@person.com', role: 'Assistant Coach', status: 'Pending' },
      { email: 'Local Coach (Offline)', role: 'Assistant Coach', status: 'Active' },
    ] as any);
    assert.deepEqual(Object.keys(a.admins).sort(), ['dannym1010@gmail.com', 'head@coach.com']);
    assert.deepEqual(Object.keys(a.coaches), ['asst@coach.com']);
    assert.deepEqual(Object.keys(a.viewers).sort(), ['kid@team.com', 'mom@home.com']);
    assert.deepEqual(a.highlighters, {});
  });
  it("lists a family's highlights helper (active viewers only) so the database lets them save the team's highlights", async () => {
    const { accessFromStaff } = await import('./staffAccess.ts');
    const a = accessFromStaff([
      { email: 'Video@Home.com', role: 'Family', status: 'Active', highlightAccess: 'helper' },
      { email: 'all@home.com', role: 'Family', status: 'Active', highlightAccess: 'all' },
      { email: 'wait@home.com', role: 'Family', status: 'Pending', highlightAccess: 'helper' },
      { email: 'asst@coach.com', role: 'Assistant Coach', status: 'Active', highlightAccess: 'helper' },
    ] as any);
    assert.deepEqual(Object.keys(a.highlighters), ['video@home.com']);
    assert.ok(a.viewers['video@home.com'] && a.viewers['all@home.com']);
  });
});

describe('Highlights level', () => {
  it("is their kid's for players and families until a coach picks more; none for coaches", async () => {
    const { highlightAccessOf } = await import('./playerAccess.ts');
    assert.equal(highlightAccessOf({ role: 'Family' }), 'kid');
    assert.equal(highlightAccessOf({ role: 'Player', highlightAccess: 'all' }), 'all');
    assert.equal(highlightAccessOf({ role: 'Family', highlightAccess: 'helper' }), 'helper');
    assert.equal(highlightAccessOf({ role: 'Family', highlightAccess: 'bogus' as any }), 'kid');
    assert.equal(highlightAccessOf({ role: 'Assistant Coach', highlightAccess: 'helper' }), undefined);
    assert.equal(highlightAccessOf(null), undefined);
  });
});

describe('tabs for every account', () => {
  it('coaches see everything until limited; players and families get their defaults and never Staff', async () => {
    const { accountTabs, defaultTabsFor, playerCanSee, tabOptionsFor } = await import('./playerAccess.ts');
    assert.equal(accountTabs({ role: 'Assistant Coach' }), undefined);
    assert.deepEqual(accountTabs({ role: 'Assistant Coach', playerTabs: ['playbook', 'users'] }), ['playbook', 'users']);
    assert.ok(playerCanSee(['playbook', 'users'], 'users'));
    assert.ok(!playerCanSee(['playbook'], 'users'));
    // Highlights (watch only) comes with the Film Room for players and families.
    assert.deepEqual(accountTabs({ role: 'Family' }), ['filmroom', 'highlights']);
    assert.deepEqual(accountTabs({ role: 'Family', playerTabs: ['filmroom', 'schedule', 'users', 'highlights'] }), ['filmroom', 'schedule', 'highlights']);
    assert.deepEqual(accountTabs({ role: 'Player' }), ['home', 'schedule', 'depth_chart', 'playbook']);
    assert.ok(playerCanSee(accountTabs({ role: 'Family' }), 'highlights'));
    assert.ok(!playerCanSee(accountTabs({ role: 'Player' }), 'highlights'));
    assert.ok(tabOptionsFor('Head Coach (Admin)').some((o) => o.id === 'users'));
    assert.ok(!tabOptionsFor('Family').some((o) => o.id === 'users'));
    assert.deepEqual(defaultTabsFor('Family'), ['filmroom']);
    assert.equal(defaultTabsFor('Assistant Coach'), undefined);
  });
});
