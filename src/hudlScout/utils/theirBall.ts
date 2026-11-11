// On a defense play (D) the ball is the other team's. Hudl's RUSHER / PASSER / RECEIVER columns hold the jersey of
// their runner, passer or receiver, and Hudl fills the name from OUR roster ("#13 Landon Veto" for their #13), so
// our kids got credited with the other team's runs. On D plays those are kept as their players, jersey only.
import type { Play } from '../types/football';

/** "13" from "#13 Landon Veto", "13" or "#13". */
const jersey = (label?: string) => {
  const m = String(label || '').match(/#?\s*(\d+)/);
  return m ? m[1] : '';
};

/** The PLAYERS line for their ball: "#13 (Rush)", "Pass #7 to #21", "Passer #7", "Target #21". */
export function theirBallText(opp: { oppRusher?: string; oppPasser?: string; oppReceiver?: string }): string {
  const r = jersey(opp.oppRusher);
  const p = jersey(opp.oppPasser);
  const c = jersey(opp.oppReceiver);
  if (r) return `#${r} (Rush)`;
  if (p && c) return `Pass #${p} to #${c}`;
  if (p) return `Passer #${p}`;
  if (c) return `Target #${c}`;
  return '';
}

/** A defense play with our kids named on their ball (from a Hudl import). */
export const ourKidsOnTheirBall = (p: Play) => p.odk === 'D' && Boolean(p.rusher || p.passer || p.receiver);

/** Those plays: the runner / passer / receiver become their players (jersey only), and ours are cleared. */
export function moveBallToThem(plays: Play[], ids?: string[], now = Date.now()): Play[] {
  const want = ids ? new Set(ids) : null;
  return plays.map((p) => {
    if (!ourKidsOnTheirBall(p) || (want && !want.has(p.id))) return p;
    const next: Play = {
      ...p,
      oppRusher: p.oppRusher || jersey(p.rusher) || undefined,
      oppPasser: p.oppPasser || jersey(p.passer) || undefined,
      oppReceiver: p.oppReceiver || jersey(p.receiver) || undefined,
      editedAt: now,
    };
    delete next.rusher;
    delete next.passer;
    delete next.receiver;
    for (const k of ['oppRusher', 'oppPasser', 'oppReceiver'] as const) if (!next[k]) delete next[k];
    next.carrierOrTarget = theirBallText(next);
    return next;
  });
}
