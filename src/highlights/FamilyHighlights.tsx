// Highlights for a player's or a family's account: their kid's clips (every highlight coaches kept with him), the
// reels coaches shared with them, and their own highlights, made from any play of our games and kept on this device
// only (trim, slow motion, circles, follow the kid), to play and to make Instagram videos. Nothing goes to the cloud
// or to the coaches; coaches' notes, suggestions and settings aren't shown.
import React, { useEffect, useMemo, useState } from 'react';
import { Clapperboard, CopyPlus, FolderOpen, Instagram, Pencil, Play as PlayIcon, Plus, Smartphone, Star, Trash2 } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { FilmGameShared } from '../filmroom/types';
import { playsForPlayer } from '../filmroom/playerPlays';
import { ClipEditor } from './ClipEditor';
import type { AccessState, FilmAccess } from './filmAccess';
import { loadImage } from './graphics';
import {
  addHighlights, clock, familyReels, gameOrder, kidHighlights, kidLabel, kidsText, newReel, orderedHighlights, reelTimeline, removeHighlights, timelineSeconds,
  type Kid, type Segment,
} from './highlightData';
import { keepPlaysAsHighlights } from './keepPlays';
import { ReelPlayer } from './ReelPlayer';
import { SocialVideoPanel } from './SocialVideoPanel';
import type { Highlight, HighlightGame, Reel } from './types';
import type { HighlightStore } from './useHighlights';

interface Props {
  teamName: string;
  season: string;
  /** The team's highlights (coaches'), read only. */
  store: HighlightStore;
  /** This person's own highlights, on this device. */
  mine: HighlightStore;
  access: FilmAccess;
  loadShared: (gameKey: string) => Promise<Partial<FilmGameShared>>;
  games: HighlightGame[];
  plays: Play[];
  roster: Kid[];
  /** Their kid(s), by jersey number, linked by a coach in Staff & access. */
  kids: string[];
  me: string;
  /** A coach let this account see all highlights: every kid's clips (and the whole team's), every reel shared with families. */
  seeAll?: boolean;
  /** Shown at the right of the title row (a helper's switch to the team's highlights). */
  extra?: React.ReactNode;
}

/** In the kid picker: every clip of the team. */
export const WHOLE_TEAM = '*';

/** A reel made on the spot (never saved): a kid's clips, picked clips, or one clip. */
export function tempReel(name: string, ids: string[], kid?: string, opts: { cards?: boolean } = {}): Reel {
  const r = newReel({ name, kind: kid ? 'player' : 'custom', owner: '', kid, highlightIds: ids, now: 0 });
  if (opts.cards === false) r.options = { ...r.options, intro: false, chapters: false, outro: 'none', statsCard: false };
  return r;
}

/** A copy of a coach's highlight in this person's own list (so they can trim it their way). */
export function copyHighlight(h: Highlight, by: string, now = Date.now()): Highlight {
  return { ...h, id: `mine_${h.id}_${now.toString(36)}`, note: undefined, createdBy: by, createdAt: now, editedAt: now };
}

const playLine = (p: Play) =>
  [
    `#${p.playNumber}`,
    p.quarter ? `Q${p.quarter}` : '',
    p.odk === 'D' ? 'Defense' : p.odk === 'K' ? 'Kick' : p.playType === 'PASS' ? 'Pass' : p.playType === 'RUN' ? 'Run' : '',
    Number(p.gainLoss) ? `${Number(p.gainLoss) > 0 ? '+' : ''}${p.gainLoss} yds` : '',
    p.result && p.result !== '-' ? p.result : '',
  ]
    .filter(Boolean)
    .join(' · ');

export const FamilyHighlights: React.FC<Props> = ({ teamName, season, store, mine, access, loadShared, games, plays, roster, kids, me, seeAll = false, extra }) => {
  const { data } = store;
  const settings = data.settings;
  const order = useMemo(() => gameOrder(games), [games]);
  const sortedGames = useMemo(() => games.slice().sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)), [games, order]);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    void loadImage(settings.logo).then(setLogo);
  }, [settings.logo]);
  // Their own highlights use the team's look (colors, titles, trim around the snap).
  useEffect(() => {
    if (!mine.readOnly && settings.editedAt > (mine.data.settings.editedAt || 0)) mine.update((d) => ({ ...d, settings }));
  }, [settings, mine]);
  const [state, setState] = useState<AccessState | 'checking'>('checking');
  const [status, setStatus] = useState('');
  useEffect(() => {
    void access.state().then(setState);
  }, [access]);

  const myKids = useMemo(() => [...new Set(kids.map((k) => String(Number(k))).filter((k) => k !== 'NaN'))], [kids]);
  // Who they may pick: their kid(s); with all highlights, also the whole team and every kid with a clip.
  const choices = useMemo(() => {
    if (!seeAll) return myKids;
    const others = new Set<string>();
    for (const h of data.highlights) for (const k of h.kids) others.add(String(Number(k)));
    const rest = [...others].filter((k) => k !== 'NaN' && !myKids.includes(k)).sort((a, b) => Number(a) - Number(b));
    return [...myKids, WHOLE_TEAM, ...rest];
  }, [seeAll, myKids, data.highlights]);
  const [kid, setKid] = useState(choices[0] || '');
  useEffect(() => {
    if (!choices.includes(kid)) setKid(choices[0] || '');
  }, [choices, kid]);
  const inOrder = (list: Highlight[]) => list.slice().sort((a, b) => (order.get(a.game.key) ?? 999) - (order.get(b.game.key) ?? 999) || a.seq - b.seq);
  const team = kid === WHOLE_TEAM;
  const clips = useMemo(() => (team ? inOrder(data.highlights) : kid ? inOrder(kidHighlights(data.highlights, kid)) : []), [data.highlights, kid, team, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const reels = useMemo(() => familyReels(data, myKids, { all: seeAll }), [data, myKids, seeAll]);
  const myClips = useMemo(() => inOrder(mine.data.highlights), [mine.data.highlights, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [myPicked, setMyPicked] = useState<Set<string>>(new Set());
  useEffect(() => setPicked(new Set()), [kid]);

  // What's playing, or being made into an Instagram video.
  const [show, setShow] = useState<{ title: string; segments: Segment[]; transition: Reel['options']['transition']; mode: 'play' | 'social' } | null>(null);
  const open = (reel: Reel, mode: 'play' | 'social', highlights: Highlight[] = data.highlights) => {
    const segments = reelTimeline({ reel, highlights, games: order, settings, roster, plays, teamName });
    if (!segments.length) return setStatus('Nothing to play in that one yet.');
    setShow({ title: reel.name, segments, transition: reel.options.transition, mode });
  };
  const kidName = team ? teamName : kid ? kidLabel(kid, roster, 'full') : '';
  const kidReel = (ids: string[], cards = true) => tempReel(`${kidName} highlights`, ids, team ? undefined : kid, { cards });
  // Their own: named for their kid (the first, with more than one).
  const ownKid = myKids.includes(kid) ? kid : myKids[0] || '';
  const ownName = ownKid ? kidLabel(ownKid, roster, 'full') : '';
  const myReel = (ids: string[], cards = true) => tempReel(ownName ? `${ownName} highlights` : 'My highlights', ids, ownKid || undefined, { cards });

  // ---- Making their own ----
  const [adding, setAdding] = useState(false);
  const [addGame, setAddGame] = useState('');
  const game = sortedGames.find((g) => g.key === addGame) || sortedGames[sortedGames.length - 1];
  const gamePlays = useMemo(() => (game ? plays.filter((p) => p.gameId === game.gameId).sort((a, b) => a.playNumber - b.playNumber) : []), [plays, game]);
  // Their kid's plays first (what the breakdown credits him with), then the rest of the game.
  const kidRoles = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of myKids) for (const r of playsForPlayer(gamePlays, k)) m.set(r.play.id, [kidLabel(k, roster, 'first'), [...r.roles, ...r.events.map((e) => e.toUpperCase())].join(', ')].filter(Boolean).join(': '));
    return m;
  }, [gamePlays, myKids, roster]);
  const taken = useMemo(() => new Set(mine.data.highlights.filter((h) => h.game.key === game?.key && h.playId).map((h) => h.playId!)), [mine.data.highlights, game?.key]);
  const listed = useMemo(() => [...gamePlays.filter((p) => kidRoles.has(p.id)), ...gamePlays.filter((p) => !kidRoles.has(p.id))], [gamePlays, kidRoles]);
  const [busy, setBusy] = useState(false);
  const keep = async (list: Play[]) => {
    if (!game || !list.length || busy) return;
    setBusy(true);
    try {
      await keepPlaysAsHighlights({ store: mine, access, game, list, gamePlays, shared: await loadShared(game.key).catch(() => ({})), settings, by: me, onStatus: setStatus });
    } catch (err: any) {
      setStatus(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };
  const copyToMine = (h: Highlight) => {
    if (mine.data.highlights.some((x) => x.playId && x.playId === h.playId && x.game.key === h.game.key)) return setStatus('That play is already in your highlights.');
    mine.update((d) => addHighlights(d, [copyHighlight(h, me)]));
    setStatus(`Copied “${h.title}” to your highlights: trim it your way with the pencil.`);
  };
  const [editId, setEditId] = useState<string | null>(null);
  const editing = mine.data.highlights.find((h) => h.id === editId) || null;
  const [sharedOf, setSharedOf] = useState<Record<string, Partial<FilmGameShared>>>({});
  useEffect(() => {
    const key = editing?.game.key;
    if (!key || sharedOf[key]) return;
    void loadShared(key)
      .catch(() => ({}))
      .then((s) => setSharedOf((m) => ({ ...m, [key]: s })));
  }, [editing?.game.key, loadShared, sharedOf]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const connect = async () => {
    try {
      setState(await access.connect());
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };
  const panel = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 min-w-0';
  const btn = 'h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40';
  const iconBtn = 'h-7 w-7 inline-flex items-center justify-center rounded-lg shrink-0';
  const stars = (n: number) => (
    <span className="inline-flex shrink-0" aria-label={`${n} star${n > 1 ? 's' : ''}`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={11} className={i <= n ? 'text-amber-400 fill-current' : 'text-slate-300 dark:text-slate-600'} />
      ))}
    </span>
  );
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, on: boolean) =>
    set((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const pickedIds = clips.filter((h) => picked.has(h.id)).map((h) => h.id);
  const myPickedIds = myClips.filter((h) => myPicked.has(h.id)).map((h) => h.id);

  return (
    <div className="flex flex-col gap-3 p-2 sm:p-4 max-w-[1100px] mx-auto w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Clapperboard size={22} className="text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Highlights</h2>
        <span className="text-xs text-slate-500">{season} season · watch, make your own, save for Instagram</span>
        {extra && <span className="sm:ml-auto">{extra}</span>}
      </div>

      {(state === 'ask' || state === 'signin' || state === 'none') && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-100 text-xs px-3 py-2">
          <FolderOpen size={14} />
          {state === 'none' ? 'The team film isn’t linked yet. Ask a coach.' : state === 'ask' ? 'The film folder needs a click to open.' : 'The film is in the team Google Drive.'}
          {state !== 'none' && (
            <button type="button" onClick={() => void connect()} className="h-7 px-3 rounded-lg bg-amber-500 text-slate-900 font-bold">
              {state === 'ask' ? 'Open the film folder' : 'Sign in with Google'}
            </button>
          )}
        </div>
      )}
      {status && (
        <div role="status" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
          {status}
          <button type="button" className="underline" onClick={() => setStatus('')}>OK</button>
        </div>
      )}

      {/* ---- Their kid's clips (kept by the coaches) ---- */}
      <section className={panel} aria-label="Your kid's clips">
        <div className="flex flex-wrap items-center gap-2">
          {choices.length > 1 ? (
            <select value={kid} onChange={(e) => setKid(e.target.value)} className="h-8 max-w-[60vw] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-sm font-black" aria-label="Whose clips">
              {choices.map((k) => (
                <option key={k} value={k}>
                  {k === WHOLE_TEAM ? `Whole team (${data.highlights.length})` : kidLabel(k, roster, 'full')}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-black text-slate-900 dark:text-slate-100">{kid ? kidName : 'Your kid'}</span>
          )}
          {kid && (
            <span className="text-xs text-slate-500">
              {clips.length} clip{clips.length === 1 ? '' : 's'} from the coaches · {clock(clips.reduce((n, h) => n + (h.end - h.start), 0))}
            </span>
          )}
          {clips.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              <button type="button" onClick={() => open(kidReel(clips.map((h) => h.id)), 'play')} className={`${btn} bg-indigo-600 text-white`}>
                <PlayIcon size={13} /> Play all
              </button>
              <button
                type="button"
                onClick={() => open(kidReel(pickedIds.length ? pickedIds : clips.map((h) => h.id), false), 'social')}
                className={`${btn} border border-pink-400 text-pink-700 dark:text-pink-300`}
                title="Make an MP4 for Instagram on this device (one video, or one per clip)"
              >
                <Instagram size={13} /> Instagram video{pickedIds.length ? ` (${pickedIds.length} picked)` : ''}
              </button>
            </span>
          )}
        </div>
        {!choices.length ? (
          <p className="text-sm text-slate-500 py-4 text-center">No kid is linked to this account yet. Ask a coach to link your kid (Staff &amp; access → Kid), and the coaches' clips of him show up here. You can still make your own below.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[45vh] overflow-auto -mx-1" aria-label={`${kidName} clips`}>
            {clips.map((h) => (
              <li key={h.id} className="flex items-center gap-2 px-1 py-1.5">
                <input type="checkbox" checked={picked.has(h.id)} onChange={(e) => toggle(setPicked, h.id, e.target.checked)} aria-label={`Pick ${h.title} for an Instagram video`} />
                {stars(h.rating)}
                <button type="button" onClick={() => open(kidReel([h.id], false), 'play')} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{h.title}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {h.game.name}
                    {team
                      ? h.kids.length
                        ? ` · ${kidsText(h.kids, roster, 'first')}`
                        : ''
                      : h.kids.length > 1
                        ? ` · with ${kidsText(h.kids.filter((k) => String(Number(k)) !== kid), roster, 'first')}`
                        : ''}
                  </span>
                </button>
                <span className="text-[11px] tabular-nums text-slate-500 shrink-0">{(h.end - h.start).toFixed(1)} s</span>
                <button type="button" onClick={() => open(kidReel([h.id], false), 'play')} className={`${iconBtn} bg-indigo-600 text-white`} aria-label={`Play ${h.title}`}>
                  <PlayIcon size={12} />
                </button>
                <button type="button" onClick={() => open(kidReel([h.id], false), 'social')} className={`${iconBtn} border border-pink-400 text-pink-600 dark:text-pink-300`} aria-label={`Instagram video of ${h.title}`}>
                  <Instagram size={12} />
                </button>
                {!mine.readOnly && (
                  <button type="button" onClick={() => copyToMine(h)} className={`${iconBtn} border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300`} title="Copy to my highlights (to trim it my way)" aria-label={`Copy ${h.title} to my highlights`}>
                    <CopyPlus size={12} />
                  </button>
                )}
              </li>
            ))}
            {!clips.length && (
              <li className="py-6 text-center text-sm text-slate-500">
                {team ? 'No highlights from the coaches yet.' : `No highlights with ${kidName} from the coaches yet.`} Make your own below.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* ---- Their own, on this device ---- */}
      {!mine.readOnly && (
        <section className={panel} aria-label="My highlights">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-slate-900 dark:text-slate-100">My highlights</span>
            <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
              <Smartphone size={12} /> on this device only · {myClips.length} clip{myClips.length === 1 ? '' : 's'}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding} className={`${btn} border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200`}>
                <Plus size={13} /> Add plays
              </button>
              {myClips.length > 0 && (
                <>
                  <button type="button" onClick={() => open(myReel(myPickedIds.length ? myPickedIds : myClips.map((h) => h.id)), 'play', myClips)} className={`${btn} bg-indigo-600 text-white`}>
                    <PlayIcon size={13} /> Play{myPickedIds.length ? ` ${myPickedIds.length}` : ' all'}
                  </button>
                  <button type="button" onClick={() => open(myReel(myPickedIds.length ? myPickedIds : myClips.map((h) => h.id), false), 'social', myClips)} className={`${btn} border border-pink-400 text-pink-700 dark:text-pink-300`}>
                    <Instagram size={13} /> Instagram video{myPickedIds.length ? ` (${myPickedIds.length} picked)` : ''}
                  </button>
                </>
              )}
            </span>
          </div>

          {adding && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <select value={game?.key || ''} onChange={(e) => setAddGame(e.target.value)} className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs font-bold" aria-label="Game">
                  {sortedGames.map((g) => (
                    <option key={g.key} value={g.key}>{g.name}</option>
                  ))}
                </select>
                {kidRoles.size > 0 && (
                  <button type="button" disabled={busy} onClick={() => void keep(listed.filter((p) => kidRoles.has(p.id) && !taken.has(p.id)))} className={`${btn} bg-indigo-600 text-white`}>
                    <Plus size={13} /> Add all {myKids.length === 1 ? `${kidLabel(myKids[0], roster, 'first')}'s` : 'my kids’'} plays
                  </button>
                )}
                <span className="text-[11px] text-slate-500">Each play is cut at the snap; trim it with the pencil.</span>
              </div>
              <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-auto" aria-label="Plays of the game">
                {listed.map((p) => {
                  const roles = kidRoles.get(p.id);
                  const done = taken.has(p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{playLine(p)}</span>
                        {roles && <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 truncate">{roles}</span>}
                      </span>
                      {done ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Added</span>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => void keep([p])} className="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold disabled:opacity-40">
                          Add
                        </button>
                      )}
                    </li>
                  );
                })}
                {!listed.length && <li className="py-4 text-center text-xs text-slate-500">No plays in this game's breakdown yet.</li>}
              </ul>
            </div>
          )}

          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[45vh] overflow-auto -mx-1" aria-label="My highlights">
            {myClips.map((h) => (
              <li key={h.id} className={`flex items-center gap-2 px-1 py-1.5 ${editId === h.id ? 'bg-indigo-50 dark:bg-indigo-500/15 rounded' : ''}`}>
                <input type="checkbox" checked={myPicked.has(h.id)} onChange={(e) => toggle(setMyPicked, h.id, e.target.checked)} aria-label={`Pick ${h.title}`} />
                <button type="button" onClick={() => setEditId(h.id)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{h.title}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {h.game.name}
                    {h.kind === 'play' ? ` · #${h.playNumber}` : ''}
                    {h.slow ? ' · slow-mo' : ''}
                    {h.marks?.length ? ' · circled' : ''}
                    {h.follow ? ' · follows' : ''}
                    {h.zoom ? ' · zoomed' : ''}
                  </span>
                </button>
                <span className="text-[11px] tabular-nums text-slate-500 shrink-0">{(h.end - h.start).toFixed(1)} s</span>
                <button type="button" onClick={() => setEditId(h.id)} className={`${iconBtn} border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300`} aria-label={`Edit ${h.title}`} title="Trim, slow motion, circle him, follow him">
                  <Pencil size={12} />
                </button>
                <button type="button" onClick={() => open(myReel([h.id], false), 'play', myClips)} className={`${iconBtn} bg-indigo-600 text-white`} aria-label={`Play ${h.title}`}>
                  <PlayIcon size={12} />
                </button>
                <button type="button" onClick={() => open(myReel([h.id], false), 'social', myClips)} className={`${iconBtn} border border-pink-400 text-pink-600 dark:text-pink-300`} aria-label={`Instagram video of ${h.title}`}>
                  <Instagram size={12} />
                </button>
                {confirmDelete === h.id ? (
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        mine.update((d) => removeHighlights(d, [h.id]));
                        setConfirmDelete(null);
                        if (editId === h.id) setEditId(null);
                      }}
                      className="h-7 px-2 rounded-lg bg-rose-600 text-white font-bold"
                    >
                      Delete
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="underline">Keep</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(h.id)} className={`${iconBtn} text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10`} aria-label={`Delete ${h.title}`}>
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            ))}
            {!myClips.length && (
              <li className="py-6 text-center text-sm text-slate-500">
                Make your own: tap <b>Add plays</b>, pick a game and add plays (your kid's are at the top), or copy a coach's clip with the <CopyPlus size={12} className="inline" /> button. They stay on this device.
              </li>
            )}
          </ul>

          {editing && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 min-w-0">
              <ClipEditor key={editing.id} h={editing} store={mine} access={access} shared={sharedOf[editing.game.key]} plays={plays} roster={roster} onClose={() => setEditId(null)} reels={[]} />
            </div>
          )}
        </section>
      )}

      {/* ---- Reels the coaches shared ---- */}
      <section className={panel} aria-label="Reels">
        <span className="text-sm font-black text-slate-900 dark:text-slate-100">Reels</span>
        <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {reels.map((r) => {
            const n = orderedHighlights(r, data.highlights, order).length;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{r.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {n} clip{n === 1 ? '' : 's'} · {clock(timelineSeconds(reelTimeline({ reel: r, highlights: data.highlights, games: order, settings, roster, plays, teamName })))}
                  </span>
                </span>
                <button type="button" onClick={() => open(r, 'play')} disabled={!n} className={`${btn} bg-indigo-600 text-white`}>
                  <PlayIcon size={13} /> Play
                </button>
                <button type="button" onClick={() => open(r, 'social')} disabled={!n} className={`${btn} border border-pink-400 text-pink-700 dark:text-pink-300`}>
                  <Instagram size={13} /> Instagram video
                </button>
              </li>
            );
          })}
          {!reels.length && <li className="py-6 text-center text-sm text-slate-500">No reels shared with you yet.</li>}
        </ul>
      </section>

      {show?.mode === 'play' && <ReelPlayer title={show.title} segments={show.segments} access={access} settings={settings} logo={logo} transition={show.transition} onClose={() => setShow(null)} />}
      {show?.mode === 'social' && <SocialVideoPanel title={show.title} segments={show.segments} access={access} settings={settings} logo={logo} transition={show.transition} onClose={() => setShow(null)} />}
    </div>
  );
};
