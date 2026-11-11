// Player Highlight Albums modal for Sideline Media Manager.
// Groups photos by player jersey numbers, auto-curating 4-star Elite & 3-star Good highlights,
// and powers single-kid or team-wide batch ZIP downloads.
import React, { useMemo, useState } from 'react';
import {
  Archive,
  Award,
  CheckCircle2,
  ChevronRight,
  Download,
  FolderArchive,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Star,
  User,
  Users,
  X,
} from 'lucide-react';
import { zipFiles } from '../highlights/zip';
import type { RosterPlayer } from '../types';
import { drivePhotoBlob, drivePhotoThumb } from './mediaSources';
import { starsOf } from './mediaData';
import type { DrivePhoto, MediaFolder, MediaPhoto } from './types';

export interface PhotoEntry {
  photo: DrivePhoto;
  folder: MediaFolder;
  record?: MediaPhoto;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entries: PhotoEntry[];
  roster: RosterPlayer[];
  teamName: string;
  season: string;
  initialKid?: string;
  isFamily?: boolean;
  onOpenPhoto: (photo: DrivePhoto) => void;
}

export const PlayerAlbumsModal: React.FC<Props> = ({
  open,
  onClose,
  entries,
  roster,
  teamName,
  season,
  initialKid,
  isFamily = false,
  onOpenPhoto,
}) => {
  const [selectedKid, setSelectedKid] = useState<string>(initialKid || '');
  const [filterMode, setFilterMode] = useState<'all' | 'highlights' | 'elite' | 'poster' | 'yearend'>('highlights');
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');

  // Group photos by player jersey #
  const albumsByKid = useMemo(() => {
    const map = new Map<string, PhotoEntry[]>();
    for (const item of entries) {
      const kids = item.record?.kids || [];
      for (const k of kids) {
        const list = map.get(k) || [];
        list.push(item);
        map.set(k, list);
      }
    }
    return map;
  }, [entries]);

  // Roster list ordered with players who have photos first
  const playerList = useMemo(() => {
    return [...roster].sort((a, b) => {
      const aCount = albumsByKid.get(a.num)?.length || 0;
      const bCount = albumsByKid.get(b.num)?.length || 0;
      if (aCount !== bCount) return bCount - aCount;
      return Number(a.num) - Number(b.num);
    });
  }, [roster, albumsByKid]);

  // Set default kid if none selected
  const activeKidNum = selectedKid || (playerList[0]?.num ?? '');
  const activePlayer = roster.find((r) => r.num === activeKidNum);
  const activePhotos = useMemo(() => {
    const list = albumsByKid.get(activeKidNum) || [];
    // Sort by star rating (Elite 4★ first, Good 3★ second), then date
    return [...list].sort((a, b) => {
      const aStars = starsOf(a.record);
      const bStars = starsOf(b.record);
      if (aStars !== bStars) return bStars - aStars;
      return (b.photo.takenAt || 0) - (a.photo.takenAt || 0);
    });
  }, [albumsByKid, activeKidNum]);

  // Filter photos for active view
  const displayedPhotos = useMemo(() => {
    if (filterMode === 'elite') {
      return activePhotos.filter((p) => p.record?.tier === 'Elite');
    }
    if (filterMode === 'highlights') {
      return activePhotos.filter((p) => starsOf(p.record) >= 3);
    }
    // His photos tagged for a poster, or for the year-end video.
    if (filterMode === 'poster' || filterMode === 'yearend') {
      return activePhotos.filter((p) => (p.record?.tags || []).includes(filterMode));
    }
    return activePhotos;
  }, [activePhotos, filterMode]);
  const posterCount = activePhotos.filter((p) => (p.record?.tags || []).includes('poster')).length;
  const yearendCount = activePhotos.filter((p) => (p.record?.tags || []).includes('yearend')).length;

  const eliteCount = activePhotos.filter((p) => p.record?.tier === 'Elite').length;
  const goodCount = activePhotos.filter((p) => p.record?.tier === 'Good').length;

  // Batch download album as a ZIP file
  const downloadAlbumZip = async (photosToZip: PhotoEntry[], zipName: string) => {
    if (!photosToZip.length || zipping) return;
    setZipping(true);
    setZipProgress(`Starting download for ${photosToZip.length} photos…`);

    try {
      const files: { name: string; data: Blob }[] = [];
      for (let i = 0; i < photosToZip.length; i++) {
        const item = photosToZip[i];
        setZipProgress(`Downloading photo ${i + 1} of ${photosToZip.length}: ${item.photo.name}…`);
        try {
          const blob = await drivePhotoBlob(item.photo.id);
          const opp = item.folder.opponent ? `_${item.folder.opponent}` : '';
          const tier = item.record?.tier ? `_${item.record.tier}` : '';
          const fileName = `${activePlayer ? `${activePlayer.firstName}_${activePlayer.lastName}` : `Kid_${activeKidNum}`}${opp}${tier}_${String(i + 1).padStart(2, '0')}.jpg`;
          files.push({ name: fileName, data: blob });
        } catch {
          /* continue on error */
        }
      }

      if (!files.length) throw new Error('No photos could be downloaded.');

      setZipProgress('Creating ZIP archive…');
      const zipBlob = await zipFiles(files);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${zipName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setZipProgress('Downloaded!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setZipping(false);
      setZipProgress('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" role="dialog">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white grid place-items-center">
              <Award size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Player Highlight Albums
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Curated game day photo albums by player · 4★ Elite & 3★ Good highlights
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Player Roster Selector (hidden if family locked to one kid) */}
          {!isFamily && (
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 overflow-y-auto max-h-48 md:max-h-full p-2 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Roster Albums
              </span>
              {playerList.map((p) => {
                const count = albumsByKid.get(p.num)?.length || 0;
                const active = p.num === activeKidNum;
                return (
                  <button
                    key={p.num}
                    type="button"
                    onClick={() => setSelectedKid(p.num)}
                    className={`px-3 py-2 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer transition ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                        #{p.num}
                      </span>
                      <span className="truncate">{p.firstName} {p.lastName}</span>
                    </div>
                    <span className={`text-[10px] font-bold ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Right / Main: Kid Album View */}
          <div className="flex-1 min-w-0 flex flex-col overflow-y-auto p-4 sm:p-5 gap-4">
            {activePlayer ? (
              <>
                {/* Player Album Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 grid place-items-center font-black text-lg text-indigo-300">
                      #{activePlayer.num}
                    </div>
                    <div>
                      <h3 className="text-lg font-black leading-tight">
                        {activePlayer.firstName} {activePlayer.lastName}
                      </h3>
                      <p className="text-xs text-indigo-200">
                        {activePlayer.primaryPosition ? `${activePlayer.primaryPosition} · ` : ''}
                        {activePhotos.length} total photos · {eliteCount} Elite highlights
                      </p>
                    </div>
                  </div>

                  {/* Highlights Stat Badges */}
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-1.5">
                      <Star size={13} className="fill-current" /> {eliteCount} Elite (4★)
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1.5">
                      <Star size={13} className="fill-current" /> {goodCount} Good (3★)
                    </div>
                  </div>
                </div>

                {/* Filter and Download Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full h-8 text-xs font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setFilterMode('highlights')}
                      className={`px-3 h-full cursor-pointer transition ${
                        filterMode === 'highlights'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Highlights (3-4★)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('elite')}
                      className={`px-3 h-full cursor-pointer transition ${
                        filterMode === 'elite'
                          ? 'bg-amber-500 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Elite Only (4★)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('poster')}
                      title="His photos tagged For Posters"
                      className={`px-3 h-full cursor-pointer transition ${
                        filterMode === 'poster'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      🖼️ Posters ({posterCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('yearend')}
                      title="His photos tagged For the Year-End Video"
                      className={`px-3 h-full cursor-pointer transition ${
                        filterMode === 'yearend'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      🏆 Year-end ({yearendCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('all')}
                      className={`px-3 h-full cursor-pointer transition ${
                        filterMode === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      All Photos ({activePhotos.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={zipping || displayedPhotos.length === 0}
                    onClick={() =>
                      void downloadAlbumZip(
                        displayedPhotos,
                        `${teamName}_${activePlayer.firstName}_${activePlayer.lastName}_Highlights`
                      )
                    }
                    className="h-8 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                  >
                    {zipping ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    <span>Download Album (.ZIP)</span>
                  </button>
                </div>

                {/* Status indicator during ZIP preparation */}
                {zipProgress && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg">
                    <Loader2 size={13} className="animate-spin" /> {zipProgress}
                  </p>
                )}

                {/* Album Photo Grid */}
                {!displayedPhotos.length ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
                    <ImageIcon size={32} />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      No photos found for this filter
                    </p>
                    <p className="text-xs text-slate-500">
                      Try selecting "All Photos" to see every photo where #{activePlayer.num} is tagged.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                    {displayedPhotos.map((item) => {
                      const stars = starsOf(item.record);
                      return (
                        <div
                          key={item.photo.id}
                          onClick={() => onOpenPhoto(item.photo)}
                          className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                        >
                          {/* Mini Thumbnail */}
                          <AlbumThumb photo={item.photo} />

                          {/* Star Tier Badge */}
                          {stars > 0 && (
                            <div
                              className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-black z-10 flex items-center gap-0.5 shadow-sm backdrop-blur-sm ${
                                item.record?.tier === 'Elite'
                                  ? 'bg-amber-500 text-white'
                                  : item.record?.tier === 'Good'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-700 text-slate-200'
                              }`}
                            >
                              <Star size={9} className="fill-current" />
                              <span>{item.record?.score ? item.record.score.toFixed(1) : stars}</span>
                            </div>
                          )}

                          {/* Opponent & Category overlay */}
                          <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
                            <p className="text-[10px] text-white font-bold truncate">
                              {item.folder.opponent ? `vs ${item.folder.opponent}` : item.folder.name}
                            </p>
                            {item.record?.category && (
                              <p className="text-[9px] text-indigo-200 truncate">
                                {item.record.category} {item.record.side ? `· ${item.record.side}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500 p-8 text-center">Select a player to view their highlight album.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AlbumThumb: React.FC<{ photo: DrivePhoto }> = ({ photo }) => {
  const [url, setUrl] = useState('');
  React.useEffect(() => {
    let off = false;
    drivePhotoThumb(photo)
      .then((u) => !off && setUrl(u))
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [photo]);

  if (!url) {
    return (
      <div className="w-full h-full grid place-items-center text-slate-400">
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={photo.name}
      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
      draggable={false}
    />
  );
};

