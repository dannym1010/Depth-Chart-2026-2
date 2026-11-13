// Which part of Highlights is open (Clips, Reels, Slideshows, Every kid, Settings). Shared with the phone's bottom
// bar, which lives outside the Highlights page (it also takes you to Media and back), and kept on this device so
// Highlights opens where it was left.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** A phone (narrower than an iPad held upright): the screen the app's bottom bar shows on. */
export function useIsPhone(): boolean {
  const q = '(max-width: 767px)';
  const [phone, setPhone] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(q);
    const on = () => setPhone(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return phone;
}

export type HighlightsTab = 'clips' | 'reels' | 'shows' | 'kids' | 'settings';
const TABS: HighlightsTab[] = ['clips', 'reels', 'shows', 'kids', 'settings'];
const KEY = 'highlightsTab';

function read(): HighlightsTab {
  try {
    const v = localStorage.getItem(KEY) as HighlightsTab | null;
    return v && TABS.includes(v) ? v : 'clips';
  } catch {
    return 'clips';
  }
}

let current: HighlightsTab | null = null;
const listeners = new Set<() => void>();

export function getHighlightsTab(): HighlightsTab {
  if (current === null) current = read();
  return current;
}

export function setHighlightsTab(tab: HighlightsTab) {
  if (getHighlightsTab() === tab) return;
  current = tab;
  try {
    localStorage.setItem(KEY, tab);
  } catch {
    /* private window: this visit only */
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** The open part of Highlights, and a way to open another (the page and the phone's bottom bar share it). */
export function useHighlightsTab(): [HighlightsTab, (tab: HighlightsTab) => void] {
  const tab = useSyncExternalStore(subscribe, getHighlightsTab, getHighlightsTab);
  return [tab, setHighlightsTab];
}

// The bottom bar's button for the part already open, tapped again: back to that part's list (a clip, reel or
// slideshow open closes), like a phone's own apps do.
type Retap = (tab: HighlightsTab) => boolean;
const retaps = new Set<Retap>();

/** Tell the open part its button was tapped again. True when something closed (else the bar goes to the top). */
export function retapHighlightsTab(tab: HighlightsTab): boolean {
  let closed = false;
  retaps.forEach((fn) => {
    if (fn(tab)) closed = true;
  });
  return closed;
}

/** Run `back` when this part's bottom-bar button is tapped again; it says whether it closed something. */
export function useHighlightsRetap(tab: HighlightsTab, back: () => boolean) {
  const latest = useRef(back);
  useEffect(() => {
    latest.current = back;
  });
  useEffect(() => {
    const fn: Retap = (t) => (t === tab ? latest.current() : false);
    retaps.add(fn);
    return () => {
      retaps.delete(fn);
    };
  }, [tab]);
}

/** What scrolls the page `el` is on: the app's area under its top bar, or the window. */
export function scrollerOf(el: Element | null | undefined): HTMLElement | null {
  let p = el?.parentElement || null;
  while (p && p !== document.body && p !== document.documentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) || document.documentElement;
}

/** The app's page back to its top (the section's title showing). */
export function scrollAppToTop(smooth = false) {
  const from = document.querySelector('main') || document.getElementById('highlights-top');
  scrollerOf(from)?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}

/**
 * A phone's list, before something on it opens (the list hides): where its page is scrolled to now. The function
 * returned goes back there once the list shows again, and brings `row` into view when it's off the screen (the clip
 * stepped to while it was open, say), clear of the app's top bar and the bottom bar.
 */
export function placeOf(el: Element | null | undefined): (row?: () => Element | null | undefined) => void {
  const top = scrollerOf(el)?.scrollTop ?? 0;
  return (row) =>
    window.requestAnimationFrame(() => {
      const s = scrollerOf(el);
      if (s) s.scrollTop = top;
      const r = row?.();
      if (!r) return;
      const b = r.getBoundingClientRect();
      if (b.top < 96 || b.bottom > window.innerHeight - 96) r.scrollIntoView({ block: 'center' });
    });
}
