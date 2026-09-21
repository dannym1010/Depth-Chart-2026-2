import { WhiteboardDrill, isDrillWhiteboardEnabled } from './whiteboardDrillData';
import { printCleanHTML } from '../../utils/printUtils';
import { spreadDiagramElements } from './whiteboardSpreadHelper';

/**
 * Dedicated high-contrast vector diagram for the Triangle Block Pop & Directional Peek drill,
 * matching the default/initial setup view of the new interactive whiteboard.
 */
function generateTriangleDrillPrintSvg(): string {
  return `
    <svg viewBox="0 0 700 500" class="diagram-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb" />
        </marker>
        <marker id="arrow-purple" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
        </marker>
        <marker id="arrow-green" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#16a34a" />
        </marker>
        <marker id="arrow-orange" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
        </marker>
        <marker id="t-bar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <line x1="5" y1="0" x2="5" y2="10" stroke="#1a1a24" stroke-width="2.5" />
        </marker>
      </defs>

      <!-- Pure White Field Surface -->
      <rect x="0" y="0" width="700" height="500" fill="#ffffff" />

      <!-- Field Grid & Yard Lines -->
      <g opacity="0.65">
        <line x1="30" y1="75" x2="670" y2="75" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />
        <line x1="30" y1="150" x2="670" y2="150" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />
        <!-- Blue Line of Scrimmage -->
        <line x1="30" y1="225" x2="670" y2="225" stroke="#2563eb" stroke-width="2.5" />
        <line x1="30" y1="300" x2="670" y2="300" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />
        <line x1="30" y1="375" x2="670" y2="375" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />
        <line x1="30" y1="450" x2="670" y2="450" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />

        <!-- Hash Marks -->
        <line x1="260" y1="50" x2="260" y2="460" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,6" />
        <line x1="440" y1="50" x2="440" y2="460" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,6" />

        <!-- Yard numbers -->
        <text x="590" y="158" font-family="sans-serif" font-size="26" font-weight="900" fill="#cbd5e1" opacity="0.65">10</text>
        <text x="590" y="308" font-family="sans-serif" font-size="26" font-weight="900" fill="#cbd5e1" opacity="0.65">20</text>
        <text x="110" y="383" font-family="sans-serif" font-size="26" font-weight="900" fill="#cbd5e1" opacity="0.65">30</text>
      </g>

      <!-- FIT TRIANGLE ZONE (Light Shaded Polygon) -->
      <polygon points="350,75 130,365 570,365" fill="#eff6ff" fill-opacity="0.85" stroke="#93c5fd" stroke-width="2" stroke-dasharray="6,5" />
      <text x="350" y="315" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="900" letter-spacing="4" fill="#93c5fd" opacity="0.5">FIT TRIANGLE</text>

      <!-- 3 Boundary Apex Cones -->
      <!-- Top Cone -->
      <g transform="translate(350, 75)">
        <polygon points="0,-11 -9,7 9,7" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" />
        <ellipse cx="0" cy="7" rx="8" ry="2.5" fill="#c2410c" />
      </g>
      <!-- Left Cone -->
      <g transform="translate(130, 365)">
        <polygon points="0,-11 -9,7 9,7" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" />
        <ellipse cx="0" cy="7" rx="8" ry="2.5" fill="#c2410c" />
      </g>
      <!-- Right Cone -->
      <g transform="translate(570, 365)">
        <polygon points="0,-11 -9,7 9,7" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" />
        <ellipse cx="0" cy="7" rx="8" ry="2.5" fill="#c2410c" />
      </g>

      <!-- Directional Flow Tracks (Left Flow, Middle ISO, Right Flow) -->
      <!-- Left Flow Track -->
      <path d="M 335 90 Q 185 170 145 345" fill="none" stroke="#dc2626" stroke-width="2.4" stroke-dasharray="5,4" marker-end="url(#arrow-red)" />
      <g transform="translate(180, 215)">
        <rect x="-46" y="-8" width="92" height="16" rx="4" fill="#ffffff" stroke="#dc2626" stroke-width="1.2" />
        <text x="0" y="3.5" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#dc2626" text-anchor="middle">LEFT FLOW LANE</text>
      </g>

      <!-- Middle ISO Track -->
      <line x1="350" y1="95" x2="350" y2="330" stroke="#d97706" stroke-width="2.4" stroke-dasharray="5,4" marker-end="url(#arrow-orange)" />
      <g transform="translate(350, 260)">
        <rect x="-48" y="-8" width="96" height="16" rx="4" fill="#ffffff" stroke="#d97706" stroke-width="1.2" />
        <text x="0" y="3.5" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#d97706" text-anchor="middle">MIDDLE ISO LANE</text>
      </g>

      <!-- Right Flow Track -->
      <path d="M 365 90 Q 515 170 555 345" fill="none" stroke="#dc2626" stroke-width="2.4" stroke-dasharray="5,4" marker-end="url(#arrow-red)" />
      <g transform="translate(520, 215)">
        <rect x="-48" y="-8" width="96" height="16" rx="4" fill="#ffffff" stroke="#dc2626" stroke-width="1.2" />
        <text x="0" y="3.5" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#dc2626" text-anchor="middle">RIGHT FLOW LANE</text>
      </g>

      <!-- Offensive Triangle: 3 Blockers With Shields -->
      <!-- B1 Left Blocker -->
      <g transform="translate(235, 185)">
        <rect x="-18" y="-18" width="36" height="36" rx="4" fill="#f1f5f9" stroke="#0f172a" stroke-width="2.5" />
        <text x="0" y="5" font-family="sans-serif" font-size="13" font-weight="900" fill="#0f172a" text-anchor="middle">B1</text>
        <g transform="translate(0, 28)">
          <rect x="-44" y="-7" width="88" height="14" rx="4" fill="#ffffff" stroke="#64748b" stroke-width="1" />
          <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#334155" text-anchor="middle">Left Blocker (Shield)</text>
        </g>
      </g>

      <!-- B2 Middle Blocker -->
      <g transform="translate(350, 170)">
        <rect x="-18" y="-18" width="36" height="36" rx="4" fill="#f1f5f9" stroke="#0f172a" stroke-width="2.5" />
        <text x="0" y="5" font-family="sans-serif" font-size="13" font-weight="900" fill="#0f172a" text-anchor="middle">B2</text>
        <g transform="translate(0, -26)">
          <rect x="-48" y="-7" width="96" height="14" rx="4" fill="#ffffff" stroke="#64748b" stroke-width="1" />
          <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#334155" text-anchor="middle">Middle Blocker (Shield)</text>
        </g>
      </g>

      <!-- B3 Right Blocker -->
      <g transform="translate(465, 185)">
        <rect x="-18" y="-18" width="36" height="36" rx="4" fill="#f1f5f9" stroke="#0f172a" stroke-width="2.5" />
        <text x="0" y="5" font-family="sans-serif" font-size="13" font-weight="900" fill="#0f172a" text-anchor="middle">B3</text>
        <g transform="translate(0, 28)">
          <rect x="-46" y="-7" width="92" height="14" rx="4" fill="#ffffff" stroke="#64748b" stroke-width="1" />
          <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#334155" text-anchor="middle">Right Blocker (Shield)</text>
        </g>
      </g>

      <!-- Running Back (RB - Ball Carrier) -->
      <g transform="translate(350, 75)">
        <circle cx="0" cy="0" r="17" fill="#fee2e2" stroke="#dc2626" stroke-width="2.6" />
        <text x="0" y="4.5" font-family="sans-serif" font-size="12" font-weight="900" fill="#dc2626" text-anchor="middle">RB</text>
        <!-- Football -->
        <ellipse cx="14" cy="4" rx="6.5" ry="4" fill="#8B4513" stroke="#ffffff" stroke-width="0.7" transform="rotate(25 14 4)" />
        <g transform="translate(0, 27)">
          <rect x="-42" y="-7" width="84" height="14" rx="4" fill="#ffffff" stroke="#dc2626" stroke-width="1" />
          <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#dc2626" text-anchor="middle">RB (Ball Carrier)</text>
        </g>
      </g>

      <!-- LB Downhill Strike Vector -->
      <line x1="350" y1="340" x2="350" y2="215" stroke="#16a34a" stroke-width="2.8" marker-end="url(#arrow-green)" />
      <g transform="translate(350, 235)">
        <rect x="-60" y="-8" width="120" height="16" rx="4" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.2" />
        <text x="0" y="3.5" font-family="sans-serif" font-size="8.5" font-weight="900" fill="#15803d" text-anchor="middle">POP STRIKE (NO CLOTH)</text>
      </g>

      <!-- Linebacker (LB - Primary Defender) with Athletic Stance Feet -->
      <g transform="translate(350, 365)">
        <!-- Feet indicators -->
        <rect x="-17" y="-5" width="9" height="18" rx="3" fill="#93c5fd" stroke="#1d4ed8" stroke-width="1.4" />
        <rect x="8" y="-3" width="9" height="18" rx="3" fill="#1d4ed8" stroke="#1d4ed8" stroke-width="1.4" />
        <circle cx="0" cy="0" r="20" fill="#dbeafe" stroke="#1d4ed8" stroke-width="2.8" />
        <text x="0" y="5" font-family="sans-serif" font-size="13" font-weight="900" fill="#1d4ed8" text-anchor="middle">LB</text>
        <g transform="translate(0, 31)">
          <rect x="-66" y="-7" width="132" height="14" rx="4" fill="#ffffff" stroke="#1d4ed8" stroke-width="1.2" />
          <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#1e3a8a" text-anchor="middle">LB (Lead Foot Dictates Peek)</text>
        </g>
      </g>

      <!-- Coach (Positioned Directly BEHIND LB) -->
      <g transform="translate(350, 455)">
        <circle cx="0" cy="0" r="18" fill="#faf5ff" stroke="#7e22ce" stroke-width="2.5" />
        <text x="0" y="4.5" font-family="sans-serif" font-size="10" font-weight="900" fill="#7e22ce" text-anchor="middle">COACH</text>
        <g transform="translate(0, 26)">
          <rect x="-46" y="-7" width="92" height="14" rx="4" fill="#ffffff" stroke="#7e22ce" stroke-width="1.2" />
          <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#7e22ce" text-anchor="middle">COACH (BEHIND LB)</text>
        </g>
      </g>

      <!-- Coach Verbal Callout to LB -->
      <g transform="translate(290, 455)">
        <rect x="-115" y="-8" width="112" height="16" rx="4" fill="#ffffff" stroke="#1d4ed8" stroke-width="1.2" />
        <text x="-56" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#1d4ed8" text-anchor="middle">Calls: "RIGHT" or "LEFT" Lead</text>
      </g>

      <!-- Coach Silent Hand Signal to Offense -->
      <path d="M 370 445 Q 440 370 460 250" fill="none" stroke="#7e22ce" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arrow-purple)" />
      <g transform="translate(445, 335)">
        <rect x="-65" y="-8" width="130" height="16" rx="4" fill="#ffffff" stroke="#7e22ce" stroke-width="1.2" />
        <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#7e22ce" text-anchor="middle">Hand Signal to Ball Carrier</text>
      </g>

      <!-- Coaching Keys Inset Card (Bottom Left) -->
      <g transform="translate(24, 385)">
        <rect x="0" y="0" width="180" height="88" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.4" />
        <text x="10" y="16" font-family="sans-serif" font-size="8.5" font-weight="900" fill="#0f172a">DRILL REEL COACHING KEYS:</text>
        <text x="10" y="33" font-family="sans-serif" font-size="8" font-weight="600" fill="#334155">• Coach stands BEHIND LB</text>
        <text x="10" y="48" font-family="sans-serif" font-size="8" font-weight="600" fill="#334155">• Calls lead foot & signals RB</text>
        <text x="10" y="63" font-family="sans-serif" font-size="8" font-weight="600" fill="#15803d">• Violent pop strike (NO CLOTH)</text>
        <text x="10" y="78" font-family="sans-serif" font-size="8" font-weight="600" fill="#b91c1c">• Peek hole, reset hips & tackle</text>
      </g>
    </svg>
  `;
}

/**
 * Generates an isolated, professional, high-contrast 1-page printable coaching sheet
 * containing ONLY the selected drill or scheme.
 */
export function generateDrillPrintHTML(drill: WhiteboardDrill, activePhaseIndex: number = 0): string {
  const isTriangleDrill = drill.id === 'drill-lb-5' || drill.title === 'TRIANGLE BLOCK POP & DIRECTIONAL PEEK';

  const rawPhase = drill.phases[activePhaseIndex] || drill.phases[0] || {
    name: 'BASE ALIGNMENT',
    description: drill.objective,
    tokens: [],
    arrows: [],
    zones: [],
  };

  // Automatically spread out elements so they never collide on the printed paper
  const spreadElements = spreadDiagramElements(rawPhase.tokens, rawPhase.arrows, rawPhase.zones, 'spread');
  const currentPhase = {
    ...rawPhase,
    tokens: spreadElements.tokens,
    arrows: spreadElements.arrows,
    zones: spreadElements.zones,
  };

  // Helper for arrow SVG
  const arrowSvg = currentPhase.arrows
    .map((a) => {
      let d = '';
      if (a.type === 'curved' && a.controlX !== undefined && a.controlY !== undefined) {
        d = `M ${a.startX} ${a.startY} Q ${a.controlX} ${a.controlY} ${a.endX} ${a.endY}`;
      } else if (a.type === 'blitz') {
        const midX = (a.startX + a.endX) / 2 + (a.controlX ? a.controlX - a.startX : 0);
        const midY = (a.startY + a.endY) / 2 + (a.controlY ? a.controlY - a.startY : 0);
        d = `M ${a.startX} ${a.startY} Q ${midX} ${midY} ${a.endX} ${a.endY}`;
      } else {
        d = `M ${a.startX} ${a.startY} L ${a.endX} ${a.endY}`;
      }
      const markerId =
        a.type === 'block'
          ? 'url(#t-bar)'
          : a.color === '#7c3aed' || a.color === '#8b5cf6' || a.dashed || a.type === 'drop'
          ? 'url(#arrow-purple)'
          : a.color === '#d91b24'
          ? 'url(#arrow-red)'
          : a.color === '#058538'
          ? 'url(#arrow-green)'
          : 'url(#arrow-blue)';

      const isDashed = a.dashed || a.type === 'drop';
      const labelW = a.label ? Math.max(a.label.length * 6 + 14, 34) : 0;
      const midX = (a.startX + a.endX) / 2;
      const midY = (a.startY + a.endY) / 2;
      const dx = a.endX - a.startX;
      const dy = a.endY - a.startY;
      const isVertical = Math.abs(dy) > Math.abs(dx);
      const labelX = isVertical ? midX + (midX > 540 ? -28 : 28) : midX;
      const labelY = isVertical ? midY : midY - 12;

      return `
        <path d="${d}" fill="none" stroke="${a.color || '#2563eb'}" stroke-width="2.8" ${
        isDashed ? 'stroke-dasharray="5,4"' : ''
      } marker-end="${markerId}" />
        ${
          a.label
            ? `
            <g transform="translate(${labelX}, ${labelY})">
              <rect x="${-labelW / 2}" y="-8" width="${labelW}" height="16" rx="4" fill="#ffffff" stroke="${a.color || '#2563eb'}" stroke-width="1.2" />
              <text x="0" y="3" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="${a.color || '#1e293b'}" text-anchor="middle">${a.label}</text>
            </g>
          `
            : ''
        }
      `;
    })
    .join('');

  // Helper for zone SVG (dimmed shade and smart collision avoidance)
  const zoneSvg = currentPhase.zones
    .map((z) => {
      const badgeW = Math.max(z.name.length * 6.5 + 14, 38);
      const dimmedFill = Math.max(0.04, Math.min((z.opacity || 0.18) * 0.35, 0.08));

      // Candidates
      const candTop = { x: z.cx, y: z.cy - z.ry - 10 };
      const candBottom = { x: z.cx, y: z.cy + z.ry + 10 };
      const candRight = { x: z.cx + z.rx + badgeW / 2 + 8, y: z.cy };

      const collidesWithToken = (pos: { x: number; y: number }) =>
        currentPhase.tokens.some((t) => Math.hypot(t.x - pos.x, t.y - pos.y) < 36);

      let bestPos = candTop;
      if (collidesWithToken(candTop) || candTop.y < 20) {
        bestPos = !collidesWithToken(candBottom) && candBottom.y < 480 ? candBottom : candRight;
      }

      return `
        <ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="${z.color}" fill-opacity="${dimmedFill}" stroke="${z.color}" stroke-width="1.8" stroke-dasharray="5,3" />
        <g transform="translate(${bestPos.x}, ${bestPos.y})">
          <rect x="${-badgeW / 2}" y="-8" width="${badgeW}" height="16" rx="4" fill="#ffffff" fill-opacity="0.96" stroke="${z.color}" stroke-width="1.2" />
          <text x="0" y="3.5" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="${z.color}" text-anchor="middle">${z.name}</text>
        </g>
      `;
    })
    .join('');

  // Helper for tokens SVG matching Triangle Drill visual language
  const tokenSvg = currentPhase.tokens
    .map((t) => {
      const upperLabel = (t.label || '').toUpperCase().trim();
      const upperSub = (t.subLabel || '').toUpperCase().trim();
      const isSquare = t.isSquare || t.type === 'square' || (t.type === 'O' && (upperLabel === 'C' || upperLabel.startsWith('B') || upperLabel === 'G' || upperLabel === 'T' || upperLabel === 'TE' || upperLabel === 'LT' || upperLabel === 'RT' || upperLabel === 'LG' || upperLabel === 'RG'));
      const isBallCarrier = upperLabel === 'RB' || upperLabel === 'TB' || upperLabel === 'FB' || upperLabel === 'HB' || upperLabel.includes('BALL') || upperLabel.includes('CARRIER') || upperSub.includes('CARRIER') || upperSub.includes('BALL') || upperSub.includes('RUNNER');
      const isCoach = upperLabel === 'COACH' || upperLabel === 'COACH 1' || upperLabel === 'COACH 2' || upperSub.includes('COACH');
      const isDef = t.type === 'X' || (!isSquare && !isBallCarrier && !isCoach && (
        upperLabel === 'LB' || upperLabel === 'DL' || upperLabel === 'DE' || upperLabel === 'DB' ||
        upperLabel === 'DT' || upperLabel === 'NT' || upperLabel === 'MLB' || upperLabel === 'WLB' ||
        upperLabel === 'SLB' || upperLabel === 'MIKE' || upperLabel === 'WILL' || upperLabel === 'SAM' ||
        upperLabel === 'FS' || upperLabel === 'SS' || upperLabel === 'CB' || upperLabel === 'ROV' ||
        upperLabel === 'C1' || upperLabel === 'C2' || upperLabel === 'S' || upperLabel === 'N' ||
        upperLabel === 'E' || upperLabel === 'TACKLE' || upperSub.includes('DEFENDER') || upperSub.includes('PEEK') ||
        upperSub.includes('STRIKE') || upperSub.includes('LEAD') || upperSub.includes('SHED')
      ));

      // 1. Offense Blocker / Square Shield
      if (isSquare) {
        const subW = t.subLabel ? Math.max(t.subLabel.length * 5.5 + 14, 30) : 0;
        return `
          <g transform="translate(${t.x}, ${t.y})">
            <rect x="-18" y="-18" width="36" height="36" rx="4" fill="#f1f5f9" stroke="#0f172a" stroke-width="2.5" />
            <text x="0" y="5" font-family="sans-serif" font-size="13" font-weight="900" fill="#0f172a" text-anchor="middle">${t.label || 'B'}</text>
            ${
              t.subLabel
                ? `
                <g transform="translate(0, 27)">
                  <rect x="${-subW / 2}" y="-7" width="${subW}" height="14" rx="4" fill="#ffffff" stroke="#64748b" stroke-width="1" />
                  <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#334155" text-anchor="middle">${t.subLabel}</text>
                </g>
              `
                : ''
            }
          </g>
        `;
      }

      // 2. Ball Carrier (RB, TB, HB, FB with Football Graphic)
      if (isBallCarrier) {
        const subW = t.subLabel ? Math.max(t.subLabel.length * 5.5 + 14, 32) : 0;
        return `
          <g transform="translate(${t.x}, ${t.y})">
            <circle cx="0" cy="0" r="17" fill="#fee2e2" stroke="#dc2626" stroke-width="2.6" />
            <text x="0" y="4.5" font-family="sans-serif" font-size="12" font-weight="900" fill="#dc2626" text-anchor="middle">${t.label || 'RB'}</text>
            <!-- Football on hip -->
            <ellipse cx="14" cy="4" rx="6.5" ry="4" fill="#8B4513" stroke="#ffffff" stroke-width="0.7" transform="rotate(25 14 4)" />
            ${
              t.subLabel
                ? `
                <g transform="translate(0, 27)">
                  <rect x="${-subW / 2}" y="-7" width="${subW}" height="14" rx="4" fill="#ffffff" stroke="#dc2626" stroke-width="1" />
                  <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#dc2626" text-anchor="middle">${t.subLabel}</text>
                </g>
              `
                : `
                <g transform="translate(0, 27)">
                  <rect x="-38" y="-7" width="76" height="14" rx="4" fill="#ffffff" stroke="#dc2626" stroke-width="1" />
                  <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#dc2626" text-anchor="middle">Ball Carrier</text>
                </g>
              `
            }
          </g>
        `;
      }

      // 3. Coach Token
      if (isCoach) {
        const subW = t.subLabel ? Math.max(t.subLabel.length * 5.5 + 14, 32) : 0;
        return `
          <g transform="translate(${t.x}, ${t.y})">
            <circle cx="0" cy="0" r="18" fill="#faf5ff" stroke="#7e22ce" stroke-width="2.5" />
            <text x="0" y="4.5" font-family="sans-serif" font-size="10" font-weight="900" fill="#7e22ce" text-anchor="middle">${t.label || 'COACH'}</text>
            ${
              t.subLabel
                ? `
                <g transform="translate(0, 26)">
                  <rect x="${-subW / 2}" y="-7" width="${subW}" height="14" rx="4" fill="#ffffff" stroke="#7e22ce" stroke-width="1.2" />
                  <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#7e22ce" text-anchor="middle">${t.subLabel}</text>
                </g>
              `
                : ''
            }
          </g>
        `;
      }

      // 4. Defender Token with Athletic Stance Feet Underneath
      if (isDef) {
        const subW = t.subLabel ? Math.max(t.subLabel.length * 5.5 + 16, 32) : 0;
        const color = t.color || '#1d4ed8';
        return `
          <g transform="translate(${t.x}, ${t.y})">
            <!-- Athletic Stance Cleats / Feet -->
            <rect x="-17" y="-5" width="9" height="18" rx="3" fill="#93c5fd" stroke="${color}" stroke-width="1.4" />
            <rect x="8" y="-3" width="9" height="18" rx="3" fill="${color}" stroke="${color}" stroke-width="1.4" />
            <circle cx="0" cy="0" r="19" fill="#dbeafe" stroke="${color}" stroke-width="2.8" />
            <text x="0" y="5" font-family="sans-serif" font-size="12" font-weight="900" fill="${color}" text-anchor="middle">${t.label || 'DEF'}</text>
            ${
              t.subLabel
                ? `
                <g transform="translate(0, 29)">
                  <rect x="${-subW / 2}" y="-7" width="${subW}" height="14" rx="4" fill="#ffffff" stroke="${color}" stroke-width="1.2" />
                  <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#1e3a8a" text-anchor="middle">${t.subLabel}</text>
                </g>
              `
                : ''
            }
          </g>
        `;
      }

      // 5. 3D Cones
      if (t.type === 'cone') {
        const subW = t.subLabel ? Math.max(t.subLabel.length * 5.5 + 12, 26) : 0;
        return `
          <g transform="translate(${t.x}, ${t.y})">
            <polygon points="0,-11 -9,7 9,7" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" />
            <ellipse cx="0" cy="7" rx="8" ry="2.5" fill="#c2410c" />
            ${
              t.label && t.label !== 'Cone'
                ? `<text x="14" y="5" font-family="sans-serif" font-size="9" font-weight="bold" fill="#ea580c">${t.label}</text>`
                : ''
            }
            ${
              t.subLabel
                ? `
                <g transform="translate(0, 20)">
                  <rect x="${-subW / 2}" y="-6" width="${subW}" height="12" rx="3" fill="#ffffff" stroke="#ea580c" stroke-width="1" />
                  <text x="0" y="3" font-family="sans-serif" font-size="7.5" font-weight="bold" fill="#ea580c" text-anchor="middle">${t.subLabel}</text>
                </g>
              `
                : ''
            }
          </g>
        `;
      }

      // 6. Tackle Dummy / Bag
      if (t.type === 'bag') {
        const subW = t.subLabel ? Math.max(t.subLabel.length * 5.5 + 14, 28) : 0;
        return `
          <g transform="translate(${t.x}, ${t.y})">
            <rect x="-16" y="-26" width="32" height="52" rx="10" fill="#fee2e2" stroke="#dc2626" stroke-width="2.2" />
            <circle cx="0" cy="-14" r="5" fill="#ffffff" opacity="0.8" />
            <text x="0" y="5" font-family="sans-serif" font-size="10" font-weight="900" fill="#dc2626" text-anchor="middle">${t.label || 'BAG'}</text>
            ${
              t.subLabel
                ? `
                <g transform="translate(0, 32)">
                  <rect x="${-subW / 2}" y="-7" width="${subW}" height="14" rx="4" fill="#ffffff" stroke="#dc2626" stroke-width="1" />
                  <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#dc2626" text-anchor="middle">${t.subLabel}</text>
                </g>
              `
                : ''
            }
          </g>
        `;
      }

      // 7. Football Token
      if (t.type === 'ball') {
        return `
          <g transform="translate(${t.x}, ${t.y})">
            <ellipse cx="0" cy="0" rx="14" ry="9" fill="#8B4513" stroke="#5c2d0c" stroke-width="1.5" transform="rotate(-20)" />
            <line x1="-7" y1="0" x2="7" y2="0" stroke="#ffffff" stroke-width="1.8" transform="rotate(-20)" />
            <line x1="-3" y1="-3" x2="-3" y2="3" stroke="#ffffff" stroke-width="1.2" transform="rotate(-20)" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#ffffff" stroke-width="1.2" transform="rotate(-20)" />
            <line x1="3" y1="-3" x2="3" y2="3" stroke="#ffffff" stroke-width="1.2" transform="rotate(-20)" />
          </g>
        `;
      }

      // Default Clean Token with Sublabel Pill
      const subW = t.subLabel ? Math.max(t.subLabel.length * 5.5 + 14, 28) : 0;
      return `
        <g transform="translate(${t.x}, ${t.y})">
          <circle cx="0" cy="0" r="16" fill="#f8fafc" stroke="${t.color || '#0f172a'}" stroke-width="2.4" />
          <text x="0" y="4.5" font-family="sans-serif" font-size="${t.label && t.label.length > 2 ? '10' : '12'}" font-weight="900" fill="${t.color || '#0f172a'}" text-anchor="middle">${t.label || ''}</text>
          ${
            t.subLabel
              ? `
              <g transform="translate(0, 26)">
                <rect x="${-subW / 2}" y="-7" width="${subW}" height="14" rx="4" fill="#ffffff" stroke="#94a3b8" stroke-width="1" />
                <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#334155" text-anchor="middle">${t.subLabel}</text>
              </g>
            `
              : ''
          }
        </g>
      `;
    })
    .join('');

  // Diagram Inset Coaching Card (styled identically to Triangle drill coaching reel keys)
  const coachingKeys = drill.diagramKeys && drill.diagramKeys.length > 0
    ? drill.diagramKeys
    : (drill.cues || []).slice(0, 3).map((cue) => ({ text: cue, isHighlight: false }));

  const insetSvg = coachingKeys.length > 0
    ? `
    <g transform="translate(35, 365)">
      <rect x="0" y="0" width="265" height="${Math.min(coachingKeys.length * 20 + 28, 96)}" rx="6" fill="#ffffff" fill-opacity="0.97" stroke="#94a3b8" stroke-width="1.5" />
      <rect x="0" y="0" width="265" height="20" rx="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" />
      <text x="10" y="14" font-family="sans-serif" font-size="9" font-weight="900" fill="#1e293b" letter-spacing="0.5">COACHING FOCUS & KEYS</text>
      ${coachingKeys
        .slice(0, 3)
        .map(
          (k, i) => `
        <text x="12" y="${36 + i * 19}" font-family="sans-serif" font-size="8.5" font-weight="${
            k.isHighlight ? '900' : '700'
          }" fill="${k.isHighlight ? '#b91c1c' : '#334155'}">
          • ${k.text.length > 36 ? k.text.substring(0, 35) + '…' : k.text}
        </text>
      `
        )
        .join('')}
    </g>
  `
    : '';

  // Watermark label matching Linebacker Triangle drill
  let watermarkLabel = drill.formationName || '';
  if (!watermarkLabel) {
    const upperT = drill.title.toUpperCase();
    if (upperT.includes('TRIANGLE')) watermarkLabel = 'FIT TRIANGLE';
    else if (upperT.includes('GET-OFF') || upperT.includes('STICK')) watermarkLabel = 'GET-OFF & EXPLOSION CHUTE';
    else if (upperT.includes('STRIKE') || upperT.includes('LOCK') || upperT.includes('SHED')) watermarkLabel = 'STRIKE & SEPARATION ZONE';
    else if (upperT.includes('SPILL') || upperT.includes('CONTAIN')) watermarkLabel = 'SPILL & CONTAIN CORRIDOR';
    else if (upperT.includes('SHUFFLE') || upperT.includes('SCRAPE')) watermarkLabel = 'READ & SCRAPE ALLEY';
    else if (upperT.includes('PEDAL') || upperT.includes('PLANT')) watermarkLabel = 'SECONDARY WEAVE & BREAK SECTOR';
    else if (upperT.includes('TRAIL') || upperT.includes('COVER')) watermarkLabel = 'PASS DISRUPTION POCKET';
    else if (upperT.includes('TACKLE') || upperT.includes('PROFILE')) watermarkLabel = 'PROFILE TACKLE CORRIDOR';
    else if (upperT.includes('GATOR') || upperT.includes('ROLL')) watermarkLabel = 'TURNOVER STRIP SECTOR';
    else if (upperT.includes('BLOCK') || upperT.includes('DRIVE')) watermarkLabel = 'DRIVE BLOCK CHUTE';
    else if (upperT.includes('REACH') || upperT.includes('CLIMB')) watermarkLabel = 'ZONE REACH TRACK';
    else if (upperT.includes('SLED')) watermarkLabel = 'SLED EXPLOSION CORRIDOR';
    else if (upperT.includes('SCHEME') || upperT.includes('COVER 4') || upperT.includes('3-4')) watermarkLabel = 'FORMATION ALIGNMENT SHELL';
    else {
      switch (drill.category) {
        case 'DL':
        case 'DE':
          watermarkLabel = 'LINE OF SCRIMMAGE / GET-OFF ALLEY';
          break;
        case 'LB':
          watermarkLabel = 'TACKLE BOX / FIT TRIANGLE';
          break;
        case 'DB':
          watermarkLabel = 'SECONDARY COVERAGE CORRIDOR';
          break;
        case 'TACKLE':
        case 'TEAM':
          watermarkLabel = 'FORM FIT TACKLE ALLEY';
          break;
        case 'BLOCKING':
          watermarkLabel = 'OFFENSIVE LINE RUN CHUTE';
          break;
        default:
          watermarkLabel = 'TACTICAL REACTION ZONE';
          break;
      }
    }
  }

  // Calculate bounding box for tactical zone polygon
  let pMinX = 200, pMaxX = 500, pMinY = 100, pMaxY = 380;
  if (currentPhase.tokens.length > 0) {
    pMinX = Math.min(...currentPhase.tokens.map((t) => t.x));
    pMaxX = Math.max(...currentPhase.tokens.map((t) => t.x));
    pMinY = Math.min(...currentPhase.tokens.map((t) => t.y));
    pMaxY = Math.max(...currentPhase.tokens.map((t) => t.y));
  }
  const zLeft = Math.max(90, pMinX - 45);
  const zRight = Math.min(610, pMaxX + 45);
  const zTop = Math.max(70, pMinY - 35);
  const zBottom = Math.min(425, pMaxY + 35);
  const zMidX = (zLeft + zRight) / 2;

  // Check if currentPhase tokens has coach
  const hasCoachToken = currentPhase.tokens.some(
    (t) =>
      (t.label || '').toUpperCase().includes('COACH') || (t.subLabel || '').toUpperCase().includes('COACH')
  );

  const coachBehindPrintSvg = !hasCoachToken
    ? `
    <!-- Coach Behind Defensive Setup (Linebacker Triangle format) -->
    <g transform="translate(350, ${Math.min(460, zBottom + 25)})">
      <circle cx="0" cy="0" r="18" fill="#faf5ff" stroke="#7e22ce" stroke-width="2.5" />
      <text x="0" y="4.5" font-family="sans-serif" font-size="10" font-weight="900" fill="#7e22ce" text-anchor="middle">COACH</text>
      <g transform="translate(0, 26)">
        <rect x="-56" y="-7" width="112" height="14" rx="4" fill="#ffffff" stroke="#7e22ce" stroke-width="1.2" />
        <text x="0" y="3.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="#7e22ce" text-anchor="middle">COACH (SIGNALS & CUES)</text>
      </g>
    </g>
    <g transform="translate(260, ${Math.min(460, zBottom + 25)})">
      <rect x="-95" y="-8" width="95" height="16" rx="4" fill="#ffffff" stroke="#1d4ed8" stroke-width="1.2" />
      <text x="-48" y="3.5" font-family="sans-serif" font-size="7.5" font-weight="bold" fill="#1d4ed8" text-anchor="middle">🗣️ ${
        drill.cues && drill.cues[0] ? drill.cues[0].replace(/"/g, '').slice(0, 22) : 'Fire on movement!'
      }</text>
    </g>
    <path d="M 350 ${Math.min(435, zBottom)} L ${zMidX} ${Math.max(
        160,
        (zTop + zBottom) / 2
      )}" fill="none" stroke="#7e22ce" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arrow-purple)" />
  `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${drill.title} - Mahopac 10U Defensive Playbook</title>
  <style>
    @page {
      size: letter portrait;
      margin: 0.3in 0.35in;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.35;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-card {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .title-group h1 {
      font-size: 21px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .title-group .sub {
      font-size: 11px;
      color: #475569;
      font-weight: 700;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-group {
      text-align: right;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      border-radius: 4px;
      margin-bottom: 3px;
    }
    .badge-blue {
      background: #1e3a8a;
      color: #ffffff;
    }
    .badge-gray {
      background: #e2e8f0;
      color: #1e293b;
      font-weight: 800;
    }
    .objective-box {
      background: #f8fafc;
      border-left: 4px solid #2563eb;
      padding: 6px 10px;
      margin-bottom: 8px;
      font-size: 10.5px;
    }
    .objective-box strong {
      color: #1e3a8a;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    .diagram-container {
      width: 100%;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 8px;
      position: relative;
    }
    .diagram-caption {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      padding: 4px 10px;
      font-size: 9.5px;
      font-weight: 800;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
      text-transform: uppercase;
    }
    .diagram-svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;
    }
    .info-box {
      border: 1.5px solid #e2e8f0;
      border-radius: 6px;
      padding: 7px 9px;
      background: #ffffff;
    }
    .box-green {
      border-color: #86efac;
      background: #f0fdf4;
    }
    .box-red {
      border-color: #fca5a5;
      background: #fef2f2;
    }
    .box-title {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .title-green { color: #15803d; }
    .title-red { color: #b91c1c; }
    .box-list {
      list-style-type: none;
      padding-left: 0;
    }
    .box-list li {
      position: relative;
      padding-left: 12px;
      margin-bottom: 3px;
      font-size: 10px;
      line-height: 1.3;
    }
    .box-list li::before {
      content: "•";
      position: absolute;
      left: 2px;
      font-weight: bold;
    }
    .box-green li::before { color: #16a34a; }
    .box-red li::before { color: #dc2626; }

    .instructions-strip {
      border: 1.5px solid #fed7aa;
      border-radius: 6px;
      padding: 6px 9px;
      background: #fffaf5;
      margin-bottom: 8px;
    }
    .instructions-strip h3 {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      color: #9a3412;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .instructions-list {
      list-style-type: decimal;
      padding-left: 18px;
      margin: 0;
    }
    .instructions-list li {
      font-size: 9.5px;
      line-height: 1.35;
      color: #1e293b;
      margin-bottom: 2px;
    }

    .phases-strip {
      border: 1.5px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 9px;
      background: #f8fafc;
      margin-bottom: 8px;
    }
    .phases-strip h3 {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .phases-grid {
      display: grid;
      grid-template-columns: repeat(${Math.min(drill.phases.length, 3)}, 1fr);
      gap: 6px;
    }
    .phase-cell {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 5px 7px;
    }
    .phase-cell-active {
      border-color: #2563eb;
      background: #eff6ff;
    }
    .phase-name {
      font-size: 9px;
      font-weight: 900;
      color: #1e3a8a;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .phase-desc {
      font-size: 8.5px;
      color: #475569;
      line-height: 1.25;
    }

    .footer-notes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .setup-box {
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 9.5px;
      color: #475569;
    }
    .notes-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 8px;
      min-height: 42px;
    }
    .notes-box-title {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 3px;
    }
    .notes-line {
      border-bottom: 1px dotted #cbd5e1;
      height: 14px;
    }
  </style>
</head>
<body>
  <div class="print-card">
    <!-- Header -->
    <div class="header-bar">
      <div class="title-group">
        <h1>${drill.title}</h1>
        <div class="sub">${drill.subtitle} &nbsp;•&nbsp; ${drill.categoryLabel}</div>
      </div>
      <div class="badge-group">
        <div class="badge badge-blue">MAHOPAC 10U DEFENSE</div><br>
        <div class="badge badge-gray">YOUTH 10U TACTICAL DRILL</div>
      </div>
    </div>

    <!-- Objective & Setup -->
    <div class="objective-box">
      <strong>Core Objective:</strong> ${drill.objective}
      ${drill.setup ? `<div style="margin-top: 4px; padding-top: 3px; border-top: 1px dashed #cbd5e1;"><strong style="color: #4338ca;">Field Setup:</strong> ${drill.setup}</div>` : ''}
    </div>

    <!-- Diagram -->
    <div class="diagram-container">
      <div class="diagram-caption">
        <span>Active Diagram: <strong>${isTriangleDrill ? 'DEFAULT SETUP: FIT TRIANGLE ALIGNMENT (3 BLOCKERS + RB + LB + COACH BEHIND)' : currentPhase.name}</strong></span>
        <span>${isTriangleDrill ? '6 Personnel / 3 Cones' : `${currentPhase.tokens.length} Players / Markers`}</span>
      </div>
      ${
        !isDrillWhiteboardEnabled(drill.id)
          ? `
          <div style="height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; margin: 8px 0; text-align: center; padding: 16px;">
            <div style="font-size: 13px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">
              Diagram Omitted (Whiteboard Deselected for this Drill)
            </div>
            <div style="font-size: 10px; color: #64748b; max-width: 480px; line-height: 1.5;">
              This drill is designated as text/instructions-only in your playbook settings. The complete coaching keys, cues, and execution progression are detailed below.
            </div>
          </div>
          `
          : isTriangleDrill
          ? generateTriangleDrillPrintSvg()
          : `
      <svg viewBox="0 0 700 500" class="diagram-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrow-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb" />
          </marker>
          <marker id="arrow-purple" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
          </marker>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#d91b24" />
          </marker>
          <marker id="arrow-green" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#058538" />
          </marker>
          <marker id="t-bar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <line x1="5" y1="0" x2="5" y2="10" stroke="#1a1a24" stroke-width="2.5" />
          </marker>
        </defs>

        <!-- Pure White Field Surface -->
        <rect x="0" y="0" width="700" height="500" fill="#ffffff" />

        <!-- Tactical Formation Zone Footprint (Linebacker Triangle visual standard) -->
        <polygon points="${zMidX},${zTop} ${zLeft},${zBottom} ${zRight},${zBottom}" fill="#eff6ff" stroke="#93c5fd" stroke-width="2" stroke-dasharray="6,6" />
        <text x="350" y="${(zTop + zBottom) / 2 + 8}" font-family="sans-serif" font-size="26" font-weight="900" fill="#93c5fd" letter-spacing="4" text-anchor="middle" opacity="0.38">${watermarkLabel}</text>

        <!-- 3D Perimeter Athletic Cones -->
        <g transform="translate(${zMidX}, ${zTop})">
          <polygon points="0,-11 -9,7 9,7" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" />
          <ellipse cx="0" cy="7" rx="8" ry="2.5" fill="#c2410c" />
        </g>
        <g transform="translate(${zLeft}, ${zBottom})">
          <polygon points="0,-11 -9,7 9,7" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" />
          <ellipse cx="0" cy="7" rx="8" ry="2.5" fill="#c2410c" />
        </g>
        <g transform="translate(${zRight}, ${zBottom})">
          <polygon points="0,-11 -9,7 9,7" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" />
          <ellipse cx="0" cy="7" rx="8" ry="2.5" fill="#c2410c" />
        </g>

        <!-- Yard Lines & Numbers matching playbook style -->
        <g opacity="0.45">
          <line x1="30" y1="80" x2="670" y2="80" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />
          <line x1="30" y1="160" x2="670" y2="160" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />
          <!-- LOS Solid Blue Line -->
          <line x1="30" y1="240" x2="670" y2="240" stroke="#2563eb" stroke-width="2.5" />
          <line x1="30" y1="320" x2="670" y2="320" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />
          <line x1="30" y1="400" x2="670" y2="400" stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="6,4" />

          <!-- Hash Marks -->
          <line x1="280" y1="60" x2="280" y2="440" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,6" />
          <line x1="420" y1="60" x2="420" y2="440" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,6" />

          <!-- Yard line numbers -->
          <text x="560" y="168" font-family="sans-serif" font-size="30" font-weight="900" fill="#cbd5e1" opacity="0.75">10</text>
          <text x="560" y="328" font-family="sans-serif" font-size="30" font-weight="900" fill="#cbd5e1" opacity="0.75">20</text>
          <text x="140" y="408" font-family="sans-serif" font-size="30" font-weight="900" fill="#cbd5e1" opacity="0.75">30</text>
        </g>

        <!-- Diagram Inset Card -->
        ${insetSvg}

        <!-- Coach Behind Setup -->
        ${coachBehindPrintSvg}

        <!-- Zones Layer -->
        <g id="zonesLayer">${zoneSvg}</g>

        <!-- Arrows Layer -->
        <g id="arrowsLayer">${arrowSvg}</g>

        <!-- Tokens Layer -->
        <g id="tokensLayer">${tokenSvg}</g>
      </svg>
      `
      }
    </div>

    <!-- Phase Progression -->
    ${
      drill.phases && drill.phases.length > 0
        ? `
      <div class="phases-strip">
        <h3>Step-by-Step Phase Progression</h3>
        <div class="phases-grid">
          ${drill.phases
            .map(
              (p, idx) => `
            <div class="phase-cell ${idx === activePhaseIndex ? 'phase-cell-active' : ''}">
              <div class="phase-name">${p.name}</div>
              <div class="phase-desc">${p.description}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
        : ''
    }

    <!-- Step-by-Step Execution Instructions -->
    ${
      drill.instructions && drill.instructions.length > 0
        ? `
      <div class="instructions-strip">
        <h3>Drill Execution & Instructions</h3>
        <ol class="instructions-list">
          ${drill.instructions.map((inst) => `<li>${inst}</li>`).join('')}
        </ol>
      </div>
    `
        : ''
    }

    <!-- Coaching Cues & Critical Faults -->
    <div class="info-grid">
      <div class="info-box box-green">
        <div class="box-title title-green">10U Practice Coaching Cues</div>
        <ul class="box-list box-green">
          ${drill.cues.map((c) => `<li>${c}</li>`).join('')}
        </ul>
      </div>

      <div class="info-box box-red">
        <div class="box-title title-red">DO NOT DO THIS! (Critical Faults)</div>
        <ul class="box-list box-red">
          ${drill.faults.map((f) => `<li>${f}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- Bottom Setup and Handwritten Notes -->
    <div class="footer-notes">
      <div class="setup-box">
        <strong>Field & Equipment Setup:</strong><br>
        ${drill.equipment || 'Cones at 5yd intervals, blocking hand shields, whistle, football on a stick.'}
      </div>
      <div class="notes-box">
        <div class="notes-box-title">Game-Day / Practice Rep Adjustments:</div>
        <div class="notes-line"></div>
        <div class="notes-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers clean print of the selected drill using an isolated iframe.
 */
export function printDrillSheet(drill: WhiteboardDrill, activePhaseIndex: number = 0): void {
  const html = generateDrillPrintHTML(drill, activePhaseIndex);
  printCleanHTML(html, `${drill.title} - Mahopac 10U Defensive Playbook`);
}

/**
 * Extracts the drill stylesheet rules for inclusion in multi-page packages.
 */
export function extractDrillPrintStyles(drill: WhiteboardDrill): string {
  const full = generateDrillPrintHTML(drill, 0);
  const sStart = full.indexOf('<style>');
  const sEnd = full.indexOf('</style>');
  if (sStart !== -1 && sEnd !== -1) {
    return full.substring(sStart + 7, sEnd);
  }
  return '';
}

/**
 * Extracts the inner card markup for a drill to embed in multi-page practice plans.
 */
export function extractDrillCardMarkup(drill: WhiteboardDrill, activePhaseIndex: number = 0): string {
  const full = generateDrillPrintHTML(drill, activePhaseIndex);
  const start = full.indexOf('<div class="print-card">');
  const end = full.lastIndexOf('</div>');
  if (start !== -1 && end !== -1) {
    return full.substring(start, end + 6);
  }
  return '';
}

