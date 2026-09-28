// Every practice on a team's schedule gets a practice plan: its date, start / end time, location and
// week, with the practice template picked for that weekday. A team's first schedule (e.g. from
// TeamSnap) fills the practice planner straight away.
import type { PracticePeriod, PracticePlan, ScheduleEvent } from '../types';
import { getFormattedDayFolder, resolvePracticeTemplateForWeekday } from './practiceUtils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const sameTeam = (a?: string, b?: string) => String(a || 'team_10u').toLowerCase().replace(/-/g, '_') === String(b || 'team_10u').toLowerCase().replace(/-/g, '_');

/** The plan id for a practice, the same on every coach's device (so two devices never make two). */
export const planIdForEvent = (eventId: string) => `prac_evt_${String(eventId).replace(/[^a-zA-Z0-9_-]/g, '')}`;

export function dayOfWeekFor(date?: string, fallback = 'Wednesday'): string {
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return fallback;
  return DAY_NAMES[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getDay()];
}

/** "pre-1" -> "Preseason Wk 1", "3" -> "Week 3" (the planner's week folders). */
export function practiceWeekFolder(rawWeek?: string): string {
  const w = String(rawWeek ?? '1').trim();
  const lw = w.toLowerCase();
  if (w === '0' || lw.includes('pre-1') || lw.includes('pre1')) return 'Preseason Wk 1';
  if (lw.includes('pre-2') || lw.includes('pre2')) return 'Preseason Wk 2';
  if (lw.startsWith('week')) return w;
  if (lw.includes('pre')) return 'Preseason Wk 1';
  return `Week ${w}`;
}

const isPractice = (e: ScheduleEvent) => (e.type === 'practice' || !e.type) && !e.isCancelled;

/**
 * Plans for the team's practices that don't have one yet. A practice counts as having a plan when
 * one is linked to it, when the team already has a plan that day, or when its plan was deleted on
 * purpose (never brought back).
 */
export function missingPracticePlans(opts: {
  teamId: string;
  events: ScheduleEvent[];
  plans: PracticePlan[];
  deletedPlanIds?: string[];
  templates: Record<string, PracticePeriod[]>;
  weekdayTemplates?: Record<string, string>;
  /** Only practices on or after this day (YYYY-MM-DD); past practices already happened. */
  fromDate?: string;
}): PracticePlan[] {
  const teamPlans = (opts.plans || []).filter((p) => p && sameTeam(p.teamId, opts.teamId));
  const planIds = new Set(teamPlans.map((p) => p.id));
  const planDates = new Set(teamPlans.map((p) => String(p.date || '').slice(0, 10)).filter(Boolean));
  const deleted = new Set(opts.deletedPlanIds || []);
  const templateNames = Object.keys(opts.templates || {});
  const out: PracticePlan[] = [];
  for (const e of opts.events || []) {
    if (!e || !sameTeam(e.teamId, opts.teamId) || !isPractice(e) || !e.date) continue;
    const id = planIdForEvent(e.id);
    const linked = e.linkedPracticePlanId;
    if (planIds.has(id) || (linked && planIds.has(linked))) continue;
    if (deleted.has(id) || (linked && deleted.has(linked))) continue;
    const date = String(e.date).slice(0, 10);
    if (opts.fromDate && date < opts.fromDate) continue;
    if (planDates.has(date)) continue;
    const day = e.dayOfWeek || dayOfWeekFor(date);
    const templateName = resolvePracticeTemplateForWeekday(day, opts.weekdayTemplates, templateNames, 'Standard Practice');
    const periods: PracticePeriod[] = JSON.parse(JSON.stringify(opts.templates?.[templateName] || []));
    const weekFolder = practiceWeekFolder(e.week);
    out.push({
      id,
      teamId: opts.teamId,
      year: date.slice(0, 4),
      weekFolder,
      dayFolder: getFormattedDayFolder(date) || day,
      title: e.title || `${weekFolder} Practice`,
      date,
      day,
      startTime: e.startTime || e.time || '17:30',
      endTime: e.endTime || '19:00',
      location: e.location || '',
      ...(e.isNonPractice ? { isNonPractice: true } : {}),
      // As good as never edited (the earliest time): any plan a coach has filled in wins over this
      // one when devices merge, and saves don't re-stamp it as new.
      lastEdited: 1,
      createdAt: Date.now(),
      plan: periods,
      periods: JSON.parse(JSON.stringify(periods)),
    });
    planDates.add(date);
  }
  return out;
}
