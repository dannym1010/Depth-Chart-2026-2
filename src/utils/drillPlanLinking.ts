import { WhiteboardDrill } from '../components/whiteboard/whiteboardDrillData';
import { PracticePlan, PracticePeriod, PracticeStation, FormationBoard, PlacedPlayer } from '../types';
import {
  generatePracticePlanHTML,
  generatePocketDepthChartPrintHTML,
  printCleanHTML,
  openCleanPrintTab,
} from './printUtils';
import { extractDrillCardMarkup, extractDrillPrintStyles } from '../components/whiteboard/drillPrintHelper';

export interface PlanDrillItem {
  key: string;
  periodIndex: number;
  periodNumber: number;
  periodName: string;
  stationIndex: number;
  stationName: string;
  stationDesc: string;
  stationCoach: string;
  stationFocus: string;
  category: string;
  isMatched: boolean;
  whiteboardDrill: WhiteboardDrill | null;
  effectiveDrill: WhiteboardDrill;
  selectedPhaseIndex: number;
}

export interface PracticePlanPrintPackageOptions {
  plan: PracticePlan | null;
  periods: PracticePeriod[];
  seqInfo?: { practiceNumber?: number; isCancelled?: boolean } | null;
  fontSize?: number;
  includePlanTable?: boolean;
  selectedDrills?: { drill: WhiteboardDrill; phaseIndex?: number }[];
  includeFormations?: boolean;
  formations?: FormationBoard[];
  depthChart?: Record<string, PlacedPlayer[]>;
  activeTeamName?: string;
  documentTitle?: string;
}

/**
 * Normalizes text for fuzzy matching drill names and station titles
 */
function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .replace(/[&/\\#,+()$~%.'":*?<>{}_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans common station prefixes, position headers, parentheticals, and suffixes
 */
function cleanStationName(str: string): string {
  let res = str.trim();
  // Remove category / unit / group prefix like "Defense Group:", "Offense Group:", "Tackling Circuit:", "Station 1:"
  res = res.replace(/^(?:(?:defense|offense|special teams|tackling|agility|fundamental|individual|team|group|pod|station)\s*(?:group|period|pod|station|circuit)?\s*:\s*)/i, '');
  // Remove bracket annotations e.g. [DL], [LB]
  res = res.replace(/\[.*?\]/g, ' ');
  // Remove parenthetical notes e.g. (Spencer Erickson), (Winona State), (Glazier Clinics)
  res = res.replace(/\(.*?\)/g, ' ');
  // Remove words like drill, drills, station, pod, period
  res = res.replace(/\b(?:drill|drills|station|pod|period)\b/gi, ' ');
  return normalizeName(res);
}

const DRILL_STOP_WORDS = new Set([
  'and',
  '&',
  'the',
  'for',
  'with',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'a',
  'an',
  'vs',
  'group',
  'drill',
  'drills',
  'pod',
  'period',
  'station',
  'circuit',
]);

/**
 * Finds a matching Whiteboard drill by title, alias, or fuzzy string match
 */
export function findMatchingWhiteboardDrill(
  stationName: string,
  drills: WhiteboardDrill[]
): WhiteboardDrill | null {
  if (!stationName || !stationName.trim() || !drills || drills.length === 0) {
    return null;
  }

  const raw = stationName.trim();
  const normalizedRaw = normalizeName(raw);
  const cleaned = cleanStationName(raw);

  // 1. Direct title or ID match
  for (const d of drills) {
    if (d.id.toLowerCase() === raw.toLowerCase()) return d;
    if (d.title.toLowerCase() === raw.toLowerCase()) return d;
  }

  // 2. Normalized full match
  for (const d of drills) {
    const normTitle = normalizeName(d.title);
    if (normTitle === normalizedRaw || normTitle === cleaned) return d;
  }

  // 3. Known shorthand and keyword aliases (mapped to canonical title or drill IDs)
  const aliasMap: Record<string, string[]> = {
    'team pursuit & cutback lane contain': [
      'team pursuit & cutback lane contain',
      'team pursuit and cutback lane contain',
      'team pursuit cutback lane contain',
      'cutback lane contain',
      'spencer erickson pursuit',
      'spencer erickson',
      'team pursuit & cutback',
      'team pursuit cutback',
      'team pursuit',
    ],
    '4-corner pursuit & swarm': [
      '4-corner pursuit & swarm',
      '4 corner pursuit & swarm',
      '4 corner pursuit',
      '4-corner pursuit',
      'four corner pursuit',
      'pursuit & swarm',
      'pursuit and swarm',
    ],
    'ball on a stick': [
      'ball on stick',
      'ball-on-a-stick',
      'dl stance',
      'stance & get-off',
      'first step get-off',
    ],
    'krausko blitz master': [
      'krausko',
      'blitz master',
      'krausko pad',
      'blitz pod',
      'blitz progression',
      'skinny chute',
      'inside counter',
      'edge bend',
      'flatten',
      'the colt shield',
    ],
    'read step pod': [
      'read step',
      'read-step',
      'lb read',
      'keys pod',
      'lateral shuffle',
      'stance & lateral shuffle',
      'lb / db stance',
    ],
    'gap sound run fit pod': [
      'gap sound',
      'run fit',
      'run fits',
      'gap-sound',
      'iso fit',
      'power fit',
    ],
    'form tackling circuit': [
      'form tackle',
      'form tackling',
      'tackle circuit',
      'tackling pod',
      'heads-up',
      'seahawk',
      'leverage form',
      'profile & wrap',
      'seal & wrap',
      'tackle: profile',
    ],
    'angle tackling on bags': [
      'angle tackle',
      'angle tackling',
      'tackle bags',
      'bag tackle',
      'drive through contact',
    ],
    'shed and tackle circuit': [
      'shed & tackle',
      'shed and tackle',
      'block shed',
      'shedding',
      'mirror shed',
      'turnover circuit',
    ],
    'pursuit & strip to the cone': [
      'pursuit & strip',
      'pursuit and strip',
      'strip to cone',
      'strip to the cone',
      'strip ball',
    ],
    'cover 3 match': ['cover 3', 'cov 3', 'c3 match', 'c3'],
    'cover 2 hard corner': ['cover 2', 'cov 2', 'c2 hard corner', 'hard flat', 'c2'],
    'slant & angle (pinch / pirate)': [
      'slant',
      'pinch',
      'pirate',
      'slant & angle',
      'd-line stunt',
      'stunts',
    ],
    'spill and contain': [
      'contain & spill',
      'force player',
      'box defender',
      'perimeter run fit',
    ],
    'scrape & spill': [
      'scrape and spill',
      'spill to alley',
      'spill and alley',
      'alley tackle',
      'scrape over trash',
      'lb scrape',
      'scrape spill',
      'spill alley',
    ],
    'cutback lanes': [
      'cutbacks',
      'cut back',
      'outside and cutback',
      'press edge and cutback',
      'perimeter press',
      'outside cutback',
      'outside vs cutback',
    ],
  };

  for (const [canonicalKeyword, aliases] of Object.entries(aliasMap)) {
    const normCanonical = normalizeName(canonicalKeyword);
    const matchesStation =
      normalizedRaw.includes(normCanonical) ||
      cleaned.includes(normCanonical) ||
      aliases.some((a) => {
        const normA = normalizeName(a);
        return normalizedRaw.includes(normA) || cleaned.includes(normA);
      });

    if (matchesStation) {
      const found = drills.find((d) => {
        const norm = normalizeName(d.title);
        return norm.includes(normCanonical) || norm === normCanonical;
      });
      if (found) return found;
    }
  }

  // 4. Substring containment match and multi-token ranking
  let bestDrill: WhiteboardDrill | null = null;
  let bestScore = 0;

  for (const d of drills) {
    const normTitle = normalizeName(d.title);
    const normSub = d.subtitle ? normalizeName(d.subtitle) : '';
    let score = 0;

    // Direct substring in title
    if (cleaned.length >= 5 && normTitle.includes(cleaned)) {
      score += 1000 + cleaned.length * 10;
    } else if (cleaned.length >= 5 && cleaned.includes(normTitle)) {
      score += 800 + normTitle.length * 10;
    } else if (normalizedRaw.length >= 6 && normTitle.includes(normalizedRaw)) {
      score += 700;
    }

    // Subtitle phrase matching
    if (cleaned.length >= 5 && normSub && normSub.includes(cleaned)) {
      score += 400;
    }

    // Significant word token matching
    const stnWords = cleaned.split(' ').filter((w) => w.length >= 3 && !DRILL_STOP_WORDS.has(w));
    const titleWords = normTitle.split(' ').filter((w) => w.length >= 3 && !DRILL_STOP_WORDS.has(w));

    let matchedCount = 0;
    for (const sw of stnWords) {
      if (titleWords.includes(sw)) {
        matchedCount++;
        score += sw.length * 25;
      } else if (normSub && normSub.includes(sw)) {
        score += sw.length * 15;
      }
    }

    if (stnWords.length > 0 && titleWords.length > 0) {
      const ratio = matchedCount / Math.max(stnWords.length, titleWords.length);
      score += Math.round(ratio * 300);
    }

    if (score > bestScore) {
      bestScore = score;
      bestDrill = d;
    }
  }

  return bestScore >= 50 ? bestDrill : null;
}

/**
 * Searches practice plans to check if a specific whiteboard drill is scheduled
 */
export function findDrillInPracticePlans(
  drill: WhiteboardDrill,
  plans: PracticePlan[],
  currentPracticeId?: string | null
): {
  plan: PracticePlan;
  periodIndex: number;
  periodNumber: number;
  stationIndex: number;
  stationName: string;
} | null {
  if (!drill || !plans || plans.length === 0) return null;

  // Search current practice plan first if provided
  const sortedPlans = [...plans].sort((a, b) => {
    if (a.id === currentPracticeId) return -1;
    if (b.id === currentPracticeId) return 1;
    return 0;
  });

  for (const plan of sortedPlans) {
    const periods = plan.periods || plan.plan || [];
    for (let pIdx = 0; pIdx < periods.length; pIdx++) {
      const period = periods[pIdx];
      const stations = period.stations || [];
      for (let sIdx = 0; sIdx < stations.length; sIdx++) {
        const st = stations[sIdx];
        if (!st.name) continue;
        const matched = findMatchingWhiteboardDrill(st.name, [drill]);
        if (matched && matched.id === drill.id) {
          return {
            plan,
            periodIndex: pIdx,
            periodNumber: pIdx + 1,
            stationIndex: sIdx,
            stationName: st.name,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Constructs a fallback WhiteboardDrill object from custom station details
 */
export function createCustomDrillFromStation(
  station: PracticeStation,
  periodNumber: number,
  periodCategory?: string
): WhiteboardDrill {
  const cleanTitle = (station.name || `PERIOD ${periodNumber} DRILL`).toUpperCase();
  const cleanCategory = (periodCategory || 'DEFENSE').toUpperCase();

  return {
    id: `plan-drill-${periodNumber}-${Date.now()}`,
    title: cleanTitle,
    subtitle: `Practice Period ${periodNumber} • Station Drill`,
    category: 'DL',
    categoryLabel: cleanCategory,
    objective:
      station.desc ||
      station.focus ||
      'Execute technical fundamentals with high intensity, pad discipline, and communication.',
    setup: station.focus
      ? `Station Focus: ${station.focus}${station.coach ? ` • Station Coach: ${station.coach}` : ''}`
      : 'Station setup with cones, agility bags, and blocking pads.',
    equipment: 'Cones, whistle, football, blocking pads.',
    cues: [
      station.focus || 'Fast first step & disciplined eyes',
      'Maintain low pad level through contact',
      'Finish through the whistle with proper pursuit',
    ],
    faults: [
      'Standing upright before engaging',
      'Failing to communicate coverage or gap assignment',
      'Slowing down before the whistle blows',
    ],
    instructions: [
      'Line up in designated formation on coach cadence.',
      station.desc || 'Execute drill movement with 100% burst and violent hands.',
      'Sprint 5 yards past the finish marker and reset quickly.',
    ],
    phases: [
      {
        name: 'STATION EXECUTION',
        description: station.desc || 'Live technical repetition under coach supervision.',
        tokens: [
          { id: 'coach-1', x: 200, y: 160, type: 'letter', label: station.coach ? station.coach.slice(0, 5) : 'COACH' },
          { id: 'player-1', x: 200, y: 260, type: 'letter', label: '1', subLabel: 'REP' },
          { id: 'bag-1', x: 200, y: 340, type: 'bag', label: 'PAD' },
        ],
        arrows: [
          {
            id: 'arrow-exec',
            startX: 200,
            startY: 260,
            endX: 200,
            endY: 320,
            type: 'straight',
            color: '#2563eb',
            label: 'BURST',
          },
        ],
        zones: [],
      },
    ],
  };
}

/**
 * Extracts all drills from a practice plan's periods and stations,
 * mapping each to an interactive or printable Whiteboard drill.
 */
export function extractPlanDrillItems(
  plan: PracticePlan | null,
  periods: PracticePeriod[],
  allWhiteboardDrills: WhiteboardDrill[]
): PlanDrillItem[] {
  if (!periods || periods.length === 0) return [];

  const items: PlanDrillItem[] = [];
  const seenKeys = new Set<string>();

  periods.forEach((period, pIdx) => {
    const periodNum = pIdx + 1;
    const periodName = period.name || period.title || `Period ${periodNum}: ${period.category || 'Station'}`;
    const stations = period.stations || [];

    stations.forEach((station, sIdx) => {
      const stationName = (station.name || '').trim();
      if (!stationName) return;

      const matchedDrill = findMatchingWhiteboardDrill(stationName, allWhiteboardDrills);
      const effectiveDrill = matchedDrill || createCustomDrillFromStation(station, periodNum, period.category);

      const uniqueKey = `p${periodNum}-s${sIdx}-${effectiveDrill.id || stationName}`;
      if (seenKeys.has(uniqueKey)) return;
      seenKeys.add(uniqueKey);

      items.push({
        key: uniqueKey,
        periodIndex: pIdx,
        periodNumber: periodNum,
        periodName,
        stationIndex: sIdx,
        stationName,
        stationDesc: station.desc || '',
        stationCoach: station.coach || '',
        stationFocus: station.focus || '',
        category: matchedDrill?.category || period.category || 'DEFENSE',
        isMatched: !!matchedDrill,
        whiteboardDrill: matchedDrill,
        effectiveDrill,
        selectedPhaseIndex: 0,
      });
    });
  });

  return items;
}

/**
 * Generates combined print-ready HTML containing the master Practice Plan
 * and any selected Whiteboard Drill Sheets in a single document with proper page breaks.
 */
export function generatePracticePlanPackageHTML(options: PracticePlanPrintPackageOptions): string {
  const {
    plan,
    periods,
    seqInfo,
    fontSize = 12,
    includePlanTable = true,
    selectedDrills = [],
    documentTitle = 'Practice Plan Package',
  } = options;

  // 1. Generate base Practice Plan HTML to extract styling and table markup
  let planStyles = '';
  let planBody = '';

  if (includePlanTable) {
    const rawPlanHtml = generatePracticePlanHTML(plan, periods, seqInfo, fontSize);
    const styleStart = rawPlanHtml.indexOf('<style>');
    const styleEnd = rawPlanHtml.indexOf('</style>');
    if (styleStart !== -1 && styleEnd !== -1) {
      planStyles = rawPlanHtml.substring(styleStart + 7, styleEnd);
    }
    const bodyStart = rawPlanHtml.indexOf('<body>') + 6;
    const bodyEnd = rawPlanHtml.indexOf('</body>');
    if (bodyStart !== -1 && bodyEnd !== -1) {
      planBody = rawPlanHtml.substring(bodyStart, bodyEnd);
    }
  }

  // 2. Generate drill styles and drill cards
  const sampleDrill = selectedDrills[0]?.drill;
  const drillStyles = sampleDrill ? extractDrillPrintStyles(sampleDrill) : '';

  // 3. Generate formations pocket depth chart if requested
  let formationsStyles = '';
  let formationsBody = '';
  if (options.includeFormations && options.formations && options.formations.length > 0) {
    try {
      const rawFormationsHtml = generatePocketDepthChartPrintHTML(
        options.formations,
        options.depthChart || {},
        {
          unitFilter: 'all',
          layout: 'side_by_side',
          columnsCount: 2,
          orientation: 'portrait',
          selectedFormationIds: options.formations.map((f) => f.id),
          teamName: options.activeTeamName || options.plan?.title || 'Football Team',
          seasonLabel: 'Practice Formations',
        }
      );
      const fStyleStart = rawFormationsHtml.indexOf('<style>');
      const fStyleEnd = rawFormationsHtml.indexOf('</style>');
      if (fStyleStart !== -1 && fStyleEnd !== -1) {
        formationsStyles = rawFormationsHtml.substring(fStyleStart + 7, fStyleEnd);
      }
      const fBodyStart = rawFormationsHtml.indexOf('<body>') + 6;
      const fBodyEnd = rawFormationsHtml.indexOf('</body>');
      if (fBodyStart !== -1 && fBodyEnd !== -1) {
        formationsBody = rawFormationsHtml.substring(fBodyStart, fBodyEnd);
      }
    } catch (err) {
      console.warn('Failed to compile formation sheets for practice package:', err);
    }
  }

  const drillSheetsHtml = selectedDrills
    .map((item, idx) => {
      const cardMarkup = extractDrillCardMarkup(item.drill, item.phaseIndex || 0);
      const needsPageBreakBefore = includePlanTable || idx > 0;
      return `
        <div class="drill-page-wrapper ${needsPageBreakBefore ? 'page-break-before' : ''}">
          <div class="drill-header-plan-banner print:block">
            <span class="banner-title">${plan?.title || 'MAHOPAC 10U DEFENSE'}</span>
            <span class="banner-meta">DRILL ATTACHMENT • PAGE ${ (includePlanTable ? 2 : 1) + idx }</span>
          </div>
          ${cardMarkup}
        </div>
      `;
    })
    .join('\n');

  const formationsSheetHtml = formationsBody
    ? `
      <div class="print-page-break" style="page-break-before: always !important; break-before: page !important; display: block !important; clear: both !important; height: 0; margin: 0; padding: 0;"></div>
      <div class="drill-page-wrapper formations-sheet-wrapper page-break-before" style="page-break-before: always !important; break-before: page !important; display: block !important; clear: both !important; width: 100% !important;">
        <div class="drill-header-plan-banner print:block">
          <span class="banner-title">${options.activeTeamName || plan?.title || 'TEAM FORMATIONS'}</span>
          <span class="banner-meta">POCKET DEPTH CHARTS • ALL FORMATIONS</span>
        </div>
        ${formationsBody}
      </div>
    `
    : '';

  const hasFollowingContent = selectedDrills.length > 0 || Boolean(formationsSheetHtml);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${documentTitle}</title>
  <style>
    ${planStyles}
    ${drillStyles}
    ${formationsStyles}

    /* Page Break & Combined Print Rules */
    @media print {
      @page {
        size: letter portrait;
        margin: 0.25in 0.3in;
      }
      .plan-screen-card.has-following-pages,
      .plan-screen-card.page-break-after {
        page-break-after: always !important;
        break-after: page !important;
        display: block !important;
        clear: both !important;
      }
      .drill-page-wrapper {
        display: block !important;
        clear: both !important;
        width: 100% !important;
      }
      .formations-sheet-wrapper {
        page-break-before: always !important;
        break-before: page !important;
        display: block !important;
        clear: both !important;
        width: 100% !important;
      }
      .page-break-before {
        page-break-before: always !important;
        break-before: page !important;
        display: block !important;
        clear: both !important;
      }
      .page-break-after {
        page-break-after: always !important;
        break-after: page !important;
        display: block !important;
        clear: both !important;
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
      .no-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .drill-header-plan-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px dashed #94a3b8;
        padding-bottom: 4px;
        margin-bottom: 6px;
        font-size: 8.5px;
        font-weight: 800;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    @media screen {
      body {
        background: #0f172a;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .plan-screen-card, .drill-page-wrapper {
        background: #ffffff;
        max-width: 800px;
        margin: 0 auto 24px auto;
        padding: 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        border-radius: 8px;
      }
      .page-break-before {
        border-top: 3px dashed #64748b;
        padding-top: 24px;
      }
      .drill-header-plan-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px dashed #cbd5e1;
        padding-bottom: 4px;
        margin-bottom: 8px;
        font-size: 9px;
        font-weight: bold;
        color: #64748b;
        text-transform: uppercase;
      }
    }
  </style>
</head>
<body>
  ${
    includePlanTable
      ? `
    <div class="plan-screen-card ${hasFollowingContent ? 'has-following-pages page-break-after' : ''}">
      ${planBody}
    </div>
  `
      : ''
  }

  ${drillSheetsHtml}
  ${formationsSheetHtml}
</body>
</html>`;
}

/**
 * Triggers printing of the combined practice plan and drill sheets
 */
export function printPracticePlanPackage(options: PracticePlanPrintPackageOptions): void {
  const html = generatePracticePlanPackageHTML(options);
  const title = options.documentTitle || options.plan?.title || 'Practice Plan & Drill Sheets';
  printCleanHTML(html, title);
}

/**
 * Opens the combined practice plan and drill sheets in a new browser tab
 */
export function openPracticePlanPackageTab(options: PracticePlanPrintPackageOptions): void {
  const html = generatePracticePlanPackageHTML(options);
  const title = options.documentTitle || options.plan?.title || 'Practice Plan & Drill Sheets';
  openCleanPrintTab(html, title);
}
