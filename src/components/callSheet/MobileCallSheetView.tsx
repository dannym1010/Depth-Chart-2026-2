import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Timer,
  Shield,
  Swords,
  Trash2,
  Edit2,
  ChevronDown,
} from 'lucide-react';
import {
  CallSheetFullData,
  CallSheetSection,
  CallSheetPlay,
  TimeoutsState,
  TwoPointRule,
} from '../../types/callSheet';
import { TwoPointChartBox } from './TwoPointChartBox';
import { TimeoutsTrackerBox } from './TimeoutsTrackerBox';

interface MobileCallSheetViewProps {
  unit: 'offense' | 'defense';
  callSheetData: CallSheetFullData;
  highlightRedZone: boolean;
  onSelectUnit: (unit: 'offense' | 'defense') => void;
  onSlotClick: (sectionId: string, slotIndex: number) => void;
  onClearSlot: (sectionId: string, slotIndex: number) => void;
  onChangeTimeouts: (timeouts: TimeoutsState) => void;
  onUpdateSection?: (section: CallSheetSection) => void;
  onDeleteSection?: (sectionId: string) => void;
  onAddSection?: (group: 'top_situations' | 'red_zone' | 'tempo_game_mgmt' | 'custom') => void;
  onUpdateTwoPointRules?: (rules: TwoPointRule[]) => void;
  onToggleTwoPointHighlight?: () => void;
}

type MobileFilterCategory =
  | 'all'
  | '1st_down'
  | '2nd_down'
  | '3rd_4th'
  | 'red_zone'
  | 'tempo'
  | 'scripts'
  | 'two_point'
  | 'timeouts';

export const MobileCallSheetView: React.FC<MobileCallSheetViewProps> = ({
  unit,
  callSheetData,
  highlightRedZone,
  onSelectUnit,
  onSlotClick,
  onClearSlot,
  onChangeTimeouts,
  onUpdateSection,
  onDeleteSection,
  onAddSection,
  onUpdateTwoPointRules,
  onToggleTwoPointHighlight,
}) => {
  const [activeCategory, setActiveCategory] = useState<MobileFilterCategory>('all');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const sections = unit === 'offense' ? callSheetData.offenseSections : callSheetData.defenseSections;
  const scriptPlays = unit === 'offense' ? callSheetData.offenseScript : callSheetData.defenseScript;

  // Filter sections based on mobile category
  const filteredSections = sections.filter((sec) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === '1st_down') return sec.id.includes('1_10') && !sec.id.includes('rz');
    if (activeCategory === '2nd_down') return sec.id.includes('2nd') && !sec.id.includes('rz');
    if (activeCategory === '3rd_4th')
      return (
        (sec.id.includes('3rd') ||
          sec.id.includes('4th') ||
          sec.id.includes('backed_up') ||
          sec.id.includes('tricks')) &&
        !sec.id.includes('rz')
      );
    if (activeCategory === 'red_zone') return sec.group === 'red_zone';
    if (activeCategory === 'tempo') return sec.group === 'tempo_game_mgmt';
    return true;
  });

  return (
    <div className="w-full pb-20 space-y-3 font-sans print:hidden">
      {/* Sticky Mobile HUD Top Navigation */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-2.5 space-y-2 shadow-lg">
        {/* Offense / Defense Switcher & Mode */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onSelectUnit('offense')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                unit === 'offense'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Offense</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectUnit('defense')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                unit === 'defense'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Defense</span>
            </button>
          </div>

          {/* Quick Timeout Indicator */}
          <button
            type="button"
            onClick={() => setActiveCategory('timeouts')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 flex items-center gap-1.5 text-[11px] font-black text-slate-200 shrink-0 cursor-pointer"
          >
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span>
              TO: {callSheetData.timeouts.secondHalfUs.filter(Boolean).length}/
              {callSheetData.timeoutsCount || 3}
            </span>
          </button>
        </div>

        {/* Scrollable Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'all', label: 'All Situations' },
            { id: '1st_down', label: '1st & 10' },
            { id: '2nd_down', label: '2nd Down' },
            { id: '3rd_4th', label: '3rd & 4th' },
            { id: 'red_zone', label: '🔥 Red Zone' },
            { id: 'tempo', label: '⏱️ Tempo & 2-Min' },
            { id: 'scripts', label: '📜 Script' },
            { id: 'two_point', label: '🎯 2-Pt Chart' },
            { id: 'timeouts', label: '⏳ Timeouts' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as MobileFilterCategory)}
              className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer text-[11px] ${
                activeCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* View: Two-Point Conversion Chart */}
      {activeCategory === 'two_point' && (
        <div className="p-2 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>2-Point Decision Matrix</span>
            </h3>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className="text-xs text-indigo-400 font-bold"
            >
              Back to Sheet
            </button>
          </div>
          <TwoPointChartBox
            rules={callSheetData.twoPointRules}
            highlightEnabled={callSheetData.twoPointHighlightEnabled ?? true}
            onUpdateRules={onUpdateTwoPointRules}
            onToggleHighlight={onToggleTwoPointHighlight}
          />
        </div>
      )}

      {/* View: Timeouts Tracker */}
      {activeCategory === 'timeouts' && (
        <div className="p-2 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-amber-400" />
              <span>Sideline Timeouts Tracker</span>
            </h3>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className="text-xs text-indigo-400 font-bold"
            >
              Back to Sheet
            </button>
          </div>
          <TimeoutsTrackerBox
            timeouts={callSheetData.timeouts}
            highlightEnabled={callSheetData.timeoutsHighlightEnabled ?? false}
            timeoutsCount={callSheetData.timeoutsCount || 3}
            onChangeTimeouts={onChangeTimeouts}
          />
        </div>
      )}

      {/* View: Scripts */}
      {activeCategory === 'scripts' && (
        <div className="p-2 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-purple-300 flex items-center gap-1.5">
              <span>📜 Opening Scripted Plays ({scriptPlays.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className="text-xs text-indigo-400 font-bold"
            >
              Back to Sheet
            </button>
          </div>
          <div className="space-y-1.5">
            {scriptPlays.map((play, idx) => (
              <div
                key={`mob-script-${idx}`}
                onClick={() => onSlotClick('script', idx)}
                className="p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-[0.99] bg-slate-800/90 border-slate-700 text-slate-100 shadow-sm hover:border-purple-500"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {play?.wristbandNum && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-black text-[10px] font-mono shrink-0 shadow-xs">
                      {String(play.wristbandNum).replace(/^#\s*/, '')}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-black uppercase truncate text-slate-100">
                      {play ? (play.name || '').replace(/^#\s*\d*\s*[-.:]?\s*/i, '').replace(/^\d+[\.\)]\s+/, '').replace(/^#\s*/, '').trim() : '(Empty Slot - Tap to Pick)'}
                    </h4>
                    {play?.formation &&
                      !play.formation.includes('21') &&
                      !play.name?.toUpperCase().includes('21') &&
                      !play.name?.toUpperCase().includes(play.formation.toUpperCase()) && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {play.formation}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View: Situational Sections Cards */}
      {activeCategory !== 'two_point' &&
        activeCategory !== 'timeouts' &&
        activeCategory !== 'scripts' && (
          <div className="p-2 space-y-3">
            {/* Red Zone Banner if Red Zone category or All */}
            {activeCategory === 'red_zone' && (
              <div className="p-3 bg-red-600 rounded-2xl text-white font-black text-center text-sm uppercase tracking-wider shadow-md">
                🔥 {unit === 'offense' ? 'RED ZONE CALL SHEET' : 'RED ZONE DEFENSE'}
              </div>
            )}

            {filteredSections.map((sec) => {
              const isRz = sec.group === 'red_zone';
              const isHighlighted = sec.highlightEnabled ?? (isRz && highlightRedZone);
              const isEditing = editingSectionId === sec.id;

              return (
                <div
                  key={sec.id}
                  className={`rounded-2xl border overflow-hidden shadow-sm transition-all ${
                    isHighlighted
                      ? 'border-rose-500/80 bg-rose-950/20'
                      : 'border-slate-700/80 bg-slate-900'
                  }`}
                >
                  {/* Section Title Header */}
                  <div
                    className="px-3.5 py-2 flex items-center justify-between font-black text-xs uppercase tracking-wider cursor-pointer"
                    style={{
                      backgroundColor: sec.headerBgColor,
                      color: sec.headerTextColor,
                    }}
                    onClick={() =>
                      setEditingSectionId(isEditing ? null : sec.id)
                    }
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{sec.title}</span>
                      <Edit2 className="w-3 h-3 opacity-60" />
                    </div>
                    <span className="text-[11px] opacity-85 font-mono">
                      {sec.plays.filter(Boolean).length}/{sec.slotsCount}
                    </span>
                  </div>

                  {/* Section quick mobile drawer for rows, columns, highlight & delete */}
                  {isEditing && (
                    <div className="p-2.5 bg-slate-950 border-b border-slate-800 space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {/* Rows */}
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-bold">Rows: {sec.slotsCount}</span>
                          {onUpdateSection && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateSection({
                                    ...sec,
                                    slotsCount: sec.slotsCount + 1,
                                    plays: [...sec.plays, null],
                                  });
                                }}
                                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded font-bold"
                              >
                                + Row
                              </button>
                              {sec.slotsCount > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateSection({
                                      ...sec,
                                      slotsCount: sec.slotsCount - 1,
                                      plays: sec.plays.slice(0, sec.slotsCount - 1),
                                    });
                                  }}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded font-bold"
                                >
                                  - Row
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Highlight toggle */}
                        {onUpdateSection && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateSection({
                                ...sec,
                                highlightEnabled: !isHighlighted,
                              });
                            }}
                            className={`px-2 py-0.5 rounded font-bold border transition-colors ${
                              isHighlighted
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            Highlight {isHighlighted ? 'ON' : 'OFF'}
                          </button>
                        )}

                        {/* Delete */}
                        {onDeleteSection && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete "${sec.title}"?`)) {
                                onDeleteSection(sec.id);
                              }
                            }}
                            className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded font-bold flex items-center gap-1 ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Play list rows */}
                  <div className="divide-y divide-slate-800">
                    {Array.from({ length: sec.slotsCount }).map((_, slotIdx) => {
                      const play = sec.plays[slotIdx];

                      return (
                        <div
                          key={`${sec.id}-${slotIdx}`}
                          onClick={() => onSlotClick(sec.id, slotIdx)}
                          className={`p-2.5 flex items-center justify-between gap-2 transition-all cursor-pointer active:bg-slate-800 ${
                            isRz ? 'hover:bg-rose-950/30' : 'hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {play ? (
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {play.wristbandNum && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-black text-[9.5px] font-mono shrink-0 shadow-xs">
                                      {play.wristbandNum}
                                    </span>
                                  )}
                                  <span className="text-xs font-black uppercase truncate text-slate-100">
                                    {play.name}
                                  </span>
                                </div>
                                {play.formation &&
                                  !play.formation.includes('21') &&
                                  !play.name?.toUpperCase().includes('21') &&
                                  !play.name?.toUpperCase().includes(play.formation.toUpperCase()) && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {play.formation}
                                    </span>
                                  )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 italic print:hidden">
                                + Tap to pick play
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {onAddSection && (
              <button
                type="button"
                onClick={() => onAddSection('top_situations')}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Situation Table</span>
              </button>
            )}
          </div>
        )}
    </div>
  );
};
