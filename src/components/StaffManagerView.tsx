import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Check,
  X,
  Trash2,
  Plus,
  Layers,
  Edit2,
  AlertTriangle,
  Crown,
  Lock,
  Copy,
  ChevronDown,
  Star,
  Sparkles,
  Mail,
  Send,
  ExternalLink,
  CheckCheck,
  Link2,
  Clock,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { StaffCoach, UserRole, Team, UnitType } from '../types';

interface StaffManagerViewProps {
  staffList: StaffCoach[];
  savedCoaches: string[];
  teamSavedCoaches?: Record<string, string[]>;
  userRole: UserRole;
  teams: Team[];
  activeTeamId: string;
  defaultTeamId?: string;
  currentUserEmail?: string;
  adminPasscodeSet?: boolean;
  onUpdateAdminPasscode?: (newPasscode: string) => void;
  onSelectTeam: (teamId: string) => void;
  onSetDefaultTeam?: (teamId: string) => void;
  onAddTeam: (team: Omit<Team, 'id'>) => void;
  onUpdateTeam: (teamId: string, updated: Partial<Team>) => void;
  onDeleteTeam: (teamId: string) => void;
  onAddStaffCoach: (email: string, role?: string, assignedTeamIds?: string[], favoriteTeamId?: string, startScreen?: UnitType, idleTimeoutMinutes?: number) => void;
  onUpdateStaffRole: (idx: number, role: string) => void;
  onToggleStaffApproval: (idx: number) => void;
  onRemoveStaffCoach: (idx: number) => void;
  onUpdateStaffAssignedTeams: (idx: number, teamIds: string[]) => void;
  onUpdateStaffPreferences?: (idx: number, favoriteTeamId?: string, startScreen?: UnitType, idleTimeoutMinutes?: number) => void;
  onAddNewSavedCoach: (name: string, teamId?: string) => void;
  onDeleteSavedCoach: (name: string, teamId?: string) => void;
  onCopyCoachesFromTeam?: (sourceTeamId: string, targetTeamId: string) => void;
}

export const StaffManagerView: React.FC<StaffManagerViewProps> = ({
  staffList,
  savedCoaches,
  teamSavedCoaches = {},
  userRole,
  teams = [],
  activeTeamId,
  defaultTeamId,
  currentUserEmail,
  adminPasscodeSet = false,
  onUpdateAdminPasscode,
  onSelectTeam,
  onSetDefaultTeam,
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddStaffCoach,
  onUpdateStaffRole,
  onToggleStaffApproval,
  onRemoveStaffCoach,
  onUpdateStaffAssignedTeams,
  onUpdateStaffPreferences,
  onAddNewSavedCoach,
  onDeleteSavedCoach,
  onCopyCoachesFromTeam,
}) => {
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);

  // New Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamAge, setNewTeamAge] = useState('10U');
  const [newTeamSeason, setNewTeamSeason] = useState('2026');
  const [newTeamColor, setNewTeamColor] = useState('indigo');
  const [newTeamCalendarUrl, setNewTeamCalendarUrl] = useState('');

  // Add Staff Coach Modal State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Head Coach (Admin)');
  const [newStaffAssignedTeams, setNewStaffAssignedTeams] = useState<string[]>([activeTeamId]);
  const [newStaffIdleTimeout, setNewStaffIdleTimeout] = useState<number>(30);

  // Email Invitation Modal State
  const [inviteModalData, setInviteModalData] = useState<{
    email: string;
    role: string;
    assignedTeamNames: string[];
  } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Admin Passcode Management State
  const [showChangePasscodeModal, setShowChangePasscodeModal] = useState(false);
  const [inputNewPasscode, setInputNewPasscode] = useState('');
  const [inputConfirmPasscode, setInputConfirmPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [passcodeSuccess, setPasscodeSuccess] = useState<string | null>(null);
  const [showResetLinkModal, setShowResetLinkModal] = useState(false);
  const [resetLinkEmail, setResetLinkEmail] = useState('');
  const [resetLinkStatus, setResetLinkStatus] = useState<{ message: string; isError: boolean; code?: string; link?: string } | null>(null);
  const [resetLinkLoading, setResetLinkLoading] = useState(false);

  // Saved Practice Coaches per Team State
  const [practiceCoachTeamFilter, setPracticeCoachTeamFilter] = useState<string>(activeTeamId);
  const [showAddPracticeCoachModal, setShowAddPracticeCoachModal] = useState(false);
  const [newPracticeCoachName, setNewPracticeCoachName] = useState('');
  const [showCopyCoachesModal, setShowCopyCoachesModal] = useState(false);
  const [copySourceTeamId, setCopySourceTeamId] = useState(teams[0]?.id || '');

  // Keep practiceCoachTeamFilter in sync if activeTeamId changes
  React.useEffect(() => {
    if (activeTeamId && teams.some((t) => t.id === activeTeamId)) {
      setPracticeCoachTeamFilter(activeTeamId);
    }
  }, [activeTeamId, teams]);

  const activeFilterTeam = teams.find((t) => t.id === practiceCoachTeamFilter) || teams[0];
  const currentTeamPracticeCoaches =
    Array.isArray(teamSavedCoaches[practiceCoachTeamFilter])
      ? teamSavedCoaches[practiceCoachTeamFilter]
      : [];

  const generateInviteBody = (email: string, role: string, assignedTeamNames: string[]) => {
    const origin = typeof window !== 'undefined' ? window.location.origin || window.location.href : '';
    const teamListStr = assignedTeamNames.length > 0 ? assignedTeamNames.join(', ') : 'All Program Teams';
    return `Hi Coach,

You have been invited to join the coaching staff on our Football Team Management & Playbook platform.

🏈 Access the Portal:
${origin}

📋 Account & Access Details:
- Authorized Email: ${email}
- Assigned Role: ${role}
- Assigned Teams: ${teamListStr}

How to join:
1. Open the link above.
2. Sign in with your email (${email}) using Google Sign-In or your coach account.
3. Access your team roster, real-time playbooks, wristband cards, practice plans, and game schedules.

Looking forward to a great season!`;
  };

  const handleOpenMailClient = (email: string, role: string, assignedTeamNames: string[]) => {
    const subject = encodeURIComponent(`Youth Football Coaching Staff Invitation - ${role}`);
    const body = encodeURIComponent(generateInviteBody(email, role, assignedTeamNames));
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    onAddTeam({
      name: newTeamName.trim(),
      ageGroup: newTeamAge.trim() || 'Youth',
      season: newTeamSeason.trim() || '2026',
      color: newTeamColor,
      headCoachName: (savedCoaches && savedCoaches[0]) ? savedCoaches[0] : '',
      calendarUrl: newTeamCalendarUrl.trim() || undefined,
    });
    setNewTeamName('');
    setNewTeamAge('10U');
    setNewTeamCalendarUrl('');
    setShowAddTeamModal(false);
  };

  const handleSaveEditedTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editingTeam.name.trim()) return;
    onUpdateTeam(editingTeam.id, {
      name: editingTeam.name.trim(),
      ageGroup: editingTeam.ageGroup?.trim(),
      season: editingTeam.season?.trim(),
      color: editingTeam.color,
      calendarUrl: editingTeam.calendarUrl?.trim() || undefined,
    });
    setEditingTeam(null);
  };

  const handleConfirmDeleteTeam = () => {
    if (!teamToDelete) return;
    onDeleteTeam(teamToDelete.id);
    setTeamToDelete(null);
  };

  const handleCreateStaffCoach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail.trim()) return;
    const cleanEmail = newStaffEmail.trim().toLowerCase();
    const assignedIds = newStaffAssignedTeams.length > 0 ? newStaffAssignedTeams : [activeTeamId];
    
    onAddStaffCoach(
      cleanEmail,
      newStaffRole,
      assignedIds,
      activeTeamId,
      'schedule',
      newStaffIdleTimeout
    );

    const teamNames = teams
      .filter((t) => assignedIds.includes('all') || assignedIds.includes(t.id))
      .map((t) => `${t.name} (${t.ageGroup || 'Youth'})`);

    const inviteInfo = {
      email: cleanEmail,
      role: newStaffRole,
      assignedTeamNames: teamNames,
    };

    setInviteModalData(inviteInfo);
    setShowAddStaffModal(false);

    // Launch email compose automatically
    try {
      handleOpenMailClient(cleanEmail, newStaffRole, teamNames);
    } catch (e) {
      console.warn('Mailto launch:', e);
    }

    setNewStaffEmail('');
    setNewStaffRole('Head Coach (Admin)');
    setNewStaffAssignedTeams([activeTeamId]);
  };

  const handleCreatePracticeCoach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPracticeCoachName.trim()) return;
    onAddNewSavedCoach(newPracticeCoachName.trim(), practiceCoachTeamFilter);
    setNewPracticeCoachName('');
    setShowAddPracticeCoachModal(false);
  };

  const toggleTeamForCoach = (coachIdx: number, coach: StaffCoach, teamId: string) => {
    if (userRole !== 'admin') return;
    let currentAssigned = coach.assignedTeamIds || [];

    // If currently 'all' or empty, initialize with all team IDs except clicked
    if (currentAssigned.length === 0 || currentAssigned.includes('all')) {
      const allIds = teams.map((t) => t.id);
      currentAssigned = allIds.filter((id) => id !== teamId);
    } else if (currentAssigned.includes(teamId)) {
      currentAssigned = currentAssigned.filter((id) => id !== teamId);
    } else {
      currentAssigned = [...currentAssigned, teamId];
    }
    onUpdateStaffAssignedTeams(coachIdx, currentAssigned);
  };

  const setAllTeamsForCoach = (coachIdx: number) => {
    if (userRole !== 'admin') return;
    onUpdateStaffAssignedTeams(coachIdx, ['all']);
  };

  const isMasterSuperAdminUser = (email: string) => {
    return false;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-black shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base md:text-lg text-slate-100 tracking-tight flex items-center gap-2">
                <span>Program Teams, Staff &amp; Access Permissions</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Admin Console
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Manage football teams, control which specific teams each Head Coach &amp; Assistant Coach can access, and configure practice coaches per team.
              </p>
            </div>
          </div>

          {userRole === 'admin' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddTeamModal(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all active:scale-95 border border-indigo-400/30 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create New Team</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: PROGRAM TEAMS & DIVISIONS */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="font-black text-sm text-slate-100">
              Program Teams &amp; Age Divisions ({teams.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Each team maintains its own roster, schedule, depth chart, formations &amp; practice coaches
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => {
            const isActive = team.id === activeTeamId;
            const isDefault = (defaultTeamId || (teams[0] && teams[0].id)) === team.id;

            return (
              <div
                key={team.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isActive
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500/40'
                    : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {team.ageGroup || 'Division'}
                      </span>
                      {isDefault && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          <span>Default</span>
                        </span>
                      )}
                    </div>
                    {team.season && (
                      <span className="text-[10px] text-slate-400 font-bold">
                        {team.season}
                      </span>
                    )}
                  </div>

                  <h4 className="font-black text-sm text-slate-100 tracking-tight">
                    {team.name}
                  </h4>
                  {team.headCoachName && (
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Coach: <span className="font-semibold text-slate-100">{team.headCoachName}</span>
                    </p>
                  )}
                  {team.notes && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {team.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelectTeam(team.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                      <span>{isActive ? 'Active' : 'Switch'}</span>
                    </button>

                    {onSetDefaultTeam && !isDefault && (
                      <button
                        type="button"
                        onClick={() => onSetDefaultTeam(team.id)}
                        title="Set as startup default team"
                        className="px-2 py-1.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-amber-300 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/40 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Star className="w-3 h-3 text-slate-400" />
                        <span className="hidden sm:inline">Set Default</span>
                      </button>
                    )}
                  </div>

                  {userRole === 'admin' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingTeam(team)}
                        className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Edit Team Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTeamToDelete(team)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION: HEAD COACH & MASTER ADMIN PASSCODE */}
      {userRole === 'admin' && (
        <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-amber-500/30 shadow-xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/80 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-slate-100">
                    Head Coach &amp; Master Admin Passcode
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      adminPasscodeSet
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {adminPasscodeSet ? 'Active & Protected' : 'Not Set'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Set a custom master passcode for direct Head Coach sign-in from any device without requiring third-party authentication.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setShowResetLinkModal(true);
                  setResetLinkEmail(currentUserEmail || staffList[0]?.email || '');
                  setResetLinkStatus(null);
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Email Reset Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowChangePasscodeModal(true);
                  setPasscodeError(null);
                  setInputNewPasscode('');
                  setInputConfirmPasscode('');
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{adminPasscodeSet ? 'Change Admin Passcode' : 'Set Admin Passcode'}</span>
              </button>
            </div>
          </div>

          {passcodeSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-700/80 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{passcodeSuccess}</span>
            </div>
          )}

          {!adminPasscodeSet ? (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                No custom admin passcode has been created yet. Click <strong className="text-indigo-600 dark:text-indigo-400">Set Admin Passcode</strong> above to configure your master passcode.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">Passcode Status:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold tracking-wider">
                    ••••••••••••
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Coaches can sign in using this passcode under the <strong className="text-indigo-600 dark:text-indigo-400">Admin Passcode</strong> tab on the login screen.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: STAFF & COACH ACCESS PERMISSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Registered Accounts & Team Assignments */}
        <div className="lg:col-span-2 bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-700 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <h3 className="font-black text-sm text-slate-100">
                  Staff Accounts &amp; Team Access Permissions
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Head Coaches and Administrators with the Admin Passcode have full access to all teams. Coaches only access teams allowed below.
              </p>
            </div>
            {userRole === 'admin' && (
              <button
                onClick={() => setShowAddStaffModal(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Coach Account</span>
              </button>
            )}
          </div>

          {staffList.filter((c) => c.status === 'Pending' && !isMasterSuperAdminUser(c.email)).length > 0 && (
            <div className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-200">
                    {staffList.filter((c) => c.status === 'Pending' && !isMasterSuperAdminUser(c.email)).length} Coach Account(s) Awaiting Access Approval
                  </h4>
                  <p className="text-[11px] text-amber-300/80">
                    These coaches cannot access the site. Click "Approve" below to grant access. Once approved, they remain approved until you remove them.
                  </p>
                </div>
              </div>
              {userRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    staffList.forEach((c, i) => {
                      if (c.status === 'Pending' && !isMasterSuperAdminUser(c.email)) {
                        onToggleStaffApproval(i);
                      }
                    });
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  ✓ Approve All Pending Coaches
                </button>
              )}
            </div>
          )}

          {/* Quick Admin Inactivity Settings Card */}
          {userRole === 'admin' && (
            <div className="bg-slate-900/90 border border-slate-700/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <span>Inactivity Automatic Logout Controls</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      Guaranteed Auto-Save Before Logout
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Adjust idle timeout per coach below or batch-apply to all coaches. Pending depth charts &amp; game plans are automatically saved to disk and cloud before any logout.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-bold text-slate-400 mr-1">Batch Set All:</span>
                {[30, 60, 90, 120, 240, 0].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      if (!onUpdateStaffPreferences) return;
                      staffList.forEach((c, i) => {
                        onUpdateStaffPreferences(i, c.favoriteTeamId, c.startScreen, mins);
                      });
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10.5px] font-bold transition-all cursor-pointer"
                    title={`Set all coaches to ${mins === 0 ? 'Never' : mins === 60 ? '1 Hour' : mins === 90 ? '1.5 Hours' : mins >= 120 ? `${mins / 60} Hours` : `${mins} min`} timeout`}
                  >
                    {mins === 0 ? 'Never' : mins === 60 ? '1h' : mins === 90 ? '1.5h' : mins >= 120 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-400 font-black uppercase text-[10px] border-b border-slate-700">
                  <th className="py-3 px-3 text-left">Email / User</th>
                  <th className="py-3 px-3 text-left">Role Assigned</th>
                  <th className="py-3 px-3 text-left">Allowed Teams</th>
                  <th className="py-3 px-3 text-left">Favorite Team &amp; Start Screen</th>
                  <th className="py-3 px-3 text-left">Auto-Logout</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  {userRole === 'admin' && (
                    <th className="py-3 px-3 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/80">
                {staffList.map((coach, idx) => {
                  const isMaster = isMasterSuperAdminUser(coach.email);
                  const isHeadCoachRole = coach.role.toLowerCase().includes('head coach');
                  const isActive = coach.status === 'Active';
                  const isAssignedAll =
                    !coach.assignedTeamIds ||
                    coach.assignedTeamIds.length === 0 ||
                    coach.assignedTeamIds.includes('all');

                  return (
                    <tr key={idx} className="hover:bg-slate-750/50 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-slate-100 font-mono">
                        <div className="flex items-center gap-1.5">
                          {isMaster && (
                            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          <span>{coach.email}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {isMaster ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10.5px] border border-amber-500/30 inline-flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            <span>Master Super Admin</span>
                          </span>
                        ) : userRole === 'admin' ? (
                          <select
                            value={coach.role}
                            onChange={(e) =>
                              onUpdateStaffRole(idx, e.target.value)
                            }
                            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none"
                          >
                            <option value="Head Coach (Admin)">
                              Head Coach (Admin)
                            </option>
                            <option value="Assistant Coach">
                              Assistant Coach
                            </option>
                          </select>
                        ) : (
                          <span className="font-semibold text-slate-300">
                            {coach.role}
                          </span>
                        )}
                      </td>

                      {/* Assigned Teams Access */}
                      <td className="py-3.5 px-3">
                        {isMaster ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>All Teams (Permanent Full Access)</span>
                          </span>
                        ) : userRole === 'admin' ? (
                          <div className="flex flex-wrap items-center gap-1 max-w-xs">
                            <button
                              type="button"
                              onClick={() => setAllTeamsForCoach(idx)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                isAssignedAll
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                              }`}
                              title="Grant access to all teams"
                            >
                              All Teams
                            </button>
                            {teams.map((t) => {
                              const hasAccess =
                                isAssignedAll ||
                                (coach.assignedTeamIds &&
                                  coach.assignedTeamIds.includes(t.id));
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => toggleTeamForCoach(idx, coach, t.id)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                    hasAccess && !isAssignedAll
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : hasAccess && isAssignedAll
                                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                      : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-700'
                                  }`}
                                  title={`Toggle access to ${t.name}`}
                                >
                                  <span>{t.ageGroup || t.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-medium">
                            {isAssignedAll
                              ? 'All Teams'
                              : teams
                                  .filter((t) => coach.assignedTeamIds?.includes(t.id))
                                  .map((t) => t.ageGroup || t.name)
                                  .join(', ') || 'No Teams Assigned'}
                          </span>
                        )}
                      </td>

                      {/* Favorite Team & Start Screen */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1 min-w-[170px]">
                          <div className="flex items-center gap-1 text-[10.5px]">
                            <Star className="w-3 h-3 text-amber-400 shrink-0" />
                            <select
                              value={coach.favoriteTeamId || defaultTeamId || (teams[0]?.id || '')}
                              onChange={(e) => {
                                onUpdateStaffPreferences?.(idx, e.target.value, coach.startScreen);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-amber-300 focus:outline-none w-full"
                              title="Favorite team linked to this coach login"
                            >
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1 text-[10.5px]">
                            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                            <select
                              value={coach.startScreen || 'schedule'}
                              onChange={(e) => {
                                onUpdateStaffPreferences?.(idx, coach.favoriteTeamId, e.target.value as UnitType);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-indigo-300 focus:outline-none w-full"
                              title="Start screen linked to this coach login"
                            >
                              <option value="mobile_hub">📱 Mobile Hub (Phone Quick Start)</option>
                              <option value="schedule">Season Schedule</option>
                              <option value="depth_chart">Depth Chart (Offense)</option>
                              <option value="practice">Practice Plans</option>
                              <option value="playbook">Playbooks &amp; Wristband</option>
                              <option value="gameday">Game Day Command</option>
                              <option value="scouting">Scouting &amp; Film</option>
                              <option value="stats">Game Stats</option>
                              <option value="callsheet">Live Play Callsheet</option>
                              <option value="compliance">Mandatory Play Tracker</option>
                              <option value="staff">Staff &amp; Teams Portal</option>
                            </select>
                          </div>
                        </div>
                      </td>

                      {/* Inactivity Auto-Logout Timeout */}
                      <td className="py-3.5 px-3">
                        {userRole === 'admin' ? (
                          <div className="flex items-center gap-1.5 min-w-[145px]">
                            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <select
                              value={coach.idleTimeoutMinutes !== undefined ? coach.idleTimeoutMinutes : 30}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                onUpdateStaffPreferences?.(
                                  idx,
                                  coach.favoriteTeamId,
                                  coach.startScreen,
                                  val
                                );
                              }}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-semibold text-cyan-300 focus:outline-none w-full cursor-pointer hover:border-slate-600 transition-colors"
                              title="Inactivity automatic logout timeout for this coach"
                            >
                              <option value={30}>30 Min (Default)</option>
                              <option value={60}>1 Hour</option>
                              <option value={90}>1.5 Hours (90 Min)</option>
                              <option value={120}>2 Hours</option>
                              <option value={240}>4 Hours</option>
                              <option value={0}>Disabled (Never)</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {coach.idleTimeoutMinutes === 0
                                ? 'Disabled (Never)'
                                : coach.idleTimeoutMinutes === 60
                                ? '1 Hour'
                                : coach.idleTimeoutMinutes === 90
                                ? '1.5 Hours'
                                : coach.idleTimeoutMinutes >= 120
                                ? `${coach.idleTimeoutMinutes / 60} Hours`
                                : `${coach.idleTimeoutMinutes || 30} Min`}
                            </span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          }`}
                        >
                          {coach.status}
                        </span>
                      </td>

                      {userRole === 'admin' && (
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const assigned = coach.assignedTeamIds || [];
                                const teamNames = teams
                                  .filter((t) => assigned.includes('all') || assigned.includes(t.id))
                                  .map((t) => `${t.name} (${t.ageGroup || 'Youth'})`);
                                setInviteModalData({
                                  email: coach.email,
                                  role: coach.role,
                                  assignedTeamNames: teamNames,
                                });
                              }}
                              className="p-1.5 text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-600/50 border border-indigo-700/50 rounded-lg transition-all cursor-pointer"
                              title={`Send email invitation to ${coach.email}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                            {!isMaster ? (
                              <>
                                <button
                                  onClick={() => onToggleStaffApproval(idx)}
                                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    isActive
                                      ? 'bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                                  }`}
                                  title={isActive ? 'Deactivate and revoke site access for this coach' : 'Approve and grant full site access for this coach'}
                                >
                                  {isActive ? 'Revoke Access' : '✓ Approve Coach'}
                                </button>
                                <button
                                  onClick={() => onRemoveStaffCoach(idx)}
                                  className="p-1.5 text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                                  title="Remove staff account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10.5px] text-amber-400/80 font-bold italic px-1">
                                Owner
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {staffList.length === 0 && (
              <div className="text-center py-10 px-4 space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">
                  No coach accounts added yet.
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Click <strong className="text-slate-300">+ Add Coach Account</strong> above to add staff and send them an email invitation to join.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Saved Practice Coaches Roster (Per-Team) */}
        <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-700 flex-wrap gap-2">
            <div>
              <h3 className="font-black text-sm text-slate-100 flex items-center gap-1.5">
                <span>Practice Coaches</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Per Team
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Staff names for drill stations
              </p>
            </div>
            {userRole === 'admin' && (
              <button
                onClick={() => setShowAddPracticeCoachModal(true)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Name</span>
              </button>
            )}
          </div>

          {/* Team Filter for Practice Coaches */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              Coaching Staff for Team:
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={practiceCoachTeamFilter}
                onChange={(e) => setPracticeCoachTeamFilter(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.ageGroup || 'Youth'})
                  </option>
                ))}
              </select>

              {userRole === 'admin' && teams.length > 1 && onCopyCoachesFromTeam && (
                <button
                  type="button"
                  onClick={() => setShowCopyCoachesModal(true)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all"
                  title="Copy coaches from another team"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {currentTeamPracticeCoaches.map((coachName) => (
              <div
                key={coachName}
                className="p-2.5 bg-slate-900/90 border border-slate-700 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-200 hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>{coachName}</span>
                </div>
                {userRole === 'admin' && (
                  <button
                    onClick={() => onDeleteSavedCoach(coachName, practiceCoachTeamFilter)}
                    className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title={`Remove ${coachName} from ${activeFilterTeam?.name || 'this team'}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {currentTeamPracticeCoaches.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                No practice coaches listed for this team yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE NEW TEAM MODAL */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-white">Create New Football Team</h3>
              </div>
              <button
                onClick={() => setShowAddTeamModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. 10U Tackle Gold, 12U White, 8U Flag"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Age Group / Division
                  </label>
                  <input
                    type="text"
                    value={newTeamAge}
                    onChange={(e) => setNewTeamAge(e.target.value)}
                    placeholder="e.g. 10U, 12U, 8U, Flag"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Season
                  </label>
                  <input
                    type="text"
                    value={newTeamSeason}
                    onChange={(e) => setNewTeamSeason(e.target.value)}
                    placeholder="e.g. 2026, Fall 2026"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  TeamSnap / iCal Feed URL (Optional)
                </label>
                <input
                  type="url"
                  value={newTeamCalendarUrl}
                  onChange={(e) => setNewTeamCalendarUrl(e.target.value)}
                  placeholder="http://ical-cdn.teamsnap.com/team_schedule/..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Each team can have its own separate TeamSnap calendar feed URL.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Badge Color Theme
                </label>
                <div className="flex items-center gap-3">
                  {['indigo', 'amber', 'emerald', 'sky', 'rose', 'purple'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTeamColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        newTeamColor === c ? 'scale-125 border-white ring-2 ring-white/30' : 'border-transparent'
                      } ${
                        c === 'indigo'
                          ? 'bg-indigo-600'
                          : c === 'amber'
                          ? 'bg-amber-500'
                          : c === 'emerald'
                          ? 'bg-emerald-500'
                          : c === 'sky'
                          ? 'bg-sky-500'
                          : c === 'rose'
                          ? 'bg-rose-500'
                          : 'bg-purple-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-white">Edit Team Details</h3>
              </div>
              <button
                onClick={() => setEditingTeam(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingTeam.name}
                  onChange={(e) =>
                    setEditingTeam({ ...editingTeam, name: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Age Group / Division
                  </label>
                  <input
                    type="text"
                    value={editingTeam.ageGroup || ''}
                    onChange={(e) =>
                      setEditingTeam({ ...editingTeam, ageGroup: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Season
                  </label>
                  <input
                    type="text"
                    value={editingTeam.season || ''}
                    onChange={(e) =>
                      setEditingTeam({ ...editingTeam, season: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  TeamSnap / iCal Feed URL
                </label>
                <input
                  type="url"
                  value={editingTeam.calendarUrl || ''}
                  onChange={(e) =>
                    setEditingTeam({ ...editingTeam, calendarUrl: e.target.value })
                  }
                  placeholder="http://ical-cdn.teamsnap.com/team_schedule/..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Custom schedule feed for this team.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE TEAM CONFIRMATION MODAL */}
      {teamToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  Delete Team "{teamToDelete.name}"?
                </h3>
                <p className="text-xs text-rose-300/80 font-medium">
                  This action will permanently delete this team.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              Are you sure you want to remove <strong className="text-white font-bold">{teamToDelete.name}</strong> from the program? Any coach permissions, schedule events, and roster players assigned to this team will be cleanly updated.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTeamToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTeam}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF COACH MODAL */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-white">Add Coach Account</h3>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaffCoach} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Coach Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="coach.name@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Role Assigned
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Head Coach (Admin)">Head Coach (Admin)</option>
                  <option value="Assistant Coach">Assistant Coach</option>
                </select>
                <p className="text-[10.5px] text-slate-400 mt-1">
                  Head Coaches can build plays &amp; schedules for their allowed teams.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Allowed Teams (Access Permissions)
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {teams.map((t) => {
                    const isChecked = newStaffAssignedTeams.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded-lg cursor-pointer text-xs font-bold text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewStaffAssignedTeams([...newStaffAssignedTeams, t.id]);
                            } else {
                              setNewStaffAssignedTeams(
                                newStaffAssignedTeams.filter((id) => id !== t.id)
                              );
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                        />
                        <span>{t.name} ({t.ageGroup || 'Youth'})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Inactivity Auto-Logout Timeout
                </label>
                <select
                  value={newStaffIdleTimeout}
                  onChange={(e) => setNewStaffIdleTimeout(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={30}>30 Minutes (Default)</option>
                  <option value={60}>1 Hour</option>
                  <option value={90}>1.5 Hours (90 Min)</option>
                  <option value={120}>2 Hours</option>
                  <option value={240}>4 Hours</option>
                  <option value={0}>Disabled (Never Logout)</option>
                </select>
                <p className="text-[10.5px] text-slate-400 mt-1">
                  Depth charts and team data are automatically flushed &amp; saved to the server before any logout.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  Add Coach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PRACTICE COACH MODAL */}
      {showAddPracticeCoachModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-base text-white">
                  Add Practice Coach for {activeFilterTeam?.name}
                </h3>
              </div>
              <button
                onClick={() => setShowAddPracticeCoachModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePracticeCoach} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Coach Title or Name *
                </label>
                <input
                  type="text"
                  required
                  value={newPracticeCoachName}
                  onChange={(e) => setNewPracticeCoachName(e.target.value)}
                  placeholder="e.g. Coach Dan, Coach Mike, Coach Sarah"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Team Scoped To:
                </label>
                <select
                  value={practiceCoachTeamFilter}
                  onChange={(e) => setPracticeCoachTeamFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.ageGroup || 'Youth'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddPracticeCoachModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  Save Practice Coach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COPY COACHES MODAL */}
      {showCopyCoachesModal && onCopyCoachesFromTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base text-white">
                  Copy Practice Coaches
                </h3>
              </div>
              <button
                onClick={() => setShowCopyCoachesModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Copy the practice station coaching list from another team into{' '}
                <strong className="text-white">{activeFilterTeam?.name}</strong>:
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Source Team:
                </label>
                <select
                  value={copySourceTeamId}
                  onChange={(e) => setCopySourceTeamId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                >
                  {teams
                    .filter((t) => t.id !== practiceCoachTeamFilter)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCopyCoachesModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCopyCoachesFromTeam(copySourceTeamId, practiceCoachTeamFilter);
                    setShowCopyCoachesModal(false);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  Copy List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL INVITATION MODAL */}
      {inviteModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Coach Invitation Prepared
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Send join instructions to <span className="text-indigo-300 font-semibold">{inviteModalData.email}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setInviteModalData(null);
                  setCopiedInvite(false);
                  setCopiedLink(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Recipient:</span>
                  <span className="font-bold text-slate-200">{inviteModalData.email}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Role Assigned:</span>
                  <span className="font-bold text-indigo-300">{inviteModalData.role}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Teams:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[240px]">
                    {inviteModalData.assignedTeamNames.join(', ') || 'All Program Teams'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Email Message Preview
                </label>
                <textarea
                  readOnly
                  rows={7}
                  value={generateInviteBody(
                    inviteModalData.email,
                    inviteModalData.role,
                    inviteModalData.assignedTeamNames
                  )}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenMailClient(
                      inviteModalData.email,
                      inviteModalData.role,
                      inviteModalData.assignedTeamNames
                    )
                  }
                  className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open Email App</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const text = generateInviteBody(
                      inviteModalData.email,
                      inviteModalData.role,
                      inviteModalData.assignedTeamNames
                    );
                    navigator.clipboard.writeText(text);
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2500);
                  }}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedInvite ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied Invite!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Email Text</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== 'undefined' ? window.location.origin || window.location.href : '';
                    navigator.clipboard.writeText(origin);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Portal Link Copied!' : 'Copy Portal Link Only'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInviteModalData(null);
                    setCopiedInvite(false);
                    setCopiedLink(false);
                  }}
                  className="text-slate-400 hover:text-slate-200 font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Admin Passcode Modal */}
      {showChangePasscodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-500/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-slate-100">
                  {adminPasscodeSet ? 'Update Admin Passcode' : 'Set Admin Passcode'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowChangePasscodeModal(false);
                  setPasscodeError(null);
                  setInputNewPasscode('');
                  setInputConfirmPasscode('');
                }}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              This master passcode enables direct Head Coach / Administrator login from any browser under the Admin Passcode tab.
            </p>

            {passcodeError && (
              <div className="p-3 bg-rose-950/80 border border-rose-700/80 rounded-xl text-xs text-rose-200 font-semibold">
                ⚠️ {passcodeError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPasscodeError(null);
                if (!inputNewPasscode.trim()) {
                  setPasscodeError('Please enter a passcode.');
                  return;
                }
                if (inputNewPasscode.trim().length < 4) {
                  setPasscodeError('Passcode must be at least 4 characters.');
                  return;
                }
                if (inputNewPasscode.trim() !== inputConfirmPasscode.trim()) {
                  setPasscodeError('Passcodes do not match.');
                  return;
                }
                if (onUpdateAdminPasscode) {
                  onUpdateAdminPasscode(inputNewPasscode.trim());
                }
                setPasscodeSuccess('Admin passcode updated successfully!');
                setShowChangePasscodeModal(false);
                setInputNewPasscode('');
                setInputConfirmPasscode('');
                setTimeout(() => setPasscodeSuccess(null), 4000);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  New Admin Passcode
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={inputNewPasscode}
                  onChange={(e) => setInputNewPasscode(e.target.value)}
                  placeholder="Enter new admin passcode"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Confirm Passcode
                </label>
                <input
                  type="password"
                  required
                  value={inputConfirmPasscode}
                  onChange={(e) => setInputConfirmPasscode(e.target.value)}
                  placeholder="Re-enter new admin passcode"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePasscodeModal(false);
                    setPasscodeError(null);
                    setInputNewPasscode('');
                    setInputConfirmPasscode('');
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Passcode</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Email Reset Link Modal */}
      {showResetLinkModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-indigo-500/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-slate-100">
                  Email Admin Passcode Reset Link
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetLinkModal(false);
                  setResetLinkStatus(null);
                }}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Send a secure one-time reset link and 6-digit verification code to the authorized coach or administrator email below.
            </p>

            {resetLinkStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                  resetLinkStatus.isError
                    ? 'bg-rose-950/80 border border-rose-700/80 text-rose-200'
                    : 'bg-emerald-950/80 border border-emerald-700/80 text-emerald-200'
                }`}
              >
                {resetLinkStatus.isError ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1">
                  <span>{resetLinkStatus.message}</span>
                  {resetLinkStatus.code && (
                    <div className="p-2 bg-slate-900/80 rounded-lg font-mono text-xs text-amber-300 font-black">
                      Verification Code: {resetLinkStatus.code}
                    </div>
                  )}
                  {resetLinkStatus.link && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(resetLinkStatus.link || '');
                        alert('Reset link copied to clipboard!');
                      }}
                      className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/30 text-[10.5px] font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Reset Link</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setResetLinkStatus(null);
                const emailTarget = resetLinkEmail.toLowerCase().trim();
                if (!emailTarget || !emailTarget.includes('@')) {
                  setResetLinkStatus({ message: 'Please enter a valid email address.', isError: true });
                  return;
                }

                setResetLinkLoading(true);
                try {
                  if (typeof window !== 'undefined' && (window as any).firebase?.auth) {
                    try {
                      const auth = (window as any).firebase.auth();
                      await auth.sendPasswordResetEmail(emailTarget);
                    } catch (fbErr: any) {
                      console.log('[Auth] Firebase reset email info:', fbErr?.message);
                    }
                  }

                  const res = await fetch('/api/admin/request-passcode-reset', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailTarget }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Failed to dispatch reset email.');
                  }

                  setResetLinkStatus({
                    message: `If ${data.maskedEmail || emailTarget} is an authorized Head Coach, a reset was recorded. The verification code is not shown in this app.`,
                    isError: false,
                  });
                } catch (err: any) {
                  setResetLinkStatus({
                    message: err.message || 'Failed to send reset link.',
                    isError: true,
                  });
                } finally {
                  setResetLinkLoading(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={resetLinkEmail}
                  onChange={(e) => setResetLinkEmail(e.target.value)}
                  placeholder="coach@team.com"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetLinkModal(false);
                    setResetLinkStatus(null);
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={resetLinkLoading || !resetLinkEmail}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  <span>{resetLinkLoading ? 'Sending...' : 'Send Reset Link'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
