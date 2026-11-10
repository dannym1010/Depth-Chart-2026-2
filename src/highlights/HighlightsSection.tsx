// The Highlights section as App shows it: this team's highlights for the season (shared or this computer only),
// our games and their plays from Hudl Scout, and the film from the team's film folder.
import React, { useCallback, useMemo, useState } from 'react';
import type { HighlightAccess } from '../types';
import type { Play } from '../hudlScout/types/football';
import { bundleFromSaved } from '../hudlScout/scoutBundle';
import { filmGameKey, mergeShared, sharedDocId } from '../filmroom/sharedMerge';
import { emptyShared, type FilmGameShared } from '../filmroom/types';
import { useSharedGame } from '../filmroom/useSharedGame';
import { getFirebaseServices, isFirestoreQuotaPaused, safeJSONParse } from '../services/storageService';
import { realFilmAccess } from './filmAccess';
import { seasonOf, type Kid } from './highlightData';
import { HighlightsView } from './HighlightsView';
import { FamilyHighlights } from './FamilyHighlights';
import type { HighlightGame } from './types';
import { useDeviceHighlights, useHighlights } from './useHighlights';

interface Props {
  teamId: string;
  teamName: string;
  ownTeamScout?: unknown;
  roster: Kid[];
  userEmail: string;
  authorName: string;
  /** A player's or family's account: their kid's clips and the reels shared with families, to watch. */
  watchOnly?: boolean;
  /** Their kid(s), by jersey number. */
  myKids?: string[];
  /** What a coach let this player / family account do here (Staff & access → Highlights). */
  level?: HighlightAccess;
}

export const HighlightsSection: React.FC<Props> = ({ teamId, teamName, ownTeamScout, roster, userEmail, authorName, watchOnly, myKids, level = 'kid' }) => {
  const season = seasonOf();
  // A family's Highlights helper saves to the team's highlights like a coach.
  const helper = Boolean(watchOnly) && level === 'helper';
  const store = useHighlights(teamId, season, { helper });
  // A helper switches between the team's highlights and their own family page (remembered on this device).
  const [helperView, setHelperView] = useState<'team' | 'family'>(() => {
    try {
      return localStorage.getItem('highlightsHelperView') === 'family' ? 'family' : 'team';
    } catch {
      return 'team';
    }
  });
  const switchTo = (v: 'team' | 'family') => {
    setHelperView(v);
    try {
      localStorage.setItem('highlightsHelperView', v);
    } catch {
      /* ignore */
    }
  };
  const helperSwitch = helper ? (
    <span className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-bold" role="group" aria-label="Which highlights">
      {(['team', 'family'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => switchTo(v)}
          aria-pressed={helperView === v}
          className={`h-8 px-3 ${helperView === v ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
        >
          {v === 'team' ? 'Team highlights (helper)' : 'My family page'}
        </button>
      ))}
    </span>
  ) : null;
  // A parent's or player's own highlights, on their device only (their account can't save to the team's).
  const mine = useDeviceHighlights(teamId, season, watchOnly ? userEmail : '');
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

  if (watchOnly && !(helper && helperView === 'team'))
    return (
      <FamilyHighlights
        seeAll={level === 'all' || helper}
        extra={helperSwitch}
        teamName={teamName}
        season={season}
        store={store}
        mine={mine}
        access={access}
        loadShared={loadShared}
        games={games}
        plays={plays}
        roster={roster}
        kids={myKids || []}
        me={userEmail.toLowerCase().trim()}
      />
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
      helper={helper}
      extra={helperSwitch}
    />
  );
};
