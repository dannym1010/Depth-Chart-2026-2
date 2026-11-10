// The Media library: game day photo folders linked from Google Drive (the photos stay in Drive, like the film), each
// tied to a game, and a grid of their photos with a full-size viewer.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImageOff, Loader2, Plus, Trash2, X } from 'lucide-react';
import { DriveFolderPicker } from '../filmroom/DriveFolderPicker';
import { driveReady, driveSignIn, isDriveSignedIn, prepareDriveSignIn } from '../filmroom/filmSources';
import { opponentOf } from '../highlights/highlightData';
import type { HighlightGame } from '../highlights/types';
import { addFolder, dayOf, editFolder, newFolder, removeFolder } from './mediaData';
import { drivePhotoThumb, drivePhotoUrl, listDrivePhotos } from './mediaSources';
import type { DrivePhoto, MediaFolder } from './types';
import type { MediaStore } from './useMedia';

interface Props {
  teamName: string;
  season: string;
  store: MediaStore;
  games: HighlightGame[];
  me: string;
}

/** One photo in the grid: its small picture is fetched only when it scrolls into view. */
const Thumb: React.FC<{ photo: DrivePhoto; onOpen: () => void }> = ({ photo, onOpen }) => {
  const box = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let off = false;
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        drivePhotoThumb(photo)
          .then((u) => !off && setUrl(u))
          .catch(() => !off && setFailed(true));
      },
      { rootMargin: '400px' }
    );
    seen.observe(el);
    return () => {
      off = true;
      seen.disconnect();
    };
  }, [photo]);
  return (
    <button
      ref={box}
      type="button"
      onClick={onOpen}
      title={photo.name}
      className="relative aspect-square rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {url ? (
        <img src={url} alt={photo.name} className="w-full h-full object-cover" draggable={false} />
      ) : failed ? (
        <span className="absolute inset-0 grid place-items-center text-slate-400">
          <ImageOff size={20} />
        </span>
      ) : (
        <span className="absolute inset-0 grid place-items-center text-slate-400">
          <Loader2 size={16} className="animate-spin" />
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] font-semibold text-white bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 truncate">
        {photo.name}
      </span>
    </button>
  );
};

/** One photo full size, with the arrow keys and buttons to step through the folder. */
const Viewer: React.FC<{ photos: DrivePhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }> = ({ photos, index, onIndex, onClose }) => {
  const photo = photos[index];
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let off = false;
    setUrl('');
    setError('');
    // The grid's small picture right away; the full one when it arrives.
    drivePhotoThumb(photo)
      .then((u) => !off && setUrl((cur) => cur || u))
      .catch(() => undefined);
    drivePhotoUrl(photo.id)
      .then((u) => !off && setUrl(u))
      .catch((e) => !off && setError(e?.message || String(e)));
    // The next one ready before it is asked for.
    if (photos[index + 1]) void drivePhotoUrl(photos[index + 1].id).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [photo, photos, index]);
  const go = useCallback((d: number) => onIndex(Math.min(photos.length - 1, Math.max(0, index + d))), [index, photos.length, onIndex]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, onClose]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col" role="dialog" aria-label={photo.name}>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <span className="flex-1 min-w-0 truncate text-sm font-bold">{photo.name}</span>
        <span className="text-xs text-slate-300 shrink-0">
          {index + 1} of {photos.length}
          {photo.takenAt ? ` · ${new Date(photo.takenAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10 cursor-pointer">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center gap-2 px-2 pb-4">
        <button type="button" disabled={index === 0} onClick={() => go(-1)} aria-label="Previous photo" className="h-12 w-12 shrink-0 grid place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-20 cursor-pointer">
          <ChevronLeft size={28} />
        </button>
        <div className="flex-1 min-w-0 h-full grid place-items-center">
          {error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : url ? (
            <img src={url} alt={photo.name} className="max-w-full max-h-full object-contain" draggable={false} />
          ) : (
            <Loader2 size={28} className="animate-spin text-slate-300" />
          )}
        </div>
        <button type="button" disabled={index === photos.length - 1} onClick={() => go(1)} aria-label="Next photo" className="h-12 w-12 shrink-0 grid place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-20 cursor-pointer">
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
};

const field = 'h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100';

/** A folder's game, opponent, home or away, and day. */
const FolderDetails: React.FC<{ folder: MediaFolder; games: HighlightGame[]; photos: DrivePhoto[]; canEdit: boolean; onChange: (c: Partial<MediaFolder>) => void; onRemove: () => void }> = ({
  folder,
  games,
  photos,
  canEdit,
  onChange,
  onRemove,
}) => {
  const shownDate = folder.date || (photos[0]?.takenAt ? dayOf(photos[0].takenAt) : '');
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 min-w-[10rem]">
        Game
        <select
          disabled={!canEdit}
          value={folder.gameKey || ''}
          onChange={(e) => {
            const g = games.find((x) => x.key === e.target.value);
            onChange(g ? { gameKey: g.key, gameName: g.name, opponent: opponentOf(g.name) } : { gameKey: '', gameName: '' });
          }}
          className={field}
        >
          <option value="">Not a game / not linked</option>
          {games.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 min-w-[10rem]">
        Opponent
        <input disabled={!canEdit} value={folder.opponent || ''} onChange={(e) => onChange({ opponent: e.target.value })} placeholder="Who we played" className={field} />
      </label>
      <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        Home or away
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-9" role="group" aria-label="Home or away">
          {(
            [
              ['home', 'Home'],
              ['away', 'Away'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={!canEdit}
              aria-pressed={folder.venue === id}
              onClick={() => onChange({ venue: folder.venue === id ? '' : id })}
              className={`px-3 text-xs font-bold cursor-pointer ${folder.venue === id ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        Date
        <input disabled={!canEdit} type="date" value={shownDate} onChange={(e) => onChange({ date: e.target.value })} className={field} />
      </label>
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Take “${folder.name}” out of the Media library? The photos stay in Google Drive.`)) onRemove();
          }}
          className="ml-auto h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
        >
          <Trash2 size={14} /> Remove folder
        </button>
      )}
    </div>
  );
};

export const MediaView: React.FC<Props> = ({ teamName, season, store, games, me }) => {
  const { data, update, readOnly, saveError } = store;
  const canEdit = !readOnly;
  const [signedIn, setSignedIn] = useState(isDriveSignedIn());
  const [signInNote, setSignInNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState('');
  const [photos, setPhotos] = useState<DrivePhoto[] | null>(null);
  const [problem, setProblem] = useState('');
  const [viewing, setViewing] = useState(-1);
  useEffect(() => prepareDriveSignIn(), []);

  const folder = data.folders.find((f) => f.id === openId) || null;
  // The first folder opens by itself.
  useEffect(() => {
    if (!folder && data.folders.length) setOpenId(data.folders[0].id);
  }, [folder, data.folders]);

  const driveId = folder?.driveId || '';
  useEffect(() => {
    setPhotos(null);
    setProblem('');
    setViewing(-1);
    if (!driveId || !signedIn) return;
    let off = false;
    listDrivePhotos(driveId)
      .then((list) => !off && setPhotos(list))
      .catch((e) => {
        if (off) return;
        setProblem(e?.message || String(e));
        setSignedIn(isDriveSignedIn());
      });
    return () => {
      off = true;
    };
  }, [driveId, signedIn]);

  const signIn = async () => {
    setSignInNote('');
    try {
      await driveSignIn();
      setSignedIn(isDriveSignedIn());
    } catch (e: any) {
      setSignInNote(e?.message || String(e));
    }
  };

  const link = (id: string, name: string) => {
    const have = data.folders.find((f) => f.driveId === id);
    if (have) {
      setOpenId(have.id);
    } else {
      const f = newFolder({ driveId: id, name, createdBy: me });
      update((d) => addFolder(d, f));
      setOpenId(f.id);
    }
    setAdding(false);
  };

  const byDate = useMemo(() => photos || [], [photos]);

  return (
    <div className="p-3 sm:p-5 flex flex-col gap-4 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Camera size={22} className="text-indigo-600" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Media</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {teamName} · {season} season · game day photos from Google Drive (they stay in Drive; only the tags are saved here)
          </p>
        </div>
        {canEdit && signedIn && (
          <button type="button" onClick={() => setAdding((a) => !a)} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer">
            <Plus size={14} /> Add photo folder
          </button>
        )}
      </div>

      {saveError && <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">{saveError}</p>}

      {!driveReady() ? (
        <p className="text-sm text-slate-600 dark:text-slate-300 p-4 rounded-xl border border-slate-200 dark:border-slate-800">Google Drive is not set up for this site yet, so photo folders can’t be linked.</p>
      ) : !signedIn ? (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-start gap-2">
          <p className="text-sm text-slate-700 dark:text-slate-200">Sign in with Google to see the game day photos (the same sign-in as the film).</p>
          <button type="button" onClick={() => void signIn()} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer">
            Sign in with Google
          </button>
          {signInNote && <p className="text-xs text-rose-600 dark:text-rose-400">{signInNote}</p>}
        </div>
      ) : (
        <>
          {adding && (
            <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 flex flex-col gap-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Find the Google Drive folder with the photos, open it, and tap “Use”.</p>
              <DriveFolderPicker kind="photo" onPick={link} />
            </div>
          )}

          {!data.folders.length ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              No photo folders yet. {canEdit ? 'Tap “Add photo folder” and pick the Drive folder with a game’s photos.' : ''}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Photo folders">
                {data.folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={f.id === openId}
                    onClick={() => setOpenId(f.id)}
                    className={`h-9 px-3 rounded-lg text-xs font-bold cursor-pointer max-w-[16rem] truncate ${f.id === openId ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                  >
                    {f.opponent ? `${f.venue === 'away' ? '@' : f.venue === 'home' ? 'vs' : ''} ${f.opponent} · ` : ''}
                    {f.name}
                  </button>
                ))}
              </div>

              {folder && (
                <FolderDetails
                  folder={folder}
                  games={games}
                  photos={byDate}
                  canEdit={canEdit}
                  onChange={(c) => update((d) => editFolder(d, folder.id, c))}
                  onRemove={() => {
                    update((d) => removeFolder(d, folder.id));
                    setOpenId('');
                  }}
                />
              )}

              {problem ? (
                <p className="text-sm text-rose-600 dark:text-rose-400">{problem}</p>
              ) : photos === null ? (
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Looking in Google Drive…
                </p>
              ) : !photos.length ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">No photos right in this folder.</p>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {photos.length} photo{photos.length === 1 ? '' : 's'}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
                    {photos.map((p, i) => (
                      <Thumb key={p.id} photo={p} onOpen={() => setViewing(i)} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {photos && viewing >= 0 && photos[viewing] && <Viewer photos={photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(-1)} />}
    </div>
  );
};

