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
  alignDefenseTechniques,
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
import type { ScoutOppPlay } from './scoutOppPlays';

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
  spots: BackfieldSpots,
  spotBaseKey?: string
): PlayDatabaseEntry {
  const b = entry.builder;
  const setup = callSetup(card);
  const formed = spotBaseKey && BASE_FORMATIONS[spotBaseKey] ? spotBaseKey : '';
  const baseKey = formed || b?.baseKey || setup.baseKey;
  const strength = b?.strength || setup.strength;
  const tags = b?.tags || [];
  const family = b?.family && b.family !== 'all' ? b.family : setup.family;
  const run = RUN_SCHEMES.find((r) => r.id === (b?.runId || setup.run)) || RUN_SCHEMES[0];
  const conceptKey = family === 'run' ? run.conceptKey : b?.conceptKey || Object.keys(PLAY_CONCEPTS).find((k) => conceptFamily(PLAY_CONCEPTS[k]) === family) || run.conceptKey;
  const play = tryAssemblePlay(baseKey, backfield, conceptKey, strength, tags, spots, spotBaseKey);
  if (!play) return entry;
  const overrides = { ...(b?.overrides || {}) };
  for (const role of FILM_ROLES) delete overrides[role];
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
  const lookKey = b ? b.defenseKey : setup.personnel >= 30 ? '53_C3' : strength === 'Right' ? '44_C3_RIP' : '44_C3_LIZ';
  // Our defense as the coach set it in the builder: lined up on this formation, moved defenders kept,
  // and the lines drawn for defenders kept (the offense's lines are drawn again).
  const look = lookKey ? OUR_DEFENSE_LOOKS[lookKey]?.nodes || [] : [];
  const defense = applyNodeOverrides(alignDefenseTechniques(look, nodes), overrides).map((n) => named(overrides[n.role] ? n : { ...n, x: n.x + hashDx }));
  const savedStrokes = (b?.strokes as PlayStroke[] | undefined) || [];
  const defenseStrokes = savedStrokes.filter(
    (st) => st.points?.length && defense.some((d) => isDefenseRole(d.role) && Math.hypot(st.points[0].x - d.x, st.points[0].y - d.y) < 1.4)
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
    defenseKey: b?.defenseKey ?? lookKey,
    putDefInName: Boolean(b?.putDefInName),
    overrides,
    ...(b?.labels ? { labels: b.labels } : {}),
    ...(b?.strokes ? { strokes: allStrokes } : {}),
  };
  return {
    ...entry,
    builder,
    diagramUrl: diagramSvg({ ...play, nodes }, allStrokes, defense, String(ball)),
    editedAt: Date.now(),
  };
}

/**
 * The picture of one of their plays: as saved from the builder (with our defense as the coach set it),
 * redrawn on this film's backfield when one is saved, or drawn from its name.
 */
export function oppPlayDiagram(play: ScoutOppPlay, playDatabase: PlayDatabaseEntry[] = [], bases?: FilmBackfieldBases): string | undefined {
  const entry = playDatabase.find((p) => p.id === `scout_${play.id}`);
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
