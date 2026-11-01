// Scouting for an outside AI (Claude, ChatGPT...): a file with what to look for, how to answer, and every play as a
// table, to upload by hand; and the reader for the AI's answer, pasted back in. Nothing here calls an AI.
import type { Play } from '../types/football';
import { classifyRunSide } from './csvParser';
import { fieldSideOf, throwSide, twinsSide } from './passTendencies';
import { hasDirection, playStrength } from './strength';

export interface AiScoutNote {
  title: string;
  detail: string;
  /** How we answer it (a call, an adjustment), when the AI gave one. */
  answer?: string;
  /** The plays it's built on, by the file's ref column (the play's id). */
  refs?: string[];
}

export interface AiScoutNotes {
  /** The AI's read in a sentence or two. */
  summary?: string;
  items: AiScoutNote[];
  /** When the notes were put in (the newest wins when copies merge); notes removed are an empty list with a time. */
  importedAt: number;
  by?: string;
}

const isPass = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN';
const csvCell = (v: unknown) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The play's side of the field it went to (wide / middle / short), from its direction and the hash. */
function fieldWord(p: Play): string {
  const side = isPass(p) ? throwSide(p) : hasDirection(p) ? (p.runSide === 'L' || p.runSide === 'R' || p.runSide === 'M' ? p.runSide : classifyRunSide(p.direction || '', p.hash)) : undefined;
  return side ? fieldSideOf(p.hash, side) || '' : '';
}

const COLUMNS: [string, (p: Play) => unknown][] = [
  ['ref', (p) => p.id],
  ['game', (p) => p.gameId || ''],
  ['play', (p) => p.playNumber],
  ['qtr', (p) => p.quarter || ''],
  ['down', (p) => p.down || ''],
  ['dist', (p) => p.distance || ''],
  ['yard_line', (p) => p.rawYardLine || ''],
  ['hash', (p) => p.hash || ''],
  ['personnel', (p) => p.personnel || ''],
  ['formation', (p) => p.formation || ''],
  ['strength', (p) => playStrength(p) || ''],
  ['twins_side', (p) => twinsSide(p) || ''],
  ['backfield', (p) => p.backfield || ''],
  ['motion', (p) => (p.motion && p.motion !== '-' ? p.motion : '')],
  ['type', (p) => p.playType || ''],
  ['play_name', (p) => p.callName || p.playCall || p.playName || ''],
  ['direction', (p) => p.direction || ''],
  ['field_side', fieldWord],
  ['gain', (p) => p.gainLoss ?? ''],
  ['result', (p) => p.result || ''],
  ['ball_carrier_or_target', (p) => p.oppRusher || p.oppReceiver || p.carrierOrTarget || ''],
];

/** The file to upload: what to do, how to answer, the app's own read, and every play. */
export function aiExportText(
  plays: Play[],
  o: { team: string; opponent: string; mode: 'opponent' | 'own'; unit: string; appRead: string[]; ourDefense?: string }
): string {
  const who = o.mode === 'own' ? `our own team (${o.team}), as an opponent would scout us` : `${o.opponent}, the team ${o.team} plays next`;
  const rows = [COLUMNS.map(([h]) => h).join(','), ...plays.map((p) => COLUMNS.map(([, f]) => csvCell(f(p))).join(','))];
  return [
    `# Scouting ${o.mode === 'own' ? o.team : o.opponent}: ${o.unit} (${plays.length} plays)`,
    '',
    `You're helping a youth tackle football coach (${o.team}, ages 9-10) scout ${who}.`,
    'Study every play in the table below and find their real habits: what they do by down and distance, field position,',
    'formation and personnel, strength and twins side, where the ball is snapped (hash) and which side of the field it goes to',
    '(wide side or short side), run or pass, motion tells, and which players get the ball. Only call something a habit when',
    'the plays show it (say how many of how many), and point out small samples.',
    o.ourDefense ? `\nOur defense: ${o.ourDefense}. Say how we should answer each habit with it.` : '\nSay how a defense should answer each habit.',
    '',
    '## How to answer',
    'Reply with ONLY this JSON in a ```json block, nothing else. Up to 10 items, the most useful first. In refs, list the',
    "ref of every play the item is built on (the table's first column).",
    '',
    '```json',
    '{',
    '  "summary": "Who they are in one or two sentences.",',
    '  "items": [',
    '    { "title": "Short headline (with the count, like 7 of 9)", "detail": "What they do and when.", "answer": "How we stop it.", "refs": ["ref1", "ref2"] }',
    '  ]',
    '}',
    '```',
    '',
    '## Columns',
    'hash: where the ball was snapped (L, M, R). strength / twins_side: the side of the formation (L or R).',
    'direction: where the play went as the film was tagged. field_side: that side compared with the hash (wide = the side',
    'with more field, short = the boundary). gain: yards. Downs and distances are blank when the film has none.',
    '',
    ...(o.appRead.length ? ['## What the app already sees', ...o.appRead.map((l) => `- ${l}`), ''] : []),
    '## Plays (CSV)',
    '```csv',
    ...rows,
    '```',
    '',
  ].join('\n');
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * The AI's answer as notes: the JSON asked for (in a ```json block or bare), or, when it answered in words, the
 * whole answer as the summary. Throws when there's nothing in it.
 */
export function parseAiReply(text: string, by?: string, now = Date.now()): AiScoutNotes {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Paste the AI\'s answer first.');
  const block = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidates = [block, raw, raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)].filter((s): s is string => Boolean(s && s.trim()));
  for (const c of candidates) {
    try {
      const j = JSON.parse(c);
      const list = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : Array.isArray(j?.tendencies) ? j.tendencies : null;
      if (!list) continue;
      const items: AiScoutNote[] = list
        .map((it: any) => ({
          title: clean(it?.title || it?.headline || it?.name),
          detail: clean(it?.detail || it?.details || it?.description || it?.why),
          ...(clean(it?.answer || it?.counter || it?.adjustment) ? { answer: clean(it?.answer || it?.counter || it?.adjustment) } : {}),
          ...(Array.isArray(it?.refs || it?.plays) ? { refs: (it.refs || it.plays).map((r: unknown) => clean(r)).filter(Boolean) } : {}),
        }))
        .filter((it: AiScoutNote) => it.title || it.detail);
      if (!items.length && !clean(j?.summary)) continue;
      return { ...(clean(j?.summary) ? { summary: clean(j.summary) } : {}), items, importedAt: now, ...(by ? { by } : {}) };
    } catch {
      /* not JSON: try the next way */
    }
  }
  // Words only: keep them as they are.
  return { summary: raw.slice(0, 6000), items: [], importedAt: now, ...(by ? { by } : {}) };
}

/** Notes with something in them (removed notes are an empty list). */
export const hasAiNotes = (n?: AiScoutNotes | null): n is AiScoutNotes => Boolean(n && (n.items?.length || n.summary));
