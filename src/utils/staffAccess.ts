// Who can do what:
//  - Program admin (the owner): every team, every coach, creates/deletes teams, sets the admin passcode.
//  - Team admin ("Head Coach (Admin)"): full editing of their own teams; manages the coaches on those teams.
//  - Coach ("Assistant Coach"): their own teams only.
import type { StaffCoach, Team } from '../types';

/** The program owner. Always a program admin, whatever the staff list says. */
export const PROGRAM_ADMIN_EMAILS = ['dannym1010@gmail.com'];

const cleanEmail = (e?: string) => String(e || '').toLowerCase().trim();
export const sameTeamId = (a?: string, b?: string) =>
  String(a || '').toLowerCase().replace(/-/g, '_') === String(b || '').toLowerCase().replace(/-/g, '_');

export function isProgramAdminEmail(email?: string): boolean {
  return PROGRAM_ADMIN_EMAILS.includes(cleanEmail(email));
}

export function isProgramAdminCoach(c?: Pick<StaffCoach, 'email' | 'role' | 'status'> | null): boolean {
  if (!c) return false;
  if (isProgramAdminEmail(c.email)) return true;
  const r = String(c.role || '').toLowerCase();
  return c.status === 'Active' && (r.includes('master') || r.includes('super admin') || r.includes('program admin'));
}

export function isTeamAdminRole(role?: string): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('head coach') || r.includes('admin');
}

/** The teams a staff member works with. */
export function coachTeamIds(c: Pick<StaffCoach, 'email' | 'role' | 'status' | 'assignedTeamIds'> | null | undefined, teams: Team[]): string[] {
  if (!c) return [];
  if (isProgramAdminCoach(c)) return teams.map((t) => t.id);
  // Each team has its own coaches; only the program owner has every team. Accounts from before
  // ("all teams", or no teams set) were 10U's coaches.
  const assigned = c.assignedTeamIds;
  if (!assigned || assigned.includes('all')) return teams.filter((t) => sameTeamId(t.id, 'team_10u')).map((t) => t.id);
  return teams.filter((t) => assigned.some((id) => sameTeamId(id, t.id))).map((t) => t.id);
}

/** A coach nobody has placed on a team yet (new sign-ups). */
export const hasNoTeamYet = (c: Pick<StaffCoach, 'assignedTeamIds'>) =>
  !c.assignedTeamIds || c.assignedTeamIds.length === 0 || c.assignedTeamIds.includes('all');

export interface StaffManager {
  email?: string;
  isProgramAdmin: boolean;
  /** Teams this person manages (all teams for the program admin). */
  teamIds: string[];
}

/** Whether `manager` may change `target` (role, teams, approval, removal). Never the program admin, never yourself. */
export function canManageCoach(manager: StaffManager, target: StaffCoach, teams: Team[]): boolean {
  if (!target) return false;
  const self = cleanEmail(manager.email) === cleanEmail(target.email);
  if (isProgramAdminCoach(target)) return false;
  if (manager.isProgramAdmin) return !self;
  if (self) return false;
  // A team admin manages coaches whose teams are all theirs, and new sign-ups waiting for a team.
  if (target.status === 'Pending' && hasNoTeamYet(target)) return true;
  const targetTeams = coachTeamIds(target, teams);
  return targetTeams.length > 0 && targetTeams.every((id) => manager.teamIds.some((m) => sameTeamId(m, id)));
}

/** Whether `manager` should see `target` in the staff list. */
export function canSeeCoach(manager: StaffManager, target: StaffCoach, teams: Team[]): boolean {
  if (manager.isProgramAdmin) return true;
  if (cleanEmail(manager.email) === cleanEmail(target.email)) return true;
  if (target.status === 'Pending' && hasNoTeamYet(target)) return true;
  return coachTeamIds(target, teams).some((id) => manager.teamIds.some((m) => sameTeamId(m, id)));
}
