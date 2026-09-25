import { ScheduleEvent, PracticePlan, UnitType } from '../types';
import type {
  WeekState,
  PracticePeriod,
  AttendanceRecord,
  RosterPlayer,
} from '../types';
import { getScopedWeekKey } from '../utils/seasonWeekUtils';
import { DEFAULT_INITIAL_PRACTICES, DEFAULT_PRACTICE_TEMPLATES } from '../data/initialData';
import { getFormattedDayFolder, resolvePracticeTemplateForWeekday } from '../utils/practiceUtils';
import { safeJSONSet, deepClone } from '../services/storageService';
import { isEventAlreadyInSchedule } from '../utils/teamSnapSync';
import { mergeDeletedIds } from '../utils/remoteStateMerge';
import { PracticeWizardGeneratedResult } from '../components/PracticeWizardModal';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { LatestAppState } from './appStateTypes';

export interface ScheduleActionsDeps {
  ensureWeekExists: (week: string, sourceWeek?: string) => void;
  setWeeklyData: Dispatch<SetStateAction<Record<string, WeekState>>>;
  activeTeamId: string;
  storedWeekForWrite: (wData: Record<string, WeekState>, teamId: string, week: string) => WeekState;
  practiceData: PracticePlan[];
  updatePracticeDataAndSave: (updater: (prev: PracticePlan[]) => PracticePlan[], immediate?: boolean, modifiedPlanId?: string) => void;
  updatePracticeDataLocally: (updater: (prev: PracticePlan[]) => PracticePlan[]) => void;
  setScheduleEvents: Dispatch<SetStateAction<ScheduleEvent[]>>;
  setDeletedScheduleEventIds: Dispatch<SetStateAction<string[]>>;
  latestStateRef: RefObject<LatestAppState>;
  setCurrentPracticeId: Dispatch<SetStateAction<string>>;
  practiceWeekdayTemplates: Partial<Record<"Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday", string>>;
  practiceTemplates: Record<string, PracticePeriod[]>;
  scheduleEvents: ScheduleEvent[];
  attendanceLogs: AttendanceRecord[];
  setAttendanceLogs: Dispatch<SetStateAction<AttendanceRecord[]>>;
  setRoster: Dispatch<SetStateAction<RosterPlayer[]>>;
  saveStateToStorage: (scope?: string, extraMeta?: Record<string, any>) => Promise<void>;
  lastLocalEditTimeRef: RefObject<number>;
  flushAndSaveStateToStorage: (scope?: string, extraMeta?: Record<string, any>) => Promise<void>;
  debouncedSave: (scope?: string, extraMeta?: Record<string, any>) => void;
  changeCurrentWeek: (wk: string) => void;
  setActiveUnit: (action: SetStateAction<UnitType>) => void;
}

// Season schedule events: add, edit, delete, TeamSnap import, and syncing games and practices into weekly data and plans.
export function useScheduleActions({
  ensureWeekExists,
  setWeeklyData,
  activeTeamId,
  storedWeekForWrite,
  practiceData,
  updatePracticeDataAndSave,
  updatePracticeDataLocally,
  setScheduleEvents,
  setDeletedScheduleEventIds,
  latestStateRef,
  setCurrentPracticeId,
  practiceWeekdayTemplates,
  practiceTemplates,
  scheduleEvents,
  attendanceLogs,
  setAttendanceLogs,
  setRoster,
  saveStateToStorage,
  lastLocalEditTimeRef,
  flushAndSaveStateToStorage,
  debouncedSave,
  changeCurrentWeek,
  setActiveUnit,
}: ScheduleActionsDeps) {
  /* =========================================================================
     SEASON SCHEDULE & WORKFLOW SYNC HANDLERS
     ========================================================================= */
  const handleSyncGameToWeeklyData = (
    eventOrWeek: ScheduleEvent | string,
    opponentName?: string,
    dateStr?: string,
    timeStr?: string,
    locationStr?: string
  ) => {
    let weekKey = '1';
    let oppName = '';
    let gameDateTime = '';
    let location = 'Mahopac High School';

    if (typeof eventOrWeek === 'object') {
      weekKey = eventOrWeek.week || '1';
      oppName = eventOrWeek.opponent || eventOrWeek.title;
      gameDateTime = `${eventOrWeek.date} @ ${eventOrWeek.startTime || '10:00 AM'}`;
      location = eventOrWeek.location || 'Mahopac High School';
    } else {
      weekKey = eventOrWeek || '1';
      oppName = opponentName || '';
      gameDateTime = `${dateStr || ''} @ ${timeStr || '10:00 AM'}`.trim();
      location = locationStr || 'Mahopac High School';
    }

    ensureWeekExists(weekKey);

    setWeeklyData((prev) => {
      const scopedKey = getScopedWeekKey(activeTeamId, weekKey);
      const existingWeek = storedWeekForWrite(prev, activeTeamId, weekKey);

      const updatedWeekState = {
        ...existingWeek,
        opponent: oppName,
        scouting: {
          ...(existingWeek.scouting || {}),
          opponent: oppName,
          gameDate: gameDateTime,
          gameLocation: location,
          week: `Week ${weekKey}`,
          year: '2026',
        },
      };

      return {
        ...prev,
        [scopedKey]: updatedWeekState,
        [weekKey]: updatedWeekState,
      };
    });
  };

  const handleSyncPracticeToPlan = (event: ScheduleEvent, templateName?: string): string => {
    // 1. Calculate Day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let dayOfWeek = event.dayOfWeek;
    if (!dayOfWeek && event.date) {
      const parts = event.date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const dt = new Date(y, m - 1, d, 12, 0, 0);
          dayOfWeek = dayNames[dt.getDay()];
        }
      }
    }
    if (!dayOfWeek) dayOfWeek = 'Wednesday';

    // 2. Calculate Week Folder
    const rawWeek = String(event.week !== undefined ? event.week : '1').trim();
    let weekFolder = `Week ${rawWeek}`;
    if (rawWeek === '0' || rawWeek.toLowerCase().includes('pre-1') || rawWeek.toLowerCase().includes('pre1')) {
      weekFolder = 'Preseason Wk 1';
    } else if (rawWeek.toLowerCase().includes('pre-2') || rawWeek.toLowerCase().includes('pre2')) {
      weekFolder = 'Preseason Wk 2';
    } else if (rawWeek.toLowerCase().startsWith('week')) {
      weekFolder = rawWeek;
    } else if (rawWeek.toLowerCase().includes('pre')) {
      weekFolder = 'Preseason Wk 1';
    } else {
      weekFolder = `Week ${rawWeek}`;
    }

    // 3. Year, Time, Location & Title
    const isGame = event.type === 'game' || event.type === 'tournament' || event.type === 'scrimmage';
    const year = event.date && event.date.includes('-') ? event.date.split('-')[0] : '2026';
    
    // For games, default the warmup window based on arrivalMinutesBefore (e.g. 60-90m prior to kickoff)
    let startTime = event.startTime || event.time || '17:30';
    let endTime = event.endTime || '19:00';
    if (isGame && event.startTime) {
      const arrivalMins = event.arrivalMinutesBefore || 60;
      const [hStr, mStr] = event.startTime.split(':');
      const kickoffTotalMins = parseInt(hStr || '12', 10) * 60 + parseInt(mStr || '00', 10);
      const warmupStartMins = Math.max(0, kickoffTotalMins - arrivalMins);
      const warmupEndMins = Math.max(warmupStartMins + 30, kickoffTotalMins - 15);
      
      const formatMins = (mins: number) => {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };
      startTime = formatMins(warmupStartMins);
      endTime = formatMins(warmupEndMins);
    }

    const location = event.location || 'Crane Road';
    const title = isGame
      ? (event.title.toLowerCase().includes('pre-game') || event.title.toLowerCase().includes('warmup')
          ? event.title
          : `Pre-Game Warmup: ${event.title}`)
      : (event.title || `${weekFolder} Practice`);

    // 4. Find existing practice plan
    const targetPlanId = event.preGamePlanId || event.linkedPracticePlanId;
    let existing = targetPlanId
      ? practiceData.find((p) => p && p.id === targetPlanId)
      : undefined;

    if (!existing && event.date) {
      existing = practiceData.find(
        (p) =>
          p &&
          p.date === event.date &&
          (isGame
            ? p.title?.toLowerCase().includes('pre-game') ||
              p.title?.toLowerCase().includes('warmup') ||
              p.id === targetPlanId
            : true)
      );
    }

    if (!existing) {
      existing = practiceData.find(
        (p) =>
          p &&
          (p.id === event.id ||
            (p.title &&
              event.title &&
              p.title.trim().toLowerCase() === event.title.trim().toLowerCase() &&
              (p.weekFolder === weekFolder || p.weekFolder === `Week ${event.week}`)))
      );
    }

    // Fallback: check DEFAULT_INITIAL_PRACTICES if not yet in state
    if (!existing && event.date) {
      const defaultInitial = DEFAULT_INITIAL_PRACTICES.find(
        (p) => p.date === event.date || p.id === event.linkedPracticePlanId || p.id === event.id
      );
      if (defaultInitial) {
        existing = defaultInitial;
      }
    }

    const formattedDayFolder = getFormattedDayFolder(event.date);

    if (existing) {
      const existingId = existing.id;
      const existingPlan = existing;
      // Opening a practice is not an edit: align it with the event on this device only.
      // Stamping and saving here pushed this device's (possibly older or default) copy
      // over the plan another coach had just edited.
      updatePracticeDataLocally((prev) => {
        const alreadyInList = prev.some((p) => p.id === existingId);
        if (alreadyInList) {
          return prev.map((p) =>
            p.id === existingId
              ? {
                  ...p,
                  teamId: p.teamId || event.teamId || activeTeamId || 'team_10u',
                  title: p.title || title,
                  date: event.date || p.date,
                  day: dayOfWeek,
                  dayFolder: p.dayFolder || formattedDayFolder,
                  startTime: startTime,
                  endTime: endTime,
                  weekFolder: weekFolder,
                  year: year,
                  location: location,
                }
              : p
          );
        } else {
          const rawPeriods = Array.isArray(existingPlan.plan) && existingPlan.plan.length > 0
            ? existingPlan.plan
            : Array.isArray(existingPlan.periods) && existingPlan.periods.length > 0
            ? existingPlan.periods
            : [];
          return [
            ...prev,
            {
              ...existingPlan,
              teamId: existingPlan.teamId || event.teamId || activeTeamId || 'team_10u',
              date: event.date || existingPlan.date,
              day: dayOfWeek,
              dayFolder: existingPlan.dayFolder || formattedDayFolder,
              weekFolder: weekFolder,
              year: year,
              plan: rawPeriods,
              periods: rawPeriods,
              // Keep the stored/default timestamp so any real plan from another coach wins.
              lastEdited: existingPlan.lastEdited,
            },
          ];
        }
      });

      if (event.linkedPracticePlanId !== existingId) {
        setScheduleEvents((prev) => {
          const next = prev.map((ev) =>
            ev.id === event.id
              ? {
                  ...ev,
                  linkedPracticePlanId: existingId,
                  preGamePlanId: isGame ? existingId : ev.preGamePlanId,
                }
              : ev
          );
          safeJSONSet('footballScheduleEvents', next);
          latestStateRef.current.scheduleEvents = next;
          return next;
        });
      }

      setCurrentPracticeId(existingId);
      return existingId;
    }

    const linkedId = event.preGamePlanId || event.linkedPracticePlanId;
    const linkedWasDeleted = Boolean(linkedId && (latestStateRef.current.deletedPracticePlanIds || []).includes(linkedId));
    if (linkedId && !linkedWasDeleted) {
      setCurrentPracticeId(linkedId);
      return linkedId;
    }

    // 5. Create new plan auto-populated with date, time, week folder, and day
    const newPracticeId = 'prac_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const defaultTemplateKey = isGame
      ? 'Pre-Game Warmup & Routine'
      : resolvePracticeTemplateForWeekday(
          dayOfWeek,
          latestStateRef.current.practiceWeekdayTemplates || practiceWeekdayTemplates,
          Object.keys({
            ...DEFAULT_PRACTICE_TEMPLATES,
            ...(latestStateRef.current.practiceTemplates || practiceTemplates || {}),
          }),
          'Standard Practice'
        );
    const allPracticeTemplates = {
      ...DEFAULT_PRACTICE_TEMPLATES,
      ...(latestStateRef.current.practiceTemplates || practiceTemplates || {}),
    };
    const planTemplate =
      (templateName && allPracticeTemplates[templateName]) ||
      allPracticeTemplates[defaultTemplateKey] ||
      DEFAULT_PRACTICE_TEMPLATES['Standard Practice'] ||
      [];

    const newPlan: PracticePlan = {
      id: newPracticeId,
      teamId: event.teamId || activeTeamId,
      year: year,
      weekFolder: weekFolder,
      dayFolder: dayOfWeek,
      title: title,
      date: event.date || '',
      day: dayOfWeek,
      startTime: startTime,
      endTime: endTime,
      location: location,
      lastEdited: Date.now(),
      plan: deepClone(planTemplate),
      periods: deepClone(planTemplate),
    };

    updatePracticeDataAndSave((prev) => [...prev, newPlan]);

    setScheduleEvents((prev) => {
      const next = prev.map((ev) =>
        ev.id === event.id
          ? {
              ...ev,
              linkedPracticePlanId: newPracticeId,
              preGamePlanId: isGame ? newPracticeId : ev.preGamePlanId,
            }
          : ev
      );
      safeJSONSet('footballScheduleEvents', next);
      latestStateRef.current.scheduleEvents = next;
      return next;
    });

    setCurrentPracticeId(newPracticeId);
    return newPracticeId;
  };

  const handleAddScheduleEvent = (
    eventData: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>
  ) => {
    const newId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newEvent: ScheduleEvent = {
      ...eventData,
      teamId: eventData.teamId || activeTeamId,
      id: newId,
      createdAt: Date.now(),
      lastEdited: Date.now(),
    };

    setScheduleEvents((prev) => {
      const updated = [...prev, newEvent];
      safeJSONSet('footballScheduleEvents', updated);
      return updated;
    });

    if (newEvent.type === 'game') {
      handleSyncGameToWeeklyData(newEvent);
    }
  };

  const handleUpdateScheduleEvent = (
    id: string,
    updates: Partial<ScheduleEvent>
  ) => {
    setScheduleEvents((prev) => {
      const updatedList = prev.map((ev) => {
        if (ev.id === id) {
          const updated = { ...ev, ...updates, lastEdited: Date.now() };
          if (updated.type === 'game') {
            handleSyncGameToWeeklyData(updated);
          }
          if (updates.isNonPractice !== undefined || updates.isCancelled !== undefined) {
            updatePracticeDataAndSave((prevPlans) =>
              prevPlans.map((plan) => {
                if (plan.id === updated.linkedPracticePlanId || (plan.date && plan.date === updated.date)) {
                  return {
                    ...plan,
                    ...(updates.isNonPractice !== undefined ? { isNonPractice: updates.isNonPractice } : {}),
                    ...(updates.isCancelled !== undefined ? { isCancelled: updates.isCancelled } : {}),
                    lastEdited: Date.now(),
                  };
                }
                return plan;
              })
            );
          }
          return updated;
        }
        return ev;
      });
      safeJSONSet('footballScheduleEvents', updatedList);
      return updatedList;
    });
  };

  const handleDeleteScheduleEvent = (id: string) => {
    // 1. Find event to delete
    const eventToDelete = scheduleEvents.find((ev) => ev.id === id);

    // 2. Remove from scheduleEvents and remember the id, so merging with another
    // device's (or the server's) copy doesn't bring the event back.
    const updatedEvents = scheduleEvents.filter((ev) => ev.id !== id);
    setScheduleEvents(updatedEvents);
    safeJSONSet('footballScheduleEvents', updatedEvents);
    latestStateRef.current.scheduleEvents = updatedEvents;
    const deletedIds = mergeDeletedIds(latestStateRef.current.deletedScheduleEventIds, [id]);
    setDeletedScheduleEventIds(deletedIds);
    safeJSONSet('footballDeletedScheduleEventIds', deletedIds);
    latestStateRef.current.deletedScheduleEventIds = deletedIds;

    // 3. Find and remove matching attendance logs
    // Check if any other practice/scrimmage still exists on this date
    const remainingPracticesOnDate = updatedEvents.filter(
      (e) => eventToDelete && e.date === eventToDelete.date && (e.type === 'practice' || e.type === 'scrimmage' || e.type === 'walkthrough')
    );

    const matchingLogs = attendanceLogs.filter((log) => {
      if (log.id === id || log.id === `att_${id}`) return true;
      if (log.scheduleEventId === id) return true;
      if (eventToDelete && log.date === eventToDelete.date) {
        if (!log.teamId || log.teamId === eventToDelete.teamId) {
          // If no other practice exists on this date, this log belonged to the deleted event
          if (remainingPracticesOnDate.length === 0) return true;
        }
      }
      return false;
    });

    if (matchingLogs.length > 0) {
      const matchingIds = new Set(matchingLogs.map((l) => l.id));
      const updatedLogs = attendanceLogs.filter((l) => !matchingIds.has(l.id));
      setAttendanceLogs(updatedLogs);
      safeJSONSet('footballAttendanceLogs', updatedLogs);
      latestStateRef.current.attendanceLogs = updatedLogs;

      // 4. Reverse hours credited to players from these deleted attendance logs
      setRoster((prevRoster) => {
        let changed = false;
        const newRoster = prevRoster.map((player) => {
          let pCopy = { ...player };
          matchingLogs.forEach((log) => {
            const wasPresent = log.presentPlayerNums?.includes(player.num);
            if (wasPresent && (log.hours || 0) > 0) {
              changed = true;
              const logWeek = log.week || '0';
              const curWeekly = pCopy.weeklyHours?.[logWeek] || 0;
              const newWeekly = Math.max(0, +(curWeekly - log.hours).toFixed(2));

              let newCond = pCopy.conditioningHours || 0;
              let newPadded = pCopy.paddedHours || 0;
              if (log.sessionType === 'conditioning') {
                newCond = Math.max(0, +(newCond - log.hours).toFixed(2));
              } else {
                newPadded = Math.max(0, +(newPadded - log.hours).toFixed(2));
              }

              pCopy = {
                ...pCopy,
                weeklyHours: {
                  ...pCopy.weeklyHours,
                  [logWeek]: newWeekly,
                },
                conditioningHours: newCond,
                paddedHours: newPadded,
              };
            }
          });
          return pCopy;
        });

        if (changed) {
          safeJSONSet('footballRoster', newRoster);
          return newRoster;
        }
        return prevRoster;
      });
    }

    saveStateToStorage('schedule');
  };

  const handleBulkAddScheduleEvents = (
    eventsList: Array<Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>>
  ) => {
    const created: ScheduleEvent[] = eventsList.map((e, idx) => ({
      ...e,
      teamId: e.teamId || activeTeamId,
      id: `evt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      lastEdited: Date.now(),
    }));

    setScheduleEvents((prev) => {
      const updated = [...prev, ...created];
      latestStateRef.current.scheduleEvents = updated;
      safeJSONSet('footballScheduleEvents', updated);
      return updated;
    });
  };

  const handleImportTeamSnapScheduleEvents = (
    newEvents: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[],
    replaceExisting?: boolean
  ) => {
    let newlyCreatedEvents: ScheduleEvent[] = [];

    setScheduleEvents((prev) => {
      let eventsToImport = newEvents;

      // When appending (not replacing), only pull in events that are not already in the database
      if (!replaceExisting) {
        eventsToImport = newEvents.filter((ne) => {
          const duplicateCheck = isEventAlreadyInSchedule(ne as any, prev, activeTeamId);
          return !duplicateCheck.isDuplicate;
        });
      }

      if (eventsToImport.length === 0 && !replaceExisting) {
        return prev;
      }

      const created: ScheduleEvent[] = eventsToImport.map((e, idx) => ({
        ...e,
        teamId: e.teamId || activeTeamId,
        id: `evt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: Date.now(),
        lastEdited: Date.now(),
      }));

      newlyCreatedEvents = created;

      let nextEvents: ScheduleEvent[];
      if (replaceExisting) {
        // Completely replace schedule for active team (accounting for team_10u / team-10u aliases)
        const isCurrentTeam = (tid?: string) =>
          !tid ||
          tid === activeTeamId ||
          (tid === 'team_10u' && (activeTeamId === 'team_10u' || activeTeamId === 'team-10u')) ||
          (tid === 'team-10u' && (activeTeamId === 'team_10u' || activeTeamId === 'team-10u'));

        nextEvents = [
          ...prev.filter((ev) => !isCurrentTeam(ev.teamId)),
          ...created,
        ];
      } else {
      nextEvents = [...prev, ...created];
      }
      latestStateRef.current.scheduleEvents = nextEvents;
      lastLocalEditTimeRef.current = Date.now();
      safeJSONSet('footballLastLocalEditTime', lastLocalEditTimeRef.current);
      safeJSONSet('footballScheduleEvents', nextEvents);
      return nextEvents;
    });

    // Auto-sync practice plans and games for imported events
    newlyCreatedEvents.forEach((evt) => {
      if (evt.type === 'practice' || !evt.type) {
        handleSyncPracticeToPlan(evt);
      } else if (evt.type === 'game') {
        handleSyncGameToWeeklyData(evt);
      }
    });

    flushAndSaveStateToStorage('schedule_update', { scope: 'schedule_update' });
  };

  const handlePracticeWizardGenerate = (result: PracticeWizardGeneratedResult) => {
    if (result.practicePlans && result.practicePlans.length > 0) {
      const taggedPlans = result.practicePlans.map((p) => ({
        ...p,
        teamId: p.teamId || activeTeamId,
        lastEdited: Date.now(),
      }));
      updatePracticeDataAndSave((prev) => [...prev, ...taggedPlans]);
      if (taggedPlans[0]?.id) {
        setCurrentPracticeId(taggedPlans[0].id);
      }
    }

    if (result.scheduleEvents && result.scheduleEvents.length > 0) {
      const created: ScheduleEvent[] = result.scheduleEvents.map((e, idx) => ({
        ...e,
        teamId: e.teamId || activeTeamId,
        id: `evt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: Date.now(),
        lastEdited: Date.now(),
      }));
      setScheduleEvents((prev) => {
        const next = [...prev, ...created];
        safeJSONSet('footballScheduleEvents', next);
        latestStateRef.current.scheduleEvents = next;
        return next;
      });
    }

    debouncedSave('schedule');
  };

  const handleNavigateToWeek = (
    weekFolder: string,
    unit?: UnitType,
    practiceId?: string
  ) => {
    const match = weekFolder.match(/Week\s*(\d+)/i);
    const weekKey = match ? match[1] : weekFolder.replace(/\D/g, '') || '1';

    ensureWeekExists(weekKey);
    changeCurrentWeek(weekKey);

    if (practiceId) {
      setCurrentPracticeId(practiceId);
    }

    if (unit) {
      setActiveUnit(unit);
    }
  };

  return {
    handleSyncPracticeToPlan,
    handleDeleteScheduleEvent,
    handleUpdateScheduleEvent,
    handlePracticeWizardGenerate,
    handleAddScheduleEvent,
    handleBulkAddScheduleEvents,
    handleSyncGameToWeeklyData,
    handleNavigateToWeek,
    handleImportTeamSnapScheduleEvents,
  };
}
