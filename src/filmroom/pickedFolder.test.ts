import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickedFolderNode, listNodeClips } from './filmSources.ts';
import { resolveGameFolder, isFilmRoot } from './folderRoutes.ts';

// A folder picked on an iPad: the files, each with its path inside the folder.
const file = (path: string) => {
  const f = new File(['x'], path.split('/').pop()!, { type: path.endsWith('.MP4') ? 'video/mp4' : '' });
  Object.defineProperty(f, 'webkitRelativePath', { value: path });
  return f;
};

describe('a film folder picked on a tablet', () => {
  it('rebuilds the folders and finds a game in them', async () => {
    const files = [
      file('Mahopac Film/10U/Week 1 - Suffern/A001C727.MP4'),
      file('Mahopac Film/10U/Week 2 - Yorktown Huskers/A002C434.MP4'),
      file('Mahopac Film/10U/Week 2 - Yorktown Huskers/A002C433.MP4'),
      file('Mahopac Film/10U/Week 2 - Yorktown Huskers/PUT HUDL CLIPS HERE.txt'),
      file('Mahopac Film/10U/Scouting/Week 3 - Shrub Oak/IMG_0001.MP4'),
    ];
    const root = pickedFolderNode(files)!;
    assert.equal(root.name, 'Mahopac Film');
    assert.ok(isFilmRoot((await root.open()).dirs));
    const found: any = await resolveGameFolder(root, { source: 'own', week: 'Week 2', name: 'MSA vs Yorktown' }, 'Mahopac 10U', 'Yorktown');
    assert.ok(found.node, JSON.stringify(found));
    assert.equal(found.node.name, 'Week 2 - Yorktown Huskers');
    const { clips, files: got } = await listNodeClips(found.node, '_');
    assert.deepEqual(clips.map((c) => c.name), ['A002C433.MP4', 'A002C434.MP4']);
    assert.equal((await got.get(clips[0].id)!()).name, 'A002C433.MP4');
  });
});
