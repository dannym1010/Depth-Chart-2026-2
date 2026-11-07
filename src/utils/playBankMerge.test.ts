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
