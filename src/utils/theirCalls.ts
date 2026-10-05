// Their plays (Hudl Scout → Their plays) offered when tagging their film, so the same play run again can be
// tagged with the play already made for it. Each keeps the formation it was made from.
import type { PlayDatabaseEntry } from '../types/callSheet';
import { newPlayEntry } from './playbookImport';
import type { ScoutOppPlay } from './scoutOppPlays';

const TYPE: Record<ScoutOppPlay['kind'], PlayDatabaseEntry['type']> = { run: 'run', pass: 'pass', rpo: 'rpo', screen: 'screen' };

/** Every play in Their plays (all films of this report) as a call to tag with, id scout_<card id>. */
export function theirCallEntries(libraries?: Record<string, ScoutOppPlay[]>): PlayDatabaseEntry[] {
  const seen = new Set<string>();
  const out: PlayDatabaseEntry[] = [];
  for (const card of Object.values(libraries || {}).flat()) {
    if (!card?.id || !card.name?.trim()) continue;
    const id = `scout_${card.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      ...newPlayEntry(card.name, 'offense'),
      id,
      unit: 'offense',
      type: TYPE[card.kind] || 'run',
      formation: card.formation || '',
      source: 'scout',
      category: 'Opponent plays',
    });
  }
  return out;
}
