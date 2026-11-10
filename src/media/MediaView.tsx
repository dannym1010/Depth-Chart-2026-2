// The Sideline Media library: Google Drive photos, AI vision metadata extraction,
// deep filterable content library (Player [top priority], Opponent, Date, Home/Away, Group/Singles,
// Category, Star Curation Tier, Social/Poster/Highlight tags), Instagram ratio cropper,
// player highlight albums, and batch ZIP downloads for coaches and parents.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Camera,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Crop,
  Download,
  Filter,
  ImageOff,
  Instagram,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { DriveFolderPicker } from '../filmroom/DriveFolderPicker';
import { driveReady, driveSignIn, isDriveSignedIn, prepareDriveSignIn } from '../filmroom/filmSources';
import { opponentOf } from '../highlights/highlightData';
import type { HighlightGame } from '../highlights/types';
import { zipFiles } from '../highlights/zip';
import type { RosterPlayer } from '../types';
import { AiTaggingModal } from './AiTaggingModal';
import { CropModal } from './CropModal';
import { analyzePhotoWithGemini, type RosterRef, VALID_CATEGORIES } from './geminiMediaService';
import {
  addFolder,
  dayOf,
  editFolder,
  editPhoto,
  matchPhotoFilter,
  newFolder,
  photoMap,
  removeFolder,
  STARS,
  starsOf,
  TAG_LABELS,
  tierOfScore,
  togglePhotoTag,
  type MediaFilter,
} from './mediaData';
import { drivePhotoBlob, drivePhotoThumb, drivePhotoUrl, listDrivePhotos } from './mediaSources';
import { PlayerAlbumsModal, type PhotoEntry } from './PlayerAlbumsModal';
import type { DrivePhoto, MediaCategory, MediaCrop, MediaFolder, MediaPhoto, MediaTag, MediaTier } from './types';
import type { MediaStore } from './useMedia';

interface Props {
  teamName: string;
  season: string;
  store: MediaStore;
  games: HighlightGame[];
  roster?: RosterPlayer[];
  me: string;
  watchOnly?: boolean;
  myKids?: string[];
}

const field =
  'h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100';

/**
 * Thumbnail cell in the library grid.
 * Displays lazy-loaded image, star rating badge, detected jersey numbers, user tag icons,
 * and selection checkmark when multi-select mode is on.
 */
const Thumb: React.FC<{
  photo: DrivePhoto;
  record?: MediaPhoto;
  isSelected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
  onOpen: () => void;
}> = ({ photo, record, isSelected = false, selectionMode = false, onToggleSelect, onOpen }) => {
  const box = useRef<HTMLDivElement>(null);
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

  const stars = starsOf(record);
  const kids = record?.kids || [];
  const tags = record?.tags || [];

  return (
    <div
      ref={box}
      onClick={selectionMode ? onToggleSelect : onOpen}
      title={`${photo.name}${record?.curationRationale ? ` · ${record.curationRationale}` : ''}`}
      className={`relative aspect-square rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm border transition ${
        isSelected
          ? 'ring-2 ring-indigo-600 border-indigo-600 shadow-md'
          : 'border-slate-200/60 dark:border-slate-700/60 hover:shadow-md'
      }`}
    >
      {url ? (
        <img
          src={url}
          alt={photo.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300 select-none"
          draggable={false}
        />
      ) : failed ? (
        <span className="absolute inset-0 grid place-items-center text-slate-400">
          <ImageOff size={20} />
        </span>
      ) : (
        <span className="absolute inset-0 grid place-items-center text-slate-400">
          <Loader2 size={16} className="animate-spin" />
        </span>
      )}

      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-2 left-2 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className={`h-6 w-6 rounded-md flex items-center justify-center transition shadow-md ${
              isSelected ? 'bg-indigo-600 text-white' : 'bg-black/60 text-white/80 hover:bg-black/80'
            }`}
          >
            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
        </div>
      )}

      {/* Top Left: User tags (if not selection mode) */}
      {!selectionMode && tags.length > 0 && (
        <div className="absolute top-1.5 left-1.5 flex gap-1 z-10">
          {tags.map((t) => (
            <span
              key={t}
              title={TAG_LABELS[t].label}
              className="h-5 px-1 rounded bg-black/70 backdrop-blur-sm text-[10px] text-white font-bold grid place-items-center"
            >
              {TAG_LABELS[t].emoji}
            </span>
          ))}
        </div>
      )}

      {/* Top Right: Curation Tier & Stars */}
      {stars > 0 && (
        <div
          className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black z-10 flex items-center gap-0.5 shadow-sm backdrop-blur-sm ${
            record?.tier === 'Elite'
              ? 'bg-amber-500/90 text-white'
              : record?.tier === 'Good'
              ? 'bg-emerald-600/90 text-white'
              : record?.tier === 'Archive'
              ? 'bg-slate-700/90 text-slate-200'
              : 'bg-rose-700/90 text-white'
          }`}
        >
          <Star size={10} className="fill-current" />
          <span>{record?.score ? record.score.toFixed(1) : stars}</span>
        </div>
      )}

      {/* Bottom overlay: Jersey Numbers & Name */}
      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end">
        {kids.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-0.5">
            {kids.slice(0, 3).map((k) => (
              <span key={k} className="px-1 rounded bg-indigo-600/90 text-white text-[9px] font-black leading-tight">
                #{k}
              </span>
            ))}
            {kids.length > 3 && (
              <span className="text-[9px] text-white/80 font-bold leading-tight">+{kids.length - 3}</span>
            )}
          </div>
        )}
        <span className="text-[10px] font-medium text-white/90 truncate leading-tight">{photo.name}</span>
      </div>
    </div>
  );
};

/**
 * Full-size photo viewer with metadata inspector, AI re-tagging, player tagging,
 * Instagram crop shortcut, and user tags.
 */
const Viewer: React.FC<{
  photos: DrivePhoto[];
  index: number;
  records: Map<string, MediaPhoto>;
  folder: MediaFolder | null;
  roster: RosterPlayer[];
  canEdit: boolean;
  onIndex: (i: number) => void;
  onSavePhoto: (photoId: string, folderId: string, patch: Partial<MediaPhoto>) => void;
  onOpenCrop: (photo: DrivePhoto) => void;
  onClose: () => void;
}> = ({ photos, index, records, folder, roster, canEdit, onIndex, onSavePhoto, onOpenCrop, onClose }) => {
  const photo = photos[index];
  const record = records.get(photo.id);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [showInspector, setShowInspector] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [customJersey, setCustomJersey] = useState('');

  useEffect(() => {
    let off = false;
    setUrl('');
    setError('');
    drivePhotoThumb(photo)
      .then((u) => !off && setUrl((cur) => cur || u))
      .catch(() => undefined);
    drivePhotoUrl(photo.id)
      .then((u) => !off && setUrl(u))
      .catch((e) => !off && setError(e?.message || String(e)));
    if (photos[index + 1]) void drivePhotoUrl(photos[index + 1].id).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [photo, photos, index]);

  const go = useCallback((d: number) => onIndex(Math.min(photos.length - 1, Math.max(0, index + d))), [index, photos.length, onIndex]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'i' || e.key === 'I') setShowInspector((s) => !s);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, onClose]);

  const runAiOnCurrent = async () => {
    if (!folder || analyzing) return;
    setAnalyzing(true);
    try {
      const blob = await drivePhotoBlob(photo.id);
      const refs: RosterRef[] = roster.map((r) => ({ num: r.num, firstName: r.firstName, lastName: r.lastName }));
      const analysis = await analyzePhotoWithGemini({
        blob,
        driveId: photo.id,
        photoName: photo.name,
        roster: refs,
      });
      onSavePhoto(photo.id, folder.id, analysis);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const addJersey = (num: string) => {
    if (!folder) return;
    const clean = num.replace(/\D/g, '');
    if (!clean) return;
    const current = record?.kids || [];
    if (!current.includes(clean)) {
      onSavePhoto(photo.id, folder.id, { kids: [...current, clean].sort((a, b) => Number(a) - Number(b)) });
    }
    setCustomJersey('');
  };

  const removeJersey = (num: string) => {
    if (!folder) return;
    const current = record?.kids || [];
    onSavePhoto(photo.id, folder.id, { kids: current.filter((k) => k !== num) });
  };

  const toggleTag = (t: MediaTag) => {
    if (!folder) return;
    const next = togglePhotoTag(record?.tags, t);
    onSavePhoto(photo.id, folder.id, { tags: next });
  };

  const setTierScore = (score: number) => {
    if (!folder) return;
    const tier = tierOfScore(score);
    onSavePhoto(photo.id, folder.id, { score, tier });
  };

  const kids = record?.kids || [];
  const metrics = record?.qualityMetrics;

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col md:flex-row overflow-hidden" role="dialog" aria-label={photo.name}>
      {/* Left/Main Area: Photo Canvas */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 text-white z-20 bg-gradient-to-b from-black/80 to-transparent">
          <span className="flex-1 min-w-0 truncate text-sm font-bold">{photo.name}</span>
          <span className="text-xs text-slate-300 shrink-0">
            {index + 1} of {photos.length}
            {photo.takenAt ? ` · ${new Date(photo.takenAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
          </span>
          <button
            type="button"
            onClick={() => onOpenCrop(photo)}
            title="Crop to Instagram Ratios"
            className="h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white shadow-sm hover:opacity-90 transition"
          >
            <Instagram size={14} /> Crop Instagram
          </button>
          <button
            type="button"
            onClick={() => setShowInspector((s) => !s)}
            title="Toggle Inspector (I)"
            className={`h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
              showInspector ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <SlidersHorizontal size={14} /> Details
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10 cursor-pointer text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Center image */}
        <div className="flex-1 min-h-0 flex items-center justify-center gap-2 px-2 pb-4 relative">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-12 w-12 grid place-items-center rounded-full text-white bg-black/40 hover:bg-black/70 disabled:opacity-20 cursor-pointer backdrop-blur-sm"
          >
            <ChevronLeft size={28} />
          </button>
          <div className="w-full h-full grid place-items-center p-2">
            {error ? (
              <p className="text-sm text-rose-300">{error}</p>
            ) : url ? (
              <img src={url} alt={photo.name} className="max-w-full max-h-full object-contain select-none" draggable={false} />
            ) : (
              <Loader2 size={32} className="animate-spin text-slate-400" />
            )}
          </div>
          <button
            type="button"
            disabled={index === photos.length - 1}
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-12 w-12 grid place-items-center rounded-full text-white bg-black/40 hover:bg-black/70 disabled:opacity-20 cursor-pointer backdrop-blur-sm"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </div>

      {/* Right Area: Metadata & Curation Inspector */}
      {showInspector && (
        <div className="w-full md:w-96 bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col h-auto md:h-full overflow-y-auto max-h-[50vh] md:max-h-full z-20">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" /> Photo Metadata & Curation
            </h3>
            {canEdit && (
              <button
                type="button"
                disabled={analyzing}
                onClick={() => void runAiOnCurrent()}
                className="h-8 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {record?.aiAnalyzedAt ? 'Re-Analyze AI' : 'AI Analyze'}
              </button>
            )}
          </div>

          <div className="p-4 flex flex-col gap-4 text-xs">
            {/* Curation Score & Tier */}
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Curation Quality Tier</span>
                {record?.tier ? (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-black ${
                      record.tier === 'Elite'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : record.tier === 'Good'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : record.tier === 'Archive'
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {record.tier} ({record.score?.toFixed(1) || '0.0'})
                  </span>
                ) : (
                  <span className="text-slate-400">Unrated</span>
                )}
              </div>

              {/* Star Rating Quick Buttons */}
              {canEdit && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1">Rating:</span>
                  {[
                    { stars: 4, label: 'Elite (9.0)', score: 9.0 },
                    { stars: 3, label: 'Good (7.5)', score: 7.5 },
                    { stars: 2, label: 'Archive (5.0)', score: 5.0 },
                    { stars: 1, label: 'Reject (2.5)', score: 2.5 },
                  ].map((s) => {
                    const active = starsOf(record) === s.stars;
                    return (
                      <button
                        key={s.stars}
                        type="button"
                        onClick={() => setTierScore(s.score)}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition flex items-center gap-0.5 ${
                          active
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <Star size={10} className={active ? 'fill-current' : ''} /> {s.stars}★
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Quality Metrics Breakdown */}
              {metrics && (
                <div className="pt-2 border-t border-slate-700/60 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality Breakdown</span>
                  {[
                    { label: 'Sharpness & Focus', val: metrics.sharpness_and_focus },
                    { label: 'Composition & Framing', val: metrics.composition_and_framing },
                    { label: 'Storytelling & Emotion', val: metrics.storytelling_and_emotion },
                    { label: 'Player Isolation', val: metrics.player_isolation },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">{m.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(m.val / 10) * 100}%` }} />
                        </div>
                        <span className="font-bold text-slate-200 w-6 text-right">{m.val.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rationale */}
              {record?.curationRationale && (
                <p className="text-[11px] text-slate-300 italic pt-1 border-t border-slate-700/60">
                  “{record.curationRationale}”
                </p>
              )}
            </div>

            {/* Players in photo [Top Priority] */}
            <div className="flex flex-col gap-2">
              <label className="font-bold text-slate-300 flex items-center justify-between">
                <span>Tagged Players (Jersey #) [Top Priority]</span>
                <span className="text-[10px] text-indigo-400 font-semibold">{kids.length} players</span>
              </label>

              <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                {kids.map((k) => {
                  const p = roster.find((r) => r.num === k);
                  return (
                    <span
                      key={k}
                      className="px-2 py-1 rounded-lg bg-indigo-950 border border-indigo-700/60 text-indigo-200 font-bold flex items-center gap-1.5 text-[11px]"
                    >
                      <User size={11} /> #{k} {p ? `(${p.lastName})` : ''}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeJersey(k)}
                          className="hover:text-rose-400 cursor-pointer ml-0.5"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  );
                })}
                {kids.length === 0 && <span className="text-slate-500 italic">No players tagged yet</span>}
              </div>

              {/* Add player quick form */}
              {canEdit && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    value={customJersey}
                    onChange={(e) => setCustomJersey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addJersey(customJersey)}
                    placeholder="Jersey # (e.g. 21)"
                    className="flex-1 h-8 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => addJersey(customJersey)}
                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              )}

              {/* Quick roster chips to add with 1 click */}
              {canEdit && roster.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                  {roster
                    .filter((r) => !kids.includes(r.num))
                    .slice(0, 12)
                    .map((r) => (
                      <button
                        key={r.num}
                        type="button"
                        onClick={() => addJersey(r.num)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-medium cursor-pointer"
                      >
                        +# {r.num} {r.lastName}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Category & Single/Group */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-400">
                Category
                <select
                  disabled={!canEdit}
                  value={record?.category || 'Action'}
                  onChange={(e) => {
                    if (folder) onSavePhoto(photo.id, folder.id, { category: e.target.value as MediaCategory });
                  }}
                  className="h-8 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white cursor-pointer"
                >
                  {VALID_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-400">
                Single or Group
                <select
                  disabled={!canEdit}
                  value={record?.group || 'group'}
                  onChange={(e) => {
                    if (folder) onSavePhoto(photo.id, folder.id, { group: e.target.value as 'single' | 'group' });
                  }}
                  className="h-8 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white cursor-pointer"
                >
                  <option value="single">Single Player</option>
                  <option value="group">Group of Players</option>
                </select>
              </label>
            </div>

            {/* If Category is Action, choose Offense vs Defense */}
            {record?.category === 'Action' && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-400">Play Side</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['Offense', 'Defense', 'unknown'] as const).map((side) => {
                    const active = (record?.side || 'unknown') === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => {
                          if (folder) onSavePhoto(photo.id, folder.id, { side });
                        }}
                        className={`h-7 rounded text-[11px] font-bold cursor-pointer transition ${
                          active ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {side}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* User Added Tags */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400">User Added Tags</span>
              <div className="flex flex-col gap-1.5">
                {(['social', 'poster', 'highlight'] as const).map((tagKey) => {
                  const active = (record?.tags || []).includes(tagKey);
                  const meta = TAG_LABELS[tagKey];
                  return (
                    <button
                      key={tagKey}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleTag(tagKey)}
                      className={`px-3 py-2 rounded-xl text-left font-bold text-xs flex items-center justify-between cursor-pointer transition border ${
                        active
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </span>
                      {active && <Check size={14} className="text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Filter Toolbar: Opponent, Date, Home/Away, Group/Singles, Player [Top Priority],
 * Category, Curation Tier Star Rating, and User Added Tags.
 */
const FilterToolbar: React.FC<{
  filter: MediaFilter;
  onChange: (f: MediaFilter) => void;
  onReset: () => void;
  roster: RosterPlayer[];
  opponents: string[];
  photoPlayerCounts: Map<string, number>;
  totalMatching: number;
  totalPhotos: number;
}> = ({ filter, onChange, onReset, roster, opponents, photoPlayerCounts, totalMatching, totalPhotos }) => {
  const hasActiveFilter = Boolean(
    filter.player ||
      filter.opponent ||
      filter.venue ||
      filter.group ||
      filter.category ||
      filter.tier ||
      filter.minStars ||
      (filter.tags && filter.tags.length > 0) ||
      filter.search ||
      filter.date
  );

  return (
    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm flex flex-col gap-3">
      {/* Primary Row: Player [Top Priority], Opponent, Category, Search */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Player Picker (Top Priority) */}
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <User size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="shrink-0">Player:</span>
          <select
            value={filter.player || ''}
            onChange={(e) => onChange({ ...filter, player: e.target.value })}
            className="bg-transparent font-black text-xs text-indigo-700 dark:text-indigo-300 focus:outline-none cursor-pointer max-w-[12rem] truncate"
          >
            <option value="">All Players</option>
            {roster.map((r) => {
              const count = photoPlayerCounts.get(r.num) || 0;
              return (
                <option key={r.num} value={r.num}>
                  #{r.num} {r.lastName || r.firstName} ({count})
                </option>
              );
            })}
          </select>
        </label>

        {/* Opponent Picker */}
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="shrink-0 text-slate-500">Opponent:</span>
          <select
            value={filter.opponent || ''}
            onChange={(e) => onChange({ ...filter, opponent: e.target.value })}
            className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[10rem] truncate"
          >
            <option value="">All Opponents</option>
            {opponents.map((opp) => (
              <option key={opp} value={opp}>
                {opp}
              </option>
            ))}
          </select>
        </label>

        {/* Category Picker */}
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="shrink-0 text-slate-500">Category:</span>
          <select
            value={filter.category || ''}
            onChange={(e) => onChange({ ...filter, category: e.target.value as MediaCategory })}
            className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[10rem] truncate"
          >
            <option value="">All Categories</option>
            {VALID_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Free text search */}
        <div className="flex-1 min-w-[12rem] relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filter.search || ''}
            onChange={(e) => onChange({ ...filter, search: e.target.value })}
            placeholder="Search photos, notes, jersey #…"
            className="w-full h-8 pl-8 pr-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Reset */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onReset}
            className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RotateCcw size={12} /> Clear Filters
          </button>
        )}
      </div>

      {/* Secondary Row: Curation Tiers, Venue, Group, User Tags */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
        {/* Curation Tier Stars */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-7 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onChange({ ...filter, tier: '', minStars: undefined })}
            className={`px-2.5 h-full cursor-pointer ${
              !filter.tier && !filter.minStars ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            All Tiers
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, tier: 'Elite', minStars: undefined })}
            className={`px-2.5 h-full cursor-pointer ${
              filter.tier === 'Elite' ? 'bg-amber-500 text-white font-black' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            ★★★★ Elite
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, tier: 'Good', minStars: undefined })}
            className={`px-2.5 h-full cursor-pointer ${
              filter.tier === 'Good' ? 'bg-emerald-600 text-white font-black' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            ★★★ Good
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, tier: 'Archive', minStars: undefined })}
            className={`px-2.5 h-full cursor-pointer ${
              filter.tier === 'Archive' ? 'bg-slate-700 text-white font-black' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            ★★ Archive
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, tier: '', minStars: 3 })}
            className={`px-2.5 h-full cursor-pointer ${
              filter.minStars === 3 ? 'bg-indigo-600 text-white font-black' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            3+★ Highlights
          </button>
        </div>

        {/* Venue (Home / Away) */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-7 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onChange({ ...filter, venue: '' })}
            className={`px-2 h-full cursor-pointer ${!filter.venue ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, venue: 'home' })}
            className={`px-2 h-full cursor-pointer ${filter.venue === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, venue: 'away' })}
            className={`px-2 h-full cursor-pointer ${filter.venue === 'away' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Away
          </button>
        </div>

        {/* Group or Singles */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-7 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onChange({ ...filter, group: '' })}
            className={`px-2 h-full cursor-pointer ${!filter.group ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, group: 'single' })}
            className={`px-2 h-full cursor-pointer ${filter.group === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Singles
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filter, group: 'group' })}
            className={`px-2 h-full cursor-pointer ${filter.group === 'group' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Groups
          </button>
        </div>

        {/* User Added Tags Quick Toggles */}
        <div className="flex items-center gap-1 sm:ml-auto">
          {(['social', 'poster', 'highlight'] as const).map((t) => {
            const active = (filter.tags || []).includes(t);
            const meta = TAG_LABELS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  const cur = filter.tags || [];
                  const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
                  onChange({ ...filter, tags: next });
                }}
                className={`h-7 px-2 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition border ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <span>{meta.emoji}</span>
                <span>{meta.short}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
          Showing {totalMatching} of {totalPhotos}
        </span>
      </div>
    </div>
  );
};

/** A folder's game, opponent, home or away, and day. */
const FolderDetails: React.FC<{
  folder: MediaFolder;
  games: HighlightGame[];
  photos: DrivePhoto[];
  canEdit: boolean;
  onChange: (c: Partial<MediaFolder>) => void;
  onRemove: () => void;
}> = ({ folder, games, photos, canEdit, onChange, onRemove }) => {
  const shownDate = folder.date || (photos[0]?.takenAt ? dayOf(photos[0].takenAt) : '');
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 min-w-[10rem]">
        Linked Game
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
        <input
          disabled={!canEdit}
          value={folder.opponent || ''}
          onChange={(e) => onChange({ opponent: e.target.value })}
          placeholder="Who we played"
          className={field}
        />
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
              className={`px-3 text-xs font-bold cursor-pointer ${
                folder.venue === id ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
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

export const MediaView: React.FC<Props> = ({
  teamName,
  season,
  store,
  games,
  roster = [],
  me,
  watchOnly = false,
  myKids = [],
}) => {
  const { data, update, readOnly, saveError } = store;
  const canEdit = !readOnly && !watchOnly;
  const [signedIn, setSignedIn] = useState(isDriveSignedIn());
  const [signInNote, setSignInNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [cropPhoto, setCropPhoto] = useState<DrivePhoto | null>(null);
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const [openId, setOpenId] = useState('');
  const [photos, setPhotos] = useState<DrivePhoto[] | null>(null);
  const [problem, setProblem] = useState('');
  const [viewing, setViewing] = useState(-1);

  // Selection mode & Batch operations
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zippingBatch, setZippingBatch] = useState(false);
  const [batchZipStatus, setBatchZipStatus] = useState('');

  // Filter state (if family view with linked kid, initialize to that kid)
  const [filter, setFilter] = useState<MediaFilter>(() => {
    if (watchOnly && myKids.length > 0) {
      return { player: myKids[0] };
    }
    return {};
  });

  useEffect(() => prepareDriveSignIn(), []);

  const folder = data.folders.find((f) => f.id === openId) || null;
  useEffect(() => {
    if (!folder && data.folders.length) setOpenId(data.folders[0].id);
  }, [folder, data.folders]);

  const driveId = folder?.driveId || '';
  useEffect(() => {
    setPhotos(null);
    setProblem('');
    setViewing(-1);
    setSelectedIds(new Set());
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
    } catch (e: unknown) {
      setSignInNote(e instanceof Error ? e.message : String(e));
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

  const handleSavePhoto = (photoId: string, folderId: string, patch: Partial<MediaPhoto>) => {
    update((d) => editPhoto(d, photoId, folderId, patch));
  };

  const records = useMemo(() => photoMap(data), [data]);

  // Unique opponents across all folders
  const opponents = useMemo(() => {
    const list = data.folders.map((f) => f.opponent?.trim()).filter(Boolean) as string[];
    return Array.from(new Set(list)).sort();
  }, [data.folders]);

  // Photo counts per player
  const photoPlayerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of data.photos) {
      for (const k of p.kids || []) {
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    return counts;
  }, [data.photos]);

  // Filtered photos in current folder
  const filteredPhotos = useMemo(() => {
    if (!photos) return [];
    return photos.filter((p) => {
      const rec = records.get(p.id);
      return matchPhotoFilter(p, rec, folder || undefined, filter);
    });
  }, [photos, records, folder, filter]);

  // Count un-analyzed photos in current folder
  const unanalyzedCount = useMemo(() => {
    if (!photos) return 0;
    return photos.filter((p) => {
      const r = records.get(p.id);
      return !r?.aiAnalyzedAt && r?.score === undefined;
    }).length;
  }, [photos, records]);

  // All photo entries formatted for Player Albums
  const allPhotoEntries: PhotoEntry[] = useMemo(() => {
    if (!photos || !folder) return [];
    return photos.map((p) => ({
      photo: p,
      folder,
      record: records.get(p.id),
    }));
  }, [photos, folder, records]);

  // Toggle selection of one photo
  const toggleSelectPhoto = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredPhotos.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Batch download selected photos as ZIP
  const handleBatchDownloadZip = async () => {
    if (selectedIds.size === 0 || zippingBatch || !photos || !folder) return;
    setZippingBatch(true);
    setBatchZipStatus(`Preparing download for ${selectedIds.size} photos…`);

    try {
      const selectedPhotos = photos.filter((p) => selectedIds.has(p.id));
      const files: { name: string; data: Blob }[] = [];

      for (let i = 0; i < selectedPhotos.length; i++) {
        const p = selectedPhotos[i];
        setBatchZipStatus(`Downloading ${i + 1}/${selectedPhotos.length}: ${p.name}…`);
        try {
          const blob = await drivePhotoBlob(p.id);
          const rec = records.get(p.id);
          const tier = rec?.tier ? `_${rec.tier}` : '';
          const kidStr = rec?.kids?.length ? `_#${rec.kids.join('_#')}` : '';
          const base = p.name.replace(/\.[^.]+$/, '');
          files.push({ name: `${base}${kidStr}${tier}.jpg`, data: blob });
        } catch {
          /* continue on error */
        }
      }

      if (!files.length) throw new Error('No photos could be downloaded.');

      setBatchZipStatus('Building ZIP file…');
      const zipBlob = await zipFiles(files);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const opp = folder.opponent ? `_${folder.opponent}` : '';
      a.download = `${teamName}${opp}_Selected_Photos_${dayOf(Date.now())}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBatchZipStatus('Download complete!');
      setTimeout(() => setBatchZipStatus(''), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setZippingBatch(false);
    }
  };

  // Batch tag selected photos
  const handleBatchAddTag = (tag: MediaTag) => {
    if (!folder) return;
    for (const id of selectedIds) {
      const rec = records.get(id);
      const curTags = rec?.tags || [];
      if (!curTags.includes(tag)) {
        handleSavePhoto(id, folder.id, { tags: [...curTags, tag] });
      }
    }
  };

  const linkedKidName = useMemo(() => {
    if (myKids.length > 0) {
      const p = roster.find((r) => r.num === myKids[0]);
      return p ? `${p.firstName} ${p.lastName}` : `#${myKids[0]}`;
    }
    return '';
  }, [myKids, roster]);

  return (
    <div className="p-3 sm:p-5 flex flex-col gap-4 max-w-[1500px] mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Camera size={22} className="text-indigo-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Media</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {teamName} · {season} season · game day photos from Google Drive (photos stay in Drive; metadata saved here)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Player Albums Button */}
          <button
            type="button"
            onClick={() => setAlbumsOpen(true)}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer transition shadow-sm"
          >
            <Award size={14} className="text-amber-500" />
            <span>Player Albums</span>
          </button>

          {/* Select Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              setSelectionMode((m) => !m);
              if (selectionMode) deselectAll();
            }}
            className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-bold cursor-pointer transition shadow-sm border ${
              selectionMode
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <CheckSquare size={14} />
            <span>{selectionMode ? 'Done Selecting' : 'Select'}</span>
          </button>

          {/* AI Tag Photos (Coaches only) */}
          {canEdit && signedIn && (
            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold cursor-pointer"
            >
              <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>AI Tag Photos</span>
              {unanalyzedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-black">
                  {unanalyzedCount}
                </span>
              )}
            </button>
          )}

          {/* Add photo folder (Coaches only) */}
          {canEdit && signedIn && (
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-sm"
            >
              <Plus size={14} /> Add photo folder
            </button>
          )}
        </div>
      </div>

      {/* Family Welcome Banner */}
      {watchOnly && linkedKidName && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-indigo-900/20 border border-indigo-500/30 text-indigo-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-400" />
            <span>
              Welcome to <strong>{linkedKidName}’s</strong> photo highlights! Browse, crop for Instagram, or download
              photo albums.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAlbumsOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
          >
            Open {linkedKidName}’s Album
          </button>
        </div>
      )}

      {saveError && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <AlertCircle size={14} /> {saveError}
        </p>
      )}

      {!driveReady() ? (
        <p className="text-sm text-slate-600 dark:text-slate-300 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          Google Drive is not set up for this site yet, so photo folders can’t be linked.
        </p>
      ) : !signedIn ? (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-start gap-2">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Sign in with Google to see game day photos (the same sign-in as the film).
          </p>
          <button type="button" onClick={() => void signIn()} className="h-9 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer">
            Sign in with Google
          </button>
          {signInNote && <p className="text-xs text-rose-600 dark:text-rose-400">{signInNote}</p>}
        </div>
      ) : (
        <>
          {adding && canEdit && (
            <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 flex flex-col gap-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Find the Google Drive folder with the photos, open it, and tap “Use”.
              </p>
              <DriveFolderPicker kind="photo" onPick={link} />
            </div>
          )}

          {!data.folders.length ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              No photo folders yet. {canEdit ? 'Tap “Add photo folder” and pick the Drive folder with a game’s photos.' : ''}
            </p>
          ) : (
            <>
              {/* Folder Selector Tabs */}
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Photo folders">
                {data.folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={f.id === openId}
                    onClick={() => setOpenId(f.id)}
                    className={`h-9 px-3 rounded-lg text-xs font-bold cursor-pointer max-w-[16rem] truncate transition ${
                      f.id === openId
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-750'
                    }`}
                  >
                    {f.opponent ? `${f.venue === 'away' ? '@' : f.venue === 'home' ? 'vs' : ''} ${f.opponent} · ` : ''}
                    {f.name}
                  </button>
                ))}
              </div>

              {/* Folder Metadata (Shown to coaches) */}
              {folder && canEdit && (
                <FolderDetails
                  folder={folder}
                  games={games}
                  photos={photos || []}
                  canEdit={canEdit}
                  onChange={(c) => update((d) => editFolder(d, folder.id, c))}
                  onRemove={() => {
                    update((d) => removeFolder(d, folder.id));
                    setOpenId('');
                  }}
                />
              )}

              {/* Filterable Content Library Toolbar */}
              <FilterToolbar
                filter={filter}
                onChange={setFilter}
                onReset={() => setFilter(watchOnly && myKids.length ? { player: myKids[0] } : {})}
                roster={roster}
                opponents={opponents}
                photoPlayerCounts={photoPlayerCounts}
                totalMatching={filteredPhotos.length}
                totalPhotos={photos?.length || 0}
              />

              {/* Selection Bar (Active when selectionMode is enabled) */}
              {selectionMode && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-indigo-950 dark:text-indigo-200">
                    <span>{selectedIds.size} of {filteredPhotos.length} photos selected</span>
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="px-2 py-1 rounded bg-indigo-200/60 dark:bg-indigo-800 hover:bg-indigo-200 text-indigo-900 dark:text-indigo-100 cursor-pointer"
                    >
                      Select All
                    </button>
                    {selectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="px-2 py-1 rounded hover:bg-indigo-200/50 cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Tag selected */}
                    {canEdit && selectedIds.size > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 mr-1">Tag:</span>
                        {(['social', 'poster', 'highlight'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleBatchAddTag(t)}
                            title={`Tag selected as ${TAG_LABELS[t].label}`}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900 cursor-pointer"
                          >
                            {TAG_LABELS[t].emoji} {TAG_LABELS[t].short}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Batch download ZIP */}
                    <button
                      type="button"
                      disabled={selectedIds.size === 0 || zippingBatch}
                      onClick={() => void handleBatchDownloadZip()}
                      className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                    >
                      {zippingBatch ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      <span>Download ZIP ({selectedIds.size})</span>
                    </button>
                  </div>
                </div>
              )}

              {batchZipStatus && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg">
                  <Loader2 size={13} className="animate-spin" /> {batchZipStatus}
                </p>
              )}

              {/* Photo Grid */}
              {problem ? (
                <p className="text-sm text-rose-600 dark:text-rose-400">{problem}</p>
              ) : photos === null ? (
                <p className="text-sm text-slate-500 flex items-center gap-2 py-8 justify-center">
                  <Loader2 size={18} className="animate-spin text-indigo-600" /> Looking in Google Drive…
                </p>
              ) : !photos.length ? (
                <p className="text-sm text-slate-600 dark:text-slate-300 py-8 text-center">No photos in this folder.</p>
              ) : !filteredPhotos.length ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-center">
                  <Filter size={28} className="text-slate-400" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No photos match your current filters</p>
                  <p className="text-xs text-slate-500">Try clearing or broadening your player, opponent, category or star rating filters.</p>
                  <button
                    type="button"
                    onClick={() => setFilter(watchOnly && myKids.length ? { player: myKids[0] } : {})}
                    className="mt-2 h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                  {filteredPhotos.map((p, i) => (
                    <Thumb
                      key={p.id}
                      photo={p}
                      record={records.get(p.id)}
                      isSelected={selectedIds.has(p.id)}
                      selectionMode={selectionMode}
                      onToggleSelect={() => toggleSelectPhoto(p.id)}
                      onOpen={() => setViewing(i)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Lightbox Viewer & Inspector */}
      {filteredPhotos && viewing >= 0 && filteredPhotos[viewing] && (
        <Viewer
          photos={filteredPhotos}
          index={viewing}
          records={records}
          folder={folder}
          roster={roster}
          canEdit={canEdit}
          onIndex={setViewing}
          onSavePhoto={handleSavePhoto}
          onOpenCrop={(p) => setCropPhoto(p)}
          onClose={() => setViewing(-1)}
        />
      )}

      {/* AI Tagging Modal */}
      <AiTaggingModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        currentFolder={folder}
        allFolders={data.folders}
        currentPhotos={photos || []}
        records={records}
        roster={roster}
        onSavePhoto={handleSavePhoto}
      />

      {/* Instagram Crop Modal */}
      {cropPhoto && (
        <CropModal
          open={Boolean(cropPhoto)}
          onClose={() => setCropPhoto(null)}
          photo={cropPhoto}
          record={records.get(cropPhoto.id)}
          canEdit={canEdit}
          onSaveCrop={(crop) => {
            if (folder && cropPhoto) {
              handleSavePhoto(cropPhoto.id, folder.id, { crop });
            }
          }}
        />
      )}

      {/* Player Albums Modal */}
      <PlayerAlbumsModal
        open={albumsOpen}
        onClose={() => setAlbumsOpen(false)}
        entries={allPhotoEntries}
        roster={roster}
        teamName={teamName}
        season={season}
        initialKid={myKids[0]}
        isFamily={watchOnly}
        onOpenPhoto={(photo) => {
          const idx = filteredPhotos.findIndex((p) => p.id === photo.id);
          if (idx >= 0) setViewing(idx);
          setAlbumsOpen(false);
        }}
      />
    </div>
  );
};
