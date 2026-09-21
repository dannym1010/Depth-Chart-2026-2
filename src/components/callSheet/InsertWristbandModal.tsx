import React, { useState, useMemo } from 'react';
import {
  X,
  Watch,
  Plus,
  RefreshCw,
  Check,
  Filter,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  CallSheetFullData,
  CallSheetSection,
  CallSheetPlay,
} from '../../types/callSheet';
import { WristbandData, SingleWristband } from '../../types';
import {
  createSectionFromWristband,
  syncCallSheetWithWristbands,
  extractPersonnel,
  normalizePlayName,
  getWristbandStartNumber,
} from '../../utils/wristbandLinking';

interface InsertWristbandModalProps {
  isOpen: boolean;
  onClose: () => void;
  wristbandData?: WristbandData;
  callSheetData: CallSheetFullData;
  unit: 'offense' | 'defense';
  onUpdateCallSheetData: (newData: CallSheetFullData) => void;
  onAddSection: (newSection: CallSheetSection) => void;
}

export const InsertWristbandModal: React.FC<InsertWristbandModalProps> = ({
  isOpen,
  onClose,
  wristbandData,
  callSheetData,
  unit,
  onUpdateCallSheetData,
  onAddSection,
}) => {
  const [activeTab, setActiveTab] = useState<'whole_section' | 'pick_plays' | 'auto_sync'>('whole_section');
  const wristbands = wristbandData?.wristbands || [];

  // Selected wristband for section creation
  const [selectedWbId, setSelectedWbId] = useState<string>(() => wristbands[0]?.id || 'wb_1');
  const [sectionGroup, setSectionGroup] = useState<CallSheetSection['group']>('custom');

  // Selected plays for individual insertion
  const [selectedPlayKeys, setSelectedPlayKeys] = useState<Record<string, boolean>>({});
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [filterPersonnel, setFilterPersonnel] = useState<string>('all');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Available sections in current call sheet for target insertion
  const targetSections = useMemo(() => {
    return unit === 'offense' ? callSheetData.offenseSections : callSheetData.defenseSections;
  }, [callSheetData, unit]);

  // Set default target section
  React.useEffect(() => {
    if (targetSections.length > 0 && !targetSectionId) {
      setTargetSectionId(targetSections[0].id);
    }
  }, [targetSections, targetSectionId]);

  // Flattened list of all plays on all wristbands
  const allWristbandPlays = useMemo(() => {
    const list: {
      key: string;
      wristbandId: string;
      wristbandTitle: string;
      wristbandShort: string;
      playText: string;
      slotLabel: string;
      wristbandNum: number;
      numberBgColor: string;
      rowBgColor?: string;
      highlightTarget: 'number_only' | 'full_row';
      personnel: string;
    }[] = [];

    wristbands.forEach((wb, wbIdx) => {
      const wbShort = `WB${wbIdx + 1}`;
      const rows = wb.rowsCount || 13;
      const highlightTarget = wb.highlightTarget || 'number_only';

      (wb.columns || []).forEach((col, cIdx) => {
        (col.plays || []).forEach((p, rIdx) => {
          if (!p.text || !p.text.trim()) return;

          const wbStart = getWristbandStartNumber(wristbands, wbIdx);
          let slotLabel = `${rIdx + 1}`;
          let wbNum = wbStart + cIdx * rows + rIdx;
          if (p.customLabel && isNaN(Number(p.customLabel))) {
            slotLabel = p.customLabel;
          } else if (wb.labelingMode === 'same_per_card') {
            wbNum = cIdx * rows + rIdx + 1;
            slotLabel = String(wbNum);
          } else {
            slotLabel = String(wbNum);
          }

          const numberBgColor =
            p.numberHighlightColor ||
            col.numberBgColor ||
            col.color ||
            '#facc15';

          const personnel = extractPersonnel({ name: p.text });

          list.push({
            key: `${wb.id}_${cIdx}_${rIdx}`,
            wristbandId: wb.id,
            wristbandTitle: wb.title || `Wristband ${wbIdx + 1}`,
            wristbandShort: wbShort,
            playText: p.text.trim(),
            slotLabel,
            wristbandNum: wbNum,
            numberBgColor,
            rowBgColor: p.highlightColor,
            highlightTarget,
            personnel,
          });
        });
      });
    });

    return list;
  }, [wristbands]);

  // Distinct personnel groups from wristbands
  const wristbandPersonnelGroups = useMemo(() => {
    const set = new Set<string>();
    allWristbandPlays.forEach((p) => set.add(p.personnel));
    return Array.from(set).sort();
  }, [allWristbandPlays]);

  // Filtered plays for Tab 2
  const filteredWristbandPlays = useMemo(() => {
    return allWristbandPlays.filter((p) => {
      if (filterPersonnel !== 'all' && p.personnel !== filterPersonnel) return false;
      return true;
    });
  }, [allWristbandPlays, filterPersonnel]);

  if (!isOpen) return null;

  // Handler: Insert entire wristband as a new Call Sheet Section
  const handleInsertWholeWristband = () => {
    const targetWb = wristbands.find((w) => w.id === selectedWbId) || wristbands[0];
    if (!targetWb) return;

    const newSec = createSectionFromWristband(targetWb, sectionGroup);
    newSec.targetUnit = unit;
    onAddSection(newSec);
    setFeedbackMsg(`Added "${newSec.title}" section with ${newSec.plays.filter(Boolean).length} wristband plays!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Handler: Insert selected wristband plays into an existing section
  const handleInsertSelectedPlays = () => {
    const selectedKeys = Object.keys(selectedPlayKeys).filter((k) => selectedPlayKeys[k]);
    if (selectedKeys.length === 0 || !targetSectionId) return;

    const playsToInsert = allWristbandPlays.filter((p) => selectedPlayKeys[p.key]);

    const updatedSections = targetSections.map((sec) => {
      if (sec.id !== targetSectionId) return sec;

      const newPlays = [...sec.plays];
      let insertIdx = 0;

      playsToInsert.forEach((wbPlay) => {
        // Find next empty slot or append
        let emptyIdx = newPlays.findIndex((p, idx) => idx >= insertIdx && p === null);
        const item: CallSheetPlay = {
          id: `play_from_wb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: wbPlay.playText,
          wristbandNum: wbPlay.wristbandNum,
          wristbandLabel: wbPlay.slotLabel,
          wristbandId: wbPlay.wristbandId,
          wristbandTitle: wbPlay.wristbandTitle,
          wristbandColor: wbPlay.numberBgColor,
          wristbandNumberColor: wbPlay.numberBgColor,
          wristbandRowColor: wbPlay.rowBgColor,
          wristbandHighlightTarget: wbPlay.highlightTarget,
          personnel: wbPlay.personnel,
        };

        if (emptyIdx !== -1) {
          newPlays[emptyIdx] = item;
          insertIdx = emptyIdx + 1;
        } else {
          newPlays.push(item);
        }
      });

      return {
        ...sec,
        slotsCount: Math.max(sec.slotsCount, newPlays.length),
        plays: newPlays,
      };
    });

    onUpdateCallSheetData({
      ...callSheetData,
      [unit === 'offense' ? 'offenseSections' : 'defenseSections']: updatedSections,
    });

    setFeedbackMsg(`Successfully inserted ${playsToInsert.length} plays into selected section!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Handler: Auto-link and sync all plays in Call Sheet with Wristbands
  const handleAutoSync = () => {
    const { updatedCallSheet, matchedCount } = syncCallSheetWithWristbands(
      callSheetData,
      wristbandData
    );
    onUpdateCallSheetData(updatedCallSheet);
    setFeedbackMsg(`Auto-synced ${matchedCount} plays across your Call Sheet with exact wristband numbering & colors!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Watch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Insert Wristband Plays into Call Sheet
              </h3>
              <p className="text-xs text-slate-400">
                Link plays with exact numbers &amp; highlight colors for game day calling &amp; printing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="p-3 bg-emerald-950/90 border-b border-emerald-800 text-emerald-300 font-bold text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/60">
          <button
            type="button"
            onClick={() => setActiveTab('whole_section')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'whole_section'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Entire Wristband Section</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pick_plays')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'pick_plays'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Select Specific Plays</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('auto_sync')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'auto_sync'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Auto-Sync Call Sheet</span>
          </button>
        </div>

        {/* Tab 1: Insert Entire Wristband as Section */}
        {activeTab === 'whole_section' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
            <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-1">
              <span className="font-bold text-white text-xs block">
                Generate a Dedicated Call Sheet Section from Wristband
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                This adds a new table directly to your Call Sheet with every single play from the wristband insert, maintaining its exact play number (1 to 26), column color, and highlight tint.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Choose Wristband Insert:</label>
                <div className="space-y-2">
                  {wristbands.map((wb, idx) => (
                    <label
                      key={wb.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedWbId === wb.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="selected_wb"
                          checked={selectedWbId === wb.id}
                          onChange={() => setSelectedWbId(wb.id)}
                          className="accent-indigo-500 cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-xs block text-white">{wb.title || `Wristband ${idx + 1}`}</span>
                          <span className="text-[11px] text-slate-400">{wb.subtitle || 'Exact 4.5" x 2.25" Insert'} &bull; {wb.columns?.reduce((acc, c) => acc + (c.plays?.filter((p) => p.text?.trim()).length || 0), 0) || 0} plays populated</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-bold">
                        {wb.rowsCount * (wb.columns?.length || 2)} Slots
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Section Placement Group:</label>
                <select
                  value={sectionGroup}
                  onChange={(e) => setSectionGroup(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="custom">Wristband / Custom Situations (Bottom Section)</option>
                  <option value="top_situations">Top Situations (1st &amp; 10, Down &amp; Distance)</option>
                  <option value="red_zone">Red Zone &amp; Goal Line</option>
                  <option value="tempo_game_mgmt">Tempo &amp; Game Management</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertWholeWristband}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Wristband Section</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Select Specific Plays to Insert into an Existing Section */}
        {activeTab === 'pick_plays' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
            {/* Target Section Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Target Call Sheet Section:</label>
                <select
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {targetSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.title} ({sec.plays.filter(Boolean).length} / {sec.slotsCount} filled)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Filter by Personnel:</label>
                <select
                  value={filterPersonnel}
                  onChange={(e) => setFilterPersonnel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Personnel ({allWristbandPlays.length} plays)</option>
                  {wristbandPersonnelGroups.map((pkg) => (
                    <option key={pkg} value={pkg}>
                      {pkg} ({allWristbandPlays.filter((p) => p.personnel === pkg).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select All / Deselect Toolbar */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400 text-[11px] font-semibold">
                Select plays to insert with exact wristband numbering:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    filteredWristbandPlays.forEach((p) => {
                      next[p.key] = true;
                    });
                    setSelectedPlayKeys(next);
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                >
                  Select All Filtered
                </button>
                <span className="text-slate-600">&bull;</span>
                <button
                  type="button"
                  onClick={() => setSelectedPlayKeys({})}
                  className="text-[11px] text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Wristband Plays Grid */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-950/60">
              {filteredWristbandPlays.map((wbPlay) => {
                const isChecked = !!selectedPlayKeys[wbPlay.key];
                return (
                  <div
                    key={wbPlay.key}
                    onClick={() =>
                      setSelectedPlayKeys((prev) => ({
                        ...prev,
                        [wbPlay.key]: !prev[wbPlay.key],
                      }))
                    }
                    className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-indigo-600/20 border-indigo-500/80 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="accent-indigo-500 rounded cursor-pointer"
                      />
                      {/* Exact Number Badge */}
                      <span
                        className="px-1.5 py-0.5 rounded font-black text-[10px] font-mono shrink-0 shadow-xs border border-black/20"
                        style={{
                          backgroundColor: wbPlay.numberBgColor,
                          color: '#000000',
                        }}
                      >
                        {String(wbPlay.slotLabel).replace(/^#\s*/, '')}
                      </span>
                      <span className="font-bold text-xs uppercase truncate">{wbPlay.playText}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {wbPlay.personnel}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        {wbPlay.wristbandShort}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 text-xs">
                {Object.values(selectedPlayKeys).filter(Boolean).length} plays selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInsertSelectedPlays}
                  disabled={Object.values(selectedPlayKeys).filter(Boolean).length === 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Insert Selected Plays</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: One-Click Auto-Sync */}
        {activeTab === 'auto_sync' && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
            <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Auto-Link All Call Sheet Plays to Wristbands</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Scans every play in your situational Call Sheet (Openers, 3rd Down, Red Zone, etc.). Any play that matches a play on your active wristbands is automatically stamped with its exact wristband number, card label, and number highlight color!
              </p>
            </div>

            <div className="space-y-2 text-slate-300 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span>Active Wristband Inserts:</span>
                <span className="font-bold text-white font-mono">{wristbands.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span>Total Plays on Wristbands:</span>
                <span className="font-bold text-amber-400 font-mono">{allWristbandPlays.length} plays</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleAutoSync}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Sync Call Sheet with Wristbands Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
