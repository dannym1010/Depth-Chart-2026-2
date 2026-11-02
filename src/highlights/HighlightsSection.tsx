// The Highlights section as App shows it: this team's highlights for the season (shared or this computer only),
// our games and their plays from Hudl Scout, and the film from the team's film folder.
import React, { useCallback, useMemo } from 'react';
import type { Play } from '../hudlScout/types/football';
import { bundleFromSaved } from '../hudlScout/scoutBundle';
import { filmGameKey, mergeShared, sharedDocId } from '../filmroom/sharedMerge';
import { emptyShared, type FilmGameShared } from '../filmroom/types';
import { useSharedGame } from '../filmroom/useSharedGame';
import { getFirebaseServices, isFirestoreQuotaPaused, safeJSONParse } from '../services/storageService';
import { realFilmAccess } from './filmAccess';
import { seasonOf, type Kid } from './highlightData';
import { HighlightsView } from './HighlightsView';
import type { HighlightGame } from './types';
import { useHighlights } from './useHighlights';

interface Props {
  teamId: string;
  teamName: string;
  ownTeamScout?: unknown;
  roster: Kid[];
  userEmail: string;
  authorName: string;
}

export const HighlightsSection: React.FC<Props> = ({ teamId, teamName, ownTeamScout, roster, userEmail, authorName }) => {
  const season = seasonOf();
  const store = useHighlights(teamId, season);
  const own = useMemo(() => bundleFromSaved(ownTeamScout, teamName), [ownTeamScout, teamName]);
  const games: HighlightGame[] = useMemo(() => {
    const gone = new Set(own.deletedGameIds || []);
    return own.games.filter((g) => !gone.has(g.id)).map((g) => ({ key: filmGameKey('own', g.id), gameId: g.id, name: g.name, week: g.week }));
  }, [own]);
  const plays: Play[] = useMemo(() => {
    // Plays with no game id belong to the only game, when there's one.
    const only = own.games.length === 1 ? own.games[0].id : '';
    return own.plays.map((p) => (p.gameId || !only ? p : { ...p, gameId: only }));
  }, [own]);

  // The team film folder: this computer's copy, or the Google Drive one (its link is in the program's shared doc).
  const root = useSharedGame('program', 'root');
  const rootId = root.shared.drive?.folderId || undefined;
  const rootName = root.shared.drive?.folderName;
  const access = useMemo(() => realFilmAccess({ teamName, rootDriveId: rootId, rootDriveName: rootName }), [teamName, rootId, rootName]);

  // A game's shared Film Room data, read once: this device's copy merged with the cloud's.
  const loadShared = useCallback(
    async (gameKey: string): Promise<Partial<FilmGameShared>> => {
      const docId = sharedDocId(teamId, gameKey);
      const local = safeJSONParse<FilmGameShared>(`footballFilmroom_${docId}`, emptyShared());
      const { db } = getFirebaseServices();
      if (!db || isFirestoreQuotaPaused()) return local;
      try {
        const snap = await db.collection('teamData').doc(docId).get();
        return snap?.exists ? mergeShared(local, snap.data()) : local;
      } catch {
        return local;
      }
    },
    [teamId]
  );

  return (
    <HighlightsView
      teamName={teamName}
      season={season}
      store={store}
      access={access}
      loadShared={loadShared}
      games={games}
      plays={plays}
      roster={roster}
      me={userEmail.toLowerCase().trim()}
      myName={authorName}
    />
  );
};
