import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { driveFolderLetter, driveOf, filmPathFrom, folderInside, libraryPathFrom, onDrive, tidyPath } from './exportPaths.ts';

describe('the export works out where the folders are (nothing typed)', () => {
  it('a drive, or the folder the film folder is in, gets the film folder’s name', () => {
    // What was typed before ("J:/") was the drive: the film is in J:\Mahopac Film.
    assert.equal(filmPathFrom('J:/', 'Mahopac Film', true), 'J:\\Mahopac Film');
    assert.equal(filmPathFrom('j:', 'Mahopac Film', true), 'J:\\Mahopac Film');
    assert.equal(filmPathFrom('J:\\', 'Mahopac Film', false), 'J:\\Mahopac Film');
    assert.equal(filmPathFrom('J:\\Video', 'Mahopac Film', true), 'J:\\Video\\Mahopac Film');
    assert.equal(filmPathFrom('/Volumes/Team', 'Mahopac Film', true), '/Volumes/Team/Mahopac Film');
  });

  it('a full path stays as it is (quotes from "Copy as path" and an end slash off)', () => {
    assert.equal(filmPathFrom('"J:\\Mahopac Film"', 'Mahopac Film', true), 'J:\\Mahopac Film');
    assert.equal(filmPathFrom('J:\\mahopac film\\', 'Mahopac Film', true), 'J:\\mahopac film');
    // Film from the team Drive or the film server: the name here can differ, so a typed folder is used as typed.
    assert.equal(filmPathFrom('E:\\Film 2026', 'Mahopac Film', false), 'E:\\Film 2026');
    assert.equal(filmPathFrom('', 'Mahopac Film', true), '');
  });

  it('a film folder that is a whole drive (Chrome calls J:\\ "J_drive") is that drive', () => {
    assert.equal(driveFolderLetter('J_drive'), 'J');
    assert.equal(driveFolderLetter('Mahopac Film'), '');
    assert.equal(filmPathFrom('', 'J_drive', true), 'J:\\');
    assert.equal(filmPathFrom('J:/', 'J_drive', true), 'J:\\');
    // Film from elsewhere (the team Drive) named like a drive: the drive picked here counts.
    assert.equal(filmPathFrom('E:', 'J_drive', false), 'E:\\');
    assert.equal(libraryPathFrom({ film: 'J:\\', inside: ['Mahopac Film', '10U', 'Highlights'] }).path, 'J:\\Mahopac Film\\10U\\Highlights');
  });

  it('a drive picked from the list moves the path to that drive', () => {
    assert.equal(onDrive('J:\\Mahopac Film', 'e'), 'E:\\Mahopac Film');
    assert.equal(onDrive('', 'J'), 'J:\\');
    assert.equal(filmPathFrom(onDrive('', 'J'), 'Mahopac Film', true), 'J:\\Mahopac Film');
    assert.equal(driveOf(' "j:\\x" '), 'J');
    assert.equal(driveOf('/Volumes/x'), '');
    assert.equal(tidyPath(' "J:\\a b" '), 'J:\\a b');
  });

  it('the highlights folder inside the film folder: exact, whatever was typed for it before', () => {
    // The user's layout: J:\Mahopac Film\10U\Highlights (a typed "J;/Highlights" from before doesn't count).
    assert.deepEqual(libraryPathFrom({ film: 'J:\\Mahopac Film', inside: ['10U', 'Highlights'], typed: 'J;/Highlights', name: 'Highlights' }), { path: 'J:\\Mahopac Film\\10U\\Highlights', place: 'inside' });
    assert.deepEqual(libraryPathFrom({ film: 'J:\\Mahopac Film', inside: [], name: 'Mahopac Film' }), { path: 'J:\\Mahopac Film', place: 'inside' });
    // The film folder's drive not picked yet: no path (not the old typed one).
    assert.deepEqual(libraryPathFrom({ film: '', inside: ['10U', 'Highlights'], typed: 'J;/Highlights', name: 'Highlights' }), { path: '', place: '' });
  });

  it('elsewhere: as typed, else a guess next to the film folder', () => {
    assert.deepEqual(libraryPathFrom({ film: 'J:\\Mahopac Film', inside: null, typed: 'D:\\Reels\\', name: 'Reels' }), { path: 'D:\\Reels', place: 'typed' });
    assert.deepEqual(libraryPathFrom({ film: 'J:\\Mahopac Film', inside: null, name: 'Mahopac Highlights' }), { path: 'J:\\Mahopac Highlights', place: 'guess' });
    assert.deepEqual(libraryPathFrom({ film: '', inside: null, name: 'Mahopac Highlights' }), { path: '', place: '' });
  });

  it('where one folder sits inside another, from the folder handles', async () => {
    const root = { resolve: async (h: any) => (h === lib ? ['10U', 'Highlights'] : null) };
    const lib = {};
    assert.deepEqual(await folderInside(root, lib), ['10U', 'Highlights']);
    assert.equal(await folderInside(root, {}), null);
    assert.equal(await folderInside({}, lib), null);
    assert.equal(await folderInside({ resolve: async () => Promise.reject(new Error('gone')) }, lib), null);
  });
});
