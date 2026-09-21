import { AttendanceRecord, RosterPlayer, SeasonConfig, WeekOption } from '../types';
import { isDateInWeek, getSeasonWeekList } from './seasonWeekUtils';

export interface CalculatedPlayerHours {
  conditioningHours: number;
  paddedHours: number;
  weeklyHours: Record<string, number>;
  totalSeasonHours: number;
  thisWeekHours: number;
  attendedCount: number;
  totalSessionsCount: number;
  attendanceRate: number;
}

/**
 * Normalizes legacy or non-standard week keys:
 * e.g., '0' -> 'pre-1', 'week 1' -> '1', etc.
 */
export function normalizeWeekKey(rawWeekKey?: string, dateStr?: string): string {
  if (!rawWeekKey && !dateStr) return 'pre-1';

  const clean = (rawWeekKey || '').toLowerCase().trim().replace(/^week\s+/i, '');
  if (clean === '0' || clean === 'preseason-1' || clean === 'pre1') return 'pre-1';
  if (clean === 'preseason-2' || clean === 'pre2') return 'pre-2';
  if (clean === 'preseason-3' || clean === 'pre3') return 'pre-3';
  if (clean === 'preseason-4' || clean === 'pre4') return 'pre-4';

  if (clean) return clean;

  // If week key is missing, derive from date
  if (dateStr) {
    if (isDateInWeek(dateStr, 'pre-1')) return 'pre-1';
    if (isDateInWeek(dateStr, 'pre-2')) return 'pre-2';
    if (isDateInWeek(dateStr, 'pre-3')) return 'pre-3';
    if (isDateInWeek(dateStr, 'pre-4')) return 'pre-4';
    for (let w = 1; w <= 8; w++) {
      if (isDateInWeek(dateStr, String(w))) return String(w);
    }
    if (isDateInWeek(dateStr, 'playoffs')) return 'playoffs';
    if (isDateInWeek(dateStr, 'championship')) return 'championship';
  }

  return 'pre-1';
}

/**
 * Authoritative, deterministic calculation of a player's practice hours,
 * conditioning hours, padded hours, and weekly breakdown directly from attendance logs.
 *
 * Guaranteed invariants:
 * 1. Total Season Hours === Sum of all weeklyHours.
 * 2. Pre-Season Total === conditioningHours + paddedHours.
 * 3. No ghost week '0' hours leaking into calculations.
 * 4. No compounding or double-counting on checkbox toggles.
 */
export function calculatePlayerHours(
  player: RosterPlayer,
  allLogs: AttendanceRecord[],
  selectedWeekKey: string = 'pre-1',
  seasonConfig?: SeasonConfig
): CalculatedPlayerHours {
  const playerNum = String(player.num).trim();
  const cleanSelectedWeek = normalizeWeekKey(selectedWeekKey);

  let condSum = 0;
  let padSum = 0;
  let attendedCount = 0;
  const weeklyHoursMap: Record<string, number> = {};

  // Standardize week keys from weekList
  const validWeeks = getSeasonWeekList(seasonConfig).map((w) => w.key);
  validWeeks.forEach((wk) => {
    weeklyHoursMap[wk] = 0;
  });

  // Calculate from attendance logs
  (allLogs || []).forEach((log) => {
    if (!log || typeof log !== 'object') return;
    const isPresent = Array.isArray(log.presentPlayerNums) && log.presentPlayerNums.includes(playerNum);
    const sessionHours = Number(log.hours || 0);

    if (isPresent && sessionHours > 0) {
      attendedCount++;
      const attire = log.playerSessionTypes?.[playerNum] || log.sessionType || 'conditioning';
      if (attire === 'conditioning') {
        condSum += sessionHours;
      } else {
        padSum += sessionHours;
      }

      const wk = normalizeWeekKey(log.week, log.date);
      weeklyHoursMap[wk] = Math.round(((weeklyHoursMap[wk] || 0) + sessionHours) * 10) / 10;
    }
  });

  // Check if player has baseline hours not covered by logs (e.g. manual entry or transfer)
  // If there are zero attendance logs in the app, we preserve the player's initial static values
  if ((allLogs || []).length === 0) {
    condSum = Number(player.conditioningHours || 0);
    padSum = Number(player.paddedHours || 0);
    if (player.weeklyHours && typeof player.weeklyHours === 'object') {
      Object.entries(player.weeklyHours).forEach(([wk, val]) => {
        const cleanWk = normalizeWeekKey(wk);
        weeklyHoursMap[cleanWk] = Number(val || 0);
      });
    }
  }

  // Round values cleanly to 1 decimal place with max of 10.0 hours
  const finalCond = Math.min(10, Math.round(condSum * 10) / 10);
  const finalPadded = Math.min(10, Math.round(padSum * 10) / 10);

  // Total season hours is strictly the sum of all valid weekly hours
  const totalSeasonHours = Math.round(
    Object.values(weeklyHoursMap).reduce((acc, h) => acc + Number(h || 0), 0) * 10
  ) / 10;

  const thisWeekHours = Math.round(Number(weeklyHoursMap[cleanSelectedWeek] || 0) * 10) / 10;
  const totalSessionsCount = (allLogs || []).length;
  const attendanceRate =
    totalSessionsCount > 0 ? Math.round((attendedCount / totalSessionsCount) * 100) : 100;

  return {
    conditioningHours: finalCond,
    paddedHours: finalPadded,
    weeklyHours: weeklyHoursMap,
    totalSeasonHours,
    thisWeekHours,
    attendedCount,
    totalSessionsCount,
    attendanceRate,
  };
}

/**
 * Batch calculates and updates the entire roster based on current attendance logs.
 */
export function syncEntireRosterWithLogs(
  roster: RosterPlayer[],
  attendanceLogs: AttendanceRecord[],
  selectedWeekKey: string = 'pre-1',
  seasonConfig?: SeasonConfig
): RosterPlayer[] {
  return roster.map((player) => {
    const calc = calculatePlayerHours(player, attendanceLogs, selectedWeekKey, seasonConfig);
    return {
      ...player,
      conditioningHours: calc.conditioningHours,
      paddedHours: calc.paddedHours,
      weeklyHours: calc.weeklyHours,
    };
  });
}

export interface AttendedDayItem {
  id: string;
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  monthDay: string;
  weekKey: string;
  weekLabel: string;
  isPreSeason: boolean;
  title: string;
  location?: string;
  sessionType: 'conditioning' | 'padded';
  playerAttire: 'conditioning' | 'padded';
  hours: number;
  notes?: string;
  wasPresent: boolean;
  runningTotal: number;
}

export interface PlayerHoursBreakdown {
  player: RosterPlayer;
  scope: 'season' | 'preseason' | 'this_week' | 'week';
  selectedWeekKey: string;
  scopeLabel: string;
  days: AttendedDayItem[];
  attendedDays: AttendedDayItem[];
  absentDays: AttendedDayItem[];
  totalHours: number;
  conditioningHours: number;
  paddedHours: number;
  attendedSessionsCount: number;
  totalSessionsCount: number;
  attendanceRate: number;
  formulaEquation: string;
  baselineHours: number;
}

/**
 * Returns a detailed chronological day-by-day practice breakdown
 * for an individual player showing exactly which days and hours added up to their total.
 */
export function getPlayerHoursBreakdown(
  player: RosterPlayer,
  allLogs: AttendanceRecord[],
  scope: 'season' | 'preseason' | 'this_week' | 'week' = 'season',
  selectedWeekKey: string = '1',
  seasonConfig?: SeasonConfig
): PlayerHoursBreakdown {
  const playerNum = String(player.num).trim();
  const cleanSelectedWeek = normalizeWeekKey(selectedWeekKey);

  // Sort logs chronologically by date
  const sortedLogs = [...(allLogs || [])]
    .filter((l) => Boolean(l && l.date))
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });

  // Filter logs by requested scope
  const filteredLogs = sortedLogs.filter((log) => {
    const wk = normalizeWeekKey(log.week, log.date);
    const isPre = wk.startsWith('pre-') || wk === '0';

    if (scope === 'preseason') {
      return isPre;
    }
    if (scope === 'this_week' || scope === 'week') {
      return wk === cleanSelectedWeek;
    }
    return true; // 'season' includes all
  });

  let runningTotal = 0;
  let condSum = 0;
  let padSum = 0;

  const days: AttendedDayItem[] = [];
  const attendedDays: AttendedDayItem[] = [];
  const absentDays: AttendedDayItem[] = [];

  // Helper to format date
  const parseDateDetails = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dt = new Date(y, m, d, 12, 0, 0);
        return {
          formattedDate: dt.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          dayOfWeek: dt.toLocaleDateString('en-US', { weekday: 'short' }),
          monthDay: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        };
      }
    } catch {
      // ignore
    }
    return {
      formattedDate: dateStr,
      dayOfWeek: 'TBD',
      monthDay: dateStr,
    };
  };

  filteredLogs.forEach((log) => {
    const isPresent =
      Array.isArray(log.presentPlayerNums) && log.presentPlayerNums.includes(playerNum);
    const sessionHours = Number(log.hours || 0);
    const wk = normalizeWeekKey(log.week, log.date);
    const isPre = wk.startsWith('pre-') || wk === '0';
    const attire =
      log.playerSessionTypes?.[playerNum] || log.sessionType || 'conditioning';

    const { formattedDate, dayOfWeek, monthDay } = parseDateDetails(log.date);

    let weekLabel = wk;
    if (seasonConfig?.customWeekLabels?.[wk]) {
      weekLabel = seasonConfig.customWeekLabels[wk];
    } else if (isPre) {
      const num = wk.replace('pre-', '');
      weekLabel = `Pre-Season Wk ${num}`;
    } else if (wk === 'playoffs') {
      weekLabel = 'Playoffs';
    } else if (wk === 'championship') {
      weekLabel = 'Championship';
    } else {
      weekLabel = `Week ${wk}`;
    }

    if (isPresent && sessionHours > 0) {
      runningTotal = Math.round((runningTotal + sessionHours) * 10) / 10;
      if (attire === 'conditioning') {
        condSum += sessionHours;
      } else {
        padSum += sessionHours;
      }
    }

    const dayItem: AttendedDayItem = {
      id: log.id,
      date: log.date,
      formattedDate,
      dayOfWeek,
      monthDay,
      weekKey: wk,
      weekLabel,
      isPreSeason: isPre,
      title: log.title || 'Practice Session',
      location: log.location,
      sessionType: log.sessionType || 'padded',
      playerAttire: attire,
      hours: sessionHours,
      notes: log.notes,
      wasPresent: isPresent,
      runningTotal,
    };

    days.push(dayItem);
    if (isPresent) {
      attendedDays.push(dayItem);
    } else {
      absentDays.push(dayItem);
    }
  });

  let totalHours = Math.round(runningTotal * 10) / 10;
  let conditioningHours = Math.min(10, Math.round(condSum * 10) / 10);
  let paddedHours = Math.min(10, Math.round(padSum * 10) / 10);

  // Reconcile with calculatePlayerHours in case player has baseline pre-logged hours
  const calc = calculatePlayerHours(player, allLogs, cleanSelectedWeek, seasonConfig);
  let targetHours = calc.totalSeasonHours;
  if (scope === 'preseason') {
    targetHours = Math.round(
      ((calc.weeklyHours['pre-1'] || 0) +
        (calc.weeklyHours['pre-2'] || 0) +
        (calc.weeklyHours['pre-3'] || 0) +
        (calc.weeklyHours['pre-4'] || 0)) *
        10
    ) / 10;
  } else if (scope === 'this_week' || scope === 'week') {
    targetHours = calc.thisWeekHours;
  }

  let baselineHours = 0;
  const diff = Math.round((targetHours - totalHours) * 10) / 10;
  if (diff > 0) {
    baselineHours = diff;
    const baselineItem: AttendedDayItem = {
      id: 'baseline_initial_log',
      date: 'Prior',
      formattedDate: 'Pre-Season Initial Baseline',
      dayOfWeek: 'Log',
      monthDay: 'Prior',
      weekKey: 'baseline',
      weekLabel: 'Baseline Log',
      isPreSeason: true,
      title: 'Prior Recorded / Transfer Practice Hours',
      location: 'Official Roster Record',
      sessionType: 'conditioning',
      playerAttire: 'conditioning',
      hours: diff,
      notes: 'Initial verified practice balance on team record',
      wasPresent: true,
      runningTotal: diff,
    };

    days.unshift(baselineItem);
    attendedDays.unshift(baselineItem);

    // Offset subsequent running totals
    let currentSum = diff;
    for (let i = 1; i < attendedDays.length; i++) {
      currentSum = Math.round((currentSum + attendedDays[i].hours) * 10) / 10;
      attendedDays[i].runningTotal = currentSum;
    }
    totalHours = targetHours;
    conditioningHours = calc.conditioningHours;
    paddedHours = calc.paddedHours;
  }

  const attendedSessionsCount = attendedDays.length;
  const totalSessionsCount = days.length;
  const attendanceRate =
    totalSessionsCount > 0 ? Math.round((attendedSessionsCount / totalSessionsCount) * 100) : 100;

  // Build formula equation string, e.g.:
  // "Aug 3 (2.5h) + Aug 4 (2.5h) + ... = 25.0 hrs Total"
  const formulaEquation =
    attendedDays.length > 0
      ? attendedDays.map((d) => `${d.monthDay} (${d.hours}h)`).join(' + ') +
        ` = ${totalHours.toFixed(1)} hrs`
      : '0.0 hrs';

  let scopeLabel = 'All Season Practices';
  if (scope === 'preseason') {
    scopeLabel = 'Pre-Season Practices';
  } else if (scope === 'this_week' || scope === 'week') {
    scopeLabel = `Week ${cleanSelectedWeek} Practices`;
  }

  return {
    player,
    scope,
    selectedWeekKey: cleanSelectedWeek,
    scopeLabel,
    days,
    attendedDays,
    absentDays,
    totalHours,
    conditioningHours,
    paddedHours,
    attendedSessionsCount,
    totalSessionsCount,
    attendanceRate,
    formulaEquation,
    baselineHours,
  };
}
