// Who is playing and how they did, from our play log: snaps come from each play's lineup
// (that week's depth chart for the unit on the field, plus subs), touches from Hudl's
// rusher / passer / receiver columns.
import type { RosterPlayer } from '../types';
import type { Play } from '../hudlScout/types/football';
import type { FilmLineup } from './filmLineup';
import { jerseyOf } from './filmLineup';
import { isDefensiveStop } from '../hudlScout/utils/unitStats';
import { defPlayFrom } from '../hudlScout/utils/csvParser';
import type { DefEvent } from '../hudlScout/types/football';

/** Sack / TFL / INT... on a defense play: what a coach marked, else what the result says. */
export function defEventsOf(p: Play): DefEvent[] {
  if (p.defPlay?.events?.length) return p.defPlay.events;
  return (defPlayFrom(p.result, Number(p.gainLoss) || 0, p.playType)?.events || []) as DefEvent[];
}

export interface PlayerFilmLine {
  num: string;
  name: string;
  offSnaps: number;
  defSnaps: number;
  /** Team success rate on offense plays this player was on the field for. */
  onFieldSuccess: number;
  onFieldYards: number;
  carries: number;
  rushYds: number;
  targets: number;
  recYds: number;
  passes: number;
  passYds: number;
  /** Plays with the ball in his hands that stayed on schedule. */
  touchSuccess: number;
  explosive: number;
  touchdowns: number;
  /** Defense: plays made. Events count for the player credited with the tackle. */
  tackles: number;
  assists: number;
  sacks: number;
  tfl: number;
  ints: number;
  ff: number;
  fr: number;
  pbu: number;
  /** Share of his defensive snaps where the offense did not stay on schedule. */
  stopRate: number;
  /** Yards the offense gained per play while he was on the field. */
  yardsAllowedPerSnap: number;
  /** Where he lines up most on offense / defense ("QB", "LT"...). */
  spots: string[];
  defSpots: string[];
}

const isSnap = (p: Play) =>
  (p.odk === 'O' || p.odk === 'D') && p.playType !== 'PENALTY' && !/\bpenalty\b|\btimeout\b/i.test(p.result || '');

export function playerFilmStats(
  plays: Play[],
  lineupFor: (play: Play) => FilmLineup | null,
  roster: RosterPlayer[]
): { players: PlayerFilmLine[]; offSnaps: number; defSnaps: number; withLineup: number } {
  const byNum = new Map<string, RosterPlayer>();
  roster.forEach((r) => r.num && byNum.set(String(r.num).trim(), r));
  const lines = new Map<string, PlayerFilmLine & { _onOff: number; _onOffGood: number; _touch: number; _spots: Map<string, number>; _defSpots: Map<string, number>; _stops: number; _allowed: number }>();
  const line = (num: string, label?: string) => {
    let l = lines.get(num);
    if (!l) {
      const r = byNum.get(num);
      l = {
        num,
        name: r ? `${r.firstName || ''} ${r.lastName || ''}`.trim() : String(label || '').replace(/^#\s*\d+\s*/, '') || `#${num}`,
        offSnaps: 0,
        defSnaps: 0,
        onFieldSuccess: 0,
        onFieldYards: 0,
        carries: 0,
        rushYds: 0,
        targets: 0,
        recYds: 0,
        passes: 0,
        passYds: 0,
        touchSuccess: 0,
        explosive: 0,
        touchdowns: 0,
        spots: [],
        defSpots: [],
        tackles: 0,
        assists: 0,
        sacks: 0,
        tfl: 0,
        ints: 0,
        ff: 0,
        fr: 0,
        pbu: 0,
        stopRate: 0,
        yardsAllowedPerSnap: 0,
        _stops: 0,
        _allowed: 0,
        _onOff: 0,
        _onOffGood: 0,
        _touch: 0,
        _spots: new Map(),
        _defSpots: new Map(),
      };
      lines.set(num, l);
    }
    return l;
  };
  let offSnaps = 0;
  let defSnaps = 0;
  let withLineup = 0;
  for (const p of plays) {
    if (!isSnap(p)) continue;
    const gain = Number(p.gainLoss) || 0;
    const td = /\btd\b|touchdown/i.test(p.result || '');
    if (p.odk === 'O') offSnaps++;
    else defSnaps++;
    const lu = lineupFor(p);
    if (lu?.slots.length) withLineup++;
    const seen = new Set<string>();
    for (const s of lu?.slots || []) {
      const num = String(s.player?.num || '').trim();
      if (!num || seen.has(num)) continue;
      seen.add(num);
      const l = line(num, s.player?.name);
      const spotMap = p.odk === 'O' ? l._spots : l._defSpots;
      spotMap.set(s.slot.name, (spotMap.get(s.slot.name) || 0) + 1);
      if (p.odk === 'O') {
        l.offSnaps++;
        l._onOff++;
        l.onFieldYards += gain;
        if (p.isEfficient) l._onOffGood++;
      } else {
        l.defSnaps++;
        l._allowed += gain;
        if (isDefensiveStop(p)) l._stops++;
      }
    }
    if (p.odk === 'D') {
      const maker = jerseyOf(p.defPlay?.maker);
      const assist = jerseyOf(p.defPlay?.assist);
      if (maker) {
        const l = line(maker, p.defPlay?.maker);
        l.tackles++;
        for (const e of defEventsOf(p)) {
          if (e === 'sack') l.sacks++;
          else if (e === 'tfl') l.tfl++;
          else if (e === 'int') l.ints++;
          else if (e === 'ff') l.ff++;
          else if (e === 'fr') l.fr++;
          else if (e === 'pbu') l.pbu++;
        }
      }
      if (assist && assist !== maker) line(assist, p.defPlay?.assist).assists++;
      continue;
    }
    if (p.odk !== 'O') continue;
    const touch = (label: string | undefined, kind: 'rush' | 'rec' | 'pass') => {
      const num = jerseyOf(label);
      if (!num) return;
      const l = line(num, label);
      if (kind === 'rush') {
        l.carries++;
        l.rushYds += gain;
      } else if (kind === 'rec') {
        l.targets++;
        l.recYds += gain;
      } else {
        l.passes++;
        l.passYds += gain;
      }
      if (kind !== 'pass') {
        l._touch++;
        if (p.isEfficient) l.touchSuccess++;
        if (gain >= 10 || p.isExplosive) l.explosive++;
        if (td) l.touchdowns++;
      }
    };
    touch(p.rusher, 'rush');
    touch(p.receiver, 'rec');
    touch(p.passer, 'pass');
  }
  const players = [...lines.values()].map((l) => {
    const { _onOff, _onOffGood, _touch, _spots, _defSpots, _stops, _allowed, ...rest } = l;
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 2);
    return {
      ...rest,
      onFieldSuccess: _onOff ? Math.round((_onOffGood / _onOff) * 100) : 0,
      touchSuccess: _touch ? Math.round((l.touchSuccess / _touch) * 100) : 0,
      stopRate: l.defSnaps ? Math.round((_stops / l.defSnaps) * 100) : 0,
      yardsAllowedPerSnap: l.defSnaps ? Math.round((_allowed / l.defSnaps) * 10) / 10 : 0,
      spots: top(_spots),
      defSpots: top(_defSpots),
    };
  });
  players.sort((a, b) => b.offSnaps + b.defSnaps - (a.offSnaps + a.defSnaps) || b.carries + b.targets - (a.carries + a.targets));
  return { players, offSnaps, defSnaps, withLineup };
}
