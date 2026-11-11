// AI photo tagging when Gemini says no: what kind of "no" it is, and how long to wait before trying the same photo
// again. A limit (402 Payment Required, quota, rate limit, every model busy) often clears after a while, so the batch
// waits longer each time and tries again instead of stopping; a bad or missing key needs the coach.

export type AiErrorKind = 'key' | 'limit' | 'photo';

export function aiErrorKind(message: string): AiErrorKind {
  const m = String(message || '');
  if (/refused this Gemini API key|No Gemini API key|API key not valid|API_KEY_INVALID/i.test(m)) return 'key';
  if (/\b402\b|Payment Required|prepayment|credits are depleted|quota|rate limit|\b429\b|RESOURCE_EXHAUSTED|all models busy|Gemini busy|\b50[03]\b|overloaded|UNAVAILABLE|Failed to fetch|NetworkError|network|timed out|offline/i.test(m)) return 'limit';
  return 'photo';
}

/** Seconds to wait before each try after a limit: longer each time. Past the last, the batch stops. */
export const AI_COOLDOWNS = [30, 60, 120, 300];

export const cooldownFor = (strike: number): number | null => (strike >= 0 && strike < AI_COOLDOWNS.length ? AI_COOLDOWNS[strike] : null);

/** "1:05" from seconds. */
export const mmssLeft = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, '0')}`;

/** What the coach sees about the limit, in plain words. */
export function limitReason(message: string): string {
  if (/\b402\b|Payment Required|prepayment|credits are depleted/i.test(message)) return 'Google says the key’s project is out of credits (402)';
  if (/quota|RESOURCE_EXHAUSTED|\b429\b|rate limit/i.test(message)) return 'Google’s limit for this key was reached';
  if (/Failed to fetch|NetworkError|network|offline/i.test(message)) return 'No internet connection to Gemini';
  if (/timed out/i.test(message)) return 'Gemini took too long to answer';
  return 'Gemini is busy';
}
