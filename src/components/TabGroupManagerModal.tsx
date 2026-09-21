import React, { useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Check,
  FolderPlus,
  Layers,
  Sparkles,
  Smartphone,
  Calendar,
  Zap,
  ClipboardList,
  Watch,
  Dumbbell,
  FileSpreadsheet,
  BookOpen,
  Users,
  Star,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CustomTabGroup, UnitType, UserRole } from '../types';
import { DEFAULT_NAV_TABS, NavTabItem } from './NavigationTabs';

interface TabGroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customGroups: CustomTabGroup[];
  onSaveCustomGroups: (groups: CustomTabGroup[], newTabOrder?: string[]) => void;
  tabOrder: string[];
  onSaveTabOrder: (order: string[]) => void;
  defaultScreen?: UnitType;
  userRole: UserRole;
  showCustomTabsOnMainBar?: boolean;
  onToggleShowCustomTabsOnMainBar?: () => void;
}

const EMOJI_OPTIONS = [
  '🏈', '📋', '📅', '⌚', '📊', '⚡', '🏋️', '📖', '👥', 
  '🏆', '🎯', '🔥', '⭐', '🛡️', '⚙️', '🚀', '💡', '🏷️', 
  '📁', '👟', '⏱️', '🗂️', '🥇', '🧢', '🏟️'
];

export const TabGroupManagerModal: React.FC<TabGroupManagerModalProps> = ({
  isOpen,
  onClose,
  customGroups,
  onSaveCustomGroups,
  tabOrder,
  onSaveTabOrder,
  defaultScreen,
  userRole,
  showCustomTabsOnMainBar,
  onToggleShowCustomTabsOnMainBar,
}) => {
  const [activeView, setActiveView] = useState<'groups' | 'order'>('groups');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Group Form State
  const [groupLabel, setGroupLabel] = useState('');
  const [groupIcon, setGroupIcon] = useState('📁');
  const [selectedTabs, setSelectedTabs] = useState<UnitType[]>([]);
  const [groupHidden, setGroupHidden] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const tabMap = new Map(DEFAULT_NAV_TABS.map((t) => [t.id, t]));

  // Open form for creating new group
  const handleStartCreate = () => {
    setEditingGroupId(null);
    setGroupLabel('');
    setGroupIcon('📁');
    setSelectedTabs([]);
    setGroupHidden(false);
    setErrorMsg('');
    setIsCreatingGroup(true);
  };

  // Open form for editing existing group
  const handleStartEdit = (group: CustomTabGroup) => {
    setEditingGroupId(group.id);
    setGroupLabel(group.label);
    setGroupIcon(group.icon || '📁');
    setSelectedTabs([...group.tabIds]);
    setGroupHidden(Boolean(group.hidden));
    setErrorMsg('');
    setIsCreatingGroup(true);
  };

  // Toggle hiding a folder from top navigation
  const handleToggleHideGroup = (groupId: string) => {
    const updatedGroups = customGroups.map((g) => {
      if (g.id === groupId) {
        return { ...g, hidden: !g.hidden };
      }
      return g;
    });
    onSaveCustomGroups(updatedGroups);
  };

  const handleToggleTabSelect = (tabId: UnitType) => {
    setSelectedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]
    );
  };

  const handleSaveGroupForm = () => {
    if (!groupLabel.trim()) {
      setErrorMsg('Please enter a tab group name.');
      return;
    }
    if (selectedTabs.length === 0) {
      setErrorMsg('Please select at least one main tab to place inside this group.');
      return;
    }

    if (editingGroupId) {
      // Update existing group
      const updatedGroups = customGroups.map((g) => {
        if (g.id === editingGroupId) {
          return {
            ...g,
            label: groupLabel.trim(),
            icon: groupIcon,
            tabIds: selectedTabs,
            hidden: groupHidden,
          };
        }
        // Remove selected tabs from other groups to avoid duplication
        return {
          ...g,
          tabIds: g.tabIds.filter((t) => !selectedTabs.includes(t) || g.id === editingGroupId),
        };
      }).filter((g) => g.tabIds.length > 0);

      onSaveCustomGroups(updatedGroups);
    } else {
      // Create new group
      const newGroupId = `group_${Date.now()}`;
      const newGroup: CustomTabGroup = {
        id: newGroupId,
        label: groupLabel.trim(),
        icon: groupIcon,
        tabIds: selectedTabs,
        hidden: groupHidden,
      };

      // Remove selected tabs from other groups
      const cleanedGroups = customGroups.map((g) => ({
        ...g,
        tabIds: g.tabIds.filter((t) => !selectedTabs.includes(t)),
      })).filter((g) => g.tabIds.length > 0);

      const nextGroups = [...cleanedGroups, newGroup];

      // Add new group ID to top tabOrder if not present
      const nextOrder = [...tabOrder.filter((id) => !selectedTabs.includes(id as UnitType)), newGroupId];
      onSaveCustomGroups(nextGroups, nextOrder);
    }

    setIsCreatingGroup(false);
    setEditingGroupId(null);
    setGroupHidden(false);
    setErrorMsg('');
  };

  const handleDeleteGroup = (groupId: string) => {
    const targetGroup = customGroups.find((g) => g.id === groupId);
    const updatedGroups = customGroups.filter((g) => g.id !== groupId);

    // Return the released tabs back into the tabOrder in place of the deleted group
    let updatedOrder = [...tabOrder];
    const groupIdx = updatedOrder.indexOf(groupId);
    if (groupIdx !== -1 && targetGroup) {
      updatedOrder.splice(groupIdx, 1, ...targetGroup.tabIds);
    } else {
      updatedOrder = updatedOrder.filter((id) => id !== groupId);
    }

    onSaveCustomGroups(updatedGroups, updatedOrder);
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tabOrder.length) return;
    const newOrder = [...tabOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    onSaveTabOrder(newOrder);
  };

  // Quick Presets
  const handleApplyPreset = (presetType: 'gameday_practice' | 'reset_flat') => {
    if (presetType === 'gameday_practice') {
      const gamedayGroup: CustomTabGroup = {
        id: 'group_gameday',
        label: 'Game Day Ops',
        icon: '🏈',
        tabIds: ['schedule', 'wristband', 'scouting'],
      };
      const practiceGroup: CustomTabGroup = {
        id: 'group_practice_pack',
        label: 'Practice & Install',
        icon: '📋',
        tabIds: ['practice', 'drills', 'guide'],
      };

      const presetGroups = [gamedayGroup, practiceGroup];
      const presetOrder = [
        'mobile_hub',
        'depth_chart',
        'group_gameday',
        'group_practice_pack',
        'compliance',
        'users',
      ];
      onSaveCustomGroups(presetGroups, presetOrder);
    } else if (presetType === 'reset_flat') {
      const defaultIds = DEFAULT_NAV_TABS.map((t) => t.id);
      onSaveCustomGroups([], defaultIds);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                Custom Tabs &amp; Sub-Menus Manager
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create new parent tabs, nest main tabs into custom sub-menus, and reorder the top bar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Preferences Banner: Hide/Show Custom Tabs button on main line */}
        {onToggleShowCustomTabsOnMainBar && (
          <div className="px-5 py-2.5 bg-slate-100/80 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                  Show &apos;+ Custom Tabs&apos; on Main Tab Bar
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  Default is hidden to keep the top navigation bar clean and compact
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleShowCustomTabsOnMainBar}
              className={`px-3 py-1 rounded-xl font-black text-xs border transition-all cursor-pointer shrink-0 ${
                showCustomTabsOnMainBar
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {showCustomTabsOnMainBar ? 'Visible on Main Bar' : 'Hidden (Default)'}
            </button>
          </div>
        )}

        {/* Tab Selector: Groups vs Reorder */}
        <div className="px-5 pt-3 pb-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveView('groups');
                setIsCreatingGroup(false);
              }}
              className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-t border-x ${
                activeView === 'groups'
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 border-b-2 border-b-indigo-600'
                  : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Tab Groups &amp; Sub-Menus ({customGroups.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('order');
                setIsCreatingGroup(false);
              }}
              className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border-t border-x ${
                activeView === 'order'
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 border-b-2 border-b-indigo-600'
                  : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Reorder Top Bar</span>
            </button>
          </div>

          {activeView === 'groups' && !isCreatingGroup && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="mb-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create New Tab Group</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[60vh] flex-1 bg-white dark:bg-slate-950">
          {/* VIEW 1: TAB GROUPS MANAGEMENT */}
          {activeView === 'groups' && (
            <>
              {/* Inline Group Creation / Editing Form */}
              {isCreatingGroup ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-500/50 space-y-4 shadow-sm dark:shadow-xl animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider flex items-center gap-1.5">
                      <FolderPlus className="w-4 h-4" />
                      <span>{editingGroupId ? 'Edit Tab Group' : 'Create New Tab Group'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsCreatingGroup(false)}
                      className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  {/* Group Name & Icon */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                        Tab Group Name:
                      </label>
                      <input
                        type="text"
                        value={groupLabel}
                        onChange={(e) => setGroupLabel(e.target.value)}
                        placeholder="e.g. Game Day Hub, Practice & Install, Field Command..."
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                        Icon / Emoji:
                      </label>
                      <div className="relative">
                        <select
                          value={groupIcon}
                          onChange={(e) => setGroupIcon(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          {EMOJI_OPTIONS.map((emoji) => (
                            <option key={emoji} value={emoji} className="bg-slate-900 text-base">
                              {emoji} {emoji}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tab Nesting Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-slate-400">
                        Select Main Tabs to Nest Inside This Sub-Menu:
                      </label>
                      <span className="text-[10px] text-indigo-400 font-bold">
                        {selectedTabs.length} Selected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {DEFAULT_NAV_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isChecked = selectedTabs.includes(tab.id);
                        const otherGroup = customGroups.find(
                          (g) => g.id !== editingGroupId && g.tabIds.includes(tab.id)
                        );

                        return (
                          <div
                            key={tab.id}
                            onClick={() => handleToggleTabSelect(tab.id)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-300 dark:border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500/30'
                                : 'bg-white dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className={`w-3.5 h-3.5 ${isChecked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                              <span className="text-xs font-bold truncate">{tab.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {otherGroup && !isChecked && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  In {otherGroup.label}
                                </span>
                              )}
                              <div
                                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                  isChecked
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Folder Visibility Preference */}
                  <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={groupHidden}
                      onChange={(e) => setGroupHidden(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {groupHidden ? (
                        <EyeOff className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>Hide this folder from main navigation line</span>
                    </div>
                  </label>

                  {/* Form Footer */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCreatingGroup(false)}
                      className="px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGroupForm}
                      className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingGroupId ? 'Update Tab Group' : 'Save & Create Tab Group'}</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Existing Groups List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    Configured Custom Tab Groups ({customGroups.length})
                  </h4>
                  {customGroups.length === 0 && !isCreatingGroup && (
                    <span className="text-xs text-slate-500 italic">No custom tab groups created yet</span>
                  )}
                </div>

                {customGroups.length > 0 ? (
                  <div className="space-y-2.5">
                    {customGroups.map((group) => {
                      const memberTabs = group.tabIds
                        .map((id) => tabMap.get(id))
                        .filter((t): t is NavTabItem => Boolean(t));

                      return (
                        <div
                          key={group.id}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-lg select-none">{group.icon || '📁'}</span>
                              <div>
                                <h5 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                                  <span>{group.label}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono border border-indigo-200 dark:border-indigo-500/30 font-bold">
                                    {group.tabIds.length} sub-tabs
                                  </span>
                                  {group.hidden && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                                      <EyeOff className="w-2.5 h-2.5" />
                                      <span>Hidden from Nav</span>
                                    </span>
                                  )}
                                </h5>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {group.hidden
                                    ? 'Folder is hidden from the main navigation line.'
                                    : `Clicking this tab creates a sub-menu with ${group.tabIds.length} nested tools`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleHideGroup(group.id)}
                                title={group.hidden ? 'Show folder in navigation bar' : 'Hide folder from navigation bar'}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                                  group.hidden
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 dark:hover:bg-amber-500/30'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:text-white'
                                }`}
                              >
                                {group.hidden ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                    <span>Hidden</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Visible</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(group)}
                                title="Edit Tab Group"
                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGroup(group.id)}
                                title="Delete Tab Group (releases nested tabs back to top bar)"
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Member Tabs Pills */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {memberTabs.map((tab) => {
                              const Icon = tab.icon;
                              return (
                                <span
                                  key={tab.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold shadow-2xs"
                                >
                                  <Icon className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                  <span>{tab.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : !isCreatingGroup ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                    <FolderPlus className="w-8 h-8 text-indigo-400/60 mx-auto" />
                    <p className="text-xs text-slate-800 dark:text-slate-300 font-bold">
                      No custom tab groups yet!
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Group related main tabs (like Schedule, Wristband, &amp; Scouting) into a single top tab with an interactive sub-menu.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleStartCreate}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Your First Tab Group</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Quick Presets */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    ⚡ Quick Navigation Presets:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('gameday_practice')}
                      className="p-3 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 text-left transition-all cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 group-hover:text-indigo-900 dark:group-hover:text-indigo-200">
                          🏈 Game Day &amp; Practice Packs
                        </span>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Creates "Game Day Ops" (Schedule/Wristband/Scouting) + "Practice &amp; Install"
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyPreset('reset_flat')}
                      className="p-3 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-left transition-all cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white">
                          🔄 Flat Standard Tabs (No Groups)
                        </span>
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Restores standard flat top tabs with individual tool buttons
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* VIEW 2: REORDER TOP BAR */}
          {activeView === 'order' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Top Bar Items Sequence ({tabOrder.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  Use up/down arrows to position items
                </span>
              </div>

              <div className="space-y-2">
                {tabOrder.map((id, index) => {
                  const customGroup = customGroups.find((g) => g.id === id);
                  const standardTab = tabMap.get(id as UnitType);
                  if (!customGroup && !standardTab) return null;

                  const isFirst = index === 0;
                  const isLast = index === tabOrder.length - 1;
                  const isDefault =
                    (defaultScreen || 'schedule') === id ||
                    (defaultScreen === 'offense' && id === 'depth_chart');

                  return (
                    <div
                      key={id}
                      className={`flex items-center justify-between p-3 rounded-2xl transition-all border ${
                        isDefault
                          ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-500/40 shadow-inner'
                          : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono text-xs font-black flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        {customGroup ? (
                          <>
                            <span className="text-base select-none shrink-0">{customGroup.icon || '📁'}</span>
                            <div className="min-w-0">
                              <span className="text-xs font-black text-indigo-800 dark:text-indigo-200 truncate block">
                                {customGroup.label}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                Tab Group ({customGroup.tabIds.length} sub-tabs)
                              </span>
                            </div>
                          </>
                        ) : standardTab ? (
                          <>
                            <standardTab.icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                              {standardTab.label}
                            </span>
                          </>
                        ) : null}

                        {isDefault && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 text-[9px] font-bold shrink-0">
                            ★ Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'up')}
                          disabled={isFirst}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-25 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                          title="Move Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'down')}
                          disabled={isLast}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-25 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                          title="Move Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const defaultIds = DEFAULT_NAV_TABS.map((t) => t.id);
                    onSaveTabOrder(defaultIds);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Top Bar Order</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Done &amp; Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
