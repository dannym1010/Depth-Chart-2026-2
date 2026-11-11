// Families help make a reel (the year-end video): a coach turns on "Families can send clips" for a reel, a family
// trims one of their own highlights (zoom, circles, following their kid) and sends it, and the coaches add it to the
// reel or pass on it. Each family's sent clips are their own small document (only they write it; the database rules
// let a family account write just theirs), and the coaches' answers ride on the reel, so nobody writes over anybody.
import { sharedDocId } from '../filmroom/sharedMerge';
import { mergeById, mergeTombstones, type Tombstones } from '../utils/recordMerge';
import { editReel, newId } from './highlightData';
import type { FamilyPick, Highlight, HighlightsData, Reel } from './types';

export interface SentClip {
  /** One per clip per reel: `${reelId}__${highlightId}`. */
  id: string;
  reelId: string;
  /** Their highlight as they made it (trim, slow motion, zoom, circles, his path). */
  h: Highlight;
  /** A word to the coach ("watch #21 pull and kick out the end"). */
  note?: string;
  sentAt: number;
  editedAt: number;
}

export interface FamilySends {
  kind: 'hlsend';
  team: string;
  season: string;
  email: string;
  name?: string;
  kids?: string[];
  sent: SentClip[];
  deletedSent: Tombstones;
  updatedAt?: number;
}

/** What a family sees on a clip they sent. 'updated' = in the video, but they changed it since. */
export type SendStatus = 'waiting' | 'used' | 'passed' | 'updated';

/** An email as it sits in a document's name (the database rules build the same from the signed-in email). */
export const emailKey = (email: string) => String(email || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
/** A family's sent clips for a team's season: filmroom_<team>_hlsend_<season>_<email>. */
export const sendsDocId = (teamId: string, season: string, email: string) => sharedDocId(teamId, `hlsend_${season}_${emailKey(email)}`);

export const emptySends = (team: string, season: string, email: string): FamilySends => ({
  kind: 'hlsend',
  team,
  season,
  email: String(email || '').toLowerCase().trim(),
  sent: [],
  deletedSent: {},
});

export function mergeSends(a?: Partial<FamilySends> | null, b?: Partial<FamilySends> | null): FamilySends {
  const x = { ...emptySends('', '', ''), ...(a || {}) } as FamilySends;
  const y = { ...emptySends('', '', ''), ...(b || {}) } as FamilySends;
  const deletedSent = mergeTombstones(x.deletedSent, y.deletedSent);
  const newer = (y.updatedAt || 0) > (x.updatedAt || 0) ? y : x;
  return {
    ...x,
    ...y,
    name: newer.name || x.name || y.name,
    kids: newer.kids || x.kids || y.kids,
    team: x.team || y.team,
    season: x.season || y.season,
    email: x.email || y.email,
    kind: 'hlsend',
    sent: mergeById(x.sent, y.sent, deletedSent).sort((m, n) => m.sentAt - n.sentAt),
    deletedSent,
    updatedAt: Math.max(x.updatedAt || 0, y.updatedAt || 0) || undefined,
  };
}

/** Send a clip for a reel (sending it again sends their latest version). */
export function sendClip(d: FamilySends, h: Highlight, reelId: string, note = '', now = Date.now()): FamilySends {
  const id = `${reelId}__${h.id}`;
  const had = d.sent.find((s) => s.id === id);
  // Their private note isn't sent; what they write for the coach is.
  const { note: _mine, ...clip } = h;
  const item: SentClip = { id, reelId, h: clip as Highlight, ...(note.trim() ? { note: note.trim() } : {}), sentAt: had?.sentAt || now, editedAt: now };
  return { ...d, sent: had ? d.sent.map((s) => (s.id === id ? item : s)) : [...d.sent, item], updatedAt: now };
}

/** Take a sent clip back. */
export function unsendClip(d: FamilySends, id: string, now = Date.now()): FamilySends {
  return { ...d, sent: d.sent.filter((s) => s.id !== id), deletedSent: { ...d.deletedSent, [id]: now }, updatedAt: now };
}

/** Where a sent clip stands, from the reel's answers: in the video only while it's still in the reel. */
export function sendStatus(reel: Reel | undefined, s: SentClip): SendStatus {
  const pick = reel?.fromFamilies?.[s.id];
  if (!pick) return 'waiting';
  if (pick.status === 'passed') return 'passed';
  const inReel = Boolean(pick.highlightId && reel!.items.some((i) => i.highlightId === pick.highlightId));
  if (!inReel) return 'passed';
  return s.editedAt > pick.at ? 'updated' : 'used';
}

/** The reels families can send clips for (newest first). */
export const reelsTakingClips = (d: Pick<HighlightsData, 'reels'>): Reel[] =>
  d.reels.filter((r) => r.familySend?.on).sort((a, b) => b.createdAt - a.createdAt);

/** A clip a family sent, with who sent it and where it stands: one row of a reel's "From families". */
export interface InboxItem {
  sent: SentClip;
  family: { email: string; name: string; kids: string[] };
  status: SendStatus;
}

/** Every clip sent for a reel, newest first, from every family's document. */
export function inboxFor(reel: Reel, families: FamilySends[]): InboxItem[] {
  const out: InboxItem[] = [];
  for (const f of families)
    for (const s of f.sent)
      if (s.reelId === reel.id)
        out.push({ sent: s, family: { email: f.email, name: f.name || f.email.split('@')[0], kids: f.kids || [] }, status: sendStatus(reel, s) });
  return out.sort((a, b) => b.sent.editedAt - a.sent.editedAt);
}

const pickOn = (r: Reel, id: string, pick: FamilyPick | null): Reel => {
  const fromFamilies = { ...(r.fromFamilies || {}) };
  if (pick) fromFamilies[id] = pick;
  else delete fromFamilies[id];
  return { ...r, fromFamilies };
};

/**
 * Put a family's clip in the reel: copied into the team's highlights (kept by the family, so "Kept by" shows them),
 * their trim, zoom, circles and path kept; a coach can change it from there. A clip they updated after it was added
 * replaces the copy (same highlight, same place in the reel).
 */
export function addSentToReel(d: HighlightsData, reelId: string, item: InboxItem, by: string, now = Date.now()): HighlightsData {
  const reel = d.reels.find((r) => r.id === reelId);
  if (!reel) return d;
  const was = reel.fromFamilies?.[item.sent.id];
  const keep = was?.highlightId && d.highlights.some((h) => h.id === was.highlightId) ? was.highlightId : '';
  const id = keep || newId('fam', now);
  const note = [`From ${item.family.name}`, item.sent.note].filter(Boolean).join(': ');
  const copy: Highlight = { ...item.sent.h, id, note, createdBy: item.family.email, createdAt: keep ? d.highlights.find((h) => h.id === keep)!.createdAt : now, editedAt: now };
  const highlights = keep ? d.highlights.map((h) => (h.id === keep ? copy : h)) : [...d.highlights, copy];
  const withClip = { ...d, highlights };
  return editReel(
    withClip,
    reelId,
    (r) => {
      const items = r.items.some((i) => i.highlightId === id) ? r.items : [...r.items, { id: newId('it', now), highlightId: id }];
      return pickOn({ ...r, items }, item.sent.id, { status: 'used', at: now, by, highlightId: id });
    },
    now
  );
}

/** Pass on a sent clip (or, with `undo`, put it back in the waiting list). */
export function passSent(d: HighlightsData, reelId: string, sentId: string, by: string, undo = false, now = Date.now()): HighlightsData {
  return editReel(d, reelId, (r) => pickOn(r, sentId, undo ? null : { status: 'passed', at: now, by }), now);
}
