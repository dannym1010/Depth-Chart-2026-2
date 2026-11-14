import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Edit3,
  Film,
  MapPin,
  Plus,
  Printer,
  Search,
  Shield,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import type { BasketballGame } from '../types';

interface BasketballScheduleViewProps {
  teamName: string;
  season: string;
  games: BasketballGame[];
  activeGameId: string;
  readOnly?: boolean;
  onSelectGame: (gameId: string) => void;
  onOpenFilmRoom: (gameId: string) => void;
  onOpenScout: (gameId: string) => void;
  onAddGame: (game: Omit<BasketballGame, 'id' | 'possessions'>) => void;
  onUpdateGame: (gameId: string, updates: Partial<BasketballGame>) => void;
  onDeleteGame: (gameId: string) => void;
}

type EventFilter = 'ALL' | 'Game' | 'Practice' | 'Tournament' | 'Scrimmage';

export const BasketballScheduleView: React.FC<BasketballScheduleViewProps> = ({
  teamName,
  season,
  games,
  activeGameId,
  readOnly = false,
  onSelectGame,
  onOpenFilmRoom,
  onOpenScout,
  onAddGame,
  onUpdateGame,
  onDeleteGame,
}) => {
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    weekLabel: '',
    date: new Date().toISOString().slice(0, 10),
    time: '18:00',
    opponent: '',
    location: '',
    homeAway: 'Home' as 'Home' | 'Away' | 'Neutral',
    eventType: 'Game' as BasketballGame['eventType'],
    ourScore: '',
    opponentScore: '',
  });

  const summary = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let ptsFor = 0;
    let ptsAgainst = 0;
    let scoredCount = 0;
    for (const g of games) {
      if (g.eventType === 'Game' && typeof g.ourScore === 'number' && typeof g.opponentScore === 'number') {
        scoredCount++;
        ptsFor += g.ourScore;
        ptsAgainst += g.opponentScore;
        if (g.ourScore > g.opponentScore) wins++;
        else if (g.ourScore < g.opponentScore) losses++;
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...games]
      .filter((g) => g.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    return {
      wins,
      losses,
      ppg: scoredCount ? (ptsFor / scoredCount).toFixed(1) : '—',
      oppg: scoredCount ? (ptsAgainst / scoredCount).toFixed(1) : '—',
      upcoming,
    };
  }, [games]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...games]
      .filter((g) => filter === 'ALL' || g.eventType === filter)
      .filter(
        (g) =>
          !q ||
          g.opponent.toLowerCase().includes(q) ||
          g.location.toLowerCase().includes(q) ||
          g.weekLabel.toLowerCase().includes(q)
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [games, filter, query]);

  const openNewModal = () => {
    const gameNum = games.filter((g) => g.eventType === 'Game').length + 1;
    setEditingId(null);
    setForm({
      weekLabel: `Game ${gameNum}`,
      date: new Date().toISOString().slice(0, 10),
      time: '18:00',
      opponent: '',
      location: 'Mahopac High School Main Gym',
      homeAway: 'Home',
      eventType: 'Game',
      ourScore: '',
      opponentScore: '',
    });
    setShowAdd(true);
  };

  const openEditModal = (g: BasketballGame) => {
    setEditingId(g.id);
    setForm({
      weekLabel: g.weekLabel,
      date: g.date,
      time: g.time,
      opponent: g.opponent,
      location: g.location,
      homeAway: g.homeAway,
      eventType: g.eventType,
      ourScore: g.ourScore !== undefined ? String(g.ourScore) : '',
      opponentScore: g.opponentScore !== undefined ? String(g.opponentScore) : '',
    });
    setShowAdd(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.opponent.trim()) return;
    const payload: Omit<BasketballGame, 'id' | 'possessions'> = {
      weekLabel: form.weekLabel.trim() || form.eventType,
      date: form.date,
      time: form.time,
      opponent: form.opponent.trim(),
      location: form.location.trim() || 'TBD Gym',
      homeAway: form.homeAway,
      eventType: form.eventType,
      ourScore: form.ourScore !== '' ? Number(form.ourScore) : undefined,
      opponentScore: form.opponentScore !== '' ? Number(form.opponentScore) : undefined,
    };
    if (editingId) {
      onUpdateGame(editingId, payload);
    } else {
      onAddGame(payload);
    }
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            {season} · Season Calendar
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-0.5">
            {teamName} Schedule
          </h1>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={openNewModal}
              className="h-9 px-3.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Event</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Season Record</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {summary.wins}–{summary.losses}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Points / Game</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {summary.ppg}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Opp PPG</span>
          <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {summary.oppg}
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Next Event</span>
          {summary.upcoming ? (
            <div className="mt-1">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                {summary.upcoming.opponent}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {summary.upcoming.date} · {summary.upcoming.time}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-zinc-500">No upcoming events</div>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 p-0.5">
          {(['ALL', 'Game', 'Practice', 'Tournament', 'Scrimmage'] as const).map((tab) => {
            const active = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {tab === 'ALL' ? 'All Events' : `${tab}s`}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search opponent or gym..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Event List */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 divide-y divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            No scheduled events match this filter.
          </div>
        ) : (
          filtered.map((g) => {
            const isSelected = g.id === activeGameId;
            const hasScore = typeof g.ourScore === 'number' && typeof g.opponentScore === 'number';
            const won = hasScore && (g.ourScore as number) > (g.opponentScore as number);
            const dateObj = new Date(`${g.date}T12:00:00`);
            const monthLabel = Number.isNaN(dateObj.getTime())
              ? ''
              : dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
            const dayNum = Number.isNaN(dateObj.getTime()) ? g.date : String(dateObj.getDate());

            return (
              <div
                key={g.id}
                onClick={() => onSelectGame(g.id)}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/5 border-l-2 border-l-amber-500'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold tracking-wider text-zinc-500">{monthLabel}</span>
                    <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50 leading-none">
                      {dayNum}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {g.weekLabel}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                          g.eventType === 'Game'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : g.eventType === 'Tournament'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {g.eventType}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{g.homeAway}</span>
                    </div>

                    <div className="mt-1 font-semibold text-base text-zinc-900 dark:text-zinc-50 truncate">
                      {g.eventType === 'Game' ? `${g.homeAway === 'Away' ? '@ ' : 'vs '}${g.opponent}` : g.opponent}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5" /> {g.time}
                      </span>
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5" /> {g.location}
                      </span>
                      {g.possessions.length > 0 && (
                        <span className="text-zinc-600 dark:text-zinc-300 font-medium tabular-nums">
                          {g.possessions.length} tagged clips
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Score + Actions */}
                <div
                  className="flex flex-wrap items-center gap-2 sm:justify-end print:hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {hasScore && (
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold tabular-nums ${
                        won
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {won ? 'W' : 'L'} {g.ourScore}–{g.opponentScore}
                    </span>
                  )}

                  {g.eventType !== 'Practice' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenFilmRoom(g.id)}
                        className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-amber-500 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Film className="w-3.5 h-3.5 text-amber-500" />
                        <span>Film Room</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenScout(g.id)}
                        className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-amber-500 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Scout</span>
                      </button>
                    </>
                  )}

                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(g)}
                        title="Edit event"
                        className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center justify-center cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteGame(g.id)}
                        title="Delete event"
                        className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-rose-500 inline-flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowAdd(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                {editingId ? 'Edit Schedule Event' : 'Add Basketball Event'}
              </h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Type</label>
                <select
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value as BasketballGame['eventType'] })}
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                >
                  <option value="Game">Game</option>
                  <option value="Practice">Practice</option>
                  <option value="Tournament">Tournament</option>
                  <option value="Scrimmage">Scrimmage</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Label</label>
                <input
                  type="text"
                  value={form.weekLabel}
                  onChange={(e) => setForm({ ...form, weekLabel: e.target.value })}
                  placeholder="Game 4"
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">Opponent / Event Title</label>
              <input
                type="text"
                required
                value={form.opponent}
                onChange={(e) => setForm({ ...form, opponent: e.target.value })}
                placeholder="e.g. Putnam Valley Tigers"
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Tip-off Time</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="w-full h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Site</label>
                <select
                  value={form.homeAway}
                  onChange={(e) => setForm({ ...form, homeAway: e.target.value as 'Home' | 'Away' | 'Neutral' })}
                  className="w-full h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                >
                  <option value="Home">Home</option>
                  <option value="Away">Away</option>
                  <option value="Neutral">Neutral</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">Gym / Court Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Mahopac Middle School Gym"
                className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
              />
            </div>

            {form.eventType !== 'Practice' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Our Score (optional)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.ourScore}
                    onChange={(e) => setForm({ ...form, ourScore: e.target.value })}
                    placeholder="—"
                    className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">Opponent Score</label>
                  <input
                    type="number"
                    min={0}
                    value={form.opponentScore}
                    onChange={(e) => setForm({ ...form, opponentScore: e.target.value })}
                    placeholder="—"
                    className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="h-9 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingId ? 'Save Changes' : 'Create Event'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
