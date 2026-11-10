// Batch AI photo tagger modal for Sideline Media Manager.
// Runs Gemini Multimodal Vision analysis on photos in background queue,
// extracting jersey numbers [top priority], photo category, single/group, quality metrics,
// curation score & tier, and rationale, saving each photo incrementally.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Key, Loader2, Pause, Play, Sparkles, X } from 'lucide-react';
import type { RosterPlayer } from '../types';
import type { DrivePhoto, MediaFolder, MediaPhoto } from './types';
import { analyzePhotoWithGemini, preparePhotoBase64, type RosterRef } from './geminiMediaService';
import { getSavedGeminiKey, saveGeminiKey } from '../services/geminiFilmService';
import { drivePhotoBlob, drivePhotoThumb, listDrivePhotos } from './mediaSources';
import { STARS } from './mediaData';

interface Props {
  open: boolean;
  onClose: () => void;
  currentFolder: MediaFolder | null;
  allFolders: MediaFolder[];
  currentPhotos: DrivePhoto[];
  records: Map<string, MediaPhoto>;
  roster: RosterPlayer[];
  onSavePhoto: (photoId: string, folderId: string, data: Partial<MediaPhoto>) => void;
}

interface QueueItem {
  photo: DrivePhoto;
  folderId: string;
  folderName: string;
}

export const AiTaggingModal: React.FC<Props> = ({
  open,
  onClose,
  currentFolder,
  allFolders,
  currentPhotos,
  records,
  roster,
  onSavePhoto,
}) => {
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [skipAnalyzed, setSkipAnalyzed] = useState(true);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [lastResult, setLastResult] = useState<{
    photo: DrivePhoto;
    thumbUrl?: string;
    kids: string[];
    category?: string;
    side?: string;
    score?: number;
    tier?: string;
    rationale?: string;
  } | null>(null);
  const [errorNote, setErrorNote] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(() => getSavedGeminiKey());
  const [showKeyEditor, setShowKeyEditor] = useState(() => !getSavedGeminiKey());
  const [keySavedNote, setKeySavedNote] = useState('');
  const stopRequested = useRef(false);
  const pauseRequested = useRef(false);

  const handleSaveKey = () => {
    saveGeminiKey(apiKeyInput.trim());
    setKeySavedNote('Key saved on this device!');
    setTimeout(() => setKeySavedNote(''), 3000);
    if (apiKeyInput.trim()) setShowKeyEditor(false);
  };

  // Sync ref with pause state
  useEffect(() => {
    pauseRequested.current = paused;
  }, [paused]);

  // Compute unanalyzed counts
  const unanalyzedInCurrent = currentPhotos.filter((p) => {
    const r = records.get(p.id);
    return !r?.aiAnalyzedAt && r?.score === undefined;
  }).length;

  const rosterRefs: RosterRef[] = roster.map((r) => ({
    num: r.num,
    firstName: r.firstName,
    lastName: r.lastName,
  }));

  const startBatch = async () => {
    setErrorNote('');
    const keyCheck = getSavedGeminiKey();
    if (!keyCheck) {
      setErrorNote('No Gemini API key found on this device. Paste your key in the box above and click "Save Key" first.');
      setShowKeyEditor(true);
      setRunning(false);
      return;
    }
    stopRequested.current = false;
    pauseRequested.current = false;
    setPaused(false);
    setRunning(true);
    setCurrentStep('Building photo queue…');

    let items: QueueItem[] = [];
    if (scope === 'current' && currentFolder) {
      items = currentPhotos
        .filter((p) => {
          if (!skipAnalyzed) return true;
          const r = records.get(p.id);
          return !r?.aiAnalyzedAt && r?.score === undefined;
        })
        .map((p) => ({ photo: p, folderId: currentFolder.id, folderName: currentFolder.name }));
    } else {
      // All folders
      for (const f of allFolders) {
        try {
          const list = await listDrivePhotos(f.driveId);
          const filtered = list.filter((p) => {
            if (!skipAnalyzed) return true;
            const r = records.get(p.id);
            return !r?.aiAnalyzedAt && r?.score === undefined;
          });
          items.push(...filtered.map((p) => ({ photo: p, folderId: f.id, folderName: f.name })));
        } catch {
          // ignore folder list errors and continue
        }
      }
    }

    if (!items.length) {
      setCurrentStep('No un-analyzed photos to process.');
      setRunning(false);
      return;
    }

    setQueue(items);
    setCurrentIndex(0);

    for (let i = 0; i < items.length; i++) {
      if (stopRequested.current) break;

      while (pauseRequested.current && !stopRequested.current) {
        setCurrentStep('Paused. Click Resume to continue.');
        await new Promise((r) => setTimeout(r, 600));
      }

      if (stopRequested.current) break;

      setCurrentIndex(i);
      const item = items[i];
      setCurrentStep(`Reading photo ${i + 1} of ${items.length}: ${item.photo.name}…`);

      try {
        const blob = await drivePhotoBlob(item.photo.id);
        const analysis = await analyzePhotoWithGemini({
          blob,
          driveId: item.photo.id,
          photoName: item.photo.name,
          roster: rosterRefs,
          onStatus: (s) => setCurrentStep(`Photo ${i + 1}/${items.length}: ${s}`),
        });

        // Incrementally save photo to store
        onSavePhoto(item.photo.id, item.folderId, analysis);

        // Fetch thumbnail for preview
        let thumb = '';
        try {
          thumb = await drivePhotoThumb(item.photo);
        } catch {
          /* ignore */
        }

        setLastResult({
          photo: item.photo,
          thumbUrl: thumb,
          kids: analysis.kids || [],
          category: analysis.category,
          side: analysis.side,
          score: analysis.score,
          tier: analysis.tier,
          rationale: analysis.curationRationale,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/refused this Gemini API key|quota reached|No Gemini API key/i.test(msg)) {
          setErrorNote(msg);
          setShowKeyEditor(true);
          setRunning(false);
          return;
        }
        // Other photo error, continue to next
        setCurrentStep(`Skipped photo (${msg.slice(0, 80)})`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    setRunning(false);
    setCurrentStep('All photos processed!');
  };

  const handleStop = () => {
    stopRequested.current = true;
    setRunning(false);
    setPaused(false);
    setCurrentStep('Stopped.');
  };

  if (!open) return null;

  const total = queue.length;
  const progressPct = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white grid place-items-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">AI Photo Tagging</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gemini Vision sports analyst · Jersey numbers, categories, quality tiers
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={running}
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Gemini API Key Configuration Box */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Key size={14} className="text-indigo-600 dark:text-indigo-400" />
                Google Gemini API Key
              </span>
              {!showKeyEditor && getSavedGeminiKey() && (
                <button
                  type="button"
                  onClick={() => setShowKeyEditor(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                >
                  Change Key
                </button>
              )}
            </div>

            {showKeyEditor || !getSavedGeminiKey() ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enter your Google AI Studio key (starts with <code className="font-mono text-indigo-600 dark:text-indigo-400">AIzaSy…</code>). Free at{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-indigo-600 dark:text-indigo-400 font-semibold"
                  >
                    aistudio.google.com
                  </a>.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Paste Gemini API Key (AIzaSy...)"
                    className="flex-1 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Save Key
                  </button>
                  {getSavedGeminiKey() && (
                    <button
                      type="button"
                      onClick={() => setShowKeyEditor(false)}
                      className="h-8 px-2 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {keySavedNote && <p className="text-[11px] text-emerald-600 font-bold">{keySavedNote}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 size={14} />
                <span>API Key configured on this device ({getSavedGeminiKey().slice(0, 6)}…{getSavedGeminiKey().slice(-4)})</span>
              </div>
            )}
          </div>
          {!running && total === 0 && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Folder Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope('current')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      scope === 'current'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <p className="text-xs font-black text-slate-900 dark:text-white">This Folder Only</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {currentFolder?.name || 'Current'} ({unanalyzedInCurrent} untagged)
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      scope === 'all'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <p className="text-xs font-black text-slate-900 dark:text-white">All Photo Folders</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {allFolders.length} folders in library
                    </p>
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipAnalyzed}
                  onChange={(e) => setSkipAnalyzed(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Skip photos that have already been tagged/rated
              </label>

              <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1.5">
                <p className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles size={14} /> Courtney’s AI Wish List Specifications
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <li><strong>Jersey Numbers [Top Priority]:</strong> Fabric stretching & body angle precision, zero hallucinations.</li>
                  <li><strong>Category Classification:</strong> Action (Offense/Defense), Sidelines, Warmups, Celebration, Post-game, Coaches, Fans, Portraits.</li>
                  <li><strong>Quality & Curation:</strong> 1-10 scores for focus, framing, emotion & subject isolation with 4-star Elite to 1-star Reject tiers.</li>
                </ul>
              </div>
            </>
          )}

          {/* Progress Section */}
          {(running || total > 0) && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {running ? `Processing ${currentIndex + 1} of ${total}…` : 'Processing Complete'}
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-semibold">{progressPct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                {running && <Loader2 size={13} className="animate-spin text-indigo-600 shrink-0" />}
                {currentStep}
              </p>
            </div>
          )}

          {/* Last Analyzed Card Preview */}
          {lastResult && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex gap-3 items-center">
              {lastResult.thumbUrl ? (
                <img
                  src={lastResult.thumbUrl}
                  alt={lastResult.photo.name}
                  className="w-16 h-16 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-800 grid place-items-center text-slate-400 shrink-0">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {lastResult.photo.name}
                  </span>
                  {lastResult.tier && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        lastResult.tier === 'Elite'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                          : lastResult.tier === 'Good'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {lastResult.tier} ({lastResult.score?.toFixed(1)})
                    </span>
                  )}
                  {lastResult.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                      {lastResult.category} {lastResult.side ? `· ${lastResult.side}` : ''}
                    </span>
                  )}
                </div>
                {lastResult.kids.length > 0 ? (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-1">
                    Jerseys detected: {lastResult.kids.map((k) => `#${k}`).join(', ')}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">No jersey numbers visible</p>
                )}
                {lastResult.rationale && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                    “{lastResult.rationale}”
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error notice */}
          {errorNote && (
            <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">AI Analysis Paused</p>
                <p>{errorNote}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between">
          {!running && total === 0 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void startBatch()}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Sparkles size={14} /> Start AI Tagging
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleStop}
                className="h-9 px-3.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                Stop Tagging
              </button>
              <div className="flex items-center gap-2">
                {running && (
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="h-9 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {paused ? (
                      <>
                        <Play size={14} /> Resume
                      </>
                    ) : (
                      <>
                        <Pause size={14} /> Pause
                      </>
                    )}
                  </button>
                )}
                {!running && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

