import React, { useState } from 'react';
import { Crown, Plus, Shield, Trash2, UserPlus, Users, X } from 'lucide-react';
import type {
  BasketballPlayer,
  BasketballStaffMember,
  BasketballTab,
  BasketballTeam,
  CourtPosition,
} from '../types';

interface BasketballUsersViewProps {
  teams: BasketballTeam[];
  activeTeamId: string;
  roster: BasketballPlayer[];
  staff: BasketballStaffMember[];
  readOnly?: boolean;
  onSelectTeam: (teamId: string) => void;
  onAddTeam: (team: Omit<BasketballTeam, 'id'>) => void;
  onAddPlayer: (player: Omit<BasketballPlayer, 'id'>) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddStaff: (member: Omit<BasketballStaffMember, 'id'>) => void;
  onUpdateStaff: (memberId: string, updates: Partial<BasketballStaffMember>) => void;
  onDeleteStaff: (memberId: string) => void;
}

const ALL_TABS: { id: BasketballTab; label: string }[] = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'filmroom', label: 'Film Room' },
  { id: 'scout', label: 'Hudl Scout' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'users', label: 'Team & Users' },
];

export const BasketballUsersView: React.FC<BasketballUsersViewProps> = ({
  teams,
  activeTeamId,
  roster,
  staff,
  readOnly = false,
  onSelectTeam,
  onAddTeam,
  onAddPlayer,
  onDeletePlayer,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
}) => {
  const [section, setSection] = useState<'roster' | 'access' | 'teams'>('roster');
  const [newPlayer, setNewPlayer] = useState({
    num: '',
    firstName: '',
    lastName: '',
    position: 'PG' as CourtPosition,
    height: '',
    grade: '',
  });
  const [newTeam, setNewTeam] = useState({ name: '', season: '2026-27 Winter' });
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    role: 'Coach' as BasketballStaffMember['role'],
    linkedNum: '',
  });

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayer.num.trim() || !newPlayer.firstName.trim()) return;
    onAddPlayer({
      num: newPlayer.num.trim(),
      firstName: newPlayer.firstName.trim(),
      lastName: newPlayer.lastName.trim(),
      position: newPlayer.position,
      height: newPlayer.height.trim() || undefined,
      grade: newPlayer.grade.trim() || undefined,
    });
    setNewPlayer({ num: '', firstName: '', lastName: '', position: 'PG', height: '', grade: '' });
  };

  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeam.name.trim()) return;
    onAddTeam({
      name: newTeam.name.trim(),
      season: newTeam.season.trim() || '2026-27 Winter',
      accentColor: '#f59e0b',
    });
    setNewTeam({ name: '', season: '2026-27 Winter' });
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.email.trim()) return;
    const isLimited = newStaff.role === 'Family' || newStaff.role === 'Player';
    onAddStaff({
      name: newStaff.name.trim() || newStaff.email.split('@')[0],
      email: newStaff.email.trim().toLowerCase(),
      role: newStaff.role,
      teamIds: [activeTeamId],
      linkedPlayerNums: newStaff.linkedNum.trim() ? [newStaff.linkedNum.trim()] : [],
      allowedTabs: isLimited ? ['schedule', 'highlights'] : undefined,
      highlightAccess: isLimited ? 'kid' : undefined,
    });
    setNewStaff({ name: '', email: '', role: 'Coach', linkedNum: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            Program Management
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-0.5">
            Team, Roster &amp; User Access
          </h1>
        </div>

        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-0.5">
          {(
            [
              { id: 'roster', label: `Roster (${roster.length})` },
              { id: 'access', label: `Users & Roles (${staff.length})` },
              { id: 'teams', label: `Teams (${teams.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                section === t.id
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: ROSTER */}
      {section === 'roster' && (
        <div className="space-y-4">
          {!readOnly && (
            <form
              onSubmit={handleAddPlayer}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 grid grid-cols-2 sm:grid-cols-7 gap-2.5 items-end"
            >
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Jersey #</label>
                <input
                  type="text"
                  required
                  value={newPlayer.num}
                  onChange={(e) => setNewPlayer({ ...newPlayer, num: e.target.value })}
                  placeholder="23"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={newPlayer.firstName}
                  onChange={(e) => setNewPlayer({ ...newPlayer, firstName: e.target.value })}
                  placeholder="First"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Last Name</label>
                <input
                  type="text"
                  value={newPlayer.lastName}
                  onChange={(e) => setNewPlayer({ ...newPlayer, lastName: e.target.value })}
                  placeholder="Last"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Position</label>
                <select
                  value={newPlayer.position}
                  onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value as CourtPosition })}
                  className="w-full h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                >
                  {(['PG', 'SG', 'SF', 'PF', 'C'] as const).map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-9 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          )}

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Pos</th>
                  <th className="py-3 px-4">Height / Grade</th>
                  <th className="py-3 px-4">Tags</th>
                  {!readOnly && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {[...roster]
                  .sort((a, b) => Number(a.num) - Number(b.num))
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-500">#{p.num}</td>
                      <td className="py-2.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                        {p.firstName} {p.lastName}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-semibold">
                          {p.position}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-500">
                        {[p.height, p.grade].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(p.tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      {!readOnly && (
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onDeletePlayer(p.id)}
                            className="p-1.5 text-zinc-400 hover:text-rose-500 cursor-pointer"
                            title="Remove player"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: STAFF & FAMILY ACCESS */}
      {section === 'access' && (
        <div className="space-y-4">
          {!readOnly && (
            <form
              onSubmit={handleAddStaff}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 grid grid-cols-1 sm:grid-cols-6 gap-2.5 items-end"
            >
              <div className="sm:col-span-1">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Name</label>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="Coach / Parent"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as BasketballStaffMember['role'] })}
                  className="w-full h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                >
                  <option value="Admin">Admin</option>
                  <option value="Coach">Coach</option>
                  <option value="Player">Player</option>
                  <option value="Family">Family</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Linked Kid #</label>
                <input
                  type="text"
                  value={newStaff.linkedNum}
                  onChange={(e) => setNewStaff({ ...newStaff, linkedNum: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite</span>
              </button>
            </form>
          )}

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 divide-y divide-zinc-200 dark:divide-zinc-800">
            {staff.map((m) => (
              <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{m.name}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        m.role === 'Admin'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : m.role === 'Coach'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {m.role}
                    </span>
                    {m.linkedPlayerNums.length > 0 && (
                      <span className="text-[11px] font-mono text-amber-500">
                        Kid #{m.linkedPlayerNums.join(', #')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{m.email}</div>
                </div>

                {!readOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => onUpdateStaff(m.id, { role: e.target.value as BasketballStaffMember['role'] })}
                      className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Coach">Coach</option>
                      <option value="Player">Player</option>
                      <option value="Family">Family</option>
                    </select>

                    {(m.role === 'Player' || m.role === 'Family') && (
                      <div className="flex items-center gap-1">
                        {ALL_TABS.filter((t) => t.id !== 'users').map((t) => {
                          const enabled = (m.allowedTabs || ['schedule', 'highlights']).includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                const curr = m.allowedTabs || ['schedule', 'highlights'];
                                const next = enabled ? curr.filter((x) => x !== t.id) : [...curr, t.id];
                                onUpdateStaff(m.id, { allowedTabs: next });
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                                enabled
                                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                              }`}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteStaff(m.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-500 cursor-pointer"
                      title="Remove user"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: TEAMS */}
      {section === 'teams' && (
        <div className="space-y-4">
          {!readOnly && (
            <form
              onSubmit={handleAddTeam}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 flex flex-wrap gap-2.5 items-end"
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="e.g. Mahopac Varsity Girls"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div className="w-40">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Season</label>
                <input
                  type="text"
                  value={newTeam.season}
                  onChange={(e) => setNewTeam({ ...newTeam, season: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer"
              >
                Create Team
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teams.map((t) => {
              const active = t.id === activeTeamId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTeam(t.id)}
                  className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    active
                      ? 'border-amber-500 bg-amber-500/5'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{t.name}</span>
                    {active && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500 text-zinc-950">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">{t.season}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
