import { CallSheetFullData } from '../types/callSheet';
import {
  SingleWristband,
  WristbandData,
  ScoutingData,
  PracticePlan,
  ScheduleEvent,
  StaffCoach,
} from '../types';
import {
  generateCallSheetPrintHTML,
  generateWristbandPrintHTML,
  generatePracticePlanHTML,
} from './printUtils';

export interface GameDayPackageSectionsSelection {
  sidelineHud: boolean;
  preGamePlan: boolean;
  offenseCallSheet: boolean;
  defenseCallSheet: boolean;
  wristbands: boolean;
  scouting: boolean;
  tendencies: boolean;
}

export interface GameDayPackageSubSelections {
  sidelineHudItems?: {
    matchupInfo?: boolean;
    keysToVictory?: boolean;
    objectives?: boolean;
    inGameManagement?: boolean;
  };
  preGamePeriodIndices?: number[];
  offenseSectionIds?: string[];
  includeOffenseScripts?: boolean;
  defenseSectionIds?: string[];
  includeDefenseScripts?: boolean;
  wristbandIds?: string[];
  scoutingItems?: {
    schemeOverview?: boolean;
    keyPlayers?: boolean;
  };
  tendencyKeys?: string[];
}

export interface GameDayPackagePrintOptions {
  includeCoverPage: boolean;
  pageBreaksBetweenSections: boolean;
  inkFriendly: boolean;
  orientation: 'auto' | 'landscape' | 'portrait';
  sections: GameDayPackageSectionsSelection;
  subSelections?: GameDayPackageSubSelections;
}

export interface GameDayPackageData {
  activeTeamName: string;
  opponent?: string;
  currentWeek: string | number;
  gameDate?: string;
  callSheetData?: CallSheetFullData;
  wristbandData?: WristbandData;
  scouting?: ScoutingData;
  linkedPreGamePlan?: PracticePlan | null;
  matchedScheduledGame?: ScheduleEvent | null;
  staffList?: StaffCoach[] | { name?: string; role?: string; email?: string }[];
}

/**
 * Generates clean, self-contained HTML for the Game Day Package
 * with user-selected sections and proper page breaks.
 */
export function generateGameDayPackageHTML(
  data: GameDayPackageData,
  options: GameDayPackagePrintOptions
): string {
  const {
    activeTeamName = 'Mahopac 10U',
    opponent = 'Opponent',
    currentWeek = '1',
    gameDate = '',
    callSheetData,
    wristbandData,
    scouting,
    linkedPreGamePlan,
    matchedScheduledGame,
    staffList = [],
  } = data;

  const {
    includeCoverPage = true,
    pageBreaksBetweenSections = true,
    inkFriendly = false,
    orientation = 'auto',
    sections,
    subSelections,
  } = options;

  const pageBreakClass = pageBreaksBetweenSections ? 'page-break-after' : 'section-spacing';

  // Base CSS styles
  const styles = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');

      @page {
        size: ${orientation === 'portrait' ? 'portrait' : orientation === 'landscape' ? 'landscape' : 'auto'};
        margin: 10mm 10mm 12mm 10mm;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      html, body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        background-color: ${inkFriendly ? '#ffffff' : '#090d16'} !important;
        color: ${inkFriendly ? '#0f172a' : '#f8fafc'} !important;
        margin: 0;
        padding: 0;
        line-height: 1.4;
        font-size: 11px;
      }

      @media print {
        html, body {
          background-color: ${inkFriendly ? '#ffffff' : '#090d16'} !important;
          color: ${inkFriendly ? '#0f172a' : '#f8fafc'} !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .cover-container {
          background-color: ${inkFriendly ? '#ffffff' : '#090d16'} !important;
          color: ${inkFriendly ? '#0f172a' : '#f8fafc'} !important;
        }
        .cover-matchup {
          background-color: ${inkFriendly ? '#f8fafc' : '#0f172a'} !important;
          border-color: ${inkFriendly ? '#cbd5e1' : '#334155'} !important;
        }
        .cover-toc {
          background-color: ${inkFriendly ? '#f1f5f9' : '#0f172a'} !important;
          border-color: ${inkFriendly ? '#cbd5e1' : '#334155'} !important;
        }
        .section-header {
          background-color: #0f172a !important;
          color: #ffffff !important;
        }
        .card-box {
          background-color: ${inkFriendly ? '#ffffff' : '#0f172a'} !important;
          color: ${inkFriendly ? '#0f172a' : '#e2e8f0'} !important;
          border-color: ${inkFriendly ? '#cbd5e1' : '#334155'} !important;
        }
        table {
          background-color: ${inkFriendly ? '#ffffff' : '#0f172a'} !important;
        }
        th {
          background-color: ${inkFriendly ? '#f1f5f9' : '#1e293b'} !important;
          color: ${inkFriendly ? '#1e293b' : '#f8fafc'} !important;
          border-color: ${inkFriendly ? '#cbd5e1' : '#334155'} !important;
        }
        td {
          background-color: ${inkFriendly ? '#ffffff' : '#0f172a'} !important;
          color: ${inkFriendly ? '#0f172a' : '#e2e8f0'} !important;
          border-color: ${inkFriendly ? '#cbd5e1' : '#334155'} !important;
        }
        tr:nth-child(even) td {
          background-color: ${inkFriendly ? '#f8fafc' : '#131c31'} !important;
        }
      }

      .page-break-after {
        page-break-after: always;
        break-after: page;
      }

      .page-break-before {
        page-break-before: always;
        break-before: page;
      }

      .no-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .section-spacing {
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: 2px dashed ${inkFriendly ? '#cbd5e1' : '#334155'};
      }

      .cover-container {
        min-height: 90vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 40px 20px;
        text-align: center;
        background: ${inkFriendly ? '#ffffff' : '#090d16'};
      }

      .cover-header {
        border-bottom: 4px solid ${inkFriendly ? '#0f172a' : '#2563eb'};
        padding-bottom: 24px;
        margin-bottom: 32px;
      }

      .cover-team-name {
        font-size: 34px;
        font-weight: 900;
        letter-spacing: -0.5px;
        color: ${inkFriendly ? '#0f172a' : '#f8fafc'};
        margin: 0 0 8px 0;
        text-transform: uppercase;
      }

      .cover-badge {
        display: inline-block;
        background: ${inkFriendly ? '#0f172a' : '#1e293b'};
        color: ${inkFriendly ? '#ffffff' : '#38bdf8'};
        border: ${inkFriendly ? 'none' : '1px solid #0284c7'};
        font-size: 13px;
        font-weight: 800;
        padding: 6px 16px;
        border-radius: 9999px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }

      .cover-matchup {
        margin: 36px 0;
        padding: 24px;
        background: ${inkFriendly ? '#f8fafc' : '#0f172a'};
        border: 2px solid ${inkFriendly ? '#e2e8f0' : '#334155'};
        border-radius: 16px;
      }

      .cover-matchup-title {
        font-size: 28px;
        font-weight: 900;
        color: ${inkFriendly ? '#1e293b' : '#f8fafc'};
        margin: 0 0 8px 0;
      }

      .cover-details {
        font-size: 13px;
        font-weight: 600;
        color: ${inkFriendly ? '#64748b' : '#94a3b8'};
      }

      .cover-toc {
        max-width: 500px;
        margin: 0 auto;
        text-align: left;
        background: ${inkFriendly ? '#f1f5f9' : '#0f172a'};
        border: 1px solid ${inkFriendly ? '#cbd5e1' : '#334155'};
        border-radius: 12px;
        padding: 16px 20px;
      }

      .cover-toc h3 {
        margin: 0 0 10px 0;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: ${inkFriendly ? '#334155' : '#38bdf8'};
      }

      .cover-toc ul {
        margin: 0;
        padding-left: 18px;
        color: ${inkFriendly ? '#1e293b' : '#e2e8f0'};
        font-size: 11px;
        font-weight: 600;
      }

      .cover-toc li {
        margin-bottom: 5px;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: ${inkFriendly ? '#0f172a' : '#0f172a'};
        color: #ffffff;
        border: ${inkFriendly ? 'none' : '1px solid #334155'};
        padding: 8px 14px;
        border-radius: 6px;
        margin-bottom: 12px;
      }

      .section-title {
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        color: #ffffff;
      }

      .section-meta {
        font-size: 10px;
        font-weight: 700;
        color: #94a3b8;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
      }

      th {
        background: ${inkFriendly ? '#f1f5f9' : '#1e293b'};
        color: ${inkFriendly ? '#1e293b' : '#f8fafc'};
        font-weight: 800;
        text-transform: uppercase;
        font-size: 9px;
        letter-spacing: 0.5px;
        padding: 6px 8px;
        border: 1px solid ${inkFriendly ? '#cbd5e1' : '#334155'};
        text-align: left;
      }

      td {
        padding: 6px 8px;
        border: 1px solid ${inkFriendly ? '#cbd5e1' : '#334155'};
        vertical-align: top;
        background: ${inkFriendly ? '#ffffff' : '#0f172a'};
        color: ${inkFriendly ? '#0f172a' : '#e2e8f0'};
      }

      tr:nth-child(even) td {
        background-color: ${inkFriendly ? '#f8fafc' : '#131c31'};
      }

      .hud-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 12px;
      }

      .card-box {
        border: 1px solid ${inkFriendly ? '#cbd5e1' : '#334155'};
        border-radius: 8px;
        padding: 10px 12px;
        background: ${inkFriendly ? '#ffffff' : '#0f172a'};
        color: ${inkFriendly ? '#0f172a' : '#e2e8f0'};
      }

      .card-title {
        font-size: 11px;
        font-weight: 800;
        color: ${inkFriendly ? '#0f172a' : '#f8fafc'};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 6px 0;
        border-bottom: 1px solid ${inkFriendly ? '#e2e8f0' : '#1e293b'};
        padding-bottom: 4px;
      }

      .category-heading {
        font-size: 12px;
        font-weight: 800;
        color: ${inkFriendly ? '#0f172a' : '#38bdf8'};
        text-transform: uppercase;
        margin: 0 0 6px 0;
        border-bottom: 2px solid ${inkFriendly ? '#0f172a' : '#38bdf8'};
        padding-bottom: 3px;
      }

      .subtab-heading {
        margin: 0 0 6px 0;
        font-size: 11px;
        font-weight: 800;
        color: ${inkFriendly ? '#1e293b' : '#f8fafc'};
      }

      .key-item {
        display: flex;
        gap: 6px;
        align-items: baseline;
        margin-bottom: 4px;
        font-size: 10px;
        color: ${inkFriendly ? '#0f172a' : '#e2e8f0'};
      }

      .key-num {
        background: ${inkFriendly ? '#0f172a' : '#3b82f6'};
        color: white;
        border-radius: 9999px;
        font-size: 9px;
        font-weight: 800;
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .badge-tag {
        display: inline-block;
        padding: 2px 6px;
        font-size: 8.5px;
        font-weight: 700;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .badge-run { background: ${inkFriendly ? '#dcfce7' : 'rgba(22, 163, 74, 0.25)'}; color: ${inkFriendly ? '#15803d' : '#4ade80'}; border: 1px solid ${inkFriendly ? '#bbf7d0' : '#16a34a'}; }
      .badge-pass { background: ${inkFriendly ? '#dbeafe' : 'rgba(37, 99, 235, 0.25)'}; color: ${inkFriendly ? '#1d4ed8' : '#60a5fa'}; border: 1px solid ${inkFriendly ? '#bfdbfe' : '#2563eb'}; }
      .badge-blitz { background: ${inkFriendly ? '#fee2e2' : 'rgba(220, 38, 38, 0.25)'}; color: ${inkFriendly ? '#b91c1c' : '#f87171'}; border: 1px solid ${inkFriendly ? '#fecaca' : '#dc2626'}; }

      .tendency-report-content {
        padding: 10px;
        border: 1px solid ${inkFriendly ? '#cbd5e1' : '#334155'};
        border-radius: 6px;
        background: ${inkFriendly ? '#ffffff' : '#0f172a'};
        color: ${inkFriendly ? '#0f172a' : '#e2e8f0'};
        font-size: 10px;
      }
    </style>
  `;

  const parts: string[] = [];
  parts.push('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Game Day Package</title>');
  parts.push(styles);
  parts.push('</head><body>');

  // Included sections list for Table of Contents
  const tocItems: string[] = [];
  if (sections.sidelineHud) tocItems.push('1. Matchup Overview & Sideline HUD');
  if (sections.preGamePlan) tocItems.push('2. Pre-Game Practice & Warmup Schedule');
  if (sections.offenseCallSheet) tocItems.push('3. Offensive Situational Call Sheet');
  if (sections.defenseCallSheet) tocItems.push('4. Defensive Situational Call Sheet');
  if (sections.wristbands) tocItems.push('5. Player Wristband Inserts & Play Cards');
  if (sections.scouting) tocItems.push('6. Opponent Scouting Report & Personnel');
  if (sections.tendencies) tocItems.push('7. Opponent Tendencies & Reports');

  // 1. COVER PAGE
  if (includeCoverPage) {
    parts.push(`
      <div class="cover-container page-break-after">
        <div class="cover-header">
          <h1 class="cover-team-name">${activeTeamName}</h1>
          <div class="cover-badge">Official Game Day Package</div>
        </div>

        <div class="cover-matchup">
          <div class="cover-matchup-title">Week ${currentWeek} vs. ${opponent}</div>
          <div class="cover-details">
            ${gameDate ? `Date: ${gameDate} &bull; ` : ''}
            ${matchedScheduledGame?.startTime ? `Kickoff: ${matchedScheduledGame.startTime} &bull; ` : ''}
            Location: ${matchedScheduledGame?.location || 'Crane Road'}
          </div>
        </div>

        <div class="cover-toc">
          <h3>Included Package Sections</h3>
          <ul>
            ${tocItems.map((item) => `<li>${item}</li>`).join('')}
          </ul>
        </div>

        <div style="margin-top: 30px; font-size: 10px; color: #64748b; font-weight: 600;">
          Prepared for Coaches & Sideline Staff &bull; ${new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>
    `);
  }

  // 2. SIDELINE HUD & MATCHUP OVERVIEW
  if (sections.sidelineHud) {
    const hudFilter = subSelections?.sidelineHudItems || {
      matchupInfo: true,
      keysToVictory: true,
      objectives: true,
      inGameManagement: true,
    };

    const keys = scouting?.keysToVictory || [
      'Dominate line of scrimmage & establish the run early',
      'Secure ball possession - Zero turnovers',
      'Discipline on defense - Stay in run fits & communicate coverage',
      'Win 3rd down conversions & finish in red zone',
    ];

    const hasTopGrid = hudFilter.matchupInfo !== false || hudFilter.keysToVictory !== false;
    const hasBottomGrid = hudFilter.objectives !== false || hudFilter.inGameManagement !== false;

    parts.push(`
      <div class="${pageBreakClass}">
        <div class="section-header">
          <h2 class="section-title">⚡ Matchup Overview & Sideline HUD</h2>
          <span class="section-meta">${activeTeamName} vs ${opponent} &bull; Week ${currentWeek}</span>
        </div>

        ${hasTopGrid ? `
        <div class="hud-grid no-break">
          ${hudFilter.matchupInfo !== false ? `
          <div class="card-box">
            <h4 class="card-title">Game Information & Venue</h4>
            <table style="margin: 0;">
              <tr><th style="width: 35%;">Opponent</th><td><strong>${opponent}</strong></td></tr>
              <tr><th>Week / Season</th><td>Week ${currentWeek}</td></tr>
              <tr><th>Game Date</th><td>${gameDate || matchedScheduledGame?.date || 'TBD'}</td></tr>
              <tr><th>Kickoff Time</th><td>${matchedScheduledGame?.startTime || '10:00 AM'}</td></tr>
              <tr><th>Location</th><td>${matchedScheduledGame?.location || 'Home Field'} (${matchedScheduledGame?.locationType || 'Home'})</td></tr>
            </table>
          </div>
          ` : ''}

          ${hudFilter.keysToVictory !== false ? `
          <div class="card-box">
            <h4 class="card-title">Keys to Victory</h4>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${keys
                .slice(0, 5)
                .map(
                  (k, idx) => `
                <div class="key-item">
                  <span class="key-num">${idx + 1}</span>
                  <span style="font-weight: 600;">${k}</span>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
          ` : ''}
        </div>
        ` : ''}

        ${hasBottomGrid ? `
        <div class="hud-grid no-break">
          ${hudFilter.objectives !== false ? `
          <div class="card-box">
            <h4 class="card-title">Gameplan Objectives</h4>
            <p style="margin: 0 0 6px 0; font-size: 10px;">
              <strong>Offense:</strong> ${scouting?.gameplanOffense || 'Control tempo, mix power runs with quick play action. Target high-percentage throws.'}
            </p>
            <p style="margin: 0; font-size: 10px;">
              <strong>Defense:</strong> ${scouting?.gameplanDefense || 'Set hard edge against outside runs. Gang tackle ball carriers. Read quarterback eyes.'}
            </p>
          </div>
          ` : ''}

          ${hudFilter.inGameManagement !== false ? `
          <div class="card-box">
            <h4 class="card-title">Sideline In-Game Management</h4>
            <table style="margin: 0;">
              <tr><th>2-Point Chart</th><td>Trailing by 2, 5, 9, 12 &bull; Go for 2 | Leading by 1, 4, 7 &bull; Go for 1</td></tr>
              <tr><th>Timeouts</th><td>1st Half: [ 1 ] [ 2 ] [ 3 ] &bull; 2nd Half: [ 1 ] [ 2 ] [ 3 ]</td></tr>
              <tr><th>Special Teams</th><td>${scouting?.specialTeamsNotes || 'All 11 on kickoff team hustle to ball. No return middle.'}</td></tr>
            </table>
          </div>
          ` : ''}
        </div>
        ` : ''}
      </div>
    `);
  }

  // 3. PRE-GAME PRACTICE / WARMUP PLAN
  if (sections.preGamePlan) {
    const allPeriods = linkedPreGamePlan?.plan || [];
    const periodIndices = subSelections?.preGamePeriodIndices;
    const periods = periodIndices !== undefined
      ? allPeriods.filter((_, idx) => periodIndices.includes(idx))
      : allPeriods;
    const planTitle = linkedPreGamePlan?.title || 'Pre-Game Warmup & Routine';

    parts.push(`
      <div class="${pageBreakClass}">
        <div class="section-header">
          <h2 class="section-title">📋 Pre-Game Practice & Warmup Plan</h2>
          <span class="section-meta">${planTitle} &bull; ${periods.length} of ${allPeriods.length} Periods</span>
        </div>

        ${
          periods.length === 0
            ? `<div class="card-box" style="text-align: center; color: #64748b; padding: 24px;">No pre-game warmup periods selected.</div>`
            : `
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 12%;">Time / Min</th>
                <th style="width: 22%;">Period / Drill</th>
                <th style="width: 18%;">Coaches / Group</th>
                <th style="width: 15%;">Equipment</th>
                <th>Notes / Objectives</th>
              </tr>
            </thead>
            <tbody>
              ${periods
                .map((p, idx) => {
                  const coachesStr = p.stations && p.stations.length > 0
                    ? p.stations.map((s) => s.coach).filter(Boolean).join(', ')
                    : 'All Coaches';
                  const drillNotes = p.stations && p.stations.length > 0
                    ? p.stations.map((s) => `${s.name}: ${s.desc}`).join(' | ')
                    : p.category || '';
                  return `
                  <tr>
                    <td style="font-weight: 800; text-align: center;">${idx + 1}</td>
                    <td><strong>${p.time || p.duration || p.durationMinutes || 10}m</strong> (${p.duration || p.time || 10} min)</td>
                    <td><strong>${p.name || p.title || p.category || 'Warmup Drill'}</strong></td>
                    <td>${coachesStr || 'All Coaches'}</td>
                    <td>Helmets, Balls</td>
                    <td>${drillNotes}</td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        `
        }
      </div>
    `);
  }

  // 4. OFFENSIVE CALL SHEET
  if (sections.offenseCallSheet && callSheetData) {
    let customOffData: CallSheetFullData = callSheetData;
    if (subSelections?.offenseSectionIds) {
      const offIds = subSelections.offenseSectionIds;
      const filteredSections = (callSheetData.offenseSections || []).filter(
        (sec) => offIds.includes(sec.id) || offIds.includes(sec.title)
      );
      customOffData = {
        ...callSheetData,
        offenseSections: filteredSections,
        offenseScript: subSelections.includeOffenseScripts === false ? [] : callSheetData.offenseScript,
      };
    }

    const offHtml = generateCallSheetPrintHTML(
      customOffData,
      'offense',
      activeTeamName,
      `${activeTeamName} • Offensive Call Sheet`,
      {
        orientation: 'landscape',
        density: 'compact',
        inkFriendly,
        hideEmptySlots: true,
        snippetOnly: true,
      }
    );

    parts.push(`
      <div class="${pageBreakClass}">
        <div class="section-header">
          <h2 class="section-title">🏈 Offensive Situational Call Sheet</h2>
          <span class="section-meta">${activeTeamName} &bull; Week ${currentWeek} vs ${opponent}</span>
        </div>
        ${offHtml}
      </div>
    `);
  }

  // 5. DEFENSIVE CALL SHEET
  if (sections.defenseCallSheet && callSheetData) {
    let customDefData: CallSheetFullData = callSheetData;
    if (subSelections?.defenseSectionIds) {
      const defIds = subSelections.defenseSectionIds;
      const filteredSections = (callSheetData.defenseSections || []).filter(
        (sec) => defIds.includes(sec.id) || defIds.includes(sec.title)
      );
      customDefData = {
        ...callSheetData,
        defenseSections: filteredSections,
        defenseScript: subSelections.includeDefenseScripts === false ? [] : callSheetData.defenseScript,
      };
    }

    const defHtml = generateCallSheetPrintHTML(
      customDefData,
      'defense',
      activeTeamName,
      `${activeTeamName} • Defensive Call Sheet`,
      {
        orientation: 'landscape',
        density: 'compact',
        inkFriendly,
        hideEmptySlots: true,
        snippetOnly: true,
      }
    );

    parts.push(`
      <div class="${pageBreakClass}">
        <div class="section-header">
          <h2 class="section-title">🛡️ Defensive Situational Call Sheet</h2>
          <span class="section-meta">${activeTeamName} &bull; Week ${currentWeek} vs ${opponent}</span>
        </div>
        ${defHtml}
      </div>
    `);
  }

  // 6. PLAYER WRISTBAND INSERTS
  if (sections.wristbands && wristbandData?.wristbands && wristbandData.wristbands.length > 0) {
    let activeWbs = wristbandData.wristbands.filter((wb) =>
      wb.columns?.some((c) => c.plays && c.plays.length > 0)
    );

    if (subSelections?.wristbandIds && subSelections.wristbandIds.length > 0) {
      activeWbs = activeWbs.filter((wb, idx) =>
        subSelections.wristbandIds!.includes(wb.id || '') ||
        subSelections.wristbandIds!.includes((wb as any).name || wb.title || '') ||
        subSelections.wristbandIds!.includes(String(idx))
      );
    }

    const wbHtml = generateWristbandPrintHTML(
      activeWbs,
      activeTeamName,
      `${activeTeamName} Wristband Inserts`,
      {
        inkFriendly,
        layout: 'grid_2up',
        snippetOnly: true,
      }
    );

    parts.push(`
      <div class="${pageBreakClass}">
        <div class="section-header">
          <h2 class="section-title">⌚ Player Wristband Inserts</h2>
          <span class="section-meta">${activeWbs.length} Active Wristband Cards</span>
        </div>
        ${wbHtml}
      </div>
    `);
  }

  // 7. OPPONENT SCOUTING REPORT & PERSONNEL
  if (sections.scouting) {
    const scoutingFilter = subSelections?.scoutingItems || {
      schemeOverview: true,
      keyPlayers: true,
    };
    const keyPlayers = scoutingFilter.keyPlayers !== false ? (scouting?.keyPlayersList || []) : [];

    parts.push(`
      <div class="${pageBreakClass}">
        <div class="section-header">
          <h2 class="section-title">📊 Opponent Scouting Report & Personnel</h2>
          <span class="section-meta">${opponent} &bull; Scouting Dossier</span>
        </div>

        ${scoutingFilter.schemeOverview !== false ? `
        <div class="hud-grid no-break" style="margin-bottom: 12px;">
          <div class="card-box">
            <h4 class="card-title">Offensive Tendencies & Scheme</h4>
            <p style="margin: 0 0 6px 0; font-size: 10px;">
              <strong>Base Formations:</strong> ${scouting?.offenseFormations || 'Spread 2x2, Trips Right, I-Formation'}
            </p>
            <p style="margin: 0 0 6px 0; font-size: 10px;">
              <strong>Run / Pass Ratio:</strong> ${scouting?.runPassRatio || '65% Run / 35% Pass'}
            </p>
            <p style="margin: 0; font-size: 10px;">
              <strong>Tendency Notes:</strong> ${scouting?.offensiveTendencies || scouting?.offenseTendencies || 'Prefers sweeps to field side. Uses play-action on 2nd & short.'}
            </p>
          </div>

          <div class="card-box">
            <h4 class="card-title">Defensive Scheme & Fronts</h4>
            <p style="margin: 0 0 6px 0; font-size: 10px;">
              <strong>Base Front:</strong> ${scouting?.defenseFront || '4-3 Over / 5-2 Goal Line'}
            </p>
            <p style="margin: 0 0 6px 0; font-size: 10px;">
              <strong>Primary Coverage:</strong> ${scouting?.defenseCoverage || 'Cover 3 Sky / Man Under on 3rd & long'}
            </p>
            <p style="margin: 0; font-size: 10px;">
              <strong>Blitz Tendencies:</strong> ${scouting?.defenseTendencies || 'Brings weak-side linebacker on passing downs. Vulnerable to quick slant and screen game.'}
            </p>
          </div>
        </div>
        ` : ''}

        ${
          keyPlayers.length > 0
            ? `
          <div class="no-break" style="margin-top: 10px;">
            <h4 class="card-title" style="margin-bottom: 6px;">Key Players to Watch</h4>
            <table>
              <thead>
                <tr>
                  <th style="width: 8%; text-align: center;">#</th>
                  <th style="width: 22%;">Player Name</th>
                  <th style="width: 15%;">Position</th>
                  <th style="width: 15%;">Threat Level</th>
                  <th>Scouting Notes / Tendencies</th>
                </tr>
              </thead>
              <tbody>
                ${keyPlayers
                  .map(
                    (p) => `
                  <tr>
                    <td style="font-weight: 800; text-align: center;">#${p.num || p.jersey || ''}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.position || p.pos || 'Athlete'}</td>
                    <td>
                      <span class="badge-tag ${
                        p.threatLevel === 'High' || (p as any).threat === 'High' || (p as any).threat === 'high'
                          ? 'badge-blitz'
                          : 'badge-pass'
                      }">
                        ${p.threatLevel || 'Key Player'}
                      </span>
                    </td>
                    <td>${p.notes || ''}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
            : ''
        }
      </div>
    `);
  }

  // 8. OPPONENT TENDENCIES & REPORTS
  if (sections.tendencies && scouting?.tendenciesTree) {
    const tree = scouting.tendenciesTree;
    let categories = Object.keys(tree);

    // If subSelections.tendencyKeys specified, filter categories and subtabs
    const selectedTendencyKeys = subSelections?.tendencyKeys;
    let filteredTree: Record<string, Record<string, string>> = tree;

    if (selectedTendencyKeys !== undefined) {
      filteredTree = {};
      for (const cat of categories) {
        for (const sub of Object.keys(tree[cat] || {})) {
          const key = `${cat}__${sub}`;
          if (selectedTendencyKeys.includes(key)) {
            if (!filteredTree[cat]) filteredTree[cat] = {};
            filteredTree[cat][sub] = tree[cat][sub];
          }
        }
      }
      categories = Object.keys(filteredTree);
    }

    parts.push(`
      <div class="${pageBreakClass}">
        <div class="section-header">
          <h2 class="section-title">📈 Opponent Tendencies & Reports</h2>
          <span class="section-meta">${opponent} &bull; Detailed Breakdown</span>
        </div>

        ${
          categories.length === 0
            ? `<div class="card-box" style="text-align: center; color: #64748b; padding: 24px;">No tendency documents selected.</div>`
            : categories
                .map((cat) => {
                  const subTabs = Object.keys(filteredTree[cat] || {});
                  if (subTabs.length === 0) return '';
                  return `
                <div class="no-break" style="margin-bottom: 16px;">
                  <h3 class="category-heading">
                    ${cat}
                  </h3>
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${subTabs
                      .map((sub) => {
                        const content = filteredTree[cat]?.[sub] || '';
                        if (!content) {
                          return `
                          <div class="card-box">
                            <strong>${sub}</strong>: <span style="color: #64748b;">No text report attached</span>
                          </div>
                        `;
                        }

                        if (content.startsWith('data:image')) {
                          return `
                          <div class="card-box no-break">
                            <strong>${sub}</strong>
                            <div style="margin-top: 6px; text-align: center;">
                              <img src="${content}" style="max-width: 100%; max-height: 450px; border-radius: 4px;" alt="${sub}" />
                            </div>
                          </div>
                        `;
                        }

                        return `
                        <div class="card-box no-break">
                          <h4 class="subtab-heading">${sub}</h4>
                          <div class="tendency-report-content">
                            ${content}
                          </div>
                        </div>
                      `;
                      })
                      .join('')}
                  </div>
                </div>
              `;
                })
                .join('')
        }
      </div>
    `);
  }

  parts.push('</body></html>');
  return parts.join('\n');
}
