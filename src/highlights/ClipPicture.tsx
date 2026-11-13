// A highlight's small picture in a list (asked for when it scrolls into view); a film icon until there is one.
import React, { useEffect, useRef, useState } from 'react';
import { Film } from 'lucide-react';
import { clipPicture, onPicture, pictureKey, pictureNow } from './clipPictures';
import type { FilmAccess } from './filmAccess';
import type { Highlight } from './types';

interface Props {
  h: Pick<Highlight, 'game' | 'view' | 'clip' | 'start' | 'end' | 'freeze'>;
  access?: FilmAccess;
  /** Size and corners (the picture fills it). */
  className?: string;
  /** The icon when there's no picture. */
  iconSize?: number;
}

export const ClipPicture: React.FC<Props> = ({ h, access, className = 'h-9 w-16 rounded', iconSize = 14 }) => {
  const key = pictureKey(h);
  const [url, setUrl] = useState<string | null>(() => pictureNow(key));
  const ref = useRef<HTMLSpanElement>(null);
  const hRef = useRef(h);
  hRef.current = h;
  useEffect(() => {
    setUrl(pictureNow(key));
    const el = ref.current;
    if (!el) return;
    let off = false;
    const ask = () => void clipPicture(access, hRef.current).then((u) => !off && u && setUrl(u));
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        ask();
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    // Made elsewhere (the clip opened in the editor): shown right away.
    const stop = onPicture((k) => k === key && !off && setUrl(pictureNow(key)));
    return () => {
      off = true;
      io.disconnect();
      stop();
    };
  }, [key, access]);
  return (
    <span ref={ref} className={`relative shrink-0 overflow-hidden bg-slate-200 dark:bg-slate-800 inline-flex items-center justify-center ${className}`} aria-hidden>
      {url ? <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} /> : <Film size={iconSize} className="text-slate-400 dark:text-slate-500" />}
    </span>
  );
};
