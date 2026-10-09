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

/** Staff & access: for coaches only (a player or family account never gets it). */
export const STAFF_TAB_OPTION: PlayerTabOption = { id: 'users', label: 'Staff & access', units: ['users'] };
/** The tabs a coach account can be given (everything a player can, plus Staff & access). */
export const COACH_TAB_OPTIONS: PlayerTabOption[] = [...PLAYER_TAB_OPTIONS, STAFF_TAB_OPTION];

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
/** The tabs a view-only account sees: what a coach picked, else the Film Room for a family, the defaults for a player. */
export const viewerTabs = (entry?: { role?: string; playerTabs?: string[] }) =>
  Array.isArray(entry?.playerTabs) ? entry!.playerTabs : isFamilyRole(entry?.role) ? FAMILY_TABS : DEFAULT_PLAYER_TABS;

/**
 * The tabs an account sees (`playerTabs` on its staff entry, for every kind of account): undefined means
 * all of them (a coach nobody limited). Players and families never see Staff & access.
 */
export function accountTabs(entry?: { role?: string; playerTabs?: string[] } | null): string[] | undefined {
  if (!entry) return undefined;
  if (isViewOnlyRole(entry.role)) return viewerTabs(entry).filter((t) => t !== STAFF_TAB_OPTION.id);
  return Array.isArray(entry.playerTabs) ? entry.playerTabs : undefined;
}
/** The tab choices for an account of this role. */
export const tabOptionsFor = (role?: string) => (isViewOnlyRole(role) ? PLAYER_TAB_OPTIONS : COACH_TAB_OPTIONS);
/** What an account of this role starts with: undefined = all tabs (a coach). */
export const defaultTabsFor = (role?: string): string[] | undefined =>
  isFamilyRole(role) ? [...FAMILY_TABS] : isPlayerRole(role) ? [...DEFAULT_PLAYER_TABS] : undefined;

/** The tabs a player account sees (the defaults when a coach hasn't picked yet). */
export const playerTabsOf = (tabs?: string[]) => (Array.isArray(tabs) ? tabs : DEFAULT_PLAYER_TABS);

/** Whether a player with these tabs may open a screen. */
export function playerCanSee(tabs: string[] | undefined, unit: UnitType): boolean {
  const on = new Set(playerTabsOf(tabs));
  return COACH_TAB_OPTIONS.some((o) => on.has(o.id) && o.units.includes(unit));
}

/** The first screen a player may open (in the order of the tabs), or null when they have none. */
export function firstPlayerScreen(tabs: string[] | undefined): UnitType | null {
  const on = new Set(playerTabsOf(tabs));
  return COACH_TAB_OPTIONS.find((o) => on.has(o.id))?.units[0] ?? null;
}
