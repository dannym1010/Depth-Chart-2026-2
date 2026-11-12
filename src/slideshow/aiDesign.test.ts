import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiBrief, applyPlan, readPlan } from './aiDesign.ts';
import { buildSlides, newSlideshow, photoItem, titleItem } from './slideshowData.ts';

const make = () => {
  const items = [titleItem('Season'), photoItem({ id: 'p1', folderId: 'f1', name: 'a.jpg' }), photoItem({ id: 'p2', folderId: 'f1', name: 'b.jpg' }), photoItem({ id: 'p3', folderId: 'f1', name: 'c.jpg' })];
  return newSlideshow({ name: 'Show', owner: 'me', items });
};

describe('the AI designer', () => {
  it('describes the slideshow with what Media knows', () => {
    const show = make();
    const brief = aiBrief({
      show,
      slides: buildSlides(show, [], { replaySpeed: 0.5 }),
      media: { folders: [{ id: 'f1', driveId: 'd', name: 'Week 3', opponent: 'Carmel', createdBy: '', createdAt: 0, editedAt: 0 }], deletedFolders: {}, photos: [{ id: 'p2', folderId: 'f1', kids: ['13'], score: 88, editedAt: 0 }], deletedPhotos: {} },
      highlights: [],
      roster: [{ num: '13', name: 'Landon' }],
      songs: [],
      beats: [],
    });
    const p2 = brief.slides[2] as any;
    assert.deepEqual(p2.kids, ['#13 Landon']);
    assert.equal(p2.score, 88);
    assert.match(p2.folder, /vs Carmel/);
    assert.equal(brief.slides.length, 4);
  });

  it('applies a plan: order, removals, slide changes, titles, spots, options', () => {
    const show = make();
    const [t, a, b, c] = show.items.map((i) => i.id);
    const plan = readPlan(
      'Here you go: ' +
        JSON.stringify({
          summary: 'Done',
          name: '',
          order: [t, c, a, 'nope'],
          remove: [b],
          slides: [
            { id: c, seconds: 6, transition: 'zoom', motion: 'keep', fit: 'default', look: 'bw', caption: 'Big win' },
            { id: a, seconds: 0, transition: 'keep', motion: 'in', fit: 'keep', look: 'keep', caption: '<keep>' },
            { id: 'ghost', seconds: 3, transition: 'cut', motion: 'keep', fit: 'keep', look: 'keep', caption: 'x' },
          ],
          titles: [{ afterId: '', title: 'Mahopac 10U', sub: '2026', seconds: 0 }],
          spots: [{ afterId: c, label: 'Team photo', seconds: 5 }],
          options: { transition: 'push', fadeSeconds: 0, photoSeconds: 99, look: 'keep', vignette: 'on', musicStartsAt: 2, musicVolume: -1, beatSync: '4' },
        })
    );
    const r = applyPlan(show, plan);
    const ids = r.show.items.map((i) => (i.kind === 'title' ? `T:${i.title}` : i.kind === 'spot' ? `S:${i.label}` : i.id));
    assert.deepEqual(ids, ['T:Mahopac 10U', 'T:Season', c, 'S:Team photo', a]);
    const cc = r.show.items.find((i) => i.id === c) as any;
    assert.equal(cc.seconds, 6);
    assert.equal(cc.transition, 'zoom');
    assert.equal(cc.look, 'bw');
    assert.equal(cc.caption, 'Big win');
    assert.ok(!('fit' in cc));
    assert.equal((r.show.items.find((i) => i.id === a) as any).motion, 'in');
    assert.equal(r.show.options.transition, 'push');
    assert.equal(r.show.options.photoSeconds, 12);
    assert.equal(r.show.options.vignette, true);
    assert.equal(r.show.options.musicDelay, 2);
    assert.equal(r.show.options.musicVolume, show.options.musicVolume);
    assert.equal(r.beatEvery, 4);
    assert.ok(r.changes.length >= 5);
  });

  it('a bad answer says so', () => {
    assert.throws(() => readPlan('Sorry, I cannot.'), /didn't send back a plan/);
  });
});
