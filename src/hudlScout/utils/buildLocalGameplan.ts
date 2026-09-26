import { AIScoutingReport, Play, TendencyAnalysis } from '../types/football';
import { isRecordedMotion } from './csvParser';

function groupName(plays: Play[], pick: (p: Play) => string, limit = 4) {
  const counts: Record<string, { count: number; yards: number }> = {};
  plays.forEach((p) => {
    const name = pick(p).trim();
    if (!name || name === '-' || name.toLowerCase() === 'none') return;
    if (!counts[name]) counts[name] = { count: 0, yards: 0 };
    counts[name].count += 1;
    counts[name].yards += p.gainLoss;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([name, stat]) => ({
      name,
      count: stat.count,
      avg: stat.count ? Number((stat.yards / stat.count).toFixed(1)) : 0,
    }));
}

function sit(analysis: TendencyAnalysis, labelPart: string) {
  return analysis.situationalGroups.find((g) => g.label.toLowerCase().includes(labelPart.toLowerCase()));
}

export function callForRunPass(runPct: number, shortYardage: boolean) {
  if (shortYardage || runPct >= 70) {
    return {
      coverage: 'Cover 1 Hole / Tight Man',
      front: '4-4 Over · 8-man box',
      emphasis: `They run it ${runPct}% here. Plug A/B gaps and spill bounce plays to the sideline.`,
    };
  }
  if (runPct >= 55) {
    return {
      coverage: 'Cover 3 Sky',
      front: '4-4 Over / 4-2-5 with walked-up nickel',
      emphasis: `Run-first (${runPct}% run). Keep a safety in the box and play the cutback.`,
    };
  }
  if (runPct <= 40) {
    return {
      coverage: 'Cover 4 Quarters or Cover 2',
      front: '4-2-5 Under',
      emphasis: `Pass-leaning (${100 - runPct}% pass). Rush 4, drop 7, and sit on screens.`,
    };
  }
  return {
    coverage: 'Cover 3 Match',
    front: 'Base 4-4',
    emphasis: `Balanced (${runPct}% run). Read formation and hash, then cheat the extra hat to the run strength.`,
  };
}

export function buildLocalGameplan(analysis: TendencyAnalysis, plays: Play[], opponentName: string): AIScoutingReport {
  const first = sit(analysis, '1st & 10') || sit(analysis, '1st');
  const secondShort = sit(analysis, '2nd & Short');
  const secondLong = sit(analysis, '2nd & Long');
  const thirdShort = sit(analysis, '3rd & Short');
  const thirdLong = sit(analysis, '3rd & Long');
  const topForm = analysis.formations[0];
  const identity = analysis.runPct >= 58 ? 'Run-first youth power / off-tackle' : analysis.runPct <= 42 ? 'Spread / pass-lean' : 'Balanced run-pass';
  const hashBias =
    analysis.hashTendencies.left.total > analysis.hashTendencies.right.total
      ? 'left hash'
      : analysis.hashTendencies.right.total > analysis.hashTendencies.left.total
        ? 'right hash'
        : 'balanced hashes';
  const topTell = analysis.tells[0];
  const rushers = groupName(
    plays.filter((p) => p.playType === 'RUN'),
    (p) => p.oppRusher || p.carrierOrTarget
  );
  const passers = groupName(
    plays.filter((p) => p.playType === 'PASS' || p.playType === 'RPO' || p.playType === 'SCREEN'),
    (p) => p.oppPasser || p.carrierOrTarget
  );
  const receivers = groupName(
    plays.filter((p) => p.playType === 'PASS' || p.playType === 'SCREEN'),
    (p) => p.oppReceiver || p.carrierOrTarget
  );

  const firstCall = callForRunPass(first?.runPct ?? analysis.runPct, false);
  const secondShortCall = callForRunPass(secondShort?.runPct ?? 70, true);
  const secondLongCall = callForRunPass(secondLong?.runPct ?? 35, false);
  const thirdShortCall = callForRunPass(thirdShort?.runPct ?? 75, true);
  const thirdLongCall = callForRunPass(thirdLong?.runPct ?? 25, false);
  const rzRun = analysis.redZonePlays.runPct;
  const redZoneCall = callForRunPass(rzRun || analysis.runPct, rzRun >= 55);

  const strengths: string[] = [];
  if (analysis.runPct >= 55) strengths.push(`${analysis.runPct}% run rate, ${analysis.avgGainRun} yards per carry.`);
  if (analysis.explosivePlayRate >= 10) strengths.push(`${analysis.explosivePlayRate}% explosive-play rate (${analysis.explosivePlayCount} chunk plays).`);
  if (topForm) strengths.push(`${topForm.formation} is their base (${topForm.pctOfTotal}% of snaps, ${topForm.runPct}% run).`);
  if (analysis.thirdDownConversions.short.rate >= 50) {
    strengths.push(`Converts ${analysis.thirdDownConversions.short.rate}% of 3rd & short.`);
  }
  if (!strengths.length) strengths.push('Film sample is light — treat them as a balanced 10U run team until more snaps are logged.');

  const vulnerabilities: string[] = [];
  if (analysis.tells.length) vulnerabilities.push(...analysis.tells.slice(0, 3).map((t) => `${t.title}: ${t.statEvidence}. Counter: ${t.recommendedCounter}`));
  if (analysis.thirdDownConversions.long.rate <= 35 && analysis.thirdDownConversions.long.total > 0) {
    vulnerabilities.push(`3rd & long converts only ${analysis.thirdDownConversions.long.rate}% — pin them there.`);
  }
  if (analysis.hashTendencies.left.runPct >= 65 && analysis.hashTendencies.left.total >= 8) {
    vulnerabilities.push(`Left hash is ${analysis.hashTendencies.left.runPct}% run. Spill to the field and set the edge.`);
  }
  if (analysis.hashTendencies.right.runPct >= 65 && analysis.hashTendencies.right.total >= 8) {
    vulnerabilities.push(`Right hash is ${analysis.hashTendencies.right.runPct}% run. Crowd the boundary.`);
  }
  if (!vulnerabilities.length) vulnerabilities.push('No strong tells yet. Play sound 4-4 gaps and make them beat you on 3rd down.');

  const baseFront = analysis.runPct >= 58 ? '4-4 Over, extra hat in the box' : analysis.runPct <= 42 ? '4-2-5 Under, two-high until they prove the run' : '4-4 Base, nickel as needed';
  const secondary = analysis.runPct >= 58 ? 'Cover 3 Sky, safety downhill' : 'Cover 4 / Cover 3 Match';

  const wristband = {
    firstDownCalls: [
      firstCall.front + ' · ' + firstCall.coverage,
      topForm ? `Vs ${topForm.formation}: ${topForm.runPct >= 55 ? 'Box the run' : 'Stay two-high'}` : 'Base 4-4 · Cover 3',
      'Check hash — extra defender to the run strength',
    ],
    runStopCalls: [
      '8-man box · plug A-gaps',
      'Set the edge, spill bounce',
      thirdShort && thirdShort.runPct >= 60 ? '3rd & short: goal-line 5-2' : 'Force cutback to the Mike',
    ],
    passBlitzCalls: [
      thirdLong && thirdLong.passPct >= 55 ? '3rd & long: 5-man fire zone' : 'Rush 4, drop 7',
      'Sit on screens and bubble',
      'Boundary pressure if they empty',
    ],
    thirdDownMustStops: [
      `3rd & short: ${thirdShortCall.front}`,
      `3rd & long: ${thirdLongCall.coverage}`,
      `They convert ${analysis.thirdDownConversions.rate}% of 3rd downs overall`,
    ],
    redZoneLocks: [
      redZoneCall.front,
      analysis.redZonePlays.topPlays[0] ? `Watch ${analysis.redZonePlays.topPlays[0].name}` : 'No dive / sneak without a hat',
      'Press the goal line, keep everything in front',
    ],
  };

  const keyPlayerMatchups = [
    ...rushers.map((r) => ({
      targetOrPlayer: r.name,
      role: 'Rusher',
      scoutingNote: `${r.count} carries, ${r.avg} yds/att.`,
      defensiveCounter: 'Fit the alley, wrap up, no arm tackles.',
    })),
    ...passers.map((r) => ({
      targetOrPlayer: r.name,
      role: 'Passer',
      scoutingNote: `${r.count} dropbacks.`,
      defensiveCounter: 'Keep contain. Do not let him scramble the edge.',
    })),
    ...receivers.map((r) => ({
      targetOrPlayer: r.name,
      role: 'Receiver',
      scoutingNote: `${r.count} targets.`,
      defensiveCounter: 'Bracket on 3rd down. No free releases inside.',
    })),
  ].slice(0, 6);

  if (!keyPlayerMatchups.length) {
    keyPlayerMatchups.push({
      targetOrPlayer: 'Unlisted ball carriers',
      role: 'Skill',
      scoutingNote: 'Hudl names were blank on this export.',
      defensiveCounter: 'Tag the first man through the hole and the widest receiver.',
    });
  }

  return {
    executiveSummary: `${opponentName} is a ${identity} team in this ${analysis.totalPlays}-play sample (${analysis.runPct}% run / ${analysis.passPct}% pass, ${analysis.avgGainOverall} yards per snap). They work the ${hashBias}. ${
      topTell ? `Biggest tell: ${topTell.title.replace(/s*Tell$/i, '')}: ${topTell.statEvidence.replace(/.s*$/, '')}.` : 'No single tell jumps off the sheet yet.'
    } Play gap-sound 10U defense: extra hat vs the run, do not get the edges cracked, and make them execute on 3rd & long.`,
    opponentIdentity: {
      offensiveSystem: identity + (topForm ? ` out of ${topForm.formation}` : ''),
      tempoPace: analysis.totalPlays >= 80 ? 'Higher snap volume — stay in huddle tempo and sub cleanly' : 'Standard youth pace',
      strengths,
      vulnerabilities,
    },
    defensivePhilosophyRecommendation: {
      recommendedBaseFront: baseFront,
      secondaryAlignment: secondary,
      rationale: `Match their ${analysis.runPct}% run rate. ${firstCall.emphasis}`,
    },
    downAndDistanceGameplan: {
      firstAndTen: firstCall,
      secondAndShort: secondShortCall,
      secondAndLong: secondLongCall,
      thirdAndShort: thirdShortCall,
      thirdAndLong: thirdLongCall,
      redZone: redZoneCall,
    },
    blitzAndPressurePackages: [
      {
        name: 'Edge Set',
        situation: 'Early downs / run hash',
        description: 'DE stay wide, LB fill C-gap. No bounce.',
        targetWeakness: hashBias + ' run lean',
      },
      {
        name: 'A-Gap Plug',
        situation: '3rd & short / red zone',
        description: 'Mike and Will step into the A-gaps. No sneak, no trap.',
        targetWeakness: `${analysis.thirdDownConversions.short.runPct}% run on 3rd & short`,
      },
      {
        name: 'Fire Zone 5',
        situation: '3rd & long',
        description: 'Five-man pressure, three-deep behind it. Force a hot throw.',
        targetWeakness: `${analysis.thirdDownConversions.long.passPct}% pass on 3rd & long`,
      },
      {
        name: 'Screen Sit',
        situation: '2nd & long / obvious pass',
        description: 'Ends peek back. Do not chase upfield.',
        targetWeakness: 'Youth teams throw bubble and slow screen when behind the sticks',
      },
    ],
    keyPlayerMatchups,
    wristbandCallSheet: wristband,
  };
}

export function specialTeamsSummary(plays: Play[]) {
  const st = plays.filter((p) => p.odk === 'K' || p.playType === 'SPECIAL');
  const kinds: Record<string, number> = {};
  st.forEach((p) => {
    const key = (p.playName || p.result || p.playType || 'ST').trim() || 'ST';
    kinds[key] = (kinds[key] || 0) + 1;
  });
  return {
    total: st.length,
    kinds: Object.entries(kinds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count })),
  };
}

export function personnelPackages(plays: Play[]) {
  return groupName(
    plays.filter((p) => p.odk !== 'K' && p.playType !== 'SPECIAL'),
    (p) => p.personnel
  );
}

export function motionSummary(plays: Play[]) {
  const snaps = plays.filter((p) => p.odk !== 'K' && p.playType !== 'SPECIAL');
  const withMotion = snaps.filter((p) => isRecordedMotion(p.motion));
  return {
    total: snaps.length,
    motionCount: withMotion.length,
    motionPct: snaps.length ? Math.round((withMotion.length / snaps.length) * 100) : 0,
    topMotions: groupName(withMotion, (p) => p.motion, 5),
  };
}

export function runFitKeys(analysis: TendencyAnalysis) {
  const d = analysis.runDirections;
  const entries = [
    ['Left perimeter', d.leftPerimeter],
    ['Off-tackle left', d.offTackleLeft],
    ['A-gap left', d.aGapLeft],
    ['Middle', d.middle],
    ['A-gap right', d.aGapRight],
    ['Off-tackle right', d.offTackleRight],
    ['Right perimeter', d.rightPerimeter],
  ] as const;
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return entries
    .map(([name, count]) => ({ name, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

function sitLine(analysis: TendencyAnalysis, part: string) {
  const g = analysis.situationalGroups.find((s) => s.label.toLowerCase().includes(part.toLowerCase()));
  if (!g || !g.count) return `No ${part} snaps in this sample.`;
  const topPlay = g.topPlays[0];
  const topForm = g.topFormations[0];
  return `${g.label}: ${g.count} snaps, ${g.runPct}% run / ${g.passPct}% pass, ${g.avgGain} yds/play.${
    topForm ? ` Top look: ${topForm.name} (${topForm.pct}%).` : ''
  }${topPlay ? ` Top call: ${topPlay.name} (${topPlay.count}x, ${topPlay.avgGain} yds).` : ''} Alert: ${g.defensiveAlert}`;
}

export function answerCoachQuestion(
  question: string,
  analysis: TendencyAnalysis,
  plays: Play[],
  opponentName: string,
  report: AIScoutingReport
): string {
  const q = question.toLowerCase();
  if (q.includes('3rd') && (q.includes('short') || q.includes('1') || q.includes('2'))) {
    return sitLine(analysis, '3rd & short');
  }
  if (q.includes('3rd') && q.includes('long')) return sitLine(analysis, '3rd & long');
  if (q.includes('3rd')) return sitLine(analysis, '3rd & medium') + '\n' + sitLine(analysis, '3rd & long');
  if (q.includes('2nd') && q.includes('short')) return sitLine(analysis, '2nd & short');
  if (q.includes('2nd') && q.includes('long')) return sitLine(analysis, '2nd & long');
  if (q.includes('1st')) return sitLine(analysis, '1st');
  if (q.includes('red zone') || q.includes('goal')) {
    const rz = analysis.redZonePlays;
    return `Red zone: ${rz.total} snaps, ${rz.runPct}% run / ${rz.passPct}% pass, ${rz.avgGain} yds/play. Top calls: ${
      rz.topPlays.map((p) => `${p.name} (${p.count})`).join(', ') || 'none listed'
    }. Call: ${report.downAndDistanceGameplan.redZone.front} · ${report.downAndDistanceGameplan.redZone.coverage}.`;
  }
  if (q.includes('left hash') || (q.includes('hash') && q.includes('left'))) {
    const h = analysis.hashTendencies.left;
    return `Left hash: ${h.total} snaps, ${h.runPct}% run (${h.runLeftPct}% left / ${h.runRightPct}% right).`;
  }
  if (q.includes('right hash') || (q.includes('hash') && q.includes('right'))) {
    const h = analysis.hashTendencies.right;
    return `Right hash: ${h.total} snaps, ${h.runPct}% run (${h.runLeftPct}% left / ${h.runRightPct}% right).`;
  }
  if (q.includes('blitz') || q.includes('pressure') || q.includes('front')) {
    return report.blitzAndPressurePackages.map((p) => `${p.name} (${p.situation}): ${p.description}`).join('\n');
  }
  if (q.includes('personnel') || q.includes('package')) {
    const pkgs = personnelPackages(plays);
    return pkgs.length
      ? pkgs.map((p) => `${p.name}: ${p.count} snaps, ${p.avg} yds`).join('\n')
      : 'No personnel labels in this Hudl export.';
  }
  if (q.includes('formation')) {
    return analysis.formations
      .slice(0, 5)
      .map((f) => `${f.formation}: ${f.count} snaps, ${f.runPct}% run, ${f.avgGain} yds`)
      .join('\n') || 'No formation column in this export.';
  }
  if (q.includes('who') || q.includes('rusher') || q.includes('player') || q.includes('back')) {
    return report.keyPlayerMatchups.map((p) => `${p.targetOrPlayer} (${p.role}): ${p.scoutingNote}`).join('\n');
  }
  return `${opponentName} in this sample: ${analysis.totalPlays} snaps, ${analysis.runPct}% run / ${analysis.passPct}% pass, ${analysis.avgGainOverall} yds/play.\n${
    report.executiveSummary
  }\n\nBase call: ${report.defensivePhilosophyRecommendation.recommendedBaseFront}.`;
}
