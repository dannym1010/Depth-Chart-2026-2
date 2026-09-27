// Reading play names out of Hudl playbooks (and spreadsheets / pasted lists) and merging
// them into the Play Bank. Everything here is plain data in, plain data out, so it can be
// tested without a browser. The PDF / OCR reading lives in playbookPdf.ts.
import type { PlayAssignment, PlayDatabaseEntry, PlayType } from '../types/callSheet';
import { inferFormation, extractPersonnel } from './wristbandLinking';

export type PlayUnit = 'offense' | 'defense';

/** The play's diagram cut from a Hudl install page (the picture itself stays in the browser until saved). */
export interface DiagramDraft {
  hash: string;
  previewUrl?: string;
  blob?: Blob;
}

/** One play (or section heading) found in an import, before it goes into the Play Bank. */
export interface PlayDraft {
  name: string;
  key: string;
  unit: PlayUnit;
  type: PlayType;
  formation: string;
  /** Hudl section heading this play sits under ("NOW SCREENS"). */
  category?: string;
  install?: string;
  assignments?: PlayAssignment[];
  notes?: string;
  /** A heading like "PLAY ACTION PASS", not a play. The coach can still keep it as a play. */
  isSection?: boolean;
  /** Where in the source it was found (page or row), for the preview. */
  where?: string;
  order: number;
  diagram?: DiagramDraft;
  /** Set once the diagram is saved, just before the drafts go into the Play Bank. */
  diagramUrl?: string;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Compare play names without caring about spaces, case or punctuation ("21R 24 DIVE" = "21 R 24 dive"). */
export function playNameKey(name: string): string {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Tidy a name as read from a file: single spaces, no stray symbols at the ends. */
export function tidyPlayName(raw: string): string {
  return String(raw || '')
    // Icon glyphs from printed web pages (private-use characters) and zero-width marks.
    .replace(/[\uE000-\uF8FF\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/[↕⇕⬍⇕↕•·▪►▶]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:|.,;]+|[\s\-–—:|,;]+$/g, '')
    .trim();
}

/**
 * Fix what text recognition tends to get wrong at the front of a call: "211 26 DIVE" is "21L 26 DIVE",
 * "21| 26" / "21I 26" too. Personnel is two digits followed by R or L.
 */
export function fixOcrCall(name: string): string {
  return tidyPlayName(name).replace(/^(\d{2})[1Il|](?=\s)/, '$1L').replace(/^(\d{2})[Rr](?=\s)/, '$1R');
}

/** A heading such as "NOW SCREENS" or "PLAY ACTION PASS": short, no numbers, all capitals. */
export function isSectionName(name: string): boolean {
  const n = tidyPlayName(name);
  if (!n || /\d/.test(n)) return false;
  const words = n.split(' ');
  if (words.length > 5) return false;
  const letters = n.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
}

const DEFENSE_FRONT = /^(4-4|44|5-3|53|6-2|62|4-3|43|3-4|34|3-3|33|6-1|5-2|52)\b/;
const DEFENSE_WORDS =
  /\b(STACK|BLITZ|COVER|COVERAGE|LIZ|RIP|DOG|STUNT|STING|BLOW|PINCH|FAN|ANGLE|FIRE|STORM|BEAR|SHELL|MAN|ZONE DROP|CROSS FIRE|CROSSFIRE|GOAL LINE WALL|FRONT)\b/;

export function inferPlayUnit(name: string): PlayUnit {
  const n = tidyPlayName(name).toUpperCase();
  if (DEFENSE_FRONT.test(n)) return 'defense';
  // Offensive calls start with personnel + direction ("21 R", "32 L WISHBONE").
  if (/^\d{2}\s*[RL]\b/.test(n)) return 'offense';
  if (DEFENSE_WORDS.test(n) && !/\b(PASS|DIVE|SWEEP|POWER|COUNTER|TOSS|KEEP|BOOT)\b/.test(n)) return 'defense';
  return 'offense';
}

export function inferPlayType(name: string, unit: PlayUnit): PlayType {
  const n = ` ${tidyPlayName(name).toUpperCase()} `;
  if (unit === 'defense') {
    if (/\b(BLITZ|DOG|FIRE|STING|STORM|SHOOT|BLOW|CROSS ?FIRE|MUG)\b/.test(n)) return 'blitz';
    return 'coverage';
  }
  if (/\b(REVERSE|FLEA|STATUE|DOUBLE PASS|HALFBACK PASS|HB PASS|TRICK)\b/.test(n)) return 'trick';
  if (/\b(SCREEN|BUBBLE|SMOKE|TUNNEL|NOW)\b/.test(n)) return 'screen';
  if (/\b(BOOT|PLAY ACTION|PA)\b/.test(n) || /\b(POWER|DIVE|ZONE|COUNTER|SWEEP|TOSS) PASS\b/.test(n)) return 'play_action';
  if (/\b(PASS|GO|GO-OUT|OUT|SLANT|HITCH|POST|CORNER|FLOOD|SLIDE|ROLL|SPRINT|DROP|CURL|FADE|STICK|MESH|SEAM|WHEEL)\b/.test(n)) {
    return 'pass';
  }
  return 'run';
}

/**
 * The formation part of a call, for matching a depth-chart formation: "32 R WISHBONE 26 DIVE" -> "32 R WISHBONE".
 * Stops at the first word that is part of the play itself (a hole number, FAKE, a route...).
 */
const FORMATION_WORDS = new Set([
  'TWIN', 'TWINS', 'WISHBONE', 'BONE', 'TRIPS', 'SLOT', 'WING', 'WINGS', 'TIGHT', 'SPREAD', 'EMPTY', 'GUN',
  'SHOTGUN', 'PISTOL', 'I', 'PRO', 'DOUBLE', 'BUNCH', 'TREY', 'TRIO', 'FLEX', 'FULL', 'HEAVY', 'JUMBO',
  'UNBALANCED', 'ACE', 'DEUCE', 'STACK', 'NASTY', 'OVER', 'UNDER', 'STRONG', 'WEAK', 'OFFSET', 'SPLIT',
  'R', 'L', 'RT', 'LT', 'RIGHT', 'LEFT',
]);
export function formationOfCall(name: string): string {
  const words = tidyPlayName(name).toUpperCase().split(' ');
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (i === 0 && /^\d{2}[RL]?$/.test(w)) {
      // "21R" -> "21 R"
      out.push(w.slice(0, 2));
      if (w.length === 3) out.push(w[2]);
      continue;
    }
    if (FORMATION_WORDS.has(w)) {
      out.push(w);
      continue;
    }
    break;
  }
  return out.join(' ');
}

/** The front a defensive call is played from ("4-4", "53"). */
export function defenseFrontOfCall(name: string): string {
  const m = tidyPlayName(name).toUpperCase().match(DEFENSE_FRONT);
  return m ? m[1] : '';
}

/** Personnel number at the front of a call ("21", "32"), used to find the depth-chart formation. */
export function personnelOfCall(name: string): string {
  const m = tidyPlayName(name).match(/^(\d{2})(?=\s|[RL]\b|$)/i);
  return m ? m[1] : '';
}

// ---------------------------------------------------------------------------
// Position assignments ("Z  Stalk", "1  Toss To 3, Boot Away")
// ---------------------------------------------------------------------------

const POSITION_TOKENS = new Set([
  'QB', 'Q', '1', '2', '3', '4', '5', 'X', 'Y', 'Y1', 'Y2', 'Z', 'W', 'H', 'F', 'A', 'B', 'PST', 'PSG', 'C', 'BSG',
  'BST', 'LT', 'LG', 'RG', 'RT', 'TE', 'FB', 'HB', 'TB', 'RB', 'WR', 'SLOT', 'E', 'E5', 'E9', 'T', 'T1', 'T3', 'N',
  'NT', 'DT', 'DE', 'S', 'M', 'R', 'FS', 'SS', 'CB', 'LB', 'MLB', 'WLB', 'SLB', 'ROV', 'LS', 'K', 'P', 'PP', 'G',
]);
// What OCR tends to make of short labels.
const POSITION_FIXES: Record<string, string> = { CC: 'C', '0': 'Q', O: 'Q', '|': '1', l: '1', I: '1', '[9': 'C' };

export function parseAssignmentLines(text: string): PlayAssignment[] {
  const out: PlayAssignment[] = [];
  const seen = new Set<string>();
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (!m) continue;
    let pos = POSITION_FIXES[m[1]] || m[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
    pos = POSITION_FIXES[pos] || pos;
    if (!POSITION_TOKENS.has(pos)) continue;
    const job = m[2].replace(/^[\s\-–—:|]+/, '').trim();
    if ((job.match(/[A-Za-z]/g) || []).length < 3) continue;
    if (seen.has(pos)) continue;
    seen.add(pos);
    out.push({ pos, text: job });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

export interface ListEntry {
  index?: number;
  name: string;
  where?: string;
}

/**
 * A printed Hudl playbook / install page: rows of "number  play name". Returns the plays in order
 * and the install name from the "All Installs / 2026 10U Install" title when it is there.
 */
export function parseHudlListPages(pages: PdfTextItem[][]): { install?: string; entries: ListEntry[] } {
  let install: string | undefined;
  const entries: ListEntry[] = [];
  const seenIndex = new Set<number>();
  pages.forEach((items, pageIdx) => {
    const clean = items.filter((it) => it.str && it.str.trim());
    const titleIdx = clean.findIndex((it) => /^All Installs$/i.test(it.str.trim()));
    if (titleIdx >= 0 && !install) {
      const title = clean.find((it) => /^\/\s*\S/.test(it.str.trim()) && Math.abs(it.y - clean[titleIdx].y) < 4);
      if (title) install = title.str.replace(/^\/\s*/, '').trim();
    }
    // Rows: items that share a baseline (within 4pt).
    const rows: PdfTextItem[][] = [];
    [...clean].sort((a, b) => b.y - a.y || a.x - b.x).forEach((it) => {
      const row = rows.find((r) => Math.abs(r[0].y - it.y) < 4);
      if (row) row.push(it);
      else rows.push([it]);
    });
    rows.forEach((row) => {
      row.sort((a, b) => a.x - b.x);
      const first = row[0].str.trim();
      if (!/^\d{1,3}$/.test(first)) return;
      const rest = tidyPlayName(row.slice(1).map((r) => r.str).join(' '));
      if (!rest || !/[A-Za-z]/.test(rest)) return;
      const index = Number(first);
      if (seenIndex.has(index)) return;
      seenIndex.add(index);
      entries.push({ index, name: rest, where: `page ${pageIdx + 1}` });
    });
  });
  entries.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return { install, entries };
}

const CHROME_LINES = /^(hudl|home|watch now|upload|playbook|offensive|defensive|more|view tutorials|edit|print|preview|present|export|delete install|plays( \(\d+\))?|installs( \(\d+\))?|all installs.*|add plays|activity|drag this icon.*|this install is shared with.*|add recipients.*|\d+ plays)$/i;

/**
 * A pasted list (from Hudl, a spreadsheet column, notes...). Accepts "12. 21 R 32 POWER", "12 ⇕ 21 R 32 POWER",
 * or just the names. A leading number is only treated as a list number when it clearly is one.
 */
export function parseLooseList(text: string): ListEntry[] {
  const entries: ListEntry[] = [];
  let expected = 1;
  String(text || '')
    .split(/\r?\n/)
    .forEach((rawLine, lineIdx) => {
      let line = tidyPlayName(rawLine.replace(/\t+/g, ' '));
      if (!line || CHROME_LINES.test(line) || /^\d{1,3}$/.test(line)) return;
      const m = line.match(/^(\d{1,3})\s*([.):\-]|\s)\s*(.+)$/);
      if (m) {
        const n = Number(m[1]);
        const rest = m[3];
        const hasSeparator = m[2].trim() !== '';
        const restLooksLikeCall = /^\d/.test(rest);
        const restStartsWithDirection = /^[RL]\b/.test(rest);
        const numberedHeading = n <= 200 && !restStartsWithDirection && isSectionName(rest);
        if (hasSeparator || restLooksLikeCall || numberedHeading || (n === expected && !restStartsWithDirection)) {
          line = tidyPlayName(rest);
          expected = n + 1;
        }
      }
      if (line) entries.push({ name: line, where: `line ${lineIdx + 1}` });
    });
  return entries;
}

function headerKey(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * A spreadsheet of plays. Finds the name column ("Play", "Play Name", "OFF PLAY"...) and, when present,
 * formation / side / section / notes. A Hudl breakdown export gives its distinct OFF PLAY values.
 */
export function parsePlaySheet(rows: unknown[][]): { entries: (ListEntry & { unit?: PlayUnit; formation?: string; category?: string; notes?: string })[] } {
  const cleanRows = rows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim()));
  if (!cleanRows.length) return { entries: [] };
  const header = cleanRows[0].map(headerKey);
  const find = (...names: string[]) => header.findIndex((h) => names.includes(h));
  let nameCol = find('offplay', 'defplay', 'playname', 'play', 'name', 'call', 'playcall', 'title', 'plays');
  const formCol = find('offform', 'formation', 'form', 'offformation');
  const sideCol = find('odk', 'unit', 'side', 'odside');
  const catCol = find('category', 'section', 'group', 'series', 'install');
  const notesCol = find('notes', 'note', 'description', 'coachingpoints');
  let body = cleanRows.slice(1);
  if (nameCol < 0) {
    // No header row: the names are the first column with letters in it.
    nameCol = 0;
    body = cleanRows;
  }
  const seen = new Set<string>();
  const entries: (ListEntry & { unit?: PlayUnit; formation?: string; category?: string; notes?: string })[] = [];
  body.forEach((r, i) => {
    const name = tidyPlayName(String(r[nameCol] ?? ''));
    if (!name || !/[A-Za-z]/.test(name)) return;
    const key = playNameKey(name);
    if (seen.has(key)) return;
    seen.add(key);
    const sideRaw = sideCol >= 0 ? String(r[sideCol] ?? '').trim().toUpperCase() : '';
    const unit: PlayUnit | undefined =
      sideRaw === 'D' || sideRaw.startsWith('DEF') ? 'defense' : sideRaw === 'O' || sideRaw.startsWith('OFF') ? 'offense' : undefined;
    entries.push({
      name,
      where: `row ${i + 2}`,
      unit,
      formation: formCol >= 0 ? tidyPlayName(String(r[formCol] ?? '')) || undefined : undefined,
      category: catCol >= 0 ? tidyPlayName(String(r[catCol] ?? '')) || undefined : undefined,
      notes: notesCol >= 0 ? String(r[notesCol] ?? '').trim() || undefined : undefined,
    });
  });
  return { entries };
}

// ---------------------------------------------------------------------------
// Drafts -> Play Bank
// ---------------------------------------------------------------------------

export interface DraftInput {
  name: string;
  where?: string;
  unit?: PlayUnit;
  formation?: string;
  category?: string;
  assignments?: PlayAssignment[];
  notes?: string;
  diagram?: DiagramDraft;
}

/**
 * Turn names found in a source into drafts. Section headings become the section of the plays under them.
 * Duplicate names inside one import are merged (assignments from any copy are kept).
 */
export function buildDrafts(inputs: DraftInput[], opts: { install?: string; unit?: PlayUnit } = {}): PlayDraft[] {
  const drafts: PlayDraft[] = [];
  const byKey = new Map<string, PlayDraft>();
  let section: string | undefined;
  // A heading covers the plays right under it, until the play family changes ("21 ..." -> "32 ...").
  let sectionFamily: string | undefined;
  inputs.forEach((input, i) => {
    const name = tidyPlayName(input.name);
    if (!name) return;
    const key = playNameKey(name);
    if (!key) return;
    if (isSectionName(name) && !input.assignments?.length) {
      section = name;
      sectionFamily = undefined;
      if (drafts.some((d) => d.isSection && d.key === key)) return;
      drafts.push({
        name,
        key,
        unit: opts.unit || input.unit || 'offense',
        type: 'run',
        formation: '',
        isSection: true,
        where: input.where,
        order: i,
      });
      return;
    }
    const family = personnelOfCall(name) || inferPlayUnit(name);
    if (section) {
      if (sectionFamily === undefined) sectionFamily = family;
      else if (family !== sectionFamily) section = undefined;
    }
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.assignments?.length && input.assignments?.length) existing.assignments = input.assignments;
      if (!existing.diagram && input.diagram) existing.diagram = input.diagram;
      if (!existing.category && (input.category || section)) existing.category = input.category || section;
      return;
    }
    const unit = input.unit || opts.unit || inferPlayUnit(name);
    const draft: PlayDraft = {
      name,
      key,
      unit,
      type: inferPlayType(name, unit),
      formation: input.formation || (unit === 'offense' ? formationOfCall(name) : defenseFrontOfCall(name)) || inferFormation(name, unit),
      category: input.category || section,
      install: opts.install,
      assignments: input.assignments?.length ? input.assignments : undefined,
      notes: input.notes,
      where: input.where,
      order: i,
      diagram: input.diagram,
    };
    byKey.set(key, draft);
    drafts.push(draft);
  });
  return drafts;
}

export interface MergeResult {
  next: PlayDatabaseEntry[];
  added: PlayDatabaseEntry[];
  updated: PlayDatabaseEntry[];
  unchanged: PlayDatabaseEntry[];
}

/** Two diagram fingerprints differ enough to call it a changed drawing (not just a re-render). */
export function diagramsDiffer(a?: string, b?: string): boolean {
  if (!a || !b) return Boolean(a) !== Boolean(b);
  if (a.length !== b.length) return true;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      diff += x & 1;
      x >>= 1;
    }
  }
  return diff > a.length * 4 * 0.02;
}

const jobsText = (list?: PlayAssignment[]) =>
  (list || []).map((a) => `${a.pos.trim().toUpperCase()}:${a.text.trim().replace(/\s+/g, ' ').toLowerCase()}`).join('|');

/** What a new upload changes on a play already in the bank (empty = nothing new). */
export function draftChanges(match: PlayDatabaseEntry, draft: PlayDraft): string[] {
  const out: string[] = [];
  // A built-in play with the same name becomes one of the coach's uploaded plays.
  if (!match.source) out.push('Now from your upload');
  if (draft.diagram) {
    if (!match.diagramHash && !match.diagramUrl) out.push('Adds the diagram');
    else if (diagramsDiffer(match.diagramHash, draft.diagram.hash)) out.push('Diagram changed');
  }
  if (draft.assignments?.length) {
    if (!match.assignments?.length) out.push('Adds position jobs');
    else if (jobsText(match.assignments) !== jobsText(draft.assignments)) out.push('Position jobs changed');
  }
  if (draft.category && draft.category !== match.category) out.push(match.category ? `Section: ${match.category} → ${draft.category}` : `Section: ${draft.category}`);
  if (draft.install && draft.install !== match.install) out.push(match.install ? `Install: ${draft.install}` : 'Adds the install name');
  if (draft.notes && draft.notes !== match.notes) out.push('Notes changed');
  return out;
}

/** What would happen to each draft, for the import preview. */
export function draftStatus(db: PlayDatabaseEntry[], draft: PlayDraft): 'new' | 'update' | 'same' {
  const match = db.find((p) => playNameKey(p.name) === draft.key);
  if (!match) return 'new';
  return draftChanges(match, draft).length ? 'update' : 'same';
}

/**
 * Add the drafts to the Play Bank. A play already in the bank (same name, ignoring spaces) keeps its
 * wristband number, situations, formation and type; it takes what the new Hudl upload changed
 * (diagram, position jobs, section, install, notes). New plays are added at the end.
 */
export function mergeDraftsIntoDatabase(db: PlayDatabaseEntry[], drafts: PlayDraft[], now = Date.now()): MergeResult {
  const next = [...db];
  const added: PlayDatabaseEntry[] = [];
  const updated: PlayDatabaseEntry[] = [];
  const unchanged: PlayDatabaseEntry[] = [];
  const ids = new Set(db.map((p) => p.id));
  for (const draft of drafts) {
    if (draft.isSection) continue;
    const idx = next.findIndex((p) => playNameKey(p.name) === draft.key);
    if (idx >= 0) {
      const cur = next[idx];
      const patch: Partial<PlayDatabaseEntry> = {};
      const changes = draftChanges(cur, draft);
      if (changes.some((c) => /jobs/.test(c))) patch.assignments = draft.assignments;
      if (changes.some((c) => c.startsWith('Section'))) patch.category = draft.category;
      if (changes.some((c) => /install/i.test(c))) patch.install = draft.install;
      if (changes.includes('Notes changed')) patch.notes = draft.notes;
      if (draft.diagramUrl && changes.some((c) => /diagram/i.test(c))) {
        patch.diagramUrl = draft.diagramUrl;
        patch.diagramHash = draft.diagram?.hash;
      }
      // Anything that came in with an upload is one of the coach's own plays.
      if (cur.source !== 'hudl' && (Object.keys(patch).length || !cur.source)) patch.source = 'hudl';
      if (Object.keys(patch).length) {
        const merged = { ...cur, ...patch, importedAt: now };
        next[idx] = merged;
        updated.push(merged);
      } else {
        unchanged.push(cur);
      }
      continue;
    }
    let id = `hudl_${draft.key.toLowerCase()}`;
    let n = 2;
    while (ids.has(id)) id = `hudl_${draft.key.toLowerCase()}_${n++}`;
    ids.add(id);
    const entry: PlayDatabaseEntry = {
      id,
      name: draft.name,
      unit: draft.unit,
      formation: draft.formation,
      type: draft.type,
      situations: [],
      personnel: draft.unit === 'offense' ? extractPersonnel({ name: draft.name, formation: draft.formation, unit: draft.unit }) : undefined,
      tags: draft.category ? [titleCase(draft.category)] : [],
      category: draft.category,
      install: draft.install,
      assignments: draft.assignments,
      notes: draft.notes,
      source: 'hudl',
      importedAt: now,
      ...(draft.diagramUrl ? { diagramUrl: draft.diagramUrl, diagramHash: draft.diagram?.hash } : {}),
    };
    next.push(entry);
    added.push(entry);
  }
  return { next, added, updated, unchanged };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** A new Play Bank entry from just a name (e.g. typed while tagging film). */
export function newPlayEntry(name: string, unit?: PlayUnit, now = Date.now()): PlayDatabaseEntry {
  const clean = tidyPlayName(name);
  const side = unit || inferPlayUnit(clean);
  const formation = (side === 'offense' ? formationOfCall(clean) : defenseFrontOfCall(clean)) || inferFormation(clean, side);
  return {
    id: `play_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    unit: side,
    formation,
    type: inferPlayType(clean, side),
    situations: [],
    personnel: side === 'offense' ? extractPersonnel({ name: clean, formation, unit: side }) : undefined,
    tags: [],
    source: 'tagging',
    importedAt: now,
  };
}
