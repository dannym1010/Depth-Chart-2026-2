import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  ShieldAlert,
  Users,
  Shield,
  Plus,
  Trash2,
  Edit3,
  Lock,
  Unlock,
  CheckCircle2,
  Award,
  Swords,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Sparkles,
  Calendar,
  MapPin,
  Flame,
  AlertCircle,
  Copy,
  Check,
  Zap,
  RefreshCw,
  Clock,
  FileCode,
  TrendingUp,
} from 'lucide-react';
import {
  ScoutingData,
  CoachScoutingNote,
  OpponentKeyPlayer,
  StaffCoach,
  UserRole,
  ScheduleEvent,
} from '../types';
import { triggerPrint } from '../utils/printUtils';

interface ScoutingViewProps {
  scouting: ScoutingData;
  userRole: UserRole;
  currentUser?: any;
  staffList?: StaffCoach[];
  savedCoaches?: string[];
  scheduleEvents?: ScheduleEvent[];
  currentWeek?: string;
  onUpdateScouting: (field: keyof ScoutingData, val: any) => void;
  onNavigateToSchedule?: () => void;
  onNavigateToTendencies?: () => void;
  onNavigateToHtmlTendencies?: () => void;
}

const NOTE_CATEGORIES = [
  { id: 'Defense & Fronts', label: '🛡️ Defense & Fronts', color: 'text-indigo-400' },
  { id: 'Offense & Plays', label: '⚡ Offense & Plays', color: 'text-amber-400' },
  { id: 'O-Line & Blocking', label: '🏈 O-Line & Blocking', color: 'text-orange-400' },
  { id: 'Special Teams', label: '👟 Special Teams', color: 'text-emerald-400' },
  { id: 'QB Reads & Keys', label: '🎯 QB Reads & Keys', color: 'text-sky-400' },
  { id: 'Key Matchups', label: '⚔️ Key Matchups', color: 'text-rose-400' },
  { id: 'Sideline Adjustments', label: '📋 Sideline Adjustments', color: 'text-purple-400' },
  { id: 'General Notes', label: '📝 General Notes', color: 'text-slate-300' },
];

export const ScoutingView: React.FC<ScoutingViewProps> = ({
  scouting,
  userRole,
  currentUser,
  staffList = [],
  savedCoaches = [],
  scheduleEvents = [],
  currentWeek = '1',
  onUpdateScouting,
  onNavigateToSchedule,
  onNavigateToTendencies,
  onNavigateToHtmlTendencies,
}) => {
  // Current user email & power admin check
  const currentEmail = (currentUser?.email || '').toLowerCase().trim();
  const isPowerAdmin =
    userRole === 'admin' ||
    currentEmail.includes('admin') ||
    currentEmail.includes('dannym1010') ||
    !userRole ||
    userRole === ('coach' as any) ||
    staffList.some((s) => s.email.toLowerCase() === currentEmail && s.role.toLowerCase().includes('coach'));

  // Filter state for coach notes
  const [selectedCoachFilter, setSelectedCoachFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  // New Note Modal / Form State
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteCategory, setNewNoteCategory] = useState('Defense & Fronts');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteAuthor, setNewNoteAuthor] = useState(currentUser?.email || 'Coach');

  // New Key Player Form State
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [playerJersey, setPlayerJersey] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerPos, setPlayerPos] = useState('');
  const [playerThreat, setPlayerThreat] = useState<'High' | 'Medium' | 'Low'>('High');
  const [playerNotes, setPlayerNotes] = useState('');

  // Find matching game or scrimmage in schedule for current week
  const matchedScheduledGame = React.useMemo(() => {
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

  // All scheduled games in season for quick import
  const allScheduledGames = React.useMemo(() => {
    return scheduleEvents.filter((ev) => ev.type === 'game' || ev.type === 'scrimmage');
  }, [scheduleEvents]);

  // Auto-sync function from a schedule event into the scouting report
  const handleSyncFromScheduleEvent = (game: ScheduleEvent) => {
    const oppName = game.opponent || game.title || '';
    if (oppName) onUpdateScouting('opponent', oppName);

    const dateStr = `${game.date || ''} ${game.time ? '@ ' + game.time : ''}`.trim();
    if (dateStr) onUpdateScouting('gameDate', dateStr);

    if (game.location) onUpdateScouting('gameLocation', game.location);
    if (game.week) onUpdateScouting('week', game.week.startsWith('Week') ? game.week : `Week ${game.week}`);

    if (game.focusOrNotes && !scouting.overviewNotes) {
      onUpdateScouting('overviewNotes', game.focusOrNotes);
    }
  };

  // Safe defaults
  const coachNotes: CoachScoutingNote[] = scouting.coachNotes || [];
  const keyPlayers: OpponentKeyPlayer[] = scouting.keyPlayers || [];
  const keysToVictory: string[] = scouting.keysToVictory || [
    'Dominate the line of scrimmage on both sides of the ball',
    'Execute base trap and sweep blocking without penalties',
    'Stay disciplined against cutback lanes and misdirection',
  ];

  // Filter notes by coach or category
  const filteredNotes = coachNotes.filter((n) => {
    if (selectedCoachFilter === 'all') return true;
    return n.author === selectedCoachFilter || n.category === selectedCoachFilter;
  });

  const handleAddCoachNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    const newNote: CoachScoutingNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      author: newNoteAuthor.trim() || currentUser?.email || 'Coach',
      authorRole: isPowerAdmin ? 'Head Coach' : 'Assistant Coach',
      category: newNoteCategory,
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      timestamp: Date.now(),
    };

    onUpdateScouting('coachNotes', [newNote, ...coachNotes]);
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsAddingNote(false);
  };

  const handleDeleteCoachNote = (noteId: string) => {
    if (confirm('Delete this coaching observation?')) {
      onUpdateScouting(
        'coachNotes',
        coachNotes.filter((n) => n.id !== noteId)
      );
    }
  };

  const handleAddKeyPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerJersey.trim() && !playerName.trim()) return;

    const newKeyPlayer: OpponentKeyPlayer = {
      id: `kp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      jersey: playerJersey.trim().replace(/\D/g, ''),
      name: playerName.trim(),
      position: playerPos.trim().toUpperCase() || 'ATH',
      threatLevel: playerThreat,
      notes: playerNotes.trim(),
    };

    onUpdateScouting('keyPlayers', [...keyPlayers, newKeyPlayer]);
    setPlayerJersey('');
    setPlayerName('');
    setPlayerPos('');
    setPlayerNotes('');
    setIsAddingPlayer(false);
  };

  const handleDeleteKeyPlayer = (id: string) => {
    onUpdateScouting(
      'keyPlayers',
      keyPlayers.filter((p) => p.id !== id)
    );
  };

  const handleAddKeyToVictory = (customText?: string | React.MouseEvent) => {
    const text = typeof customText === 'string' ? customText : prompt('Enter new Key to Victory:');
    if (text && text.trim()) {
      onUpdateScouting('keysToVictory', [...keysToVictory, text.trim()]);
    }
  };

  const handleRemoveKeyToVictory = (idx: number) => {
    onUpdateScouting(
      'keysToVictory',
      keysToVictory.filter((_, i) => i !== idx)
    );
  };

  const handlePrint = () => {
    triggerPrint();
  };

  const handleCopySummary = () => {
    const opp = scouting.opponent || 'Upcoming Opponent';
    let text = `🏈 SCOUTING REPORT: ${opp} (${scouting.week || 'Week 1'})\n` +
      `📅 Game: ${scouting.gameDate || 'TBD'} @ ${scouting.gameLocation || 'TBD'}\n\n` +
      `🎯 KEYS TO VICTORY:\n` +
      keysToVictory.map((k, i) => `${i + 1}. ${k}`).join('\n') +
      `\n\n🛡️ OPPONENT DEFENSE:\nBase Front: ${scouting.defenseFront || 'N/A'} | Coverage: ${scouting.defenseCoverage || 'N/A'}\nNotes: ${scouting.defenseTendencies || 'N/A'}\n\n` +
      `⚡ OPPONENT OFFENSE:\nBase Formation: ${scouting.offenseFormations || 'N/A'}\nRun/Pass Ratio: ${scouting.runPassRatio || 'N/A'}\nNotes: ${scouting.offenseTendencies || 'N/A'}\n\n` +
      `⭐ KEY PLAYERS TO WATCH:\n` +
      keyPlayers.map((p) => `#${p.jersey} ${p.name} (${p.position}) - [${p.threatLevel} Threat] ${p.notes}`).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner Toolbar */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 md:p-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 border border-indigo-500/30 flex items-center justify-center text-indigo-200 shadow-lg shadow-indigo-600/30">
              <Swords className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-slate-100 tracking-tight">
                  Opponent Scouting Hub &amp; Game Prep
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase">
                  {scouting.opponent || 'Upcoming Matchup'}
                </span>
                {matchedScheduledGame && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Auto-Synced with Schedule</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Opponent tendencies, key personnel breakdown, and game plan priorities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(onNavigateToTendencies || onNavigateToHtmlTendencies) && (
              <button
                type="button"
                onClick={onNavigateToTendencies || onNavigateToHtmlTendencies}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-amber-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Go to Opponent Tendencies & Film Study"
              >
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Tendencies</span>
              </button>
            )}

            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Copy formatted text scouting briefing for coaching staff"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
              <span>{copied ? 'Copied Briefing!' : 'Copy Summary'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Scouting Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Auto-Sync Banner */}
      {matchedScheduledGame && (
        <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 rounded-3xl border border-indigo-500/40 p-4 md:p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-slate-100">
                  Scheduled Game for {currentWeek.startsWith('Week') ? currentWeek : `Week ${currentWeek}`}:
                </span>
                <span className="font-black text-amber-300 text-sm">
                  {matchedScheduledGame.opponent || matchedScheduledGame.title}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold">
                  {matchedScheduledGame.date || 'Date TBD'} {matchedScheduledGame.time ? `@ ${matchedScheduledGame.time}` : ''}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {matchedScheduledGame.location ? `📍 ${matchedScheduledGame.location}` : 'Home / Away'}
                {matchedScheduledGame.focusOrNotes ? ` • Note: ${matchedScheduledGame.focusOrNotes}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => handleSyncFromScheduleEvent(matchedScheduledGame)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
              title="Populate Opponent header, date, location and notes from this scheduled event"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ Auto-Populate from Schedule</span>
            </button>
            {onNavigateToSchedule && (
              <button
                onClick={onNavigateToSchedule}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                View Schedule
              </button>
            )}
          </div>
        </div>
      )}

      {/* Opponent Metadata Row with Schedule Selector */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 md:p-6 print:hidden">
        <div className="flex items-center justify-between mb-3 border-b border-slate-700/60 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Game Information &amp; Opponent Header</span>
          </div>

          {/* Quick Scheduled Game Picker */}
          {allScheduledGames.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[10px] font-black uppercase text-indigo-300 font-mono hidden sm:inline">
                Import Scheduled Game:
              </span>
              <select
                onChange={(e) => {
                  const ev = allScheduledGames.find((g) => g.id === e.target.value);
                  if (ev) handleSyncFromScheduleEvent(ev);
                }}
                defaultValue=""
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="" disabled>
                  ⚡ Select Game from Season Schedule...
                </option>
                {allScheduledGames.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.week ? `${game.week}: ` : ''}
                    {game.opponent || game.title} ({game.date || 'TBD'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Season Year
            </label>
            <input
              type="text"
              value={scouting.year || '2026'}
              disabled={!isPowerAdmin}
              onChange={(e) => onUpdateScouting('year', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 focus:outline-none focus:border-amber-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Game Week
            </label>
            <input
              type="text"
              value={scouting.week || (currentWeek.startsWith('Week') ? currentWeek : `Week ${currentWeek}`)}
              disabled={!isPowerAdmin}
              onChange={(e) => onUpdateScouting('week', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 focus:outline-none focus:border-amber-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Opponent Program
            </label>
            <input
              type="text"
              value={scouting.opponent || ''}
              disabled={!isPowerAdmin}
              onChange={(e) => onUpdateScouting('opponent', e.target.value)}
              placeholder="e.g. Carmel Rams"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Date &amp; Kickoff Time
            </label>
            <input
              type="text"
              value={scouting.gameDate || ''}
              disabled={!isPowerAdmin}
              onChange={(e) => onUpdateScouting('gameDate', e.target.value)}
              placeholder="e.g. Sun, Oct 4 @ 10:00 AM"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Location / Venue
            </label>
            <input
              type="text"
              value={scouting.gameLocation || ''}
              disabled={!isPowerAdmin}
              onChange={(e) => onUpdateScouting('gameLocation', e.target.value)}
              placeholder="Home @ Mahopac HS / Away"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Keys to Victory & Must-Win Priorities */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 md:p-6 print:hidden space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="font-black text-sm text-slate-100">
              Keys to Victory &amp; Critical Game Goals
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {keysToVictory.length} Goals Defined
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {keysToVictory.map((keyGoal, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 flex items-start justify-between gap-2 shadow-xs group"
            >
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-xs font-bold text-slate-200 leading-snug">{keyGoal}</p>
              </div>
              {isPowerAdmin && (
                <button
                  onClick={() => handleRemoveKeyToVictory(idx)}
                  className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Remove goal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {isPowerAdmin && (
            <button
              onClick={handleAddKeyToVictory}
              className="border-2 border-dashed border-slate-700 hover:border-amber-400/60 rounded-2xl p-3 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-300 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Key to Victory</span>
            </button>
          )}
        </div>
      </div>

      {/* Two Column Grid: Opponent Defense & Opponent Offense */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Opponent Defense Breakdown */}
          <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 md:p-6 print:hidden space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-100">Opponent Defensive Scheme</h3>
                  <p className="text-[11px] text-slate-400">Fronts, blitzes, coverage shells, and weak spots</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Base Defensive Front
                </label>
                <input
                  type="text"
                  value={scouting.defenseFront || ''}
                  disabled={!isPowerAdmin}
                  onChange={(e) => onUpdateScouting('defenseFront', e.target.value)}
                  placeholder="e.g. 4-4 Stack, 5-3, 5-2"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Primary Secondary Coverage
                </label>
                <input
                  type="text"
                  value={scouting.defenseCoverage || ''}
                  disabled={!isPowerAdmin}
                  onChange={(e) => onUpdateScouting('defenseCoverage', e.target.value)}
                  placeholder="e.g. Cover 3, Cover 1 Man, Cover 2"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Defensive Tendencies &amp; Attack Angles
              </label>
              <textarea
                rows={3}
                value={scouting.defenseTendencies || ''}
                disabled={!isPowerAdmin}
                onChange={(e) => onUpdateScouting('defenseTendencies', e.target.value)}
                placeholder="e.g. DL pinches inside on down-and-short; Corners give 7-yard cushion on 3rd down; Weak-side DE over-pursues on sweeps..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Offensive Game Plan Strategy vs. This Defense
              </label>
              <textarea
                rows={3}
                value={scouting.gameplanOffense || ''}
                disabled={!isPowerAdmin}
                onChange={(e) => onUpdateScouting('gameplanOffense', e.target.value)}
                placeholder="e.g. Run off-tackle power to test edge discipline; Use quick slant RPOs against soft corner coverage..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-emerald-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Opponent Offense Breakdown */}
          <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 md:p-6 print:hidden space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-100">Opponent Offensive Scheme</h3>
                  <p className="text-[11px] text-slate-400">Formations, primary ball carriers, and favorite concepts</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Base Formations
                </label>
                <input
                  type="text"
                  value={scouting.offenseFormations || ''}
                  disabled={!isPowerAdmin}
                  onChange={(e) => onUpdateScouting('offenseFormations', e.target.value)}
                  placeholder="e.g. Wing-T, Singleback, Pistol"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Run / Pass Ratio
                </label>
                <input
                  type="text"
                  value={scouting.runPassRatio || ''}
                  disabled={!isPowerAdmin}
                  onChange={(e) => onUpdateScouting('runPassRatio', e.target.value)}
                  placeholder="e.g. 75% Run / 25% Pass"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Offensive Tendencies &amp; Tell Keys
              </label>
              <textarea
                rows={3}
                value={scouting.offenseTendencies || ''}
                disabled={!isPowerAdmin}
                onChange={(e) => onUpdateScouting('offenseTendencies', e.target.value)}
                placeholder="e.g. #22 carries on 80% of inside runs; QB looks only to right side on sprint-outs; Backfield depth tips pass vs run..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Defensive Game Plan Strategy vs. This Offense
              </label>
              <textarea
                rows={3}
                value={scouting.gameplanDefense || ''}
                disabled={!isPowerAdmin}
                onChange={(e) => onUpdateScouting('gameplanDefense', e.target.value)}
                placeholder="e.g. Set hard edge on outside stretch; Safety key on tight end release; LB flow with guard pull..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-indigo-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

      {/* Key Players to Watch Section */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 md:p-6 print:hidden space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="font-black text-sm text-slate-100">
                Key Opponent Players &amp; Impact Matchups
              </h3>
              <p className="text-[11px] text-slate-400">
                Identify game-changers, dangerous ball carriers, and primary pass rushers
              </p>
            </div>
          </div>

          {isPowerAdmin && (
            <button
              onClick={() => setIsAddingPlayer(!isAddingPlayer)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Player</span>
            </button>
          )}
        </div>

        {/* Add Player Form */}
        {isAddingPlayer && (
          <form onSubmit={handleAddKeyPlayer} className="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
            <h4 className="font-black text-xs text-rose-300">Add Opponent Player to Watch</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Jersey #
                </label>
                <input
                  type="text"
                  value={playerJersey}
                  onChange={(e) => setPlayerJersey(e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Name / Identifier
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="e.g. RB / Returner"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Position
                </label>
                <input
                  type="text"
                  value={playerPos}
                  onChange={(e) => setPlayerPos(e.target.value)}
                  placeholder="e.g. RB / DE"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Threat Level
                </label>
                <select
                  value={playerThreat}
                  onChange={(e) => setPlayerThreat(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  <option value="High">🔥 High Threat</option>
                  <option value="Medium">⚡ Medium Threat</option>
                  <option value="Low">🛡️ Low / Rotational</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Scouting Notes &amp; Tendencies
              </label>
              <input
                type="text"
                value={playerNotes}
                onChange={(e) => setPlayerNotes(e.target.value)}
                placeholder="e.g. Elite speed on outside sweeps; jumps snap counts on pass downs..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingPlayer(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Save Player
              </button>
            </div>
          </form>
        )}

        {/* Players List Table */}
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Name / Role</th>
                <th className="py-2.5 px-3">Pos</th>
                <th className="py-2.5 px-3">Threat</th>
                <th className="py-2.5 px-3">Scouting Notes</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {keyPlayers.map((player) => (
                <tr key={player.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-black text-rose-400">
                    #{player.jersey || '—'}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-100">
                    {player.name || 'Opponent Player'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold border border-slate-700 text-[10px]">
                      {player.position}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                        player.threatLevel === 'High'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : player.threatLevel === 'Medium'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {player.threatLevel}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {player.notes || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {isPowerAdmin && (
                      <button
                        onClick={() => handleDeleteKeyPlayer(player.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {keyPlayers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 text-xs italic">
                    No opponent players logged yet. Click "Add Player" to highlight key threats.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Collaboration & Coaching Notes */}
      <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-xl p-5 md:p-6 print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-black text-sm text-slate-100">
                Staff Observations &amp; Position Coach Notes
              </h3>
              <p className="text-[11px] text-slate-400">
                Real-time multi-coach film study notes and sideline adjustments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCoachFilter}
              onChange={(e) => setSelectedCoachFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Categories &amp; Coaches</option>
              {NOTE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsAddingNote(!isAddingNote)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Note</span>
            </button>
          </div>
        </div>

        {/* Add Note Form */}
        {isAddingNote && (
          <form onSubmit={handleAddCoachNote} className="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
            <h4 className="font-black text-xs text-indigo-300">New Staff Film Observation</h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={newNoteCategory}
                  onChange={(e) => setNewNoteCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {NOTE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Coach Author
                </label>
                <input
                  type="text"
                  value={newNoteAuthor}
                  onChange={(e) => setNewNoteAuthor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Observation Title
                </label>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="e.g. Heavy A-Gap Pressure on 3rd & Long"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Detailed Coaching Observation &amp; Adjustment Plan
              </label>
              <textarea
                rows={3}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="What did you see on film? How should our unit adjust or exploit it?"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNote(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Save Observation
              </button>
            </div>
          </form>
        )}

        {/* Coach Notes Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            const catObj = NOTE_CATEGORIES.find((c) => c.id === note.category);
            return (
              <div
                key={note.id}
                className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-black text-[10px] uppercase border border-slate-700">
                      {note.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {note.timestamp ? new Date(note.timestamp).toLocaleDateString() : ''}
                      </span>
                      {(isPowerAdmin || note.author === (currentUser?.email || '')) && (
                        <button
                          onClick={() => handleDeleteCoachNote(note.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="font-black text-xs text-slate-100">{note.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-indigo-300">👤 {note.author}</span>
                  <span>{note.authorRole || 'Coaching Staff'}</span>
                </div>
              </div>
            );
          })}

          {filteredNotes.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-500 text-xs italic bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
              No coaching observations recorded for this filter. Click "Add Note" above to log film insights!
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY COMPLETE SCOUTING BRIEFING */}
      <div className="hidden print:block space-y-4 bg-white text-black p-6">
        <div className="border-b-2 border-black pb-3 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">
              GAME SCOUTING REPORT: {scouting.opponent || 'Upcoming Opponent'}
            </h1>
            <p className="text-xs font-bold text-gray-700">
              {scouting.week || 'Week 1'} • {scouting.gameDate || 'TBD'} • Venue: {scouting.gameLocation || 'TBD'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-black border border-black px-2 py-1">
              MAHOPAC FOOTBALL
            </span>
          </div>
        </div>

        {/* Keys to Victory */}
        <div className="border border-black p-3 mb-3">
          <h2 className="text-sm font-black uppercase mb-1">🎯 Keys to Victory:</h2>
          <ol className="list-decimal list-inside text-xs font-bold space-y-0.5">
            {keysToVictory.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ol>
        </div>

        {/* Schemes Breakdown */}
        <div className="grid grid-cols-2 gap-4 text-xs mb-3">
          <div className="border border-black p-3">
            <h3 className="font-black uppercase mb-1">🛡️ Opponent Defense:</h3>
            <p><strong>Base Front:</strong> {scouting.defenseFront || 'N/A'}</p>
            <p><strong>Secondary Coverage:</strong> {scouting.defenseCoverage || 'N/A'}</p>
            <p className="mt-1"><strong>Tendencies:</strong> {scouting.defenseTendencies || 'N/A'}</p>
            <p className="mt-1"><strong>Our Offensive Gameplan:</strong> {scouting.gameplanOffense || 'N/A'}</p>
          </div>

          <div className="border border-black p-3">
            <h3 className="font-black uppercase mb-1">⚡ Opponent Offense:</h3>
            <p><strong>Base Formations:</strong> {scouting.offenseFormations || 'N/A'}</p>
            <p><strong>Run/Pass:</strong> {scouting.runPassRatio || 'N/A'}</p>
            <p className="mt-1"><strong>Tendencies:</strong> {scouting.offenseTendencies || 'N/A'}</p>
            <p className="mt-1"><strong>Our Defensive Gameplan:</strong> {scouting.gameplanDefense || 'N/A'}</p>
          </div>
        </div>

        {/* Key Players */}
        {keyPlayers.length > 0 && (
          <div className="border border-black p-3 mb-3">
            <h3 className="text-sm font-black uppercase mb-1">⭐ Key Players to Watch:</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black font-black">
                  <th className="py-1">#</th>
                  <th className="py-1">Name</th>
                  <th className="py-1">Pos</th>
                  <th className="py-1">Threat</th>
                  <th className="py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {keyPlayers.map((p) => (
                  <tr key={p.id} className="border-b border-gray-300">
                    <td className="py-1 font-mono font-bold">#{p.jersey}</td>
                    <td className="py-1 font-bold">{p.name}</td>
                    <td className="py-1">{p.position}</td>
                    <td className="py-1 font-bold">{p.threatLevel}</td>
                    <td className="py-1">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Coach Observations */}
        {coachNotes.length > 0 && (
          <div className="border border-black p-3 mb-3">
            <h3 className="text-sm font-black uppercase mb-1">📋 Staff Film Observations:</h3>
            <div className="space-y-1.5 text-xs">
              {coachNotes.slice(0, 6).map((n) => (
                <div key={n.id} className="border-b border-gray-200 pb-1">
                  <span className="font-black">[{n.category}] {n.title}</span> — <span>{n.content}</span>
                  <span className="text-[10px] text-gray-600 ml-1">({n.author})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
