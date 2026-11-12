// A photo's small picture from Google Drive, fetched when it scrolls into view (the slide tiles and the timeline).
import React, { useEffect, useRef, useState } from 'react';
import { photoThumb } from './photoLoad';

export const PhotoThumb: React.FC<{ id: string; className?: string }> = ({ id, className = 'absolute inset-0' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let off = false;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void photoThumb(id)
          .then((u) => !off && setUrl(u))
          .catch(() => undefined);
      },
      { rootMargin: '200px' }
    );
    io.observe(el);
    return () => {
      off = true;
      io.disconnect();
    };
  }, [id]);
  return (
    <div ref={ref} className={`${className} bg-slate-200 dark:bg-slate-800`}>
      {url && <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />}
    </div>
  );
};
