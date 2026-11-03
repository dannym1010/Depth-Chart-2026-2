// Compare plays: ask an AI coach why one play gets to the line (the hole) faster than the other. Pictures of both
// videos from just before the snap to contact, with the times the coach marked, go to the AI the Film Room already
// uses (Google Gemini with this device's key, or the model on this computer with Ollama). It answers in plain text.
import {
  checkOllama,
  geminiAnswerText,
  geminiCandidates,
  getSavedAiEngine,
  getSavedGeminiKey,
  getSavedGeminiModel,
  getSavedOllamaModel,
  OLLAMA_URL,
  pickOllamaModel,
} from '../services/geminiFilmService';
import { compareSplits, MOMENTS, type Moments } from './compareTiming';

export interface AiSide {
  /** "Us" or the other team's name. */
  team: string;
  ours: boolean;
  /** "#12 · 1st & 10 · Wing T Rt · 34 Sweep". */
  title: string;
  facts: { label: string; value: string }[];
  moments: Moments;
}

export interface AiFrame {
  /** Seconds after the snap (negative before it). */
  fromSnap: number;
  dataUrl: string;
}

/** Where the pictures start and stop: just before the snap to contact (else the hole + 1 s, else 3.5 s on). */
export function pictureWindow(m: Moments, duration: number, snapGuess?: number | null): { start: number; end: number; snap: number } {
  const snap = m.snap ?? snapGuess ?? Math.min(2, duration / 4);
  const end = m.contact ?? m.whistle ?? (m.hole != null ? m.hole + 1 : snap + 3.5);
  const clamp = (t: number) => Math.max(0, Math.min(duration || t, t));
  const start = clamp(snap - 0.4);
  return { start, end: Math.max(clamp(end), start + 0.5), snap };
}

/** Evenly spaced times from start to end, `n` of them (both ends included). */
export const evenTimes = (start: number, end: number, n: number) =>
  Array.from({ length: Math.max(2, n) }, (_, i) => Math.round((start + ((end - start) * i) / (Math.max(2, n) - 1)) * 1000) / 1000);

/** The question for the AI: who is who, the two plays, the times marked, and what to look for. */
export function buildPrompt(a: AiSide, b: AiSide, framesA: AiFrame[], framesB: AiFrame[], note = ''): string {
  const ours = a.ours ? a : b.ours ? b : undefined;
  const other = ours === a ? b : ours === b ? a : undefined;
  const splits = compareSplits(a.moments, b.moments).filter((s) => s.a != null || s.b != null);
  const secs = (x?: number) => (x == null ? 'not marked' : `${x.toFixed(2)} s`);
  const side = (s: AiSide, name: string) =>
    [
      `${name}: ${s.team}${s.ours ? ' (OUR team)' : ''} — ${s.title}`,
      ...s.facts.filter((f) => f.value).map((f) => `  ${f.label}: ${f.value}`),
      `  Moments marked (seconds into the clip): ${MOMENTS.filter((m) => s.moments[m.id] != null).map((m) => `${m.label} ${s.moments[m.id]!.toFixed(2)}`).join(', ') || 'none'}`,
    ].join('\n');
  const pics = (frames: AiFrame[], name: string, first: number) =>
    frames.map((f, i) => `Picture ${first + i}: ${name}, ${f.fromSnap >= 0 ? `${f.fromSnap.toFixed(2)} s after` : `${(-f.fromSnap).toFixed(2)} s before`} the snap`).join('\n');
  const videos = !framesA.length && !framesB.length;
  const media = videos
    ? 'Two videos are attached: Play A first, then Play B. Use the moments marked above to find the snap in each.'
    : `The pictures come in two runs, Play A first, then Play B, each from just before the snap to contact:
${pics(framesA, 'Play A', 1)}
${pics(framesB, 'Play B', framesA.length + 1)}`;
  const cite = videos ? 'each saying which play and about how many seconds after the snap it shows' : 'each naming the picture numbers that show it';
  return `You are an experienced youth football offensive coach (10-12 year olds) and a film analyst. A coach is comparing two run plays from the same formation, filmed from the sideline, to learn how ${ours ? 'our team' : 'one team'} can get the ball carrier to the line of scrimmage and through the hole faster.

${side(a, 'PLAY A')}

${side(b, 'PLAY B')}

Times measured by the coach:
${splits.length ? splits.map((s) => `  ${s.label}: Play A ${secs(s.a)}, Play B ${secs(s.b)}${s.faster ? ` (Play ${s.faster.toUpperCase()} is ${s.diff!.toFixed(2)} s quicker)` : ''}`).join('\n') : '  none marked'}

${media}
${note ? `\nThe coach adds: ${note}\n` : ''}
Look at, for each play: the backs' alignment (depth and width from the ball), stance, the first step and the path (straight downhill or bending, false steps, drifting), the quarterback's footwork to the mesh and where the handoff happens (depth, how far from the line), the ball carrier's speed and aiming point, and the offensive line's get-off and the space at the hole.

Answer in plain text a coach can read on a phone, with these headings:
1. Bottom line — two sentences: which play gets to the line faster, and the main reason.
2. What ${other ? other.team : 'the faster play'} does differently — up to 5 points, ${cite}.
3. How ${ours ? 'we' : 'the slower play'} get${ours ? '' : 's'} to the line faster — up to 5 concrete changes (alignment depth in yards, steps, path, mesh point), most important first.
4. Drills — 2 or 3 short practice drills for those changes.
5. What I couldn't see — anything the ${videos ? 'videos' : 'pictures'} don't show well (say so rather than guess).
Use the times above when they help. Don't invent numbers or players you can't see.`;
}

/** Pictures of a video at the given times, from a hidden copy (the video on screen isn't moved). */
export async function captureAt(video: HTMLVideoElement, times: number[], maxDim = 960): Promise<string[]> {
  const src = video.currentSrc || video.src;
  if (!src) throw new Error("A video isn't loaded yet. Let both play, then ask again.");
  const copy = document.createElement('video');
  copy.muted = true;
  copy.playsInline = true;
  copy.preload = 'auto';
  if (video.crossOrigin) copy.crossOrigin = video.crossOrigin;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Couldn't open a video to take pictures (timed out).")), 20000);
    copy.addEventListener('loadeddata', () => (window.clearTimeout(timer), resolve()), { once: true });
    copy.addEventListener('error', () => (window.clearTimeout(timer), reject(new Error("Couldn't open a video to take pictures."))), { once: true });
    copy.src = src;
  });
  const w = copy.videoWidth || 1280;
  const h = copy.videoHeight || 720;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("This browser can't take pictures of the video.");
  const out: string[] = [];
  try {
    for (const t of times) {
      await new Promise<void>((resolve) => {
        const soft = window.setTimeout(resolve, 2500);
        copy.addEventListener('seeked', () => (window.clearTimeout(soft), resolve()), { once: true });
        copy.currentTime = Math.max(0, Math.min((copy.duration || t) - 0.05, t));
      });
      await new Promise((r) => setTimeout(r, 40));
      ctx.drawImage(copy, 0, 0, canvas.width, canvas.height);
      out.push(canvas.toDataURL('image/jpeg', 0.85));
    }
  } finally {
    copy.removeAttribute('src');
    copy.load();
  }
  return out;
}

export type AiEngineUsed = 'gemini' | 'ollama';

/** Which AI will answer: Gemini when this device has a key, else Ollama on this computer, else none. */
export function compareAiEngine(): AiEngineUsed | null {
  // Only a coach's own pick of Ollama counts (the saved engine falls back to it whenever there's no key, which on
  // an iPad or another computer just fails).
  let picked = '';
  try {
    picked = localStorage.getItem('football_ai_engine') || '';
  } catch {
    /* none */
  }
  if (picked === 'ollama' && getSavedAiEngine() === 'ollama') return 'ollama';
  return getSavedGeminiKey() ? 'gemini' : null;
}

/** Ask the AI. `frames` are all the pictures in order (Play A's, then Play B's). Returns its answer as text. */
export async function askCompareAi(prompt: string, frames: string[], onStatus?: (s: string) => void): Promise<string> {
  const engine = compareAiEngine();
  if (engine === 'ollama') return askOllamaText(prompt, frames, onStatus);
  const key = getSavedGeminiKey();
  if (!key) throw new Error('NO_KEY');
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }, ...frames.map((d) => ({ inlineData: { mimeType: 'image/jpeg', data: d.split(',')[1] } }))] }],
    generationConfig: { temperature: 0.3 },
  };
  let last = '';
  for (const m of geminiCandidates(getSavedGeminiModel())) {
    onStatus?.(`Asking Google Gemini (${m})… this takes about half a minute.`);
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('No connection to Google (check the internet connection).');
    }
    if (res.ok) {
      const text = geminiAnswerText(await res.json());
      if (text) return text;
      last = 'Google answered with nothing.';
      continue;
    }
    const err = (await res.text()).slice(0, 400);
    if (/API key not valid|API_KEY_INVALID/i.test(err) || res.status === 401 || res.status === 403) throw new Error("Google refused this device's Gemini key. Paste the key again below.");
    last = res.status === 429 ? 'Every Gemini model is out of free uses for now (the daily allowance resets at 3 AM Eastern).' : `Google error ${res.status}: ${err.slice(0, 160)}`;
  }
  throw new Error(last || 'No Gemini model answered.');
}

async function askOllamaText(prompt: string, frames: string[], onStatus?: (s: string) => void): Promise<string> {
  const check = await checkOllama();
  if (!check.ok) throw new Error(check.error || "Couldn't reach Ollama on this computer.");
  const model = pickOllamaModel(getSavedOllamaModel(), check.models);
  onStatus?.(`Asking the model on this computer (${model})… this can take a few minutes.`);
  // A small model can't take many pictures: a few of each play, evenly.
  const half = Math.floor(frames.length / 2);
  const pick = (list: string[], n: number) => (list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]));
  const few = [...pick(frames.slice(0, half), 4), ...pick(frames.slice(half), 4)];
  const url = (await fetch('/api/ollama/tags').then((r) => r.ok).catch(() => false)) ? '/api/ollama/chat' : `${OLLAMA_URL}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: '30m',
      options: { temperature: 0.3, num_ctx: 16384 },
      messages: [{ role: 'user', content: `${prompt}\n\n(Only ${few.length / 2} pictures of each play were sent, evenly spaced over the same span.)`, images: few.map((d) => d.split(',')[1]) }],
    }),
  });
  if (!res.ok) throw new Error(`The model on this computer answered ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  const text = String(j?.message?.content || '').trim();
  if (!text) throw new Error('The model on this computer answered with nothing.');
  return text;
}

/** A file name for a downloaded clip: "Us #12 34 Sweep.mp4". */
export function clipFileName(team: string, playNumber: number | string, play: string, type: string): string {
  const ext = /quicktime/i.test(type) ? 'mov' : /webm/i.test(type) ? 'webm' : 'mp4';
  const base = `${team} #${playNumber}${play ? ` ${play}` : ''}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${base}.${ext}`;
}
