import React, { useMemo, useRef, useState } from 'react';
import { Check, Crown, Download, Edit3, Plus, Shield, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { isProgramAdminEmail } from '../../utils/staffAccess';
import { parseBasketballRosterInput, parseTeamSnapMembersResponse } from '../storage';
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
  onUpdateTeam: (teamId: string, updates: Partial<BasketballTeam>) => void;
  onAddPlayer: (player: Omit<BasketballPlayer, 'id'>) => void;
  onUpdatePlayer: (playerId: string, updates: Partial<BasketballPlayer>) => void;
  onDeletePlayer: (playerId: string) => void;
  onImportRoster: (players: Omit<BasketballPlayer, 'id'>[], mode: 'replace' | 'append') => void;
  onClearRoster: () => void;
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
  onUpdateTeam,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onImportRoster,
  onClearRoster,
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
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerDraft, setPlayerDraft] = useState<{
    num: string;
    firstName: string;
    lastName: string;
    position: CourtPosition;
    height: string;
    grade: string;
    tags: string;
  } | null>(null);

  const [newTeam, setNewTeam] = useState({ name: '', season: '2026-27 Winter' });
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState({ name: '', season: '', calendarUrl: '' });

  // TeamSnap Roster Import modal state
  const [showRosterImport, setShowRosterImport] = useState(false);
  const [rosterTab, setRosterTab] = useState<'paste' | 'csv' | 'api'>('paste');
  const [rosterText, setRosterText] = useState('');
  const [rosterPreview, setRosterPreview] = useState<Omit<BasketballPlayer, 'id'>[]>([]);
  const [rosterSkipped, setRosterSkipped] = useState<string[]>([]);
  const [rosterMode, setRosterMode] = useState<'replace' | 'append'>('replace');
  const [tsTeamId, setTsTeamId] = useState('');
  const [tsToken, setTsToken] = useState('');
  const [tsBusy, setTsBusy] = useState(false);
  const [tsError, setTsError] = useState('');
  const rosterFileRef = useRef<HTMLInputElement>(null);

  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    role: 'Coach' as BasketballStaffMember['role'],
    linkedNum: '',
    teamIds: [activeTeamId] as string[],
    defaultSport: 'basketball' as 'basketball' | 'football',
  });

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) || teams[0],
    [teams, activeTeamId]
  );

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

  const startEditPlayer = (p: BasketballPlayer) => {
    setEditingPlayerId(p.id);
    setPlayerDraft({
      num: p.num,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      height: p.height || '',
      grade: p.grade || '',
      tags: (p.tags || []).join(', '),
    });
  };

  const saveEditPlayer = (playerId: string) => {
    if (!playerDraft || !playerDraft.num.trim() || !playerDraft.firstName.trim()) return;
    onUpdatePlayer(playerId, {
      num: playerDraft.num.trim(),
      firstName: playerDraft.firstName.trim(),
      lastName: playerDraft.lastName.trim(),
      position: playerDraft.position,
      height: playerDraft.height.trim() || undefined,
      grade: playerDraft.grade.trim() || undefined,
      tags: playerDraft.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setEditingPlayerId(null);
    setPlayerDraft(null);
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
    const selectedTeamIds = newStaff.teamIds.length > 0 ? newStaff.teamIds : [activeTeamId];
    onAddStaff({
      name: newStaff.name.trim() || newStaff.email.split('@')[0],
      email: newStaff.email.trim().toLowerCase(),
      role: newStaff.role,
      status: 'Active',
      defaultSport: newStaff.defaultSport,
      teamIds: selectedTeamIds,
      linkedPlayerNums: newStaff.linkedNum.trim() ? [newStaff.linkedNum.trim()] : [],
      allowedTabs: isLimited ? ['schedule', 'highlights'] : undefined,
      highlightAccess: isLimited ? 'kid' : undefined,
    });
    setNewStaff({
      name: '',
      email: '',
      role: 'Coach',
      linkedNum: '',
      teamIds: [activeTeamId],
      defaultSport: 'basketball',
    });
  };

  const openRosterImportModal = () => {
    setRosterText('');
    setRosterPreview([]);
    setRosterSkipped([]);
    setTsError('');
    setRosterMode(roster.length === 0 ? 'replace' : 'append');
    setShowRosterImport(true);
  };

  const handleRosterTextChange = (text: string) => {
    setRosterText(text);
    const res = parseBasketballRosterInput(text);
    setRosterPreview(res.players);
    setRosterSkipped(res.skipped);
    setTsError('');
  };

  const handleRosterFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '');
      handleRosterTextChange(text);
    };
    reader.readAsText(file);
  };

  const handleFetchTeamSnapApiRoster = async () => {
    if (!tsTeamId.trim() || !tsToken.trim()) {
      setTsError('Enter both your TeamSnap Team ID and API Personal Access Token.');
      return;
    }
    setTsBusy(true);
    setTsError('');
    try {
      const res = await fetch(
        `https://api.teamsnap.com/v3/members/search?team_id=${encodeURIComponent(tsTeamId.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${tsToken.trim()}`,
            Accept: 'application/vnd.collection+json, application/json',
          },
        }
      );
      if (!res.ok) {
        setTsError(`TeamSnap API returned HTTP ${res.status}. Double-check your Team ID / Token or paste/upload your CSV export.`);
        return;
      }
      const json = await res.json();
      const players = parseTeamSnapMembersResponse(json);
      if (players.length === 0) {
        setTsError('No active players found on that TeamSnap team.');
      } else {
        setRosterPreview(players);
        setRosterSkipped([]);
      }
    } catch (err: any) {
      setTsError(
        err?.message?.includes('Failed to fetch')
          ? 'Browser blocked direct TeamSnap API request (CORS). In TeamSnap Roster, click Export CSV or copy-paste your player list into the Paste tab.'
          : err?.message || 'TeamSnap API request failed.'
      );
    } finally {
      setTsBusy(false);
    }
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
              { id: 'roster', label: `${activeTeam?.name || 'Team'} Roster (${roster.length})` },
              { id: 'access', label: `Basketball Users (${staff.length})` },
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              {activeTeam?.name || 'Team'} Roster{' '}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                — Separate per team ({roster.length} players)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {teams.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTeam(t.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${
                        t.id === activeTeamId
                          ? 'bg-amber-500 text-zinc-950 border-amber-500'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 hover:border-zinc-400'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              {!readOnly && (
                <>
                  <button
                    type="button"
                    onClick={openRosterImportModal}
                    className="h-7 px-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Import TeamSnap Roster</span>
                  </button>
                  {roster.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Clear all ${roster.length} players from ${activeTeam?.name || 'this team'}'s roster?`)) {
                          onClearRoster();
                        }
                      }}
                      className="h-7 px-2.5 rounded-md border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Roster</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {!readOnly && (
            <form
              onSubmit={handleAddPlayer}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 grid grid-cols-2 sm:grid-cols-9 gap-2.5 items-end"
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
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Height</label>
                <input
                  type="text"
                  value={newPlayer.height}
                  onChange={(e) => setNewPlayer({ ...newPlayer, height: e.target.value })}
                  placeholder="5'1&quot;"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Grade</label>
                <input
                  type="text"
                  value={newPlayer.grade}
                  onChange={(e) => setNewPlayer({ ...newPlayer, grade: e.target.value })}
                  placeholder="4th / 6th"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-3 rounded-lg bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          )}

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Pos</th>
                  <th className="py-3 px-4">Height / Grade</th>
                  <th className="py-3 px-4">Tags</th>
                  {!readOnly && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {[...roster]
                  .sort((a, b) => Number(a.num) - Number(b.num))
                  .map((p) => {
                    const editing = editingPlayerId === p.id && playerDraft;
                    return (
                      <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                        <td className="py-2.5 px-4 font-mono font-bold text-amber-500">
                          {editing ? (
                            <input
                              type="text"
                              value={playerDraft.num}
                              onChange={(e) => setPlayerDraft({ ...playerDraft, num: e.target.value })}
                              className="w-12 h-7 px-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100"
                            />
                          ) : (
                            `#${p.num}`
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                          {editing ? (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={playerDraft.firstName}
                                onChange={(e) => setPlayerDraft({ ...playerDraft, firstName: e.target.value })}
                                className="w-24 h-7 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                              />
                              <input
                                type="text"
                                value={playerDraft.lastName}
                                onChange={(e) => setPlayerDraft({ ...playerDraft, lastName: e.target.value })}
                                className="w-24 h-7 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                              />
                            </div>
                          ) : (
                            `${p.firstName} ${p.lastName}`
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {editing ? (
                            <select
                              value={playerDraft.position}
                              onChange={(e) =>
                                setPlayerDraft({ ...playerDraft, position: e.target.value as CourtPosition })
                              }
                              className="h-7 px-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                            >
                              {(['PG', 'SG', 'SF', 'PF', 'C'] as const).map((pos) => (
                                <option key={pos} value={pos}>
                                  {pos}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-semibold">
                              {p.position}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-500">
                          {editing ? (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={playerDraft.height}
                                placeholder="Height"
                                onChange={(e) => setPlayerDraft({ ...playerDraft, height: e.target.value })}
                                className="w-16 h-7 px-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                              />
                              <input
                                type="text"
                                value={playerDraft.grade}
                                placeholder="Grade"
                                onChange={(e) => setPlayerDraft({ ...playerDraft, grade: e.target.value })}
                                className="w-16 h-7 px-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                              />
                            </div>
                          ) : (
                            [p.height, p.grade].filter(Boolean).join(' · ') || '—'
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {editing ? (
                            <input
                              type="text"
                              value={playerDraft.tags}
                              placeholder="Comma-separated tags"
                              onChange={(e) => setPlayerDraft({ ...playerDraft, tags: e.target.value })}
                              className="w-40 h-7 px-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                            />
                          ) : (
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
                          )}
                        </td>
                        {!readOnly && (
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            {editing ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveEditPlayer(p.id)}
                                  className="p-1.5 text-emerald-500 hover:text-emerald-400 cursor-pointer"
                                  title="Save player"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPlayerId(null);
                                    setPlayerDraft(null);
                                  }}
                                  className="p-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                  title="Cancel edit"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditPlayer(p)}
                                  className="p-1.5 text-zinc-400 hover:text-amber-500 cursor-pointer"
                                  title="Edit player"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeletePlayer(p.id)}
                                  className="p-1.5 text-zinc-400 hover:text-rose-500 cursor-pointer"
                                  title="Remove player"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: STAFF & FAMILY ACCESS */}
      {section === 'access' && (
        <div className="space-y-4">
          <div className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-amber-500/5 text-xs text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Basketball roles are completely separate from Football. Program owner{' '}
              <b className="text-zinc-900 dark:text-zinc-100">dannym1010@gmail.com</b> always has full Admin access across both sports and all teams.
            </span>
          </div>

          {!readOnly && (
            <form
              onSubmit={handleAddStaff}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 items-end">
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
                    placeholder="coach@example.com"
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
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Login Opens</label>
                  <select
                    value={newStaff.defaultSport}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, defaultSport: e.target.value as 'basketball' | 'football' })
                    }
                    className="w-full h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  >
                    <option value="basketball">Direct to Basketball</option>
                    <option value="football">Football Default</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="h-9 px-3 rounded-lg bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add User</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-zinc-500">Assigned Teams:</span>
                  {teams.map((t) => {
                    const selected = newStaff.teamIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? newStaff.teamIds.filter((id) => id !== t.id)
                            : [...newStaff.teamIds, t.id];
                          setNewStaff({ ...newStaff, teamIds: next });
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                          selected
                            ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-transparent'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                {(newStaff.role === 'Family' || newStaff.role === 'Player') && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-zinc-500">Linked Kid #:</span>
                    <input
                      type="text"
                      value={newStaff.linkedNum}
                      onChange={(e) => setNewStaff({ ...newStaff, linkedNum: e.target.value })}
                      placeholder="e.g. 5"
                      className="w-20 h-7 px-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                    />
                  </div>
                )}
              </div>
            </form>
          )}

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 divide-y divide-zinc-200 dark:divide-zinc-800">
            {staff.map((m) => {
              const isOwner = isProgramAdminEmail(m.email);
              const isPending = m.status === 'Pending';
              const directBball = m.defaultSport !== 'football';
              return (
                <div key={m.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{m.name}</span>
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Crown className="w-3 h-3" />
                          Owner · Full Access (Football &amp; Basketball)
                        </span>
                      ) : (
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
                      )}
                      {isPending && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-500/15 text-rose-500">
                          Pending
                        </span>
                      )}
                      {m.linkedPlayerNums.length > 0 && (
                        <span className="text-[11px] font-mono text-amber-500">
                          Kid #{m.linkedPlayerNums.join(', #')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">{m.email}</div>
                  </div>

                  {!readOnly && !isOwner && (
                    <div className="flex flex-wrap items-center gap-2">
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => onUpdateStaff(m.id, { status: 'Active' })}
                          className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-600 text-white cursor-pointer"
                        >
                          Approve
                        </button>
                      )}

                      <select
                        value={m.role}
                        onChange={(e) => {
                          const nextRole = e.target.value as BasketballStaffMember['role'];
                          const isLim = nextRole === 'Family' || nextRole === 'Player';
                          onUpdateStaff(m.id, {
                            role: nextRole,
                            allowedTabs: isLim ? m.allowedTabs || ['schedule', 'highlights'] : undefined,
                            highlightAccess: isLim ? m.highlightAccess || 'kid' : undefined,
                          });
                        }}
                        className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Coach">Coach</option>
                        <option value="Player">Player</option>
                        <option value="Family">Family</option>
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateStaff(m.id, {
                            defaultSport: directBball ? 'football' : 'basketball',
                          })
                        }
                        title="Choose which app opens automatically when this user signs in"
                        className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                          directBball
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {directBball ? 'Direct to Basketball' : 'Football Default'}
                      </button>

                      {/* Per-team assignment toggles */}
                      <div className="flex flex-wrap items-center gap-1">
                        {teams.map((t) => {
                          const assigned = (m.teamIds || []).includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                const curr = m.teamIds || [];
                                const next = assigned
                                  ? curr.filter((id) => id !== t.id)
                                  : [...curr, t.id];
                                onUpdateStaff(m.id, { teamIds: next });
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-semibold border cursor-pointer ${
                                assigned
                                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                              }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>

                      {(m.role === 'Player' || m.role === 'Family') && (
                        <div className="flex flex-wrap items-center gap-1">
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
                                    ? 'bg-sky-600 text-white border-transparent'
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                                }`}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                          <select
                            value={m.highlightAccess || 'kid'}
                            onChange={(e) =>
                              onUpdateStaff(m.id, {
                                highlightAccess: e.target.value as BasketballStaffMember['highlightAccess'],
                              })
                            }
                            aria-label="Highlight access level"
                            className="h-7 px-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-[10px]"
                          >
                            <option value="kid">Own Kid Reels</option>
                            <option value="all">All Team Reels</option>
                            <option value="helper">Highlights Helper</option>
                          </select>
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
              );
            })}
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
                className="h-9 px-4 rounded-lg bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
              >
                Create Team
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teams.map((t) => {
              const active = t.id === activeTeamId;
              const editing = editingTeamId === t.id;
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border p-4 transition-all ${
                    active
                      ? 'border-amber-500 bg-amber-500/5'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60'
                  }`}
                >
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={teamDraft.name}
                        onChange={(e) => setTeamDraft({ ...teamDraft, name: e.target.value })}
                        placeholder="Team Name"
                        className="w-full h-8 px-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        value={teamDraft.season}
                        onChange={(e) => setTeamDraft({ ...teamDraft, season: e.target.value })}
                        placeholder="Season"
                        className="w-full h-8 px-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs"
                      />
                      <input
                        type="text"
                        value={teamDraft.calendarUrl}
                        onChange={(e) => setTeamDraft({ ...teamDraft, calendarUrl: e.target.value })}
                        placeholder="TeamSnap iCal Feed URL (optional)"
                        className="w-full h-8 px-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-[11px]"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (teamDraft.name.trim()) {
                              onUpdateTeam(t.id, {
                                name: teamDraft.name.trim(),
                                season: teamDraft.season.trim() || t.season,
                                calendarUrl: teamDraft.calendarUrl.trim() || undefined,
                              });
                            }
                            setEditingTeamId(null);
                          }}
                          className="px-3 py-1 rounded bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTeamId(null)}
                          className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectTeam(t.id)}
                        className="flex-1 text-left cursor-pointer min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50 truncate">
                            {t.name}
                          </span>
                          {active && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500 text-zinc-950">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">{t.season}</div>
                        {t.calendarUrl && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                            TeamSnap iCal Linked
                          </div>
                        )}
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeamId(t.id);
                            setTeamDraft({
                              name: t.name,
                              season: t.season,
                              calendarUrl: t.calendarUrl || '',
                            });
                          }}
                          title="Edit team & TeamSnap iCal URL"
                          className="p-1.5 text-zinc-400 hover:text-amber-500 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TeamSnap Roster Import Modal */}
      {showRosterImport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                  <Download className="w-4 h-4 text-amber-500" />
                  <span>Import TeamSnap Roster — {activeTeam?.name}</span>
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Export your TeamSnap roster CSV (<b>Roster → Export</b>), copy-paste rows directly from TeamSnap, or sync via TeamSnap API.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRosterImport(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              {(
                [
                  { id: 'paste', label: 'Paste from TeamSnap / Sheets' },
                  { id: 'csv', label: 'Upload TeamSnap CSV' },
                  { id: 'api', label: 'TeamSnap API Token' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setRosterTab(t.id);
                    setTsError('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    rosterTab === t.id
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {rosterTab === 'paste' && (
              <textarea
                rows={5}
                value={rosterText}
                onChange={(e) => handleRosterTextChange(e.target.value)}
                placeholder={'Paste CSV or rows from TeamSnap Roster page, e.g.:\nJersey #, First Name, Last Name, Position\n23, Carter, Hayes, SG\n5, Cole, Brennan, PG'}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono"
              />
            )}

            {rosterTab === 'csv' && (
              <div>
                <input
                  ref={rosterFileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleRosterFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => rosterFileRef.current?.click()}
                  className="w-full py-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-amber-500 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-5 h-5 text-amber-500" />
                  <span>Click to choose your TeamSnap Roster .csv file</span>
                </button>
              </div>
            )}

            {rosterTab === 'api' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                      TeamSnap Team ID
                    </label>
                    <input
                      type="text"
                      value={tsTeamId}
                      onChange={(e) => setTsTeamId(e.target.value)}
                      placeholder="e.g. 12345678"
                      className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                      Personal Access Token
                    </label>
                    <input
                      type="password"
                      value={tsToken}
                      onChange={(e) => setTsToken(e.target.value)}
                      placeholder="TeamSnap OAuth token"
                      className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={tsBusy}
                  onClick={() => void handleFetchTeamSnapApiRoster()}
                  className="h-9 px-4 rounded-lg bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {tsBusy ? 'Fetching Members...' : 'Load TeamSnap Roster'}
                </button>
              </div>
            )}

            {tsError && (
              <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {tsError}
              </div>
            )}

            {rosterSkipped.length > 0 && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400">
                Skipped non-players: {rosterSkipped.slice(0, 5).join(', ')}
                {rosterSkipped.length > 5 ? ` (+${rosterSkipped.length - 5} more)` : ''}
              </div>
            )}

            {rosterPreview.length > 0 && (
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Ready to import {rosterPreview.length} players
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-[11px]">Mode:</span>
                    {(['replace', 'append'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRosterMode(m)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                          rosterMode === m
                            ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-transparent'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {m === 'replace' ? 'Replace Current Roster' : 'Add to Roster'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto max-h-48 rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                  {rosterPreview.map((p, idx) => (
                    <div key={idx} className="px-3 py-1.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-amber-500 mr-2">#{p.num}</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {p.firstName} {p.lastName}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500">{p.position}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowRosterImport(false)}
                className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rosterPreview.length === 0}
                onClick={() => {
                  onImportRoster(rosterPreview, rosterMode);
                  setShowRosterImport(false);
                }}
                className="h-9 px-4 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                Import {rosterPreview.length || ''} Players
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
