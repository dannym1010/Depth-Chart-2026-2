// AI-powered video clip analyzer for youth football film breakdown using Gemini multimodal vision.
// Extracts keyframes from HTML5 video, analyzes schemes/players/down-and-distance, and populates Hudl breakdown rows.
import type { Play, TeamUnit } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import type { BreakdownRow } from '../filmroom/breakdownEntry';
import { crossCheckPlayYardage } from './yardageCalculator';
import { evenTimes, findSnapWithCamera, frameChange, pictureTimes, type SnapGuess } from '../filmroom/snapFinder';
import { PASS_CONCEPTS, RUN_CONCEPTS, TAGS, buildCallName } from '../filmroom/callName';
import type { CallParts } from '../hudlScout/types/football';

export interface FilmGameContext {
  gameType: 'our_game' | 'scout_game';
  ourTeamName: string;
  opponentTeamName: string;
  scoutedTeam?: string;
  offenseTeam: string;
  defenseTeam: string;
  offenseJerseyColor?: string;
  defenseJerseyColor?: string;
  linkOurRoster: boolean;
  ourUnitRole: 'offense' | 'defense' | 'none';
}

export interface AiFilmAnalysisResult {
  odk: 'O' | 'D' | 'K';
  scoutedTeam?: string;
  quarter: number;
  down: number;
  distance: number;
  yardLine: string; // e.g. "-25", "+34", "OWN 40", "OPP 20"
  hash: 'L' | 'M' | 'R' | '';
  formation: string; // e.g. "Trips Right", "Wishbone", "Pro I-Form", "Double Wing", "Spread"
  backfield: string; // e.g. "I-Form", "Shotgun", "Pistol", "Wishbone"
  motion: string; // e.g. "Jet Left", "None"
  playType: 'Run' | 'Pass' | 'RPO' | 'Screen' | 'KO' | 'KO Rec' | 'Punt' | 'Punt Rec' | 'PAT' | 'FG';
  playName: string; // e.g. "26 Dive", "31 Sweep", "Power O", "Quick Slant", "Smash"
  playDir: 'L' | 'M' | 'R' | '';
  result: string; // "Rush", "Complete", "Incomplete", "Sack", "Scramble", "Interception", "Fumble", "Rush, TD", "Complete, TD"
  gainLoss: number;
  carrierNum?: string; // e.g. "21"
  carrierName?: string; // e.g. "Nash Ward"
  passerNum?: string;
  passerName?: string;
  receiverNum?: string;
  receiverName?: string;
  defensiveFront?: string; // e.g. "4-4 Stack", "5-3 Over", "Cover 3 Liz", "A-Gap Blitz"
  tacklerNums?: string[]; // e.g. ["52", "99"]
  tacklerNames?: string[];
  coachingNotes: string; // Tactical description of blocking, pursuit, and gap fit
  isExplosive?: boolean;
  isEfficient?: boolean;
  confidenceScore: number; // 0 - 100
  // Smart Yardage & Penalty Cross-Check
  whistleYardLine?: string; // Where runner was tackled on whistle
  nextPlayYardLine?: string; // Next play LOS from playlist
  spotAligned?: boolean; // True if next play LOS matches tackle spot
  penaltyDetected?: boolean; // True if discrepancy indicates penalty
  penaltyDetails?: string; // Description e.g. "Offensive Holding (-10 yds)"
  penaltyYards?: number;
  penaltyOn?: 'Offense' | 'Defense' | 'None';
  /** Where the gain came from: the next snap (same drive), the goal line (TD), or the film (an estimate). */
  yardageSource?: 'next snap' | 'touchdown' | 'film' | 'none';
  /** The film's own estimate, when the next snap decided the gain (shown when they differ). */
  filmGain?: number;
  /** The play name's parts as the AI saw them (personnel, QB, strength, tags, concept), checked against the lists. */
  callParts?: CallParts;
  /** The name those parts make ("21 Gun Rt Twins Toss"). */
  callName?: string;
  /** Which pictures (from 1) the AI saw the snap in and the play end in; 0 when it couldn't tell. */
  snapFrame?: number;
  endFrame?: number;
}

export interface ExtractedFrame {
  timestamp: number;
  label: string;
  dataUrl: string;
}

const GEMINI_STORAGE_KEY = 'football_gemini_api_key';
const GEMINI_MODEL_KEY = 'football_gemini_model';

export const getSavedGeminiKey = (): string => {
  try {
    const saved = localStorage.getItem(GEMINI_STORAGE_KEY) || '';
    if (saved) return saved.trim();
    const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GEMINI_API_KEY ||
      (import.meta as unknown as { env?: Record<string, string> }).env?.GEMINI_API_KEY || '';
    return envKey.trim();
  } catch {
    return '';
  }
};

export const saveGeminiKey = (key: string) => {
  try {
    if (key.trim()) localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
    else localStorage.removeItem(GEMINI_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

/** Google's models to read film with (their "-latest" names follow each new version on their own). */
export const GEMINI_MODELS: { id: string; label: string }[] = [
  { id: 'gemini-flash-latest', label: 'Gemini Flash (newest, recommended)' },
  { id: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (faster, more free uses a day)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
];

export const getSavedGeminiModel = (): string => {
  try {
    const saved = localStorage.getItem(GEMINI_MODEL_KEY);
    if (saved && GEMINI_MODELS.some((m) => m.id === saved)) return saved;
    // An old or retired choice ("gemini-1.5-flash", a made-up "3.8"): the recommended one.
    localStorage.setItem(GEMINI_MODEL_KEY, GEMINI_MODELS[0].id);
    return GEMINI_MODELS[0].id;
  } catch {
    return GEMINI_MODELS[0].id;
  }
};

/** The models to try, in order: the chosen one, then the others (each has its own free allowance). */
export function geminiCandidates(chosen: string): string[] {
  return Array.from(new Set([chosen, ...GEMINI_MODELS.map((m) => m.id)].filter(Boolean)));
}

// ---------------------------------------------------------------------------
// Which AI reads the film: Google's Gemini (a key), or a model running on this computer with Ollama
// (free, private, only on the computer that has it; ollama.com).
// ---------------------------------------------------------------------------
export type AiEngine = 'gemini' | 'ollama';
const AI_ENGINE_KEY = 'football_ai_engine';
const OLLAMA_MODEL_KEY = 'football_ollama_model';
export const OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen3-vl:8b-instruct';
/** Models that can look at pictures (a name like these), to pick one this computer already has. */
const VISION_MODEL = /(-vl|vl:|llava|vision|gemma3|minicpm-v|moondream|qwen2\.5vl|qwen3-vl)/i;
/** The model to use: the one saved when this computer has it, else a picture-reading model it has. */
export function pickOllamaModel(saved: string, installed: string[]): string {
  const has = (m: string) => installed.some((x) => x === m || x === `${m}:latest`);
  if (saved && has(saved)) return saved;
  return installed.find((m) => VISION_MODEL.test(m)) || saved;
}

export const getSavedAiEngine = (): AiEngine => {
  try {
    return localStorage.getItem(AI_ENGINE_KEY) === 'ollama' ? 'ollama' : 'gemini';
  } catch {
    return 'gemini';
  }
};
export const saveAiEngine = (engine: AiEngine) => {
  try {
    localStorage.setItem(AI_ENGINE_KEY, engine);
  } catch {
    /* ignore */
  }
};
export const getSavedOllamaModel = (): string => {
  try {
    return (localStorage.getItem(OLLAMA_MODEL_KEY) || '').trim() || DEFAULT_OLLAMA_MODEL;
  } catch {
    return DEFAULT_OLLAMA_MODEL;
  }
};
export const saveOllamaModel = (model: string) => {
  try {
    if (model.trim()) localStorage.setItem(OLLAMA_MODEL_KEY, model.trim());
    else localStorage.removeItem(OLLAMA_MODEL_KEY);
  } catch {
    /* ignore */
  }
};

/** Whether Ollama answers on this computer, and the models it has downloaded. */
export async function checkOllama(): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { ok: false, models: [], error: `Ollama answered ${res.status}.` };
    const j = await res.json();
    return { ok: true, models: (j?.models || []).map((m: any) => String(m?.name || '')).filter(Boolean) };
  } catch {
    return {
      ok: false,
      models: [],
      error:
        "Couldn't reach Ollama on this computer. Make sure it's running (the llama icon by the clock), that this site is allowed (OLLAMA_ORIGINS), and allow \"local network\" if the browser asks.",
    };
  }
}

/** One play's frames to the model running on this computer; its answer as text (JSON). */
async function askOllama(savedModel: string, prompt: string, frames: ExtractedFrame[], onStatusUpdate?: (s: string) => void): Promise<string> {
  // The saved model when this computer has it, else a picture-reading model it does have.
  const check = await checkOllama();
  if (!check.ok) throw new Error(check.error || "Couldn't reach Ollama on this computer.");
  const model = pickOllamaModel(savedModel, check.models);
  onStatusUpdate?.(`Reading the play on this computer (${model})… the first one takes longer while it loads.`);
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        // Straight to the answer: a model that "thinks" first takes minutes a play.
        think: false,
        // Stay loaded between plays of a breakdown (loading takes a while).
        keep_alive: '30m',
        // Room for eight frames and the instructions.
        options: { temperature: 0.15, num_ctx: 16384 },
        messages: [{ role: 'user', content: prompt, images: frames.map((f) => f.dataUrl.split(',')[1]).filter(Boolean) }],
      }),
    });
  } catch {
    throw new Error((await checkOllama()).error || "Couldn't reach Ollama on this computer.");
  }
  if (res.status === 404) throw new Error(`The model "${model}" isn't on this computer yet. In PowerShell run: ollama pull ${model}`);
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    // Loading the model needs about 6 GB of free memory (RAM); a game or other big program can crowd it out.
    if (/llama-server to start|out of memory|insufficient memory|requires more system memory/i.test(text)) {
      throw new Error(
        "The model on this computer couldn't load: not enough free memory. Close games and other big programs, then try again (the first play takes about a minute to load)."
      );
    }
    throw new Error(`Ollama error (${res.status}): ${text.slice(0, 200)}`);
  }
  const j = await res.json();
  return String(j?.message?.content || '');
}

export const saveGeminiModel = (model: string) => {
  try {
    localStorage.setItem(GEMINI_MODEL_KEY, model);
  } catch {
    /* ignore */
  }
};

/**
 * Capture evenly spaced keyframes from an HTML5 video element.
 * Takes snapshots at pre-snap, snap/mesh, point of attack, and whistle/tackle.
 */
export async function captureVideoKeyframes(
  video: HTMLVideoElement,
  frameCount = 8,
  maxDimension = 1280,
  opts: {
    /** 'even': about one picture a second over the whole clip; 'snap': find the snap and aim the pictures at the
     * play; otherwise fixed points of the clip. */
    mode?: 'even' | 'snap';
    onStatus?: (s: string) => void;
  } = {}
): Promise<ExtractedFrame[]> {
  // A hidden copy of the clip: the player on screen is never moved. (Moving it near the end of the clip made
  // it go on to the next play by itself, and the capture then waited forever for a clip that had changed.)
  const src = video.currentSrc || video.src;
  if (!src) throw new Error("This play's clip isn't loaded yet. Let it start playing, then run the breakdown again.");
  const copy = document.createElement('video');
  copy.muted = true;
  copy.playsInline = true;
  copy.preload = 'auto';
  if (video.crossOrigin) copy.crossOrigin = video.crossOrigin;
  const within = <T,>(ms: number, what: string, run: (done: (v: T) => void, fail: (e: Error) => void) => void): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(what)), ms);
      run(
        (v) => {
          window.clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          window.clearTimeout(timer);
          reject(e);
        }
      );
    });
  await within<void>(20000, "Couldn't load this play's clip to read it (timed out).", (done, fail) => {
    copy.addEventListener('loadeddata', () => done(), { once: true });
    copy.addEventListener('error', () => fail(new Error("Couldn't load this play's clip to read it.")), { once: true });
    copy.src = src;
  });
  const duration = copy.duration && Number.isFinite(copy.duration) ? copy.duration : video.duration || 10;

  const seekTo = (t: number) =>
    within<void>(8000, "Couldn't step through this play's clip (timed out).", (done) => {
      copy.addEventListener('seeked', () => done(), { once: true });
      copy.currentTime = t;
    });

  // Which moments to show the AI.
  let timestamps: { t: number; label: string }[];
  if (opts.mode === 'even') {
    timestamps = evenTimes(duration, frameCount);
  } else if (opts.mode === 'snap') {
    opts.onStatus?.('Finding the snap in the clip…');
    let guess: SnapGuess | null = null;
    try {
      guess = await snapOfClip(copy, duration, seekTo);
    } catch {
      guess = null; // a picture the page can't read (another site's video): the fixed points
    }
    timestamps = pictureTimes(guess, duration, frameCount);
  } else {
    timestamps = pictureTimes(null, duration, frameCount);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  const width = copy.videoWidth || video.videoWidth || 1280;
  const height = copy.videoHeight || video.videoHeight || 720;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const frames: ExtractedFrame[] = [];

  try {
    for (const item of timestamps) {
      const targetTime = Math.min(Math.max(0.1, duration - 0.1), Math.max(0.1, item.t));
      await seekTo(targetTime);
      // Brief wait to ensure frame decodes
      await new Promise((r) => setTimeout(r, 60));
      ctx.drawImage(copy, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      frames.push({ timestamp: targetTime, label: item.label, dataUrl });
    }
  } finally {
    copy.removeAttribute('src');
    copy.load();
  }

  return frames;
}

/**
 * Where the snap is in the clip: three small grey pictures a second (the first 30 s), the camera's move and the
 * players' move between each, then findSnapWithCamera.
 */
async function snapOfClip(copy: HTMLVideoElement, duration: number, seekTo: (t: number) => Promise<void>): Promise<SnapGuess | null> {
  const FPS = 3, W = 96, H = 54;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return null;
  const grey = () => {
    x.drawImage(copy, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data;
    const g = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
    return g;
  };
  const samples: { camera: number; players: number }[] = [];
  let last: Uint8Array | null = null;
  const end = Math.min(duration - 0.05, 30);
  // At most 12 s on this: a clip that's slow to step through gets the pictures spread over it instead.
  const started = Date.now();
  for (let t = 0.05; t < end; t += 1 / FPS) {
    if (Date.now() - started > 12000) return null;
    await seekTo(t);
    const g = grey();
    samples.push(last ? frameChange(last, g, W, H) : { camera: 0, players: 0 });
    last = g;
  }
  return findSnapWithCamera(samples, FPS);
}

/**
 * Format active roster into prompt context for jersey number and position resolution.
 */
function formatRosterContext(roster: RosterPlayer[]): string {
  if (!roster.length) return 'No active roster loaded.';
  return roster
    .map((p) => `#${p.num} ${p.firstName} ${p.lastName} (${[p.primaryPosition, p.offensivePosition, p.defensivePosition].filter(Boolean).join('/') || 'Player'})`)
    .join(', ');
}

export interface AnalyzeFilmOptions {
  frames: ExtractedFrame[];
  play?: Play;
  roster?: RosterPlayer[];
  knownFormations?: string[];
  knownPlays?: string[];
  /** The play names this team's coaches made ("21 Gun Rt Twins Toss"): the AI uses their words. */
  knownNames?: string[];
  /** The pictures are spread over the whole clip (the AI finds the snap), not aimed at the moments of a play. */
  framesCoverClip?: boolean;
  opponentName?: string;
  userPrompt?: string;
  apiKey?: string;
  modelName?: string;
  onStatusUpdate?: (status: string) => void;
  /** Which AI reads the film (default: the one saved on this device). */
  engine?: AiEngine;
  /** The Ollama model, for engine 'ollama'. */
  ollamaModel?: string;
  // Game Setup & Context
  gameType?: 'our_game' | 'scout_game';
  ourTeamName?: string;
  scoutedTeam?: string;
  offenseTeam?: string;
  defenseTeam?: string;
  offenseJerseyColor?: string;
  defenseJerseyColor?: string;
  linkOurRoster?: boolean;
  ourUnitRole?: 'offense' | 'defense' | 'none';
  // Next Play for Yardage & Penalty Verification
  nextPlayStartYard?: string;
  nextPlayOdk?: string;
}

/**
 * Calls Gemini Multimodal Vision API to break down football video frames into structured stats.
 */
export async function analyzeFilmWithGemini(opts: AnalyzeFilmOptions): Promise<AiFilmAnalysisResult> {
  const {
    frames,
    play,
    roster = [],
    knownFormations = [],
    knownPlays = [],
    knownNames = [],
    framesCoverClip = false,
    opponentName = 'Opponent',
    userPrompt = '',
    apiKey = getSavedGeminiKey(),
    modelName = getSavedGeminiModel(),
    onStatusUpdate,
    gameType = 'our_game',
    ourTeamName = 'Mahopac 10U',
    scoutedTeam = gameType === 'our_game' ? ourTeamName : opts.offenseTeam || opponentName,
    offenseTeam = 'Our Team',
    defenseTeam = opponentName,
    offenseJerseyColor = 'Dark',
    defenseJerseyColor = 'White',
    linkOurRoster = gameType === 'our_game',
    ourUnitRole = 'offense',
    nextPlayStartYard,
    nextPlayOdk,
    engine = getSavedAiEngine(),
    ollamaModel = getSavedOllamaModel(),
  } = opts;

  const cleanKey = apiKey.trim();

  // No key: no breakdown (never a made-up one passed off as real). A model on this computer needs none.
  if (engine !== 'ollama' && !cleanKey) {
    throw new Error('No Gemini API key on this device. Open the key settings (the gear at the top of this window), paste your key and save it, then run the breakdown again.');
  }

  const isScout = gameType === 'scout_game';
  // Numbers and positions only: players' names never leave this device (they're matched back here).
  const rosterNums = linkOurRoster ? roster.map((p) => String(p.num || '').trim()).filter(Boolean) : [];
  const positionOf = (p: RosterPlayer) => [p.offensivePosition, p.defensivePosition].filter(Boolean).join('/') || p.primaryPosition || '';
  const rosterLine =
    linkOurRoster && roster.length
      ? roster
          .filter((p) => String(p.num || '').trim())
          .map((p) => `#${p.num}${positionOf(p) ? ` ${positionOf(p)}` : ''}`)
          .join(', ')
      : '';
  const vocab = (list: string[], n: number) => [...new Set(list.map((s) => String(s || '').trim()).filter((s) => s && s !== '-'))].slice(0, n);
  const forms = vocab(knownFormations, 25);
  const names = vocab([...knownNames, ...knownPlays], 35);

  // What the play's own data already says (from Hudl or the breakdown): trusted over a guess from frames.
  const startLOS = play?.rawYardLine || '';
  const step = frames.length > 1 ? (frames[frames.length - 1].timestamp - frames[0].timestamp) / (frames.length - 1) : 0;

  const systemInstruction = `You are a film analyst for youth tackle football (10 and under). You get pictures from ONE play's video, in time order, and fill in a Hudl-style breakdown for the coaches.
A blank ("" or 0) is ALWAYS better than a guess: coaches build their game plan on what you write.

THE GAME
- ${isScout ? 'Scouting film: two other teams playing each other. Report jersey numbers only.' : `Our game: ${ourTeamName} vs ${opponentName}.`}
- The team being scouted: ${scoutedTeam}.
- On this play ${offenseTeam} has the ball (jerseys: ${offenseJerseyColor}) and ${defenseTeam} is on defense (jerseys: ${defenseJerseyColor}).
${rosterLine ? `- ${ourTeamName}'s jersey numbers (and positions): ${rosterLine}.` : ''}

THE PICTURES
${
  framesCoverClip
    ? `- They are spread over the whole clip, about ${step.toFixed(1)} s apart. The clip may start with players walking to the line and end after the whistle.
- Find the snap yourself: "snapFrame" = the number of the first picture after the ball is snapped (count from 1). "endFrame" = the first picture where the play is over (carrier down or out of bounds, pass incomplete, or a score). 0 if you can't tell.`
    : `- Each is labelled with the moment of the play it tries to show (pre-snap, snap, handoff ... whistle). "snapFrame" and "endFrame": the numbers of the pictures (from 1) where the snap has just happened and where the play is over; 0 if you can't tell.`
}

WHAT TO FILL IN
1. Formation and play name, the way a coach calls it (from the last picture before the snap):
   - "personnel": two digits, running backs then tight ends (21 = two backs and one tight end; 10 = one back, no tight end). "" if you can't count them.
   - "qb": "UC" (under center), "Gun" (shotgun, about 4-5 yards behind the center) or "Pistol" (3-4 yards behind, a back behind him). "" if you can't see.
   - "strength": "R" or "L", the side with the tight end / more receivers, from the offense's view (as its quarterback faces the defense). "" if balanced or unsure.
   - "tags": the ones that fit, from: ${TAGS.join(', ')}.
   - "concept": what the play is, one of: ${[...RUN_CONCEPTS, ...PASS_CONCEPTS].join(', ')}. "" if you can't tell.
   - "formation": ${forms.length ? `when one of the coaches' own formation names fits, use it exactly: ${forms.join(', ')}. Otherwise a short description.` : 'a short description ("Twins Rt", "Wing Left").'}
   - "playName": ${names.length ? `when one of the coaches' own play names fits, use it exactly: ${names.join(', ')}. Otherwise the concept.` : 'the concept ("Toss", "Dive").'}
   - "playType": "Run", "Pass", "RPO" or "Screen"; kicks: "KO", "Punt", "PAT".
   - "playDir": where the ball went, from the offense's view: "L", "M" or "R".
2. Who carried the ball:
   - Follow the football from the snap. The carrier is the player holding it in the later pictures (after the handoff, pitch or catch), not the quarterback who handed it off.
   - Read his jersey number from the back, chest or shoulders, whichever picture shows it clearest. "carrierNum" = those digits, "carrierConfidence" (0-100) = how sure you are of them.
   - Digits you can't read in any picture: "carrierNum": "" and "carrierConfidence": 0. NEVER GUESS A NUMBER.
   ${rosterNums.length && ourUnitRole === 'offense' ? `- ${ourTeamName} has the ball: the carrier wears one of: ${rosterNums.join(', ')}. A number you read that isn't one of them: leave it blank.` : ''}
   - On a pass: "passerNum" and "receiverNum", only when the digits are readable.
3. Where it started and ended (yard lines from the side of the team WITH the ball: "-35" is its own 35, "+35" the other team's 35; forward from -35 goes -40, then 50, then +45):
   - Snapped at: ${startLOS || 'not known; read it from the field numbers in the last picture before the snap, or leave it ""'}. Put it in "yardLine".
   - "whistleYardLine": where the ball was when the play ended. "gainLoss": yards from the snap to there (positive forward, negative behind the line, 0 for an incomplete pass).
   ${nextPlayStartYard ? `- The next play on this drive was snapped at ${nextPlayStartYard}. Unless a flag was thrown on this play, that IS where this play ended: use it for "whistleYardLine" and make "gainLoss" agree.` : ''}
   - "penaltyDetected": true only if you SEE a yellow flag on the field; then fill "penaltyDetails".
   - If the carrier reached the end zone, say so in "result" (e.g. "Rush, TD").
4. Who made the tackle: in the last pictures, the defender wrapping up or bringing the carrier down. His digits first in "tacklerNums", then anyone else in on it. "tacklerConfidence" (0-100) for the first. Unreadable: [] and 0. NEVER GUESS.
   ${rosterNums.length && ourUnitRole === 'defense' ? `- ${ourTeamName} is on defense: the tackler wears one of: ${rosterNums.join(', ')}. A number that isn't one of them: leave it out.` : ''}
5. "down" and "distance": only from a down marker (the box with a number on the sideline) or a scoreboard you can read; otherwise 0. "quarter": 0 unless a scoreboard shows it.
6. "defensiveFront": the defense's front if you can count it ("5-3", "4-4", "6-2"), else "".
7. "coachingNotes": one or two plain sentences a coach can use (how the play hit, who made it work or broke it). "" if nothing useful.
8. "confidenceScore": 0-100, how sure you are of the breakdown as a whole.

Answer with JSON only, with exactly these keys (the values below are the "don't know" answers).`;

  const promptText = `Play #${play?.playNumber || 1}: ${frames.length} pictures, in order.
${frames.map((f, i) => `Picture ${i + 1}: ${f.label} (${f.timestamp.toFixed(1)} s into the clip)`).join('\n')}
${userPrompt ? `Coach's note for this play: ${userPrompt}` : ''}

{
  "snapFrame": 0,
  "endFrame": 0,
  "odk": "",
  "quarter": 0,
  "down": 0,
  "distance": 0,
  "yardLine": "",
  "hash": "",
  "personnel": "",
  "qb": "",
  "strength": "",
  "tags": [],
  "concept": "",
  "formation": "",
  "backfield": "",
  "motion": "",
  "playType": "",
  "playName": "",
  "playDir": "",
  "result": "",
  "gainLoss": 0,
  "whistleYardLine": "",
  "carrierNum": "",
  "carrierConfidence": 0,
  "passerNum": "",
  "receiverNum": "",
  "defensiveFront": "",
  "tacklerNums": [],
  "tacklerConfidence": 0,
  "coachingNotes": "",
  "penaltyDetected": false,
  "penaltyDetails": "",
  "penaltyYards": 0,
  "penaltyOn": "None",
  "confidenceScore": 0
}`;

  // The same answer, read the same way, whichever AI gives it.
  const cleanUp = (textContent: string): AiFilmAnalysisResult => {
    const ctx = {
      linkOurRoster,
      ourUnitRole,
      scoutedTeam,
      offenseTeam,
      defenseTeam,
      currentStartYard: play?.rawYardLine,
      nextPlayStartYard,
      currentOdk: play?.odk,
      nextPlayOdk,
      play,
      frameCount: frames.length,
    };
    let raw: any;
    try {
      raw = JSON.parse(textContent);
    } catch {
      const match = textContent.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("The AI's answer wasn't a breakdown (no JSON in it). Run it again.");
      try {
        raw = JSON.parse(match[0]);
      } catch {
        throw new Error("The AI's answer was cut off or garbled. Run it again.");
      }
    }
    if (!raw || typeof raw !== 'object') throw new Error("The AI's answer wasn't a breakdown. Run it again.");
    return sanitizeAiResult(raw, roster, ctx);
  };
  if (engine === 'ollama') {
    const text = await askOllama(ollamaModel, systemInstruction + '\n\n' + promptText, frames, onStatusUpdate);
    if (!text) throw new Error('Empty response from the model on this computer.');
    return cleanUp(text);
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemInstruction + '\n\n' + promptText },
          ...frames.map((f) => ({ inlineData: { mimeType: 'image/jpeg', data: f.dataUrl.split(',')[1] } })),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
    },
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let lastError = '';
  let quotaHit = false;
  for (const m of geminiCandidates(modelName)) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let res: Response;
      try {
        // The key in a header, not in the address (addresses end up in logs).
        res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cleanKey }, body: JSON.stringify(body) });
      } catch {
        lastError = 'No connection to Google (check the internet connection).';
        if (attempt < 3) {
          await wait(1500 * attempt);
          continue;
        }
        break;
      }
      if (res.ok) {
        const json = await res.json();
        const text = geminiAnswerText(json);
        if (text) {
          if (m !== modelName) onStatusUpdate?.(`Read with ${m} (${modelName} was out of uses or unavailable).`);
          return cleanUp(text);
        }
        lastError = geminiBlockedReason(json) || 'Google answered with nothing.';
        break; // the next model
      }
      const errText = (await res.text()).slice(0, 800);
      if (/API key not valid|API_KEY_INVALID/i.test(errText)) {
        throw new Error("Google says this API key isn't valid. Open the settings (the gear at the top of this window), paste the key again and save it.");
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Google refused the key (${res.status}). Check the key in the settings (the gear), and that it's a Google AI Studio (Gemini API) key.`);
      }
      if (res.status === 404) {
        lastError = `The model ${m} isn't available.`;
        break; // the next model
      }
      if (res.status === 429) {
        quotaHit = true;
        // A per-minute limit says how long to wait: worth one short wait. A daily limit isn't: the next model has its own.
        const delay = geminiRetryDelay(errText);
        if (attempt === 1 && delay !== null && delay <= 20) {
          onStatusUpdate?.(`Google's per-minute limit: waiting ${Math.ceil(delay)} s, then trying again…`);
          await wait(Math.ceil(delay) * 1000);
          continue;
        }
        lastError = errText;
        break; // the next model
      }
      if (res.status >= 500 && attempt < 3) {
        onStatusUpdate?.(`Google is busy: trying again (${attempt + 1}/3)…`);
        await wait(1500 * attempt);
        continue;
      }
      lastError = `Google error ${res.status}: ${errText.slice(0, 200)}`;
      if (res.status === 400) throw new Error(lastError);
      break;
    }
  }
  if (quotaHit) {
    throw new Error(
      "Gemini Quota Exceeded (429): every Gemini model is out of free uses for now. The per-minute limit clears within a minute; the daily one at midnight Pacific (3 AM Eastern). Or switch to the model on this computer in the settings (the gear)."
    );
  }
  throw new Error(`Gemini API error: ${lastError.slice(0, 250) || 'no model answered'}`);
}

/** The answer's text (all its text parts, not the model's own "thinking" ones). */
export function geminiAnswerText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p: any) => typeof p?.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('')
    .trim();
}

/** Why Google gave no answer, when it says (a safety block, a cut-off answer). */
function geminiBlockedReason(json: any): string {
  const block = json?.promptFeedback?.blockReason;
  if (block) return `Google wouldn't read these pictures (${block}).`;
  const finish = json?.candidates?.[0]?.finishReason;
  if (finish && finish !== 'STOP') return `Google stopped without an answer (${finish}).`;
  return '';
}

/** How long Google asks to wait after a 429 ("retryDelay": "17s"), in seconds; null when it doesn't say. */
export function geminiRetryDelay(errText: string): number | null {
  const m = String(errText || '').match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Number(m[1]) : null;
}

/**
 * Sanitizes and fills names from roster numbers, applying smart yardage cross-check.
 */
export function sanitizeAiResult(
  raw: any,
  roster: RosterPlayer[],
  context: {
    linkOurRoster?: boolean;
    ourUnitRole?: 'offense' | 'defense' | 'none';
    scoutedTeam?: string;
    offenseTeam?: string;
    defenseTeam?: string;
    currentStartYard?: string;
    nextPlayStartYard?: string;
    currentOdk?: string;
    nextPlayOdk?: string;
    /** The play as it stands (Hudl / breakdown): its known facts stay. */
    play?: Play;
    /** How many pictures the AI saw (its snap / end picture numbers must be among them). */
    frameCount?: number;
  } = {}
): AiFilmAnalysisResult {
  const {
    linkOurRoster = true,
    ourUnitRole = 'offense',
    scoutedTeam,
    offenseTeam,
    defenseTeam,
    currentStartYard,
    nextPlayStartYard,
    currentOdk,
    nextPlayOdk,
    play,
    frameCount = 0,
  } = context;
  // Numbers read with little confidence are left blank (a wrong name is worse than none).
  const sure = (confidence: unknown) => confidence === undefined || confidence === null || Number(confidence) >= 55;
  if (!sure(raw.carrierConfidence)) raw.carrierNum = '';
  if (!sure(raw.tacklerConfidence)) raw.tacklerNums = [];

  const findPlayer = (num?: string) => {
    if (!num || !linkOurRoster) return undefined;
    const cleanNum = String(num).replace(/[^0-9]/g, '');
    return roster.find((p) => p.num === cleanNum);
  };

  // Nothing readable: what the play already had (Hudl's carrier / tackler).
  const knownNum = (v?: string) => String(v || '').match(/\d+/)?.[0] || '';
  if (!String(raw.carrierNum || '').replace(/[^0-9]/g, '') && knownNum(play?.rusher || play?.carrierOrTarget)) raw.carrierNum = knownNum(play?.rusher || play?.carrierOrTarget);
  if ((!Array.isArray(raw.tacklerNums) || !raw.tacklerNums.length) && knownNum(play?.defPlay?.maker)) raw.tacklerNums = [knownNum(play?.defPlay?.maker)];
  const carrierNum = raw.carrierNum ? String(raw.carrierNum).replace(/[^0-9]/g, '') : undefined;
  const passerNum = raw.passerNum ? String(raw.passerNum).replace(/[^0-9]/g, '') : undefined;
  const receiverNum = raw.receiverNum ? String(raw.receiverNum).replace(/[^0-9]/g, '') : undefined;

  // Only link offensive players to our roster if our team was on offense
  const linkOffense = linkOurRoster && ourUnitRole === 'offense';
  const carrier = linkOffense ? findPlayer(carrierNum) : undefined;
  const passer = linkOffense ? findPlayer(passerNum) : undefined;
  const receiver = linkOffense ? findPlayer(receiverNum) : undefined;

  // Only link tacklers to our roster if our team was on defense
  const linkDefense = linkOurRoster && ourUnitRole === 'defense';
  const tacklerNums = Array.isArray(raw.tacklerNums)
    ? raw.tacklerNums.map((x: string) => String(x).replace(/[^0-9]/g, '')).filter(Boolean)
    : [];

  const tacklerNames = tacklerNums.map((n: string) => {
    if (linkDefense) {
      const p = findPlayer(n);
      return p ? `#${p.num} ${p.firstName} ${p.lastName}` : `#${n}`;
    }
    return `#${n}`;
  });

  const carrierName = carrier
    ? `#${carrier.num} ${carrier.firstName} ${carrier.lastName}`
    : carrierNum
    ? `#${carrierNum}`
    : raw.carrierName || '';

  const passerName = passer
    ? `#${passer.num} ${passer.firstName} ${passer.lastName}`
    : passerNum
    ? `#${passerNum}`
    : raw.passerName || '';

  const receiverName = receiver
    ? `#${receiver.num} ${receiver.firstName} ${receiver.lastName}`
    : receiverNum
    ? `#${receiverNum}`
    : raw.receiverName || '';

  // Yardage: the play's own start spot (Hudl) over one read off the frames; the next snap on the drive
  // decides where it ended unless a flag was thrown on this play.
  const rawStart = String(currentStartYard || raw.yardLine || '');
  const rawWhistle = raw.whistleYardLine ? String(raw.whistleYardLine) : undefined;
  const rawGain = Number(raw.gainLoss) || 0;
  const flagged = Boolean(raw.penaltyDetected) || /penalt/i.test(String(play?.result || ''));
  const scored = /\bTD\b|touchdown/i.test(`${raw.result || ''} ${play?.result || ''}`);

  const yardCheck = crossCheckPlayYardage({
    currentStartYard: rawStart,
    currentWhistleYard: rawWhistle,
    currentGainLoss: rawGain,
    nextStartYard: nextPlayStartYard,
    currentOdk: currentOdk || raw.odk,
    nextOdk: nextPlayOdk,
    trust: flagged ? 'film' : 'spot',
    touchdown: scored,
  });

  const penaltyDetected = Boolean(raw.penaltyDetected) || yardCheck.penaltySuspected;
  const penaltyDetails = raw.penaltyDetails || yardCheck.penaltySuggestion || '';
  const penaltyYards = raw.penaltyYards ? Number(raw.penaltyYards) : yardCheck.penaltyYards;
  const penaltyOn = (raw.penaltyOn as 'Offense' | 'Defense' | 'None') || yardCheck.penaltyOn;

  // What the play already has (Hudl / the breakdown) stays; the AI only fills what's blank, and nothing
  // is made up when it has no answer either (a blank is better than a wrong tag in every report).
  const known = (v: unknown) => {
    const t = String(v ?? '').trim();
    return t && !/^(unknown|-|none)$/i.test(t) ? t : '';
  };
  const pick = (have: unknown, ai: unknown) => known(have) || known(ai);
  const side = (v: unknown) => {
    const c = String(v ?? '').trim().charAt(0).toUpperCase();
    return c === 'L' || c === 'M' || c === 'R' ? c : '';
  };

  let finalOdk: 'O' | 'D' | 'K' = raw.odk === 'D' ? 'D' : raw.odk === 'K' ? 'K' : 'O';
  if (raw.odk !== 'K' && scoutedTeam && offenseTeam && defenseTeam) {
    const isScoutOff = offenseTeam.toLowerCase().includes(scoutedTeam.toLowerCase()) ||
      scoutedTeam.toLowerCase().includes(offenseTeam.toLowerCase());
    const isScoutDef = defenseTeam.toLowerCase().includes(scoutedTeam.toLowerCase()) ||
      scoutedTeam.toLowerCase().includes(defenseTeam.toLowerCase());
    if (isScoutOff) finalOdk = 'O';
    else if (isScoutDef) finalOdk = 'D';
  }

  // Hudl's own ODK for the play wins over the matchup guess.
  if (play?.odk === 'O' || play?.odk === 'D' || play?.odk === 'K') finalOdk = play.odk;
  const haveType = known(play?.playType) && !/^unknown$/i.test(String(play?.playType)) ? String(play?.playType) : '';

  return {
    odk: finalOdk,
    scoutedTeam,
    quarter: Number(play?.quarter) || Number(raw.quarter) || 0,
    down: Number(play?.down) || Number(raw.down) || 0,
    distance: Number(play?.distance) || Number(raw.distance) || 0,
    yardLine: rawStart,
    hash: (side(play?.hash) || side(raw.hash)) as AiFilmAnalysisResult['hash'],
    formation: pick(play?.formation, raw.formation),
    backfield: pick(play?.backfield, raw.backfield),
    motion: pick(play?.motion, raw.motion),
    playType: (haveType || known(raw.playType) || '') as AiFilmAnalysisResult['playType'],
    playName: pick(play?.playName, raw.playName),
    playDir: (side(play?.direction) || side(raw.playDir)) as AiFilmAnalysisResult['playDir'],
    result: pick(play?.result, raw.result),
    gainLoss: yardCheck.measuredGain ?? rawGain,
    yardageSource: yardCheck.gainSource,
    ...(yardCheck.filmGain !== undefined ? { filmGain: yardCheck.filmGain } : {}),
    whistleYardLine: yardCheck.whistleFormatted,
    nextPlayYardLine: yardCheck.nextStartFormatted,
    spotAligned: yardCheck.isAligned,
    penaltyDetected,
    penaltyDetails,
    penaltyYards,
    penaltyOn,
    carrierNum,
    carrierName,
    passerNum,
    passerName,
    receiverNum,
    receiverName,
    defensiveFront: known(raw.defensiveFront),
    tacklerNums,
    tacklerNames,
    coachingNotes: known(raw.coachingNotes),
    // How sure the AI said it is (0 when it didn't say): shown as it is, never made up.
    confidenceScore: Math.min(100, Math.max(0, Math.round(Number(raw.confidenceScore) || 0))),
    ...aiCallParts(raw, String(play?.playType || raw.playType || '')),
    ...frameNumber('snapFrame', raw.snapFrame, frameCount),
    ...frameNumber('endFrame', raw.endFrame, frameCount),
  };
}

/**
 * Converts an AI breakdown analysis result into Hudl BreakdownRow format.
 */
export function analysisResultToBreakdownRow(res: AiFilmAnalysisResult): BreakdownRow {
  // Unknown quarter / down / distance stay blank (not "0").
  return {
    ODK: res.odk,
    QTR: res.quarter ? (res.quarter >= 5 ? 'OT' : String(res.quarter)) : '',
    DN: res.down ? String(res.down) : '',
    DIST: res.down && res.distance ? String(res.distance) : '',
    'YARD LN': res.yardLine,
    HASH: res.hash,
    'OFF FORM': res.formation,
    'OFF PLAY': res.playName,
    'PLAY TYPE': res.playType,
    'PLAY DIR': res.playDir,
    RESULT: res.result,
    'GN/LS': String(res.gainLoss),
  };
}

/**
 * Converts an AI breakdown analysis result into Play patch object (extended attributes).
 */
export function analysisResultToPlayPatch(res: AiFilmAnalysisResult): Partial<Play> {
  // Only what the AI (or the coach in this window) actually has: a blank never replaces what the play already has
  // (Hudl's carrier, a tackle credit from grading). Explosive / efficient are worked out from the gain when the
  // breakdown row is saved, the same way for every play.
  const patch: Partial<Play> = {};
  const put = <K extends keyof Play>(k: K, v: Play[K] | undefined) => {
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return;
    patch[k] = v;
  };
  put('backfield', res.backfield);
  put('motion', res.motion);
  const rusher = res.carrierName || (res.carrierNum ? `#${res.carrierNum}` : '');
  const passer = res.passerName || (res.passerNum ? `#${res.passerNum}` : '');
  const receiver = res.receiverName || (res.receiverNum ? `#${res.receiverNum}` : '');
  put('rusher', rusher);
  put('passer', passer);
  put('receiver', receiver);
  const primaryTackler = res.tacklerNames?.[0] || (res.tacklerNums?.[0] ? `#${res.tacklerNums[0]}` : '');
  if (primaryTackler) {
    const assists =
      res.tacklerNames && res.tacklerNames.length > 1
        ? res.tacklerNames.slice(1)
        : res.tacklerNums && res.tacklerNums.length > 1
          ? res.tacklerNums.slice(1).map((n) => `#${n}`)
          : [];
    const event = /sack/i.test(res.result || '') ? 'sack' : res.gainLoss < 0 ? 'tfl' : '';
    patch.defPlay = {
      maker: primaryTackler,
      ...(assists.length ? { assists } : {}),
      ...(event ? { events: [event] } : {}),
    } as Play['defPlay'];
  }
  return patch;
}

/** A picture number the AI gave (from 1), kept when it's one of the pictures it saw. */
function frameNumber(key: 'snapFrame' | 'endFrame', v: unknown, count: number): Partial<AiFilmAnalysisResult> {
  const n = Math.round(Number(v) || 0);
  return n >= 1 && (!count || n <= count) ? { [key]: n } : {};
}

/**
 * The play name's parts the AI gave, kept only when they're things the Play Name builder knows (a personnel like
 * "21", UC / Gun / Pistol, R / L, its tags and concepts), and the name they make.
 */
export function aiCallParts(raw: any, playType: string): { callParts?: CallParts; callName?: string } {
  const one = (list: string[], v: unknown) => {
    const t = String(v ?? '').trim().toLowerCase();
    return t ? list.find((x) => x.toLowerCase() === t) : undefined;
  };
  const parts: CallParts = {};
  const pers = String(raw?.personnel ?? '').trim();
  if (/^\d{2}$/.test(pers)) parts.personnel = pers;
  const qb = String(raw?.qb ?? '').trim().toLowerCase();
  if (qb === 'uc' || qb.startsWith('under')) parts.qb = 'UC';
  else if (qb === 'gun' || qb.startsWith('shot')) parts.qb = 'Gun';
  else if (qb === 'pistol') parts.qb = 'Pistol';
  const side = String(raw?.strength ?? '').trim().toUpperCase().charAt(0);
  if (side === 'R' || side === 'L') parts.strength = side;
  const tags = (Array.isArray(raw?.tags) ? raw.tags : []).map((t: unknown) => one(TAGS, t)).filter(Boolean) as string[];
  if (tags.length) parts.tags = [...new Set(tags)];
  const concept = one([...RUN_CONCEPTS, ...PASS_CONCEPTS], raw?.concept);
  if (concept) parts.concept = concept;
  // A name needs the personnel at least (that's what the formations go by).
  if (!parts.personnel) return {};
  const run = !/pass|screen/i.test(playType) || /rpo/i.test(playType);
  return { callParts: parts, callName: buildCallName(parts, run) };
}