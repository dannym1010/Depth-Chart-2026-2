import { Play, TendencyAnalysis } from '../../types/football';

// Plain-language wording for the scouting report. Everything a coach reads on the
// Summary tab is built here so the phrasing stays consistent across tabs.

export type ReportUnit = 'O' | 'D' | 'K' | 'ALL';

export interface ReportVoice {
  mode: 'opponent' | 'own';
  unit: ReportUnit;
  /** Sentence subject, always plural: "They", "We", "Teams playing them". */
  subject: string;
  /** "their" / "our" */
  possessive: string;
  /** Headline noun for the selected unit, e.g. "offense", "offenses facing them". */
  unitLabel: string;
  /** "Our answer" lines only make sense when we are defending the opponent's offense. */
  showCounters: boolean;
  /** Self-scout tips instead of counters when looking at our own offense. */
  showSelfScout: boolean;
}

export function makeVoice(mode: 'opponent' | 'own', unit: ReportUnit): ReportVoice {
  if (mode === 'own') {
    if (unit === 'D') return { mode, unit, subject: 'Teams playing us', possessive: 'their', unitLabel: 'offenses facing us', showCounters: false, showSelfScout: false };
    if (unit === 'K') return { mode, unit, subject: 'We', possessive: 'our', unitLabel: 'special teams', showCounters: false, showSelfScout: false };
    return { mode, unit, subject: 'We', possessive: 'our', unitLabel: unit === 'ALL' ? 'team (every play)' : 'offense', showCounters: false, showSelfScout: unit === 'O' };
  }
  if (unit === 'D') return { mode, unit, subject: 'Teams playing them', possessive: 'their', unitLabel: 'offenses facing them', showCounters: false, showSelfScout: false };
  if (unit === 'K') return { mode, unit, subject: 'They', possessive: 'their', unitLabel: 'special teams', showCounters: false, showSelfScout: false };
  return { mode, unit, subject: 'They', possessive: 'their', unitLabel: unit === 'ALL' ? 'team (every play)' : 'offense', showCounters: unit === 'O', showSelfScout: false };
}

/** Hudl logs penalties and timeouts in the play-name column; they are not calls. */
export const isRealCall = (name: string) => !/^(penalty|timeout|time out|kneel|spike|-|none)?$/i.test((name || '').trim());

/** Slate for a small share, deep green for a big one; white text reads on both. */
export function shareGreen(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 60));
  const a = [100, 116, 139];
  const b = [4, 120, 87];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const isRunPlay = (p: Play) => p.playType === 'RUN' || p.playType === 'RPO';
export const isPassPlay = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN';

/** Jersey numbers read better with a # in front. */
export function playerName(raw: string): string {
  const s = raw.trim();
  return /^\d{1,2}$/.test(s) ? `#${s}` : s;
}

export function sampleSize(n: number): { level: 'low' | 'fair' | 'good'; text: string } {
  if (n < 20) return { level: 'low', text: `Only ${n} plays. Treat these numbers as a hint, not a rule.` };
  if (n < 50) return { level: 'fair', text: `${n} plays. A fair sample; strong leans are worth trusting.` };
  return { level: 'good', text: `${n} plays. A solid sample.` };
}

export function identity(a: TendencyAnalysis, v: ReportVoice): { label: string; sentence: string } {
  const r = a.runPct;
  const label =
    r >= 65 ? 'Run-first' : r >= 55 ? 'Run-leaning' : r <= 35 ? 'Pass-first' : r <= 45 ? 'Pass-leaning' : 'Balanced';
  const sentence =
    a.totalPlays === 0
      ? 'No plays to read yet.'
      : `${v.subject} run the ball ${a.runPct}% of the time (${a.avgGainRun} yards a carry) and throw it ${a.passPct}% (${a.avgGainPass} yards a pass).`;
  return { label: `${label} ${v.unitLabel}`, sentence };
}

export const GAP_LABELS: Record<keyof TendencyAnalysis['runDirections'], string> = {
  leftPerimeter: 'left edge',
  offTackleLeft: 'off-tackle left',
  aGapLeft: 'A-gap left',
  middle: 'straight up the middle',
  aGapRight: 'A-gap right',
  offTackleRight: 'off-tackle right',
  rightPerimeter: 'right edge',
};

export function runSides(a: TendencyAnalysis) {
  const d = a.runDirections;
  const total = Object.values(d).reduce((x, y) => x + y, 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const left = d.leftPerimeter + d.offTackleLeft + d.aGapLeft;
  const right = d.rightPerimeter + d.offTackleRight + d.aGapRight;
  const entries = (Object.keys(d) as (keyof typeof d)[]).map((k) => ({ key: k, label: GAP_LABELS[k], count: d[k], pct: pct(d[k]) }));
  const favorite = entries.reduce((best, e) => (e.count > best.count ? e : best), entries[0]);
  return { total, leftPct: pct(left), middlePct: pct(d.middle), rightPct: pct(right), favorite, entries };
}

/** Most frequent names in a column, with carries/targets and yards per play. */
export function topNames(plays: Play[], pick: (p: Play) => string | undefined, limit = 5) {
  const counts: Record<string, { count: number; yards: number }> = {};
  plays.forEach((p) => {
    const name = (pick(p) || '').trim();
    if (!name || !isRealCall(name) || /^(unknown|n\/a)$/i.test(name)) return;
    counts[name] = counts[name] || { count: 0, yards: 0 };
    counts[name].count += 1;
    counts[name].yards += p.gainLoss;
  });
  return Object.entries(counts)
    .sort((x, y) => y[1].count - x[1].count)
    .slice(0, limit)
    .map(([name, s]) => ({ name: playerName(name), count: s.count, avg: Math.round((s.yards / s.count) * 10) / 10 }));
}

export interface Takeaway {
  id: string;
  title: string;
  detail: string;
  /** How we stop it (opponent offense only). */
  counter?: string;
  /** What defenses will key on (our own offense only). */
  selfScout?: string;
  tone: 'run' | 'pass' | 'alert' | 'info';
  weight: number;
}

/** The handful of things a coach should walk away with, strongest first. */
export function buildTakeaways(a: TendencyAnalysis, plays: Play[], v: ReportVoice, limit = 4): Takeaway[] {
  if (a.totalPlays === 0) return [];
  const out: Takeaway[] = [];
  const they = v.subject;
  const theyLower = they === 'We' ? 'we' : they.toLowerCase();

  if (a.runPct >= 60 && a.totalPlays >= 10) {
    out.push({
      id: 'run-heavy', tone: 'run', weight: a.runPct,
      title: `${they} run the ball: ${a.runPct}% of plays`,
      detail: `${a.avgGainRun} yards a carry. Expect run on early downs.`,
      counter: 'Put 8 in the box and bring a safety down.',
      selfScout: 'Defenses will load the box. Have play-action ready on early downs.',
    });
  } else if (a.passPct >= 55 && a.totalPlays >= 10) {
    out.push({
      id: 'pass-heavy', tone: 'pass', weight: a.passPct,
      title: `${they} throw it: ${a.passPct}% of plays`,
      detail: `${a.avgGainPass} yards a pass.`,
      counter: 'Rush 4, drop 7, and keep everything in front.',
      selfScout: 'Defenses will play soft coverage. The run game should be there.',
    });
  }

  const sides = runSides(a);
  if (sides.total >= 8 && sides.favorite.pct >= 25) {
    const fav = sides.favorite;
    const side = fav.key.toLowerCase().includes('right') ? 'right' : fav.key.toLowerCase().includes('left') ? 'left' : 'middle';
    const lean =
      Math.abs(sides.rightPct - sides.leftPct) >= 15
        ? ` ${Math.max(sides.rightPct, sides.leftPct)}% of all runs go ${sides.rightPct > sides.leftPct ? 'right' : 'left'}.`
        : '';
    out.push({
      id: 'fav-gap', tone: 'run', weight: fav.pct + 20,
      title: `Favorite run: ${fav.label} (${fav.pct}% of runs)`,
      detail: `${fav.count} of ${sides.total} runs.${lean}`,
      counter:
        side === 'middle'
          ? 'Plug the A-gaps first: nose and Mike fill inside.'
          : `Set a hard edge on the ${side}. Backside linebacker scrapes over the top.`,
      selfScout: 'Defenses will key this gap. Run a counter or play-action off it.',
    });
  }

  const ws = a.wideSide;
  if (ws.hashRunCount >= 8 && (ws.widePct >= 65 || ws.boundaryPct >= 55)) {
    const wide = ws.widePct >= 65;
    out.push({
      id: 'wide-side', tone: 'run', weight: (wide ? ws.widePct : ws.boundaryPct) - 5,
      title: wide
        ? `From a hash, ${theyLower} run to the wide side (${ws.widePct}%)`
        : `From a hash, ${theyLower} run to the short side (${ws.boundaryPct}%)`,
      detail: wide
        ? 'The wide side is the side of the field with more room.'
        : 'The short side is the side nearest the sideline.',
      counter: wide
        ? 'Set the strength of the front to the wide side of the field.'
        : 'Set the strength of the front to the short side; the sideline is an extra defender.',
      selfScout: 'Defenses will set their strength that way. Mix in runs to the other side.',
    });
  }

  a.tells.forEach((t) => {
    if (out.some((o) => o.id === 'wide-side') && t.category === 'HASH') return;
    out.push({
      id: `tell-${t.id}`, tone: 'alert', weight: t.confidencePct,
      title: t.title.replace(/\s*(Tell|Tendency)$/i, ''),
      detail: `${t.trigger}: ${t.statEvidence}`,
      counter: t.recommendedCounter,
      selfScout: 'Opponents who study film can key on this.',
    });
  });

  const third = a.thirdDownConversions;
  if (third.long.total >= 4 && third.long.rate <= 35) {
    out.push({
      id: 'third-long', tone: 'info', weight: 70 - third.long.rate,
      title: `3rd & long is a weak spot (${third.long.rate}% converted)`,
      detail: `${third.long.converted} of ${third.long.total} on 3rd & 7 or more.`,
      counter: 'Win 1st and 2nd down to put them in 3rd & long.',
      selfScout: 'Stay out of 3rd & long: aim for 4+ yards on 1st down.',
    });
  } else if (third.total >= 6 && third.rate >= 55) {
    out.push({
      id: 'third-good', tone: 'alert', weight: third.rate,
      title: `${they} convert on 3rd down (${third.rate}%)`,
      detail: `${third.converted} of ${third.total} third downs.`,
      counter: 'Bring the extra hat on 3rd & short and tackle short of the sticks.',
    });
  }

  if (a.explosivePlayCount >= 3 && a.explosivePlayRate >= 15) {
    const every = Math.max(2, Math.round(100 / a.explosivePlayRate));
    out.push({
      id: 'big-plays', tone: 'alert', weight: a.explosivePlayRate * 3,
      title: `Big-play threat: 1 in every ${every} plays`,
      detail: `${a.explosivePlayCount} big plays (runs of 12+ yards, passes of 16+).`,
      counter: 'Tackle in space and keep leverage. Nobody loafs on the backside.',
      selfScout: 'Our big-play rate is a strength. Keep taking shots.',
    });
  }

  const runs = plays.filter(isRunPlay);
  const carriers = topNames(runs, (p) => p.oppRusher || p.carrierOrTarget, 1);
  if (carriers[0] && runs.length >= 8 && carriers[0].count / runs.length >= 0.35) {
    const c = carriers[0];
    out.push({
      id: 'workhorse', tone: 'info', weight: Math.round((c.count / runs.length) * 100),
      title: `${c.name} gets the ball: ${c.count} of ${runs.length} carries`,
      detail: `${c.avg} yards a carry.`,
      counter: `Know where ${c.name} lines up every snap and gang-tackle him.`,
      selfScout: `Defenses will key ${c.name}. Use him as a decoy on play-action.`,
    });
  }

  return out.sort((x, y) => y.weight - x.weight).slice(0, limit);
}
