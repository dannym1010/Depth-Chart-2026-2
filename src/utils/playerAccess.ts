// Player accounts: a player (or parent) signs in with Google like a coach, but sees only the tabs a coach
// picked for them, and can only look (nothing they do is saved). Each choice here is one tab in the app's
// navigation and the screens that belong to it.
import type { UnitType } from '../types';

export interface PlayerTabOption {
  id: string;
  label: string;
  units: UnitType[];
}

export const PLAYER_TAB_OPTIONS: PlayerTabOption[] = [
  { id: 'home', label: 'Home', units: ['home'] },
  { id: 'schedule', label: 'Schedule', units: ['schedule'] },
  { id: 'depth_chart', label: 'Depth chart', units: ['depth_chart', 'offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'] },
  { id: 'playbook', label: 'Plays', units: ['playbook', 'guide'] },
  { id: 'call_sheet', label: 'Call sheet & wristband', units: ['call_sheet', 'wristband', 'game_day'] },
  { id: 'filmroom', label: 'Film Room', units: ['filmroom'] },
  { id: 'hudl_scout', label: 'Hudl Scout', units: ['hudl_scout', 'ppr', 'scouting', 'tendencies', 'html_tendencies'] },
  { id: 'practice', label: 'Practice', units: ['practice'] },
  { id: 'whiteboard', label: 'Drills', units: ['whiteboard', 'drills'] },
  { id: 'compliance', label: 'Hours', units: ['compliance'] },
  { id: 'mobile_hub', label: 'Phone hub', units: ['mobile_hub'] },
];

/** What a new player account sees until a coach changes it. */
export const DEFAULT_PLAYER_TABS = ['home', 'schedule', 'depth_chart', 'playbook'];

export const PLAYER_ROLE = 'Player';
export const isPlayerRole = (role?: string) => /\bplayer\b/i.test(String(role || ''));

/**
 * Family accounts: a player's family watches our games in the Film Room, and that's all. Nothing they do is
 * saved, and they don't see coaches' notes, drawings, breakdowns or the scouting film.
 */
export const FAMILY_ROLE = 'Family';
export const isFamilyRole = (role?: string) => /\bfamily\b/i.test(String(role || ''));
export const FAMILY_TABS = ['filmroom'];
/** A view-only account: a player or a family member. */
export const isViewOnlyRole = (role?: string) => isPlayerRole(role) || isFamilyRole(role);
/** The tabs a view-only account sees: a family account only the Film Room, a player what a coach picked. */
export const viewerTabs = (entry?: { role?: string; playerTabs?: string[] }) => (isFamilyRole(entry?.role) ? FAMILY_TABS : entry?.playerTabs);

/** The tabs a player account sees (the defaults when a coach hasn't picked yet). */
export const playerTabsOf = (tabs?: string[]) => (Array.isArray(tabs) ? tabs : DEFAULT_PLAYER_TABS);

/** Whether a player with these tabs may open a screen. */
export function playerCanSee(tabs: string[] | undefined, unit: UnitType): boolean {
  const on = new Set(playerTabsOf(tabs));
  return PLAYER_TAB_OPTIONS.some((o) => on.has(o.id) && o.units.includes(unit));
}

/** The first screen a player may open (in the order of the tabs), or null when they have none. */
export function firstPlayerScreen(tabs: string[] | undefined): UnitType | null {
  const on = new Set(playerTabsOf(tabs));
  return PLAYER_TAB_OPTIONS.find((o) => on.has(o.id))?.units[0] ?? null;
}
