import { DownDistGroup, FormationStat, OpponentTell, Play, TendencyAnalysis } from '../types/football';

export function calculateTendencies(plays: Play[]): TendencyAnalysis {
  // Filter out special teams (K) and stoppages (S) so scrimmage run/pass down & distance stats are clean
  const scrimmagePlays = plays.filter((p) => {
    if (p.playType === 'SPECIAL') return false;
    if (p.odk === 'K' || p.odk === 'S') return false;
    return true;
  });

  const offensivePlays = scrimmagePlays.length > 0 ? scrimmagePlays : plays;
  const totalPlays = offensivePlays.length;

  if (totalPlays === 0) {
    return getEmptyAnalysis();
  }

  // Basic counts
  const runPlays = offensivePlays.filter((p) => p.playType === 'RUN').length;
  const passPlays = offensivePlays.filter((p) => p.playType === 'PASS' || p.playType === 'RPO' || p.playType === 'SCREEN').length;
  const runPct = Math.round((runPlays / totalPlays) * 100);
  const passPct = Math.round((passPlays / totalPlays) * 100);

  // Yardage averages
  const totalYards = offensivePlays.reduce((acc, p) => acc + p.gainLoss, 0);
  const avgGainOverall = totalPlays > 0 ? Number((totalYards / totalPlays).toFixed(1)) : 0;

  const runYards = offensivePlays.filter((p) => p.playType === 'RUN').reduce((acc, p) => acc + p.gainLoss, 0);
  const avgGainRun = runPlays > 0 ? Number((runYards / runPlays).toFixed(1)) : 0;

  const passYards = offensivePlays.filter((p) => p.playType === 'PASS' || p.playType === 'RPO' || p.playType === 'SCREEN').reduce((acc, p) => acc + p.gainLoss, 0);
  const avgGainPass = passPlays > 0 ? Number((passYards / passPlays).toFixed(1)) : 0;

  // Efficiency & Explosive
  const efficientCount = offensivePlays.filter((p) => p.isEfficient).length;
  const overallEfficiencyRate = Math.round((efficientCount / totalPlays) * 100);

  const explosivePlays = offensivePlays.filter((p) => p.isExplosive);
  const explosivePlayCount = explosivePlays.length;
  const explosivePlayRate = Math.round((explosivePlayCount / totalPlays) * 100);

  // Situational Groups
  const situationalGroups: DownDistGroup[] = [
    buildDownDistGroup('1st & 10', 1, 9, 11, offensivePlays),
    buildDownDistGroup('2nd & Short (1-3 yds)', 2, 1, 3, offensivePlays),
    buildDownDistGroup('2nd & Medium (4-6 yds)', 2, 4, 6, offensivePlays),
    buildDownDistGroup('2nd & Long (7+ yds)', 2, 7, 99, offensivePlays),
    buildDownDistGroup('3rd & Short (1-2 yds)', 3, 1, 2, offensivePlays),
    buildDownDistGroup('3rd & Medium (3-6 yds)', 3, 3, 6, offensivePlays),
    buildDownDistGroup('3rd & Long (7+ yds)', 3, 7, 99, offensivePlays),
    buildDownDistGroup('4th Down', 4, 1, 99, offensivePlays),
  ];

  // 3rd Down Analytics
  const thirdPlays = offensivePlays.filter((p) => p.down === 3);
  const thirdShort = thirdPlays.filter((p) => p.distance <= 2);
  const thirdMed = thirdPlays.filter((p) => p.distance >= 3 && p.distance <= 6);
  const thirdLong = thirdPlays.filter((p) => p.distance >= 7);

  const calcConversion = (sub: Play[]) => {
    const total = sub.length;
    const converted = sub.filter((p) => p.gainLoss >= p.distance).length;
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    const runs = sub.filter((p) => p.playType === 'RUN').length;
    const passes = sub.filter((p) => p.playType !== 'RUN').length;
    return {
      total,
      converted,
      rate,
      runPct: total > 0 ? Math.round((runs / total) * 100) : 0,
      passPct: total > 0 ? Math.round((passes / total) * 100) : 0,
    };
  };

  const thirdDownConversions = {
    total: thirdPlays.length,
    converted: thirdPlays.filter((p) => p.gainLoss >= p.distance).length,
    rate: thirdPlays.length > 0 ? Math.round((thirdPlays.filter((p) => p.gainLoss >= p.distance).length / thirdPlays.length) * 100) : 0,
    short: calcConversion(thirdShort),
    medium: calcConversion(thirdMed),
    long: calcConversion(thirdLong),
  };

  // Red Zone (inside opp 20)
  const redZoneList = offensivePlays.filter((p) => p.fieldZone === 'red_zone' || p.fieldZone === 'goal_line');
  const rzRuns = redZoneList.filter((p) => p.playType === 'RUN').length;
  const rzPasses = redZoneList.filter((p) => p.playType !== 'RUN').length;
  const rzTotal = redZoneList.length;
  const rzYards = redZoneList.reduce((acc, p) => acc + p.gainLoss, 0);

  const rzPlayCounts: Record<string, number> = {};
  redZoneList.forEach((p) => {
    rzPlayCounts[p.playName] = (rzPlayCounts[p.playName] || 0) + 1;
  });
  const topRzPlays = Object.entries(rzPlayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const redZonePlays = {
    total: rzTotal,
    runPct: rzTotal > 0 ? Math.round((rzRuns / rzTotal) * 100) : 0,
    passPct: rzTotal > 0 ? Math.round((rzPasses / rzTotal) * 100) : 0,
    avgGain: rzTotal > 0 ? Number((rzYards / rzTotal).toFixed(1)) : 0,
    topPlays: topRzPlays,
  };

  // Formations breakdown (only include if formation data is actually logged in the CSV)
  const formationMap: Record<string, Play[]> = {};
  offensivePlays.forEach((p) => {
    const form = p.formation && p.formation !== '-' ? p.formation.trim() : '';
    if (!form || form.toLowerCase() === 'unspecified' || form.toLowerCase() === 'none') return;
    if (!formationMap[form]) formationMap[form] = [];
    formationMap[form].push(p);
  });

  const formations: FormationStat[] = Object.entries(formationMap)
    .map(([formName, fPlays]) => {
      const fTotal = fPlays.length;
      const fRuns = fPlays.filter((p) => p.playType === 'RUN').length;
      const fPasses = fPlays.filter((p) => p.playType !== 'RUN').length;
      const fYards = fPlays.reduce((acc, p) => acc + p.gainLoss, 0);
      const fEfficient = fPlays.filter((p) => p.isEfficient).length;
      const fExplosive = fPlays.filter((p) => p.isExplosive).length;
      const fMotion = fPlays.filter((p) => p.motion && p.motion.toLowerCase() !== 'none' && p.motion.trim() !== '').length;

      // Top plays
      const playFreq: Record<string, { count: number; totalGain: number; runOrPass: string }> = {};
      fPlays.forEach((p) => {
        if (!playFreq[p.playName]) {
          playFreq[p.playName] = { count: 0, totalGain: 0, runOrPass: p.playType };
        }
        playFreq[p.playName].count += 1;
        playFreq[p.playName].totalGain += p.gainLoss;
      });

      const topPlays = Object.entries(playFreq)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([name, stat]) => ({
          name,
          count: stat.count,
          runOrPass: stat.runOrPass,
          avgGain: Number((stat.totalGain / stat.count).toFixed(1)),
        }));

      // Hash bias
      const lCount = fPlays.filter((p) => p.hash === 'L').length;
      const mCount = fPlays.filter((p) => p.hash === 'M').length;
      const rCount = fPlays.filter((p) => p.hash === 'R').length;

      return {
        formation: formName,
        count: fTotal,
        pctOfTotal: Math.round((fTotal / totalPlays) * 100),
        runCount: fRuns,
        passCount: fPasses,
        runPct: Math.round((fRuns / fTotal) * 100),
        passPct: Math.round((fPasses / fTotal) * 100),
        avgGain: Number((fYards / fTotal).toFixed(1)),
        efficiencyRate: Math.round((fEfficient / fTotal) * 100),
        explosiveRate: Math.round((fExplosive / fTotal) * 100),
        topPlays,
        hashBias: {
          left: Math.round((lCount / fTotal) * 100),
          middle: Math.round((mCount / fTotal) * 100),
          right: Math.round((rCount / fTotal) * 100),
        },
        motionPct: Math.round((fMotion / fTotal) * 100),
      };
    })
    .sort((a, b) => b.count - a.count);

  // Hash Tendencies
  const leftHashPlays = offensivePlays.filter((p) => p.hash === 'L');
  const midHashPlays = offensivePlays.filter((p) => p.hash === 'M');
  const rightHashPlays = offensivePlays.filter((p) => p.hash === 'R');

  const calcHashSplits = (sub: Play[]) => {
    const total = sub.length;
    const runs = sub.filter((p) => p.playType === 'RUN');
    const passes = sub.filter((p) => p.playType !== 'RUN');
    const runLeft = runs.filter((p) => p.direction.toLowerCase().includes('left') || p.direction.toLowerCase().includes('boundary')).length;
    const runRight = runs.filter((p) => p.direction.toLowerCase().includes('right') || p.direction.toLowerCase().includes('field')).length;

    return {
      total,
      runPct: total > 0 ? Math.round((runs.length / total) * 100) : 0,
      passPct: total > 0 ? Math.round((passes.length / total) * 100) : 0,
      runLeftPct: runs.length > 0 ? Math.round((runLeft / runs.length) * 100) : 0,
      runRightPct: runs.length > 0 ? Math.round((runRight / runs.length) * 100) : 0,
    };
  };

  const hashTendencies = {
    left: calcHashSplits(leftHashPlays),
    middle: {
      total: midHashPlays.length,
      runPct: midHashPlays.length > 0 ? Math.round((midHashPlays.filter((p) => p.playType === 'RUN').length / midHashPlays.length) * 100) : 0,
      passPct: midHashPlays.length > 0 ? Math.round((midHashPlays.filter((p) => p.playType !== 'RUN').length / midHashPlays.length) * 100) : 0,
    },
    right: calcHashSplits(rightHashPlays),
  };

  // Run directions
  const allRuns = offensivePlays.filter((p) => p.playType === 'RUN');
  const runDirections = {
    leftPerimeter: allRuns.filter((p) => p.direction.toLowerCase().includes('left') && (p.direction.toLowerCase().includes('sweep') || p.direction.toLowerCase().includes('perim') || p.direction.toLowerCase().includes('outside'))).length,
    offTackleLeft: allRuns.filter((p) => p.direction.toLowerCase().includes('left') && !p.direction.toLowerCase().includes('sweep')).length,
    aGapLeft: allRuns.filter((p) => p.direction.toLowerCase().includes('a-gap') || p.direction.toLowerCase().includes('a gap')).length,
    middle: allRuns.filter((p) => p.direction.toLowerCase().includes('mid') || p.direction.toLowerCase().includes('inside')).length,
    aGapRight: allRuns.filter((p) => p.direction.toLowerCase().includes('b-gap') || p.direction.toLowerCase().includes('c-gap')).length,
    offTackleRight: allRuns.filter((p) => p.direction.toLowerCase().includes('right') && !p.direction.toLowerCase().includes('sweep')).length,
    rightPerimeter: allRuns.filter((p) => p.direction.toLowerCase().includes('right') && (p.direction.toLowerCase().includes('sweep') || p.direction.toLowerCase().includes('perim') || p.direction.toLowerCase().includes('toss'))).length,
  };

  // Detect Opponent Tells
  const tells = detectOpponentTells(offensivePlays, formations, situationalGroups, hashTendencies);

  return {
    totalPlays,
    runPlays,
    passPlays,
    runPct,
    passPct,
    avgGainOverall,
    avgGainRun,
    avgGainPass,
    overallEfficiencyRate,
    explosivePlayCount,
    explosivePlayRate,
    thirdDownConversions,
    redZonePlays,
    situationalGroups,
    formations,
    hashTendencies,
    runDirections,
    tells,
  };
}

function buildDownDistGroup(
  label: string,
  down: number,
  distMin: number,
  distMax: number,
  allPlays: Play[]
): DownDistGroup {
  const matches = allPlays.filter((p) => {
    if (p.down !== down) return false;
    return p.distance >= distMin && p.distance <= distMax;
  });

  const count = matches.length;
  if (count === 0) {
    return {
      label,
      down,
      distMin,
      distMax,
      count: 0,
      runCount: 0,
      passCount: 0,
      runPct: 0,
      passPct: 0,
      avgGain: 0,
      successRate: 0,
      topFormations: [],
      topPlays: [],
      primaryDirection: 'N/A',
      defensiveAlert: 'Insufficient data for this down & distance bucket.',
    };
  }

  const runMatches = matches.filter((p) => p.playType === 'RUN');
  const passMatches = matches.filter((p) => p.playType !== 'RUN');
  const runPct = Math.round((runMatches.length / count) * 100);
  const passPct = Math.round((passMatches.length / count) * 100);
  const totalGain = matches.reduce((acc, p) => acc + p.gainLoss, 0);
  const avgGain = Number((totalGain / count).toFixed(1));
  const successCount = matches.filter((p) => p.isEfficient).length;
  const successRate = Math.round((successCount / count) * 100);

  // Top Formations (only if formations are logged in data)
  const formCounts: Record<string, number> = {};
  matches.forEach((p) => {
    const f = p.formation && p.formation !== '-' ? p.formation.trim() : '';
    if (f && f.toLowerCase() !== 'unspecified' && f.toLowerCase() !== 'none') {
      formCounts[f] = (formCounts[f] || 0) + 1;
    }
  });
  const topFormations = Object.entries(formCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, c]) => ({ name, count: c, pct: Math.round((c / count) * 100) }));

  // Top Plays
  const playCounts: Record<string, { type: Play['playType']; count: number; totalGain: number }> = {};
  matches.forEach((p) => {
    if (!playCounts[p.playName]) {
      playCounts[p.playName] = { type: p.playType, count: 0, totalGain: 0 };
    }
    playCounts[p.playName].count += 1;
    playCounts[p.playName].totalGain += p.gainLoss;
  });
  const topPlays = Object.entries(playCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([name, data]) => ({
      name,
      type: data.type,
      count: data.count,
      avgGain: Number((data.totalGain / data.count).toFixed(1)),
    }));

  // Direction
  const dirCounts: Record<string, number> = {};
  matches.forEach((p) => {
    dirCounts[p.direction] = (dirCounts[p.direction] || 0) + 1;
  });
  const topDir = Object.entries(dirCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Balanced';

  // Defensive Alert rule generator
  let alert = '';
  if (runPct >= 75) {
    alert = `Heavy Run Alert (${runPct}%). Stack box with +1 defender. Watch for ${topPlays[0]?.name || 'Inside Run'} to ${topDir}.`;
  } else if (passPct >= 75) {
    alert = `High Pass Probability (${passPct}%). Employ 2-High safety shell or boundary blitz. Top concept: ${topPlays[0]?.name || 'Dropback'}.`;
  } else if (down === 2 && distMax <= 3 && avgGain >= 8) {
    alert = `Deep Shot Alert! Opponent frequently uses 2nd & short for play-action vertical shots. Do not bite on play-fake.`;
  } else {
    alert = `Balanced Attack (${runPct}% Run / ${passPct}% Pass). Match personnel with nickel/dime on pass formations.`;
  }

  return {
    label,
    down,
    distMin,
    distMax,
    count,
    runCount: runMatches.length,
    passCount: passMatches.length,
    runPct,
    passPct,
    avgGain,
    successRate,
    topFormations,
    topPlays,
    primaryDirection: topDir,
    defensiveAlert: alert,
  };
}

function detectOpponentTells(
  plays: Play[],
  formations: FormationStat[],
  situational: DownDistGroup[],
  hash: TendencyAnalysis['hashTendencies']
): OpponentTell[] {
  const tells: OpponentTell[] = [];

  // Tell 1: 3rd & Medium/Long Pass Lock
  const thirdGroup = situational.find((s) => s.down === 3 && s.distMin >= 3);
  if (thirdGroup && thirdGroup.count >= 4 && thirdGroup.passPct >= 75) {
    tells.push({
      id: 'tell-third-pass',
      category: 'DOWN_DISTANCE',
      title: '3rd Down Pass Lock Tendency',
      trigger: 'When facing 3rd down & 3+ yards',
      statEvidence: `${thirdGroup.passPct}% Pass rate (${thirdGroup.passCount}/${thirdGroup.count} plays). Primary target concept: ${thirdGroup.topPlays[0]?.name || 'Quick Concept'}.`,
      confidencePct: thirdGroup.passPct,
      sampleSize: thirdGroup.count,
      recommendedCounter: 'Check out of run fits into Cover 2 Man-Under or 5-man fire zone blitz. Drop edge defenders into curl/flat passing lanes.',
      severity: 'HIGH',
    });
  }

  // Tell 2: 2nd & Short Aggressive Shot Play
  const secondShort = situational.find((s) => s.label.includes('2nd & Short'));
  if (secondShort && secondShort.count >= 3) {
    const shotPlays = plays.filter((p) => p.down === 2 && p.distance <= 3 && p.gainLoss >= 15);
    if (shotPlays.length >= 2 || secondShort.avgGain >= 7) {
      tells.push({
        id: 'tell-second-shot',
        category: 'DOWN_DISTANCE',
        title: '2nd & Short Deep Shot Trap',
        trigger: 'When opponent gets into 2nd & 1-3 yards to go',
        statEvidence: `Averages ${secondShort.avgGain} yds per play in short yardage. Recorded ${shotPlays.length} explosive passes from running sets.`,
        confidencePct: 88,
        sampleSize: secondShort.count,
        recommendedCounter: 'Maintain deep-third safety discipline. Safeties must read high-hat pass key rather than flying downhill on play-action fakes.',
        severity: 'HIGH',
      });
    }
  }

  // Tell 3: Left Hash Boundary Run Tell
  if (hash.left.total >= 5 && hash.left.runPct >= 60 && hash.left.runLeftPct >= 70) {
    tells.push({
      id: 'tell-hash-boundary',
      category: 'HASH',
      title: 'Left Hash Boundary Run Preference',
      trigger: 'Ball spotted on the Left Hash',
      statEvidence: `${hash.left.runLeftPct}% of runs attack the boundary (short side of the field). Opponent avoids wide field runs in tight quarters.`,
      confidencePct: hash.left.runLeftPct,
      sampleSize: hash.left.total,
      recommendedCounter: 'Set defensive strength / 3-technique to boundary. Walk boundary OLB down to set hard edge and spill ball back inside to pursuit.',
      severity: 'HIGH',
    });
  }

  // Tell 4: Formation Run/Pass Skews
  formations.forEach((f) => {
    if (f.count >= 5) {
      if (f.runPct >= 78) {
        tells.push({
          id: `tell-form-run-${f.formation}`,
          category: 'FORMATION',
          title: `${f.formation} Heavy Run Tell`,
          trigger: `Opponent lines up in ${f.formation}`,
          statEvidence: `${f.runPct}% Run rate (${f.runCount}/${f.count} plays). Top call: ${f.topPlays[0]?.name || 'Power'} (${f.topPlays[0]?.avgGain} avg).`,
          confidencePct: f.runPct,
          sampleSize: f.count,
          recommendedCounter: `Roll strong safety down into the box. Slide defensive line into an Under front to plug the interior running lanes.`,
          severity: 'HIGH',
        });
      } else if (f.passPct >= 80) {
        tells.push({
          id: `tell-form-pass-${f.formation}`,
          category: 'FORMATION',
          title: `${f.formation} High-Volume Pass Tell`,
          trigger: `Opponent breaks huddle in ${f.formation}`,
          statEvidence: `${f.passPct}% Pass rate (${f.passCount}/${f.count} plays). Efficiency rate: ${f.efficiencyRate}%.`,
          confidencePct: f.passPct,
          sampleSize: f.count,
          recommendedCounter: `Shift to Nickel/Dime personnel. Align corners in press-bail Cover 3 or Cover 4 Quarters to rob the seam routes.`,
          severity: 'HIGH',
        });
      }
    }
  });

  // Tell 5: Motion Indicator
  const motionPlays = plays.filter((p) => p.motion && p.motion.toLowerCase() !== 'none' && p.motion.trim() !== '');
  if (motionPlays.length >= 4) {
    const motionPasses = motionPlays.filter((p) => p.playType !== 'RUN').length;
    const motionPassPct = Math.round((motionPasses / motionPlays.length) * 100);
    if (motionPassPct >= 75 || motionPassPct <= 25) {
      const isPassIndicator = motionPassPct >= 75;
      tells.push({
        id: 'tell-motion',
        category: 'MOTION',
        title: isPassIndicator ? 'Pre-Snap Motion = Pass Tell' : 'Pre-Snap Motion = Run Tell',
        trigger: 'Receiver or back goes in motion pre-snap',
        statEvidence: `${isPassIndicator ? motionPassPct : 100 - motionPassPct}% of motion plays result in a ${isPassIndicator ? 'Pass' : 'Run'} (${isPassIndicator ? motionPasses : motionPlays.length - motionPasses}/${motionPlays.length} plays).`,
        confidencePct: isPassIndicator ? motionPassPct : 100 - motionPassPct,
        sampleSize: motionPlays.length,
        recommendedCounter: isPassIndicator
          ? 'Bump coverage call to alert for drag routes, mesh, or wheel route out of motion. Do not rotate linebackers out of pass zones.'
          : 'Flow linebackers with the motion path. Edge defensive end must hold outside contain against the jet sweep / perimeter sweep.',
        severity: 'MEDIUM',
      });
    }
  }

  // Tell 6: Red Zone Tendency
  const rzPlays = plays.filter((p) => p.fieldZone === 'red_zone' || p.fieldZone === 'goal_line');
  if (rzPlays.length >= 5) {
    const rzRuns = rzPlays.filter((p) => p.playType === 'RUN').length;
    const rzRunPct = Math.round((rzRuns / rzPlays.length) * 100);
    if (rzRunPct >= 70 || rzRunPct <= 30) {
      const isRunHeavy = rzRunPct >= 70;
      tells.push({
        id: 'tell-red-zone',
        category: 'RED_ZONE',
        title: isRunHeavy ? 'Red Zone Ground Attack Tell' : 'Red Zone Compressed Pass Tell',
        trigger: 'Ball reaches the opponent 20-yard line or closer',
        statEvidence: `${isRunHeavy ? rzRunPct : 100 - rzRunPct}% ${isRunHeavy ? 'Run' : 'Pass'} rate inside the 20 (${isRunHeavy ? rzRuns : rzPlays.length - rzRuns}/${rzPlays.length} plays).`,
        confidencePct: isRunHeavy ? rzRunPct : 100 - rzRunPct,
        sampleSize: rzPlays.length,
        recommendedCounter: isRunHeavy
          ? 'Transition to 5-2 goal line or Bear front with 8 in the box. Pinch tackles to eliminate A-gap dives.'
          : 'Play Bracket coverage on the primary slot receiver and watch for back-shoulder fade or pick routes in tight splits.',
        severity: 'MEDIUM',
      });
    }
  }

  return tells;
}

function getEmptyAnalysis(): TendencyAnalysis {
  return {
    totalPlays: 0,
    runPlays: 0,
    passPlays: 0,
    runPct: 0,
    passPct: 0,
    avgGainOverall: 0,
    avgGainRun: 0,
    avgGainPass: 0,
    overallEfficiencyRate: 0,
    explosivePlayCount: 0,
    explosivePlayRate: 0,
    thirdDownConversions: {
      total: 0,
      converted: 0,
      rate: 0,
      short: { total: 0, converted: 0, rate: 0, runPct: 0, passPct: 0 },
      medium: { total: 0, converted: 0, rate: 0, runPct: 0, passPct: 0 },
      long: { total: 0, converted: 0, rate: 0, runPct: 0, passPct: 0 },
    },
    redZonePlays: {
      total: 0,
      runPct: 0,
      passPct: 0,
      avgGain: 0,
      topPlays: [],
    },
    situationalGroups: [],
    formations: [],
    hashTendencies: {
      left: { total: 0, runPct: 0, passPct: 0, runLeftPct: 0, runRightPct: 0 },
      middle: { total: 0, runPct: 0, passPct: 0 },
      right: { total: 0, runPct: 0, passPct: 0, runLeftPct: 0, runRightPct: 0 },
    },
    runDirections: {
      leftPerimeter: 0,
      offTackleLeft: 0,
      aGapLeft: 0,
      middle: 0,
      aGapRight: 0,
      offTackleRight: 0,
      rightPerimeter: 0,
    },
    tells: [],
  };
}
