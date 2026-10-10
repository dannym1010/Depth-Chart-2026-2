// AI-powered video clip analyzer for youth football film breakdown using Gemini multimodal vision.
// Extracts keyframes from HTML5 video, analyzes schemes/players/down-and-distance, and populates Hudl breakdown rows.
import type { Play, TeamUnit } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import type { BreakdownRow } from '../filmroom/breakdownEntry';
import {
  crossCheckPlayYardage,
  formatAbsoluteYard,
  parseAbsoluteYard,
  type YardageAlignmentResult,
} from './yardageCalculator';

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
    const saved = localStorage.getItem(GEMINI_MODEL_KEY);
    if (saved && ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash-lite'].includes(saved)) {
      return saved;
    }
    localStorage.setItem(GEMINI_MODEL_KEY, 'gemini-flash-latest');
    return 'gemini-flash-latest';
  } catch {
    return 'gemini-flash-latest';
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
  frameCount = 8,
  maxDimension = 1280
): Promise<ExtractedFrame[]> {
  const duration = video.duration || 10;
  const originalTime = video.currentTime;
  const originalPaused = video.paused;

  // Through the play, more of them late: who has the ball, where he's brought down and by whom.
  const timestamps: { t: number; label: string }[] =
    frameCount >= 8
      ? [
          { t: duration * 0.08, label: 'Pre-Snap Alignment' },
          { t: duration * 0.22, label: 'Snap & Mesh' },
          { t: duration * 0.36, label: 'Handoff / Pass Release' },
          { t: duration * 0.5, label: 'Point of Attack' },
          { t: duration * 0.62, label: 'Ball Carrier in Space' },
          { t: duration * 0.74, label: 'Contact' },
          { t: duration * 0.85, label: 'Tackle' },
          { t: duration * 0.95, label: 'Whistle / Ball Spot' },
        ]
      : [
          { t: Math.max(0.2, duration * 0.12), label: 'Pre-Snap Alignment' },
          { t: Math.max(0.8, duration * 0.35), label: 'Snap & Mesh' },
          ...(frameCount >= 5 ? [{ t: Math.max(1.1, duration * 0.45), label: 'Run Fit / Pass Release' }] : []),
          { t: Math.max(1.4, duration * 0.55), label: 'Point of Attack' },
          { t: Math.max(2.0, duration * 0.8), label: 'Tackle / Whistle' },
        ];

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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
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

export interface AnalyzeFilmOptions {
  frames: ExtractedFrame[];
  play?: Play;
  roster?: RosterPlayer[];
  knownFormations?: string[];
  knownPlays?: string[];
  opponentName?: string;
  userPrompt?: string;
  apiKey?: string;
  modelName?: string;
  onStatusUpdate?: (status: string) => void;
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
  } = opts;

  const cleanKey = apiKey.trim();

  // No key: no breakdown (never a made-up one passed off as real).
  if (!cleanKey) {
    throw new Error('No Gemini API key on this device. Open the key settings (the gear at the top of this window), paste your key and save it, then run the breakdown again.');
  }

  const isScout = gameType === 'scout_game';
  const rosterList = linkOurRoster ? formatRosterContext(roster) : 'ROSTER LINKING DISABLED';
  const knownFormsList = knownFormations.filter(Boolean).slice(0, 15).join(', ') || 'Wishbone, Pro-I, Double Wing, Trips Right, Spread, Beast, Pistol';
  const knownPlaysList = knownPlays.filter(Boolean).slice(0, 20).join(', ') || '24 Blast, 26 Dive, 31 Sweep, 44 Power, Counter, Quick Slant, Bubble Screen, QB Sneak';

  // What the play's own data already says (from Hudl or the breakdown): trusted over a guess from frames.
  const startLOS = play?.rawYardLine || '';
  const rosterNums = linkOurRoster ? roster.map((p) => String(p.num || '').trim()).filter(Boolean) : [];

  const systemInstruction = `You are an expert football film coordinator and scout analyst.
Your job is to analyze sequential game footage frames of an American football play and produce an exact, structured breakdown matching Hudl/PFF scouting standards.

Game Setup Context:
- Game Type: ${isScout ? 'SCOUT GAME (Two opponent teams playing each other). DO NOT LINK OUR TEAM ROSTER. Only output visible jersey numbers.' : `OUR GAME: ${ourTeamName} vs ${opponentName}`}
- Team Being Scouted: "${scoutedTeam}"
- Offense (Team with Ball): ${offenseTeam} (Jerseys: ${offenseJerseyColor})
- Defense: ${defenseTeam} (Jerseys: ${defenseJerseyColor})
- Roster Linking: ${linkOurRoster ? `ENABLED: Active Roster: ${rosterList}. Only match players on ${ourUnitRole === 'defense' ? 'Defense (Tacklers)' : 'Offense (Ball Carrier/Passer)'}.` : 'DISABLED: Output jersey numbers only (e.g. #24). Do not assign team player names.'}

ODK (Offense/Defense/Kicking) Rule:
- When the team you are scouting ("${scoutedTeam}") is on OFFENSE -> Set "odk" to "O" (Offense).
- When the team you are scouting ("${scoutedTeam}") is on DEFENSE -> Set "odk" to "D" (Defense).
- When kicking / punt / PAT / kickoff -> Set "odk" to "K".

Core Analysis Focus:
1. WHO CARRIED THE BALL:
   - Follow the football from the snap through every frame. The ball carrier is the player holding the ball in the
     later frames (after the handoff, pitch or catch), not the quarterback who handed it off.
   - Read his jersey number from the back, chest or shoulders, whichever frame shows it clearest (end-zone views show
     backs). Set "carrierNum" to those digits and "carrierConfidence" (0-100) to how sure you are of them.
   - If the digits can't be read in any frame, set "carrierNum" to "" and "carrierConfidence" to 0. NEVER GUESS.
   ${rosterNums.length && ourUnitRole === 'offense' ? `- Our team has the ball: the carrier wears one of these numbers: ${rosterNums.join(', ')}. If what you read isn't one of them, leave it blank.` : ''}
   - On a pass, "passerNum" and "receiverNum" only when the digits are readable. Run direction "playDir": 'L', 'M' or 'R'.
2. WHERE IT STARTED AND ENDED (yard lines):
   - Yard lines are from the side of the team WITH THE BALL: "-35" is its own 35, "+35" is the other team's 35.
     Moving forward from -35 goes to -40, then 50, then +45; from +40 forward goes to +34.
   - Ball snapped at: ${startLOS || 'not known (read it from the field numbers in the first frame)'}. Put it in "yardLine".
   - "whistleYardLine": where the carrier was downed (the ball's spot when the whistle blew), same format.
   - "gainLoss": yards from the snap to that spot: positive forward, negative behind the line, 0 for an incomplete pass.
   ${nextPlayStartYard ? `- The next play on this drive was snapped at ${nextPlayStartYard}. Unless a flag was thrown on this play, that IS where this
     play ended: use it for "whistleYardLine" and make "gainLoss" agree with it.` : ''}
   - "penaltyDetected": true only if you SEE a penalty flag on the field (yellow flag) in a frame; then fill penaltyDetails.
   - If the carrier reached the end zone, say so in "result" (e.g. "Rush, TD").
3. WHO MADE THE TACKLE:
   - In the Contact / Tackle / Whistle frames, the tackler is the defender wrapping up or bringing the carrier down.
     Put his jersey digits first in "tacklerNums"; any other defender in on the tackle after him (assists).
   - Set "tacklerConfidence" (0-100) for the first tackler's number. Unreadable: "tacklerNums": [] and 0. NEVER GUESS.
   ${rosterNums.length && ourUnitRole === 'defense' ? `- Our team is on defense: the tackler wears one of these numbers: ${rosterNums.join(', ')}. If what you read isn't one of them, leave it out.` : ''}

Output MUST be strictly valid JSON matching the schema provided.`;

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
  "yardLine": "-25",
  "hash": "L" | "M" | "R",
  "formation": "Wishbone" | "Pro I-Form" | "Double Wing" | "Spread",
  "backfield": "I-Form" | "Wishbone" | "Shotgun",
  "motion": "None",
  "playType": "Run" | "Pass" | "RPO" | "Screen" | "KO" | "Punt",
  "playName": "Blast" | "Dive" | "Sweep" | "Power",
  "playDir": "L" | "M" | "R",
  "result": "Rush" | "Complete" | "Incomplete" | "Sack" | "Rush, TD",
  "gainLoss": 6,
  "whistleYardLine": "-31",
  "carrierNum": "",
  "carrierConfidence": 0,
  "passerNum": "",
  "receiverNum": "",
  "defensiveFront": "4-4 Stack",
  "tacklerNums": [],
  "tacklerConfidence": 0,
  "coachingNotes": "Detailed observation of blocking, carrier track, and defensive pursuit.",
  "penaltyDetected": false,
  "penaltyDetails": "",
  "penaltyYards": 0,
  "penaltyOn": "None",
  "isExplosive": false,
  "isEfficient": true,
  "confidenceScore": 90
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

  const candidateModels = Array.from(
    new Set(['gemini-flash-latest', 'gemini-3.8-flash', modelName].filter(Boolean))
  );

  let lastErrorText = '';
  let json: any = null;

  for (const m of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          onStatusUpdate?.(`Google AI busy (${attempt}/3) - waiting ${attempt}s to retry...`);
          await new Promise((r) => setTimeout(r, attempt * 1200));
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          json = await res.json();
          break;
        } else {
          lastErrorText = await res.text();
          // If 503 (high demand) or 429 (rate limit), retry next attempt with cooldown
          if ((res.status === 503 || res.status === 429) && attempt < 3) {
            onStatusUpdate?.(`Gemini rate limit (429) - cooling down (${attempt}/3)...`);
            await new Promise((r) => setTimeout(r, attempt * 2500));
            continue;
          }
          // If 404 (model not found), break attempt loop to try next candidate model
          if (res.status === 404) {
            break;
          }
          if (attempt === 3) {
            if (res.status === 429) {
              throw new Error('Gemini API Quota Exceeded (429): You hit the free tier rate limit. Wait ~60 seconds for the per-minute limit to reset, or check daily cap at aistudio.google.com');
            }
            throw new Error(`Gemini API error (${res.status}): ${lastErrorText.slice(0, 200)}`);
          }
        }
      } catch (err: any) {
        if (err?.message?.includes('Gemini API error')) throw err;
        lastErrorText = String(err?.message || err);
      }
    }

    if (json) break;
  }

  if (!json) {
    throw new Error(`Gemini API error: ${lastErrorText.slice(0, 250) || 'All candidate models failed'}`);
  }
  const textContent = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!textContent) throw new Error('Empty response from AI model');

  try {
    const parsed = JSON.parse(textContent);
    return sanitizeAiResult(parsed, roster, {
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
    });
  } catch (err) {
    // Attempt fallback clean
    const match = textContent.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return sanitizeAiResult(parsed, roster, {
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
      });
    }
    throw new Error('Failed to parse AI breakdown JSON response');
  }
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

  let finalOdk: 'O' | 'D' | 'K' = raw.odk === 'D' ? 'D' : raw.odk === 'K' ? 'K' : 'O';
  if (raw.odk !== 'K' && scoutedTeam && offenseTeam && defenseTeam) {
    const isScoutOff = offenseTeam.toLowerCase().includes(scoutedTeam.toLowerCase()) ||
      scoutedTeam.toLowerCase().includes(offenseTeam.toLowerCase());
    const isScoutDef = defenseTeam.toLowerCase().includes(scoutedTeam.toLowerCase()) ||
      scoutedTeam.toLowerCase().includes(defenseTeam.toLowerCase());
    if (isScoutOff) finalOdk = 'O';
    else if (isScoutDef) finalOdk = 'D';
  }

  return {
    odk: finalOdk,
    scoutedTeam,
    quarter: Number(play?.quarter) || Number(raw.quarter) || 1,
    down: Number(play?.down) || Number(raw.down) || 1,
    distance: Number(play?.distance) || Number(raw.distance) || 10,
    yardLine: rawStart,
    hash: raw.hash === 'L' || raw.hash === 'R' || raw.hash === 'M' ? raw.hash : 'M',
    formation: String(raw.formation || 'Pro I-Form'),
    backfield: String(raw.backfield || 'I-Form'),
    motion: String(raw.motion || 'None'),
    playType: raw.playType || 'Run',
    playName: String(raw.playName || '24 Blast'),
    playDir: raw.playDir === 'L' || raw.playDir === 'R' || raw.playDir === 'M' ? raw.playDir : 'R',
    result: String(raw.result || 'Rush'),
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
    defensiveFront: String(raw.defensiveFront || '4-4 Stack'),
    tacklerNums,
    tacklerNames,
    coachingNotes: String(raw.coachingNotes || 'Downhill execution through intended gap.'),
    isExplosive: Boolean(raw.isExplosive || Math.abs(yardCheck.measuredGain) >= 12),
    isEfficient: Boolean(raw.isEfficient || yardCheck.measuredGain >= 4),
    confidenceScore: Math.min(100, Math.max(50, Number(raw.confidenceScore) || 85)),
  };
}

/**
 * Intelligent simulation engine for preview/demo when no Gemini API key is configured.
 */
export function simulateLocalAiBreakdown(
  frames: ExtractedFrame[],
  play?: Play,
  roster: RosterPlayer[] = [],
  knownFormations: string[] = [],
  knownPlays: string[] = [],
  context: {
    gameType?: 'our_game' | 'scout_game';
    scoutedTeam?: string;
    offenseTeam?: string;
    defenseTeam?: string;
    linkOurRoster?: boolean;
    ourUnitRole?: 'offense' | 'defense' | 'none';
    nextPlayStartYard?: string;
    nextPlayOdk?: string;
  } = {}
): AiFilmAnalysisResult {
  const {
    linkOurRoster = true,
    ourUnitRole = 'offense',
    scoutedTeam,
    offenseTeam,
    defenseTeam,
    nextPlayStartYard,
    nextPlayOdk,
  } = context;

  const pNum = play?.playNumber || 1;
  const rb = roster.find((p) => p.offensivePosition === 'RB' || p.primaryPosition === 'RB') || roster[0];
  const qb = roster.find((p) => p.offensivePosition === 'QB' || p.primaryPosition === 'QB') || roster[1] || roster[0];
  const de = roster.find((p) => p.defensivePosition === 'DE' || p.defensivePosition === 'MLB') || roster[2] || roster[0];

  const forms = knownFormations.length ? knownFormations : ['Wishbone', 'Pro-I Right', '21 Beast Left', 'Trips Right', 'Double Wing'];
  const plays = knownPlays.length ? knownPlays : ['24 Blast', '26 Dive', '31 Toss Sweep', '44 Power', 'Smash Hitch', 'Quick Screen'];

  const form = forms[(pNum - 1) % forms.length];
  const playName = plays[(pNum - 1) % plays.length];
  const isPass = playName.toLowerCase().includes('hitch') || playName.toLowerCase().includes('screen');
  const rawGain = ((pNum * 3) % 9) + 2;

  const startLOS = play?.rawYardLine || (pNum % 2 === 0 ? '-35' : '+42');

  const yardCheck = crossCheckPlayYardage({
    currentStartYard: startLOS,
    currentGainLoss: rawGain,
    nextStartYard: nextPlayStartYard,
    currentOdk: play?.odk,
    nextOdk: nextPlayOdk,
    trust: 'spot',
  });

  const linkOffense = linkOurRoster && ourUnitRole === 'offense';
  const linkDefense = linkOurRoster && ourUnitRole === 'defense';

  const existingCarrierNum = play?.rusher?.match(/\d+/)?.[0] || play?.carrierOrTarget?.match(/#?(\d+)/)?.[1];
  const carrierNum = isPass ? undefined : (existingCarrierNum || (rb ? rb.num : undefined));
  const carrierName = isPass
    ? undefined
    : linkOffense && rb
    ? `#${rb.num} ${rb.firstName} ${rb.lastName}`
    : carrierNum
    ? `#${carrierNum}`
    : play?.rusher || play?.carrierOrTarget || undefined;

  const existingTacklerNum = play?.defPlay?.maker?.match(/\d+/)?.[0];
  const tacklerNums = existingTacklerNum ? [existingTacklerNum] : (de ? [de.num] : []);
  const tacklerNames = tacklerNums.map((n) => {
    if (linkDefense) {
      const p = roster.find((x) => x.num === n);
      return p ? `#${p.num} ${p.firstName} ${p.lastName}` : `#${n}`;
    }
    return `#${n}`;
  });

  let finalOdk: 'O' | 'D' | 'K' = play?.odk === 'D' ? 'D' : play?.odk === 'K' ? 'K' : 'O';
  if (scoutedTeam && offenseTeam && defenseTeam && play?.odk !== 'K') {
    const isScoutOff = offenseTeam.toLowerCase().includes(scoutedTeam.toLowerCase()) ||
      scoutedTeam.toLowerCase().includes(offenseTeam.toLowerCase());
    const isScoutDef = defenseTeam.toLowerCase().includes(scoutedTeam.toLowerCase()) ||
      scoutedTeam.toLowerCase().includes(defenseTeam.toLowerCase());
    if (isScoutOff) finalOdk = 'O';
    else if (isScoutDef) finalOdk = 'D';
  }

  return {
    odk: finalOdk,
    scoutedTeam,
    quarter: play?.quarter || (pNum <= 10 ? 1 : pNum <= 20 ? 2 : 3),
    down: play?.down || ((pNum % 3) + 1),
    distance: play?.distance || 10,
    yardLine: startLOS,
    hash: pNum % 3 === 0 ? 'L' : pNum % 3 === 1 ? 'R' : 'M',
    formation: form,
    backfield: form.includes('Wishbone') ? 'Wishbone' : form.includes('Beast') ? 'Beast' : 'I-Form',
    motion: pNum % 4 === 0 ? 'Jet Left' : 'None',
    playType: isPass ? 'Pass' : 'Run',
    playName,
    playDir: pNum % 2 === 0 ? 'R' : 'L',
    result: isPass ? 'Complete' : 'Rush',
    gainLoss: yardCheck.measuredGain,
    yardageSource: yardCheck.gainSource,
    whistleYardLine: yardCheck.whistleFormatted,
    nextPlayYardLine: yardCheck.nextStartFormatted,
    spotAligned: yardCheck.isAligned,
    penaltyDetected: yardCheck.penaltySuspected,
    penaltyDetails: yardCheck.penaltySuggestion || '',
    penaltyYards: yardCheck.penaltyYards,
    penaltyOn: yardCheck.penaltyOn,
    carrierNum,
    carrierName,
    passerNum: isPass ? qb?.num || '1' : undefined,
    passerName: isPass ? (linkOffense && qb ? `#${qb.num} ${qb.firstName} ${qb.lastName}` : '#1') : undefined,
    defensiveFront: pNum % 2 === 0 ? '4-4 Stack Cover 3' : '5-3 Over',
    tacklerNums,
    tacklerNames,
    coachingNotes: isPass
      ? `Clean pass release off 3-step drop. Quick completion in flats before perimeter safety broke downhill.`
      : `Tailback pressed outside leverage, planted cleat, and exploded downhill for +${yardCheck.measuredGain} yards. Solid seal block on the perimeter.`,
    isExplosive: yardCheck.measuredGain >= 12,
    isEfficient: yardCheck.measuredGain >= 4,
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
  const primaryTackler = res.tacklerNames?.[0] || (res.tacklerNums?.[0] ? `#${res.tacklerNums[0]}` : undefined);
  const assists = (res.tacklerNames && res.tacklerNames.length > 1)
    ? res.tacklerNames.slice(1)
    : res.tacklerNums && res.tacklerNums.length > 1
    ? res.tacklerNums.slice(1).map((n) => `#${n}`)
    : undefined;

  return {
    backfield: res.backfield,
    motion: res.motion,
    rusher: res.carrierName || (res.carrierNum ? `#${res.carrierNum}` : undefined),
    passer: res.passerName || (res.passerNum ? `#${res.passerNum}` : undefined),
    receiver: res.receiverName || (res.receiverNum ? `#${res.receiverNum}` : undefined),
    carrierOrTarget: res.carrierName || (res.carrierNum ? `#${res.carrierNum}` : '') || res.receiverName || res.passerName || '',
    isExplosive: res.isExplosive,
    isEfficient: res.isEfficient,
    defPlay: primaryTackler
      ? {
          maker: primaryTackler,
          assists: assists?.length ? assists : undefined,
          events: res.result.toLowerCase().includes('sack')
            ? ['sack']
            : res.gainLoss < 0
            ? ['tfl']
            : undefined,
        }
      : undefined,
  };
}
