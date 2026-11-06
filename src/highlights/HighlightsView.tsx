// The Highlights section: every highlight kept this season (marked with ★ Highlight in the Film Room, kept from the
// breakdown's suggestions, or a Field camera extra), each trimmed and titled; reels made from them (a game, the
// season, one kid, or any mix) that play right here or go out to DaVinci Resolve; the banquet check that every kid
// is in enough of them; and the team's look and defaults.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clapperboard, FolderOpen, Plus, Settings2, Sparkles, Star, Trash2, Users, Wand2 } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import { probeSnap } from '../filmroom/snapProbe';
import { countViewIndex } from '../filmroom/dualView';
import type { FilmGameShared } from '../filmroom/types';
import { playsForPlayer } from '../filmroom/playerPlays';
import { ClipEditor, CATEGORY_LABEL } from './ClipEditor';
import { clipLength, lineUp, type AccessState, type FilmAccess } from './filmAccess';
import {
  addHighlights, addToReel, editHighlight, editReel, extraPlace, gameOrder, highlightFromExtra, highlightFromPlay, kidCoverage, kidHighlights, kidLabel, kidsText,
  mergeHighlights, newReel, recommendPlays, REC_GROUPS, removeHighlights, removeReel, seasonPicks, snapWindow, clock, reelsFor, type Kid, type RecGroup,
} from './highlightData';
import { ReelEditor } from './ReelEditor';
import { AUTO_JSON_KEY, SettingsPanel } from './SettingsPanel';
import { canWriteFolders, DB_FILE, dbJson, libraryFolder, writeFile } from './localLibrary';
import type { Highlight, HighlightCategory, HighlightGame } from './types';
import type { HighlightStore } from './useHighlights';

export interface HighlightsViewProps {
  teamName: string;
  season: string;
  store: HighlightStore;
  access: FilmAccess;
  /** A game's shared Film Room data (clip line-ups, camera offsets), read once. */
  loadShared: (gameKey: string) => Promise<Partial<FilmGameShared>>;
  /** Our games this season. */
  games: HighlightGame[];
  /** Their plays. */
  plays: Play[];
  roster: Kid[];
  me: string;
  myName: string;
}

type Tab = 'clips' | 'reels' | 'kids' | 'settings';
/** Each kind of recommended play's color (its chip and its badges). */
const REC_COLOR: Record<RecGroup, string> = {
  scores: '#dc2626',
  turnovers: '#7c3aed',
  backfield: '#ea580c',
  big: '#2563eb',
  downs: '#0d9488',
  specials: '#ca8a04',
  kids: '#db2777',
};
type ClipsView = 'kept' | 'suggested' | 'extras';

export const HighlightsView: React.FC<HighlightsViewProps> = ({ teamName, season, store, access, loadShared, games, plays, roster, me, myName }) => {
  const { data, update } = store;
  const ro = store.readOnly;
  const settings = data.settings;
  const order = useMemo(() => gameOrder(games), [games]);
  const sortedGames = useMemo(() => games.slice().sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)), [games, order]);
  const [tab, setTab] = useState<Tab>('clips');
  // Highlights whose game was lost (an old save blanked it): their game again, from their play.
  useEffect(() => {
    if (ro) return;
    const fix = new Map<string, HighlightGame>();
    for (const h of data.highlights) {
      if (h.game?.key || !h.playId) continue;
      const p = plays.find((q) => q.id === h.playId);
      const g = p && games.find((x) => x.gameId === p.gameId);
      if (g) fix.set(h.id, { key: g.key, gameId: g.gameId, name: g.name, ...(g.week ? { week: g.week } : {}) });
    }
    if (fix.size) update((d) => ({ ...d, highlights: d.highlights.map((h) => (fix.has(h.id) ? { ...h, game: fix.get(h.id)!, editedAt: Date.now() } : h)) }));
  }, [data.highlights, plays, games, ro, update]);
  const [clipsView, setClipsView] = useState<ClipsView>('kept');
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [access_, setAccess] = useState<AccessState | 'checking'>('checking');
  useEffect(() => {
    void access.state().then(setAccess);
  }, [access]);
  // highlights.json in the local library follows every change (when the folder can be written without asking).
  useEffect(() => {
    let auto = true;
    try {
      auto = localStorage.getItem(AUTO_JSON_KEY) !== '0';
    } catch {
      /* default on */
    }
    if (!auto || !canWriteFolders()) return;
    const t = window.setTimeout(async () => {
      const { handle, ok } = await libraryFolder().catch(() => ({ handle: null, ok: false }));
      if (handle && ok) await writeFile(handle, DB_FILE, dbJson(data, teamName, season)).catch(() => undefined);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [data, teamName, season]);
  const connect = async () => {
    try {
      setAccess(await access.connect());
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  // The filters on the kept clips.
  const [fGame, setFGame] = useState('');
  const [fCat, setFCat] = useState<HighlightCategory | ''>('');
  const [fKid, setFKid] = useState('');
  const [fRating, setFRating] = useState(0);
  const [fKind, setFKind] = useState<'' | 'play' | 'extra'>('');
  const [fText, setFText] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const kept = useMemo(
    () =>
      data.highlights
        .filter(
          (h) =>
            (!fGame || h.game.key === fGame) &&
            (!fCat || h.categories.includes(fCat)) &&
            (!fKid || h.kids.some((k) => String(Number(k)) === fKid)) &&
            h.rating >= fRating &&
            (!fKind || h.kind === fKind) &&
            (!fText || `${h.title} ${h.note || ''} ${h.game.name}`.toLowerCase().includes(fText.toLowerCase()))
        )
        .sort((a, b) => (order.get(a.game.key) ?? 0) - (order.get(b.game.key) ?? 0) || a.seq - b.seq),
    [data.highlights, fGame, fCat, fKid, fRating, fKind, fText, order]
  );
  const keptSeconds = kept.reduce((n, h) => n + (h.end - h.start), 0);
  const open = data.highlights.find((h) => h.id === openId) || null;
  const myReels = useMemo(() => reelsFor(data, me), [data, me]);

  // A game's shared Film Room data, for the game being worked on.
  const [sharedOf, setSharedOf] = useState<Record<string, Partial<FilmGameShared>>>({});
  const needShared = useCallback(
    async (key: string) => {
      if (sharedOf[key]) return sharedOf[key];
      const s = await loadShared(key).catch(() => ({}));
      setSharedOf((m) => ({ ...m, [key]: s }));
      return s;
    },
    [loadShared, sharedOf]
  );
  useEffect(() => {
    if (open) void needShared(open.game.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.game.key]);

  const playsOf = useCallback((g: HighlightGame) => plays.filter((p) => p.gameId === g.gameId).sort((a, b) => a.playNumber - b.playNumber), [plays]);

  /**
   * Keep plays as highlights: their clips found the way the Film Room lines them up (Main camera), then each one
   * trimmed around its snap in the background.
   */
  const keepPlays = async (g: HighlightGame, list: Play[]) => {
    if (ro || !list.length) return;
    setStatus(`Finding the clips for ${list.length} play${list.length === 1 ? '' : 's'}…`);
    try {
      const film = await access.openGame(g);
      const shared = await needShared(g.key);
      const view = film.views[countViewIndex(film.views)] || '';
      const { clipOf } = lineUp(film, view, playsOf(g), shared);
      const made: Highlight[] = [];
      const missing: number[] = [];
      for (const p of list) {
        const c = clipOf.get(p.id);
        if (!c) missing.push(p.playNumber);
        else made.push(highlightFromPlay({ game: g, play: p, view, clip: c.name, clipLen: c.durationSec, snap: undefined, settings, by: me }));
      }
      update((d) => addHighlights(d, made));
      setStatus(missing.length ? `No clip for play${missing.length === 1 ? '' : 's'} #${missing.join(', #')}.` : '');
      // Trim each at its snap (the clip is opened to look for the snap; Drive clips download first).
      let n = 0;
      for (const h of made) {
        n += 1;
        setStatus(`Trimming at the snap ${n}/${made.length}…`);
        try {
          const u = await access.url(g, h.view, h.clip);
          const len = h.clipLen ?? (await clipLength(u.url));
          const snap = await probeSnap(u.url);
          u.release();
          update((d) =>
            editHighlight(d, h.id, (x) =>
              x.start === h.start && x.end === h.end ? { ...x, clipLen: len ?? x.clipLen, ...(snap !== null ? snapWindow(snap, len, settings) : { end: len ?? x.end }) } : x
            )
          );
        } catch {
          /* keep the whole clip */
        }
      }
      setStatus(missing.length ? `No clip for play${missing.length === 1 ? '' : 's'} #${missing.join(', #')}.` : `Kept ${made.length}.`);
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };

  // Suggestions and extras, one game at a time.
  const [sGame, setSGame] = useState('');
  // Recommended: one game, or every game of the season ('*').
  const everyGame = sGame === '*' && clipsView === 'suggested';
  const game = sortedGames.find((g) => g.key === sGame) || sortedGames[sortedGames.length - 1];
  const [recGroup, setRecGroup] = useState<RecGroup | ''>('');
  // How many clips each kid is in already (the banquet's "every kid in N"): kids short of it get their plays recommended.
  const kidCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of data.highlights) for (const k of h.kids) m.set(String(Number(k)), (m.get(String(Number(k))) || 0) + 1);
    return m;
  }, [data.highlights]);
  const recommendations = useMemo(() => {
    const list = everyGame ? sortedGames : game ? [game] : [];
    return list.flatMap((g) => {
      const taken = new Set(data.highlights.filter((h) => h.game.key === g.key && h.playId).map((h) => h.playId!));
      return recommendPlays(playsOf(g), taken, { bigGain: settings.bigGain, kidCounts, minPerKid: settings.minPerKid }).map((r) => ({ ...r, game: g }));
    }).sort((a, b) => b.weight - a.weight);
  }, [everyGame, sortedGames, game, data.highlights, playsOf, settings.bigGain, settings.minPerKid, kidCounts]);
  const recShown = recGroup ? recommendations.filter((r) => r.groups.includes(recGroup)) : recommendations;
  /** Keep recommended plays, a game at a time. */
  const keepRecs = async (list: typeof recommendations) => {
    const byGame = new Map<string, { g: HighlightGame; plays: Play[] }>();
    for (const r of list) {
      const e = byGame.get(r.game.key) || { g: r.game, plays: [] };
      e.plays.push(r.play);
      byGame.set(r.game.key, e);
    }
    for (const { g, plays: ps } of byGame.values()) await keepPlays(g, ps);
  };
  const [extras, setExtras] = useState<{ view: string; name: string; len?: number; seq: number; where: string; marked: boolean }[] | null>(null);
  useEffect(() => {
    if (tab !== 'clips' || clipsView !== 'extras' || !game) return;
    let off = false;
    setExtras(null);
    (async () => {
      try {
        const film = await access.openGame(game);
        const shared = await needShared(game.key);
        const main = countViewIndex(film.views);
        const out: NonNullable<typeof extras> = [];
        // The Main camera's clips are the plays; every other camera's clips that aren't lined up with a play are extras.
        film.views.forEach((view, vi) => {
          if (vi === main) return;
          const { all, clipOf, hidden } = lineUp(film, view, playsOf(game), shared);
          const playOf = new Map<string, number>();
          const numById = new Map(playsOf(game).map((p) => [p.id, p.playNumber]));
          clipOf.forEach((c, id) => playOf.set(c.name, numById.get(id)!));
          all.forEach((c, i) => {
            if (playOf.has(c.name)) return;
            const place = extraPlace(all, i, playOf);
            out.push({ view, name: c.name, len: c.durationSec, ...place, marked: hidden.has(c.name) });
          });
        });
        if (!off) setExtras(out);
      } catch (err: any) {
        if (!off) {
          setExtras([]);
          setStatus(err?.message || String(err));
        }
      }
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, clipsView, game?.key, access]);
  const keptExtras = useMemo(() => new Set(data.highlights.filter((h) => h.kind === 'extra' && h.game.key === game?.key).map((h) => `${h.view}/${h.clip}`)), [data.highlights, game?.key]);

  const addReelOf = (kind: 'game' | 'season' | 'player' | 'custom', opts: { gameKey?: string; kid?: string } = {}) => {
    if (ro) return;
    const g = games.find((x) => x.key === opts.gameKey);
    const ids =
      kind === 'game' && opts.gameKey
        ? data.highlights.filter((h) => h.game.key === opts.gameKey).map((h) => h.id)
        : kind === 'season'
          ? seasonPicks(data.highlights).map((h) => h.id)
          : kind === 'player' && opts.kid
            ? kidHighlights(data.highlights, opts.kid).map((h) => h.id)
            : [];
    const name = kind === 'game' && g ? `${g.name} reel` : kind === 'season' ? `${season} season reel` : kind === 'player' && opts.kid ? `${kidLabel(opts.kid, roster, 'full')} reel` : 'New reel';
    const r = newReel({ name, kind, owner: me, ownerName: myName, highlightIds: ids, ...opts });
    update((d) => ({ ...d, reels: [...d.reels, r] }));
    setReelId(r.id);
    setTab('reels');
  };
  const [reelId, setReelId] = useState<string | null>(null);
  const reel = myReels.find((r) => r.id === reelId) || null;

  const tabBtn = (t: Tab, label: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
    >
      {label}
    </button>
  );
  const sub = (v: ClipsView, label: string) => (
    <button type="button" onClick={() => setClipsView(v)} aria-pressed={clipsView === v} className={`h-7 px-2.5 text-[11px] font-bold ${clipsView === v ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'}`}>
      {label}
    </button>
  );
  const sel = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs min-w-0';
  const panel = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';
  const stars = (n: number) => (
    <span className="inline-flex shrink-0" aria-label={`${n} star${n > 1 ? 's' : ''}`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={11} className={i <= n ? 'text-amber-400 fill-current' : 'text-slate-300 dark:text-slate-600'} />
      ))}
    </span>
  );
  const gameSelect = (value: string, set: (v: string) => void, all?: string) => (
    <select value={value} onChange={(e) => set(e.target.value)} className={sel} aria-label="Game">
      {all !== undefined && <option value="">{all}</option>}
      {sortedGames.map((g) => (
        <option key={g.key} value={g.key}>{g.name}</option>
      ))}
    </select>
  );

  const filmBar =
    access_ === 'ask' || access_ === 'signin' || access_ === 'none' ? (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-100 text-xs px-3 py-2">
        <FolderOpen size={14} />
        {access_ === 'none'
          ? 'No film folder yet: link the team film folder in the Film Room first.'
          : access_ === 'ask'
            ? 'The film folder on this computer needs a click to open.'
            : 'The film is in the team Google Drive.'}
        {access_ !== 'none' && (
          <button type="button" onClick={() => void connect()} className="h-7 px-3 rounded-lg bg-amber-500 text-slate-900 font-bold">
            {access_ === 'ask' ? 'Open the film folder' : 'Sign in with Google'}
          </button>
        )}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3 p-2 sm:p-4 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Clapperboard size={22} className="text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Highlights</h2>
        <span className="text-xs text-slate-500">
          {season} season · {data.highlights.length} kept · {myReels.length} reel{myReels.length === 1 ? '' : 's'} · {store.localOnly ? 'this computer only' : 'shared with the staff'}
        </span>
        <div role="tablist" className="flex flex-wrap items-center gap-1 sm:ml-auto">
          {tabBtn('clips', <><Sparkles size={13} /> Clips</>)}
          {tabBtn('reels', <><Clapperboard size={13} /> Reels</>)}
          {tabBtn('kids', <><Users size={13} /> Every kid</>)}
          {tabBtn('settings', <><Settings2 size={13} /> Settings</>)}
        </div>
      </div>
      {filmBar}
      {store.saveError && (
        <div role="alert" className="text-xs font-bold text-rose-700 dark:text-rose-300 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5">
          {store.saveError}
        </div>
      )}
      {status && (
        <div role="status" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
          {status}
          <button type="button" className="underline" onClick={() => setStatus('')}>OK</button>
        </div>
      )}

      {tab === 'clips' && (
        <div className={`grid gap-3 ${open ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]' : ''}`}>
          <div className={`${panel} p-3 flex flex-col gap-2 min-w-0`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden" role="group" aria-label="Clips">
                {sub('kept', `Kept (${data.highlights.length})`)}
                {sub('suggested', 'Recommended')}
                {sub('extras', 'Field extras')}
              </div>
              {clipsView === 'extras' && gameSelect(game?.key || '', setSGame)}
              {clipsView === 'suggested' && (
                <select value={everyGame ? '*' : game?.key || ''} onChange={(e) => setSGame(e.target.value)} className={sel} aria-label="Game">
                  <option value="*">Every game this season</option>
                  {sortedGames.map((g) => (
                    <option key={g.key} value={g.key}>{g.name}</option>
                  ))}
                </select>
              )}
            </div>

            {clipsView === 'kept' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  {gameSelect(fGame, setFGame, 'Every game')}
                  <select value={fCat} onChange={(e) => setFCat(e.target.value as HighlightCategory | '')} className={sel} aria-label="Kind">
                    <option value="">Every kind</option>
                    {(Object.keys(CATEGORY_LABEL) as HighlightCategory[]).map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                    ))}
                  </select>
                  <select value={fKid} onChange={(e) => setFKid(e.target.value)} className={sel} aria-label="Kid">
                    <option value="">Every kid</option>
                    {roster.map((k) => (
                      <option key={k.num} value={String(Number(k.num))}>{kidLabel(String(Number(k.num)), roster, 'full')}</option>
                    ))}
                  </select>
                  <select value={fRating} onChange={(e) => setFRating(Number(e.target.value))} className={sel} aria-label="Rating">
                    <option value={0}>Any rating</option>
                    <option value={2}>★★ and up</option>
                    <option value={3}>★★★</option>
                  </select>
                  <select value={fKind} onChange={(e) => setFKind(e.target.value as '' | 'play' | 'extra')} className={sel} aria-label="Plays or extras">
                    <option value="">Plays and extras</option>
                    <option value="play">Plays</option>
                    <option value="extra">Extras</option>
                  </select>
                  <input value={fText} onChange={(e) => setFText(e.target.value)} placeholder="Search" className={`${sel} w-28`} aria-label="Search" />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {!ro && kept.length > 0 && (
                    <label className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kept.every((h) => picked.has(h.id))}
                        onChange={(e) => setPicked(e.target.checked ? new Set(kept.map((h) => h.id)) : new Set())}
                        aria-label="Pick every clip shown"
                      />
                      All
                    </label>
                  )}
                  <span>
                    {kept.length} clip{kept.length === 1 ? '' : 's'} · {clock(keptSeconds)}
                  </span>
                  {picked.size > 0 && !ro && (
                    <>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{picked.size} picked:</span>
                      <select
                        value=""
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) return;
                          if (id === '__new') {
                            const r = newReel({ name: 'New reel', kind: 'custom', owner: me, ownerName: myName, highlightIds: [...picked] });
                            update((d) => ({ ...d, reels: [...d.reels, r] }));
                            setReelId(r.id);
                            setTab('reels');
                          } else update((d) => editReel(d, id, (r) => addToReel(r, [...picked])));
                          setPicked(new Set());
                        }}
                        className={sel}
                        aria-label="Add the picked clips to a reel"
                      >
                        <option value="">Add to reel…</option>
                        <option value="__new">A new reel</option>
                        {myReels.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400"
                        onClick={() => {
                          if (!window.confirm(`Delete ${picked.size} highlight${picked.size === 1 ? '' : 's'}? The film isn't touched.`)) return;
                          update((d) => removeHighlights(d, [...picked]));
                          setPicked(new Set());
                        }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                      <button type="button" className="underline" onClick={() => setPicked(new Set())}>Clear</button>
                    </>
                  )}
                </div>
                <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[62vh] overflow-auto -mx-1" aria-label="Highlights">
                  {kept.map((h) => (
                    <li
                      key={h.id}
                      className={`flex items-center gap-2 px-1 py-1.5 cursor-pointer rounded ${openId === h.id ? 'bg-indigo-50 dark:bg-indigo-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                      onClick={() => setOpenId(h.id)}
                    >
                      {!ro && (
                        <input
                          type="checkbox"
                          checked={picked.has(h.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setPicked((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.add(h.id);
                            else n.delete(h.id);
                            return n;
                          })}
                          aria-label={`Pick ${h.title}`}
                        />
                      )}
                      {stars(h.rating)}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{h.title}</span>
                        <span className="block text-[11px] text-slate-500 truncate">
                          {h.game.name} · {h.kind === 'extra' ? h.where || 'extra' : `#${h.playNumber}`}
                          {h.kids.length ? ` · ${kidsText(h.kids, roster, 'number')}` : ''}
                          {h.replay ? ' · replay' : ''}
                          {h.slow ? ' · slow-mo' : ''}
                          {h.freeze ? ' · freeze' : ''}
                          {h.marks?.length ? ` · ${h.marks.length} mark${h.marks.length === 1 ? '' : 's'}` : ''}
                        </span>
                      </span>
                      <span className="text-[11px] tabular-nums text-slate-500 shrink-0">{(h.end - h.start).toFixed(1)} s</span>
                    </li>
                  ))}
                  {!kept.length && (
                    <li className="py-6 text-center text-sm text-slate-500">
                      {data.highlights.length ? 'Nothing matches those filters.' : 'No highlights yet. Tap ★ Highlight (or H) while watching film in the Film Room, or keep some from Suggested.'}
                    </li>
                  )}
                </ul>
              </>
            )}

            {clipsView === 'suggested' && (everyGame || game) && (
              <>
                {/* What kind: every recommendation, or one kind (TDs, turnovers, sacks & TFLs...), with how many. */}
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Kind of play">
                  <button
                    type="button"
                    aria-pressed={!recGroup}
                    onClick={() => setRecGroup('')}
                    className={`h-7 px-2.5 rounded-full text-[11px] font-bold border ${!recGroup ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                  >
                    All {recommendations.length}
                  </button>
                  {REC_GROUPS.map((g) => {
                    const n = recommendations.filter((r) => r.groups.includes(g.id)).length;
                    if (!n && recGroup !== g.id) return null;
                    const on = recGroup === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setRecGroup(on ? '' : g.id)}
                        title={g.hint}
                        className={`h-7 px-2.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${on ? 'text-white border-transparent' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`}
                        style={on ? { background: REC_COLOR[g.id] } : undefined}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: on ? '#fff' : REC_COLOR[g.id] }} aria-hidden="true" />
                        {g.label} {n}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    {recShown.length} play{recShown.length === 1 ? '' : 's'} from the breakdown, best first
                    {recGroup ? ` · ${REC_GROUPS.find((g) => g.id === recGroup)?.hint}` : ` · big gains are ${settings.bigGain}+ yards`}.
                  </span>
                  {!ro && recShown.length > 0 && (
                    <button type="button" onClick={() => void keepRecs(recShown)} className="h-7 px-3 rounded-lg bg-indigo-600 text-white font-bold inline-flex items-center gap-1">
                      <Wand2 size={12} /> Keep all {recShown.length}
                    </button>
                  )}
                </div>
                <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[62vh] overflow-auto">
                  {recShown.map((r) => (
                    <li key={`${r.game.key}/${r.play.id}`} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          #{r.play.playNumber} · {r.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-1 mt-0.5">
                          {r.reasons.map((x, i) => (
                            <span key={i} className="px-1.5 py-px rounded-md text-[10px] font-black text-white" style={{ background: REC_COLOR[x.group] }}>
                              {x.label}
                            </span>
                          ))}
                          <span className="text-[11px] text-slate-500 truncate">
                            {r.kids.length ? kidsText(r.kids, roster, 'first') : ''}
                            {r.play.quarter ? `${r.kids.length ? ' · ' : ''}Q${r.play.quarter}` : ''}
                            {everyGame ? ` · ${r.game.name}` : ''}
                          </span>
                        </span>
                      </span>
                      {!ro && (
                        <button type="button" onClick={() => void keepPlays(r.game, [r.play])} className="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">
                          Keep
                        </button>
                      )}
                    </li>
                  ))}
                  {!recShown.length && (
                    <li className="py-6 text-center text-sm text-slate-500">
                      {recommendations.length ? 'None of that kind left.' : 'Nothing left to recommend here (or the breakdown isn’t filled in yet: results, down and distance, who made the play).'}
                    </li>
                  )}
                </ul>
              </>
            )}

            {clipsView === 'extras' && game && (
              <>
                <p className="text-xs text-slate-500">
                  Clips from the other cameras that aren't plays (marked “Not a play” in the Film Room, or past the last play): celebrations, the sideline, the huddle.
                </p>
                <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[62vh] overflow-auto">
                  {extras === null && <li className="py-6 text-center text-sm text-slate-500">Looking at the film…</li>}
                  {extras?.map((x) => {
                    const done = keptExtras.has(`${x.view}/${x.name}`);
                    return (
                      <li key={`${x.view}/${x.name}`} className="flex items-center gap-2 py-1.5">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{x.name}</span>
                          <span className="block text-[11px] text-slate-500 truncate">
                            {x.view} · {x.where}
                            {x.len ? ` · ${x.len.toFixed(1)} s` : ''}
                            {x.marked ? ' · marked not a play' : ''}
                          </span>
                        </span>
                        {done ? (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Kept</span>
                        ) : (
                          !ro && (
                            <button
                              type="button"
                              onClick={async () => {
                                // Its length, when the folder's listing didn't say (the whole clip is the highlight).
                                let len = x.len;
                                if (!len) {
                                  const u = await access.url(game, x.view, x.name).catch(() => null);
                                  if (u) {
                                    len = await clipLength(u.url);
                                    u.release();
                                  }
                                }
                                const h = highlightFromExtra({ game, view: x.view, clip: x.name, clipLen: len, seq: x.seq, where: x.where, by: me });
                                update((d) => addHighlights(d, [h]));
                                setOpenId(h.id);
                              }}
                              className="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold"
                            >
                              Keep
                            </button>
                          )
                        )}
                      </li>
                    );
                  })}
                  {extras?.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No extra clips in {game.name}'s other cameras.</li>}
                </ul>
              </>
            )}
            {clipsView !== 'kept' && !games.length && <p className="text-sm text-slate-500">No games with a breakdown yet.</p>}
          </div>

          {open && (
            <div className={`${panel} p-3 min-w-0`}>
              <ClipEditor
                key={open.id}
                h={open}
                store={store}
                access={access}
                shared={sharedOf[open.game.key]}
                plays={plays}
                roster={roster}
                onClose={() => setOpenId(null)}
                reels={myReels.map((r) => ({ id: r.id, name: r.name, has: r.items.some((it) => it.highlightId === open.id) }))}
                onAddToReel={(id) => {
                  if (id === '__new') {
                    const r = newReel({ name: `${open.title || 'New'} reel`, kind: 'custom', owner: me, ownerName: myName, highlightIds: [open.id] });
                    update((d) => ({ ...d, reels: [...d.reels, r] }));
                  } else update((d) => editReel(d, id, (r) => addToReel(r, [open.id])));
                }}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'reels' && (
        <div className="grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className={`${panel} p-3 flex flex-col gap-2 min-w-0`}>
            {!ro && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">New reel</span>
                <div className="flex flex-wrap gap-1.5">
                  <select value="" onChange={(e) => e.target.value && addReelOf('game', { gameKey: e.target.value })} className={sel} aria-label="Game reel for">
                    <option value="">Game reel…</option>
                    {sortedGames.map((g) => (
                      <option key={g.key} value={g.key}>{g.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => addReelOf('season')} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">
                    Season reel
                  </button>
                  <select value="" onChange={(e) => e.target.value && addReelOf('player', { kid: e.target.value })} className={sel} aria-label="Player reel for">
                    <option value="">Player reel…</option>
                    {roster.map((k) => (
                      <option key={k.num} value={String(Number(k.num))}>{kidLabel(String(Number(k.num)), roster, 'full')}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => addReelOf('custom')} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1">
                    <Plus size={12} /> Empty
                  </button>
                </div>
              </div>
            )}
            <ul className="flex flex-col gap-1" aria-label="Reels">
              {myReels.map((r) => {
                const segsLen = r.items.length;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setReelId(r.id)}
                      className={`w-full text-left rounded-lg px-2 py-1.5 ${reelId === r.id ? 'bg-indigo-50 dark:bg-indigo-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                    >
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{r.name}</span>
                      <span className="block text-[11px] text-slate-500">
                        {r.kind === 'game' ? 'Game' : r.kind === 'season' ? 'Season' : r.kind === 'player' ? 'Player' : 'Custom'} · {segsLen} clip{segsLen === 1 ? '' : 's'}
                        {r.ownerName && r.owner !== me ? ` · ${r.ownerName}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
              {!myReels.length && <li className="text-sm text-slate-500 py-4 text-center">No reels yet.</li>}
            </ul>
          </div>
          <div className={`${panel} p-3 min-w-0`}>
            {reel ? (
              <ReelEditor
                key={reel.id}
                reel={reel}
                data={data}
                store={store}
                access={access}
                games={order}
                roster={roster}
                plays={plays}
                teamName={teamName}
                season={season}
                me={me}
                onOpenClip={(id) => {
                  setOpenId(id);
                  setClipsView('kept');
                  setTab('clips');
                }}
                onDelete={() => {
                  if (!window.confirm(`Delete the reel “${reel.name}”? Its highlights stay.`)) return;
                  update((d) => removeReel(d, reel.id));
                  setReelId(null);
                }}
              />
            ) : (
              <p className="text-sm text-slate-500 py-8 text-center">Pick a reel, or make one: a game's reel starts with that game's highlights, the season reel with the ★★ and ★★★ ones, a player reel with every clip he's in.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'kids' && (
        <KidsCheck
          roster={roster}
          highlights={data.highlights}
          min={settings.minPerKid}
          plays={plays}
          games={sortedGames}
          ro={ro}
          onKeep={(g, p) => void keepPlays(g, [p])}
          onReel={(kid) => addReelOf('player', { kid })}
          onAllReels={() => {
            const missing = roster.filter((k) => !data.reels.some((r) => r.kind === 'player' && r.kid === String(Number(k.num))) && kidHighlights(data.highlights, String(Number(k.num))).length);
            if (!missing.length) return setStatus('Every kid with highlights already has a reel.');
            const made = missing.map((k) => {
              const num = String(Number(k.num));
              return newReel({ name: `${kidLabel(num, roster, 'full')} reel`, kind: 'player', kid: num, owner: me, ownerName: myName, highlightIds: kidHighlights(data.highlights, num).map((h) => h.id) });
            });
            update((d) => ({ ...d, reels: [...d.reels, ...made] }));
            setStatus(`Made ${made.length} player reel${made.length === 1 ? '' : 's'}.`);
          }}
        />
      )}

      {tab === 'settings' && (
        <SettingsPanel
          store={store}
          teamName={teamName}
          season={season}
          onImport={(incoming) => update((d) => mergeHighlights(d, incoming))}
        />
      )}
    </div>
  );
};

/** The banquet check: every kid on the roster and how many highlights he's in; his plays not kept yet, to add. */
const KidsCheck: React.FC<{
  roster: Kid[];
  highlights: Highlight[];
  min: number;
  plays: Play[];
  games: HighlightGame[];
  ro: boolean;
  onKeep: (g: HighlightGame, p: Play) => void;
  onReel: (kid: string) => void;
  onAllReels: () => void;
}> = ({ roster, highlights, min, plays, games, ro, onKeep, onReel, onAllReels }) => {
  const rows = useMemo(() => kidCoverage(roster, highlights), [roster, highlights]);
  const [kid, setKid] = useState<string | null>(null);
  const short = rows.filter((r) => r.count < min).length;
  const kept = useMemo(() => new Set(highlights.map((h) => `${h.game.gameId}|${h.playId}`)), [highlights]);
  const hisPlays = useMemo(() => (kid ? playsForPlayer(plays, kid).filter((r) => !kept.has(`${r.play.gameId}|${r.play.id}`)) : []), [kid, plays, kept]);
  const gameOf = (id?: string) => games.find((g) => g.gameId === id);
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-slate-900 dark:text-slate-100">Every kid in the reels</span>
          <span className="text-xs text-slate-500">
            {short ? `${short} kid${short === 1 ? '' : 's'} with fewer than ${min}` : `Every kid has ${min} or more`}
          </span>
          {!ro && (
            <button type="button" onClick={onAllReels} className="ml-auto h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">
              A reel for every kid
            </button>
          )}
        </div>
        <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[65vh] overflow-auto">
          {rows.map((r) => (
            <li key={r.num}>
              <button type="button" onClick={() => setKid(r.num)} className={`w-full flex items-center gap-2 py-1.5 px-1 text-left rounded ${kid === r.num ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}>
                <span className="w-40 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{r.label}</span>
                <span className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <span className={`block h-full ${r.count >= min ? 'bg-emerald-500' : r.count ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, (r.count / Math.max(1, min)) * 100)}%` }} />
                </span>
                <span className={`w-8 text-right text-xs font-black tabular-nums ${r.count >= min ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{r.count}</span>
              </button>
            </li>
          ))}
          {!rows.length && <li className="py-6 text-center text-sm text-slate-500">No roster for this team yet.</li>}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 min-w-0">
        {kid ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">{kidLabel(kid, roster, 'full')}: plays not kept yet</span>
              {!ro && (
                <button type="button" onClick={() => onReel(kid)} className="ml-auto h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">
                  Make his reel
                </button>
              )}
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh] overflow-auto">
              {hisPlays.map((r) => {
                const g = gameOf(r.play.gameId);
                return (
                  <li key={`${r.play.gameId}-${r.play.id}`} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {r.roles.join(', ')}
                        {Number(r.play.gainLoss) ? ` · ${Number(r.play.gainLoss) > 0 ? '+' : ''}${r.play.gainLoss} yds` : ''}
                        {r.events.length ? ` · ${r.events.join(', ')}` : ''}
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {g?.name || 'Game'} · #{r.play.playNumber} {r.play.result ? `· ${r.play.result}` : ''}
                      </span>
                    </span>
                    {!ro && g && (
                      <button type="button" onClick={() => onKeep(g, r.play)} className="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">
                        Keep
                      </button>
                    )}
                  </li>
                );
              })}
              {!hisPlays.length && <li className="py-6 text-center text-sm text-slate-500">Every play he's credited with is already kept (or the breakdown doesn't name him on any).</li>}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">Pick a kid to see his plays that aren't highlights yet. Kids are found by jersey number on the breakdown (carrier, passer, receiver, tackler).</p>
        )}
      </div>
    </div>
  );
};

