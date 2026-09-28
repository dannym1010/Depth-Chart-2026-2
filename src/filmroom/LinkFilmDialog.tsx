// "Link film": where this game's clips are. Nothing is uploaded; the app reads the clips where they are.
import React, { useRef, useState } from 'react';
import { Cloud, FolderOpen, Smartphone, X } from 'lucide-react';
import { canOpenFolders, driveReady } from './filmSources';

interface LinkFilmDialogProps {
  gameName: string;
  driveLink?: string;
  onClose: () => void;
  onFolder: () => Promise<void>;
  onFiles: (files: FileList) => void;
  onDrive: (link: string) => Promise<void>;
}

const option = 'w-full flex items-start gap-3 text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50 disabled:pointer-events-none';

export const LinkFilmDialog: React.FC<LinkFilmDialogProps> = ({ gameName, driveLink, onClose, onFolder, onFiles, onDrive }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState(driveLink || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onClose();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Link film</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{gameName}: one clip per play, as Hudl downloads them.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <Cloud size={20} className="text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Shared Google Drive folder</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Paste the folder's link. Every coach on the team gets it, on any device (they sign in with Google).</div>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              disabled={!driveReady() || busy}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 h-9 text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => run(() => onDrive(link))}
              disabled={!driveReady() || busy || !link.trim()}
              className="px-3 h-9 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"
            >
              {busy ? 'Linking…' : 'Link'}
            </button>
          </div>
          {!driveReady() && <p className="text-[11px] text-amber-600 dark:text-amber-400">Google sign-in isn't set up for this site yet. Use a folder on this computer for now.</p>}
        </div>

        <button className={option} disabled={!canOpenFolders() || busy} onClick={() => run(onFolder)}>
          <FolderOpen size={20} className="text-indigo-500 shrink-0 mt-0.5" />
          <span>
            <span className="block text-sm font-bold text-slate-900 dark:text-white">Folder on this computer</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {canOpenFolders()
                ? 'Remembered on this computer for this game. A Google Drive for desktop folder works here too.'
                : 'Needs Chrome or Edge on a computer.'}
            </span>
          </span>
        </button>

        <button className={option} disabled={busy} onClick={() => fileInput.current?.click()}>
          <Smartphone size={20} className="text-indigo-500 shrink-0 mt-0.5" />
          <span>
            <span className="block text-sm font-bold text-slate-900 dark:text-white">Pick clips from this device</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">For phones and tablets. Select all the game's clips; used for this visit only.</span>
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              onFiles(e.target.files);
              onClose();
            }
            e.target.value = '';
          }}
        />

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <p className="text-[11px] text-slate-400">
          Clips are matched to plays by the number in the file name ("Play 12.mp4"), or in order when the names have no numbers.
        </p>
      </div>
    </div>
  );
};
