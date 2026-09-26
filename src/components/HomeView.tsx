import React, { useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Swords,
  ClipboardList,
  ArrowRight,
  ExternalLink,
  Shield,
  Zap,
  Dumbbell,
  FileSpreadsheet,
  Watch,
  Printer,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Users,
  Shirt,
  Trophy,
  ClipboardCheck,
  Activity,
} from 'lucide-react';
import {
  ScheduleEvent,
  PracticePlan,
  Team,
  UnitType,
  UserRole,
  SeasonConfig,
  RosterPlayer,
} from '../types';

interface HomeViewProps {
  scheduleEvents: ScheduleEvent[];
  practicePlans: PracticePlan[];
  activeTeam?: Team;
  teams: Team[];
  onSelectTeam: (teamId: string) => void;
  currentWeek: string;
  seasonConfig: SeasonConfig;
  onNavigateToUnit: (unit: UnitType, options?: any) => void;
  onSelectPractice?: (practiceId: string) => void;
  onOpenPrintPractice?: (plan: PracticePlan) => void;
  roster?: RosterPlayer[];
  userRole: UserRole;
}

export const HomeView: React.FC<HomeViewProps> = ({
  scheduleEvents,
  practicePlans,
  activeTeam,
  currentWeek,
  seasonConfig,
  onNavigateToUnit,
  onSelectPractice,
  onOpenPrintPractice,
  roster = [],
  userRole,
}) => {
  // Format today's date cleanly
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const formattedToday = useMemo(() => {
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [today]);

  // Helper to format date labels e.g. "Saturday, Sep 12"
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  // 1. Determine Today / Upcoming Practice
  const practiceEventData = useMemo(() => {
    const validPlans = (practicePlans || []).filter(
      (p) =>
        p &&
        p.id &&
        p.id !== 'p_w3_2' &&
        p.title !== 'Week 3 - Situational 2-Minute & Scrimmage' &&
        !p.isCancelled &&
        (!p.teamId || !activeTeam || p.teamId === activeTeam.id)
    );

    // Prioritize most recent practice plan for today
    const todayPlans = validPlans
      .filter((p) => p.date && p.date.split('T')[0] === todayStr)
      .sort((a, b) => (b.lastEdited || b.createdAt || 0) - (a.lastEdited || a.createdAt || 0));
    const mostRecentTodayPlan = todayPlans[0] || null;

    const teamPractices = (scheduleEvents || [])
      .filter((e) => e && (e.type === 'practice' || e.type === 'walkthrough') && !e.isCancelled && (!e.teamId || !activeTeam || e.teamId === activeTeam.id))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const todayEvent = teamPractices.find((e) => e.date && e.date.split('T')[0] === todayStr);

    if (mostRecentTodayPlan) {
      const derivedEvent: ScheduleEvent = todayEvent || {
        id: `derived_today_${mostRecentTodayPlan.id}`,
        teamId: mostRecentTodayPlan.teamId || activeTeam?.id || 'team_10u',
        type: 'practice',
        title: mostRecentTodayPlan.title || "Today's Practice Plan",
        week: mostRecentTodayPlan.weekFolder ? mostRecentTodayPlan.weekFolder.replace(/^week\s*/i, '') : String(currentWeek || '1'),
        date: todayStr,
        startTime: mostRecentTodayPlan.startTime || '17:30',
        endTime: mostRecentTodayPlan.endTime || '19:00',
        location: mostRecentTodayPlan.location || 'Crane Road',
        linkedPracticePlanId: mostRecentTodayPlan.id,
        createdAt: mostRecentTodayPlan.createdAt || Date.now(),
        lastEdited: mostRecentTodayPlan.lastEdited || Date.now(),
      };
      return {
        event: derivedEvent,
        plan: mostRecentTodayPlan,
        isToday: true,
      };
    }

    if (todayEvent) {
      let linkedPlan: PracticePlan | null = null;
      if (todayEvent.linkedPracticePlanId) {
        linkedPlan = validPlans.find((p) => p.id === todayEvent.linkedPracticePlanId) || null;
      }
      return {
        event: todayEvent,
        plan: linkedPlan,
        isToday: true,
      };
    }

    if (teamPractices.length === 0) return null;

    // Find upcoming future practices
    const upcoming = teamPractices.filter((e) => {
      const eventEnd = new Date(`${e.date}T${e.endTime || e.startTime || '23:59'}:00`);
      return eventEnd.getTime() >= today.getTime();
    });

    const selectedEvent = upcoming.length > 0 ? upcoming[0] : teamPractices[teamPractices.length - 1];
    if (!selectedEvent) return null;

    // Match linked practice plan
    let linkedPlan: PracticePlan | null = null;
    if (selectedEvent.linkedPracticePlanId) {
      linkedPlan = validPlans.find((p) => p.id === selectedEvent.linkedPracticePlanId) || null;
    }
    if (!linkedPlan) {
      linkedPlan = validPlans.find(
        (p) => p.date === selectedEvent.date || (p.weekFolder && (p.weekFolder === selectedEvent.week || p.weekFolder.includes(selectedEvent.week)))
      ) || null;
    }

    return {
      event: selectedEvent,
      plan: linkedPlan,
      isToday: false,
    };
  }, [scheduleEvents, practicePlans, today, todayStr, activeTeam, currentWeek]);

  // 2. Determine Upcoming Game or Scrimmage
  const gameEventData = useMemo(() => {
    const teamGames = (scheduleEvents || [])
      .filter((e) => e && (e.type === 'game' || e.type === 'scrimmage') && !e.isCancelled)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (teamGames.length === 0) return null;

    const upcoming = teamGames.filter((e) => {
      const eventEnd = new Date(`${e.date}T${e.endTime || e.startTime || '23:59'}:00`);
      return eventEnd.getTime() >= today.getTime();
    });

    const selectedEvent = upcoming.length > 0 ? upcoming[0] : teamGames[teamGames.length - 1];
    if (!selectedEvent) return null;

    const isToday = selectedEvent.date === todayStr;

    return {
      event: selectedEvent,
      isToday,
    };
  }, [scheduleEvents, today, todayStr]);

  const handleOpenPracticePlan = (planId?: string) => {
    // 1. If there's a practice plan for today, open the most recent plan for today!
    const validPlans = (practicePlans || []).filter(
      (p) =>
        p &&
        p.id &&
        p.id !== 'p_w3_2' &&
        p.title !== 'Week 3 - Situational 2-Minute & Scrimmage' &&
        !p.isCancelled &&
        (!p.teamId || !activeTeam || p.teamId === activeTeam.id)
    );
    const todayPlans = validPlans
      .filter((p) => p.date && p.date.split('T')[0] === todayStr)
      .sort((a, b) => (b.lastEdited || b.createdAt || 0) - (a.lastEdited || a.createdAt || 0));
    const mostRecentTodayPlan = todayPlans[0] || null;

    const targetId = mostRecentTodayPlan?.id || planId || practiceEventData?.plan?.id;

    if (targetId) {
      if (onSelectPractice) onSelectPractice(targetId);
      onNavigateToUnit('practice', { practiceId: targetId });
    } else {
      onNavigateToUnit('practice');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-28 md:pb-12 max-w-7xl mx-auto px-1 sm:px-2 md:px-0">
      {/* 1. Splash: today, team, roster size. Team switching is in the header; attendance is on the practice card. */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl px-4 py-3.5 sm:px-6 sm:py-5 shadow-xs flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="space-y-1 min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            {formattedToday} · Week {currentWeek}
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
            {activeTeam?.name || 'Mahopac 10U Indians'}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
          <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>{roster.length} players</span>
        </div>
      </div>

      {/* =========================================================================
          2. UPCOMING PRACTICE & UPCOMING GAME HERO SECTION (PC & MOBILE SPLASH)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* -------------------------------------------------------------
            CARD 1: UPCOMING PRACTICE INFO & DIRECT LINKS
            ------------------------------------------------------------- */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm dark:shadow-xl flex flex-col justify-between transition-all group">
          <div className="space-y-3 sm:space-y-4">
            {/* Header / Badge */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${
                    practiceEventData?.isToday
                      ? 'bg-emerald-500 text-slate-950 shadow-md animate-pulse'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>{practiceEventData?.isToday ? "TODAY'S PRACTICE" : 'UPCOMING PRACTICE'}</span>
                </span>
                {practiceEventData?.event?.attireCategory && (
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    {practiceEventData.event.attireCategory.replace('_', ' ')}
                  </span>
                )}
              </div>

              {practiceEventData?.event?.startTime && (
                <span className="text-xs font-black text-amber-700 dark:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-slate-800 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    {practiceEventData.event.startTime}
                    {practiceEventData.event.endTime ? ` - ${practiceEventData.event.endTime}` : ''}
                  </span>
                </span>
              )}
            </div>

            {practiceEventData ? (
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                    {practiceEventData.event.title || 'Team Practice'}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                    <span>{formatDateLabel(practiceEventData.event.date)}</span>
                    <span>•</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">Week {practiceEventData.event.week}</span>
                  </p>
                </div>

                {/* Location */}
                {practiceEventData.event.location && (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate font-semibold">{practiceEventData.event.location}</span>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(practiceEventData.event.location)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Map</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Practice Script Preview / Highlights */}
                {practiceEventData.plan ? (
                  <div className="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-950/70 rounded-2xl border border-slate-200 dark:border-slate-800/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800 dark:text-slate-300 truncate">
                        📋 {practiceEventData.plan.title}
                      </span>
                      <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                        {practiceEventData.plan.periods?.length || 0} Periods
                      </span>
                    </div>

                    {/* Drill Periods Chips */}
                    {practiceEventData.plan.periods?.some((p) => p.name || p.title || p.category) && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {practiceEventData.plan.periods.slice(0, 4).map((period, idx) => {
                          const label = period.name || period.title || period.category;
                          if (!label) return null;
                          return (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 shadow-2xs"
                            >
                              P{idx + 1}: {label}
                            </span>
                          );
                        })}
                        {practiceEventData.plan.periods.length > 4 && (
                          <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 shadow-2xs">
                            +{practiceEventData.plan.periods.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    No specific practice plan attached yet for this session.
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No upcoming practice scheduled.</p>
                <button
                  type="button"
                  onClick={() => onNavigateToUnit('schedule')}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Add a practice on the Schedule
                </button>
              </div>
            )}
          </div>

          {/* Action Links & Buttons */}
          <div className="pt-4 sm:pt-5 mt-3 sm:mt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
            <button
              type="button"
              onClick={() => handleOpenPracticePlan(practiceEventData?.plan?.id)}
              className="w-full min-h-[46px] py-3 sm:py-3.5 px-4 font-black text-xs sm:text-sm rounded-2xl border border-indigo-500 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <ClipboardList className="w-4 h-4 text-white" />
              <span>Open Practice Plan & Drill Script</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>

            {/* Single direct action button for Player Roll Call & Attendance */}
            <button
              type="button"
              onClick={() => onNavigateToUnit('compliance', { openTakeAttendance: true })}
              className="w-full min-h-[44px] py-2.5 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs dark:shadow-md group active:scale-98"
              title="Open Player Roll Call & Practice Attendance"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-3.5 h-3.5" />
              </div>
              <span>Take Practice Attendance • Player Roll Call</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

        {/* -------------------------------------------------------------
            CARD 2: UPCOMING GAME INFO & DIRECT LINKS
            ------------------------------------------------------------- */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm dark:shadow-xl flex flex-col justify-between transition-all group">
          <div className="space-y-3 sm:space-y-4">
            {/* Header / Badge */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-black tracking-wider uppercase flex items-center gap-1.5 ${
                    gameEventData?.event.type === 'scrimmage'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30'
                      : 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                  }`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>
                    {gameEventData?.isToday
                      ? "TODAY'S GAME"
                      : gameEventData?.event.type === 'scrimmage'
                      ? 'NEXT SCRIMMAGE'
                      : 'UPCOMING GAME'}
                  </span>
                </span>

                {gameEventData?.event.locationType && (
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    {gameEventData.event.locationType}
                  </span>
                )}
              </div>

              {gameEventData?.event.startTime && (
                <span className="text-xs font-black text-rose-700 dark:text-rose-300 flex items-center gap-1 bg-rose-50 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-slate-800 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Kickoff: {gameEventData.event.startTime}</span>
                </span>
              )}
            </div>

            {gameEventData ? (
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">
                    {gameEventData.event.opponent ? `vs ${gameEventData.event.opponent}` : gameEventData.event.title}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                    <span>{formatDateLabel(gameEventData.event.date)}</span>
                    <span>•</span>
                    <span className="text-rose-600 dark:text-rose-400 font-extrabold">Week {gameEventData.event.week}</span>
                  </p>
                </div>

                {/* Location with Google Maps directions */}
                {gameEventData.event.location && (
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span className="truncate font-semibold">{gameEventData.event.location}</span>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(gameEventData.event.location)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Directions</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Uniform & Arrival Info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-950/70 rounded-2xl border border-slate-200 dark:border-slate-800/70">
                    <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                      <Shirt className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Uniform</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
                      {gameEventData.event.uniform || (gameEventData.event.locationType === 'away' ? 'White Jerseys (Away)' : 'Dark / Gold (Home)')}
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-950/70 rounded-2xl border border-slate-200 dark:border-slate-800/70">
                    <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>Warmups</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
                      {gameEventData.event.arrivalMinutesBefore
                        ? `${gameEventData.event.arrivalMinutesBefore}m prior`
                        : '60m before kickoff'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No upcoming game scheduled.</p>
                <button
                  type="button"
                  onClick={() => onNavigateToUnit('schedule')}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Add a game on the Schedule
                </button>
              </div>
            )}
          </div>

          {/* Action Links & Buttons */}
          <div className="pt-4 sm:pt-5 mt-3 sm:mt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
            <button
              type="button"
              onClick={() => onNavigateToUnit('game_day')}
              className="w-full min-h-[46px] py-3 px-4 font-black text-xs sm:text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Trophy className="w-4 h-4 text-white" />
              <span className="text-white">Launch Game Day Sideline Hub</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onNavigateToUnit('call_sheet')}
                className="min-h-[42px] py-2 sm:py-2.5 px-1.5 sm:px-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-98"
                title="Offensive & Defensive Call Sheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">Call Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToUnit('wristband')}
                className="min-h-[42px] py-2 sm:py-2.5 px-1.5 sm:px-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-98"
                title="Player Wristband Card"
              >
                <Watch className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">Wristbands</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateToUnit('depth_chart')}
                className="min-h-[42px] py-2 sm:py-2.5 px-1.5 sm:px-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-98"
                title="Starters & Depth Chart"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Depth Chart</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tools that aren't already a button on the cards above (the sidebar has everything else). */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">More tools</span>
          <button
            type="button"
            onClick={() => onNavigateToUnit('ppr')}
            className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>PFF film grades</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToUnit('drills')}
            className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Dumbbell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Drill Library</span>
          </button>
      </div>
    </div>
  );
};
