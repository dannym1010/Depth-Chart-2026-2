import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Film,
  Flag,
  Key,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  User,
  UserCheck,
  UserX,
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
  simulateLocalAiBreakdown,
  type AiFilmAnalysisResult,
  type ExtractedFrame,
} from '../services/geminiFilmService';
import { crossCheckPlayYardage, formatAbsoluteYard, parseAbsoluteYard } from '../services/yardageCalculator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  play?: Play;
  nextPlay?: Play;
  videoElement?: HTMLVideoElement | null;
  videoSrc?: string;
  roster?: RosterPlayer[];
  knownFormations?: string[];
  knownPlays?: string[];
  teamName?: string;
  opponentName?: string;
  isOwnGame?: boolean;
  gameId?: string;
  onApply: (row: BreakdownRow, patch: Partial<Play>, notes?: string) => void;
  onApplyAndNext?: (row: BreakdownRow, patch: Partial<Play>, notes?: string) => void;
  hasNextPlay?: boolean;
}

interface StoredGameContext {
  gameType: 'our_game' | 'scout_game';
  offenseTeam: string;
  defenseTeam: string;
  offenseColor: string;
  defenseColor: string;
  linkOurRoster: boolean;
}

const COMMON_PENALTIES = [
  { label: 'Offensive Holding', yards: -10, on: 'Offense' as const },
  { label: 'Block in the Back', yards: -10, on: 'Offense' as const },
  { label: 'False Start', yards: -5, on: 'Offense' as const },
  { label: 'Illegal Shift / Motion', yards: -5, on: 'Offense' as const },
  { label: 'Defensive Offside / Encroachment', yards: 5, on: 'Defense' as const },
  { label: 'Pass Interference (DPI)', yards: 15, on: 'Defense' as const },
  { label: 'Face Mask', yards: 15, on: 'Defense' as const },
  { label: 'Unsportsmanlike Conduct', yards: 15, on: 'Defense' as const },
];

export const AiClipAnalyzerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  play,
  nextPlay,
  videoElement,
  roster = [],
  knownFormations = [],
  knownPlays = [],
  teamName = 'Mahopac 10U',
  opponentName = 'Opponent',
  isOwnGame = true,
  gameId = '',
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

  // Game Context Setup
  const [gameType, setGameType] = useState<'our_game' | 'scout_game'>(
    isOwnGame === false ? 'scout_game' : 'our_game'
  );
  const [offenseTeam, setOffenseTeam] = useState<string>(teamName);
  const [defenseTeam, setDefenseTeam] = useState<string>(opponentName);
  const [offenseColor, setOffenseColor] = useState<string>('Dark');
  const [defenseColor, setDefenseColor] = useState<string>('White');
  const [linkOurRoster, setLinkOurRoster] = useState<boolean>(isOwnGame !== false);
  const [showGameSetup, setShowGameSetup] = useState(false);

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
  const [editCarrierNum, setEditCarrierNum] = useState('');
  const [editPlayDir, setEditPlayDir] = useState<'L' | 'M' | 'R' | ''>('');
  const [editTackler, setEditTackler] = useState('');
  const [editTacklerNum, setEditTacklerNum] = useState('');
  const [editAssists, setEditAssists] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Yardage and Penalty cross-check details
  const [whistleSpot, setWhistleSpot] = useState('');
  const [nextPlayLOS, setNextPlayLOS] = useState('');
  const [spotAligned, setSpotAligned] = useState<boolean>(true);
  const [penaltyDetected, setPenaltyDetected] = useState<boolean>(false);
  const [penaltyDetails, setPenaltyDetails] = useState<string>('');
  const [penaltyYards, setPenaltyYards] = useState<number>(0);
  const [penaltyOn, setPenaltyOn] = useState<'Offense' | 'Defense' | 'None'>('None');

  // Load game context from localStorage on open or gameId change
  useEffect(() => {
    if (!isOpen) return;

    setApiKey(getSavedGeminiKey());
    setModel(getSavedGeminiModel());

    const storageKey = `football_film_context_${gameId || 'default'}`;
    let loaded = false;
    try {
      const savedStr = localStorage.getItem(storageKey);
      if (savedStr) {
        const saved: StoredGameContext = JSON.parse(savedStr);
        setGameType(saved.gameType);
        setOffenseTeam(saved.offenseTeam);
        setDefenseTeam(saved.defenseTeam);
        setOffenseColor(saved.offenseColor || 'Dark');
        setDefenseColor(saved.defenseColor || 'White');
        setLinkOurRoster(saved.gameType === 'scout_game' ? false : saved.linkOurRoster);
        loaded = true;
      }
    } catch {
      /* ignore */
    }

    if (!loaded) {
      const initialType = isOwnGame === false ? 'scout_game' : 'our_game';
      setGameType(initialType);
      if (initialType === 'scout_game') {
        setOffenseTeam(opponentName || 'Opponent Offense');
        setDefenseTeam('Opponent Defense');
        setLinkOurRoster(false); // Never link roster for scout games
      } else {
        if (play?.odk === 'D') {
          setOffenseTeam(opponentName || 'Opponent');
          setDefenseTeam(teamName || 'Mahopac 10U');
        } else {
          setOffenseTeam(teamName || 'Mahopac 10U');
          setDefenseTeam(opponentName || 'Opponent');
        }
        setLinkOurRoster(true);
      }
    }
  }, [isOpen, gameId, isOwnGame, teamName, opponentName, play?.odk]);

  // Persist game context helper
  const saveContextToStorage = (updates: Partial<StoredGameContext>) => {
    const nextContext: StoredGameContext = {
      gameType: updates.gameType ?? gameType,
      offenseTeam: updates.offenseTeam ?? offenseTeam,
      defenseTeam: updates.defenseTeam ?? defenseTeam,
      offenseColor: updates.offenseColor ?? offenseColor,
      defenseColor: updates.defenseColor ?? defenseColor,
      linkOurRoster: (updates.gameType ?? gameType) === 'scout_game' ? false : (updates.linkOurRoster ?? linkOurRoster),
    };
    try {
      localStorage.setItem(`football_film_context_${gameId || 'default'}`, JSON.stringify(nextContext));
    } catch {
      /* ignore */
    }
  };

  // Run analysis when modal opens on a new play
  useEffect(() => {
    if (isOpen && play) {
      handleAutoScan();
    } else if (!isOpen) {
      setResult(null);
      setFrames([]);
      setError('');
    }
  }, [isOpen, play?.id]);

  // Sync result to local editable state
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
      setEditPlayDir((result.playDir as 'L' | 'M' | 'R') || 'M');

      setEditCarrier(result.carrierName || (result.carrierNum ? `#${result.carrierNum}` : ''));
      setEditCarrierNum(result.carrierNum || '');

      setEditTackler(result.tacklerNames?.[0] || (result.tacklerNums?.[0] ? `#${result.tacklerNums[0]}` : ''));
      setEditTacklerNum(result.tacklerNums?.[0] || '');

      const assistList = (result.tacklerNames && result.tacklerNames.length > 1)
        ? result.tacklerNames.slice(1).join(', ')
        : (result.tacklerNums && result.tacklerNums.length > 1)
        ? `#${result.tacklerNums.slice(1).join(', #')}`
        : '';
      setEditAssists(assistList);

      setEditNotes(result.coachingNotes);

      // Yardage & Penalty Check sync
      setWhistleSpot(result.whistleYardLine || '');
      setNextPlayLOS(result.nextPlayYardLine || '');
      setSpotAligned(result.spotAligned ?? true);
      setPenaltyDetected(result.penaltyDetected ?? false);
      setPenaltyDetails(result.penaltyDetails || '');
      setPenaltyYards(result.penaltyYards ?? 0);
      setPenaltyOn(result.penaltyOn || 'None');
    }
  }, [result]);

  const handleSwapPossession = () => {
    const newOff = defenseTeam;
    const newDef = offenseTeam;
    const newOffCol = defenseColor;
    const newDefCol = offenseColor;
    setOffenseTeam(newOff);
    setDefenseTeam(newDef);
    setOffenseColor(newOffCol);
    setDefenseColor(newDefCol);

    // Swap ODK if our game
    const nextOdk: 'O' | 'D' = editOdk === 'O' ? 'D' : 'O';
    setEditOdk(nextOdk);

    saveContextToStorage({
      offenseTeam: newOff,
      defenseTeam: newDef,
      offenseColor: newOffCol,
      defenseColor: newDefCol,
    });
  };

  const handleToggleGameType = (newType: 'our_game' | 'scout_game') => {
    setGameType(newType);
    const newLink = newType === 'our_game';
    setLinkOurRoster(newLink);

    saveContextToStorage({
      gameType: newType,
      linkOurRoster: newLink,
    });
  };

  const nextPlayStartYard = nextPlay?.rawYardLine || (nextPlay?.yardLine ? `${nextPlay.yardLineSide === 'OPP' ? '+' : '-'}${nextPlay.yardLine}` : undefined);

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
        extracted = [
          { timestamp: 0.5, label: 'Pre-Snap Alignment', dataUrl: '' },
          { timestamp: 1.5, label: 'Snap & Mesh Point', dataUrl: '' },
          { timestamp: 2.5, label: 'Point of Attack', dataUrl: '' },
          { timestamp: 4.0, label: 'Tackle / Whistle', dataUrl: '' },
        ];
        setFrames(extracted);
      }

      setScanStep('Analyzing play, ball carrier & yardage cross-check with Gemini AI...');

      const ourUnitRole: 'offense' | 'defense' | 'none' =
        gameType === 'scout_game'
          ? 'none'
          : offenseTeam.toLowerCase().includes((teamName || 'mahopac').toLowerCase())
          ? 'offense'
          : defenseTeam.toLowerCase().includes((teamName || 'mahopac').toLowerCase())
          ? 'defense'
          : 'none';

      const res = await analyzeFilmWithGemini({
        frames: extracted.filter((f) => f.dataUrl),
        play,
        roster,
        knownFormations,
        knownPlays,
        opponentName: defenseTeam || opponentName,
        userPrompt: coachPrompt,
        apiKey,
        modelName: model,
        onStatusUpdate: (msg) => setScanStep(msg),
        gameType,
        ourTeamName: teamName || 'Mahopac 10U',
        offenseTeam,
        defenseTeam,
        offenseJerseyColor: offenseColor,
        defenseJerseyColor: defenseColor,
        linkOurRoster: gameType === 'our_game' ? linkOurRoster : false,
        ourUnitRole,
        nextPlayStartYard,
        nextPlayOdk: nextPlay?.odk,
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

  const handleLocalSimulate = () => {
    setError('');
    const res = simulateLocalAiBreakdown(frames, play, roster, knownFormations, knownPlays, {
      gameType,
      offenseTeam,
      defenseTeam,
      linkOurRoster: gameType === 'our_game' ? linkOurRoster : false,
      nextPlayStartYard,
      nextPlayOdk: nextPlay?.odk,
    });
    setResult(res);
  };

  const handleSaveKey = () => {
    saveGeminiKey(apiKey);
    saveGeminiModel(model);
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 3000);
  };

  // Recalculate yardage if whistle spot or next play is edited
  const handleRecalculateYardage = (newWhistle?: string) => {
    const wSpot = newWhistle !== undefined ? newWhistle : whistleSpot;
    const startSpot = editYard || play?.rawYardLine || '-35';
    const check = crossCheckPlayYardage({
      currentStartYard: startSpot,
      currentWhistleYard: wSpot,
      nextStartYard: nextPlayStartYard,
      currentOdk: editOdk,
      nextOdk: nextPlay?.odk,
    });

    setEditGain(check.measuredGain);
    setWhistleSpot(check.whistleFormatted);
    setNextPlayLOS(check.nextStartFormatted || '');
    setSpotAligned(check.isAligned);
    setPenaltyDetected(check.penaltySuspected);
    setPenaltyDetails(check.penaltySuggestion || '');
    setPenaltyYards(check.penaltyYards || 0);
    setPenaltyOn(check.penaltyOn || 'None');
  };

  const handleApplyPenaltyPreset = (pen: typeof COMMON_PENALTIES[0]) => {
    setPenaltyDetected(true);
    setPenaltyDetails(`${pen.label} (${pen.yards > 0 ? '+' : ''}${pen.yards} yds)`);
    setPenaltyYards(pen.yards);
    setPenaltyOn(pen.on);
    // Adjust editGain by penalty yards if appropriate
    setEditGain((prev) => prev + pen.yards);
  };

  const handleClearPenalty = () => {
    setPenaltyDetected(false);
    setPenaltyDetails('');
    setPenaltyYards(0);
    setPenaltyOn('None');
    setSpotAligned(true);
    // Reset to measured whistle gain
    const startSpot = editYard || play?.rawYardLine || '-35';
    const check = crossCheckPlayYardage({
      currentStartYard: startSpot,
      currentWhistleYard: whistleSpot,
      currentOdk: editOdk,
    });
    setEditGain(check.measuredGain);
  };

  const getFinalPayload = () => {
    if (!result) return null;

    // Build tackler list
    const tacklerNames: string[] = [];
    const tacklerNums: string[] = [];
    if (editTackler.trim()) {
      tacklerNames.push(editTackler.trim());
      const numMatch = editTackler.match(/#(\d+)/);
      if (numMatch) tacklerNums.push(numMatch[1]);
      else if (editTacklerNum) tacklerNums.push(editTacklerNum);
    }
    if (editAssists.trim()) {
      const parts = editAssists.split(',').map((s) => s.trim()).filter(Boolean);
      parts.forEach((p) => {
        tacklerNames.push(p);
        const match = p.match(/#(\d+)/);
        if (match) tacklerNums.push(match[1]);
      });
    }

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
      playDir: editPlayDir || result.playDir,
      carrierNum: editCarrierNum || result.carrierNum,
      carrierName: editCarrier || result.carrierName,
      tacklerNums: tacklerNums.length ? tacklerNums : result.tacklerNums,
      tacklerNames: tacklerNames.length ? tacklerNames : result.tacklerNames,
      whistleYardLine: whistleSpot || result.whistleYardLine,
      nextPlayYardLine: nextPlayLOS || result.nextPlayYardLine,
      spotAligned,
      penaltyDetected,
      penaltyDetails,
      penaltyYards,
      penaltyOn,
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

  // Helper to pick player from roster
  const handleSelectRosterCarrier = (p: RosterPlayer) => {
    setEditCarrier(`#${p.num} ${p.firstName} ${p.lastName}`);
    setEditCarrierNum(p.num);
  };

  const handleSelectRosterTackler = (p: RosterPlayer) => {
    setEditTackler(`#${p.num} ${p.firstName} ${p.lastName}`);
    setEditTacklerNum(p.num);
  };

  if (!isOpen) return null;

  const isOurGame = gameType === 'our_game';
  const isOurOffense = isOurGame && offenseTeam.toLowerCase().includes((teamName || 'mahopac').toLowerCase());
  const isOurDefense = isOurGame && defenseTeam.toLowerCase().includes((teamName || 'mahopac').toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">AI Film Clip Breakdown</h3>
                {play && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-black">
                    Play #{play.playNumber}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${
                    isOurGame
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  }`}
                >
                  {isOurGame ? '🏈 Our Game' : '🔍 Scout Film'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ball carrier rush tracking · Yardage &amp; next-play alignment · Tackler attribution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowGameSetup(!showGameSetup)}
              aria-label="Game Setup & Teams"
              title="Game Setup (Teams, Scout vs Our Game)"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer ${
                showGameSetup
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Teams &amp; Scout <ChevronDown className="w-3.5 h-3.5" />
            </button>
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Game Context Strip / Setup Panel */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => handleToggleGameType('our_game')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    isOurGame
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  🏈 Our Game
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleGameType('scout_game')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    !isOurGame
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  🔍 Scout Game
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-slate-400">Offense:</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400">{offenseTeam}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold">
                    {offenseColor}
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-bold text-slate-400">Defense:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{defenseTeam}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold">
                    {defenseColor}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSwapPossession}
                  title="Swap possession between teams"
                  className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  ⇄ Swap
                </button>
              </div>
            </div>

            {/* Expanded Game Setup Details */}
            {showGameSetup && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Offense Team
                  </label>
                  <input
                    value={offenseTeam}
                    onChange={(e) => {
                      setOffenseTeam(e.target.value);
                      saveContextToStorage({ offenseTeam: e.target.value });
                    }}
                    placeholder="e.g. Mahopac 10U"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Offense Jersey Color
                  </label>
                  <input
                    value={offenseColor}
                    onChange={(e) => {
                      setOffenseColor(e.target.value);
                      saveContextToStorage({ offenseColor: e.target.value });
                    }}
                    placeholder="Dark, Blue, Gold..."
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Defense Team
                  </label>
                  <input
                    value={defenseTeam}
                    onChange={(e) => {
                      setDefenseTeam(e.target.value);
                      saveContextToStorage({ defenseTeam: e.target.value });
                    }}
                    placeholder="e.g. Somers 10U"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Defense Jersey Color
                  </label>
                  <input
                    value={defenseColor}
                    onChange={(e) => {
                      setDefenseColor(e.target.value);
                      saveContextToStorage({ defenseColor: e.target.value });
                    }}
                    placeholder="White, Light..."
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>

                <div className="col-span-full pt-1 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {isOurGame ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <UserCheck className="w-4 h-4" /> Roster Linking Active for Our Team
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                        <UserX className="w-4 h-4" /> Scout Game: Player Linking Strictly Disabled (Jersey #s Only)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGameSetup(false)}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    Done Configuring
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Settings Drawer */}
          {showSettings && (
            <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Gemini API Configuration
                </span>
                {keySavedToast && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Enter your free Google AI Studio Gemini API Key for live multimodal video inference.
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
                  <option value="gemini-flash-latest">Gemini 3.8 Flash (Recommended)</option>
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
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
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tracking rusher, whistle spot, and verifying against next play line of scrimmage
                </p>
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
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAutoScan}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry with Auto-Backoff
                  </button>
                  <button
                    type="button"
                    onClick={handleLocalSimulate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Use Instant Local Breakdown
                  </button>
                </div>
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
                <span>Click frame to inspect</span>
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

          {/* Analysis Results */}
          {result && !analyzing && (
            <div className="space-y-4">
              {/* PRIMARY TACTICAL FOCUS: Ball Carrier, Gains/Losses & Tackler */}
              <div className="rounded-3xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/30 dark:from-indigo-950/20 dark:via-slate-900 dark:to-violet-950/20 p-4 sm:p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                      <Zap className="w-3.5 h-3.5" /> Tactical Core Focus
                    </span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Who Ran the Ball · Net Yardage &amp; Next Play Cross-Check · Tackler
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {result.confidenceScore}% Confidence
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* CARD 1: WHO RAN THE BALL */}
                  <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-white/80 dark:bg-slate-900/80 shadow-xs flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-300 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" /> Who Ran The Ball
                        </span>
                        {editCarrierNum && (
                          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                            #{editCarrierNum}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                            Ball Carrier / Rusher
                          </label>
                          <input
                            value={editCarrier}
                            onChange={(e) => {
                              setEditCarrier(e.target.value);
                              const match = e.target.value.match(/#(\d+)/);
                              if (match) setEditCarrierNum(match[1]);
                            }}
                            placeholder={isOurOffense ? '#21 Nash Ward' : '#24 (Opponent)'}
                            className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-black text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* If Our Offense & Roster available, quick pick chips */}
                        {isOurOffense && roster.length > 0 && (
                          <div>
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                              Quick Match Mahopac Roster:
                            </span>
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                              {roster.slice(0, 8).map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectRosterCarrier(p)}
                                  className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                                >
                                  #{p.num} {p.lastName}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {!isOurGame && (
                          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <UserX className="w-3 h-3" /> Scout Film: Unlinked jersey number
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Run Direction */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="block text-[10px] font-bold text-slate-400 mb-1">Run Direction:</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(['L', 'M', 'R'] as const).map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            onClick={() => setEditPlayDir(dir)}
                            className={`py-1 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                              editPlayDir === dir
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {dir === 'L' ? 'Left' : dir === 'M' ? 'Middle' : 'Right'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: GAINS OR LOSSES & YARDAGE CROSS-CHECK */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Flag className="w-3.5 h-3.5" /> Gains / Losses &amp; Spot Check
                        </span>
                        <div
                          className={`px-3 py-1 rounded-xl text-base font-black shadow-xs ${
                            editGain > 0
                              ? 'bg-emerald-600 text-white'
                              : editGain < 0
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-600 text-white'
                          }`}
                        >
                          {editGain > 0 ? `+${editGain}` : editGain} YDS
                        </div>
                      </div>

                      {/* Snap LOS to Whistle Spot */}
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-500">Play Start LOS:</span>
                          <input
                            value={editYard}
                            onChange={(e) => {
                              setEditYard(e.target.value);
                              handleRecalculateYardage();
                            }}
                            className="w-16 h-6 px-1.5 text-center font-black rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-500">Whistle Spot:</span>
                          <input
                            value={whistleSpot}
                            onChange={(e) => {
                              setWhistleSpot(e.target.value);
                              handleRecalculateYardage(e.target.value);
                            }}
                            className="w-16 h-6 px-1.5 text-center font-black rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-500">Next Play LOS:</span>
                          <span className="font-black text-slate-800 dark:text-slate-200">
                            {nextPlayStartYard || 'N/A (End of series)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Spot Alignment / Penalty Check Status */}
                    <div>
                      {nextPlayStartYard ? (
                        spotAligned ? (
                          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>LOS Verified: Aligns with Next Play Start</span>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs space-y-1.5">
                            <div className="flex items-start gap-1.5 font-bold">
                              <Flag className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <span>Spot Discrepancy &amp; Penalty Detected!</span>
                            </div>
                            <p className="text-[10px] text-rose-700 dark:text-rose-300">
                              Whistle was at {whistleSpot}, but next play started at {nextPlayLOS}.
                              {penaltyDetails && ` Likely: ${penaltyDetails}`}
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleClearPenalty}
                                className="px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900/60 hover:bg-rose-300 text-[10px] font-bold cursor-pointer"
                              >
                                Ignore Penalty
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">
                          ℹ Next play not in clip queue; yardage calculated from whistle tackle.
                        </p>
                      )}

                      {/* Quick Penalty Flag Presets */}
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          Quick Penalty Presets:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {COMMON_PENALTIES.slice(0, 4).map((pen) => (
                            <button
                              key={pen.label}
                              type="button"
                              onClick={() => handleApplyPenaltyPreset(pen)}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[9px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              {pen.label} ({pen.yards > 0 ? '+' : ''}{pen.yards})
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: WHO MADE THE TACKLE */}
                  <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-white/80 dark:bg-slate-900/80 shadow-xs flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Who Made The Tackle
                        </span>
                        {editTacklerNum && (
                          <span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-xs">
                            #{editTacklerNum}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                            Primary Tackler
                          </label>
                          <input
                            value={editTackler}
                            onChange={(e) => {
                              setEditTackler(e.target.value);
                              const match = e.target.value.match(/#(\d+)/);
                              if (match) setEditTacklerNum(match[1]);
                            }}
                            placeholder={isOurDefense ? '#52 Jaxson Pestone' : '#52 (Opponent)'}
                            className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-black text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                            Assist Tackler(s)
                          </label>
                          <input
                            value={editAssists}
                            onChange={(e) => setEditAssists(e.target.value)}
                            placeholder="#99, #12"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* If Our Defense & Roster available, quick pick chips */}
                        {isOurDefense && roster.length > 0 && (
                          <div>
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                              Quick Match Defense Roster:
                            </span>
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                              {roster.slice(0, 8).map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectRosterTackler(p)}
                                  className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                                >
                                  #{p.num} {p.lastName}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {!isOurGame && (
                          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <UserX className="w-3 h-3" /> Scout Film: Unlinked jersey number
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-400 text-[11px]">Defensive Front:</span>
                        <span className="font-black text-slate-800 dark:text-slate-200">
                          {result.defensiveFront || '4-4 Stack'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECONDARY TACTICAL SCHEME: Formation, Concept & Down/Distance */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 space-y-3">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400">
                  <span>Formation, Play Call &amp; Situation</span>
                  <span>Down &amp; Distance</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Down &amp; Dist</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <input
                        type="number"
                        value={editDown}
                        onChange={(e) => setEditDown(Number(e.target.value))}
                        className="w-10 text-sm font-black bg-transparent outline-none"
                      />
                      <span className="text-xs text-slate-400">&amp;</span>
                      <input
                        type="number"
                        value={editDist}
                        onChange={(e) => setEditDist(Number(e.target.value))}
                        className="w-12 text-sm font-black bg-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Play Result</span>
                    <input
                      value={editResult}
                      onChange={(e) => setEditResult(e.target.value)}
                      className="w-full text-sm font-bold text-slate-900 dark:text-white bg-transparent outline-none mt-0.5"
                    />
                  </div>
                </div>

                {/* AI Coaching Breakdown Notes */}
                <div className="pt-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Edit3 className="w-3 h-3" /> AI Coaching Point / Tactical Note
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60">
          <button
            type="button"
            disabled={analyzing}
            onClick={handleAutoScan}
            className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" /> Re-Analyze Clip
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
              <Check className="w-4 h-4" /> Apply to Play #{play?.playNumber}
            </button>
            {onApplyAndNext && hasNextPlay && (
              <button
                type="button"
                disabled={!result || analyzing}
                onClick={handleApplyAndNextClick}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-md shadow-indigo-500/20"
              >
                Apply &amp; Next Play <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
