// A play's name built from its parts, the way coaches call it: "32 Gun Rt Tight 44 Counter".
//   personnel · QB (blank under center) · strength · tags · back + hole (runs) · concept
import type { CallParts, Play } from '../hudlScout/types/football';

export const PERSONNEL = ['10', '11', '12', '20', '21', '22', '23', '32'];
export const QB_SPOTS: { v: NonNullable<CallParts['qb']>; label: string }[] = [
  { v: 'UC', label: 'Under center' },
  { v: 'Gun', label: 'Shotgun' },
  { v: 'Pistol', label: 'Pistol' },
];
export const TAGS = ['Weak', 'Strong', 'Tight', 'Wide', 'Heavy', 'Motion', 'Jet', 'Wing', 'Flex', 'Trips', 'Bunch', 'Over', 'Unbalanced', 'Empty'];
export const BACKS: { v: string; label: string }[] = [
  { v: '1', label: '1 QB' },
  { v: '2', label: '2 FB' },
  { v: '3', label: '3 TB' },
  { v: '4', label: '4 Wing' },
];
export const HOLES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const RUN_CONCEPTS = ['Dive', 'Trap', 'Counter', 'Power', 'ISO', 'Sweep', 'Toss', 'Zone', 'Wedge', 'Buck', 'Reverse', 'Option', 'Sneak', 'Draw'];
export const PASS_CONCEPTS = ['Boot', 'Play action', 'Screen', 'Sprint out', 'Quick', 'Drop back', 'Jet pass'];

/** The name the parts make ("32 Gun Rt Tight 44 Counter"); back and hole only on runs. */
export function buildCallName(parts: CallParts | undefined, run = true): string {
  if (!parts) return '';
  const side = parts.strength === 'R' ? 'Rt' : parts.strength === 'L' ? 'Lt' : '';
  const qb = parts.qb && parts.qb !== 'UC' ? parts.qb : '';
  const ball = run && parts.back && parts.hole ? `${parts.back}${parts.hole}` : '';
  return [parts.personnel, qb, side, ...(parts.tags || []), ball, parts.concept].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
}

/** The parts to start from: the coach's, else what the breakdown already says (personnel, strength). */
export function startingParts(p: Play): CallParts {
  if (p.callParts) return p.callParts;
  const personnel = p.personnel && p.personnel !== '-' ? String(p.personnel).trim() : '';
  const strength = p.strength === 'L' || p.strength === 'R' ? p.strength : undefined;
  return { ...(personnel ? { personnel } : {}), ...(strength ? { strength } : {}) };
}

/** The play's parts changed: the parts and the name they make, ready to save on the play. */
export function withParts(p: Play, parts: CallParts): Pick<Play, 'callParts' | 'callName'> {
  const clean: CallParts = Object.fromEntries(
    Object.entries(parts).filter(([, v]) => (Array.isArray(v) ? v.length : v !== undefined && v !== ''))
  ) as CallParts;
  const run = !/pass|screen/i.test(String(p.playType || '')) || /rpo/i.test(String(p.playType || ''));
  return { callParts: clean, callName: buildCallName(clean, run) };
}
