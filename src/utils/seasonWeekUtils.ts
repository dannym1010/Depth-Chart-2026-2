import { ScheduleEvent, FormationBoard, PlacedPlayer, WeekState, SeasonConfig, WeekOption, formatWeekLabel } from '../types';
export { formatWeekLabel } from '../types';
import { INITIAL_DEFAULT_FORMATIONS } from '../data/initialData';
import { deepClone } from '../services/storageService';

export interface AutoWeekResult {
  activeWeek: string;
  reason: string;
  priorWeek?: string;
  isAutoCalculated: boolean;
}

/**
 * Normalizes weeklyData across both legacy unscoped week keys ('0', '1', ...)
 * and team-scoped keys ('team_10u__week_0', ...), guaranteeing that depth charts,
 * formations, scrimmage charts, scouting, and opponent details are preserved and synced.
 */
export function normalizeWeeklyData(
  wData: Record<string, WeekState> | undefined,
  defaultForms: FormationBoard[] = INITIAL_DEFAULT_FORMATIONS,
  deletedFormationIds: string[] = []
): Record<string, WeekState> {
  if (!wData || typeof wData !== 'object') return {};
  const result: Record<string, WeekState> = {};

  const deletedSet = new Set<string>(deletedFormationIds || []);

  const fallbackFormations = (
    defaultForms && defaultForms.length > 0
      ? defaultForms
      : INITIAL_DEFAULT_FORMATIONS
  ).filter((f) => f && f.id && !deletedSet.has(f.id));

  for (const [key, weekState] of Object.entries(wData)) {
    if (!weekState || typeof weekState !== 'object') continue;

    const hasExplicitFormations = Array.isArray(weekState.formations);
    let rawFormations =
      hasExplicitFormations
        ? deepClone(weekState.formations)
        : deepClone(fallbackFormations);

    // Deduplicate by ID and filter out deleted formations
    const seenIds = new Set<string>();
    let formations: FormationBoard[] = [];

    for (const f of rawFormations) {
      if (!f || !f.id || deletedSet.has(f.id)) continue;
      if (seenIds.has(f.id)) continue;
      seenIds.add(f.id);
      formations.push(f);
    }

    // Ensure every week has core units (Offense, Defense, ST, Groups) populated
    for (const u of ['offense', 'defense', 'st', 'groups'] as const) {
      if (!formations.some((f) => f && f.unit === u)) {
        const defsForUnit = fallbackFormations.filter(
          (f) => f && f.unit === u && !deletedSet.has(f.id)
        );
        const toAdd =
          defsForUnit.length > 0
            ? defsForUnit
            : INITIAL_DEFAULT_FORMATIONS.filter(
                (f) =>
                  f &&
                  f.unit === u &&
                  f.id !== 'form_10_spread' &&
                  f.name !== '10 Spread Offense'
              );
        for (const df of toAdd) {
          if (!seenIds.has(df.id)) {
            formations.push(deepClone(df));
            seenIds.add(df.id);
          }
        }
      }
    }

    const depthChart =
      weekState.depthChart && typeof weekState.depthChart === 'object'
        ? deepClone(weekState.depthChart)
        : {};

    const scrimmageChart =
      weekState.scrimmageChart && typeof weekState.scrimmageChart === 'object'
        ? deepClone(weekState.scrimmageChart)
        : {};

    const sanitizedWeek: any = {
      ...weekState,
      formations,
      depthChart,
      scrimmageChart,
      opponent: weekState.opponent || '',
      scouting: weekState.scouting || {
        year: '2026',
        week: key,
        opponent: '',
        gameDate: '',
        gameLocation: '',
        teamOverview: '',
        offensiveTendencies: '',
        defensiveFronts: '',
        specialTeamsNotes: '',
        keysToVictory: [],
        keyPlayersList: [],
        coachNotes: [],
      },
    };

    if (
      weekState.wristbandData &&
      Array.isArray((weekState.wristbandData as any).wristbands) &&
      (weekState.wristbandData as any).wristbands.length > 0
    ) {
      sanitizedWeek.wristbandData = deepClone(weekState.wristbandData);
    }

    result[key] = sanitizedWeek;
  }

  // Cross-synchronize team_10u__week_X and legacy X keys so neither key suffers from missing formations or depth chart
  const weekIdentifiers = new Set<string>();
  for (const k of Object.keys(result)) {
    if (k.startsWith('team_10u__week_')) {
      weekIdentifiers.add(k.replace('team_10u__week_', ''));
    } else if (!k.includes('__week_')) {
      weekIdentifiers.add(k);
    }
  }

  for (const wk of weekIdentifiers) {
    const scopedKey = `team_10u__week_${wk}`;
    const legacyKey = wk;
    const scopedState = result[scopedKey];
    const legacyState = result[legacyKey];

    if (scopedState && legacyState) {
      // Reconcile formations without resurrecting deleted ones
      const combinedFormations: FormationBoard[] = [];
      const seenIds = new Set<string>();
      const seenKeys = new Set<string>();

      const addFormationIfValid = (f: FormationBoard) => {
        if (!f || !f.id || deletedSet.has(f.id)) return;
        const normalizedName = (f.name || '').toLowerCase().trim();
        const uKey = `${f.unit}__${normalizedName}`;
        if (seenIds.has(f.id) || seenKeys.has(uKey)) return;
        seenIds.add(f.id);
        seenKeys.add(uKey);
        combinedFormations.push(f);
      };

      (scopedState.formations || []).forEach(addFormationIfValid);
      (legacyState.formations || []).forEach(addFormationIfValid);

      // Prefer the scopedState depth chart if it exists, falling back to legacyState only if scoped is completely missing
      let reconciledDC = scopedState.depthChart;
      if (!scopedState.depthChart || Object.keys(scopedState.depthChart).length === 0) {
        reconciledDC = legacyState.depthChart || {};
      } else {
        reconciledDC = scopedState.depthChart;
      }

      let reconciledSC = scopedState.scrimmageChart;
      if (!scopedState.scrimmageChart || Object.keys(scopedState.scrimmageChart).length === 0) {
        reconciledSC = legacyState.scrimmageChart || {};
      } else {
        reconciledSC = scopedState.scrimmageChart;
      }

      scopedState.formations = combinedFormations;
      scopedState.depthChart = reconciledDC;
      scopedState.scrimmageChart = reconciledSC;

      legacyState.formations = deepClone(combinedFormations);
      legacyState.depthChart = deepClone(reconciledDC);
      legacyState.scrimmageChart = deepClone(reconciledSC);
    } else if (scopedState && !legacyState) {
      result[legacyKey] = deepClone(scopedState);
    } else if (legacyState && !scopedState) {
      result[scopedKey] = deepClone(legacyState);
    }
  }

  return result;
}

/**
 * Returns the list of season weeks based on SeasonConfig or standard defaults:
 * Pre-season weeks (e.g. Pre-Season Week 1, 2, 3, 4), Regular season weeks (Week 1, 2, 3, 4, 5, 6, 7, 8), Playoffs, Championship
 */
export function getSeasonWeekList(config?: SeasonConfig): WeekOption[] {
  if (config?.customWeeks && config.customWeeks.length > 0) {
    return config.customWeeks.map((w) => ({
      ...w,
      label: config.customWeekLabels?.[w.key] || w.label || formatWeekLabel(w.key, config),
    }));
  }

  const preCount = config?.preseasonWeeksCount ?? 4;
  const regCount = config?.regularSeasonWeeksCount ?? 8;
  const list: WeekOption[] = [];

  // Pre-season weeks
  for (let i = 1; i <= preCount; i++) {
    const key = `pre-${i}`;
    const defaultLabel = `Pre-Season Week ${i}`;
    list.push({
      key,
      label: config?.customWeekLabels?.[key] || defaultLabel,
      phase: 'preseason',
    });
  }

  // Regular season weeks
  for (let i = 1; i <= regCount; i++) {
    const key = String(i);
    const defaultLabel = `Week ${i}`;
    list.push({
      key,
      label: config?.customWeekLabels?.[key] || defaultLabel,
      phase: 'regular',
    });
  }

  // Post season weeks
  if (config?.hasPlayoffs !== false) {
    list.push({
      key: 'playoffs',
      label: config?.customWeekLabels?.['playoffs'] || 'Playoffs',
      phase: 'postseason',
    });
  }
  if (config?.hasChampionship !== false) {
    list.push({
      key: 'championship',
      label: config?.customWeekLabels?.['championship'] || 'Championship',
      phase: 'postseason',
    });
  }

  return list;
}

/**
 * Returns dropdown label dynamically displaying the scheduled opponent if one is scheduled for this week & team
 */
export function getWeekDisplayLabelWithOpponent(
  weekKey: string,
  baseLabel: string,
  scheduleEvents?: ScheduleEvent[],
  activeTeamId?: string
): string {
  if (!scheduleEvents || scheduleEvents.length === 0) return baseLabel;

  const cleanKey = weekKey.replace(/^Week\s+/i, '').trim();
  const game = scheduleEvents.find((e) => {
    if (activeTeamId && e.teamId && e.teamId !== activeTeamId && activeTeamId !== 'all') {
      return false;
    }
    if (e.type !== 'game' && e.type !== 'scrimmage') return false;
    const evWeek = (e.week || '').replace(/^Week\s+/i, '').trim();
    if (evWeek === cleanKey) return true;
    if (cleanKey === '0' && (evWeek.startsWith('pre') || evWeek === '0')) return true;
    if (cleanKey === 'playoffs' && (evWeek === 'playoffs' || evWeek === 'post')) return true;
    return false;
  });

  if (game) {
    const rawOpp = game.opponent || game.title || '';
    if (rawOpp) {
      const isAway = game.locationType === 'away' || rawOpp.trim().startsWith('@');
      const cleanOpp = rawOpp.replace(/^vs\.?\s*/i, '').replace(/^@\s*/i, '').trim();
      const symbol = isAway ? '@' : 'vs';
      return `${baseLabel} (${symbol} ${cleanOpp})`;
    }
  }

  return baseLabel;
}

/**
 * Returns the exact Monday-to-Sunday date range for any season week.
 * Weeks ALWAYS start on Monday and end on Sunday.
 * Base Week 1 Monday for 2026 is 2026-08-31.
 */
export function getWeekDateRange(
  weekKey: string,
  seasonStartMonday: string = '2026-08-31'
): { startDate: string; endDate: string } {
  const clean = (weekKey || '').toLowerCase().trim().replace(/^week\s+/i, '');

  let weekOffset = 0; // 0 is Week 1 (Monday Aug 31 - Sunday Sep 06, 2026)
  if (clean === 'pre-1' || clean === 'pre1' || clean === 'preseason-1' || clean === '0') {
    weekOffset = -4; // Aug 03 - Aug 09, 2026 (Pre-Season Week 1 starts on Monday 8/3)
  } else if (clean === 'pre-2' || clean === 'pre2' || clean === 'preseason-2') {
    weekOffset = -3; // Aug 10 - Aug 16, 2026 (Pre-Season Week 2)
  } else if (clean === 'pre-3' || clean === 'pre3' || clean === 'preseason-3') {
    weekOffset = -2; // Aug 17 - Aug 23, 2026 (Pre-Season Week 3)
  } else if (clean === 'pre-4' || clean === 'pre4' || clean === 'preseason-4') {
    weekOffset = -1; // Aug 24 - Aug 30, 2026 (Pre-Season Week 4)
  } else if (clean === 'playoffs' || clean === 'playoff') {
    weekOffset = 8; // Oct 26 - Nov 01, 2026
  } else if (clean === 'championship') {
    weekOffset = 9; // Nov 02 - Nov 08, 2026
  } else {
    const num = parseInt(clean, 10);
    if (!isNaN(num)) {
      weekOffset = num - 1;
    }
  }

  const [y, m, d] = seasonStartMonday.split('-').map(Number);
  const baseDate = new Date(y, m - 1, d, 12, 0, 0);
  const startDateObj = new Date(baseDate);
  startDateObj.setDate(baseDate.getDate() + weekOffset * 7);

  const endDateObj = new Date(startDateObj);
  endDateObj.setDate(startDateObj.getDate() + 6);

  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const formatIso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  return {
    startDate: formatIso(startDateObj),
    endDate: formatIso(endDateObj),
  };
}

/**
 * Checks whether a given date (YYYY-MM-DD) falls within a week (Monday to Sunday).
 */
export function isDateInWeek(
  dateStr: string,
  weekKey: string,
  seasonStartMonday: string = '2026-08-31'
): boolean {
  if (!dateStr || !weekKey) return false;
  const cleanDate = dateStr.trim();
  const range = getWeekDateRange(weekKey, seasonStartMonday);
  return cleanDate >= range.startDate && cleanDate <= range.endDate;
}

/**
 * Calculates the current active depth chart / season week automatically:
 * 1. Week 1 starts the Monday before the 1st regular season game (Aug 31, 2026).
 * 2. Before that date, it is Pre-Season (Week 0).
 * 3. A week advances to the next week immediately after:
 *    - The game score is recorded (result is entered), OR
 *    - Today's date is after the scheduled game date (day after the game).
 * 4. After all regular season games, it advances to Playoffs / Post-Season.
 */
export function getAutoActiveWeek(
  scheduleEvents: ScheduleEvent[] = [],
  currentDateStr?: string
): AutoWeekResult {
  const today = currentDateStr || new Date().toISOString().split('T')[0];

  // Find all games sorted by date
  const games = (scheduleEvents || [])
    .filter((e) => e && (e.type === 'game' || (e.title && e.title.toLowerCase().includes('game'))))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (games.length === 0) {
    return {
      activeWeek: '1',
      reason: 'Week 1 Active (Default Season Schedule)',
      priorWeek: '0',
      isAutoCalculated: true,
    };
  }

  const firstGame = games[0];
  let week1Monday = '2026-08-31';

  if (firstGame.date) {
    const parts = firstGame.date.split('-');
    if (parts.length === 3) {
      const gYear = parseInt(parts[0], 10);
      const gMonth = parseInt(parts[1], 10);
      const gDay = parseInt(parts[2], 10);
      if (!isNaN(gYear) && !isNaN(gMonth) && !isNaN(gDay)) {
        const gDate = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
        const dayOfWeek = gDate.getDay(); // 0 is Sun, 1 is Mon, 6 is Sat
        // Days back to previous Monday (if Sunday: 6 days, if Saturday: 5 days, if Monday: 0 days)
        const daysBack = (dayOfWeek + 6) % 7;
        const monDate = new Date(gDate);
        monDate.setDate(gDate.getDate() - daysBack);
        const m = monDate.getMonth() + 1;
        const d = monDate.getDate();
        week1Monday = `${monDate.getFullYear()}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
      }
    }
  }

  // 1. If today is strictly before Week 1 Monday, we are in Pre-Season
  if (today < week1Monday) {
    let preWeek = 'pre-1';
    if (today >= '2026-08-24') {
      preWeek = 'pre-4';
    } else if (today >= '2026-08-17') {
      preWeek = 'pre-3';
    } else if (today >= '2026-08-10') {
      preWeek = 'pre-2';
    }
    return {
      activeWeek: preWeek,
      reason: `Pre-Season Active (Week 1 begins Monday ${week1Monday})`,
      priorWeek: undefined,
      isAutoCalculated: true,
    };
  }

  // 2. Iterate through each game sequentially
  let determinedWeek = String(firstGame.week || '1');
  const firstGameOpponent = firstGame.opponent || firstGame.title || 'Game 1';
  let reason = `Week 1 Active (Lead-up to Game 1 vs ${firstGameOpponent})`;
  let priorWeek: string | undefined = '0';

  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const hasScore = Boolean(
      g.result &&
      g.result.teamScore !== undefined &&
      g.result.opponentScore !== undefined &&
      g.result.teamScore !== null &&
      g.result.opponentScore !== null
    );
    const isPastGameDate = Boolean(g.date && today > g.date);
    const isCompleted = hasScore || isPastGameDate;

    if (isCompleted) {
      if (i + 1 < games.length) {
        const nextGame = games[i + 1];
        priorWeek = String(g.week || (i + 1));
        determinedWeek = String(nextGame.week || (i + 2));
        const cause = hasScore
          ? `Game ${i + 1} score entered (${g.result?.outcome} ${g.result?.teamScore}-${g.result?.opponentScore})`
          : `Day after scheduled Game ${i + 1} (${g.date})`;
        reason = `Week ${determinedWeek} Active (${cause})`;
      } else {
        priorWeek = String(g.week || games.length);
        determinedWeek = 'playoffs';
        reason = 'Playoffs / Post-Season Active (Regular season completed)';
      }
    } else {
      determinedWeek = String(g.week || (i + 1));
      priorWeek = i > 0 ? String(games[i - 1].week || i) : '0';
      const oppLabel = g.opponent ? `vs ${g.opponent}` : g.title;
      reason = `Week ${determinedWeek} Active (${oppLabel} on ${g.date || 'TBD'})`;
      break;
    }
  }

  return {
    activeWeek: determinedWeek,
    reason,
    priorWeek,
    isAutoCalculated: true,
  };
}

/**
 * Checks if a week needs player depth chart copying from a previous week:
 * Returns true if target week has formations but empty depthChart, and source week has depthChart entries.
 */
export function checkNeedsDepthChartCopy(
  weeklyData: Record<string, WeekState>,
  targetWeek: string,
  sourceWeek?: string
): { needsCopy: boolean; sourceWeek: string; sourcePlayerCount: number } {
  if (!targetWeek) return { needsCopy: false, sourceWeek: '', sourcePlayerCount: 0 };

  const targetState = weeklyData[targetWeek];
  const targetDepthCount = targetState?.depthChart
    ? Object.values(targetState.depthChart).reduce((acc, list) => acc + (list?.length || 0), 0)
    : 0;

  if (targetDepthCount > 0) {
    return { needsCopy: false, sourceWeek: '', sourcePlayerCount: 0 };
  }

  // Determine candidate source week (defaulting to previous numeric week or '0')
  let srcWk = sourceWeek;
  if (!srcWk) {
    const num = parseInt(targetWeek, 10);
    if (!isNaN(num) && num > 1) {
      srcWk = String(num - 1);
    } else if (targetWeek === '1') {
      srcWk = '0';
    } else if (targetWeek === 'playoffs') {
      srcWk = '8';
    } else if (targetWeek === 'championship') {
      srcWk = 'playoffs';
    } else {
      srcWk = '0';
    }
  }

  const srcState = weeklyData[srcWk];
  const srcPlayerCount = srcState?.depthChart
    ? Object.values(srcState.depthChart).reduce((acc, list) => acc + (list?.length || 0), 0)
    : 0;

  return {
    needsCopy: srcPlayerCount > 0,
    sourceWeek: srcWk,
    sourcePlayerCount: srcPlayerCount,
  };
}

export function normalizeFormationUnit(f: any): FormationBoard {
  const norm = deepClone(f);
  const rawUnit = (norm.unit || 'offense').toString().toLowerCase().trim();
  if (rawUnit.includes('off') || rawUnit === 'o') {
    norm.unit = 'offense';
  } else if (rawUnit.includes('def') || rawUnit === 'd') {
    norm.unit = 'defense';
  } else if (rawUnit.includes('spec') || rawUnit === 'st') {
    norm.unit = 'st';
  } else if (rawUnit.includes('grp') || rawUnit.includes('group')) {
    norm.unit = 'groups';
  } else {
    norm.unit = 'offense';
  }
  return norm;
}

function ensureCoreUnitsPresent(list: FormationBoard[]): FormationBoard[] {
  const result = [...list];
  const seenIds = new Set<string>(result.map((f) => f.id));
  for (const u of ['offense', 'defense', 'st', 'groups'] as const) {
    if (!result.some((f) => f && f.unit === u)) {
      const defs = INITIAL_DEFAULT_FORMATIONS.filter((f) => f.unit === u);
      for (const df of defs) {
        if (!seenIds.has(df.id)) {
          result.push(deepClone(df));
          seenIds.add(df.id);
        }
      }
    }
  }
  return result;
}

export function extractBackupFormations(parsed: any): FormationBoard[] | null {
  if (!parsed || typeof parsed !== 'object') return null;

  // 1. Direct parsed.defaultFormations
  if (Array.isArray(parsed.defaultFormations) && parsed.defaultFormations.length > 0) {
    return ensureCoreUnitsPresent(parsed.defaultFormations.map(normalizeFormationUnit));
  }
  // 2. Direct parsed.formations
  if (Array.isArray(parsed.formations) && parsed.formations.length > 0) {
    return ensureCoreUnitsPresent(parsed.formations.map(normalizeFormationUnit));
  }
  // 3. Direct parsed.offensiveFormations / parsed.offenseFormations / defensive
  if (Array.isArray(parsed.offensiveFormations) || Array.isArray(parsed.offenseFormations)) {
    const off = (parsed.offensiveFormations || parsed.offenseFormations || []).map((f: any) => ({ ...f, unit: 'offense' }));
    const def = (parsed.defensiveFormations || parsed.defenseFormations || []).map((f: any) => ({ ...f, unit: 'defense' }));
    const st = (parsed.stFormations || parsed.specialTeamsFormations || []).map((f: any) => ({ ...f, unit: 'st' }));
    const combined = [...off, ...def, ...st].map(normalizeFormationUnit);
    if (combined.length > 0) return ensureCoreUnitsPresent(combined);
  }
  // 4. Raw array of formations directly
  if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0]?.rows || parsed[0]?.positions || parsed[0]?.unit)) {
    return ensureCoreUnitsPresent(parsed.map(normalizeFormationUnit));
  }
  // 5. Check weeklyData for formations across all weeks
  if (parsed.weeklyData && typeof parsed.weeklyData === 'object') {
    const collected: FormationBoard[] = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    for (const wk of Object.values(parsed.weeklyData) as any[]) {
      if (wk && Array.isArray(wk.formations)) {
        for (const rawF of wk.formations) {
          if (rawF && rawF.id) {
            const f = normalizeFormationUnit(rawF);
            const normName = (f.name || '').toLowerCase().trim();
            const uKey = `${f.unit}__${normName}`;
            if (!seenIds.has(f.id) && !seenKeys.has(uKey)) {
              seenIds.add(f.id);
              seenKeys.add(uKey);
              collected.push(f);
            }
          }
        }
      }
    }
    if (collected.length > 0) return ensureCoreUnitsPresent(collected);
  }
  // 6. Direct week-keyed objects: parsed['0'], parsed['team_10u__week_0'], etc.
  const weekLikeValues = Object.entries(parsed)
    .filter(([k, v]: [string, any]) => v && typeof v === 'object' && Array.isArray(v.formations))
    .map(([_, v]: [string, any]) => v);
  if (weekLikeValues.length > 0) {
    const collected: FormationBoard[] = [];
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    for (const wk of weekLikeValues) {
      for (const rawF of wk.formations) {
        if (rawF && rawF.id) {
          const f = normalizeFormationUnit(rawF);
          const normName = (f.name || '').toLowerCase().trim();
          const uKey = `${f.unit}__${normName}`;
          if (!seenIds.has(f.id) && !seenKeys.has(uKey)) {
            seenIds.add(f.id);
            seenKeys.add(uKey);
            collected.push(f);
          }
        }
      }
    }
    if (collected.length > 0) return ensureCoreUnitsPresent(collected);
  }
  return null;
}
