import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { packageCsv, packageFcpxml, packagePlan, packageXmeml, youtubeChapters } from './editorPackage.ts';
import { buildSlides, newSlideshow, photoItem, spotItem, titleItem } from './slideshowData.ts';
import { crc32, makeZip } from './zip.ts';

const show = () => {
  const s = newSlideshow({
    name: 'Year End',
    owner: 'me',
    items: [titleItem('Our Season'), photoItem({ id: 'p1', folderId: 'f', name: 'IMG_1.HEIC' }), photoItem({ id: 'p1', folderId: 'f', name: 'IMG_1.HEIC' }), spotItem('Team photo'), titleItem('Playoffs')],
  });
  return { ...s, options: { ...s.options, musicDelay: 2, musicVolume: 0.5 } };
};

describe('the editor package', () => {
  it('lays out the timeline with the songs under it (spots left out)', () => {
    const s = show();
    const slides = buildSlides(s, [], { replaySpeed: 0.5 }, { spots: false });
    const plan = packagePlan({ name: s.name, slides, options: s.options, base: 'C:\\Videos\\Year End', songs: [{ name: 'Song.m4a', seconds: 100, start: 10 }], clips: true });
    assert.equal(plan.items.length, 4);
    assert.equal(plan.items[1].file, 'Photos/002 IMG_1.jpg');
    // The same photo twice: one file.
    assert.equal(plan.items[2].file, plan.items[1].file);
    assert.equal(plan.items[3].file, 'Titles/004 Playoffs.png');
    assert.deepEqual(plan.music.map((m) => [m.at, m.offset, m.file]), [[2, 10, 'Music/1 Song.m4a']]);
    assert.equal(plan.musicDb, -6);
    assert.equal(plan.markers.length, 2);
    const x = packageFcpxml(plan);
    assert.match(x, /file:\/\/\/C:\/Videos\/Year%20End\/Photos\/002%20IMG_1\.jpg/);
    assert.match(x, /lane="-1"/);
    assert.match(x, /adjust-volume amount="-6dB"/);
    assert.equal((x.match(/<asset id=/g) || []).length, 4);
    assert.match(packageXmeml(plan), /<track><clipitem id="a2-1">/);
    assert.match(packageCsv(plan), /Song\.m4a \(from 0:10\)/);
  });

  it('YouTube chapters from the title cards', () => {
    const s = show();
    const slides = buildSlides(s, [], { replaySpeed: 0.5 });
    const ch = youtubeChapters(slides);
    assert.match(ch.text, /^0:00 Our Season\n0:\d\d Playoffs$/);
    assert.equal(ch.works, false);
  });

  it('makes a ZIP the usual tools can read', async () => {
    assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);
    const z = await makeZip([{ name: 'a.txt', data: 'hello' }, { name: 'Photos/b.bin', data: new Blob([new Uint8Array([1, 2, 3])]) }]);
    const b = new Uint8Array(await z.arrayBuffer());
    const dv = new DataView(b.buffer);
    assert.equal(dv.getUint32(0, true), 0x04034b50);
    const end = b.length - 22;
    assert.equal(dv.getUint32(end, true), 0x06054b50);
    assert.equal(dv.getUint16(end + 10, true), 2);
    assert.equal(dv.getUint32(14, true), 0x3610a686);
  });
});
