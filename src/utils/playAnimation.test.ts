import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePlay, autoDrawPlay, OUR_DEFENSE_LOOKS, PLAY_CONCEPTS } from './footballEngine.ts';
import { BASE_BLOCK_STEP, computeAnimatedPlayFrame, DEFENSE_TRAIL, LINE_STEP, MOTION_SECONDS, PLAY_SECONDS, playAnimationSeconds, SET_SECONDS, SHIFT_SECONDS } from './playAnimation.ts';
import { passThrow, type PlayNode, type PlayStroke } from './footballEngine.ts';

describe('running a play: the offensive line', () => {
  it('pullers run their path; the rest of the line only steps into their blocks', () => {
    const play = assemblePlay('21_BEAST', 'WING_T', '31_BUCK', 'Right');
    const c = PLAY_CONCEPTS['31_BUCK'];
    const strokes = autoDrawPlay({ nodes: play.nodes, hole: c.hole, primaryBack: c.primaryBack, concept: c.concept, scheme: c.scheme, tags: [], family: 'run' as never });
    const end = computeAnimatedPlayFrame(play.nodes, strokes, [], String(c.primaryBack), 1, c.hole);
    const moved = (role: string) => {
      const a = play.nodes.find((n) => n.role === role)!;
      const b = end.nodes.find((n) => n.role === role)!;
      return Math.hypot(b.x - a.x, b.y - a.y);
    };
    // Buck sweep: both guards pull.
    assert.ok(moved('LG') > 2 && moved('RG') > 2, `guards ${moved('LG')} ${moved('RG')}`);
    for (const role of ['LT', 'C', 'RT']) assert.ok(moved(role) <= Math.max(LINE_STEP, BASE_BLOCK_STEP) + 0.01, `${role} ${moved(role)}`);
  });
});

describe('running a play: the offense blocks our defense', () => {
  const base44 = OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes;
  const run = (name: string) => {
    const c = PLAY_CONCEPTS[name];
    const play = assemblePlay('21_BEAST', 'WING_T', name, 'Right');
    const strokes = autoDrawPlay({ nodes: play.nodes, hole: c.hole, primaryBack: c.primaryBack, concept: c.concept, scheme: c.scheme, tags: [], family: 'run' as never });
    return (t: number) => computeAnimatedPlayFrame([...play.nodes, ...base44] as PlayNode[], strokes, [], String(c.primaryBack), t, c.hole);
  };
  const engaged = (f: ReturnType<typeof computeAnimatedPlayFrame>) => {
    const isDef = (r: string) => base44.some((d) => d.role === r);
    const off = f.nodes.filter((n) => !isDef(n.role));
    return f.nodes.filter((d) => isDef(d.role) && off.some((o) => Math.hypot(o.x - d.x, o.y - d.y) <= 0.55)).map((d) => d.role);
  };

  it('blockers get to their man and stay on him (buck sweep vs the 4-4)', () => {
    const at = run('31_BUCK');
    const mid = engaged(at(0.55));
    assert.ok(mid.length >= 4, `engaged at mid-play: ${mid}`);
    // The same blocks a moment later: blocks hold, they don't come and go.
    const later = engaged(at(0.62));
    assert.ok(mid.filter((r) => later.includes(r)).length >= 3, `${mid} then ${later}`);
  });

  it("a blocked defender's path keeps the defense's spacing (the tackle check reads it by time)", () => {
    const f = run('24_DIVE')(0.8);
    const lens = new Set(f.trails.filter((tr) => base44.some((d) => d.role === tr.role)).map((tr) => tr.points.length));
    assert.equal(lens.size, 1, `trail lengths ${[...lens]}`);
  });

  it('the same moment looks the same whatever frame it is reached from', () => {
    const at = run('31_BUCK');
    // A defender's spot at 0.5 shows in the 0.9 frame's trail at the same index (time-based, not stretched).
    const half = at(0.5);
    const full = at(0.9);
    const def = half.trails.find((tr) => tr.role === 'T1')!;
    const defFull = full.trails.find((tr) => tr.role === 'T1')!;
    const i = def.points.length - 1;
    assert.ok(Math.hypot(def.points[i].x - defFull.points[i].x, def.points[i].y - defFull.points[i].y) < 0.05);
  });
});

describe('running a play: pre-snap motion', () => {
  const nodes = [
    { role: 'C', x: 0, y: 0 },
    { role: '1', x: 0, y: -1 },
    { role: 'Z', x: 12, y: -1 },
    { role: '3', x: 0, y: -5 },
  ] as PlayNode[];
  // Z motions in to 3 yards outside the center; his route is drawn on its own, starting just past where the motion ends.
  const motion: PlayStroke = { kind: 'pass', points: [{ x: 12, y: -1 }, { x: 3, y: -1 }], motion: 1 };
  const route: PlayStroke = { kind: 'pass', points: [{ x: 3.5, y: -0.5 }, { x: 3.5, y: 6 }, { x: 8, y: 9 }] };
  const total = PLAY_SECONDS + MOTION_SECONDS + SET_SECONDS;
  const at = (seconds: number) => computeAnimatedPlayFrame(nodes, [motion, route], [], '3', seconds / total).nodes.find((n) => n.role === 'Z')!;

  it('takes longer with motion: the motion, set, then the play', () => {
    assert.equal(playAnimationSeconds([motion, route]), total);
    assert.equal(playAnimationSeconds([route]), PLAY_SECONDS);
  });
  it('sets a moment at the end of the motion before the snap', () => {
    const set1 = at(MOTION_SECONDS + 0.05);
    const set2 = at(MOTION_SECONDS + SET_SECONDS - 0.05);
    assert.deepEqual([set1.x, set1.y], [3, -1]);
    assert.deepEqual([set2.x, set2.y], [3, -1]);
  });
  it('then runs the route closest to where the motion ended', () => {
    const mid = at(MOTION_SECONDS + SET_SECONDS + PLAY_SECONDS / 2);
    assert.ok(mid.y > 1, `upfield after the snap: ${mid.y}`);
    const end = at(total);
    assert.deepEqual([end.x, end.y], [8, 9]);
  });
});

describe('running a play: a pre-snap shift', () => {
  const nodes = [
    { role: 'C', x: 0, y: 0 },
    { role: '1', x: 0, y: -1 },
    { role: 'Z', x: 12, y: -1 },
    { role: 'Y', x: 4, y: -1 },
    { role: '3', x: 0, y: -5 },
  ] as PlayNode[];
  // Y shifts out to 8 and sets; Z goes in motion to 3 after it; Y then runs a route from where he set.
  const yLine: PlayStroke = { kind: 'pass', points: [{ x: 4, y: -1 }, { x: 8, y: -1 }, { x: 8, y: 6 }], motion: 1, shift: 1 };
  const zMotion: PlayStroke = { kind: 'pass', points: [{ x: 12, y: -1 }, { x: 3, y: -1 }], motion: 1 };
  const total = PLAY_SECONDS + SHIFT_SECONDS + SET_SECONDS + MOTION_SECONDS + SET_SECONDS;
  const frame = (seconds: number) => computeAnimatedPlayFrame(nodes, [yLine, zMotion], [], '3', seconds / total);
  const who = (seconds: number, role: string) => frame(seconds).nodes.find((n) => n.role === role)!;

  it('takes the shift and its set, then the motion and its set, then the play', () => {
    assert.equal(playAnimationSeconds([yLine, zMotion]), total);
    assert.equal(playAnimationSeconds([yLine]), PLAY_SECONDS + SHIFT_SECONDS + SET_SECONDS);
  });
  it('shifts first while the motion man waits, then everyone sets', () => {
    const mid = SHIFT_SECONDS / 2;
    assert.ok(who(mid, 'Y').x > 4 && who(mid, 'Y').x < 8, 'Y on his way');
    assert.deepEqual([who(mid, 'Z').x, who(mid, 'Z').y], [12, -1]);
    assert.equal(frame(mid).phaseLabel, 'Shift');
    const set = SHIFT_SECONDS + SET_SECONDS / 2;
    assert.deepEqual([who(set, 'Y').x, who(set, 'Y').y], [8, -1]);
    assert.equal(frame(set).phaseLabel, 'Set');
  });
  it('then the motion, with the shifted man staying set', () => {
    const t = SHIFT_SECONDS + SET_SECONDS + MOTION_SECONDS + SET_SECONDS / 2;
    assert.deepEqual([who(t, 'Z').x, who(t, 'Z').y], [3, -1]);
    assert.deepEqual([who(t, 'Y').x, who(t, 'Y').y], [8, -1]);
  });
  it('runs his route from where he set after the snap', () => {
    const end = who(total, 'Y');
    assert.deepEqual([end.x, end.y], [8, 6]);
  });
});

describe('running a play: motion, the route drawn from where he lined up', () => {
  it('still runs it, joined from the end of the motion', () => {
    const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: 'Z', x: 12, y: -1 }] as PlayNode[];
    const motion: PlayStroke = { kind: 'pass', points: [{ x: 12, y: -1 }, { x: 3, y: -1 }], motion: 1 };
    const route: PlayStroke = { kind: 'pass', points: [{ x: 12, y: -1 }, { x: 12, y: 8 }] };
    const z = computeAnimatedPlayFrame(nodes, [motion, route], [], '3', 1).nodes.find((n) => n.role === 'Z')!;
    assert.deepEqual([z.x, z.y], [12, 8]);
  });
});

describe('running a play: a pass to the ball carrier', () => {
  const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: '3', x: 0, y: -5 }, { role: 'X', x: -12, y: -1 }] as PlayNode[];
  const go: PlayStroke = { kind: 'pass', points: [{ x: -12, y: -1 }, { x: -12, y: 12 }] };
  it('draws the ball from the QB to the end of his route', () => {
    assert.deepEqual(passThrow(nodes, [go], 'X'), { from: { x: 0, y: -1 }, to: { x: -12, y: 12 } });
    assert.equal(passThrow(nodes, [go], '3'), null);
    assert.equal(passThrow(nodes, [go], '1'), null);
  });
  it('throws it to him (one route is enough), no handoff', () => {
    const mid = computeAnimatedPlayFrame(nodes, [go], [], 'X', 0.6);
    assert.equal(mid.ball.inAir, true);
    const end = computeAnimatedPlayFrame(nodes, [go], [], 'X', 1);
    const x = end.nodes.find((n) => n.role === 'X')!;
    assert.deepEqual([end.ball.x, end.ball.y], [x.x, x.y]);
  });
});

describe('running a play: a pass to a running back', () => {
  const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: '3', x: 0, y: -5 }, { role: 'X', x: -12, y: -1 }] as PlayNode[];
  // A swing to the flat, then up the field.
  const swing: PlayStroke = { kind: 'run', points: [{ x: 0, y: -5 }, { x: 8, y: -3 }, { x: 9, y: 10 }] };
  const go: PlayStroke = { kind: 'pass', points: [{ x: -12, y: -1 }, { x: -12, y: 12 }] };
  it('a run line is a handoff unless marked as a pass', () => {
    assert.equal(passThrow(nodes, [swing, go], '3'), null);
    assert.deepEqual(passThrow(nodes, [{ ...swing, thrown: true }, go], '3'), { from: { x: 0, y: -1 }, to: { x: 8, y: -3 } });
  });
  it('marked as a pass: thrown to him (not the receiver), caught at the end of his first leg, then he runs with it', () => {
    const strokes = [{ ...swing, thrown: true }, go];
    // In the air on the way to him (aimed at him, not the receiver on the go route).
    const frames = Array.from({ length: 101 }, (_, i) => computeAnimatedPlayFrame(nodes, strokes, [], '3', i / 100));
    const flying = frames.filter((f) => f.ball.inAir && f.progress > 0.2);
    assert.ok(flying.length > 0, 'thrown');
    assert.ok(flying.every((f) => f.ball.x >= 0), 'toward the back, not the X');
    const end = computeAnimatedPlayFrame(nodes, strokes, [], '3', 1);
    const back = end.nodes.find((n) => n.role === '3')!;
    assert.deepEqual([end.ball.x, end.ball.y], [back.x, back.y]);
  });
});

describe('passing to any eligible player', () => {
  it('a tight end on a block line, marked as a pass: caught at the end of his first leg', () => {
    const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: 'Y', x: 5, y: 0 }] as PlayNode[];
    const pop: PlayStroke = { kind: 'block', thrown: true, points: [{ x: 5, y: 0 }, { x: 6, y: 4 }] };
    assert.deepEqual(passThrow(nodes, [pop], 'Y'), { from: { x: 0, y: -1 }, to: { x: 6, y: 4 } });
    assert.equal(passThrow(nodes, [{ ...pop, thrown: undefined }], 'Y'), null);
  });
  it('any back, tight end or receiver can carry it (Y3, W3 too), not the line', async () => {
    const { eligiblePlayers } = await import('./footballEngine.ts');
    const roles = eligiblePlayers([{ role: 'LT' }, { role: 'Y3' }, { role: '4' }, { role: 'W3' }, { role: 'C' }] as PlayNode[]).map((n) => n.role);
    assert.deepEqual(roles, ['4', 'Y3', 'W3']);
  });
});

describe('running a play: the run after the catch', () => {
  const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: 'X', x: -12, y: -1 }, { role: 'CBL', x: -12, y: 6 }] as PlayNode[];
  // A slant, then a red line from where he catches it, up the field.
  const slant: PlayStroke = { kind: 'pass', points: [{ x: -12, y: -1 }, { x: -12, y: 2 }, { x: -7, y: 6 }] };
  const after: PlayStroke = { kind: 'run', points: [{ x: -7, y: 6 }, { x: -6, y: 18 }] };
  it('the ball line still goes to the end of the route (the catch)', () => {
    assert.deepEqual(passThrow(nodes, [slant, after], 'X')?.to, { x: -7, y: 6 });
  });
  it('he catches it there and runs the red line with it; the corner by the catch stays a corner', () => {
    const end = computeAnimatedPlayFrame(nodes, [slant, after], [], 'X', 1);
    const x = end.nodes.find((n) => n.role === 'X')!;
    assert.deepEqual([x.x, x.y], [-6, 18]);
    assert.deepEqual([end.ball.x, end.ball.y], [-6, 18]);
    // The corner wasn't handed the receiver's red line: he reads the play (his path is the defense's own).
    const cbPath = end.trails.find((t) => t.role === 'CBL');
    assert.equal(cbPath?.color, DEFENSE_TRAIL, 'the corner did not run the receiver\'s line');
  });
});

describe('running a play: the handoff where the coach put it', () => {
  const nodes: PlayNode[] = [
    { role: 'C', x: 0, y: 0 } as PlayNode,
    { role: '1', x: 0, y: -1 } as PlayNode,
    { role: '3', x: 0, y: -5 } as PlayNode,
  ];
  // The back runs 10 yards right along the line of scrimmage area, then 10 up the field.
  const line = (handoff?: { x: number; y: number }): PlayStroke => ({ kind: 'run', points: [{ x: 0, y: -5 }, { x: 10, y: -5 }, { x: 10, y: 5 }], ...(handoff ? { handoff } : {}) });
  const post = (t: number, h?: { x: number; y: number }) => {
    // No motion or shift: the snap starts the play, which runs at an eased pace; find the progress for a post-snap time.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const f = -(Math.cos(Math.PI * mid) - 1) / 2;
      if (f < t) lo = mid;
      else hi = mid;
    }
    return computeAnimatedPlayFrame(nodes, [line(h)], [], '3', lo);
  };
  it('the QB keeps it until the back gets to the spot, there with him; then it is the back’s', () => {
    // At (5,-5): a quarter of his line, so a quarter of the way through the play.
    const before = post(0.2, { x: 5, y: -5.3 });
    const qb = before.nodes.find((n) => n.role === '1')!;
    assert.ok(Math.abs(before.ball.x - qb.x) < 0.01 && Math.abs(before.ball.y - qb.y) < 0.01, 'the QB still has it');
    const atSpot = post(0.25, { x: 5, y: -5.3 });
    const qb2 = atSpot.nodes.find((n) => n.role === '1')!;
    assert.ok(Math.hypot(qb2.x - 5, qb2.y + 5) < 1.2, `the QB meets him there (${qb2.x}, ${qb2.y})`);
    assert.equal(atSpot.phaseLabel, 'Handoff');
    const after = post(0.4, { x: 5, y: -5.3 });
    const back = after.nodes.find((n) => n.role === '3')!;
    assert.ok(Math.abs(after.ball.x - back.x) < 0.01 && Math.abs(after.ball.y - back.y) < 0.01, 'the back has it');
  });
  it('even when 1 (QB) has a drawn bootleg/fake line, 1 brings the ball to the handoff spot first and then carries out his fake', () => {
    const qbFake: PlayStroke = { kind: 'run', points: [{ x: 0, y: -1 }, { x: -6, y: -4 }, { x: -8, y: 2 }] };
    const rbRun = line({ x: 5, y: -5 });
    // At handoffProgress, 1 and the ball are both at the handoff spot (5, -5), not off on the left bootleg (-6, -4).
    const probe = computeAnimatedPlayFrame(nodes, [rbRun, qbFake], [], '3', 0.1);
    assert.ok(probe.handoffProgress !== undefined, 'handoffProgress is computed');
    const atHandoff = computeAnimatedPlayFrame(nodes, [rbRun, qbFake], [], '3', probe.handoffProgress!);
    const qb = atHandoff.nodes.find((n) => n.role === '1')!;
    assert.ok(Math.hypot(qb.x - 5, qb.y - -5) < 0.25, `1 brought the ball to the handoff spot (${qb.x}, ${qb.y})`);
    assert.ok(Math.hypot(atHandoff.ball.x - 5, atHandoff.ball.y - -5) < 0.25, `ball is at the handoff spot (${atHandoff.ball.x}, ${atHandoff.ball.y})`);
  });
  it('includes a defensive preset stem spot and stunt/blitz spot when switching defensive presets or calling a stunt/blitz', () => {
    const defNodes: PlayNode[] = [
      ...nodes,
      { role: 'MIKE', x: 2, y: 4.5 } as PlayNode,
      { role: 'DT_L', x: -1.5, y: 0.8 } as PlayNode,
    ];
    const stemFrom = { MIKE: { x: -2, y: 4.5 }, DT_L: { x: -3, y: 0.8 } };
    const stuntStroke: PlayStroke = { kind: 'run', points: [{ x: -1.5, y: 0.8 }, { x: -0.5, y: -1.5 }] };
    const fStart = computeAnimatedPlayFrame(defNodes, [line()], [stuntStroke], '3', 0.05, null, undefined, stemFrom);
    assert.ok(fStart.stemProgress !== undefined, 'stemProgress is defined when defense stems from previous preset');
    assert.ok(fStart.stuntProgress !== undefined, 'stuntProgress is defined when a stunt/blitz is active');
    const mikeEarly = fStart.nodes.find((n) => n.role === 'MIKE')!;
    assert.ok(mikeEarly.x > -2 && mikeEarly.x < 2, `MIKE is stemming from -2 toward +2 (${mikeEarly.x})`);
  });
  it('no spot set: handed off just after the snap, as before', () => {
    const f = post(0.3);
    const back = f.nodes.find((n) => n.role === '3')!;
    assert.ok(Math.abs(f.ball.x - back.x) < 0.01);
  });
});

describe('running a play: collision markers, QB vision cone, and auto-pause checkpoints', () => {
  it('emits block and tackle collision markers when blockers and tacklers engage, and slows the carrier unless he cuts away', () => {
    const nodes: PlayNode[] = [
      { role: 'C', x: 0, y: 0 },
      { role: 'RG', x: 1.5, y: 0 },
      { role: '1', x: 0, y: -1.5 },
      { role: '3', x: 0, y: -4.5 },
      { role: 'T1', x: 1.5, y: 1.0 },
      { role: 'MIKE', x: 1.5, y: 3.5 },
      { role: 'DE', x: 4.5, y: 1.0 },
    ];
    const straightRun: PlayStroke[] = [
      {
        kind: 'run',
        points: [
          { x: 0, y: -4.5 },
          { x: 1.5, y: 0 },
          { x: 1.5, y: 8 },
        ],
      },
    ];
    // At mid/late play, MIKE or T1 meets the runner in the hole -> tackle collision & tackleProgress
    const fEnd = computeAnimatedPlayFrame(nodes, straightRun, [], '3', 0.9);
    assert.ok(fEnd.tackleProgress !== undefined, 'tackleProgress should be recorded when a defender closes on the runner');
    assert.ok(fEnd.fitProgress !== undefined, 'fitProgress should be defined when defense is on the field');
    assert.ok(fEnd.readProgress !== undefined, 'readProgress should be defined');
    assert.ok(
      fEnd.collisions?.some((c) => c.kind === 'tackle' && c.label.includes('Tackle')),
      'should emit a 🛑 Tackle collision marker when defender engages the runner',
    );
  });

  it('shows a QB Read / Progression Vision Cone scanning 1st-to-2nd receiver on pass plays and conflict edge defender on run/option plays', () => {
    const passNodes: PlayNode[] = [
      { role: 'C', x: 0, y: 0 },
      { role: '1', x: 0, y: -2 },
      { role: 'X1', x: -10, y: 0 },
      { role: 'Z1', x: 10, y: 0 },
    ];
    const passStrokes: PlayStroke[] = [
      {
        kind: 'pass',
        points: [
          { x: -10, y: 0 },
          { x: -10, y: 6 },
        ],
      },
      {
        kind: 'pass',
        points: [
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
      },
    ];
    // Early in drop: 1st Read (X1)
    const fEarly = computeAnimatedPlayFrame(passNodes, passStrokes, [], 'Z1', 0.25);
    assert.ok(fEarly.visionCone, 'visionCone should be active early in the pass drop');
    assert.equal(fEarly.visionCone?.targetRole, 'X1');
    assert.ok(fEarly.visionCone?.label.includes('1st Read'), `expected 1st Read label, got ${fEarly.visionCone?.label}`);

    // Later in drop before release: 2nd Read (Z1)
    const fLateDrop = computeAnimatedPlayFrame(passNodes, passStrokes, [], 'Z1', 0.42);
    assert.ok(fLateDrop.visionCone, 'visionCone should be active before pass release');
    assert.equal(fLateDrop.visionCone?.targetRole, 'Z1');
    assert.ok(fLateDrop.visionCone?.label.includes('2nd Read'), `expected 2nd Read label, got ${fLateDrop.visionCone?.label}`);

    // Option / Mesh run play with a conflict DE
    const optNodes: PlayNode[] = [
      { role: 'C', x: 0, y: 0 },
      { role: '1', x: 0, y: -1.5 },
      { role: '3', x: -1.5, y: -4 },
      { role: 'DE', x: 4.5, y: 1.0 },
    ];
    const optStrokes: PlayStroke[] = [
      {
        kind: 'run',
        points: [
          { x: -1.5, y: -4 },
          { x: 3, y: 6 },
        ],
      },
    ];
    const fOption = computeAnimatedPlayFrame(optNodes, optStrokes, [], '3', 0.28);
    assert.ok(fOption.visionCone, 'visionCone should point to conflict DE on option/mesh read');
    assert.equal(fOption.visionCone?.kind, 'option_read');
    assert.equal(fOption.visionCone?.targetRole, 'DE');
  });
});
