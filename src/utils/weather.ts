// The weather for a scheduled game or practice, from Open-Meteo (free, no key): the town is read from the
// event's location, then the forecast for that hour. Forecasts reach about two weeks out; a past date gets
// what the weather was. Kept in this browser for an hour.

export interface EventWeather {
  /** At the start time. */
  tempF: number;
  feelsF?: number;
  /** Chance of rain or snow (%), wind (mph). */
  precipChance: number;
  windMph: number;
  code: number;
  label: string;
  icon: string;
  /** The highest chance of rain while the event runs. */
  maxPrecipChance: number;
  place: string;
}

const STATES: Record<string, string> = {
  NY: 'New York', NJ: 'New Jersey', CT: 'Connecticut', PA: 'Pennsylvania', MA: 'Massachusetts', VT: 'Vermont',
};

/**
 * The town and state in a location ("Brewster High School Field (50 Foggintown Rd, Brewster NY)" → Brewster,
 * NY). Without one, the team's home town.
 */
export function placeOf(location: string, home = 'Mahopac'): { town: string; state: string } {
  const text = String(location || '');
  // "…, Brewster NY", "…, Carmel, NY 10512", "Brewster, New York"
  const m = text.match(/([A-Za-z][A-Za-z .'-]*?),?\s+(NY|NJ|CT|PA|MA|VT|New York|New Jersey|Connecticut)\b/);
  if (m) {
    // The words after the street ("35 Angela Dr Carmel" → Carmel).
    const words = m[1].split(',').pop()!.replace(/[()]/g, ' ').trim().split(/\s+/);
    const street = words.map((w) => /^(rd|road|st|street|ave|avenue|dr|drive|ln|lane|blvd|way|hwy|route|rte|pl|place|ct|court|pkwy|tpke)\.?$/i.test(w)).lastIndexOf(true);
    const town = words.slice(street + 1).filter((w) => !/^\d/.test(w)).join(' ');
    const st = m[2].length === 2 ? m[2] : Object.keys(STATES).find((k) => STATES[k] === m[2]) || 'NY';
    if (town) return { town, state: st };
  }
  // A school or field named for its town ("Mahopac High School - Turf Field", "Carmel HS").
  const lead = text.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+(?:High|Middle|HS|MS|Elementary|Park|Field|Fields|Sports|Rec|Community)\b/);
  if (lead) return { town: lead[1], state: 'NY' };
  return { town: home, state: 'NY' };
}

/** What the weather code means, and an icon for it (WMO codes). */
export function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear', icon: '☀️' };
  if (code <= 2) return { label: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { label: 'Cloudy', icon: '☁️' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { label: code >= 65 ? 'Heavy rain' : 'Rain', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: '🌨️' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: '🌦️' };
  if (code >= 85 && code <= 86) return { label: 'Snow showers', icon: '🌨️' };
  if (code >= 95) return { label: 'Thunderstorms', icon: '⛈️' };
  return { label: 'Weather', icon: '🌡️' };
}

interface Hourly {
  time: string[];
  temperature_2m: number[];
  apparent_temperature?: number[];
  precipitation_probability: (number | null)[];
  weather_code: number[];
  wind_speed_10m: number[];
}

/** The weather from the hourly forecast at the start hour, and the most rain while it runs. */
export function weatherAt(h: Hourly, date: string, startTime: string, minutes = 120, place = ''): EventWeather | null {
  const hour = Math.max(0, Math.min(23, Number(String(startTime || '12:00').split(':')[0]) || 12));
  const key = `${date}T${String(hour).padStart(2, '0')}:00`;
  const i = h.time.indexOf(key);
  if (i < 0) return null;
  const hours = Math.max(1, Math.ceil(minutes / 60));
  const chances = h.precipitation_probability.slice(i, i + hours).map((x) => Number(x) || 0);
  const code = Number(h.weather_code[i]) || 0;
  const d = describeWeather(code);
  return {
    tempF: Math.round(h.temperature_2m[i]),
    ...(h.apparent_temperature ? { feelsF: Math.round(h.apparent_temperature[i]) } : {}),
    precipChance: Number(h.precipitation_probability[i]) || 0,
    windMph: Math.round(h.wind_speed_10m[i]),
    code,
    label: d.label,
    icon: d.icon,
    maxPrecipChance: Math.max(0, ...chances),
    place,
  };
}

const CACHE = 'eventWeather_v1';
const HOUR = 60 * 60 * 1000;
const readCache = (): Record<string, { at: number; w: EventWeather | null }> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || '{}') || {};
  } catch {
    return {};
  }
};
const writeCache = (key: string, w: EventWeather | null) => {
  try {
    const all = readCache();
    // Keep it small: drop anything over a day old.
    for (const k of Object.keys(all)) if (Date.now() - all[k].at > 24 * HOUR) delete all[k];
    all[key] = { at: Date.now(), w };
    localStorage.setItem(CACHE, JSON.stringify(all));
  } catch {
    /* storage full or blocked: just fetch again next time */
  }
};

const getJson = async (url: string) => {
  // The service sometimes answers "overloaded": one more try.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url).catch(() => null);
    if (res?.ok) return res.json();
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
};

const coords = new Map<string, Promise<{ lat: number; lon: number } | null>>();
function locate(town: string, state: string) {
  const key = `${town}|${state}`;
  if (!coords.has(key)) {
    coords.set(
      key,
      getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(town)}&count=10&countryCode=US`).then((j) => {
        const results = (j?.results || []) as { latitude: number; longitude: number; admin1?: string }[];
        const inState = results.find((r) => r.admin1 === (STATES[state] || state)) || results[0];
        return inState ? { lat: inState.latitude, lon: inState.longitude } : null;
      })
    );
  }
  return coords.get(key)!;
}

/** Days from today to an event date (negative = past). */
export const daysUntil = (date: string, today = new Date()) => {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, (m || 1) - 1, d || 1).getTime() - t.getTime()) / (24 * HOUR));
};

/** The weather for an event, or null when it's too far out (forecasts reach ~15 days) or can't be found. */
export async function fetchEventWeather(e: { date: string; startTime?: string; location: string; durationMinutes?: number }, home = 'Mahopac'): Promise<EventWeather | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) return null;
  const ahead = daysUntil(e.date);
  if (ahead > 15 || ahead < -60) return null;
  const { town, state } = placeOf(e.location, home);
  const key = `${town}|${state}|${e.date}|${e.startTime || ''}|${e.durationMinutes || 120}`;
  const hit = readCache()[key];
  if (hit && Date.now() - hit.at < HOUR) return hit.w;
  const where = await locate(town, state);
  if (!where) return null;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${where.lat}&longitude=${where.lon}` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&start_date=${e.date}&end_date=${e.date}`;
  const j = await getJson(url);
  const w = j?.hourly ? weatherAt(j.hourly, e.date, e.startTime || '12:00', e.durationMinutes || 120, `${town}, ${state}`) : null;
  writeCache(key, w);
  return w;
}
