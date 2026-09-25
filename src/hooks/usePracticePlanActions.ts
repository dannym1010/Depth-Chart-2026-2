import {
  getLocalDateKey,
  getDayOfWeekForDate,
  getFormattedDayFolder,
  calculateWeekFolderForDate,
  resolvePracticeTemplateForWeekday,
  practiceSeasonYear,
  shouldApplyWeekdayTemplateToPlan,
  findBestActivePracticeId,
  practiceWeekdayName,
  getPlanPeriods,
} from '../utils/practiceUtils';
import { DEFAULT_PRACTICE_TEMPLATES } from '../data/initialData';
import {
  PracticePlan,
  ScheduleEvent,
  PracticeStation,
  DrillItem,
} from '../types';
import type {
  PracticePeriod,
  UnitType,
  AttendanceRecord,
  SeasonConfig,
  DrillFolder,
} from '../types';
import {
  deepClone,
  safeJSONSet,
  formatTimeMinutes,
  parseTimeString,
} from '../services/storageService';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { LatestAppState } from './appStateTypes';

export interface PracticePlanActionsDeps {
  scheduleEvents: ScheduleEvent[];
  practiceData: PracticePlan[];
  latestStateRef: RefObject<LatestAppState>;
  practiceTemplates: Record<string, PracticePeriod[]>;
  practiceWeekdayTemplates: Partial<Record<"Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday", string>>;
  activeTeamId: string;
  updatePracticeDataAndSave: (updater: (prev: PracticePlan[]) => PracticePlan[], immediate?: boolean, modifiedPlanId?: string) => void;
  setCurrentPracticeId: Dispatch<SetStateAction<string>>;
  currentPracticeId: string;
  setScheduleEvents: Dispatch<SetStateAction<ScheduleEvent[]>>;
  debouncedSave: (scope?: string, extraMeta?: Record<string, any>) => void;
  handleSyncPracticeToPlan: (event: ScheduleEvent, templateName?: string) => string;
  ensureWeekExists: (week: string, sourceWeek?: string) => void;
  changeCurrentWeek: (wk: string) => void;
  setActiveUnit: (action: SetStateAction<UnitType>) => void;
  attendanceLogs: AttendanceRecord[];
  setDeletedPracticePlanIds: Dispatch<SetStateAction<string[]>>;
  handleDeleteScheduleEvent: (id: string) => void;
  setAttendanceLogs: Dispatch<SetStateAction<AttendanceRecord[]>>;
  flushAndSaveStateToStorage: (scope?: string, extraMeta?: Record<string, any>) => Promise<void>;
  seasonConfig: SeasonConfig;
  activeTeamPracticeData: PracticePlan[];
  lastLocalEditTimeRef: RefObject<number>;
  setPracticeTemplates: Dispatch<SetStateAction<Record<string, PracticePeriod[]>>>;
  currentPracticeIdRef: RefObject<string>;
  cascadingDrills: DrillFolder[];
}

// Practice plans: create, edit, cancel, delete, templates, periods, and stations.
export function usePracticePlanActions({
  scheduleEvents,
  practiceData,
  latestStateRef,
  practiceTemplates,
  practiceWeekdayTemplates,
  activeTeamId,
  updatePracticeDataAndSave,
  setCurrentPracticeId,
  currentPracticeId,
  setScheduleEvents,
  debouncedSave,
  handleSyncPracticeToPlan,
  ensureWeekExists,
  changeCurrentWeek,
  setActiveUnit,
  attendanceLogs,
  setDeletedPracticePlanIds,
  handleDeleteScheduleEvent,
  setAttendanceLogs,
  flushAndSaveStateToStorage,
  seasonConfig,
  activeTeamPracticeData,
  lastLocalEditTimeRef,
  setPracticeTemplates,
  currentPracticeIdRef,
  cascadingDrills,
}: PracticePlanActionsDeps) {
  const handleOpenNewPracticeModal = () => {
    const todayStr = getLocalDateKey();
    const dateStr = prompt('Enter Date (YYYY-MM-DD):', todayStr);
    if (!dateStr || !dateStr.trim()) return;

    const cleanDate = dateStr.trim();
    const dayOfWeek = getDayOfWeekForDate(cleanDate);
    const dayFolder = getFormattedDayFolder(cleanDate);
    const weekFolder = calculateWeekFolderForDate(cleanDate, scheduleEvents);

    // Calculate next sequential practice number among non-cancelled practices
    const activeCount = practiceData.filter((p) => !p.isCancelled).length;
    const defaultTitle = `Practice #${activeCount + 1} - ${dayOfWeek} (${weekFolder})`;
    const title = prompt('Enter Practice Title:', defaultTitle);
    if (!title || !title.trim()) return;

    const allTemplates = {
      ...DEFAULT_PRACTICE_TEMPLATES,
      ...(latestStateRef.current.practiceTemplates || practiceTemplates || {}),
    };
    const weekdayTemplateName = resolvePracticeTemplateForWeekday(
      dayOfWeek,
      latestStateRef.current.practiceWeekdayTemplates || practiceWeekdayTemplates,
      Object.keys(allTemplates),
      'Standard Practice'
    );
    const seedPlan = allTemplates[weekdayTemplateName] || DEFAULT_PRACTICE_TEMPLATES['Standard Practice'] || [];

    const newPrac: PracticePlan = {
      id: `prac_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      teamId: activeTeamId,
      year: cleanDate.includes('-') ? cleanDate.split('-')[0] : '2026',
      weekFolder: weekFolder,
      dayFolder: dayFolder,
      title: title.trim(),
      date: cleanDate,
      day: dayOfWeek,
      startTime: '17:05',
      endTime: '19:00',
      location: 'Crane Road',
      lastEdited: Date.now(),
      plan: deepClone(seedPlan),
      periods: deepClone(seedPlan),
    };

    updatePracticeDataAndSave((prev) => [...prev, newPrac]);
    setCurrentPracticeId(newPrac.id);
  };

  const handleEditPracticeDetails = () => {
    const cur = practiceData.find((p) => p.id === currentPracticeId);
    if (!cur) return;
    const yr = prompt('Edit Season Year:', cur.year || '2026');
    if (yr === null) return;
    const dt = prompt('Edit Date (YYYY-MM-DD):', cur.date);
    if (dt === null) return;

    const cleanDate = dt.trim();
    const autoWeek = calculateWeekFolderForDate(cleanDate, scheduleEvents);
    const autoDay = getDayOfWeekForDate(cleanDate);
    const autoDayFolder = getFormattedDayFolder(cleanDate);

    const wk = prompt('Edit Week Folder:', autoWeek || cur.weekFolder || 'Week 1');
    if (wk === null) return;
    const title = prompt('Edit Practice Title:', cur.title);
    if (title === null) return;

    updatePracticeDataAndSave((prev) =>
      prev.map((p) =>
        p.id === currentPracticeId
          ? {
              ...p,
              year: yr.trim(),
              weekFolder: wk.trim(),
              title: title.trim(),
              date: cleanDate,
              day: autoDay,
              dayFolder: autoDayFolder,
              lastEdited: Date.now(),
            }
          : p
      )
    );
  };

  const handleTogglePracticeCancelled = (
    practiceId: string,
    isCancelled?: boolean,
    reason?: string
  ) => {
    let targetDate = '';
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === practiceId) {
          targetDate = p.date || '';
          const newStatus = isCancelled !== undefined ? isCancelled : !p.isCancelled;
          return {
            ...p,
            isCancelled: newStatus,
            cancellationReason: reason !== undefined ? reason : (newStatus ? 'Cancelled' : ''),
            lastEdited: Date.now(),
          };
        }
        return p;
      })
    );

    // Also sync to matching ScheduleEvent if any
    setScheduleEvents((prev) => {
      const curPlan = practiceData.find((p) => p.id === practiceId);
      const next = prev.map((ev) => {
        if (
          ev.linkedPracticePlanId === practiceId ||
          (ev.date && targetDate && ev.date === targetDate && (ev.type === 'practice' || ev.type === 'scrimmage'))
        ) {
          const newStatus = isCancelled !== undefined ? isCancelled : !ev.isCancelled;
          return {
            ...ev,
            isCancelled: newStatus,
            cancellationReason: reason !== undefined ? reason : (curPlan?.cancellationReason || (newStatus ? 'Cancelled' : '')),
            lastEdited: Date.now(),
          };
        }
        return ev;
      });
      safeJSONSet('footballScheduleEvents', next);
      latestStateRef.current.scheduleEvents = next;
      return next;
    });
  };

  const handleTogglePracticeNonPractice = (
    practiceId: string,
    isNonPractice?: boolean
  ) => {
    let targetDate = '';
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === practiceId) {
          targetDate = p.date || '';
          const newStatus = isNonPractice !== undefined ? isNonPractice : !p.isNonPractice;
          return {
            ...p,
            isNonPractice: newStatus,
            lastEdited: Date.now(),
          };
        }
        return p;
      })
    );

    // Also sync to matching ScheduleEvent if any
    setScheduleEvents((prev) => {
      const next = prev.map((ev) => {
        if (
          ev.linkedPracticePlanId === practiceId ||
          (ev.date && targetDate && ev.date === targetDate && (ev.type === 'practice' || ev.type === 'scrimmage' || ev.type === 'walkthrough'))
        ) {
          const newStatus = isNonPractice !== undefined ? isNonPractice : !ev.isNonPractice;
          return {
            ...ev,
            isNonPractice: newStatus,
            lastEdited: Date.now(),
          };
        }
        return ev;
      });
      safeJSONSet('footballScheduleEvents', next);
      latestStateRef.current.scheduleEvents = next;
      return next;
    });
    debouncedSave('schedule');
  };

  const handleQuickCreatePlanFromSchedule = (evt: ScheduleEvent) => {
    const planId = handleSyncPracticeToPlan(evt);
    const rawWeek = String(evt.week !== undefined ? evt.week : '1');
    const match = rawWeek.match(/Week\s*(\d+)/i);
    const weekNum = match ? match[1] : rawWeek.replace(/\D/g, '') || '1';
    ensureWeekExists(weekNum);
    changeCurrentWeek(weekNum);
    setCurrentPracticeId(planId);
    setActiveUnit('practice');
  };

  const handleAutoNumberPractices = () => {
    if (
      confirm(
        'Auto-number non-cancelled practice plans sequentially by date? (Cancelled practices will be excluded from the practice count and subsequent plans will be re-numbered)'
      )
    ) {
      updatePracticeDataAndSave((prev) => {
        // Sort chronologically
        const sorted = [...prev].sort((a, b) => {
          const dateA = a.date || '1970-01-01';
          const dateB = b.date || '1970-01-01';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
        });

        let seqNum = 0;
        const newTitleMap: Record<string, string> = {};
        sorted.forEach((p) => {
          if (p.isCancelled) {
            newTitleMap[p.id] = p.title.startsWith('[Cancelled]')
              ? p.title
              : `[Cancelled] ${p.title.replace(/^Practice #\d+\s*[:-]?\s*/i, '')}`;
          } else {
            seqNum++;
            const dayName = p.day || getDayOfWeekForDate(p.date);
            const wk = p.weekFolder || calculateWeekFolderForDate(p.date, scheduleEvents);
            
            // Check if there is existing custom focus text in the title (after " - ")
            const dashIdx = p.title.indexOf(' - ');
            const hasCustomText =
              dashIdx !== -1 &&
              !p.title.substring(dashIdx + 3).startsWith('Practice #');
            const customFocus = hasCustomText
              ? p.title.substring(dashIdx + 3).trim()
              : `${dayName} (${wk})`;

            newTitleMap[p.id] = `Practice #${seqNum} - ${customFocus}`;
          }
        });

        return prev.map((p) => ({
          ...p,
          title: newTitleMap[p.id] || p.title,
          lastEdited: Date.now(),
        }));
      });
    }
  };

  const handleDeletePractice = () => {
    if (practiceData.length <= 1) {
      alert('Cannot delete the last practice plan.');
      return;
    }
    const planToDelete = practiceData.find((p) => p.id === currentPracticeId);
    if (!planToDelete) return;

    const matchingEvent = scheduleEvents.find(
      (e) =>
        e.linkedPracticePlanId === planToDelete.id ||
        (planToDelete.date && e.date === planToDelete.date && (e.type === 'practice' || e.type === 'scrimmage'))
    );

    const hasAttendance = attendanceLogs.some(
      (l) => planToDelete.date && l.date === planToDelete.date
    );

    let confirmPrompt = `Delete practice plan "${planToDelete.title || 'Current Practice'}"?`;
    if (matchingEvent || hasAttendance) {
      confirmPrompt += `\n\nThis will also remove this practice from the Schedule and Attendance Tracker.`;
    }

    if (confirm(confirmPrompt)) {
      const deletedPlanId = planToDelete.id;
      setDeletedPracticePlanIds((prev) => {
        const next = Array.from(new Set([...prev, deletedPlanId]));
        latestStateRef.current.deletedPracticePlanIds = next;
        safeJSONSet('footballDeletedPracticePlanIds', next);
        return next;
      });

      const remaining = practiceData.filter((p) => p.id !== deletedPlanId);
      updatePracticeDataAndSave(() => remaining, true);
      setCurrentPracticeId(remaining[0]?.id || null);

      if (matchingEvent) {
        handleDeleteScheduleEvent(matchingEvent.id);
      } else if (hasAttendance && planToDelete.date) {
        // Clean up attendance logs for this date if no event
        const matchingLogs = attendanceLogs.filter((l) => l.date === planToDelete.date);
        if (matchingLogs.length > 0) {
          const matchingIds = new Set(matchingLogs.map((l) => l.id));
          const updatedLogs = attendanceLogs.filter((l) => !matchingIds.has(l.id));
          setAttendanceLogs(updatedLogs);
          safeJSONSet('footballAttendanceLogs', updatedLogs);
        }
      }
      flushAndSaveStateToStorage('delete_practice_plan', { deletedPracticePlanId: deletedPlanId });
    }
  };

  const applyTemplateToFutureWeekdayPlans = (
    weekday: string,
    templateName: string,
    opts?: { confirm?: boolean }
  ): number => {
    const resolved = templateName || 'Standard Practice';
    const allTemplates = {
      ...DEFAULT_PRACTICE_TEMPLATES,
      ...(latestStateRef.current.practiceTemplates || practiceTemplates || {}),
    };
    const planToApply = Array.isArray(allTemplates[resolved])
      ? allTemplates[resolved]
      : (allTemplates[resolved] as any)?.plan || (allTemplates[resolved] as any)?.periods;
    if (!Array.isArray(planToApply) || planToApply.length === 0) return 0;

    const year = practiceSeasonYear(
      undefined,
      String((seasonConfig as any)?.year || getLocalDateKey().slice(0, 4))
    );
    const today = getLocalDateKey();
    const teamId = activeTeamId;
    const currentList =
      (latestStateRef.current.practiceData || practiceData || []).filter(Boolean);
    const matches = currentList.filter((p) =>
      shouldApplyWeekdayTemplateToPlan(p, { weekday, year, today, teamId })
    );
    if (!matches.length) return 0;
    if (
      opts?.confirm !== false &&
      !window.confirm(
        `Apply "${resolved}" to ${matches.length} upcoming ${weekday} practice${
          matches.length === 1 ? '' : 's'
        } in ${year}? Past ${weekday} plans will stay as they are.`
      )
    ) {
      return -1;
    }

    const matchIds = new Set(matches.map((p) => p.id));
    updatePracticeDataAndSave((prev) =>
      prev.map((p) =>
        matchIds.has(p.id)
          ? {
              ...p,
              plan: deepClone(planToApply),
              periods: deepClone(planToApply),
              lastEdited: Date.now(),
            }
          : p
      )
    );
    debouncedSave('practice');
    return matches.length;
  };

  const handleApplyPracticeTemplate = (templateName: string) => {
    const tmpl = practiceTemplates[templateName] || DEFAULT_PRACTICE_TEMPLATES[templateName];
    if (!tmpl) {
      alert(`Template "${templateName}" not found.`);
      return;
    }
    const planToApply = Array.isArray(tmpl)
      ? tmpl
      : (tmpl as any).plan || (tmpl as any).periods;
    if (!Array.isArray(planToApply) || planToApply.length === 0) {
      alert(`Template "${templateName}" has no periods to apply.`);
      return;
    }
    const activeList =
      activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData;
    const targetId =
      currentPracticeId ||
      findBestActivePracticeId(activeList) ||
      activeList[0]?.id;
    const currentPlan = activeList.find((p) => p && p.id === targetId);
    const weekday = practiceWeekdayName(currentPlan);
    const year = practiceSeasonYear(
      currentPlan,
      String((seasonConfig as any)?.year || getLocalDateKey().slice(0, 4))
    );
    const today = getLocalDateKey();
    const currentIsFuture = shouldApplyWeekdayTemplateToPlan(currentPlan, {
      weekday,
      year,
      today,
      teamId: activeTeamId,
    });

    if (currentIsFuture) {
      const applied = applyTemplateToFutureWeekdayPlans(weekday, templateName);
      if (applied > 0) return;
      if (applied < 0) return;
    }

    if (
      !confirm(
        `Apply template "${templateName}"? This will replace the periods in the active practice plan.`
      )
    ) {
      return;
    }

    if (!targetId) {
      alert('Please create or select a practice plan first.');
      return;
    }

    updatePracticeDataAndSave((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? {
              ...p,
              plan: deepClone(planToApply),
              periods: deepClone(planToApply),
              lastEdited: Date.now(),
            }
          : p
      )
    );
    debouncedSave('practice');
  };

  const handleSaveCurrentAsTemplate = (customName?: string) => {
    const activeList =
      activeTeamPracticeData.length > 0 ? activeTeamPracticeData : practiceData;
    const cur =
      activeList.find((p) => p && p.id === currentPracticeId) ||
      activeList.find((p) => p && p.id === findBestActivePracticeId(activeList)) ||
      activeList[0];

    const periodsToSave = cur
      ? Array.isArray(cur.plan) && cur.plan.length > 0
        ? cur.plan
        : Array.isArray(cur.periods) && cur.periods.length > 0
        ? cur.periods
        : []
      : [];

    if (!cur || periodsToSave.length === 0) {
      alert('No practice periods found in the active practice plan to save. Please add periods before saving as a template.');
      return;
    }

    const defaultName = cur.name ? `${cur.name} Template` : 'Standard Practice Template';
    const name =
      typeof customName === 'string' && customName.trim()
        ? customName.trim()
        : prompt('Enter a name for this practice template:', defaultName);

    if (name && name.trim()) {
      const trimmed = name.trim();
      const next = {
        ...practiceTemplates,
        [trimmed]: deepClone(periodsToSave),
      };
      lastLocalEditTimeRef.current = Date.now();
      setPracticeTemplates(next);
      latestStateRef.current.practiceTemplates = next;
      safeJSONSet('footballPracticeTemplates', next);
      debouncedSave('practice');

      alert(`Practice Template "${trimmed}" saved! You can now apply it to any practice plan.`);
    }
  };

  const handleUpdatePracticeMeta = (
    field: keyof PracticePlan,
    value: any,
    targetPlanId?: string
  ) => {
    const targetId = targetPlanId || currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const updated = { ...p, [field]: value, lastEdited: Date.now() };
          if (field === 'date' && value) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const parts = String(value).split('-');
            if (parts.length === 3) {
              const y = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10);
              const d = parseInt(parts[2], 10);
              if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                const dt = new Date(y, m - 1, d, 12, 0, 0);
                const dayOfWeek = dayNames[dt.getDay()];
                if (dayOfWeek) {
                  updated.day = dayOfWeek;
                  updated.dayFolder = dayOfWeek;
                }
              }
            }
          }
          return updated;
        }
        return p;
      }),
      false,
      targetId
    );

    // If changing start time, date, isNonPractice, or isCancelled, also update any linked schedule event
    if (field === 'startTime' || field === 'date' || field === 'isNonPractice' || field === 'isCancelled') {
      setScheduleEvents((prev) => {
        const next = prev.map((ev) => {
          if (ev.linkedPracticePlanId === targetId || (targetId && ev.id === targetId)) {
            const updatedEv = { ...ev };
            if (field === 'startTime') {
              updatedEv.time = formatTimeMinutes(parseTimeString(value));
              updatedEv.startTime = value;
            }
            if (field === 'date') {
              updatedEv.date = value;
            }
            if (field === 'isNonPractice') {
              updatedEv.isNonPractice = Boolean(value);
            }
            if (field === 'isCancelled') {
              updatedEv.isCancelled = Boolean(value);
            }
            return updatedEv;
          }
          return ev;
        });
        safeJSONSet('footballScheduleEvents', next);
        latestStateRef.current.scheduleEvents = next;
        return next;
      });
      debouncedSave('schedule');
    }
  };


  const handleAddPeriod = () => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const defaultCat =
            cascadingDrills[0]?.name || '⚡ (Warm-up, Agility and Conditioning)';
          const currentPlan = getPlanPeriods(p);
          const newPlan = [
            ...currentPlan,
            {
              time: 15,
              category: defaultCat,
              format: 'static' as const,
              stations: [
                {
                  name: 'New Station',
                  desc: 'Drill details...',
                  coach: '',
                  focus: 'Effort & technique',
                },
              ],
            },
          ];
          return {
            ...p,
            lastEdited: Date.now(),
            plan: newPlan,
            periods: newPlan,
          };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleRemovePeriod = (pIdx: number) => {
    if (confirm('Delete this period?')) {
      const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
      updatePracticeDataAndSave((prev) =>
        prev.map((p) => {
          if (p.id === targetId) {
            const plan = [...getPlanPeriods(p)];
            if (pIdx >= 0 && pIdx < plan.length) {
              plan.splice(pIdx, 1);
            }
            return { ...p, plan, periods: plan, lastEdited: Date.now() };
          }
          return p;
        }),
        false,
        targetId
      );
    }
  };

  const handleMovePeriod = (pIdx: number, direction: number) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          const newIdx = pIdx + direction;
          if (newIdx < 0 || newIdx >= plan.length) return p;
          const [moved] = plan.splice(pIdx, 1);
          plan.splice(newIdx, 0, moved);
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleUpdatePeriodTime = (pIdx: number, time: number) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (plan[pIdx]) {
            plan[pIdx] = { ...plan[pIdx], time };
          }
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleUpdatePeriodCategory = (pIdx: number, category: string) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (plan[pIdx]) {
            plan[pIdx] = { ...plan[pIdx], category };
          }
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleUpdatePeriodFormat = (
    pIdx: number,
    format: 'static' | 'rotating'
  ) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (plan[pIdx]) {
            plan[pIdx] = { ...plan[pIdx], format };
          }
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleAddStationToPeriod = (pIdx: number) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (plan[pIdx]) {
            const currentStations = Array.isArray(plan[pIdx].stations) ? plan[pIdx].stations : [];
            plan[pIdx] = {
              ...plan[pIdx],
              stations: [
                ...currentStations,
                {
                  name: 'New Station',
                  desc: 'Drill details...',
                  coach: '',
                  focus: 'Execution',
                },
              ],
            };
          }
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleRemoveStationFromPeriod = (pIdx: number, sIdx: number) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (!plan[pIdx]) return p;
          const currentStations = Array.isArray(plan[pIdx].stations) ? plan[pIdx].stations : [];
          if (currentStations.length <= 1) {
            // Reset the single station to empty
            const stations = [
              {
                name: '',
                desc: '',
                coach: '',
                focus: '',
              },
            ];
            plan[pIdx] = { ...plan[pIdx], stations };
            return { ...p, plan, periods: plan, lastEdited: Date.now() };
          }
          const stations = [...currentStations];
          stations.splice(sIdx, 1);
          plan[pIdx] = { ...plan[pIdx], stations };
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
    flushAndSaveStateToStorage('remove_station');
  };

  const handleUpdateStation = (
    pIdx: number,
    sIdx: number,
    field: keyof PracticeStation,
    value: string
  ) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (!plan[pIdx]) return p;
          const stations = Array.isArray(plan[pIdx].stations) ? [...plan[pIdx].stations] : [{ name: '', desc: '', coach: '', focus: '' }];
          if (stations[sIdx]) {
            stations[sIdx] = { ...stations[sIdx], [field]: value };
          } else {
            stations[sIdx] = { name: '', desc: '', coach: '', focus: '', [field]: value };
          }
          plan[pIdx] = { ...plan[pIdx], stations };
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  const handleSelectDrillForStation = (
    pIdx: number,
    sIdx: number,
    drill: DrillItem
  ) => {
    const targetId = currentPracticeId || currentPracticeIdRef.current || (activeTeamPracticeData[0]?.id) || (practiceData[0]?.id);
    updatePracticeDataAndSave((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const plan = [...getPlanPeriods(p)];
          if (!plan[pIdx]) return p;
          const stations = Array.isArray(plan[pIdx].stations) ? [...plan[pIdx].stations] : [{ name: '', desc: '', coach: '', focus: '' }];
          stations[sIdx] = {
            ...(stations[sIdx] || { coach: '' }),
            name: drill.name,
            desc: drill.desc,
            focus: drill.key,
          };
          plan[pIdx] = { ...plan[pIdx], stations };
          return { ...p, plan, periods: plan, lastEdited: Date.now() };
        }
        return p;
      }),
      false,
      targetId
    );
  };

  return {
    handleUpdatePracticeMeta,
    handleQuickCreatePlanFromSchedule,
    handleOpenNewPracticeModal,
    handleEditPracticeDetails,
    handleAutoNumberPractices,
    handleDeletePractice,
    handleApplyPracticeTemplate,
    applyTemplateToFutureWeekdayPlans,
    handleSaveCurrentAsTemplate,
    handleTogglePracticeCancelled,
    handleTogglePracticeNonPractice,
    handleAddPeriod,
    handleRemovePeriod,
    handleMovePeriod,
    handleUpdatePeriodTime,
    handleUpdatePeriodCategory,
    handleUpdatePeriodFormat,
    handleAddStationToPeriod,
    handleRemoveStationFromPeriod,
    handleUpdateStation,
    handleSelectDrillForStation,
  };
}
