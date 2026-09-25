import React, { useState } from 'react';
import { X, Users, RefreshCw, Shield, Clock, Eye, Lock, CheckCircle2 } from 'lucide-react';
import { ActiveUserSession } from '../services/storageService';

interface ActiveCoachesModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUsers: ActiveUserSession[];
  currentUserId?: string;
  currentUserEmail?: string;
  activeLocks?: any[];
  teamNameMap?: Record<string, string>;
  onRefresh?: () => Promise<void>;
}

export const ActiveCoachesModal: React.FC<ActiveCoachesModalProps> = ({
  isOpen,
  onClose,
  activeUsers = [],
  currentUserEmail,
  activeLocks = [],
  teamNameMap = {},
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefreshClick = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getRoleBadgeStyle = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('head') || r.includes('admin')) {
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40';
    }
    if (r.includes('offens')) {
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40';
    }
    if (r.includes('defens')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40';
    }
    return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
  };

  const formatUnitName = (unit: string = '') => {
    switch (unit) {
      case 'offense':
        return 'Offense Depth Chart';
      case 'defense':
        return 'Defense Depth Chart';
      case 'st':
        return 'Special Teams';
      case 'groups':
        return 'Personnel & Groups';
      case 'scouting':
        return 'Scouting Hub';
      case 'whiteboard':
        return 'Interactive Whiteboard';
      case 'playbook':
        return 'Playbook Guides';
      case 'call_sheet':
        return 'Call Sheet';
      case 'wristband':
        return 'Wristbands';
      case 'roster':
        return 'Team Roster';
      case 'practice_plans':
        return 'Practice Planner';
      case 'schedule':
        return 'Season Schedule';
      default:
        return 'Operations Dashboard';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return 'Just now';
    const elapsedSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (elapsedSec < 15) return 'Just now';
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin}m ago`;
    const elapsedHours = Math.floor(elapsedMin / 60);
    return `${elapsedHours}h ago`;
  };

  const formatConnectedSince = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Find any lock held by an email
  const getLockForEmail = (email: string) => {
    const cleanEmail = (email || '').toLowerCase().trim();
    return activeLocks.find((l) => (l.holderEmail || '').toLowerCase().trim() === cleanEmail);
  };

  return (
    <div
      id="active-coaches-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="active-coaches-modal-container"
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-slate-100 dark:bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-600 flex items-center justify-center shadow-inner">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Active Coaches Online</h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {activeUsers.length} Online
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Coaches with the app open right now
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                id="refresh-active-coaches-btn"
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                className="p-2 rounded-lg bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white dark:border-slate-700 transition-colors cursor-pointer"
                title="Refresh active coaches list"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              id="close-active-coaches-modal-btn"
              onClick={onClose}
              className="p-2 rounded-lg bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white dark:border-slate-700 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50 dark:bg-slate-900">
          {activeUsers.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">No other active coaches online</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                You are currently the only coach connected. When other staff log in, their active status and current view will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeUsers.map((user) => {
                const isMe =
                  currentUserEmail &&
                  user.email &&
                  currentUserEmail.toLowerCase().trim() === user.email.toLowerCase().trim();
                const lock = getLockForEmail(user.email);
                const teamLabel = teamNameMap[user.activeTeamId] || user.activeTeamId || '10U Tackle';
                const initial = (user.displayName || user.email || 'C')[0].toUpperCase();

                return (
                  <div
                    key={user.clientId || user.email}
                    id={`active-user-card-${user.clientId || user.email}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isMe
                        ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/40 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800/60 dark:border-slate-700 dark:hover:border-slate-600 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Avatar & Identity */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shadow-xs shrink-0 ${
                            isMe
                              ? 'bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white'
                              : 'bg-slate-700 text-white dark:bg-slate-600 dark:text-white'
                          }`}
                        >
                          {initial}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                              {user.displayName || user.email.split('@')[0]}
                            </span>
                            {isMe && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white shadow-xs">
                                You
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getRoleBadgeStyle(
                                user.role
                              )}`}
                            >
                              {user.role || 'Staff Coach'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      {/* Right: Presence Status */}
                      <div className="flex flex-col items-end shrink-0">
                        {user.isIdle ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            Idle
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active Now
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTimeAgo(user.lastSeen)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Metadata Bar */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200 font-medium">
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          {teamLabel} • Week {user.currentWeek} • {formatUnitName(user.activeUnit)}
                        </span>

                        {lock && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 font-semibold">
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            Editing Week {lock.week} {lock.unit}
                          </span>
                        )}
                      </div>

                      {user.connectedAt > 0 && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Joined at {formatConnectedSince(user.connectedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Collaborative Safe Editing Info Card */}
          <div className="bg-slate-100 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700 rounded-xl p-4 flex items-start gap-3 mt-4">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Coaches can edit rosters, call sheets, and depth charts at the same time. Idle coaches are signed out after the inactivity time set in Settings, which also releases any section they were editing.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Updates every 30 seconds</span>
          </div>

          <button
            type="button"
            id="done-active-coaches-btn"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 dark:text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl cursor-pointer transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
