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
  Zap,
  PenTool,
  SlidersHorizontal,
} from 'lucide-react';
import { DrillFolder, DrillItem } from '../../types';

interface FlattenedDrill {
  drill: DrillItem;
  folderName: string;
  topCategory: string;
  parentCategories: string[];
  pathKey: string;
  drillIdx: number;
}

interface DrillCategoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { name: string; icon: string; count: number; subcategories: { name: string; count: number }[] }[];
  selectedCategory: string;
  selectedSubcategory: string;
  onSelectCategory: (category: string, subcategory?: string) => void;
  flattenedDrills: FlattenedDrill[];
  onSelectDrill?: (drill: DrillItem, pathKey: string) => void;
  onNavigateToWhiteboard?: () => void;
}

export const DrillCategoryDrawer: React.FC<DrillCategoryDrawerProps> = ({
  isOpen,
  onClose,
  categories,
  selectedCategory,
  selectedSubcategory,
  onSelectCategory,
  flattenedDrills,
  onSelectDrill,
  onNavigateToWhiteboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'categories' | 'drills'>('categories');

  // Search filtered drills
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    return flattenedDrills.filter((item) => {
      const name = (item.drill.name || '').toLowerCase();
      const desc = (item.drill.desc || '').toLowerCase();
      const key = (item.drill.key || '').toLowerCase();
      const folder = item.folderName.toLowerCase();
      const top = item.topCategory.toLowerCase();
      return (
        name.includes(q) ||
        desc.includes(q) ||
        key.includes(q) ||
        folder.includes(q) ||
        top.includes(q)
      );
    });
  }, [flattenedDrills, searchTerm]);

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
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                Drill Positions &amp; Categories
              </h3>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {flattenedDrills.length} drills across {categories.length} position groups
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onNavigateToWhiteboard && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToWhiteboard();
                }}
                className="px-2.5 py-1 text-[11px] font-bold bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-300 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                title="Switch to Tactical Chalkboard Diagrams"
              >
                <PenTool className="w-3 h-3" />
                <span className="hidden sm:inline">Chalkboard</span>
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

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search all drills (e.g. 'Hawk', 'Spill', 'Drop')..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 shadow-inner"
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

        {/* If user is searching, display matching drills list */}
        {searchTerm.trim() ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-800/40">
            <div className="px-1 pb-1 text-[11px] font-bold text-slate-400">
              Found {searchResults.length} matching drills
            </div>
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <button
                  key={`${item.pathKey}_${item.drillIdx}`}
                  type="button"
                  onClick={() => {
                    onSelectCategory(item.topCategory, item.folderName);
                    if (onSelectDrill) onSelectDrill(item.drill, item.pathKey);
                    onClose();
                  }}
                  className="w-full pt-1.5 first:pt-0 text-left p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase text-indigo-400/90 block">
                      {item.topCategory} • {item.folderName}
                    </span>
                    <h4 className="text-xs font-black text-slate-100 group-hover:text-indigo-300 transition-colors">
                      {item.drill.name}
                    </h4>
                    {item.drill.key && (
                      <p className="text-[11px] text-emerald-400/90 line-clamp-1 mt-0.5">
                        Focus: {item.drill.key}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 mt-1 shrink-0" />
                </button>
              ))
            ) : (
              <div className="py-10 text-center text-slate-500 text-xs">
                No drills found matching "{searchTerm}"
              </div>
            )}
          </div>
        ) : (
          /* Normal Categories & Positions View */
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* All Drills Quick Action */}
            <button
              type="button"
              onClick={() => {
                onSelectCategory('all', 'all');
                onClose();
              }}
              className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white font-black ring-1 ring-indigo-400/50'
                  : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🏈</span>
                <div>
                  <div className="text-xs font-black">All Categories &amp; Drills</div>
                  <div className="text-[10px] text-slate-400">Complete Master Library</div>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                {flattenedDrills.length}
              </span>
            </button>

            {/* Position Groups Hierarchy */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 block">
                Filter By Position Group
              </span>

              {categories.map((cat) => {
                const isCatSelected = selectedCategory === cat.name;

                return (
                  <div
                    key={cat.name}
                    className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden"
                  >
                    {/* Main Category Header Button */}
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCategory(cat.name, 'all');
                          onClose();
                        }}
                        className={`flex items-center gap-2 text-left flex-1 cursor-pointer transition-colors ${
                          isCatSelected ? 'text-indigo-300 font-black' : 'text-slate-200 hover:text-white'
                        }`}
                      >
                        <span className="text-base">{cat.icon}</span>
                        <div className="min-w-0">
                          <span className="text-xs font-black block truncate">{cat.name}</span>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {cat.count}
                        </span>
                        {isCatSelected && selectedSubcategory === 'all' && (
                          <span className="p-1 bg-indigo-500 text-white rounded-full">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subcategories (if any) */}
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <div className="px-2.5 pb-2.5 pt-0.5 flex flex-wrap gap-1.5 border-t border-slate-800/40">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCategory(cat.name, 'all');
                            onClose();
                          }}
                          className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all border cursor-pointer ${
                            isCatSelected && selectedSubcategory === 'all'
                              ? 'bg-indigo-600 text-white border-indigo-500 font-black shadow-xs'
                              : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          All {cat.name}
                        </button>
                        {cat.subcategories.map((sub) => {
                          const isSubSelected = isCatSelected && selectedSubcategory === sub.name;
                          return (
                            <button
                              key={sub.name}
                              type="button"
                              onClick={() => {
                                onSelectCategory(cat.name, sub.name);
                                onClose();
                              }}
                              className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                                isSubSelected
                                  ? 'bg-indigo-600 text-white border-indigo-500 font-black shadow-xs'
                                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
                              }`}
                            >
                              <span>{sub.name}</span>
                              <span className="text-[9px] opacity-70">({sub.count})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
