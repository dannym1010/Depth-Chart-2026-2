// /api/league: the league site (Taconic Youth Football): finds the schedule, results and standings files it posts, and
// passes a file through so the app can read it (the file host doesn't allow the browser to fetch it directly).
// Only this site and its file host are ever fetched.

const SITE = 'https://www.taconicyfc.com/Default.aspx?tabid=';
const PAGES = { schedule: '2251500', results: '2251501', standings: '2251502' } as const;
const FILE_HOST = 'dt5602vnjxv0c.cloudfront.net';
const FILE_PATH = '/portals/13652/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface LeagueLink {
  text: string;
  url: string;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export const allowedFile = (raw: string) => {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname === FILE_HOST && u.pathname.toLowerCase().startsWith(FILE_PATH);
  } catch {
    return false;
  }
};

/** The file links on one of the league's pages, with their link text ("Week 5 Results"). */
async function pageLinks(tabid: string): Promise<LeagueLink[]> {
  const res = await fetch(SITE + tabid, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`League site answered ${res.status}`);
  const html = await res.text();
  const out: LeagueLink[] = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const url = decode(m[1]).replace(/ /g, '%20');
    if (!allowedFile(url) || !/\.(pdf|xlsx?)$/i.test(url.split('?')[0])) continue;
    if (!out.some((l) => l.url === url)) out.push({ text: decode(m[2]) || decodeURIComponent(url.split('/').pop() || ''), url });
  }
  return out;
}

export async function leagueIndex() {
  const [schedule, results, standings] = await Promise.all([pageLinks(PAGES.schedule), pageLinks(PAGES.results), pageLinks(PAGES.standings)]);
  return { schedule, results, standings };
}

export async function leagueFile(url: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  if (!allowedFile(url)) throw Object.assign(new Error('Only the league site files can be fetched.'), { status: 400 });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`League file answered ${res.status}`);
  return { bytes: await res.arrayBuffer(), type: res.headers.get('content-type') || 'application/octet-stream' };
}

/** One handler for both the Express server and Vercel: ?what=index, or ?file=<league file url>. */
export async function handleLeague(query: Record<string, unknown>, res: any) {
  try {
    if (typeof query.file === 'string') {
      const f = await leagueFile(query.file);
      res.setHeader('Content-Type', f.type);
      res.setHeader('Cache-Control', 'public, max-age=600');
      return res.status(200).send(Buffer.from(f.bytes));
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(await leagueIndex());
  } catch (err: any) {
    return res.status(err?.status || 502).json({ error: err?.message || 'Could not reach the league site.' });
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  return handleLeague(req.query || {}, res);
}
