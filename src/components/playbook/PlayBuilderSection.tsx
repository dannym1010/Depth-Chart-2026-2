import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Film, LayoutGrid, Plus } from 'lucide-react';
import type { PlayBuilderState, PlayDatabaseEntry, PlayType } from '../../types/callSheet';
import { defenseSystem, type DefenseSystem } from '../../hudlScout/utils/ourDefense';
import { inferPlayType, newPlayEntry } from '../../utils/playbookImport';
import {
  BACKFIELD_STRUCTURES,
  PLAY_CONCEPTS,
  MASTER_TAGS,
  TAG_GROUPS,
  PERSONNEL_DEFINITIONS,
  TE_LOCATIONS,
  DEFENSIVE_FRONTS,
  STUNTS_AND_PRESSURES,
  OUR_DEFENSE_LOOKS,
  HOLE_SYSTEM,
  RUN_SCHEMES,
  eligiblePlayers,
  eligibleName,
  compatibleBackfields,
  isValidEleven,
  tryAssemblePlay,
  diagramSvg,
  autoDrawPlay,
  applyNodeOverrides,
  conceptFamily,
  resolveTaggedCall,
  type AssembledPlay,
  type OurDefenseLook,
  type PlayStroke,
} from '../../utils/footballEngine';
import { PlayDiagramCanvas } from './PlayDiagramCanvas';
import type { PlayBuilderSeed } from '../../utils/playBuilderSeed';
import { callSetup } from '../../utils/callDiagram';

const SELECT =
  'h-9 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-full';

function Chip({
  on,
  children,
  onClick,
  title,
}: {
  on: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-8 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
        on
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
      }`}
    >
      {children}
    </button>
  );
}

const SITUATIONS = ['1-10', '2nd long', '2nd med', '3rd long', '3rd short', 'RED ZONE', 'Goaline', '2 MIN O', '4 Min O'];

/** The play's notes: the coach's note first, then the scheme and the details, each once. */
function notesFor(play: AssembledPlay, coachNote: string, extra: string[]) {
  const parts = [coachNote.trim(), play.metadata.scheme, ...extra].map((s) => String(s || '').trim()).filter(Boolean);
  return [...new Set(parts)].join(' · ');
}

interface Props {
  canEdit: boolean;
  onAdd: (entry: PlayDatabaseEntry) => void;
  /** A scout play to draw. The name stays as they called it. */
  seed?: PlayBuilderSeed | null;
  /** Return to the scout play list this diagram was opened from. */
  onBack?: () => void;
  /** The play name changed. Their plays and the play log should use the new name. */
  onRename?: (from: string, to: string) => void;
  /** Open the film clips tagged to this play. */
  onWatchFilm?: (label: string) => void;
}


/**
 * Our defenses, named from the team's defense (Our defense card): the base and check fronts, the
 * Over, who has contain, and a look for each of our blitzes.
 */
function teamDefenseLooks(sys: DefenseSystem): Record<string, OurDefenseLook> {
  const out: Record<string, OurDefenseLook> = {};
  for (const [k, d] of Object.entries(OUR_DEFENSE_LOOKS)) {
    const isBase = d.front === '4-4';
    const isCheck = d.front === '5-3';
    const name = d.name.replace(/^5-3 Over/, sys.over).replace(/^5-3/, sys.check).replace(/^4-4/, sys.base);
    const contain = isBase ? `${sys.baseContain} have contain` : isCheck ? `${sys.checkContain} have contain` : '';
    out[k] = { ...d, name, front: isBase ? sys.base : isCheck ? sys.check : d.front, notes: [d.notes, contain].filter(Boolean).join(' · ') };
  }
  for (const b of sys.blitzes) {
    const base = OUR_DEFENSE_LOOKS['44_C3_LIZ'];
    out[`blitz_${b.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`] = {
      ...base,
      name: `${sys.base} ${b}`,
      front: sys.base,
      shell: sys.baseCoverage,
      notes: `${b} blitz, ${sys.baseCoverage} behind it · ${sys.baseContain} keep contain`,
    };
  }
  return out;
}

function startFromSeed(seed?: PlayBuilderSeed | null) {
  if (!seed?.name) {
    return {
      personnel: 32,
      baseKey: '32_WISHBONE',
      backfield: 'WISHBONE',
      ball: '4',
      hole: '' as number | '',
      run: 'zone',
      strength: 'Left' as const,
      family: 'run' as const,
      name: '',
      note: '',
      holdName: false,
    };
  }
  const name = seed.name;
  // Read the call as written: personnel, formation, side, who gets the ball to which hole, the play
  // ("30 DW 41 SWEEP"). The card's own formation fills in what the name leaves out.
  return {
    ...callSetup({ name, formation: seed.formation, personnel: seed.personnel, kind: seed.kind }),
    name,
    note: seed?.notes || '',
    holdName: true,
  };
}

export const PlayBuilderSection: React.FC<Props> = ({ canEdit, onAdd, seed, onBack, onRename, onWatchFilm }) => {
  const opened = useMemo(() => startFromSeed(seed), [seed]);
  // A play saved from the builder re-opens as it was left.
  const saved = seed?.builder;
  const [baseKey, setBaseKey] = useState(saved?.baseKey || opened.baseKey);
  const backs = useMemo(() => compatibleBackfields(baseKey), [baseKey]);
  const [backfieldKey, setBackfieldKey] = useState(saved?.backfield || opened.backfield);
  const [conceptKey, setConceptKey] = useState(saved?.conceptKey || '37_ZONE');
  const [runId, setRunId] = useState(saved?.runId || opened.run);
  const [family, setFamily] = useState<'all' | 'run' | 'pass' | 'option' | 'screen'>(saved?.family || opened.family);
  const [strength, setStrength] = useState<'Left' | 'Right'>(saved?.strength || opened.strength);
  const [hash, setHash] = useState<'Left' | 'Middle' | 'Right'>(saved?.hash || 'Middle');
  const [holeOverride, setHoleOverride] = useState<number | ''>(saved ? saved.hole : opened.hole);
  const [ballCarrier, setBallCarrier] = useState(saved?.ball || opened.ball);
  const [tags, setTags] = useState<string[]>(saved?.tags || []);
  const [coachNote, setCoachNote] = useState(saved ? saved.coachNote : opened.note);
  const [holdName] = useState(opened.holdName);
  const [situations, setSituations] = useState<string[]>(saved?.situations || []);
  const looks = teamDefenseLooks(defenseSystem());
  // An opponent's play opens against our call for it: the 5-3 against two tight ends, else the base 4-4.
  const [defenseKey, setDefenseKey] = useState(() =>
    saved && (saved.defenseKey === '' || looks[saved.defenseKey])
      ? saved.defenseKey
      : seed?.name && (PERSONNEL_DEFINITIONS[opened.personnel]?.te || 0) >= 2
        ? '53_C3'
        : '44_C3_LIZ'
  );
  // The 4-4 Cover 3 sets its strength (LIZ / RIP) to the offense's.
  const pickStrength = (s: 'Left' | 'Right') => {
    setStrength(s);
    setDefenseKey((k) => (k === '44_C3_LIZ' || k === '44_C3_RIP' ? (s === 'Left' ? '44_C3_LIZ' : '44_C3_RIP') : k));
  };
  const [personnelPick, setPersonnelPick] = useState<number>(saved?.personnel || opened.personnel);
  const [nameIn, setNameIn] = useState(opened.name);
  const [committedName, setCommittedName] = useState(opened.name);
  const [putDefInName, setPutDefInName] = useState(Boolean(saved?.putDefInName));
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>(saved?.overrides || {});
  const [strokes, setStrokes] = useState<PlayStroke[]>((saved?.strokes as PlayStroke[]) || []);
  const [userDrew, setUserDrew] = useState(Boolean(saved?.strokes));

  const locations = TE_LOCATIONS[personnelPick] || [];
  const locationId = locations.find((l) => l.baseKey === baseKey)?.id || locations[0]?.id || '';
  const validBacks = backs.length ? backs : ['I_FORM'];
  // A play saved with a backfield that's no longer offered (a copy of another) still opens with it.
  const activeBack = validBacks.includes(backfieldKey) || isValidEleven(baseKey, backfieldKey) ? backfieldKey : validBacks[0];
  // The everyday backfields are buttons; the rest are in "More backfields".
  const backfieldChips = validBacks.filter((k) => BACKFIELD_STRUCTURES[k].common);
  const extraBacks = validBacks.filter((k) => !backfieldChips.includes(k));
  const runMode = family === 'all' || family === 'run';
  const run = RUN_SCHEMES.find((s) => s.id === runId) || RUN_SCHEMES[0];
  const activeConceptKey = runMode ? run.conceptKey : conceptKey;
  const basePlay = tryAssemblePlay(baseKey, activeBack, activeConceptKey, strength, tags);
  const hashDx = hash === 'Left' ? -4.2 : hash === 'Right' ? 4.2 : 0;
  const offNodes = basePlay
    ? applyNodeOverrides(basePlay.nodes, overrides).map((n) => (overrides[n.role] ? n : { ...n, x: n.x + hashDx }))
    : [];
  const dLook = defenseKey ? looks[defenseKey] || null : null;
  const dNodes = useMemo(() => {
    if (!dLook) return [];
    return applyNodeOverrides(dLook.nodes, overrides).map((n) => (overrides[n.role] ? n : { ...n, x: n.x + hashDx }));
  }, [dLook, overrides, hashDx]);
  const play = basePlay ? { ...basePlay, nodes: offNodes } : null;
  const customBack = Object.keys(overrides).some((r) => !r.match(/^(DE|DT|NT|SAM|WILL|MIKE|ROV|CB|FS)/i));

  const concepts = useMemo(() => {
    const all = Object.entries(PLAY_CONCEPTS);
    if (family === 'all' || family === 'run') return all.filter(([, c]) => conceptFamily(c) === 'run');
    return all.filter(([, c]) => conceptFamily(c) === family);
  }, [family]);

  useEffect(() => {
    if (!concepts.some(([k]) => k === conceptKey) && concepts[0]) setConceptKey(concepts[0][0]);
  }, [concepts, conceptKey]);

  // Changing the look or the play starts the drawing over. Only a change does: a saved play opens as it was left.
  const lookKey = `${baseKey}|${activeBack}|${strength}|${hash}`;
  const lastLook = useRef(lookKey);
  useEffect(() => {
    if (lastLook.current === lookKey) return;
    lastLook.current = lookKey;
    setOverrides({});
    setUserDrew(false);
  }, [lookKey]);

  const playKey = `${tags.join('|')}|${activeConceptKey}`;
  const lastPlay = useRef(playKey);
  useEffect(() => {
    if (lastPlay.current === playKey) return;
    lastPlay.current = playKey;
    setUserDrew(false);
  }, [playKey]);

  const concept = PLAY_CONCEPTS[activeConceptKey];
  const eligibles = eligiblePlayers(offNodes);
  const ball = eligibles.some((n) => n.role === ballCarrier)
    ? ballCarrier
    : eligibles.find((n) => n.role === '3')?.role || eligibles[0]?.role || '1';
  const taggedCall = resolveTaggedCall({
    hole: play ? play.metadata.targetHole : concept?.hole ?? null,
    primaryBack: concept?.primaryBack || 3,
    family: concept ? conceptFamily(concept) : 'run',
    tags,
    hasBack: (n) => offNodes.some((p) => p.role === String(n)),
  });
  const hole = play ? (holeOverride === '' ? taggedCall.hole : holeOverride) : null;
  const nodeKey = offNodes.map((n) => `${n.role}:${n.x.toFixed(2)}:${n.y.toFixed(2)}`).join('|');
  const drawTags = runMode && run.id === 'keep' && ball === '1' && !tags.includes('Keep') ? [...tags, 'Keep'] : tags;
  const drawn = useMemo(() => {
    if (!offNodes.length) return [];
    const c = PLAY_CONCEPTS[activeConceptKey];
    if (!c) return [];
    return autoDrawPlay({
      nodes: offNodes,
      hole,
      primaryBack: ball,
      concept: runMode ? run.label : c.concept,
      scheme: c.scheme,
      tags: drawTags,
      family: runMode ? 'run' : taggedCall.family,
    });
  }, [nodeKey, hole, ball, drawTags.join('|'), activeConceptKey, runMode, run.label, taggedCall.family]);

  useEffect(() => {
    if (!userDrew) setStrokes(drawn);
  }, [drawn, userDrew]);

  useEffect(() => {
    if (!play || holdName) return;
    const vs = dLook && putDefInName ? ` vs ${dLook.name}` : '';
    const who = /^[1-4]$/.test(String(ball)) && hole != null ? `${ball}${hole}` : hole != null ? `${ball} ${hole}` : `${ball} ${eligibleName(ball)}`;
    const call = runMode ? `${who} ${run.label}` : `${who} ${play.metadata.concept}`;
    const named = play.metadata.concept ? play.playName.replace(play.metadata.concept, call) : `${play.playName} ${call}`;
    setNameIn(`${named}${vs}`);
  }, [play?.playName, play?.metadata.concept, ball, hole, run.label, runMode, dLook?.name, putDefInName]);

  const tagged = (t: string) => tags.includes(t);
  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const commitName = (raw?: string) => {
    const next = (raw ?? nameIn).trim().slice(0, 120);
    if (!next || next === committedName) return;
    if (seed?.scoutId) onRename?.(committedName, next);
    setCommittedName(next);
    if (next !== nameIn) setNameIn(next);
  };

  const saveOffense = () => {
    if (!play) return;
    const calledHole = hole;
    const holeData = calledHole != null ? HOLE_SYSTEM[calledHole] : play.metadata.holeData;
    const vs = dLook?.name;
    commitName();
    const name = (nameIn.trim() || committedName || play.playName).slice(0, 120);
    const type: PlayType = inferPlayType(name, 'offense');
    const extra = dLook ? dLook.nodes.map((n) => (overrides[n.role] ? { ...n, ...overrides[n.role] } : n)) : [];
    const builder: PlayBuilderState = {
      personnel: personnelPick,
      baseKey,
      backfield: activeBack,
      conceptKey,
      runId,
      family,
      strength,
      hash,
      hole: holeOverride,
      ball: String(ballCarrier),
      tags,
      coachNote,
      situations,
      defenseKey,
      putDefInName,
      overrides,
      ...(userDrew ? { strokes } : {}),
    };
    onAdd({
      builder,
      ...newPlayEntry(name, 'offense'),
      formation: `${play.hudlExport.OFF_FORM} ${play.hudlExport.BACKFIELD}${customBack ? ' custom' : ''}`,
      type,
      personnel: String(play.metadata.personnel),
      concept: runMode ? run.label : play.metadata.concept,
      tags: [...tags, vs ? `vs ${vs}` : ''].filter(Boolean),
      situations,
      category: 'Play builder',
      source: 'builder',
      vsDefense: vs,
      notes: notesFor(play, coachNote, [
        play.hudlExport.PLAY_TYPE,
        `Ball ${ball} ${eligibleName(ball)}`,
        holeData ? `Hole ${calledHole}: ${holeData.description}` : '',
        `Hash ${hash}`,
        vs ? `Our D: ${vs} (${dLook.shell})` : '',
        tags.map((t) => MASTER_TAGS[t]?.effect).filter(Boolean).join('; '),
        customBack ? 'Spots moved by coach.' : '',
      ]),
      diagramUrl: diagramSvg(play, strokes, extra, String(ball)),
      assignments: [
        ...play.nodes.map((n) => ({
          pos: n.role,
          text: n.role === '1' ? 'QB' : n.role === '2' ? 'FB' : n.role === '3' ? 'RB' : n.role === '4' ? 'Wing / extra back' : n.line ? 'On the line' : 'Off the line',
        })),
        ...(dLook
          ? dLook.nodes.map((n) => ({ pos: n.role, text: `${dLook.front} ${dLook.shell} · ${dLook.notes}` }))
          : []),
      ],
    });
  };

  const addFront = (key: string) => {
    const d = DEFENSIVE_FRONTS[key];
    const name = `${d.front.replace('-Man', '')} ${d.shell} ${d.strength === 'Left' ? 'LIZ' : 'RIP'}`;
    onAdd({
      ...newPlayEntry(name, 'defense'),
      formation: d.front,
      type: 'coverage',
      category: 'Play builder',
      source: 'builder',
      vsDefense: name,
      notes: `${d.shell} · strength ${d.strength}`,
      assignments: [
        ...d.dl.map((p) => ({ pos: p.role, text: [p.align, p.runResp].filter(Boolean).join(' — ') })),
        ...d.lb.map((p) => ({ pos: p.role, text: [p.gap, p.resp].filter(Boolean).join(' — ') })),
        ...d.db.map((p) => ({ pos: p.role, text: p.resp })),
      ],
    });
  };

  const addDefenseLook = (key: string) => {
    const d = looks[key];
    onAdd({
      ...newPlayEntry(d.name, 'defense'),
      formation: d.front,
      type: key.startsWith('blitz_') || d.shell.toLowerCase().includes('0') || d.name.includes('Dog') || d.name.includes('Sting') ? 'blitz' : 'coverage',
      category: 'Play builder',
      source: 'builder',
      vsDefense: d.name,
      notes: `${d.shell} · ${d.notes}`,
      assignments: d.nodes.map((n) => ({ pos: n.role, text: `${d.front} ${d.shell}` })),
    });
  };

  const addPressure = (key: string) => {
    const p = STUNTS_AND_PRESSURES[key];
    onAdd({
      ...newPlayEntry(key.replace(/_/g, ' '), 'defense'),
      formation: 'Pressure',
      type: 'blitz',
      category: 'Play builder',
      source: 'builder',
      notes: `${p.target} · ${p.coverage}`,
    });
  };

  const diagramNodes = [...offNodes, ...dNodes];
  const pickPersonnel = (v: number) => {
    setPersonnelPick(v);
    const locs = TE_LOCATIONS[v] || [];
    const next = locs.find((l) => l.id === 'tight') || locs[0];
    if (!next) return;
    setBaseKey(next.baseKey);
    // Keep the backfield when it still fits (same number of backs), else the first that does.
    const nextBacks = compatibleBackfields(next.baseKey);
    setBackfieldKey(nextBacks.includes(backfieldKey) ? backfieldKey : nextBacks[0] || 'I_FORM');
    setTags((prev) => prev.filter((t) => t !== 'Thumper'));
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-black text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        <span className="p-2.5 rounded-2xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shrink-0">
          <LayoutGrid className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">Play builder</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Set the look, then who has the ball and the play. The picture stays beside the call.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-4 items-start">
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Alignment</div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Personnel</div>
              <div className="flex flex-wrap gap-1.5">
                {[10, 11, 12, 20, 21, 22, 30, 31, 32].map((p) => (
                  <Chip key={p} on={personnelPick === p} title={PERSONNEL_DEFINITIONS[p]?.label} onClick={() => pickPersonnel(p)}>
                    {p}
                  </Chip>
                ))}
              </div>
              {PERSONNEL_DEFINITIONS[personnelPick] && (
                <p className="mt-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {PERSONNEL_DEFINITIONS[personnelPick].rb} RB · {PERSONNEL_DEFINITIONS[personnelPick].te} TE · {PERSONNEL_DEFINITIONS[personnelPick].wr} WR
                </p>
              )}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Backfield</div>
              <div className="flex flex-wrap gap-1.5">
                {backfieldChips.map((k) => (
                  <Chip key={k} on={activeBack === k} onClick={() => setBackfieldKey(k)}>
                    {BACKFIELD_STRUCTURES[k].hudlBackfield}
                  </Chip>
                ))}
              </div>
              {extraBacks.length > 0 && (
                <select
                  className={`${SELECT} mt-2`}
                  aria-label="More backfields"
                  value={extraBacks.includes(activeBack) ? activeBack : ''}
                  onChange={(e) => e.target.value && setBackfieldKey(e.target.value)}
                >
                  <option value="">More backfields</option>
                  {extraBacks.map((k) => (
                    <option key={k} value={k}>
                      {BACKFIELD_STRUCTURES[k].hudlBackfield}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                {(PERSONNEL_DEFINITIONS[personnelPick]?.te || 0) > 0 ? 'Tight end spot' : 'Receivers'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {locations.map((l) => (
                  <Chip key={l.id} on={locationId === l.id} onClick={() => setBaseKey(l.baseKey)}>
                    {l.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Strength</div>
                <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-black">
                  {(['Left', 'Right'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => pickStrength(s)}
                      className={`flex-1 h-8 cursor-pointer ${strength === s ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Hash</div>
                <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-black">
                  {(['Left', 'Middle', 'Right'] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHash(h)}
                      className={`flex-1 h-8 cursor-pointer ${hash === h ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'}`}
                    >
                      {h === 'Middle' ? 'Mid' : h[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">The play</div>
            <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-black">
              {(['run', 'option', 'pass', 'screen'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFamily(f)}
                  className={`flex-1 h-8 capitalize cursor-pointer ${family === f ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">{runMode ? 'Run' : family}</div>
              <div className="flex flex-wrap gap-1.5">
                {runMode
                  ? RUN_SCHEMES.map((s) => (
                      <Chip
                        key={s.id}
                        on={run.id === s.id}
                        onClick={() => {
                          setRunId(s.id);
                          if (s.id === 'keep') setBallCarrier('1');
                        }}
                      >
                        {s.label}
                      </Chip>
                    ))
                  : concepts.map(([k, c]) => (
                      <Chip key={k} on={conceptKey === k} onClick={() => setConceptKey(k)}>
                        {c.concept}
                      </Chip>
                    ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Ball</div>
              <div className="flex flex-wrap gap-1.5">
                {eligibles.map((n) => (
                  <Chip key={n.role} on={ball === n.role} onClick={() => setBallCarrier(n.role)}>
                    {n.role} {eligibleName(n.role)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Hole {hole != null ? `· ${hole} ${HOLE_SYSTEM[hole].type}` : ''}
              </div>
              <div className="grid grid-cols-9 gap-1">
                {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
                  <button
                    key={n}
                    type="button"
                    title={HOLE_SYSTEM[n].description}
                    onClick={() => setHoleOverride(holeOverride === n ? '' : n)}
                    className={`h-9 rounded-lg text-sm font-black border cursor-pointer ${
                      hole === n
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 lg:sticky lg:top-3">
          {play ? (
            <PlayDiagramCanvas
              play={{
                ...play,
                metadata: {
                  ...play.metadata,
                  targetHole: holeOverride === '' ? play.metadata.targetHole : holeOverride,
                  holeData: holeOverride === '' ? play.metadata.holeData : HOLE_SYSTEM[holeOverride],
                },
              }}
              nodes={diagramNodes}
              strokes={strokes}
              ballRole={String(ball)}
              formLabel={[
                play.metadata.personnel,
                strength === 'Left' ? 'L' : 'R',
                play.hudlExport.OFF_FORM,
                play.hudlExport.BACKFIELD !== play.hudlExport.OFF_FORM ? play.hudlExport.BACKFIELD : '',
                ...tags,
              ]
                .filter(Boolean)
                .join(' ')}
              playLabel={
                runMode
                  ? `${/^[1-4]$/.test(String(ball)) && hole != null ? `${ball}${hole}` : ball} ${run.label}`
                  : `${ball} ${play.metadata.concept}`
              }
              vsLabel={dLook ? dLook.front : '—'}
              coachNote={coachNote}
              onCoachNote={setCoachNote}
              onMove={(role, x, y) => setOverrides((prev) => ({ ...prev, [role]: { x, y } }))}
              onStrokes={(next) => {
                setUserDrew(true);
                setStrokes(next);
              }}
              onReset={() => {
                setOverrides({});
                setUserDrew(false);
              }}
              linesFollow={userDrew}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 p-2 min-h-[200px] flex items-center justify-center">
              <span className="text-xs text-slate-500">This formation and backfield do not add up to 11. Pick another backfield.</span>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Play name
              <input
                className={`${SELECT} mt-1`}
                value={nameIn}
                onChange={(e) => setNameIn(e.target.value)}
                onBlur={(e) => commitName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
            </label>
            {!!seed?.snaps?.length && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    {seed.snaps.length} film snap{seed.snaps.length === 1 ? '' : 's'} tagged to this play
                  </span>
                  {onWatchFilm && (
                    <button
                      type="button"
                      onClick={() => onWatchFilm(nameIn.trim() || seed.name)}
                      className="h-8 px-2.5 rounded-lg bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Film className="w-3.5 h-3.5" /> Watch film
                    </button>
                  )}
                </div>
                <ul className="max-h-28 overflow-y-auto text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                  {seed.snaps.map((s) => (
                    <li key={s.id}>
                      Play {s.playNumber || '—'}
                      {s.result ? ` · ${s.result}` : ''}
                      {typeof s.gain === 'number' ? ` · ${s.gain > 0 ? `+${s.gain}` : s.gain}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
              <label className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Defense
                <select className={`${SELECT} mt-1`} value={defenseKey} onChange={(e) => setDefenseKey(e.target.value)}>
                  <option value="">Offense only</option>
                  {Object.entries(looks).map(([k, d]) => (
                    <option key={k} value={k}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              {canEdit && (
                <button
                  type="button"
                  disabled={!play}
                  onClick={saveOffense}
                  className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" /> Save
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={putDefInName} onChange={(e) => setPutDefInName(e.target.checked)} />
              Put our defense in the play name
            </label>
            {dLook && <p className="text-xs text-slate-600 dark:text-slate-400">{dLook.notes} · {dLook.shell} · strength {dLook.strength}</p>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tags and situations</div>
        {TAG_GROUPS.map((group) => {
          const keys = Object.keys(MASTER_TAGS).filter((t) => MASTER_TAGS[t].type === group);
          return (
            <div key={group}>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">{group}</div>
              <div className="flex flex-wrap gap-1.5">
                {keys.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    title={MASTER_TAGS[t]?.effect}
                    className={`h-8 px-2.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                      tagged(t)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">When we call it</div>
          <div className="flex flex-wrap gap-1.5">
            {SITUATIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSituations((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
                className={`h-8 px-2.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                  situations.includes(s)
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
        <summary className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 cursor-pointer">Save a defense-only card</summary>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(looks).map(([k, d]) => (
            <button
              key={k}
              type="button"
              disabled={!canEdit}
              onClick={() => addDefenseLook(k)}
              className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-black text-slate-800 dark:text-slate-100 cursor-pointer disabled:opacity-40"
            >
              {d.name}
            </button>
          ))}
          {Object.entries(DEFENSIVE_FRONTS).map(([k, d]) => (
            <button
              key={k}
              type="button"
              disabled={!canEdit}
              onClick={() => addFront(k)}
              className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-black text-slate-800 dark:text-slate-100 cursor-pointer disabled:opacity-40"
            >
              {d.front} {d.shell}
            </button>
          ))}
          {Object.keys(STUNTS_AND_PRESSURES).map((k) => (
            <button
              key={k}
              type="button"
              disabled={!canEdit}
              onClick={() => addPressure(k)}
              className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-black text-slate-800 dark:text-slate-100 cursor-pointer disabled:opacity-40"
            >
              {k.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
};
