// Breakdown files in the film folder: a Hudl breakdown (CSV / Excel / Google Sheet) sitting in a game's
// folder is added to Hudl Scout as that game's plays, so film and play log arrive together. Each folder
// makes one game at most (a fixed id), on every coach's device; a game a coach removed stays removed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { addFolderGame, bundleFromSaved, isBlankFilmGame, mergeGamePlays, type ScoutBundle } from '../hudlScout/scoutBundle';
import type { Play } from '../hudlScout/types/football';
import { autoDetectColumnMapping, isSpreadsheetFilename, normalizeHudlRow, parseCsvRows, workbookBufferToCsv } from '../hudlScout/utils/csvParser';
import { autoTagFromHudl } from '../hudlScout/utils/playTags';
import type { PlayDatabaseEntry } from '../types/callSheet';
import { findBreakdowns, findFilmFolders, sameFolderGame, type FilmFolderGame, type FolderNode, type UnplacedFolder } from './folderRoutes';
import { sameGamePlays } from '../utils/weekMove';

/** A breakdown file's plays, read the same way as a Hudl Scout upload. */
export async function readBreakdown(name: string, blob: Blob): Promise<Play[]> {
  const csv = isSpreadsheetFilename(name) ? workbookBufferToCsv(await blob.arrayBuffer()) : await blob.text();
  const { headers, rows } = parseCsvRows(csv);
  if (!rows.length) return [];
  const mapping = autoDetectColumnMapping(headers);
  return rows.map((r, i) => normalizeHudlRow(r, mapping, i)) as Play[];
}

// Files already looked at that didn't make a game (the same game was uploaded by hand, or no plays):
// folder id -> file name, so they aren't downloaded again.
const SEEN_KEY = 'footballFilmroomBreakdownsSeen';
const loadSeen = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {};
  } catch {
    return {};
  }
};
const saveSeen = (s: Record<string, string>) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};
const lastRun = new Map<string, number>();

export function useFolderBreakdowns(opts: {
  /** The film folders that can be read now (this computer's first); `ask` prompts for this computer's (a click). */
  getRootNodes: (ask: boolean) => Promise<{ nodes: FolderNode[]; localBlocked: boolean }>;
  /** Changes when a film folder becomes available (so the check runs then). */
  rootKey: string;
  teamName: string;
  own: ScoutBundle;
  weeks: { key: string; opponent: string; hudlScout?: any }[];
  currentWeek: string;
  opponentScout?: unknown;
  playDatabase?: PlayDatabaseEntry[];
  onUpdateOwnTeamScout: (bundle: ScoutBundle) => void;
  onSaveWeekScouting?: (week: string, hudlScout: any) => void;
  /** Every game folder with film in it, and the folders that couldn't be placed (film with no breakdown yet). */
  /** `partial`: this computer's film folder couldn't be read, so what it had before is kept. */
  onFilmFolders?: (found: { games: FilmFolderGame[]; unplaced: UnplacedFolder[] }, partial: boolean) => void;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  // This computer's film folder is linked but the browser wants a click before it can be read again.
  const [localBlocked, setLocalBlocked] = useState(false);
  // What the last check found, and where it looked (shown in the library).
  const [lastCheck, setLastCheck] = useState<{ at: number; from: string[]; games: string[] } | null>(null);
  const latest = useRef(opts);
  latest.current = opts;

  const check = useCallback(async (force = false) => {
    const o = latest.current;
    const key = o.teamName;
    if (!force && Date.now() - (lastRun.get(key) || 0) < 120_000) return;
    const { nodes, localBlocked: blocked } = await o.getRootNodes(force);
    setLocalBlocked(blocked);
    const root = nodes[0];
    if (!root) {
      // No film folder reachable yet (not linked, or needs a tap / Google sign-in): a click says so.
      if (force) setLastCheck({ at: Date.now(), from: [], games: [] });
      return;
    }
    lastRun.set(key, Date.now());
    setChecking(true);
    try {
      // Film folders first (cheap to show), then the breakdown files that add games with plays. Games from every
      // folder that can be read (a game only on this computer's drive, or only on Google Drive, still shows).
      const folders: { games: FilmFolderGame[]; unplaced: UnplacedFolder[] } = { games: [], unplaced: [] };
      let read = 0;
      const readFrom: string[] = [];
      for (const node of nodes) {
        try {
          const r = await findFilmFolders(node, o.teamName);
          read += 1;
          readFrom.push(node.driveId ? 'Google Drive' : 'this computer');
          for (const g of r.games) if (!folders.games.some((x) => x.id === g.id)) folders.games.push(g);
          for (const u of r.unplaced) if (!folders.unplaced.some((x) => x.path.join('/') === u.path.join('/'))) folders.unplaced.push(u);
        } catch (err) {
          console.warn('Looking for game folders with film:', err);
        }
      }
      if (read) o.onFilmFolders?.(folders, blocked || read < nodes.length);
      if (read) setLastCheck({ at: Date.now(), from: readFrom, games: folders.games.map((g) => `${g.source === 'own' ? 'Ours' : 'Scouting'} · ${g.name}`) });
      const found = await findBreakdowns(root, o.teamName);
      const seen = loadSeen();
      const notes: string[] = [];
      let own = o.own;
      const newOwnIds = new Set<string>();
      const weeks = new Map<string, { saved: any; bundle: ScoutBundle; changed: boolean }>();
      for (const f of found) {
        if (seen[f.id] === f.sheet.name) continue;
        let target: ScoutBundle;
        if (f.source === 'own') target = own;
        else {
          if (!weeks.has(f.week)) {
            const w = o.weeks.find((x) => x.key === f.week);
            const saved = f.week === o.currentWeek ? o.opponentScout : w?.hudlScout;
            weeks.set(f.week, { saved, bundle: bundleFromSaved(saved, w?.opponent || 'Opponent'), changed: false });
          }
          target = weeks.get(f.week)!.bundle;
        }
        if ((target.deletedGameIds || []).includes(f.id)) continue;
        // The film came in first: the Film Room made this game with a blank play per clip. Its breakdown fills it in.
        const filmGame = target.games.find((g) => g.id === f.id || sameFolderGame(g.id, f.id));
        if (filmGame && !isBlankFilmGame(target, filmGame)) continue;
        let plays: Play[];
        try {
          plays = await readBreakdown(f.sheet.name, await f.sheet.get());
        } catch {
          continue; // unreadable file: try again next time
        }
        // The same breakdown as a game the week already has (its folder renamed, "Week 9 - Carmel" -> "Playoffs -
        // Carmel"): that game, with the coaches' tags, is the one; this file isn't added again.
        if (!filmGame && target.games.some((g) => sameGamePlays(target.plays.filter((p) => p.gameId === g.id), plays))) {
          seen[f.id] = f.sheet.name;
          continue;
        }
        const r = filmGame
          ? plays.length ? { bundle: mergeGamePlays(target, f.id, plays), added: true } : { bundle: target, added: false }
          : addFolderGame(target, plays, { id: f.id, name: f.gameName, week: f.week });
        if (!r.added) {
          seen[f.id] = f.sheet.name;
          continue;
        }
        notes.push(`${f.path.slice(1).join(' › ')} (${plays.length} plays)`);
        if (f.source === 'own') {
          own = r.bundle;
          r.bundle.plays.filter((p) => p.gameId === f.id).forEach((p) => newOwnIds.add(p.id));
        } else {
          const w = weeks.get(f.week)!;
          w.bundle = r.bundle;
          w.changed = true;
        }
      }
      if (newOwnIds.size) {
        // Tag the new plays from the play Hudl says was called, like an upload in Hudl Scout.
        if (o.playDatabase?.length) own = { ...own, plays: autoTagFromHudl(own.plays, o.playDatabase, newOwnIds).plays };
        o.onUpdateOwnTeamScout(own);
      }
      for (const [week, w] of weeks) {
        if (!w.changed || !o.onSaveWeekScouting) continue;
        const opponent = o.weeks.find((x) => x.key === week)?.opponent || '';
        o.onSaveWeekScouting(week, {
          ...((w.saved as object) || {}),
          plays: w.bundle.plays,
          games: w.bundle.games,
          datasetName: w.bundle.datasetName || opponent,
          deletedGameIds: w.bundle.deletedGameIds,
          sourceCleared: false,
          updatedAt: Date.now(),
        });
      }
      saveSeen(seen);
      if (notes.length) setAdded((a) => [...notes, ...a].slice(0, 6));
    } catch (err) {
      console.warn('Checking the film folder for breakdown files:', err);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (opts.rootKey) void check();
  }, [opts.rootKey, opts.teamName, check]);

  return { added, checking, localBlocked, lastCheck, checkNow: () => check(true) };
}
