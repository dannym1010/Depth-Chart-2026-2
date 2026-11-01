// Post-season games typed in from the league's own schedule when its file can't be read. 2026 semi-finals: the
// league's PDF link answered "Access Denied", so these come from the picture on its home page slideshow
// ("2026 Semi-Finals Schedule"). Its colors are the round: blue a TYF playoff semi-final, orange an Orange Bowl
// semi-final, black a friendship game. Team and field names as the season schedule writes them ("SD" is
// "S Dutchess", "JJEF HS" is "John Jay EF HS", "RCK HS" is "Roy C Ketcham HS").
import type { LeagueGame } from '../utils/leagueParse';

export const SEMI_FINAL = 'Semi-final';
export const OB_SEMI_FINAL = 'Orange Bowl semi-final';
export const FRIENDSHIP = 'Friendship game';

const game = (week: string, level: string, time: string, away: string, home: string, location: string): LeagueGame => ({
  week,
  date: '11/1/26',
  level,
  home,
  away,
  location,
  time,
});

export const KNOWN_POSTSEASON: LeagueGame[] = [
  // Brewster (Brewster HS)
  game(FRIENDSHIP, '9U', '11:00 AM', 'Suffern', 'Brewster', 'Brewster HS'),
  game(OB_SEMI_FINAL, '12U', '1:00 PM', 'MHV', 'Brewster', 'Brewster HS'),
  // Carmel (Carmel HS)
  game(SEMI_FINAL, '9U', '3:00 PM', 'MW', 'Carmel', 'Carmel HS'),
  game(SEMI_FINAL, '11U', '5:00 PM', 'MW', 'Carmel', 'Carmel HS'),
  // N Rockland (Haverstraw Sports Complex)
  game(FRIENDSHIP, '11U', '9:00 AM', 'Orangetown', 'N Rockland', 'Haverstraw Sports Complex'),
  game(FRIENDSHIP, '9U', '11:00 AM', 'Mahopac', 'N Rockland', 'Haverstraw Sports Complex'),
  game(SEMI_FINAL, '10U', '1:00 PM', 'Carmel', 'N Rockland', 'Haverstraw Sports Complex'),
  // Shrub Oak (Lakeland HS)
  game(OB_SEMI_FINAL, '12U', '9:00 AM', 'Mahopac', 'Shrub Oak', 'Lakeland HS'),
  game(OB_SEMI_FINAL, '9U', '11:00 AM', 'MHV', 'Shrub Oak', 'Lakeland HS'),
  game(SEMI_FINAL, '10U', '1:00 PM', 'MHV', 'Mahopac', 'Lakeland HS'),
  // Somers (Somers HS)
  game(OB_SEMI_FINAL, '9U', '9:00 AM', 'Beacon', 'Somers', 'Somers HS'),
  game(OB_SEMI_FINAL, '10U', '11:00 AM', 'Wappingers', 'Somers', 'Somers HS'),
  game(SEMI_FINAL, '12U', '1:00 PM', 'N Rockland', 'Somers', 'Somers HS'),
  // S Dutchess (John Jay EF HS)
  game(SEMI_FINAL, '9U', '9:00 AM', 'Yorktown', 'S Dutchess', 'John Jay EF HS'),
  game(OB_SEMI_FINAL, '10U', '11:00 AM', 'Brewster', 'S Dutchess', 'John Jay EF HS'),
  game(SEMI_FINAL, '11U', '1:00 PM', 'Brewster', 'S Dutchess', 'John Jay EF HS'),
  game(SEMI_FINAL, '12U', '3:00 PM', 'Carmel', 'S Dutchess', 'John Jay EF HS'),
  // Suffern (Suffern MS)
  game(FRIENDSHIP, '10U', '11:00 AM', 'Yorktown', 'Suffern', 'Suffern MS'),
  game(OB_SEMI_FINAL, '11U', '1:00 PM', 'Mahopac', 'Suffern', 'Suffern MS'),
  // Wappingers (Roy C Ketcham HS)
  game(OB_SEMI_FINAL, '11U', '12:00 PM', 'Somers', 'Wappingers', 'Roy C Ketcham HS'),
];

/** The league's post-season games: the typed-in ones, plus any read from its files on other days. */
export function withKnownPostseason(parsed: LeagueGame[] = []): LeagueGame[] {
  const dates = new Set(KNOWN_POSTSEASON.map((g) => g.date));
  return [...KNOWN_POSTSEASON, ...parsed.filter((g) => !dates.has(g.date))];
}
