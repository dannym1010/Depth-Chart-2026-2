// Where the play is in a clip, from how much the picture changes: before the snap the players stand set (little
// changes), at the snap everything moves and the camera starts to follow (a lot changes), and when the play is
// over it settles again. Used to aim the AI breakdown's pictures at the play itself, not at the walk-up or the
// huddle after it. Pure (no video here): give it the change between samples taken `fps` times a second.

export interface SnapGuess {
  /** Seconds into the clip. */
  snap: number;
  /** When the play looks over (motion settled again), if it does before the clip ends. */
  end?: number;
  /** A clear set-then-burst; false when the jump is small (the pictures then fall back to spread out). */
  sure: boolean;
}

/**
 * How much the players moved between two small grey pictures (w x h, one byte a pixel): the camera's own move is
 * taken out first (the whole-picture shift that matches best, up to `reach` pixels), then what still differs is
 * counted, in the middle of the picture (the field, not the sky or the people along the sideline).
 */
export function playerChange(a: ArrayLike<number>, b: ArrayLike<number>, w: number, h: number, reach = 6): number {
  return frameChange(a, b, w, h, reach).players;
}

/** Between two small grey pictures: how far the camera moved (pixels) and how much the players moved. */
export function frameChange(a: ArrayLike<number>, b: ArrayLike<number>, w: number, h: number, reach = 6): { camera: number; players: number } {
  const x0 = Math.round(w * 0.05) + reach, x1 = Math.round(w * 0.95) - reach;
  const y0 = Math.round(h * 0.2) + reach, y1 = Math.round(h * 0.95) - reach;
  if (x1 <= x0 || y1 <= y0) return { camera: 0, players: 0 };
  const diff = (dx: number, dy: number, step: number) => {
    let d = 0, c = 0;
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { d += Math.abs(a[y * w + x] - b[(y + dy) * w + x + dx]); c++; }
    return d / c;
  };
  // The camera's shift: the best match on a coarse grid of pixels, then counted on all of them.
  let best = Infinity, bx = 0, by = 0;
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      const d = diff(dx, dy, 2);
      if (d < best) { best = d; bx = dx; by = dy; }
    }
  return { camera: Math.hypot(bx, by), players: diff(bx, by, 1) };
}

/**
 * The snap from both signals: the camera holds on the set formation and starts to follow the play a moment after
 * the snap, so the snap is in the 2.5 s before the camera's big follow; there, the players' biggest burst marks
 * it. The big follow: the camera move with the most travel in the 3 s after it starts.
 * samples[i] = the change from sample i - 1 to i (the first is 0s).
 */
export function findSnapWithCamera(samples: { camera: number; players: number }[], fps: number): SnapGuess | null {
  const n = samples.length;
  if (n < fps * 3) return null;
  const cam = samples.map((s) => s.camera), pl = samples.map((s) => s.players);
  const W3 = Math.round(3 * fps);
  // Moving camera: a sample with a shift of a pixel or more (at 96 wide, ~20 full-size pixels).
  let follow = -1, travel = 0;
  for (let i = Math.round(fps); i < n - 1; i++) {
    if (cam[i] < 1 || cam[i + 1] < 1) continue;
    if (i > 0 && cam[i - 1] >= 1) continue; // the start of a move
    const t = cam.slice(i, Math.min(n, i + W3)).reduce((s, v) => s + v, 0);
    if (t > travel) { travel = t; follow = i; }
  }
  // A camera that hardly moves (a wide shot): nothing to go by but the players.
  if (follow < 0 || travel < 4) return findSnap(pl, fps);
  // The players' biggest burst in the 2.5 s before the follow (and just after it starts).
  const lo = Math.max(Math.round(fps), follow - Math.round(2.5 * fps)), hi = Math.min(n - 2, follow + 1);
  const W = Math.max(2, Math.round(fps * 0.7));
  let bestI = -1, bestRise = 0, bestStill = 0;
  for (let i = lo; i <= hi; i++) {
    const still = mean(pl.slice(Math.max(0, i - Math.round(fps)), i));
    const go = mean(pl.slice(i, i + W));
    const rise = (go - still) / (still + 0.5);
    if (rise > bestRise) { bestRise = rise; bestI = i; bestStill = still; }
  }
  const snapI = bestI >= 0 && bestRise >= 0.25 ? bestI : Math.max(0, follow - Math.round(0.8 * fps));
  const snap = Math.max(0, (snapI - 0.5) / fps);
  // Over: the camera settles (still for a second) after following.
  let end: number | undefined;
  for (let j = follow + Math.round(2 * fps); j + Math.round(fps) <= n; j++) {
    if (cam.slice(j, j + Math.round(fps)).every((v) => v < 1)) { end = j / fps; break; }
  }
  return { snap, ...(end !== undefined ? { end } : {}), sure: travel >= 4 && (bestRise >= 0.25 || bestStill >= 0) };
}

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const median3 = (a: number[], i: number) => {
  const w = [a[Math.max(0, i - 1)], a[i], a[Math.min(a.length - 1, i + 1)]].sort((x, y) => x - y);
  return w[1];
};

/**
 * The snap: the sample where the picture goes from still (the second before) to busy (the second after, and it
 * stays busy for two), with the biggest jump for how still it was. Then back to where the rise starts.
 * change[i] = how different sample i is from sample i - 1 (0 for the first).
 */
export function findSnap(change: number[], fps: number): SnapGuess | null {
  const n = change.length;
  const W = Math.max(2, Math.round(fps));
  if (n < W * 3) return null;
  const s = change.map((_, i) => median3(change, i));
  let best: { i: number; score: number; still: number; go: number } | null = null;
  for (let i = W; i + W <= n; i++) {
    const still = mean(s.slice(i - W, i));
    const go = mean(s.slice(i, i + W));
    const go2 = mean(s.slice(i, Math.min(n, i + 2 * W)));
    const busy = Math.min(go, go2);
    if (busy < still * 2 + 0.8) continue;
    const score = (busy - still) / (still + 0.8);
    if (!best || score > best.score) best = { i, score, still, go };
  }
  if (!best) return null;
  // Back to where the rise starts (a sample or two before the busy second).
  let k = best.i;
  const rise = best.still + 0.25 * (best.go - best.still);
  while (k > best.i - W && k > 1 && s[k - 1] > rise) k--;
  const snap = Math.max(0, (k - 0.5) / fps);
  // Over: two seconds on, the first second that's back near the still level.
  let end: number | undefined;
  const settle = best.still + 0.35 * (best.go - best.still);
  for (let j = k + Math.round(2.5 * fps); j + W <= n; j++) {
    if (mean(s.slice(j, j + W)) < settle) {
      end = j / fps;
      break;
    }
  }
  return { snap, ...(end !== undefined ? { end } : {}), sure: best.score >= 1.2 };
}

/**
 * Pictures spread evenly over the whole clip, about one a second (at most `max`): wherever the play is in the
 * clip, it gets several of them, and the AI is told they run in order so it finds the snap itself.
 */
export function evenTimes(duration: number, max = 16): { t: number; label: string }[] {
  const d = Math.max(0.5, duration);
  const count = Math.max(4, Math.min(max, Math.round(d)));
  const step = (d - 0.4) / count;
  return Array.from({ length: count }, (_, i) => {
    const t = +(0.2 + step * (i + 0.5)).toFixed(2);
    return { t, label: `${t.toFixed(1)} s` };
  });
}

/**
 * When to take the AI's pictures: one just before the snap, then through the play (closer together early, when
 * the ball changes hands), the last near where it ended. Without a snap: spread over the clip as before.
 */
export function pictureTimes(guess: SnapGuess | null, duration: number, count = 8): { t: number; label: string }[] {
  const clamp = (t: number) => Math.min(Math.max(0.1, duration - 0.1), Math.max(0.1, t));
  if (!guess || !guess.sure || count < 8) {
    const spread = [
      [0.08, 'Pre-Snap Alignment'], [0.22, 'Snap & Mesh'], [0.36, 'Handoff / Pass Release'], [0.5, 'Point of Attack'],
      [0.62, 'Ball Carrier in Space'], [0.74, 'Contact'], [0.85, 'Tackle'], [0.95, 'Whistle / Ball Spot'],
    ] as const;
    return spread.slice(0, count).map(([f, label]) => ({ t: clamp(duration * f), label }));
  }
  const s = guess.snap;
  // The play is usually over 4-7 s after the snap; the settle point when it was found, else 6 s.
  const over = Math.min(duration - 0.2, guess.end && guess.end > s + 2.5 ? guess.end : s + 6);
  const span = Math.max(2.5, over - s);
  return [
    { t: clamp(s - 0.5), label: 'Pre-Snap Alignment' },
    { t: clamp(s + 0.35), label: 'Snap & Mesh' },
    { t: clamp(s + 0.9), label: 'Handoff / Pass Release' },
    { t: clamp(s + span * 0.3), label: 'Point of Attack' },
    { t: clamp(s + span * 0.5), label: 'Ball Carrier in Space' },
    { t: clamp(s + span * 0.7), label: 'Contact' },
    { t: clamp(s + span * 0.88), label: 'Tackle' },
    { t: clamp(s + span), label: 'Whistle / Ball Spot' },
  ];
}
