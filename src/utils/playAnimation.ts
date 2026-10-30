import { isDefenseRole, lineStartsOn, type PlayNode, type PlayStroke } from './footballEngine';

export interface AnimatedTrail {
  role: string;
  kind: 'run' | 'pass' | 'block' | 'motion';
  points: { x: number; y: number }[];
  color: string;
}

export interface AnimatedPlayFrame {
  progress: number;
  phase: 'pre_snap' | 'motion' | 'snap' | 'post_snap';
  phaseLabel: string;
  nodes: PlayNode[];
  trails: AnimatedTrail[];
  ball: { x: number; y: number; inAir: boolean };
}

/** The offensive line. */
const OL_ROLES = ['LT', 'LG', 'C', 'RG', 'RT'];
/** Yards a lineman who isn't pulling moves: a short step into his block. */
export const LINE_STEP = 0.75;

/** A lineman's line is a pull: it drops off the ball first, or runs 2.5 yards or more down the line. */
export function isPullLine(st: PlayStroke, start: { x: number; y: number }): boolean {
  const last = st.points[st.points.length - 1];
  return st.points.slice(1).some((p) => p.y < start.y - 0.4) || Math.abs(last.x - start.x) >= 2.5;
}

/**
 * Interpolates a position and partial path along a polyline by arc-length for t in [0, 1].
 */
export function samplePolyline(
  points: { x: number; y: number }[],
  t: number
): { x: number; y: number; traveled: { x: number; y: number }[] } {
  if (!points.length) return { x: 0, y: 0, traveled: [] };
  if (points.length === 1 || t <= 0) {
    return { x: points[0].x, y: points[0].y, traveled: [points[0]] };
  }
  const clamped = Math.max(0, Math.min(1, t));
  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLengths.push(len);
    totalLen += len;
  }
  if (totalLen < 1e-4) {
    const last = points[points.length - 1];
    return { x: last.x, y: last.y, traveled: [points[0], last] };
  }

  const targetDist = clamped * totalLen;
  const traveled: { x: number; y: number }[] = [points[0]];
  let accum = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accum + segLen >= targetDist - 1e-6) {
      const localT = segLen > 1e-5 ? (targetDist - accum) / segLen : 1;
      const x = points[i].x + (points[i + 1].x - points[i].x) * localT;
      const y = points[i].y + (points[i + 1].y - points[i].y) * localT;
      const tip = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      traveled.push(tip);
      return { x: tip.x, y: tip.y, traveled };
    }
    accum += segLen;
    traveled.push(points[i + 1]);
  }

  const end = points[points.length - 1];
  return { x: end.x, y: end.y, traveled };
}

function easeOutQuad(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) * (1 - c);
}

function easeInOutSine(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return -(Math.cos(Math.PI * c) - 1) / 2;
}

/**
 * Computes the animated positions of all offensive & defensive players, progressive trails,
 * and the football position at normalized progress in [0, 1].
 */
export function computeAnimatedPlayFrame(
  nodes: PlayNode[],
  strokes: PlayStroke[],
  extraStrokes: PlayStroke[] = [],
  ballRole = '3',
  progress = 0,
  targetHole?: number | null
): AnimatedPlayFrame {
  const p = Math.max(0, Math.min(1, progress));
  const allStrokes = [...strokes, ...extraStrokes].filter((s) => s.points && s.points.length >= 2);

  // Match each player role to its primary stroke (if any)
  const roleStroke = new Map<string, PlayStroke>();
  const usedStrokes = new Set<PlayStroke>();

  for (const st of allStrokes) {
    const owner = nodes.find((n) => !roleStroke.has(n.role) && lineStartsOn(st, n, nodes));
    if (owner) {
      roleStroke.set(owner.role, st);
      usedStrokes.add(st);
    }
  }

  // If the designated ball carrier doesn't have a matched stroke yet, check if there is an unclaimed 'run' stroke
  const carrierNode = nodes.find((n) => n.role === ballRole);
  if (carrierNode && !roleStroke.has(ballRole)) {
    const unclaimedRun = allStrokes.find((s) => !usedStrokes.has(s) && s.kind === 'run');
    if (unclaimedRun) {
      // Shift or connect from carrierNode to the unclaimed run stroke
      const firstPt = unclaimedRun.points[0];
      const dist = Math.hypot(firstPt.x - carrierNode.x, firstPt.y - carrierNode.y);
      const connectedPoints =
        dist > 0.6 ? [{ x: carrierNode.x, y: carrierNode.y }, ...unclaimedRun.points] : unclaimedRun.points;
      roleStroke.set(ballRole, { ...unclaimedRun, points: connectedPoints });
      usedStrokes.add(unclaimedRun);
    }
  }

  // Determine whether any player has pre-snap motion
  const hasPreSnapMotion = Array.from(roleStroke.values()).some((s) => (s.motion || 0) >= 1);
  const snapStart = hasPreSnapMotion ? 0.24 : 0;

  let motionT = 1;
  let postSnapT = 0;
  let phase: AnimatedPlayFrame['phase'] = 'pre_snap';
  let phaseLabel = 'Pre-Snap Alignment';

  if (p <= 0.005) {
    motionT = 0;
    postSnapT = 0;
    phase = 'pre_snap';
    phaseLabel = 'Pre-Snap Alignment';
  } else if (hasPreSnapMotion && p < snapStart) {
    motionT = easeInOutSine(p / snapStart);
    postSnapT = 0;
    phase = 'motion';
    phaseLabel = 'Pre-Snap Motion';
  } else {
    motionT = 1;
    postSnapT = easeInOutSine((p - snapStart) / Math.max(0.01, 1 - snapStart));
    phase = postSnapT < 0.18 ? 'snap' : 'post_snap';
    phaseLabel = postSnapT < 0.18 ? 'Snap & Mesh' : 'Play Execution';
  }

  // Determine overall play type (run vs pass) and target horizontal flow
  const hasPassRoutes = allStrokes.filter((s) => s.kind === 'pass' && !(s.motion && s.motion >= s.points.length - 1)).length >= 2;
  const isPassPlay = hasPassRoutes && !roleStroke.get(ballRole)?.kind?.includes('run');

  const holeXMap: Record<number, number> = {
    9: -9.5,
    7: -5.2,
    5: -1.6,
    3: 0.0,
    1: 9.5,
    8: -6.8,
    6: -3.2,
    4: 2.2,
    2: 5.2,
  };
  const fallbackAimX = targetHole && holeXMap[targetHole] !== undefined ? holeXMap[targetHole] : 2.5;

  // First pass: compute offensive trajectories so defenders can react to the ball carrier
  const trails: AnimatedTrail[] = [];
  const animatedPos = new Map<string, { x: number; y: number }>();

  // Calculate carrier path even if no stroke was drawn
  const getSyntheticCarrierPoints = (node: PlayNode): { x: number; y: number }[] => {
    if (isPassPlay && (node.role === '1' || node.role === 'QB')) {
      return [
        { x: node.x, y: node.y },
        { x: node.x, y: Math.min(-3.8, node.y - 2.2) },
      ];
    }
    const aimX = fallbackAimX;
    return [
      { x: node.x, y: node.y },
      { x: node.x * 0.4 + aimX * 0.6, y: -0.5 },
      { x: aimX, y: 1.5 },
      { x: aimX * 1.15, y: 6.5 },
    ];
  };

  for (const n of nodes) {
    if (isDefenseRole(n.role)) continue;
    const st = roleStroke.get(n.role);

    if (st && st.points.length >= 2) {
      const mIdx = st.motion && st.motion > 0 ? Math.min(st.motion, st.points.length - 1) : 0;
      if (mIdx > 0) {
        const motionPts = [{ x: n.x, y: n.y }, ...st.points.slice(1, mIdx + 1)];
        const mSample = samplePolyline(motionPts, motionT);
        if (mSample.traveled.length >= 2 && motionT > 0) {
          trails.push({
            role: `${n.role}_motion`,
            kind: 'motion',
            points: mSample.traveled,
            color: '#38bdf8',
          });
        }
        if (postSnapT <= 0 || mIdx >= st.points.length - 1) {
          animatedPos.set(n.role, { x: mSample.x, y: mSample.y });
          continue;
        }
        const postPts = [st.points[mIdx], ...st.points.slice(mIdx + 1)];
        const postSample = samplePolyline(postPts, postSnapT);
        if (postSample.traveled.length >= 2) {
          trails.push({
            role: n.role,
            kind: st.kind,
            points: postSample.traveled,
            color: st.kind === 'run' ? '#ef4444' : st.kind === 'pass' ? '#2563eb' : '#475569',
          });
        }
        animatedPos.set(n.role, { x: postSample.x, y: postSample.y });
      } else {
        if (postSnapT <= 0) {
          animatedPos.set(n.role, { x: n.x, y: n.y });
          continue;
        }
        let pts = [{ x: n.x, y: n.y }, ...st.points.slice(1)];
        // A lineman who isn't pulling only steps into his block (the first yard or so of his line).
        if (OL_ROLES.includes(n.role) && !isPullLine(st, n)) {
          const total = pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
          if (total > LINE_STEP) pts = samplePolyline(pts, LINE_STEP / total).traveled;
        }
        // Blockers engage quickly in the first 55% of the play
        const effectiveT = st.kind === 'block' ? easeOutQuad(Math.min(1, postSnapT * 1.65)) : postSnapT;
        const sample = samplePolyline(pts, effectiveT);
        if (sample.traveled.length >= 2) {
          trails.push({
            role: n.role,
            kind: st.kind,
            points: sample.traveled,
            color: st.kind === 'run' ? '#ef4444' : st.kind === 'pass' ? '#2563eb' : '#475569',
          });
        }
        animatedPos.set(n.role, { x: sample.x, y: sample.y });
      }
      continue;
    }

    // Synthetic movement for offensive players without a manually drawn stroke
    if (postSnapT <= 0) {
      animatedPos.set(n.role, { x: n.x, y: n.y });
      continue;
    }

    if (n.role === ballRole) {
      const synthPts = getSyntheticCarrierPoints(n);
      const sample = samplePolyline(synthPts, postSnapT);
      if (sample.traveled.length >= 2) {
        trails.push({
          role: n.role,
          kind: isPassPlay ? 'pass' : 'run',
          points: sample.traveled,
          color: '#ef4444',
        });
      }
      animatedPos.set(n.role, { x: sample.x, y: sample.y });
    } else if (['LT', 'LG', 'C', 'RG', 'RT'].includes(n.role)) {
      const blockT = easeOutQuad(Math.min(1, postSnapT * 1.8));
      if (isPassPlay) {
        const dropY = n.role === 'C' ? -0.7 : n.role === 'LG' || n.role === 'RG' ? -0.95 : -1.35;
        animatedPos.set(n.role, {
          x: Math.round((n.x * 0.96) * 100) / 100,
          y: Math.round((n.y + dropY * blockT) * 100) / 100,
        });
      } else {
        // A short step into his block (about LINE_STEP), toward the hole.
        const stepX = Math.sign(fallbackAimX || 1) * 0.3;
        animatedPos.set(n.role, {
          x: Math.round((n.x + stepX * blockT) * 100) / 100,
          y: Math.round((n.y + 0.65 * blockT) * 100) / 100,
        });
      }
    } else if (n.role === '1' || n.role === 'QB') {
      // QB opens toward the ball carrier mesh point, then carries out boot fake
      const qbT = easeOutQuad(Math.min(1, postSnapT * 1.5));
      const bootDir = fallbackAimX >= 0 ? -1 : 1;
      animatedPos.set(n.role, {
        x: Math.round((n.x + bootDir * 1.8 * qbT) * 100) / 100,
        y: Math.round((n.y - 1.2 * qbT) * 100) / 100,
      });
    } else {
      // Other skill / TE players step downfield into stalk block or clear-out route
      const skillT = easeOutQuad(postSnapT);
      animatedPos.set(n.role, {
        x: n.x,
        y: Math.round((n.y + (isPassPlay ? 4.2 : 2.2) * skillT) * 100) / 100,
      });
    }
  }

  // Ball position calculation
  const centerNode = nodes.find((n) => n.role === 'C') || { role: 'C', x: 0, y: 0 };
  const qbNode = nodes.find((n) => n.role === '1' || n.role === 'QB') || centerNode;
  const qbNow = animatedPos.get(qbNode.role) || { x: qbNode.x, y: qbNode.y };
  const carrierNow = animatedPos.get(ballRole) || qbNow;

  let ball = { x: centerNode.x, y: centerNode.y, inAir: false };
  if (postSnapT <= 0) {
    ball = { x: centerNode.x, y: centerNode.y, inAir: false };
  } else if (postSnapT < 0.12) {
    // Ball snapping from Center to QB
    const snapFrac = postSnapT / 0.12;
    ball = {
      x: centerNode.x + (qbNode.x - centerNode.x) * snapFrac,
      y: centerNode.y + (qbNode.y - centerNode.y) * snapFrac,
      inAir: true,
    };
  } else if (isPassPlay) {
    // Find primary pass route target
    const passStrokeEntry =
      Array.from(roleStroke.entries()).find(([r, s]) => r === ballRole && s.kind === 'pass') ||
      Array.from(roleStroke.entries()).find(([, s]) => s.kind === 'pass');
    const targetRole = passStrokeEntry?.[0];
    const targetPos = (targetRole && animatedPos.get(targetRole)) || carrierNow;
    if (postSnapT < 0.45) {
      ball = { x: qbNow.x, y: qbNow.y, inAir: false };
    } else if (postSnapT < 0.78) {
      const airT = (postSnapT - 0.45) / 0.33;
      ball = {
        x: qbNow.x + (targetPos.x - qbNow.x) * airT,
        y: qbNow.y + (targetPos.y - qbNow.y) * airT,
        inAir: true,
      };
    } else {
      ball = { x: targetPos.x, y: targetPos.y, inAir: false };
    }
  } else {
    // Run play: mesh/handoff from QB to ball carrier between 0.12 and 0.24, then carrier carries it
    if (ballRole !== '1' && ballRole !== 'QB' && postSnapT < 0.24) {
      const meshT = (postSnapT - 0.12) / 0.12;
      ball = {
        x: qbNow.x + (carrierNow.x - qbNow.x) * meshT,
        y: qbNow.y + (carrierNow.y - qbNow.y) * meshT,
        inAir: false,
      };
    } else {
      ball = { x: carrierNow.x, y: carrierNow.y, inAir: false };
    }
  }

  // Second pass: compute defensive player movement (drawn blitz/coverage strokes OR pursuit/drop reaction)
  for (const n of nodes) {
    if (!isDefenseRole(n.role)) continue;
    const st = roleStroke.get(n.role);
    if (st && st.points.length >= 2) {
      if (postSnapT <= 0) {
        animatedPos.set(n.role, { x: n.x, y: n.y });
        continue;
      }
      const pts = [{ x: n.x, y: n.y }, ...st.points.slice(1)];
      const sample = samplePolyline(pts, postSnapT);
      if (sample.traveled.length >= 2) {
        trails.push({
          role: n.role,
          kind: st.kind,
          points: sample.traveled,
          color: '#e11d48',
        });
      }
      animatedPos.set(n.role, { x: sample.x, y: sample.y });
      continue;
    }

    if (postSnapT <= 0) {
      animatedPos.set(n.role, { x: n.x, y: n.y });
      continue;
    }

    const isDL = /^(?:DE|DT|NT)/.test(n.role);
    const isLB = /^(?:SAM|MIKE|WILL|ROV|LB)/.test(n.role);
    if (isDL) {
      // DL penetrates across LOS and bends toward ball
      const dlT = easeOutQuad(Math.min(1, postSnapT * 1.4));
      const dx = (ball.x - n.x) * 0.28 * dlT;
      const dy = -1.15 * dlT + (ball.y - n.y) * 0.18 * postSnapT;
      animatedPos.set(n.role, {
        x: Math.round((n.x + dx) * 100) / 100,
        y: Math.round((n.y + dy) * 100) / 100,
      });
    } else if (isLB) {
      if (isPassPlay) {
        // Zone hook/curl drop, then break on ball
        const dropT = easeOutQuad(Math.min(1, postSnapT * 1.3));
        animatedPos.set(n.role, {
          x: Math.round((n.x + (ball.x - n.x) * 0.22 * postSnapT) * 100) / 100,
          y: Math.round((n.y + 1.8 * dropT) * 100) / 100,
        });
      } else {
        // Read step then flow downhill to ball carrier
        const pursuitT = Math.max(0, (postSnapT - 0.1) / 0.9);
        animatedPos.set(n.role, {
          x: Math.round((n.x + (ball.x - n.x) * 0.55 * pursuitT) * 100) / 100,
          y: Math.round((n.y + (ball.y - n.y) * 0.48 * pursuitT) * 100) / 100,
        });
      }
    } else {
      // DBs (CB, FS, SS): backpedal first, then rally to the ball
      if (isPassPlay) {
        animatedPos.set(n.role, {
          x: Math.round((n.x + (ball.x - n.x) * 0.2 * postSnapT) * 100) / 100,
          y: Math.round((n.y + 2.6 * easeOutQuad(postSnapT)) * 100) / 100,
        });
      } else {
        const rallyT = Math.max(0, (postSnapT - 0.22) / 0.78);
        animatedPos.set(n.role, {
          x: Math.round((n.x + (ball.x - n.x) * 0.38 * rallyT) * 100) / 100,
          y: Math.round((n.y + (ball.y - n.y) * 0.35 * rallyT) * 100) / 100,
        });
      }
    }
  }

  const animatedNodes = nodes.map((n) => {
    const pos = animatedPos.get(n.role);
    return pos ? { ...n, x: pos.x, y: pos.y } : n;
  });

  return {
    progress: p,
    phase,
    phaseLabel,
    nodes: animatedNodes,
    trails,
    ball: {
      x: Math.round(ball.x * 100) / 100,
      y: Math.round(ball.y * 100) / 100,
      inAir: ball.inAir,
    },
  };
}
