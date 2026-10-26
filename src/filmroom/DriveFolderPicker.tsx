// Pick the film folder in Google Drive by looking through it (no link to copy and paste): My Drive, Shared with
// me and the team's shared drives, or a search by name. Tapping a folder opens it; "Use this folder" links it.
// It says when a folder is the team film folder (it has 10U, 9U... in it) or how many videos are right in it.
import React, { useEffect, useState } from 'react';
import { ChevronRight, Folder, HardDrive, Loader2, Search, Users } from 'lucide-react';
import { countDriveVideos, listDriveFolders, searchDriveFolders, type DriveFolderEntry, type DrivePlace } from './filmSources';
import { isFilmRoot } from './folderRoutes';

interface Props {
  busy?: boolean;
  onPick: (folderId: string, name: string) => void;
}

const PLACES: { key: DrivePlace; label: string; icon: React.ReactNode }[] = [
  { key: 'root', label: 'My Drive', icon: <HardDrive size={14} /> },
  { key: 'shared', label: 'Shared with me', icon: <Users size={14} /> },
  { key: 'drives', label: 'Shared drives', icon: <HardDrive size={14} /> },
];

export const DriveFolderPicker: React.FC<Props> = ({ busy, onPick }) => {
  const [place, setPlace] = useState<DrivePlace>('shared');
  // The folders opened from the starting place, in order (the last one is where the coach is).
  const [trail, setTrail] = useState<DriveFolderEntry[]>([]);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [folders, setFolders] = useState<DriveFolderEntry[] | null>(null);
  const [videos, setVideos] = useState<number | null>(null);
  const [error, setError] = useState('');
  const here = trail[trail.length - 1];

  useEffect(() => {
    let off = false;
    setFolders(null);
    setVideos(null);
    setError('');
    const list = searched && !here ? searchDriveFolders(searched) : listDriveFolders(here ? here.id : place);
    list.then((f) => !off && setFolders(f)).catch((e) => !off && setError(e?.message || String(e)));
    if (here) countDriveVideos(here.id).then((n) => !off && setVideos(n)).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [place, here, searched]);

  const open = (f: DriveFolderEntry) => setTrail((t) => [...t, f]);
  const teamFolder = Boolean(here && folders && isFilmRoot(folders));
  const startAt = (p: DrivePlace) => {
    setPlace(p);
    setTrail([]);
    setSearched('');
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {PLACES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => startAt(p.key)}
            className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-bold cursor-pointer ${
              place === p.key && !searched && !trail.length
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          setTrail([]);
          setSearched(query.trim());
        }}
      >
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a folder by name (like Mahopac Film)"
            className="w-full h-9 pl-8 pr-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <button type="submit" disabled={!query.trim()} className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40">
          Find
        </button>
      </form>

      {/* Where the coach is */}
      <div className="flex flex-wrap items-center gap-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">
        <button type="button" onClick={() => setTrail([])} className="hover:text-indigo-600 cursor-pointer">
          {searched ? `Folders named “${searched}”` : PLACES.find((p) => p.key === place)?.label}
        </button>
        {trail.map((f, i) => (
          <React.Fragment key={f.id}>
            <ChevronRight size={12} />
            <button type="button" onClick={() => setTrail((t) => t.slice(0, i + 1))} className={`hover:text-indigo-600 cursor-pointer ${i === trail.length - 1 ? 'text-slate-900 dark:text-white' : ''}`}>
              {f.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
        {error ? (
          <p className="p-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : !folders ? (
          <p className="p-3 text-xs text-slate-500 flex items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> Looking in Google Drive…
          </p>
        ) : !folders.length ? (
          <p className="p-3 text-xs text-slate-500">{here ? 'No folders in here.' : searched ? 'No folders with that name.' : 'No folders here.'}</p>
        ) : (
          folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => open(f)}
              className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
            >
              <Folder size={16} className="text-amber-500 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{f.name}</span>
                {f.note && <span className="block text-[11px] text-slate-500 truncate">{f.note}</span>}
              </span>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
            </button>
          ))
        )}
      </div>

      {here && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs flex-1 min-w-0 ${teamFolder ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {teamFolder
              ? '✓ The team film folder: every game will find its own folder in it.'
              : videos
                ? `${videos} video${videos === 1 ? '' : 's'} in this folder.`
                : videos === 0
                  ? 'No videos right in this folder (open a game’s folder, or use the team film folder).'
                  : ''}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPick(here.id, here.name)}
            className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
          >
            {busy ? 'Linking…' : `Use “${here.name}”`}
          </button>
        </div>
      )}
    </div>
  );
};
