// Staff & access for a big list (every coach, player and family in the program): adding many accounts from a pasted
// list, changing many at once, grouping and searching them.
import type { StaffCoach } from '../types';
import { isFamilyRole, isPlayerRole } from './playerAccess';

export interface PastedAccount {
  email: string;
  /** Jersey numbers on the line ("21", "#7"). */
  kids: string[];
  /** Any other words on the line ("Ward family", "Nash's mom"). */
  name?: string;
}

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/**
 * One account per line, pasted from a sign-up sheet or typed: the email, plus (for a family) the kid's number(s) and
 * a name, in any order, split by commas, tabs or semicolons: "mom@home.com, 21, Ward family". Several emails on one
 * line with nothing else ("a@x.com b@y.com") are each their own account. Lines without an email come back in `bad`.
 */
export function parseAccountLines(text: string): { accounts: PastedAccount[]; bad: string[] } {
  const accounts: PastedAccount[] = [];
  const bad: string[] = [];
  const seen = new Set<string>();
  const add = (a: PastedAccount) => {
    if (seen.has(a.email)) return;
    seen.add(a.email);
    accounts.push(a);
  };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // "Name <email>" (copied from a mail program).
    const cleaned = line.replace(/<([^>]+)>/g, ',$1,');
    const parts = cleaned.split(/[,;\t]+/).map((p) => p.trim()).filter(Boolean);
    const words = parts.flatMap((p) => (p.split(/\s+/).every((w) => EMAIL.test(w)) ? p.split(/\s+/) : [p]));
    const emails = words.filter((w) => EMAIL.test(w)).map((w) => w.toLowerCase());
    if (!emails.length) {
      bad.push(line);
      continue;
    }
    const kids = words.filter((w) => /^#?\d{1,3}$/.test(w)).map((w) => String(Number(w.replace('#', ''))));
    const name = words.filter((w) => !EMAIL.test(w) && !/^#?\d{1,3}$/.test(w)).join(' ').replace(/^["']|["']$/g, '').trim();
    if (emails.length > 1 && !kids.length && !name) emails.forEach((email) => add({ email, kids: [] }));
    else add({ email: emails[0], kids, ...(name ? { name } : {}) });
  }
  return { accounts, bad };
}

/** A change to one account: fields to set (undefined = take the field off), or null to remove the account. */
export interface StaffEdit {
  email: string;
  patch: Partial<StaffCoach> | null;
}

const key = (email?: string) => String(email || '').toLowerCase().trim();

/** Apply changes by email to the accounts `may` allows; the same list back when nothing changed. */
export function applyStaffEdits(list: StaffCoach[], edits: StaffEdit[], may: (c: StaffCoach) => boolean): StaffCoach[] {
  const byEmail = new Map(edits.map((e) => [key(e.email), e.patch]));
  let changed = false;
  const out: StaffCoach[] = [];
  for (const c of list) {
    const k = key(c.email);
    if (!byEmail.has(k) || !may(c)) {
      out.push(c);
      continue;
    }
    const patch = byEmail.get(k);
    changed = true;
    if (patch === null) continue;
    const next: any = { ...c };
    for (const [f, v] of Object.entries(patch || {})) {
      if (v === undefined) delete next[f];
      else next[f] = v;
    }
    out.push(next);
  }
  return changed ? out : list;
}

export type StaffGroup = 'pending' | 'coach' | 'player' | 'family';
export const STAFF_GROUPS: { id: StaffGroup; label: string }[] = [
  { id: 'pending', label: 'Waiting for approval' },
  { id: 'coach', label: 'Coaches' },
  { id: 'player', label: 'Players' },
  { id: 'family', label: 'Families' },
];
export const staffGroup = (c: StaffCoach): StaffGroup =>
  c.status === 'Pending' ? 'pending' : isFamilyRole(c.role) ? 'family' : isPlayerRole(c.role) ? 'player' : 'coach';

/** Search: email, name, role, and (for players and families) their kid's number or name. */
export function matchesStaffSearch(c: StaffCoach, q: string, roster: { num: string; firstName?: string; lastName?: string }[] = []): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const kids = (c.kids || []).map((n) => {
    const k = roster.find((r) => String(Number(r.num)) === String(Number(n)));
    return `#${n} ${n} ${k?.firstName || ''} ${k?.lastName || ''}`;
  });
  const hay = `${c.email} ${c.name || ''} ${c.role} ${kids.join(' ')}`.toLowerCase();
  return words.every((w) => hay.includes(w.replace(/^#/, '')) || hay.includes(w));
}
