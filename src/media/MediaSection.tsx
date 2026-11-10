// The Media section as App shows it: this team's photo folders for the season, and our games (to link a folder to
// the game it's from).
import React, { useMemo } from 'react';
import { bundleFromSaved } from '../hudlScout/scoutBundle';
import { filmGameKey } from '../filmroom/sharedMerge';
import { seasonOf } from '../highlights/highlightData';
import type { HighlightGame } from '../highlights/types';
import type { RosterPlayer } from '../types';
import { MediaView } from './MediaView';
import { useMedia } from './useMedia';

interface Props {
  teamId: string;
  teamName: string;
  ownTeamScout?: unknown;
  roster?: RosterPlayer[];
  userEmail: string;
}

export const MediaSection: React.FC<Props> = ({ teamId, teamName, ownTeamScout, roster = [], userEmail }) => {
  const season = seasonOf();
  const store = useMedia(teamId, season);
  const own = useMemo(() => bundleFromSaved(ownTeamScout, teamName), [ownTeamScout, teamName]);
  const games: HighlightGame[] = useMemo(() => {
    const gone = new Set(own.deletedGameIds || []);
    return own.games.filter((g) => !gone.has(g.id)).map((g) => ({ key: filmGameKey('own', g.id), gameId: g.id, name: g.name, week: g.week }));
  }, [own]);
  return <MediaView teamName={teamName} season={season} store={store} games={games} roster={roster} me={userEmail.toLowerCase().trim()} />;
};

