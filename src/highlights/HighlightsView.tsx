// The Highlights section: every highlight kept this season (marked with ★ Highlight in the Film Room, kept from the
// breakdown's suggestions, or a Field camera extra), each trimmed and titled; reels made from them (a game, the
// season, one kid, or any mix) that play right here or go out to DaVinci Resolve; the banquet check that every kid
// is in enough of them; and the team's look and defaults.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, FolderOpen, Plus, Settings2, Sparkles, Star, Trash2, Users, Wand2 } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import { countViewIndex } from '../filmroom/dualView';
import type { FilmGameShared } from '../filmroom/types';
import { canPickFolderFiles, pickedFolderNode, setPickedFilmRoot } from '../filmroom/filmSources';
import { isFilmRoot } from '../filmroom/folderRoutes';
import { FilmServerSetup } from '../filmroom/FilmServerSetup';
import { playsForPlayer } from '../filmroom/playerPlays';
import { ClipEditor, CATEGORY_LABEL } from './ClipEditor';
import { clipLength, lineUp, type AccessState, type FilmAccess } from './filmAccess';
import {
  addHighlights, addToReel, editHighlight, editReel, EVERYONE, extraPlace, FAMILIES, shareReel, gameOrder, highlightFromExtra, kidCoverage, kidHighlights, kidLabel, kidsText,
  mergeHighlights, newReel, orderedHighlights, recommendPlays, REC_GROUPS, removeHighlights, removeReel, seasonPicks, clock, reelsFor, type Kid, type RecGroup,
} from './highlightData';
import { ReelEditor } from './ReelEditor';
import { keepPlaysAsHighlights } from './keepPlays';
import { AUTO_JSON_KEY, SettingsPanel } from './SettingsPanel';
import { canWriteFolders, DB_FILE, dbJson, libraryFolder, writeFile } from './localLibrary';
import type { Highlight, HighlightCategory, HighlightGame, Reel } from './types';
import { inboxFor, type FamilySends } from './familySends';
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
  /** A family's Highlights helper: everything coaches do here but the team's settings (look, music, this-computer-only). */
  helper?: boolean;
  /** Shown at the right of the title row (the helper's switch to their own family page). */
  extra?: React.ReactNode;
  /** The staff by email (lower case) → name: who kept a clip, who made a reel. */
  people?: Record<string, string>;
  /** The program owner and head coaches: every coach's reels, the ones not shared too. */
  seeAllReels?: boolean;
  /** What families sent for reels taking clips (each family's document). */
  familySends?: FamilySends[];
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

export const HighlightsView: React.FC<HighlightsViewProps> = ({ teamName, season, store, access, loadShared, games, plays, roster, me, myName, helper = false, extra, people, seeAllReels = false, familySends = [] }) => {
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
  const pickRootInput = useRef<HTMLInputElement>(null);
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
  const [fBy, setFBy] = useState('');
  // A phone shows the search and a Filters button; the rest opens from it.
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = [fGame, fCat, fKid, fRating, fKind, fBy].filter(Boolean).length;
  const clearFilters = () => {
    setFGame('');
    setFCat('');
    setFKid('');
    setFRating(0);
    setFKind('');
    setFBy('');
    setFText('');
  };
  /** Who someone is (a staff member's name), "You", or the start of their email. */
  const nameOf = useCallback((email?: string) => {
    const e = String(email || '').toLowerCase().trim();
    if (!e) return '';
    if (e === me) return 'You';
    return people?.[e] || e.split('@')[0];
  }, [people, me]);
  // Who kept the clips (the "Kept by" filter shows when more than one person has).
  const keepers = useMemo(() => [...new Set(data.highlights.map((h) => String(h.createdBy || '').toLowerCase().trim()).filter(Boolean))].sort((a, b) => (a === me ? -1 : b === me ? 1 : nameOf(a).localeCompare(nameOf(b)))), [data.highlights, me, nameOf]);
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
            (!fBy || String(h.createdBy || '').toLowerCase().trim() === fBy) &&
            (!fText || `${h.title} ${h.note || ''} ${h.game.name}`.toLowerCase().includes(fText.toLowerCase()))
        )
        .sort((a, b) => (order.get(a.game.key) ?? 0) - (order.get(b.game.key) ?? 0) || a.seq - b.seq),
    [data.highlights, fGame, fCat, fKid, fRating, fKind, fBy, fText, order]
  );
  const keptSeconds = kept.reduce((n, h) => n + (h.end - h.start), 0);
  const open = data.highlights.find((h) => h.id === openId) || null;
  // On a phone or an iPad held upright the editor opens below the list: bring it up.
  const openRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openId || window.innerWidth >= 1024) return;
    const t = window.setTimeout(() => openRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
    return () => window.clearTimeout(t);
  }, [openId]);
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
    try {
      await keepPlaysAsHighlights({ store, access, game: g, list, gamePlays: playsOf(g), shared: await needShared(g.key), settings, by: me, onStatus: setStatus });
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
  // The reels list: yours, the ones shared with the staff (or you), and, for the owner and head coaches, every other
  // coach's (not shared). Newest first in each.
  const reelGroups = useMemo(() => {
    const yours: Reel[] = [];
    const shared: Reel[] = [];
    const others: Reel[] = [];
    for (const r of seeAllReels ? data.reels : myReels) {
      if (!r.owner || r.owner === me) yours.push(r);
      else if (r.sharedWith.some((e) => e === EVERYONE || e === me)) shared.push(r);
      else others.push(r);
    }
    const newest = (a: Reel, b: Reel) => (b.editedAt || b.createdAt) - (a.editedAt || a.createdAt);
    return [
      { id: 'yours', label: 'Your reels', reels: yours.sort(newest) },
      { id: 'shared', label: 'Shared with the staff', reels: shared.sort(newest) },
      { id: 'others', label: 'Other people’s reels (not shared)', reels: others.sort(newest) },
    ].filter((g) => g.reels.length);
  }, [seeAllReels, data.reels, myReels, me]);
  const listedReels = useMemo(() => reelGroups.flatMap((g) => g.reels), [reelGroups]);
  const reel = listedReels.find((r) => r.id === reelId) || null;
  // On a phone the reel opens below the list: bring it up.
  const reelRef = useRef<HTMLDivElement>(null);
  const pickReel = (id: string) => {
    setReelId(id);
    if (window.innerWidth < 1024) window.setTimeout(() => reelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  };
  /** What families sent for a reel, named the way the staff list names them. */
  const inboxOf = useCallback(
    (r: Reel) => inboxFor(r, familySends).map((it) => ({ ...it, family: { ...it.family, name: people?.[it.family.email] || it.family.name } })),
    [familySends, people]
  );
  /** A reel's clips, added up (no cards): close to how long it plays. */
  const reelClipsSeconds = (r: Reel) => {
    const byId = new Map(data.highlights.map((h) => [h.id, h]));
    return r.items.reduce((n, it) => {
      const h = byId.get(it.highlightId);
      return h ? n + (h.end - h.start) : n;
    }, 0);
  };
  // A clip opened from a reel is edited right there, stepping through that reel's clips (not the whole list).
  const [reelClipId, setReelClipId] = useState<string | null>(null);
  useEffect(() => setReelClipId(null), [reelId]);
  const reelList = useMemo(() => (reel ? orderedHighlights(reel, data.highlights, order) : []), [reel, data.highlights, order]);
  const reelClipAt = reelList.findIndex((h) => h.id === reelClipId);
  const reelClip = reelClipAt >= 0 ? reelList[reelClipAt] : null;
  const reelClipRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reelClip) void needShared(reelClip.game.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelClip?.game.key]);
  useEffect(() => {
    if (!reelClipId) return;
    const t = window.setTimeout(() => reelClipRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
    return () => window.clearTimeout(t);
  }, [reelClipId]);

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
        {/* The team film server: the drive at home, streamed. */}
        <div className="w-full">
          <FilmServerSetup compact onChanged={() => void access.state().then(setAccess)} />
        </div>
        {/* A tablet: the film folder from the Files app (a drive plugged in, or a network share / NAS). */}
        {canPickFolderFiles() && (
          <>
            <button type="button" onClick={() => pickRootInput.current?.click()} className="h-7 px-3 rounded-lg bg-white/80 dark:bg-slate-800 ring-1 ring-amber-500/60 font-bold">
              Pick the film folder (Files)
            </button>
            <input
              ref={pickRootInput}
              type="file"
              // @ts-expect-error webkitdirectory isn't in React's input props
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={async (e) => {
                const list = e.target.files;
                e.target.value = '';
                if (!list?.length) return;
                const node = pickedFolderNode(list);
                if (!node || !isFilmRoot((await node.open()).dirs)) {
                  setStatus('Pick the whole film folder: the one with the team folders (like 10U) in it.');
                  return;
                }
                setPickedFilmRoot(node);
                setAccess('ready');
                setStatus(`Using “${node.name}” for this visit.`);
              }}
            />
          </>
        )}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3 p-2 sm:p-4 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Clapperboard size={22} className="text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Highlights</h2>
        <span className="text-xs text-slate-500">
          {season} season · {data.highlights.length} kept · {listedReels.length} reel{listedReels.length === 1 ? '' : 's'} · {store.localOnly ? 'this computer only' : 'shared with the staff'}
        </span>
        <div role="tablist" className="flex flex-wrap items-center gap-1 sm:ml-auto">
          {tabBtn('clips', <><Sparkles size={13} /> Clips</>)}
          {tabBtn('reels', <><Clapperboard size={13} /> Reels</>)}
          {tabBtn('kids', <><Users size={13} /> Every kid</>)}
          {!helper && tabBtn('settings', <><Settings2 size={13} /> Settings</>)}
        </div>
        {extra}
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
                {/* A phone: the search, and a Filters button for the rest. */}
                <div className="flex items-center gap-1.5 sm:hidden">
                  <input value={fText} onChange={(e) => setFText(e.target.value)} placeholder="Search" className={`${sel} h-9 flex-1 min-w-0`} aria-label="Search" />
                  <button
                    type="button"
                    onClick={() => setShowFilters((x) => !x)}
                    aria-expanded={showFilters}
                    className={`h-9 px-3 rounded-lg border text-xs font-bold shrink-0 ${activeFilters ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`}
                  >
                    Filters{activeFilters ? ` · ${activeFilters}` : ''} {showFilters ? '▴' : '▾'}
                  </button>
                  {(activeFilters > 0 || fText) && (
                    <button type="button" onClick={clearFilters} className="text-xs font-bold underline text-slate-500 shrink-0">
                      Clear
                    </button>
                  )}
                </div>
                <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-1.5`}>
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
                  {keepers.length > 1 && (
                    <select value={fBy} onChange={(e) => setFBy(e.target.value)} className={sel} aria-label="Kept by">
                      <option value="">Kept by anyone</option>
                      {keepers.map((e) => (
                        <option key={e} value={e}>Kept by {nameOf(e)}</option>
                      ))}
                    </select>
                  )}
                  <input value={fText} onChange={(e) => setFText(e.target.value)} placeholder="Search" className={`${sel} w-28 hidden sm:block`} aria-label="Search" />
                  {(activeFilters > 0 || fText) && (
                    <button type="button" onClick={clearFilters} className="hidden sm:inline text-xs font-bold underline text-slate-500">
                      Clear filters
                    </button>
                  )}
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
                          {h.zoom ? (h.zoom.follow ? ' · follows him' : ` · ${h.zoom.level}× zoom`) : ''}
                          {h.createdBy && String(h.createdBy).toLowerCase().trim() !== me ? ` · ${nameOf(h.createdBy)}` : ''}
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
            <div ref={openRef} className={`${panel} p-3 min-w-0 scroll-mt-2`}>
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
            <div className="flex flex-col gap-3 lg:max-h-[75vh] lg:overflow-auto -mx-1 px-1" aria-label="Reels">
              {reelGroups.map((g) => (
                <section key={g.id} className="flex flex-col gap-1" aria-label={g.label}>
                  {(reelGroups.length > 1 || g.id !== 'yours') && (
                    <h3 className="text-[11px] font-black uppercase tracking-wide text-slate-500 px-1">
                      {g.label} <span className="font-bold tabular-nums">({g.reels.length})</span>
                    </h3>
                  )}
                  {g.id === 'others' && <p className="text-[11px] text-slate-500 px-1 -mt-0.5">Only the owner and head coaches see these.</p>}
                  <ul className="flex flex-col gap-1">
                    {g.reels.map((r) => {
                      const n = r.items.length;
                      const who = r.owner && r.owner !== me ? r.ownerName || nameOf(r.owner) : '';
                      const fresh = r.familySend?.on || r.fromFamilies ? inboxOf(r).filter((i) => i.status === 'waiting' || i.status === 'updated').length : 0;
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => pickReel(r.id)}
                            aria-current={reelId === r.id ? 'true' : undefined}
                            className={`w-full text-left rounded-lg px-2 py-2 sm:py-1.5 ${reelId === r.id ? 'bg-indigo-50 dark:bg-indigo-500/15 ring-1 ring-indigo-300 dark:ring-indigo-500/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{r.name}</span>
                              {r.sharedWith.includes(FAMILIES) && (
                                <span className="shrink-0 text-[9px] font-black uppercase px-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" title={r.kind === 'player' && r.kid ? 'His family can watch' : 'Families can watch'}>
                                  Families
                                </span>
                              )}
                              {fresh > 0 && (
                                <span className="shrink-0 text-[9px] font-black uppercase px-1 rounded bg-pink-600 text-white" title="New clips from families">
                                  {fresh} new
                                </span>
                              )}
                              {r.familySend?.on && !fresh && (
                                <span className="shrink-0 text-[9px] font-black uppercase px-1 rounded bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-300" title="Families can send clips">
                                  Asking
                                </span>
                              )}
                            </span>
                            <span className="block text-[11px] text-slate-500 truncate">
                              {r.kind === 'game' ? 'Game' : r.kind === 'season' ? 'Season' : r.kind === 'player' ? 'Player' : 'Custom'} · {n} clip{n === 1 ? '' : 's'} · {clock(reelClipsSeconds(r))}
                              {who ? ` · by ${who}` : ''}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {!listedReels.length && <p className="text-sm text-slate-500 py-4 text-center">No reels yet.</p>}
            </div>
          </div>
          <div ref={reelRef} className={`${panel} p-3 min-w-0 flex flex-col gap-3 scroll-mt-2`}>
            {reel && reelClip && (
              <div ref={reelClipRef} className="rounded-xl border-2 border-indigo-300 dark:border-indigo-500/40 p-2 flex flex-col gap-2 min-w-0 scroll-mt-4">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-black text-indigo-700 dark:text-indigo-300 truncate">
                    {reel.name}: clip {reelClipAt + 1} of {reelList.length}
                  </span>
                  <button
                    type="button"
                    disabled={reelClipAt <= 0}
                    onClick={() => setReelClipId(reelList[reelClipAt - 1]?.id || null)}
                    className="h-7 px-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold disabled:opacity-40"
                  >
                    ‹ Previous
                  </button>
                  <button
                    type="button"
                    disabled={reelClipAt >= reelList.length - 1}
                    onClick={() => setReelClipId(reelList[reelClipAt + 1]?.id || null)}
                    className="h-7 px-2 rounded-lg border border-slate-300 dark:border-slate-600 font-bold disabled:opacity-40"
                  >
                    Next ›
                  </button>
                  <button type="button" onClick={() => setReelClipId(null)} className="ml-auto h-7 px-2 rounded-lg font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                    Back to the reel
                  </button>
                </div>
                <ClipEditor
                  key={reelClip.id}
                  h={reelClip}
                  store={store}
                  access={access}
                  shared={sharedOf[reelClip.game.key]}
                  plays={plays}
                  roster={roster}
                  onClose={() => setReelClipId(null)}
                  reels={myReels.map((r) => ({ id: r.id, name: r.name, has: r.items.some((it) => it.highlightId === reelClip.id) }))}
                  onAddToReel={(id) => {
                    if (id === '__new') {
                      const r = newReel({ name: `${reelClip.title || 'New'} reel`, kind: 'custom', owner: me, ownerName: myName, highlightIds: [reelClip.id] });
                      update((d) => ({ ...d, reels: [...d.reels, r] }));
                    } else update((d) => editReel(d, id, (r) => addToReel(r, [reelClip.id])));
                  }}
                />
              </div>
            )}
            {reel ? (
              <ReelEditor
                key={reel.id}
                openId={reelClipId}
                ownerLabel={reel.owner && reel.owner !== me ? reel.ownerName || nameOf(reel.owner) : undefined}
                inbox={reel.familySend?.on || reel.fromFamilies ? inboxOf(reel) : []}
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
                onOpenClip={(id) => setReelClipId((cur) => (cur === id ? null : id))}
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
          playerReels={data.reels.filter((r) => r.kind === 'player' && r.kid).length}
          onShareAll={() => {
            const ids = data.reels.filter((r) => r.kind === 'player' && r.kid && !r.sharedWith.includes(FAMILIES)).map((r) => r.id);
            if (!ids.length) return setStatus("Every kid's reel is already shared with his family.");
            update((d) => ids.reduce((acc, id) => editReel(acc, id, (r) => shareReel(r, FAMILIES, true)), d));
            setStatus(`Shared ${ids.length} kid's reel${ids.length === 1 ? '' : 's'}: each family sees only their own kid's (link the kid on their account in Staff & access).`);
          }}
        />
      )}

      {tab === 'settings' && !helper && (
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
  /** How many player reels there are, and share them all with each kid's family. */
  playerReels: number;
  onShareAll: () => void;
}> = ({ roster, highlights, min, plays, games, ro, onKeep, onReel, onAllReels, playerReels, onShareAll }) => {
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
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={onAllReels} className="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">
                A reel for every kid
              </button>
              {playerReels > 0 && (
                <button
                  type="button"
                  onClick={onShareAll}
                  className="h-7 px-2.5 rounded-lg border border-emerald-500 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                  title="Each kid's reel shows in Highlights for the family and player accounts linked to him (Staff & access → Kid)"
                >
                  Share each kid's reel with his family
                </button>
              )}
            </span>
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

