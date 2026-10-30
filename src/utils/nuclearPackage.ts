import type { FormationBoard, PlacedPlayer } from '../types';

/**
 * A nuclear package: one string (black, gold or blue) in every formation it plays, on one field. Each kid gets a
 * chip at every spot they line up in; a spot is a cell of the formation board (its row, and its slot measured
 * from the center) with its name, so the same spot in two formations is one chip.
 */
export const STRINGS = [
  { idx: 0, label: 'Black' },
  { idx: 1, label: 'Gold' },
  { idx: 2, label: 'Blue' },
] as const;

export interface NuclearForm {
  id: string;
  label: string;
  /** Spots this string has a player in. */
  filled: number;
  spots: number;
}
export interface NuclearSpot {
  /** `${dx},${row},${label}`: slots from the center, the board row (0 = the line) and the spot's name. */
  key: string;
  dx: number;
  row: number;
  label: string;
}
export interface NuclearKid {
  key: string;
  num: string;
  name: string;
  /** Formation id -> spot key. */
  at: Record<string, string>;
  /** In every formation picked, at the same spot. */
  fixed: boolean;
  /** Not in every formation picked (a sub). */
  partial: boolean;
}
export interface NuclearPackage {
  forms: NuclearForm[];
  spots: Record<string, NuclearSpot>;
  kids: NuclearKid[];
}

/** "1 (QB)" -> "QB", "2 (FB)" -> "FB", "Y1" -> "Y1". */
export function spotLabel(name: string): string {
  const inParens = name.match(/\(([^)]+)\)/);
  return (inParens ? inParens[1] : name).trim();
}

/** "21 Offense" -> "21"; the full name when two boards would read the same. */
export function formLabels(boards: FormationBoard[]): Record<string, string> {
  const short = (b: FormationBoard) => b.name.match(/^\s*(\d{2,3})\b/)?.[1] || b.name.trim();
  const count: Record<string, number> = {};
  for (const b of boards) count[short(b)] = (count[short(b)] || 0) + 1;
  return Object.fromEntries(boards.map((b) => [b.id, count[short(b)] > 1 ? b.name.trim() : short(b)]));
}

const kidKey = (p: PlacedPlayer) => `${String(p.num || '').trim()}|${String(p.name || '').trim().toLowerCase()}`;

/** Where each board's spots are: row, and slot from the center (or the middle of the row when there's no C). */
function boardSpots(b: FormationBoard): { posId: string; name: string; dx: number; row: number }[] {
  let center: number | null = null;
  for (const r of b.rows) {
    const i = r.positions.findIndex((p) => p && /^c$/i.test(spotLabel(p.name)));
    if (i >= 0) { center = i; break; }
  }
  const out: { posId: string; name: string; dx: number; row: number }[] = [];
  b.rows.forEach((r, row) => {
    const mid = center ?? (r.positions.length - 1) / 2;
    r.positions.forEach((p, slot) => {
      if (p) out.push({ posId: p.id, name: p.name, dx: slot - mid, row });
    });
  });
  return out;
}

/** The string's kids in the formations picked (all the unit's boards when none are given). */
export function buildNuclear(boards: FormationBoard[], depthChart: Record<string, PlacedPlayer[]>, stringIdx: number, formIds?: string[]): NuclearPackage {
  // "11" for 11 Personnel when 11 Offense isn't in the package too.
  const labels = { ...formLabels(boards), ...(formIds ? formLabels(boards.filter((b) => formIds.includes(b.id))) : {}) };
  const forms: NuclearForm[] = [];
  const spots: Record<string, NuclearSpot> = {};
  const kids = new Map<string, NuclearKid>();
  for (const b of boards) {
    const all = boardSpots(b);
    const filled = all.filter((s) => depthChart[s.posId]?.[stringIdx]?.num || depthChart[s.posId]?.[stringIdx]?.name).length;
    forms.push({ id: b.id, label: labels[b.id], filled, spots: all.length });
    if (formIds && !formIds.includes(b.id)) continue;
    for (const s of all) {
      const p = depthChart[s.posId]?.[stringIdx];
      if (!p || !(p.num || p.name)) continue;
      const key = `${s.dx},${s.row},${spotLabel(s.name).toUpperCase()}`;
      spots[key] ||= { key, dx: s.dx, row: s.row, label: spotLabel(s.name) };
      const k = kidKey(p);
      const kid = kids.get(k) || { key: k, num: String(p.num || '').trim(), name: String(p.name || '').trim(), at: {}, fixed: false, partial: false };
      // The same position straight back from the same slot (QB under center or in the gun) is the same spot: he
      // doesn't move. The same name somewhere else on the board (the 4 back as a wing in Beast) is a move.
      const same = Object.values(kid.at).find((k) => spots[k].dx === s.dx && spots[k].label.toUpperCase() === spots[key].label.toUpperCase());
      // A kid listed twice in one formation: the first spot.
      if (!kid.at[b.id]) kid.at[b.id] = same || key;
      kids.set(k, kid);
    }
  }
  const picked = boards.filter((b) => !formIds || formIds.includes(b.id)).map((b) => b.id).filter((id) => [...kids.values()].some((k) => k.at[id]));
  for (const kid of kids.values()) {
    const where = picked.map((id) => kid.at[id]);
    kid.partial = where.some((w) => !w);
    kid.fixed = !kid.partial && new Set(where).size === 1;
  }
  // The line and the QB first (they never move), then the movers, then subs.
  const order = (k: NuclearKid) => (k.fixed ? 0 : k.partial ? 2 : 1);
  const list = [...kids.values()].sort((a, b) => order(a) - order(b) || Number(a.num) - Number(b.num) || a.name.localeCompare(b.name));
  return { forms, spots, kids: list };
}

/** A kid's spots in formation order, each with the formations they're there in: "FB (21, 22, 32) → X (11)". */
export function kidPath(pkg: NuclearPackage, kid: NuclearKid, formIds: string[]): { spot: NuclearSpot; forms: string[] }[] {
  const out: { spot: NuclearSpot; forms: string[] }[] = [];
  for (const id of formIds) {
    const key = kid.at[id];
    if (!key) continue;
    const label = pkg.forms.find((f) => f.id === id)?.label || id;
    const last = out[out.length - 1];
    if (last && last.spot.key === key) last.forms.push(label);
    else out.push({ spot: pkg.spots[key], forms: [label] });
  }
  return out;
}

/** The base formation the others are read against: the one called 21 when it's in the package, else the first. */
export function nuclearBase(pkg: NuclearPackage, formIds: string[]): string {
  return formIds.find((id) => /^21\b/.test(pkg.forms.find((f) => f.id === id)?.label || '')) || formIds[0] || '';
}

/** A kid's spot in a formation is a change from the base: in it, and not where he is in the base. */
export const changedFromBase = (cells: (string | null)[], i: number, baseIdx: number) => Boolean(cells[i]) && i !== baseIdx && cells[i] !== cells[baseIdx];

/** Who lines up where: a row per kid who moves or subs, a column per formation (null: not in it). */
export function nuclearGrid(pkg: NuclearPackage, formIds: string[]): { kid: NuclearKid; color: number; cells: (string | null)[] }[] {
  const movers = pkg.kids.filter((k) => !k.fixed && !k.partial);
  return pkg.kids
    .filter((k) => !k.fixed)
    .map((kid) => ({ kid, color: kid.partial ? -1 : movers.indexOf(kid), cells: formIds.map((id) => (kid.at[id] ? pkg.spots[kid.at[id]].label : null)) }));
}

export interface NuclearColors {
  turf: string;
  turfLine: string;
  los: string;
  ink: string;
  inkText: string;
  muted: string;
  paper: string;
  movers: string[];
  /** Black and white: movers are white chips with a black ring, told apart by the dashes of their paths. */
  inkOnly?: boolean;
}
export const PRINT_COLORS: NuclearColors = {
  turf: '#eef3ec',
  turfLine: '#d3ddd0',
  los: '#7d8f79',
  ink: '#15171a',
  inkText: '#ffffff',
  muted: '#4d5457',
  paper: '#ffffff',
  movers: ['#c4521b', '#1d6fb8', '#7b3fb0', '#138a5c', '#b0306a', '#8a6d0b', '#0f7c8c', '#5a5fd0'],
};

export const INK_COLORS: NuclearColors = {
  turf: '#ffffff',
  turfLine: '#e2e2e2',
  los: '#555555',
  ink: '#000000',
  inkText: '#ffffff',
  muted: '#333333',
  paper: '#ffffff',
  movers: ['#ffffff'],
  inkOnly: true,
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The field as an SVG string. `only` draws one formation's 11 (no tags, no paths); otherwise every formation picked
 * is on it, each chip tagged with the formations it's in unless that's all of them.
 */
export function nuclearSvg(pkg: NuclearPackage, formIds: string[], opts: { only?: string; colors?: NuclearColors; names?: boolean; zoom?: number } = {}): string {
  const C = opts.colors || PRINT_COLORS;
  const names = opts.names !== false;
  // Chips and text bigger for a field drawn small (each formation on the print sheet).
  const z = opts.zoom || 1;
  const shown = opts.only ? [opts.only] : formIds;
  const keys = Object.values(pkg.spots).filter((s) => pkg.kids.some((k) => shown.some((f) => k.at[f] === s.key)));
  if (!keys.length) return '';
  const CELL_X = 118, CELL_Y = Math.max(96, 70 + 30 * z), PAD_X = 92, TOP = 26 + 20 * z;
  const minDx = Math.min(...keys.map((s) => s.dx)), maxDx = Math.max(...keys.map((s) => s.dx));
  const maxRow = Math.max(...keys.map((s) => s.row));
  const W = (maxDx - minDx) * CELL_X + PAD_X * 2;
  const H = TOP + maxRow * CELL_Y + 30 * z + (names ? 40 : 24) + (opts.only ? 6 * z : 14);
  const at = (s: NuclearSpot) => [PAD_X + (s.dx - minDx) * CELL_X, TOP + s.row * CELL_Y];
  const movers = pkg.kids.filter((k) => !k.fixed && !k.partial);
  const color = (k: NuclearKid) => (k.fixed ? C.ink : k.partial ? C.paper : C.movers[movers.indexOf(k) % C.movers.length]);
  // Chips: one per kid per spot; kids in the same cell of the board (the FB and a shotgun QB) sit side by side.
  const chips: { kid: NuclearKid; spot: NuclearSpot; forms: string[]; x: number; y: number }[] = [];
  const bySpot: Record<string, typeof chips> = {};
  for (const kid of pkg.kids) {
    for (const p of kidPath(pkg, kid, shown)) {
      const c = { kid, spot: p.spot, forms: p.forms, x: 0, y: 0 };
      (bySpot[`${p.spot.dx},${p.spot.row}`] ||= []).push(c);
      chips.push(c);
    }
  }
  // The same kid twice at one spot (formations not next to each other): one chip with every formation.
  for (const key in bySpot) {
    const merged: typeof chips = [];
    for (const c of bySpot[key]) {
      const same = merged.find((m) => m.kid === c.kid && m.spot === c.spot);
      if (same) same.forms.push(...c.forms);
      else merged.push(c);
    }
    bySpot[key] = merged;
    const [x, y] = at(merged[0].spot);
    const gap = Math.min(70, CELL_X / Math.max(1, merged.length - 0.2));
    merged.forEach((c, i) => {
      c.x = x + (i - (merged.length - 1) / 2) * gap;
      c.y = y;
    });
  }
  const drawn = Object.values(bySpot).flat();
  const font = `font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif"`;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block;height:auto">`);
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="${C.turf}"/>`);
  for (let y = TOP + CELL_Y / 2; y < H - 10; y += CELL_Y / 2) out.push(`<line x1="12" x2="${W - 12}" y1="${y}" y2="${y}" stroke="${C.turfLine}" stroke-width="0.8"/>`);
  out.push(`<line x1="12" x2="${W - 12}" y1="${TOP - 22 * z}" y2="${TOP - 22 * z}" stroke="${C.los}" stroke-width="2" stroke-dasharray="7 5"/>`);
  if (!opts.only) out.push(`<text x="18" y="${TOP - 28}" ${font} font-size="12" font-weight="700" letter-spacing="1.5" fill="${C.muted}">LINE OF SCRIMMAGE</text>`);
  for (const c of drawn) {
    const fill = color(c.kid);
    const dashed = c.kid.partial;
    out.push(`<circle cx="${c.x}" cy="${c.y}" r="${19 * z}" fill="${fill}" stroke="${dashed ? C.muted : C.inkOnly && !c.kid.fixed ? C.ink : C.paper}" stroke-width="${(dashed ? 2 : C.inkOnly && !c.kid.fixed ? 3.5 : 3) * Math.sqrt(z)}"${dashed ? ' stroke-dasharray="4 3"' : ''}/>`);
    out.push(`<text x="${c.x}" y="${c.y + 6.5 * z}" text-anchor="middle" ${font} font-size="${19 * z}" font-weight="800" fill="${dashed || (C.inkOnly && !c.kid.fixed) ? C.ink : c.kid.fixed ? C.inkText : '#ffffff'}">${esc(c.kid.num || '?')}</text>`);
    let y = c.y + 19 * z + 17;
    if (names && c.kid.name) {
      out.push(`<text x="${c.x}" y="${y}" text-anchor="middle" ${font} font-size="16" font-weight="700" fill="${C.ink}">${esc(c.kid.name.slice(0, 11))}</text>`);
      y += 16;
    }
    const tag = c.forms.length < shown.length ? `${esc(c.spot.label)} · ${esc(c.forms.join(' '))}` : esc(c.spot.label);
    out.push(`<text x="${c.x}" y="${y + (z - 1) * 8}" text-anchor="middle" ${font} font-size="${(opts.only ? 15 : 14) * z}" font-weight="800" fill="${c.kid.fixed || c.kid.partial || C.inkOnly ? C.muted : fill}">${tag}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

export type NuclearPrintOptions = {
  orientation: 'landscape' | 'portrait';
  /** Black and white instead of color. */
  ink: boolean;
  /** Names under the chips on the big field (numbers only when off). */
  names: boolean;
  /** The "Who moves" list. */
  moves: boolean;
  /** Each formation drawn small. */
  formations: boolean;
  /** The base formation the chart shades changes from (not a saved preference). */
  baseId?: string;
};
export const NUCLEAR_PRINT_DEFAULTS: NuclearPrintOptions = { orientation: 'landscape', ink: false, names: true, moves: true, formations: true };

/** One page: the package on one field, who moves, and each formation small (each part can be left off). */
export function nuclearPrintHtml(pkg: NuclearPackage, formIds: string[], title: string, subtitle: string, options: Partial<NuclearPrintOptions> = {}): string {
  const o = { ...NUCLEAR_PRINT_DEFAULTS, ...options };
  const C = o.ink ? INK_COLORS : PRINT_COLORS;
  const portrait = o.orientation === 'portrait';
  const labelOf = (id: string) => pkg.forms.find((f) => f.id === id)?.label || id;
  const base = o.baseId && formIds.includes(o.baseId) ? o.baseId : nuclearBase(pkg, formIds);
  const baseIdx = formIds.indexOf(base);
  const head = formIds.map((id) => (id === base ? `<th class="base">${esc(labelOf(id))}<small>base</small></th>` : `<th>${esc(labelOf(id))}</th>`)).join('');
  const rows = nuclearGrid(pkg, formIds)
    .map(({ kid: k, color: ci, cells }) => {
      const color = k.partial || C.inkOnly ? C.paper : C.movers[ci % C.movers.length];
      const ring = k.partial ? `border:2px dashed ${C.muted};color:${C.ink}` : C.inkOnly ? `border:2.5px solid ${C.ink};color:${C.ink}` : '';
      const tds = cells.map((c, i) => `<td class="${c ? [i === baseIdx ? 'base' : '', changedFromBase(cells, i, baseIdx) ? 'mvd' : ''].join(' ').trim() : 'out'}">${c ? esc(c) : 'out'}</td>`).join('');
      return `<tr><td class="who"><span class="dot" style="background:${color};${ring}">${esc(k.num)}</span><span class="nm">${esc(k.name)}</span></td>${tds}</tr>`;
    })
    .join('');
  const fixed = pkg.kids.filter((k) => k.fixed).map((k) => `#${esc(k.num)} ${esc(k.name)} (${esc(pkg.spots[Object.values(k.at)[0]]?.label || '')})`).join(' · ');
  const cols = portrait ? Math.min(2, formIds.length) : Math.min(4, formIds.length);
  const minis = o.formations
    ? formIds.map((id) => `<div class="mini"><div class="mt">${esc(labelOf(id))}</div>${nuclearSvg(pkg, formIds, { only: id, names: false, zoom: 2, colors: C })}</div>`).join('')
    : '';
  const side = o.moves
    ? `<div class="side"><h2>Who lines up where</h2>${rows ? `<table class="grid"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>` : '<p>Nobody moves: every kid stays in one spot.</p>'}${fixed ? `<div class="fixed"><b>Same spot every time:</b> ${fixed}</div>` : ''}</div>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;600&display=swap">
<style>
@page { size: letter ${o.orientation}; margin: 0.35in; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Barlow, Arial, sans-serif; color: ${C.ink}; background: #fff; font-size: 11px; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 3px solid ${C.ink}; padding-bottom: 4px; margin-bottom: 8px; }
h1 { font: 800 24px/1 "Barlow Condensed", "Arial Narrow", sans-serif; margin: 0; text-transform: uppercase; letter-spacing: .02em; }
.sub { font: 700 12px/1 "Barlow Condensed", "Arial Narrow", sans-serif; text-transform: uppercase; letter-spacing: .1em; color: ${C.muted}; text-align: right; }
.main { display: grid; grid-template-columns: ${side && !portrait ? '1fr 300px' : '1fr'}; gap: 12px; align-items: start; }
${portrait ? '.mini svg { max-height: 1.7in; width: auto !important; margin: 0 auto; }' : ''}
.grid { width: 100%; border-collapse: collapse; font: 700 13px/1.2 "Barlow Condensed", Arial, sans-serif; }
.grid th { font: 800 14px/1 "Barlow Condensed", Arial, sans-serif; text-align: center; padding: 3px 4px; border-bottom: 2px solid ${C.ink}; }
.grid td { text-align: center; padding: 4px; border-bottom: 1px solid #e3e6e2; }
.grid td.who { text-align: left; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.grid th.base, .grid td.base { background: ${C.inkOnly ? '#f2f2f2' : '#eef3ec'}; }
.grid th small { display: block; font: 700 9px/1 Barlow, Arial, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: ${C.muted}; margin-top: 2px; }
.grid td.mvd { background: ${C.inkOnly ? '#e6e6e6' : '#fff1d6'}; font-weight: 800; }
.grid td.out { color: ${C.muted}; font-style: italic; font-weight: 600; }
.dot { flex: none; width: 22px; height: 22px; border-radius: 50%; color: #fff; display: inline-flex; align-items: center; justify-content: center; font: 800 12px/1 "Barlow Condensed", Arial, sans-serif; }
.nm { font-weight: 700; }
.side h2 { font: 800 13px/1 "Barlow Condensed", Arial, sans-serif; text-transform: uppercase; letter-spacing: .1em; margin: 0 0 4px; }
.fixed { margin-top: 8px; color: ${C.muted}; font-size: 12px; line-height: 1.4; }
.minis { display: grid; grid-template-columns: repeat(${Math.max(1, cols)}, 1fr); gap: 8px; margin-top: 10px; }
.mini { border: 1px solid #d9ddd8; border-radius: 8px; padding: 4px; break-inside: avoid; }
.mt { font: 800 16px/1 "Barlow Condensed", Arial, sans-serif; padding: 2px 4px 4px; }
</style></head><body>
<div class="head"><h1>${esc(title)}</h1><span class="sub">${esc(subtitle)}</span></div>
<div class="main">
  <div>${nuclearSvg(pkg, formIds, { colors: C, names: o.names })}</div>
  ${side}
</div>
${minis ? `<div class="minis">${minis}</div>` : ''}
</body></html>`;
}
