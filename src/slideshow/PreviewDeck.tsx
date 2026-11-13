// The editor's monitor and timeline together: the slideshow playing right in the editor (every change shows at
// once), and the timeline under it following the playhead. The playhead lives here, so the rest of the editor doesn't
// redraw while it plays. M marks the moment playing (slides can be lined up to marks).
import React, { useEffect, useRef, useState } from 'react';
import type { FilmAccess } from '../highlights/filmAccess';
import type { HighlightSettings } from '../highlights/types';
import { SlideshowPlayer } from './SlideshowPlayer';
import { SlideshowTimeline, type TimelineSong } from './SlideshowTimeline';
import type { Slide } from './slideshowData';
import type { Song } from './songs';
import type { SlideshowOptions } from './types';

interface Props {
  title: string;
  slides: Slide[];
  total: number;
  options: SlideshowOptions;
  access: FilmAccess;
  look: HighlightSettings;
  logo?: HTMLImageElement | null;
  songs: Song[];
  songLens: Record<string, number>;
  /** A new `n` moves the playhead to `t` (a slide tapped in the editor). */
  seek: { t: number; n: number };
  readOnly: boolean;
  picked: Set<string>;
  onPick: (id: string, how: { add: boolean; range: boolean }) => void;
  onResize: (id: string, seconds: number) => void;
  onMove: (id: string, beforeId: string | null) => void;
  timelineSongs: TimelineSong[];
  bedTimelineSongs?: TimelineSong[];
  onPlaceSong?: (layer: 'main' | 'bed', index: number, at: number) => void;
  beats: number[];
  onMarks: (marks: number[]) => void;
  musicShift: number;
  onMusicShift: (shift: number) => void;
  /** Full screen from here. */
  onBig: (t: number) => void;
  /** Where the playhead is (read when needed, e.g. "start the music here"). */
  timeRef?: React.MutableRefObject<number>;
  /** Something open over the editor (a picker, the clip editor): M doesn't mark. */
  keysOff?: boolean;
}

export const PreviewDeck: React.FC<Props> = (p) => {
  const [now, setNow] = useState(0);
  const [seek, setSeek] = useState(p.seek);
  const nowRef = useRef(0);
  // The editor's jumps and the timeline's, to the player.
  useEffect(() => setSeek(p.seek), [p.seek]);
  const go = (t: number) => {
    nowRef.current = t;
    if (p.timeRef) p.timeRef.current = t;
    setNow(t);
    setSeek((s) => ({ t, n: s.n + 1 }));
  };
  const mark = (t: number) => {
    if (p.readOnly) return;
    const r = Math.round(t * 100) / 100;
    if (p.options.marks.some((m) => Math.abs(m - r) < 0.15)) return;
    p.onMarks([...p.options.marks, r].sort((a, b) => a - b));
  };
  const markRef = useRef(mark);
  markRef.current = mark;
  const keysOff = useRef(false);
  keysOff.current = Boolean(p.keysOff);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (keysOff.current) return;
      e.preventDefault();
      markRef.current(nowRef.current);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <SlideshowPlayer
        inline
        title={p.title}
        slides={p.slides}
        options={p.options}
        access={p.access}
        look={p.look}
        logo={p.logo}
        songs={p.songs}
        songLens={p.songLens}
        startAt={Math.min(1.05, p.total / 4)}
        seek={seek}
        onTime={(t) => {
          nowRef.current = t;
          if (p.timeRef) p.timeRef.current = t;
          setNow((x) => (Math.abs(x - t) > 0.01 ? t : x));
        }}
        onMark={p.readOnly ? undefined : mark}
        onBig={p.onBig}
      />
      {p.slides.length > 0 && (
        <SlideshowTimeline
          slides={p.slides}
          access={p.access}
          total={p.total}
          time={now}
          picked={p.picked}
          look={p.look}
          readOnly={p.readOnly}
          onSeek={go}
          onPick={p.onPick}
          onResize={p.onResize}
          onMove={p.onMove}
          songs={p.timelineSongs}
          bedSongs={p.bedTimelineSongs}
          onPlaceSong={p.readOnly ? undefined : p.onPlaceSong}
          beats={p.beats}
          marks={p.options.marks}
          onMarks={p.onMarks}
          musicShift={p.musicShift}
          onMusicShift={p.onMusicShift}
        />
      )}
    </div>
  );
};
