import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Film, LayoutGrid, ListChecks, PanelRightClose, PanelRightOpen, Pencil, Play as PlayIcon, RotateCcw, Save, Search, Sparkles, Users, Wand2, Zap } from 'lucide-react';
import { autoSketchPlayFromVideo } from '../../services/geminiFilmService';
import { usePresentStage } from '../scouting/presentStage';
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
  FILM_SPOT_MAX_X,
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
  defenseAtHash,
  ballXOf,
  lineStartsOn,
  conceptFamily,
  resolveTaggedCall,
  type AssembledPlay,
  type OurDefenseLook,
  type BackfieldSpots,
  type PlayStroke,
  type NodePlayer,
  type PlayNode,
  diagramLabel,
  isDefenseRole,
  shownText,
} from '../../utils/footballEngine';
import { PlayDiagramCanvas } from './PlayDiagramCanvas';
import { VideoHomographyOverlay } from './VideoHomographyOverlay';
import type { VideoLines } from '../../filmroom/PlayLinesOverlay';
import { publishPlayLines } from '../../filmroom/playLinesStore';
import { DEFAULT_HOMOGRAPHY_QUAD, type HomographyQuad } from '../../utils/videoHomography';
import { assignmentText } from './PlayerAssignmentPanel';
import type { PlayBuilderSeed } from '../../utils/playBuilderSeed';
import { callSetup } from '../../utils/callDiagram';
import { openFormation } from '../../utils/filmBackfields';
import { parsePlayCall } from '../../utils/playCallParse';
import { openFilmWindow } from '../../filmroom/filmWindowStore';
import type { CallParts } from '../../hudlScout/types/football';
import { buildCallName, parseCall, PASS_CONCEPTS } from '../../filmroom/callName';
import { PlayNameFields } from '../../filmroom/PlayNameFields';
import { captureConcept, conceptDrawing, conceptDrawingSaver, conceptKeyOf, drawConcept, playSide } from '../../utils/conceptDrawings';

/** A play name's concept, drawn the standard way: the run fit it is, or the pass concept. */
const RUN_FOR_CONCEPT: Record<string, string> = {
  dive: 'dive', trap: 'trap', counter: 'counter', power: 'power', iso: 'iso', sweep: 'toss', toss: 'toss', zone: 'inside_zone',
  wedge: 'wedge', buck: 'buck', reverse: 'reverse', option: 'keep', sneak: 'qb_sneak', draw: 'draw', keep: 'keep',
};
const PASS_FOR_CONCEPT: Record<string, string> = {
  boot: '19_BOOT', 'play action': '32_POWER_PASS', screen: 'TUNNEL', 'sprint out': 'SPRINT_OUT', quick: 'STICK',
  'drop back': 'FOUR_VERTS', 'jet pass': 'BUBBLE_SCREEN', slant: 'RPO_SLANT', bubble: 'BUBBLE_SCREEN',
};
const NO_OPTIONS = { personnel: [], tags: [], runConcepts: [], passConcepts: [] };
import { DiagramImage } from './DiagramImage';
import { DefenseCallPicker } from './DefenseCallPicker';
import { defenseJob, defenseOrder, standardDefenseJob } from '../../utils/defenseJobs';
import { pickedTechniques, rulesText } from '../../utils/defenseRules';
import { DefenderRules } from './DefenderRules';
import { defenseCallName, defenseCallStrokes, mirrorJob, mirrorPressure, pressureGaps } from '../../utils/defenseCalls';
import { baseLookKey, defenseAlignmentSaver, defenseFrontSaver, defenseMirrored, lineUpOurDefense, samToWideSide, tightEndFlip } from '../../hudlScout/utils/ourDefense';
import { DEF_UNITS, defensePlayerAt, defenseSpotName, frontOfLook, lineupForDefense, whoOptions, type DefUnit } from '../../utils/defenseLineup';
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

/** Backs and receivers: their spots on a scouting film are shared by every play in that backfield. */
const FILM_BACKFIELD_ROLES = ['1', '2', '3', '4', 'X', 'Z', 'Y', 'W', 'H', 'Y1', 'Y2', 'W1', 'W2'];

type BuilderTab = 'formation' | 'play' | 'players' | 'notes' | 'jobs';

const SITUATIONS = ['1-10', '2nd long', '2nd med', '3rd long', '3rd short', 'RED ZONE', 'Goaline', '2 MIN O', '4 Min O'];

/** The play's notes: the coach's note first, then the scheme and the details, each once. */
function notesFor(play: AssembledPlay, coachNote: string, extra: string[]) {
  const parts = [coachNote.trim(), play.metadata.scheme, ...extra].map((s) => String(s || '').trim()).filter(Boolean);
  return [...new Set(parts)].join(' · ');
}

interface Props {
  canEdit: boolean;
  /** `auto`: saved by itself (leaving the play, Previous / Next), not the Save button. */
  onAdd: (entry: PlayDatabaseEntry, opts?: { auto?: boolean }) => void;
  /** Step to the play before or after this one in the list it was opened from ("3 of 12"). */
  nav?: { label: string; onPrev?: () => void; onNext?: () => void };
  /** A scout play to draw. The name stays as they called it. */
  seed?: PlayBuilderSeed | null;
  /** Return to the scout play list this diagram was opened from. */
  onBack?: () => void;
  /** The play name changed. Their plays and the play log should use the new name. */
  onRename?: (from: string, to: string, parts?: CallParts) => void;
  /** Open the film clips tagged to this play. */
  onWatchFilm?: (label: string, state: PlayBuilderState) => void;
  /** Narrow layout (beside the video in the Film Room): the diagram first, the settings under it. */
  compact?: boolean;
  /** Presentation mode: the field as big as the screen allows; the Formation / Play / Jobs panel starts hidden. */
  present?: boolean;
  /** Every change to the play, so the screen it's open on can keep it (e.g. going back and forth to the film). */
  onStateChange?: (state: PlayBuilderState) => void;
  /** This alignment becomes the backfield for every play on this scout film that uses it. */
  onSaveFilmBackfield?: (change: { gameId: string; backfield: string; spots: BackfieldSpots; baseKey: string }) => void;
  /** Their play: start it over from one of their drawn formations. */
  onStartFromFormation?: (formationId: string) => void;
  /** Open another play drawn under this play call. */
  onOpenSameCall?: (scoutId: string, gameId: string) => void;
  /** Drawing one of their formations (seed.formationEdit): saved as the formation their plays start from. */
  onSaveFormation?: (formation: { id: string; name: string; builder: PlayBuilderState; diagramUrl: string; defenseUrl?: string; defenseName?: string }) => void;
  /** Optional accessor for the active HTML5 video element (Film Room side-by-side player or open FilmWindow). */
  getVideo?: () => HTMLVideoElement | null;
  /** The play as drawn here (players, lines, the field's lineup on the film), for the Film Room to lay over the video. */
  onVideoLines?: (lines: VideoLines) => void;
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
  for (const f of sys.fronts || []) {
    const from = OUR_DEFENSE_LOOKS[f.from];
    if (from) out[`front_${f.id}`] = { ...from, name: f.name, front: f.name, notes: `Your front (made from ${from.name})` };
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

/** The fronts, picked first (4-4 takes its LIZ / RIP from the offense's strength). */
const FRONT_CHOICES: { chip: string; label: string }[] = [
  { chip: '62', label: '6-2' },
  { chip: '44', label: '4-4' },
  { chip: '53_C3', label: '5-3' },
  { chip: '53_OVER', label: '5-3 Over' },
  { chip: '43', label: '4-3' },
  { chip: '52', label: '5-2' },
  { chip: '353', label: '3-5-3' },
];
/** Order of the players' job menus: linebackers, then the secondary, then the line. */
const playerRank = (role: string) => (/^(SAM|ROV|MIKE|WILL|OLB|ILB)/.test(role) ? 0 : /^(CB|FS|SS)/.test(role) ? 1 : 2);
/** Which front button a defense key belongs to. */
const frontChipOf = (key: string) =>
  !key ? '' : key.startsWith('44') || key.startsWith('blitz_') ? '44' : key === '53_OVER' ? '53_OVER' : key.startsWith('53') ? '53_C3' : key;

/** The defense a defensive play's name reads as ("4-4 BASE STACK BLOW STING LIZ" -> 4-4 Blow Sting LIZ). */
function guessDefense(name: string, looks: Record<string, OurDefenseLook>): string {
  const words = (t: string) => new Set(t.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean));
  const want = words(name);
  let best = '';
  let bestScore = 0;
  for (const [key, look] of Object.entries(looks)) {
    const have = words(look.name);
    let score = 0;
    have.forEach((w) => {
      if (want.has(w)) score += /^\d/.test(w) ? 1 : 2;
    });
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  if (best) return best;
  const rip = /\bRIP\b/i.test(name);
  if (/\b5-?3\b/.test(name)) return looks['53_C3'] ? '53_C3' : Object.keys(looks)[0];
  return rip ? '44_C3_RIP' : '44_C3_LIZ';
}

function startFromSeed(seed?: PlayBuilderSeed | null) {
  if (!seed?.name || seed.defenseCall) {
    return {
      personnel: 32,
      baseKey: '32_WISHBONE',
      backfield: 'WISHBONE',
      ball: '4',
      hole: '' as number | '',
      run: 'zone',
      strength: 'Left' as const,
      family: 'run' as const,
      name: seed?.defenseCall ? seed.name : '',
      note: seed?.defenseCall ? seed.notes || '' : '',
      holdName: Boolean(seed?.defenseCall),
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

// Presenting: whether the coach showed the Formation / Play / Jobs panel, and the editing tools (each play opens the
// builder anew).
let presentPanelOpen = false;
let presentEditing = false;
// Presentation's full screen: the field as tall as the screen allows, a little room around it.
const STAGE_FIELD_HEIGHT = 'calc(100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))';

export const PlayBuilderSection: React.FC<Props> = ({ canEdit, onAdd, seed, onBack, onRename, onWatchFilm, compact, present, onStateChange, onSaveFilmBackfield, onSaveFormation, onStartFromFormation, onOpenSameCall, nav, getVideo, onVideoLines }) => {
  // Drawing their formation: just the alignment (no play lines), saved as the formation.
  const formationMode = Boolean(seed?.formationEdit);
  // One of our defensive plays: the defense is what's drawn (front, alignment, blitz arrows).
  const defenseMode = Boolean(seed?.defenseCall);
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
  // Their plays open on the Play tab: the play name and its concept.
  const [tab, setTab] = useState<BuilderTab>(seed?.defenseCall ? 'jobs' : seed?.scoutId && !seed.formationEdit ? 'play' : 'formation');
  // The side panel's Players tab: the field draws its "who does what" panel into it.
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // Presenting: the panel hidden at first (shown, it stays shown from play to play).
  const [panelOpen, setPanelOpenState] = useState(() => !present || presentPanelOpen);
  const setPanelOpen = (open: boolean) => {
    setPanelOpenState(open);
    if (present) presentPanelOpen = open;
  };
  // Presentation's full screen: the field alone, nothing to edit (the coach's choices are kept for after).
  const stage = usePresentStage();
  const staged = Boolean(present) && stage.on;
  const panelHidden = Boolean(present) && (!panelOpen || staged);
  // Presenting, the field alone: the call, the summary and the drawing tools come back with Edit.
  const [editing, setEditingState] = useState(() => !present || presentEditing);
  const setEditing = (on: boolean) => {
    setEditingState(on);
    if (present) presentEditing = on;
  };
  const fieldOnly = Boolean(present) && (!editing || staged);
  const [situations, setSituations] = useState<string[]>(saved?.situations || []);
  const looks = teamDefenseLooks(defenseSystem());
  // An opponent's play opens against our base 4-4 (the 5-3 is the coach's pick per formation).
  const [defenseKey, setDefenseKey] = useState(() =>
    saved && (saved.defenseKey === '' || looks[saved.defenseKey])
      ? saved.defenseKey
      : defenseMode
        ? guessDefense(seed?.name || '', looks)
        : '44_C3_LIZ'
  );
  // The 4-4 Cover 3 sets its strength (LIZ / RIP) to the offense's.
  // Our defense mirrors to their strength. New plays do; a play saved before does once its strength is flipped
  // here (its dragged defenders were placed for the unmirrored defense).
  const [defenseMirror, setDefenseMirror] = useState<boolean>(() => (saved ? defenseMirrored(saved) : opened.strength === 'Right'));
  const ballOf = (h: string) => (h === 'Left' ? -4.2 : h === 'Right' ? 4.2 : 0);
  /** Everyone the coach placed and every line drawn, moved the same way (the rest follow on their own). */
  const moveAll = (f: (x: number) => number) => {
    setOverrides((prev) => Object.fromEntries(Object.entries(prev).map(([role, p]) => [role, { ...p, x: Math.round(f(p.x) * 100) / 100 }])));
    setStrokes((prev) => prev.map((st) => ({ ...st, points: st.points.map((p) => ({ ...p, x: Math.round(f(p.x) * 100) / 100 })) })));
  };
  const pickStrength = (s: 'Left' | 'Right') => {
    if (s === strength) return;
    // The whole picture flips around the ball: placed players, lines, and our defense with its call.
    const ballX = ballOf(hash);
    moveAll((x) => 2 * ballX - x);
    setDefAssign((prev) => Object.fromEntries(Object.entries(prev).map(([role, job]) => [role, mirrorJob(job)])));
    setPressure((p) => mirrorPressure(p));
    // Our defense turns over with them: everyone, dragged or not, stays where he was on their formation.
    setDefenseMirror((m) => !m);
    setStrength(s);
  };
  /** Another hash: the formation moves with the ball, placed players and drawn lines too. */
  const pickHash = (h: 'Left' | 'Middle' | 'Right') => {
    if (h === hash) return;
    const delta = ballOf(h) - ballOf(hash);
    moveAll((x) => x + delta);
    setHash(h);
  };
  const [personnelPick, setPersonnelPick] = useState<number>(saved?.personnel || opened.personnel);
  const [nameIn, setNameIn] = useState(saved?.name || opened.name);
  const [committedName, setCommittedName] = useState(saved?.name || opened.name);
  const [putDefInName, setPutDefInName] = useState(Boolean(saved?.putDefInName));
  const [overrides, setOverrides] = useState<Record<string, { x: number; y: number }>>(saved?.overrides || {});
  const [filmBases, setFilmBases] = useState<Record<string, BackfieldSpots>>(seed?.filmBases || {});
  const [filmBaseKeys, setFilmBaseKeys] = useState<Record<string, string>>(seed?.filmBaseKeys || {});
  // This play's own spots (kept with it); another backfield picked on it starts from the film's shared one.
  const [ownSpots, setOwnSpots] = useState(saved?.filmSpots);
  const shapeFor = (k: string) =>
    ownSpots && ownSpots.backfield === k ? ownSpots : { backfield: k, spots: filmBases[k], baseKey: filmBaseKeys[k] };
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
  // Our call on top of the front: a blitz or stunt, and a coverage. Drawn on the field from the picks.
  const [pressure, setPressure] = useState(saved?.defensePressure || '');
  const [coverage, setCoverage] = useState(saved?.defenseCoverage || '');
  // The defender whose job card is open in the picker.
  const [pickedDef, setPickedDef] = useState<string | null>(null);
  // Single defenders the coach gave their own job (over the call).
  const [defAssign, setDefAssign] = useState<Record<string, string>>(saved?.defenseAssign || {});
  // A defense picked for this play (not the one it opened with): it stays, whatever their formation's defense.
  const [defenseOwn, setDefenseOwn] = useState(Boolean(saved?.defenseOwn));
  // Our defenders' boxes: position (default) or jersey number.
  const [defShow, setDefShow] = useState<'position' | 'number'>(saved?.defenseShow === 'number' ? 'number' : 'position');
  // Our defensive plays: each defender's job as the coach typed it.
  const [jobs, setJobs] = useState<Record<string, string>>(saved?.jobs || {});
  const [defRules, setDefRules] = useState<Record<string, Record<string, string>>>(saved?.defenseRules || {});
  const withLabel = <T extends { role: string }>(n: T): T => (labels[n.role] ? { ...n, label: labels[n.role] } : n);
  const renamePlayer = (role: string, label: string) =>
    setLabels((prev) => {
      const next = { ...prev };
      const clean = label.slice(0, 6);
      if (clean.trim()) next[role] = clean;
      else delete next[role];
      return next;
    });
  // Their plays (from Hudl Scout) start from the base formation with nothing drawn: the coach draws what they ran
  // (Draw it still draws from the call when asked). Our own plays draw themselves from the call until a line is drawn.
  const theirPlay = Boolean(seed?.scoutId) && !defenseMode;
  const [userDrew, setUserDrew] = useState(Boolean(saved?.strokes) || defenseMode || theirPlay);

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
  const shape = shapeFor(activeBack);
  const basePlay = tryAssemblePlay(baseKey, activeBack, activeConceptKey, strength, tags, shape.spots, shape.baseKey);
  const hashDx = hash === 'Left' ? -4.2 : hash === 'Right' ? 4.2 : 0;
  const offNodes = basePlay
    ? applyNodeOverrides(basePlay.nodes, overrides).map((n) => withLabel(overrides[n.role] ? n : { ...n, x: n.x + hashDx }))
    : [];
  const dLook = defenseKey ? looks[defenseKey] || null : null;
  const defFront = frontOfLook(defenseKey);
  // Our defense turns to the tight end's side (else the strength call: the coach's mirror).
  const flipDefense = tightEndFlip(offNodes, hashDx) ?? defenseMirror;
  const strongLeft = flipDefense ? true : dLook && (dLook.strength === 'Left' || dLook.strength === 'Right') ? dLook.strength === 'Left' : strength === 'Left';
  const tagging = Boolean(dLook) && defUnit !== 'off' && hasDepth;
  const taggedWho = useMemo(
    () => (dLook && tagging ? lineupForDefense(dLook.nodes, { unit: defUnit as DefUnit, front: defFront, strongLeft, src: rosterSrc, overrides: defWho }) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defenseKey, tagging, defUnit, defFront, strongLeft, rosterSrc, defWho]
  );
  // Our defense where it starts before any of its players are dragged: the whole look moves with the
  // ball to the hash first, then the line sets its techniques on the offense's line (no second shift).
  // Saved moves are kept for the defense drawn strength-left: measured the other way when it's mirrored.
  const flipSign = flipDefense ? -1 : 1;
  const lineUpDefense = (nodes: PlayNode[]) => samToWideSide(defenseAtHash(flipDefense ? nodes.map((n) => ({ ...n, x: -n.x })) : nodes, offNodes, hashDx), hashDx);
  const standardDefense = useMemo(
    () => (dLook ? lineUpOurDefense(defenseKey, dLook.nodes, offNodes, { hashDx, flip: flipDefense, techs: pickedTechniques(defRules) }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dLook, defenseKey, offNodes, hashDx, defRules, flipDefense]
  );
  const dNodes = useMemo(() => {
    if (!dLook) return [];
    // Moved with the ball to the hash, lined up on the offense, then the way the coach saved this defense.
    return applyNodeOverrides(standardDefense, overrides)
      .map((n) => withLabel(n))
      .map((n) => (taggedWho[n.role] ? { ...n, player: taggedWho[n.role], ...(defShow === 'number' ? { show: 'number' as const } : {}) } : n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dLook, standardDefense, overrides, labels, taggedWho, defShow]);
  const play = basePlay ? { ...basePlay, nodes: offNodes } : null;
  const containFor = (front: string) => {
    const sys = defenseSystem();
    return String(sys.base || '').startsWith(front) ? sys.baseContain : sys.checkContain;
  };
  // The blitz / stunt and coverage drawn on the defenders where they stand against this offense.
  const callStrokes = useMemo(() => (dLook ? defenseCallStrokes(dNodes, offNodes, pressure, coverage, defAssign) : []), [dLook, dNodes, offNodes, pressure, coverage, defAssign]);
  // For the picker: the gap the blitz / stunt sends each defender through, and who each one has in man.
  const rushGaps = useMemo(() => (dLook ? pressureGaps(pressure, dNodes, offNodes) : {}), [dLook, pressure, dNodes, offNodes]);
  const manShown = useMemo(() => {
    const out: Record<string, string> = {};
    for (const st of callStrokes) {
      const m = /^Man on (.+)$/.exec(st.label || '');
      const s = st.points?.[0];
      const who = m && s ? dNodes.find((n) => Math.abs(n.x - s.x) < 0.05 && Math.abs(n.y - s.y) < 0.05) : undefined;
      if (m && who) out[who.role] = m[1];
    }
    return out;
  }, [callStrokes, dNodes]);
  // A mirrored 4-4 LIZ is the RIP.
  const lookName = dLook ? (flipDefense ? dLook.name.replace(/\bLIZ\b/, 'RIP') : dLook.name) : '';
  const callName = dLook ? defenseCallName(pressure || coverage ? dLook.front : lookName, pressure, coverage) : '';
  const ballX = ballXOf(offNodes);
  const rulesOf = (n: PlayNode) => rulesText(n.role, defRules[n.role], defAssign[n.role], n, ballX);
  const jobOf = (n: PlayNode) =>
    defenseJob(n, { typed: jobs[n.role], rules: rulesOf(n), strokes: [...strokes, ...callStrokes], look: dLook, contain: dLook ? containFor(dLook.front) : '', everyone: [...offNodes, ...dNodes] });
  // "Save as my default": this defense starts lined up like this everywhere (moves from its standard spots).
  const saveAlignment = defenseAlignmentSaver();
  const myDefault = defenseKey ? defenseSystem().alignments?.[defenseKey] : undefined;
  const movedDefenders = dLook ? dLook.nodes.filter((n) => overrides[n.role]).length : 0;
  const [defaultNote, setDefaultNote] = useState('');
  const saveDefenseDefault = () => {
    if (!dLook || !saveAlignment) return;
    const standard = lineUpDefense(dLook.nodes);
    const moves: Record<string, { dx: number; dy: number }> = {};
    for (const n of standard) {
      const now = overrides[n.role] ? { x: overrides[n.role].x, y: overrides[n.role].y } : { x: n.x + flipSign * (myDefault?.[n.role]?.dx || 0), y: n.y + (myDefault?.[n.role]?.dy || 0) };
      const dx = Math.round(flipSign * (now.x - n.x) * 100) / 100;
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
  const frontSaver = defenseFrontSaver();
  const isOwnFront = defenseKey.startsWith('front_');
  const saveAsFront = () => {
    if (!dLook || !frontSaver) return;
    const name = window.prompt('Name this front (e.g. 6-2, Bear, Goal line):', '')?.trim();
    if (!name) return;
    const from = baseLookKey(defenseKey);
    const standard = lineUpDefense(dLook.nodes);
    const moves: Record<string, { dx: number; dy: number }> = {};
    for (const n of standard) {
      const now = overrides[n.role] ? { x: overrides[n.role].x, y: overrides[n.role].y } : { x: n.x + flipSign * (myDefault?.[n.role]?.dx || 0), y: n.y + (myDefault?.[n.role]?.dy || 0) };
      const dx = Math.round(flipSign * (now.x - n.x) * 100) / 100;
      const dy = Math.round((now.y - n.y) * 100) / 100;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) moves[n.role] = { dx, dy };
    }
    const call = {
      ...(pressure ? { pressure } : {}),
      ...(coverage ? { coverage } : {}),
      ...(Object.keys(defAssign).length ? { assign: defAssign } : {}),
      ...(Object.keys(defRules).length ? { rules: defRules } : {}),
    };
    // The picture and the builder go with it: the front is also a defensive play in the Play Library.
    const now = currentState();
    const builderForLibrary: PlayBuilderState = {
      ...now,
      name,
      overrides: Object.fromEntries(Object.entries(now.overrides || {}).filter(([role]) => !dLook.nodes.some((n) => n.role === role))),
    };
    const key = frontSaver.add({
      name,
      from,
      moves,
      ...(Object.keys(call).length ? { call } : {}),
      diagramUrl: diagramSvg(play, [...callStrokes, ...strokes], dNodes, String(ball)),
      builder: builderForLibrary,
    });
    setOverrides((prev) => Object.fromEntries(Object.entries(prev).filter(([role]) => !dLook.nodes.some((n) => n.role === role))));
    setDefenseKey(key);
    setDefaultNote(`Saved the front ${name}. It's in every defense menu now.`);
    window.setTimeout(() => setDefaultNote(''), 4000);
  };
  const removeFront = () => {
    if (!dLook || !frontSaver || !isOwnFront || !window.confirm(`Delete your front ${dLook.name}? Plays already drawn with it keep their pictures.`)) return;
    frontSaver.remove(defenseKey);
    setDefenseKey(baseLookKey(defenseKey));
  };
  const pickFront = (chip: string, own: boolean) => {
    // A mirrored defense is already turned to their strength: the 4-4 drawn to the left is its RIP.
    const key = chip === '44' ? (strength === 'Right' && !defenseMirror ? '44_C3_RIP' : '44_C3_LIZ') : chip;
    if (key !== defenseKey) {
      // The new front lines everyone up its way (spots dragged for the last one don't carry over).
      setOverrides((prev) => Object.fromEntries(Object.entries(prev).filter(([role]) => !isDefenseRole(role))));
    }
    setDefenseKey(key);
    const saved = key.startsWith('front_') ? (defenseSystem().fronts || []).find((f) => `front_${f.id}` === key) : undefined;
    if (saved?.call) {
      // The call saved with the front comes with it.
      setPressure(saved.call.pressure || '');
      setCoverage(saved.call.coverage || '');
      setDefAssign(saved.call.assign || {});
      setDefRules(saved.call.rules || {});
    } else if (key && !coverage) setCoverage('cover3');
    if (own) setDefenseOwn(true);
  };
  const ownFronts = Object.entries(looks).filter(([k]) => k.startsWith('front_'));
  const otherLooks = Object.entries(looks).filter(([k]) => !k.startsWith('front_') && !FRONT_CHOICES.some((c) => c.chip === k) && !['44_C3_LIZ', '44_C3_RIP'].includes(k));
  /** Our defense: front, blitz / stunt, coverage, and any player's own job. `own`: picked for this play (it stays over their formation's defense). */
  const defensePicker = (own: boolean, allowNone: boolean) => {
    const mark = () => {
      if (own) setDefenseOwn(true);
    };
    return (
      <DefenseCallPicker
        fronts={[...FRONT_CHOICES.map((f) => ({ id: f.chip, label: f.label })), ...ownFronts.map(([k, d]) => ({ id: k, label: d.name }))]}
        frontId={defenseKey.startsWith('front_') ? defenseKey : frontChipOf(defenseKey)}
        otherLooks={otherLooks.map(([k, d]) => ({ id: k, label: d.name }))}
        allowNone={allowNone}
        onFront={(id) => pickFront(id, own)}
        pressure={pressure}
        onPressure={(v) => {
          setPressure(v);
          mark();
        }}
        coverage={coverage}
        onCoverage={(v) => {
          setCoverage(v);
          mark();
        }}
        callName={callName}
        hasLook={Boolean(dLook)}
        defenders={dNodes.map((n) => ({ role: n.role, label: (n as { pos?: string }).pos || n.label || n.role }))}
        receivers={offNodes.filter((n) => /^(X|Z|H|Y\d?|W\d?|[2-4])$/.test(n.role)).map((n) => ({ role: n.role, label: n.label && n.label !== n.role ? `${n.role} (${n.label})` : n.role }))}
        assign={defAssign}
        onAssign={(role, job) => {
          setDefAssign((prev) => {
            const next = { ...prev };
            if (job) next[role] = job;
            else delete next[role];
            return next;
          });
          mark();
        }}
        rushGaps={rushGaps}
        manShown={manShown}
      />
    );
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
      {frontSaver && (
        <button
          type="button"
          onClick={saveAsFront}
          title="Save the alignment on the field as a new front of your own (it joins the defense menus)"
          className="h-8 px-2.5 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-[11px] font-black cursor-pointer"
        >
          Save as new front
        </button>
      )}
      {frontSaver && isOwnFront && (
        <button type="button" onClick={removeFront} className="h-8 px-2 rounded-lg text-[11px] font-bold text-rose-600 cursor-pointer" title="Delete this front">
          Delete front
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

  // Another formation or backfield starts the spots over (a new hash or strength carries them along: pickHash /
  // pickStrength). Only a change does: a saved play opens as it was left.
  const lookKey = `${baseKey}|${activeBack}`;
  const lastLook = useRef(lookKey);
  useEffect(() => {
    if (lastLook.current === lookKey) return;
    lastLook.current = lookKey;
    setOverrides({});
    if (!theirPlay) setUserDrew(false);
  }, [lookKey]);

  const playKey = `${tags.join('|')}|${activeConceptKey}`;
  const lastPlay = useRef(playKey);
  useEffect(() => {
    if (lastPlay.current === playKey) return;
    lastPlay.current = playKey;
    if (!theirPlay) setUserDrew(false);
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
    if (!userDrew && !defenseMode) setStrokes(drawn);
  }, [drawn, userDrew, defenseMode]);

  useEffect(() => {
    if (!play || holdName) return;
    const vs = dLook && putDefInName ? ` vs ${callName}` : '';
    const who = /^[1-4]$/.test(String(ball)) && hole != null ? `${ball}${hole}` : hole != null ? `${ball} ${hole}` : `${ball} ${eligibleName(ball)}`;
    const call = runMode ? `${who} ${run.label}` : `${who} ${play.metadata.concept}`;
    const named = play.metadata.concept ? play.playName.replace(play.metadata.concept, call) : `${play.playName} ${call}`;
    setNameIn(`${named}${vs}`);
  }, [play?.playName, play?.metadata.concept, ball, hole, run.label, runMode, callName, putDefInName, holdName]);

  const tagged = (t: string) => tags.includes(t);
  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const commitName = (raw?: string, parts?: CallParts) => {
    const next = (raw ?? nameIn).trim().slice(0, 120);
    if (!next || next === committedName) return;
    if (seed?.scoutId) onRename?.(committedName, next, parts);
    setCommittedName(next);
    if (next !== nameIn) setNameIn(next);
    if (!parts) setNameParts(parseCall(next));
  };

  // Their plays: the play name picked from its parts, as in the Film Room. A new concept draws only the play's
  // lines (the formation stays): the coach's own drawing of it when one is saved, else the standard one.
  const theirNaming = theirPlay && !formationMode;
  const [nameParts, setNameParts] = useState<CallParts>(() => parseCall(saved?.name || opened.name));
  const [nameRun, setNameRun] = useState(() => {
    const c = parseCall(saved?.name || opened.name).concept;
    return c ? !PASS_CONCEPTS.some((x) => x.toLowerCase() === c.toLowerCase()) : !/pass|screen/i.test(seed?.kind || '');
  });
  const [pendingConcept, setPendingConcept] = useState<{ key: string; side: 'L' | 'R' | '' } | null>(null);
  const [conceptNote, setConceptNote] = useState('');
  const sideOf = (parts: CallParts) => playSide(parts.hole ?? hole, parts.strength || strength);
  /** Draw a concept's lines on the players where they stand. */
  const drawConceptLines = (key: string, parts: CallParts) => {
    // The play is that concept (the run fit or pass concept it is), whoever drew it.
    const c = String(parts.concept || '').toLowerCase();
    const runId = RUN_FOR_CONCEPT[c];
    const passKey = PASS_FOR_CONCEPT[c];
    if (runId) {
      setFamily('run');
      setRunId(runId);
    } else if (passKey && PLAY_CONCEPTS[passKey]) {
      setFamily(conceptFamily(PLAY_CONCEPTS[passKey]));
      setConceptKey(passKey);
    }
    if (conceptDrawing(key)) setPendingConcept({ key, side: sideOf(parts) });
    // Not drawn the coach's way yet: the standard drawing of it, from the call.
    else if (runId || passKey) setUserDrew(false);
  };
  const pickNameParts = (parts: CallParts) => {
    const before = conceptKeyOf(nameIn);
    const name = buildCallName(parts, nameRun);
    if (parts.strength && parts.strength !== nameParts.strength) pickStrength(parts.strength === 'L' ? 'Left' : 'Right');
    if (parts.back && parts.back !== nameParts.back) setBallCarrier(parts.back);
    if (parts.hole !== nameParts.hole) setHoleOverride(parts.hole ? Number(parts.hole) : '');
    setNameParts(parts);
    if (!name) return;
    setNameIn(name);
    setHoldName(true);
    commitName(name, parts);
    const after = conceptKeyOf(name);
    if (after && after.key !== before?.key) drawConceptLines(after.key, parts);
  };
  // Lines drawn once the players stand where this play has them (a side picked turns the formation first).
  useEffect(() => {
    if (!pendingConcept || !offNodes.length) return;
    const d = conceptDrawing(pendingConcept.key);
    setPendingConcept(null);
    if (!d) return;
    setStrokes(drawConcept(d, offNodes, ballX, pendingConcept.side));
    setUserDrew(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConcept, nodeKey]);
  // A play of theirs opened with nothing drawn starts with the coach's drawing of its concept.
  const openedConcept = useRef(false);
  useEffect(() => {
    if (openedConcept.current || !theirNaming || !offNodes.length) return;
    openedConcept.current = true;
    if ((saved?.strokes as PlayStroke[] | undefined)?.length) return;
    const k = conceptKeyOf(nameIn);
    if (k && conceptDrawing(k.key)) setPendingConcept({ key: k.key, side: sideOf(nameParts) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey]);
  const conceptSaver = conceptDrawingSaver();
  const nowConcept = theirNaming ? conceptKeyOf(nameIn) : null;
  const saveConcept = () => {
    if (!nowConcept || !conceptSaver) return;
    const lines = captureConcept(offNodes, strokes, ballX);
    if (!lines.length) {
      setConceptNote('Draw the lines first, then save them.');
      return;
    }
    conceptSaver(nowConcept.key, { key: nowConcept.key, label: nowConcept.label, side: sideOf(nameParts), lines, savedAt: Date.now() });
    setConceptNote(`Saved. ${nowConcept.label} is drawn like this whenever you pick it (turned over the other way).`);
    window.setTimeout(() => setConceptNote(''), 5000);
  };
  const forgetConcept = () => {
    if (!nowConcept || !conceptSaver || !window.confirm(`Forget your drawing of ${nowConcept.label}? Plays already drawn keep their lines.`)) return;
    conceptSaver(nowConcept.key, null);
    setConceptNote(`${nowConcept.label} draws the standard way again.`);
    window.setTimeout(() => setConceptNote(''), 5000);
  };

  // The 3D homography overlay, saved with the play (declared before currentState, which reads it).
  const [showHomography, setShowHomography] = useState<boolean>(() => Boolean(saved?.showHomography || saved?.homographyFrameUrl));
  const [homographyQuad, setHomographyQuad] = useState<HomographyQuad>(
    () => (saved?.homographyQuad as HomographyQuad) || DEFAULT_HOMOGRAPHY_QUAD,
  );
  const [homographyFrameUrl, setHomographyFrameUrl] = useState<string | null>(() => saved?.homographyFrameUrl || null);

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
      ...(Object.keys(jobs).length ? { jobs } : {}),
      ...(defShow === 'number' ? { defenseShow: 'number' as const } : {}),
      ...(defenseOwn ? { defenseOwn: true } : {}),
      ...(pressure ? { defensePressure: pressure } : {}),
      ...(coverage ? { defenseCoverage: coverage } : {}),
      ...(Object.keys(defAssign).length ? { defenseAssign: defAssign } : {}),
      ...(Object.keys(defRules).length ? { defenseRules: defRules } : {}),
      defenseMirror,
      defenseUnit: defUnit,
      ...(Object.keys(defWho).length ? { defenseWho: defWho } : {}),
      ...(Object.keys(taggedWho).length ? { defensePlayers: taggedWho } : {}),
      ...(userDrew || strokes.length > 0 ? { strokes } : {}),
      ...(seed?.gameId
        ? { filmSpots: { backfield: activeBack, ...(shape.spots ? { spots: shape.spots } : {}), ...(shape.baseKey ? { baseKey: shape.baseKey } : {}) } }
        : {}),
      ...(homographyQuad ? { homographyQuad } : {}),
      ...(homographyFrameUrl ? { homographyFrameUrl } : {}),
      ...(showHomography ? { showHomography: true } : {}),
      name: nameIn,
  });
  const stateKey = JSON.stringify(currentState());
  // Drawing their formation: each change saves itself a moment later, so leaving (Back) never loses it.
  const openedKey = useRef(stateKey);
  useEffect(() => {
    if (stateKey === openedKey.current && !saved) return;
    onStateChange?.(currentState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);
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
      const x = Math.max(-FILM_SPOT_MAX_X, Math.min(FILM_SPOT_MAX_X, xField));
      spots[n.role] = { x: strength === 'Left' ? -x : x, y: n.y };
    }
    return spots;
  };
  const backfieldLabel = BACKFIELD_STRUCTURES[activeBack]?.hudlBackfield || activeBack;
  const publishBackfield = (announce = true) => {
    if (!seed?.gameId || !onSaveFilmBackfield) return;
    const spots = currentBackfieldSpots();
    setFilmBases((prev) => ({ ...prev, [activeBack]: spots }));
    setFilmBaseKeys((prev) => ({ ...prev, [activeBack]: baseKey }));
    setOwnSpots({ backfield: activeBack, spots, baseKey });
    setOverrides((prev) => {
      const next = { ...prev };
      for (const role of FILM_BACKFIELD_ROLES) delete next[role];
      return next;
    });
    onSaveFilmBackfield({ gameId: seed.gameId, backfield: activeBack, spots, baseKey });
    if (announce) setBaseNote(`Saved. Every ${backfieldLabel} play on this scouting report uses this formation. Tight or wide stays on each play.`);
  };
  /**
   * Beast (or any backfield) edited for this film: another play that selects it
   * lines up the same way, including the formation it was saved on.
   */
  const chooseBackfield = (key: string) => {
    if (seed?.gameId && shapeFor(key).spots) {
      const aligned = openFormation(key, shapeFor(key).baseKey);
      setPersonnelPick(aligned.personnel);
      setBaseKey(aligned.baseKey);
      setOverrides({});
    }
    setBackfieldKey(key);
  };

  const saveFormation = (announce: boolean) => {
    if (!play || !seed?.formationEdit || !onSaveFormation) return;
    const builder = currentState();
    const name = (nameIn.trim() || seed.name).slice(0, 80);
    onSaveFormation({
      id: seed.formationEdit.id,
      name,
      builder: { ...builder, name },
      diagramUrl: diagramSvg(play, [], [], String(ball)),
      // Our defense lined up against it, as it stands on the field, with any drawn blitzes/drops/stunts.
      defenseUrl: dLook ? diagramSvg(play, [...callStrokes, ...strokes], dNodes, String(ball)) : '',
      defenseName: callName,
    });
    setBaseNote(announce ? `Saved ${name}. Their plays drawn from it start lined up like this.` : `Saved ${name} (changes save as you go).`);
  };
  autoSave.current = () => saveFormation(false);

  // What's on screen as last saved (or as it opened, once it settles): anything else is unsaved.
  const stateKeyRef = useRef(stateKey);
  stateKeyRef.current = stateKey;
  const savedKey = useRef(stateKey);
  const [, setSaveTick] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => {
      savedKey.current = stateKeyRef.current;
      setSaveTick((n) => n + 1);
    }, 400);
    return () => window.clearTimeout(t);
  }, []);
  const unsaved = stateKey !== savedKey.current;
  const saveNow = (auto = false) => {
    saveOffense(auto);
    savedKey.current = stateKeyRef.current;
    setSaveTick((n) => n + 1);
  };
  // Changed on the film (a player moved, the field lined up): kept like a drawing.
  const videoEdited = useRef(false);
  /**
   * Leaving the play (another page, Back, Previous / Next) saves it when it changed. A new play is only
   * added when something was drawn for it (or changed on the film).
   */
  const saveOnLeave = useRef<() => void>(() => {});
  saveOnLeave.current = () => {
    if (!canEdit || !play || seed?.backfieldEdit || stateKeyRef.current === savedKey.current) return;
    if (formationMode) {
      saveFormation(false);
      savedKey.current = stateKeyRef.current;
      return;
    }
    if (!seed?.playEntryId && !userDrew && !videoEdited.current) return;
    saveNow(true);
  };
  useEffect(() => () => saveOnLeave.current(), []);
  const step = (go?: () => void) => {
    if (!go) return;
    saveOnLeave.current();
    go();
  };
  const saveOffense = (auto = false) => {
    // Saved by itself (leaving the play, Previous / Next) or by the button.
    const add = (e: PlayDatabaseEntry) => onAdd(e, { auto });
    if (formationMode) {
      saveFormation(true);
      return;
    }
    if (defenseMode) {
      if (!play) return;
      commitName();
      const name = (nameIn.trim() || committedName || seed?.name || 'Defense').slice(0, 120);
      const blitzing = strokes.some((st) => dNodes.some((n) => lineStartsOn(st, n, [...offNodes, ...dNodes])) && st.points.some((p) => p.y > 0));
      add({
        builder: currentState(),
        ...newPlayEntry(name, 'defense'),
        unit: 'defense',
        type: blitzing ? 'blitz' : 'coverage',
        formation: dLook?.front || '',
        category: 'Play builder',
        source: 'builder',
        notes: dLook ? `${dLook.front} ${dLook.shell}` : '',
        diagramUrl: diagramSvg(play, [...callStrokes, ...strokes], dNodes, String(ball)),
        assignments: dNodes.map((n) => ({ pos: n.role, text: jobOf(n) || (dLook ? `${dLook.front} ${dLook.shell}` : '') })),
      });
      return;
    }
    if (seed?.backfieldEdit) {
      publishBackfield();
      return;
    }
    // A player moved on this play stays on this play; "Use this backfield for every play" shares it with the film.
    if (!play) return;
    const calledHole = hole;
    const holeData = calledHole != null ? HOLE_SYSTEM[calledHole] : play.metadata.holeData;
    const vs = lookName || undefined;
    commitName();
    const name = (nameIn.trim() || committedName || play.playName).slice(0, 120);
    const type: PlayType = inferPlayType(name, 'offense');
    // The defense as it stands on the screen: lined up on the offense, moved by the coach.
    const extra = dNodes;
    const builder = currentState();
    add({
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
      diagramUrl: diagramSvg(play, [...callStrokes, ...strokes], extra, String(ball)),
      assignments: [
        ...play.nodes.map((n) => ({
          pos: n.role,
          text: assignmentText(strokes, n, [...play.nodes, ...extra]) || (n.role === '1' ? 'QB' : n.role === '2' ? 'FB' : n.role === '3' ? 'RB' : n.role === '4' ? 'Wing / extra back' : n.line ? 'On the line' : 'Off the line'),
        })),
        ...(dLook
          ? extra.map((n) => ({ pos: n.role, text: jobOf(n) || `${dLook.front} ${dLook.shell} · ${dLook.notes}` }))
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
    if (defenseMode) {
      commitName();
      return;
    }
    const p = parsePlayCall(nameIn);
    // Asked for: draw the play from the call (their plays too).
    setUserDrew(false);
    let bk = baseKey;
    const locs = p.personnel != null ? TE_LOCATIONS[p.personnel] || [] : [];
    // Only another personnel (or "over" asked for) picks a new formation spot: the same personnel keeps the
    // one on the field, and with it every player the coach placed and the lines drawn from them.
    const overNow = locs.find((l) => l.id === 'over')?.baseKey === baseKey;
    const newSpot = p.personnel !== personnelPick || (Boolean(p.tackleOver) && !overNow);
    if (p.personnel != null && locs.length && newSpot) {
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

  // Vision-to-Play-Builder Auto-Sketch: reads pre-snap + post-snap frames from the active video and maps
  // formation alignment + play paths onto the field.
  const [autoSketching, setAutoSketching] = useState(false);
  const [sketchStatus, setSketchStatus] = useState('');
  const [sketchBanner, setSketchBanner] = useState<{ text: string; isError?: boolean } | null>(null);
  const [playAnimTrigger, setPlayAnimTrigger] = useState(0);
  // Full screen: Run (in the presentation's controls) plays the play on the field.
  const runSeen = useRef(stage.run);
  useEffect(() => {
    if (stage.run === runSeen.current) return;
    runSeen.current = stage.run;
    setPlayAnimTrigger((n) => n + 1);
  }, [stage.run]);

  const runAutoSketch = async () => {
    if (autoSketching) return;
    const vid = getVideo?.() || (typeof document !== 'undefined' ? document.querySelector('video') : null);
    if (!vid || !(vid.currentSrc || vid.src)) {
      setSketchBanner({ text: 'Open a play with linked video in the Film Player first, then click Auto-Sketch.', isError: true });
      return;
    }
    setAutoSketching(true);
    setSketchBanner(null);
    setSketchStatus('Reading video frames…');
    try {
      const sketch = await autoSketchPlayFromVideo(vid, {
        currentName: nameIn,
        gameId: seed?.gameId,
        playOdk: seed?.odk,
        onStatus: (s) => setSketchStatus(s),
      });
      const fits = compatibleBackfields(sketch.baseKey);
      const pickedBack = fits.includes(sketch.backfield) ? sketch.backfield : fits[0] || sketch.backfield;
      // Update lastLook ref first so the formation-change effect doesn't wipe the AI-detected player overrides.
      lastLook.current = `${sketch.baseKey}|${pickedBack}`;
      setPersonnelPick(sketch.personnel);
      setBaseKey(sketch.baseKey);
      setBackfieldKey(pickedBack);
      setStrength(sketch.strength);
      setHash(sketch.hash);
      setFamily(sketch.family);
      setRunId(sketch.runId);
      setHoleOverride(sketch.hole);
      setBallCarrier(sketch.ball);
      setTags(sketch.tags);
      if (sketch.defenseKey && looks[sketch.defenseKey]) {
        setDefenseKey(sketch.defenseKey);
      }
      setOverrides(sketch.overrides || {});
      if (sketch.quad) {
        setHomographyQuad(sketch.quad);
      }
      if (sketch.frameDataUrl) {
        setHomographyFrameUrl(sketch.frameDataUrl);
        setShowHomography(true);
      }
      if (sketch.strokes && sketch.strokes.length > 0) {
        const mappedStrokes: PlayStroke[] = sketch.strokes.map((s) => ({
          kind: s.kind,
          color: s.motion === 1 ? '#38bdf8' : s.kind === 'run' ? '#ef4444' : s.kind === 'pass' ? '#f59e0b' : '#94a3b8',
          motion: s.motion === 1 ? 1 : undefined,
          points: s.points,
        }));
        setStrokes(mappedStrokes);
      }
      setUserDrew(true);
      if (sketch.suggestedCall && !nameIn.trim()) {
        setNameIn(sketch.suggestedCall);
        setHoldName(true);
        commitName(sketch.suggestedCall);
      }
      setSketchBanner({
        text: `✨ ${sketch.summary} (${sketch.confidence}% confidence)`,
      });
    } catch (err: any) {
      setSketchBanner({
        text: err?.message || 'Could not auto-sketch play from video.',
        isError: true,
      });
    } finally {
      setAutoSketching(false);
      setSketchStatus('');
    }
  };

  const callLabel = runMode
    ? `${/^[1-4]$/.test(String(ball)) && hole != null ? `${ball}${hole}` : ball} ${run.label}`
    : `${ball} ${play?.metadata.concept || ''}`;
  const summary: { tab: BuilderTab; text: string }[] = [
    { tab: 'formation', text: `${personnelPick} personnel · ${backfieldLabel}` },
    { tab: 'formation', text: `Strength ${strength} · ${hash === 'Middle' ? 'Mid' : hash} hash` },
    { tab: 'play', text: `${eligibleName(String(ball))} ${hole != null ? `→ ${hole} hole` : ''} · ${runMode ? run.label : play?.metadata.concept || ''}` },
    { tab: 'notes', text: dLook ? `vs ${callName}` : 'No defense' },
  ];

  // The play on the film (play lines): to the Film Room that opened it, or for a film window beside it. Sent again
  // only when something in it changes.
  const allLines = [...strokes, ...callStrokes];
  const videoLinesKey = JSON.stringify([diagramNodes, allLines, ball, homographyQuad, callLabel]);
  const linesOwner = useRef({});
  useEffect(() => {
    const lines: VideoLines = {
      nodes: diagramNodes,
      strokes: allLines,
      ballRole: String(ball),
      quad: homographyQuad,
      setQuad: (q) => {
        // Picked up from the film's lineup isn't the coach's change; turning or sizing it is.
        if (!q.fromFilm) videoEdited.current = true;
        setHomographyQuad(q);
      },
      // Players dragged on the film ride in the lineup (quad.moved), so the diagram stays as drawn.
      name: callLabel.trim(),
    };
    if (onVideoLines) onVideoLines(lines);
    else publishPlayLines(linesOwner.current, lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoLinesKey]);
  useEffect(() => () => publishPlayLines(linesOwner.current, null), []);

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
    { id: 'jobs', label: 'Jobs', icon: <ListChecks className="w-4 h-4" /> },
    { id: 'players', label: 'Players', icon: <Users className="w-4 h-4" /> },
    { id: 'notes', label: 'Game plan', icon: <ClipboardList className="w-4 h-4" /> },
  ];

  return (
    <section
      className={
        compact
          ? 'bg-white dark:bg-slate-900 p-2.5 space-y-3'
          : staged
            ? 'space-y-0'
            : present
            ? `bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3 ${fieldOnly ? 'p-2' : 'p-3'}`
            : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4'
      }
    >
      {/* The call: type it the way it is called and the field draws it. */}
      <div className={`space-y-2 ${fieldOnly ? 'hidden' : ''}`}>
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
              placeholder={formationMode ? 'Name their formation, e.g. Trips Rt or 21 Beast R' : defenseMode ? 'Name the defensive call, e.g. 4-4 Stack Fire' : 'Type the call, e.g. 32 L WB 44 ZONE'}
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
            {holdName && !seed?.scoutId && !formationMode && !defenseMode && (
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
            disabled={!readParts.length || defenseMode}
            title="Set the formation and play from the call (Enter)"
            className="h-11 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-30 shrink-0"
          >
            <Wand2 className="w-4 h-4" /> Draw it
          </button>
          {!defenseMode && !present && (
            <button
              type="button"
              onClick={() => void runAutoSketch()}
              disabled={autoSketching}
              title="Vision-to-Play-Builder Homography: reads the active video frame & post-snap motion to auto-sketch the formation, splits, backfield, and play routes"
              className="h-11 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Sparkles className={`w-4 h-4 ${autoSketching ? 'animate-spin' : ''}`} />
              <span>{autoSketching ? sketchStatus || 'Auto-Sketching…' : 'Auto-Sketch from Video'}</span>
            </button>
          )}
          {!defenseMode && !present && (
            <button
              type="button"
              onClick={() => setShowHomography((v) => !v)}
              title="Open 3D Video Homography Calibrator: overlay a perspective-warped football field grid onto the video frame and drag players in camera space"
              className={`h-11 px-3 rounded-xl border text-xs sm:text-sm font-black inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                showHomography
                  ? 'border-indigo-500 bg-indigo-950 text-indigo-200 shadow-sm'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
              }`}
            >
              <span>📐</span>
              <span>3D Field Homography</span>
            </button>
          )}
          {seed?.scoutId && !formationMode && onStartFromFormation && canEdit && (
            <label className="h-11 pl-3 pr-1 rounded-xl border border-slate-300 dark:border-slate-600 inline-flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-300 shrink-0">
              Starts from
              <select
                aria-label="Their formation this play starts from"
                value={seed.formationId || ''}
                disabled={!seed.theirFormations?.length}
                title={seed.theirFormations?.length ? 'Line this play up in one of their formations, then draw it' : 'Draw their formations first (Their plays, step 1)'}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id || id === seed.formationId) return;
                  const name = seed.theirFormations?.find((f) => f.id === id)?.name || 'that formation';
                  if (userDrew && strokes.length && !window.confirm(`Start this play over from ${name}? The lines drawn on it are cleared.`)) return;
                  // Started over: what's on screen now isn't saved on the way out.
                  savedKey.current = stateKeyRef.current;
                  onStartFromFormation(id);
                }}
                className="h-9 max-w-[180px] rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white px-2 cursor-pointer disabled:opacity-50"
              >
                <option value="">{seed.theirFormations?.length ? 'Pick their formation…' : 'No formations drawn yet'}</option>
                {(seed.theirFormations || []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Back to their base formation as it was drawn: players where the base has them, no lines. */}
          {seed?.scoutId && !formationMode && onStartFromFormation && canEdit && (
            <button
              type="button"
              disabled={!seed.formationId || !seed.theirFormations?.some((f) => f.id === seed.formationId)}
              title={
                seed.formationId && seed.theirFormations?.some((f) => f.id === seed.formationId)
                  ? 'Put this play back to its base formation (players where you drew the base, lines cleared)'
                  : 'Draw this play’s formation first (Their plays, step 1), or pick one in Starts from'
              }
              onClick={() => {
                const id = seed.formationId;
                if (!id) return;
                const name = seed.theirFormations?.find((f) => f.id === id)?.name || 'its base formation';
                if ((strokes.length || Object.keys(overrides).length) && !window.confirm(`Reset this play to ${name}? The lines and player moves on it are cleared.`)) return;
                // Started over: what's on screen now isn't saved on the way out.
                savedKey.current = stateKeyRef.current;
                onStartFromFormation(id);
              }}
              className="h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-black text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-default shrink-0"
            >
              <RotateCcw className="w-4 h-4" /> Reset to base
            </button>
          )}
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
          {!compact && nav && (
            <div className="inline-flex items-center h-11 rounded-xl border border-slate-300 dark:border-slate-600 overflow-hidden shrink-0">
              <button
                type="button"
                aria-label="Previous play"
                title="Previous play (saves this one)"
                disabled={!nav.onPrev}
                onClick={() => step(nav.onPrev)}
                className="h-full px-2.5 inline-flex items-center gap-1 text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-35 disabled:cursor-default"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="h-full px-2 border-x border-slate-200 dark:border-slate-700 inline-flex items-center text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">{nav.label}</span>
              <button
                type="button"
                aria-label="Next play"
                title="Next play (saves this one)"
                disabled={!nav.onNext}
                onClick={() => step(nav.onNext)}
                className="h-full px-2.5 inline-flex items-center gap-1 text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-35 disabled:cursor-default"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {canEdit && (
            <button
              type="button"
              disabled={!play || (!unsaved && Boolean(seed?.playEntryId || formationMode))}
              onClick={() => saveNow()}
              title={seed?.playEntryId || formationMode ? 'Saves by itself when you leave this play' : 'Add this play to the library (it also adds itself when you leave after drawing it)'}
              className={`h-11 px-4 rounded-xl text-sm font-black inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                !unsaved && (seed?.playEntryId || formationMode)
                  ? 'border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 cursor-default'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40'
              }`}
            >
              {!unsaved && (seed?.playEntryId || formationMode) ? (
                <>
                  <Check className="w-4 h-4" /> Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> {formationMode ? 'Save formation' : defenseMode ? 'Save defense' : seed?.backfieldEdit ? `Save ${backfieldLabel}` : seed?.playEntryId ? 'Save' : 'Save play'}
                </>
              )}
            </button>
          )}
        </div>
        {sketchBanner && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              sketchBanner.isError
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'
                : 'bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800'
            }`}
          >
            <span>{sketchBanner.text}</span>
            <div className="flex items-center gap-2">
              {!sketchBanner.isError && (
                <button
                  type="button"
                  onClick={() => setPlayAnimTrigger((n) => n + 1)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-black text-white shadow-xs cursor-pointer"
                  title="Animate the offensive & defensive player movement for this play"
                >
                  ▶ Play Player Movement
                </button>
              )}
              <button type="button" onClick={() => setSketchBanner(null)} className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer">
                Dismiss
              </button>
            </div>
          </div>
        )}
        <div className={`flex flex-wrap items-center gap-1.5 text-[11px] min-h-6 ${defenseMode || present ? 'hidden' : ''}`}>
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

      <div className={compact || panelHidden ? 'space-y-3' : `grid grid-cols-1 ${present ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : 'lg:grid-cols-[minmax(0,1fr)_380px]'} gap-4 items-start`}>
        {/* The field */}
        <div className="relative space-y-2 min-w-0">
          {present && !staged && (
            // Presenting: the field alone; these bring back the editing tools and the Formation / Play / Jobs panel.
            <div className="absolute top-2 right-2 z-20 flex gap-1.5">
              <button
                type="button"
                aria-pressed={editing}
                onClick={() => setEditing(!editing)}
                title={editing ? 'Hide the call and the drawing tools' : 'Show the call, Save and the drawing tools (Route, Run, Block, Motion)'}
                className={`h-9 pointer-coarse:h-11 px-3 rounded-lg text-xs font-black inline-flex items-center gap-1.5 shadow-sm border cursor-pointer ${
                  editing ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/95 dark:bg-slate-900/95 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" /> {editing ? 'Done' : 'Edit'}
              </button>
              <button
                type="button"
                aria-pressed={panelOpen}
                onClick={() => setPanelOpen(!panelOpen)}
                title={panelOpen ? 'Hide Formation / Play / Jobs: the field gets the whole width' : 'Show Formation / Play / Jobs / Players beside the field'}
                className={`h-9 pointer-coarse:h-11 px-3 rounded-lg text-xs font-black inline-flex items-center gap-1.5 shadow-sm border cursor-pointer ${
                  panelOpen ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/95 dark:bg-slate-900/95 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                }`}
              >
                {panelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />} Formation · Play · Jobs
              </button>
            </div>
          )}
          {(formationMode || defenseMode) && !staged && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300/70 dark:border-emerald-700/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-1.5">
              <span className="w-full text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">{defenseMode ? 'Our defensive call' : 'Our defense vs it'}{dLook ? `: ${callName}` : ''}</span>
              <div className="w-full">{defensePicker(false, !defenseMode)}</div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {defenseMode
                  ? 'Drag defenders where they line up. Pick Route, Run or Block and draw from a defender for blitzes, stunts and drops. Formation tab: the offense to draw it against.'
                  : dLook
                    ? 'Drag our defenders where they line up against this formation. Pick Route, Run or Block to draw blitzes, stunts, and drops. It saves as you go.'
                    : 'Pick our defense to line it up against this formation.'}
              </span>
              {defaultButtons}
            </div>
          )}
          {dNodes.length > 0 && hasDepth && !fieldOnly && (
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
              {defUnit !== 'off' && (
                <div role="group" aria-label="What the defenders show" className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Show</span>
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-black">
                    {(['position', 'number'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={defShow === v}
                        onClick={() => setDefShow(v)}
                        className={`h-7 px-2.5 cursor-pointer transition-colors ${
                          defShow === v
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {v === 'position' ? 'Position' : 'Number'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {defUnit !== 'off' && <span className="hidden lg:inline text-[11px] text-slate-400">Hover a defender to see who plays there</span>}
            </div>
          )}
          <div className={`${fieldOnly ? 'hidden' : 'hidden sm:flex'} flex-wrap gap-1.5`}>
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
          {showHomography && (
            <VideoHomographyOverlay
              getVideo={() => getVideo?.() || (typeof document !== 'undefined' ? document.querySelector('video') : null)}
              initialFrameUrl={homographyFrameUrl}
              quad={homographyQuad}
              onChangeQuad={setHomographyQuad}
              nodes={diagramNodes}
              strokes={[...strokes, ...callStrokes]}
              ballRole={String(ball)}
              onMoveNode={(role, x, y) => {
                setOverrides((prev) => ({ ...prev, [role]: { x, y } }));
              }}
              onRunAutoSketch={() => void runAutoSketch()}
              autoSketchBusy={autoSketching}
              playTrigger={playAnimTrigger}
              onClose={() => setShowHomography(false)}
            />
          )}
          {play ? (
            <PlayDiagramCanvas
              playTrigger={playAnimTrigger}
              extraStrokes={callStrokes}
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
              drawFor={defenseMode || (formationMode && Boolean(dLook)) ? 'defense' : 'offense'}
              ballRole={String(ball)}
              formLabel=""
              playLabel={callLabel}
              vsLabel={dLook ? dLook.front : '—'}
              coachNote={coachNote}
              onCoachNote={setCoachNote}
              onMove={(role, x, y) => {
                setOverrides((prev) => ({ ...prev, [role]: { x, y } }));
              }}
              onStrokes={(next) => {
                setUserDrew(true);
                setStrokes(next);
              }}
              onReset={() => {
                setOverrides({});
                if (!theirPlay) setUserDrew(false);
              }}
              linesFollow={userDrew}
              dense={compact}
              maxFieldHeight={staged ? STAGE_FIELD_HEIGHT : present ? (fieldOnly ? 'calc(100dvh - 6.5rem)' : 'calc(100dvh - 17.5rem)') : undefined}
              tools={!fieldOnly}
              bare={staged}
              locked={staged}
              presentZoom={Boolean(present)}
              chrome="minimal"
              assignmentHost={host}
              onSelectPlayer={(n) => {
                // A defender: his rules in the Jobs tab. Anyone else: the Players tab.
                if (n && isDefenseRole(n.role) && dLook) {
                  setPickedDef(n.role);
                  setTab('jobs');
                } else if (n) setTab('players');
              }}
              onBallCarrierChange={(role) => setBallCarrier(role)}
              onHoleChange={(h) => setHoleOverride(h)}
              onLabelChange={renamePlayer}
              defenseWho={
                dLook && hasDepth
                  ? {
                      tagging,
                      // Hover: who plays the spot in each unit; the unit on the field (with any hand pick) is marked.
                      everyUnit: (role) => {
                        const spot = defenseSpotName(role, defFront, strongLeft);
                        return DEF_UNITS.map((u) => ({
                          id: u.id as 'black' | 'gold' | 'blue',
                          unit: u.label,
                          player: tagging && u.id === defUnit ? taggedWho[role] || null : defensePlayerAt(spot, u.id, defFront, rosterSrc),
                          on: tagging && u.id === defUnit,
                        }));
                      },
                      current: (role) => ({
                        player: tagging ? taggedWho[role] || null : null,
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
          {baseNote && !staged && <p className="px-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">{baseNote}</p>}
          {!formationMode && !staged && !!seed?.scoutId && !!seed.sameCall?.length && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Also drawn as {seed.name} ({seed.sameCall.length})
                </span>
                {onOpenSameCall && <span className="text-[11px] text-slate-400">Click one to open it</span>}
              </div>
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {seed.sameCall.map((s) => (
                  <li key={s.scoutId}>
                    <button
                      type="button"
                      disabled={!onOpenSameCall}
                      onClick={() => onOpenSameCall?.(s.scoutId, s.gameId)}
                      title={`Open this drawing of ${s.name}`}
                      className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 p-1 hover:border-indigo-400 cursor-pointer disabled:cursor-default"
                    >
                      {s.diagramUrl ? (
                        <DiagramImage url={s.diagramUrl} alt={s.name} className="w-full rounded-md bg-white" />
                      ) : (
                        <div className="h-12 rounded-md bg-slate-50 dark:bg-slate-800/60 text-[10px] text-slate-400 flex items-center justify-center">No picture</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {formationMode && !staged && !!seed?.formationPlays?.length && !!seed.gameId && (
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
        {/* Hidden (presenting), it stays mounted: a tapped player's options still have their place. */}
        <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden ${compact ? '' : 'lg:sticky lg:top-3'} ${panelHidden ? 'hidden' : ''}`}>
          <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
            {tabs.filter((t) => (t.id === 'jobs' ? (defenseMode || Boolean(dLook)) : !(formationMode || defenseMode) || t.id !== 'play')).map((t) => (
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
                  {segmented<'Left' | 'Middle' | 'Right'>(['Left', 'Middle', 'Right'], hash, pickHash, (h) => (h === 'Middle' ? 'Mid' : h[0]))}
                </div>
              </div>

              {canEdit && seed?.gameId && !seed.backfieldEdit && onSaveFilmBackfield && (
                <button
                  type="button"
                  disabled={!play}
                  onClick={() => publishBackfield()}
                  className="w-full h-9 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer disabled:opacity-40"
                >
                  Use this {backfieldLabel} for the plays on this report you haven't changed
                </button>
              )}
              <p className="text-[11px] text-slate-400">Drag any player on the field to move the spot.</p>
            </div>
          )}

          {tab === 'play' && (
            <div className="p-3.5 space-y-4">
              {theirNaming && (
                <div className="space-y-2">
                  {label(
                    'Play name',
                    <span className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-[11px] font-black">
                      {(['run', 'pass'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={nameRun === (v === 'run')}
                          onClick={() => setNameRun(v === 'run')}
                          title={v === 'run' ? 'A run: ball carrier and hole, run concepts' : 'A pass: pass concepts'}
                          className={`h-7 px-2.5 capitalize cursor-pointer ${nameRun === (v === 'run') ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </span>
                  )}
                  <PlayNameFields parts={nameParts} name={nameIn} readOnly={!canEdit} run={nameRun} onChange={pickNameParts} custom={seed?.nameOptions || NO_OPTIONS} />
                  {nowConcept && canEdit && (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 space-y-1.5">
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {conceptDrawing(nowConcept.key)
                          ? `${nowConcept.label} is drawn your way when you pick it. Adjust the lines and save again to change it.`
                          : `Adjust the lines for ${nowConcept.label}, then save: the next play you pick it on is drawn the same.`}
                      </div>
                      {conceptSaver ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={saveConcept}
                            title="Every play you pick this concept on (for this ball carrier) starts with these lines, turned over to the side it goes"
                            className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer"
                          >
                            Save as my {nowConcept.label}
                          </button>
                          {conceptDrawing(nowConcept.key) && (
                            <>
                              <button
                                type="button"
                                onClick={() => setPendingConcept({ key: nowConcept.key, side: sideOf(nameParts) })}
                                title="Put my saved lines for this concept back on this play"
                                className="h-8 px-2 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-[11px] font-black cursor-pointer"
                              >
                                Draw my {nowConcept.label}
                              </button>
                              <button type="button" onClick={forgetConcept} className="h-8 px-2 rounded-lg text-[11px] font-bold text-rose-600 cursor-pointer" title="Forget my drawing of this concept">
                                Forget
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500">A head coach of this team can save concept drawings.</div>
                      )}
                      {conceptNote && <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{conceptNote}</div>}
                    </div>
                  )}
                </div>
              )}
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

          {tab === 'jobs' && (defenseMode || Boolean(dLook)) && (
            <div className="p-3.5 space-y-3">
              <div>
                <div className="text-sm font-black text-slate-900 dark:text-white">{dLook ? lookName : 'Pick a front'}</div>
                {dLook && <div className="text-xs text-slate-500 dark:text-slate-400">{dLook.notes}</div>}
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Tap a defender (here or on the field) to set his rules. A technique moves him; a drop, blitz or slant draws his line.
                </p>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {defenseOrder(dNodes).map((n) => {
                  const open = pickedDef === n.role;
                  const job = jobOf(n);
                  const standard = dLook ? standardDefenseJob(n.role, dLook, containFor(dLook.front)) : '';
                  const who = n.player ? `#${n.player.num} ${n.player.name}`.trim() : '';
                  const own = Boolean(jobs[n.role] || defAssign[n.role] || Object.keys(defRules[n.role] || {}).length);
                  return (
                    <li key={n.role} className="py-1.5">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${n.role} rules`}
                        onClick={() => setPickedDef(open ? null : n.role)}
                        className="w-full flex items-center gap-2 text-left cursor-pointer rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60 px-1 py-0.5"
                      >
                        <span
                          className={`shrink-0 min-w-9 h-6 px-1.5 rounded bg-green-700 text-white text-[11px] font-black inline-flex items-center justify-center ${
                            open ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : ''
                          }`}
                        >
                          {shownText(n, diagramLabel(n.role))}
                        </span>
                        <span className="min-w-0 flex-1">
                          {who && <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{who}</span>}
                          <span className={`block text-sm truncate ${own ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                            {job || 'Tap to set his rules'}
                          </span>
                        </span>
                        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && (
                        <DefenderRules
                          node={n}
                          picks={defRules[n.role] || {}}
                          assign={defAssign[n.role] || ''}
                          ball={ballX}
                          typed={jobs[n.role] || ''}
                          standard={standard}
                          onPick={(cat, opt) => {
                            setDefRules((prev) => {
                              const mine = { ...(prev[n.role] || {}) };
                              if (opt) mine[cat] = opt;
                              else delete mine[cat];
                              const next = { ...prev };
                              if (Object.keys(mine).length) next[n.role] = mine;
                              else delete next[n.role];
                              return next;
                            });
                            // A technique lines him up there on their line, wherever he was dragged.
                            if (cat === 'tech') {
                              setOverrides((prev) => {
                                const next = { ...prev };
                                delete next[n.role];
                                return next;
                              });
                            }
                          }}
                          onAssign={(jobId) =>
                            setDefAssign((prev) => {
                              const next = { ...prev };
                              if (jobId) next[n.role] = jobId;
                              else delete next[n.role];
                              return next;
                            })
                          }
                          onTyped={(text) =>
                            setJobs((prev) => {
                              const next = { ...prev };
                              if (text.trim()) next[n.role] = text;
                              else delete next[n.role];
                              return next;
                            })
                          }
                          onReset={() => {
                            const without = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([r]) => r !== n.role));
                            setDefRules(without);
                            setDefAssign(without);
                            setJobs(without);
                            if (defRules[n.role]?.tech) setOverrides(without);
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Always mounted: the field puts its "who does what" panel here. */}
          <div ref={setHost} className={tab === 'players' ? '' : 'hidden'} />

          {tab === 'notes' && (
            <div className="p-3.5 space-y-4">
              <div>
                {label('Our defense on the diagram')}
                {defensePicker(true, true)}
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
