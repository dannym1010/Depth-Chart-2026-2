// Each scouting film keeps its own backfield shapes. Adjusting Beast on that film
// redraws every play on that film that lines up in Beast.
import type { PlayBuilderState, PlayDatabaseEntry } from '../types/callSheet';
import { callSetup, drawCall } from './callDiagram';
import { unsavedDiagram } from './playDiagrams';
import { playNameKey } from './playbookImport';
import {
  BACKFIELD_STRUCTURES,
  BASE_FORMATIONS,
  OUR_DEFENSE_LOOKS,
  PLAY_CONCEPTS,
  RUN_SCHEMES,
  TE_LOCATIONS,
  lineStartsOn,
  applyNodeOverrides,
  autoDrawPlay,
  isDefenseRole,
  conceptFamily,
  diagramSvg,
  eligiblePlayers,
  isValidEleven,
  resolveTaggedCall,
  tryAssemblePlay,
  type BackfieldSpots,
  type PlayStroke,
} from './footballEngine';
import { formationKey, type OppFormation, type ScoutOppPlay } from './scoutOppPlays';
import { baseLookKey, defenseMirrored, lineUpOurDefense } from '../hudlScout/utils/ourDefense';
import { defenseCallStrokes } from './defenseCalls';
import { pickedTechniques } from './defenseRules';

export interface FilmBackfieldBase {
  spots: BackfieldSpots;
  editedAt: number;
  /** Formation the receiver spots were measured on. Another play can still pick tight or wide. */
  baseKey?: string;
}

/** game id -> backfield key -> that film's spots. */
export type FilmBackfieldBases = Record<string, Record<string, FilmBackfieldBase>>;

export function mergeBackfieldBases(a?: FilmBackfieldBases, b?: FilmBackfieldBases): FilmBackfieldBases | undefined {
  const games = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out: FilmBackfieldBases = {};
  for (const gameId of games) {
    const keys = new Set([...Object.keys(a?.[gameId] || {}), ...Object.keys(b?.[gameId] || {})]);
    const game: Record<string, FilmBackfieldBase> = {};
    for (const key of keys) {
      const left = a?.[gameId]?.[key];
      const right = b?.[gameId]?.[key];
      const pick = (Number(right?.editedAt) || 0) >= (Number(left?.editedAt) || 0) ? right || left : left;
      if (pick?.spots) game[key] = pick;
    }
    if (Object.keys(game).length) out[gameId] = game;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Spots only, for the builder (no editedAt). */
export function spotsForGame(bases: FilmBackfieldBases | undefined, gameId?: string): Record<string, BackfieldSpots> | undefined {
  const game = gameId ? bases?.[gameId] : undefined;
  if (!game) return undefined;
  const out: Record<string, BackfieldSpots> = {};
  for (const [key, base] of Object.entries(game)) if (base?.spots) out[key] = base.spots;
  return Object.keys(out).length ? out : undefined;
}

/** Which formation each saved backfield was measured on. */
export function baseKeysForGame(bases: FilmBackfieldBases | undefined, gameId?: string): Record<string, string> | undefined {
  const game = gameId ? bases?.[gameId] : undefined;
  if (!game) return undefined;
  const out: Record<string, string> = {};
  for (const [key, base] of Object.entries(game)) if (base?.baseKey) out[key] = base.baseKey;
  return Object.keys(out).length ? out : undefined;
}

/** The backfield a play lines up in: the one saved on it, otherwise the one its name calls. */
export function backfieldOf(card: ScoutOppPlay, entry?: PlayDatabaseEntry | null): string {
  return entry?.builder?.backfield || callSetup(card).backfield;
}

/** The formation to open: the one this film's backfield was saved on, otherwise a formation it can line up in. */
export function openFormation(backfield: string, savedBaseKey?: string): { personnel: number; baseKey: string } {
  const saved = savedBaseKey ? BASE_FORMATIONS[savedBaseKey] : undefined;
  if (saved && savedBaseKey && isValidEleven(savedBaseKey, backfield)) return { personnel: saved.personnel, baseKey: savedBaseKey };
  return formationForBackfield(backfield);
}

/** A formation this backfield can line up in, so the base can be drawn on its own. */
export function formationForBackfield(backfield: string): { personnel: number; baseKey: string } {
  const personnel = BACKFIELD_STRUCTURES[backfield]?.allowedPersonnel?.[0] || 32;
  const locs = TE_LOCATIONS[personnel] || [];
  const baseKey = locs.find((l) => isValidEleven(l.baseKey, backfield))?.baseKey || locs[0]?.baseKey || '32_WISHBONE';
  return { personnel, baseKey };
}

const FILM_ROLES = new Set(['1', '2', '3', '4', 'X', 'Z', 'Y', 'W', 'H', 'Y1', 'Y2', 'W1', 'W2']);

/** Redraw one opponent play with this film's backfield spots. Those players' own spots are cleared so the play follows the film. Tight or wide stays on the play. */
export function redrawWithBackfield(
  entry: PlayDatabaseEntry,
  card: ScoutOppPlay,
  backfield: string,
  spots: BackfieldSpots | undefined,
  spotBaseKey?: string,
  /** Our defense from their formation, in place of the play's own. */
  ourDefense?: DefenseSetting | null,
  /** Keep the play's own formation and moved players (only the defense is changing). */
  keepOffense = false
): PlayDatabaseEntry {
  const b = ourDefense && entry.builder ? builderWithDefense(entry.builder, ourDefense) : entry.builder;
  const setup = callSetup(card);
  const formed = spotBaseKey && BASE_FORMATIONS[spotBaseKey] ? spotBaseKey : '';
  const baseKey = (keepOffense && b?.baseKey) || formed || b?.baseKey || setup.baseKey;
  const strength = b?.strength || setup.strength;
  const tags = b?.tags || [];
  const family = b?.family && b.family !== 'all' ? b.family : setup.family;
  const run = RUN_SCHEMES.find((r) => r.id === (b?.runId || setup.run)) || RUN_SCHEMES[0];
  const conceptKey = family === 'run' ? run.conceptKey : b?.conceptKey || Object.keys(PLAY_CONCEPTS).find((k) => conceptFamily(PLAY_CONCEPTS[k]) === family) || run.conceptKey;
  const play = tryAssemblePlay(baseKey, backfield, conceptKey, strength, tags, spots, spotBaseKey);
  if (!play) return entry;
  const overrides = { ...(b?.overrides || {}) };
  if (!keepOffense) for (const role of FILM_ROLES) delete overrides[role];
  const hashDx = b?.hash === 'Left' ? -4.2 : b?.hash === 'Right' ? 4.2 : 0;
  const names = b?.labels || {};
  const named = <T extends { role: string }>(n: T): T => (names[n.role] ? { ...n, label: names[n.role] } : n);
  const nodes = applyNodeOverrides(play.nodes, overrides).map((n) => named(overrides[n.role] ? n : { ...n, x: n.x + hashDx }));
  const concept = PLAY_CONCEPTS[conceptKey];
  const eligibles = eligiblePlayers(nodes);
  const ball = eligibles.some((n) => n.role === (b?.ball || setup.ball)) ? b?.ball || setup.ball : eligibles.find((n) => n.role === '3')?.role || eligibles[0]?.role || '1';
  const tagged = resolveTaggedCall({
    hole: play.metadata.targetHole,
    primaryBack: Number(concept?.primaryBack) || 3,
    family: concept ? conceptFamily(concept) : 'run',
    tags,
    hasBack: (n) => nodes.some((p) => p.role === String(n)),
  });
  const calledHole = b && b.hole !== '' ? b.hole : setup.hole === '' ? tagged.hole : setup.hole;
  const hole = typeof calledHole === 'number' ? calledHole : null;
  const runMode = family === 'run';
  const drawTags = runMode && run.id === 'keep' && ball === '1' && !tags.includes('Keep') ? [...tags, 'Keep'] : tags;
  const strokes = autoDrawPlay({
    nodes,
    hole,
    primaryBack: ball,
    concept: runMode ? run.label : concept?.concept || '',
    scheme: concept?.scheme || '',
    tags: drawTags,
    family: runMode ? 'run' : tagged.family,
  });
  const lookKey = ourDefense?.key || (b ? b.defenseKey : setup.personnel >= 30 ? '53_C3' : strength === 'Right' ? '44_C3_RIP' : '44_C3_LIZ');
  if (ourDefense && !b) Object.assign(overrides, ourDefense.moves);
  // Our defense as the coach set it in the builder: lined up on this formation, moved defenders kept,
  // and the lines drawn for defenders kept (the offense's lines are drawn again).
  const look = lookKey ? (OUR_DEFENSE_LOOKS[lookKey] || OUR_DEFENSE_LOOKS[baseLookKey(lookKey)])?.nodes || [] : [];
  const whoByRole = b?.defensePlayers || ourDefense?.players || {};
  // The whole defense moves with the ball to the hash, then the line sets on the offense (no second shift).
  const flip = defenseMirrored(b);
  const defense = applyNodeOverrides(lineUpOurDefense(lookKey, look, nodes, { hashDx, flip, techs: pickedTechniques(b?.defenseRules) }), overrides).map((n) => {
    const moved = named(n);
    return whoByRole[n.role] ? { ...moved, player: whoByRole[n.role], ...(b?.defenseShow === 'number' ? { show: 'number' as const } : {}) } : moved;
  });
  // A different defense than the one the lines were drawn for: its lines don't belong to these defenders.
  const savedStrokes = ourDefense && entry.builder?.defenseKey !== ourDefense.key ? [] : (b?.strokes as PlayStroke[] | undefined) || [];
  const defenseStrokes = savedStrokes.filter(
    (st) => st.points?.length && defense.some((d) => isDefenseRole(d.role) && lineStartsOn(st, d, [...nodes, ...defense]))
  );
  const allStrokes = [...strokes, ...defenseStrokes];
  const builder: PlayBuilderState = {
    personnel: BASE_FORMATIONS[baseKey]?.personnel || b?.personnel || setup.personnel,
    baseKey,
    backfield,
    conceptKey,
    runId: b?.runId || setup.run,
    family: family === 'option' || family === 'screen' || family === 'pass' ? family : 'run',
    strength,
    hash: b?.hash || 'Middle',
    hole: b?.hole ?? setup.hole,
    ball: String(ball),
    tags,
    coachNote: b?.coachNote || card.notes || '',
    situations: b?.situations || [],
    defenseKey: lookKey,
    putDefInName: Boolean(b?.putDefInName),
    overrides,
    ...(b?.labels ? { labels: b.labels } : {}),
    ...(b?.defenseUnit ? { defenseUnit: b.defenseUnit } : {}),
    ...(b?.defenseWho ? { defenseWho: b.defenseWho } : {}),
    ...(b?.defensePlayers ? { defensePlayers: b.defensePlayers } : {}),
    ...(b?.strokes ? { strokes: allStrokes } : {}),
    ...((b?.defensePressure ?? ourDefense?.pressure) ? { defensePressure: b?.defensePressure ?? ourDefense?.pressure } : {}),
    ...((b?.defenseCoverage ?? ourDefense?.coverage) ? { defenseCoverage: b?.defenseCoverage ?? ourDefense?.coverage } : {}),
    ...((b?.defenseAssign ?? ourDefense?.assign) ? { defenseAssign: b?.defenseAssign ?? ourDefense?.assign } : {}),
  };
  const call = defenseCallStrokes(defense, nodes, builder.defensePressure, builder.defenseCoverage, builder.defenseAssign);
  return {
    ...entry,
    builder,
    diagramUrl: diagramSvg({ ...play, nodes }, [...call, ...allStrokes], defense, String(ball)),
    editedAt: Date.now(),
  };
}

/**
 * The picture of one of their plays: as saved from the builder (with our defense as the coach set it),
 * redrawn on this film's backfield when one is saved, or drawn from its name.
 */
export function oppPlayDiagram(
  play: ScoutOppPlay,
  playDatabase: PlayDatabaseEntry[] = [],
  bases?: FilmBackfieldBases,
  /** Their formations: a play shows the defense set on its formation. */
  formations?: OppFormation[]
): string | undefined {
  const entry = playDatabase.find((p) => p.id === `scout_${play.id}`);
  const d = formationDefense(formationOfPlay(play, formations), playDatabase);
  if (d) {
    const drawn = playWithDefense(entry || ({ id: `scout_${play.id}`, name: play.name, diagramUrl: '' } as PlayDatabaseEntry), play, d, bases);
    if (drawn.diagramUrl) return drawn.diagramUrl;
  }
  // Drawn in the builder: exactly what was saved there (a film backfield change already saved it again).
  if (entry?.builder && entry.diagramUrl) return entry.diagramUrl;
  const backfield = backfieldOf(play, entry);
  const base = bases?.[play.gameId]?.[backfield];
  if (base?.spots) {
    const drawn = redrawWithBackfield(
      entry || ({ id: `scout_${play.id}`, name: play.name, diagramUrl: '' } as PlayDatabaseEntry),
      play,
      backfield,
      base.spots,
      base.baseKey
    );
    if (drawn.diagramUrl) return drawn.diagramUrl;
  }
  return entry?.diagramUrl || unsavedDiagram(playNameKey(play.name)) || drawCall(play, base?.spots, base?.baseKey) || undefined;
}

/** The play a play type is drawn on: the first one the coach drew in the builder, else the first one. */
export function leadOppPlay(plays: ScoutOppPlay[], playDatabase: PlayDatabaseEntry[] = []): ScoutOppPlay {
  return plays.find((p) => playDatabase.some((e) => e.id === `scout_${p.id}` && e.builder)) || plays[0];
}

/** Our defense against one of their formations: the look, defenders the coach moved, and who's tagged in. */
export interface DefenseSetting {
  key: string;
  moves: Record<string, { x: number; y: number }>;
  players?: PlayBuilderState['defensePlayers'];
  unit?: PlayBuilderState['defenseUnit'];
  who?: PlayBuilderState['defenseWho'];
  strokes?: PlayStroke[];
  /** The call on top of the front: blitz / stunt and coverage (drawn from the picks). */
  pressure?: string;
  coverage?: string;
  assign?: Record<string, string>;
  /** Each defender's rules (technique, gap, fit...) and his job in the coach's words. */
  rules?: Record<string, Record<string, string>>;
  jobs?: Record<string, string>;
}

const lookRoles = (key?: string) => {
  const look = key ? OUR_DEFENSE_LOOKS[key] || OUR_DEFENSE_LOOKS[baseLookKey(key)] : undefined;
  return new Set((look?.nodes || []).map((n) => n.role));
};

/**
 * The defense set on their formation: the one drawn on it in the builder, else the base call from
 * "Our calls vs their formations" (that defensive play's front).
 */
export function formationDefense(f: OppFormation | null | undefined, playDatabase: PlayDatabaseEntry[] = []): DefenseSetting | null {
  if (!f || f.deleted) return null;
  const b = f.builder;
  if (b?.defenseKey) {
    const roles = lookRoles(b.defenseKey);
    const moves = Object.fromEntries(Object.entries(b.overrides || {}).filter(([role]) => roles.has(role) || isDefenseRole(role)));
    return { key: b.defenseKey, moves, players: b.defensePlayers, unit: b.defenseUnit, who: b.defenseWho, strokes: b.strokes as PlayStroke[] | undefined, pressure: b.defensePressure, coverage: b.defenseCoverage, assign: b.defenseAssign, rules: b.defenseRules, jobs: b.jobs };
  }
  const base = f.plan?.base ? playDatabase.find((p) => p.id === f.plan!.base)?.builder?.defenseKey : '';
  return base ? { key: base, moves: {} } : null;
}

/** Their formation a play belongs to: the one it was drawn from, else the one with its formation's name. */
export function formationOfPlay(card: ScoutOppPlay, formations?: OppFormation[]): OppFormation | undefined {
  const live = (formations || []).filter((f) => f?.id && !f.deleted);
  return (card.formationId && live.find((f) => f.id === card.formationId)) || (card.formation ? live.find((f) => formationKey(f.name) === formationKey(card.formation)) : undefined);
}

/**
 * Whether a play has to change to show the formation's defense. Another defense: yes. The same one: only to
 * pick up the formation's moved defenders when the play hasn't moved any of its own.
 */
function defenseDiffers(b: PlayBuilderState, d: DefenseSetting): boolean {
  // A defense the coach picked for this play stays.
  if (b.defenseOwn) return false;
  if (b.defenseKey !== d.key) return true;
  if ((b.defensePressure || '') !== (d.pressure || '') || (b.defenseCoverage || '') !== (d.coverage || '')) return true;
  if (JSON.stringify(b.defenseAssign || {}) !== JSON.stringify(d.assign || {})) return true;
  if (JSON.stringify(b.defenseRules || {}) !== JSON.stringify(d.rules || {})) return true;
  if (JSON.stringify(b.jobs || {}) !== JSON.stringify(d.jobs || {})) return true;
  // Defense lines drawn on the formation (a blitz, a drop) that the play doesn't have yet.
  const mine = ((b.strokes as PlayStroke[] | undefined) || []).map((st) => JSON.stringify(st.points));
  if ((d.strokes || []).some((st) => !mine.includes(JSON.stringify(st.points)))) return true;
  const roles = lookRoles(d.key);
  const ownMoves = Object.keys(b.overrides || {}).some((r) => roles.has(r));
  return !ownMoves && Object.keys(d.moves).length > 0;
}

/** The play's builder with the formation's defense (offense untouched). */
export function builderWithDefense(b: PlayBuilderState, d: DefenseSetting): PlayBuilderState {
  if (!defenseDiffers(b, d)) return b;
  const defRoles = new Set([...lookRoles(b.defenseKey), ...lookRoles(d.key)]);
  const offense = Object.fromEntries(Object.entries(b.overrides || {}).filter(([role]) => !defRoles.has(role) && !isDefenseRole(role)));
  const { defensePlayers: _p, defenseWho: _w, defensePressure: _pr, defenseCoverage: _cv, defenseAssign: _as, defenseRules: _ru, jobs: _jb, ...rest } = b;
  return {
    ...rest,
    defenseKey: d.key,
    ...(d.pressure ? { defensePressure: d.pressure } : {}),
    ...(d.coverage ? { defenseCoverage: d.coverage } : {}),
    ...(d.assign && Object.keys(d.assign).length ? { defenseAssign: d.assign } : {}),
    ...(d.rules && Object.keys(d.rules).length ? { defenseRules: d.rules } : {}),
    ...(d.jobs && Object.keys(d.jobs).length ? { jobs: d.jobs } : {}),
    overrides: { ...offense, ...d.moves },
    ...(d.unit ? { defenseUnit: d.unit } : {}),
    ...(d.who ? { defenseWho: d.who } : {}),
    ...(d.players ? { defensePlayers: d.players } : {}),
  };
}

/**
 * One of their plays against the defense set on its formation. A play drawn in the builder keeps its own
 * lines and spots exactly (only the defense changes); one never drawn is drawn from its name on the film's
 * backfield. Unchanged when the play already shows that defense.
 */
export function playWithDefense(entry: PlayDatabaseEntry, card: ScoutOppPlay, d: DefenseSetting, bases?: FilmBackfieldBases): PlayDatabaseEntry {
  const b0 = entry.builder;
  if (b0 && !defenseDiffers(b0, d)) return entry;
  const backfield = b0?.backfield || backfieldOf(card, entry);
  const film = bases?.[card.gameId]?.[backfield];
  // Lines drawn by the play's own rules (never hand-drawn): drawn again, the way a film backfield change does.
  if (!b0?.strokes) return redrawWithBackfield(entry, card, backfield, film?.spots, film?.baseKey, d, Boolean(b0));
  const b = builderWithDefense(b0, d);
  const concept = b.family === 'all' || b.family === 'run' ? (RUN_SCHEMES.find((r) => r.id === b.runId) || RUN_SCHEMES[0]).conceptKey : b.conceptKey;
  const basePlay = tryAssemblePlay(b.baseKey, backfield, concept, b.strength, b.tags || [], film?.spots, film?.baseKey);
  if (!basePlay) return entry;
  // The same steps as the builder: offense spots, then our defense lined up on it.
  const hashDx = b.hash === 'Left' ? -4.2 : b.hash === 'Right' ? 4.2 : 0;
  const names = b.labels || {};
  const place = <T extends { role: string; x: number }>(n: T, ov: Record<string, unknown>): T => {
    const moved = ov[n.role] ? n : { ...n, x: n.x + hashDx };
    return names[n.role] ? { ...moved, label: names[n.role] } : moved;
  };
  const offNodes = applyNodeOverrides(basePlay.nodes, b.overrides).map((n) => place(n, b.overrides));
  const lineUp = (key: string, ov: Record<string, { x: number; y: number }>, from: PlayBuilderState) => {
    const look = OUR_DEFENSE_LOOKS[key] || OUR_DEFENSE_LOOKS[baseLookKey(key)];
    if (!look) return [];
    // Moved with the ball to the hash, then lined up on the offense (no second shift).
    const flip = defenseMirrored(from);
    return applyNodeOverrides(lineUpOurDefense(key, look.nodes, offNodes, { hashDx, flip, techs: pickedTechniques(from.defenseRules) }), ov).map((n) => (names[n.role] ? { ...n, label: names[n.role] } : n));
  };
  // The old defenders' lines go with them; the offense's lines stay as drawn.
  const oldDefense = lineUp(b0.defenseKey, b0.overrides || {}, b0);
  // A line is the old defense's when it starts on a defender, not on the blocker a yard across from him.
  const startsOnOld = (st: PlayStroke) => oldDefense.some((n) => lineStartsOn(st, n, [...offNodes, ...oldDefense]));
  const offenseStrokes = (b0.strokes as PlayStroke[]).filter((st) => !startsOnOld(st));
  const defStrokes = d.strokes || [];
  const strokes = [...offenseStrokes, ...defStrokes];
  const who = b.defensePlayers || {};
  const defense = lineUp(d.key, b.overrides, b).map((n) => (who[n.role] ? { ...n, player: who[n.role], ...(b.defenseShow === 'number' ? { show: 'number' as const } : {}) } : n));
  return {
    ...entry,
    builder: { ...b, strokes },
    diagramUrl: diagramSvg({ ...basePlay, nodes: offNodes }, [...defenseCallStrokes(defense, offNodes, b.defensePressure, b.defenseCoverage, b.defenseAssign), ...strokes], defense, String(b.ball)),
  };
}
