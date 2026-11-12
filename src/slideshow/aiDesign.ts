// The AI designer (the program owner's own tool): the slideshow described to Claude or Gemini (every slide, what's in
// each photo from Media's tags, the clips, the songs and their beat), with the coach's instructions, and its answer
// as a plan of changes: an order, times, fades, moves, looks, words, new title cards and photo spots, and slideshow
// options. The plan is shown first and applied in one step (Undo takes it back). The keys stay on this device.
import { GEMINI_MODELS, getSavedGeminiKey, saveGeminiKey } from '../services/geminiFilmService';
import type { Highlight } from '../highlights/types';
import type { MediaData } from '../media/types';
import { LOOKS, mmss, MOTIONS, spotItem, titleItem, TRANSITIONS, type Slide } from './slideshowData';
import type { PhotoFit, PhotoLook, PhotoMotion, SlideItem, Slideshow, SlideshowOptions, SlideTransition } from './types';

// ---- Keys and choices, on this device only ----

const CLAUDE_KEY = 'slideshow_ai_claude_key';
const PREFS = 'slideshow_ai_prefs';

export const getClaudeKey = () => {
  try {
    return localStorage.getItem(CLAUDE_KEY) || '';
  } catch {
    return '';
  }
};
export const saveClaudeKey = (k: string) => {
  try {
    if (k.trim()) localStorage.setItem(CLAUDE_KEY, k.trim());
    else localStorage.removeItem(CLAUDE_KEY);
  } catch {
    /* private window */
  }
};
export { getSavedGeminiKey as getGeminiKey, saveGeminiKey };

export type AiProvider = 'claude' | 'gemini';
export const CLAUDE_MODELS: { id: string; label: string }[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best ideas)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (quicker, cheaper)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (quickest)' },
];
export { GEMINI_MODELS };

export interface AiPrefs {
  provider: AiProvider;
  claudeModel: string;
  geminiModel: string;
  /** What it should always keep in mind (the team, the tone, things to avoid). */
  standing: string;
  /** Let it look at small copies of the photos. */
  photos: boolean;
}
export const loadPrefs = (): AiPrefs => {
  const base: AiPrefs = { provider: 'claude', claudeModel: CLAUDE_MODELS[0].id, geminiModel: GEMINI_MODELS[0].id, standing: '', photos: false };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(PREFS) || '{}') };
  } catch {
    return base;
  }
};
export const savePrefs = (p: AiPrefs) => {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* private window */
  }
};

/** Quick starts for the instructions box. */
export const AI_PRESETS: { label: string; text: string }[] = [
  { label: 'Banquet tearjerker', text: 'Make this the emotional end-of-season banquet video for the families. Start slow and warm, build through the season, finish with the team together. Gentle crossfades, longer on the best photos, short heartfelt words on a few photos.' },
  { label: 'Hype video', text: 'Make it a high-energy hype video: quick cuts on the beat, the biggest plays and celebrations, pushes and zooms between slides, strong motion.' },
  { label: 'Season story', text: 'Tell the season in order, game by game. Put a title card before each game with the opponent and the week, then that game\'s photos and clips.' },
  { label: 'Every kid', text: 'Make sure every kid on the roster shows up at least once, spread through the show. Where a kid has no photo, add a photo spot labeled with his name.' },
  { label: 'Fit the song', text: 'Time everything to the music: change photos on the beat, start the music with the first photo, and end the show when the songs end.' },
  { label: 'Pick the best', text: 'Take out weak or repeated photos (blurry, nearly the same as another) and keep the strongest ones. Say what you took out.' },
];

// ---- What the AI is told ----

export interface BriefContext {
  show: Slideshow;
  slides: Slide[];
  media: MediaData;
  highlights: Highlight[];
  roster: { num: string; name: string }[];
  teamName?: string;
  songs: { name: string; seconds: number; bpm: number; start: number }[];
  /** Beats in the slideshow's seconds (for the AI to know the pace). */
  beats: number[];
}

const date = (ms?: number) => (ms ? new Date(ms).toISOString().slice(0, 16).replace('T', ' ') : undefined);

/** The slideshow as plain facts (only what helps it design). */
export function aiBrief(c: BriefContext) {
  const photoById = new Map(c.media.photos.map((p) => [p.id, p]));
  const folderById = new Map(c.media.folders.map((f) => [f.id, f]));
  const hById = new Map(c.highlights.map((h) => [h.id, h]));
  const kidName = new Map(c.roster.map((k) => [String(Number(k.num)), `#${Number(k.num)} ${k.name}`]));
  const kid = (n: string) => kidName.get(String(Number(n))) || `#${n}`;
  const slideOf = new Map(c.slides.map((s) => [s.item.id, s]));
  const o = c.show.options;
  return {
    team: c.teamName || '',
    slideshow: {
      name: c.show.name,
      runsSeconds: Math.round((c.slides.length ? c.slides[c.slides.length - 1].start + c.slides[c.slides.length - 1].seconds : 0) * 10) / 10,
      shape: o.shape,
      options: {
        transition: o.transition,
        fadeSeconds: o.fadeSeconds,
        photoSeconds: o.photoSeconds,
        titleSeconds: o.titleSeconds,
        motion: o.motion,
        motionStrength: o.motionStrength,
        photoFit: o.photoFit,
        backdrop: o.backdrop,
        look: o.look,
        vignette: o.vignette,
        logoBug: o.logoBug,
        captionAt: o.captionAt,
        fadeEnds: o.fadeEnds,
        clipSound: o.clipSound,
        musicVolume: o.musicVolume,
        musicStartsAt: o.musicDelay,
      },
    },
    songs: c.songs.map((s) => ({ name: s.name, seconds: Math.round(s.seconds), bpm: s.bpm || null, startsInto: s.start })),
    beatsPerSlideshowSecond: c.beats.length > 1 ? Math.round(((c.beats.length - 1) / (c.beats[c.beats.length - 1] - c.beats[0])) * 100) / 100 : null,
    marks: o.marks.map((m) => Math.round(m * 10) / 10),
    roster: c.roster.map((k) => `#${Number(k.num)} ${k.name}`),
    slides: c.show.items.map((it, i) => {
      const s = slideOf.get(it.id);
      const base = { n: i + 1, id: it.id, kind: it.kind, at: s ? Math.round(s.start * 10) / 10 : null, seconds: s ? Math.round(s.seconds * 10) / 10 : null, ...(it.transition ? { transition: it.transition } : {}) };
      if (it.kind === 'photo') {
        const m = photoById.get(it.photoId);
        const f = folderById.get(it.folderId);
        return {
          ...base,
          file: it.name,
          taken: date(it.takenAt),
          folder: f ? [f.path || f.name, f.gameName, f.opponent ? `vs ${f.opponent}` : '', f.date].filter(Boolean).join(' · ') : undefined,
          kids: m?.kids?.length ? m.kids.map(kid) : undefined,
          category: m?.category,
          side: m?.side,
          score: m?.score,
          tier: m?.tier,
          tags: m?.tags?.length ? m.tags : undefined,
          favorites: m?.favBy?.length || undefined,
          why: m?.curationRationale ? m.curationRationale.slice(0, 160) : undefined,
          caption: it.caption,
          motion: it.motion,
          fit: it.fit,
          look: it.look,
          placedByHand: it.frame ? true : undefined,
        };
      }
      if (it.kind === 'clip') {
        const h = hById.get(it.highlightId);
        return { ...base, title: h?.title, game: h?.game.name, kids: h?.kids.map(kid), stars: h?.rating, categories: h?.categories, note: h?.note };
      }
      if (it.kind === 'title') return { ...base, title: it.title, sub: it.sub };
      return { ...base, label: it.label };
    }),
  };
}

const KEEP = 'keep';
const DEFAULT = 'default';
const enumOf = (ids: string[], extra: string[] = [KEEP]) => ({ type: 'string', enum: [...extra, ...ids] });
const onOff = enumOf(['on', 'off']);

/** The answer's shape (every field is there; "keep" and 0 mean leave it as it is). */
export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'name', 'order', 'remove', 'slides', 'titles', 'spots', 'options'],
  properties: {
    summary: { type: 'string', description: 'What you changed and why, for the coach, in 2-5 short sentences.' },
    name: { type: 'string', description: 'A new name for the slideshow, or "" to keep it.' },
    order: { type: 'array', items: { type: 'string' }, description: 'Every slide id in the new order, or [] to keep the order.' },
    remove: { type: 'array', items: { type: 'string' }, description: 'Ids of slides to take out.' },
    slides: {
      type: 'array',
      description: 'Changes to single slides (only the ones that change).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'seconds', 'transition', 'motion', 'fit', 'look', 'caption'],
        properties: {
          id: { type: 'string' },
          seconds: { type: 'number', description: 'Seconds it is up (photos, titles, spots); 0 = keep.' },
          transition: enumOf(TRANSITIONS.map((t) => t.id), [KEEP, DEFAULT]),
          motion: enumOf(MOTIONS.filter((m) => m.id !== 'auto').map((m) => m.id), [KEEP, DEFAULT]),
          fit: enumOf(['fill', 'whole'], [KEEP, DEFAULT]),
          look: enumOf(LOOKS.map((l) => l.id), [KEEP, DEFAULT]),
          caption: { type: 'string', description: 'Words on the photo; "<keep>" to keep, "" for none.' },
        },
      },
    },
    titles: {
      type: 'array',
      description: 'New title cards.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['afterId', 'title', 'sub', 'seconds'],
        properties: {
          afterId: { type: 'string', description: 'The slide it goes after ("" = the very start).' },
          title: { type: 'string' },
          sub: { type: 'string' },
          seconds: { type: 'number', description: '0 = the usual.' },
        },
      },
    },
    spots: {
      type: 'array',
      description: 'Empty spots for photos the coach should add (a team photo, a kid with no photo yet).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['afterId', 'label', 'seconds'],
        properties: { afterId: { type: 'string' }, label: { type: 'string' }, seconds: { type: 'number' } },
      },
    },
    options: {
      type: 'object',
      additionalProperties: false,
      required: ['transition', 'fadeSeconds', 'photoSeconds', 'titleSeconds', 'motion', 'motionStrength', 'photoFit', 'backdrop', 'look', 'vignette', 'logoBug', 'captionAt', 'fadeEnds', 'clipSound', 'musicVolume', 'musicStartsAt', 'beatSync'],
      properties: {
        transition: enumOf(TRANSITIONS.map((t) => t.id)),
        fadeSeconds: { type: 'number', description: '0.3-2.5; 0 = keep.' },
        photoSeconds: { type: 'number', description: '1.5-12; 0 = keep.' },
        titleSeconds: { type: 'number', description: '1.5-10; 0 = keep.' },
        motion: enumOf(MOTIONS.map((m) => m.id)),
        motionStrength: enumOf(['subtle', 'normal', 'strong']),
        photoFit: enumOf(['auto', 'fill', 'whole']),
        backdrop: enumOf(['blur', 'black', 'team']),
        look: enumOf(LOOKS.map((l) => l.id)),
        vignette: onOff,
        logoBug: onOff,
        captionAt: enumOf(['bottom', 'top']),
        fadeEnds: onOff,
        clipSound: enumOf(['off', 'low', 'full']),
        musicVolume: { type: 'number', description: '0-1; -1 = keep.' },
        musicStartsAt: { type: 'number', description: 'Seconds into the slideshow the music starts; -1 = keep.' },
        beatSync: enumOf(['off', '1', '2', '4', '8'], [KEEP]),
      },
    },
  },
} as const;

export const SYSTEM_PROMPT = `You are a video editor and designer helping a youth football coach make a slideshow (photos, game clips, title cards, music) for the team's families.
You get the slideshow as JSON: every slide with its id, kind, time, and what's known about it (for photos: the game folder, when taken, the kids tagged by jersey, AI scores and tiers, the coach's tags and favorites; for clips: title, kids, stars). Songs come with their length and tempo (BPM).
Answer ONLY with JSON in the given shape: a plan of changes. Rules:
- Use only slide ids you were given. "order" must list every slide you keep exactly once (or be [] to keep the order). Clips keep their own length (their seconds are ignored).
- Leave anything you don't change as "keep" (or 0 / -1 / "<keep>" as described). "default" on a slide means it follows the slideshow's setting.
- Photo words (captions) are short (2-6 words), warm, and about the team or the moment; never put a kid's last name or anything embarrassing in words on screen.
- Title cards: short titles (1-5 words) with an optional short line under them.
- beatSync = how many beats each photo stays up when lined up with the music (it's done after your plan, using the real beats); "off" or "keep" to leave times alone.
- Keep it family friendly. The summary speaks to the coach plainly, says what you did, and points out anything they should add (like photo spots).`;

// ---- The answer, applied ----

type Opt<T> = T | typeof KEEP;
export interface AiPlan {
  summary: string;
  name: string;
  order: string[];
  remove: string[];
  slides: { id: string; seconds: number; transition: Opt<SlideTransition | 'default'>; motion: Opt<PhotoMotion | 'default'>; fit: Opt<PhotoFit | 'default'>; look: Opt<PhotoLook | 'default'>; caption: string }[];
  titles: { afterId: string; title: string; sub: string; seconds: number }[];
  spots: { afterId: string; label: string; seconds: number }[];
  options: Record<string, string | number>;
}

/** The answer read loosely (a model may leave things out or wrap the JSON in words). */
export function readPlan(text: string): AiPlan {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error("The AI didn't send back a plan. Try again, or say it another way.");
  const raw = JSON.parse(text.slice(start, end + 1));
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    summary: str(raw.summary),
    name: str(raw.name),
    order: arr(raw.order).filter((x: unknown) => typeof x === 'string'),
    remove: arr(raw.remove).filter((x: unknown) => typeof x === 'string'),
    slides: arr(raw.slides).map((s: any) => ({
      id: str(s?.id),
      seconds: num(s?.seconds),
      transition: str(s?.transition) || KEEP,
      motion: str(s?.motion) || KEEP,
      fit: str(s?.fit) || KEEP,
      look: str(s?.look) || KEEP,
      caption: typeof s?.caption === 'string' ? s.caption : '<keep>',
    })) as AiPlan['slides'],
    titles: arr(raw.titles).map((t: any) => ({ afterId: str(t?.afterId), title: str(t?.title), sub: str(t?.sub), seconds: num(t?.seconds) })).filter((t: { title: string }) => t.title.trim()),
    spots: arr(raw.spots).map((t: any) => ({ afterId: str(t?.afterId), label: str(t?.label), seconds: num(t?.seconds) })),
    options: raw.options && typeof raw.options === 'object' ? raw.options : {},
  };
}

const oneOf = <T extends string>(v: unknown, ids: readonly T[]): T | undefined => (typeof v === 'string' && (ids as readonly string[]).includes(v) ? (v as T) : undefined);
const clampNum = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);

export interface AppliedPlan {
  show: Slideshow;
  /** Photos lined up with the beat this many beats each, when the plan asks (done by the editor, with the beats). */
  beatEvery: 1 | 2 | 4 | 8 | null;
  changes: string[];
}

/** The plan applied to the slideshow (unknown ids are skipped; slides the order leaves out stay, at the end). */
export function applyPlan(show: Slideshow, plan: AiPlan): AppliedPlan {
  const changes: string[] = [];
  const ids = new Set(show.items.map((i) => i.id));
  let items = show.items.slice();

  // Taken out.
  const gone = new Set(plan.remove.filter((id) => ids.has(id)));
  if (gone.size) {
    items = items.filter((i) => !gone.has(i.id));
    changes.push(`Took out ${gone.size} slide${gone.size === 1 ? '' : 's'}`);
  }
  // The order.
  if (plan.order.length) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const list: SlideItem[] = [];
    for (const id of plan.order) {
      const it = byId.get(id);
      if (it && !seen.has(id)) {
        seen.add(id);
        list.push(it);
      }
    }
    for (const it of items) if (!seen.has(it.id)) list.push(it);
    if (list.some((it, k) => it !== items[k])) changes.push('Put the slides in a new order');
    items = list;
  }
  let next: Slideshow = { ...show, items };
  // Single slides.
  const trans = TRANSITIONS.map((t) => t.id);
  const motions = MOTIONS.filter((m) => m.id !== 'auto').map((m) => m.id);
  const looks = LOOKS.map((l) => l.id);
  let edited = 0;
  for (const p of plan.slides) {
    const it = next.items.find((i) => i.id === p.id);
    if (!it) continue;
    const patch: Record<string, unknown> = {};
    const drop: string[] = [];
    if (p.seconds > 0 && it.kind !== 'clip') patch.seconds = Math.min(60, Math.max(0.5, Math.round(p.seconds * 10) / 10));
    if (p.transition === DEFAULT) drop.push('transition');
    else if (oneOf(p.transition, trans)) patch.transition = p.transition;
    if (it.kind === 'photo') {
      if (p.motion === DEFAULT) drop.push('motion');
      else if (oneOf(p.motion, motions)) patch.motion = p.motion;
      if (p.fit === DEFAULT) drop.push('fit');
      else if (oneOf(p.fit, ['fill', 'whole'] as const)) patch.fit = p.fit;
      if (p.look === DEFAULT) drop.push('look');
      else if (oneOf(p.look, looks)) patch.look = p.look;
      if (p.caption !== '<keep>' && p.caption !== KEEP) {
        if (p.caption.trim()) patch.caption = p.caption.trim().slice(0, 80);
        else drop.push('caption');
      }
    }
    if (!Object.keys(patch).length && !drop.length) continue;
    edited++;
    next = {
      ...next,
      items: next.items.map((i) => {
        if (i.id !== it.id) return i;
        const out: Record<string, unknown> = { ...i, ...patch };
        for (const k of drop) delete out[k];
        return out as unknown as SlideItem;
      }),
    };
  }
  if (edited) changes.push(`Changed ${edited} slide${edited === 1 ? '' : 's'}`);
  // New title cards and spots, after their slides (in the order given).
  const add = (afterId: string, it: SlideItem) => {
    const list = next.items.slice();
    const at = afterId ? list.findIndex((i) => i.id === afterId) : -1;
    if (afterId && at < 0) list.push(it);
    else list.splice(at + 1, 0, it);
    next = { ...next, items: list };
  };
  for (const t of plan.titles) {
    const it = titleItem(t.title.trim().slice(0, 60), t.sub.trim().slice(0, 80) || undefined);
    if (t.seconds > 0 && it.kind === 'title') it.seconds = Math.min(30, Math.max(1, t.seconds));
    add(t.afterId, it);
  }
  if (plan.titles.length) changes.push(`Added ${plan.titles.length} title card${plan.titles.length === 1 ? '' : 's'}`);
  for (const s of plan.spots) {
    const it = spotItem(s.label.trim().slice(0, 60) || undefined);
    if (s.seconds > 0 && it.kind === 'spot') it.seconds = Math.min(30, Math.max(1, s.seconds));
    add(s.afterId, it);
  }
  if (plan.spots.length) changes.push(`Saved ${plan.spots.length} photo spot${plan.spots.length === 1 ? '' : 's'}`);

  // Slideshow options.
  const po = plan.options;
  const o: Partial<SlideshowOptions> = {};
  const pick = <K extends keyof SlideshowOptions>(k: K, v: SlideshowOptions[K] | undefined) => {
    if (v !== undefined && v !== show.options[k]) o[k] = v;
  };
  pick('transition', oneOf(po.transition, trans));
  pick('fadeSeconds', po.fadeSeconds ? clampNum(po.fadeSeconds, 0.3, 2.5) : undefined);
  pick('photoSeconds', po.photoSeconds ? clampNum(po.photoSeconds, 1.5, 12) : undefined);
  pick('titleSeconds', po.titleSeconds ? clampNum(po.titleSeconds, 1.5, 10) : undefined);
  pick('motion', oneOf(po.motion, MOTIONS.map((m) => m.id)));
  pick('motionStrength', oneOf(po.motionStrength, ['subtle', 'normal', 'strong'] as const));
  pick('photoFit', oneOf(po.photoFit, ['auto', 'fill', 'whole'] as const));
  pick('backdrop', oneOf(po.backdrop, ['blur', 'black', 'team'] as const));
  pick('look', oneOf(po.look, looks));
  const flag = (v: unknown) => (v === 'on' ? true : v === 'off' ? false : undefined);
  pick('vignette', flag(po.vignette));
  pick('logoBug', flag(po.logoBug));
  pick('fadeEnds', flag(po.fadeEnds));
  pick('captionAt', oneOf(po.captionAt, ['bottom', 'top'] as const));
  pick('clipSound', oneOf(po.clipSound, ['off', 'low', 'full'] as const));
  // The game sound's level follows (a slider set by hand would otherwise keep it).
  if (o.clipSound === 'full' || o.clipSound === 'low') o.gameVolume = o.clipSound === 'full' ? 1 : 0.4;
  pick('musicVolume', typeof po.musicVolume === 'number' && po.musicVolume >= 0 ? clampNum(po.musicVolume, 0, 1) : undefined);
  pick('musicDelay', typeof po.musicStartsAt === 'number' && po.musicStartsAt >= 0 ? clampNum(po.musicStartsAt, 0, 600) : undefined);
  if (Object.keys(o).length) {
    next = { ...next, options: { ...next.options, ...o } };
    changes.push(`Changed ${Object.keys(o).length} slideshow setting${Object.keys(o).length === 1 ? '' : 's'}`);
  }
  if (plan.name.trim() && plan.name.trim() !== show.name) {
    next = { ...next, name: plan.name.trim().slice(0, 80) };
    changes.push(`Renamed it “${next.name}”`);
  }
  const beat = String(po.beatSync ?? '');
  const beatEvery = beat === '1' || beat === '2' || beat === '4' || beat === '8' ? (Number(beat) as 1 | 2 | 4 | 8) : null;
  if (beatEvery) changes.push(`Lines the photos up with the beat (every ${beatEvery} beat${beatEvery === 1 ? '' : 's'})`);
  return { show: next, beatEvery, changes };
}

// ---- Asking ----

export interface AskOptions {
  provider: AiProvider;
  key: string;
  model: string;
  /** The coach's words this time, and what to always keep in mind. */
  request: string;
  standing: string;
  brief: ReturnType<typeof aiBrief>;
  /** Small copies of photos: [slide id, base64 JPEG]. */
  images?: [string, string][];
  /** Earlier requests and what it did (for "now make the ending longer"). */
  history?: { request: string; summary: string }[];
  signal?: AbortSignal;
}

const userText = (o: AskOptions) =>
  [
    o.standing.trim() ? `Always keep in mind:\n${o.standing.trim()}` : '',
    o.history?.length ? `Earlier in this session:\n${o.history.map((h) => `- Coach asked: ${h.request}\n  You did: ${h.summary}`).join('\n')}` : '',
    `The slideshow now:\n${JSON.stringify(o.brief)}`,
    o.images?.length ? `Small copies of ${o.images.length} of the photos follow, each after its slide id.` : '',
    `The coach asks: ${o.request.trim() || 'Make it look great.'}`,
  ]
    .filter(Boolean)
    .join('\n\n');

/** Ask the AI; resolves with the plan. */
export async function askForPlan(o: AskOptions): Promise<AiPlan> {
  if (!o.key.trim()) throw new Error(o.provider === 'claude' ? 'Add your Claude API key first.' : 'Add your Gemini API key first.');
  const text = o.provider === 'claude' ? await askClaude(o) : await askGemini(o);
  return readPlan(text);
}

async function askClaude(o: AskOptions): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: o.key.trim(), dangerouslyAllowBrowser: true, maxRetries: 2 });
  const content: any[] = [{ type: 'text', text: userText(o) }];
  for (const [id, data] of o.images || []) {
    content.push({ type: 'text', text: `Photo ${id}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
  }
  const thinks = !/haiku/.test(o.model);
  const run = async (structured: boolean) => {
    const stream = client.messages.stream(
      {
        model: o.model,
        max_tokens: 32000,
        ...(thinks ? { thinking: { type: 'adaptive' as const } } : {}),
        system: SYSTEM_PROMPT,
        ...(structured ? { output_config: { format: { type: 'json_schema' as const, schema: PLAN_SCHEMA as unknown as Record<string, unknown> } } } : {}),
        messages: [{ role: 'user', content }],
      },
      { signal: o.signal }
    );
    return stream.finalMessage();
  };
  let msg;
  try {
    msg = await run(true);
  } catch (err: any) {
    // A model or account without the answer-shape feature: ask again for plain JSON.
    if (err?.status === 400 && /output_config|json_schema|schema|format/i.test(String(err?.message))) msg = await run(false);
    else throw claudeError(err);
  }
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined this one. Try saying it another way.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The answer ran too long. Try a shorter request, or fewer slides at once.');
  return msg.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('');
}

function claudeError(err: any): Error {
  const status = err?.status;
  if (err?.name === 'AbortError' || /abort/i.test(String(err?.message))) return Object.assign(new Error('Stopped.'), { name: 'AbortError' });
  if (status === 401) return new Error('Claude says the API key isn’t right. Check it at console.anthropic.com → API keys.');
  if (status === 403) return new Error('Claude says this key can’t do that (permissions or billing). Check console.anthropic.com.');
  if (status === 404) return new Error('Claude doesn’t know that model for this key. Pick another model.');
  if (status === 429) return new Error('Claude is busy or the key hit its limit. Wait a minute and try again.');
  if (status === 529 || status >= 500) return new Error('Claude is overloaded right now. Try again in a minute.');
  return new Error(err?.message || String(err));
}

async function askGemini(o: AskOptions): Promise<string> {
  const parts: any[] = [{ text: `${userText(o)}\n\nAnswer with JSON matching this JSON Schema:\n${JSON.stringify(PLAN_SCHEMA)}` }];
  for (const [id, data] of o.images || []) {
    parts.push({ text: `Photo ${id}:` });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data } });
  }
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
  });
  // The model picked first, then the others (a retired one answers 404).
  const order = [o.model, ...GEMINI_MODELS.map((m) => m.id).filter((m) => m !== o.model)];
  let last = '';
  for (const m of order) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(o.key.trim())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: o.signal,
    });
    if (res.status === 404) {
      last = `Google says the model ${m} wasn't found.`;
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(json?.error?.message || res.statusText);
      if (/API key not valid|API_KEY_INVALID/i.test(msg) || res.status === 401 || res.status === 403) throw new Error('Google says the Gemini API key isn’t right (or can’t use Gemini).');
      if (res.status === 429) throw new Error('Gemini hit its limit for now (free keys allow so many a minute / day). Wait and try again, or use Claude.');
      throw new Error(`Gemini: ${msg}`);
    }
    const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
    if (!text) throw new Error(json?.promptFeedback?.blockReason ? `Gemini declined (${json.promptFeedback.blockReason}).` : 'Gemini sent back nothing. Try again.');
    return text;
  }
  throw new Error(last || 'No Gemini model answered.');
}

/** A plain-words list of what a plan does, for the coach to read before applying it. */
export function planLines(plan: AiPlan, show: Slideshow): string[] {
  const lines = applyPlan(show, plan).changes;
  const caps = plan.slides.filter((s) => s.caption && s.caption !== '<keep>' && s.caption !== KEEP && s.caption.trim()).length;
  if (caps) lines.push(`Words on ${caps} photo${caps === 1 ? '' : 's'}`);
  return lines;
}

/** "1:05" for the brief's people. */
export { mmss };
