// Trimmed copies of highlight clips, made in the browser with Mediabunny (it drives the computer's own video
// encoder and decoder). Each copy is cut to the highlight (plus a little extra on both ends, so an editor can
// adjust) and converted to plain 8-bit H.264 with AAC sound, which every editor reads, free DaVinci Resolve included
// (the cameras' 10-bit HEVC may not open there). Loaded only when a coach makes copies, so the app stays light.

export interface CutOptions {
  /** Seconds into the clip. */
  start: number;
  end: number;
  /** Longest side of the picture (0 = as filmed). */
  height: 0 | 2160 | 1080 | 720;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Can this browser make copies (it needs the video encoder)? */
export const canCut = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoDecoder' in window;

export async function cutClip(file: Blob, o: CutOptions): Promise<Blob> {
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const duration = await input.computeDuration();
  const start = Math.max(0, Math.min(o.start, duration));
  const end = Math.max(start + 0.1, Math.min(o.end, duration));
  const conversion = await mb.Conversion.init({
    input,
    output,
    trim: { start, end },
    video: {
      codec: 'avc',
      ...(o.height ? { height: o.height } : {}),
      forceTranscode: true,
      quality: mb.QUALITY_HIGH,
    },
    audio: { codec: 'aac', forceTranscode: true },
    showWarnings: false,
  });
  if (!conversion.isValid) {
    const why = conversion.discardedTracks.map((t) => t.reason).join(', ');
    throw new Error(`This browser can't convert that clip${why ? ` (${why})` : ''}.`);
  }
  if (o.onProgress) conversion.onProgress = (p) => o.onProgress!(p);
  const stop = () => void conversion.cancel();
  o.signal?.addEventListener('abort', stop, { once: true });
  try {
    await conversion.execute();
  } finally {
    o.signal?.removeEventListener('abort', stop);
  }
  const buf = target.buffer;
  if (!buf) throw new Error('The copy came out empty.');
  return new Blob([buf], { type: 'video/mp4' });
}
