// Play log -> spreadsheet for importing back into Hudl as breakdown data: one row per play, in play
// order (Hudl lines rows up with the clips in the playlist), with Hudl's own column names. The columns
// from the upload are kept as they were; what coaches set in the app is filled in on top:
// formation, the called play, Black/Gold/Blue, runner/passer/receiver, tacklers, subs.
// Hudl's uploader gets stuck on quotes, semicolons and commas inside a value, so every value is cleaned
// ("Rush, TD" -> "Rush TD", subs "QB: #7 Silva / RB: #22 Pestone") and the CSV needs no quoting at all.
import type { Play } from '../types/football';
import { defAssists } from '../../utils/filmLineup';

/** A value Hudl's uploader reads cleanly: no quotes, semicolons, commas or line breaks. */
export function hudlCell(value: unknown): string | number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return String(value ?? '')
    .replace(/["“”]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s*;\s*/g, ' / ')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const UNIT_LABEL: Record<string, string> = { black: 'Black', gold: 'Gold', blue: 'Blue' };

/** "#21 Nash Ward" -> { jersey: "21", name: "Nash Ward" }. */
export function splitPlayer(label?: string): { jersey: string; name: string } {
  const m = String(label || '').trim().match(/^#?(\d+)\s*(.*)$/);
  if (m) return { jersey: m[1], name: m[2].trim() };
  return { jersey: '', name: String(label || '').trim() };
}

const hashLetter = (h?: string) => {
  const v = String(h || '').toUpperCase();
  if (v.startsWith('L')) return 'L';
  if (v.startsWith('R')) return 'R';
  if (v.startsWith('M')) return 'M';
  return '';
};

/** The standard Hudl columns, for plays uploaded before the original row was kept. */
function standardColumns(p: Play): Record<string, string | number> {
  const typeText =
    p.rawPlayType ||
    (p.playType === 'RUN' ? 'Run' : p.playType === 'PASS' ? 'Pass' : p.playType === 'SPECIAL' ? 'Special' : '');
  return {
    'PLAY #': p.playNumber,
    ODK: p.odk === 'UNKNOWN' ? '' : p.odk,
    QTR: p.quarter || '',
    SERIES: p.series ?? '',
    DN: p.down || '',
    DIST: p.down ? p.distance : '',
    'YARD LN': p.rawYardLine || '',
    HASH: hashLetter(p.hash),
    'PLAY TYPE': typeText,
    RESULT: p.result || '',
    'GN/LS': p.gainLoss ?? '',
    'OFF FORM': p.untaggedFormation ?? p.formation ?? '',
    'OFF PLAY': p.hudlCall || '',
    'PLAY DIR': p.direction || '',
  };
}

/** One spreadsheet row for a play: the upload's columns, then everything coaches set. */
export function hudlExportRow(p: Play): Record<string, string | number> {
  const row: Record<string, string | number> = { ...(p.hudlRow && Object.keys(p.hudlRow).length ? p.hudlRow : standardColumns(p)) };
  const set = (col: string, value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') return;
    row[col] = value;
  };
  // Formation and the called play (a play tagged from the Play Bank).
  if (p.formation && p.formation !== '-') set('OFF FORM', p.formation);
  if (p.playCall) set(p.odk === 'D' ? 'DEF PLAY' : 'OFF PLAY', p.playCall);
  set('UNIT', p.unit ? UNIT_LABEL[p.unit] : undefined);
  const put = (prefix: string, label?: string) => {
    if (!label) return;
    const { jersey, name } = splitPlayer(label);
    set(`${prefix}_Jersey`, jersey);
    set(`${prefix}_Name`, name);
  };
  put('RUSHER', p.rusher);
  put('PASSER', p.passer);
  put('RECEIVER', p.receiver);
  put('TACKLER', p.defPlay?.maker);
  const assists = defAssists(p.defPlay).map(splitPlayer);
  set('ASSIST_Jersey', assists.map((a) => a.jersey).filter(Boolean).join(' / '));
  set('ASSIST_Name', assists.map((a) => a.name).filter(Boolean).join(' / '));
  if (p.defPlay?.events?.length) set('DEF EVENTS', p.defPlay.events.map((e) => e.toUpperCase()).join(' / '));
  const subs = Object.entries(p.subs || {})
    .map(([slot, who]) => (who ? `${slot}: #${who.num}${who.name ? ` ${who.name}` : ''}` : `${slot}: out`))
    .join(' / ');
  set('SUBS', subs);
  return row;
}

/** Rows for one game, in play order, with every column any row uses (upload's columns first). */
export function hudlExportRows(plays: Play[]): { headers: string[]; rows: Record<string, string | number>[] } {
  const ordered = [...plays].sort((a, b) => (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0));
  const rows = ordered.map((p) => {
    const clean: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(hudlExportRow(p))) clean[String(hudlCell(k))] = hudlCell(v);
    return clean;
  });
  const headers: string[] = [];
  const seen = new Set<string>();
  rows.forEach((r) =>
    Object.keys(r).forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    })
  );
  return { headers, rows };
}

/** One game's play log as a CSV for Hudl's breakdown upload (every row has every column; nothing quoted). */
export function hudlExportCsv(plays: Play[]): string {
  const { headers, rows } = hudlExportRows(plays);
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => String(r[h] ?? '')).join(','))];
  return lines.join('\r\n') + '\r\n';
}
