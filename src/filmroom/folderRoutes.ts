// One shared film folder for every team ("Mahopac Film"), and how a game finds its clips in it:
//   Mahopac Film / 10U / Week 3 - Shrub Oak /            <- our game (the week it's set to in Hudl Scout)
//   Mahopac Film / 10U / Scouting / Week 5 - Wappingers /  <- film of the team we play that week
// Team folders are the age group ("10U"); game folders start with the week ("Week 3", "Pre-Season Week 4",
// "Playoffs", "Championship"); the rest of the name is for people. Two folders in one week: the one whose
// name shares words with the game wins.

export interface FolderLike {
  name: string;
}

/** "Week 3 - Shrub Oak" -> "3", "Pre-Season Week 4 - Brewster" -> "pre-4", "Playoffs - Carmel" -> "playoffs". */
export function weekKeyFromFolder(name: string): string | undefined {
  const s = String(name || '').toLowerCase();
  let m = s.match(/pre[\s-]*season\s*(?:week|wk)?\s*(\d+)/);
  if (m) return `pre-${Number(m[1])}`;
  m = s.match(/\b(?:week|wk)\s*(\d+)/);
  if (m) return String(Number(m[1]));
  if (/playoff/.test(s)) return 'playoffs';
  if (/championship|\bfinal/.test(s)) return 'championship';
  return undefined;
}

/** The app's week keys ("3", "Week 3", "team_10u__week_3", "pre-4") in the same form. */
export function normalizeWeek(week?: string): string {
  let s = String(week || '').trim();
  if (s.includes('__week_')) s = s.split('__week_').pop() || '';
  s = s.replace(/^week\s*/i, '').trim().toLowerCase();
  const pre = s.match(/^pre-?(?:season)?[\s-]*(?:week)?\s*(\d+)$/);
  if (pre) return `pre-${Number(pre[1])}`;
  if (/^\d+$/.test(s)) return String(Number(s));
  return s;
}

/** "10U Youth Tackle" -> "10u". */
export const teamAgeOf = (teamName: string) => {
  const m = String(teamName || '').match(/\b(\d{1,2})\s*u\b/i);
  return m ? `${Number(m[1])}u` : '';
};

const squash = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The team's folder: its age group ("10U") or its full name. */
export function pickTeamFolder<T extends FolderLike>(dirs: T[], teamName: string): T | undefined {
  const full = dirs.find((d) => squash(d.name) === squash(teamName));
  if (full) return full;
  const age = teamAgeOf(teamName);
  if (!age) return undefined;
  return dirs.find((d) => teamAgeOf(d.name) === age && squash(d.name).startsWith(age));
}

/** A folder of team folders (10U, 9U, ...): the shared film folder, not one game's clips. */
export const isFilmRoot = (dirs: FolderLike[]) => dirs.some((d) => /^\s*\d{1,2}\s*u\b/i.test(d.name));

export const isScoutingFolder = (name: string) => /^\s*scout/i.test(name);

const STOP = new Set(['vs', 'v', 'at', 'the', 'and', 'msa', 'mahopac', 'game', 'week', 'wk', 'film', 'copy', 'scrimmage', 'pre', 'season']);
/** Words that tell games apart ("MSA vs Shrub Oak" -> shrub, oak). */
export const hintWords = (...texts: (string | undefined)[]) =>
  [...new Set(texts.flatMap((t) => String(t || '').toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+u?$/.test(w)))];

/** The folder sharing the most words with the game (none if no word matches). */
export function pickByHints<T extends FolderLike>(dirs: T[], hints: string[]): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const d of dirs) {
    const name = String(d.name).toLowerCase();
    const score = hints.filter((w) => name.includes(w)).length;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** The one folder sharing the most words with the game; none when two tie (better no film than the wrong film). */
export function onlyBest<T extends FolderLike>(dirs: T[], hints: string[]): T | undefined {
  const scored = dirs.map((d) => ({ d, score: hints.filter((w) => String(d.name).toLowerCase().includes(w)).length }));
  const top = Math.max(0, ...scored.map((s) => s.score));
  const best = scored.filter((s) => s.score === top);
  return top > 0 && best.length === 1 ? best[0].d : undefined;
}

/** The week's folder; with two in one week, the one that shares words with the game. */
export function pickWeekFolder<T extends FolderLike>(dirs: T[], week: string | undefined, hints: string[]): T | undefined {
  const w = normalizeWeek(week);
  if (!w) return undefined;
  const found = dirs.filter((d) => weekKeyFromFolder(d.name) === w);
  if (found.length <= 1) return found[0];
  return pickByHints(found, hints) || found[0];
}

/** "3" -> "Week 3", "pre-4" -> "Pre-Season Week 4" (for messages). */
export function weekFolderLabel(week?: string): string {
  const w = normalizeWeek(week);
  if (/^pre-\d+$/.test(w)) return `Pre-Season Week ${w.split('-')[1]}`;
  if (/^\d+$/.test(w)) return `Week ${w}`;
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
}

/** A folder the resolver can look inside (a Drive folder or a folder on this computer). */
/** A Hudl breakdown file (CSV / Excel) in a folder. */
export interface SheetFile {
  name: string;
  get: () => Promise<Blob>;
}
export const isBreakdownName = (name: string) => /\.(csv|xlsx|xls|xlsm)$/i.test(String(name || '')) && !/^~\$/.test(name);

export interface FolderNode extends FolderLike {
  open: () => Promise<{ dirs: FolderNode[]; videos: number; sheets?: SheetFile[] }>;
  /** Google Drive folder id, or the folder on this computer. */
  driveId?: string;
  handle?: any;
}

/** Camera-view folder names ("Sideline", "End Zone", "Wide", "Tight", "All-22", ...). */
const VIEW_NAME = /side\s*line|sideline|end\s*zone|endzone|\bez\b|\bsl\b|\bwide\b|\btight\b|all.?22|press\s*box|\bhigh\b|\blow\b|drone|sky|\bangle|\bview|\bcam(era)?\b|\bcoach/i;
export const isViewName = (name: string) => VIEW_NAME.test(String(name || ''));

/** Dates in a name, the same whichever way they're written: "9/14", "09-14", "2025-09-14", "9.14" -> "9-14". */
export function dateKeys(text: string): string[] {
  const s = String(text || '');
  const out = new Set<string>();
  for (const m of s.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) out.add(`${Number(m[2])}-${Number(m[3])}`);
  for (const m of s.matchAll(/\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?\b/g)) {
    const [mo, d] = [Number(m[1]), Number(m[2])];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.add(`${mo}-${d}`);
  }
  return [...out];
}

/**
 * The folder that best fits the game: shared words ("Carmel", "Somers") count 1 each, the same date counts 2.
 * Nothing when nothing matches or two folders tie.
 */
export function bestGameFolder<T extends FolderLike>(dirs: T[], gameText: string, extraHints: string[] = []): T | undefined {
  const words = [...new Set([...hintWords(gameText), ...extraHints])];
  const dates = dateKeys(gameText);
  const scored = dirs.map((d) => {
    const name = String(d.name).toLowerCase();
    const folderDates = dateKeys(d.name);
    return { d, score: words.filter((w) => name.includes(w)).length + 2 * dates.filter((k) => folderDates.includes(k)).length };
  });
  const top = Math.max(0, ...scored.map((x) => x.score));
  const best = scored.filter((x) => x.score === top);
  return top > 0 && best.length === 1 ? best[0].d : undefined;
}

export type Resolved =
  /** The game's folder (its clips, or its camera-view folders). `siblings`: the other game folders that week. */
  | { node: FolderNode; path: string[]; siblings?: string[] }
  | { missing: string; path: string[] }
  /** The week has several game folders and nothing says which is this game: a coach picks once. */
  | { choices: FolderNode[]; path: string[] };

/**
 * Find a game's folder inside the shared film folder.
 * `pick`: the folder a coach chose for this game (when the week has several game folders).
 */
export async function resolveGameFolder(
  root: FolderNode,
  game: { source: 'own' | 'opponent'; week?: string; name: string },
  teamName: string,
  opponentName?: string,
  pick?: string
): Promise<Resolved> {
  const path = [root.name];
  const top = await root.open();
  const team = pickTeamFolder(top.dirs, teamName);
  const age = teamAgeOf(teamName).toUpperCase();
  if (!team) return { missing: `a "${age || teamName}" folder in "${root.name}"`, path };
  path.push(team.name);
  let here = await team.open();
  if (game.source === 'opponent') {
    const scouting = here.dirs.find((d) => isScoutingFolder(d.name));
    if (!scouting) return { missing: `a "Scouting" folder in "${team.name}"`, path };
    path.push(scouting.name);
    here = await scouting.open();
  }
  const hints = hintWords(game.name, game.source === 'opponent' ? opponentName : undefined);
  // The game's week first; if that week has no folder (or the game has no week), the one folder named for
  // the opponent ("MSA vs Yorktown" -> "Week 2 - Yorktown Huskers").
  const weekDir =
    pickWeekFolder(here.dirs, game.week, hints) ||
    onlyBest(here.dirs.filter((d) => !isScoutingFolder(d.name)), hintWords(game.name, opponentName));
  if (!weekDir) {
    return normalizeWeek(game.week)
      ? { missing: `a "${weekFolderLabel(game.week)} - ..." folder in "${path[path.length - 1]}"`, path }
      : { missing: 'the week this game was played (set it on the game in Hudl Scout)', path };
  }
  path.push(weekDir.name);
  const inside = await weekDir.open();
  // Folders inside the week's folder are camera views ("Sideline", "End Zone") of this game, or, when
  // they aren't named like views, one folder per game (several scouting games in a week).
  const gameDirs = inside.dirs
    .filter((d) => !isViewName(d.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  if (inside.videos || !gameDirs.length) return { node: weekDir, path };
  const chosen =
    (pick && gameDirs.find((d) => d.name === pick)) ||
    bestGameFolder(gameDirs, game.name) ||
    (gameDirs.length === 1 ? gameDirs[0] : undefined);
  if (!chosen) return { choices: gameDirs, path };
  path.push(chosen.name);
  return { node: chosen, path, siblings: gameDirs.length > 1 ? gameDirs.map((d) => d.name) : undefined };
}

/** A Hudl breakdown file found in a game's folder: that game's plays, to add to Hudl Scout. */
export interface FolderBreakdown {
  source: 'own' | 'opponent';
  /** The week key ("3", "pre-4"). */
  week: string;
  gameName: string;
  /** Fixed for the folder, so the same folder never adds a game twice (on any coach's device). */
  id: string;
  path: string[];
  sheet: SheetFile;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/** "Week 5 - Wappingers Wildcats" -> "Wappingers Wildcats". */
export const afterWeek = (name: string) =>
  String(name || '').replace(/^.*?\b(?:week|wk)\s*\d+\s*[-–:]?\s*|^\s*(?:playoffs?|championship)\s*[-–:]?\s*/i, '').trim();
/** Several files: the one named like a breakdown ("... Hudl breakdown.csv"), else the first. */
const pickSheet = (sheets: SheetFile[]) => sheets.find((s) => /breakdown|hudl|export/i.test(s.name)) || sheets[0];

/** Every game folder of the team that holds a breakdown file (our games, and scouting games by week). */
export async function findBreakdowns(root: FolderNode, teamName: string): Promise<FolderBreakdown[]> {
  const out: FolderBreakdown[] = [];
  const top = await root.open();
  const team = pickTeamFolder(top.dirs, teamName);
  if (!team) return out;
  const t = await team.open();
  const add = (source: 'own' | 'opponent', week: string, gameName: string, path: string[], sheets?: SheetFile[]) => {
    if (!sheets?.length) return;
    out.push({ source, week, gameName, path, id: `folder-${source}-${slug(path.join(' '))}`, sheet: pickSheet(sheets) });
  };
  for (const wk of t.dirs) {
    const week = !isScoutingFolder(wk.name) && weekKeyFromFolder(wk.name);
    if (!week) continue;
    add('own', week, wk.name, [team.name, wk.name], (await wk.open()).sheets);
  }
  const scouting = t.dirs.find((d) => isScoutingFolder(d.name));
  if (scouting) {
    for (const wk of (await scouting.open()).dirs) {
      const week = weekKeyFromFolder(wk.name);
      if (!week) continue;
      const inside = await wk.open();
      add('opponent', week, wk.name, [team.name, scouting.name, wk.name], inside.sheets);
      // Several of their games that week: a folder each ("vs Carmel 9-14").
      for (const g of inside.dirs.filter((d) => !isViewName(d.name))) {
        add('opponent', week, `${afterWeek(wk.name)} ${g.name}`.trim(), [team.name, scouting.name, wk.name, g.name], (await g.open()).sheets);
      }
    }
  }
  return out;
}

/** A game's camera views: its own clips ("Film"), and each folder inside with clips ("Sideline", "End Zone"). */
export async function gameViews(node: FolderNode): Promise<FolderNode[]> {
  const { dirs, videos } = await node.open();
  const withClips: FolderNode[] = [];
  for (const d of dirs) {
    if ((await d.open()).videos) withClips.push(d);
  }
  // Sideline first (the usual main view), then the rest in name order.
  withClips.sort((a, b) => Number(/side/i.test(b.name)) - Number(/side/i.test(a.name)) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  return videos ? [node, ...withClips] : withClips;
}

/** A game folder with film in it, found in the shared film folder (with or without a Hudl breakdown). */
export interface FilmFolderGame {
  source: 'own' | 'opponent';
  /** The week key ("3", "pre-4"). */
  week: string;
  name: string;
  /** Fixed for the folder, the same on every coach's device. */
  id: string;
  path: string[];
}

/** A folder with film in it that couldn't be placed in the season, and why. */
export interface UnplacedFolder {
  path: string[];
  reason: string;
}

/**
 * Every game folder of the team that has film in it (video directly, or in its camera-view folders),
 * and the folders with film that can't be placed (no "Week 3" in the name). The film library lists
 * these even when the game has no Hudl breakdown yet.
 */
export async function findFilmFolders(root: FolderNode, teamName: string): Promise<{ games: FilmFolderGame[]; unplaced: UnplacedFolder[] }> {
  const games: FilmFolderGame[] = [];
  const unplaced: UnplacedFolder[] = [];
  const top = await root.open();
  const team = pickTeamFolder(top.dirs, teamName);
  if (!team) return { games, unplaced };
  const hasFilm = async (node: FolderNode, inside?: { dirs: FolderNode[]; videos: number }) => {
    const here = inside || (await node.open());
    if (here.videos) return true;
    for (const d of here.dirs) if ((await d.open()).videos) return true;
    return false;
  };
  const t = await team.open();
  const add = (source: 'own' | 'opponent', week: string, name: string, path: string[]) =>
    games.push({ source, week, name, path, id: `film-${source}-${slug(path.join(' '))}` });

  for (const wk of t.dirs) {
    if (isScoutingFolder(wk.name)) continue;
    const week = weekKeyFromFolder(wk.name);
    if (!(await hasFilm(wk))) continue;
    if (week) add('own', week, wk.name, [team.name, wk.name]);
    else unplaced.push({ path: [team.name, wk.name], reason: 'No "Week 3" (or "Pre-Season Week 3", "Playoffs") at the start of the folder name.' });
  }
  const scouting = t.dirs.find((d) => isScoutingFolder(d.name));
  if (scouting) {
    for (const wk of (await scouting.open()).dirs) {
      const inside = await wk.open();
      const week = weekKeyFromFolder(wk.name);
      const path = [team.name, scouting.name, wk.name];
      if (!(await hasFilm(wk, inside))) continue;
      if (!week) {
        unplaced.push({ path, reason: 'No "Week 5" at the start of the folder name, so the week is unknown.' });
        continue;
      }
      const gameDirs = inside.dirs.filter((d) => !isViewName(d.name));
      // Video right in the week's folder: one game. Otherwise a folder for each game that week.
      if (inside.videos || !gameDirs.length) add('opponent', week, wk.name, path);
      else for (const g of gameDirs) if (await hasFilm(g)) add('opponent', week, `${afterWeek(wk.name)} ${g.name}`.trim(), [...path, g.name]);
    }
  }
  return { games, unplaced };
}
