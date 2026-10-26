// The Hudl Scout safety net on screen: an alarm when a save just lost play names or plays (Undo puts the version
// from before back), and the saved versions of every report on this device, to restore one. Opened from any
// screen with openScoutVersions().
import React, { useEffect, useState } from 'react';
import { AlertTriangle, History, RotateCcw, X } from 'lucide-react';
import { LOSS_EVENT, listScoutVersions, restoredBundle, type ScoutLoss, type ScoutVersion } from '../utils/scoutHistory';

const OPEN_EVENT = 'open-scout-versions';
/** Show the saved versions (from a menu anywhere). */
export const openScoutVersions = () => window.dispatchEvent(new CustomEvent(OPEN_EVENT));

interface Props {
  /** Save this report again (a week's scouting, or our own film); false when it can't be done from here. */
  onRestore: (key: string, bundle: any) => boolean | string;
}

const when = (t: number) => {
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleString([], { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const ScoutSafetyNet: React.FC<Props> = ({ onRestore }) => {
  const [losses, setLosses] = useState<ScoutLoss[]>([]);
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<{ key: string; label: string; versions: ScoutVersion[] }[] | null>(null);
  const [note, setNote] = useState('');
  const [sure, setSure] = useState('');

  useEffect(() => {
    const onLoss = (e: Event) => {
      const d = (e as CustomEvent<ScoutLoss>).detail;
      // One alarm per report: the first copy (before any of the loss) is the one to go back to.
      setLosses((l) => (l.some((x) => x.key === d.key) ? l : [...l, d]));
    };
    const onOpen = () => setOpen(true);
    window.addEventListener(LOSS_EVENT, onLoss);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(LOSS_EVENT, onLoss);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    setReports(null);
    setNote('');
    void listScoutVersions().then(setReports);
  }, [open]);

  const restore = (v: ScoutVersion) => {
    const r = onRestore(v.key, restoredBundle(v));
    const msg = r === true ? `Put back the version from ${when(v.at)} (${v.plays} plays, ${v.named} play names).` : typeof r === 'string' ? r : 'Could not put it back from here.';
    setNote(msg);
    return r === true;
  };

  return (
    <>
      {losses.length > 0 && (
        <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-4 w-[min(36rem,calc(100vw-1.5rem))] flex flex-col gap-2" role="alert">
          {losses.map((l) => (
            <div key={l.key} className="rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-950 dark:text-amber-100 shadow-2xl p-3 flex items-start gap-2.5">
              <AlertTriangle size={20} className="shrink-0 mt-0.5 text-amber-600" />
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-black">{l.label} just lost work</div>
                <div className="text-xs mt-0.5">
                  {[l.lostNames ? `${l.lostNames} play name${l.lostNames === 1 ? '' : 's'}` : '', l.lostPlays ? `${l.lostPlays} play${l.lostPlays === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')} disappeared. A copy from just before was saved on
                  this device. If you didn&apos;t mean to remove them, undo it.
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (restore(l.version)) setLosses((x) => x.filter((y) => y.key !== l.key));
                    }}
                    className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} /> Undo: put it back
                  </button>
                  <button type="button" onClick={() => setOpen(true)} className="h-8 px-3 rounded-lg border border-amber-400 text-xs font-bold cursor-pointer">
                    Saved versions
                  </button>
                  <button type="button" onClick={() => setLosses((x) => x.filter((y) => y.key !== l.key))} className="h-8 px-3 rounded-lg text-xs font-bold cursor-pointer">
                    I meant to
                  </button>
                </div>
                {note && <div className="text-xs font-bold mt-1.5">{note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2">
              <History size={20} className="text-indigo-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-base font-black text-slate-900 dark:text-white">Saved versions of your Hudl Scout reports</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kept on this device as you work (every 10 minutes, and always just before play names or plays disappear). Putting one back
                  saves it for every coach.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {note && <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{note}</p>}
            {!reports ? (
              <p className="text-sm text-slate-500">Looking…</p>
            ) : !reports.length ? (
              <p className="text-sm text-slate-500">No saved versions on this device yet. They start as soon as a report is saved here.</p>
            ) : (
              reports.map((r) => (
                <div key={r.key} className="rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="px-3 py-2 text-sm font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">{r.label}</div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {r.versions.map((v) => (
                      <li key={v.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="flex-1 min-w-0 text-xs text-slate-700 dark:text-slate-200">
                          <b>{when(v.at)}</b> · {v.plays} plays · {v.named} play names
                          {v.reason === 'before-loss' && <span className="ml-1.5 px-1.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold">before a loss</span>}
                        </span>
                        {/* Two taps: the report as it is now is replaced (and kept here as a version itself). */}
                        <button
                          type="button"
                          onClick={() => {
                            if (sure !== v.id) return setSure(v.id);
                            setSure('');
                            restore(v);
                          }}
                          className={`shrink-0 h-8 px-2.5 rounded-lg text-white text-xs font-bold cursor-pointer ${sure === v.id ? 'bg-amber-600' : 'bg-indigo-600'}`}
                        >
                          {sure === v.id ? 'Tap again to put back' : 'Put back'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};
