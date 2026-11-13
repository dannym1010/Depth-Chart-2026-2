// The Slideshows tab in Highlights: every slideshow this coach can see, a new one, and the one open. Photos come from
// the team's Media library, clips from the highlights, songs from this device.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Images, Plus, Trophy } from 'lucide-react';
import { PicksBoard } from './PicksBoard';
import type { FilmAccess } from '../highlights/filmAccess';
import { placeOf, scrollerOf, useHighlightsRetap } from '../highlights/highlightsNav';
import { clock, type Kid } from '../highlights/highlightData';
import { loadImage } from '../highlights/graphics';
import type { HighlightGame, Reel } from '../highlights/types';
import type { HighlightStore } from '../highlights/useHighlights';
import { useMedia } from '../media/useMedia';
import { isProgramAdminEmail } from '../utils/staffAccess';
import { SlideshowEditor } from './SlideshowEditor';
import { buildSlides, newSlideshow, slideshowsFor, slidesSeconds, withOptions } from './slideshowData';
import { useSongs } from './songs';
import type { Slideshow } from './types';

interface Props {
  teamId: string;
  season: string;
  store: HighlightStore;
  access: FilmAccess;
  games: HighlightGame[];
  roster: Kid[];
  reels: Reel[];
  me: string;
  myName: string;
  /** A family's Highlights helper (saves Media like a coach). */
  helper?: boolean;
  /** Head coaches and the program owner see every slideshow, the ones not shared too. */
  seeAll?: boolean;
  nameOf: (email?: string) => string;
  teamName?: string;
  /** The clip editor on a clip (from Highlights). */
  renderClipEditor?: (highlightId: string, close: () => void) => React.ReactNode;
  /** Told when a slideshow opens or closes (a phone's page title gives way to it). */
  onOpen?: (open: boolean) => void;
}

export const SlideshowsTab: React.FC<Props> = ({ teamId, season, store, access, games, roster, reels, me, myName, helper, seeAll, nameOf, teamName, renderClipEditor, onOpen }) => {
  const { data, update } = store;
  const ro = store.readOnly;
  const media = useMedia(teamId, season, { helper });
  // The picks board (each kid's year-end photos), over everything.
  const [picksOpen, setPicksOpen] = useState(false);
  const onMedia = media.readOnly ? null : media.update;
  const songs = useSongs();
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    void loadImage(data.settings.logo).then(setLogo);
  }, [data.settings.logo]);
  const all = useMemo(() => (data.slideshows || []).map(withOptions), [data.slideshows]);
  const list = useMemo(() => slideshowsFor(all, me, seeAll), [all, me, seeAll]);
  const [openId, setOpenId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('slideshowOpen');
    } catch {
      return null;
    }
  });
  const open = list.find((s) => s.id === openId) || null;
  const isOpen = Boolean(open);
  useEffect(() => {
    onOpen?.(isOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  useEffect(() => () => onOpen?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Below a computer's width the list hides while a slideshow is open: it opens from its top, and going back lands
  // where the list was left.
  const rootRef = useRef<HTMLDivElement>(null);
  const back = useRef<ReturnType<typeof placeOf> | null>(null);
  const narrow = () => window.innerWidth < 1024;
  const choose = (id: string | null) => {
    const was = openId;
    if (id && !open && narrow()) back.current = placeOf(rootRef.current);
    setOpenId(id);
    if (id && narrow()) window.setTimeout(() => scrollerOf(rootRef.current)?.scrollTo({ top: 0 }), 30);
    if (!id) {
      const to = back.current;
      back.current = null;
      if (to && narrow()) to(() => (was ? rootRef.current?.querySelector(`[data-show="${CSS.escape(was)}"]`) : null));
    }
    try {
      if (id) localStorage.setItem('slideshowOpen', id);
      else localStorage.removeItem('slideshowOpen');
    } catch {
      /* private window */
    }
  };
  // The phone's bottom bar: Slideshows tapped again closes the one open (back to the list).
  useHighlightsRetap('shows', () => {
    if (!open) return false;
    choose(null);
    return true;
  });

  const editShow = (id: string) => (change: (s: Slideshow) => Slideshow) =>
    update((d) => ({ ...d, slideshows: (d.slideshows || []).map((s) => (s.id === id ? { ...change(withOptions(s)), editedAt: Date.now() } : s)) }));
  const create = (name = 'Year-end slideshow') => {
    const s = newSlideshow({ name, owner: me, ownerName: myName });
    update((d) => ({ ...d, slideshows: [...(d.slideshows || []), s] }));
    choose(s.id);
  };
  const duplicate = (s: Slideshow) => {
    const copy = { ...newSlideshow({ name: `${s.name} (copy)`, owner: me, ownerName: myName }), items: s.items.map((i) => ({ ...i })), options: { ...s.options } };
    update((d) => ({ ...d, slideshows: [...(d.slideshows || []), copy] }));
    choose(copy.id);
  };
  const remove = (id: string) => {
    const now = Date.now();
    update((d) => ({ ...d, slideshows: (d.slideshows || []).filter((s) => s.id !== id), deletedSlideshows: { ...(d.deletedSlideshows || {}), [id]: now } }));
    choose(null);
  };
  const sortedGames = games;

  const panel = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';
  return (
    <div ref={rootRef} className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className={`${panel} p-3 flex flex-col gap-2 min-w-0 ${open ? 'hidden lg:flex' : ''}`}>
        {!ro && (
          <button type="button" onClick={() => create()} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-black inline-flex items-center justify-center gap-1.5">
            <Plus size={14} /> New slideshow
          </button>
        )}
        <button type="button" onClick={() => setPicksOpen(true)} className="h-9 px-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs font-black inline-flex items-center justify-center gap-1.5" title="Each kid's photos for the slideshow (helpers can pick too)">
          <Trophy size={14} /> Pick photos by kid
        </button>
        {!list.length && <p className="text-xs text-slate-500 py-4 text-center">No slideshows yet.</p>}
        <ul className="flex flex-col gap-1">
          {list.map((s) => {
            const secs = slidesSeconds(buildSlides(s, data.highlights, data.settings));
            const on = s.id === openId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  data-show={s.id}
                  onClick={() => choose(s.id)}
                  aria-pressed={on}
                  className={`w-full text-left rounded-lg border px-2.5 py-2 ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{s.name || 'Slideshow'}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {s.items.length} slide{s.items.length === 1 ? '' : 's'} · {clock(secs)}
                    {s.owner !== me ? ` · by ${s.ownerName || nameOf(s.owner)}` : ''}
                    {!s.sharedWith.includes('*') ? ' · only you' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="min-w-0">
        {open ? (
          <SlideshowEditor
            key={open.id}
            show={open}
            edit={editShow(open.id)}
            readOnly={ro}
            highlights={data.highlights}
            reels={reels}
            games={sortedGames}
            roster={roster}
            media={media.data}
            onMedia={onMedia}
            me={me}
            ownerLabel={open.owner !== me ? open.ownerName || nameOf(open.owner) : undefined}
            access={access}
            settings={data.settings}
            logo={logo}
            songs={songs}
            onDuplicate={() => duplicate(open)}
            onDelete={() => remove(open.id)}
            onClose={() => choose(null)}
            aiDesigner={isProgramAdminEmail(me)}
            renderClipEditor={renderClipEditor}
            teamName={teamName ? `${teamName} ${season}`.trim() : season}
          />
        ) : (
          // What a slideshow is: beside the list on a computer; below it only while there are none yet.
          <div className={`${panel} p-8 text-center text-sm text-slate-500 flex-col items-center gap-3 ${list.length ? 'hidden lg:flex' : 'flex'}`}>
            <Images size={32} className="text-indigo-400" />
            <p className="max-w-md">
              A slideshow mixes game day photos from Media and highlight clips, in any order you like, with fades between them and your songs under them. Play it on the
              banquet TV, or make it into a video.
            </p>
            {!ro && (
              <button type="button" onClick={() => create()} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-1.5">
                <Plus size={14} /> New slideshow
              </button>
            )}
          </div>
        )}
      </div>
      {picksOpen && <PicksBoard media={media.data} onMedia={onMedia} roster={roster} me={me} onSignIn={() => access.connect()} onClose={() => setPicksOpen(false)} />}
    </div>
  );
};
