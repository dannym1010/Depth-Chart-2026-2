// One play log for our film: the self-scout upload is the list of plays PFF grades.
// These helpers translate between the two play shapes, find the formation behind a tagged call,
// and build each play's lineup from that week's depth chart.
import type { FilmPlayerRef, FilmUnitColor, FormationBoard, HudlImportedPlay, PlacedPlayer, RosterPlayer } from '../types';
import type { Play } from '../hudlScout/types/football';
import type { ScoutBundle } from '../hudlScout/scoutBundle';
import type { ScoutGame } from '../hudlScout/components/Header';
import { autoDetectColumnMapping, normalizeHudlRow } from '../hudlScout/utils/csvParser';
import { FilmSlotDef, DEPTH_COLOR_BY_INDEX, matchFilmSlotId } from './hudlFilmImport';
import type { PprGroup, PprSide } from './pprGroups';
import { defenseFrontOfCall, personnelOfCall } from './playbookImport';

/** A self-scout play, as the PFF screen reads it. Same id, so grades stay attached. */
export function scoutPlayToFilmPlay(p: Play): HudlImportedPlay {
  const odk = p.odk === 'O' ? 'offense' : p.odk === 'D' ? 'defense' : 'special';
  return {
    id: p.id,
    playNumber: String(p.playNumber),
    odk,
    quarter: p.quarter ? String(p.quarter) : '',
    down: p.down ? String(p.down) : '',
    distance: p.down ? String(p.distance) : '',
    yardLine: p.rawYardLine || '',
    hash: p.hash || '',
    series: p.series != null ? String(p.series) : '',
    gain: p.gainLoss != null ? String(p.gainLoss) : '',
    result: p.result || '',
    playType: p.rawPlayType || (p.playType === 'SPECIAL' ? '' : p.playType),
    playDir: p.direction || '',
    rusher: p.carrierOrTarget || '',
    playCall: p.playCall,
    playCallId: p.playCallId,
  };
}

/** An older PFF-only upload, as a self-scout play (keeps the PFF play id so grades stay attached). */
export function filmPlayToScoutPlay(fp: HudlImportedPlay, index: number, gameId: string, unit?: FilmUnitColor): Play {
  const row: Record<string, string> = {
    'PLAY #': fp.playNumber || String(index + 1),
    ODK: fp.odk === 'offense' ? 'O' : fp.odk === 'defense' ? 'D' : 'K',
    QTR: fp.quarter || '',
    DN: fp.down || '',
    DIST: fp.distance || '',
    'YARD LN': fp.yardLine || '',
    HASH: fp.hash || '',
    SERIES: fp.series || '',
    'GN/LS': fp.gain || '',
    RESULT: fp.result || '',
    'PLAY TYPE': fp.playType || '',
    'PLAY DIR': fp.playDir || '',
    EFF: fp.efficient || '',
  };
  const mapping = autoDetectColumnMapping(Object.keys(row));
  const play = normalizeHudlRow(row, mapping, index);
  return {
    ...play,
    id: fp.id,
    gameId,
    carrierOrTarget: play.carrierOrTarget || fp.rusher || fp.passer || '',
    ...(unit ? { unit } : {}),
  };
}

/** Same game uploaded twice (self-scout and PFF)? Same play numbers in the same order. */
function sameGame(a: { playNumber: string | number }[], b: { playNumber: string | number }[]): boolean {
  if (!a.length || a.length !== b.length) return false;
  return a.every((p, i) => String(p.playNumber) === String(b[i].playNumber));
}

/**
 * Move a week's PFF-only film into the shared play log. If the same game is already in self-scout
 * (same play numbers), its unit and play-call tags are copied onto these plays and the duplicate removed.
 */
export function moveFilmIntoSharedLog(
  bundle: ScoutBundle,
  filmPlays: HudlImportedPlay[],
  colors: Record<string, FilmUnitColor | undefined>,
  week: string,
  gameName: string,
  now = Date.now()
): { bundle: ScoutBundle; mergedDuplicate?: string } {
  const gameId = `game-${now}`;
  let plays = filmPlays.map((fp, i) => filmPlayToScoutPlay(fp, i, gameId, colors[fp.id]));
  let games = bundle.games;
  let others = bundle.plays;
  let mergedDuplicate: string | undefined;
  const duplicate = bundle.games.find((g) => {
    const gp = bundle.plays.filter((p) => (p.gameId ? p.gameId === g.id : bundle.games[0]?.id === g.id));
    return sameGame(gp, plays);
  });
  if (duplicate) {
    const dupPlays = bundle.plays.filter((p) => (p.gameId ? p.gameId === duplicate.id : bundle.games[0]?.id === duplicate.id));
    plays = plays.map((p, i) => {
      const d = dupPlays[i];
      return {
        ...p,
        unit: p.unit || d.unit,
        ...(d.playCallId
          ? { playCallId: d.playCallId, playCall: d.playCall, untaggedName: p.playName, untaggedFormation: p.formation, playName: d.playName, formation: d.formation }
          : {}),
      };
    });
    games = games.filter((g) => g.id !== duplicate.id);
    others = others.filter((p) => !dupPlays.includes(p));
    mergedDuplicate = duplicate.name;
  }
  const game: ScoutGame = { id: gameId, name: duplicate?.name || gameName, playCount: plays.length, addedAt: now, week };
  return {
    bundle: {
      ...bundle,
      plays: [...others, ...plays],
      games: [...games, game],
      datasetName: bundle.datasetName || game.name,
      sourceCleared: false,
      updatedAt: now,
    },
    mergedDuplicate,
  };
}

// ---------------------------------------------------------------------------
// Lineups from the week's depth chart
// ---------------------------------------------------------------------------

/**
 * The depth-chart formation a tagged call is run from: "32 R WISHBONE 26 DIVE" -> "32 Offense",
 * "4-4 BASE STACK RIP" -> "44 Defense".
 */
export function formationForCall(call: string | undefined, formations: FormationBoard[] | undefined, side: PprSide): FormationBoard | undefined {
  if (!call || !formations?.length) return undefined;
  const boards = formations.filter((f) => f.unit === side);
  if (side === 'offense') {
    const personnel = personnelOfCall(call);
    if (!personnel) return undefined;
    return boards.find((f) => new RegExp(`^${personnel}\\b`).test(f.name.trim()));
  }
  const front = defenseFrontOfCall(call).replace('-', '');
  if (!front) return undefined;
  return boards.find((f) => f.name.replace(/-/g, '').replace(/\s+/g, ' ').trim().startsWith(front));
}

/** Which grading group a depth-chart slot name belongs to. */
export function groupForSlotName(name: string, side: PprSide): PprGroup {
  const n = String(name || '').toUpperCase();
  const t = n.replace(/\(.*?\)/g, ' ').replace(/[^A-Z0-9 ]/g, ' ').trim();
  const has = (re: RegExp) => re.test(t) || re.test(n);
  if (side === 'offense') {
    if (has(/\b(LT|LG|C|RG|RT|OL|T|G|CENTER|GUARD|TACKLE)\b/)) return 'OL';
    if (has(/\b(QB|1)\b/)) return 'QB';
    if (has(/\b(RB|FB|HB|TB|2|3|4|5)\b/)) return 'RB';
    return 'WR';
  }
  if (has(/\b(WDE|SDE|DE|DE ?\d|E|E5|E9|END)\b/)) return 'DE';
  if (has(/\b(DT|NT|NG|T1|T3|DT ?\d|TACKLE|NOSE)\b/)) return 'DT';
  if (has(/\b(CB|FS|SS|C|CORNER|SAFETY|CB ?\d)\b/)) return 'DB';
  return 'LB';
}

function refFor(placed: PlacedPlayer | undefined, byNum: Map<string, RosterPlayer>): FilmPlayerRef | null {
  if (!placed?.num || placed.num === '?') return null;
  const r = byNum.get(String(placed.num).trim());
  return r
    ? { num: String(r.num).trim(), id: r.id, name: `${r.firstName || ''} ${r.lastName || ''}`.trim() }
    : { num: String(placed.num).trim(), name: placed.name };
}

/**
 * The 11 on the field for a play run from `board`, for the Black (1s) / Gold (2s) / Blue (3s) unit,
 * straight from that week's depth chart. Slot ids use the standard PFF ids where they match (QB, LT, WDE...)
 * so a coach's per-play changes still line up.
 */
export function lineupFromFormation(
  board: FormationBoard,
  depthChart: Record<string, PlacedPlayer[]> | undefined,
  roster: RosterPlayer[],
  color: FilmUnitColor,
  side: PprSide
): { slot: FilmSlotDef; player: FilmPlayerRef | null }[] {
  const depth = Math.max(0, DEPTH_COLOR_BY_INDEX.indexOf(color));
  const byNum = new Map<string, RosterPlayer>();
  roster.forEach((r) => r.num && byNum.set(String(r.num).trim(), r));
  const used = new Set<string>();
  const out: { slot: FilmSlotDef; player: FilmPlayerRef | null }[] = [];
  for (const row of board.rows || []) {
    for (const pos of row.positions || []) {
      if (!pos) continue;
      const label = pos.name || pos.tag || '';
      let id = matchFilmSlotId(label, side) || '';
      if (!id || used.has(id)) id = label.toUpperCase().replace(/[^A-Z0-9]/g, '') || pos.id;
      if (used.has(id)) id = `${id}_${pos.id}`;
      used.add(id);
      out.push({
        slot: { id, name: label, group: groupForSlotName(label, side), aliases: [] },
        player: refFor(depthChart?.[pos.id]?.[depth], byNum),
      });
    }
  }
  return out;
}
