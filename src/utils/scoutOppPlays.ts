import type { PracticePeriod } from '../types';
import type { Play } from '../hudlScout/types/football';
import { isWholeCall } from './playCallParse';

/** A play the opponent ran, kept with one scouting film. */
export interface ScoutOppPlay {
  id: string;
  gameId: string;
  name: string;
  formation: string;
  personnel: string;
  kind: 'run' | 'pass' | 'rpo' | 'screen';
  /** 1st, 2nd, 3rd, or red. */
  down: string;
  notes: string;
  /** On this week's scouting report, so it is in the practice script. */
  onReport: boolean;
  editedAt: number;
  /** Set on every play in a film when that film's list is reordered, so the newer order wins. */
  reorderedAt?: number;
  /** The play the film's snaps were tagged with (one of our Play Library plays, or a write-in). */
  fromPlayId?: string;
}

export interface ScoutScriptLine {
  playId: string;
  name: string;
  detail: string;
  period: string;
}

export interface ScoutPracticeScript {
  title: string;
  builtAt: number;
  lines: ScoutScriptLine[];
  periods: PracticePeriod[];
}

const PERIODS: { id: string; label: string }[] = [
  { id: '1st', label: '1st down' },
  { id: '2nd', label: '2nd down' },
  { id: '3rd', label: '3rd down' },
  { id: 'red', label: 'Red zone' },
  { id: 'other', label: 'Other' },
];

/** A Play Library row made for an opponent's play from Their plays (not one of our plays). */
export function isScoutPlayEntry(p: { id?: string; source?: string } | null | undefined): boolean {
  return Boolean(p) && (p!.source === 'scout' || String(p!.id || '').startsWith('scout_'));
}

export function mergeOppLibraries(
  a?: Record<string, ScoutOppPlay[]>,
  b?: Record<string, ScoutOppPlay[]>,
  deleted: string[] = []
): Record<string, ScoutOppPlay[]> {
  const gone = new Set(deleted);
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out: Record<string, ScoutOppPlay[]> = {};
  for (const key of keys) {
    const byId = new Map<string, ScoutOppPlay>();
    for (const play of [...(a?.[key] || []), ...(b?.[key] || [])]) {
      if (!play?.id || gone.has(play.id)) continue;
      const cur = byId.get(play.id);
      if (!cur || (Number(play.editedAt) || 0) >= (Number(cur.editedAt) || 0)) byId.set(play.id, play);
    }
    if (!byId.size) continue;
    // The list that was reordered more recently sets the order. Plays only the other copy has are added after.
    const aList = a?.[key] || [];
    const bList = b?.[key] || [];
    const stamp = (list: ScoutOppPlay[]) => Math.max(0, ...list.map((p) => Number(p.reorderedAt) || 0));
    const primary = stamp(bList) >= stamp(aList) ? bList : aList;
    const secondary = primary === bList ? aList : bList;
    const ordered: ScoutOppPlay[] = [];
    const seen = new Set<string>();
    for (const play of [...primary, ...secondary]) {
      if (!play?.id || seen.has(play.id) || !byId.has(play.id)) continue;
      seen.add(play.id);
      ordered.push(byId.get(play.id)!);
    }
    out[key] = ordered;
  }
  return out;
}

/** The call on a film snap, the same text Their plays groups by. */
export function filmCall(play: Play): string {
  return String(play.hudlCall || play.playName || '').trim();
}

export interface LinkedSnap {
  id: string;
  playNumber: number;
  gain?: number;
  result?: string;
}

/** Snaps on this film that are this call, so the diagram and the videos stay on the same play. */
export function snapsForCall(
  plays: Play[],
  gameId: string | undefined,
  callName: string,
  playEntryId?: string,
  /** The play those snaps were tagged with (a card made from tags). */
  fromPlayId?: string
): LinkedSnap[] {
  const key = callName.trim().toLowerCase();
  return plays
    .filter((p) => {
      if (gameId && p.gameId && p.gameId !== gameId) return false;
      if (playEntryId && p.playCallId === playEntryId) return true;
      if (fromPlayId && p.playCallId === fromPlayId) return true;
      return Boolean(key) && filmCall(p).toLowerCase() === key;
    })
    .sort((a, b) => (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0))
    .map((p) => ({
      id: p.id,
      playNumber: Number(p.playNumber) || 0,
      gain: p.gainLoss,
      result: p.result && p.result !== '-' ? p.result : '',
    }));
}

/**
 * Point those snaps at the play library row. A snap a coach already tagged as a different play stays as they tagged it.
 */
export function linkSnapsToCall(
  plays: Play[],
  link: { gameId?: string; callName: string; playEntryId: string; playName: string }
): Play[] {
  const key = link.callName.trim().toLowerCase();
  const now = Date.now();
  return plays.map((p) => {
    if (link.gameId && p.gameId && p.gameId !== link.gameId) return p;
    const mine = p.playCallId === link.playEntryId;
    const sameCall = Boolean(key) && filmCall(p).toLowerCase() === key;
    if (!mine && !sameCall) return p;
    if (p.playCallId && p.playCallId !== link.playEntryId) return p;
    if (p.playCallId === link.playEntryId && p.playCall === link.playName) return p;
    return { ...p, playCallId: link.playEntryId, playCall: link.playName, editedAt: now };
  });
}

/**
 * Rename one Their-plays card and every snap on that film that used the old call.
 * The play log reads playName, so both names move together.
 */
export function renameOppCall(
  plays: Play[],
  libraries: Record<string, ScoutOppPlay[]> | undefined,
  change: { scoutId: string; gameId?: string; from: string; to: string; playEntryId?: string }
): { plays: Play[]; playLibraries: Record<string, ScoutOppPlay[]> } {
  const fromKey = change.from.trim().toLowerCase();
  const to = change.to.trim().slice(0, 120);
  const now = Date.now();
  const nextPlays =
    !fromKey || !to || fromKey === to.toLowerCase()
      ? plays
      : plays.map((p) => {
          if (change.gameId && p.gameId && p.gameId !== change.gameId) return p;
          const tagged = Boolean(change.playEntryId) && p.playCallId === change.playEntryId;
          if (!tagged && filmCall(p).toLowerCase() !== fromKey) return p;
          return {
            ...p,
            hudlCall: to,
            playName: to,
            playCall: to,
            playCallId: change.playEntryId || p.playCallId,
            editedAt: now,
          };
        });
  const playLibraries: Record<string, ScoutOppPlay[]> = {};
  for (const [gid, list] of Object.entries(libraries || {})) {
    playLibraries[gid] = list.map((card) =>
      card.id === change.scoutId || (card.gameId === change.gameId && card.name.trim().toLowerCase() === fromKey)
        ? { ...card, name: to || card.name, editedAt: now }
        : card
    );
  }
  return { plays: nextPlays, playLibraries };
}

export function reportPlays(libraries?: Record<string, ScoutOppPlay[]>): ScoutOppPlay[] {
  return Object.values(libraries || {})
    .flat()
    .filter((p) => p.onReport && p.name.trim());
}

function kindFrom(play: Play): ScoutOppPlay['kind'] {
  if (play.playType === 'PASS') return 'pass';
  if (play.playType === 'RPO') return 'rpo';
  if (play.playType === 'SCREEN') return 'screen';
  return 'run';
}

function downFrom(play: Play): string {
  if (play.fieldZone === 'red_zone' || play.fieldZone === 'goal_line') return 'red';
  if (play.down === 1) return '1st';
  if (play.down === 2) return '2nd';
  if (play.down === 3 || play.down === 4) return '3rd';
  return 'other';
}

/** The most common down / field zone of these snaps (red zone first). */
function mostCommonDown(rows: Play[]): string {
  const downs = new Map<string, number>();
  rows.forEach((r) => {
    const d = downFrom(r);
    downs.set(d, (downs.get(d) || 0) + 1);
  });
  return [...downs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);


/** The name of a tagged play: our library play's name, a whole call as typed, or the film formation + the call. */
export function tagCardName(sample: Partial<Pick<Play, 'formation' | 'playCall' | 'playName'>>, libraryName?: string): string {
  const formation = sample.formation && sample.formation !== '-' ? sample.formation : '';
  const call = String(sample.playCall || sample.playName || '').trim();
  return (libraryName || (isWholeCall(call) ? call : [formation, call].filter(Boolean).join(' '))).trim().slice(0, 120);
}

/** The id of the card made for a tagged play on a film (the same on every coach's device, so copies merge). */
export const tagCardId = (gameId: string, playId: string) => `tag-${gameId}-${slug(playId)}`;

/**
 * A card for every play the coaches tagged on this film's snaps (from our Play Library or written in)
 * that isn't in Their plays yet. Named as tagged: the library play's name, or a write-in with the
 * formation it was tagged on. Cards a coach removed don't come back.
 */
export function cardsFromTags(
  gameId: string,
  film: Play[],
  existing: ScoutOppPlay[],
  deleted: string[],
  libraryName: (playId: string) => string | undefined
): ScoutOppPlay[] {
  const gone = new Set(deleted);
  const haveIds = new Set(existing.map((c) => c.id));
  const haveNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  const haveFrom = new Set(existing.map((c) => c.fromPlayId).filter(Boolean));
  const groups = new Map<string, Play[]>();
  for (const p of film) {
    const id = String(p.playCallId || '');
    // Snaps already linked to a Their-plays card (scout_...) are that card's.
    if (!id || id.startsWith('scout_') || p.odk === 'K' || p.odk === 'S') continue;
    groups.set(id, [...(groups.get(id) || []), p]);
  }
  const now = Date.now();
  const out: ScoutOppPlay[] = [];
  for (const [playId, rows] of groups) {
    const cardId = tagCardId(gameId, playId);
    const sample = rows[0];
    const formation = sample.formation && sample.formation !== '-' ? sample.formation : '';
    const name = tagCardName(sample, libraryName(playId));
    if (!name || gone.has(cardId) || haveIds.has(cardId) || haveFrom.has(playId) || haveNames.has(name.toLowerCase())) continue;
    haveNames.add(name.toLowerCase());
    out.push({
      id: cardId,
      gameId,
      name,
      formation,
      personnel: sample.personnel && sample.personnel !== '-' ? sample.personnel : (formation.match(/^\d{2}\b/) || [''])[0],
      kind: kindFrom(sample),
      down: mostCommonDown(rows),
      notes: `Tagged on ${rows.length} snap${rows.length === 1 ? '' : 's'}.`,
      onReport: true,
      editedAt: now,
      fromPlayId: playId,
    });
  }
  return out;
}

/** One card per call on this film. The down is the one they used it on most. */
export function playsFromFilm(gameId: string, film: Play[], existing: ScoutOppPlay[]): ScoutOppPlay[] {
  const have = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  const groups = new Map<string, Play[]>();
  for (const play of film) {
    if (play.odk !== 'O') continue;
    const name = String(play.hudlCall || play.playName || '').trim();
    if (!name || name === '-' || /^(penalty|rush|pass|incomplete|no play|kneel)$/i.test(name) || have.has(name.toLowerCase())) continue;
    const list = groups.get(name) || [];
    list.push(play);
    groups.set(name, list);
  }
  const now = Date.now();
  return [...groups.entries()].map(([name, rows], i) => {
    const downs = new Map<string, number>();
    rows.forEach((r) => {
      const d = downFrom(r);
      downs.set(d, (downs.get(d) || 0) + 1);
    });
    const down = [...downs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
    const sample = rows[0];
    return {
      id: `film-${gameId}-${i}-${now}`,
      gameId,
      name,
      formation: sample.formation && sample.formation !== '-' ? sample.formation : '',
      personnel: sample.personnel && sample.personnel !== '-' ? sample.personnel : '',
      kind: kindFrom(sample),
      down,
      notes: `Ran ${rows.length} time${rows.length === 1 ? '' : 's'} on this film.`,
      onReport: rows.length >= 2,
      editedAt: now,
    };
  });
}

/** Put plays in a saved order. Ones that are not in that order stay at the end, in the order they already had. */
export function orderByIds<T extends { id: string }>(plays: T[], ids?: string[]): T[] {
  if (!ids?.length) return plays;
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...plays].sort((a, b) => (rank.get(a.id) ?? ids.length) - (rank.get(b.id) ?? ids.length));
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

const periodLabel = (down: string) => PERIODS.find((p) => p.id === (down || 'other'))?.label || 'Other';

export function buildScoutScript(plays: ScoutOppPlay[], opponent: string): ScoutPracticeScript {
  const who = opponent.trim() || 'Opponent';
  const lines: ScoutScriptLine[] = plays.map((p) => {
    const bits = [periodLabel(p.down), p.formation, p.personnel, p.kind].filter((s) => s && s !== '-').join(' · ');
    const detail = [bits, p.notes].filter(Boolean).join('. ');
    return { playId: p.id, name: p.name, detail, period: periodLabel(p.down) };
  });
  const text = lines.map((l, i) => `${i + 1}. ${l.name}${l.detail ? ` — ${l.detail}` : ''}`).join('\n');
  const periods: PracticePeriod[] = lines.length
    ? [
        {
          time: Math.max(8, lines.length * 3),
          category: `${who} scout`,
          format: 'static',
          stations: [{ name: 'Their plays', desc: text, coach: '', focus: 'Rep their play, then our answer.' }],
        },
      ]
    : [];
  return {
    title: `${who} scout script`,
    builtAt: Date.now(),
    lines,
    periods,
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

/** A printable sheet of the script: each checked play and its diagram, separate from the practice plan. */
export function scoutScriptPrintHtml(
  title: string,
  groups: { label: string; plays: { name: string; detail: string; diagram?: string | null }[] }[]
): string {
  const sections = groups
    .filter((g) => g.plays.length)
    .map((g) => {
      const cards = g.plays
        .map((p) => {
          const picture = p.diagram
            ? `<img src="${esc(p.diagram)}" alt="${esc(p.name)}"/>`
            : `<div class="empty">No diagram yet. Open this play and draw it.</div>`;
          return `<article class="card"><div class="name">${esc(p.name)}</div>${p.detail ? `<div class="detail">${esc(p.detail)}</div>` : ''}${picture}</article>`;
        })
        .join('');
      return `<h2>${esc(g.label)}</h2><div class="grid">${cards}</div>`;
    })
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title><style>
    @page { size: letter; margin: 0.45in; }
    body { font-family: system-ui, sans-serif; color: #111; margin: 0; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { break-inside: avoid; border: 1px solid #ccc; border-radius: 8px; padding: 8px; }
    .name { font-weight: 800; font-size: 14px; }
    .detail { font-size: 11px; color: #444; margin-top: 2px; }
    img { width: 100%; height: auto; margin-top: 6px; }
    .empty { margin-top: 8px; font-size: 11px; color: #666; border: 1px dashed #ccc; border-radius: 6px; padding: 16px 8px; text-align: center; }
  </style></head><body><h1>${esc(title)}</h1>${sections}</body></html>`;
}
