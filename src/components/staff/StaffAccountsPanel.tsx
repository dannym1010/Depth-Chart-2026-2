// Staff & access, the accounts: built for a whole program (coaches plus every player and family). Search, a filter by
// kind with counts, one section per kind (waiting first), compact rows (a coach's start screen and auto-logout behind
// ⚙), and changes to many accounts at once (approve, revoke, role, team, auto-logout, copy their emails, remove).
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Copy, Crown, Lock, Mail, Search, Settings2, Shield, Trash2, UserPlus, Users, X } from 'lucide-react';
import type { StaffCoach, Team, UnitType, UserRole } from '../../types';
import { FAMILY_ROLE, PLAYER_ROLE, defaultTabsFor, accountTabs, isViewOnlyRole } from '../../utils/playerAccess';
import { canSeeCoach, coachTeamIds, hasNoTeamYet, type StaffManager } from '../../utils/staffAccess';
import { matchesStaffSearch, staffGroup, STAFF_GROUPS, type StaffEdit, type StaffGroup } from '../../utils/staffBulk';
import { AccountKids, AccountTabs } from './AccountChips';

type Kid = { num: string; firstName?: string; lastName?: string };

interface Props {
  staffList: StaffCoach[];
  /** Teams this admin manages (all of them for the program owner). */
  teams: Team[];
  allTeams: Team[];
  roster: Kid[];
  userRole: UserRole;
  isProgramAdmin: boolean;
  manager: StaffManager;
  currentUserEmail?: string;
  activeTeamId: string;
  defaultTeamId?: string;
  teamFilter: string;
  onTeamFilter: (id: string) => void;
  canManageStaffAt: (idx: number) => boolean;
  isMaster: (email: string) => boolean;
  onAdd: () => void;
  onInvite: (coach: StaffCoach) => void;
  /** Change many accounts at once (by email). Without it, only one at a time. */
  onEditStaff?: (edits: StaffEdit[]) => void;
  onUpdateStaffRole: (idx: number, role: string) => void;
  onUpdateStaffPlayerTabs?: (idx: number, tabs: string[] | undefined) => void;
  onUpdateStaffKids?: (idx: number, kids: string[]) => void;
  onToggleStaffApproval: (idx: number) => void;
  onRemoveStaffCoach: (idx: number) => void;
  onToggleTeam: (idx: number, coach: StaffCoach, teamId: string) => void;
  onUpdateStaffPreferences?: (idx: number, favoriteTeamId?: string, startScreen?: UnitType, idleTimeoutMinutes?: number) => void;
}

const ROLES = [
  { value: 'Head Coach (Admin)', label: 'Head Coach (Admin)' },
  { value: 'Assistant Coach', label: 'Assistant Coach' },
  { value: PLAYER_ROLE, label: 'Player (view only)' },
  { value: FAMILY_ROLE, label: 'Family (games & highlights)' },
];
const LOGOUTS = [
  { v: 30, label: '30 min' },
  { v: 60, label: '1 hour' },
  { v: 90, label: '1.5 hours' },
  { v: 120, label: '2 hours' },
  { v: 240, label: '4 hours' },
  { v: 0, label: 'Never' },
];
const logoutLabel = (m?: number) => LOGOUTS.find((x) => x.v === (m ?? 30))?.label || `${m} min`;

type Show = 'all' | StaffGroup | 'nokid';
const COLLAPSE_KEY = 'staffAccessCollapsed';
const readCollapsed = (): StaffGroup[] => {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const sel = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none focus:border-indigo-500';

export const StaffAccountsPanel: React.FC<Props> = (p) => {
  const { staffList, teams, allTeams, roster, userRole, manager, teamFilter, isMaster } = p;
  const isAdmin = userRole === 'admin';
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [collapsed, setCollapsed] = useState<StaffGroup[]>(readCollapsed);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [note, setNote] = useState('');
  const bulk = Boolean(p.onEditStaff) && isAdmin;
  const toggleCollapsed = (g: StaffGroup) =>
    setCollapsed((c) => {
      const next = c.includes(g) ? c.filter((x) => x !== g) : [...c, g];
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* this visit only */
      }
      return next;
    });

  // Everyone this admin sees for the team picked (the owner, and sign-ups waiting for a team, always).
  const rows = useMemo(
    () =>
      staffList
        .map((c, idx) => ({ c, idx }))
        .filter(({ c }) => {
          if (!canSeeCoach(manager, c, allTeams)) return false;
          if (teamFilter === 'all' || isMaster(c.email)) return true;
          if (c.status === 'Pending' && hasNoTeamYet(c)) return true;
          return coachTeamIds(c, allTeams).includes(teamFilter);
        }),
    [staffList, manager, allTeams, teamFilter, isMaster]
  );
  const noKid = (c: StaffCoach) => isViewOnlyRole(c.role) && c.status === 'Active' && !(c.kids || []).length;
  const counts = useMemo(() => {
    const n: Record<Show, number> = { all: rows.length, pending: 0, coach: 0, player: 0, family: 0, nokid: 0 };
    for (const { c } of rows) {
      n[staffGroup(c)] += 1;
      if (noKid(c)) n.nokid += 1;
    }
    return n;
  }, [rows]);
  const shown = useMemo(
    () =>
      rows.filter(({ c }) => (show === 'all' || (show === 'nokid' ? noKid(c) : staffGroup(c) === show)) && matchesStaffSearch(c, q, roster)),
    [rows, show, q, roster]
  );
  // Picks that are still on screen and can be changed.
  const editable = (idx: number) => p.canManageStaffAt(idx);
  const pickedRows = shown.filter(({ c, idx }) => picked.has(c.email) && editable(idx));
  useEffect(() => setConfirmRemove(false), [picked]);

  const pick = (emails: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      emails.forEach((e) => (on ? n.add(e) : n.delete(e)));
      return n;
    });
  const edit = (list: { c: StaffCoach }[], patch: (c: StaffCoach) => Partial<StaffCoach> | null | undefined, done: string) => {
    const edits = list.map(({ c }) => ({ email: c.email, patch: patch(c) })).filter((e): e is StaffEdit => e.patch !== undefined);
    if (!edits.length) return;
    p.onEditStaff?.(edits);
    setNote(`${done} ${edits.length} account${edits.length === 1 ? '' : 's'}.`);
  };
  const joinTeam = teamFilter !== 'all' ? teamFilter : p.activeTeamId;
  const approve = (list: { c: StaffCoach }[]) =>
    edit(list.filter(({ c }) => c.status !== 'Active'), (c) => ({ status: 'Active', ...(hasNoTeamYet(c) ? { assignedTeamIds: [joinTeam] } : {}) }), 'Approved');
  const copyEmails = async (list: { c: StaffCoach }[]) => {
    const text = list.map(({ c }) => c.email).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      setNote(`Copied ${list.length} email${list.length === 1 ? '' : 's'} (paste them into Bcc).`);
    } catch {
      window.prompt('Copy these emails:', text);
    }
  };

  const chip = (id: Show, label: string, tone = '') => {
    const n = counts[id];
    if (id !== 'all' && !n && show !== id) return null;
    const on = show === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={on}
        onClick={() => setShow(on && id !== 'all' ? 'all' : id)}
        className={`h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
          on ? 'bg-indigo-600 text-white border-indigo-500' : `bg-slate-900 border-slate-700 hover:border-slate-500 ${tone || 'text-slate-300'}`
        }`}
      >
        {label} <span className="tabular-nums opacity-80">{n}</span>
      </button>
    );
  };

  const row = ({ c, idx }: { c: StaffCoach; idx: number }) => {
    const master = isMaster(c.email);
    const canEdit = editable(idx);
    const active = c.status === 'Active';
    const onTeams = coachTeamIds(c, allTeams);
    const viewOnly = isViewOnlyRole(c.role);
    const me = c.email.toLowerCase() === String(p.currentUserEmail || '').toLowerCase();
    const isOpen = open === c.email;
    return (
      <li key={c.email} className={`px-3 py-2.5 ${picked.has(c.email) ? 'bg-indigo-500/10' : 'hover:bg-slate-900/40'}`}>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          {bulk && (
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              disabled={!canEdit}
              checked={picked.has(c.email)}
              onChange={(e) => pick([c.email], e.target.checked)}
              aria-label={`Pick ${c.email}`}
            />
          )}
          <div className="min-w-0 flex-1 basis-60">
            <div className="flex items-center gap-1.5 min-w-0">
              {master && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              <span className="font-mono font-bold text-xs text-slate-100 truncate" title={c.email}>{c.email}</span>
              {me && <span className="text-[10px] font-black text-indigo-300">YOU</span>}
            </div>
            {canEdit && p.onEditStaff ? (
              <input
                key={`${c.email}-${c.name || ''}`}
                defaultValue={c.name || ''}
                placeholder={viewOnly ? 'Name (e.g. Ward family)' : 'Name'}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (c.name || '')) p.onEditStaff?.([{ email: c.email, patch: { name: v || undefined } }]);
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="mt-0.5 w-full max-w-[16rem] bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none"
                aria-label={`Name for ${c.email}`}
              />
            ) : (
              c.name && <div className="text-[11px] text-slate-400 truncate">{c.name}</div>
            )}
            {!master && (
              <div className="flex flex-wrap items-start gap-x-4">
                <AccountTabs role={c.role} tabs={accountTabs(c)} disabled={!canEdit} onChange={(tabs) => p.onUpdateStaffPlayerTabs?.(idx, tabs)} />
                {viewOnly && <AccountKids kids={c.kids || []} roster={roster} disabled={!canEdit || !p.onUpdateStaffKids} onChange={(kids) => p.onUpdateStaffKids?.(idx, kids)} />}
              </div>
            )}
          </div>

          <div className="w-full sm:w-44 shrink-0">
            {master ? (
              <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10.5px] border border-amber-500/30 inline-flex items-center gap-1">
                <Crown className="w-3 h-3" /> Program owner
              </span>
            ) : canEdit ? (
              <select value={c.role} onChange={(e) => p.onUpdateStaffRole(idx, e.target.value)} className={`${sel} w-full`} aria-label={`Role for ${c.email}`}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
                {!ROLES.some((r) => r.value === c.role) && <option value={c.role}>{c.role}</option>}
              </select>
            ) : (
              <span className="text-[11px] font-semibold text-slate-300">{c.role}</span>
            )}
          </div>

          <div className="w-full sm:w-auto sm:max-w-[14rem] shrink-0">
            {master ? (
              <span className="text-[10px] font-bold text-amber-300 inline-flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Every team
              </span>
            ) : canEdit && isAdmin ? (
              <div className="flex flex-wrap gap-1" aria-label={`Teams for ${c.email}`}>
                {teams.map((t) => {
                  const on = onTeams.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => p.onToggleTeam(idx, c, t.id)}
                      aria-pressed={on}
                      title={`${on ? 'Take off' : 'Add to'} ${t.name}`}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${on ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'}`}
                    >
                      {t.ageGroup || t.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[11px] text-slate-300">
                {allTeams.filter((t) => onTeams.includes(t.id)).map((t) => t.ageGroup || t.name).join(', ') || 'No team yet'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {active ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Active</span>
            ) : canEdit ? (
              <button type="button" onClick={() => p.onToggleStaffApproval(idx)} className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
                ✓ Approve
              </button>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">Waiting</span>
            )}
            {isAdmin && (
              <button type="button" onClick={() => p.onInvite(c)} className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-indigo-600/40 cursor-pointer" title={`Email an invitation to ${c.email}`} aria-label={`Invite ${c.email}`}>
                <Mail className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : c.email)}
              aria-expanded={isOpen}
              className={`p-1.5 rounded-lg cursor-pointer ${isOpen ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              title="Start screen, favorite team, auto-logout, access"
              aria-label={`More for ${c.email}`}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            {canEdit && (
              <button type="button" onClick={() => p.onRemoveStaffCoach(idx)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/50 cursor-pointer" title="Remove this account" aria-label={`Remove ${c.email}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="mt-2 ml-0 sm:ml-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-900/80 border border-slate-700/70 px-3 py-2 text-[11px] text-slate-300">
            {!viewOnly && (
              <>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Favorite team</span>
                  <select value={c.favoriteTeamId || p.defaultTeamId || teams[0]?.id || ''} onChange={(e) => p.onUpdateStaffPreferences?.(idx, e.target.value, c.startScreen)} className={sel}>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Opens on</span>
                  <select value={c.startScreen || 'schedule'} onChange={(e) => p.onUpdateStaffPreferences?.(idx, c.favoriteTeamId, e.target.value as UnitType)} className={sel}>
                    <option value="mobile_hub">Mobile Coach HUD</option>
                    <option value="home">Home</option>
                    <option value="schedule">Team Schedule</option>
                    <option value="depth_chart">Depth Chart</option>
                    <option value="practice">Practice Planner</option>
                    <option value="call_sheet">Call Sheet &amp; Wristbands</option>
                    <option value="hudl_scout">Hudl Scout</option>
                    <option value="playbook">Play Library</option>
                    <option value="drills">Drill Library</option>
                    <option value="compliance">Compliance &amp; Hours</option>
                    <option value="users">Staff &amp; Team Access</option>
                  </select>
                </label>
              </>
            )}
            <label className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-500 font-bold">Auto-logout</span>
              {isAdmin ? (
                <select value={c.idleTimeoutMinutes ?? 30} onChange={(e) => p.onUpdateStaffPreferences?.(idx, c.favoriteTeamId, c.startScreen, Number(e.target.value))} className={sel}>
                  {LOGOUTS.map((x) => (
                    <option key={x.v} value={x.v}>{x.label}</option>
                  ))}
                </select>
              ) : (
                <span>{logoutLabel(c.idleTimeoutMinutes)}</span>
              )}
            </label>
            {canEdit && active && (
              <button type="button" onClick={() => p.onToggleStaffApproval(idx)} className="ml-auto px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-rose-300 hover:border-rose-700/60 font-bold cursor-pointer">
                Revoke access
              </button>
            )}
          </div>
        )}
      </li>
    );
  };

  const groups = STAFF_GROUPS.map((g) => ({ ...g, list: shown.filter(({ c }) => staffGroup(c) === g.id) })).filter((g) => g.list.length);
  const teamName = teamFilter === 'all' ? 'every team' : allTeams.find((t) => t.id === teamFilter)?.name || 'this team';

  return (
    <div className="bg-slate-800/95 rounded-3xl border border-slate-700/80 shadow-xl p-4 sm:p-5 flex flex-col gap-3">
      {/* Title, team, add */}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-700">
        <Shield className="w-4 h-4 text-indigo-400" />
        <h3 className="font-black text-sm text-slate-100">Accounts &amp; access</h3>
        <span className="text-[11px] text-slate-400">
          {counts.all} on {teamName}
          {counts.pending ? ` · ${counts.pending} waiting` : ''}
        </span>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
            Team
            <select value={teamFilter} onChange={(e) => p.onTeamFilter(e.target.value)} className={`${sel} text-indigo-300 font-bold`} aria-label="Show accounts for team">
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              {p.isProgramAdmin && <option value="all">All teams</option>}
            </select>
          </label>
          {isAdmin && (
            <button type="button" onClick={p.onAdd} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer">
              <UserPlus className="w-3.5 h-3.5" /> Add accounts
            </button>
          )}
        </div>
      </div>

      {/* Search and kinds */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[12rem] max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, name, or a kid (#21, Nash)"
            className="w-full h-8 pl-8 pr-7 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            aria-label="Search accounts"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Show">
          {chip('all', 'All')}
          {chip('pending', 'Waiting', 'text-amber-300')}
          {chip('coach', 'Coaches')}
          {chip('player', 'Players')}
          {chip('family', 'Families')}
          {chip('nokid', 'No kid linked', 'text-amber-300')}
        </div>
      </div>

      {/* Many at once */}
      {bulk && pickedRows.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-indigo-950/95 border border-indigo-700/60 px-3 py-2 text-[11px] text-indigo-100 shadow-lg">
          <span className="font-black">{pickedRows.length} picked</span>
          <button type="button" onClick={() => approve(pickedRows)} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">✓ Approve</button>
          <button type="button" onClick={() => edit(pickedRows.filter(({ c }) => c.status === 'Active'), () => ({ status: 'Pending' }), 'Revoked')} className="px-2.5 py-1 rounded-lg border border-indigo-600 hover:bg-indigo-800 font-bold cursor-pointer">Revoke</button>
          <select
            value=""
            onChange={(e) => {
              const role = e.target.value;
              if (role) edit(pickedRows, (c) => (c.role === role ? undefined : { role, playerTabs: defaultTabsFor(role) }), `Made ${ROLES.find((r) => r.value === role)?.label || role}:`);
            }}
            className={sel}
            aria-label="Set the role of the picked accounts"
          >
            <option value="">Role…</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {teams.length > 1 && (
            <select
              value=""
              onChange={(e) => {
                const [how, id] = e.target.value.split(':');
                if (!id) return;
                if (how === 'add') edit(pickedRows, (c) => (coachTeamIds(c, allTeams).includes(id) ? undefined : { assignedTeamIds: [...coachTeamIds(c, allTeams), id] }), 'Added to the team:');
                else
                  edit(pickedRows, (c) => {
                    const now = coachTeamIds(c, allTeams);
                    // Never leave an account with no team at all.
                    return now.includes(id) && now.length > 1 ? { assignedTeamIds: now.filter((t) => t !== id) } : undefined;
                  }, 'Taken off the team:');
              }}
              className={sel}
              aria-label="Add the picked accounts to a team, or take them off one"
            >
              <option value="">Team…</option>
              {teams.map((t) => (
                <option key={`a${t.id}`} value={`add:${t.id}`}>Add to {t.name}</option>
              ))}
              {teams.map((t) => (
                <option key={`r${t.id}`} value={`off:${t.id}`}>Take off {t.name}</option>
              ))}
            </select>
          )}
          <select
            value=""
            onChange={(e) => e.target.value !== '' && edit(pickedRows, () => ({ idleTimeoutMinutes: Number(e.target.value) }), 'Auto-logout set for')}
            className={sel}
            aria-label="Auto-logout for the picked accounts"
          >
            <option value="">Auto-logout…</option>
            {LOGOUTS.map((x) => (
              <option key={x.v} value={x.v}>{x.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => void copyEmails(pickedRows)} className="px-2.5 py-1 rounded-lg border border-indigo-600 hover:bg-indigo-800 font-bold inline-flex items-center gap-1 cursor-pointer">
            <Copy className="w-3 h-3" /> Copy emails
          </button>
          {confirmRemove ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="font-bold text-rose-200">Remove {pickedRows.length}? They lose access.</span>
              <button
                type="button"
                onClick={() => {
                  edit(pickedRows, () => null, 'Removed');
                  setPicked(new Set());
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                Remove
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="underline cursor-pointer">Keep</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} className="px-2.5 py-1 rounded-lg text-rose-300 hover:bg-rose-950/60 font-bold inline-flex items-center gap-1 cursor-pointer">
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          )}
          <button type="button" onClick={() => setPicked(new Set())} className="ml-auto underline cursor-pointer">Clear</button>
        </div>
      )}
      {note && (
        <div role="status" className="text-[11px] font-semibold text-emerald-300 flex items-center gap-2">
          {note}
          <button type="button" onClick={() => setNote('')} className="underline text-slate-400">OK</button>
        </div>
      )}

      {/* One section per kind */}
      <div className="flex flex-col gap-3">
        {groups.map((g) => {
          const isCollapsed = collapsed.includes(g.id) && !q;
          const mine = g.list.filter(({ idx }) => editable(idx));
          const allPicked = mine.length > 0 && mine.every(({ c }) => picked.has(c.email));
          return (
            <section key={g.id} className={`rounded-2xl border ${g.id === 'pending' ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-700/70 bg-slate-900/30'}`} aria-label={g.label}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-700/60">
                {bulk && mine.length > 0 && (
                  <input type="checkbox" checked={allPicked} onChange={(e) => pick(mine.map(({ c }) => c.email), e.target.checked)} aria-label={`Pick every account in ${g.label}`} />
                )}
                <button type="button" onClick={() => toggleCollapsed(g.id)} className="inline-flex items-center gap-1 font-black text-xs text-slate-100 cursor-pointer" aria-expanded={!isCollapsed}>
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {g.label}
                  <span className="text-slate-400 tabular-nums">{g.list.length}</span>
                </button>
                {g.id === 'pending' && (
                  <span className="text-[11px] text-amber-300/90">They can't open the app until approved.</span>
                )}
                {g.id === 'family' && counts.nokid > 0 && (
                  <button type="button" onClick={() => setShow('nokid')} className="text-[11px] text-amber-300 underline cursor-pointer">
                    {counts.nokid} without a kid linked
                  </button>
                )}
                {g.id === 'pending' && bulk && mine.length > 0 && (
                  <button type="button" onClick={() => approve(mine)} className="ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer">
                    ✓ Approve all {mine.length}
                  </button>
                )}
              </div>
              {!isCollapsed && <ul className="divide-y divide-slate-700/50">{g.list.map(row)}</ul>}
            </section>
          );
        })}
        {!shown.length && (
          <div className="text-center py-10 px-4 space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">{rows.length ? 'No account matches.' : 'No accounts yet.'}</p>
            {!rows.length && isAdmin && (
              <p className="text-[11px] text-slate-500">
                Tap <strong className="text-slate-300">Add accounts</strong> to add a coach, or paste a whole list of parents' emails at once.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
