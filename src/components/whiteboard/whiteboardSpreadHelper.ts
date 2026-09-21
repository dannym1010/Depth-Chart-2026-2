import { WhiteboardToken, WhiteboardArrow, WhiteboardZoneBubble } from '../../types';

export type WhiteboardSpreadMode = 'standard' | 'spread' | 'wide';

export interface SpreadOptions {
  mode?: WhiteboardSpreadMode;
  factorX?: number;
  factorY?: number;
  minTokenDistance?: number;
}

/**
 * Nudges overlapping tokens apart so no two tokens ever collide or sit on top of each other.
 */
export function preventTokenCollisions(
  tokens: WhiteboardToken[],
  minDistance = 48
): WhiteboardToken[] {
  const result = tokens.map((t) => ({ ...t }));
  for (let iter = 0; iter < 7; iter++) {
    let hadCollision = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[j].x - result[i].x;
        const dy = result[j].y - result[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // If either has a sublabel or is stacked vertically, require at least 56px clearance
        const effectiveMinDist = result[i].subLabel || result[j].subLabel ? 56 : minDistance;
        if (dist < effectiveMinDist) {
          hadCollision = true;
          const overlap = (effectiveMinDist - (dist || 0.1)) / 2 + 1.5;
          const angle = dist < 0.1 ? ((i + j) * Math.PI) / 3 : Math.atan2(dy, dx);
          const pushX = Math.cos(angle) * overlap;
          const pushY = Math.sin(angle) * overlap;

          result[i].x = Math.max(35, Math.min(665, Math.round(result[i].x - pushX)));
          result[i].y = Math.max(30, Math.min(470, Math.round(result[i].y - pushY)));
          result[j].x = Math.max(35, Math.min(665, Math.round(result[j].x + pushX)));
          result[j].y = Math.max(30, Math.min(470, Math.round(result[j].y + pushY)));
        }
      }
    }
    if (!hadCollision) break;
  }
  return result;
}

/**
 * Spreads whiteboard diagram elements outward from the field center (350, 240)
 * to utilize the full width and depth of the whiteboard.
 */
export function spreadDiagramElements(
  baseTokens: WhiteboardToken[],
  baseArrows: WhiteboardArrow[],
  baseZones: WhiteboardZoneBubble[],
  options?: SpreadOptions | WhiteboardSpreadMode
): {
  tokens: WhiteboardToken[];
  arrows: WhiteboardArrow[];
  zones: WhiteboardZoneBubble[];
} {
  let mode: WhiteboardSpreadMode = 'spread';
  let customFactorX: number | undefined;
  let customFactorY: number | undefined;
  let minDistance = 48;

  if (typeof options === 'string') {
    mode = options;
  } else if (options) {
    mode = options.mode || 'spread';
    customFactorX = options.factorX;
    customFactorY = options.factorY;
    if (options.minTokenDistance !== undefined) {
      minDistance = options.minTokenDistance;
    }
  }

  let factorX = 1.0;
  let factorY = 1.0;

  if (mode === 'wide') {
    factorX = customFactorX ?? 1.35;
    factorY = customFactorY ?? 1.28;
  } else if (mode === 'spread') {
    factorX = customFactorX ?? 1.20;
    factorY = customFactorY ?? 1.18;
  } else {
    // standard
    factorX = customFactorX ?? 1.0;
    factorY = customFactorY ?? 1.0;
  }

  const originX = 350;
  const originY = 240;

  const clampX = (val: number) => Math.round(Math.max(35, Math.min(665, val)));
  const clampY = (val: number) => Math.round(Math.max(30, Math.min(470, val)));

  // If standard mode, we still run collision prevention to fix overlapping tokens
  const spreadTokensRaw = baseTokens.map((t) => ({
    ...t,
    x: factorX === 1.0 ? t.x : clampX(originX + (t.x - originX) * factorX),
    y: factorY === 1.0 ? t.y : clampY(originY + (t.y - originY) * factorY),
  }));

  const spreadTokens = preventTokenCollisions(spreadTokensRaw, minDistance);

  // Calculate nudges applied by collision resolution so arrows stay anchored to players
  const tokenDisplacements = spreadTokens.map((st, idx) => ({
    rawX: spreadTokensRaw[idx].x,
    rawY: spreadTokensRaw[idx].y,
    dx: st.x - spreadTokensRaw[idx].x,
    dy: st.y - spreadTokensRaw[idx].y,
  }));

  const spreadArrows = baseArrows.map((a) => {
    let startX = factorX === 1.0 ? a.startX : clampX(originX + (a.startX - originX) * factorX);
    let startY = factorY === 1.0 ? a.startY : clampY(originY + (a.startY - originY) * factorY);
    let endX = factorX === 1.0 ? a.endX : clampX(originX + (a.endX - originX) * factorX);
    let endY = factorY === 1.0 ? a.endY : clampY(originY + (a.endY - originY) * factorY);
    let controlX = a.controlX !== undefined ? (factorX === 1.0 ? a.controlX : clampX(originX + (a.controlX - originX) * factorX)) : undefined;
    let controlY = a.controlY !== undefined ? (factorY === 1.0 ? a.controlY : clampY(originY + (a.controlY - originY) * factorY)) : undefined;

    // Anchor arrow start to nearest nudged token if within 25px
    for (const disp of tokenDisplacements) {
      if (Math.hypot(disp.rawX - startX, disp.rawY - startY) < 25) {
        startX = clampX(startX + disp.dx);
        startY = clampY(startY + disp.dy);
        break;
      }
    }

    // Anchor arrow end to nearest nudged token if within 25px
    for (const disp of tokenDisplacements) {
      if (Math.hypot(disp.rawX - endX, disp.rawY - endY) < 25) {
        endX = clampX(endX + disp.dx);
        endY = clampY(endY + disp.dy);
        break;
      }
    }

    return {
      ...a,
      startX,
      startY,
      endX,
      endY,
      ...(controlX !== undefined && controlY !== undefined ? { controlX, controlY } : {}),
    };
  });

  const spreadZones = baseZones.map((z) => ({
    ...z,
    cx: factorX === 1.0 ? z.cx : clampX(originX + (z.cx - originX) * factorX),
    cy: factorY === 1.0 ? z.cy : clampY(originY + (z.cy - originY) * factorY),
    rx: factorX === 1.0 ? z.rx : Math.min(Math.round(z.rx * Math.sqrt(factorX)), 95),
    ry: factorY === 1.0 ? z.ry : Math.min(Math.round(z.ry * Math.sqrt(factorY)), 60),
  }));

  return { tokens: spreadTokens, arrows: spreadArrows, zones: spreadZones };
}
