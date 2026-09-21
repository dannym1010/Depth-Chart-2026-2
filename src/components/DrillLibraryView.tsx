import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dumbbell,
  Folder,
  FolderOpen,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Cloud,
  GripVertical,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Layers,
  Copy,
  Check,
  Zap,
  SlidersHorizontal,
  PenTool,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { DrillFolder, DrillItem, UserRole } from '../types';
import { DrillCategoryDrawer } from './drills/DrillCategoryDrawer';

interface DrillLibraryViewProps {
  cascadingDrills: DrillFolder[];
  collapsedFolders: Record<string, boolean>;
  onToggleFolder: (pathKey: string) => void;
  onAddTopFolder: () => void;
  onAddSubfolder: (pathKey: string) => void;
  onRenameFolder: (pathKey: string) => void;
  onDeleteFolder: (pathKey: string) => void;
  onMoveFolder: (pathKey: string, direction: -1 | 1) => void;
  onAddDrill: (pathKey: string) => void;
  onUpdateDrill: (
    pathKey: string,
    drillIdx: number,
    field: keyof DrillItem,
    value: string
  ) => void;
  onDeleteDrill: (pathKey: string, drillIdx: number) => void;
  onMoveDrillToFolder: (
    sourcePath: string,
    drillIdx: number,
    targetPath: string
  ) => void;
  onExportCSV: () => void;
  onImportCSVClick: () => void;
  onExportJSON: () => void;
  onImportJSONClick: () => void;
  onResetDefaults: () => void;
  onForceSyncCloud: () => void;
  userRole: UserRole;
  onNavigateToWhiteboard?: (drillId?: string, category?: string) => void;
}

interface DrillRowItemProps {
  drill: DrillItem;
  pathKey: string;
  drillIdx: number;
  userRole: UserRole;
  allFolders: { path: string; name: string }[];
  onUpdateDrill: (
    pathKey: string,
    drillIdx: number,
    field: keyof DrillItem,
    value: string
  ) => void;
  onDeleteDrill: (pathKey: string, drillIdx: number) => void;
  onMoveDrillToFolder: (
    sourcePath: string,
    drillIdx: number,
    targetPath: string
  ) => void;
  onDragStart: () => void;
}

const DrillRowItem: React.FC<DrillRowItemProps> = ({
  drill,
  pathKey,
  drillIdx,
  userRole,
  allFolders,
  onUpdateDrill,
  onDeleteDrill,
  onMoveDrillToFolder,
  onDragStart,
}) => {
  const [name, setName] = useState(drill.name || '');
  const [desc, setDesc] = useState(drill.desc || '');
  const [keyVal, setKeyVal] = useState(drill.key || '');
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setName(drill.name || '');
      setDesc(drill.desc || '');
      setKeyVal(drill.key || '');
    }
  }, [drill.name, drill.desc, drill.key]);

  const handleNameChange = (val: string) => {
    setName(val);
    onUpdateDrill(pathKey, drillIdx, 'name', val);
  };

  const handleDescChange = (val: string) => {
    setDesc(val);
    onUpdateDrill(pathKey, drillIdx, 'desc', val);
  };

  const handleKeyChange = (val: string) => {
    setKeyVal(val);
    onUpdateDrill(pathKey, drillIdx, 'key', val);
  };

  return (
    <div
      draggable={userRole === 'admin'}
      onDragStart={onDragStart}
      className="grid grid-cols-12 gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 items-start transition-all"
    >
      {/* Drill Name */}
      <div className="col-span-12 md:col-span-3 flex items-start gap-2">
        {userRole === 'admin' && (
          <GripVertical className="w-4 h-4 text-slate-500 mt-2 flex-shrink-0 cursor-grab active:cursor-grabbing" />
        )}
        <input
          type="text"
          value={name}
          disabled={userRole !== 'admin'}
          onFocus={() => {
            isEditingRef.current = true;
          }}
          onBlur={() => {
            isEditingRef.current = false;
            onUpdateDrill(pathKey, drillIdx, 'name', name);
          }}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Drill Title"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-400 disabled:bg-transparent disabled:border-transparent"
        />
      </div>

      {/* Description / Instructions */}
      <div className="col-span-12 md:col-span-5">
        <textarea
          rows={2}
          value={desc}
          disabled={userRole !== 'admin'}
          onFocus={() => {
            isEditingRef.current = true;
          }}
          onBlur={() => {
            isEditingRef.current = false;
            onUpdateDrill(pathKey, drillIdx, 'desc', desc);
          }}
          onChange={(e) => handleDescChange(e.target.value)}
          placeholder="Setup instructions, number of players, cone placement..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs font-medium text-slate-300 leading-relaxed focus:outline-none focus:border-indigo-400 resize-y disabled:bg-transparent disabled:border-transparent placeholder:text-slate-600"
        />
      </div>

      {/* Coaching Key / Focus */}
      <div className="col-span-12 md:col-span-2">
        <textarea
          rows={2}
          value={keyVal}
          disabled={userRole !== 'admin'}
          onFocus={() => {
            isEditingRef.current = true;
          }}
          onBlur={() => {
            isEditingRef.current = false;
            onUpdateDrill(pathKey, drillIdx, 'key', keyVal);
          }}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="Key coaching cues (e.g. eyes on hips)..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs font-medium text-emerald-300/90 leading-relaxed focus:outline-none focus:border-emerald-400 resize-y disabled:bg-transparent disabled:border-transparent placeholder:text-slate-600"
        />
      </div>

      {/* Move to folder & Delete */}
      <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-1.5 pt-1">
        {userRole === 'admin' ? (
          <>
            <select
              value={pathKey}
              onChange={(e) =>
                onMoveDrillToFolder(pathKey, drillIdx, e.target.value)
              }
              className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-1 text-[11px] font-semibold text-slate-300 max-w-[115px] truncate focus:outline-none focus:border-indigo-400"
            >
              {allFolders.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => onDeleteDrill(pathKey, drillIdx)}
              title="Delete Drill"
              className="p-1.5 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <span className="text-[10px] text-slate-500 italic">Read-only</span>
        )}
      </div>
    </div>
  );
};

export const DrillLibraryView: React.FC<DrillLibraryViewProps> = ({
  cascadingDrills,
  collapsedFolders,
  onToggleFolder,
  onAddTopFolder,
  onAddSubfolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onAddDrill,
  onUpdateDrill,
  onDeleteDrill,
  onMoveDrillToFolder,
  onExportCSV,
  onImportCSVClick,
  onExportJSON,
  onImportJSONClick,
  onResetDefaults,
  onForceSyncCloud,
  userRole,
  onNavigateToWhiteboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedDrill, setDraggedDrill] = useState<{
    sourcePath: string;
    drillIndex: number;
  } | null>(null);
  const [dragOverFolderPath, setDragOverFolderPath] = useState<string | null>(
    null
  );

  // View Mode: 'cards' (Mobile Sideline Cards) vs 'tree' (Master Tree View)
  const [viewMode, setViewMode] = useState<'cards' | 'tree'>('cards');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [copiedDrillId, setCopiedDrillId] = useState<string | null>(null);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState<boolean>(false);
  const [isCompactCardMode, setIsCompactCardMode] = useState<boolean>(true);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  // Section collapse state for Cards mode: by default all sections are collapsed (not expanded)
  const [collapsedCardSections, setCollapsedCardSections] = useState<Record<string, boolean>>({});

  // Helper to normalize strings for robust category matching (stripping emoji, whitespace, punctuation)
  const cleanCategoryStr = (str: string) =>
    (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();

  // Helper: check if a drill belongs to a target category
  const isDrillCategoryMatch = (
    item: { topCategory: string; folderName: string; parentCategories: string[]; drill?: DrillItem },
    targetCat: string
  ) => {
    if (!targetCat || targetCat === 'all') return true;
    if (item.topCategory === targetCat || item.folderName === targetCat) return true;
    if (item.parentCategories && item.parentCategories.includes(targetCat)) return true;

    const targetClean = cleanCategoryStr(targetCat);
    const topClean = cleanCategoryStr(item.topCategory);
    const folderClean = cleanCategoryStr(item.folderName);

    if (topClean === targetClean || folderClean === targetClean) return true;
    if (item.parentCategories && item.parentCategories.some((p) => cleanCategoryStr(p) === targetClean)) return true;

    // Robust stem matching: "offens" matches offense, offensive, etc.
    const isTargetOffense =
      targetClean.includes('offens') || targetClean === 'off' || targetClean.startsWith('off');
    if (isTargetOffense) {
      if (topClean.includes('offens') || folderClean.includes('offens')) return true;
      if (item.parentCategories && item.parentCategories.some((p) => cleanCategoryStr(p).includes('offens'))) {
        return true;
      }
      if (item.drill && cleanCategoryStr(item.drill.name).includes('offens')) return true;
    }

    // Robust stem matching: "defens" matches defense, defensive, etc.
    const isTargetDefense =
      targetClean.includes('defens') || targetClean === 'def' || targetClean.startsWith('def');
    if (isTargetDefense) {
      if (topClean.includes('defens') || folderClean.includes('defens')) return true;
      if (item.parentCategories && item.parentCategories.some((p) => cleanCategoryStr(p).includes('defens'))) {
        return true;
      }
      if (item.drill && cleanCategoryStr(item.drill.name).includes('defens')) return true;
    }

    // Special teams matching
    const isTargetSpecial =
      targetClean.includes('special') || targetClean.includes('st') || targetClean === 'specials';
    if (isTargetSpecial) {
      if (topClean.includes('special') || folderClean.includes('special')) return true;
      if (item.parentCategories && item.parentCategories.some((p) => cleanCategoryStr(p).includes('special'))) {
        return true;
      }
      if (item.drill && cleanCategoryStr(item.drill.name).includes('special')) return true;
    }

    // Warm-up & agility matching
    const isTargetWarmup =
      targetClean.includes('warm') || targetClean.includes('agility') || targetClean.includes('condition');
    if (isTargetWarmup) {
      if (
        topClean.includes('warm') ||
        topClean.includes('agility') ||
        folderClean.includes('warm') ||
        folderClean.includes('agility')
      ) {
        return true;
      }
      if (
        item.parentCategories &&
        item.parentCategories.some((p) => {
          const cp = cleanCategoryStr(p);
          return cp.includes('warm') || cp.includes('agility') || cp.includes('condition');
        })
      ) {
        return true;
      }
    }

    // General / Tackling / Fundamental matching
    if (targetClean.includes('tackl')) {
      if (topClean.includes('tackl') || folderClean.includes('tackl')) return true;
      if (item.parentCategories && item.parentCategories.some((p) => cleanCategoryStr(p).includes('tackl'))) {
        return true;
      }
    }

    if (targetClean.length >= 3) {
      if (topClean.includes(targetClean) || targetClean.includes(topClean)) return true;
      if (folderClean.includes(targetClean) || targetClean.includes(folderClean)) return true;
      if (
        item.parentCategories &&
        item.parentCategories.some((p) => {
          const cp = cleanCategoryStr(p);
          return cp.includes(targetClean) || targetClean.includes(cp);
        })
      ) {
        return true;
      }
    }

    return false;
  };

  // Flatten all folders for dropdown selector
  const allFolders = useMemo(() => {
    const list: { path: string; name: string }[] = [];
    const traverse = (folders: DrillFolder[], parentPath = '') => {
      folders.forEach((f, idx) => {
        const path = parentPath ? `${parentPath}_${idx}` : String(idx);
        list.push({ path, name: f.name });
        if (f.subfolders && f.subfolders.length > 0) {
          traverse(f.subfolders, path);
        }
      });
    };
    traverse(cascadingDrills);
    return list;
  }, [cascadingDrills]);

  // Flatten all drills into an indexed list for fast mobile search & category filtering
  const flattenedDrillList = useMemo(() => {
    const list: {
      drill: DrillItem;
      folderName: string;
      topCategory: string;
      parentCategories: string[];
      pathKey: string;
      drillIdx: number;
    }[] = [];

    const traverse = (
      folders: DrillFolder[],
      parentPath = '',
      topCategoryName = '',
      ancestorNames: string[] = []
    ) => {
      folders.forEach((f, idx) => {
        const pathKey = parentPath ? `${parentPath}_${idx}` : String(idx);
        const topCat = topCategoryName || f.name;
        const currentAncestors = [...ancestorNames, f.name];

        (f.drills || []).forEach((drill, dIdx) => {
          list.push({
            drill,
            folderName: f.name,
            topCategory: topCat,
            parentCategories: currentAncestors,
            pathKey,
            drillIdx: dIdx,
          });
        });
        if (f.subfolders && f.subfolders.length > 0) {
          traverse(f.subfolders, pathKey, topCat, currentAncestors);
        }
      });
    };

    traverse(cascadingDrills);
    return list;
  }, [cascadingDrills]);

  // Extract unique top-level category names
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    cascadingDrills.forEach((f) => set.add(f.name));
    return Array.from(set);
  }, [cascadingDrills]);

  // Extract subcategories if a specific top-level category is selected
  const subcategoryOptions = useMemo(() => {
    if (selectedCategory === 'all') return [];
    const matchedTop = cascadingDrills.find(
      (f) =>
        f.name === selectedCategory ||
        cleanCategoryStr(f.name) === cleanCategoryStr(selectedCategory)
    );
    if (!matchedTop || !matchedTop.subfolders || matchedTop.subfolders.length === 0) {
      return [];
    }
    return matchedTop.subfolders.map((sf) => sf.name);
  }, [cascadingDrills, selectedCategory]);

  // Icon helper for position categories
  const getCategoryIcon = (categoryName: string): string => {
    const clean = cleanCategoryStr(categoryName);
    if (clean.includes('offens')) return '🏈';
    if (clean.includes('defens')) return '🛡️';
    if (clean.includes('tackl')) return '💥';
    if (clean.includes('special')) return '⚡';
    if (clean.includes('warm') || clean.includes('agility')) return '🏃';
    if (clean.includes('youth') || clean.includes('fundam')) return '⭐';
    if (clean.includes('qb') || clean.includes('quarterback')) return '🎯';
    if (clean.includes('line') || clean.includes('blocking')) return '🧱';
    return '📋';
  };

  // Structured categories for the mobile drawer
  const drawerCategories = useMemo(() => {
    return cascadingDrills.map((folder) => {
      const subcategories = (folder.subfolders || []).map((sub) => ({
        name: sub.name,
        count: (sub.drills?.length || 0) + (sub.subfolders?.reduce((a, b) => a + (b.drills?.length || 0), 0) || 0),
      }));

      const directDrillCount = folder.drills?.length || 0;
      const totalCount = directDrillCount + subcategories.reduce((a, b) => a + b.count, 0);

      return {
        name: folder.name,
        icon: getCategoryIcon(folder.name),
        count: totalCount,
        subcategories,
      };
    });
  }, [cascadingDrills]);

  // Total count of drills
  const totalDrillsCount = flattenedDrillList.length;

  const query = searchTerm.trim().toLowerCase();

  // Filter drills for mobile card view
  const filteredCardDrills = useMemo(() => {
    return flattenedDrillList.filter(
      ({ drill, folderName, topCategory, parentCategories }) => {
        // Top Category filter
        if (selectedCategory !== 'all') {
          if (!isDrillCategoryMatch({ topCategory, folderName, parentCategories, drill }, selectedCategory)) {
            return false;
          }
        }

        // Subcategory filter
        if (selectedSubcategory !== 'all') {
          if (
            folderName !== selectedSubcategory &&
            !parentCategories.includes(selectedSubcategory)
          ) {
            return false;
          }
        }

        // Search term filter
        if (!query) return true;
        const name = (drill.name || '').toLowerCase();
        const desc = (drill.desc || '').toLowerCase();
        const key = (drill.key || '').toLowerCase();
        const cat = folderName.toLowerCase();
        const topCat = topCategory.toLowerCase();
        return (
          name.includes(query) ||
          desc.includes(query) ||
          key.includes(query) ||
          cat.includes(query) ||
          topCat.includes(query)
        );
      }
    );
  }, [flattenedDrillList, selectedCategory, selectedSubcategory, query]);

  // Group filtered drills by top category for clean section accordions in Cards Mode
  const groupedCardDrills = useMemo(() => {
    const groups: { category: string; icon: string; drills: typeof filteredCardDrills }[] = [];
    const map = new Map<string, typeof filteredCardDrills>();

    for (const item of filteredCardDrills) {
      const cat = item.topCategory || item.folderName || 'General Drills';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(item);
    }

    for (const [cat, drills] of map.entries()) {
      groups.push({
        category: cat,
        icon: getCategoryIcon(cat),
        drills,
      });
    }

    return groups;
  }, [filteredCardDrills]);

  const toggleCardSection = (catName: string) => {
    setCollapsedCardSections((prev) => {
      const isCurrentlyCollapsed = prev[catName] !== undefined ? prev[catName] : true;
      return {
        ...prev,
        [catName]: !isCurrentlyCollapsed,
      };
    });
  };

  const handleExpandAllCardSections = () => {
    const next: Record<string, boolean> = {};
    groupedCardDrills.forEach((g) => {
      next[g.category] = false;
    });
    setCollapsedCardSections(next);
  };

  const handleCollapseAllCardSections = () => {
    const next: Record<string, boolean> = {};
    groupedCardDrills.forEach((g) => {
      next[g.category] = true;
    });
    setCollapsedCardSections(next);
  };

  // Helper: check if a drill matches query
  const isDrillMatch = (drill: DrillItem) => {
    if (!query) return true;
    const name = (drill.name || '').toLowerCase();
    const desc = (drill.desc || '').toLowerCase();
    const key = (drill.key || '').toLowerCase();
    return name.includes(query) || desc.includes(query) || key.includes(query);
  };

  // Helper: check if a folder or its subfolders have any drill matches
  const folderHasMatch = (folder: DrillFolder): boolean => {
    if (!query) return true;
    if (folder.drills?.some(isDrillMatch)) return true;
    if (folder.subfolders?.some(folderHasMatch)) return true;
    return false;
  };

  // Handle expand/collapse all in Tree Mode
  const handleExpandAll = () => {
    allFolders.forEach((f) => {
      const isCol = collapsedFolders[f.path] !== undefined ? collapsedFolders[f.path] : true;
      if (isCol) {
        onToggleFolder(f.path);
      }
    });
  };

  const handleCollapseAll = () => {
    allFolders.forEach((f) => {
      const isCol = collapsedFolders[f.path] !== undefined ? collapsedFolders[f.path] : true;
      if (!isCol) {
        onToggleFolder(f.path);
      }
    });
  };

  // Copy drill info to clipboard
  const handleCopyDrill = (drill: DrillItem, folderName: string, id: string) => {
    const text = `🏈 ${drill.name} (${folderName})\n📋 Setup: ${drill.desc}\n⚡ Key Coaching Cues: ${drill.key}`;
    navigator.clipboard?.writeText(text);
    setCopiedDrillId(id);
    setTimeout(() => setCopiedDrillId(null), 2200);
  };

  // Recursive folder node renderer for Master Tree Mode
  const renderFolderNode = (
    folder: DrillFolder,
    pathKey: string,
    depth = 0
  ) => {
    if (query && !folderHasMatch(folder)) {
      return null;
    }

    // Default to collapsed unless opened or query active
    const isCollapsed = query ? false : (collapsedFolders[pathKey] !== undefined ? Boolean(collapsedFolders[pathKey]) : true);
    const isDragOver = dragOverFolderPath === pathKey;

    const visibleDrills = query
      ? (folder.drills || []).filter(isDrillMatch)
      : folder.drills || [];

    const totalFolderDrills =
      (folder.drills?.length || 0) +
      (folder.subfolders?.reduce((acc, sf) => acc + (sf.drills?.length || 0), 0) || 0);

    return (
      <div
        key={pathKey}
        className="border border-slate-800 rounded-3xl bg-slate-900/90 backdrop-blur-md shadow-xl overflow-hidden transition-all mb-4"
        style={{ marginLeft: depth > 0 ? `${depth * 16}px` : 0 }}
      >
        {/* Folder Header */}
        <div
          onDragOver={(e) => {
            if (userRole === 'admin') {
              e.preventDefault();
              e.stopPropagation();
              setDragOverFolderPath(pathKey);
            }
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (dragOverFolderPath === pathKey) setDragOverFolderPath(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverFolderPath(null);
            if (draggedDrill) {
              onMoveDrillToFolder(
                draggedDrill.sourcePath,
                draggedDrill.drillIndex,
                pathKey
              );
              setDraggedDrill(null);
            }
          }}
          onClick={() => onToggleFolder(pathKey)}
          className={`px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors border-b ${
            isDragOver
              ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-400/50'
              : isCollapsed
              ? 'bg-slate-950/80 hover:bg-slate-900 border-slate-800'
              : 'bg-slate-900/95 hover:bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isCollapsed ? (
              <Folder className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            ) : (
              <FolderOpen className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            )}
            <span className="font-black text-sm md:text-base text-slate-100 truncate tracking-tight">
              {folder.name}
            </span>
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
              {query ? `${visibleDrills.length} match` : `${totalFolderDrills} drills`}
            </span>
            <span className="text-slate-400 ml-1">
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </div>

          {/* Folder Action Controls */}
          {userRole === 'admin' && (
            <div
              className="flex items-center gap-1.5 print:hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onMoveFolder(pathKey, -1)}
                title="Move Folder Up"
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onMoveFolder(pathKey, 1)}
                title="Move Folder Down"
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAddSubfolder(pathKey)}
                title="Add Subfolder"
                className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3 h-3 text-indigo-400" />
                <span>Sub</span>
              </button>
              <button
                onClick={() => onAddDrill(pathKey)}
                title="Add Drill"
                className="px-2.5 py-1 text-[11px] font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Drill</span>
              </button>
              <button
                onClick={() => onRenameFolder(pathKey)}
                title="Rename Folder"
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteFolder(pathKey)}
                title="Delete Folder"
                className="p-1 hover:bg-rose-950/50 rounded-lg text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Folder Body (Subfolders & Drills) */}
        {!isCollapsed && (
          <div className="p-4 md:p-5 space-y-4 bg-slate-950/60">
            {/* Render Subfolders */}
            {folder.subfolders && folder.subfolders.length > 0 && (
              <div className="space-y-3">
                {folder.subfolders.map((sub, sIdx) =>
                  renderFolderNode(sub, `${pathKey}_${sIdx}`, depth + 1)
                )}
              </div>
            )}

            {/* Render Drills */}
            {visibleDrills && visibleDrills.length > 0 ? (
              <div className="space-y-2.5">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 text-[10.5px] font-black uppercase text-slate-500 px-3 pb-1 border-b border-slate-800">
                  <div className="col-span-12 md:col-span-3">Drill Name</div>
                  <div className="col-span-12 md:col-span-5">Setup &amp; Instructions</div>
                  <div className="col-span-12 md:col-span-2">Coaching Focus / Key</div>
                  <div className="col-span-12 md:col-span-2 text-right">Move / Action</div>
                </div>

                {visibleDrills.map((drill, dIdx) => {
                  const origIdx = (folder.drills || []).indexOf(drill);
                  const drillIndex = origIdx >= 0 ? origIdx : dIdx;

                  return (
                    <DrillRowItem
                      key={drill.id || `${pathKey}_drill_${drillIndex}`}
                      drill={drill}
                      pathKey={pathKey}
                      drillIdx={drillIndex}
                      userRole={userRole}
                      allFolders={allFolders}
                      onUpdateDrill={onUpdateDrill}
                      onDeleteDrill={onDeleteDrill}
                      onMoveDrillToFolder={onMoveDrillToFolder}
                      onDragStart={() =>
                        setDraggedDrill({ sourcePath: pathKey, drillIndex })
                      }
                    />
                  );
                })}
              </div>
            ) : (
              !folder.subfolders?.length && (
                <div className="text-center py-6 text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-2xl">
                  {query
                    ? 'No drills match your search in this folder.'
                    : 'Click "+ Drill" to add exercises to this folder.'}
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Segmented Switcher (Drill Library vs Chalkboard Diagrams) */}
      {onNavigateToWhiteboard && (
        <div className="flex items-center justify-between gap-1.5 p-1.5 bg-slate-950/90 border border-slate-800 rounded-2xl print:hidden shadow-lg">
          <button
            type="button"
            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
          >
            <Dumbbell className="w-4 h-4" />
            <span>Drill Library ({totalDrillsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToWhiteboard()}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
          >
            <PenTool className="w-4 h-4 text-blue-400" />
            <span>Chalkboard Diagrams</span>
          </button>
        </div>
      )}

      {/* Top Action & Navigation Toolbar */}
      <div className="bg-slate-950/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl p-3.5 sm:p-5 print:hidden space-y-3 sm:space-y-4">
        {/* Row 1: Header Title & Main Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-black shadow-inner shrink-0">
              <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-lg text-slate-100 tracking-tight truncate">
                  Master Drill Library
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10.5px] font-black">
                  {totalDrillsCount} Drills
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Varsity football drills organized for fast sideline recall &amp; practice install
              </p>
            </div>
          </div>

          {/* Quick Controls: Browse Drawer, Density Toggle, Tree Mode, Admin Add */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Mobile "Browse Positions Drawer" Button */}
            <button
              type="button"
              onClick={() => setIsCategoryDrawerOpen(true)}
              className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Open full category and position browser"
            >
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Positions ({drawerCategories.length})</span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            {/* Compact vs Detailed Toggle for Cards */}
            {viewMode === 'cards' && (
              <button
                type="button"
                onClick={() => setIsCompactCardMode(!isCompactCardMode)}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
                  isCompactCardMode
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title={isCompactCardMode ? 'Switch to detailed card view' : 'Switch to compact sideline view'}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{isCompactCardMode ? 'Compact' : 'Detailed'}</span>
              </button>
            )}

            {/* View Mode Selector: Cards vs Tree */}
            <div className="bg-slate-900 p-1 rounded-2xl border border-slate-800 hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'tree'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Tree</span>
              </button>
            </div>

            {/* Quick Add Top Folder */}
            {userRole === 'admin' && (
              <button
                onClick={onAddTopFolder}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title="Add New Drill Category"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Category</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search Bar & Tree Controls */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search drills, cues (e.g. 'Tackle', 'Donut', 'Rip', 'Drop')..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 transition-all shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tree Mode Controls */}
            {viewMode === 'tree' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleExpandAll}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  title="Expand all categories"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden xs:inline">Expand All</span>
                </button>
                <button
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  title="Collapse all categories"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden xs:inline">Collapse All</span>
                </button>
              </div>
            )}

            {/* Cards Mode Controls: Expand/Collapse All Sections */}
            {viewMode === 'cards' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExpandAllCardSections}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  title="Expand all drill sections"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden xs:inline">Expand All</span>
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAllCardSections}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  title="Collapse all drill sections"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden xs:inline">Collapse All</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompactCardMode((prev) => !prev)}
                  className={`px-2.5 py-1.5 border text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer ${
                    isCompactCardMode
                      ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                  }`}
                  title="Toggle card detail level"
                >
                  <span>{isCompactCardMode ? 'Compact' : 'Detailed'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Mobile Category Strip (Touch-Friendly Large Buttons) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSubcategory('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>🏈</span>
              <span>All Drills</span>
              <span className={`text-[10px] ${selectedCategory === 'all' ? 'text-indigo-200 font-black' : 'text-slate-500'}`}>
                ({flattenedDrillList.length})
              </span>
            </button>

            {drawerCategories.map((cat) => {
              const count = flattenedDrillList.filter((d) => isDrillCategoryMatch(d, cat.name)).length;
              const isSelected = selectedCategory === cat.name;

              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setSelectedSubcategory('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm font-black'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-indigo-200 font-black' : 'text-slate-500'}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Subcategories (Positions / Sub-groups) for Selected Category */}
          {subcategoryOptions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pl-1 border-l-2 border-indigo-500/50 bg-slate-900/30 rounded-r-xl">
              <button
                type="button"
                onClick={() => setSelectedSubcategory('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                  selectedSubcategory === 'all'
                    ? 'bg-indigo-600/90 text-white border-indigo-500 shadow-xs'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                All in {selectedCategory} ({flattenedDrillList.filter((d) => isDrillCategoryMatch(d, selectedCategory)).length})
              </button>
              {subcategoryOptions.map((sub) => {
                const subCount = flattenedDrillList.filter(
                  (d) =>
                    isDrillCategoryMatch(d, selectedCategory) &&
                    (d.folderName === sub || d.parentCategories.includes(sub))
                ).length;
                const isSubSelected = selectedSubcategory === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubcategory(sub)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer shrink-0 flex items-center gap-1 ${
                      isSubSelected
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-xs font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>{sub}</span>
                    <span className="text-[10px] opacity-80">({subCount})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Category & Position Drawer Modal */}
      <DrillCategoryDrawer
        isOpen={isCategoryDrawerOpen}
        onClose={() => setIsCategoryDrawerOpen(false)}
        categories={drawerCategories}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        onSelectCategory={(cat, sub) => {
          setSelectedCategory(cat);
          setSelectedSubcategory(sub || 'all');
        }}
        flattenedDrills={flattenedDrillList}
        onNavigateToWhiteboard={onNavigateToWhiteboard ? () => onNavigateToWhiteboard() : undefined}
      />

      {/* =========================================================================
          MODE 1: MOBILE SIDELINE CARD VIEW (Optimized for Touch & Handheld Devices)
          ========================================================================= */}
      {viewMode === 'cards' && (
        <div className="space-y-3">
          {/* Active Filter Header */}
          <div className="flex items-center justify-between px-1">
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 flex-wrap">
              <span>Showing {filteredCardDrills.length} Drills</span>
              {selectedCategory !== 'all' && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] normal-case font-bold">
                  {selectedCategory}
                </span>
              )}
              {selectedSubcategory !== 'all' && (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] normal-case font-bold">
                  {selectedSubcategory}
                </span>
              )}
            </div>

            {/* Clear filter shortcut if active */}
            {(selectedCategory !== 'all' || selectedSubcategory !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedSubcategory('all');
                  setSearchTerm('');
                }}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Drill Cards by Category Accordions (Collapsed by default so all sections are not expanded) */}
          <div className="space-y-4">
            {groupedCardDrills.map((group) => {
              const isSectionCollapsed = query
                ? false
                : selectedCategory !== 'all'
                ? false
                : (collapsedCardSections[group.category] !== undefined
                  ? collapsedCardSections[group.category]
                  : true);

              return (
                <div
                  key={group.category}
                  className="border border-slate-800/90 rounded-3xl bg-slate-900/70 shadow-lg overflow-hidden transition-all"
                >
                  {/* Category Section Header Button */}
                  <button
                    type="button"
                    onClick={() => toggleCardSection(group.category)}
                    className="w-full px-5 py-3.5 flex items-center justify-between gap-3 bg-slate-950/80 hover:bg-slate-900 border-b border-slate-800/80 transition-colors text-left cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">{group.icon}</span>
                      <h2 className="font-black text-sm sm:text-base text-slate-100 tracking-tight truncate">
                        {group.category}
                      </h2>
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 shrink-0">
                        {group.drills.length} {group.drills.length === 1 ? 'drill' : 'drills'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 shrink-0">
                      <span className="text-xs font-semibold hidden sm:inline text-slate-400">
                        {isSectionCollapsed ? 'Click to view' : 'Click to collapse'}
                      </span>
                      {isSectionCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-indigo-400" />
                      )}
                    </div>
                  </button>

                  {/* Section Drill Cards */}
                  {!isSectionCollapsed && (
                    <div className="p-3.5 sm:p-4 bg-slate-950/40">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {group.drills.map(({ drill, folderName, topCategory, pathKey, drillIdx }) => {
                          const cardId = `${pathKey}_${drillIdx}`;
                          const isCopied = copiedDrillId === cardId;
                          const isExpanded = !isCompactCardMode || Boolean(expandedCardIds[cardId]);

                          return (
                            <div
                              key={drill.id || cardId}
                              className="bg-slate-900/95 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between gap-2.5 transition-all group"
                            >
                              <div className="space-y-2">
                                {/* Card Header: Title + Category Badge + Action Buttons */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400/90 block mb-0.5 truncate">
                                      {topCategory && topCategory !== folderName ? `${topCategory} • ${folderName}` : folderName}
                                    </span>
                                    <h3 className="font-black text-sm text-slate-100 group-hover:text-indigo-300 transition-colors leading-snug">
                                      {drill.name || 'Untitled Drill'}
                                    </h3>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {onNavigateToWhiteboard && (
                                      <button
                                        type="button"
                                        onClick={() => onNavigateToWhiteboard(drill.id, topCategory)}
                                        title="Open in Tactical Chalkboard"
                                        className="p-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-300 hover:text-white transition-all cursor-pointer"
                                      >
                                        <PenTool className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleCopyDrill(drill, folderName, cardId)}
                                      title="Copy Drill to Clipboard"
                                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 transition-all cursor-pointer"
                                    >
                                      {isCopied ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Setup & Instructions (Collapsible in compact mode) */}
                                {drill.desc && (
                                  <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        📋 Setup &amp; Execution:
                                      </span>
                                      {isCompactCardMode && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedCardIds((prev) => ({
                                              ...prev,
                                              [cardId]: !prev[cardId],
                                            }))
                                          }
                                          className="text-[10.5px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                                        >
                                          <span>{isExpanded ? 'Hide' : 'Details'}</span>
                                          {isExpanded ? (
                                            <ChevronUp className="w-3 h-3" />
                                          ) : (
                                            <ChevronDown className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                    {isExpanded && (
                                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap mt-1">
                                        {drill.desc}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Key Coaching Cues */}
                                {drill.key && (
                                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-2.5">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                      <Zap className="w-3 h-3 text-emerald-400" />
                                      <span>Key Coaching Focus:</span>
                                    </span>
                                    <p className="text-xs font-bold text-emerald-200/90 leading-relaxed">
                                      {drill.key}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Card Footer Actions (Admin Controls) */}
                              {userRole === 'admin' && (
                                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                  <select
                                    value={pathKey}
                                    onChange={(e) =>
                                      onMoveDrillToFolder(pathKey, drillIdx, e.target.value)
                                    }
                                    className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 rounded-lg px-2 py-1 max-w-[140px] truncate focus:outline-none focus:border-indigo-400"
                                    title="Move to category"
                                  >
                                    {allFolders.map((f) => (
                                      <option key={f.path} value={f.path}>
                                        {f.name}
                                      </option>
                                    ))}
                                  </select>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onDeleteDrill(pathKey, drillIdx)}
                                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                      title="Delete Drill"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredCardDrills.length === 0 && (
            <div className="text-center py-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-6">
              <Dumbbell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-300">
                No drills found matching "{searchTerm}"
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Try searching for another keyword or select "All Categories".
              </p>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODE 2: MASTER FOLDER TREE VIEW (For Deep Playbook Organizing & Structuring)
          ========================================================================= */}
      {viewMode === 'tree' && (
        <div className="space-y-4">
          {selectedCategory !== 'all' && (
            <div className="flex items-center justify-between bg-slate-900/90 border border-indigo-500/30 rounded-xl px-3.5 py-2 text-xs">
              <span className="text-slate-300 font-bold">
                Filtering tree by: <span className="text-indigo-400 font-extrabold">{selectedCategory}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedSubcategory('all');
                }}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Show All Categories
              </button>
            </div>
          )}
          {cascadingDrills
            .filter((folder) => {
              if (selectedCategory === 'all') return true;
              if (folder.name === selectedCategory) return true;
              const fClean = cleanCategoryStr(folder.name);
              const sClean = cleanCategoryStr(selectedCategory);
              if (fClean === sClean) return true;
              if (sClean.includes('offens') && fClean.includes('offens')) return true;
              if (sClean.includes('defens') && fClean.includes('defens')) return true;
              if (sClean.includes('special') && fClean.includes('special')) return true;
              if (sClean.includes('warm') && (fClean.includes('warm') || fClean.includes('agility'))) return true;
              if (sClean.length >= 3 && (fClean.includes(sClean) || sClean.includes(fClean))) return true;
              return false;
            })
            .map((folder) => {
              const origIdx = cascadingDrills.indexOf(folder);
              return renderFolderNode(folder, String(origIdx >= 0 ? origIdx : 0), 0);
            })}
        </div>
      )}
    </div>
  );
};
