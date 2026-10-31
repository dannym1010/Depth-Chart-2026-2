// Seeing the play from any angle: a camera that circles the play (behind the offense, behind our defense, the
// sideline, straight down), the film camera itself worked out from the field's lineup on the picture, and drawing
// that keeps only what's in front of the camera. Field points are yards (x across, y downfield from the line of
// scrimmage, z up); picture points are pixels.
import type { Pt, Px } from './linesArt';

/**
 * A camera looking at a spot on the field: how far round it is (0 behind the offense, 90 off their right, 180
 * behind our defense), how high (0 on the grass, 90 straight down), how far away (yards) and how wide its view
 * (degrees, top to bottom).
 */
export interface Cam {
  yaw: number;
  pitch: number;
  dist: number;
  target: Pt;
  fov: number;
}

/** Drawing through a camera: a field point (and how high above the grass) on the picture, or null behind it. */
export interface Projector {
  to: (p: Pt, z?: number) => Px | null;
  /** How far in front of the camera a field point is; in view when at least `near`. */
  depth: (p: Pt) => number;
  near: number;
}

const RAD = Math.PI / 180;
export const MIN_PITCH = 8;
export const MAX_PITCH = 89;

export function cameraProjector(cam: Cam, w: number, h: number): Projector {
  const yaw = cam.yaw * RAD;
  const pitch = Math.max(3, Math.min(MAX_PITCH, cam.pitch)) * RAD;
  const hx = Math.sin(yaw);
  const hy = -Math.cos(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const C = { x: cam.target.x + cam.dist * cp * hx, y: cam.target.y + cam.dist * cp * hy, z: cam.dist * sp };
  // Looking at the target; the picture's right is level with the grass, its up the rest of the way.
  const F = { x: -cp * hx, y: -cp * hy, z: -sp };
  const rl = Math.hypot(F.y, F.x) || 1;
  const R = { x: F.y / rl, y: -F.x / rl, z: 0 };
  const U = { x: R.y * F.z - R.z * F.y, y: R.z * F.x - R.x * F.z, z: R.x * F.y - R.y * F.x };
  const f = h / 2 / Math.tan((cam.fov * RAD) / 2);
  const near = 0.5;
  return {
    near,
    depth: (p) => (p.x - C.x) * F.x + (p.y - C.y) * F.y + (0 - C.z) * F.z,
    to: (p, z = 0) => {
      const vx = p.x - C.x;
      const vy = p.y - C.y;
      const vz = z - C.z;
      const d = vx * F.x + vy * F.y + vz * F.z;
      if (d < near * 0.999) return null;
      return [w / 2 + (f * (vx * R.x + vy * R.y + vz * R.z)) / d, h / 2 - (f * (vx * U.x + vy * U.y + vz * U.z)) / d];
    },
  };
}

/**
 * Drawing through the film's own camera: the field's lineup (field -> 0..1 of the picture). Things on the grass only;
 * a height is shown about as tall as the grass is deep there. Out past the far end of the picture (where the field
 * runs off toward the horizon) counts as behind the camera.
 */
export function filmProjector(H: number[], w: number, h: number): Projector {
  const wOf = (p: Pt) => H[6] * p.x + H[7] * p.y + H[8];
  const at = wOf({ x: 0, y: 0 });
  const sign = at >= 0 ? 1 : -1;
  const near = 0.04 * (Math.abs(at) || 1);
  const depth = (p: Pt) => sign * wOf(p);
  const flat = (p: Pt): Px => {
    const d = wOf(p);
    return [((H[0] * p.x + H[1] * p.y + H[2]) / d) * w, ((H[3] * p.x + H[4] * p.y + H[5]) / d) * h];
  };
  return {
    near,
    depth,
    to: (p, z = 0) => {
      if (depth(p) < near * 0.999) return null;
      const s = flat(p);
      if (!z) return s;
      const a = flat({ x: p.x, y: p.y - 0.5 });
      const b = flat({ x: p.x, y: p.y + 0.5 });
      return [s[0], s[1] - z * Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.6];
    },
  };
}

/** The parts of a line in front of the camera (cut where it crosses into view). */
export function visibleRuns(pts: Pt[], depth: (p: Pt) => number, near: number): Pt[][] {
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const dp = depth(p);
    if (i > 0) {
      const q = pts[i - 1];
      const dq = depth(q);
      if (dq >= near !== dp >= near) {
        const t = (near - dq) / (dp - dq);
        const m = { x: q.x + (p.x - q.x) * t, y: q.y + (p.y - q.y) * t };
        if (dq >= near) {
          cur.push(m);
          runs.push(cur);
          cur = [];
        } else cur = [m];
      }
    }
    if (dp >= near) cur.push(p);
  }
  runs.push(cur);
  return runs.filter((r) => r.length >= 2);
}

/** The part of a shape on the grass in front of the camera. */
export function clipPolygon(pts: Pt[], depth: (p: Pt) => number, near: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const da = depth(a);
    const db = depth(b);
    if (da >= near) out.push(a);
    if (da >= near !== db >= near) {
      const t = (near - da) / (db - da);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The film camera worked out from the field's lineup (a picture `w` x `h`, square pixels, centered): where it stands,
 * which way it looks and how wide, as a camera that can be turned from there. Null when the lineup doesn't fit a
 * real camera above the field (a lineup that's only roughly in place).
 */
export function cameraFromFilm(H: number[], w: number, h: number): Cam | null {
  const cx = w / 2;
  const cy = h / 2;
  // The lineup in pixels, its columns shifted to the picture's middle.
  const col = (i: number) => [H[i] * w - cx * H[6 + i], H[3 + i] * h - cy * H[6 + i], H[6 + i]];
  const [a1, b1, c1] = col(0);
  const [a2, b2, c2] = col(1);
  const [a3, b3, c3] = col(2);
  // Across and downfield are square to each other and the same length: that sets the focal length.
  const f2s: number[] = [];
  if (Math.abs(c1 * c2) > 1e-12) {
    const f2 = -(a1 * a2 + b1 * b2) / (c1 * c2);
    if (f2 > 0) f2s.push(f2);
  }
  const den = c2 * c2 - c1 * c1;
  if (Math.abs(den) > 1e-12) {
    const f2 = (a1 * a1 + b1 * b1 - a2 * a2 - b2 * b2) / den;
    if (f2 > 0) f2s.push(f2);
  }
  if (!f2s.length) return null;
  const f = Math.sqrt(f2s.reduce((s, v) => s + v, 0) / f2s.length);
  const fov = (2 * Math.atan(h / 2 / f)) / RAD;
  if (!(fov > 4 && fov < 120)) return null;
  const m1 = [a1 / f, b1 / f, c1];
  const m2 = [a2 / f, b2 / f, c2];
  const m3 = [a3 / f, b3 / f, c3];
  let lam = 2 / (Math.hypot(m1[0], m1[1], m1[2]) + Math.hypot(m2[0], m2[1], m2[2]));
  // The field in front of the camera.
  if (m3[2] * lam < 0) lam = -lam;
  const r1 = m1.map((v) => v * lam);
  const r2 = m2.map((v) => v * lam);
  const t = m3.map((v) => v * lam);
  const r3 = cross(r1, r2);
  // Where the camera stands (field yards), and the way it looks (the picture's depth axis, on the field).
  const C = { x: -dot(r1, t), y: -dot(r2, t), z: -dot(r3, t) };
  if (!(C.z > 0.5)) return null;
  const look = { x: r1[2], y: r2[2], z: r3[2] };
  if (!(look.z < -0.02)) return null;
  const s = -C.z / look.z;
  const target = { x: C.x + look.x * s, y: C.y + look.y * s };
  const dist = Math.hypot(C.x - target.x, C.y - target.y, C.z);
  if (!(dist > 2 && dist < 400)) return null;
  const pitch = Math.asin(Math.min(1, C.z / dist)) / RAD;
  const hd = Math.hypot(C.x - target.x, C.y - target.y) || 1;
  const yaw = Math.atan2((C.x - target.x) / hd, -(C.y - target.y) / hd) / RAD;
  return { yaw, pitch, dist, target, fov };
}

/** The camera a fraction of the way from one to another (turning the short way round). */
export function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const k = Math.max(0, Math.min(1, t));
  const turn = ((((b.yaw - a.yaw) % 360) + 540) % 360) - 180;
  return {
    yaw: a.yaw + turn * k,
    pitch: a.pitch + (b.pitch - a.pitch) * k,
    dist: Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * k),
    target: { x: a.target.x + (b.target.x - a.target.x) * k, y: a.target.y + (b.target.y - a.target.y) * k },
    fov: a.fov + (b.fov - a.fov) * k,
  };
}

/** One-tap angles. */
export const VIEWS: { id: string; label: string; title: string; cam: Cam }[] = [
  { id: 'offense', label: 'O view', title: 'From behind the offense', cam: { yaw: 0, pitch: 24, dist: 30, target: { x: 0, y: 4 }, fov: 50 } },
  { id: 'defense', label: 'D view', title: 'From behind the defense', cam: { yaw: 180, pitch: 24, dist: 30, target: { x: 0, y: 0 }, fov: 50 } },
  { id: 'side', label: 'Side', title: 'From the sideline', cam: { yaw: 90, pitch: 28, dist: 38, target: { x: 0, y: 2 }, fov: 48 } },
  { id: 'top', label: 'Top', title: 'Straight down, like the diagram', cam: { yaw: 0, pitch: 89, dist: 44, target: { x: 0, y: 3 }, fov: 48 } },
];
