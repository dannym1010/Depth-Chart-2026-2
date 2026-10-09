import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_SVG, MOTION_COLOR, fieldToSvg, shapeDrawnLeg, strokePaths, svgToField } from './footballEngine.ts';
import { assignmentText } from '../components/playbook/PlayerAssignmentPanel.tsx';

describe('how lines are drawn', () => {
  it('motion is a zigzag, then the play continues from where it ends', () => {
    const sp = strokePaths({ kind: 'pass', motion: 1, points: [{ x: 10, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 8 }] })!;
    assert.ok(sp.motionD.split('L').length > 4, 'zigzag has many legs');
    assert.match(sp.mainD, /^M[\d.-]+,[\d.-]+ L/);
    assert.equal(sp.dashed, true);
    assert.equal(sp.cap.t, false);
  });
  it('motion only ends in an arrow in the motion color', () => {
    const sp = strokePaths({ kind: 'pass', motion: 1, points: [{ x: 10, y: 0 }, { x: 2, y: -1 }] })!;
    assert.equal(sp.mainD, '');
    assert.equal(sp.cap.color, MOTION_COLOR);
  });
  it('a freehand line is a curve; a block ends in a T', () => {
    assert.match(strokePaths({ kind: 'run', curve: true, points: [{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 5, y: 4 }] })!.mainD, / C/);
    // The curve goes through each drawn point and ends on the last one.
    const curve = strokePaths({ kind: 'run', curve: true, points: [{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 5, y: 4 }] })!.mainD;
    const mid = fieldToSvg(2, 3);
    const end = fieldToSvg(5, 4);
    assert.ok(curve.includes(` ${mid.cx.toFixed(1)},${mid.cy.toFixed(1)} C`));
    assert.ok(curve.endsWith(` ${end.cx.toFixed(1)},${end.cy.toFixed(1)}`));
    assert.equal(strokePaths({ kind: 'block', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })!.cap.t, true);
    assert.equal(strokePaths({ kind: 'run', points: [{ x: 0, y: 0 }] }), null);
  });
  it('says motion in the player\'s job', () => {
    const at = { x: 10, y: 0 };
    assert.equal(assignmentText([{ kind: 'pass', motion: 1, points: [at, { x: 2, y: -1 }, { x: 2, y: 8 }] }], at), 'Motion, then route');
    assert.equal(assignmentText([{ kind: 'pass', motion: 1, points: [at, { x: 2, y: -1 }] }], at), 'Motion');
  });
});

describe('a line drawn by hand: straight stays straight, a curve stays curved', () => {
  // A hand's path from a to b, wobbling a little, with points every few pixels.
  const path = (fn: (t: number) => { x: number; y: number }, n = 40) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
  const wobble = (t: number) => Math.sin(t * 37) * 0.08;

  it('a straight drag (with a shaky hand) becomes one straight leg', () => {
    const leg = shapeDrawnLeg(path((t) => ({ x: wobble(t), y: t * 12 })));
    assert.equal(leg.length, 2);
    assert.equal(leg.some((p) => p.smooth), false);
    const d = strokePaths({ kind: 'pass', points: leg })!.mainD;
    assert.doesNotMatch(d, /C/);
  });
  it('a curved drag keeps its curve, drawn smooth', () => {
    const leg = shapeDrawnLeg(path((t) => ({ x: Math.sin(t * Math.PI) * 6, y: t * 12 })));
    assert.ok(leg.length > 2);
    assert.ok(leg.slice(1, -1).every((p) => p.smooth));
    assert.match(strokePaths({ kind: 'run', points: leg })!.mainD, / C/);
  });
  it('a sharp cut stays a sharp break with straight legs', () => {
    // Up 10 yards, then straight out 8.
    const raw = [...path((t) => ({ x: wobble(t), y: t * 10 }), 20), ...path((t) => ({ x: t * 8, y: 10 + wobble(t) }), 20).slice(1)];
    const leg = shapeDrawnLeg(raw);
    assert.equal(leg.length, 3);
    assert.equal(leg.some((p) => p.smooth), false);
    assert.ok(Math.abs(leg[1].y - 10) < 0.6);
  });
  it('a straight stem flowing into a curve: the stem barely bows', () => {
    const stem = path((t) => ({ x: wobble(t), y: t * 8 }), 20);
    const bend = path((t) => ({ x: 3 - Math.cos(t * Math.PI / 2) * 3, y: 8 + Math.sin(t * Math.PI / 2) * 3 }), 20).slice(1);
    const leg = shapeDrawnLeg([...stem, ...bend]);
    // The stem's curve: its control points stay within a few pixels of the straight line up.
    const d = strokePaths({ kind: 'pass', points: leg })!.mainD;
    const first = d.match(/C([\d.]+),[\d.]+ ([\d.]+),/)!;
    const x0 = fieldToSvg(0, 0).cx;
    assert.ok(Math.abs(Number(first[1]) - x0) < 4 && Math.abs(Number(first[2]) - x0) < 4, d);
  });
  it('a 45-degree cut (post) stays a sharp break', () => {
    const stem = path((t) => ({ x: wobble(t), y: t * 10 }), 25);
    const cut = path((t) => ({ x: t * 5, y: 10 + t * 5 }), 15).slice(1);
    const leg = shapeDrawnLeg([...stem, ...cut]);
    assert.equal(leg.length, 3);
    assert.equal(leg.some((p) => p.smooth), false);
  });
  it('a tight curve stays one smooth curve, not a string of breaks', () => {
    // A half circle about 3 yards across (a back's path around the edge).
    const leg = shapeDrawnLeg(path((t) => ({ x: 3 - Math.cos(t * Math.PI) * 3, y: Math.sin(t * Math.PI) * 4 }), 50));
    assert.ok(leg.length > 2);
    assert.ok(leg.slice(1, -1).every((p) => p.smooth));
  });
});

describe('zooming the field', () => {
  it('zooms in 5% steps from 75% to 125%: in, kept on the field; out, the field centered with room around it', async () => {
    const { zoomView, ZOOM_LEVELS } = await import('../components/playbook/PlayDiagramCanvas.tsx');
    assert.deepEqual(ZOOM_LEVELS, [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25]);
    assert.deepEqual(zoomView(1, { cx: 380, cy: 335 }, 760, 520), { x: 0, y: 0, vw: 760, vh: 520 });
    const zin = zoomView(1.25, { cx: 0, cy: 9999 }, 760, 520);
    assert.equal(zin.x, 0);
    assert.ok(Math.abs(zin.y + zin.vh - 520) < 1e-9);
    const out = zoomView(0.8, { cx: 0, cy: 0 }, 760, 520);
    assert.deepEqual([out.vw, out.vh, out.x, out.y], [950, 650, -95, -65]);
  });
});

describe('play pictures stay small (the plays go to the cloud as one document, max 1 MB)', () => {
  it('a new picture is a few KB, and an old one with the big field shrinks and keeps its players', async () => {
    const { compactDiagramUrl, compactPlayDiagrams, diagramSvg, fieldBgSvg, svgDataUrl } = await import('./footballEngine.ts');
    const play = { nodes: [{ role: 'C', x: 0, y: 0, line: true }, { role: '3', x: 0, y: -6 }], metadata: {} } as any;
    const fresh = diagramSvg(play, [{ kind: 'run', points: [{ x: 0, y: -6 }, { x: 3, y: 2 }] }]);
    assert.ok(fresh.length < 6000, `new picture is ${fresh.length} characters`);
    assert.ok(fieldBgSvg().length < 2500, `field is ${fieldBgSvg().length} characters`);
    // As saved before: every character encoded and the field drawn one tick at a time.
    let ticks = '';
    for (let i = 0; i < 140; i++) ticks += `<line x1="0" y1="${i}" x2="9" y2="${i}" stroke="#b4b4b4" stroke-width="1.2"/>`;
    const oldSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 520"><rect width="100%" height="100%" fill="#f0f0f0"/>${ticks}<line x1="0" y1="360" x2="760" y2="360" stroke="#7b7bef" stroke-width="2.2"/><circle cx="380" cy="444" r="11" fill="#ffffff"/><text>O'Neil</text></svg>`;
    const old = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(oldSvg)}`;
    const small = compactDiagramUrl(old)!;
    assert.ok(small.length < old.length / 4, `${old.length} -> ${small.length}`);
    const back = decodeURIComponent(small.slice(small.indexOf(',') + 1));
    assert.match(back, /<circle cx='380' cy='444' r='11'/);
    assert.match(back, /O&#39;Neil/);
    assert.match(back, /pattern id='fgT'/);
    // Already small, a link, or a photo: unchanged.
    assert.equal(compactDiagramUrl(small), small);
    assert.equal(compactDiagramUrl('https://x/y.png'), 'https://x/y.png');
    const plays = [{ id: 'a', diagramUrl: old }, { id: 'b' }];
    const out = compactPlayDiagrams(plays);
    assert.notEqual(out, plays);
    assert.equal(out[1], plays[1]);
    assert.equal(compactPlayDiagrams(out), out);
    assert.equal(svgDataUrl('<a b="1">#%</a>'), "data:image/svg+xml;charset=utf-8,%3Ca b='1'%3E%23%25%3C/a%3E");
  });
});

describe('field drawn around the ball', () => {
  it('a line on a hash keeps the spacing it has in the middle, and the field still runs sideline to sideline', () => {
    const line = [-6, -4, -2, 0, 2, 4, 6];
    const px = (ball: number) => line.map((x) => fieldToSvg(x + ball, 0, ball).cx);
    const mid = px(0);
    for (const ball of [-4.2, 4.2]) {
      const at = px(ball);
      for (let i = 1; i < line.length; i++) assert.ok(Math.abs(at[i] - at[i - 1] - (mid[i] - mid[i - 1])) < 0.01);
      assert.ok(Math.abs(fieldToSvg(-22, 0, ball).cx - 0) < 0.01);
      assert.ok(Math.abs(fieldToSvg(22, 0, ball).cx - FIELD_SVG.w) < 0.01);
      for (const x of [-20, -9, -3, 0, 5, 11, 19]) {
        const p = fieldToSvg(x, 2, ball);
        assert.ok(Math.abs(svgToField(p.cx, p.cy, ball).x - x) < 1e-9);
      }
    }
    // The ball in the middle: drawn as it always was.
    assert.equal(fieldToSvg(4, 0, 0).cx, FIELD_SVG.originX + 4 * FIELD_SVG.scaleX);
  });
});
