import type { Express } from 'express';
import { handleLeague } from '../leagueSite';

export function registerLeagueRoutes(app: Express) {
  // The league's schedule / results / standings files (see server/leagueSite.ts).
  app.get('/api/league', (req, res) => handleLeague(req.query as Record<string, unknown>, res));
}
