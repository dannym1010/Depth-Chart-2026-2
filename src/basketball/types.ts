export type BasketballTab = 'schedule' | 'filmroom' | 'scout' | 'highlights' | 'users';

export type CourtPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type ShotZone =
  | 'rim'
  | 'paint'
  | 'mid_left'
  | 'mid_center'
  | 'mid_right'
  | 'corner_3_left'
  | 'corner_3_right'
  | 'wing_3_left'
  | 'top_3'
  | 'wing_3_right';

export type PossessionPhase =
  | 'half_court'
  | 'transition'
  | 'blob'
  | 'slob'
  | 'press_break'
  | 'defense';

export type DefenseType = 'man' | 'zone_2_3' | 'zone_3_2' | 'zone_1_3_1' | 'press' | 'matchup';

export type PossessionResult =
  | '2pt_make'
  | '2pt_miss'
  | '3pt_make'
  | '3pt_miss'
  | 'and_1'
  | 'ft_trip'
  | 'turnover'
  | 'foul_drawn'
  | 'def_stop'
  | 'def_steal'
  | 'def_block'
  | 'def_reb';

export interface BasketballPossession {
  id: string;
  playNumber: number;
  period: 1 | 2 | 3 | 4 | 5; // 5 = OT
  clock?: string;
  teamSide: 'us' | 'opponent';
  phase: PossessionPhase;
  setCall: string;
  defenseFaced: DefenseType;
  result: PossessionResult;
  points: 0 | 1 | 2 | 3 | 4;
  shotZone?: ShotZone;
  shooter?: string;
  assister?: string;
  rebounder?: string;
  defender?: string;
  notes?: string;
  isHighlight?: boolean;
  editedAt?: number;
}

export interface BasketballOpponentTendencies {
  pace?: string;
  primaryDefense?: string;
  keyPlayers?: string[];
  gamePlanBullets?: string[];
}

export interface BasketballGame {
  id: string;
  weekLabel: string;
  date: string; // YYYY-MM-DD
  time: string;
  opponent: string;
  location: string;
  homeAway: 'Home' | 'Away' | 'Neutral';
  eventType: 'Game' | 'Practice' | 'Scrimmage' | 'Tournament';
  ourScore?: number;
  opponentScore?: number;
  possessions: BasketballPossession[];
  scoutingNotes?: string;
  opponentTendencies?: BasketballOpponentTendencies;
}

export interface BasketballPlayer {
  id: string;
  num: string;
  firstName: string;
  lastName: string;
  position: CourtPosition;
  height?: string;
  grade?: string;
  tags?: string[];
}

export interface BasketballTeam {
  id: string;
  name: string;
  season: string;
  accentColor: string;
  calendarUrl?: string;
}

export interface BasketballStaffMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Coach' | 'Player' | 'Family';
  status?: 'Active' | 'Pending';
  defaultSport?: 'basketball' | 'football';
  teamIds: string[];
  linkedPlayerNums: string[];
  allowedTabs?: BasketballTab[];
  highlightAccess?: 'kid' | 'all' | 'helper';
}

export interface BasketballTeamData {
  roster: BasketballPlayer[];
  games: BasketballGame[];
  customSets: string[];
}

export interface BasketballState {
  teams: BasketballTeam[];
  activeTeamId: string;
  activeGameIdByTeam: Record<string, string>;
  teamData: Record<string, BasketballTeamData>;
  staff: BasketballStaffMember[];
  darkMode: boolean;
  updatedAt?: number;
}
