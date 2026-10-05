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
