// Batch AI photo tagger modal for Sideline Media Manager.
// Runs Gemini Multimodal Vision analysis on photos in background queue,
// extracting jersey numbers [top priority], photo category, single/group, quality metrics,
// curation score & tier, and rationale, saving each photo incrementally.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Key, Loader2, Pause, Play, RotateCcw, Shirt, SkipForward, Sparkles, X } from 'lucide-react';
import type { RosterPlayer } from '../types';
import type { DrivePhoto, MediaFolder, MediaPhoto } from './types';
import {
  analyzePhotoWithGemini,
  COMMON_TEAM_COLORS,
  getSavedOpponentColor,
  getSavedTargetColor,
  preparePhotoBase64,
  saveOpponentColor,
  saveTargetColor,
  type RosterRef,
} from './geminiMediaService';
import { getSavedGeminiKey, saveGeminiKey } from '../services/geminiFilmService';
import { driveSignIn } from '../filmroom/filmSources';
import { drivePhotoAnalysisBlob, drivePhotoThumb, listDrivePhotos } from './mediaSources';
import { cleanJersey, isPhotoTaggedOrRated, photosToRecheck, recheckKids } from './mediaData';
import { AI_COOLDOWNS, aiErrorKind, cooldownFor, limitReason, mmssLeft } from './aiCooldown';

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
  // 'recheck': run the AI again on just the photos tagged with one number (a kid's number was wrong on the roster).
  const [mode, setMode] = useState<'tag' | 'recheck'>('tag');
  const [recheckNum, setRecheckNum] = useState('');
  const [recheckEmpty, setRecheckEmpty] = useState(true);
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
  const [targetColor, setTargetColor] = useState<string>(() => getSavedTargetColor());
  const [isCustomColor, setIsCustomColor] = useState<boolean>(() => {
    const cur = getSavedTargetColor();
    return !COMMON_TEAM_COLORS.some((c) => c.value === cur);
  });
  const [customColorText, setCustomColorText] = useState<string>(() => {
    const cur = getSavedTargetColor();
    return COMMON_TEAM_COLORS.some((c) => c.value === cur) ? '' : cur;
  });
  const [opponentColor, setOpponentColor] = useState<string>(() => getSavedOpponentColor());
  const [processedIds, setProcessedIds] = useState<Set<string>>(() => new Set());
  // A wait after Gemini said no for now (402, quota, busy): seconds left, why, and which wait it is.
  const [cooldown, setCooldown] = useState<{ left: number; reason: string; strike: number } | null>(null);
  const [finished, setFinished] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  // The Google sign-in (Drive) ran out mid-run: waiting for the coach to sign in again, then the same photo.
  const [needSignIn, setNeedSignIn] = useState(false);
  const [signInNote, setSignInNote] = useState('');
  const signedInAgain = useRef(false);
  const retryRequested = useRef(false);
  const stopRequested = useRef(false);
  const pauseRequested = useRef(false);
  const skipRequested = useRef(false);

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
    return !isPhotoTaggedOrRated(records.get(p.id)) && !processedIds.has(p.id);
  }).length;

  const recheckFolderIds = new Set(scope === 'current' && currentFolder ? [currentFolder.id] : allFolders.map((f) => f.id));
  const recheckTargets = photosToRecheck(records.values(), recheckNum, recheckFolderIds, recheckEmpty);
  const recheckWithNum = cleanJersey(recheckNum) ? photosToRecheck(records.values(), recheckNum, recheckFolderIds, false).length : 0;
  const recheckReady = Boolean(cleanJersey(recheckNum)) && recheckTargets.length > 0;

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
    setFinished(false);
    setDoneCount(0);
    setSkippedCount(0);
    setCooldown(null);
    setCurrentStep('Building photo queue…');

    let items: QueueItem[] = [];
    const checking = mode === 'recheck' ? cleanJersey(recheckNum) : '';
    if (checking) {
      // Just the photos with that number (and the ones with none, if asked): find their Drive files.
      const want = new Map(recheckTargets.map((r) => [r.id, r.folderId] as const));
      const folders = allFolders.filter((f) => [...want.values()].includes(f.id));
      for (const f of folders) {
        try {
          const list = scope === 'current' && currentFolder && f.id === currentFolder.id ? currentPhotos : await listDrivePhotos(f.driveId);
          for (const p of list) if (want.get(p.id) === f.id) items.push({ photo: p, folderId: f.id, folderName: f.name });
        } catch {
          // ignore folder list errors and continue
        }
      }
    } else if (scope === 'current' && currentFolder) {
      items = currentPhotos
        .filter((p) => {
          if (!skipAnalyzed) return true;
          return !isPhotoTaggedOrRated(records.get(p.id)) && !processedIds.has(p.id);
        })
        .map((p) => ({ photo: p, folderId: currentFolder.id, folderName: currentFolder.name }));
    } else {
      // All folders
      for (const f of allFolders) {
        try {
          const list = await listDrivePhotos(f.driveId);
          const filtered = list.filter((p) => {
            if (!skipAnalyzed) return true;
            return !isPhotoTaggedOrRated(records.get(p.id)) && !processedIds.has(p.id);
          });
          items.push(...filtered.map((p) => ({ photo: p, folderId: f.id, folderName: f.name })));
        } catch {
          // ignore folder list errors and continue
        }
      }
    }

    if (!items.length) {
      setCurrentStep(checking ? `No photos tagged #${checking} found in Drive.` : 'No un-analyzed photos to process.');
      setRunning(false);
      setFinished(true);
      return;
    }

    setQueue(items);
    setCurrentIndex(0);

    // Waits in a row after Gemini said no; back to none after a photo goes through.
    let strikes = 0;
    for (let i = 0; i < items.length; i++) {
      if (stopRequested.current) break;
      if (skipRequested.current) {
        skipRequested.current = false;
        continue;
      }

      while (pauseRequested.current && !stopRequested.current) {
        setCurrentStep('Paused. Click Resume to continue.');
        await new Promise((r) => setTimeout(r, 600));
      }

      if (stopRequested.current) break;

      setCurrentIndex(i);
      const item = items[i];
      setCurrentStep(`Reading photo ${i + 1} of ${items.length}: ${item.photo.name}…`);

      // The same photo again after a cool down, when Gemini says no for now (402, quota, busy).
      let again = true;
      while (again) {
      again = false;
      try {
        const blob = await drivePhotoAnalysisBlob(item.photo);
        if (stopRequested.current) break;
        if (skipRequested.current) {
          skipRequested.current = false;
          continue;
        }

        const analysis = await analyzePhotoWithGemini({
          blob,
          driveId: item.photo.id,
          photoName: item.photo.name,
          roster: rosterRefs,
          targetJerseyColor: targetColor,
          opponentJerseyColor: opponentColor,
          onStatus: (s) => setCurrentStep(`Photo ${i + 1}/${items.length}: ${s}`),
        });

        // Incrementally save photo to store. A re-check only changes the numbers: ratings, tags and the rest stay.
        if (checking) onSavePhoto(item.photo.id, item.folderId, { kids: recheckKids(records.get(item.photo.id)?.kids, checking, analysis.kids || []) });
        else onSavePhoto(item.photo.id, item.folderId, analysis);
        setProcessedIds((prev) => new Set(prev).add(item.photo.id));

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

        strikes = 0;
        setDoneCount((n) => n + 1);
        // Small 1.2s pace between photos to protect Gemini free-tier RPM quota
        if (i < items.length - 1 && !stopRequested.current && !skipRequested.current) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const kind = aiErrorKind(msg);
        if (kind === 'key') {
          setErrorNote(msg);
          setShowKeyEditor(true);
          setRunning(false);
          setFinished(true);
          return;
        }
        if (kind === 'signin') {
          // Not this photo's fault: wait for "Sign in with Google", then the same photo again (Stop ends the batch).
          signedInAgain.current = false;
          setSignInNote('');
          setNeedSignIn(true);
          setCurrentStep('Waiting for you to sign in to Google again…');
          while (!signedInAgain.current && !stopRequested.current) await new Promise((r) => setTimeout(r, 400));
          setNeedSignIn(false);
          if (stopRequested.current) break;
          setCurrentStep(`Signed in. Trying photo ${i + 1} again…`);
          again = true;
          continue;
        }
        if (kind === 'limit') {
          const wait = cooldownFor(strikes);
          if (wait === null) {
            setErrorNote(
              `${limitReason(msg)}, and it still said no after ${strikes} waits. Stopped at photo ${i + 1} of ${items.length}; the photos done are saved. ` +
                (/402|Payment Required|prepayment|credits/i.test(msg)
                  ? 'Top up the credits in Google AI Studio, or use a key from a free-tier project, then Run again.'
                  : 'Try Run again later (Google’s daily limits start over overnight).')
            );
            if (/402|Payment Required|prepayment|credits/i.test(msg)) setShowKeyEditor(true);
            setRunning(false);
            setFinished(true);
            return;
          }
          strikes++;
          // Count down; Retry now ends it early, Stop ends the batch.
          retryRequested.current = false;
          for (let left = wait; left > 0; left--) {
            if (stopRequested.current || retryRequested.current) break;
            setCooldown({ left, reason: limitReason(msg), strike: strikes });
            await new Promise((r) => setTimeout(r, 1000));
          }
          setCooldown(null);
          if (stopRequested.current) break;
          setCurrentStep(`Trying photo ${i + 1} again…`);
          again = true;
          continue;
        }
        // Something about this photo (it couldn't be read): skip it, Run again tries it later.
        setSkippedCount((n) => n + 1);
        setCurrentStep(`Skipped photo (${msg.slice(0, 80)})`);
        await new Promise((r) => setTimeout(r, 1000));
      }
      }
      if (stopRequested.current) break;
    }

    setRunning(false);
    setFinished(true);
    setCooldown(null);
    if (!stopRequested.current) setCurrentStep('All photos processed!');
  };

  // Must follow the tap (Google's sign-in window).
  const signInAgain = async () => {
    setSignInNote('');
    try {
      await driveSignIn();
      signedInAgain.current = true;
    } catch (e) {
      setSignInNote(e instanceof Error ? e.message : 'Google sign-in did not finish. Tap Sign in again.');
    }
  };

  const handleStop = () => {
    stopRequested.current = true;
    setRunning(false);
    setPaused(false);
    setCooldown(null);
    setNeedSignIn(false);
    setFinished(true);
    setCurrentStep('Stopped. The photos done are saved.');
  };

  // Back to the start screen (the same choices), for another run: photos already tagged are skipped, so it picks
  // up where it stopped.
  const runAgain = () => {
    setQueue([]);
    setCurrentIndex(0);
    setCurrentStep('');
    setErrorNote('');
    setFinished(false);
    setCooldown(null);
    setDoneCount(0);
    setSkippedCount(0);
    setSkipAnalyzed(true);
  };
  const close = () => {
    if (running) return;
    // Opened again later, it starts fresh (not stuck on the last run).
    if (finished) runAgain();
    onClose();
  };

  const handleSkipPhoto = () => {
    skipRequested.current = true;
    setCurrentStep('Skipping to next photo…');
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
            onClick={close}
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
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="tablist" aria-label="What to run">
                {(
                  [
                    ['tag', 'Tag photos'],
                    ['recheck', 'Re-check one number'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={mode === id}
                    onClick={() => setMode(id)}
                    className={`h-8 rounded-lg text-xs font-black cursor-pointer ${
                      mode === id ? 'bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'recheck' && (
                <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col gap-2.5">
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Fixed a kid&apos;s number on the roster? Type the <strong>wrong number</strong> photos were tagged with. The AI looks at just those photos again with the fixed roster. Only the numbers on them change: stars, tags and favorites stay.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="recheck-num" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Number to re-check
                    </label>
                    <div className="flex items-center h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-2">
                      <span className="text-sm font-black text-slate-400">#</span>
                      <input
                        id="recheck-num"
                        inputMode="numeric"
                        value={recheckNum}
                        onChange={(e) => setRecheckNum(cleanJersey(e.target.value).slice(0, 3))}
                        placeholder="32"
                        className="w-14 h-full px-1 bg-transparent text-sm font-black text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    {cleanJersey(recheckNum) && (
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {recheckWithNum} photo{recheckWithNum === 1 ? '' : 's'} tagged #{cleanJersey(recheckNum)}
                        {roster.some((r) => String(r.num) === cleanJersey(recheckNum)) ? '' : ' · not on the roster now'}
                      </span>
                    )}
                  </div>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recheckEmpty}
                      onChange={(e) => setRecheckEmpty(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Also photos where the AI found no number ({photosToRecheck(records.values(), '', recheckFolderIds, true).length})
                  </label>
                </div>
              )}

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

              {/* Team Uniform Color to Tag */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Shirt size={15} className="text-indigo-600 dark:text-indigo-400" />
                    Team Jersey Color to Tag
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Filters out opposing team numbers
                  </span>
                </div>

                {/* Preset color pills */}
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_TEAM_COLORS.map((c) => {
                    const active = !isCustomColor && targetColor === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          setIsCustomColor(false);
                          setTargetColor(c.value);
                          saveTargetColor(c.value);
                        }}
                        className={`h-7 px-2.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                          active
                            ? 'ring-2 ring-indigo-500 ring-offset-1 border-indigo-600 shadow-sm scale-[1.02]'
                            : 'opacity-80 hover:opacity-100 hover:scale-[1.01]'
                        } ${c.bg} ${c.border}`}
                      >
                        <span>{c.label}</span>
                        {c.note && <span className="text-[10px] opacity-75 font-normal">({c.note})</span>}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomColor(true);
                      if (customColorText) {
                        setTargetColor(customColorText);
                        saveTargetColor(customColorText);
                      }
                    }}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      isCustomColor
                        ? 'ring-2 ring-indigo-500 border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-black'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    ✏️ Custom Color…
                  </button>
                </div>

                {/* Custom Color Input if enabled */}
                {isCustomColor && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="text"
                      value={customColorText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomColorText(val);
                        setTargetColor(val || 'Any');
                        saveTargetColor(val || 'Any');
                      }}
                      placeholder="e.g. Royal Blue jerseys with White numbers"
                      className="flex-1 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {/* Opponent jersey color (optional) */}
                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/80 dark:border-slate-800/80 text-[11px]">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                    Opponent Color (optional):
                  </span>
                  <input
                    type="text"
                    value={opponentColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOpponentColor(val);
                      saveOpponentColor(val);
                    }}
                    placeholder="e.g. Red, Somers Green, Brewster White (leave empty if unknown)"
                    className="flex-1 h-7 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {mode === 'tag' && (
              <>
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
            </>
          )}

          {/* Progress Section */}
          {(running || total > 0) && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span>{running ? `Processing ${currentIndex + 1} of ${total}…` : stopRequested.current || errorNote ? `Stopped at ${currentIndex + 1} of ${total}` : 'Processing Complete'}</span>
                  {targetColor && targetColor !== 'Any' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                      <Shirt size={10} /> {targetColor}
                    </span>
                  )}
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
                {running && !cooldown && <Loader2 size={13} className="animate-spin text-indigo-600 shrink-0" />}
                {cooldown ? `Waiting before trying photo ${currentIndex + 1} again…` : currentStep}
              </p>
              {(doneCount > 0 || skippedCount > 0) && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {doneCount} tagged and saved{skippedCount ? ` · ${skippedCount} skipped (Run again tries them)` : ''}
                </p>
              )}
            </div>
          )}

          {/* The Google sign-in ran out: tagging waits on this photo until it's back. */}
          {running && needSignIn && (
            <div className="p-3 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-xs text-sky-900 dark:text-sky-100 flex flex-col gap-2" role="alert">
              <p className="font-bold">Your Google sign-in ran out (it lasts about an hour), so the photos can't be read from Drive.</p>
              <p className="text-[11px] opacity-80">Tagging is waiting on photo {currentIndex + 1}. Sign in again and it carries on from there. Nothing is lost.</p>
              <button
                type="button"
                onClick={() => void signInAgain()}
                className="self-start h-9 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-black cursor-pointer"
              >
                Sign in with Google
              </button>
              {signInNote && <p className="text-[11px] text-rose-700 dark:text-rose-300">{signInNote}</p>}
            </div>
          )}

          {/* Cooling down: Gemini said no for now (402, quota, busy). */}
          {cooldown && (
            <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-100 flex flex-col gap-2" role="status">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black tabular-nums">{mmssLeft(cooldown.left)}</span>
                <div className="min-w-0">
                  <p className="font-bold">{cooldown.reason}. Cooling down, then trying again.</p>
                  <p className="text-[11px] opacity-80">
                    Wait {cooldown.strike} of {AI_COOLDOWNS.length} (each one longer). Nothing is lost: every photo done is saved.
                  </p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-amber-200 dark:bg-amber-900 overflow-hidden">
                <div className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear" style={{ width: `${(cooldown.left / (AI_COOLDOWNS[cooldown.strike - 1] || 1)) * 100}%` }} />
              </div>
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
                <p className="font-bold">AI tagging stopped</p>
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
                onClick={close}
                className="h-9 px-3.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void startBatch()}
                disabled={mode === 'recheck' && !recheckReady}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-default"
              >
                <Sparkles size={14} />{' '}
                {mode === 'recheck' ? (recheckReady ? `Re-check ${recheckTargets.length} photo${recheckTargets.length === 1 ? '' : 's'}` : 'Re-check') : 'Start AI Tagging'}
              </button>
            </>
          ) : (
            <>
              {running ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="h-9 px-3.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  Stop Tagging
                </button>
              ) : (
                <button
                  type="button"
                  onClick={runAgain}
                  title="Back to the choices; photos already tagged are skipped, so it picks up where it stopped"
                  className="h-9 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RotateCcw size={14} /> Run again
                </button>
              )}
              <div className="flex items-center gap-2">
                {running && cooldown && (
                  <button
                    type="button"
                    onClick={() => (retryRequested.current = true)}
                    className="h-9 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} /> Retry now
                  </button>
                )}
                {running && !cooldown && (
                  <>
                    <button
                      type="button"
                      onClick={handleSkipPhoto}
                      title="Skip this photo and move to next"
                      className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <SkipForward size={14} /> Skip Photo
                    </button>
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
                  </>
                )}
                {!running && (
                  <button
                    type="button"
                    onClick={close}
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

