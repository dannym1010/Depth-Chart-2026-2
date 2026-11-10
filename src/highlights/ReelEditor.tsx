// One reel: its clips in the order it plays (moved by hand, or by game, kind, rating, or a top-10 countdown), what
// goes around them (intro, game cards, a kid's stats, titles, score, the end card, replays, a song), its length
// against a goal, and Play / Export.
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Instagram, Play as PlayIcon, Plus, Trash2, X } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { FilmAccess } from './filmAccess';
import { ExportPanel } from './ExportPanel';
import { loadImage } from './graphics';
import { addToReel, clock, editReel, EVERYONE, FAMILIES, kidLabel, kidsText, moveInReel, newReel, shareReel, orderedHighlights, reelTimeline, timelineSeconds, type Kid } from './highlightData';
import { libraryFolder, listFiles, subfolder } from './localLibrary';
import { ReelPlayer } from './ReelPlayer';
import { SocialVideoPanel } from './SocialVideoPanel';
import type { HighlightsData, Reel, ReelOptions } from './types';
import type { HighlightStore } from './useHighlights';

interface Props {
  reel: Reel;
  data: HighlightsData;
  store: HighlightStore;
  access: FilmAccess;
  games: Map<string, number>;
  roster: Kid[];
  plays: Play[];
  teamName: string;
  season: string;
  me: string;
  onOpenClip: (highlightId: string) => void;
  onDelete: () => void;
  /** The clip open in the editor above (marked in the list). */
  openId?: string | null;
}

const MUSIC = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;

export const ReelEditor: React.FC<Props> = ({ reel, data, store, access, games, roster, plays, teamName, season, me, onOpenClip, onDelete, openId }) => {
  const ro = store.readOnly;
  const o = reel.options;
  const settings = data.settings;
  const mine = reel.owner === me || !reel.owner;
  // A player reel goes to his family only.
  const forOneKid = reel.kind === 'player' && Boolean(reel.kid);
  const edit = (change: (r: Reel) => Reel) => !ro && store.update((d) => editReel(d, reel.id, change));
  const setOpt = (patch: Partial<ReelOptions>) => edit((r) => ({ ...r, options: { ...r.options, ...patch } }));

  const list = useMemo(() => orderedHighlights(reel, data.highlights, games), [reel, data.highlights, games]);
  const segments = useMemo(() => reelTimeline({ reel, highlights: data.highlights, games, settings, roster, plays, teamName }), [reel, data.highlights, games, settings, roster, plays, teamName]);
  const seconds = timelineSeconds(segments);
  const [playing, setPlaying] = useState(false);
  // Play from this highlight (its ▶ in the list), else from the start.
  const [playFrom, setPlayFrom] = useState<string | undefined>();
  const [exporting, setExporting] = useState(false);
  // Reel options: open on a computer, folded on a phone (the clips come first there).
  const [showOptions, setShowOptions] = useState(() => {
    try {
      return window.matchMedia('(min-width: 768px)').matches;
    } catch {
      return true;
    }
  });
  const [social, setSocial] = useState(false);
  const [adding, setAdding] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    void loadImage(settings.logo).then(setLogo);
  }, [settings.logo]);

  // Songs in the library's Music folder.
  const [songs, setSongs] = useState<{ name: string; get: () => Promise<File> }[]>([]);
  const [musicUrl, setMusicUrl] = useState<string | undefined>();
  useEffect(() => {
    let off = false;
    void (async () => {
      const { handle, ok } = await libraryFolder();
      if (!handle || !ok) return;
      const dir = await subfolder(handle, ['Music']);
      const files = await listFiles(dir, (n) => MUSIC.test(n));
      if (!off) setSongs(files);
    })().catch(() => undefined);
    return () => {
      off = true;
    };
  }, []);
  const play = async (from?: string) => {
    setPlayFrom(from);
    // The player opens right away (in the tap: a phone lets it start); the song joins when it's read.
    setPlaying(true);
    const song = o.music ? songs.find((s) => s.name === o.music) : undefined;
    if (song) setMusicUrl(URL.createObjectURL(await song.get()));
  };
  const stopPlaying = () => {
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setMusicUrl(undefined);
    setPlaying(false);
    setPlayFrom(undefined);
  };

  // Moving a clip by hand keeps the order as it shows now, then moves it.
  const move = (from: number, to: number) =>
    edit((r) => {
      const shown = orderedHighlights(r, data.highlights, games).map((h) => r.items.find((i) => i.highlightId === h.id)!).filter(Boolean);
      const base = { ...r, items: shown, options: { ...r.options, order: 'hand' as const } };
      return moveInReel(base, from, to);
    });
  const removeItem = (hid: string) => edit((r) => ({ ...r, items: r.items.filter((i) => i.highlightId !== hid) }));

  const notIn = useMemo(() => {
    const have = new Set(reel.items.map((i) => i.highlightId));
    return data.highlights.filter((h) => !have.has(h.id)).sort((a, b) => (games.get(a.game.key) ?? 0) - (games.get(b.game.key) ?? 0) || a.seq - b.seq);
  }, [reel.items, data.highlights, games]);
  const [toAdd, setToAdd] = useState<Set<string>>(new Set());
  // Finding them in a season's worth: by game, kid, stars or words.
  const [fGame, setFGame] = useState('');
  const [fKid, setFKid] = useState(reel.kind === 'player' && reel.kid ? String(Number(reel.kid)) : '');
  const [fStars, setFStars] = useState(0);
  const [fText, setFText] = useState('');
  const addGames = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of notIn) m.set(h.game.key, h.game.name);
    return [...m].sort((a, b) => (games.get(a[0]) ?? 0) - (games.get(b[0]) ?? 0));
  }, [notIn, games]);
  const addKids = useMemo(() => [...new Set(notIn.flatMap((h) => h.kids.map((k) => String(Number(k)))))].filter((k) => k !== 'NaN').sort((a, b) => Number(a) - Number(b)), [notIn]);
  const shownToAdd = useMemo(
    () =>
      notIn.filter(
        (h) =>
          (!fGame || h.game.key === fGame) &&
          (!fKid || h.kids.some((k) => String(Number(k)) === fKid)) &&
          h.rating >= fStars &&
          (!fText || `${h.title} ${h.note || ''} ${h.game.name}`.toLowerCase().includes(fText.toLowerCase()))
      ),
    [notIn, fGame, fKid, fStars, fText]
  );

  const sel = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs min-w-0';
  const check = (label: string, on: boolean, set: (v: boolean) => void) => (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
      <input type="checkbox" checked={on} disabled={ro} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
  const goal = o.lengthGoal;

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <input
          key={`name-${reel.id}-${reel.name}`}
          defaultValue={reel.name}
          disabled={ro}
          onBlur={(e) => e.target.value.trim() && e.target.value !== reel.name && edit((r) => ({ ...r, name: e.target.value.trim() }))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="basis-full sm:basis-auto flex-1 min-w-40 h-10 sm:h-9 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-base font-black"
          aria-label="Reel name"
        />
        <button type="button" onClick={() => void play()} disabled={!segments.length} className="h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
          <PlayIcon size={15} /> Play
        </button>
        <button type="button" onClick={() => setExporting(true)} disabled={!list.length} className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 font-bold text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
          <Download size={15} /> Export
        </button>
        <button type="button" onClick={() => setSocial(true)} disabled={!list.length} className="h-9 px-3 rounded-lg border border-pink-400 text-pink-700 dark:text-pink-300 font-bold text-sm inline-flex items-center gap-1.5 disabled:opacity-40" title="Make an MP4 for Instagram (Reel, Story or post)">
          <Instagram size={15} /> Instagram video
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>
          {list.length} clip{list.length === 1 ? '' : 's'} · <b className="text-slate-700 dark:text-slate-200">{clock(seconds)}</b> with cards and replays
        </span>
        {goal > 0 && (
          <span className={`font-bold ${seconds > goal ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {seconds > goal ? `${clock(seconds - goal)} over` : `${clock(goal - seconds)} to spare`} the {clock(goal)} goal
          </span>
        )}
        {mine && !ro && (
          <span className="inline-flex flex-wrap items-center gap-3 ml-auto">
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={reel.sharedWith.includes(EVERYONE)} onChange={(e) => edit((r) => shareReel(r, EVERYONE, e.target.checked))} />
              Shared with the staff
            </label>
            {/* Players' and families' accounts with the Film Room watch it in Highlights (watch only); a player
                reel only his own family (the accounts linked to him in Staff & access). */}
            <label
              className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400"
              title={forOneKid ? "Only the player and family accounts linked to this kid (Staff & access → Kid) can watch it" : "Every player and family account that has the Film Room can watch this reel (they can't change anything)"}
            >
              <input type="checkbox" checked={reel.sharedWith.includes(FAMILIES)} onChange={(e) => edit((r) => shareReel(r, FAMILIES, e.target.checked))} />
              {forOneKid ? 'His family can watch' : 'Families can watch'}
            </label>
          </span>
        )}
        {(!mine || ro) && reel.sharedWith.includes(FAMILIES) && <span className="ml-auto font-bold text-emerald-700 dark:text-emerald-400">{forOneKid ? 'His family can watch' : 'Families can watch'}</span>}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-1.5 min-w-0">
          <ol className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800" aria-label="Clips in the reel">
            {list.map((h, i) => (
              <li key={h.id} className={`flex items-center gap-2 px-2 py-1.5 ${openId === h.id ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}>
                <span className="w-6 text-right text-xs tabular-nums text-slate-400">{o.order === 'top10' ? `${list.length - i}` : i + 1}</span>
                <button type="button" onClick={() => onOpenClip(h.id)} className="min-w-0 flex-1 text-left" aria-current={openId === h.id ? 'true' : undefined} title="Edit this clip here (trim, zoom, slow motion…)">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{h.title}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {h.game.name} · {h.kind === 'extra' ? 'extra' : `#${h.playNumber}`} · {(h.end - h.start).toFixed(1)} s{'★'.repeat(h.rating) ? ` · ${'★'.repeat(h.rating)}` : ''}
                    {h.zoom ? ` · ${h.zoom.follow ? 'follows him' : `${h.zoom.level}× zoom`}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void play(h.id)}
                  className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                  aria-label={`Play the reel from ${h.title}`}
                  title="Play the reel from here"
                >
                  <PlayIcon size={14} />
                </button>
                {!ro && (
                  <span className="flex items-center shrink-0">
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="h-9 w-9 sm:h-7 sm:w-7 inline-flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" aria-label={`Move ${h.title} up`}>
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} className="h-9 w-9 sm:h-7 sm:w-7 inline-flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" aria-label={`Move ${h.title} down`}>
                      <ArrowDown size={14} />
                    </button>
                    <button type="button" onClick={() => removeItem(h.id)} className="h-9 w-9 sm:h-7 sm:w-7 inline-flex items-center justify-center rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label={`Take ${h.title} out of the reel`}>
                      <X size={14} />
                    </button>
                  </span>
                )}
              </li>
            ))}
            {!list.length && <li className="px-2 py-6 text-center text-sm text-slate-500">No clips in this reel yet.</li>}
          </ol>
          {!ro && (
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => setAdding((a) => !a)} className="self-start h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1">
                <Plus size={13} /> Add highlights ({notIn.length} not in it)
              </button>
              {adding && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {addGames.length > 1 && (
                      <select value={fGame} onChange={(e) => setFGame(e.target.value)} className={sel} aria-label="Game">
                        <option value="">Every game</option>
                        {addGames.map(([k, name]) => (
                          <option key={k} value={k}>{name}</option>
                        ))}
                      </select>
                    )}
                    {addKids.length > 0 && (
                      <select value={fKid} onChange={(e) => setFKid(e.target.value)} className={sel} aria-label="Kid">
                        <option value="">Every kid</option>
                        {addKids.map((k) => (
                          <option key={k} value={k}>{kidLabel(k, roster, 'full')}</option>
                        ))}
                      </select>
                    )}
                    <select value={fStars} onChange={(e) => setFStars(Number(e.target.value))} className={sel} aria-label="Stars">
                      <option value={0}>Any stars</option>
                      <option value={2}>★★ and up</option>
                      <option value={3}>★★★</option>
                    </select>
                    <input value={fText} onChange={(e) => setFText(e.target.value)} placeholder="Search" className={`${sel} flex-1 min-w-24`} aria-label="Search highlights" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <button
                      type="button"
                      className="font-bold text-indigo-600 dark:text-indigo-300 underline"
                      onClick={() => setToAdd((s) => (shownToAdd.every((h) => s.has(h.id)) ? new Set([...s].filter((id) => !shownToAdd.some((h) => h.id === id))) : new Set([...s, ...shownToAdd.map((h) => h.id)])))}
                      disabled={!shownToAdd.length}
                    >
                      {shownToAdd.length && shownToAdd.every((h) => toAdd.has(h.id)) ? 'Unpick these' : `Pick all ${shownToAdd.length} shown`}
                    </button>
                    <span>{notIn.length - shownToAdd.length > 0 ? `${notIn.length - shownToAdd.length} hidden by the filters` : ''}</span>
                  </div>
                  <ul className="max-h-72 overflow-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                    {shownToAdd.map((h) => (
                      <li key={h.id}>
                        <label className="flex items-center gap-2 text-xs py-2 sm:py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0"
                            checked={toAdd.has(h.id)}
                            onChange={(e) =>
                              setToAdd((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(h.id);
                                else n.delete(h.id);
                                return n;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">
                              <b>{h.title}</b> <span className="text-amber-500">{'★'.repeat(h.rating)}</span>
                            </span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {h.game.name}
                              {h.kids.length ? ` · ${kidsText(h.kids, roster, 'first')}` : ''}
                              {` · ${(h.end - h.start).toFixed(1)} s`}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                    {!shownToAdd.length && <li className="py-4 text-center text-xs text-slate-500">{notIn.length ? 'None match.' : 'Every highlight is in this reel.'}</li>}
                  </ul>
                  <button
                    type="button"
                    disabled={!toAdd.size}
                    onClick={() => {
                      edit((r) => addToReel(r, [...toAdd]));
                      setToAdd(new Set());
                      setAdding(false);
                    }}
                    className="self-start h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"
                  >
                    Add {toAdd.size || ''} to the reel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <fieldset className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-xs self-start w-full" disabled={ro}>
          <legend className="px-1">
            <button type="button" onClick={() => setShowOptions((x) => !x)} aria-expanded={showOptions} className="font-black text-slate-800 dark:text-slate-100 inline-flex items-center gap-1">
              Reel options <span className="text-slate-400 font-bold">{showOptions ? '▾' : '▸'}</span>
            </button>
          </legend>
          {!showOptions && (
            <button type="button" onClick={() => setShowOptions(true)} className="text-left text-slate-500">
              {[o.order === 'game' ? 'Game order' : o.order === 'category' ? 'By kind' : o.order === 'rating' ? 'Best first' : o.order === 'top10' ? 'Top 10' : 'By hand', o.intro ? 'intro card' : '', o.chapters ? 'game cards' : '', o.outro !== 'none' ? 'end card' : '', o.music ? `♪ ${o.music}` : ''].filter(Boolean).join(' · ')}
            </button>
          )}
          {showOptions && (
          <>
          <label className="flex items-center gap-2">
            <span className="w-20 text-slate-600 dark:text-slate-300">Order</span>
            <select value={o.order} onChange={(e) => setOpt({ order: e.target.value as ReelOptions['order'] })} className={sel}>
              <option value="game">Game order</option>
              <option value="category">By kind</option>
              <option value="rating">Best first</option>
              <option value="top10">Top 10 countdown</option>
              <option value="hand">By hand</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 text-slate-600 dark:text-slate-300">Length goal</span>
            <select value={o.lengthGoal} onChange={(e) => setOpt({ lengthGoal: Number(e.target.value) })} className={sel}>
              <option value={0}>None</option>
              {[60, 90, 120, 180, 300, 600].map((s) => (
                <option key={s} value={s}>{clock(s)}</option>
              ))}
            </select>
          </label>
          {check('Intro card', o.intro, (v) => setOpt({ intro: v }))}
          {o.intro && (
            <>
              <input key={`it-${o.introTitle}`} defaultValue={o.introTitle} onBlur={(e) => setOpt({ introTitle: e.target.value })} placeholder="Title (made for you when blank)" className={sel} aria-label="Intro title" />
              <input key={`is-${o.introSub}`} defaultValue={o.introSub} onBlur={(e) => setOpt({ introSub: e.target.value })} placeholder="Second line (date, score, record)" className={sel} aria-label="Intro second line" />
            </>
          )}
          {check('A card before each game', o.chapters, (v) => setOpt({ chapters: v }))}
          {reel.kind === 'player' && check("The kid's season stats card", o.statsCard, (v) => setOpt({ statsCard: v }))}
          <label className="flex items-center gap-2">
            <span className="w-20 text-slate-600 dark:text-slate-300">Titles</span>
            <select value={o.lowerThird} onChange={(e) => setOpt({ lowerThird: e.target.value as ReelOptions['lowerThird'] })} className={sel}>
              <option value="result_kid">Title + kids</option>
              <option value="result">Title only</option>
              <option value="full">Title, kids, game, play</option>
              <option value="none">None</option>
            </select>
          </label>
          {check('Score in a corner', o.scoreBug, (v) => setOpt({ scoreBug: v }))}
          {o.scoreBug && <input key={`sb-${o.scoreText}`} defaultValue={o.scoreText} onBlur={(e) => setOpt({ scoreText: e.target.value })} placeholder="MAH 28  SO 6" className={sel} aria-label="Score text" />}
          <label className="flex items-center gap-2">
            <span className="w-20 text-slate-600 dark:text-slate-300">End card</span>
            <select value={o.outro} onChange={(e) => setOpt({ outro: e.target.value as ReelOptions['outro'] })} className={sel}>
              <option value="score">Final score</option>
              <option value="next">Next game</option>
              <option value="thanks">Thanks</option>
              <option value="none">None</option>
            </select>
          </label>
          {o.outro !== 'none' && <input key={`ot-${o.outroText}`} defaultValue={o.outroText} onBlur={(e) => setOpt({ outroText: e.target.value })} placeholder={o.outro === 'score' ? 'Final: Mahopac 28, Shrub Oak 6' : o.outro === 'next' ? 'Next: Week 5 vs …' : 'Thanks for a great season'} className={sel} aria-label="End card text" />}
          <label className="flex items-center gap-2">
            <span className="w-20 text-slate-600 dark:text-slate-300">Replays</span>
            <select value={o.replays} onChange={(e) => setOpt({ replays: e.target.value as ReelOptions['replays'] })} className={sel}>
              <option value="each">As set on each clip</option>
              <option value="all">Every clip (slowed)</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 text-slate-600 dark:text-slate-300">Between</span>
            <select value={o.transition} onChange={(e) => setOpt({ transition: e.target.value as ReelOptions['transition'] })} className={sel}>
              <option value="cut">Cut</option>
              <option value="dip">Dip to black</option>
              <option value="fade">Quick fade</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 text-slate-600 dark:text-slate-300">Cards stay</span>
            <select value={o.cardSeconds} onChange={(e) => setOpt({ cardSeconds: Number(e.target.value) })} className={sel}>
              {[2, 3, 4, 5].map((s) => (
                <option key={s} value={s}>{s} s</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 text-slate-600 dark:text-slate-300">Music</span>
            <select value={o.music || ''} onChange={(e) => setOpt({ music: e.target.value || undefined })} className={sel}>
              <option value="">None</option>
              {songs.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
              {o.music && !songs.some((s) => s.name === o.music) && <option value={o.music}>{o.music} (not on this computer)</option>}
            </select>
          </label>
          {!songs.length && <span className="text-[11px] text-slate-500">Songs: put them in the Music folder inside the highlights folder (Settings).</span>}
          </>
          )}
        </fieldset>
      </div>

      {!ro && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
          <button
            type="button"
            onClick={() => {
              const copy = { ...newReel({ name: `${reel.name} (copy)`, kind: reel.kind, owner: me, gameKey: reel.gameKey, kid: reel.kid }), items: reel.items.map((i) => ({ ...i })), options: { ...reel.options } };
              store.update((d) => ({ ...d, reels: [...d.reels, copy] }));
            }}
            className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold inline-flex items-center gap-1"
          >
            <Copy size={12} /> Copy this reel
          </button>
          <button type="button" onClick={onDelete} className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <Trash2 size={12} /> Delete reel
          </button>
        </div>
      )}

      {playing && <ReelPlayer title={reel.name} segments={segments} access={access} settings={settings} logo={logo} musicUrl={musicUrl} transition={o.transition} onClose={stopPlaying} startAt={playFrom} />}
      {social && (
        <SocialVideoPanel
          title={reel.name}
          segments={segments}
          access={access}
          settings={settings}
          logo={logo}
          transition={o.transition}
          music={o.music ? songs.find((s) => s.name === o.music) : undefined}
          onClose={() => setSocial(false)}
        />
      )}
      {exporting && <ExportPanel reelName={reel.name} segments={segments} access={access} settings={settings} logo={logo} data={data} teamName={teamName} season={season} onClose={() => setExporting(false)} />}
    </div>
  );
};
