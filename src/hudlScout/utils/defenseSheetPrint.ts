// The sideline defensive call sheet, printed from its own clean page (not by printing the app): the coach
// chooses what shows, how big the text is, color or black and white, and the paper direction. The choices
// are remembered on this device.
import { printableDiagram } from '../../utils/printDiagram';
import type { CallSheetSectionKey } from '../scoutBundle';

export interface SheetPrintOptions {
  /** The title line ("Opponent scout: ..."). */
  title: boolean;
  /** Plays analyzed, run / pass split and average gain. */
  stats: boolean;
  /** The high-alert tells. */
  alerts: boolean;
  /** Which call boxes print (a box not listed prints, e.g. one the coach added). */
  sections: Record<string, boolean>;
  /** The reminder line at the bottom. */
  note: boolean;
  /** Their plays against our defense, on its own page(s). */
  playTypes: boolean;
  /** Our calls against each of their formations (base + situations). */
  formationPlans: boolean;
  /** Formations across on that part of the sheet. */
  formationCols: 1 | 2 | 3;
  /** The picture of our defense against each formation. */
  formationPicture: boolean;
  /** The game plan notes under each formation. */
  formationNotes: boolean;
  /** Their plays under each formation, in one or two columns. */
  theirPlayCols: 1 | 2;
  /** Each of their plays with its coaching point. */
  theirPlayPoints: boolean;
  /** Plays across the page on that page. */
  playTypeCols: 1 | 2 | 3;
  /** The calls and film counts under each play's name. */
  playTypeDetail: boolean;
  /** Each play's coaching point on its card. */
  playTypePoints: boolean;
  /** The picture on each card. */
  playTypePicture: boolean;
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
  formationPlans: true,
  formationCols: 2,
  formationPicture: true,
  formationNotes: true,
  theirPlayCols: 2,
  theirPlayPoints: true,
  playTypeCols: 2,
  playTypeDetail: true,
  playTypePoints: true,
  playTypePicture: true,
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
  sections: { key: string; title: string; tag: string; wide?: boolean; lines: string[] }[];
  note: string;
  playTypes: { label: string; detail: string; diagram?: string | null; points?: { name: string; point: string }[] }[];
  /** Our calls against each of their formations. */
  formationPlans?: SheetFormationPlan[];
}

export interface SheetFormationPlan {
  name: string;
  lines: { situation: string; call: string }[];
  /** Their plays from it, each with its coaching point. */
  theirPlays?: { name: string; point?: string }[];
  /** The coach's game plan notes for it. */
  notes?: string;
  diagram?: string;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

/** Each call box gets its own color strip (black and white prints use a plain rule instead). */
const ACCENT: Record<string, string> = {
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
  const shown = data.sections.filter((x) => o.sections[x.key] !== false);
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
    .filter((s) => o.sections[s.key] !== false)
    .map((s) => {
      const items = s.lines.length
        ? `<ol class="${s.wide ? 'wide-list' : ''}">${s.lines.map((l, i) => `<li><b>${i + 1}</b><span>${esc(l)}</span></li>`).join('')}</ol>`
        : '<p class="none">No calls.</p>';
      return `<article class="box${s.wide ? ' wide' : ''}" style="--accent:${bw ? '#111' : ACCENT[s.key] || '#0f766e'}"><h3><span>${esc(s.title)}</span><em>${esc(s.tag)}</em></h3>${items}</article>`;
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
          const picture = !o.playTypePicture
            ? ''
            : t.diagram
              ? `<img src="${esc(printableDiagram(t.diagram) || '')}" alt="${esc(t.label)}"/>`
              : '<div class="empty">Not drawn yet.</div>';
          const points = o.playTypePoints ? (t.points || []).filter((p) => p.point.trim()) : [];
          const pointsHtml = points.length
            ? `<ul class="points">${points.map((p) => `<li><b>${esc(p.name)}</b> ${esc(p.point.trim())}</li>`).join('')}</ul>`
            : '';
          return `<article class="card"><div class="nm">${esc(t.label)}</div>${o.playTypeDetail && t.detail ? `<div class="detail">${esc(t.detail)}</div>` : ''}${picture}${pointsHtml}</article>`;
        })
        .join('')
    : '';
  const playTypesHtml = cards
    ? `<section class="plays"><header><div><div class="kicker">Their plays vs. our defense</div><h1>${esc(data.opponentName)}: how we line up</h1></div></header><div class="cards">${cards}</div></section>`
    : '';

  // Our calls against each of their formations: the formation (with our defense), the base call, then the situations.
  const plans = o.formationPlans ? data.formationPlans || [] : [];
  const plansHtml = plans.length
    ? `<section class="fplans"><div class="fplans-h">Our calls vs their formations</div><div class="fgrid">${plans
        .map((f) => {
          const picture = o.formationPicture && f.diagram ? `<img src="${esc(printableDiagram(f.diagram) || '')}" alt="${esc(f.name)}"/>` : '';
          const calls = f.lines.length
            ? `<ul>${f.lines.map((l) => `<li class="${l.situation === 'Base' ? 'base' : ''}"><b>${esc(l.situation)}</b><span>${esc(l.call)}</span></li>`).join('')}</ul>`
            : '';
          const notes = o.formationNotes && f.notes?.trim() ? `<div class="fnotes"><b>Game plan notes</b><p>${esc(f.notes.trim())}</p></div>` : '';
          const theirs = f.theirPlays?.length
            ? `<div class="their"><b>Their plays</b><ul>${f.theirPlays
                .map((p) => `<li><span class="tp">${esc(p.name)}</span>${o.theirPlayPoints && p.point?.trim() ? `<span class="pt">${esc(p.point.trim())}</span>` : ''}</li>`)
                .join('')}</ul></div>`
            : '';
          return `<article class="fplan">${picture}<div><h3>vs ${esc(f.name)}</h3>${calls}${notes}${theirs}</div></article>`;
        })
        .join('')}</div></section>`
    : '';
  const hasFront = Boolean(header || alertHtml || boxes || noteHtml || plansHtml);
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
    .card .points { list-style: none; margin: 5px 0 0; padding: 4px 0 0; border-top: 1px solid #94a3b8; }
    .card .points li { font-size: ${base * (o.playTypeCols === 3 ? 0.8 : 0.92)}px; padding: 1px 0; }
    .card .points b { text-transform: uppercase; }
    .fplans { margin-top: 10px; break-inside: auto; }
    .fplans-h { font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; font-size: ${base * 0.95}px; border-bottom: 2px solid #0f172a; padding-bottom: 3px; margin-bottom: 6px; }
    .fgrid { display: grid; grid-template-columns: repeat(${o.formationCols || 2}, minmax(0, 1fr)); gap: 8px; }
    .fplan { border: 1.5px solid ${bw ? '#111' : '#065f46'}; border-radius: 6px; padding: 5px 7px; break-inside: avoid; display: flex; flex-direction: column; gap: 4px; }
    .fplan img { width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; ${bw ? 'filter: grayscale(1) contrast(1.15);' : ''} }
    .fplan h3 { margin: 0; font-size: ${base * 1.05}px; font-weight: 900; text-transform: uppercase; color: ${bw ? '#111' : '#065f46'}; }
    .fplan ul { list-style: none; margin: 2px 0 0; padding: 0; }
    .fplan li { display: flex; gap: 6px; align-items: baseline; padding: 2px 0; border-bottom: 1px solid #e2e8f0; font-size: ${base * 1.02}px; }
    .fplan li:last-child { border-bottom: 0; }
    .fplan li b { min-width: 6.5em; font-size: ${base * 0.85}px; text-transform: uppercase; color: #475569; }
    .fplan li.base span { font-weight: 900; }
    .fplan .their { margin-top: 4px; }
    .fplan .their ul { columns: ${o.theirPlayCols === 1 ? 1 : 2}; column-gap: 12px; }
    .fplan .their li { display: block; break-inside: avoid; padding: 1px 0; font-size: ${base * 0.95}px; }
    .fplan .their .tp { font-weight: 700; }
    .fplan .their .pt { display: block; font-size: ${base * 0.85}px; color: #334155; line-height: 1.25; padding-left: 8px; }
    .fplan .their, .fnotes { margin-top: 6px; }
    .fnotes { margin-top: 4px; }
    .fnotes > b { display: block; font-size: ${base * 0.85}px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; border-bottom: 1px solid #94a3b8; padding-bottom: 1px; }
    .fnotes p { margin: 2px 0 0; white-space: pre-line; font-size: ${base * 0.98}px; font-weight: 600; }
    .fplan .their > b { display: block; font-size: ${base * 0.85}px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; border-bottom: 1px solid #94a3b8; padding-bottom: 1px; }
    @media screen {
      html { background: #cbd5e1; }
      body { background: #fff; width: ${landscape ? 11 : 8.5}in; min-height: ${landscape ? 8.5 : 11}in; margin: 0 auto; padding: 0.4in; }
      ${hasFront ? `.plays { margin-top: 0.4in; padding-top: 0.3in; border-top: 3px dashed #94a3b8; position: relative; } .plays::before { content: 'New page'; position: absolute; top: -0.75em; right: 0; background: #fff; padding: 0 6px; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }` : ''}
    }
    .empty { margin-top: 6px; border: 1px dashed #94a3b8; border-radius: 4px; padding: 18px 8px; text-align: center; color: #64748b; font-size: ${base * 0.9}px; }
  </style></head><body>${header}${alertHtml}${boxes ? `<div class="calls">${boxes}</div>` : ''}${plansHtml}${noteHtml}${hasFront ? `<div class="printed">Printed ${esc(printed)}</div>` : ''}${playTypesHtml}</body></html>`;
}
