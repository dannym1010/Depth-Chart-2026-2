import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Edit3,
  Film,
  Flag,
  Key,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Target,
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
import { crossCheckPlayYardage } from '../services/yardageCalculator';

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
  team1: string;
  team2: string;
  team1Color: string;
  team2Color: string;
  scoutedTeam: string;
  offenseTeam: string;
  defenseTeam: string;
  linkOurRoster: boolean;
  hasConfirmed: boolean;
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
  // Modal View Mode: 'setup' (prior to analysis, ask teams & who we are scouting) vs 'breakdown' (results)
  const [viewMode, setViewMode] = useState<'setup' | 'breakdown'>('setup');
  const [hasConfirmedSetup, setHasConfirmedSetup] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<number>(0);
  const [result, setResult] = useState<AiFilmAnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [coachPrompt, setCoachPrompt] = useState<string>('');

  // Game & Matchup Context
  const [gameType, setGameType] = useState<'our_game' | 'scout_game'>(
    isOwnGame === false ? 'scout_game' : 'our_game'
  );
  const [team1, setTeam1] = useState<string>(isOwnGame ? teamName : opponentName);
  const [team2, setTeam2] = useState<string>(isOwnGame ? opponentName : 'Opponent');
  const [team1Color, setTeam1Color] = useState<string>('Dark');
  const [team2Color, setTeam2Color] = useState<string>('White');
  const [scoutedTeam, setScoutedTeam] = useState<string>(isOwnGame ? teamName : opponentName);
  const [offenseTeam, setOffenseTeam] = useState<string>(team1);
  const [defenseTeam, setDefenseTeam] = useState<string>(team2);
  const [linkOurRoster, setLinkOurRoster] = useState<boolean>(isOwnGame !== false);

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

  // Compute ODK dynamically based on who we are scouting:
  // If the scouted team is on Offense -> ODK = 'O'
  // If the scouted team is on Defense -> ODK = 'D'
  const isScoutedOnOffense = Boolean(
    scoutedTeam && offenseTeam && (
      offenseTeam.trim().toLowerCase() === scoutedTeam.trim().toLowerCase() ||
      offenseTeam.toLowerCase().includes(scoutedTeam.toLowerCase())
    )
  );
  const computedOdk: 'O' | 'D' = isScoutedOnOffense ? 'O' : 'D';

  // Load saved context on open
  useEffect(() => {
    if (!isOpen) {
      setViewMode('setup');
      setResult(null);
      setFrames([]);
      setError('');
      return;
    }

    setApiKey(getSavedGeminiKey());
    setModel(getSavedGeminiModel());

    const storageKey = `football_film_context_${gameId || 'default'}`;
    let loaded = false;
    try {
      const savedStr = localStorage.getItem(storageKey);
      if (savedStr) {
        const saved: StoredGameContext = JSON.parse(savedStr);
        setGameType(saved.gameType);
        setTeam1(saved.team1);
        setTeam2(saved.team2);
        setTeam1Color(saved.team1Color || 'Dark');
        setTeam2Color(saved.team2Color || 'White');
        setScoutedTeam(saved.scoutedTeam || saved.team1);
        setOffenseTeam(saved.offenseTeam || saved.team1);
        setDefenseTeam(saved.defenseTeam || saved.team2);
        setLinkOurRoster(saved.gameType === 'scout_game' ? false : saved.linkOurRoster);
        setHasConfirmedSetup(saved.hasConfirmed ?? true);
        if (saved.hasConfirmed) {
          setViewMode('breakdown');
        } else {
          setViewMode('setup');
        }
        loaded = true;
      }
    } catch {
      /* ignore */
    }

    if (!loaded) {
      const initialType = isOwnGame === false ? 'scout_game' : 'our_game';
      const t1 = initialType === 'our_game' ? (teamName || 'Mahopac 10U') : (opponentName || 'Team 1');
      const t2 = initialType === 'our_game' ? (opponentName || 'Opponent') : 'Opponent';
      setGameType(initialType);
      setTeam1(t1);
      setTeam2(t2);
      setScoutedTeam(initialType === 'our_game' ? t1 : t1);
      setOffenseTeam(t1);
      setDefenseTeam(t2);
      setLinkOurRoster(initialType === 'our_game');
      setHasConfirmedSetup(false);
      setViewMode('setup');
    }
  }, [isOpen, gameId, isOwnGame, teamName, opponentName]);

  // Persist game context helper
  const saveContextToStorage = (updates: Partial<StoredGameContext>) => {
    const nextContext: StoredGameContext = {
      gameType: updates.gameType ?? gameType,
      team1: updates.team1 ?? team1,
      team2: updates.team2 ?? team2,
      team1Color: updates.team1Color ?? team1Color,
      team2Color: updates.team2Color ?? team2Color,
      scoutedTeam: updates.scoutedTeam ?? scoutedTeam,
      offenseTeam: updates.offenseTeam ?? offenseTeam,
      defenseTeam: updates.defenseTeam ?? defenseTeam,
      linkOurRoster: (updates.gameType ?? gameType) === 'scout_game' ? false : (updates.linkOurRoster ?? linkOurRoster),
      hasConfirmed: updates.hasConfirmed ?? hasConfirmedSetup,
    };
    try {
      localStorage.setItem(`football_film_context_${gameId || 'default'}`, JSON.stringify(nextContext));
    } catch {
      /* ignore */
    }
  };

  // If already confirmed setup and play changes, auto-scan
  useEffect(() => {
    if (isOpen && play && hasConfirmedSetup && viewMode === 'breakdown') {
      handleAutoScan();
    }
  }, [isOpen, play?.id, hasConfirmedSetup]);

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

  const handleToggleOffenseTeam = (newOffense: string) => {
    const newDefense = newOffense === team1 ? team2 : team1;
    setOffenseTeam(newOffense);
    setDefenseTeam(newDefense);

    // Recompute ODK
    const isScoutedOff = Boolean(
      scoutedTeam && newOffense && (
        newOffense.trim().toLowerCase() === scoutedTeam.trim().toLowerCase() ||
        newOffense.toLowerCase().includes(scoutedTeam.toLowerCase())
      )
    );
    const newOdk: 'O' | 'D' = isScoutedOff ? 'O' : 'D';
    setEditOdk(newOdk);

    saveContextToStorage({
      offenseTeam: newOffense,
      defenseTeam: newDefense,
    });
  };

  const handleSwapPossession = () => {
    handleToggleOffenseTeam(defenseTeam);
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

  // User confirms setup screen and starts AI breakdown
  const handleStartBreakdownFromSetup = () => {
    setHasConfirmedSetup(true);
    saveContextToStorage({
      hasConfirmed: true,
      team1,
      team2,
      team1Color,
      team2Color,
      scoutedTeam,
      offenseTeam,
      defenseTeam,
      gameType,
      linkOurRoster: gameType === 'our_game' ? linkOurRoster : false,
    });
    setViewMode('breakdown');
    handleAutoScan();
  };

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

      setScanStep(`Analyzing clip for scout target: ${scoutedTeam}...`);

      const ourUnitRole: 'offense' | 'defense' | 'none' =
        gameType === 'scout_game'
          ? 'none'
          : offenseTeam.toLowerCase().includes((teamName || 'mahopac').toLowerCase())
          ? 'offense'
          : defenseTeam.toLowerCase().includes((teamName || 'mahopac').toLowerCase())
          ? 'defense'
          : 'none';

      const offCol = offenseTeam === team1 ? team1Color : team2Color;
      const defCol = defenseTeam === team1 ? team1Color : team2Color;

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
        scoutedTeam,
        offenseTeam,
        defenseTeam,
        offenseJerseyColor: offCol,
        defenseJerseyColor: defCol,
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
      scoutedTeam,
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
    setEditGain((prev) => prev + pen.yards);
  };

  const handleClearPenalty = () => {
    setPenaltyDetected(false);
    setPenaltyDetails('');
    setPenaltyYards(0);
    setPenaltyOn('None');
    setSpotAligned(true);
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
      scoutedTeam,
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
  const isScoutOffense = editOdk === 'O';

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
                Automatic team scouting, ODK assignment, and tactical run/tackle tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {viewMode === 'breakdown' && (
              <button
                type="button"
                onClick={() => setViewMode('setup')}
                title="Edit matchup, teams, and who you are scouting"
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Matchup Setup
              </button>
            )}
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

          {/* =========================================================================
              VIEW 1: PRE-BREAKDOWN SETUP SCREEN (PRIOR TO AUTO BREAKDOWN)
              Asks who each team is and who you are scouting to set ODK accurately!
             ========================================================================= */}
          {viewMode === 'setup' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 flex items-start gap-3">
                <Target className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Step 1: Matchup &amp; Scout Target Setup
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Tell the AI who each team is and <strong>who you are scouting</strong>. When the scouted team has the ball, ODK is tagged as <strong>O</strong>. When they are on defense, ODK is tagged as <strong>D</strong>.
                  </p>
                </div>
              </div>

              {/* 1. Game Type Toggle */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1. Game Context
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleGameType('our_game')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isOurGame
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs text-slate-900 dark:text-white">
                      <span>🏈 Our Game</span>
                      {isOurGame && <span className="text-[10px] text-indigo-600 dark:text-indigo-400">● Selected</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Our team ({teamName || 'Mahopac'}) vs opponent. Links our player roster when on the field.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleGameType('scout_game')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      !isOurGame
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/50 ring-2 ring-amber-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs text-slate-900 dark:text-white">
                      <span>🔍 Opponent Scout Film</span>
                      {!isOurGame && <span className="text-[10px] text-amber-600 dark:text-amber-400">● Selected</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Two opponent teams playing each other. Strictly keeps player names unlinked (jersey #s only).
                    </p>
                  </button>
                </div>
              </div>

              {/* 2. The Two Teams in This Film */}
              <div className="space-y-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  2. Who are the two teams in this film?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Team 1
                    </span>
                    <input
                      value={team1}
                      onChange={(e) => {
                        setTeam1(e.target.value);
                        if (scoutedTeam === team1) setScoutedTeam(e.target.value);
                        if (offenseTeam === team1) setOffenseTeam(e.target.value);
                        if (defenseTeam === team1) setDefenseTeam(e.target.value);
                      }}
                      placeholder="e.g. Mahopac 10U or Somers 10U"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-900 dark:text-white"
                    />
                    <input
                      value={team1Color}
                      onChange={(e) => setTeam1Color(e.target.value)}
                      placeholder="Jersey Color: Dark, Blue, Navy..."
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-bold"
                    />
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Team 2
                    </span>
                    <input
                      value={team2}
                      onChange={(e) => {
                        setTeam2(e.target.value);
                        if (scoutedTeam === team2) setScoutedTeam(e.target.value);
                        if (offenseTeam === team2) setOffenseTeam(e.target.value);
                        if (defenseTeam === team2) setDefenseTeam(e.target.value);
                      }}
                      placeholder="e.g. Carmel 10U or Yorktown 10U"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-slate-900 dark:text-white"
                    />
                    <input
                      value={team2Color}
                      onChange={(e) => setTeam2Color(e.target.value)}
                      placeholder="Jersey Color: White, Light, Red..."
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 3. WHO ARE YOU SCOUTING? (The primary user question!) */}
              <div className="p-4 rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 dark:from-indigo-950/20 dark:to-violet-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-indigo-600" /> 3. Who are you scouting in this film?
                  </label>
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                    Controls ODK (Off/Def) Tagging
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScoutedTeam(team1)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scoutedTeam === team1
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-400'
                    }`}
                  >
                    <span className="block text-[10px] font-black uppercase opacity-80">Scout Target</span>
                    <span className="block text-sm font-black truncate">{team1 || 'Team 1'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScoutedTeam(team2)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scoutedTeam === team2
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-400'
                    }`}
                  >
                    <span className="block text-[10px] font-black uppercase opacity-80">Scout Target</span>
                    <span className="block text-sm font-black truncate">{team2 || 'Team 2'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/50 text-xs space-y-1">
                  <div className="font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <span>Target: <strong>{scoutedTeam}</strong></span>
                  </div>
                  <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 list-disc list-inside">
                    <li>When <strong>{scoutedTeam}</strong> is on Offense ➔ ODK will be tagged as <strong>O</strong> (Offense)</li>
                    <li>When <strong>{scoutedTeam}</strong> is on Defense ➔ ODK will be tagged as <strong>D</strong> (Defense)</li>
                  </ul>
                </div>
              </div>

              {/* 4. Who has the ball (Offense) on this play? */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" /> 4. Who has the ball (Offense) on this snap?
                  </label>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Play #{play?.playNumber || 1}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleOffenseTeam(team1)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      offenseTeam === team1
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <span className="block text-[10px] font-black uppercase opacity-75">Offense (With Ball)</span>
                    <span className="block text-sm font-black truncate">{team1}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleOffenseTeam(team2)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      offenseTeam === team2
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <span className="block text-[10px] font-black uppercase opacity-75">Offense (With Ball)</span>
                    <span className="block text-sm font-black truncate">{team2}</span>
                  </button>
                </div>

                {/* Instant ODK Result Preview */}
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    isScoutedOnOffense
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                  }`}
                >
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-xs font-black shadow-xs">
                    ODK: {computedOdk}
                  </span>
                  <span>
                    {isScoutedOnOffense
                      ? `Scouted team (${scoutedTeam}) is on Offense ➔ ODK will be tagged as "O" (Offense tendencies)`
                      : `Scouted team (${scoutedTeam}) is on Defense ➔ ODK will be tagged as "D" (Defensive stops & front)`}
                  </span>
                </div>
              </div>

              {/* Start Breakdown Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartBreakdownFromSetup}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01]"
                >
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <span>Start AI Breakdown (ODK: {computedOdk})</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 2: BREAKDOWN RESULTS SCREEN
             ========================================================================= */}
          {viewMode === 'breakdown' && (
            <div className="space-y-4">
              {/* Matchup & ODK Sticky Bar */}
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1 shadow-xs">
                    <Target className="w-3.5 h-3.5" /> Scouting: {scoutedTeam}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                      editOdk === 'O'
                        ? 'bg-emerald-600 text-white'
                        : editOdk === 'D'
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    ODK: {editOdk === 'O' ? 'O (Offense)' : editOdk === 'D' ? 'D (Defense)' : 'K (Special Teams)'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-500">Offense:</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400">{offenseTeam}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-slate-500">Defense:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{defenseTeam}</span>
                  <button
                    type="button"
                    onClick={handleSwapPossession}
                    title="Swap possession between teams and re-tag ODK"
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer ml-1"
                  >
                    ⇄ Flip
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('setup')}
                    title="Change matchup or scouted team"
                    className="px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 text-[11px] font-bold cursor-pointer"
                  >
                    ✏ Setup
                  </button>
                </div>
              </div>

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
                      Tracking {isScoutOffense ? `${scoutedTeam} ball carrier & rush concept` : `${scoutedTeam} defensive front & tacklers`}
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
                        <RotateCcw className="w-3.5 h-3.5" /> Retry Analysis
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

              {/* Breakdown Results */}
              {result && !analyzing && (
                <div className="space-y-4">
                  {/* PRIMARY TACTICAL FOCUS CARDS */}
                  <div className="rounded-3xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/30 dark:from-indigo-950/20 dark:via-slate-900 dark:to-violet-950/20 p-4 sm:p-5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                          <Zap className="w-3.5 h-3.5" />
                          {isScoutOffense ? `Scouting ${scoutedTeam} · Offense (ODK: O)` : `Scouting ${scoutedTeam} · Defense (ODK: D)`}
                        </span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                          {isScoutOffense ? 'Who Ran The Ball · Net Gain · Tackler' : 'Opponent Rusher · Yards Allowed · Scout Tackler'}
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
                              <User className="w-3.5 h-3.5" />
                              {isScoutOffense ? `${scoutedTeam} Ball Carrier` : `Opponent Rusher (${offenseTeam})`}
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
                                placeholder={isOurOffense ? '#21 Nash Ward' : '#24'}
                                className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-black text-slate-900 dark:text-white"
                              />
                            </div>

                            {/* Roster quick pick chips only if our team on offense */}
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
                              <Flag className="w-3.5 h-3.5" />
                              {isScoutOffense ? `${scoutedTeam} Net Gain` : `Yards Allowed by ${scoutedTeam}`}
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
                              <Shield className="w-3.5 h-3.5" />
                              {isScoutOffense ? `Tackled by ${defenseTeam}` : `${scoutedTeam} Tackler (Who Made Tackle)`}
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
                                placeholder={isOurDefense ? '#52 Jaxson Pestone' : '#52'}
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

                            {/* Roster quick pick chips only if our team on defense */}
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

                  {/* SECONDARY TACTICAL SCHEME */}
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
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60">
          {viewMode === 'breakdown' ? (
            <>
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
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                Configure teams and who you are scouting before running the AI film scan.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
