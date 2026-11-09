// Highlights for a player's or a family's account, watch only: their kid's clips (every highlight he's in) and the
// reels coaches shared with families. They can play them and make Instagram videos on their own device; nothing they
// do is saved, and coaches' notes, suggestions and settings aren't shown.
import React, { useEffect, useMemo, useState } from 'react';
import { Clapperboard, FolderOpen, Instagram, Play as PlayIcon, Star } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { AccessState, FilmAccess } from './filmAccess';
import { loadImage } from './graphics';
import { clock, familyReels, gameOrder, kidHighlights, kidLabel, kidsText, newReel, orderedHighlights, reelTimeline, timelineSeconds, type Kid, type Segment } from './highlightData';
import { ReelPlayer } from './ReelPlayer';
import { SocialVideoPanel } from './SocialVideoPanel';
import type { Highlight, HighlightGame, Reel } from './types';
import type { HighlightStore } from './useHighlights';

interface Props {
  teamName: string;
  season: string;
  store: HighlightStore;
  access: FilmAccess;
  games: HighlightGame[];
  plays: Play[];
  roster: Kid[];
  /** Their kid(s), by jersey number, linked by a coach in Staff & access. */
  kids: string[];
}

/** A reel made on the spot (never saved): a kid's clips, picked clips, or one clip. */
export function tempReel(name: string, ids: string[], kid?: string, opts: { cards?: boolean } = {}): Reel {
  const r = newReel({ name, kind: kid ? 'player' : 'custom', owner: '', kid, highlightIds: ids, now: 0 });
  if (opts.cards === false) r.options = { ...r.options, intro: false, chapters: false, outro: 'none', statsCard: false };
  return r;
}

export const FamilyHighlights: React.FC<Props> = ({ teamName, season, store, access, games, plays, roster, kids }) => {
  const { data } = store;
  const settings = data.settings;
  const order = useMemo(() => gameOrder(games), [games]);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    void loadImage(settings.logo).then(setLogo);
  }, [settings.logo]);
  const [state, setState] = useState<AccessState | 'checking'>('checking');
  const [status, setStatus] = useState('');
  useEffect(() => {
    void access.state().then(setState);
  }, [access]);

  const myKids = useMemo(() => [...new Set(kids.map((k) => String(Number(k))).filter((k) => k !== 'NaN'))], [kids]);
  const [kid, setKid] = useState(myKids[0] || '');
  useEffect(() => {
    if (!myKids.includes(kid)) setKid(myKids[0] || '');
  }, [myKids, kid]);
  const inOrder = (list: Highlight[]) => list.slice().sort((a, b) => (order.get(a.game.key) ?? 999) - (order.get(b.game.key) ?? 999) || a.seq - b.seq);
  const clips = useMemo(() => (kid ? inOrder(kidHighlights(data.highlights, kid)) : []), [data.highlights, kid, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const reels = useMemo(() => familyReels(data, myKids), [data, myKids]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => setPicked(new Set()), [kid]);

  // What's playing, or being made into an Instagram video.
  const [show, setShow] = useState<{ title: string; segments: Segment[]; transition: Reel['options']['transition']; mode: 'play' | 'social' } | null>(null);
  const open = (reel: Reel, mode: 'play' | 'social') => {
    const segments = reelTimeline({ reel, highlights: data.highlights, games: order, settings, roster, plays, teamName });
    if (!segments.length) return setStatus('Nothing to play in that one yet.');
    setShow({ title: reel.name, segments, transition: reel.options.transition, mode });
  };
  const kidName = kid ? kidLabel(kid, roster, 'full') : '';
  const kidReel = (ids: string[], cards = true) => tempReel(`${kidName} highlights`, ids, kid, { cards });

  const connect = async () => {
    try {
      setState(await access.connect());
    } catch (err: any) {
      setStatus(err?.message || String(err));
    }
  };
  const panel = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col gap-2 min-w-0';
  const btn = 'h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40';
  const stars = (n: number) => (
    <span className="inline-flex shrink-0" aria-label={`${n} star${n > 1 ? 's' : ''}`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={11} className={i <= n ? 'text-amber-400 fill-current' : 'text-slate-300 dark:text-slate-600'} />
      ))}
    </span>
  );
  const pickedIds = clips.filter((h) => picked.has(h.id)).map((h) => h.id);

  return (
    <div className="flex flex-col gap-3 p-2 sm:p-4 max-w-[1100px] mx-auto w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Clapperboard size={22} className="text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Highlights</h2>
        <span className="text-xs text-slate-500">{season} season · watch and save for Instagram</span>
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

      <section className={panel} aria-label="Your kid's clips">
        <div className="flex flex-wrap items-center gap-2">
          {myKids.length > 1 ? (
            <select value={kid} onChange={(e) => setKid(e.target.value)} className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-sm font-black" aria-label="Kid">
              {myKids.map((k) => (
                <option key={k} value={k}>{kidLabel(k, roster, 'full')}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-black text-slate-900 dark:text-slate-100">{kid ? kidName : 'Your kid'}</span>
          )}
          {kid && (
            <span className="text-xs text-slate-500">
              {clips.length} clip{clips.length === 1 ? '' : 's'} · {clock(clips.reduce((n, h) => n + (h.end - h.start), 0))}
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
        {!myKids.length ? (
          <p className="text-sm text-slate-500 py-4 text-center">No kid is linked to this account yet. Ask a coach to link your kid (Staff &amp; access → Kid), and his clips show up here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 max-h-[55vh] overflow-auto -mx-1" aria-label={`${kidName} clips`}>
            {clips.map((h) => (
              <li key={h.id} className="flex items-center gap-2 px-1 py-1.5">
                <input
                  type="checkbox"
                  checked={picked.has(h.id)}
                  onChange={(e) =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(h.id);
                      else n.delete(h.id);
                      return n;
                    })
                  }
                  aria-label={`Pick ${h.title} for an Instagram video`}
                />
                {stars(h.rating)}
                <button type="button" onClick={() => open(kidReel([h.id], false), 'play')} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{h.title}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {h.game.name}
                    {h.kids.length > 1 ? ` · with ${kidsText(h.kids.filter((k) => String(Number(k)) !== kid), roster, 'first')}` : ''}
                  </span>
                </button>
                <span className="text-[11px] tabular-nums text-slate-500 shrink-0">{(h.end - h.start).toFixed(1)} s</span>
                <button type="button" onClick={() => open(kidReel([h.id], false), 'play')} className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white shrink-0" aria-label={`Play ${h.title}`}>
                  <PlayIcon size={12} />
                </button>
                <button type="button" onClick={() => open(kidReel([h.id], false), 'social')} className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-pink-400 text-pink-600 dark:text-pink-300 shrink-0" aria-label={`Instagram video of ${h.title}`}>
                  <Instagram size={12} />
                </button>
              </li>
            ))}
            {!clips.length && <li className="py-6 text-center text-sm text-slate-500">No highlights with {kidName} yet. They show up here as the coaches make them.</li>}
          </ul>
        )}
      </section>

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
