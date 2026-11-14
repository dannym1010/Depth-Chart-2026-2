import type { ScoutBundle } from '../hudlScout/scoutBundle';
import type { Play } from '../hudlScout/types/football';
import { cleanFirestoreData, getFirebaseServices, isFirestoreQuotaPaused, isReadOnlySession, parseCSV, safeJSONParse, safeJSONSet } from '../services/storageService';
import { splitCsvLine } from '../utils/rosterCsv';
import { isProgramAdminEmail, PROGRAM_ADMIN_EMAILS } from '../utils/staffAccess';
import {
  parseTeamSnapCSV,
  parseTeamSnapICS,
  parseTeamSnapText,
  type ParsedTeamSnapEvent,
} from '../utils/teamSnapSync';
import type {
  BasketballGame,
  BasketballPlayer,
  BasketballPossession,
  BasketballStaffMember,
  BasketballState,
  BasketballTeam,
  BasketballTeamData,
  CourtPosition,
  DefenseType,
  PossessionPhase,
  PossessionResult,
  ShotZone,
} from './types';

const STORAGE_KEY = 'bball_studio_v1_state';
const CLOUD_STATE_DOC = 'bball_studio_state';
const CLOUD_ACCESS_DOC = 'bball_access';
let lastBballAccessKey = '';
let lastLocalSaveAt = 0;

const LEGACY_DEMO_PLAYER_ID_RE = /^bbp(?:12)?-(?:[1-9]|10)$/;
const LEGACY_DEMO_GAME_IDS = new Set([
  'bball-g1',
  'bball-g2',
  'bball-g3',
  'bball-p1',
  'bball-t1',
  'bball-12u-g1',
]);
const LEGACY_DEMO_STAFF_EMAILS = new Set([
  'coach.mike@mahopachoops.org',
  'brennan.family@gmail.com',
]);

export const BASKETBALL_SEASONS = ['2025-26', '2026-27'] as const;

export function normalizeSeasonLabel(season?: string): string {
  const s = String(season || '').trim();
  if (s.includes('2025-26') || s.includes('25-26')) return '2025-26';
  if (s.includes('2026-27') || s.includes('26-27')) return '2026-27';
  return s || '2026-27';
}

export const DEFAULT_BASKETBALL_SETS = [
  '5-Out Motion',
  'Horns Flare',
  '4-Out 1-In DHO',
  'Spain PnR',
  'Box BLOB',
  '1-4 High SLOB',
  'Press Break',
  'Transition Break',
];

const SAMPLE_ROSTER_10U: BasketballPlayer[] = [
  { id: 'bbp-1', num: '2', firstName: 'Mason', lastName: 'Rivera', position: 'PG', height: '4\'10"', grade: '4th', tags: ['Ball Handler', 'Press Breaker'] },
  { id: 'bbp-2', num: '5', firstName: 'Cole', lastName: 'Brennan', position: 'SG', height: '4\'11"', grade: '4th', tags: ['3PT Shooter'] },
  { id: 'bbp-3', num: '11', firstName: 'Liam', lastName: 'Kowalski', position: 'SF', height: '5\'0"', grade: '4th', tags: ['Slasher', 'Hustle'] },
  { id: 'bbp-4', num: '14', firstName: 'Owen', lastName: 'Delgado', position: 'PF', height: '5\'2"', grade: '4th', tags: ['Rebounder', 'Rim Runner'] },
  { id: 'bbp-5', num: '22', firstName: 'Jaxson', lastName: 'Pestone', position: 'PG', height: '4\'11"', grade: '4th', tags: ['Lockdown Defender', 'Floor General'] },
  { id: 'bbp-6', num: '23', firstName: 'Carter', lastName: 'Hayes', position: 'SG', height: '5\'1"', grade: '4th', tags: ['Scorer', 'Shooter'] },
  { id: 'bbp-7', num: '24', firstName: 'Ethan', lastName: 'Mancuso', position: 'PF', height: '5\'3"', grade: '4th', tags: ['Shot Blocker', 'Screen Setter'] },
  { id: 'bbp-8', num: '30', firstName: 'Noah', lastName: 'Velez', position: 'SG', height: '4\'10"', grade: '4th', tags: ['Corner 3'] },
  { id: 'bbp-9', num: '33', firstName: 'Lucas', lastName: 'Romero', position: 'C', height: '5\'4"', grade: '4th', tags: ['Post Scorer', 'Glass Cleaner'] },
  { id: 'bbp-10', num: '41', firstName: 'Aiden', lastName: 'Byrne', position: 'SF', height: '5\'0"', grade: '4th', tags: ['Two-Way Wing'] },
];

const SAMPLE_ROSTER_12U: BasketballPlayer[] = [
  { id: 'bbp12-1', num: '1', firstName: 'Dylan', lastName: 'Morales', position: 'PG', height: '5\'3"', grade: '6th', tags: ['Floor General', 'On-Ball Pressure'] },
  { id: 'bbp12-2', num: '3', firstName: 'Caleb', lastName: 'Kerrigan', position: 'SG', height: '5\'4"', grade: '6th', tags: ['Catch & Shoot', '3PT Threat'] },
  { id: 'bbp12-3', num: '10', firstName: 'Gavin', lastName: 'O\'Connor', position: 'SF', height: '5\'6"', grade: '6th', tags: ['Slasher', 'Transition'] },
  { id: 'bbp12-4', num: '12', firstName: 'Brady', lastName: 'Santoro', position: 'PG', height: '5\'2"', grade: '6th', tags: ['Press Breaker'] },
  { id: 'bbp12-5', num: '15', firstName: 'Ryan', lastName: 'McAllister', position: 'PF', height: '5\'7"', grade: '6th', tags: ['Rim Runner', 'Screen & Roll'] },
  { id: 'bbp12-6', num: '21', firstName: 'Jack', lastName: 'DeLuca', position: 'SG', height: '5\'5"', grade: '6th', tags: ['Corner 3', 'Weakside Help'] },
  { id: 'bbp12-7', num: '25', firstName: 'Nolan', lastName: 'Fitzpatrick', position: 'SF', height: '5\'6"', grade: '6th', tags: ['Wing Defender'] },
  { id: 'bbp12-8', num: '32', firstName: 'Trevor', lastName: 'Quinn', position: 'PF', height: '5\'8"', grade: '6th', tags: ['High Post Nail', 'Rebounder'] },
  { id: 'bbp12-9', num: '34', firstName: 'Julian', lastName: 'Clemente', position: 'C', height: '5\'9"', grade: '6th', tags: ['Rim Protector', 'Post Finish'] },
  { id: 'bbp12-10', num: '44', firstName: 'Leo', lastName: 'Vasquez', position: 'C', height: '5\'8"', grade: '6th', tags: ['Offensive Glass'] },
];

const GAME_1_POSSESSIONS: BasketballPossession[] = [
  { id: 'gp1-1', playNumber: 1, period: 1, clock: '7:42', teamSide: 'us', phase: 'half_court', setCall: '5-Out Motion', defenseFaced: 'man', result: '2pt_make', points: 2, shotZone: 'rim', shooter: '#22 Jaxson Pestone', assister: '#2 Mason Rivera', notes: 'Backdoor cut off wing pass', isHighlight: true },
  { id: 'gp1-2', playNumber: 2, period: 1, clock: '7:18', teamSide: 'opponent', phase: 'half_court', setCall: 'Opponent Motion', defenseFaced: 'man', result: 'def_steal', points: 0, defender: '#22 Jaxson Pestone', notes: 'Jumped passing lane cleanly', isHighlight: true },
  { id: 'gp1-3', playNumber: 3, period: 1, clock: '7:10', teamSide: 'us', phase: 'transition', setCall: 'Transition Break', defenseFaced: 'man', result: '3pt_make', points: 3, shotZone: 'corner_3_left', shooter: '#5 Cole Brennan', assister: '#22 Jaxson Pestone', notes: 'Pitch ahead to left corner 3', isHighlight: true },
  { id: 'gp1-4', playNumber: 4, period: 1, clock: '6:35', teamSide: 'us', phase: 'half_court', setCall: 'Horns Flare', defenseFaced: 'zone_2_3', result: '2pt_make', points: 2, shotZone: 'paint', shooter: '#33 Lucas Romero', assister: '#23 Carter Hayes', notes: 'High-low seal against 2-3 zone' },
  { id: 'gp1-5', playNumber: 5, period: 1, clock: '6:02', teamSide: 'opponent', phase: 'half_court', setCall: 'Opponent High PnR', defenseFaced: 'man', result: '2pt_miss', points: 0, shotZone: 'mid_right', rebounder: '#14 Owen Delgado' },
  { id: 'gp1-6', playNumber: 6, period: 1, clock: '5:40', teamSide: 'us', phase: 'blob', setCall: 'Box BLOB', defenseFaced: 'zone_2_3', result: '2pt_make', points: 2, shotZone: 'rim', shooter: '#24 Ethan Mancuso', assister: '#2 Mason Rivera', notes: 'Weakside flash for layup' },
  { id: 'gp1-7', playNumber: 7, period: 2, clock: '6:50', teamSide: 'us', phase: 'half_court', setCall: '5-Out Motion', defenseFaced: 'man', result: '3pt_miss', points: 0, shotZone: 'wing_3_right', shooter: '#5 Cole Brennan', rebounder: '#14 Owen Delgado' },
  { id: 'gp1-8', playNumber: 8, period: 2, clock: '6:14', teamSide: 'us', phase: 'half_court', setCall: 'Spain PnR', defenseFaced: 'man', result: 'and_1', points: 3, shotZone: 'rim', shooter: '#23 Carter Hayes', assister: '#33 Lucas Romero', notes: 'Strong downhill finish through contact', isHighlight: true },
  { id: 'gp1-9', playNumber: 9, period: 2, clock: '5:22', teamSide: 'opponent', phase: 'transition', setCall: 'Opponent Push', defenseFaced: 'man', result: 'def_block', points: 0, shotZone: 'rim', defender: '#24 Ethan Mancuso', rebounder: '#11 Liam Kowalski', isHighlight: true },
  { id: 'gp1-10', playNumber: 10, period: 2, clock: '4:40', teamSide: 'us', phase: 'press_break', setCall: 'Press Break', defenseFaced: 'press', result: '3pt_make', points: 3, shotZone: 'top_3', shooter: '#23 Carter Hayes', assister: '#2 Mason Rivera', notes: 'Middle flash beat the 1-2-1-1 press' },
  { id: 'gp1-11', playNumber: 11, period: 3, clock: '7:05', teamSide: 'us', phase: 'half_court', setCall: 'Horns Flare', defenseFaced: 'zone_2_3', result: 'turnover', points: 0, shooter: '#2 Mason Rivera', notes: 'Skip pass tipped in traffic' },
  { id: 'gp1-12', playNumber: 12, period: 3, clock: '6:20', teamSide: 'opponent', phase: 'half_court', setCall: 'Opponent 4-Out', defenseFaced: 'zone_2_3', result: '3pt_make', points: 3, shotZone: 'wing_3_left', notes: 'Late closeout on skip' },
  { id: 'gp1-13', playNumber: 13, period: 3, clock: '5:35', teamSide: 'us', phase: 'slob', setCall: '1-4 High SLOB', defenseFaced: 'man', result: '3pt_make', points: 3, shotZone: 'corner_3_right', shooter: '#30 Noah Velez', assister: '#22 Jaxson Pestone', notes: 'Hammer screen to corner', isHighlight: true },
  { id: 'gp1-14', playNumber: 14, period: 4, clock: '3:50', teamSide: 'us', phase: 'half_court', setCall: '5-Out Motion', defenseFaced: 'man', result: '2pt_make', points: 2, shotZone: 'mid_center', shooter: '#11 Liam Kowalski', assister: '#23 Carter Hayes' },
  { id: 'gp1-15', playNumber: 15, period: 4, clock: '2:12', teamSide: 'opponent', phase: 'blob', setCall: 'Opponent Box', defenseFaced: 'man', result: '2pt_make', points: 2, shotZone: 'paint', notes: 'Lost cutter under basket' },
  { id: 'gp1-16', playNumber: 16, period: 4, clock: '1:18', teamSide: 'us', phase: 'transition', setCall: 'Transition Break', defenseFaced: 'man', result: '2pt_make', points: 2, shotZone: 'rim', shooter: '#2 Mason Rivera', assister: '#14 Owen Delgado', notes: 'Outlet off defensive board to ice game' },
];

const GAME_2_POSSESSIONS: BasketballPossession[] = [
  { id: 'gp2-1', playNumber: 1, period: 1, clock: '7:15', teamSide: 'us', phase: 'half_court', setCall: '4-Out 1-In DHO', defenseFaced: 'man', result: '3pt_make', points: 3, shotZone: 'wing_3_left', shooter: '#5 Cole Brennan', assister: '#33 Lucas Romero' },
  { id: 'gp2-2', playNumber: 2, period: 1, clock: '6:30', teamSide: 'opponent', phase: 'half_court', setCall: 'Opponent Flex', defenseFaced: 'man', result: 'def_steal', points: 0, defender: '#22 Jaxson Pestone', isHighlight: true },
  { id: 'gp2-3', playNumber: 3, period: 2, clock: '5:50', teamSide: 'us', phase: 'half_court', setCall: 'Horns Flare', defenseFaced: 'zone_2_3', result: '2pt_make', points: 2, shotZone: 'paint', shooter: '#33 Lucas Romero', assister: '#2 Mason Rivera' },
  { id: 'gp2-4', playNumber: 4, period: 2, clock: '4:15', teamSide: 'opponent', phase: 'half_court', setCall: 'Opponent 5-Out', defenseFaced: 'man', result: '3pt_miss', points: 0, shotZone: 'top_3', rebounder: '#24 Ethan Mancuso' },
  { id: 'gp2-5', playNumber: 5, period: 3, clock: '6:05', teamSide: 'us', phase: 'transition', setCall: 'Transition Break', defenseFaced: 'man', result: '2pt_make', points: 2, shotZone: 'rim', shooter: '#23 Carter Hayes', assister: '#5 Cole Brennan', isHighlight: true },
  { id: 'gp2-6', playNumber: 6, period: 4, clock: '2:45', teamSide: 'us', phase: 'blob', setCall: 'Box BLOB', defenseFaced: 'man', result: '2pt_make', points: 2, shotZone: 'mid_left', shooter: '#41 Aiden Byrne', assister: '#22 Jaxson Pestone' },
];

export const SAMPLE_BASKETBALL_STATE: BasketballState = {
  teams: [
    { id: 'bball-10u-boys', name: 'Mahopac 10U Travel', season: '2026-27 Winter', accentColor: '#f59e0b' },
    { id: 'bball-12u-gold', name: 'Mahopac 12U Gold', season: '2026-27 Winter', accentColor: '#2563eb' },
  ],
  activeTeamId: 'bball-10u-boys',
  activeGameIdByTeam: {
    'bball-10u-boys': 'bball-g1',
    'bball-12u-gold': 'bball-12u-g1',
  },
  darkMode: true,
  staff: [
    { id: 'st-1', name: 'Coach Danny', email: 'dannym1010@gmail.com', role: 'Admin', status: 'Active', teamIds: ['bball-10u-boys', 'bball-12u-gold'], linkedPlayerNums: [] },
    { id: 'st-2', name: 'Assistant Coach Mike', email: 'coach.mike@mahopachoops.org', role: 'Coach', status: 'Active', defaultSport: 'basketball', teamIds: ['bball-10u-boys'], linkedPlayerNums: [] },
    { id: 'st-3', name: 'Brennan Family', email: 'brennan.family@gmail.com', role: 'Family', status: 'Active', defaultSport: 'basketball', teamIds: ['bball-10u-boys'], linkedPlayerNums: ['5'], allowedTabs: ['schedule', 'highlights'], highlightAccess: 'kid' },
  ],
  teamData: {
    'bball-10u-boys': {
      roster: SAMPLE_ROSTER_10U,
      customSets: DEFAULT_BASKETBALL_SETS,
      games: [
        {
          id: 'bball-g1',
          weekLabel: 'Game 1',
          date: '2026-11-08',
          time: '11:30',
          opponent: 'Yorktown Huskers',
          location: 'Mahopac High School Main Gym',
          homeAway: 'Home',
          eventType: 'Game',
          ourScore: 54,
          opponentScore: 43,
          possessions: GAME_1_POSSESSIONS,
          scoutingNotes: 'Yorktown dropped into a 2-3 zone in Q2 and pressed after made free throws. Horns high-low carved up the middle.',
          opponentTendencies: {
            pace: 'Fast in transition off misses; slows down vs 2-3 zone',
            primaryDefense: '2-3 Zone & 1-2-1-1 Diamond Press',
            keyPlayers: ['#12 Left-hand PG (drives left)', '#34 Tall Post (offensive glass)'],
            gamePlanBullets: [
              'Flash #33 or #14 to high post nail immediately against 2-3 zone.',
              'Sprint corner-to-corner on transition defense — stop ball before half-court.',
              'Box out #34 on every shot; limit second-chance paint touches.',
            ],
          },
        },
        {
          id: 'bball-g2',
          weekLabel: 'Game 2',
          date: '2026-11-14',
          time: '14:00',
          opponent: 'Carmel Rams',
          location: 'George Fischer Middle School',
          homeAway: 'Away',
          eventType: 'Game',
          ourScore: 49,
          opponentScore: 46,
          possessions: GAME_2_POSSESSIONS,
          scoutingNotes: 'Heavy man-to-man team that switches ball screens up top.',
          opponentTendencies: {
            pace: 'Deliberate half-court (Motion / Flex)',
            primaryDefense: 'Tight Man-to-Man (Deny one pass away)',
            keyPlayers: ['#4 Quick point guard', '#15 Wing shooter (left wing)'],
            gamePlanBullets: [
              'Use backdoor cuts out of 5-Out Motion when wings overplay.',
              'Attack switches inside with #33 sealed on the block.',
            ],
          },
        },
        {
          id: 'bball-p1',
          weekLabel: 'Practice',
          date: '2026-11-17',
          time: '18:30',
          opponent: 'Team Practice — Press Break & BLOB',
          location: 'Austin Road Elementary Gym',
          homeAway: 'Home',
          eventType: 'Practice',
          possessions: [],
        },
        {
          id: 'bball-g3',
          weekLabel: 'Game 3',
          date: '2026-11-21',
          time: '10:00',
          opponent: 'Somers Tuskers',
          location: 'Somers Middle School',
          homeAway: 'Away',
          eventType: 'Game',
          possessions: [],
          opponentTendencies: {
            pace: 'High tempo full-court press',
            primaryDefense: 'Man-to-Man Press + 1-3-1 Half-Court Trap',
            keyPlayers: ['#10 Aggressive on-ball guard', '#21 Stretch forward'],
            gamePlanBullets: [
              'Keep dribble alive through middle against 1-3-1; attack short corners.',
              'Rebound as a 5-man unit before pushing break.',
            ],
          },
        },
        {
          id: 'bball-t1',
          weekLabel: 'Tournament',
          date: '2026-11-28',
          time: '09:00',
          opponent: 'Thanksgiving Classic Pool Play',
          location: 'Putnam Valley Fieldhouse',
          homeAway: 'Neutral',
          eventType: 'Tournament',
          possessions: [],
        },
      ],
    },
    'bball-12u-gold': {
      roster: SAMPLE_ROSTER_12U,
      customSets: DEFAULT_BASKETBALL_SETS,
      games: [
        {
          id: 'bball-12u-g1',
          weekLabel: 'Game 1',
          date: '2026-11-15',
          time: '13:00',
          opponent: 'Brewster Bears',
          location: 'Mahopac Middle School',
          homeAway: 'Home',
          eventType: 'Game',
          possessions: [],
        },
      ],
    },
  },
};

export const DEFAULT_BASKETBALL_STATE: BasketballState = {
  teams: [
    { id: 'bball-10u-boys-25-26', name: 'Mahopac 10U Travel', season: '2025-26', accentColor: '#f59e0b' },
    { id: 'bball-12u-gold-25-26', name: 'Mahopac 12U Gold', season: '2025-26', accentColor: '#2563eb' },
    { id: 'bball-10u-boys', name: 'Mahopac 10U Travel', season: '2026-27', accentColor: '#f59e0b' },
    { id: 'bball-12u-gold', name: 'Mahopac 12U Gold', season: '2026-27', accentColor: '#2563eb' },
  ],
  activeTeamId: 'bball-10u-boys',
  activeGameIdByTeam: {},
  darkMode: true,
  staff: [
    {
      id: 'st-1',
      name: 'Coach Danny',
      email: 'dannym1010@gmail.com',
      role: 'Admin',
      status: 'Active',
      teamIds: ['bball-10u-boys-25-26', 'bball-12u-gold-25-26', 'bball-10u-boys', 'bball-12u-gold'],
      linkedPlayerNums: [],
    },
  ],
  teamData: {
    'bball-10u-boys-25-26': {
      roster: [],
      customSets: DEFAULT_BASKETBALL_SETS,
      games: [],
    },
    'bball-12u-gold-25-26': {
      roster: [],
      customSets: DEFAULT_BASKETBALL_SETS,
      games: [],
    },
    'bball-10u-boys': {
      roster: [],
      customSets: DEFAULT_BASKETBALL_SETS,
      games: [],
    },
    'bball-12u-gold': {
      roster: [],
      customSets: DEFAULT_BASKETBALL_SETS,
      games: [],
    },
  },
};

export function stripLegacyDemoData(
  rawTeamData: Record<string, BasketballTeamData> = {},
  rawStaff: BasketballStaffMember[] = []
): {
  teamData: Record<string, BasketballTeamData>;
  staff: BasketballStaffMember[];
  strippedDemo: boolean;
} {
  let strippedDemo = false;
  const cleanedTeamData: Record<string, BasketballTeamData> = {};

  for (const [teamId, td] of Object.entries(rawTeamData || {})) {
    const origRoster = Array.isArray(td?.roster) ? td.roster : [];
    const origGames = Array.isArray(td?.games) ? td.games : [];
    const roster = origRoster.filter((p) => !LEGACY_DEMO_PLAYER_ID_RE.test(String(p?.id || '')));
    const games = origGames.filter((g) => !LEGACY_DEMO_GAME_IDS.has(String(g?.id || '')));
    if (roster.length !== origRoster.length || games.length !== origGames.length) {
      strippedDemo = true;
    }
    cleanedTeamData[teamId] = {
      roster,
      games,
      customSets:
        Array.isArray(td?.customSets) && td.customSets.length > 0
          ? td.customSets
          : DEFAULT_BASKETBALL_SETS,
    };
  }

  for (const defaultTeam of DEFAULT_BASKETBALL_STATE.teams) {
    if (!cleanedTeamData[defaultTeam.id]) {
      cleanedTeamData[defaultTeam.id] = {
        roster: [],
        games: [],
        customSets: DEFAULT_BASKETBALL_SETS,
      };
    }
  }

  const origStaff = Array.isArray(rawStaff) ? rawStaff : [];
  const filteredStaff = origStaff.filter(
    (s) => !LEGACY_DEMO_STAFF_EMAILS.has(String(s?.email || '').toLowerCase().trim())
  );
  if (filteredStaff.length !== origStaff.length) strippedDemo = true;

  const staff =
    filteredStaff.length > 0 ? filteredStaff : DEFAULT_BASKETBALL_STATE.staff;

  return { teamData: cleanedTeamData, staff, strippedDemo };
}

function normalizeWithMeta(raw: Partial<BasketballState> | null | undefined): {
  state: BasketballState;
  strippedDemo: boolean;
} {
  if (!raw || !Array.isArray(raw.teams) || raw.teams.length === 0) {
    return { state: DEFAULT_BASKETBALL_STATE, strippedDemo: false };
  }
  const { teamData, staff, strippedDemo } = stripLegacyDemoData(
    raw.teamData || {},
    Array.isArray(raw.staff) ? raw.staff : []
  );

  const teams: BasketballTeam[] = raw.teams.map((t) => ({
    ...t,
    season: normalizeSeasonLabel(t.season),
  }));
  const updatedTeamData = { ...teamData };
  let updatedStaff = staff;

  for (const t of teams) {
    if (!updatedTeamData[t.id]) {
      updatedTeamData[t.id] = { roster: [], games: [], customSets: DEFAULT_BASKETBALL_SETS };
    }
  }

  // Ensure both 2025-26 and 2026-27 exist with independent rosters/schedules/TeamSnap syncs
  const baseTeam = teams[0];
  for (const reqSeason of BASKETBALL_SEASONS) {
    if (!teams.some((t) => normalizeSeasonLabel(t.season) === reqSeason)) {
      const slug = reqSeason.replace(/[^a-z0-9]/gi, '');
      const defaultId =
        reqSeason === '2025-26' ? `${baseTeam.id}-25-26` : `${baseTeam.id}-${slug}`;
      const newId = teams.some((t) => t.id === defaultId)
        ? `${defaultId}-${Date.now()}`
        : defaultId;
      teams.push({
        id: newId,
        name: baseTeam.name,
        season: reqSeason,
        accentColor: baseTeam.accentColor,
      });
      updatedTeamData[newId] = { roster: [], games: [], customSets: DEFAULT_BASKETBALL_SETS };
      updatedStaff = updatedStaff.map((m) =>
        m.role === 'Admin' && !m.teamIds.includes(newId)
          ? { ...m, teamIds: [...m.teamIds, newId] }
          : m
      );
    }
  }

  const activeGameIdByTeam: Record<string, string> = {};
  for (const [tid, gid] of Object.entries(raw.activeGameIdByTeam || {})) {
    const teamGames = updatedTeamData[tid]?.games || [];
    if (gid && teamGames.some((g) => g.id === gid)) {
      activeGameIdByTeam[tid] = gid;
    }
  }

  return {
    strippedDemo,
    state: {
      teams,
      activeTeamId:
        typeof raw.activeTeamId === 'string' && teams.some((t) => t.id === raw.activeTeamId)
          ? raw.activeTeamId
          : teams[0].id,
      activeGameIdByTeam,
      teamData: updatedTeamData,
      staff: updatedStaff,
      darkMode: typeof raw.darkMode === 'boolean' ? raw.darkMode : DEFAULT_BASKETBALL_STATE.darkMode,
      ...(typeof raw.updatedAt === 'number' ? { updatedAt: raw.updatedAt } : {}),
    },
  };
}

/** Switch to a target season (e.g. '2025-26' or '2026-27'), keeping each year's roster & games separate. */
export function switchBasketballSeason(
  state: BasketballState,
  targetSeason: string
): BasketballState {
  const season = normalizeSeasonLabel(targetSeason);
  const current =
    state.teams.find((t) => t.id === state.activeTeamId) || state.teams[0];
  if (!current) return state;

  const currentNameLower = current.name.toLowerCase().trim();
  const sameTeamOtherSeason = state.teams.find(
    (t) =>
      normalizeSeasonLabel(t.season) === season &&
      t.name.toLowerCase().trim() === currentNameLower
  );
  if (sameTeamOtherSeason) {
    return { ...state, activeTeamId: sameTeamOtherSeason.id };
  }

  const anyInSeason = state.teams.find(
    (t) => normalizeSeasonLabel(t.season) === season
  );
  if (anyInSeason) {
    return { ...state, activeTeamId: anyInSeason.id };
  }

  const suffix = season.replace(/[^a-z0-9]/gi, '');
  let newId = `${current.id}-${suffix}`;
  if (state.teams.some((t) => t.id === newId)) {
    newId = `${newId}-${Date.now()}`;
  }
  const newTeam: BasketballTeam = {
    id: newId,
    name: current.name,
    season,
    accentColor: current.accentColor,
  };
  return {
    ...state,
    teams: [...state.teams, newTeam],
    activeTeamId: newTeam.id,
    teamData: {
      ...state.teamData,
      [newTeam.id]: {
        roster: [],
        games: [],
        customSets: DEFAULT_BASKETBALL_SETS,
      },
    },
    staff: state.staff.map((m) =>
      m.role === 'Admin' && !m.teamIds.includes(newTeam.id)
        ? { ...m, teamIds: [...m.teamIds, newTeam.id] }
        : m
    ),
  };
}

function normalizeBasketballState(raw: Partial<BasketballState> | null | undefined): BasketballState {
  return normalizeWithMeta(raw).state;
}

export function loadBasketballState(): BasketballState {
  const saved = safeJSONParse<BasketballState | null>(STORAGE_KEY, null);
  const { state, strippedDemo } = normalizeWithMeta(saved);
  if (strippedDemo) {
    safeJSONSet(STORAGE_KEY, state);
  }
  return state;
}

export interface BasketballCloudAccess {
  admins: Record<string, true>;
  coaches: Record<string, true>;
  viewers: Record<string, true>;
  highlighters: Record<string, true>;
}

/** Build the Firestore teamData/bball_access permission map from the Basketball staff list. */
export function bballAccessFromStaff(staff: BasketballStaffMember[] = []): BasketballCloudAccess {
  const out: BasketballCloudAccess = { admins: {}, coaches: {}, viewers: {}, highlighters: {} };
  for (const email of PROGRAM_ADMIN_EMAILS) {
    out.admins[String(email || '').toLowerCase().trim()] = true;
  }
  for (const m of staff || []) {
    const email = String(m?.email || '').toLowerCase().trim();
    if (!email || !email.includes('@') || m.status === 'Pending') continue;
    if (m.role === 'Admin') out.admins[email] = true;
    else if (m.role === 'Coach') out.coaches[email] = true;
    else {
      out.viewers[email] = true;
      if (m.highlightAccess === 'helper') out.highlighters[email] = true;
    }
  }
  return out;
}

/** Write teamData/bball_access when a Basketball Admin updates staff/roles. */
export async function syncBasketballAccessDoc(staff: BasketballStaffMember[]): Promise<void> {
  if (isReadOnlySession() || !Array.isArray(staff)) return;
  try {
    if (isFirestoreQuotaPaused()) return;
    const { db } = getFirebaseServices();
    if (!db) return;
    const access = bballAccessFromStaff(staff);
    const key = JSON.stringify(access);
    if (key === lastBballAccessKey) return;
    await db.collection('teamData').doc(CLOUD_ACCESS_DOC).set({ ...access, updatedAt: Date.now() });
    lastBballAccessKey = key;
  } catch (err) {
    console.warn('Basketball access list update failed:', err);
  }
}

export function saveBasketballState(state: BasketballState): void {
  const now = Date.now();
  lastLocalSaveAt = now;
  const clean = normalizeBasketballState({ ...state, updatedAt: now });
  const stamped: BasketballState = { ...clean, updatedAt: now };
  safeJSONSet(STORAGE_KEY, stamped);
  if (isReadOnlySession()) return;
  try {
    const { db } = getFirebaseServices();
    if (db && !isFirestoreQuotaPaused()) {
      const payload = cleanFirestoreData(stamped);
      db.collection('teamData').doc(CLOUD_STATE_DOC).set(payload).catch(() => undefined);
    }
  } catch {
    /* local save already complete */
  }
}

/** Fetch Basketball state once from teamData/bball_studio_state (for login routing and initial hydration). */
export async function fetchBasketballStateCloud(): Promise<BasketballState | null> {
  try {
    if (isFirestoreQuotaPaused()) return null;
    const { db } = getFirebaseServices();
    if (!db) return null;
    const snap = await db.collection('teamData').doc(CLOUD_STATE_DOC).get();
    if (!snap?.exists) return null;

    const local = safeJSONParse<BasketballState | null>(STORAGE_KEY, null);
    const { state: remote, strippedDemo } = normalizeWithMeta(snap.data());

    if (
      local &&
      typeof local.updatedAt === 'number' &&
      typeof remote.updatedAt === 'number' &&
      local.updatedAt > remote.updatedAt
    ) {
      const cleanedLocal = normalizeBasketballState(local);
      if (!isReadOnlySession()) {
        db.collection('teamData')
          .doc(CLOUD_STATE_DOC)
          .set(cleanFirestoreData(cleanedLocal))
          .catch(() => undefined);
      }
      return cleanedLocal;
    }

    safeJSONSet(STORAGE_KEY, remote);
    if (strippedDemo && !isReadOnlySession()) {
      const cleanedRemote: BasketballState = { ...remote, updatedAt: Date.now() };
      safeJSONSet(STORAGE_KEY, cleanedRemote);
      db.collection('teamData')
        .doc(CLOUD_STATE_DOC)
        .set(cleanFirestoreData(cleanedRemote))
        .catch(() => undefined);
      return cleanedRemote;
    }
    return remote;
  } catch {
    return null;
  }
}

/** Subscribe to real-time Basketball state updates in teamData/bball_studio_state. */
export function subscribeBasketballStateCloud(onChange: (state: BasketballState) => void): () => void {
  try {
    if (isFirestoreQuotaPaused()) return () => undefined;
    const { db } = getFirebaseServices();
    if (!db || typeof db.collection !== 'function') return () => undefined;
    const unsub = db.collection('teamData').doc(CLOUD_STATE_DOC).onSnapshot(
      (snap: any) => {
        if (!snap?.exists || snap.metadata?.hasPendingWrites) return;
        if (Date.now() - lastLocalSaveAt < 2500) return;

        const { state: remote, strippedDemo } = normalizeWithMeta(snap.data());
        const local = safeJSONParse<BasketballState | null>(STORAGE_KEY, null);
        if (
          local &&
          typeof local.updatedAt === 'number' &&
          typeof remote.updatedAt === 'number' &&
          remote.updatedAt < local.updatedAt
        ) {
          return;
        }

        safeJSONSet(STORAGE_KEY, remote);
        if (strippedDemo && !isReadOnlySession()) {
          const cleanedRemote: BasketballState = { ...remote, updatedAt: Date.now() };
          safeJSONSet(STORAGE_KEY, cleanedRemote);
          db.collection('teamData')
            .doc(CLOUD_STATE_DOC)
            .set(cleanFirestoreData(cleanedRemote))
            .catch(() => undefined);
          onChange(cleanedRemote);
          return;
        }
        onChange(remote);
      },
      (err: any) => console.warn('Basketball cloud listener error:', err?.code || err)
    );
    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => undefined;
  }
}

/**
 * Determine if an authenticated user signing into the Football portal should be routed directly into
 * Court Studio (Basketball). Program owner (dannym1010@gmail.com) is never forced either way.
 */
export function shouldRouteToBasketballOnLogin(
  email: string,
  bballStaff: BasketballStaffMember[] = [],
  footballStaff?: { email: string; role?: string; status?: string }[]
): boolean {
  const clean = String(email || '').toLowerCase().trim();
  if (!clean || isProgramAdminEmail(clean)) return false;

  const bballMember = (bballStaff || []).find(
    (m) => String(m?.email || '').toLowerCase().trim() === clean && m.status !== 'Pending'
  );
  if (!bballMember) return false;
  if (bballMember.defaultSport === 'football') return false;
  if (bballMember.defaultSport === 'basketball') return true;

  const footballMember = (footballStaff || []).find(
    (f) => String(f?.email || '').toLowerCase().trim() === clean && f.status === 'Active'
  );
  if (!footballMember) return true;
  return /\b(player|family)\b/i.test(String(footballMember.role || ''));
}

/**
 * Map Basketball possessions to the Play structure expected by shared HighlightsSection & FilmRoom engines.
 * Keeps football types isolated while unlocking all clip-matching, telestration, and reel exporters.
 */
export function possessionsToFootballPlays(game: BasketballGame): Play[] {
  return (game.possessions || []).map((p) => ({
    id: p.id,
    playNumber: p.playNumber,
    odk: p.teamSide === 'us' ? 'O' : 'D',
    quarter: p.period,
    down: p.period,
    distance: 0,
    yardLine: 50,
    rawYardLine: p.clock || `Q${p.period}`,
    yardLineSide: 'MID',
    fieldZone: 'own_territory',
    hash: 'M',
    playType: p.result.startsWith('3pt') ? 'PASS' : 'RUN',
    formation: p.phase,
    backfield: p.defenseFaced,
    motion: '',
    playName: p.setCall,
    direction: p.shotZone || '',
    gainLoss: p.points,
    result: p.result,
    personnel: p.defenseFaced,
    carrierOrTarget: p.shooter || '',
    rusher: p.shooter,
    passer: p.assister,
    receiver: p.rebounder,
    keyPlayer: p.shooter || p.assister || p.defender || '',
    defPlay: p.defender
      ? {
          maker: p.defender,
          events: p.result === 'def_steal' ? ['int'] : p.result === 'def_block' ? ['blk'] : [],
        }
      : undefined,
    isExplosive: p.points >= 3 || Boolean(p.isHighlight),
    isEfficient: p.points >= 2 || p.result === 'def_stop' || p.result === 'def_steal' || p.result === 'def_block',
    notes: p.notes,
    runSide: 'M',
    gameId: game.id,
    editedAt: p.editedAt,
  }));
}

/** Adapt basketball games into a ScoutBundle so shared Highlights & Film modules work natively. */
export function gamesToScoutBundle(games: BasketballGame[]): ScoutBundle {
  const gameList = games.filter((g) => g.eventType === 'Game' || g.eventType === 'Scrimmage' || g.possessions.length > 0);
  return {
    plays: gameList.flatMap((g) => possessionsToFootballPlays(g)),
    datasetName: 'Basketball Season',
    offensiveScheme: '5-Out Motion',
    coachNotes: '',
    filters: {
      odk: 'O',
      quarter: 'ALL',
      down: 'ALL',
      fieldZone: 'ALL',
      hash: 'ALL',
      playType: 'ALL',
      formation: 'ALL',
    },
    games: gameList.map((g, idx) => ({
      id: g.id,
      name: `${g.weekLabel}: vs ${g.opponent}`,
      playCount: g.possessions.length,
      addedAt: Date.now() - idx * 1000,
      week: g.weekLabel,
      otherTeam: g.opponent,
      fromFilm: true,
    })),
    updatedAt: Date.now(),
    sourceCleared: false,
  };
}

function normCol(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parsePeriodValue(raw: string): 1 | 2 | 3 | 4 | 5 {
  const s = raw.trim().toUpperCase();
  if (s.includes('OT') || s === '5') return 5;
  const n = parseInt(s.replace(/\D/g, ''), 10);
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 1;
}

function parsePhaseValue(raw: string): PossessionPhase {
  const s = raw.toLowerCase();
  if (s.includes('trans') || s.includes('fast') || s.includes('break')) return 'transition';
  if (s.includes('blob') || s.includes('baseline')) return 'blob';
  if (s.includes('slob') || s.includes('sideline')) return 'slob';
  if (s.includes('press')) return 'press_break';
  if (s.includes('def')) return 'defense';
  return 'half_court';
}

function parseDefenseValue(raw: string): DefenseType {
  const s = raw.toLowerCase();
  if (s.includes('2-3') || s.includes('23')) return 'zone_2_3';
  if (s.includes('3-2') || s.includes('32')) return 'zone_3_2';
  if (s.includes('1-3-1') || s.includes('131')) return 'zone_1_3_1';
  if (s.includes('press') || s.includes('trap')) return 'press';
  if (s.includes('match')) return 'matchup';
  return 'man';
}

function parseResultAndPoints(raw: string): { result: PossessionResult; points: 0 | 1 | 2 | 3 | 4 } {
  const s = raw.toLowerCase();
  if (s.includes('and 1') || s.includes('and-1') || s.includes('and1')) return { result: 'and_1', points: 3 };
  if ((s.includes('3') || s.includes('three')) && (s.includes('make') || s.includes('made') || s.includes('good'))) {
    return { result: '3pt_make', points: 3 };
  }
  if ((s.includes('3') || s.includes('three')) && s.includes('miss')) {
    return { result: '3pt_miss', points: 0 };
  }
  if (s.includes('steal') || s.includes('stl')) return { result: 'def_steal', points: 0 };
  if (s.includes('block') || s.includes('blk')) return { result: 'def_block', points: 0 };
  if (s.includes('turn') || s.includes('tov') || s === 'to') return { result: 'turnover', points: 0 };
  if (s.includes('ft') || s.includes('free')) return { result: 'ft_trip', points: s.includes('2') ? 2 : 1 };
  if (s.includes('foul')) return { result: 'foul_drawn', points: 0 };
  if (s.includes('stop')) return { result: 'def_stop', points: 0 };
  if (s.includes('reb')) return { result: 'def_reb', points: 0 };
  if (s.includes('miss')) return { result: '2pt_miss', points: 0 };
  if (s.includes('make') || s.includes('made') || s.includes('2pt') || s.includes('layup') || s.includes('score')) {
    return { result: '2pt_make', points: 2 };
  }
  return { result: '2pt_miss', points: 0 };
}

function parseShotZoneValue(raw: string): ShotZone | undefined {
  const s = raw.toLowerCase();
  if (!s) return undefined;
  if (s.includes('rim') || s.includes('layup') || s.includes('dunk')) return 'rim';
  if (s.includes('paint') || s.includes('float')) return 'paint';
  if (s.includes('corner') && s.includes('left')) return 'corner_3_left';
  if (s.includes('corner') && s.includes('right')) return 'corner_3_right';
  if (s.includes('wing') && s.includes('left')) return 'wing_3_left';
  if (s.includes('wing') && s.includes('right')) return 'wing_3_right';
  if (s.includes('top') || s.includes('key') || s.includes('3pt')) return 'top_3';
  if (s.includes('left') && s.includes('mid')) return 'mid_left';
  if (s.includes('right') && s.includes('mid')) return 'mid_right';
  if (s.includes('mid') || s.includes('elbow') || s.includes('post')) return 'mid_center';
  return undefined;
}

/** Parse a Hudl Basketball / Assist CSV text export into structured BasketballPossession items. */
export function parseBasketballHudlCsv(csvText: string): BasketballPossession[] {
  const matrix = parseCSV(csvText).filter((r) => r.some((cell) => String(cell || '').trim().length > 0));
  if (matrix.length < 2) return [];

  const headers = matrix[0].map((h) => normCol(String(h || '')));
  const dataRows = matrix.slice(1);

  return dataRows.map((cells, idx) => {
    const map: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) map[headers[c]] = String(cells[c] || '').trim();
    }

    const playNumRaw = map.play || map.playnumber || map.clip || String(idx + 1);
    const playNumber = Math.max(1, parseInt(playNumRaw.replace(/\D/g, ''), 10) || idx + 1);
    const period = parsePeriodValue(map.period || map.quarter || map.qtr || '1');
    const sideRaw = (map.od || map.odk || map.side || map.team || 'O').toLowerCase();
    const teamSide: 'us' | 'opponent' =
      sideRaw.startsWith('d') || sideRaw.includes('opp') ? 'opponent' : 'us';

    const phase = parsePhaseValue(map.phase || map.situation || map.transition || 'half_court');
    const setCall = map.playcall || map.set || map.setcall || map.playname || map.offense || '5-Out Motion';
    const defenseFaced = parseDefenseValue(map.defense || map.def || map.defensefaced || 'man');
    const parsedOutcome = parseResultAndPoints(map.result || map.shot || map.outcome || '');
    const explicitPts = Number(map.points || map.pts);
    const points = ([0, 1, 2, 3, 4].includes(explicitPts) ? explicitPts : parsedOutcome.points) as 0 | 1 | 2 | 3 | 4;
    const shotZone = parseShotZoneValue(map.shotlocation || map.zone || map.shotzone || '');

    return {
      id: `csv-p-${Date.now()}-${idx + 1}`,
      playNumber,
      period,
      clock: map.clock || map.time || undefined,
      teamSide,
      phase,
      setCall,
      defenseFaced,
      result: parsedOutcome.result,
      points,
      shotZone,
      shooter: map.player || map.shooter || map.scorer || undefined,
      assister: map.assist || map.assister || undefined,
      rebounder: map.rebound || map.rebounder || undefined,
      defender: map.defender || map.steal || map.block || undefined,
      notes: map.notes || map.comment || undefined,
      editedAt: Date.now(),
    };
  });
}

function normalizeCourtPosition(raw: string): CourtPosition {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'PG' || s.includes('POINT')) return 'PG';
  if (s === 'SG' || s.includes('SHOOT')) return 'SG';
  if (s === 'SF' || s.includes('SMALL') || s.includes('WING')) return 'SF';
  if (s === 'PF' || s.includes('POWER')) return 'PF';
  if (s === 'C' || s.includes('CENTER') || s.includes('POST')) return 'C';
  if (s === 'G' || s.includes('GUARD')) return 'PG';
  if (s === 'F' || s.includes('FORWARD')) return 'SF';
  return 'PG';
}

const BB_JERSEY_COLS = ['jersey', 'jerseynumber', 'jerseyno', 'jersey#', 'number', 'num', 'no', '#', 'uniform', 'uniformnumber', 'playernumber'];
const BB_FIRST_COLS = ['first', 'firstname', 'playerfirstname', 'fname'];
const BB_LAST_COLS = ['last', 'lastname', 'playerlastname', 'lname', 'surname'];
const BB_FULL_COLS = ['name', 'playername', 'player', 'fullname', 'membername', 'rostername'];
const BB_POS_COLS = ['pos', 'position', 'primary', 'primaryposition'];
const BB_HEIGHT_COLS = ['height', 'ht'];
const BB_GRADE_COLS = ['grade', 'year', 'class', 'gradyear'];
const BB_ROLE_COLS = ['role', 'type', 'membertype', 'isnonplayer', 'nonplayer', 'status'];

/** Parse a TeamSnap roster CSV export or pasted player list into Court Studio players. */
export function parseBasketballRosterInput(raw: string): {
  players: Omit<BasketballPlayer, 'id'>[];
  skipped: string[];
} {
  const lines = String(raw || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { players: [], skipped: [] };

  const normH = (h: string) => h.toLowerCase().replace(/[^a-z0-9#]/g, '');
  const header = splitCsvLine(lines[0]).map(normH);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));

  const isHeader =
    header.some(
      (h) =>
        BB_JERSEY_COLS.includes(h) ||
        BB_FIRST_COLS.includes(h) ||
        BB_LAST_COLS.includes(h) ||
        BB_FULL_COLS.includes(h) ||
        BB_POS_COLS.includes(h) ||
        h.includes('jersey')
    );

  const jerseyIdx = find(BB_JERSEY_COLS);
  const col = isHeader
    ? {
        jersey: jerseyIdx >= 0 ? jerseyIdx : header.findIndex((h) => h.includes('jersey')),
        first: find(BB_FIRST_COLS),
        last: find(BB_LAST_COLS),
        full: find(BB_FULL_COLS),
        pos: find(BB_POS_COLS),
        height: find(BB_HEIGHT_COLS),
        grade: find(BB_GRADE_COLS),
        role: find(BB_ROLE_COLS),
      }
    : { jersey: 0, first: 1, last: 2, full: -1, pos: 3, height: 4, grade: 5, role: -1 };

  const players: Omit<BasketballPlayer, 'id'>[] = [];
  const skipped: string[] = [];

  for (let i = isHeader ? 1 : 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = splitCsvLine(line);
    const at = (idx: number) => (idx >= 0 && idx < parts.length ? parts[idx].trim() : '');

    // Check role / non-player column when header exists
    if (isHeader && col.role >= 0) {
      const roleVal = at(col.role).toLowerCase();
      if (/coach|parent|guardian|manager|non-player|nonplayer|contact|true|staff|admin/.test(roleVal)) {
        const who = at(col.full) || `${at(col.first)} ${at(col.last)}`.trim() || `Row ${i + 1}`;
        skipped.push(`${who} (${roleVal || 'non-player'})`);
        continue;
      }
    }

    // Handle loose pasted lines like "#23 Carter Hayes PG" or "Carter Hayes #23" when single column
    if (!isHeader && parts.length === 1) {
      const cleanedLine = line.replace(/\b(player|member|active)\b/gi, '').trim();
      const numMatch = cleanedLine.match(/(?:#|no\.?\s*)(\d{1,3})|^(\d{1,3})[\s,.-]+/i);
      const num = numMatch ? (numMatch[1] || numMatch[2] || '00') : '00';
      const withoutNum = cleanedLine
        .replace(/(?:#|no\.?\s*)\d{1,3}/i, '')
        .replace(/^\d{1,3}[\s,.-]+/, '')
        .trim();
      const words = withoutNum.split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      let position: CourtPosition = 'PG';
      const lastToken = words[words.length - 1];
      if (/^(PG|SG|SF|PF|C|G|F)$/i.test(lastToken)) {
        position = normalizeCourtPosition(lastToken);
        words.pop();
      }
      if (!words.length) continue;
      players.push({
        num,
        firstName: words[0],
        lastName: words.slice(1).join(' '),
        position,
      });
      continue;
    }

    let firstName = at(col.first);
    let lastName = at(col.last);
    if ((!firstName || !lastName) && at(col.full)) {
      const bits = at(col.full).split(/\s+/);
      firstName = firstName || bits[0] || '';
      lastName = lastName || bits.slice(1).join(' ');
    } else if (firstName && !lastName && col.last < 0 && firstName.includes(' ')) {
      const bits = firstName.split(/\s+/);
      firstName = bits[0] || '';
      lastName = bits.slice(1).join(' ');
    }

    // Without headers, support "First Last" when column 0 is non-numeric
    let rawNum = at(col.jersey);
    if (!isHeader && rawNum && !/\d/.test(rawNum)) {
      const bits = rawNum.split(/\s+/);
      const col1 = at(1);
      if (col1 && /\d/.test(col1) && col1.replace(/\D/g, '').length <= 3) {
        firstName = bits[0] || '';
        lastName = bits.slice(1).join(' ');
        rawNum = col1;
      } else {
        firstName = firstName ? `${bits[0] || ''} ${firstName}`.trim() : bits[0] || '';
        lastName = lastName || bits.slice(1).join(' ');
        rawNum = '';
      }
    }

    if (!firstName && !lastName) continue;
    const digits = rawNum.replace(/\D/g, '');
    const num = digits || '00';
    players.push({
      num,
      firstName: firstName || 'Player',
      lastName,
      position: normalizeCourtPosition(at(col.pos)),
      height: at(col.height) || undefined,
      grade: at(col.grade) || undefined,
    });
  }

  return { players, skipped };
}

/** Parse a TeamSnap API v3 Collection+JSON members search response into players. */
export function parseTeamSnapMembersResponse(json: any): Omit<BasketballPlayer, 'id'>[] {
  const items: any[] = json?.collection?.items;
  if (!Array.isArray(items)) return [];
  const out: Omit<BasketballPlayer, 'id'>[] = [];

  for (const item of items) {
    const fields: Record<string, any> = {};
    for (const datum of item?.data || []) {
      if (datum?.name) fields[String(datum.name)] = datum.value;
    }
    if (fields.is_non_player === true || fields.is_non_player === 'true') continue;
    const firstName = String(fields.first_name || '').trim();
    const lastName = String(fields.last_name || '').trim();
    if (!firstName && !lastName) continue;
    const jerseyRaw = String(fields.jersey_number ?? '').replace(/\D/g, '');
    out.push({
      num: jerseyRaw || '00',
      firstName: firstName || 'Player',
      lastName,
      position: normalizeCourtPosition(String(fields.position || '')),
    });
  }
  return out;
}

const BASKETBALL_NON_GAME_RE =
  /\b(practice|shootaround|open\s*gym|workout|training|clinic|tryout|try-out|meeting|banquet|photo\s*day|walkthrough|walk-through)\b/i;

const MONTH_NAME_TO_NUM: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Given a basketball season label (e.g. '2025-26') and calendar month (1..12),
 * return the inferred calendar year (Aug-Dec -> start year, Jan-Jul -> end year).
 */
export function inferSeasonYearForMonth(season: string | undefined, month1to12: number): number {
  const norm = normalizeSeasonLabel(season);
  const rangeMatch = norm.match(/(\d{4})\s*-\s*(\d{2,4})/);
  if (rangeMatch) {
    const startYear = parseInt(rangeMatch[1], 10);
    const rawEnd = rangeMatch[2];
    const endYear =
      rawEnd.length === 2
        ? Math.floor(startYear / 100) * 100 + parseInt(rawEnd, 10)
        : parseInt(rawEnd, 10);
    return month1to12 >= 8 ? startYear : endYear;
  }
  const singleYear = norm.match(/\b(20\d{2})\b/);
  if (singleYear) return parseInt(singleYear[1], 10);
  return 2026;
}

/**
 * Resolve a raw date string from TeamSnap CSV/text/API into YYYY-MM-DD,
 * using the active season (e.g. '2025-26') when the year is omitted.
 */
export function resolveBasketballEventDate(rawDateStr: string, season?: string): string {
  const clean = String(rawDateStr || '').trim();
  if (!clean) return '';

  // ISO date or datetime: preserve explicit YYYY-MM-DD (including 2025-12-06T10:00:00)
  const isoMatch = clean.match(/(\d{4})-(\d{2})-(\d{2})(?=T|\b)/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // MM/DD/YYYY or MM/DD/YY
  const fullSlash = clean.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (fullSlash) {
    const m = fullSlash[1].padStart(2, '0');
    const d = fullSlash[2].padStart(2, '0');
    const y = fullSlash[3].length === 2 ? `20${fullSlash[3]}` : fullSlash[3];
    return `${y}-${m}-${d}`;
  }

  // Yearless MM/DD
  const shortSlash = clean.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (shortSlash) {
    const mNum = parseInt(shortSlash[1], 10);
    const dNum = parseInt(shortSlash[2], 10);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      const y = inferSeasonYearForMonth(season, mNum);
      return `${y}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    }
  }

  // Month name with optional weekday prefix and optional 4-digit year (e.g. "Sat, Dec 6" or "Nov 15, 2025")
  const textMonth = clean.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*((?:19|20)\d{2}))?\b/i
  );
  if (textMonth) {
    const monthKey = textMonth[1].toLowerCase().replace(/\./g, '');
    const mNum = MONTH_NAME_TO_NUM[monthKey] || MONTH_NAME_TO_NUM[monthKey.slice(0, 3)];
    const dNum = parseInt(textMonth[2], 10);
    if (mNum && dNum >= 1 && dNum <= 31) {
      const y = textMonth[3] ? parseInt(textMonth[3], 10) : inferSeasonYearForMonth(season, mNum);
      return `${y}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    }
  }

  return '';
}

function normalizeBasketballTime(raw: string): string {
  const clean = String(raw || '').trim();
  if (!clean) return '18:00';
  const ampmMatch = clean.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  if (!ampmMatch) return '18:00';
  let h = parseInt(ampmMatch[1], 10);
  const m = ampmMatch[2];
  const ampm = (ampmMatch[3] || '').toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function extractScoresFromText(text: string): { ourScore?: number; opponentScore?: number } {
  const clean = String(text || '');
  if (!clean) return {};

  // "W 48-41", "L 35-42", "T 40-40"
  const prefixMatch = clean.match(/\b([WLT])\s*[:\-]?\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\b/i);
  if (prefixMatch) {
    const code = prefixMatch[1].toUpperCase();
    const a = parseInt(prefixMatch[2], 10);
    const b = parseInt(prefixMatch[3], 10);
    if (code === 'W') return { ourScore: Math.max(a, b), opponentScore: Math.min(a, b) };
    if (code === 'L') return { ourScore: Math.min(a, b), opponentScore: Math.max(a, b) };
    return { ourScore: a, opponentScore: b };
  }

  // "48-41 W", "35-42 L", "48-41 (W)"
  const suffixMatch = clean.match(/\b(\d{1,3})\s*[-–]\s*(\d{1,3})\s*\(?\s*([WLT])\s*\)?\b/i);
  if (suffixMatch) {
    const a = parseInt(suffixMatch[1], 10);
    const b = parseInt(suffixMatch[2], 10);
    const code = suffixMatch[3].toUpperCase();
    if (code === 'W') return { ourScore: Math.max(a, b), opponentScore: Math.min(a, b) };
    if (code === 'L') return { ourScore: Math.min(a, b), opponentScore: Math.max(a, b) };
    return { ourScore: a, opponentScore: b };
  }

  // Explicit "Final: 48-41" or "Score: 48-41"
  const labeledMatch = clean.match(/\b(?:final|score|result)\s*[:\-]?\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\b/i);
  if (labeledMatch) {
    return {
      ourScore: parseInt(labeledMatch[1], 10),
      opponentScore: parseInt(labeledMatch[2], 10),
    };
  }

  return {};
}

const DATE_FRAGMENT_RE =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*(?:19|20)\d{2})?)\b/i;
const TIME_FRAGMENT_RE = /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)(?:\s*(?:EST|EDT|CST|CDT|PST|PDT))?\b/i;

function cleanMatchupLineForOpponent(line: string): {
  opponent?: string;
  locationType: 'home' | 'away' | 'neutral';
  explicitGame: boolean;
} {
  let clean = line
    .replace(/\b[WLT]\s*[:\-]?\s*\d{1,3}\s*[-–]\s*\d{1,3}\b/gi, '')
    .replace(/\b\d{1,3}\s*[-–]\s*\d{1,3}\s*\(?\s*[WLT]\s*\)?\b/gi, '')
    .replace(/\b(?:final|score|result)\s*[:\-]?\s*\d{1,3}\s*[-–]\s*\d{1,3}\b/gi, '')
    .replace(/\b(?:TBD|Cancelled|Canceled|Postponed)\b/gi, '')
    .replace(/^[,\-:\s|]+|[,\-:\s|]+$/g, '')
    .trim();

  if (!clean) return { opponent: undefined, locationType: 'home', explicitGame: false };

  const atIdx = clean.indexOf('@');
  if (atIdx !== -1) {
    const opp = clean.slice(atIdx + 1).trim();
    return { opponent: opp || clean.replace(/@/g, '').trim(), locationType: 'away', explicitGame: true };
  }

  const vsMatch = clean.match(/\b(?:vs\.?|v\.?)\s+(.+)$/i);
  if (vsMatch && vsMatch[1]?.trim()) {
    return { opponent: vsMatch[1].trim(), locationType: 'home', explicitGame: true };
  }

  const atWordMatch = clean.match(/(?:^|\s)at\s+(.+)$/i);
  if (atWordMatch && atWordMatch[1]?.trim() && !BASKETBALL_NON_GAME_RE.test(clean)) {
    return { opponent: atWordMatch[1].trim(), locationType: 'away', explicitGame: true };
  }

  if (/\b(tournament|playoff|championship|jamboree|scrimmage|game)\b/i.test(clean)) {
    return {
      opponent: clean.replace(/^game\s+/i, '').trim() || clean,
      locationType: 'home',
      explicitGame: true,
    };
  }

  return { opponent: clean, locationType: 'home', explicitGame: false };
}

function finalizeScheduleTextBlock(
  date: string,
  segments: string[],
  idx: number
): ParsedTeamSnapEvent {
  const joined = segments.join(' · ');
  const scores = extractScoresFromText(joined);

  let startTime = '18:00';
  for (const seg of segments) {
    const tm = seg.match(TIME_FRAGMENT_RE);
    if (tm) {
      startTime = normalizeBasketballTime(tm[1]);
      break;
    }
  }

  const meaningful: string[] = [];
  let explicitLocation = '';

  for (const rawSeg of segments) {
    let seg = rawSeg
      .replace(TIME_FRAGMENT_RE, '')
      .replace(/\b(?:EST|EDT|CST|CDT|PST|PDT)\b/gi, '')
      .replace(/^[,\-:\s|•]+|[,\-:\s|•]+$/g, '')
      .trim();
    if (!seg) continue;

    if (/^(?:location|venue|gym|field|court)\s*:/i.test(seg)) {
      explicitLocation = seg.replace(/^(?:location|venue|gym|field|court)\s*:/i, '').trim();
      continue;
    }
    if (/^(?:home|away|neutral)$/i.test(seg)) {
      continue;
    }
    // Skip segments that were purely scores like "W 48-41"
    const withoutScoreOnly = seg
      .replace(/\b[WLT]\s*[:\-]?\s*\d{1,3}\s*[-–]\s*\d{1,3}\b/gi, '')
      .replace(/\b\d{1,3}\s*[-–]\s*\d{1,3}\s*\(?\s*[WLT]\s*\)?\b/gi, '')
      .replace(/\b(?:final|score|result)\s*[:\-]?/gi, '')
      .trim();
    if (!withoutScoreOnly) continue;

    meaningful.push(seg);
  }

  let primarySeg =
    meaningful.find((s) => /\b(vs\.?|v\.?|game|tournament|scrimmage|playoff)\b|@/i.test(s)) ||
    meaningful.find((s) => /\bat\s+/i.test(s) && !BASKETBALL_NON_GAME_RE.test(s)) ||
    meaningful[0] ||
    'Team Event';

  const isNonGame = BASKETBALL_NON_GAME_RE.test(joined);
  const matchup = cleanMatchupLineForOpponent(primarySeg);
  const otherSegments = meaningful.filter((s) => s !== primarySeg);
  const location =
    explicitLocation ||
    otherSegments.find((s) => !extractScoresFromText(s).ourScore) ||
    'TBD Gym';

  const hasScore = scores.ourScore !== undefined && scores.opponentScore !== undefined;
  const type: ParsedTeamSnapEvent['type'] = isNonGame
    ? 'practice'
    : /\bscrimmage\b/i.test(joined)
    ? 'scrimmage'
    : matchup.explicitGame || hasScore || Boolean(matchup.opponent)
    ? 'game'
    : 'practice';

  const homeAwayHint = /\baway\b/i.test(joined)
    ? 'away'
    : /\bneutral\b/i.test(joined)
    ? 'neutral'
    : matchup.locationType;

  return {
    id: `ts_bball_${Date.now()}_${idx}`,
    type,
    title: primarySeg,
    date,
    startTime,
    location,
    locationType: homeAwayHint,
    opponent: type === 'practice' ? undefined : matchup.opponent || primarySeg,
    focusOrNotes: hasScore ? `Final ${scores.ourScore}-${scores.opponentScore}` : undefined,
    week: '1',
    raw: hasScore ? { ourScore: scores.ourScore, opponentScore: scores.opponentScore } : undefined,
  };
}

/**
 * Parse iCal, CSV, or pasted TeamSnap Schedule ("Upcoming" or "Past") text into events,
 * inferring missing years from the active season (e.g. Dec -> 2025, Jan -> 2026 for '2025-26').
 */
export function parseBasketballScheduleInput(
  content: string,
  season?: string
): ParsedTeamSnapEvent[] {
  const trimmed = String(content || '').trim();
  if (!trimmed) return [];

  if (trimmed.includes('BEGIN:VCALENDAR') || trimmed.includes('BEGIN:VEVENT')) {
    return parseTeamSnapICS(trimmed).events;
  }

  const lines = trimmed
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // CSV path (comma-separated, with or without header row)
  const firstCommaCols = splitCsvLine(lines[0]);
  const looksLikeCsvHeader =
    /\b(date|time|event|title|opponent|location|type|start|result|score)\b/i.test(lines[0]) &&
    !DATE_FRAGMENT_RE.test(lines[0]);

  if (lines[0].includes(',') && (looksLikeCsvHeader || (lines.length > 1 && firstCommaCols.length >= 3))) {
    if (looksLikeCsvHeader) {
      const headers = firstCommaCols.map((h) => h.toLowerCase().replace(/["']/g, '').trim());
      const findCol = (preds: RegExp[]) => headers.findIndex((h) => preds.some((re) => re.test(h)));
      const dateCol = findCol([/start\s*date/, /\bdate\b/]);
      const timeCol = findCol([/start\s*time/, /\btime\b/]);
      const typeCol = findCol([/\btype\b/, /is\s*game/]);
      const titleCol = findCol([/formatted/, /\bevent\b/, /\btitle\b/, /\bname\b/, /summary/]);
      const oppCol = findCol([/opponent/]);
      const locCol = findCol([/location/, /venue/, /gym/, /field/]);
      const haCol = findCol([/home.*away/, /home_or_away/]);
      const resCol = findCol([/result/, /score/, /final/]);
      const pfCol = findCol([/points?\s*for/, /our\s*score/, /^pf$/]);
      const paCol = findCol([/points?\s*against/, /opp.*score/, /^pa$/]);
      const notesCol = findCol([/note/, /description/, /detail/]);

      const out: ParsedTeamSnapEvent[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        if (cols.length === 0) continue;
        const rawDate = dateCol !== -1 ? cols[dateCol] : cols[0];
        const resolvedDate = resolveBasketballEventDate(rawDate || '', season);
        if (!resolvedDate) continue;

        const rawTime = timeCol !== -1 ? cols[timeCol] : '';
        const rawTitle = titleCol !== -1 ? cols[titleCol] : cols[1] || '';
        const rawOpp = oppCol !== -1 ? cols[oppCol] : '';
        const rawType = typeCol !== -1 ? cols[typeCol] : '';
        const rawLoc = locCol !== -1 ? cols[locCol] : '';
        const rawHa = haCol !== -1 ? cols[haCol] : '';
        const rawRes = resCol !== -1 ? cols[resCol] : '';
        const rawNotes = notesCol !== -1 ? cols[notesCol] : '';

        const combinedText = `${rawTitle} ${rawType} ${rawOpp} ${rawRes} ${rawNotes}`;
        const scoreParsed = extractScoresFromText(`${rawRes} ${rawTitle} ${rawNotes}`);
        let ourScore = scoreParsed.ourScore;
        let opponentScore = scoreParsed.opponentScore;
        if (ourScore === undefined && pfCol !== -1 && paCol !== -1) {
          const pf = parseInt(cols[pfCol] || '', 10);
          const pa = parseInt(cols[paCol] || '', 10);
          if (!Number.isNaN(pf) && !Number.isNaN(pa)) {
            ourScore = pf;
            opponentScore = pa;
          }
        }

        const matchup = cleanMatchupLineForOpponent(rawOpp || rawTitle || rawRes);
        const isExplicitNonGame =
          BASKETBALL_NON_GAME_RE.test(`${rawType} ${rawTitle}`) && !rawOpp && rawType.toLowerCase() !== 'game';
        const hasScore = ourScore !== undefined && opponentScore !== undefined;
        const isGame =
          !isExplicitNonGame &&
          (rawType.toLowerCase() === 'game' ||
            rawType.toLowerCase() === 'true' ||
            /\b(game|tournament|playoff|championship)\b/i.test(combinedText) ||
            Boolean(rawOpp) ||
            matchup.explicitGame ||
            hasScore);

        const locationType: 'home' | 'away' | 'neutral' = /\baway\b/i.test(`${rawHa} ${rawLoc}`)
          ? 'away'
          : /\bneutral\b/i.test(rawHa)
          ? 'neutral'
          : matchup.locationType;

        out.push({
          id: `ts_csv_${Date.now()}_${i}`,
          type: /\bscrimmage\b/i.test(combinedText) ? 'scrimmage' : isGame ? 'game' : 'practice',
          title: rawTitle || (rawOpp ? `vs ${rawOpp}` : 'Event'),
          date: resolvedDate,
          startTime: normalizeBasketballTime(rawTime),
          location: rawLoc || 'TBD Gym',
          locationType,
          opponent: rawOpp || matchup.opponent || rawTitle || 'TBD Opponent',
          focusOrNotes: rawNotes || (hasScore ? `Final ${ourScore}-${opponentScore}` : undefined),
          week: '1',
          raw: hasScore ? { ourScore, opponentScore } : undefined,
        });
      }
      if (out.length > 0) return out;
    }

    // Fallback to shared CSV parser when structure is generic, fixing yearless dates
    const csvRes = parseTeamSnapCSV(trimmed);
    if (csvRes.events.length > 0) {
      return csvRes.events.map((ev) => ({
        ...ev,
        date: resolveBasketballEventDate(ev.date, season) || ev.date,
      }));
    }
  }

  // Freeform / tab-separated / multi-line TeamSnap Web UI ("Schedule -> Past" or copy-pasted table)
  const blocks: { date: string; segments: string[] }[] = [];
  let currentBlock: { date: string; segments: string[] } | null = null;

  for (const line of lines) {
    // Skip column header lines copied from TeamSnap table
    if (/^(?:date|time|event|opponent|location|result|past\s*events?|upcoming\s*events?)[\s\t,|/]*$/i.test(line)) {
      continue;
    }
    if (line.includes('\t') && /^(?:date|time|event|location|result)\b/i.test(line) && !DATE_FRAGMENT_RE.test(line)) {
      continue;
    }

    const dateMatch = line.match(DATE_FRAGMENT_RE);
    if (dateMatch) {
      const resolved = resolveBasketballEventDate(dateMatch[0], season);
      if (resolved) {
        if (currentBlock) blocks.push(currentBlock);
        const parts = line.includes('\t')
          ? line
              .split('\t')
              .map((p) => p.replace(DATE_FRAGMENT_RE, '').trim())
              .filter(Boolean)
          : [
              line
                .replace(DATE_FRAGMENT_RE, '')
                .replace(/^(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?[,\s\-]*/i, '')
                .replace(/^[,\-:\s|•]+|[,\-:\s|•]+$/g, '')
                .trim(),
            ].filter(Boolean);

        currentBlock = { date: resolved, segments: parts };
        continue;
      }
    }

    if (currentBlock) {
      if (line.includes('\t')) {
        currentBlock.segments.push(
          ...line
            .split('\t')
            .map((p) => p.trim())
            .filter(Boolean)
        );
      } else {
        currentBlock.segments.push(line);
      }
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  if (blocks.length > 0) {
    return blocks.map((b, i) => finalizeScheduleTextBlock(b.date, b.segments, i));
  }

  // Final fallback to shared parseTeamSnapText
  const txtRes = parseTeamSnapText(trimmed);
  return txtRes.events.map((ev) => ({
    ...ev,
    date: resolveBasketballEventDate(ev.date, season) || ev.date,
  }));
}

/** Parse a TeamSnap API v3 Collection+JSON `/v3/events/search` (or plain array) payload into events. */
export function parseTeamSnapApiEventsJson(payload: any, season?: string): ParsedTeamSnapEvent[] {
  const out: ParsedTeamSnapEvent[] = [];
  const items: any[] = Array.isArray(payload?.collection?.items)
    ? payload.collection.items
    : Array.isArray(payload)
    ? payload
    : [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fields: Record<string, any> = {};
    if (Array.isArray(item?.data)) {
      for (const datum of item.data) {
        if (datum?.name) fields[String(datum.name)] = datum.value;
      }
    } else if (item && typeof item === 'object') {
      Object.assign(fields, item);
    }

    const startRaw = String(fields.start_date || fields.date || '').trim();
    if (!startRaw) continue;

    let dateStr = '';
    let timeStr = '18:00';
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startRaw) && (startRaw.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(startRaw))) {
      const dt = new Date(startRaw);
      if (!Number.isNaN(dt.getTime())) {
        dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      }
    }
    if (!dateStr) {
      dateStr = resolveBasketballEventDate(startRaw, season);
      const tMatch = startRaw.match(/T(\d{2}:\d{2})/);
      if (tMatch) timeStr = tMatch[1];
    }
    if (!dateStr) continue;

    const formattedTitle = String(
      fields.formatted_title || fields.formatted_title_for_multi_team || fields.name || fields.title || ''
    ).trim();
    const oppName = String(fields.opponent_name || '').trim();
    const gameType = String(fields.game_type || '').trim();
    const isGameFlag = fields.is_game === true || fields.is_game === 'true';
    const notes = String(fields.notes || '').trim();
    const formattedResults = String(fields.formatted_results || '').trim();
    const combinedLabel = `${formattedTitle} ${gameType} ${notes}`.trim();

    const isPractice = !isGameFlag && BASKETBALL_NON_GAME_RE.test(combinedLabel);
    const type: ParsedTeamSnapEvent['type'] = isPractice
      ? 'practice'
      : gameType.toLowerCase().includes('scrimmage') || /\bscrimmage\b/i.test(combinedLabel)
      ? 'scrimmage'
      : isGameFlag || Boolean(oppName) || /\b(vs\.?|v\.?|game|tournament|playoff)\b|@/i.test(combinedLabel)
      ? 'game'
      : 'practice';

    const homeOrAwayRaw = String(fields.home_or_away || '').toLowerCase();
    const isHomeExplicit = fields.is_home === true || fields.is_home === 'true' || homeOrAwayRaw === 'home';
    const isAwayExplicit =
      fields.is_home === false ||
      fields.is_home === 'false' ||
      homeOrAwayRaw === 'away' ||
      formattedTitle.includes('@');
    const locationType: 'home' | 'away' | 'neutral' =
      homeOrAwayRaw === 'neutral'
        ? 'neutral'
        : isAwayExplicit && !isHomeExplicit
        ? 'away'
        : 'home';

    const extractedScores = extractScoresFromText(`${formattedResults} ${formattedTitle}`);
    let ourScore =
      fields.points_for_team !== null && fields.points_for_team !== undefined && fields.points_for_team !== ''
        ? Number(fields.points_for_team)
        : extractedScores.ourScore;
    let opponentScore =
      fields.points_for_opponent !== null && fields.points_for_opponent !== undefined && fields.points_for_opponent !== ''
        ? Number(fields.points_for_opponent)
        : extractedScores.opponentScore;
    if (Number.isNaN(ourScore)) ourScore = undefined;
    if (Number.isNaN(opponentScore)) opponentScore = undefined;

    const matchup = cleanMatchupLineForOpponent(oppName || formattedTitle);
    const hasScore = ourScore !== undefined && opponentScore !== undefined;

    out.push({
      id: `ts_api_${fields.id ?? i}`,
      type,
      title: formattedTitle || (oppName ? `vs ${oppName}` : 'Team Event'),
      date: dateStr,
      startTime: timeStr,
      location: String(fields.location_name || fields.additional_location_details || '').trim() || 'TBD Gym',
      locationType,
      opponent: oppName || matchup.opponent || formattedTitle || 'TBD Opponent',
      focusOrNotes: notes || (formattedResults || (hasScore ? `Final ${ourScore}-${opponentScore}` : undefined)),
      week: '1',
      raw: hasScore ? { ourScore, opponentScore } : undefined,
    });
  }

  return out;
}

/** Return true when a parsed TeamSnap event represents a game, scrimmage, or tournament (not a practice/meeting). */
export function isBasketballGameEvent(ev: ParsedTeamSnapEvent): boolean {
  const text = `${ev.title || ''} ${ev.focusOrNotes || ''}`.toLowerCase();
  if (BASKETBALL_NON_GAME_RE.test(text)) {
    return false;
  }
  return ev.type === 'game' || ev.type === 'tournament' || ev.type === 'scrimmage';
}

/** Filter parsed TeamSnap events consistently for both schedule preview and game import. */
export function filterBasketballScheduleEvents(
  events: ParsedTeamSnapEvent[],
  gamesOnly: boolean = true
): ParsedTeamSnapEvent[] {
  if (!gamesOnly) return events;
  const explicitGames = events.filter(isBasketballGameEvent);
  if (explicitGames.length > 0) return explicitGames;
  return events
    .filter((ev) => !BASKETBALL_NON_GAME_RE.test(`${ev.title || ''} ${ev.focusOrNotes || ''}`))
    .map((ev) => (ev.type === 'practice' ? { ...ev, type: 'game' as const } : ev));
}

/** Convert parsed TeamSnap iCal/CSV/API events into Court Studio schedule games. */
export function convertTeamSnapEventsToBasketballGames(
  events: ParsedTeamSnapEvent[],
  existingGames: BasketballGame[],
  mode: 'replace' | 'append',
  options?: { gamesOnly?: boolean; season?: string }
): BasketballGame[] {
  const gamesOnly = options?.gamesOnly ?? true;
  const sourceEvents = filterBasketballScheduleEvents(events, gamesOnly);

  const existingKeys = new Set(
    (mode === 'append' ? existingGames : []).map(
      (g) => `${g.date}|${g.time}|${g.opponent.toLowerCase().trim()}`
    )
  );
  let gameCounter =
    mode === 'append'
      ? existingGames.filter((g) => g.eventType === 'Game').length
      : 0;

  const additions: BasketballGame[] = [];
  const stamp = Date.now();

  for (let i = 0; i < sourceEvents.length; i++) {
    const ev = sourceEvents[i];
    const titleLower = `${ev.title || ''} ${ev.focusOrNotes || ''}`.toLowerCase();
    const eventType: BasketballGame['eventType'] =
      ev.type === 'game'
        ? titleLower.includes('tournament')
          ? 'Tournament'
          : 'Game'
        : ev.type === 'scrimmage'
        ? 'Scrimmage'
        : titleLower.includes('tournament')
        ? 'Tournament'
        : 'Practice';

    const homeAway: BasketballGame['homeAway'] =
      ev.locationType === 'away' ? 'Away' : ev.locationType === 'neutral' ? 'Neutral' : 'Home';
    const opponent =
      eventType === 'Game' || eventType === 'Scrimmage'
        ? (ev.opponent || ev.title || 'TBD Opponent').trim()
        : (ev.title || ev.opponent || 'Team Practice').trim();

    const dedupeKey = `${ev.date}|${ev.startTime || '18:00'}|${opponent.toLowerCase().trim()}`;
    if (existingKeys.has(dedupeKey)) continue;
    existingKeys.add(dedupeKey);

    let weekLabel: string = eventType;
    if (eventType === 'Game') {
      gameCounter += 1;
      weekLabel = `Game ${gameCounter}`;
    }

    const textScores = extractScoresFromText(`${ev.title || ''} ${ev.focusOrNotes || ''}`);
    const ourScore =
      typeof ev.raw?.ourScore === 'number' ? ev.raw.ourScore : textScores.ourScore;
    const opponentScore =
      typeof ev.raw?.opponentScore === 'number' ? ev.raw.opponentScore : textScores.opponentScore;

    additions.push({
      id: `bball-ts-${stamp}-${i + 1}`,
      weekLabel,
      date: ev.date,
      time: ev.startTime || '18:00',
      opponent,
      location: ev.location || 'TBD Gym',
      homeAway,
      eventType,
      ...(ourScore !== undefined && opponentScore !== undefined
        ? { ourScore, opponentScore }
        : {}),
      scoutingNotes: ev.focusOrNotes || undefined,
      possessions: [],
    });
  }

  return mode === 'replace' ? additions : [...existingGames, ...additions];
}

/** Format video seconds (e.g. 135.4) into M:SS (e.g. "2:15"). */
export function formatVideoTimestamp(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const DEFAULT_POINTS_BY_RESULT: Record<PossessionResult, 0 | 1 | 2 | 3 | 4> = {
  '2pt_make': 2,
  '2pt_miss': 0,
  '3pt_make': 3,
  '3pt_miss': 0,
  and_1: 3,
  ft_trip: 2,
  turnover: 0,
  foul_drawn: 0,
  def_stop: 0,
  def_steal: 0,
  def_block: 0,
  def_reb: 0,
};

export interface TimestampedPossessionInput {
  existingPossessions: BasketballPossession[];
  period: 1 | 2 | 3 | 4 | 5;
  teamSide: 'us' | 'opponent';
  result: PossessionResult;
  points?: 0 | 1 | 2 | 3 | 4;
  phase?: PossessionPhase;
  setCall?: string;
  defenseFaced?: DefenseType;
  shotZone?: ShotZone;
  playerTag?: string;
  assisterTag?: string;
  rebounderTag?: string;
  defenderTag?: string;
  reboundType?: 'off' | 'def';
  videoClipName?: string;
  videoClipIndex?: number;
  videoTimeSec?: number;
  clock?: string;
  notes?: string;
  isHighlight?: boolean;
}

/**
 * Create a new BasketballPossession anchored to the active video file and timestamp,
 * routing player attribution automatically by stat/outcome type.
 */
export function createTimestampedPossession(input: TimestampedPossessionInput): BasketballPossession {
  const existing = input.existingPossessions || [];
  const playNumber = existing.reduce((max, p) => Math.max(max, Number(p.playNumber) || 0), 0) + 1;
  const cleanPlayer = input.playerTag?.trim() || undefined;
  const cleanAssister = input.assisterTag?.trim() || undefined;
  const explicitRebounder = input.rebounderTag?.trim() || undefined;
  const explicitDefender = input.defenderTag?.trim() || undefined;

  let shooter: string | undefined;
  let rebounder = explicitRebounder;
  let defender = explicitDefender;

  if (input.result === 'def_reb') {
    rebounder = rebounder || cleanPlayer;
  } else if (input.result === 'def_steal' || input.result === 'def_block') {
    defender = defender || cleanPlayer;
  } else {
    shooter = cleanPlayer;
  }

  const videoTimeSec =
    typeof input.videoTimeSec === 'number' && Number.isFinite(input.videoTimeSec)
      ? Math.max(0, Math.round(input.videoTimeSec * 10) / 10)
      : undefined;

  const isDefenseEvent =
    input.result === 'def_steal' ||
    input.result === 'def_block' ||
    input.result === 'def_stop' ||
    input.result === 'def_reb';

  const now = Date.now();
  return {
    id: `pos-${now}-${playNumber}`,
    playNumber,
    period: input.period,
    clock: input.clock?.trim() || (videoTimeSec !== undefined ? formatVideoTimestamp(videoTimeSec) : undefined),
    teamSide: input.teamSide,
    phase: input.phase || (isDefenseEvent ? 'defense' : 'half_court'),
    setCall: input.setCall?.trim() || (isDefenseEvent ? 'Defense / Live Tag' : 'Live Action'),
    defenseFaced: input.defenseFaced || 'man',
    result: input.result,
    points: input.points !== undefined ? input.points : DEFAULT_POINTS_BY_RESULT[input.result],
    ...(input.shotZone ? { shotZone: input.shotZone } : {}),
    ...(shooter ? { shooter } : {}),
    ...(cleanAssister ? { assister: cleanAssister } : {}),
    ...(rebounder ? { rebounder } : {}),
    ...(input.result === 'def_reb' || input.reboundType ? { reboundType: input.reboundType || 'def' } : {}),
    ...(defender ? { defender } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.isHighlight ? { isHighlight: true } : {}),
    ...(input.videoClipName ? { videoClipName: input.videoClipName } : {}),
    ...(typeof input.videoClipIndex === 'number' ? { videoClipIndex: input.videoClipIndex } : {}),
    ...(videoTimeSec !== undefined ? { videoTimeSec } : {}),
    editedAt: now,
  };
}

/**
 * Resolve which segment clip index and seek timestamp (minus optional replay lead-in)
 * corresponds to a possession across a multi-file game video.
 */
export function resolvePossessionVideoTarget(
  possession: BasketballPossession,
  clips: { name: string }[],
  leadInSec: number = 0
): { clipIndex: number; seekSec: number } | null {
  if (!Array.isArray(clips) || clips.length === 0) return null;

  let clipIndex = -1;
  if (possession.videoClipName) {
    const needle = possession.videoClipName.trim().toLowerCase();
    clipIndex = clips.findIndex((c) => c.name.trim().toLowerCase() === needle);
  }
  if (
    clipIndex < 0 &&
    typeof possession.videoClipIndex === 'number' &&
    Number.isInteger(possession.videoClipIndex) &&
    possession.videoClipIndex >= 0 &&
    possession.videoClipIndex < clips.length
  ) {
    clipIndex = possession.videoClipIndex;
  }
  if (clipIndex < 0 && clips.length === 1) {
    clipIndex = 0;
  }
  if (clipIndex < 0) {
    clipIndex = Math.min(clips.length - 1, Math.max(0, (Number(possession.playNumber) || 1) - 1));
  }

  const seekSec =
    typeof possession.videoTimeSec === 'number' && Number.isFinite(possession.videoTimeSec)
      ? Math.max(0, Math.round((possession.videoTimeSec - Math.max(0, leadInSec)) * 10) / 10)
      : 0;

  return { clipIndex, seekSec };
}

/**
 * Determine the next teamSide after a live-tagged event when autoFlipSide is enabled.
 * Offensive rebounds, shot misses (awaiting rebound), blocks, and fouls drawn keep possession;
 * makes, turnovers, defensive rebounds, steals, and stops flip possession.
 */
export function nextPossessionSideAfterEvent(
  currentSide: 'us' | 'opponent',
  result: PossessionResult,
  reboundType?: 'off' | 'def',
  autoFlip: boolean = false
): 'us' | 'opponent' {
  if (!autoFlip) return currentSide;
  if (result === 'def_reb' && reboundType === 'off') return currentSide;
  if (result === '2pt_miss' || result === '3pt_miss' || result === 'foul_drawn' || result === 'def_block') {
    return currentSide;
  }
  return currentSide === 'us' ? 'opponent' : 'us';
}

/** Determine whether a visitor may enter the Court Studio workspace or must see the sign-in / pending gate. */
export function canAccessBasketballWorkspace(
  email: string | null | undefined,
  staff: BasketballStaffMember[]
): { status: 'unauthenticated' | 'pending' | 'approved'; role?: BasketballStaffMember['role'] } {
  if (!email || !String(email).trim()) {
    return { status: 'unauthenticated' };
  }
  const clean = String(email).toLowerCase().trim();
  if (isProgramAdminEmail(clean)) {
    return { status: 'approved', role: 'Admin' };
  }
  const member = (staff || []).find((m) => m.email.toLowerCase().trim() === clean);
  if (!member || member.status !== 'Active') {
    return { status: 'pending' };
  }
  return { status: 'approved', role: member.role };
}
