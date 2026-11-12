// Gemini Multimodal Vision AI service for Sideline Media Manager.
// Extracts jersey numbers (top priority), classifies sports photo category/sub-category,
// evaluates quality metrics (focus, framing, emotion, isolation), assigns curation score & tier,
// and produces a 1-sentence curation rationale conforming to Courtney's Wish List specifications.
import type { MediaCategory, MediaJerseyDetection, MediaPhoto, MediaQualityMetrics, MediaTier } from './types';
import { tierOfScore } from './mediaData';
import {
  geminiAnswerText,
  geminiCandidates,
  geminiRetryDelay,
  getSavedGeminiKey,
  getSavedGeminiModel,
} from '../services/geminiFilmService';

export interface RosterRef {
  num: string;
  firstName?: string;
  lastName?: string;
}

export interface AnalyzePhotoOptions {
  blob: Blob;
  driveId: string;
  photoName?: string;
  roster?: RosterRef[];
  targetJerseyColor?: string;
  opponentJerseyColor?: string;
  apiKey?: string;
  modelName?: string;
  onStatus?: (status: string) => void;
}

export interface MediaAiAnalysis {
  detectedJerseys: MediaJerseyDetection[];
  kids: string[];
  category: MediaCategory;
  side?: 'Offense' | 'Defense' | 'unknown';
  group: 'single' | 'group';
  score: number;
  tier: MediaTier;
  qualityMetrics: MediaQualityMetrics;
  curationRationale: string;
}

export const VALID_CATEGORIES: MediaCategory[] = [
  'Action',
  'Sidelines and huddles',
  'Warmups',
  'Celebration',
  'Post-game',
  'Coaches',
  'Fans',
  'Portraits',
];

export const SYSTEM_PROMPT = `You are an elite computer vision AI sports analyst embedded in a media management application. Your task is to analyze the provided sports photograph and extract precise metadata to power automated photo tagging, filtering, and organization.

Jersey Number Extraction Rules (Top Priority):
- Scan all visible players for jersey numbers matching the designated target team uniform color (if specified).
- Team Uniform Filter: When a target team jersey color is specified, ONLY extract and tag numbers from players wearing that specific color. Completely IGNORE numbers on players wearing opposing team colors, referee stripes, or spectator clothing.
- Read digits carefully, accounting for fabric stretching, body angles, and sweat.
- If a number is partially obscured or ambiguous, include it with a lower confidence score (0.1 to 0.6).
- Do not hallucinate numbers. If no jersey numbers from the target team are visible or legible, return an empty array for detected_jerseys.

Photo Category Classification:
Classify into exactly one of these primary categories:
- "Action": Active gameplay, movement, ball-in-play, tackling, running, passing, blocking, shooting, or dynamic athletic competition.
  * If primary_category is "Action", you MUST determine whether it is an "Offense" or "Defense" play based on tactical positioning, possession of the ball, blocking schemes, defensive stance, or pursuit angles. If impossible to determine, set sub_category to "unknown".
- "Sidelines and huddles": Players and staff gathered on the sidelines, strategic team huddles during timeouts or breaks.
- "Warmups": Pre-game stretching, drills, practicing routines, or players entering the field before game time.
- "Celebration": High-fives, chest bumps, group cheering immediately following a scoring play, victory, or milestone.
- "Post-game": Post-match handshakes, walking off the field, interviews, exhausted players resting after the final whistle.
- "Coaches": Head coaches, coordinators, or staff members instructing, watching intently from the sidelines, or speaking into headsets.
- "Fans": Crowd reactions, student sections, mascot close-ups, or spectators in the stands.
- "Portraits": Headshots, posed individual or small group player photos, media day shots, or structured framing.

Subject Count:
- "single": Focus is on exactly one primary player or subject.
- "group": Two or more players or subjects featured together.

Curation & Quality Assessment:
Evaluate technical execution, composition, emotional impact, and sports storytelling value:
- "sharpness_and_focus": float (1.0 to 10.0 - critical focus on subject's eyes/face, lack of motion blur unless intentional panning)
- "composition_and_framing": float (1.0 to 10.0 - rule of thirds, clean framing, absence of distracting clutter or awkward limb crops)
- "storytelling_and_emotion": float (1.0 to 10.0 - captures peak action, raw emotion, celebration, intensity, or narrative context)
- "player_isolation": float (1.0 to 10.0 - subject separation from background using depth of field, lighting, or framing)
- "curation_score": float (1.0 to 10.0 overall rating where 10 is portfolio-grade)
- "curation_tier": Must be EXACTLY one of:
  * "Elite" (Score 8.5 - 10.0): Peak action frozen at impact/catch/tackle, razor-sharp focus on eyes/number, clean background, dramatic storytelling.
  * "Good" (Score 6.5 - 8.4): Solid, clean sports photo. Good lighting and acceptable focus, minor background clutter or fraction-of-a-second missed peak.
  * "Archive" (Score 4.0 - 6.4): Passable documentation, slightly soft focus, obstructed view, awkward posture.
  * "Reject" (Score 1.0 - 3.9): Severely blurred, severely underexposed/overexposed, major obstruction, accidental trigger.
- "curation_rationale": EXACTLY 1 sentence explaining why this score was given, noting specific strengths or flaws.

Return valid JSON conforming to this schema:
{
  "detected_jerseys": [
    { "jersey": "21", "confidence": 0.95, "obscured": false }
  ],
  "primary_category": "Action",
  "sub_category": "Offense",
  "subject_count": "single",
  "quality_metrics": {
    "sharpness_and_focus": 9.0,
    "composition_and_framing": 8.5,
    "storytelling_and_emotion": 9.2,
    "player_isolation": 8.8
  },
  "curation_score": 8.9,
  "curation_tier": "Elite",
  "curation_rationale": "Razor-sharp capture of the running back cutting upfield with great eye contact and strong background separation."
}`;

/**
 * Resizes a photo to an optimal dimension (~1600px max) for high-speed AI analysis without losing jersey number clarity.
 */
export async function preparePhotoBase64(blob: Blob, maxDim = 1600): Promise<{ base64: string; mimeType: string }> {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      let bmp: ImageBitmap | null = null;
      if (typeof createImageBitmap === 'function') {
        bmp = await createImageBitmap(blob);
      }
      if (bmp) {
        const { width, height } = bmp;
        let targetW = width;
        let targetH = height;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            targetW = maxDim;
            targetH = Math.round((height * maxDim) / width);
          } else {
            targetH = maxDim;
            targetW = Math.round((width * maxDim) / height);
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bmp, 0, 0, targetW, targetH);
          bmp.close();
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const parts = dataUrl.split(',');
          return { base64: parts[1] || '', mimeType: 'image/jpeg' };
        }
        bmp.close();
      }
    } catch {
      // Fallback to direct reading below
    }
  }

  // Fallback for non-browser or when canvas resize fails
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        const str = String(reader.result || '');
        const comma = str.indexOf(',');
        resolve({
          base64: comma >= 0 ? str.slice(comma + 1) : str,
          mimeType: blob.type || 'image/jpeg',
        });
      };
      reader.onerror = () => reject(new Error("Couldn't read photo data."));
      reader.readAsDataURL(blob);
    } else {
      // Node.js environment
      blob.arrayBuffer().then((buf) => {
        const base64 = Buffer.from(buf).toString('base64');
        resolve({ base64, mimeType: blob.type || 'image/jpeg' });
      }).catch(reject);
    }
  });
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/**
 * Sanitizes and normalizes the AI JSON response.
 */
export function parseGeminiMediaResponse(rawJson: unknown, roster?: RosterRef[]): MediaAiAnalysis {
  let raw = rawJson as Record<string, unknown> | null;
  if (typeof rawJson === 'string') {
    try {
      raw = JSON.parse(rawJson);
    } catch {
      const match = rawJson.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          raw = JSON.parse(match[0]);
        } catch {
          raw = {};
        }
      }
    }
  }
  if (!raw || typeof raw !== 'object') raw = {};

  // 1. Detected jerseys
  const rawJerseys = Array.isArray(raw.detected_jerseys) ? raw.detected_jerseys : [];
  const detectedJerseys: MediaJerseyDetection[] = [];
  const seenJerseys = new Set<string>();

  for (const item of rawJerseys) {
    if (!item) continue;
    let numStr = '';
    let conf = 0.8;
    let obscured = false;

    if (typeof item === 'string' || typeof item === 'number') {
      numStr = String(item).replace(/\D/g, '');
    } else if (typeof item === 'object') {
      const o = item as Record<string, unknown>;
      numStr = String(o.jersey || o.number || o.jerseyNumber || '').replace(/\D/g, '');
      const rawConf = Number(o.confidence ?? 0.8);
      conf = rawConf > 1 ? rawConf / 100 : rawConf;
      obscured = Boolean(o.obscured);
    }

    if (numStr && !seenJerseys.has(numStr)) {
      seenJerseys.add(numStr);
      detectedJerseys.push({
        jersey: numStr,
        confidence: clamp(conf, 0.05, 1.0),
        obscured,
      });
    }
  }

  // Top priority: list of jersey numbers for filtering
  const kids: string[] = detectedJerseys
    .filter((j) => j.confidence >= 0.4)
    .map((j) => j.jersey);

  // If roster was provided, sort kids so known roster numbers come first
  if (roster && roster.length) {
    const knownSet = new Set(roster.map((r) => r.num.trim()).filter(Boolean));
    kids.sort((a, b) => {
      const aKnown = knownSet.has(a) ? 1 : 0;
      const bKnown = knownSet.has(b) ? 1 : 0;
      if (aKnown !== bKnown) return bKnown - aKnown;
      return Number(a) - Number(b);
    });
  } else {
    kids.sort((a, b) => Number(a) - Number(b));
  }

  // 2. Category
  let category: MediaCategory = 'Action';
  const rawCat = String(raw.primary_category || raw.category || '').trim();
  const matchedCat = VALID_CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase());
  if (matchedCat) {
    category = matchedCat;
  } else if (/sideline|huddle/i.test(rawCat)) {
    category = 'Sidelines and huddles';
  } else if (/warmup|stretch|drill/i.test(rawCat)) {
    category = 'Warmups';
  } else if (/celebrat/i.test(rawCat)) {
    category = 'Celebration';
  } else if (/post/i.test(rawCat)) {
    category = 'Post-game';
  } else if (/coach/i.test(rawCat)) {
    category = 'Coaches';
  } else if (/fan|crowd|spectator/i.test(rawCat)) {
    category = 'Fans';
  } else if (/portrait|headshot|posed/i.test(rawCat)) {
    category = 'Portraits';
  }

  // Sub-category (Offense / Defense / unknown)
  let side: 'Offense' | 'Defense' | 'unknown' | undefined;
  if (category === 'Action') {
    const sub = String(raw.sub_category || raw.side || '').toLowerCase();
    if (sub.includes('offense')) side = 'Offense';
    else if (sub.includes('defense')) side = 'Defense';
    else side = 'unknown';
  }

  // Subject count (single vs group)
  let group: 'single' | 'group' = 'group';
  const rawCount = String(raw.subject_count || raw.group || '').toLowerCase();
  if (rawCount.includes('single') || (detectedJerseys.length === 1 && !rawCount.includes('group'))) {
    group = 'single';
  } else if (rawCount.includes('group') || detectedJerseys.length > 1) {
    group = 'group';
  }

  // 3. Quality Metrics
  const rawMetrics = (raw.quality_metrics || {}) as Record<string, unknown>;
  const qualityMetrics: MediaQualityMetrics = {
    sharpness_and_focus: clamp(Number(rawMetrics.sharpness_and_focus) || 7.0, 1.0, 10.0),
    composition_and_framing: clamp(Number(rawMetrics.composition_and_framing) || 7.0, 1.0, 10.0),
    storytelling_and_emotion: clamp(Number(rawMetrics.storytelling_and_emotion) || 7.0, 1.0, 10.0),
    player_isolation: clamp(Number(rawMetrics.player_isolation) || 7.0, 1.0, 10.0),
  };

  // 4. Curation Score & Tier
  let score = Number(raw.curation_score || raw.score);
  if (!Number.isFinite(score) || score <= 0) {
    // Compute weighted average from quality metrics if curation_score wasn't provided
    score =
      qualityMetrics.sharpness_and_focus * 0.35 +
      qualityMetrics.storytelling_and_emotion * 0.3 +
      qualityMetrics.composition_and_framing * 0.2 +
      qualityMetrics.player_isolation * 0.15;
  }
  score = Math.round((clamp(score, 1.0, 10.0) + 1e-6) * 10) / 10;
  const tier: MediaTier = tierOfScore(score);

  // 5. Curation Rationale
  let curationRationale = String(raw.curation_rationale || raw.rationale || '').trim();
  if (!curationRationale) {
    curationRationale = `${tier} quality sports capture (${score.toFixed(1)}/10) with solid athletic focus.`;
  }

  return {
    detectedJerseys,
    kids,
    category,
    side,
    group,
    score,
    tier,
    qualityMetrics,
    curationRationale,
  };
}

export const TARGET_COLOR_STORAGE_KEY = 'mahopac_ai_target_jersey_color';
export const OPPONENT_COLOR_STORAGE_KEY = 'mahopac_ai_opponent_jersey_color';

export interface PresetColor {
  label: string;
  value: string;
  bg: string;
  border: string;
  note?: string;
}

export const COMMON_TEAM_COLORS: PresetColor[] = [
  { label: 'Navy / Blue', value: 'Navy / Blue', bg: 'bg-blue-900 text-white', border: 'border-blue-900', note: 'Mahopac Home' },
  { label: 'White', value: 'White', bg: 'bg-white text-slate-900', border: 'border-slate-300 dark:border-slate-600', note: 'Mahopac Away' },
  { label: 'Gold / Yellow', value: 'Gold / Yellow', bg: 'bg-amber-400 text-slate-950', border: 'border-amber-500', note: 'Mahopac Gold' },
  { label: 'Red', value: 'Red', bg: 'bg-rose-600 text-white', border: 'border-rose-600' },
  { label: 'Green', value: 'Green', bg: 'bg-emerald-600 text-white', border: 'border-emerald-600' },
  { label: 'Black', value: 'Black', bg: 'bg-slate-900 text-white', border: 'border-slate-900' },
  { label: 'Orange', value: 'Orange', bg: 'bg-orange-500 text-white', border: 'border-orange-500' },
  { label: 'Any Color', value: 'Any', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700', note: 'No filter' },
];

export function getSavedTargetColor(): string {
  if (typeof localStorage === 'undefined') return 'Navy / Blue';
  try {
    return localStorage.getItem(TARGET_COLOR_STORAGE_KEY) || 'Navy / Blue';
  } catch {
    return 'Navy / Blue';
  }
}

export function saveTargetColor(color: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TARGET_COLOR_STORAGE_KEY, color);
  } catch {
    /* ignore */
  }
}

export function getSavedOpponentColor(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(OPPONENT_COLOR_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveOpponentColor(color: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(OPPONENT_COLOR_STORAGE_KEY, color);
  } catch {
    /* ignore */
  }
}

/**
 * Builds the user prompt sent to Gemini Vision, combining roster context and team uniform color filtering.
 */
export function buildGeminiMediaPrompt(opts: {
  photoName?: string;
  roster?: RosterRef[];
  targetJerseyColor?: string;
  opponentJerseyColor?: string;
}): string {
  const { photoName = '', roster = [], targetJerseyColor, opponentJerseyColor } = opts;

  let rosterContext = '';
  if (roster.length > 0) {
    const list = roster
      .map((r) => `#${r.num}${r.firstName ? ` (${r.firstName} ${r.lastName || ''})` : ''}`)
      .join(', ');
    rosterContext = `\nOur active team roster jersey numbers are: ${list}. Use this for digit disambiguation, but DO NOT hallucinate numbers not visible in the photo.`;
  }

  let colorFilter = '';
  const cleanColor = targetJerseyColor?.trim();
  if (cleanColor && !/^(any|all|none|both)$/i.test(cleanColor)) {
    const opp = opponentJerseyColor?.trim();
    colorFilter = `\n\nCRITICAL TEAM UNIFORM COLOR FILTER (TOP PRIORITY):
- TARGET TEAM JERSEY COLOR: "${cleanColor}".
- You MUST ONLY tag and extract jersey numbers for players wearing ${cleanColor} jerseys/uniforms.
${opp ? `- The OPPONENT team is wearing "${opp}" jerseys. DO NOT tag or extract ANY numbers from players wearing ${opp} uniforms!` : '- DO NOT extract jersey numbers from opposing players wearing a different uniform color!'}
- If players from both teams appear together in the photograph, scan ONLY the players wearing ${cleanColor} and completely IGNORE numbers on players wearing other colors.
- Do NOT include opposing team player numbers in detected_jerseys or the kids array.`;
  }

  return `Analyze this football photo (${photoName || 'game day photo'}).${rosterContext}${colorFilter}\nExtract visible jersey numbers, identify category, determine single vs group, evaluate quality metrics, and assign curation tier.`;
}

/** Models Google answered 404 (not found: retired or not on this key) this visit: not asked again for each photo. */
const missingModels = new Set<string>();

/** What a batch says when every model was not found (404): it stops, since waiting won't bring a model back. */
export const NO_MODELS_MESSAGE =
  'Google says none of the AI models were found (404) for this key. Google retires older models now and then. Open AI settings and pick another model (Gemini Flash newest), then Run again.';

/**
 * Executes multimodal Gemini Vision analysis on a single photo.
 */
export async function analyzePhotoWithGemini(opts: AnalyzePhotoOptions): Promise<Partial<MediaPhoto>> {
  const {
    blob,
    photoName = '',
    roster = [],
    targetJerseyColor = getSavedTargetColor(),
    opponentJerseyColor = getSavedOpponentColor(),
    apiKey = getSavedGeminiKey(),
    modelName = getSavedGeminiModel(),
    onStatus,
  } = opts;

  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('No Gemini API key on this device. Open AI settings, paste your Google AI Studio key, and try again.');
  }

  onStatus?.('Preparing image for analysis…');
  const { base64, mimeType } = await preparePhotoBase64(blob, 1600);

  const promptText = buildGeminiMediaPrompt({
    photoName,
    roster,
    targetJerseyColor,
    opponentJerseyColor,
  });

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT + '\n\n' + promptText },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
    },
  };

  // A model Google already said isn't there is skipped (unless it's the only one left to try).
  const all = geminiCandidates(modelName);
  const models = all.filter((m) => !missingModels.has(m));
  if (!models.length) models.push(...all);
  let lastError = '';

  for (const m of models) {
    onStatus?.(`Analyzing photo with Gemini (${m})…`);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000); // 25s timeout per request
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      // Any answer but "not found": the model is there.
      if (res.status !== 404) missingModels.delete(m);
      if (res.ok) {
        const json = await res.json();
        const text = geminiAnswerText(json);
        if (!text) throw new Error('Empty response from Gemini Vision.');
        const analysis = parseGeminiMediaResponse(text, roster);
        return {
          kids: analysis.kids,
          detectedJerseys: analysis.detectedJerseys,
          category: analysis.category,
          side: analysis.side,
          group: analysis.group,
          score: analysis.score,
          tier: analysis.tier,
          qualityMetrics: analysis.qualityMetrics,
          curationRationale: analysis.curationRationale,
          aiAnalyzedAt: Date.now(),
        };
      }

      const errText = await res.text();
      if (res.status === 402 || /402|prepayment|credits are depleted/i.test(errText)) {
        throw new Error('Google Gemini error (402 Payment Required): Your Google AI Studio prepayment balance is depleted ($0). Top up credits at aistudio.google.com or create a key under a free-tier project.');
      }
      if (res.status === 429) {
        const delay = geminiRetryDelay(errText);
        if (delay !== null && delay > 0 && delay <= 25) {
          // Live countdown wait for per-minute rate limit
          for (let s = Math.ceil(delay); s > 0; s--) {
            onStatus?.(`Gemini rate limit: waiting ${s}s to retry…`);
            await new Promise((r) => setTimeout(r, 1000));
          }
          // Retry on next attempt
          continue;
        }
        lastError = delay ? `Gemini busy (${delay}s delay)` : 'Gemini quota reached';
        continue;
      }
      if (/API key not valid|API_KEY_INVALID/i.test(errText) || res.status === 401 || res.status === 403) {
        throw new Error('Google refused this Gemini API key. Check or re-paste your key in AI settings.');
      }
      // Not found: that model is retired (or not on this key). The next one is tried, and the reason another model
      // gave (busy, out of quota) is kept: a 404 used to hide it, so the photo was skipped instead of waited for.
      if (res.status === 404) {
        missingModels.add(m);
        continue;
      }
      lastError = `Gemini (${res.status}): ${errText.slice(0, 150)}`;
    } catch (err: unknown) {
      if (err instanceof Error && /refused this Gemini API key|402 Payment Required/i.test(err.message)) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = `Gemini request timed out after 25s on ${m}`;
      } else {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (!lastError && models.every((m) => missingModels.has(m))) throw new Error(NO_MODELS_MESSAGE);
  throw new Error(`AI Photo analysis failed: ${lastError || 'all models busy'}`);
}
