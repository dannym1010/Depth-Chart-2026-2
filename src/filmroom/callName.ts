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

/**
 * A call typed the way it's said ("32 gun rt tight 44 counter") read into its parts: a two-digit number first is
 * the personnel, a later one the back and the hole; gun / pistol / under center; rt / lt; known tags and
 * concepts (any other word is kept as a tag).
 */
export function parseCall(text: string): CallParts {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const parts: CallParts = {};
  const tags: string[] = [];
  const concepts = [...RUN_CONCEPTS, ...PASS_CONCEPTS];
  const canon = (list: string[], w: string) => list.find((x) => x.toLowerCase() === w.toLowerCase());
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const lw = w.toLowerCase();
    // Two-word concepts ("play action", "sprint out", "drop back", "jet pass").
    const two = i + 1 < words.length ? canon(concepts, `${w} ${words[i + 1]}`) : undefined;
    if (two) {
      parts.concept = two;
      i++;
      continue;
    }
    if (/^\d{2}$/.test(w)) {
      if (i === 0 && !parts.personnel) parts.personnel = w;
      else if (!parts.back) {
        parts.back = w[0];
        parts.hole = w[1];
      }
      continue;
    }
    if (/^(gun|shotgun|sg)$/.test(lw)) parts.qb = 'Gun';
    else if (/^(pistol|pis)$/.test(lw)) parts.qb = 'Pistol';
    else if (/^(uc|under|center)$/.test(lw)) parts.qb = 'UC';
    else if (/^(rt|right|r)$/.test(lw)) parts.strength = 'R';
    else if (/^(lt|left|l)$/.test(lw)) parts.strength = 'L';
    else if (canon(concepts, w)) parts.concept = canon(concepts, w);
    else {
      const t = canon(TAGS, w) || w.charAt(0).toUpperCase() + w.slice(1);
      if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
    }
  }
  if (tags.length) parts.tags = tags;
  return parts;
}

/** The play names already made in these plays (each once, with its parts), most used first. */
export function savedNames(plays: Play[]): { name: string; parts: CallParts; count: number }[] {
  const by = new Map<string, { name: string; parts: CallParts; count: number }>();
  for (const p of plays) {
    const name = String(p.callName || '').trim();
    if (!name || !p.callParts) continue;
    const key = name.toLowerCase();
    const cur = by.get(key);
    if (cur) cur.count += 1;
    else by.set(key, { name, parts: p.callParts, count: 1 });
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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
