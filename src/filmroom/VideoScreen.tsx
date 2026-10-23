// The video screen: just the clip, as big as the screen (a TV or monitor plugged into the iPad, or a second
// monitor), following the Film Room in the other window (see screenLink.ts). Opened at #filmscreen.
import React, { useEffect, useRef, useState } from 'react';
import { SCREEN_CHANNEL, type ScreenMessage } from './screenLink';

export const VideoScreen: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'waiting' | 'playing' | 'stopped' | 'nofile'>('waiting');
  const urlRef = useRef<string>('');
  const keyRef = useRef<string>('');

  useEffect(() => {
    document.title = 'Film Room · video screen';
    const chan = new BroadcastChannel(SCREEN_CHANNEL);
    const hello = () => chan.postMessage({ type: 'hello' } satisfies ScreenMessage);
    hello();
    // Until the Film Room answers (it may open after this window), ask again now and then.
    const ask = window.setInterval(() => { if (!keyRef.current) hello(); }, 2000);
    chan.onmessage = (e: MessageEvent<ScreenMessage>) => {
      const m = e.data;
      const v = videoRef.current;
      if (!m || !v) return;
      if (m.type === 'clip') {
        keyRef.current = m.key;
        setTitle(m.title);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = m.blob ? URL.createObjectURL(m.blob) : '';
        if (urlRef.current) { v.src = urlRef.current; setStatus('playing'); } else { v.removeAttribute('src'); v.load(); setStatus('nofile'); }
      } else if (m.type === 'state') {
        if (m.key !== keyRef.current || !urlRef.current) return;
        if (v.playbackRate !== m.rate) v.playbackRate = m.rate;
        // Paused: show exactly that frame. Playing: only catch up when it has drifted.
        const drift = Math.abs(v.currentTime - m.t);
        if (m.paused ? drift > 0.02 : drift > 0.3) v.currentTime = m.t;
        if (m.paused && !v.paused) v.pause();
        if (!m.paused && v.paused) void v.play().catch(() => undefined);
      } else if (m.type === 'bye') {
        v.pause();
        setStatus('stopped');
      }
    };
    return () => {
      window.clearInterval(ask);
      chan.close();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const fullScreen = () => {
    const el = document.documentElement as any;
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => undefined);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }} onDoubleClick={fullScreen}>
      <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', display: status === 'playing' ? 'block' : 'none' }} />
      {status !== 'playing' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Film Room video screen</div>
          <div style={{ fontSize: 16, opacity: 0.75, maxWidth: 560 }}>
            {status === 'waiting' && 'Waiting for the Film Room. In the other window, open a game and tap TV screen.'}
            {status === 'stopped' && 'The Film Room stopped sending. Tap TV screen there to start again.'}
            {status === 'nofile' && 'This play has no film.'}
          </div>
          <button type="button" onClick={fullScreen} style={{ marginTop: 8, padding: '10px 18px', borderRadius: 10, border: '1px solid #555', background: '#111', color: '#fff', fontSize: 15, fontWeight: 700 }}>
            Full screen
          </button>
        </div>
      )}
      {status === 'playing' && title && (
        <div style={{ position: 'absolute', left: 16, top: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.55)', fontSize: 18, fontWeight: 700 }}>{title}</div>
      )}
    </div>
  );
};
