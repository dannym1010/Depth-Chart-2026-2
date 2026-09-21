import React, { useState, useMemo } from 'react';
import {
  Maximize,
  Download,
  Upload,
  RotateCcw,
  Copy,
  LogOut,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Calendar,
  Users,
  Settings,
  Star,
  Sliders,
  Cloud,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Zap,
  Smartphone,
  Layers,
  Sun,
  Moon,
} from 'lucide-react';
import { UserRole, SeasonConfig, Team, formatWeekLabel } from '../types';
import { getAutoActiveWeek, getSeasonWeekList, getWeekDisplayLabelWithOpponent } from '../utils/seasonWeekUtils';

interface HeaderProps {
  currentWeek: string;
  onWeekChange: (week: string) => void;
  opponent: string;
  onOpponentChange: (opp: string) => void;
  userEmail: string;
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  syncStatus: { text: string; color: string };
  onSignOut: () => void;
  onToggleFullScreen: () => void;
  onExportData: () => void;
  onImportClick: () => void;
  onResetData: () => void;
  onOpenCopyWeekModal: () => void;
  activeUnit?: string;
  onNavigateToHome?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToMobileHub?: () => void;
  seasonConfig?: SeasonConfig;
  onOpenSeasonConfigModal?: () => void;
  teams?: Team[];
  activeTeamId?: string;
  defaultTeamId?: string;
  onSelectTeam?: (teamId: string) => void;
  onSetDefaultTeam?: (teamId: string) => void;
  onOpenManageTeams?: () => void;
  onOpenPreferencesModal?: () => void;
  onOpenThemeGallery?: () => void;
  userAssignedTeamIds?: string[];
  scheduleEvents?: import('../types').ScheduleEvent[];
  onForceSave?: () => void;
  onForceRefresh?: () => void;
  onOpenMobileNav?: () => void;
  themeMode?: 'dark' | 'light';
  onToggleThemeMode?: () => void;
  activeCoachesCount?: number;
  onOpenActiveCoachesModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentWeek,
  onWeekChange,
  opponent,
  onOpponentChange,
  userEmail,
  userRole,
  onRoleChange,
  syncStatus,
  onSignOut,
  onToggleFullScreen,
  onExportData,
  onImportClick,
  onResetData,
  onOpenCopyWeekModal,
  activeUnit,
  onNavigateToHome,
  onNavigateToSchedule,
  onNavigateToMobileHub,
  seasonConfig,
  onOpenSeasonConfigModal,
  teams = [],
  activeTeamId,
  defaultTeamId,
  onSelectTeam,
  onSetDefaultTeam,
  onOpenManageTeams,
  onOpenPreferencesModal,
  onOpenThemeGallery,
  userAssignedTeamIds,
  scheduleEvents = [],
  onForceSave,
  onForceRefresh,
  onOpenMobileNav,
  themeMode = 'dark',
  onToggleThemeMode,
  activeCoachesCount = 1,
  onOpenActiveCoachesModal,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Find scheduled game for current week
  const matchedScheduledGame = useMemo(() => {
    if (!scheduleEvents || scheduleEvents.length === 0) return null;
    const cleanWeek = currentWeek.replace(/^Week\s+/i, '').trim();
    return scheduleEvents.find((ev) => {
      if (ev.type !== 'game' && ev.type !== 'scrimmage') return false;
      const evWeek = (ev.week || '').replace(/^Week\s+/i, '').trim();
      if (evWeek === cleanWeek) return true;
      if (
        cleanWeek === '0' &&
        (evWeek.startsWith('pre') || evWeek === '0' || (ev.title && ev.title.toLowerCase().includes('pre-season')))
      ) {
        return true;
      }
      if (
        cleanWeek === 'playoffs' &&
        (evWeek === 'playoffs' || evWeek === 'post' || evWeek === 'championship')
      ) {
        return true;
      }
      return false;
    });
  }, [scheduleEvents, currentWeek]);

  // Filter accessible teams: admin has full access to all teams
  const accessibleTeams = useMemo(() => {
    if (userRole === 'admin') {
      return teams;
    }
    if (userAssignedTeamIds && userAssignedTeamIds.length > 0) {
      if (userAssignedTeamIds.includes('all')) return teams;
      const permitted = teams.filter((t) => userAssignedTeamIds.includes(t.id));
      return permitted.length > 0 ? permitted : teams.slice(0, 1);
    }
    return teams.slice(0, 1);
  }, [teams, userRole, userAssignedTeamIds]);

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];
  const isCurrentTeamDefault = activeTeam && (defaultTeamId || (teams[0] && teams[0].id)) === activeTeam.id;

  const allWeeks = useMemo(() => getSeasonWeekList(seasonConfig), [seasonConfig]);
  const currentWeekIdx = allWeeks.findIndex((w) => w.key === currentWeek);

  const handlePrevWeek = () => {
    if (currentWeekIdx > 0) {
      onWeekChange(allWeeks[currentWeekIdx - 1].key);
    }
  };

  const handleNextWeek = () => {
    if (currentWeekIdx < allWeeks.length - 1) {
      onWeekChange(allWeeks[currentWeekIdx + 1].key);
    }
  };

  const autoWeekInfo = useMemo(() => getAutoActiveWeek(scheduleEvents), [scheduleEvents]);

  return (
    <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs dark:shadow-xl sticky top-0 z-40 print:hidden">
      {/* =========================================================================
          1. SLEEK COMPACT MOBILE HEADER (< md: 768px)
          ========================================================================= */}
      <div className="md:hidden px-3 py-2.5 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80">
        {/* Left: Team Selector Pill */}
        <div className="flex items-center gap-1.5 min-w-0 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 px-2 py-1 rounded-xl shadow-inner">
          <span className="text-base select-none">🏈</span>
          <select
            value={activeTeamId || (accessibleTeams && accessibleTeams[0]?.id) || ''}
            onChange={(e) => onSelectTeam && onSelectTeam(e.target.value)}
            className="bg-transparent font-black text-xs text-indigo-700 dark:text-indigo-400 focus:outline-none cursor-pointer truncate max-w-[130px]"
          >
            {(accessibleTeams || []).map((t) => (
              <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                {t.name} {t.ageGroup ? `(${t.ageGroup})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Center: Week Selector Pill */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 px-1.5 py-0.5 rounded-xl">
          <button
            type="button"
            onClick={handlePrevWeek}
            disabled={currentWeekIdx <= 0}
            className="p-1 text-slate-400 hover:text-indigo-400 disabled:opacity-20 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 px-1 whitespace-nowrap">
            {formatWeekLabel(currentWeek)}
          </span>
          <button
            type="button"
            onClick={handleNextWeek}
            disabled={currentWeekIdx >= allWeeks.length - 1}
            className="p-1 text-slate-400 hover:text-indigo-400 disabled:opacity-20 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Quick HUD & Consolidated Mobile Menu Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onNavigateToMobileHub && (
            <button
              type="button"
              onClick={onNavigateToMobileHub}
              className={`px-2 py-1 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer border active:scale-95 ${
                activeUnit === 'mobile_hub'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/40'
                  : 'bg-slate-100 dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-slate-200 dark:border-slate-700 hover:border-indigo-500/50'
              }`}
              title="Open Mobile Coach HUD"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>HUD</span>
            </button>
          )}
          <div
            title={syncStatus.text}
            className="w-2.5 h-2.5 rounded-full animate-pulse shadow-sm shadow-indigo-400/50"
            style={{ backgroundColor: syncStatus.color || '#6366f1' }}
          />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 active:scale-95 transition-all cursor-pointer shadow-xs dark:shadow-sm"
            title="Open Coach Tools & Settings"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. CONSOLIDATED DESKTOP HEADER BAR (md: and above)
          ========================================================================= */}
      <div className="hidden md:flex max-w-[1700px] mx-auto px-4 py-3 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
        {/* Left: Team & Program Identity */}
        <div
          onClick={onNavigateToHome}
          className={`flex items-center gap-3 min-w-0 ${onNavigateToHome ? 'cursor-pointer group hover:opacity-95 transition-opacity' : ''}`}
          title={onNavigateToHome ? 'Go to Home Splash Dashboard' : undefined}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-indigo-400 ring-1 ring-white/10 shrink-0 group-hover:scale-105 transition-transform">
            <span className="text-xl select-none">🏈</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-black text-base md:text-lg tracking-tight text-slate-900 dark:text-transparent dark:bg-gradient-to-r dark:from-slate-100 dark:via-indigo-200 dark:to-indigo-400 dark:bg-clip-text truncate group-hover:text-indigo-600 dark:group-hover:from-white dark:group-hover:to-indigo-300 transition-colors">
                {activeTeam ? activeTeam.name : 'Football Operations Manager'}
              </h1>
              {activeTeam?.ageGroup && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-400/30 shadow-xs">
                  {activeTeam.ageGroup}
                </span>
              )}
              {activeTeam?.season && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                  {activeTeam.season}
                </span>
              )}
              {isCurrentTeamDefault && (
                <span
                  title="This is your default startup team"
                  className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-xs font-mono"
                >
                  <Star className="w-2.5 h-2.5 fill-white" />
                  <span>Default Squad</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block font-medium truncate">
              Mahopac Football Operations • Modern Varsity Operations Suite
            </p>
          </div>
        </div>

        {/* Right: Consolidated Controls (Active Squad Switcher, Sync Pill, User Profile, Unified Settings) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Active Squad Switcher */}
          {accessibleTeams.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500/50 px-2.5 py-1 rounded-2xl shadow-xs dark:shadow-inner transition-colors">
              <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <select
                value={activeTeamId || (accessibleTeams && accessibleTeams[0]?.id) || ''}
                onChange={(e) => onSelectTeam && onSelectTeam(e.target.value)}
                className="bg-transparent font-black text-xs text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer pr-1 py-0.5"
                title="Switch Active Squad"
              >
                {(accessibleTeams || []).map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold"
                  >
                    {t.name} {t.ageGroup ? `(${t.ageGroup})` : ''} {t.id === defaultTeamId ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Real-time Cloud Sync Pill */}
          <div
            onClick={onForceSave}
            title="Click to force immediate cloud save & sync"
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 px-2.5 py-1.5 rounded-2xl shadow-xs dark:shadow-inner cursor-pointer transition-all active:scale-95 group"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 animate-pulse shadow-xs"
              style={{ backgroundColor: syncStatus.color || '#6366f1' }}
            />
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors hidden lg:inline">
              {syncStatus.text}
            </span>
            {onForceSave && (
              <Cloud className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
            )}
          </div>

          {/* User Profile / Role Pill */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-2xl shadow-xs dark:shadow-inner">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[110px] lg:max-w-[150px]">
              {userEmail}
            </span>
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                userRole === 'admin'
                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-400/40'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
              }`}
            >
              {userRole === 'admin' ? 'COACH ADMIN' : 'VIEWER'}
            </span>
          </div>

          {/* MOBILE HUD SWITCHER BUTTON (Desktop) */}
          {onNavigateToMobileHub && (
            <button
              onClick={onNavigateToMobileHub}
              title="Open Mobile Field HUD (Practice Plan, Starters, Attendance, Guides)"
              className={`px-3 py-1.5 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                activeUnit === 'mobile_hub'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-indigo-700 dark:text-indigo-300 border-slate-200 dark:border-slate-700 hover:border-indigo-500/50'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Mobile HUD</span>
            </button>
          )}

          {/* Quick Light / Dark Theme Mode Toggle */}
          {onToggleThemeMode && (
            <button
              type="button"
              onClick={() => onToggleThemeMode()}
              title={
                themeMode === 'light'
                  ? 'Switch to Dark Mode (Night Stadium)'
                  : 'Switch to Light Mode (Daylight Field)'
              }
              aria-label="Toggle site light and dark mode"
              className={`px-3 py-1.5 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                themeMode === 'light'
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-xs'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-700 hover:border-amber-400/50'
              }`}
            >
              {themeMode === 'light' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-300 fill-indigo-400/30" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          )}

          {/* Active Coaches Online Button */}
          {onOpenActiveCoachesModal && (
            <button
              type="button"
              id="active-coaches-header-btn"
              onClick={onOpenActiveCoachesModal}
              title="View Active Coaches Currently Online"
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-750 rounded-xl flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Users className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline">Online</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold">
                {activeCoachesCount}
              </span>
            </button>
          )}

          {/* UNIFIED "SETTINGS & TOOLS" BUTTON (Consolidates Defaults, Themes, Season Config, Backup, Sync) */}
          {onOpenPreferencesModal && (
            <button
              onClick={onOpenPreferencesModal}
              title="Coach Settings, Season Setup, Visual Themes & Data Backup"
              className="px-3 py-1.5 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer border border-indigo-500"
            >
              <Sliders className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Settings &amp; Tools</span>
            </button>
          )}

          {/* Sign Out Button */}
          <button
            onClick={onSignOut}
            title="Sign Out"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          3. AUTOMATED GAME WEEK & MATCHUP BAR (md: and above)
          ========================================================================= */}
      <div className="hidden md:flex w-full bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1700px] w-full mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Week Selector with Stepper Buttons */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 px-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs dark:shadow-inner">
            <button
              type="button"
              onClick={handlePrevWeek}
              disabled={currentWeekIdx <= 0}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 disabled:opacity-20 cursor-pointer transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={currentWeek}
              onChange={(e) => onWeekChange(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs rounded-xl px-2.5 py-1 focus:outline-none focus:border-indigo-400 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors max-w-[260px] truncate"
              title="Change active depth chart & practice week"
            >
              {(() => {
                const preWeeks = allWeeks.filter((w) => w.phase === 'preseason');
                const regWeeks = allWeeks.filter((w) => w.phase === 'regular');
                const postWeeks = allWeeks.filter((w) => w.phase === 'postseason');
                const customWeeks = allWeeks.filter((w) => w.phase === 'custom');

                return (
                  <>
                    {preWeeks.length > 0 && (
                      <optgroup label="⚡ Pre-Season">
                        {preWeeks.map((w) => (
                          <option key={w.key} value={w.key}>
                            {getWeekDisplayLabelWithOpponent(w.key, w.label, scheduleEvents, activeTeamId)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {regWeeks.length > 0 && (
                      <optgroup label="🏈 Regular Season">
                        {regWeeks.map((w) => (
                          <option key={w.key} value={w.key}>
                            {getWeekDisplayLabelWithOpponent(w.key, w.label, scheduleEvents, activeTeamId)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {postWeeks.length > 0 && (
                      <optgroup label="🏆 Post-Season">
                        {postWeeks.map((w) => (
                          <option key={w.key} value={w.key}>
                            {getWeekDisplayLabelWithOpponent(w.key, w.label, scheduleEvents, activeTeamId)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {customWeeks.length > 0 && (
                      <optgroup label="📌 Special Weeks">
                        {customWeeks.map((w) => (
                          <option key={w.key} value={w.key}>
                            {getWeekDisplayLabelWithOpponent(w.key, w.label, scheduleEvents, activeTeamId)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                );
              })()}
            </select>

            <button
              type="button"
              onClick={handleNextWeek}
              disabled={currentWeekIdx >= allWeeks.length - 1}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 disabled:opacity-20 cursor-pointer transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Auto-detected Game Badge or Quick Return to Current Week */}
          {currentWeek !== autoWeekInfo.activeWeek ? (
            <button
              type="button"
              onClick={() => onWeekChange(autoWeekInfo.activeWeek)}
              className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Jump back to current automated calendar week"
            >
              <Zap className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>Jump to Current ({formatWeekLabel(autoWeekInfo.activeWeek)})</span>
            </button>
          ) : matchedScheduledGame ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Game: {matchedScheduledGame.opponent ? `vs ${matchedScheduledGame.opponent}` : matchedScheduledGame.title} ({matchedScheduledGame.date})
              </span>
            </div>
          ) : null}

          {/* Opponent Input */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider text-[10px]">
              Opponent:
            </span>
            <input
              type="text"
              value={opponent}
              onChange={(e) => onOpponentChange(e.target.value)}
              placeholder={matchedScheduledGame ? `e.g. ${matchedScheduledGame.opponent || matchedScheduledGame.title}` : 'e.g. vs. Somers / Homecoming'}
              disabled={userRole !== 'admin'}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 px-3 py-1 rounded-xl text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 w-44 lg:w-56 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed font-medium shadow-xs"
            />
            {matchedScheduledGame && (
              <button
                type="button"
                onClick={() => {
                  const opp = matchedScheduledGame.opponent || matchedScheduledGame.title;
                  if (opp) onOpponentChange(opp);
                }}
                className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title={`Click to fill opponent from schedule`}
              >
                <span>⚡ Set "{matchedScheduledGame.opponent || matchedScheduledGame.title}"</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Quick Action (Copy Week Lineup) */}
        <div className="flex items-center gap-2">
          {userRole === 'admin' && (
            <button
              onClick={onOpenCopyWeekModal}
              title="Copy Depth Chart & Formations to another week"
              className="px-3 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-400 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Clone Week Lineup</span>
            </button>
          )}
        </div>
        </div>
      </div>

      {/* =========================================================================
          4. SLIDE-OVER MOBILE QUICK MENU MODAL
          ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-4 space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-500/40">
                  <Sliders className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Coach Settings &amp; Tools</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{userEmail}</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-2 text-xs">
              {/* All Navigation Views */}
              {onOpenMobileNav && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenMobileNav();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black shadow-md shadow-indigo-600/30 border border-indigo-400 cursor-pointer active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-white" />
                    <span>Browse All Navigation Views</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-200" />
                </button>
              )}

              {/* Jump to Mobile HUD */}
              {onNavigateToMobileHub && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNavigateToMobileHub();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-bold border border-indigo-200 dark:border-indigo-500/40 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Open Mobile Field HUD</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </button>
              )}

              {/* Force Save */}
              {onForceSave && (
                <button
                  type="button"
                  onClick={() => {
                    onForceSave();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 font-bold border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Save &amp; Sync Cloud Data</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </button>
              )}

              {/* Master Settings & Defaults Modal */}
              {onOpenPreferencesModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenPreferencesModal();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold border border-slate-200 dark:border-indigo-500/30 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Coach Preferences &amp; Defaults</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </button>
              )}

              {/* Quick Light / Dark Theme Mode Toggle (Mobile) */}
              {onToggleThemeMode && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleThemeMode();
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold border cursor-pointer transition-all ${
                    themeMode === 'light'
                      ? 'bg-amber-100/90 text-amber-950 border-amber-300'
                      : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {themeMode === 'light' ? (
                      <Sun className="w-4 h-4 text-amber-600 fill-amber-500" />
                    ) : (
                      <Moon className="w-4 h-4 text-indigo-300 fill-indigo-400/30" />
                    )}
                    <span>Site Theme: {themeMode === 'light' ? 'Light Theme (Daylight)' : 'Dark Theme (Night)'}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30">
                    Switch to {themeMode === 'light' ? 'Dark' : 'Light'}
                  </span>
                </button>
              )}

              {/* Theme Schemes Showcase */}
              {onOpenThemeGallery && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenThemeGallery();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Visual Theme Gallery</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </button>
              )}

              {/* Clone Week Lineup */}
              {userRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenCopyWeekModal();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-cyan-700 dark:text-cyan-300 font-bold border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Clone Week Depth &amp; Formations</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </button>
              )}

              {/* Fullscreen */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onToggleFullScreen();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Maximize className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Toggle Fullscreen</span>
                </div>
              </button>

              {/* Admin Data Backup */}
              {userRole === 'admin' && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onExportData();
                    }}
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold border border-slate-200 dark:border-slate-800 text-center flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onImportClick();
                    }}
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 font-bold border border-slate-200 dark:border-slate-800 text-center flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Import JSON</span>
                  </button>
                </div>
              )}

              {/* Active Coaches Online (Mobile) */}
              {onOpenActiveCoachesModal && (
                <button
                  type="button"
                  id="mobile-active-coaches-btn"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenActiveCoachesModal();
                  }}
                  className="w-full mt-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-emerald-500" />
                    <span>Active Coaches Online</span>
                  </div>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {activeCoachesCount} Online
                  </span>
                </button>
              )}

              {/* Sign Out */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onSignOut();
                }}
                className="w-full mt-2 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-black border border-rose-500/20 text-center flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
