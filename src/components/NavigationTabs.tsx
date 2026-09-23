import React, { useState } from 'react';
import {
  Shield,
  Zap,
  Target,
  Swords,
  Watch,
  FileSpreadsheet,
  BookOpen,
  Dumbbell,
  ClipboardList,
  Users,
  Calendar,
  Settings,
  ChevronDown,
  Sparkles,
  Smartphone,
  FolderPlus,
  Layers,
  ChevronRight,
  SlidersHorizontal,
  PenTool,
  Activity,
  Home as HomeIcon,
} from 'lucide-react';
import { CustomTabGroup, UnitType, DepthSubUnit, UserRole } from '../types';
import { safeJSONParse, safeJSONSet } from '../services/storageService';
import { TabGroupManagerModal } from './TabGroupManagerModal';

interface NavigationTabsProps {
  activeUnit: UnitType;
  onSelectUnit: (unit: UnitType) => void;
  userRole: UserRole;
  depthSubUnit?: DepthSubUnit;
  onSelectDepthSubUnit?: (subUnit: DepthSubUnit) => void;
  defaultScreen?: UnitType;
  onSetDefaultScreen?: (screen: UnitType) => void;
  onOpenPreferencesModal?: () => void;
  customGroups?: CustomTabGroup[];
  onUpdateCustomGroups?: (groups: CustomTabGroup[]) => void;
}

export interface NavTabItem {
  id: UnitType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

export const DEFAULT_NAV_TABS: NavTabItem[] = [
  { id: 'home', label: '🏠 Home', icon: HomeIcon },
  { id: 'mobile_hub', label: '📱 Mobile HUD', icon: Smartphone },
  { id: 'game_day', label: '🏆 Game Day Hub', icon: Swords },
  { id: 'hudl_scout', label: '📊 Hudl Scout', icon: Target },
  { id: 'schedule', label: '📅 Schedule', icon: Calendar },
  { id: 'compliance', label: '⚡ Compliance & Hours', icon: Zap },
  { id: 'ppr', label: '📊 PFF', icon: Activity },
  { id: 'depth_chart', label: '📋 Depth Chart', icon: ClipboardList },
  { id: 'practice', label: '📋 Practice Plan', icon: ClipboardList },
  { id: 'drills', label: '🏋️ Drill Library', icon: Dumbbell },
  { id: 'guide', label: '📖 Playbooks & Guides', icon: BookOpen },
  { id: 'whiteboard', label: '🖍️ Whiteboard Playbook', icon: PenTool },
  { id: 'users', label: '👥 Staff & Access', icon: Users, adminOnly: true },
];

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeUnit,
  onSelectUnit,
  userRole,
  depthSubUnit = 'offense',
  onSelectDepthSubUnit,
  defaultScreen,
  onSetDefaultScreen,
  onOpenPreferencesModal,
  customGroups: propCustomGroups,
  onUpdateCustomGroups,
}) => {
  // Custom Tab Groups state (loaded from props or localStorage)
  const [customGroups, setCustomGroups] = useState<CustomTabGroup[]>(() => {
    if (propCustomGroups && Array.isArray(propCustomGroups)) return propCustomGroups;
    return safeJSONParse<CustomTabGroup[]>('footballCustomTabGroups', []);
  });

  // Controls whether "+ Custom Tabs" button is visible on the main tab bar (defaults to false to keep line clean)
  const [showCustomTabsOnMainBar, setShowCustomTabsOnMainBar] = useState<boolean>(() => {
    return safeJSONParse<boolean>('footballShowCustomTabsOnMainBar', false);
  });

  const handleToggleShowCustomTabsOnMainBar = () => {
    setShowCustomTabsOnMainBar((prev) => {
      const next = !prev;
      safeJSONSet('footballShowCustomTabsOnMainBar', next);
      return next;
    });
  };

  // Top Bar Tab Order (contains standalone tab IDs and custom group IDs)
  const [tabOrder, setTabOrder] = useState<string[]>(() => {
    const saved = safeJSONParse<string[]>('footballTopTabOrder', []);
    const removedTabs = ['wristband', 'call_sheet', 'scouting'];
    const validDefaultIds = DEFAULT_NAV_TABS.map((t) => t.id);

    if (saved && Array.isArray(saved) && saved.length > 0) {
      // Clean up removed tabs from existing saved localStorage
      const filtered = saved.filter((id) => !removedTabs.includes(id));
      const missing = validDefaultIds.filter((id) => !filtered.includes(id));
      if (missing.length > 0) {
        return [...missing, ...filtered];
      }
      return filtered;
    }
    return validDefaultIds;
  });

  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  // Sync tab order changes
  const handleSaveTabOrder = (newOrder: string[]) => {
    setTabOrder(newOrder);
    safeJSONSet('footballTopTabOrder', newOrder);
  };

  // Sync custom groups changes
  const handleSaveCustomGroups = (newGroups: CustomTabGroup[], newTabOrder?: string[]) => {
    setCustomGroups(newGroups);
    safeJSONSet('footballCustomTabGroups', newGroups);
    if (onUpdateCustomGroups) {
      onUpdateCustomGroups(newGroups);
    }

    if (newTabOrder) {
      handleSaveTabOrder(newTabOrder);
    } else {
      // Clean up tabOrder so it includes valid custom groups and unassigned standalone tabs
      const nestedTabIds = new Set(newGroups.flatMap((g) => g.tabIds));
      const groupIds = new Set(newGroups.map((g) => g.id));

      let updatedOrder = tabOrder.filter((id) => {
        if (groupIds.has(id)) return true;
        if (nestedTabIds.has(id as UnitType)) return false; // Hide standalone if it's nested
        return DEFAULT_NAV_TABS.some((t) => t.id === id);
      });

      // Ensure newly created groups are in tabOrder
      newGroups.forEach((g) => {
        if (!updatedOrder.includes(g.id)) {
          updatedOrder.push(g.id);
        }
      });

      // Ensure unassigned standalone tabs are present
      DEFAULT_NAV_TABS.forEach((t) => {
        if (!nestedTabIds.has(t.id) && !updatedOrder.includes(t.id)) {
          updatedOrder.push(t.id);
        }
      });

      handleSaveTabOrder(updatedOrder);
    }
  };

  const tabMap = new Map(DEFAULT_NAV_TABS.map((t) => [t.id, t]));

  // Find all tabs currently nested in any custom group
  const allNestedTabIds = new Set(customGroups.flatMap((g) => g.tabIds));

  // Find if active unit is inside a custom group
  const activeGroup = customGroups.find((g) => {
    if (g.tabIds.includes(activeUnit)) return true;
    // If activeUnit is a depth chart sub-unit, check if depth_chart is in group
    if (
      ['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'].includes(activeUnit) &&
      g.tabIds.includes('depth_chart')
    ) {
      return true;
    }
    return false;
  });

  // Check if depth chart is active
  const isDepthChartActive =
    activeUnit === 'depth_chart' ||
    ['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'].includes(activeUnit);

  const handleTopTabClick = (tabOrGroupId: string) => {
    // 1. Check if clicked item is a Custom Tab Group
    const matchedGroup = customGroups.find((g) => g.id === tabOrGroupId);
    if (matchedGroup) {
      const firstTab = matchedGroup.defaultTabId || matchedGroup.tabIds[0] || 'schedule';
      if (firstTab === 'depth_chart') {
        if (onSelectDepthSubUnit) {
          onSelectDepthSubUnit(depthSubUnit || 'offense');
        }
        onSelectUnit(depthSubUnit || 'offense');
      } else {
        onSelectUnit(firstTab);
      }
      return;
    }

    // 2. Standalone Tab Click
    const tabId = tabOrGroupId as UnitType;
    if (tabId === 'depth_chart') {
      if (['offense', 'defense', 'st', 'groups', 'scrimmage', 'practice_live'].includes(activeUnit)) {
        // already in depth chart unit
      } else {
        onSelectUnit(depthSubUnit || 'offense');
      }
    } else {
      onSelectUnit(tabId);
    }
  };

  const handleSubTabClick = (tabId: UnitType) => {
    if (tabId === 'depth_chart') {
      onSelectUnit(depthSubUnit || 'offense');
    } else {
      onSelectUnit(tabId);
    }
  };

  // Build rendered top bar items
  const visibleTopBarItems = tabOrder
    .map((id) => {
      const customGroup = customGroups.find((g) => g.id === id);
      if (customGroup) {
        // If this custom folder is marked as hidden, do NOT display it on the navigation bar
        if (customGroup.hidden) return null;
        return {
          type: 'group' as const,
          id: customGroup.id,
          label: customGroup.label,
          icon: customGroup.icon || '📁',
          tabIds: customGroup.tabIds,
          group: customGroup,
        };
      }
      const standardTab = tabMap.get(id as UnitType);
      if (standardTab && !allNestedTabIds.has(standardTab.id)) {
        if (standardTab.adminOnly && userRole !== 'admin') return null;
        return {
          type: 'tab' as const,
          id: standardTab.id,
          label: standardTab.label,
          icon: standardTab.icon,
          tab: standardTab,
        };
      }
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      {/* 1. TOP STICKY NAVIGATION BAR */}
      <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 md:top-[108px] z-30 shadow-xs dark:shadow-md print:hidden">
        <div className="max-w-[1700px] mx-auto px-3 md:px-4 py-1.5 md:py-2 flex items-center justify-between gap-2 md:gap-3">
          {/* Scrollable Nav Tabs List */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar items-center py-0.5 flex-1 min-w-0">
            {visibleTopBarItems.map((item) => {
              if (item.type === 'group') {
                const isGroupActive = activeGroup?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTopTabClick(item.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black tracking-tight whitespace-nowrap transition-all select-none border active:scale-95 cursor-pointer ${
                      isGroupActive
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black shadow-lg shadow-indigo-600/30 border-indigo-400 ring-1 ring-indigo-400/40'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm select-none">{item.icon}</span>
                    <span>{item.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isGroupActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {item.tabIds.length}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        isGroupActive ? 'rotate-180 text-white' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                  </button>
                );
              }

              // Standalone standard tab
              const Icon = item.icon;
              const isActive =
                item.id === 'depth_chart' ? isDepthChartActive : activeUnit === item.id;
              const isDefaultTab =
                (defaultScreen || 'schedule') === item.id ||
                (defaultScreen === 'offense' && item.id === 'depth_chart');

              return (
                <button
                  key={item.id}
                  onClick={() => handleTopTabClick(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black tracking-tight whitespace-nowrap transition-all select-none border active:scale-95 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black shadow-lg shadow-indigo-600/30 border-indigo-400 ring-1 ring-indigo-400/40'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-white stroke-[2.5]' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                  {isDefaultTab && (
                    <span
                      title="⭐ Default Landing Screen"
                      className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-400/30'
                      }`}
                    >
                      ★
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* "+ New Tab Group / Manage Tabs" Button - Hidden by default on main tab line */}
          {showCustomTabsOnMainBar ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsManagerModalOpen(true)}
                title="Create new tab groups, nest tabs into sub-menus, and reorder navigation"
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden lg:inline">+ Custom Tabs</span>
                <span className="lg:hidden">Tabs</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center shrink-0">
              <button
                onClick={() => setIsManagerModalOpen(true)}
                title="Manage custom tab folders, tab order, and navigation preferences"
                className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. DYNAMIC SUB-NAVIGATION BAR (For Active Custom Tab Groups) */}
      {activeGroup && (
        <div className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800/90 px-4 py-2 sticky top-[154px] z-25 shadow-xs dark:shadow-md print:hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="max-w-[1700px] mx-auto flex items-center gap-2.5 overflow-x-auto no-scrollbar">
            <span className="px-2.5 py-1 text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider flex items-center gap-1.5 shrink-0 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-200 dark:border-indigo-500/25">
              <span>{activeGroup.icon || '📁'}</span>
              <span>{activeGroup.label} Sub-Menu:</span>
            </span>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {activeGroup.tabIds.map((childTabId) => {
                const tabInfo = tabMap.get(childTabId);
                if (!tabInfo) return null;
                const Icon = tabInfo.icon;
                const isChildActive =
                  childTabId === 'depth_chart'
                    ? isDepthChartActive
                    : activeUnit === childTabId;

                return (
                  <button
                    key={childTabId}
                    onClick={() => handleSubTabClick(childTabId)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap select-none active:scale-95 cursor-pointer ${
                      isChildActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/40'
                        : 'text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
                    <span>{tabInfo.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB GROUP & NAVIGATION MANAGER MODAL */}
      <TabGroupManagerModal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        customGroups={customGroups}
        onSaveCustomGroups={handleSaveCustomGroups}
        tabOrder={tabOrder}
        onSaveTabOrder={handleSaveTabOrder}
        defaultScreen={defaultScreen}
        userRole={userRole}
        showCustomTabsOnMainBar={showCustomTabsOnMainBar}
        onToggleShowCustomTabsOnMainBar={handleToggleShowCustomTabsOnMainBar}
      />
    </>
  );
};
