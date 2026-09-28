// Before each team kept its own data, opening another team copied 10U's wristband, call sheet and
// Hudl film into it. Those copies are recognised here (exact matches with 10U's), so another team
// shows as brand new instead of showing 10U's plays.
import { findSameGame } from '../hudlScout/scoutBundle';

const clean = (s: unknown) => String(s || '').trim().toUpperCase();

/** The plays on a wristband, in order ('' when it has none). */
export function wristbandSignature(wb: any): string {
  const texts: string[] = [];
  for (const band of wb?.wristbands || []) for (const col of band?.columns || []) for (const p of col?.plays || []) texts.push(clean(p?.text));
  return texts.some(Boolean) ? texts.join('|') : '';
}

/** The plays on a call sheet, in order ('' when it has none). */
export function callSheetSignature(cs: any): string {
  const names: string[] = [];
  for (const s of [...(cs?.offenseSections || []), ...(cs?.defenseSections || [])]) for (const p of s?.plays || []) names.push(clean(p?.name));
  return names.some(Boolean) ? names.join('|') : '';
}

/** Signatures of every wristband / call sheet 10U has (any week), plus the built-in 10U card. */
export function primarySheetSignatures(weeklyData: Record<string, any>, extraWristbands: any[] = []): { wristbands: Set<string>; callSheets: Set<string> } {
  const wristbands = new Set<string>();
  const callSheets = new Set<string>();
  for (const [key, week] of Object.entries(weeklyData || {})) {
    const is10U = !key.includes('__week_') || key.toLowerCase().replace(/-/g, '_').startsWith('team_10u__');
    if (!is10U) continue;
    const w = wristbandSignature(week?.wristbandData);
    if (w) wristbands.add(w);
    const c = callSheetSignature(week?.callSheetData);
    if (c) callSheets.add(c);
  }
  extraWristbands.forEach((wb) => {
    const w = wristbandSignature(wb);
    if (w) wristbands.add(w);
  });
  return { wristbands, callSheets };
}

/** Slot -> play for a wristband ("card#column#row") or call sheet ("section#row"), filled slots only. */
export function wristbandSlots(wb: any): Map<string, string> {
  const m = new Map<string, string>();
  (wb?.wristbands || []).forEach((band: any, b: number) =>
    (band?.columns || []).forEach((col: any, c: number) =>
      (col?.plays || []).forEach((p: any, r: number) => {
        const t = clean(p?.text);
        if (t) m.set(`${b}#${c}#${r}`, t);
      })
    )
  );
  return m;
}
export function callSheetSlots(cs: any): Map<string, string> {
  const m = new Map<string, string>();
  for (const sec of [...(cs?.offenseSections || []), ...(cs?.defenseSections || [])]) {
    (sec?.plays || []).forEach((p: any, r: number) => {
      const t = clean(p?.name);
      if (t) m.set(`${sec?.id}#${r}`, t);
    });
  }
  return m;
}

/**
 * True when `mine` is (nearly) one of `theirs`: at least 90% of its filled slots hold the same play
 * in the same slot. A sheet a team built itself doesn't line up slot for slot like that.
 */
export function isNearCopy(mine: Map<string, string>, theirs: Map<string, string>[], threshold = 0.9): boolean {
  if (!mine.size) return false;
  return theirs.some((t) => {
    if (!t.size) return false;
    let same = 0;
    mine.forEach((play, slot) => {
      if (t.get(slot) === play) same++;
    });
    return same / mine.size >= threshold;
  });
}

/** Every wristband / call sheet 10U has (any week), as slot maps. */
export function primarySheetSlots(weeklyData: Record<string, any>, extraWristbands: any[] = []): { wristbands: Map<string, string>[]; callSheets: Map<string, string>[] } {
  const wristbands: Map<string, string>[] = [];
  const callSheets: Map<string, string>[] = [];
  for (const [key, week] of Object.entries(weeklyData || {})) {
    const is10U = !key.includes('__week_') || key.toLowerCase().replace(/-/g, '_').startsWith('team_10u__');
    if (!is10U) continue;
    const w = wristbandSlots(week?.wristbandData);
    if (w.size) wristbands.push(w);
    const c = callSheetSlots(week?.callSheetData);
    if (c.size) callSheets.push(c);
  }
  extraWristbands.forEach((wb) => {
    const w = wristbandSlots(wb);
    if (w.size) wristbands.push(w);
  });
  return { wristbands, callSheets };
}

/**
 * Another team's film without the games copied from 10U's. The copied games are listed as removed,
 * so the next save cleans them out for good.
 */
export function withoutCopiedGames(bundle: any, primary: any): any {
  if (!bundle || !Array.isArray(bundle.games) || !bundle.games.length || !primary?.games?.length) return bundle;
  const copied = bundle.games.filter((g: any) => {
    const plays = (bundle.plays || []).filter((p: any) => p?.gameId === g.id);
    return plays.length > 0 && Boolean(findSameGame(primary, plays));
  });
  if (!copied.length) return bundle;
  const gone = new Set(copied.map((g: any) => g.id));
  return {
    ...bundle,
    games: bundle.games.filter((g: any) => !gone.has(g.id)),
    plays: (bundle.plays || []).filter((p: any) => !gone.has(p?.gameId)),
    deletedGameIds: [...new Set([...(bundle.deletedGameIds || []), ...gone])],
  };
}

/** Another team's opponent report for a week that is just 10U's report for that week. */
export function isCopiedScoutReport(report: any, primaryReport: any): boolean {
  const plays = Array.isArray(report?.plays) ? report.plays : [];
  const theirs = Array.isArray(primaryReport?.plays) ? primaryReport.plays : [];
  if (!plays.length || !theirs.length || plays.length !== theirs.length) return false;
  const sig = (list: any[]) => list.map((p) => `${p?.playNumber}|${p?.odk}|${p?.down}|${p?.distance}|${p?.gainLoss}`).join(',');
  return sig(plays) === sig(theirs);
}
