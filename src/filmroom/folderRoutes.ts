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
export interface FolderNode extends FolderLike {
  open: () => Promise<{ dirs: FolderNode[]; videos: number }>;
  /** Google Drive folder id, or the folder on this computer. */
  driveId?: string;
  handle?: any;
}

export type Resolved = { node: FolderNode; path: string[] } | { missing: string; path: string[] };

/** Find a game's clip folder inside the shared film folder. */
export async function resolveGameFolder(
  root: FolderNode,
  game: { source: 'own' | 'opponent'; week?: string; name: string },
  teamName: string,
  opponentName?: string
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
  // Two of an opponent's games in one week: a folder for each inside the week's folder.
  const inside = await weekDir.open();
  if (!inside.videos && inside.dirs.length) {
    const sub = pickByHints(inside.dirs, hintWords(game.name)) || (inside.dirs.length === 1 ? inside.dirs[0] : undefined);
    if (sub) {
      path.push(sub.name);
      return { node: sub, path };
    }
  }
  return { node: weekDir, path };
}
