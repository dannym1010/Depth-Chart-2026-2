import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  Video,
  Printer,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  PlayCircle,
  FileText,
  Eye,
  Type,
} from 'lucide-react';
import { WhiteboardDrill } from './whiteboardDrillData';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { TriangleDrillWhiteboard } from './TriangleDrillWhiteboard';
import { printDrillSheet } from './drillPrintHelper';
import { WhiteboardToken, WhiteboardArrow, WhiteboardZoneBubble, WhiteboardTextElement, PlayResponsibility } from '../../types';

interface PlaybookInteractiveSheetProps {
  drill: WhiteboardDrill;
  allPlays?: WhiteboardDrill[];
  onSelectPlay?: (play: WhiteboardDrill) => void;
  onUpdateDrill?: (updatedDrill: WhiteboardDrill) => void;
  onBackToInstall?: () => void;
  readOnly?: boolean;
}

export const PlaybookInteractiveSheet: React.FC<PlaybookInteractiveSheetProps> = ({
  drill,
  allPlays = [],
  onSelectPlay,
  onUpdateDrill,
  onBackToInstall,
  readOnly = false,
}) => {
  const [isEditMode, setIsEditMode] = useState(!readOnly);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);

  // Local phase state for interactive whiteboard
  const currentPhase = drill.phases[activePhaseIdx] || drill.phases[0] || {
    name: 'Base Alignment',
    description: '',
    tokens: [],
    arrows: [],
    zones: [],
    textElements: [],
  };

  const [tokens, setTokens] = useState<WhiteboardToken[]>(currentPhase.tokens || []);
  const [arrows, setArrows] = useState<WhiteboardArrow[]>(currentPhase.arrows || []);
  const [zones, setZones] = useState<WhiteboardZoneBubble[]>(currentPhase.zones || []);
  const [textElements, setTextElements] = useState<WhiteboardTextElement[]>(
    currentPhase.textElements || [
      {
        id: `txt-flow-${drill.id}`,
        text: '-Flow = direction of the ball\n-We are a Pursuing Gap responsible defense\n-something goes away something is coming back.\n11 guys on the tackle every play',
        x: 95,
        y: 440,
        fontSize: 11,
        color: '#1e293b',
        fontWeight: '700',
        align: 'left',
      },
    ]
  );

  // Sync state if drill changes
  React.useEffect(() => {
    const phase = drill.phases[activePhaseIdx] || drill.phases[0];
    if (phase) {
      setTokens(phase.tokens || []);
      setArrows(phase.arrows || []);
      setZones(phase.zones || []);
      if (phase.textElements && phase.textElements.length > 0) {
        setTextElements(phase.textElements);
      } else {
        setTextElements([
          {
            id: `txt-flow-${drill.id}`,
            text: '-Flow = direction of the ball\n-We are a Pursuing Gap responsible defense\n-something goes away something is coming back.\n11 guys on the tackle every play',
            x: 95,
            y: 440,
            fontSize: 11,
            color: '#1e293b',
            fontWeight: '700',
            align: 'left',
          },
        ]);
      }
    }
  }, [drill.id, activePhaseIdx]);

  // Selection & tool state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'token' | 'arrow' | 'zone' | 'text' | null>(null);
  const [stampMode, setStampMode] = useState<'none' | 'O' | 'X' | 'letter' | 'blitz' | 'zone' | 'text' | 'square'>('none');
  const [stampLabel, setStampLabel] = useState<string>('FS');

  // Video attachment state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState(drill.videoUrl || '');
  const [attachedVideoUrl, setAttachedVideoUrl] = useState(drill.videoUrl || '');

  // Responsibilities table state
  const [responsibilities, setResponsibilities] = useState<PlayResponsibility[]>(
    drill.responsibilities || []
  );

  // Update parent when whiteboard elements change
  const handleUpdatePhaseData = (
    newTokens = tokens,
    newArrows = arrows,
    newZones = zones,
    newTexts = textElements
  ) => {
    if (!onUpdateDrill) return;
    const updatedPhases = [...drill.phases];
    updatedPhases[activePhaseIdx] = {
      ...currentPhase,
      tokens: newTokens,
      arrows: newArrows,
      zones: newZones,
      textElements: newTexts,
    };
    onUpdateDrill({
      ...drill,
      responsibilities,
      videoUrl: attachedVideoUrl,
      phases: updatedPhases,
    });
  };

  const handleTokensChange = (newTokens: WhiteboardToken[]) => {
    setTokens(newTokens);
    handleUpdatePhaseData(newTokens, arrows, zones, textElements);
  };

  const handleArrowsChange = (newArrows: WhiteboardArrow[]) => {
    setArrows(newArrows);
    handleUpdatePhaseData(tokens, newArrows, zones, textElements);
  };

  const handleZonesChange = (newZones: WhiteboardZoneBubble[]) => {
    setZones(newZones);
    handleUpdatePhaseData(tokens, arrows, newZones, textElements);
  };

  const handleTextElementsChange = (newTexts: WhiteboardTextElement[]) => {
    setTextElements(newTexts);
    handleUpdatePhaseData(tokens, arrows, zones, newTexts);
  };

  const handleUpdateResponsibility = (idx: number, field: keyof PlayResponsibility, value: string) => {
    const updated = [...responsibilities];
    updated[idx] = { ...updated[idx], [field]: value };
    setResponsibilities(updated);
    if (onUpdateDrill) {
      onUpdateDrill({
        ...drill,
        responsibilities: updated,
      });
    }
  };

  // Navigation between plays in install
  const currentPlayIndex = allPlays.findIndex((p) => p.id === drill.id);
  const hasPrev = currentPlayIndex > 0;
  const hasNext = currentPlayIndex >= 0 && currentPlayIndex < allPlays.length - 1;

  const handlePrevPlay = () => {
    if (hasPrev && onSelectPlay) {
      onSelectPlay(allPlays[currentPlayIndex - 1]);
    }
  };

  const handleNextPlay = () => {
    if (hasNext && onSelectPlay) {
      onSelectPlay(allPlays[currentPlayIndex + 1]);
    }
  };

  // Add new text box helper
  const handleAddQuickText = () => {
    const newText: WhiteboardTextElement = {
      id: `txt-${Date.now()}`,
      text: 'New Coaching Key / Stunt Note',
      x: 100,
      y: 100,
      fontSize: 11,
      color: '#0f172a',
      fontWeight: '700',
      align: 'left',
    };
    const updated = [...textElements, newText];
    handleTextElementsChange(updated);
    setSelectedType('text');
    setSelectedId(newText.id);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
      {/* 1. TOP HEADER BAR - Matching User's Hudl Install Layout */}
      <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          {onBackToInstall && (
            <button
              type="button"
              onClick={onBackToInstall}
              className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Install</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              isEditMode
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {isEditMode ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5 text-blue-400" />}
            <span>{isEditMode ? 'Done Editing' : 'Edit this Play'}</span>
          </button>

          {/* Jump to Another Play Dropdown */}
          {allPlays.length > 0 && (
            <div className="relative">
              <select
                value={drill.id}
                onChange={(e) => {
                  const target = allPlays.find((p) => p.id === e.target.value);
                  if (target && onSelectPlay) onSelectPlay(target);
                }}
                className="bg-slate-800 text-xs font-bold text-slate-200 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer pr-7"
              >
                {allPlays.map((p, idx) => (
                  <option key={p.id || idx} value={p.id}>
                    {idx + 1}. {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Center: Play Title & Subtitle */}
        <div className="text-center">
          <div className="text-sm sm:text-base font-black tracking-wide text-amber-400">
            {drill.title}
          </div>
          {drill.subtitle && (
            <div className="text-xs font-semibold text-slate-400">
              {drill.subtitle}
            </div>
          )}
        </div>

        {/* Right: Next / Prev Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevPlay}
            disabled={!hasPrev}
            className="text-xs font-bold px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>PREV</span>
          </button>
          <button
            type="button"
            onClick={handleNextPlay}
            disabled={!hasNext}
            className="text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
          >
            <span>NEXT</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. LIVE EDITING TOOLBAR (When Edit Mode is Active) */}
      {isEditMode && (
        <div className="bg-slate-100 px-5 py-2.5 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-600 text-[11px] mr-1">ADD ELEMENTS:</span>
            <button
              onClick={() => {
                setStampMode(stampMode === 'O' ? 'none' : 'O');
                setStampLabel('O');
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                stampMode === 'O' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'
              }`}
            >
              + Offense Circle
            </button>
            <button
              onClick={() => {
                setStampMode(stampMode === 'square' ? 'none' : 'square');
                setStampLabel('C');
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                stampMode === 'square' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'
              }`}
            >
              + Center □
            </button>
            <button
              onClick={() => {
                setStampMode(stampMode === 'letter' ? 'none' : 'letter');
                setStampLabel('FS');
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                stampMode === 'letter' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'
              }`}
            >
              + Defense Player
            </button>
            <button
              onClick={() => {
                setStampMode(stampMode === 'blitz' ? 'none' : 'blitz');
                setStampLabel('BLITZ');
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                stampMode === 'blitz' ? 'bg-red-600 text-white' : 'bg-white border border-slate-300 text-red-700'
              }`}
            >
              + Blitz / Stunt Arrow
            </button>
            <button
              onClick={() => {
                setStampMode(stampMode === 'zone' ? 'none' : 'zone');
                setStampLabel('DEEP 1/3');
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                stampMode === 'zone' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-blue-700'
              }`}
            >
              + Pass Zone Bubble
            </button>
            <button
              onClick={handleAddQuickText}
              className="px-2.5 py-1 rounded-md font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
            >
              <Type className="w-3 h-3 text-blue-600" />
              + Movable Text Note
            </button>
          </div>

          <div className="text-[11px] text-slate-500 italic">
            Click & drag any player token, arrow, or text element to reposition freely
          </div>
        </div>
      )}

      {/* 3. WHITEBOARD DIAGRAM AREA */}
      {!isEditMode ? (
        <div className="w-full bg-slate-100/60 relative p-2 sm:p-4 lg:p-6 border-b border-slate-300 flex justify-center">
          <TriangleDrillWhiteboard
            drill={drill}
            activePhaseIdx={activePhaseIdx}
            onPhaseChange={setActivePhaseIdx}
            onOpenCustomChalkboard={() => setIsEditMode(true)}
            onPrint={() => printDrillSheet(drill, activePhaseIdx)}
          />
        </div>
      ) : (
        <div className="w-full bg-slate-100/60 relative p-2 sm:p-4 lg:p-6 border-b border-slate-300 flex justify-center">
          <div className="w-full max-w-5xl xl:max-w-6xl min-h-[540px] sm:min-h-[620px] xl:min-h-[680px] relative rounded-xl overflow-hidden shadow-md border border-slate-300/80">
            <WhiteboardCanvas
              tokens={tokens}
              arrows={arrows}
              zones={zones}
              textElements={textElements}
              isDrawingMode={false}
              penColor="#0052cc"
              penWidth={3}
              stampMode={stampMode}
              stampLabel={stampLabel}
              onUpdateTokens={handleTokensChange}
              onUpdateArrows={handleArrowsChange}
              onUpdateZones={handleZonesChange}
              onUpdateTextElements={handleTextElementsChange}
              onSelectElement={(type, id) => {
                setSelectedType(type);
                setSelectedId(id);
              }}
              selectedId={selectedId}
              selectedType={selectedType}
              sketchPadRef={{ current: null }}
              diagramKeys={drill.diagramKeys}
              showCoachingInset={true}
              showLabels={true}
              zoneShadeMode="dim"
              readOnly={!isEditMode}
            />
          </div>
        </div>
      )}

      {/* 4. ACTIONS BAR - Video Attachment, Print, Notes */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsVideoModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              attachedVideoUrl
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-blue-600" />
            <span>{attachedVideoUrl ? 'Video Clip Attached' : 'Attach a Video Clip'}</span>
          </button>

          {attachedVideoUrl && (
            <a
              href={attachedVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              <span>Play Video</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => printDrillSheet(drill, 0)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Play Sheet</span>
          </button>
        </div>
      </div>

      {/* Video Attachment Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-600" />
              Attach Video Clip to {drill.title}
            </h3>
            <p className="text-xs text-slate-500">
              Enter the link to a Hudl clip, YouTube film session, Google Drive film, or direct video URL.
            </p>
            <input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              placeholder="https://www.hudl.com/video/... or https://youtu.be/..."
              className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsVideoModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setAttachedVideoUrl(videoUrlInput);
                  if (onUpdateDrill) {
                    onUpdateDrill({ ...drill, videoUrl: videoUrlInput });
                  }
                  setIsVideoModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Save Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. RESPONSIBILITIES TABLE - Matching Hudl Install Format */}
      <div className="p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            11-Player Responsibilities Table
          </h4>
          <span className="text-[11px] text-slate-500 font-medium">
            {responsibilities.length} Positions Assigned
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3.5 w-20">Position</th>
                <th className="py-2.5 px-3.5 w-52">Alignment</th>
                <th className="py-2.5 px-3.5">Run Responsibility</th>
                <th className="py-2.5 px-3.5">Pass Responsibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {responsibilities.map((resp, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-blue-50/40 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                  }`}
                >
                  <td className="py-2.5 px-3.5 font-bold font-mono text-blue-800 text-sm">
                    {resp.position}
                  </td>
                  <td className="py-2.5 px-3.5">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={resp.alignment}
                        onChange={(e) => handleUpdateResponsibility(idx, 'alignment', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 outline-none bg-white"
                      />
                    ) : (
                      <span>{resp.alignment}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-700">
                    {isEditMode ? (
                      <textarea
                        rows={2}
                        value={resp.runResponsibility}
                        onChange={(e) => handleUpdateResponsibility(idx, 'runResponsibility', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 outline-none bg-white font-sans"
                      />
                    ) : (
                      <span className="leading-relaxed">{resp.runResponsibility}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-700">
                    {isEditMode ? (
                      <textarea
                        rows={2}
                        value={resp.passResponsibility}
                        onChange={(e) => handleUpdateResponsibility(idx, 'passResponsibility', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 outline-none bg-white font-sans"
                      />
                    ) : (
                      <span className="leading-relaxed">{resp.passResponsibility}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
