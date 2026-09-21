import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Plus,
  Sparkles,
  Star,
  Check,
  CheckSquare,
  Zap,
  Trash2,
  Tag,
  BookOpen,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import { CallSheetPlay, PlayDatabaseEntry, PlayType } from '../../types/callSheet';
import { WristbandData } from '../../types';
import {
  extractPersonnel,
  getPersonnelSubTabs,
  buildWristbandIndex,
  lookupWristbandPlay,
  isDarkColor,
} from '../../utils/wristbandLinking';
import { safeJSONParse } from '../../services/storageService';
import { INITIAL_TWO_WRISTBANDS_DATA } from '../../data/userGameDayPlays';

interface PlayPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionTitle: string;
  unit: 'offense' | 'defense';
  slotIndex: number;
  currentPlay: CallSheetPlay | null;
  databasePlays: PlayDatabaseEntry[];
  wristbandData?: WristbandData;
  onSelectPlay: (play: CallSheetPlay) => void;
  onSelectMultiplePlays?: (plays: CallSheetPlay[]) => void;
  onClearSlot: () => void;
  onAddCustomToDatabase?: (entry: PlayDatabaseEntry) => void;
  onDeleteFromDatabase?: (playId: string) => void;
  onOpenExcelImport?: () => void;
  initialMultiSelect?: boolean;
}

const PLAY_TYPE_COLORS: Record<PlayType, { bg: string; text: string; border: string }> = {
  run: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  pass: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/40' },
  play_action: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/40' },
  screen: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/40' },
  rpo: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/40' },
  trick: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', border: 'border-fuchsia-500/40' },
  two_point: { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/40' },
  blitz: { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/40' },
  coverage: { bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/40' },
  goal_line: { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/40' },
};

export const PlayPickerModal: React.FC<PlayPickerModalProps> = ({
  isOpen,
  onClose,
  sectionTitle,
  unit,
  slotIndex,
  currentPlay,
  databasePlays,
  wristbandData,
  onSelectPlay,
  onSelectMultiplePlays,
  onClearSlot,
  onAddCustomToDatabase,
  onDeleteFromDatabase,
  onOpenExcelImport,
  initialMultiSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>('all');
  const [filterSituationOnly, setFilterSituationOnly] = useState(true);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isMultiSelect, setIsMultiSelect] = useState<boolean>(
    initialMultiSelect ?? Boolean(onSelectMultiplePlays)
  );
  const [selectedQueue, setSelectedQueue] = useState<PlayDatabaseEntry[]>([]);

  // Derive live wristband index so plays only show color if they have a spot on the wristband
  const effectiveWristbandData = useMemo(() => {
    if (wristbandData && wristbandData.wristbands && wristbandData.wristbands.length > 0) {
      return wristbandData;
    }
    const saved = safeJSONParse<WristbandData | null>('footballWristbandData', null);
    if (saved && saved.wristbands && saved.wristbands.length > 0) {
      return saved;
    }
    return INITIAL_TWO_WRISTBANDS_DATA;
  }, [wristbandData]);

  const wristbandIndex = useMemo(() => {
    return buildWristbandIndex(effectiveWristbandData);
  }, [effectiveWristbandData]);

  const personnelTabs = useMemo(() => {
    return getPersonnelSubTabs(databasePlays, unit);
  }, [databasePlays, unit]);

  // Custom play form state
  const [customName, setCustomName] = useState('');
  const [customFormation, setCustomFormation] = useState(unit === 'offense' ? 'I-Right' : '4-3 Base');
  const [customType, setCustomType] = useState<PlayType>(unit === 'offense' ? 'run' : 'coverage');
  const [customPersonnel, setCustomPersonnel] = useState('');
  const [customWristbandNum, setCustomWristbandNum] = useState<string>('');
  const [customConcept, setCustomConcept] = useState('');

  // Extract clean keywords from section title for smart matching
  const situationKeywords = useMemo(() => {
    const titleLower = sectionTitle.toLowerCase();
    const keywords: string[] = [];
    if (titleLower.includes('1-10')) keywords.push('1-10');
    if (titleLower.includes('2nd long')) keywords.push('2nd long');
    if (titleLower.includes('2nd med')) keywords.push('2nd med');
    if (titleLower.includes('2nd & short') || titleLower.includes('shot')) keywords.push('2nd & short (SHOT)', '2nd & short');
    if (titleLower.includes('3rd long')) keywords.push('3rd long');
    if (titleLower.includes('3rd med')) keywords.push('3rd med');
    if (titleLower.includes('3rd short')) keywords.push('3rd short');
    if (titleLower.includes('3rd & 1')) keywords.push('3rd & 1');
    if (titleLower.includes('4th & 1')) keywords.push('4th & 1');
    if (titleLower.includes('backed up') || titleLower.includes('inside 5')) keywords.push('Backed Up (inside 5)', 'Backed Up');
    if (titleLower.includes('tricks') || titleLower.includes('blitz')) keywords.push('TRICKS', 'EXOTIC BLITZES');
    if (titleLower.includes('red zone') || titleLower.includes('rz')) keywords.push('RED ZONE', 'RED ZONE DEFENSE');
    if (titleLower.includes('2 pt') || titleLower.includes('2 point')) keywords.push('2 pt Special', '2 pt Defense');
    if (titleLower.includes('goaline') || titleLower.includes('goal line')) keywords.push('Goaline Pass', 'Goal Line Stand', 'Goal Line');
    if (titleLower.includes('2 min')) keywords.push('2 MIN O', '2 MIN D (Deny Sideline)');
    if (titleLower.includes('4 min')) keywords.push('4 Min O', '4 Min D (Strip Ball)');
    if (titleLower.includes('run clock') || titleLower.includes('prevent')) keywords.push('RUN CLOCK', 'PREVENT / HAIL MARY');
    return keywords;
  }, [sectionTitle]);

  // Filtered plays
  const filteredPlays = useMemo(() => {
    return databasePlays.filter((p) => {
      // Must match unit
      if (p.unit !== unit) return false;

      // Filter by type
      if (selectedType !== 'all' && p.type !== selectedType) return false;

      // Filter by personnel grouping
      if (selectedPersonnel !== 'all') {
        const pkg = extractPersonnel(p);
        if (pkg !== selectedPersonnel) return false;
      }

      // Filter by situation tag if toggle is on and keywords exist
      if (filterSituationOnly && situationKeywords.length > 0) {
        const matchesSituation = p.situations.some((sit) =>
          situationKeywords.some((kw) => sit.toLowerCase().includes(kw.toLowerCase()))
        );
        if (!matchesSituation) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesFormation = p.formation.toLowerCase().includes(term);
        const matchesConcept = (p.concept || '').toLowerCase().includes(term);
        const matchesTags = (p.tags || []).some((t) => t.toLowerCase().includes(term));
        const match = lookupWristbandPlay(p.name, wristbandIndex);
        const matchesWristband = match
          ? `#${match.slotLabel}`.includes(term)
          : p.wristbandNum
          ? `#${p.wristbandNum}`.includes(term)
          : false;
        if (!matchesName && !matchesFormation && !matchesConcept && !matchesTags && !matchesWristband) {
          return false;
        }
      }

      return true;
    });
  }, [databasePlays, unit, selectedType, selectedPersonnel, filterSituationOnly, situationKeywords, searchTerm, wristbandIndex]);

  if (!isOpen) return null;

  const dbPlayToCallSheetPlay = (dbPlay: PlayDatabaseEntry): CallSheetPlay => {
    const match = lookupWristbandPlay(dbPlay.name, wristbandIndex);
    return {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: dbPlay.name,
      formation: dbPlay.formation,
      type: dbPlay.type,
      wristbandNum: match ? match.wristbandNum : dbPlay.wristbandNum,
      wristbandLabel: match ? match.slotLabel : (dbPlay.wristbandLabel || (dbPlay.wristbandNum ? String(dbPlay.wristbandNum) : undefined)),
      wristbandColor: match ? match.numberBgColor : undefined,
      wristbandNumberColor: match ? match.numberBgColor : undefined,
      wristbandRowColor: match ? match.rowBgColor : undefined,
      wristbandHighlightTarget: match ? match.highlightTarget : undefined,
      wristbandTitle: match ? match.wristbandTitle : undefined,
      wristbandSlotMatch: match
        ? {
            wristbandId: match.wristbandId,
            wristbandTitle: match.wristbandTitle,
            cardLabel: match.wristbandShort,
            slotNumber: match.slotLabel,
            numberBgColor: match.numberBgColor,
            rowHighlightColor: match.rowBgColor,
            highlightTarget: match.highlightTarget,
          }
        : undefined,
      personnel: dbPlay.personnel || extractPersonnel(dbPlay),
      notes: dbPlay.concept,
    };
  };

  const handlePick = (dbPlay: PlayDatabaseEntry) => {
    const playItem = dbPlayToCallSheetPlay(dbPlay);
    onSelectPlay(playItem);
    onClose();
  };

  const handleTogglePlayInQueue = (play: PlayDatabaseEntry) => {
    setSelectedQueue((prev) => {
      const idx = prev.findIndex((p) => p.id === play.id);
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      } else {
        return [...prev, play];
      }
    });
  };

  const handleConfirmMultiple = () => {
    if (selectedQueue.length === 0) return;
    const converted = selectedQueue.map(dbPlayToCallSheetPlay);
    if (onSelectMultiplePlays) {
      onSelectMultiplePlays(converted);
    } else if (onSelectPlay && converted[0]) {
      onSelectPlay(converted[0]);
    }
    setSelectedQueue([]);
    onClose();
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newPlay: CallSheetPlay = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      formation: customFormation.trim(),
      type: customType,
      wristbandNum: customWristbandNum ? parseInt(customWristbandNum, 10) : undefined,
      personnel: customPersonnel.trim() || undefined,
      notes: customConcept.trim() || undefined,
    };

    // Also persist to database if callback available
    if (onAddCustomToDatabase) {
      const dbEntry: PlayDatabaseEntry = {
        id: `db_custom_${Date.now()}`,
        name: customName.trim(),
        unit,
        formation: customFormation.trim(),
        type: customType,
        situations: situationKeywords.length > 0 ? situationKeywords : [sectionTitle],
        personnel: customPersonnel.trim() || undefined,
        wristbandNum: customWristbandNum ? parseInt(customWristbandNum, 10) : undefined,
        concept: customConcept.trim() || undefined,
        tags: ['Custom', customType],
      };
      onAddCustomToDatabase(dbEntry);
    }

    onSelectPlay(newPlay);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${unit === 'offense' ? 'bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/30'}`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {isMultiSelect ? 'Select Multiple Plays in Order' : `Pick Play for Slot ${slotIndex + 1}`}
                </h2>
                <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  {sectionTitle}
                </span>
                {isMultiSelect && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40">
                    Starting at Slot {slotIndex + 1}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isMultiSelect
                  ? 'Click plays in the order you want them on the wristband (1, 2, 3...).'
                  : 'Select a recommended play from your database or write in a custom call.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Play Info Bar (if one is already assigned) */}
        {currentPlay && !isCreatingCustom && (
          <div className="px-5 py-2.5 bg-slate-100/80 dark:bg-slate-850/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-500 dark:text-slate-400">Current Slot:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{currentPlay.name}</span>
              {currentPlay.formation && (
                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono">
                  {currentPlay.formation}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                onClearSlot();
                onClose();
              }}
              className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Slot</span>
            </button>
          </div>
        )}

        {/* Action Toggle (Browse Database vs Create Custom vs Multi-Select) */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-300 dark:border-slate-700/60 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCreatingCustom(false)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isCreatingCustom
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              📚 Play Database ({filteredPlays.length})
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingCustom(true)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isCreatingCustom
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Write Custom Play</span>
            </button>
            {onSelectMultiplePlays && (
              <button
                type="button"
                onClick={() => {
                  setIsMultiSelect(!isMultiSelect);
                  setSelectedQueue([]);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isMultiSelect
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Click multiple plays to place them in order"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{isMultiSelect ? 'Multi-Select (In Order) ON' : 'Multi-Select Mode'}</span>
              </button>
            )}
            {onOpenExcelImport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExcelImport();
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-500/40 transition-colors cursor-pointer flex items-center gap-1"
                title="Import list of plays from Excel (.xlsx, .csv)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Import Excel</span>
              </button>
            )}
          </div>

          {!isCreatingCustom && situationKeywords.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterSituationOnly(!filterSituationOnly)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                filterSituationOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                  : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>{filterSituationOnly ? `Matching "${sectionTitle}"` : 'Show All Situations'}</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        {!isCreatingCustom ? (
          <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-5 space-y-3">
            {/* Search and Play Type Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Search ${unit} plays by name, formation, concept, or tag...`}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Type pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedType('all')}
                  className={`px-2.5 py-0.5 rounded-lg font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedType === 'all'
                      ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-transparent'
                  }`}
                >
                  All Types
                </button>
                {(unit === 'offense'
                  ? ['run', 'pass', 'play_action', 'screen', 'rpo', 'trick', 'two_point']
                  : ['coverage', 'blitz', 'goal_line', 'run']
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedType(t)}
                    className={`px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer transition-colors ${
                      selectedType === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Personnel Sub-tabs Breakdown */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[10.5px] pt-0.5 border-t border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Personnel:
                </span>
                {personnelTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedPersonnel(tab.id)}
                    className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedPersonnel === tab.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {tab.id === 'all' ? 'All' : tab.label.replace(' Personnel', ' Pers')} ({tab.count})
                  </button>
                ))}
              </div>
            </div>

            {/* List of matching plays */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar min-h-[220px]">
              {filteredPlays.map((play) => {
                const style = PLAY_TYPE_COLORS[play.type] || PLAY_TYPE_COLORS.run;
                const queueIdx = selectedQueue.findIndex((p) => p.id === play.id);
                const isSelectedInQueue = queueIdx >= 0;
                const orderNum = queueIdx + 1;

                return (
                  <div
                    key={play.id}
                    onClick={() => {
                      if (isMultiSelect) {
                        handleTogglePlayInQueue(play);
                      } else {
                        handlePick(play);
                      }
                    }}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-start justify-between gap-3 group active:scale-[0.99] border ${
                      isSelectedInQueue
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50 shadow-md'
                        : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-indigo-500/60 border-slate-200 dark:border-slate-700/70 shadow-xs'
                    }`}
                  >
                    {isMultiSelect && (
                      <div className="shrink-0 pt-0.5">
                        {isSelectedInQueue ? (
                          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md ring-2 ring-indigo-400 font-mono">
                            {orderNum}
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800/90 text-slate-500 border border-slate-300 dark:border-slate-700 group-hover:border-indigo-500/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-xs flex items-center justify-center font-bold">
                            +
                          </span>
                        )}
                      </div>
                    )}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const match = lookupWristbandPlay(play.name, wristbandIndex);
                          if (match) {
                            const bg = match.numberBgColor || '#facc15';
                            const fg = isDarkColor(bg) ? '#ffffff' : '#000000';
                            return (
                              <span
                                style={{
                                  backgroundColor: bg,
                                  color: fg,
                                }}
                                className="px-1.5 py-0.5 rounded-md font-black text-[10px] font-mono shadow-xs border border-black/20"
                                title={`${match.wristbandTitle} • Slot ${match.slotLabel}`}
                              >
                                {match.slotLabel}
                              </span>
                            );
                          }

                          if (play.wristbandNum) {
                            return (
                              <span
                                className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-transparent border border-slate-300 dark:border-slate-700/70"
                                title="No spot on active wristband"
                              >
                                {play.wristbandNum}
                              </span>
                            );
                          }

                          return null;
                        })()}
                        <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-white truncate">
                          {play.name}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}>
                          {play.type.replace('_', ' ')}
                        </span>
                        {play.formation && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {play.formation}
                          </span>
                        )}
                      </div>

                      {play.concept && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {play.concept}
                        </p>
                      )}

                      {/* Situations tags */}
                      {play.situations && play.situations.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {play.situations.slice(0, 4).map((sit, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-750"
                            >
                              {sit}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onDeleteFromDatabase && (
                        confirmingDeleteId === play.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFromDatabase(play.id);
                                setConfirmingDeleteId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition-colors cursor-pointer"
                              title="Confirm delete"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmingDeleteId(null);
                              }}
                              className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingDeleteId(play.id);
                            }}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title={`Delete "${play.name}" from play bank`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                      {isMultiSelect ? (
                        <div className="flex items-center gap-1">
                          {isSelectedInQueue ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePlayInQueue(play);
                              }}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{orderNum}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePlayInQueue(play);
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 hover:border-indigo-500 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Select</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePick(play);
                            }}
                            className="px-2 py-1.5 rounded-xl text-slate-400 hover:text-indigo-200 hover:bg-slate-800 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Assign this play only right now"
                          >
                            Assign
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md transition-all group-hover:scale-105"
                        >
                          Assign
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredPlays.length === 0 && (
                <div className="text-center py-12 space-y-3 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-300">No matching plays found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {filterSituationOnly
                        ? 'Try toggling "Show All Situations" above, or write a custom play for this situation.'
                        : 'Try adjusting your search filters or click "Write Custom Play".'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingCustom(true)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Custom Play Now</span>
                  </button>
                </div>
              )}
            </div>

            {isMultiSelect && (
              <div className="p-3 sm:p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 rounded-b-3xl">
                <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black font-mono">
                      {selectedQueue.length}
                    </span>
                    <span className="hidden sm:inline">
                      {selectedQueue.length === 1 ? 'Selected in Order:' : 'Selected in Order:'}
                    </span>
                  </span>
                  {selectedQueue.length === 0 ? (
                    <span className="text-xs text-slate-500 italic truncate">
                      Click plays in the list above to add them to your wristband in order
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full no-scrollbar">
                      {selectedQueue.map((item, idx) => (
                        <span
                          key={`${item.id}_${idx}`}
                          className="px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-500/50 text-indigo-900 dark:text-indigo-200 text-xs font-bold flex items-center gap-1.5 shrink-0"
                        >
                          <span className="text-amber-600 dark:text-amber-400 font-mono font-black">{idx + 1}</span>
                          <span className="max-w-[130px] truncate">{item.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQueue((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white ml-0.5 cursor-pointer text-sm font-bold"
                            title="Remove from queue"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 justify-end">
                  {selectedQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedQueue([])}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Clear Queue
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={selectedQueue.length === 0}
                    onClick={handleConfirmMultiple}
                    className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md ${
                      selectedQueue.length > 0
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer hover:scale-[1.02]'
                        : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {selectedQueue.length === 0
                        ? 'Click Plays to Add in Order'
                        : `Add ${selectedQueue.length} ${selectedQueue.length === 1 ? 'Play' : 'Plays'} in Order`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Custom Play Form */
          <form onSubmit={handleSaveCustom} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Play Call Name *</label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={unit === 'offense' ? 'e.g. 24 Dive Lead, Bootleg Flood Right...' : 'e.g. 4-3 Cover 3 Sky, Fire Zone Blitz...'}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Formation / Front</label>
                <input
                  type="text"
                  value={customFormation}
                  onChange={(e) => setCustomFormation(e.target.value)}
                  placeholder="e.g. I-Right, Gun Trips, 4-3 Over"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Play Type</label>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as PlayType)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 capitalize"
                >
                  {(unit === 'offense'
                    ? ['run', 'pass', 'play_action', 'screen', 'rpo', 'trick', 'two_point']
                    : ['coverage', 'blitz', 'goal_line', 'run']
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Wristband Slot (Optional)</label>
                <input
                  type="number"
                  value={customWristbandNum}
                  onChange={(e) => setCustomWristbandNum(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Personnel / Package</label>
              <input
                type="text"
                value={customPersonnel}
                onChange={(e) => setCustomPersonnel(e.target.value)}
                placeholder="e.g. 21 Personnel, Jumbo 22, Nickel 4-2-5"
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Coaching Notes / Scheme Concept</label>
              <textarea
                rows={2}
                value={customConcept}
                onChange={(e) => setCustomConcept(e.target.value)}
                placeholder="Key assignment, read progression, check against blitz..."
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreatingCustom(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Back to Database
              </button>
              {isMultiSelect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!customName.trim()) return;
                    const dbEntry: PlayDatabaseEntry = {
                      id: `db_custom_${Date.now()}`,
                      name: customName.trim(),
                      unit,
                      formation: customFormation.trim(),
                      type: customType,
                      situations: situationKeywords.length > 0 ? situationKeywords : [sectionTitle],
                      personnel: customPersonnel.trim() || undefined,
                      wristbandNum: customWristbandNum ? parseInt(customWristbandNum, 10) : undefined,
                      concept: customConcept.trim() || undefined,
                      tags: ['Custom', customType],
                    };
                    if (onAddCustomToDatabase) {
                      onAddCustomToDatabase(dbEntry);
                    }
                    setSelectedQueue((prev) => [...prev, dbEntry]);
                    setCustomName('');
                    setCustomFormation('');
                    setCustomPersonnel('');
                    setCustomConcept('');
                    setCustomWristbandNum('');
                    setIsCreatingCustom(false);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save & Add to Selection Queue</span>
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Play & Assign to Slot</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
