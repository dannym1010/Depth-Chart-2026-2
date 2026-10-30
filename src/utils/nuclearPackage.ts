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
export function nuclearGrid(pkg: NuclearPackage, formIds: string[]): { kid: NuclearKid; cells: (string | null)[] }[] {
  return pkg.kids
    .filter((k) => !k.fixed)
    .map((kid) => ({ kid, cells: formIds.map((id) => (kid.at[id] ? pkg.spots[kid.at[id]].label : null)) }));
}

export interface NuclearSwitch {
  /** Coming in, to this spot; `for`: the kid he goes in for, when the subs pair up one for one. */
  ins: { kid: NuclearKid; to: string; for?: NuclearKid }[];
  outs: { kid: NuclearKid; from: string }[];
  moves: { kid: NuclearKid; from: string; to: string }[];
}

/** Going from one formation to another: who comes in, who goes out, who changes spots. */
export function nuclearSwitch(pkg: NuclearPackage, from: string, to: string): NuclearSwitch {
  const out: NuclearSwitch = { ins: [], outs: [], moves: [] };
  for (const kid of pkg.kids) {
    const a = kid.at[from], b = kid.at[to];
    if (a && !b) out.outs.push({ kid, from: pkg.spots[a].label });
    else if (!a && b) out.ins.push({ kid, to: pkg.spots[b].label });
    else if (a && b && a !== b) out.moves.push({ kid, from: pkg.spots[a].label, to: pkg.spots[b].label });
  }
  // One in for one out: the kid whose spot he takes first, then in order.
  if (out.ins.length === out.outs.length) {
    const left = out.outs.map((o) => o.kid);
    for (const i of out.ins) {
      const same = out.outs.find((o) => o.from === i.to && left.includes(o.kid))?.kid;
      if (same) {
        i.for = same;
        left.splice(left.indexOf(same), 1);
      }
    }
    for (const i of out.ins) if (!i.for) i.for = left.shift();
  }
  return out;
}

export interface NuclearColors {
  turf: string;
  turfLine: string;
  los: string;
  ink: string;
  inkText: string;
  muted: string;
  paper: string;
  /** The formations other than the base, in package order: a kid's move in one is drawn in its color. */
  forms: string[];
  /** Black and white: a move is a white chip with a heavy black ring, its formations named in outlined tags. */
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
  forms: ['#d9480f', '#1971c2', '#2b8a3e', '#7b3fb0', '#c2255c', '#8a6d0b', '#0c8599', '#5a5fd0'],
};

export const INK_COLORS: NuclearColors = {
  turf: '#ffffff',
  turfLine: '#e2e2e2',
  los: '#555555',
  ink: '#000000',
  inkText: '#ffffff',
  muted: '#333333',
  paper: '#ffffff',
  forms: ['#000000'],
  inkOnly: true,
};

/** Each formation's color: the base is ink, the others take the palette in package order. */
export function nuclearFormColors(formIds: string[], base: string, C: NuclearColors = PRINT_COLORS): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  for (const id of formIds) out[id] = id === base ? C.ink : C.forms[i++ % C.forms.length];
  return out;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The field as an SVG string. With every formation picked it's the base formation (21): each kid once, at his base
 * spot, and a marker at every other spot he lines up in, tagged with the formations that put him there in their
 * colors. `only` draws one formation's 11, the kids who aren't in their base spot filled with its color.
 */
export function nuclearSvg(
  pkg: NuclearPackage,
  formIds: string[],
  opts: { only?: string; base?: string; colors?: NuclearColors; names?: boolean; zoom?: number } = {}
): string {
  const C = opts.colors || PRINT_COLORS;
  const names = opts.names !== false;
  // Chips and text bigger for a field drawn small (each formation on the print sheet).
  const z = opts.zoom || 1;
  const base = opts.base && formIds.includes(opts.base) ? opts.base : nuclearBase(pkg, formIds);
  const fc = nuclearFormColors(formIds, base, C);
  const labelOf = (id: string) => pkg.forms.find((f) => f.id === id)?.label || id;
  const shown = opts.only ? [opts.only] : formIds;
  const keys = Object.values(pkg.spots).filter((s) => pkg.kids.some((k) => shown.some((f) => k.at[f] === s.key)));
  if (!keys.length) return '';
  const CELL_X = 118, CELL_Y = Math.max(100, 70 + 30 * z), PAD_X = 92, TOP = (opts.only ? 26 : 38) + 20 * z;
  const minDx = Math.min(...keys.map((s) => s.dx)), maxDx = Math.max(...keys.map((s) => s.dx));
  const maxRow = Math.max(...keys.map((s) => s.row));
  const W = (maxDx - minDx) * CELL_X + PAD_X * 2;
  const H = TOP + maxRow * CELL_Y + 30 * z + (names ? 40 : 24) + (opts.only ? 6 * z : 14);
  const at = (s: NuclearSpot) => [PAD_X + (s.dx - minDx) * CELL_X, TOP + s.row * CELL_Y];
  // A kid at each spot he's in, with the formations that put him there; a move when it isn't his base spot.
  type Mark = { kid: NuclearKid; spot: NuclearSpot; forms: string[]; move: boolean; x: number; y: number };
  const byCell: Record<string, Mark[]> = {};
  for (const kid of pkg.kids) {
    const spots = new Map<string, string[]>();
    for (const id of shown) if (kid.at[id]) spots.set(kid.at[id], [...(spots.get(kid.at[id]) || []), id]);
    for (const [key, forms] of spots) {
      const spot = pkg.spots[key];
      (byCell[`${spot.dx},${spot.row}`] ||= []).push({ kid, spot, forms, move: key !== kid.at[base], x: 0, y: 0 });
    }
  }
  // Kids in the same cell of the board (the FB and a shotgun QB, a kid and one who moves there) sit side by side,
  // the base spots first.
  for (const cell of Object.values(byCell)) {
    cell.sort((a, b) => Number(a.move) - Number(b.move));
    const [x, y] = at(cell[0].spot);
    const gap = Math.min(70, CELL_X / Math.max(1, cell.length - 0.2));
    cell.forEach((m, i) => {
      m.x = x + (i - (cell.length - 1) / 2) * gap;
      m.y = y;
    });
  }
  const font = `font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif"`;
  // A formation's tag: its name in a pill of its color (outlined in black and white).
  const pillW = (id: string) => 10 + 7 * labelOf(id).length;
  const pills = (ids: string[], cx: number, top: number) => {
    let x = cx - (ids.reduce((w, id) => w + pillW(id) + 3, -3)) / 2;
    return ids
      .map((id) => {
        const w = pillW(id);
        const s = `<rect x="${x}" y="${top}" width="${w}" height="16" rx="8" fill="${C.inkOnly ? C.paper : fc[id]}"${C.inkOnly ? ` stroke="${C.ink}" stroke-width="1.5"` : ''}/><text x="${x + w / 2}" y="${top + 12.5}" text-anchor="middle" ${font} font-size="13" font-weight="800" fill="${C.inkOnly ? C.ink : '#ffffff'}">${esc(labelOf(id))}</text>`;
        x += w + 3;
        return s;
      })
      .join('');
  };
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block;height:auto">`);
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="${C.turf}"/>`);
  for (let y = TOP + CELL_Y / 2; y < H - 10; y += CELL_Y / 2) out.push(`<line x1="12" x2="${W - 12}" y1="${y}" y2="${y}" stroke="${C.turfLine}" stroke-width="0.8"/>`);
  out.push(`<line x1="12" x2="${W - 12}" y1="${TOP - 22 * z}" y2="${TOP - 22 * z}" stroke="${C.los}" stroke-width="2" stroke-dasharray="7 5"/>`);
  if (!opts.only) {
    out.push(`<text x="18" y="${TOP - 30}" ${font} font-size="12" font-weight="700" letter-spacing="1.5" fill="${C.muted}">LINE OF SCRIMMAGE</text>`);
    // The key: the base, and each formation's tag.
    const others = formIds.filter((id) => id !== base);
    if (others.length) {
      const w = others.reduce((s, id) => s + pillW(id) + 3, -3);
      out.push(pills(others, W - 18 - w / 2, TOP - 42));
      out.push(`<text x="${W - 26 - w}" y="${TOP - 30}" text-anchor="end" ${font} font-size="12" font-weight="700" letter-spacing="1.5" fill="${C.muted}">BASE ${esc(labelOf(base).toUpperCase())} · MOVES IN</text>`);
    }
  }
  for (const m of Object.values(byCell).flat()) {
    const { kid, spot } = m;
    const color = fc[m.forms[0]];
    if (m.move && !opts.only) {
      // He lines up here in these formations.
      out.push(`<circle cx="${m.x}" cy="${m.y}" r="15" fill="${C.paper}" stroke="${C.inkOnly ? C.ink : color}" stroke-width="3"${kid.partial ? ' stroke-dasharray="4 3"' : ''}/>`);
      out.push(`<text x="${m.x}" y="${m.y + 5.5}" text-anchor="middle" ${font} font-size="16" font-weight="800" fill="${C.ink}">${esc(kid.num || '?')}</text>`);
      out.push(pills(m.forms, m.x, m.y + 20));
      // A kid who isn't in the base has no chip with his name on it.
      const who = names && !kid.at[base] && kid.name ? `${kid.name.slice(0, 11)} · ` : '';
      out.push(`<text x="${m.x}" y="${m.y + 50}" text-anchor="middle" ${font} font-size="13" font-weight="700" fill="${C.muted}">${esc(who + spot.label)}</text>`);
      continue;
    }
    const sub = kid.partial;
    const fill = sub ? C.paper : m.move ? (C.inkOnly ? C.paper : color) : C.ink;
    const stroke = sub ? (m.move && !C.inkOnly ? color : C.muted) : m.move && C.inkOnly ? C.ink : C.paper;
    const width = (sub ? 2.5 : m.move && C.inkOnly ? 3.5 : 3) * Math.sqrt(z);
    const num = sub ? (m.move && !C.inkOnly ? color : C.ink) : m.move && C.inkOnly ? C.ink : C.inkText;
    out.push(`<circle cx="${m.x}" cy="${m.y}" r="${19 * z}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${sub ? ' stroke-dasharray="4 3"' : ''}/>`);
    out.push(`<text x="${m.x}" y="${m.y + 6.5 * z}" text-anchor="middle" ${font} font-size="${19 * z}" font-weight="800" fill="${num}">${esc(kid.num || '?')}</text>`);
    let y = m.y + 19 * z + 17;
    if (names && kid.name) {
      out.push(`<text x="${m.x}" y="${y}" text-anchor="middle" ${font} font-size="16" font-weight="700" fill="${C.ink}">${esc(kid.name.slice(0, 11))}</text>`);
      y += 16;
    }
    // A sub's base spot says which formations he's in.
    const tag = !opts.only && sub ? `${spot.label} · ${m.forms.map(labelOf).join(' ')}` : spot.label;
    out.push(`<text x="${m.x}" y="${y + (z - 1) * 8}" text-anchor="middle" ${font} font-size="${(opts.only ? 15 : 14) * z}" font-weight="800" fill="${m.move && !C.inkOnly ? color : C.muted}">${esc(tag)}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

/**
 * One switch drawn like a play: the formation you're in, an arrow from each kid who moves to his new spot (filled in
 * the new formation's color), a sub running on from the sideline, and a kid going out crossed off.
 */
export function nuclearSwitchSvg(pkg: NuclearPackage, formIds: string[], from: string, to: string, opts: { base?: string; colors?: NuclearColors } = {}): string {
  const C = opts.colors || PRINT_COLORS;
  const base = opts.base && formIds.includes(opts.base) ? opts.base : nuclearBase(pkg, formIds);
  const color = C.inkOnly ? C.ink : nuclearFormColors(formIds, base, C)[to] || C.ink;
  const sw = nuclearSwitch(pkg, from, to);
  const used = Object.values(pkg.spots).filter((sp) => pkg.kids.some((k) => k.at[from] === sp.key || k.at[to] === sp.key));
  if (!used.length) return '';
  const minDx = Math.min(...used.map((x) => x.dx)), maxDx = Math.max(...used.map((x) => x.dx));
  const maxRow = Math.max(...used.map((x) => x.row));
  const CX = 70, CY = 66, PX = 56, TOP = 48;
  const W = (maxDx - minDx) * CX + PX * 2;
  const SIDE = TOP + maxRow * CY + 70;
  const H = SIDE + 48;
  const cellOf = (sp: NuclearSpot) => `${sp.dx},${sp.row}`;
  // A spot one kid leaves and another comes to: the one leaving a little left, the one arriving a little right.
  const changing = pkg.kids.filter((k) => k.at[from] !== k.at[to]);
  const leaving = new Set(changing.filter((k) => k.at[from]).map((k) => cellOf(pkg.spots[k.at[from]])));
  const arriving = new Set(changing.filter((k) => k.at[to]).map((k) => cellOf(pkg.spots[k.at[to]])));
  const pos = (sp: NuclearSpot, side: 'from' | 'to') => {
    const both = leaving.has(cellOf(sp)) && arriving.has(cellOf(sp));
    return [PX + (sp.dx - minDx) * CX + (both ? (side === 'from' ? -19 : 19) : 0), TOP + sp.row * CY];
  };
  const font = `font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif"`;
  const id = `ah${formIds.indexOf(from)}x${formIds.indexOf(to)}${C.inkOnly ? 'k' : ''}`;
  const chip = (x: number, y: number, num: string, o: { fill: string; ring: string; text: string; width?: number; faded?: boolean }) =>
    `<g${o.faded ? ' opacity="0.35"' : ''}><circle cx="${x}" cy="${y}" r="16" fill="${o.fill}" stroke="${o.ring}" stroke-width="${o.width || 2.5}"/><text x="${x}" y="${y + 5.5}" text-anchor="middle" ${font} font-size="16" font-weight="800" fill="${o.text}">${esc(num || '?')}</text></g>`;
  const tag = (x: number, y: number, t: string, c: string) => `<text x="${x}" y="${y}" text-anchor="middle" ${font} font-size="12" font-weight="800" fill="${c}">${esc(t)}</text>`;
  // Where he was: hollow in the new color (faded in black and white). Where he goes: filled (a heavy ring in black and white).
  const was = { fill: C.paper, ring: color, text: C.ink, faded: C.inkOnly };
  const goes = C.inkOnly ? { fill: C.paper, ring: C.ink, text: C.ink, width: 4.5 } : { fill: color, ring: C.paper, text: '#ffffff' };
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block;height:auto">`);
  out.push(`<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker></defs>`);
  out.push(`<rect width="${W}" height="${SIDE - 18}" rx="10" fill="${C.turf}"/>`);
  out.push(`<line x1="10" x2="${W - 10}" y1="${TOP - 26}" y2="${TOP - 26}" stroke="${C.los}" stroke-width="2" stroke-dasharray="7 5"/>`);
  out.push(`<rect y="${SIDE - 10}" width="${W}" height="56" rx="10" fill="${C.inkOnly ? C.paper : '#f6f4ee'}" stroke="${C.turfLine}"/>`);
  out.push(`<text x="12" y="${SIDE + 8}" ${font} font-size="11" font-weight="700" letter-spacing="1.4" fill="${C.muted}">SIDELINE</text>`);
  // Arrows under the chips.
  for (const m of sw.moves) {
    const [x1, y1] = pos(pkg.spots[m.kid.at[from]], 'from');
    const [x2, y2] = pos(pkg.spots[m.kid.at[to]], 'to');
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
    out.push(`<path d="M${x1 + ux * 19} ${y1 + uy * 19} L${x2 - ux * 20} ${y2 - uy * 20}" stroke="${color}" stroke-width="3" fill="none" marker-end="url(#${id})"/>`);
  }
  // Coming in: from the sideline up to his spot.
  sw.ins.forEach((i, n) => {
    const [x2, y2] = pos(pkg.spots[i.kid.at[to]], 'to');
    const sx = 70 + n * 64, sy = SIDE + 22;
    out.push(`<path d="M${sx} ${sy - 18} C ${sx} ${sy - 60}, ${x2} ${y2 + 60}, ${x2} ${y2 + 21}" stroke="${color}" stroke-width="3" fill="none" stroke-dasharray="6 4" marker-end="url(#${id})"/>`);
    out.push(chip(sx, sy, i.kid.num, { ...was, faded: false }));
    out.push(`<text x="${sx + 22}" y="${sy + 5}" ${font} font-size="13" font-weight="800" fill="${color}">IN${i.for ? ` for ${esc(i.for.num)}` : ''}</text>`);
  });
  const outs = new Set(sw.outs.map((o) => o.kid));
  const moved = new Set(sw.moves.map((m) => m.kid));
  for (const k of pkg.kids) {
    const key = k.at[from];
    if (!key) continue;
    const sp = pkg.spots[key];
    const [x, y] = pos(sp, 'from');
    if (outs.has(k)) {
      // Going out: crossed off.
      out.push(chip(x, y, k.num, { fill: C.ink, ring: C.paper, text: C.inkText, faded: true }));
      out.push(`<path d="M${x - 11} ${y - 11}L${x + 11} ${y + 11}M${x + 11} ${y - 11}L${x - 11} ${y + 11}" stroke="${C.inkOnly ? C.ink : '#c92a2a'}" stroke-width="3.5" stroke-linecap="round"/>`);
      out.push(tag(x, y + 31, 'OUT', C.inkOnly ? C.ink : '#c92a2a'));
      continue;
    }
    out.push(chip(x, y, k.num, moved.has(k) ? was : { fill: C.ink, ring: C.paper, text: C.inkText }));
    out.push(tag(x, y + 31, sp.label, C.muted));
  }
  // Where the movers and the subs end up.
  for (const k of [...sw.moves.map((m) => m.kid), ...sw.ins.map((i) => i.kid)]) {
    const sp = pkg.spots[k.at[to]];
    const [x, y] = pos(sp, 'to');
    out.push(chip(x, y, k.num, goes));
    out.push(tag(x, y + 31, sp.label, color));
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
  /** The "Who lines up where" chart. */
  moves: boolean;
  /** Each formation drawn small. */
  formations: boolean;
  /** A second page: every formation to every other, who comes in, goes out and moves. */
  switches: boolean;
  /** A practice page: arrow diagrams from the base to each formation and back. */
  diagrams: boolean;
  /** The base formation the chart shades changes from (not a saved preference). */
  baseId?: string;
};
export const NUCLEAR_PRINT_DEFAULTS: NuclearPrintOptions = { orientation: 'landscape', ink: false, names: true, moves: true, formations: true, switches: false, diagrams: false };

/** The lines of one switch, as HTML: subs first (in for out), then the kids who change spots. */
export function nuclearSwitchLines(sw: NuclearSwitch): string[] {
  const kid = (k: NuclearKid) => `<b>#${esc(k.num)}</b> ${esc(k.name)}`;
  const paired = new Set(sw.ins.map((i) => i.for).filter(Boolean));
  return [
    ...sw.ins.map((i) => `<span class="tag in">IN</span> ${kid(i.kid)}${i.for ? ` for ${kid(i.for)}` : ''} &rarr; <b>${esc(i.to)}</b>`),
    ...sw.outs.filter((o) => !paired.has(o.kid)).map((o) => `<span class="tag out">OUT</span> ${kid(o.kid)} (${esc(o.from)})`),
    ...sw.moves.map((m) => `${kid(m.kid)} ${esc(m.from)} &rarr; <b>${esc(m.to)}</b>`),
  ];
}

/** One page: the package on one field, who moves, and each formation small (each part can be left off). */
export function nuclearPrintHtml(pkg: NuclearPackage, formIds: string[], title: string, subtitle: string, options: Partial<NuclearPrintOptions> = {}): string {
  const o = { ...NUCLEAR_PRINT_DEFAULTS, ...options };
  const C = o.ink ? INK_COLORS : PRINT_COLORS;
  const portrait = o.orientation === 'portrait';
  const labelOf = (id: string) => pkg.forms.find((f) => f.id === id)?.label || id;
  const base = o.baseId && formIds.includes(o.baseId) ? o.baseId : nuclearBase(pkg, formIds);
  const baseIdx = formIds.indexOf(base);
  const fc = nuclearFormColors(formIds, base, C);
  // A formation's color dot (none for the base, or in black and white).
  const sw = (id: string) => (C.inkOnly || id === base ? '' : `<i class="sw" style="background:${fc[id]}"></i>`);
  const head = formIds.map((id) => (id === base ? `<th class="base">${esc(labelOf(id))}<small>base</small></th>` : `<th>${sw(id)}${esc(labelOf(id))}</th>`)).join('');
  const rows = nuclearGrid(pkg, formIds)
    .map(({ kid: k, cells }) => {
      const tds = cells
        .map((c, i) => {
          if (!c) return '<td class="out">out</td>';
          if (!changedFromBase(cells, i, baseIdx)) return `<td${i === baseIdx ? ' class="base"' : ''}>${esc(c)}</td>`;
          // A move, shaded in that formation's color.
          return `<td class="mvd"${C.inkOnly ? '' : ` style="background:${fc[formIds[i]]}33"`}>${esc(c)}</td>`;
        })
        .join('');
      return `<tr><td class="who"><span class="dot${k.partial ? ' sub' : ''}">${esc(k.num)}</span><span class="nm">${esc(k.name)}</span></td>${tds}</tr>`;
    })
    .join('');
  const fixed = pkg.kids.filter((k) => k.fixed).map((k) => `#${esc(k.num)} ${esc(k.name)} (${esc(pkg.spots[Object.values(k.at)[0]]?.label || '')})`).join(' · ');
  // Page 2: from each formation (rows) to each other (columns).
  // Practice page: from the base to each formation (top row) and back (bottom row).
  const others = formIds.filter((id) => id !== base);
  const pair = (a: string, b: string) =>
    `<figure class="arrow"><figcaption>${sw(a)}${esc(labelOf(a))} &rarr; ${sw(b)}${esc(labelOf(b))}</figcaption>${nuclearSwitchSvg(pkg, formIds, a, b, { base, colors: C })}</figure>`;
  const diagrams =
    o.diagrams && others.length
      ? `<div class="diagrams"><div class="head"><h1>${esc(title)}: switch diagrams</h1><span class="sub">Arrows: who moves where &middot; dashed: who runs on &middot; crossed off: who comes out</span></div><div class="arrows">${others.map((id) => pair(base, id)).join('')}${others.map((id) => pair(id, base)).join('')}</div></div>`
      : '';
  const switches =
    o.switches && formIds.length > 1
      ? `<div class="switches"><div class="head"><h1>${esc(title)}: switches</h1><span class="sub">From the row's formation to the column's</span></div><table class="sw-grid"><thead><tr><th>From &darr; &nbsp; To &rarr;</th>${formIds.map((id) => `<th>${sw(id)}${esc(labelOf(id))}</th>`).join('')}</tr></thead><tbody>${formIds
          .map(
            (from) =>
              `<tr><th>${sw(from)}${esc(labelOf(from))}</th>${formIds
                .map((to) => {
                  if (to === from) return '<td class="self"></td>';
                  const lines = nuclearSwitchLines(nuclearSwitch(pkg, from, to));
                  return `<td>${lines.length ? lines.map((l) => `<div>${l}</div>`).join('') : '<div class="none">No change</div>'}</td>`;
                })
                .join('')}</tr>`
          )
          .join('')}</tbody></table></div>`
      : '';
  const cols = portrait ? Math.min(2, formIds.length) : Math.min(4, formIds.length);
  const minis = o.formations
    ? formIds
        .map((id) => `<div class="mini"><div class="mt">${sw(id)}${esc(labelOf(id))}${id === base ? ' <small>base</small>' : ''}</div>${nuclearSvg(pkg, formIds, { only: id, base, names: false, zoom: 2, colors: C })}</div>`)
        .join('')
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
${portrait ? '.field svg { max-height: 3.5in; width: auto !important; max-width: 100%; margin: 0 auto; } .mini svg { max-height: 1.35in; width: auto !important; margin: 0 auto; }' : ''}
.grid { width: 100%; border-collapse: collapse; font: 700 13px/1.2 "Barlow Condensed", Arial, sans-serif; }
.grid th { font: 800 14px/1 "Barlow Condensed", Arial, sans-serif; text-align: center; padding: 3px 4px; border-bottom: 2px solid ${C.ink}; }
.grid td { text-align: center; padding: 4px; border-bottom: 1px solid #e3e6e2; }
.grid td.who { text-align: left; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.grid th.base, .grid td.base { background: ${C.inkOnly ? '#f2f2f2' : '#eef3ec'}; }
.grid th small { display: block; font: 700 9px/1 Barlow, Arial, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: ${C.muted}; margin-top: 2px; }
.grid td.mvd { background: #e6e6e6; font-weight: 800; }
.sw { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: 1px; }
.grid td.out { color: ${C.muted}; font-style: italic; font-weight: 600; }
.dot { flex: none; width: 22px; height: 22px; border-radius: 50%; background: ${C.ink}; color: #fff; display: inline-flex; align-items: center; justify-content: center; font: 800 12px/1 "Barlow Condensed", Arial, sans-serif; }
.dot.sub { background: #fff; border: 2px dashed ${C.muted}; color: ${C.ink}; }
.nm { font-weight: 700; }
.side h2 { font: 800 13px/1 "Barlow Condensed", Arial, sans-serif; text-transform: uppercase; letter-spacing: .1em; margin: 0 0 4px; }
.fixed { margin-top: 8px; color: ${C.muted}; font-size: 12px; line-height: 1.4; }
.minis { display: grid; grid-template-columns: repeat(${Math.max(1, cols)}, 1fr); gap: 8px; margin-top: 10px; }
.mini { border: 1px solid #d9ddd8; border-radius: 8px; padding: 4px; break-inside: avoid; }
.mt { font: 800 16px/1 "Barlow Condensed", Arial, sans-serif; padding: 2px 4px 4px; }
.mt small { font: 700 10px/1 Barlow, Arial, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: ${C.muted}; }
.switches, .diagrams { break-before: page; }
.arrows { display: grid; grid-template-columns: repeat(${portrait ? 2 : Math.min(3, Math.max(1, formIds.length - 1))}, 1fr); gap: 10px; }
.arrow { margin: 0; border: 1px solid #d9ddd8; border-radius: 8px; padding: 6px; break-inside: avoid; }
.arrow figcaption { font: 800 16px/1 "Barlow Condensed", Arial, sans-serif; padding: 2px 2px 6px; }
.sw-grid { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; line-height: 1.35; }
.sw-grid th { font: 800 16px/1 "Barlow Condensed", Arial, sans-serif; padding: 6px; border: 1px solid #c9cfc8; background: #f3f5f2; text-align: left; }
.sw-grid thead th:first-child { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: ${C.muted}; }
.sw-grid td { vertical-align: top; padding: 6px; border: 1px solid #c9cfc8; }
.sw-grid td > div { padding: 2px 0; }
.sw-grid td.self { background: repeating-linear-gradient(135deg, #f3f5f2 0 6px, #fff 6px 12px); }
.sw-grid .none { color: ${C.muted}; font-style: italic; }
.tag { display: inline-block; font: 800 10px/1 "Barlow Condensed", Arial, sans-serif; padding: 2px 4px; border-radius: 3px; letter-spacing: .05em; vertical-align: 1px; }
.tag.in { background: ${C.inkOnly ? C.ink : '#2b8a3e'}; color: #fff; }
.tag.out { background: #fff; color: ${C.ink}; border: 1.5px solid ${C.ink}; }
</style></head><body>
<div class="head"><h1>${esc(title)}</h1><span class="sub">${esc(subtitle)}</span></div>
<div class="main">
  <div class="field">${nuclearSvg(pkg, formIds, { colors: C, names: o.names, base })}</div>
  ${side}
</div>
${minis ? `<div class="minis">${minis}</div>` : ''}
${diagrams}
${switches}
</body></html>`;
}
