/**
 * Bulletproof Print Engine for Football Manager
 * Handles practice plans, depth charts, wristbands, and schedules.
 * Supports direct window printing, clean standalone iframe printing, and new tab printable view.
 */

import { PracticePlan, PracticePeriod, RosterPlayer, AttendanceRecord, SeasonConfig, calculatePlayerCompliance, SingleWristband, WristbandPlay, FormationBoard, PlacedPlayer } from '../types';
import { calculatePlayerHours, getPlayerHoursBreakdown } from './hoursCalculation';
import { formatWeekLabel } from './seasonWeekUtils';
import { getWristbandStartNumber } from './wristbandLinking';
import { CallSheetFullData, CallSheetSection, CallSheetPlay } from '../types/callSheet';

export interface PrintOptions {
  beforePrint?: () => void;
  afterPrint?: () => void;
  targetElementSelector?: string;
  documentTitle?: string;
  orientation?: 'portrait' | 'landscape';
  extraStyles?: string;
  bodyClasses?: string[];
}

/**
 * Standard direct window print with robust cleanup and immediate trigger.
 */
export function triggerPrint(options?: PrintOptions) {
  if (typeof window === 'undefined') return;

  const { beforePrint, afterPrint, orientation, extraStyles, bodyClasses, documentTitle } = options || {};

  if (beforePrint) {
    try {
      beforePrint();
    } catch (err) {
      console.warn('Error in beforePrint:', err);
    }
  }

  // Inject dynamic print style if orientation or extraStyles specified
  let styleEl: HTMLStyleElement | null = null;
  if (orientation || extraStyles) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-helper-style';
    styleEl.textContent = `
      @media print {
        @page {
          size: letter ${orientation || 'landscape'} !important;
          margin: 0.2in !important;
        }
        ${extraStyles || ''}
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Backup and set document title if provided
  const prevTitle = document.title;
  if (documentTitle) {
    document.title = documentTitle;
  }

  document.documentElement.classList.add('is-printing');
  document.body.classList.add('is-printing');

  if (bodyClasses && Array.isArray(bodyClasses)) {
    bodyClasses.forEach((cls) => {
      document.documentElement.classList.add(cls);
      document.body.classList.add(cls);
    });
  }

  let cleanedUp = false;
  const doCleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.documentElement.classList.remove('is-printing');
    document.body.classList.remove('is-printing');
    if (bodyClasses && Array.isArray(bodyClasses)) {
      bodyClasses.forEach((cls) => {
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
      });
    }
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
    if (documentTitle && prevTitle) {
      document.title = prevTitle;
    }
    window.removeEventListener('afterprint', doCleanup);
    window.removeEventListener('focus', onFocusReturn);
    if (afterPrint) {
      try {
        afterPrint();
      } catch (err) {
        console.warn('Error in afterPrint:', err);
      }
    }
  };

  const onFocusReturn = () => {
    setTimeout(doCleanup, 300);
  };

  window.addEventListener('afterprint', doCleanup, { once: true });
  window.addEventListener('focus', onFocusReturn, { once: true });

  try {
    window.focus();
    window.print();
  } catch (err) {
    console.error('Direct window.print() failed:', err);
    doCleanup();
  }
}

/**
 * Generate clean, self-contained HTML for a Practice Plan
 */
export function generatePracticePlanHTML(
  plan: PracticePlan | null,
  periods: PracticePeriod[],
  seqInfo?: { practiceNumber?: number; isCancelled?: boolean } | null,
  fontSize: number = 12
): string {
  const title = plan?.title || 'Practice Plan';
  const date = plan?.date || '';
  const day = plan?.day || '';
  const startTime = plan?.startTime || '5:05 PM';
  const endTime = plan?.endTime || '';
  const location = plan?.location || 'Crane Road';
  const weekFolder = plan?.weekFolder || 'Week 1';
  const isCancelled = Boolean(seqInfo?.isCancelled || plan?.isCancelled);
  const pracNum = seqInfo?.practiceNumber ? `Day #${seqInfo.practiceNumber} (Prac #${seqInfo.practiceNumber})` : '';

  let currentStartMinutes = 305; // 5:05 PM
  if (startTime) {
    const match = startTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      let hrs = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const ampm = (match[3] || 'PM').toUpperCase();
      if (ampm === 'PM' && hrs < 12) hrs += 12;
      if (ampm === 'AM' && hrs === 12) hrs = 0;
      currentStartMinutes = hrs * 60 + mins;
    }
  }

  const formatTime = (min: number) => {
    let h = Math.floor(min / 60) % 24;
    const m = min % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  let rowsHtml = '';
  periods.forEach((period) => {
    const duration = Number(period.time) || 0;
    const periodEndMin = currentStartMinutes + duration;
    const timeStr = `${formatTime(currentStartMinutes)} - ${formatTime(periodEndMin)}`;
    const isRotating = period.format === 'rotating';
    const stations = Array.isArray(period.stations) && period.stations.length > 0
      ? period.stations
      : [{ name: '', desc: '', coach: '', focus: '' }];

    stations.forEach((st, sIdx) => {
      const isFirst = sIdx === 0;
      const numStations = stations.length;

      let timeCol = '';
      let catCol = '';

      if (isFirst) {
        timeCol = `
          <td rowspan="${numStations}" style="width: 14%; border: 1.2px solid #000; padding: 4px 6px; vertical-align: top; font-weight: 800; background: #fff; line-height: 1.25;">
            <div style="font-size: ${fontSize + 1}px; font-weight: 900; color: #000;">${timeStr}</div>
            <div style="font-size: ${fontSize - 1}px; color: #475569; font-weight: 700; margin-top: 2px;">${duration} min ${isRotating ? '• ROTATING' : ''}</div>
          </td>
        `;
        catCol = `
          <td rowspan="${numStations}" style="width: 12%; border: 1.2px solid #000; padding: 4px 6px; vertical-align: top; background: #fff;">
            <span style="display: inline-block; font-size: ${fontSize - 1}px; font-weight: 900; text-transform: uppercase; color: #000; background: #e2e8f0; border: 1px solid #94a3b8; border-radius: 4px; padding: 2px 5px;">
              ${period.category || 'General'}
            </span>
          </td>
        `;
      }

      rowsHtml += `
        <tr style="page-break-inside: avoid; break-inside: avoid;">
          ${timeCol}
          ${catCol}
          <td style="width: 46%; border: 1.2px solid #000; padding: 4px 6px; vertical-align: top; background: #fff;">
            <div style="font-size: ${fontSize + 1}px; font-weight: 900; text-transform: uppercase; color: #000;">
              ${st.name || 'Station / Drill'}
            </div>
            ${st.desc ? `<div style="font-size: ${fontSize}px; color: #0f172a; margin-top: 2px; white-space: pre-wrap; line-height: 1.35;">${st.desc}</div>` : ''}
          </td>
          <td style="width: 13%; border: 1.2px solid #000; padding: 4px 6px; vertical-align: top; font-weight: 700; font-size: ${fontSize}px; color: #000; background: #fff; word-break: break-word;">
            ${st.coach || '—'}
          </td>
          <td style="width: 15%; border: 1.2px solid #000; padding: 4px 6px; vertical-align: top; font-size: ${fontSize}px; color: #000; background: #fff; white-space: pre-wrap; line-height: 1.3;">
            ${st.focus || '—'}
          </td>
        </tr>
      `;
    });

    currentStartMinutes = periodEndMin;
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Mahopac 10U Practice Plan - ${title}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.25in;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background-color: #ffffff;
            color: #000000;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: ${fontSize}px;
          }
          .header {
            border-bottom: 2.5px solid #000000;
            padding-bottom: 5px;
            margin-bottom: 8px;
          }
          .header-top {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
          }
          .title {
            font-size: 16pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.02em;
            margin: 0;
            color: #000;
          }
          .sub-badge {
            font-size: 11pt;
            font-weight: 900;
            color: #000;
          }
          .header-meta {
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            font-weight: 700;
            color: #1e293b;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin: 0;
          }
          thead {
            display: table-header-group;
          }
          th {
            background-color: #f1f5f9;
            color: #000000;
            border: 1.5px solid #000000;
            border-bottom: 2.5px solid #000000;
            padding: 5px 6px;
            font-size: ${fontSize}px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            text-align: left;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-top">
            <h1 class="title">Mahopac 10U Practice Plan</h1>
            <div class="sub-badge">
              ${isCancelled ? '[CANCELLED SESSION] • ' : ''}${pracNum ? pracNum + ' • ' : ''}${title}
            </div>
          </div>
          <div class="header-meta">
            <span>Date: ${date} (${day}) • Time: ${startTime}${endTime ? ` - ${endTime}` : ''} • Location: ${location}</span>
            <span>${weekFolder}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 14%;">Time / Period</th>
              <th style="width: 12%;">Category</th>
              <th style="width: 46%;">Stations / Drills</th>
              <th style="width: 13%;">Coaches</th>
              <th style="width: 15%;">Focus / Cues</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

/**
 * Print clean standalone HTML via a dedicated isolated hidden iframe.
 * If iframe fails or is blocked by sandbox, falls back to new window popup or direct print.
 */
export function printCleanHTML(htmlString: string, documentTitle?: string) {
  if (typeof window === 'undefined') return;

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      openCleanPrintTab(htmlString, documentTitle);
      return;
    }

    doc.open();
    doc.write(htmlString);
    doc.close();

    let didPrint = false;
    const cleanup = () => {
      try {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      } catch {}
    };

    const triggerIframePrint = () => {
      if (didPrint) return;
      didPrint = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print blocked, opening standalone print tab:', err);
        openCleanPrintTab(htmlString, documentTitle);
      } finally {
        setTimeout(cleanup, 2500);
      }
    };

    if (doc.readyState === 'complete') {
      setTimeout(triggerIframePrint, 250);
    } else {
      iframe.onload = () => setTimeout(triggerIframePrint, 200);
      setTimeout(triggerIframePrint, 600);
    }
  } catch (err) {
    console.warn('Print iframe creation error, falling back to clean tab:', err);
    openCleanPrintTab(htmlString, documentTitle);
  }
}

/**
 * Opens a clean printable sheet in a new tab/window and triggers print.
 * Uses a Blob URL to guarantee compatibility and prevent popup/sandbox blocking.
 */
export function openCleanPrintTab(htmlString: string, documentTitle?: string) {
  if (typeof window === 'undefined') return;

  const scriptTag = `
    <script>
      window.addEventListener('load', function() {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 350);
      });
    </script>
  `;

  const fullHtml = htmlString.includes('</body>')
    ? htmlString.replace('</body>', `${scriptTag}</body>`)
    : `${htmlString}${scriptTag}`;

  try {
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
  } catch (e) {
    console.warn('Blob URL print tab blocked, trying direct window open:', e);
  }

  // Fallback: direct window.open with document write
  try {
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(fullHtml);
      win.document.close();
      win.focus();
      return;
    }
  } catch (e) {
    console.warn('Direct popup window open blocked:', e);
  }

  triggerPrint();
}

export interface SinglePlaybookPrintOptions {
  teamName?: string;
  teamSeason?: string;
  category: string;
  subTab: string;
  content: string;
  inkFriendly?: boolean;
}

export interface PlaybookBinderSection {
  category: string;
  subTab: string;
  content: string;
}

export interface PlaybookBinderPrintOptions {
  teamName?: string;
  teamSeason?: string;
  headCoachName?: string;
  title?: string;
  sections: PlaybookBinderSection[];
  inkFriendly?: boolean;
  includeCoverPage?: boolean;
}

/**
 * Common print CSS rules for ink-friendly high-contrast output
 */
const INK_FRIENDLY_PLAYBOOK_CSS = `
  @page {
    size: letter portrait;
    margin: 0.4in;
  }
  *, *:before, *:after {
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body, html {
    display: block !important;
    width: 100% !important;
    float: none !important;
    background: #ffffff !important;
    color: #0f172a !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 9.5pt !important;
    line-height: 1.35 !important;
  }
  .playbook-container {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .top-nav, .bottom-nav, select, button, .action-btn, .play-nav {
    display: none !important;
  }
  .field-wrap {
    margin: 8px 0 !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px !important;
    background: #ffffff !important;
    overflow: hidden !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  svg {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    max-height: 4.6in !important;
  }
  .meta-bar {
    display: block !important;
    padding: 8px 12px !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px !important;
    background: #f8fafc !important;
    margin: 8px 0 !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .concepts-text {
    font-size: 8.5pt !important;
    color: #334155 !important;
    line-height: 1.4 !important;
  }
  .table-section {
    padding: 8px 0 12px 0 !important;
    overflow: visible !important;
    width: 100% !important;
  }
  .table-section table, table {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: 8.5pt !important;
    text-align: left !important;
    page-break-inside: auto !important;
    break-inside: auto !important;
  }
  .table-section thead th, thead th, th {
    padding: 6px 8px !important;
    font-size: 8pt !important;
    font-weight: 800 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
    color: #334155 !important;
    border: 1px solid #cbd5e1 !important;
    background: #f1f5f9 !important;
  }
  .table-section tbody td, tbody td, td {
    padding: 6px 8px !important;
    color: #0f172a !important;
    border: 1px solid #cbd5e1 !important;
    vertical-align: top !important;
    line-height: 1.35 !important;
    font-size: 8pt !important;
  }
  .card, .wrapper, .box, .container, [class*="card"] {
    background: #ffffff !important;
    color: #0f172a !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px !important;
    box-shadow: none !important;
    padding: 10px 14px !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #0f172a !important;
    margin-top: 0 !important;
    font-weight: 800 !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }
  .header {
    border-bottom: 2px solid #0f172a !important;
    padding-bottom: 6px !important;
    margin-bottom: 10px !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }
  .badge {
    background: #0284c7 !important;
    color: #ffffff !important;
    border-radius: 4px !important;
    padding: 2px 8px !important;
    font-size: 8pt !important;
    font-weight: bold !important;
  }
  .diagram-box {
    background: #f8fafc !important;
    border: 1.5px dashed #0f766e !important;
    border-radius: 6px !important;
    height: 195px !important;
    max-height: 205px !important;
    color: #042f2e !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    margin-bottom: 10px !important;
    position: relative !important;
    overflow: hidden !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  .grid-lines {
    position: absolute !important;
    width: 100% !important;
    height: 100% !important;
    background-size: 20px 20px !important;
    background-image: linear-gradient(to right, rgba(0, 0, 0, 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.07) 1px, transparent 1px) !important;
  }
  .diagram-title {
    z-index: 1 !important;
    font-weight: 900 !important;
    font-size: 11pt !important;
    color: #042f2e !important;
  }
  .diagram-sub {
    z-index: 1 !important;
    font-size: 8.5pt !important;
    color: #0f766e !important;
    font-weight: 600 !important;
  }
  table, .assignments-table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin-top: 8px !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  thead {
    display: table-header-group !important;
  }
  th, .assignments-table th {
    background: #f1f5f9 !important;
    color: #0f172a !important;
    border: 1px solid #94a3b8 !important;
    padding: 5px 8px !important;
    font-size: 8pt !important;
    font-weight: 800 !important;
    text-transform: uppercase !important;
  }
  td, .assignments-table td {
    border: 1px solid #cbd5e1 !important;
    color: #0f172a !important;
    padding: 5px 8px !important;
    font-size: 8pt !important;
    line-height: 1.25 !important;
  }
  tr, .tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .pos-tag {
    background: #e2e8f0 !important;
    color: #0369a1 !important;
    border: 1px solid #cbd5e1 !important;
    padding: 1px 5px !important;
    border-radius: 4px !important;
    font-weight: 800 !important;
    font-family: monospace !important;
    display: inline-block !important;
    font-size: 7.5pt !important;
  }
  .notes-box, .notes {
    background: #f8fafc !important;
    border-left: 3.5px solid #d97706 !important;
    border-top: 1px solid #e2e8f0 !important;
    border-right: 1px solid #e2e8f0 !important;
    border-bottom: 1px solid #e2e8f0 !important;
    color: #334155 !important;
    padding: 8px 12px !important;
    margin-top: 10px !important;
    border-radius: 0 4px 4px 0 !important;
    font-size: 8pt !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  /* Normalize dark utility backgrounds */
  [class*="bg-slate-"], [class*="bg-zinc-"], [class*="bg-neutral-"], [class*="bg-gray-"] {
    background: #ffffff !important;
    color: #0f172a !important;
  }
  [class*="text-slate-100"], [class*="text-slate-200"], [class*="text-white"], [class*="text-slate-300"] {
    color: #0f172a !important;
  }
  [class*="text-slate-400"], [class*="text-slate-500"] {
    color: #475569 !important;
  }
  [class*="border-slate-"] {
    border-color: #cbd5e1 !important;
  }
`;

/**
 * Generate a blank playbook install worksheet if the section has no content
 */
function generateBlankPlaybookWorksheet(category: string, subTab: string): string {
  return `
    <div class="card">
      <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 16pt;">${subTab.toUpperCase()}</h1>
          <div style="font-size: 9pt; color: #475569; margin-top: 3px;">Category: ${category} • Formation & Scheme Install Worksheet</div>
        </div>
        <span class="badge">${category.toUpperCase()}</span>
      </div>

      <div class="diagram-box">
        <div class="grid-lines"></div>
        <div class="diagram-title">🏈 PLAY SCHEMATIC & FIELD DIAGRAM</div>
        <div class="diagram-sub">Sketch Formation, Motion & Route Trees / Defensive Gap Fits</div>
      </div>

      <table class="assignments-table">
        <thead>
          <tr>
            <th style="width: 80px;">Pos</th>
            <th style="width: 140px;">Alignment</th>
            <th>Assignment & Key Read</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="pos-tag">QB</span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td><span class="pos-tag">RB</span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td><span class="pos-tag">X / WR1</span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td><span class="pos-tag">Z / WR2</span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td><span class="pos-tag">H / Slot</span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td><span class="pos-tag">TE</span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          <tr>
            <td><span class="pos-tag">OL</span></td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      <div class="notes-box">
        <strong>Coaching Points & Scheme Rules:</strong>
        <div style="height: 48px; border-bottom: 1px dotted #cbd5e1; margin-top: 6px;"></div>
      </div>
    </div>
  `;
}

/**
 * Safely extracts, cleans, and sanitizes playbook HTML content for printing.
 * - Extracts body content if it is a full HTML document (even if unclosed)
 * - Strips any web navigation controls (.top-nav, .bottom-nav, select dropdowns, action buttons)
 * - Neutralizes any embedded <style> tags that define global `body { display: flex }` or `*` rules
 * - Automatically repairs unclosed tags to prevent section bleed/nesting in multi-page documents
 */
export function extractAndSanitizePlaybookHtml(
  rawContent: string | undefined,
  category: string,
  subTab: string
): string {
  if (!rawContent || !rawContent.trim()) {
    return generateBlankPlaybookWorksheet(category, subTab);
  }

  const trimmed = rawContent.trim();

  // If it is an image data URI or image link
  if (trimmed.startsWith('data:image/') || trimmed.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)) {
    return `
      <div class="card" style="text-align: center; padding: 14px;">
        <div class="header">
          <h1 style="margin: 0; font-size: 15pt;">${subTab.toUpperCase()}</h1>
          <div style="font-size: 9pt; color: #475569; margin-top: 3px;">Category: ${category}</div>
        </div>
        <img src="${trimmed}" alt="${subTab}" style="max-width: 100%; max-height: 8.2in; object-fit: contain; margin: 12px auto; display: block;" />
      </div>
    `;
  }

  // Use DOMParser in browser for resilient HTML tree parsing & auto-closing of unclosed tags
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'text/html');

      // 1. Remove non-printable web UI interactive controls and dropdowns
      doc.querySelectorAll('.top-nav, .bottom-nav, select, .play-nav, button.action-btn, button').forEach((el) => {
        el.remove();
      });

      // 2. Remove script and link tags
      doc.querySelectorAll('script, link').forEach((el) => el.remove());

      // 3. Neutralize any global style rules (e.g. body { display: flex }) so they don't break the outer document
      doc.querySelectorAll('style').forEach((styleEl) => {
        let css = styleEl.textContent || '';
        css = css.replace(/(^|[,\s}])\s*(body|html)\s*\{/gi, '$1 .playbook-main-content {');
        css = css.replace(/(^|[,\s}])\s*\*\s*\{/gi, '$1 .playbook-main-content * {');
        styleEl.textContent = css;
      });

      const bodyHtml = doc.body ? doc.body.innerHTML.trim() : '';
      if (bodyHtml) {
        return bodyHtml;
      }
    } catch (err) {
      console.warn('DOMParser extraction warning, falling back to regex sanitizer:', err);
    }
  }

  // Regex fallback
  let bodyContent = trimmed;
  if (bodyContent.includes('<body') || bodyContent.includes('<BODY')) {
    const match = bodyContent.match(/<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i);
    if (match && match[1]) {
      bodyContent = match[1];
    }
  } else if (bodyContent.includes('<head') || bodyContent.includes('<HEAD')) {
    bodyContent = bodyContent.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  }

  // Strip scripts, links, and web navigation elements
  bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  bodyContent = bodyContent.replace(/<link[^>]*>/gi, '');
  bodyContent = bodyContent.replace(/<div class="top-nav">[\s\S]*?<\/div>/gi, '');
  bodyContent = bodyContent.replace(/<div class="bottom-nav">[\s\S]*?<\/div>/gi, '');
  bodyContent = bodyContent.replace(/<select[^>]*>[\s\S]*?<\/select>/gi, '');
  bodyContent = bodyContent.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');

  // Strip doc tags
  bodyContent = bodyContent.replace(/<\/?(html|head|body)[^>]*>/gi, '');
  bodyContent = bodyContent.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Neutralize global body/html style selectors
  bodyContent = bodyContent.replace(/(^|[,\s}])\s*(body|html)\s*\{/gi, '$1 .playbook-main-content {');

  return bodyContent;
}

/**
 * Generate self-contained HTML for a single Playbook Guide
 */
export function generatePlaybookGuidePrintHTML(options: SinglePlaybookPrintOptions): string {
  const {
    teamName = 'Mahopac Indians',
    teamSeason = '10U Football',
    category,
    subTab,
    content,
    inkFriendly = true,
  } = options;

  const bodyContent = extractAndSanitizePlaybookHtml(content, category, subTab);

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${teamName} - ${category} - ${subTab}</title>
  <style>
    ${inkFriendly ? INK_FRIENDLY_PLAYBOOK_CSS : `
      @page { size: letter portrait; margin: 0.4in; }
      html, body {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        float: none !important;
        background: #ffffff !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .playbook-container {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .top-nav, .bottom-nav, select, button, .action-btn, .play-nav {
        display: none !important;
      }
      .field-wrap {
        margin: 8px 0 !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        background: #ffffff !important;
        overflow: hidden !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      svg {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        max-height: 4.6in !important;
      }
      .meta-bar {
        display: block !important;
        padding: 8px 12px !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        background: #f8fafc !important;
        margin: 8px 0 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .concepts-text {
        font-size: 8.5pt !important;
        color: #334155 !important;
        line-height: 1.4 !important;
      }
      .table-section {
        padding: 8px 0 12px 0 !important;
        overflow: visible !important;
        width: 100% !important;
      }
      .table-section table, table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 8.5pt !important;
        text-align: left !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      .table-section thead th, thead th, th {
        padding: 6px 8px !important;
        font-size: 8pt !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        color: #334155 !important;
        border: 1px solid #cbd5e1 !important;
        background: #f1f5f9 !important;
      }
      .table-section tbody td, tbody td, td {
        padding: 6px 8px !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        vertical-align: top !important;
        line-height: 1.35 !important;
        font-size: 8pt !important;
      }
      .pos-name {
        font-weight: 800 !important;
        color: #0f172a !important;
        white-space: nowrap !important;
      }
      .pos-desc {
        font-weight: normal !important;
        color: #64748b !important;
        font-size: 7.5pt !important;
        display: block !important;
      }
      .tag-contain { color: #0284c7 !important; font-weight: 700 !important; }
      .tag-blitz { color: #dc2626 !important; font-weight: 700 !important; }
      .tag-cover { color: #7c3aed !important; font-weight: 700 !important; }
      .tag-stunt { color: #d97706 !important; font-weight: 700 !important; }
    `}
    .playbook-section {
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .playbook-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 14px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    .playbook-top-bar .team-brand {
      color: #0f172a;
      font-size: 10.5pt;
      font-weight: 900;
    }
    .playbook-bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      margin-top: 14px;
      font-size: 7.5pt;
      color: #64748b;
      break-before: avoid !important;
      page-break-before: avoid !important;
    }
    tr, .tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    .diagram-box, figure, img, svg { page-break-inside: avoid !important; break-inside: avoid !important; }
    .notes-box, .notes { page-break-inside: avoid !important; break-inside: avoid !important; }
    thead { display: table-header-group !important; }
  </style>
</head>
<body>
  <section class="playbook-section">
    <div class="playbook-top-bar">
      <span class="team-brand">🏈 ${teamName} &bull; ${teamSeason}</span>
      <span>${category} &gt; ${subTab}</span>
      <span>Printed: ${currentDate}</span>
    </div>

    <div class="playbook-main-content">
      ${bodyContent}
    </div>

    <div class="playbook-bottom-bar">
      <span>CONFIDENTIAL TEAM INSTALL SHEET &bull; PROPERTY OF ${teamName.toUpperCase()}</span>
      <span>Playbook &amp; Position Install Guides</span>
    </div>
  </section>
</body>
</html>`;
}

/**
 * Generate self-contained HTML for a multi-page Playbook Binder (Category or Full Team)
 */
export function generatePlaybookBinderPrintHTML(options: PlaybookBinderPrintOptions): string {
  const {
    teamName = 'Mahopac Indians',
    teamSeason = '10U Football',
    headCoachName = '',
    title = 'Team Playbook & Positional Install Binder',
    sections,
    inkFriendly = true,
    includeCoverPage = true,
  } = options;

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Group sections by category for Table of Contents
  const categoriesMap: Record<string, { sec: PlaybookBinderSection; globalIndex: number }[]> = {};
  sections.forEach((sec, idx) => {
    if (!categoriesMap[sec.category]) categoriesMap[sec.category] = [];
    categoriesMap[sec.category].push({ sec, globalIndex: idx + 1 });
  });

  let tocHtml = '';
  Object.keys(categoriesMap).forEach((cat) => {
    tocHtml += `
      <div style="margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-weight: 900; font-size: 9.5pt; color: #0f172a; text-transform: uppercase; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 4px;">
          ${cat} (${categoriesMap[cat].length} Sections)
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
    `;
    categoriesMap[cat].forEach(({ sec, globalIndex }) => {
      tocHtml += `
        <tr>
          <td style="padding: 2px 4px; font-weight: 700; color: #1e293b; width: 75%; border: none;">&bull; ${sec.subTab}</td>
          <td style="padding: 2px 4px; text-align: right; color: #64748b; border: none; font-family: monospace; font-size: 8pt; font-weight: 700;">Section ${globalIndex}</td>
        </tr>
      `;
    });
    tocHtml += `</table></div>`;
  });

  // Build section pages
  let pagesHtml = '';
  sections.forEach((sec, sIdx) => {
    const secBody = extractAndSanitizePlaybookHtml(sec.content, sec.category, sec.subTab);

    pagesHtml += `
      <section class="playbook-section" data-section="${sec.category}-${sec.subTab}">
        <div class="playbook-top-bar">
          <span class="team-brand">🏈 ${teamName} &bull; ${teamSeason}</span>
          <span class="section-title">${sec.category} &gt; ${sec.subTab}</span>
          <span class="section-count">Section ${sIdx + 1} of ${sections.length}</span>
        </div>

        <div class="playbook-main-content">
          ${secBody}
        </div>

        <div class="playbook-bottom-bar">
          <span>CONFIDENTIAL TEAM PLAYBOOK &bull; PROPERTY OF ${teamName.toUpperCase()}</span>
          <span>${sec.category} &gt; ${sec.subTab} &bull; Section ${sIdx + 1} of ${sections.length}</span>
        </div>
      </section>
    `;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${teamName} - ${title}</title>
  <style>
    ${inkFriendly ? INK_FRIENDLY_PLAYBOOK_CSS : `
      @page { size: letter portrait; margin: 0.4in; }
      html, body {
        display: block !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        float: none !important;
        background: #ffffff !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .playbook-container {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .top-nav, .bottom-nav, select, button, .action-btn, .play-nav {
        display: none !important;
      }
      .field-wrap {
        margin: 8px 0 !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        background: #ffffff !important;
        overflow: hidden !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      svg {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        max-height: 4.6in !important;
      }
      .meta-bar {
        display: block !important;
        padding: 8px 12px !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px !important;
        background: #f8fafc !important;
        margin: 8px 0 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .concepts-text {
        font-size: 8.5pt !important;
        color: #334155 !important;
        line-height: 1.4 !important;
      }
      .table-section {
        padding: 8px 0 12px 0 !important;
        overflow: visible !important;
        width: 100% !important;
      }
      .table-section table, table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 8.5pt !important;
        text-align: left !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      .table-section thead th, thead th, th {
        padding: 6px 8px !important;
        font-size: 8pt !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        color: #334155 !important;
        border: 1px solid #cbd5e1 !important;
        background: #f1f5f9 !important;
      }
      .table-section tbody td, tbody td, td {
        padding: 6px 8px !important;
        color: #0f172a !important;
        border: 1px solid #cbd5e1 !important;
        vertical-align: top !important;
        line-height: 1.35 !important;
        font-size: 8pt !important;
      }
      .pos-name {
        font-weight: 800 !important;
        color: #0f172a !important;
        white-space: nowrap !important;
      }
      .pos-desc {
        font-weight: normal !important;
        color: #64748b !important;
        font-size: 7.5pt !important;
        display: block !important;
      }
      .tag-contain { color: #0284c7 !important; font-weight: 700 !important; }
      .tag-blitz { color: #dc2626 !important; font-weight: 700 !important; }
      .tag-cover { color: #7c3aed !important; font-weight: 700 !important; }
      .tag-stunt { color: #d97706 !important; font-weight: 700 !important; }
    `}

    /* =========================================================
       CRITICAL PAGINATION RULES:
       1. Each section starts on its own fresh page
       2. Long sections naturally flow to a 2nd page without cutting off
       3. Following section ALWAYS breaks to a new page
       ========================================================= */
    .cover-page {
      border: 4px double #0f172a;
      border-radius: 12px;
      padding: 28px 24px;
      min-height: 9.8in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-before: avoid !important;
      break-before: avoid !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-sizing: border-box;
      background: #ffffff;
      margin-bottom: 0;
    }

    .playbook-section {
      /* Block display allows standard fragment rendering across page breaks */
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 100% !important;
      box-sizing: border-box !important;
      clear: both !important;
      float: none !important;
      position: relative !important;

      /* When the section ends, the NEXT section MUST start on its own fresh page! */
      page-break-before: auto !important;
      break-before: auto !important;
      page-break-after: always !important;
      break-after: page !important;

      /* Crucial: If a section has extensive content, it flows naturally onto a 2nd page! */
      page-break-inside: auto !important;
      break-inside: auto !important;

      margin: 0 0 24px 0 !important;
      padding: 0 !important;
    }

    /* Last section doesn't force a trailing blank sheet */
    .playbook-section:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
      margin-bottom: 0 !important;
    }

    .playbook-main-content {
      display: block !important;
      width: 100% !important;
      clear: both !important;
      overflow: visible !important;
    }

    /* Sub-element break rules to keep assignments and diagrams intact */
    tr, .tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .diagram-box, figure, img, svg, .field-diagram, .field-wrap {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .notes-box, .notes, .meta-bar {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .playbook-top-bar, .header, h1, h2, h3 {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    .playbook-bottom-bar {
      page-break-before: avoid !important;
      break-before: avoid !important;
    }

    table, .assignments-table {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    thead {
      display: table-header-group !important;
    }

    .card, [class*="card"], .box, .container, .playbook-container {
      page-break-inside: auto !important;
      break-inside: auto !important;
      overflow: visible !important;
      height: auto !important;
      max-height: none !important;
      width: 100% !important;
      max-width: 100% !important;
      border: none !important;
      box-shadow: none !important;
      background: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .playbook-top-bar {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      border-bottom: 2px solid #0f172a !important;
      padding-bottom: 5px !important;
      margin-bottom: 12px !important;
      font-size: 8.5pt !important;
      font-weight: 700 !important;
      color: #334155 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
    }
    .playbook-top-bar .team-brand {
      color: #0f172a !important;
      font-size: 10pt !important;
      font-weight: 900 !important;
    }
    .playbook-bottom-bar {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      border-top: 1px solid #cbd5e1 !important;
      padding-top: 5px !important;
      margin-top: 12px !important;
      font-size: 7.5pt !important;
      color: #64748b !important;
    }

    @media print {
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        width: 100% !important;
        float: none !important;
      }
      .cover-page, .playbook-section {
        box-shadow: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        display: block !important;
        clear: both !important;
        float: none !important;
      }
      .cover-page {
        border: 4px double #0f172a !important;
        padding: 0.25in !important;
        min-height: 9.6in !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .playbook-section {
        border: none !important;
        padding: 0 !important;
        page-break-before: always !important;
        break-before: page !important;
        page-break-after: always !important;
        break-after: page !important;
        display: block !important;
        clear: both !important;
      }
      .playbook-section:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .top-nav, .bottom-nav, select, button, .action-btn, .play-nav {
        display: none !important;
      }
    }

    @media screen {
      body {
        background: #0f172a;
        padding: 24px 12px;
        margin: 0;
        display: block !important;
      }
      .cover-page, .playbook-section {
        background: #ffffff;
        color: #0f172a;
        width: 8.5in;
        max-width: 8.5in;
        margin: 0 auto 32px auto !important;
        padding: 0.4in 0.45in !important;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        border-radius: 8px;
        min-height: 10.5in;
        box-sizing: border-box;
      }
    }
  </style>
</head>
<body>
  ${includeCoverPage ? `
  <!-- COVER PAGE -->
  <div class="cover-page">
    <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px;">
      <div style="font-size: 13pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #1e3a8a;">
        🏈 ${teamName} &bull; ${teamSeason}
      </div>
      <h1 style="font-size: 24pt; font-weight: 950; margin: 8px 0 4px 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em;">
        ${title}
      </h1>
      <div style="font-size: 10pt; font-weight: 700; color: #475569;">
        Official Team Schemes, Alignment Rules, Route Trees &amp; Player Assignments
      </div>
      ${headCoachName ? `<div style="font-size: 9.5pt; font-weight: 700; color: #1e3a8a; margin-top: 4px;">Head Coach: ${headCoachName}</div>` : ''}
    </div>

    <!-- Table of Contents -->
    <div style="margin: 20px 0; flex: 1;">
      <div style="font-size: 11pt; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em;">
        📋 Table of Contents &amp; Section Index:
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        ${tocHtml}
      </div>
    </div>

    <!-- Footer Tenets -->
    <div style="border-top: 2px solid #0f172a; padding-top: 12px; text-align: center;">
      <div style="font-size: 10pt; font-weight: 900; color: #0f172a; letter-spacing: 0.08em; text-transform: uppercase;">
        ALIGNMENT &bull; ASSIGNMENT &bull; TECHNIQUE &bull; EFFORT
      </div>
      <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">
        Assembled &amp; Printed on ${currentDate} &bull; Confidential &bull; For Team &amp; Coaching Staff Use Only
      </div>
    </div>
  </div>
  ` : ''}

  <!-- SECTION PAGES -->
  ${pagesHtml}
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// PRACTICE HOUR & ACCLIMATIZATION COMPLIANCE REPORT PRINT ENGINE
// -----------------------------------------------------------------------------

export interface PracticeHourReportOptions {
  teamName?: string;
  seasonName?: string;
  seasonConfig?: SeasonConfig;
  roster: RosterPlayer[];
  attendanceLogs: AttendanceRecord[];
  filterType?: 'all' | 'needs_scrimmage' | 'needs_conditioning' | 'needs_pads' | 'cleared';
  notes?: string;
  certifiedCoachName?: string;
}

export function generatePracticeHourReportHTML(options: PracticeHourReportOptions): string {
  const {
    teamName = 'Mahopac 10U Youth Football',
    seasonName = '2026 Fall Youth Season',
    seasonConfig,
    roster,
    attendanceLogs,
    filterType = 'all',
    notes = '',
    certifiedCoachName = 'Head Coach',
  } = options;

  const generatedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const generatedTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate compliance and hours for each player
  const playerStats = roster.map((player) => {
    const comp = calculatePlayerCompliance(player);
    const hours = calculatePlayerHours(player, attendanceLogs, 'pre-1', seasonConfig);
    return {
      player,
      comp,
      hours,
    };
  });

  // Filter based on filterType
  const filteredStats = playerStats.filter(({ comp }) => {
    if (filterType === 'needs_scrimmage') return !comp.isScrimmageCleared;
    if (filterType === 'needs_conditioning') return !comp.isConditioningCleared;
    if (filterType === 'needs_pads') return comp.isConditioningCleared && !comp.isScrimmageCleared;
    if (filterType === 'cleared') return comp.isScrimmageCleared;
    return true;
  });

  // Aggregate stats
  const totalRoster = roster.length;
  const scrimmageClearedCount = playerStats.filter((p) => p.comp.isScrimmageCleared).length;
  const needsScrimmageCount = totalRoster - scrimmageClearedCount;
  const needsCondCount = playerStats.filter((p) => !p.comp.isConditioningCleared).length;
  const needsPadsCount = playerStats.filter(
    (p) => p.comp.isConditioningCleared && !p.comp.isScrimmageCleared
  ).length;

  const isFiltered = filterType !== 'all';
  const reportTitle =
    filterType === 'needs_scrimmage'
      ? 'OFFICIAL SCRIMMAGE ELIGIBILITY DEFICIENCY REPORT'
      : isFiltered
      ? `OFFICIAL PRACTICE HOURS REPORT (${filterType.toUpperCase().replace('_', ' ')})`
      : 'OFFICIAL PRACTICE HOUR & ACCLIMATIZATION COMPLIANCE REPORT';

  const reportSubtitle =
    filterType === 'needs_scrimmage'
      ? 'Roster of athletes currently needing conditioning or padded contact hours before participating in live scrimmages'
      : 'Mandatory 10-Hour Conditioning & 10-Hour Padded Contact Acclimatization Verification Log';

  // Build preseason week columns (Pre-1 to Pre-4)
  const preseasonCount = seasonConfig?.preseasonWeeksCount || 4;
  const preWeekKeys = seasonConfig?.preseasonWeekKeys || ['pre-1', 'pre-2', 'pre-3', 'pre-4'].slice(0, preseasonCount);

  let rowsHtml = '';
  filteredStats.forEach(({ player, comp, hours }, index) => {
    const isCleared = comp.isScrimmageCleared;
    const condCapped = Math.min(10, comp.conditioningHours);
    const padCapped = Math.min(10, comp.paddedHours);
    const isCondMet = comp.conditioningHours >= 10;
    const isPadMet = comp.paddedHours >= 10;

    let scrimmageStatusBadge = '';
    if (isCleared) {
      scrimmageStatusBadge = `
        <span style="display: inline-block; padding: 3px 8px; font-size: 8.5pt; font-weight: 900; color: #065f46; background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; text-transform: uppercase;">
          CLEARED ✓ (Good)
        </span>
      `;
    } else if (!comp.isConditioningCleared) {
      scrimmageStatusBadge = `
        <span style="display: inline-block; padding: 3px 8px; font-size: 8.5pt; font-weight: 900; color: #991b1b; background: #fee2e2; border: 1px solid #f87171; border-radius: 6px; text-transform: uppercase;">
          NEEDS COND (${(10 - condCapped).toFixed(1)}h left)
        </span>
      `;
    } else {
      scrimmageStatusBadge = `
        <span style="display: inline-block; padding: 3px 8px; font-size: 8.5pt; font-weight: 900; color: #991b1b; background: #fee2e2; border: 1px solid #f87171; border-radius: 6px; text-transform: uppercase;">
          NEEDS PADS (${(10 - padCapped).toFixed(1)}h left)
        </span>
      `;
    }

    const condCell = isCondMet
      ? `<span style="font-weight: 800; color: #065f46;">${condCapped.toFixed(1)} / 10.0h</span> <span style="font-size: 7.5pt; background: #d1fae5; color: #065f46; padding: 1px 4px; border-radius: 4px; font-weight: 900;">MET ✓</span>`
      : `<span style="font-weight: 800; color: #991b1b;">${condCapped.toFixed(1)} / 10.0h</span> <span style="font-size: 7.5pt; background: #fee2e2; color: #991b1b; padding: 1px 4px; border-radius: 4px; font-weight: 900;">-${(10 - condCapped).toFixed(1)}h</span>`;

    const padCell = isPadMet
      ? `<span style="font-weight: 800; color: #065f46;">${padCapped.toFixed(1)} / 10.0h</span> <span style="font-size: 7.5pt; background: #d1fae5; color: #065f46; padding: 1px 4px; border-radius: 4px; font-weight: 900;">MET ✓</span>`
      : `<span style="font-weight: 800; color: #991b1b;">${padCapped.toFixed(1)} / 10.0h</span> <span style="font-size: 7.5pt; background: #fee2e2; color: #991b1b; padding: 1px 4px; border-radius: 4px; font-weight: 900;">-${(10 - padCapped).toFixed(1)}h</span>`;

    const preSeasonTotal = (condCapped + padCapped).toFixed(1);

    // Preseason week hours
    const preWeekCells = preWeekKeys
      .map((key) => {
        const h = hours.weeklyHours[key] || 0;
        return `<td style="text-align: center; font-family: monospace; font-size: 8.5pt; color: ${h > 0 ? '#0f172a' : '#94a3b8'};">${h > 0 ? h.toFixed(1) + 'h' : '-'}</td>`;
      })
      .join('');

    const positions = [player.offensivePosition || player.primaryPosition, player.defensivePosition || player.secondaryPosition]
      .filter(Boolean)
      .join(' / ') || player.primaryPosition || '-';

    const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    rowsHtml += `
      <tr style="background: ${rowBg}; border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 5px 6px; font-family: monospace; font-weight: 900; text-align: center; color: #0f172a; font-size: 9pt;">
          #${player.num}
        </td>
        <td style="padding: 5px 8px; font-weight: 800; color: #0f172a; font-size: 9pt;">
          ${player.firstName} ${player.lastName}
          ${player.isCaptain ? '<span style="font-size: 7.5pt; color: #d97706; font-weight: 900; margin-left: 4px;">[C]</span>' : ''}
        </td>
        <td style="padding: 5px 6px; font-size: 8pt; color: #475569; font-weight: 700;">
          ${positions}
        </td>
        <td style="padding: 5px 6px; text-align: center; font-size: 8.5pt;">
          ${condCell}
        </td>
        <td style="padding: 5px 6px; text-align: center; font-size: 8.5pt;">
          ${padCell}
        </td>
        <td style="padding: 5px 6px; text-align: center; font-family: monospace; font-size: 9pt; font-weight: 800; color: #0f172a; background: #f1f5f9;">
          ${preSeasonTotal}h
        </td>
        ${preWeekCells}
        <td style="padding: 5px 6px; text-align: center; font-family: monospace; font-size: 9pt; font-weight: 900; color: #0f172a;">
          ${hours.totalSeasonHours.toFixed(1)}h
        </td>
        <td style="padding: 5px 6px; text-align: center;">
          ${scrimmageStatusBadge}
        </td>
      </tr>
    `;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - ${teamName}</title>
  <style>
    @page {
      size: landscape;
      margin: 0.35in;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      font-size: 9pt;
      line-height: 1.3;
    }
    .report-container {
      width: 100%;
      max-width: 100%;
    }
    .header-bar {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-title {
      font-size: 16pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      color: #0f172a;
      margin: 0;
    }
    .header-sub {
      font-size: 8.5pt;
      color: #475569;
      font-weight: 600;
      margin-top: 2px;
    }
    .header-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 8pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-radius: 4px;
      margin-bottom: 4px;
      background: #0f172a;
      color: #ffffff;
    }
    .meta-box {
      text-align: right;
      font-size: 8pt;
      color: #475569;
      line-height: 1.4;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .summary-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 10px;
      background: #f8fafc;
    }
    .summary-card.alert {
      border-color: #f87171;
      background: #fef2f2;
    }
    .summary-card.success {
      border-color: #34d399;
      background: #ecfdf5;
    }
    .summary-title {
      font-size: 7.5pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
    }
    .summary-value {
      font-size: 14pt;
      font-weight: 900;
      color: #0f172a;
      margin-top: 1px;
    }
    .summary-desc {
      font-size: 7pt;
      color: #64748b;
      margin-top: 1px;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 10px;
    }
    thead {
      display: table-header-group;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      padding: 5px 6px;
      font-size: 8pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      text-align: center;
      border: 1px solid #0f172a;
    }
    th.left-align {
      text-align: left;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .mandate-callout {
      border: 1.5px dashed #94a3b8;
      background: #f8fafc;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 10px;
      font-size: 7.5pt;
      color: #334155;
      line-height: 1.35;
    }
    .mandate-callout strong {
      color: #0f172a;
    }
    .signoff-section {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1.5px solid #cbd5e1;
      font-size: 8pt;
    }
    .sign-line {
      border-bottom: 1px solid #0f172a;
      height: 24px;
      margin-top: 20px;
    }
    .sign-label {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      margin-top: 3px;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <div class="header-bar">
      <div>
        <div class="header-badge">${teamName} &bull; ${seasonName}</div>
        <h1 class="header-title">${reportTitle}</h1>
        <div class="header-sub">${reportSubtitle}</div>
      </div>
      <div class="meta-box">
        <div><strong>Date:</strong> ${generatedDate} at ${generatedTime}</div>
        <div><strong>Scope:</strong> ${isFiltered ? `${filteredStats.length} Athlete(s) Filtered` : `Full Roster (${totalRoster} Athletes)`}</div>
        <div><strong>Acclimatization Rule:</strong> 10.0h Cond + 10.0h Pads Required</div>
      </div>
    </div>

    <!-- Executive Summary Grid -->
    <div class="summary-grid">
      <div class="summary-card success">
        <div class="summary-title" style="color: #065f46;">Full Scrimmage Cleared</div>
        <div class="summary-value" style="color: #065f46;">${scrimmageClearedCount} <span style="font-size: 9pt; font-weight: 700;">/ ${totalRoster}</span></div>
        <div class="summary-desc" style="color: #047857;">${Math.round((scrimmageClearedCount / (totalRoster || 1)) * 100)}% roster met 10h Cond + 10h Pads</div>
      </div>

      <div class="summary-card ${needsScrimmageCount > 0 ? 'alert' : ''}">
        <div class="summary-title" style="color: ${needsScrimmageCount > 0 ? '#991b1b' : '#64748b'};">Needs Scrimmage Hours</div>
        <div class="summary-value" style="color: ${needsScrimmageCount > 0 ? '#991b1b' : '#0f172a'};">${needsScrimmageCount}</div>
        <div class="summary-desc" style="color: ${needsScrimmageCount > 0 ? '#b91c1c' : '#64748b'};">Athletes ineligible for live contact scrimmages</div>
      </div>

      <div class="summary-card ${needsPadsCount > 0 ? 'alert' : ''}">
        <div class="summary-title" style="color: ${needsPadsCount > 0 ? '#991b1b' : '#64748b'};">Needs Padded Hours</div>
        <div class="summary-value" style="color: ${needsPadsCount > 0 ? '#991b1b' : '#0f172a'};">${needsPadsCount}</div>
        <div class="summary-desc" style="color: ${needsPadsCount > 0 ? '#b91c1c' : '#64748b'};">Wearing pads; working toward 10.0h padded</div>
      </div>

      <div class="summary-card ${needsCondCount > 0 ? 'alert' : ''}">
        <div class="summary-title" style="color: ${needsCondCount > 0 ? '#991b1b' : '#64748b'};">Needs Conditioning</div>
        <div class="summary-value" style="color: ${needsCondCount > 0 ? '#991b1b' : '#0f172a'};">${needsCondCount}</div>
        <div class="summary-desc" style="color: ${needsCondCount > 0 ? '#b91c1c' : '#64748b'};">Tee &amp; shorts; needs 10.0h conditioning</div>
      </div>
    </div>

    <!-- Mandatory Acclimatization Notice Callout -->
    <div class="mandate-callout">
      <strong>MANDATORY YOUTH ACCLIMATIZATION PROTOCOL (NYSPHSAA / USA FOOTBALL):</strong>
      Athletes must strictly complete <strong>10.0 hours of conditioning</strong> (helmets and shorts only) before being permitted to wear full contact pads. Subsequently, athletes must log a minimum of <strong>10.0 hours in full contact pads</strong> before participating in any inter-squad scrimmage, live scrimmage, or league competition (20.0 total pre-scrimmage hours). All acclimatization phase hours are capped at 10.0h maximum.
    </div>

    <!-- Player Hours Roster Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 4%;">#</th>
          <th class="left-align" style="width: 18%;">Athlete Name</th>
          <th class="left-align" style="width: 11%;">Position(s)</th>
          <th style="width: 14%;">Conditioning (Max 10h)</th>
          <th style="width: 14%;">Padded Contact (Max 10h)</th>
          <th style="width: 7%;">Pre-Season</th>
          ${preWeekKeys.map((k) => `<th style="width: 4.5%; font-size: 7.5pt;">${formatWeekLabel(k, seasonConfig)}</th>`).join('')}
          <th style="width: 6.5%;">Season</th>
          <th style="width: 14%;">Scrimmage Clearance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    ${notes ? `<div style="margin-bottom: 8px; font-size: 8pt; color: #475569; font-style: italic;"><strong>Coach Notes:</strong> ${notes}</div>` : ''}

    <!-- Official Sign-off & Certification Lines -->
    <div class="signoff-section">
      <div>
        <div class="sign-line"></div>
        <div class="sign-label">Head Coach Signature &bull; Date</div>
      </div>
      <div>
        <div class="sign-line"></div>
        <div class="sign-label">League Compliance Officer / Athletic Director &bull; Date</div>
      </div>
      <div>
        <div class="sign-line"></div>
        <div class="sign-label">Safety &amp; Equipment Coordinator &bull; Date</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function printPracticeHourReport(options: PracticeHourReportOptions) {
  const html = generatePracticeHourReportHTML(options);
  const title = options.filterType === 'needs_scrimmage'
    ? 'Scrimmage_Eligibility_Deficiency_Report'
    : 'Practice_Hour_Compliance_Report';
  printCleanHTML(html, title);
}

// -----------------------------------------------------------------------------
// SINGLE PLAYER OFFICIAL PRACTICE ATTENDANCE CERTIFICATE
// -----------------------------------------------------------------------------

export interface SinglePlayerHourReportOptions {
  teamName?: string;
  seasonName?: string;
  seasonConfig?: SeasonConfig;
  player: RosterPlayer;
  attendanceLogs: AttendanceRecord[];
  scope?: 'season' | 'preseason';
  notes?: string;
}

export function generateSinglePlayerHourReportHTML(options: SinglePlayerHourReportOptions): string {
  const {
    teamName = 'Mahopac 10U Youth Football',
    seasonName = '2026 Fall Youth Season',
    seasonConfig,
    player,
    attendanceLogs,
    scope = 'preseason',
  } = options;

  const breakdown = getPlayerHoursBreakdown(player, attendanceLogs, scope, 'pre-1', seasonConfig);
  const comp = calculatePlayerCompliance(player);

  const generatedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const condCapped = Math.min(10, breakdown.conditioningHours);
  const padCapped = Math.min(10, breakdown.paddedHours);
  const isCondMet = breakdown.conditioningHours >= 10;
  const isPadMet = breakdown.paddedHours >= 10;
  const isCleared = comp.isScrimmageCleared;

  let practiceRowsHtml = '';
  breakdown.days.forEach((d, idx) => {
    practiceRowsHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 700;">#${idx + 1}</td>
        <td style="padding: 6px 8px; font-weight: 700;">${d.formattedDate}</td>
        <td style="padding: 6px 8px; color: #475569; font-size: 8.5pt;">${d.weekLabel}</td>
        <td style="padding: 6px 8px; font-weight: 700;">${d.title}</td>
        <td style="padding: 6px 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; font-size: 7.5pt; font-weight: 800; border-radius: 4px; text-transform: uppercase; ${
            d.playerAttire === 'conditioning'
              ? 'background: #fef3c7; color: #92400e; border: 1px solid #f59e0b;'
              : 'background: #e0f2fe; color: #0369a1; border: 1px solid #38bdf8;'
          }">
            ${d.playerAttire === 'conditioning' ? '⚡ Conditioning' : '🛡️ Full Pads'}
          </span>
        </td>
        <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 700;">${d.hours.toFixed(1)} hrs</td>
        <td style="padding: 6px 8px; text-align: center;">
          ${
            d.wasPresent
              ? '<span style="color: #065f46; font-weight: 900;">✓ Present</span>'
              : '<span style="color: #991b1b; font-weight: 900;">✗ Absent</span>'
          }
        </td>
        <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 900; background: #f1f5f9;">
          ${d.runningTotal.toFixed(1)} hrs
        </td>
      </tr>
    `;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Practice Attendance Certificate - #${player.num} ${player.firstName} ${player.lastName}</title>
  <style>
    @page { size: portrait; margin: 0.4in; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #0f172a; font-size: 9.5pt; line-height: 1.35; }
    .header { border-bottom: 2.5px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 16pt; font-weight: 900; text-transform: uppercase; margin: 0; }
    .sub { font-size: 9pt; color: #475569; margin-top: 2px; }
    .status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .status-card { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; background: #f8fafc; }
    .status-card.good { border-color: #34d399; background: #ecfdf5; }
    .status-card.need { border-color: #f87171; background: #fef2f2; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; }
    th { background: #0f172a; color: #fff; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 900; text-transform: uppercase; }
    .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px; border-top: 1.5px solid #cbd5e1; padding-top: 14px; }
    .line { border-bottom: 1px solid #0f172a; height: 26px; }
    .lbl { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size: 8.5pt; font-weight: 900; text-transform: uppercase; color: #475569;">${teamName} &bull; ${seasonName}</div>
      <h1 class="title">Official Practice Attendance &amp; Acclimatization Record</h1>
      <div class="sub">Individual Player Compliance Verification Certificate</div>
    </div>
    <div style="text-align: right; font-size: 8.5pt; color: #475569;">
      <div><strong>Date:</strong> ${generatedDate}</div>
      <div><strong>Roster Status:</strong> Active 10U Athlete</div>
    </div>
  </div>

  <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 18pt; font-weight: 900; font-family: monospace; background: #0f172a; color: #fff; padding: 4px 12px; border-radius: 6px;">#${player.num}</span>
      <div>
        <div style="font-size: 14pt; font-weight: 900; color: #0f172a;">${player.firstName} ${player.lastName}</div>
        <div style="font-size: 8.5pt; color: #475569; font-weight: 700;">
          Position: ${player.primaryPosition || '-'} ${player.secondaryPosition ? `&bull; ${player.secondaryPosition}` : ''}
        </div>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 8pt; font-weight: 900; text-transform: uppercase; color: #64748b;">Scrimmage Clearance</div>
      <div style="margin-top: 2px;">
        ${
          isCleared
            ? '<span style="background: #d1fae5; color: #065f46; border: 1px solid #10b981; padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 9pt;">CLEARED FOR LIVE SCRIMMAGE ✓</span>'
            : '<span style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 9pt;">NOT CLEARED - NEEDS PRACTICE HOURS</span>'
        }
      </div>
    </div>
  </div>

  <div class="status-grid">
    <div class="status-card ${isCondMet ? 'good' : 'need'}">
      <div style="font-size: 8pt; font-weight: 900; text-transform: uppercase; color: ${isCondMet ? '#065f46' : '#991b1b'};">Conditioning (Max 10.0h)</div>
      <div style="font-size: 16pt; font-weight: 900; color: ${isCondMet ? '#065f46' : '#991b1b'}; margin-top: 2px;">
        ${condCapped.toFixed(1)} / 10.0 hrs
      </div>
      <div style="font-size: 7.5pt; font-weight: 800; color: ${isCondMet ? '#047857' : '#b91c1c'}; margin-top: 2px;">
        ${isCondMet ? '✓ 10.0h Required Standard Met (Good)' : `Needs ${(10 - condCapped).toFixed(1)}h conditioning`}
      </div>
    </div>

    <div class="status-card ${isPadMet ? 'good' : 'need'}">
      <div style="font-size: 8pt; font-weight: 900; text-transform: uppercase; color: ${isPadMet ? '#065f46' : '#991b1b'};">Padded Contact (Max 10.0h)</div>
      <div style="font-size: 16pt; font-weight: 900; color: ${isPadMet ? '#065f46' : '#991b1b'}; margin-top: 2px;">
        ${padCapped.toFixed(1)} / 10.0 hrs
      </div>
      <div style="font-size: 7.5pt; font-weight: 800; color: ${isPadMet ? '#047857' : '#b91c1c'}; margin-top: 2px;">
        ${isPadMet ? '✓ 10.0h Required Standard Met (Good)' : `Needs ${(10 - padCapped).toFixed(1)}h contact pads`}
      </div>
    </div>

    <div class="status-card good">
      <div style="font-size: 8pt; font-weight: 900; text-transform: uppercase; color: #065f46;">Attended Practices</div>
      <div style="font-size: 16pt; font-weight: 900; color: #065f46; margin-top: 2px;">
        ${breakdown.attendedSessionsCount} <span style="font-size: 10pt; font-weight: 700;">/ ${breakdown.totalSessionsCount}</span>
      </div>
      <div style="font-size: 7.5pt; font-weight: 800; color: #047857; margin-top: 2px;">
        ${breakdown.attendanceRate}% Attendance Rate
      </div>
    </div>
  </div>

  <div style="font-size: 9pt; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.04em;">
    Itemized Practice Attendance Log (${breakdown.scopeLabel}):
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 5%; text-align: center;">#</th>
        <th style="width: 15%;">Date</th>
        <th style="width: 14%;">Week</th>
        <th style="width: 26%;">Practice Title</th>
        <th style="width: 16%; text-align: center;">Attire</th>
        <th style="width: 8%; text-align: center;">Hours</th>
        <th style="width: 8%; text-align: center;">Status</th>
        <th style="width: 8%; text-align: center;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${practiceRowsHtml}
    </tbody>
  </table>

  <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 8pt; font-family: monospace; color: #334155; margin-bottom: 12px;">
    <strong>Calculation Formula:</strong> ${breakdown.formulaEquation}
  </div>

  <div class="sign-row">
    <div>
      <div class="line"></div>
      <div class="lbl">Certified Head Coach Signature &bull; Date</div>
    </div>
    <div>
      <div class="line"></div>
      <div class="lbl">League Compliance Director &bull; Date</div>
    </div>
  </div>
</body>
</html>`;
}

export function printSinglePlayerHourReport(options: SinglePlayerHourReportOptions) {
  const html = generateSinglePlayerHourReportHTML(options);
  const title = `Practice_Certificate_${options.player.firstName}_${options.player.lastName}_#${options.player.num}`;
  printCleanHTML(html, title);
}

export interface WristbandPrintOptions {
  copies?: number;
  wristbandCopies?: Record<string, number>;
  layout?: 'single_column' | 'grid_2up';
  orientation?: 'portrait' | 'landscape';
  inkFriendly?: boolean;
  showCutLines?: boolean;
  showCopyLabels?: boolean;
  showColumnHeaders?: boolean; // When false (default), removes the "Blue (1-13)" column header so more lines fit
  documentTitle?: string;
  snippetOnly?: boolean;
}

/**
 * Generates clean, standalone printable HTML for physical 4.5" x 2.25" wristband inserts.
 * Renders exact dimensions, dashed cut guides, team branding, colored column badges,
 * and high-contrast play typography.
 * Supports printing all made wristbands and multiple copies per wristband.
 */
export function generateWristbandPrintHTML(
  wristbands: SingleWristband[],
  activeTeamName: string = 'Mahopac 10U',
  documentTitle?: string,
  options?: WristbandPrintOptions
): string {
  const title = options?.documentTitle || documentTitle || `${activeTeamName} Wristband Inserts`;
  const layout = options?.layout || 'grid_2up';
  const orientation = options?.orientation || (layout === 'grid_2up' ? 'landscape' : 'portrait');
  const inkFriendly = options?.inkFriendly || false;
  const showCutLines = options?.showCutLines !== false;
  const showCopyLabels = options?.showCopyLabels !== false;
  const showColumnHeaders = options?.showColumnHeaders ?? false; // Default to FALSE to remove Blue (1-13) header and maximize lines

  const getContrastColor = (hexColor: string, defaultColor?: string): string => {
    if (defaultColor) return defaultColor;
    if (!hexColor) return '#000000';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
  };

  const getSlotLabel = (
    wb: SingleWristband,
    wbIndex: number,
    colIdx: number,
    rowIdx: number,
    play?: WristbandPlay
  ): string => {
    if (play?.customLabel && isNaN(Number(play.customLabel))) return play.customLabel;
    const mode = wb.labelingMode || 'continuous';
    const rows = wb.rowsCount || 13;

    if (mode === 'same_per_card') {
      return String(colIdx * rows + rowIdx + 1);
    }
    if (mode === 'letter_num') {
      const letter = colIdx === 0 ? 'A' : colIdx === 1 ? 'B' : 'C';
      return `${letter}${rowIdx + 1}`;
    }
    // Continuous numbering starting after previous wristband
    const wbStart = getWristbandStartNumber(wristbands, wbIndex);
    return String(wbStart + colIdx * rows + rowIdx);
  };

  // Expand wristbands according to copy count requested
  const itemsToPrint: Array<{
    wb: SingleWristband;
    wbIdx: number;
    copyIdx: number;
    totalCopiesForWb: number;
  }> = [];

  wristbands.forEach((wb, wbIdx) => {
    const copiesForWb = Math.max(
      1,
      Math.min(50, options?.wristbandCopies?.[wb.id] ?? options?.copies ?? 1)
    );
    for (let c = 0; c < copiesForWb; c++) {
      itemsToPrint.push({
        wb,
        wbIdx,
        copyIdx: c,
        totalCopiesForWb: copiesForWb,
      });
    }
  });

  if (itemsToPrint.length === 0 && wristbands.length > 0) {
    itemsToPrint.push({
      wb: wristbands[0],
      wbIdx: 0,
      copyIdx: 0,
      totalCopiesForWb: 1,
    });
  }

  const cardsHtml = itemsToPrint
    .map((item) => {
      const { wb, wbIdx, copyIdx, totalCopiesForWb } = item;
      const rows = wb.rowsCount || 13;
      const cols =
        wb.columns && wb.columns.length > 0
          ? wb.columns
          : [
              { color: '#facc15', plays: [] },
              { color: '#38bdf8', plays: [] },
            ];

      const colHeadersHtml = showColumnHeaders
        ? `<div class="cols-header">
            ${cols
              .map((col, cIdx) => {
                let colBg = col.numberBgColor || col.color || (cIdx === 0 ? '#facc15' : '#38bdf8');
                let colText = col.headerTextColor || getContrastColor(colBg, col.numberTextColor);
                if (inkFriendly) {
                  colBg = '#f1f5f9';
                  colText = '#000000';
                }
                const colName =
                  col.name ||
                  (cIdx === 0 ? `COL 1 (1 - ${rows})` : `COL 2 (${rows + 1} - ${rows * 2})`);

                return `
                  <div class="col-head" style="background-color: ${colBg}; color: ${colText};">
                    ${colName}
                  </div>
                `;
              })
              .join('')}
          </div>`
        : '';

      const colsBodyHtml = cols
        .map((col, cIdx) => {
          const plays = col.plays || [];
          let colBg = col.numberBgColor || col.color || (cIdx === 0 ? '#facc15' : '#38bdf8');
          if (inkFriendly) {
            colBg = '#ffffff';
          }

          // Dynamic row typography & slot-num dimensions so higher row counts fit cleanly inside 4.5" x 2.25"
          let rowFontSize = '7.5pt';
          let numFontSize = '8pt';
          let numWidth = '22px';
          let textPadding = '0 4px';
          let borderBottomStyle = '1px solid rgba(0, 0, 0, 0.25)';

          if (rows >= 22) {
            rowFontSize = '5.2pt';
            numFontSize = '5.5pt';
            numWidth = '16px';
            textPadding = '0 2px';
            borderBottomStyle = '0.5px solid rgba(0, 0, 0, 0.2)';
          } else if (rows >= 18) {
            rowFontSize = '5.8pt';
            numFontSize = '6.2pt';
            numWidth = '18px';
            textPadding = '0 2.5px';
            borderBottomStyle = '0.75px solid rgba(0, 0, 0, 0.2)';
          } else if (rows >= 15) {
            rowFontSize = '6.6pt';
            numFontSize = '7pt';
            numWidth = '20px';
            textPadding = '0 3px';
            borderBottomStyle = '1px solid rgba(0, 0, 0, 0.25)';
          }

          const rowsHtml = Array.from({ length: rows })
            .map((_, rIdx) => {
              const play = plays[rIdx] || { text: '' };
              const slotLabel = getSlotLabel(wb, wbIdx, cIdx, rIdx, play);
              let numberBg = play.numberHighlightColor || colBg;
              let numberTextColor =
                play.numberTextColor || col.numberTextColor || getContrastColor(numberBg);
              let rowBg = play.rowHighlightColor || '#ffffff';

              if (inkFriendly) {
                numberBg = '#ffffff';
                numberTextColor = '#000000';
                rowBg = '#ffffff';
              }

              const playText = (play.text || '—').trim() || '—';

              return `
                <div class="row-item" style="background-color: ${rowBg}; height: calc(100% / ${rows}); font-size: ${rowFontSize}; border-bottom: ${borderBottomStyle};">
                  <div class="slot-num" style="background-color: ${numberBg}; color: ${numberTextColor}; width: ${numWidth}; min-width: ${numWidth}; max-width: ${numWidth}; font-size: ${numFontSize};">
                    ${slotLabel}
                  </div>
                  <div class="slot-text" style="padding: ${textPadding}; font-size: ${rowFontSize};">
                    ${playText}
                  </div>
                </div>
              `;
            })
            .join('');

          return `
            <div class="col-body">
              ${rowsHtml}
            </div>
          `;
        })
        .join('');

      const copyBadgeHeader =
        totalCopiesForWb > 1 && showCopyLabels
          ? ` &bull; COPY ${copyIdx + 1}/${totalCopiesForWb}`
          : '';

      const cutGuideRight =
        totalCopiesForWb > 1 && showCopyLabels
          ? `COPY ${copyIdx + 1} OF ${totalCopiesForWb} &bull; 4.5&quot; &times; 2.25&quot;`
          : `STANDARD 4.5&quot; &times; 2.25&quot; WRIST COACH INSERT`;

      const cardBoxBorder = showCutLines ? '1.5px dashed #000000' : '1.5px solid #000000';

      return `
        <div class="card-wrapper">
          <div class="cut-guide">
            <span>✂ CUT ALONG GUIDE</span>
            <span>${cutGuideRight}</span>
          </div>
          <div class="card-box" style="border: ${cardBoxBorder};">
            <div class="card-header">
              ${
                wb.title &&
                (wb.title.toUpperCase().includes('10U') ||
                  wb.title.toUpperCase().includes(activeTeamName.toUpperCase()))
                  ? `${wb.title}${copyBadgeHeader}`
                  : `${wb.title || 'WRISTBAND INSERT'} &bull; ${activeTeamName.toUpperCase()}${copyBadgeHeader}`
              }
            </div>
            ${colHeadersHtml}
            <div class="cols-grid">
              ${colsBodyHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  const isLandscape = orientation === 'landscape';

  const stylesBlock = `
  <style>
    @page {
      size: letter ${isLandscape ? 'landscape' : 'portrait'};
      margin: 0.35in;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #ffffff;
      color: #000000;
    }
    .print-header {
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #0f172a;
    }
    .print-header h1 {
      font-size: 13pt;
      font-weight: 900;
      text-transform: uppercase;
      margin: 0;
      letter-spacing: 0.04em;
    }
    .print-header p {
      font-size: 8pt;
      color: #475569;
      margin: 2px 0 0 0;
      font-weight: 700;
    }
    .cards-container {
      ${
        isLandscape
          ? `display: flex; flex-wrap: wrap; justify-content: center; gap: 14px 20px; max-width: 10.3in; margin: 0 auto;`
          : `display: flex; flex-direction: column; align-items: center; gap: 20px; margin: 0 auto;`
      }
    }
    .card-wrapper {
      page-break-inside: avoid;
      break-inside: avoid;
      width: 4.5in;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .cut-guide {
      width: 4.5in;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 7pt;
      font-family: monospace;
      font-weight: bold;
      color: #334155;
      margin-bottom: 3px;
      letter-spacing: 0.04em;
    }
    .card-box {
      width: 4.5in;
      height: 2.25in;
      min-width: 4.5in;
      max-width: 4.5in;
      min-height: 2.25in;
      max-height: 2.25in;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    }
    .card-header {
      background: #000000;
      color: #ffffff;
      text-align: center;
      font-family: monospace, sans-serif;
      font-size: 8.5pt;
      font-weight: 900;
      text-transform: uppercase;
      padding: 2px 4px;
      border-bottom: 1.5px solid #000000;
      letter-spacing: 0.04em;
      height: 18px;
      line-height: 15px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
    .cols-header {
      display: flex;
      border-bottom: 1.5px solid #000000;
      height: 16px;
      flex-shrink: 0;
    }
    .col-head {
      flex: 1;
      text-align: center;
      font-family: monospace, sans-serif;
      font-size: 8pt;
      font-weight: 900;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      justify-content: center;
      border-right: 1.5px solid #000000;
      overflow: hidden;
      white-space: nowrap;
      padding: 0 4px;
    }
    .col-head:last-child {
      border-right: none;
    }
    .cols-grid {
      display: flex;
      flex: 1;
      overflow: hidden;
      height: ${showColumnHeaders ? 'calc(2.25in - 34px)' : 'calc(2.25in - 18px)'};
    }
    .col-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      border-right: 1.5px solid #000000;
      height: 100%;
      overflow: hidden;
    }
    .col-body:last-child {
      border-right: none;
    }
    .row-item {
      display: flex;
      align-items: stretch;
      border-bottom: 1px solid rgba(0, 0, 0, 0.25);
      font-size: 8pt;
      line-height: 1;
      overflow: hidden;
      box-sizing: border-box;
    }
    .row-item:last-child {
      border-bottom: none;
    }
    .slot-num {
      width: 22px;
      min-width: 22px;
      max-width: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: monospace, sans-serif;
      font-weight: 900;
      font-size: 8pt;
      border-right: 1px solid rgba(0, 0, 0, 0.4);
      user-select: none;
      flex-shrink: 0;
    }
    .slot-text {
      flex: 1;
      padding: 0 4px;
      display: flex;
      align-items: center;
      font-family: monospace, -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 900;
      font-size: 7.5pt;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #000000;
    }
  </style>
`;

  if (options?.snippetOnly) {
    return `
      ${stylesBlock}
      <div class="wristband-snippet-wrapper" style="width: 100%; margin: 10px 0;">
        <div class="cards-container">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  ${stylesBlock}
</head>
<body>
  <div class="print-header">
    <h1>${activeTeamName} &bull; Game Day Wristband Cutouts</h1>
    <p>Standard 4.5&quot; &times; 2.25&quot; Inserts &bull; Ready for Sleeve Lamination &bull; High Contrast Font</p>
  </div>
  <div class="cards-container">
    ${cardsHtml}
  </div>
</body>
</html>`;
}

/**
 * Print wristband cards using dedicated isolated print engine.
 * Never modifies main window DOM or causes state re-renders.
 */
export function printWristbandInserts(
  wristbands: SingleWristband[],
  activeTeamName: string = 'Mahopac 10U',
  documentTitle?: string,
  options?: WristbandPrintOptions
) {
  const html = generateWristbandPrintHTML(wristbands, activeTeamName, documentTitle, options);
  const title = options?.documentTitle || documentTitle || `${activeTeamName}_Wristband_Inserts`;
  printCleanHTML(html, title);
}

export interface CallSheetPrintOptions {
  orientation?: 'landscape' | 'portrait';
  columns?: number;
  density?: 'standard' | 'compact' | 'ultra';
  fitMode?: 'auto' | '1page' | '2page';
  inkFriendly?: boolean;
  hideEmptySlots?: boolean;
  snippetOnly?: boolean;
  sectionsFilter?: {
    topSituations?: boolean;
    redZone?: boolean;
    tempo?: boolean;
    custom?: boolean;
    scripts?: boolean;
    twoPoint?: boolean;
    timeouts?: boolean;
  };
}

/**
 * Generates standalone, bulletproof printable HTML for the Call Sheet.
 * Zero dependency on app container layouts, guaranteed never to cut off.
 */
export function generateCallSheetPrintHTML(
  callSheetData: CallSheetFullData,
  activeUnit: 'offense' | 'defense' = 'offense',
  activeTeamName: string = 'Mahopac 10U',
  documentTitle?: string,
  options?: CallSheetPrintOptions
): string {
  const orientation = options?.orientation || 'landscape';
  const density = options?.density || 'compact';
  const fitMode = options?.fitMode || 'auto';
  const inkFriendly = options?.inkFriendly || false;
  const hideEmptySlots = options?.hideEmptySlots || false;
  const filter = options?.sectionsFilter || {
    topSituations: true,
    redZone: true,
    tempo: true,
    custom: true,
    scripts: true,
    twoPoint: true,
    timeouts: true,
  };

  const isOffense = activeUnit === 'offense';
  const unitLabel = isOffense ? 'OFFENSE' : 'DEFENSE';
  const title = documentTitle || `${activeTeamName} • ${unitLabel} Call Sheet`;
  const sheetTitle = callSheetData.title || `${unitLabel} Situational Call Sheet`;
  const gameDate = callSheetData.gameDate || '';
  const opponent = callSheetData.opponent ? `vs ${callSheetData.opponent}` : '';

  const getContrastColor = (hexColor?: string, defaultColor?: string): string => {
    if (defaultColor) return defaultColor;
    if (!hexColor) return '#000000';
    let hex = hexColor.replace('#', '').trim();
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    // Blue shades (including #2563eb, #38bdf8, #0284c7, #0ea5e9, #3b82f6) always keep crisp white text like on wristbands
    if (b > r + 25 && b > 130) return '#ffffff';
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#000000' : '#ffffff';
  };

  const cleanNum = (val?: string | number): string => {
    if (val === undefined || val === null || val === '') return '';
    return String(val).replace(/^#+/, '').trim();
  };

  const sections = isOffense
    ? callSheetData.offenseSections || []
    : callSheetData.defenseSections || [];

  const topSituations = sections.filter((s) => s.group === 'top_situations');
  const redZone = sections.filter((s) => s.group === 'red_zone');
  const tempo = sections.filter((s) => s.group === 'tempo_game_mgmt');
  const custom = sections.filter((s) => s.group === 'custom');
  const rawScripts = isOffense ? callSheetData.offenseScript || [] : callSheetData.defenseScript || [];

  // Parity with screen: default to provided columns, or saved desktopGridColumns, or orientation standard
  const defaultCols = options?.columns || (callSheetData.desktopGridColumns ?? (orientation === 'landscape' ? 4 : 2));
  const printColumns = Math.max(1, Math.min(6, defaultCols));

  // Density sizing
  let baseFontSize = '9pt';
  let cellPadding = '2px 4px';
  let badgeFontSize = '8pt';
  let headerPadding = '3px 6px';
  let gridGap = '6px';

  if (density === 'ultra') {
    baseFontSize = '8pt';
    cellPadding = '1px 3px';
    badgeFontSize = '7pt';
    headerPadding = '2px 4px';
    gridGap = '4px';
  } else if (density === 'standard') {
    baseFontSize = '10pt';
    cellPadding = '3px 5px';
    badgeFontSize = '8.5pt';
    headerPadding = '4px 6px';
    gridGap = '8px';
  }

  // Adjust for wide (<=2 cols) or dense (>=5 cols) layouts
  if (printColumns >= 5 && density !== 'ultra') {
    baseFontSize = '8pt';
    badgeFontSize = '7pt';
    cellPadding = '1.5px 3px';
    gridGap = '4px';
  } else if (printColumns <= 2 && density === 'compact') {
    baseFontSize = '9.5pt';
    badgeFontSize = '8.5pt';
    cellPadding = '3px 5px';
  }

  const renderSectionCard = (sec: CallSheetSection) => {
    const headerBg = inkFriendly ? '#f1f5f9' : sec.headerBgColor || '#0284c7';
    const headerText = inkFriendly ? '#000000' : sec.headerTextColor || getContrastColor(headerBg);
    const validPlays = sec.plays.filter((p) => p && p.name && p.name.trim() !== '');

    let playsToRender = sec.plays;
    if (hideEmptySlots) {
      playsToRender = validPlays.length > 0 ? validPlays : [];
    }

    const colSpan = sec.colSpan || 1;
    const colSpanStyle = colSpan > 1 ? `grid-column: span ${Math.min(colSpan, printColumns)};` : '';

    const innerCols = sec.columnsCount && sec.columnsCount > 1 ? sec.columnsCount : 1;
    const cardBodyClass = innerCols > 1 ? 'card-body card-body-grid' : 'card-body';
    const cardBodyStyle = innerCols > 1 ? `display: grid; grid-template-columns: repeat(${innerCols}, 1fr);` : '';

    const subHeadersHtml =
      innerCols > 1 && sec.columnHeaders && sec.columnHeaders.length > 0
        ? `
          <div class="sub-headers-row" style="display: grid; grid-template-columns: repeat(${innerCols}, 1fr); background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: ${badgeFontSize}; font-weight: 800; text-align: center; text-transform: uppercase;">
            ${Array.from({ length: innerCols })
              .map(
                (_, i) =>
                  `<div style="padding: 1px 2px; border-right: ${
                    i < innerCols - 1 ? '1px solid #cbd5e1' : 'none'
                  };">${sec.columnHeaders?.[i] || `Col ${i + 1}`}</div>`
              )
              .join('')}
          </div>
        `
        : '';

    const rowsHtml = playsToRender
      .map((play, idx) => {
        if (!play || !play.name || !play.name.trim()) {
          if (hideEmptySlots) return '';
          return `
            <div class="callsheet-cell empty-slot" style="padding: ${cellPadding};">
              <span class="slot-empty-text">&nbsp;</span>
            </div>
          `;
        }

        const match = play.wristbandSlotMatch;
        const numVal = cleanNum(play.wristbandNum || match?.slotNumber);
        const numBg = inkFriendly
          ? '#e2e8f0'
          : match?.numberBgColor || match?.color || play.wristbandColor || '#38bdf8';
        const numText = inkFriendly
          ? '#000000'
          : play.wristbandTextColor || match?.numberTextColor || getContrastColor(numBg);

        // Formation check - suppress 21 formation and personnel tag to give play name maximum space
        let formation = (play.formation || '').trim();
        const upperForm = formation.toUpperCase();
        const upperName = (play.name || '').toUpperCase();
        if (
          upperForm === '21' ||
          upperForm === '21 L' ||
          upperForm === '21 R' ||
          upperForm.includes('21') ||
          upperName.includes(upperForm) ||
          upperName.startsWith('21') ||
          upperName.includes('21 L') ||
          upperName.includes('21 R') ||
          /\b21\b/.test(upperName)
        ) {
          formation = '';
        }

        return `
          <div class="callsheet-cell" style="padding: ${cellPadding};">
            <div class="cell-main">
              ${
                numVal
                  ? `<span class="wrist-badge" style="background: ${numBg} !important; color: ${numText} !important; font-size: ${badgeFontSize}; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${numVal}</span>`
                  : ''
              }
              <span class="play-name">${play.name}</span>
            </div>
            ${formation ? `<div class="cell-meta"><span class="formation-tag">(${formation})</span></div>` : ''}
          </div>
        `;
      })
      .join('');

    return `
      <div class="section-card" ${colSpanStyle ? `style="${colSpanStyle}"` : ''}>
        <div class="card-header" style="background: ${headerBg}; color: ${headerText}; padding: ${headerPadding}; font-size: ${baseFontSize};">
          <span class="card-title">${sec.title}</span>
          <span class="card-count">${validPlays.length}/${sec.slotsCount}</span>
        </div>
        ${subHeadersHtml}
        <div class="${cardBodyClass}" ${cardBodyStyle ? `style="${cardBodyStyle}"` : ''}>
          ${rowsHtml || '<div class="callsheet-cell empty-slot"><span class="slot-empty-text">No plays assigned</span></div>'}
        </div>
      </div>
    `;
  };

  // Dynamically calculate grid columns template so rows with fewer tables (or multi-column tables) expand proportionally across the page
  const getSectionListGridTemplate = (sectionList: CallSheetSection[], maxCols = printColumns) => {
    if (!sectionList || sectionList.length === 0) return `repeat(${maxCols}, 1fr)`;
    const totalSpan = sectionList.reduce(
      (acc, s) => acc + (s.colSpan || (s.columnsCount && s.columnsCount > 1 ? s.columnsCount : 1)),
      0
    );
    if (totalSpan <= maxCols) {
      return sectionList
        .map((s) => `${s.colSpan || (s.columnsCount && s.columnsCount > 1 ? s.columnsCount : 1)}fr`)
        .join(' ');
    }
    return `repeat(${maxCols}, 1fr)`;
  };

  const renderSectionGrid = (sectionList: CallSheetSection[], cols = printColumns) => {
    if (!sectionList || sectionList.length === 0) return '';
    const cards = sectionList.map((sec) => renderSectionCard(sec)).join('');
    const template = getSectionListGridTemplate(sectionList, cols);
    return `
      <div class="cards-grid" style="grid-template-columns: ${template}; gap: ${gridGap};">
        ${cards}
      </div>
    `;
  };

  // Build Sections HTML
  let topSituationsHtml = '';
  if (filter.topSituations && topSituations.length > 0) {
    const allHaveRowIndex = topSituations.length > 0 && topSituations.every((s) => typeof s.rowIndex === 'number');

    let rowsHtml = '';
    if (allHaveRowIndex) {
      const rowMap = new Map<number, CallSheetSection[]>();
      topSituations.forEach((sec) => {
        const r = sec.rowIndex ?? 0;
        if (!rowMap.has(r)) rowMap.set(r, []);
        rowMap.get(r)!.push(sec);
      });
      const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
      rowsHtml = sortedRowIndices
        .map((rIdx) => {
          const rowSecs = (rowMap.get(rIdx) || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          if (rowSecs.length === 0) return '';
          const rowCards = rowSecs.map((sec) => renderSectionCard(sec)).join('');
          const rowTemplate = getSectionListGridTemplate(rowSecs, printColumns);
          return `
            <div class="cards-grid situational-row" style="grid-template-columns: ${rowTemplate}; gap: ${gridGap}; margin-bottom: ${gridGap}; page-break-inside: avoid; break-inside: avoid;">
              ${rowCards}
            </div>
          `;
        })
        .join('');
    } else {
      // Chunk into rows of printColumns
      const rows: CallSheetSection[][] = [];
      for (let i = 0; i < topSituations.length; i += printColumns) {
        rows.push(topSituations.slice(i, i + printColumns));
      }
      rowsHtml = rows
        .map((rowSecs) => {
          const rowCards = rowSecs.map((sec) => renderSectionCard(sec)).join('');
          const rowTemplate = getSectionListGridTemplate(rowSecs, printColumns);
          return `
            <div class="cards-grid situational-row" style="grid-template-columns: ${rowTemplate}; gap: ${gridGap}; margin-bottom: ${gridGap}; page-break-inside: avoid; break-inside: avoid;">
              ${rowCards}
            </div>
          `;
        })
        .join('');
    }

    topSituationsHtml = `
      <div class="section-group">
        <div class="group-banner">${callSheetData.topSituationsTitle || 'SITUATIONAL CALLS &amp; DOWN-AND-DISTANCE'}</div>
        ${rowsHtml}
      </div>
    `;
  }

  let redZoneHtml = '';
  if (filter.redZone && redZone.length > 0) {
    redZoneHtml = `
      <div class="section-group redzone-group ${fitMode === '2page' ? 'page-break-before' : ''}">
        <div class="group-banner redzone-banner">${callSheetData.redZoneTitle || (isOffense ? 'RED ZONE &amp; GOAL LINE (INSIDE 20)' : 'RED ZONE DEFENSE &amp; GOAL LINE')}</div>
        ${renderSectionGrid(redZone, printColumns)}
      </div>
    `;
  }

  let tempoHtml = '';
  if (filter.tempo && tempo.length > 0) {
    tempoHtml = `
      <div class="section-group">
        <div class="group-banner">${callSheetData.tempoTitle || 'TEMPO, CLOCK &amp; SPECIALS'}</div>
        ${renderSectionGrid(tempo, printColumns)}
      </div>
    `;
  }

  let customHtml = '';
  if (filter.custom && custom.length > 0) {
    customHtml = `
      <div class="section-group">
        <div class="group-banner">${callSheetData.customTitle || 'CUSTOM SITUATIONS'}</div>
        ${renderSectionGrid(custom, printColumns)}
      </div>
    `;
  }

  // Scripts Box
  let scriptsHtml = '';
  if (filter.scripts) {
    const filledScripts = rawScripts
      .map((p, idx) => ({ play: p, num: idx + 1 }))
      .filter((item) => (hideEmptySlots ? item.play && item.play.name : true));

    const scriptItemsHtml = filledScripts
      .map(({ play, num }) => {
        if (!play || !play.name) {
          return `
            <div class="script-row empty-row">
              <span class="script-num">${num}.</span>
              <span class="script-name text-muted">&nbsp;</span>
            </div>
          `;
        }
        const match = play.wristbandSlotMatch;
        const numVal = cleanNum(play.wristbandNum || match?.slotNumber);
        const numBg = inkFriendly ? '#e2e8f0' : match?.numberBgColor || play.wristbandColor || '#e2e8f0';
        const numText = inkFriendly
          ? '#000'
          : play.wristbandTextColor || match?.numberTextColor || getContrastColor(numBg);

        return `
          <div class="script-row">
            <span class="script-num">${num}.</span>
            ${numVal ? `<span class="wrist-badge" style="background: ${numBg} !important; color: ${numText} !important; font-size: ${badgeFontSize}; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${numVal}</span>` : ''}
            <span class="script-name">${play.name}</span>
            ${play.formation ? `<span class="formation-tag">(${play.formation})</span>` : ''}
          </div>
        `;
      })
      .join('');

    scriptsHtml = `
      <div class="bottom-card scripts-card">
        <div class="card-header scripts-header" style="padding: ${headerPadding};">
          <span>SCRIPTS (OPENING 15)</span>
          <span>${rawScripts.filter((p) => p && p.name).length}/${rawScripts.length || 15}</span>
        </div>
        <div class="scripts-body" style="padding: 2px;">
          ${scriptItemsHtml || '<div class="text-muted p-1">No scripted plays</div>'}
        </div>
      </div>
    `;
  }

  // 2-Point Conversion Decision Matrix
  let twoPointHtml = '';
  if (filter.twoPoint) {
    const rules = callSheetData.twoPointRules || [
      { pointDiff: -15, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 15 after TD' },
      { pointDiff: -14, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 1', trailHighlight: false, notes: 'Down 14 after TD' },
      { pointDiff: -13, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 13 after TD' },
      { pointDiff: -12, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 1', trailHighlight: false, notes: 'Down 12 after TD' },
      { pointDiff: -11, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 11 after TD' },
      { pointDiff: -10, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 1', trailHighlight: false, notes: 'Down 10 after TD' },
      { pointDiff: -9, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 9 after TD' },
      { pointDiff: -8, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 8 after TD' },
      { pointDiff: -5, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 5 after TD' },
      { pointDiff: -4, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 4 after TD' },
      { pointDiff: -2, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 2 after TD' },
      { pointDiff: -1, leadAction: 'Go for 1', leadHighlight: false, trailAction: 'Go for 2', trailHighlight: true, notes: 'Down 1 after TD' },
      { pointDiff: 1, leadAction: 'Go for 2', leadHighlight: true, trailAction: 'Go for 1', trailHighlight: false, notes: 'Up 1 after TD' },
      { pointDiff: 2, leadAction: 'Go for 2', leadHighlight: true, trailAction: 'Go for 1', trailHighlight: false, notes: 'Up 2 after TD' },
    ];

    const rulesRowsHtml = rules
      .slice(0, 14)
      .map((r) => `
        <tr>
          <td class="diff-cell">${r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}</td>
          <td class="${r.trailHighlight ? 'action-highlight' : ''}">${r.trailAction}</td>
          <td class="${r.leadHighlight ? 'action-highlight' : ''}">${r.leadAction}</td>
        </tr>
      `)
      .join('');

    twoPointHtml = `
      <div class="bottom-card twopoint-card">
        <div class="card-header twopoint-header" style="padding: ${headerPadding};">
          <span>2-PT CONVERSION MATRIX</span>
        </div>
        <div class="twopoint-table-wrap">
          <table class="twopoint-table">
            <thead>
              <tr>
                <th>DIFF</th>
                <th>TRAILING</th>
                <th>LEADING</th>
              </tr>
            </thead>
            <tbody>
              ${rulesRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Timeouts Tracker
  let timeoutsHtml = '';
  if (filter.timeouts) {
    const timeoutsCount = callSheetData.timeoutsCount || 3;
    const makeBoxes = () => {
      let b = '';
      for (let i = 1; i <= timeoutsCount; i++) {
        b += `<span class="timeout-check-box">[ &nbsp; ]</span>`;
      }
      return b;
    };

    timeoutsHtml = `
      <div class="bottom-card timeouts-card">
        <div class="card-header timeouts-header" style="padding: ${headerPadding};">
          <span>TIMEOUTS LEFT</span>
        </div>
        <div class="timeouts-body" style="padding: 6px;">
          <div class="timeout-half">
            <div class="half-title">1ST HALF</div>
            <div class="half-row">
              <span class="team-label">US:</span>
              ${makeBoxes()}
            </div>
            <div class="half-row">
              <span class="team-label">OPP:</span>
              ${makeBoxes()}
            </div>
          </div>
          <div class="timeout-half" style="margin-top: 6px;">
            <div class="half-title">2ND HALF</div>
            <div class="half-row">
              <span class="team-label">US:</span>
              ${makeBoxes()}
            </div>
            <div class="half-row">
              <span class="team-label">OPP:</span>
              ${makeBoxes()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Bottom section grid with dynamic columns
  const activeBottomCount = (filter.scripts ? 1 : 0) + (filter.twoPoint ? 1 : 0) + (filter.timeouts ? 1 : 0);
  let bottomGridTemplate = '4.5fr 4.5fr 3fr';
  if (activeBottomCount === 2) {
    if (filter.scripts && filter.twoPoint) {
      bottomGridTemplate = '1.2fr 1fr';
    } else if (filter.scripts && filter.timeouts) {
      bottomGridTemplate = '1.6fr 1fr';
    } else {
      bottomGridTemplate = '1.4fr 1fr';
    }
  } else if (activeBottomCount === 1) {
    bottomGridTemplate = '1fr';
  }

  let bottomSectionHtml = '';
  if (filter.scripts || filter.twoPoint || filter.timeouts) {
    bottomSectionHtml = `
      <div class="section-group bottom-group">
        <div class="bottom-grid" style="grid-template-columns: ${bottomGridTemplate};">
          ${scriptsHtml}
          ${twoPointHtml}
          ${timeoutsHtml}
        </div>
      </div>
    `;
  }

  const stylesBlock = `
  <style>
    @page {
      size: letter ${orientation};
      margin: 0.2in;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #ffffff !important;
      background-color: #ffffff !important;
      color: #000000 !important;
      font-size: ${baseFontSize};
      line-height: 1.25;
      overflow: visible !important;
    }
    .print-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 3px;
      margin-bottom: 4px;
      background: #ffffff !important;
      min-height: 0;
      padding: 4px 6px;
      border-radius: ${inkFriendly ? '0' : '4px'};
    }
    .banner-title-area {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .banner-team {
      font-size: 10pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .banner-unit {
      font-size: 8pt;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 3px;
      background: ${inkFriendly ? '#f1f5f9' : isOffense ? '#0284c7' : '#dc2626'};
      color: ${inkFriendly ? '#000000' : '#ffffff'};
      border: 1px solid ${inkFriendly ? '#cbd5e1' : isOffense ? '#38bdf8' : '#f87171'};
      text-transform: uppercase;
    }
    .banner-meta {
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
    }
    .section-group {
      margin-bottom: 8px;
      page-break-inside: auto;
      break-inside: auto;
    }
    .page-break-before {
      page-break-before: always !important;
      break-before: page !important;
    }
    .group-banner {
      font-size: 8.5pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: ${inkFriendly ? '#f1f5f9' : '#e2e8f0'} !important;
      color: #0f172a !important;
      padding: 2px 6px;
      margin-bottom: 4px;
      border: 1px solid #cbd5e1;
      border-radius: ${inkFriendly ? '0' : '4px'};
    }
    .redzone-banner {
      background: #fee2e2 !important;
      color: #991b1b !important;
      border-color: #fca5a5 !important;
    }
    .cards-grid {
      display: grid;
      width: 100%;
    }
    .section-card {
      border: 1.5px solid #0f172a !important;
      background: #ffffff !important;
      border-radius: ${inkFriendly ? '0' : '4px'};
      display: flex;
      flex-direction: column;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: visible !important;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1.2px solid #0f172a;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 8.5pt;
      border-top-left-radius: ${inkFriendly ? '0' : '3px'};
      border-top-right-radius: ${inkFriendly ? '0' : '3px'};
    }
    .card-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-count {
      font-size: 7.5pt;
      opacity: 0.85;
      font-family: monospace;
    }
    .card-body {
      display: flex;
      flex-direction: column;
      background: #ffffff !important;
      border-bottom-left-radius: ${inkFriendly ? '0' : '3px'};
      border-bottom-right-radius: ${inkFriendly ? '0' : '3px'};
    }
    .card-body-grid {
      display: grid !important;
    }
    .card-body-grid .callsheet-cell {
      border-right: 1px solid #e2e8f0;
    }
    .callsheet-cell {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      gap: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
      background: #ffffff !important;
    }
    .callsheet-cell:last-child {
      border-bottom: none;
    }
    .empty-slot {
      background: #f8fafc !important;
      justify-content: center;
    }
    .slot-empty-text {
      color: #94a3b8;
      font-style: italic;
      font-size: 7.5pt;
    }
    .cell-main {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }
    .wrist-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border-radius: 2px;
      font-family: monospace;
      font-weight: 900;
      border: 1px solid rgba(0,0,0,0.25);
      flex-shrink: 0;
      line-height: 1.3;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .play-name {
      font-weight: 900;
      text-transform: uppercase;
      word-break: break-word;
      line-height: 1.15;
      font-size: ${baseFontSize};
      flex: 1;
      color: #000000 !important;
    }
    .cell-meta {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
      font-size: 7.5pt;
    }
    .formation-tag {
      color: #475569;
      font-weight: 700;
      font-family: monospace;
    }
    .personnel-tag {
      background: #e2e8f0;
      color: #1e293b;
      padding: 0 3px;
      border-radius: 2px;
      font-weight: 800;
      font-size: 7pt;
      font-family: monospace;
      border: 1px solid #cbd5e1;
    }
    .bottom-grid {
      display: grid;
      grid-template-columns: 4.5fr 4.5fr 3fr;
      gap: ${gridGap};
      page-break-inside: avoid;
      break-inside: avoid;
    }
    @media (max-width: 700px) {
      .bottom-grid {
        grid-template-columns: 1fr;
      }
    }
    .bottom-card {
      border: 1.5px solid #0f172a !important;
      background: #ffffff !important;
      border-radius: ${inkFriendly ? '0' : '4px'};
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .scripts-header {
      background: #7e22ce;
      color: #ffffff;
    }
    .scripts-body {
      display: flex;
      flex-direction: column;
      gap: 1px;
      background: #ffffff !important;
    }
    .script-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 1.5px 3px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 8pt;
      background: #ffffff !important;
    }
    .script-num {
      font-weight: 900;
      font-family: monospace;
      color: #475569;
      width: 18px;
    }
    .script-name {
      font-weight: 900;
      text-transform: uppercase;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #000000 !important;
    }
    .twopoint-header {
      background: #334155;
      color: #ffffff;
    }
    .twopoint-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      text-align: center;
      background: #ffffff !important;
    }
    .twopoint-table th {
      background: #e2e8f0 !important;
      color: #000000 !important;
      font-weight: 900;
      padding: 2px;
      border: 1px solid #cbd5e1;
    }
    .twopoint-table td {
      padding: 1.5px 2px;
      border: 1px solid #e2e8f0;
      background: #ffffff !important;
      color: #000000 !important;
      font-weight: 700;
    }
    .diff-cell {
      font-family: monospace;
      font-weight: 900;
      color: #000000 !important;
    }
    .action-highlight {
      background: #fef08a !important;
      color: #854d0e !important;
      font-weight: 900 !important;
    }
    .timeouts-header {
      background: #0f172a;
      color: #ffffff;
    }
    .timeouts-body {
      background: #ffffff !important;
    }
    .half-title {
      font-weight: 900;
      font-size: 7.5pt;
      color: #475569;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .half-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
      font-size: 8pt;
      background: #ffffff !important;
    }
    .team-label {
      font-weight: 900;
      width: 32px;
      color: #000000 !important;
    }
    .timeout-check-box {
      font-family: monospace;
      font-weight: 900;
      font-size: 9pt;
      color: #0284c7 !important;
    }
    .text-muted {
      color: #64748b;
    }
  </style>
`;

  const bannerHtml = `
    <div class="print-banner">
      <div class="banner-title-area">
        <span class="banner-team">${activeTeamName}</span>
        <span class="banner-unit">${unitLabel}</span>
        <span style="font-weight: 900; text-transform: uppercase;">${sheetTitle}</span>
      </div>
      <div class="banner-meta">
        ${opponent ? `<span>${opponent}</span> &bull; ` : ''}
        <span>${gameDate || 'Sideline Master'}</span>
      </div>
    </div>
  `;

  if (options?.snippetOnly) {
    return `
      ${stylesBlock}
      <div class="callsheet-snippet-wrapper" style="width: 100%; background: ${inkFriendly ? '#ffffff' : '#090d16'}; color: ${inkFriendly ? '#000000' : '#f8fafc'};">
        ${bannerHtml}
        ${topSituationsHtml}
        ${redZoneHtml}
        ${tempoHtml}
        ${customHtml}
        ${bottomSectionHtml}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  ${stylesBlock}
</head>
<body>
  ${bannerHtml}
  ${topSituationsHtml}
  ${redZoneHtml}
  ${tempoHtml}
  ${customHtml}
  ${bottomSectionHtml}
</body>
</html>`;
}

/**
 * Print Call Sheet using dedicated isolated print engine.
 */
export function printCallSheet(
  callSheetData: CallSheetFullData,
  activeUnit: 'offense' | 'defense' = 'offense',
  activeTeamName: string = 'Mahopac 10U',
  documentTitle?: string,
  options?: CallSheetPrintOptions
) {
  const html = generateCallSheetPrintHTML(callSheetData, activeUnit, activeTeamName, documentTitle, options);
  const title = documentTitle || `${activeTeamName}_${activeUnit.toUpperCase()}_Call_Sheet`;
  printCleanHTML(html, title);
}

/* =========================================================================
   POCKET DEPTH CHART BULLETPROOF PRINT ENGINE
   ========================================================================= */

export interface PocketDepthChartPrintOptions {
  orientation?: 'portrait' | 'landscape';
  layout?: 'pocket_grid' | 'side_by_side' | 'full_table' | 'single_column';
  depthLevels?: '2_deep' | '3_deep' | 'all' | 'starters_only';
  fontSize?: 'compact' | 'standard' | 'large';
  inkFriendly?: boolean;
  columnsCount?: 1 | 2 | 3;
  oneChartPerColumn?: boolean;
  oneChartPerPage?: boolean;
  showCutLines?: boolean;
  selectedFormationIds?: string[];
  unitFilter?: 'offense' | 'defense' | 'st' | 'groups' | 'both_off_def' | 'all';
  teamName?: string;
  seasonLabel?: string;
  highlightedCells?: Record<string, 'black' | 'gold' | 'blue' | string>;
}

/**
 * Generate isolated, crisp, print-ready HTML for the Pocket Depth Chart.
 * Engineered for pocket-sized laminated cards, half-sheet cards, and clipboard quick-reference.
 */
export function generatePocketDepthChartPrintHTML(
  formations: FormationBoard[],
  depthChart: Record<string, PlacedPlayer[]>,
  options?: PocketDepthChartPrintOptions
): string {
  const orientation = options?.orientation || 'landscape';
  const isOneChartPerCol = Boolean(
    options?.oneChartPerColumn ||
    options?.columnsCount === 1 ||
    options?.layout === 'single_column' ||
    options?.layout === 'full_table'
  );
  const layout = isOneChartPerCol ? 'single_column' : (options?.layout || (options?.unitFilter === 'both_off_def' ? 'side_by_side' : 'pocket_grid'));
  const depthLevels = options?.depthLevels || '2_deep';
  const fontSizeMode = options?.fontSize || 'compact';
  const inkFriendly = options?.inkFriendly ?? true;
  const showCutLines = options?.showCutLines ?? true;
  const teamName = options?.teamName || 'Football Manager';
  const seasonLabel = options?.seasonLabel || 'Game Day Depth Chart';

  // Base font sizing
  const baseFs = fontSizeMode === 'compact' ? 10 : fontSizeMode === 'large' ? 12 : 11;
  const headerFs = baseFs + 1;
  const subFs = Math.max(8, baseFs - 2);

  // Filter formations and preserve exact user-defined ordering if selectedFormationIds is provided
  let targetFormations = formations;
  if (options?.selectedFormationIds && options.selectedFormationIds.length > 0) {
    const idMap = new Map(formations.map((f) => [f.id, f]));
    targetFormations = options.selectedFormationIds
      .map((id) => idMap.get(id))
      .filter((f): f is FormationBoard => Boolean(f));
  }

  // Filter by unit
  if (options?.unitFilter && options.unitFilter !== 'all' && options.unitFilter !== 'both_off_def') {
    targetFormations = targetFormations.filter((f) => f.unit === options.unitFilter);
  }

  const pageBreakRule = options?.oneChartPerPage ? 'break-after: page; page-break-after: always;' : 'break-inside: avoid; page-break-inside: avoid;';

  const renderSingleFormationCard = (form: FormationBoard, unitLabel?: string, isDedicatedPage?: boolean) => {
    // Collect slots - position descriptions removed for ultra-clean pocket card readability
    const slots: Array<{ pos: { id: string; name: string } }> = [];
    form.rows.forEach((r) => {
      r.positions.forEach((p) => {
        if (p) slots.push({ pos: p });
      });
    });

    if (slots.length === 0) return '';

    const unitTag = unitLabel || (form.unit === 'offense' ? 'OFF' : form.unit === 'defense' ? 'DEF' : form.unit === 'st' ? 'ST' : 'GRP');

    const showStarter = true;
    const show2nd = depthLevels !== 'starters_only';
    const show3rd = depthLevels === '3_deep' || depthLevels === 'all';
    const showBackups = depthLevels === 'all';

    const rowsHtml = slots
      .map(({ pos }) => {
        const players = depthChart[pos.id] || [];
        const p1 = players[0];
        const p2 = players[1];
        const p3 = players[2];
        const extraBackups = players.slice(3);

        const posKey = `${form.id}__${pos.id}__pos`;
        const blackKey = `${form.id}__${pos.id}__black`;
        const goldKey = `${form.id}__${pos.id}__gold`;
        const blueKey = `${form.id}__${pos.id}__blue`;
        const backupsKey = `${form.id}__${pos.id}__backups`;

        const getHighlightStyle = (cellKey: string, defaultColor: 'black' | 'gold' | 'blue') => {
          const raw = options?.highlightedCells?.[cellKey];
          if (!raw) return null;
          const color = raw === 'black' || raw === 'gold' || raw === 'blue' ? raw : defaultColor;
          if (color === 'black') {
            return {
              bg: '#cbd5e1', // Lighter shade of Black (Slate-300)
              border: '#0f172a',
              text: '#000000',
            };
          } else if (color === 'gold') {
            return {
              bg: '#fef08a', // Lighter shade of Gold (Yellow-200)
              border: '#d97706',
              text: '#000000',
            };
          } else {
            return {
              bg: '#bfdbfe', // Lighter shade of Blue (Blue-200)
              border: '#2563eb',
              text: '#000000',
            };
          }
        };

        const hlPos = getHighlightStyle(posKey, 'black');
        const hlBlack = getHighlightStyle(blackKey, 'black');
        const hlGold = getHighlightStyle(goldKey, 'gold');
        const hlBlue = getHighlightStyle(blueKey, 'blue');
        const hlBackups = getHighlightStyle(backupsKey, 'blue');

        const renderPlayer = (p?: PlacedPlayer, stringTier: 1 | 2 | 3 = 1, isHighlighted = false) => {
          if (!p) {
            return isHighlighted
              ? `<span style="color: #475569; font-weight: 700; font-size: ${subFs}px;">&mdash;</span>`
              : '<span style="color: #94a3b8; font-weight: 600;">&mdash;</span>';
          }

          if (inkFriendly) {
            const badgeBorder = stringTier === 1
              ? 'background: #000; color: #fff;'
              : stringTier === 2
              ? 'border: 1.2px solid #000; color: #000; background: #fff;'
              : 'border: 1px dashed #475569; color: #1e293b; background: #f8fafc;';
            return `
              <div style="display: flex; align-items: center; gap: 4px; min-width: 0; line-height: 1.2;">
                <span style="display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 16px; padding: 0 3px; font-weight: 900; font-size: ${subFs + 1}px; font-family: monospace; border-radius: 2px; ${badgeBorder} shrink: 0;">#${p.num}</span>
                <span style="font-weight: 900; text-transform: uppercase; font-size: ${baseFs}px; color: #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
              </div>
            `;
          }

          // High visibility color
          const badgeStyle =
            stringTier === 1
              ? 'background: #09090b; color: #fef08a; border: 1px solid #713f12;'
              : stringTier === 2
              ? 'background: #fef08a; color: #713f12; border: 1px solid #eab308;'
              : 'background: #dbeafe; color: #1e40af; border: 1px solid #3b82f6;';

          return `
            <div style="display: flex; align-items: center; gap: 4px; min-width: 0; line-height: 1.2;">
              <span style="display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 16px; padding: 0 3px; font-weight: 900; font-size: ${subFs + 1}px; font-family: monospace; border-radius: 3px; ${badgeStyle} shrink: 0;">#${p.num}</span>
              <span style="font-weight: 900; text-transform: uppercase; font-size: ${baseFs}px; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
            </div>
          `;
        };

        const backupsHtml = extraBackups.length > 0
          ? extraBackups.map((b) => `<span style="font-size: ${subFs}px; font-weight: 700; color: #334155; white-space: nowrap;">#${b.num} ${b.name}</span>`).join(', ')
          : `<span style="color: #94a3b8; font-size: ${subFs}px;">&mdash;</span>`;

        return `
          <tr style="border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 3px 6px; font-weight: 900; font-size: ${baseFs}px; background: ${hlPos ? hlPos.bg : (inkFriendly ? '#f8fafc' : '#f1f5f9')} !important; border-right: 1.5px solid #000; text-align: center; vertical-align: middle; white-space: nowrap; ${hlPos ? `outline: 1.5px solid ${hlPos.border}; outline-offset: -1.5px; box-shadow: inset 0 0 0 1.5px ${hlPos.border};` : ''}">
              <div style="display: inline-flex; align-items: center; justify-content: center; background: ${hlPos ? hlPos.border : '#1e293b'}; color: #fff; font-size: ${baseFs}px; font-weight: 900; padding: 2px 6px; border-radius: 3px; letter-spacing: 0.5px;">${pos.name}</div>
            </td>
            ${showStarter ? `<td style="padding: 3px 6px; vertical-align: middle; background: ${hlBlack ? hlBlack.bg : '#fff'} !important; border-right: 1px solid #e2e8f0; ${hlBlack ? `outline: 1.5px solid ${hlBlack.border}; outline-offset: -1.5px; box-shadow: inset 0 0 0 1.5px ${hlBlack.border};` : ''}">${renderPlayer(p1, 1, Boolean(hlBlack))}</td>` : ''}
            ${show2nd ? `<td style="padding: 3px 6px; vertical-align: middle; background: ${hlGold ? hlGold.bg : (inkFriendly ? '#fff' : '#fffbeb')} !important; border-right: 1px solid #e2e8f0; ${hlGold ? `outline: 1.5px solid ${hlGold.border}; outline-offset: -1.5px; box-shadow: inset 0 0 0 1.5px ${hlGold.border};` : ''}">${renderPlayer(p2, 2, Boolean(hlGold))}</td>` : ''}
            ${show3rd ? `<td style="padding: 3px 6px; vertical-align: middle; background: ${hlBlue ? hlBlue.bg : (inkFriendly ? '#fff' : '#f0f9ff')} !important; border-right: 1px solid #e2e8f0; ${hlBlue ? `outline: 1.5px solid ${hlBlue.border}; outline-offset: -1.5px; box-shadow: inset 0 0 0 1.5px ${hlBlue.border};` : ''}">${renderPlayer(p3, 3, Boolean(hlBlue))}</td>` : ''}
            ${showBackups ? `<td style="padding: 3px 6px; vertical-align: middle; background: ${hlBackups ? hlBackups.bg : '#fff'} !important; ${hlBackups ? `outline: 1.5px solid ${hlBackups.border}; outline-offset: -1.5px; box-shadow: inset 0 0 0 1.5px ${hlBackups.border};` : ''}">${backupsHtml}</td>` : ''}
          </tr>
        `;
      })
      .join('');

    const cardBreakRule = isDedicatedPage ? 'page-break-inside: avoid; break-inside: avoid;' : pageBreakRule;

    return `
      <div class="pocket-formation-card" style="border: 1.8px solid #000; border-radius: 5px; overflow: hidden; background: #fff; ${cardBreakRule} margin-bottom: 10px; width: 100%; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: ${inkFriendly ? '#000' : '#0f172a'}; color: #fff; border-bottom: 1.5px solid #000;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: ${subFs + 1}px; background: #f59e0b; color: #000; padding: 1px 5px; border-radius: 3px; text-transform: uppercase;">${unitTag}</span>
            <span style="font-weight: 900; font-size: ${headerFs}px; text-transform: uppercase; letter-spacing: 0.5px; color: #fff;">${form.name}</span>
          </div>
          <span style="font-size: ${subFs}px; font-weight: 700; color: #cbd5e1;">${slots.length} Positions</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: ${baseFs}px;">
          <thead>
            <tr style="background: ${inkFriendly ? '#e2e8f0' : '#1e293b'}; color: ${inkFriendly ? '#000' : '#fff'}; border-bottom: 1.5px solid #000; font-weight: 900; font-size: ${subFs}px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 3px 5px; width: 18%; border-right: 1.5px solid #000; text-align: center;">POS</th>
              ${showStarter ? `<th style="padding: 3px 6px; width: ${show3rd || showBackups ? '27%' : '41%'}; border-right: 1px solid #94a3b8;">BLACK</th>` : ''}
              ${show2nd ? `<th style="padding: 3px 6px; width: ${show3rd || showBackups ? '27%' : '41%'}; border-right: 1px solid #94a3b8;">GOLD</th>` : ''}
              ${show3rd ? `<th style="padding: 3px 6px; width: 28%; border-right: 1px solid #94a3b8;">BLUE</th>` : ''}
              ${showBackups ? `<th style="padding: 3px 6px;">BACKUPS</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  };

  let contentHtml = '';

  if (options?.oneChartPerPage) {
    // Dedicated One-Chart-Per-Page layout:
    // Each formation card is rendered as a standalone block-level page with explicit CSS page breaks.
    // Avoid flex/grid wrappers that cause Chromium to discard page-break-after rules.
    const pages = targetFormations.map((form, fIdx) => {
      const isLast = fIdx === targetFormations.length - 1;
      const card = renderSingleFormationCard(form, undefined, true);
      const unitTag = form.unit === 'offense' ? 'OFFENSE' : form.unit === 'defense' ? 'DEFENSE' : form.unit === 'st' ? 'SPECIAL TEAMS' : 'POSITION GROUP';

      return `
        <div class="pocket-page-card ${!isLast ? 'has-page-break' : ''}" style="display: block; width: 100%; box-sizing: border-box; page-break-inside: avoid !important; break-inside: avoid !important; ${!isLast ? 'page-break-after: always !important; break-after: page !important; margin-bottom: 0;' : ''}">
          <div class="pocket-sheet-header">
            <div>
              <h1 class="pocket-title">${teamName} &bull; ${form.name.toUpperCase()}</h1>
              <p class="pocket-subtitle">${seasonLabel} &bull; ${unitTag} Sideline Depth Chart &bull; Card ${fIdx + 1} of ${targetFormations.length}</p>
            </div>
            <div class="pocket-legend">
              <div class="legend-item"><span class="legend-box" style="background: #000;"></span> <span>Black</span></div>
              <div class="legend-item"><span class="legend-box" style="background: #f59e0b; border: 1px solid #b45309;"></span> <span>Gold</span></div>
              <div class="legend-item"><span class="legend-box" style="background: #3b82f6; border: 1px solid #1d4ed8;"></span> <span>Blue</span></div>
            </div>
          </div>
          <div style="width: 100%; display: block;">
            ${card}
          </div>
          <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: ${subFs}px; color: #64748b; font-weight: 700;">
            <span>Pocket Sideline Reference Card &bull; ${form.name}</span>
            <span>Generated by Football Manager &bull; ${new Date().toLocaleDateString()}</span>
          </div>
        </div>
        ${!isLast ? '<div class="print-page-break" style="display: block; page-break-before: always !important; break-before: page !important; clear: both !important; height: 0; margin: 0; padding: 0;"></div>' : ''}
      `;
    }).join('\n');

    contentHtml = `
      <div class="pocket-pages-container" style="display: block; width: 100%;">
        ${pages || '<div style="padding: 20px; font-weight: 700; color: #64748b; text-align: center;">No formations found to print.</div>'}
      </div>
    `;
  } else if (isOneChartPerCol) {
    // 1 chart per column: each formation card occupies full width in a clean single-column block stack (NOT flex)
    const cards = targetFormations.map((f) => renderSingleFormationCard(f)).join('');
    contentHtml = `
      <div class="single-column-pocket-layout" style="display: block; width: 100%;">
        ${cards || '<div style="padding: 20px; font-weight: 700; color: #64748b; text-align: center;">No formations found to print.</div>'}
      </div>
    `;
  } else if (layout === 'side_by_side' || options?.unitFilter === 'both_off_def') {
    const offForms = targetFormations.filter((f) => f.unit === 'offense');
    const defForms = targetFormations.filter((f) => f.unit === 'defense');
    const stAndOtherForms = targetFormations.filter((f) => f.unit !== 'offense' && f.unit !== 'defense');

    const offCards = offForms.map((f) => renderSingleFormationCard(f, 'OFF')).join('');
    const defCards = defForms.map((f) => renderSingleFormationCard(f, 'DEF')).join('');
    const otherCards = stAndOtherForms.map((f) => renderSingleFormationCard(f, f.unit === 'st' ? 'ST' : 'GRP')).join('');

    const otherSectionHtml = stAndOtherForms.length > 0 ? `
      <div style="margin-top: 14px; border-top: 2px dashed #94a3b8; padding-top: 10px; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-weight: 900; font-size: ${headerFs + 1}px; text-transform: uppercase; color: #000; border-bottom: 2px solid #000; padding-bottom: 2px; margin-bottom: 6px; display: flex; justify-content: space-between;">
          <span>SPECIAL TEAMS &amp; ADDITIONAL FORMATIONS</span>
          <span style="font-size: ${subFs}px; color: #475569;">${stAndOtherForms.length} Formations</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(${options?.columnsCount || (orientation === 'landscape' ? 2 : 1)}, 1fr); gap: 10px;">
          ${otherCards}
        </div>
      </div>
    ` : '';

    contentHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; position: relative;">
        ${showCutLines ? `
          <div class="fold-guide-line" style="position: absolute; top: 0; bottom: 0; left: 50%; width: 0; border-left: 1.5px dashed #64748b; transform: translateX(-50%); pointer-events: none;">
            <div style="position: absolute; top: 50%; left: -60px; width: 120px; text-align: center; font-size: 8.5px; font-weight: 800; color: #64748b; background: #fff; padding: 2px 4px; border: 1px solid #cbd5e1; border-radius: 3px; transform: rotate(-90deg);">
              &#9986; FOLD / CUT LINE
            </div>
          </div>
        ` : ''}
        <div class="offense-column">
          <div style="font-weight: 900; font-size: ${headerFs + 1}px; text-transform: uppercase; color: #000; border-bottom: 2px solid #000; padding-bottom: 2px; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>OFFENSIVE DEPTH</span>
            <span style="font-size: ${subFs}px; color: #475569;">${offForms.length} Formations</span>
          </div>
          ${offCards || '<div style="padding: 12px; font-weight: 700; color: #64748b;">No offensive formations found.</div>'}
        </div>
        <div class="defense-column">
          <div style="font-weight: 900; font-size: ${headerFs + 1}px; text-transform: uppercase; color: #000; border-bottom: 2px solid #000; padding-bottom: 2px; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>DEFENSIVE DEPTH</span>
            <span style="font-size: ${subFs}px; color: #475569;">${defForms.length} Formations</span>
          </div>
          ${defCards || '<div style="padding: 12px; font-weight: 700; color: #64748b;">No defensive formations found.</div>'}
        </div>
      </div>
      ${otherSectionHtml}
    `;
  } else {
    const cols = options?.columnsCount || (orientation === 'landscape' ? 2 : 1);
    const cards = targetFormations.map((f) => renderSingleFormationCard(f)).join('');

    contentHtml = `
      <div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 10px;">
        ${cards || '<div style="padding: 20px; font-weight: 700; color: #64748b; text-align: center;">No formations found to print.</div>'}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${teamName} - Pocket Depth Chart</title>
  <style>
    @page {
      size: letter ${orientation};
      margin: 0.25in;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 0;
      line-height: 1.25;
    }
    .pocket-sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #000;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .pocket-title {
      font-size: ${headerFs + 3}px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000;
    }
    .pocket-subtitle {
      font-size: ${subFs + 1}px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      margin-top: 1px;
    }
    .pocket-legend {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: ${subFs}px;
      font-weight: 800;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .legend-box {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      display: inline-block;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        width: 100% !important;
        height: auto !important;
      }
      .pocket-pages-container,
      .single-column-pocket-layout {
        display: block !important;
        width: 100% !important;
      }
      .pocket-page-card {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        display: block !important;
        clear: both !important;
        width: 100% !important;
        margin-bottom: 0 !important;
      }
      .pocket-page-card.has-page-break {
        page-break-after: always !important;
        break-after: page !important;
      }
      .print-page-break {
        page-break-before: always !important;
        break-before: page !important;
        display: block !important;
        clear: both !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .pocket-formation-card {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .no-print {
        display: none !important;
      }
    }
    @media screen {
      body {
        background: #0f172a;
        padding: 20px;
      }
      .pocket-pages-container,
      .single-column-pocket-layout,
      .pocket-sheet-header,
      .pocket-formation-card {
        max-width: ${orientation === 'landscape' ? '1020px' : '820px'};
        margin-left: auto;
        margin-right: auto;
      }
      .pocket-page-card {
        background: #ffffff;
        padding: 20px;
        margin: 0 auto 24px auto;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      .print-page-break {
        display: block;
        border-top: 2px dashed #64748b;
        margin: 20px auto;
        max-width: ${orientation === 'landscape' ? '1020px' : '820px'};
        text-align: center;
        position: relative;
      }
      .print-page-break::after {
        content: "--- PAGE BREAK (NEW PRINT SHEET) ---";
        display: inline-block;
        background: #0f172a;
        color: #94a3b8;
        padding: 2px 10px;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 1px;
        position: relative;
        top: -9px;
        border-radius: 4px;
      }
    }
  </style>
</head>
<body>
  ${
    options?.oneChartPerPage
      ? ''
      : `
  <div class="pocket-sheet-header">
    <div>
      <h1 class="pocket-title">${teamName} &bull; POCKET DEPTH CHART</h1>
      <p class="pocket-subtitle">${seasonLabel} &bull; Laminated Pocket Sideline Reference</p>
    </div>
    <div class="pocket-legend">
      <div class="legend-item">
        <span class="legend-box" style="background: #000;"></span>
        <span>Black</span>
      </div>
      <div class="legend-item">
        <span class="legend-box" style="background: #f59e0b; border: 1px solid #b45309;"></span>
        <span>Gold</span>
      </div>
      <div class="legend-item">
        <span class="legend-box" style="background: #3b82f6; border: 1px solid #1d4ed8;"></span>
        <span>Blue</span>
      </div>
      ${options?.highlightedCells && Object.keys(options.highlightedCells).length > 0 ? `
        <div class="legend-item" style="border-left: 1.5px solid #cbd5e1; padding-left: 8px; margin-left: 4px; display: flex; align-items: center; gap: 4px;">
          <span style="font-weight: 900; text-transform: uppercase; font-size: ${subFs}px; color: #475569;">Highlights:</span>
          <span class="legend-box" style="background: #cbd5e1; border: 1px solid #0f172a;"></span>
          <span>Black</span>
          <span class="legend-box" style="background: #fef08a; border: 1px solid #d97706;"></span>
          <span>Gold</span>
          <span class="legend-box" style="background: #bfdbfe; border: 1px solid #2563eb;"></span>
          <span>Blue</span>
        </div>
      ` : ''}
    </div>
  </div>
  `
  }

  ${contentHtml}

  ${
    options?.oneChartPerPage
      ? ''
      : `
  <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: ${subFs}px; color: #64748b; font-weight: 700;">
    <span>Fold along center line or cut for 5.5" x 8.5" coach pocket card.</span>
    <span>Generated by Football Manager &bull; ${new Date().toLocaleDateString()}</span>
  </div>
  `
  }
</body>
</html>`;
}

/**
 * Direct print trigger for Pocket Depth Chart using clean HTML engine.
 */
export function printPocketDepthChart(
  formations: FormationBoard[],
  depthChart: Record<string, PlacedPlayer[]>,
  options?: PocketDepthChartPrintOptions
) {
  const html = generatePocketDepthChartPrintHTML(formations, depthChart, options);
  const title = `${options?.teamName || 'Football'}_Pocket_Depth_Chart`;
  printCleanHTML(html, title);
}

/* =========================================================================
   FORMATION TACTICAL FIELD DEPTH CHART BULLETPROOF PRINT ENGINE
   ========================================================================= */

export interface FormationDepthChartPrintOptions {
  orientation?: 'portrait' | 'landscape';
  layout?: '1_per_page' | '2_per_page';
  depthLevels?: 'starters_only' | '2_deep' | '3_deep' | 'all';
  colorMode?: 'color' | 'sideline_contrast' | 'ink_friendly';
  starterBadgeStyle?: 'white' | 'black';
  selectedFormationIds?: string[];
  unitFilter?: 'offense' | 'defense' | 'st' | 'both_off_def' | 'all' | 'current';
  teamName?: string;
  seasonLabel?: string;
  highlightedCells?: Record<string, 'black' | 'gold' | 'blue' | string>;
}

/**
 * Generate isolated, crisp, print-ready HTML for the Tactical Field Diagram Depth Chart.
 * Produces full-size tactical diagrams with exact position slots, starters, D2 gold, D3 royal blue,
 * backups, and high-visibility player highlighting.
 */
export function generateFormationDepthChartPrintHTML(
  formations: FormationBoard[],
  depthChart: Record<string, PlacedPlayer[]>,
  options?: FormationDepthChartPrintOptions
): string {
  const orientation = options?.orientation || 'landscape';
  const layout = options?.layout || '1_per_page';
  const depthLevels = options?.depthLevels || 'all';
  const colorMode = options?.colorMode || 'color';
  const inkFriendly = colorMode === 'ink_friendly';
  const starterBadgeStyle = options?.starterBadgeStyle || 'white';
  const teamName = options?.teamName || 'VARSITY FOOTBALL';
  const seasonLabel = options?.seasonLabel || '2026 SEASON';
  const highlightedCells = options?.highlightedCells || {};

  // Filter formations based on unit or selected list
  let targetFormations = [...formations];
  if (options?.selectedFormationIds && options.selectedFormationIds.length > 0) {
    const selSet = new Set(options.selectedFormationIds);
    targetFormations = targetFormations.filter((f) => selSet.has(f.id));
  } else if (options?.unitFilter && options.unitFilter !== 'all') {
    if (options.unitFilter === 'both_off_def') {
      targetFormations = targetFormations.filter((f) => f.unit === 'offense' || f.unit === 'defense');
    } else if (options.unitFilter !== 'current') {
      targetFormations = targetFormations.filter((f) => f.unit === options.unitFilter);
    }
  }

  if (targetFormations.length === 0) {
    targetFormations = formations;
  }

  const getPlayerHighlightStyle = (cellKey: string, tierTeam: 'black' | 'gold' | 'blue'): { bg: string; border: string; text: string; shadow?: string } | null => {
    const customHl = highlightedCells[cellKey];
    if (!customHl) return null;

    if (customHl === 'black') {
      return {
        bg: '#e2e8f0',
        border: '#09090b',
        text: '#000000',
        shadow: '0 0 0 2px #0f172a',
      };
    }
    if (customHl === 'gold') {
      return {
        bg: '#fef08a',
        border: '#ca8a04',
        text: '#000000',
        shadow: '0 0 0 2px #facc15',
      };
    }
    if (customHl === 'blue') {
      return {
        bg: '#bfdbfe',
        border: '#1d4ed8',
        text: '#0f172a',
        shadow: '0 0 0 2px #3b82f6',
      };
    }
    return null;
  };

  const formationsHtml = targetFormations.map((form, formIdx) => {
    const unitBadgeBg = form.unit === 'offense' ? '#2563eb' : form.unit === 'defense' ? '#dc2626' : form.unit === 'st' ? '#7c3aed' : '#475569';
    const unitLabel = form.unit === 'offense' ? 'OFFENSE' : form.unit === 'defense' ? 'DEFENSE' : form.unit === 'st' ? 'SPECIAL TEAMS' : 'FORMATION';

    const rowsHtml = form.rows.map((row) => {
      const nonNullSlots = row.positions.filter((p): p is NonNullable<typeof p> => p !== null);
      if (nonNullSlots.length === 0) return '';

      const slotCols = row.positions.map((slot) => {
        if (!slot) {
          return '<div style="visibility: hidden; min-height: 48px;"></div>';
        }

        const slotKey = `${form.id}__${slot.id}`;
        const slotHighlight = getPlayerHighlightStyle(slotKey, 'black');
        const allPlayers = depthChart[slot.id] || [];

        let visiblePlayers: PlacedPlayer[] = [];
        if (depthLevels === 'starters_only') {
          visiblePlayers = allPlayers.slice(0, 1);
        } else if (depthLevels === '2_deep') {
          visiblePlayers = allPlayers.slice(0, 2);
        } else if (depthLevels === '3_deep') {
          visiblePlayers = allPlayers.slice(0, 3);
        } else {
          visiblePlayers = allPlayers;
        }

        const playersHtml = visiblePlayers.length > 0
          ? visiblePlayers.map((p, pIdx) => {
              const tierTeam = pIdx === 0 ? 'black' : pIdx === 1 ? 'gold' : 'blue';
              const playerKey = `${form.id}__${slot.id}__${tierTeam}`;
              const playerHl = getPlayerHighlightStyle(playerKey, tierTeam) || slotHighlight;

              if (inkFriendly) {
                const tag = pIdx === 0 ? 'ST' : pIdx === 1 ? 'D2' : pIdx === 2 ? 'D3' : `D${pIdx + 1}`;
                const tagStyle = pIdx === 0
                  ? 'background: #000; color: #fff;'
                  : 'background: #f1f5f9; color: #000; border: 1px solid #000;';
                const rowBg = playerHl ? playerHl.bg : (pIdx === 0 ? '#ffffff' : pIdx === 1 ? '#f8fafc' : '#ffffff');
                const border = playerHl ? `1.5px solid ${playerHl.border}` : '1px solid #cbd5e1';

                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 2.5px 5px; margin-bottom: 2px; border-radius: 3px; background: ${rowBg}; border: ${border}; min-height: 20px; box-sizing: border-box;">
                    <div style="display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden;">
                      <span style="display: inline-block; font-size: 8.5px; font-weight: 900; padding: 1px 3px; border-radius: 2px; ${tagStyle} shrink: 0;">${tag}</span>
                      <span style="font-family: monospace; font-size: 10px; font-weight: 900; color: #000; shrink: 0;">#${p.num}</span>
                      <span style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; color: #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
                    </div>
                  </div>
                `;
              }

              // Color / High-visibility Mode
              if (pIdx === 0) {
                // Starter / 1st String: White (clean print standard) or Obsidian Black
                const isWhiteStarter = starterBadgeStyle === 'white';
                const defaultBg = isWhiteStarter ? '#ffffff' : '#09090b';
                const defaultText = isWhiteStarter ? '#000000' : '#ffffff';
                const defaultBorder = isWhiteStarter ? '2px solid #000000' : '1.5px solid #27272a';
                const defaultTagBg = isWhiteStarter ? '#000000' : '#ffffff';
                const defaultTagColor = isWhiteStarter ? '#ffffff' : '#000000';

                const bg = playerHl ? playerHl.bg : defaultBg;
                const text = playerHl ? playerHl.text : defaultText;
                const border = playerHl ? `2px solid ${playerHl.border}` : defaultBorder;
                const tagBg = playerHl ? '#000000' : defaultTagBg;
                const tagColor = playerHl ? '#ffffff' : defaultTagColor;

                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 2.5px 5px; margin-bottom: 2.5px; border-radius: 3px; background: ${bg}; color: ${text}; border: ${border}; min-height: 21px; box-sizing: border-box; ${playerHl?.shadow ? `box-shadow: ${playerHl.shadow};` : ''}">
                    <div style="display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden;">
                      <span style="display: inline-block; font-size: 8.5px; font-weight: 900; padding: 1px 3.5px; border-radius: 2px; background: ${tagBg}; color: ${tagColor}; shrink: 0;">ST</span>
                      <span style="font-family: monospace; font-size: 10px; font-weight: 900; color: ${text}; shrink: 0;">#${p.num}</span>
                      <span style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; color: ${text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
                    </div>
                  </div>
                `;
              } else if (pIdx === 1) {
                // 2nd String: Athletic Gold
                const bg = playerHl ? playerHl.bg : '#facc15';
                const text = playerHl ? playerHl.text : '#000000';
                const border = playerHl ? `2px solid ${playerHl.border}` : '1.5px solid #ca8a04';

                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 2.5px 5px; margin-bottom: 2.5px; border-radius: 3px; background: ${bg}; color: ${text}; border: ${border}; min-height: 21px; box-sizing: border-box; ${playerHl?.shadow ? `box-shadow: ${playerHl.shadow};` : ''}">
                    <div style="display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden;">
                      <span style="display: inline-block; font-size: 8.5px; font-weight: 900; padding: 1px 3.5px; border-radius: 2px; background: #000000; color: #facc15; shrink: 0;">D2</span>
                      <span style="font-family: monospace; font-size: 10px; font-weight: 900; color: ${text}; shrink: 0;">#${p.num}</span>
                      <span style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; color: ${text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
                    </div>
                  </div>
                `;
              } else if (pIdx === 2) {
                // 3rd String: Royal Blue (Ultra Crisp, 100% Guaranteed High Contrast)
                const bg = playerHl ? playerHl.bg : '#1d4ed8';
                const text = playerHl ? playerHl.text : '#ffffff';
                const border = playerHl ? `2px solid ${playerHl.border}` : '1.5px solid #1e40af';
                const tagBg = playerHl ? '#1d4ed8' : '#ffffff';
                const tagColor = playerHl ? '#ffffff' : '#1d4ed8';

                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 2.5px 5px; margin-bottom: 2.5px; border-radius: 3px; background: ${bg}; color: ${text}; border: ${border}; min-height: 21px; box-sizing: border-box; ${playerHl?.shadow ? `box-shadow: ${playerHl.shadow};` : ''}">
                    <div style="display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden;">
                      <span style="display: inline-block; font-size: 8.5px; font-weight: 900; padding: 1px 3.5px; border-radius: 2px; background: ${tagBg}; color: ${tagColor}; shrink: 0; border: 1px solid #ffffff;">D3</span>
                      <span style="font-family: monospace; font-size: 10px; font-weight: 900; color: ${text}; shrink: 0;">#${p.num}</span>
                      <span style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; color: ${text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
                    </div>
                  </div>
                `;
              } else {
                // 4th String / Backups: Pure White with Dark Text
                const bg = playerHl ? playerHl.bg : '#ffffff';
                const text = playerHl ? playerHl.text : '#0f172a';
                const border = playerHl ? `2px solid ${playerHl.border}` : '1.5px solid #94a3b8';

                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 4px; margin-bottom: 2px; border-radius: 3px; background: ${bg}; color: ${text}; border: ${border}; min-height: 20px; box-sizing: border-box;">
                    <div style="display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden;">
                      <span style="display: inline-block; font-size: 8px; font-weight: 800; padding: 1px 3px; border-radius: 2px; background: #e2e8f0; color: #0f172a; border: 1px solid #cbd5e1; shrink: 0;">D${pIdx + 1}</span>
                      <span style="font-family: monospace; font-size: 9.5px; font-weight: 800; color: ${text}; shrink: 0;">#${p.num}</span>
                      <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: ${text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
                    </div>
                  </div>
                `;
              }
            }).join('')
          : `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 38px; border: 1.5px dashed #cbd5e1; border-radius: 3px; background: #f8fafc; color: #94a3b8; font-size: 9.5px; font-weight: 800;">
              OPEN
            </div>
          `;

        const cardBorder = slotHighlight ? `2.5px solid ${slotHighlight.border}` : '2px solid #000000';
        const cardBg = slotHighlight ? slotHighlight.bg : '#ffffff';

        return `
          <div style="border: ${cardBorder}; background: ${cardBg}; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; min-height: 60px; box-sizing: border-box; ${slotHighlight?.shadow ? `box-shadow: ${slotHighlight.shadow};` : ''}">
            <div style="background: #ffffff; color: #000000; font-size: 11px; font-weight: 900; padding: 2.5px 4px; border-bottom: 2px solid #000000; text-align: center; text-transform: uppercase; letter-spacing: 0.04em;">
              ${slot.name}
            </div>
            <div style="padding: 3.5px; flex: 1; display: flex; flex-direction: column;">
              ${playersHtml}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 8px;">
          ${row.label ? `
            <div style="background: #f1f5f9; border: 1.5px solid #94a3b8; border-left: 6px solid #0f172a; color: #0f172a; font-size: 10px; font-weight: 900; padding: 2px 6px; margin-bottom: 4px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.03em;">
              ${row.label}
            </div>
          ` : ''}
          <div style="display: grid; grid-template-columns: repeat(${row.positions.length}, minmax(0, 1fr)); gap: 6px; align-items: stretch;">
            ${slotCols}
          </div>
        </div>
      `;
    }).join('');

    const pageBreakStyle = layout === '1_per_page'
      ? 'page-break-after: always; break-after: page;'
      : 'break-inside: avoid; page-break-inside: avoid; margin-bottom: 22px;';

    return `
      <div class="formation-print-page" style="${pageBreakStyle} box-sizing: border-box;">
        <!-- Header Banner -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #000000; padding-bottom: 6px; margin-bottom: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h1 style="margin: 0; font-size: 19pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; color: #000000; line-height: 1.1;">
                ${form.name}
              </h1>
              <span style="display: inline-block; font-size: 10.5px; font-weight: 900; padding: 2px 8px; border-radius: 3px; background: ${inkFriendly ? '#000000' : unitBadgeBg}; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em;">
                ${unitLabel}
              </span>
            </div>
            <div style="font-size: 10pt; font-weight: 700; color: #475569; margin-top: 2px;">
              ${teamName.toUpperCase()} &bull; ${seasonLabel.toUpperCase()}${form.subtitle ? ` &bull; ${form.subtitle}` : ''}
            </div>
          </div>

          <!-- Color Legend -->
          <div style="display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 900; text-transform: uppercase;">
            <div style="display: flex; align-items: center; gap: 3.5px;">
              <span style="display: inline-block; width: 14px; height: 14px; background: #09090b; border: 1px solid #000; border-radius: 2px;"></span>
              <span>1st (Starters)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 3.5px;">
              <span style="display: inline-block; width: 14px; height: 14px; background: #facc15; border: 1px solid #ca8a04; border-radius: 2px;"></span>
              <span>2nd (Gold)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 3.5px;">
              <span style="display: inline-block; width: 14px; height: 14px; background: #1d4ed8; border: 1px solid #1e40af; border-radius: 2px;"></span>
              <span>3rd (Blue)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 3.5px;">
              <span style="display: inline-block; width: 14px; height: 14px; background: #ffffff; border: 1px solid #94a3b8; border-radius: 2px;"></span>
              <span>4th+ (Backups)</span>
            </div>
          </div>
        </div>

        <!-- Field Rows -->
        <div style="min-height: 250px;">
          ${rowsHtml}
        </div>

        <!-- Formation Sheet Footer -->
        <div style="margin-top: 12px; padding-top: 5px; border-top: 1.5px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 800; color: #64748b;">
          <span>${form.name} Tactical Depth Chart &bull; Formation ${formIdx + 1} of ${targetFormations.length}</span>
          <span>Printed on ${new Date().toLocaleDateString()} &bull; Football Tactical Manager</span>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${teamName}_FORMATION_DEPTH_CHARTS</title>
  <style>
    @page {
      size: letter ${orientation};
      margin: 0.25in;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    .formation-print-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  ${formationsHtml}
</body>
</html>`;
}

/**
 * Direct print trigger for Tactical Field Formation Depth Chart using clean HTML engine.
 */
export function printFormationDepthChart(
  formations: FormationBoard[],
  depthChart: Record<string, PlacedPlayer[]>,
  options?: FormationDepthChartPrintOptions
) {
  const html = generateFormationDepthChartPrintHTML(formations, depthChart, options);
  const title = `${options?.teamName || 'Football'}_Formation_Depth_Charts`;
  printCleanHTML(html, title);
}


