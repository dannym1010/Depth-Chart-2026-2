import type { Express } from 'express';
// The code lives in the Vercel function (which can't import other files), and the local server uses it too.
import { handleLeague } from '../../api/league';

export function registerLeagueRoutes(app: Express) {
  // The league's schedule / results / standings files (see api/league.ts).
  app.get('/api/league', (req, res) => handleLeague(req.query as Record<string, unknown>, res));
}
