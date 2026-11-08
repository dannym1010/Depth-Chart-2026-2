// Setting up the team film server on this device (tools/film-server on the computer with the drive): its https
// address (from Tailscale) and its key. Checked before it's kept; once set, every game looks there first and its
// clips stream, nothing copied. Used in Link film (Film Room, film window) and Highlights.
import React, { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { filmServer, setFilmServer, testFilmServer } from './filmSources';

const field = 'h-9 w-full px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white';

export const FilmServerSetup: React.FC<{ onChanged?: () => void; compact?: boolean }> = ({ onChanged, compact }) => {
  const saved = filmServer();
  const [open, setOpen] = useState(!compact && !saved);
  const [url, setUrl] = useState(saved?.url || '');
  const [key, setKey] = useState(saved?.key || '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(saved ? `Streaming from ${saved.url}` : '');
  const [error, setError] = useState('');

  const save = async () => {
    const s = { url: url.trim().replace(/\/+$/, ''), key: key.trim() };
    if (!/^https?:\/\//i.test(s.url) || !s.key) return setError('Paste the address (https://…) and the key from the film server window.');
    setBusy(true);
    setError('');
    try {
      const name = await testFilmServer(s);
      setFilmServer(s);
      setNote(`Connected: streaming “${name}”. Every game looks here first.`);
      setOpen(false);
      onChanged?.();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <HardDrive size={20} className="text-indigo-500 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900 dark:text-white">Team film server (your drive, streamed)</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            The film folder on a drive at home, played like Google Drive: each clip streams as it plays, nothing copied. Any device with Tailscale on.
          </div>
          {note && !open && <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{note}</div>}
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 underline shrink-0">
          {open ? 'Close' : saved ? 'Change' : 'Set up'}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-pc.your-tailnet.ts.net" className={field} aria-label="Film server address" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key (from the film server window)" className={field} aria-label="Film server key" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          {error && <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
              {busy ? 'Checking…' : 'Connect'}
            </button>
            {saved && (
              <button
                type="button"
                onClick={() => {
                  setFilmServer(null);
                  setNote('');
                  setUrl('');
                  setKey('');
                  onChanged?.();
                }}
                className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold cursor-pointer"
              >
                Stop using it
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            On the computer with the drive, run the film server (tools/film-server in the app’s files). On your own network: <b>node make-cert.mjs</b> once, then paste the https address and key it prints (trust its certificate on this iPad once, from the page it shows). Anywhere: <b>tailscale serve --bg 8787</b> and Tailscale’s https address.
          </p>
        </div>
      )}
    </div>
  );
};
