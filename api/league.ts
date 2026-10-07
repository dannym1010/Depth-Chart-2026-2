import { handleLeague } from '../server/leagueSite';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  return handleLeague(req.query || {}, res);
}
