import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiExportText, hasAiNotes, parseAiReply } from './aiExport.ts';
import { pickScoutBundle, scoutFingerprint } from '../../utils/scoutMerge.ts';
import type { Play } from '../types/football.ts';

const mk = (n: number, x: Partial<Play>) =>
  ({ id: `g1-${n}`, gameId: 'g1', playNumber: n, odk: 'O', playType: 'PASS', down: 2, distance: 7, rawYardLine: '-30', gainLoss: 9, hash: 'L', formation: 'Twins Rt', runSide: 'R', direction: 'Right', motion: '-', ...x }) as Play;

describe('AI export and import', () => {
  it('writes the plays as a table with the field side and the twins side, and asks for JSON back', () => {
    const text = aiExportText([mk(1, {}), mk(2, { playType: 'RUN', formation: '21 L', runSide: 'L', direction: 'Left', hash: 'R', oppRusher: '#22 Smith, Jr' })], {
      team: 'Mahopac 10U',
      opponent: 'Carmel',
      mode: 'opponent',
      unit: 'offense',
      appRead: ['They throw to the wide side.'],
      ourDefense: '4-4 with Cover 3 behind it',
    });
    assert.ok(text.startsWith('# Scouting Carmel: offense (2 plays)'));
    assert.ok(text.includes('Our defense: 4-4 with Cover 3 behind it.'));
    assert.ok(text.includes('"refs": ["ref1", "ref2"]'));
    assert.ok(text.includes('- They throw to the wide side.'));
    assert.ok(text.includes('g1-1,g1,1,,2,7,-30,L,,Twins Rt,R,R,,,PASS,,Right,wide,9,,'));
    // The run from the right hash going left is to the wide side; a comma in a name is quoted.
    assert.ok(text.includes('g1-2,g1,2,,2,7,-30,R,,21 L,L,,,,RUN,,Left,wide,9,,"#22 Smith, Jr"'));
  });

  it('reads the JSON answer in a code block, a bare one, or plain words', () => {
    const reply = 'Here you go:\n```json\n{"summary":"Spread team.","items":[{"title":"Throw at the twins on 2nd (6 of 8)","detail":"Wide side.","answer":"Rotate to the twins.","refs":["g1-1"]}]}\n```';
    const n = parseAiReply(reply, 'coach@x.com', 5);
    assert.deepEqual(n, { summary: 'Spread team.', items: [{ title: 'Throw at the twins on 2nd (6 of 8)', detail: 'Wide side.', answer: 'Rotate to the twins.', refs: ['g1-1'] }], importedAt: 5, by: 'coach@x.com' });
    assert.equal(parseAiReply('{"items":[{"headline":"Sweep left","description":"On 1st."}]}', undefined, 1).items[0].title, 'Sweep left');
    const words = parseAiReply('They run power to the strong side.', undefined, 1);
    assert.equal(words.summary, 'They run power to the strong side.');
    assert.deepEqual(words.items, []);
    assert.throws(() => parseAiReply('  '));
    assert.equal(hasAiNotes({ items: [], importedAt: 9 }), false);
  });

  it('the notes put in last win when two copies of the report merge, and a removal sticks', () => {
    const base = { plays: [{ id: 'a' }], games: [], updatedAt: 10 };
    const mine = { ...base, aiNotes: { summary: 'old', items: [], importedAt: 20 }, updatedAt: 20 };
    const theirs = { ...base, updatedAt: 30 };
    assert.equal(pickScoutBundle(mine, theirs).aiNotes.summary, 'old');
    const removed = { ...base, aiNotes: { items: [], importedAt: 40 }, updatedAt: 40 };
    assert.equal(hasAiNotes(pickScoutBundle(mine, removed).aiNotes), false);
    assert.notEqual(scoutFingerprint(mine), scoutFingerprint({ ...mine, aiNotes: { summary: 'new', items: [], importedAt: 50 } }));
  });
});
