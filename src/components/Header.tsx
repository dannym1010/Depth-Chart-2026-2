import React, { useState, useMemo, useRef, useEffect } from 'react';
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

const WEEK_PHASES = [
  ['preseason', '⚡ Pre-Season'],
  ['regular', '🏈 Regular Season'],
  ['postseason', '🏆 Post-Season'],
  ['custom', '📌 Special Weeks'],
] as const;

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
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountInitial = (userEmail || '?').trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) setIsAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isAccountMenuOpen]);

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
          2. DESKTOP HEADER (md: and above): one row with team, week, and status
          ========================================================================= */}
      <div className="hidden md:flex max-w-[1700px] mx-auto px-4 py-2 items-center gap-3">
        {/* Team: logo goes home, name switches squads */}
        <div className="flex items-center gap-2.5 min-w-0 shrink">
          <button
            type="button"
            onClick={onNavigateToHome}
            title="Home"
            aria-label="Go to home dashboard"
            className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 cursor-pointer hover:bg-indigo-500 transition-colors"
          >
            <span className="text-lg select-none">🏈</span>
          </button>
          {accessibleTeams.length > 1 ? (
            <select
              value={activeTeamId || (accessibleTeams && accessibleTeams[0]?.id) || ''}
              onChange={(e) => onSelectTeam && onSelectTeam(e.target.value)}
              className="min-w-0 max-w-[16rem] bg-transparent font-black text-sm text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer truncate"
              title="Switch team"
            >
              {(accessibleTeams || []).map((t) => (
                <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold">
                  {t.name} {t.ageGroup ? `(${t.ageGroup})` : ''} {t.id === (defaultTeamId || teams[0]?.id) ? '★' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-black text-sm truncate">{activeTeam ? activeTeam.name : 'Football Operations'}</span>
          )}
        </div>

        {/* Week: stepper, this week's game (or a jump back to the current week), and clone */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={handlePrevWeek}
              disabled={currentWeekIdx <= 0}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-20 cursor-pointer"
              title="Previous week"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={currentWeek}
              onChange={(e) => onWeekChange(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-slate-100 font-bold text-xs px-1 py-1 focus:outline-none cursor-pointer max-w-[15rem] truncate"
              title="Change week"
            >
              {WEEK_PHASES.map(([phase, label]) => {
                const weeks = allWeeks.filter((w) => w.phase === phase);
                if (weeks.length === 0) return null;
                return (
                  <optgroup key={phase} label={label}>
                    {weeks.map((w) => (
                      <option key={w.key} value={w.key}>
                        {getWeekDisplayLabelWithOpponent(w.key, w.label, scheduleEvents, activeTeamId)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <button
              type="button"
              onClick={handleNextWeek}
              disabled={currentWeekIdx >= allWeeks.length - 1}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-20 cursor-pointer"
              title="Next week"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {currentWeek !== autoWeekInfo.activeWeek ? (
            <button
              type="button"
              onClick={() => onWeekChange(autoWeekInfo.activeWeek)}
              className="px-2 py-1 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-900 whitespace-nowrap cursor-pointer"
              title="Jump back to this week on the calendar"
            >
              Back to {formatWeekLabel(autoWeekInfo.activeWeek)}
            </button>
          ) : matchedScheduledGame ? (
            <span className="hidden lg:inline text-xs text-slate-500 dark:text-slate-400 truncate">
              {matchedScheduledGame.opponent ? `vs ${matchedScheduledGame.opponent}` : matchedScheduledGame.title}
              {matchedScheduledGame.date ? ` · ${matchedScheduledGame.date}` : ''}
            </span>
          ) : null}

          {userRole === 'admin' && (
            <button
              type="button"
              onClick={onOpenCopyWeekModal}
              title="Copy this week's depth chart, formations, wristband, and call sheet to another week"
              aria-label="Clone week lineup"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status and account, pushed to the right */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onForceSave}
            title={`${syncStatus.text}${onForceSave ? ' (click to save & sync now)' : ''}`}
            aria-label={`Sync status: ${syncStatus.text}`}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer max-w-[11rem]"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: syncStatus.color || '#6366f1' }} />
            <span className="hidden xl:inline truncate">{syncStatus.text}</span>
          </button>

          {onOpenActiveCoachesModal && (
            <button
              type="button"
              id="active-coaches-header-btn"
              onClick={onOpenActiveCoachesModal}
              title={`${activeCoachesCount} coach${activeCoachesCount === 1 ? '' : 'es'} online`}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{activeCoachesCount}</span>
            </button>
          )}

          {onNavigateToMobileHub && (
            <button
              type="button"
              onClick={onNavigateToMobileHub}
              title="Mobile Field HUD (practice plan, starters, attendance, guides)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                activeUnit === 'mobile_hub'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">HUD</span>
            </button>
          )}

          {onOpenPreferencesModal && (
            <button
              type="button"
              onClick={onOpenPreferencesModal}
              title="Coach settings, season setup, visual themes & data backup"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Settings</span>
            </button>
          )}

          {/* Account menu: who is signed in, light/dark, sign out */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              title={userEmail}
              className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black flex items-center justify-center hover:ring-2 hover:ring-indigo-500/50 cursor-pointer"
            >
              {accountInitial}
            </button>
            {isAccountMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50 text-xs">
                <div className="px-3 py-2">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{userEmail}</div>
                  <div className="text-slate-500 dark:text-slate-400">{userRole === 'admin' ? 'Coach admin' : 'Viewer'}</div>
                </div>
                <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                {onToggleThemeMode && (
                  <button
                    type="button"
                    onClick={() => onToggleThemeMode()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {themeMode === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                    <span>{themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
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
                  className="w-full flex items-center justify-between p-3 rounded-xl font-black shadow-md border border-indigo-500 cursor-pointer active:scale-[0.99] transition-all bg-indigo-600 hover:bg-indigo-500 text-white"
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
