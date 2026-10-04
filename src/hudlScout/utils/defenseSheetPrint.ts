// The sideline defensive call sheet, printed from its own clean page (not by printing the app): the coach
// chooses what shows, how big the text is, color or black and white, and the paper direction. The choices
// are remembered on this device.
import type { CallSheetSectionKey } from '../scoutBundle';

export interface SheetPrintOptions {
  /** The title line ("Opponent scout: ..."). */
  title: boolean;
  /** Plays analyzed, run / pass split and average gain. */
  stats: boolean;
  /** The high-alert tells. */
  alerts: boolean;
  /** Which call boxes print. */
  sections: Record<CallSheetSectionKey, boolean>;
  /** The reminder line at the bottom. */
  note: boolean;
  /** Their plays against our defense, on its own page(s). */
  playTypes: boolean;
  /** Plays across the page on that page. */
  playTypeCols: 1 | 2 | 3;
  /** The calls and film counts under each play's name. */
  playTypeDetail: boolean;
  /** Number each call (1. 2. 3.). */
  numbers: boolean;
  size: 'normal' | 'large';
  ink: 'color' | 'bw';
  orientation: 'portrait' | 'landscape';
}

export const DEFAULT_SHEET_OPTIONS: SheetPrintOptions = {
  title: true,
  stats: true,
  alerts: true,
  sections: { firstDownCalls: true, runStopCalls: true, thirdDownMustStops: true, passBlitzCalls: true, redZoneLocks: true },
  note: true,
  playTypes: true,
  playTypeCols: 2,
  playTypeDetail: true,
  numbers: true,
  size: 'normal',
  ink: 'color',
  orientation: 'portrait',
};

const KEY = 'footballDefenseSheetPrint';

export function loadSheetOptions(): SheetPrintOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_SHEET_OPTIONS;
    return { ...DEFAULT_SHEET_OPTIONS, ...saved, sections: { ...DEFAULT_SHEET_OPTIONS.sections, ...(saved.sections || {}) } };
  } catch {
    return DEFAULT_SHEET_OPTIONS;
  }
}

export function saveSheetOptions(options: SheetPrintOptions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    /* a per-device preference */
  }
}

export interface SheetData {
  opponentName: string;
  stats: { totalPlays: number; runPct: number; passPct: number; avgGain: number | string };
  alerts: string[];
  sections: { key: CallSheetSectionKey; title: string; tag: string; wide?: boolean; lines: string[] }[];
  note: string;
  playTypes: { label: string; detail: string; diagram?: string | null }[];
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

/** Each call box gets its own color strip (black and white prints use a plain rule instead). */
const ACCENT: Record<CallSheetSectionKey, string> = {
  firstDownCalls: '#166534',
  runStopCalls: '#b45309',
  thirdDownMustStops: '#1d4ed8',
  passBlitzCalls: '#b91c1c',
  redZoneLocks: '#9f1239',
};

export function defenseSheetHtml(data: SheetData, o: SheetPrintOptions, printedOn = new Date()): string {
  const landscape = o.orientation === 'landscape';
  const bw = o.ink === 'bw';
  const base = o.size === 'large' ? 16.5 : 13;
  // Landscape puts the (non-wide) boxes across, up to four; portrait is two across.
  const shown = data.sections.filter((x) => o.sections[x.key]);
  const callCols = landscape ? Math.min(4, Math.max(2, shown.filter((x) => !x.wide).length)) : 2;

  const alerts = data.alerts.filter(Boolean);
  const alertHtml =
    o.alerts && alerts.length
      ? `<section class="alerts"><div class="alerts-h">High-alert sideline tells</div><ul>${alerts
          .map((line) => {
            const split = line.indexOf(':');
            return split > 0 ? `<li><b>${esc(line.slice(0, split))}:</b>${esc(line.slice(split + 1))}</li>` : `<li>${esc(line)}</li>`;
          })
          .join('')}</ul></section>`
      : '';

  const boxes = data.sections
    .filter((s) => o.sections[s.key])
    .map((s) => {
      const items = s.lines.length
        ? `<ol class="${s.wide ? 'wide-list' : ''}">${s.lines.map((l, i) => `<li><b>${i + 1}</b><span>${esc(l)}</span></li>`).join('')}</ol>`
        : '<p class="none">No calls.</p>';
      return `<article class="box${s.wide ? ' wide' : ''}" style="--accent:${bw ? '#111' : ACCENT[s.key]}"><h3><span>${esc(s.title)}</span><em>${esc(s.tag)}</em></h3>${items}</article>`;
    })
    .join('');

  const header =
    o.title || o.stats
      ? `<header>${
          o.title
            ? `<div><div class="kicker">Defensive coordinator gameplan</div><h1>Opponent scout: ${esc(data.opponentName)}</h1></div>`
            : '<div></div>'
        }${
          o.stats
            ? `<div class="stats"><div>${esc(data.stats.totalPlays)} plays analyzed</div><b>${esc(data.stats.runPct)}% run / ${esc(data.stats.passPct)}% pass &middot; avg ${esc(data.stats.avgGain)} yds</b></div>`
            : ''
        }</header>`
      : '';

  const noteHtml = o.note && data.note.trim() ? `<footer><span>${esc(data.note.trim())}</span></footer>` : '';
  const printed = printedOn.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  const cards = o.playTypes
    ? data.playTypes
        .map((t) => {
          const picture = t.diagram ? `<img src="${esc(t.diagram)}" alt="${esc(t.label)}"/>` : '<div class="empty">Not drawn yet.</div>';
          return `<article class="card"><div class="nm">${esc(t.label)}</div>${o.playTypeDetail && t.detail ? `<div class="detail">${esc(t.detail)}</div>` : ''}${picture}</article>`;
        })
        .join('')
    : '';
  const playTypesHtml = cards
    ? `<section class="plays"><header><div><div class="kicker">Their plays vs. our defense</div><h1>${esc(data.opponentName)}: how we line up</h1></div></header><div class="cards">${cards}</div></section>`
    : '';

  const hasFront = Boolean(header || alertHtml || boxes || noteHtml);
  const title = `${data.opponentName} - defensive call sheet`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title><style>
    @page { size: letter ${o.orientation}; margin: 0.4in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0f172a; font-size: ${base}px; line-height: 1.3;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 2.5px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px; }
    .kicker { font-size: ${base * 0.8}px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 800; color: #475569; }
    h1 { margin: 1px 0 0; font-size: ${base * 1.6}px; line-height: 1.1; letter-spacing: -0.01em; text-transform: uppercase; font-weight: 900; }
    .stats { text-align: right; font-size: ${base * 0.9}px; color: #475569; white-space: nowrap; flex-shrink: 0; }
    .stats b { display: block; color: #0f172a; }
    .alerts { border: 1.5px solid ${bw ? '#111' : '#d97706'}; background: ${bw ? '#fff' : '#fffbeb'}; border-radius: 6px; padding: 7px 10px; margin-bottom: 10px; break-inside: avoid; }
    .alerts-h { font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; font-size: ${base * 0.88}px; color: ${bw ? '#111' : '#92400e'}; margin-bottom: 4px; }
    .alerts ul { margin: 0; padding-left: 16px; columns: ${landscape ? 2 : 1}; column-gap: 24px; }
    .alerts li { margin: 2px 0; break-inside: avoid; }
    .calls { display: grid; grid-template-columns: repeat(${callCols}, 1fr); gap: 9px; align-items: stretch; }
    .box { border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden; break-inside: avoid; background: #fff; display: flex; flex-direction: column; }
    .box.wide { grid-column: 1 / -1; }
    .box h3 { margin: 0; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 4px 8px;
      font-size: ${base * 0.95}px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 900;
      ${bw ? 'border-bottom: 2px solid #111; color: #111; background: #fff;' : 'background: var(--accent); color: #fff;'} }
    .box h3 em { white-space: nowrap; font-style: normal; font-weight: 700; font-size: ${base * 0.78}px; letter-spacing: 0.08em; opacity: 0.85; }
    .box ol { list-style: none; margin: 0; padding: 4px 6px 6px; }
    .box ol.wide-list { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 14px; }
    .box li { display: flex; gap: 8px; align-items: baseline; padding: 4px 4px; border-bottom: 1px solid #e2e8f0; break-inside: avoid; font-size: ${base * 1.1}px; font-weight: 700; }
    .box li:last-child { border-bottom: 0; }
    .box li b { min-width: 1.3em; text-align: right; color: ${bw ? '#111' : 'var(--accent)'}; font-weight: 900; ${o.numbers ? '' : 'display: none;'} }
    .none { margin: 0; padding: 6px 10px; color: #64748b; font-style: italic; }
    footer { margin-top: 10px; padding-top: 6px; border-top: 1px solid #94a3b8; color: #334155; font-size: ${base * 0.95}px; display: flex; justify-content: space-between; gap: 12px; }
    .printed { color: #94a3b8; font-size: ${base * 0.8}px; margin-top: 6px; text-align: right; }
    .plays { ${hasFront ? 'break-before: page;' : ''} }
    .cards { display: grid; grid-template-columns: repeat(${o.playTypeCols}, 1fr); gap: 10px; }
    .card { border: 1.5px solid #0f172a; border-radius: 6px; padding: 6px 8px 8px; break-inside: avoid; }
    .card .nm { font-weight: 900; font-size: ${base * (o.playTypeCols === 3 ? 1 : 1.2)}px; text-transform: uppercase; letter-spacing: 0.02em; }
    .card .detail { color: #475569; font-size: ${base * (o.playTypeCols === 3 ? 0.78 : 0.9)}px; margin-top: 1px; }
    .card img { display: block; width: 100%; height: auto; margin-top: 5px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; ${bw ? 'filter: grayscale(1) contrast(1.15);' : ''} }
    .empty { margin-top: 6px; border: 1px dashed #94a3b8; border-radius: 4px; padding: 18px 8px; text-align: center; color: #64748b; font-size: ${base * 0.9}px; }
  </style></head><body>${header}${alertHtml}${boxes ? `<div class="calls">${boxes}</div>` : ''}${noteHtml}${hasFront ? `<div class="printed">Printed ${esc(printed)}</div>` : ''}${playTypesHtml}</body></html>`;
}
