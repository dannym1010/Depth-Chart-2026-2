import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Film,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { getFirebaseServices, setReadOnlySession } from '../services/storageService';
import { setActiveSport } from '../sportMode';
import { isProgramAdminEmail } from '../utils/staffAccess';
import { BasketballFilmRoomView } from './components/BasketballFilmRoomView';
import { BasketballHighlightsView } from './components/BasketballHighlightsView';
import { BasketballScheduleView } from './components/BasketballScheduleView';
import { BasketballScoutView } from './components/BasketballScoutView';
import { BasketballUsersView } from './components/BasketballUsersView';
import {
  DEFAULT_BASKETBALL_SETS,
  fetchBasketballStateCloud,
  loadBasketballState,
  saveBasketballState,
  subscribeBasketballStateCloud,
  syncBasketballAccessDoc,
} from './storage';
import type {
  BasketballGame,
  BasketballPlayer,
  BasketballPossession,
  BasketballStaffMember,
  BasketballState,
  BasketballTab,
  BasketballTeam,
  BasketballTeamData,
} from './types';

const NAV_ITEMS: { id: BasketballTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'schedule', label: 'Schedule', shortLabel: 'Schedule', icon: Calendar },
  { id: 'filmroom', label: 'Film Room', shortLabel: 'Film', icon: Film },
  { id: 'scout', label: 'Hudl Scout', shortLabel: 'Scout', icon: BarChart3 },
  { id: 'highlights', label: 'Highlights', shortLabel: 'Reels', icon: Sparkles },
  { id: 'users', label: 'Team & Users', shortLabel: 'Team', icon: Users },
];

const EMPTY_TEAM_DATA: BasketballTeamData = {
  roster: [],
  games: [],
  customSets: DEFAULT_BASKETBALL_SETS,
};

export const BasketballApp: React.FC = () => {
  const [state, setState] = useState<BasketballState>(() => loadBasketballState());
  const [activeTab, setActiveTab] = useState<BasketballTab>('schedule');
  const [focusPlayNumber, setFocusPlayNumber] = useState<number | undefined>(undefined);
  const [authUser, setAuthUser] = useState<{ email: string; displayName: string } | null>(null);
  const [hasFirebaseAuth, setHasFirebaseAuth] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const adoptRemoteState = useCallback((remote: BasketballState) => {
    setState((prev) => ({
      ...remote,
      darkMode: prev.darkMode,
      activeTeamId: remote.teams.some((t) => t.id === prev.activeTeamId)
        ? prev.activeTeamId
        : remote.activeTeamId,
    }));
  }, []);

  // Track Firebase auth user; hydrate and subscribe to Basketball cloud state.
  useEffect(() => {
    let unsubCloud: (() => void) | undefined;
    let unsubAuth: (() => void) | undefined;
    try {
      const { auth } = getFirebaseServices();
      setHasFirebaseAuth(Boolean(auth?.onAuthStateChanged));
      if (auth?.onAuthStateChanged) {
        unsubAuth = auth.onAuthStateChanged(async (user: any) => {
          if (user?.email) {
            setAuthUser({
              email: String(user.email).toLowerCase().trim(),
              displayName: String(user.displayName || user.email.split('@')[0] || 'Coach'),
            });
            setSignInOpen(false);
            const remote = await fetchBasketballStateCloud();
            if (remote) adoptRemoteState(remote);
          } else {
            setAuthUser(null);
          }
        });
      }
      unsubCloud = subscribeBasketballStateCloud(adoptRemoteState);
    } catch {
      /* offline / no firebase configured */
    }
    return () => {
      try {
        unsubAuth?.();
      } catch {
        /* ignore */
      }
      try {
        unsubCloud?.();
      } catch {
        /* ignore */
      }
    };
  }, [adoptRemoteState]);

  // Sync dark mode class on <html>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', state.darkMode);
    }
  }, [state.darkMode]);

  const signedInEmail = authUser?.email || '';
  const isOwner = isProgramAdminEmail(signedInEmail);

  const matchedMember = useMemo(
    () =>
      signedInEmail
        ? state.staff.find((m) => m.email.toLowerCase().trim() === signedInEmail)
        : undefined,
    [state.staff, signedInEmail]
  );

  const isPendingUser = Boolean(
    hasFirebaseAuth &&
      authUser &&
      !isOwner &&
      (!matchedMember || matchedMember.status === 'Pending')
  );

  const isAdminUser =
    !hasFirebaseAuth || isOwner || matchedMember?.role === 'Admin';
  const isViewerRole =
    !isOwner &&
    (matchedMember?.role === 'Player' || matchedMember?.role === 'Family');
  const readOnly = Boolean(
    isViewerRole || (hasFirebaseAuth && (!authUser || isPendingUser))
  );

  // Align shared FilmRoom / Highlights / cloud writer lock with Basketball access role.
  useEffect(() => {
    setReadOnlySession(readOnly);
  }, [readOnly]);

  // Keep Firestore teamData/bball_access in sync whenever a Basketball Admin updates staff.
  useEffect(() => {
    if (isAdminUser && !readOnly && (!hasFirebaseAuth || authUser)) {
      void syncBasketballAccessDoc(state.staff);
    }
  }, [state.staff, isAdminUser, readOnly, hasFirebaseAuth, authUser]);

  const commit = useCallback((updater: (prev: BasketballState) => BasketballState) => {
    setState((prev) => {
      const next = updater(prev);
      saveBasketballState(next);
      return next;
    });
  }, []);

  // Filter visible Basketball teams to assigned teams for non-Admin users.
  const visibleTeams = useMemo(() => {
    if (isAdminUser || !matchedMember || !matchedMember.teamIds?.length) {
      return state.teams;
    }
    const assigned = state.teams.filter((t) => matchedMember.teamIds.includes(t.id));
    return assigned.length > 0 ? assigned : state.teams;
  }, [state.teams, isAdminUser, matchedMember]);

  const activeTeam: BasketballTeam = useMemo(
    () => visibleTeams.find((t) => t.id === state.activeTeamId) || visibleTeams[0],
    [visibleTeams, state.activeTeamId]
  );

  const teamData: BasketballTeamData = useMemo(
    () => state.teamData[activeTeam.id] || EMPTY_TEAM_DATA,
    [state.teamData, activeTeam.id]
  );

  const activeGameId = useMemo(() => {
    const saved = state.activeGameIdByTeam[activeTeam.id];
    if (saved && teamData.games.some((g) => g.id === saved)) return saved;
    return teamData.games[0]?.id || '';
  }, [state.activeGameIdByTeam, activeTeam.id, teamData.games]);

  const activeGame = useMemo(
    () => teamData.games.find((g) => g.id === activeGameId),
    [teamData.games, activeGameId]
  );

  const visibleNavItems = useMemo(() => {
    if (!isViewerRole) return NAV_ITEMS;
    const allowed = new Set<BasketballTab>(
      matchedMember?.allowedTabs && matchedMember.allowedTabs.length > 0
        ? matchedMember.allowedTabs
        : ['schedule', 'highlights']
    );
    const filtered = NAV_ITEMS.filter((item) => allowed.has(item.id));
    return filtered.length > 0 ? filtered : [NAV_ITEMS[0]];
  }, [isViewerRole, matchedMember]);

  useEffect(() => {
    if (!visibleNavItems.some((i) => i.id === activeTab)) {
      setActiveTab(visibleNavItems[0].id);
    }
  }, [visibleNavItems, activeTab]);

  const handleGoogleSignIn = async () => {
    const { auth } = getFirebaseServices();
    const fb = (window as any).firebase;
    if (!auth || !fb?.auth?.GoogleAuthProvider) return;
    setAuthError('');
    setAuthBusy(true);
    try {
      const provider = new fb.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await auth.signInWithPopup(provider);
      setSignInOpen(false);
    } catch (err: any) {
      setAuthError(err?.message || 'Google sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const { auth } = getFirebaseServices();
    if (!auth || !emailInput.trim() || !passwordInput) return;
    setAuthError('');
    setAuthBusy(true);
    try {
      await auth.signInWithEmailAndPassword(emailInput.trim(), passwordInput);
      setSignInOpen(false);
      setPasswordInput('');
    } catch (err: any) {
      setAuthError(err?.message || 'Email sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { auth } = getFirebaseServices();
      await auth?.signOut?.();
      setAuthUser(null);
    } catch {
      /* ignore */
    }
  };

  const selectGame = useCallback(
    (gameId: string) => {
      setFocusPlayNumber(undefined);
      commit((prev) => ({
        ...prev,
        activeGameIdByTeam: {
          ...prev.activeGameIdByTeam,
          [activeTeam.id]: gameId,
        },
      }));
    },
    [commit, activeTeam.id]
  );

  const openFilmRoomForGame = useCallback(
    (gameId: string, playNumber?: number) => {
      setFocusPlayNumber(playNumber);
      commit((prev) => ({
        ...prev,
        activeGameIdByTeam: {
          ...prev.activeGameIdByTeam,
          [activeTeam.id]: gameId,
        },
      }));
      setActiveTab('filmroom');
    },
    [commit, activeTeam.id]
  );

  const openScoutForGame = useCallback(
    (gameId: string) => {
      commit((prev) => ({
        ...prev,
        activeGameIdByTeam: {
          ...prev.activeGameIdByTeam,
          [activeTeam.id]: gameId,
        },
      }));
      setActiveTab('scout');
    },
    [commit, activeTeam.id]
  );

  const updateTeamData = useCallback(
    (updater: (td: BasketballTeamData) => BasketballTeamData) => {
      commit((prev) => {
        const current = prev.teamData[activeTeam.id] || EMPTY_TEAM_DATA;
        return {
          ...prev,
          teamData: {
            ...prev.teamData,
            [activeTeam.id]: updater(current),
          },
        };
      });
    },
    [commit, activeTeam.id]
  );

  const handleAddGame = (draft: Omit<BasketballGame, 'id' | 'possessions'>) => {
    const newId = `bball-g-${Date.now()}`;
    const game: BasketballGame = { ...draft, id: newId, possessions: [] };
    commit((prev) => {
      const current = prev.teamData[activeTeam.id] || EMPTY_TEAM_DATA;
      return {
        ...prev,
        activeGameIdByTeam: { ...prev.activeGameIdByTeam, [activeTeam.id]: newId },
        teamData: {
          ...prev.teamData,
          [activeTeam.id]: { ...current, games: [...current.games, game] },
        },
      };
    });
  };

  const handleUpdateGame = (gameId: string, updates: Partial<BasketballGame>) => {
    updateTeamData((td) => ({
      ...td,
      games: td.games.map((g) => (g.id === gameId ? { ...g, ...updates } : g)),
    }));
  };

  const handleDeleteGame = (gameId: string) => {
    updateTeamData((td) => ({
      ...td,
      games: td.games.filter((g) => g.id !== gameId),
    }));
  };

  const handleUpdatePossessions = (gameId: string, possessions: BasketballPossession[]) => {
    updateTeamData((td) => ({
      ...td,
      games: td.games.map((g) => (g.id === gameId ? { ...g, possessions } : g)),
    }));
  };

  const handleImportPossessions = (gameId: string, imported: BasketballPossession[]) => {
    updateTeamData((td) => ({
      ...td,
      games: td.games.map((g) => (g.id === gameId ? { ...g, possessions: imported } : g)),
    }));
  };

  const handleAddCustomSet = (setName: string) => {
    updateTeamData((td) => ({
      ...td,
      customSets: td.customSets.includes(setName) ? td.customSets : [...td.customSets, setName],
    }));
  };

  const handleAddTeam = (teamDraft: Omit<BasketballTeam, 'id'>) => {
    const id = `bball-team-${Date.now()}`;
    commit((prev) => ({
      ...prev,
      teams: [...prev.teams, { ...teamDraft, id }],
      activeTeamId: id,
      teamData: {
        ...prev.teamData,
        [id]: { roster: [], games: [], customSets: DEFAULT_BASKETBALL_SETS },
      },
    }));
  };

  const handleUpdateTeam = (teamId: string, updates: Partial<BasketballTeam>) => {
    commit((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, ...updates } : t)),
    }));
  };

  const handleAddPlayer = (playerDraft: Omit<BasketballPlayer, 'id'>) => {
    const player: BasketballPlayer = { ...playerDraft, id: `bbp-${Date.now()}` };
    updateTeamData((td) => ({ ...td, roster: [...td.roster, player] }));
  };

  const handleUpdatePlayer = (playerId: string, updates: Partial<BasketballPlayer>) => {
    updateTeamData((td) => ({
      ...td,
      roster: td.roster.map((p) => (p.id === playerId ? { ...p, ...updates } : p)),
    }));
  };

  const handleDeletePlayer = (playerId: string) => {
    updateTeamData((td) => ({
      ...td,
      roster: td.roster.filter((p) => p.id !== playerId),
    }));
  };

  const handleAddStaff = (memberDraft: Omit<BasketballStaffMember, 'id'>) => {
    const member: BasketballStaffMember = { ...memberDraft, id: `st-${Date.now()}` };
    commit((prev) => ({ ...prev, staff: [...prev.staff, member] }));
  };

  const handleUpdateStaff = (memberId: string, updates: Partial<BasketballStaffMember>) => {
    commit((prev) => ({
      ...prev,
      staff: prev.staff.map((s) => (s.id === memberId ? { ...s, ...updates } : s)),
    }));
  };

  const handleDeleteStaff = (memberId: string) => {
    commit((prev) => ({
      ...prev,
      staff: prev.staff.filter((s) => s.id !== memberId),
    }));
  };

  const peopleMap = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of state.staff) {
      if (s.email) out[s.email.toLowerCase().trim()] = s.name;
    }
    return out;
  }, [state.staff]);

  const authorName = matchedMember?.name || authUser?.displayName || 'Coach';

  // Pending approval gate for authenticated accounts not yet added/activated in Basketball staff
  if (isPendingUser) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Basketball Access Pending</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Signed in as <b className="text-zinc-800 dark:text-zinc-200">{signedInEmail}</b>. Ask a Basketball Admin ({isProgramAdminEmail('dannym1010@gmail.com') ? 'dannym1010@gmail.com' : 'Admin'}) to add or approve your email in <b>Team &amp; Users</b>.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                const remote = await fetchBasketballStateCloud();
                if (remote) adoptRemoteState(remote);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Status
            </button>
            <button
              type="button"
              onClick={() => setActiveSport('football')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold cursor-pointer"
            >
              <span>🏈</span>
              Try Football App
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 hover:text-rose-500 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Studio Top Bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur px-3 sm:px-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Geometric Court Studio Emblem */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-amber-500 flex items-center justify-center border border-zinc-800 dark:border-amber-400">
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-amber-400 dark:text-zinc-950" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18M3 12h18" />
                <path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-xs font-extrabold tracking-widest uppercase text-zinc-900 dark:text-white">
                COURT STUDIO
              </div>
              <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hidden sm:block">
                Basketball Operations
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

          {/* Team Dropdown */}
          <select
            value={activeTeam.id}
            onChange={(e) => commit((prev) => ({ ...prev, activeTeamId: e.target.value }))}
            aria-label="Active basketball team"
            className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-100 max-w-[165px] sm:max-w-[220px] truncate"
          >
            {visibleTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Active Game Pill */}
          {teamData.games.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Game
              </span>
              <select
                value={activeGameId}
                onChange={(e) => selectGame(e.target.value)}
                aria-label="Active basketball game"
                className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none max-w-[200px]"
              >
                {teamData.games.map((g) => (
                  <option key={g.id} value={g.id} className="bg-white dark:bg-zinc-900">
                    {g.weekLabel}: vs {g.opponent}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {readOnly && (
            <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300">
              {matchedMember?.role || 'Read Only'}
            </span>
          )}

          {hasFirebaseAuth && (
            authUser ? (
              <div className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
                <span className="hidden sm:inline max-w-[140px] truncate font-medium text-zinc-700 dark:text-zinc-200">
                  {authorName}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  title={`Sign out (${authUser.email})`}
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-zinc-500 hover:text-rose-500 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSignInOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => commit((prev) => ({ ...prev, darkMode: !prev.darkMode }))}
            title={state.darkMode ? 'Switch to Light Studio' : 'Switch to Dark Studio'}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
          >
            {state.darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveSport('football')}
            title="Switch to Football Depth Chart app"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:border-amber-500 cursor-pointer transition-colors"
          >
            <span>🏈</span>
            <span className="hidden sm:inline">Football</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop Left Navigation Rail */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 justify-between">
          <nav className="space-y-1" aria-label="Court Studio modules">
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Workspace
            </div>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id !== 'filmroom') setFocusPlayNumber(undefined);
                    setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-900 text-white dark:bg-amber-500/15 dark:text-amber-400 border border-zinc-900 dark:border-amber-500/30'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Compact Team Summary Card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-3 space-y-1.5 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Active Context
            </div>
            <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {activeTeam.name}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {activeGame
                ? `${activeGame.weekLabel}: vs ${activeGame.opponent}`
                : activeTeam.season}
            </div>
            <div className="pt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">
              <span>{teamData.roster.length} players</span>
              <span>{teamData.games.length} events</span>
            </div>
          </div>
        </aside>

        {/* Active Module Content */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 pb-20 lg:pb-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'schedule' && (
              <BasketballScheduleView
                teamName={activeTeam.name}
                season={activeTeam.season}
                games={teamData.games}
                activeGameId={activeGameId}
                readOnly={readOnly}
                onSelectGame={selectGame}
                onOpenFilmRoom={(gId) => openFilmRoomForGame(gId)}
                onOpenScout={openScoutForGame}
                onAddGame={handleAddGame}
                onUpdateGame={handleUpdateGame}
                onDeleteGame={handleDeleteGame}
              />
            )}

            {activeTab === 'filmroom' && (
              <BasketballFilmRoomView
                team={activeTeam}
                games={teamData.games}
                activeGameId={activeGameId}
                roster={teamData.roster}
                customSets={teamData.customSets}
                userEmail={signedInEmail}
                authorName={authorName}
                readOnly={readOnly}
                focusPlayNumber={focusPlayNumber}
                onSelectGame={selectGame}
                onUpdatePossessions={handleUpdatePossessions}
                onAddCustomSet={handleAddCustomSet}
              />
            )}

            {activeTab === 'scout' && (
              <BasketballScoutView
                teamName={activeTeam.name}
                games={teamData.games}
                activeGameId={activeGameId}
                roster={teamData.roster}
                readOnly={readOnly}
                onSelectGame={selectGame}
                onImportPossessions={handleImportPossessions}
                onUpdateGameNotes={(gameId, notes) =>
                  handleUpdateGame(gameId, { scoutingNotes: notes })
                }
                onOpenClipsInFilmRoom={(gameId, playNumber) =>
                  openFilmRoomForGame(gameId, playNumber)
                }
              />
            )}

            {activeTab === 'highlights' && (
              <BasketballHighlightsView
                team={activeTeam}
                games={teamData.games}
                roster={teamData.roster}
                userEmail={signedInEmail || 'coach@courtstudio.local'}
                authorName={authorName}
                watchOnly={readOnly}
                myKids={matchedMember?.linkedPlayerNums}
                level={matchedMember?.highlightAccess}
                people={peopleMap}
                seeAllReels={isAdminUser}
                onOpenClipInFilmRoom={(gameId, playNumber) =>
                  openFilmRoomForGame(gameId, playNumber)
                }
              />
            )}

            {activeTab === 'users' && (
              <BasketballUsersView
                teams={visibleTeams}
                activeTeamId={activeTeam.id}
                roster={teamData.roster}
                staff={state.staff}
                readOnly={readOnly}
                onSelectTeam={(teamId) => commit((prev) => ({ ...prev, activeTeamId: teamId }))}
                onAddTeam={handleAddTeam}
                onUpdateTeam={handleUpdateTeam}
                onAddPlayer={handleAddPlayer}
                onUpdatePlayer={handleUpdatePlayer}
                onDeletePlayer={handleDeletePlayer}
                onAddStaff={handleAddStaff}
                onUpdateStaff={handleUpdateStaff}
                onDeleteStaff={handleDeleteStaff}
              />
            )}
          </div>
        </main>
      </div>

      {/* Sign In Modal for Basketball Coaches & Families */}
      {signInOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                Sign In to Court Studio
              </h2>
              <button
                type="button"
                onClick={() => setSignInOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500">
                {authError}
              </div>
            )}

            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleGoogleSignIn()}
              className="w-full h-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {authBusy ? 'Signing in…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-400">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span>or coach email</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <form onSubmit={(e) => void handleEmailSignIn(e)} className="space-y-2.5">
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Email"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
              />
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
              />
              <button
                type="submit"
                disabled={authBusy}
                className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-semibold cursor-pointer"
              >
                Sign In with Email
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile 5-Tab Bottom Dock */}
      <nav
        aria-label="Mobile modules"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur grid grid-cols-5 px-1"
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id !== 'filmroom') setFocusPlayNumber(undefined);
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
                active
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
