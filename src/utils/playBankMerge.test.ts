import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergePlayBanks } from './playBankMerge.ts';

describe('plays to the cloud without video stills', () => {
  it('a still taken on the film stays on its device; everything else about the play goes; it comes back without losing the still', async () => {
    const { playsForCloud } = await import('./footballEngine.ts');
    const still = 'data:image/jpeg;base64,' + 'A'.repeat(200000);
    const play: any = { id: 'p1', name: '32 Toss', editedAt: 5, builder: { baseKey: '32', homographyQuad: { preset: 'custom' }, homographyFrameUrl: still, strokes: [1] } };
    const [cloud] = playsForCloud([play]) as any[];
    assert.equal(cloud.builder.homographyFrameUrl, undefined);
    assert.deepEqual(cloud.builder.homographyQuad, { preset: 'custom' });
    assert.deepEqual(cloud.builder.strokes, [1]);
    assert.ok(JSON.stringify(cloud).length < 2000);
    // This device keeps its still when the cloud copy comes back (even a newer one).
    const merged = mergePlayBanks([play], [{ ...cloud, editedAt: 6 }]) as any[];
    assert.equal(merged[0].builder.homographyFrameUrl, still);
    assert.equal(merged[0].editedAt, 6);
  });
});

describe('a drawn play is never wiped by a blank copy', () => {
  it('a blank copy made on another computer (newer stamp) loses to the drawing, both ways', () => {
    const drawn: any = { id: 'scout_1', name: '32 Toss', editedAt: 100, builder: { baseKey: '32', strokes: [1], defenseKey: '53' }, diagramUrl: 'data:image/svg+xml,x' };
    const blank: any = { id: 'scout_1', name: '32 Toss', editedAt: 999 };
    assert.equal(mergePlayBanks([drawn], [blank])[0], drawn);
    assert.equal(mergePlayBanks([blank], [drawn])[0], drawn);
    // Two drawings: the newer one wins, as before.
    const newer = { ...drawn, editedAt: 200, builder: { ...drawn.builder, strokes: [2] } };
    assert.equal(mergePlayBanks([drawn], [newer])[0], newer);
  });
});

describe('the Play Library safety net', () => {
  it('keeps the version from before a save that loses drawings, and raises the alarm', async () => {
    const { recordScoutSaves, LOSS_EVENT, scoutKeyLabel } = await import('./scoutHistory.ts');
    const g: any = globalThis as any;
    const heard: any[] = [];
    g.window = g.window || { dispatchEvent: (e: any) => heard.push(e.detail) };
    g.CustomEvent = g.CustomEvent || class { type: string; detail: any; constructor(t: string, o: any) { this.type = t; this.detail = o?.detail; } };
    const drawn = (i: number) => ({ id: `p${i}`, name: `P${i}`, editedAt: i, builder: { a: 1, b: 2, c: 3 } });
    const before = { kind: 'playbook', plays: [1, 2, 3, 4, 5].map(drawn) };
    const after = { kind: 'playbook', plays: [drawn(1), drawn(2), { id: 'p3', name: 'P3', editedAt: 9 }, { id: 'p4', name: 'P4', editedAt: 9 }, { id: 'p5', name: 'P5', editedAt: 9 }] };
    recordScoutSaves({ 'plays:test': before });
    recordScoutSaves({ 'plays:test': after });
    assert.equal(heard.length, 1);
    assert.equal(heard[0].lostNames, 3);
    assert.equal(heard[0].version.bundle.plays.length, 5);
    assert.equal(scoutKeyLabel('plays:library'), 'Play Library (your drawn plays)');
    void LOSS_EVENT;
  });
});
