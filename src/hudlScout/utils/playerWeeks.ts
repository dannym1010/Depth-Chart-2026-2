// Each player's numbers week by week (for the season charts): the box score of every week's games, put side by
// side per player. A week with two games adds them up; a game with no week gets a column of its own.
import type { Play } from '../types/football';
import { boxScore, type CallTypeOf } from './gameStats';

export type PlayerMetric = 'all' | 'rush' | 'rec' | 'pass';

export interface WeekLine {
  rushAtt: number;
  rushYds: number;
  rec: number;
  targets: number;
  recYds: number;
  passAtt: number;
  passComp: number;
  passYds: number;
  td: number;
}

export interface WeekColumn {
  key: string;
  /** "Wk 3", "Pre 4", "Playoffs". */
  label: string;
  /** The games in it (shown on hover). */
  games: string[];
}

export interface PlayerWeeks {
  name: string;
  weeks: Record<string, WeekLine>;
  total: WeekLine;
  /** Weeks he had the ball (or threw it). */
  played: number;
}

const empty = (): WeekLine => ({ rushAtt: 0, rushYds: 0, rec: 0, targets: 0, recYds: 0, passAtt: 0, passComp: 0, passYds: 0, td: 0 });

/** Season order: pre-season, the weeks, playoffs, championship, then games with no week. */
export function weekOrder(key: string): number {
  const k = String(key || '').toLowerCase();
  const pre = k.match(/^pre-?(\d+)$/);
  if (pre) return Number(pre[1]) - 100;
  if (/^\d+$/.test(k)) return Number(k);
  if (/playoff/.test(k)) return 500;
  if (/champ/.test(k)) return 600;
  return 1000;
}

export function weekLabel(key: string): string {
  const k = String(key || '');
  const pre = k.match(/^pre-?(\d+)$/i);
  if (pre) return `Pre ${pre[1]}`;
  if (/^\d+$/.test(k)) return `Wk ${k}`;
  if (/playoff/i.test(k)) return 'Playoffs';
  if (/champ/i.test(k)) return 'Champ';
  return k;
}

/** The number a chart shows for a line: yards, by what's picked. */
export function metricYards(l: WeekLine, m: PlayerMetric): number {
  return m === 'rush' ? l.rushYds : m === 'rec' ? l.recYds : m === 'pass' ? l.passYds : l.rushYds + l.recYds;
}

/** Times he had a chance at those yards: carries, catches, both, or passes thrown. */
export function metricTouches(l: WeekLine, m: PlayerMetric): number {
  return m === 'rush' ? l.rushAtt : m === 'rec' ? l.rec : m === 'pass' ? l.passAtt : l.rushAtt + l.rec;
}

export function playerWeeks(
  plays: Play[],
  games: { id: string; name: string; week?: string }[],
  callTypeOf?: CallTypeOf
): { columns: WeekColumn[]; players: PlayerWeeks[] } {
  const groups = new Map<string, { label: string; ids: Set<string>; names: string[] }>();
  for (const g of games) {
    const key = g.week ? String(g.week) : `game:${g.id}`;
    const cur = groups.get(key) || { label: g.week ? weekLabel(String(g.week)) : g.name, ids: new Set<string>(), names: [] };
    cur.ids.add(g.id);
    cur.names.push(g.name);
    groups.set(key, cur);
  }
  const keys = [...groups.keys()].sort((a, b) => weekOrder(a) - weekOrder(b) || a.localeCompare(b));
  const columns: WeekColumn[] = [];
  const byName = new Map<string, PlayerWeeks>();
  const lineOf = (name: string, key: string) => {
    let p = byName.get(name);
    if (!p) byName.set(name, (p = { name, weeks: {}, total: empty(), played: 0 }));
    return (p.weeks[key] ||= empty());
  };
  for (const key of keys) {
    const g = groups.get(key)!;
    const mine = plays.filter((p) => p.odk === 'O' && (g.ids.has(String(p.gameId)) || (!p.gameId && games.length === 1)));
    if (!mine.length) continue;
    columns.push({ key, label: g.label, games: g.names });
    const box = boxScore(mine, callTypeOf);
    for (const r of box.rushing) Object.assign(lineOf(r.name, key), { rushAtt: r.att, rushYds: r.yds, td: lineOf(r.name, key).td + r.td });
    for (const r of box.receiving) Object.assign(lineOf(r.name, key), { rec: r.rec, targets: r.targets, recYds: r.yds, td: lineOf(r.name, key).td + r.td });
    for (const r of box.passing) Object.assign(lineOf(r.name, key), { passAtt: r.att, passComp: r.comp, passYds: r.yds });
  }
  for (const p of byName.values()) {
    for (const w of Object.values(p.weeks)) {
      for (const k of Object.keys(p.total) as (keyof WeekLine)[]) p.total[k] += w[k];
      if (w.rushAtt || w.targets || w.passAtt) p.played += 1;
    }
  }
  return { columns, players: [...byName.values()] };
}
