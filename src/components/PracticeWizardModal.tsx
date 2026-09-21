import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Shield,
  Layers,
  Check,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { ScheduleEvent, PracticePlan, PracticePeriod } from '../types';
import { deepClone } from '../services/storageService';
import { DEFAULT_PRACTICE_TEMPLATES } from '../data/initialData';

export interface DayCadenceConfig {
  enabled: boolean;
  dayIndex: number; // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  dayName: string;
  shortName: string;
  type: 'practice' | 'walkthrough' | 'scrimmage' | 'meeting';
  titleSuffix: string;
  startTime: string;
  endTime: string;
  location: string;
  gear: string;
  focus: string;
  templateName: string;
}

export interface PracticeWizardGeneratedResult {
  scheduleEvents: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[];
  practicePlans: PracticePlan[];
}

interface PracticeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceTemplates?: Record<string, PracticePeriod[]>;
  currentWeek?: string;
  onGenerate: (result: PracticeWizardGeneratedResult) => void;
}

const DEFAULT_DAYS_CONFIG: Record<number, DayCadenceConfig> = {
  1: {
    enabled: false,
    dayIndex: 1,
    dayName: 'Monday',
    shortName: 'Mon',
    type: 'practice',
    titleSuffix: 'Install & Film Review',
    startTime: '17:30',
    endTime: '19:00',
    location: 'Crane Road',
    gear: 'Helmets Only',
    focus: 'Offensive install, defense alignment checks, and scouting film review.',
    templateName: 'Walkthrough / Light',
  },
  2: {
    enabled: true,
    dayIndex: 2,
    dayName: 'Tuesday',
    shortName: 'Tue',
    type: 'practice',
    titleSuffix: 'Full Pads - Inside Run & 11-on-11',
    startTime: '17:30',
    endTime: '19:00',
    location: 'Crane Road',
    gear: 'Full Pads',
    focus: 'Full pads. Inside run, blitz pickup, tackling circuits, and team 11-on-11.',
    templateName: 'Standard Practice',
  },
  3: {
    enabled: false,
    dayIndex: 3,
    dayName: 'Wednesday',
    shortName: 'Wed',
    type: 'practice',
    titleSuffix: 'Defense Pursuit & Red Zone',
    startTime: '17:30',
    endTime: '19:00',
    location: 'Crane Road',
    gear: 'Full Pads',
    focus: 'Defensive coverage rotations, red zone install, and pass rush.',
    templateName: 'Standard Practice',
  },
  4: {
    enabled: true,
    dayIndex: 4,
    dayName: 'Thursday',
    shortName: 'Thu',
    type: 'practice',
    titleSuffix: 'Walkthrough & Special Teams',
    startTime: '17:30',
    endTime: '19:00',
    location: 'Crane Road',
    gear: 'Helmets & Shells',
    focus: 'Special teams (Punt/Kickoff), red zone execution, signals & wristband review.',
    templateName: 'Walkthrough / Light',
  },
  5: {
    enabled: false,
    dayIndex: 5,
    dayName: 'Friday',
    shortName: 'Fri',
    type: 'walkthrough',
    titleSuffix: 'Pre-Game Polish & Cadence',
    startTime: '16:00',
    endTime: '17:15',
    location: 'Crane Road',
    gear: 'No Pads (Tee/Shorts)',
    focus: 'Fast tempo 2-minute drill, special situations, zero mistakes.',
    templateName: 'Walkthrough / Light',
  },
  6: {
    enabled: false,
    dayIndex: 6,
    dayName: 'Saturday',
    shortName: 'Sat',
    type: 'walkthrough',
    titleSuffix: 'Morning Walkthrough',
    startTime: '09:00',
    endTime: '10:30',
    location: 'Crane Road',
    gear: 'Helmets Only',
    focus: 'Game day preparation, mental alignment, wristband speed.',
    templateName: 'Walkthrough / Light',
  },
  0: {
    enabled: false,
    dayIndex: 0,
    dayName: 'Sunday',
    shortName: 'Sun',
    type: 'meeting',
    titleSuffix: 'Staff Chalk Talk',
    startTime: '18:00',
    endTime: '19:30',
    location: 'Crane Road',
    gear: 'No Pads',
    focus: 'Opponent scouting breakdowns and offensive game plan install.',
    templateName: 'Walkthrough / Light',
  },
};

const ALL_AVAILABLE_WEEKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export const PracticeWizardModal: React.FC<PracticeWizardModalProps> = ({
  isOpen,
  onClose,
  practiceTemplates = {},
  currentWeek = '1',
  onGenerate,
}) => {
  // Season & Week State
  const [seasonYear, setSeasonYear] = useState<string>('2026');
  const [kickoffDate, setKickoffDate] = useState<string>('2026-09-01'); // Tuesday Sep 1, 2026
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(['1', '2', '3', '4', '5', '6', '7', '8']);
  
  // Day configurations (0 to 6)
  const [daysConfig, setDaysConfig] = useState<Record<number, DayCadenceConfig>>(DEFAULT_DAYS_CONFIG);
  const [expandedDayIndex, setExpandedDayIndex] = useState<number | null>(2); // Start with Tuesday expanded

  // Generation options
  const [createScheduleEvents, setCreateScheduleEvents] = useState<boolean>(true);
  const [createPracticePlans, setCreatePracticePlans] = useState<boolean>(true);
  const [autoNumberSessions, setAutoNumberSessions] = useState<boolean>(true);
  const [showPreviewList, setShowPreviewList] = useState<boolean>(false);

  const availableTemplatesList = Object.keys({
    ...DEFAULT_PRACTICE_TEMPLATES,
    ...practiceTemplates,
  });

  // Toggle Week selection
  const handleToggleWeek = (wk: string) => {
    setSelectedWeeks((prev) =>
      prev.includes(wk) ? prev.filter((w) => w !== wk) : [...prev, wk].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    );
  };

  const handleSelectAllWeeks = () => setSelectedWeeks([...ALL_AVAILABLE_WEEKS]);
  const handleClearAllWeeks = () => setSelectedWeeks([]);
  const handleSelectPresetWeeks = (count: number) => {
    setSelectedWeeks(ALL_AVAILABLE_WEEKS.slice(0, count));
  };

  // Day toggle
  const handleToggleDay = (dayIdx: number) => {
    setDaysConfig((prev) => ({
      ...prev,
      [dayIdx]: {
        ...prev[dayIdx],
        enabled: !prev[dayIdx].enabled,
      },
    }));
    if (!daysConfig[dayIdx].enabled) {
      setExpandedDayIndex(dayIdx);
    }
  };

  const handleUpdateDayConfig = (dayIdx: number, updates: Partial<DayCadenceConfig>) => {
    setDaysConfig((prev) => ({
      ...prev,
      [dayIdx]: {
        ...prev[dayIdx],
        ...updates,
      },
    }));
  };

  // Copy one day's settings to all enabled days
  const handleCopySettingsToAllDays = (sourceDayIdx: number) => {
    const source = daysConfig[sourceDayIdx];
    if (!source) return;
    setDaysConfig((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        const dIdx = parseInt(key, 10);
        if (dIdx !== sourceDayIdx && updated[dIdx].enabled) {
          updated[dIdx] = {
            ...updated[dIdx],
            startTime: source.startTime,
            endTime: source.endTime,
            location: source.location,
            gear: source.gear,
            templateName: source.templateName,
          };
        }
      });
      return updated;
    });
  };

  // Active Days count
  const activeDaysList = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 0]
      .map((idx) => daysConfig[idx])
      .filter((d) => d && d.enabled);
  }, [daysConfig]);

  // Compute preview generated items
  const generatedPreview = useMemo(() => {
    if (selectedWeeks.length === 0 || activeDaysList.length === 0) {
      return [];
    }

    const items: Array<{
      week: string;
      date: string;
      dayName: string;
      dayIndex: number;
      title: string;
      startTime: string;
      endTime: string;
      location: string;
      gear: string;
      focus: string;
      type: 'practice' | 'walkthrough' | 'scrimmage' | 'meeting';
      templateName: string;
    }> = [];

    // Parse base date
    const [bYear, bMonth, bDay] = kickoffDate.split('-').map((v) => parseInt(v, 10));
    const baseDateObj = new Date(bYear || 2026, (bMonth || 9) - 1, bDay || 1, 12, 0, 0);
    const baseDayOfWeek = baseDateObj.getDay(); // 0-6

    // Sort weeks numerically
    const sortedSelectedWeeks = [...selectedWeeks].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    let sessionCounter = 1;

    sortedSelectedWeeks.forEach((wkStr) => {
      const wkNum = parseInt(wkStr, 10) || 1;
      const weekOffsetDays = (wkNum - 1) * 7;

      // For each active day
      activeDaysList.forEach((dayCfg) => {
        // Calculate days difference from base day of week
        let dayDiff = dayCfg.dayIndex - baseDayOfWeek;
        if (dayDiff < 0) dayDiff += 7; // wrap within week

        const targetDate = new Date(baseDateObj);
        targetDate.setDate(baseDateObj.getDate() + weekOffsetDays + dayDiff);
        const dateStr = targetDate.toISOString().split('T')[0];

        const sessionPrefix = autoNumberSessions ? `Practice #${sessionCounter}: ` : '';
        const title = `Week ${wkStr} - ${dayCfg.dayName} ${dayCfg.titleSuffix || dayCfg.type.toUpperCase()}`;

        items.push({
          week: wkStr,
          date: dateStr,
          dayName: dayCfg.dayName,
          dayIndex: dayCfg.dayIndex,
          title,
          startTime: dayCfg.startTime,
          endTime: dayCfg.endTime,
          location: dayCfg.location,
          gear: dayCfg.gear,
          focus: dayCfg.focus,
          type: dayCfg.type,
          templateName: dayCfg.templateName,
        });

        sessionCounter++;
      });
    });

    // Sort items by date then time
    return items.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [selectedWeeks, activeDaysList, kickoffDate, autoNumberSessions]);

  // Compute total practice hours
  const totalPracticeHours = useMemo(() => {
    let totalMinutes = 0;
    generatedPreview.forEach((item) => {
      const [sH, sM] = item.startTime.split(':').map((v) => parseInt(v, 10));
      const [eH, eM] = item.endTime.split(':').map((v) => parseInt(v, 10));
      const startMin = (sH || 0) * 60 + (sM || 0);
      const endMin = (eH || 0) * 60 + (eM || 0);
      if (endMin > startMin) {
        totalMinutes += endMin - startMin;
      }
    });
    return (totalMinutes / 60).toFixed(1);
  }, [generatedPreview]);

  // Execute Generation
  const handleExecuteGenerate = () => {
    if (generatedPreview.length === 0) {
      alert('Please select at least 1 week and 1 practice day.');
      return;
    }

    const scheduleEventsToCreate: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[] = [];
    const practicePlansToCreate: PracticePlan[] = [];

    generatedPreview.forEach((item) => {
      const planId = 'prac_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      // Find template
      const allTemplates = { ...DEFAULT_PRACTICE_TEMPLATES, ...practiceTemplates };
      const selectedPlanTemplate = allTemplates[item.templateName] || DEFAULT_PRACTICE_TEMPLATES['Standard Practice'] || [];

      if (createPracticePlans) {
        const newPlan: PracticePlan = {
          id: planId,
          year: seasonYear,
          weekFolder: `Week ${item.week}`,
          title: item.title,
          date: item.date,
          day: item.dayName,
          startTime: item.startTime,
          lastEdited: Date.now(),
          plan: deepClone(selectedPlanTemplate),
        };
        practicePlansToCreate.push(newPlan);
      }

      if (createScheduleEvents) {
        scheduleEventsToCreate.push({
          type: item.type,
          title: item.title,
          week: item.week,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          location: item.location,
          locationType: 'home',
          arrivalMinutesBefore: 15,
          uniform: item.gear,
          focusOrNotes: item.focus,
          linkedPracticePlanId: createPracticePlans ? planId : undefined,
        });
      }
    });

    onGenerate({
      scheduleEvents: scheduleEventsToCreate,
      practicePlans: practicePlansToCreate,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-850 bg-slate-900 border border-slate-700/90 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
                Multi-Week Practice & Schedule Wizard
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Season Automation
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure recurring days, times, gear, and templates across multiple weeks in 1 click.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* STEP 1: WEEKS & SEASON DATES */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-500 text-white font-black text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-black text-sm text-slate-200">
                  Select Season Weeks to Generate
                </h3>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="text-slate-400 text-[11px] mr-1">Quick Select:</span>
                <button
                  type="button"
                  onClick={() => handleSelectPresetWeeks(8)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-indigo-300 rounded-lg border border-indigo-500/30 transition-all active:scale-95"
                >
                  Weeks 1–8
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPresetWeeks(10)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-indigo-300 rounded-lg border border-indigo-500/30 transition-all active:scale-95"
                >
                  Weeks 1–10
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllWeeks}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-emerald-300 rounded-lg border border-emerald-500/30 transition-all active:scale-95"
                >
                  All (1–12)
                </button>
                <button
                  type="button"
                  onClick={handleClearAllWeeks}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 transition-all active:scale-95"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Week Selector Chips */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
              {ALL_AVAILABLE_WEEKS.map((wk) => {
                const isSelected = selectedWeeks.includes(wk);
                return (
                  <button
                    key={wk}
                    type="button"
                    onClick={() => handleToggleWeek(wk)}
                    className={`py-2 px-1 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 border ${
                      isSelected
                        ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-400 shadow-md shadow-indigo-600/30 scale-100 ring-2 ring-indigo-400/40'
                        : 'bg-slate-900 hover:bg-slate-750 hover:bg-slate-700 text-slate-400 border-slate-750 border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span>Wk {wk}</span>
                    {isSelected && <Check className="w-3 h-3 text-indigo-200" />}
                  </button>
                );
              })}
            </div>

            {/* Kickoff / Base Anchor Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700/60">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Season Kickoff Date (Week 1 Start Reference):</span>
                </label>
                <input
                  type="date"
                  value={kickoffDate}
                  onChange={(e) => setKickoffDate(e.target.value)}
                  className="w-full bg-slate-900 text-slate-100 font-bold p-2.5 rounded-xl border border-slate-700 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
                <p className="text-[10.5px] text-slate-400 mt-1">
                  Each subsequent week will be automatically spaced +7 calendar days apart.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Season Year:
                </label>
                <input
                  type="text"
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(e.target.value)}
                  placeholder="2026"
                  className="w-full bg-slate-900 text-slate-100 font-bold p-2.5 rounded-xl border border-slate-700 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* STEP 2: PRACTICE DAYS & CONFIGURATION */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="font-black text-sm text-slate-200">
                  Select Days of the Week & Customize Settings
                </h3>
              </div>
              <span className="text-xs text-amber-400 font-bold">
                {activeDaysList.length} Day{activeDaysList.length !== 1 ? 's' : ''} Selected per Week
              </span>
            </div>

            {/* Day Selection Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((dIdx) => {
                const dayCfg = daysConfig[dIdx];
                const isEnabled = dayCfg.enabled;
                const isExpanded = expandedDayIndex === dIdx;

                return (
                  <div
                    key={dIdx}
                    className={`rounded-2xl border p-2.5 transition-all flex flex-col justify-between gap-2 ${
                      isEnabled
                        ? 'bg-slate-900 border-amber-500/60 shadow-md shadow-amber-500/10'
                        : 'bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleToggleDay(dIdx)}
                          className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-600 focus:ring-amber-400"
                        />
                        <span className={`text-xs font-black ${isEnabled ? 'text-amber-300' : 'text-slate-400'}`}>
                          {dayCfg.shortName}
                        </span>
                      </label>
                    </div>

                    {isEnabled && (
                      <button
                        type="button"
                        onClick={() => setExpandedDayIndex(isExpanded ? null : dIdx)}
                        className="text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 py-1 px-1.5 rounded-lg flex items-center justify-between transition-all"
                      >
                        <span>{dayCfg.startTime}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Expanded Day Detailed Editor */}
            {expandedDayIndex !== null && daysConfig[expandedDayIndex] && daysConfig[expandedDayIndex].enabled && (
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4.5 space-y-4 mt-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black">
                      {daysConfig[expandedDayIndex].dayName} Settings
                    </span>
                    <span className="text-xs text-slate-400">
                      Customize session details for all {daysConfig[expandedDayIndex].dayName}s across the season.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopySettingsToAllDays(expandedDayIndex)}
                    title="Copy these times, location, gear, and template to all other active practice days"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Apply to All Active Days</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {/* Session Type */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Session Type:</label>
                    <select
                      value={daysConfig[expandedDayIndex].type}
                      onChange={(e) =>
                        handleUpdateDayConfig(expandedDayIndex, {
                          type: e.target.value as any,
                        })
                      }
                      className="w-full bg-slate-800 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none"
                    >
                      <option value="practice">🏈 Practice (Regular)</option>
                      <option value="walkthrough">👟 Walkthrough / Shells</option>
                      <option value="scrimmage">⚔️ Practice / Scrimmage</option>
                      <option value="meeting">📋 Film / Chalk Talk</option>
                    </select>
                  </div>

                  {/* Title Suffix */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Session Title Theme:</label>
                    <input
                      type="text"
                      value={daysConfig[expandedDayIndex].titleSuffix}
                      onChange={(e) =>
                        handleUpdateDayConfig(expandedDayIndex, {
                          titleSuffix: e.target.value,
                        })
                      }
                      placeholder="e.g. Full Pads - Inside Run"
                      className="w-full bg-slate-800 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none"
                    />
                  </div>

                  {/* Start Time */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Start Time:</span>
                    </label>
                    <input
                      type="time"
                      value={daysConfig[expandedDayIndex].startTime}
                      onChange={(e) =>
                        handleUpdateDayConfig(expandedDayIndex, {
                          startTime: e.target.value,
                        })
                      }
                      className="w-full bg-slate-800 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none"
                    />
                  </div>

                  {/* End Time */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>End Time:</span>
                    </label>
                    <input
                      type="time"
                      value={daysConfig[expandedDayIndex].endTime}
                      onChange={(e) =>
                        handleUpdateDayConfig(expandedDayIndex, {
                          endTime: e.target.value,
                        })
                      }
                      className="w-full bg-slate-800 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Field Location */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      <span>Field Location:</span>
                    </label>
                    <input
                      type="text"
                      value={daysConfig[expandedDayIndex].location}
                      onChange={(e) =>
                        handleUpdateDayConfig(expandedDayIndex, {
                          location: e.target.value,
                        })
                      }
                      placeholder="e.g. Mahopac High School - Turf Field"
                      className="w-full bg-slate-800 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none"
                    />
                  </div>

                  {/* Gear / Attire */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-sky-400" />
                      <span>Gear / Attire:</span>
                    </label>
                    <select
                      value={daysConfig[expandedDayIndex].gear}
                      onChange={(e) =>
                        handleUpdateDayConfig(expandedDayIndex, {
                          gear: e.target.value,
                        })
                      }
                      className="w-full bg-slate-800 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none"
                    >
                      <option value="Full Pads">Full Pads (Tackle)</option>
                      <option value="Helmets & Shells">Helmets & Shells (Thud)</option>
                      <option value="Helmets Only">Helmets Only</option>
                      <option value="Uppers (Pads & Shorts)">Uppers (Pads & Shorts)</option>
                      <option value="No Pads (Tee/Shorts)">No Pads (Tee/Shorts)</option>
                    </select>
                  </div>

                  {/* Practice Template */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-emerald-400" />
                      <span>Attached Plan Template:</span>
                    </label>
                    <select
                      value={daysConfig[expandedDayIndex].templateName}
                      onChange={(e) =>
                        handleUpdateDayConfig(expandedDayIndex, {
                          templateName: e.target.value,
                        })
                      }
                      className="w-full bg-slate-800 text-slate-100 font-bold p-2 rounded-xl border border-slate-700 focus:outline-none"
                    >
                      {availableTemplatesList.map((tpl) => (
                        <option key={tpl} value={tpl}>
                          {tpl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Focus / Notes */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Daily Coaching Focus / Drill Notes:
                  </label>
                  <input
                    type="text"
                    value={daysConfig[expandedDayIndex].focus}
                    onChange={(e) =>
                      handleUpdateDayConfig(expandedDayIndex, {
                        focus: e.target.value,
                      })
                    }
                    placeholder="e.g. Inside run, blitz pickup, tackling circuits, and team 11-on-11."
                    className="w-full bg-slate-800 text-slate-100 font-medium p-2 rounded-xl border border-slate-700 focus:outline-none text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: AUTOMATION & INTEGRATION TOGGLES */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="font-black text-sm text-slate-200">
                Automation & Hub Integration
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 bg-slate-900/90 rounded-xl border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createScheduleEvents}
                  onChange={(e) => setCreateScheduleEvents(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-600 focus:ring-amber-400"
                />
                <div>
                  <span className="font-bold text-slate-200 block">Season Schedule Hub</span>
                  <span className="text-[11px] text-slate-400">
                    Add entries to the Master Calendar, Timeline, and Schedule view.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-slate-900/90 rounded-xl border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createPracticePlans}
                  onChange={(e) => setCreatePracticePlans(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-600 focus:ring-amber-400"
                />
                <div>
                  <span className="font-bold text-slate-200 block">Practice Plan Generator</span>
                  <span className="text-[11px] text-slate-400">
                    Generate structured editable periods & stations from selected templates.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-slate-900/90 rounded-xl border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoNumberSessions}
                  onChange={(e) => setAutoNumberSessions(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-600 focus:ring-amber-400"
                />
                <div>
                  <span className="font-bold text-slate-200 block">Auto-Number Sessions</span>
                  <span className="text-[11px] text-slate-400">
                    Format titles sequentially (e.g. Practice #1, Practice #2...).
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* GENERATION SUMMARY & PREVIEW ACCORDION */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Total Sessions: </span>
                  <span className="font-black text-amber-400 text-sm">{generatedPreview.length}</span>
                </div>
                <div className="h-4 w-px bg-slate-700" />
                <div>
                  <span className="text-slate-400">Weeks: </span>
                  <span className="font-black text-indigo-300">{selectedWeeks.length} Weeks</span>
                </div>
                <div className="h-4 w-px bg-slate-700" />
                <div>
                  <span className="text-slate-400">Total Practice Time: </span>
                  <span className="font-black text-emerald-400">{totalPracticeHours} Hours</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewList(!showPreviewList)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
              >
                <span>{showPreviewList ? 'Hide Detailed Preview' : 'Show Detailed Preview'}</span>
                {showPreviewList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* PREVIEW LIST DRAWER */}
            {showPreviewList && (
              <div className="max-h-56 overflow-y-auto border-t border-slate-800 pt-3 space-y-1.5 custom-scrollbar text-xs">
                {generatedPreview.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between flex-wrap gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-600/30 text-indigo-300 font-black text-[11px] border border-indigo-500/30">
                        Wk {item.week}
                      </span>
                      <span className="font-bold text-slate-200">{item.dayName}, {item.date}</span>
                      <span className="text-slate-400 text-[11px]">• {item.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-amber-400 font-semibold">{item.startTime} - {item.endTime}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-medium">{item.gear}</span>
                      <span className="text-emerald-400 font-medium">{item.templateName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-700/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteGenerate}
            disabled={generatedPreview.length === 0}
            className={`px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
              generatedPreview.length > 0
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>
              Generate {generatedPreview.length} Practice Session{generatedPreview.length !== 1 ? 's' : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
