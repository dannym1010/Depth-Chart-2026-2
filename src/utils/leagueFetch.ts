// Loads the league's schedule, results and standings through /api/league (which only talks to the league
// site) and reads them with leagueParse.ts. Kept in this browser for a few hours; Refresh gets the latest.
import { parseByeRows, parseResultsText, parseScheduleRows, parseStandings, type LeagueData, type LeagueGame, type PositionedText } from './leagueParse';

interface LeagueLink {
  text: string;
  url: string;
}

const CACHE_KEY = 'league_data_v1';
const MAX_AGE = 3 * 60 * 60 * 1000;

const fileBytes = async (url: string) => {
  const res = await fetch(`/api/league?file=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Couldn't load ${decodeURIComponent(url.split('/').pop() || 'a league file')}`);
  return res.arrayBuffer();
};

async function pdfItems(bytes: ArrayBuffer): Promise<{ items: PositionedText[]; width: number }> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  }
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const items: PositionedText[] = [];
  let width = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    width = page.getViewport({ scale: 1 }).width;
    const tc = await page.getTextContent();
    for (const it of tc.items as any[]) if (typeof it.str === 'string') items.push({ str: it.str, x: it.transform[4], y: it.transform[5], page: i });
  }
  return { items, width };
}

/** The week number in a link's text or file name ("Week 5 Results"), or 0. */
const weekOf = (l: LeagueLink) => Number((`${l.text} ${decodeURIComponent(l.url)}`.match(/week\s*(\d+)/i) || [])[1]) || 0;

export function readCachedLeague(): LeagueData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as LeagueData) : null;
  } catch {
    return null;
  }
}

export const leagueIsStale = (d: LeagueData | null) => !d || Date.now() - d.fetchedAt > MAX_AGE;

export async function fetchLeague(): Promise<LeagueData> {
  const res = await fetch('/api/league?what=index');
  // An app server started before the league route was added answers with something else (not JSON).
  if (!/json/i.test(res.headers.get('content-type') || '')) {
    throw new Error('The app server needs a restart to load the league feature (close it and start it again).');
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not reach the league site.');
  const index = (await res.json()) as { schedule: LeagueLink[]; results: LeagueLink[]; standings: LeagueLink[] };

  // Schedule: the Excel file (the PDF is the same schedule).
  let schedule: LeagueGame[] = [];
  let byes: LeagueData['byes'] = [];
  const sheet = index.schedule.find((l) => /\.xlsx?$/i.test(l.url));
  if (sheet) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await fileBytes(sheet.url), { type: 'array' });
    const rows = (name: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false });
    const main = wb.SheetNames.find((n) => /schedule/i.test(n)) || wb.SheetNames[0];
    schedule = parseScheduleRows(rows(main));
    const byeSheet = wb.SheetNames.find((n) => /bye/i.test(n));
    if (byeSheet) byes = parseByeRows(rows(byeSheet));
  }

  // Every week's results.
  const resultLinks = index.results.filter((l) => /\.pdf$/i.test(l.url) && /result|score/i.test(`${l.text} ${l.url}`));
  const results = (
    await Promise.all(
      resultLinks.map(async (l) => {
        try {
          const { items } = await pdfItems(await fileBytes(l.url));
          return parseResultsText(items.map((i) => i.str), String(weekOf(l) || ''));
        } catch {
          return [];
        }
      })
    )
  ).flat();

  // The latest standings.
  const standingLinks = index.standings.filter((l) => /\.pdf$/i.test(l.url)).sort((a, b) => weekOf(b) - weekOf(a));
  let standings: LeagueData['standings'] = [];
  let standingsWeek: string | undefined;
  if (standingLinks[0]) {
    const { items, width } = await pdfItems(await fileBytes(standingLinks[0].url));
    standings = parseStandings(items, width);
    standingsWeek = String(weekOf(standingLinks[0]) || '') || undefined;
  }

  const data: LeagueData = { fetchedAt: Date.now(), schedule, results, standings, standingsWeek, byes };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: just don't keep it */
  }
  return data;
}
