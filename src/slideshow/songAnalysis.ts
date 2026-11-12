// A song read once on this device for the timeline: its loudness (the waveform) and its beat. Decoding a song takes a
// second or two, so each one is kept for the visit.
import { useEffect, useState } from 'react';
import { findBeats, peaksOf } from './beats';
import type { Song } from './songs';

export interface SongAnalysis {
  seconds: number;
  /** Loudness bars, PEAKS_PER_SECOND a second, 0..1. */
  peaks: Float32Array;
  bpm: number;
  /** Seconds into the song. */
  beats: number[];
}

export const PEAKS_PER_SECOND = 40;
const RATE = 22050;
const done = new Map<string, Promise<SongAnalysis>>();

export function analyzeSong(song: Song): Promise<SongAnalysis> {
  let p = done.get(song.name);
  if (!p) {
    p = (async () => {
      const blob = await song.get();
      if (typeof OfflineAudioContext === 'undefined') throw new Error("This browser can't read songs.");
      // Read at a lower rate (plenty for the beat, and quick), both sides mixed into one.
      const buf = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await blob.arrayBuffer());
      const mono = new Float32Array(buf.length);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let k = 0; k < d.length; k++) mono[k] += d[k] / buf.numberOfChannels;
      }
      // Let the screen breathe before the beat search (a few hundred ms on a long song).
      await new Promise((r) => setTimeout(r, 0));
      const { bpm, beats } = findBeats(mono, buf.sampleRate);
      return { seconds: buf.duration, peaks: peaksOf(mono, buf.sampleRate, PEAKS_PER_SECOND), bpm, beats };
    })();
    p.catch(() => done.delete(song.name));
    done.set(song.name, p);
  }
  return p;
}

/** The picked songs this device has, read (one at a time, so the iPad isn't swamped). */
export function useSongAnalysis(songs: Song[], names: string[]): Record<string, SongAnalysis | 'failed'> {
  const [out, setOut] = useState<Record<string, SongAnalysis | 'failed'>>({});
  const key = names.join('\n');
  useEffect(() => {
    let off = false;
    void (async () => {
      for (const name of names) {
        const song = songs.find((s) => s.name === name);
        if (!song) continue;
        try {
          const a = await analyzeSong(song);
          if (!off) setOut((o) => (o[name] === a ? o : { ...o, [name]: a }));
        } catch {
          if (!off) setOut((o) => ({ ...o, [name]: 'failed' }));
        }
      }
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, songs]);
  return out;
}
