/**
 * 2D Projective Homography Engine (3x3 Matrix H & H^-1)
 * Maps between normalized video frame coordinates (u, v) in [0, 1]^2
 * and top-down Play Builder field coordinates (x, y) in yards:
 *   - Center ball spot = (0, 0)
 *   - Line of Scrimmage (LOS) = y = 0 (OL spans x = -4 to +4, sidelines x = -17 to +17)
 *   - Offensive backfield = y < 0 (e.g. y = -1 to -7)
 *   - Defensive side / downfield = y > 0 (e.g. y = +1 to +12)
 */

export interface FieldPoint {
  x: number;
  y: number;
}

export interface ImagePoint {
  u: number;
  v: number;
}

/**
 * 4-corner perspective calibration quad in normalized video coordinates [0..1].
 * Maps to the reference rectangle on the football field:
 *   - losLeft   -> (-halfWidth, 0)
 *   - losRight  -> (+halfWidth, 0)
 *   - backLeft  -> (-halfWidth, -backDepth)
 *   - backRight -> (+halfWidth, -backDepth)
 */
export interface HomographyQuad {
  losLeft: ImagePoint;
  losRight: ImagePoint;
  backLeft: ImagePoint;
  backRight: ImagePoint;
  /** Half-width of the calibration quad along the LOS in Play Builder X units (default 12) */
  halfWidth?: number;
  /** Depth of the backfield edge from the LOS in Play Builder Y units (default 5) */
  backDepth?: number;
  /** Optional preset label */
  preset?: 'pressbox_top_down' | 'sideline_l2r' | 'sideline_r2l' | 'endzone' | 'custom';
  /** Picked up from the film's lineup (the play before it), not set on this play: it keeps following the film. */
  fromFilm?: boolean;
}

export const HOMOGRAPHY_PRESETS: Record<
  NonNullable<HomographyQuad['preset']>,
  { label: string; description: string; quad: HomographyQuad }
> = {
  endzone: {
    label: 'End Zone / High Behind Offense',
    description: 'Offense moving away from camera (bottom to top)',
    quad: {
      losLeft: { u: 0.18, v: 0.48 },
      losRight: { u: 0.82, v: 0.48 },
      backLeft: { u: 0.08, v: 0.82 },
      backRight: { u: 0.92, v: 0.82 },
      halfWidth: 12,
      backDepth: 5,
      preset: 'endzone',
    },
  },
  sideline_l2r: {
    label: 'Sideline (Offense Left → Right)',
    description: 'Press box view, offense marching left to right',
    quad: {
      losLeft: { u: 0.56, v: 0.28 },
      losRight: { u: 0.44, v: 0.84 },
      backLeft: { u: 0.30, v: 0.26 },
      backRight: { u: 0.14, v: 0.82 },
      halfWidth: 12,
      backDepth: 5,
      preset: 'sideline_l2r',
    },
  },
  sideline_r2l: {
    label: 'Sideline (Offense Right → Left)',
    description: 'Press box view, offense marching right to left',
    quad: {
      losLeft: { u: 0.56, v: 0.84 },
      losRight: { u: 0.44, v: 0.28 },
      backLeft: { u: 0.86, v: 0.82 },
      backRight: { u: 0.70, v: 0.26 },
      halfWidth: 12,
      backDepth: 5,
      preset: 'sideline_r2l',
    },
  },
  pressbox_top_down: {
    label: 'Wide All-22 / Angled Top',
    description: 'High angle with LOS near middle of frame',
    quad: {
      losLeft: { u: 0.15, v: 0.44 },
      losRight: { u: 0.85, v: 0.44 },
      backLeft: { u: 0.08, v: 0.78 },
      backRight: { u: 0.92, v: 0.78 },
      halfWidth: 14,
      backDepth: 5,
      preset: 'pressbox_top_down',
    },
  },
  custom: {
    label: 'Custom Calibration',
    description: 'Manually dragged or AI-detected 4-point perspective quad',
    quad: {
      losLeft: { u: 0.18, v: 0.48 },
      losRight: { u: 0.82, v: 0.48 },
      backLeft: { u: 0.08, v: 0.82 },
      backRight: { u: 0.92, v: 0.82 },
      halfWidth: 12,
      backDepth: 5,
      preset: 'custom',
    },
  },
};

export const DEFAULT_HOMOGRAPHY_QUAD: HomographyQuad = HOMOGRAPHY_PRESETS.sideline_l2r.quad;

/**
 * Swap the Offense and Defense sides across the Line of Scrimmage in camera space.
 * If the quad is on a sideline preset (l2r <-> r2l), switches presets while preserving any LOS shift;
 * otherwise reflects the backfield corners across the LOS segment and swaps losLeft <-> losRight.
 */
export function flipHomographyOffenseDefense(quad: HomographyQuad): HomographyQuad {
  if (quad.preset === 'sideline_l2r') {
    return { ...HOMOGRAPHY_PRESETS.sideline_r2l.quad };
  }
  if (quad.preset === 'sideline_r2l') {
    return { ...HOMOGRAPHY_PRESETS.sideline_l2r.quad };
  }
  const clamp = (v: number) => Math.max(0.03, Math.min(0.97, Math.round(v * 1000) / 1000));
  return {
    ...quad,
    losLeft: { ...quad.losRight },
    losRight: { ...quad.losLeft },
    backLeft: {
      u: clamp(2 * quad.losRight.u - quad.backRight.u),
      v: clamp(2 * quad.losRight.v - quad.backRight.v),
    },
    backRight: {
      u: clamp(2 * quad.losLeft.u - quad.backLeft.u),
      v: clamp(2 * quad.losLeft.v - quad.backLeft.v),
    },
    preset: 'custom',
  };
}

/**
 * Construct a calibrated HomographyQuad from which side of the video frame the Offense is lined up on
 * ('left' -> marching left-to-right, 'right' -> marching right-to-left, 'bottom' -> endzone behind offense)
 * and the optional horizontal position of the Line of Scrimmage (losCenterU in 0.25..0.75).
 */
export function buildQuadFromScreenSide(
  offenseScreenSide: 'left' | 'right' | 'bottom' | 'top',
  losCenterU = 0.5,
): HomographyQuad {
  const clamp = (v: number) => Math.max(0.04, Math.min(0.96, Math.round(v * 1000) / 1000));
  const shift = Number.isFinite(losCenterU) ? Math.max(-0.22, Math.min(0.22, losCenterU - 0.5)) : 0;

  if (offenseScreenSide === 'right') {
    const base = HOMOGRAPHY_PRESETS.sideline_r2l.quad;
    return {
      ...base,
      losLeft: { u: clamp(base.losLeft.u + shift), v: base.losLeft.v },
      losRight: { u: clamp(base.losRight.u + shift), v: base.losRight.v },
      backLeft: { u: clamp(base.backLeft.u + shift), v: base.backLeft.v },
      backRight: { u: clamp(base.backRight.u + shift), v: base.backRight.v },
      preset: 'sideline_r2l',
    };
  }
  if (offenseScreenSide === 'left') {
    const base = HOMOGRAPHY_PRESETS.sideline_l2r.quad;
    return {
      ...base,
      losLeft: { u: clamp(base.losLeft.u + shift), v: base.losLeft.v },
      losRight: { u: clamp(base.losRight.u + shift), v: base.losRight.v },
      backLeft: { u: clamp(base.backLeft.u + shift), v: base.backLeft.v },
      backRight: { u: clamp(base.backRight.u + shift), v: base.backRight.v },
      preset: 'sideline_l2r',
    };
  }
  if (offenseScreenSide === 'top') {
    return flipHomographyOffenseDefense(HOMOGRAPHY_PRESETS.endzone.quad);
  }
  return { ...HOMOGRAPHY_PRESETS.endzone.quad };
}

/**
 * Solve an 8x8 linear system A * h = b via Gaussian elimination with partial pivoting,
 * returning the 3x3 row-major homography matrix H = [h0, h1, h2, h3, h4, h5, h6, h7, 1]
 * that maps src[i] -> dst[i] for i = 0..3.
 */
export function solveHomographyMatrix(
  src: [FieldPoint, FieldPoint, FieldPoint, FieldPoint],
  dst: [FieldPoint, FieldPoint, FieldPoint, FieldPoint],
): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }
    if (maxVal < 1e-10) {
      // Degenerate quad fallback to identity
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }
    if (maxRow !== col) {
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
      [b[col], b[maxRow]] = [b[maxRow], b[col]];
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < n; k++) {
        A[row][k] -= factor * A[col][k];
      }
      b[row] -= factor * b[col];
    }
  }

  // Back substitution
  const h = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let col = row + 1; col < n; col++) {
      sum -= A[row][col] * h[col];
    }
    h[row] = sum / A[row][row];
  }

  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * Apply a 3x3 homography matrix H to a 2D point (x, y).
 */
export function applyHomography(H: number[], x: number, y: number): FieldPoint {
  const denom = H[6] * x + H[7] * y + H[8];
  const safeDenom = Math.abs(denom) < 1e-7 ? (denom >= 0 ? 1e-7 : -1e-7) : denom;
  return {
    x: (H[0] * x + H[1] * y + H[2]) / safeDenom,
    y: (H[3] * x + H[4] * y + H[5]) / safeDenom,
  };
}

/**
 * Build both forward (image -> field) and inverse (field -> image) 3x3 homography matrices
 * for a given HomographyQuad.
 */
export function getQuadHomographies(quad: HomographyQuad): {
  imageToFieldH: number[];
  fieldToImageH: number[];
} {
  const W = quad.halfWidth ?? 12;
  const D = quad.backDepth ?? 5;

  const imgCorners: [FieldPoint, FieldPoint, FieldPoint, FieldPoint] = [
    { x: quad.losLeft.u, y: quad.losLeft.v },
    { x: quad.losRight.u, y: quad.losRight.v },
    { x: quad.backLeft.u, y: quad.backLeft.v },
    { x: quad.backRight.u, y: quad.backRight.v },
  ];

  const fieldCorners: [FieldPoint, FieldPoint, FieldPoint, FieldPoint] = [
    { x: -W, y: 0 },
    { x: W, y: 0 },
    { x: -W, y: -D },
    { x: W, y: -D },
  ];

  return {
    imageToFieldH: solveHomographyMatrix(imgCorners, fieldCorners),
    fieldToImageH: solveHomographyMatrix(fieldCorners, imgCorners),
  };
}

/**
 * Project a normalized video coordinate (u, v) in [0, 1]^2 into Play Builder field coordinates (x, y).
 */
export function imageToField(quad: HomographyQuad, pt: ImagePoint): FieldPoint {
  const { imageToFieldH } = getQuadHomographies(quad);
  const res = applyHomography(imageToFieldH, pt.u, pt.v);
  return {
    x: Math.max(-16.5, Math.min(16.5, Math.round(res.x * 2) / 2)),
    y: Math.max(-7, Math.min(10, Math.round(res.y * 2) / 2)),
  };
}

/**
 * Project a Play Builder field coordinate (x, y) onto normalized video coordinates (u, v).
 */
export function fieldToImage(quad: HomographyQuad, pt: FieldPoint): ImagePoint {
  const { fieldToImageH } = getQuadHomographies(quad);
  const res = applyHomography(fieldToImageH, pt.x, pt.y);
  return {
    u: res.x,
    v: res.y,
  };
}

export interface ProjectedGridLine {
  id: string;
  p1: ImagePoint;
  p2: ImagePoint;
  kind: 'los' | 'yard' | 'hash' | 'sideline' | 'center_axis';
  label?: string;
}

/**
 * Generate 3D-projected football field grid lines in normalized image space (u, v)
 * so the video overlay can render the warped Line of Scrimmage, yard lines, and hashes.
 */
export function buildProjectedFieldGrid(quad: HomographyQuad): ProjectedGridLine[] {
  const { fieldToImageH } = getQuadHomographies(quad);
  const proj = (x: number, y: number): ImagePoint => {
    const p = applyHomography(fieldToImageH, x, y);
    return { u: p.x, v: p.y };
  };

  const W = (quad.halfWidth ?? 12) + 3;
  const lines: ProjectedGridLine[] = [];

  // Yard lines from y = -6 (backfield) to y = +7 (defense / secondary)
  for (let y = -6; y <= 7; y += 1) {
    if (y === 0) {
      lines.push({
        id: 'los',
        p1: proj(-W, 0),
        p2: proj(W, 0),
        kind: 'los',
        label: 'LOS',
      });
    } else if (y % 2 === 0 || y === -5 || y === 5) {
      lines.push({
        id: `yard_${y}`,
        p1: proj(-W, y),
        p2: proj(W, y),
        kind: 'yard',
        label: y > 0 ? `+${y}yd` : `${y}yd`,
      });
    }
  }

  // Left & Right Hash lines (at x = -5 and x = +5) and Center ball axis (x = 0)
  lines.push({
    id: 'center_axis',
    p1: proj(0, -6),
    p2: proj(0, 7),
    kind: 'center_axis',
  });
  lines.push({
    id: 'hash_left',
    p1: proj(-5, -6),
    p2: proj(-5, 7),
    kind: 'hash',
  });
  lines.push({
    id: 'hash_right',
    p1: proj(5, -6),
    p2: proj(5, 7),
    kind: 'hash',
  });

  // Calibration quad boundary sidelines
  const qW = quad.halfWidth ?? 12;
  lines.push({
    id: 'quad_left',
    p1: proj(-qW, -6),
    p2: proj(-qW, 7),
    kind: 'sideline',
  });
  lines.push({
    id: 'quad_right',
    p1: proj(qW, -6),
    p2: proj(qW, 7),
    kind: 'sideline',
  });

  return lines;
}

