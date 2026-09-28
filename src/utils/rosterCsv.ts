// Reading a roster from a CSV / pasted list (TeamSnap member exports, spreadsheets, "7, John, Smith" lines).
import type { RosterPlayer } from '../types';

/** Split one CSV line: commas (or tabs), "double quotes" around values, "" for a quote inside one. */
export function splitCsvLine(line: string): string[] {
  const delimiter = line.includes('\t') && !line.includes(',') ? '\t' : line.includes('\t') && line.split('\t').length > line.split(',').length ? '\t' : ',';
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9#]/g, '');
const JERSEY = ['jersey', 'jerseynumber', 'jerseyno', 'jersey#', 'number', 'num', 'no', '#', 'uniform', 'uniformnumber', 'playernumber'];
const FIRST = ['first', 'firstname', 'playerfirstname', 'fname'];
const LAST = ['last', 'lastname', 'playerlastname', 'lname', 'surname'];
const FULL = ['name', 'playername', 'player', 'fullname'];
const ROSTER = ['rostername', 'displayname'];
const PRIMARY = ['pos', 'position', 'primary', 'primaryposition', 'primarypos', 'offense', 'offensiveposition', 'offpos'];
const SECONDARY = ['secondary', 'secondaryposition', 'secpos', 'defense', 'defensiveposition', 'defpos'];
const NOTES = ['note', 'notes', 'comments'];
const CAPTAIN = ['captain', 'iscaptain'];

export interface RosterCsvResult {
  players: RosterPlayer[];
  /** Rows left out, with why ("Dan Mancini: no jersey number"). */
  skipped: string[];
}

export function parseRosterCsv(raw: string, teamId: string): RosterCsvResult {
  const lines = String(raw || '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { players: [], skipped: [] };

  const header = splitCsvLine(lines[0]).map(norm);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));
  const isHeader =
    header.some((h) => JERSEY.includes(h) || FIRST.includes(h) || LAST.includes(h) || FULL.includes(h) || PRIMARY.includes(h)) ||
    header.some((h) => h.includes('jersey'));

  // Without a header row: "number, first, last, primary, secondary".
  let col = { jersey: 0, first: 1, last: 2, full: -1, roster: -1, primary: 3, secondary: 4, notes: -1, captain: -1 };
  if (isHeader) {
    const jersey = find(JERSEY) >= 0 ? find(JERSEY) : header.findIndex((h) => h.includes('jersey'));
    col = {
      jersey,
      first: find(FIRST),
      last: find(LAST),
      full: find(FULL),
      roster: find(ROSTER),
      primary: find(PRIMARY),
      secondary: find(SECONDARY),
      notes: find(NOTES),
      captain: find(CAPTAIN),
    };
  }

  const players: RosterPlayer[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (let i = isHeader ? 1 : 0; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    const at = (c: number) => (c >= 0 && c < parts.length ? parts[c] : '');
    let first = at(col.first);
    let last = at(col.last);
    if ((!first || !last) && at(col.full)) {
      const bits = at(col.full).split(/\s+/);
      first = first || bits[0] || '';
      last = last || bits.slice(1).join(' ');
    } else if (first && !last && col.last < 0 && first.includes(' ')) {
      const bits = first.split(/\s+/);
      first = bits[0];
      last = bits.slice(1).join(' ');
    }
    const who = `${first} ${last}`.trim() || `Row ${i + 1}`;
    const num = at(col.jersey).replace(/\D/g, '');
    if (!first && !last) continue;
    if (!num) {
      skipped.push(`${who}: no jersey number`);
      continue;
    }
    if (seen.has(num)) {
      skipped.push(`${who}: #${num} is already used by another player in this file`);
      continue;
    }
    seen.add(num);
    const primary = (at(col.primary) || 'ATH').toUpperCase();
    const secondary = (at(col.secondary) || 'ATH').toUpperCase();
    players.push({
      num,
      firstName: first,
      lastName: last,
      rosterName: at(col.roster) || last || first,
      teamId,
      primaryPosition: primary,
      secondaryPosition: secondary,
      offensivePosition: primary,
      defensivePosition: secondary,
      conditioningHours: 10,
      paddedHours: 10,
      isCaptain: ['true', 'yes', '1', 'c', 'x'].includes(at(col.captain).toLowerCase()),
      notes: at(col.notes),
    });
  }
  return { players, skipped };
}
