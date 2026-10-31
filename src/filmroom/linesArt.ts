// Play lines on film, drawn the way TV draws on the field: laid on the turf in its perspective (wider near the
// camera, thinner far away), arrowheads lying flat on the field, rings at the players' feet. Field points are yards
// (x across, y downfield from the line of scrimmage); screen points are pixels on the picture.

export type Pt = { x: number; y: number };
export type Px = readonly [number, number];

/** A line's length (yards). */
export function lengthOf(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** The first `len` yards of a line (the last piece cut to fit). */
export function cutLine(pts: Pt[], len: number): Pt[] {
  if (!pts.length) return [];
  const out: Pt[] = [pts[0]];
  let left = len;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d >= left) {
      const t = d ? left / d : 0;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return out;
    }
    out.push(b);
    left -= d;
  }
  return out;
}

/** The same line with a point at least every `step` yards, so a long straight leg gets the perspective's widths. */
export function densify(pts: Pt[], step: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** Where the line heads at its end: the point `back` yards before the end (steadier than the last tiny step of a curve). */
export function pointBack(pts: Pt[], back: number): Pt {
  let left = back;
  for (let i = pts.length - 1; i > 0; i--) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d >= left) {
      const t = d ? left / d : 0;
      return { x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t };
    }
    left -= d;
  }
  return pts[0];
}

/** Dashes along a line: `dash` yards long, `gap` yards apart. */
export function dashLine(pts: Pt[], dash: number, gap: number): Pt[][] {
  const out: Pt[][] = [];
  if (pts.length < 2) return out;
  let on = true; // in a dash (or a gap)
  let left = dash; // yards left in it
  let cur: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let d = Math.hypot(b.x - a.x, b.y - a.y);
    while (d > left) {
      const t = left / d;
      const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (on) {
        cur.push(m);
        if (cur.length >= 2) out.push(cur);
      } else cur = [m];
      on = !on;
      d -= left;
      a = m;
      left = on ? dash : gap;
    }
    left -= d;
    if (on) cur.push(b);
  }
  if (on && cur.length >= 2) out.push(cur);
  return out;
}

/** Pre-snap motion: a zigzag along the line, `amp` yards to each side every `wave` yards. */
export function zigzagLine(pts: Pt[], amp: number, wave: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let side = 1;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.round(len / (wave / 2)));
    const ux = (b.x - a.x) / (len || 1);
    const uy = (b.y - a.y) / (len || 1);
    for (let k = 1; k < n; k++) {
      const t = (len * k) / n;
      out.push({ x: a.x + ux * t - uy * amp * side, y: a.y + uy * t + ux * amp * side });
      side = -side;
    }
    out.push(b);
  }
  return out;
}

/** A circle on the field (it shows as an ellipse in the film's perspective). */
export function circleOnField(c: Pt, r: number, steps = 28): Pt[] {
  return Array.from({ length: steps }, (_, i) => ({ x: c.x + r * Math.cos((i / steps) * 2 * Math.PI), y: c.y + r * Math.sin((i / steps) * 2 * Math.PI) }));
}

/** An arrowhead lying on the field at the end of a line coming from `from`: `len` yards long, `half` yards to each side. */
export function arrowOnField(end: Pt, from: Pt, len: number, half: number): Pt[] {
  const l = Math.hypot(end.x - from.x, end.y - from.y) || 1;
  const ux = (end.x - from.x) / l;
  const uy = (end.y - from.y) / l;
  const base = { x: end.x - ux * len, y: end.y - uy * len };
  // The tip a little past the end (the line's end sits inside it), a notch in the back.
  return [
    { x: end.x + ux * len * 0.2, y: end.y + uy * len * 0.2 },
    { x: base.x - uy * half, y: base.y + ux * half },
    { x: base.x + ux * len * 0.3, y: base.y + uy * len * 0.3 },
    { x: base.x + uy * half, y: base.y - ux * half },
  ];
}

/** A block's T at the end of a line coming from `from`, `half` yards to each side. */
export function tOnField(end: Pt, from: Pt, half: number): [Pt, Pt] {
  const l = Math.hypot(end.x - from.x, end.y - from.y) || 1;
  const ux = (end.x - from.x) / l;
  const uy = (end.y - from.y) / l;
  return [
    { x: end.x - uy * half, y: end.y + ux * half },
    { x: end.x + uy * half, y: end.y - ux * half },
  ];
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
export const polygon = (pts: Px[]) => (pts.length ? `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z` : '');
export const polyline = (pts: Px[]) => (pts.length ? `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}` : '');

/**
 * The outline of a ribbon along screen points, each with its own half width: kept as wide around a sharp break (a
 * route's cut), round at the start, round or square at the end.
 */
export function ribbon(raw: Px[], rawHalf: number[], roundEnd = false): string {
  const pts: Px[] = [];
  const half: number[] = [];
  raw.forEach((p, i) => {
    const last = pts[pts.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.05) return;
    pts.push(p);
    half.push(Math.max(0, rawHalf[i] ?? rawHalf[rawHalf.length - 1] ?? 0));
  });
  const n = pts.length;
  if (n < 2) return '';
  const dir = (a: Px, b: Px): [number, number] => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const dIn = i > 0 ? dir(pts[i - 1], pts[i]) : dir(pts[0], pts[1]);
    const dOut = i < n - 1 ? dir(pts[i], pts[i + 1]) : dIn;
    let tx = dIn[0] + dOut[0];
    let ty = dIn[1] + dOut[1];
    const tl = Math.hypot(tx, ty);
    if (tl < 1e-6) [tx, ty] = dOut;
    else {
      tx /= tl;
      ty /= tl;
    }
    // Half the turn's cosine: the side pushed out at a break so the width holds (capped for a hairpin).
    const cos = Math.max(0.45, tx * dOut[0] + ty * dOut[1]);
    const w = half[i] / cos;
    left.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
    right.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
  }
  // Half a circle around a point, bulging along `d`: from the side on the left of `d` (its normal (-dy, dx)) to the right.
  const cap = (c: Px, h: number, d: [number, number]) => {
    const out: [number, number][] = [];
    for (let k = 1; k < 8; k++) {
      const a = (k / 8) * Math.PI;
      out.push([c[0] + h * (Math.sin(a) * d[0] - Math.cos(a) * d[1]), c[1] + h * (Math.sin(a) * d[1] + Math.cos(a) * d[0])]);
    }
    return out;
  };
  const dEnd = dir(pts[n - 2], pts[n - 1]);
  const dStart = dir(pts[0], pts[1]);
  const outline: [number, number][] = [
    ...left,
    ...(roundEnd ? cap(pts[n - 1], half[n - 1], dEnd) : []),
    ...right.slice().reverse(),
    // Going back along the line, its left is the line's right: from the right side round to the left.
    ...cap(pts[0], half[0], [-dStart[0], -dStart[1]]),
  ];
  return polygon(outline);
}
