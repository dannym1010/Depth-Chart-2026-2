// A game with film in the film folder but no Hudl breakdown yet: each clip stands in for one play, in the
// clips' order, so the film can be watched (and noted and drawn on) before the plays are uploaded.
import type { Play } from '../hudlScout/types/football';
import type { FilmClip } from './types';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function playsFromClips(clips: FilmClip[], gameId: string): Play[] {
  const used = new Set<string>();
  return clips.map((c, i) => {
    const name = c.name.replace(/\.[^.]+$/, '');
    // Named by the clip (so notes stay with it), numbered if two clips share a name.
    let id = `clip-${slug(name) || i + 1}`;
    if (used.has(id)) id = `${id}-${i + 1}`;
    used.add(id);
    return {
      id,
      playNumber: i + 1,
      odk: 'UNKNOWN',
      quarter: 0,
      down: 0,
      distance: 0,
      yardLine: 0,
      rawYardLine: '',
      yardLineSide: 'MID',
      fieldZone: 'own_territory',
      hash: 'M',
      playType: 'OTHER',
      formation: '',
      backfield: '',
      motion: '',
      playName: name,
      direction: '',
      gainLoss: 0,
      result: '',
      personnel: '',
      carrierOrTarget: '',
      isExplosive: false,
      isEfficient: false,
      runSide: 'M',
      gameId,
    } as Play;
  });
}
