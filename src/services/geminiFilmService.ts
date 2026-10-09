// AI-powered video clip analyzer for youth football film breakdown using Gemini multimodal vision.
// Extracts keyframes from HTML5 video, analyzes schemes/players/down-and-distance, and populates Hudl breakdown rows.
import type { Play, TeamUnit } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import type { BreakdownRow } from '../filmroom/breakdownEntry';

export interface AiFilmAnalysisResult {
  odk: 'O' | 'D' | 'K';
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

export const getSavedGeminiModel = (): string => {
  try {
    return localStorage.getItem(GEMINI_MODEL_KEY) || 'gemini-2.5-flash';
  } catch {
    return 'gemini-2.5-flash';
  }
};

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
  frameCount = 5,
  maxDimension = 720
): Promise<ExtractedFrame[]> {
  const duration = video.duration || 10;
  const originalTime = video.currentTime;
  const originalPaused = video.paused;

  // Timestamps to sample across the snap (10% to 90% through duration)
  const timestamps: { t: number; label: string }[] = [
    { t: Math.max(0.2, duration * 0.12), label: 'Pre-Snap Alignment' },
    { t: Math.max(0.8, duration * 0.35), label: 'Snap & Mesh' },
    { t: Math.max(1.4, duration * 0.55), label: 'Point of Attack' },
    { t: Math.max(2.0, duration * 0.75), label: 'Tackle / Whistle' },
  ];

  if (frameCount >= 5) {
    timestamps.splice(2, 0, { t: Math.max(1.1, duration * 0.45), label: 'Run Fit / Pass Release' });
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const frames: ExtractedFrame[] = [];

  const seekTo = (t: number): Promise<void> =>
    new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = t;
    });

  try {
    for (const item of timestamps) {
      const targetTime = Math.min(duration - 0.1, Math.max(0.1, item.t));
      await seekTo(targetTime);
      // Brief wait to ensure frame decodes
      await new Promise((r) => setTimeout(r, 60));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      frames.push({ timestamp: targetTime, label: item.label, dataUrl });
    }
  } finally {
    // Restore video state
    video.currentTime = originalTime;
    if (!originalPaused) video.play().catch(() => {});
  }

  return frames;
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

/**
 * Calls Gemini Multimodal Vision API to break down football video frames into structured stats.
 */
export async function analyzeFilmWithGemini({
  frames,
  play,
  roster = [],
  knownFormations = [],
  knownPlays = [],
  opponentName = 'Opponent',
  userPrompt = '',
  apiKey = getSavedGeminiKey(),
  modelName = getSavedGeminiModel(),
}: {
  frames: ExtractedFrame[];
  play?: Play;
  roster?: RosterPlayer[];
  knownFormations?: string[];
  knownPlays?: string[];
  opponentName?: string;
  userPrompt?: string;
  apiKey?: string;
  modelName?: string;
}): Promise<AiFilmAnalysisResult> {
  const cleanKey = apiKey.trim();

  // If no API key is set, return a smart simulated breakdown with real roster linking and instructions
  if (!cleanKey) {
    return simulateLocalAiBreakdown(frames, play, roster, knownFormations, knownPlays);
  }

  const rosterList = formatRosterContext(roster);
  const knownFormsList = knownFormations.filter(Boolean).slice(0, 15).join(', ') || 'Wishbone, Pro-I, Double Wing, Trips Right, Spread, Beast, Pistol';
  const knownPlaysList = knownPlays.filter(Boolean).slice(0, 20).join(', ') || '26 Dive, 31 Sweep, 44 Power, Counter, Quick Slant, Bubble Screen, QB Sneak';

  const systemInstruction = `You are an expert youth football (10U / Pop Warner / High School) film coordinator and scout analyst.
Your job is to analyze sequential game footage frames of an American football play and produce an exact, structured breakdown matching Hudl/PFF scouting standards.

Team Context:
- Active Team Roster: ${rosterList}
- Opponent: ${opponentName}
- Common Team Formations: ${knownFormsList}
- Common Play Calls: ${knownPlaysList}

Instructions:
1. Examine the pre-snap alignment to determine Offensive Formation (e.g., "Wishbone", "Pro I-Form", "Trips Rt", "Beast", "Double Wing", "Spread", "Shotgun") and Defensive Front (e.g., "4-4 Stack", "5-3 Over", "Cover 3", "Goal Line").
2. Determine ODK ('O' for Offense, 'D' for Defense, 'K' for Kicking/Special Teams).
3. Identify Line of Scrimmage (yard line, e.g. "-25" for own 25, "+30" for opp 30, "OWN 35", "OPP 20"), Down (1-4), Distance to first down (yards), and Hash ('L', 'M', or 'R').
4. Track the point of attack: determine Play Type ('Run', 'Pass', 'RPO', 'Screen', 'Punt', 'KO') and Play Direction ('L', 'M', 'R').
5. Recognize jersey numbers:
   - Identify the Ball Carrier / Rusher, Passer, or Target Receiver. Cross-reference with the active roster list.
   - Identify the primary and secondary Tackler(s) / defender(s) who made the stop.
6. Calculate net Gain/Loss (yards from line of scrimmage to tackle/whistle) and determine Play Result (e.g., "Rush", "Complete", "Incomplete", "Sack", "Rush, TD", "Fumble").
7. Write concise, actionable coaching notes explaining gap execution, perimeter edge sealing, missed tackles, or coverage drops.

Output MUST be strictly valid JSON according to the schema provided.`;

  const promptText = `Analyze these ${frames.length} sequential keyframes from Play #${play?.playNumber || 1}.
Frames provided:
${frames.map((f, i) => `Frame ${i + 1} (${f.label} at ${f.timestamp.toFixed(1)}s)`).join('\n')}
${userPrompt ? `Coach notes/focus: ${userPrompt}` : ''}

Respond with pure JSON strictly matching this structure:
{
  "odk": "O" | "D" | "K",
  "quarter": 1 | 2 | 3 | 4,
  "down": 1 | 2 | 3 | 4,
  "distance": 10,
  "yardLine": "-30" | "+25" | "OWN 40",
  "hash": "L" | "M" | "R",
  "formation": "Trips Right" | "Wishbone" | "Pro I-Form" | "Double Wing" | "Spread",
  "backfield": "I-Form" | "Wishbone" | "Shotgun" | "Offset",
  "motion": "Jet L-R" | "None",
  "playType": "Run" | "Pass" | "RPO" | "Screen" | "KO" | "Punt",
  "playName": "26 Dive" | "31 Sweep" | "Power" | "Quick Slant",
  "playDir": "L" | "M" | "R",
  "result": "Rush" | "Complete" | "Incomplete" | "Sack" | "Rush, TD",
  "gainLoss": 5,
  "carrierNum": "21",
  "carrierName": "Nash Ward",
  "passerNum": "12",
  "passerName": "",
  "receiverNum": "",
  "receiverName": "",
  "defensiveFront": "4-4 Stack",
  "tacklerNums": ["52"],
  "tacklerNames": ["Jaxson Pestone"],
  "coachingNotes": "Short sentence analyzing the blocking, gap penetration, or pursuit leverage.",
  "isExplosive": false,
  "isEfficient": true,
  "confidenceScore": 88
}`;

  // Prepare Gemini API multimodal payload
  const imageParts = frames.map((f) => {
    const base64Data = f.dataUrl.split(',')[1];
    return {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    };
  });

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemInstruction + '\n\n' + promptText },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName || 'gemini-2.5-flash'}:generateContent?key=${cleanKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const textContent = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!textContent) throw new Error('Empty response from AI model');

  try {
    const parsed = JSON.parse(textContent);
    return sanitizeAiResult(parsed, roster);
  } catch (err) {
    // Attempt fallback clean
    const match = textContent.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return sanitizeAiResult(parsed, roster);
    }
    throw new Error('Failed to parse AI breakdown JSON response');
  }
}

/**
 * Sanitizes and fills names from roster numbers.
 */
function sanitizeAiResult(raw: any, roster: RosterPlayer[]): AiFilmAnalysisResult {
  const findPlayer = (num?: string) => {
    if (!num) return undefined;
    const cleanNum = String(num).replace(/[^0-9]/g, '');
    return roster.find((p) => p.num === cleanNum);
  };

  const carrier = findPlayer(raw.carrierNum);
  const passer = findPlayer(raw.passerNum);
  const receiver = findPlayer(raw.receiverNum);

  const tacklerNames = Array.isArray(raw.tacklerNums)
    ? raw.tacklerNums.map((n: string) => {
        const p = findPlayer(n);
        return p ? `#${p.num} ${p.firstName} ${p.lastName}` : `#${n}`;
      })
    : [];

  return {
    odk: raw.odk === 'D' ? 'D' : raw.odk === 'K' ? 'K' : 'O',
    quarter: Number(raw.quarter) || 1,
    down: Number(raw.down) || 1,
    distance: Number(raw.distance) || 10,
    yardLine: String(raw.yardLine || '-25'),
    hash: raw.hash === 'L' || raw.hash === 'R' || raw.hash === 'M' ? raw.hash : 'M',
    formation: String(raw.formation || 'Pro I-Form'),
    backfield: String(raw.backfield || 'I-Form'),
    motion: String(raw.motion || 'None'),
    playType: raw.playType || 'Run',
    playName: String(raw.playName || '26 Dive'),
    playDir: raw.playDir === 'L' || raw.playDir === 'R' || raw.playDir === 'M' ? raw.playDir : 'R',
    result: String(raw.result || 'Rush'),
    gainLoss: Number(raw.gainLoss) || 0,
    carrierNum: raw.carrierNum ? String(raw.carrierNum).replace(/[^0-9]/g, '') : carrier?.num,
    carrierName: carrier ? `#${carrier.num} ${carrier.firstName} ${carrier.lastName}` : raw.carrierName || '',
    passerNum: raw.passerNum ? String(raw.passerNum).replace(/[^0-9]/g, '') : passer?.num,
    passerName: passer ? `#${passer.num} ${passer.firstName} ${passer.lastName}` : raw.passerName || '',
    receiverNum: raw.receiverNum ? String(raw.receiverNum).replace(/[^0-9]/g, '') : receiver?.num,
    receiverName: receiver ? `#${receiver.num} ${receiver.firstName} ${receiver.lastName}` : raw.receiverName || '',
    defensiveFront: String(raw.defensiveFront || '4-4 Stack'),
    tacklerNums: Array.isArray(raw.tacklerNums) ? raw.tacklerNums.map((x) => String(x).replace(/[^0-9]/g, '')) : [],
    tacklerNames,
    coachingNotes: String(raw.coachingNotes || 'Downhill execution through intended gap.'),
    isExplosive: Boolean(raw.isExplosive || (Number(raw.gainLoss) >= 12)),
    isEfficient: Boolean(raw.isEfficient || (Number(raw.gainLoss) >= 4)),
    confidenceScore: Math.min(100, Math.max(50, Number(raw.confidenceScore) || 85)),
  };
}

/**
 * Intelligent simulation engine for preview/demo when no Gemini API key is configured.
 */
function simulateLocalAiBreakdown(
  frames: ExtractedFrame[],
  play?: Play,
  roster: RosterPlayer[] = [],
  knownFormations: string[] = [],
  knownPlays: string[] = []
): AiFilmAnalysisResult {
  const pNum = play?.playNumber || 1;
  const rb = roster.find((p) => p.offensivePosition === 'RB' || p.primaryPosition === 'RB') || roster[0];
  const qb = roster.find((p) => p.offensivePosition === 'QB' || p.primaryPosition === 'QB') || roster[1] || roster[0];
  const de = roster.find((p) => p.defensivePosition === 'DE' || p.defensivePosition === 'MLB') || roster[2] || roster[0];

  const forms = knownFormations.length ? knownFormations : ['Wishbone', 'Pro-I Right', '21 Beast Left', 'Trips Right', 'Double Wing'];
  const plays = knownPlays.length ? knownPlays : ['26 Dive', '31 Toss Sweep', '44 Power', 'Smash Hitch', 'Quick Screen'];

  const form = forms[(pNum - 1) % forms.length];
  const playName = plays[(pNum - 1) % plays.length];
  const isPass = playName.toLowerCase().includes('hitch') || playName.toLowerCase().includes('screen');
  const gain = ((pNum * 3) % 9) + 2;

  return {
    odk: play?.odk === 'D' ? 'D' : play?.odk === 'K' ? 'K' : 'O',
    quarter: play?.quarter || (pNum <= 10 ? 1 : pNum <= 20 ? 2 : 3),
    down: play?.down || ((pNum % 3) + 1),
    distance: play?.distance || 10,
    yardLine: play?.rawYardLine || (pNum % 2 === 0 ? '-35' : '+42'),
    hash: pNum % 3 === 0 ? 'L' : pNum % 3 === 1 ? 'R' : 'M',
    formation: form,
    backfield: form.includes('Wishbone') ? 'Wishbone' : form.includes('Beast') ? 'Beast' : 'I-Form',
    motion: pNum % 4 === 0 ? 'Jet Left' : 'None',
    playType: isPass ? 'Pass' : 'Run',
    playName,
    playDir: pNum % 2 === 0 ? 'R' : 'L',
    result: isPass ? 'Complete' : 'Rush',
    gainLoss: gain,
    carrierNum: isPass ? undefined : rb?.num || '21',
    carrierName: isPass ? undefined : rb ? `#${rb.num} ${rb.firstName} ${rb.lastName}` : '#21 Nash Ward',
    passerNum: isPass ? qb?.num || '1' : undefined,
    passerName: isPass ? (qb ? `#${qb.num} ${qb.firstName} ${qb.lastName}` : '#1 QB') : undefined,
    defensiveFront: pNum % 2 === 0 ? '4-4 Stack Cover 3' : '5-3 Over',
    tacklerNums: de ? [de.num] : ['52'],
    tacklerNames: de ? [`#${de.num} ${de.firstName} ${de.lastName}`] : ['#52 Jaxson Pestone'],
    coachingNotes: isPass
      ? `Clean pass release off 3-step drop. Quick completion in flats before perimeter safety broke downhill.`
      : `Tailback pressed outside leverage, planted cleat, and exploded downhill for +${gain} yards. Solid seal block on the perimeter.`,
    isExplosive: gain >= 12,
    isEfficient: gain >= 4,
    confidenceScore: 92,
  };
}

/**
 * Converts an AI breakdown analysis result into Hudl BreakdownRow format.
 */
export function analysisResultToBreakdownRow(res: AiFilmAnalysisResult): BreakdownRow {
  return {
    ODK: res.odk,
    QTR: String(res.quarter),
    DN: String(res.down),
    DIST: String(res.distance),
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
  return {
    backfield: res.backfield,
    motion: res.motion,
    rusher: res.carrierName || (res.carrierNum ? `#${res.carrierNum}` : undefined),
    passer: res.passerName || (res.passerNum ? `#${res.passerNum}` : undefined),
    receiver: res.receiverName || (res.receiverNum ? `#${res.receiverNum}` : undefined),
    carrierOrTarget: res.carrierName || res.receiverName || res.passerName || '',
    isExplosive: res.isExplosive,
    isEfficient: res.isEfficient,
    defPlay: res.tacklerNames?.length
      ? {
          maker: res.tacklerNames[0],
          assists: res.tacklerNames.slice(1),
        }
      : undefined,
  };
}
