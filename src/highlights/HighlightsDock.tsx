// The phone's bottom bar while in Highlights or Media: Clips, Reels, Slideshows and the team's Media (photos), one
// tap each (the app's own bar comes back everywhere else). Goes in the app's bar next to its "All Views" button.
// Tapping the part already open again goes back to its list (a clip, reel or slideshow open closes), then to the top.
import React from 'react';
import { Clapperboard, Images, MonitorPlay, Sparkles } from 'lucide-react';
import { retapHighlightsTab, scrollAppToTop, useHighlightsTab, type HighlightsTab } from './highlightsNav';

interface Props {
  /** Which section is open: Highlights, or Media (the photos). */
  section: 'highlights' | 'media';
  /** Open a section of the app. */
  go: (section: 'highlights' | 'media') => void;
  /** Media (the team's photos) can be opened by this account. */
  media: boolean;
  /** Slideshows can be made here (a team picked). */
  shows?: boolean;
}

export const HighlightsDock: React.FC<Props> = ({ section, go, media, shows = true }) => {
  const [tab, setTab] = useHighlightsTab();
  const open = (t: HighlightsTab) => {
    if (section !== 'highlights') {
      setTab(t);
      go('highlights');
      window.requestAnimationFrame(() => scrollAppToTop());
    } else if (tab === t) {
      if (!retapHighlightsTab(t)) scrollAppToTop(true);
    } else {
      setTab(t);
      window.requestAnimationFrame(() => scrollAppToTop());
    }
  };
  const item = (key: string, on: boolean, label: string, icon: React.ReactNode, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${on ? 'text-indigo-700 dark:text-indigo-400 font-black' : 'text-slate-500 dark:text-slate-400 font-semibold'}`}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
  const here = (t: HighlightsTab) => section === 'highlights' && tab === t;
  return (
    <>
      {item('clips', here('clips'), 'Clips', <Sparkles className="w-5 h-5" />, () => open('clips'))}
      {item('reels', here('reels'), 'Reels', <Clapperboard className="w-5 h-5" />, () => open('reels'))}
      {shows && item('shows', here('shows'), 'Slideshows', <MonitorPlay className="w-5 h-5" />, () => open('shows'))}
      {media &&
        item('media', section === 'media', 'Media', <Images className="w-5 h-5" />, () => {
          if (section !== 'media') {
            go('media');
            window.requestAnimationFrame(() => scrollAppToTop());
          } else scrollAppToTop(true);
        })}
    </>
  );
};
