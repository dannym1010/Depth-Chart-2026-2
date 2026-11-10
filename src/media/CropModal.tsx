// Instagram Ratios Crop & Export modal for Sideline Media Manager.
// Presets: 1:1 (Square), 4:5 (Portrait Feed), 9:16 (Stories/Reels), 1.91:1 (Landscape).
// Allows positioning, zooming, previewing, saving crop settings, and exporting cropped JPEGs.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Instagram, Loader2, RotateCcw, Share2, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { DrivePhoto, MediaCrop, MediaPhoto } from './types';
import { drivePhotoBlob, drivePhotoUrl } from './mediaSources';

interface Props {
  open: boolean;
  onClose: () => void;
  photo: DrivePhoto;
  record?: MediaPhoto;
  canEdit: boolean;
  onSaveCrop: (crop: MediaCrop) => void;
}

export type AspectRatio = '1:1' | '4:5' | '9:16' | '1.91:1' | 'original';

const ASPECT_RATIOS: { id: AspectRatio; label: string; ratio: number | null; hint: string }[] = [
  { id: '1:1', label: '1:1 Square', ratio: 1.0, hint: 'Classic Instagram post' },
  { id: '4:5', label: '4:5 Portrait', ratio: 4 / 5, hint: 'Best for IG Feed (max vertical space)' },
  { id: '9:16', label: '9:16 Story / Reel', ratio: 9 / 16, hint: 'Full-screen Story & Reel' },
  { id: '1.91:1', label: '1.91:1 Landscape', ratio: 1.91, hint: 'Wide banner / landscape feed' },
  { id: 'original', label: 'Original', ratio: null, hint: 'Uncropped full frame' },
];

export const CropModal: React.FC<Props> = ({ open, onClose, photo, record, canEdit, onSaveCrop }) => {
  const [aspect, setAspect] = useState<AspectRatio>(record?.crop?.aspect || '4:5');
  const [imgUrl, setImgUrl] = useState('');
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Load photo
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let off = false;
    drivePhotoUrl(photo.id)
      .then((u) => {
        if (off) return;
        setImgUrl(u);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!off) {
            setImgElement(img);
            setLoading(false);
          }
        };
        img.onerror = () => {
          if (!off) setLoading(false);
        };
        img.src = u;
      })
      .catch(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [open, photo.id]);

  const activeRatio = ASPECT_RATIOS.find((r) => r.id === aspect) || ASPECT_RATIOS[1];

  // Mouse pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      setOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    },
    [dragging]
  );

  const handleMouseUp = () => setDragging(false);

  // Touch pan handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setDragging(true);
      dragStart.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
    }
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging || e.touches.length !== 1) return;
      setOffset({
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y,
      });
    },
    [dragging]
  );

  const resetTransform = () => {
    setZoom(1.0);
    setOffset({ x: 0, y: 0 });
  };

  // Render cropped image to high-res blob
  const generateCroppedBlob = async (): Promise<Blob> => {
    if (!imgElement) throw new Error('Photo not ready');
    const origW = imgElement.naturalWidth || 1000;
    const origH = imgElement.naturalHeight || 1000;

    let targetRatio = activeRatio.ratio;
    if (targetRatio === null) targetRatio = origW / origH;

    let cropW = origW;
    let cropH = origH;
    if (origW / origH > targetRatio) {
      cropW = origH * targetRatio;
      cropH = origH;
    } else {
      cropW = origW;
      cropH = origW / targetRatio;
    }

    // Apply zoom
    cropW = cropW / zoom;
    cropH = cropH / zoom;

    // Apply normalized offset
    const cont = containerRef.current;
    const contW = cont ? cont.clientWidth : 400;
    const contH = cont ? cont.clientHeight : 400;
    const normX = -offset.x / (contW * zoom);
    const normY = -offset.y / (contH * zoom);

    let startX = (origW - cropW) / 2 + normX * origW;
    let startY = (origH - cropH) / 2 + normY * origH;

    // Clamp inside source image
    startX = Math.max(0, Math.min(origW - cropW, startX));
    startY = Math.max(0, Math.min(origH - cropH, startY));

    const canvas = document.createElement('canvas');
    // Standard high-res target dimensions
    const maxOutput = 1600;
    let outW = maxOutput;
    let outH = Math.round(maxOutput / targetRatio);
    if (targetRatio < 1) {
      outH = maxOutput;
      outW = Math.round(maxOutput * targetRatio);
    }
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');

    ctx.drawImage(imgElement, startX, startY, cropW, cropH, 0, 0, outW, outH);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/jpeg', 0.92);
    });
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      const blob = await generateCroppedBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = photo.name.replace(/\.[^.]+$/, '');
      a.download = `${baseName}_instagram_${aspect.replace(':', 'x')}.jpg`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (canEdit) {
        onSaveCrop({ aspect });
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      await handleDownload();
      return;
    }
    setExporting(true);
    try {
      const blob = await generateCroppedBlob();
      const baseName = photo.name.replace(/\.[^.]+$/, '');
      const file = new File([blob], `${baseName}_instagram.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: photo.name,
          text: `Mahopac Football 10U - ${photo.name}`,
        });
      } else {
        await handleDownload();
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        alert(e.message);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleSave = () => {
    onSaveCrop({ aspect });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5" role="dialog">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white grid place-items-center shadow-md">
              <Instagram size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black leading-tight">Instagram Crop & Export</h2>
              <p className="text-[11px] text-slate-400">Position and crop photo to standard social ratios</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Aspect Ratio Toolbar */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Ratios:</span>
          {ASPECT_RATIOS.map((r) => {
            const active = aspect === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setAspect(r.id);
                  resetTransform();
                }}
                title={r.hint}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Center Canvas / Interactive Workspace */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          className="flex-1 min-h-[300px] sm:min-h-[420px] bg-black/60 relative overflow-hidden grid place-items-center select-none cursor-grab active:cursor-grabbing"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <span className="text-xs">Loading photo…</span>
            </div>
          ) : imgUrl ? (
            <div
              className="relative transition-transform duration-75 flex items-center justify-center"
              style={{
                aspectRatio: activeRatio.ratio ? `${activeRatio.ratio}` : undefined,
                maxHeight: '85%',
                maxWidth: '85%',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65), 0 0 0 2px rgba(255, 255, 255, 0.4)',
              }}
            >
              <img
                src={imgUrl}
                alt={photo.name}
                draggable={false}
                style={{
                  transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
                  transition: dragging ? 'none' : 'transform 0.1s ease-out',
                }}
                className="max-h-full max-w-full object-cover pointer-events-none"
              />

              {/* Grid guide overlay (Rule of Thirds) */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-40">
                <div className="border-r border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-b border-white/50" />
                <div className="border-r border-white/50" />
                <div className="border-r border-white/50" />
                <div />
              </div>
            </div>
          ) : null}

          {/* Floating Pan/Zoom Controls */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 shadow-lg text-white text-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              title="Zoom Out"
              className="p-1 hover:bg-slate-800 rounded-full cursor-pointer"
            >
              <ZoomOut size={16} />
            </button>
            <span className="font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.0, z + 0.15))}
              title="Zoom In"
              className="p-1 hover:bg-slate-800 rounded-full cursor-pointer"
            >
              <ZoomIn size={16} />
            </button>
            <div className="h-4 w-px bg-slate-700 mx-1" />
            <button
              type="button"
              onClick={resetTransform}
              title="Reset Position & Zoom"
              className="p-1 hover:bg-slate-800 rounded-full cursor-pointer text-slate-300 hover:text-white"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between flex-wrap gap-2 text-white">
          <span className="text-xs text-slate-400">
            {activeRatio.label} ({activeRatio.hint}) · Drag photo to frame
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={exporting || loading}
              onClick={() => void handleDownload()}
              className="h-9 px-3.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Download Crop</span>
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                disabled={exporting || loading}
                onClick={() => void handleShare()}
                className="h-9 px-3.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Share2 size={14} /> Share
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check size={14} /> Save Crop
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

