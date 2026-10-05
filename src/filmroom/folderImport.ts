// Breakdown files in the film folder: a Hudl breakdown (CSV / Excel / Google Sheet) sitting in a game's
// folder is added to Hudl Scout as that game's plays, so film and play log arrive together. Each folder
// makes one game at most (a fixed id), on every coach's device; a game a coach removed stays removed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { addFolderGame, bundleFromSaved, type ScoutBundle } from '../hudlScout/scoutBundle';
import type { Play } from '../hudlScout/types/football';
import { autoDetectColumnMapping, isSpreadsheetFilename, normalizeHudlRow, parseCsvRows, workbookBufferToCsv } from '../hudlScout/utils/csvParser';
import { autoTagFromHudl } from '../hudlScout/utils/playTags';
import type { PlayDatabaseEntry } from '../types/callSheet';
import { findBreakdowns, findFilmFolders, type FilmFolderGame, type FolderNode, type UnplacedFolder } from './folderRoutes';

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
  getRootNode: () => Promise<FolderNode | undefined>;
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
  onFilmFolders?: (found: { games: FilmFolderGame[]; unplaced: UnplacedFolder[] }) => void;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const latest = useRef(opts);
  latest.current = opts;

  const check = useCallback(async (force = false) => {
    const o = latest.current;
    const key = o.teamName;
    if (!force && Date.now() - (lastRun.get(key) || 0) < 120_000) return;
    const root = await o.getRootNode();
    if (!root) return; // no film folder reachable yet (not linked, or needs a tap / Google sign-in)
    lastRun.set(key, Date.now());
    setChecking(true);
    try {
      // Film folders first (cheap to show), then the breakdown files that add games with plays.
      try {
        o.onFilmFolders?.(await findFilmFolders(root, o.teamName));
      } catch (err) {
        console.warn('Looking for game folders with film:', err);
      }
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
        if (target.games.some((g) => g.id === f.id) || (target.deletedGameIds || []).includes(f.id)) continue;
        let plays: Play[];
        try {
          plays = await readBreakdown(f.sheet.name, await f.sheet.get());
        } catch {
          continue; // unreadable file: try again next time
        }
        const r = addFolderGame(target, plays, { id: f.id, name: f.gameName, week: f.week });
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

  return { added, checking, checkNow: () => check(true) };
}
