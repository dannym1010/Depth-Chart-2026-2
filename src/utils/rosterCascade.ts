// A roster edit carried into every week's depth and scrimmage charts: a kid's new name, or new jersey number.
import type { PlacedPlayer, RosterPlayer, WeekState } from '../types';
import { changedSpots, stampSpots } from './depthStamps';

const teamOf = (t?: string) => String(t || 'team_10u').replace(/-/g, '_');
/** Team + jersey number (what a depth chart spot knows a kid by). */
const numKey = (teamId: string | undefined, num: unknown) => `${teamOf(teamId)}#${String(num ?? '').trim()}`;
const nameOf = (p: RosterPlayer) => `${String(p.firstName || '').trim()} ${String(p.lastName || '').trim()}`.trim().toLowerCase();
export const displayName = (p: RosterPlayer) => (p.rosterName || p.lastName || `${p.firstName} ${p.lastName}`).trim();

/**
 * Kids whose jersey number changed in this edit: the same id, or (players have no id) the same team and first and
 * last name, with a different number. Old key -> new number. Two kids swapping numbers are both in it.
 */
export function renumberedPlayers(prev: RosterPlayer[], next: RosterPlayer[]): Map<string, string> {
  const same = (q: RosterPlayer, p: RosterPlayer) =>
    teamOf(q.teamId) === teamOf(p.teamId) && (p.id ? q.id === p.id : !q.id && Boolean(nameOf(q)) && nameOf(q) === nameOf(p));
  const out = new Map<string, string>();
  for (const p of next.filter(Boolean)) {
    const was = prev.filter((q) => q && same(q, p));
    // Two kids with the same name on a team: not sure which is which, leave them.
    if (was.length !== 1 || next.filter((n) => n && same(was[0], n)).length !== 1) continue;
    const from = String(was[0].num ?? '').trim();
    const to = String(p.num ?? '').trim();
    if (from && to && from !== to) out.set(numKey(was[0].teamId, from), to);
  }
  return out;
}

/**
 * Every week's charts with the roster's names and the new numbers. The spots that changed are stamped as edited
 * now (so the change wins over another coach's older copy) and listed by week.
 */
export function cascadeRosterToWeeks(
  weekly: Record<string, WeekState>,
  roster: RosterPlayer[],
  renumbered: Map<string, string>,
  now: number
): { weekly: Record<string, WeekState>; changed: Record<string, { d: string[]; s: string[] }> } {
  const names = new Map<string, string>();
  for (const p of roster) if (p) names.set(numKey(p.teamId, p.num), displayName(p));
  // A spot left with a number that's no longer on the roster (changed before this carried numbers over): the one
  // kid on that team with that name, if there's exactly one.
  const byName = new Map<string, string | null>();
  for (const p of roster) {
    if (!p) continue;
    const k = `${teamOf(p.teamId)}|${displayName(p).toLowerCase()}`;
    byName.set(k, byName.has(k) ? null : String(p.num).trim());
  }
  const changed: Record<string, { d: string[]; s: string[] }> = {};
  let any = false;
  const next = { ...weekly };
  for (const wKey of Object.keys(weekly)) {
    const w = weekly[wKey];
    if (!w) continue;
    // The team this week belongs to (plain week keys are 10U's).
    const team = wKey.includes('__week_') ? wKey.split('__week_')[0] : 'team_10u';
    const fix = (p: PlacedPlayer): PlacedPlayer => {
      if (!p || !p.num) return p;
      const lost = !names.has(numKey(team, p.num)) ? byName.get(`${team}|${String(p.name || '').trim().toLowerCase()}`) : undefined;
      const to = renumbered.get(numKey(team, p.num)) ?? (lost || undefined);
      const num = to ?? p.num;
      const name = names.get(numKey(team, num)) ?? p.name;
      return num === p.num && name === p.name ? p : { ...p, num, name };
    };
    const chart = (c?: Record<string, PlacedPlayer[]>) => {
      if (!c) return c;
      let touched = false;
      const out: Record<string, PlacedPlayer[]> = {};
      for (const [pos, players] of Object.entries(c)) {
        if (!Array.isArray(players)) {
          out[pos] = players;
          continue;
        }
        const fixed = players.map(fix);
        touched ||= fixed.some((p, i) => p !== players[i]);
        out[pos] = fixed.some((p, i) => p !== players[i]) ? fixed : players;
      }
      return touched ? out : c;
    };
    const depthChart = chart(w.depthChart);
    const scrimmageChart = chart(w.scrimmageChart);
    if (depthChart === w.depthChart && scrimmageChart === w.scrimmageChart) continue;
    const d = changedSpots(w.depthChart, depthChart);
    const s = changedSpots(w.scrimmageChart, scrimmageChart);
    changed[wKey] = { d, s };
    any = true;
    next[wKey] = {
      ...w,
      ...(depthChart ? { depthChart } : {}),
      ...(scrimmageChart ? { scrimmageChart } : {}),
      depthEditedAt: stampSpots(stampSpots(w.depthEditedAt, d, 'd', now), s, 's', now),
    };
  }
  return { weekly: any ? next : weekly, changed };
}
