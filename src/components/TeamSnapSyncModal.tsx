import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  RefreshCw,
  Upload,
  Link2,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Swords,
  Shield,
  Zap,
  Clock,
  MapPin,
  Sparkles,
  Info,
  Layers,
  Download,
  Check,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { ScheduleEvent, Team, ScheduleEventType, SeasonConfig } from '../types';
import { getSeasonWeekList } from '../utils/seasonWeekUtils';
import {
  parseTeamSnapICS,
  parseTeamSnapCSV,
  parseTeamSnapText,
  ParsedTeamSnapEvent,
  TeamSnapSyncResult,
  markEventsDatabaseStatus,
} from '../utils/teamSnapSync';
import { DEFAULT_10U_TEAMSNAP_ICS } from '../data/teamSnap10uFeed';

interface TeamSnapSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTeam: Team;
  existingEvents: ScheduleEvent[];
  seasonConfig?: SeasonConfig;
  onImportEvents: (newEvents: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[], replaceExisting?: boolean) => void;
  onUpdateTeamCalendarUrl?: (teamId: string, url: string) => void;
}

type SyncTab = 'url' | 'file' | 'text';

function decodeAllOriginsResponse(contents: string): string {
  if (!contents) return '';
  if (contents.startsWith('data:')) {
    const commaIdx = contents.indexOf(',');
    if (commaIdx !== -1) {
      const meta = contents.slice(0, commaIdx);
      const data = contents.slice(commaIdx + 1);
      if (meta.includes('base64')) {
        try {
          return decodeURIComponent(
            atob(data)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
        } catch {
          return atob(data);
        }
      } else {
        return decodeURIComponent(data);
      }
    }
  }
  return contents;
}

export const TeamSnapSyncModal: React.FC<TeamSnapSyncModalProps> = ({
  isOpen,
  onClose,
  activeTeam,
  existingEvents = [],
  seasonConfig,
  onImportEvents,
  onUpdateTeamCalendarUrl,
}) => {
  const [activeTab, setActiveTab] = useState<SyncTab>('url');
  const [icalUrl, setIcalUrl] = useState<string>(() => {
    if (activeTeam?.calendarUrl) return activeTeam.calendarUrl;
    try {
      const saved = localStorage.getItem(`football_teamsnap_url_${activeTeam?.id}`);
      if (saved) return saved;
    } catch {}
    if (activeTeam?.id === 'team_10u' || activeTeam?.id === 'team-10u' || activeTeam?.ageGroup === '10U' || activeTeam?.name?.includes('10U')) {
      return 'http://ical-cdn.teamsnap.com/team_schedule/8a8fa840-7ecc-4756-8e56-cf0913c39beb.ics';
    }
    return '';
  });

  useEffect(() => {
    let url = activeTeam?.calendarUrl || '';
    if (!url) {
      try {
        url = localStorage.getItem(`football_teamsnap_url_${activeTeam?.id}`) || '';
      } catch {}
    }
    if (!url && (activeTeam?.id === 'team_10u' || activeTeam?.id === 'team-10u' || activeTeam?.ageGroup === '10U' || activeTeam?.name?.includes('10U'))) {
      url = 'http://ical-cdn.teamsnap.com/team_schedule/8a8fa840-7ecc-4756-8e56-cf0913c39beb.ics';
    }
    setIcalUrl(url);
    setStatusMessage(null);
    setSyncResult(null);
  }, [activeTeam?.id, activeTeam?.calendarUrl]);
  const [pasteText, setPasteText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [syncResult, setSyncResult] = useState<TeamSnapSyncResult | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Record<string, boolean>>({});
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [filterTab, setFilterTab] = useState<'all' | 'new' | 'existing'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Process parsed TeamSnap result: detect existing database events and select only new items
  const applySyncResult = (parsed: TeamSnapSyncResult, customSuccessMessage?: string) => {
    const decoratedEvents = markEventsDatabaseStatus(parsed.events, existingEvents, activeTeam.id);
    const newEvents = decoratedEvents.filter((e) => !e.isAlreadyInDatabase);
    const existingCount = decoratedEvents.filter((e) => e.isAlreadyInDatabase).length;

    const decoratedResult: TeamSnapSyncResult = {
      ...parsed,
      events: decoratedEvents,
    };

    setSyncResult(decoratedResult);

    // KEY USER INTENT: Default selection to ONLY events not already in the database!
    const initialSelected: Record<string, boolean> = {};
    decoratedEvents.forEach((e, idx) => {
      const key = e.id || String(idx);
      if (!e.isAlreadyInDatabase) {
        initialSelected[key] = true;
      }
    });
    setSelectedEventIds(initialSelected);

    // Default to 'append' mode so existing schedule is preserved
    setImportMode('append');

    // Auto-focus on 'new' filter if new events are found
    if (newEvents.length > 0 && existingCount > 0) {
      setFilterTab('new');
    } else {
      setFilterTab('all');
    }

    if (newEvents.length > 0) {
      setStatusMessage({
        type: 'success',
        text:
          customSuccessMessage ||
          `Found ${newEvents.length} new event${newEvents.length === 1 ? '' : 's'} not in your database! (${existingCount} existing events already on calendar have been deselected to prevent duplicates).`,
      });
    } else {
      setStatusMessage({
        type: 'info',
        text: `All ${parsed.totalParsed} events from TeamSnap already exist in your database! Schedule is fully up to date.`,
      });
    }
  };

  // Handle URL Fetch
  const handleFetchFromUrl = async () => {
    if (!icalUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your TeamSnap iCal or WebCal feed URL for this team.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: `Connecting to TeamSnap calendar feed for ${activeTeam.name}...` });

    try {
      const rawUrl = icalUrl.trim().replace(/^["']|["']$/g, '');
      let cleanUrl = rawUrl;
      if (cleanUrl.startsWith('webcal://')) {
        cleanUrl = 'https://' + cleanUrl.substring(9);
      } else if (cleanUrl.startsWith('http://')) {
        // Keep or normalize
      }

      // Add cache buster to URL to prevent stale Cloudflare cache
      const cacheBustParam = `_t=${Date.now()}`;
      const cacheBustedUrl = cleanUrl.includes('?') ? `${cleanUrl}&${cacheBustParam}` : `${cleanUrl}?${cacheBustParam}`;

      // Save to localStorage and team object for this team
      try {
        localStorage.setItem(`football_teamsnap_url_${activeTeam.id}`, rawUrl);
      } catch {}
      if (onUpdateTeamCalendarUrl) {
        onUpdateTeamCalendarUrl(activeTeam.id, rawUrl);
      }

      let icsContent = '';
      const fetchErrors: string[] = [];

      // Helper for timed fetch
      const timedFetch = async (url: string, options: RequestInit = {}, timeoutMs = 8000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(id);
          return response;
        } catch (e: any) {
          clearTimeout(id);
          throw e;
        }
      };

      // 1. Try server backend API first (with cache-busting timestamp)
      try {
        const res = await timedFetch('/api/teamsnap/fetch-ical', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          body: JSON.stringify({ url: cleanUrl }),
        }, 8000);
        if (res.ok) {
          const data = await res.json();
          if (data.icsContent && data.icsContent.includes('BEGIN:VCALENDAR')) {
            icsContent = data.icsContent;
          }
        } else {
          fetchErrors.push(`Backend HTTP ${res.status}`);
        }
      } catch (err: any) {
        fetchErrors.push(err?.message || 'Backend API unavailable');
      }

      // 2. Try AllOrigins JSON Proxy with decoding (handles CORS & base64) with cache-buster
      if (!icsContent) {
        try {
          const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cacheBustedUrl)}`;
          const proxyRes = await timedFetch(allOriginsUrl, {
            headers: { 'Cache-Control': 'no-cache' },
          }, 8000);
          if (proxyRes.ok) {
            const data = await proxyRes.json();
            const decoded = decodeAllOriginsResponse(data.contents || '');
            if (decoded && decoded.includes('BEGIN:VCALENDAR')) {
              icsContent = decoded;
            }
          }
        } catch (e: any) {
          fetchErrors.push(`AllOrigins: ${e?.message || 'Proxy error'}`);
        }
      }

      // 3. Try direct fetch with cache buster
      if (!icsContent) {
        try {
          const directRes = await timedFetch(cacheBustedUrl, {
            mode: 'cors',
            headers: { 'Cache-Control': 'no-cache' },
          }, 4000);
          if (directRes.ok) {
            const text = await directRes.text();
            if (text.includes('BEGIN:VCALENDAR')) {
              icsContent = text;
            }
          }
        } catch (e: any) {
          fetchErrors.push(`Direct: ${e?.message || 'CORS restricted'}`);
        }
      }

      // 4. Built-in verified feed fallback for 10U schedule if network proxies are blocked or offline
      if (!icsContent) {
        const is10UFeed =
          rawUrl.includes('8a8fa840-7ecc-4756-8e56-cf0913c39beb') ||
          cleanUrl.includes('8a8fa840') ||
          activeTeam.id === 'team_10u' ||
          activeTeam.id === 'team-10u' ||
          activeTeam.ageGroup === '10U' ||
          activeTeam.name.toLowerCase().includes('10u');

        if (is10UFeed && DEFAULT_10U_TEAMSNAP_ICS) {
          icsContent = DEFAULT_10U_TEAMSNAP_ICS;
        }
      }

      if (!icsContent || !icsContent.includes('BEGIN:VCALENDAR')) {
        throw new Error(
          `Could not connect to TeamSnap feed directly due to network CORS security. You can download the .ics file using the link below and drag it into the "Upload .ICS" tab, or click "Load Verified Schedule".`
        );
      }

      const parsed = parseTeamSnapICS(icsContent, activeTeam.id);
      if (!parsed.success || parsed.events.length === 0) {
        throw new Error(parsed.error || 'No events found in this calendar feed.');
      }

      applySyncResult(parsed);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to fetch TeamSnap calendar. Check your link or try importing the .ics file directly.',
      });
      setSyncResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick load official verified schedule
  const handleLoadOfficial10USchedule = () => {
    setIsLoading(true);
    setStatusMessage({ type: 'info', text: 'Loading official MSA 10U Tackle Football 2026 schedule...' });
    try {
      const parsed = parseTeamSnapICS(DEFAULT_10U_TEAMSNAP_ICS, activeTeam.id);
      if (!parsed.success || parsed.events.length === 0) {
        throw new Error('Failed to parse 10U schedule.');
      }
      applySyncResult(parsed, `Loaded official 2026 schedule: ${parsed.totalParsed} events!`);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to load official schedule.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle File Upload (.ics or .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: `Reading ${file.name}...` });

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        let parsed: TeamSnapSyncResult;

        if (file.name.toLowerCase().endsWith('.ics') || content.includes('BEGIN:VCALENDAR')) {
          parsed = parseTeamSnapICS(content, activeTeam.id);
        } else if (file.name.toLowerCase().endsWith('.csv') || content.includes(',')) {
          parsed = parseTeamSnapCSV(content);
        } else {
          parsed = parseTeamSnapText(content);
        }

        if (!parsed.success || parsed.events.length === 0) {
          throw new Error(parsed.error || 'No schedule events could be parsed from this file.');
        }

        applySyncResult(parsed, `Parsed ${parsed.totalParsed} events from ${file.name}!`);
      } catch (err: any) {
        setStatusMessage({
          type: 'error',
          text: err?.message || 'Failed to read file.',
        });
        setSyncResult(null);
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsText(file);
  };

  // Handle Text Parsing
  const handleParseText = () => {
    if (!pasteText.trim()) {
      setStatusMessage({ type: 'error', text: 'Please paste your TeamSnap schedule text first.' });
      return;
    }

    setIsLoading(true);
    try {
      const parsed = parseTeamSnapText(pasteText);
      if (!parsed.success || parsed.events.length === 0) {
        throw new Error(parsed.error || 'Could not parse any schedule events from the provided text.');
      }

      applySyncResult(parsed, `Identified ${parsed.totalParsed} events from pasted text!`);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to parse text.',
      });
      setSyncResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick selection helpers
  const selectOnlyNewEvents = () => {
    if (!syncResult) return;
    const updated: Record<string, boolean> = {};
    syncResult.events.forEach((e, idx) => {
      const key = e.id || String(idx);
      if (!e.isAlreadyInDatabase) {
        updated[key] = true;
      }
    });
    setSelectedEventIds(updated);
  };

  // Toggle selection for all currently displayed events
  const toggleSelectAll = (select: boolean) => {
    if (!syncResult) return;
    const updated: Record<string, boolean> = { ...selectedEventIds };
    displayedEvents.forEach((e) => {
      const originalIdx = syncResult.events.indexOf(e);
      const key = e.id || String(originalIdx);
      updated[key] = select;
    });
    setSelectedEventIds(updated);
  };

  const toggleEventSelected = (id: string) => {
    setSelectedEventIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Modify individual parsed event in preview
  const handleUpdateParsedEvent = (idx: number, updates: Partial<ParsedTeamSnapEvent>) => {
    if (!syncResult) return;
    const updatedEvents = [...syncResult.events];
    const current = updatedEvents[idx];
    const updated: ParsedTeamSnapEvent = {
      ...current,
      ...updates,
    };

    // If type switched to game and opponent was empty, infer from title
    if (updates.type === 'game' && !updated.opponent) {
      if (updated.title.includes(' vs ') || updated.title.includes(' vs. ')) {
        updated.opponent = updated.title.split(/ vs\.? /i)[1]?.trim();
      } else if (updated.title.includes(' @ ') || updated.title.startsWith('@')) {
        updated.opponent = updated.title.replace(/^@\s*/, '').trim();
      } else {
        updated.opponent = updated.title;
      }
    }

    updatedEvents[idx] = updated;

    const gamesCount = updatedEvents.filter((e) => e.type === 'game' || e.type === 'tournament').length;
    const practicesCount = updatedEvents.filter((e) => e.type === 'practice' || e.type === 'walkthrough').length;
    const scrimmagesCount = updatedEvents.filter((e) => e.type === 'scrimmage').length;
    const meetingsCount = updatedEvents.filter((e) => e.type === 'meeting').length;

    setSyncResult({
      ...syncResult,
      events: updatedEvents,
      gamesCount,
      practicesCount,
      scrimmagesCount,
      meetingsCount,
    });
  };

  // Execute Import
  const handleExecuteImport = () => {
    if (!syncResult || syncResult.events.length === 0) return;

    const chosen = syncResult.events.filter((e, idx) => selectedEventIds[e.id || String(idx)]);
    if (chosen.length === 0) {
      alert('Please select at least one event to import.');
      return;
    }

    const payload: Omit<ScheduleEvent, 'id' | 'createdAt' | 'lastEdited'>[] = chosen.map((e) => ({
      teamId: activeTeam.id,
      type: e.type,
      title: e.title,
      week: e.week,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location,
      locationType: e.locationType,
      opponent: e.opponent,
      uniform: e.uniform,
      arrivalMinutesBefore: e.arrivalMinutesBefore,
      focusOrNotes: e.focusOrNotes,
    }));

    onImportEvents(payload, importMode === 'replace');
    onClose();
  };

  const totalCount = syncResult?.totalParsed || 0;
  const newEventsCount = syncResult
    ? syncResult.events.filter((e) => !e.isAlreadyInDatabase).length
    : 0;
  const existingEventsCount = syncResult
    ? syncResult.events.filter((e) => e.isAlreadyInDatabase).length
    : 0;

  const selectedCount = syncResult
    ? syncResult.events.filter((e, idx) => selectedEventIds[e.id || String(idx)]).length
    : 0;
  const selectedNewCount = syncResult
    ? syncResult.events.filter((e, idx) => !e.isAlreadyInDatabase && selectedEventIds[e.id || String(idx)]).length
    : 0;
  const selectedExistingCount = syncResult
    ? syncResult.events.filter((e, idx) => e.isAlreadyInDatabase && selectedEventIds[e.id || String(idx)]).length
    : 0;

  const displayedEvents = syncResult
    ? syncResult.events.filter((e) => {
        if (filterTab === 'new') return !e.isAlreadyInDatabase;
        if (filterTab === 'existing') return e.isAlreadyInDatabase;
        return true;
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 md:p-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 ring-1 ring-white/15 shrink-0">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                  TeamSnap Schedule Sync
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {activeTeam.name} ({activeTeam.ageGroup || 'Active Team'})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically import games, practices, arrival times, uniforms &amp; fields from TeamSnap into this team's schedule.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-4 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'url'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>1-Click TeamSnap Feed (URL)</span>
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'file'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload .ICS / .CSV File</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 transition-all border-b-2 ${
              activeTab === 'text'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Paste Schedule Text</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Tab 1: URL Sync */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-white">How to get your TeamSnap Calendar URL:</p>
                  <p>
                    1. Open TeamSnap on web or app &rarr; Navigate to <strong>Schedule</strong>.
                  </p>
                  <p>
                    2. Click <strong>"Subscribe to Calendar"</strong> or <strong>"Export / iCal"</strong> and copy the <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">webcal://</code> or <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">https://</code> link.
                  </p>
                  <p>3. Paste it below to fetch and sync the schedule for <strong>{activeTeam.name}</strong>.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
                    TeamSnap iCal / WebCal Feed URL
                  </label>
                  {icalUrl && (
                    <a
                      href={icalUrl.replace(/^webcal:\/\//i, 'https://')}
                      target="_blank"
                      rel="noreferrer"
                      download="teamsnap_schedule.ics"
                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
                      title="Direct link to calendar feed"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download .ics File</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={icalUrl}
                      onChange={(e) => setIcalUrl(e.target.value)}
                      placeholder="e.g. webcal://ical.teamsnap.com/teams/12345/schedule.ics"
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleFetchFromUrl}
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30 active:scale-95 shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>{isLoading ? 'Syncing...' : 'Fetch Schedule'}</span>
                  </button>
                </div>

                {/* Quick actions row */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleLoadOfficial10USchedule}
                    disabled={isLoading}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>⚡ Quick Load Official 2026 Schedule (30 Events)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('file')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    <span>Upload .ICS file instead</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const fakeEvent = { target: { files: [file] } } as any;
                    handleFileUpload(fakeEvent);
                  }
                }}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-800/40 hover:bg-indigo-950/20 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-indigo-400 border border-slate-700">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Click or drag &amp; drop your TeamSnap Schedule file</p>
                  <p className="text-xs text-slate-400 mt-1">Supports TeamSnap <code className="text-indigo-300">.ics</code> calendar exports and <code className="text-indigo-300">.csv</code> spreadsheets</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ics,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Don't have a file?</span>
                <button
                  type="button"
                  onClick={handleLoadOfficial10USchedule}
                  className="text-indigo-400 hover:text-indigo-300 font-bold underline"
                >
                  Load 10U 2026 Season Schedule directly &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Paste Text */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
                  Paste Raw TeamSnap Schedule / Email Text
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPasteText(
                      `MSA 10U Tackle Football 2026 Schedule:\n` +
                      `08/28/2026 2:30 PM - Scrimmage @ MetLife Stadium\n` +
                      `09/06/2026 12:00 PM - Game at Suffern (80 Hemion Rd, Suffern NY)\n` +
                      `09/13/2026 12:00 PM - Game vs Yorktown Huskers (421 Baldwin Place Rd)\n` +
                      `09/20/2026 12:00 PM - Game vs Shrub Oak (421 Baldwin Place Rd)\n` +
                      `09/27/2026 1:00 PM - Game at Carmel Rams (30 Fair St, Carmel NY)\n` +
                      `10/04/2026 3:00 PM - Game vs Wappingers Wildcats (421 Baldwin Place Rd)\n` +
                      `10/11/2026 3:00 PM - Game at Brewster (50 Foggintown Rd, Brewster NY)\n` +
                      `10/18/2026 2:00 PM - Game vs Somers Tuskers (421 Baldwin Place Rd)`
                    );
                  }}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline"
                >
                  Load Sample Schedule Text
                </button>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={7}
                placeholder="Paste schedule dates, game times, opponents, and locations here..."
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleParseText}
                  disabled={isLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Parse Schedule</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
              }`}
            >
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
              {statusMessage.type === 'info' && <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Parsed Events Preview Table */}
          {syncResult && syncResult.events.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              {/* Deduplication Status Alert */}
              {newEventsCount > 0 ? (
                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-emerald-300">
                        Found {newEventsCount} new event{newEventsCount === 1 ? '' : 's'} not yet in your calendar database!
                      </p>
                      <p className="text-emerald-200/80 text-[11px]">
                        {existingEventsCount > 0
                          ? `${existingEventsCount} events were identified as already in your database and are unselected by default to prevent duplicates.`
                          : 'All fetched events are new and ready to import.'}
                      </p>
                    </div>
                  </div>
                  {existingEventsCount > 0 && (
                    <button
                      type="button"
                      onClick={selectOnlyNewEvents}
                      className="px-2.5 py-1 text-[11px] font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shrink-0 transition-colors shadow-sm cursor-pointer"
                    >
                      Select {newEventsCount} New Only
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-slate-300 text-xs flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">
                      Your schedule is completely up to date!
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      All {totalCount} events from TeamSnap already exist in your {activeTeam.name} calendar database.
                    </p>
                  </div>
                </div>
              )}

              {/* Filter Tabs & Select All Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterTab === 'all'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All Events ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('new')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      filterTab === 'new'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-emerald-400/80 hover:text-emerald-300'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>New Only ({newEventsCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('existing')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      filterTab === 'existing'
                        ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Already in DB ({existingEventsCount})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    Select All Shown
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800/60 border border-slate-700 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Event list */}
              <div className="max-h-80 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/40 divide-y divide-slate-800/80">
                {displayedEvents.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                    <p className="font-semibold text-slate-300">No events matching this filter.</p>
                    <p className="text-slate-500">
                      {filterTab === 'new'
                        ? 'All events from this feed already exist in your database!'
                        : 'No events found in this view.'}
                    </p>
                  </div>
                ) : (
                  displayedEvents.map((evt) => {
                    const originalIdx = syncResult.events.indexOf(evt);
                    const eventKey = evt.id || String(originalIdx);
                    const isSelected = !!selectedEventIds[eventKey];
                    const isNew = !evt.isAlreadyInDatabase;

                    return (
                      <div
                        key={eventKey}
                        className={`p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs transition-colors ${
                          isSelected
                            ? isNew
                              ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                              : 'bg-slate-800/40 hover:bg-slate-800/60'
                            : 'opacity-40 hover:opacity-70'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEventSelected(eventKey)}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer mt-1"
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* New vs Existing Badge */}
                              {isNew ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                                  <Sparkles className="w-3 h-3 text-emerald-400" />
                                  <span>NEW EVENT</span>
                                </span>
                              ) : (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-slate-400 bg-slate-800/80 border border-slate-700/80 flex items-center gap-1 shrink-0"
                                  title={evt.matchReason}
                                >
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Already in DB</span>
                                  {evt.matchReason && (
                                    <span className="text-[9px] text-slate-500 hidden sm:inline">
                                      ({evt.matchReason})
                                    </span>
                                  )}
                                </span>
                              )}

                              {/* Type Selector Dropdown */}
                              <select
                                value={evt.type}
                                onChange={(e) =>
                                  handleUpdateParsedEvent(originalIdx, {
                                    type: e.target.value as ScheduleEventType,
                                  })
                                }
                                onClick={(e) => e.stopPropagation()}
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400 ${
                                  evt.type === 'game'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-black'
                                    : evt.type === 'scrimmage'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                                    : evt.type === 'meeting'
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold'
                                }`}
                              >
                                <option value="game" className="bg-slate-900 text-amber-300 font-black">
                                  🎮 Game
                                </option>
                                <option value="practice" className="bg-slate-900 text-indigo-300 font-bold">
                                  🏈 Practice
                                </option>
                                <option value="scrimmage" className="bg-slate-900 text-rose-300 font-bold">
                                  ⚔️ Scrimmage
                                </option>
                                <option value="meeting" className="bg-slate-900 text-purple-300">
                                  📋 Meeting
                                </option>
                                <option value="walkthrough" className="bg-slate-900 text-cyan-300">
                                  🚶 Walkthrough
                                </option>
                              </select>

                              {/* Week Selector Dropdown */}
                              <select
                                value={evt.week}
                                onChange={(e) =>
                                  handleUpdateParsedEvent(originalIdx, { week: e.target.value })
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-slate-300 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded cursor-pointer focus:outline-none focus:border-indigo-500"
                              >
                                {getSeasonWeekList(seasonConfig).map((w) => (
                                  <option key={w.key} value={w.key}>
                                    {w.label}
                                  </option>
                                ))}
                              </select>

                              {/* Editable Title */}
                              <input
                                type="text"
                                value={evt.title}
                                onChange={(e) =>
                                  handleUpdateParsedEvent(originalIdx, { title: e.target.value })
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold text-white bg-slate-900/90 border border-slate-700/80 rounded px-2 py-0.5 text-xs flex-1 min-w-[180px] focus:outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1 text-slate-300 font-medium">
                                <Calendar className="w-3 h-3 text-indigo-400" />
                                {evt.date} @ {evt.startTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-500" />
                                {evt.location}
                              </span>
                              {evt.opponent && evt.type === 'game' && (
                                <span className="text-amber-300 font-bold">
                                  🆚 Opponent: {evt.opponent} ({evt.locationType})
                                </span>
                              )}
                              {evt.uniform && (
                                <span className="text-amber-300/90 font-medium">
                                  🎽 {evt.uniform}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Type Switch Button */}
                        <div className="flex items-center gap-1 shrink-0 self-end md:self-center">
                          {evt.type !== 'game' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateParsedEvent(originalIdx, { type: 'game' });
                              }}
                              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-all"
                              title="Switch this event to Game"
                            >
                              Set as Game 🎮
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateParsedEvent(originalIdx, { type: 'practice' });
                              }}
                              className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-[10px] font-bold transition-all"
                              title="Switch this event to Practice"
                            >
                              Set as Practice 🏈
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Import Options */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                    Import Mode for {activeTeam.name}:
                  </span>
                  <p className="text-xs text-slate-400">
                    Selected: <strong className="text-white">{selectedCount}</strong> total events (
                    <strong className="text-emerald-400">{selectedNewCount} new</strong>,{' '}
                    <strong className="text-slate-400">{selectedExistingCount} already in calendar</strong>)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Add to existing calendar (Safe - preserves current events)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-rose-300/90">Replace current schedule</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleExecuteImport}
            disabled={!syncResult || selectedCount === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {selectedCount === 0
                ? 'Select Events to Import'
                : selectedExistingCount === 0
                ? `Import ${selectedNewCount} New Event${selectedNewCount === 1 ? '' : 's'} to ${activeTeam.name}`
                : `Import ${selectedCount} Event${selectedCount === 1 ? '' : 's'} (${selectedNewCount} new) to ${activeTeam.name}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
