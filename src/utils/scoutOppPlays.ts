import type { PracticePeriod } from '../types';
import type { PlayBuilderState } from '../types/callSheet';
import type { Play } from '../hudlScout/types/football';
import { isWholeCall, parsePlayCall } from './playCallParse';
import { BACKFIELD_STRUCTURES, RUN_SCHEMES } from './footballEngine';

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
  /** Clip numbers on this film (the film's play numbers) where they ran it. */
  clips?: number[];
  /** Their formation it was drawn from (OppFormation id). */
  formationId?: string;
}

/**
 * One of the opponent's formations, drawn once in the play builder: their plays start from it.
 * Kept for the week's whole scouting report (every film of that opponent).
 */
export interface OppFormation {
  id: string;
  name: string;
  /** The builder as it was saved: personnel, formation, backfield, strength, moved players. No play drawn. */
  builder?: PlayBuilderState;
  diagramUrl?: string;
  /** The same formation with our defense lined up against it (when a defense is picked). */
  defenseUrl?: string;
  /** Name of our defense in that picture ("4-4 Cover 3 LIZ"). */
  defenseName?: string;
  /** Our calls against it: the base call and the calls for situations (ids of our defensive plays). */
  plan?: FormationPlan;
  /** A clip that shows it (film + play number), to watch while drawing. */
  gameId?: string;
  clip?: number;
  editedAt: number;
  /** Removed (kept so an older copy can't bring it back). */
  deleted?: boolean;
}

export interface FormationPlan {
  base?: string;
  calls: { id: string; situation: string; callId: string }[];
}

/** Situations offered for a call against a formation (a coach can type any other). */
export const PLAN_SITUATIONS = ['1st & 10', '2nd & long', '2nd & short', '3rd & long', '3rd & short', '4th & short', 'Red zone', 'Goal line', '2-pt', 'Backed up', '2-minute'];

/** A formation's plan as lines for a call sheet: "Base: 4-4 Stack LIZ", "3rd & long: Blow Sting". */
export function planLines(plan: FormationPlan | undefined, nameOf: (id: string) => string | undefined): { situation: string; call: string; id: string }[] {
  if (!plan) return [];
  const rows = [...(plan.base ? [{ situation: 'Base', callId: plan.base, id: 'base' }] : []), ...(plan.calls || [])];
  return rows.map((r) => ({ situation: r.situation, call: nameOf(r.callId) || '', id: r.id })).filter((r) => r.call);
}

/** Two copies of the formations: per formation, the newer edit wins (a removal is an edit). */
export function mergeOppFormations(a?: OppFormation[], b?: OppFormation[]): OppFormation[] | undefined {
  const byId = new Map<string, OppFormation>();
  for (const f of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!f?.id) continue;
    const cur = byId.get(f.id);
    if (!cur || (Number(f.editedAt) || 0) >= (Number(cur.editedAt) || 0)) byId.set(f.id, f);
  }
  return byId.size ? [...byId.values()] : undefined;
}

/** The builder to start a new play from a formation: its alignment, nothing drawn yet. */
export function builderFromFormation(f: OppFormation, name: string): PlayBuilderState | undefined {
  if (!f.builder) return undefined;
  const { strokes: _strokes, ...rest } = f.builder;
  return { ...rest, name };
}

/** Clip numbers typed by a coach ("12", "12, 15", "#7 9"). */
export function parseClips(text: string): number[] {
  return [...new Set((text.match(/\d+/g) || []).map(Number).filter((n) => n > 0 && n < 1000))];
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
  return realCall(play);
}

/** Hudl's words for what happened, which it puts in the play name when the file has no play call. */
const RESULT_WORDS = /^(rush|run|pass|play|special teams play|gain|loss|penalty|incomplete|complete|completion|sack|scramble|interception|int|fumble|no play|kneel|td|touchdown|return|touchback|fair catch|-)$/i;

/**
 * The play they called, as the film has it: Hudl's play-call column, or the name, unless the name is only
 * the result Hudl filled in ("Rush", "Sack", "Complete") when the file had no play call.
 */
export function realCall(play: Partial<Pick<Play, 'hudlCall' | 'playName' | 'result'>>): string {
  const hudl = String(play.hudlCall || '').trim();
  if (hudl && hudl !== '-') return hudl;
  const name = String(play.playName || '').trim();
  if (!name || RESULT_WORDS.test(name)) return '';
  const result = String(play.result || '').trim().toLowerCase();
  if (result && name.toLowerCase() === result) return '';
  return name;
}

/** Formation names match without caring about capitals or extra spaces. */
export const formationKey = (name?: string) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Their play for one clip on the film, to open in the play builder: the play it's already tagged with, or a
 * new one lined up in its drawn base formation, named by the call (or "Trips Rt #12"), with the clip on it.
 */
export function cardForSnap(snap: Play, formations: OppFormation[] | undefined, cards: ScoutOppPlay[], now = Date.now()): ScoutOppPlay {
  const gameId = snap.gameId || '';
  const tag = String(snap.playCallId || '');
  const n = Number(snap.playNumber) || 0;
  const linked = tag ? cards.find((c) => c.gameId === gameId && (`scout_${c.id}` === tag || c.fromPlayId === tag)) : undefined;
  if (linked) return linked;
  const form = snap.formation && snap.formation !== '-' ? snap.formation.trim() : '';
  const f = (formations || []).find((x) => x?.id && !x.deleted && x.builder && formationKey(x.name) === formationKey(form));
  const call = String(snap.playCall || '').trim() || realCall(snap);
  return {
    id: `opp-${now}`,
    gameId,
    name: call || `${f?.name || form || 'Play'} #${n}`,
    formation: f?.name || form,
    personnel: f?.builder?.personnel != null ? String(f.builder.personnel) : snap.personnel && snap.personnel !== '-' ? snap.personnel : '',
    kind: kindFrom(snap),
    down: downFrom(snap),
    notes: '',
    onReport: true,
    editedAt: now,
    clips: [n],
    ...(f ? { formationId: f.id } : {}),
    ...(tag && !tag.startsWith('scout_') ? { fromPlayId: tag } : {}),
  };
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
  fromPlayId?: string,
  /** Clip numbers the play was tagged on. */
  clips?: number[]
): LinkedSnap[] {
  const key = callName.trim().toLowerCase();
  const clipSet = new Set(clips || []);
  return plays
    .filter((p) => {
      if (gameId && p.gameId && p.gameId !== gameId) return false;
      if (playEntryId && p.playCallId === playEntryId) return true;
      // A clip the coach typed in for this play is this play, whatever the film had it tagged as.
      if (clipSet.has(Number(p.playNumber))) return true;
      if (fromPlayId && p.playCallId === fromPlayId) return true;
      // Matched by name, a kick or defensive snap with the same words isn't this offensive play.
      return Boolean(key) && filmCall(p).toLowerCase() === key && (!p.odk || p.odk === 'O');
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
  link: { gameId?: string; callName: string; playEntryId: string; playName: string; clips?: number[] }
): Play[] {
  const key = link.callName.trim().toLowerCase();
  const clipSet = new Set(link.clips || []);
  const now = Date.now();
  return plays.map((p) => {
    if (link.gameId && p.gameId && p.gameId !== link.gameId) return p;
    const mine = p.playCallId === link.playEntryId;
    const sameCall = Boolean(key) && filmCall(p).toLowerCase() === key && (!p.odk || p.odk === 'O');
    // A clip the coach tagged with this play (on this film: a snap with no game is the only film's).
    const tagged = Boolean(link.gameId) && (p.gameId === link.gameId || !p.gameId) && clipSet.has(Number(p.playNumber));
    if (!mine && !sameCall && !tagged) return p;
    // Tagged with another call: only a clip the coach typed in for this play moves over.
    if (p.playCallId && p.playCallId !== link.playEntryId && !tagged) return p;
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
export function tagCardName(sample: Partial<Pick<Play, 'formation' | 'playCall' | 'playName' | 'hudlCall' | 'result'>>, libraryName?: string): string {
  const formation = sample.formation && sample.formation !== '-' ? sample.formation : '';
  const call = String(sample.playCall || '').trim() || realCall(sample);
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
    const name = realCall(play);
    if (!name || have.has(name.toLowerCase())) continue;
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

const SIDE = /^(L|R|LT|RT|LFT|RGT|LEFT|RIGHT|LIZ|RIP|LARRY|ROGER)$/;
const words = (text: string) =>
  String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * The kind of play this is, whichever way they ran it: the side (L / R) and which back goes to which
 * hole don't count, so 32 L WB 44 ZONE, 32 R WB 43 ZONE and 37 ZONE from the same set are one type.
 */
export function oppPlayType(play: Pick<ScoutOppPlay, 'name' | 'formation' | 'personnel' | 'kind'>): { key: string; label: string } {
  const named = parsePlayCall(play.name);
  const form = parsePlayCall(play.formation || '');
  const personnel = named.personnel ?? form.personnel ?? (String(play.personnel || '').match(/^\d{2}\b/) || [''])[0];
  const backfield = named.backfields[0] || form.backfields[0] || '';
  const formWords = words(play.formation).filter((w) => !SIDE.test(w) && !/^\d{2}[LR]?$/.test(w));
  const formLabel = backfield && BACKFIELD_STRUCTURES[backfield] ? BACKFIELD_STRUCTURES[backfield].hudlBackfield : formWords.join(' ');
  let playKey: string;
  let playLabel: string;
  if (named.run) {
    playKey = named.run;
    playLabel = RUN_SCHEMES.find((r) => r.id === named.run)?.label || named.run;
  } else {
    // Not a run we know: the words of the call without the personnel, side, formation and back + hole.
    const skip = new Set([...words(named.formationWord || ''), ...formWords]);
    const rest = words(play.name).filter((w, i) => {
      if (i === 0 && /^\d{2}[LR]?$/.test(w)) return false;
      return !SIDE.test(w) && !/^[1-4][1-9]$/.test(w) && !/^\d$/.test(w) && !skip.has(w);
    });
    playKey = rest.join(' ') || play.kind || 'play';
    playLabel = rest.join(' ') || play.kind || 'Play';
  }
  const key = [personnel, backfield || formWords.join(' '), playKey].join('|').toLowerCase();
  const label = [personnel ? `${personnel}` : '', formLabel, '·', playLabel.replace(/\b\w/g, (c) => c.toUpperCase())]
    .filter(Boolean)
    .join(' ')
    .replace(/^· /, '');
  return { key, label };
}

export interface OppPlayGroup {
  key: string;
  label: string;
  plays: ScoutOppPlay[];
}

/** Their plays put together by play type, in the order the first of each shows up. */
export function groupOppPlays(plays: ScoutOppPlay[]): OppPlayGroup[] {
  const out = new Map<string, OppPlayGroup>();
  for (const p of plays) {
    const t = oppPlayType(p);
    const g = out.get(t.key);
    if (g) g.plays.push(p);
    else out.set(t.key, { key: t.key, label: t.label, plays: [p] });
  }
  return [...out.values()];
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

/** "Ran 4 times on this film." as written on a card made from the film's tags. */
const STALE_RUN_COUNT = /\s*Ran \d+ times? on this film\.?/i;

const periodLabel = (down: string) => PERIODS.find((p) => p.id === (down || 'other'))?.label || 'Other';

export function buildScoutScript(plays: ScoutOppPlay[], opponent: string): ScoutPracticeScript {
  const who = opponent.trim() || 'Opponent';
  const lines: ScoutScriptLine[] = plays.map((p) => {
    const bits = [periodLabel(p.down), p.formation, p.personnel, p.kind].filter((s) => s && s !== '-').join(' · ');
    // The count written when the card was made from the film goes stale; the script shows the live one.
    const notes = (p.notes || '').replace(STALE_RUN_COUNT, '').trim();
    const detail = [bits, notes].filter(Boolean).join('. ');
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
/** How big the printed script is: one play per landscape page (to read outside), two, or four. */
export type ScriptPrintSize = 'big' | 'two' | 'four';
export const SCRIPT_PRINT_SIZES: { id: ScriptPrintSize; label: string }[] = [
  { id: 'big', label: 'Big: 1 play per page' },
  { id: 'two', label: '2 plays per page' },
  { id: 'four', label: '4 plays per page' },
];

export function scoutScriptPrintHtml(
  title: string,
  groups: { label: string; plays: { name: string; detail: string; diagram?: string | null; kind?: string; n?: number }[] }[],
  /** Each group (a formation) starts its own page; how many plays to a page. */
  opts: { pagePerGroup?: boolean; size?: ScriptPrintSize } = {}
): string {
  const size = opts.size || 'four';
  const large = size !== 'four';
  const sections = groups
    .filter((g) => g.plays.length)
    .map((g, gi) => {
      const cards = g.plays
        .map((p) => {
          const picture = p.diagram
            ? `<img src="${esc(p.diagram)}" alt="${esc(p.name)}"/>`
            : `<div class="empty">No diagram yet. Open this play and draw it.</div>`;
          const k = p.kind ? KIND_LOOK[p.kind] : undefined;
          const badge = k ? `<span class="kind" style="background:${k.color}">${k.label}</span>` : '';
          const edge = k ? ` style="border-left:${large ? 14 : 6}px solid ${k.color}"` : '';
          const num = large && p.n ? `<span class="num">${p.n}</span>` : '';
          // Big pages carry the formation on each play (there's no room for a heading).
          const form = large && g.label ? `<span class="form">${esc(g.label)}</span>` : '';
          return `<article class="card"${edge}><div class="head"><div class="name">${num}${badge}${esc(p.name)}</div>${form}</div>${p.detail ? `<div class="detail">${esc(p.detail)}</div>` : ''}<div class="pic">${picture}</div></article>`;
        })
        .join('');
      const counts = g.plays.some((p) => p.kind)
        ? ` <span class="count">${Object.entries(KIND_LOOK)
            .map(([id, k]) => [k.label, g.plays.filter((p) => p.kind === id).length] as const)
            .filter(([, n]) => n)
            .map(([label, n]) => `${n} ${label.toLowerCase()}`)
            .join(' · ')}</span>`
        : '';
      return `<section class="${opts.pagePerGroup && gi > 0 ? 'page' : ''}"><h2>${esc(g.label)}${counts}</h2><div class="grid">${cards}</div></section>`;
    })
    .join('');
  // Big: one play fills a landscape page. Two: a play fills half a portrait page. Four: the small grid.
  const sizeCss =
    size === 'big'
      ? `
    @page { size: letter landscape; margin: 0.3in; }
    h1, h2 { display: none; }
    .grid { display: block; }
    .card { height: 7.75in; box-sizing: border-box; display: flex; flex-direction: column; break-after: page; border: 2px solid #222; border-radius: 10px; padding: 0.12in 0.18in; }
    section:last-child .card:last-child { break-after: auto; }
    .page { break-before: auto; }
    .name { font-size: 34px; line-height: 1.1; }
    .kind { font-size: 20px; padding: 2px 10px; border-radius: 6px; margin-right: 12px; vertical-align: 5px; }
    .num { font-size: 22px; vertical-align: 5px; }
    .form { font-size: 20px; }
    .detail { font-size: 18px; color: #222; margin-top: 4px; }
    .pic { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; margin-top: 6px; }
    .pic img { width: 100%; height: 100%; object-fit: contain; margin: 0; }`
      : size === 'two'
        ? `
    @page { size: letter; margin: 0.35in; }
    h1, h2 { display: none; }
    .grid { display: block; }
    .card { height: 4.95in; box-sizing: border-box; display: flex; flex-direction: column; break-inside: avoid; border: 2px solid #222; border-radius: 10px; padding: 0.1in 0.15in; margin-bottom: 0.15in; }
    .name { font-size: 24px; line-height: 1.1; }
    .kind { font-size: 15px; padding: 2px 8px; margin-right: 10px; vertical-align: 3px; }
    .num { font-size: 17px; vertical-align: 3px; }
    .form { font-size: 15px; }
    .detail { font-size: 14px; color: #222; margin-top: 3px; }
    .pic { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; margin-top: 4px; }
    .pic img { width: 100%; height: 100%; object-fit: contain; margin: 0; }`
        : `
    @page { size: letter; margin: 0.45in; }`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title><style>
    body { font-family: system-ui, sans-serif; color: #111; margin: 0; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { break-inside: avoid; border: 1px solid #ccc; border-radius: 8px; padding: 8px; }
    .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .name { font-weight: 800; font-size: 14px; }
    .num { display: inline-block; min-width: 1.4em; text-align: center; background: #111; color: #fff; border-radius: 6px; padding: 0 6px; margin-right: 10px; font-weight: 900; }
    .form { font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
    .detail { font-size: 11px; color: #444; margin-top: 2px; }
    img { width: 100%; height: auto; margin-top: 6px; }
    .empty { margin-top: 8px; font-size: 11px; color: #666; border: 1px dashed #ccc; border-radius: 6px; padding: 16px 8px; text-align: center; }
    .page { break-before: page; }
    .kind { display: inline-block; color: #fff; font-size: 10px; font-weight: 900; letter-spacing: 0.05em; border-radius: 4px; padding: 1px 6px; margin-right: 6px; vertical-align: 2px; }
    .count { font-weight: 600; text-transform: none; letter-spacing: 0; color: #555; margin-left: 8px; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }${sizeCss}
  </style></head><body><h1>${esc(title)}</h1>${sections}</body></html>`;
}

/** Run and pass stand out on the script: the same red and blue as the lines on the diagrams. */
export const KIND_LOOK: Record<string, { label: string; color: string }> = {
  run: { label: 'RUN', color: '#e11d2a' },
  pass: { label: 'PASS', color: '#2563eb' },
  screen: { label: 'SCREEN', color: '#0891b2' },
  rpo: { label: 'RPO', color: '#7c3aed' },
};

/** The script split by formation for printing: each formation once, in the order it first comes up, plays in script order. */
export function scriptByFormation<T extends { formation?: string }>(plays: T[]): { label: string; plays: T[] }[] {
  const out = new Map<string, { label: string; plays: T[] }>();
  for (const p of plays) {
    // Hudl writes "-" for no formation.
    const raw = String(p.formation || '').trim();
    const name = raw === '-' ? '' : raw;
    const key = formationKey(name) || '—';
    if (!out.has(key)) out.set(key, { label: name || 'No formation', plays: [] });
    out.get(key)!.plays.push(p);
  }
  return [...out.values()];
}

/** Ways to put the scout script in order at once (then fine-tune by hand). */
export type ScriptOrder = 'down' | 'formation' | 'kind' | 'mix' | 'film';
export const SCRIPT_ORDERS: { id: ScriptOrder; label: string }[] = [
  { id: 'down', label: 'By down (1st, 2nd, 3rd, red zone)' },
  { id: 'formation', label: 'By formation' },
  { id: 'kind', label: 'Runs, then passes' },
  { id: 'mix', label: 'Mix runs and passes' },
  { id: 'film', label: 'As on the film' },
];

const DOWN_RANK: Record<string, number> = { '1st': 0, '2nd': 1, '3rd': 2, red: 3 };
const KIND_RANK: Record<string, number> = { run: 0, rpo: 1, screen: 2, pass: 3 };

/**
 * The script in one of those orders. Plays that tie keep their current order, so ordering by down after
 * ordering by formation keeps each down's formations together.
 */
export function orderScript(plays: ScoutOppPlay[], by: ScriptOrder, filmOrder?: ScoutOppPlay[]): ScoutOppPlay[] {
  const at = new Map(plays.map((p, i) => [p.id, i]));
  const stable = (rank: (p: ScoutOppPlay) => number) => [...plays].sort((a, b) => rank(a) - rank(b) || at.get(a.id)! - at.get(b.id)!);
  if (by === 'down') return stable((p) => DOWN_RANK[p.down] ?? 4);
  if (by === 'kind') return stable((p) => KIND_RANK[p.kind] ?? 4);
  if (by === 'formation') {
    // Formations in the order they first come up; no formation last.
    const first = new Map<string, number>();
    plays.forEach((p, i) => {
      const k = formationKey(p.formation);
      if (k && !first.has(k)) first.set(k, i);
    });
    return stable((p) => first.get(formationKey(p.formation)) ?? plays.length);
  }
  if (by === 'film') {
    const film = new Map((filmOrder || []).map((p, i) => [p.id, i]));
    return stable((p) => film.get(p.id) ?? Number.MAX_SAFE_INTEGER);
  }
  // Mix: run, pass, run, pass… while both last, then whatever is left.
  const runs = plays.filter((p) => p.kind === 'run');
  const others = plays.filter((p) => p.kind !== 'run');
  const out: ScoutOppPlay[] = [];
  while (runs.length || others.length) {
    if (runs.length) out.push(runs.shift()!);
    if (others.length) out.push(others.shift()!);
  }
  return out;
}
