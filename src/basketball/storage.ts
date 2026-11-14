import type { ScoutBundle } from '../hudlScout/scoutBundle';
import type { Play } from '../hudlScout/types/football';
import { cleanFirestoreData, getFirebaseServices, isFirestoreQuotaPaused, parseCSV, safeJSONParse, safeJSONSet } from '../services/storageService';
import type {
  BasketballGame,
  BasketballPlayer,
  BasketballPossession,
  BasketballState,
  DefenseType,
  PossessionPhase,
  PossessionResult,
  ShotZone,
} from './types';

const STORAGE_KEY = 'bball_studio_v1_state';
const CLOUD_COLLECTION = 'bballStudio';

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

export const DEFAULT_BASKETBALL_STATE: BasketballState = {
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
    { id: 'st-1', name: 'Coach Danny', email: 'dannym1010@gmail.com', role: 'Admin', teamIds: ['bball-10u-boys', 'bball-12u-gold'], linkedPlayerNums: [] },
    { id: 'st-2', name: 'Assistant Coach Mike', email: 'coach.mike@mahopachoops.org', role: 'Coach', teamIds: ['bball-10u-boys'], linkedPlayerNums: [] },
    { id: 'st-3', name: 'Brennan Family', email: 'brennan.family@gmail.com', role: 'Family', teamIds: ['bball-10u-boys'], linkedPlayerNums: ['5'], allowedTabs: ['schedule', 'highlights'], highlightAccess: 'kid' },
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
      roster: SAMPLE_ROSTER_10U.slice(0, 6),
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

export function loadBasketballState(): BasketballState {
  const saved = safeJSONParse<BasketballState | null>(STORAGE_KEY, null);
  if (!saved || !Array.isArray(saved.teams) || saved.teams.length === 0) {
    return DEFAULT_BASKETBALL_STATE;
  }
  return {
    ...DEFAULT_BASKETBALL_STATE,
    ...saved,
    teamData: {
      ...DEFAULT_BASKETBALL_STATE.teamData,
      ...(saved.teamData || {}),
    },
  };
}

export function saveBasketballState(state: BasketballState): void {
  safeJSONSet(STORAGE_KEY, state);
  try {
    const { db } = getFirebaseServices();
    if (db && !isFirestoreQuotaPaused()) {
      const payload = cleanFirestoreData({ ...state, updatedAt: Date.now() });
      db.collection(CLOUD_COLLECTION).doc('programState').set(payload, { merge: true }).catch(() => undefined);
    }
  } catch {
    /* local save already complete */
  }
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
