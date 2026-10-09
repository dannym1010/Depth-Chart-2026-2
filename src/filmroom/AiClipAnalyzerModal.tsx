import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  ChevronRight,
  Clock,
  Eye,
  FastForward,
  Film,
  Key,
  Layers,
  Loader2,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Upload,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import type { BreakdownRow } from './breakdownEntry';
import {
  analyzeFilmWithGemini,
  analysisResultToBreakdownRow,
  analysisResultToPlayPatch,
  captureVideoKeyframes,
  getSavedGeminiKey,
  getSavedGeminiModel,
  saveGeminiKey,
  saveGeminiModel,
  type AiFilmAnalysisResult,
  type ExtractedFrame,
} from '../services/geminiFilmService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  play?: Play;
  videoElement?: HTMLVideoElement | null;
  videoSrc?: string;
  roster?: RosterPlayer[];
  knownFormations?: string[];
  knownPlays?: string[];
  opponentName?: string;
  onApply: (row: BreakdownRow, patch: Partial<Play>, notes?: string) => void;
  onApplyAndNext?: (row: BreakdownRow, patch: Partial<Play>, notes?: string) => void;
  hasNextPlay?: boolean;
}

export const AiClipAnalyzerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  play,
  videoElement,
  videoSrc,
  roster = [],
  knownFormations = [],
  knownPlays = [],
  opponentName = 'Opponent',
  onApply,
  onApplyAndNext,
  hasNextPlay,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<number>(0);
  const [result, setResult] = useState<AiFilmAnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [coachPrompt, setCoachPrompt] = useState<string>('');

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => getSavedGeminiKey());
  const [model, setModel] = useState(() => getSavedGeminiModel());
  const [keySavedToast, setKeySavedToast] = useState(false);

  // Editable fields in results
  const [editForm, setEditForm] = useState('');
  const [editPlay, setEditPlay] = useState('');
  const [editGain, setEditGain] = useState<number>(0);
  const [editResult, setEditResult] = useState('');
  const [editOdk, setEditOdk] = useState<'O' | 'D' | 'K'>('O');
  const [editDown, setEditDown] = useState<number>(1);
  const [editDist, setEditDist] = useState<number>(10);
  const [editYard, setEditYard] = useState('');
  const [editCarrier, setEditCarrier] = useState('');
  const [editTackler, setEditTackler] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Run analysis when modal opens on a new play
  useEffect(() => {
    if (isOpen) {
      setApiKey(getSavedGeminiKey());
      setModel(getSavedGeminiModel());
    }
    if (isOpen && play) {
      handleAutoScan();
    } else if (!isOpen) {
      setResult(null);
      setFrames([]);
      setError('');
    }
  }, [isOpen, play?.id]);

  useEffect(() => {
    if (result) {
      setEditForm(result.formation);
      setEditPlay(result.playName);
      setEditGain(result.gainLoss);
      setEditResult(result.result);
      setEditOdk(result.odk);
      setEditDown(result.down);
      setEditDist(result.distance);
      setEditYard(result.yardLine);
      setEditCarrier(result.carrierName || (result.carrierNum ? `#${result.carrierNum}` : ''));
      setEditTackler(result.tacklerNames?.join(', ') || (result.tacklerNums?.length ? `#${result.tacklerNums.join(', #')}` : ''));
      setEditNotes(result.coachingNotes);
    }
  }, [result]);

  const handleAutoScan = async () => {
    setError('');
    setAnalyzing(true);
    setResult(null);

    try {
      let extracted: ExtractedFrame[] = [];

      if (videoElement && videoElement.readyState >= 2) {
        setScanStep('Capturing keyframes from video clip...');
        extracted = await captureVideoKeyframes(videoElement, 5);
        setFrames(extracted);
      } else {
        // Fallback placeholder frames if video element isn't currently loaded
        extracted = [
          { timestamp: 0.5, label: 'Pre-Snap Alignment', dataUrl: '' },
          { timestamp: 1.5, label: 'Snap & Mesh Point', dataUrl: '' },
          { timestamp: 2.5, label: 'Point of Attack', dataUrl: '' },
          { timestamp: 4.0, label: 'Tackle / Whistle', dataUrl: '' },
        ];
        setFrames(extracted);
      }

      setScanStep('Analyzing formation, scheme & down/distance with Gemini AI...');
      const res = await analyzeFilmWithGemini({
        frames: extracted.filter((f) => f.dataUrl),
        play,
        roster,
        knownFormations,
        knownPlays,
        opponentName,
        userPrompt: coachPrompt,
        apiKey,
        modelName: model,
      });

      setResult(res);
      setScanStep('');
    } catch (err: any) {
      console.error('AI Film Analysis error:', err);
      setError(err?.message || 'Failed to analyze video clip.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveKey = () => {
    saveGeminiKey(apiKey);
    saveGeminiModel(model);
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 3000);
  };

  const getFinalPayload = () => {
    if (!result) return null;
    const finalResult: AiFilmAnalysisResult = {
      ...result,
      formation: editForm || result.formation,
      playName: editPlay || result.playName,
      gainLoss: editGain ?? result.gainLoss,
      result: editResult || result.result,
      odk: editOdk || result.odk,
      down: editDown || result.down,
      distance: editDist || result.distance,
      yardLine: editYard || result.yardLine,
      carrierName: editCarrier || result.carrierName,
      coachingNotes: editNotes || result.coachingNotes,
    };

    const row = analysisResultToBreakdownRow(finalResult);
    const patch = analysisResultToPlayPatch(finalResult);
    return { row, patch, notes: finalResult.coachingNotes };
  };

  const handleApplyClick = () => {
    const payload = getFinalPayload();
    if (!payload) return;
    onApply(payload.row, payload.patch, payload.notes);
    onClose();
  };

  const handleApplyAndNextClick = () => {
    const payload = getFinalPayload();
    if (!payload) return;
    if (onApplyAndNext) {
      onApplyAndNext(payload.row, payload.patch, payload.notes);
    } else {
      onApply(payload.row, payload.patch, payload.notes);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">AI Video Clip Breakdown</h3>
                {play && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-black">
                    Play #{play.playNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated formation classification, ball carrier tracking &amp; statistical breakdown
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              aria-label="API Settings"
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showSettings
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Settings Drawer */}
          {showSettings && (
            <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Gemini API Configuration
                </span>
                {keySavedToast && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Enter your free Google AI Studio Gemini API Key for live multimodal video inference. If blank, local simulated football intelligence is used.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                <input
                  type="password"
                  placeholder="Paste Gemini API Key (AIzaSy...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white"
                />
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep)</option>
                </select>
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer shadow-xs"
                >
                  Save Key
                </button>
              </div>
            </div>
          )}

          {/* Loading / Scanning state */}
          {analyzing && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 animate-spin" />
                <Bot className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-black text-slate-900 dark:text-white">{scanStep || 'Analyzing video clip...'}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tracking players, ball direction, and yard line markers</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !analyzing && (
            <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold">Analysis Error:</span>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleAutoScan}
                  className="mt-2 inline-flex items-center gap-1 font-black underline text-rose-700 dark:text-rose-200 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            </div>
          )}

          {/* Keyframes Thumbnails Bar */}
          {frames.length > 0 && !analyzing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 uppercase tracking-wide text-[10px] font-black">
                  <Film className="w-3.5 h-3.5" /> Captured Snap Keyframes ({frames.length})
                </span>
                <span>Click frame to view</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {frames.map((frame, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedFrame(idx)}
                    className={`relative rounded-xl border overflow-hidden transition-all text-left group cursor-pointer ${
                      selectedFrame === idx
                        ? 'border-indigo-600 ring-2 ring-indigo-500/40 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
                    }`}
                  >
                    {frame.dataUrl ? (
                      <img src={frame.dataUrl} alt={frame.label} className="w-full h-14 object-cover" />
                    ) : (
                      <div className="w-full h-14 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                        Frame {idx + 1}
                      </div>
                    )}
                    <div className="p-1 bg-slate-900/90 text-white text-[9px] font-bold truncate">
                      {frame.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Analysis Results Card */}
          {result && !analyzing && (
            <div className="space-y-4">
              {/* Top Banner with Confidence & AI Badges */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-black">
                      {result.confidenceScore}% Confidence
                    </span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {editForm} · {editPlay}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      {editOdk === 'O' ? 'Offense' : editOdk === 'D' ? 'Defense' : 'Special Teams'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                      {editDown}Q {editDown} &amp; {editDist}
                    </span>
                  </div>
                </div>

                {/* Tactical Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Formation</span>
                    <input
                      value={editForm}
                      onChange={(e) => setEditForm(e.target.value)}
                      className="w-full text-sm font-black text-slate-900 dark:text-white bg-transparent outline-none mt-0.5"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Play Call / Concept</span>
                    <input
                      value={editPlay}
                      onChange={(e) => setEditPlay(e.target.value)}
                      className="w-full text-sm font-black text-slate-900 dark:text-white bg-transparent outline-none mt-0.5"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gain / Loss (Yds)</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="number"
                        value={editGain}
                        onChange={(e) => setEditGain(Number(e.target.value))}
                        className={`w-16 text-sm font-black bg-transparent outline-none ${
                          editGain > 0 ? 'text-emerald-600 dark:text-emerald-400' : editGain < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-400">{editResult}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ball Carrier / Target</span>
                    <input
                      value={editCarrier}
                      onChange={(e) => setEditCarrier(e.target.value)}
                      placeholder="#21 Nash Ward"
                      className="w-full text-sm font-bold text-slate-900 dark:text-white bg-transparent outline-none mt-0.5"
                    />
                  </div>
                </div>

                {/* Defensive Front & Tackler */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-500">Def Front:</span>
                    <span className="font-black text-slate-800 dark:text-slate-200">{result.defensiveFront || '4-4 Stack'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <User className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-500">Tackler(s):</span>
                    <input
                      value={editTackler}
                      onChange={(e) => setEditTackler(e.target.value)}
                      placeholder="#52 Jaxson Pestone"
                      className="flex-1 font-bold text-slate-800 dark:text-slate-200 bg-transparent outline-none border-b border-dashed border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* AI Coaching Breakdown Notes */}
                <div className="pt-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    AI Coaching Point / Execution Note
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <button
            type="button"
            disabled={analyzing}
            onClick={handleAutoScan}
            className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" /> Re-Scan
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!result || analyzing}
              onClick={handleApplyClick}
              className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black inline-flex items-center gap-1.5 hover:bg-slate-800 cursor-pointer disabled:opacity-40 shadow-xs"
            >
              <Check className="w-4 h-4" /> Apply to Play
            </button>
            {onApplyAndNext && hasNextPlay && (
              <button
                type="button"
                disabled={!result || analyzing}
                onClick={handleApplyAndNextClick}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-md shadow-indigo-500/20"
              >
                Apply &amp; Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
