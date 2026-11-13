import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pictureKey, pictureTime } from './clipPictures.ts';

const h = { game: { key: 'own_g1', gameId: 'g1', name: 'Week 1' }, view: 'Main', clip: 'IMG_1.MOV', start: 2, end: 12 };

describe("a clip's picture", () => {
  it('shows the play under way, or its freeze frame', () => {
    assert.equal(pictureTime(h), 6);
    assert.equal(pictureTime({ ...h, freeze: { at: 9, seconds: 2 } }), 9);
  });
  it('is the same picture after a small trim, a new one after a big one', () => {
    assert.equal(pictureKey(h), 'own_g1|Main|IMG_1.MOV|6');
    assert.equal(pictureKey({ ...h, start: 2.2 }), pictureKey(h));
    assert.notEqual(pictureKey({ ...h, start: 5 }), pictureKey(h));
  });
});
