// The Film Room on two screens: a "video screen" window (on a TV / monitor, or the other half of the screen)
// shows the clip big while this window keeps the play log. The two windows talk through a BroadcastChannel
// (same browser, same site): this window sends the clip itself (so picked files and Drive clips work too) and
// its player's state; the screen follows (play / pause / seek / speed).
import { useEffect, useRef } from 'react';

export const SCREEN_CHANNEL = 'mahopac-filmscreen';
export const SCREEN_HASH = '#filmscreen';

export type ScreenMessage =
  | { type: 'hello' } // the screen opened (or reloaded): send the clip again
  | { type: 'clip'; key: string; title: string; blob: Blob | null }
  | { type: 'state'; key: string; t: number; paused: boolean; rate: number }
  | { type: 'bye' }; // the Film Room stopped sending

export const screenSupported = () => typeof window !== 'undefined' && 'BroadcastChannel' in window;

/** Open the video screen window (the browser decides where; on an iPad drag it to the TV). */
/** The video screen's address (to open in another window by hand). */
export const screenUrl = () => `${window.location.origin}${window.location.pathname}${SCREEN_HASH}`;

export function openVideoScreen(): Window | null {
  // Its own window (not a tab), so it can be dragged onto another screen; asked again, the same one comes forward.
  const w = Math.round(Math.min(1280, (window.screen?.availWidth || 1280) * 0.7));
  const h = Math.round(w * 0.6);
  const win = window.open(screenUrl(), 'mahopac-filmscreen', `popup,width=${w},height=${h}`);
  try { win?.focus(); } catch { /* blocked */ }
  return win;
}

/**
 * Send the current clip and the player's state to the video screen while `on`.
 * getVideo: this window's player; getBlob: the current clip's file; key / title: which clip and its label.
 */
export function useVideoScreenSender(opts: {
  on: boolean;
  key: string;
  title: string;
  getVideo: () => HTMLVideoElement | null;
  getBlob: () => Promise<Blob | null>;
}) {
  const { on, key, title } = opts;
  const latest = useRef(opts);
  latest.current = opts;
  const chan = useRef<BroadcastChannel | null>(null);

  // The channel, and a fresh copy of the clip whenever the screen says hello.
  useEffect(() => {
    if (!on || !screenSupported()) return;
    const c = new BroadcastChannel(SCREEN_CHANNEL);
    chan.current = c;
    c.onmessage = (e: MessageEvent<ScreenMessage>) => {
      if (e.data?.type === 'hello') void sendClip();
    };
    return () => {
      try { c.postMessage({ type: 'bye' } satisfies ScreenMessage); } catch { /* closed */ }
      c.close();
      chan.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const sendClip = async () => {
    const c = chan.current;
    if (!c) return;
    const { key: k, title: t, getBlob } = latest.current;
    let blob: Blob | null = null;
    try { blob = await getBlob(); } catch { blob = null; }
    if (latest.current.key !== k) return; // moved on while the clip was read
    c.postMessage({ type: 'clip', key: k, title: t, blob } satisfies ScreenMessage);
    sendState();
  };
  const sendState = () => {
    const v = latest.current.getVideo();
    if (!chan.current || !v) return;
    chan.current.postMessage({ type: 'state', key: latest.current.key, t: v.currentTime, paused: v.paused, rate: v.playbackRate } satisfies ScreenMessage);
  };

  // A new clip: send it.
  useEffect(() => {
    if (on) void sendClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key]);

  // The player's state: on every change at once, and a few times a second to keep the screen in step.
  useEffect(() => {
    if (!on) return;
    let v: HTMLVideoElement | null = null;
    const events = ['play', 'pause', 'seeked', 'ratechange', 'loadedmetadata'];
    const attach = () => {
      const now = latest.current.getVideo();
      if (now === v) return;
      if (v) events.forEach((ev) => v!.removeEventListener(ev, sendState));
      v = now;
      if (v) events.forEach((ev) => v!.addEventListener(ev, sendState));
    };
    attach();
    const timer = window.setInterval(() => { attach(); sendState(); }, 250);
    return () => {
      window.clearInterval(timer);
      if (v) events.forEach((ev) => v!.removeEventListener(ev, sendState));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key]);
}
