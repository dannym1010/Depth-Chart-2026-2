import { ScheduleEvent, ScheduleEventType } from '../types';

export interface ParsedTeamSnapEvent {
  id?: string;
  type: ScheduleEventType;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime?: string; // HH:MM
  location: string;
  locationType: 'home' | 'away' | 'neutral';
  opponent?: string;
  uniform?: string;
  arrivalMinutesBefore?: number;
  focusOrNotes?: string;
  week: string;
  raw?: any;
  isAlreadyInDatabase?: boolean;
  matchReason?: string;
}

export interface EventDuplicateCheckResult {
  isDuplicate: boolean;
  matchedEvent?: ScheduleEvent;
  matchReason?: string;
}

export interface TeamSnapSyncResult {
  success: boolean;
  events: ParsedTeamSnapEvent[];
  teamName?: string;
  error?: string;
  totalParsed: number;
  gamesCount: number;
  practicesCount: number;
  scrimmagesCount: number;
  meetingsCount: number;
}

/**
 * Infer the season week string from an event date (e.g. '2026-09-05' -> '1', '2026-08-20' -> 'pre-3').
 * NOTE: Weeks ALWAYS start on Monday and end on Sunday.
 * Week 1 begins on Monday, August 31, 2026.
 */
export function inferWeekFromDate(dateStr: string, seasonStartMonday: string = '2026-08-31'): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const eventDate = new Date(y, m - 1, d, 12, 0, 0);
    const [sy, sm, sd] = seasonStartMonday.split('-').map(Number);
    const seasonStart = new Date(sy, sm - 1, sd, 12, 0, 0);

    const diffMs = eventDate.getTime() - seasonStart.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      if (diffDays >= -7) return 'pre-4'; // Pre-Season Week 4 (Aug 24-30, 2026)
      if (diffDays >= -14) return 'pre-3'; // Pre-Season Week 3 (Aug 17-23, 2026)
      if (diffDays >= -21) return 'pre-2'; // Pre-Season Week 2 (Aug 10-16, 2026)
      return 'pre-1'; // Pre-Season Week 1 (Aug 03-09, 2026)
    }

    const weekNum = Math.floor(diffDays / 7) + 1;
    if (weekNum <= 8) return String(weekNum);
    if (weekNum === 9) return 'playoffs';
    if (weekNum >= 10) return 'championship';
    return String(weekNum);
  } catch {
    return '1';
  }
}

/**
 * Parse an iCal (.ics) string (from TeamSnap WebCal or file) into ScheduleEvents
 */
export function parseTeamSnapICS(icsText: string, defaultTeamId: string = 'team_10u'): TeamSnapSyncResult {
  const events: ParsedTeamSnapEvent[] = [];
  let teamName = '';

  try {
    // Unfold lines (iCal format wraps lines with a leading space or tab)
    const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
    const lines = unfolded.split(/\r\n|\n|\r/);

    let inEvent = false;
    let currentEvent: Record<string, string> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('X-WR-CALNAME:')) {
        teamName = line.replace('X-WR-CALNAME:', '').trim();
      }

      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {};
        continue;
      }

      if (line === 'END:VEVENT') {
        inEvent = false;
        if (currentEvent.SUMMARY && currentEvent.DTSTART) {
          const parsed = transformIcsEvent(currentEvent);
          if (parsed) {
            events.push(parsed);
          }
        }
        continue;
      }

      if (inEvent) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const rawKey = line.substring(0, colonIdx);
          const val = line.substring(colonIdx + 1);
          // Strip parameters like DTSTART;TZID=... -> DTSTART
          const cleanKey = rawKey.split(';')[0].trim().toUpperCase();
          currentEvent[cleanKey] = val;
        }
      }
    }

    // Sort by date then start time
    events.sort((a, b) => {
      const d = (a.date || '').localeCompare(b.date || '');
      if (d !== 0) return d;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    const gamesCount = events.filter((e) => e.type === 'game' || e.type === 'tournament').length;
    const practicesCount = events.filter((e) => e.type === 'practice' || e.type === 'walkthrough').length;
    const scrimmagesCount = events.filter((e) => e.type === 'scrimmage').length;
    const meetingsCount = events.filter((e) => e.type === 'meeting').length;

    return {
      success: true,
      events,
      teamName,
      totalParsed: events.length,
      gamesCount,
      practicesCount,
      scrimmagesCount,
      meetingsCount,
    };
  } catch (err: any) {
    return {
      success: false,
      events: [],
      error: err?.message || 'Failed to parse iCal schedule data.',
      totalParsed: 0,
      gamesCount: 0,
      practicesCount: 0,
      scrimmagesCount: 0,
      meetingsCount: 0,
    };
  }
}

/**
 * Helper to convert raw ICS VEVENT dict to ParsedTeamSnapEvent
 */
function transformIcsEvent(raw: Record<string, string>): ParsedTeamSnapEvent | null {
  const summary = (raw.SUMMARY || '').trim();
  const description = (raw.DESCRIPTION || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').trim();
  const location = (raw.LOCATION || '').replace(/\\,/g, ',').trim() || 'Home Field';

  // Parse Date and Time from DTSTART (Format: YYYYMMDDTHHMMSSZ or YYYYMMDD or YYYYMMDDTHHMMSS)
  const dtStartRaw = raw.DTSTART || '';
  const dtEndRaw = raw.DTEND || '';

  let date = '';
  let startTime = '10:00';
  let endTime = '12:00';

  if (dtStartRaw.length >= 8) {
    const y = dtStartRaw.substring(0, 4);
    const m = dtStartRaw.substring(4, 6);
    const d = dtStartRaw.substring(6, 8);
    date = `${y}-${m}-${d}`;

    const tIdx = dtStartRaw.indexOf('T');
    if (tIdx !== -1 && dtStartRaw.length >= tIdx + 5) {
      const hh = dtStartRaw.substring(tIdx + 1, tIdx + 3);
      const mm = dtStartRaw.substring(tIdx + 3, tIdx + 5);
      startTime = `${hh}:${mm}`;
    }
  }

  if (dtEndRaw.length >= 8) {
    const tIdx = dtEndRaw.indexOf('T');
    if (tIdx !== -1 && dtEndRaw.length >= tIdx + 5) {
      const hh = dtEndRaw.substring(tIdx + 1, tIdx + 3);
      const mm = dtEndRaw.substring(tIdx + 3, tIdx + 5);
      endTime = `${hh}:${mm}`;
    }
  }

  if (!date) return null;

  // Determine event type
  const lowerSum = summary.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const rawCategories = (raw.CATEGORIES || '').toLowerCase();
  const rawTypeHeader = (raw['X-TEAMSNAP-EVENT-TYPE'] || raw['X-TEAMSNAP-TYPE'] || '').toLowerCase();

  let type: ScheduleEventType = 'practice';
  let opponent: string | undefined = undefined;
  let locationType: 'home' | 'away' | 'neutral' = 'home';

  // 1. Explicit categories or header
  if (
    rawCategories.includes('game') ||
    rawCategories.includes('match') ||
    rawTypeHeader.includes('game') ||
    rawTypeHeader.includes('match')
  ) {
    type = 'game';
  } else if (rawCategories.includes('scrimmage') || rawTypeHeader.includes('scrimmage')) {
    type = 'scrimmage';
  } else if (rawCategories.includes('meeting') || rawTypeHeader.includes('meeting')) {
    type = 'meeting';
  }
  // 2. Scrimmage indicators in title/description
  else if (lowerSum.includes('scrimmage') || lowerDesc.includes('scrimmage')) {
    type = 'scrimmage';
  }
  // 3. Meeting / Film / Social
  else if (
    lowerSum.includes('meeting') ||
    lowerSum.includes('film session') ||
    lowerSum.includes('banquet') ||
    lowerSum.includes('parent mtg') ||
    lowerSum.includes('team photo') ||
    lowerDesc.includes('event type: meeting')
  ) {
    type = 'meeting';
  }
  // 4. Walkthrough
  else if (lowerSum.includes('walkthrough') || lowerSum.includes('walk-through')) {
    type = 'walkthrough';
  }
  // 5. Game indicators in summary or description
  else if (
    lowerSum.includes('game') ||
    lowerSum.includes('vs.') ||
    lowerSum.includes('vs ') ||
    lowerSum.includes(' v. ') ||
    lowerSum.includes(' v ') ||
    lowerSum.includes(' @ ') ||
    lowerSum.startsWith('@') ||
    lowerSum.includes(' at ') ||
    lowerSum.startsWith('at ') ||
    lowerSum.includes('tournament') ||
    lowerSum.includes('bowl') ||
    lowerSum.includes('playoff') ||
    lowerSum.includes('championship') ||
    lowerSum.includes('jamboree') ||
    lowerSum.includes('kickoff') ||
    lowerSum.includes('matchup') ||
    lowerDesc.includes('event type: game') ||
    lowerDesc.includes('type: game') ||
    lowerDesc.includes('opponent:') ||
    lowerDesc.includes('opponent :') ||
    lowerDesc.includes('vs.') ||
    lowerDesc.includes(' vs ') ||
    lowerDesc.includes('kickoff at') ||
    lowerDesc.includes('kick off') ||
    lowerDesc.includes('home vs') ||
    lowerDesc.includes('away vs')
  ) {
    type = 'game';
  } else {
    type = 'practice';
  }

  // Parse Opponent & Location Type from summary and description
  if (type === 'game' || type === 'scrimmage') {
    if (summary.includes(' vs. ') || summary.includes(' vs ')) {
      locationType = 'home';
      const parts = summary.split(/ vs\.? /i);
      opponent = parts[1]?.trim();
    } else if (summary.includes(' v. ') || summary.includes(' v ')) {
      locationType = 'home';
      const parts = summary.split(/ v\.? /i);
      opponent = parts[1]?.trim();
    } else if (summary.includes(' @ ') || summary.startsWith('@')) {
      locationType = 'away';
      const parts = summary.split(/ @ /i);
      opponent = parts.length > 1 ? parts[1]?.trim() : summary.replace(/^@\s*/, '').trim();
    } else if (summary.includes(' at ') || summary.toLowerCase().startsWith('at ')) {
      locationType = 'away';
      const parts = summary.split(/ at /i);
      opponent = parts.length > 1 ? parts[1]?.trim() : summary.replace(/^at\s+/i, '').trim();
    } else if (summary.toLowerCase().startsWith('game:') || summary.toLowerCase().startsWith('game -') || summary.toLowerCase().startsWith('game #')) {
      opponent = summary.replace(/^game(?:\s*#\d+)?[:\-]\s*/i, '').trim();
    } else {
      opponent = summary;
    }

    // Try extracting opponent from description if not clean
    if (!opponent || opponent.toLowerCase().includes('game') || opponent.toLowerCase().includes('10u')) {
      const oppMatch = description.match(/opponent:\s*([^\n\r,]+)/i) || description.match(/vs\.?\s*([A-Za-z0-9\s]+)/i);
      if (oppMatch && oppMatch[1]) {
        opponent = oppMatch[1].trim();
      }
    }
  }

  // Parse Arrival Time from description (e.g., "Arrive 45 min before" or "Arrival Time: 9:00 AM")
  let arrivalMinutesBefore = type === 'game' ? 60 : 15;
  const arriveMatch = description.match(/arrive\s*(?:at\s*)?(\d+)\s*(?:min|minute|mins)/i);
  if (arriveMatch && arriveMatch[1]) {
    arrivalMinutesBefore = parseInt(arriveMatch[1], 10);
  }

  // Parse Uniform from description (e.g. "Uniform: Gold Jerseys", "Wear White Jerseys")
  let uniform: string | undefined = undefined;
  const uniformMatch = description.match(/uniform(?:s)?:\s*([^\n\r]+)/i) || description.match(/wear\s*([^\n\r]+jersey[^\n\r]*)/i);
  if (uniformMatch && uniformMatch[1]) {
    uniform = uniformMatch[1].trim();
  } else if (type === 'game') {
    uniform = locationType === 'home' ? 'Gold Home Jerseys' : 'White Away Jerseys';
  }

  const week = inferWeekFromDate(date);

  return {
    id: raw.UID || `ts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    title: summary,
    date,
    startTime,
    endTime,
    location,
    locationType,
    opponent,
    uniform,
    arrivalMinutesBefore,
    focusOrNotes: description,
    week,
    raw,
  };
}

/**
 * Parse TeamSnap exported CSV or Excel text format
 */
export function parseTeamSnapCSV(csvText: string): TeamSnapSyncResult {
  try {
    const lines = csvText.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return {
        success: false,
        events: [],
        error: 'CSV file is empty.',
        totalParsed: 0,
        gamesCount: 0,
        practicesCount: 0,
        scrimmagesCount: 0,
        meetingsCount: 0,
      };
    }

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map((h) => h.replace(/["']/g, '').trim());

    // Map column indices
    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const timeIdx = headers.findIndex((h) => h.includes('time') && !h.includes('arrive') && !h.includes('arrival'));
    const endTimeIdx = headers.findIndex((h) => h.includes('end time') || h.includes('end_time'));
    const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('event type'));
    const titleIdx = headers.findIndex((h) => h.includes('event') || h.includes('title') || h.includes('name') || h.includes('summary'));
    const oppIdx = headers.findIndex((h) => h.includes('opponent'));
    const locIdx = headers.findIndex((h) => h.includes('location') || h.includes('field') || h.includes('venue'));
    const unifIdx = headers.findIndex((h) => h.includes('uniform') || h.includes('jersey') || h.includes('attire'));
    const arriveIdx = headers.findIndex((h) => h.includes('arrive') || h.includes('arrival'));
    const notesIdx = headers.findIndex((h) => h.includes('note') || h.includes('description') || h.includes('detail'));

    const events: ParsedTeamSnapEvent[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvRow(lines[i]);
      if (row.length === 0) continue;

      const dateRaw = dateIdx !== -1 ? row[dateIdx] : row[0];
      if (!dateRaw) continue;

      // Normalize date to YYYY-MM-DD
      const date = normalizeDate(dateRaw);
      if (!date) continue;

      const timeRaw = timeIdx !== -1 ? row[timeIdx] : '10:00 AM';
      const startTime = normalizeTime(timeRaw);

      const endTimeRaw = endTimeIdx !== -1 ? row[endTimeIdx] : '';
      const endTime = endTimeRaw ? normalizeTime(endTimeRaw) : undefined;

      const rawType = typeIdx !== -1 ? (row[typeIdx] || '').toLowerCase() : '';
      const rawTitle = titleIdx !== -1 ? (row[titleIdx] || '') : (row[1] || 'Event');
      const rawOpp = oppIdx !== -1 ? (row[oppIdx] || '') : '';
      const location = (locIdx !== -1 ? row[locIdx] : '') || 'Home Turf';
      const uniform = unifIdx !== -1 ? row[unifIdx] : undefined;
      const arriveRaw = arriveIdx !== -1 ? row[arriveIdx] : '';
      const notes = notesIdx !== -1 ? row[notesIdx] : '';

      let type: ScheduleEventType = 'practice';
      if (rawType.includes('game') || rawTitle.toLowerCase().includes('game') || rawOpp) {
        type = 'game';
      } else if (rawType.includes('scrimmage') || rawTitle.toLowerCase().includes('scrimmage')) {
        type = 'scrimmage';
      } else if (rawType.includes('meeting') || rawTitle.toLowerCase().includes('meeting')) {
        type = 'meeting';
      }

      let locationType: 'home' | 'away' | 'neutral' = 'home';
      if (rawTitle.includes('@') || location.toLowerCase().includes('away')) {
        locationType = 'away';
      }

      let arrivalMinutesBefore = type === 'game' ? 60 : 15;
      if (arriveRaw) {
        const num = parseInt(arriveRaw.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) arrivalMinutesBefore = num;
      }

      const opponent = rawOpp || (type === 'game' ? rawTitle.replace(/^(game\s*vs\.?|vs\.?|@)\s*/i, '').trim() : undefined);
      const week = inferWeekFromDate(date);

      events.push({
        id: `ts_csv_${Date.now()}_${i}`,
        type,
        title: rawTitle || (opponent ? `vs ${opponent}` : `Team Practice`),
        date,
        startTime,
        endTime,
        location,
        locationType,
        opponent,
        uniform,
        arrivalMinutesBefore,
        focusOrNotes: notes,
        week,
      });
    }

    const gamesCount = events.filter((e) => e.type === 'game' || e.type === 'tournament').length;
    const practicesCount = events.filter((e) => e.type === 'practice' || e.type === 'walkthrough').length;
    const scrimmagesCount = events.filter((e) => e.type === 'scrimmage').length;
    const meetingsCount = events.filter((e) => e.type === 'meeting').length;

    return {
      success: true,
      events,
      totalParsed: events.length,
      gamesCount,
      practicesCount,
      scrimmagesCount,
      meetingsCount,
    };
  } catch (err: any) {
    return {
      success: false,
      events: [],
      error: err?.message || 'Failed to parse TeamSnap CSV.',
      totalParsed: 0,
      gamesCount: 0,
      practicesCount: 0,
      scrimmagesCount: 0,
      meetingsCount: 0,
    };
  }
}

/**
 * Parse plain text or copied schedule table from TeamSnap
 */
export function parseTeamSnapText(text: string): TeamSnapSyncResult {
  // If it contains BEGIN:VCALENDAR, treat as iCal
  if (text.includes('BEGIN:VCALENDAR') || text.includes('BEGIN:VEVENT')) {
    return parseTeamSnapICS(text);
  }

  // If it has comma-separated lines with headers, treat as CSV
  if (text.includes(',') && (text.toLowerCase().includes('date') || text.toLowerCase().includes('opponent'))) {
    return parseTeamSnapCSV(text);
  }

  // Fallback: Line-by-line intelligent regex parser
  const lines = text.split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean);
  const events: ParsedTeamSnapEvent[] = [];

  // Patterns for dates: MM/DD/YYYY, MM/DD/YY, YYYY-MM-DD, Sep 5, September 5, Saturday Sep 5
  const dateRegex = /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/i;
  const timeRegex = /\b(\d{1,2}:\d{2}(?:\s*(?:am|pm))?)\b/i;

  let currentEntry: Partial<ParsedTeamSnapEvent> | null = null;

  for (const line of lines) {
    const dMatch = line.match(dateRegex);
    const tMatch = line.match(timeRegex);

    if (dMatch) {
      if (currentEntry && currentEntry.date && currentEntry.title) {
        events.push(finalizeTextEvent(currentEntry));
      }

      const normDate = normalizeDate(dMatch[0]);
      const normTime = tMatch ? normalizeTime(tMatch[0]) : '10:00';

      const cleanTitle = line
        .replace(dateRegex, '')
        .replace(timeRegex, '')
        .replace(/^[,\-:\s|]+|[,\-:\s|]+$/g, '')
        .trim();

      currentEntry = {
        date: normDate || '2026-09-05',
        startTime: normTime,
        title: cleanTitle || 'Team Event',
        location: 'Home Turf',
        locationType: 'home',
      };
    } else if (currentEntry) {
      // Append additional details (location, notes, opponent)
      if (line.toLowerCase().startsWith('location:') || line.toLowerCase().startsWith('at:')) {
        currentEntry.location = line.replace(/^(location|at):/i, '').trim();
      } else if (line.toLowerCase().startsWith('uniform:')) {
        currentEntry.uniform = line.replace(/^uniform:/i, '').trim();
      } else if (line.toLowerCase().startsWith('opponent:') || line.toLowerCase().startsWith('vs:')) {
        currentEntry.opponent = line.replace(/^(opponent|vs):/i, '').trim();
        currentEntry.type = 'game';
      } else {
        currentEntry.focusOrNotes = ((currentEntry.focusOrNotes || '') + '\n' + line).trim();
      }
    }
  }

  if (currentEntry && currentEntry.date && currentEntry.title) {
    events.push(finalizeTextEvent(currentEntry));
  }

  const gamesCount = events.filter((e) => e.type === 'game' || e.type === 'tournament').length;
  const practicesCount = events.filter((e) => e.type === 'practice' || e.type === 'walkthrough').length;
  const scrimmagesCount = events.filter((e) => e.type === 'scrimmage').length;
  const meetingsCount = events.filter((e) => e.type === 'meeting').length;

  return {
    success: events.length > 0,
    events,
    totalParsed: events.length,
    gamesCount,
    practicesCount,
    scrimmagesCount,
    meetingsCount,
    error: events.length === 0 ? 'Could not automatically identify dates or events from text.' : undefined,
  };
}

function finalizeTextEvent(entry: Partial<ParsedTeamSnapEvent>): ParsedTeamSnapEvent {
  const title = entry.title || 'Team Event';
  const lower = title.toLowerCase();

  let type: ScheduleEventType = entry.type || 'practice';
  let opponent = entry.opponent;
  let locationType: 'home' | 'away' | 'neutral' = entry.locationType || 'home';

  if (!entry.type) {
    if (lower.includes('vs') || lower.includes('@') || lower.includes('game')) {
      type = 'game';
      if (lower.includes('@')) locationType = 'away';
    } else if (lower.includes('scrimmage')) {
      type = 'scrimmage';
    } else if (lower.includes('meeting') || lower.includes('film')) {
      type = 'meeting';
    }
  }

  if (!opponent && (type === 'game' || type === 'scrimmage')) {
    if (title.includes(' vs ') || title.includes(' vs. ')) {
      opponent = title.split(/ vs\.? /i)[1]?.trim();
    } else if (title.includes(' @ ')) {
      opponent = title.split(/ @ /i)[1]?.trim();
    }
  }

  const date = entry.date || '2026-09-05';
  const week = inferWeekFromDate(date);

  return {
    id: `ts_txt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    title,
    date,
    startTime: entry.startTime || '10:00',
    endTime: entry.endTime || '12:00',
    location: entry.location || 'Home Turf Field',
    locationType,
    opponent,
    uniform: entry.uniform,
    arrivalMinutesBefore: type === 'game' ? 60 : 15,
    focusOrNotes: entry.focusOrNotes,
    week,
  };
}

/**
 * Helper to parse a CSV line with quotes support
 */
function parseCsvRow(text: string): string[] {
  const p: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      p.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  p.push(cur.trim());
  return p.map((val) => val.replace(/^["']|["']$/g, '').trim());
}

/**
 * Normalize Date string to YYYY-MM-DD
 */
function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const clean = raw.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // MM/DD/YYYY or MM/DD/YY
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, '0');
    const d = slashMatch[2].padStart(2, '0');
    let y = slashMatch[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  // MM/DD (assume current season year 2026)
  const shortSlash = clean.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortSlash) {
    const m = shortSlash[1].padStart(2, '0');
    const d = shortSlash[2].padStart(2, '0');
    return `2026-${m}-${d}`;
  }

  // Text month: "Sep 5", "September 5, 2026"
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear() === 2001 ? 2026 : parsed.getFullYear();
    const m = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const d = parsed.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Normalize Time string to 24-hour HH:MM
 */
function normalizeTime(raw: string): string {
  if (!raw) return '10:00';
  const clean = raw.toLowerCase().trim();

  // If already HH:MM
  if (/^\d{2}:\d{2}$/.test(clean)) return clean;

  // e.g. "5:30 pm" or "5:30pm" or "10:00 am"
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = match[3];

    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;

    return `${h.toString().padStart(2, '0')}:${m}`;
  }

  return '10:00';
}

/**
 * Checks if a parsed TeamSnap event already exists in the local schedule/database.
 */
export function isEventAlreadyInSchedule(
  parsed: { id?: string; date: string; startTime: string; title: string; type?: string; opponent?: string; raw?: any },
  existingEvents: ScheduleEvent[],
  activeTeamId: string
): EventDuplicateCheckResult {
  if (!existingEvents || existingEvents.length === 0) {
    return { isDuplicate: false };
  }

  const isMatchingTeam = (evTeamId?: string, targetTeamId?: string) => {
    if (!evTeamId || !targetTeamId) return true;
    if (evTeamId === targetTeamId) return true;
    if (
      (evTeamId === 'team_10u' || evTeamId === 'team-10u') &&
      (targetTeamId === 'team_10u' || targetTeamId === 'team-10u')
    ) {
      return true;
    }
    return false;
  };

  // Filter events belonging to the active team
  const teamEvents = existingEvents.filter((ev) => isMatchingTeam(ev.teamId, activeTeamId));

  // Helper to normalize strings for comparison (remove team names, punctuation, whitespace)
  const cleanStr = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/msa\s*10u\s*tackle\s*football\s*2026\s*[-–—:]*\s*/gi, '')
      .replace(/[^a-z0-9]/g, '');

  const cleanParsedTitle = cleanStr(parsed.title);
  const cleanParsedOpponent = cleanStr(parsed.opponent);

  for (const existing of teamEvents) {
    // 1. UID match (if stored in id or raw)
    if (parsed.id && (existing.id === parsed.id || existing.id.includes(parsed.id))) {
      return { isDuplicate: true, matchedEvent: existing, matchReason: 'TeamSnap ID Match' };
    }
    if (parsed.raw?.UID && existing.id.includes(parsed.raw.UID)) {
      return { isDuplicate: true, matchedEvent: existing, matchReason: 'TeamSnap UID Match' };
    }

    // Must match the same date
    if (existing.date !== parsed.date) {
      continue;
    }

    // Same date:
    // 2. Exact same start time (e.g. 17:30 == 17:30)
    if (existing.startTime === parsed.startTime) {
      return {
        isDuplicate: true,
        matchedEvent: existing,
        matchReason: `Same Date & Time (${existing.date} @ ${existing.startTime})`,
      };
    }

    // 3. For games: same date and matching opponent or game title
    if (
      (parsed.type === 'game' || parsed.type === 'scrimmage') &&
      (existing.type === 'game' || existing.type === 'scrimmage')
    ) {
      const cleanExistingTitle = cleanStr(existing.title);
      const cleanExistingOpponent = cleanStr(existing.opponent);
      if (
        (cleanParsedOpponent && cleanExistingOpponent && cleanParsedOpponent === cleanExistingOpponent) ||
        (cleanParsedOpponent && cleanExistingTitle.includes(cleanParsedOpponent)) ||
        (cleanExistingOpponent && cleanParsedTitle.includes(cleanExistingOpponent)) ||
        (cleanParsedTitle && cleanExistingTitle && cleanParsedTitle === cleanExistingTitle)
      ) {
        return {
          isDuplicate: true,
          matchedEvent: existing,
          matchReason: `Matching Game on ${existing.date}`,
        };
      }
    }

    // 4. For practices: same date and start time within 45 minutes
    if (
      (parsed.type === 'practice' || parsed.type === 'walkthrough') &&
      (existing.type === 'practice' || existing.type === 'walkthrough')
    ) {
      const parseMinutes = (t: string) => {
        const [h, m] = (t || '0:0').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      const diff = Math.abs(parseMinutes(existing.startTime) - parseMinutes(parsed.startTime));
      if (diff <= 45) {
        return {
          isDuplicate: true,
          matchedEvent: existing,
          matchReason: `Practice on ${existing.date} (~${existing.startTime})`,
        };
      }
    }

    // 5. Title match on same date
    const cleanExistingTitle = cleanStr(existing.title);
    if (
      cleanParsedTitle &&
      cleanExistingTitle &&
      (cleanParsedTitle === cleanExistingTitle ||
        cleanExistingTitle.includes(cleanParsedTitle) ||
        cleanParsedTitle.includes(cleanExistingTitle))
    ) {
      return {
        isDuplicate: true,
        matchedEvent: existing,
        matchReason: `Matching Event Title on ${existing.date}`,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Decorates a list of parsed TeamSnap events with duplicate / database status
 */
export function markEventsDatabaseStatus(
  events: ParsedTeamSnapEvent[],
  existingEvents: ScheduleEvent[],
  activeTeamId: string
): ParsedTeamSnapEvent[] {
  return events.map((evt) => {
    const check = isEventAlreadyInSchedule(evt, existingEvents, activeTeamId);
    return {
      ...evt,
      isAlreadyInDatabase: check.isDuplicate,
      matchReason: check.matchReason,
    };
  });
}
