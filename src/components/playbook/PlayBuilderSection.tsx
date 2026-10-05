import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardList, Film, LayoutGrid, Play as PlayIcon, Save, Search, Users, Wand2, Zap } from 'lucide-react';
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
  alignmentsFor,
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
  neutralSkillX,
  diagramSvg,
  autoDrawPlay,
  applyNodeOverrides,
  alignDefenseTechniques,
  conceptFamily,
  resolveTaggedCall,
  type AssembledPlay,
  type OurDefenseLook,
  type BackfieldSpots,
  type PlayStroke,
  type NodePlayer,
} from '../../utils/footballEngine';
import { PlayDiagramCanvas } from './PlayDiagramCanvas';
import { assignmentText } from './PlayerAssignmentPanel';
import type { PlayBuilderSeed } from '../../utils/playBuilderSeed';
import { callSetup } from '../../utils/callDiagram';
import { openFormation } from '../../utils/filmBackfields';
import { parsePlayCall } from '../../utils/playCallParse';
import { openFilmWindow } from '../../filmroom/filmWindowStore';
import { DiagramImage } from './DiagramImage';
import { defenseAlignmentSaver, withMyAlignment } from '../../hudlScout/utils/ourDefense';
import { DEF_UNITS, defenseSpotName, frontOfLook, lineupForDefense, whoOptions, type DefUnit } from '../../utils/defenseLineup';
import { rememberDefenseUnit, rememberedDefenseUnit, useDefenseRosterSource } from '../../utils/defenseRosterStore';

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
      className={`h-9 px-3 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
        on
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
      }`}
    >
      {children}
    </button>
  );
}

const DEF_BTN =
  'h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40';

type BuilderTab = 'formation' | 'play' | 'players' | 'notes';

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
  onWatchFilm?: (label: string, state: PlayBuilderState) => void;
  /** Narrow layout (beside the video in the Film Room): the diagram first, the settings under it. */
  compact?: boolean;
  /** Every change to the play, so the screen it's open on can keep it (e.g. going back and forth to the film). */
  onStateChange?: (state: PlayBuilderState) => void;
  /** This alignment becomes the backfield for every play on this scout film that uses it. */
  onSaveFilmBackfield?: (change: { gameId: string; backfield: string; spots: BackfieldSpots; baseKey: string }) => void;
  /** Drawing one of their formations (seed.formationEdit): saved as the formation their plays start from. */
  onSaveFormation?: (formation: { id: string; name: string; builder: PlayBuilderState; diagramUrl: string; defenseUrl?: string; defenseName?: string }) => void;
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

export const PlayBuilderSection: React.FC<Props> = ({ canEdit, onAdd, seed, onBack, onRename, onWatchFilm, compact, onStateChange, onSaveFilmBackfield, onSaveFormation }) => {
  // Drawing their formation: just the alignment (no play lines), saved as the formation.
  const formationMode = Boolean(seed?.formationEdit);
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
  const [holdName, setHoldName] = useState(opened.holdName);
  const [tab, setTab] = useState<BuilderTab>('formation');
  // The side panel's Players tab: the field draws its "who does what" panel into it.
  const [host, setHost] = useState<HTMLDivElement | null>(null);
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
  const [nameIn, setNameIn] = useState(saved?.name || opened.name);
  const [committedName, setCommittedName] = useState(saved?.name || opened.name);
  const [putDefInName, setPutDefInName] = useState(Boolean(saved?.putDefInName));
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>(saved?.overrides || {});
  const [filmBases, setFilmBases] = useState<Record<string, BackfieldSpots>>(seed?.filmBases || {});
  const [filmBaseKeys, setFilmBaseKeys] = useState<Record<string, string>>(seed?.filmBaseKeys || {});
  const [baseNote, setBaseNote] = useState('');
  const [strokes, setStrokes] = useState<PlayStroke[]>((saved?.strokes as PlayStroke[]) || []);
  // Our defense tagged from the depth chart: which unit is in (Black 1s / Gold 2s / Blue 3s), and any
  // defender a coach set by hand.
  const rosterSrc = useDefenseRosterSource();
  const hasDepth = Object.keys(rosterSrc.depthChart || {}).length > 0;
  const [defUnit, setDefUnit] = useState<DefUnit | 'off'>(() => saved?.defenseUnit || rememberedDefenseUnit());
  const [defWho, setDefWho] = useState<Record<string, NodePlayer>>(saved?.defenseWho || {});
  const pickUnit = (u: DefUnit | 'off') => {
    setDefUnit(u);
    rememberDefenseUnit(u);
  };
  const [labels, setLabels] = useState<Record<string, string>>(saved?.labels || {});
  const withLabel = <T extends { role: string }>(n: T): T => (labels[n.role] ? { ...n, label: labels[n.role] } : n);
  const renamePlayer = (role: string, label: string) =>
    setLabels((prev) => {
      const next = { ...prev };
      const clean = label.slice(0, 6);
      if (clean.trim()) next[role] = clean;
      else delete next[role];
      return next;
    });
  const [userDrew, setUserDrew] = useState(Boolean(saved?.strokes));

  const locations = TE_LOCATIONS[personnelPick] || [];
  const wrCount = PERSONNEL_DEFINITIONS[personnelPick]?.wr || 0;
  const alignmentGroups = alignmentsFor(personnelPick);
  const activeAlign = alignmentGroups.find((g) => g.locations.some((l) => l.baseKey === baseKey)) || alignmentGroups[0];
  const spotChoices = wrCount === 0 ? locations : activeAlign && activeAlign.locations.length > 1 ? activeAlign.locations : [];
  const locationId = (spotChoices.length ? spotChoices : locations).find((l) => l.baseKey === baseKey)?.id || '';
  const chooseAlignment = (id: string) => {
    const group = alignmentGroups.find((g) => g.id === id);
    if (!group?.locations.length) return;
    const current = locations.find((l) => l.baseKey === baseKey);
    const same = group.locations.find((l) => l.label === current?.label);
    setBaseKey((same || group.locations[0]).baseKey);
  };
  const validBacks = backs.length ? backs : ['I_FORM'];
  // A play saved with a backfield that's no longer offered (a copy of another) still opens with it.
  const activeBack = validBacks.includes(backfieldKey) || isValidEleven(baseKey, backfieldKey) ? backfieldKey : validBacks[0];
  // The everyday backfields are buttons; the rest are in "More backfields".
  const backfieldChips = validBacks.filter((k) => BACKFIELD_STRUCTURES[k].common);
  const extraBacks = validBacks.filter((k) => !backfieldChips.includes(k));
  const runMode = family === 'all' || family === 'run';
  const run = RUN_SCHEMES.find((s) => s.id === runId) || RUN_SCHEMES[0];
  const activeConceptKey = runMode ? run.conceptKey : conceptKey;
  const basePlay = tryAssemblePlay(baseKey, activeBack, activeConceptKey, strength, tags, filmBases[activeBack], filmBaseKeys[activeBack]);
  const hashDx = hash === 'Left' ? -4.2 : hash === 'Right' ? 4.2 : 0;
  const offNodes = basePlay
    ? applyNodeOverrides(basePlay.nodes, overrides).map((n) => withLabel(overrides[n.role] ? n : { ...n, x: n.x + hashDx }))
    : [];
  const dLook = defenseKey ? looks[defenseKey] || null : null;
  const defFront = frontOfLook(defenseKey);
  const strongLeft = dLook && (dLook.strength === 'Left' || dLook.strength === 'Right') ? dLook.strength === 'Left' : strength === 'Left';
  const tagging = Boolean(dLook) && defUnit !== 'off' && hasDepth;
  const taggedWho = useMemo(
    () => (dLook && tagging ? lineupForDefense(dLook.nodes, { unit: defUnit as DefUnit, front: defFront, strongLeft, src: rosterSrc, overrides: defWho }) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defenseKey, tagging, defUnit, defFront, strongLeft, rosterSrc, defWho]
  );
  const dNodes = useMemo(() => {
    if (!dLook) return [];
    // Lined up on the offense, then the way the coach saved this defense as the default.
    const aligned = withMyAlignment(defenseKey, alignDefenseTechniques(dLook.nodes, offNodes));
    return applyNodeOverrides(aligned, overrides)
      .map((n) => withLabel(overrides[n.role] ? n : { ...n, x: n.x + hashDx }))
      .map((n) => (taggedWho[n.role] ? { ...n, player: taggedWho[n.role] } : n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dLook, offNodes, overrides, hashDx, labels, taggedWho]);
  const play = basePlay ? { ...basePlay, nodes: offNodes } : null;
  // "Save as my default": this defense starts lined up like this everywhere (moves from its standard spots).
  const saveAlignment = defenseAlignmentSaver();
  const myDefault = defenseKey ? defenseSystem().alignments?.[defenseKey] : undefined;
  const movedDefenders = dLook ? dLook.nodes.filter((n) => overrides[n.role]).length : 0;
  const [defaultNote, setDefaultNote] = useState('');
  const saveDefenseDefault = () => {
    if (!dLook || !saveAlignment) return;
    const standard = alignDefenseTechniques(dLook.nodes, offNodes);
    const moves: Record<string, { dx: number; dy: number }> = {};
    for (const n of standard) {
      const now = overrides[n.role] ? { x: overrides[n.role].x - hashDx, y: overrides[n.role].y } : { x: n.x + (myDefault?.[n.role]?.dx || 0), y: n.y + (myDefault?.[n.role]?.dy || 0) };
      const dx = Math.round((now.x - n.x) * 100) / 100;
      const dy = Math.round((now.y - n.y) * 100) / 100;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) moves[n.role] = { dx, dy };
    }
    saveAlignment(defenseKey, Object.keys(moves).length ? moves : null);
    // Those spots are the default now, not moves on this play.
    setOverrides((prev) => Object.fromEntries(Object.entries(prev).filter(([role]) => !dLook.nodes.some((n) => n.role === role))));
    setDefaultNote(`Saved. ${dLook.name} starts lined up like this everywhere.`);
    window.setTimeout(() => setDefaultNote(''), 4000);
  };
  const clearDefenseDefault = () => {
    if (!dLook || !saveAlignment || !window.confirm(`Put ${dLook.name} back to the standard alignment everywhere?`)) return;
    saveAlignment(defenseKey, null);
    setDefaultNote(`${dLook.name} is back to the standard alignment.`);
    window.setTimeout(() => setDefaultNote(''), 4000);
  };
  const defaultButtons = dLook && saveAlignment ? (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={saveDefenseDefault}
        disabled={!movedDefenders}
        title={movedDefenders ? `Every play and formation starts ${dLook.name} lined up like this` : 'Drag our defenders first, then save their spots as the default'}
        className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer disabled:opacity-40 disabled:cursor-default"
      >
        Save as my default
      </button>
      {myDefault && (
        <button
          type="button"
          onClick={clearDefenseDefault}
          title="Back to the standard alignment for this defense"
          className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
        >
          Standard
        </button>
      )}
      {defaultNote && <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{defaultNote}</span>}
    </span>
  ) : null;
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
  }, [play?.playName, play?.metadata.concept, ball, hole, run.label, runMode, dLook?.name, putDefInName, holdName]);

  const tagged = (t: string) => tags.includes(t);
  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const commitName = (raw?: string) => {
    const next = (raw ?? nameIn).trim().slice(0, 120);
    if (!next || next === committedName) return;
    if (seed?.scoutId) onRename?.(committedName, next);
    setCommittedName(next);
    if (next !== nameIn) setNameIn(next);
  };

  /** Everything about the play as it stands, to save with it or carry to another screen. */
  const currentState = (): PlayBuilderState => ({
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
      ...(Object.keys(labels).length ? { labels } : {}),
      defenseUnit: defUnit,
      ...(Object.keys(defWho).length ? { defenseWho: defWho } : {}),
      ...(Object.keys(taggedWho).length ? { defensePlayers: taggedWho } : {}),
      ...(userDrew ? { strokes } : {}),
      name: nameIn,
  });
  const stateKey = JSON.stringify(currentState());
  useEffect(() => {
    onStateChange?.(currentState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);
  // Drawing their formation: each change saves itself a moment later, so leaving (Back) never loses it.
  const openedKey = useRef(stateKey);
  const autoSave = useRef<() => void>(() => {});
  useEffect(() => {
    if (!formationMode || !canEdit || stateKey === openedKey.current) return;
    const t = window.setTimeout(() => autoSave.current(), 700);
    return () => window.clearTimeout(t);
  }, [stateKey, formationMode, canEdit]);

  /** Backs and receivers, strong side to the right, without the hash or a Tight/Wide squeeze, so each play can still pick tight or wide. */
  const currentBackfieldSpots = (): BackfieldSpots => {
    const spots: BackfieldSpots = {};
    for (const n of offNodes) {
      if (!/^(?:[1-4]|X|Z|Y|W|H|Y1|Y2|W1|W2)$/.test(n.role)) continue;
      const xField = neutralSkillX(n.x - hashDx, n.role, tags);
      spots[n.role] = { x: strength === 'Left' ? -xField : xField, y: n.y };
    }
    return spots;
  };
  const backfieldLabel = BACKFIELD_STRUCTURES[activeBack]?.hudlBackfield || activeBack;
  const publishBackfield = (announce = true) => {
    if (!seed?.gameId || !onSaveFilmBackfield) return;
    const spots = currentBackfieldSpots();
    setFilmBases((prev) => ({ ...prev, [activeBack]: spots }));
    setFilmBaseKeys((prev) => ({ ...prev, [activeBack]: baseKey }));
    setOverrides((prev) => {
      const next = { ...prev };
      for (const role of ['1', '2', '3', '4', 'X', 'Z', 'Y', 'W', 'H', 'Y1', 'Y2', 'W1', 'W2']) delete next[role];
      return next;
    });
    onSaveFilmBackfield({ gameId: seed.gameId, backfield: activeBack, spots, baseKey });
    if (announce) setBaseNote(`Saved. Every ${backfieldLabel} play on this scouting report uses this formation. Tight or wide stays on each play.`);
  };
  const publishRef = useRef(publishBackfield);
  publishRef.current = publishBackfield;
  const rememberTimer = useRef<number | null>(null);
  /** A moved player on this film becomes the backfield the other plays pick up. */
  const rememberBackfield = () => {
    if (!seed?.gameId || !onSaveFilmBackfield || formationMode) return;
    if (rememberTimer.current) window.clearTimeout(rememberTimer.current);
    rememberTimer.current = window.setTimeout(() => publishRef.current(false), 400);
  };
  /**
   * Beast (or any backfield) edited for this film: another play that selects it
   * lines up the same way, including the formation it was saved on.
   */
  const chooseBackfield = (key: string) => {
    if (seed?.gameId && filmBases[key]) {
      const aligned = openFormation(key, filmBaseKeys[key]);
      setPersonnelPick(aligned.personnel);
      setBaseKey(aligned.baseKey);
      setOverrides({});
    }
    setBackfieldKey(key);
  };

  const saveFormation = (announce: boolean) => {
    if (!play || !seed?.formationEdit || !onSaveFormation) return;
    const { strokes: _drawn, ...builder } = currentState();
    const name = (nameIn.trim() || seed.name).slice(0, 80);
    onSaveFormation({
      id: seed.formationEdit.id,
      name,
      builder: { ...builder, name },
      diagramUrl: diagramSvg(play, [], [], String(ball)),
      // Our defense lined up against it, as it stands on the field.
      defenseUrl: dLook ? diagramSvg(play, [], dNodes, String(ball)) : '',
      defenseName: dLook?.name || '',
    });
    setBaseNote(announce ? `Saved ${name}. Their plays drawn from it start lined up like this.` : `Saved ${name} (changes save as you go).`);
  };
  autoSave.current = () => saveFormation(false);
  const saveOffense = () => {
    if (formationMode) {
      saveFormation(true);
      return;
    }
    if (seed?.backfieldEdit) {
      publishBackfield();
      return;
    }
    if (seed?.gameId) publishBackfield(false);
    if (!play) return;
    const calledHole = hole;
    const holeData = calledHole != null ? HOLE_SYSTEM[calledHole] : play.metadata.holeData;
    const vs = dLook?.name;
    commitName();
    const name = (nameIn.trim() || committedName || play.playName).slice(0, 120);
    const type: PlayType = inferPlayType(name, 'offense');
    // The defense as it stands on the screen: lined up on the offense, moved by the coach.
    const extra = dNodes;
    const builder = currentState();
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
          text: assignmentText(strokes, n) || (n.role === '1' ? 'QB' : n.role === '2' ? 'FB' : n.role === '3' ? 'RB' : n.role === '4' ? 'Wing / extra back' : n.line ? 'On the line' : 'Off the line'),
        })),
        ...(dLook
          ? extra.map((n) => ({ pos: n.role, text: assignmentText(strokes, n) || `${dLook.front} ${dLook.shell} · ${dLook.notes}` }))
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

  const parsed = useMemo(() => parsePlayCall(nameIn), [nameIn]);
  const readParts = [
    parsed.personnel != null && PERSONNEL_DEFINITIONS[parsed.personnel] ? `${parsed.personnel} personnel` : '',
    parsed.strength ? `${parsed.strength}` : '',
    parsed.backfields[0] && BACKFIELD_STRUCTURES[parsed.backfields[0]] ? BACKFIELD_STRUCTURES[parsed.backfields[0]].hudlBackfield : '',
    parsed.tackleOver ? 'Tackle over' : '',
    parsed.ball ? `${eligibleName(parsed.ball)} (${parsed.ball}) carries${parsed.hole != null ? ` to the ${parsed.hole} hole` : ''}` : '',
    parsed.run ? RUN_SCHEMES.find((r) => r.id === parsed.run)?.label || '' : '',
    !parsed.run && parsed.family && parsed.family !== 'run' ? parsed.family : '',
  ].filter(Boolean);

  /** Set the formation and play from the call as typed: "32 L WB 44 ZONE". Only what it can read changes. */
  const applyCall = () => {
    const p = parsePlayCall(nameIn);
    let bk = baseKey;
    const locs = p.personnel != null ? TE_LOCATIONS[p.personnel] || [] : [];
    if (p.personnel != null && locs.length) {
      const loc = (p.tackleOver && locs.find((l) => l.id === 'over')) || locs.find((l) => l.id === 'tight') || locs[0];
      setPersonnelPick(p.personnel);
      bk = loc.baseKey;
      setBaseKey(bk);
      setTags((prev) => prev.filter((t) => t !== 'Thumper'));
    }
    const fits = compatibleBackfields(bk);
    const want = p.backfields.find((k) => fits.includes(k));
    if (want) setBackfieldKey(want);
    else if (bk !== baseKey && !fits.includes(backfieldKey)) setBackfieldKey(fits[0] || 'I_FORM');
    if (p.strength) pickStrength(p.strength);
    if (p.family) setFamily(p.family);
    if (p.run) setRunId(p.run);
    if (p.ball) setBallCarrier(p.ball);
    if (p.hole != null) setHoleOverride(p.hole);
    setHoldName(true);
    commitName();
  };

  const callLabel = runMode
    ? `${/^[1-4]$/.test(String(ball)) && hole != null ? `${ball}${hole}` : ball} ${run.label}`
    : `${ball} ${play?.metadata.concept || ''}`;
  const summary: { tab: BuilderTab; text: string }[] = [
    { tab: 'formation', text: `${personnelPick} personnel · ${backfieldLabel}` },
    { tab: 'formation', text: `Strength ${strength} · ${hash === 'Middle' ? 'Mid' : hash} hash` },
    { tab: 'play', text: `${eligibleName(String(ball))} ${hole != null ? `→ ${hole} hole` : ''} · ${runMode ? run.label : play?.metadata.concept || ''}` },
    { tab: 'notes', text: dLook ? `vs ${dLook.name}` : 'No defense' },
  ];

  const label = (text: string, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{text}</span>
      {extra}
    </div>
  );

  const segmented = <T extends string>(options: readonly T[], value: T, onPick: (v: T) => void, show: (v: T) => string = (v) => v) => (
    <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-black">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={`flex-1 h-9 capitalize cursor-pointer transition-colors ${
            value === o
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          {show(o)}
        </button>
      ))}
    </div>
  );

  const tabs: { id: BuilderTab; label: string; icon: React.ReactNode }[] = [
    { id: 'formation', label: 'Formation', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'play', label: 'Play', icon: <Zap className="w-4 h-4" /> },
    { id: 'players', label: 'Players', icon: <Users className="w-4 h-4" /> },
    { id: 'notes', label: 'Game plan', icon: <ClipboardList className="w-4 h-4" /> },
  ];

  return (
    <section
      className={
        compact
          ? 'bg-white dark:bg-slate-900 p-2.5 space-y-3'
          : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4'
      }
    >
      {/* The call: type it the way it is called and the field draws it. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {onBack && !compact && (
            <button
              type="button"
              onClick={onBack}
              className="h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-black text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex-1 min-w-[220px] flex items-center gap-2 h-11 px-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 focus-within:border-indigo-500">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              aria-label="Play call"
              value={nameIn}
              placeholder={formationMode ? 'Name their formation, e.g. Trips Rt or 21 Beast R' : 'Type the call, e.g. 32 L WB 44 ZONE'}
              onChange={(e) => {
                setNameIn(e.target.value);
                setHoldName(true);
              }}
              onBlur={() => commitName()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyCall();
                }
              }}
              className="flex-1 min-w-0 bg-transparent outline-none text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 dark:text-white placeholder:normal-case placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-400"
            />
            {holdName && !seed?.scoutId && !formationMode && (
              <button
                type="button"
                onClick={() => setHoldName(false)}
                title="Name it from the diagram again"
                className="h-7 px-2 rounded-md text-[11px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                Auto name
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={applyCall}
            disabled={!readParts.length}
            title="Set the formation and play from the call (Enter)"
            className="h-11 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-30 shrink-0"
          >
            <Wand2 className="w-4 h-4" /> Draw it
          </button>
          {!compact && !!seed?.snaps?.length && !!seed.gameId && (
            <button
              type="button"
              onClick={() => openFilmWindow({ gameId: seed.gameId!, playIds: seed.snaps!.map((x) => x.id), label: seed.watchLabel || seed.name })}
              title="Watch their film of this play in a window while you work"
              className="h-11 px-3 rounded-xl border-2 border-indigo-500 text-sm font-black text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer shrink-0"
            >
              <PlayIcon className="w-4 h-4" /> Watch film ({seed.snaps.length})
            </button>
          )}
          {!compact && !!seed?.snaps?.length && onWatchFilm && (
            <button
              type="button"
              title="Open the Film Room with this play beside the video"
              onClick={() => onWatchFilm(nameIn.trim() || seed.name, currentState())}
              className="h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <Film className="w-4 h-4 text-indigo-500" /> Film Room
            </button>
          )}
          {!compact && canEdit && (
            <button
              type="button"
              disabled={!play}
              onClick={saveOffense}
              className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
            >
              <Save className="w-4 h-4" /> {formationMode ? 'Save formation' : seed?.backfieldEdit ? `Save ${backfieldLabel}` : 'Save play'}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] min-h-6">
          {readParts.length > 0 ? (
            <>
              <span className="font-bold text-slate-400">Reads as:</span>
              {readParts.map((p) => (
                <span key={p} className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold">
                  {p}
                </span>
              ))}
              <span className="text-slate-400">· press Enter to draw it</span>
            </>
          ) : (
            <span className="text-slate-400">
              Personnel, side, formation, back + hole, play: <b className="text-slate-500 dark:text-slate-300">30 DW 41 SWEEP</b> ·{' '}
              <b className="text-slate-500 dark:text-slate-300">21 R WT 26 DIVE</b>. Or set it up with the tabs.
            </span>
          )}
        </div>
      </div>

      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start'}>
        {/* The field */}
        <div className="space-y-2 min-w-0">
          {formationMode && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300/70 dark:border-emerald-700/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Our defense vs it</span>
              <select
                aria-label="Our defense against this formation"
                value={defenseKey}
                onChange={(e) => setDefenseKey(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="">None (formation only)</option>
                {Object.entries(looks).map(([id, d]) => (
                  <option key={id} value={id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {dLook ? 'Drag our defenders where they line up against this formation. It saves as you go.' : 'Pick our defense to line it up against this formation.'}
              </span>
              {defaultButtons}
            </div>
          )}
          {dNodes.length > 0 && hasDepth && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Who&apos;s in</span>
              <div role="group" aria-label="Which unit plays our defense" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-black">
                {(['off', 'black', 'gold', 'blue'] as const).map((u) => {
                  const on = defUnit === u;
                  const dot = u === 'black' ? '#0f172a' : u === 'gold' ? '#f59e0b' : u === 'blue' ? '#2563eb' : '';
                  return (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickUnit(u)}
                      className={`h-7 px-2.5 inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        on
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {dot && <span className="h-2 w-2 rounded-full ring-1 ring-slate-300 dark:ring-slate-500" style={{ background: dot }} />}
                      {u === 'off' ? 'Off' : DEF_UNITS.find((x) => x.id === u)!.label}
                    </button>
                  );
                })}
              </div>
              {defUnit !== 'off' && <span className="hidden sm:inline text-[11px] text-slate-400">Hover a defender to see who plays there</span>}
            </div>
          )}
          <div className="hidden sm:flex flex-wrap gap-1.5">
            {summary.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => setTab(s.tab)}
                className="h-7 px-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-400 cursor-pointer"
              >
                {s.text}
              </button>
            ))}
          </div>
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
              strokes={formationMode ? [] : strokes}
              ballRole={String(ball)}
              formLabel=""
              playLabel={callLabel}
              vsLabel={dLook ? dLook.front : '—'}
              coachNote={coachNote}
              onCoachNote={setCoachNote}
              onMove={(role, x, y) => {
                setOverrides((prev) => ({ ...prev, [role]: { x, y } }));
                if (/^(?:[1-4]|X|Z|Y|W|H|Y1|Y2|W1|W2)$/.test(role)) rememberBackfield();
              }}
              onStrokes={(next) => {
                if (formationMode) return;
                setUserDrew(true);
                setStrokes(next);
              }}
              onReset={() => {
                setOverrides({});
                setUserDrew(false);
              }}
              linesFollow={userDrew}
              dense={compact}
              chrome="minimal"
              assignmentHost={host}
              onSelectPlayer={(n) => {
                if (n) setTab('players');
              }}
              onBallCarrierChange={(role) => setBallCarrier(role)}
              onHoleChange={(h) => setHoleOverride(h)}
              onLabelChange={renamePlayer}
              defenseWho={
                tagging
                  ? {
                      current: (role) => ({
                        player: taggedWho[role] || null,
                        spot: taggedWho[role]?.pos || defenseSpotName(role, defFront, strongLeft),
                        unit: DEF_UNITS.find((x) => x.id === defUnit)?.label || '',
                      }),
                      overridden: (role) => Boolean(defWho[role]),
                      options: (role) => whoOptions(defenseSpotName(role, defFront, strongLeft), defFront, rosterSrc),
                      onPick: (role, p) =>
                        setDefWho((prev) => {
                          const next = { ...prev };
                          if (p) next[role] = p;
                          else delete next[role];
                          return next;
                        }),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 p-6 min-h-[220px] flex items-center justify-center">
              <span className="text-xs font-bold text-slate-500">This formation and backfield do not add up to 11. Pick another backfield.</span>
            </div>
          )}
          {baseNote && <p className="px-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">{baseNote}</p>}
          {formationMode && !!seed?.formationPlays?.length && !!seed.gameId && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Their plays in this formation ({seed.formationPlays.length})
                </span>
                <span className="text-[11px] text-slate-400">Click one to watch it</span>
              </div>
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {seed.formationPlays.map((fp) => (
                  <li key={fp.snapId}>
                    <button
                      type="button"
                      onClick={() =>
                        openFilmWindow({
                          gameId: seed.gameId!,
                          playIds: seed.formationPlays!.map((x) => x.snapId),
                          label: seed.watchLabel || seed.name,
                          startId: fp.snapId,
                        })
                      }
                      title={`Watch clip ${fp.playNumber}`}
                      className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 p-1 hover:border-indigo-400 cursor-pointer"
                    >
                      {fp.diagramUrl ? (
                        <DiagramImage url={fp.diagramUrl} alt={fp.name || `Clip ${fp.playNumber}`} className="w-full rounded-md bg-white" />
                      ) : (
                        <div className="h-12 rounded-md bg-slate-50 dark:bg-slate-800/60 text-[10px] text-slate-400 flex items-center justify-center">Not drawn yet</div>
                      )}
                      <div className="mt-1 flex items-center gap-1 text-[11px]">
                        <span className="px-1 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-black tabular-nums shrink-0">{fp.playNumber}</span>
                        <span className="truncate font-bold text-slate-700 dark:text-slate-200">{fp.name || 'No play name'}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* One panel, one job at a time */}
        <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden ${compact ? '' : 'lg:sticky lg:top-3'}`}>
          <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
            {tabs.filter((t) => !formationMode || t.id !== 'play').map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`h-12 flex flex-col items-center justify-center gap-0.5 text-[11px] font-black cursor-pointer border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'formation' && (
            <div className="p-3.5 space-y-4">
              <div>
                {label('Personnel', PERSONNEL_DEFINITIONS[personnelPick] && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    {PERSONNEL_DEFINITIONS[personnelPick].rb} backs · {PERSONNEL_DEFINITIONS[personnelPick].te} TE · {PERSONNEL_DEFINITIONS[personnelPick].wr} WR
                  </span>
                ))}
                <div className="grid grid-cols-5 gap-1.5">
                  {[10, 11, 12, 20, 21, 22, 30, 31, 32].map((p) => (
                    <Chip key={p} on={personnelPick === p} title={PERSONNEL_DEFINITIONS[p]?.label} onClick={() => pickPersonnel(p)}>
                      {p}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                {label('Backfield')}
                <div className="flex flex-wrap gap-1.5">
                  {[...backfieldChips, ...Object.keys(filmBases).filter((k) => BACKFIELD_STRUCTURES[k] && !backfieldChips.includes(k) && !extraBacks.includes(k))].map((k) => (
                    <Chip key={k} on={activeBack === k} onClick={() => chooseBackfield(k)}>
                      {BACKFIELD_STRUCTURES[k].hudlBackfield}
                    </Chip>
                  ))}
                </div>
                {extraBacks.length > 0 && (
                  <select
                    className={`${SELECT} mt-1.5`}
                    aria-label="More backfields"
                    value={extraBacks.includes(activeBack) ? activeBack : ''}
                    onChange={(e) => e.target.value && chooseBackfield(e.target.value)}
                  >
                    <option value="">More backfields…</option>
                    {extraBacks.map((k) => (
                      <option key={k} value={k}>
                        {BACKFIELD_STRUCTURES[k].hudlBackfield}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {wrCount > 0 && activeAlign && (
                <div>
                  {label(`Receivers (${wrCount})`)}
                  <div className="flex flex-wrap gap-1.5">
                    {alignmentGroups.map((g) => (
                      <Chip key={g.id} on={activeAlign.id === g.id} onClick={() => chooseAlignment(g.id)}>
                        {g.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {spotChoices.length > 0 && (
                <div>
                  {label((PERSONNEL_DEFINITIONS[personnelPick]?.te || 0) > 0 ? 'Tight end spot' : 'Receiver spot')}
                  <div className="flex flex-wrap gap-1.5">
                    {spotChoices.map((l) => (
                      <Chip key={l.baseKey} on={locationId === l.id} onClick={() => setBaseKey(l.baseKey)}>
                        {l.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  {label('Strength')}
                  {segmented<'Left' | 'Right'>(['Left', 'Right'], strength, pickStrength)}
                </div>
                <div>
                  {label('Hash')}
                  {segmented<'Left' | 'Middle' | 'Right'>(['Left', 'Middle', 'Right'], hash, setHash, (h) => (h === 'Middle' ? 'Mid' : h[0]))}
                </div>
              </div>

              {canEdit && seed?.gameId && !seed.backfieldEdit && onSaveFilmBackfield && (
                <button
                  type="button"
                  disabled={!play}
                  onClick={() => publishBackfield()}
                  className="w-full h-9 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer disabled:opacity-40"
                >
                  Use this {backfieldLabel} for every play on this report
                </button>
              )}
              <p className="text-[11px] text-slate-400">Drag any player on the field to move the spot.</p>
            </div>
          )}

          {tab === 'play' && (
            <div className="p-3.5 space-y-4">
              <div>
                {label('Kind of play')}
                {segmented<'run' | 'option' | 'pass' | 'screen'>(['run', 'option', 'pass', 'screen'], family === 'all' ? 'run' : family, setFamily)}
              </div>

              <div>
                {label(runMode ? 'Run' : 'Concept')}
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
                {label('Ball carrier')}
                <div className="flex flex-wrap gap-1.5">
                  {eligibles.map((n) => (
                    <Chip key={n.role} on={ball === n.role} onClick={() => setBallCarrier(n.role)}>
                      {n.role} · {eligibleName(n.role)}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                {label(
                  'Hole',
                  hole != null && (
                    <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">
                      {hole} · {HOLE_SYSTEM[hole].type}
                    </span>
                  )
                )}
                <div className="grid grid-cols-9 gap-1">
                  {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
                    <button
                      key={n}
                      type="button"
                      title={HOLE_SYSTEM[n].description}
                      onClick={() => setHoleOverride(holeOverride === n ? '' : n)}
                      className={`h-10 rounded-lg text-sm font-black border cursor-pointer transition-colors ${
                        hole === n
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-amber-400'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-400">
                  <span>← Left</span>
                  <span>Right →</span>
                </div>
              </div>

              <details className="group rounded-xl border border-slate-200 dark:border-slate-800">
                <summary className="list-none cursor-pointer px-3 h-10 flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-200">
                  <span>Tags &amp; motions</span>
                  <span className="text-[11px] font-bold text-slate-400">{tags.length ? tags.join(', ') : 'none'}</span>
                </summary>
                <div className="px-3 pb-3 space-y-2.5">
                  {TAG_GROUPS.map((group) => {
                    const keys = Object.keys(MASTER_TAGS).filter((t) => MASTER_TAGS[t].type === group);
                    return (
                      <div key={group}>
                        <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">{group}</div>
                        <div className="flex flex-wrap gap-1">
                          {keys.map((t) => (
                            <Chip key={t} on={tagged(t)} title={MASTER_TAGS[t]?.effect} onClick={() => toggleTag(t)}>
                              {t}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          )}

          {/* Always mounted: the field puts its "who does what" panel here. */}
          <div ref={setHost} className={tab === 'players' ? '' : 'hidden'} />

          {tab === 'notes' && (
            <div className="p-3.5 space-y-4">
              <div>
                {label('Our defense on the diagram')}
                <select className={SELECT} aria-label="Defense" value={defenseKey} onChange={(e) => setDefenseKey(e.target.value)}>
                  <option value="">Offense only</option>
                  {Object.entries(looks).map(([id, d]) => (
                    <option key={id} value={id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {dLook && (
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {dLook.front} {dLook.shell} · {dLook.notes}
                    {myDefault ? ' · lined up your way' : ''}
                  </p>
                )}
                {defaultButtons && <div className="mt-2">{defaultButtons}</div>}
                <label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={putDefInName} onChange={(e) => setPutDefInName(e.target.checked)} />
                  Put the defense in the play name
                </label>
              </div>

              <div>
                {label('When to call it')}
                <div className="flex flex-wrap gap-1.5">
                  {SITUATIONS.map((s) => (
                    <Chip key={s} on={situations.includes(s)} onClick={() => setSituations((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                {label('Coaching point')}
                <textarea
                  className={`${SELECT} h-20 py-2 resize-none`}
                  placeholder={play?.metadata.scheme || 'Key read, checkdown rule, coaching point…'}
                  value={coachNote}
                  onChange={(e) => setCoachNote(e.target.value)}
                />
              </div>

              {!compact && (
                <details className="rounded-xl border border-slate-200 dark:border-slate-800">
                  <summary className="list-none cursor-pointer px-3 h-10 flex items-center text-xs font-black text-slate-700 dark:text-slate-200">
                    Save a defense-only card
                  </summary>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                    {Object.entries(looks).map(([k, d]) => (
                      <button key={k} type="button" disabled={!canEdit} onClick={() => addDefenseLook(k)} className={DEF_BTN}>
                        {d.name}
                      </button>
                    ))}
                    {Object.entries(DEFENSIVE_FRONTS).map(([k, d]) => (
                      <button key={k} type="button" disabled={!canEdit} onClick={() => addFront(k)} className={DEF_BTN}>
                        {d.front} {d.shell}
                      </button>
                    ))}
                    {Object.keys(STUNTS_AND_PRESSURES).map((k) => (
                      <button key={k} type="button" disabled={!canEdit} onClick={() => addPressure(k)} className={DEF_BTN}>
                        {k.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
