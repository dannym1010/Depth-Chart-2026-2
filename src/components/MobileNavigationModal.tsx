import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Swords,
  Layers,
  PenTool,
  Calendar,
  ClipboardList,
  Watch,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Shield,
  Zap,
  Users,
  Dumbbell,
  BookOpen,
  Smartphone,
  ChevronRight,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { UnitType, DepthSubUnit, UserRole } from '../types';

interface MobileNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUnit: UnitType;
  depthSubUnit?: DepthSubUnit;
  onSelectUnit: (unit: UnitType, subUnit?: DepthSubUnit) => void;
  userRole: UserRole;
  activeTeamName?: string;
  onOpenPreferencesModal?: () => void;
}

interface NavSectionItem {
  id: UnitType;
  subUnit?: DepthSubUnit;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badge?: string;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: NavSectionItem[];
}

export const MobileNavigationModal: React.FC<MobileNavigationModalProps> = ({
  isOpen,
  onClose,
  activeUnit,
  depthSubUnit = 'offense',
  onSelectUnit,
  userRole,
  activeTeamName = 'Mahopac 10U',
  onOpenPreferencesModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const SECTIONS: NavSection[] = useMemo(
    () => [
      {
        title: 'Game Day Hub & Sideline',
        icon: Swords,
        color: 'text-red-400',
        items: [
          {
            id: 'game_day',
            label: '⚡ Sideline HUD & Clock',
            subtitle: 'Live game clock, timeouts, field HUD & quick plays',
            icon: Swords,
            accentColor: 'border-red-500/40 hover:bg-red-950/40 text-red-300',
            badge: 'Live',
          },
          {
            id: 'call_sheet',
            label: '🏈 Sideline Call Sheet',
            subtitle: 'Offense and defense situation-based play sheets',
            icon: FileSpreadsheet,
            accentColor: 'border-red-500/40 hover:bg-red-950/40 text-red-300',
          },
          {
            id: 'wristband',
            label: '⌚ Wristband Inserts',
            subtitle: 'Player wristband play inserts and card grid',
            icon: Watch,
            accentColor: 'border-amber-500/40 hover:bg-amber-950/40 text-amber-300',
          },
          {
            id: 'hudl_scout',
            label: '📊 Hudl Scout',
            subtitle: 'Our team by game plus this week’s opponent Hudl film',
            icon: BarChart3,
            accentColor: 'border-blue-500/40 hover:bg-blue-950/40 text-blue-300',
          },
          {
            id: 'tendencies',
            label: '📈 Formations & Tendencies',
            subtitle: 'Run/pass breakdown by defensive down & distance',
            icon: TrendingUp,
            accentColor: 'border-amber-500/40 hover:bg-amber-950/40 text-amber-300',
          },
        ],
      },
      {
        title: 'Depth Chart & Formations',
        icon: Layers,
        color: 'text-indigo-400',
        items: [
          {
            id: 'offense',
            subUnit: 'offense',
            label: '🏈 Offense Formations & Slots',
            subtitle: 'Base sets, spread formations, player positions & 2-deep',
            icon: Layers,
            accentColor: 'border-indigo-500/40 hover:bg-indigo-950/40 text-indigo-300',
          },
          {
            id: 'defense',
            subUnit: 'defense',
            label: '🛡️ Defense Fronts & Coverage',
            subtitle: '4-3, 3-4, 5-3 fronts, blitz packages & secondary shell',
            icon: Shield,
            accentColor: 'border-indigo-500/40 hover:bg-indigo-950/40 text-indigo-300',
          },
          {
            id: 'st',
            subUnit: 'st',
            label: '⚡ Special Teams (KOR, Punt)',
            subtitle: 'Kickoff return, punt coverage, extra point unit & hands team',
            icon: Zap,
            accentColor: 'border-indigo-500/40 hover:bg-indigo-950/40 text-indigo-300',
          },
          {
            id: 'groups',
            subUnit: 'groups',
            label: '👥 Position Groups Matrix',
            subtitle: 'Skill, hybrid, linemen depth hierarchy table',
            icon: Users,
            accentColor: 'border-indigo-500/40 hover:bg-indigo-950/40 text-indigo-300',
          },
          {
            id: 'scrimmage',
            subUnit: 'scrimmage',
            label: '⚔️ Scrimmage 11v11 Rotation',
            subtitle: 'Live 11v11 scrimmage rotation board & snap tracking',
            icon: Swords,
            accentColor: 'border-indigo-500/40 hover:bg-indigo-950/40 text-indigo-300',
          },
          {
            id: 'practice_live',
            subUnit: 'practice_live',
            label: '🔥 Practice 7v7 / 11v11 Drills',
            subtitle: 'Custom offense vs defense drill sets, 7v7 & 11v11 matchups',
            icon: Swords,
            accentColor: 'border-orange-500/40 hover:bg-orange-950/40 text-orange-300',
            badge: 'Live',
          },
        ],
      },
      {
        title: 'Playbook, Whiteboard & Drills',
        icon: PenTool,
        color: 'text-emerald-400',
        items: [
          {
            id: 'whiteboard',
            label: '🖍️ Whiteboard Playbook & Drills',
            subtitle: 'Interactive play diagramming, animated routes & position drills',
            icon: PenTool,
            accentColor: 'border-emerald-500/40 hover:bg-emerald-950/40 text-emerald-300',
            badge: 'Interactive',
          },
          {
            id: 'drills',
            label: '🏋️ Drill Matrix & Library',
            subtitle: '70+ football drills: Offense, Defense, Tackling & Blocking',
            icon: Dumbbell,
            accentColor: 'border-emerald-500/40 hover:bg-emerald-950/40 text-emerald-300',
            badge: '70+ Drills',
          },
          {
            id: 'guide',
            label: '📖 Playbooks & PDF Guides',
            subtitle: 'Playbook reference guides, offensive schemes & PDF exports',
            icon: BookOpen,
            accentColor: 'border-emerald-500/40 hover:bg-emerald-950/40 text-emerald-300',
          },
        ],
      },
      {
        title: 'Schedule & Practice Planning',
        icon: Calendar,
        color: 'text-purple-400',
        items: [
          {
            id: 'practice',
            label: '📋 Practice Planner',
            subtitle: 'Period-by-period scripts, station rotations & practice timer',
            icon: ClipboardList,
            accentColor: 'border-purple-500/40 hover:bg-purple-950/40 text-purple-300',
          },
          {
            id: 'schedule',
            label: '📅 Team Schedule & Calendar',
            subtitle: 'Games, practices, walk-throughs & season calendar',
            icon: Calendar,
            accentColor: 'border-purple-500/40 hover:bg-purple-950/40 text-purple-300',
          },
          {
            id: 'compliance',
            label: '⚡ Practice Hours & Compliance',
            subtitle: 'Youth contact minutes, safety rules & heat tracking',
            icon: Zap,
            accentColor: 'border-purple-500/40 hover:bg-purple-950/40 text-purple-300',
          },
          {
            id: 'ppr',
            label: '📊 PFF Film Grades',
            subtitle: 'Monday grades from last week’s depth chart, play numbers & notes',
            icon: BarChart3,
            accentColor: 'border-cyan-500/40 hover:bg-cyan-950/40 text-cyan-300',
          },
        ],
      },
      {
        title: 'Coach Tools & Administration',
        icon: Smartphone,
        color: 'text-cyan-400',
        items: [
          {
            id: 'mobile_hub',
            label: '📱 Mobile Coach Field HUD',
            subtitle: 'One-thumb quick launch dashboard for practice & game day',
            icon: Smartphone,
            accentColor: 'border-cyan-500/40 hover:bg-cyan-950/40 text-cyan-300',
          },
          {
            id: 'users',
            label: '👥 Staff & Access Manager',
            subtitle: 'Coaches, assistant assignments, parent permissions & security',
            icon: Users,
            accentColor: 'border-cyan-500/40 hover:bg-cyan-950/40 text-cyan-300',
            badge: 'Admin',
            adminOnly: true,
          },
        ],
      },
    ],
    []
  );

  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) {
      return SECTIONS.map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => !item.adminOnly || userRole === 'admin'),
      }));
    }

    const term = searchTerm.toLowerCase();
    return SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => {
        if (item.adminOnly && userRole !== 'admin') return false;
        return (
          item.label.toLowerCase().includes(term) ||
          item.subtitle.toLowerCase().includes(term) ||
          sec.title.toLowerCase().includes(term)
        );
      }),
    })).filter((sec) => sec.items.length > 0);
  }, [SECTIONS, searchTerm, userRole]);

  if (!isOpen) return null;

  const isCurrentItemActive = (item: NavSectionItem) => {
    if (item.subUnit) {
      return (
        activeUnit === item.subUnit ||
        (activeUnit === 'depth_chart' && depthSubUnit === item.subUnit)
      );
    }
    if (item.id === 'depth_chart') {
      return ['depth_chart', 'offense', 'defense', 'st', 'groups', 'scrimmage'].includes(
        activeUnit
      );
    }
    if (item.id === 'whiteboard') {
      return activeUnit === 'whiteboard';
    }
    if (item.id === 'drills') {
      return activeUnit === 'drills';
    }
    return activeUnit === item.id;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="All Navigation Views"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Backdrop overlay touch-to-dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Bottom Sheet Container */}
      <div className="relative w-full max-h-[88vh] bg-slate-950 border-t border-slate-800 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Top Handle / Grab Bar */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-12 h-1.5 rounded-full bg-slate-700" />
        </div>

        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <span className="text-base">🏈</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white tracking-tight truncate">
                All Navigation Views
              </h2>
              <p className="text-[11px] font-semibold text-indigo-300 truncate">
                {activeTeamName} &bull; Touch any view to switch
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800 cursor-pointer active:scale-95 transition-all"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input for Quick Navigation */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search views (e.g., calls, defense, blitz, drills)..."
              className="w-full bg-slate-900 border border-slate-750 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Scrollable View List */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
          {filteredSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <section.icon className={`w-3.5 h-3.5 ${section.color}`} />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {section.title}
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {section.items.map((item) => {
                  const active = isCurrentItemActive(item);
                  const Icon = item.icon;

                  return (
                    <button
                      key={`${item.id}_${item.subUnit || ''}`}
                      type="button"
                      onClick={() => {
                        onSelectUnit(item.id, item.subUnit);
                        onClose();
                      }}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 active:scale-[0.99] cursor-pointer ${
                        active
                          ? 'bg-indigo-100 dark:bg-indigo-900/70 border-indigo-400 shadow-md shadow-slate-900/10 dark:shadow-indigo-950/50 ring-1 ring-indigo-400/40'
                          : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-black truncate ${
                                active ? 'text-white' : 'text-slate-100'
                              }`}
                            >
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {item.badge}
                              </span>
                            )}
                            {active && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-indigo-400' : 'text-slate-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredSections.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              No views matching "{searchTerm}"
            </div>
          )}

          {/* Quick Coach Utilities in Drawer */}
          {onOpenPreferencesModal && (
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPreferencesModal();
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Coach Preferences &amp; Defaults</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
