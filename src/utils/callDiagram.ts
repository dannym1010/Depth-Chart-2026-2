// A play drawn from its name alone, the way the play builder first draws it: "30 DW 41 SWEEP" lined
// up in 30 personnel and the Double Wing, the 4 back taking it to the 1 hole, against our defense.
// Used where a play has no saved diagram yet (the scout script), and to open the builder.
import {
  OUR_DEFENSE_LOOKS,
  PERSONNEL_DEFINITIONS,
  PLAY_CONCEPTS,
  RUN_SCHEMES,
  TE_LOCATIONS,
  autoDrawPlay,
  compatibleBackfields,
  conceptFamily,
  diagramSvg,
  eligiblePlayers,
  resolveTaggedCall,
  tryAssemblePlay,
  type BackfieldSpots,
} from './footballEngine';
import { parsePlayCall } from './playCallParse';

const PERSONNEL = /\b(10|11|12|20|21|22|30|31|32)\b/;

export interface CallSetup {
  personnel: number;
  baseKey: string;
  backfield: string;
  strength: 'Left' | 'Right';
  /** The back with the ball ('1'-'4'). */
  ball: string;
  /** The hole called ('' = the play's own). */
  hole: number | '';
  /** A RUN_SCHEMES id. */
  run: string;
  family: 'run' | 'pass' | 'screen' | 'option';
}

/** How the builder lines a call up: personnel, formation, side, the back to the hole, the play. */
export function callSetup(call: { name: string; formation?: string; personnel?: string; kind?: string }): CallSetup {
  const named = parsePlayCall(call.name);
  const form = parsePlayCall(call.formation || '');
  const fromField = String(call.personnel || '').match(PERSONNEL);
  const personnel = named.personnel ?? form.personnel ?? Number(fromField?.[1] || 21);
  const locs = TE_LOCATIONS[personnel] || [];
  const base = ((named.tackleOver || form.tackleOver) && locs.find((l) => l.id === 'over')) || locs.find((l) => l.id === 'tight') || locs[0];
  const baseKey = base?.baseKey || '21_PRO';
  const fits = compatibleBackfields(baseKey);
  const wanted = named.backfields.length ? named.backfields : form.backfields;
  const family = named.family || (call.kind === 'pass' || call.kind === 'screen' ? call.kind : 'run');
  return {
    personnel,
    baseKey,
    backfield: wanted.find((k) => fits.includes(k)) || fits[0] || 'I_FORM',
    strength: named.strength || form.strength || 'Left',
    ball: named.ball || '3',
    hole: named.hole ?? '',
    run: named.run || 'zone',
    family,
  };
}

/** The diagram (an SVG picture) of a play drawn from its name, against our call for it. Null when it can't be lined up. */
export function drawCall(
  call: { name: string; formation?: string; personnel?: string; kind?: string },
  spots?: BackfieldSpots | null,
  spotBaseKey?: string | null
): string | null {
  const s = callSetup(call);
  const runMode = s.family === 'run';
  const run = RUN_SCHEMES.find((r) => r.id === s.run) || RUN_SCHEMES[0];
  const conceptKey = runMode ? run.conceptKey : Object.keys(PLAY_CONCEPTS).find((k) => conceptFamily(PLAY_CONCEPTS[k]) === s.family) || run.conceptKey;
  const play = tryAssemblePlay(s.baseKey, s.backfield, conceptKey, s.strength, [], spots, spotBaseKey);
  const concept = PLAY_CONCEPTS[conceptKey];
  if (!play || !concept) return null;
  const eligibles = eligiblePlayers(play.nodes);
  const ball = eligibles.some((n) => n.role === s.ball) ? s.ball : eligibles.find((n) => n.role === '3')?.role || eligibles[0]?.role || '1';
  const tagged = resolveTaggedCall({
    hole: play.metadata.targetHole,
    primaryBack: concept.primaryBack || 3,
    family: conceptFamily(concept),
    tags: [],
    hasBack: (n) => play.nodes.some((p) => p.role === String(n)),
  });
  const hole = s.hole === '' ? tagged.hole : s.hole;
  const tags = runMode && run.id === 'keep' && ball === '1' ? ['Keep'] : [];
  const strokes = autoDrawPlay({
    nodes: play.nodes,
    hole,
    primaryBack: ball,
    concept: runMode ? run.label : concept.concept,
    scheme: concept.scheme,
    tags,
    family: runMode ? 'run' : tagged.family,
  });
  // Our call for it: the 5-3 against two tight ends, else the 4-4 set to their strength.
  const lookKey = (PERSONNEL_DEFINITIONS[s.personnel]?.te || 0) >= 2 ? '53_C3' : s.strength === 'Right' ? '44_C3_RIP' : '44_C3_LIZ';
  return diagramSvg(play, strokes, OUR_DEFENSE_LOOKS[lookKey]?.nodes || [], ball);
}
