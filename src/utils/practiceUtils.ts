import { PracticePlan, PracticePeriod, ScheduleEvent } from '../types';

/** Local calendar YYYY-MM-DD (not UTC ISO, which flips after ~8pm EDT). */
export function getLocalDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function practiceDateKey(date?: string | null): string {
  if (!date) return '';
  return String(date).split('T')[0];
}

/** How filled-in a plan is, so a blank auto-seed does not beat a real shared plan. */
export function practiceFillScore(plan?: PracticePlan | null): number {
  if (!plan) return 0;
  const periods =
    (Array.isArray(plan.plan) && plan.plan.length > 0 ? plan.plan : plan.periods) || [];
  let score = 0;
  for (const period of periods) {
    if (!period) continue;
    for (const station of period.stations || []) {
      if (!station) continue;
      const name = String(station.name || '').trim();
      const desc = String(station.desc || '').trim();
      const coach = String(station.coach || '').trim();
      const focus = String(station.focus || '').trim();
      if (!name && !desc && !coach && !focus) continue;
      if (name) score += 3;
      if (desc) score += 2;
      if (coach) score += 1;
      if (focus) score += 1;
    }
  }
  return score;
}

/**
 * Derives the standard day of week name from a 'YYYY-MM-DD' date string.
 */
export function getDayOfWeekForDate(dateStr?: string): string {
  if (!dateStr) return 'Wednesday';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return 'Wednesday';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return 'Wednesday';

  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dayNames[dt.getDay()] || 'Wednesday';
}

/**
 * Returns formatted short day folder e.g. "Monday 8/31", "Tuesday 9/01"
 */
export function getFormattedDayFolder(dateStr?: string): string {
  if (!dateStr) return 'Day 1';
  const dayName = getDayOfWeekForDate(dateStr);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const padD = d < 10 ? `0${d}` : `${d}`;
    return `${dayName} ${m}/${padD}`;
  }
  return dayName;
}

/**
 * Accurate Week Folder calculation based on 2026 Youth Football Season Calendar:
 * - Preseason Wk 1: Dates before August 31, 2026 (e.g. 8/25, 8/27, 8/29 Scrimmage)
 * - Week 1: August 31 to September 6, 2026 (Game 1 vs Carmel on 9/05)
 * - Week 2: September 7 to September 13, 2026 (Game 2 vs Somers on 9/12)
 * - Week 3: September 14 to September 20, 2026 (Game 3 vs Yorktown on 9/19)
 * - Week 4: September 21 to September 27, 2026 (Homecoming vs Brewster on 9/26)
 * - Week 5: September 28 to October 4, 2026 (Game 5 vs John Jay on 10/03)
 * - Week 6: October 5 to October 11, 2026 (Senior Night vs Lakeland on 10/10)
 * - Week 7: October 12 to October 18, 2026 (Season Finale vs Arlington on 10/17)
 * - Week 8: October 19 to October 25, 2026 (Playoffs Round 1 on 10/24)
 * - Post-Season: After October 25, 2026 (Championship Bowl)
 */
export function calculateWeekFolderForDate(
  dateStr?: string,
  scheduleEvents?: ScheduleEvent[]
): string {
  if (!dateStr) return 'Week 1';

  // 1. Check if there's a scheduled game or practice with an explicit week on this exact date
  if (scheduleEvents && scheduleEvents.length > 0) {
    const matchEvent = scheduleEvents.find((e) => e && e.date === dateStr);
    if (matchEvent && matchEvent.week !== undefined) {
      const rawWk = String(matchEvent.week).trim();
      if (rawWk === '0' || rawWk.toLowerCase().includes('pre-1') || rawWk.toLowerCase().includes('pre1')) {
        return 'Preseason Wk 1';
      }
      if (rawWk.toLowerCase().includes('pre-2') || rawWk.toLowerCase().includes('pre2')) {
        return 'Preseason Wk 2';
      }
      if (rawWk.toLowerCase().startsWith('week')) {
        return rawWk;
      }
      if (rawWk.toLowerCase().includes('playoff')) {
        return 'Week 8';
      }
      if (rawWk.toLowerCase().includes('championship')) {
        return 'Championship';
      }
      if (!isNaN(parseInt(rawWk, 10))) {
        return `Week ${parseInt(rawWk, 10)}`;
      }
    }
  }

  // 2. Canonical 2026 dates boundary check (Weeks start on Monday)
  const cleanDate = dateStr.trim();
  if (cleanDate >= '2026-08-24' && cleanDate <= '2026-08-30') {
    return 'Preseason Wk 4';
  }
  if (cleanDate >= '2026-08-17' && cleanDate <= '2026-08-23') {
    return 'Preseason Wk 3';
  }
  if (cleanDate >= '2026-08-10' && cleanDate <= '2026-08-16') {
    return 'Preseason Wk 2';
  }
  if (cleanDate <= '2026-08-09') {
    return 'Preseason Wk 1';
  }
  if (cleanDate >= '2026-08-31' && cleanDate <= '2026-09-06') {
    return 'Week 1';
  }
  if (cleanDate >= '2026-09-07' && cleanDate <= '2026-09-13') {
    return 'Week 2';
  }
  if (cleanDate >= '2026-09-14' && cleanDate <= '2026-09-20') {
    return 'Week 3';
  }
  if (cleanDate >= '2026-09-21' && cleanDate <= '2026-09-27') {
    return 'Week 4';
  }
  if (cleanDate >= '2026-09-28' && cleanDate <= '2026-10-04') {
    return 'Week 5';
  }
  if (cleanDate >= '2026-10-05' && cleanDate <= '2026-10-11') {
    return 'Week 6';
  }
  if (cleanDate >= '2026-10-12' && cleanDate <= '2026-10-18') {
    return 'Week 7';
  }
  if (cleanDate >= '2026-10-19' && cleanDate <= '2026-10-25') {
    return 'Week 8';
  }
  if (cleanDate > '2026-10-25') {
    return 'Championship';
  }

  // Generic fallback for future years: Monday-Sunday week based calculation
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      // Base date: first Monday of August
      const baseYear = dt.getFullYear();
      const seasonStart = new Date(baseYear, 7, 24); // Aug 24
      const diffDays = Math.floor((dt.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) return 'Preseason Wk 1';
      const weekNum = Math.floor(diffDays / 7);
      return `Week ${Math.min(weekNum, 10)}`;
    }
  } catch (e) {
    // Ignore fallback errors
  }

  return 'Week 1';
}

export interface PracticeSequenceInfo {
  practiceNumber: number | null; // 1-based sequential number from start of season (8/3) among active practices, or null if cancelled/non-practice
  isCancelled: boolean;
  isNonPractice: boolean;
  totalActivePractices: number;
  totalCancelledPractices: number;
  totalNonPracticeEvents: number;
  isPast: boolean;
  displayDayLabel: string; // e.g. "Day 1", "Day 2", "Cancelled", "Non-Practice"
  fullBadgeLabel: string; // e.g. "Practice Day #1", "Cancelled (Not Counted)", "Non-Practice (Not Counted)"
  formattedTitle: string; // e.g. "Practice Day 1 - 8/3", "Practice Day 23 - 9/22"
}

/**
 * Standardizes practice titles to "Practice Day ## - M/D" (or Cancelled/Non-Practice).
 */
export function formatPracticeDayTitle(
  dayNum: number | null,
  dateStr: string,
  isCancelled?: boolean,
  isNonPractice?: boolean,
  customTitle?: string
): string {
  let mDate = '';
  if (dateStr) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(m) && !isNaN(d)) {
        mDate = `${m}/${d}`;
      }
    }
  }

  if (isCancelled) {
    return mDate ? `[Cancelled] Practice Day - ${mDate}` : `[Cancelled] Practice Day`;
  }
  if (isNonPractice) {
    return customTitle && !customTitle.toLowerCase().startsWith('week ')
      ? customTitle
      : mDate
      ? `Non-Practice Event - ${mDate}`
      : `Non-Practice Event`;
  }
  if (dayNum !== null && dayNum !== undefined) {
    return mDate ? `Practice Day ${dayNum} - ${mDate}` : `Practice Day ${dayNum}`;
  }
  return mDate ? `Practice Day - ${mDate}` : `Practice Day`;
}

/**
 * Calculates real-time dynamic practice numbering across the season starting from 8/3 (Day 1).
 * - Season begins on 2026-08-03 as Day 1.
 * - Non-cancelled, non-clinic practices are sorted chronologically by date and assigned sequential numbers: 1, 2, 3, ...
 * - Events marked as non-practice or cancelled are excluded from the practice count.
 * - If any practice is cancelled or marked non-practice, all subsequent practices automatically re-number consecutively.
 */
export function getPracticeSequenceMap(
  practices: PracticePlan[],
  scheduleEvents?: ScheduleEvent[],
  todayStr: string = getLocalDateKey()
): Record<string, PracticeSequenceInfo> {
  const result: Record<string, PracticeSequenceInfo> = {};

  interface PracticeSessionBucket {
    date: string;
    time: string;
    planIds: string[];
    eventIds: string[];
    isCancelled: boolean;
    isNonPractice: boolean;
    originalTitle?: string;
  }

  const sessionMap = new Map<string, PracticeSessionBucket>();

  // 1. Process Schedule Events from start of season
  if (Array.isArray(scheduleEvents)) {
    scheduleEvents.forEach((e) => {
      if (!e || !e.date) return;
      const cleanDate = e.date.split('T')[0];

      // Any event before August 3, 2026 (e.g. July 16 clinic) is a pre-season clinic / non-practice
      const isBeforeSeason = cleanDate < '2026-08-03';
      const isGameOrScrimmage = e.type === 'game' || e.type === 'tournament' || e.type === 'scrimmage';
      const isMeeting = e.type === 'meeting';

      const isNonPractice = Boolean(
        e.isNonPractice ||
        isBeforeSeason ||
        isGameOrScrimmage ||
        isMeeting
      );

      const isPracticeType = e.type === 'practice' || e.type === 'walkthrough' || Boolean(e.linkedPracticePlanId);
      if (!isPracticeType && !isNonPractice) return;

      const key = cleanDate;
      const existing = sessionMap.get(key);
      if (existing) {
        if (!existing.eventIds.includes(e.id)) existing.eventIds.push(e.id);
        if (e.linkedPracticePlanId && !existing.planIds.includes(e.linkedPracticePlanId)) {
          existing.planIds.push(e.linkedPracticePlanId);
        }
        if (e.isCancelled) existing.isCancelled = true;
        if (e.isNonPractice) existing.isNonPractice = true;
        if (e.startTime && !existing.time) existing.time = e.startTime;
      } else {
        sessionMap.set(key, {
          date: cleanDate,
          time: e.startTime || '17:30',
          planIds: e.linkedPracticePlanId ? [e.linkedPracticePlanId] : [],
          eventIds: [e.id],
          isCancelled: Boolean(e.isCancelled),
          isNonPractice,
          originalTitle: e.title,
        });
      }
    });
  }

  // 2. Process Practice Plans
  if (Array.isArray(practices)) {
    practices.forEach((p) => {
      if (!p || !p.id) return;
      if (p.id === 'p_w3_2') return;

      const cleanDate = p.date ? p.date.split('T')[0] : '';
      const isBeforeSeason = cleanDate ? cleanDate < '2026-08-03' : false;
      const isPregame = Boolean(
        p.title?.toLowerCase().includes('pre-game') ||
        p.title?.toLowerCase().includes('warmup') ||
        p.id.includes('pregame')
      );

      const isNonPractice = Boolean(
        p.isNonPractice ||
        isBeforeSeason ||
        isPregame
      );

      const key = cleanDate || p.id;
      const existing = sessionMap.get(key);
      if (existing) {
        if (!existing.planIds.includes(p.id)) existing.planIds.push(p.id);
        if (p.isCancelled) existing.isCancelled = true;
        if (p.isNonPractice) existing.isNonPractice = true;
        if (p.startTime && !existing.time) existing.time = p.startTime;
      } else {
        sessionMap.set(key, {
          date: cleanDate || '1970-01-01',
          time: p.startTime || '17:30',
          planIds: [p.id],
          eventIds: [],
          isCancelled: Boolean(p.isCancelled),
          isNonPractice,
          originalTitle: p.title,
        });
      }
    });
  }

  // Sort sessions chronologically
  const sortedSessions = Array.from(sessionMap.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.time !== b.time) return a.time.localeCompare(b.time);
    return 0;
  });

  // Calculate totals
  let activeCount = 0;
  let cancelledCount = 0;
  let nonPracticeCount = 0;

  sortedSessions.forEach((s) => {
    if (s.isCancelled) {
      cancelledCount++;
    } else if (s.isNonPractice) {
      nonPracticeCount++;
    } else {
      activeCount++;
    }
  });

  // Assign sequential day numbers
  let currentSequence = 0;

  sortedSessions.forEach((s) => {
    const isPast = Boolean(s.date && s.date < todayStr);

    let info: PracticeSequenceInfo;

    if (s.isCancelled) {
      const formattedTitle = formatPracticeDayTitle(null, s.date, true, false);
      info = {
        practiceNumber: null,
        isCancelled: true,
        isNonPractice: false,
        totalActivePractices: activeCount,
        totalCancelledPractices: cancelledCount,
        totalNonPracticeEvents: nonPracticeCount,
        isPast,
        displayDayLabel: 'Cancelled',
        fullBadgeLabel: 'Cancelled (Not Counted)',
        formattedTitle,
      };
    } else if (s.isNonPractice) {
      const formattedTitle = formatPracticeDayTitle(null, s.date, false, true, s.originalTitle);
      info = {
        practiceNumber: null,
        isCancelled: false,
        isNonPractice: true,
        totalActivePractices: activeCount,
        totalCancelledPractices: cancelledCount,
        totalNonPracticeEvents: nonPracticeCount,
        isPast,
        displayDayLabel: 'Non-Practice',
        fullBadgeLabel: 'Non-Practice (Not Counted)',
        formattedTitle,
      };
    } else {
      currentSequence++;
      const num = currentSequence;
      const formattedTitle = formatPracticeDayTitle(num, s.date, false, false);
      info = {
        practiceNumber: num,
        isCancelled: false,
        isNonPractice: false,
        totalActivePractices: activeCount,
        totalCancelledPractices: cancelledCount,
        totalNonPracticeEvents: nonPracticeCount,
        isPast,
        displayDayLabel: `Day ${num}`,
        fullBadgeLabel: `Practice Day #${num}`,
        formattedTitle,
      };
    }

    s.planIds.forEach((pid) => {
      result[pid] = info;
    });
    s.eventIds.forEach((eid) => {
      result[eid] = info;
    });
    if (s.date) {
      result[s.date] = info;
    }
  });

  return result;
}

function normalizeCoachName(coach?: string): string {
  if (!coach) return '';
  return coach.trim();
}

/**
 * Sanitizes and repairs practice plan entries:
 * 1. Standardizes practice titles to "Practice Day ## - M/D" (no weird names)
 * 2. Preserves cancellation and non-practice exclusions
 * 3. Dates match true weekFolder and dayFolder
 */
export function sanitizePracticePlans(
  plans: PracticePlan[],
  scheduleEvents?: ScheduleEvent[]
): PracticePlan[] {
  if (!Array.isArray(plans)) return [];

  // Get sequence map across all plans and schedule events
  const seqMap = getPracticeSequenceMap(plans, scheduleEvents);

  return plans
    .filter((p): p is PracticePlan => {
      if (!p || typeof p !== 'object') return false;
      // Filter out deprecated sample plan p_w3_2 hardcoded on 9/17
      if (p.id === 'p_w3_2') return false;
      if (p.title && p.title.toLowerCase().includes('situational 2-minute') && p.date && p.date.includes('09-17')) return false;
      if (p.title === 'Week 3 - Situational 2-Minute & Scrimmage') return false;
      return true;
    })
    .map((p) => {
      const dateStr = p.date || '';
      const correctDay = p.day || (dateStr ? getDayOfWeekForDate(dateStr) : 'Wednesday');
      const correctWeek = p.weekFolder || (dateStr ? calculateWeekFolderForDate(dateStr, scheduleEvents) : 'Week 1');
      const correctDayFolder = p.dayFolder || (dateStr ? getFormattedDayFolder(dateStr) : (p.day || 'Day 1'));

      const seq = seqMap[p.id] || (dateStr ? seqMap[dateStr] : undefined);
      let standardizedTitle = p.title || 'Practice Day';

      const isPregame = Boolean(
        p.title?.toLowerCase().includes('pre-game') ||
        p.title?.toLowerCase().includes('warmup') ||
        p.id.includes('pregame')
      );

      if (seq && !isPregame) {
        standardizedTitle = seq.formattedTitle;
      }

      const rawPeriods = Array.isArray(p.plan) && p.plan.length > 0
        ? p.plan
        : Array.isArray(p.periods) && p.periods.length > 0
        ? p.periods
        : [];

      const sanitizedPeriods = rawPeriods
        .filter((period) => Boolean(period && typeof period === 'object'))
        .map((period) => {
          const rawStations = Array.isArray(period.stations) ? period.stations : [];
          const validStations = rawStations
            .filter((st) => Boolean(st && typeof st === 'object'))
            .map((st) => ({
              name: st?.name || '',
              desc: st?.desc || '',
              focus: st?.focus || '',
              coach: (st?.coach || '').trim(),
            }));

          return {
            ...period,
            time: Number(period.time) || 0,
            category: period.category || '',
            format: period.format || 'static',
            stations: validStations.length > 0 ? validStations : [{ name: '', desc: '', coach: '', focus: '' }],
          };
        });

      return {
        ...p,
        title: standardizedTitle,
        practiceNumber: seq?.practiceNumber || p.practiceNumber,
        isCancelled: Boolean(p.isCancelled || seq?.isCancelled),
        isNonPractice: Boolean(p.isNonPractice || seq?.isNonPractice),
        teamId: p.teamId === 'team-10u' ? 'team_10u' : (p.teamId || 'team_10u'),
        day: correctDay,
        dayFolder: correctDayFolder,
        weekFolder: correctWeek,
        plan: sanitizedPeriods,
        periods: sanitizedPeriods,
      };
    });
}

function rankTodayPracticePlans(todayPlans: PracticePlan[]): PracticePlan[] {
  return [...todayPlans].sort((a, b) => {
    const fill = practiceFillScore(b) - practiceFillScore(a);
    if (fill !== 0) return fill;
    return (b.lastEdited || b.createdAt || 0) - (a.lastEdited || a.createdAt || 0);
  });
}

/**
 * Intelligently finds the most relevant/active practice plan ID to display:
 * 1. Today's date, preferring a filled shared plan over a blank auto-seed
 * 2. Matches requested preferredId if it is still in the list
 * 3. Most recently edited practice plan (highest lastEdited timestamp in the last 7 days)
 * 4. Closest upcoming practice plan (date >= today)
 * 5. Practice in the active week folder
 * 6. Latest created/chronological practice plan (never falls back to an arbitrary ancient index 0)
 */
export function findBestActivePracticeId(
  practices: PracticePlan[],
  preferredId?: string | null,
  currentWeekFolder?: string
): string | null {
  if (!Array.isArray(practices) || practices.length === 0) return null;

  // Filter out invalid or deprecated sample plans
  const validPractices = practices.filter(
    (p) => p && p.id && p.id !== 'p_w3_2' && p.title !== 'Week 3 - Situational 2-Minute & Scrimmage'
  );
  if (validPractices.length === 0) return null;

  const todayStr = getLocalDateKey();

  // 1. Today's plans: filled shared plan wins over a newer empty seed
  const todayPlans = rankTodayPracticePlans(
    validPractices.filter((p) => practiceDateKey(p.date) === todayStr && !p.isCancelled)
  );

  if (todayPlans.length > 0) {
    const preferredToday = preferredId
      ? todayPlans.find((p) => p.id === preferredId)
      : undefined;
    const bestFilled = todayPlans[0];
    if (preferredToday) {
      const preferredFill = practiceFillScore(preferredToday);
      const bestFill = practiceFillScore(bestFilled);
      if (preferredFill > 0 && preferredFill + 4 >= bestFill) {
        return preferredToday.id;
      }
    }
    return bestFilled.id;
  }

  // 2. If preferredId is provided and exists in the practice list, use it
  if (preferredId && preferredId !== 'p_w3_2') {
    const found = validPractices.find((p) => p && p.id === preferredId);
    if (found) return found.id;
  }

  // 3. Check for the most recently edited practice plan
  const sortedByRecentEdit = [...practices]
    .filter((p) => p && typeof p.lastEdited === 'number' && p.lastEdited > 0)
    .sort((a, b) => (b.lastEdited || 0) - (a.lastEdited || 0));

  if (sortedByRecentEdit.length > 0) {
    const mostRecent = sortedByRecentEdit[0];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if ((mostRecent.lastEdited || 0) > sevenDaysAgo) {
      return mostRecent.id;
    }
  }

  // 4. Check for the closest upcoming practice (date >= today)
  const upcomingPractices = practices
    .filter((p) => p && practiceDateKey(p.date) >= todayStr && !p.isCancelled)
    .sort((a, b) => practiceDateKey(a.date).localeCompare(practiceDateKey(b.date)));
  if (upcomingPractices.length > 0) {
    return upcomingPractices[0].id;
  }

  // 5. Check if there's a practice in currentWeekFolder
  if (currentWeekFolder) {
    const weekPlans = practices
      .filter((p) => p && p.weekFolder === currentWeekFolder && !p.isCancelled)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (weekPlans.length > 0) {
      return weekPlans[0].id;
    }
  }

  // 6. If any recent edit exists at all, use it
  if (sortedByRecentEdit.length > 0) {
    return sortedByRecentEdit[0].id;
  }

  // 7. Otherwise, latest chronological date first
  const sortedChronological = [...practices].sort((a, b) => {
    const dA = a.date || '0000-00-00';
    const dB = b.date || '0000-00-00';
    return dB.localeCompare(dA);
  });

  return sortedChronological[0]?.id || practices[0]?.id || null;
}

/** Switch off a blank auto-seed / stale id onto the filled shared plan for today. */
export function shouldSwitchToSharedTodayPlan(
  mergedPlans: PracticePlan[],
  activeId?: string | null,
  currentWeekFolder?: string
): string | null {
  const bestId = findBestActivePracticeId(mergedPlans, activeId, currentWeekFolder);
  if (!bestId) return null;
  if (!activeId || !mergedPlans.some((p) => p && p.id === activeId)) return bestId;
  const current = mergedPlans.find((p) => p && p.id === activeId);
  const best = mergedPlans.find((p) => p && p.id === bestId);
  if (!current || !best || current.id === best.id) return null;
  if (practiceDateKey(best.date) !== getLocalDateKey()) return null;
  if (practiceFillScore(best) > practiceFillScore(current)) return best.id;
  return null;
}

export const PRACTICE_WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type PracticeWeekdayTemplateMap = Partial<Record<(typeof PRACTICE_WEEKDAY_NAMES)[number], string>>;

export function normalizePracticeWeekdayTemplates(raw: unknown): PracticeWeekdayTemplateMap {
  const out: PracticeWeekdayTemplateMap = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const day of PRACTICE_WEEKDAY_NAMES) {
    const val = String(src[day] || src[day.toLowerCase()] || '').trim();
    if (val) out[day] = val;
  }
  return out;
}

export function mergePracticeWeekdayTemplates(
  localRaw?: unknown,
  remoteRaw?: unknown
): PracticeWeekdayTemplateMap {
  const local = normalizePracticeWeekdayTemplates(localRaw);
  const remote = normalizePracticeWeekdayTemplates(remoteRaw);
  return { ...local, ...remote };
}

export function resolvePracticeTemplateForWeekday(
  dayName: string | undefined,
  weekdayMap: PracticeWeekdayTemplateMap | undefined,
  templateNames: string[],
  fallback = 'Standard Practice'
): string {
  const canonical = PRACTICE_WEEKDAY_NAMES.find(
    (day) => day.toLowerCase() === String(dayName || '').trim().toLowerCase()
  );
  const mapped = canonical ? String(weekdayMap?.[canonical] || '').trim() : '';
  if (mapped && templateNames.includes(mapped)) return mapped;
  if (templateNames.includes(fallback)) return fallback;
  return templateNames[0] || fallback;
}

export function practiceSeasonYear(plan?: PracticePlan | null, fallbackYear?: string): string {
  const fromDate = practiceDateKey(plan?.date).slice(0, 4);
  if (fromDate) return fromDate;
  const fromPlan = String(plan?.year || '').trim();
  if (fromPlan) return fromPlan;
  return String(fallbackYear || getLocalDateKey().slice(0, 4));
}

export function practiceWeekdayName(plan?: PracticePlan | null): string {
  if (practiceDateKey(plan?.date)) return getDayOfWeekForDate(plan?.date);
  const named = PRACTICE_WEEKDAY_NAMES.find(
    (day) => day.toLowerCase() === String(plan?.day || '').trim().toLowerCase()
  );
  return named || 'Wednesday';
}

export function isPreGamePracticePlan(plan?: PracticePlan | null): boolean {
  const title = String(plan?.title || '').toLowerCase();
  return title.includes('pre-game') || title.includes('warmup');
}

function samePracticeTeam(planTeamId?: string, activeTeamId?: string): boolean {
  if (!planTeamId || !activeTeamId) return true;
  if (planTeamId === activeTeamId) return true;
  const tenU = new Set(['team_10u', 'team-10u']);
  return tenU.has(planTeamId) && tenU.has(activeTeamId);
}

export function shouldApplyWeekdayTemplateToPlan(
  plan: PracticePlan | null | undefined,
  opts: {
    weekday: string;
    year: string;
    today?: string;
    teamId?: string;
  }
): boolean {
  if (!plan || plan.isCancelled) return false;
  if (isPreGamePracticePlan(plan)) return false;
  if (!samePracticeTeam(plan.teamId, opts.teamId)) return false;
  if (practiceSeasonYear(plan, opts.year) !== String(opts.year)) return false;
  if (practiceWeekdayName(plan) !== opts.weekday) return false;
  const key = practiceDateKey(plan.date);
  if (!key) return false;
  return key >= (opts.today || getLocalDateKey());
}

export function countUpcomingWeekdayPlans(
  plans: PracticePlan[] | undefined,
  weekday: string,
  opts: { year: string; today?: string; teamId?: string }
): number {
  return (plans || []).filter((plan) => shouldApplyWeekdayTemplateToPlan(plan, { weekday, ...opts })).length;
}

export function getPlanPeriods(p: PracticePlan): PracticePeriod[] {
  if (Array.isArray(p.plan) && p.plan.length > 0) return p.plan;
  if (Array.isArray(p.periods) && p.periods.length > 0) return p.periods;
  if (Array.isArray(p.plan)) return p.plan;
  if (Array.isArray(p.periods)) return p.periods;
  return [];
}
