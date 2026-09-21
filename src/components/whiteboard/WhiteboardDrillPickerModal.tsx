import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  Dumbbell,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  PenTool,
} from 'lucide-react';
import {
  WhiteboardDrill,
  DEFENSIVE_POSITION_GROUPS,
  DefensivePositionCategory,
} from './whiteboardDrillData';

interface WhiteboardDrillPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  drills: WhiteboardDrill[];
  activeDrillId: string;
  selectedCategory: 'ALL' | DefensivePositionCategory;
  onSelectCategory: (cat: 'ALL' | DefensivePositionCategory) => void;
  onSelectDrill: (drillId: string) => void;
  onNavigateToDrills?: () => void;
  disabledDrillIds?: string[];
  onToggleDrillWhiteboard?: (drillId: string) => void;
}

export const WhiteboardDrillPickerModal: React.FC<WhiteboardDrillPickerModalProps> = ({
  isOpen,
  onClose,
  drills,
  activeDrillId,
  selectedCategory,
  onSelectCategory,
  onSelectDrill,
  onNavigateToDrills,
  disabledDrillIds = [],
  onToggleDrillWhiteboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [libraryMode, setLibraryMode] = useState<'schemes' | 'drills' | 'all'>(() => {
    return selectedCategory === 'SCHEME' ? 'schemes' : 'all';
  });
  const [schemeFilter, setSchemeFilter] = useState<'all' | 'base' | 'blitz' | 'stunt' | 'heavy'>('all');
  const [whiteboardStatusFilter, setWhiteboardStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  const isSchemePlay = (d: WhiteboardDrill) =>
    d.category === 'SCHEME' ||
    d.id.startsWith('hudl-') ||
    d.id.startsWith('scheme-') ||
    Boolean(d.hudlPlaybookName) ||
    Boolean(d.formationName) ||
    (Boolean(d.categoryLabel) && d.categoryLabel.toLowerCase().includes('scheme'));

  const schemeCount = useMemo(() => drills.filter(isSchemePlay).length, [drills]);
  const drillCount = useMemo(() => drills.filter((d) => !isSchemePlay(d)).length, [drills]);

  const isDrillEnabled = (id: string) => !disabledDrillIds.includes(id);

  // Filtered drills based on mode, category, search & whiteboard status
  const filteredDrills = useMemo(() => {
    return drills.filter((drill) => {
      // Whiteboard Status Filter
      if (whiteboardStatusFilter === 'enabled' && !isDrillEnabled(drill.id)) return false;
      if (whiteboardStatusFilter === 'disabled' && isDrillEnabled(drill.id)) return false;

      const isScheme = isSchemePlay(drill);

      // Primary Library Mode Filter
      if (libraryMode === 'schemes') {
        if (!isScheme) return false;
        if (schemeFilter !== 'all') {
          const t = (drill.title + ' ' + (drill.subtitle || '') + ' ' + (drill.formationName || '')).toLowerCase();
          if (schemeFilter === 'base' && !t.includes('base') && !t.includes('stack')) return false;
          if (schemeFilter === 'blitz' && !t.includes('sting') && !t.includes('dog') && !t.includes('blitz')) return false;
          if (schemeFilter === 'stunt' && !t.includes('stunt') && !t.includes('cross') && !t.includes('fan') && !t.includes('pinch')) return false;
          if (schemeFilter === 'heavy' && !t.includes('5-3') && !t.includes('6-2') && !t.includes('overshift') && !t.includes('goal line')) return false;
        }
      } else if (libraryMode === 'drills') {
        if (isScheme) return false;
        // Category match
        if (selectedCategory !== 'ALL') {
          if (selectedCategory === 'OFFENSE') {
            if (!drill.category.startsWith('OFF')) return false;
          } else if (selectedCategory === 'DEFENSE') {
            if (!['DL', 'DE', 'LB', 'DB', 'DEFENSE'].includes(drill.category)) return false;
          } else if (drill.category !== selectedCategory) {
            return false;
          }
        }
      } else {
        // 'all' mode
        if (selectedCategory !== 'ALL') {
          if (selectedCategory === 'OFFENSE') {
            if (!drill.category.startsWith('OFF')) return false;
          } else if (selectedCategory === 'DEFENSE') {
            if (!['DL', 'DE', 'LB', 'DB', 'SCHEME', 'DEFENSE'].includes(drill.category)) return false;
          } else if (drill.category !== selectedCategory) {
            return false;
          }
        }
      }

      // Search match
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        drill.title.toLowerCase().includes(q) ||
        drill.subtitle?.toLowerCase().includes(q) ||
        drill.objective?.toLowerCase().includes(q) ||
        drill.category.toLowerCase().includes(q) ||
        (drill.categoryLabel && drill.categoryLabel.toLowerCase().includes(q)) ||
        (drill.hudlPlaybookName && drill.hudlPlaybookName.toLowerCase().includes(q)) ||
        (drill.formationName && drill.formationName.toLowerCase().includes(q)) ||
        (drill.cues && drill.cues.some((c) => c.toLowerCase().includes(q)))
      );
    });
  }, [drills, libraryMode, schemeFilter, selectedCategory, searchTerm, whiteboardStatusFilter, disabledDrillIds]);

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: drills.length };
    drills.forEach((d) => {
      counts[d.category] = (counts[d.category] || 0) + 1;
      if (d.category.startsWith('OFF')) {
        counts.OFFENSE = (counts.OFFENSE || 0) + 1;
      }
      if (['DL', 'DE', 'LB', 'DB', 'SCHEME', 'DEFENSE'].includes(d.category)) {
        counts.DEFENSE = (counts.DEFENSE || 0) + 1;
      }
    });
    return counts;
  }, [drills]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-0 sm:p-4">
      <div
        className="w-full max-w-lg bg-slate-950 border border-slate-800 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Drag Handle (Mobile) */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                Whiteboard Drills &amp; Diagrams
              </h3>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {filteredDrills.length} of {drills.length} drills available
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onNavigateToDrills && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToDrills();
                }}
                className="px-2.5 py-1 text-[11px] font-bold bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                title="Switch to Master Drill Library"
              >
                <Dumbbell className="w-3 h-3" />
                <span className="hidden sm:inline">Drill Library</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary Scope Toggle: Defensive Schemes vs Drills vs All */}
        <div className="p-2 border-b border-slate-800 bg-slate-950 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setLibraryMode('schemes');
              setSchemeFilter('all');
              onSelectCategory('SCHEME');
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              libraryMode === 'schemes'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-300" />
            <span className="truncate">Defensive Schemes</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 font-mono shrink-0">{schemeCount}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLibraryMode('drills');
              if (selectedCategory === 'SCHEME') onSelectCategory('ALL');
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              libraryMode === 'drills'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5 text-blue-300" />
            <span className="truncate">Position Drills</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 font-mono shrink-0">{drillCount}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLibraryMode('all');
              onSelectCategory('ALL');
            }}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 ${
              libraryMode === 'all'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>All</span>
            <span className="text-[10px] text-slate-400">({drills.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                libraryMode === 'schemes'
                  ? "Search schemes, blitzes, stunts (e.g. 'Stack Rip', 'Double Dog', 'Cross')..."
                  : "Search drills, keys, cues (e.g. 'Get-off', 'Spill', 'Rip')..."
              }
              className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-400 shadow-inner"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Contextual Filter Chips */}
        <div className="px-3 py-2 border-b border-slate-800/60 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {libraryMode === 'schemes' ? (
            <>
              {[
                { id: 'all', label: 'All Schemes', count: schemeCount },
                { id: 'base', label: '4-4 Base Fronts', count: drills.filter(d => isSchemePlay(d) && (d.title + ' ' + (d.subtitle || '')).toLowerCase().includes('base')).length },
                { id: 'blitz', label: 'Blitz Packages', count: drills.filter(d => isSchemePlay(d) && ((d.title + ' ' + (d.subtitle || '')).toLowerCase().includes('sting') || (d.title + ' ' + (d.subtitle || '')).toLowerCase().includes('dog') || (d.title + ' ' + (d.subtitle || '')).toLowerCase().includes('blitz'))).length },
                { id: 'stunt', label: 'Line Stunts', count: drills.filter(d => isSchemePlay(d) && (d.title + ' ' + (d.subtitle || '')).toLowerCase().includes('stunt')).length },
                { id: 'heavy', label: 'Heavy / Goal Line', count: drills.filter(d => isSchemePlay(d) && ((d.title + ' ' + (d.subtitle || '')).toLowerCase().includes('5-3') || (d.title + ' ' + (d.subtitle || '')).toLowerCase().includes('6-2'))).length },
              ].map((sub) => {
                const isSelected = schemeFilter === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSchemeFilter(sub.id as any)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 font-black shadow-xs'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>{sub.label}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-indigo-200 font-black' : 'text-slate-500'}`}>
                      ({sub.count})
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSelectCategory('ALL')}
                className={`px-2.5 py-1 rounded-xl text-xs font-black whitespace-nowrap transition-all border cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                All ({libraryMode === 'drills' ? drillCount : categoryCounts.ALL || 0})
              </button>
              {DEFENSIVE_POSITION_GROUPS.filter((g) => g.id !== 'ALL' && (libraryMode === 'all' || g.id !== 'SCHEME')).map((group) => {
                const count = categoryCounts[group.id] || 0;
                if (count === 0 && !group.id.startsWith('OFF')) return null;
                const isSelected = selectedCategory === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onSelectCategory(group.id as any)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-500 font-black shadow-xs'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>{group.icon}</span>
                    <span>{group.shortLabel}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-blue-200 font-black' : 'text-slate-500'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Whiteboard Availability Filter Bar */}
        <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-[11px] gap-2 shrink-0">
          <span className="text-slate-400 font-bold flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-blue-400" />
            <span>Whiteboard Diagram:</span>
          </span>
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setWhiteboardStatusFilter('all')}
              className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] transition-all cursor-pointer ${
                whiteboardStatusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({drills.length})
            </button>
            <button
              type="button"
              onClick={() => setWhiteboardStatusFilter('enabled')}
              className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] transition-all cursor-pointer ${
                whiteboardStatusFilter === 'enabled'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active ({drills.filter((d) => isDrillEnabled(d.id)).length})
            </button>
            <button
              type="button"
              onClick={() => setWhiteboardStatusFilter('disabled')}
              className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] transition-all cursor-pointer ${
                whiteboardStatusFilter === 'disabled'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Deselected ({drills.filter((d) => !isDrillEnabled(d.id)).length})
            </button>
          </div>
        </div>

        {/* Drill List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-800/40">
          {filteredDrills.length > 0 ? (
            filteredDrills.map((drill) => {
              const isActive = drill.id === activeDrillId;
              const group = DEFENSIVE_POSITION_GROUPS.find((g) => g.id === drill.category);
              const phaseCount = drill.phases?.length || 0;

              return (
                <button
                  key={drill.id}
                  type="button"
                  onClick={() => {
                    onSelectDrill(drill.id);
                    onClose();
                  }}
                  className={`w-full pt-1.5 first:pt-0 text-left p-2.5 rounded-2xl transition-all cursor-pointer flex items-start justify-between gap-3 group border ${
                    isActive
                      ? 'bg-blue-600/20 border-blue-500/60 shadow-md ring-1 ring-blue-400/40'
                      : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex items-start gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black mt-0.5 border ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {group?.icon || '🏈'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                            isActive
                              ? 'bg-blue-500/30 text-blue-200'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {group?.shortLabel || drill.category}
                        </span>
                        {phaseCount > 0 && (
                          <span className="text-[9.5px] font-bold text-slate-400 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                            {phaseCount} {phaseCount === 1 ? 'Phase' : 'Phases'}
                          </span>
                        )}
                      </div>
                      <h4
                        className={`text-xs font-black tracking-wide uppercase mt-0.5 truncate ${
                          isActive ? 'text-blue-300 font-extrabold' : 'text-slate-100 group-hover:text-blue-300'
                        }`}
                      >
                        {drill.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {drill.subtitle || drill.objective}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    {onToggleDrillWhiteboard && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleDrillWhiteboard(drill.id);
                        }}
                        title={
                          isDrillEnabled(drill.id)
                            ? `Whiteboard enabled for "${drill.title}". Click to deselect.`
                            : `Whiteboard deselected for "${drill.title}". Click to enable.`
                        }
                        className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all border flex items-center gap-1 cursor-pointer ${
                          isDrillEnabled(drill.id)
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-750'
                        }`}
                      >
                        <PenTool className="w-2.5 h-2.5" />
                        <span>{isDrillEnabled(drill.id) ? 'Board ON' : 'No Board'}</span>
                      </button>
                    )}
                    {isActive ? (
                      <span className="p-1 rounded-full bg-blue-500 text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              <p className="font-bold text-slate-400">No drills found</p>
              <p className="mt-1">Try a different category or search term.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
