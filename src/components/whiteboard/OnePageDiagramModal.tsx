import React, { useState } from 'react';
import { X, Printer, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { OnePageDiagramConfig } from './whiteboardDrillData';

interface OnePageDiagramModalProps {
  config: OnePageDiagramConfig;
  onClose: () => void;
}

export const OnePageDiagramModal: React.FC<OnePageDiagramModalProps> = ({ config, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullView, setIsFullView] = useState<boolean>(false);

  const handlePrint = () => {
    window.print();
  };

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const resetZoom = () => setZoomLevel(1);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-1 sm:p-3 md:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={config.title}
    >
      <div className={`relative w-full ${isFullView ? 'max-w-full h-full' : 'max-w-6xl'} bg-[#070b14] text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col my-auto max-h-[98vh]`}>
        
        {/* ACTION BAR (NON-PRINT) */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 print:hidden flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-black text-xs font-black uppercase tracking-wider shadow-xs">
              1-Page Coaching Install Sheet
            </span>
            <span className="text-xs text-slate-300 font-bold hidden md:inline truncate max-w-md">
              {config.title}
            </span>
          </div>

          {/* Zoom & Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={zoomOut}
                disabled={zoomLevel <= 0.75}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-2 text-slate-300 min-w-[45px] text-center select-none">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={zoomIn}
                disabled={zoomLevel >= 2.5}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  onClick={resetZoom}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  title="Reset Zoom"
                  aria-label="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFullView((prev) => !prev)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
              title={isFullView ? "Exit Fullscreen" : "Fullscreen View"}
              aria-label={isFullView ? "Exit Fullscreen" : "Fullscreen View"}
            >
              {isFullView ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-sm transition-colors cursor-pointer"
              title="Print 1-Page Install Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DIAGRAM SHEET CONTAINER */}
        <div className="flex-1 overflow-auto p-2 sm:p-4 bg-[#070b14] flex justify-center items-start print:p-0 print:m-0 print:bg-white">
          <div
            className="transition-transform duration-150 origin-top flex flex-col items-center max-w-full print:transform-none"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <div className="rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700 bg-black print:border-none print:shadow-none max-w-full">
              <img
                src="/cover3_tandem_triangle_drill_sheet.jpg"
                alt={config.title}
                className="w-full h-auto max-w-[1100px] object-contain block select-none"
                loading="eager"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
