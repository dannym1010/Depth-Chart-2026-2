import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { printableDiagram, svgOfDataUrl } from './printDiagram.ts';

const svg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 760 520' width='760' height='520'><rect width='100%' height='100%' fill='#f0f0f0'/>" +
  "<g stroke='#c7c7c7'><text>40</text></g><line x1='0' y1='360' x2='760' y2='360' stroke='#7b7bef' stroke-width='2.2'/>" +
  "<path d='M300,360 L320,300' stroke='#2563eb' stroke-width='2.8'/><circle cx='380' cy='380' r='11' stroke='#111' stroke-width='1.6'/></svg>";
const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

describe('play pictures for print', () => {
  it('crops to the play, on a white field, with thicker, darker lines', () => {
    const out = svgOfDataUrl(printableDiagram(url))!;
    assert.ok(out.includes("fill='#ffffff'"));
    assert.ok(!out.includes('#f0f0f0'));
    assert.ok(out.includes('#1d4ed8') && !out.includes('#2563eb'));
    assert.ok(out.includes("stroke-width='4.06'"));
    const vb = out.match(/viewBox='([^']+)'/)![1].split(' ').map(Number);
    assert.ok(vb[1] > 200 && vb[3] < 200, `cropped: ${vb.join(' ')}`);
    assert.ok(vb[2] >= 420);
  });
  it('leaves anything else alone', () => {
    assert.equal(printableDiagram('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
    assert.equal(printableDiagram(undefined), undefined);
  });
});
