// "Link film": where this game's clips are. Nothing is uploaded; the app reads the clips where they are.
import React, { useRef, useState } from 'react';
import { Cloud, FolderOpen, Smartphone, X } from 'lucide-react';
import { canOpenFolders, canPickFolderFiles, driveReady } from './filmSources';

interface LinkFilmDialogProps {
  gameName: string;
  driveLink?: string;
  onClose: () => void;
  onFolder: () => Promise<void>;
  onFiles: (files: FileList) => void;
  /** A folder picked on a tablet (its files, for this visit). */
  onPickedFolder?: (files: FileList) => Promise<void>;
  onDrive: (link: string) => Promise<void>;
}

/** An iPad or iPhone (an iPad's browser says "Macintosh" but has a touch screen). */
const appleTouch =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 1));

const option = 'w-full flex items-start gap-3 text-left rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50 disabled:pointer-events-none';

export const LinkFilmDialog: React.FC<LinkFilmDialogProps> = ({ gameName, driveLink, onClose, onFolder, onFiles, onPickedFolder, onDrive }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const folderFiles = Boolean(onPickedFolder) && canPickFolderFiles();
  const [link, setLink] = useState(driveLink || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drive = driveReady();

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
            <p className="text-xs text-slate-500 dark:text-slate-400">{gameName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Google Drive (only when it's turned on for this site): every coach, any device. */}
        {drive && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <Cloud size={20} className="text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">Google Drive folder</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Paste the link to the team film folder once. Every game finds its own folder, for every coach.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                disabled={busy}
                className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 h-9 text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => run(() => onDrive(link))}
                disabled={busy || !link.trim()}
                className="px-3 h-9 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"
              >
                {busy ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        )}

        {canOpenFolders() && (
          <button className={option} disabled={busy} onClick={() => run(onFolder)}>
            <FolderOpen size={20} className="text-indigo-500 shrink-0 mt-0.5" />
            <span>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">Folder on this computer</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Pick the team film folder once and every game finds its own (or pick just this game's folder). A Google Drive for desktop folder works too.
              </span>
            </span>
          </button>
        )}

        {/* iPad (iPadOS 18.4+): pick the film folder itself; every game finds its own in it until the page reloads. */}
        {folderFiles && (
          <>
            <button className={option} disabled={busy} onClick={() => folderInput.current?.click()}>
              <FolderOpen size={20} className="text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">Pick the film folder (a drive or Files)</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Pick the team film folder (the one with <b>10U</b> in it, like <b>Mahopac Film</b>) and every game finds its own, or pick one game’s folder. Pick it again after the app reloads.
                </span>
              </span>
            </button>
            <input
              ref={folderInput}
              type="file"
              // @ts-expect-error webkitdirectory isn't in React's input props
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length && onPickedFolder) void run(() => onPickedFolder(files));
                e.target.value = '';
              }}
            />
          </>
        )}

        <button className={option} disabled={busy} onClick={() => fileInput.current?.click()}>
          <Smartphone size={20} className="text-indigo-500 shrink-0 mt-0.5" />
          <span>
            <span className="block text-sm font-bold text-slate-900 dark:text-white">
              {appleTouch ? 'Pick this game’s clips (a drive or Files)' : "Pick this game's clips"}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">Select all of them at once (phones and tablets too). For this visit only.</span>
          </span>
        </button>
        {/* iPad / iPhone: the browser can't open a folder, and its picker offers the photo library first. */}
        {appleTouch && (
          <ol className="text-xs text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 list-decimal list-inside space-y-0.5">
            <li>Plug in the drive, then tap {folderFiles ? <><b>Pick the film folder</b> (or <b>Pick this game’s clips</b>)</> : <b>Pick this game’s clips</b>}.</li>
            <li>Tap <b>Choose Files</b> (not Photo Library).</li>
            <li>Tap <b>Browse</b>, then your drive under <b>Locations</b>, then the game’s folder (like <b>10U / Week 2 - Yorktown Huskers</b>).</li>
            <li>{folderFiles ? <>For the folder: open it and tap <b>Open</b>. For clips: tap <b>Select</b> (top right), tap every clip, then <b>Open</b>.</> : <>Tap <b>Select</b> (top right), tap every clip, then <b>Open</b>.</>}</li>
            <li>The iPad copies the clips first; big 4K clips take a while for a whole game.</li>
          </ol>
        )}
        <input
          ref={fileInput}
          type="file"
          // The file types too, so clips the photo library doesn't know (HEVC .MP4 / .MOV from a camera) aren't greyed out.
          accept="video/*,.mp4,.MP4,.mov,.MOV,.m4v,.M4V"
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
        <p className="text-[11px] text-slate-500 dark:text-slate-400 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
          Set up the team film folder like <b>10U / Week 3 - Shrub Oak</b> (opponents: <b>10U / Scouting / Week 3</b>), one clip per play, in play order.
          {drive ? ' Link Google Drive for everyone, and on your computer also pick your copy of it: that plays faster.' : " Linking a shared Google Drive folder for every coach isn't turned on for this site yet."}
        </p>
      </div>
    </div>
  );
};
