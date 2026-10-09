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
  it('see the Film Room only, view-only, whatever tabs were picked', async () => {
    const { FAMILY_ROLE, isFamilyRole, isViewOnlyRole, viewerTabs, playerCanSee, firstPlayerScreen } = await import('./playerAccess.ts');
    const { appRoleFor } = await import('./staffAccess.ts');
    const fam = { role: FAMILY_ROLE, playerTabs: ['home', 'playbook'] };
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
  });
});
