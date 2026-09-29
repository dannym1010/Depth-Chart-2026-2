// Short text for a Hudl play (the title over the video).
import type { Play } from '../hudlScout/types/football';

/** Hudl fills empty cells with "-". */
const clean = (v?: string) => (v && v.trim() !== '-' ? v : '');

const downDist = (p: Play) => (p.down ? `${p.down}&${p.distance ?? ''}` : '');
const playCallText = (p: Play) => clean(p.playCall) || clean(p.playName) || clean(p.hudlCall);

/** "#12 · Q2 · 2&6 · Trips Rt · Jet Sweep" */
export const playTitle = (p: Play) =>
  [`#${p.playNumber}`, p.quarter ? `Q${p.quarter}` : '', downDist(p), clean(p.formation), playCallText(p)].filter(Boolean).join(' · ');
