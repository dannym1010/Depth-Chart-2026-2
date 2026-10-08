// Each defender's job on one of our defensive plays: what the coach typed, else the line drawn for him
// (a blitz or a drop), else his standard job in the front and coverage (with contain where our system puts it).
import type { PlayNode, PlayStroke } from './footballEngine';

const LINE: Record<string, string> = { E9: '9 technique', E5: '5 technique', T3: '3 technique', T1: '1 technique', NT: '0 technique, both A gaps' };
/** A lineman's technique ("DT5" → 5 technique), any front. */
const lineJob = (role: string) => LINE[role] || ((m) => (m ? `${m[1]} technique` : ''))(role.match(/^(?:D[ET]|E|T)(\d+i?)$/i));
const EDGE_LB = { has: (r: string) => r === 'SAM' || r === 'ROV' || /^OLB/.test(r) };
const INSIDE_LB = { has: (r: string) => r === 'MIKE' || r === 'WILL' || /^ILB/.test(r) };

/** The blitzes and stunts named in a look's notes, for the defenders they send. */
function pressureJob(role: string, notes: string): string {
  const n = notes.toLowerCase();
  if (EDGE_LB.has(role) && /sam\/rover fire c-?gap/.test(n)) return 'Fire C gap';
  if ((role === 'E9' || role === 'E5') && /de pinch/.test(n)) return 'Pinch inside';
  if (INSIDE_LB.has(role) && /both ilbs a-?gap/.test(n)) return 'Blitz A gap';
  if (lineJob(role) && /dl crash a\/b/.test(n)) return 'Crash A/B gap';
  if (lineJob(role) && /dl wide contain/.test(n)) return 'Fan, wide contain';
  return '';
}

/** The deep and underneath jobs by coverage. */
function coverageJob(role: string, shell: string): string {
  const s = shell.toLowerCase();
  const corner = role === 'CBL' || role === 'CBR';
  if (/cover 0|\b0\b/.test(s)) return corner || role === 'FS' ? 'Man, no help' : '';
  if (/cover 1/.test(s)) return corner ? 'Man' : role === 'FS' ? 'Deep middle' : '';
  if (/cover 3/.test(s)) return corner ? 'Deep 1/3' : role === 'FS' ? 'Deep middle 1/3' : '';
  return '';
}

/**
 * A defender's standard job in this look ("4-4", "Cover 3"). `contain` names who has contain in this front
 * in our system ("OLBs", "DEs").
 */
export function standardDefenseJob(role: string, look: { front: string; shell: string; notes?: string }, contain = ''): string {
  // A pressure or stunt the look names ("Sam/Rover fire C-gap, DE pinch") is that defender's job.
  const pressure = pressureJob(role, look.notes || '');
  if (pressure) return pressure;
  const c = contain.toLowerCase();
  const containHere = (EDGE_LB.has(role) && /olb|outside|sam|rov/.test(c)) || ((role === 'E9' || role === 'E5') && /\bde|end/.test(c));
  const five = /^5/.test(look.front);
  const parts: string[] = [];
  if (lineJob(role)) parts.push(five && (role === 'E9' || role === 'E5') ? 'Outside shade' : lineJob(role));
  else if (EDGE_LB.has(role)) parts.push(five ? 'Curl-flat' : 'C/D gap, force · curl-flat');
  else if (INSIDE_LB.has(role)) parts.push(five ? 'Hook-curl' : 'A/B gap, spill · hook-curl');
  else {
    const cov = coverageJob(role, look.shell);
    if (cov) parts.push(cov);
  }
  if (containHere) parts.push('contain');
  return parts.join(', ');
}

/** The job a line drawn for a defender shows: the preset's name, else a blitz (he ends at the line) or a drop. */
export function drawnDefenseJob(strokes: PlayStroke[], n: PlayNode): string {
  // His line starts on him.
  const s = strokes.find((st) => st.points.length > 0 && Math.hypot(st.points[0].x - n.x, st.points[0].y - n.y) < 1.4);
  if (!s) return '';
  if (s.label) return s.label;
  const end = s.points[s.points.length - 1];
  return end && end.y <= 1 ? 'Blitz' : 'Drop';
}

/** The job written for each defender: typed, drawn, or standard. */
export function defenseJob(
  n: PlayNode,
  opts: { typed?: string; strokes: PlayStroke[]; look?: { front: string; shell: string; notes?: string } | null; contain?: string }
): string {
  return opts.typed?.trim() || drawnDefenseJob(opts.strokes, n) || (opts.look ? standardDefenseJob(n.role, opts.look, opts.contain) : '');
}

/** Line first, then linebackers, then the secondary; left to right in each. */
export function defenseOrder(nodes: PlayNode[]): PlayNode[] {
  const rank = (r: string) => (lineJob(r) ? 0 : EDGE_LB.has(r) || INSIDE_LB.has(r) ? 1 : 2);
  return [...nodes].sort((a, b) => rank(a.role) - rank(b.role) || a.x - b.x);
}
